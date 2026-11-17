#!/usr/bin/env bash
# Tests for card P0-11 (resume-ability: the plan copies, the root README, the progress and decisions logs): one case per
# acceptance criterion, in the card's order, then three cases for the Spec's two addenda (the foreman's and the audit's).
#   plan-copies    AC1  docs/plan/roadmap.md and docs/plan/monitor-v4.md: a header block above the first `# ` line naming
#                       `approved 2026-11-03`, `Canonical`, `amendments`, `Origin` and the origin path; the roadmap's header
#                       also says Part D sections D2 to D6 are superseded by docs/plan/monitor-v4.md and tools/monitor/README.md
#                       and that docs/plan/progress.md is the live status (audit addendum), and the roadmap has those D2 to
#                       D6 sections; the body (from the first `# ` line on) has exactly 371 / 109 lines by `grep -c ''`,
#                       starts with the pinned H1, ends with the pinned last line, has the pinned sha256 and ends in one
#                       newline (the committed copies are canonical; an amendment to the plan changes these pins on purpose,
#                       in the same commit; nothing outside the repository is read)
#   readme         AC2  README.md: at most 80 lines, at least 12 links, every relative link resolves (anchor stripped) and
#                       every `#anchor` into a markdown file is one of its headings; the six sections; one link into each of
#                       the ten repository-map directories; the commands, files and rules a reader resumes with are named;
#                       the `tools/agent-hq/` line carries no link; the event log is called machine-local and the cards
#                       and git the durable record (audit addendum)
#   board          AC3  `card.py status --check docs/plan/progress.md` exits 0 silently; each marker once; the table header;
#                       one row per card file; `Next up:`; two runs of `status` give the same bytes; the owner table (one
#                       row per E4 row, E4.1 to E4.9, the six M0 items, every status done/open/unknown, done rows naming a
#                       commit); the next block names P0-02.5, P0-02.6, P0-08 and the owner items; every card with
#                       `status: done` has a dated `## Log` entry with a 7-hex commit; the P0-06 and P0-02.4 entries and the
#                       pre-Actions sentence; on mktemp copies: a `done` cell flipped to `planned`, a row removed and a row
#                       without a card make `--check` exit 1 naming the copy, a station-only change keeps it at 0
#   decisions      AC4  docs/decisions/log.md: the `| Date | Decision | Who |` header, links to the two ADR files that
#                       resolve, every AC4 entry present by keyword, at least 17 dated rows, one row per plan-approval
#                       decision 1 to 5 (1 and 4 "default in force, not yet answered"), the Part D, P0-08 and 5 s rows cite
#                       the plan copies and are not "chat only", the intro defines the "chat only" marker (any row may carry
#                       it), the P0-02.2 row is the plan station's; every backticked path exists, every `card <id>` has a card file, every roadmap line
#                       the log cites holds the cited text, the cited ADR rows, history lines and documents exist
#   factory-docs   AC5  factory/README.md has `## Resume` (the reading order) and `## Several sessions at once` (the four
#                       rules) and its links resolve; line.md's ship row and the README's ship sentence follow the ship
#                       order, and the row says the board is regenerated, the log entry written and a phase exit is an
#                       entry; SKILL.md step 0 reads docs/plan/roadmap.md, step 1 commits `Cards: <id> spec`, step 6 keeps
#                       the ship order (the `<id>: <title>` commit through `## Review`; then `## Ship`, the move to done,
#                       the board and the log entry in the `Cards: <id> shipped` commit), `status` runs
#                       `--check`, the second-card exception, E2 rows in docs/plan/roadmap.md, and never names the plan
#                       file outside the repository; factory-planner.md and factory-tester.md quote the E1 fixtures rule
#   roadmap-cards  AC6  every E2 id of the roadmap has exactly one card file; every non-sub-card, non-exempt card is an E2
#                       id; dependsOn vs After and estimate vs Size differences are `# warning:` lines, never failures
#   doc-fixes      audit addendum: the one-line fixes (08 MVP-02 superseded; ADR 0002's file-08 list; the UX MVP screen
#                       count agrees with the inventory; secrets.md's .gitignore sentence; the three plan pointers in
#                       secrets.md, build-sequence.md and 00-index.md) and the README's requirement counts
#   check-steps    AC6  tools/check.sh runs this test as step 7 of 7; workspace.test.sh pins 7; nothing else pins 6
#   pause-check    the pause check of 2026-11-04 (commit 8cdcf34): CLAUDE.md links README.md and names the plan, the
#                       progress log, the decisions log and the factory files, all existing, with the several-sessions
#                       rules and the pause-note pointer; the `## Log` has a `- Paused <date> <time>` entry and card
#                       P0-11's Spec the pause note the decisions log cites; the "Other local ports" table of
#                       docs/ops/local-dev.md holds every host port compose.yaml publishes, the Dockerfile's PORT, the
#                       default port of tools/monitor/serve.py and Agent HQ's three ports as its sources set them, and
#                       says the viewer and Agent HQ's API clash exactly while their defaults are equal (card P0-12);
#                       the Agent HQ section of docs/ops/secrets.md names every variable of tools/agent-hq/.env.example
#                       and carries no assignment; the decisions log has the pause rows; card P0-12 has one file
#   git-facts      AC2, AC3, AC4 when the repository is a git work tree (skipped in a plain copy of the files): every
#                       README link is tracked or a new, unignored file; every commit hash the two logs cite exists (skipped
#                       in a shallow clone); every log entry's commit carries the card id in its subject (or the entry says
#                       where the hash comes from) and its time on the UTC+8 clock; the commit docs/ops/secrets.md names
#                       for the .env patterns is the one `git log -S'.env.local' -- .gitignore` finds (loop 1 item 1,
#                       proved, not only pinned); a pause entry cites no commit made after its own time; CLAUDE.md is
#                       tracked and tools/agent-hq/.env is not
# Added at the second test station (2026-11-17), inside the cases above: readme: the resume preconditions as SKILL.md
# step 0 has them (loop 1 item 6) and a `/factory run` path for a parked or in-flight card in `## How to resume`;
# board: each E4.n row of the owner table carries the roadmap E4 row n's "Needed before" cell, an M0 row citing (E4.n)
# names no card outside that row, the six M0 rows and their date are architecture.md's M0 line, the R2 row (loop 1
# items 2 and 7); the shape line of `## Log` and every entry's shape (item 8); a done card's log hash is in its
# `## Ship` section or the entry says where it comes from (item 3 and the pause check's three fills); the in-flight
# block's "last shipped card" is the newest done card and a card it calls parked is not done (so the block is rewritten
# in the `Cards: <id> shipped` commit); decisions: the P0-11 row (item 9), the marker in full on every chat-only row,
# and no unconditional "is left out" sentence in the intro while rows are chat only; factory-docs: a `/factory run`
# path in `## Resume`.
# Added at the third test station (2026-11-17, after loop 2), inside the cases above, one block per ruling of the card's
# Spec ("Resume and rulings" 1 to 10, second rulings 11 to 13): plan-copies: the roadmap header is seven lines with one
# Origin line that dates the copy by its commit and gives the origin's and the body's sizes, and the body has that size;
# readme: the resume rule by station with the statuses and stations card.py names, `next` never taking a card in flight
# (a fixture), the work-package clause and its SKILL.md source, the one-watch condition, and the tools/test label against
# the second line of every file of tools/test and the shipped P0-02 and P0-06 sub-cards; board: one regeneration rule in
# README.md and docs/plan/progress.md and no "touches a card" in any factory document, the E4.7 status while the
# roadmap's landing directory does not exist, the pause shape in the `## Log` shape paragraph and on every pause entry, the
# in-flight heading by the name the ship documents use; decisions: the intro's either/or rule held against every row;
# factory-docs: the resume rule in `## Resume`, the in-flight rewrite in the README's ship sentence, the ship row and
# step 6 (between the log entry and the Cards commit), the one-watch rule in steps 0 and 7, the mirror write for both
# database tools in step 0 and in `new` with what it takes from .bridle/monitor.json, the Mirroring paragraph, the station
# prompt's trace sentence against tools/monitor/README.md and against what tools/monitor/trace_hook.py records; git-facts:
# the time, size and line count the Origin line gives for commit 8e0e550.
#
# Run:  bash tools/test/docs.test.sh      (from any directory; the script finds the repository from its own path)
# Step 7 of tools/check.sh, so `pnpm check` and CI's code job (ubuntu) run it.
# Prints `ok - <case>` per case (and `# ...` comment lines); stops at the first failed assertion with
# `not ok - <case>: <why>` on stderr, exit 1. Needs bash 3.2, python3, grep, sed, awk, sort, cut, tr, cmp, mktemp; git
# only for the git-facts case, which is skipped where the repository is not a git work tree; no network, no toolchain.
# Read-only inside the repository: the only writes are files under `mktemp -d`.
set -u
set -o pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CASE=setup

fail() {  # $1 = why; $2 = output to show (optional). Prints `not ok` and exits 1.
  echo "not ok - $CASE: $1" >&2
  if [ -n "${2-}" ]; then
    echo "--- output ---" >&2
    printf '%s\n' "$2" >&2
    echo "--- end ---" >&2
  fi
  exit 1
}

for t in python3 grep sed awk sort cut tr cmp mktemp; do
  command -v "$t" >/dev/null 2>&1 || fail "$t is not on PATH"
done
tmp="$(mktemp -d)" || fail "mktemp -d failed"
trap 'rm -rf "$tmp"' EXIT

sha256_of() {  # $1 = file: its sha256 hex digest (python3, so macOS and ubuntu agree on the tool)
  python3 -c 'import hashlib, sys; print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest())' "$1"
}
slugs_of() {  # $1 = markdown file: its headings as GitHub anchors (lower case; letters, digits, `-` and `_` kept; spaces to `-`)
  sed -n 's/^#\{1,6\} //p' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 _-]//g; s/ /-/g'
}
links_of() {  # $1 = markdown file: every `](target)` target, one per line
  grep -o '](\([^)]*\))' "$1" | sed 's/^](//; s/)$//'
}

ROADMAP="$ROOT/docs/plan/roadmap.md"
README="$ROOT/README.md"
PROGRESS="$ROOT/docs/plan/progress.md"
DEC="$ROOT/docs/decisions/log.md"
ADR1="$ROOT/docs/decisions/0001-mvp-scope-resolutions.md"
ADR2="$ROOT/docs/decisions/0002-architecture-amendments.md"
SKILL="$ROOT/.claude/skills/factory/SKILL.md"

# ---- plan-copies (AC1) ------------------------------------------------------------------------------------------
CASE=plan-copies
check_copy() {  # $1 = file relative to ROOT, $2 = body lines, $3 = H1, $4 = last-line prefix, $5 = body sha256
  local rel="$1" want_n="$2" h1="$3" last_prefix="$4" want_sha="$5" f="$ROOT/$1" n first last sha
  [ -f "$f" ] || fail "$rel does not exist"
  awk '/^# /{exit} {print}' "$f" > "$tmp/header"
  [ -s "$tmp/header" ] || fail "$rel has no header block above its first '# ' line"
  for s in 'approved 2026-11-03' Canonical amendments Origin 'docs/decisions/log.md' 'docs/plan/progress.md'; do
    grep -q -F -- "$s" "$tmp/header" || fail "the header of $rel does not contain '$s'"
  done
  awk 'f||/^# /{f=1;print}' "$f" > "$tmp/body"
  n="$(grep -c '' "$tmp/body")"
  [ "$n" -eq "$want_n" ] || fail "the body of $rel has $n lines, expected $want_n"
  first="$(sed -n '1p' "$tmp/body")"
  [ "$first" = "$h1" ] || fail "the body of $rel starts with '$first', expected '$h1'"
  last="$(tail -n 1 "$tmp/body")"
  case "$last" in
    "$last_prefix"*) ;;
    *) fail "the last body line of $rel does not start with '$last_prefix': '$last'" ;;
  esac
  sha="$(sha256_of "$tmp/body")"
  [ "$sha" = "$want_sha" ] \
    || fail "the body of $rel has sha256 $sha, expected $want_sha (an amendment to the plan updates this pin in the same commit)"
  [ "$(tail -c 1 "$f" | wc -l | tr -d ' ')" -eq 1 ] || fail "$rel does not end with a newline"
  [ "$(tail -c 2 "$f" | wc -l | tr -d ' ')" -eq 1 ] || fail "$rel ends with a blank line"
  echo "# $rel: body $n lines, H1 '$h1', sha256 $sha"
}
check_copy docs/plan/roadmap.md 371 '# Bridle: Structural-Engineering Simulation LMS, Full Plan' \
           'Acceptance for the MVP, in two steps.' 13be1eabdbc6691c4750275b40fb9b30fdaa4dcee1749789bf6e3e78ca694547
check_copy docs/plan/monitor-v4.md 109 '# Bridle Build Monitor v4: live progress' 'Product code; the card format;' \
           377557813c4847d557551e209d3f62130ac70a433d5dc5bc686e45c65cc12b66
# The audit addendum's header lines (roadmap) and the origin paths; the superseded sections exist in the body.
awk '/^# /{exit} {print}' "$ROADMAP" > "$tmp/header"
for s in '/Users/johnstephenf.garcia/.claude/plans/lets-plan-first-in-stateless-pizza.md' 'Superseded in part' 'D2 to D6' \
         'docs/plan/monitor-v4.md' 'tools/monitor/README.md' 'protocol v2' 'As of' 'PLAN-05 sits at review' \
         'second approval' 'Part D only'; do
  grep -q -F -- "$s" "$tmp/header" || fail "the header of docs/plan/roadmap.md does not contain '$s'"
done
for d in D2 D3 D4 D5 D6; do
  grep -q "^### $d\. " "$ROADMAP" || fail "docs/plan/roadmap.md has no '### $d. ' section (the header says D2 to D6 are superseded)"
