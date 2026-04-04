from __future__ import annotations

import subprocess
import sys
import time
import ctypes
import socket
from urllib.error import URLError
from urllib.request import urlopen
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIST = ROOT_DIR / "frontend" / "pos-frontend" / "dist" / "index.html"
RUNTIME_DIR = ROOT_DIR / "runtime"
BACKEND_PORT = 8000
BACKEND_LOG = RUNTIME_DIR / "backend.log"
BACKEND_PID_FILE = RUNTIME_DIR / "backend.pid"
BACKEND_HEALTH_URL = f"http://127.0.0.1:{BACKEND_PORT}/health"
GUI_MODE = "--gui" in sys.argv


def print_and_exit(message: str, code: int = 1) -> int:
    notify(message, error=code != 0)
    return code


def notify(message: str, *, error: bool = False) -> None:
    if GUI_MODE:
        flags = 0x10 if error else 0x40
        try:
            ctypes.windll.user32.MessageBoxW(None, message, "MONARCH POS", flags)
            return
        except Exception:
            pass

    print(message)


def is_pid_running(pid: str) -> bool:
    result = subprocess.run(
        ["tasklist", "/FI", f"PID eq {pid}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return pid in result.stdout


def is_backend_ready() -> bool:
    try:
        with urlopen(BACKEND_HEALTH_URL, timeout=2) as response:
            payload = response.read().decode("utf-8", errors="replace")
    except URLError:
        return False
    except OSError:
        return False

    return "POS Backend Running" in payload


def get_lan_ip() -> str:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip_address = sock.getsockname()[0]
        sock.close()
    except OSError:
        try:
            ip_address = socket.gethostbyname(socket.gethostname())
        except OSError:
            return ""

    if not ip_address or ip_address.startswith("127."):
        return ""

    return ip_address


def wait_for_backend_ready(pid: str, attempts: int = 30, delay: float = 1.0) -> bool:
    for _ in range(attempts):
        if not is_pid_running(pid):
            return False
        if is_backend_ready():
            return True
        time.sleep(delay)
    return False


def main() -> int:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

    if BACKEND_PID_FILE.exists():
        existing_pid = BACKEND_PID_FILE.read_text(encoding="utf-8").strip()
        if existing_pid and is_pid_running(existing_pid):
            return print_and_exit(
                "MONARCH POS is already running.\nUse STOP_MONARCH_POS.bat to stop it."
            )
        BACKEND_PID_FILE.unlink(missing_ok=True)

    if not (BACKEND_DIR / ".env").exists():
        return print_and_exit("Missing backend\\.env\nRun INSTALL_WINDOWS.bat first.")

    venv_python = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    if not venv_python.exists():
        return print_and_exit(
            "Backend virtual environment is not ready.\nRun INSTALL_WINDOWS.bat first."
        )

    if not FRONTEND_DIST.exists():
        return print_and_exit(
            "Frontend build is missing.\nRun INSTALL_WINDOWS.bat first."
        )

    with BACKEND_LOG.open("w", encoding="utf-8") as log_file:
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | getattr(
            subprocess,
            "DETACHED_PROCESS",
            0,
        )
        process = subprocess.Popen(
            [str(venv_python), "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(BACKEND_PORT)],
            cwd=BACKEND_DIR,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            creationflags=creationflags,
        )
        pid = str(process.pid)

    BACKEND_PID_FILE.write_text(pid, encoding="utf-8")

    if not GUI_MODE:
        print("Starting MONARCH POS in background...")

    if not wait_for_backend_ready(pid):
        process.poll()
        if process.returncode is None:
            subprocess.run(["taskkill", "/PID", pid, "/F"], check=False)
        BACKEND_PID_FILE.unlink(missing_ok=True)
        error_message = "MONARCH POS failed to start.\n\nRecent backend log:\n"
        try:
            error_message += BACKEND_LOG.read_text(encoding="utf-8")[-3000:]
        except FileNotFoundError:
            error_message += "No backend log was created."
        notify(error_message, error=True)
        return process.returncode or 1

    lan_ip = get_lan_ip()
    open_lines = [f"http://localhost:{BACKEND_PORT}"]
    if lan_ip:
        open_lines.append(f"http://{lan_ip}:{BACKEND_PORT}")

    notify(
        (
            "MONARCH POS started successfully in background.\n\n"
            "Open POS:\n"
            f"{chr(10).join(open_lines)}\n\n"
            "If another system cannot open the LAN IP, allow TCP port 8000 in Windows Firewall.\n\n"
            "Use STOP_MONARCH_POS.vbs to stop it."
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
