# Toolchain

Every tool the build needs, at one pinned version each, and how to put it on a new machine. The pins live in
one file, `tools/toolchain.json`; `rust-toolchain.toml` and `.node-version` mirror two of them; `bash
tools/doctor.sh` proves a machine against all of them (one row per tool, exit 0 only when every row is `ok`).

## Pins

| Tool (`tools` key) | Pin | The doctor runs | Install on a new machine (macOS arm64) |
|---|---|---|---|
| `rustup` | present | `rustup --version` | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$TMPDIR/rustup-init.sh" && sh "$TMPDIR/rustup-init.sh" -y --default-toolchain 1.99.1 --profile minimal --component rustfmt,clippy --target wasm32-unknown-unknown` |
| `rust` | channel `1.99.1`, target `wasm32-unknown-unknown`, components `rustfmt`, `clippy` | `rustup toolchain list` (the toolchain must be listed before anything else runs), then `rustc +1.99.1 --version`, `cargo +1.99.1 --version`, `rustup target list --installed --toolchain 1.99.1`, `rustup component list --installed --toolchain 1.99.1` | installed by rustup-init above; with an existing rustup: `rustup toolchain install 1.99.1 --profile minimal --component rustfmt,clippy --target wasm32-unknown-unknown` |
| `node` | major `22` | `node --version` | `nvm install 22 && nvm alias default 22 && nvm use 22` |
| `pnpm` | `12.16.1` | `pnpm --version` with `COREPACK_ENABLE_NETWORK=0` | `corepack enable pnpm && corepack install -g pnpm@12.16.1 && pnpm --version` (under node 22; the last command fetches pnpm 12's native binary into corepack's cache, after which pnpm starts offline in 0.05 s) |
| `wasm-bindgen-cli` | `0.2.130` | `wasm-bindgen --version` | `cargo install wasm-bindgen-cli --version 0.2.130 --locked` (compiles, about half a minute on an M4) |
| `binaryen` | major `133` | `wasm-opt --version` | `brew install binaryen` |
| `wasmtime` | major `50` | `wasmtime --version` | `brew install wasmtime` |
| `opentofu` | minimum `1.13.0` | `tofu version` (first line, compared against the minimum) | `brew install opentofu` |
| `awscli` | major `2` | `aws --version` (`aws-cli/X`) | `brew install awscli` |
| `playwright` | `1.64.1`, browsers `chromium` | `npx --no -- playwright@1.64.1 --version` and `npx --no -- playwright@1.64.1 install --dry-run chromium`; every `Install location:` the dry run names must hold `INSTALLATION_COMPLETE` | `npx playwright@1.64.1 install chromium` (under node 22) |
| `docker` | an engine `docker info` can reach | `docker info --format '{{.ServerVersion}}'` (3 s, else `MISSING` with the hint `open -a OrbStack`) | `brew install --cask orbstack && open -a OrbStack` (or `brew install --cask docker-desktop`) |

Two mirror rows follow the tool rows: `rust-toolchain.toml` (channel, components, targets read by regex, one key per
line, double quotes) and `.node-version` (the node major). A mirror that disagrees with `tools/toolchain.json` is a
`DRIFT <field> want X have Y` row and fails the doctor.

The `wasm-bindgen` crate that P2 adds to `Cargo.toml` must be exactly `0.2.130`: the CLI and the crate have to match.

## Installing a new machine

Run in this order; each command is what card P0-06.1 ran on 2026-11-03 (macOS 27 arm64, Homebrew at
`/opt/homebrew`, nvm 0.40.1 already present):

