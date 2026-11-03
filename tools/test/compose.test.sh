#!/usr/bin/env bash
# Tests for the docker compose stack and the pnpm dev smoke (card P0-02.2): one case per acceptance criterion,
# in the plan's order config, up, idempotent, down, docs.
#   config      AC1       `docker compose config -q` exits 0; `docker compose config --services` lists exactly
#                         mailpit, minio, postgres (minio-init stays behind its profile); `docker compose --profile
#                         init config --format json` has exactly the services postgres, minio, mailpit, minio-init
#                         with the images postgres:16.15-alpine, rustfs/rustfs:1.0.4 (minio and minio-init),
#                         axllent/mailpit:v1.32.0, none untagged or :latest; published ports 55432->5432
#                         (postgres), 9000 and 9001 (minio), 1025 and 8025 (mailpit), none on minio-init;
#                         postgres and minio each mount a top-level named volume (bridle_postgres-data at
#                         /var/lib/postgresql/data, bridle_minio-data at /data) and nothing binds a host path;
#                         a healthcheck on the three long-running services, postgres's running pg_isready;
#                         minio-init carries profile init and nothing else carries a profile; the rendered
#                         POSTGRES_USER/PASSWORD/DB, RUSTFS_ACCESS_KEY, RUSTFS_SECRET_KEY, RUSTFS_REGION and
#                         minio-init's S3_BUCKET equal .env.example's values; in the compose.yaml source every
#                         env_file entry is .env.example (three blocks) and no non-comment line names .env.local;
#                         no .env file at the root; .env.example holds only comments and KEY=value lines (no
#                         quotes, spaces or ${}) with S3_ACCESS_KEY_ID == RUSTFS_ACCESS_KEY, S3_SECRET_ACCESS_KEY
#                         == RUSTFS_SECRET_KEY, DATABASE_URL == postgresql://<user>:<password>@127.0.0.1:55432/<db>,
#                         S3_BUCKET == bridle-dev, S3_ENDPOINT == http://127.0.0.1:9000, SMTP 127.0.0.1:1025,
#                         MAILPIT_URL == http://127.0.0.1:8025; .gitignore names .env.local; the negative proof:
#                         in a copy of the clone's files under mktemp a .env.local with POSTGRES_PASSWORD=not-this
#                         leaves `docker compose config` rendering .env.example's value, and (the control) editing
#                         the copy's .env.example does change the rendered value
#   up          AC2, AC4  with the stack down (`pnpm dev:down` first when it was up; the volumes stay), `pnpm dev`
#                         from the root exits 0 in under 180 s printing exactly one `dev: postgres ok (...)`, one
#                         `dev: minio ok (...)`, one `dev: mailpit ok (...)` line, no `FAILED` line, and
#                         `dev: 3/3 services ok in <t>s` last; `docker compose ps -a --format json` shows exactly
#                         bridle-postgres-1, bridle-minio-1, bridle-mailpit-1 running and healthy and no minio-init
#                         container; `docker compose exec -T postgres psql -tAc 'SELECT 1'` prints 1; from the host
#                         `curl -sf http://127.0.0.1:9000/health` and `curl -sf http://127.0.0.1:8025/api/v1/info`
#                         (JSON with Version) succeed; the SigV4-signed `GET http://127.0.0.1:9000/bridle-dev/
#                         ?max-keys=0` answers 200 and the same for no-such-bucket-<pid> answers 404; `nc -z
#                         127.0.0.1 1025` succeeds
#   idempotent  AC2       a second `pnpm dev` exits 0 in under 30 s with the same three ok lines and the 3/3 line,
#                         `dev: minio-init: bucket bridle-dev: present` (not recreated), the container IDs of
#                         `docker compose ps -q` unchanged (nothing recreated) and the bucket GET still 200
#   down        AC2       `pnpm dev:down` exits 0 printing `dev: down (volumes bridle_postgres-data,
#                         bridle_minio-data kept; ...)`; `docker compose ps -aq` is empty; `docker volume ls -q
#                         --filter label=com.docker.compose.project=bridle` still lists both volumes; nothing
#                         accepts TCP on 127.0.0.1:55432, 9000 and 8025 (nc -z fails) and lsof lists no listener
#   docs        AC3       docs/ops/local-dev.md names postgres, minio, mailpit, each of 55432, 9000, 9001, 1025,
#                         8025, .env.example, .env.local, pnpm dev, pnpm dev:down, pnpm dev:reset, --volumes, and
#                         every image: value of compose.yaml verbatim
#
# Run:  bash tools/test/compose.test.sh      (from any directory; the script finds the repository from its own path)
# In this harness: . "$HOME/.cargo/env"; . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null;
#                  export PATH="$HOME/.orbstack/bin:/usr/local/bin:$PATH"; bash tools/test/compose.test.sh
# Never wire this file into `pnpm test`: it drives the real `bridle` compose project (down, up, up, down).
# Prints `ok - <case>` per case (and `# ...` comment lines with the measured output); stops at the first failed
# assertion with `not ok - <case>: <why>` and the command's output on stderr, exit 1. Needs bash 3.2, docker with
# compose v2+ (OrbStack or Docker Desktop, engine running), pnpm, node, python3, curl >= 7.75 (--aws-sigv4), lsof,
# nc, git, tar, awk, sed, grep, sort, mktemp, date. It keeps the data volumes (it never runs `pnpm dev:reset`),
# writes nothing inside the repository (the .env.local fixture lives only in a copy under `mktemp -d`, removed on
# exit), and leaves the stack down unless it was up when the test started, in which case the EXIT trap runs
# `pnpm dev` again. About 30 s with the images pulled; the first run on a machine pulls about 840 MB.
set -u
set -o pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="$ROOT/compose.yaml"
ENV_EXAMPLE="$ROOT/.env.example"
DOC="$ROOT/docs/ops/local-dev.md"
PG_HOST_PORT=55432  # compose.yaml publishes postgres's 5432 here (a Homebrew postgresql@16 holds 5432)
CASE=setup
WAS_UP=0   # the project had containers when the test started
TOUCHED=0  # the test brought the stack down (the EXIT trap restores it when WAS_UP)
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

