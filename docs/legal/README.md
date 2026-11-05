# Rejestr prawny na premierę (R7d)

> **Do weryfikacji z prawnikiem.** To nie jest porada prawna ani gotowy dokument dla urzędu. To zebrane fakty
> z kodu i dokumentacji repo oraz lista terminów ze źródłami z RESEARCH „R7 — Pakiet prawny i prywatności na
> premierę” (stan 2026-11-03). Całość — razem z polityką prywatności (R7a) i regulaminem (R7b) — idzie na jedną
> konsultację prawną (D-134, D-136). Pilnuje go `npm run test:legal-register` (sekcje, odwołania `D-`/`Q-`, daty,
> zgodność rejestru z `docs/store/privacy-declarations.md` i z kodem).

Pliki w tym katalogu:
- `README.md` — ten rejestr (art. 30 RODO, deklaracje, terminy).
- `leaderboards-privacy.md` — szkic sekcji rankingów do polityki prywatności (Q-56).

Kolumna „Kto”: **właściciel** = podpis, konsola, konto, decyzja; `agent` = tekst i kod w repo.

## 1. Rejestr czynności przetwarzania (art. 30 RODO)

Dlaczego jest potrzebny: zwolnienie firm poniżej 250 osób nie dotyczy przetwarzania, które nie jest sporadyczne,
a ranking działa codziennie (RESEARCH R7). Rejestr opisuje build **B** (z rankingami, D-66); build **A** (bez
konfiguracji Firebase) nie wysyła żadnych danych (D-220). Do weryfikacji z prawnikiem.

<!-- legal:controller -->
| Pole | Wartość |
|---|---|
| Administrator (nazwa, adres) | [Q-01 — do uzupełnienia przez właściciela] |
| Kontakt w sprawie danych | [Q-01 — do uzupełnienia; propozycja `contact@airway.games`, skrzynka jeszcze nie działa] |
| Przedstawiciel w UK (art. 27 UK GDPR) | [Q-67 — decyzja po konsultacji, D-136; sekcja 4] |
| Inspektor ochrony danych (art. 37) | nie wyznaczono — przy tej skali prawdopodobnie niewymagany (do weryfikacji z prawnikiem) |
| Podmiot przetwarzający | Google (Firebase / Google Cloud) na warunkach Firebase Data Processing and Security Terms (sekcja 2) |
| Data rejestru | 2026-11-04 (wersja robocza; aktualizować przy każdej zmianie przepływu danych) |
<!-- /legal:controller -->

