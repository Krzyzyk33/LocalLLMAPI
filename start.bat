@echo off
setlocal
echo ===================================
echo Local LLM API Manager (OpenRouter Clone)
echo ===================================
echo 1. Uruchom serwer API w tle i wlacz interfejs Web
echo 2. Uruchom tylko serwer API (bez interfejsu przegladarki)
echo ===================================
set /p wybor="Wybierz opcje (1-2): "

if "%wybor%"=="1" goto web
if "%wybor%"=="2" goto server

:web
echo Uruchamianie serwera w tle...
start "LLM API Server" /B python -m uvicorn backend.router_server:app --host 0.0.0.0 --port 8000 > server.log 2>&1
echo Otwieranie interfejsu Web w przegladarce...
start http://localhost:8000
echo Naciśnij dowolny klawisz aby zakończyć proces serwera...
pause >nul
goto end

:server
echo Uruchamianie serwera na porcie 8000...
python -m uvicorn backend.router_server:app --host 0.0.0.0 --port 8000
goto end

:end
echo Koniec.
