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
**Decyzja D-16: na razie gra w całości darmowa, bez reklam; reklamy i wersja płatna później.** Wcześniejsza rekomendacja: **darmowe pobranie z jednym odblokowaniem 3,99 € (przetestować 4,99 €)**, bez reklam i timerów. Apple dopuszcza
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

---

# Badania ciągłe (agent R)

Sekcje poniżej dopisuje agent badawczy w kolejnych przebiegach (R1, R2…). Każda ma datę, źródła z datą sprawdzenia
i rekomendację. Konkretne zadania trafiają do `docs/NIGHT-BACKLOG.md` (sekcja „Research proposals (R-agent)”),
pytania do `docs/OWNER-QUESTIONS.md`. To nie jest porada prawna; wszystko oznaczone **NIEPEWNE** trzeba potwierdzić
w Play Console / App Store Connect w dniu zgłoszenia.

## R1 — Gotowość do wydania: Google Play i App Store (stan 2026-11-03)

### Ustalenia
| Wymóg | Stan na 11.2026 | Airway dziś | Luka |
|---|---|---|---|
| **Docelowe API Androida** | Nowe aplikacje i aktualizacje: **API 36 (Android 16) od 31.08.2026** ([Android Developers](https://developer.android.com/google/play/requirements/target-sdk)) | `targetSdkVersion = 36`, `compileSdk 36` | brak; dopilnować co roku (sierpień 2027 → API 37) |
| **Strony pamięci 16 KB** | Aplikacje celujące w Android 15+ muszą obsługiwać 16 KB od 1.11.2025 ([Android Developers](https://developer.android.com/guide/practices/page-sizes)) | Capacitor + WebView, prawdopodobnie bez własnych bibliotek `.so` | **NIEPEWNE** — sprawdzić AAB w APK Analyzer / Play Console przed wysyłką (R1m) |
| **Pakiet SDK Apple** | Od **28.04.2026** wysyłki tylko z Xcode 26 / iOS 26 SDK ([Apple](https://developer.apple.com/news/upcoming-requirements/)) | `docs/IOS.md` wymaga Xcode 26.0+ | brak |
| **Weryfikacja deweloperów Androida** | Pierwsze egzekwowanie 30.09.2026 w wybranych krajach, globalnie w 2027 ([Android Authority](https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/), 06.2026) | dotyczy konta, nie kodu; dystrybucja przez Play i tak wymaga zweryfikowanego konta | konto Play właściciela (Q-42) |
| **Test zamknięty dla nowych kont osobistych** | Konto osobiste założone po 13.11.2023: **≥ 12 testerów przez 14 kolejnych dni** przed dostępem do produkcji; konta organizacji (D-U-N-S) zwolnione ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/14151465); szczegóły z poradników zewnętrznych, **NIEPEWNE** co do nowych kontroli zaangażowania) | brak testu | zaplanować 3 tygodnie w kalendarzu; to też nasz playtest (Q-42) |
| **Usuwanie konta — Google** | Gdy aplikacja tworzy konta: usuwanie w aplikacji **i** link WWW w formularzu Data safety; e-mail lub formularz WWW wystarcza jako zasób WWW ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/13327111)). Konta „tworzone i działające offline” są poza zakresem; o kontach anonimowych strona milczy | D-77: usunięcie wpisu rankingu tylko przez e-mail | **luka**: brak ścieżki w aplikacji |
| **Usuwanie konta — Apple 5.1.1(v)** | Usuwanie musi dać się **rozpocząć w aplikacji**; „automatycznie tworzone konta gościa też potrzebują opcji usunięcia”; e-mail/czat jako jedyna droga **niedozwolony** poza branżami regulowanymi ([Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app)) | anonimowe konto Firebase tworzone przy pierwszym wysłaniu wyniku; usuwanie tylko e-mailem | **luka blokująca** wydanie iOS z rankingami — R1a, Q-41 |
| **Polityka prywatności** | Wymagany URL w Play Console i App Store Connect; Google wymaga też linku **w aplikacji** przy danych użytkownika ([Google Play — User Data](https://support.google.com/googleplay/android-developer/answer/10144311)) | `site/privacy.html` istnieje, ale strona nieopublikowana (D-67); w `src/` nie ma słowa „privacy” | link w ustawieniach (R1b); polityka musi być online przed przedrejestracją |
| **Data safety / App Privacy** | Dane pseudonimowe, które da się powiązać z graczem (stały UID), trzeba zadeklarować; identyfikator Firebase to przykład „Device or other IDs” ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/10787469)) | `PrivacyInfo.xcprivacy`: `NSPrivacyCollectedDataTypes` puste | uzupełnić, jeśli rankingi są w wydaniu (R1f, Q-03) |
| **Kategoria wiekowa** | Google: kwestionariusz IARC w Play Console (bezpłatny). Apple: nowe progi 4+/9+/13+/16+/18+, odpowiedzi na nowe pytania wymagane od 31.01.2026 ([MacRumors](https://www.macrumors.com/2025/07/25/apple-overhauls-app-store-age-ratings/)) | gra bez przemocy, czatu, zakupów; ranking bez nicków (Q-05) | oczekiwane: PEGI 3 / USK 0 / Apple 4+; **zostać przy znakach wywoławczych** — nicki zmieniłyby odpowiedzi („user interaction”) |
| **Grupa docelowa (Families)** | Zaznaczenie dzieci < 13 w „Target audience” uruchamia politykę Families (SDK, reklamy, prywatność) ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/9285070)) | brak SDK reklam/analityki | rekomendacja: grupa **13+** (gra nie jest projektowana dla dzieci), mniej obowiązków przy rankingach |
| **DSA — status przedsiębiorcy (UE)** | Apple wymaga deklaracji trader/non-trader; przedsiębiorca pokazuje adres, telefon i e-mail na stronie w UE ([Apple](https://developer.apple.com/news/?id=a0nevv65)); Google ma analogiczną deklarację w Play Console (**NIEPEWNE** szczegóły) | — | decyzja właściciela razem z Q-01/Q-42 |
| **Szyfrowanie (eksport)** | Apple pyta przy każdym buildzie, chyba że `ITSAppUsesNonExemptEncryption = false` (sam HTTPS jest zwolniony) | brak klucza w `Info.plist` | R1c |
| **Etykiety dostępności Apple** | Dobrowolne, z czasem obowiązkowe; deklaracja tylko przy spełnieniu kryteriów (np. „Larger Text” = co najmniej 200% albo maksimum systemu) ([Apple](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels)) | skala tekstu 100/115/130% | patrz R1 — dostępność |
| **Chiny kontynentalne (Apple)** | Gry płatne / z IAP wymagają numeru zatwierdzenia (ISBN); od 2023 także rejestracja ICP dla aplikacji ([Pocket Gamer.biz](https://www.pocketgamer.biz/complete-timeline-of-app-store-isbn-developments)) | gra darmowa (D-16) | **NIEPEWNE** dla darmowej gry z serwerem; rekomendacja: wyłączyć Chiny kontynentalne z dystrybucji (Q-44) |
| **Kopia zapasowa zapisów** | — (jakość, nie wymóg) | `android:allowBackup="false"` — zmiana telefonu kasuje zapis, dziennik i serię dni | R1e |

### Nazwa „Airway” (wsparcie dla Q-34, nie porada prawna)
- W sklepach nie znaleziono gry o nazwie dokładnie „Airway” (wyszukiwanie 2026-11-03). Bliskie nazwy w tym samym
  gatunku: **AirwaySim** (przeglądarkowa symulacja linii lotniczej, © 2006–2026, [airwaysim.com](https://www.airwaysim.com/)),
  **Airways United** (iOS, [App Store](https://apps.apple.com/us/app/id1629074495)), *Mini Airways*. „Airway” to też
  termin medyczny i lotniczy (drogi lotnicze), więc w wyszukiwarce sklepu sama nazwa będzie słaba — podtytuł D-18
  („Globe Route Builder”) jest niezbędny.
- Ryzyko: AirwaySim jest w tym samym gatunku od lat; przy sprawdzaniu EUIPO/USPTO/UPRP (Q-34) patrzeć na klasy **9 i 41**
  i na znaki „AIRWAY*”. Nie przeprowadzono wyszukiwania w rejestrach (TMview wymaga interaktywnego interfejsu).

### Co to znaczy dla Airway
Technicznie build jest blisko wymagań (API 36, Xcode 26, brak SDK śledzących). Realne blokady wydania są
**organizacyjne i prawne**: konto Play (osobiste → 12 testerów × 14 dni), opublikowana polityka prywatności,
deklaracje prywatności i — najważniejsze — **usuwanie anonimowego konta rankingu z poziomu aplikacji** (Apple 5.1.1(v)
wprost obejmuje konta gościa i nie akceptuje samego e-maila). D-77 (usuwanie e-mailem) wystarcza dla Google, nie dla Apple.

### Rekomendacja
1. Przed testem zamkniętym: R1a (usuwanie w aplikacji), R1b (link do polityki), R1c (plist), R1f (deklaracje), R1m
   (kontrola 16 KB / API w teście). 2. Właściciel: konto Play i typ konta (Q-42), administrator danych (Q-01),
   usuwanie w aplikacji (Q-41), kraje (Q-44). 3. Test zamknięty 14 dni traktować jako playtest (patrz sekcja onboarding).
4. Zbiorczą listę kontrolną wydania prowadzić w jednym pliku (R1l).

## R1 — Dostępność i lokalizacja (stan 2026-11-03)

### Ustalenia — dostępność
- **Apple Accessibility Nutrition Labels** (od iOS 26 widoczne w sklepie): VoiceOver, Voice Control, Larger Text,
  Sufficient Contrast, Dark Interface, Differentiate Without Color Alone, Reduced Motion, napisy, audiodeskrypcja.
  Deklaruje się funkcję tylko, gdy **wszystkie typowe zadania** da się z nią wykonać; App Review może zażądać korekty
  etykiet ([Apple](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels)).
- **Larger Text:** co najmniej 200% albo maksimum systemu; gry mogą mieć własne ustawienie zamiast Dynamic Type, ale
  Apple zaleca odczytać ustawienie systemowe, żeby gracz nie ustawiał dwa razy
  ([Apple, kryteria Larger Text](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria)).
- **European Accessibility Act** (od 28.06.2025): gry wideo nie są wprost w zakresie; obejmuje m.in. e-handel w grach
  ([Taylor Wessing, 03.2025](https://www.taylorwessing.com/en/insights-and-events/insights/2025/03/accessibility-in-the-gaming-industry)).
  Airway bez sprzedaży (D-16) — dziś poza zakresem; **przy włączeniu zakupu** (Entitlements) ekran zakupu musi spełniać EAA.

| Etykieta Apple | Airway dziś | Czy deklarować |
|---|---|---|
| Differentiate Without Color Alone | kształty regionów, glify, szlaban ciszy nocnej jako kształt, paleta CVD (D-31, D-80) | **tak** (nasza mocna strona) |
| Sufficient Contrast | tokeny WCAG ≥ 4,5:1, noc ≥ 9:1 (D-47) | tak, po przeglądzie zrzutów |
| Reduced Motion | tylko część UI czyta `prefers-reduced-motion` (flap, raport końca gry); brak przełącznika w grze | po R1h |
| Larger Text | 100/115/130%, bez odczytu ustawienia systemowego | **nie** (do 200% daleko); R1g przybliża |
| VoiceOver / Voice Control | etykiety ekranowe są, ale rysowanie tras gestem na globusie nie ma alternatywy | nie |
| Dark Interface | świat ma noc, ale UI nie ma trybu ciemnego | nie |

### Ustalenia — lokalizacja
- Wiarygodnych, świeżych danych przychodu mobilnego według języka publicznie brak (dane Sensor Tower / AppMagic są
  płatne). Listy branżowe dla mobile: EN, FR/IT/DE/ES, CJK, RU, PT-BR, TR, NL ([MultiLingual](https://multilingual.com/?p=96142),
  [LocalizeDirect](https://localizedirect.com/posts/which-languages)) — **kierunkowe, część danych z lat 2018–2023**.
- Steam (PC, tylko kontekst): EN ~38%, zh-Hans ~24%, RU ~10% (08.2026, [GamingOnLinux](https://www.gamingonlinux.com/2026/10/steam-survey-for-september-2026-shows-a-drop-in-linux-with-simplified-chinese-rising/)).
  Dla nas chiński mobilny odpada (Play niedostępny w Chinach, Apple: ISBN/ICP).
- Koszty po naszej stronie: `src/i18n` ma ~400 kluczy i liczby mnogie przez `Intl.PluralRules` (N7j) — DE/FR/ES/PT/IT
  wchodzą bez zmian w silniku; pseudo-lokalizacja (N10p/N10q) już sprawdza dłuższe teksty. **JA/KO** wymagają kroju
  CJK na licencji OFL (Noto Sans JP/KR — kilka MB na język, wpływ na rozmiar paczki) i przeglądu łamania wierszy.
  Nazwy miast są w `src/data/cities.ts` tylko PL/EN.
- Strona w sklepie bez tłumaczenia gry: można dodać lokalne opisy sklepowe tanio, ale opis w języku, którego gra nie
  ma, wprowadza w błąd — w opisie trzeba napisać „gra po angielsku i polsku”.

### Rekomendacja
- Dostępność: deklarować w App Store **Differentiate Without Color Alone** i **Sufficient Contrast** od pierwszego
  wydania; R1h (przełącznik ograniczenia ruchu) i R1g (skala tekstu z systemu, krok 150%) przed wydaniem; R1i (karta
  dowodów do etykiet).
- Lokalizacja: **fala 1 po wydaniu: DE, FR, ES, PT-BR** (alfabet łaciński, zero zmian technicznych, łącznie ~40%
  rynków premium w Europie i obu Amerykach — szacunek kierunkowy); **fala 2: JA** (najsilniejszy rynek gier płatnych
  na iOS, ale wymaga kroju CJK); IT, TR, KO później. Tłumaczenia agentem + korekta native speakera; nazwy miast w nowych
  językach. Decyzja: Q-43.

## R1 — Onboarding i utrzymanie graczy (stan 2026-11-03)

### Ustalenia
- Benchmarki retencji (kierunkowe, dane z sieci reklamowych, przeważnie F2P): D1 gier mobilnych ~22–27%, puzzle ~32% D1
  i ~5% D7, strategia ~25% D1 ([Segwise](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies),
  [Business of Apps](https://businessofapps.com/?p=96421), 2025–2026; część danych z 2023).
  D1 < 25% zwykle oznacza zepsutą pierwszą sesję. Publicznych danych o odpadaniu w samouczku brak.
- Model „spróbuj, potem kup” jest już standardem sklepów: **Google Play Game Trials** (ogł. 11.03.2026 na GDC) — pełna
  gra z limitem czasu ustalanym przez dewelopera, postęp przechodzi po zakupie, opt-in dewelopera
  ([Google](https://blog.google/products-and-platforms/platforms/google-play/google-play-paid-games-updates/));
  Apple pozwala na darmowy okres próbny przed zakupem (wytyczna 3.1.1, RESEARCH §6). Dla D-16 (gra darmowa) to
  informacja na przyszłość: jeśli wersja płatna wróci, **Game Trials** na Play pozwala sprzedawać grę płatną bez
  przebudowy na model „darmowe + odblokowanie”.
- Bez analityki (D-16) jedyne dane z produkcji to Android vitals / Xcode Organizer (awarie, ANR) — bez SDK.
  Wnioski o retencji muszą przyjść z **testu zamkniętego** (12+ osób × 14 dni, i tak wymaganego).

### Co Airway już ma (stan `dev`)
Pierwsze uruchomienie → lot szkoleniowy (task 23; PR M2 #88 go zmienia), 30 zagadek z „następna po ukończeniu” (N10w),
wyzwanie dnia z serią dni i udostępnianiem (N10d, N10e), ranking dzienny/tygodniowy, dziennik lotów (N10n), raport
końca gry z przyczyną, osią czasu i mapą (N10r, N11c), kontynuacja zapisu. To pokrywa typowe pętle powrotu
(codzienny seed, seria, rekord) bez powiadomień i bez dark patterns.

### Luki (projekt własny, bez kopiowania innych gier)
1. **Po porażce gracz wie *dlaczego*, ale nie *co zmienić*.** Raport podaje przyczynę; brakuje jednej rzeczowej
   wskazówki powiązanej z przyczyną (przepełniony hub → rozbudowa huba / drugi hub; region bez trasy → połączenie;
   czekanie na slot → „+2 sloty”). Największy zwrot przy najmniejszym koszcie (R1j).
2. **Pierwsza sesja Endless nie ma celu pośredniego.** Skarga nr 1 z recenzji gatunku to „graj, aż przegrasz”
   (RESEARCH §2). Proste, widoczne „kamienie milowe” biegu (pierwszy hub, wszystkie kontynenty, tydzień 3) w dzienniku
   i na raporcie dają cel bez zmiany symulacji (R1n).
3. **Brak przypomnienia o wyzwaniu dnia** — świadomie (bez uprawnień, D-16). Lokalne powiadomienie opt-in wymagałoby
   uprawnienia `POST_NOTIFICATIONS` i zmiany deklaracji; rekomendacja: nie na start (Q-45).
4. **Test zamknięty bez protokołu** — trzeba z góry ustalić, co mierzymy ręcznie: długość pierwszej sesji, czy
   ukończono lot szkoleniowy, numer tygodnia porażki, powrót następnego dnia (R1o: arkusz i lokalny eksport dziennika).

### Rekomendacja
R1j i R1n jako małe PR-y przed testem zamkniętym; R1o razem z ustawieniem testu; powiadomienia — nie (Q-45).
Mierzyć cel 10–18 min (D-79) na ludziach w teście zamkniętym, nie tylko botem.
