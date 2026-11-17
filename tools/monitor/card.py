#!/usr/bin/env python3
"""Factory cards: markdown work items with a small frontmatter, moved along the line.

  card.py list
  card.py show <id>
  card.py new <id> "<title>" --phase P1 --order 3 [--deps A,B] [--estimate N] [--placeholder] [--no-op]
  card.py move <id> <station> [--status running|done|blocked|failed|review] [--agent name] [--note "..."] [--run factory]
                                   # to ship, or to status done at any station, while a manual gate is open: exit 3,
                                   # the gates named, nothing moved; a newline or carriage return in --status, --agent
                                   # or --from, or a carriage return in --note: exit 2, nothing moved (a newline in
                                   # --note is written as a space)
  card.py gates <id>               # one line per manual gate (open, or ticked with who and when); exit 3 when one is open
  card.py gate <id> <gate> --by <who> [--evidence <path or url>]   # tick a gate; <gate> is its exact name or 1-based position
  card.py sync-ops [id ...]        # db_write ops (set) for tasks docs; only for docs that do not exist yet
  card.py status [--cards DIR]     # the progress board (markdown table, next up) on stdout; no event, nothing from the clock
  card.py status --write FILE      # regenerate the <!-- board:start --> ... <!-- board:end --> section of FILE (docs/plan/progress.md)
  card.py status --check FILE      # exit 1 when the board's card ids or its `done` ids differ from the cards (station, owner,
                                   # updated and next up are rendered, not checked: the board is regenerated at `new` and at ship)

Manual gates are one frontmatter line, `manualGates: [Open gate, [x] Ticked gate]` (a name holds no comma, `]`, `"` or
newline) that starts at column 0 and appears once; a frontmatter line whose key is another spelling of it (indented,
quoted, a space before the colon, `manualgates`, `manual_gates`, `manualGate`) or a second such line is an error, not a
card without gates. `gate` rewrites the entry as `[x] <name>` and appends the history line
`<ts> <station> <status> <who> "gate ticked: <name>[; evidence: <e>]"`; a gate ticked by hand reads as ticked with no record.
Exit codes: 0 ok, 1 an error (the message on stderr), 2 usage (among them a newline or carriage return in `--status`,
`--agent` or `--from` of `move`, in `<gate>` or `--evidence` of `gate`, in `<id>`, `<title>`, `--phase`, `--deps` or
`--estimate` of `new`, and a carriage return in `move --note`; `gate --by` with any whitespace exits 1; `move --run` and
`new --order` are not checked for one), 3 an open manual gate (`gates`, `move <id> ship`, `move <id> <station> --status
done`). A `move` that two of these refuse exits 1 or 3 before 2; whichever it is, nothing is written and no event is sent.

Three commands write a card: `new`, `move`, `gate`. Each refuses a newline or carriage return in the arguments named
above (`refuse_line_breaks`; `move --note` may hold a newline, written as a space) and reads its new text back with
`parse` before the write (`read_back`): `gate` writes only a text that reads with the station and status the card had
and that one gate more ticked, `new` only one that reads as a backlog card with the keys it set. A text that is not
UTF-8 (an argument written to the card that holds a byte that is not) exits 1 at the read-back: nothing written, no card created, no event.
The write itself (`write_whole`; also the progress file of `status --write`) puts the whole text in a temporary file
`<name>.<random>.tmp` beside the target and renames it over the target, keeping the target's mode; when a step of it
fails the temporary file is removed, the target is as it was, and the command exits 1.

Two roots. Cards are read and written in the checkout that holds this script: a lane calls its own worktree's copy by
absolute path. Events are written by that checkout's log.sh to `.bridle/progress` of the main checkout; the rule for
finding the main checkout is in the header of log.sh.
"""
import sys, os, re, json, subprocess, datetime, argparse, glob, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CARDS = os.path.join(ROOT, 'factory', 'cards')
LOG = os.path.join(ROOT, 'tools', 'monitor', 'log.sh')
STATIONS = ['backlog', 'spec', 'plan', 'build', 'test', 'review', 'ship']
WORKERS = {'backlog': '-', 'spec': 'orchestrator', 'plan': 'factory-planner', 'build': 'factory-builder',
           'test': 'factory-tester', 'review': 'factory-reviewer', 'ship': 'orchestrator'}
