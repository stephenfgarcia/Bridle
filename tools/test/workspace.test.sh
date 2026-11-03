#!/usr/bin/env bash
# Tests for the workspace skeleton (card P0-02.1): one case per acceptance criterion, in the plan's order
# (fresh-clone runs before check because the fail-fast proof needs the installed copy).
#   root-files               AC1  the root files exist; package.json pins packageManager pnpm@<pnpm.version> and
#                                 engines.node <node.major> of tools/toolchain.json, has the five scripts (check,
#                                 test, lint, typecheck, fmt), a lint script naming biome or eslint, and turbo
#                                 >= 2.11.10 (pinned and installed); turbo.json has tasks build, typecheck, test,
#                                 lint with ^build in dependsOn; `turbo run typecheck test --dry=json` exits 0;
#                                 `cargo metadata --locked` exits 0 and bridle-canon has rust_version =
#                                 rust.channel, edition 2021, manifest crates/bridle-canon/Cargo.toml; Cargo.toml
#                                 has members crates/*, resolver 2, [workspace.package] edition 2021 and
#                                 rust-version, [workspace.lints.clippy] all = warn (tools/check.sh runs clippy
#                                 with -D warnings); .gitattributes has eol=lf, .editorconfig end_of_line = lf
#   hello-crate-and-package  AC2  `cargo test -p bridle-canon` exits 0 with `test result: ok. 1 passed`;
#                                 `pnpm --filter @bridle/units test` exits 0 with vitest's `Test Files  1 passed`;
#                                 `pnpm ls -r --depth -1 --json` lists @bridle/units at packages/units; lib.rs
#                                 has `pub fn canon_version(` right under a /// line, a #[test] and "canon/1";
#                                 the crate is named bridle-canon; tsconfig.base.json is strict and the package
#                                 extends it, with vitest as its test runner; docs/architecture/architecture.md
#                                 section 16 names crates/bridle-canon/ and packages/units/
#   fresh-clone              AC4  a copy of `git ls-files --cached --others --exclude-standard` (what a clone holds
#                                 once the card is committed) has pnpm-lock.yaml and Cargo.lock and no
#                                 node_modules, target or .turbo directory; there `pnpm install --frozen-lockfile`
#                                 exits 0 without rewriting pnpm-lock.yaml or pnpm-workspace.yaml and leaves
#                                 node_modules/.bin/turbo; `bash tools/doctor.sh` from the repository root exits 0
#                                 with `doctor: <tools keys + 2> ok, 0 failed`
#   check                    AC3  `pnpm check` from the root exits 0, prints the six `check: n/6 <name> ok <t>s`
#                                 lines in the order lint, typecheck, test, cargo-fmt, cargo-clippy, cargo-test,
#                                 then `check: 6/6 ok in <t>s`, in under 180 s on this test's clock, and leaves
#                                 `git status --porcelain` unchanged; in the installed copy a format error in
#                                 packages/units/src/index.ts stops it at `check: 1/6 lint FAILED (exit <code>)`
#                                 with a non-zero exit and no 2/6 line, and an unformatted line appended to
#                                 crates/bridle-canon/src/lib.rs stops it at `check: 4/6 cargo-fmt FAILED` after
#                                 1/6 to 3/6 ok with no 5/6 line; with both files restored (cmp-identical to the
#                                 repository's) the copy's `pnpm check` exits 0 again
#
# Run:  bash tools/test/workspace.test.sh      (from any directory; the script finds the repository from its own path)
# In a shell that predates the toolchain (this harness: node 24, no pnpm or cargo on PATH):
#   . "$HOME/.cargo/env"; . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null; bash tools/test/workspace.test.sh
# Never wire this file into `pnpm test`: `pnpm check` runs `pnpm test`, and this test runs `pnpm check`.
# Prints `ok - <case>` per case (and `# ...` comment lines with the measured lines); stops at the first failed
# assertion with `not ok - <case>: <why>` and the command's output on stderr, exit 1. Needs bash 3.2, node, pnpm
# and cargo at the pins of tools/toolchain.json, python3, git, tar, awk, grep, sed, cmp, mktemp, date.
# The copy lives in `mktemp -d` and is removed on exit; fixtures are edited only there. Inside the repository the
# test writes nothing of its own; `pnpm check` from the root writes to its gitignored caches (.turbo/, target/),
# as it always does. Takes about 15 s (four `pnpm check` runs, one of them a cold cargo build in the copy).
set -u
set -o pipefail
export DO_NOT_TRACK=1 # turbo: no telemetry and no first-run banner (tools/check.sh exports it as well)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PINS="$ROOT/tools/toolchain.json"
ARCH="$ROOT/docs/architecture/architecture.md"
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

