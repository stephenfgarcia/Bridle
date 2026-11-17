#!/usr/bin/env bash
# Tests for the externalized UI strings (card P0-02.6): one case per acceptance criterion. Card PX-02.2 moved the
# `catalog` case from "the catalog is exactly the two messages of card P0-02.6" to "the catalog holds them" (the
# catalog has grown with the application), the count of smoke tests to 5, and made the file lists leave out a file
# that is deleted in the tree but still in git's index.
# Card PX-02.4 moved the count of smoke tests to 6, card PX-02.5 to 7.
#   catalog AC1  packages/i18n/messages/en.json and en-XA.json hold fixtures C1 and C2 (`app.name` and
#                `home.notice`, accented, no ASCII letter left) and the same keys in the same order, at least
#                two; every pseudo message is in brackets and longer than its source; `pnpm i18n:pseudo` exits 0
#                and leaves both files and the tree as they were; pseudo.ts reproduces fixture P and the tag line of fixture G;
#                intl-messageformat is a dependency at an exact version, the one installed; the package's tests
#                pass and turbo lists @bridle/i18n#test. In a `mktemp -d` copy of the clone's files, after `pnpm
#                install --frozen-lockfile`: `t(id, values)` formats (the plural of fixture G, a missing value
#                throws) and an unknown id does not compile; `t("home.nope")` in the page stops `pnpm check` at
#                2/7 typecheck; a message added to en.json alone stops it at 2/7 (en-XA.json lacks the key); a
#                plural without `other` and an id of the wrong shape stop it at 3/7 test, each named; `app.name`
#                changed in en.json alone stops it at 3/7 and, once `pnpm i18n:pseudo` ran there, lint, typecheck
#                and test pass (docs/ops/i18n.md, "Adding or changing a string")
#   lint    AC2  the root `lint` script is `biome ci . && node packages/i18n/lint/lint-strings.mjs` and
#                tools/check.sh runs `pnpm lint` as step 1; the lint exits 0 on the tree (at least 5 files, 0
#                allowlisted) and apps/web/i18n-allowlist.json is `{ "allow": [] }` (ruling 2); the two fixtures
#                under packages/i18n/lint/fixtures are the Plan's FF and FP byte for byte, FF gives fixture LF
#                exactly and FP exits 0; fixture L0 (the four source files of 50a9e25) holds; an allowlist of the
#                seven strings gives `7 allowlisted`, one entry more is stale (exit 1), an entry without a reason
#                is exit 2; the rule's unit test runs in the package's tests; layout.tsx and page.tsx call `t(`
#                and hold no literal name or notice; the health route is byte-identical to 50a9e25's (ruling 1).
#                In the copy: a hard-coded paragraph stops `pnpm check` at 1/7 lint with Biome clean, naming the
#                rule and the text; its allowlist entry makes `pnpm lint` pass; the entry without the paragraph is
#                stale; a `message` literal in the health route is reported; the unit test fails when the failing
#                fixture loses a string
#   pseudo  AC3  `NEXT_PUBLIC_LOCALE=en-XA pnpm --filter web build` exits 0; `pnpm --filter web start` without the
#                variable serves <html lang="en-XA">, the h1 and the notice of fixture C2 and no English; the
#                health route answers fixture H byte for byte (the locale does not reach the API); the smoke
#                with the variable passes against it (7 passed, the same pid listening, smoke-home-en-XA.png a
#                gitignored PNG) and fails without it, naming en-XA; with no server running the smoke starts its
#                own in the pseudo-locale and leaves none; `NEXT_PUBLIC_LOCALE=fr` fails the build, naming fr
#   docs    AC4  docs/ux/ux-spec.md is fixture U and docs/ux is as 50a9e25 left it; docs/ops/i18n.md names the
#                requirement, the catalog, the generator, the lint with its six rule ids, the allowlist with its
#                reason and stale rules, and this file; README.md links it; docs/ops/local-dev.md and step 2 of
#                "Bumping a pin" in docs/ops/toolchain.md say of this file what its header says
# Fixtures (literal, from the card's Plan): C1, C2 the catalogs; P, G the pseudo text; FF, FP the lint's fixtures;
# LF, L0 its findings; H the health body; U the sha256 of docs/ux/ux-spec.md.
#
# Run:  bash tools/test/i18n.test.sh              (from any directory; the script finds the repository from its path)
#       bash tools/test/i18n.test.sh docs lint    (only the named cases, in the order catalog, lint, pseudo, docs)
# In a shell that predates the toolchain:
#   . "$HOME/.cargo/env"; . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null; bash tools/test/i18n.test.sh
# Never wire this file into `pnpm test`: it builds apps/web, starts servers and a browser, and runs `pnpm check` in a
# copy. Prints `ok - <case>` per case (and `# ...` comment lines with the measured lines); stops at the first failed
# assertion with `not ok - <case>: <why>` and the command's output on stderr, exit 1. Needs bash 3.2, node and pnpm
# at the pins of tools/toolchain.json, git with commit 50a9e25, curl, lsof, pgrep, tar, awk, grep, sed, od, cmp,
# shasum, mktemp, and the browser of `pnpm e2e:smoke` (docs/ops/toolchain.md).
# Ports: every server listens on a free loopback port taken from node, never 3000. The test refuses to start while
# http://127.0.0.1:3000/api/v1/health answers 200 (a dev server of this checkout is running there and the build
# would break it). GIT_SHA, PORT and NEXT_PUBLIC_LOCALE of the calling shell are unset first.
# Writes: the copy and the logs in `mktemp -d`; the `pseudo` case writes apps/web/.next, apps/web/next-env.d.ts,
# .bridle/playwright/ and .bridle/screenshots/smoke-home-en-XA.png (all gitignored). An EXIT trap stops the servers
# the test started (by pid, and whatever listens on a port it took), removes the directory and, when the `pseudo`
# case ran, removes apps/web/.next whole (no en-XA build is left for a later `next start`) and the two other paths
# if they were not there before; the screenshot stays. Takes about a minute and a half.
set -u
set -o pipefail
export DO_NOT_TRACK=1 # turbo: no telemetry and no first-run banner
export NEXT_TELEMETRY_DISABLED=1
unset GIT_SHA PORT NEXT_PUBLIC_LOCALE

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB="$ROOT/apps/web"
PKG="$ROOT/packages/i18n"
LINT="$PKG/lint/lint-strings.mjs"
BASE=50a9e25  # the commit before this card: fixture L0, the health route and docs/ux are compared with it
PNG="$ROOT/.bridle/screenshots/smoke-home-en-XA.png"
CASE=setup

# Fixtures C1 and C2 (literal): the two messages of card P0-02.6 and their pseudo forms.
NAME='Bridle'
NOTICE='Educational use only. Not for construction, permitting, or professional engineering use. Results are not a substitute for analysis and design by a licensed engineer.'
NAME_XA='[Ɓŕîîðļéé]'
NOTICE_XA='[ÉÉðûûçååţîîööñååļ ûûšéé ööñļý. Ñööţ ƒööŕ çööñšţŕûûçţîîööñ, þééŕɱîîţţîîñĝ, ööŕ þŕööƒééššîîööñååļ ééñĝîîñééééŕîîñĝ ûûšéé. Ŕééšûûļţš ååŕéé ñööţ åå šûûƀšţîîţûûţéé ƒööŕ ååñååļýšîîš ååñð ðééšîîĝñ ƀý åå ļîîçééñšééð ééñĝîîñééééŕ.]'
# Fixture P (literal).
P_IN='abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0-9'
P_OUT='ååƀçðééƒĝĥîîĵķļɱñööþǫŕšţûûṽŵẋýž ÅÅƁÇÐÉÉƑĜĤÎÎĴĶĻṀÑÖÖÞǪŔŠŢÛÛṼŴẊÝŽ 0-9'
# Fixture LF (literal): what the lint reports on fixture FF, in order.
FIXTURE_LF='property "Course settings"
jsx-constant "Gradebook"
prose "Submitted after the deadline"
jsx-text "Welcome back"
jsx-expression "Late"
jsx-attribute "Beam diagram"
jsx-attribute "Search"'
# Fixture U (literal).
UX_SHA=727c5fce39a7bbc9b4522042e774cf2eb599b3348e71eb66e78c11444a9cbda8

