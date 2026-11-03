#!/usr/bin/env python3
"""Factory cards: markdown work items with a small frontmatter, moved along the line.

  card.py list
  card.py show <id>
  card.py new <id> "<title>" --phase P1 --order 3 [--deps A,B] [--no-op]
  card.py move <id> <station> [--status running|done|blocked|failed|review] [--agent name] [--note "..."] [--run factory]
  card.py sync-ops [id ...]        # db_write ops (set) for tasks docs; only for docs that do not exist yet
  card.py status [--cards DIR]     # the progress board (markdown table, next up) on stdout; no event, nothing from the clock
  card.py status --write FILE      # regenerate the <!-- board:start --> ... <!-- board:end --> section of FILE (docs/plan/progress.md)
  card.py status --check FILE      # exit 1 when the board's card ids or its `done` ids differ from the cards (station, owner,
                                   # updated and next up are rendered, not checked: the board is regenerated at `new` and at ship)
"""
import sys, os, re, json, subprocess, datetime, argparse, glob

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CARDS = os.path.join(ROOT, 'factory', 'cards')
LOG = os.path.join(ROOT, 'tools', 'monitor', 'log.sh')
STATIONS = ['backlog', 'spec', 'plan', 'build', 'test', 'review', 'ship']
WORKERS = {'backlog': '-', 'spec': 'orchestrator', 'plan': 'factory-planner', 'build': 'factory-builder',
           'test': 'factory-tester', 'review': 'factory-reviewer', 'ship': 'orchestrator'}
SECTIONS = ['Spec', 'Plan', 'Build', 'Test', 'Review', 'Ship']

def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def parse(text):
    m = re.match(r'^---\n(.*?)\n---\n?(.*)$', text, re.S)
    if not m:
        raise SystemExit('card has no frontmatter')
    meta, body = {}, m.group(2)
    key = None
    for line in m.group(1).split('\n'):
        if line.startswith('  - ') and key == 'history':
            meta.setdefault('history', []).append(line[4:].strip())
            continue
        mm = re.match(r'^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$', line)
        if not mm:
            continue
        key, val = mm.group(1), mm.group(2).strip()
        if key == 'history':
            meta['history'] = []
        elif val.startswith('[') and val.endswith(']'):
            meta[key] = [v.strip() for v in val[1:-1].split(',') if v.strip()]
        elif re.fullmatch(r'-?\d+', val):
            meta[key] = int(val)
        elif val in ('true', 'false'):
            meta[key] = (val == 'true')
        else:
            meta[key] = val
    return meta, body

def dump(meta, body):
    order = ['id', 'title', 'phase', 'order', 'dependsOn', 'estimate', 'station', 'status', 'owner', 'placeholder', 'updated', 'history']
    lines = ['---']
    for k in order + [k for k in meta if k not in order]:
        if k not in meta:
            continue
        v = meta[k]
        if k == 'history':
            lines.append('history:')
            for hline in v:
                lines.append('  - ' + hline)
        elif isinstance(v, list):
            lines.append(f'{k}: [{", ".join(v)}]')
        elif isinstance(v, bool):
            lines.append(f'{k}: {"true" if v else "false"}')
        else:
            lines.append(f'{k}: {v}')
    lines.append('---')
    return '\n'.join(lines) + '\n' + body

def find(card_id):
    hits = glob.glob(os.path.join(CARDS, card_id + '-*.md')) + glob.glob(os.path.join(CARDS, card_id + '.md'))
    if not hits:
        raise SystemExit(f'no card {card_id} in {CARDS}')
    return hits[0]

def load(card_id):
    path = find(card_id)
    meta, body = parse(open(path, encoding='utf-8').read())
    return path, meta, body

def task_doc(meta):
    d = {'id': meta['id'], 'title': meta['title'], 'phase': meta['phase'], 'order': int(meta.get('order', 0))}
    if meta.get('dependsOn'): d['dependsOn'] = meta['dependsOn']
    if meta.get('placeholder'): d['placeholder'] = True
    if meta.get('estimate') not in (None, ''): d['estimate'] = meta['estimate']
    d['workstream'] = meta.get('workstream', 'factory')
    return d

def slug(title):
    return re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:40]

def board_rows(cards_dir=CARDS):
    """Every card's frontmatter under cards_dir, sorted by (phase, order, id): the rows of `list` and `status`."""
    rows = []
    for path in sorted(glob.glob(os.path.join(cards_dir, '*.md'))):
        meta, _ = parse(open(path, encoding='utf-8').read())
        rows.append(meta)
    rows.sort(key=lambda m: (m.get('phase', ''), int(m.get('order', 0)), m.get('id', '')))
    return rows