cleanup() {  # EXIT trap: the mktemp copy goes; the stack comes back when the test found it up
  local rc=$? out
  [ -n "$tmp" ] && rm -rf "$tmp"
  if [ "$WAS_UP" -eq 1 ] && [ "$TOUCHED" -eq 1 ]; then
    if out="$(cd "$ROOT" && pnpm dev 2>&1)"; then
      echo "# the stack was up when the test started: pnpm dev ran it again ($(printf '%s\n' "$out" | grep '^dev: [0-9]/[0-9] services ok' | tail -n 1))"
    else
      echo "# the stack was up when the test started, but pnpm dev could not bring it back:" >&2
      printf '%s\n' "$out" >&2
    fi
  fi
  exit "$rc"
}
trap cleanup EXIT

for t in docker pnpm node python3 curl lsof nc git tar awk sed grep sort mktemp date; do
  command -v "$t" >/dev/null 2>&1 || fail "$t is not on PATH (see the header)"
done
[ -f "$COMPOSE" ] || fail "compose.yaml does not exist at the repository root"
[ -f "$ENV_EXAMPLE" ] || fail ".env.example does not exist at the repository root"
[ -f "$DOC" ] || fail "docs/ops/local-dev.md does not exist"
docker info >/dev/null 2>&1 || fail "the docker engine is not reachable (open -a OrbStack)"
tmp="$(mktemp -d)" || fail "mktemp -d failed"
case "$tmp" in "$ROOT"/*) fail "mktemp -d gave a directory inside the repository: $tmp" ;; esac
[ -n "$(cd "$ROOT" && docker compose ps -aq 2>/dev/null)" ] && WAS_UP=1

# ---- helpers --------------------------------------------------------------------------------------------------

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
s3() {  # a SigV4-signed S3 request with the .env.example keys (sourced in the config case); prints the status code
  curl -sS -o /dev/null -w '%{http_code}' --aws-sigv4 "aws:amz:${S3_REGION}:s3" \
    --user "${S3_ACCESS_KEY_ID}:${S3_SECRET_ACCESS_KEY}" "$@"
}
dev_lines() {  # $1 = pnpm dev output: its `dev:` lines
  printf '%s\n' "$1" | grep '^dev: '
}
count_line() {  # $1 = output, $2 = extended regex: how many lines match
  printf '%s\n' "$1" | grep -c -E "$2"
}
render() {  # $1 = directory, $2 = service, $3 = key: the value `docker compose config` renders there
  (cd "$1" && docker compose --profile init config --format json 2>/dev/null) | python3 -c '
import json, sys
svc = json.load(sys.stdin)["services"][sys.argv[1]]
print((svc.get("environment") or {}).get(sys.argv[2], ""))' "$2" "$3"
}
PG_LINE="^dev: postgres ok \(SELECT 1 via DATABASE_URL, 127\.0\.0\.1:$PG_HOST_PORT\)\$"
MINIO_LINE="^dev: minio ok \(health, bucket bridle-dev, api 127\.0\.0\.1:9000, console http://127\.0\.0\.1:9001"
MAILPIT_LINE="^dev: mailpit ok \(api v1 v[0-9][0-9.]*, smtp 127\.0\.0\.1:1025, ui http://127\.0\.0\.1:8025\)\$"
SUMMARY_LINE="^dev: 3/3 services ok in [0-9]+s\$"
assert_dev_lines() {  # $1 = pnpm dev output, $2 = label: exactly one ok line per service, no FAILED, the summary last
  local n last
  n="$(count_line "$1" "$PG_LINE")"
  [ "$n" -eq 1 ] || fail "$2: expected exactly one 'dev: postgres ok (SELECT 1 via DATABASE_URL, 127.0.0.1:$PG_HOST_PORT)' line, found $n" "$1"
  n="$(count_line "$1" "$MINIO_LINE")"
  [ "$n" -eq 1 ] || fail "$2: expected exactly one 'dev: minio ok (health, bucket bridle-dev, api 127.0.0.1:9000, console http://127.0.0.1:9001...' line, found $n" "$1"
  n="$(count_line "$1" "$MAILPIT_LINE")"
  [ "$n" -eq 1 ] || fail "$2: expected exactly one 'dev: mailpit ok (api v1 v<version>, smtp 127.0.0.1:1025, ui http://127.0.0.1:8025)' line, found $n" "$1"
  n="$(count_line "$1" '^dev: .*FAILED')"
  [ "$n" -eq 0 ] || fail "$2: a 'dev: <service> FAILED' line" "$1"
  n="$(count_line "$1" "$SUMMARY_LINE")"
  [ "$n" -eq 1 ] || fail "$2: expected exactly one 'dev: 3/3 services ok in <t>s' line, found $n" "$1"
  last="$(dev_lines "$1" | tail -n 1)"
  printf '%s\n' "$last" | grep -q -E "$SUMMARY_LINE" || fail "$2: the last dev: line is '$last', want 'dev: 3/3 services ok in <t>s'" "$1"
}

# ---- config (AC1) -----------------------------------------------------------------------------------------------
CASE=config
run_in "$ROOT" docker compose config -q
[ "$RC" -eq 0 ] || fail "docker compose config -q: exit $RC" "$OUT"
run_in "$ROOT" docker compose config --services
[ "$RC" -eq 0 ] || fail "docker compose config --services: exit $RC" "$OUT"
have="$(printf '%s\n' "$OUT" | sort | tr '\n' ' ')"
[ "$have" = "mailpit minio postgres " ] \
  || fail "docker compose config --services: expected 'mailpit minio postgres' (minio-init behind its profile), got '$have'" "$OUT"

run_to "$ROOT" "$tmp/config.json" docker compose --profile init config --format json
[ "$RC" -eq 0 ] || fail "docker compose --profile init config --format json: exit $RC" "$OUT"
OUT="$(python3 -c '
import json, sys
cfg = json.load(open(sys.argv[1], encoding="utf-8"))
env = {}
for raw in open(sys.argv[2], encoding="utf-8"):
    line = raw.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k] = v
pg_port = int(sys.argv[3])
svcs = cfg.get("services") or {}
want = {"postgres", "minio", "mailpit", "minio-init"}
if set(svcs) != want:
    sys.exit("services are %s, want exactly %s" % (sorted(svcs), sorted(want)))
images = {"postgres": "postgres:16.15-alpine", "minio": "rustfs/rustfs:1.0.4",
          "minio-init": "rustfs/rustfs:1.0.4", "mailpit": "axllent/mailpit:v1.32.0"}
for n, img in images.items():
    have = svcs[n].get("image")
    if have != img:
        sys.exit("%s image is %r, want %r" % (n, have, img))
    last = have.rsplit("/", 1)[-1]
    tag = last.split(":", 1)[1] if ":" in last else ""
    if not tag or tag == "latest":
        sys.exit("%s image %r is not pinned by an exact tag" % (n, have))
ports = {"postgres": {(pg_port, 5432)}, "minio": {(9000, 9000), (9001, 9001)},
         "mailpit": {(1025, 1025), (8025, 8025)}, "minio-init": set()}
for n, want_ports in ports.items():
    have = set()
    for p in svcs[n].get("ports") or []:
        if not isinstance(p, dict):
            sys.exit("%s port entry %r is not in the long form (compose normalizes ports: is this compose v2+?)" % (n, p))
        have.add((int(p["published"]), int(p["target"])))
    if have != want_ports:
        sys.exit("%s publishes %s, want %s (host, container)" % (n, sorted(have), sorted(want_ports)))
top = cfg.get("volumes") or {}
for n, s in svcs.items():
    for v in s.get("volumes") or []:
        if not isinstance(v, dict) or v.get("type") != "volume":
            sys.exit("%s mounts %r: only top-level named volumes are allowed (no bind mounts)" % (n, v))
        if v.get("source") not in top:
            sys.exit("%s mounts volume %r, which is not a top-level volume (%s)" % (n, v.get("source"), sorted(top)))
mounts = {"postgres": ("postgres-data", "/var/lib/postgresql/data"), "minio": ("minio-data", "/data")}
for n, (src, dst) in mounts.items():
    have = {(v.get("source"), v.get("target")) for v in (svcs[n].get("volumes") or [])}
    if (src, dst) not in have:
        sys.exit("%s does not mount the named volume %s at %s: %s" % (n, src, dst, sorted(have)))
for v, name in (("postgres-data", "bridle_postgres-data"), ("minio-data", "bridle_minio-data")):
    if (top.get(v) or {}).get("name") != name:
        sys.exit("top-level volume %s renders as %r, want name %s (project bridle)" % (v, top.get(v), name))
if set(top) != {"postgres-data", "minio-data"}:
    sys.exit("top-level volumes are %s, want exactly postgres-data and minio-data" % sorted(top))
for n in ("postgres", "minio", "mailpit"):
    hc = svcs[n].get("healthcheck") or {}
    if not hc.get("test") or hc.get("disable"):
        sys.exit("%s has no healthcheck" % n)
    if svcs[n].get("profiles"):
        sys.exit("%s carries profiles %r: a plain up must start it" % (n, svcs[n].get("profiles")))
hc = " ".join(svcs["postgres"]["healthcheck"]["test"])
if "pg_isready" not in hc:
    sys.exit("postgres healthcheck does not run pg_isready: %r" % hc)
if svcs["minio-init"].get("profiles") != ["init"]:
    sys.exit("minio-init profiles are %r, want [init]" % svcs["minio-init"].get("profiles"))
pairs = (("postgres", "POSTGRES_USER", "POSTGRES_USER"), ("postgres", "POSTGRES_PASSWORD", "POSTGRES_PASSWORD"),
         ("postgres", "POSTGRES_DB", "POSTGRES_DB"), ("minio", "RUSTFS_ACCESS_KEY", "S3_ACCESS_KEY_ID"),
         ("minio", "RUSTFS_SECRET_KEY", "S3_SECRET_ACCESS_KEY"), ("minio", "RUSTFS_REGION", "S3_REGION"),
         ("minio-init", "S3_BUCKET", "S3_BUCKET"), ("minio-init", "S3_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY"),
         ("minio-init", "S3_REGION", "S3_REGION"))
for n, key, src in pairs:
    have = (svcs[n].get("environment") or {}).get(key)
    if have is None or have != env.get(src):
        sys.exit("%s renders %s=%r, want .env.example %s=%r (env_file must be .env.example)" % (n, key, have, src, env.get(src)))
print("services %s; images %s; postgres %d->5432, minio 9000 9001, mailpit 1025 8025; volumes %s; healthchecks on postgres (pg_isready), minio, mailpit; minio-init profile init"
      % (" ".join(sorted(svcs)), " ".join(sorted(set(images.values()))), pg_port, " ".join(sorted(v["name"] for v in top.values()))))
' "$tmp/config.json" "$ENV_EXAMPLE" "$PG_HOST_PORT" 2>&1)" || fail "docker compose --profile init config --format json: $OUT"
CONFIG_SUMMARY="$OUT"

# env_file in the source: `config` folds env_file into environment, so the paths are checked in compose.yaml itself
n="$(grep -c -E '^[[:space:]]*env_file:' "$COMPOSE")"
[ "$n" -eq 3 ] || fail "compose.yaml: expected three env_file blocks (postgres, minio, minio-init), found $n"
ENV_FILES="$(awk '
  /^[[:space:]]*env_file:/ { rest = $0; sub(/^[[:space:]]*env_file:[[:space:]]*/, "", rest)
                             if (rest != "") print rest; else inlist = 1; next }
  inlist && /^[[:space:]]*-[[:space:]]*/ { sub(/^[[:space:]]*-[[:space:]]*/, ""); print; next }
  { inlist = 0 }' "$COMPOSE" | sed 's/[[:space:]]*#.*$//; s/^["'"'"']//; s/["'"'"']$//')"