tmp=""
COPY=""          # the copy of the clone's files, made by the first case that needs it
WRAPPERS=""      # pids of the `pnpm --filter web start` commands this test started
PORTS=""         # every port this test took from node
SRV_PORT=""      # the port of the running server, empty when none runs
PSEUDO_RAN=0     # 1 once the pseudo case wrote apps/web/.next
HAD_ENVD=1; HAD_PW=1

listeners() {  # $1 = port: the pids listening on it, one per line (nothing when none)
  lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}
kill_tree() {  # $1 = pid: TERM to it and to every descendant, children first
  local child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do kill_tree "$child"; done
  kill "$1" 2>/dev/null || true
}
cleanup() {  # stops what this test started (up to 5 s, then KILL) and removes what it wrote
  local pid port i=0 busy
  for pid in $WRAPPERS; do kill_tree "$pid"; done
  while :; do
    busy=""
    for port in $PORTS; do
      for pid in $(listeners "$port"); do
        busy="$busy $pid"
        if [ "$i" -lt 10 ]; then kill "$pid" 2>/dev/null || true; else kill -9 "$pid" 2>/dev/null || true; fi
      done
    done
    [ -n "$busy" ] || break
    i=$((i + 1))
    [ "$i" -lt 14 ] || break
    sleep 0.5
  done
  for pid in $WRAPPERS; do wait "$pid" 2>/dev/null || true; done
  [ -n "$tmp" ] && rm -rf "$tmp"
  if [ "$PSEUDO_RAN" -eq 1 ]; then
    rm -rf "$WEB/.next"
    [ "$HAD_ENVD" -eq 1 ] || rm -f "$WEB/next-env.d.ts"
    [ "$HAD_PW" -eq 1 ] || rm -rf "$ROOT/.bridle/playwright"
  fi
  return 0
}
trap cleanup EXIT

fail() {  # $1 = why; $2 = output to show (optional). Prints `not ok` and exits 1.
  echo "not ok - $CASE: $1" >&2
  if [ -n "${2-}" ]; then
    echo "--- output ---" >&2
    printf '%s\n' "$2" >&2
    echo "--- end ---" >&2
  fi
  exit 1
}

# ---- which cases ------------------------------------------------------------------------------------------------
RUN_catalog=0; RUN_lint=0; RUN_pseudo=0; RUN_docs=0
if [ "$#" -eq 0 ]; then
  RUN_catalog=1; RUN_lint=1; RUN_pseudo=1; RUN_docs=1
else
  for a in "$@"; do
    case "$a" in
      catalog) RUN_catalog=1 ;;
      lint) RUN_lint=1 ;;
      pseudo) RUN_pseudo=1 ;;
      docs) RUN_docs=1 ;;
      *) echo "usage: i18n.test.sh [catalog] [lint] [pseudo] [docs]" >&2; exit 2 ;;
    esac
  done
fi

# ---- preflight --------------------------------------------------------------------------------------------------
for t in node pnpm git curl lsof pgrep tar awk grep sed od cmp shasum mktemp; do
  command -v "$t" >/dev/null 2>&1 || fail "$t is not on PATH (the pinned tools must be on PATH; see the header)"
done
tmp="$(mktemp -d)" || fail "mktemp -d failed"
code3000="$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/v1/health 2>/dev/null || true)"
[ "$code3000" != "200" ] \
  || fail "http://127.0.0.1:3000/api/v1/health answers 200: a dev server of this checkout is running and the build would break it (both write apps/web/.next); stop it first"
SHA="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null)" || fail "git rev-parse --short HEAD failed in $ROOT"
git -C "$ROOT" cat-file -e "$BASE^{commit}" 2>/dev/null || fail "commit $BASE is not in this clone (a shallow clone?); the test compares three paths with it"
HEALTH_BODY="{\"ok\":true,\"sha\":\"$SHA\"}"   # fixture H

# ---- helpers ----------------------------------------------------------------------------------------------------
plain_text() {  # stdin: without ANSI colour codes and carriage returns
  sed -e $'s/\033\\[[0-9;]*[A-Za-z]//g' -e $'s/\r$//'
}
run_in() {  # $1 = directory, $2.. = command: runs it there; sets OUT (stdout+stderr, colours removed) and RC
  local dir="$1"
  shift
  OUT="$(cd "$dir" && "$@" 2>&1)"
  RC=$?
  OUT="$(printf '%s\n' "$OUT" | plain_text)"
}
json() {  # $1 = JSON file, $2 = JavaScript expression over `j`: prints its value (strings bare, the rest as JSON)
  node -e 'const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const v = eval(process.argv[2]);
console.log(typeof v === "string" ? v : JSON.stringify(v));' "$1" "$2"
}
set_json() {  # $1 = JSON file, $2 = key, $3 = value: sets it and writes the file as `pnpm i18n:pseudo` writes one
  node -e 'const fs = require("fs"); const [f, k, v] = process.argv.slice(1);
const j = JSON.parse(fs.readFileSync(f, "utf8")); j[k] = v; fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");' "$1" "$2" "$3"
}
existing() {  # stdin: paths relative to the root, NUL-separated; stdout: those that exist, NUL-separated. A file
              # deleted in the tree but still in git's index (a deletion not committed yet) is left out.
  (cd "$ROOT" && xargs -0 sh -c 'for f in "$@"; do if [ -e "$f" ] || [ -L "$f" ]; then printf "%s\0" "$f"; fi; done' sh)
}
tree_state() {  # git's view of the tree, and the bytes of the files a build, the generator or the smoke could rewrite
  (cd "$ROOT" && git status --porcelain \
     && git ls-files -z --cached --others --exclude-standard -- apps/web packages/i18n e2e playwright.config.ts \
          package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore | existing | xargs -0 shasum -a 256)
}
same_tree() {  # $1 = state before, $2 = what ran: fails when the tree changed
  local now
  now="$(tree_state)"
  [ "$now" = "$1" ] || fail "$2 changed the tree (git status --porcelain or the bytes of a tracked or new file)" \
    "$(printf '%s\n' "$1" > "$tmp/state.before"; printf '%s\n' "$now" > "$tmp/state.after"; diff "$tmp/state.before" "$tmp/state.after")"
}
free_port() {  # prints a free loopback port from node, never 3000
  local p
  p="$(node -e 'const net = require("net");
const take = () => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port;
  s.close(() => (p === 3000 ? take() : console.log(p))); }); };