def next_up(rows):
    """The first card at backlog/planned, not a placeholder, with every dependency done; None when nothing is unblocked."""
    done = {m['id'] for m in rows if m.get('status') == 'done'}
    return next((m for m in rows if m.get('station', 'backlog') == 'backlog' and m.get('status', 'planned') == 'planned'
                 and not m.get('placeholder') and all(d in done for d in m.get('dependsOn', []))), None)

def cmd_list(_):
    rows = board_rows(CARDS)
    print(f"{'id':10} {'phase':6} {'station':8} {'status':9} {'order':5} deps / title")
    for m in rows:
        deps = ','.join(m.get('dependsOn', [])) or '-'
        print(f"{m.get('id',''):10} {m.get('phase',''):6} {m.get('station','backlog'):8} {m.get('status','planned'):9} {str(m.get('order','')):5} {deps} / {m.get('title','')}")
    nxt = next_up(rows)
    print('next up:', (nxt['id'] + ' ' + nxt['title']) if nxt else 'nothing unblocked')

BOARD_START, BOARD_END = '<!-- board:start -->', '<!-- board:end -->'

def render_board(rows):
    """The board section of docs/plan/progress.md, newline-terminated: the two markers, one table row per card, next up.
    Nothing from the clock, the path or the environment: two runs on the same cards give the same bytes."""
    lines = [BOARD_START, '| id | phase | station | status | owner | updated |', '|---|---|---|---|---|---|']
    for m in rows:
        lines.append(f"| {m.get('id', '')} | {m.get('phase', '')} | {m.get('station', 'backlog')} | {m.get('status', 'planned')} "
                     f"| {m.get('owner', '-')} | {m.get('updated', '')} |")
    nxt = next_up(rows)
    lines += ['', 'Next up: ' + ((nxt['id'] + ' ' + nxt['title']) if nxt else 'nothing unblocked'), BOARD_END]
    return '\n'.join(lines) + '\n'

def board_section(lines):
    """(start, end) indices of the one board section in lines (a start marker line before an end marker line), else None."""
    starts = [i for i, line in enumerate(lines) if line == BOARD_START]
    ends = [i for i, line in enumerate(lines) if line == BOARD_END]
    if len(starts) != 1 or len(ends) != 1 or starts[0] > ends[0]:
        return None
    return starts[0], ends[0]

def board_ids(lines):
    """(card ids, ids with status done) read from a board section's table rows `| <id> | <phase> | <station> | <status> | ... |`."""
    ids, done = set(), set()
    for line in lines:
        cells = [c.strip() for c in line.split('|')]
        if len(cells) < 8 or cells[1] in ('', 'id') or cells[1].startswith('-'):
            continue  # not a table row: a marker, the header, the separator, the empty line, the next-up line
        ids.add(cells[1])
        if cells[4] == 'done':
            done.add(cells[1])
    return ids, done

def cmd_status(a):
    # Derived from the cards alone: no monitor event (nothing to report), nothing written under .bridle/.
    rows = board_rows(a.cards)
    board = render_board(rows)
    if not a.write and not a.check:
        sys.stdout.write(board)
        return
    path = a.write or a.check
    stale = f'card.py status: {path} is stale: run python3 tools/monitor/card.py status --write {path}'
    if not os.path.isfile(path):
        raise SystemExit(f'card.py status: {path} does not exist' if a.write else stale)
    lines = open(path, encoding='utf-8').read().split('\n')
    sec = board_section(lines)
    if sec is None:
        raise SystemExit(f'card.py status: {path} has no board section ({BOARD_START} ... {BOARD_END})' if a.write else stale)
    if a.check:
        # Only the two sets that change at `new` and at ship: a card moving between stations keeps the board current.
        want_ids = {m.get('id', '') for m in rows}
        want_done = {m['id'] for m in rows if m.get('status') == 'done'}
        have_ids, have_done = board_ids(lines[sec[0]:sec[1] + 1])
        if have_ids != want_ids or have_done != want_done:
            detail = [f'{what}: {", ".join(sorted(s))}' for what, s in (
                ('cards not on the board', want_ids - have_ids), ('board rows without a card', have_ids - want_ids),
                ('done in the cards, not on the board', want_done - have_done),
                ('done on the board, not in the cards', have_done - want_done)) if s]
            raise SystemExit(stale + '\n  ' + '; '.join(detail))
        return
    new = '\n'.join(lines[:sec[0]] + board.split('\n')[:-1] + lines[sec[1] + 1:])
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(new)
    nxt = next_up(rows)
    shown = os.path.relpath(path, ROOT)
    if shown.startswith('..'):
        shown = path
    print(f'{shown}: board written ({len(rows)} cards; next up {nxt["id"] if nxt else "nothing unblocked"})', file=sys.stderr)

