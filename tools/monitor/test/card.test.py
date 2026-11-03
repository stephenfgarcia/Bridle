#!/usr/bin/env python3
"""Tests for `tools/monitor/card.py status` (factory card P0-11). Run: python3 tools/monitor/test/card.test.py

card.py is run as a subprocess, exactly as documented, with --cards pointing at a temporary directory of three
cards written in dump()'s frontmatter shape; nothing under factory/cards or .bridle is read or written.
"""
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


if __name__ == '__main__':
    unittest.main()
