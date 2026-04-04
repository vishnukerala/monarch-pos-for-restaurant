from __future__ import annotations

import ctypes
import os
import sys
from pathlib import Path


GUI_MODE = "--gui" in sys.argv


def notify(message: str, *, error: bool = False) -> None:
    if GUI_MODE:
        flags = 0x10 if error else 0x40
        try:
            ctypes.windll.user32.MessageBoxW(None, message, "MONARCH POS", flags)
            return
        except Exception:
            pass

    print(message)


def get_startup_dir() -> Path:
    appdata = os.environ.get("APPDATA")

    if not appdata:
        raise RuntimeError("APPDATA folder not found")

    return Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"


def main() -> int:
    try:
        launcher_path = get_startup_dir() / "MONARCH POS Auto Start.vbs"
        launcher_path.unlink(missing_ok=True)
    except Exception as exc:  # noqa: BLE001
        notify(f"Failed to disable startup.\n\n{exc}", error=True)
        return 1

    notify("MONARCH POS automatic startup is now disabled.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
