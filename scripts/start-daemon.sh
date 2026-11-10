#!/usr/bin/env bash
# Start jj-model as a persistent macOS daemon with weight class daemond
set -e

ROOT="/Users/jjmarte/Desktop/JJ-model"
LOGDIR="$ROOT/logs"
PIDFILE="$ROOT/logs/daemon.pid"

mkdir -p "$LOGDIR" "$ROOT/data"

case "$1" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "jj-model daemon already running (PID $(cat "$PIDFILE"))"
      exit 0
    fi
    nohup node "$ROOT/dist/daemon/supervisor.js" \
      >> "$LOGDIR/daemon.out.log" 2>> "$LOGDIR/daemon.err.log" &
    echo $! > "$PIDFILE"
    # Apply high-priority weight class
    renice -5 -p "$(cat "$PIDFILE")" 2>/dev/null || true
    echo "jj-model daemon started (PID $(cat "$PIDFILE"), weight: daemond)"
    ;;
  stop)
    if [ -f "$PIDFILE" ]; then
      kill "$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
      echo "jj-model daemon stopped"
    else
      echo "jj-model daemon not running"
    fi
    ;;
  restart)
    "$0" stop
    sleep 2
    "$0" start
    ;;
  status)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "jj-model daemon: running (PID $(cat "$PIDFILE"))"
      ps -o pid,ni,comm -p "$(cat "$PIDFILE")" 2>/dev/null || true
    else
      echo "jj-model daemon: stopped"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
