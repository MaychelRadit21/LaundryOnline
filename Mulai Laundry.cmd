@echo off
setlocal
cd /d "%~dp0"
title Rinso Laundry

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Pasang Node.js 22.13 atau lebih baru dari https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Memasang dependensi, mohon tunggu...
  call npm install
  if errorlevel 1 (
    echo Instalasi gagal. Periksa koneksi internet.
    pause
    exit /b 1
  )
)

echo Membuka http://127.0.0.1:5173 ...
start "" /b cmd /c "timeout /t 5 /nobreak >nul & start http://127.0.0.1:5173"
call npm run dev
pause
