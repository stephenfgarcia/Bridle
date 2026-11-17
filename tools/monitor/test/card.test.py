#!/usr/bin/env python3
"""Tests for tools/monitor/card.py and the two roots of log.sh and trace-hook.sh. Run: python3 tools/monitor/test/card.test.py

StatusTests (factory card P0-11): `card.py status` run as a subprocess, exactly as documented, with --cards pointing at
a temporary directory of three cards written in dump()'s frontmatter shape.
GateTests (P0-08.1, criteria 1 and 3): manual gates (`gates`, `gate`, the ship refusal, the `list` suffix, the refused
list shapes) and `new --estimate`, with copies of the working-tree scripts under a temporary root outside git.
WorktreeTests (P0-08.1, criterion 2): a temporary git repository with one linked worktree; cards are read and written
in the checkout holding the script, events and traces land in the main checkout's .bridle/progress.
Rework after the review (P0-08.1): GateTests `test_gate_line_variants_refused`, `test_gate_word_outside_the_key_accepted`
and `test_status_done_refused_with_open_gate`; WorktreeTests `test_relative_main_root_refused`; LaneTests
`test_log_through_a_case_variant_path` (skipped on a case-sensitive volume).
Second test pass (P0-08.1): GateEdgeTests `test_gate_line_more_shapes`, `test_done_refused_through_other_arguments_and_after_an_event`
and `test_move_rewrites_exactly`; LaneTests `test_case_variant_worktree_by_relative_path_and_symlink` (skipped on a
case-sensitive volume) and `test_main_root_values_that_look_like_paths`.
Rework loop 2 (P0-08.1): MoveLineTests `test_unreadable_text_is_never_written` and `test_line_break_in_an_argument_is_refused`;
`wt-rel` added to WorktreeTests.RUNS. Addendum (gate and new): WriterGuardTests `test_gate_line_breaks_refused`,
`test_new_line_breaks_refused` and `test_read_back_before_each_write` (the last runs card.py's commands in this process
with a `dump` that writes a wrong text).
Rework loop 3 (P0-08.1): WriterGuardTests `test_argument_that_is_not_utf8_writes_nothing`,
`test_failed_write_leaves_the_card_and_no_temporary_file` (card.py's commands in this process with one step of the
write made to fail, then a cards directory that takes no new file) and `test_write_keeps_the_mode_and_follows_a_link`.
LaneKeyTests (P0-08.2, criterion 4, added at the build station): `move --lane` writes `lane:` after `owner:` and a later
move keeps it; a second card is refused in a lane whose card is at plan, build, test or review, with its file and the
events as they were; `--lane` values that are refused; `card.py lane <name>`. `test_move_rewrites_exactly` names its
unknown key `track` since then (it was `lane`, which is now a key card.py orders). Added at the test station:
`test_gates_and_bytes_hold_with_a_lane`.

The cards and the .bridle directories the cases use are under temporary directories, removed afterwards; the cases
read the scripts of this checkout and, for WorktreeTests, its git directory (to assert no worktree was added to it).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.dont_write_bytecode = True  # no __pycache__ in the tree
CARD = os.path.join(TOOLS, 'card.py')

CARDS = {  # id: (order, station, status, deps)
    'A': (1, 'ship', 'done', []),
    'B': (2, 'build', 'running', ['A']),
    'C': (3, 'backlog', 'planned', ['A']),
}
BOARD = [
    '<!-- board:start -->',
    '| id | phase | station | status | owner | updated |',
    '|---|---|---|---|---|---|',
    '| A | P9 | ship | done | orchestrator | 2026-01-01T00:00:01Z |',
    '| B | P9 | build | running | factory-builder | 2026-01-01T00:00:02Z |',
    '| C | P9 | backlog | planned | - | 2026-01-01T00:00:03Z |',
    '',
    'Next up: C Card C',
    '<!-- board:end -->',
]
OWNER = {'ship': 'orchestrator', 'build': 'factory-builder', 'backlog': '-'}
ABOVE = '# Progress\n\nText above the board.\n\n## Board\n\n'
BELOW = '\n\n## Log\n\n- an entry below the board\n'


def card_text(cid, order, station, status, deps):
    return ('---\n' f'id: {cid}\ntitle: Card {cid}\nphase: P9\norder: {order}\ndependsOn: [{", ".join(deps)}]\n'
            f'station: {station}\nstatus: {status}\nowner: {OWNER[station]}\nupdated: 2026-01-01T00:00:0{order}Z\nhistory:\n---\n\n'
            f'# {cid} Card {cid}\n\n## Spec\n\n## Ship\n')


def status(cards, *args):
    return subprocess.run([sys.executable, CARD, 'status', '--cards', cards] + list(args), capture_output=True, text=True)


class StatusTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bridle-card-')
        self.cards = os.path.join(self.tmp, 'cards')
        os.makedirs(self.cards)
        for cid, (order, station, st, deps) in CARDS.items():
            with open(os.path.join(self.cards, f'{cid}-card-{cid.lower()}.md'), 'w', encoding='utf-8') as f:
                f.write(card_text(cid, order, station, st, deps))
        self.written = {f'cards/{cid}-card-{cid.lower()}.md' for cid in CARDS}

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def progress(self, name='progress.md', section=('<!-- board:start -->', '<!-- board:end -->')):
        path = os.path.join(self.tmp, name)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(ABOVE + '\n'.join(section) + BELOW)
        self.written.add(name)
        return path

    def read(self, path):
        with open(path, encoding='utf-8') as f:
            return f.read()

    def test_stdout_board(self):
        """No flag: the board on stdout, exactly these lines, sorted by order, next up C; nothing on stderr."""
        r = status(self.cards)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout, '\n'.join(BOARD) + '\n')
        self.assertEqual(r.stderr, '')
        self.assertEqual(status(self.cards).stdout, r.stdout)  # two runs, the same bytes

    def test_write_replaces_section(self):
        """--write replaces the markers and everything between them; the text around them survives; idempotent."""
        path = self.progress(section=('<!-- board:start -->', '| old | row |', 'stale text', '<!-- board:end -->'))
        r = status(self.cards, '--write', path)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout, '')
        self.assertIn(path, r.stderr)
        self.assertIn('board written (3 cards; next up C)', r.stderr)
        text = self.read(path)
        self.assertEqual(text, ABOVE + '\n'.join(BOARD) + BELOW)
        self.assertTrue(text.endswith('below the board\n') and not text.endswith('\n\n'))
        self.assertNotIn('stale text', text)
        r2 = status(self.cards, '--write', path)
        self.assertEqual(r2.returncode, 0, r2.stderr)
        self.assertEqual(self.read(path), text)  # a second --write leaves the bytes identical

    def test_write_needs_a_section(self):
        """--write on a file without the two markers, or on a missing file, exits 1 and writes nothing."""
        path = self.progress('nosection.md', section=('no markers here',))
        before = self.read(path)
        r = status(self.cards, '--write', path)
        self.assertEqual(r.returncode, 1)
        self.assertIn('has no board section', r.stderr)
        self.assertEqual(self.read(path), before)
        missing = os.path.join(self.tmp, 'missing.md')
        r = status(self.cards, '--write', missing)
        self.assertEqual(r.returncode, 1)
        self.assertIn(missing, r.stderr)
        self.assertFalse(os.path.exists(missing))

    def test_check_sets(self):
        """--check compares the id set and the done set only: a station-only change passes; a flipped done cell,
        a removed row, a new card, no markers and a missing file exit 1 naming the file."""
        path = self.progress()
        status(self.cards, '--write', path)
        r = status(self.cards, '--check', path)
        self.assertEqual((r.returncode, r.stdout, r.stderr), (0, '', ''))
        text = self.read(path)

        moved = text.replace('| B | P9 | build | running | factory-builder |', '| B | P9 | test | running | factory-tester |')
        self.assertNotEqual(moved, text)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(moved)
        r = status(self.cards, '--check', path)
        self.assertEqual((r.returncode, r.stderr), (0, ''), 'a card moving between stations must not make the board stale')

        flipped = text.replace('| A | P9 | ship | done |', '| A | P9 | ship | planned |')
        self.assertNotEqual(flipped, text)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(flipped)
        r = status(self.cards, '--check', path)
        self.assertEqual(r.returncode, 1)
        self.assertIn(f'{path} is stale: run python3 tools/monitor/card.py status --write {path}', r.stderr)
        self.assertIn('done in the cards, not on the board: A', r.stderr)
        self.assertEqual(self.read(path), flipped)  # --check writes nothing

        removed = text.replace('| C | P9 | backlog | planned | - | 2026-01-01T00:00:03Z |\n', '')
        self.assertNotEqual(removed, text)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(removed)
        r = status(self.cards, '--check', path)
        self.assertEqual(r.returncode, 1)
        self.assertIn('cards not on the board: C', r.stderr)

        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        with open(os.path.join(self.cards, 'D-card-d.md'), 'w', encoding='utf-8') as f:  # card.py new, no --write yet
            f.write(card_text('D', 4, 'backlog', 'planned', ['A']))
        self.written.add('cards/D-card-d.md')
        r = status(self.cards, '--check', path)
        self.assertEqual(r.returncode, 1)
        self.assertIn('cards not on the board: D', r.stderr)

        nosec = self.progress('nosection.md', section=('no markers here',))
        r = status(self.cards, '--check', nosec)
        self.assertEqual(r.returncode, 1)
        self.assertIn(f'{nosec} is stale', r.stderr)
        missing = os.path.join(self.tmp, 'missing.md')
        r = status(self.cards, '--check', missing)
        self.assertEqual(r.returncode, 1)
        self.assertIn(f'{missing} is stale', r.stderr)
        self.assertFalse(os.path.exists(missing))

    def test_write_and_check_exclude_each_other(self):
        r = status(self.cards, '--write', 'a', '--check', 'b')
        self.assertEqual(r.returncode, 2)
        self.assertIn('not allowed with argument', r.stderr)

    def test_no_side_effects(self):
        """After a run of every mode the temp dir holds only what the test wrote; no __pycache__ under tools/monitor."""
        path = self.progress()
        status(self.cards)
        status(self.cards, '--write', path)
        status(self.cards, '--check', path)
        found = set()
        for root, _dirs, files in os.walk(self.tmp):
            for name in files:
                found.add(os.path.relpath(os.path.join(root, name), self.tmp))
        self.assertEqual(found, self.written)
        for root, dirs, _files in os.walk(TOOLS):
            self.assertNotIn('__pycache__', dirs, root)


    def test_check_detail_lines(self):
        """The stale message's second line names every difference: a board row marked done for a card that is not,
        a board row without a card, and both at once with a missing card, in the fixed order."""
        path = self.progress()
        status(self.cards, '--write', path)
        text = self.read(path)
        marked = text.replace('| B | P9 | build | running |', '| B | P9 | build | done |')
        self.assertNotEqual(marked, text)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(marked)
        r = status(self.cards, '--check', path)
        self.assertEqual((r.returncode, r.stdout), (1, ''))
        self.assertIn(f'{path} is stale', r.stderr)
        self.assertIn('done on the board, not in the cards: B', r.stderr)
        foreign = text.replace('|---|---|---|---|---|---|\n', '|---|---|---|---|---|---|\n| Z | P9 | backlog | planned | - | |\n')
        self.assertNotEqual(foreign, text)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(foreign)
        r = status(self.cards, '--check', path)
        self.assertEqual(r.returncode, 1)
        self.assertIn('board rows without a card: Z', r.stderr)
        both = marked.replace('| C | P9 | backlog | planned | - | 2026-01-01T00:00:03Z |\n', '')
        self.assertNotEqual(both, marked)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(both)
        r = status(self.cards, '--check', path)
        self.assertEqual(r.returncode, 1)
        self.assertIn('\n  cards not on the board: C; done on the board, not in the cards: B', r.stderr)
        self.assertEqual(self.read(path), both)  # --check writes nothing

    def test_check_ignores_rendered_fields(self):
        """owner, updated and the next-up line are rendered by --write and not checked (like station)."""
        path = self.progress()
        status(self.cards, '--write', path)
        text = self.read(path)
        edited = (text.replace('| A | P9 | ship | done | orchestrator | 2026-01-01T00:00:01Z |',
                               '| A | P9 | ship | done | someone-else | 2030-12-31T23:59:59Z |')
                      .replace('Next up: C Card C', 'Next up: nothing unblocked'))
        self.assertNotEqual(edited, text)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(edited)
        r = status(self.cards, '--check', path)
        self.assertEqual((r.returncode, r.stdout, r.stderr), (0, '', ''))
        self.assertEqual(self.read(path), edited)

    def test_sort_and_defaults(self):
        """Rows sort by (phase, numeric order, id): order 10 after 9, phase P1 before P9; a card without station, status,
        owner or updated renders backlog, planned, '-' and an empty cell, and is next up when its dependencies are done."""
        with open(os.path.join(self.cards, 'D-card-d.md'), 'w', encoding='utf-8') as f:
            f.write(card_text('D', 10, 'backlog', 'planned', ['A']))
        with open(os.path.join(self.cards, 'E-card-e.md'), 'w', encoding='utf-8') as f:
            f.write(card_text('E', 9, 'backlog', 'planned', ['B']))  # B is running: E is blocked
        with open(os.path.join(self.cards, 'F-card-f.md'), 'w', encoding='utf-8') as f:
            f.write('---\nid: F\ntitle: Card F\nphase: P1\norder: 1\ndependsOn: []\nhistory:\n---\n\n# F Card F\n')
        r = status(self.cards)
        self.assertEqual(r.returncode, 0, r.stderr)
        ids = [line.split('|')[1].strip() for line in r.stdout.split('\n') if line.startswith('| ') and not line.startswith('| id ')]
        self.assertEqual(ids, ['F', 'A', 'B', 'C', 'E', 'D'])
        self.assertIn('| F | P1 | backlog | planned | - |  |\n', r.stdout)
        self.assertTrue(r.stdout.endswith('\nNext up: F Card F\n<!-- board:end -->\n'), r.stdout)

    def test_isolated_root_writes_nothing_else(self):
        """card.py copied under a temporary root (ROOT derives from its own path): every mode leaves no .bridle, no
        bytecode and no file but the ones the test wrote; --write prints the ROOT-relative path for a file inside the
        root and the path as given for one outside it."""
        root = os.path.join(self.tmp, 'root')
        os.makedirs(os.path.join(root, 'tools', 'monitor'))
        os.makedirs(os.path.join(root, 'docs', 'plan'))
        card = os.path.join(root, 'tools', 'monitor', 'card.py')
        shutil.copy(CARD, card)
        self.written.add('root/tools/monitor/card.py')
        inside = self.progress(os.path.join('root', 'docs', 'plan', 'progress.md'))
        outside = self.progress()

        def run(*args):
            return subprocess.run([sys.executable, card, 'status', '--cards', self.cards] + list(args), capture_output=True, text=True)
        r = run()
        self.assertEqual((r.returncode, r.stderr), (0, ''))
        r = run('--write', inside)
        self.assertEqual((r.returncode, r.stdout), (0, ''), r.stderr)
        self.assertTrue(r.stderr.startswith('docs/plan/progress.md: board written (3 cards; next up C)'), r.stderr)
        r = run('--write', outside)
        self.assertEqual((r.returncode, r.stdout), (0, ''), r.stderr)
        self.assertTrue(r.stderr.startswith(outside + ': board written'), r.stderr)
        for p in (inside, outside):
            r = run('--check', p)
            self.assertEqual((r.returncode, r.stdout, r.stderr), (0, '', ''))
        self.assertFalse(os.path.exists(os.path.join(root, '.bridle')))
        found = set()
        for walk_root, dirs, files in os.walk(self.tmp):
            self.assertNotIn('__pycache__', dirs, walk_root)
            for name in files:
                found.add(os.path.relpath(os.path.join(walk_root, name), self.tmp))
        self.assertEqual(found, self.written)

    def test_status_source_has_no_side_channels(self):
        """The status code path (board_rows, next_up, render_board, board_section, board_ids, cmd_status) names no
        subprocess, log.sh, clock, environment or .bridle path: the board is derived from the cards alone and reports
        nothing (the monitor owner's constraint in the card's Plan)."""
        with open(CARD, encoding='utf-8') as f:
            src = f.read()
        code = re.sub(r'"""[\s\S]*?"""', '', re.sub(r'#.*', '', src))
        chunks = {c.split('(')[0]: c for c in code.split('\ndef ')[1:]}
        for name in ('board_rows', 'next_up', 'render_board', 'board_section', 'board_ids', 'cmd_status'):
            self.assertIn(name, chunks)
            for bad in ('subprocess', 'LOG', 'log.sh', 'now_iso', 'datetime', '.bridle', 'environ'):
                self.assertNotIn(bad, chunks[name], f'{name}() uses {bad}')


MONITOR_FILES = ('card.py', 'log.sh', 'trace-hook.sh', 'trace_hook.py', 'monlib.py')
REPO = os.path.dirname(os.path.dirname(TOOLS))  # the checkout holding this test file
G_LINE = 'manualGates: [Alpha report signed, [x] Beta license executed]'
G_TICKED = 'manualGates: [[x] Alpha report signed, [x] Beta license executed]'
KEYS = ['id', 'title', 'phase', 'order', 'dependsOn', 'station', 'status', 'owner', 'updated', 'history']


def gate_card(cid, gates=None):
    """Card G of the Plan's fixtures (`gates` is the frontmatter text after `history:`), or card N without it."""
    return ('---\n' f'id: {cid}\ntitle: Card {cid}\nphase: P9\norder: 1\ndependsOn: []\nstation: review\nstatus: running\n'
            'owner: factory-reviewer\nupdated: 2026-01-01T00:00:01Z\nhistory:\n' + (gates + '\n' if gates else '') + '---\n\n'
            f'# {cid} Card {cid}\n\n## Spec\n\n## Ship\n')


