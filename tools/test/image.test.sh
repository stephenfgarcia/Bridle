#!/usr/bin/env bash
# Tests for the application image (card P0-02.4): one case per acceptance criterion, in the plan's order build,
# entrypoints, serve, unknown, context, docs. AC4 is this file: `bash tools/test/image.test.sh` exits 0 with six
# `ok` lines.
#   build        AC2       `docker build --build-arg GIT_SHA=<sha> -t bridle:dev <root>` (sha = `git rev-parse --short
#                          HEAD`; the layer cache and the pnpm store mount make it a rebuild of the last layers) exits
#                          0, wall time and the CACHED step count printed, the last 60 log lines on a failure; a
#                          failure whose log holds `Error when performing the request` (corepack's registry fetch,
#                          a known transient) is rerun once; `docker image inspect --format '{{.Size}}'` printed as
#                          `# image: bridle:dev <n> MB` (report only); the built image's label
#                          org.opencontainers.image.revision == <sha>, env GIT_SHA=<sha>, Config.User node,
#                          Config.Entrypoint ["/app/tools/entrypoint.sh"], 3000/tcp exposed, a HEALTHCHECK that
#                          probes /healthz; static: the Dockerfile has exactly one FROM that names an image (the
#                          others name stages) and it is node:22.23.4-bookworm-slim@sha256:<64 hex> AS base, stages
#                          base deps build runtime, and lines with --frozen-lockfile, --mount=type=cache, --prod,
#                          USER node, HEALTHCHECK, EXPOSE 3000, ARG GIT_SHA, ENTRYPOINT ["/app/tools/entrypoint.sh"]
#   entrypoints  AC1       `docker run --rm bridle:dev <name>` for web, worker, judge, system exits 0 with stdout
#                          exactly the one line `<name> <sha>`; `-e GIT_SHA=` (empty) prints `web unknown`;
#                          `--entrypoint id ... -u` prints 1000; `--entrypoint ls ... -A /app` lists exactly
#                          node_modules package.json packages pnpm-workspace.yaml tools and `-A /app/node_modules`
#                          dot-entries only (pruned to --prod); /app/tools/entrypoint.sh is 755 node:node; the
#                          script itself runs on the host under this bash (3.2 syntax): `GIT_SHA=<sha> bash
#                          tools/entrypoint.sh web` prints `web <sha>`
#   serve        AC1       `docker run -d -p 127.0.0.1::3000 bridle:dev web --serve` (random loopback port, read back
#                          with `docker port`; the image's 30 s health interval overridden to 1 s so docker's own
#                          verdict arrives in time); GET /healthz answers 200 within 10 s (polled every 0.5 s) with
#                          `"ok":true`, `"entrypoint":"web"` and the sha in the body and content-type
#                          application/json; GET /nope and POST /healthz answer 404; `docker logs` has `web <sha>` and
#                          `web <sha> serving /healthz on :3000`; PID 1 is node running as uid 1000; the image's own
#                          HEALTHCHECK command exits 0 inside the container and docker reports the container healthy
#                          within 15 s; `docker stop -t 5` returns and the ExitCode is 0 (137 would mean the SIGTERM
#                          handler did not run); the container is removed
#   unknown      AC2       `docker run --rm bridle:dev bogus` exits 2 with nothing on stdout and a `usage:` line naming
#                          web, worker, judge and system on stderr; no argument exits 2 the same way; `web --bogus`
#                          exits 2 with nothing on stdout; `--help` exits 0 with the usage on stdout; on the host
#                          `bash tools/entrypoint.sh bogus` exits 2
#   context      AC3       .dockerignore has the whole lines node_modules, target, .bridle, .git*, docs, factory, .env*,
#                          tools/*, !tools/entrypoint.sh; behavioural: `docker build -q --target deps <root>` (cached)
#                          exports the deps stage and inside it `ls -A /app` lists none of .git .github .gitignore
#                          .gitattributes docs factory target .bridle .claude .claude-sessions .worktrees crates
#                          Cargo.toml Cargo.lock compose.yaml Dockerfile .dockerignore .env .env.example .env.local,
#                          no *.md, but does list package.json pnpm-lock.yaml pnpm-workspace.yaml packages tools
#                          node_modules; `ls -A /app/tools` is exactly entrypoint.sh; /app/node_modules/.pnpm is not
#                          empty and no entry names darwin (the host's macOS tree did not leak); the card's `## Build`
#                          names bridle:dev and a `<n> MB` size; the deps-stage image is removed again (unless its id
#                          existed before the test: a cached export can land on an id another build already left)
#                          and bridle:dev still exists
#   docs         Files     docs/ops/local-dev.md has a `## Application image` section naming Dockerfile, .dockerignore,
#                          tools/entrypoint.sh, bridle:dev, GIT_SHA, --serve, /healthz, 3000, web, worker, judge,
#                          system, 1000, tools/test/image.test.sh and the Dockerfile's base image reference
#                          (tag@digest) verbatim, and its intro no longer defers the application container to P0-02.4
#
# Run:  bash tools/test/image.test.sh      (from any directory; the script finds the repository from its own path)
# In this harness: . "$HOME/.cargo/env"; . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null;
#                  export PATH="$HOME/.orbstack/bin:/usr/local/bin:$PATH"; bash tools/test/image.test.sh
# BRIDLE_IMAGE=<tag> builds and tests that tag instead of bridle:dev (how the test is run against a scratch copy of
# the repository without moving the real tag); the tag the test built is never removed.
# Never wire this file into `pnpm test`: it needs the docker engine and builds the image.
# Prints `ok - <case>` per case (and `# ...` comment lines with the measured output); stops at the first failed
# assertion with `not ok - <case>: <why>` and the command's output on stderr, exit 1. Needs bash 3.2, docker with
# BuildKit (OrbStack or Docker Desktop, engine running), git, curl, awk, sed, grep, sort, tr, wc, mktemp, date.
# It writes nothing inside the repository (logs and captured output live under `mktemp -d`, removed on exit), starts
# one container (removed on exit, `docker rm -f` when a failure leaves it running), builds the tag (kept; the image
# the tag pointed at before stays as docker leaves it) and one untagged deps-stage image (removed on exit when the
# test created it), never runs `docker image prune`, and touches no compose project. About 25 s warm, a few minutes
# on an empty builder cache.
set -u
set -o pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKERFILE="$ROOT/Dockerfile"
DOCKERIGNORE="$ROOT/.dockerignore"
ENTRYPOINT="$ROOT/tools/entrypoint.sh"
DOC="$ROOT/docs/ops/local-dev.md"
CARD="$ROOT/factory/cards/P0-02.4-dockerfile-with-four-stub-entrypoints.md"
IMAGE="${BRIDLE_IMAGE:-bridle:dev}"
CASE=setup
CONTAINERS=""   # ids the test started (the EXIT trap removes them)
DEPS_IMAGE=""   # the untagged deps-stage image the test built (the EXIT trap removes it)
tmp=""

