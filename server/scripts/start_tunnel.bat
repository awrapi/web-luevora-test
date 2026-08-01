@echo off
echo Starting Cloudflare Tunnel for port 3001...
echo The tunnel URL will appear below (look for https://....trycloudflare.com)
echo.
cd /d "%~dp0.."
.\cloudflared.exe tunnel --url http://localhost:3001
pause
