#!/usr/bin/env python3
"""Backfill monitor events from a Claude Code workflow transcript directory.

For agents that did not (or could not) report through log.sh, derive agent.start / agent.done /
agent.heartbeat events from the harness's own journal and per-agent transcripts, append them to
.bridle/progress/<runId>/<agentId>.jsonl (deduplicated by id), and print db_write-ready op batches.

Usage:
  tools/monitor/backfill.py --run <runId> --dir <transcript dir> --task <taskId> --phase <phase> [--chunk 50]
"""
import argparse, json, os, re, sys

def ts_ms(iso):
    import datetime
    s = iso.replace('Z', '+00:00')
    return int(datetime.datetime.fromisoformat(s).timestamp() * 1000)

def iso_from_ms(ms):
    import datetime
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def safe(s):
    return re.sub(r'[^A-Za-z0-9_.-]', '-', s).strip('-')[:60]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', required=True); ap.add_argument('--dir', required=True)
    ap.add_argument('--task', required=True); ap.add_argument('--phase', required=True)
    ap.add_argument('--chunk', type=int, default=50)
    a = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    out_dir = os.path.join(root, '.bridle', 'progress', safe(a.run))
    os.makedirs(out_dir, exist_ok=True)
    journal = os.path.join(a.dir, 'journal.jsonl')
    agents = {}
    for line in open(journal, encoding='utf-8'):
        line = line.strip()
        if not line: continue
        j = json.loads(line)
        aid = j.get('agentId')
        if not aid: continue
        rec = agents.setdefault(aid, {'label': j.get('label') or aid, 'phase': j.get('phase') or '', 'done': False})
        if j.get('label'): rec['label'] = j['label']
        if j.get('phase'): rec['phase'] = j['phase']
        if j.get('type') == 'result': rec['done'] = True; rec['null'] = j.get('result') is None
    ops = []
    for aid, rec in agents.items():
        path = os.path.join(a.dir, f'agent-{aid}.jsonl')
        if not os.path.exists(path): continue
        first = last = None; n = 0
        with open(path, encoding='utf-8') as f:
            for ln in f:
                try: t = json.loads(ln).get('timestamp')
                except Exception: continue
                if not t: continue
                n += 1
                if first is None: first = t
                last = t
        if first is None: continue
        agent_id = safe(rec['label'])
        local = os.path.join(out_dir, agent_id + '.jsonl')
        existing_ids, existing_ts = set(), set()
        if os.path.exists(local):
            for ln in open(local, encoding='utf-8'):
                try: e = json.loads(ln)
                except Exception: continue
                existing_ids.add(e.get('id')); existing_ts.add((e.get('type'), e.get('tsMs')))
        base = {'runId': a.run, 'phase': a.phase, 'taskId': a.task, 'agentId': agent_id, 'agentLabel': rec['label'],
                'level': 'info', 'data': {'harnessAgentId': aid, 'workflowPhase': rec['phase'], 'transcriptLines': n, 'backfilled': True}}
        evs = []
        s_ms = ts_ms(first)
        evs.append(dict(base, ts=iso_from_ms(s_ms), tsMs=s_ms, seq=1, type='agent.start', progress=0,
                        message=f"Workflow agent started ({rec['phase']} stage); backfilled from the harness transcript"))
        l_ms = ts_ms(last)
        if rec['done']:
            msg = 'Returned a null result (skipped or failed after retries)' if rec.get('null') else f"Finished and returned its structured result ({n} transcript lines)"
            evs.append(dict(base, ts=iso_from_ms(l_ms), tsMs=l_ms, seq=2, type=('agent.fail' if rec.get('null') else 'agent.done'),
                            progress=100, message=msg))
        else:
            if ('agent.heartbeat', l_ms) not in existing_ts:
                evs.append(dict(base, ts=iso_from_ms(l_ms), tsMs=l_ms, seq=2, type='agent.heartbeat',
                                message=f"Still working; {n} transcript lines so far"))
        with open(local, 'a', encoding='utf-8') as f:
            for e in evs:
                e['id'] = f"{e['tsMs']}-{agent_id}-{e['seq']:04d}"
                if e['id'] in existing_ids: continue
                f.write(json.dumps(e, ensure_ascii=False) + '\n')
                ops.append({'op': 'set', 'path': 'events/' + e['id'], 'data': e})
    for i in range(0, len(ops), a.chunk):
        print(json.dumps(ops[i:i + a.chunk], ensure_ascii=False))
    print(f"{len(ops)} new events for {len(agents)} agents", file=sys.stderr)

if __name__ == '__main__':
    main()
