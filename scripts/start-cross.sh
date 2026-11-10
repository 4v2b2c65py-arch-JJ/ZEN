#!/usr/bin/env bash
# Final command: Start jj-model with automatic cross-to-cross work conditions
# Sets up: daemon + cross-comm + auto-work engine + data transfer
set -e

ROOT="/Users/jjmarte/Desktop/JJ-model"
LOGDIR="$ROOT/logs"
PIDFILE="$ROOT/logs/crosscomm.pid"

mkdir -p "$LOGDIR" "$ROOT/data"

echo "=== jj-model Cross-to-Cross Auto-Work Setup ==="

# Build
echo "Building TypeScript..."
cd "$ROOT"
npx tsc

echo "Build complete."

# Start cross-comm + auto-work daemon
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "Cross-comm already running (PID $(cat "$PIDFILE"))"
else
  nohup node "$ROOT/dist/crosscomm/server.js" \
    >> "$LOGDIR/crosscomm.out.log" 2>> "$LOGDIR/crosscomm.err.log" &
  echo $! > "$PIDFILE"
  renice -5 -p "$(cat "$PIDFILE")" 2>/dev/null || true
  echo "Cross-comm server started (PID $(cat "$PIDFILE"), weight: daemond)"
fi

# Start auto-work engine
AUTO_PIDFILE="$ROOT/logs/autowork.pid"
if [ -f "$AUTO_PIDFILE" ] && kill -0 "$(cat "$AUTO_PIDFILE")" 2>/dev/null; then
  echo "Auto-work engine already running (PID $(cat "$AUTO_PIDFILE"))"
else
  nohup node "$ROOT/dist/autowork/server.js" \
    >> "$LOGDIR/autowork.out.log" 2>> "$LOGDIR/autowork.err.log" &
  echo $! > "$AUTO_PIDFILE"
  renice -5 -p "$(cat "$AUTO_PIDFILE")" 2>/dev/null || true
  echo "Auto-work engine started (PID $(cat "$AUTO_PIDFILE"), weight: daemond)"
fi

echo ""
echo "=== Services Running ==="
echo "Main API:    ws://localhost:3333"
echo "Cross-comm:  ws://localhost:4445"
echo "Auto-work:   active (5s check interval)"
echo "Data transfer: ready"
echo ""
echo "Weight class: daemond (high priority, keep-alive)"
echo "Condition:    automatic cross-to-cross coms + data transfer"
echo ""
echo "To stop: ./scripts/stop-cross.sh"
