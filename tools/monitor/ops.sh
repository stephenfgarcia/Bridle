#!/usr/bin/env bash
# Print the artifact-db write ops for a run's local JSONL events, chunked for db_write.
# Usage: tools/monitor/ops.sh <runId> [agentId] [chunk=50]
# Each output line is one JSON array of up to <chunk> ops: pass it as the "ops" argument of
# mcp__claude-artifacts__db_write (one call per line, 2 s pause between calls).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN="${1:?runId required}"; AGENT="${2:-}"; CHUNK="${3:-50}"
DIR="$ROOT/.bridle/progress/$RUN"
[ -d "$DIR" ] || { echo "no progress directory for run $RUN" >&2; exit 1; }
if [ -n "$AGENT" ]; then FILES=("$DIR/$AGENT.jsonl"); else FILES=("$DIR"/*.jsonl); fi
cat "${FILES[@]}" | jq -c 'select(.id != null) | {op:"set", path:("events/" + .id), data:.}' | jq -c -s --argjson n "$CHUNK" '[_nwise($n)][] '