n="$(printf '%s\n' "$ENV_FILES" | grep -c .)"
[ "$n" -eq 3 ] || fail "compose.yaml: expected three env_file entries, found $n" "$ENV_FILES"
bad="$(printf '%s\n' "$ENV_FILES" | grep -v -x -F '.env.example' || true)"
[ -z "$bad" ] || fail "compose.yaml: env_file entries other than .env.example:" "$bad"
n="$(grep -v -E '^[[:space:]]*#' "$COMPOSE" | grep -c -F '.env.local')"
[ "$n" -eq 0 ] || fail "compose.yaml names .env.local outside a comment ($n lines)"
[ ! -e "$ROOT/.env" ] || fail "a .env file exists at the root: compose would read it (docs/ops/local-dev.md says not to add one)"

# .env.example: comments and plain KEY=value lines only, and the relations tools/dev.sh and compose rely on
re='^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]"'"'"'$]*$'
bad="$(grep -v -E '^[[:space:]]*(#|$)' "$ENV_EXAMPLE" | grep -v -E "$re" || true)"
[ -z "$bad" ] || fail ".env.example: lines that are not plain KEY=value (no quotes, spaces or \${}):" "$bad"
. "$ENV_EXAMPLE" || fail "cannot source .env.example"
for k in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID \
         S3_SECRET_ACCESS_KEY RUSTFS_ACCESS_KEY RUSTFS_SECRET_KEY SMTP_HOST SMTP_PORT MAILPIT_URL; do
  eval "v=\${$k-}"
  [ -n "$v" ] || fail ".env.example: $k is missing or empty"