def card_file(root, cid):
    return os.path.join(root, 'factory', 'cards', f'{cid}-card-{cid.lower()}.md')


def make_root(root, cards):
    """A checkout layout under `root`: copies of the working-tree monitor scripts and the given cards {id: text}."""
    os.makedirs(os.path.join(root, 'tools', 'monitor'))
    os.makedirs(os.path.join(root, 'factory', 'cards'))
    for name in MONITOR_FILES:
        shutil.copy(os.path.join(TOOLS, name), os.path.join(root, 'tools', 'monitor', name))  # copy() keeps the mode bits
    for cid, text in cards.items():
        with open(card_file(root, cid), 'w', encoding='utf-8') as f:
            f.write(text)


def clean_env(**extra):
    """The environment of every subprocess: no BRIDLE_MAIN_ROOT and no GIT_* variable unless the case sets one."""
    env = {k: v for k, v in os.environ.items() if k != 'BRIDLE_MAIN_ROOT' and not k.startswith('GIT_')}
    env.update(extra)
    return env


def run_card(root, *args, cwd=None, **env):
    return subprocess.run([sys.executable, os.path.join(root, 'tools', 'monitor', 'card.py')] + list(args),
                          capture_output=True, text=True, cwd=cwd or root, env=clean_env(**env))


def run_log(root, *args, cwd=None, **env):
    return subprocess.run([os.path.join(root, 'tools', 'monitor', 'log.sh')] + list(args),
                          capture_output=True, text=True, cwd=cwd or root, env=clean_env(**env))


def read_bytes(path):
    with open(path, 'rb') as f:
        return f.read()


def jsonl(path):
    with open(path, encoding='utf-8') as f:
        return [json.loads(line) for line in f if line.strip()]


class GateTests(unittest.TestCase):
    """Manual gates and `new --estimate` (card P0-08.1, criteria 1 and 3), in a temporary root outside git."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bridle-gate-')
        self.root = os.path.join(self.tmp, 'R')
        make_root(self.root, {'G': gate_card('G', G_LINE), 'N': gate_card('N')})
        self.g, self.n = card_file(self.root, 'G'), card_file(self.root, 'N')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def card(self, *args):
        return run_card(self.root, *args)

    def text(self, path):
        return read_bytes(path).decode('utf-8')

    def test_ship_refused_with_open_gate(self):
        before = read_bytes(self.g)
        for args in (('move', 'G', 'ship'), ('move', 'G', 'ship', '--status', 'blocked')):
            r = self.card(*args)
            self.assertEqual((r.returncode, r.stdout), (3, ''), r.stderr)
            self.assertIn('card.py move: G has 1 open manual gate(s): Alpha report signed\n', r.stderr)
            self.assertIn('card.py gate G', r.stderr)
            self.assertNotIn('Beta license executed', r.stderr)
            self.assertEqual(read_bytes(self.g), before)
            self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))

    def test_gate_tick_then_ship(self):
        tick = ('gate', 'G', 'Alpha report signed', '--by', 'owner', '--evidence', 'docs/x.pdf')
        r = self.card(*tick)
        self.assertEqual((r.returncode, r.stdout), (0, 'ticked: Alpha report signed\n'), r.stderr)
        lines = self.text(self.g).split('\n')
        self.assertIn(G_TICKED, lines)
        self.assertNotIn(G_LINE, lines)
        hist = [l for l in lines if l.startswith('  - ')]
        self.assertEqual(len(hist), 1, hist)
        self.assertRegex(hist[0], r'^  - \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ review running owner '
                                  r'"gate ticked: Alpha report signed; evidence: docs/x\.pdf"$')
        self.assertNotIn('updated: 2026-01-01T00:00:01Z', lines)
        self.assertIn('station: review', lines)
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))  # a tick is no monitor event
        r = self.card('gates', 'G')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        out = r.stdout.split('\n')
        self.assertRegex(out[0], r'^ticked  Alpha report signed  \(owner \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ, evidence docs/x\.pdf\)$')
        self.assertEqual(out[1:], ['ticked  Beta license executed  (no record)', ''])
        r = self.card('move', 'G', 'ship')
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = self.text(self.g).split('\n')
        self.assertIn('station: ship', lines)
        self.assertIn('status: done', lines)
        self.assertIn(G_TICKED, lines)
        events = jsonl(os.path.join(self.root, '.bridle', 'progress', 'factory', 'orchestrator.jsonl'))
        self.assertEqual([(e['type'], e['taskId'], e['step']) for e in events], [('card.move', 'G', 'ship')])
        shipped = read_bytes(self.g)
        r = self.card(*tick)
        self.assertEqual((r.returncode, r.stdout), (0, 'already ticked: Alpha report signed\n'), r.stderr)
        r = self.card('gate', 'G', '2', '--by', 'owner')
        self.assertEqual((r.returncode, r.stdout), (0, 'already ticked: Beta license executed\n'), r.stderr)
        self.assertEqual(read_bytes(self.g), shipped)

    def test_gate_by_position_and_without_evidence(self):
        r = self.card('gate', 'G', '1', '--by', 'owner')
        self.assertEqual((r.returncode, r.stdout), (0, 'ticked: Alpha report signed\n'), r.stderr)
        hist = [l for l in self.text(self.g).split('\n') if l.startswith('  - ')]
        self.assertRegex(hist[0], r'^  - \S+ review running owner "gate ticked: Alpha report signed"$')
        r = self.card('gates', 'G')
        self.assertEqual(r.returncode, 0)
        self.assertRegex(r.stdout.split('\n')[0], r'^ticked  Alpha report signed  \(owner \S+Z\)$')

    def test_gates_and_list(self):
        r = self.card('gates', 'G')
        self.assertEqual((r.returncode, r.stdout, r.stderr),
                         (3, 'open    Alpha report signed\nticked  Beta license executed  (no record)\n', ''))
        r = self.card('gates', 'N')
        self.assertEqual((r.returncode, r.stdout, r.stderr), (0, 'no manual gates\n', ''))
        before = {p: read_bytes(p) for p in (self.g, self.n)}
        r = self.card('list')
        self.assertEqual(r.returncode, 0, r.stderr)
        rows = r.stdout.split('\n')
        self.assertTrue(rows[1].endswith('- / Card G  [gates: 1 open of 2]'), rows[1])
        self.assertTrue(rows[2].endswith('- / Card N'), rows[2])
        self.assertEqual(self.card('gate', 'G', 'Alpha report signed', '--by', 'owner').returncode, 0)
        rows = self.card('list').stdout.split('\n')
        self.assertTrue(rows[1].endswith('- / Card G  [gates: 0 open of 2]'), rows[1])
        self.assertTrue(rows[2].endswith('- / Card N'), rows[2])
        self.assertEqual(read_bytes(self.n), before[self.n])
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))  # gates, gate and list report nothing

    def test_gate_errors(self):
        before = {p: read_bytes(p) for p in (self.g, self.n)}
        for args, needle in ((('gate', 'G', 'Gamma', '--by', 'owner'), '1. Alpha report signed; 2. Beta license executed'),
                             (('gate', 'G', '3', '--by', 'owner'), '1. Alpha report signed; 2. Beta license executed'),
                             (('gate', 'G', '0', '--by', 'owner'), 'has no gate "0"'),
                             (('gate', 'N', 'Alpha report signed', '--by', 'owner'), 'N has no manual gates'),
                             (('gate', 'G', 'Alpha report signed', '--by', 'two words'), '--by'),
                             (('gate', 'G', 'Alpha report signed', '--by', ''), '--by')):
            r = self.card(*args)
            self.assertEqual((r.returncode, r.stdout), (1, ''), args)
            self.assertIn(needle, r.stderr, args)
            self.assertEqual({p: read_bytes(p) for p in before}, before, args)
        self.assertEqual(self.card('gate', 'G', 'Alpha report signed').returncode, 2)  # --by is required: usage
        self.assertEqual(read_bytes(self.g), before[self.g])
        # A gate list card.py cannot keep is refused, not dropped at the next write.
        for name, gates in (('block', 'manualGates:\n  - Alpha report signed\n  - Beta license executed'),
                            ('scalar', 'manualGates: later'), ('empty', 'manualGates:')):
            root = os.path.join(self.tmp, name)
            make_root(root, {'G': gate_card('G', gates)})
            path = card_file(root, 'G')
            bad = read_bytes(path)
            for args in (('gates', 'G'), ('move', 'G', 'build'), ('move', 'G', 'ship'), ('status'), ('list',),
                         ('gate', 'G', '1', '--by', 'owner')):
                args = (args,) if isinstance(args, str) else args
                r = run_card(root, *args)
                self.assertEqual((r.returncode, r.stdout), (1, ''), (name, args, r.stderr))
                self.assertIn('manualGates', r.stderr, (name, args))
                self.assertIn('manualGates: [a, b]', r.stderr, (name, args))
                self.assertEqual(read_bytes(path), bad, (name, args))
            self.assertFalse(os.path.exists(os.path.join(root, '.bridle')), name)
        # The empty list on one line is a card without gates.
        root = os.path.join(self.tmp, 'none')
        make_root(root, {'G': gate_card('G', 'manualGates: []')})
        r = run_card(root, 'gates', 'G')
        self.assertEqual((r.returncode, r.stdout), (0, 'no manual gates\n'), r.stderr)

    def test_gate_line_variants_refused(self):
        """Review finding 1: a frontmatter line whose key is a spelling of manualGates that parse does not read, or a
        second manualGates line, is an error naming the line, never a card without gates; nothing is written."""
        variants = (('spaces', '  manualGates: [Indented]', 12), ('tab', '\tmanualGates: [Tabbed]', 12),
                    ('colon', 'manualGates : [Space before colon]', 12), ('quoted', '"manualGates": [Quoted]', 12),
                    ('single', "'manualGates': [Single quoted]", 12), ('lower', 'manualgates: [Lower]', 12),
                    ('upper', 'ManualGates: [Upper]', 12), ('snake', 'manual_gates: [Snake]', 12),
                    ('kebab', 'manual-gates: [Kebab]', 12), ('singular', 'manualGate: [Singular]', 12),
                    ('twice', 'manualGates: [Real]\nmanualGates: []', 13),
                    ('twice-same', G_LINE + '\n' + G_LINE, 13), ('shadowed', 'manualGates: []\n  manualGates: [Real]', 13))
        for name, gates, lineno in variants:
            root = os.path.join(self.tmp, 'v-' + name)
            make_root(root, {'G': gate_card('G', gates)})
            path = card_file(root, 'G')
            bad = read_bytes(path)
            refused = gates.split('\n')[-1].strip()
            for args in (('gates', 'G'), ('move', 'G', 'ship'), ('move', 'G', 'ship', '--status', 'done'), ('move', 'G', 'build'),
                         ('show', 'G'), ('status',), ('list',), ('sync-ops',), ('gate', 'G', '1', '--by', 'owner')):
                r = run_card(root, *args)
                self.assertEqual((r.returncode, r.stdout), (1, ''), (name, args, r.stderr))
                self.assertIn(f'card.py: line {lineno} is not a manual gates line card.py reads: {refused!r}\n', r.stderr, (name, args))
                self.assertIn('manualGates: [a, b]', r.stderr, (name, args))
                self.assertEqual(read_bytes(path), bad, (name, args))
            self.assertFalse(os.path.exists(os.path.join(root, '.bridle')), name)

    def test_gate_word_outside_the_key_accepted(self):
        """The check reads the key part of a frontmatter line outside the history block: a title, another key's value, a
        history note and body text that mention the word are kept, and the card's own gates are still read."""
        note = '2026-01-01T00:00:02Z review running owner "manualGates: [typed, by hand] and manual_gates: [x]"'
        text = gate_card('G', '  - ' + note + '\n' + G_LINE)
        text = text.replace('title: Card G\n', 'title: manualGates: [not, a gate] and manual gates: later\n')
        text = text.replace('owner: factory-reviewer\n', 'owner: factory-reviewer\nlane: manualgates: [in a value]\n')
        text += '\nmanualGates: [In the body]\n  manualGates : [indented, in the body]\nmanual_gates: [Body]\n'
        root = os.path.join(self.tmp, 'word')
        make_root(root, {'G': text})
        path = card_file(root, 'G')
        r = run_card(root, 'gates', 'G')
        self.assertEqual((r.returncode, r.stdout), (3, 'open    Alpha report signed\nticked  Beta license executed  (no record)\n'), r.stderr)
        self.assertEqual(read_bytes(path).decode('utf-8'), text)
        r = run_card(root, 'list')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('- / manualGates: [not, a gate] and manual gates: later  [gates: 1 open of 2]\n', r.stdout)
        self.assertEqual(run_card(root, 'move', 'G', 'ship').returncode, 3)
        r = run_card(root, 'move', 'G', 'build', '--note', 'manualGates: [in a note]')
        self.assertEqual(r.returncode, 0, r.stderr)
        after = read_bytes(path).decode('utf-8')
        for kept in ('title: manualGates: [not, a gate] and manual gates: later\n', 'lane: manualgates: [in a value]\n',
                     '  - ' + note + '\n', '\n' + G_LINE + '\n---\n',
                     '\nmanualGates: [In the body]\n  manualGates : [indented, in the body]\nmanual_gates: [Body]\n'):
            self.assertIn(kept, after, kept)
        self.assertRegex(after, r'\n  - \S+Z build running factory-builder "manualGates: \[in a note\]"\n')
        self.assertEqual(run_card(root, 'gates', 'G').returncode, 3)
        r = run_card(root, 'gate', 'G', '1', '--by', 'owner')
        self.assertEqual((r.returncode, r.stdout), (0, 'ticked: Alpha report signed\n'), r.stderr)
        self.assertEqual(run_card(root, 'gates', 'G').returncode, 0)

    def test_status_done_refused_with_open_gate(self):
        """Foreman's addition (the reviewer's P0-08.3 advisory): a move that would leave the card reading as done is
        refused at every station while a gate is open, like a move to ship: exit 3, every open gate named, nothing written."""
        root = os.path.join(self.tmp, 'done')
        make_root(root, {'M': gate_card('M', 'manualGates: [One, [x] Two, Three]'), 'N': gate_card('N')})
        m = card_file(root, 'M')
        before = read_bytes(m)
        for station in ('backlog', 'spec', 'plan', 'build', 'test', 'review', 'REVIEW', 'ship'):
            for status in ('done', ' done ', 'done\t', 'running\nstatus: done'):   # each is read back as status done
                r = run_card(root, 'move', 'M', station, '--status', status)
                self.assertEqual((r.returncode, r.stdout), (3, ''), (station, status, r.stderr))
                self.assertIn('card.py move: M has 2 open manual gate(s): One; Three\n', r.stderr, (station, status))
                self.assertIn('card.py gate M', r.stderr, (station, status))
                self.assertNotIn('Two', r.stderr, (station, status))
                self.assertEqual(read_bytes(m), before, (station, status))
        self.assertFalse(os.path.exists(os.path.join(root, '.bridle')))
        # A status line that would add a second gates line is an error, and nothing is written.
        r = run_card(root, 'move', 'M', 'review', '--status', 'running\nmanualGates: []')
        self.assertEqual((r.returncode, r.stdout), (1, ''), r.stderr)
        self.assertIn('is not a manual gates line card.py reads', r.stderr)
        self.assertEqual(read_bytes(m), before)
        self.assertFalse(os.path.exists(os.path.join(root, '.bridle')))
        # The other statuses move as before with the gates open; a card without gates is marked done as before.
        for status in ('running', 'blocked', 'failed', 'review', 'Done', 'undone'):
            r = run_card(root, 'move', 'M', 'review', '--status', status)
            self.assertEqual(r.returncode, 0, (status, r.stderr))
            self.assertIn(f'\nstatus: {status}\n', read_bytes(m).decode('utf-8'))
        r = run_card(root, 'move', 'N', 'review', '--status', 'done')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('\nstatus: done\n', read_bytes(card_file(root, 'N')).decode('utf-8'))
        # Every gate ticked: done at review is accepted.
        for gate in ('1', '3'):
            self.assertEqual(run_card(root, 'gate', 'M', gate, '--by', 'owner').returncode, 0)
        r = run_card(root, 'move', 'M', 'review', '--status', 'done')
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = read_bytes(m).decode('utf-8').split('\n')
        self.assertIn('status: done', lines)
        self.assertIn('manualGates: [[x] One, [x] Two, [x] Three]', lines)

    def test_card_without_gates_unchanged(self):
        r = self.card('move', 'N', 'ship')
        self.assertEqual(r.returncode, 0, r.stderr)
        text = self.text(self.n)
        front = text.split('\n---\n')[0].split('\n')[1:]
        self.assertEqual([l.split(':')[0] for l in front if not l.startswith('  - ')], KEYS)
        self.assertNotIn('manualGates', text)
        self.assertIn('station: ship', front)
        self.assertIn('status: done', front)
        self.assertRegex([l for l in front if l.startswith('  - ')][0], r'^  - \S+ ship done orchestrator "Moved to ship"$')
        self.assertTrue(text.endswith('---\n\n# N Card N\n\n## Spec\n\n## Ship\n'), text)
        # An open gate refuses ship only: another station moves, and the gate line survives the rewrite.
        r = self.card('move', 'G', 'build')
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = self.text(self.g).split('\n')
        self.assertIn('station: build', lines)
        self.assertIn(G_LINE, lines)
        self.assertEqual(self.card('move', 'G', 'ship').returncode, 3)

    def test_new_estimate(self):
        r = self.card('new', 'T1', 'Estimate card', '--phase', 'P9', '--order', '7', '--estimate', '0.5')
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = self.text(os.path.join(self.root, 'factory', 'cards', 'T1-estimate-card.md')).split('\n')
        i = lines.index('estimate: 0.5')
        self.assertEqual((lines[i - 1], lines[i + 1]), ('dependsOn: []', 'station: backlog'))
        op = json.loads(r.stdout)
        self.assertEqual((op['op'], op['path'], op['data']['estimate']), ('set', 'tasks/T1', '0.5'))
        r = self.card('new', 'T2', 'Plain card', '--phase', 'P9', '--order', '8')
        self.assertEqual(r.returncode, 0, r.stderr)
        text = self.text(os.path.join(self.root, 'factory', 'cards', 'T2-plain-card.md'))
        self.assertNotIn('estimate', text)
        op = json.loads(r.stdout)
        self.assertEqual(op['path'], 'tasks/T2')
        self.assertNotIn('estimate', op['data'])
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))  # `new` prints its op and writes no event


