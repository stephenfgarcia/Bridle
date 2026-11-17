#!/usr/bin/env bash
# Tests for the lane tooling (card P0-08.2): tools/factory/lane.sh, tools/factory/lane-check.sh, factory/lanes.json and
# the `lane` key of tools/monitor/card.py, one case per group of acceptance criteria.
#   new           AC1  `lane.sh new`: the path printed, the branch lane/<name> at origin/main without an upstream, the
#                      refusals (a second `new`, a name not in lanes.json, a failed fetch, a lanes directory inside the main checkout),
#                      the default directory, and a start at a commit pushed to origin after the clone
#   list          AC1  `lane.sh list`: no lines without lanes, then one line per lane, idle or `running <id> <station>`,
#                      the same from the main checkout's copy and from a lane worktree's copy
#   one-per-lane  AC4  `card.py move --lane`: the `lane:` line, the refusal of a second card while the first is at
#                      plan, build, test or review (file and events unchanged), and `card.py lane`
#   owners        AC2  the paths of this checkout (tracked, and untracked but not ignored) each have one lane; the
#                      map of factory/lanes.json is the list below; a path with no lane or two lanes is named
#   check         AC3  `lane-check.sh`: own, card, foreign and unowned files, committed, uncommitted and untracked
#   remove        AC1  `lane.sh remove`: refused with a commit of its own or an untracked file, done once merged
#   clean         AC5  this checkout's worktree list and lane/* branches are as before; the fixture is gone
# The fixture is a temporary directory: a bare origin.git, a clone `main` holding copies of this checkout's
# tools/factory, tools/monitor/card.py, tools/monitor/log.sh and factory/lanes.json, and the lane worktrees made from
# it. Each lane.sh and card.py the cases run is a copy inside the fixture. Of this checkout the cases read the copied
# scripts, factory/lanes.json, `git ls-files` (owners, through this checkout's lane-check.sh --owners), and the names in
# its worktree directory and of its lane/* branches (clean).
# Not part of `pnpm check` (it makes clones, worktrees and pushes in the temporary directory).
#
# Run:  bash tools/test/lanes.test.sh      (from any directory; needs git and python3)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CASE=setup
TAB="$(printf '\t')"

fail() {
  echo "not ok - $CASE: $1" >&2
  if [ -n "${2:-}" ]; then printf '%s\n' "$2" >&2; fi
  exit 1
}

unset BRIDLE_MAIN_ROOT BRIDLE_LANES_DIR GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
wt_before="$(ls -1 "$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)/worktrees" 2>/dev/null || true)"
br_before="$(git -C "$ROOT" for-each-ref --format='%(refname)' refs/heads/lane/)"

export GIT_AUTHOR_NAME='Lane Test' GIT_AUTHOR_EMAIL='lane-test@example.invalid'
export GIT_COMMITTER_NAME='Lane Test' GIT_COMMITTER_EMAIL='lane-test@example.invalid'
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1

T="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$T"' EXIT
M="$T/main"
mkdir "$T/tmp"

