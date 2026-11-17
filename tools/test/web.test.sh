#!/usr/bin/env bash
# Tests for the Next.js application and pnpm e2e:smoke (card P0-02.5): one case per acceptance criterion. Card
# PX-02.1 (the app shell) replaced the case `plain`, which held that apps/web had no stylesheet, component or shell,
# with the case `shell`, and moved fixture F, the count of smoke tests and the case list with it. Card PX-02.2 (the
# 3D viewport) moved fixture F and the count of smoke tests (5) again, added the dependency on @bridle/model to the
# case `shell`, and made the file lists leave out a file that is deleted in the tree but still in git's index.
# Card PX-02.3 (the model store) moved fixture F again; the count of smoke tests stayed 5.
#   app    AC1  the files of apps/web a clone holds are exactly fixture F; next is 15.x and react, react-dom 19.x in
#               apps/web/package.json and as installed (`pnpm ls --filter web --depth 0 --json`); src/app exists and
#               there is no `pages` directory (the App Router); tsconfig.json extends the base, the base is strict
#               and `tsc --showConfig` resolves strict = true; `pnpm --filter web typecheck` exits 0; turbo's dry
#               run lists web#typecheck; the root `lint` script is `biome ci . && node
#               packages/i18n/lint/lint-strings.mjs` (the string lint since card P0-02.6), tools/check.sh runs
#               `pnpm lint` and `pnpm typecheck`, and `pnpm exec biome ci apps/web` exits 0 having checked at
#               least 7 files;
#               `pnpm --filter web build` exits 0 with `ƒ /` and `ƒ /api/v1/health`; `pnpm --filter web dev
#               --hostname 127.0.0.1 --port <free>` answers fixture H within 60 s (200, content-type
#               application/json, the body byte for byte) and `GET /` is 200 with `<h1>Bridle</h1>`, the sha in
#               its paragraph and fixture N; the build and the dev run leave the tree as it was; in a `mktemp -d`
#               copy of the clone's files, after `pnpm install --frozen-lockfile`, a type error appended to
#               apps/web/src/sha.ts stops `pnpm check` at `check: 2/7 typecheck FAILED` (after 1/7 lint ok, naming
#               sha.ts) and a format error in apps/web/src/app/page.tsx at `check: 1/7 lint FAILED` (no 2/7 line)
#   smoke  AC2  playwright.config.ts (at the root, the only one) and e2e/smoke.spec.ts exist; the `e2e:smoke` script
#               is `playwright test`; devDependencies["@playwright/test"] equals tools.playwright.version of
#               tools/toolchain.json and `pnpm exec playwright --version` prints it; `playwright test --list` ends
#               `Total: 5 tests in 1 file` with five test lines, each `[chromium]`; the config names no firefox or
#               webkit and one project; the spec requests /api/v1/health and navigates to / (ruling 7) and to /workspace; it reads
#               its strings from packages/i18n/messages by NEXT_PUBLIC_LOCALE and holds no copy of fixture N, and
#               `home.notice` of packages/i18n/messages/en.json equals fixture N (card P0-02.6). Against
#               the running dev server, screenshot removed: `PORT=<its port> pnpm e2e:smoke` exits 0 with
#               `5 passed`, the same pid still listens (the reuse path), the PNG exists (signature 89 50 4e 47,
#               over 1,000 bytes), `git check-ignore` accepts it and .bridle/playwright/. Server stopped,
#               screenshot removed: `PORT=<another free port> pnpm e2e:smoke` exits 0 with `5 passed` (the start
#               path), the PNG exists, nothing listens on that port afterwards. A dev server started with
#               GIT_SHA=feedbee answers `{"ok":true,"sha":"feedbee"}`, and the smoke run without that variable
#               exits non-zero against it, naming feedbee (the sha is asserted, not echoed). The tree is as it was
#   shell  PX-02.1  every dependency of apps/web is an exact version or `workspace:*`, and three,
#               @react-three/fiber, @react-three/drei and zustand are among them, and @bridle/model is
#               `workspace:*` (card PX-02.2); apps/web/src/styles/tokens.css is
#               byte for byte docs/ux/tokens.css and `pnpm --filter web test` exits 0; apps/web/src/components
#               exists; the HTML of `/` links a stylesheet and has one <header, one <nav with links to /workspace
#               and /tasks, and one <main> that starts with the h1 and the two paragraphs, byte for byte, and
#               holds a link to /workspace; `/workspace` is 200 with the <nav, its /workspace link marked
#               aria-current="page", the viewport area and the side panel area; `/tasks` is 200 with the <nav, its
#               /tasks link marked aria-current="page", and the coming-soon state
#   docs   AC4  docs/ops/local-dev.md has `## Web application and the smoke test` before "Other local ports", naming
#               the commands, routes, variables, files and pins of the plan's list; the port table has a 3000 row
#               naming playwright.config.ts; the file no longer says "P0-02.5 puts the Next.js server behind"
# Fixtures (literal, from the card's Plan): N the notice, H the health body, F the files of apps/web.
#
# Run:  bash tools/test/web.test.sh            (from any directory; the script finds the repository from its own path)
#       bash tools/test/web.test.sh docs shell  (only the named cases, in the order app, smoke, shell, docs)
# In a shell that predates the toolchain:
#   . "$HOME/.cargo/env"; . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null; bash tools/test/web.test.sh
# Never wire this file into `pnpm test`: it starts servers and a browser, builds apps/web and runs `pnpm check` in a
# copy. Prints `ok - <case>` per case (and `# ...` comment lines with the measured lines); stops at the first failed
# assertion with `not ok - <case>: <why>` and the command's output on stderr, exit 1. Needs bash 3.2, node and pnpm
# at the pins of tools/toolchain.json, cargo (for `pnpm check` in the copy), git, curl, lsof, pgrep, tar, awk, grep,
# sed, od, cmp, shasum, mktemp, and the Chromium build of `npx playwright@<pin> install chromium`.
# Ports: every server listens on a free loopback port taken from node, never 3000. The test refuses to start while
# http://127.0.0.1:3000/api/v1/health answers 200 (a dev server of this checkout is running there and the build
# would break it: the two write apps/web/.next). GIT_SHA, PORT and NEXT_PUBLIC_LOCALE of the calling shell are
# unset first, so the cases run in the `en` locale.
# Writes: apps/web/.next and apps/web/next-env.d.ts (the build and the dev server), .bridle/screenshots/ and
# .bridle/playwright/ (the smoke), all gitignored; the copy and the logs live in `mktemp -d`. An EXIT trap stops
# the servers it started (by pid, and whatever listens on a port it took) and removes the directory.
# Takes about a minute.
set -u
set -o pipefail
export DO_NOT_TRACK=1 # turbo: no telemetry and no first-run banner
export NEXT_TELEMETRY_DISABLED=1
unset GIT_SHA PORT NEXT_PUBLIC_LOCALE

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB="$ROOT/apps/web"
PINS="$ROOT/tools/toolchain.json"
DOC="$ROOT/docs/ops/local-dev.md"
PNG="$ROOT/.bridle/screenshots/smoke-home.png"
CASE=setup