def linked_worktrees(repo):
    """The names registered under the common git directory of `repo` (one per linked worktree), or None outside git."""
    r = subprocess.run(['git', '-C', repo, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
                       capture_output=True, text=True, env=clean_env())
    if r.returncode != 0:
        return None
    d = os.path.join(r.stdout.strip(), 'worktrees')
    return sorted(os.listdir(d)) if os.path.isdir(d) else []


class WorktreeTests(unittest.TestCase):
    """The two roots (criterion 2) in a temporary repository `main` with one linked worktree `wt` on branch lane/x:
    cards belong to the checkout holding the script, events and traces to the main checkout. Nothing here is a clone or
    a worktree of the checkout under test."""
    RUNS = ('wt-test', 'wt-trace', 'wt-bad', 'wt-rel')

    @classmethod
    def setUpClass(cls):
        if not shutil.which('git'):
            raise AssertionError('git is required for the worktree cases')
        cls.before = linked_worktrees(REPO)
        cls.tmp = tempfile.mkdtemp(prefix='bridle-wt-')
        cls.main, cls.wt = os.path.join(cls.tmp, 'main'), os.path.join(cls.tmp, 'wt')
        make_root(cls.main, {'G': gate_card('G', G_LINE), 'N': gate_card('N')})
        env = clean_env(GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_NOSYSTEM='1', GIT_AUTHOR_NAME='t', GIT_AUTHOR_EMAIL='t@example.invalid',
                        GIT_COMMITTER_NAME='t', GIT_COMMITTER_EMAIL='t@example.invalid')
        for args in (['init', '-q', '-b', 'main', cls.main], ['-C', cls.main, 'add', '.'],
                     ['-C', cls.main, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'fixture'],
                     ['-C', cls.main, 'worktree', 'add', '-q', '-b', 'lane/x', cls.wt]):
            r = subprocess.run(['git'] + args, capture_output=True, text=True, env=env)
            if r.returncode != 0:
                shutil.rmtree(cls.tmp, ignore_errors=True)
                raise AssertionError(f'git {" ".join(args)}: {r.stderr}')

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)
        if linked_worktrees(REPO) != cls.before:
            raise AssertionError(f'the linked worktrees of {REPO} changed: {cls.before} -> {linked_worktrees(REPO)}')
        left = [run for run in cls.RUNS if os.path.exists(os.path.join(REPO, '.bridle', 'progress', run))]
        if left:
            raise AssertionError(f'{REPO}/.bridle/progress gained {left}')

    def progress(self, *parts):
        return os.path.join(self.main, '.bridle', 'progress', *parts)

    def assert_nothing_in_worktree(self):
        self.assertFalse(os.path.exists(os.path.join(self.wt, '.bridle')))

    def test_worktree_roots(self):
        wt_n, main_n = card_file(self.wt, 'N'), card_file(self.main, 'N')
        with open(wt_n, encoding='utf-8') as f:
            text = f.read()
        with open(wt_n, 'w', encoding='utf-8') as f:
            f.write(text.replace('title: Card N\n', 'title: Card N in the lane\n'))
        main_before = read_bytes(main_n)
        # By absolute path with cwd /: each copy lists the cards of its own checkout.
        r = run_card(self.wt, 'list', cwd='/')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('- / Card N in the lane\n', r.stdout)
        r = run_card(self.main, 'list', cwd='/')
        self.assertIn('- / Card N\n', r.stdout)
        self.assertNotIn('in the lane', r.stdout)
        # The worktree's copy moves the worktree's card; its event lands in the main checkout.
        r = run_card(self.wt, 'move', 'N', 'plan', cwd='/')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(read_bytes(main_n), main_before)
        self.assertIn('\nstation: plan\n', read_bytes(wt_n).decode('utf-8'))
        events = jsonl(self.progress('factory', 'factory-planner.jsonl'))
        self.assertEqual([(e['type'], e['taskId'], e['data']['card']) for e in events], [('card.move', 'N', 'factory/cards/N-card-n.md')])
        self.assert_nothing_in_worktree()
        r = run_log(self.wt, '-r', 'wt-test', '-p', 'P9', '-a', 'a', '-t', 'N', '-T', 'note', '-m', 'from the worktree', cwd='/')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)['data']['seq'], 1)
        self.assertEqual([e['message'] for e in jsonl(self.progress('wt-test', 'a.jsonl'))], ['from the worktree'])
        self.assert_nothing_in_worktree()
        # The same two commands from the main checkout write the same places.
        r = run_card(self.main, 'move', 'N', 'plan', cwd='/')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('\nstation: plan\n', read_bytes(main_n).decode('utf-8'))
        self.assertNotIn('in the lane', read_bytes(main_n).decode('utf-8'))
        self.assertEqual(len(jsonl(self.progress('factory', 'factory-planner.jsonl'))), 2)
        r = run_log(self.main, '-r', 'wt-test', '-p', 'P9', '-a', 'a', '-t', 'N', '-T', 'note', '-m', 'from main', cwd='/')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual([(e['seq'], e['message']) for e in jsonl(self.progress('wt-test', 'a.jsonl'))],
                         [(1, 'from the worktree'), (2, 'from main')])
        self.assert_nothing_in_worktree()

    def test_main_root_rule(self):
        real = os.path.realpath
        plain, other, missing = (os.path.join(self.tmp, n) for n in ('plain', 'other', 'missing'))
        make_root(plain, {})
        os.makedirs(other)
        for root, env, want in ((self.main, {}, self.main), (self.wt, {}, self.main), (plain, {}, plain),
                                (self.wt, {'BRIDLE_MAIN_ROOT': other}, other), (self.main, {'BRIDLE_MAIN_ROOT': other}, other),
                                (self.wt, {'BRIDLE_MAIN_ROOT': ''}, self.main)):
            r = run_log(root, '--main-root', cwd='/', **env)
            self.assertEqual((r.returncode, r.stderr), (0, ''), (root, env))
            self.assertEqual(real(r.stdout.rstrip('\n')), real(want), (root, env))
        # The override decides where an event goes; one that is not a directory is an error and nothing is written.
        r = run_log(self.wt, '-r', 'wt-bad', '-p', 'P9', '-a', 'a', '-t', 'N', '-T', 'note', '-m', 'm', cwd='/', BRIDLE_MAIN_ROOT=other)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(os.path.isfile(os.path.join(other, '.bridle', 'progress', 'wt-bad', 'a.jsonl')))
        for args in (('--main-root',), ('-r', 'wt-bad', '-p', 'P9', '-a', 'a', '-t', 'N', '-T', 'note', '-m', 'm')):
            r = run_log(self.wt, *args, cwd='/', BRIDLE_MAIN_ROOT=missing)
            self.assertEqual((r.returncode, r.stdout), (1, ''), args)
            self.assertIn('BRIDLE_MAIN_ROOT', r.stderr)
        self.assertFalse(os.path.exists(missing))
        self.assertFalse(os.path.exists(self.progress('wt-bad')))
        self.assert_nothing_in_worktree()

    def test_relative_main_root_refused(self):
        """Foreman's addition (the reviewer's P0-08.4 advisory): a BRIDLE_MAIN_ROOT that is not an absolute path is an
        error, with or without CDPATH, even when it names a directory from the caller's cwd."""
        os.makedirs(os.path.join(self.tmp, 'rel', 'inner'), exist_ok=True)
        note = ('-r', 'wt-rel', '-p', 'P9', '-a', 'a', '-t', 'N', '-T', 'note', '-m', 'm')
        for value in ('rel', './rel', '.', '..', 'rel/inner'):
            for extra in ({}, {'CDPATH': self.tmp + ':' + os.path.join(self.tmp, 'rel')}):
                for root in (self.main, self.wt):
                    for args in (('--main-root',), note):
                        r = run_log(root, *args, cwd=self.tmp, BRIDLE_MAIN_ROOT=value, **extra)
                        self.assertEqual((r.returncode, r.stdout), (1, ''), (value, extra, root, args))
                        self.assertIn(f'BRIDLE_MAIN_ROOT is not an absolute path to a directory: {value}\n', r.stderr)
        for d in (self.tmp, os.path.join(self.tmp, 'rel'), os.path.join(self.tmp, 'rel', 'inner'), self.wt):
            self.assertFalse(os.path.exists(os.path.join(d, '.bridle')), d)
        self.assertFalse(os.path.exists(self.progress('wt-rel')))
        # The absolute path of the same directory is accepted with CDPATH set, and prints one line.
        rel = os.path.join(self.tmp, 'rel')
        r = run_log(self.wt, '--main-root', cwd=self.tmp, BRIDLE_MAIN_ROOT=rel, CDPATH=self.tmp)
        self.assertEqual((r.returncode, r.stderr), (0, ''))
        self.assertEqual(os.path.realpath(r.stdout.rstrip('\n')), os.path.realpath(rel))
        self.assertEqual(r.stdout.count('\n'), 1)

    def test_trace_hook_in_worktree(self):
        cache = self.progress('.mirror', 'agents', 'h1.json')
        os.makedirs(os.path.dirname(cache))
        with open(cache, 'w', encoding='utf-8') as f:
            json.dump({'runId': 'wt-trace', 'phase': 'P9', 'agentId': 'tracer', 'taskId': 'N', 'harnessId': 'h1'}, f)
        hook = {'hook_event_name': 'PostToolUse', 'agent_id': 'h1', 'session_id': 's1', 'tool_name': 'Bash',
                'tool_input': {'command': 'echo  traced'}, 'tool_use_id': 'toolu_wt'}
        r = subprocess.run([os.path.join(self.wt, 'tools', 'monitor', 'trace-hook.sh')], input=json.dumps(hook),
                           capture_output=True, text=True, cwd=self.wt, env=clean_env(CLAUDE_PROJECT_DIR=self.wt))
        self.assertEqual((r.returncode, r.stdout, r.stderr), (0, '', ''))
        lines = jsonl(self.progress('wt-trace', 'tracer.trace.jsonl'))
        self.assertEqual([(l['tool'], l['target'], l['ok'], l['id']) for l in lines], [('Bash', 'echo traced', True, 'toolu_wt')])
        self.assert_nothing_in_worktree()


