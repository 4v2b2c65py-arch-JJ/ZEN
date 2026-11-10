#!/usr/bin/env bash
set -e

ROOT="/Users/jjmarte/Desktop/JJ-model"

stop_pid() {
  local file="$1"
  local name="$2"
  if [ -f "$file" ]; then
    local pid
    pid=$(cat "$file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "$name stopped (PID $pid)"
    else
      echo "$name was not running"
    fi
    rm -f "$file"
  else
    echo "$name not running (no pidfile)"
  fi
}

stop_pid "$ROOT/logs/fullstack.pid" "Full stack"
stop_pid "$ROOT/logs/crosscomm.pid" "Cross-comm"
stop_pid "$ROOT/logs/autowork.pid" "Auto-work engine"
stop_pid "$ROOT/logs/daemon.pid" "Main daemon"

echo "All jj-model services stopped."