done
awk '/^# /{exit} {print}' "$ROOT/docs/plan/monitor-v4.md" > "$tmp/header"
for s in '/Users/johnstephenf.garcia/.claude/plans/can-we-plan-on-floofy-forest.md' 'card P0-10' '126d1f8'; do
  grep -q -F -- "$s" "$tmp/header" || fail "the header of docs/plan/monitor-v4.md does not contain '$s'"
done
# Third test station, rulings 8 and 13 (F9): the roadmap's header stays seven lines (the decisions log cites the roadmap
# by file line, the body line + 7) with one Origin line; that line dates the copy by its commit, not "as it stood", gives
# the origin's size and the body's (one byte more, the final newline), and says what the body is verified against. The
# sizes it gives are those of the body here; the git-facts case holds the commit's side of the line.
awk '/^# /{exit} {print}' "$ROADMAP" > "$tmp/header"
nh="$(grep -c '' "$tmp/header")"
[ "$nh" -eq 7 ] \
  || fail "the header of docs/plan/roadmap.md has $nh lines, expected 7 (every roadmap line docs/decisions/log.md cites is the body line + 7)"
grep '^> \*\*Origin:\*\*' "$tmp/header" > "$tmp/origin" || true
no="$(grep -c '' "$tmp/origin")"
[ "$no" -eq 1 ] || fail "the header of docs/plan/roadmap.md has $no '> **Origin:**' lines, expected 1"
for s in 'as committed verbatim in 8e0e550 (2026-11-03 22:32 +0800)' 'committed verbatim in 8e0e550), copied unchanged' \
         'differs from that file by one byte, the final newline it lacked' 'That path has since been reused' \
         'verified against 8e0e550' 'the sha256 pin in tools/test/docs.test.sh' 'not against the path'; do
  grep -q -F -- "$s" "$tmp/origin" || fail "the Origin line of docs/plan/roadmap.md does not say '$s'"
done
grep -q -F -- 'as it stood' "$tmp/origin" \
  && fail "the Origin line of docs/plan/roadmap.md still dates the copy 'as it stood'; ruling 13 dates it by its commit, 8e0e550"
osize="$(sed -n 's/.*(\([0-9][0-9]*\) lines, \([0-9][0-9,]*\) bytes; committed verbatim.*/\1 \2/p' "$tmp/origin" | tr -d ',')"
bsize="$(sed -n 's/.*(so \([0-9][0-9,]*\) bytes).*/\1/p' "$tmp/origin" | tr -d ',')"
[ -n "$osize" ] && [ -n "$bsize" ] \
  || fail "the Origin line of docs/plan/roadmap.md does not give '(<n> lines, <n> bytes; committed verbatim ...' and '(so <n> bytes)'"
olines="${osize%% *}"
obytes="${osize#* }"
awk 'f||/^# /{f=1;print}' "$ROADMAP" > "$tmp/body"
nb="$(wc -c < "$tmp/body" | tr -d ' ')"
nl="$(grep -c '' "$tmp/body")"
[ "$nb" -eq "$bsize" ] || fail "the body of docs/plan/roadmap.md has $nb bytes; its Origin line says $bsize"
[ "$nl" -eq "$olines" ] || fail "the body of docs/plan/roadmap.md has $nl lines; its Origin line gives the origin $olines"
[ "$nb" -eq $((obytes + 1)) ] \
  || fail "the Origin line of docs/plan/roadmap.md gives the origin $obytes bytes and says the body differs by one byte; the body has $nb"
echo "ok - plan-copies"

# ---- readme (AC2) -----------------------------------------------------------------------------------------------
CASE=readme
[ -f "$README" ] || fail "README.md does not exist"
n="$(grep -c '' "$README")"
[ "$n" -le 80 ] || fail "README.md has $n lines, limit 80"
links_of "$README" > "$tmp/links"
nlinks="$(grep -c . "$tmp/links")"
[ "$nlinks" -ge 12 ] || fail "README.md has $nlinks links, expected at least 12"
nrel=0
nanch=0
: > "$tmp/paths"
while IFS= read -r target; do
  [ -n "$target" ] || continue
  case "$target" in http://*|https://*|mailto:*|'#'*) continue ;; esac
  path="${target%%#*}"
  [ -e "$ROOT/$path" ] || fail "README.md link '$target' does not resolve ($path)"
  printf '%s\n' "$path" >> "$tmp/paths"
  nrel=$((nrel + 1))
  case "$target" in
    *.md'#'*)
      anchor="${target#*#}"
      slugs_of "$ROOT/$path" | grep -q -x -F -- "$anchor" || fail "README.md anchor '$target' is not a heading of $path"
      nanch=$((nanch + 1)) ;;
  esac
done < "$tmp/links"
for h in '## Start here' '## Repository map' '## Where the state is' '## How to resume' '## By hand' '## Several sessions'; do
  grep -q "^$h" "$README" || fail "README.md has no '$h' section"
done
for p in docs/requirements docs/architecture docs/ux docs/decisions docs/ops docs/plan factory tools packages crates; do
  grep -q -E "^$p(/|$)" "$tmp/paths" || fail "README.md has no link into $p"
done
for s in 'python3 tools/monitor/card.py list' '/factory status' '/factory next' 'docs/plan/progress.md' \
         '.bridle/monitor.json' 'tools/monitor/serve.py' '.claude/skills/factory/SKILL.md' 'E4' 'git add -A' \
         'bash tools/doctor.sh' 'pnpm check' 'dependsOn' 'tools/monitor/watch.sh' 'card.py status --write docs/plan/progress.md' \
         '.bridle/progress/' 'machine-local' 'durable record' 'aac9cca'; do
  grep -q -F -- "$s" "$README" || fail "'$s' is not in README.md"
done
nhq="$(grep -c -F -- 'tools/agent-hq/' "$README")"
[ "$nhq" -eq 1 ] || fail "README.md names tools/agent-hq/ on $nhq lines, expected exactly one"
grep -F -- 'tools/agent-hq/' "$README" | grep -q -F -- '](' && fail "the tools/agent-hq/ line of README.md carries a link"
grep -q -F -- '~/.claude/plans' "$README" && fail "README.md names the plan file outside the repository"
# Loop 1 item 6: the resume preconditions are those of SKILL.md step 0 (roadmap approval only for P1 and later cards; the
# watch is armed by step 0 after the preconditions, it is not one of them), and SKILL.md step 0 says so.
for s in 'for P1 and later cards the roadmap is approved' 'step 0 then arms the watch'; do
  grep -q -F -- "$s" "$README" || fail "'$s' is not in README.md (the preconditions of SKILL.md step 0)"
done
grep -q -F -- 'the watch is armed' "$README" \
  && fail "README.md still lists the armed watch as a precondition (SKILL.md step 0 arms it after the preconditions)"
tr '\n' ' ' < "$SKILL" | sed 's/  */ /g' > "$tmp/skill.flat"
for s in "if the card's phase is P1 or later" 'Then arm the mirror'; do
  grep -q -F -- "$s" "$tmp/skill.flat" || fail "SKILL.md step 0 does not say '$s', which README.md's resume preconditions rest on"
done
# Second test station, finding F1: `/factory next` picks only a backlog card (card.py next_up), so it never resumes a card
# parked or in flight; docs/plan/progress.md and the pause note at the end of a parked card's Spec say `/factory run <id>`.
awk '/^## How to resume/{f=1;next} /^## /{f=0} f' "$README" > "$tmp/readme-resume"
grep -q -F -- '/factory run' "$tmp/readme-resume" \
  || fail "the '## How to resume' section of README.md gives only '/factory next', which never selects a parked or in-flight card (card.py next_up takes backlog cards only); it must also give the '/factory run <id>' path that docs/plan/progress.md and the card's pause note give"
# Third test station, rulings 1 and 11 (F1): the resume rule goes by station, whatever the status; the work-package clause
# and the one-watch condition stand beside it (ratifications b and d), and each rests on its source: the statuses are the
# names of card.py's `move` usage line, "from spec to review" are the stations between backlog and ship in card.py's
# STATIONS, SKILL.md holds the quoted work-package sentence, and `next` (card.py's next up) never takes a card in flight.
tr '\n' ' ' < "$tmp/readme-resume" | sed 's/  */ /g' > "$tmp/readme-resume.flat"
for s in 'a parked or in-flight card comes first' \
         'shows at a station from spec to review is in flight whatever its status' \
         '(running, blocked, failed or review, as `card.py move` names them)' 'is resumed with `/factory run <id>`' \
         'the pause note of its Spec' 'A work-package row waiting at spec while its sub-cards run is not such a card' \
         '"is a work package, not a card"' 'Otherwise `/factory next`, which takes backlog cards only' \
         'step 0 then arms the watch unless another session is already the mirror'; do
  grep -q -F -- "$s" "$tmp/readme-resume.flat" || fail "the '## How to resume' section of README.md does not say '$s'"
done
grep -q -F -- 'with status running or blocked' "$tmp/readme-resume.flat" \
  && fail "the '## How to resume' section of README.md still goes by a list of statuses ('with status running or blocked'); ruling 11 goes by station, whatever the status"
grep -q -F -- 'is a work package, not a card' "$tmp/skill.flat" \
  || fail "SKILL.md no longer says a roadmap row 'is a work package, not a card', which README.md quotes"
CARDPY="$ROOT/tools/monitor/card.py"
grep -q -x -F -- "STATIONS = ['backlog', 'spec', 'plan', 'build', 'test', 'review', 'ship']" "$CARDPY" \
  || fail "tools/monitor/card.py no longer has the stations backlog, spec, plan, build, test, review, ship in that order; 'a station from spec to review' in README.md and factory/README.md rests on it"
moves="$(sed -n 's/^ *card\.py move .*\[--status \([a-z|]*\)\].*/\1/p' "$CARDPY" | sed -n '1p')"
[ -n "$moves" ] || fail "tools/monitor/card.py has no 'card.py move ... [--status a|b|...]' usage line, which README.md cites for its status names"
for w in running blocked failed review; do
  case "|$moves|" in
    *"|$w|"*) ;;
    *) fail "README.md names the status '$w' 'as card.py move names them'; the usage line of card.py move names '$moves'" ;;
  esac
done
# One card at every station from spec to review with every status the README names, each ordered before one backlog card:
# next up is the backlog card.
mkdir "$tmp/cards-next" || fail "mkdir failed"
k=0
for st in spec plan build test review; do
  for sta in running blocked failed review; do
    k=$((k + 1))
    printf '%s\n' '---' "id: F$k" "title: At $st $sta" 'phase: P9' "order: $k" 'dependsOn: []' "station: $st" "status: $sta" \
      'owner: -' 'updated: 2026-01-01T00:00:00Z' 'history:' '---' '' "# F$k At $st $sta" > "$tmp/cards-next/F$k-in-flight.md"
  done
done
printf '%s\n' '---' 'id: Z1' 'title: Waits at backlog' 'phase: P9' 'order: 99' 'dependsOn: []' 'station: backlog' 'status: planned' \
  'owner: -' 'updated: 2026-01-01T00:00:00Z' 'history:' '---' '' '# Z1 Waits at backlog' > "$tmp/cards-next/Z1-waits.md"
(cd "$ROOT" && python3 tools/monitor/card.py status --cards "$tmp/cards-next") > "$tmp/next.out" 2> "$tmp/next.err" \
  || fail "card.py status --cards <fixture> failed" "$(cat "$tmp/next.err")"
nx="$(sed -n 's/^Next up: //p' "$tmp/next.out")"
[ "$nx" = 'Z1 Waits at backlog' ] \
  || fail "with $k cards in flight (every station from spec to review, statuses running, blocked, failed and review) ordered before one backlog card, card.py says next up is '$nx', not the backlog card; README.md says /factory next takes backlog cards only"
# Third test station, ruling 3 (F3): the tools/test label of the repository map, against the files' own second lines and
# the cards: every file of tools/test names one card there, no two name the same card, each named card is P0-11, P0-08.2
# (lanes.test.sh, added by that card) or a P0-02 or P0-06 sub-card, and every shipped (done) P0-02 or P0-06 sub-card has its file. A test file for a card of
# another row, or a P0-02 sub-card shipped without one, fails here: reword the label and this block in that commit.
for s in 'one test file per shipped P0-02 and P0-06 sub-card, plus `docs.test.sh` for P0-11 and `lanes.test.sh` for P0-08.2' \
         "the monitor's tests are in \`tools/monitor/test\`"; do
  grep -q -F -- "$s" "$README" || fail "the tools/test label of README.md's repository map does not say '$s'"
done
grep -q -F -- 'one test per tooling card' "$README" \
  && fail "README.md still labels tools/test 'one test per tooling card'; its files are the tests of the P0-02 and P0-06 sub-cards, of P0-11 and of P0-08.2"
nmt=0
for f in "$ROOT"/tools/monitor/test/*.test.*; do [ -f "$f" ] && nmt=$((nmt + 1)); done
[ "$nmt" -gt 0 ] || fail "tools/monitor/test holds no test file; README.md says the monitor's tests are there"
: > "$tmp/test-cards"
ntf=0
for f in "$ROOT"/tools/test/*; do
  [ -f "$f" ] || continue
  sed -n '2p' "$f" | grep -o -E 'card (P[0-9X]-[0-9]{2}(\.[0-9]{1,2})?|PLAN-[0-9]{2})' > "$tmp/test-card" || true
  id="$(sed -n '1p' "$tmp/test-card" | sed 's/^card //')"
  [ -n "$id" ] || fail "tools/test/${f##*/} names no card in its second line; README.md says each file of tools/test is the test of one card"
  case "$id" in
    P0-11) [ "${f##*/}" = 'docs.test.sh' ] || fail "tools/test/${f##*/} names card P0-11; README.md says P0-11's test file is docs.test.sh" ;;
    P0-08.2)
      [ "${f##*/}" = 'lanes.test.sh' ] || fail "tools/test/${f##*/} names card P0-08.2; README.md says P0-08.2's test file is lanes.test.sh"
      c=0
      for g in "$ROOT/factory/cards/$id"-*.md; do [ -f "$g" ] && c=$((c + 1)); done
      [ "$c" -eq 1 ] || fail "tools/test/${f##*/} names card $id, which has $c files factory/cards/$id-*.md" ;;
    P0-02.[0-9]|P0-06.[0-9])
      c=0
      for g in "$ROOT/factory/cards/$id"-*.md; do [ -f "$g" ] && c=$((c + 1)); done
      [ "$c" -eq 1 ] || fail "tools/test/${f##*/} names card $id, which has $c files factory/cards/$id-*.md" ;;
    *) fail "tools/test/${f##*/} names card $id, which is neither a P0-02 or P0-06 sub-card nor P0-11 nor P0-08.2; README.md says tools/test holds one test file per shipped P0-02 and P0-06 sub-card, plus docs.test.sh for P0-11 and lanes.test.sh for P0-08.2" ;;
  esac
  printf '%s\n' "$id" >> "$tmp/test-cards"
  ntf=$((ntf + 1))