# Cases added by the test station of P0-08.1 (the fixtures above are the Plan's and are not changed).
M_LINE = 'manualGates: [One, [x] Two, Three]'
RULE = ('The main checkout is the directory in BRIDLE_MAIN_ROOT when that is set; otherwise, when the checkout holding the '
        'script is a linked git worktree whose common git directory is <dir>/.git, it is <dir>; in every other case it is '
        'the checkout holding the script.')
GIT_ENV = dict(GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_NOSYSTEM='1', GIT_AUTHOR_NAME='t', GIT_AUTHOR_EMAIL='t@example.invalid',
               GIT_COMMITTER_NAME='t', GIT_COMMITTER_EMAIL='t@example.invalid')


def git(*args):
    r = subprocess.run(['git'] + list(args), capture_output=True, text=True, env=clean_env(**GIT_ENV))
    if r.returncode != 0:
        raise AssertionError(f'git {" ".join(args)}: {r.stderr}')
    return r.stdout


class GateEdgeTests(unittest.TestCase):
    """Criterion 1 at its edges: every open gate named, any status, the tick and its record across later rewrites,
    names with brackets and quotes, the stations that are not ship."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bridle-gate-edge-')
        self.root = os.path.join(self.tmp, 'R')
        make_root(self.root, {'G': gate_card('G', G_LINE), 'M': gate_card('M', M_LINE)})
        self.g, self.m = card_file(self.root, 'G'), card_file(self.root, 'M')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def card(self, *args):
        return run_card(self.root, *args)

    def lines(self, path):
        return read_bytes(path).decode('utf-8').split('\n')

    def test_ship_refusal_names_every_open_gate_for_any_status(self):
        before = read_bytes(self.m)
        moves = [('move', 'M', 'ship')] + [('move', 'M', 'ship', '--status', s) for s in ('running', 'done', 'blocked', 'failed', 'review')]
        for args in moves + [('move', 'M', 'SHIP'), ('move', 'M', 'Ship', '--status', 'failed')]:
            r = self.card(*args)
            self.assertEqual((r.returncode, r.stdout), (3, ''), (args, r.stderr))
            self.assertIn('card.py move: M has 2 open manual gate(s): One; Three\n', r.stderr, args)
            self.assertNotIn('Two', r.stderr, args)
            self.assertEqual(read_bytes(self.m), before, args)
            self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')), args)
        # One of two ticked: still refused, and only the open one is named.
        self.assertEqual(self.card('gate', 'M', 'One', '--by', 'owner').returncode, 0)
        half = read_bytes(self.m)
        r = self.card('move', 'M', 'ship', '--status', 'failed')
        self.assertEqual(r.returncode, 3, r.stderr)
        self.assertIn('M has 1 open manual gate(s): Three\n', r.stderr)
        self.assertNotIn('One', r.stderr)
        self.assertEqual(read_bytes(self.m), half)
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))
        # Every gate ticked: the move works with the status asked for.
        self.assertEqual(self.card('gate', 'M', '3', '--by', 'owner').returncode, 0)
        r = self.card('move', 'M', 'ship', '--status', 'failed')
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = self.lines(self.m)
        self.assertIn('station: ship', lines)
        self.assertIn('status: failed', lines)
        self.assertIn('manualGates: [[x] One, [x] Two, [x] Three]', lines)

    def test_tick_and_record_survive_later_moves(self):
        r = self.card('gate', 'G', 'Alpha report signed', '--by', 'owner', '--evidence', 'https://example.invalid/r/1')
        self.assertEqual(r.returncode, 0, r.stderr)
        tick_line = [l for l in self.lines(self.g) if l.startswith('  - ')][0]
        self.assertRegex(tick_line, r'^  - \S+Z review running owner "gate ticked: Alpha report signed; evidence: https://example\.invalid/r/1"$')
        shown = self.card('gates', 'G')
        self.assertEqual(shown.returncode, 0, shown.stdout)
        self.assertRegex(shown.stdout.split('\n')[0], r'^ticked  Alpha report signed  \(owner \S+Z, evidence https://example\.invalid/r/1\)$')
        for n, station in enumerate(('build', 'test', 'review', 'ship'), start=1):
            r = self.card('move', 'G', station, '--note', f'loop to {station}')
            self.assertEqual(r.returncode, 0, (station, r.stderr))
            lines = self.lines(self.g)
            hist = [l for l in lines if l.startswith('  - ')]
            self.assertEqual(hist[0], tick_line, station)       # who and when stay recorded in the card
            self.assertEqual(len(hist), 1 + n, station)
            self.assertIn(G_TICKED, lines, station)             # the tick stays
            self.assertIn(f'station: {station}', lines)
            again = self.card('gates', 'G')
            self.assertEqual((again.returncode, again.stdout), (0, shown.stdout), station)
        self.assertTrue(read_bytes(self.g).decode('utf-8').endswith('---\n\n# G Card G\n\n## Spec\n\n## Ship\n'))

    def test_other_stations_move_with_an_open_gate(self):
        for station in ('backlog', 'spec', 'plan', 'build', 'test', 'review'):
            r = self.card('move', 'M', station)
            self.assertEqual(r.returncode, 0, (station, r.stderr))
            lines = self.lines(self.m)
            self.assertIn(f'station: {station}', lines)
            self.assertIn(M_LINE, lines, station)
        self.assertEqual(self.card('gates', 'M').returncode, 3)
        self.assertEqual(self.card('move', 'M', 'ship').returncode, 3)

    def test_gate_names_with_brackets_quotes_and_a_comma(self):
        root = os.path.join(self.tmp, 'names')
        make_root(root, {'Q': gate_card('Q', 'manualGates: [Alpha [draft] signed, Say "yes" twice, [ ] Spaced open, [X] Upper]'),
                         'K': gate_card('K', 'manualGates: [Sign a, b report]')})
        q, k = card_file(root, 'Q'), card_file(root, 'K')
        r = run_card(root, 'gates', 'Q')
        self.assertEqual((r.returncode, r.stdout), (3, 'open    Alpha [draft] signed\nopen    Say "yes" twice\nopen    Spaced open\n'
                                                       'ticked  Upper  (no record)\n'))
        r = run_card(root, 'move', 'Q', 'ship')
        self.assertEqual(r.returncode, 3)
        self.assertIn('Q has 3 open manual gate(s): Alpha [draft] signed; Say "yes" twice; Spaced open\n', r.stderr)
        for name, who, evidence in (('Alpha [draft] signed', 'owner', 'see "x"; evidence: y, z'), ('Say "yes" twice', 'legal', ''),
                                    ('Spaced open', 'ops', '')):
            r = run_card(root, 'gate', 'Q', name, '--by', who, *(['--evidence', evidence] if evidence else []))
            self.assertEqual((r.returncode, r.stdout), (0, f'ticked: {name}\n'), r.stderr)
        self.assertEqual(run_card(root, 'move', 'Q', 'build').returncode, 0)  # a rewrite between the ticks and the read
        with open(q, encoding='utf-8') as f:
            self.assertIn('manualGates: [[x] Alpha [draft] signed, [x] Say "yes" twice, [x] Spaced open, [X] Upper]', f.read().split('\n'))
        r = run_card(root, 'gates', 'Q')
        self.assertEqual(r.returncode, 0, r.stdout)
        out = r.stdout.split('\n')
        self.assertRegex(out[0], r'^ticked  Alpha \[draft\] signed  \(owner \S+Z, evidence see "x"; evidence: y, z\)$')
        self.assertRegex(out[1], r'^ticked  Say "yes" twice  \(legal \S+Z\)$')
        self.assertRegex(out[2], r'^ticked  Spaced open  \(ops \S+Z\)$')
        self.assertEqual(run_card(root, 'move', 'Q', 'ship').returncode, 0)
        # A comma splits a name in two (card.py's header: a name holds no comma): the card stays refused at ship, never
        # passed, and the name as written is not a gate.
        before = read_bytes(k)
        r = run_card(root, 'move', 'K', 'ship')
        self.assertEqual(r.returncode, 3)
        self.assertIn('K has 2 open manual gate(s): Sign a; b report\n', r.stderr)
        r = run_card(root, 'gate', 'K', 'Sign a, b report', '--by', 'owner')
        self.assertEqual(r.returncode, 1)
        self.assertIn('1. Sign a; 2. b report', r.stderr)
        self.assertEqual(read_bytes(k), before)

    # Second test pass (after rework loop 1): shapes and arguments the builder's rework cases do not run.

    def raw_card(self, name, data):
        """A root holding card G with exactly these bytes; (root, path)."""
        root = os.path.join(self.tmp, name)
        make_root(root, {})
        path = card_file(root, 'G')
        with open(path, 'wb') as f:
            f.write(data)
        return root, path

    def test_gate_line_more_shapes(self):
        """Finding 1 beyond the reviewer's rows: one space, a tab or a space before the colon behind a quote, capitals,
        `manual gates`, a no-break space, the line at other places of the frontmatter, a CRLF file; and the shapes that
        are a readable gates line (CRLF endings, no space after the colon, a trailing space) are read, not refused."""
        lf = gate_card('G', '@').encode('utf-8')
        first = lf.replace(b'history:\n@\n', b'history:\n').replace(b'---\nid: G\n', b'---\n  manualGates: [A]\nid: G\n')
        refused = (('one-space', lf.replace(b'@', b' manualGates: [A]'), 12), ('tab-colon', lf.replace(b'@', b'manualGates\t: [A]'), 12),
                   ('quoted-colon', lf.replace(b'@', b'"manualGates" : [A]'), 12), ('capitals', lf.replace(b'@', b'MANUALGATES: [A]'), 12),
                   ('two-words', lf.replace(b'@', b'manual gates: [A]'), 12),
                   ('nbsp', lf.replace(b'@', '\u00a0manualGates: [A]'.encode('utf-8')), 12),
                   ('second-real', lf.replace(b'@', b'manualGates: []\nmanualGates: [Real]'), 13),
                   ('first-line', first, 2), ('before-history', lf.replace(b'history:\n@\n', b'\tmanualGates: [A]\nhistory:\n'), 11),
                   ('after-history-item', lf.replace(b'@', b'  - 2026-01-01T00:00:02Z review running o "n"\n  manualGates: [A]'), 13),
                   ('crlf-indented', lf.replace(b'@', b'  manualGates: [A]').replace(b'\n', b'\r\n'), 12))
        for name, data, lineno in refused:
            root, path = self.raw_card('s-' + name, data)
            for args in (('gates', 'G'), ('move', 'G', 'ship'), ('move', 'G', 'build'), ('move', 'G', 'review', '--status', 'done'),
                         ('list',), ('gate', 'G', '1', '--by', 'owner')):
                r = run_card(root, *args)
                self.assertEqual((r.returncode, r.stdout), (1, ''), (name, args, r.stderr))
                self.assertIn(f'card.py: line {lineno} is not a manual gates line card.py reads: ', r.stderr, (name, args))
                self.assertEqual(read_bytes(path), data, (name, args))
            self.assertFalse(os.path.exists(os.path.join(root, '.bridle')), name)
        # A byte order mark before the first `---`: no frontmatter is read, so nothing passes and nothing is written.
        root, path = self.raw_card('s-bom', b'\xef\xbb\xbf' + lf.replace(b'@', b'manualGates: [A]'))
        for args in (('gates', 'G'), ('move', 'G', 'ship'), ('move', 'G', 'build')):
            r = run_card(root, *args)
            self.assertEqual((r.returncode, r.stdout), (1, ''), args)
            self.assertIn('card has no frontmatter', r.stderr)
        self.assertEqual(read_bytes(path), b'\xef\xbb\xbf' + lf.replace(b'@', b'manualGates: [A]'))
        self.assertFalse(os.path.exists(os.path.join(root, '.bridle')))
        # Readable gates lines stay gates: the open gate is reported and refuses ship and done.
        for name, data in (('crlf', lf.replace(b'@', b'manualGates: [A]').replace(b'\n', b'\r\n')),
                           ('no-space', lf.replace(b'@', b'manualGates:[A]')), ('trailing-space', lf.replace(b'@', b'manualGates: [A] '))):
            root, path = self.raw_card('s-' + name, data)
            r = run_card(root, 'gates', 'G')
            self.assertEqual((r.returncode, r.stdout), (3, 'open    A\n'), (name, r.stderr))
            for args in (('move', 'G', 'ship'), ('move', 'G', 'test', '--status', 'done')):
                r = run_card(root, *args)
                self.assertEqual(r.returncode, 3, (name, args, r.stderr))
                self.assertIn('G has 1 open manual gate(s): A\n', r.stderr, (name, args))
            self.assertEqual(read_bytes(path), data, name)
            self.assertFalse(os.path.exists(os.path.join(root, '.bridle')), name)

    def test_done_refused_through_other_arguments_and_after_an_event(self):
        """Item 3 at its edges: `done` reached through --agent, an empty --status at ship, a card already done by hand;
        a refused move adds no line to an event file that already exists; an empty gate list is no gate."""
        def event_lines():
            d = os.path.join(self.root, '.bridle', 'progress')
            return sorted((os.path.join(p, n), read_bytes(os.path.join(p, n))) for p, _, names in os.walk(d) for n in names)
        self.assertEqual(self.card('move', 'M', 'build').returncode, 0)     # one event exists from here on
        before, events = read_bytes(self.m), event_lines()
        self.assertEqual(len(events), 1)
        for args in (('test', '--agent', 'x\nstatus: done'), ('ship', '--status', ''), ('Ship', '--status', 'running'),
                     ('backlog', '--status', '\tdone'), ('build', '--status', 'done', '--note', 'n', '--from', 'build', '--run', 'r2')):
            r = self.card('move', 'M', *args)
            self.assertEqual((r.returncode, r.stdout), (3, ''), (args, r.stderr))
            self.assertIn('card.py move: M has 2 open manual gate(s): One; Three\n', r.stderr, args)
            self.assertEqual(read_bytes(self.m), before, args)
            self.assertEqual(event_lines(), events, args)
        # `done` in a note is a note: the card moves and reads as running.
        r = self.card('move', 'M', 'test', '--note', 'x\nstatus: done')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('status: running', self.lines(self.m))
        self.assertNotIn('status: done', self.lines(self.m))
        # A card marked done by hand with a gate open: it can leave done, and cannot be marked done again.
        root = os.path.join(self.tmp, 'hand')
        make_root(root, {'H': gate_card('H', 'manualGates: [One]').replace('status: running\n', 'status: done\n'),
                         'E': gate_card('E', 'manualGates: []')})
        self.assertEqual(run_card(root, 'gates', 'H').returncode, 3)
        self.assertEqual(run_card(root, 'move', 'H', 'review', '--status', 'done').returncode, 3)
        self.assertEqual(run_card(root, 'move', 'H', 'build').returncode, 0)
        self.assertEqual(run_card(root, 'move', 'H', 'build', '--status', 'done').returncode, 3)
        for station in ('backlog', 'review', 'ship'):
            r = run_card(root, 'move', 'E', station, '--status', 'done')
            self.assertEqual(r.returncode, 0, (station, r.stderr))
            with open(card_file(root, 'E'), encoding='utf-8') as f:
                lines = f.read().split('\n')
            self.assertIn(f'station: {station}', lines)
            self.assertIn('status: done', lines)
            self.assertIn('manualGates: []', lines)

    def test_move_rewrites_exactly(self):
        """The reshaped cmd_move writes what a move always wrote: the four state lines replaced, one history line
        appended, every other byte kept (an unknown key, the gates line, earlier history, the body), and one event."""
        old = '  - 2026-01-01T00:00:00Z spec running orchestrator "Spec: a colon, [brackets] and \\"quotes\\""'
        text = gate_card('X', old + '\n' + G_LINE + '\ntrack: lane/x')  # `lane` is a key card.py writes since P0-08.2
        text = text.replace('dependsOn: []\n', 'dependsOn: [A, B]\nestimate: 0.5\n') + '\n---\n\nmanualGates: [body]\n  - not history\n'
        root = os.path.join(self.tmp, 'exact')
        make_root(root, {'X': text})
        path = card_file(root, 'X')
        r = run_card(root, 'move', 'X', 'test', '--status', 'blocked', '--agent', 'some agent', '--note', 'two\nlines "q"', '--from', 'build')
        self.assertEqual(r.returncode, 0, r.stderr)
        after = read_bytes(path).decode('utf-8')
        ts = re.search(r'^updated: (\S+)$', after, re.M).group(1)
        self.assertRegex(ts, r'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$')
        want = text.replace('station: review\nstatus: running\nowner: factory-reviewer\nupdated: 2026-01-01T00:00:01Z\n',
                            f'station: test\nstatus: blocked\nowner: some agent\nupdated: {ts}\n')
        want = want.replace(old + '\n', old + '\n' f'  - {ts} test blocked some agent "two lines "q""\n', 1)
        self.assertEqual(after, want)
        op = json.loads(r.stdout)
        events = jsonl(os.path.join(root, '.bridle', 'progress', 'factory', 'some-agent.jsonl'))
        self.assertEqual(len(events), 1)
        self.assertEqual(op['data'], events[0])
        e = events[0]
        self.assertEqual((e['type'], e['taskId'], e['phase'], e['step'], e['status'], e['progress'], e['message'], e['agentLabel'], e['data']),
                         ('card.move', 'X', 'P9', 'test', 'blocked', 67, 'two\nlines "q"', 'some agent',
                          {'station': 'test', 'card': 'factory/cards/X-card-x.md', 'from': 'build'}))
        # A refusal after that leaves these bytes and this one event.
        r = run_card(root, 'move', 'X', 'review', '--status', 'done')
        self.assertEqual(r.returncode, 3, r.stderr)
        self.assertEqual(read_bytes(path).decode('utf-8'), want)
        self.assertEqual(len(jsonl(os.path.join(root, '.bridle', 'progress', 'factory', 'some-agent.jsonl'))), 1)
        self.assertEqual(os.listdir(os.path.join(root, '.bridle', 'progress', 'factory')), ['some-agent.jsonl'])


class LaneTests(unittest.TestCase):
    """Criterion 2 with two linked worktrees (`wb` added from inside `wa`), a symlinked path, a subdirectory as cwd and
    git variables in the environment, in a temporary repository whose path holds a space."""
    RUNS = ('lane-sub', 'lane-tr', 'lane-case', 'lane-case2', 'lane-rel')

    @classmethod
    def setUpClass(cls):
        if not shutil.which('git'):
            raise AssertionError('git is required for the worktree cases')
        cls.before = linked_worktrees(REPO)
        cls.tmp = tempfile.mkdtemp(prefix='bridle-lane-')
        base = os.path.join(cls.tmp, 'two words')
        cls.main, cls.wa, cls.wb, cls.link = (os.path.join(base, n) for n in ('main', 'wa', 'wb', 'link-b'))
        try:
            make_root(cls.main, {'G': gate_card('G', G_LINE), 'N': gate_card('N')})
            os.makedirs(os.path.join(cls.main, 'docs', 'plan'))
            with open(os.path.join(cls.main, 'docs', 'plan', 'progress.md'), 'w', encoding='utf-8') as f:
                f.write('# Progress\n\n<!-- board:start -->\n<!-- board:end -->\n')
            git('init', '-q', '-b', 'main', cls.main)
            git('-C', cls.main, 'add', '.')
            git('-C', cls.main, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'fixture')
            git('-C', cls.main, 'worktree', 'add', '-q', '-b', 'lane/a', cls.wa)
            git('-C', cls.wa, 'worktree', 'add', '-q', '-b', 'lane/b', cls.wb)
            os.symlink(cls.wb, cls.link)
        except BaseException:
            shutil.rmtree(cls.tmp, ignore_errors=True)
            raise

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)
        if linked_worktrees(REPO) != cls.before:
            raise AssertionError(f'the linked worktrees of {REPO} changed: {cls.before} -> {linked_worktrees(REPO)}')
        left = [run for run in cls.RUNS if os.path.exists(os.path.join(REPO, '.bridle', 'progress', run))]
        if left:
            raise AssertionError(f'{REPO}/.bridle/progress gained {left}')

    def progress(self, *parts):
        return os.path.join(self.main, '.bridle', 'progress', *parts)

    def assert_nothing_in_worktrees(self):
        for wt in (self.wa, self.wb):
            self.assertFalse(os.path.exists(os.path.join(wt, '.bridle')), wt)

    def test_two_worktrees_cards_and_board(self):
        """gate, list, move and status --write of a worktree's copy touch that worktree's files only; every event of
        every copy lands in the main checkout."""
        fixture = read_bytes(card_file(self.main, 'G'))
        r = run_card(self.wb, 'gate', 'G', '1', '--by', 'owner', cwd='/')
        self.assertEqual((r.returncode, r.stdout), (0, 'ticked: Alpha report signed\n'), r.stderr)
        for root, want in ((self.main, '1 open of 2'), (self.wa, '1 open of 2'), (self.wb, '0 open of 2'), (self.link, '0 open of 2')):
            r = run_card(root, 'list', cwd='/')
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn(f'- / Card G  [gates: {want}]\n', r.stdout, root)
        r = run_card(self.wa, 'move', 'G', 'ship', cwd='/')      # the other lane's card still has its gate open
        self.assertEqual(r.returncode, 3, r.stderr)
        r = run_card(self.link, 'move', 'G', 'ship', cwd='/')    # through the symlinked path
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(read_bytes(card_file(self.main, 'G')), fixture)
        self.assertEqual(read_bytes(card_file(self.wa, 'G')), fixture)
        self.assertIn('\nstation: ship\n', read_bytes(card_file(self.wb, 'G')).decode('utf-8'))
        events = jsonl(self.progress('factory', 'orchestrator.jsonl'))
        self.assertEqual([(e['type'], e['taskId'], e['step'], e['data']['card']) for e in events],
                         [('card.move', 'G', 'ship', 'factory/cards/G-card-g.md')])
        # status --write: by absolute path with cwd /, and by relative path from inside the worktree.
        board = os.path.join('docs', 'plan', 'progress.md')
        r = run_card(self.wb, 'status', '--write', os.path.join(self.wb, board), cwd='/')
        self.assertEqual(r.returncode, 0, r.stderr)
        r = subprocess.run([sys.executable, os.path.join('tools', 'monitor', 'card.py'), 'status', '--write', board],
                           capture_output=True, text=True, cwd=self.wa, env=clean_env())
        self.assertEqual(r.returncode, 0, r.stderr)
        texts = {root: read_bytes(os.path.join(root, board)).decode('utf-8') for root in (self.main, self.wa, self.wb)}
        self.assertIn('| G | P9 | ship | done | orchestrator |', texts[self.wb])
        self.assertIn('| G | P9 | review | running | factory-reviewer | 2026-01-01T00:00:01Z |', texts[self.wa])
        self.assertEqual(texts[self.main], '# Progress\n\n<!-- board:start -->\n<!-- board:end -->\n')
        r = run_card(self.wb, 'status', cwd='/')
        self.assertIn('| G | P9 | ship | done |', r.stdout)
        r = run_card(self.main, 'status', cwd='/')
        self.assertIn('| G | P9 | review | running |', r.stdout)
        # git agrees: each lane changed its own files and nothing else.
        self.assertEqual(git('-C', self.wb, 'status', '--porcelain'), ' M docs/plan/progress.md\n M factory/cards/G-card-g.md\n')
        self.assertEqual(git('-C', self.wa, 'status', '--porcelain'), ' M docs/plan/progress.md\n')
        self.assertEqual(git('-C', self.main, 'status', '--porcelain'), '?? .bridle/\n')
        self.assert_nothing_in_worktrees()

    def test_log_from_subdirectory_symlink_and_git_environment(self):
        real = os.path.realpath
        note = ('-r', 'lane-sub', '-p', 'P9', '-a', 'a', '-t', 'N', '-T', 'note', '-m')
        sub = os.path.join(self.wb, 'factory', 'cards')
        rel = os.path.join('..', '..', 'tools', 'monitor', 'log.sh')
        r = subprocess.run([rel, '--main-root'], capture_output=True, text=True, cwd=sub, env=clean_env())
        self.assertEqual((r.returncode, real(r.stdout.rstrip('\n'))), (0, real(self.main)), r.stderr)
        r = subprocess.run([rel, *note, 'relative, from a subdirectory'], capture_output=True, text=True, cwd=sub, env=clean_env())
        self.assertEqual(r.returncode, 0, r.stderr)
        for root in (self.wa, self.wb, self.link):
            r = run_log(root, '--main-root', cwd='/')
            self.assertEqual((r.returncode, real(r.stdout.rstrip('\n'))), (0, real(self.main)), root)
        r = run_log(self.link, *note, 'through the symlink', cwd='/')
        self.assertEqual(r.returncode, 0, r.stderr)
        r = run_log(self.wa, *note, 'from the other worktree', cwd=self.wb)
        self.assertEqual(r.returncode, 0, r.stderr)
        # A git hook's environment (GIT_DIR, GIT_WORK_TREE) does not move the answer.
        for env in ({'GIT_DIR': '/nonexistent'}, {'GIT_DIR': os.path.join(self.tmp, 'elsewhere', '.git'), 'GIT_WORK_TREE': self.tmp}):
            r = run_log(self.wb, '--main-root', cwd=self.wa, **env)
            self.assertEqual((r.returncode, real(r.stdout.rstrip('\n'))), (0, real(self.main)), env)
        self.assertEqual([(e['seq'], e['message']) for e in jsonl(self.progress('lane-sub', 'a.jsonl'))],
                         [(1, 'relative, from a subdirectory'), (2, 'through the symlink'), (3, 'from the other worktree')])
        self.assert_nothing_in_worktrees()

    def test_log_through_a_case_variant_path(self):
        """Review finding 2: on a volume that ignores letter case, a worktree reached through a path in another case is
        still a linked worktree, so its events go to the main checkout. Skipped on a case-sensitive volume."""
        variant = os.path.join(os.path.dirname(self.wa), 'WA')
        if not (os.path.isdir(variant) and os.path.samefile(variant, self.wa)):
            self.skipTest('the volume of the temporary directory is case-sensitive')
        real = os.path.realpath
        for root in (variant, os.path.join(os.path.dirname(self.main), 'MAIN')):
            for cwd in ('/', variant):
                r = run_log(root, '--main-root', cwd=cwd)
                self.assertEqual((r.returncode, r.stderr), (0, ''), (root, cwd))
                self.assertTrue(os.path.samefile(r.stdout.rstrip('\n'), self.main), (root, cwd, r.stdout))
        r = run_log(variant, '-r', 'lane-case', '-p', 'P9', '-a', 'a', '-t', 'N', '-T', 'note', '-m', 'through WA', cwd='/')
        self.assertEqual(r.returncode, 0, r.stderr)
        fixture = read_bytes(card_file(self.wa, 'N'))
        try:
            r = run_card(variant, 'move', 'N', 'build', '--run', 'lane-case', cwd='/')
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn('\nstation: build\n', read_bytes(card_file(self.wa, 'N')).decode('utf-8'))
        finally:
            with open(card_file(self.wa, 'N'), 'wb') as f:  # the class's other cases compare this worktree's git status
                f.write(fixture)
        self.assertEqual([e['message'] for e in jsonl(self.progress('lane-case', 'a.jsonl'))], ['through WA'])
        self.assertEqual([(e['type'], e['taskId']) for e in jsonl(self.progress('lane-case', 'factory-builder.jsonl'))],
                         [('card.move', 'N')])
        self.assert_nothing_in_worktrees()

    def test_case_variant_worktree_by_relative_path_and_symlink(self):
        """Finding 2, further paths (second test pass): the second worktree as `WB`, called by a relative path from a
        subdirectory reached in another letter case, and through a symlink to the case variant."""
        base = os.path.dirname(self.wb)
        variant = os.path.join(base, 'WB')
        if not (os.path.isdir(variant) and os.path.samefile(variant, self.wb)):
            self.skipTest('the volume of the temporary directory is case-sensitive')
        link = os.path.join(base, 'link-WB')
        os.symlink(variant, link)
        try:
            calls = (([os.path.join('..', 'MONITOR', 'LOG.SH')], os.path.join(variant, 'TOOLS', 'monitor')),
                     ([os.path.join(link, 'tools', 'monitor', 'log.sh')], '/'),
                     ([os.path.join(variant, 'Tools', 'Monitor', 'log.sh')], self.wa))
            for n, (cmd, cwd) in enumerate(calls):
                r = subprocess.run(cmd + ['--main-root'], capture_output=True, text=True, cwd=cwd, env=clean_env())
                self.assertEqual((r.returncode, r.stderr), (0, ''), cmd)
                self.assertTrue(os.path.samefile(r.stdout.rstrip('\n'), self.main), (cmd, r.stdout))
                r = subprocess.run(cmd + ['-r', 'lane-case2', '-p', 'P9', '-a', 'a', '-t', 'N', '-T', 'note', '-m', f'call {n}'],
                                   capture_output=True, text=True, cwd=cwd, env=clean_env())
                self.assertEqual(r.returncode, 0, (cmd, r.stderr))
        finally:
            os.remove(link)
        self.assertEqual([(e['seq'], e['message']) for e in jsonl(self.progress('lane-case2', 'a.jsonl'))],
                         [(1, 'call 0'), (2, 'call 1'), (3, 'call 2')])
        self.assert_nothing_in_worktrees()

    def test_main_root_values_that_look_like_paths(self):
        """Item 4, further values (second test pass): `~`, `~/x`, `-`, a path with a leading space and an unexpanded
        `$HOME` are not absolute paths: exit 1 and nothing written, with CDPATH set; an absolute path written with
        `..` and a trailing slash is accepted and prints one line."""
        other = os.path.join(self.tmp, 'other dir')
        os.makedirs(os.path.join(other, 'inner'), exist_ok=True)
        named = [os.path.join(self.tmp, n) for n in ('~', '-', '$HOME')]   # each value names a directory from the cwd
        for d in named + [os.path.join(self.tmp, '~', 'x')]:
            os.makedirs(d, exist_ok=True)
        note = ('-r', 'lane-rel', '-p', 'P9', '-a', 'a', '-t', 'N', '-T', 'note', '-m', 'm')
        for value in ('~', '~/x', '-', ' ' + other, '$HOME', 'other dir'):
            for root in (self.main, self.wb):
                for args in (('--main-root',), note):
                    r = run_log(root, *args, cwd=self.tmp, BRIDLE_MAIN_ROOT=value, CDPATH=self.tmp + ':' + other, HOME=other)
                    self.assertEqual((r.returncode, r.stdout), (1, ''), (value, root, args))
                    self.assertEqual(r.stderr, f'log.sh: BRIDLE_MAIN_ROOT is not an absolute path to a directory: {value}\n')
        self.assertFalse(os.path.exists(self.progress('lane-rel')))
        for d in [other, os.path.join(other, 'inner'), self.tmp, os.path.join(self.tmp, '~', 'x')] + named:
            self.assertFalse(os.path.exists(os.path.join(d, '.bridle')), d)
        r = run_log(self.wb, '--main-root', cwd='/', BRIDLE_MAIN_ROOT=os.path.join(other, 'inner', '..') + '/', CDPATH=other)
        self.assertEqual((r.returncode, r.stderr, r.stdout.count('\n')), (0, '', 1))
        self.assertTrue(os.path.samefile(r.stdout.rstrip('\n'), other))
        self.assert_nothing_in_worktrees()

    def test_trace_hook_when_main_root_fails(self):
        """trace-hook.sh's header: when `log.sh --main-root` fails, the trace goes to the checkout holding the script;
        the hook still exits 0 and prints nothing. Held in a copy outside git, with an override that is not a directory."""
        plain, missing = os.path.join(self.tmp, 'plain'), os.path.join(self.tmp, 'missing')
        make_root(plain, {})
        cache = os.path.join(plain, '.bridle', 'progress', '.mirror', 'agents', 'h2.json')
        os.makedirs(os.path.dirname(cache))
        with open(cache, 'w', encoding='utf-8') as f:
            json.dump({'runId': 'lane-tr', 'phase': 'P9', 'agentId': 'tracer', 'taskId': 'N', 'harnessId': 'h2'}, f)
        hook = {'hook_event_name': 'PostToolUse', 'agent_id': 'h2', 'session_id': 's1', 'tool_name': 'Bash',
                'tool_input': {'command': 'echo traced'}, 'tool_use_id': 'toolu_fb'}
        self.assertEqual(run_log(plain, '--main-root', cwd='/', BRIDLE_MAIN_ROOT=missing).returncode, 1)
        r = subprocess.run([os.path.join(plain, 'tools', 'monitor', 'trace-hook.sh')], input=json.dumps(hook),
                           capture_output=True, text=True, cwd='/', env=clean_env(BRIDLE_MAIN_ROOT=missing))
        self.assertEqual((r.returncode, r.stdout, r.stderr), (0, '', ''))
        lines = jsonl(os.path.join(plain, '.bridle', 'progress', 'lane-tr', 'tracer.trace.jsonl'))
        self.assertEqual([(l['tool'], l['id']) for l in lines], [('Bash', 'toolu_fb')])
        self.assertFalse(os.path.exists(missing))


class RuleSentenceTests(unittest.TestCase):
    """Criterion 2, last sentence: the rule for finding the main checkout is one sentence, the same words in log.sh's
    header, factory/README.md and tools/monitor/README.md; card.py's and trace-hook.sh's headers name log.sh's header."""

    @staticmethod
    def flat(path, comment=False):
        with open(path, encoding='utf-8') as f:
            lines = f.read().split('\n')
        if comment:
            lines = [re.sub(r'^#\s?', '', l) for l in lines if l.startswith('#')]
        return ' '.join(' '.join(lines).replace('`', '').split())

    def test_rule_sentence(self):
        self.assertIn(RULE, self.flat(os.path.join(TOOLS, 'log.sh'), comment=True))
        self.assertIn(RULE, self.flat(os.path.join(REPO, 'factory', 'README.md')))
        self.assertIn(RULE, self.flat(os.path.join(TOOLS, 'README.md')))
        with open(CARD, encoding='utf-8') as f:
            doc = ' '.join(f.read().split('"""')[1].split())
        self.assertIn('the rule for finding the main checkout is in the header of log.sh', doc)
        self.assertIn('Cards are read and written in the checkout that holds this script', doc)
        self.assertIn('the rule is in the header of log.sh', self.flat(os.path.join(TOOLS, 'trace-hook.sh'), comment=True))


