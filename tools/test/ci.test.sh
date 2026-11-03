#!/usr/bin/env bash
# Tests for card P0-02.3 (Actions PR workflow proven on a pushed branch): one case per acceptance criterion, in
# the card's order (AC1 has two: the file and the docs-only path it proved).
#   workflow   AC1  .github/workflows/check.yml exists and parses as YAML (ruby's Psych at /usr/bin/ruby; without
#                   it `# yaml: no parser`, the grep checks still run); its `on:` block has `pull_request:` and
#                   `push:` with `branches: [main]`; the jobs are exactly `changes`, `code`, `docs`, `check`, each
#                   `runs-on: ubuntu-latest`; the paths filter is `some-with-excludes` with the four rules `**`,
#                   `!docs/**`, `!factory/**`, `!**/*.md`; the setup steps (pnpm/action-setup, setup-node with
#                   `node-version-file: .node-version` and `cache: pnpm`, dtolnay/rust-toolchain,
#                   mozilla-actions/sccache-action) and the three commands (`pnpm install --frozen-lockfile`,
#                   `bash tools/doctor.sh --ci`, `pnpm check`) are there; `changes` has `pull-requests: read`;
#                   the summary job has `needs: [changes, code, docs]` and `if: always()`; every `uses:` is
#                   `owner/repo@<40-hex sha> # <tag>`; `bash tools/doctor.sh --ci` exits 0 with exactly the six
#                   rows rustup, rust, node, pnpm, rust-toolchain.toml, .node-version; actionlint runs when it is
#                   on PATH (report only, `# actionlint: ...`)
#   docs-only  AC1  the stacked proof pull request (head ci/p0-02-3-docs) is one PR based on ci/p0-02-3; its
#                   latest pull_request run of workflow `check` is completed/success with jobs changes success,
#                   code skipped, docs success, check success (the filter skipped the heavy job)
#   pr-run     AC2  the proof pull request (head ci/p0-02-3) is one PR based on main; its latest pull_request run
#                   of workflow `check` is completed/success with changes success, code success, docs skipped,
#                   check success; at least one of that PR's run URLs (`actions/runs/<id>`) is recorded in this
#                   card's `## Build` (later synchronize runs get new ids, so any run of the PR counts);
#                   with --shipped also: the PR is merged and its merge commit is an ancestor of origin/main
#                   (after `git fetch origin`)
#   gates      AC3  the entries of card P0-06.3's `manualGates:` line against `required_status_checks` of the
#                   `main` branch protection: both unticked with no required checks (before the ship of
#                   P0-02.3), or both `[x]` with contexts == ["check"] and strict == true (after it); any other
#                   mix fails; with --shipped only the second state passes
#   docs       AC4  docs/ops/github.md names the workflow file, the required check wiring
#                   (`required_status_checks`, `strict`), the proof branch and the PR flow (`gh pr create`,
#                   `gh pr merge --squash`), a run URL, ticks (c), points at this test, and holds every SHA the
#                   workflow pins (the pin table stays honest)
#
# Run:  bash tools/test/ci.test.sh            (from any directory; the script finds the repository from its path)
#       bash tools/test/ci.test.sh --shipped  (the foreman, after the merge, the protection PATCH and the ticks)
# Prints `ok - <case>` per case (and `# ...` comment lines); stops at the first failed assertion with
# `not ok - <case>: <why>` on stderr, exit 1. Needs bash 3.2, git, gh logged in (the docs-only, pr-run and gates
# cases read GitHub; without gh they fail, they do not skip), awk, grep, sed, sort, tr, mktemp; python3 through
# tools/doctor.sh. Read-only: `gh api` GETs only (the pull requests by head branch, the runs by head branch, a
# run's jobs, the branch protection), `git remote get-url`, and under --shipped `git fetch origin` (remote-tracking
# refs only) and `git merge-base`; nothing is written to GitHub or to the repository.
# Negative proof only (never for a normal run): CI_TEST_WORKFLOW=<file>, CI_TEST_CARD=<file> (this card),
# CI_TEST_GATES_CARD=<file> (card P0-06.3) and CI_TEST_DOCS=<file> point a case at a scratch copy, so a line can be
# removed or a gate ticked without touching the real files.
set -u
set -o pipefail
export GIT_TERMINAL_PROMPT=0

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WF="${CI_TEST_WORKFLOW:-$ROOT/.github/workflows/check.yml}"
DOCS="${CI_TEST_DOCS:-$ROOT/docs/ops/github.md}"
CARD="${CI_TEST_CARD:-}"
GCARD="${CI_TEST_GATES_CARD:-}"
CODE_BRANCH=ci/p0-02-3        # the proof branch: check.yml, doctor.sh --ci, the doc (PR #1 -> main)
DOCS_BRANCH=ci/p0-02-3-docs   # the stacked docs-only branch (PR #2 -> ci/p0-02-3)
BRANCH=main
WORKFLOW=check
SHIPPED=0
CASE=setup

