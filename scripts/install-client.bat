@echo off
setlocal

where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Missing Python.
    exit /b 1
  )
  set PYTHON_CMD=python
) else (
  set PYTHON_CMD=py -3
)

%PYTHON_CMD% "%~dp0install_client_windows.py"