class MoveLineTests(unittest.TestCase):
    """Rework loop 2 (P0-08.1): what `move` checks before its write on a card without gates (N), with every gate ticked
    (T) and with an open gate (M): the new text is read back, and one argument is one line."""
    CARDS = {'N': None, 'T': 'manualGates: [[x] One, [x] Two]', 'M': 'manualGates: [One, [x] Two]'}

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bridle-move-line-')
        self.root = os.path.join(self.tmp, 'R')
        make_root(self.root, {cid: gate_card(cid, gates) for cid, gates in self.CARDS.items()})
        self.before = {cid: read_bytes(card_file(self.root, cid)) for cid in self.CARDS}

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def card(self, *args):
        return run_card(self.root, *args)

    def assert_nothing_written(self, why):
        for cid, data in self.before.items():
            self.assertEqual(read_bytes(card_file(self.root, cid)), data, (cid, why))
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')), why)

    def test_unreadable_text_is_never_written(self):
        """The finding of the second test pass: a new text `parse` refuses exits 1 before the write on a card without
        gates and on one with every gate ticked, as it did with an open gate; the board is still readable afterwards."""
        for cid in self.CARDS:
            for station in ('test', 'backlog', 'review'):
                for flag in ('--status', '--agent'):
                    r = self.card('move', cid, station, flag, 'running\n  manualGates: [X]')
                    self.assertEqual((r.returncode, r.stdout), (1, ''), (cid, station, flag, r.stderr))
                    self.assertIn("is not a manual gates line card.py reads: 'manualGates: [X]'\n", r.stderr, (cid, station, flag))
                    self.assert_nothing_written((cid, station, flag))
        # At ship: the same on the cards that may ship; the open gate of M is exit 3 or 1, and nothing is written either way.
        for cid in ('N', 'T'):
            r = self.card('move', cid, 'ship', '--status', 'done\nmanualGates : [X]')
            self.assertEqual((r.returncode, r.stdout), (1, ''), (cid, r.stderr))
        self.assertIn(self.card('move', 'M', 'ship', '--status', 'done\nmanualGates : [X]').returncode, (1, 3))
        self.assert_nothing_written('ship')
        for args in (('list',), ('status',), ('sync-ops',), ('gates', 'N'), ('gates', 'T')):
            r = self.card(*args)
            self.assertEqual((r.returncode, r.stderr), (0, ''), args)
        self.assertEqual(self.card('gates', 'M').returncode, 3)
        self.assert_nothing_written('reads')

    def test_line_break_in_an_argument_is_refused(self):
        """Foreman's addition (observation 2 of the second test pass): a newline or carriage return in --status, --agent
        or --from, and a carriage return in --note, is a usage error (exit 2): nothing written, no event. A newline in
        --note is written as a space, as before."""
        one_line = 'holds a newline or a carriage return: nothing moved; give it on one line\n'
        for cid in self.CARDS:
            for flag, values in (('--status', ('done\nstatus: running', 'running\rstatus: done', 'running\r\nlane: x', 'blocked\n', '\rrunning')),
                                 ('--agent', ('x\nlane: y', 'x\rstatus: done', 'x\r\ny', 'x\n')),
                                 ('--from', ('build\nx', 'build\rx', '\n'))):
                for value in values:
                    r = self.card('move', cid, 'test', flag, value)
                    self.assertEqual((r.returncode, r.stdout), (2, ''), (cid, flag, value, r.stderr))
                    self.assertEqual(r.stderr, f'card.py move: {flag} {one_line}', (cid, flag, value))
                    self.assert_nothing_written((cid, flag, value))
            for value in ('x\rstatus: done\ry', 'x\r\nstatus: done\r\ny', 'x\rmanualGates : [A]\ry', 'x\r'):
                r = self.card('move', cid, 'test', '--note', value)
                self.assertEqual((r.returncode, r.stdout), (2, ''), (cid, value, r.stderr))
                self.assertEqual(r.stderr, 'card.py move: --note holds a carriage return: nothing moved; give it on one line\n')
                self.assert_nothing_written((cid, '--note', value))
            # With other arguments in order, and at the stations a card of this kind may reach.
            for station in ('backlog', 'review') + (() if cid == 'M' else ('ship',)):
                r = self.card('move', cid, station, '--status', 'running', '--agent', 'a\nb', '--note', 'n', '--from', 'build')
                self.assertEqual((r.returncode, r.stdout), (2, ''), (cid, station, r.stderr))
                self.assert_nothing_written((cid, station))
        # The gate refusal (exit 3) comes first where both apply; nothing is written either way.
        r = self.card('move', 'M', 'ship', '--agent', 'a\nb')
        self.assertEqual(r.returncode, 3, r.stderr)
        self.assert_nothing_written('ship with an open gate')
        # A newline in --note is one history line with a space; the card reads as before, with one status line.
        for cid in self.CARDS:
            r = self.card('move', cid, 'test', '--note', 'x\nstatus: done\ny')
            self.assertEqual(r.returncode, 0, (cid, r.stderr))
            lines = read_bytes(card_file(self.root, cid)).decode('utf-8').split('\n')
            self.assertEqual([l for l in lines if l.startswith('status:')], ['status: running'], cid)
            self.assertRegex([l for l in lines if l.startswith('  - ')][-1], r'^  - \S+Z test running factory-tester "x status: done y"$')
            self.assertEqual(json.loads(r.stdout)['data']['message'], 'x\nstatus: done\ny')
        # A refusal after an event exists adds no line to it and changes no card.
        events = os.path.join(self.root, '.bridle', 'progress', 'factory', 'factory-tester.jsonl')
        cards = {cid: read_bytes(card_file(self.root, cid)) for cid in self.CARDS}
        self.assertEqual(len(jsonl(events)), 3)
        for cid in self.CARDS:
            for args in (('--status', 'running\nx: y'), ('--note', 'a\rb'), ('--from', 'test\n')):
                self.assertEqual(self.card('move', cid, 'test', *args).returncode, 2, (cid, args))
        self.assertEqual(len(jsonl(events)), 3)
        self.assertEqual({cid: read_bytes(card_file(self.root, cid)) for cid in self.CARDS}, cards)
        self.assertEqual(self.card('list').returncode, 0)


