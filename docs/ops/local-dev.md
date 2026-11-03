# Local development services

The stateful services a Bridle process needs on a developer machine run as one docker compose project
(`compose.yaml`, project name `bridle`), driven by three pnpm scripts. Nothing in it is a secret: every
credential is a committed default from `.env.example`. Application containers are card P0-02.4, migrations
come later; this page covers only the services.

## Services

| Service | Image (pinned, verbatim) | Host ports | Data | Credentials (from `.env.example`) |
|---|---|---|---|---|
| `postgres` | `postgres:16.15-alpine` | **55432** (container port 5432) | named volume `bridle_postgres-data` at `/var/lib/postgresql/data` | `POSTGRES_USER=bridle`, `POSTGRES_PASSWORD=bridle`, `POSTGRES_DB=bridle`; `DATABASE_URL=postgresql://bridle:bridle@127.0.0.1:55432/bridle` |
| `minio` | `rustfs/rustfs:1.0.4` | 9000 (S3 API), 9001 (console, at `http://127.0.0.1:9001/rustfs/console/`) | named volume `bridle_minio-data` at `/data`; bucket `bridle-dev` | `S3_ACCESS_KEY_ID=bridle`, `S3_SECRET_ACCESS_KEY=bridle-local` (the same values as `RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY`, the server's root pair); `S3_ENDPOINT=http://127.0.0.1:9000`, `S3_REGION=us-east-1`, `S3_BUCKET=bridle-dev` |
| `mailpit` | `axllent/mailpit:v1.32.0` | 1025 (SMTP), 8025 (web UI and HTTP API) | in memory: a restart empties it | none; `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `MAILPIT_URL=http://127.0.0.1:8025` |
| `minio-init` (profile `init`) | `rustfs/rustfs:1.0.4` | none | none | the `S3_*` values; creates the `S3_BUCKET` bucket over the S3 API and exits |

Containers are named `bridle-<service>-1`. The three long-running services carry a healthcheck (`pg_isready`,
`GET /health`, `/mailpit readyz`) and `restart: unless-stopped`, so they come back with the docker engine until
`pnpm dev:down`. Ports are published on every interface of the host, as compose does by default; the
credentials are dev defaults, so do not run the stack on a network you do not trust.

Postgres is published on host port **55432**, not 5432: the development machine runs a Homebrew `postgresql@16`
on 5432 (`brew services list`), which the stack leaves alone. Inside the compose network the container port is
the usual 5432 (`postgres:5432`), which is what the application containers of P0-02.4 will use.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | `docker compose up -d --wait --wait-timeout 120`, then the `minio-init` one-shot (`docker compose run --rm -T minio-init`), then one check per service (below). Exit 0 only when all three pass. Idempotent: a second run recreates nothing and takes about a second. |
| `pnpm dev:down` | `docker compose down --remove-orphans`: stops and removes the containers and the network. The two data volumes stay. |
| `pnpm dev:reset` | `docker compose down --volumes --remove-orphans`: removes the containers and the volumes, that is, all local data. |

All three run `bash tools/dev.sh up|down|reset` (any other argument prints the usage, exit 2). The script works
from any directory, puts `~/.orbstack/bin` on PATH when that directory exists, and sources `.env.example` for
the values it checks. It needs bash 3.2, docker with compose v2 or later, curl 7.75 or later (`--aws-sigv4`),
sed and awk; lsof when present.

What `pnpm dev` prints, after compose's own progress lines:

```
dev: minio-init: bucket bridle-dev: present
dev: postgres ok (SELECT 1 via DATABASE_URL, 127.0.0.1:55432)
dev: minio ok (health, bucket bridle-dev, api 127.0.0.1:9000, console http://127.0.0.1:9001/rustfs/console/)
dev: mailpit ok (api v1 v1.32.0, smtp 127.0.0.1:1025, ui http://127.0.0.1:8025)
dev: 3/3 services ok in 8s
```

(`created` instead of `present` the first time.) What each line proves:

- `postgres`: `psql "$DATABASE_URL" -tAc 'SELECT 1'` prints `1`. The URL is re-addressed from
  `127.0.0.1:55432` to `postgres:5432` and run inside the container, because from the container network
  pg_hba's `scram-sha-256` rule really checks the password (a loopback connection would be trusted). The script
  also checks that something accepts TCP on 127.0.0.1:55432, the host mapping.
- `minio`: `GET http://127.0.0.1:9000/health` answers 200, and a SigV4-signed `GET /bridle-dev/?max-keys=0`
  with the `.env.example` keys answers 200. (A missing bucket answers 404, a wrong secret 403, an unsigned
  request 403: the 200 is not a blanket answer.)
- `mailpit`: `GET http://127.0.0.1:8025/api/v1/info` returns JSON with the version; something accepts TCP on
  127.0.0.1:1025.

A failing check prints `dev: <service> FAILED: <why>` and the service's last 20 log lines on stderr, exit 1.
Before anything starts, the script checks that the docker engine answers (`dev: docker engine not reachable
(open -a OrbStack)` otherwise), that `docker compose config -q` passes, and, when no container of the project
is running, that the five host ports are free: `dev: port <p> is in use by <command> <pid>: stop it first`.

The first `pnpm dev` pulls three images (about 840 MB on disk as `docker images` reports them; 16 s on a
fast link) and runs initdb; it took 8 s on an M4 with the images already pulled. Later runs take about a second.

## `.env.example` and `.env.local`

- `.env.example` is committed and holds every local default. Compose reads it through `env_file` (`postgres`,
  `minio`, `minio-init`) and `tools/dev.sh` sources it, so its format is the intersection of compose's dotenv
  and bash: comments on their own lines, every other line `KEY=value` with no quotes, no spaces and no `${}`.
- `.env.local` (gitignored, together with `.env.*.local`) holds the application secrets on a developer machine
  (docs/ops/secrets.md). Compose never reads it: no service names it in `env_file`, and the only file compose
  reads on its own is `.env`, which this repository does not have. A `POSTGRES_PASSWORD` in `.env.local`
  changes nothing in the stack.
- Do not add a `.env` file: compose would read it for interpolation and its values would silently diverge from
  `.env.example`.

## Reset and data

- Data lives in two named volumes, `bridle_postgres-data` and `bridle_minio-data` (`docker volume ls`).
  `pnpm dev:down` keeps them: tables and objects survive a down and up.
- `pnpm dev:reset` runs `docker compose down --volumes` and removes them. The next `pnpm dev` runs initdb
  again and `minio-init` recreates the empty bucket.
- Mailpit keeps mail in memory, so every restart, `pnpm dev:down` included, empties it. That is intended for
  a mail sink; open `http://127.0.0.1:8025` to read what the application sent since the last start.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `dev: docker engine not reachable (open -a OrbStack)` | The docker engine is not running (OrbStack or Docker Desktop). Start it; `bash tools/doctor.sh` shows the same `docker` row as `MISSING`. |
| `dev: port 55432 is in use by <command> <pid>` (or 9000, 9001, 1025, 8025) | Another process listens on a port the stack publishes. Stop it, or publish the service elsewhere in `compose.yaml` and update `.env.example` to match. The stack does not use port 5432 on the host: Homebrew `postgresql@16` keeps it, which is why postgres is published on 55432; leave that service alone. |
| `docker compose up` waits, then fails after `--wait-timeout 120` | A service never became healthy. `docker compose logs <service>` (`docker compose logs --tail 50 minio`); `docker compose ps` shows the health state. |
| `dev: minio FAILED: signed GET /bridle-dev/ answered 403` | The `S3_*` and `RUSTFS_*` pairs in `.env.example` differ, or `bridle_minio-data` holds a server set up with other keys. Make the pairs equal; if the keys were changed on purpose, `pnpm dev:reset`. |
| `dev: minio FAILED: minio-init: ...` | The bucket bootstrap failed; the message carries the HTTP status. `docker compose logs minio`, then `docker compose run --rm -T minio-init` to retry it by hand. |
| A table or object from an earlier session is gone | Someone ran `pnpm dev:reset`, which removes the volumes. `pnpm dev:down` keeps them. |
| `psql` from the host | `psql "$DATABASE_URL"` after `set -a; . ./.env.example; set +a`, with any psql 16 (Homebrew's works); or `docker compose exec postgres psql -U bridle -d bridle`. |

## Why RustFS stands in for MinIO

The architecture (docs/architecture/architecture.md, section on environments) and the CI card P0-02.3 say
MinIO, and the compose service keeps the name `minio` so that nothing written against the service name has
to change. The image is not MinIO, because there is no MinIO image left to pin: the MinIO project was
archived on 2026-04-24 (github.com/minio/minio is read-only, "no longer maintained", source-only since
RELEASE.2025-10-15T17-29-55Z), and `minio/minio` and `minio/mc` were withdrawn from Docker Hub and quay.io
(verified 2026-11-03 at the plan station). `rustfs/rustfs:1.0.4` (Apache-2.0, 1.0.0 GA 2026-09-16, 1.0.4
released 2026-10-25, linux/arm64 and linux/amd64) is an S3-compatible drop-in with the same shape: S3 API on
9000, a console on 9001, root credentials from `RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY` (it also accepts
`MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`), region `RUSTFS_REGION`, `GET /health`. Everything the
application needs is the S3 API with SigV4, which is what the smoke proves with curl. There is no `mc`
sidecar any more; the bucket bootstrap is curl's native SigV4 (`--aws-sigv4`) run inside the RustFS image
itself, so the stack is three images. The documented fallback, should RustFS fail, is
`versity/versitygw:v1.10.0` with the same compose shape. Staging and production use S3 itself (P0-05).

## Alpine Postgres and collation

`postgres:16.15-alpine` is built on musl. The database reports `datcollate = en_US.utf8`, but musl's
`strcoll` compares bytes, so text sorts in code-point order whatever the collation name says: on this stack
`SELECT 'a' < 'B'` is false, on glibc (`en_US.UTF-8`, as on RDS in P0-05) it is true. Do not rely on
linguistic ordering matching between local and staging; where order matters, sort with an explicit
`COLLATE "C"` or an ICU collation in the query or the column definition, which behaves the same everywhere.
