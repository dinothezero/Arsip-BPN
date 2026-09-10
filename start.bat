@echo off
title Sistem Arsip Digital - Kantor Pertanahan
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js tidak ditemukan.
  echo     Unduh dan install dari https://nodejs.org  ^(versi 22.5 atau lebih baru^)
  echo     lalu jalankan start.bat lagi.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [*] Menginstall dependensi (pertama kali)...
  call npm install
  if errorlevel 1 (
    echo [!] Gagal menginstall dependensi.
    pause
    exit /b 1
  )
)

echo.
echo [*] Menjalankan Sistem Arsip Digital...
echo     Buka browser:  http://localhost:3000
echo     Tekan Ctrl+C di jendela ini untuk menghentikan server.
echo.
call npm start
pause