done
[ "$(sort -u "$tmp/test-cards" | grep -c .)" -eq "$ntf" ] \
  || fail "two files of tools/test name the same card in their second line; README.md says one test file per card" "$(sort "$tmp/test-cards")"
grep -q -x -F -- 'P0-11' "$tmp/test-cards" || fail "no file of tools/test names card P0-11; README.md says docs.test.sh is its test"
nsub=0
for f in "$ROOT"/factory/cards/P0-02.[0-9]-*.md "$ROOT"/factory/cards/P0-06.[0-9]-*.md; do
  [ -f "$f" ] || continue
  grep -q '^status: done$' "$f" || continue
  id="$(sed -n 's/^id: *//p' "$f" | sed -n '1p')"
  grep -q -x -F -- "$id" "$tmp/test-cards" \
    || fail "shipped sub-card $id has no test file in tools/test (a file naming 'card $id' in its second line); README.md says one test file per shipped P0-02 and P0-06 sub-card"
  nsub=$((nsub + 1))
done
echo "# readme: $n lines, $nlinks links, $nrel relative links resolve, $nanch anchors are headings"
echo "# readme: resume by station ($k in-flight fixture cards, next up the backlog card); tools/test: $ntf files, $nsub shipped P0-02 and P0-06 sub-cards and P0-11"
echo "ok - readme"

# ---- board (AC3) ------------------------------------------------------------------------------------------------
CASE=board
[ -f "$PROGRESS" ] || fail "docs/plan/progress.md does not exist"
OUT="$(cd "$ROOT" && python3 tools/monitor/card.py status --check docs/plan/progress.md 2>&1)"
RC=$?
[ "$RC" -eq 0 ] \
  || fail "card.py status --check docs/plan/progress.md: exit $RC (run python3 tools/monitor/card.py status --write docs/plan/progress.md)" "$OUT"
[ -z "$OUT" ] || fail "card.py status --check printed something on a current board" "$OUT"
for m in '<!-- board:start -->' '<!-- board:end -->'; do
  c="$(grep -c -x -F -- "$m" "$PROGRESS")"
  [ "$c" -eq 1 ] || fail "'$m' occurs $c times in docs/plan/progress.md, expected once"
done
awk '/^<!-- board:start -->$/{f=1} f{print} /^<!-- board:end -->$/{exit}' "$PROGRESS" > "$tmp/section"
hdr="$(sed -n '2p' "$tmp/section")"
[ "$hdr" = '| id | phase | station | status | owner | updated |' ] || fail "the board's table header is '$hdr'"
[ "$(sed -n '3p' "$tmp/section")" = '|---|---|---|---|---|---|' ] || fail "the board's separator line is not '|---|---|---|---|---|---|'"
grep -q '^Next up: ' "$tmp/section" || fail "the board has no 'Next up:' line"
nrows="$(grep -c '^| [A-Z]' "$tmp/section")"
ncards=0
for f in "$ROOT"/factory/cards/*.md; do [ -f "$f" ] && ncards=$((ncards + 1)); done
[ "$nrows" -eq "$ncards" ] || fail "the board has $nrows rows, factory/cards holds $ncards files"
(cd "$ROOT" && python3 tools/monitor/card.py status > "$tmp/b1" 2>"$tmp/b1.err" && python3 tools/monitor/card.py status > "$tmp/b2" 2>/dev/null) \
  || fail "card.py status failed" "$(cat "$tmp/b1.err")"
cmp -s "$tmp/b1" "$tmp/b2" || fail "two runs of card.py status on the same cards differ"
[ ! -s "$tmp/b1.err" ] || fail "card.py status printed on stderr" "$(cat "$tmp/b1.err")"
grep -q '^## In flight' "$PROGRESS" || fail "docs/plan/progress.md has no '## In flight' section"
grep -q '^## Log' "$PROGRESS" || fail "docs/plan/progress.md has no '## Log' section"
awk '/^## In flight/{f=1} /^## Log/{f=0} f' "$PROGRESS" > "$tmp/owner-block"
grep -q -x -F -- '| Item | Needed before | Due | Status |' "$tmp/owner-block" \
  || fail "docs/plan/progress.md has no '| Item | Needed before | Due | Status |' table in its owner block"
grep -E '^\| (E4\.[0-9]|M0 )' "$tmp/owner-block" > "$tmp/owner-rows" || true
nown="$(grep -c . "$tmp/owner-rows")"
[ "$nown" -ge 15 ] || fail "the owner table has $nown rows, expected at least 15 (the nine E4 rows and the six M0 items)"
for i in 1 2 3 4 5 6 7 8 9; do
  c="$(grep -c "^| E4\.$i " "$tmp/owner-rows")"
  [ "$c" -eq 1 ] || fail "E4.$i has $c rows in the owner table, expected 1"
done
for s in '| M0 Counsel' '| M0 AISC' '| M0 SME framework' '| M0 Design partners' '| M0 Spring-2028' '| M0 Contractor R2'; do
  grep -q -F -- "$s" "$tmp/owner-rows" || fail "the owner table has no '$s' row"
done
bad="$(cut -d'|' -f5 "$tmp/owner-rows" | sed 's/^ *//' | grep -v -E '^(done|open|unknown)' || true)"
[ -z "$bad" ] || fail "owner-table status cells that do not start with done, open or unknown" "$bad"
nodone="$(awk -F'|' '$5 ~ /^ *done/ && $0 !~ /[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]/' "$tmp/owner-rows")"
[ -z "$nodone" ] || fail "a done row of the owner table names no commit" "$nodone"
for s in 'P0-02.5' 'P0-02.6' 'P0-08' 'P1-05' 'P0-05' 'P5-03' 'AWS' 'Anthropic' 'SME' 'spring-2028' 'd8d8b7e' 'P0-11'; do
  grep -q -F -- "$s" "$tmp/owner-block" || fail "'$s' is not in the in-flight/next/owner block of docs/plan/progress.md"
done
grep -q -i -E 'design.partner' "$tmp/owner-block" || fail "the owner block does not name the design partners"
# The owner table against its sources (loop 1 items 2 and 7). Each E4.n row carries the roadmap E4 row n's "Needed before"
# cell; an M0 row that cites (E4.n) names no card the roadmap's row n does not name; the six M0 rows and their date are the
# M0 line of docs/architecture/architecture.md section 17; the R2 row places the pack and conformance work as that section does.
trim() { sed 's/^ *//; s/ *$//'; }
awk '/^### E4\./{f=1;next} /^#/{f=0} f' "$ROADMAP" | grep '^| ' | grep -v '^| Item ' > "$tmp/e4rows" || true
ne4="$(grep -c . "$tmp/e4rows")"
[ "$ne4" -eq 9 ] || fail "the E4 table of docs/plan/roadmap.md has $ne4 rows, expected 9"
i=0
while IFS= read -r row; do
  i=$((i + 1))
  want="$(printf '%s\n' "$row" | cut -d'|' -f3 | trim)"
  have="$(grep "^| E4\.$i " "$tmp/owner-rows" | cut -d'|' -f3 | trim)"
  [ "$have" = "$want" ] || fail "the owner table's E4.$i row says it is needed before '$have'; row $i of the roadmap's E4 table says '$want'"
done < "$tmp/e4rows"
ARCH="$ROOT/docs/architecture/architecture.md"
m0line="$(grep -E '^- M0 20[0-9]{2}-[0-9]{2}-[0-9]{2}: ' "$ARCH" | sed -n '1p')"
[ -n "$m0line" ] || fail "docs/architecture/architecture.md has no '- M0 <date>: ...' milestone line"
m0date="$(printf '%s\n' "$m0line" | sed -E 's/^- M0 ([0-9-]+): .*/\1/')"
nm0="$(printf '%s\n' "$m0line" | tr -cd ';' | wc -c | tr -d ' ')"
grep '^| M0 ' "$tmp/owner-rows" > "$tmp/m0rows" || true
[ "$(grep -c . "$tmp/m0rows")" -eq $((nm0 + 1)) ] \
  || fail "the owner table has $(grep -c . "$tmp/m0rows") M0 rows; the M0 line of docs/architecture/architecture.md lists $((nm0 + 1)) items"
while IFS= read -r row; do
  item="$(printf '%s\n' "$row" | cut -d'|' -f2 | trim)"
  cell="$(printf '%s\n' "$row" | cut -d'|' -f3)"
  due="$(printf '%s\n' "$row" | cut -d'|' -f4 | trim)"
  [ "$due" = "$m0date" ] || fail "the owner table's '$item' row is due '$due'; docs/architecture/architecture.md dates M0 $m0date"
  e4n="$(printf '%s\n' "$cell" | grep -o -E '\(E4\.[1-9]\)' | sed -n '1p' | sed -E 's/^\(E4\.([1-9])\)$/\1/')"
  [ -n "$e4n" ] || continue
  src="$(sed -n "${e4n}p" "$tmp/e4rows")"
  for id in $(printf '%s\n' "$cell" | grep -o -E 'P[0-9]-[0-9]{2}' | sort -u); do
    printf '%s\n' "$src" | grep -q -F -- "$id" \
      || fail "the owner table's '$item' row cites (E4.$e4n) and names $id, which row $e4n of the roadmap's E4 table does not name"
  done
done < "$tmp/m0rows"
grep -F -- '| M0 Contractor R2' "$tmp/owner-rows" | grep -q -F -- 'build-sequence step 5, overlapping step 3' \
  || fail "the owner table's 'M0 Contractor R2' row does not place the pack and conformance work at build-sequence step 5, overlapping step 3"
grep -q -F -- 'owns the pack and conformance work so steps 3 and 5 overlap' "$ARCH" \
  || fail "docs/architecture/architecture.md section 17 no longer says R2 'owns the pack and conformance work so steps 3 and 5 overlap', the source of the owner table's R2 row"
awk '/^## Log/{f=1} f' "$PROGRESS" > "$tmp/log"
# Loop 1 item 8: the shape line says what the entries are, and every entry has that shape (or is a dated pause entry).
tr '\n' ' ' < "$tmp/log" | sed 's/  */ /g' > "$tmp/log.flat"
for s in 'One entry per shipped card and per recorded commit without a card' \
         '`- <date> <time>, <card id or "no card">, commit <hash>: <title>; <one line>`' \
         'the entry says where its hash comes from' 'on the local clock (UTC+8)'; do
  grep -q -F -- "$s" "$tmp/log.flat" || fail "the shape line of the ## Log section of docs/plan/progress.md does not say '$s'"
done
bad="$(grep '^- ' "$tmp/log" \
        | grep -v -E '^- 20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}, ((P[0-9X]-[0-9]{2}(\.[0-9]{1,2})?|PLAN-[0-9]{2})|no card), commit [0-9a-f]{7}[ :(]' \
        | grep -v -E '^- Paused 20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} ' || true)"
[ -z "$bad" ] || fail "entries under ## Log that are neither '- <date> <time>, <card id or \"no card\">, commit <hash>...' nor '- Paused <date> <time> ...'" "$bad"
for s in '0e2e2cf' 'run URL' 'dfd0b72' 'd8d8b7e' '8e0e550'; do
  grep -q -F -- "$s" "$tmp/log" || fail "'$s' is not in the ## Log section of docs/plan/progress.md"
done
awk 'f{print} /^<!-- board:end -->$/{f=1}' "$PROGRESS" > "$tmp/after-board"
: > "$tmp/done-updated"
ndone=0
for f in "$ROOT"/factory/cards/*.md; do
  [ -f "$f" ] || continue
  grep -q '^status: done$' "$f" || continue
  id="$(sed -n 's/^id: *//p' "$f" | sed -n '1p')"
  [ -n "$id" ] || fail "${f##*/} has no id line"
  grep -q -F -- "$id" "$tmp/after-board" || fail "done card $id is not named after <!-- board:end --> in docs/plan/progress.md"
  esc="$(printf '%s' "$id" | sed 's/\./\\./g')"
  grep -q -E "^- 20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}, $esc, commit [0-9a-f]{7}" "$tmp/log" \
    || fail "done card $id has no '- <date> <time>, $id, commit <hash>' entry under ## Log"
  # Loop 1 item 3 and the pause check's three fills: the entry's hash is the one in the card's ## Ship section, or the
  # entry says where it comes from (the shape line's rule).
  entry="$(grep -E "^- 20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}, $esc, commit [0-9a-f]{7}" "$tmp/log" | sed -n '1p')"
  h="$(printf '%s\n' "$entry" | sed -E 's/^- [0-9-]+ [0-9:]+, [^,]+, commit ([0-9a-f]{7}).*/\1/')"
  awk '/^## Ship/{f=1;next} f' "$f" > "$tmp/ship"
  if ! grep -q -F -- "$h" "$tmp/ship"; then
    printf '%s\n' "$entry" | grep -q -F -- 'history line' \
      || fail "the $id log entry names commit $h, which the card's ## Ship section does not hold, and the entry does not say where the hash comes from"
  fi
  printf '%s %s\n' "$(sed -n 's/^updated: *//p' "$f" | sed -n '1p')" "$id" >> "$tmp/done-updated"
  ndone=$((ndone + 1))