<!-- legal:ropa -->
| ID | Czynność | Cel | Podstawa prawna | Osoby | Kategorie danych | Odbiorcy | Transfer poza EOG | Okres przechowywania | Zabezpieczenia | Źródło |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | Ranking wyzwania dnia | prowadzenie rankingu dziennego i tygodniowego | art. 6 ust. 1 lit. f — uzasadniony interes, z prawem sprzeciwu (D-135; przełącznik D-186) | gracze, którzy rozegrali oficjalną grę dnia w buildzie B z włączonym wysyłaniem wyników | anonimowy uid, znak wywoławczy `callSign`; wynik `score`, `weeks`, `days`, skrót gry `hash`, czas `at`, termin `expireAt`; kopia top 50 `entries` (`uid`, `callSign`, `score`) | Google jako podmiot przetwarzający; inni gracze widzą tylko znak wywoławczy i wynik | Firestore w `europe-west1` (Belgia); dostęp Google LLC możliwy — EU-US Data Privacy Framework / SCC wg warunków Firebase | 90 dni od ostatniego zapisu, TTL Firestore (D-77) | HTTPS; Firestore tylko dla funkcji (reguły blokują klientów); uid nie wychodzi z serwera; limity na gracza (D-109) | `submitDaily`, `getBoards`; `functions/src/`, `docs/FIREBASE.md` |
| P2 | Sprawdzenie wyniku (ochrona przed oszustwami) | serwer odtwarza grę z dziennika ruchów i zapisuje tylko wynik z powtórki | art. 6 ust. 1 lit. f (D-135) | jak P1 | data, seed, wersja zasad, `endTick`, deklarowany wynik, dziennik poleceń gry (bez danych osobowych poza powiązaniem z uid) | Google jako podmiot przetwarzający | jak P1 | dziennik nie jest zapisywany — tylko w pamięci funkcji na czas powtórki | jak P1; walidacja i limit dziennika (D-72) | `submitDaily`; `docs/store/privacy-declarations.md` |
| P3 | Anonimowe konto Firebase Authentication | wysłanie wyniku bez imienia, e-maila i telefonu | art. 6 ust. 1 lit. f (D-135) | jak P1 | losowy uid, czas utworzenia i ostatniego logowania, token odświeżania; adres IP w logach Auth | Google jako podmiot przetwarzający | jak P1 | konto do usunięcia przez gracza; potem do 180 dni w kopiach zapasowych Google; IP w logach Auth — kilka tygodni (wg Firebase, do weryfikacji) | token ID ważny 1 h; bez SDK, tylko REST (D-72) | `accounts:signUp`, `token`; `src/net/` |
| P4 | Usunięcie danych na żądanie | realizacja prawa do usunięcia (art. 17) | art. 6 ust. 1 lit. c — obowiązek prawny | gracze, którzy proszą o usunięcie | w aplikacji: uid; e-mailem: adres e-mail nadawcy i znak wywoławczy | Google jako podmiot przetwarzający; dostawca poczty (do wyboru, Q-01) | jak P1; poczta — zależnie od dostawcy | w aplikacji od razu (D-114); e-mail: odpowiedź do 30 dni (D-77); korespondencję trzymać [do ustalenia z prawnikiem — propozycja 12 miesięcy] | potwierdzenie w aplikacji; limit 3 wywołania na minutę | `deleteMyData`; `docs/FIREBASE.md` krok 9 (D-93, D-114) |
| P5 | Logi żądań Cloud Functions (Cloud Run) | bezpieczeństwo i diagnoza błędów | art. 6 ust. 1 lit. f (do weryfikacji z prawnikiem) | jak P1 | adres IP, user agent, czas i ścieżka żądania (domyślne logi Google Cloud; nie czytamy ich i nie łączymy) | Google jako podmiot przetwarzający | jak P1 | domyślna retencja Cloud Logging [do sprawdzenia przy zakładaniu projektu, Q-07 — NIEPEWNE] | dostęp tylko dla właściciela projektu | otwarty punkt 4 w `docs/store/privacy-declarations.md` (D-220) |
| P6 | Korespondencja na adres kontaktowy | odpowiedzi graczom, prasie i twórcom | art. 6 ust. 1 lit. f | osoby piszące do nas | adres e-mail, treść wiadomości | dostawca poczty (do wyboru, Q-01) | zależnie od dostawcy | [do ustalenia z prawnikiem] | konto pocztowe z 2FA | `site/press.html` (D-219) |
| P7 | Logi hostingu strony airway.games | działanie i bezpieczeństwo strony | art. 6 ust. 1 lit. f | odwiedzający stronę | adres IP, user agent, adres strony, czas | dostawca hostingu (Cloudflare Pages albo GitHub Pages — nie wybrano, `docs/SITE.md`) | zależnie od dostawcy (DPF / SCC) | zależnie od dostawcy [wpisać po wyborze hostingu] | strona statyczna, bez formularzy, ciasteczek i analityki (D-136) | `docs/SITE.md`; strona nieopublikowana (D-67) |
<!-- /legal:ropa -->

**Czego nie przetwarzamy** (D-16, D-220): reklam, analityki, zakupów, lokalizacji, kontaktów, identyfikatora
reklamowego. Udostępnianie wyniku i „Kopiuj podsumowanie” dziennika (D-227, D-231) przekazują tekst tylko do schowka
lub systemowego okna udostępniania na prośbę gracza — nic nie trafia na nasze serwery. Dziennik gier i zapis gry
zostają na urządzeniu.

Środki bezpieczeństwa wspólne (art. 32, do weryfikacji z prawnikiem): szyfrowanie w transmisji (HTTPS), brak
bezpośredniego dostępu klientów do bazy, dostęp do konsoli tylko dla właściciela z 2FA, budżet z alertami i hamulec
`LEADERBOARDS_PAUSED` (D-234), automatyczne usuwanie po 90 dniach (D-77).