# Fixture N, the notice (literal).
NOTICE='Educational use only. Not for construction, permitting, or professional engineering use. Results are not a substitute for analysis and design by a licensed engineer.'
# Fixture F, the files of apps/web a clone holds (literal; sorted as `LC_ALL=C sort` sorts them).
FIXTURE_F='apps/web/biome.json
apps/web/i18n-allowlist.json
apps/web/next.config.mjs
apps/web/package.json
apps/web/src/app/api/v1/health/route.ts
apps/web/src/app/layout.tsx
apps/web/src/app/page.module.css
apps/web/src/app/page.tsx
apps/web/src/app/tasks/page.module.css
apps/web/src/app/tasks/page.tsx
apps/web/src/app/workspace/page.module.css
apps/web/src/app/workspace/page.tsx
apps/web/src/components/model/commands.test.ts
apps/web/src/components/model/commands.ts
apps/web/src/components/model/history.test.ts
apps/web/src/components/model/history.ts
apps/web/src/components/model/issueMessages.ts
apps/web/src/components/model/modelStore.test.ts
apps/web/src/components/model/modelStore.ts
apps/web/src/components/model/shortcuts.test.ts
apps/web/src/components/model/shortcuts.ts
apps/web/src/components/shell/NavLinks.tsx
apps/web/src/components/shell/TopBar.module.css
apps/web/src/components/shell/TopBar.tsx
apps/web/src/components/viewport/ModelScene.tsx
apps/web/src/components/viewport/Viewport.module.css
apps/web/src/components/viewport/Viewport.tsx
apps/web/src/components/viewport/ViewportCanvas.tsx
apps/web/src/components/viewport/camera.ts
apps/web/src/components/viewport/scene.test.ts
apps/web/src/components/viewport/scene.ts
apps/web/src/components/viewport/viewportStore.ts
apps/web/src/components/workspace/HistoryControls.tsx
apps/web/src/components/workspace/SidePanel.tsx
apps/web/src/components/workspace/WorkspaceView.module.css
apps/web/src/components/workspace/WorkspaceView.tsx
apps/web/src/css.d.ts
apps/web/src/i18n.ts
apps/web/src/sha.ts
apps/web/src/styles/global.css
apps/web/src/styles/tokens.css
apps/web/src/styles/tokens.test.mjs
apps/web/tsconfig.json
apps/web/vitest.config.ts'

tmp=""
WRAPPERS=""   # pids of the `pnpm --filter web dev` commands this test started
PORTS=""      # every port this test took from node
DEV_PORT=""   # the port of the running dev server, empty when none runs

listeners() {  # $1 = port: the pids listening on it, one per line (nothing when none)
  lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}
kill_tree() {  # $1 = pid: TERM to it and to every descendant, children first
  local child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do kill_tree "$child"; done
  kill "$1" 2>/dev/null || true
}
cleanup() {  # stops what this test started and waits (up to 5 s, then KILL) until its ports are free again
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
RUN_app=0; RUN_smoke=0; RUN_shell=0; RUN_docs=0
if [ "$#" -eq 0 ]; then
  RUN_app=1; RUN_smoke=1; RUN_shell=1; RUN_docs=1
else
  for a in "$@"; do
    case "$a" in
      app) RUN_app=1 ;;
      smoke) RUN_smoke=1 ;;
      shell) RUN_shell=1 ;;
      docs) RUN_docs=1 ;;
      *) echo "usage: web.test.sh [app] [smoke] [shell] [docs]" >&2; exit 2 ;;
    esac
  done
fi

# ---- preflight --------------------------------------------------------------------------------------------------
[ -f "$PINS" ] || fail "$PINS not found"
for t in node pnpm cargo git curl lsof pgrep tar awk grep sed od cmp shasum mktemp; do
  command -v "$t" >/dev/null 2>&1 || fail "$t is not on PATH (the pinned tools must be on PATH; see the header)"
done
tmp="$(mktemp -d)" || fail "mktemp -d failed"
code3000="$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/v1/health 2>/dev/null || true)"
[ "$code3000" != "200" ] \
  || fail "http://127.0.0.1:3000/api/v1/health answers 200: a dev server of this checkout is running and the build would break it (both write apps/web/.next); stop it first"
