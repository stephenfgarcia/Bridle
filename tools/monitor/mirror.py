#!/usr/bin/env python3
"""Mirror local monitor events into the artifact database: automatic, cursor-based, idempotent.

  mirror.py pending [--take] [--run R] [--chunk 50] [--skip-ids-file F]
        Print the db_write batches for every unmirrored line, one JSON object per line:
        {"batch": "<id>", "idempotencyKey": "<id>", "ops": [{"op":"set","path":"events/<id>","data":{...}}, ...]}
        Outbox batches (printed before, not acked) come first. With --take: fold new trace lines into one
        agent.activity event per agent, advance the cursors, and keep each printed batch in the outbox.
  mirror.py poll          One line ("pending N events (runs) ...") when a mirror pass is due, else nothing.
                          Nothing is printed while an outbox batch is in flight (younger than --stale-after s).
  mirror.py ack (--all | <batchId> ...) [--exists <docPath> ...]
        Mark batches as written. --exists (repeatable) removes those ops from the batch and re-queues the rest
        under a new batch id (for a "document exists" refusal: that event was mirrored by someone else).
  mirror.py status        Cursor, pending and outbox summary.
  mirror.py init [--from-start]
        Set the cursors to the current end of every file (default) so history is never replayed; --from-start
        re-mirrors everything (use with --skip-ids-file holding the ids already in the database, see sync.md).
  mirror.py prune-plan --run R [--types agent.activity,agent.heartbeat] [--older-than 7d]
        Ids of low-value events of a finished run, 50 per line, for the pruning procedure in sync.md.

State: <root>/.mirror/ (root = <repo>/.bridle/progress, or --root for tests): cursor.json, outbox/, agents/.
Rule: events reach the database only through these batches. Nobody else calls db_write for events/<id>, so a
batch is never refused because a document already exists.
"""
import argparse
import glob
import json
import os
import sys
import time

sys.dont_write_bytecode = True  # keep the tree free of __pycache__
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import monlib  # noqa: E402

MIRROR = monlib.MIRROR_DIR


class Store:
    def __init__(self, root):
        self.root = os.path.abspath(root)
        self.dir = os.path.join(self.root, MIRROR)
        self.cursor_path = os.path.join(self.dir, 'cursor.json')
        self.outbox = os.path.join(self.dir, 'outbox')
        self.state_path = os.path.join(self.dir, 'state.json')
        c = monlib.read_json(self.cursor_path, None)
        self.initialized = isinstance(c, dict) and 'files' in c
        self.cursor = (c or {}).get('files', {}) if isinstance(c, dict) else {}
        self.state = monlib.read_json(self.state_path, {}) or {}

    def save(self):
        monlib.write_json(self.cursor_path, {'files': self.cursor, 'savedMs': monlib.now_ms()})
        monlib.write_json(self.state_path, self.state)

    def files(self, run=None):
        """[(rel, abs)] of every *.jsonl under root (not .mirror), sorted; rel uses '/'."""
        out = []
        for p in sorted(glob.glob(os.path.join(self.root, '**', '*.jsonl'), recursive=True)):
            rel = os.path.relpath(p, self.root).replace(os.sep, '/')
            if rel.startswith(MIRROR + '/'):
                continue
            if run and not rel.startswith(monlib.safe(run) + '/'):
                continue
            out.append((rel, p))
        return out

    def main_files(self, run=None):
        return [(r, p) for r, p in self.files(run) if not r.endswith(monlib.TRACE_SUFFIX)]

    def trace_files(self, run=None):
        return [(r, p) for r, p in self.files(run) if r.endswith(monlib.TRACE_SUFFIX)]

    def new_lines(self, rel, path):
        lines = monlib.nonblank_lines(path)
        cur = int(self.cursor.get(rel, 0))
        if len(lines) < cur:
            cur = 0  # file was truncated or rewritten: start over
        return lines[cur:], len(lines)

    def outbox_batches(self):
        out = []
        for p in sorted(glob.glob(os.path.join(self.outbox, '*.json'))):
            b = monlib.read_json(p, None)
            if isinstance(b, dict) and b.get('batch'):
                b['_path'] = p
                out.append(b)
        return out

    def oldest_outbox_age_s(self):
        ages = [time.time() - os.path.getmtime(b['_path']) for b in self.outbox_batches()]
        return max(ages) if ages else None


def init_cursor(st, from_start=False):
    for rel, path in st.files():
        st.cursor[rel] = 0 if from_start else len(monlib.nonblank_lines(path))
    st.state['initializedMs'] = monlib.now_ms()
    st.save()
    return len(st.cursor)


