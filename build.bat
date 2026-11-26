@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta en el PATH. Instalalo desde https://nodejs.org
  exit /b 1
)

echo ============================================
echo  OVERCLOCK 9 - construir APK Android
echo ============================================
node "%~dp0tools\build-apk.mjs" %*
exit /b %ERRORLEVEL%
