@echo off
cd /d "%~dp0.."
node scripts\working-wallet-setup.cjs
echo.
echo You may close this window after reading the result.
pause