def fold_traces(st, run=None, now_ms=None):
    """One agent.activity event per agent with new trace lines; advances the trace cursors. Returns [(rel, event)]."""
    idents = monlib.load_identities(st.root)
    folded = []
    for rel, path in st.trace_files(run):
        lines, total = st.new_lines(rel, path)
        if not lines:
            continue
        run_id = rel.split('/')[0]
        agent = rel.split('/')[-1][:-len(monlib.TRACE_SUFFIX)]
        fields = monlib.summarize_trace(lines)
        ident = idents.get(agent)
        main_path = os.path.join(st.root, run_id, agent + '.jsonl')
        last = monlib.last_event(main_path)
        if ident:
            fields['phase'], fields['taskId'] = ident.get('phase'), ident.get('taskId')
        elif last:
            fields['phase'], fields['taskId'] = last.get('phase'), last.get('taskId')
        if last and last.get('agentLabel'):
            fields['agentLabel'] = last['agentLabel']
        ev, _ = monlib.append_event(st.root, run_id, agent, fields, ts_ms=now_ms)
        st.cursor[rel] = total
        folded.append((rel, ev))
    return folded


def collect_ops(st, run=None, take=False, skip_ids=None):
    ops, skipped = [], 0
    for rel, path in st.main_files(run):
        lines, total = st.new_lines(rel, path)
        for obj in monlib.parse_lines(lines):
            eid = obj.get('id')
            if not eid or (skip_ids and eid in skip_ids):
                skipped += 1
                continue
            ops.append({'op': 'set', 'path': 'events/' + str(eid), 'data': obj})
        skipped += len(lines) - len(monlib.parse_lines(lines))
        if take:
            st.cursor[rel] = total
    return ops, skipped


