#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"

stop_process() {
  local pid_file="$1"
  local name="$2"

  if [ ! -f "$pid_file" ]; then
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    echo "Stopped $name (PID $pid)"
  fi

  rm -f "$pid_file"
}

stop_process "$BACKEND_PID_FILE" "backend"

echo "POS client stopped."