usage() {
  echo "usage: bash tools/test/ci.test.sh [--shipped]" >&2
}
for a in "$@"; do
  case "$a" in
    --shipped) SHIPPED=1 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; echo "not ok - setup: unknown argument '$a'" >&2; exit 2 ;;
  esac
done

fail() {  # $1 = why; $2 = output to show (optional). Prints `not ok` and exits 1.
  echo "not ok - $CASE: $1" >&2
  if [ -n "${2-}" ]; then
    echo "--- output ---" >&2
    printf '%s\n' "$2" >&2
    echo "--- end ---" >&2
  fi
  exit 1
}

find_card() {  # $1 = card id prefix: the one factory/cards/<id>-*.md
  n=0
  found=""
  for f in "$ROOT"/factory/cards/"$1"-*.md; do
    [ -f "$f" ] || continue
    found="$f"
    n=$((n + 1))
  done
  [ "$n" -eq 1 ] || fail "expected one card file factory/cards/$1-*.md, found $n"
  printf '%s\n' "$found"
}
[ -n "$CARD" ] || CARD="$(find_card P0-02.3)" || exit 1
[ -n "$GCARD" ] || GCARD="$(find_card P0-06.3)" || exit 1
[ -f "$CARD" ] || fail "$CARD not found"
[ -f "$GCARD" ] || fail "$GCARD not found"
tmp="$(mktemp -d)" || fail "mktemp -d failed"
trap 'rm -rf "$tmp"' EXIT

# ---- helpers --------------------------------------------------------------------------------------------------