[ -f "$PINS" ] || fail "$PINS not found"
for t in node pnpm cargo python3 git tar awk cmp; do
  command -v "$t" >/dev/null 2>&1 || fail "$t is not on PATH (the pinned tools must be on PATH; see the header)"
done
tmp="$(mktemp -d)" || fail "mktemp -d failed"
trap 'rm -rf "$tmp"' EXIT

# ---- helpers --------------------------------------------------------------------------------------------------

pin() {  # $1 = tools key, $2 = field: prints tools.<key>.<field> from toolchain.json
  python3 -c 'import json, sys
print(json.load(open(sys.argv[1], encoding="utf-8"))["tools"][sys.argv[2]][sys.argv[3]])' "$PINS" "$1" "$2"
}
PNPM_VERSION="$(pin pnpm version)" || fail "cannot read tools.pnpm.version"
NODE_MAJOR="$(pin node major)" || fail "cannot read tools.node.major"
RUST_CHANNEL="$(pin rust channel)" || fail "cannot read tools.rust.channel"
NKEYS="$(python3 -c 'import json, sys
tools = json.load(open(sys.argv[1], encoding="utf-8"))["tools"]
print(len([k for k in tools if not k.startswith("$")]))' "$PINS")" || fail "cannot count the tools keys of $PINS"

semver_ge() {  # $1 >= $2 for dotted numeric versions (a leading ^, ~, = or v on either side is ignored)
  node -e '
const parse = (v) => v.replace(/^[\^~=v]+/, "").split(".").map((n) => Number(n) || 0);
const [a, b] = [parse(process.argv[1]), parse(process.argv[2])];
for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) process.exit((a[i] || 0) > (b[i] || 0) ? 0 : 1);
process.exit(0);' "$1" "$2"
}
run_in() {  # $1 = directory, $2.. = command: runs it there; sets OUT (stdout+stderr) and RC
  local dir="$1"
  shift
  OUT="$(cd "$dir" && "$@" 2>&1)"
  RC=$?
}
run_to() {  # $1 = directory, $2 = file, $3.. = command: runs it there, stdout to the file; sets OUT (stderr), RC
  local dir="$1" file="$2"
  shift 2
  OUT="$(cd "$dir" && "$@" 2>&1 >"$file")"
  RC=$?
}
steps_of() {  # $1 = check output: its step lines as "<n>/6 <name> <ok|FAILED>|..." in order (the summary line
              # `check: 6/6 ok in <t>s` is not a step line)
  printf '%s\n' "$1" | awk '/^check: [0-9]+\/[0-9]+ [a-z-]+ (ok|FAILED)/ { printf "%s %s %s|", $2, $3, $4 }'
}
check_lines() {  # $1 = check output: every `check:` line
  printf '%s\n' "$1" | grep '^check: '
}
last_check_line() {  # $1 = check output: its last `check:` line
  check_lines "$1" | tail -n 1
}

# ---- root-files (AC1) -------------------------------------------------------------------------------------------
CASE=root-files
for f in package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json biome.json tsconfig.base.json Cargo.toml \
         Cargo.lock rustfmt.toml .editorconfig .gitattributes tools/check.sh; do
  [ -f "$ROOT/$f" ] || fail "$f does not exist"
done
[ -x "$ROOT/tools/check.sh" ] || fail "tools/check.sh is not executable"

