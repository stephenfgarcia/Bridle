#!/usr/bin/env python3
"""Tests for tools/monitor/serve.py (local viewer). Run: python3 tools/monitor/test/serve.test.py"""
import http.client
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, TOOLS)
import monlib  # noqa: E402

SERVE = os.path.join(TOOLS, 'serve.py')


class ServeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='bridle-serve-')
        cls.root = os.path.join(cls.tmp, 'progress')
        cls.cards = os.path.join(cls.tmp, 'cards')
        os.makedirs(cls.root); os.makedirs(cls.cards)
        with open(os.path.join(cls.cards, 'P9-01-demo.md'), 'w') as f:
            f.write('---\nid: P9-01\ntitle: Demo card\nphase: P9\norder: 1\ndependsOn: [P0-01]\nstation: build\nstatus: running\nowner: x\nupdated: 2026-01-01T00:00:00Z\nhistory:\n---\n\n# P9-01 Demo card\n')
        monlib.append_event(cls.root, 'factory', 'A', {'phase': 'P9', 'taskId': 'P9-01', 'type': 'agent.start', 'message': 'go'})
        monlib.append_event(cls.root, 'factory', 'A', {'phase': 'P9', 'taskId': 'P9-01', 'type': 'agent.progress', 'message': 'step 1', 'progress': 10})
        with open(os.path.join(cls.root, 'factory', 'A.trace.jsonl'), 'w') as f:
            f.write(json.dumps({'tsMs': 1, 'tool': 'Read', 'target': 'old', 'ok': True}) + '\n')
        cls.proc = subprocess.Popen([sys.executable, SERVE, '--port', '0', '--root', cls.root, '--cards', cls.cards, '--interval', '0.1'],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        first = cls.proc.stdout.readline()
        m = re.search(r'http://127\.0\.0\.1:(\d+)/', first)
        assert m, 'server did not announce its port: ' + first
        cls.port = int(m.group(1))

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        try:
            cls.proc.wait(timeout=5)
        except Exception:
            cls.proc.kill()
        cls.proc.stdout.close()
        cls.proc.stderr.close()
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_page_is_served(self):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        c.request('GET', '/')
        r = c.getresponse()
        body = r.read().decode('utf-8')
        self.assertEqual(r.status, 200)
        self.assertIn('<title>Bridle Build Monitor</title>', body)
        c.request('GET', '/nope'); self.assertEqual(c.getresponse().status, 404)

    def read_sse(self, resp, until_event, limit=50, timeout=5):
        """Collect (event, data) pairs until an event named until_event arrives."""
        resp.fp.raw._sock.settimeout(timeout) if hasattr(resp.fp, 'raw') else None
        got, event, data = [], None, []
        deadline = time.time() + timeout
        while time.time() < deadline and len(got) < limit:
            line = resp.fp.readline().decode('utf-8').rstrip('\n')
            if line.startswith('event: '):
                event = line[7:]
            elif line.startswith('data: '):
                data.append(line[6:])
            elif line == '' and event:
                got.append((event, json.loads('\n'.join(data))))
                if event == until_event:
                    return got
                event, data = None, []
        return got

    def test_stream_replays_then_tails(self):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        c.request('GET', '/events')
        r = c.getresponse()
        self.assertEqual(r.status, 200)
        self.assertTrue(r.getheader('Content-Type').startswith('text/event-stream'))
        got = self.read_sse(r, 'ready')
        kinds = [k for k, _ in got]
        self.assertEqual(kinds, ['tasks', 'event', 'event', 'ready'], kinds)
        self.assertEqual(got[0][1][0]['id'], 'P9-01')
        self.assertEqual(got[0][1][0]['station'], 'build')
        self.assertEqual([e['type'] for k, e in got if k == 'event'], ['agent.start', 'agent.progress'])
        self.assertEqual(got[-1][1], {'events': 2})
        # live tail: a new event line and a new trace line
        monlib.append_event(self.root, 'factory', 'A', {'phase': 'P9', 'taskId': 'P9-01', 'type': 'agent.progress', 'message': 'step 2', 'progress': 40})
        got = self.read_sse(r, 'event', limit=5, timeout=3)
        self.assertEqual(got[-1][0], 'event'); self.assertEqual(got[-1][1]['message'], 'step 2')
        with open(os.path.join(self.root, 'factory', 'A.trace.jsonl'), 'a') as f:
            f.write(json.dumps({'tsMs': 5000, 'tool': 'Edit', 'target': 'tools/x.py', 'ok': True}) + '\n')
        got = self.read_sse(r, 'activity', limit=5, timeout=3)
        self.assertEqual(got[-1][0], 'activity')
        e = got[-1][1]
        self.assertEqual((e['type'], e['agentId'], e['runId'], e['phase'], e['taskId']), ('agent.activity', 'A', 'factory', 'P9', 'P9-01'))
        self.assertTrue(e['data']['ephemeral'])
        self.assertEqual(e['message'], 'Edit tools/x.py')
        self.assertEqual(e['data']['files'], ['tools/x.py'])
        self.assertTrue(e['id'].startswith('trace-A-5000-'))
        c.close()


if __name__ == '__main__':
    unittest.main(verbosity=1)
