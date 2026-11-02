# Kierunek D — „Mapa pilota” (ODRZUCONY 2.11.2026, zostaje jako zapis)

Makiety: `mockups/chart/png/` · źródło `mockups/chart/build.mjs`.

**Status:** odrzucony po pierwszych makietach. Uwaga właściciela: „jest zbyt minimalistyczny, co upodabnia się do Mini Metro”
(decyzja D-05). Zostawiamy go, bo z niego pochodzą rozwiązania przeniesione do pozostałych kierunków.

## Idea
Globus jako działająca mapa lotnicza (sectional/Jeppesen): hub = symbol lotniska z kreskami pojemności, cisza nocna = kreskowana
strefa zakazana, szerokokadłubowe trasy = podwójna linia, turbośmigłowe = przerywana z okręgiem zasięgu, tydzień = podziałka mapy.

## Co przeniesiono dalej
- Pojemność huba jako **pierścień/listwa miejsc** (Diorama: segmenty na płycie, Poczta: listwa perforacji, Atlas: wieniec paciorków).
- **Odliczanie do zatoru** przy hubie zamiast w rogu ekranu.
- **Podgląd trasy za długiej** dla turbośmigłowca (czerwony fragment + podpowiedź o międzylądowaniu).
- **Typ samolotu kształtem linii** (ciągła/przerywana, pojedyncza/podwójna).
- **Znacznik miasta za krawędzią ekranu.**

## Dlaczego odpadł
Jasne tło + cienkie kolorowe linie + abstrakcyjne symbole w praktyce czytają się jak plan metra — ta sama rodzina co Mini Metro
i Mini Airways, mimo lotniczych symboli. Mało „świata do oglądania”, więc słabe zrzuty sklepowe i słaba tożsamość.

Paleta (Chart Paper `#EEF0E6`, Chart Blue `#1F4E9C`, Sectional Magenta `#B0177E`, Warning Vermilion `#D24A1C`, Ink `#2B2A28`),
typografia Big Shoulders Display + IBM Plex Sans Condensed/Mono. Krój B612 (Airbus) odpadł, bo **nie ma polskich znaków**.
