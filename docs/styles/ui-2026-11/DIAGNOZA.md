# Diagnoza: co w dzisiejszym UI wygląda na „AI slop” i gryzie się z satelitarnym globusem

Podstawa: Twoja ocena z 4.11 („wygląd globusu jest ładny, ale UI gry jest brzydki, nie pasuje”). Zrzuty to
prawdziwa gra na `dev` (seed 0xA1A1, kadr `storeShot=game`), PL:
`docs/mockups/ui-2026-11/_frames/dzis-game-p.png`, `dzis-game-l.png`, `dzis-menu-p.png`, a także zrzuty sklepowe
`docs/store/shots/pl/{game,upgrade,failure,menu}-phone.png` (są starsze, ale UI jest to samo).

## Najważniejsze: dwa światy obok siebie
Globus jest teraz **fotografią** (Blue Marble, światła miast, relief). UI został zaprojektowany do **ilustrowanej
dioramy** z D-11: papier, karton, kremowe przywieszki. Na zdjęciu Ziemi papierowe przedmioty wyglądają jak
naklejki położone na ekran, a nie jak część tego świata. Stąd wrażenie „nie pasuje”.

## Konkretnie

1. **Kremowe prostokąty z ząbkami (karta pokładowa, górny pasek).** Duża jasna plama `#FBF8F1` na niebie, ciemny
   pasek z lewej, dziurki „perforacji” i kreskowany separator. Wygląda jak szablon karty z generatora UI; kolor kremu
   nie występuje nigdzie na globusie. `dzis-game-p.png`, góra.
2. **Kartonowe przywieszki bagażowe w doku.** Sześć brązowych „kraft” kafelków z oczkiem, sznurkiem i kreskowaną
   ramką. Każdy kafelek ma ten sam kształt, więc dok czyta się jak rząd identycznych kart. Kolor kraft ściera się z
   zimnym błękitem oceanu i czernią nocnej strony. `dzis-game-p.png`, dół; `game-phone.png`.
3. **Przywieszki lotnisk to białe karty z cieniem.** Na jasnym tle (pustynia, dzień) giną, na nocy świecą jak
   wycięte prostokąty. Kod + pionowa kreska + glify w kolorach: typowa „pigułka” z UI kit. `docs/shots/06/airports-p-1x.png`,
   `dzis-game-p.png` (ATH, AMM, BGW nachodzą na siebie i na płyty lotnisk).
4. **Brak hierarchii stanu.** Zator różni się tylko czerwonym licznikiem na przywieszce; na pierwszy rzut oka
   wszystkie tagi są takie same. Trend zapełnienia (D-221) to włosowe szewrony na białej karcie, prawie niewidoczne.
5. **Typografia „domyślna”.** Overpass + Atkinson w małych, szeroko rozstrzelonych kapitalikach (TYDZIEŃ, GODZ.,
   PASAŻERÓW) i grubych cyfrach: poprawne, ale bez charakteru; to wygląda jak każdy dashboard.
6. **Ikony w jednym stylu „pack”.** Pełne sylwetki samolotów, globus z południkami, zębatka‑słońce dla huba:
   czytelne, ale identyczne grubości i rozmiary, bez związku z resztą świata. Szare „1 dzień” w kreskowanej ramce wygląda
   na wyłączony przycisk z formularza.
7. **Tablica, raport i skrzynie to trzy różne style naraz.** Żółty pasek „Tydzień 1”, beżowe etykiety frachtowe z
   ząbkami, czarna tablica odlotów, kremowa karta ATC z czerwonym marginesem (`upgrade-phone.png`,
   `failure-phone.png`). Każdy ekran ma inną metaforę i inny papier, więc całość nie ma jednego autora.
8. **Menu: litery split‑flap jako ozdobnik.** Każda litera w osobnej klapce z przekreśleniem (`dzis-menu-p.png`):
   ciekawe raz, ale przy pięciu pozycjach męczy oko, a słowa czyta się wolno. Żółty znak „Airway” jest najmocniejszym
   elementem obecnego UI.
9. **Zaokrąglenia, cienie, kremowe tła** dokładnie z listy zakazów w CLAUDE.md („generic rounded cards with default
   shadows”). Nie ma glassmorphismu ani neonu, ale suma kart daje ten sam efekt.

## Poza zakresem UI, ale widać na każdym kadrze
**Płaskie jasnoniebieskie niebo** `#8CC3D8` za globusem pochodzi z dioramy i jest stałą w `src/render/world.ts`
(`DIORAMA_SKY`). Przy fotograficznej Ziemi wygląda jak tło slajdu. Makiety go **nie zmieniają** (ten sam kadr we
wszystkich kierunkach), ale każdy z kierunków wyglądałby jeszcze lepiej na ciemnym niebie. To zmiana w `src/render`,
czyli zadanie sesji globusa (ext), nie UI.
