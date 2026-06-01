@echo off
setlocal
cd /d "%~dp0"

echo Import spreadsheet into CRM...
echo File: c:\open cod\auto\Учет - Лист1.csv
echo.

call npm rebuild better-sqlite3
if errorlevel 1 goto :fail

call npm run migrate
if errorlevel 1 goto :fail

call npm run import:uchet -- "c:\open cod\auto\Учет - Лист1.csv"
if errorlevel 1 goto :fail

echo.
echo Done. Start server: start.bat
echo Open journal: http://localhost:3000/journal
pause
exit /b 0

:fail
echo Import failed.
pause
exit /b 1