## 2. Akceptacja warunków przetwarzania Firebase

Google działa jako podmiot przetwarzający na warunkach **Firebase Data Processing and Security Terms**; te warunki
trzeba **zaakceptować w konsoli** (art. 28 RODO — umowa powierzenia). Kroki: `docs/FIREBASE.md`, krok 1 („Warunki przetwarzania danych”). Do
weryfikacji z prawnikiem.

<!-- legal:firebase-terms -->
| Krok | Kto | Kiedy | Data wykonania | Odniesienia |
|---|---|---|---|---|
| Zaakceptować Firebase Data Processing and Security Terms w konsoli projektu | **właściciel** | przy zakładaniu projektu, przed testem zamkniętym z rankingami | [RRRR-MM-DD — wpisać po akceptacji] | Q-07, D-66 |
| Wpisać dane kontaktowe administratora (i przedstawiciela w UK, jeśli będzie) w ustawieniach prywatności projektu | **właściciel** | razem z akceptacją | [RRRR-MM-DD] | Q-01, Q-67 |
| Zapisać PDF zaakceptowanej wersji warunków poza repo | **właściciel** | razem z akceptacją | [RRRR-MM-DD] | Q-07 |
<!-- /legal:firebase-terms -->

## 3. Deklaracje przedsiębiorcy (trader)

Decyzja: **trader** w obu sklepach, dane firmy z Q-01 — adres i telefon firmowe, nie prywatne (D-134, Q-66 → A).
Do weryfikacji z prawnikiem.

<!-- legal:trader -->
| Sklep | Co | Termin | Data złożenia | Kto | Odniesienia |
|---|---|---|---|---|---|
| Google Play | nowe konto deklaruje status przy zakładaniu konta organizacji | przy zakładaniu konta (istniejące konta: do 01.02.2027) | [RRRR-MM-DD] | **właściciel** | D-134, D-94, Q-01 |
| Google Play | karta tradera widoczna w sklepie: nazwa, adres, telefon, e-mail, D-U-N-S, link do regulaminu; w EOG/UK nazwa zamiast „Google” w „Oferowane przez” | od 01.03.2027 | — (wyświetla Google) | **właściciel** | D-134, Q-65 |
| App Store | deklaracja trader w App Store Connect (adres, telefon, e-mail na stronie produktu w UE) | przed pierwszym zgłoszeniem w UE (bez deklaracji aplikacje zdjęto z UE od 17.02.2025) | [RRRR-MM-DD] | **właściciel** | D-134, Q-01 |
| Strona i gra | blok „kto wydaje grę” (ustawa o świadczeniu usług drogą elektroniczną, art. 5) i regulamin (art. 8) | przed publikacją strony i przedrejestracją | [RRRR-MM-DD] | właściciel + agent | D-134, D-67, Q-65 |
<!-- /legal:trader -->

Fałszywa deklaracja „non-trader” grozi zawieszeniem konta Google; non-trader kłóci się z kontem organizacji (D-94)
i modelem biznesowym (D-16).

## 4. Przedstawiciel w Wielkiej Brytanii (art. 27 UK GDPR)

Decyzja właściciela: Q-67 → A (D-136) — **zapytać prawnika** w tej samej konsultacji co regulamin; jeśli
przedstawiciel jest potrzebny, wyznaczyć go (usługa płatna, roczna). Codzienny ranking raczej nie jest
„sporadyczny”, więc przedstawiciel jest prawdopodobny (NIEPEWNE). Do weryfikacji z prawnikiem.

<!-- legal:uk -->
| Pole | Wartość |
|---|---|
| Stan | czeka na konsultację (D-136) |
| Wynik konsultacji | [do wpisania: potrzebny / niepotrzebny + data] |
| Przedstawiciel (nazwa, adres) | [do wpisania, jeśli potrzebny] |
| Do zrobienia potem | wpisać przedstawiciela w polityce prywatności (R7a), w sekcji 1 i w ustawieniach prywatności Firebase |
| Wariant zapasowy | Q-67 B: rankingi wyłączone dla graczy w UK (wymaga zmiany kodu i deklaracji) |
<!-- /legal:uk -->

