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

## R2 — Strona w sklepie i ASO (stan 2026-11-03)

### Ustalenia
| Temat | Wymóg / praktyka (źródło) | Airway dziś (`docs/store/**`) | Luka |
|---|---|---|---|
| **Zrzuty gry — Google Play** | Do publikacji min. 2 zrzuty, maks. 8 na typ urządzenia, bok 320–3840 px, dłuższy bok ≤ 2× krótszy. Do **rekomendacji gier**: co najmniej **3 zrzuty 9:16 (min. 1080×1920) albo 16:9 (min. 1920×1080)** z rozgrywki; duże ekrany (tablety, Chromebooki): 1080–7680 px, **16:9 lub 9:16**, min. 4 ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/9866151), odczyt 2026-11-03) | telefon 1080×1920 (9:16) — **spełnia**; „foldable” 1346×1682 (4:5) i „tablet” 1536×2048 (3:4) | tablet/foldable **nie mają proporcji 9:16 ani 16:9** → nie kwalifikują się do promocji na dużych ekranach (czy konsola je odrzuci — **NIEPEWNE**); brak zrzutów poziomych 16:9 |
| **Zrzuty — App Store** | Wymagany iPhone „Dynamic Island, medium” **1206×2622 / 1179×2556** albo duży **1320×2868** (sklep skaluje w dół z największego); iPad 13" **2064×2752**; do 10 zrzutów, bez kanału alfa ([Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)) | brak rozmiarów Apple (README to zaznacza) | do zrobienia profil 440×956 @3 i 1032×1376 @2 (R2a) |
| **Podpisy pod zrzutami** | Ani Google Play, ani App Store **nie mają pola podpisu** pod zrzutem. Play ma **tekst alternatywny** dla każdego zrzutu (Google zaleca unikalny; limit 140 zn. podają poradniki — **NIEPEWNE**) ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/9866151); [przegląd zewn.](https://theapplaunchpad.com/blog/google-play-store-screenshot-guidelines)). Tekst na obrazie dozwolony, na Play ≤ 20% kadru, bez „Pobierz teraz”, „#1”, „Najlepsza”, „Nowość” | `en.md`/`pl.md`: „podpisy tylko do konsoli, nigdy na obrazach” | podpisy nie mają gdzie trafić: na Play → alt text; na App Store tylko tekst na obrazie albo nic (Q-46) |
| **Feature graphic (Play)** | **Wymagana do publikacji**: 1024×500, JPEG/PNG 24-bit; główny motyw w środku; **unikać czystej bieli, czerni i ciemnej szarości**; alt text ≤ 140 zn.; gdy jest wideo, grafika staje się jego okładką z przyciskiem odtwarzania pośrodku ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/9866151)) | **brak** | blokuje publikację na Play (R2d); nocny globus na ciemnym tle łamie zalecenie „bez ciemnej szarości” — lepiej scena zmierzchu |
| **Wideo — Google Play** | Link YouTube (publiczny lub niepubliczny, bez reklam, osadzalny); „gra **wymaga wideo**, by pojawić się w niektórych miejscach Google Play”; rozgrywka w pierwszych 10 s, ≥ 80% materiału reprezentatywne, **autoodtwarzane jest tylko pierwsze 30 s**, napisy zalecane, pion bez czarnych pasów ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/9866151)) | **brak** | potrzebny kanał YouTube właściciela (Q-48) i plik wideo (R2b) |
| **Wideo — App Store (App Preview)** | 15–30 s, do 3 na rozmiar i język, H.264 ≤ 30 kl./s; iPhone (duży): **886×1920** pion; iPad 13": **1200×1600**; klatka-plakat domyślnie z 5. sekundy ([Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications/)). Na stronie produktu odtwarzane bez dźwięku (poradniki ASO, np. [AppFollow 2026](https://www.appfollow.io/blog/app-store-video-strategy)) | brak | nagranie z autoplay-bota (deterministyczne) — ffmpeg jest w środowisku |
| **Czy wideo podnosi konwersję** | Dane sprzeczne: poradniki podają +12–25% (StoreMaven 2025, cytowane z drugiej ręki) albo brak wyraźnego efektu ([AppScreenshotStudio](https://appscreenshotstudio.com/blog/app-preview-videos-vs-screenshots-2026-conversion-data)) — **NIEPEWNE**. Zgodne: pierwsze 3 s decydują, wideo działa bez dźwięku. Apple PPO pozwala testować do 3 wariantów; Play „Store listing experiments” testuje grafiki i opisy (nie tytuł) | — | testować, nie zakładać (Q-47) |
| **Słowa kluczowe App Store** | 100 znaków, przecinki bez spacji; Apple łączy słowa z nazwy, podtytułu i pola słów kluczowych, więc **powtórki marnują miejsce**; liczba pojedyncza/mnoga — poradniki się różnią ([AppTweak](https://www.apptweak.com/en/aso-blog/how-to-optimize-your-ios-keyword-field), [Appalize](https://www.appalize.com/blog/keyword-research/ios-keyword-field-rules-character-limits-optimization)); nazwy konkurencji zabronione (wytyczna 2.3.7) | EN 81 zn.: `globe`, `routes`, `hub` powtarzają tytuł/podtytuł; PL: `globus`, `trasy`, `hub` — to samo | R2c: wymiana powtórek na nowe słowa |
| **Google Play — tekst** | Brak pola słów kluczowych; indeksowane są tytuł (30), krótki opis (80) i długi opis; krótkiego opisu nie da się przetestować z tytułem, ale da się w eksperymencie ([AppFollow](https://appfollow.io/blog/google-play-aso-keywords)) | krótki opis zawiera „globe/routes/hubs” — dobrze | słowa „airline”, „airport”, „strategy” tylko w długim opisie; brak „puzzle” w krótkim |

### Wzorce stron udanych gier premium strategia/łamigłówka (opis wzorców, bez kopiowania)
- **Kadr 1 = najczytelniejsza chwila rozgrywki**, nie widoczek: cała pętla w jednym obrazie (sieć, ruch, napięcie).
  Kadr 2 pokazuje *wybór* (karta ulepszenia, decyzja), kadr 3 — *stawkę* (porażka, presja). Tryby i menu na końcu.
- Krótki tekst na obrazie (2–5 słów) nad kadrem albo pod nim, w kroju gry — nie w generycznym — i bez obietnic.
  Dla nas: tekst jako element świata (tabliczka lotniskowa), co jest zgodne z D-05 i z regułą „grafika tłumaczy grę”.
- Kadr nocny jako pierwszy (D-63) jest ładny, ale na małej miniaturze w wynikach wyszukiwania pokazuje głównie
  światła miast, a mniej mechaniki. To hipoteza do sprawdzenia eksperymentem, nie powód do zmiany decyzji (Q-47).

### Rekomendacja
1. Przed publikacją Play: **feature graphic** (R2d) — jest wymagana. 2. Przed iOS: zrzuty w rozmiarach Apple (R2a).
3. Wideo 20–30 s z prawdziwej rozgrywki (R2b) do obu sklepów; ten sam materiał jako zwiastun na stronę i dla prasy.
4. Słowa kluczowe bez powtórek (R2c). 5. Po wydaniu: eksperyment Play „kolejność / tabliczka z tekstem” (Q-46, Q-47).

## R2 — Marketing wydania niezależnej gry mobilnej (stan 2026-11-03)

### Ustalenia
- **Przedrejestracja Google Play:** maks. **90 dni** na kraj (licząc od pierwszego otwarcia), potem trzeba wydać;
  wymaga wypełnionych deklaracji treści; Google zaleca wcześniej wydanie testowe. W dniu premiery zapisani dostają
  powiadomienie i **automatyczną instalację** (Android 6+, aplikacja ≤ 200 MB przez sieć komórkową; konta dzieci < 13
  wyłączone). Statystyki: liczba zapisanych i konwersje w 14 dni ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/9859047)).
  Czy nowe konto osobiste może otworzyć przedrejestrację **przed** zaliczeniem testu 12 × 14 (R1) — **NIEPEWNE**.
- **Nagroda za przedrejestrację wymaga produktu jednorazowego (IAP)** w Play Billing, raz utworzonej nie da się
  zmienić ani usunąć, a niewydanie nagrody grozi zawieszeniem ([Google Play Help](https://support.google.com/googleplay/android-developer/answer/9859047)).
  Przy D-16 (zero IAP) **nagrody nie robimy**; zamiast tego wszystko jest dla wszystkich.
- **Pre-order App Store** działa także dla gier darmowych: data premiery 2–180 dni od publikacji zamówienia
  ([Apple](https://developer.apple.com/app-store/pre-orders/)). Strona produktu zbiera wtedy ruch z prasy przed premierą.
- **Nominacje do wyróżnienia (App Store Connect → Featuring Nominations):** minimum 2 tygodnie przed datą,
  Apple zaleca **do 3 miesięcy** wcześniej dla szerszego rozważenia ([Apple](https://developer.apple.com/app-store/getting-featured/)).
  Dotyczy premiery, dużych aktualizacji i wydarzeń w aplikacji.
- **In-App Events (Apple):** wydarzenia ograniczone w czasie (typy „Challenge”, „Competition”, „Major update”) widoczne
  w wyszukiwaniu, na stronie produktu i w zakładce Today; nazwa 30 zn., krótki opis 50 zn.; odrzucane m.in. za ceny i
  słowo „free” w treści ([AppTweak](https://www.apptweak.com/en/aso-blog/strategies-best-practices-for-ios-15-in-app-events), [Phiture](https://phiture.com/mobilegrowthstack/in-app-events-how-to-get-approved/)) —
  szczegóły z poradników, **NIEPEWNE**. Dla nas naturalne: „Tydzień otwarcia” (wyzwanie dnia + ranking tygodniowy),
  potem wydarzenie przy każdej aktualizacji z nowymi zagadkami.
- **Prasa mobilna się skurczyła:** TouchArcade zamknął serwis 09.2024 (archiwum i podcast zostają)
  ([TouchArcade](https://toucharcade.com/2024/09/24/toucharcade-is-shutting-down/)). Aktualnej listy redakcji przyjmujących
  zgłoszenia gier mobilnych nie znaleziono — wybór (Pocket Gamer, Pocket Tactics, polskie serwisy) **NIEPEWNE**, do
  ręcznego sprawdzenia. Stąd większa waga twórców wideo i wyróżnień w sklepach.
- **Press kit:** szablon presskit() jest nieutrzymywany od ok. 2022; praktyka 2026 to jedna publiczna strona bez logowania:
  karta faktów, zwiastun do pobrania, 8–15 zrzutów, key art, logo, jedno archiwum ZIP ([StraySpark](https://www.strayspark.studio/blog/indie-game-press-kit-2026-presskit-replacement),
  [presskit.gg](https://presskit.gg/blog/indie-game-press-kit-guide) — blogi narzędzi, opinia). Mamy statyczną stronę
  (`site/`, D-67 nieopublikowana) — strona prasowa to mały dodatek.
- **Pokazy dla gier mobilnych:** *The Big Indie Pitch — Mobile Edition* na **PG Connects London 18.01.2027**
  (rejestracja na konferencję wymagana; nagroda: bilety i stoisko) ([Big Indie Pitch](https://www.bigindiepitch.com/event/the-big-indie-pitch-mobile-edition-at-pocket-gamer-connects-london-2027/));
  **Digital Dragons** w Krakowie (2026: 17–19.05; zgłoszenia do Indie Showcase w 2024 zamykano 1.03 — termin 2027
  **NIEPEWNE**) ([KPT](https://media.kpt.krakow.pl/431298-another-year-with-digital-dragons-krakow-awaits-game-creators));
  *Google Play Indie Games Festival* — nie znaleziono edycji 2026 (ostatnie potwierdzone 2022) — **NIEPEWNE**.
- **Apple Arcade / Netflix Games:** nie mają publicznego formularza; Arcade w 2026 dodaje głównie znane gry z PC
  (np. Dredge+, Unpacking+, 04.2026, [9to5Mac](https://9to5mac.com/2026/03/11/apple-arcades-april-lineup-adding-two-of-the-most-acclaimed-recent-indie-games/)).
  Realne tylko po sukcesie wydania; nie planować.
- **Konkurencja w czasie:** *Tiny Airline* (PC, Steam „coming soon” wg R1) — daty premiery nie znaleziono (**NIEPEWNE**).
  Komunikat Airway ma opierać się na tym, czego oni nie mają: globus i terminator dnia/nocy, przesiadki, telefon w pionie.

### Co to znaczy dla Airway
Gra darmowa bez reklam to w marketingu atut („bez reklam, bez zakupów, bez konta”), ale **słowa „free/darmowa” nie
wolno** dawać w tekstach wydarzeń Apple ani w grafikach Play (zakaz cen i promocji). Najtańsze dźwignie: feature graphic
+ wideo (R2b, R2d), nominacja Apple 6–12 tygodni przed datą, przedrejestracja/pre-order zsynchronizowane z testem
zamkniętym, strona prasowa (R2e) i 20–30 spersonalizowanych wiadomości do twórców wideo (lotnictwo, strategia mobilna).

### Rekomendacja — oś czasu (T = premiera)
T−12 tyg.: test zamknięty (R1) + strona prasowa i zwiastun; T−10 tyg.: nominacja Apple; T−8 tyg.: pre-order iOS i
przedrejestracja Play (≤ 90 dni); T−4 tyg.: wysyłka kluczy/buildów do twórców z datą embarga; T: wydarzenie „Tydzień
otwarcia”; T+6 tyg.: aktualizacja z nowymi zagadkami + drugie wydarzenie i nominacja. Pokazy: zgłosić Big Indie Pitch
(18.01.2027), jeśli build jest grywalny, i Digital Dragons 2027. Plan w jednym pliku (R2f), decyzje: Q-48, Q-49.

## R2 — Głębia rozgrywki po 3. godzinie (stan 2026-11-03)

### Ustalenia
- W gatunku późna gra męczy, gdy **odpowiedź na presję jest zawsze ta sama** (kolejny samolot, kolejne ulepszenie):
  recenzje wskazują powtarzalność końcówki ([GameGrin, Railgrade](https://gamegrin.com/reviews/railgrade-review)) i nudę
  trybu bez presji („dobry jako wygaszacz ekranu”, zbiorczo [RAWG](https://rawg.io/games/2666)); jako lek gracze chwalą
  **różnorodność map i wyzwań do odblokowania** oraz stopniowany poziom trudności (zbiorcze streszczenia recenzji,
  [Vaporlens](https://vaporlens.app/app/1127500/mini_motorways.md) — źródło automatyczne, kierunkowe). Spójne z RESEARCH §2.
- Airway ma już dźwignie, których inni nie mają, ale używa ich jednolicie: **sloty** (D-41: 2/h miasto, 3/h hub),
  **cisza nocna** (D-17: od tygodnia 4, +1 miasto co 2 tygodnie do 8), **przesiadki** z MCT 25/15 min, **terminator**
  (fala popytu o świcie lokalnym), **zasięg** (turboprop 2 500 km, szerokokadłubowiec 11 000 km) i 4 karty
  ulepszeń (`src/sim/upgrades.ts`). `Scenario` (`src/sim/world.ts`) ma już pokrętła: miasta startowe, fale popytu,
  rezerwa samolotów, miasta z ciszą nocną, pojemności per miasto — czyli część wariantów da się zrobić **bez nowych reguł**.
- Endless ma jeden scenariusz (`ENDLESS_SCENARIO`), Daily różni się tylko seedem. Po kilku biegach start i krzywa są
  takie same — to luka w „scenario variety”.

### Propozycje (własne, bez kopiowania; od najtańszych)
1. **Region startowy** — wybór kontynentu dla Endless (domyślnie losowy jak dziś). Te same reguły, inna geografia:
   Pacyfik wymusza szerokokadłubowce, Europa — sloty i ciszę nocną. Ranking tylko dla Daily (bez zmian). (R2g)
2. **Klasy licencji** — po dotarciu do tygodnia 5 odblokowuje się klasa II (cisza nocna od tygodnia 2, mniej rezerwy),
   potem III (pojemność huba −6, sloty miast 1/h w nocy lokalnej). Tylko pokrętła scenariusza; cel dla graczy po 3 h
   i powód, by wrócić do Endless. (R2h)
3. **Zapowiedziane fale** — od tygodnia 3 jedno miasto zapowiada dzień wcześniej szczyt popytu (targi, święto) —
   rysowane w świecie jako proporczyk/tablica przy lotnisku z godziną. Nagradza planowanie, nie refleks; deterministyczne
   z osobnego strumienia RNG. (R2i)
4. **Front pogodowy** — wolno sunący pas chmur (rysowany jako ciemniejsza warstwa chmur Dioramy) obniża o 1 sloty
   odlotów lotnisk pod sobą. Widać go z wyprzedzeniem, więc gracz przenosi ruch na inny hub. Najlepiej realizuje zasadę
   „grafika tłumaczy grę”; największy koszt (sim + render). (R2j)
5. **Kontrakt tygodnia** — na tablicy tygodnia obok trzech skrzyń opcjonalny cel (np. „40 pasażerów Europa→Azja do
   końca tygodnia”); wykonanie daje dodatkową skrzynię w następnym tygodniu. Cel pośredni w biegu (uzupełnia R1n). (R2k)

Każda zmiana reguł wymaga wersji parametrów, zapisu (D-76) i przebiegu `test:balance`/`test:bot-policy`; R2g i R2h nie
zmieniają symulacji domyślnego Endless ani Daily.

### Rekomendacja
Najpierw **R2g + R2h** (tanie, tylko scenariusze i menu, dają cel po 3 h), potem **R2i** (pierwsza nowa reguła,
mała), **R2j** jako „duża” funkcja pierwszej aktualizacji po wydaniu (dobry temat wydarzenia Apple i wideo),
R2k po teście zamkniętym, jeśli testerzy kończą biegi bez celu. Wybór kierunku: Q-50.

## R3 — Rankingi Firebase: koszt i nadużycia przy skali premiery (stan 2026-11-03)

Liczby do **Q-07** (budżet) i nowego **Q-53** (App Check). Ceny: strona cennika Cloud Run (tier 1, obejmuje
`europe-west1`) i Firestore, pobrane 2026-11-03; ceny Firestore w tabeli to wartości domyślne z cennika — stawki dla
`europe-west1` mogą się nieznacznie różnić (**NIEPEWNE**, sprawdzić w konsoli).

### Ustalenia — cennik
| Pozycja | Darmowo | Ponad limit | Źródło |
|---|---|---|---|
| Firestore odczyt / zapis / usunięcie | 50 000 / 20 000 / 20 000 **dziennie** (reset ok. północy czasu pacyficznego) | 0,03 / 0,09 / 0,01 USD za 100 000 | [Firestore pricing](https://cloud.google.com/firestore/pricing), [Firebase](https://firebase.google.com/docs/firestore/pricing) |
| Usunięcia przez TTL (D-77) | **brak darmowej puli** (wymaga Blaze) | 0,01 USD za 100 000 | jw. |
| Zapytanie `count()` | — | 1 odczyt za każde rozpoczęte 1000 wpisów indeksu; minimum 1 odczyt na zapytanie, także puste | jw. |
| Funkcje 2. gen. (Cloud Run, rozliczanie za żądania) | 2 mln wywołań, 180 000 vCPU-s, 360 000 GiB-s **miesięcznie** na konto rozliczeniowe | 0,40 USD / mln; 0,000024 USD / vCPU-s; 0,0000025 USD / GiB-s; czas zaokrąglany w górę do 100 ms | [Cloud Run pricing](https://cloud.google.com/run/pricing) |
| Funkcje 2. gen. — domyślne | 1 vCPU do 2 GB pamięci, współbieżność 80 na instancję; przy `maxInstances` żądania ponad limit czekają 30 s, potem 429 | — | [Manage functions](https://firebase.google.com/docs/functions/manage-functions) |
| Anonimowe konta Auth | do 100 mln kont; 100 nowych kont / h / adres IP; logowanie anonimowe bez opłat do 50 000 MAU (powyżej tylko po przejściu na Identity Platform) | 0,0055–0,0025 USD / MAU (Identity Platform) | [Auth limits](https://firebase.google.com/docs/auth/limits); MAU: źródła wtórne, **NIEPEWNE** |
| App Check (Play Integrity) | 10 000 żądań tokenu i 10 000 deszyfrowań dziennie; zwiększenie formularzem (do tygodnia), aplikacja musi być w Google Play | — | [Play Integrity setup](https://developer.android.com/google/play/integrity/setup) |

### Ustalenia — co dziś kosztuje jedna gra dnia (kod `functions/src/index.ts`, `src/net/index.ts`)
- `submitDaily`: 1 wywołanie, transakcja 1 odczyt + 2 zapisy (wpis dzienny + suma tygodnia), później 1 usunięcie TTL
  (wpis tygodniowy dzieli się na dni tygodnia).
- `getBoards` (wołane raz, po wysłaniu wyniku): dwa zapytania top 50 = **do 100 odczytów**, a gdy gracza nie ma w top 50:
  +2 odczyty dokumentu i +2 zapytania `count()` (przy 10 000 wpisów ok. 5 odczytów każde). Razem **ok. 105 odczytów na
  gracza dziennie** — to dominuje koszt.
- Powtórka na serwerze (zmierzone w tej sesji, `Sim.replay` przez `verifyDailySubmission`, Node 22, Xeon 2,8 GHz, gra
  bota z `scripts/bot.ts` na sześciu seedach dnia): 0,6 tyg. → 25–60 ms; 1–1,3 tyg. → 40–60 ms; 2,1 tyg. → 104–128 ms;
  2,6–2,8 tyg. → 144–205 ms; dziennik 3–17 poleceń, 339–1531 B. Czyli ok. **60–70 ms CPU na tydzień gry** (rośnie
  z wielkością sieci). Rdzeń Cloud Run może być wolniejszy — przyjmuję ×2. Bieg 30 tygodni (limit `MAX_REPLAY_TICKS`)
  nie został zmierzony z prawdziwą siecią (bot nie dożywa) — **NIEPEWNE**, szacunek 2–5 s.
- **Znalezisko:** zgłoszenie z pustym dziennikiem i `endTick` = 30 tygodni przechodzi (`ok`, wynik 0, `weeks: 30`,
  229 ms), bo `Sim.replay` dalej tyka po końcu gry, a `weeks` liczy się z `endTick`. Wynik 0 nie oszukuje rankingu, ale
  pole `weeks` da się zawyżyć, a każda taka próba kosztuje pełne 30 tygodni tyknięć (R3c).

### Model kosztu (gracze dnia = DAU, którzy zagrają oficjalną grę dnia)
| Gracze dnia | Odczyty / dzień (dziś) | Koszt dziś / mies. | Z jednym dokumentem „top 50” (R3a) |
|---|---|---|---|
| 300 | 32 000 | 0 (w darmowej puli) | 0 |
| 1 000 | 105 000 | ok. 0,5 USD | 0 |
| 5 000 | 525 000 | ok. 4,5 USD | 0 |
| 10 000 | 1,05 mln | ok. 9,5 USD (+ ok. 0,3 USD zapisy) | ok. 0,5 USD |
| 50 000 | 5,25 mln | ok. 47 USD | ok. 3–25 USD (zależnie od kosztu `count()` miejsca gracza) |

Funkcje: 2 wywołania na gracza (10 000 graczy = 600 000 / mies., w darmowej puli); CPU 10 000 × ok. 0,4 s =
120 000 vCPU-s / mies. — też w puli. Przy 50 000 graczy funkcje to ok. 10 USD / mies. (CPU ponad pulę). **Wniosek: bez nadużyć
budżet 10 EUR (Q-07) wystarcza do ok. 10 000 graczy dziennie, a z R3a do ok. 25–30 000.**

### Model nadużyć (najgorszy przypadek przy dzisiejszej konfiguracji)
- **Zalewanie `getBoards`** to główne ryzyko: wystarczy jeden anonimowy token (Auth nie wymaga niczego więcej), każde
  wywołanie czyta ok. 100 dokumentów. 200 wywołań/s z jednego skryptu = 17 mln wywołań / dobę ≈ **540 USD / dobę**
  odczytów (+ 7 USD wywołań). Pułap `maxInstances: 10` × współbieżność 80 tego nie zatrzymuje (krótkie wywołania).
  Budżet tylko powiadamia — niczego nie wyłącza (`docs/FIREBASE.md` krok 4).
- **Zalewanie `submitDaily`**: odrzucenia strukturalne są tanie; prawidłowe zgłoszenia „30 tygodni” palą CPU. Pułap
  10 instancji × 1 vCPU ogranicza koszt do ok. 36 000 vCPU-s / h ≈ **0,9 USD / h ≈ 22 USD / dobę** — wysoko, ale
  ograniczone. Współbieżność 80 na 1 vCPU przy pracy CPU dławi też uczciwych graczy (kolejka).
- Po R3a (jeden dokument na tablicę) i R3b (limit na uid + mniejsze pułapy) ten sam atak 200/s to ok. **5–10 USD
  odczytów + 7 USD wywołań na dobę** — alert 50 % budżetu zadzwoni pierwszego dnia, a szkoda jest mała.
- App Check zamyka ataki spoza aplikacji, ale nasz klient nie używa SDK Firebase (REST, D-66): potrzebna wtyczka
  natywna (np. [Capawesome Firebase App Check](https://capawesome.io/docs/plugins/firebase/app-check/) — Play Integrity
  na Androidzie, App Attest na iOS; nieoficjalna) albo własny most do Play Integrity / App Attest i wymiana tokenu przez
  REST. Wymuszenie po stronie funkcji to `enforceAppCheck: true` w `onCall`; ochrona przed powtórzeniem
  (`consumeAppCheckToken`, beta) dodaje rundę sieciową ([App Check for functions](https://firebase.google.com/docs/app-check/cloud-functions)).
  Emulatory i symulatory nie przejdą atestacji (token debug). To nowa zależność i decyzja właściciela → **Q-53**.

### Rekomendacja
1. **Q-07:** budżet **10 EUR / mies.** z alertami 50/90/100 % oraz alertem prognozy; region `europe-west1` bez zmian.
2. Przed testem zamkniętym z prawdziwym Firebase: **R3a** (dokument „top 50” na tablicę, odczyt 1–3 zamiast ~105)
   i **R3b** (limit na uid, `getBoards` `maxInstances: 3`, `submitDaily` współbieżność 4). To kilka godzin pracy
   i zmienia skalę ryzyka o dwa rzędy.
3. **R3c** (powtórka kończy się na końcu gry; test kosztu najdłuższej gry) i **R3d** (hamulec: parametr
   `LEADERBOARDS_PAUSED` + instrukcja na wypadek alertu).
4. App Check (**R3e**) po teście zamkniętym, jeśli właściciel zgodzi się na wtyczkę (Q-53); do tego czasu R3a+R3b
   wystarczą przy budżecie 10 EUR.
5. Osobny ekran rankingu (Q-06) dopiero po R3a — inaczej każde otwarcie to kolejne ~105 odczytów.

## R3 — Test zamknięty i playtest bez analityki (stan 2026-11-03)

Uzupełnia R1o (protokół i „Kopiuj podsumowanie” z dziennika) — tu: rekrutacja, liczności, formularz, reguły decyzji
i odpowiedzi do wniosku o produkcję. Dotyczy **Q-42** i nowego **Q-52**.

### Ustalenia
- **Reguła Google Play** (konta osobiste założone po 13.11.2023): test zamknięty z **≥ 12 testerami zapisanymi bez
  przerwy przez ≥ 14 dni**; kto się wypisze i zapisze ponownie, liczy od nowa. Dopiero potem wniosek o produkcję,
  w którym Google pyta: jak łatwo było zrekrutować testerów, jak bardzo byli zaangażowani (czy użyli wszystkich
  funkcji), czy użycie przypominało docelowe, **podsumowanie opinii i sposób zbierania**, grupa docelowa, co wyróżnia
  grę, szacunek instalacji w 1. roku, **co zmieniono po teście** i skąd wiadomo, że gra jest gotowa
  ([Play Console Help 14151465](https://support.google.com/googleplay/android-developer/answer/14151465), 2026-11-03).
- Od 2025 r. wnioski odrzucane są częściej za „niewystarczające zaangażowanie” mimo 12×14 (relacje deweloperów,
  [DEV Community, 2026](https://dev.to/tizoc_araujo_3cd9fb67191f/google-play-closed-testing-rejected-for-insufficient-engagement-what-that-actually-means-in-2026-ion)
  — **NIEPEWNE**, źródło nieoficjalne). Rada powtarzana przez wiele źródeł: wydać w trakcie testu co najmniej jedną
  poprawkę i opisać ją we wniosku. Serwisy „12 testerów za opłatą / wymiana testów” istnieją; ich testerzy zwykle tylko
  instalują — ryzyko odrzucenia, a opinie nie mają wartości.
- **Mechanika Play:** testerzy z listy e-mail (do 2000 adresów na listę) albo Grupy Google; dołączają linkiem opt-in
  (widoczny dopiero, gdy wydanie ma status „Opublikowane”); w konsoli podaje się **adres URL lub e-mail do opinii**.
  Gra jest darmowa (D-16), więc problem płatnych testów nie dotyczy
  ([Play Console Help 9845334](https://support.google.com/googleplay/android-developer/answer/9845334)).
- **Raport przed wydaniem** (pre-launch report) uruchamia się sam po wysłaniu pakietu: crawler przez kilka minut na
  telefonach i tabletach z Androidem 9+, zrzuty, awarie, dostępność; dla gier OpenGL przydatny jest dopiero z pętlą gry
  ([9842757](https://support.google.com/googleplay/android-developer/answer/9842757)). Darmowy sygnał „czy w ogóle
  startuje na Mali/Adreno” — wykorzystać w R3i.
- **iOS (opcjonalnie równolegle):** TestFlight — do 10 000 testerów zewnętrznych, publiczny link z filtrami urządzeń,
  pierwsza wersja przechodzi Beta App Review; testerzy wysyłają zrzut z adnotacją i komentarz do awarii prosto z
  aplikacji ([TestFlight](https://developer.apple.com/testflight/)).
- **Liczności:** 5 osób znajduje ok. 85 % problemów użyteczności, lepiej 3 rundy po 5 niż 1 runda po 15; przy dwóch
  grupach (np. PL i EN) 3–4 osoby na grupę ([NN/g, Nielsen 2000](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/)).
  12 testerów wystarcza do problemów samouczka i czytelności, ale **nie** do strojenia balansu liczbami — do balansu
  służy bot (`test:balance`), testerzy mówią „za trudno / nudno w tygodniu N”.
- **Nagroda dla testerów:** gra darmowa, więc kodów promocyjnych nie potrzeba (Play: do 500 kodów / kwartał; Apple od
  26.03.2026 nie tworzy już kodów promocyjnych dla zakupów w aplikacji, kody pobrania płatnych aplikacji zostają —
  [9to5Mac](https://9to5mac.com/?p=1025773), **NIEPEWNE**). Propozycja: podziękowanie w napisach (opt-in, znak
  wywoławczy lub imię) — bez wpływu na prywatność rankingu.

### Plan (do `docs/PLAYTEST.md`, razem z R1o)
**Rekrutacja (T−7 dni):** 16–18 osób (zapas na odpadających), co najmniej 6 PL i 6 EN; mieszanka: 4–5 osób znających
gry sieciowe/strategiczne, reszta „zwykli gracze”; co najmniej 3 osoby z budżetowym Androidem (Mali-G52/G57, 4 GB) i 2
z tabletem/składakiem. Źródła: znajomi i rodzina, polskie społeczności gamedev i grupy graczy mobilnych, formularz
zapisu na `airway.games` (D-67) — bez płatnych serwisów i wymian. Jedna Grupa Google „airway-testers”.

**Przebieg (14 dni):**
| Dzień | Co robią testerzy | Co zbieramy |
|---|---|---|
| 1 | instalacja, samouczek, pierwszy bieg Endless; 3–5 osób nagrywa ekran (systemowe nagrywanie) z komentarzem na głos przez pierwsze 10 min | nagrania (gdzie się zacinają), ankieta A (5 pytań) |
| 2–6 | gra dnia codziennie, Endless dowolnie, zagadki 1–10 | nic, poza zgłoszeniami błędów |
| 7 | ankieta B + „Kopiuj podsumowanie” z dziennika (R1o / R3j) | dane biegów, odpowiedzi |
| 8 | **wydanie poprawki** z najczęstszymi problemami z dni 1–7 (do wniosku o produkcję) | — |
| 9–13 | jak 2–6, zagadki 11–30 | — |
| 14 | ankieta C + podsumowanie z dziennika | dane biegów, odpowiedzi |

**Ankiety (PL/EN, Formularz Google, bez danych osobowych poza adresem z listy testu):**
- A (dzień 1): Czy wiesz, czemu przegrałeś pierwszy bieg? (tak / chyba / nie + 1 zdanie); Co było niejasne w
  samouczku?; Czy odróżniasz typy samolotów/lotnisk bez czytania? ; Telefon i czy gra się przycinała (nigdy /
  czasem / często); Czy zagrasz jutro? (1–5).
- B (dzień 7): Ile razy dziennie otwierasz grę; Co sprawia, że kończysz sesję; Najlepszy i najgorszy moment tygodnia;
  Która karta ulepszeń wydaje się zawsze najlepsza (sprawdza Q-35); Bateria / grzanie się telefonu.
- C (dzień 14): Czy poleciłbyś grę (0–10); Czego brakuje po kilku godzinach (cel, odmiana — sprawdza Q-50); Czy
  zapłaciłbyś / ile (tylko sygnał do przyszłych decyzji, D-16 zostaje); Dźwięk (Q-29) i jasność nocy (Q-14).

**Reguły decyzji (spisane przed testem, by wyniki nie były naginane):**
| Sygnał | Próg | Decyzja |
|---|---|---|
| „Nie wiem, czemu przegrałem” po 1. biegu | ≥ 4 z 12 | najpierw R1j (wskazówka na raporcie końca), przed wydaniem |
| Samouczek nieukończony (dziennik) | ≥ 3 z 12 | skrócić/przebudować krok, w którym odpadają (nagrania) |
| Mediana pierwszego biegu (dziennik) | < 6 min albo > 20 min | Q-51/D-79: przestroić 1. tydzień |
| Ta sama karta brana zawsze (dziennik R3j) | ≥ 70 % wyborów 1. tygodnia | Q-35 → wariant B |
| „Czego brakuje” = cel / odmiana | ≥ 5 z 12 | Q-50 → R2g+R2h przed wydaniem |
| Przycinanie „często” lub grzanie | ≥ 2 osoby na tym samym GPU | R3f/R3i dla tej rodziny GPU, Q-31/Q-32 |
| Gra dnia grana ≥ 5 z 7 dni | < 4 z 12 osób | wrócić do Q-45 (przypomnienie) |

**Z wyników do wniosku o produkcję:** jedna strona w `docs/PLAYTEST.md` — liczba testerów i dni, sposób zbierania
(ankiety + podsumowania z dziennika + nagrania), 5 najczęstszych uwag, lista zmian w poprawce z dnia 8 (z PR), dowód
gotowości (`test:ci` zielony, raport przed wydaniem bez awarii, brak zgłoszeń blokujących w dniach 9–14).

### Rekomendacja
Test zamknięty traktować jako prawdziwy playtest, nie formalność: 16–18 osób, poprawka w dniu 8, reguły decyzji spisane
z góry. Przed startem potrzebne: R1o + R3j (dane z dziennika), R3k (arkusz odpowiedzi), konto Play (Q-42), wybór
rekrutacji (Q-52). TestFlight równolegle tylko, jeśli konto Apple jest gotowe — iOS nie ma wymogu 12×14.

## R3 — Pokrycie urządzeń i budżety wydajności (stan 2026-11-03)

### Ustalenia
- **Wersje Androida** (dane Google do 12.2025, [Android Headlines, 30.01.2026](https://www.androidheadlines.com/2026/01/android-version-distribution-numbers-2025-2026-market-share.html)):
  16 — 7,5 %, 15 — 19,3 %, 14 — 17,2 %, 13 — 13,9 %, 12 — 11,4 %, 11 — 13,7 %, 10 — 7,8 %, **9 — 4,5 %, 8.x — 3,1 %,
  7.x — 0,8 %**. StatCounter (ruch WWW) w 06.2026 pokazuje już Android 16 na 1. miejscu (23,7 %).
- **WebView na starych Androidach:** Chrome 138 to ostatnia wersja dla Androida 8/9, od Chrome 139 (08.2025) wymagany
  Android 10 ([PhoneArena](https://www.phonearena.com/news/if-your-android-phone-is-still-running-on-this-version-you-can-forget-about-chrome-updates_id171730));
  WebView dzieli ten cykl (**NIEPEWNE** dla samego WebView). Airway ma `minSdkVersion = 24` (Android 7) — ok. **8,4 %**
  urządzeń z Play dostaje zamrożony silnik, którego nigdy nie testujemy. Three r170 wymaga WebGL 2 (OpenGL ES 3.0);
  manifest nie deklaruje `glEsVersion`, więc Play pokaże grę także telefonom bez ES 3.0.
- **Chipy:** udział w dostawach (Counterpoint, Q4 2025, [Malaysian Wireless 03.2026](https://www.malaysianwireless.com/2026/03/apple-overtakes-qualcomm-q4-2025-soc-market/)):
  MediaTek 30 %, Apple 23 %, Qualcomm 22 %, UNISOC 15 %, Samsung 6 %. MediaTek i UNISOC to prawie zawsze GPU **Mali**
  (UNISOC także PowerVR/Mali starszych generacji) — czyli tani Android = Mali.
- **Najczęściej kupowane tanie Androidy 2025** (Counterpoint: Galaxy A16 5G najlepiej sprzedającym się Androidem 2025;
  Indie: Vivo Y29, Oppo A3x, Redmi 14C, Redmi A3x w top 5 —
  [Counterpoint Q1 2025](https://www.counterpointresearch.com/en/insights/top-10-bestselling-smartphones-q1-2025),
  [9to5Google](https://9to5google.com/2025/06/03/best-selling-phones-early-2025-by-country/)). Ich GPU wg kart
  producentów (sprawdzić przed zakupem, **NIEPEWNE** co do wariantów regionalnych): Galaxy A06 / Redmi 14C / Moto G05 —
  Helio G85/G81, **Mali-G52 MC2**; Galaxy A16 4G / Galaxy Tab A9 — Helio G99, **Mali-G57 MC2**; Vivo Y29 / część A16 5G —
  Dimensity 6300, Mali-G57 MC2; Moto G (Snapdragon 680/4 Gen 2) — **Adreno 610/613** (popularne w BR/US). Typowo 4 GB RAM.
  PL/EU: Samsung A + Xiaomi Redmi; BR: Samsung + Motorola; IN: Vivo/Oppo/Xiaomi/Samsung; US: iPhone + Samsung + Moto.
- **Auto-dobór jakości trafia obok:** `chooseQualityPreset` daje `low` tylko przy ≤ 4 rdzeniach albo ≤ 3 GB. Wszystkie
  telefony z listy wyżej mają **8 rdzeni** i zgłaszają 4 GB (`navigator.deviceMemory` jest zaokrąglane i ograniczone do
  8 — dokładne zaokrąglanie **NIEPEWNE**), więc Mali-G52 MC2 startuje na **medium** (DPR 1,5, antyaliasing, 140–240 tys.
  trójkątów) i dopiero adaptacja (D-73/D-74) schodzi w dół po kilku sekundach przycięć — pierwsze wrażenie testera to
  przycięcia. WebGL w Chromium/WebView zwraca nazwę GPU przez `WEBGL_debug_renderer_info` (np. „Mali-G52 MC2”) — można
  dobierać preset po rodzinie GPU (**NIEPEWNE**: niektóre WebView mogą maskować nazwę).
- **Utrata kontekstu WebGL:** w `src/` nie ma obsługi `webglcontextlost` / `webglcontextrestored` ani ekranu „brak
  WebGL 2”. Na Androidach z małą pamięcią kontekst ginie po powrocie z tła — Three częściowo odtwarza stan, ale nikt
  tego nie testował; przy braku WebGL 2 gracz widzi pusty ekran.
- **Tanie testy na prawdziwych GPU:** Firebase Test Lab — plan Spark 5 testów/dzień na fizycznych urządzeniach, Blaze
  30 min/dzień gratis, potem 5 USD/h ([quotas](https://firebase.google.com/docs/test-lab/usage-quotas-pricing)). Test
  typu **Game Loop** uruchamia aplikację z intencją `com.google.intent.action.TEST_LOOP`, gra sama robi scenariusz
  i zapisuje własny plik wyników (FPS liczy aplikacja; domyślny limit 3 min)
  ([Game Loop](https://firebase.google.com/docs/test-lab/android/game-loop)). Nasza scena `perf:scene` może działać jako
  taka pętla — liczby z prawdziwych Mali/Adreno bez kupowania telefonów. Lista modeli w Test Lab — **NIEPEWNE**
  (sprawdzić `gcloud firebase test android models list`).
- **iOS:** cel wdrożenia 15.0; najsłabsze realne urządzenia to iPhone SE 2/3 i iPhone 11 (A13, 3–4 GB) oraz iPad 9. gen.
  (A13). WebKit zwraca „Apple GPU”, więc tu preset tylko z rozmiaru ekranu i pamięci (często niedostępnej).

### Co to znaczy dla budżetów z `docs/PERFORMANCE.md`
Budżet low (≤ 33 ms p95, ≤ 35 tys. trójkątów terenu, ≤ 50 draw calli) jest pisany dokładnie pod Mali-G52 MC2 — ale ten
telefon dziś na start dostaje medium. Najpierw trafić w preset (R3f), potem mierzyć na prawdziwym GPU (R3i), dopiero
wtedy przestrajać próg 24 kl./s (Q-32) i tryb oszczędny (Q-31).

### Lista urządzeń testowych (zakup lub pożyczka; ok. 1 600–2 000 zł razem, ceny orientacyjne **NIEPEWNE**)
| Rola | Propozycja | Dlaczego |
|---|---|---|
| Najsłabszy cel | Galaxy A06 albo Redmi 14C/15C (Mali-G52 MC2, 4 GB) | najczęstsza klasa tanich telefonów PL/BR/IN; budżet low |
| Tani średni | Galaxy A16 (Helio G99 lub Exynos 1330) | najlepiej sprzedający się Android 2025; budżet medium |
| Adreno | Moto G z Snapdragon 4 Gen 2 / 680 | inna rodzina sterowników, popularna w BR/US |
| Tablet / duży ekran | Galaxy Tab A9 lub A9+ | tani tablet, Mali-G57; układ poziomy i 3:4 |
| Zamrożony WebView | dowolny telefon z Androidem 9 (z szuflady) | 4,5 % rynku; decyzja Q-54 |
| iOS | iPhone SE 2/3 lub iPhone 11 | najsłabszy obsługiwany A13/A15 |
Reszta (składak, flagowce, 120 Hz) — Test Lab i telefony testerów.

### Rekomendacja
R3f (preset po GPU) i R3h (deklaracja ES 3.0) przed testem zamkniętym; R3g (utrata kontekstu, ekran braku WebGL 2)
przed wydaniem; R3i (Test Lab Game Loop) jako tani pomiar zanim właściciel kupi telefony. `minSdk`: podnieść do 29
(Android 10) albo zostawić 24 z filtrem ES 3.0 — decyzja **Q-54**.

## R4 — Fakty lotnicze w danych świata: kody, godziny ciszy nocnej, samoloty (stan 2026-11-03)

Przegląd `src/data/cities.ts` (152 miasta), `src/sim/params.ts` i `src/sim/daynight.ts` pod kątem faktów, które
gracz z branży (albo z danego miasta) zauważy od razu. Bez licencji: kody IATA i współrzędne to fakty, nie utwór;
źródła poniżej to strony publiczne, sprawdzone 2026-11-03.

### Ustalenia — kody lotnisk (wyświetlane na stemplu huba, chipach przy krawędzi, w tablicy porażki, D-68)
| Miasto | W grze | Co ten kod naprawdę znaczy | Poprawny kod | Źródło |
|---|---|---|---|---|
| Kijów | **KIV** | dawny kod Kiszyniowa (od rosyjskiego „Kiszyniow”); od 18.01.2024 Kiszyniów ma **RMO**, KIV nie powinien wisieć na tablicach | **IEV** (kod miasta; lotniska KBP Boryspol, IEV Żulany) | [Wikipedia: Chișinău Airport](https://en.wikipedia.org/wiki/Chisinau_Airport), [chartershop.com.ua](https://chartershop.com.ua/en/novosti/1350-moldavian-airport-chisinau-changes-its-iata-code-from-kiv-to-rmo.html) |
| Ho Chi Minh | **HCM** | lotnisko Eil w Somalii (jedno źródło, **NIEPEWNE**); na pewno nie Wietnam | **SGN** (Tan Son Nhat) | [Wikipedia: Tan Son Nhat](https://en.wikipedia.org/wiki/Tan_Son_Nhat) |
| Luanda | **LUA** | Lukla w Nepalu (lotnisko pod Everestem) | **LAD** (Quatro de Fevereiro; nowe lotnisko NBJ — **NIEPEWNE**, czy przejęło ruch) | [aruljohn.com LUA](https://aruljohn.com/airport-codes/?q=LUA) |
| Lusaka | **LUS** | nie Lusaka (kod innego, małego lotniska — **NIEPEWNE** które) | **LUN** (Kenneth Kaunda) | [ch-aviation LUN](https://ch-aviation.com/airports/LUN) |
| Isfahan | **ISF** | nie Isfahan | **IFN** (Shahid Beheshti) | [Wikipedia: Isfahan Airport](https://en.wikipedia.org/wiki/Isfahan_Airport) |
| Aleksandria | **ALX** | Alexander City, Alabama (**NIEPEWNE**, z pamięci; na pewno nie Egipt) | **ALY** (kod miasta) albo **HBE** (Borg El Arab) | [ch-aviation HBE](https://ch-aviation.com/airports/HBE), [Wikipedia: Borg El Arab](https://en.wikipedia.org/wiki/Borg_El_Arab_Airport) |

Pozostałe 146 kodów są prawdziwe, ale styl jest mieszany: część to kody miast (NYC, CHI, LON, PAR, STO, ROM, MIL, TYO,
OSA, SEL, JKT, RIO, BUH, REK), część kody głównego lotniska (LAX, DCA zamiast WAS, EZE zamiast BUE, GRU zamiast SAO,
PEK zamiast BJS, YYZ zamiast YTO, YUL zamiast YMQ). To jest w porządku — gracz zna raczej GRU i PEK niż SAO i BJS —
więc proponuję regułę „kod, który podróżny zna z biletu: kod miasta tam, gdzie jest powszechny, inaczej główne lotnisko”
i poprawienie tylko 6 błędnych kodów z tabeli. Drobne, bez zmiany: DKR (Dakar ma od 2017 lotnisko DSS, DKR zostaje kodem
miasta — **NIEPEWNE**), ULN (Ułan Bator ma od 2021 lotnisko UBN), ANK (kod miasta; lotnisko ESB), THR (lotnisko IKA).

**Ważne technicznie:** `City.code` jest jednocześnie identyfikatorem miasta w symulacji: klucz w zapisach
(`scripts/fixtures/save-golden.json` ma KIV 57 razy), w dzienniku, w kolejności losowania ciszy nocnej (lista
identyfikatorów jest sortowana przed tasowaniem w `selectEndlessCurfewCities`, więc zmiana „KIV” na „IEV” przestawia
kolejność i zmienia wynik wyzwania dnia i powtórek). Dlatego poprawka musi być **tylko wyświetlana**: osobne pole
`displayCode` (albo mapa nadpisań) czytane przez `airportLabel()` i chipy w `src/ui/overlay.ts`, a identyfikator
zostaje. Wtedy zapisy, rankingi i `test:replay` się nie zmieniają (R4a).

### Ustalenia — współrzędne, nazwy, regiony
- Współrzędne wszystkich 152 miast zgadzają się z rzeczywistymi do 0,1° (sprawdzone ręcznie dla miast spoza listy
  największych: Gdańsk, Kigali, Bamako, Wagadugu, Maskat, Rangun, Nouméa, Suva, Port Moresby, Reykjavík) — bez uwag.
- Polskie egzonimy zgodne z praktyką KSNG (Lahaur, Ćennaj, Rangun, Abudża, Wagadugu, Antananarywa, Numea, Pusan,
  Kanton). Bez uwag.
- **Egipt jest w dwóch regionach**: Kair w `ME` (Bliski Wschód), Aleksandria w `AFR`. Gracz zobaczy dwa różne glify
  dla miast 180 km od siebie. To zmiana treści (region zmienia popyt → nowe zasady symulacji, D-76) — pytanie Q-58.
- Kijów, Tel Awiw, Bejrut, Bagdad, Teheran i Isfahan leżą dziś w przestrzeni zamkniętej albo ograniczonej dla lotów
  cywilnych (Ukraina zamknięta od 24.02.2022, bez daty otwarcia w marcu 2026:
  [Kyiv Independent](https://kyivindependent.com/ukraine-presents-roadmap-for-opening-airspace-during-martial-law),
  [United24](https://united24media.com/latest-news/ukraine-forms-working-group-to-prepare-for-reopening-of-airports-16932)).
  Gra jest ponadczasową siecią, nie symulatorem wiadomości, więc rekomenduję zostawić miasta — ale to decyzja
  właściciela (Q-57). Kod KIV przy Kijowie jest niezależnie od tego błędem, który Ukraińcy odbiorą źle (rosyjska nazwa
  Kiszyniowa).

### Ustalenia — cisza nocna i czas lokalny
- Gra zamyka wybrane lotniska 23:00–06:00 czasu lokalnego (D-17, D-27). Prawdziwe przykłady: Frankfurt 23:00–05:00
  (wyrok BVerwG z 04.2012), Sydney 23:00–06:00 (Sydney Airport Curfew Act 1995, z małym limitem przylotów 05:00–06:00),
  Zurych 23:30–06:00 (23:00–23:30 tylko na odrabianie opóźnień)
  ([Wikipedia: Night flying restrictions](https://en.wikipedia.org/wiki/Night_flying_restrictions),
  [slotcoordination.ch](https://www.slotcoordination.ch/restrictions_zrh)). Nasze 23–06 to realistyczny środek — bez zmian.
- Strefy czasowe gry są fikcyjne (długość geograficzna / 15°, całe godziny). Przykłady różnic od prawdziwych w listopadzie:
  Madryt i Paryż 0 zamiast +1, Lagos 0 zamiast +1, Buenos Aires −4 zamiast −3, Delhi +5 zamiast +5:30, Chengdu +7 zamiast +8.
  To **dobra** decyzja i proponuję ją zostawić: czas słoneczny zgadza się z linią dnia i nocy na globusie (D-05 —
  „grafika tłumaczy rozgrywkę”), a prawdziwe strefy pokazałyby północ w Madrycie przy słońcu nad horyzontem. Warto to
  jednym zdaniem napisać w samouczku/ustawieniach pomocy („czas słoneczny, nie urzędowy”), bo gracze z Hiszpanii to
  zauważą (R4b).

### Ustalenia — samoloty (`AIRCRAFT` w `params.ts`)
- Turbośmigłowiec 48 miejsc, 2 500 km, 480 km/h; prawdziwa klasa: ATR 42 ma ok. 48 miejsc i ok. 1 300 km zasięgu, Dash 8-400
  ok. 78 miejsc i ok. 2 000 km, prędkość przelotowa ok. 500 km/h. Zasięg gry jest hojny, ale to świadoma abstrakcja balansu.
- Szerokokadłubowiec 300 miejsc, 11 000 km, 840 km/h; klasa 787-9/A350-900: ok. 290–325 miejsc, 14 000–15 000 km,
  ok. 900 km/h. Wiarygodne. **Bez zmian** — liczby nie są przedstawiane jako konkretne typy, więc nie ma błędu faktu
  (dane typów z pamięci, **NIEPEWNE** co do pojedynczych wartości).

### Rekomendacja
R4a (kody wyświetlane, bez zmiany identyfikatorów) przed testem zamkniętym — to sześć widocznych błędów, w tym jeden
drażliwy (KIV). R4b (strażnik danych + zdanie o czasie słonecznym) razem z R4a albo zaraz po. Region Aleksandrii i
miasta w strefach konfliktu — Q-58 i Q-57.

## R4 — Dlaczego ten hub się zapycha? Diagnoza w trakcie gry, wpisana w świat (stan 2026-11-03)

### Co Airway już pokazuje (stan `dev`)
- Przy lotnisku: przywieszka z glifami regionów docelowych czekających (kształt + kolor), puste glify dla pasażerów
  w czasie przesiadki (N10i), przywieszka „SLOT” z liczbą samolotów i czasem do startu (zadanie 38, D-50), szlaban ciszy
  nocnej (N10h), odliczanie zatoru, wskaźnik zapełnienia na chipie przy krawędzi (N11d), dźwiękowy dron napięcia od ok. 72 %
  (D-71).
- Po porażce: raport z trzema przyczynami z `CauseLedger` (`noRoute`, `full`, `longWait`, rozkład czekających według
  regionu), oś czasu runu, mapa i jedna wskazówka w pierwszych dziesięciu lotach (N11f, D-87).

Luka: **w trakcie gry** gracz widzi, *że* hub się zapełnia i *dokąd* chcą ludzie, ale nie widzi *dlaczego* — czy
pasażerów przybywa szybciej, niż odlatują (za mało miejsc), czy samoloty stoją (sloty, cisza nocna), czy dla części
nie ma lotu dalej. Ta wiedza pojawia się dopiero w raporcie, czyli po fakcie. W poradach projektowych o „uczciwej
porażce” powtarza się ta sama myśl: porażka jest akceptowana, gdy gracz *przed* nią widział zapowiedź i umie wskazać
swoją ostatnią decyzję, a test jest prosty — zapytać po porażce „co się stało?”; błędna odpowiedź to błąd czytelności,
nie gracza ([Game Developer: Designing for difficulty readability](https://www.gamedeveloper.com/game-platforms/designing-for-difficulty-readability-in-arpgs);
[bugnet.io: Designing failure](https://bugnet.io/blog/designing-failure-how-to-make-losing-fun); oba to teksty
praktyków, nie badania — **NIEPEWNE** jako dowód).

### Model: kolejka, nie magia
Poczekalnia huba to kolejka. Zator jest nieunikniony, gdy przez dłuższy czas *napływ* (pasażerowie na godzinę: popyt
lokalny + przesiadki) jest większy niż *odpływ* (miejsca w odlatujących samolotach na godzinę, ograniczone też slotami
i ciszą nocną). Prawo Little'a (L = λ·W) daje prostą intuicję: przy stałym napływie czas czekania rośnie z liczbą
czekających ([Wikipedia: Little's law](https://en.wikipedia.org/wiki/Little%27s_law)). Gracz nie potrzebuje wzoru —
potrzebuje dwóch rzeczy narysowanych w świecie: **kierunku** (przybywa czy ubywa) i **wąskiego gardła** (co blokuje).

### Propozycje (projekt własny; graficzne, bez wykresów i liczb w HUD)
1. **Trend na przywieszce** (R4c): mała strzałka-chevron obok licznika, w górę = w ostatniej godzinie gry przybyło więcej,
   niż odleciało, w dół = hub się opróżnia, brak = równowaga. Kształt, nie kolor; tylko gdy hub ma ≥ 50 % zapełnienia,
   żeby nie zaśmiecać spokojnej sieci. Liczone w warstwie gry z godzinowych odczytów (już istnieją dla dźwięku,
   `AudioCueMapper.hourly`), bez zmian w symulacji.
2. **Tablica przyczyn huba** (R4d): przytrzymanie (albo stuknięcie, gdy hub jest ≥ 70 %) otwiera małą tablicę odlotów
   w stylu raportu porażki — po jednym wierszu na region docelowy: glif, liczba czekających i jeden znak przyczyny:
   „brak lotu dalej” (żadna trasa z tego huba nie prowadzi do regionu), „odloty pełne” (w ostatniej godzinie odloty
   w tę stronę wyleciały bez wolnych miejsc), „czeka na slot”, „cisza nocna do 06:00”. To ten sam słownik co raport
   porażki (spójność, gracz uczy się go wcześniej) i bez nowych reguł. Gra działa dalej (albo z pauzą — jak tablica
   tygodniowa; do ustalenia w zadaniu).
3. **Pełne odloty na trasie** (R4e): odcinek, którego samoloty trzy razy z rzędu startują pełne, dostaje na kilka
   sekund krótkie poprzeczne kreski przy hubie (jak „pełny luk”), znikają po odciążeniu. To wskazuje, *gdzie* dołożyć
   samolot, zanim pojawi się odliczanie.
4. Wszystko trzy razy: kształt (dla CVD), tekst dla czytnika ekranu (aria), bez skoków i sprężyn w animacji; nic
   nie trafia do symulacji ani do hasha powtórki (D-13).

### Rekomendacja
Najpierw R4c (najtańsze, od razu poprawia przewidywalność), potem R4d; R4e po teście zamkniętym, jeśli ankieta
pokaże, że gracze nie wiedzą, gdzie dołożyć samolot (pytanie „co się stało?” warto dopisać do ankiety R3k).

## R4 — Duże ekrany: tablet, składak, okna na iPadzie i Androidzie (stan 2026-11-03)

### Ustalenia
| Wymóg | Źródło (sprawdzone 2026-11-03) | Airway dziś | Luka |
|---|---|---|---|
| Android 16 ignoruje blokadę orientacji i `resizeableActivity` na ekranach ≥ 600 dp; od API 37 bez wyjątku. **Gry są wyłączone na podstawie `android:appCategory`** | [Android Developers Blog, 01.2025](https://android-developers.googleblog.com/2025/01/orientation-and-resizability-changes-in-android-16.html) | `appCategory="game"`, `resizeableActivity="true"`, pełne `configChanges` (zadanie 24) | brak; i tak obsługujemy oba układy |
| Adaptive app quality, Tier 3 „Adaptive ready”: pełny ekran bez letterboxa, stan zachowany przy obrocie, złożeniu/rozłożeniu i zmianie rozmiaru okna (także kombinacje), działanie w podzielonym ekranie, podstawowa mysz/klawiatura | [Android: Adaptive app quality](https://developer.android.com/docs/quality-guidelines/adaptive-app-quality), [Tier 3](https://developer.android.com/docs/quality-guidelines/adaptive-app-quality/tier-3) (wersja po 2026-04-07) | `ui:matrix` sprawdza 412×915, 915×412, 673×841, 904×1000 | brak rozmiarów testowych Google: 1024×640 (8″), 1280×800 (10,5″), 841×701 (składak), 1600×900 (Chromebook); brak testu zmiany rozmiaru w trakcie runu |
| Google: aplikacje spełniające wytyczne są wyżej w wyszukiwaniu na tabletach; odznaka po Tier 2/1 przez formularz | jw. | brak zgłoszenia | Tier 2 po testach R4f/R4g, potem formularz odznaki |
| iPadOS 26: `UIRequiresFullScreen` ignorowany, każda aplikacja dostaje okna o zmiennym rozmiarze; `sizeRestrictions` to tylko życzenie | [Apple TN3192](https://developer.apple.com/documentation/technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key), [forum Apple](https://developer.apple.com/forums/thread/793406) | `Info.plist` ma wszystkie 4 orientacje na iPadzie, bez `UIRequiresFullScreen` — dobrze | nie testujemy wąskich i niskich okien (np. ok. 500×700 pt w Stage Manager/podziale) |
| Mysz/klawiatura (Tier 3 podstawa, Tier 2 więcej) | Tier 3 jw. | kółko myszy przybliża (`gestures.ts`), Escape/Back działa (`platform/back.ts`) | brak skrótów (spacja = pauza, 1/2/3 = prędkość), brak stanów `:hover` dla myszy/rysika, nie sprawdzaliśmy menu kontekstowego prawego przycisku w WebView |
| Multi-resume: aplikacja niebędąca na pierwszym planie dalej się odświeża | Tier 3 jw. | gra pauzuje tylko przy ukryciu (`visibilitychange`); w podzielonym ekranie gra biegnie, gdy gracz pisze w drugiej aplikacji | zator „za plecami” gracza — Q-59 |

### Co to znaczy dla Airway
Fundament jest dobry (kategoria gry, pełne `configChanges`, orientacje iPada, układy portret/poziom/składak).
Brakuje dowodu na tabletach 10″ i w oknach o dowolnym rozmiarze oraz drobnej obsługi myszy/klawiatury, której
oczekują Chromebooki, tablety z klawiaturą i iPad z Magic Keyboard. Zrzuty do sklepu na duże ekrany są już w R2a.

### Rekomendacja
R4f (macierz rozmiarów + zmiana rozmiaru w trakcie runu) przed testem zamkniętym, R4g (skróty, hover) przed
wydaniem; zgłoszenie po odznakę Google dopiero po przejściu listy Tier 2 na prawdziwym tablecie.

## R5 — Audyt jakości: gra oczami nowego gracza i recenzenta sklepu (stan 2026-11-03)

### Jak sprawdzone
Trzy krótkie przejścia prawdziwej gry (`npm run ui:long-play`, Chromium + SwiftShader, bot DEV podejmuje decyzje,
przeciągania i stuknięcia idą przez prawdziwe UI): PL 412×915 4× 5 min, EN 390×844 4× 5 min, EN 915×412 (poziomo)
4× 6 min, każde z obrotem, pauzą, zapisem → wczytaniem → „Kontynuuj” i tablicą tygodnia 1. Wynik: 0 problemów
zgłoszonych przez skrypt w grze (jeden „unexpected menu” w przejściu poziomym to przeładowanie strony przez mój
`npm run build` uruchomiony w trakcie — nie błąd gry). Do tego obejrzane świeże zrzuty `docs/shots/matrix/`
(ui:matrix z 2026-11-03) i samouczka `docs/shots/23/`. SwiftShader był bardzo wolny (4 rdzenie), więc tempa w
sekundach nie oceniam z tych przejść, tylko z reguł (niżej). Dowody: `docs/research/r5/`.

### Co działa dobrze (dla recenzenta)
- Żadnego elementu z listy zakazanej: brak gradientów fioletowo-niebieskich, szkła, neonu, emoji, kart SaaS; trzy
  kroje OFL (Overpass, Overpass Mono, Atkinson Hyperlegible Next); świat jest bogaty (Diorama), a informacje
  narysowane w świecie (przywieszki z glifami, ring huba, chip przy krawędzi, stemple).
- Typy rozróżnione kształtem: glify regionów, ikony samolotów, puste glify przesiadki.
- Pauza „KRĄŻENIE / HOLDING PATTERN” z podsumowaniem sieci, tablica odlotów w menu i raport porażki z przyczynami i
  wskazówką są spójne i czytelne w obu językach; zapis → wczytanie zachowuje hash stanu.
- Cele dotykowe ≥ 48 dp i bezpieczne obszary HUD są pilnowane testami (`test:hud-targets`, `screens-fit`).

### Niejasne momenty dla nowego gracza (od najważniejszego)
1. **Lotniska na globusie nie mają nazw ani kodów.** Kod widać tylko na chipie przy krawędzi (lotnisko poza ekranem).
   Tymczasem pauza („Najpełniejszy hub JED 3/36”), stemple na skrzyniach („BEG 9/36”, „BEG 13 min”) i raport
   porażki mówią kodami, których gracz nigdy nie zobaczył przy żadnym krążku. Samouczek z kolei podpisuje miasta
   („Londyn”, „Paryż · HUB”), więc gra uczy podpisów, których potem nie ma. → **Q-61**, R5a.
2. **Samouczek mówi innym językiem obrazów niż gra.** Winieta samouczka to płaski, jasny globus z pomarańczowymi
   rombami miast i kółkiem huba; w grze lotnisko to szary krążek z pasem startowym, a **żółte romby to uchwyty
   końców tras** — najjaśniejsze, największe znaki na mapie (`tutorial-vs-game-diamonds.png`). Samouczek nie uczy
   też glifów regionów (muszka = Bliski Wschód, półksiężyc = Europa Płd. itd.), a to podstawowa informacja z
   przywieszek; w grze nie ma żadnej legendy. Winieta jest też najbliżej zakazanego „płaskiego diagramu” (D-05).
   → **Q-62**, R5b, R5c.
3. **Nieaktywne przywieszki w doku są przezroczyste** (`opacity: .42`): przez „0” prześwituje świat — nocą chmura
   i światła miast zlewają się z ikoną turbośmigłowca (`dock-disabled-night.png`). To jedyne miejsce HUD, gdzie
   czytelność zależy od tła. → R5d.
4. **Stemple na skrzyniach bez opisu**: „BEG 13 min” (najdłuższe czekanie na slot) i „BEG 9/36” (najpełniejszy hub)
   to kod + liczba bez słowa, co znaczą (`board-stamps-390x844.png`). W pauzie „Najpełniejszy hub MAD 0/36”, gdy
   nikt nie czeka (`pause-fullest-hub-0.png`) — powinno być „jeszcze brak”. → R5e.
5. **Raport porażki — szum**: nad raportem zostają chipy krawędzi (REK, DUB, VLC…) i aktywnie wyglądający dok; w
   tablicy „ODLOTY · REC” są nagłówki kolumn „LOT / CEL · BRAMKA · STATUS” nad zdaniem bez wierszy, co wygląda
   na niedokończoną tabelę (`docs/shots/matrix/gameover-pl-412x915.png`). → R5f.
6. Po „Kontynuuj” gra wraca w pauzie (dobrze) i z prędkością 1× (było 4×) — drobiazg, do decyzji UI.

### Teksty PL/EN
- **Jedno pojęcie, kilka słów.** Tygodniowa nagroda to „skrzynie” (tablica, pauza), „etykieta frachtowa / cargo label”
  (podpowiedź samouczka), „ulepszenie / upgrade” (wskazówki, samouczek) i „FRACHT”. Hub to „hub”, „węzeł”
  (zadania: „3 w węźle”, „Obok zamkniętego węzła”) i „terminal” („Pojemność terminali”, „terminal {city} jest
  przepełniony”). Sieć to „sieć” (pauza) i „siatka” (raport). → R5g.
- **PL ≠ EN w tytule porażki:** „Siatka wstrzymana” (sugeruje pauzę, z której się wraca) vs „Network closed”
  (koniec). Propozycja: „Siatka zamknięta” albo „Sieć zamknięta” (razem z R5g).
- „Symulacja w pauzie” / „Simulation paused” w samouczku — słowo techniczne; lepiej „Czas stoi” / „Time is stopped”.
- Ekran polityki prywatności w grze pokazuje „Projekt informacyjny — wymaga potwierdzenia przez właściciela” i
  „Airway jest grą na etapie produkcji”. Przed wysłaniem do recenzji sklepu to musi zniknąć (zależy od Q-01, R1l).
- Polszczyzna poza tym poprawna, formy liczebników działają (sprawdzone w zrzutach: „24 osoby na 24 miejsca”,
  „11 osób”, „2 trasy · 4 samoloty”).

### Tempo reguł v5 (D-95, D-106, D-113) oczami pierwszej sesji
Z reguł: 1 tick = 1 minuta gry, 10 ticków/s, więc przy 1× dzień gry trwa 2,4 min, tydzień (3 dni) **7,2 min**, nowe
lotnisko co 12 h gry = **co 72 s**. W tygodniu 1 gracz dostaje ok. 6 nowych lotnisk i nie dostaje żadnego
samolotu — dok pokazuje „0 / 0 / 0” przez całe 7 minut (widać to na każdym zrzucie z tygodnia 1). Pierwsza nagroda
po 7,2 min przy 1× (3,6 min przy 2×) to długo jak na pierwszą sesję mobilną; z drugiej strony pierwsze minuty są
zajęte rysowaniem i wydłużaniem tras. Bot tego nie mierzy (D-113). Dodatkowo start w Europie wypada o ok. 02:00
czasu lokalnego, więc pierwszy obraz runu to noc. Rekomendacja: **nie zmieniać reguł teraz** (D-113), ale w
ankiecie testu zamkniętego (R3k) dodać pytanie „kiedy pierwszy raz nie miałeś nic do zrobienia?”, a w eksporcie
dziennika (R1o) — czas do pierwszej tablicy tygodnia.

### Rekomendacja
Przed testem zamkniętym: R5a (po Q-61), R5b (po Q-62), R5d, R5e, R5f, R5g — wszystkie to zmiany UI/i18n bez
dotykania symulacji. R5c razem z R5b (ten sam słownik znaków).

## R5 — Zdrowie kodu: największe moduły, ścieżki bez testów, martwy kod, paczka (stan 2026-11-03)

### Rozmiar i złożoność
`src/` ma 142 pliki TS, ok. 21,8 tys. linii; brak TODO/FIXME/HACK w `src/`, `scripts/`, `functions/src/`.
Najdłuższe funkcje (linie, złożoność cyklomatyczna liczona z AST):

| Funkcja | Linie | Uwagi |
|---|---|---|
| `startSession` (`src/game/session.ts`) | 496 | jedno domknięcie z całą grą; testy tylko przez e2e |
| `createAirportOverlay` (`src/ui/overlay.ts`) | 448 | w środku `update` (złożoność 45), `rebuildBubble` (40), `distributeEdges` (37) |
| `boot` (`src/main.ts`) | 416 | korzeń kompozycji |
| `createWorldRenderer` (`src/render/world.ts`) | 298 | |
| `normaliseAndValidate` (`src/game/save.ts`) | 32 | złożoność 43, ale pokryta `test:saves` / `test:save-golden` |

### Ścieżki ryzykowne bez testu jednostkowego
Spośród 142 plików 95 jest osiąganych przez testy Node (import lub transpilacja w teście); reszta tylko przez e2e.
Najważniejsza luka: **rozmieszczanie chipów przy krawędzi** (`distributeEdges` w `overlay.ts`). To czysta geometria,
w której nocne rundy trzy razy łatały błędy (N10v: chip na lotnisku zabierał stuknięcie; N10z: przywieszka
zakrywała kod; N11d: wskaźnik), a pilnują jej tylko e2e `edge-chip-*`. Do tego pętla jest O(n² · k) na klatkę
(wpisy × przesunięcia × wpisy) — przy ~150 lotniskach późnego runu to do ~10⁶ porównań na klatkę na słabym
telefonie. Sąsiedni `overlay-layout.ts` ma już czyste funkcje i `test:overlay-layout`, więc przeniesienie jest
naturalne. → R5h. `src/audio/engine.ts` (675 linii) nie ma testu, ale ryzyko małe (dźwięk nie wpływa na stan).

### Martwy kod
- `src/ui/a11y.ts`: `describeCity`, `createCityAnnouncer`, `bindCityAccessibility`, `labelAirportActions` nie są
  nigdzie wołane (opisuje je tylko `src/ui/theme/README.md`); razem z nimi 13 kluczy i18n `a11y.city*` /
  `a11y.action.*`. Nakładka lotnisk ma własne etykiety ARIA (`airport.waiting`, `airport.jammed`), więc to
  dubel, nie brak dostępności.
- Nieużywane eksporty: `createTerrain` (`render/globe/terrain.ts`), `mountEmptyScene` (`render/scene.ts`),
  `SIM_TICK_MS`, `DAYNIGHT_PARAMS_VERSION` (`sim/params.ts`), `AIRPORT_LABEL_MODES`, `dailyGame`
  (`net/submission.ts` — sprawdzić `functions/` przed usunięciem), klucze `status.loading` / `status.ready`.
  → R5i.
- 540 znaczników pochodzenia `[task-NN]` / `[night-NN]` w komentarzach — nie szkodzą, nie proponuję sprzątania.

### Bezpieczne obszary
HUD ma syntetyczny test wcięć (`test:hud-targets` ustawia `--hud-safe-*`), ale menu, tablica tygodnia, raport,
samouczek, ustawienia i zadania używają `env(safe-area-inset-*)` wprost (56 wystąpień poza definicją tokenów w `base.css`, tylko 7 użyć tokenów
`--aw-safe-*`), więc żadna macierz nie sprawdza ich z wycięciem ekranu. Przykład: komunikat w menu ma na sztywno
`left:16px` w poziomie. → R5j.

### Paczka (`npm run build`, Vite 6)
Jeden główny chunk **1 031,9 kB (306,2 kB gzip)** + CSS 69,9 kB (14,2 kB gzip) + kilka małych chunków Capacitor
(< 9 kB). Z mapy źródeł (szacunek): three.js ok. 494 kB, `src/data` ok. 88 kB (z czego tablica odległości ok. 70 kB),
`src/ui` 86 kB, `src/render` 78 kB, `src/sim` 60 kB, `src/game` 54 kB, `src/i18n` 43 kB. Fonty TTF 624 kB (WOFF2
dałby ok. −40 %, ale w aplikacji pliki są lokalne). Dla aplikacji Capacitor (pliki z dysku) to **nie jest problem
sieci**; ryzykiem jest tylko niekontrolowany wzrost i czas parsowania na tanim Androidzie. Ostrzeżenie Vite: dynamiczny
`import('@capacitor/core')` w `platform/install.ts` i `platform/storage.ts` nic nie daje, bo ten moduł jest też
importowany statycznie. Dzielenie na chunki (puzzle, dziennik, ranking, samouczek to razem < 40 kB) nie jest warte
ryzyka. → R5k (strażnik budżetu zamiast refaktoru).

### Czego nie proponuję
Rozbijanie `startSession` / `boot` / `createAirportOverlay` „dla porządku”: to duże przesunięcia kodu bez testu
jednostkowego, które zwiększają ryzyko przed testem zamkniętym. Wyjątek to R5h (wydzielenie czystej funkcji z testem).

## R6 — Plan treści na premierę i pierwsze 3 miesiące (stan 2026-11-03)

### Ustalenia
- **Nie ma wiarygodnego benchmarku „ile poziomów na start”** dla płatnych gier logicznych/strategicznych na
  telefon. Dostępne są pojedyncze postmortemy: jedna gra wystartowała z 500 poziomami i opisuje typowy model
  mobilny jako „część treści na premierę, reszta w aktualizacjach, jeśli gra się sprzedaje”
  ([ModDB, Bardadum](https://www.moddb.com/games/bardadum-the-kingdom-roads/news/500-levels-and-1-teaser)), inna
  wydała ok. 30 aktualizacji w 2 lata ([Medium, Cinderella Free Fall](https://medium.com/amber-log/cinderella-free-fall-86d4297a3aef)),
  a postmortem Wolf Toss radzi zaplanować kilka miesięcy pracy po premierze
  ([Game Developer](https://www.gamedeveloper.com/business/business-post-mortem-wolf-toss-post-launch-tlc-and-tuning)).
  Wniosek: liczby z innych gier nie przenoszą się na Airway. **NIEPEWNE**; planuję w czasie gry, nie w liczbie
  poziomów.
- **Sklepy nagradzają rytm około 4 tygodni.** Apple In-App Events: wydarzenie trwa do 31 dni, promocja do 14 dni
  przed startem, do 10 opublikowanych naraz, plakietki m.in. *Major Update*, *Challenge*, *Competition*; Apple nie
  przyjmuje „powtarzalnych aktywności (codzienne zadania)”, więc samo wyzwanie dnia nie wystarczy na wydarzenie
  ([Apple, In-App Events](https://developer.apple.com/app-store/in-app-events/), dostęp 2026-11-03). Google Play
  *Promotional content* (dla gier dostępny bez progów): *Major update* trwa stałe 28 dni, zgłoszenie najwcześniej
  60 dni przed startem, akceptacja do 4 dni, grafiki nie mogą się powtarzać między zgłoszeniami
  ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/12932541),
  [Premium growth tools](https://play.google.com/console/about/guides/premium-growth-tools/), dostęp 2026-11-03).
  Jedna aktualizacja z treścią co ok. 4 tygodnie wystarcza, żeby w obu sklepach zawsze trwało jedno wydarzenie.

### Ile treści Airway ma dziś (stan `dev`)
- **Zagadki 1–30**: suma `durationTicks` = 128 760 ticków = **ok. 3,6 h przy 1×** dla jednego przejścia bez
  powtórek (przy 2–4× mniej, z powtórkami i gwiazdkami więcej). 1–15 uczą rdzenia (bez znaczników mechanik),
  16–30 łączą sloty, ciszę nocną, tydzień i MCT. Na 2–4 sesje po 15–20 min dziennie to ok. 1–2 tygodnie gry.
- **Wyzwanie dnia**: nieskończone (seed z daty), ale zawsze ten sam scenariusz i reguły.
- **Endless**: jeden scenariusz (`ENDLESS_SCENARIO`); głębię po 3. godzinie omawia R2 (R2g–R2k, Q-50).
- Ograniczenia techniczne dla nowych paczek: id zagadki ma 2 cyfry (`/^\d{2}$/`, maks. 99), lista JSON jest
  importowana ręcznie w `src/data/puzzles/index.ts`, a `scripts/test-puzzles.mjs` ma na sztywno `LEVELS = 30`.
  Każda zagadka potrzebuje `referenceCommands`, tytułu PL/EN i zrzutów, więc **5 zagadek to rozsądny PR**.

### Proponowana mapa treści (T = premiera; wymaga Q-64, kierunek mechanik z Q-50)
| Kiedy | Treść | Mapuje się na | Wydarzenie w sklepie |
|---|---|---|---|
| T | 30 zagadek, wyzwanie dnia, Endless + region startowy (R2g) + klasy licencji (R2h); przy Q-50 = B także R2i | dziś + R2g/R2h | Premiere / pre-order |
| T+4 tyg. | Paczka zagadek 31–40 „Daleki zasięg” (szerokokadłubowce, oceany, start poza Europą), poprawki z recenzji | R6h, R6f | Major Update (28/31 dni) |
| T+8 tyg. | Front pogodowy (R2j) + 5 zagadek, które go uczą (41–45) | R2j | Major Update |
| T+12 tyg. | Kontrakt tygodnia (R2k) + „niedziela z licencją II” w wyzwaniu dnia (jeden dzień tygodnia z ostrzejszymi pokrętłami scenariusza, ten sam dla wszystkich) | R2k, R2h | Challenge |

Zasady: jedna nowa mechanika na aktualizację i zawsze razem z zagadkami, które jej uczą (uczenie w kontekście,
patrz R6 — onboarding); żadnych sezonów płatnych ani FOMO (D-16); każda zmiana reguł ma wersję parametrów,
zapis i powtórkę starych biegów (D-76). Wariant wyzwania dnia zmienia replay po stronie serwera, więc to zmiana
w `functions/` — dlatego dopiero w T+12, po sprawdzeniu kosztów z R3.

### Rekomendacja
Rytm „co 4 tygodnie, jedna mechanika + 5–10 zagadek” przez pierwsze 3 miesiące (Q-64 → A). Przed premierą tylko
narzędzia: R6f (paczki zagadek bez ręcznych list i z raportem trudności) i R6g (plan w `docs/LAUNCH.md`, teksty
wydarzeń). Pierwsza paczka (R6h) może powstać przed premierą i czekać w gałęzi — daje zapas, gdy premiera
przyniesie pilne poprawki.

## R6 — Pierwsza sesja przy regułach v5: samouczek i pierwsze 10 minut (stan 2026-11-03)

### Zasady (źródła ogólne, bez kopiowania innych gier)
- Gracze uczą się najlepiej przez działanie w znaczącym kontekście, a samouczki **wyzwalane przy pierwszym
  zetknięciu z mechaniką** działają lepiej niż wykład na starcie
  ([Roblox Creator Docs, Onboarding techniques](https://create.roblox.com/docs/production/game-design/onboarding-techniques),
  dostęp 2026-11-03: „When players practice actions while learning them, they retain knowledge better”), a
  odłożenie rzeczy nieistotnych na kolejne sesje zmniejsza to, co trzeba zapamiętać w pierwszej (to samo źródło). Wykład
  C. Hodent z GDC 2016 o onboardingu ([GDC Vault](https://gdcvault.com/play/1022951/contactUs)) omawia te same
  błędy, ale jego tekstu nie udało się przeczytać — cytuję tylko temat (**NIEPEWNE**).

### Jak wygląda dziś (kod `dev`)
1. Pierwsze „Graj” w Endless otwiera **lot szkoleniowy przed biegiem**: winieta 3 miast, 7 kroków
   (`TUTORIAL_STEPS`: trasa, samolot, przesiadka, świt, ulepszenie, przeciążenie, koniec), potem prawdziwy bieg.
   Pominięcie i powtórka z ustawień działają.
2. W prawdziwej grze jest **jedna** podpowiedź „przy pierwszym razie”: slot (`slot-hint.ts`, task 32). Nowe
   lotnisko ma znacznik NEW (N10a), cisza nocna ma szlaban (N10g/N10h), za daleka trasa — komunikat ATC.
3. Reguły v5: dzień = 2,4 min przy 1×, tydzień = 7,2 min, nowe lotnisko co 72 s, rezerwa 4 turbośmigłowce.
   Start w Europie wypada ok. 01:00–02:00 lokalnie (zegar zaczyna od 00:00 UTC; wagi popytu o 02:00 = 15,
   o 06:00 = 205), czyli pierwsze ~30 s to cicha noc, potem fala świtu.

### Ocena wobec zasad
- **Krok 5 (ulepszenie) i 6 (przeciążenie) są uczone za wcześnie.** Pierwsza tablica tygodnia przychodzi po
  7,2 min, a pierwszy hub ≥ 70 % zwykle jeszcze później; w tym czasie gracz rysuje trasy na prawdziwym globusie,
  który wygląda inaczej niż winieta (R5, Q-62). Uczenie tych kroków na winiecie to wykład przed kontekstem.
- **Krok 4 (świt) pasuje do startu w Europie** — w prawdziwym biegu fala świtu przychodzi po ok. 30 s, więc to,
  co samouczek pokazał, od razu się powtarza. Nocny początek nie jest więc wadą rozgrywki, tylko obrazu
  (pierwszy kadr jest ciemny). Nie proponuję zmiany zegara (to zmiana symulacji i replayu).
- **Tydzień 1 nie pokazuje, na co gracz czeka.** Dok ma „0 / 0 / 0” przez 7 minut, a jedyna zapowiedź nagrody
  to licznik dnia „1/3”. Brakuje obrazu „skrzynie przylecą za …” w miejscu, na które gracz patrzy, gdy szuka
  samolotu.
- **Mechaniki bez podpowiedzi w grze:** pierwsze lotnisko poza zasięgiem turbośmigłowca (od tygodnia 2), pierwsza
  cisza nocna (tydzień 4, ok. 22 min — poza medianą sesji, więc w drugiej lub trzeciej sesji), pierwszy hub
  blisko pełnego. Jest gotowy wzorzec (`slot-hint`) do powielenia.

### Propozycje (testowalne)
- **R6a** — karty „pierwszy raz” w prawdziwej grze (ten sam mechanizm co slot): pierwszy hub ≥ 70 %, pierwsze
  lotnisko poza zasięgiem, pierwsza cisza nocna, pierwsza tablica tygodnia. Raz na instalację, nie zatrzymują
  czasu (poza tablicą, która i tak pauzuje), znikają po akcji. Test: E2E z ziarnem, które wywołuje każdą kartę,
  i drugi bieg bez kart.
- **R6b** — krótszy lot szkoleniowy (3 kroki: trasa, samolot, przesiadka + „świt” jako jedno zdanie w biegu);
  ulepszenie i przeciążenie uczone kartami R6a w chwili, gdy się zdarzają. Mierzalne: liczba wymaganych akcji przed
  pierwszą trasą na prawdziwym globusie spada z 7 kroków do 3. Wymaga Q-63.
- **R6c** — pusta przywieszka doku pokazuje odliczanie do skrzyń („skrzynie: dzień 3” / „crates: day 3”) zamiast
  samego „0”, razem z R5d (nieprzezroczyste puste przywieszki).
- **R6i** — arkusz obserwacji pierwszej sesji do testu zamkniętego (czas do pierwszej własnej trasy, czy gracz
  znalazł dok, pierwsza chwila „nie mam nic do roboty”, co znaczy glif) — rozszerza R1o/R3k.

### Rekomendacja
R6a teraz (UI, bez zmian reguł). R6b po decyzji Q-63 i razem z R5b (oba przerabiają samouczek — jeden PR, nie
dwa). R6c razem z R5d. Reguł tempa (D-113) nie ruszać przed danymi z testu zamkniętego.

## R6 — Haptyka i dźwięk na telefonie: co robi gra, czego brakuje (stan 2026-11-03)

### Co już jest dobrze (stan `dev`)
- iOS: `AVAudioSession` w kategorii `.ambient` (`ios/App/App/AppDelegate.swift`) i `navigator.audioSession.type`
  = `ambient` / `playback` wg ustawienia „graj przy wyciszeniu” (`src/audio/engine.ts`). To zgodne z zachowaniem
  WebKit: domyślnie Web Audio jest wyciszane przełącznikiem dzwonka, a `playback` je omija
  ([WebKit Bugzilla 237322](https://bugs.webkit.org/show_bug.cgi?id=237322), [264473](https://bugs.webkit.org/show_bug.cgi?id=264473)).
- `AudioContext` jest wstrzymywany przy `visibilitychange`/`pagehide`, scheduler nie odtwarza starych zdarzeń po
  powrocie; haptyka ma przełącznik, jest tylko w warstwie prezentacji (D-13), przeciążenie wibruje raz na
  przejście, a nie co tick.
- Słownik zdarzeń jest krótki (zatrzask, potwierdzenie, przeciążenie, koniec sieci) — zgodny z zaleceniem Apple,
  by haptyka była krótka, spójna i powiązana z dźwiękiem, i nie nadużywana
  ([Apple HIG, Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics), dostęp 2026-11-03).

### Ustalenia — błędy i luki
1. **Zatrzask (`snap`) nie wibruje na żadnej platformie.** `src/platform/haptics.ts` woła
   `Haptics.selectionChanged()` bez `selectionStart()`. W `@capacitor/haptics` 8.0.2 Android ignoruje
   `selectionChanged`, gdy `selectionStarted == false` (`Haptics.java`), a iOS woła generator tylko, jeśli
   `selectionStart` go utworzył (`Haptics.swift`: `if let generator = self.selectionFeedbackGenerator`). Czyli
   najczęstsza haptyka gry (dociągnięcie trasy do lotniska) dziś nie działa; test jednostkowy z wstrzykniętym
   sterownikiem tego nie widzi. → R6d.
2. **Android: wibracje z surowego `Vibrator`, nie ze stałych systemowych.** Wtyczka gra `LIGHT` = 50 ms przy
   amplitudzie 110 i `HEAVY` = 60 ms przy 255 (`HapticsImpactType.java`). Wytyczne Androida: preferować
   `HapticFeedbackConstants` (spójność z systemem, zachowanie zastępcze na słabszych silnikach), unikać
   jednostrzałowych wibracji, a „mając wybór między brzęczącą haptyką a żadną — wybierz żadną”; dobre kliknięcie
   trwa 10–20 ms ([Android Developers, Haptics design principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles),
   dostęp 2026-11-03). Na tanich telefonach z listy R3 60 ms przy pełnej mocy prawdopodobnie brzęczy
   (**NIEPEWNE**, sprawdzić na urządzeniu). → R6e.
3. Android i inne aplikacje audio: czy Web Audio w WebView przerywa muzykę z innej aplikacji (audio focus), nie
   znalazłem w dokumentacji (**NIEPEWNE**). Do sprawdzenia ręcznie w teście zamkniętym (R6i): Spotify gra →
   otwórz Airway → muzyka powinna grać dalej, jak na iOS (`.ambient`).

### Rekomendacja
R6d przed testem zamkniętym (mały, pewny błąd). R6e po pierwszym teście na tanim Androidzie — jeśli wibracje
brzęczą, natywny most do `performHapticFeedback`. Nowych zdarzeń haptycznych nie dodawać (zasada „mniej znaczy
więcej” obu platform).

## R7 — Pakiet prawny i prywatności na premierę (stan 2026-11-03)

To lista kontrolna ze źródłami, **nie porada prawna**. Całość warto raz przejrzeć z prawnikiem (jedna konsultacja:
polityka prywatności + regulamin + status przedsiębiorcy). Punkt wyjścia: gra darmowa bez reklam i analityki (D-16),
rankingi z anonimowym kontem Firebase (D-66, D-72), konto Google Play organizacji (D-94), cały świat bez Chin (D-96).

### Ustalenia
| Obszar | Co mówią przepisy / sklepy | Airway dziś | Luka | Kto |
|---|---|---|---|---|
| **Administrator danych** | Polityka musi wskazać tożsamość i kontakt administratora (art. 13 RODO) | `site/privacy.html` § 1: „zostaną uzupełnione”; Q-01 otwarte | blokuje publikację strony (D-67), przedrejestrację i formularze sklepów | właściciel (Q-01) |
| **Podstawa prawna rankingów** | Wiek 16 lat (art. 8 RODO, Polska nie obniżyła progu) dotyczy **tylko zgody** jako podstawy ([gdpr-text.com, art. 8](https://gdpr-text.com/pl/read/article-8/); [Bird & Bird — Polska](https://childreninthedigitalworld.twobirds.com/home/poland)) | szkic mówi „wykonanie usługi … do potwierdzenia” | jeśli podstawą będzie uzasadniony interes / umowa, nie potrzebujemy weryfikacji wieku; za to gracz musi móc **sprzeciwić się** (art. 21) — dziś nie ma przełącznika „nie wysyłaj wyników” | Q-68, R7l |
| **Firebase jako podmiot przetwarzający** | Google jest procesorem; umowa = Firebase Data Processing and Security Terms (transfer: EU-US Data Privacy Framework / SCC). Auth zapisuje **adres IP przez kilka tygodni**; dane konta do usunięcia, potem do **180 dni** z kopii zapasowych; Cloud Functions trzymają IP tylko tymczasowo ([Firebase — Privacy](https://firebase.google.com/support/privacy), [Firebase DPST](https://firebase.google.com/terms/data-processing-terms), sprawdzone 2026-11-03) | szkic wspomina IP i transfer ogólnie | w polityce brakuje: IP w logach Auth (tygodnie), 180 dni kopii, mechanizm transferu (DPF), region `europe-west1`; w konsoli trzeba **zaakceptować** warunki przetwarzania (gdzie dokładnie — **NIEPEWNE**, opisać w `docs/FIREBASE.md` przy zakładaniu projektu) | agent (R7a, R7d), właściciel klika |
| **Rejestr czynności (art. 30)** | Zwolnienie < 250 osób **nie** dotyczy przetwarzania, które nie jest sporadyczne — ranking działa codziennie | brak | jedna strona w `docs/legal/` (cele, kategorie, odbiorcy, okresy) | agent (R7d) |
| **Przedstawiciel w UK (art. 27 UK GDPR)** | Administrator spoza UK oferujący usługę osobom w UK wyznacza przedstawiciela, chyba że przetwarzanie jest sporadyczne i niskiego ryzyka ([legislation.gov.uk](https://www.legislation.gov.uk/eur/2016/679/article/27/data.html); komentarze kancelarii: „sporadyczne” = poza zwykłą działalnością) | — | codzienny ranking raczej **nie** jest sporadyczny → prawdopodobnie potrzebny przedstawiciel albo rankingi wyłączone w UK; **NIEPEWNE**, do prawnika | Q-67 |
| **Status przedsiębiorcy — Apple** | Deklaracja trader/non-trader w App Store Connect; od 17–18.02.2025 aplikacje bez deklaracji zdjęte z UE; trader pokazuje adres, telefon, e-mail na stronie produktu w UE ([Apple](https://developer.apple.com/news/?id=einwn76m), [MacRumors 17.10.2024](https://www.macrumors.com/2024/10/17/developers-eu-app-store-trader-requirements/)) | brak konta | dane kontaktowe firmy muszą być gotowe (telefon firmowy, nie prywatny) | Q-66 |
| **Status przedsiębiorcy — Google (nowe)** | Na podstawie dyrektywy UCPD i brytyjskiej DMCCA: **nowe konta deklarują przy zakładaniu**, istniejące do **1.02.2027**; od **1.03.2027** trader ma na karcie: nazwę, adres, telefon, e-mail, D-U-N-S i link do regulaminu (jeśli podany), w EOG/UK nazwę zamiast „Google” w „Oferowane przez”. Non-trader: tylko e-mail i kraj + komunikat, że prawa konsumenta nie mają zastosowania. Fałszywe „non-trader” = zawieszenie konta ([Play Console Help — Trader status declaration](https://support.google.com/googleplay/android-developer/answer/17594752?hl=en-GB), pobrane 2026-11-03) | D-94: konto organizacji (D-U-N-S) | przy firmie i planach monetyzacji (D-16) deklaracja **trader** jest praktycznie przesądzona; Google pokaże link do regulaminu, którego nie mamy | Q-66, Q-65 |
| **Dane usługodawcy i regulamin (Polska)** | Ustawa o świadczeniu usług drogą elektroniczną: art. 5 — dane identyfikacyjne i kontaktowe usługodawcy dostępne w systemie, którym posługuje się usługobiorca; art. 8 — usługodawca **określa regulamin** usług elektronicznych ([ISAP, t.j.](https://isap.sejm.gov.pl/isap.Nsf/download.xsp/WDU20190000123/U/D20190123Lj.pdf); najnowszy t.j. Dz.U. 2024 poz. 1513; projekt nowelizacji pod DSA z 18.09.2025 — **NIEPEWNE**, czy zmienia art. 5/8) | ani strona, ani gra nie mają danych usługodawcy ani regulaminu | ranking (usługa online) i strona to usługi elektroniczne → krótki regulamin PL/EN + blok „kto wydaje grę” w grze i na stronie (wniosek z ustawy, nie z orzeczenia o aplikacjach — **NIEPEWNE**) | Q-65, R7b, R7c |
| **Warunki korzystania (sklepy)** | Apple ma standardową licencję EULA, której można użyć zamiast własnej; Google własnej nie narzuca, ale od 03.2027 pokaże link do regulaminu tradera | — | R7b: jeden regulamin dla obu sklepów (licencja gry + zasady rankingu: jedna gra oficjalna, odrzucanie oszustw, brak gwarancji dostępności serwera) | Q-65 |
| **Dzieci — USA (COPPA)** | Zmieniona reguła COPPA: w mocy od 23.06.2025, pełna zgodność od **22.04.2026**; usługa „mixed audience” musi badać wiek przed zbieraniem danych; stały identyfikator to dane osobowe ([Federal Register 22.04.2025](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule)) | grupa docelowa 13+ (R1), gra nie jest projektowana dla dzieci | przy grupie 13+ i braku wiedzy o dzieciach COPPA nie wymaga bramki wieku; **nie** zaznaczać w Play grup < 13 i nie kierować reklam/ASO do dzieci. Gdyby właściciel chciał „dla całej rodziny” → mixed audience → bramka wieku przed rankingiem | właściciel (potwierdzić 13+) |
| **USA — ustawy stanowe o sklepach** | Texas App Store Accountability Act działa po wstrzymaniu nakazu przez 5. Okręg (28.05.2026); Utah przesunęło obowiązki do 6.05.2027, Luizjana od 1.07.2026, Alabama od 1.01.2027; Apple udostępnia Declared Age Range API ([AppleInsider 03.06.2026](https://appleinsider.com/articles/26/06/03/age-verification-now-mandatory-for-app-store-users-in-texas), [FPF](https://fpf.org/blog/comparing-enacted-app-store-accountability-acts/)) | brak | obowiązki deweloperów to głównie respektowanie sygnału wieku ze sklepu i zgód rodzica przy zmianach istotnych; dla gry 4+ bez treści wrażliwych **prawdopodobnie** nic do kodu — **NIEPEWNE**, sprawdzić przed premierą w USA | agent: obserwować (R7d) |
| **Prawo konsumenckie / zwroty** | Gra darmowa → brak zwrotów. Dyrektywa o treściach cyfrowych 2019/770 obejmuje też treść „za dane”, ale nie, gdy dane służą wyłącznie dostarczeniu treści (art. 3 ust. 1) | D-16: bez płatności | dziś nic; przy płatnej wersji zwroty prowadzi sklep, a ekran zakupu podlega EAA (R1) | — |
| **Strona airway.games** | Logi hostingu to dane osobowe; dostawca hostingu = procesor | polityka § 3 mówi „zależy od hostingu” | po wyborze hostingu (Cloudflare Pages / GitHub Pages, `docs/SITE.md`) wpisać dostawcę, okres logów i transfer | agent po decyzji o hostingu |

### Luki w tekście polityki prywatności (`site/privacy.html` + kopia w grze, D-86)
1. § 1 administrator: brak nazwy, adresu, kontaktu (Q-01); e-mail `contact@airway.games` „do potwierdzenia”.
2. § 2 „bez przekazywania danych do naszych serwerów” jest **nieprawdziwe** dla buildu z rankingami — sekcja rankingów
   czeka (Q-56). Do dopisania: cele i podstawy prawne osobno dla rankingu, ochrony przed oszustwami i e-maila.
3. Brak: odbiorców (Google jako procesor, hosting), transferu poza EOG (DPF), okresów (90 dni wpisy — D-77; IP w logach
   Auth — tygodnie; konto Auth do usunięcia + do 180 dni w kopiach; e-maile — ile?; logi hostingu), prawa sprzeciwu
   i skargi do **Prezesa UODO**, informacji o wieku (13+), braku profilowania, daty wejścia w życie i historii zmian.
4. Banner „Projekt informacyjny — wymaga potwierdzenia” (R5) musi zniknąć dopiero po akceptacji właściciela; dziś test
   `test:privacy-text` pilnuje zgodności gry ze stroną — przy zmianie tekstu wystarczy jedna zmiana w `site/i18n.js`.

### Co właściciel musi zdecydować albo podpisać
- Q-01 dane administratora; Q-66 status przedsiębiorcy (Apple + Google, deklaracja Google przy zakładaniu konta
  organizacji — D-94); Q-65 regulamin; Q-68 podstawa prawna rankingu; Q-67 UK.
- Zaakceptować warunki przetwarzania danych Firebase w konsoli (przy krokach `docs/FIREBASE.md`).
- Uruchomić skrzynkę `contact@airway.games` (lub inny adres) — wymagają jej: polityka, usuwanie danych (D-77), karta
  tradera, Data safety.
- Jedna konsultacja prawna z gotowymi szkicami R7a/R7b/R7d (taniej niż pisanie od zera).

### Rekomendacja
1. Teraz (agent, bez decyzji): **R7d** (rejestr czynności + lista kontrolna prawna z datami), **R7l** (przełącznik
   „wysyłaj wyniki do rankingu”). 2. Po Q-01/Q-65/Q-68: **R7a** (polityka v1 z sekcją rankingów, Q-56 → A), **R7b**
   (regulamin), **R7c** (dane wydawcy w grze i na stronie). 3. Trader: **tak** w obu sklepach (firma, D-94). 4. UK:
   zapytać prawnika przy tej samej konsultacji; domyślnie rankingi działają też w UK.

## R7 — Lokalizacja, fala 1 (DE/FR/ES/PT-BR): przygotowanie kodu i tekstów (stan 2026-11-03)

D-96 zdecydowało: po premierze DE, FR, ES, PT-BR, najpierw opisy sklepowe (R1k). Ta sekcja mierzy, ile jest do
przetłumaczenia i co w kodzie trzeba przygotować, żeby tłumaczenia weszły bez niespodzianek. Pomiary: skrypty na
`origin/dev` z 2026-11-03 (Node 22.23, ICU 78.3; fontTools 4.68).

### Ile tekstu
| Źródło | Rozmiar (EN) |
|---|---|
| Katalog gry `src/i18n/en.ts` | **424 klucze, ok. 1 780 słów, 11 400 znaków**; 96 kluczy z parametrami, 29 z liczbą mnogą; PL jest o 8 % dłuższy niż EN |
| Nazwy miast `src/data/cities.ts` | **165 miast** × `namePl`/`nameEn` (+ 8 regionów w `src/data/regions.ts`) |
| Strona `site/i18n.js` | 73 teksty, ok. 640 słów (w tym polityka prywatności) |
| Sklep `docs/store/en.md` | ok. 350 słów (R1k) |
| **Razem na język** | **ok. 2 800 słów + 165 nazw miast** |

Największe klucze to polityka prywatności (do 354 znaków) i zadania (80 kluczy `puzzle.*`). **61 % kluczy ma ≤ 20
znaków** (125 ≤ 10, 136 w 11–20) — wg wytycznych IBM cytowanych przez W3C krótkie teksty po przetłumaczeniu z angielskiego
rosną o **80–200 %**, długie o ok. 30 % ([W3C — Text size in translation](https://www.w3.org/International/articles/article-text-size.en)).
Nasza pseudo-lokalizacja (`src/i18n/pseudo.ts`, N10p) wydłuża wszystko równo o ok. 40 % — dla krótkich etykiet to za
mało, a w e2e sprawdza tylko 360×640 i 915×412 (nie 320×568).

### Miejsca w kodzie, które znają tylko PL i EN
`Language = 'pl' | 'en'` i `normaliseLanguage` (`src/i18n/index.ts`), `PLURAL_ORDER` (tamże), `NumberLanguage` +
`LOCALES` (`src/core/format.ts`), trójargumentowe `getLanguage() === 'pl' ? namePl : nameEn` (`src/ui/airportLabel.ts`),
`namePl`/`nameEn` w miastach i regionach, lista w ustawieniach (`src/ui/settings`, `lang==='pl'?'pl':'en'`),
`CFBundleLocalizations` (iOS, D-91), `locales_config.xml` (Android, D-115), `site/i18n.js` i `test:privacy-text`.
Każdy nowy język to dziś ok. 10 miejsc ręcznie — warto jedna tabela języków (R7f).

### Liczba mnoga
| Język | Kategorie CLDR (Intl, ICU 78) | Uwaga |
|---|---|---|
| de | one, other | jak EN |
| fr | one, many, other | **0 i 1 → one** („0 passager”); many tylko dla milionów („1 000 000 de passagers”) |
| es | one, many, other | many dla milionów |
| pt-BR | one, many, other | **0 i 1 → one** (pt-PT: 0 → other); many dla milionów |

Silnik (`pluralForm`) obsłuży to po dopisaniu kolejności form do `PLURAL_ORDER` — brakująca forma bierze ostatnią, więc
tłumacz może podać 2 formy (one|other), jeśli `many` ustawimy po `other`. **Znalezisko (błąd uśpiony):** `pluralValue`
czyta liczbę już sformatowaną i traktuje kropkę jako przecinek dziesiętny. W DE/ES/PT-BR separator tysięcy to kropka:
„1.000” → 1 → forma **one** („1.000 Passagier”), a w PT-BR „1.500” → 1,5 → one („1.500 passageiro”). W PL/EN dziś
działa. Poprawka: wybierać formę z liczby przed formatowaniem albo parsować wg separatorów języka (R7e).

### Format liczb
`de-DE` „2.500”, `fr-FR` „2 500” (wąska twarda spacja **U+202F**), `es-ES` „2500” (CLDR grupuje dopiero od 5 cyfr,
jak pl-PL przed D-61), `pt-BR` „2.500”. Rekomendacja: zostawić CLDR (D-61 dotyczy tylko PL); ewentualne ujednolicenie
ES zgłosić przy korekcie native speakera.

### Fonty (OFL, `public/fonts/`)
Sprawdzone `cmap` pięciu plików pod znaki DE/FR/ES/PT (ä ö ü ß ẞ „ “, à â æ ç é è ê ë î ï ô œ ù û ÿ « », á í ó ú ñ ¿ ¡,
ã õ º ª, €, …, –, —): **Overpass 400/800 i Overpass Mono 700 — komplet.** **Atkinson Hyperlegible Next 400/700**
(krój tekstu, 362 glify, podzbiór) ma wszystkie litery, ale **nie ma U+202F** — a tego znaku używa `Intl` fr-FR jako
separatora tysięcy, a francuska typografia przed „: ; ! ?”. Skutek: przeglądarka weźmie spację z kroju systemowego
(inna szerokość, w najgorszym razie pusty prostokąt — **NIEPEWNE**, zależy od WebView). Poprawka: w `formatNumber`
zamieniać U+202F na U+00A0 (który Atkinson ma) i test pokrycia glifów dla każdego katalogu (R7g).

### Najciaśniejsze miejsca
- **Tablica split-flap w menu** (`src/ui/menu/menu.ts`): tytuł wiersza 20 komórek, **pół wiersza 10**, status 10, bramka
  2; dłuższy tekst kończy się „…”. Przykładowe tłumaczenia słownikowe (orientacyjne, **nie** finalne): USTAWIENIA/SETTINGS
  → DE „EINSTELLUNGEN” (13) i PT „CONFIGURAÇÕES” (13) nie mieszczą się w 10; BOARDING → FR „EMBARQUEMENT” (12) nie
  mieści się w statusie. Tłumacz musi dostać **limit znaków przy kluczu** (np. DE „OPTIONEN”, PT „AJUSTES”, FR „À BORD”).
- **320×568** (`e2e/screens-fit-320.mjs`): pilnuje celów ≥ 48 px, braku przycinania i zapasu 8 px w selectach — dziś tylko
  PL/EN. Najdłuższe opcje selectów (np. „Automatyczna”) w DE/FR będą dłuższe.
- **D-51 (bez łamania w środku wyrazu bez dywizu)** + niemieckie złożenia (np. „Großraumflugzeug”, 16 liter, na stemplu
  lub w doku). `hyphens: auto` w Chromium działa na Androidzie z wzorcami AOSP, ale pokrycie języków jest „nierówne”
  ([blink-dev — Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/sIRXYKA4jGE),
  [web-features #1714](https://github.com/web-platform-dx/web-features/pull/1714)) — **NIEPEWNE** dla DE/FR/ES/PT w WebView.
  Bezpieczniej: miękkie dywizy (`­`) w katalogu DE tam, gdzie test wykryje ryzyko (zgodne z kierunkiem Q-23).

### Nazwy miast
Egzonimy różnią się między językami: Monachium/Munich/**München**, Mediolan/Milan/**Mailand**, Londyn/**Londres** (FR/ES/PT),
Nowy Jork/**Nueva York**/**Nova York** (BR; PT-PT „Nova Iorque”), Pekin/**Pékin**. 165 miast × 4 języki = 660 nazw.
Źródło: etykiety Wikidata (licencja **CC0**, zgodna z naszą zasadą „own or CC0”) + przegląd; wpis w `docs/ASSETS.md`.
Zapis danych trzeba zmienić z `namePl`/`nameEn` na mapę języków bez ruszania `code` (D-107: id symulacji stałe).

### Rekomendacja
1. Przed zamówieniem tłumaczeń (agent, bez decyzji): **R7e** (liczba mnoga z surowej liczby), **R7f** (tabela języków),
   **R7g** (U+202F + test glifów), **R7h** (limity długości + ostrzejsza pseudo-lokalizacja na 320×568).
2. Potem **R7i** (eksport/import dla tłumacza z kontekstem i limitem) i **R7j** (nazwy miast z Wikidata).
3. Tłumaczenie: agent + korekta native speakera na język (Q-69); ok. 2 800 słów na język. Stawki rynkowe korekty /
   tłumaczenia gier w EU to rząd 0,05–0,15 EUR za słowo (**NIEPEWNE**, brak świeżego źródła) → orientacyjnie
   150–400 EUR na język za korektę, więcej za pełne tłumaczenie. Polityka prywatności i regulamin w nowych językach
   dopiero po wersji v1 PL/EN (R7a/R7b).

## R7 — Strona airway.games i przedrejestracja (stan 2026-11-03)

Krótko, bo prasę opisuje R2e, a plan wydania R2f. Co strona ma, a czego brakuje do lejka „zobacz → zapisz się
w sklepie”:

| Element | `site/` dziś | Potrzebne na T−8 tygodni (przedrejestracja, D-96) |
|---|---|---|
| Wezwanie do działania | „Wkrótce na Android i iOS”, bez linków | przyciski sklepów (oficjalne odznaki Apple / Google wg ich wytycznych marki — wpis w `docs/ASSETS.md`), ukryte, dopóki adres nie jest ustawiony w konfiguracji |
| Obrazy | koncepcyjne makiety etapu 0 (`docs/SITE.md` sam ostrzega) | prawdziwe zrzuty z `docs/store/shots/` (D-123) i grafika z D-117 jako `og:image` (dziś brak `og:image`) |
| Prasa | brak | R2e (`press.html`, ZIP) |
| Dane wydawcy / kontakt | tylko e-mail „do potwierdzenia” | blok wydawcy (UŚUDE art. 5, trader) — R7c |
| Regulamin | brak | R7b (link wymagany też na karcie Google tradera od 03.2027) |
| Newsletter | brak (polityka: „bez formularzy”) | **rekomendacja: bez newslettera na start** — przedrejestracja w Play i pre-order w App Store same powiadamiają gracza; newsletter oznacza dostawcę (procesora), zgodę, double opt-in i zmianę polityki |
| SEO | `<title>`/`og:title` per język, bez `hreflang`, bez `canonical`, brak `404.html` | `hreflang` pl/en (+ fala 1), `canonical`, prosta 404 w stylu strony |

Rekomendacja: jeden PR **R7k** po decyzji o hostingu i adresach sklepów; bez newslettera (Q-70).
