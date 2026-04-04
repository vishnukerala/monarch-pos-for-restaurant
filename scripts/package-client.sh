#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/release"
PACKAGE_NAME="pos-system-client"
STAGING_DIR="$RELEASE_DIR/$PACKAGE_NAME"
ZIP_PATH="$RELEASE_DIR/${PACKAGE_NAME}.zip"

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/backend" "$STAGING_DIR/frontend/pos-frontend" "$STAGING_DIR/scripts"

cp "$ROOT_DIR/CLIENT_SETUP.md" "$STAGING_DIR/"
cp "$ROOT_DIR/INSTALL_LINUX.sh" "$STAGING_DIR/"
cp "$ROOT_DIR/INSTALL_WINDOWS.bat" "$STAGING_DIR/"
cp "$ROOT_DIR/RUN_LINUX.sh" "$STAGING_DIR/"
cp "$ROOT_DIR/RUN_WINDOWS.bat" "$STAGING_DIR/"
cp "$ROOT_DIR/START_MONARCH_POS.sh" "$STAGING_DIR/"
cp "$ROOT_DIR/START_MONARCH_POS.bat" "$STAGING_DIR/"
cp "$ROOT_DIR/START_MONARCH_POS.vbs" "$STAGING_DIR/"
cp "$ROOT_DIR/STOP_LINUX.sh" "$STAGING_DIR/"
cp "$ROOT_DIR/STOP_WINDOWS.bat" "$STAGING_DIR/"
cp "$ROOT_DIR/STOP_MONARCH_POS.sh" "$STAGING_DIR/"
cp "$ROOT_DIR/STOP_MONARCH_POS.bat" "$STAGING_DIR/"
cp "$ROOT_DIR/STOP_MONARCH_POS.vbs" "$STAGING_DIR/"
cp "$ROOT_DIR/ENABLE_STARTUP_LINUX.sh" "$STAGING_DIR/"
cp "$ROOT_DIR/DISABLE_STARTUP_LINUX.sh" "$STAGING_DIR/"
cp "$ROOT_DIR/ENABLE_STARTUP_WINDOWS.vbs" "$STAGING_DIR/"
cp "$ROOT_DIR/DISABLE_STARTUP_WINDOWS.vbs" "$STAGING_DIR/"
cp "$ROOT_DIR/backend/main.py" "$STAGING_DIR/backend/"
cp "$ROOT_DIR/backend/requirements.txt" "$STAGING_DIR/backend/"
cp "$ROOT_DIR/backend/.env.example" "$STAGING_DIR/backend/"
cp -r "$ROOT_DIR/backend/app" "$STAGING_DIR/backend/"
cp -r "$ROOT_DIR/frontend/pos-frontend/dist" "$STAGING_DIR/frontend/pos-frontend/"
cp "$ROOT_DIR/scripts/install-client.sh" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/run-client.sh" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/stop-client.sh" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/install-client.bat" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/run-client.bat" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/stop-client.bat" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/install_client_windows.py" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/run_client_windows.py" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/run_client_windows.pyw" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/stop_client_windows.py" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/stop_client_windows.pyw" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/enable-linux-startup.sh" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/disable-linux-startup.sh" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/enable_windows_startup.py" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/enable_windows_startup.pyw" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/disable_windows_startup.py" "$STAGING_DIR/scripts/"
cp "$ROOT_DIR/scripts/disable_windows_startup.pyw" "$STAGING_DIR/scripts/"

find "$STAGING_DIR" -type d -name "__pycache__" -prune -exec rm -rf {} +

mkdir -p "$RELEASE_DIR"
rm -f "$ZIP_PATH"

(
  cd "$RELEASE_DIR"
  zip -rq "${PACKAGE_NAME}.zip" "$PACKAGE_NAME"
)

echo "Created package:"
echo "  $ZIP_PATH"
