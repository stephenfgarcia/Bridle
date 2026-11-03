#!/usr/bin/env python3
"""Tests for tools/monitor/mirror.py and tools/monitor/trace_hook.py. Run: python3 tools/monitor/test/mirror.test.py
Everything happens in a temporary root passed with --root (mirror.py) or as the root argument (trace_hook.py);
.bridle/progress is never read or written."""
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.dont_write_bytecode = True  # no __pycache__ in the tree
sys.path.insert(0, TOOLS)
import monlib  # noqa: E402

MIRROR = os.path.join(TOOLS, 'mirror.py')
HOOK = os.path.join(TOOLS, 'trace_hook.py')
CHECK = os.path.join(TOOLS, 'check.py')


def mirror(root, *args):
    return subprocess.run([sys.executable, MIRROR, '--root', root] + list(args), capture_output=True, text=True)


def batches(out):
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def ev(root, agent='A', n=1, run='factory', **extra):
    fields = {'phase': 'P0', 'taskId': 'P0-10', 'type': 'agent.progress', 'message': 'step %d' % n, 'progress': n * 10}
    fields.update(extra)
    return monlib.append_event(root, run, agent, fields)[0]


class MirrorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bridle-mirror-')
        self.root = os.path.join(self.tmp, 'progress')
        os.makedirs(self.root)
        for i in (1, 2, 3):
            ev(self.root, n=i)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def cursor(self):
        return monlib.read_json(os.path.join(self.root, '.mirror', 'cursor.json'), {}).get('files', {})

    def outbox(self):
        return sorted(glob.glob(os.path.join(self.root, '.mirror', 'outbox', '*.json')))

    def test_first_pending_initialises_at_the_end(self):
        r = mirror(self.root, 'pending', '--take')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(batches(r.stdout), [])
        self.assertIn('initialised', r.stderr)
        self.assertEqual(self.cursor().get('factory/A.jsonl'), 3)

    def test_take_prints_outbox_then_ack_clears(self):
        mirror(self.root, 'init')
        ev(self.root, n=4); ev(self.root, n=5)
        r = mirror(self.root, 'pending', '--take')
        b = batches(r.stdout)
        self.assertEqual(len(b), 1)
        self.assertEqual(len(b[0]['ops']), 2)
        self.assertTrue(b[0]['idempotencyKey'].startswith('mirror-') and len(b[0]['idempotencyKey']) >= 16)
        self.assertEqual(b[0]['ops'][0]['path'], 'events/' + b[0]['ops'][0]['data']['id'])
        self.assertEqual(len(self.outbox()), 1)
        again = batches(mirror(self.root, 'pending').stdout)
        self.assertEqual([x['batch'] for x in again], [b[0]['batch']], 'an un-acked batch is re-printed, nothing else')
        self.assertEqual(mirror(self.root, 'ack', '--all').returncode, 0)
        self.assertEqual(self.outbox(), [])
        self.assertEqual(batches(mirror(self.root, 'pending').stdout), [])

    def test_trace_lines_fold_into_one_activity_event(self):
        mirror(self.root, 'init')
        tpath = os.path.join(self.root, 'factory', 'A.trace.jsonl')
        with open(tpath, 'w') as f:
            for i, (tool, target, ok) in enumerate([('Read', 'tools/x.py', True), ('Edit', 'tools/x.py', True), ('Bash', 'node t.js', False)]):
                f.write(json.dumps({'tsMs': 1000 + i, 'tool': tool, 'target': target, 'ok': ok, 'id': 'tu%d' % i}) + '\n')
        r = mirror(self.root, 'pending', '--take')
        b = batches(r.stdout)
        self.assertEqual(len(b), 1)
        self.assertEqual(len(b[0]['ops']), 1)
        e = b[0]['ops'][0]['data']
        self.assertEqual(e['type'], 'agent.activity')
        self.assertEqual(e['level'], 'debug')
        self.assertEqual((e['seq'], e['phase'], e['taskId']), (4, 'P0', 'P0-10'))
        self.assertEqual(e['id'], '%d-A-0004' % e['tsMs'])
        self.assertTrue(e['message'].startswith('3 tool calls: '), e['message'])
        self.assertIn('(1 failed)', e['message'])
        self.assertEqual(e['data']['calls'], 3)
        self.assertEqual(e['data']['tools'], {'Read': 1, 'Edit': 1, 'Bash': 1})
        self.assertEqual(e['data']['files'], ['tools/x.py'])
        self.assertEqual(e['data']['last'], {'tool': 'Bash', 'target': 'node t.js', 'tsMs': 1002})
        self.assertNotIn('step', e); self.assertNotIn('progress', e)
        lines = monlib.nonblank_lines(os.path.join(self.root, 'factory', 'A.jsonl'))
        self.assertEqual(len(lines), 4, 'the event was appended to the main file')
        self.assertEqual(self.cursor().get('factory/A.trace.jsonl'), 3)
        self.assertEqual(self.cursor().get('factory/A.jsonl'), 4)
        # a second pass with no new trace lines folds nothing
        mirror(self.root, 'ack', '--all')
        self.assertEqual(batches(mirror(self.root, 'pending', '--take').stdout), [])
        chk = subprocess.run([sys.executable, CHECK, '--root', self.root], capture_output=True, text=True)
        self.assertEqual(chk.returncode, 0, chk.stdout + chk.stderr)

    def test_poll_is_quiet_while_a_batch_is_in_flight(self):
        mirror(self.root, 'init')
        self.assertEqual(mirror(self.root, 'poll').stdout, '')
        ev(self.root, n=4)
        self.assertTrue(mirror(self.root, 'poll').stdout.startswith('pending 1 event (factory)'), mirror(self.root, 'poll').stdout)
        mirror(self.root, 'pending', '--take')
        self.assertEqual(mirror(self.root, 'poll').stdout, '', 'nothing pending after take')
        ev(self.root, n=5)
        self.assertEqual(mirror(self.root, 'poll').stdout, '', 'in flight: quiet')
        self.assertIn('older than 0s', mirror(self.root, 'poll', '--stale-after', '0').stdout)
        mirror(self.root, 'ack', '--all')
        self.assertTrue(mirror(self.root, 'poll').stdout.startswith('pending 1 event'))
        mirror(self.root, 'pending', '--take'); mirror(self.root, 'ack', '--all')
        with open(os.path.join(self.root, 'factory', 'B.trace.jsonl'), 'w') as f:
            f.write(json.dumps({'tsMs': 1, 'tool': 'Read', 'target': 'x', 'ok': True}) + '\n')
        self.assertEqual(mirror(self.root, 'poll').stdout.strip(), 'pending 0 events + 1 agent with new tool calls (factory)')

    def test_truncated_file_restarts_from_zero(self):
        mirror(self.root, 'init')
        path = os.path.join(self.root, 'factory', 'A.jsonl')
        line = monlib.nonblank_lines(path)[0]
        open(path, 'w').write(line + '\n')
        b = batches(mirror(self.root, 'pending', '--take').stdout)
        self.assertEqual(len(b), 1); self.assertEqual(len(b[0]['ops']), 1)

    def test_ack_exists_requeues_the_rest(self):
        mirror(self.root, 'init')
        e4 = ev(self.root, n=4); ev(self.root, n=5); e6 = ev(self.root, n=6)
        b = batches(mirror(self.root, 'pending', '--take').stdout)[0]
        r = mirror(self.root, 'ack', b['batch'], '--exists', 'events/' + e4['id'], '--exists', 'events/' + e6['id'])
        nb = batches(r.stdout)
        self.assertEqual(len(nb), 1); self.assertEqual(len(nb[0]['ops']), 1)
        self.assertNotEqual(nb[0]['batch'], b['batch'])
        self.assertEqual(nb[0]['ops'][0]['data']['message'], 'step 5')
        self.assertEqual(len(self.outbox()), 1)
        r = mirror(self.root, 'ack', nb[0]['batch'], '--exists', nb[0]['ops'][0]['path'])
        self.assertEqual(batches(r.stdout), [], 'nothing left to re-queue')
        self.assertEqual(self.outbox(), [])

    def test_from_start_with_skip_ids(self):
        mirror(self.root, 'init', '--from-start')
        ids = [json.loads(l)['id'] for l in monlib.nonblank_lines(os.path.join(self.root, 'factory', 'A.jsonl'))]
        skip = os.path.join(self.tmp, 'skip.txt')
        open(skip, 'w').write('\n'.join(ids[:2]) + '\n')
        b = batches(mirror(self.root, 'pending', '--take', '--skip-ids-file', skip).stdout)
        self.assertEqual(len(b), 1); self.assertEqual([op['data']['id'] for op in b[0]['ops']], [ids[2]])

    def test_status_and_prune_plan(self):
        mirror(self.root, 'init')
        ev(self.root, n=4, type='agent.heartbeat'); ev(self.root, n=5, type='agent.activity', level='debug')
        s = mirror(self.root, 'status').stdout
        self.assertIn('pending     2 events', s)
        r = mirror(self.root, 'prune-plan', '--run', 'factory')
        self.assertEqual(len(json.loads(r.stdout.strip())), 2)
        self.assertIn('2 events of run factory', r.stderr)