git_q() {  # every git call runs in the repository, whatever the current directory
  git -C "$ROOT" "$@"
}
api() {  # $1 = endpoint, $2 = jq filter: a GET; sets OUT and, on failure, STATUS (the HTTP status or the error)
  OUT="$(gh api "$1" --jq "$2" 2>"$tmp/api.err")"
  rc=$?
  STATUS=""
  if [ "$rc" -ne 0 ]; then
    STATUS="$(sed -n 's/.*(HTTP \([0-9][0-9]*\)).*/\1/p' "$tmp/api.err" | sed -n '1p')"
    [ -n "$STATUS" ] || STATUS="$(printf '%s\n' "$OUT" | sed -n 's/.*"status": *"\([0-9][0-9]*\)".*/\1/p' | sed -n '1p')"
    [ -n "$STATUS" ] || STATUS="error: $(tr '\n' ' ' < "$tmp/api.err")"
  fi
  return "$rc"
}
need_gh() {  # the GitHub cases need gh logged in and a github.com origin
  command -v gh >/dev/null 2>&1 || fail "gh is not installed (the $CASE case reads GitHub)"
  gh auth status >/dev/null 2>&1 || fail "gh is not logged in (the $CASE case reads GitHub)"
  [ -n "$REPO" ] || fail "origin is not a github.com remote (the $CASE case reads GitHub)"
}
pr_of_branch() {  # $1 = head branch: exactly one pull request (any state) with that head; sets PR_N, PR_STATE,
                  # PR_BASE, PR_MERGED (merged_at or -), PR_MERGE_SHA (merge_commit_sha or -)
  head="$1"
  api "repos/$REPO/pulls?head=$OWNER:$head&state=all&per_page=10" \
      '.[] | [.number, .state, .base.ref, (.merged_at // "-"), (.merge_commit_sha // "-")] | join(" ")' \
    || fail "GET repos/$REPO/pulls?head=$OWNER:$head failed ($STATUS)" "$OUT"
  n="$(printf '%s\n' "$OUT" | grep -c .)"
  [ "$n" -eq 1 ] || fail "expected exactly one pull request with head $head (any state), found $n" "$OUT"
  set -- $OUT
  PR_N="$1"; PR_STATE="$2"; PR_BASE="$3"; PR_MERGED="$4"; PR_MERGE_SHA="$5"
}
runs_of_branch() {  # $1 = head branch: the pull_request runs of workflow `check` on it, newest first, one per line
                    # `<id> <status> <conclusion> <head sha 7> <attempt> <html_url>`; sets RUNS
  api "repos/$REPO/actions/runs?branch=$1&event=pull_request&per_page=50" \
      ".workflow_runs[] | select(.name == \"$WORKFLOW\") | [.id, .status, (.conclusion // \"-\"), .head_sha[0:7], .run_attempt, .html_url] | join(\" \")" \
    || fail "GET repos/$REPO/actions/runs?branch=$1&event=pull_request failed ($STATUS)" "$OUT"
  RUNS="$OUT"
}
latest_run() {  # $1 = head branch: its newest run (from runs_of_branch); sets RUN_ID, RUN_STATUS, RUN_CONCLUSION,
                # RUN_SHA, RUN_ATTEMPT, RUN_URL; fails when there is none or it is not completed/success
  runs_of_branch "$1"
  [ -n "$RUNS" ] || fail "no pull_request run of workflow $WORKFLOW on branch $1"
  set -- $(printf '%s\n' "$RUNS" | sed -n '1p')
  RUN_ID="$1"; RUN_STATUS="$2"; RUN_CONCLUSION="$3"; RUN_SHA="$4"; RUN_ATTEMPT="$5"; RUN_URL="$6"
  [ "$RUN_STATUS" = completed ] || fail "run $RUN_ID is $RUN_STATUS, not completed ($RUN_URL)"
  [ "$RUN_CONCLUSION" = success ] || fail "run $RUN_ID concluded $RUN_CONCLUSION, not success ($RUN_URL)"
}
run_jobs() {  # $1 = run id: `<job name> <conclusion>` per job; sets JOBS
  api "repos/$REPO/actions/runs/$1/jobs?per_page=50" '.jobs[] | [.name, (.conclusion // .status)] | join(" ")' \
    || fail "GET repos/$REPO/actions/runs/$1/jobs failed ($STATUS)" "$OUT"
  JOBS="$OUT"
}
expect_jobs() {  # $@ = `name=conclusion` pairs: each job of JOBS must exist once with that conclusion
  for want in "$@"; do
    name="${want%%=*}"
    conc="${want#*=}"
    n="$(printf '%s\n' "$JOBS" | awk -v n="$name" '$1 == n' | grep -c .)"
    [ "$n" -eq 1 ] || fail "run $RUN_ID: expected one job '$name', found $n ($RUN_URL)" "$JOBS"
    have="$(printf '%s\n' "$JOBS" | awk -v n="$name" '$1 == n { print $2; exit }')"
    [ "$have" = "$conc" ] || fail "run $RUN_ID: job '$name' is $have, expected $conc ($RUN_URL)" "$JOBS"
  done
}
jobs_line() {  # JOBS on one line
  printf '%s\n' "$JOBS" | awk '{ printf "%s%s %s", (NR > 1 ? ", " : ""), $1, $2 } END { print "" }'
}
has_line() {  # $1 = a line of the comment-free workflow, matched exactly after trimming leading spaces
  sed 's/^ *//' "$tmp/wf" | grep -q -x -F -- "$1"
}
gate_list() {  # the inside of the gates card's `manualGates: [...]` line(s), one output line per matching line
  sed -n 's/^manualGates: *\[\(.*\)\]$/\1/p' "$GCARD"
}
gate_entries() {  # $1 = one such list: its comma-separated entries, one per line, trimmed
  printf '%s\n' "$1" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep .
}

REPO="$(git_q remote get-url origin 2>/dev/null | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##; s#/$##')"
OWNER="${REPO%%/*}"

# ---- workflow (AC1) ---------------------------------------------------------------------------------------------
CASE=workflow
[ -f "$WF" ] || fail "$WF does not exist"
# The comment-free copy: whole-line comments go (the header names `uses:` in prose); trailing ` # <tag>` stay.
grep -v '^ *#' "$WF" > "$tmp/wf" || fail "cannot read $WF"
if [ -x /usr/bin/ruby ] && /usr/bin/ruby -ryaml -e 'exit 0' >/dev/null 2>&1; then
  parsed="$(/usr/bin/ruby -ryaml -e '