take();')" || return 1
  [ -n "$p" ] && [ "$p" != "3000" ] || return 1
  printf '%s\n' "$p"
}
http_get() {  # $1 = URL: headers to $tmp/h (no CR), body to $tmp/b; sets CODE (000 when nothing answers)
  CODE="$(curl -s -m 10 -D "$tmp/h.raw" -o "$tmp/b" -w '%{http_code}' "$1" 2>/dev/null)" || CODE=000
  if [ -f "$tmp/h.raw" ]; then tr -d '\r' < "$tmp/h.raw" > "$tmp/h"; else : > "$tmp/h"; fi
}
steps_of() {  # $1 = check output: its step lines as "<n>/7 <name> <ok|FAILED>|..." in order
  printf '%s\n' "$1" | awk '/^check: [0-9]+\/[0-9]+ [a-z-]+ (ok|FAILED)/ { printf "%s %s %s|", $2, $3, $4 }'
}
ensure_copy() {  # COPY = what a clone holds (without tools/agent-hq, no workspace member), installed from the lockfile
  [ -z "$COPY" ] || return 0
  COPY="$tmp/clone"
  mkdir -p "$COPY" || fail "cannot create $COPY"
  (cd "$ROOT" && git ls-files -z --cached --others --exclude-standard -- . ':(exclude)tools/agent-hq' \
     | existing | tar --null -T - -cf - | tar -C "$COPY" -xf -) || fail "copying the tracked and untracked-not-ignored files into $COPY failed"
  run_in "$COPY" pnpm install --frozen-lockfile
  [ "$RC" -eq 0 ] || fail "pnpm install --frozen-lockfile in the copy: exit $RC" "$OUT"
  cmp -s "$ROOT/pnpm-lock.yaml" "$COPY/pnpm-lock.yaml" || fail "pnpm install --frozen-lockfile rewrote pnpm-lock.yaml in the copy" "$OUT"
}
restore_copy() {  # $1.. = paths relative to the root: puts the tree's bytes back into the copy
  local f
  for f in "$@"; do cp "$ROOT/$f" "$COPY/$f" || fail "cannot restore $f in the copy"; done
}
lint_run() {  # $1 = directory to run in, $2.. = arguments of the lint: sets LOUT (stdout), LERR (stderr), LRC
  local dir="$1"
  shift
  LOUT="$(cd "$dir" && node packages/i18n/lint/lint-strings.mjs "$@" 2>"$tmp/lint.err")"
  LRC=$?
  LERR="$(cat "$tmp/lint.err")"
}
findings() {  # stdin: the lint's stderr; prints `<rule> "<text>"` per finding, in order
  grep -v '^lint-strings:' | sed -E 's/^.*:[0-9]+:[0-9]+ //'
}
start_web() {  # $1 = port: `pnpm --filter web start` (the last build), waits up to 60 s for the health route
  local port="$1" i=0
  SRV_LOG="$tmp/start-$port.log"
  [ -z "$(listeners "$port")" ] || fail "port $port is already taken"
  (cd "$ROOT" && exec pnpm --filter web start --hostname 127.0.0.1 --port "$port") > "$SRV_LOG" 2>&1 &
  SRV_PID=$!
  WRAPPERS="$WRAPPERS $SRV_PID"
  SRV_PORT="$port"
  while :; do
    http_get "http://127.0.0.1:$port/api/v1/health"
    [ "$CODE" = "200" ] && break
    kill -0 "$SRV_PID" 2>/dev/null \
      || fail "pnpm --filter web start --hostname 127.0.0.1 --port $port exited before it answered" "$(cat "$SRV_LOG")"
    i=$((i + 1))
    [ "$i" -lt 120 ] \
      || fail "pnpm --filter web start --hostname 127.0.0.1 --port $port: /api/v1/health did not answer 200 within 60 s (last code $CODE)" "$(cat "$SRV_LOG")"
    sleep 0.5
  done
  SRV_LISTENER="$(listeners "$port" | sed -n '1p')"
  [ -n "$SRV_LISTENER" ] || fail "the server answers on $port but lsof shows no listener there"
}
stop_web() {  # stops the running server and waits until nothing listens on its port
  local i=0 pid
  [ -n "$SRV_PORT" ] || return 0
  kill_tree "$SRV_PID"
  while [ -n "$(listeners "$SRV_PORT")" ]; do
    i=$((i + 1))
    if [ "$i" -eq 10 ]; then for pid in $(listeners "$SRV_PORT"); do kill "$pid" 2>/dev/null || true; done; fi
    if [ "$i" -eq 20 ]; then for pid in $(listeners "$SRV_PORT"); do kill -9 "$pid" 2>/dev/null || true; done; fi
    [ "$i" -lt 30 ] || fail "the server on port $SRV_PORT did not stop within 15 s" "$(listeners "$SRV_PORT")"
    sleep 0.5
  done
  wait "$SRV_PID" 2>/dev/null || true
  SRV_PORT=""
}

# ---- catalog (AC1) ----------------------------------------------------------------------------------------------
if [ "$RUN_catalog" -eq 1 ]; then
CASE=catalog
EN="$PKG/messages/en.json"
XA="$PKG/messages/en-XA.json"
[ -f "$EN" ] || fail "packages/i18n/messages/en.json does not exist"
[ -f "$XA" ] || fail "packages/i18n/messages/en-XA.json does not exist (the output of pnpm i18n:pseudo is committed)"
want_entries() {  # $1, $2 = the two values: the entries of fixture C1 or C2, as JSON
  node -e 'console.log(JSON.stringify([["app.name", process.argv[1]], ["home.notice", process.argv[2]]]))' "$1" "$2"
}
FIXTURE_ENTRIES='[["app.name", j["app.name"]], ["home.notice", j["home.notice"]]]'
got="$(json "$EN" "$FIXTURE_ENTRIES")" || fail "packages/i18n/messages/en.json does not parse as JSON"
[ "$got" = "$(want_entries "$NAME" "$NOTICE")" ] || fail "packages/i18n/messages/en.json does not hold fixture C1 (app.name and home.notice)" "$got"
got="$(json "$XA" "$FIXTURE_ENTRIES")" || fail "packages/i18n/messages/en-XA.json does not parse as JSON"
[ "$got" = "$(want_entries "$NAME_XA" "$NOTICE_XA")" ] || fail "packages/i18n/messages/en-XA.json does not hold fixture C2 (the pseudo forms of app.name and home.notice)" "$got"
# Every message: the same keys in the same order in both files, the pseudo one in brackets and longer. The two
# fixture messages have no argument, so no ASCII letter may be left in their pseudo forms (an argument such as
# {name} keeps its letters).
shape="$(node -e 'const fs = require("fs"); const [e, x] = process.argv.slice(1).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const keys = Object.keys(e);
if (keys.join("\n") !== Object.keys(x).join("\n")) { console.log("the keys of the two files differ"); process.exit(0); }
const bad = keys.filter((k) => !(x[k].startsWith("[") && x[k].endsWith("]") && [...x[k]].length > [...e[k]].length));
for (const k of ["app.name", "home.notice"]) if (/[A-Za-z]/.test(x[k])) bad.push(k + " (an ASCII letter is left)");
console.log(bad.length ? "bad: " + bad.join(" ") : keys.length + " messages; " + ["app.name", "home.notice"].map((k) => [...e[k]].length + " to " + [...x[k]].length).join(", "));' "$EN" "$XA")"
NMESSAGES="${shape%% messages; *}"
case "$shape" in
  *' messages; 6 to 10, 165 to 223') ;;
  *) fail "the pseudo messages are not bracketed and lengthened, the keys of the two files differ, or app.name and home.notice are not 6 to 10 and 165 to 223 characters (fixture C2)" "$shape" ;;
esac
[ "$NMESSAGES" -ge 2 ] || fail "the catalog holds $NMESSAGES messages, expected at least the two of fixture C1"

[ "$(json "$ROOT/package.json" 'j.scripts["i18n:pseudo"]')" = "pnpm --filter @bridle/i18n pseudo" ] \
  || fail "the root i18n:pseudo script is not 'pnpm --filter @bridle/i18n pseudo'"