class WriterGuardTests(unittest.TestCase):
    """Rework loop 2, addendum (P0-08.1): `gate` and `new` refuse a line break in what they write and read their new
    text back before the write, as `move` does. O has one open gate, M two, D two with one ticked."""
    CARDS = {'O': 'manualGates: [One]', 'M': 'manualGates: [One, Three]', 'D': 'manualGates: [[x] One, Three]', 'N': None}

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bridle-writer-')
        self.root = os.path.join(self.tmp, 'R')
        make_root(self.root, {cid: gate_card(cid, gates) for cid, gates in self.CARDS.items()})
        self.cards = os.path.join(self.root, 'factory', 'cards')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def card(self, *args):
        return run_card(self.root, *args)

    def snapshot(self):
        return {name: read_bytes(os.path.join(self.cards, name)) for name in sorted(os.listdir(self.cards))}

    def front(self, cid):
        return read_bytes(card_file(self.root, cid)).decode('utf-8').split('\n---\n')[0].split('\n')

    def test_gate_line_breaks_refused(self):
        before = self.snapshot()
        line = 'holds a newline or a carriage return: nothing written; give it on one line\n'
        for cid, gate in (('O', '1'), ('M', '1'), ('M', 'Three'), ('D', 'Three')):
            for evidence in ('x\rstatus: done\ry', 'x\nstatus: done\ny', 'x\r\nstatus: done\r\ny', 'x\rstation: ship\ry',
                             'x\rmanualGates: [[x] One, [x] Three]\ry', 'docs/x.pdf\n', '\rx'):
                r = self.card('gate', cid, gate, '--by', 'owner', '--evidence', evidence)
                self.assertEqual((r.returncode, r.stdout, r.stderr), (2, '', f'card.py gate: --evidence {line}'), (cid, gate, evidence))
                self.assertEqual(self.snapshot(), before, (cid, gate, evidence))
            for bad in (gate + '\n', gate + '\r', 'One\nx', '\r' + gate):
                r = self.card('gate', cid, bad, '--by', 'owner')
                self.assertEqual((r.returncode, r.stdout, r.stderr), (2, '', f'card.py gate: <gate> {line}'), (cid, bad))
                self.assertEqual(self.snapshot(), before, (cid, bad))
            for by in ('a\nb', 'a\r', '\rowner'):
                r = self.card('gate', cid, gate, '--by', by)
                self.assertEqual((r.returncode, r.stdout), (1, ''), (cid, by))
                self.assertIn('--by must be one word', r.stderr)
                self.assertEqual(self.snapshot(), before, (cid, by))
        for cid, want in (('O', 0), ('M', 3), ('D', 3)):       # nothing reads as done or ticked after the refusals
            self.assertEqual(self.card('gates', cid).returncode, 3, cid)
            self.assertIn('status: running', self.front(cid))
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))
        # An ordinary tick still works: the station and status the card had, exactly one more gate ticked.
        for cid, gate, gates_line, rc in (('O', '1', 'manualGates: [[x] One]', 0), ('M', 'Three', 'manualGates: [One, [x] Three]', 3),
                                          ('D', 'Three', 'manualGates: [[x] One, [x] Three]', 0)):
            r = self.card('gate', cid, gate, '--by', 'owner', '--evidence', 'docs/x y.pdf: [1]')
            self.assertEqual((r.returncode, r.stdout), (0, f'ticked: {"One" if cid == "O" else "Three"}\n'), (cid, r.stderr))
            front = self.front(cid)
            self.assertIn(gates_line, front)
            self.assertEqual([l for l in front if l.startswith(('station:', 'status:'))], ['station: review', 'status: running'], cid)
            self.assertEqual(len([l for l in front if l.startswith('  - ')]), 1, cid)
            self.assertEqual(self.card('gates', cid).returncode, rc, cid)
        self.assertEqual(self.snapshot()[os.path.basename(card_file(self.root, 'N'))], before[os.path.basename(card_file(self.root, 'N'))])
        self.assertEqual(self.card('list').returncode, 0)

    def test_new_line_breaks_refused(self):
        before = self.snapshot()
        base = {'<id>': 'X1', '<title>': 'Title', '--phase': 'P9', '--deps': 'A,B', '--estimate': '0.5'}
        def new(values, order='5'):
            return self.card('new', values['<id>'], values['<title>'], '--phase', values['--phase'], '--order', order,
                             '--deps', values['--deps'], '--estimate', values['--estimate'])
        for flag in base:
            for tail in ('\nmanualGates: [[x] A]', '\rstatus: done', '\r\nstation: ship', '\n', '\r'):
                for value in (base[flag] + tail, tail + base[flag]):
                    r = new(dict(base, **{flag: value}))
                    self.assertEqual((r.returncode, r.stdout), (2, ''), (flag, value, r.stderr))
                    self.assertEqual(r.stderr, f'card.py new: {flag} holds a newline or a carriage return: nothing written; give it on one line\n')
                    self.assertEqual(self.snapshot(), before, (flag, value))
        # --order is an int by argparse: text after a line break is a usage error, a bare trailing newline is the number.
        r = new(base, order='5\nstatus: done')
        self.assertEqual((r.returncode, r.stdout), (2, ''), r.stderr)
        self.assertEqual(self.snapshot(), before)
        r = new(base, order='5\n')
        self.assertEqual(r.returncode, 0, r.stderr)
        path = os.path.join(self.cards, 'X1-title.md')
        self.assertEqual(sorted(set(self.snapshot()) - set(before)), ['X1-title.md'])
        front = read_bytes(path).decode('utf-8').split('\n---\n')[0].split('\n')[1:]
        self.assertEqual([l.split(':')[0] for l in front],
                         ['id', 'title', 'phase', 'order', 'dependsOn', 'estimate', 'station', 'status', 'owner', 'updated', 'history'])
        for want in ('id: X1', 'title: Title', 'phase: P9', 'order: 5', 'dependsOn: [A, B]', 'estimate: 0.5', 'station: backlog', 'status: planned'):
            self.assertIn(want, front)
        self.assertEqual(json.loads(r.stdout)['data'], {'id': 'X1', 'title': 'Title', 'phase': 'P9', 'order': 5, 'dependsOn': ['A', 'B'],
                                                        'estimate': '0.5', 'workstream': 'factory'})
        self.assertEqual(self.card('gates', 'X1').stdout, 'no manual gates\n')
        self.assertEqual(self.card('list').returncode, 0)
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))

    def test_read_back_before_each_write(self):
        """No argument without a line break is known to make a wrong text, so the writer is made wrong here: card.py is
        loaded in this process and its `dump` replaced. `gate`, `new` and `move` then exit with an error before the
        write; with the real `dump` the same calls write."""
        import argparse
        import contextlib
        import importlib.util
        import io
        spec = importlib.util.spec_from_file_location('card_in_test', os.path.join(self.root, 'tools', 'monitor', 'card.py'))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        real = mod.dump
        ns = argparse.Namespace

        def run(f, args, wrong=None):
            mod.dump = (lambda meta, body: wrong(real(meta, body))) if wrong else real
            out = io.StringIO()
            try:
                with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                    f(args)
                return 0, out.getvalue()
            except SystemExit as e:
                return e.code, out.getvalue()
            finally:
                mod.dump = real

        before = self.snapshot()
        m = read_bytes(card_file(self.root, 'M')).decode('utf-8')
        gate = ns(id='M', gate='One', by='owner', evidence='')
        for name, wrong, fields in (('done', lambda t: t.replace('\nstatus: running\n', '\nstatus: done\n'), 'status'),
                                    ('station', lambda t: t.replace('\nstation: review\n', '\nstation: ship\n'), 'station'),
                                    ('both gates', lambda t: t.replace('[[x] One, Three]', '[[x] One, [x] Three]'), 'gates'),
                                    ('no tick', lambda t: t.replace('[[x] One, Three]', '[One, Three]'), 'gates'),
                                    ('other gate', lambda t: t.replace('[[x] One, Three]', '[One, [x] Three]'), 'gates'),
                                    ('gate lost', lambda t: t.replace('[[x] One, Three]', '[[x] One]'), 'gates'),
                                    ('all', lambda t: m.replace('status: running', 'status: done').replace('station: review', 'station: ship'),
                                     'station, status, gates')):
            code, _ = run(mod.cmd_gate, gate, wrong)
            self.assertEqual(code, f'card.py gate: the new card text would not read back as intended ({fields}); nothing written', name)
            self.assertEqual(self.snapshot(), before, name)
        code, _ = run(mod.cmd_gate, gate, lambda t: t.replace('\nmanualGates:', '\n  manualGates: []\nmanualGates:'))
        self.assertIn('is not a manual gates line card.py reads', str(code))
        self.assertEqual(self.snapshot(), before)
        new = ns(id='X2', title='Title', phase='P9', order=5, deps='', estimate='', placeholder=False, no_op=True)
        for name, wrong, fields in (('gates', lambda t: t.replace('\nhistory:\n', '\nhistory:\nmanualGates: [[x] A]\n'), 'keys, gates'),
                                    ('key', lambda t: t.replace('\nhistory:\n', '\nhistory:\nlane: x\n'), 'keys'),
                                    ('done', lambda t: t.replace('\nstatus: planned\n', '\nstatus: done\n'), 'status'),
                                    ('station', lambda t: t.replace('\nstation: backlog\n', '\nstation: ship\n'), 'station')):
            code, _ = run(mod.cmd_new, new, wrong)
            self.assertEqual(code, f'card.py new: the new card text would not read back as intended ({fields}); nothing written', name)
            self.assertEqual(self.snapshot(), before, name)
        move = ns(id='N', station='test', status=None, agent=None, note=None, run='factory', from_station=None)
        code, _ = run(mod.cmd_move, move, lambda t: t.replace('\nhistory:\n', '\nhistory:\n  manualGates: [A]\n'))
        self.assertIn('is not a manual gates line card.py reads', str(code))
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))
        # The same calls with the real dump write.
        for f, args, last in ((mod.cmd_gate, gate, 'ticked: One\n'), (mod.cmd_new, new, 'factory/cards/X2-title.md\n')):
            code, out = run(f, args)       # `out` may also hold this process's ResourceWarning for card.py's open().write()
            self.assertEqual((code, out.endswith(last)), (0, True), out)
        self.assertEqual(run(mod.cmd_move, move)[0], 0)
        after = self.snapshot()
        self.assertEqual(sorted(n for n in after if after[n] != before.get(n)), ['M-card-m.md', 'N-card-n.md', 'X2-title.md'])
        self.assertIn('manualGates: [[x] One, Three]', self.front('M'))
        self.assertIn('station: test', self.front('N'))


    # Rework loop 3: a text the card file cannot hold, and a write that fails.

    def load_card_py(self):
        """card.py of the temporary root as a module of this process (as in test_read_back_before_each_write)."""
        import importlib.util
        spec = importlib.util.spec_from_file_location('card_in_test3', os.path.join(self.root, 'tools', 'monitor', 'card.py'))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_argument_that_is_not_utf8_writes_nothing(self):
        """An argument holding a byte that is not UTF-8 (given as bytes, as a shell gives it) exits 1 with one line:
        no card changed, emptied or created, no event; `list` still reads every card."""
        before = self.snapshot()
        bad = b'a\xffb'
        def raw(*args):
            argv = [os.fsencode(sys.executable), os.fsencode(os.path.join(self.root, 'tools', 'monitor', 'card.py'))]
            argv += [a if isinstance(a, bytes) else a.encode() for a in args]
            return subprocess.run(argv, capture_output=True, cwd=self.root, env=clean_env())
        for args in (('gate', 'M', '1', '--by', 'owner', '--evidence', bad), ('gate', 'M', '1', '--by', bad),
                     ('new', 'X9', bad, '--phase', 'P9', '--order', '5'), ('new', 'X9', 'Title', '--phase', bad, '--order', '5'),
                     ('move', 'N', 'test', '--note', bad), ('move', 'N', 'test', '--agent', bad), ('move', 'M', 'test', '--status', bad)):
            r = raw(*args)
            self.assertEqual((r.returncode, r.stdout, r.stderr),
                             (1, b'', f'card.py {args[0]}: an argument is not valid UTF-8; nothing written\n'.encode()), args)
            self.assertEqual(self.snapshot(), before, args)
            self.assertEqual(self.card('list').returncode, 0, args)
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))
        # The same arguments as UTF-8 beyond ASCII are written.
        for args, want in ((('gate', 'M', '1', '--by', 'ownér', '--evidence', 'é — x'), 'ownér "gate ticked: One; evidence: é — x"'),
                           (('move', 'N', 'test', '--note', 'é — x', '--agent', 'ownér'), 'ownér "é — x"')):
            r = self.card(*args)
            self.assertEqual(r.returncode, 0, (args, r.stderr))
            self.assertEqual(len([l for l in self.front(args[1]) if l.endswith(want)]), 1, self.front(args[1]))
        self.assertEqual(self.card('new', 'X9', 'Tïtle', '--phase', 'P9é', '--order', '5').returncode, 0)
        self.assertEqual(sorted(set(self.snapshot()) - set(before)), ['X9-t-tle.md'])
        self.assertIn('title: Tïtle', read_bytes(os.path.join(self.cards, 'X9-t-tle.md')).decode('utf-8').split('\n'))

    def test_failed_write_leaves_the_card_and_no_temporary_file(self):
        """The write goes to a temporary file beside the card and is renamed over it. When a step of that fails (half the
        bytes written, the sync, the mode, the rename, an interrupt; then a cards directory that takes no new file), every
        card is byte-identical, the directory holds no other file and no event is sent. `status --write` is tried with
        a directory that takes no new file only."""
        import argparse
        import contextlib
        import errno
        import io
        from unittest import mock
        mod = self.load_card_py()
        ns = argparse.Namespace
        full = OSError(errno.ENOSPC, 'No space left on device')
        real_fdopen = os.fdopen
        reached = []

        def half(fd, *a, **k):
            f = real_fdopen(fd, *a, **k)
            class Half:
                def __enter__(self): return self
                def __exit__(self, *exc): f.close(); return False
                def write(self, data):
                    f.write(data[:len(data) // 2]); f.flush()
                    reached.append(len(data))
                    raise full
            return Half()

        def fail(*a, **k):
            reached.append(1)
            raise full

        def stop(*a, **k):
            reached.append(1)
            raise KeyboardInterrupt

        def run(f, args):
            out = io.StringIO()
            try:
                with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                    f(args)
                return 0
            except SystemExit as e:
                return e.code
            except KeyboardInterrupt:
                return 'interrupt'

        before = self.snapshot()
        calls = ((mod.cmd_gate, ns(id='M', gate='One', by='owner', evidence=''), 'M-card-m.md'),
                 (mod.cmd_new, ns(id='X3', title='Title', phase='P9', order=5, deps='', estimate='', placeholder=False, no_op=True), 'X3-title.md'),
                 (mod.cmd_move, ns(id='N', station='test', status=None, agent=None, note=None, run='factory', from_station=None), 'N-card-n.md'))
        for step, target, hook in (('half the bytes', 'fdopen', half), ('sync', 'fsync', fail), ('mode', 'chmod', fail),
                                   ('rename', 'replace', fail), ('interrupt', 'replace', stop)):
            for f, args, name in calls:
                del reached[:]
                with mock.patch.object(mod.os, target, hook):
                    code = run(f, args)
                self.assertEqual(len(reached), 1, (step, name))                  # the step was reached, once
                self.assertEqual(self.snapshot(), before, (step, name))          # same names, same bytes: no temporary file
                if step == 'interrupt':
                    self.assertEqual(code, 'interrupt', name)
                else:
                    self.assertEqual(code, f'card.py: could not write {os.path.join(self.cards, name)} (No space left on device); nothing written',
                                     (step, name))
        self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))
        self.assertEqual(self.card('list').returncode, 0)
        # The command line, with a cards directory that takes no new file: one line, exit 1, nothing changed.
        cli = (('gate', 'M', '1', '--by', 'owner'), ('new', 'X3', 'Title', '--phase', 'P9', '--order', '5'), ('move', 'N', 'test'))
        if os.geteuid() != 0:   # root writes into a read-only directory
            os.chmod(self.cards, 0o555)
            try:
                for args in cli:
                    r = self.card(*args)
                    self.assertEqual((r.returncode, r.stdout), (1, ''), (args, r.stderr))
                    self.assertRegex(r.stderr, r'\Acard\.py: could not write \S+\.md \(Permission denied\); nothing written\n\Z')
                    self.assertEqual(self.snapshot(), before, args)
            finally:
                os.chmod(self.cards, 0o755)
            self.assertFalse(os.path.exists(os.path.join(self.root, '.bridle')))
            # `status --write` with a directory that takes no new file: the progress file is as it was.
            docs = os.path.join(self.tmp, 'docs')
            os.makedirs(docs)
            progress = os.path.join(docs, 'progress.md')
            with open(progress, 'w', encoding='utf-8') as f:
                f.write(ABOVE + '<!-- board:start -->\nstale\n<!-- board:end -->' + BELOW)
            stale = read_bytes(progress)
            os.chmod(docs, 0o555)
            try:
                r = self.card('status', '--cards', self.cards, '--write', progress)
            finally:
                os.chmod(docs, 0o755)
            self.assertEqual((r.returncode, r.stdout, r.stderr),
                             (1, '', f'card.py: could not write {progress} (Permission denied); nothing written\n'))
            self.assertEqual((read_bytes(progress), os.listdir(docs)), (stale, ['progress.md']))
        # The same calls then write, and leave nothing but the cards.
        for args in cli:
            r = self.card(*args)
            self.assertEqual(r.returncode, 0, (args, r.stderr))
        after = self.snapshot()
        self.assertEqual(sorted(after), sorted(list(before) + ['X3-title.md']))
        self.assertEqual(sorted(n for n in before if after[n] != before[n]), ['M-card-m.md', 'N-card-n.md'])
        self.assertIn('manualGates: [[x] One, Three]', self.front('M'))
        self.assertIn('station: test', self.front('N'))
        self.assertEqual(len(jsonl(os.path.join(self.root, '.bridle', 'progress', 'factory', 'factory-tester.jsonl'))), 1)

    def test_write_keeps_the_mode_and_follows_a_link(self):
        """A written card keeps the mode it had, a new card gets the mode open() gives a new file, a card that is a
        symbolic link stays one and its target is written, `status --write` keeps the mode of the progress file; no
        other file appears beside any of them."""
        def mode(path):
            return os.stat(path).st_mode & 0o7777
        plain = os.path.join(self.tmp, 'plain')
        with open(plain, 'w', encoding='utf-8') as f:
            f.write('x')
        elsewhere = os.path.join(self.tmp, 'elsewhere', 'o.md')
        os.makedirs(os.path.dirname(elsewhere))
        os.rename(card_file(self.root, 'O'), elsewhere)
        os.symlink(elsewhere, card_file(self.root, 'O'))
        progress = os.path.join(self.tmp, 'elsewhere', 'progress.md')
        with open(progress, 'w', encoding='utf-8') as f:
            f.write(ABOVE + '<!-- board:start -->\n<!-- board:end -->' + BELOW)
        os.chmod(card_file(self.root, 'N'), 0o640)
        os.chmod(card_file(self.root, 'M'), 0o600)
        os.chmod(elsewhere, 0o664)
        os.chmod(progress, 0o604)
        names = sorted(os.listdir(self.cards))
        for args in (('move', 'N', 'test'), ('move', 'N', 'review', '--note', 'back'), ('gate', 'M', '1', '--by', 'owner'),
                     ('move', 'O', 'test'), ('new', 'X4', 'Title', '--phase', 'P9', '--order', '5'),
                     ('status', '--cards', self.cards, '--write', progress)):
            r = self.card(*args)
            self.assertEqual(r.returncode, 0, (args, r.stderr))
        self.assertEqual(sorted(os.listdir(self.cards)), sorted(names + ['X4-title.md']))
        self.assertEqual(sorted(os.listdir(os.path.dirname(elsewhere))), ['o.md', 'progress.md'])
        self.assertEqual([mode(card_file(self.root, 'N')), mode(card_file(self.root, 'M')), mode(elsewhere), mode(progress)],
                         [0o640, 0o600, 0o664, 0o604])
        self.assertEqual(mode(os.path.join(self.cards, 'X4-title.md')), mode(plain))
        self.assertTrue(os.path.islink(card_file(self.root, 'O')))
        self.assertIn('station: test', read_bytes(elsewhere).decode('utf-8').split('\n'))
        self.assertIn('station: review', self.front('N'))
        self.assertIn('manualGates: [[x] One, Three]', self.front('M'))
        self.assertIn('| X4 | P9 | backlog | planned | - |', read_bytes(progress).decode('utf-8'))
        self.assertTrue(read_bytes(progress).decode('utf-8').endswith(BELOW))