d = YAML.load_file(ARGV[0])
abort "the document is not a map" unless d.is_a?(Hash)
on = d["on"] || d[true]  # YAML 1.1 reads the bare key `on` as the boolean true
abort "no on: map" unless on.is_a?(Hash)
abort "on: has no pull_request" unless on.key?("pull_request")
abort "on.push.branches is not [main]" unless on["push"].is_a?(Hash) && on["push"]["branches"] == ["main"]
abort "jobs: is not a map" unless d["jobs"].is_a?(Hash)
puts d["jobs"].keys.join(" ")' "$WF" 2>&1)" || fail "$WF does not parse (ruby Psych): $parsed"
  [ "$parsed" = "changes code docs check" ] || fail "jobs are '$parsed', expected 'changes code docs check'"
  echo "# yaml: parses (ruby $(/usr/bin/ruby -e 'print RUBY_VERSION')); on: pull_request + push [main]; jobs: $parsed"
else
  echo "# yaml: no parser (no /usr/bin/ruby with Psych; this python3 has no yaml module): grep checks only"
fi
# on: pull_request (no branch filter) and push to main
on_block="$(awk '/^on:/ { f = 1; next } f && /^[^ ]/ { f = 0 } f' "$tmp/wf")"
[ -n "$on_block" ] || fail "no top-level 'on:' block"
printf '%s\n' "$on_block" | grep -q -x '  pull_request:' || fail "'on:' lacks 'pull_request:' (or it carries a filter)" "$on_block"
printf '%s\n' "$on_block" | grep -q -x '  push:' || fail "'on:' lacks 'push:'" "$on_block"
printf '%s\n' "$on_block" | grep -q -x '    branches: \[main\]' || fail "'on: push:' lacks 'branches: [main]'" "$on_block"
# the four jobs, in order, each on ubuntu-latest
jobs="$(awk '/^jobs:/ { f = 1; next } f' "$tmp/wf" | grep -x '  [a-z][a-z0-9_-]*:' | sed 's/^ *//; s/:$//' | tr '\n' ' ' | sed 's/ $//')"
[ "$jobs" = "changes code docs check" ] || fail "job ids are '$jobs', expected 'changes code docs check'"
n="$(grep -c -x ' *runs-on: ubuntu-latest' "$tmp/wf")"
[ "$n" -eq 4 ] || fail "expected 4 'runs-on: ubuntu-latest' (one per job), found $n"
# the paths filter: some-with-excludes, everything but the docs paths
for s in "predicate-quantifier: some-with-excludes" "- '**'" "- '!docs/**'" "- '!factory/**'" "- '!**/*.md'" \
         "pull-requests: read"; do
  has_line "$s" || fail "the changes job lacks the line '$s'"
done
# the heavy job: node from .node-version with the pnpm cache, pnpm, Rust, sccache, the three commands
for s in "node-version-file: .node-version" "cache: pnpm" "- run: pnpm install --frozen-lockfile" \
         "- run: bash tools/doctor.sh --ci" "- run: pnpm check" "if: needs.changes.outputs.code == 'true'"; do
  has_line "$s" || fail "the code job lacks the line '$s'"
done
for s in "actions/checkout@" "dorny/paths-filter@" "pnpm/action-setup@" "actions/setup-node@" \
         "dtolnay/rust-toolchain@" "mozilla-actions/sccache-action@"; do
  grep -q -F -- "uses: $s" "$tmp/wf" || fail "no 'uses: $s...' step"