# package.json: packageManager, engines.node, the five scripts, the lint choice, turbo >= 2.11.10
OUT="$(node -e '
const fs = require("fs");
const [file, pnpmVersion, nodeMajor] = process.argv.slice(1);
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
const die = (m) => { console.log(m); process.exit(1); };
if (pkg.packageManager !== "pnpm@" + pnpmVersion)
  die(`packageManager is ${JSON.stringify(pkg.packageManager)}, want "pnpm@${pnpmVersion}" (tools.pnpm.version)`);
if (!pkg.engines || String(pkg.engines.node) !== String(nodeMajor))
  die(`engines.node is ${JSON.stringify(pkg.engines && pkg.engines.node)}, want "${nodeMajor}" (tools.node.major)`);
for (const s of ["check", "test", "lint", "typecheck", "fmt"])
  if (!pkg.scripts || typeof pkg.scripts[s] !== "string" || !pkg.scripts[s]) die(`scripts.${s} is missing`);
if (!/\bbiome\b/.test(pkg.scripts.lint) && !/\beslint\b/.test(pkg.scripts.lint))
  die(`scripts.lint is "${pkg.scripts.lint}": it names neither biome nor eslint`);
const dev = pkg.devDependencies || {};
if (typeof dev.turbo !== "string") die("devDependencies.turbo is missing");
console.log(dev.turbo);' "$ROOT/package.json" "$PNPM_VERSION" "$NODE_MAJOR")" || fail "package.json: $OUT"
TURBO_DEP="$OUT"
semver_ge "$TURBO_DEP" 2.11.10 || fail "package.json: devDependencies.turbo is $TURBO_DEP, want >= 2.11.10"
run_in "$ROOT" pnpm exec turbo --version
[ "$RC" -eq 0 ] || fail "pnpm exec turbo --version: exit $RC" "$OUT"
TURBO_BIN="$(printf '%s\n' "$OUT" | tail -n 1)"
semver_ge "$TURBO_BIN" 2.11.10 || fail "the installed turbo is $TURBO_BIN, want >= 2.11.10" "$OUT"

for s in 'apps/*' 'packages/*'; do
  grep -q -F -- "$s" "$ROOT/pnpm-workspace.yaml" || fail "pnpm-workspace.yaml does not list $s"
done

# turbo.json: the four tasks, ^build in dependsOn; the dry run reads the lockfile and the task graph
OUT="$(python3 -c '
import json, sys
tasks = json.load(open(sys.argv[1], encoding="utf-8")).get("tasks", {})
for t in ("build", "typecheck", "test", "lint"):
    if t not in tasks:
        sys.exit("tasks.%s is missing" % t)
for t in ("build", "typecheck", "test"):
    if "^build" not in tasks[t].get("dependsOn", []):
        sys.exit("tasks.%s.dependsOn does not hold ^build: %r" % (t, tasks[t].get("dependsOn")))
' "$ROOT/turbo.json" 2>&1)" || fail "turbo.json: $OUT"
run_in "$ROOT" pnpm exec turbo run typecheck test --dry=json
[ "$RC" -eq 0 ] || fail "pnpm exec turbo run typecheck test --dry=json: exit $RC" "$OUT"

# Cargo workspace: metadata with the committed lockfile; the hello crate inherits the workspace package fields
run_to "$ROOT" "$tmp/metadata.json" cargo metadata --locked --format-version 1
[ "$RC" -eq 0 ] || fail "cargo metadata --locked --format-version 1: exit $RC" "$OUT"
OUT="$(python3 -c '
import json, os, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
root, channel = sys.argv[2], sys.argv[3]
pkgs = [p for p in m["packages"] if p["name"] == "bridle-canon"]
if len(pkgs) != 1:
    sys.exit("expected one package bridle-canon, found %d" % len(pkgs))
p = pkgs[0]
if p.get("rust_version") != channel:
    sys.exit("bridle-canon rust_version is %r, want %r (tools.rust.channel)" % (p.get("rust_version"), channel))
