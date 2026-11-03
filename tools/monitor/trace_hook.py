#!/usr/bin/env python3
"""Claude Code hook: trace every subagent tool call into the monitor's local logs (never blocks, never prints).

Registered by .claude/settings.json (through trace-hook.sh) on PostToolUse, PostToolUseFailure and SubagentStop.
Reads the hook JSON on stdin. Main-session calls (no agent_id) are ignored. A subagent is traced only when its
prompt carries the marker line  MONITOR run=<runId> phase=<phase> agent=<agentId> task=<taskId>  (or a log.sh
reporting command); the identity is read once from the agent's transcript and cached in
.bridle/progress/.mirror/agents/<agent_id>.json.

- PostToolUse / PostToolUseFailure: append {tsMs, tool, target, ok, ms, id} to
  .bridle/progress/<runId>/<agentId>.trace.jsonl. target is a file path, the first 80 characters of a command, a
  search pattern or a description; never the tool response or the full input. mirror.py folds these lines into
  one agent.activity event per mirror pass.
- SubagentStop: if the agent never wrote agent.done or agent.fail, append an agent.done (data.auto = true) built
  from its last message, so no agent stays "running" on the monitor.
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import monlib  # noqa: E402

FILE_TOOLS = ('Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit')
MAX_MISSES = 3
_WS = re.compile(r'\s+')


def rel_path(root, p):
    p = str(p or '')
    if p.startswith(root + os.sep):
        return p[len(root) + 1:]
    return p


def target_of(root, tool, ti, hook):
    ti = ti if isinstance(ti, dict) else {}
    if tool in FILE_TOOLS:
        return rel_path(root, ti.get('file_path') or ti.get('notebook_path') or '')
    if tool == 'Bash':
        return _WS.sub(' ', str(ti.get('command') or '')).strip()[:80]
    if tool in ('Grep', 'Glob'):
        return str(ti.get('pattern') or '')[:80]
    if tool in ('Agent', 'Task', 'Workflow'):
        return str(ti.get('description') or '')[:80]
    if tool in ('WebFetch', 'WebSearch'):
        return str(ti.get('url') or ti.get('query') or '')[:80]
    if tool == 'ToolSearch':
        return str(ti.get('query') or '')[:80]
    srv = hook.get('mcp_server')
    if isinstance(srv, dict) and srv.get('name'):
        return str(srv['name'])[:80]
    return ''


def candidates(root, hook):
    aid = str(hook.get('agent_id'))
    sid = str(hook.get('session_id') or '')
    out = []
    for key in ('agent_transcript_path', 'transcript_path'):
        p = hook.get(key)
        if p and ('agent-' + aid) in os.path.basename(str(p)) and os.path.exists(str(p)):
            out.append(str(p))
    pats = []
    if sid:
        pats.append(os.path.join(root, '.claude-sessions', sid, '**', 'agent-' + aid + '.jsonl'))
        pats.append(os.path.join(os.path.expanduser('~'), '.claude', 'projects', '*', sid, '**', 'agent-' + aid + '.jsonl'))
    pats.append(os.path.join(root, '.claude-sessions', '**', 'agent-' + aid + '.jsonl'))
    for pat in pats:
        for p in glob.glob(pat, recursive=True):
            if p not in out:
                out.append(p)
    return out


def resolve(root, progress, hook):
    aid = hook.get('agent_id')
    cache = monlib.identity_cache_path(progress, aid)
    d = monlib.read_json(cache, None)
    if isinstance(d, dict):
        if d.get('agentId'):
            return d
        if d.get('skip'):
            return None
    misses = int((d or {}).get('misses', 0)) if isinstance(d, dict) else 0
    for p in candidates(root, hook):
        ident = monlib.identity_from_transcript(p)
        if ident:
            ident.update({'harnessId': str(aid), 'agentType': str(hook.get('agent_type') or ''), 'transcript': p,
                          'resolvedMs': monlib.now_ms()})
            monlib.write_json(cache, ident)
            return ident
    misses += 1
    monlib.write_json(cache, {'harnessId': str(aid), 'misses': misses, 'skip': misses >= MAX_MISSES})
    return None


def trace(root, progress, ident, hook, ok):
    tool = str(hook.get('tool_name') or '?')
    line = {'tsMs': monlib.now_ms(), 'tool': tool, 'target': target_of(root, tool, hook.get('tool_input'), hook), 'ok': ok}
    if hook.get('duration_ms') is not None:
        try:
            line['ms'] = int(hook['duration_ms'])
        except Exception:
            pass
    if hook.get('tool_use_id'):
        line['id'] = str(hook['tool_use_id'])[:40]
    d = os.path.join(progress, monlib.safe(ident['runId']))
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, monlib.safe(ident['agentId']) + monlib.TRACE_SUFFIX), 'a', encoding='utf-8') as f:
        f.write(json.dumps(line, ensure_ascii=False) + '\n')


def auto_done(progress, ident, hook):
    main_path = os.path.join(progress, monlib.safe(ident['runId']), monlib.safe(ident['agentId']) + '.jsonl')
    if monlib.has_terminal(main_path):
        return
    text = _WS.sub(' ', str(hook.get('last_assistant_message') or '')).strip()
    if not text:
        text = 'Agent stopped without a summary'
    monlib.append_event(progress, ident['runId'], ident['agentId'],
                        {'phase': ident.get('phase'), 'taskId': ident.get('taskId'), 'type': 'agent.done', 'level': 'info',
                         'progress': 100, 'message': text[:400] + (' …' if len(text) > 400 else ''),
                         'data': {'auto': True, 'source': 'SubagentStop hook'}})


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else monlib.ROOT
    progress = os.path.join(root, '.bridle', 'progress')
    try:
        hook = json.load(sys.stdin)
    except Exception:
        return 0
    if not isinstance(hook, dict) or not hook.get('agent_id'):
        return 0
    event = str(hook.get('hook_event_name') or '')
    if event not in ('PostToolUse', 'PostToolUseFailure', 'SubagentStop'):
        return 0
    ident = resolve(root, progress, hook)
    if not ident:
        return 0
    if event == 'SubagentStop':
        auto_done(progress, ident, hook)
    else:
        trace(root, progress, ident, hook, ok=(event == 'PostToolUse'))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main() or 0)
    except Exception:
        sys.exit(0)