done
# the light job and the summary job (the required context): always runs, needs all three
has_line "if: needs.changes.outputs.code != 'true'" || fail "the docs job lacks \"if: needs.changes.outputs.code != 'true'\""
has_line "needs: [changes, code, docs]" || fail "the check job lacks 'needs: [changes, code, docs]'"
has_line "if: always()" || fail "the check job lacks 'if: always()' (a skipped code job would skip the required context)"
# every uses: pinned to a full SHA with the tag as a trailing comment
nuses="$(grep -c 'uses:' "$tmp/wf")"
[ "$nuses" -ge 1 ] || fail "no 'uses:' step"
unpinned="$(grep 'uses:' "$tmp/wf" | grep -E -v '^ *(- )?uses: [A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+@[0-9a-f]{40} # .+$')"
[ -z "$unpinned" ] || fail "every 'uses:' must be 'owner/repo@<40-hex sha> # <tag>'; these are not:" "$unpinned"
# the CI subset of the doctor: exit 0, exactly the six rows, the header says so
out="$(bash "$ROOT/tools/doctor.sh" --ci 2>&1)"
rc=$?
[ "$rc" -eq 0 ] || fail "bash tools/doctor.sh --ci: expected exit 0, got $rc (the pinned tools must be on PATH)" "$out"
rows="$(printf '%s\n' "$out" | awk -F ' [|] ' 'NF >= 2 { name = $1; sub(/ +$/, "", name); print name " " $NF }' | sort)"
want_rows="$(printf '%s\n' "rustup ok" "rust ok" "node ok" "pnpm ok" "rust-toolchain.toml ok" ".node-version ok" | sort)"
[ "$rows" = "$want_rows" ] || fail "bash tools/doctor.sh --ci: expected exactly the six rows rustup, rust, node, pnpm, rust-toolchain.toml, .node-version, all ok" "$out"
printf '%s\n' "$out" | sed -n '1p' | grep -q -F '(ci subset: rustup, rust, node, pnpm)' \
  || fail "the --ci header line does not say '(ci subset: rustup, rust, node, pnpm)'" "$out"
[ "$(printf '%s\n' "$out" | tail -n 1)" = "doctor: 6 ok, 0 failed" ] \
  || fail "bash tools/doctor.sh --ci: last line is '$(printf '%s\n' "$out" | tail -n 1)', expected 'doctor: 6 ok, 0 failed'" "$out"
echo "# workflow: $(basename "$WF"): 4 jobs, $nuses pinned uses:, filter some-with-excludes; doctor --ci: 6 rows ok"
if command -v actionlint >/dev/null 2>&1; then  # report only
  if lint="$(actionlint "$WF" 2>&1)"; then
    echo "# actionlint: ok ($(actionlint -version 2>/dev/null | sed -n '1p'))"
  else
    echo "# actionlint: findings (report only):"
    printf '%s\n' "$lint" | sed 's/^/#   /'
  fi
else
  echo "# actionlint: not on PATH (brew install actionlint), skipped"
fi
echo "ok - workflow"

# ---- docs-only (AC1, the filter) --------------------------------------------------------------------------------
CASE=docs-only
need_gh
pr_of_branch "$DOCS_BRANCH"
[ "$PR_BASE" = "$CODE_BRANCH" ] || fail "PR #$PR_N (head $DOCS_BRANCH) is based on '$PR_BASE', expected $CODE_BRANCH"
latest_run "$DOCS_BRANCH"
run_jobs "$RUN_ID"
expect_jobs changes=success code=skipped docs=success check=success
echo "# docs-only: PR #$PR_N $DOCS_BRANCH -> $PR_BASE ($PR_STATE); run $RUN_ID @$RUN_SHA attempt $RUN_ATTEMPT $RUN_CONCLUSION: $(jobs_line); $RUN_URL"
echo "ok - docs-only"

# ---- pr-run (AC2) -----------------------------------------------------------------------------------------------
CASE=pr-run
need_gh
pr_of_branch "$CODE_BRANCH"
[ "$PR_BASE" = "$BRANCH" ] || fail "PR #$PR_N (head $CODE_BRANCH) is based on '$PR_BASE', expected $BRANCH"
latest_run "$CODE_BRANCH"
run_jobs "$RUN_ID"
expect_jobs changes=success code=success docs=skipped check=success
# a run URL of this PR is recorded in the card's ## Build (any of its runs: synchronize runs get new ids)
ids="$(printf '%s\n' "$RUNS" | cut -d ' ' -f 1)"
build_ids="$(sed -n '/^## Build$/,/^## Test$/p' "$CARD" | grep -o 'actions/runs/[0-9][0-9]*' | sed 's#actions/runs/##' | sort -u)"
[ -n "$build_ids" ] || fail "no actions/runs/<id> URL in the card's ## Build ($CARD)"
recorded=""
for id in $build_ids; do
  printf '%s\n' "$ids" | grep -q -x -- "$id" && recorded="$recorded $id"
done
[ -n "$recorded" ] \
  || fail "none of the run ids in ## Build ($(printf '%s' "$build_ids" | tr '\n' ' ')) is a pull_request run of $CODE_BRANCH ($(printf '%s' "$ids" | tr '\n' ' '))"