SHA="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null)" || fail "git rev-parse --short HEAD failed in $ROOT"
HEALTH_BODY="{\"ok\":true,\"sha\":\"$SHA\"}"   # fixture H
MAIN_HTML="<h1>Bridle</h1><p data-testid=\"sha\">$SHA</p><p data-testid=\"notice\">$NOTICE</p>"

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
existing() {  # stdin: paths relative to the root, NUL-separated; stdout: those that exist, NUL-separated. A file
              # deleted in the tree but still in git's index (a deletion not committed yet) is left out.
  (cd "$ROOT" && xargs -0 sh -c 'for f in "$@"; do if [ -e "$f" ] || [ -L "$f" ]; then printf "%s\0" "$f"; fi; done' sh)
}
clone_files() {  # $1.. = paths: the files of them a clone holds once the card is committed, sorted
  (cd "$ROOT" && git ls-files -z --cached --others --exclude-standard -- "$@" | existing | tr '\0' '\n' | LC_ALL=C sort)
}
tree_state() {  # git's view of the tree, and the bytes of the files Next, pnpm or Playwright could rewrite
  (cd "$ROOT" && git status --porcelain \
     && git ls-files -z --cached --others --exclude-standard -- apps/web e2e playwright.config.ts package.json \
          pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore | existing | xargs -0 shasum -a 256)
}
same_tree() {  # $1 = state before, $2 = what ran: fails when the tree changed
  local now
  now="$(tree_state)"
  [ "$now" = "$1" ] || fail "$2 changed the tree (git status --porcelain or the bytes of a tracked or new file)" \
    "$(printf '%s\n' "$1" > "$tmp/state.before"; printf '%s\n' "$now" > "$tmp/state.after"; diff "$tmp/state.before" "$tmp/state.after")"
}
free_port() {  # prints a free loopback port from node, never 3000; records it in PORTS
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
start_dev() {  # $1 = port, $2 = GIT_SHA for the server (optional): starts the dev server, waits up to 60 s for
               # the health route to answer 200; sets DEV_PORT, DEV_PID (the wrapper), DEV_LISTENER, DEV_WAIT
  local port="$1" i=0
  DEV_LOG="$tmp/dev-$port.log"
  [ -z "$(listeners "$port")" ] || fail "port $port is already taken"
  if [ -n "${2-}" ]; then
    (cd "$ROOT" && GIT_SHA="$2" exec pnpm --filter web dev --hostname 127.0.0.1 --port "$port") > "$DEV_LOG" 2>&1 &
  else
    (cd "$ROOT" && exec pnpm --filter web dev --hostname 127.0.0.1 --port "$port") > "$DEV_LOG" 2>&1 &
  fi
  DEV_PID=$!
  WRAPPERS="$WRAPPERS $DEV_PID"
  DEV_PORT="$port"
  while :; do
    http_get "http://127.0.0.1:$port/api/v1/health"
    [ "$CODE" = "200" ] && break
    kill -0 "$DEV_PID" 2>/dev/null \
      || fail "pnpm --filter web dev --hostname 127.0.0.1 --port $port exited before it answered" "$(cat "$DEV_LOG")"
    i=$((i + 1))
    [ "$i" -lt 120 ] \
      || fail "pnpm --filter web dev --hostname 127.0.0.1 --port $port: /api/v1/health did not answer 200 within 60 s (last code $CODE)" "$(cat "$DEV_LOG")"
    sleep 0.5
  done
  DEV_WAIT="$(awk -v n="$i" 'BEGIN { printf "%.1f", n / 2 }')"
  DEV_LISTENER="$(listeners "$port" | sed -n '1p')"
  [ -n "$DEV_LISTENER" ] || fail "the dev server answers on $port but lsof shows no listener there"
}
stop_dev() {  # stops the running dev server and waits until nothing listens on its port
  local i=0 pid
  [ -n "$DEV_PORT" ] || return 0
  kill_tree "$DEV_PID"
  while [ -n "$(listeners "$DEV_PORT")" ]; do
    i=$((i + 1))
    if [ "$i" -eq 10 ]; then for pid in $(listeners "$DEV_PORT"); do kill "$pid" 2>/dev/null || true; done; fi
    if [ "$i" -eq 20 ]; then for pid in $(listeners "$DEV_PORT"); do kill -9 "$pid" 2>/dev/null || true; done; fi
    [ "$i" -lt 30 ] || fail "the dev server on port $DEV_PORT did not stop within 15 s" "$(listeners "$DEV_PORT")"
    sleep 0.5
  done
  wait "$DEV_PID" 2>/dev/null || true
  DEV_PORT=""
}
ensure_dev() {  # a dev server of this test is running (started without GIT_SHA): starts one when none is
  local p
  [ -n "$DEV_PORT" ] && return 0
  p="$(free_port)" || fail "node gave no free loopback port"
  PORTS="$PORTS $p"
  start_dev "$p"
}
png_ok() {  # the screenshot exists, is a PNG and is over 1,000 bytes; sets PNG_BYTES
  local sig
  [ -f "$PNG" ] || fail "$1: .bridle/screenshots/smoke-home.png does not exist"
  sig="$(od -An -tx1 -N4 "$PNG" | tr -d ' \n')"
  [ "$sig" = "89504e47" ] || fail "$1: the screenshot's first four bytes are '$sig', not 89 50 4e 47 (PNG)"
  PNG_BYTES="$(wc -c < "$PNG" | tr -d ' ')"
  [ "$PNG_BYTES" -gt 1000 ] || fail "$1: the screenshot is $PNG_BYTES bytes, expected over 1,000"
}

# ---- app (AC1) --------------------------------------------------------------------------------------------------
if [ "$RUN_app" -eq 1 ]; then
CASE=app
got="$(clone_files apps/web)"
[ "$got" = "$FIXTURE_F" ] || fail "the files of apps/web a clone holds are not fixture F" \
  "$(printf '%s\n' "$FIXTURE_F" > "$tmp/f.want"; printf '%s\n' "$got" > "$tmp/f.got"; diff "$tmp/f.want" "$tmp/f.got")"
PKG="$WEB/package.json"
for d in next:15 react:19 react-dom:19; do
  name="${d%%:*}"; major="${d##*:}"
  v="$(json "$PKG" "j.dependencies['$name']")" || fail "cannot read dependencies.$name of apps/web/package.json"
  printf '%s\n' "$v" | grep -q -E "^$major\.[0-9]+\.[0-9]+$" \
    || fail "apps/web/package.json: dependencies.$name is '$v', expected an exact $major.x.y"
done
run_in "$ROOT" pnpm ls --filter web --depth 0 --json
[ "$RC" -eq 0 ] || fail "pnpm ls --filter web --depth 0 --json: exit $RC" "$OUT"
printf '%s\n' "$OUT" > "$tmp/ls.json"
INSTALLED=""
for d in next:15 react:19 react-dom:19; do
  name="${d%%:*}"; major="${d##*:}"
  v="$(json "$tmp/ls.json" "j.length === 1 && j[0].name === 'web' ? j[0].dependencies['$name'].version : 'not listed'" 2>/dev/null)" \
    || fail "pnpm ls --filter web does not list $name under web's dependencies" "$OUT"
  printf '%s\n' "$v" | grep -q -E "^$major\.[0-9]+\.[0-9]+$" || fail "installed $name is '$v', expected $major.x.y"
  [ "$v" = "$(json "$PKG" "j.dependencies['$name']")" ] || fail "installed $name is $v, apps/web/package.json pins another version"
  INSTALLED="$INSTALLED $name $v"
done
[ -d "$WEB/src/app" ] || fail "apps/web/src/app does not exist (the App Router)"
for d in pages src/pages; do
  [ ! -e "$WEB/$d" ] || fail "apps/web/$d exists: the App Router only, no pages directory"
done
[ "$(json "$WEB/tsconfig.json" 'j.extends')" = "../../tsconfig.base.json" ] \
  || fail "apps/web/tsconfig.json does not extend ../../tsconfig.base.json"
[ "$(json "$ROOT/tsconfig.base.json" 'j.compilerOptions.strict')" = "true" ] || fail "tsconfig.base.json is not strict"
run_in "$ROOT" pnpm --filter web exec tsc --showConfig -p tsconfig.json
[ "$RC" -eq 0 ] || fail "pnpm --filter web exec tsc --showConfig: exit $RC" "$OUT"
printf '%s\n' "$OUT" > "$tmp/tsconfig.json"
[ "$(json "$tmp/tsconfig.json" 'j.compilerOptions.strict')" = "true" ] \
  || fail "apps/web's resolved TypeScript configuration is not strict (tsc --showConfig)" "$OUT"
echo "# apps/web: fixture F ($(printf '%s\n' "$FIXTURE_F" | grep -c .) files); installed:$INSTALLED; src/app, no pages directory; tsconfig extends the base, strict = true resolved"

run_in "$ROOT" pnpm --filter web typecheck
[ "$RC" -eq 0 ] || fail "pnpm --filter web typecheck: exit $RC" "$OUT"
run_in "$ROOT" pnpm exec turbo run typecheck --dry=json
[ "$RC" -eq 0 ] || fail "pnpm exec turbo run typecheck --dry=json: exit $RC" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '"taskId": *"web#typecheck"' || fail "turbo's dry run of typecheck does not list web#typecheck" "$OUT"
[ "$(json "$ROOT/package.json" 'j.scripts.lint')" = "biome ci . && node packages/i18n/lint/lint-strings.mjs" ] \
  || fail "the root lint script is not 'biome ci . && node packages/i18n/lint/lint-strings.mjs'"
[ "$(json "$ROOT/package.json" 'j.scripts.typecheck')" = "turbo run typecheck" ] || fail "the root typecheck script is not 'turbo run typecheck'"
grep -q -E '^run_step 1 lint pnpm lint$' "$ROOT/tools/check.sh" || fail "tools/check.sh does not run 'pnpm lint' as step 1"
grep -q -E '^run_step 2 typecheck pnpm typecheck$' "$ROOT/tools/check.sh" || fail "tools/check.sh does not run 'pnpm typecheck' as step 2"
run_in "$ROOT" pnpm exec biome ci apps/web
[ "$RC" -eq 0 ] || fail "pnpm exec biome ci apps/web: exit $RC" "$OUT"
nchecked="$(printf '%s\n' "$OUT" | sed -n 's/^Checked \([0-9][0-9]*\) files\{0,1\} in .*/\1/p' | sed -n '1p')"
[ -n "$nchecked" ] || fail "biome ci apps/web printed no 'Checked <n> files' line" "$OUT"
[ "$nchecked" -ge 7 ] || fail "biome ci apps/web checked $nchecked files, expected at least 7" "$OUT"
echo "# pnpm --filter web typecheck: exit 0; turbo dry run lists web#typecheck; biome ci apps/web: exit 0, $nchecked files"

STATE="$(tree_state)" || fail "cannot read the state of the tree"
t0="$(date +%s)"
run_in "$ROOT" pnpm --filter web build
t1="$(date +%s)"
[ "$RC" -eq 0 ] || fail "pnpm --filter web build: exit $RC" "$OUT"
printf '%s\n' "$OUT" | grep -q -E 'ƒ / +[0-9]' || fail "the build's route table has no dynamic 'ƒ /' line" "$OUT"
printf '%s\n' "$OUT" | grep -q -E 'ƒ /api/v1/health +[0-9]' || fail "the build's route table has no dynamic 'ƒ /api/v1/health' line" "$OUT"
same_tree "$STATE" "pnpm --filter web build"
echo "# pnpm --filter web build: exit 0 in $((t1 - t0)) s; $(printf '%s\n' "$OUT" | grep -E 'ƒ /( |api/v1/health )' | sed 's/  */ /g' | tr '\n' ';') tree unchanged"

ensure_dev
[ "$CODE" = "200" ] || fail "GET /api/v1/health: $CODE"
ct="$(grep -i '^content-type:' "$tmp/h" | sed -n '1p' | sed 's/^[^:]*: *//')"
[ "$ct" = "application/json" ] || fail "GET /api/v1/health: content-type is '$ct', fixture H says application/json" "$(cat "$tmp/h")"
body="$(cat "$tmp/b")"
[ "$body" = "$HEALTH_BODY" ] || fail "GET /api/v1/health: the body is not fixture H ($HEALTH_BODY)" "$body"
[ "$(wc -c < "$tmp/b" | tr -d ' ')" -eq "${#HEALTH_BODY}" ] || fail "GET /api/v1/health: the body has bytes beyond fixture H" "$(od -c "$tmp/b")"
http_get "http://127.0.0.1:$DEV_PORT/"
[ "$CODE" = "200" ] || fail "GET /: $CODE" "$(cat "$tmp/b")"
grep -q -F -- '<h1>Bridle</h1>' "$tmp/b" || fail "GET /: the HTML has no <h1>Bridle</h1>" "$(cat "$tmp/b")"
grep -q -F -- "<p data-testid=\"sha\">$SHA</p>" "$tmp/b" || fail "GET /: the HTML does not show the git sha $SHA in its paragraph" "$(cat "$tmp/b")"
grep -q -F -- "$NOTICE" "$tmp/b" || fail "GET /: the HTML does not hold the educational-use notice (fixture N)" "$(cat "$tmp/b")"
same_tree "$STATE" "pnpm --filter web dev"
echo "# pnpm --filter web dev --hostname 127.0.0.1 --port $DEV_PORT: fixture H after $DEV_WAIT s ($body, application/json); GET / 200 with the h1, $SHA and fixture N; tree unchanged"

# The two fail-fast proofs, in a copy of what a clone holds.
COPY="$tmp/clone"
mkdir -p "$COPY" || fail "cannot create $COPY"
(cd "$ROOT" && git ls-files -z --cached --others --exclude-standard | existing | tar --null -T - -cf - | tar -C "$COPY" -xf -) \
  || fail "copying the tracked and untracked-not-ignored files into $COPY failed"
run_in "$COPY" pnpm install --frozen-lockfile
[ "$RC" -eq 0 ] || fail "pnpm install --frozen-lockfile in the copy: exit $RC" "$OUT"
cmp -s "$ROOT/pnpm-lock.yaml" "$COPY/pnpm-lock.yaml" || fail "pnpm install --frozen-lockfile rewrote pnpm-lock.yaml in the copy" "$OUT"
steps_of() {  # $1 = check output: its step lines as "<n>/7 <name> <ok|FAILED>|..." in order
  printf '%s\n' "$1" | awk '/^check: [0-9]+\/[0-9]+ [a-z-]+ (ok|FAILED)/ { printf "%s %s %s|", $2, $3, $4 }'
}
printf '\nexport const typeError: number = "not a number";\n' >> "$COPY/apps/web/src/sha.ts"
run_in "$COPY" pnpm check
[ "$RC" -ne 0 ] || fail "in the copy, pnpm check exits 0 with a type error in apps/web/src/sha.ts: the web typecheck is not part of pnpm check" "$OUT"
[ "$(steps_of "$OUT")" = "1/7 lint ok|2/7 typecheck FAILED|" ] \
  || fail "in the copy, a type error in apps/web/src/sha.ts: the step lines are '$(steps_of "$OUT")', expected '1/7 lint ok|2/7 typecheck FAILED|'" "$OUT"
TC_LINE="$(printf '%s\n' "$OUT" | grep '^check: ' | tail -n 1)"
case "$TC_LINE" in 'check: 2/7 typecheck FAILED (exit '*) ;; *) fail "the last check line is '$TC_LINE', expected 'check: 2/7 typecheck FAILED (exit <code>) ...'" "$OUT" ;; esac
printf '%s\n' "$OUT" | grep -q -F 'sha.ts' || fail "the failed typecheck does not name sha.ts" "$OUT"
cp "$WEB/src/sha.ts" "$COPY/apps/web/src/sha.ts" || fail "cannot restore sha.ts in the copy"
printf 'export   const   badlyFormatted   =   1 ;\n' >> "$COPY/apps/web/src/app/page.tsx"
run_in "$COPY" pnpm check
[ "$RC" -ne 0 ] || fail "in the copy, pnpm check exits 0 with a format error in apps/web/src/app/page.tsx: apps/web is not linted by pnpm check" "$OUT"
[ "$(steps_of "$OUT")" = "1/7 lint FAILED|" ] \
  || fail "in the copy, a format error in apps/web/src/app/page.tsx: the step lines are '$(steps_of "$OUT")', expected '1/7 lint FAILED|'" "$OUT"
