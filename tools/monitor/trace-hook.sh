#!/usr/bin/env bash
# Claude Code hook entry point (see .claude/settings.json): traces subagent tool calls for the Bridle Build Monitor.
# Always exits 0 and prints nothing; the work is in tools/monitor/trace_hook.py.
# Traces, the identity cache and the automatic agent.done go to .bridle/progress of the main checkout, which
# `log.sh --main-root` names (the rule is in the header of log.sh), so a session started in a linked worktree writes
# where the mirror reads; when that call fails, to the checkout holding this script.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MAIN="$("$ROOT/tools/monitor/log.sh" --main-root 2>/dev/null </dev/null || echo "$ROOT")"
python3 "$ROOT/tools/monitor/trace_hook.py" "${MAIN:-$ROOT}" 2>/dev/null || true
exit 0