def make_batches(ops, chunk, salt=0):
    base = monlib.now_ms()
    out = []
    for i in range(0, len(ops), chunk):
        bid = 'mirror-%d-%d' % (base, salt + i // chunk + 1)
        out.append({'batch': bid, 'idempotencyKey': bid, 'ops': ops[i:i + chunk], 'createdMs': base})
    return out


def print_batch(b):
    print(json.dumps({'batch': b['batch'], 'idempotencyKey': b['idempotencyKey'], 'ops': b['ops']}, ensure_ascii=False))


def cmd_pending(a):
    st = Store(a.root)
    if not st.initialized:
        n = init_cursor(st)
        print('mirror.py: cursor initialised at the current end of %d files; earlier lines are not replayed (sync.md explains how)' % n, file=sys.stderr)
    skip = set()
    if a.skip_ids_file:
        with open(a.skip_ids_file, encoding='utf-8') as f:
            skip = {ln.strip().strip('"') for ln in f if ln.strip()}
    for b in st.outbox_batches():
        print_batch(b)
    if a.take:
        fold_traces(st, a.run)
    ops, skipped = collect_ops(st, a.run, take=a.take, skip_ids=skip)
    batches = make_batches(ops, a.chunk, salt=len(st.outbox_batches()))
    for b in batches:
        if a.take:
            os.makedirs(st.outbox, exist_ok=True)
            monlib.write_json(os.path.join(st.outbox, b['batch'] + '.json'), b)
        print_batch(b)
    if a.take:
        st.state['lastTakeMs'] = monlib.now_ms()
        st.save()
    if skipped:
        print('mirror.py: %d lines skipped (no id, unparseable, or listed in --skip-ids-file)' % skipped, file=sys.stderr)


def pending_summary(st, run=None):
    n, runs = 0, set()
    for rel, path in st.main_files(run):
        lines, _ = st.new_lines(rel, path)
        objs = [o for o in monlib.parse_lines(lines) if o.get('id')]
        if objs:
            n += len(objs)
            runs.add(rel.split('/')[0])
    traces = 0
    for rel, path in st.trace_files(run):
        lines, _ = st.new_lines(rel, path)
        if lines:
            traces += 1
            runs.add(rel.split('/')[0])
    return n, traces, sorted(runs)


def cmd_poll(a):
    st = Store(a.root)
    if not st.initialized:
        init_cursor(st)
    n, traces, runs = pending_summary(st, a.run)
    total = n + traces
    if not total:
        return
    age = st.oldest_outbox_age_s()
    if age is not None and age < a.stale_after:
        return  # a mirror pass is in flight; the next poll after ack will report
    extra = (' + %d agent%s with new tool calls' % (traces, '' if traces == 1 else 's')) if traces else ''
    ob = len(st.outbox_batches())
    print('pending %d event%s%s (%s)%s' % (n, '' if n == 1 else 's', extra, ', '.join(runs) or '-',
                                            ('; %d outbox batch(es) older than %ds, retry them' % (ob, a.stale_after)) if ob else ''))


def cmd_ack(a):
    st = Store(a.root)
    batches = st.outbox_batches()
    chosen = batches if a.all else [b for b in batches if b['batch'] in set(a.ids)]
    if not chosen:
        print('mirror.py: nothing to ack', file=sys.stderr)
        return
    for b in chosen:
        if a.exists:
            drop = set(a.exists)
            rest = [op for op in b['ops'] if op.get('path') not in drop]
            os.remove(b['_path'])
            if rest:
                nb = make_batches(rest, len(rest), salt=int(time.time()) % 1000)[0]
                monlib.write_json(os.path.join(st.outbox, nb['batch'] + '.json'), nb)
                print_batch(nb)
            continue
        os.remove(b['_path'])
    st.state['lastAckMs'] = monlib.now_ms()
    st.save()


def cmd_status(a):
    st = Store(a.root)
    n, traces, runs = pending_summary(st)
    mirrored = sum(int(v) for k, v in st.cursor.items() if not k.endswith(monlib.TRACE_SUFFIX))
    ob = st.outbox_batches()
    age = st.oldest_outbox_age_s()
    print('root        %s' % st.root)
    print('initialised %s' % (monlib.iso(st.state['initializedMs']) if st.state.get('initializedMs') else 'no (first pending/poll sets the cursor to the current end)'))
    print('files       %d event files, %d trace files' % (len(st.main_files()), len(st.trace_files())))
    print('mirrored    %d event lines (cursor)' % mirrored)
    print('pending     %d events, %d agents with new tool calls (%s)' % (n, traces, ', '.join(runs) or '-'))
    print('outbox      %d batch(es)%s' % (len(ob), (', oldest %ds' % age) if age is not None else ''))
    print('last take   %s' % (monlib.iso(st.state['lastTakeMs']) if st.state.get('lastTakeMs') else '-'))
    print('last ack    %s' % (monlib.iso(st.state['lastAckMs']) if st.state.get('lastAckMs') else '-'))


def cmd_init(a):
    st = Store(a.root)
    n = init_cursor(st, from_start=a.from_start)
    print('cursor set for %d files (%s)' % (n, 'from the start' if a.from_start else 'at the current end'))


def cmd_prune_plan(a):
    st = Store(a.root)
    types = set(t.strip() for t in a.types.split(',') if t.strip())
    cutoff = monlib.now_ms() - int(float(a.older_than.rstrip('d')) * 86400000) if a.older_than else None
    ids = []
    for rel, path in st.main_files(a.run):
        for o in monlib.parse_lines(monlib.nonblank_lines(path)):
            if o.get('id') and o.get('type') in types and (cutoff is None or int(o.get('tsMs') or 0) < cutoff):
                ids.append(o['id'])
    print('%d events of run %s match types %s%s; the JSONL keeps them. Get versions with db_query, then db_write delete, 50 per call:' % (
        len(ids), a.run, ','.join(sorted(types)), (' older than ' + a.older_than) if a.older_than else ''), file=sys.stderr)
    for i in range(0, len(ids), 50):
        print(json.dumps(ids[i:i + 50]))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--root', default=monlib.PROGRESS)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('pending'); p.add_argument('--take', action='store_true'); p.add_argument('--run')
    p.add_argument('--chunk', type=int, default=50); p.add_argument('--skip-ids-file'); p.set_defaults(f=cmd_pending)
    p = sub.add_parser('poll'); p.add_argument('--run'); p.add_argument('--stale-after', type=float, default=90); p.set_defaults(f=cmd_poll)
    p = sub.add_parser('ack'); p.add_argument('ids', nargs='*'); p.add_argument('--all', action='store_true'); p.add_argument('--exists', action='append', metavar='DOCPATH'); p.set_defaults(f=cmd_ack)
    p = sub.add_parser('status'); p.set_defaults(f=cmd_status)
    p = sub.add_parser('init'); p.add_argument('--from-start', action='store_true'); p.set_defaults(f=cmd_init)
    p = sub.add_parser('prune-plan'); p.add_argument('--run', required=True); p.add_argument('--types', default='agent.activity,agent.heartbeat')
    p.add_argument('--older-than', default=''); p.set_defaults(f=cmd_prune_plan)
    a = ap.parse_args(argv)
    a.f(a)


if __name__ == '__main__':
    main()