LINT_LINE="$(printf '%s\n' "$OUT" | grep '^check: ' | tail -n 1)"
case "$LINT_LINE" in 'check: 1/7 lint FAILED (exit '*) ;; *) fail "the last check line is '$LINT_LINE', expected 'check: 1/7 lint FAILED (exit <code>) ...'" "$OUT" ;; esac
printf '%s\n' "$OUT" | grep -q -F 'apps/web/src/app/page.tsx' || fail "the failed lint does not name apps/web/src/app/page.tsx" "$OUT"
echo "# copy of the clone's files, pnpm install --frozen-lockfile exit 0: type error in sha.ts -> '$TC_LINE'; format error in page.tsx -> '$LINT_LINE'"
echo "ok - app"
fi

# ---- smoke (AC2) ------------------------------------------------------------------------------------------------
if [ "$RUN_smoke" -eq 1 ]; then
CASE=smoke
CFG="$ROOT/playwright.config.ts"
SPEC="$ROOT/e2e/smoke.spec.ts"
[ -f "$CFG" ] || fail "playwright.config.ts does not exist at the root"
[ -f "$SPEC" ] || fail "e2e/smoke.spec.ts does not exist"
others="$(cd "$ROOT" && git ls-files --cached --others --exclude-standard | grep -E '(^|/)playwright\.config\.[a-z]+$' | grep -v -x 'playwright.config.ts' || true)"
[ -z "$others" ] || fail "a second Playwright configuration exists; the one config lives at the root" "$others"
[ "$(clone_files e2e)" = "e2e/smoke.spec.ts" ] || fail "e2e holds more than smoke.spec.ts" "$(clone_files e2e)"
[ "$(json "$ROOT/package.json" 'j.scripts["e2e:smoke"]')" = "playwright test" ] || fail "the root e2e:smoke script is not 'playwright test'"
PW_PIN="$(json "$PINS" 'j.tools.playwright.version')" || fail "cannot read tools.playwright.version"
[ "$PW_PIN" = "1.64.1" ] || fail "tools.playwright.version is '$PW_PIN', the Spec says 1.64.1"
pw_dep="$(json "$ROOT/package.json" 'j.devDependencies["@playwright/test"]')"
[ "$pw_dep" = "$PW_PIN" ] || fail "devDependencies[\"@playwright/test\"] is '$pw_dep', tools/toolchain.json pins $PW_PIN"
run_in "$ROOT" pnpm exec playwright --version
[ "$RC" -eq 0 ] || fail "pnpm exec playwright --version: exit $RC" "$OUT"
[ "$OUT" = "Version $PW_PIN" ] || fail "pnpm exec playwright --version prints '$OUT', expected 'Version $PW_PIN'"
run_in "$ROOT" pnpm exec playwright test --list
[ "$RC" -eq 0 ] || fail "pnpm exec playwright test --list: exit $RC" "$OUT"
last="$(printf '%s\n' "$OUT" | grep -v '^ *$' | tail -n 1)"
[ "$last" = "Total: 5 tests in 1 file" ] || fail "playwright test --list ends '$last', expected 'Total: 5 tests in 1 file'" "$OUT"
ntests="$(printf '%s\n' "$OUT" | grep -c ' › ' || true)"
nchromium="$(printf '%s\n' "$OUT" | grep -c -E '^ *\[chromium\] › ' || true)"
[ "$ntests" -eq 5 ] && [ "$nchromium" -eq 5 ] \
  || fail "playwright test --list: $ntests test lines, $nchromium of them [chromium]; expected 5 and 5" "$OUT"
