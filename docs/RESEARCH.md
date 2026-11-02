# Research — gra o sieci linii lotniczej na globusie (etap 0)

Stan na **2026-11-02**. Synteza trzech raportów (pełne wersje ze źródłami w `docs/research/`):
[`market.md`](research/market.md) (rynek, projekt gry, nazwy), [`art-direction.md`](research/art-direction.md)
(referencje i kierunki), [`ux-tech.md`](research/ux-tech.md) (globus, HUD, gesty, render, symulacja, dźwięk)
oraz audytu naszych gier [`family-audit.md`](research/family-audit.md). Wszystko, czego nie dało się
potwierdzić, jest w raportach oznaczone jako UNVERIFIED.

## 1. Konkurencja (zweryfikowane)

| Gra | Co to jest | Liczby (2.11.2026) | Wniosek dla nas |
|---|---|---|---|
| [Mini Airways](https://store.steampowered.com/app/2289650/) (Erabit/CCC) | kontrola lotów (ATC), każdy samolot ręcznie | Steam 30.07.2024, 9,99 $, **92% z 1 378**; [iOS](https://apps.apple.com/app/id6478572512) 4,99 $, 18.06.2025, **121 ocen**; [Google Play](https://play.google.com/store/apps/details?id=com.mini.airways.paid.gp) 4,99 $, **~1 050 ocen, 10K+** (więcej niż zakładaliśmy); Switch 25.06.2026 | Z roadmapy 2026 **już wyszły**: licencje, nowe mapy, DLC *Busy Skies*, „Black Box” (scenariusze kryzysów, dzienne scenariusze). Multiplayer (Q4) jeszcze nie. Skargi z recenzji potwierdzone: mikrozarządzanie, „graj aż przegrasz”, identyczne samoloty, hitboxy, „brak osobowości”. |
| [Fly Corp](https://store.steampowered.com/app/1372530/Fly_Corp/) | tycoon sieci połączeń w menu | Steam 14,99 $, 86%; mobile F2P (Azur Games), [Google Play 3,08★ z ~52 tys.](https://play.google.com/store/apps/details?id=world.fly.corp) | Top recenzja negatywna: **płaska mapa prowadzi LA–Tokio nad Europą**. Globus to realna przewaga. |
| [Mini Metro](https://store.steampowered.com/app/287980/) / Mini Motorways | wzorzec gatunku | Mini Metro: szacunki **6–14 mln** sprzedanych, iOS 3,99 $ (31,8 tys. ocen); Motorways **9 mln graczy**, na iOS w Apple Arcade + darmowe „Intro” (07.2026) | Model „darmowe wejście → odblokowanie” stosuje już lider gatunku. Twórcy egzekwują znak towarowy ([Mini Subway usunięty z eShopu](https://www.nintendolife.com/news/2022/08/mini-metro-copycat-game-has-been-removed-from-switch-eshop)). |
| **[Tiny Airline](https://store.steampowered.com/app/5337690/)** (Inner Core Studios, NL) — **nowe, najbliższe zagrożenie** | rysowanie tras między 400+ lotniskami na **płaskiej mapie „stołowej”**, zasięg, pozwolenia na oceany, prąd strumieniowy, ulepszenie co noc, Daily/Weekly Sky, kształty pasażerów, porażka przy zapchanym lotnisku | Steam „coming soon”, tylko PC/Mac/Linux | Zasięg i „ulepszenie co cykl” **nie są już naszymi wyróżnikami**. Zostaje: globus 3D, terminator dnia i nocy (fale popytu, cisza nocna), przesiadki z minimalnym czasem, mobile pion. |
| [miniairways.co](https://miniairways.co/) (anonimowa gra przeglądarkowa, nie Erabit) | przesiadki wielosegmentowe przez huby, porażka przy przepełnionym terminalu | demo Europa za darmo, płatne 8 regionów; Steam/iOS/Play „planned” | Dowód, że mechanika przesiadek jest „w powietrzu”. Musimy wygrać wykonaniem i tożsamością. |

Pozostałe gry pokrewne (AirlineSim, Airline Manager 4, Pocket Planes, Freeways, Railbound, Rail Route i in.) — tabela w
[`market.md` §2](research/market.md). **Nie znaleziono** wydanej gry premium na telefon z globusem, terminatorem i przesiadkami
w hubach (to „nie znaleziono”, nie dowód, że nie istnieje).

## 2. Czego chcą gracze (z recenzji negatywnych)
Celu lub końca zamiast „graj aż przegrasz”; uczciwej porażki; planowania zamiast mikrozarządzania; różnych samolotów i ulepszeń,
które coś zmieniają; realizmu (globus); przeglądu całej sieci i jasnych reguł; więcej treści i mniej „klona”; wydajności przy dużej skali.

## 3. Rekomendowany rdzeń gry
**Projektujesz sieć, samoloty latają same. Porażka przychodzi z przepełnionego huba, nigdy z kolizji.**

- Globus w pionie, jedna ręka. Przeciągasz trasę od miasta do miasta; trasa „przykleja się” do łuku wielkiego koła i jest rysowana
  na „wysokości przelotowej”, więc długie trasy widać nawet tuż za horyzontem.
- Pasażer ma **region docelowy** (kształt: szewron, kokarda, półksiężyc, dziurka od klucza, statecznik, kątownik — żaden z kształtów
  Mini Metro). Wybiera drogę z najmniejszą liczbą przesiadek; dotknięcie pasażera pokazuje jego drogę.
- **Hub** ma poczekalnię o stałej liczbie miejsc i jeden **minimalny czas przesiadki**. Przepełnienie uruchamia widoczne odliczanie;
  porażka dopiero po nim, potem ekran „co poszło nie tak” (księga przyczyn jak w `commutopia/src/sim/freight`).
- **Doba = jeden obrót terminatora**, 7 dób = tydzień = wybór 1 z 3 ulepszeń (turbośmigłowiec, szerokokadłubowiec, rozbudowa huba,
  sloty startów). Terminator daje **fale popytu** o świcie; **cisza nocna** w wybranych miastach jako modyfikator od późniejszych tygodni.
- Typy samolotów różnią się zasięgiem, prędkością i pojemnością; trasa za długa dla turbośmigłowca wymaga **międzylądowania**.
- Tryby: **Zadania** (zagadki z celem, nieograniczone cofanie), **Lot bez końca** (sesja 10–15 min), **Wyzwanie dnia** (ten sam seed).
- Odradzane w rdzeniu: warstwy wysokości i korytarze (nieczytelne na telefonie, ciągną w stronę ATC).

Uzasadnienie: odpowiada na główne skargi na Mini Airways (mikrozarządzanie, brak celu, identyczne samoloty) i Fly Corp (płaska mapa),
a globus + terminator to jedyne mocne wyróżniki, których nie ma Tiny Airline. Alternatywy (turowe „zaplanuj dobę”, budowa rozkładu
jednego huba) — [`market.md` §4](research/market.md).

## 4. Wykonalność techniczna (skrót)
- **Render:** dla kierunków 2D (Poczta lotnicza, Atlas) — **Canvas 2D + d3-geo** (ISC), Natural Earth z `world-atlas` (PD/ISC),
  ~54 KB danych lądu, ~100 samolotów to < 1 ms. Dla kierunku **Diorama 3D** — **three.js** (MIT): globus low-poly ~150–500 tys.
  trójkątów, instancjonowane drzewa i chmury, jedno światło kierunkowe (słońce = terminator za darmo). Makiety pokazują, że to działa
  nawet na programowym WebGL (SwiftShader). Ryzyko: wypełnienie na słabych GPU Mali — budżet LOD i limit DPR 1,5–2.
- **Symulacja:** deterministyczna, 1 tik = 1 minuta gry, seedowany PRNG (mulberry32 jak w commutopii i cebulaku). Uwaga z raportu:
  silniki JS na iOS i Androidzie nie gwarantują identycznych wyników `Math.sin/exp`, więc **symulacja nie liczy trygonometrii** —
  czasy lotu zaokrąglane do tików przy tworzeniu trasy, pozycje samolotów liczy tylko render.
- **Gesty:** przeciągnięcie zaczęte ≤ 28 dp od miasta rysuje trasę, w innym miejscu obraca globus; przyciąganie do miast w promieniu
  36 dp; uchwyty końców tras 48 dp; przytrzymanie przy krawędzi globusa obraca go (zasięg kciuka); zoom jedną ręką
  (dwuklik-i-przeciągnij); symulacja zwalnia do 0,25× podczas edycji; cofanie z punktów kontrolnych.
- **Układ:** pion — pasek informacyjny u góry, dok kciukowy 64–72 dp nad wskaźnikiem gestów; poziom — szyna boczna 80 dp;
  składane ≥ 600 dp — stały panel boczny.
- **Dźwięk (koncepcja własna, nie Mini Metro):** „Rezonujące huby” — każdy hub to rezonator strojony szerokością geograficzną,
  przylot uderza w hub, przesiadka szarpie strunę, przeciążenie słychać jako dudnienie, zanim je widać; noc przyciemnia brzmienie,
  świt rozkwita akordem. Web Audio bez Tone.js.

## 5. MVP (5–6 tygodni, 1–2 osoby)
| Tydzień | Zakres | Bramka |
|---|---|---|
| 1 | globus (wybrany kierunek), obrót/zoom, miasta, rysowanie trasy łukiem, test czytelności 412×915 | 30 miast czytelnych i dotykalnych na telefonie |
| 2 | deterministyczna symulacja: popyt, pasażerowie, trasowanie z przesiadkami, samoloty jednego typu | test na stałym seedzie z linią `SUMMARY` |
| 3 | huby: pojemność, czas przesiadki, odliczanie, porażka + „co poszło nie tak”; tydzień i wybór ulepszenia | playtest: średnia sesja 8–15 min |
| 4 | dwa typy samolotów, zasięg i międzylądowanie, terminator (fale popytu), cofanie | — |
| 5 | HUD w świecie gry, dźwięk v1, i18n PL/EN, zapis/wczytanie, 10 zadań | build Android na urządzeniu |
| 6 | balans, wydajność na słabym Androidzie, build iOS, sklepowe zrzuty | 60 fps na średniaku / 30 fps na słabym |

**Poza MVP:** cisza nocna, rankingi i Firebase, wyzwanie dnia online, cargo, multiplayer, port na Steam.

## 6. Model biznesowy
Rekomendacja: **darmowe pobranie z jednym odblokowaniem 3,99 € (przetestować 4,99 €)**, bez reklam i timerów. Apple dopuszcza
darmowy okres próbny przed zakupem (wytyczna 3.1.1), Google Play ogłosił w 03.2026 „Game Trials” dla płatnych gier. Apple Small
Business Program: 15%. **Do sprawdzenia w Play Console** przed modelowaniem przychodu: strona pomocy Google podaje nowe opłaty od
30.06.2026 w EOG/UK/US (20% + 5% za rozliczenie dla nowych instalacji). Realistycznie: niski wolumen (Railbound i Mini Airways mają
po ~120 ocen na iOS). **Decyzja należy do właściciela.**

## 7. Tytuły — DECYZJA: gra nazywa się **Airway** (airway.games), D-12. Poniżej zapis wcześniejszych kandydatów (wstępne sprawdzenie kolizji: Steam, App Store, Google Play, itch.io, web; to nie jest porada prawna)
| Tytuł | Wynik | Uwagi |
|---|---|---|
| **Hubline** | czysto | krótki, działa w PL i EN, mówi o hubach (był tytułem roboczym) |
| **Daywing** | czysto | sprzedaje dzień i noc |
| **Terminair** | czysto | gra słów terminator + air; sprawdzić znaki towarowe (skojarzenie z „Terminator”) |
| **Duskport** | czysto / słabo | zmierzch + port lotniczy |
| **Dayturn** | słaba kolizja | obrót doby |
| **Hubspin** | słaba kolizja | — |
| **Sunwake** | słaba kolizja | — |
| **Hubwise** | słaba kolizja | — |
| **Dawnline** | słaba–mocna | — |
| **Aeroloop** | słaba–mocna | — |

Odrzucone jako mocne kolizje: Layover, Contrail (gra iOS 06.2026), Skyhub, Arcwise, Great Circle, Redeye, Nightside, Nightfly, Skyloom.
Szczegóły i linki: [`market.md` §7](research/market.md). Przed wydaniem: sprawdzić znak „Airway” w EUIPO/USPTO/UPRP i dobrać podtytuł do sklepów, który odróżni grę od wyników medycznych i od Mini Airways.

## 8. Ryzyka (skrót, pełna lista z mitygacjami w raportach)
1. Tiny Airline albo miniairways.co trafią na telefony pierwsze → wyróżnić się globusem, terminatorem, przesiadkami i wyglądem; nie
   gonić ich listy funkcji.
2. Odbiór jako klon Mini Metro → żadnych płaskich kolorowych linii, żadnego „Mini”, bogaty świat zamiast schematu (patrz uwaga
   właściciela 2.11 i D-05).
3. Nieczytelne łuki i miasta na telefonie → odstęp miast ≥ 6°, zoom do 2,5×, łuki na wysokości przelotowej, znaczniki miast za horyzontem.
4. Niezrozumiałe trasowanie pasażerów → dotknięcie pasażera pokazuje drogę, ekran „co poszło nie tak”.
5. Rozrost zakresu (Mini Metro: 2,5 roku) → twarde bramki tygodniowe MVP.
6. Wydajność na słabym Androidzie (szczególnie w kierunku 3D) → LOD, DPR ≤ 2, 30 fps w bezczynności.
7. Rozjazd powtórek między iOS a Androidem → brak trygonometrii w symulacji.
8. Niski wolumen premium i zmieniające się opłaty sklepów.

## 9. Co bierzemy z naszych gier (szczegóły: [`family-audit.md`](research/family-audit.md))
- **Przenosimy wzorce (nie kod 1:1):** `Rng` z zapisywalnym stanem, symulacja bez importów renderera, księga przyczyn strat z hubów
  (commutopia), klucz dnia w strefie Warszawy, tygodniowe ligi, kolejka wyników offline, walidacja powtórek po stronie serwera
  (cebulak), zrzuty 412×915 + Fold, testy z linią `SUMMARY`, konfiguracja Capacitor 8 + fastlane.
- **Nie powtarzamy:** kremowo-granatowych „naklejek” z twardym cieniem (to już sygnatura Commutopii UI5 i AirWar), krojów Fredoka/Nunito
  i Alfa Slab One/Barlow Condensed, plakatu cyrku lotniczego z AirWar, palety i świecących dróg z Frontiera, dużego przycisku „Buduj”.