def hook(root, payload):
    return subprocess.run([sys.executable, HOOK, root], input=json.dumps(payload), capture_output=True, text=True)


class TraceHookTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix='bridle-hook-')
        self.progress = os.path.join(self.root, '.bridle', 'progress')
        self.sessions = os.path.join(self.root, '.claude-sessions', 's1', 'subagents')
        os.makedirs(self.sessions)
        prompt = 'You are the build station.\nMONITOR run=factory phase=P0 agent=P0-10-build task=P0-10\nDo the work.'
        with open(os.path.join(self.sessions, 'agent-h1.jsonl'), 'w') as f:
            f.write(json.dumps({'type': 'user', 'message': {'role': 'user', 'content': [{'type': 'text', 'text': prompt}]}}) + '\n')
            f.write(json.dumps({'type': 'assistant', 'message': {'role': 'assistant', 'content': 'ok'}}) + '\n')
        with open(os.path.join(self.sessions, 'agent-h2.jsonl'), 'w') as f:
            f.write(json.dumps({'type': 'user', 'message': {'role': 'user', 'content': 'Run tools/monitor/log.sh -r wf-x -p PLAN -a ux-crit -t PLAN-03 -T agent.start -m hi'}}) + '\n')
        self.base = {'session_id': 's1', 'transcript_path': os.path.join(self.root, '.claude-sessions', 's1.jsonl'), 'cwd': self.root}

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def trace_lines(self, run='factory', agent='P0-10-build'):
        return [json.loads(l) for l in monlib.nonblank_lines(os.path.join(self.progress, run, agent + '.trace.jsonl'))]

    def test_post_tool_use_traces_with_identity_from_marker(self):
        r = hook(self.root, dict(self.base, hook_event_name='PostToolUse', agent_id='h1', agent_type='factory-builder', tool_name='Edit',
                                 tool_input={'file_path': os.path.join(self.root, 'tools', 'x.py'), 'old_string': 'SECRET', 'new_string': 'SECRET2'},
                                 tool_response={'ok': True}, tool_use_id='toolu_1', duration_ms=12))
        self.assertEqual((r.returncode, r.stdout), (0, ''))
        t = self.trace_lines()
        self.assertEqual(len(t), 1)
        self.assertEqual((t[0]['tool'], t[0]['target'], t[0]['ok'], t[0]['ms'], t[0]['id']), ('Edit', 'tools/x.py', True, 12, 'toolu_1'))
        self.assertNotIn('SECRET', open(os.path.join(self.progress, 'factory', 'P0-10-build.trace.jsonl')).read())
        ident = monlib.read_json(os.path.join(self.progress, '.mirror', 'agents', 'h1.json'))
        self.assertEqual((ident['runId'], ident['phase'], ident['agentId'], ident['taskId'], ident['agentType']), ('factory', 'P0', 'P0-10-build', 'P0-10', 'factory-builder'))
        hook(self.root, dict(self.base, hook_event_name='PostToolUseFailure', agent_id='h1', tool_name='Bash', tool_input={'command': '  node   t.js  '}, error='boom'))
        t = self.trace_lines()
        self.assertEqual((t[1]['tool'], t[1]['target'], t[1]['ok']), ('Bash', 'node t.js', False))
        hook(self.root, dict(self.base, hook_event_name='PostToolUse', agent_id='h1', tool_name='mcp__claude-artifacts__db_write', tool_input={'slug': 'x'}, mcp_server={'name': 'claude-artifacts'}))
        self.assertEqual(self.trace_lines()[2]['target'], 'claude-artifacts')

    def test_logsh_fallback_identity(self):
        hook(self.root, dict(self.base, hook_event_name='PostToolUse', agent_id='h2', tool_name='Read', tool_input={'file_path': '/elsewhere/a.md'}))
        self.assertEqual(self.trace_lines('wf-x', 'ux-crit')[0]['target'], '/elsewhere/a.md')

    def test_main_session_and_unknown_agents_are_ignored(self):
        hook(self.root, dict(self.base, hook_event_name='PostToolUse', tool_name='Read', tool_input={'file_path': 'a'}))
        self.assertFalse(os.path.exists(self.progress))
        for _ in range(3):
            hook(self.root, dict(self.base, hook_event_name='PostToolUse', agent_id='nobody', tool_name='Read', tool_input={'file_path': 'a'}))
        cache = monlib.read_json(os.path.join(self.progress, '.mirror', 'agents', 'nobody.json'))
        self.assertEqual((cache['misses'], cache['skip']), (3, True))
        self.assertEqual(glob.glob(os.path.join(self.progress, '*', '*.jsonl')), [])

    def test_subagent_stop_writes_auto_done_once(self):
        monlib.append_event(self.progress, 'factory', 'P0-10-build', {'phase': 'P0', 'taskId': 'P0-10', 'type': 'agent.start', 'message': 'go'})
        stop = dict(self.base, hook_event_name='SubagentStop', agent_id='h1', agent_type='factory-builder',
                    agent_transcript_path=os.path.join(self.sessions, 'agent-h1.jsonl'), last_assistant_message='Built it.\nAll good.')
        hook(self.root, stop); hook(self.root, stop)
        lines = [json.loads(l) for l in monlib.nonblank_lines(os.path.join(self.progress, 'factory', 'P0-10-build.jsonl'))]
        self.assertEqual([l['type'] for l in lines], ['agent.start', 'agent.done'])
        self.assertEqual((lines[1]['message'], lines[1]['progress'], lines[1]['data']['auto'], lines[1]['seq']), ('Built it. All good.', 100, True, 2))
        chk = subprocess.run([sys.executable, CHECK, '--root', self.progress], capture_output=True, text=True)
        self.assertEqual(chk.returncode, 0, chk.stdout + chk.stderr)

    def test_subagent_stop_with_background_tasks_writes_nothing(self):
        monlib.append_event(self.progress, 'factory', 'P0-10-build', {'phase': 'P0', 'taskId': 'P0-10', 'type': 'agent.start', 'message': 'go'})
        hook(self.root, dict(self.base, hook_event_name='SubagentStop', agent_id='h1', last_assistant_message='waiting for the test run',
                             background_tasks=[{'id': 'b1', 'status': 'running'}]))
        lines = monlib.nonblank_lines(os.path.join(self.progress, 'factory', 'P0-10-build.jsonl'))
        self.assertEqual(len(lines), 1, 'no auto agent.done while a background task is running')

    def test_subagent_stop_respects_an_existing_terminal_event(self):
        monlib.append_event(self.progress, 'factory', 'P0-10-build', {'phase': 'P0', 'taskId': 'P0-10', 'type': 'agent.fail', 'level': 'error', 'message': 'no'})
        hook(self.root, dict(self.base, hook_event_name='SubagentStop', agent_id='h1', last_assistant_message='x'))
        self.assertEqual(len(monlib.nonblank_lines(os.path.join(self.progress, 'factory', 'P0-10-build.jsonl'))), 1)


if __name__ == '__main__':
    unittest.main(verbosity=1)
