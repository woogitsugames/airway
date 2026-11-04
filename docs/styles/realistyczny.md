# Globus „Realistyczny” (D-170) — świat gry od 2026-11-04

Zastępuje globus z kierunku „Diorama” (D-11). Interfejs z przedmiotów lotniskowych z D-11 (karta pokładowa,
przywieszki, pasek ATC, etykiety frachtowe, tablica odlotów, drogowskaz) zostaje bez zmian i jest opisany w
`diorama.md`.

## Idea w jednym zdaniu
Prawdziwa Ziemia widziana z orbity, a na niej narysowane ręką lotniska, trasy i samoloty. Ziemia jest tłem i
światłem, a gra to warstwa, którą gracz na nią kładzie.

## Co jest na globusie
- **Powierzchnia:** NASA Blue Marble Next Generation z lipca (D-176). Rzeźba terenu z NOAA ETOPO5: wysokość to
  pierwiastek z kilometrów, przesadzona jak na makiecie, a płyty lotnisk są spłaszczone.
- **Noc:** światła miast z NASA Black Marble 2016 na nocnej półkuli; ciepły pas zmierzchu na terminatorze (D-63).
- **Morze:** odblask słońca i połysk przy krawędzi, liczone w shaderze terenu (G4).
- **Niebo:** halo atmosfery, niebieskie w dzień i ciepłe o zmierzchu, oraz cienka mgiełka przy krawędzi globusa.
- **Chmury:** cienka warstwa pod płytami lotnisk (chmura nigdy nie zasłania lotniska). Tylko od presetu medium.
- **Bez drzew, kamieni i puszystych chmur** z dioramy. Cała ilustracyjność przeszła na obiekty gry.

## Obiekty gry (D-178 „Medalion”)
- **Lotnisko:** jasna okrągła płyta, ciemny pas z białą linią, terminal z dachem w kolorze typu (morski hub,
  ceglasty zwykły) i **gruby ciemny obrys**, który odcina płytę od każdego tła. Hub ma większą płytę i wieżę.
- **Trasy:** szerokokadłubowe to ciągła jasna rurka, turbośmigłowe to złote kreski; obie mają ciemny obrys
  tuszem. Typy rozróżnia kształt (ciągła lub przerywana, wysoko lub nisko), nie tylko kolor.
- **Pasażerowie i zator:** bez zmian (przywieszki z glifami D-08, pierścień miejsc, czerwone odliczanie).

## Kontrast (D-47 / D-177)
Sonda mierzy brzeg obiektu względem globusa oraz rdzeń względem brzegu. Zrzuty do sklepu (seed 0xA1A1,
zmierzch i noc nad Europą) dają trasy, lotniska i samoloty 9,4–11,6:1, a złoty zmierzch 0,13–0,17 (próg 0,045).

## Unikalność i lista zakazów
Globus z Blue Marble to częsty widok, więc tożsamość gry niosą obiekty lotniskowe i papierowy interfejs. Brak
płaskiego pastelowego tła i planu metra: bryła jest oświetlona i ma rzeźbę terenu. Drugi tryb „Mapa” (D-172) ma
własną paletę i jest w planie (G8).

## Licencje
NASA Earth Observatory (Blue Marble, Black Marble), NOAA ETOPO5: domena publiczna; chmury to własna praca (CC0).
Szczegóły w `docs/ASSETS.md`, a podziękowania na ekranie Ustawienia → Licencje.
