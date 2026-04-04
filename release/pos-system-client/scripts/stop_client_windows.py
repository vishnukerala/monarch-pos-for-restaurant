from __future__ import annotations

import subprocess
import sys
import ctypes
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
RUNTIME_DIR = ROOT_DIR / "runtime"
BACKEND_PID_FILE = RUNTIME_DIR / "backend.pid"
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


def main() -> int:
    pid = ""
    if BACKEND_PID_FILE.exists():
        pid = BACKEND_PID_FILE.read_text(encoding="utf-8").strip()

    if pid:
        subprocess.run(["taskkill", "/PID", pid, "/F"], check=False)
        BACKEND_PID_FILE.unlink(missing_ok=True)
        notify("MONARCH POS stop command sent.")
        return 0

    subprocess.run(
        ["cmd", "/c", 'tasklist /v /fo csv | findstr /i "POS Backend"'],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    notify("No running MONARCH POS backend was found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
