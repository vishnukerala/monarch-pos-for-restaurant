#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend/pos-frontend"
RUNTIME_DIR="$ROOT_DIR/runtime"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/health"

mkdir -p "$RUNTIME_DIR"

is_running() {
  local pid_file="$1"
  if [ ! -f "$pid_file" ]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file")"
  kill -0 "$pid" >/dev/null 2>&1
}

wait_for_backend_ready() {
  local attempts="${1:-30}"
  local delay="${2:-1}"
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if ! is_running "$BACKEND_PID_FILE"; then
      return 1
    fi

    if python3 - "$BACKEND_HEALTH_URL" <<'PY' >/dev/null 2>&1
import json
import sys
from urllib.request import urlopen

url = sys.argv[1]

with urlopen(url, timeout=2) as response:
    payload = json.load(response)

if "POS Backend Running" not in str(payload.get("message", "")):
    raise SystemExit(1)
PY
    then
      return 0
    fi

    sleep "$delay"
  done

  return 1
}

if is_running "$BACKEND_PID_FILE"; then
  echo "POS client is already running."
  echo "Use: bash scripts/stop-client.sh"
  exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "Missing backend/.env"
  echo "Run: bash scripts/install-client.sh"
  exit 1
fi

if [ ! -x "$BACKEND_DIR/venv/bin/uvicorn" ]; then
  echo "Backend virtual environment is not ready."
  echo "Run: bash scripts/install-client.sh"
  exit 1
fi

if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
  echo "Frontend build is missing."
  echo "Run: bash scripts/install-client.sh"
  exit 1
fi

(
  cd "$BACKEND_DIR"
  nohup venv/bin/uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" >"$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
)

echo "Starting MONARCH POS in background..."

if ! wait_for_backend_ready 30 1; then
  if is_running "$BACKEND_PID_FILE"; then
    kill "$(cat "$BACKEND_PID_FILE")" >/dev/null 2>&1 || true
  fi
  rm -f "$BACKEND_PID_FILE"
  echo "MONARCH POS failed to start."
  echo "Recent backend log:"
  tail -n 40 "$BACKEND_LOG" 2>/dev/null || true
  exit 1
fi

HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

echo "MONARCH POS started successfully in background."
echo "Open POS:"
echo "  http://localhost:$BACKEND_PORT"
if [ -n "$HOST_IP" ]; then
  echo "  http://$HOST_IP:$BACKEND_PORT"
fi
echo
echo "Logs:"
echo "  $BACKEND_LOG"
