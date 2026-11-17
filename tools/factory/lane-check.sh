#!/usr/bin/env bash
# Lane check (card P0-08.2): which lane owns each file a branch changes, by factory/lanes.json.
#
#   tools/factory/lane-check.sh <lane> [<base>]     base defaults to origin/main
#   tools/factory/lane-check.sh --owners            paths on stdin, separated by NUL bytes
#
# Both forms act on the checkout that holds this script (a lane calls its own worktree's copy).
#
# <lane> [<base>]. The files looked at are three lists joined: the files that differ between HEAD and its merge base
# with <base> (`git diff --name-only --no-renames <base>...HEAD`), the tracked files with uncommitted changes
# (`git diff --name-only HEAD`), and the untracked files git does not ignore. The ownership map is factory/lanes.json
# as <base> holds it, or the checkout's file when <base> has none. One line per file on stdout, sorted by path:
#     <verdict><TAB><owner><TAB><path>
#   own      the path belongs to <lane>
#   card     the path is factory/cards/<file>.md and the file in the checkout is a card whose frontmatter says
#            `lane: <lane>` (the owner column still shows the lane the map gives the path)
#   foreign  the path belongs to another lane, or to two lanes (the owner column then names both, as `a,b`)
#   unowned  no pattern of the map matches the path (owner `-`)
# and a last line on stderr: `lane-check: <lane>: <n> files, <k> outside the lane` (k counts foreign and unowned).
# Exit 0 when k is 0, 1 when it is not, 2 for a usage error, a lane the map does not list, a base that is not a
# commit, or a map that cannot be read.
#
# --owners. Reads the checkout's factory/lanes.json and prints one line `<owner><TAB><path>` for each given path that
# does not have exactly one lane (`-` for none, `a,b` for two), then the line
# `owners: <n> paths, <lane> <count>, ..., <k> wrong`. Exit 0 when k is 0, 1 when it is not, 2 when the map cannot
# be read. The test of the map: git ls-files -z --cached --others --exclude-standard | tools/factory/lane-check.sh --owners
#
# The pattern rules are in the "$comment" of factory/lanes.json. The Python below is given with -c, so stdin stays
# free for the paths.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PY="$(cat <<'PY'
import json, os, re, subprocess, sys

sys.dont_write_bytecode = True
root, args = sys.argv[1], sys.argv[2:]
MAP = 'factory/lanes.json'
USAGE = 'usage: lane-check.sh <lane> [<base>] | lane-check.sh --owners   (paths on stdin, separated by NUL bytes)'
ENV = {k: v for k, v in os.environ.items() if k not in ('GIT_DIR', 'GIT_WORK_TREE')}


def stop(message, code=2):
    sys.stderr.write(f'lane-check: {message}\n')
    sys.exit(code)


def git(*a, check=True):
    r = subprocess.run(['git', '-C', root] + list(a), stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=ENV)
    if check and r.returncode != 0:
        stop(f'git {" ".join(a)} failed: {r.stderr.decode("utf-8", "replace").strip()}')
    return r


def names(data):
    return [p for p in data.decode('utf-8', 'surrogateescape').split('\0') if p]


def read_map(text, where):
    try:
        m = json.loads(text)
        lanes, paths = m['lanes'], [(e['pattern'], e['lane']) for e in m['paths']]
        if not lanes or not all(isinstance(x, str) and x for x in lanes):
            raise ValueError('`lanes` is not a list of names')
        for pattern, lane in paths:
            if not isinstance(pattern, str) or not pattern:
                raise ValueError('an entry has no pattern')
            if lane not in lanes:
                raise ValueError(f'the entry {pattern!r} names the lane {lane!r}, which `lanes` does not list')
    except (ValueError, KeyError, TypeError) as e:
        stop(f'{where} does not read as a lane map ({e})')
    return lanes, paths


def checkout_map():
    try:
        with open(os.path.join(root, MAP), encoding='utf-8') as f:
            return read_map(f.read(), MAP)
    except OSError as e:
        stop(f'{MAP} cannot be read ({e.strerror})')


def owners(path, paths):
    return sorted({lane for pattern, lane in paths if (path.startswith(pattern) if pattern.endswith('/') else path == pattern)})


def out(line):
    sys.stdout.buffer.write((line + '\n').encode('utf-8', 'surrogateescape'))


def cmd_owners():
    lanes, paths = checkout_map()
    count, wrong, n = dict.fromkeys(lanes, 0), 0, 0
    for path in names(sys.stdin.buffer.read()):
        n += 1
        own = owners(path, paths)
        if len(own) == 1:
            count[own[0]] += 1
        else:
            wrong += 1
            out(f'{",".join(own) or "-"}\t{path}')
    out(f'owners: {n} paths, ' + ', '.join(f'{lane} {count[lane]}' for lane in lanes) + f', {wrong} wrong')
    sys.exit(1 if wrong else 0)


def card_lane(path):
    """The `lane` of the card file at `path` in the checkout, or None when it is not there or does not read as a card."""
    sys.path.insert(0, os.path.join(root, 'tools', 'monitor'))
    try:
        import card
        with open(os.path.join(root, path), encoding='utf-8') as f:
            return card.parse(f.read())[0].get('lane')
    except (OSError, ValueError, ImportError, SystemExit):
        return None


def cmd_check(lane, base):
    if base.startswith('-') or git('rev-parse', '--verify', '--quiet', base + '^{commit}', check=False).returncode != 0:
        stop(f'the base {base} is not a commit of this repository')
    at_base = git('show', f'{base}:{MAP}', check=False)
    lanes, paths = read_map(at_base.stdout.decode('utf-8', 'replace'), f'{base}:{MAP}') if at_base.returncode == 0 else checkout_map()
    if lane not in lanes:
        stop(f'{lane} is not a lane of {MAP} ({", ".join(lanes)})')
    files = set(names(git('diff', '--name-only', '-z', '--no-renames', f'{base}...HEAD').stdout))
    files |= set(names(git('diff', '--name-only', '-z', 'HEAD').stdout))
    files |= set(names(git('ls-files', '-z', '--others', '--exclude-standard').stdout))
    outside = 0
    for path in sorted(files):
        own = owners(path, paths)
        if re.fullmatch(r'factory/cards/[^/]+\.md', path) and card_lane(path) == lane:
            verdict = 'card'
        elif own == [lane]:
            verdict = 'own'
        elif own:
            verdict = 'foreign'
        else:
            verdict = 'unowned'
        outside += verdict in ('foreign', 'unowned')
        out(f'{verdict}\t{",".join(own) or "-"}\t{path}')
    sys.stdout.flush()
    sys.stderr.write(f'lane-check: {lane}: {len(files)} files, {outside} outside the lane\n')
    sys.exit(1 if outside else 0)


if args == ['--owners']:
    cmd_owners()
if len(args) not in (1, 2) or not args[0] or args[0].startswith('-'):
    stop(USAGE)
cmd_check(args[0], args[1] if len(args) == 2 else 'origin/main')
PY
)"
exec python3 -c "$PY" "$ROOT" "$@"