done
[ "$S3_ACCESS_KEY_ID" = "$RUSTFS_ACCESS_KEY" ] \
  || fail ".env.example: S3_ACCESS_KEY_ID ($S3_ACCESS_KEY_ID) != RUSTFS_ACCESS_KEY ($RUSTFS_ACCESS_KEY)"
[ "$S3_SECRET_ACCESS_KEY" = "$RUSTFS_SECRET_KEY" ] \
  || fail ".env.example: S3_SECRET_ACCESS_KEY ($S3_SECRET_ACCESS_KEY) != RUSTFS_SECRET_KEY ($RUSTFS_SECRET_KEY)"
want="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:$PG_HOST_PORT/$POSTGRES_DB"
[ "$DATABASE_URL" = "$want" ] || fail ".env.example: DATABASE_URL is $DATABASE_URL, want $want"
[ "$S3_BUCKET" = "bridle-dev" ] || fail ".env.example: S3_BUCKET is $S3_BUCKET, want bridle-dev"
[ "$S3_ENDPOINT" = "http://127.0.0.1:9000" ] || fail ".env.example: S3_ENDPOINT is $S3_ENDPOINT, want http://127.0.0.1:9000"
[ "$SMTP_HOST:$SMTP_PORT" = "127.0.0.1:1025" ] || fail ".env.example: SMTP is $SMTP_HOST:$SMTP_PORT, want 127.0.0.1:1025"
[ "$MAILPIT_URL" = "http://127.0.0.1:8025" ] || fail ".env.example: MAILPIT_URL is $MAILPIT_URL, want http://127.0.0.1:8025"
grep -q -x -F '.env.local' "$ROOT/.gitignore" || fail ".gitignore does not name .env.local"

