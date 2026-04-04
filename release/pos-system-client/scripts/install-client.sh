#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend/pos-frontend"

create_linux_desktop_launcher() {
  local desktop_dir="$1"
  local filename="$2"
  local title="$3"
  local script_path="$4"
  local launcher_path="$desktop_dir/$filename"

  cat > "$launcher_path" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$title
Comment=$title
Exec=bash -lc "cd '$ROOT_DIR' && bash '$script_path'; printf '\\nPress Enter to close...'; read _"
Path=$ROOT_DIR
Terminal=true
Icon=utilities-terminal
Categories=Office;
EOF
  chmod +x "$launcher_path"
}

create_linux_click_launchers() {
  local desktop_dir=""

  if command -v xdg-user-dir >/dev/null 2>&1; then
    desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
  fi

  if [ -z "$desktop_dir" ]; then
    desktop_dir="$HOME/Desktop"
  fi

  chmod +x \
    "$ROOT_DIR/ENABLE_STARTUP_LINUX.sh" \
    "$ROOT_DIR/DISABLE_STARTUP_LINUX.sh" \
    "$ROOT_DIR/INSTALL_LINUX.sh" \
    "$ROOT_DIR/RUN_LINUX.sh" \
    "$ROOT_DIR/STOP_LINUX.sh" \
    "$ROOT_DIR/START_MONARCH_POS.sh" \
    "$ROOT_DIR/STOP_MONARCH_POS.sh" \
    "$ROOT_DIR/scripts/enable-linux-startup.sh" \
    "$ROOT_DIR/scripts/disable-linux-startup.sh" \
    "$ROOT_DIR/scripts/install-client.sh" \
    "$ROOT_DIR/scripts/run-client.sh" \
    "$ROOT_DIR/scripts/stop-client.sh"

  if [ -d "$desktop_dir" ]; then
    create_linux_desktop_launcher \
      "$desktop_dir" \
      "Start MONARCH POS.desktop" \
      "Start MONARCH POS" \
      "$ROOT_DIR/START_MONARCH_POS.sh"
    create_linux_desktop_launcher \
      "$desktop_dir" \
      "Stop MONARCH POS.desktop" \
      "Stop MONARCH POS" \
      "$ROOT_DIR/STOP_MONARCH_POS.sh"
    create_linux_desktop_launcher \
      "$desktop_dir" \
      "Enable MONARCH POS Startup.desktop" \
      "Enable MONARCH POS Startup" \
      "$ROOT_DIR/ENABLE_STARTUP_LINUX.sh"
    create_linux_desktop_launcher \
      "$desktop_dir" \
      "Disable MONARCH POS Startup.desktop" \
      "Disable MONARCH POS Startup" \
      "$ROOT_DIR/DISABLE_STARTUP_LINUX.sh"
  fi
}

write_env_line() {
  local key="$1"
  local value="$2"

  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s="%s"\n' "$key" "$value"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

prompt_value() {
  local label="$1"
  local default_value="$2"
  local secret="${3:-0}"
  local value=""

  if [ "$secret" = "1" ]; then
    read -rsp "$label [$default_value]: " value
    echo
  else
    read -rp "$label [$default_value]: " value
  fi

  if [ -z "$value" ]; then
    value="$default_value"
  fi

  printf '%s' "$value"
}

mysql_exec() {
  local host="$1"
  local user="$2"
  local password="$3"
  local sql="$4"

  if [ -n "$password" ]; then
    MYSQL_PWD="$password" mysql -h "$host" -u "$user" -e "$sql"
  else
    mysql -h "$host" -u "$user" -e "$sql"
  fi
}

require_command python3
require_command mysql

echo "POS client installation"
echo
echo "Required packages:"
echo "  - python3"
echo "  - python3-venv"
echo "  - python3-pip"
echo "  - mysql server"
echo "  - mysql client command: mysql"
echo "Optional packages:"
echo "  - nodejs and npm (only if frontend dist build is missing)"
echo "  - cups / cups-client for Linux printer setup"
echo

DB_HOST="$(prompt_value "MySQL host" "127.0.0.1")"
DB_NAME="$(prompt_value "Database name" "pos_system")"
DB_USER="$(prompt_value "MySQL user" "root")"
DB_PASSWORD="$(prompt_value "MySQL password" "" 1)"
ADMIN_USERNAME="$(prompt_value "Default admin username" "admin")"
ADMIN_PASSWORD="$(prompt_value "Default admin password" "admin123" 1)"

echo
echo "Creating database if needed..."
mysql_exec "$DB_HOST" "$DB_USER" "$DB_PASSWORD" \
  "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

{
  write_env_line "DB_HOST" "$DB_HOST"
  write_env_line "DB_USER" "$DB_USER"
  write_env_line "DB_PASSWORD" "$DB_PASSWORD"
  write_env_line "DB_NAME" "$DB_NAME"
  echo
  write_env_line "DEFAULT_ADMIN_USERNAME" "$ADMIN_USERNAME"
  write_env_line "DEFAULT_ADMIN_PASSWORD" "$ADMIN_PASSWORD"
  echo
  write_env_line "EMAIL_HOST" ""
  echo "EMAIL_PORT=587"
  echo "EMAIL_SECURE=false"
  write_env_line "EMAIL_USER" ""
  write_env_line "EMAIL_PASS" ""
  write_env_line "EMAIL_FROM" ""
  write_env_line "APP_URL" "http://localhost:8000"
} > "$BACKEND_DIR/.env"

echo "Preparing backend virtual environment..."
if [ ! -d "$BACKEND_DIR/venv" ]; then
  python3 -m venv "$BACKEND_DIR/venv"
fi

"$BACKEND_DIR/venv/bin/pip" install --upgrade pip
"$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"

if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
  require_command npm
  echo "Installing frontend dependencies..."
  npm install --prefix "$FRONTEND_DIR"

  echo "Building frontend..."
  npm run build --prefix "$FRONTEND_DIR"
else
  echo "Using existing frontend build from dist/"
fi

mkdir -p "$ROOT_DIR/runtime"
create_linux_click_launchers

echo
echo "Installation completed."
echo "Default admin login:"
echo "  Username: $ADMIN_USERNAME"
echo "  Password: $ADMIN_PASSWORD"
echo
echo "Open POS after start:"
echo "  http://localhost:8000"
echo
echo "Easy click files:"
echo "  $ROOT_DIR/START_MONARCH_POS.sh"
echo "  $ROOT_DIR/STOP_MONARCH_POS.sh"
echo "  $ROOT_DIR/ENABLE_STARTUP_LINUX.sh"
echo "  $ROOT_DIR/DISABLE_STARTUP_LINUX.sh"
echo
echo "Next step:"
echo "  bash START_MONARCH_POS.sh"
