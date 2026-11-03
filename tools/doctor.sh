#!/usr/bin/env bash
# Bridle toolchain doctor: checks every pin in tools/toolchain.json against the tools on
# PATH, and the two mirror files (rust-toolchain.toml, .node-version) against the pins.
#
# Usage:
#   bash tools/doctor.sh [--root <dir>]      (from any directory; env BRIDLE_ROOT=<dir> also works)
#
# Output (plain text): a header line, one row per `tools` key of toolchain.json
#   name | want | have | ok|MISSING|MISMATCH
# one row per mirror file
#   rust-toolchain.toml | want | have | ok|DRIFT <field> want X have Y
#   .node-version       | want | have | ok|DRIFT major want X have Y
# and a last line `doctor: N ok, M failed[: names]`. Exit 0 only when every row is ok.
# MISSING: the tool, or a pinned part of it (target, component, browser), is not installed or
# not runnable; MISMATCH: installed at a version other than the pin.
#
# Bash 3.2 and Apple's /usr/bin/python3 (3.9) are enough: the wrapper only finds the repository
# root; the probes live in the embedded standard-library program below. Every subprocess has a
# 3 s timeout (macOS has no `timeout` binary) and the probes run in a thread pool, so a run is
# bounded by the slowest probe and stays under 5 s.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 - "$ROOT" "$@" <<'PY'
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

TIMEOUT = 3.0  # seconds per subprocess
OK, MISSING, MISMATCH = "ok", "MISSING", "MISMATCH"
SEMVER = re.compile(r"(\d+)\.(\d+)\.(\d+)")


def usage(stream):
    stream.write(
        "usage: bash tools/doctor.sh [--root <dir>]\n"
        "Checks every pin in <root>/tools/toolchain.json against the tools on PATH, and the mirror\n"
        "files <root>/rust-toolchain.toml and <root>/.node-version against the pins. <root> is the\n"
        "repository holding this script; env BRIDLE_ROOT overrides it and --root overrides both.\n"
        "Exit 0 only when every row is ok.\n"
    )


def parse_args(argv, default_root):
    root = os.environ.get("BRIDLE_ROOT") or default_root
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("-h", "--help"):
            usage(sys.stdout)
            sys.exit(0)
        if a == "--root" and i + 1 < len(argv):
            root = argv[i + 1]
            i += 2
            continue
        if a.startswith("--root="):
            root = a[len("--root="):]
            i += 1
            continue
        sys.stderr.write("doctor: unknown argument %r\n" % a)
        usage(sys.stderr)
        sys.exit(2)
    return os.path.abspath(root)


# ---------------------------------------------------------------- subprocess helpers

def run(cmd, env=None, cwd=None, timeout=TIMEOUT):
    """Run cmd with no TTY and a timeout. Returns (rc, stdout, stderr); rc is None when the
    command is not on PATH, cannot start, or timed out (stderr then says why)."""
    if shutil.which(cmd[0]) is None:
        return None, "", "%s not on PATH" % cmd[0]
    full_env = dict(os.environ)
    full_env.update(env or {})
    try:
        p = subprocess.Popen(
            cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=cwd, env=full_env, start_new_session=True,
        )
    except OSError as e:
        return None, "", "%s: %s" % (cmd[0], e)
    try:
        out, err = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(p.pid, signal.SIGKILL)  # the whole process group: npx spawns children
        except OSError:
            pass
        try:
            p.communicate(timeout=1)
        except Exception:
            pass
        return None, "", "%s timed out after %gs" % (" ".join(cmd), timeout)
    return p.returncode, out.decode("utf-8", "replace"), err.decode("utf-8", "replace")


def first_line(text):
    for line in (text or "").splitlines():
        if line.strip():
            return line.strip()
    return ""


def semver(text):
    m = SEMVER.search(text or "")
    return m.group(0) if m else None


def vtuple(v):
    return tuple(int(x) for x in v.split("."))


def broken(rc, out, err, what):
    """The have-text for a probe that did not run cleanly: the error line if there is one."""
    if rc is None:
        return err
    lines = [l.strip() for l in (err + "\n" + out).splitlines() if l.strip()]
    said = [l for l in lines if re.match(r"(?i)(npm )?err", l)] or lines
    return "%s failed (exit %d): %s" % (what, rc, said[0] if said else "no output")