# negative proof, in a copy of what a clone holds (tracked plus untracked-not-ignored; another session's
# untracked tools/agent-hq/ left out): a .env.local there changes nothing compose renders
COPY="$tmp/clone"
mkdir -p "$COPY" || fail "cannot create $COPY"
(cd "$ROOT" && git ls-files -z --cached --others --exclude-standard -- . ':(exclude)tools/agent-hq' \
   | tar --null -T - -cf - | tar -C "$COPY" -xf -) || fail "copying the clone's files into $COPY failed"
[ -f "$COPY/compose.yaml" ] && [ -f "$COPY/.env.example" ] \
  || fail "the copy has no compose.yaml or .env.example (not tracked and not untracked-unignored?)"
[ ! -e "$COPY/.env.local" ] || fail "the copy already holds a .env.local: it is not ignored by git"
[ ! -e "$COPY/.env" ] || fail "the copy holds a .env file"
printf 'POSTGRES_PASSWORD=not-this\nRUSTFS_SECRET_KEY=not-this\nS3_SECRET_ACCESS_KEY=not-this\n' > "$COPY/.env.local" \
  || fail "cannot write the fixture $COPY/.env.local"
v="$(render "$COPY" postgres POSTGRES_PASSWORD)" || fail "docker compose config in the copy with a .env.local failed"
[ "$v" = "$POSTGRES_PASSWORD" ] \
  || fail "with a .env.local in the copy, compose renders POSTGRES_PASSWORD='$v', want .env.example's '$POSTGRES_PASSWORD': .env.local leaked into the stack"
