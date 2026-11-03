#!/usr/bin/env python3
"""Shared helpers for the Bridle Build Monitor writers (mirror.py, trace_hook.py, serve.py).

The event contract is the one tools/monitor/log.sh writes and tools/monitor/check.py validates:
one JSON object per line in .bridle/progress/<runId>/<agentId>.jsonl, id = "<tsMs>-<agentId>-<seq>" where
seq is the 1-based count of non-blank lines in that file. log.sh stays standalone on purpose (agents call it
while this module may be mid-edit); this module reproduces the same rule for the automatic writers.
"""
import glob
import json
import os
import re
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROGRESS = os.path.join(ROOT, '.bridle', 'progress')
MIRROR_DIR = '.mirror'
TRACE_SUFFIX = '.trace.jsonl'
TERMINAL = ('agent.done', 'agent.fail')
_SAFE = re.compile(r'[^A-Za-z0-9_.-]')
_TOKEN = r'([A-Za-z0-9_.-]+)'
MARKER_RE = re.compile(r'MONITOR\s+run=' + _TOKEN + r'\s+phase=' + _TOKEN + r'\s+agent=' + _TOKEN + r'\s+task=' + _TOKEN)
LOGSH_RE = re.compile(r'log\.sh\s+-r\s+' + _TOKEN + r'\s+-p\s+' + _TOKEN + r'\s+-a\s+' + _TOKEN + r'\s+-t\s+' + _TOKEN)


def safe(s):
    return _SAFE.sub('-', str(s))


def now_ms():
    return int(time.time() * 1000)


def iso(ms):
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ms / 1000.0))


def read_json(path, default=None):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp.%d' % os.getpid()
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def nonblank_lines(path):
    """Every non-blank line of a file (bytes decoded leniently), in order. Missing file: []."""
    if not os.path.exists(path):
        return []
    with open(path, 'rb') as f:
        raw = f.read()
    out = []
    for line in raw.split(b'\n'):
        if line.strip():
            out.append(line.decode('utf-8', 'replace').rstrip('\r'))
    return out


def parse_lines(lines):
    """JSON objects for the parseable lines, in order (others skipped)."""
    out = []
    for line in lines:
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if isinstance(obj, dict):
            out.append(obj)
    return out


def append_event(progress_root, run, agent, fields, ts_ms=None):
    """Append one event to <progress_root>/<run>/<agent>.jsonl with log.sh's id and seq rule.

    fields may carry phase, taskId, type, level, message, progress, step, status, data, agentLabel.
    Returns (event, db_write op)."""
    run, agent = safe(run), safe(agent)
    d = os.path.join(progress_root, run)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, agent + '.jsonl')
    ms = int(ts_ms or now_ms())
    seq = len(nonblank_lines(path)) + 1
    ev = {'ts': iso(ms), 'tsMs': ms, 'seq': seq, 'runId': run, 'phase': str(fields.get('phase') or '-'),
          'taskId': str(fields.get('taskId') or '-'), 'agentId': agent, 'agentLabel': str(fields.get('agentLabel') or agent),
          'type': str(fields.get('type') or 'agent.log'), 'level': str(fields.get('level') or 'info'),
          'message': str(fields.get('message') if fields.get('message') is not None else '')}
    if fields.get('progress') is not None:
        ev['progress'] = max(0, min(100, int(float(fields['progress']))))
    for k in ('step', 'status'):
        if fields.get(k):
            ev[k] = str(fields[k])
    if fields.get('data') is not None:
        ev['data'] = fields['data']
    ev['id'] = '%d-%s-%04d' % (ms, agent, seq)
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(ev, ensure_ascii=False) + '\n')
    return ev, {'op': 'set', 'path': 'events/' + ev['id'], 'data': ev}


def last_event(path):
    objs = parse_lines(nonblank_lines(path))
    return objs[-1] if objs else None


def has_terminal(path):
    return any(o.get('type') in TERMINAL for o in parse_lines(nonblank_lines(path)))


def identity_from_text(text):
    m = MARKER_RE.search(text) or LOGSH_RE.search(text)
    if not m:
        return None
    return {'runId': m.group(1), 'phase': m.group(2), 'agentId': m.group(3), 'taskId': m.group(4)}


def _texts_of(obj):
    msg = obj.get('message') if isinstance(obj, dict) else None
    if not isinstance(msg, dict):
        return []
    c = msg.get('content')
    if isinstance(c, str):
        return [c]
    out = []
    if isinstance(c, list):
        for part in c:
            if isinstance(part, dict):
                t = part.get('text') or part.get('content')
                if isinstance(t, str):
                    out.append(t)
                elif isinstance(t, list):
                    out.extend(x.get('text', '') for x in t if isinstance(x, dict))
    return out


def identity_from_transcript(path, max_bytes=512 * 1024):
    """Find the MONITOR marker (or a log.sh call) in a Claude Code transcript: user messages first, then any line."""
    try:
        with open(path, 'rb') as f:
            chunk = f.read(max_bytes).decode('utf-8', 'replace')
    except Exception:
        return None
    lines = chunk.split('\n')
    later = []
    for line in lines:
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except Exception:
            later.append(line)
            continue
        if isinstance(obj, dict) and obj.get('type') == 'user':
            for t in _texts_of(obj):
                ident = identity_from_text(t)
                if ident:
                    return ident
        else:
            later.append(line)
    for line in later:
        ident = identity_from_text(line)
        if ident:
            return ident
    return None


def identity_cache_path(progress_root, harness_id):
    return os.path.join(progress_root, MIRROR_DIR, 'agents', safe(harness_id) + '.json')


def load_identities(progress_root):
    """agentId -> identity for every cached hook identity (newest wins)."""
    out = {}
    for p in sorted(glob.glob(os.path.join(progress_root, MIRROR_DIR, 'agents', '*.json')), key=os.path.getmtime):
        d = read_json(p, {})
        if isinstance(d, dict) and d.get('agentId'):
            out[d['agentId']] = d
    return out


def summarize_trace(lines):
    """Fold trace lines ({tsMs, tool, target, ok, ms, id}) into the fields of one agent.activity event."""
    objs = parse_lines(lines)
    tools, files, recent, fails = {}, [], [], 0
    first_ms, last, last_ms = None, None, 0
    for o in objs:
        tool = str(o.get('tool') or '?')
        tools[tool] = tools.get(tool, 0) + 1
        target = str(o.get('target') or '')
        ms = int(o.get('tsMs') or 0)
        if first_ms is None or (ms and ms < first_ms):
            first_ms = ms
        if ms >= last_ms:
            last_ms, last = ms, {'tool': tool, 'target': target, 'tsMs': ms}
        if o.get('ok') is False:
            fails += 1
        if tool in ('Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit') and target and target not in files:
            files.append(target)
        label = tool + (' ' + target if target else '')
        if label not in recent:
            recent.append(label)
    calls = len(objs)
    shown = recent[-4:]
    message = '%d tool call%s' % (calls, '' if calls == 1 else 's')
    if shown:
        message += ': ' + '; '.join(s[:90] for s in shown)
    if fails:
        message += ' (%d failed)' % fails
    data = {'calls': calls, 'tools': tools, 'files': files[:12], 'failed': fails,
            'sinceTsMs': first_ms or last_ms, 'untilTsMs': last_ms}
    if last:
        data['last'] = last
    return {'type': 'agent.activity', 'level': 'debug', 'message': message, 'data': data}