# ---------------------------------------------------------------- probes: (have, status)

RUST_ENV = {"RUSTUP_AUTO_INSTALL": "0"}  # never let a rustup proxy install a toolchain


def probe_rustup(pin, ctx):
    rc, out, err = run(["rustup", "--version"], env=RUST_ENV)
    v = semver(first_line(out))
    if rc != 0 or not v:
        return broken(rc, out, err, "rustup --version"), MISSING
    return v, OK


def probe_rust(pin, ctx):
    ch = pin["channel"]
    targets = list(pin.get("targets", []))
    comps = list(pin.get("components", []))
    # Gate: the toolchain must already be listed; the rustc/cargo proxies would otherwise
    # try to install it (minutes of network).
    rc, out, err = run(["rustup", "toolchain", "list"], env=RUST_ENV)
    if rc != 0:
        return broken(rc, out, err, "rustup toolchain list"), MISSING
    names = [line.split()[0] for line in out.splitlines() if line.strip()]
    if not any(n == ch or n.startswith(ch + "-") for n in names):
        return "toolchain %s not installed (rustup toolchain install %s)" % (ch, ch), MISSING
    pinned = SEMVER.fullmatch(ch) is not None
    problems = []
    for tool in ("rustc", "cargo"):
        rc, out, err = run([tool, "+" + ch, "--version"], env=RUST_ENV)
        v = semver(first_line(out))
        if rc != 0 or not v:
            problems.append(broken(rc, out, err, "%s +%s --version" % (tool, ch)))
        elif pinned and v != ch:
            problems.append("%s is %s" % (tool, v))
    rc, out, err = run(["rustup", "target", "list", "--installed", "--toolchain", ch], env=RUST_ENV)
    have = set(out.split()) if rc == 0 else set()
    for t in targets:
        if t not in have:
            problems.append("target %s not installed" % t)
    rc, out, err = run(["rustup", "component", "list", "--installed", "--toolchain", ch], env=RUST_ENV)
    have = out.split() if rc == 0 else []
    for c in comps:
        if not any(x == c or x.startswith(c + "-") for x in have):
            problems.append("component %s not installed" % c)
    if problems:
        status = MISMATCH if all(" is " in p for p in problems) else MISSING
        return "%s but %s" % (ch, "; ".join(problems)), status
    return "%s %s" % (ch, " ".join(targets + comps)), OK


def probe_node(pin, ctx):
    rc, out, err = run(["node", "--version"])
    v = semver(first_line(out))
    if rc != 0 or not v:
        return broken(rc, out, err, "node --version"), MISSING
    return first_line(out), OK if vtuple(v)[0] == int(pin["major"]) else MISMATCH


def probe_pnpm(pin, ctx):
    # Network off: corepack must already hold the pinned pnpm (and its native binary).
    rc, out, err = run(["pnpm", "--version"], env={"COREPACK_ENABLE_NETWORK": "0"}, cwd=ctx["root"])
    v = semver(first_line(out))
    if rc != 0 or not v:
        if "Network access is disabled" in (err + out):
            return "corepack has no cached pnpm: run `pnpm --version` once with network", MISSING
        return broken(rc, out, err, "pnpm --version"), MISSING
    return v, OK if v == pin["version"] else MISMATCH


def probe_wasm_bindgen_cli(pin, ctx):
    rc, out, err = run(["wasm-bindgen", "--version"])
    v = semver(first_line(out))
    if rc != 0 or not v:
        return broken(rc, out, err, "wasm-bindgen --version"), MISSING
    return v, OK if v == pin["version"] else MISMATCH


def probe_binaryen(pin, ctx):
    rc, out, err = run(["wasm-opt", "--version"])
    m = re.search(r"version[ _](\d+)", first_line(out))
    if rc != 0 or not m:
        return broken(rc, out, err, "wasm-opt --version"), MISSING
    return m.group(1), OK if int(m.group(1)) == int(pin["major"]) else MISMATCH


def probe_wasmtime(pin, ctx):
    rc, out, err = run(["wasmtime", "--version"])
    v = semver(first_line(out))
    if rc != 0 or not v:
        return broken(rc, out, err, "wasmtime --version"), MISSING
    return v, OK if vtuple(v)[0] == int(pin["major"]) else MISMATCH