grep -i -E 'firefox|webkit' "$CFG" > "$tmp/browsers" && fail "playwright.config.ts names firefox or webkit; the Chromium project only" "$(cat "$tmp/browsers")"
nproj="$(grep -o -E 'name: *["'"'"'][^"'"'"']*["'"'"']' "$CFG" | grep -c . || true)"
[ "$nproj" -eq 1 ] || fail "playwright.config.ts names $nproj projects, expected one (chromium)"
grep -q -E 'name: *["'"'"']chromium["'"'"']' "$CFG" || fail "playwright.config.ts has no project named chromium"
# Ruling 7: the spec requests the health route and navigates to the page.
grep -q -E '\.get\( *["'"'"'`]/api/v1/health["'"'"'`] *\)' "$SPEC" || fail "e2e/smoke.spec.ts does not request /api/v1/health"
grep -q -E '\.goto\( *["'"'"'`]/["'"'"'`] *\)' "$SPEC" || fail "e2e/smoke.spec.ts does not navigate to /"
# Card PX-02.1: the spec also opens the workspace route, where it looks for the navigation.
grep -q -E '\.goto\( *["'"'"'`]/workspace["'"'"'`] *\)' "$SPEC" || fail "e2e/smoke.spec.ts does not navigate to /workspace"
# Card P0-02.6: the spec reads the strings it asserts from the catalog of the locale, and the catalog holds fixture N.
for needle in packages i18n messages NEXT_PUBLIC_LOCALE; do
  grep -q -F -- "$needle" "$SPEC" || fail "e2e/smoke.spec.ts does not name '$needle': it must read its strings from packages/i18n/messages by NEXT_PUBLIC_LOCALE"
