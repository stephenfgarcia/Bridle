#!/usr/bin/env python3
"""Tests for tools/monitor/check.py, the monitor JSONL validator (factory card P0-04).

Run from anywhere:  python3 tools/monitor/test/check.test.py
(unittest, standard library only; the dotted file name cannot be imported, so the file is run)

One test per acceptance criterion of the card, named in each test's docstring. The validator is run as a
subprocess exactly as documented, pointed with --root at a temporary tree (tempfile.TemporaryDirectory,
removed after each test); .bridle/progress is never read and nothing is written inside the repository. The
subprocess runs with the temporary root as its cwd, so printed paths are exactly `<runId>/<agentId>.jsonl`
and every output line is asserted whole; only the JSON decoder's message (`not JSON: ...`) is asserted by
prefix, because its wording belongs to Python.
"""
import ast
import contextlib
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
CHECK = os.path.normpath(os.path.join(HERE, '..', 'check.py'))
BASE = 1_700_000_000_000  # tsMs of 2023-11-14T22:13:20Z; fixtures count up from here
OMIT = object()           # mk(field=OMIT) leaves that field out of the event
# For a Python without sys.stdlib_module_names (< 3.10): the modules check.py may import.
STDLIB_FALLBACK = frozenset({'argparse', 'datetime', 'json', 'os', 're', 'sys', 'math', 'time', 'io', 'pathlib'})


def iso(ms):
    """`ts` as log.sh writes it: the whole seconds of tsMs, %Y-%m-%dT%H:%M:%SZ in UTC."""
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ms // 1000))


assert iso(BASE) == '2023-11-14T22:13:20Z', iso(BASE)  # the fixture clock is anchored before any test runs


def mk(ms, agent, seq, **fields):
    """A valid event exactly as log.sh writes it (same keys, same order, id last).

    **fields override or add keys (OMIT drops one; seq=OMIT drops `seq`, then give id=). The id is computed
    from the given tsMs/agent/seq, so overriding `ts` fails only the ts rule and overriding `id` only the id rule.
    """
    ev = {'ts': iso(ms), 'tsMs': ms, 'seq': seq, 'runId': 'r', 'phase': 'P0', 'taskId': 'T',
          'agentId': agent, 'agentLabel': agent, 'type': 'agent.log', 'level': 'info', 'message': 'hello'}
    if seq is OMIT:
        del ev['seq']
    for key, value in fields.items():
        if value is OMIT:
            ev.pop(key, None)
        else:
            ev[key] = value
    if 'id' not in fields:
        assert seq is not OMIT, 'mk: give id= when seq is OMIT'
        ev['id'] = f'{ms}-{agent}-{seq:04d}'
    return ev


def backfill(ms, agent, seq, type_, progress, message):
    """A valid event as backfill.py writes it: its own key order, data.backfilled, seq 1 or 2, id last."""
    ev = {'runId': 'r', 'phase': 'P0', 'taskId': 'T', 'agentId': agent, 'agentLabel': agent, 'level': 'info',
          'data': {'harnessAgentId': 'h1', 'workflowPhase': 'build', 'transcriptLines': 12, 'backfilled': True},
          'ts': iso(ms), 'tsMs': ms, 'seq': seq, 'type': type_, 'progress': progress, 'message': message}
    ev['id'] = f'{ms}-{agent}-{seq:04d}'
    return ev


@contextlib.contextmanager
def tree(files):
    """A temporary progress root holding files: {'<run>/<agent>.jsonl': [event dict or raw line str, ...]}.

    Dicts are written as log.sh does (json.dumps, ensure_ascii=False, one per line, newline-terminated);
    strings are written verbatim ('' makes a blank line).
    """
    with tempfile.TemporaryDirectory(prefix='check-test-') as root:
        for rel, items in files.items():
            path = os.path.join(root, *rel.split('/'))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            text = ''.join((item if isinstance(item, str) else json.dumps(item, ensure_ascii=False)) + '\n'
                           for item in items)
            with open(path, 'wb') as f:
                f.write(text.encode('utf-8'))
        yield root