STATE="$(tree_state)" || fail "cannot read the state of the tree"
cp "$XA" "$tmp/en-XA.before" || fail "cannot save en-XA.json"
run_in "$ROOT" pnpm i18n:pseudo
if ! cmp -s "$XA" "$tmp/en-XA.before"; then
  cp "$XA" "$tmp/en-XA.generated"; cp "$tmp/en-XA.before" "$XA"   # the tree is left as it was
  fail "pnpm i18n:pseudo rewrote packages/i18n/messages/en-XA.json with other bytes (restored): the committed file is not the generator's output" \
    "$(diff "$tmp/en-XA.before" "$tmp/en-XA.generated")"
fi
[ "$RC" -eq 0 ] || fail "pnpm i18n:pseudo: exit $RC" "$OUT"
same_tree "$STATE" "pnpm i18n:pseudo"
PSEUDO_LINE="$(printf '%s\n' "$OUT" | tail -n 1)"
got="$(node -e 'import(process.argv[1]).then((m) => { console.log(m.pseudoText(process.argv[2]));
  console.log(m.pseudoMessage("Read the <b>notice</b> first")); });' "$PKG/src/pseudo.ts" "$P_IN" 2>"$tmp/p.err")" \
  || fail "node cannot import packages/i18n/src/pseudo.ts and call pseudoText and pseudoMessage" "$(cat "$tmp/p.err")"
