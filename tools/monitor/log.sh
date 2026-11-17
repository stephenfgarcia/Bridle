#!/usr/bin/env bash
# Bridle Build Monitor: append one progress event as a JSON line and print the
# matching artifact-db write op (so the agent can mirror it with db_write).
#
# Usage:
#   tools/monitor/log.sh -r <runId> -p <phase> -a <agentId> -t <taskId> -T <type> -m "<message>" \
#                        [-P <progress 0-100>] [-l <level>] [-s <step>] [-L "<agent label>"] [-S <status>] [-d '<json data>']
#                        [-i <stepIndex> -n <stepCount>]   (written as data.stepIndex / data.stepCount: "step 3 of 7")
#
# type   : run.start | run.end | task.status | agent.start | agent.progress | agent.log |
#          agent.heartbeat | agent.done | agent.fail | note | card.move | agent.activity
# level  : debug | info | warn | error            (default info; error for agent.fail)
# status : planned | queued | running | blocked | review | done | failed   (task.status events)
#
# The line is appended to  <main checkout>/.bridle/progress/<runId>/<agentId>.jsonl
# and the op is printed to stdout as one JSON object:  {"op":"set","path":"events/<id>","data":{...}}
#
# The main checkout is the directory in BRIDLE_MAIN_ROOT when that is set; otherwise, when the checkout holding the
# script is a linked git worktree whose common git directory is <dir>/.git, it is <dir>; in every other case it is the
# checkout holding the script. (Cases run by tools/monitor/test/card.test.py: the main checkout, a linked worktree, a
# copy outside git, the override, a worktree reached through a path in another letter case. A BRIDLE_MAIN_ROOT that is
# not an absolute path to a directory is an error: exit 1, nothing written.)
#
#   tools/monitor/log.sh --main-root     print the main checkout and exit (trace-hook.sh asks this way)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

main_root() {
  if [ -n "${BRIDLE_MAIN_ROOT:-}" ]; then
    if [ "${BRIDLE_MAIN_ROOT#/}" = "$BRIDLE_MAIN_ROOT" ] || [ ! -d "$BRIDLE_MAIN_ROOT" ]; then
      echo "log.sh: BRIDLE_MAIN_ROOT is not an absolute path to a directory: $BRIDLE_MAIN_ROOT" >&2
      return 1
    fi
    (cd "$BRIDLE_MAIN_ROOT" && pwd)
    return
  fi
  local out git_dir common_dir top
  # git 2.31 or later for --path-format; without git, outside a repository or with an older git the call fails and
  # the answer is the checkout holding the script.
  if out="$(env -u GIT_DIR -u GIT_WORK_TREE git -C "$ROOT" rev-parse --path-format=absolute --git-dir --git-common-dir --show-toplevel 2>/dev/null </dev/null)"; then
    { IFS= read -r git_dir; IFS= read -r common_dir; IFS= read -r top; } <<<"$out" || true
    if [ -n "$common_dir" ] && [ "$git_dir" != "$common_dir" ] && [ "$(basename "$common_dir")" = ".git" ] \
       && [ "$top" -ef "$ROOT" ]; then  # the same directory, not the same string: a path may differ in letter case
      dirname "$common_dir"
      return
    fi
  fi
  printf '%s\n' "$ROOT"
}

if [ "$#" -eq 1 ] && [ "$1" = "--main-root" ]; then
  main_root
  exit
fi
MAIN="$(main_root)"
exec python3 - "$MAIN" "$@" <<'PY'
import sys, json, os, time, getopt, re
root = sys.argv[1]
opts, _ = getopt.getopt(sys.argv[2:], "r:p:a:t:T:m:P:l:s:L:S:d:i:n:")
o = dict(opts)
need = ["-r", "-p", "-a", "-t", "-T", "-m"]
missing = [k for k in need if k not in o]
if missing:
    sys.exit("log.sh: missing required flags: " + " ".join(missing))
safe = lambda s: re.sub(r"[^A-Za-z0-9_.-]", "-", s)
run, phase, agent, task = o["-r"], o["-p"], safe(o["-a"]), o["-t"]
etype, message = o["-T"], o["-m"]
level = o.get("-l") or ("error" if etype == "agent.fail" else "info")
now = time.time()
ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
ms = int(now * 1000)
d = os.path.join(root, ".bridle", "progress", safe(run))
os.makedirs(d, exist_ok=True)
path = os.path.join(d, agent + ".jsonl")
seq = 0
if os.path.exists(path):
    with open(path, "r", encoding="utf-8") as f:
        seq = sum(1 for line in f if line.strip())
seq += 1
ev = {
    "ts": ts, "tsMs": ms, "seq": seq, "runId": run, "phase": phase, "taskId": task,
    "agentId": agent, "agentLabel": o.get("-L") or agent, "type": etype, "level": level,
    "message": message,
}
if "-P" in o:
    ev["progress"] = max(0, min(100, int(float(o["-P"]))))
if "-s" in o:
    ev["step"] = o["-s"]
if "-S" in o:
    ev["status"] = o["-S"]
if "-d" in o:
    try:
        ev["data"] = json.loads(o["-d"])
    except Exception as e:
        ev["data"] = {"raw": o["-d"], "parseError": str(e)}
if "-i" in o or "-n" in o:
    if not isinstance(ev.get("data"), dict):
        ev["data"] = {} if "data" not in ev else {"raw": ev["data"]}
    for flag, key in (("-i", "stepIndex"), ("-n", "stepCount")):
        if flag in o:
            try:
                ev["data"][key] = int(float(o[flag]))
            except ValueError:
                ev["data"][key + "Raw"] = o[flag]
doc_id = f"{ms}-{agent}-{seq:04d}"
ev["id"] = doc_id
with open(path, "a", encoding="utf-8") as f:
    f.write(json.dumps(ev, ensure_ascii=False) + "\n")
print(json.dumps({"op": "set", "path": "events/" + doc_id, "data": ev}, ensure_ascii=False))
PY
