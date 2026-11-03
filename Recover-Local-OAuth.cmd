@echo off
setlocal
cd /d "%~dp0"
node scripts/local-oauth.mjs recover
set "TASK_EXIT=%ERRORLEVEL%"
pause
exit /b %TASK_EXIT%
