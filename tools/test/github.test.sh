#!/usr/bin/env bash
# Tests for card P0-06.3 (first push to GitHub and the GitHub checklist): one case per acceptance criterion, in
# the card's order, then a report-only case.
#   pushed        AC1  the current branch is `main`; `git ls-remote --heads origin main` is non-empty and equals
#                      the local HEAD; the upstream is `origin/main`; the first line of `git status -sb` is
#                      exactly `## main...origin/main` (no `[gone]`, `[ahead N]`, `[behind N]`)
#   docs          AC2  docs/ops/github.md exists, holds at least 6 checklist lines (`- [ ] ` / `- [x] `) and every
#                      anchor of the checklist (the remote, the push command, the Actions setting, the secrets
#                      doc, the branch protection values, the `check` context, the lane branch naming,
#                      `manualGates`); every gate name read from the card's `manualGates:` line sits on a
#                      checklist line marked `(user`
#   gates         AC3  the card's frontmatter `manualGates:` line is one line listing exactly the two gates
#                      `Actions enabled on GitHub` and `branch protection on main`; neither ticked (`[x]`) until
#                      P0-02.3 ships, both ticked after it, never one (tools/test/ci.test.sh checks the ticks
#                      against the branch protection)
#   github-state  --   report only, never fails: with gh logged in, `# ...` lines with the Actions permissions,
#                      the `main` branch protection (`none (404)`, its fields, or `unavailable (403: ...)` on a
#                      private repository of a free personal account), the rules that apply to `main`, the secret
#                      and variable counts, the default branch and the visibility; without gh,
#                      `# skipped (gh not logged in)`. P0-02.3 reads these lines before ticking the gates.
#
# Run:  bash tools/test/github.test.sh      (from any directory; the script finds the repository from its own path)
# Prints `ok - <case>` per case (and `# ...` comment lines); stops at the first failed assertion with
# `not ok - <case>: <why>` on stderr, exit 1. Needs bash 3.2, git, the network (`git ls-remote` on origin, which
# the credential helper must answer without a prompt: GIT_TERMINAL_PROMPT=0 turns a prompt into a failure), grep,
# sed, tr, cut, mktemp; gh only for the report case. Read-only: `git ls-remote`, `git status`, `git rev-parse`,
# `git remote get-url` and `gh api` GETs; nothing is written to GitHub or to the repository.
# Negative proof only (never for a normal run): GITHUB_TEST_DOCS=<file> and GITHUB_TEST_CARD=<file> point the
# docs and gates cases at a scratch copy, so an anchor or a gate can be removed without touching the real files.
set -u
set -o pipefail
export GIT_TERMINAL_PROMPT=0

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCS="${GITHUB_TEST_DOCS:-$ROOT/docs/ops/github.md}"
CARD="${GITHUB_TEST_CARD:-}"
BRANCH=main
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

if [ -z "$CARD" ]; then  # the card by its id: exactly one factory/cards/P0-06.3-*.md
  n=0
  for f in "$ROOT"/factory/cards/P0-06.3-*.md; do
    [ -f "$f" ] || continue
    CARD="$f"
    n=$((n + 1))
  done
  [ "$n" -eq 1 ] || fail "expected one card file factory/cards/P0-06.3-*.md, found $n"
fi
[ -f "$CARD" ] || fail "$CARD not found"
tmp="$(mktemp -d)" || fail "mktemp -d failed"
trap 'rm -rf "$tmp"' EXIT

# ---- helpers --------------------------------------------------------------------------------------------------

git_q() {  # every git call runs in the repository, whatever the current directory
  git -C "$ROOT" "$@"
}
first_line() {  # $1 = text: its first line
  printf '%s\n' "$1" | sed -n '1p'
}
gate_list() {  # the inside of the card's `manualGates: [...]` line(s), one output line per matching card line
  sed -n 's/^manualGates: *\[\(.*\)\]$/\1/p' "$CARD"
}
gate_entries() {  # $1 = one such list: its comma-separated entries, one per line, trimmed
  printf '%s\n' "$1" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep .
}

# ---- pushed (AC1) -----------------------------------------------------------------------------------------------
CASE=pushed
branch="$(git_q rev-parse --abbrev-ref HEAD 2>&1)" || fail "git rev-parse --abbrev-ref HEAD failed" "$branch"
[ "$branch" = "$BRANCH" ] || fail "run on $BRANCH (the current branch is '$branch')"
head_sha="$(git_q rev-parse HEAD 2>&1)" || fail "git rev-parse HEAD failed" "$head_sha"
status_out="$(git_q status -sb 2>&1)" || fail "git status -sb failed" "$status_out"
status_line="$(first_line "$status_out")"
remote_out="$(git_q ls-remote --heads origin "$BRANCH" 2>&1)" \
  || fail "git ls-remote --heads origin $BRANCH failed (network or credentials)" "$remote_out"
remote_sha="$(first_line "$remote_out" | cut -f1)"
[ -n "$remote_sha" ] \
  || fail "origin has no branch $BRANCH (git ls-remote --heads origin $BRANCH printed nothing): not pushed" "$status_line"
[ "$remote_sha" = "$head_sha" ] \
  || fail "origin/$BRANCH is $remote_sha, local HEAD is $head_sha (HEAD moved after the push? git push origin $BRANCH, then rerun)" \
          "$status_line"
upstream="$(git_q rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>&1)" \
  || fail "$BRANCH has no upstream (expected origin/$BRANCH)" "$upstream"
[ "$upstream" = "origin/$BRANCH" ] || fail "the upstream of $BRANCH is '$upstream', expected origin/$BRANCH"
[ "$status_line" = "## $BRANCH...origin/$BRANCH" ] \
  || fail "the first line of git status -sb is '$status_line', expected '## $BRANCH...origin/$BRANCH'"
