from __future__ import annotations

import getpass
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend" / "pos-frontend"
RUNTIME_DIR = ROOT_DIR / "runtime"


def prompt(label: str, default: str = "", secret: bool = False) -> str:
    suffix = f" [{default}]" if default else ""
    full_label = f"{label}{suffix}: "

    if secret:
        value = getpass.getpass(full_label)
    else:
        value = input(full_label)

    return value or default


def ensure_command(name: str, message: str) -> None:
    if shutil.which(name):
        return

    print(message)
    sys.exit(1)


def run_checked(
    command: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    error_message: str,
) -> None:
    try:
        subprocess.run(command, cwd=cwd, env=env, check=True)
    except subprocess.CalledProcessError as exc:
        print(error_message)
        print(f"Command failed: {' '.join(command)}")
        print(f"Exit code: {exc.returncode}")
        sys.exit(exc.returncode or 1)


def run_optional(
    command: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
) -> bool:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            env=env,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return False

    return completed.returncode == 0


def env_line(key: str, value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'{key}="{escaped}"\n'


def write_backend_env(
    db_host: str,
    db_name: str,
    db_user: str,
    db_password: str,
    admin_username: str,
    admin_password: str,
) -> None:
    env_text = "".join(
        [
            env_line("DB_HOST", db_host),
            env_line("DB_USER", db_user),
            env_line("DB_PASSWORD", db_password),
            env_line("DB_NAME", db_name),
            "\n",
            env_line("DEFAULT_ADMIN_USERNAME", admin_username),
            env_line("DEFAULT_ADMIN_PASSWORD", admin_password),
            "\n",
            env_line("EMAIL_HOST", ""),
            "EMAIL_PORT=587\n",
            "EMAIL_SECURE=false\n",
            env_line("EMAIL_USER", ""),
            env_line("EMAIL_PASS", ""),
            env_line("EMAIL_FROM", ""),
            env_line("APP_URL", "http://localhost:8000"),
        ]
    )
    (BACKEND_DIR / ".env").write_text(env_text, encoding="utf-8")


def create_windows_click_launchers() -> None:
    desktop_dir = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Desktop"
    start_launcher = ROOT_DIR / "START_MONARCH_POS.vbs"
    stop_launcher = ROOT_DIR / "STOP_MONARCH_POS.vbs"
    enable_startup_launcher = ROOT_DIR / "ENABLE_STARTUP_WINDOWS.vbs"
    disable_startup_launcher = ROOT_DIR / "DISABLE_STARTUP_WINDOWS.vbs"

    if desktop_dir.exists():
        (desktop_dir / "Start MONARCH POS.vbs").write_text(
            (
                'Set shell = CreateObject("WScript.Shell")\r\n'
                f'shell.Run """" & "{start_launcher}" & """", 0, False\r\n'
            ),
            encoding="utf-8",
        )
        (desktop_dir / "Stop MONARCH POS.vbs").write_text(
            (
                'Set shell = CreateObject("WScript.Shell")\r\n'
                f'shell.Run """" & "{stop_launcher}" & """", 0, False\r\n'
            ),
            encoding="utf-8",
        )
        (desktop_dir / "Enable MONARCH POS Startup.vbs").write_text(
            (
                'Set shell = CreateObject("WScript.Shell")\r\n'
                f'shell.Run """" & "{enable_startup_launcher}" & """", 0, False\r\n'
            ),
            encoding="utf-8",
        )
        (desktop_dir / "Disable MONARCH POS Startup.vbs").write_text(
            (
                'Set shell = CreateObject("WScript.Shell")\r\n'
                f'shell.Run """" & "{disable_startup_launcher}" & """", 0, False\r\n'
            ),
            encoding="utf-8",
        )


def ensure_windows_firewall_rule() -> bool:
    run_optional(
        [
            "netsh",
            "advfirewall",
            "firewall",
            "delete",
            "rule",
            "name=MONARCH POS 8000",
        ]
    )
    return run_optional(
        [
            "netsh",
            "advfirewall",
            "firewall",
            "add",
            "rule",
            "name=MONARCH POS 8000",
            "dir=in",
            "action=allow",
            "protocol=TCP",
            "localport=8000",
        ]
    )


def main() -> int:
    print("POS client installation")
    print()
    print("Required software:")
    print("  - Python 3.12 or newer")
    print("  - MySQL Server")
    print("  - MySQL client command: mysql")
    print("Optional software:")
    print("  - Node.js and npm (only if frontend dist build is missing)")
    print("  - Printer driver already installed in Windows")
    print()

    ensure_command("mysql", "Missing MySQL client command: mysql")

    db_host = prompt("MySQL host", "127.0.0.1")
    db_name = prompt("Database name", "pos_system")
    db_user = prompt("MySQL user", "root")
    db_password = prompt("MySQL password", secret=True)
    admin_username = prompt("Default admin username", "admin")
    admin_password = prompt("Default admin password", "admin123", secret=True)

    mysql_env = os.environ.copy()
    if db_password:
        mysql_env["MYSQL_PWD"] = db_password

    run_checked(
        [
            "mysql",
            "-h",
            db_host,
            "-u",
            db_user,
            "-e",
            f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
        ],
        env=mysql_env,
        error_message="Failed to create or connect to the MySQL database.",
    )

    write_backend_env(
        db_host=db_host,
        db_name=db_name,
        db_user=db_user,
        db_password=db_password,
        admin_username=admin_username,
        admin_password=admin_password,
    )

    python_exe = sys.executable
    venv_python = BACKEND_DIR / "venv" / "Scripts" / "python.exe"

    if not venv_python.exists():
        run_checked(
            [python_exe, "-m", "venv", str(BACKEND_DIR / "venv")],
            error_message="Failed to create the backend virtual environment.",
        )

    run_checked(
        [str(venv_python), "-m", "pip", "install", "--upgrade", "pip"],
        error_message="Failed to upgrade pip in the backend virtual environment.",
    )
    run_checked(
        [str(venv_python), "-m", "pip", "install", "-r", str(BACKEND_DIR / "requirements.txt")],
        error_message="Failed to install backend requirements.",
    )

    if not (FRONTEND_DIR / "dist" / "index.html").exists():
        ensure_command(
            "npm",
            "Frontend build missing and npm is not installed.",
        )
        run_checked(
            ["npm", "install", "--prefix", str(FRONTEND_DIR)],
            error_message="Failed to install frontend dependencies.",
        )
        run_checked(
            ["npm", "run", "build", "--prefix", str(FRONTEND_DIR)],
            error_message="Failed to build the frontend.",
        )
    else:
        print("Using existing frontend build from dist/")

    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    create_windows_click_launchers()
    firewall_rule_added = ensure_windows_firewall_rule()

    print()
    print("Installation completed.")
    print("Default admin login:")
    print(f"  Username: {admin_username}")
    print(f"  Password: {admin_password}")
    print()
    print("Open POS after start:")
    print("  http://localhost:8000")
    print()
    print("Easy click files:")
    print(rf"  {ROOT_DIR}\START_MONARCH_POS.vbs")
    print(rf"  {ROOT_DIR}\STOP_MONARCH_POS.vbs")
    print(rf"  {ROOT_DIR}\ENABLE_STARTUP_WINDOWS.vbs")
    print(rf"  {ROOT_DIR}\DISABLE_STARTUP_WINDOWS.vbs")
    if firewall_rule_added:
        print()
        print("Windows Firewall:")
        print("  TCP port 8000 was allowed for LAN access.")
    else:
        print()
        print("Windows Firewall:")
        print("  Could not add TCP port 8000 automatically.")
        print("  If another system cannot open the POS, run the installer as Administrator")
        print("  or allow TCP port 8000 manually in Windows Firewall.")
    print()
    print("Next step:")
    print(r"  START_MONARCH_POS.vbs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