SECTIONS = ['Spec', 'Plan', 'Build', 'Test', 'Review', 'Ship']
GATES_FORMAT = 'card.py: manualGates must be a list on one line; write it on one line: manualGates: [a, b]'
GATES_KEY = re.compile(r'^\s*["\']?manual[ _-]?gates?["\']?\s*:', re.I)  # the key, or a spelling of it parse would not read
EXIT_OPEN_GATE = 3
EXIT_USAGE = 2  # argparse's own code for a usage error
CR = '\r'

def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def parse(text):
    m = re.match(r'^---\n(.*?)\n---\n?(.*)$', text, re.S)
    if not m:
        raise SystemExit('card has no frontmatter')
    meta, body = {}, m.group(2)
    key = None
    for n, line in enumerate(m.group(1).split('\n'), start=2):  # the frontmatter starts on line 2 of the file
        if line.startswith('  - ') and key == 'history':
            meta.setdefault('history', []).append(line[4:].strip())
            continue
        if GATES_KEY.match(line) and (not line.startswith('manualGates:') or 'manualGates' in meta):
            # read as "no gates" otherwise, and erased or shadowed at the next write
            raise SystemExit(f'card.py: line {n} is not a manual gates line card.py reads: {line.strip()!r}\n'
                             '  write the gates once, at the start of a line: manualGates: [a, b]')
        if line.startswith('  - ') and key == 'manualGates':
            raise SystemExit(GATES_FORMAT)  # a block list would be dropped at the next write
        mm = re.match(r'^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$', line)
        if not mm:
            continue
        key, val = mm.group(1), mm.group(2).strip()
        if key == 'manualGates' and not (val.startswith('[') and val.endswith(']')):
            raise SystemExit(GATES_FORMAT)
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

def gates_of(meta):
    """[(name, ticked)] from the card's `manualGates` list: an entry starting with `[x] ` (or `[X] `) is ticked, any other
    is open (a leading `[ ] ` is not part of the name)."""
    out = []
    for entry in meta.get('manualGates') or []:
        entry = entry.strip()
        if entry[:4] in ('[x] ', '[X] '):
            out.append((entry[4:].strip(), True))
        elif entry.startswith('[ ] '):
            out.append((entry[4:].strip(), False))
        else:
            out.append((entry, False))
    return out

def gate_record(meta, name):
    """(who, ts, evidence or None) of the latest history line that ticked the gate `name`, else None."""
    for line in reversed(meta.get('history') or []):
        m = re.match(r'^(\S+) \S+ \S+ (\S+) "gate ticked: (.*)"$', line)
        if not m:
            continue
        if m.group(3) == name:
            return m.group(2), m.group(1), None
        if m.group(3).startswith(name + '; evidence: '):
            return m.group(2), m.group(1), m.group(3)[len(name) + len('; evidence: '):]
    return None

def refuse_line_breaks(cmd, args, breaks='\n\r'):
    """Exit 2 when a value of `args` ({flag or name: value}) holds one of `breaks`. One argument is one line: a card is
    read with universal newlines, so a newline or a carriage return in a value would add a frontmatter line or end a
    history line at the next read."""
    for flag, value in args.items():
        if value and any(c in value for c in breaks):
            print(f'card.py {cmd}: {flag} holds a {"carriage return" if breaks == CR else "newline or a carriage return"}: '
                  f'nothing {"moved" if cmd == "move" else "written"}; give it on one line', file=sys.stderr)
            sys.exit(EXIT_USAGE)

def read_back(cmd, text, expect=None):
    """The frontmatter `parse` reads from a new card text, for the check a writing command makes before its write: a text
    parse refuses exits 1 here, and so does one that does not read as `expect` ({key: value}; the key `gates` is compared
    with gates_of, the key `keys` with the set of frontmatter keys). Before that, a
    text the card file cannot hold exits 1: an argument that is not UTF-8 arrives as a lone surrogate, which the UTF-8
    file refuses."""
    try:
        text.encode('utf-8')
    except UnicodeEncodeError:
        raise SystemExit(f'card.py {cmd}: an argument is not valid UTF-8; nothing written')
    back = parse(text)[0]
    read = {'gates': gates_of(back), 'keys': set(back)}
    wrong = [k for k, want in (expect or {}).items() if (read[k] if k in read else back.get(k)) != want]
    if wrong:
        raise SystemExit(f'card.py {cmd}: the new card text would not read back as intended ({", ".join(wrong)}); nothing written')
    return back

