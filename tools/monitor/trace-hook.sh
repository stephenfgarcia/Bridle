#!/usr/bin/env bash
# Claude Code hook entry point (see .claude/settings.json): traces subagent tool calls for the Bridle Build Monitor.
# Always exits 0 and prints nothing; the work is in tools/monitor/trace_hook.py.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 "$ROOT/tools/monitor/trace_hook.py" "$ROOT" 2>/dev/null || true
exit 0
