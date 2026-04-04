#!/usr/bin/env bash
set -euo pipefail

AUTOSTART_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/monarch-pos.desktop"

rm -f "$AUTOSTART_FILE"

echo "MONARCH POS automatic startup is now disabled."