def write_whole(path, text):
    """Write `text` (UTF-8, newlines as they are) as the whole content of `path`, or exit 1 with `path` as it was: the
    bytes go to a temporary file in the same directory, which is renamed over the target (os.replace). The target keeps
    its mode; a new file gets the mode open() would give it. A symbolic link is followed, as open() follows it. On any
    failure the temporary file is removed."""
    try:
        data = text.encode('utf-8')
    except UnicodeEncodeError:
        raise SystemExit(f'card.py: the text for {path} is not valid UTF-8; nothing written')
    target = os.path.realpath(path)
    tmp = None
    try:
        try:
            mode = os.stat(target).st_mode & 0o7777
        except FileNotFoundError:
            umask = os.umask(0)
            os.umask(umask)
            mode = 0o666 & ~umask
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(target), prefix=os.path.basename(target) + '.', suffix='.tmp')
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, mode)
        os.replace(tmp, target)
    except BaseException as e:
        if tmp is not None:
            try:
                os.unlink(tmp)
            except OSError:
                pass
        if isinstance(e, OSError):
            raise SystemExit(f'card.py: could not write {path} ({e.strerror or e}); nothing written')
        raise

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
        gates = gates_of(m)
        suffix = f'  [gates: {sum(1 for _, ticked in gates if not ticked)} open of {len(gates)}]' if gates else ''
        print(f"{m.get('id',''):10} {m.get('phase',''):6} {m.get('station','backlog'):8} {m.get('status','planned'):9} {str(m.get('order','')):5} {deps} / {m.get('title','')}{suffix}")
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
    write_whole(path, new)
    nxt = next_up(rows)
    shown = os.path.relpath(path, ROOT)
    if shown.startswith('..'):
        shown = path
    print(f'{shown}: board written ({len(rows)} cards; next up {nxt["id"] if nxt else "nothing unblocked"})', file=sys.stderr)

def cmd_show(a):
    path, meta, body = load(a.id)
    print(path); print(json.dumps(meta, indent=2))

def cmd_new(a):
    # --order is an int by argparse (written as digits); every other value written to the card is one line.
    refuse_line_breaks('new', {'<id>': a.id, '<title>': a.title, '--phase': a.phase, '--deps': a.deps, '--estimate': a.estimate})
    os.makedirs(CARDS, exist_ok=True)
    path = os.path.join(CARDS, f'{a.id}-{slug(a.title)}.md')
    if os.path.exists(path) or glob.glob(os.path.join(CARDS, a.id + '-*.md')):
        raise SystemExit(f'card {a.id} already exists')
    meta = {'id': a.id, 'title': a.title, 'phase': a.phase, 'order': a.order, 'dependsOn': [d for d in (a.deps or '').split(',') if d],
            'station': 'backlog', 'status': 'planned', 'owner': '-', 'updated': now_iso(), 'history': []}
    if a.placeholder: meta['placeholder'] = True
    if a.estimate: meta['estimate'] = a.estimate
    body = f'\n# {a.id} {a.title}\n\n' + '\n'.join(f'## {s}\n\n' for s in SECTIONS)
    text = dump(meta, body)
    read_back('new', text, {'keys': set(meta), 'station': 'backlog', 'status': 'planned', 'gates': []})
    write_whole(path, text)
    print(os.path.relpath(path, ROOT), file=sys.stderr)
    if not a.no_op:
        print(json.dumps({'op': 'set', 'path': 'tasks/' + a.id, 'data': task_doc(meta)}))

def cmd_move(a):
    path, meta, body = load(a.id)
    st = a.station.lower()
    if st not in STATIONS:
        raise SystemExit('station must be one of ' + ', '.join(STATIONS))
    open_gates = [name for name, ticked in gates_of(meta) if not ticked]
    status = a.status or ('done' if st == 'ship' else 'planned' if st == 'backlog' else 'running')
    agent = a.agent or WORKERS[st]
    ts = now_iso()
    meta['station'], meta['status'], meta['owner'], meta['updated'] = st, status, agent, ts
    note = a.note or f'Moved to {st}'
    meta.setdefault('history', []).append(f'{ts} {st} {status} {agent} "{note}"'.replace('\n', ' '))
    text = dump(meta, body)
    # Three checks before the write, in this order; a move one of them refuses writes nothing and sends no event.
    # 1. The new text is read back with parse, with or without gates on the card: a text parse refuses exits 1 here.
    reads_done = read_back('move', text).get('status') == 'done'
    # 2. An open manual gate refuses a move to ship, whatever the status asked for, and a move to any station whose new
    #    text reads back as done (the status that unblocks the card's dependants).
    if open_gates and (st == 'ship' or reads_done):
        print(f'card.py move: {a.id} has {len(open_gates)} open manual gate(s): {"; ".join(open_gates)}\n'
              f'  tick each with: python3 tools/monitor/card.py gate {a.id} "<gate>" --by <who> [--evidence <path or url>]',
              file=sys.stderr)
        sys.exit(EXIT_OPEN_GATE)
    # 3. One argument is one line: --status and --agent are frontmatter values and part of the history line, --from goes
    #    into the event. A newline in --note became a space above; its carriage return would end the history line at the
    #    next read (the card is read with universal newlines).
    refuse_line_breaks('move', {'--status': a.status, '--agent': a.agent, '--from': a.from_station})
    refuse_line_breaks('move', {'--note': a.note}, breaks=CR)
    write_whole(path, text)
    progress = round(STATIONS.index(st) / (len(STATIONS) - 1) * 100)
    cmd = [LOG, '-r', a.run, '-p', str(meta.get('phase', '')), '-a', agent, '-t', meta['id'], '-T', 'card.move', '-s', st,
           '-S', status, '-P', str(progress), '-m', note, '-L', agent,
           '-d', json.dumps({'station': st, 'card': os.path.relpath(path, ROOT), 'from': a.from_station or ''})]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit('log.sh failed: ' + out.stderr)
    print(out.stdout.strip())