done
# The in-flight paragraphs (above the owner table) against the cards' done set, which changes only at ship, as the board's
# check does: the card they call the last shipped one is the done card with the newest `updated`, and a card they call
# parked is not done. A station move never fails this; a ship does until the block is rewritten, so the rewrite goes into
# the `Cards: <id> shipped` commit with the board and the log entry.
awk '/^[|] Item [|]/{exit} {print}' "$tmp/owner-block" | tr '\n' ' ' | sed 's/  */ /g' > "$tmp/inflight.flat"
newest="$(sort "$tmp/done-updated" | tail -n 1 | cut -d' ' -f2)"
CARD_ID='(P[0-9X]-[0-9]{2}(\.[0-9]{1,2})?|PLAN-[0-9]{2})'
for id in $(grep -o -E "last shipped card is $CARD_ID" "$tmp/inflight.flat" | sed 's/.* //' | sort -u); do
  [ "$id" = "$newest" ] \
    || fail "the in-flight block of docs/plan/progress.md says the last shipped card is $id; the done card with the newest 'updated' is $newest (rewrite the block in the Cards: <id> shipped commit)"
done
for id in $(grep -o -E "$CARD_ID[^.;]* is parked" "$tmp/inflight.flat" | sed -E 's/^([^ ]+) .*/\1/' | sort -u); do
  for g in "$ROOT/factory/cards/$id"-*.md; do
    [ -f "$g" ] || fail "the in-flight block of docs/plan/progress.md calls $id parked; no card file factory/cards/$id-*.md exists"
    grep -q '^status: done$' "$g" \
      && fail "the in-flight block of docs/plan/progress.md says $id is parked; the card is done (rewrite the block in the Cards: <id> shipped commit)"
  done
done
# Third test station, ruling 2 (F2 and F5): one board-regeneration rule, the one card.py's usage text gives (at `new` and at
# ship; a station move is rendered, not checked), in README.md and in the opening paragraph of docs/plan/progress.md, and
# no factory document still says the board is regenerated at every commit that "touches a card" (line wraps allowed).
RULE='at every `card.py new` and at every ship; a station move in between is rendered at the next regeneration and is not checked'
grep -q -F -- "Regenerate the board (\`python3 tools/monitor/card.py status --write docs/plan/progress.md\`) $RULE" "$README" \
  || fail "the several-sessions rules of README.md do not say the board is regenerated '$RULE'"
awk '/^## Board/{exit} {print}' "$PROGRESS" | tr '\n' ' ' | sed 's/  */ /g' > "$tmp/progress-intro.flat"
grep -q -F -- "The board is regenerated $RULE." "$tmp/progress-intro.flat" \
  || fail "the opening paragraph of docs/plan/progress.md does not say 'The board is regenerated $RULE.' (line wraps allowed)"
grep -q -F -- 'the board is regenerated at `new` and at ship' "$ROOT/tools/monitor/card.py" \
  || fail "the usage text of tools/monitor/card.py no longer says 'the board is regenerated at \`new\` and at ship', the rule README.md and docs/plan/progress.md give"
for d in README.md CLAUDE.md factory/README.md factory/line.md docs/plan/progress.md .claude/skills/factory/SKILL.md; do
  tr '\n' ' ' < "$ROOT/$d" | sed 's/  */ /g' > "$tmp/doc.flat"
  grep -q -i -F -- 'touches a card' "$tmp/doc.flat" \
    && fail "$d still says the board is regenerated at every commit that touches a card; the rule is at every card.py new and at every ship"
done
# Ruling 4 (F4): row 7 of the roadmap's E4 table lands the runners in a directory; while that directory does not exist, no
# card or document says whether the runners exist, and by the table's own legend the status is "unknown" with its reason.
grep -q -F -- '"unknown" means no card or document says either way' "$tmp/inflight.flat" \
  || fail "the legend above the owner table no longer says '\"unknown\" means no card or document says either way' (line wraps allowed)"
land="$(sed -n '7p' "$tmp/e4rows" | cut -d'|' -f4 | tr -d ' `')"
case "$land" in
  tools/*) ;;
  *) fail "row 7 of the roadmap's E4 table lands in '$land'; this test expects the directory under tools/ where the runners land" ;;
esac
e47="$(grep '^| E4\.7 ' "$tmp/owner-rows" | cut -d'|' -f5 | trim)"
if [ ! -e "$ROOT/${land%/}" ]; then
  case "$e47" in
    'unknown: '?*) ;;
    *) fail "the owner table's E4.7 status is '$e47'; row 7 of the roadmap's E4 table lands the runners in $land, which does not exist, and nothing else records them: by the table's legend the status is 'unknown: <why>' (ruling 4)" ;;
  esac
fi
# Rulings 10 (T1 and T2): the block the ship documents tell the foreman to rewrite has the heading they name; the shape
# paragraph of `## Log` describes the pause entries, and every pause entry has that shape, with who paused.
grep -q -x -F -- '## In flight / next / only the owner can do' "$PROGRESS" \
  || fail "docs/plan/progress.md has no '## In flight / next / only the owner can do' heading, the name SKILL.md step 6, the ship row of factory/line.md and factory/README.md give the block the foreman rewrites at ship"
grep -q -F -- 'A pause is an entry too, in the shape `- Paused <date> <time> (<who>): <the state at the pause>`' "$tmp/log.flat" \
  || fail "the shape paragraph of the ## Log section of docs/plan/progress.md does not describe the pause entries ('A pause is an entry too, in the shape \`- Paused <date> <time> (<who>): <the state at the pause>\`')"
bad="$(grep '^- Paused ' "$tmp/log" | grep -v -E '^- Paused 20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} \([^)]+\): ' || true)"
[ -z "$bad" ] || fail "pause entries under ## Log that are not '- Paused <date> <time> (<who>): ...', the shape the section gives" "$bad"
# Negative proofs on copies: the done set and the id set are checked; station, owner, updated and next up are not.
awk '!d && index($0, "| done |") { sub("[|] done [|]", "| planned |"); d = 1 } { print }' "$PROGRESS" > "$tmp/progress.md"
cmp -s "$PROGRESS" "$tmp/progress.md" && fail "fixture: no '| done |' cell to flip in the board"
OUT="$(cd "$ROOT" && python3 tools/monitor/card.py status --check "$tmp/progress.md" 2>&1 >/dev/null)"
RC=$?
[ "$RC" -eq 1 ] || fail "card.py status --check on a copy with a done cell flipped: exit $RC, expected 1" "$OUT"
printf '%s\n' "$OUT" | grep -q -F -- "$tmp/progress.md" || fail "the stale message does not name the copy's path" "$OUT"
printf '%s\n' "$OUT" | grep -q -F -- 'done in the cards, not on the board:' || fail "the stale message does not say which done card is missing" "$OUT"
flipped="$(printf '%s\n' "$OUT" | sed -n '1p')"
firstdone="$(grep '| done |' "$PROGRESS" | sed -n '1p')"
gone="$(printf '%s\n' "$firstdone" | cut -d'|' -f2 | tr -d ' ')"
grep -v -x -F -- "$firstdone" "$PROGRESS" > "$tmp/progress-removed.md"
OUT="$(cd "$ROOT" && python3 tools/monitor/card.py status --check "$tmp/progress-removed.md" 2>&1 >/dev/null)"
RC=$?
[ "$RC" -eq 1 ] || fail "card.py status --check on a copy with the $gone row removed: exit $RC, expected 1" "$OUT"
printf '%s\n' "$OUT" | grep -q -F -- "cards not on the board: $gone" || fail "the stale message does not name the removed card $gone" "$OUT"
awk '{print} /^\|---\|---\|---\|---\|---\|---\|$/{print "| P9-99 | P9 | backlog | planned | - | |"}' "$PROGRESS" > "$tmp/progress-foreign.md"
OUT="$(cd "$ROOT" && python3 tools/monitor/card.py status --check "$tmp/progress-foreign.md" 2>&1 >/dev/null)"
RC=$?
[ "$RC" -eq 1 ] || fail "card.py status --check on a copy with a row without a card: exit $RC, expected 1" "$OUT"
printf '%s\n' "$OUT" | grep -q -F -- 'board rows without a card: P9-99' || fail "the stale message does not name the foreign row P9-99" "$OUT"
awk '!d && index($0, "| ship | done |") { sub("[|] ship [|] done [|]", "| review | done |"); d = 1 } { print }' "$PROGRESS" > "$tmp/progress-moved.md"
cmp -s "$PROGRESS" "$tmp/progress-moved.md" && fail "fixture: no '| ship | done |' cell to move in the board"
OUT="$(cd "$ROOT" && python3 tools/monitor/card.py status --check "$tmp/progress-moved.md" 2>&1)"
RC=$?
[ "$RC" -eq 0 ] || fail "card.py status --check on a copy with one station cell changed: exit $RC, expected 0 (station is rendered, not checked)" "$OUT"
[ -z "$OUT" ] || fail "card.py status --check printed something for a station-only change" "$OUT"
echo "# board: current; $nrows rows for $ncards cards; owner table $nown rows; $ndone done cards with a log entry"
echo "# board: flipped copy: exit 1, '$flipped'; removed $gone: exit 1; foreign P9-99: exit 1; station-only change: exit 0"
echo "ok - board"

# ---- decisions (AC4) --------------------------------------------------------------------------------------------
CASE=decisions
[ -f "$DEC" ] || fail "docs/decisions/log.md does not exist"
grep -q '^| *Date *| *Decision *| *Who *|' "$DEC" || fail "docs/decisions/log.md has no '| Date | Decision | Who |' header line"
for adr in 0001-mvp-scope-resolutions.md 0002-architecture-amendments.md; do
  grep -q -F -- "]($adr)" "$DEC" || fail "docs/decisions/log.md does not link $adr"
  [ -f "$ROOT/docs/decisions/$adr" ] || fail "docs/decisions/$adr does not exist"
done
nkw=0
for s in 'P0-01' 'Part D' 'second approval' 'ADR 0002' 'ce7b2dc' 'toolchain' 'push' 'pull request' 'P0-06' 'P0-08' \
         'private' 'public' 'gh pr merge' '5 s' 'serve.py' 'Diagnose' 'similarity' 'sandbox' 'memo' '/o/:org' '55432' \
         'RustFS' 'design partner' 'SME' 'AWS' 'chat only'; do
  grep -q -F -- "$s" "$DEC" || fail "'$s' is not in docs/decisions/log.md"
  nkw=$((nkw + 1))
done
grep '^| 20[0-9][0-9]-[0-9][0-9]-[0-9][0-9] |' "$DEC" > "$tmp/dec-rows" || true
nrows="$(grep -c . "$tmp/dec-rows")"
[ "$nrows" -ge 17 ] || fail "docs/decisions/log.md has $nrows dated rows, expected at least 17"
for i in 1 2 3 4 5; do
  grep -q -F -- "Plan-approval decision $i" "$tmp/dec-rows" || fail "docs/decisions/log.md has no 'Plan-approval decision $i' row"
done
for i in 1 4; do
  grep -F -- "Plan-approval decision $i" "$tmp/dec-rows" | grep -q -F -- 'default in force, not yet answered' \
    || fail "the plan-approval decision $i row is not marked 'default in force, not yet answered'"
done
check_rows_cite() {  # $1 = keyword, $2 = the written source every row mentioning it must cite (and none may be chat only)
  grep -F -- "$1" "$tmp/dec-rows" > "$tmp/rows" || true
  [ -s "$tmp/rows" ] || fail "no dated row mentions '$1'"
  grep -q -F -- 'chat only' "$tmp/rows" && fail "a row mentioning '$1' is marked chat only; the Spec's addendum gives it a written source" "$(cat "$tmp/rows")"
  grep -v -F -- "$2" "$tmp/rows" | grep -q . && fail "a row mentioning '$1' does not cite $2" "$(cat "$tmp/rows")"
  return 0
}
check_rows_cite 'Part D' 'docs/plan/roadmap.md'
check_rows_cite 'P0-08' 'docs/plan/roadmap.md'
check_rows_cite '5 s' 'docs/plan/monitor-v4.md'
# The intro defines the marker; any row may carry it (an owner decision given in chat, for which the log is the record).
awk '/^[|] *Date *[|] *Decision/{exit} {print}' "$DEC" | tr '\n' ' ' | sed 's/  */ /g' > "$tmp/dec-intro"
grep -q -F -- '"chat only; this log is the record"' "$tmp/dec-intro" \
  || fail "the intro of docs/decisions/log.md does not define the marker \"chat only; this log is the record\" (line wraps allowed)"
grep -F -- '55432' "$tmp/dec-rows" | cut -d'|' -f4 | grep -q -F -- 'plan station' \
  || fail "the 55432/RustFS row's Who cell does not say the amendments are the plan station's"
grep -F -- 'Still open' "$tmp/dec-rows" | grep -q -F -- 'P1-05' || fail "the 'Still open' row does not name P1-05"
# Loop 1 item 9: the P0-11 row quotes the owner's instruction as the card's Spec records it, cites that Spec, and so is not
# chat only; the unsourced paraphrase is gone.
QI='prioritize this so that we will not hallucinate'
grep -F -- 'P0-11 prioritized' "$tmp/dec-rows" > "$tmp/rows" || true
c="$(grep -c . "$tmp/rows")"
[ "$c" -eq 1 ] || fail "docs/decisions/log.md has $c dated rows saying 'P0-11 prioritized', expected 1"
grep -q -F -- "(\"$QI\")" "$tmp/rows" || fail "the P0-11 row of docs/decisions/log.md does not quote the instruction (\"$QI\")"
grep -q -F -- 'card P0-11 Spec' "$tmp/rows" || fail "the P0-11 row of docs/decisions/log.md does not cite card P0-11 Spec"
grep -q -F -- 'chat only' "$tmp/rows" \
  && fail "the P0-11 row of docs/decisions/log.md is marked chat only although it cites the card's Spec, which quotes the instruction"
