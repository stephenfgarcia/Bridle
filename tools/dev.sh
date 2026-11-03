#!/usr/bin/env bash
# Bridle local services (card P0-02.2): the docker compose stack behind `pnpm dev`, `pnpm dev:down` and
# `pnpm dev:reset`. Everything it reads comes from compose.yaml and .env.example (committed dev defaults);
# .env.local is never read (docs/ops/secrets.md). The stack is documented in docs/ops/local-dev.md.
#
# Usage:
#   bash tools/dev.sh [up|down|reset]     (from any directory; the script cd's to the repository root)
#   pnpm dev | pnpm dev:down | pnpm dev:reset
#
# up (default):
#   1 preflight: the docker engine answers `docker info`; `docker compose config -q` passes; when no
#     container of the project is running, the host ports 55432 9000 9001 1025 8025 are free (lsof)
#   2 `docker compose up -d --wait --wait-timeout 120` (the first run pulls about 240 MB of images)
#   3 `docker compose run --rm -T minio-init`: the profile-gated one-shot that creates the S3_BUCKET
#     bucket over the S3 API (idempotent: `present` or `created`)
#   4 one check per service, one line each, then a summary:
#       dev: postgres ok (SELECT 1 via DATABASE_URL, 127.0.0.1:55432)
#       dev: minio ok (health, bucket bridle-dev, api 127.0.0.1:9000, console http://127.0.0.1:9001/rustfs/console/)
#       dev: mailpit ok (api v1 <version>, smtp 127.0.0.1:1025, ui http://127.0.0.1:8025)
#       dev: 3/3 services ok in <t>s
#     A failed check prints `dev: <service> FAILED: <why>` and the service's last 20 log lines on stderr
#     and exits 1. A second `up` is idempotent: nothing is recreated, the same lines come back.
# down:  `docker compose down --remove-orphans`; the named volumes (the data) stay.
# reset: `docker compose down --volumes --remove-orphans`; containers and volumes go.
# Anything else prints the usage and exits 2.
# Needs bash 3.2, docker with compose v2+ (OrbStack or Docker Desktop), curl >= 7.75 (--aws-sigv4), sed,
# awk; lsof when present (the port preflight is skipped without it).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -d "$HOME/.orbstack/bin" ] && PATH="$HOME/.orbstack/bin:$PATH"
export PATH

set -a
. ./.env.example
set +a

PG_HOST_PORT=55432 # compose.yaml publishes postgres's 5432 here (Homebrew postgresql@16 holds 5432)
PORTS="$PG_HOST_PORT 9000 9001 1025 8025"
SERVICES=3

usage() {
  echo "usage: bash tools/dev.sh [up|down|reset]   (pnpm dev | pnpm dev:down | pnpm dev:reset)" >&2
  exit 2
}

die() {
  echo "dev: $*" >&2
  exit 1
}

failed() { # $1 = service, $2 = why: the failure line, the service's last log lines, exit 1
  echo "dev: $1 FAILED: $2" >&2
  docker compose logs --tail 20 "$1" >&2 || true
  exit 1
}

s3() { # a SigV4-signed S3 request with the .env.example credentials; prints the HTTP status code
  curl -sS -o /dev/null -w '%{http_code}' --aws-sigv4 "aws:amz:$S3_REGION:s3" \
    --user "$S3_ACCESS_KEY_ID:$S3_SECRET_ACCESS_KEY" "$@"
}

tcp_open() { # $1 = host, $2 = port: true when something accepts a TCP connection there (bash's /dev/tcp)
  (exec 3<>"/dev/tcp/$1/$2") 2>/dev/null
}