def probe_opentofu(pin, ctx):
    rc, out, err = run(["tofu", "version"])
    v = semver(first_line(out))
    if rc != 0 or not v:
        return broken(rc, out, err, "tofu version"), MISSING
    return v, OK if vtuple(v) >= vtuple(pin["min"]) else MISMATCH


def probe_awscli(pin, ctx):
    rc, out, err = run(["aws", "--version"])
    m = re.search(r"aws-cli/(\d+\.\d+\.\d+)", out + err)
    if rc != 0 or not m:
        return broken(rc, out, err, "aws --version"), MISSING
    return m.group(1), OK if vtuple(m.group(1))[0] == int(pin["major"]) else MISMATCH


def probe_docker(pin, ctx):
    rc, out, err = run(["docker", "info", "--format", "{{.ServerVersion}}"])
    v = first_line(out)
    if rc is None and "not on PATH" in err:
        return err, MISSING
    if rc != 0 or not v:
        why = first_line(err).split(";")[0] or "no server"  # the first clause of the client's error
        return "engine not reachable, `open -a OrbStack` (%s)" % why, MISSING
    return "server %s" % v, OK


def probe_playwright(pin, ctx):
    ver = pin["version"]
    browsers = list(pin.get("browsers", []))
    spec = "playwright@" + ver
    hint = "npx %s install %s" % (spec, " ".join(browsers))
    # --no: npx must not install anything (it assumes --yes when stdin is not a TTY); the `--`
    # keeps npm from parsing --version / --dry-run as its own flags.
    env = {"npm_config_update_notifier": "false", "NO_UPDATE_NOTIFIER": "1"}
    if shutil.which("npx") is None:
        return "npx not on PATH", MISSING
    with ThreadPoolExecutor(max_workers=2) as ex:
        f_ver = ex.submit(run, ["npx", "--no", "--", spec, "--version"], env, ctx["root"])
        f_dry = ex.submit(run, ["npx", "--no", "--", spec, "install", "--dry-run"] + browsers, env, ctx["root"])
        rc1, out1, err1 = f_ver.result()
        rc2, out2, err2 = f_dry.result()
    v = semver(out1)
    if rc1 is None:
        return err1, MISSING
    if rc1 != 0 or not v:
        return "%s not in the npx cache (%s)" % (spec, hint), MISSING
    if v != ver:
        return v, MISMATCH
    locations = [m.strip() for m in re.findall(r"^\s*Install location:\s*(.+?)\s*$", out2, re.M)]
    if rc2 != 0 or not locations:
        return "%s but `install --dry-run` gave no install locations: %s" % (v, broken(rc2, out2, err2, "npx")), MISSING
    names = [os.path.basename(loc.rstrip("/")) for loc in locations]
    absent = [n for n, loc in zip(names, locations) if not os.path.isfile(os.path.join(loc, "INSTALLATION_COMPLETE"))]
    if absent:
        return "%s but not installed: %s (%s)" % (v, " ".join(absent), hint), MISSING
    return "%s %s" % (v, " ".join(names)), OK


PROBES = {
    "rustup": probe_rustup,
    "rust": probe_rust,
    "node": probe_node,
    "pnpm": probe_pnpm,
    "wasm-bindgen-cli": probe_wasm_bindgen_cli,
    "binaryen": probe_binaryen,
    "wasmtime": probe_wasmtime,
    "opentofu": probe_opentofu,
    "awscli": probe_awscli,
    "playwright": probe_playwright,
    "docker": probe_docker,
}


def want_text(name, pin):
    if name == "rust":
        return "%s %s" % (pin["channel"], " ".join(list(pin.get("targets", [])) + list(pin.get("components", []))))
    if name == "playwright":
        return "%s %s" % (pin["version"], " ".join(pin.get("browsers", [])))
    if "version" in pin:
        return str(pin["version"])
    if "major" in pin:
        return "%s.x" % pin["major"]
    if "min" in pin:
        return ">= %s" % pin["min"]
    if "channel" in pin:
        return str(pin["channel"])
    return "required"


def safe_probe(name, pin, ctx):
    probe = PROBES.get(name)
    if probe is None:
        return "doctor has no probe for this tool", MISSING
    try:
        return probe(pin, ctx)
    except Exception as e:  # a probe bug must show as a failed row, not a crash
        return "doctor error: %s: %s" % (type(e).__name__, e), MISSING


