#!/usr/bin/env bash
# Bridle Build Monitor: emit one line whenever unmirrored events are waiting, for the Monitor tool.
# Usage: tools/monitor/watch.sh [intervalSeconds]   (default: syncIntervalSeconds in .bridle/monitor.json, else 5)
# Each printed line means "run a mirror pass now": mirror.py pending --take, db_write each batch, mirror.py ack --all.
# Nothing is printed while a batch is in flight, so the pace is one line per mirror pass.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INTERVAL="${1:-}"
if [ -z "$INTERVAL" ]; then
  INTERVAL="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('syncIntervalSeconds', 5))" "$ROOT/.bridle/monitor.json" 2>/dev/null || echo 5)"
fi
while true; do
  line="$(python3 "$ROOT/tools/monitor/mirror.py" poll 2>/dev/null || true)"
  [ -n "$line" ] && echo "$line"
  sleep "$INTERVAL"
done
