#!/usr/bin/env bash
# Tests for tools/doctor.sh (card P0-06.1): one case per acceptance criterion, in the card's order.
#   drift          AC1  a mirror file (rust-toolchain.toml, .node-version) that disagrees with tools/toolchain.json
#                       is a DRIFT row and exit 1; the faithful copy passes
#   installed      AC2  from `/`, the doctor exits 0 and every `tools` key of toolchain.json sits on exactly one
#                       ok row (the docker row is the `docker info` proof)
#   rows-and-time  AC3  rows = keys + 2; a bare PATH (/usr/bin:/bin) gives exit 1 with every absent tool on a
#                       MISSING row and named in the last line; the passing run takes under 5 s
#   docs           AC4  docs/ops/toolchain.md names every `tools` key and every install command
#
# Run:  bash tools/test/doctor.test.sh      (from any directory; the script finds the repository from its own path)
# Prints `ok - <case>` per case (and `# ...` comment lines with measurements); stops at the first failed assertion
# with `not ok - <case>: <why>` and the doctor's output on stderr, exit 1. Needs bash 3.2, python3 (the doctor's
# own requirement), awk, grep, sed, tr, mktemp.
# The first three cases run the real doctor against the real PATH, so the pinned tools must be on it, as a new
# terminal sees them; from a shell that predates the installs run it through a clean login shell:
#   env -i HOME="$HOME" USER="$USER" TERM=xterm /bin/zsh -lc 'cd / && bash <repo>/tools/test/doctor.test.sh'
# Fixtures live in `mktemp -d` and are removed on exit; nothing is written inside the repository.
set -u
set -o pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCTOR="$ROOT/tools/doctor.sh"
PINS="$ROOT/tools/toolchain.json"
DOCS="$ROOT/docs/ops/toolchain.md"
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

[ -f "$DOCTOR" ] || fail "$DOCTOR not found"
[ -f "$PINS" ] || fail "$PINS not found"
tmp="$(mktemp -d)" || fail "mktemp -d failed"
trap 'rm -rf "$tmp"' EXIT

# ---- helpers --------------------------------------------------------------------------------------------------

# The `tools` keys of toolchain.json, one per line: the doctor's row names (a key starting with `$` is an
# annotation without a row, as in the doctor).
KEYS="$(python3 -c 'import json, sys
tools = json.load(open(sys.argv[1], encoding="utf-8"))["tools"]
print("\n".join(k for k in tools if not k.startswith("$")))' "$PINS")" || fail "cannot read the tools keys of $PINS"
NKEYS="$(printf '%s\n' "$KEYS" | grep -c .)"
[ "$NKEYS" -gt 0 ] || fail "no tools keys in $PINS"

pin() {  # $1 = tools key, $2 = field: prints tools.<key>.<field> from toolchain.json
  python3 -c 'import json, sys
print(json.load(open(sys.argv[1], encoding="utf-8"))["tools"][sys.argv[2]][sys.argv[3]])' "$PINS" "$1" "$2"
}
RUST_CHANNEL="$(pin rust channel)" || fail "cannot read tools.rust.channel"
NODE_MAJOR="$(pin node major)" || fail "cannot read tools.node.major"
PW_VERSION="$(pin playwright version)" || fail "cannot read tools.playwright.version"

rows() {  # $1 = doctor output: prints "<name> <status>" per row. A row is a line holding " | "; the status is
          # the text after the last " | " (`have` never contains " | "); the name is padded, so trim it.
  printf '%s\n' "$1" | awk -F ' [|] ' 'NF >= 2 { name = $1; sub(/ +$/, "", name); print name " " $NF }'
}
count_rows() {  # $1 = doctor output, $2 = row name: how many rows carry that name
  rows "$1" | awk -v n="$2" '$1 == n' | grep -c .
}
status_of() {  # $1 = doctor output, $2 = row name: that row's status (empty when there is no such row)
  rows "$1" | awk -v n="$2" '$1 == n { sub(/^[^ ]+ /, ""); print; exit }'
}
last_line() {  # $1 = doctor output: its last line (`doctor: N ok, M failed[: names]`)
  printf '%s\n' "$1" | tail -n 1
}
failed_names() {  # $1 = doctor output: the names the last line lists after `failed:`, one per line
  last_line "$1" | sed -n 's/^doctor: [0-9]* ok, [0-9]* failed: //p' | tr ',' '\n' | sed 's/^ *//; s/ *$//'
}
run_doctor() {  # $@ = doctor arguments; sets OUT (stdout+stderr) and RC
  OUT="$(bash "$DOCTOR" "$@" 2>&1)"
  RC=$?
}