def check(root, *args, flags=()):
    """Run check.py as documented, [python, check.py, --root, root, *args], with root as the cwd."""
    return subprocess.run([sys.executable, *flags, CHECK, '--root', root, *args],
                          capture_output=True, text=True, cwd=root, timeout=60)


def run(files, *args):
    """Write files into a temporary root and run check.py on it."""
    with tree(files) as root:
        return check(root, *args)


class CheckTests(unittest.TestCase):
    maxDiff = None

    def test_all_valid(self):
        """AC1: every file is listed as `path  lines=N  problems=0`, the totals line ends stdout, exit 0."""
        files = {
            'a/x.jsonl': [
                mk(BASE, 'x', 1, runId='a', type='agent.start', progress=0, message='starting'),
                mk(BASE + 1000, 'x', 2, runId='a', type='agent.progress', progress=33.5, step='plan', message='café ✓'),
                mk(BASE + 2000, 'x', 3, runId='a', type='agent.done', progress=100, data={'files': ['f.py']}),
            ],
            'a/y.jsonl': [
                mk(BASE, 'y', 1, runId='a', type='agent.log', level='warn'),
                mk(BASE + 500, 'y', 2, runId='a', type='agent.fail', level='error'),
            ],
            'b/orchestrator.jsonl': [
                mk(BASE, 'orchestrator', 1, runId='b', type='run.start', message='workflow'),
                mk(BASE + 1, 'orchestrator', 2, runId='b', type='task.status', status='running', progress=0),
                mk(BASE + 2, 'orchestrator', 3, runId='b', type='note', level='debug'),
                mk(BASE + 3, 'orchestrator', 4, runId='b', type='card.move', step='test', status='running', progress=60),
                mk(BASE + 999, 'orchestrator', 5, runId='b', type='agent.heartbeat'),
                mk(BASE + 999, 'orchestrator', 6, runId='b', type='agent.activity', level='debug', message='3 tool calls: Read a; Edit b',
                   data={'calls': 3, 'tools': {'Read': 1, 'Edit': 2}, 'files': ['b'], 'last': {'tool': 'Edit', 'target': 'b', 'tsMs': BASE + 999}}),
                mk(BASE + 1000, 'orchestrator', 7, runId='b', type='run.end'),
            ],
        }
        p = run(files)
        self.assertEqual(p.stdout.splitlines(), [
            'a/x.jsonl  lines=3  problems=0',
            'a/y.jsonl  lines=2  problems=0',
            'b/orchestrator.jsonl  lines=7  problems=0',
            'total  files=3  lines=12  problems=0',
        ])
        self.assertEqual(p.stderr, '')
        self.assertEqual(p.returncode, 0)

    def test_trace_files_and_dot_dirs_are_ignored(self):
        """Hook traces (*.trace.jsonl) and the mirror state (.mirror/) are not event logs: skipped, exit 0."""
        files = {
            'a/x.jsonl': [mk(BASE, 'x', 1, runId='a')],
            'a/x.trace.jsonl': [{'tsMs': 1, 'tool': 'Read', 'target': 'f', 'ok': True}],
            '.mirror/outbox/b1.jsonl': [{'op': 'set', 'path': 'events/x'}],
        }
        p = run(files)
        self.assertEqual(p.stdout.splitlines(), ['a/x.jsonl  lines=1  problems=0', 'total  files=1  lines=1  problems=0'])
        self.assertEqual(p.returncode, 0)

    def test_each_reason(self):
        """AC2: every reason is reported as `path:line: reason` with the physical line number; exit 1."""
        items = [  # (line, expected reason or None); the blank line is skipped, not counted, and keeps its number
            ('{"id": "x", "ts": "2023', 'not JSON: '),  # the decoder's message follows; asserted by prefix
            ('[1]', 'not a JSON object'),
            ('', None),
            (mk(BASE, 'a', 3, message=OMIT), 'missing required field: message'),
            (mk(BASE, 'a', 4, type='agent.poke'), 'type not allowed: agent.poke'),
            (mk(BASE, 'a', 5, level='LOUD'), 'level not allowed: LOUD'),
            (mk(BASE, 'a', 6, progress=150), 'progress not a number in 0..100: 150'),
            (mk(BASE, 'a', 7, progress='50'), 'progress not a number in 0..100: 50'),
            (mk(BASE, 'a', 8, progress=True), 'progress not a number in 0..100: true'),
            (mk(BASE, 'a', 9, id='nope'), f'id mismatch: expected {BASE}-a-0009'),
            (mk(BASE, 'a', 10, ts=iso(BASE - 5000)), 'tsMs not within 2 s of ts'),  # ts shifted, so only this rule fails
            (mk(BASE + 1000, 'a', 11, type='agent.progress', progress=40, step='s', status='running'), None),
            (backfill(BASE + 2000, 'a', 2, 'agent.done', 100, 'Finished'), None),
        ]
        expected = [f'r/a.jsonl:{n}: {reason}' for n, (_line, reason) in enumerate(items, 1) if reason]
        self.assertEqual(len(expected), 10)
        p = run({'r/a.jsonl': [line for line, _reason in items]})
        out = p.stdout.splitlines()
        self.assertTrue(out and out[0].startswith(expected[0]) and len(out[0]) > len(expected[0]), out[:1])
        self.assertEqual(out[1:], expected[1:] + ['r/a.jsonl  lines=12  problems=10',
                                                  'total  files=1  lines=12  problems=10'])
        self.assertEqual(p.stderr, '')
        self.assertEqual(p.returncode, 1)

    def test_reason_corners(self):
        """AC2 (contract corners): one reason per defect, no cascades; the id rule without `seq`; null and NaN."""
        items = [
            (mk(BASE, 'a', 1, tsMs=OMIT), 'missing required field: tsMs'),  # id and ts rules are skipped: no cascade
            (mk(BASE, 'a', 2, tsMs=str(BASE)), 'tsMs not within 2 s of ts'),  # the id rule matches the digits literally
            (mk(BASE, 'a', OMIT, id=f'{BASE}-a-0003'), None),  # no seq: the id must match <tsMs>-<agentId>-NNNN
            (mk(BASE, 'a', OMIT, id=f'{BASE}-a-4'), f'id does not match {BASE}-a-NNNN'),  # 4+ digits required
            (mk(BASE, 'a', 5, type=None), 'type not allowed: null'),  # a present null is judged by its own rule
            (mk(BASE, 'a', 6, progress=float('nan')), 'progress not a number in 0..100: NaN'),
        ]
        expected = [f'r/a.jsonl:{n}: {reason}' for n, (_line, reason) in enumerate(items, 1) if reason]
        p = run({'r/a.jsonl': [line for line, _reason in items]})
        self.assertEqual(p.stdout.splitlines(), expected + ['r/a.jsonl  lines=6  problems=5',
                                                            'total  files=1  lines=6  problems=5'])
        self.assertEqual(p.stderr, '')
        self.assertEqual(p.returncode, 1)

    def test_run_filter(self):
        """AC3: --run restricts the check to that run's directory; a missing run is one stderr line and exit 2."""
        files = {
            'a/x.jsonl': [mk(BASE, 'x', 1, runId='a'), mk(BASE + 1000, 'x', 2, runId='a')],
            'b/y.jsonl': [mk(BASE, 'y', 1, runId='b')],
        }
        with tree(files) as root:
            p = check(root, '--run', 'a')
            self.assertEqual(p.stdout.splitlines(), ['a/x.jsonl  lines=2  problems=0',
                                                     'total  files=1  lines=2  problems=0'])
            self.assertEqual((p.stderr, p.returncode), ('', 0))
            p = check(root, '--run', 'nope')
            self.assertEqual(p.stdout, '')
            self.assertEqual(p.stderr.splitlines(), [f'check.py: no progress directory {os.path.join(root, "nope")}'])
            self.assertEqual(p.returncode, 2)

    def test_summary(self):
        """AC4: --summary adds, after the totals, one line per agent: last type and ts, latest progress and status."""
        files = {
            'r/a.jsonl': [
                mk(BASE, 'a', 1, type='agent.start', progress=0, message='starting'),
                mk(BASE + 1000, 'a', 2, type='agent.progress', progress=40, step='build', status='running'),
                mk(BASE + 2000, 'a', 3, type='agent.log', message='a note'),
                backfill(BASE - 10000, 'a', 1, 'agent.start', 0, 'backfilled'),  # appended last but oldest: never last
            ],
            'r/b.jsonl': [mk(BASE + 3000, 'b', 1, type='agent.log')],
        }
        per_file = ['r/a.jsonl  lines=4  problems=0', 'r/b.jsonl  lines=1  problems=0',
                    'total  files=2  lines=5  problems=0']
        with tree(files) as root:
            p = check(root, '--summary')
            self.assertEqual(p.stdout.splitlines(), per_file + [
                'agent  r/a  last=agent.log  ts=2023-11-14T22:13:22Z  progress=40  status=running',
                'agent  r/b  last=agent.log  ts=2023-11-14T22:13:23Z  progress=-  status=-',
            ])
            self.assertEqual((p.stderr, p.returncode), ('', 0))
            self.assertEqual(check(root).stdout.splitlines(), per_file)  # without the flag: no agent lines

    def test_stdlib_and_speed(self):
        """AC5: check.py imports only the standard library and validates 5,000 lines in under a second."""
        with open(CHECK, encoding='utf-8') as f:
            source = f.read()
        imported = set()
        for node in ast.walk(ast.parse(source, filename=CHECK)):
            if isinstance(node, ast.Import):
                imported.update(alias.name.split('.')[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                imported.add('.' * node.level + (node.module or '').split('.')[0])
        stdlib = set(getattr(sys, 'stdlib_module_names', STDLIB_FALLBACK))
        self.assertTrue(imported)
        self.assertEqual(imported - stdlib, set(), f'non-stdlib imports in check.py: {sorted(imported - stdlib)}')

        files = {}
        for n in range(5):
            agent = f'a{n}'
            events = []
            for i in range(1, 1001):
                ms = BASE + i * 10
                if i == 1:
                    events.append(mk(ms, agent, i, type='agent.start', progress=0))
                elif i == 1000:
                    events.append(mk(ms, agent, i, type='agent.done', progress=100, data={'files': ['x']}))
                elif i % 2:
                    events.append(mk(ms, agent, i, type='agent.progress', progress=i % 101, step=f'step {i}'))
                else:
                    events.append(mk(ms, agent, i, message=f'line {i}'))
            files[f'speed/{agent}.jsonl'] = events
        with tree(files) as root:
            started = time.perf_counter()
            p = check(root, '--summary')
            elapsed = time.perf_counter() - started
            q = check(root, flags=('-S',))  # no site-packages on sys.path: a third-party import would fail here
        out = p.stdout.splitlines()
        self.assertIn('total  files=5  lines=5000  problems=0', out)
        self.assertEqual(sum(line.startswith('agent  ') for line in out), 5)
        self.assertEqual((p.stderr, p.returncode), ('', 0))
        self.assertLess(elapsed, 1.0, f'5,000 lines took {elapsed:.2f} s')
        self.assertEqual((q.stderr, q.returncode), ('', 0))


if __name__ == '__main__':
    unittest.main(verbosity=2)