[ -d "$HOME/.orbstack/bin" ] && PATH="$HOME/.orbstack/bin:$PATH"
export PATH

fail() {  # $1 = why; $2 = output to show (optional). Prints `not ok` and exits 1 (the EXIT trap still runs).
  echo "not ok - $CASE: $1" >&2
  if [ -n "${2-}" ]; then
    echo "--- output ---" >&2
    printf '%s\n' "$2" >&2
    echo "--- end ---" >&2
  fi
  exit 1
}

cleanup() {  # EXIT trap: the containers and the deps-stage image the test created go; the tag and everything else stay
  local rc=$? c
  for c in $CONTAINERS; do
    docker rm -f "$c" >/dev/null 2>&1 || true
  done
  if [ -n "$DEPS_IMAGE" ]; then
    docker image rm "$DEPS_IMAGE" >/dev/null 2>&1 || true
  fi
  [ -n "$tmp" ] && rm -rf "$tmp"
  exit "$rc"
}
trap cleanup EXIT

for t in docker git curl awk sed grep sort tr wc mktemp date; do
  command -v "$t" >/dev/null 2>&1 || fail "$t is not on PATH (see the header)"
done
[ -f "$DOCKERFILE" ] || fail "Dockerfile does not exist at the repository root"
[ -f "$DOCKERIGNORE" ] || fail ".dockerignore does not exist at the repository root"
[ -f "$ENTRYPOINT" ] || fail "tools/entrypoint.sh does not exist"
[ -x "$ENTRYPOINT" ] || fail "tools/entrypoint.sh is not executable"
[ -f "$DOC" ] || fail "docs/ops/local-dev.md does not exist"
[ -f "$CARD" ] || fail "the card $CARD does not exist"
docker info >/dev/null 2>&1 || fail "the docker engine is not reachable (open -a OrbStack)"
tmp="$(mktemp -d)" || fail "mktemp -d failed"
case "$tmp" in "$ROOT"/*) fail "mktemp -d gave a directory inside the repository: $tmp" ;; esac
T_START="$(date +%s)"

# ---- helpers --------------------------------------------------------------------------------------------------

run() {  # $@ = command: stdout and stderr captured separately; sets RC, OUT (stdout), ERR (stderr)
  "$@" >"$tmp/out" 2>"$tmp/err"
  RC=$?
  OUT="$(cat "$tmp/out")"
  ERR="$(cat "$tmp/err")"
}
inspect() {  # $1 = go template: `docker image inspect` of the tag under test
  docker image inspect "$IMAGE" --format "$1" 2>&1
}
http_code() {  # $@ = curl arguments: the HTTP status code, the body in $tmp/body (000 when the connection fails)
  curl -s -o "$tmp/body" -w '%{http_code}' "$@" 2>/dev/null || true
}

# ---- build (AC2) ------------------------------------------------------------------------------------------------
CASE=build
sha="$(git -C "$ROOT" rev-parse --short HEAD 2>&1)" || fail "git -C $ROOT rev-parse --short HEAD failed: $sha"
printf '%s\n' "$sha" | grep -q -E '^[0-9a-f]{7,40}$' || fail "git rev-parse --short HEAD printed '$sha', not a sha"

# static checks first: they need no engine and explain a build failure
FROMS="$(grep -E '^FROM ' "$DOCKERFILE")"
STAGES="$(printf '%s\n' "$FROMS" | awk 'toupper($3) == "AS" { print $4 }')"
for s in base deps build runtime; do
  printf '%s\n' "$STAGES" | grep -q -x -F -- "$s" || fail "Dockerfile: no stage named $s (FROM ... AS $s)" "$FROMS"
done
EXTERNAL=""
for ref in $(printf '%s\n' "$FROMS" | awk '{ print $2 }'); do
  printf '%s\n' "$STAGES" | grep -q -x -F -- "$ref" || EXTERNAL="$EXTERNAL$ref
"
done
n="$(printf '%s' "$EXTERNAL" | grep -c .)"
[ "$n" -eq 1 ] || fail "Dockerfile: expected exactly one FROM that names an image (every other FROM names a stage), found $n" "$FROMS"
BASE_REF="$(printf '%s' "$EXTERNAL" | head -n 1)"
printf '%s\n' "$BASE_REF" | grep -q -E '^node:22\.23\.4-bookworm-slim@sha256:[0-9a-f]{64}$' \
  || fail "Dockerfile: the base image is '$BASE_REF', want node:22.23.4-bookworm-slim@sha256:<64 hex> (tag and digest)"
grep -q -x -F -- "FROM $BASE_REF AS base" "$DOCKERFILE" || fail "Dockerfile: the base image line is not 'FROM $BASE_REF AS base'" "$FROMS"
for s in '--frozen-lockfile' '--mount=type=cache' '--prod' 'USER node' 'HEALTHCHECK' 'EXPOSE 3000' 'ARG GIT_SHA' \
         'ENTRYPOINT ["/app/tools/entrypoint.sh"]'; do
  grep -q -F -- "$s" "$DOCKERFILE" || fail "Dockerfile has no line with '$s'"
done

build() {  # the criterion's command, log to $tmp/build.log; sets RC
  docker build --build-arg "GIT_SHA=$sha" -t "$IMAGE" "$ROOT" >"$tmp/build.log" 2>&1
  RC=$?
}
t0="$(date +%s)"
build
if [ "$RC" -ne 0 ] && grep -q -F 'Error when performing the request' "$tmp/build.log"; then
  echo "# build: exit $RC with 'Error when performing the request' (corepack's registry fetch, a known transient): one rerun"
  cp "$tmp/build.log" "$tmp/build-first.log"
  build
fi
t1="$(date +%s)"
BUILD_ELAPSED=$((t1 - t0))
[ "$RC" -eq 0 ] || fail "docker build --build-arg GIT_SHA=$sha -t $IMAGE $ROOT: exit $RC (last 60 log lines)" "$(tail -n 60 "$tmp/build.log")"
CACHED="$(grep -c -E 'CACHED$' "$tmp/build.log" || true)"
bytes="$(inspect '{{.Size}}')" || fail "docker image inspect $IMAGE: $bytes"
printf '%s\n' "$bytes" | grep -q -E '^[0-9]+$' || fail "docker image inspect $IMAGE --format '{{.Size}}' printed '$bytes'"
mb="$(awk -v b="$bytes" 'BEGIN { printf "%d", (b / 1000000) + 0.5 }')"
rev="$(inspect '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
[ "$rev" = "$sha" ] || fail "label org.opencontainers.image.revision is '$rev', want $sha (the GIT_SHA build arg)"
env_json="$(inspect '{{json .Config.Env}}')"
printf '%s\n' "$env_json" | grep -q -F -- "\"GIT_SHA=$sha\"" || fail "the image's env has no GIT_SHA=$sha" "$env_json"
user="$(inspect '{{.Config.User}}')"
[ "$user" = "node" ] || fail "Config.User is '$user', want node"
ep="$(inspect '{{json .Config.Entrypoint}}')"
[ "$ep" = '["/app/tools/entrypoint.sh"]' ] || fail "Config.Entrypoint is $ep, want [\"/app/tools/entrypoint.sh\"]"
cmd="$(inspect '{{json .Config.Cmd}}')"
exposed="$(inspect '{{json .Config.ExposedPorts}}')"
printf '%s\n' "$exposed" | grep -q -F '"3000/tcp"' || fail "Config.ExposedPorts is $exposed, want 3000/tcp"
hc="$(inspect '{{json .Config.Healthcheck.Test}}')" || fail "the image has no HEALTHCHECK: $hc"
printf '%s\n' "$hc" | grep -q -F '/healthz' || fail "the HEALTHCHECK does not probe /healthz: $hc"
echo "# docker build --build-arg GIT_SHA=$sha -t $IMAGE: exit 0 in $BUILD_ELAPSED s ($CACHED steps CACHED)"
echo "# image: $IMAGE $mb MB ($bytes bytes); revision=$rev user=$user entrypoint=$ep cmd=$cmd exposed=$exposed; HEALTHCHECK probes /healthz"
echo "# Dockerfile: base $BASE_REF (the only FROM naming an image); stages base deps build runtime;" \
     "--frozen-lockfile, --mount=type=cache, --prod, USER node, HEALTHCHECK, EXPOSE 3000, ARG GIT_SHA present"
echo "ok - build"

# ---- entrypoints (AC1) ------------------------------------------------------------------------------------------
CASE=entrypoints
for name in web worker judge system; do
  run docker run --rm "$IMAGE" "$name"
  [ "$RC" -eq 0 ] || fail "docker run --rm $IMAGE $name: exit $RC" "$OUT$ERR"
  [ "$OUT" = "$name $sha" ] || fail "docker run --rm $IMAGE $name printed '$OUT' on stdout, want exactly '$name $sha'" "stderr: $ERR"
  n="$(wc -l < "$tmp/out" | tr -d ' ')"
  [ "$n" -eq 1 ] || fail "docker run --rm $IMAGE $name printed $n stdout lines, want exactly one"
  [ -z "$ERR" ] || echo "# note: docker run --rm $IMAGE $name also wrote to stderr: $ERR"
done
run docker run --rm -e GIT_SHA= "$IMAGE" web
[ "$RC" -eq 0 ] && [ "$OUT" = "web unknown" ] || fail "with GIT_SHA empty, web printed '$OUT' (exit $RC), want 'web unknown'" "$ERR"
run docker run --rm --entrypoint id "$IMAGE" -u
[ "$RC" -eq 0 ] && [ "$OUT" = "1000" ] || fail "docker run --rm --entrypoint id $IMAGE -u printed '$OUT' (exit $RC), want 1000" "$ERR"
run docker run --rm --entrypoint ls "$IMAGE" -A /app
[ "$RC" -eq 0 ] || fail "docker run --rm --entrypoint ls $IMAGE -A /app: exit $RC" "$OUT$ERR"
LS_APP="$(printf '%s\n' "$OUT" | sort | tr '\n' ' ')"
[ "$LS_APP" = "node_modules package.json packages pnpm-workspace.yaml tools " ] \
  || fail "ls -A /app lists '$LS_APP', want exactly 'node_modules package.json packages pnpm-workspace.yaml tools'"
run docker run --rm --entrypoint ls "$IMAGE" -A /app/node_modules
[ "$RC" -eq 0 ] || fail "docker run --rm --entrypoint ls $IMAGE -A /app/node_modules: exit $RC" "$OUT$ERR"
bad="$(printf '%s\n' "$OUT" | grep -v -E '^(\.|$)' || true)"
[ -z "$bad" ] || fail "ls -A /app/node_modules lists entries that are not dot-entries (not pruned to --prod):" "$bad"
LS_NM="$(printf '%s\n' "$OUT" | tr '\n' ' ')"
run docker run --rm --entrypoint stat "$IMAGE" -c '%a %U:%G' /app/tools/entrypoint.sh
[ "$RC" -eq 0 ] && [ "$OUT" = "755 node:node" ] || fail "/app/tools/entrypoint.sh is '$OUT' (exit $RC), want 755 node:node" "$ERR"
run env "GIT_SHA=$sha" "$BASH" "$ENTRYPOINT" web
[ "$RC" -eq 0 ] && [ "$OUT" = "web $sha" ] \
  || fail "on the host, GIT_SHA=$sha $BASH tools/entrypoint.sh web printed '$OUT' (exit $RC), want 'web $sha'" "$ERR"
echo "# docker run --rm $IMAGE <name>: web, worker, judge, system each exit 0 with stdout exactly '<name> $sha'; -e GIT_SHA= -> 'web unknown'"
echo "# id -u -> 1000; ls -A /app -> $LS_APP(exact); ls -A /app/node_modules -> $LS_NM(dot-entries only: pruned);" \
     "tools/entrypoint.sh 755 node:node; on the host ($BASH $BASH_VERSION): web $sha"
echo "ok - entrypoints"

# ---- serve (AC1) ------------------------------------------------------------------------------------------------
CASE=serve
id="$(docker run -d -p 127.0.0.1::3000 --health-interval 1s --health-start-period 1s "$IMAGE" web --serve 2>&1)" \
  || fail "docker run -d -p 127.0.0.1::3000 $IMAGE web --serve failed" "$id"
CONTAINERS="$id"
hostport="$( (docker port "$id" 3000 2>&1 || true) | head -n 1)"
printf '%s\n' "$hostport" | grep -q -E '^127\.0\.0\.1:[0-9]+$' \
  || fail "docker port $id 3000 printed '$hostport', want 127.0.0.1:<port>" "$(docker logs "$id" 2>&1)"
url="http://$hostport"
code=""
i=0
while [ "$i" -lt 20 ]; do
  code="$(http_code "$url/healthz")"
  [ "$code" = "200" ] && break
  i=$((i + 1))
  sleep 0.5
done
[ "$code" = "200" ] || fail "GET $url/healthz did not answer 200 within 10 s (last status '$code')" "$(docker logs "$id" 2>&1)"
POLLS=$i
body="$(cat "$tmp/body")"
for s in '"ok":true' '"entrypoint":"web"' "\"sha\":\"$sha\""; do
  printf '%s\n' "$body" | grep -q -F -- "$s" || fail "GET /healthz body lacks $s" "$body"
done
hdr="$(curl -si "$url/healthz" 2>&1)" || fail "curl -si $url/healthz failed" "$hdr"
STATUS_LINE="$(printf '%s\n' "$hdr" | head -n 1 | tr -d '\r')"
printf '%s\n' "$STATUS_LINE" | grep -q -E '^HTTP/1\.[01] 200' || fail "GET /healthz status line is '$STATUS_LINE', want HTTP/1.1 200" "$hdr"
printf '%s\n' "$hdr" | tr -d '\r' | grep -q -i -E '^content-type: application/json' \
  || fail "GET /healthz has no 'content-type: application/json' header" "$hdr"
code="$(http_code "$url/nope")"
[ "$code" = "404" ] || fail "GET /nope answered '$code', want 404" "$(cat "$tmp/body")"
code="$(http_code -X POST "$url/healthz")"
[ "$code" = "404" ] || fail "POST /healthz answered '$code', want 404 (GET only)" "$(cat "$tmp/body")"
logs="$(docker logs "$id" 2>&1)"
printf '%s\n' "$logs" | grep -q -x -F -- "web $sha" || fail "docker logs has no 'web $sha' line" "$logs"
printf '%s\n' "$logs" | grep -q -x -F -- "web $sha serving /healthz on :3000" \
  || fail "docker logs has no 'web $sha serving /healthz on :3000' line" "$logs"
pid1="$(docker exec "$id" cat /proc/1/comm 2>&1)"
[ "$pid1" = "node" ] || fail "PID 1 in the container is '$pid1', want node (the entrypoint must exec the server so SIGTERM reaches it)"
uid="$(docker exec "$id" id -u 2>&1)"
[ "$uid" = "1000" ] || fail "the --serve process runs as uid '$uid', want 1000"
hc0="$(inspect '{{index .Config.Healthcheck.Test 0}}')"
hclen="$(inspect '{{len .Config.Healthcheck.Test}}')"
[ "$hc0" = "CMD" ] && [ "$hclen" -ge 2 ] || fail "the HEALTHCHECK is not in exec (CMD) form: $hc"
probe=()
i=1
while [ "$i" -lt "$hclen" ]; do
  probe[${#probe[@]}]="$(inspect "{{index .Config.Healthcheck.Test $i}}")"
  i=$((i + 1))
done
run docker exec "$id" "${probe[@]}"
[ "$RC" -eq 0 ] || fail "the image's HEALTHCHECK command exits $RC inside the running container, want 0" "$OUT$ERR"
status=""
i=0
while [ "$i" -lt 30 ]; do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$id" 2>&1)"
  [ "$status" = "healthy" ] && break
  i=$((i + 1))
  sleep 0.5
done
[ "$status" = "healthy" ] || fail "docker's health status is '$status' after 15 s with --health-interval 1s, want healthy" \
  "$(docker inspect --format '{{json .State.Health}}' "$id" 2>&1)"
t0="$(date +%s)"
out="$(docker stop -t 5 "$id" 2>&1)" || fail "docker stop -t 5 $id failed" "$out"
t1="$(date +%s)"
STOP_ELAPSED=$((t1 - t0))
ec="$(docker inspect --format '{{.State.ExitCode}}' "$id" 2>&1)"
[ "$ec" = "0" ] || fail "after docker stop the ExitCode is '$ec', want 0 (137 means SIGTERM was not handled by PID 1)" "$(docker logs "$id" 2>&1)"
out="$(docker rm "$id" 2>&1)" || fail "docker rm $id failed" "$out"
CONTAINERS=""
echo "# docker run -d -p 127.0.0.1::3000 $IMAGE web --serve -> $(printf '%s' "$id" | cut -c1-12) on $hostport; GET /healthz 200 after $POLLS polls of 0.5 s: $body"
echo "# $STATUS_LINE, content-type application/json; GET /nope 404; POST /healthz 404; logs: 'web $sha', 'web $sha serving /healthz on :3000'"
echo "# PID 1 node, uid 1000; the image's HEALTHCHECK command exits 0 in the container; docker health: $status (interval overridden to 1 s)"
echo "# docker stop -t 5: returned in $STOP_ELAPSED s, ExitCode $ec; container removed"
echo "ok - serve"

# ---- unknown (AC2) ----------------------------------------------------------------------------------------------
CASE=unknown
run docker run --rm "$IMAGE" bogus
[ "$RC" -eq 2 ] || fail "docker run --rm $IMAGE bogus: exit $RC, want 2" "$OUT$ERR"
[ -z "$OUT" ] || fail "docker run --rm $IMAGE bogus wrote to stdout (the usage belongs on stderr):" "$OUT"
printf '%s\n' "$ERR" | grep -q -F 'usage:' || fail "docker run --rm $IMAGE bogus: no 'usage:' line on stderr" "$ERR"
for name in web worker judge system; do
  printf '%s\n' "$ERR" | grep -q -F -- "$name" || fail "the usage on stderr does not name $name" "$ERR"
done
USAGE="$ERR"
run docker run --rm "$IMAGE"
[ "$RC" -eq 2 ] || fail "docker run --rm $IMAGE (no argument): exit $RC, want 2" "$OUT$ERR"
[ -z "$OUT" ] || fail "docker run --rm $IMAGE (no argument) wrote to stdout:" "$OUT"
printf '%s\n' "$ERR" | grep -q -F 'usage:' || fail "docker run --rm $IMAGE (no argument): no 'usage:' line on stderr" "$ERR"
run docker run --rm "$IMAGE" web --bogus
[ "$RC" -eq 2 ] || fail "docker run --rm $IMAGE web --bogus: exit $RC, want 2" "$OUT$ERR"
[ -z "$OUT" ] || fail "docker run --rm $IMAGE web --bogus wrote to stdout (the name line must not print before the usage error):" "$OUT"
printf '%s\n' "$ERR" | grep -q -F 'usage:' || fail "docker run --rm $IMAGE web --bogus: no 'usage:' line on stderr" "$ERR"
run docker run --rm "$IMAGE" --help
[ "$RC" -eq 0 ] || fail "docker run --rm $IMAGE --help: exit $RC, want 0" "$OUT$ERR"
printf '%s\n' "$OUT" | grep -q -F 'usage:' || fail "docker run --rm $IMAGE --help: no 'usage:' line on stdout" "$OUT$ERR"
run "$BASH" "$ENTRYPOINT" bogus
[ "$RC" -eq 2 ] || fail "on the host, $BASH tools/entrypoint.sh bogus: exit $RC, want 2" "$OUT$ERR"
[ -z "$OUT" ] && printf '%s\n' "$ERR" | grep -q -F 'usage:' || fail "on the host, bogus must print the usage on stderr only" "stdout: $OUT / stderr: $ERR"
echo "# docker run --rm $IMAGE bogus: exit 2, stdout empty, stderr: $USAGE"
echo "# no argument: exit 2, usage on stderr; web --bogus: exit 2, nothing on stdout; --help: exit 0, usage on stdout; on the host: bogus exits 2"
echo "ok - unknown"

# ---- context (AC3) ----------------------------------------------------------------------------------------------
CASE=context
for s in node_modules target .bridle '.git*' docs factory '.env*' 'tools/*' '!tools/entrypoint.sh'; do
  grep -q -x -F -- "$s" "$DOCKERIGNORE" || fail ".dockerignore has no line '$s'"
done
before="$(docker images -q --no-trunc -f dangling=true 2>/dev/null || true)"
deps_build() {  # the deps stage, cached, exported as an untagged image; sets RC and DID
  DID="$(docker build -q --target deps "$ROOT" 2>"$tmp/deps.err")"
  RC=$?
}
t0="$(date +%s)"
deps_build
if [ "$RC" -ne 0 ] && grep -q -F 'Error when performing the request' "$tmp/deps.err"; then
  echo "# context: docker build --target deps exit $RC with 'Error when performing the request' (the transient registry fetch): one rerun"
  deps_build
fi
t1="$(date +%s)"
[ "$RC" -eq 0 ] || fail "docker build -q --target deps $ROOT: exit $RC" "$(tail -n 60 "$tmp/deps.err")"
printf '%s\n' "$DID" | grep -q -E '^sha256:[0-9a-f]{64}$' || fail "docker build -q --target deps printed '$DID', want sha256:<id>" "$(cat "$tmp/deps.err")"
if printf '%s\n' "$before" | grep -q -x -F -- "$DID"; then
  DEPS_NOTE="left in place: its id existed before the test (the cached stage exported onto another build's image)"
else
  DEPS_IMAGE="$DID"
  DEPS_NOTE="removed"
fi
run docker run --rm --entrypoint ls "$DID" -A /app
[ "$RC" -eq 0 ] || fail "docker run --rm --entrypoint ls <deps> -A /app: exit $RC" "$OUT$ERR"
DEPS_APP="$OUT"
for s in .git .github .gitignore .gitattributes docs factory target .bridle .claude .claude-sessions .worktrees crates \
         Cargo.toml Cargo.lock compose.yaml Dockerfile .dockerignore .env .env.example .env.local; do
  if printf '%s\n' "$DEPS_APP" | grep -q -x -F -- "$s"; then
    fail "the build context (deps stage /app) holds $s: .dockerignore does not keep it out" "$DEPS_APP"
  fi
done
bad="$(printf '%s\n' "$DEPS_APP" | grep -E '\.md$' || true)"
[ -z "$bad" ] || fail "markdown files reached the build context:" "$bad"
for s in package.json pnpm-lock.yaml pnpm-workspace.yaml packages tools node_modules; do
  printf '%s\n' "$DEPS_APP" | grep -q -x -F -- "$s" || fail "the deps stage /app lacks $s (the listing is not the workspace)" "$DEPS_APP"
done
run docker run --rm --entrypoint ls "$DID" -A /app/tools
[ "$RC" -eq 0 ] && [ "$OUT" = "entrypoint.sh" ] \
  || fail "ls -A /app/tools in the deps stage lists '$OUT' (exit $RC), want exactly entrypoint.sh (tools/* but the entrypoint stays out)" "$ERR"
run docker run --rm --entrypoint ls "$DID" /app/node_modules/.pnpm
[ "$RC" -eq 0 ] || fail "ls /app/node_modules/.pnpm in the deps stage: exit $RC" "$OUT$ERR"
PNPM_N="$(printf '%s\n' "$OUT" | grep -c . || true)"
[ "$PNPM_N" -ge 1 ] || fail "/app/node_modules/.pnpm in the deps stage is empty (the full install did not run)"
darwin="$(printf '%s\n' "$OUT" | grep -c darwin || true)"
[ "$darwin" -eq 0 ] || fail "$darwin darwin entries under /app/node_modules/.pnpm: the host's macOS node_modules leaked into the image" \
  "$(printf '%s\n' "$OUT" | grep darwin)"
linux="$(printf '%s\n' "$OUT" | grep -c linux || true)"
sect="$(sed -n '/^## Build$/,/^## Test$/p' "$CARD")"
printf '%s\n' "$sect" | grep -q -F 'bridle:dev' || fail "the card's ## Build does not name bridle:dev"
printf '%s\n' "$sect" | grep -q -E '[0-9] MB' || fail "the card's ## Build records no '<n> MB' image size"
MB_LINE="$(printf '%s\n' "$sect" | grep -o -E '[0-9][0-9,]* MB' | head -n 1)"
if [ -n "$DEPS_IMAGE" ]; then
  out="$(docker image rm "$DEPS_IMAGE" 2>&1)" || fail "docker image rm $DEPS_IMAGE (the deps-stage image the test built) failed" "$out"
  DEPS_IMAGE=""
fi
out="$(inspect '{{.Id}}')" || fail "$IMAGE is gone after the context case: $out"
echo "# .dockerignore: node_modules, target, .bridle, .git*, docs, factory, .env*, tools/*, !tools/entrypoint.sh present as whole lines"
echo "# docker build -q --target deps: $(printf '%s' "$DID" | cut -c8-19) in $((t1 - t0)) s; /app: $(printf '%s\n' "$DEPS_APP" | tr '\n' ' ')"
echo "# none of .git .github .gitignore .gitattributes docs factory target .bridle .claude .claude-sessions .worktrees crates Cargo.* compose.yaml" \
     "Dockerfile .dockerignore .env .env.example .env.local or *.md in /app; /app/tools: entrypoint.sh only;" \
     "node_modules/.pnpm: $PNPM_N entries, $linux linux, 0 darwin"
echo "# card ## Build names bridle:dev and '$MB_LINE'; deps-stage image $DEPS_NOTE; $IMAGE kept ($(printf '%s' "$out" | cut -c8-19))"
echo "ok - context"

# ---- docs (Files) -----------------------------------------------------------------------------------------------
CASE=docs
grep -q -x -F '## Application image' "$DOC" || fail "docs/ops/local-dev.md has no '## Application image' section"
for s in Dockerfile .dockerignore tools/entrypoint.sh bridle:dev GIT_SHA --serve /healthz 3000 web worker judge system 1000 \
         tools/test/image.test.sh; do
  grep -q -F -- "$s" "$DOC" || fail "docs/ops/local-dev.md does not name '$s'"
done
grep -q -F -- "$BASE_REF" "$DOC" || fail "docs/ops/local-dev.md does not quote the Dockerfile's base image '$BASE_REF' verbatim"
n="$(grep -c -F 'Application containers are card P0-02.4' "$DOC" || true)"
[ "$n" -eq 0 ] || fail "the intro of docs/ops/local-dev.md still says 'Application containers are card P0-02.4' (it must point at the Application image section)"
echo "# docs/ops/local-dev.md: '## Application image'; names Dockerfile, .dockerignore, tools/entrypoint.sh, bridle:dev, GIT_SHA, --serve," \
     "/healthz, 3000, web, worker, judge, system, 1000, tools/test/image.test.sh and the base image $BASE_REF verbatim"
echo "ok - docs"
echo "# 6 cases in $(( $(date +%s) - T_START )) s; built $IMAGE ($mb MB, revision $sha) and kept it; container and deps-stage image removed"
exit 0