if p.get("edition") != "2021":
    sys.exit("bridle-canon edition is %r, want 2021" % p.get("edition"))
want = os.path.join(root, "crates", "bridle-canon", "Cargo.toml")
if os.path.realpath(p["manifest_path"]) != os.path.realpath(want):
    sys.exit("bridle-canon manifest is %r, want %r" % (p["manifest_path"], want))
if os.path.realpath(m["workspace_root"]) != os.path.realpath(root):
    sys.exit("workspace_root is %r, want %r" % (m["workspace_root"], root))
' "$tmp/metadata.json" "$ROOT" "$RUST_CHANNEL" 2>&1)" || fail "cargo metadata: $OUT"
for s in 'members = ["crates/*"]' 'resolver = "2"' '[workspace.package]' 'edition = "2021"' \
         "rust-version = \"$RUST_CHANNEL\"" '[workspace.lints.clippy]' 'all = { level = "warn"'; do
  grep -q -F -- "$s" "$ROOT/Cargo.toml" || fail "'$s' is not in Cargo.toml"
done
grep -q -F -- 'cargo clippy --workspace --all-targets -- -D warnings' "$ROOT/tools/check.sh" \
  || fail "tools/check.sh does not run 'cargo clippy --workspace --all-targets -- -D warnings' (clippy::all as errors)"
grep -q -F -- 'eol=lf' "$ROOT/.gitattributes" || fail "'eol=lf' is not in .gitattributes"
grep -q -F -- 'end_of_line = lf' "$ROOT/.editorconfig" || fail "'end_of_line = lf' is not in .editorconfig"
echo "# turbo $TURBO_DEP pinned, $TURBO_BIN installed; bridle-canon rust-version $RUST_CHANNEL, edition 2021"
echo "ok - root-files"

# ---- hello-crate-and-package (AC2) ------------------------------------------------------------------------------
CASE=hello-crate-and-package
run_in "$ROOT" cargo test -p bridle-canon
[ "$RC" -eq 0 ] || fail "cargo test -p bridle-canon: exit $RC" "$OUT"
n="$(printf '%s\n' "$OUT" | grep -c '^test result: ok\. 1 passed; 0 failed')"
[ "$n" -ge 1 ] || fail "cargo test -p bridle-canon: no 'test result: ok. 1 passed; 0 failed' line" "$OUT"
printf '%s\n' "$OUT" | grep -q 'FAILED' && fail "cargo test -p bridle-canon: a FAILED line" "$OUT"
CARGO_RESULT="$(printf '%s\n' "$OUT" | grep '^test result: ' | head -n 1)"

run_in "$ROOT" pnpm --filter @bridle/units test
[ "$RC" -eq 0 ] || fail "pnpm --filter @bridle/units test: exit $RC" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^ *Test Files +1 passed \(1\)$' \
  || fail "pnpm --filter @bridle/units test: no 'Test Files  1 passed (1)' line" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^ *Tests +[1-9][0-9]* passed \([0-9]+\)$' \
  || fail "pnpm --filter @bridle/units test: no 'Tests  N passed (N)' line (a failing test changes it)" "$OUT"
VITEST_RESULT="$(printf '%s\n' "$OUT" | grep -E '^ *(Test Files|Tests) +' | sed 's/^ *//' | tr '\n' ';' | sed 's/;$//')"

run_to "$ROOT" "$tmp/ls.json" pnpm ls -r --depth -1 --json
[ "$RC" -eq 0 ] || fail "pnpm ls -r --depth -1 --json: exit $RC" "$OUT"
OUT="$(python3 -c '
import json, os, sys
entries = json.load(open(sys.argv[1], encoding="utf-8"))
want = os.path.realpath(os.path.join(sys.argv[2], "packages", "units"))
hits = [e for e in entries if e.get("name") == "@bridle/units"]
if len(hits) != 1:
    sys.exit("expected one workspace package named @bridle/units, found %d in %r" % (len(hits), [e.get("name") for e in entries]))
