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
#   git-facts      AC2, AC3, AC4 when the repository is a git work tree (skipped in a plain copy of the files): every
#                       README link is tracked or a new, unignored file; every commit hash the two logs cite exists (skipped
#                       in a shallow clone); every log entry's commit carries the card id in its subject (or the entry says
#                       where the hash comes from) and its time on the UTC+8 clock
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
echo "# readme: $n lines, $nlinks links, $nrel relative links resolve, $nanch anchors are headings"
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
awk '/^## Log/{f=1} f' "$PROGRESS" > "$tmp/log"
for s in '0e2e2cf' 'run URL' 'dfd0b72' 'd8d8b7e' '8e0e550'; do
  grep -q -F -- "$s" "$tmp/log" || fail "'$s' is not in the ## Log section of docs/plan/progress.md"
done
awk 'f{print} /^<!-- board:end -->$/{f=1}' "$PROGRESS" > "$tmp/after-board"
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
  ndone=$((ndone + 1))
done
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
# The intro defines the marker; any row may carry it (an owner answer with no other written source).
awk '/^[|] *Date *[|] *Decision/{exit} {print}' "$DEC" | tr '\n' ' ' | sed 's/  */ /g' > "$tmp/dec-intro"
grep -q -F -- '"chat only; this log is the record"' "$tmp/dec-intro" \
  || fail "the intro of docs/decisions/log.md does not define the marker \"chat only; this log is the record\" (line wraps allowed)"
grep -F -- '55432' "$tmp/dec-rows" | cut -d'|' -f4 | grep -q -F -- 'plan station' \
  || fail "the 55432/RustFS row's Who cell does not say the amendments are the plan station's"
grep -F -- 'Still open' "$tmp/dec-rows" | grep -q -F -- 'P1-05' || fail "the 'Still open' row does not name P1-05"
# Every backticked repository path exists; every `card <id>` has one card file; every cited history line and ADR row exists.
grep -o '`[^`]*`' "$DEC" | tr -d '`' | grep -E '^(docs|tools|factory|\.bridle)/' | sort -u > "$tmp/dec-paths" || true
npath=0
while IFS= read -r p; do
  [ -n "$p" ] || continue
  [ -e "$ROOT/$p" ] || fail "docs/decisions/log.md names '$p', which does not exist"
  npath=$((npath + 1))
done < "$tmp/dec-paths"
grep -o -E 'card (P[0-9]-[0-9]{2}(\.[0-9])?|PLAN-[0-9]{2})' "$DEC" | sed 's/^card //' | sort -u > "$tmp/dec-cards" || true
ncard=0
while IFS= read -r id; do
  [ -n "$id" ] || continue
  c=0
  for g in "$ROOT/factory/cards/$id"-*.md; do [ -f "$g" ] && c=$((c + 1)); done
  [ "$c" -eq 1 ] || fail "docs/decisions/log.md cites card $id, which has $c files factory/cards/$id-*.md"
  ncard=$((ncard + 1))
done < "$tmp/dec-cards"
grep -o -E 'card (P[0-9]-[0-9]{2}(\.[0-9])?|PLAN-[0-9]{2}) history [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z' "$DEC" | sort -u > "$tmp/dec-hist" || true
nhist=0
while IFS= read -r h; do
  [ -n "$h" ] || continue
  id="$(printf '%s' "$h" | sed -E 's/^card ([^ ]+) history .*/\1/')"
  ts="$(printf '%s' "$h" | sed -E 's/^card [^ ]+ history (.*)$/\1/')"
  cat "$ROOT/factory/cards/$id"-*.md | grep -q -F -- "  - $ts " || fail "card $id has no history line at $ts, which docs/decisions/log.md cites"
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
awk '/^### E1[.]/{f=1;next} /^### E2[.]/{f=0} f' "$ROADMAP" | grep -q -F -- "$Q" \
  || fail "the E1 section of docs/plan/roadmap.md does not hold the fixtures sentence the station agents quote"
for f in .claude/agents/factory-planner.md .claude/agents/factory-tester.md; do
  tr '\n' ' ' < "$ROOT/$f" | sed 's/  */ /g' | grep -q -F -- "$Q" || fail "$f does not quote the E1 fixtures rule (line wraps allowed)"
  grep -q -F -- 'docs/plan/roadmap.md` E1' "$ROOT/$f" || fail "$f does not cite docs/plan/roadmap.md E1"
done
echo "# factory-docs: README sections and links, line.md ship row, SKILL.md steps 0, 1, 6, status and run, the agents' E1 quote"
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
EXEMPT=" P0-01 P0-03 P0-04 P0-10 P0-11 PLAN-01 PLAN-02 PLAN-03 PLAN-04 PLAN-05 "
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
echo "# git-facts: $nlink README links tracked or new; $nhash cited commits exist; $nent log entries match their commit's subject and time"
echo "ok - git-facts"
exit 0