v="$(render "$COPY" minio RUSTFS_SECRET_KEY)" || fail "docker compose config in the copy with a .env.local failed"
[ "$v" = "$RUSTFS_SECRET_KEY" ] \
  || fail "with a .env.local in the copy, compose renders RUSTFS_SECRET_KEY='$v', want .env.example's '$RUSTFS_SECRET_KEY': .env.local leaked into the stack"
# the control: the same render does follow the copy's .env.example (so the assertions above are not vacuous)
sed 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=from-example-copy/' "$ROOT/.env.example" > "$COPY/.env.example" \
  || fail "cannot rewrite the copy's .env.example"
grep -q -x 'POSTGRES_PASSWORD=from-example-copy' "$COPY/.env.example" || fail "fixture: the copy's .env.example was not rewritten"
v="$(render "$COPY" postgres POSTGRES_PASSWORD)" || fail "docker compose config in the copy failed"
[ "$v" = "from-example-copy" ] \
  || fail "control: with POSTGRES_PASSWORD=from-example-copy in the copy's .env.example compose renders '$v': env_file is not read from .env.example"
echo "# $CONFIG_SUMMARY"
echo "# compose.yaml: 3 env_file entries, all .env.example, no .env.local outside comments; .env.example KEY=value only," \
     "S3_*/RUSTFS_* pairs equal, DATABASE_URL on 127.0.0.1:$PG_HOST_PORT, bucket $S3_BUCKET; .gitignore names .env.local"
echo "# copy under mktemp with .env.local (POSTGRES_PASSWORD=not-this): compose still renders POSTGRES_PASSWORD=$POSTGRES_PASSWORD," \
     "RUSTFS_SECRET_KEY=$RUSTFS_SECRET_KEY; control: editing the copy's .env.example renders from-example-copy"
echo "ok - config"

# ---- up (AC2, AC4) ----------------------------------------------------------------------------------------------
CASE=up
if [ "$WAS_UP" -eq 1 ]; then
  TOUCHED=1
  run_in "$ROOT" pnpm dev:down
  [ "$RC" -eq 0 ] || fail "precondition: the stack was up and pnpm dev:down failed: exit $RC" "$OUT"
  echo "# the stack was up when the test started: pnpm dev:down first (volumes kept); the EXIT trap brings it back"
fi
ids="$(cd "$ROOT" && docker compose ps -aq)"
[ -z "$ids" ] || fail "precondition: docker compose ps -aq is not empty before pnpm dev" "$ids"
t0="$(date +%s)"
run_in "$ROOT" pnpm dev
t1="$(date +%s)"
UP_ELAPSED=$((t1 - t0))
[ "$RC" -eq 0 ] || fail "pnpm dev from the root: exit $RC" "$OUT"
UP_OUT="$OUT"
[ "$UP_ELAPSED" -lt 180 ] || fail "pnpm dev took $UP_ELAPSED s on the test's clock, limit 180 s" "$OUT"
assert_dev_lines "$UP_OUT" "pnpm dev"
n="$(count_line "$UP_OUT" '^dev: minio-init: bucket bridle-dev: (present|created)$')"
[ "$n" -eq 1 ] || fail "pnpm dev: expected one 'dev: minio-init: bucket bridle-dev: present|created' line, found $n" "$UP_OUT"

run_to "$ROOT" "$tmp/ps.json" docker compose ps -a --format json
[ "$RC" -eq 0 ] || fail "docker compose ps -a --format json: exit $RC" "$OUT"
OUT="$(python3 -c '
import json, sys
text = open(sys.argv[1], encoding="utf-8").read().strip()
rows = json.loads(text) if text.startswith("[") else [json.loads(l) for l in text.splitlines() if l.strip()]
seen = {}
for r in rows:
    seen.setdefault(r.get("Service"), []).append(r)
want = {"postgres", "minio", "mailpit"}
if set(seen) != want:
    sys.exit("containers exist for services %s, want exactly %s (and no minio-init container)" % (sorted(seen), sorted(want)))