[ "$got" = "$P_OUT
[Ŕééååð ţĥéé <b>ñööţîîçéé</b> ƒîîŕšţ]" ] || fail "pseudoText and pseudoMessage do not reproduce fixture P and the tag line of fixture G" "$got"
echo "# en.json holds fixture C1, en-XA.json fixture C2 ($shape characters; every message bracketed and longer, the same keys in both); pnpm i18n:pseudo: exit 0, '$PSEUDO_LINE', both files and the tree unchanged; pseudo.ts reproduces fixture P and the tag line of G"

dep="$(json "$PKG/package.json" 'j.dependencies["intl-messageformat"]')" || fail "cannot read packages/i18n/package.json"
printf '%s\n' "$dep" | grep -q -E '^[0-9]+\.[0-9]+\.[0-9]+$' || fail "packages/i18n/package.json: dependencies[\"intl-messageformat\"] is '$dep', expected an exact version (ICU MessageFormat)"
run_in "$ROOT" pnpm ls --filter @bridle/i18n --depth 0 --json
[ "$RC" -eq 0 ] || fail "pnpm ls --filter @bridle/i18n --depth 0 --json: exit $RC" "$OUT"
printf '%s\n' "$OUT" > "$tmp/ls.json"
inst="$(json "$tmp/ls.json" 'j.length === 1 && j[0].name === "@bridle/i18n" ? j[0].dependencies["intl-messageformat"].version : "not listed"' 2>/dev/null)" \
  || fail "pnpm ls --filter @bridle/i18n does not list intl-messageformat" "$OUT"
[ "$inst" = "$dep" ] || fail "installed intl-messageformat is '$inst', packages/i18n/package.json pins $dep"
run_in "$ROOT" pnpm --filter @bridle/i18n test
[ "$RC" -eq 0 ] || fail "pnpm --filter @bridle/i18n test: exit $RC" "$OUT"
TESTS_LINE="$(printf '%s\n' "$OUT" | grep -E '^ +Tests +[0-9]+ passed' | sed -n '1p' | sed 's/^ *//; s/  */ /g')"
run_in "$ROOT" pnpm exec turbo run test --dry=json
[ "$RC" -eq 0 ] || fail "pnpm exec turbo run test --dry=json: exit $RC" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '"taskId": *"@bridle/i18n#test"' || fail "turbo's dry run of test does not list @bridle/i18n#test: the package's tests are not in pnpm check" "$OUT"
echo "# intl-messageformat $dep pinned and installed; pnpm --filter @bridle/i18n test: exit 0, '$TESTS_LINE'; turbo lists @bridle/i18n#test"

# The typed helper and the fail-fast proofs, in a copy of what a clone holds.
ensure_copy
cat > "$COPY/packages/i18n/src/zz-tester.test.ts" <<'EOF'
import { expect, it } from "vitest";
import { formatMessage, t } from "./index";
import { pseudoMessage } from "./pseudo";

const MEMBERS = "{count, plural, =0 {No members} one {# member} other {# members}} in {course}";

it("t(id, values) looks up and formats", () => {
  expect(t("app.name")).toBe("Bridle");
  expect(t("app.name", { unused: 1 })).toBe("Bridle");
  expect(t("app.name", undefined, "en-XA")).toBe("[Ɓŕîîðļéé]");
  expect(formatMessage("en", MEMBERS, { count: 0, course: "CE 101" })).toBe("No members in CE 101");
  expect(formatMessage("en", MEMBERS, { count: 1234, course: "CE 101" })).toBe("1,234 members in CE 101");
  expect(formatMessage("en-XA", pseudoMessage(MEMBERS), { count: 1, course: "CE 101" })).toBe("[1 ɱééɱƀééŕ îîñ CE 101]");
  expect(() => formatMessage("en", MEMBERS, { count: 1 })).toThrow(/course/);
});
EOF
cat > "$COPY/packages/i18n/src/zz-tester-types.ts" <<'EOF'
import { t } from "./index";
export const known: string = t("app.name", { count: 1 });
// @ts-expect-error an id the catalog does not hold must not compile
export const unknown: string = t("home.nope");
EOF
run_in "$COPY" pnpm --filter @bridle/i18n exec vitest run src/zz-tester.test.ts
[ "$RC" -eq 0 ] || fail "in the copy, t(id, values) and the formatter do not give the strings of fixtures C1, C2 and G" "$OUT"
run_in "$COPY" pnpm --filter @bridle/i18n typecheck
[ "$RC" -eq 0 ] || fail "in the copy, a file that expects t(\"home.nope\") to be a type error does not typecheck: the ids are not checked at compile time, or t(id, values) is not typed" "$OUT"
rm -f "$COPY/packages/i18n/src/zz-tester.test.ts" "$COPY/packages/i18n/src/zz-tester-types.ts"

sed -i.bak 's/t("home\.notice")/t("home.nope")/' "$COPY/apps/web/src/app/page.tsx" && rm -f "$COPY/apps/web/src/app/page.tsx.bak"
grep -q -F 't("home.nope")' "$COPY/apps/web/src/app/page.tsx" || fail "apps/web/src/app/page.tsx has no t(\"home.notice\") to replace in the copy"
run_in "$COPY" pnpm check
[ "$(steps_of "$OUT")" = "1/7 lint ok|2/7 typecheck FAILED|" ] \
  || fail "in the copy, t(\"home.nope\") in apps/web/src/app/page.tsx: the step lines are '$(steps_of "$OUT")', expected '1/7 lint ok|2/7 typecheck FAILED|' (an unknown id must not compile)" "$OUT"
printf '%s\n' "$OUT" | grep -q -F 'home.nope' || fail "the failed typecheck does not name home.nope" "$OUT"
NOPE_LINE="$(printf '%s\n' "$OUT" | grep -F 'home.nope' | sed -n '1p' | cut -c 1-110)"
restore_copy apps/web/src/app/page.tsx

set_json "$COPY/packages/i18n/messages/en.json" home.added 'Added'
run_in "$COPY" pnpm check
[ "$(steps_of "$OUT")" = "1/7 lint ok|2/7 typecheck FAILED|" ] && printf '%s\n' "$OUT" | grep -q -F 'home.added' \
  || fail "in the copy, a message added to en.json alone: the step lines are '$(steps_of "$OUT")', expected '1/7 lint ok|2/7 typecheck FAILED|' naming home.added (a key missing from en-XA.json is a type error)" "$OUT"
restore_copy packages/i18n/messages/en.json

for f in en en-XA; do set_json "$COPY/packages/i18n/messages/$f.json" home.bad '{n, plural, one {x}'; done
run_in "$COPY" pnpm check
[ "$(steps_of "$OUT")" = "1/7 lint ok|2/7 typecheck ok|3/7 test FAILED|" ] \
  || fail "in the copy, a plural without 'other' in the catalogs: the step lines are '$(steps_of "$OUT")', expected '1/7 lint ok|2/7 typecheck ok|3/7 test FAILED|'" "$OUT"
printf '%s\n' "$OUT" | grep -F 'home.bad' | grep -q -i -E 'parse|throw|syntax|other' || fail "the failed test step does not name home.bad as a message that does not parse" "$OUT"
restore_copy packages/i18n/messages/en.json packages/i18n/messages/en-XA.json

for f in en en-XA; do set_json "$COPY/packages/i18n/messages/$f.json" Bad_id 'x'; done
run_in "$COPY" pnpm --filter @bridle/i18n test
[ "$RC" -ne 0 ] && printf '%s\n' "$OUT" | grep -F 'Bad_id' | grep -q -F 'match' \
  || fail "in the copy, the id Bad_id in the catalogs: the package's tests exit $RC and do not name it as an id of the wrong shape" "$OUT"
restore_copy packages/i18n/messages/en.json packages/i18n/messages/en-XA.json
echo "# copy: t(id, values) formats and an unknown id is a type error; t(\"home.nope\") in page.tsx -> 2/7 typecheck FAILED ('$NOPE_LINE'); a key in en.json alone -> 2/7; a plural without other -> 3/7 naming home.bad; Bad_id -> the package's tests fail naming it"

# Changing a string as docs/ops/i18n.md says: en.json alone is drift (3/7); with `pnpm i18n:pseudo`, steps 1 to 3 pass.
set_json "$COPY/packages/i18n/messages/en.json" app.name 'Bridle LMS'
run_in "$COPY" pnpm check
[ "$(steps_of "$OUT")" = "1/7 lint ok|2/7 typecheck ok|3/7 test FAILED|" ] \
  || fail "in the copy, app.name changed in en.json alone: the step lines are '$(steps_of "$OUT")', expected '1/7 lint ok|2/7 typecheck ok|3/7 test FAILED|' (en-XA.json is out of date)" "$OUT"
printf '%s\n' "$OUT" | grep -q -F 'en-XA' || fail "the failed test step does not name en-XA.json as out of date" "$OUT"
run_in "$COPY" pnpm i18n:pseudo
[ "$RC" -eq 0 ] || fail "in the copy, pnpm i18n:pseudo after app.name changed: exit $RC" "$OUT"
got="$(json "$COPY/packages/i18n/messages/en-XA.json" 'j["app.name"]')"
[ "$got" = '[Ɓŕîîðļéé ĻṀŠ]' ] || fail "in the copy, pnpm i18n:pseudo wrote app.name = '$got' for 'Bridle LMS', expected '[Ɓŕîîðļéé ĻṀŠ]'"
for step in lint typecheck test; do
  run_in "$COPY" pnpm "$step"
  [ "$RC" -eq 0 ] || fail "in the copy, after app.name became 'Bridle LMS' in en.json and pnpm i18n:pseudo regenerated en-XA.json (the steps of docs/ops/i18n.md, 'Adding or changing a string'), pnpm $step exits $RC: a changed string fails pnpm check although both catalogs agree" \
    "$(printf '%s\n' "$OUT" | grep -E 'FAIL|AssertionError|error TS|^ +Tests' | sed -n '1,12p')"
done
restore_copy packages/i18n/messages/en.json packages/i18n/messages/en-XA.json
echo "# copy: app.name changed in en.json alone -> 3/7 test FAILED naming en-XA; after pnpm i18n:pseudo: en-XA.json holds [Ɓŕîîðļéé ĻṀŠ], pnpm lint, typecheck and test exit 0"
echo "ok - catalog"
fi

# ---- lint (AC2) -------------------------------------------------------------------------------------------------
if [ "$RUN_lint" -eq 1 ]; then
CASE=lint
[ -f "$LINT" ] || fail "packages/i18n/lint/lint-strings.mjs does not exist"
[ "$(json "$ROOT/package.json" 'j.scripts.lint')" = "biome ci . && node packages/i18n/lint/lint-strings.mjs" ] \
  || fail "the root lint script is not 'biome ci . && node packages/i18n/lint/lint-strings.mjs': the string lint is not part of pnpm lint"
grep -q -E '^run_step 1 lint pnpm lint$' "$ROOT/tools/check.sh" || fail "tools/check.sh does not run 'pnpm lint' as step 1"
lint_run "$ROOT"
[ "$LRC" -eq 0 ] || fail "node packages/i18n/lint/lint-strings.mjs on the tree: exit $LRC (apps/web holds a hard-coded user-facing string, or a stale allowlist entry)" "$LERR"
nfiles="$(printf '%s\n' "$LOUT" | sed -n 's/^lint-strings: ok, \([0-9][0-9]*\) files checked, 0 allowlisted$/\1/p')"
[ -n "$nfiles" ] || fail "the lint on the tree does not print 'lint-strings: ok, <k> files checked, 0 allowlisted'" "$LOUT"
[ "$nfiles" -ge 5 ] || fail "the lint checked $nfiles files of apps/web/src, expected at least 5"
[ "$(json "$WEB/i18n-allowlist.json" 'Array.isArray(j.allow) ? j.allow.length : "no allow array"')" = "0" ] \
  || fail "apps/web/i18n-allowlist.json is not an empty 'allow' array (ruling 2: the allowlist ships empty)" "$(cat "$WEB/i18n-allowlist.json")"

# Fixtures FF and FP (literal), written here and compared with the package's, then linted from here.
mkdir -p "$tmp/fx/fail" "$tmp/fx/pass" || fail "cannot create $tmp/fx"
cat > "$tmp/fx/fail/page.tsx" <<'EOF'
// Failing fixture of lint-strings: seven hard-coded user-facing strings, one per rule (two for jsx-attribute).
export const metadata = {
  title: "Course settings",
};

const HEADING = "Gradebook";

export default function FailPage({ late }: { late: boolean }) {
  const status = late ? "Submitted after the deadline" : "ok";
  return (
    <main data-status={status}>
      <h1>{HEADING}</h1>
      <p>Welcome back</p>
      <p>{late ? "Late" : null}</p>
      <img src="/beam.png" alt="Beam diagram" />
      <input type="text" name="q" placeholder="Search" />
    </main>
  );
}
EOF
cat > "$tmp/fx/pass/page.tsx" <<'EOF'
// Passing fixture of lint-strings: the same shapes as the failing fixture, every string a catalog lookup or
// in a position no user reads.
"use client";

import { t } from "../i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: t("app.name"),
};

type Mode = "read only" | "read write";

export default function PassPage({ late, mode }: { late: boolean; mode: Mode }) {
  if (mode !== "read only" && mode !== "read write") {
    throw new Error("unknown mode: expected read only or read write");
  }
  console.warn("rendering the passing fixture");
  return (
    <main className="page wide" data-testid="pass" lang="en">
      <h1>{t("app.name")}</h1>
      <p>{late ? t("home.notice") : null}</p>
      <p>
        {42} / {100}
      </p>
      <img src="/beam.png" alt={t("app.name")} />
      <input type="text" name="q" placeholder={t("app.name")} />
    </main>
  );
}
EOF
for k in fail pass; do
  cmp -s "$tmp/fx/$k/page.tsx" "$PKG/lint/fixtures/$k/page.tsx" \
    || fail "packages/i18n/lint/fixtures/$k/page.tsx is not the Plan's fixture byte for byte (the rule's unit test needs one failing and one passing fixture)" \
      "$(diff "$tmp/fx/$k/page.tsx" "$PKG/lint/fixtures/$k/page.tsx" 2>&1)"
