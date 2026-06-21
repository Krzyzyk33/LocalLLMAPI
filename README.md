# LocalLLMAPI

Lokalny, superszybki serwer API symulujący endpointy w stylu OpenAI (np. `/v1/chat/completions`, `/v1/models`), zasilany przez `llama-cpp-python` z obsługą akceleracji sprzętowej (Vulkan/CUDA). W zestawie wbudowany menedżer modeli, system generowania własnych kluczy API, dokładne logowanie i nowoczesny czat testowy ("Playground") uruchamiany bezpośrednio w przeglądarce!

## Funkcje

- **Zgodność z API OpenAI**: Endpointy w pełni kompatybilne z bibliotekami i klientami OpenAI.
- **Panel Webowy**: Piękny, responsywny interfejs użytkownika z Dark Mode. Zobacz statystyki użycia, zarządzej modelami i testuj klucze.
- **Zarządzanie Kluczami API**: Możliwość tworzenia wielu kluczy do różnych aplikacji, śledzenia statystyk, logowania każdego zapytania i zliczania użytych tokenów.
- **Optymalizacja Pamięci (VRAM)**: Uruchomione modele są automatycznie wyładowywane z pamięci po 2 minutach bezczynności, aby zwolnić zasoby karty graficznej.
- **Wbudowany Playground**: Interaktywny czat do testowania modeli w czasie rzeczywistym, oferujący płynne strumieniowanie tekstu od serwera i statystyki generowania (tokeny/s).
- **Zarządzanie Modelami GGUF**: Aplikacja samodzielnie odczytuje dostępne na dysku modele w formacie `.gguf` i wystawia je w API.

## Wymagania

- **Python 3.10+**
- Opcjonalnie kompatybilna karta graficzna do akceleracji.

## Uruchomienie

1. Uruchom `install_vulkan.bat` (lub ręcznie użyj komendy instalacyjnej), by pobrać wszystkie zależności do szybkiej pracy na karcie graficznej.
2. Zdobądź swoje modele LLM (np. Llama 3, Qwen) w formacie `.gguf` i umieść je bezpośrednio w folderze `models/`.
3. Odpal `start.bat`. Serwer i aplikacja internetowa będą dostępne pod adresem `http://127.0.0.1:8000`.

*Projekt do użytku domowego i jako lekka lokalna piaskownica (sandbox) LLM.*
