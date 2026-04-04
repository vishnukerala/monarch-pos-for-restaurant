from __future__ import annotations

import ctypes
import os
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
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
        startup_dir = get_startup_dir()
        startup_dir.mkdir(parents=True, exist_ok=True)
        launcher_path = startup_dir / "MONARCH POS Auto Start.vbs"
        start_vbs = ROOT_DIR / "START_MONARCH_POS.vbs"
        launcher_path.write_text(
            (
                'Set shell = CreateObject("WScript.Shell")\r\n'
                f'shell.Run """" & "{start_vbs}" & """", 0, False\r\n'
            ),
            encoding="utf-8",
        )
    except Exception as exc:  # noqa: BLE001
        notify(f"Failed to enable startup.\n\n{exc}", error=True)
        return 1

    notify(
        "MONARCH POS will now start automatically when Windows logs in.\n\n"
        "You can turn this off with DISABLE_STARTUP_WINDOWS.vbs."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
