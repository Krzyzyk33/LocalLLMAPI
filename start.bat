@echo off
chcp 65001 > nul
title LocalLLMAPI
cd /d "%~dp0"

echo.
echo   LocalLLMAPI - lokalny router OpenAI
echo   http://localhost:1000
echo.
echo   Uruchamianie serwera... (zamknij to okno lub Ctrl+C aby zatrzymac)
echo.

start "" "http://localhost:1000"
python -m uvicorn backend.router_server:app --host 0.0.0.0 --port 1000

echo.
echo Serwer zatrzymany.
pause
