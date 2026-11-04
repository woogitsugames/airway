# Firebase — rankingi online (D-66, D-72)

Rankingi są **wyłączone**, dopóki w buildzie nie ma konfiguracji `VITE_FIREBASE_API_KEY` i `VITE_FIREBASE_PROJECT_ID`.
Cały serwer działa lokalnie na emulatorze (`npm run test:firebase`), więc projekt Firebase jest potrzebny dopiero
przed wydaniem. Kod: klient `src/net/`, funkcje `functions/`, reguły `firestore.rules`, konfiguracja `firebase.json`.

## Jak to działa
- Gracz dostaje anonimowe konto (Firebase Authentication, REST, bez SDK w aplikacji).
- Po oficjalnej grze dnia klient wysyła dziennik poleceń do funkcji `submitDaily`. Funkcja odtwarza grę tym samym
  `Sim` co aplikacja (kod `src/net/submission.ts` jest wbudowany w paczkę funkcji) i zapisuje **wynik z powtórki**.
  Pierwsza przyjęta gra gracza danego dnia liczy się do rankingu dziennego i dodaje się do sumy tygodnia ISO.
- `getBoards` zwraca top 50 i miejsce gracza. Firestore jest dostępny tylko dla funkcji (reguły blokują klientów).
- Top 50 (D-108): każdy ranking trzyma swoją pierwszą pięćdziesiątkę w jednym dokumencie `boards/{id}/meta/top`
  (`entries`: lista `{uid, callSign, score}`, uid nigdy nie wychodzi z serwera). `submitDaily` aktualizuje go w tej
  samej transakcji co wpis (tylko gdy wynik zmienia listę) i zwraca `rank`, jeśli gracz jest w top 50. `getBoards`
  czyta 4 dokumenty (dwa `top` i dwa własne wpisy), a `count()` tylko dla gracza spoza top 50 — wcześniej dwa
  zapytania po 50 dokumentów (~105 odczytów na wywołanie). Ranking zapisany przed tą zmianą (bez `top`) jest przy
  pierwszym zapisie wypełniany starym zapytaniem; do tego czasu `getBoards` czyta go starym zapytaniem.
- Bez sieci wynik czeka w kolejce na urządzeniu (`aw-net-queue-v1`).
- Usunięcie z aplikacji (D-93, D-114): **Ustawienia → Pomoc → „Usuń moje dane rankingu”** (widoczne, gdy urządzenie
  ma anonimowe konto albo wynik w kolejce) → potwierdzenie → funkcja `deleteMyData`. Funkcja sprawdza wszystkie
  rankingi dzienne i tygodniowe z ostatnich 97 dni (90 dni retencji + wczorajszy ranking + zapas na opóźnienie TTL;
  ok. 113 rankingów, ~226 odczytów), usuwa wpisy gracza, wyjmuje go z dokumentów `meta/top` (pełne top 50 dopełnia
  51. wpisem) i na końcu usuwa anonimowe konto Auth. Drugie wywołanie nic nie znajduje i też kończy się sukcesem.
  Klient czyści token i kolejkę dopiero po odpowiedzi serwera; bez sieci mówi, że nic nie usunięto. Limit:
  3 wywołania na minutę na gracza, `maxInstances: 2`.
- Limit na gracza (D-109): każda instancja funkcji pozwala jednemu uid na 20 wywołań `getBoards` i 6 `submitDaily`
  na minutę (kubełek żetonów w pamięci, sprawdzany przed Firestore i powtórką). Ponad limit funkcja zwraca
  `resource-exhausted` (HTTP 429); klient traktuje to jak chwilowy błąd i wynik zostaje w kolejce.
- Retencja (D-77): każdy wpis ma pole `expireAt` = czas zapisu + 90 dni; polityka TTL Firestore na grupie kolekcji
  `entries` (w `firestore.indexes.json`) usuwa wpis po tym terminie (zwykle w ciągu doby). Dokument `meta/top`
  (D-108) ma `expireAt` z pierwszego zapisu, który się nie przedłuża, i własną politykę TTL na grupie `meta`, więc
  nigdy nie żyje dłużej niż wpisy, które kopiuje.

