#!/usr/bin/env bash
# Bridle workspace check (card P0-02.1): the one command the test, review and ship stations and CI run.
#
# Usage:
#   pnpm check             from the repository root (pnpm puts node_modules/.bin and node on PATH)
#   bash tools/check.sh    from any directory: the script cd's to the repository root; needs node, pnpm
#                          and cargo on PATH, at the pins of tools/toolchain.json (`bash tools/doctor.sh`)
#
# Runs, in this order and stopping at the first failure:
#   1 lint          pnpm lint        biome ci . : format, lint and import order, writes nothing
#   2 typecheck     pnpm typecheck   turbo run typecheck : tsc --noEmit per package
#   3 test          pnpm test        turbo run test : vitest run per package
#   4 cargo-fmt     cargo fmt --all --check
#   5 cargo-clippy  cargo clippy --workspace --all-targets -- -D warnings
#   6 cargo-test    cargo test --workspace
#   7 docs          bash tools/test/docs.test.sh  (README links, roadmap vs cards, progress board, decisions log; bash 3.2 and python3)
# Prints one line per step, `check: <n>/7 <name> ok <t>s` or `check: <n>/7 <name> FAILED (exit <code>)
# after <t>s` (and exits with that code), then a last line `check: 7/7 ok in <t>s`. Wall times have one
# decimal and come from node's clock (Date.now()), so besides the tools above the script needs only
# bash 3.2 and awk.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export DO_NOT_TRACK=1 # turbo: no telemetry and no first-run telemetry banner

STEPS=7

now_ms() { node -p 'Date.now()'; }

elapsed() { # $1 = start ms, $2 = end ms: prints seconds with one decimal
  awk -v s="$1" -v e="$2" 'BEGIN { printf "%.1f", (e - s) / 1000 }'
}

run_step() { # $1 = step number, $2 = step name, $3.. = the command; exits on failure
  local n="$1" name="$2" start end rc
  shift 2
  start="$(now_ms)"
  if "$@"; then rc=0; else rc=$?; fi
  end="$(now_ms)"
  if [ "$rc" -ne 0 ]; then
    echo "check: $n/$STEPS $name FAILED (exit $rc) after $(elapsed "$start" "$end")s"
    exit "$rc"
  fi
  echo "check: $n/$STEPS $name ok $(elapsed "$start" "$end")s"
}

CHECK_START="$(now_ms)"
run_step 1 lint pnpm lint
run_step 2 typecheck pnpm typecheck
run_step 3 test pnpm test
run_step 4 cargo-fmt cargo fmt --all --check
run_step 5 cargo-clippy cargo clippy --workspace --all-targets -- -D warnings
run_step 6 cargo-test cargo test --workspace
run_step 7 docs bash tools/test/docs.test.sh
echo "check: $STEPS/$STEPS ok in $(elapsed "$CHECK_START" "$(now_ms)")s"