# ---------------------------------------------------------------- mirror files

def fmt_list(xs):
    return "(absent)" if xs is None else ("(empty)" if not xs else "+".join(xs))


def check_rust_toolchain_toml(root, pin):
    """rust-toolchain.toml must carry the pinned channel, components and targets. Read by regex:
    one key per line, double quotes (Apple's python 3.9 has no tomllib)."""
    path = os.path.join(root, "rust-toolchain.toml")
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        return "%s" % e.strerror, MISSING

    def scalar(key):
        m = re.search(r'^\s*%s\s*=\s*"([^"]*)"' % re.escape(key), text, re.M)
        return m.group(1) if m else None

    def array(key):
        m = re.search(r"^\s*%s\s*=\s*\[(.*?)\]" % re.escape(key), text, re.M)
        return re.findall(r'"([^"]*)"', m.group(1)) if m else None

    want = {"channel": pin["channel"], "components": list(pin.get("components", [])), "targets": list(pin.get("targets", []))}
    have = {"channel": scalar("channel"), "components": array("components"), "targets": array("targets")}
    drifts = []
    if have["channel"] != want["channel"]:
        drifts.append("channel want %s have %s" % (want["channel"], have["channel"] if have["channel"] is not None else "(absent)"))
    for key in ("components", "targets"):
        if have[key] is None or sorted(have[key]) != sorted(want[key]):
            drifts.append("%s want %s have %s" % (key, fmt_list(want[key]), fmt_list(have[key])))
    have_text = "%s %s" % (have["channel"] or "(absent)", " ".join((have["targets"] or []) + (have["components"] or [])))
    return have_text.strip(), (OK if not drifts else "DRIFT " + "; ".join(drifts))


def check_node_version(root, pin):
    """.node-version must name the pinned node major (22, v22 or 22.x.y all count)."""
    path = os.path.join(root, ".node-version")
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read().strip()
    except OSError as e:
        return "%s" % e.strerror, MISSING
    m = re.match(r"v?(\d+)", text)
    have = int(m.group(1)) if m else None
    want = int(pin["major"])
    if have != want:
        return text or "(empty)", "DRIFT major want %d have %s" % (want, text or "(empty)")
    return text, OK


# ---------------------------------------------------------------- main

def main():
    wrapper_root = sys.argv[1]
    root = parse_args(sys.argv[2:], wrapper_root)
    pins_path = os.path.join(root, "tools", "toolchain.json")
    try:
        with open(pins_path, encoding="utf-8") as f:
            pins = json.load(f)
        tools = pins["tools"]
        if not isinstance(tools, dict) or not tools:
            raise ValueError("`tools` must be a non-empty object")
    except (OSError, ValueError, KeyError) as e:
        sys.stderr.write("doctor: cannot read pins from %s: %s\n" % (pins_path, e))
        return 1
    ctx = {"root": root}
    started = time.time()
    names = [n for n in tools if not n.startswith("$")]
    with ThreadPoolExecutor(max_workers=max(1, len(names))) as ex:
        futures = [(n, ex.submit(safe_probe, n, tools[n], ctx)) for n in names]
        rows = [(n, want_text(n, tools[n])) + f.result() for n, f in futures]
    if "rust" in tools:
        rows.append(("rust-toolchain.toml", want_text("rust", tools["rust"])) + check_rust_toolchain_toml(root, tools["rust"]))
    if "node" in tools:
        rows.append((".node-version", str(tools["node"]["major"])) + check_node_version(root, tools["node"]))
    elapsed = time.time() - started

    name_w = max(len(r[0]) for r in rows)
    want_w = max(len(r[1]) for r in rows)
    print("Bridle toolchain doctor: %d checks in %.1f s (pins %s)" % (len(rows), elapsed, pins_path))
    for name, want, have, status in rows:
        print("%-*s | %-*s | %s | %s" % (name_w, name, want_w, want, have, status))
    bad = [r[0] for r in rows if r[3] != OK]
    summary = "doctor: %d ok, %d failed" % (len(rows) - len(bad), len(bad))
    if bad:
        summary += ": " + ", ".join(bad)
    print(summary)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
PY
