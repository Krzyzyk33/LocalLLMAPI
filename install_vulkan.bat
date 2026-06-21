@echo off
echo Instalowanie wymagan...
pip install -r requirements.txt

echo.
echo Instalowanie llama-cpp-python z akceleracja Vulkan...
echo Wymagane jest wczesniejsze zainstalowanie Vulkan SDK oraz kompilatorow C++ (np. Visual Studio Build Tools).
set CMAKE_ARGS=-DGGML_VULKAN=on
pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir

echo Gotowe!
pause
