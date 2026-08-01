@echo off
echo Starting Cloudflare Tunnel for Frontend (port 5173)...
echo The tunnel URL will appear below (look for https://....trycloudflare.com)
echo.
cd /d %~dp0..
.\cloudflared.exe tunnel --url http://localhost:5173
pause
