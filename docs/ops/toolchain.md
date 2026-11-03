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

1. Edit `tools/toolchain.json` (the only place a version is typed).
2. Mirror it: `rust.channel`, `rust.components` and `rust.targets` into `rust-toolchain.toml`; `node.major` into
   `.node-version`. The doctor fails on drift until both agree.
3. Reinstall the tool with its command from the table (for rust: `rustup toolchain install <new>` with the same
   components and target; for playwright: `npx playwright@<new> install chromium`, which also refreshes the npx cache).
4. Run `bash tools/doctor.sh`; ship the three files (and `docs/ops/toolchain.md` if a command changed) in one commit.
   CI reads the same file (`jq -r .tools.rust.channel tools/toolchain.json` and friends), so it follows the bump.

## For later cards

- P0-02 (workspace): pin `turbo` at `>= 2.11.10`, the first Turborepo release that reads pnpm 12 lockfiles, and
  declare `"packageManager": "pnpm@12.16.1"`.
- P0-02.3 (CI): install the same pins on the runner and run `bash tools/doctor.sh` as the first job step; the
  `playwright` row needs the `npx playwright@1.64.1 install chromium` step (or its cache) to have run first.
- P2 (engine): `wasm-bindgen = "=0.2.130"` in `Cargo.toml`.