if os.path.realpath(hits[0]["path"]) != want:
    sys.exit("@bridle/units is at %r, want %r" % (hits[0]["path"], want))
' "$tmp/ls.json" "$ROOT" 2>&1)" || fail "pnpm ls: $OUT"

LIB="$ROOT/crates/bridle-canon/src/lib.rs"
[ -f "$LIB" ] || fail "crates/bridle-canon/src/lib.rs does not exist"
awk 'prev ~ /^[[:space:]]*\/\/\// && /^pub fn canon_version\(/ { found = 1 } { prev = $0 } END { exit !found }' "$LIB" \
  || fail "lib.rs: no 'pub fn canon_version(' right under a /// doc comment line"
grep -q -F -- '#[test]' "$LIB" || fail "lib.rs: no #[test]"
grep -q -F -- '"canon/1"' "$LIB" || fail "lib.rs: \"canon/1\" is not in it"
grep -q -E '^name = "bridle-canon"$' "$ROOT/crates/bridle-canon/Cargo.toml" \
  || fail "crates/bridle-canon/Cargo.toml: name is not bridle-canon"

OUT="$(python3 -c '
import json, sys
base = json.load(open(sys.argv[1], encoding="utf-8"))
pkg_ts = json.load(open(sys.argv[2], encoding="utf-8"))
pkg = json.load(open(sys.argv[3], encoding="utf-8"))
if base.get("compilerOptions", {}).get("strict") is not True:
    sys.exit("tsconfig.base.json: compilerOptions.strict is not true")
if pkg_ts.get("extends") != "../../tsconfig.base.json":
    sys.exit("packages/units/tsconfig.json does not extend ../../tsconfig.base.json: %r" % pkg_ts.get("extends"))
if pkg.get("name") != "@bridle/units":
    sys.exit("packages/units/package.json: name is %r, want @bridle/units" % pkg.get("name"))
dev = pkg.get("devDependencies", {})
for d in ("typescript", "vitest"):
    if d not in dev:
        sys.exit("packages/units/package.json: devDependencies.%s is missing" % d)
if "vitest" not in pkg.get("scripts", {}).get("test", ""):
    sys.exit("packages/units/package.json: scripts.test does not run vitest: %r" % pkg.get("scripts", {}).get("test"))
' "$ROOT/tsconfig.base.json" "$ROOT/packages/units/tsconfig.json" "$ROOT/packages/units/package.json" 2>&1)" \
  || fail "$OUT"
[ -f "$ROOT/packages/units/src/index.ts" ] && [ -f "$ROOT/packages/units/src/index.test.ts" ] \
  || fail "packages/units/src/index.ts or packages/units/src/index.test.ts does not exist"

[ -f "$ARCH" ] || fail "$ARCH does not exist"
awk '/^## 16 /{ on = 1; next } /^## /{ on = 0 } on' "$ARCH" > "$tmp/section16.md"
[ -s "$tmp/section16.md" ] || fail "architecture.md has no '## 16' section"
for s in crates/bridle-canon/ packages/units/; do
  grep -q -F -- "$s" "$tmp/section16.md" || fail "architecture.md section 16 does not name $s"
done
echo "# cargo test -p bridle-canon: $CARGO_RESULT"
echo "# pnpm --filter @bridle/units test: $VITEST_RESULT"
echo "ok - hello-crate-and-package"

# ---- fresh-clone (AC4) ------------------------------------------------------------------------------------------
CASE=fresh-clone
if git -C "$ROOT" ls-files --error-unmatch pnpm-lock.yaml >/dev/null 2>&1; then
  LOCK_STATE="tracked"
else
  LOCK_STATE="untracked, not ignored (the ship station commits it)"
fi
COPY="$tmp/clone"
mkdir -p "$COPY" || fail "cannot create $COPY"
# Exactly the files a `git clone` holds once this card is committed: tracked plus untracked-not-ignored.
(cd "$ROOT" && git ls-files -z --cached --others --exclude-standard | tar --null -T - -cf - | tar -C "$COPY" -xf -) \
  || fail "copying the tracked and untracked-not-ignored files into $COPY failed"