awk '/^## Spec/{f=1;next} /^## Plan/{f=0} f' "$ROOT"/factory/cards/P0-11-*.md | grep '^Why: ' | grep -q -F -- "(\"$QI\")" \
  || fail "the Why paragraph of card P0-11's Spec does not quote the instruction (\"$QI\"), which the decisions log cites it for"
grep -q -F -- 'before more product code' "$DEC" && fail "docs/decisions/log.md still paraphrases the instruction as 'before more product code'"
# A row that is chat only carries the marker the intro defines, in full.
bad="$(grep -F -- 'chat only' "$tmp/dec-rows" | grep -v -F -- 'chat only; this log is the record' || true)"
[ -z "$bad" ] || fail "a row of docs/decisions/log.md says 'chat only' without the marker \"chat only; this log is the record\"" "$bad"
# Second test station, finding F6: while rows carry the marker (decisions given in chat, for which the log is the record, by
# the intro's own definition), the intro may not also say without condition that an unsourced decision is left out.
nchat="$(grep -c -F -- 'chat only; this log is the record' "$tmp/dec-rows" || true)"
if [ "$nchat" -gt 0 ]; then
  grep -q -F -- 'a decision that cannot be sourced to a card, a document or the P0-11 Spec is left out.' "$tmp/dec-intro" \
    && fail "the intro of docs/decisions/log.md says 'a decision that cannot be sourced to a card, a document or the P0-11 Spec is left out.' while $nchat rows are marked \"chat only; this log is the record\" (given in chat, this log their record) and are not left out"
fi
# Third test station, ruling 5 (F6): the intro's rule as ruled, and every row under it. A decision is either sourced or
# marked: each dated row's last cell carries the marker or names a document (a backticked path), a card or an ADR. And the
# intro may not define the marker as "no other written source" while a marked row also names a card or a document.
for s in 'marks a decision given in chat, for which this log is the record' \
         'a decision is either sourced to a card, a document or the P0-11 Spec, or carries that marker'; do
  grep -q -F -- "$s" "$tmp/dec-intro" || fail "the intro of docs/decisions/log.md does not say '$s' (line wraps allowed)"
done
SRC_RE='`[^`]+`|card (P[0-9]-[0-9][0-9]|PLAN-[0-9][0-9])|ADR 000[12]'  # read by awk: no interval expressions (mawk)
bad="$(awk -F'|' -v re="$SRC_RE" '$(NF-1) !~ /chat only; this log is the record/ && $(NF-1) !~ re' "$tmp/dec-rows")"
[ -z "$bad" ] \
  || fail "rows of docs/decisions/log.md that neither carry the marker \"chat only; this log is the record\" nor name a document, a card or an ADR in their last cell; the intro says every decision is one or the other" "$bad"
nboth="$(awk -F'|' -v re="$SRC_RE" '$(NF-1) ~ /chat only; this log is the record/ { w = $(NF-1); sub(/.*chat only; this log is the record/, "", w); if (w ~ re) n++ } END { print n + 0 }' "$tmp/dec-rows")"
if [ "$nboth" -gt 0 ]; then
  grep -q -F -- 'no other written source' "$tmp/dec-intro" \
    && fail "the intro of docs/decisions/log.md defines the marker as 'no other written source' while $nboth marked rows also name a card or a document"
fi
# Every backticked repository path exists; every `card <id>` has one card file; every cited history line and ADR row exists (the history line is read from the card file, not through `cat |`: SIGPIPE under pipefail).
grep -o '`[^`]*`' "$DEC" | tr -d '`' | grep -E '^(docs|tools|factory|\.bridle)/' | sort -u > "$tmp/dec-paths" || true
npath=0
while IFS= read -r p; do
  [ -n "$p" ] || continue
  [ -e "$ROOT/$p" ] || fail "docs/decisions/log.md names '$p', which does not exist"
  npath=$((npath + 1))
done < "$tmp/dec-paths"
grep -o -E 'card (P[0-9X]-[0-9]{2}(\.[0-9]{1,2})?|PLAN-[0-9]{2})' "$DEC" | sed 's/^card //' | sort -u > "$tmp/dec-cards" || true
ncard=0
while IFS= read -r id; do
  [ -n "$id" ] || continue
  c=0
  for g in "$ROOT/factory/cards/$id"-*.md; do [ -f "$g" ] && c=$((c + 1)); done
  [ "$c" -eq 1 ] || fail "docs/decisions/log.md cites card $id, which has $c files factory/cards/$id-*.md"
  ncard=$((ncard + 1))
done < "$tmp/dec-cards"
grep -o -E 'card (P[0-9X]-[0-9]{2}(\.[0-9]{1,2})?|PLAN-[0-9]{2}) history [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z' "$DEC" | sort -u > "$tmp/dec-hist" || true
nhist=0
while IFS= read -r h; do
  [ -n "$h" ] || continue
  id="$(printf '%s' "$h" | sed -E 's/^card ([^ ]+) history .*/\1/')"
  ts="$(printf '%s' "$h" | sed -E 's/^card [^ ]+ history (.*)$/\1/')"
  grep -q -F -- "  - $ts " "$ROOT/factory/cards/$id"-*.md || fail "card $id has no history line at $ts, which docs/decisions/log.md cites"
  nhist=$((nhist + 1))
done < "$tmp/dec-hist"
grep -q -F -- '  - 2026-11-03T08:33:53Z spec running orchestrator' "$ROOT"/factory/cards/P0-06-*.md \
  && grep "2026-11-03T08:33:53Z" "$ROOT"/factory/cards/P0-06-*.md | grep -q -F -- 'installs and GitHub push authorized' \
  || fail "card P0-06's history line 2026-11-03T08:33:53Z does not say 'installs and GitHub push authorized'"
grep "2026-11-03T11:52:30Z" "$ROOT"/factory/cards/P0-02.2-*.md | grep -q -F -- '55432' \
  || fail "card P0-02.2's history line 2026-11-03T11:52:30Z does not record the 55432 amendment"
for a in A3 A9; do grep -q "^| $a " "$ADR2" || fail "ADR 0002 has no row $a, which docs/decisions/log.md cites"; done
grep -q "^| R11 " "$ADR1" || fail "ADR 0001 has no row R11, which docs/decisions/log.md cites"
grep -q '^Status: adopted at the second plan approval' "$ADR2" || fail "ADR 0002's status line does not say it was adopted at the second plan approval"
awk '/^## [0-9]* *Open questions/{f=1} f' "$ROOT/docs/ux/ux-spec.md" | grep '^9\. ' | grep -q -i 'formative' \
  || fail "docs/ux/ux-spec.md open questions item 9 does not resolve the formative-review rule"
grep -q '^## Decisions (user answers, 2026-11-03)' "$ROOT/docs/plan/monitor-v4.md" || fail "docs/plan/monitor-v4.md has no 'Decisions (user answers, 2026-11-03)' section"
grep -q -F -- 'every 5 s' "$ROOT/docs/plan/monitor-v4.md" || fail "docs/plan/monitor-v4.md does not state the 5 s cadence"
grep -q -F -- 'Bash(gh pr merge *)' "$ROOT/docs/ops/permissions.md" || fail "docs/ops/permissions.md has no Bash(gh pr merge *) rule"
grep -q -F -- '(a) Visibility' "$ROOT/docs/ops/github.md" || fail "docs/ops/github.md has no item (a) Visibility"
python3 -c 'import json, sys; sys.exit(0 if json.load(open(sys.argv[1]))["syncIntervalSeconds"] == 5 else 1)' "$ROOT/.bridle/monitor.json" \
  || fail ".bridle/monitor.json does not carry syncIntervalSeconds: 5"
# Every roadmap line the log quotes holds the quoted text; the lines it cites by number hold the expected text.
grep -o -E 'line [0-9]+:? "[^"]+"' "$DEC" | sort -u > "$tmp/dec-lines" || true
nline=0
while IFS= read -r c; do
  [ -n "$c" ] || continue
  ln="$(printf '%s' "$c" | sed -E 's/^line ([0-9]+):? .*/\1/')"
  q="$(printf '%s' "$c" | sed -E 's/^line [0-9]+:? "(.*)"$/\1/')"
  sed -n "${ln}p" "$ROADMAP" | grep -q -F -- "$q" || fail "docs/decisions/log.md cites roadmap line $ln for \"$q\", which that line does not hold"
  nline=$((nline + 1))
done < "$tmp/dec-lines"
check_line() {  # $1 = line number of docs/plan/roadmap.md, $2 = text that line must hold (the decisions log cites the number)
  sed -n "$1p" "$ROADMAP" | grep -q -F -- "$2" \
    || fail "docs/plan/roadmap.md line $1 does not hold '$2'; the decisions log cites that line (renumber its citations when the plan is amended)"
  nline=$((nline + 1))
}
check_line 30 '1. **Design partners and reviewers**'
check_line 31 '2. **Self-serve sandbox**'
check_line 32 '3. **Factory concurrency**'
check_line 33 '4. **By-hand items**'
check_line 34 '5. **Two deferrals**'
check_line 49 '| Tenancy |'
check_line 166 'Memo weight for Design tasks (15 default)'
check_line 168 '## Part D:'
check_line 347 'P0-06 and P0-02 first'
check_line 351 '### E4. By hand (the user)'
check_line 363 'Design-partner instructors and two SME reviewers named'
echo "# decisions: $nrows dated rows, $nkw keywords present, $npath paths exist, $ncard cards cited exist, $nhist history lines, $nline roadmap lines hold their citations"
echo "ok - decisions"

# ---- factory-docs (AC5) -----------------------------------------------------------------------------------------
CASE=factory-docs
FR="$ROOT/factory/README.md"
LINE="$ROOT/factory/line.md"
for f in "$FR" "$LINE" "$SKILL"; do [ -f "$f" ] || fail "$f does not exist"; done
for s in '## Resume' '## Several sessions at once' 'card.py list' '/factory next' 'git add -A' 'watch'; do
  grep -q -F -- "$s" "$FR" || fail "'$s' is not in factory/README.md"
done
awk '/^## Resume/{f=1;next} /^## /{f=0} f' "$FR" > "$tmp/resume"
for s in 'README.md' 'card.py list' 'docs/plan/progress.md' 'docs/plan/roadmap.md' 'E3' '/factory next'; do
  grep -q -F -- "$s" "$tmp/resume" || fail "'$s' is not in the ## Resume section of factory/README.md"
done
# Second test station, finding F8: as in the root README, `/factory next` alone never resumes a parked or in-flight card.
grep -q -F -- '/factory run' "$tmp/resume" \
  || fail "the ## Resume section of factory/README.md ends with '/factory next' only, which never selects a parked or in-flight card (card.py next_up takes backlog cards only); it must also give the '/factory run <id>' path that docs/plan/progress.md and the card's pause note give"
awk '/^## Several sessions at once/{f=1;next} /^## /{f=0} f' "$FR" > "$tmp/sessions"
for s in 'Re-read' 'explicit paths' 'git add -A' 'Announce' 'one session runs the watch' 'owner says so' 'share no files'; do
  grep -q -F -- "$s" "$tmp/sessions" || fail "'$s' is not in the ## Several sessions at once section of factory/README.md"
done
grep -q -F -- 'Cards: <id> shipped' "$FR" || fail "factory/README.md does not say the shipped state goes into the 'Cards: <id> shipped' commit"
grep -q -F -- 'all card sections filled' "$FR" \
  && fail "factory/README.md still says nothing ships without all card sections filled (the ship commit carries the card through ## Review)"
links_of "$FR" > "$tmp/fr-links"
while IFS= read -r target; do
  [ -n "$target" ] || continue
  case "$target" in http://*|https://*|mailto:*|'#'*) continue ;; esac
  [ -e "$ROOT/factory/${target%%#*}" ] || fail "factory/README.md link '$target' does not resolve from factory/"
done < "$tmp/fr-links"
row="$(grep '^| 6 | ship |' "$LINE")"
[ -n "$row" ] || fail "factory/line.md has no '| 6 | ship |' row"
for s in 'progress board regenerated' 'card.py status --write docs/plan/progress.md' 'log entry written' 'phase exit' \
         'through `## Review`' 'Cards: <id> shipped'; do
  printf '%s\n' "$row" | grep -q -F -- "$s" || fail "the ship row of factory/line.md does not say '$s'"
done
for s in 'docs/plan/roadmap.md' 'card.py status --write docs/plan/progress.md'; do
  grep -q -F -- "$s" "$SKILL" || fail "'$s' is not in .claude/skills/factory/SKILL.md"
done
skill_block() {  # $1 = regex of the block's first line, $2 = regex of the line that ends it: those lines of SKILL.md
  awk -v a="$1" -v b="$2" 'f && $0 ~ b {exit} !f && $0 ~ a {f=1} f {print}' "$SKILL"
}
skill_block '^0[.] Preconditions' '^1[.] ' > "$tmp/step0"
skill_block '^1[.] Spec' '^2[.] ' > "$tmp/step1"
skill_block '^6[.] Ship' '^7[.] ' > "$tmp/step6"
skill_block '^- `status`' '^- `' > "$tmp/cmd-status"
skill_block '^- `run <id>`' '^## ' > "$tmp/cmd-run"
for f in step0 step1 step6 cmd-status cmd-run; do [ -s "$tmp/$f" ] || fail "SKILL.md block '$f' not found"; done
for s in 'docs/plan/roadmap.md' 'Part E' 'approved 2026-11-03'; do
  grep -q -F -- "$s" "$tmp/step0" || fail "SKILL.md step 0 does not say '$s'"