preflight() {
  docker info >/dev/null 2>&1 || die "docker engine not reachable (open -a OrbStack)"
  docker compose config -q
  [ -z "$(docker compose ps -q 2>/dev/null)" ] || return 0 # the stack is (partly) up: the ports are ours
  command -v lsof >/dev/null 2>&1 || return 0
  local p owner
  for p in $PORTS; do
    # lsof exits 1 when nothing listens: `|| true` keeps that from tripping set -e / pipefail
    owner="$( (lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null || true) | awk 'NR == 2 { print $1, $2 }')"
    [ -z "$owner" ] || die "port $p is in use by $owner: stop it first (see docs/ops/local-dev.md)"
  done
}

cmd_up() {
  local out code ver pg_url
  preflight
  docker compose up -d --wait --wait-timeout 120

  # bucket bootstrap: a one-shot behind the `init` profile (never through `up`, which would exit 1 on it)
  out="$(docker compose --progress quiet run --rm -T minio-init 2>&1)" || failed minio "minio-init: $out"
  printf '%s\n' "$out" | sed 's/^/dev: minio-init: /'

  # postgres: SELECT 1 through DATABASE_URL, re-addressed to the container network so that pg_hba's
  # scram rule really checks the password (127.0.0.1 inside the container would be trusted)
  pg_url="$(printf '%s' "$DATABASE_URL" | sed "s|@127\.0\.0\.1:$PG_HOST_PORT/|@postgres:5432/|")"
  [ "$pg_url" != "$DATABASE_URL" ] ||
    failed postgres "DATABASE_URL does not point at 127.0.0.1:$PG_HOST_PORT: $DATABASE_URL"
  out="$(docker compose exec -T postgres psql "$pg_url" -tAc 'SELECT 1' 2>&1)" ||
    failed postgres "psql via DATABASE_URL: $out"
  [ "$out" = "1" ] || failed postgres "SELECT 1 printed '$out'"
  tcp_open 127.0.0.1 "$PG_HOST_PORT" || failed postgres "nothing listens on 127.0.0.1:$PG_HOST_PORT"
  echo "dev: postgres ok (SELECT 1 via DATABASE_URL, 127.0.0.1:$PG_HOST_PORT)"

  # minio (RustFS): the health endpoint and a signed GET of the bucket over the host port
  out="$(curl -sS -f "$S3_ENDPOINT/health" 2>&1)" || failed minio "$S3_ENDPOINT/health: $out"
  code="$(s3 "$S3_ENDPOINT/$S3_BUCKET/?max-keys=0" 2>&1)" || failed minio "signed GET /$S3_BUCKET/: $code"
  [ "$code" = "200" ] || failed minio "signed GET /$S3_BUCKET/ answered $code, want 200"
  echo "dev: minio ok (health, bucket $S3_BUCKET, api ${S3_ENDPOINT#http://}, console http://127.0.0.1:9001/rustfs/console/)"

  # mailpit: the HTTP API answers with its version; SMTP accepts a connection
  out="$(curl -sS -f "$MAILPIT_URL/api/v1/info" 2>&1)" || failed mailpit "$MAILPIT_URL/api/v1/info: $out"
  ver="$(printf '%s' "$out" | sed -n 's/.*"Version":"\([^"]*\)".*/\1/p')"
  [ -n "$ver" ] || failed mailpit "no Version in the api v1 info: $out"
  tcp_open "$SMTP_HOST" "$SMTP_PORT" || failed mailpit "nothing listens on $SMTP_HOST:$SMTP_PORT (smtp)"
  echo "dev: mailpit ok (api v1 $ver, smtp $SMTP_HOST:$SMTP_PORT, ui $MAILPIT_URL)"

  echo "dev: $SERVICES/$SERVICES services ok in ${SECONDS}s"
}

cmd_down() {
  docker compose down --remove-orphans
  echo "dev: down (volumes bridle_postgres-data, bridle_minio-data kept; pnpm dev:reset removes them)"
}

cmd_reset() {
  docker compose down --volumes --remove-orphans
  echo "dev: reset (containers and volumes removed)"
}

case "${1:-up}" in
  up) cmd_up ;;
  down) cmd_down ;;
  reset) cmd_reset ;;
  *) usage ;;
esac