def cmd_gates(a):
    # Reads the card, writes nothing, reports nothing: the check a ship script calls (exit 3 while a gate is open).
    _, meta, _ = load(a.id)
    gates = gates_of(meta)
    if not gates:
        print('no manual gates')
        return
    for name, ticked in gates:
        if not ticked:
            print(f'open    {name}')
            continue
        rec = gate_record(meta, name)
        if rec is None:
            print(f'ticked  {name}  (no record)')
        else:
            who, ts, evidence = rec
            print(f'ticked  {name}  ({who} {ts}' + (f', evidence {evidence}' if evidence else '') + ')')
    if any(not ticked for _, ticked in gates):
        sys.exit(EXIT_OPEN_GATE)

def cmd_gate(a):
    if not a.by or re.search(r'\s', a.by):
        raise SystemExit('card.py gate: --by must be one word without whitespace (who ticked the gate)')
    refuse_line_breaks('gate', {'<gate>': a.gate, '--evidence': a.evidence})  # --by: no whitespace at all, above
    path, meta, body = load(a.id)
    before = {'station': meta.get('station'), 'status': meta.get('status')}
    gates = gates_of(meta)
    if not gates:
        raise SystemExit(f'card.py gate: {a.id} has no manual gates')
    names = [name for name, _ in gates]
    if a.gate in names:
        i = names.index(a.gate)
    elif re.fullmatch(r'[1-9]\d*', a.gate) and int(a.gate) <= len(gates):
        i = int(a.gate) - 1
    else:
        raise SystemExit(f'card.py gate: {a.id} has no gate "{a.gate}"; its gates: '
                         + '; '.join(f'{k + 1}. {name}' for k, name in enumerate(names)))
    name, ticked = gates[i]
    if ticked:
        print(f'already ticked: {name}')
        return
    ts = now_iso()
    meta['manualGates'][i] = '[x] ' + name
    note = f'gate ticked: {name}' + (f'; evidence: {a.evidence}' if a.evidence else '')
    meta.setdefault('history', []).append(
        f'{ts} {meta.get("station", "backlog")} {meta.get("status", "planned")} {a.by} "{note}"'.replace('\n', ' '))
    meta['updated'] = ts
    text = dump(meta, body)
    # Before the write: the card must read with the station and status it had and with this one gate more ticked.
    read_back('gate', text, dict(before, gates=gates[:i] + [(name, True)] + gates[i + 1:]))
    write_whole(path, text)
    print(f'ticked: {name}')

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
    p = sub.add_parser('gates'); p.add_argument('id'); p.set_defaults(f=cmd_gates)
    p = sub.add_parser('gate'); p.add_argument('id'); p.add_argument('gate'); p.add_argument('--by', required=True)
    p.add_argument('--evidence', default=''); p.set_defaults(f=cmd_gate)
    p = sub.add_parser('sync-ops'); p.add_argument('ids', nargs='*'); p.set_defaults(f=cmd_sync_ops)
    p = sub.add_parser('status'); p.add_argument('--cards', default=CARDS, metavar='DIR')
    g = p.add_mutually_exclusive_group(); g.add_argument('--write', metavar='FILE'); g.add_argument('--check', metavar='FILE')
    p.set_defaults(f=cmd_status)
    a = ap.parse_args(); a.f(a)

if __name__ == '__main__':
    main()