NFILES="$(find "$COPY" -type f | grep -c .)"
[ "$NFILES" -gt 0 ] || fail "the copy is empty"
[ -f "$COPY/pnpm-lock.yaml" ] || fail "the copy has no pnpm-lock.yaml (is it ignored?)"
[ -f "$COPY/Cargo.lock" ] || fail "the copy has no Cargo.lock (is it ignored?)"
stray="$(find "$COPY" -type d \( -name node_modules -o -name target -o -name .turbo \) | sed "s|^$COPY/||")"
[ -z "$stray" ] || fail "the copy holds build output a clone would not (not ignored?):" "$stray"
t0="$(date +%s)"
run_in "$COPY" pnpm install --frozen-lockfile
t1="$(date +%s)"
[ "$RC" -eq 0 ] || fail "pnpm install --frozen-lockfile in the copy: exit $RC" "$OUT"
INSTALL_OUT="$OUT"
[ -x "$COPY/node_modules/.bin/turbo" ] || fail "the copy has no node_modules/.bin/turbo after the install" "$OUT"
cmp -s "$ROOT/pnpm-lock.yaml" "$COPY/pnpm-lock.yaml" \
  || fail "pnpm install --frozen-lockfile rewrote pnpm-lock.yaml in the copy" "$INSTALL_OUT"
cmp -s "$ROOT/pnpm-workspace.yaml" "$COPY/pnpm-workspace.yaml" \
  || fail "pnpm install --frozen-lockfile rewrote pnpm-workspace.yaml in the copy" "$INSTALL_OUT"
done_line="$(printf '%s\n' "$INSTALL_OUT" | grep -E '^Done in' | tail -n 1)"
echo "# fresh copy: $NFILES files, no node_modules/target/.turbo, pnpm-lock.yaml $LOCK_STATE;" \
     "pnpm install --frozen-lockfile exit 0 in $((t1 - t0)) s${done_line:+ ($done_line)}"

run_in "$ROOT" bash tools/doctor.sh
[ "$RC" -eq 0 ] || fail "bash tools/doctor.sh from the repository root: exit $RC" "$OUT"
want="doctor: $((NKEYS + 2)) ok, 0 failed"
last="$(printf '%s\n' "$OUT" | tail -n 1)"
[ "$last" = "$want" ] || fail "doctor's last line: expected '$want', got '$last'" "$OUT"
echo "# bash tools/doctor.sh: $last"
echo "ok - fresh-clone"

# ---- check (AC3) ------------------------------------------------------------------------------------------------
CASE=check
WANT_PASS="1/6 lint ok|2/6 typecheck ok|3/6 test ok|4/6 cargo-fmt ok|5/6 cargo-clippy ok|6/6 cargo-test ok|"
STATUS_BEFORE="$(git -C "$ROOT" status --porcelain)"
t0="$(date +%s)"
run_in "$ROOT" pnpm check
t1="$(date +%s)"
ELAPSED=$((t1 - t0))
[ "$RC" -eq 0 ] || fail "pnpm check from the root: exit $RC" "$OUT"
have="$(steps_of "$OUT")"
[ "$have" = "$WANT_PASS" ] || fail "pnpm check: step lines: expected '$WANT_PASS', got '$have'" "$OUT"
n="$(printf '%s\n' "$OUT" | grep -c -E '^check: [1-6]/6 [a-z-]+ ok [0-9]+\.[0-9]s$')"
[ "$n" -eq 6 ] || fail "pnpm check: expected 6 step lines of the form 'check: n/6 <name> ok <t>s', found $n" "$OUT"
last="$(last_check_line "$OUT")"
printf '%s\n' "$last" | grep -q -E '^check: 6/6 ok in [0-9]+\.[0-9]s$' \
  || fail "pnpm check: last line: expected 'check: 6/6 ok in <t>s', got '$last'" "$OUT"
