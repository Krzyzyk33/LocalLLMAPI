@echo off
chcp 65001 > nul
title LocalLLMAPI
cd /d "%~dp0"

REM Backend GPU jest wtopiony w llama-cpp-python przy kompilacji, wiec
REM sprawdzamy to zanim serwer wstanie - inaczej uzytkownik widzi klucz
REM "Vulkan", a kazdy request konczy sie bledem 503.
python -m backend.router_server --backends

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
