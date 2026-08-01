@echo off
echo Mengaktifkan Semua Layanan Luevora...
start cmd /k "call start_backend.bat"
start cmd /k "call start_frontend.bat"
start cmd /k "call start_tunnel.bat"
echo Semua layanan telah dijalankan di window terpisah!