done
printf '{ "allow": [] }\n' > "$tmp/fx/empty.json"
lint_run "$ROOT" --src "$tmp/fx/fail" --allow "$tmp/fx/empty.json"
got="$(printf '%s\n' "$LERR" | findings)"
[ "$LRC" -eq 1 ] && [ "$got" = "$FIXTURE_LF" ] || fail "the lint on fixture FF: exit $LRC and findings that are not fixture LF (seven, in order)" "$LERR"
printf '%s\n' "$LERR" | grep -q -F 'lint-strings: FAILED: 7 hard-coded user-facing string(s), 0 stale allowlist entr(ies); 1 files checked' \
  || fail "the lint on fixture FF does not end with its FAILED line for 7 strings" "$LERR"
lint_run "$ROOT" --src "$tmp/fx/pass" --allow "$tmp/fx/empty.json"
[ "$LRC" -eq 0 ] && [ -z "$LERR" ] || fail "the lint on fixture FP: exit $LRC, expected 0 with nothing reported" "$LERR"

# Fixture L0: the four source files of the commit before this card.
for f in app/layout.tsx app/page.tsx app/api/v1/health/route.ts sha.ts; do
  mkdir -p "$tmp/l0/src/$(dirname "$f")" || fail "cannot create $tmp/l0"
  git -C "$ROOT" show "$BASE:apps/web/src/$f" > "$tmp/l0/src/$f" || fail "git show $BASE:apps/web/src/$f failed"
done
lint_run "$ROOT" --src "$tmp/l0/src" --allow "$tmp/fx/empty.json"
got="$(printf '%s\n' "$LERR" | grep -v '^lint-strings:' | sed -E 's#^.*/l0/src/##; s#:[0-9]+:[0-9]+ # #')"
[ "$LRC" -eq 1 ] && [ "$got" = "app/layout.tsx property \"$NAME\"
app/page.tsx prose \"$NOTICE\"
app/page.tsx jsx-text \"$NAME\"" ] || fail "the lint on the four source files of $BASE: exit $LRC and findings that are not fixture L0 (the title, the notice and the heading; nothing in route.ts or sha.ts)" "$LERR"

# The allowlist: the seven strings, one entry more (stale), an entry without a reason.
allow_of() {  # $1 = file to write, $2 = "stale" or "noreason" or "": an allowlist of fixture LF's texts for fail/page.tsx
  printf '%s\n' "$FIXTURE_LF" | node -e 'const fs = require("fs"); const [out, mode] = process.argv.slice(1);
const allow = fs.readFileSync(0, "utf8").trim().split("\n").map((l) => ({ file: "fail/page.tsx", text: JSON.parse(l.slice(l.indexOf(" ") + 1)), reason: "fixture" }));
if (mode === "stale") allow.push({ file: "fail/page.tsx", text: "No such string", reason: "stale on purpose" });
if (mode === "noreason") delete allow[0].reason;
fs.writeFileSync(out, JSON.stringify({ allow }, null, 2) + "\n");' "$1" "$2"
}
allow_of "$tmp/fx/allow.json" ""
lint_run "$ROOT" --src "$tmp/fx/fail" --allow "$tmp/fx/allow.json"
[ "$LRC" -eq 0 ] && [ "$LOUT" = "lint-strings: ok, 1 files checked, 7 allowlisted" ] \
  || fail "the lint on fixture FF with its seven strings allowlisted: exit $LRC, '$LOUT', expected 0 and '... 7 allowlisted'" "$LERR"
lint_run "$ROOT" --src "$PKG/lint/fixtures/fail" --allow "$PKG/lint/fixtures/allow-fail.json"
[ "$LRC" -eq 0 ] && [ "$LOUT" = "lint-strings: ok, 1 files checked, 7 allowlisted" ] \
  || fail "the lint on the package's failing fixture with its allow-fail.json: exit $LRC, '$LOUT', expected 0 and '... 7 allowlisted'" "$LERR"
allow_of "$tmp/fx/stale.json" stale
lint_run "$ROOT" --src "$tmp/fx/fail" --allow "$tmp/fx/stale.json"
[ "$LRC" -eq 1 ] && printf '%s\n' "$LERR" | grep -F 'stale' | grep -q -F 'No such string' \
  || fail "an allowlist entry that matches no string: exit $LRC, expected 1 naming the stale entry 'No such string'" "$LERR"
allow_of "$tmp/fx/noreason.json" noreason
lint_run "$ROOT" --src "$tmp/fx/fail" --allow "$tmp/fx/noreason.json"
[ "$LRC" -eq 2 ] && printf '%s\n' "$LERR" | grep -q -F 'reason' \
  || fail "an allowlist entry without a reason: exit $LRC, expected 2 naming 'reason'" "$LERR"
run_in "$ROOT" pnpm --filter @bridle/i18n test --reporter=verbose
[ "$RC" -eq 0 ] || fail "pnpm --filter @bridle/i18n test --reporter=verbose: exit $RC" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '✓ +lint/lint-strings\.test\.mjs' || fail "the package's tests do not run lint/lint-strings.test.mjs: the rule has no unit test in pnpm check" "$OUT"
echo "# lint on the tree: exit 0, $nfiles files, 0 allowlisted, the allowlist empty; FF and FP are the Plan's bytes; FF -> fixture LF (7), FP -> 0; L0 holds on $BASE; allowlisted 7 -> 0, one more -> 1 stale, no reason -> 2; lint-strings.test.mjs runs in the package's tests"

for f in app/layout.tsx app/page.tsx; do
  grep -q -F 't("' "$WEB/src/$f" || fail "apps/web/src/$f has no catalog lookup t(\"...\")"
  grep -q -F -- "$NOTICE" "$WEB/src/$f" && fail "apps/web/src/$f holds a copy of the notice; it comes from the catalog"
  grep -q -E "[\"'>]$NAME[\"'<]" "$WEB/src/$f" && fail "apps/web/src/$f holds the literal name '$NAME'; it is the message app.name (ruling 2)"
done
git -C "$ROOT" show "$BASE:apps/web/src/app/api/v1/health/route.ts" | cmp -s - "$WEB/src/app/api/v1/health/route.ts" \
  || fail "apps/web/src/app/api/v1/health/route.ts is not byte-identical to $BASE's (ruling 1: the route is not changed)"

ensure_copy
PAGE="$COPY/apps/web/src/app/page.tsx"
awk '!done && index($0, "<h1>") { line = $0; sub(/<h1>.*/, "<p>Hard-coded words</p>", line); print line; done = 1 } { print }' \
  "$ROOT/apps/web/src/app/page.tsx" > "$PAGE"
grep -q -F '<p>Hard-coded words</p>' "$PAGE" || fail "cannot put the hard-coded paragraph into the copy's page.tsx"
run_in "$COPY" pnpm check
[ "$(steps_of "$OUT")" = "1/7 lint FAILED|" ] \
  || fail "in the copy, <p>Hard-coded words</p> in apps/web/src/app/page.tsx: the step lines are '$(steps_of "$OUT")', expected '1/7 lint FAILED|' (the string lint is not in pnpm check)" "$OUT"