done
grep -q -F -- "$NOTICE" "$SPEC" && fail "e2e/smoke.spec.ts holds a copy of the notice (fixture N); it reads it from the catalog"
CATALOG="$ROOT/packages/i18n/messages/en.json"
[ -f "$CATALOG" ] || fail "packages/i18n/messages/en.json does not exist"
[ "$(json "$CATALOG" 'j["home.notice"]')" = "$NOTICE" ] || fail "home.notice of packages/i18n/messages/en.json is not fixture N"
echo "# playwright.config.ts at the root, e2e/smoke.spec.ts; @playwright/test $pw_dep = the pin, 'Version $PW_PIN'; --list: 5 tests, all [chromium], '$last'; one project; the spec gets /api/v1/health and goes to / and /workspace, reads its strings from packages/i18n/messages; home.notice of en.json = fixture N"

STATE="$(tree_state)" || fail "cannot read the state of the tree"
# The reuse path: against the dev server that is already running.
ensure_dev
rm -f "$PNG"
t0="$(date +%s)"
run_in "$ROOT" env PORT="$DEV_PORT" pnpm e2e:smoke
t1="$(date +%s)"
[ "$RC" -eq 0 ] || fail "PORT=$DEV_PORT pnpm e2e:smoke against the running dev server: exit $RC" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^ +5 passed' || fail "the smoke against the running dev server did not print '5 passed'" "$OUT"
[ "$(listeners "$DEV_PORT" | sed -n '1p')" = "$DEV_LISTENER" ] \
  || fail "after the smoke, pid $DEV_LISTENER no longer listens on $DEV_PORT: the running server was not reused, or was stopped" "$OUT"
png_ok "the reuse path"
(cd "$ROOT" && git check-ignore -q .bridle/screenshots/smoke-home.png) || fail ".bridle/screenshots/smoke-home.png is not gitignored"
(cd "$ROOT" && git check-ignore -q .bridle/playwright/) || fail ".bridle/playwright/ is not gitignored"
echo "# reuse path: PORT=$DEV_PORT pnpm e2e:smoke: exit 0 in $((t1 - t0)) s, '$(printf '%s\n' "$OUT" | grep -E '^ +5 passed' | sed 's/^ *//')', pid $DEV_LISTENER still listening; PNG $PNG_BYTES bytes, gitignored with .bridle/playwright/"
stop_dev