for n in ("postgres", "minio", "mailpit"):
    rs = seen[n]
    if len(rs) != 1:
        sys.exit("%d containers for %s, want 1" % (len(rs), n))
    r = rs[0]
    if r.get("Name") != "bridle-%s-1" % n:
        sys.exit("the %s container is named %r, want bridle-%s-1" % (n, r.get("Name"), n))
    if r.get("State") != "running" or r.get("Health") != "healthy":
        sys.exit("%s is %s/%s, want running/healthy" % (r.get("Name"), r.get("State"), r.get("Health")))
print("; ".join("%s %s %s" % (seen[n][0]["Name"], seen[n][0]["State"], seen[n][0]["Health"]) for n in ("postgres", "minio", "mailpit")))
' "$tmp/ps.json" 2>&1)" || fail "docker compose ps -a --format json: $OUT"
PS_SUMMARY="$OUT"
stray="$(docker ps -a --filter label=com.docker.compose.project=bridle --filter label=com.docker.compose.service=minio-init -q)"
[ -z "$stray" ] || fail "a minio-init container is left behind (docker compose run --rm should remove it)" "$stray"

run_in "$ROOT" docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SELECT 1'
[ "$RC" -eq 0 ] || fail "docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -tAc 'SELECT 1': exit $RC" "$OUT"
[ "$OUT" = "1" ] || fail "SELECT 1 printed '$OUT', want 1"
run_in "$ROOT" curl -sS -f http://127.0.0.1:9000/health
[ "$RC" -eq 0 ] || fail "curl -sf http://127.0.0.1:9000/health: exit $RC" "$OUT"
HEALTH="$(printf '%s' "$OUT" | head -c 60)"
run_in "$ROOT" curl -sS -f http://127.0.0.1:8025/api/v1/info
[ "$RC" -eq 0 ] || fail "curl -sf http://127.0.0.1:8025/api/v1/info: exit $RC" "$OUT"
MAILPIT_VERSION="$(printf '%s' "$OUT" | python3 -c '
import json, sys
d = json.load(sys.stdin)
v = d.get("Version")
if not v:
    sys.exit("no Version in %r" % d)
print(v)' 2>&1)" || fail "mailpit /api/v1/info: $MAILPIT_VERSION" "$OUT"
code="$(s3 "http://127.0.0.1:9000/$S3_BUCKET/?max-keys=0" 2>&1)" || fail "signed GET /$S3_BUCKET/?max-keys=0: curl failed: $code"
[ "$code" = "200" ] || fail "signed GET http://127.0.0.1:9000/$S3_BUCKET/?max-keys=0 answered $code, want 200 (the bucket exists)"
code="$(s3 "http://127.0.0.1:9000/no-such-bucket-$$/?max-keys=0" 2>&1)" || fail "signed GET /no-such-bucket-$$/: curl failed: $code"
[ "$code" = "404" ] || fail "signed GET /no-such-bucket-$$/?max-keys=0 answered $code, want 404 (otherwise the 200 above is a blanket answer)"
run_in "$ROOT" nc -z -w 3 127.0.0.1 1025
[ "$RC" -eq 0 ] || fail "nc -z 127.0.0.1 1025 (smtp): exit $RC" "$OUT"
IDS_UP="$(cd "$ROOT" && docker compose ps -q | sort)"
n="$(printf '%s\n' "$IDS_UP" | grep -c .)"
[ "$n" -eq 3 ] || fail "docker compose ps -q lists $n containers, want 3" "$IDS_UP"
echo "# pnpm dev from the down state: exit 0 in $UP_ELAPSED s (limit 180 s):"
dev_lines "$UP_OUT" | sed 's/^/#   /'
echo "# docker compose ps -a: $PS_SUMMARY; no minio-init container"
echo "# psql SELECT 1 -> 1; GET /health -> $HEALTH...; mailpit api v1 $MAILPIT_VERSION;" \
     "signed GET /$S3_BUCKET/ 200, /no-such-bucket-$$/ 404; nc -z 127.0.0.1 1025 ok"
echo "ok - up"

# ---- idempotent (AC2) -------------------------------------------------------------------------------------------
CASE=idempotent
t0="$(date +%s)"
run_in "$ROOT" pnpm dev
t1="$(date +%s)"
IDEM_ELAPSED=$((t1 - t0))
[ "$RC" -eq 0 ] || fail "second pnpm dev: exit $RC" "$OUT"
IDEM_OUT="$OUT"
[ "$IDEM_ELAPSED" -lt 30 ] || fail "second pnpm dev took $IDEM_ELAPSED s on the test's clock, limit 30 s" "$OUT"
assert_dev_lines "$IDEM_OUT" "second pnpm dev"
n="$(count_line "$IDEM_OUT" '^dev: minio-init: bucket bridle-dev: present$')"
[ "$n" -eq 1 ] || fail "second pnpm dev: expected one 'dev: minio-init: bucket bridle-dev: present' line (the bucket must not be recreated), found $n" "$IDEM_OUT"
IDS_AFTER="$(cd "$ROOT" && docker compose ps -q | sort)"
[ "$IDS_AFTER" = "$IDS_UP" ] \
  || fail "the container IDs changed across the second pnpm dev (something was recreated)" "$(printf 'before:\n%s\nafter:\n%s' "$IDS_UP" "$IDS_AFTER")"