printf '%s\n' "$OUT" | grep -q -F 'No fixes applied' || fail "Biome did not pass on the copy before the string lint ('No fixes applied' is missing): the failure is not the string lint's" "$OUT"
HARD_LINE="$(printf '%s\n' "$OUT" | grep -F 'jsx-text "Hard-coded words"' | sed -n '1p')"
case "$HARD_LINE" in apps/web/src/app/page.tsx:*) ;; *) fail "the failed lint does not report apps/web/src/app/page.tsx:<line>:<column> jsx-text \"Hard-coded words\"" "$OUT" ;; esac
cat > "$COPY/apps/web/i18n-allowlist.json" <<'EOF'
{
  "allow": [
    {
      "file": "src/app/page.tsx",
      "text": "Hard-coded words",
      "reason": "negative proof of tools/test/i18n.test.sh"
    }
  ]
}
EOF
run_in "$COPY" pnpm lint
[ "$RC" -eq 0 ] && printf '%s\n' "$OUT" | grep -q -E '^lint-strings: ok, [0-9]+ files checked, 1 allowlisted$' \
  || fail "in the copy, with the paragraph's entry in apps/web/i18n-allowlist.json, pnpm lint exits $RC, expected 0 and '... 1 allowlisted'" "$OUT"
restore_copy apps/web/src/app/page.tsx
run_in "$COPY" pnpm lint
[ "$RC" -eq 1 ] && printf '%s\n' "$OUT" | grep -F 'stale' | grep -q -F 'Hard-coded words' \
  || fail "in the copy, the allowlist entry kept without its paragraph: pnpm lint exits $RC, expected 1 naming the stale entry" "$OUT"
restore_copy apps/web/i18n-allowlist.json
ROUTE="$COPY/apps/web/src/app/api/v1/health/route.ts"
sed -i.bak 's/sha: gitSha() }/sha: gitSha(), message: "Service is healthy" }/' "$ROUTE" && rm -f "$ROUTE.bak"
lint_run "$COPY"
[ "$LRC" -eq 1 ] && printf '%s\n' "$LERR" | grep -F 'route.ts' | grep -q -F 'property "Service is healthy"' \
  || fail "in the copy, a message literal in the health route's body: the lint exits $LRC, expected 1 reporting route.ts property \"Service is healthy\" (ruling 1: the lint covers the route)" "$LERR"
restore_copy apps/web/src/app/api/v1/health/route.ts
FX="$COPY/packages/i18n/lint/fixtures/fail/page.tsx"
sed -i.bak 's|<p>Welcome back</p>|<p>{42}</p>|' "$FX" && rm -f "$FX.bak"
run_in "$COPY" pnpm test
[ "$RC" -ne 0 ] && printf '%s\n' "$OUT" | grep -q -E 'FAIL +lint/lint-strings\.test\.mjs' \
  || fail "in the copy, the failing fixture without its JSX text: pnpm test exits $RC, expected lint/lint-strings.test.mjs to fail (the unit test does not hold the fixture's findings)" "$OUT"
restore_copy packages/i18n/lint/fixtures/fail/page.tsx
echo "# layout.tsx and page.tsx look up the catalog, no literal name or notice; route.ts = $BASE's bytes. copy: hard-coded paragraph -> 1/7 lint FAILED after Biome passed, '$HARD_LINE'; allowlisted -> pnpm lint 0; entry without the paragraph -> stale, 1; a message literal in route.ts -> reported; fixture FF changed -> lint-strings.test.mjs fails"
echo "ok - lint"
fi

# ---- pseudo (AC3) -----------------------------------------------------------------------------------------------
if [ "$RUN_pseudo" -eq 1 ]; then
CASE=pseudo
[ -e "$WEB/next-env.d.ts" ] || HAD_ENVD=0
[ -e "$ROOT/.bridle/playwright" ] || HAD_PW=0
STATE="$(tree_state)" || fail "cannot read the state of the tree"
PSEUDO_RAN=1
t0="$(date +%s)"
run_in "$ROOT" env NEXT_PUBLIC_LOCALE=en-XA pnpm --filter web build
t1="$(date +%s)"
[ "$RC" -eq 0 ] || fail "NEXT_PUBLIC_LOCALE=en-XA pnpm --filter web build: exit $RC" "$OUT"
P1="$(free_port)" || fail "node gave no free loopback port"
PORTS="$PORTS $P1"
start_web "$P1"   # without the variable: the locale is the build's
ct="$(grep -i '^content-type:' "$tmp/h" | sed -n '1p' | sed 's/^[^:]*: *//')"
body="$(cat "$tmp/b")"
[ "$ct" = "application/json" ] && [ "$body" = "$HEALTH_BODY" ] && [ "$(wc -c < "$tmp/b" | tr -d ' ')" -eq "${#HEALTH_BODY}" ] \
  || fail "GET /api/v1/health of the en-XA build is not fixture H byte for byte ($HEALTH_BODY, application/json): the locale reached the API" "$ct: $body"
http_get "http://127.0.0.1:$P1/"
[ "$CODE" = "200" ] || fail "GET / of the en-XA build: $CODE" "$(cat "$tmp/b")"
grep -q -F -- '<html lang="en-XA"' "$tmp/b" || fail "GET / of the en-XA build, served without the variable, has no <html lang=\"en-XA\">: the locale is not fixed at build time" "$(cut -c 1-300 "$tmp/b")"
grep -q -F -- "<h1>$NAME_XA</h1>" "$tmp/b" || fail "GET / of the en-XA build has no <h1>$NAME_XA</h1>" "$(cat "$tmp/b")"
grep -q -F -- "<p data-testid=\"notice\">$NOTICE_XA</p>" "$tmp/b" || fail "GET / of the en-XA build does not show the notice of fixture C2, from '[' to ']'" "$(cat "$tmp/b")"
grep -q -F -- "<title>$NAME_XA</title>" "$tmp/b" || fail "GET / of the en-XA build has no <title>$NAME_XA</title>" "$(cat "$tmp/b")"
for english in "$NOTICE" 'Educational use only' "<h1>$NAME</h1>" "<title>$NAME</title>"; do
  grep -q -F -- "$english" "$tmp/b" && fail "GET / of the en-XA build still shows English: '$english'" "$(cat "$tmp/b")"
done
echo "# NEXT_PUBLIC_LOCALE=en-XA pnpm --filter web build: exit 0 in $((t1 - t0)) s; pnpm --filter web start --port $P1 without the variable: lang=\"en-XA\", <title> and <h1> $NAME_XA, the notice of C2, no English; health = fixture H ($body)"

rm -f "$PNG"
run_in "$ROOT" env NEXT_PUBLIC_LOCALE=en-XA PORT="$P1" pnpm e2e:smoke
[ "$RC" -eq 0 ] || fail "NEXT_PUBLIC_LOCALE=en-XA PORT=$P1 pnpm e2e:smoke against the en-XA server: exit $RC" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^ +7 passed' || fail "the pseudo-locale smoke against the en-XA server did not print '7 passed'" "$OUT"
PASS_LINE="$(printf '%s\n' "$OUT" | grep -E '^ +7 passed' | sed 's/^ *//')"
[ "$(listeners "$P1" | sed -n '1p')" = "$SRV_LISTENER" ] || fail "after the smoke, pid $SRV_LISTENER no longer listens on $P1: the en-XA server was not the one tested" "$OUT"
[ -f "$PNG" ] || fail "the pseudo-locale smoke wrote no .bridle/screenshots/smoke-home-en-XA.png"
sig="$(od -An -tx1 -N4 "$PNG" | tr -d ' \n')"
PNG_BYTES="$(wc -c < "$PNG" | tr -d ' ')"
[ "$sig" = "89504e47" ] && [ "$PNG_BYTES" -gt 1000 ] || fail "smoke-home-en-XA.png is not a PNG over 1,000 bytes (first bytes '$sig', $PNG_BYTES bytes)"
(cd "$ROOT" && git check-ignore -q .bridle/screenshots/smoke-home-en-XA.png) || fail ".bridle/screenshots/smoke-home-en-XA.png is not gitignored"
run_in "$ROOT" env PORT="$P1" pnpm e2e:smoke
[ "$RC" -ne 0 ] || fail "PORT=$P1 pnpm e2e:smoke without NEXT_PUBLIC_LOCALE exits 0 against the en-XA server: the smoke does not assert the strings of its locale" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^ +7 passed' && fail "the smoke printed '7 passed' in en against the en-XA server" "$OUT"
printf '%s\n' "$OUT" | grep -q -F 'en-XA' || fail "the failed en smoke does not name the locale it received (en-XA): it failed for another reason" "$OUT"
NEG_LINE="$(printf '%s\n' "$OUT" | grep -E '^ +[0-9]+ failed' | sed -n '1p' | sed 's/^ *//')"
NEG_RC="$RC"
stop_web
echo "# against it: NEXT_PUBLIC_LOCALE=en-XA PORT=$P1 pnpm e2e:smoke: exit 0, '$PASS_LINE', pid $SRV_LISTENER still listening, smoke-home-en-XA.png $PNG_BYTES bytes, gitignored; without the variable: exit $NEG_RC, '$NEG_LINE', names en-XA"