# ---- drift (AC1) ------------------------------------------------------------------------------------------------
CASE=drift
FIX="$tmp/root"  # a copy of the three pin files in the repository's layout, read with --root
copy_pins() {
  rm -rf "$FIX" && mkdir -p "$FIX/tools" \
    && cp "$PINS" "$FIX/tools/toolchain.json" \
    && cp "$ROOT/rust-toolchain.toml" "$ROOT/.node-version" "$FIX/" \
    || fail "cannot copy the pin files into $FIX"
}

# rust-toolchain.toml with channel = "0.0.0": the rust-toolchain.toml row is DRIFT channel ..., exit 1
copy_pins
sed 's/^channel = .*/channel = "0.0.0"/' "$ROOT/rust-toolchain.toml" > "$FIX/rust-toolchain.toml" || fail "sed failed"
grep -q '^channel = "0.0.0"$' "$FIX/rust-toolchain.toml" || fail "fixture: the channel line was not rewritten"
run_doctor --root "$FIX"
[ "$RC" -eq 1 ] || fail "channel 0.0.0: expected exit 1, got $RC" "$OUT"
st="$(status_of "$OUT" rust-toolchain.toml)"
[ "$st" = "DRIFT channel want $RUST_CHANNEL have 0.0.0" ] \
  || fail "channel 0.0.0: rust-toolchain.toml row: expected 'DRIFT channel want $RUST_CHANNEL have 0.0.0', got '$st'" "$OUT"
[ "$(status_of "$OUT" .node-version)" = ok ] || fail "channel 0.0.0: the untouched .node-version row is not ok" "$OUT"
failed_names "$OUT" | grep -q -x -F -- rust-toolchain.toml \
  || fail "channel 0.0.0: the last line does not name rust-toolchain.toml" "$OUT"

# .node-version = 20: the .node-version row is DRIFT major ..., exit 1
copy_pins
printf '20\n' > "$FIX/.node-version" || fail "cannot write the .node-version fixture"
run_doctor --root "$FIX"
[ "$RC" -eq 1 ] || fail ".node-version 20: expected exit 1, got $RC" "$OUT"
st="$(status_of "$OUT" .node-version)"
[ "$st" = "DRIFT major want $NODE_MAJOR have 20" ] \
  || fail ".node-version 20: .node-version row: expected 'DRIFT major want $NODE_MAJOR have 20', got '$st'" "$OUT"
[ "$(status_of "$OUT" rust-toolchain.toml)" = ok ] \
  || fail ".node-version 20: the untouched rust-toolchain.toml row is not ok" "$OUT"
failed_names "$OUT" | grep -q -x -F -- .node-version \
  || fail ".node-version 20: the last line does not name .node-version" "$OUT"

# the unmodified copy: both mirror rows ok, exit 0
copy_pins
run_doctor --root "$FIX"
[ "$RC" -eq 0 ] \
  || fail "unmodified copy: expected exit 0, got $RC (the pinned tools must be on PATH; see the header)" "$OUT"
[ "$(status_of "$OUT" rust-toolchain.toml)" = ok ] && [ "$(status_of "$OUT" .node-version)" = ok ] \
  || fail "unmodified copy: the mirror rows are not both ok" "$OUT"
echo "ok - drift"

# ---- installed (AC2) --------------------------------------------------------------------------------------------
CASE=installed
# `cd / && bash <abs>/tools/doctor.sh`, with time.time() around subprocess.run (the wall time is for AC3)
timing="$(python3 -c '
import subprocess, sys, time
doctor, out = sys.argv[1], sys.argv[2]
t0 = time.time()
with open(out, "wb") as f:
    rc = subprocess.run(["bash", doctor], cwd="/", stdin=subprocess.DEVNULL, stdout=f, stderr=subprocess.STDOUT).returncode