done
grep -q -F -- 'Cards: <id> spec' "$tmp/step1" || fail "SKILL.md step 1 does not commit the new card as 'Cards: <id> spec'"
tr '\n' ' ' < "$tmp/step6" | sed 's/  */ /g' > "$tmp/step6.flat"  # SKILL.md wraps its lines; match across the wraps
for s in 'through `## Review`' 'commit as `<id>: <title>`' 'Actions run URL' '## Ship' 'card.py move <id> ship --status done' \
         'card.py status --write docs/plan/progress.md' '## Log' 'hash and time' 'Cards: <id> shipped' 'at once'; do
  grep -q -F -- "$s" "$tmp/step6.flat" || fail "SKILL.md step 6 does not say '$s'"
done
# The ship order: the <id>: <title> commit carries the code and the card through ## Review; then ## Ship, the move to done,
# the board and the log entry with its hash and time, all in the Cards: <id> shipped commit (Spec, "Correction and decision" 2).
rest="$(cat "$tmp/step6.flat")"
pat='commit as `<id>: <title>`'
first=${rest%%"$pat"*}
case "$first" in
  *docs/plan/progress.md*) fail "SKILL.md step 6 puts docs/plan/progress.md into the <id>: <title> commit; the board and the log entry go into the Cards: <id> shipped commit" ;;
esac
for s in "$pat" '## Ship' 'card.py move <id> ship --status done' 'card.py status --write docs/plan/progress.md' '## Log' \
         'Cards: <id> shipped'; do
  case "$rest" in
    *"$s"*) rest=${rest#*"$s"} ;;
    *) fail "SKILL.md step 6 breaks the ship order at '$s' (the <id>: <title> commit, then ## Ship, the move, the board, the log entry, the Cards commit)" ;;
  esac
done
grep -q -F -- 'the hash comes after' "$tmp/step6.flat" && fail "SKILL.md step 6 still writes the log entry before the commit whose hash it needs"
grep -q -F -- 'card.py status --check docs/plan/progress.md' "$tmp/cmd-status" || fail "SKILL.md's status command does not run card.py status --check"
for s in 'owner says so' 'share no files' 'process note'; do
  grep -q -F -- "$s" "$tmp/cmd-run" || fail "SKILL.md's run command lacks the second-card exception ('$s')"
done
grep -q -F -- 'an E2 row in `docs/plan/roadmap.md`' "$SKILL" || fail "SKILL.md's work-packages section does not point at docs/plan/roadmap.md"
for s in '~/.claude/plans' 'with the next card' 'in the approved plan'; do
  grep -q -F -- "$s" "$SKILL" && fail ".claude/skills/factory/SKILL.md still says '$s'"
done
Q='the builder makes them pass and the tester may add cases but not change them'
# Through a file, not a pipe: mawk 1.3.4 on Linux writes the E1 section in more than one write; when `grep -q` leaves at its
# match before the last of them, awk dies of SIGPIPE and `set -o pipefail` reports that as a failure of the assertion.
awk '/^### E1[.]/{f=1;next} /^### E2[.]/{f=0} f' "$ROADMAP" > "$tmp/e1"
grep -q -F -- "$Q" "$tmp/e1" \
  || fail "the E1 section of docs/plan/roadmap.md does not hold the fixtures sentence the station agents quote"
for f in .claude/agents/factory-planner.md .claude/agents/factory-tester.md; do
  tr '\n' ' ' < "$ROOT/$f" | sed 's/  */ /g' | grep -q -F -- "$Q" || fail "$f does not quote the E1 fixtures rule (line wraps allowed)"
  grep -q -F -- 'docs/plan/roadmap.md` E1' "$ROOT/$f" || fail "$f does not cite docs/plan/roadmap.md E1"
done
# Third test station, rulings 1 and 11 (F8): the Resume section gives the same rule as the root README, by station.
tr '\n' ' ' < "$tmp/resume" | sed 's/  */ /g' > "$tmp/resume.flat"
for s in 'Then a parked or in-flight card comes first' \
         'shows at a station from spec to review is in flight whatever its status' \
         '(running, blocked, failed or review, as `card.py move` names them)' 'is resumed with `/factory run <id>`' \
         'the pause note of its Spec' 'a work-package row waiting at spec while its sub-cards run is not such a card' \
         'Otherwise `/factory next`, which takes backlog cards only'; do
  grep -q -F -- "$s" "$tmp/resume.flat" || fail "the ## Resume section of factory/README.md does not say '$s' (line wraps allowed)"
done
grep -q -F -- 'with status running or blocked' "$tmp/resume.flat" \
  && fail "the ## Resume section of factory/README.md still goes by a list of statuses ('with status running or blocked'); ruling 11 goes by station, whatever the status"
# Ruling 10 (T1): the three ship documents name the rewrite of the in-flight paragraphs: the README's ship sentence, the
# ship row (job and exit criteria), and step 6, between the log entry and the Cards commit.
tr '\n' ' ' < "$FR" | sed 's/  */ /g' > "$tmp/fr.flat"
INFL='"In flight / next / only the owner can do" paragraphs'
grep -q -F -- "the regenerated board, the log entry and the rewritten $INFL of \`docs/plan/progress.md\` go into one \`Cards: <id> shipped\` commit" "$tmp/fr.flat" \
  || fail "the ship sentence of factory/README.md does not put the rewritten $INFL of docs/plan/progress.md into the Cards: <id> shipped commit (line wraps allowed)"
for s in "rewrite the $INFL of \`docs/plan/progress.md\`, and commit them as \`Cards: <id> shipped\`" \
         "that file's $INFL rewritten (what is in flight, the last shipped card, what is next)" \
         'all three in the `Cards: <id> shipped` commit'; do
  case "$row" in
    *"$s"*) ;;
    *) fail "the ship row of factory/line.md does not say '$s'" ;;
  esac
done
rest="$(cat "$tmp/step6.flat")"
for s in '## Log' \
         'rewrite the paragraphs under `## In flight / next / only the owner can do` in the same file (what is in flight, the last shipped card, what is next)' \
         'Cards: <id> shipped'; do
  case "$rest" in
    *"$s"*) rest=${rest#*"$s"} ;;
    *) fail "SKILL.md step 6 does not rewrite the in-flight paragraphs between the log entry and the Cards: <id> shipped commit (missing, or out of order, at '$s')" ;;
  esac
done
# Rulings 6 and 9 (F11 and F7), step 0: the watch is armed unless another session is the mirror, and the mirror write is
# described for both artifact database tools, with what each takes from .bridle/monitor.json; that file holds those keys.
tr '\n' ' ' < "$tmp/step0" | sed 's/  */ /g' > "$tmp/step0.flat"
for s in 'Then arm the mirror so the monitor follows the card live, unless another session is already the mirror (`/factory sync`; only one session runs the watch)' \
         'The mirror write (`db_write` in the rest of this file) uses the artifact database tool the session offers.' \
         'Where the harness has `mcp__claude-artifacts__db_write`, call it with `slug` (from `.bridle/monitor.json`), `ops` and `idempotencyKey` taken from that line.' \
         'Where it has `ArtifactData` instead' 'make one `batch` call per printed line with the `url` from `.bridle/monitor.json`' \
         'becoming the write `{op: "set", collection: "events", doc_id: "<id>", data}` (for `tasks/<id>`: collection `tasks`)' \
         'it takes no idempotency key, and a create of an id that already exists is refused.'; do
  grep -q -F -- "$s" "$tmp/step0.flat" || fail "SKILL.md step 0 does not say '$s' (line wraps allowed)"
done
python3 -c 'import json, sys; d = json.load(open(sys.argv[1])); c = d.get("collections") or {}; sys.exit(0 if d.get("slug") and d.get("url") and "tasks" in c and "events" in c else 1)' "$ROOT/.bridle/monitor.json" \
  || fail ".bridle/monitor.json does not hold a slug, a url and the tasks and events collections, which SKILL.md step 0 takes from it for the mirror write"
# Ruling 12, the `new` command: how the printed tasks op is mirrored with either tool. Ruling 6 as repaired (C6), step 7:
# the last mirror pass belongs to the session that armed the watch. Ruling 9 as repaired (C5), the Mirroring paragraph.
skill_block '^- `new ' '^- `' | tr '\n' ' ' | sed 's/  */ /g' > "$tmp/cmd-new.flat"
skill_block '^7[.] Report' '^Mirroring:' | tr '\n' ' ' | sed 's/  */ /g' > "$tmp/step7.flat"
skill_block '^Mirroring:' '^Spawning a station' | tr '\n' ' ' | sed 's/  */ /g' > "$tmp/mirroring.flat"
for f in cmd-new step7 mirroring; do [ -s "$tmp/$f.flat" ] || fail "SKILL.md block '$f' not found"; done
for s in 'mirror it with the artifact database tool the session offers (ToolSearch `select:mcp__claude-artifacts__db_write,ArtifactData` returns the one it has)' \
         'with `db_write`, pass the printed op as `ops` with the `slug` from `.bridle/monitor.json`' \
         'with `ArtifactData`, as step 0 of `run` says'; do
  grep -q -F -- "$s" "$tmp/cmd-new.flat" || fail "SKILL.md's new command does not say '$s' (line wraps allowed)"
done
for s in 'If this session armed the watch in step 0, run one last mirror pass' \
         'where another session is the mirror, leave the pass and the watch to it'; do
  grep -q -F -- "$s" "$tmp/step7.flat" || fail "SKILL.md step 7 does not say '$s' (line wraps allowed)"
done
for s in 'a second write of the same id is refused, and with it the whole batch where the tool applies a batch all or nothing' \
         'name each with `--exists` as in step 0 until the remainder goes through'; do
  grep -q -F -- "$s" "$tmp/mirroring.flat" || fail "SKILL.md's Mirroring paragraph does not say '$s' (line wraps allowed)"
done
grep -q -F -- 'refuses the whole batch' "$tmp/mirroring.flat" \
  && fail "SKILL.md's Mirroring paragraph still says a second write 'refuses the whole batch' without condition; ArtifactData may apply a batch one write at a time"
# Rulings 7 and 9 (F10 and C4), the station prompt: no station calls an artifact database tool, and the trace sentence
# lists what the hook records: the four kinds tools/monitor/README.md names, word for word, and the three more that
# tools/monitor/trace_hook.py records (proved on the hook's own function: 80 characters of a command, a URL or a query).
TRACED='a file path, the first 80 characters of a command, a search pattern or a description'
for s in 'never call db_write or any artifact database tool yourself.' \
         "Your tool calls are traced to the monitor automatically ($TRACED; also the first 80 characters of a fetched URL or of a web or tool search query, and the name of an MCP server): keep secrets off command lines and out of URLs and search queries."; do
  grep -q -F -- "$s" "$SKILL" || fail "the station prompt of SKILL.md does not say '$s'"
done
grep -q -F -- 'file paths and command names only' "$SKILL" \
  && fail "the station prompt of SKILL.md still says tool calls are traced as 'file paths and command names only'; the hook records the first 80 characters of a command"
tr '\n' ' ' < "$ROOT/tools/monitor/README.md" | sed 's/  */ /g' > "$tmp/mon-readme.flat"
grep -q -F -- "$TRACED" "$tmp/mon-readme.flat" \
  || fail "tools/monitor/README.md no longer says a trace line holds '$TRACED', the source of the station prompt's sentence (line wraps allowed)"
python3 -B -c '
import sys
root = sys.argv[1]
sys.path.insert(0, root + "/tools/monitor")
import trace_hook
lng = "x" * 200
url = "https://example.test/" + lng
want = [
    ("Read", {"file_path": root + "/docs/a.md"}, {}, "docs/a.md"),
    ("Bash", {"command": lng}, {}, lng[:80]),
    ("Grep", {"pattern": "needle"}, {}, "needle"),
    ("Agent", {"description": "a description"}, {}, "a description"),
    ("WebFetch", {"url": url}, {}, url[:80]),
    ("WebSearch", {"query": lng}, {}, lng[:80]),
    ("ToolSearch", {"query": lng}, {}, lng[:80]),
    ("mcp__server__tool", {"secret": lng}, {"mcp_server": {"name": "server"}}, "server"),
]
bad = 0
for tool, tool_input, hook, exp in want:
    got = trace_hook.target_of(root, tool, tool_input, hook)
    if got != exp:
        bad += 1
        print("%s: recorded %r, the station prompt says %r" % (tool, got, exp))
sys.exit(1 if bad else 0)
' "$ROOT" > "$tmp/trace.out" 2>&1 \
  || fail "tools/monitor/trace_hook.py (target_of) does not record what the station prompt of SKILL.md says is traced: a file path, 80 characters of a command, a search pattern, a description, 80 characters of a fetched URL or a search query, the name of an MCP server" "$(cat "$tmp/trace.out")"
echo "# factory-docs: README sections and links, line.md ship row, SKILL.md steps 0, 1, 6, status and run, the agents' E1 quote"
echo "# factory-docs: resume by station; the in-flight rewrite in the README, the ship row and step 6; one watch in steps 0 and 7; the mirror write for both tools in step 0 and new; the trace sentence against the hook (8 kinds of call)"
echo "ok - factory-docs"

# ---- roadmap-cards (AC6) ----------------------------------------------------------------------------------------
CASE=roadmap-cards
awk '/^### E2\./{f=1;next} /^### E3\./{f=0} f' "$ROADMAP" | grep '^| P[0-9]-[0-9][0-9]' > "$tmp/e2rows"
nrows="$(grep -c . "$tmp/e2rows")"
[ "$nrows" -gt 0 ] || fail "no E2 rows between '### E2.' and '### E3.' in docs/plan/roadmap.md"
while IFS= read -r row; do
  np="$(printf '%s\n' "$row" | tr -cd '|' | wc -c | tr -d ' ')"
  [ "$np" -eq 5 ] || fail "E2 row has $np pipes, expected 5 (4 cells): $row"
done < "$tmp/e2rows"
cut -d'|' -f2 "$tmp/e2rows" | grep -o 'P[0-9]-[0-9][0-9]' | sort -u > "$tmp/e2ids"
nids="$(grep -c . "$tmp/e2ids")"
while IFS= read -r id; do
  n=0
  for f in "$ROOT/factory/cards/$id"-*.md; do [ -f "$f" ] && n=$((n + 1)); done
  [ "$n" -eq 1 ] || fail "E2 id $id has $n card files factory/cards/$id-*.md, expected exactly 1"