# The start path: Playwright starts the server itself and stops it.
P2="$(free_port)" || fail "node gave no free loopback port"
PORTS="$PORTS $P2"
rm -f "$PNG"
t0="$(date +%s)"
run_in "$ROOT" env PORT="$P2" pnpm e2e:smoke
t1="$(date +%s)"
[ "$RC" -eq 0 ] || fail "PORT=$P2 pnpm e2e:smoke with no server running: exit $RC" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^ +5 passed' || fail "the smoke that starts its own server did not print '5 passed'" "$OUT"
png_ok "the start path"
i=0
while [ -n "$(listeners "$P2")" ]; do
  i=$((i + 1))
  [ "$i" -lt 10 ] || fail "5 s after the smoke, something still listens on port $P2 (pid $(listeners "$P2" | tr '\n' ' ')): Playwright left its server running" "$OUT"
  sleep 0.5
done
echo "# start path: PORT=$P2 pnpm e2e:smoke: exit 0 in $((t1 - t0)) s, '$(printf '%s\n' "$OUT" | grep -E '^ +5 passed' | sed 's/^ *//')'; PNG $PNG_BYTES bytes; nothing listens on $P2 afterwards"

# The sha is asserted, not echoed: a server that reports another sha fails the smoke.
P3="$(free_port)" || fail "node gave no free loopback port"
PORTS="$PORTS $P3"
start_dev "$P3" feedbee
body="$(cat "$tmp/b")"
[ "$body" = '{"ok":true,"sha":"feedbee"}' ] || fail "a dev server started with GIT_SHA=feedbee answers '$body', fixture H says {\"ok\":true,\"sha\":\"feedbee\"}"
run_in "$ROOT" env PORT="$P3" pnpm e2e:smoke
[ "$RC" -ne 0 ] || fail "PORT=$P3 pnpm e2e:smoke exits 0 against a server that reports sha feedbee: the sha is echoed, not asserted" "$OUT"
printf '%s\n' "$OUT" | grep -q -E '^ +5 passed' && fail "the smoke printed '5 passed' against a server that reports sha feedbee" "$OUT"
printf '%s\n' "$OUT" | grep -q -F 'feedbee' || fail "the failed smoke does not name the sha it received (feedbee): it failed for another reason" "$OUT"
NEG_LINE="$(printf '%s\n' "$OUT" | grep -E '^ +[0-9]+ failed' | sed -n '1p' | sed 's/^ *//')"
stop_dev
same_tree "$STATE" "the three smoke runs"
echo "# GIT_SHA=feedbee server on $P3: health {\"ok\":true,\"sha\":\"feedbee\"}; the smoke without it: exit $RC, '$NEG_LINE', names feedbee; tree unchanged"
echo "ok - smoke"
fi

# ---- shell (PX-02.1) --------------------------------------------------------------------------------------------
if [ "$RUN_shell" -eq 1 ]; then
CASE=shell
PKG="$WEB/package.json"
loose="$(node -e 'const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
for (const k of ["dependencies", "devDependencies"])
  for (const [n, v] of Object.entries(j[k] || {}))
    if (v !== "workspace:*" && !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(v)) console.log(k + "." + n + " = " + v);' "$PKG")" \
  || fail "cannot read the dependencies of apps/web/package.json"
[ -z "$loose" ] || fail "apps/web/package.json has a dependency that is not an exact version" "$loose"
VERSIONS=""
for name in three @react-three/fiber @react-three/drei zustand; do
  v="$(json "$PKG" "j.dependencies['$name'] || 'missing'")"
  [ "$v" != "missing" ] || fail "apps/web/package.json: dependencies.$name is missing"
  VERSIONS="$VERSIONS $name $v"
done
[ "$(json "$PKG" "j.dependencies['@bridle/model'] || 'missing'")" = "workspace:*" ] \
  || fail "apps/web/package.json: dependencies['@bridle/model'] is not workspace:* (card PX-02.2: the viewport draws a Model)"
[ -f "$WEB/src/styles/tokens.css" ] || fail "apps/web/src/styles/tokens.css does not exist"
cmp -s "$ROOT/docs/ux/tokens.css" "$WEB/src/styles/tokens.css" \
  || fail "apps/web/src/styles/tokens.css differs from docs/ux/tokens.css (cp docs/ux/tokens.css apps/web/src/styles/tokens.css)"
run_in "$ROOT" pnpm --filter web test
[ "$RC" -eq 0 ] || fail "pnpm --filter web test (the token copy test): exit $RC" "$OUT"
[ -d "$WEB/src/components" ] || fail "apps/web/src/components does not exist"
echo "# apps/web: exact pins;$VERSIONS; @bridle/model workspace:*; src/styles/tokens.css = docs/ux/tokens.css, pnpm --filter web test exit 0; src/components exists"