run() { # runs "$@"; sets CODE, OUT (stdout) and ERR (stderr)
  set +e
  "$@" >"$T/tmp/out" 2>"$T/tmp/err"
  CODE=$?
  set -e
  OUT="$(cat "$T/tmp/out")"
  ERR="$(cat "$T/tmp/err")"
}
want_code() { [ "$CODE" -eq "$1" ] || fail "$2: exit $CODE, expected $1" "$OUT
$ERR"; }
worktrees() { git -C "$M" worktree list --porcelain | grep -c '^worktree '; }
has_branch() { git -C "$M" show-ref --verify --quiet "refs/heads/$1"; }
events() { cat "$M"/.bridle/progress/*/*.jsonl 2>/dev/null | grep -c . || true; }
card() { ls "$1"/factory/cards/"$2"-*.md; }
move() { # $1 = worktree, the rest = arguments of card.py move; the op on stdout is dropped
  run python3 "$1/tools/monitor/card.py" move "${@:2}"
}

# The fixture: a bare origin, and the clone that plays the main checkout.
git init -q --bare -b main "$T/origin.git"
git init -q -b main "$M"
mkdir -p "$M/tools/monitor" "$M/factory" "$M/crates/x" "$M/apps/web" "$M/infra"
cp -Rp "$ROOT/tools/factory" "$M/tools/factory"
cp -p "$ROOT/tools/monitor/card.py" "$ROOT/tools/monitor/log.sh" "$M/tools/monitor/"
cp -p "$ROOT/factory/lanes.json" "$M/factory/lanes.json"
echo '// core' > "$M/crates/x/lib.rs"
echo '// web' > "$M/apps/web/a.ts"
echo '# platform' > "$M/infra/i.tf"
echo '[workspace]' > "$M/Cargo.toml"
[ "$("$M/tools/monitor/log.sh" --main-root)" = "$M" ] || fail "the fixture's log.sh does not name the fixture as its main checkout"
n=0
for id in A1 A2 W1; do
  n=$((n + 1))
  python3 "$M/tools/monitor/card.py" new "$id" "Card $id" --phase P9 --order "$n" --no-op 2>/dev/null
done
git -C "$M" add -A
git -C "$M" commit -q -m 'Fixture'
git -C "$M" remote add origin "$T/origin.git"
git -C "$M" push -q origin main
LANE="$M/tools/factory/lane.sh"
export BRIDLE_LANES_DIR="$T/lanes"
CORE="$T/lanes/core"
WEB="$T/main.lanes/web"
PLAT="$T/lanes/platform"

CASE=list
run "$LANE" list
want_code 0 "list without lanes"
[ -z "$OUT" ] || fail "list prints lines when there is no lane" "$OUT"

CASE=new
run "$LANE" new core
want_code 0 "new core"
[ "$OUT" = "$CORE" ] || fail "new core does not print exactly $CORE on stdout" "$OUT"
[ "$(git -C "$CORE" rev-parse --abbrev-ref HEAD)" = 'lane/core' ] || fail "the worktree of core is not on lane/core"
[ "$(git -C "$CORE" rev-parse HEAD)" = "$(git -C "$M" rev-parse origin/main)" ] || fail "lane/core does not start at origin/main"
git -C "$CORE" rev-parse --abbrev-ref 'lane/core@{upstream}' >/dev/null 2>&1 && fail "lane/core has an upstream"
git -C "$M" worktree list --porcelain | grep -q -x -F -- "worktree $CORE" || fail "$CORE is not a worktree of the fixture"
case "$CORE/" in "$M"/*) fail "the worktree of core is inside the main checkout" ;; esac
[ "$(git -C "$M" status --porcelain)" = '' ] || fail "new core changed the main checkout's tree" "$(git -C "$M" status --porcelain)"
run "$LANE" new core
want_code 1 "a second new core"
printf '%s\n' "$ERR" | grep -q -F -- 'lane core exists' || fail "a second new core does not say 'lane core exists'" "$ERR"
[ "$(worktrees)" -eq 2 ] || fail "a second new core changed the number of worktrees"
[ "$(git -C "$M" for-each-ref refs/heads/lane/ | grep -c .)" -eq 1 ] || fail "a second new core changed the lane branches"
run "$LANE" new nosuch
want_code 2 "new nosuch"
if has_branch lane/nosuch || [ -e "$T/lanes/nosuch" ]; then fail "new nosuch made a branch or a directory"; fi
run "$LANE" new
want_code 2 "new without a name"
# Added at the test station: a failed `git fetch origin main` makes no lane.
git -C "$M" remote set-url origin "$T/no-origin.git"
run "$LANE" new web
want_code 1 "new web when git fetch origin main fails"
printf '%s\n' "$ERR" | grep -q -F -- 'git fetch origin main failed; no lane made' || fail "the failed fetch is not given as the reason" "$ERR"
if has_branch lane/web || [ -e "$T/lanes/web" ] || [ "$(worktrees)" -ne 2 ]; then fail "new web with a failed fetch made a branch, a directory or a worktree"; fi
git -C "$M" remote set-url origin "$T/origin.git"
run env -u BRIDLE_LANES_DIR "$LANE" new web
want_code 0 "new web without BRIDLE_LANES_DIR"
[ "$OUT" = "$WEB" ] || fail "new web without BRIDLE_LANES_DIR does not print $WEB" "$OUT"
[ "$(git -C "$WEB" rev-parse --abbrev-ref HEAD)" = 'lane/web' ] || fail "the worktree of web is not on lane/web"
run env BRIDLE_LANES_DIR="$M/lanes" "$LANE" new platform
want_code 1 "new platform with BRIDLE_LANES_DIR inside the main checkout"
if has_branch lane/platform || [ -e "$M/lanes" ]; then fail "the refused new platform made a branch or a directory"; fi
run env BRIDLE_LANES_DIR=lanes "$LANE" new platform
want_code 1 "new platform with a relative BRIDLE_LANES_DIR"
git clone -q "$T/origin.git" "$T/second"
echo '# later' > "$T/second/infra/j.tf"
git -C "$T/second" add infra/j.tf
git -C "$T/second" commit -q -m 'Pushed after the clone'
git -C "$T/second" push -q origin main
later="$(git -C "$T/second" rev-parse HEAD)"
run "$LANE" new platform
want_code 0 "new platform"
[ "$OUT" = "$PLAT" ] || fail "new platform does not print $PLAT" "$OUT"
[ "$(git -C "$PLAT" rev-parse HEAD)" = "$later" ] || fail "new platform does not start at the commit pushed to origin after the clone"
echo "ok - new"

CASE=list
idle="$(printf '%s\n' "core${TAB}$CORE${TAB}lane/core${TAB}idle" "platform${TAB}$PLAT${TAB}lane/platform${TAB}idle" \
  "web${TAB}$WEB${TAB}lane/web${TAB}idle")"
run "$LANE" list
want_code 0 "list"
[ "$(printf '%s\n' "$OUT" | sort)" = "$idle" ] || fail "list with three idle lanes is not the three expected lines" "$OUT"
move "$CORE" A1 plan --lane core
want_code 0 "move A1 plan --lane core"
running="$(printf '%s\n' "$idle" | sed "s|^\(core${TAB}.*${TAB}\)idle\$|\1running A1 plan|")"
run "$LANE" list
want_code 0 "list with a card running"
[ "$(printf '%s\n' "$OUT" | sort)" = "$running" ] || fail "list does not show 'running A1 plan' for core and idle for the others" "$OUT"
main_out="$OUT"
run "$CORE/tools/factory/lane.sh" list
want_code 0 "list from the core worktree's copy"
[ "$OUT" = "$main_out" ] || fail "list from the core worktree's copy differs from the main checkout's" "$OUT"
echo "ok - list"

CASE=one-per-lane
A1="$(card "$CORE" A1)"
A2="$(card "$CORE" A2)"
sed -n '/^owner: /{n;p;}' "$A1" | grep -q -x -F -- 'lane: core' || fail "move --lane core did not write 'lane: core' after the owner line" "$(sed -n '1,14p' "$A1")"
[ "$(grep -n -x -F -- 'lane: core' "$A1" | cut -d: -f1)" -lt "$(grep -n -x -F -- 'history:' "$A1" | cut -d: -f1)" ] \
  || fail "'lane: core' is not above 'history:'"
cp -p "$A2" "$T/tmp/A2.before"
refused() { # $1 = what A1 is at, the rest = a move of A2 that must exit 1 naming A1, with A2 and the events unchanged
  local at="$1" ev
  shift
  ev="$(events)"
  move "$CORE" "$@"
  want_code 1 "move $* with A1 at $at"
  printf '%s\n' "$ERR" | grep -q -F -- "lane core already has a card in flight: A1 at $at" \
    || fail "the refusal of 'move $*' does not name A1 and $at" "$ERR"
  cmp -s "$A2" "$T/tmp/A2.before" || fail "the refused 'move $*' changed A2's file"
  [ "$(events)" = "$ev" ] || fail "the refused 'move $*' added an event"
}
refused plan A2 plan --lane core
for st in build test review; do
  move "$CORE" A1 "$st"
  want_code 0 "move A1 $st (the card itself, in its lane)"
  grep -q -x -F -- 'lane: core' "$A1" || fail "move A1 $st without --lane dropped the lane"
  if [ "$st" = build ]; then
    run python3 "$CORE/tools/monitor/card.py" lane core
    want_code 0 "card.py lane core"
    [ "$OUT" = 'A1 build running' ] || fail "card.py lane core does not print 'A1 build running'" "$OUT"
  fi
  refused "$st" A2 plan --lane core
done
move "$CORE" A1 build
want_code 0 "move A1 build"
move "$CORE" W1 plan --lane web
want_code 0 "move W1 plan --lane web (another lane)"
move "$CORE" A2 spec --lane core
want_code 0 "move A2 spec --lane core (spec holds no lane)"
grep -q -x -F -- 'lane: core' "$A2" || fail "move A2 spec --lane core did not write the lane"
cp -p "$A2" "$T/tmp/A2.before"
refused build A2 build
move "$CORE" A2 plan --lane nosuch
want_code 2 "move A2 plan --lane nosuch"
cmp -s "$A2" "$T/tmp/A2.before" || fail "move --lane nosuch changed A2's file"
move "$CORE" A1 ship
want_code 0 "move A1 ship"
move "$CORE" A2 plan
want_code 0 "move A2 plan after A1 shipped"
run python3 "$CORE/tools/monitor/card.py" lane core
[ "$OUT" = 'A2 plan running' ] || fail "card.py lane core does not print 'A2 plan running' after A1 shipped" "$OUT"
# Added at the test station: a card that returns to backlog gives its lane up, and keeps its `lane:` line.
move "$CORE" A1 plan
want_code 1 "move A1 plan while A2 holds core"
move "$CORE" A2 backlog
want_code 0 "move A2 backlog"
grep -q -x -F -- 'lane: core' "$A2" || fail "move A2 backlog dropped the lane"
move "$CORE" A1 plan
want_code 0 "move A1 plan after A2 returned to backlog"
run python3 "$CORE/tools/monitor/card.py" lane core
[ "$OUT" = 'A1 plan running' ] || fail "card.py lane core does not print 'A1 plan running' after A2 returned to backlog" "$OUT"
echo "ok - one-per-lane"

CASE=owners
set +e
git -C "$ROOT" ls-files -z --cached --others --exclude-standard | "$ROOT/tools/factory/lane-check.sh" --owners >"$T/tmp/owners" 2>&1
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "a path of this checkout has no lane or two lanes in factory/lanes.json (lane or -, then the path)" "$(cat "$T/tmp/owners")"
summary="$(tail -n 1 "$T/tmp/owners")"
printf '%s\n' "$summary" | grep -q -E '^owners: [1-9][0-9]* paths, core [0-9]+, web [0-9]+, platform [0-9]+, 0 wrong$' \
  || fail "the summary line of --owners is not 'owners: <n> paths, core <a>, web <b>, platform <c>, 0 wrong'" "$summary"
python3 - "$ROOT/factory/lanes.json" >"$T/tmp/map" 2>&1 <<'PY' || fail "factory/lanes.json is not the map of the card's Plan" "$(cat "$T/tmp/map")"
import json, sys
WANT = {
    'core': ['crates/', 'packs/', 'datasets/', 'packages/schema/', 'Cargo.toml', 'Cargo.lock', 'package.json',
             'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json', 'Dockerfile', 'tools/toolchain.json',
             'rust-toolchain.toml', '.node-version', '.dockerignore', '.editorconfig', '.env.example', '.gitattributes',
             '.gitignore', 'biome.json', 'tsconfig.base.json', 'rustfmt.toml', 'compose.yaml', 'playwright.config.ts',
             'CLAUDE.md', 'README.md', 'packages/units/', 'packages/model/', 'packages/solver/', 'docs/'],
    'web': ['apps/web/', 'packages/ui/', 'packages/api-core/', 'packages/api-client/', 'packages/engine-protocol/',
            'packages/i18n/', 'e2e/'],
    'platform': ['apps/worker/', 'apps/judge/', 'apps/system/', 'packages/grader/', 'infra/', '.github/',
                 'tools/check.sh', 'tools/doctor.sh', 'tools/dev.sh', 'tools/entrypoint.sh', 'tools/test/',
                 'tools/monitor/', 'tools/factory/', 'factory/', '.claude/', '.bridle/', 'tools/agent-hq/'],
}
m = json.load(open(sys.argv[1], encoding='utf-8'))
bad = []
if m.get('lanes') != ['core', 'web', 'platform']:
    bad.append(f'lanes is {m.get("lanes")!r}, not core, web, platform')
if not isinstance(m.get('$comment'), str) or not m['$comment'].strip():
    bad.append('the file has no $comment')
have = {}
for e in m['paths']:
    if e['pattern'] in have:
        bad.append(f'{e["pattern"]}: listed twice')
    have[e['pattern']] = e['lane']
    if not isinstance(e.get('comment'), str) or not e['comment'].strip():
        bad.append(f'{e["pattern"]}: no comment')
want = {p: lane for lane, patterns in WANT.items() for p in patterns}
for p in sorted(set(want) | set(have)):
    if want.get(p) != have.get(p):
        bad.append(f'{p}: lane {have.get(p)}, expected {want.get(p)}')
print('\n'.join(bad))
sys.exit(1 if bad else 0)
PY
set +e
printf 'newdir/x\0crates/x/lib.rs\0' | "$M/tools/factory/lane-check.sh" --owners >"$T/tmp/owners" 2>&1
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "--owners with a path no pattern matches: exit $CODE, expected 1" "$(cat "$T/tmp/owners")"
[ "$(cat "$T/tmp/owners")" = "$(printf '%s\n' "-${TAB}newdir/x" 'owners: 2 paths, core 1, web 0, platform 0, 1 wrong')" ] \
  || fail "--owners does not name newdir/x with '-'" "$(cat "$T/tmp/owners")"
cp -p "$M/factory/lanes.json" "$T/tmp/lanes.json"
python3 - "$M/factory/lanes.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1], encoding='utf-8'))
m['paths'].append({'pattern': 'crates/', 'lane': 'web', 'comment': 'a second owner, for the test'})
json.dump(m, open(sys.argv[1], 'w', encoding='utf-8'))
PY
set +e
printf 'crates/x/lib.rs\0apps/web/a.ts\0' | "$M/tools/factory/lane-check.sh" --owners >"$T/tmp/owners" 2>&1
CODE=$?
set -e
cp -p "$T/tmp/lanes.json" "$M/factory/lanes.json"
[ "$CODE" -eq 1 ] || fail "--owners with a path of two lanes: exit $CODE, expected 1" "$(cat "$T/tmp/owners")"
[ "$(cat "$T/tmp/owners")" = "$(printf '%s\n' "core,web${TAB}crates/x/lib.rs" 'owners: 2 paths, core 0, web 1, platform 0, 1 wrong')" ] \
  || fail "--owners does not name crates/x/lib.rs with 'core,web'" "$(cat "$T/tmp/owners")"
echo "ok - owners"

CASE=check
CHECK="$WEB/tools/factory/lane-check.sh"
for base in '' HEAD; do
  run "$CHECK" web $base
  want_code 0 "lane-check.sh web $base on a clean tree"
  [ -z "$OUT" ] || fail "lane-check.sh web $base on a clean tree prints file lines" "$OUT"
  [ "$ERR" = 'lane-check: web: 0 files, 0 outside the lane' ] || fail "lane-check.sh web $base on a clean tree: the stderr line differs" "$ERR"
done
move "$WEB" W1 plan --lane web
want_code 0 "move W1 plan --lane web in the web worktree"
W1="factory/cards/$(basename "$(card "$WEB" W1)")"
WA1="factory/cards/$(basename "$(card "$WEB" A1)")"
echo '// changed' >> "$WEB/apps/web/a.ts"
git -C "$WEB" add apps/web/a.ts "$W1"
git -C "$WEB" commit -q -m 'Web work and its card'
run "$CHECK" web
want_code 0 "lane-check.sh web with a web file and the lane's card"
[ "$OUT" = "$(printf '%s\n' "own${TAB}web${TAB}apps/web/a.ts" "card${TAB}platform${TAB}$W1")" ] \
  || fail "lane-check.sh web does not print one 'own' and one 'card' line" "$OUT"
[ "$ERR" = 'lane-check: web: 2 files, 0 outside the lane' ] || fail "the stderr line differs" "$ERR"
run "$CHECK" core
want_code 1 "lane-check.sh core on the web lane's branch"
[ "$OUT" = "$(printf '%s\n' "foreign${TAB}web${TAB}apps/web/a.ts" "foreign${TAB}platform${TAB}$W1")" ] \
  || fail "lane-check.sh core does not name the web file and the web card as foreign" "$OUT"
echo '// foreign' >> "$WEB/crates/x/lib.rs"
git -C "$WEB" add crates/x/lib.rs
git -C "$WEB" commit -q -m 'A core file from the web lane'
echo '# uncommitted' >> "$WEB/Cargo.toml"
mkdir "$WEB/newdir"
echo 'untracked' > "$WEB/newdir/y"
echo 'a note' >> "$WEB/$WA1"
run "$CHECK" web
want_code 1 "lane-check.sh web with files outside the lane"
want="$(printf '%s\n' "foreign${TAB}core${TAB}Cargo.toml" "own${TAB}web${TAB}apps/web/a.ts" "foreign${TAB}core${TAB}crates/x/lib.rs" \
  "foreign${TAB}platform${TAB}$WA1" "card${TAB}platform${TAB}$W1" "unowned${TAB}-${TAB}newdir/y")"
[ "$OUT" = "$want" ] || fail "lane-check.sh web does not print the six expected lines" "$OUT"
[ "$ERR" = 'lane-check: web: 6 files, 4 outside the lane' ] || fail "the stderr line differs" "$ERR"
run "$CHECK" nosuch
want_code 2 "lane-check.sh nosuch"
run "$CHECK" web no-such-base
want_code 2 "lane-check.sh web no-such-base"
run "$CHECK"
want_code 2 "lane-check.sh without arguments"
echo "ok - check"

CASE=remove
git -C "$CORE" add -A
git -C "$CORE" commit -q -m 'Core lane work'
git -C "$CORE" rebase -q origin/main
run "$LANE" remove core
want_code 1 "remove core with a commit of its own"
printf '%s\n' "$ERR" | grep -q -F -- 'lane/core has 1 commit not in origin/main' || fail "the refusal does not say '1 commit'" "$ERR"
printf '%s\n' "$ERR" | grep -q -F -- 'Core lane work' || fail "the refusal does not show the commit's subject" "$ERR"
if [ ! -d "$CORE" ] || ! has_branch lane/core; then fail "the refused remove took the worktree or the branch"; fi
git -C "$CORE" push -q origin lane/core:main
run "$LANE" remove core
want_code 0 "remove core after the branch is in origin/main"
[ "$OUT" = "removed lane core ($CORE, lane/core)" ] || fail "remove core does not print the removed lane" "$OUT"
[ ! -e "$CORE" ] || fail "remove core left the directory"
git -C "$M" worktree list --porcelain | grep -q -F -- "$CORE" && fail "remove core left the worktree entry"
has_branch lane/core && fail "remove core left the branch"
echo 'untracked' > "$PLAT/untracked.txt"
run "$LANE" remove platform
want_code 1 "remove platform with an untracked file"
if [ ! -d "$PLAT" ] || ! has_branch lane/platform; then fail "the refused remove took the worktree or the branch"; fi
rm "$PLAT/untracked.txt"
run "$WEB/tools/factory/lane.sh" remove platform
want_code 0 "remove platform (no commits of its own)"
if [ -e "$PLAT" ] || has_branch lane/platform; then fail "remove platform left the directory or the branch"; fi
run "$LANE" remove web
want_code 1 "remove web with commits of its own"
printf '%s\n' "$ERR" | grep -q -F -- 'lane/web has 2 commits not in origin/main' || fail "the refusal does not say '2 commits'" "$ERR"
if [ ! -d "$WEB" ] || ! has_branch lane/web; then fail "the refused remove took the worktree or the branch"; fi
run "$LANE" remove nosuch
want_code 1 "remove nosuch"
printf '%s\n' "$ERR" | grep -q -F -- 'no lane nosuch' || fail "remove nosuch does not say 'no lane nosuch'" "$ERR"
run "$LANE" list
[ "$OUT" = "web${TAB}$WEB${TAB}lane/web${TAB}running W1 plan" ] || fail "list after the removals is not the web lane alone" "$OUT"
echo "ok - remove"

CASE=clean
rm -rf "$T"
[ ! -e "$T" ] || fail "the temporary directory $T is still there"
wt_after="$(ls -1 "$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)/worktrees" 2>/dev/null || true)"
br_after="$(git -C "$ROOT" for-each-ref --format='%(refname)' refs/heads/lane/)"
[ "$wt_after" = "$wt_before" ] || fail "the worktrees of this checkout changed" "$wt_after"
[ "$br_after" = "$br_before" ] || fail "the lane/* branches of this checkout changed" "$br_after"
echo "ok - clean"
