# MONARCH POS SYSTEM

Restaurant POS system for dine-in, parcel, waiter ordering, kitchen token printing, receipt printing, daily expenses, and sales reporting.

## Overview

MONARCH POS is built for restaurant billing operations with:

- table and floor management
- cashier billing screen
- waiter order screen for phone/tablet use
- token/KOT printing by product printer
- final bill printing through the main bill printer
- daily expenses and close-cash flow
- bill reprint and bill edit
- mail delivery of daily sales reports
- login branding and receipt customization

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI
- Database: MySQL
- Printing: system printer integration

## Repository Structure

```text
backend/                     FastAPI backend
frontend/pos-frontend/       React frontend
scripts/                     install, run, stop, packaging helpers
release/                     generated client package
CLIENT_SETUP.md              client-machine setup guide
```

## Requirements

Install these before setup.

### Linux

- `python3`
- `python3-venv`
- `python3-pip`
- `mysql-server`
- `mysql-client`

Example:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip mysql-server mysql-client
```

Optional if you want to rebuild frontend locally:

- `nodejs`
- `npm`

Optional for direct thermal printing:

- `cups`
- `cups-client`

Example:

```bash
sudo apt install -y nodejs npm cups cups-client
```

### Windows

- Python `3.12+`
  - install from `https://www.python.org/downloads/`
  - enable `Add Python to PATH`
- MySQL Server
- MySQL client command `mysql`
  - usually available with MySQL installation

Optional if you want to rebuild frontend locally:

- Node.js LTS
- npm

For direct printing on Windows:

- printer driver installed
- printer added in `Printers & Scanners`

## Download And Install

You can either:

1. clone the repository
2. or download the packaged client zip from the release/client folder prepared for deployment

### Clone From Git

```bash
git clone https://github.com/vishnukerala/monarch-pos-for-restaurant.git
cd monarch-pos-for-restaurant
```

### Download ZIP From GitHub

1. Open the GitHub repository.
2. Click `Code`.
3. Click `Download ZIP`.
4. Extract the ZIP.
5. Open the extracted project folder.

## Easy Install

### Linux

```bash
bash INSTALL_LINUX.sh
bash START_MONARCH_POS.sh
```

### Windows

```bat
INSTALL_WINDOWS.bat
START_MONARCH_POS.vbs
```

After startup, open:

```text
http://localhost:8000
```

From another system on the same network:

```text
http://CLIENT-MACHINE-IP:8000
```

## What The Installer Sets Up

- Python virtual environment
- backend dependencies
- built frontend served by the backend
- backend `.env`
- MySQL database creation
- default admin account
- runtime folder and logs
- start/stop helpers

## Step-By-Step Linux Setup

1. Extract or clone the project.
2. Open terminal in the project root.
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

6. To stop:

```bash
bash STOP_MONARCH_POS.sh
```

## Step-By-Step Windows Setup

1. Extract or clone the project.
2. Open `Command Prompt` in the project root.
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

6. To stop:

```bat
STOP_MONARCH_POS.vbs
```

## Automatic Startup

### Linux

Enable:

```bash
bash ENABLE_STARTUP_LINUX.sh
```

Disable:

```bash
bash DISABLE_STARTUP_LINUX.sh
```

### Windows

Enable:

```bat
ENABLE_STARTUP_WINDOWS.vbs
```

Disable:

```bat
DISABLE_STARTUP_WINDOWS.vbs
```

## Default Login

Default values unless changed during installation:

- Username: `admin`
- Password: `admin123`

## User Workflow

### Admin

Main responsibilities:

- create users
- manage access control
- configure printers
- customize receipt settings
- upload login logo
- manage floors, tables, categories, products, stock
- view reports
- reprint and edit bills
- override locked closed-cash dates if needed

Typical flow:

1. Login as admin.
2. Configure floors and tables.
3. Add printers.
4. Set product categories and items.
5. Assign token printers to products where needed.
6. Configure receipt settings and mail recipients.
7. Monitor reports and operations.

### Cashier

Main responsibilities:

- open table billing screen
- add/remove items as allowed
- receive payment
- print final bill
- manage daily expenses
- close cash
- view and edit billed sales as allowed

Typical flow:

1. Open `Sale`.
2. Select table.
3. Add items.
4. Print token if required.
5. Receive payment.
6. Save and print final bill.
7. Add daily expenses.
8. Close cash at end of day.

### Waiter

Main responsibilities:

- open waiter table screen
- add items from tablet/phone
- send token print
- continue service on the same table

Typical flow:

1. Login as waiter.
2. Open table from waiter screen.
3. Add items.
4. Print token.
5. Add more items later if needed.
6. Cashier completes final bill.

## Main Screens

- `Login`
- `Sale` table screen
- `Billing` screen
- `Waiter` table screen
- `Waiter Order` screen
- `Edit Sale`
- `Daily Expenses`
- `Reports`
- `Users`
- `Printers`
- `Access Control`
- `Stock`
- `Floors`
- `Tables`
- `Login Branding`
- `Mail Configuration`

## Printing Workflow

- One printer can be marked as the `Main Bill Printer`
- Other printers can be used as `Token Printers`
- Each product can be assigned to a token printer
- Products without a printer do not print on token
- Final bill goes to the main bill printer
- Token print goes only to the assigned product printer

## Notes

- Backend tables are auto-created on first startup
- Use `http://localhost:8000` or `http://CLIENT-IP:8000` for normal client usage
- For stable client operation, prefer the backend-served app on port `8000`
- Receipt and report settings are stored in the database

## Support

If there is any doubt about installation or setup, contact the author:

`vishnu.vja@gmail.com`
