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
4. **Usage and billing → Modify plan → Blaze** (funkcje 2. generacji wymagają rozliczeń). W Google Cloud Billing ustaw
   budżet (propozycja 10 EUR/mies.) z alertami 50/90/100%. Uwaga: budżet tylko powiadamia, nie blokuje wydatków;
   pułapy funkcji (D-109): `getBoards` `maxInstances: 3`, `submitDaily` `maxInstances: 5` i `concurrency: 4`
   (1 vCPU), plus limit na gracza w każdej instancji (20 `getBoards` i 6 `submitDaily` na minutę).
5. **Project settings → General → Your apps → Web (`</>`)**, nazwa „Airway”, bez Hostingu. Skopiuj `apiKey`
   i `projectId` (to nie są sekrety — trafiają do aplikacji).
6. Lokalnie w repo:
   ```bash
   npm ci
   npm install --prefix functions --package-lock=false --no-audit --no-fund
   cp .firebaserc.example .firebaserc        # wpisz ID projektu zamiast YOUR_FIREBASE_PROJECT_ID
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
9. **Usunięcie na żądanie (D-77, e-mail):** w **Firestore Database → Data → Query** wybierz *Collection group*
   `entries`, warunek `callSign == AW-XXXX` (znak z wiadomości), i usuń znalezione dokumenty (dzienne i tygodniowe).
   Potem (D-108) w tych samych rankingach otwórz dokument `boards/{id}/meta/top` i z tablicy `entries` usuń element
   z tym znakiem (albo usuń cały dokument `top` — następny zapis odbuduje go z wpisów).
   Znak wywoławczy ma 4 znaki szesnastkowe, więc rzadko może pasować do dwóch graczy — przy kilku trafieniach
   w tym samym dniu poproś o wynik i datę gry. Odpowiedz w ciągu 30 dni.
10. Opcjonalnie później: **App Check** (Play Integrity / App Attest), żeby ograniczyć wywołania spoza aplikacji.
11. Przed wydaniem uzupełnij politykę prywatności (`docs/legal/leaderboards-privacy.md` → `site/privacy.html`)
   oraz Data Safety / App Privacy w sklepach.

## Emulator (deweloperzy)
`npm install --prefix functions --package-lock=false` i Java 11+, potem `npm run test:firebase` — buduje funkcje,
uruchamia emulatory Auth/Functions/Firestore (projekt `demo-airway`, bez poświadczeń) i sprawdza: przyjęcie uczciwej
gry z dzisiejszym seedem, brak drugiego wpisu tego samego dnia, odrzucenie podrobionego wyniku, kolejność i miejsce
gracza, odmowę bez logowania oraz blokadę bezpośredniego dostępu do Firestore.

Do gry w przeglądarce z emulatorem: `.env.local` z `VITE_FIREBASE_API_KEY=demo-key`,
`VITE_FIREBASE_PROJECT_ID=demo-airway`, `VITE_FIREBASE_FUNCTIONS_EMULATOR=127.0.0.1:5001`,
`VITE_FIREBASE_AUTH_EMULATOR=127.0.0.1:9099`, a w drugim terminalu
`./functions/node_modules/.bin/firebase emulators:start --project demo-airway --only auth,functions,firestore`.

Zrzuty ekranu rankingu z emulatora: `docs/shots/night-06/` (`scripts/shots-n6.mjs`, polecenie w nagłówku skryptu).