count_of() {  # $1 = fixed string, $2 = file: how many times the file holds it
  grep -o -F -- "$1" "$2" | grep -c . || true
}
shell_of() {  # $1 = route: the HTML in $tmp/b has a stylesheet link, one <header and one <nav with the two links
  grep -q -i -E 'rel=.?stylesheet' "$tmp/b" || fail "the HTML of $1 links no stylesheet"
  [ "$(count_of '<header' "$tmp/b")" -eq 1 ] || fail "the HTML of $1 has $(count_of '<header' "$tmp/b") <header elements, expected one"
  [ "$(count_of '<nav' "$tmp/b")" -eq 1 ] || fail "the HTML of $1 has $(count_of '<nav' "$tmp/b") <nav elements, expected one"
  node -e 'const h = require("fs").readFileSync(process.argv[1], "utf8");
const nav = /<nav[\s\S]*?<\/nav>/.exec(h);
const links = nav ? nav[0].match(/<a [^>]*>/g) || [] : [];
const hrefs = links.map((a) => (/href="([^"]*)"/.exec(a) || [])[1]);
const current = links.filter((a) => a.includes("aria-current=\"page\"")).map((a) => (/href="([^"]*)"/.exec(a) || [])[1]);
if (hrefs.join(" ") !== "/workspace /tasks") { console.log("links: " + hrefs.join(" ")); process.exit(1); }
if (current.join(" ") !== process.argv[2]) { console.log("aria-current: " + current.join(" ")); process.exit(1); }' "$tmp/b" "$2" > "$tmp/nav.out" \
    || fail "the <nav> of $1 is not the links /workspace and /tasks with aria-current=\"page\" on '$2'" "$(cat "$tmp/nav.out")"
  [ "$(count_of '<main' "$tmp/b")" -eq 1 ] || fail "the HTML of $1 has $(count_of '<main' "$tmp/b") <main elements, expected one"
}
ensure_dev
http_get "http://127.0.0.1:$DEV_PORT/"
[ "$CODE" = "200" ] || fail "GET /: $CODE" "$(cat "$tmp/b")"
shell_of / ""
main="$(node -e 'const h = require("fs").readFileSync(process.argv[1], "utf8");
const m = /<main[^>]*>([\s\S]*?)<\/main>/.exec(h);
process.stdout.write(m ? m[1] : "");' "$tmp/b")"
case "$main" in
  "$MAIN_HTML"*) ;;
  *) fail "the <main> of / does not start with the h1 and the two paragraphs (the sha, fixture N)" "$main" ;;
esac
printf '%s\n' "${main#"$MAIN_HTML"}" | grep -q -E '<a [^>]*href="/workspace"' \
  || fail "the <main> of / holds no link to /workspace after the notice" "$main"
http_get "http://127.0.0.1:$DEV_PORT/workspace"
[ "$CODE" = "200" ] || fail "GET /workspace: $CODE" "$(cat "$tmp/b")"
shell_of /workspace /workspace
grep -q -F -- 'data-testid="viewport"' "$tmp/b" || fail "the HTML of /workspace has no viewport area (data-testid=\"viewport\")"
grep -q -E '<aside [^>]*data-testid="side-panel"' "$tmp/b" || fail "the HTML of /workspace has no side panel area (<aside data-testid=\"side-panel\">)"
http_get "http://127.0.0.1:$DEV_PORT/tasks"
[ "$CODE" = "200" ] || fail "GET /tasks: $CODE" "$(cat "$tmp/b")"
shell_of /tasks /tasks
grep -q -F -- 'data-testid="coming-soon"' "$tmp/b" || fail "the HTML of /tasks has no coming-soon state (data-testid=\"coming-soon\")"
grep -q -F -- 'Coming soon' "$tmp/b" || fail "the HTML of /tasks does not say 'Coming soon' (tasks.comingSoon.title of en.json)"
stop_dev
echo "# GET /, /workspace, /tasks: 200, a stylesheet link, one <header, one <nav (links /workspace, /tasks; aria-current on the route's own), one <main>; / starts with the h1, sha and notice and links to /workspace; /workspace has the viewport and side panel areas; /tasks the coming-soon state"
echo "ok - shell"
fi
stop_dev

# ---- docs (AC4) -------------------------------------------------------------------------------------------------
if [ "$RUN_docs" -eq 1 ]; then
CASE=docs
[ -f "$DOC" ] || fail "docs/ops/local-dev.md does not exist"
HEAD='## Web application and the smoke test'
c="$(grep -c -x -F -- "$HEAD" "$DOC" || true)"
[ "$c" -eq 1 ] || fail "docs/ops/local-dev.md has $c '$HEAD' headings, expected one"
awk -v h="$HEAD" '$0 == h { f = 1; print; next } f && /^## / { exit } f' "$DOC" > "$tmp/section"
nneedles=0
while IFS= read -r needle; do
  [ -n "$needle" ] || continue
  grep -q -F -- "$needle" "$tmp/section" || fail "the section '$HEAD' of docs/ops/local-dev.md does not name '$needle'"
  nneedles=$((nneedles + 1))
done <<'EOF'
pnpm --filter web dev
pnpm --filter web build
pnpm e2e:smoke
/api/v1/health
GIT_SHA
PORT
playwright.config.ts
e2e/smoke.spec.ts
.bridle/screenshots/
1.64.1
npx playwright@1.64.1 install chromium
6.0.3
tools/test/web.test.sh
EOF
lw="$(grep -n -x -F -- "$HEAD" "$DOC" | cut -d: -f1)"
lo="$(grep -n -E '^## Other local ports' "$DOC" | sed -n '1p' | cut -d: -f1)"
[ -n "$lo" ] || fail "docs/ops/local-dev.md has no '## Other local ports' section"
[ "$lw" -lt "$lo" ] || fail "'$HEAD' (line $lw) is not before '## Other local ports' (line $lo)"
row="$(grep -E '^\| *3000 *\|' "$DOC" | grep -F 'playwright.config.ts' | sed -n '1p' || true)"
[ -n "$row" ] || fail "the port table of docs/ops/local-dev.md has no 3000 row naming playwright.config.ts" "$(grep -E '^\| *3000 *\|' "$DOC")"
grep -q -F -- 'P0-02.5 puts the Next.js server behind' "$DOC" \
  && fail "docs/ops/local-dev.md still says 'P0-02.5 puts the Next.js server behind'; no card of P0-02 does that"
echo "# docs/ops/local-dev.md: '$HEAD' (line $lw, before 'Other local ports' at $lo) names the $nneedles strings of the plan's list; a 3000 row names playwright.config.ts; no 'P0-02.5 puts the Next.js server behind'"
echo "ok - docs"
fi
exit 0
