#!/usr/bin/env python3
"""Local viewer for the Bridle Build Monitor: the same page, fed from the local files within a second.

  python3 tools/monitor/serve.py [--port 8787] [--root .bridle/progress] [--cards factory/cards] [--interval 0.25]

Serves tools/monitor/index.html at http://127.0.0.1:<port>/ and a Server-Sent Events stream at /events that the
page uses instead of the artifact database when it is opened from localhost. No Claude turn is involved: every
log.sh line and every hook trace line shows up as soon as it is written.

Stream contents, in order:
  event: tasks     data: [task documents built from factory/cards/*.md frontmatter]
  event: event     data: {one monitor event}      (replay of every .jsonl line, then the live tail)
  event: ready     data: {"events": N}            (end of the replay)
  event: activity  data: {ephemeral agent.activity}  one per new trace line (live tail only; data.ephemeral = true)
  : ping                                          every 15 s
Standard library only.
"""
import argparse
import glob
import http.server
import importlib.util
import json
import os
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import monlib  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, 'index.html')
FILE_TOOLS = ('Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit')


def load_tasks(cards_dir):
    """Task documents from the card frontmatter, through card.py's own parser."""
    try:
        spec = importlib.util.spec_from_file_location('bridle_card', os.path.join(HERE, 'card.py'))
        card = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(card)
    except Exception:
        return []
    out = []
    for p in sorted(glob.glob(os.path.join(cards_dir, '*.md'))):
        try:
            meta, _ = card.parse(open(p, encoding='utf-8').read())
            d = card.task_doc(meta)
            for k in ('station', 'status'):
                if meta.get(k):
                    d[k] = meta[k]
            out.append(d)
        except Exception:
            continue
    return out


class Tail:
    """Follows every event and trace file under root and yields the complete new lines as (kind, object)."""

    def __init__(self, root):
        self.root = os.path.abspath(root)
        self.offsets = {}
        self.known = {}
        self.n = 0

    def files(self):
        out = []
        for p in sorted(glob.glob(os.path.join(self.root, '**', '*.jsonl'), recursive=True)):
            rel = os.path.relpath(p, self.root).replace(os.sep, '/')
            if not rel.startswith(monlib.MIRROR_DIR + '/'):
                out.append((rel, p))
        return out

    def skip_traces(self):
        """Replay never includes raw traces (the folded agent.activity events already cover the past)."""
        for rel, p in self.files():
            if rel.endswith(monlib.TRACE_SUFFIX):
                try:
                    self.offsets[p] = os.path.getsize(p)
                except OSError:
                    pass

    def poll(self):
        out = []
        for rel, p in self.files():
            try:
                size = os.path.getsize(p)
            except OSError:
                continue
            off = self.offsets.get(p, 0)
            if size < off:
                off = 0
            if size == off:
                continue
            with open(p, 'rb') as f:
                f.seek(off)
                chunk = f.read(size - off)
            nl = chunk.rfind(b'\n')
            if nl < 0:
                continue
            data = chunk[:nl + 1]
            self.offsets[p] = off + len(data)
            run = rel.split('/')[0]
            name = rel.split('/')[-1]
            is_trace = name.endswith(monlib.TRACE_SUFFIX)
            agent = name[:-len(monlib.TRACE_SUFFIX)] if is_trace else name[:-len('.jsonl')]
            for line in data.decode('utf-8', 'replace').split('\n'):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                if not isinstance(obj, dict):
                    continue
                if is_trace:
                    out.append(('activity', self.ephemeral(run, agent, obj)))
                else:
                    if obj.get('agentId'):
                        self.known[run + '/' + str(obj['agentId'])] = (obj.get('phase'), obj.get('taskId'), obj.get('agentLabel'))
                    out.append(('event', obj))
        return out

    def ephemeral(self, run, agent, t):
        ph, task, label = self.known.get(run + '/' + agent, ('-', '-', agent))
        ms = int(t.get('tsMs') or monlib.now_ms())
        self.n += 1
        tool = str(t.get('tool') or '?')
        target = str(t.get('target') or '')
        return {'id': 'trace-%s-%d-%d' % (agent, ms, self.n), 'ts': monlib.iso(ms), 'tsMs': ms, 'seq': 0, 'runId': run,
                'phase': ph or '-', 'taskId': task or '-', 'agentId': agent, 'agentLabel': label or agent,
                'type': 'agent.activity', 'level': 'debug', 'message': tool + (' ' + target if target else ''),
                'data': {'ephemeral': True, 'calls': 1, 'tools': {tool: 1}, 'files': [target] if tool in FILE_TOOLS and target else [],
                         'last': {'tool': tool, 'target': target, 'tsMs': ms}, 'ok': bool(t.get('ok', True))}}


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = 'BridleMonitor/1'
    root = monlib.PROGRESS
    cards = os.path.join(monlib.ROOT, 'factory', 'cards')
    interval = 0.25
    verbose = False

    def log_message(self, fmt, *args):
        if self.verbose:
            sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path in ('/', '/index.html'):
            try:
                body = open(PAGE, 'rb').read()
            except OSError:
                self.send_error(404, 'index.html not found next to serve.py')
                return
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(body)
        elif path == '/events':
            self.stream()
        elif path == '/health':
            body = json.dumps({'ok': True, 'root': self.root}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def sse(self, event, data):
        self.wfile.write(('event: %s\ndata: %s\n\n' % (event, json.dumps(data, ensure_ascii=False))).encode('utf-8'))
        self.wfile.flush()

    def stream(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'keep-alive')
        self.send_header('X-Accel-Buffering', 'no')
        self.end_headers()
        tail = Tail(self.root)
        tail.skip_traces()
        try:
            self.sse('tasks', load_tasks(self.cards))
            n = 0
            for kind, obj in tail.poll():
                self.sse(kind, obj)
                n += 1
            self.sse('ready', {'events': n})
            last_ping = time.time()
            while True:
                time.sleep(self.interval)
                for kind, obj in tail.poll():
                    self.sse(kind, obj)
                if time.time() - last_ping > 15:
                    self.wfile.write(b': ping\n\n')
                    self.wfile.flush()
                    last_ping = time.time()
        except (BrokenPipeError, ConnectionResetError, OSError):
            return


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--port', type=int, default=8787)
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--root', default=monlib.PROGRESS)
    ap.add_argument('--cards', default=os.path.join(monlib.ROOT, 'factory', 'cards'))
    ap.add_argument('--interval', type=float, default=0.25)
    ap.add_argument('--verbose', action='store_true')
    a = ap.parse_args(argv)
    Handler.root, Handler.cards, Handler.interval, Handler.verbose = os.path.abspath(a.root), os.path.abspath(a.cards), a.interval, a.verbose
    srv = Server((a.host, a.port), Handler)
    print('Bridle Build Monitor local viewer: http://%s:%d/  (events from %s; Ctrl-C to stop)' % (a.host, srv.server_address[1], Handler.root), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == '__main__':
    main()
