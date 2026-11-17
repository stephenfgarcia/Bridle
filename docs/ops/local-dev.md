# Local development services

The stateful services a Bridle process needs on a developer machine run as one docker compose project
(`compose.yaml`, project name `bridle`), driven by three pnpm scripts. Nothing in it is a secret: every
credential is a committed default from `.env.example`. The web application and its smoke test have their own
section, "Web application and the smoke test". The application container image (one image, four
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

## Web application and the smoke test

`apps/web` is the Next.js 15 application (React 19, the App Router, TypeScript strict; card P0-02.5). It has
three pages and one route handler:

- `/` says Bridle with the git sha and the educational-use notice, and links to the workspace.
- `/workspace` is the 3D viewport of a structural model beside a side panel (cards PX-02.1 and PX-02.2). The
  model is in a store with undo and redo (card PX-02.3; the Undo and Redo buttons of the viewport area, and Ctrl
  or Cmd with Z, with Shift and Z, or Ctrl with Y). It starts as the portal frame, one of the three fixtures of
  `packages/model`; a select in the side panel loads another, and the side panel lists the issues
  `validateModel` finds in the model. The viewport draws the nodes, the members and the supports with Z up, on a ground
  grid, with orbit, pan and zoom, a Fit button and three views (3D, Front, Top). A click selects a node or a
  member and the side panel shows its data: read-only, but for the X, Y and Z of a node, which are fields, and
  with a Delete button. The viewport has a tool palette (card PX-02.4): Select, Node and Member (keys V, N
  and M; Escape returns to Select), a work plane (X-Z at a chosen Y, or X-Y at a chosen Z) and a snap step
  (0.1, 0.25, 0.5 or 1 m). The Node tool places a node at the snapped point of the work plane under the
  pointer, the Member tool draws members from click to click, and the Select tool drags the selected node;
  "New model" in the side panel starts an empty model with the fixtures' section and material. Supports and
  loads (card PX-02.5): the Support tool (key S) sets Fixed, Pinned or Roller on a clicked node and removes
  it on a second click, and the Load tool (key L) adds a force or a moment to a clicked node; the side panel
  has the sections Model (with "Restrain out of plane" for a frame in one X-Z plane), Loads (the load cases
  and the choice of the active one), Issues and Properties, where a selected node shows six checkboxes for its
  support and its loads, and a selected member its loads with "Add uniform load" and "Add point load". The
  viewport draws the loads of the active load case as arrows with their values. The canvas
  (three.js through `@react-three/fiber`) is loaded in the browser only.
- `/tasks` is a "Coming soon" state.
- `GET /api/v1/health` answers 200 `application/json` `{"ok":true,"sha":"<sha>"}`.

Every page has the shell: a top bar with the product name and the navigation (card PX-02.1). Styling is plain CSS:
`apps/web/src/styles/tokens.css` (a copy of `docs/ux/tokens.css`; `pnpm --filter web test` fails when the two
differ), one global stylesheet and CSS Modules. The component library of the design system is P4-06. Every
user-facing string comes from the message catalog of `packages/i18n` through `t("id")` (`apps/web/src/i18n.ts`;
card P0-02.6), in the locale `NEXT_PUBLIC_LOCALE` names at build time: `en` when it is unset or empty, `en-XA` for
the pseudo-locale, and any other value fails the build. The catalog, the string lint and the allowlist are in
[i18n.md](i18n.md).

| Command | Does |
|---|---|
| `pnpm --filter web dev` | `next dev` on port 3000 (Next's default; `pnpm --filter web dev --port 3001` moves it). Without `--hostname`, Next listens on every interface of the machine; `--hostname 127.0.0.1` keeps it on loopback. Writes `apps/web/.next/` and `apps/web/next-env.d.ts`, both gitignored. |
| `pnpm --filter web build` | `next build` into `apps/web/.next/`. Stop a dev server of this checkout first: the two write the same directory. |
| `pnpm --filter web start` | `next start`: serves the last build on port 3000 (`--port`). |
| `NEXT_PUBLIC_LOCALE=en-XA pnpm --filter web build` | the same build in the pseudo-locale: Next inlines the variable, so one build is one locale, and `pnpm --filter web start` serves that locale whatever the variable says then. Run `rm -rf apps/web/.next` afterwards, or a later `next start` serves the `en-XA` build. |
| `pnpm e2e:smoke` | `playwright test`: the smoke test below. |
| `NEXT_PUBLIC_LOCALE=en-XA pnpm e2e:smoke` | the smoke test against the pseudo-locale: the server Playwright starts inherits the variable, the test reads the strings it expects from `packages/i18n/messages/en-XA.json`, and the screenshot is `.bridle/screenshots/smoke-home-en-XA.png`. |
| `bash tools/test/web.test.sh` | the tests of card P0-02.5 (never part of `pnpm test`: they start servers and a browser, on free loopback ports, never 3000; they refuse to start while a server answers on 3000). |
| `bash tools/test/i18n.test.sh` | the tests of card P0-02.6 (the catalog, the string lint, the pseudo-locale build and its smoke; never part of `pnpm test`, for the same reasons). |

Where the sha comes from (`apps/web/src/sha.ts`, read at every request and never cached, so a dev server follows
HEAD): `GIT_SHA` when it is set and not empty (the application image sets it), else `git rev-parse --short HEAD`
(where git and the repository exist: development and the smoke test), else `unknown`.

`pnpm e2e:smoke` reads the root `playwright.config.ts`: the Chromium project only, one worker, no retries, the seven
tests of `e2e/smoke.spec.ts`. It starts `pnpm --filter web dev --hostname 127.0.0.1 --port $PORT` (`PORT`, default
3000) and stops it when the tests end, or reuses the server that already answers
`http://127.0.0.1:$PORT/api/v1/health`. The first test asserts the health route: 200, `application/json`, a body
equal to `{ok: true, sha}`. The second opens `/`: 200, `<html lang>` equal to the locale, the title and the heading
(`app.name` of that locale's catalog: `Bridle` in `en`), the sha, the notice (`home.notice`), then a full-page
screenshot to `.bridle/screenshots/smoke-home.png` (1280 x 720; `smoke-home-<locale>.png` for another locale than
`en`). The third opens `/workspace` and checks the navigation, the viewport area and the side panel area. The
fourth waits for the viewport's canvas, checks the side panel's counts for the portal frame (4 nodes, 3 members, 2
supports) and the four buttons of the viewport, checks that Undo and Redo are there and disabled and that the
side panel says "No issues", takes `.bridle/screenshots/smoke-workspace.png`, changes the
fixture and checks the counts again (5, 7 and 5 for the truss; 2, 1 and 2 for the beam), and fails when the page
threw an error or the console holds a hydration error. The fifth takes the front view, moves the pointer down the
middle of the viewport until the viewport reports the beam `b1` under it, clicks, checks that the side panel shows
that member, then clicks on nothing and checks that the selection is gone. The sixth starts a new model, takes
the front view, places two nodes with the Node tool and a member between them with the Member tool (it moves the
pointer until the viewport's `data-cursor` attribute reads the wanted point, then clicks), reads the counts 2
and 1 from the side panel, checks that a second member between the two nodes is refused with a message, takes
`.bridle/screenshots/smoke-tools.png`, and undoes the member. The seventh takes the portal frame in the front
view, places a nodal load on the node `n3` with the Load tool and reads it back from the side panel's list,
selects the beam `b1`, adds a uniform load from the side panel and reads it back from the member's list, takes
`.bridle/screenshots/smoke-loads.png`, checks that a point load beyond the member's length is refused with a
message, then edits and removes the uniform load and undoes the removal. The locale is `NEXT_PUBLIC_LOCALE` of
the shell that runs the smoke, `en` when unset, so against a running server of another locale the six tests that
open a page fail at `lang`: run it with the server's locale, or on another `PORT`.
Failure output goes to `.bridle/playwright/`; both
directories are gitignored. The sha the tests expect is `GIT_SHA` when the shell that runs the smoke has it, else
`git rev-parse --short HEAD`, so a server started with another `GIT_SHA` fails the smoke: the sha is asserted, not
echoed. With its seven tests it took 16 to 21 s here when Playwright started the server and about 14 s
against a running one (card PX-02.5, 2026-11-18).

The browser: `@playwright/test` 1.64.1 (the pin of `tools/toolchain.json`, also typed in the root `package.json`)
drives the Chromium build that `npx playwright@1.64.1 install chromium` puts in `~/Library/Caches/ms-playwright`
(docs/ops/toolchain.md); `pnpm install` downloads no browser.

When another process holds the port: Playwright takes any answer from 200 to 403 on the health URL for "the server
is up", so the health test fails first and shows what answered; with the port taken by something that answers
otherwise or not at all (the image's `--serve` stub answers 404 there), Playwright starts `next dev`, which exits
with `EADDRINUSE` and does not move to another port. Either way run the smoke elsewhere: `PORT=3001 pnpm
e2e:smoke`.

TypeScript: `apps/web` and `packages/i18n` pin typescript 6.0.3 while `packages/units` keeps 7.0.2.
`packages/i18n` follows `apps/web` for two reasons: its source is compiled and typechecked by `apps/web`, and its
string lint (`packages/i18n/lint/lint-strings.mjs`) needs the compiler API (`typescript.js`), which typescript
6.0.3 ships and 7.0.2 does not (card P0-02.6). Next.js 15.5.29 refuses
TypeScript 7 (`next build` exits 1 with "TypeScript 7.0.2 is not supported by this version of Next.js", found at
the card's plan station); Next.js 16.2.11 or later accepts it, and that move changes the architecture's
"Next.js 15", so it is the owner's decision (card P0-02.5, open question 2). `apps/web/tsconfig.json` extends
`tsconfig.base.json` (strict) with the options Next asks for, so a build does not rewrite it. If `tsc` fails on a
file under `apps/web/.next/types` after a route was removed, the directory is stale: `rm -rf apps/web/.next`.

`pnpm check` covers `apps/web` in three of its steps: lint (`biome ci .`, then the string lint, `node
packages/i18n/lint/lint-strings.mjs`, which fails on a hard-coded user-facing string under `apps/web/src`; there is
no ESLint), typecheck (`turbo run typecheck` runs `web#typecheck`, `tsc --noEmit`, where a `t("id")` whose id is
not in the catalog is a type error) and test (`turbo run test` runs `web#test`: the token copy test on node's own
test runner, then `vitest run` for the `*.test.ts` files under `apps/web/src`, which test without a browser what
the viewport draws for a model, where its camera stands, the model store and the tools' geometry and rules). `pnpm --filter web build` and `pnpm e2e:smoke` are separate
commands, not steps of `pnpm check`; the test, review and ship stations run the smoke for cards that touch
`apps/web` (factory/line.md). Actions runs neither: Playwright's browsers reach the runners with P0-09.

## Other local ports

Everything that listens on this machine during development, so two tools never collide:

| Port | What | Where it is set |
|---|---|---|
| 55432 | Postgres (compose `postgres`) | `compose.yaml` |
| 9000, 9001 | RustFS S3 API and console (compose `minio`) | `compose.yaml` |
| 1025, 8025 | mailpit SMTP and web UI | `compose.yaml` |
| 3000 | the application image's `--serve` stub (`PORT`) | `Dockerfile`, `tools/entrypoint.sh` |
| 3000 | the web application's dev server, `pnpm --filter web dev` (`--port`), and the server `pnpm e2e:smoke` starts or reuses (`PORT`) | `apps/web/package.json`, `playwright.config.ts` |
| 8787 | the monitor's local viewer, `python3 tools/monitor/serve.py` | `tools/monitor/serve.py` (`--port`) |
| 5180, 5181 | Agent HQ's Vite dev server and preview | `tools/agent-hq/vite.config.ts` |
| 8787 | Agent HQ's API server (`pnpm api`), the target of both Vite proxies | `tools/agent-hq/server/index.ts` (`PORT`), `tools/agent-hq/vite.config.ts` |

The monitor viewer and Agent HQ's API both default to 8787, and Agent HQ's proxy target is fixed at that port: run one at a
time, or start the viewer elsewhere with `python3 tools/monitor/serve.py --port 8788`. Card P0-12 removes the clash.

The image's `--serve` stub and the web application's dev server share 3000 too: with `docker run -p 3000:3000
bridle:dev web --serve` up, `next dev` exits with `EADDRINUSE`. Move one of them: `pnpm --filter web dev --port
3001`, `PORT=3001 pnpm e2e:smoke`, or `docker run -p 3001:3000 ...`.

## Application image

The deployment unit of the architecture (sections 3, 15, 16): one container image, four entrypoints. The root
`Dockerfile` builds it and `tools/entrypoint.sh` dispatches on its first argument, `web`, `worker`, `judge` or
`system`. Every name is a stub today: it prints `<name> <sha>` and exits 0, or stays up behind `--serve` with a
health endpoint. Later cards put the Next.js server behind `web` and the pg-boss processors behind the other
three, under the same names in the same image (card P0-02.4 introduced it). Since card P0-02.5 the build stage
builds `apps/web`, which proves the application builds on Linux; `web` is still the stub, the prune leaves
`apps/web` out and the runtime stage carries nothing of it. The card that copies Next's output into the runtime
stage copies it `--chown=node:node`: `/app` is root-owned 755 and Next writes `.next/cache`.

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
| `build` | `deps` | `pnpm exec turbo run build` (one task today, `web#build`: `next build` of `apps/web`), then the prune: `rm -rf node_modules packages/*/node_modules apps/*/node_modules` and `pnpm install --frozen-lockfile --prod --ignore-scripts --filter '!web'` from the same mount (an in-place `--prod` over a full tree keeps too much; without the filter the prune would keep next, swc and sharp, which nothing in the runtime can reach while `web` is the stub) |
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

Build context (`.dockerignore`): the pnpm workspace and the entrypoint, 37 files and 106 KB today (card P0-02.6,
2026-11-17): `package.json`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `.editorconfig`,
`.node-version`, `packages/*/{package.json,tsconfig.json,src/}`, `packages/i18n/{lint,messages,scripts}/`,
`apps/web/{package.json,tsconfig.json,next.config.mjs,i18n-allowlist.json,src/}`,
`tools/entrypoint.sh`. Everything else stays out:
`.git*` (`.git`, `.github`, `.gitignore`, `.gitattributes`), `node_modules` and `**/node_modules` (the host's macOS
tree must never reach a Linux image), `**/.turbo`, `**/dist`, `**/*.tsbuildinfo`, `**/.next` and
`**/next-env.d.ts` (what Next writes on the host; the build stage makes its own), the Rust workspace (`target`,
`crates`, `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `rustfmt.toml`), `.bridle`, `.claude`,
`.claude-sessions`, `.worktrees`, `docs`, `factory`, `tools/*` except the entrypoint, `e2e` and
`playwright.config.ts` (the smoke test runs on the host), `compose.yaml`, the `Dockerfile` and `.dockerignore`
themselves, `**/*.md`, `**/.DS_Store`, and `**/.env*`: a developer's `.env.local` (docs/ops/secrets.md) must never
land in a layer, so the whole family is excluded at every depth, `apps/web/.env.local` and `.env.example` included
(the image needs none of it). The `**/` matters: in a `.dockerignore` a bare `.env*` matches at the root of the
context only.

Measured on this machine (M4, OrbStack, docker 29.8.2, the base image already pulled) by card P0-02.5 on
2026-11-17: a build after a change of the context 14 s wall, of which `pnpm install` from the store mount 2.9 s
(`downloaded 0`) and `turbo run build` (`next build`) 9.8 s; `docker build --no-cache` 19 s, of which corepack's
pnpm download 2.6 s, `pnpm install` 5.4 s, `turbo run build` 9.4 s and the prune 0.4 s; a warm rebuild with nothing
changed 0.6 s, every step `CACHED`; a new `GIT_SHA` alone 0.5 s. Any change under `apps/web` or `packages` now
re-runs the install and the Next build. Image size (`docker image inspect bridle:dev --format '{{.Size}}'`),
measured again by card P0-02.6 on 2026-11-17: 344,690,273 bytes = 345 MB, of which 343,893,906 bytes is the base
image: the workspace adds 796 KB. The prune leaves `apps/web` out; since card P0-02.6 it installs
`intl-messageformat` for `packages/i18n` (four entries under `/app/node_modules/.pnpm`: `intl-messageformat`,
`@formatjs/icu-messageformat-parser`, `@formatjs/icu-skeleton-parser`, `@formatjs/fast-memoize`), which the web
process will need; the card that puts Next.js behind `web` revisits what the image installs. One cold build on 2026-11-03 failed at
`corepack install -g pnpm@12.16.1` with `Error when performing the request to https://registry.npmjs.org/...`
after 4 s (a transient registry fetch; the probe of the same step passed seconds later): run the build again,
a failed step is never cached.

Test: `bash tools/test/image.test.sh` (never part of `pnpm test`: it needs the docker engine; about 30 s warm, a
few minutes cold). It builds the image with the current sha, runs the four entrypoints, probes `--serve` on a random
loopback port, checks the unknown-name exit code and the build context (the real one, and a synthetic context with
nested `.env.local`, markdown and Next output that only the manifests and sources may leave), and reads this
section.

Out of scope for the image today: pushing it to a registry (P0-05, with the ECS task definitions); Rust
compilation and the wasm artifacts (they are built by the Rust workspace and copied in by later cards, never
compiled here); a compose service for the application (`compose.yaml` stays services only).
