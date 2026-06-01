@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Autoservice CRM

echo ========================================
echo   Autoservice CRM - starting
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :no_node

for /f "delims=" %%v in ('node -v 2^>nul') do echo Node.js: %%v
echo.

if not exist "node_modules" goto :install_deps
goto :after_install

:install_deps
echo Running npm install...
call npm install
if errorlevel 1 goto :fail_install

:after_install
if not exist "data" mkdir "data"

echo Rebuilding native modules for this Node.js version...
call npm rebuild better-sqlite3
if errorlevel 1 goto :fail_rebuild

echo Running database migrations...
call npm run migrate
if errorlevel 1 goto :fail_migrate_retry

echo Seeding owner user...
call npm run seed:owner -- --username owner --password owner --name Owner
if errorlevel 1 goto :fail_seed

if not exist ".env" (
  if exist ".env.example" copy /y ".env.example" ".env" >nul
)

set "PORT=3000"
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /i "PORT=" ".env" 2^>nul`) do set "PORT=%%b"
)

echo.
echo Open in browser: http://localhost:%PORT%/login
echo Login: owner
echo Password: owner
echo.
echo Press Ctrl+C to stop the server
echo.

call npm start
goto :end

:no_node
echo ERROR: Node.js is not installed.
echo Download from https://nodejs.org/
pause
exit /b 1

:fail_install
echo ERROR: npm install failed.
pause
exit /b 1

:fail_migrate_retry
echo Migration failed, retrying after full rebuild...
call npm rebuild
if errorlevel 1 goto :fail_rebuild
call npm run migrate
if errorlevel 1 goto :fail_migrate

:fail_rebuild
echo ERROR: npm rebuild failed. Try: rmdir /s /q node_modules ^& npm install
pause
exit /b 1

:fail_migrate
echo ERROR: migrations failed.
pause
exit /b 1

:fail_seed
echo ERROR: seed owner failed.
pause
exit /b 1

:end
echo.
echo Server stopped.
pause
endlocal
