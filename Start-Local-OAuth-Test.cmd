@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0scripts\Start-Local-OAuth-Test.ps1"
set "TASK_EXIT=%ERRORLEVEL%"
echo.
echo Local OAuth launcher finished. Secret input belongs only in this local console.
pause
exit /b %TASK_EXIT%
