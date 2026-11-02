#!/usr/bin/env python3
"""Validate the monitor's local event logs: .bridle/progress/<runId>/<agentId>.jsonl.

  python3 tools/monitor/check.py [--run <runId>] [--summary] [--root <dir>]

Every *.jsonl under the progress root (or under <root>/<runId> with --run) is read; each non-blank
line must be a JSON object carrying the fields log.sh writes. Output, per file: one `path:line: reason`
line per problem, then `path  lines=N  problems=M`; after all files `total  files=F  lines=N  problems=M`;
with --summary, one `agent  <runId>/<agentId>  last=<type>  ts=<ts>  progress=<n|->  status=<status|->`
line per agent. --root points the check at another tree (tests use a temporary one).

Exit codes: 0 every line is valid; 1 at least one line is invalid; 2 the progress directory or the
--run directory does not exist (one line on stderr, nothing on stdout).

Standard library only. Files are only read, never fixed or rewritten; `data` payloads are not checked.
"""
import argparse
import datetime
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROGRESS = os.path.join(ROOT, '.bridle', 'progress')

REQUIRED = ['id', 'ts', 'tsMs', 'runId', 'phase', 'taskId', 'agentId', 'type', 'level', 'message']
TYPES = {'run.start', 'run.end', 'task.status', 'agent.start', 'agent.progress', 'agent.log',
         'agent.heartbeat', 'agent.done', 'agent.fail', 'note', 'card.move'}
LEVELS = {'debug', 'info', 'warn', 'error'}
SKEW_MS = 2000  # how far tsMs may sit from ts (ts is whole seconds; both come from the same clock)


def show(value):
    """A value inside a message: strings bare, anything else in JSON notation (null, true, 1.5, [..])."""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def is_number(value):
    """int or float, but not bool (bool is an int in Python)."""
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def ts_to_ms(ts):
    """Epoch milliseconds for an ISO-8601 timestamp (naive = UTC), or None when it does not parse."""
    if not isinstance(ts, str):
        return None
    try:
        dt = datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.timestamp() * 1000


def check_event(obj):
    """Reasons for one parsed line, in contract order; [] when the event is valid. Pure, no I/O.

    At most one reason per rule. A rule whose inputs are missing is skipped, because the missing
    field is already reported: one defect yields one reason.
    """
    if not isinstance(obj, dict):
        return ['not a JSON object']
    reasons = [f'missing required field: {name}' for name in REQUIRED if name not in obj]
    if 'type' in obj and not (isinstance(obj['type'], str) and obj['type'] in TYPES):
        reasons.append(f'type not allowed: {show(obj["type"])}')
    if 'level' in obj and not (isinstance(obj['level'], str) and obj['level'] in LEVELS):
        reasons.append(f'level not allowed: {show(obj["level"])}')
    if 'progress' in obj:
        progress = obj['progress']
        if not (is_number(progress) and 0 <= progress <= 100):  # NaN fails both comparisons
            reasons.append(f'progress not a number in 0..100: {show(progress)}')
    if 'id' in obj and 'tsMs' in obj and 'agentId' in obj:
        prefix = f'{show(obj["tsMs"])}-{show(obj["agentId"])}-'
        seq = obj.get('seq')
        if isinstance(seq, int) and not isinstance(seq, bool):
            expected = f'{prefix}{seq:04d}'
            if obj['id'] != expected:
                reasons.append(f'id mismatch: expected {expected}')
        elif not (isinstance(obj['id'], str) and re.fullmatch(re.escape(prefix) + r'\d{4,}', obj['id'])):
            reasons.append(f'id does not match {prefix}NNNN')
    if 'ts' in obj and 'tsMs' in obj:
        reference = ts_to_ms(obj['ts'])
        ms = obj['tsMs']
        if reference is None or not is_number(ms) or not abs(ms - reference) <= SKEW_MS:
            reasons.append('tsMs not within 2 s of ts')
    return reasons