[ "$ELAPSED" -lt 180 ] || fail "pnpm check took $ELAPSED s on the test's clock, limit 180 s" "$OUT"
STATUS_AFTER="$(git -C "$ROOT" status --porcelain)"
[ "$STATUS_BEFORE" = "$STATUS_AFTER" ] \
  || fail "pnpm check changed the working tree" "$(printf 'before:\n%s\nafter:\n%s' "$STATUS_BEFORE" "$STATUS_AFTER")"
echo "# pnpm check from the root (test clock $ELAPSED s, limit 180 s):"
check_lines "$OUT" | sed 's/^/#   /'

# fail-fast, in the installed copy: a format error in the TypeScript package stops the check at step 1
TS="packages/units/src/index.ts"
grep -q '^export function toMetres(' "$ROOT/$TS" || fail "fixture: $TS has no 'export function toMetres(' line to break"
sed 's/^export function toMetres(/export  function toMetres(/' "$ROOT/$TS" > "$COPY/$TS" || fail "fixture: sed on $TS failed"
grep -q '^export  function toMetres(' "$COPY/$TS" || fail "fixture: the copy's $TS was not rewritten"
run_in "$COPY" pnpm check
[ "$RC" -ne 0 ] || fail "pnpm check in the copy with a format error in $TS: expected a non-zero exit, got 0" "$OUT"
LINT_RC=$RC
have="$(steps_of "$OUT")"
[ "$have" = "1/6 lint FAILED|" ] \
  || fail "format error in $TS: step lines: expected '1/6 lint FAILED|' and nothing after it, got '$have'" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^check: 1/6 lint FAILED \(exit [0-9]+\) after [0-9]+\.[0-9]s$' \
  || fail "format error in $TS: no 'check: 1/6 lint FAILED (exit <code>) after <t>s' line" "$OUT"
echo "# copy with a format error in $TS: pnpm check exit $LINT_RC"
check_lines "$OUT" | sed 's/^/#   /'
cp "$ROOT/$TS" "$COPY/$TS" && cmp -s "$ROOT/$TS" "$COPY/$TS" || fail "cannot restore the copy's $TS"

# an unformatted line in the crate passes lint, typecheck and test and stops the check at step 4
RS="crates/bridle-canon/src/lib.rs"
printf 'fn  spaced ( ) {}\n' >> "$COPY/$RS" || fail "fixture: cannot append to the copy's $RS"
run_in "$COPY" pnpm check
[ "$RC" -ne 0 ] || fail "pnpm check in the copy with an unformatted line in $RS: expected a non-zero exit, got 0" "$OUT"
FMT_RC=$RC
have="$(steps_of "$OUT")"
[ "$have" = "1/6 lint ok|2/6 typecheck ok|3/6 test ok|4/6 cargo-fmt FAILED|" ] \
  || fail "unformatted $RS: step lines: expected '1/6 lint ok|2/6 typecheck ok|3/6 test ok|4/6 cargo-fmt FAILED|', got '$have'" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^check: 4/6 cargo-fmt FAILED \(exit [0-9]+\) after [0-9]+\.[0-9]s$' \
  || fail "unformatted $RS: no 'check: 4/6 cargo-fmt FAILED (exit <code>) after <t>s' line" "$OUT"
echo "# copy with an unformatted line in $RS: pnpm check exit $FMT_RC"
check_lines "$OUT" | sed 's/^/#   /'
cp "$ROOT/$RS" "$COPY/$RS" && cmp -s "$ROOT/$RS" "$COPY/$RS" || fail "cannot restore the copy's $RS"

# both files restored: the copy passes again
run_in "$COPY" pnpm check
[ "$RC" -eq 0 ] || fail "pnpm check in the restored copy: exit $RC" "$OUT"
have="$(steps_of "$OUT")"
[ "$have" = "$WANT_PASS" ] || fail "restored copy: step lines: expected '$WANT_PASS', got '$have'" "$OUT"
echo "# restored copy: $(last_check_line "$OUT")"
echo "ok - check"
exit 0
