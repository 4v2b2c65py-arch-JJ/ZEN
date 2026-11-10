#!/usr/bin/env bash
# Final command: Start jj-model with full autonomous stack
# MCP tools + directory autonomy + cross-device awareness + media (screen/camera)
set -e

ROOT="/Users/jjmarte/Desktop/JJ-model"
LOGDIR="$ROOT/logs"

mkdir -p "$LOGDIR" "$ROOT/data"

echo "=== jj-model Full Autonomous Stack ==="
echo "Building TypeScript..."
cd "$ROOT"
npx tsc
echo "Build complete."

# Start the full-stack supervisor (includes cross-comm, auto-work, cross-device, media)
PIDFILE="$ROOT/logs/fullstack.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "Full stack already running (PID $(cat "$PIDFILE"))"
else
  nohup node "$ROOT/dist/index.js" \
    >> "$LOGDIR/fullstack.out.log" 2>> "$LOGDIR/fullstack.err.log" &
  echo $! > "$PIDFILE"
  renice -5 -p "$(cat "$PIDFILE")" 2>/dev/null || true
  echo "Full stack started (PID $(cat "$PIDFILE"), weight: daemond)"
fi

echo ""
echo "=== Services Running ==="
echo "Main API:        ws://localhost:3333"
echo "Cross-comm P2P:  ws://localhost:4445"
echo "Autonomous dir:  watching ./data ./src (auto-organize on)"
echo "Cross-device:    Apple device sync every 30s"
echo "Media:           screen share + camera (ffmpeg/avfoundation)"
echo "MCP tools:       stdio server (jj_memory_*, jj_mac_*, jj_cross_*, jj_idevice_*, jj_network_*, jj_autonomous_dir)"
echo ""
echo "Weight class: daemond (high priority, keep-alive)"
echo "Condition:    automatic cross-to-cross coms + data transfer + device awareness + media"
echo ""
echo "To stop: ./scripts/stop-fullstack.sh"