```sh
# 1. Rust: rustup-init appends `. "$HOME/.cargo/env"` to ~/.zshenv and ~/.profile; source it in the current shell.
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$TMPDIR/rustup-init.sh" \
  && sh "$TMPDIR/rustup-init.sh" -y --default-toolchain 1.99.1 --profile minimal --component rustfmt,clippy --target wasm32-unknown-unknown
. "$HOME/.cargo/env"

# 2. wasm-bindgen CLI (compiles; about 30 s on an M4).
cargo install wasm-bindgen-cli --version 0.2.130 --locked

# 3. Homebrew tools (awscli pulls in python@3.15; about 2 minutes).
brew install binaryen wasmtime opentofu awscli

# 4. A docker engine: the OrbStack cask (app only, no pkg), then launch it once so it installs its CLI
#    symlinks under ~/.orbstack/bin and appends its PATH line to ~/.zprofile. `docker info` answered 6 s after
#    `open -a OrbStack` here, with no password prompt (OrbStack did not ask to install /usr/local/bin or
#    /var/run/docker.sock symlinks; if it does on your machine, that dialog needs your macOS password).
#    Docker Desktop is the accepted alternative: `brew install --cask docker-desktop`; its installer does ask
#    for the password. The doctor only needs `docker info` to succeed.
brew install --cask orbstack && open -a OrbStack

# 5. Node 22 and pnpm (nvm is present; corepack ships with node 22).
nvm install 22
nvm alias default 22 && nvm use 22 && corepack enable pnpm && corepack install -g pnpm@12.16.1 && pnpm --version

# 6. Playwright's chromium (about 200 MB: chromium-1248, chromium_headless_shell-1248, ffmpeg-1013) and the
#    npx cache entry for playwright@1.64.1 that the doctor's probes reuse.
npx playwright@1.64.1 install chromium

# 7. Prove it from a fresh login shell, from any directory.
env -i HOME="$HOME" USER="$USER" TERM="$TERM" /bin/zsh -lc 'cd / && bash <repo>/tools/doctor.sh'
```

Notes:

- nvm (0.40.1) reads `.nvmrc`, not `.node-version`, so the repository does not drive `nvm use`; the card made 22 the
  default instead (`nvm alias default 22`), which every new shell picks up through `~/.zprofile`. To go back:
  `nvm alias default 24`. Other version managers (fnm, nodenv, volta) do read `.node-version`.
- corepack's `pnpm` shim resolves the version from the nearest `package.json` `packageManager` field and otherwise from
  `~/.cache/node/corepack/lastKnownGood.json`, which `corepack install -g pnpm@12.16.1` sets. The P0-02 workspace must
  declare `"packageManager": "pnpm@12.16.1"` so both paths agree.
- OrbStack starts its engine when the app launches and sets the `orbstack` docker context as current
  (`~/.docker/config.json`); `docker` on PATH comes from `~/.orbstack/bin` via the line OrbStack appends to
  `~/.zprofile`. If the doctor's `docker` row says `engine not reachable`, run `open -a OrbStack` (or `orbctl start`)
  and wait a few seconds.
- Playwright keeps browsers in `~/Library/Caches/ms-playwright` (Linux: `~/.cache/ms-playwright`) and the
  `playwright@1.64.1` package in the npx cache `~/.npm/_npx/<hash>`. The doctor never installs anything (`npx --no`), so
  both must already be there: on a developer machine from step 6 above, in CI (P0-02.3) from the same
  `npx playwright@1.64.1 install chromium` step or a restored cache of those two directories. The cache may hold
  other builds from other projects (this machine had chromium-1243); the doctor checks the directory the dry run
  names, never the newest one.
- `aws --version` takes about 0.5 s warm but 1.5 s or more the very first time after the install while macOS scans
  the 14,000-file bundle; a cold first doctor run can therefore show `aws --version timed out after 3s`. Run it again.

## Running the doctor

```sh
bash tools/doctor.sh              # from any directory; the script finds the repository from its own path
bash tools/doctor.sh --root DIR   # or BRIDLE_ROOT=DIR: read the pins and the two mirrors from DIR
```

Output: a header, one `name | want | have | status` row per `tools` key, the two mirror rows, and a last line
`doctor: N ok, M failed[: names]`; exit 0 only when everything is `ok`. `MISSING` means the tool, or a pinned part of
it (target, component, browser), is not installed or not runnable on PATH; `MISMATCH` means installed at a version
other than the pin; `DRIFT` means a mirror file disagrees with `tools/toolchain.json`. Every subprocess has a 3 s
timeout and the probes run in parallel, so a run takes about 1.5 s on this machine (the two `npx` probes dominate)
and never more than a few seconds. Apple's `/usr/bin/python3` (3.9) and bash 3.2 are enough; no third-party module
is used. The doctor never changes anything and never installs: the rust probe refuses to run `rustc` until `rustup
toolchain list` shows the channel (and sets `RUSTUP_AUTO_INSTALL=0`), the pnpm probe runs with
`COREPACK_ENABLE_NETWORK=0`, and the playwright probes pass `--no` to npx.

## Bumping a pin

1. Edit `tools/toolchain.json`: the source of every pin. A pin is typed a second time only in the mirrors of
   step 2, and each of them follows this file.