echo "# pushed: origin/$BRANCH = HEAD = $head_sha; upstream $upstream; '$status_line'"
echo "ok - pushed"

# ---- docs (AC2) -------------------------------------------------------------------------------------------------
CASE=docs
[ -f "$DOCS" ] || fail "$DOCS does not exist"
nlines="$(grep -c '^- \[[ x]\] ' "$DOCS")"
[ "$nlines" -ge 6 ] || fail "expected at least 6 checklist lines (- [ ] / - [x]), found $nlines"
nanchors=0
for s in "stephenfgarcia/Bridle" "git push -u origin main" "Allow all actions and reusable workflows" \
         "docs/ops/secrets.md" "none" "AWS_OIDC_ROLE_ARN" "Require a pull request before merging" '`check`' \
         "P0-02.3" "Allow force pushes" "lane/<name>" "manualGates"; do
  grep -q -F -- "$s" "$DOCS" || fail "'$s' is not in docs/ops/github.md"
  nanchors=$((nanchors + 1))
done
list="$(gate_list)"
[ -n "$list" ] || fail "the card has no 'manualGates: [...]' line, so no gate name can be looked up in the doc"
entries="$(gate_entries "$list")"
ngates=0
while IFS= read -r e; do
  name="$(printf '%s\n' "$e" | sed 's/^\[[ x]\] *//')"  # a gate ticked at P0-02.3 keeps its name
  [ -n "$name" ] || continue
  m="$(grep '^- \[[ x]\] ' "$DOCS" | grep -F -- "$name" | grep -c -F '(user')"
  [ "$m" -ge 1 ] || fail "gate '$name' is not on a checklist line marked (user"
  ngates=$((ngates + 1))
done <<LIST
$entries
LIST
[ "$ngates" -gt 0 ] || fail "the card's manualGates line names no gate: [$list]"
echo "# docs: $nlines checklist lines, $nanchors anchors, $ngates gate(s) on (user lines"
echo "ok - docs"

# ---- gates (AC3) ------------------------------------------------------------------------------------------------
CASE=gates
nl="$(gate_list | grep -c .)"
[ "$nl" -eq 1 ] || fail "expected exactly one 'manualGates: [...]' line in the card, found $nl"
list="$(gate_list)"
entries="$(gate_entries "$list")"
ne="$(printf '%s\n' "$entries" | grep -c .)"
[ "$ne" -eq 2 ] || fail "expected exactly 2 gates, found $ne: [$list]"
nt="$(printf '%s\n' "$entries" | grep -c '^\[x\]')"  # P0-02.3 ticks both gates at its ship, never one
[ "$nt" -eq 0 ] || [ "$nt" -eq "$ne" ] \
  || fail "$nt of $ne gates ticked; the gates are ticked together at the ship of P0-02.3, never one: [$list]"
for want in "Actions enabled on GitHub" "branch protection on main"; do
  c="$(printf '%s\n' "$entries" | sed 's/^\[[ x]\] *//' | grep -c -x -F -- "$want")"  # a ticked gate keeps its name
  [ "$c" -eq 1 ] || fail "'$want' is not an entry of the card's manualGates: [$list]"
done
echo "# gates: $(printf '%s\n' "$entries" | sed -n '1p'); $(printf '%s\n' "$entries" | sed -n '2p') ($nt of $ne ticked)"
echo "ok - gates"

# ---- github-state (report only) -------------------------------------------------------------------------------
CASE=github-state
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
repo="$(git_q remote get-url origin 2>/dev/null | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##; s#/$##')"
if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
  echo "# skipped (gh not logged in)"
elif [ -z "$repo" ]; then
  echo "# skipped (origin is not a github.com remote)"
else
  echo "# repo: $repo (read with gh api, GET only, $(date -u +%Y-%m-%dT%H:%MZ))"
  if api "repos/$repo/actions/permissions" '"enabled=\(.enabled) allowed=\(.allowed_actions)"'; then
    echo "# actions: $OUT"
  else
    echo "# actions: unavailable ($STATUS)"
  fi
  if api "repos/$repo/branches/$BRANCH/protection" \
         '"pr=\(.required_pull_request_reviews != null) force=\(.allow_force_pushes.enabled) deletions=\(.allow_deletions.enabled) admins=\(.enforce_admins.enabled) checks=\(.required_status_checks.contexts // [] | tojson)"'; then
    echo "# protection($BRANCH): $OUT"
  else
    case "$STATUS" in
      404) echo "# protection($BRANCH): none (404)" ;;
      403) echo "# protection($BRANCH): unavailable (403: GitHub Pro or public repository required)" ;;
      *)   echo "# protection($BRANCH): unavailable ($STATUS)" ;;
    esac
  fi
  if api "repos/$repo/rules/branches/$BRANCH" 'length'; then
    echo "# rulesets($BRANCH): $OUT"
  else
    echo "# rulesets($BRANCH): unavailable ($STATUS)"
  fi
  if api "repos/$repo/actions/secrets" '.total_count'; then secrets="$OUT"; else secrets="unavailable ($STATUS)"; fi
  if api "repos/$repo/actions/variables" '.total_count'; then variables="$OUT"; else variables="unavailable ($STATUS)"; fi
  echo "# secrets=$secrets variables=$variables"
  if api "repos/$repo" '"default_branch=\(.default_branch) visibility=\(.visibility)"'; then
    echo "# $OUT"
  else
    echo "# default_branch=unavailable visibility=unavailable ($STATUS)"
  fi
fi
echo "ok - github-state"
exit 0