done < "$tmp/e2ids"
EXEMPT=" P0-01 P0-03 P0-04 P0-10 P0-11 P0-12 PLAN-01 PLAN-02 PLAN-03 PLAN-04 PLAN-05 "
ncards=0
for f in "$ROOT"/factory/cards/*.md; do
  [ -f "$f" ] || continue
  ncards=$((ncards + 1))
  id="$(sed -n 's/^id: *//p' "$f" | sed -n '1p')"
  [ -n "$id" ] || fail "${f##*/} has no id line"
  case "$id" in *.*) continue ;; esac
  case "$EXEMPT" in *" $id "*) continue ;; esac
  grep -q -x -F -- "$id" "$tmp/e2ids" || fail "card $id (${f##*/}) is neither an E2 row of docs/plan/roadmap.md nor exempt"
done
nwarn=0
while IFS= read -r row; do
  c1="$(printf '%s\n' "$row" | cut -d'|' -f2)"
  after="$(printf '%s\n' "$row" | cut -d'|' -f4)"
  size="$(printf '%s\n' "$row" | cut -d'|' -f5 | sed 's/^ *//; s/ *$//')"
  for id in $(printf '%s\n' "$c1" | grep -o 'P[0-9]-[0-9][0-9]'); do
    f=""
    for g in "$ROOT/factory/cards/$id"-*.md; do [ -f "$g" ] && f="$g"; done
    [ -n "$f" ] || continue
    if [ -n "$(printf '%s' "$after" | tr -d ' ')" ]; then
      want="$(printf '%s\n' "$after" | grep -o -E 'P[0-9]-[0-9][0-9]|PLAN-[0-9][0-9]' | sort | tr '\n' ',' | sed 's/,$//')"
      have="$(sed -n 's/^dependsOn: *\[\(.*\)\]$/\1/p' "$f" | sed -n '1p' | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep . | sort | tr '\n' ',' | sed 's/,$//')"
      if [ "$have" != "$want" ]; then
        echo "# warning: $id dependsOn [$have] vs E2 After [$want]"
        nwarn=$((nwarn + 1))
      fi
    fi
    if [ -n "$size" ]; then
      est="$(sed -n 's/^estimate: *//p' "$f" | sed -n '1p' | sed 's/^ *//; s/ *$//')"
      if [ "$est" != "$size" ]; then
        echo "# warning: $id estimate [$est] vs E2 Size [$size]"
        nwarn=$((nwarn + 1))
      fi
    fi
  done
done < "$tmp/e2rows"
echo "# roadmap-cards: $nids E2 ids, $ncards cards, $nwarn warnings"
echo "ok - roadmap-cards"

# ---- doc-fixes (audit addendum) ---------------------------------------------------------------------------------
CASE=doc-fixes
R08="$ROOT/docs/requirements/08-product-definition-personas-mvp-scope.md"
grep -q -F -- 'Superseded by ADR 0001 R1 and ADR 0002 A2/A6: AISC 360-22 LRFD W-shapes only; RC members in Analyze tasks only; ASD after the pilot' "$R08" \
  || fail "MVP-02 in docs/requirements/08 has no 'Superseded by ADR 0001 R1 and ADR 0002 A2/A6' line"
grep -q '^| R1 ' "$ADR1" || fail "ADR 0001 has no row R1"
for a in A2 A4 A6; do grep -q "^| $a " "$ADR2" || fail "ADR 0002 has no row $a"; done
awk '/^## Documents that carry/{f=1} f' "$ADR2" | grep -q -F -- 'MVP-02' || fail "ADR 0002's list of amended rows in file 08 lacks MVP-02"
UXR="$ROOT/docs/ux/README.md"
INV="$ROOT/docs/ux/screen-inventory.md"
count="$(grep -o -E '[0-9]+ screens, [0-9]+ in the MVP' "$UXR")"
[ -n "$count" ] || fail "docs/ux/README.md has no '<n> screens, <m> in the MVP' line"
want_all="${count%% screens*}"
want_mvp="$(printf '%s' "$count" | sed -E 's/.*, ([0-9]+) in the MVP/\1/')"
have_all="$(grep -c -E '^\| [0-9]+ \|' "$INV")"
have_mvp="$(grep -E '^\| [0-9]+ \|' "$INV" | grep -c -E '\| yes \|$')"
[ "$want_all" -eq "$have_all" ] || fail "docs/ux/README.md says $want_all screens, the inventory has $have_all numbered rows"
[ "$want_mvp" -eq "$have_mvp" ] || fail "docs/ux/README.md says $want_mvp in the MVP, the inventory has $have_mvp rows marked yes"
grep -q -F -- "$count" "$INV" || fail "docs/ux/screen-inventory.md's own count line disagrees with docs/ux/README.md ('$count')"
SEC="$ROOT/docs/ops/secrets.md"
grep -q -F -- 'present in `.gitignore` since `89bed6d` (PLAN-04 follow-ups)' "$SEC" || fail "docs/ops/secrets.md does not say the .env patterns are in .gitignore since 89bed6d (PLAN-04 follow-ups)"
grep -q -F -- 'not there yet' "$SEC" && fail "docs/ops/secrets.md still says the .env patterns are not there yet"
for p in '.env.local' '.env.*.local'; do grep -q -x -F -- "$p" "$ROOT/.gitignore" || fail ".gitignore has no '$p' line"; done
grep -q -F -- 'E4 of `docs/plan/roadmap.md`' "$SEC" || fail "docs/ops/secrets.md does not point at E4 of docs/plan/roadmap.md"
grep -q -F -- 'E4 of the plan lists' "$SEC" && fail "docs/ops/secrets.md still says 'E4 of the plan lists'"
BS="$ROOT/docs/architecture/build-sequence.md"
grep -q -F -- 'Part E of `docs/plan/roadmap.md`' "$BS" || fail "docs/architecture/build-sequence.md does not point at Part E of docs/plan/roadmap.md"
grep -q -F -- 'Part E of the plan turns' "$BS" && fail "docs/architecture/build-sequence.md still says 'Part E of the plan turns'"
IDX="$ROOT/docs/requirements/00-index.md"
grep -q -F -- '`docs/plan/roadmap.md`, Part A' "$IDX" || fail "docs/requirements/00-index.md does not point at docs/plan/roadmap.md Part A"
grep -q -F -- 'the approved plan (Part A)' "$IDX" && fail "docs/requirements/00-index.md still says 'the approved plan (Part A)'"
ndocs="$(grep -c -E '^\| \[[0-9]{2}-' "$IDX")"
total="$(grep -o -E '\*\*total\*\* \| \*\*[0-9]+\*\*' "$IDX" | grep -o -E '[0-9]+' | sed -n '1p')"
[ -n "$total" ] || fail "docs/requirements/00-index.md has no total row"
grep -q -F -- "$ndocs documents, $total requirements" "$README" \
  || fail "README.md does not say '$ndocs documents, $total requirements' as docs/requirements/00-index.md counts"
echo "# doc-fixes: MVP-02 superseded, ADR 0002 lists MVP-02, $want_all screens / $want_mvp MVP as the inventory counts, secrets.md and the plan pointers, $ndocs documents / $total requirements"
echo "ok - doc-fixes"

# ---- check-steps (AC6) ------------------------------------------------------------------------------------------
CASE=check-steps
CHK="$ROOT/tools/check.sh"
WS="$ROOT/tools/test/workspace.test.sh"
[ -f "$CHK" ] || fail "tools/check.sh does not exist"
[ -f "$WS" ] || fail "tools/test/workspace.test.sh does not exist"
grep -q -x -F -- 'STEPS=7' "$CHK" || fail "tools/check.sh does not set STEPS=7"
grep -q -x -F -- 'run_step 7 docs bash tools/test/docs.test.sh' "$CHK" || fail "tools/check.sh does not run the docs test as step 7"
grep -q -E '^#   7 docs +bash tools/test/docs.test.sh' "$CHK" || fail "the header of tools/check.sh does not list step 7 docs"
grep -q -F -- 'check: 7/7 ok in' "$CHK" || fail "the header of tools/check.sh does not describe the 'check: 7/7 ok in <t>s' line"
grep -q -E '/6( |$)|6/6' "$CHK" && fail "tools/check.sh still says /6"
grep -q -F -- '7/7 docs ok|' "$WS" || fail "tools/test/workspace.test.sh does not expect '7/7 docs ok|'"
grep -q -E '[0-9]/6 |6/6' "$WS" && fail "tools/test/workspace.test.sh still pins six steps"
grep -q -F -- '-eq 6 ]' "$WS" && fail "tools/test/workspace.test.sh still counts six step lines"
hits="$(grep -l -E 'check: [0-9]+/6|[0-9]/6 (lint|typecheck|test|cargo-fmt|cargo-clippy|cargo-test|docs|ok)|STEPS=6' \
         "$ROOT"/tools/*.sh "$ROOT"/tools/test/*.sh "$ROOT"/.github/workflows/*.yml "$ROOT"/docs/ops/*.md 2>/dev/null \
         | grep -v -F -- 'tools/test/docs.test.sh' || true)"  # this file holds the pattern itself
[ -z "$hits" ] || fail "files still pinning six check steps" "$hits"
echo "# check-steps: tools/check.sh STEPS=7 with step 7 docs; workspace.test.sh pins 7/7; nothing pins 6"
echo "ok - check-steps"

# ---- pause-check (the pause check of 2026-11-04, commit 8cdcf34) ------------------------------------------------
CASE=pause-check
CL="$ROOT/CLAUDE.md"
[ -f "$CL" ] || fail "CLAUDE.md does not exist"
links_of "$CL" > "$tmp/cl-links"
grep -q -x -F -- 'README.md' "$tmp/cl-links" || fail "CLAUDE.md does not link README.md"
while IFS= read -r target; do
  [ -n "$target" ] || continue
  case "$target" in http://*|https://*|mailto:*|'#'*) continue ;; esac
  [ -e "$ROOT/${target%%#*}" ] || fail "CLAUDE.md link '$target' does not resolve"
done < "$tmp/cl-links"
grep -o '`[^`]*`' "$CL" | tr -d '`' | grep -E '^(docs|factory|tools|\.claude)/' | sort -u > "$tmp/cl-paths" || true
ncl=0
while IFS= read -r p; do
  [ -n "$p" ] || continue
  [ -e "$ROOT/$p" ] || fail "CLAUDE.md names '$p', which does not exist"
  ncl=$((ncl + 1))
done < "$tmp/cl-paths"
for p in docs/plan/roadmap.md docs/plan/progress.md docs/decisions/log.md factory/README.md .claude/skills/factory/SKILL.md; do
  grep -q -x -F -- "$p" "$tmp/cl-paths" || fail "CLAUDE.md does not name $p"
done
tr '\n' ' ' < "$CL" | sed 's/  */ /g' > "$tmp/cl.flat"
for s in 'Start here' 'pause entry' 'pause note at the end of its Spec' 're-read a file before editing it' \
         'never `git add -A`' 'announce commits' 'only one session run the monitor watch'; do
  grep -q -F -- "$s" "$tmp/cl.flat" || fail "CLAUDE.md does not say '$s' (line wraps allowed)"
done
# What CLAUDE.md and the decisions log point at exists: a pause entry in the log, the pause note in card P0-11's Spec.
npause="$(grep -c -E '^- Paused 20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} ' "$tmp/log" || true)"
[ "$npause" -ge 1 ] || fail "CLAUDE.md points at the pause entry of docs/plan/progress.md; its ## Log has no '- Paused <date> <time> ...' entry"
# Through a file, not a pipe: `grep -q` leaves at its first match, awk then dies of SIGPIPE on the Spec text that follows the
# pause note, and `set -o pipefail` reports that as a failure of the assertion (seen once the Spec grew past the note).
awk '/^## Spec/{f=1;next} /^## Plan/{f=0} f' "$ROOT"/factory/cards/P0-11-*.md > "$tmp/p0-11-spec"
grep -q -F -- 'Pause note (foreman, 2026-11-04)' "$tmp/p0-11-spec" \
  || fail "card P0-11's Spec has no 'Pause note (foreman, 2026-11-04)', which docs/decisions/log.md cites"
for s in 'Pause development' '8e1f6dd' 'Pause note (foreman, 2026-11-04)' 'not started' '`CLAUDE.md`' 'card P0-12' \
         '`docs/ops/secrets.md`' '`docs/ops/local-dev.md`'; do
  grep -q -F -- "$s" "$tmp/dec-rows" || fail "no dated row of docs/decisions/log.md says '$s' (the owner's pause answers of 2026-11-04)"
done
c=0
for g in "$ROOT"/factory/cards/P0-12-*.md; do [ -f "$g" ] && c=$((c + 1)); done
[ "$c" -eq 1 ] || fail "card P0-12 has $c files factory/cards/P0-12-*.md, expected 1"
# docs/ops/local-dev.md, "Other local ports": every port its sources set is in the table, on a row naming that source.
LD="$ROOT/docs/ops/local-dev.md"
awk '/^## Other local ports/{f=1;next} /^## /{f=0} f' "$LD" > "$tmp/ports"
[ -s "$tmp/ports" ] || fail "docs/ops/local-dev.md has no '## Other local ports' section"
grep '^| [0-9]' "$tmp/ports" > "$tmp/port-rows" || true
tr '\n' ' ' < "$tmp/ports" | sed 's/  */ /g' > "$tmp/ports.flat"
port_row() {  # $1 = port, $2 = source file the row must name: true when a table row lists the port in its first cell and names the file
  grep -F -- "$2" "$tmp/port-rows" | cut -d'|' -f2 | tr ',' '\n' | tr -d ' ' | grep -q -x -F -- "$1"
}
sed -n 's/^ *- "\([0-9][0-9]*\):[0-9][0-9]*" *$/\1/p' "$ROOT/compose.yaml" > "$tmp/compose-ports"
ncp="$(grep -c . "$tmp/compose-ports" || true)"
[ "$ncp" -gt 0 ] || fail "compose.yaml publishes no host port this test can read (lines of the form '- \"<host>:<container>\"')"
while IFS= read -r p; do
  port_row "$p" 'compose.yaml' || fail "the port table of docs/ops/local-dev.md has no compose.yaml row for host port $p, which compose.yaml publishes"
