#!/usr/bin/env bash
# jj-model daemon control script
# Usage: ./scripts/daemon.sh {start|stop|restart|status|install|uninstall}

set -e

ROOT="/Users/jjmarte/Desktop/JJ-model"
PLIST="$ROOT/config/daemon/com.jjmarte.jj-model.plist"
LAUNCHCTL_DOMAIN="gui/$(id -u)"
PLIST_TARGET="$HOME/Library/LaunchAgents/com.jjmarte.jj-model.plist"

case "$1" in
  install)
    cp "$PLIST" "$PLIST_TARGET"
    launchctl bootstrap "$LAUNCHCTL_DOMAIN" "$PLIST_TARGET" 2>/dev/null || true
    launchctl kickstart -k "$LAUNCHCTL_DOMAIN/com.jjmarte.jj-model" 2>/dev/null || true
    echo "jj-model daemon installed and started"
    ;;
  uninstall)
    launchctl bootout "$LAUNCHCTL_DOMAIN/com.jjmarte.jj-model" 2>/dev/null || true
    rm -f "$PLIST_TARGET"
    echo "jj-model daemon uninstalled"
    ;;
  start)
    launchctl kickstart -k "$LAUNCHCTL_DOMAIN/com.jjmarte.jj-model" 2>/dev/null || \
      (cp "$PLIST" "$PLIST_TARGET" && launchctl bootstrap "$LAUNCHCTL_DOMAIN" "$PLIST_TARGET")
    echo "jj-model daemon started"
    ;;
  stop)
    launchctl bootout "$LAUNCHCTL_DOMAIN/com.jjmarte.jj-model" 2>/dev/null || true
    echo "jj-model daemon stopped"
    ;;
  restart)
    "$0" stop
    sleep 2
    "$0" start
    ;;
  status)
    if launchctl print "$LAUNCHCTL_DOMAIN/com.jjmarte.jj-model" 2>/dev/null | grep -q "state = running"; then
      echo "jj-model daemon: running"
    else
      echo "jj-model daemon: stopped"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|install|uninstall}"
    exit 1
    ;;
esac