P2="$(free_port)" || fail "node gave no free loopback port"
PORTS="$PORTS $P2"
rm -f "$PNG"
run_in "$ROOT" env NEXT_PUBLIC_LOCALE=en-XA PORT="$P2" pnpm e2e:smoke
[ "$RC" -eq 0 ] || fail "NEXT_PUBLIC_LOCALE=en-XA PORT=$P2 pnpm e2e:smoke with no server running: exit $RC (the server Playwright starts must inherit the variable)" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^ +7 passed' || fail "the pseudo-locale smoke that starts its own server did not print '7 passed'" "$OUT"
[ -f "$PNG" ] || fail "the start path wrote no .bridle/screenshots/smoke-home-en-XA.png"
START_LINE="$(printf '%s\n' "$OUT" | grep -E '^ +7 passed' | sed 's/^ *//')"
i=0
while [ -n "$(listeners "$P2")" ]; do
  i=$((i + 1))
  [ "$i" -lt 10 ] || fail "5 s after the smoke, something still listens on port $P2 (pid $(listeners "$P2" | tr '\n' ' ')): Playwright left its server running" "$OUT"
  sleep 0.5
done
run_in "$ROOT" env NEXT_PUBLIC_LOCALE=fr pnpm --filter web build
[ "$RC" -ne 0 ] || fail "NEXT_PUBLIC_LOCALE=fr pnpm --filter web build exits 0: an unknown locale must fail the build" "$OUT"
printf '%s\n' "$OUT" | grep -q -F 'unknown locale "fr"' || fail "the failed fr build does not say 'unknown locale \"fr\"'" "$OUT"
FR_RC="$RC"
rm -rf "$WEB/.next"
same_tree "$STATE" "the pseudo-locale builds and smoke runs"
echo "# start path: NEXT_PUBLIC_LOCALE=en-XA PORT=$P2 pnpm e2e:smoke: exit 0, '$START_LINE', nothing listens on $P2 afterwards; NEXT_PUBLIC_LOCALE=fr build: exit $FR_RC, 'unknown locale \"fr\"'; apps/web/.next removed, tree unchanged"
echo "ok - pseudo"
fi
stop_web

# ---- docs (AC4) -------------------------------------------------------------------------------------------------
if [ "$RUN_docs" -eq 1 ]; then
CASE=docs
UX="$ROOT/docs/ux/ux-spec.md"
[ -f "$UX" ] || fail "docs/ux/ux-spec.md does not exist"
got="$(shasum -a 256 "$UX" | cut -d' ' -f1)"
[ "$got" = "$UX_SHA" ] || fail "docs/ux/ux-spec.md changed: its sha256 is $got, fixture U says $UX_SHA"
(cd "$ROOT" && git diff --quiet "$BASE" -- docs/ux) || fail "docs/ux differs from $BASE" "$(cd "$ROOT" && git diff --stat "$BASE" -- docs/ux)"
new="$(cd "$ROOT" && git ls-files --others --exclude-standard -- docs/ux)"
[ -z "$new" ] || fail "docs/ux holds a new file" "$new"
DOC="$ROOT/docs/ops/i18n.md"
[ -f "$DOC" ] || fail "docs/ops/i18n.md does not exist"
nneedles=0
while IFS= read -r needle; do
  [ -n "$needle" ] || continue
  grep -q -F -- "$needle" "$DOC" || fail "docs/ops/i18n.md does not name '$needle'"
  nneedles=$((nneedles + 1))
done <<'EOF'
I18N-01
packages/i18n/messages/en.json
en-XA
pnpm i18n:pseudo
t("
NEXT_PUBLIC_LOCALE
packages/i18n/lint/lint-strings.mjs
pnpm lint
`jsx-text`
`jsx-expression`
`jsx-constant`
`jsx-attribute`
`property`
`prose`
apps/web/i18n-allowlist.json
"reason"
stale
tools/test/i18n.test.sh
EOF
grep -q -E '^## The string lint$' "$DOC" && grep -q -E '^## The allowlist$' "$DOC" \
  || fail "docs/ops/i18n.md has no '## The string lint' and '## The allowlist' sections (it must explain the rule and the allowlist)"
grep -q -F '](docs/ops/i18n.md)' "$ROOT/README.md" || fail "README.md does not link docs/ops/i18n.md"
# What three documents say of this file holds for it.
SELF="$ROOT/tools/test/i18n.test.sh"
sed -n '2p' "$SELF" | grep -q -F 'card P0-02.6' || fail "the second line of tools/test/i18n.test.sh does not name card P0-02.6 (README.md, the tools/test label)"
grep -F 'tools/test/i18n.test.sh' "$DOC" | grep -q -F 'by hand: it builds `apps/web` and starts servers and a browser' \
  || fail "docs/ops/i18n.md no longer says this file is run by hand because it builds apps/web and starts servers and a browser"
[ "$(grep -c -E '^# .*nvm use [0-9]+ ' "$SELF")" -eq 1 ] || fail "the header of tools/test/i18n.test.sh does not have exactly one 'nvm use <major>' line"
TC="$ROOT/docs/ops/toolchain.md"
awk '/^## Bumping a pin/ { s = 1; next } s && /^## / { exit } s && /^2\. / { t = 1 } s && /^3\. / { t = 0 } t' "$TC" > "$tmp/step2"
grep -q -F 'nvm use' "$tmp/step2" && grep -q -F '`tools/test/i18n.test.sh`' "$tmp/step2" \
  || fail "step 2 of 'Bumping a pin' in docs/ops/toolchain.md does not name tools/test/i18n.test.sh, whose header types the node major in its 'nvm use' line"
LD="$ROOT/docs/ops/local-dev.md"
for needle in 'NEXT_PUBLIC_LOCALE=en-XA pnpm --filter web build' 'NEXT_PUBLIC_LOCALE=en-XA pnpm e2e:smoke' 'smoke-home-en-XA.png' 'bash tools/test/i18n.test.sh' '(i18n.md)'; do
  grep -q -F -- "$needle" "$LD" || fail "docs/ops/local-dev.md does not name '$needle'"
done
echo "# docs/ux/ux-spec.md = fixture U, docs/ux as $BASE left it; docs/ops/i18n.md names the $nneedles strings and has the lint and allowlist sections; README.md links it; local-dev.md and step 2 of 'Bumping a pin' name this file as its header has it"
echo "ok - docs"
fi
exit 0
