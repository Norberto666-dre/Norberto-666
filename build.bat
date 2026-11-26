@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta en el PATH. Instalalo desde https://nodejs.org
  exit /b 1
)

echo ==============================================
echo  OVERCLOCK 9 - aplicacion de escritorio
echo ==============================================

if "%~1"=="" goto build
if /i "%~1"=="--watch" goto watch
goto pass

:watch
echo  Modo vigilancia: abre la app y recarga al guardar.
echo  Pulsa Ctrl+C para detener.
node "tools\build.mjs" --watch
exit /b %ERRORLEVEL%

:pass
node "tools\build.mjs" %*
exit /b %ERRORLEVEL%

:build
echo  Uso:
echo    build.bat              genera dist\ y OVERCLOCK9.exe
echo    build.bat --dev        abre la app con el codigo fuente (Ctrl+R recarga)
echo    build.bat --check      prueba de humo con la consola vigilada
echo    build.bat --serve      servidor web para probar en navegador
echo    build.bat --watch      abre la app y recarga sola al guardar
echo    build.bat --dir        empaquetado rapido sin instaladores
echo.
node "tools\build.mjs" %*
exit /b %ERRORLEVEL%