done < "$tmp/compose-ports"
vp="$(sed -n "s/.*add_argument('--port', type=int, default=\([0-9][0-9]*\)).*/\1/p" "$ROOT/tools/monitor/serve.py" | sed -n '1p')"
[ -n "$vp" ] || fail "tools/monitor/serve.py has no --port default this test can read"
port_row "$vp" 'tools/monitor/serve.py' || fail "the port table of docs/ops/local-dev.md has no tools/monitor/serve.py row for port $vp, the viewer's default"
ip="$(sed -n 's/^ *PORT=\([0-9][0-9]*\).*/\1/p' "$ROOT/Dockerfile" | sed -n '1p')"
[ -n "$ip" ] || fail "the Dockerfile sets no PORT this test can read"
port_row "$ip" 'Dockerfile' || fail "the port table of docs/ops/local-dev.md has no Dockerfile row for port $ip, the image's PORT"
HQ="$ROOT/tools/agent-hq"
hqnote="Agent HQ not in this copy"
if [ -f "$HQ/vite.config.ts" ] && [ -f "$HQ/server/index.ts" ]; then
  dev="$(sed -n 's/.*server: { port: \([0-9][0-9]*\).*/\1/p' "$HQ/vite.config.ts" | sed -n '1p')"
  prev="$(sed -n 's/.*preview: { port: \([0-9][0-9]*\).*/\1/p' "$HQ/vite.config.ts" | sed -n '1p')"
  api="$(sed -n 's/.*process\.env\.PORT ?? \([0-9][0-9]*\).*/\1/p' "$HQ/server/index.ts" | sed -n '1p')"
  # Another session owns these two files: a port this test cannot read from them is reported, not failed.
  hqnote="Agent HQ dev ${dev:-unread} preview ${prev:-unread} api ${api:-unread}"
  [ -z "$dev" ] || port_row "$dev" 'tools/agent-hq/vite.config.ts' \
    || fail "the port table of docs/ops/local-dev.md has no tools/agent-hq/vite.config.ts row for port $dev, Agent HQ's dev server"
  [ -z "$prev" ] || port_row "$prev" 'tools/agent-hq/vite.config.ts' \
    || fail "the port table of docs/ops/local-dev.md has no tools/agent-hq/vite.config.ts row for port $prev, Agent HQ's preview"
  [ -z "$api" ] || port_row "$api" 'tools/agent-hq/server/index.ts' \
    || fail "the port table of docs/ops/local-dev.md has no tools/agent-hq/server/index.ts row for port $api, Agent HQ's API default"
  if [ -n "$api" ] && [ "$api" = "$vp" ]; then
    grep -q -F -- "both default to $vp" "$tmp/ports.flat" \
      || fail "the monitor viewer and Agent HQ's API both default to $vp; the 'Other local ports' section of docs/ops/local-dev.md does not say so"
    grep -q -F -- 'P0-12' "$tmp/ports.flat" || fail "the 'Other local ports' section of docs/ops/local-dev.md does not name card P0-12 for the shared port $vp"
  elif [ -n "$api" ]; then
    grep -q -F -- 'both default to' "$tmp/ports.flat" \
      && fail "docs/ops/local-dev.md still says the viewer and Agent HQ's API share a default port; serve.py defaults to $vp and Agent HQ's API to $api"
  fi
fi
# docs/ops/secrets.md, the Agent HQ section: every variable of tools/agent-hq/.env.example by name, never a value.
awk '/^## Agent HQ/{f=1;next} /^## /{f=0} f' "$SEC" > "$tmp/hq-sec"
[ -s "$tmp/hq-sec" ] || fail "docs/ops/secrets.md has no '## Agent HQ' section"
nhqv=0
if [ -f "$HQ/.env.example" ]; then
  sed -n 's/^\([A-Z][A-Z0-9_]*\)=.*/\1/p' "$HQ/.env.example" | sort -u > "$tmp/hq-names"
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    grep -q -F -- "\`$v\`" "$tmp/hq-sec" || fail "the Agent HQ section of docs/ops/secrets.md does not name \`$v\`, which tools/agent-hq/.env.example sets"
    nhqv=$((nhqv + 1))
  done < "$tmp/hq-names"
fi
bad="$(grep -E '[A-Z][A-Z0-9_]{2,}=' "$tmp/hq-sec" || true)"
[ -z "$bad" ] || fail "the Agent HQ section of docs/ops/secrets.md carries an assignment; it lists names only, never values" "$bad"
echo "# pause-check: CLAUDE.md names $ncl existing paths; $npause pause entry; ports: compose $(tr '\n' ' ' < "$tmp/compose-ports")image $ip viewer $vp, $hqnote; secrets.md names $nhqv Agent HQ variables"
echo "ok - pause-check"

# ---- git-facts (AC2, AC3, AC4; only in a git work tree) ---------------------------------------------------------
CASE=git-facts
top=""
if command -v git >/dev/null 2>&1; then top="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"; fi
if [ -z "$top" ] || [ "$(cd "$top" && pwd -P)" != "$(cd "$ROOT" && pwd -P)" ]; then
  echo "# git-facts: skipped ($ROOT is not a git work tree)"
  echo "ok - git-facts # skipped"
  exit 0
fi
nlink=0
while IFS= read -r path; do
  [ -n "$path" ] || continue
  n="$(git -C "$ROOT" ls-files --cached --others --exclude-standard -- "$path" | grep -c . || true)"
  [ "$n" -gt 0 ] || fail "README.md links '$path', which git neither tracks nor sees as a new, unignored file"
  nlink=$((nlink + 1))
done < "$tmp/paths"
# The pause check: CLAUDE.md is tracked (or new and unignored); Agent HQ's own .env, which docs/ops/secrets.md calls ignored, is not tracked.
n="$(git -C "$ROOT" ls-files --cached --others --exclude-standard -- CLAUDE.md | grep -c . || true)"
[ "$n" -gt 0 ] || fail "CLAUDE.md is neither tracked nor a new, unignored file"
n="$(git -C "$ROOT" ls-files --cached -- tools/agent-hq/.env | grep -c . || true)"
[ "$n" -eq 0 ] || fail "tools/agent-hq/.env is tracked; docs/ops/secrets.md says it is ignored and holds the tool's secrets"
if [ "$(git -C "$ROOT" rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
  echo "# git-facts: $nlink README links tracked or new; commit checks skipped (shallow clone)"
  echo "ok - git-facts"
  exit 0
fi
sed 's/^/ /; s/$/ /' "$PROGRESS" "$DEC" | grep -o -E '[^0-9a-zA-Z_][0-9a-f]{7}[^0-9a-zA-Z_]' | sed -E 's/^.//; s/.$//' | sort -u > "$tmp/hashes"
nhash=0
while IFS= read -r h; do
  [ -n "$h" ] || continue
  git -C "$ROOT" cat-file -e "$h^{commit}" 2>/dev/null || fail "commit $h, cited in docs/plan/progress.md or docs/decisions/log.md, does not exist in this repository"
  nhash=$((nhash + 1))
done < "$tmp/hashes"
grep -E '^- 20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}, ' "$tmp/log" > "$tmp/entries" || true
nent=0
while IFS= read -r e; do
  [ -n "$e" ] || continue
  when="$(printf '%s' "$e" | sed -E 's/^- ([0-9-]+ [0-9:]+), .*/\1/')"
  id="$(printf '%s' "$e" | sed -E 's/^- [0-9-]+ [0-9:]+, ([^,]+), commit ([0-9a-f]{7}).*/\1/')"
  h="$(printf '%s' "$e" | sed -E 's/^- [0-9-]+ [0-9:]+, ([^,]+), commit ([0-9a-f]{7}).*/\2/')"
  [ "${#h}" -eq 7 ] || fail "a log entry has no ', <id>, commit <hash>' shape: $e"
  subj="$(git -C "$ROOT" log -1 --format=%s "$h" 2>/dev/null)" || fail "commit $h of the $id log entry does not exist"
  case "$id" in
    'no card') ;;
    *) case "$subj" in
         *"$id"*) ;;
         *) printf '%s\n' "$e" | grep -q -F -- 'history line' \
              || fail "commit $h ('$subj') does not name $id in its subject and the entry does not say where the hash comes from" ;;
       esac ;;
  esac
  got="$(TZ=Etc/GMT-8 git -C "$ROOT" log -1 --date=format-local:'%Y-%m-%d %H:%M' --format=%ad "$h")"
  [ "$got" = "$when" ] || fail "the $id log entry says $when, commit $h is at $got on the UTC+8 clock"
  nent=$((nent + 1))
done < "$tmp/entries"
# Loop 1 item 1, proved and not only pinned: the commit docs/ops/secrets.md names for the .env patterns is the oldest commit
# in which the number of `.env.local` lines of .gitignore changed, that is, the one that added them.
cited="$(sed -n 's/.*present in `\.gitignore` since `\([0-9a-f]\{7,40\}\)`.*/\1/p' "$SEC" | sed -n '1p')"
[ -n "$cited" ] || fail "docs/ops/secrets.md names no commit for the .env patterns ('present in \`.gitignore\` since \`<hash>\`')"
added="$(git -C "$ROOT" log --format=%H -S'.env.local' -- .gitignore | tail -n 1)"
[ -n "$added" ] || fail "git log -S'.env.local' -- .gitignore finds no commit"
[ "$(git -C "$ROOT" rev-parse --verify --quiet "$cited^{commit}" 2>/dev/null)" = "$added" ] \
  || fail "docs/ops/secrets.md says the .env patterns are in .gitignore since $cited; git log -S'.env.local' -- .gitignore says they arrived in $(git -C "$ROOT" rev-parse --short=7 "$added")"
# A pause entry is written at its own time: it cites no commit made later (on the UTC+8 clock, to the minute).
awk '/^- /{p = ($0 ~ /^- Paused /)} p' "$tmp/log" \
  | awk '/^- Paused /{if (e != "") print e; e = $0; next} {e = e " " $0} END {if (e != "") print e}' > "$tmp/pauses"
npa=0
while IFS= read -r e; do
  [ -n "$e" ] || continue
  when="$(printf '%s\n' "$e" | sed -E 's/^- Paused ([0-9-]+ [0-9:]+) .*/\1/')"
  for h in $(printf '%s\n' "$e" | grep -o -E '`[0-9a-f]{7}`' | tr -d '`' | sort -u); do
    got="$(TZ=Etc/GMT-8 git -C "$ROOT" log -1 --date=format-local:'%Y-%m-%d %H:%M' --format=%ad "$h" 2>/dev/null)" \
      || fail "commit $h of the pause entry of $when does not exist"
    [ "$got" \> "$when" ] && fail "the pause entry of $when cites commit $h, which was made later, at $got on the UTC+8 clock"
  done
  npa=$((npa + 1))
done < "$tmp/pauses"
# Third test station, rulings 8 and 13 (F9): what the roadmap's Origin line says of the commit that holds the origin copy
# is what git holds: the commit's time on the UTC+8 clock, and the plan file it committed (its line count, its size, and
# no final newline, which is the one byte the body here has more). $tmp/origin and its numbers come from plan-copies.
oc="$(sed -n 's/.*as committed verbatim in \([0-9a-f]\{7\}\) (\([0-9-]* [0-9:]*\) +0800).*/\1 \2/p' "$tmp/origin")"
[ -n "$oc" ] || fail "the Origin line of docs/plan/roadmap.md names no commit in the form 'as committed verbatim in <hash> (<date> <time> +0800)'"
oh="${oc%% *}"
owhen="${oc#* }"
git -C "$ROOT" cat-file -e "$oh^{commit}" 2>/dev/null || fail "commit $oh, named by the Origin line of docs/plan/roadmap.md, does not exist in this repository"
got="$(TZ=Etc/GMT-8 git -C "$ROOT" log -1 --date=format-local:'%Y-%m-%d %H:%M' --format=%ad "$oh")"
[ "$got" = "$owhen" ] || fail "the Origin line of docs/plan/roadmap.md dates commit $oh $owhen +0800; git says $got on the UTC+8 clock"
git -C "$ROOT" show "$oh:docs/plan/roadmap.md" > "$tmp/origin-blob" 2>/dev/null \
  || fail "commit $oh holds no docs/plan/roadmap.md, which the Origin line says it committed verbatim"
gb="$(wc -c < "$tmp/origin-blob" | tr -d ' ')"
gl="$(grep -c '' "$tmp/origin-blob")"
[ "$gb" -eq "$obytes" ] && [ "$gl" -eq "$olines" ] \
  || fail "docs/plan/roadmap.md in commit $oh has $gl lines and $gb bytes; the Origin line says $olines lines, $obytes bytes"
[ "$(tail -c 1 "$tmp/origin-blob" | wc -l | tr -d ' ')" -eq 0 ] \
  || fail "docs/plan/roadmap.md in commit $oh ends with a newline; the Origin line says the body differs from it by the final newline it lacked"
echo "# git-facts: $nlink README links tracked or new; $nhash cited commits exist; $nent log entries match their commit's subject and time"
echo "# git-facts: the roadmap's Origin line: commit $oh at $owhen +0800, $olines lines and $obytes bytes without a final newline, as git holds it"
echo "# git-facts: the .env patterns entered .gitignore in $(git -C "$ROOT" rev-parse --short=7 "$added"), as docs/ops/secrets.md says; $npa pause entries cite no later commit; CLAUDE.md tracked or new"
echo "ok - git-facts"
exit 0
