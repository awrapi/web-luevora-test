@echo off
echo Mengaktifkan Frontend Luevora...
cd /d "%~dp0..\..\frontend"
call npm run dev
pause

