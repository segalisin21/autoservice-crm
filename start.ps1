# Запуск CRM автосервиса (PowerShell)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "========================================"
Write-Host "  CRM автосервиса - запуск"
Write-Host "========================================"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ОШИБКА] Node.js не найден. Установите с https://nodejs.org/" -ForegroundColor Red
  Read-Host "Enter для выхода"
  exit 1
}

Write-Host "Node.js: $(node -v)"
Write-Host ""

if (-not (Test-Path "node_modules")) {
  Write-Host "Установка зависимостей..."
  npm install
}

if (-not (Test-Path "data")) {
  New-Item -ItemType Directory -Path "data" | Out-Null
}

Write-Host "Миграции БД..."
npm run migrate

Write-Host "Пользователь owner..."
npm run seed:owner -- --username owner --password owner --name Owner

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
}

$port = 3000
if (Test-Path ".env") {
  $line = Get-Content ".env" | Where-Object { $_ -match '^\s*PORT=' } | Select-Object -First 1
  if ($line -match 'PORT=(\d+)') { $port = [int]$Matches[1] }
}

Write-Host ""
Write-Host "http://localhost:$port/login"
Write-Host "Логин: owner / Пароль: owner"
Write-Host ""

npm start