2. Mirror it. The list is every place outside `docs/`, `factory/`, `pnpm-lock.yaml` and `tools/agent-hq/` (not a
   workspace member; it follows no pin) that types a pin; the pins of `wasm-bindgen-cli`, `binaryen`, `wasmtime`,
   `opentofu` and `awscli` are typed nowhere else yet.
   - `rust.channel`, `rust.components` and `rust.targets` into `rust-toolchain.toml`; `node.major` into
     `.node-version`. The doctor fails on drift until both agree.
   - `rust.channel` also into `rust-version` of the root `Cargo.toml` (`tools/test/workspace.test.sh` compares it;
     the doctor does not read it).
   - `node.major` into `engines.node` and `pnpm.version` into `packageManager` of the root `package.json`
     (`tools/test/workspace.test.sh` compares both).
   - `node.major` into the base image line of the `Dockerfile` (the `FROM ... AS base` line, tag and digest
     together; docs/ops/local-dev.md, "Application image") and into the `base` line of the "Stages" list in the
     header comment of that file, which types the same tag; into the same tag in `tools/test/image.test.sh` (its
     header and the pattern and message of its `build` case) and into the major of `@types/node` in
     `apps/web/package.json` (then `pnpm install`). Nothing compares the major of the image tag or of
     `@types/node` with this file.
   - `pnpm.version` into the `corepack install -g pnpm@<version>` line of the `Dockerfile` and the two comments
     of that file that quote it: the `deps` line of the "Stages" list in its header and the corepack comment above
     the `corepack install` line. Nothing compares them with this file.
   - Comments that say the node major: the header of `.github/workflows/check.yml`, the corepack comment of the
     `Dockerfile`, the docstring of `check_node_version` in `tools/doctor.sh` (its examples), and the `nvm use 22`
     line of the header of `tools/test/compose.test.sh`, `tools/test/i18n.test.sh`, `tools/test/image.test.sh`,
     `tools/test/web.test.sh` and `tools/test/workspace.test.sh`.
   - `playwright.version` into `devDependencies["@playwright/test"]` of the root `package.json`, typed there too
     since card P0-02.5 (`pnpm e2e:smoke` runs that package), then `pnpm install` so that `pnpm-lock.yaml` follows.
     The doctor does not read this mirror; the `smoke` case of `tools/test/web.test.sh` compares the two. That
     file also types the pin: the literal of its `smoke` case (`[ "$PW_PIN" = "1.64.1" ]`, with its message) and
     the two needles of its `docs` case (`1.64.1` and `npx playwright@1.64.1 install chromium`), which follow
     `docs/ops/local-dev.md`. Until all three move, `bash tools/test/web.test.sh` fails after a bump.
   - `playwright.browsers` (`chromium`) is typed in three files; nothing compares any of them with this file.
     - `playwright.config.ts`: the project name of `projects` (`name: "chromium"`, with `devices["Desktop Chrome"]`
       on the same line), and the header comment of that file, whose first line says "Chromium only".
     - `tools/test/web.test.sh`: its `smoke` case asserts that project name by the literal `chromium` (the
       `[chromium]` count of `playwright test --list`, the `name: "chromium"` pattern, the `firefox|webkit`
       pattern, and their messages and the summary line); the header of that test file says it twice, in the
       `smoke` row (`[chromium]`, "no firefox or webkit") and in its "Needs" sentence ("the Chromium build of
       `npx playwright@<pin> install chromium`"); and its `docs` case holds the needle
       `npx playwright@1.64.1 install chromium`.
     - `tools/test/doctor.test.sh`: its `docs` case looks for `npx playwright@<version> install chromium` (the
       version read from this file, the browser typed) in this document.
3. Reinstall the tool with its command from the table (for rust: `rustup toolchain install <new>` with the same
   components and target; for playwright: `npx playwright@<new> install chromium`, which also refreshes the npx cache).
4. Run `bash tools/doctor.sh`; ship `tools/toolchain.json` and every mirror that changed (and `docs/ops/toolchain.md`
   and `docs/ops/local-dev.md` where they quote the version or a command) in one commit. CI reads the same file
   (`jq -r .tools.rust.channel tools/toolchain.json` and friends), so it follows the bump.

## For later cards

- P0-02 (workspace): pin `turbo` at `>= 2.11.10`, the first Turborepo release that reads pnpm 12 lockfiles, and
  declare `"packageManager": "pnpm@12.16.1"`.
- P0-02.3 (CI): install the same pins on the runner and run `bash tools/doctor.sh` as the first job step; the
  `playwright` row needs the `npx playwright@1.64.1 install chromium` step (or its cache) to have run first.
- P2 (engine): `wasm-bindgen = "=0.2.130"` in `Cargo.toml`.