def cmd_show(a):
    path, meta, body = load(a.id)
    print(path); print(json.dumps(meta, indent=2))

def cmd_new(a):
    os.makedirs(CARDS, exist_ok=True)
    path = os.path.join(CARDS, f'{a.id}-{slug(a.title)}.md')
    if os.path.exists(path) or glob.glob(os.path.join(CARDS, a.id + '-*.md')):
        raise SystemExit(f'card {a.id} already exists')
    meta = {'id': a.id, 'title': a.title, 'phase': a.phase, 'order': a.order, 'dependsOn': [d for d in (a.deps or '').split(',') if d],
            'station': 'backlog', 'status': 'planned', 'owner': '-', 'updated': now_iso(), 'history': []}
    if a.placeholder: meta['placeholder'] = True
    if a.estimate: meta['estimate'] = a.estimate
    body = f'\n# {a.id} {a.title}\n\n' + '\n'.join(f'## {s}\n\n' for s in SECTIONS)
    open(path, 'w', encoding='utf-8').write(dump(meta, body))
    print(os.path.relpath(path, ROOT), file=sys.stderr)
    if not a.no_op:
        print(json.dumps({'op': 'set', 'path': 'tasks/' + a.id, 'data': task_doc(meta)}))

def cmd_move(a):
    path, meta, body = load(a.id)
    st = a.station.lower()
    if st not in STATIONS:
        raise SystemExit('station must be one of ' + ', '.join(STATIONS))
    status = a.status or ('done' if st == 'ship' else 'planned' if st == 'backlog' else 'running')
    agent = a.agent or WORKERS[st]
    ts = now_iso()
    meta['station'], meta['status'], meta['owner'], meta['updated'] = st, status, agent, ts
    note = a.note or f'Moved to {st}'
    meta.setdefault('history', []).append(f'{ts} {st} {status} {agent} "{note}"'.replace('\n', ' '))
    open(path, 'w', encoding='utf-8').write(dump(meta, body))
    progress = round(STATIONS.index(st) / (len(STATIONS) - 1) * 100)
    cmd = [LOG, '-r', a.run, '-p', str(meta.get('phase', '')), '-a', agent, '-t', meta['id'], '-T', 'card.move', '-s', st,
           '-S', status, '-P', str(progress), '-m', note, '-L', agent,
           '-d', json.dumps({'station': st, 'card': os.path.relpath(path, ROOT), 'from': a.from_station or ''})]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit('log.sh failed: ' + out.stderr)
    print(out.stdout.strip())

def cmd_sync_ops(a):
    ids = a.ids or [parse(open(p, encoding='utf-8').read())[0]['id'] for p in glob.glob(os.path.join(CARDS, '*.md'))]
    ops = []
    for cid in ids:
        _, meta, _ = load(cid)
        ops.append({'op': 'set', 'path': 'tasks/' + cid, 'data': task_doc(meta)})
    print(json.dumps(ops))

def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('list').set_defaults(f=cmd_list)
    p = sub.add_parser('show'); p.add_argument('id'); p.set_defaults(f=cmd_show)
    p = sub.add_parser('new'); p.add_argument('id'); p.add_argument('title'); p.add_argument('--phase', required=True)
    p.add_argument('--order', type=int, required=True); p.add_argument('--deps', default=''); p.add_argument('--placeholder', action='store_true')
    p.add_argument('--estimate', default='')
    p.add_argument('--no-op', action='store_true'); p.set_defaults(f=cmd_new)
    p = sub.add_parser('move'); p.add_argument('id'); p.add_argument('station'); p.add_argument('--status'); p.add_argument('--agent')
    p.add_argument('--note'); p.add_argument('--run', default='factory'); p.add_argument('--from', dest='from_station'); p.set_defaults(f=cmd_move)
    p = sub.add_parser('sync-ops'); p.add_argument('ids', nargs='*'); p.set_defaults(f=cmd_sync_ops)
    p = sub.add_parser('status'); p.add_argument('--cards', default=CARDS, metavar='DIR')
    g = p.add_mutually_exclusive_group(); g.add_argument('--write', metavar='FILE'); g.add_argument('--check', metavar='FILE')
    p.set_defaults(f=cmd_status)
    a = ap.parse_args(); a.f(a)

if __name__ == '__main__':
    main()