def check_file(path):
    """Validate one JSONL file, read as bytes.

    Returns (lines, problems, events): lines = number of non-blank lines; problems = [(lineno, reason)]
    with 1-based physical line numbers; events = [(lineno, obj)] for every line that parsed as a JSON
    object, valid or not. Blank lines are skipped and not counted, as log.sh counts seq.
    """
    with open(path, 'rb') as f:
        data = f.read()
    lines, problems, events = 0, [], []
    for lineno, raw in enumerate(data.split(b'\n'), 1):
        try:
            text = raw.decode('utf-8')
        except UnicodeDecodeError as e:
            lines += 1
            problems.append((lineno, f'not JSON: {e}'))
            continue
        if not text.strip():
            continue
        lines += 1
        try:
            obj = json.loads(text)
        except ValueError as e:
            problems.append((lineno, f'not JSON: {e}'))
            continue
        if not isinstance(obj, dict):
            problems.append((lineno, 'not a JSON object'))
            continue
        events.append((lineno, obj))
        problems.extend((lineno, reason) for reason in check_event(obj))
    return lines, problems, events


def discover(base):
    """Every *.jsonl under base, recursive, sorted by path."""
    found = []
    for dirpath, _dirnames, filenames in os.walk(base):
        found.extend(os.path.join(dirpath, name) for name in filenames if name.endswith('.jsonl'))
    return sorted(found)


def display(path):
    """The path as printed: relative to the cwd when under it, else absolute."""
    cwd = os.getcwd()
    for candidate in (os.path.abspath(path), os.path.realpath(path)):
        if candidate.startswith(os.path.join(cwd, '')):
            return os.path.relpath(candidate, cwd)
    return os.path.abspath(path)


def run_dir(root, path):
    """The run directory of a file, relative to root ('' for a file directly under root)."""
    rel = os.path.relpath(os.path.dirname(os.path.abspath(path)), root)
    return '' if rel == '.' else rel.replace(os.sep, '/')


def summarize(events_by_file):
    """Lines for --summary: one per agent, sorted by `<runId>/<agentId>`.

    events_by_file: [(run_dir, stem, [(lineno, obj), ...]), ...] in file order. An agent is keyed by its
    run directory and `agentId` field (the file stem when the field is absent). The last event is the one
    with the highest tsMs (ties go to the later line); progress and status come from the latest event
    carrying each key, `-` when none did.
    """
    last, progress, status = {}, {}, {}
    order = 0
    for rdir, stem, events in events_by_file:
        for _lineno, obj in events:
            order += 1
            agent = show(obj['agentId']) if 'agentId' in obj else stem
            key = f'{rdir}/{agent}' if rdir else agent
            ms = obj.get('tsMs')
            rank = (ms if is_number(ms) and ms == ms else float('-inf'), order)
            if key not in last or rank > last[key][0]:
                last[key] = (rank, obj)
            for field, table in (('progress', progress), ('status', status)):
                if field in obj and (key not in table or rank > table[key][0]):
                    table[key] = (rank, obj[field])
    lines = []
    for key in sorted(last):
        obj = last[key][1]
        lines.append(f'agent  {key}'
                     f'  last={show(obj["type"]) if "type" in obj else "-"}'
                     f'  ts={show(obj["ts"]) if "ts" in obj else "-"}'
                     f'  progress={show(progress[key][1]) if key in progress else "-"}'
                     f'  status={show(status[key][1]) if key in status else "-"}')
    return lines


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog='check.py',
        description='Validate the monitor JSONL event logs: exit 0 all valid, 1 an invalid line, 2 no such directory.')
    ap.add_argument('--run', metavar='RUNID', help='check only <root>/<runId>')
    ap.add_argument('--summary', action='store_true', help='after the totals, print one line per agent')
    ap.add_argument('--root', metavar='DIR', default=PROGRESS, help='progress tree to check (default: %(default)s)')
    args = ap.parse_args(argv)

    root = os.path.abspath(args.root)
    base = os.path.join(root, args.run) if args.run else root
    if not os.path.isdir(base):
        print(f'check.py: no progress directory {base}', file=sys.stderr)
        return 2

    files = discover(base)
    total_lines = total_problems = 0
    per_file = []
    for path in files:
        lines, problems, events = check_file(path)
        name = display(path)
        for lineno, reason in problems:
            print(f'{name}:{lineno}: {reason}')
        print(f'{name}  lines={lines}  problems={len(problems)}')
        total_lines += lines
        total_problems += len(problems)
        per_file.append((run_dir(root, path), os.path.basename(path)[:-len('.jsonl')], events))
    print(f'total  files={len(files)}  lines={total_lines}  problems={total_problems}')
    if args.summary:
        for line in summarize(per_file):
            print(line)
    return 1 if total_problems else 0


if __name__ == '__main__':
    sys.exit(main())