class LaneKeyTests(unittest.TestCase):
    """P0-08.2, criterion 4: the lane a card runs in is the frontmatter line `lane:`, written by `move --lane`; a second
    card does not start in a lane whose card is at a station from plan to review."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bridle-lanekey-')
        self.root = os.path.join(self.tmp, 'R')
        make_root(self.root, {'A': gate_card('A'), 'B': gate_card('B'), 'G': gate_card('G', G_LINE)})
        self.lanes = os.path.join(self.root, 'factory', 'lanes.json')
        shutil.copy(os.path.join(REPO, 'factory', 'lanes.json'), self.lanes)
        self.progress = os.path.join(self.root, '.bridle', 'progress')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def card(self, *args):
        return run_card(self.root, *args)

    def front(self, cid):
        return read_bytes(card_file(self.root, cid)).decode('utf-8').split('\n---\n')[0].split('\n')

    def events(self):
        n = 0
        for d, _, names in os.walk(self.progress):
            n += sum(len(jsonl(os.path.join(d, name))) for name in names)
        return n

    def refused(self, code, *args, says=()):
        """Run a move that must be refused with `code`: the three cards and the event count stay as they were."""
        before = {c: read_bytes(card_file(self.root, c)) for c in 'ABG'}
        events = self.events()
        r = self.card(*args)
        self.assertEqual(r.returncode, code, (args, r.stderr))
        for s in says:
            self.assertIn(s, r.stderr)
        self.assertEqual({c: read_bytes(card_file(self.root, c)) for c in 'ABG'}, before, args)
        self.assertEqual(self.events(), events, args)
        self.assertEqual(sorted(os.listdir(os.path.join(self.root, 'factory', 'cards'))),
                         ['A-card-a.md', 'B-card-b.md', 'G-card-g.md'])
        return r

    def test_lane_written_kept_and_listed(self):
        r = self.card('move', 'A', 'plan', '--lane', 'core')
        self.assertEqual(r.returncode, 0, r.stderr)
        front = self.front('A')
        self.assertEqual(front[front.index('owner: factory-planner') + 1], 'lane: core')
        self.assertLess(front.index('lane: core'), front.index('history:'))
        self.assertEqual(front.count('lane: core'), 1)
        r = self.card('move', 'A', 'build')  # the card itself moves on in its lane; no --lane keeps the line
        self.assertEqual(r.returncode, 0, r.stderr)
        front = self.front('A')
        self.assertEqual(front[front.index('owner: factory-builder') + 1], 'lane: core')
        before = read_bytes(card_file(self.root, 'A'))
        events = self.events()
        r = self.card('lane', 'core')
        self.assertEqual((r.returncode, r.stdout, r.stderr), (0, 'A build running\n', ''))
        r = self.card('lane', 'core', '--cards', os.path.join(self.root, 'factory', 'cards'))
        self.assertEqual((r.returncode, r.stdout), (0, 'A build running\n'))
        r = self.card('lane', 'web')
        self.assertEqual((r.returncode, r.stdout, r.stderr), (0, '', ''))
        self.assertEqual(read_bytes(card_file(self.root, 'A')), before)
        self.assertEqual(self.events(), events)
        r = self.card('move', 'A', 'test', '--lane', 'web')  # --lane on a card that has one replaces it
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual([l for l in self.front('A') if l.startswith('lane:')], ['lane: web'])
        self.assertEqual(self.card('lane', 'core').stdout, '')

    def test_second_card_in_a_lane_refused(self):
        self.assertEqual(self.card('move', 'A', 'plan', '--lane', 'core').returncode, 0)
        for station in ('plan', 'build', 'test', 'review'):
            r = self.card('move', 'A', station)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.refused(1, 'move', 'B', 'plan', '--lane', 'core',
                         says=('lane core already has a card in flight', f'A at {station} (running)', 'nothing moved'))
        self.assertEqual(self.card('move', 'A', 'build', '--status', 'blocked').returncode, 0)
        self.refused(1, 'move', 'B', 'build', '--lane', 'core', says=('A at build (blocked)',))
        r = self.card('move', 'B', 'plan', '--lane', 'web')  # another lane is free
        self.assertEqual(r.returncode, 0, r.stderr)
        r = self.card('move', 'B', 'spec', '--lane', 'core')  # spec is not a station that holds a lane
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('lane: core', self.front('B'))
        self.refused(1, 'move', 'B', 'build', says=('A at build (blocked)',))  # the lane recorded on B is checked
        self.assertEqual(self.card('move', 'A', 'ship').returncode, 0)
        self.assertIn('lane: core', self.front('A'))
        r = self.card('move', 'B', 'plan')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.card('lane', 'core').stdout, 'B plan running\n')

    def test_lane_values_refused(self):
        self.refused(2, 'move', 'A', 'plan', '--lane', 'nosuch', says=('--lane nosuch is not a lane', 'core, web, platform', 'nothing moved'))
        for value in ('co\nre', 'core\r', 'core\nstatus: done', ' core', '12', 'true', '[core]', ''):
            r = self.refused(1 if value != '' else 2, 'move', 'A', 'plan', '--lane', value)
            self.assertIn('nothing', r.stderr, value)
        # An open gate is refused with 3 before the lane name is looked at.
        self.refused(3, 'move', 'G', 'ship', '--lane', 'nosuch')
        os.rename(self.lanes, self.lanes + '.away')
        self.refused(1, 'move', 'A', 'plan', '--lane', 'core', says=('could not read the lanes of',))
        with open(self.lanes, 'w', encoding='utf-8') as f:
            f.write('{"lanes": "core"}')
        self.refused(1, 'move', 'A', 'plan', '--lane', 'core', says=('could not read the lanes of',))
        r = self.card('move', 'A', 'plan')  # a move without --lane does not read the file
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual([l for l in self.front('A') if l.startswith('lane')], [])

    def test_gates_and_bytes_hold_with_a_lane(self):
        """Added at the test station (P0-08.2): with `--lane` in play an open manual gate still refuses ship and done
        (exit 3), a `--lane` value with a line break or a byte that is not UTF-8 writes nothing, and a card that returns
        to backlog gives its lane up."""
        for lane in ('core', 'web', 'platform'):
            self.refused(3, 'move', 'G', 'ship', '--lane', lane)
            self.refused(3, 'move', 'G', 'ship', '--status', 'done', '--lane', lane)
            self.refused(3, 'move', 'G', 'review', '--status', 'done', '--lane', lane)
        for value in ('core\nmanualGates: []', 'core\nstatus: planned', 'co\rre', ''):
            before = {c: read_bytes(card_file(self.root, c)) for c in 'ABG'}
            for target in (('ship',), ('review', '--status', 'done')):
                r = self.card('move', 'G', *target, '--lane', value)
                self.assertNotEqual(r.returncode, 0, (value, target))
                self.assertEqual({c: read_bytes(card_file(self.root, c)) for c in 'ABG'}, before, (value, target))
        r = self.card('move', 'G', 'plan', '--lane', 'core')  # a lane on the gated card, at a station that is not ship
        self.assertEqual(r.returncode, 0, r.stderr)
        self.refused(3, 'move', 'G', 'ship')
        self.refused(3, 'move', 'G', 'test', '--status', 'done')
        before = {c: read_bytes(card_file(self.root, c)) for c in 'ABG'}
        events = self.events()
        for bad in (b'co\xffre', b'\xff'):
            argv = [os.fsencode(sys.executable), os.fsencode(os.path.join(self.root, 'tools', 'monitor', 'card.py')),
                    b'move', b'A', b'spec', b'--lane', bad]
            r = subprocess.run(argv, capture_output=True, cwd=self.root, env=clean_env())
            self.assertEqual((r.returncode, r.stdout), (1, b''), bad)
            self.assertEqual({c: read_bytes(card_file(self.root, c)) for c in 'ABG'}, before, bad)
        self.assertEqual(self.events(), events)
        self.refused(1, 'move', 'A', 'plan', '--lane', 'core', says=('G at plan (running)',))
        self.assertEqual(self.card('move', 'G', 'backlog').returncode, 0)
        self.assertIn('lane: core', self.front('G'))
        r = self.card('move', 'A', 'plan', '--lane', 'core')  # the lane is free once its card is back at backlog
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.card('lane', 'core').stdout, 'A plan running\n')


if __name__ == '__main__':
    unittest.main()
