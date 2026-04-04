# Client Setup

This project includes ready-to-use install and run scripts for client machines.

## Easy Method

Linux:

```bash
bash INSTALL_LINUX.sh
bash START_MONARCH_POS.sh
```

Windows:

```bat
INSTALL_WINDOWS.bat
START_MONARCH_POS.vbs
```

The app will open at:

```text
http://localhost:8000
```

From another system on the same network, open:

```text
http://CLIENT-MACHINE-IP:8000
```

## What The Installer Sets Up

- Python backend
- Built React frontend served by the backend
- MySQL database connection
- Backend `.env`
- Default admin user
- Runtime folder and logs

## Required Software

Install these before running the installer.

### Linux Required Packages

- `python3`
- `python3-venv`
- `python3-pip`
- `mysql-server`
- `mysql-client`

Recommended install command for Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip mysql-server mysql-client
```

### Linux Optional Packages

Install these only if you need to rebuild the frontend:

- `nodejs`
- `npm`

Optional command:

```bash
sudo apt install -y nodejs npm
```

For direct thermal printing on Linux:

- `cups`
- `cups-client`
- printer installed in system printer settings

Optional command:

```bash
sudo apt install -y cups cups-client
```

### Windows Required Software

- Python 3.12 or newer
  - install from python.org
  - during install, tick `Add Python to PATH`
- MySQL Server
- MySQL client command `mysql`
  - usually available with MySQL Server / MySQL Shell / MySQL Command Line Client

### Windows Optional Software

Install only if frontend rebuild is needed:

- Node.js LTS
- npm

For direct thermal printing on Windows:

- thermal printer driver installed in Windows
- printer added in `Printers & Scanners`

## Recommended System Preparation

Before install:

- update the operating system
- make sure MySQL service is running
- make sure the printer is already installed in the OS
- keep internet available for first-time Python package install

Linux update:

```bash
sudo apt update && sudo apt upgrade -y
```

Windows update:

- Run normal Windows Update from Settings
- Reboot if updates require it

## Linux Installation Steps

1. Extract the project zip.
2. Open terminal inside the project root.
3. Run:

```bash
bash INSTALL_LINUX.sh
```

4. Enter:
   - MySQL host
   - database name
   - MySQL username
   - MySQL password
   - default admin username
   - default admin password
5. Start the app:

```bash
bash START_MONARCH_POS.sh
```

6. Open:

```text
http://localhost:8000
```

From another system on the same network, open:

```text
http://CLIENT-MACHINE-IP:8000
```

Important for LAN access on Windows:

- Run `INSTALL_WINDOWS.bat` as Administrator when possible.
- The installer will try to allow TCP port `8000` in Windows Firewall.
- If another system still cannot connect, allow TCP port `8000` manually in Windows Firewall.

## Windows Installation Steps

1. Extract the project zip.
2. Open `Command Prompt` inside the project folder.
3. Run:

```bat
INSTALL_WINDOWS.bat
```

4. Enter:
   - MySQL host
   - database name
   - MySQL username
   - MySQL password
   - default admin username
   - default admin password
5. Start the app:

```bat
START_MONARCH_POS.vbs
```

6. Open:

```text
http://localhost:8000
```

## Stop The App

Linux:

```bash
bash STOP_MONARCH_POS.sh
```

Windows:

```bat
STOP_MONARCH_POS.vbs
```

## Automatic Startup

If you want MONARCH POS to start automatically when the system logs in:

Linux:

```bash
bash ENABLE_STARTUP_LINUX.sh
```

To turn it off later:

```bash
bash DISABLE_STARTUP_LINUX.sh
```

Windows:

```bat
ENABLE_STARTUP_WINDOWS.vbs
```

To turn it off later:

```bat
DISABLE_STARTUP_WINDOWS.vbs
```

What it does:

- Linux: creates `~/.config/autostart/monarch-pos.desktop`
- Windows: creates a startup launcher in the user Startup folder

Important:

- Auto startup runs when the user logs in to the desktop
- If you need server-style startup before login, use a service setup instead

## Default Login

By default:

- Username: `admin`
- Password: `admin123`

You can change these during installation.

## Important Notes

- Backend tables are auto-created on first startup.
- The installer creates the database if it does not exist.
- If `frontend/pos-frontend/dist` is already included, Node.js is not required for normal install.
- If `dist` is missing, install `nodejs` and `npm`, then the script will build the frontend.
- For LAN use on phones/tablets, open the IP shown by `START_MONARCH_POS.sh`.
- On Windows, `START_MONARCH_POS.vbs` will show both `localhost` and the machine LAN IP after startup.
- Linux installer creates `Start MONARCH POS.desktop` and `Stop MONARCH POS.desktop` on Desktop when possible.
- Linux installer also creates `Enable MONARCH POS Startup.desktop` and `Disable MONARCH POS Startup.desktop` when possible.
- Windows installer creates `Start MONARCH POS.vbs` and `Stop MONARCH POS.vbs` on Desktop when possible.
- Windows installer also creates `Enable MONARCH POS Startup.vbs` and `Disable MONARCH POS Startup.vbs` on Desktop when possible.
- If `mysql` command is not found, install MySQL client tools first.
- If printer output does not work, first confirm the printer works from the operating system itself.