code="$(s3 "http://127.0.0.1:9000/$S3_BUCKET/?max-keys=0" 2>&1)" || fail "signed GET /$S3_BUCKET/ after the second pnpm dev: curl failed: $code"
[ "$code" = "200" ] || fail "signed GET /$S3_BUCKET/ after the second pnpm dev answered $code, want 200"
echo "# second pnpm dev: exit 0 in $IDEM_ELAPSED s (limit 30 s); container IDs unchanged ($(printf '%s\n' "$IDS_UP" | cut -c1-12 | tr '\n' ' ')); bucket GET 200"
dev_lines "$IDEM_OUT" | sed 's/^/#   /'
echo "ok - idempotent"

# ---- down (AC2) -------------------------------------------------------------------------------------------------
CASE=down
TOUCHED=1
run_in "$ROOT" pnpm dev:down
[ "$RC" -eq 0 ] || fail "pnpm dev:down: exit $RC" "$OUT"
DOWN_OUT="$OUT"
printf '%s\n' "$DOWN_OUT" | grep -q -F 'dev: down (volumes bridle_postgres-data, bridle_minio-data kept' \
  || fail "pnpm dev:down: no 'dev: down (volumes bridle_postgres-data, bridle_minio-data kept; ...)' line" "$DOWN_OUT"
ids="$(cd "$ROOT" && docker compose ps -aq)"
[ -z "$ids" ] || fail "docker compose ps -aq is not empty after pnpm dev:down" "$ids"
vols="$(docker volume ls -q --filter label=com.docker.compose.project=bridle | sort)"
for v in bridle_minio-data bridle_postgres-data; do
  printf '%s\n' "$vols" | grep -q -x -F "$v" || fail "volume $v is gone after pnpm dev:down (data must survive a down)" "$vols"
done
for p in $PG_HOST_PORT 9000 8025; do
  run_in "$ROOT" nc -z -w 3 127.0.0.1 "$p"
  [ "$RC" -ne 0 ] || fail "something still accepts TCP on 127.0.0.1:$p after pnpm dev:down" "$OUT"
  owner="$( (lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null || true) | awk 'NR > 1 { print $1, $2 }')"
  [ -z "$owner" ] || fail "lsof: something still listens on port $p after pnpm dev:down: $owner"
done
echo "# pnpm dev:down: exit 0; $(dev_lines "$DOWN_OUT" | tail -n 1)"
echo "# docker compose ps -aq empty; volumes kept: $(printf '%s\n' "$vols" | tr '\n' ' ')| nothing listens on $PG_HOST_PORT 9000 8025 (nc, lsof)"
echo "ok - down"

# ---- docs (AC3) -------------------------------------------------------------------------------------------------
CASE=docs
for s in postgres minio mailpit "$PG_HOST_PORT" 9000 9001 1025 8025 .env.example .env.local 'pnpm dev' \
         'pnpm dev:down' 'pnpm dev:reset' --volumes; do
  grep -q -F -- "$s" "$DOC" || fail "docs/ops/local-dev.md does not name '$s'"
done
IMAGES="$(sed -n 's/^[[:space:]]*image:[[:space:]]*//p' "$COMPOSE" | sed 's/[[:space:]]*#.*$//; s/^["'"'"']//; s/["'"'"']$//' | sort -u)"
n="$(printf '%s\n' "$IMAGES" | grep -c .)"
[ "$n" -eq 3 ] || fail "compose.yaml: expected three distinct image: values, found $n" "$IMAGES"
for img in $IMAGES; do
  grep -q -F -- "$img" "$DOC" || fail "docs/ops/local-dev.md does not name the image $img verbatim"
done
echo "# docs/ops/local-dev.md names postgres, minio, mailpit, $PG_HOST_PORT 9000 9001 1025 8025, .env.example, .env.local," \
     "the three pnpm commands, --volumes and the images $(printf '%s\n' "$IMAGES" | tr '\n' ' ')"
echo "ok - docs"
exit 0