## 5. USA — stanowe ustawy o wieku w sklepach (sprawdzić przed premierą w USA)

Obowiązki deweloperów to głównie respektowanie sygnału wieku ze sklepu (Apple: Declared Age Range API) i zgód
rodzica przy istotnych zmianach aplikacji. Dla gry 13+ bez zakupów, czatu i treści wrażliwych **prawdopodobnie** nic
do kodu (NIEPEWNE). Każdy wiersz sprawdzić ponownie **przed premierą w USA**. Do weryfikacji z prawnikiem.

<!-- legal:us-age -->
| Stan / przepis | Wejście w życie | Stan na 2026-11-03 | Co sprawdzić przed premierą w USA | Odniesienia |
|---|---|---|---|---|
| Teksas — App Store Accountability Act | w mocy od 28.05.2026 (5. Okręg wstrzymał nakaz) | obowiązuje | czy gra musi czytać sygnał wieku i co przy aktualizacjach | D-96 |
| Luizjana | 01.07.2026 | obowiązuje | jak Teksas | D-96 |
| Alabama | 01.01.2027 | przed wejściem w życie | jak Teksas | D-96 |
| Utah | 06.05.2027 (obowiązki przesunięte) | przed wejściem w życie | jak Teksas | D-96 |
| COPPA (federalnie, zmieniona reguła) | pełna zgodność od 22.04.2026 | obowiązuje | grupa docelowa 13+, nie kierować ASO do dzieci; „dla całej rodziny” oznaczałoby bramkę wieku przed rankingiem | D-135 |
<!-- /legal:us-age -->

## 6. Inne punkty przed premierą

| Punkt | Kto | Stan | Odniesienia |
|---|---|---|---|
| Polityka prywatności v1 (strona + gra, sekcja rankingów, IP w logach Auth, 180 dni kopii, DPF, UODO) | właściciel + agent | backlog R7a; czeka na Q-01 | Q-01, Q-56, D-86, D-135 |
| Regulamin PL/EN + EULA Apple | właściciel + agent | backlog R7b | D-134, Q-65 |
| Dane wydawcy w grze i na stronie | właściciel + agent | blok `publisher.*` gotowy (R7c, D-241): stopka i `privacy.html#publisher`, Ustawienia → Pomoc, tabela w `docs/store/README.md`; pola z Q-01 to znaczniki „[Q-01 …]”, których build wydania nie przepuści | D-241, D-134, Q-66, Q-01 |
| Przełącznik „Wysyłaj wyniki do rankingu” (sprzeciw, art. 21) | agent | warstwa sieci gotowa (D-186), przełącznik w ustawieniach — backlog R7l | D-135, D-186 |
| Deklaracje Data safety / App Privacy | właściciel + agent | gotowe (`docs/store/privacy-declarations.md`) | D-220, D-224, Q-03 |
| Skrzynka kontaktowa działa (polityka, usuwanie, karta tradera, Data safety) | **właściciel** | otwarte | Q-01, D-77 |
| Znak towarowy „Airway” | **właściciel** | otwarte | Q-34 |

## 7. Pytania do prawnika (jedna konsultacja)

1. Czy rejestr z sekcji 1 jest kompletny (czynności, podstawy, okresy) i czy uzasadniony interes wystarcza dla
   rankingu i ochrony przed oszustwami (D-135)?
2. Logi żądań Cloud Run (IP, user agent): deklarować w polityce i w sklepach, skrócić czy wyłączyć (D-220)?
3. Czy publiczny znak wywoławczy `AW-xxxx` przy wyniku wymaga osobnej informacji w polityce?
4. Przedstawiciel w UK (Q-67, D-136): potrzebny przy codziennym rankingu?
5. Ile trzymać korespondencję o usunięciu danych i ogólną (P4, P6)?
6. Regulamin (D-134) i dane usługodawcy (art. 5 i 8 ustawy o świadczeniu usług drogą elektroniczną) — czy nowelizacja
   pod DSA coś zmienia?
7. USA: czy ustawy stanowe z sekcji 5 nakładają coś na grę 13+ bez zakupów przed premierą w USA?
