#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTOSTART_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
AUTOSTART_FILE="$AUTOSTART_DIR/monarch-pos.desktop"

mkdir -p "$AUTOSTART_DIR"

cat > "$AUTOSTART_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=MONARCH POS
Comment=Start MONARCH POS automatically on login
Exec=bash -lc "cd '$ROOT_DIR' && bash '$ROOT_DIR/scripts/run-client.sh'"
Path=$ROOT_DIR
Terminal=false
X-GNOME-Autostart-enabled=true
Categories=Office;
EOF

chmod +x "$AUTOSTART_FILE"

echo "MONARCH POS will now start automatically when you log in."
echo "Autostart file:"
echo "  $AUTOSTART_FILE"