print("%.2f %d" % (time.time() - t0, rc))' "$DOCTOR" "$tmp/installed.out")" || fail "python3 could not run the doctor"
ELAPSED="${timing% *}"
RC="${timing#* }"
OUT="$(cat "$tmp/installed.out")"
[ "$RC" -eq 0 ] \
  || fail "cd / && bash tools/doctor.sh: expected exit 0, got $RC (the pinned tools must be on PATH; see the header)" "$OUT"
for key in $KEYS; do
  n="$(count_rows "$OUT" "$key")"
  [ "$n" -eq 1 ] || fail "tool '$key': expected exactly one row, found $n" "$OUT"
  st="$(status_of "$OUT" "$key")"
  [ "$st" = ok ] || fail "tool '$key': expected ok, got '$st'" "$OUT"
done
echo "ok - installed"

# ---- rows-and-time (AC3) ----------------------------------------------------------------------------------------
CASE=rows-and-time
want_rows=$((NKEYS + 2))
have_rows="$(rows "$OUT" | grep -c .)"
[ "$have_rows" -eq "$want_rows" ] \
  || fail "expected $want_rows rows ($NKEYS tools + 2 mirror files), found $have_rows" "$OUT"
[ "$(count_rows "$OUT" rust-toolchain.toml)" -eq 1 ] && [ "$(count_rows "$OUT" .node-version)" -eq 1 ] \
  || fail "expected one rust-toolchain.toml row and one .node-version row" "$OUT"
[ "$(last_line "$OUT")" = "doctor: $want_rows ok, 0 failed" ] \
  || fail "last line: expected 'doctor: $want_rows ok, 0 failed', got '$(last_line "$OUT")'" "$OUT"
awk -v t="$ELAPSED" 'BEGIN { exit !(t + 0 < 5) }' || fail "the passing run took $ELAPSED s, limit 5 s" "$OUT"
echo "# passing run from /: $have_rows rows in $ELAPSED s"

# A bare PATH: every tool whose binary is not under /usr/bin or /bin must be a MISSING row and named in the
# last line (the binary per key is the first one the doctor's probe runs).
BARE=/usr/bin:/bin
absent=""
for key in $KEYS; do
  case "$key" in
    rust) bin=rustup ;; wasm-bindgen-cli) bin=wasm-bindgen ;; binaryen) bin=wasm-opt ;; opentofu) bin=tofu ;;
    awscli) bin=aws ;; playwright) bin=npx ;; *) bin="$key" ;;
  esac
  (PATH="$BARE"; export PATH; hash -r; command -v "$bin" >/dev/null 2>&1) || absent="$absent $key"
done
[ -n "$absent" ] || fail "every tool is under $BARE; nothing can be MISSING"
OUT="$(PATH="$BARE" bash "$DOCTOR" 2>&1)"
RC=$?
[ "$RC" -eq 1 ] || fail "PATH=$BARE: expected exit 1, got $RC" "$OUT"
for key in $absent; do
  st="$(status_of "$OUT" "$key")"
  [ "$st" = MISSING ] || fail "PATH=$BARE: tool '$key': expected MISSING, got '$st'" "$OUT"
  failed_names "$OUT" | grep -q -x -F -- "$key" || fail "PATH=$BARE: the last line does not name '$key'" "$OUT"
done
echo "# PATH=$BARE: exit 1; MISSING and named in the last line:$absent"
echo "ok - rows-and-time"

# ---- docs (AC4) -------------------------------------------------------------------------------------------------
CASE=docs
[ -f "$DOCS" ] || fail "$DOCS does not exist"
for key in $KEYS; do
  grep -q -F -- "$key" "$DOCS" || fail "tool '$key' is not named in docs/ops/toolchain.md"
done
for s in "sh.rustup.rs" "cargo install wasm-bindgen-cli" "brew install" "orbstack" "nvm install $NODE_MAJOR" \
         "corepack" "npx playwright@$PW_VERSION install chromium" "doctor.sh"; do
  grep -q -F -- "$s" "$DOCS" || fail "'$s' is not in docs/ops/toolchain.md"
done
echo "ok - docs"
exit 0
