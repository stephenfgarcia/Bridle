# Local development services

The stateful services a Bridle process needs on a developer machine run as one docker compose project
(`compose.yaml`, project name `bridle`), driven by three pnpm scripts. Nothing in it is a secret: every
credential is a committed default from `.env.example`. The application container image (one image, four
entrypoints) is the last section, "Application image"; migrations come later.

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

## Application image

The deployment unit of the architecture (sections 3, 15, 16): one container image, four entrypoints. The root
`Dockerfile` builds it and `tools/entrypoint.sh` dispatches on its first argument, `web`, `worker`, `judge` or
`system`. Every name is a stub today: it prints `<name> <sha>` and exits 0, or stays up behind `--serve` with a
health endpoint. P0-02.5 puts the Next.js server behind `web` and later cards the pg-boss processors behind the
other three, under the same names in the same image (card P0-02.4 introduced it).

The base image, verbatim from the Dockerfile (the only `FROM` with a tag; tag and digest are bumped together):

```
FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS base
```

Debian bookworm slim rather than alpine: glibc, so native modules need no musl builds; node 22.23.4 is the exact
version the host runs under nvm (`tools/toolchain.json` pins the major); 347 MB on disk as `docker images`
lists it on arm64 (343,893,906 bytes by `docker image inspect`), with corepack, no pnpm, no curl. The digest is
the multi-arch index (linux/arm64 and linux/amd64), so the same line builds on an M-series Mac and on an x86
runner.

| Stage | From | Does |
|---|---|---|
| `base` | the pinned image | nothing: the one place the version is typed |
| `deps` | `base` | `corepack enable pnpm && corepack install -g pnpm@12.16.1` (the toolchain pin, equal to `packageManager`), copies the `.dockerignore`'d context to `/app`, then `pnpm install --frozen-lockfile --store-dir /pnpm/store` with the store on a BuildKit cache mount (`--mount=type=cache,id=bridle-pnpm-store,target=/pnpm/store`): the layer is reused until the context changes, and when it does the packages come from the mount, not the network |
| `build` | `deps` | `pnpm exec turbo run build` (no package has a `build` script yet, so turbo runs nothing; apps/web's build lands in P0-02.5), then the prune: `rm -rf node_modules packages/*/node_modules` and `pnpm install --frozen-lockfile --prod --ignore-scripts` from the same mount (an in-place `--prod` over a full tree keeps too much) |
| `runtime` | `base` | copies `package.json`, `pnpm-workspace.yaml`, the pruned `node_modules`, `packages/` and `tools/entrypoint.sh` (mode 755), all owned by `node`; `NODE_ENV=production`, `PORT=3000`; then `ARG GIT_SHA` to `ENV GIT_SHA` and the `org.opencontainers.image.revision` label, last so a new sha re-runs only those lines; `USER node`, `EXPOSE 3000`, the `HEALTHCHECK`, `ENTRYPOINT ["/app/tools/entrypoint.sh"]`, no `CMD` |

Build and run, from the repository root (docker 29 with BuildKit, as OrbStack and Docker Desktop ship it):

```sh
docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t bridle:dev .
docker run --rm bridle:dev web                  # web a875638    (worker, judge, system alike)
docker run --rm bridle:dev                      # usage: entrypoint.sh (web|worker|judge|system) [--serve]   exit 2
docker run --rm bridle:dev bogus                # the same usage line on stderr, nothing on stdout, exit 2
docker run --rm --entrypoint id bridle:dev -u   # 1000  (the node user; nothing in the image runs as root)
docker run --rm -p 3000:3000 bridle:dev web --serve   # web a875638, then: web a875638 serving /healthz on :3000
curl -i http://127.0.0.1:3000/healthz           # 200 application/json {"ok":true,"entrypoint":"web","sha":"a875638"}
docker stop <container>                         # SIGTERM: the server closes and the process exits 0, not 137
```

Any path but `GET /healthz` answers 404. Without `--build-arg GIT_SHA=...` the sha is `unknown` (`web unknown`).
`GIT_SHA` and `PORT` are plain environment variables in the container, so `-e PORT=8080 -p 8080:8080` moves the
server. The same health server backs all four names under `--serve`, so the image's `HEALTHCHECK` (a `node -e`
probe of `http://127.0.0.1:$PORT/healthz` every 30 s, 3 s timeout, 5 s start period, 3 retries; there is no curl
in the image) is honest for every process. Docker honours it (`docker ps` shows `(healthy)`); ECS ignores image
healthchecks, and the task definition gets its own in P0-05.

Build context (`.dockerignore`): the pnpm workspace and the entrypoint, 13 files and 44 KB today: `package.json`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `.editorconfig`,
`.node-version`, `packages/*/{package.json,tsconfig.json,src/}`, `tools/entrypoint.sh`. Everything else stays out:
`.git*` (`.git`, `.github`, `.gitignore`, `.gitattributes`), `node_modules` and `**/node_modules` (the host's macOS
tree must never reach a Linux image), `**/.turbo`, `**/dist`, `**/*.tsbuildinfo`, the Rust workspace (`target`,
`crates`, `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `rustfmt.toml`), `.bridle`, `.claude`,
`.claude-sessions`, `.worktrees`, `docs`, `factory`, `tools/*` except the entrypoint, `compose.yaml`, the
`Dockerfile` and `.dockerignore` themselves, `*.md`, `**/.DS_Store`, and `.env*`: a developer's `.env.local`
(docs/ops/secrets.md) must never land in a layer, so the whole family is excluded, `.env.example` included (the
image needs none of it).

Measured on this machine (M4, OrbStack, the base image already pulled) by card P0-02.4 on 2026-11-03: cold build
(empty builder cache) 8 s wall, of which corepack's pnpm download 2.3 s and `pnpm install` 3.5 s; warm rebuild
with nothing changed under 1 s, every step `CACHED`; a changed source file re-runs the install from the store
mount in 2 s with `downloaded 0`; a new `GIT_SHA` alone rebuilds in under 1 s. Image size
(`docker image inspect bridle:dev --format '{{.Size}}'`) 343,942,622 bytes = 344 MB, of which 343,893,906 bytes
is the base image: the workspace adds 49 KB until the apps arrive. One cold build on 2026-11-03 failed at
`corepack install -g pnpm@12.16.1` with `Error when performing the request to https://registry.npmjs.org/...`
after 4 s (a transient registry fetch; the probe of the same step passed seconds later): run the build again,
a failed step is never cached.

Test: `bash tools/test/image.test.sh` (never part of `pnpm test`: it needs the docker engine; about 20 s warm, a
few minutes cold). It builds the image with the current sha, runs the four entrypoints, probes `--serve` on a random
loopback port, checks the unknown-name exit code and the build context, and reads this section.

Out of scope for the image today: pushing it to a registry (P0-05, with the ECS task definitions); Rust
compilation and the wasm artifacts (they are built by the Rust workspace and copied in by later cards, never
compiled here); a compose service for the application (`compose.yaml` stays services only).
