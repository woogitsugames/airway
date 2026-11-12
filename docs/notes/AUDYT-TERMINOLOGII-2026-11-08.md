# Audyt terminologii i liczb — 8 listopada 2026

Punkt odniesienia: `origin/dev` 316d556; decyzja D-323 i faktyczny stan plików w tym commicie. Audyt jest propozycją zmian, nie zmienia opisanych dokumentów. Nowy kierunek jest decyzją i pracą w toku; nie należy przedstawiać go jako już wdrożonego.

| Plik i linia | Obserwacja | Proponowana poprawka |
|---|---|---|
| `docs/SITE.md:122–123` | Zdanie o Róży i braku tablicy split-flap brzmi jak aktualny opis, choć D-323 odrzuciła poprzedni kierunek. Jednocześnie opisuje istniejące materiały, których nie wolno uznać za wymienione bez sprawdzenia. | Oznaczyć akapit jako stan materiałów z D-257, podać datę i dodać, że ich wymiana oraz copy nastąpią przy U7 po wdrożeniu D-323. Po U7 opisać faktycznie wygenerowane obrazy. |
| `docs/IOS.md:58` | Linoryt jest tu nazwą faktycznego koloru bieżącego zasobu startowego i historycznym źródłem D-301, a nie dowodem wdrożenia nowego wyglądu. | Zachować kolor `#ECE3CC` do czasu rzeczywistej zmiany zasobów; oznaczyć go jako obecny stan techniczny, a odniesienie do Linorytu jako historyczne. Po wdrożeniu i obejrzeniu nowych zasobów zaktualizować opis i kolor. |

Przeszukano wskazane istniejące `docs/SITE.md`, `docs/ANDROID.md`, `docs/IOS.md`, `docs/PLAYTEST.md`, `docs/legal/**` oraz dodatkowo `docs/LAUNCH.md`. Na tym commicie nie ma `README.md` ani katalogu `docs/launch/`; `docs/LAUNCH.md` nie jest automatycznie tożsamy z brakującym katalogiem. Pozostałe wystąpienia numerów decyzji, rozmiarów i liczb w tych plikach wymagają kontekstu; sam numer historycznej decyzji lub wynik historycznego pomiaru nie jest błędem. Nie stwierdzono innych jednoznacznie przestarzałych wzmianek o wymienionych kierunkach ani liczby kroków `test:fast` w przeszukanym zakresie. Nie weryfikowano wizualnie wszystkich istniejących obrazów ani zgodności prawnej dokumentów.