## Kroki właściciela (jednorazowo, ok. 30 min)
1. [console.firebase.google.com](https://console.firebase.google.com/) → **Add project**, np. `airway-prod`
   (ID projektu jest niezmienne). Google Analytics: **wyłącz** (nie używamy).
2. **Build → Firestore Database → Create database**, tryb produkcyjny, lokalizacja **`europe-west1` (Belgia)**.
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**.
4. **Usage and billing → Modify plan → Blaze** (funkcje 2. generacji wymagają rozliczeń). Potem budżet z alertami
   (D-234, *tylko właściciel — Q-07: kto jest właścicielem projektu i konta rozliczeniowego*):
   1. [console.cloud.google.com](https://console.cloud.google.com/) → menu ☰ → **Billing** → wybierz konto
      rozliczeniowe projektu → **Budgets & alerts** → **Create budget**.
   2. **Scope:** *Name* `airway-monthly`, *Time range* **Monthly**, *Projects* — zaznacz tylko projekt Airway
      (np. `airway-prod`), *Services* **All services**, *Credits* zostaw zaznaczone → **Next**.
   3. **Amount:** *Budget type* **Specified amount**, *Target amount* **10** (waluta konta rozliczeniowego; konto
      w EUR = 10 EUR, w innej walucie wpisz równowartość 10 EUR) → **Next**.
   4. **Actions → Alert threshold rules** — cztery wiersze (**Add threshold** dla kolejnych):
      | Percent of budget | Trigger on |
      |---|---|
      | 50 % | **Actual** |
      | 90 % | **Actual** |
      | 100 % | **Actual** |
      | 100 % | **Forecasted** |
   5. **Manage notifications:** zaznacz **Email alerts to billing admins and users** (adres właściciela musi być
      administratorem konta rozliczeniowego); jeśli alerty mają iść na inny adres, zaznacz też **Link Monitoring
      email notification channels to this budget** i dodaj kanał e-mail → **Finish**.
   6. Sprawdź listę budżetów: wiersz `airway-monthly`, kwota 10, cztery progi. Alert prognozy zaczyna działać po
      kilku dniach danych.

   Uwaga: budżet tylko powiadamia, nie blokuje wydatków — hamulcem jest parametr `LEADERBOARDS_PAUSED` (sekcja
   „Gdy przyjdzie alert”). Pułapy funkcji (D-109): `getBoards` `maxInstances: 3`, `submitDaily` `maxInstances: 5`
   i `concurrency: 4` (1 vCPU), plus limit na gracza w każdej instancji (20 `getBoards` i 6 `submitDaily` na minutę).
5. **Project settings → General → Your apps → Web (`</>`)**, nazwa „Airway”, bez Hostingu. Skopiuj `apiKey`
   i `projectId` (to nie są sekrety — trafiają do aplikacji).
6. Lokalnie w repo:
   ```bash
   npm ci
   npm install --prefix functions --package-lock=false --no-audit --no-fund
   cp .firebaserc.example .firebaserc        # wpisz ID projektu zamiast YOUR_FIREBASE_PROJECT_ID
   echo LEADERBOARDS_PAUSED=false > functions/.env.airway-prod   # nazwa = ID projektu; hamulec wyłączony (D-234), plik poza Gitem
   ./functions/node_modules/.bin/firebase login
   npm run test:firebase                      # emulator: musi skończyć się SUMMARY … failed=0
   ./functions/node_modules/.bin/firebase deploy --only firestore:rules,firestore:indexes,functions
   ```
7. W pliku `.env.production` (poza Gitem) wpisz:
   ```dotenv
   VITE_FIREBASE_API_KEY=…apiKey z kroku 5…
   VITE_FIREBASE_PROJECT_ID=airway-prod
   VITE_FIREBASE_REGION=europe-west1
   ```
   i zbuduj aplikację (`npm run build`, potem Android/iOS jak zwykle).
8. **TTL (D-77):** polecenie z kroku 6 (`firestore:indexes`) zakłada politykę TTL. Sprawdź w konsoli:
   **Firestore Database → Time-to-live (TTL)** — wiersz grupy kolekcji `entries`, pole `expireAt`, stan
   **Serving** (pierwsze włączenie może potrwać do kilkunastu minut), oraz drugi wiersz: grupa `meta`, pole
   `expireAt` (D-108). Jeśli wiersza brak, dodaj go ręcznie przyciskiem **Create policy** z tymi samymi nazwami.
9. **Usunięcie na żądanie (D-77, e-mail — ścieżka WWW dla Google; w aplikacji robi to przycisk, D-114):** w **Firestore Database → Data → Query** wybierz *Collection group*
   `entries`, warunek `callSign == AW-XXXX` (znak z wiadomości), i usuń znalezione dokumenty (dzienne i tygodniowe).
   Potem (D-108) w tych samych rankingach otwórz dokument `boards/{id}/meta/top` i z tablicy `entries` usuń element
   z tym znakiem (albo usuń cały dokument `top` — następny zapis odbuduje go z wpisów).
   Znak wywoławczy ma 4 znaki szesnastkowe, więc rzadko może pasować do dwóch graczy — przy kilku trafieniach
   w tym samym dniu poproś o wynik i datę gry. Odpowiedz w ciągu 30 dni.
10. Opcjonalnie później: **App Check** (Play Integrity / App Attest), żeby ograniczyć wywołania spoza aplikacji.
11. Przed wydaniem uzupełnij politykę prywatności (`docs/legal/leaderboards-privacy.md` → `site/privacy.html`)
   oraz Data Safety / App Privacy w sklepach.

## Gdy przyjdzie alert (D-234)
*Tylko właściciel (Q-07) albo osoba z dostępem do projektu i do `firebase deploy`.* Hamulec nie kasuje danych
i niczego nie wyłącza w aplikacji: gracze grają dalej, wynik gry dnia czeka w kolejce na urządzeniu.

1. **Skąd koszt.** Billing → **Reports** → filtr *Projects* = projekt Airway, *Group by* **SKU**: czy rosną odczyty
   Firestore (*Cloud Firestore Read Ops*), zapisy, czy CPU funkcji (*Cloud Run* / *Cloud Functions*).
2. **Firestore według kolekcji.** Firebase console → **Firestore Database → Usage**: odczyty, zapisy i usunięcia
   na dzień. Konsola nie dzieli ich na kolekcje, ale u nas każda kolekcja ma jedną funkcję, więc porównaj z
   **Functions → Dashboard** (wywołania na funkcję):
   - `boards/{id}/meta/top` i `boards/{id}/entries` przez `getBoards`: 4 odczyty na wywołanie (+1 `count()` dla
     gracza spoza top 50);
   - te same kolekcje przez `submitDaily`: 4 odczyty i do 4 zapisów na przyjętą grę (D-108);
   - `deleteMyData`: ok. 226 odczytów na wywołanie (rzadkie).
   Odczyty ≫ 4 × wywołania `getBoards` + 4 × `submitDaily` albo wywołania ≫ liczba graczy = błąd albo nadużycie.
   Logi: **Functions → Logs** (fale `resource-exhausted` to limit na gracza, D-109).
3. **Hamulec.** W repo, w pliku `functions/.env.<ID projektu>` (poza Gitem) ustaw:
   ```dotenv
   LEADERBOARDS_PAUSED=true
   ```
   i wdroż same funkcje:
   ```bash
   ./functions/node_modules/.bin/firebase deploy --only functions
   ```
   Od tej chwili `submitDaily` odpowiada `{ accepted: false, reason: 'paused' }`, a `getBoards` zwraca puste
   rankingi — obie bez dostępu do Firestore i bez powtórki gry. Aplikacja pokazuje przy wyniku istniejący stan
   „w kolejce” i ponawia wysyłkę później. `deleteMyData` działa dalej (prawo do usunięcia danych). Sprawdź w
   **Firestore Database → Usage**, że odczyty spadły do zera w ciągu kilkunastu minut.
4. **Zwolnienie hamulca** po usunięciu przyczyny (poprawka, App Check — R3e, niższe limity): ustaw
   `LEADERBOARDS_PAUSED=false` i ponownie `firebase deploy --only functions`. Gry z kolejki wysyłają się przy
   następnym uruchomieniu aplikacji; serwer przyjmuje tylko dzisiejszą i wczorajszą grę (D-66), starsze przepadają
   jako `wrong_day`.
5. **Ostateczność**, gdy koszt rośnie mimo hamulca (np. ruch spoza funkcji): Billing → **Account management** →
   przy projekcie **Disable billing**. Zatrzymuje wszystkie płatne usługi projektu (także `deleteMyData`); przed
   tym zapisz, co się dzieje, i włącz rozliczenia z powrotem najszybciej, jak to możliwe.

## Emulator (deweloperzy)
`npm install --prefix functions --package-lock=false` i Java 11+, potem `npm run test:firebase` — buduje funkcje,
uruchamia emulatory Auth/Functions/Firestore (projekt `demo-airway`, bez poświadczeń) i sprawdza: przyjęcie uczciwej
gry z dzisiejszym seedem, brak drugiego wpisu tego samego dnia, odrzucenie podrobionego wyniku, kolejność i miejsce
gracza, odmowę bez logowania oraz blokadę bezpośredniego dostępu do Firestore, a także `deleteMyData` (wpisy,
wiersz w `meta/top` i konto Auth znikają, drugie wywołanie nic nie robi).

Do gry w przeglądarce z emulatorem: `.env.local` z `VITE_FIREBASE_API_KEY=demo-key`,
`VITE_FIREBASE_PROJECT_ID=demo-airway`, `VITE_FIREBASE_FUNCTIONS_EMULATOR=127.0.0.1:5001`,
`VITE_FIREBASE_AUTH_EMULATOR=127.0.0.1:9099`, a w drugim terminalu
`./functions/node_modules/.bin/firebase emulators:start --project demo-airway --only auth,functions,firestore`.

Zrzuty ekranu rankingu z emulatora: `docs/shots/night-06/` (`scripts/shots-n6.mjs`, polecenie w nagłówku skryptu).