nruns="$(printf '%s\n' "$RUNS" | grep -c .)"
echo "# pr-run: PR #$PR_N $CODE_BRANCH -> $PR_BASE ($PR_STATE); latest of $nruns run(s): $RUN_ID @$RUN_SHA attempt $RUN_ATTEMPT $RUN_CONCLUSION: $(jobs_line); $RUN_URL"
echo "# pr-run: run id(s) of this PR recorded in ## Build:$recorded"
if [ "$SHIPPED" -eq 1 ]; then
  [ "$PR_MERGED" != "-" ] || fail "--shipped: PR #$PR_N is not merged (state $PR_STATE)"
  [ "$PR_MERGE_SHA" != "-" ] || fail "--shipped: PR #$PR_N has no merge commit"
  out="$(git_q fetch -q origin 2>&1)" || fail "--shipped: git fetch origin failed (network or credentials)" "$out"
  git_q merge-base --is-ancestor "$PR_MERGE_SHA" "origin/$BRANCH" \
    || fail "--shipped: the merge commit $PR_MERGE_SHA of PR #$PR_N is not an ancestor of origin/$BRANCH"
  echo "# pr-run: --shipped: PR #$PR_N merged at $PR_MERGED as $PR_MERGE_SHA, an ancestor of origin/$BRANCH"
fi
echo "ok - pr-run"

# ---- gates (AC3) ------------------------------------------------------------------------------------------------
CASE=gates
need_gh
nl="$(gate_list | grep -c .)"
[ "$nl" -eq 1 ] || fail "expected exactly one 'manualGates: [...]' line in $GCARD, found $nl"
list="$(gate_list)"
entries="$(gate_entries "$list")"
ne="$(printf '%s\n' "$entries" | grep -c .)"
[ "$ne" -eq 2 ] || fail "expected exactly 2 gates, found $ne: [$list]"
for want in "Actions enabled on GitHub" "branch protection on main"; do
  c="$(printf '%s\n' "$entries" | sed 's/^\[[ x]\] *//' | grep -c -x -F -- "$want")"
  [ "$c" -eq 1 ] || fail "'$want' is not an entry of the card's manualGates: [$list]"
done
nt="$(printf '%s\n' "$entries" | grep -c '^\[x\]')"
api "repos/$REPO/branches/$BRANCH/protection" \
    '.required_status_checks | if . == null then "none" else "strict=\(.strict) contexts=\(.contexts | tojson)" end' \
  || fail "GET repos/$REPO/branches/$BRANCH/protection failed ($STATUS; 404 would mean the rule was removed)" "$OUT"
rsc="$OUT"
if [ "$nt" -eq 0 ] && [ "$rsc" = none ]; then
  [ "$SHIPPED" -eq 0 ] \
    || fail "--shipped: both gates are unticked and $BRANCH requires no status check; expected [x] on both and contexts [\"check\"] with strict"
  echo "# gates: both unticked, required_status_checks none (before the ship of P0-02.3): [$list]"
elif [ "$nt" -eq 2 ] && [ "$rsc" = 'strict=true contexts=["check"]' ]; then
  echo "# gates: both ticked, required_status_checks $rsc (shipped): [$list]"
else
  fail "$nt of $ne gates ticked while required_status_checks is '$rsc'; allowed: none ticked with none, or both ticked with strict=true contexts=[\"check\"]: [$list]"
fi
echo "ok - gates"

# ---- docs (AC4) -------------------------------------------------------------------------------------------------
CASE=docs
[ -f "$DOCS" ] || fail "$DOCS does not exist"
nanchors=0
for s in ".github/workflows/check.yml" "required_status_checks" "strict" "$CODE_BRANCH" "gh pr create" \
         "gh pr merge --squash" "actions/runs/" "- [x] (c)" "tools/test/ci.test.sh"; do
  grep -q -F -- "$s" "$DOCS" || fail "'$s' is not in docs/ops/github.md"
  nanchors=$((nanchors + 1))
done
npins=0
for sha in $(grep -o '@[0-9a-f]\{40\}' "$tmp/wf" | tr -d '@' | sort -u); do
  grep -q -F -- "$sha" "$DOCS" || fail "the pin $sha of $(basename "$WF") is not in docs/ops/github.md (the pin table)"
  npins=$((npins + 1))
done
[ "$npins" -ge 1 ] || fail "no pinned SHA found in $WF to look up in the doc"
echo "# docs: $nanchors anchors, $npins pinned SHA(s) named"
echo "ok - docs"
exit 0
