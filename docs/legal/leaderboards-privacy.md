# Rankingi online — szkic uzupełnienia polityki prywatności (D-66, D-72)

**Status: SZKIC do sprawdzenia przez właściciela / prawnika. Nie publikować przed decyzją.** Tekst ma trafić do
`site/privacy.html` (PL i EN) dopiero wtedy, gdy rankingi zostaną włączone w wydaniu.

## PL — proponowany tekst

**Rankingi wyzwania dnia.** Jeśli rankingi są włączone, po zakończeniu oficjalnej gry dnia aplikacja wysyła na nasz
serwer (Google Firebase, region `europe-west1`, Belgia): datę wyzwania, numer wersji zasad gry, wynik oraz zapis
Twoich ruchów w tej grze (lista poleceń, np. „dodaj trasę Warszawa–Berlin w minucie 312”). Serwer odtwarza grę z tych
ruchów, aby sprawdzić wynik. Do wysłania potrzebne jest anonimowe konto Firebase Authentication: dostaje ono losowy
identyfikator, nie podajesz imienia, e-maila ani numeru telefonu. W rankingu widać tylko znak wywoławczy wyliczony
z tego identyfikatora (np. `AW-7F3A`) i wynik.

- Cel: prowadzenie rankingu dziennego i tygodniowego oraz ochrona przed oszustwami (podstawa: wykonanie usługi,
  o którą prosisz, uruchamiając oficjalną grę dnia; do potwierdzenia przez prawnika).
- Przechowywanie: każdy wpis rankingu jest automatycznie usuwany 90 dni po ostatnim zapisie (D-77; wpis tygodniowy
  odnawia każda przyjęta gra tego tygodnia). Usunięcie następuje zwykle w ciągu doby po upływie terminu.
- Firebase może przetwarzać adres IP i dane techniczne żądań (logi). Dostawca: Google Ireland Ltd. / Google LLC
  (możliwy transfer poza EOG — do opisania zgodnie z umową powierzenia Firebase).
- Bez reklam, śledzenia i analityki. Gra działa w pełni offline; wynik czeka w kolejce na urządzeniu, dopóki nie
  będzie połączenia.
- Usunięcie danych wcześniej: napisz na [adres e-mail administratora — do uzupełnienia, propozycja
  contact@airway.games] i podaj swój znak wywoławczy (np. `AW-7F3A`, widoczny w rankingu). Usuniemy wpisy z tym
  znakiem w ciągu 30 dni (D-77). Albo w grze: **Ustawienia → Pomoc → „Usuń moje dane rankingu”** (D-93, D-114)
  — od razu usuwa Twoje wpisy dzienne i tygodniowe oraz anonimowe konto; wymaga połączenia z siecią.

## EN — proposed text

**Daily challenge leaderboards.** When leaderboards are enabled, finishing the official daily game sends to our server
(Google Firebase, region `europe-west1`, Belgium): the challenge date, the game rules version, your score and the
record of your moves in that game (a list of commands). The server replays the game from these moves to check the
score. Sending requires an anonymous Firebase Authentication account with a random identifier; you never provide a
name, e-mail or phone number. The leaderboard shows only a call sign derived from that identifier (e.g. `AW-7F3A`)
and the score.

- Retention: every leaderboard entry is deleted automatically 90 days after its last write (a weekly entry is
  refreshed by each accepted game of that week); deletion usually happens within a day after that date (D-77).
- Earlier deletion: e-mail [controller's address — to be filled in, proposal contact@airway.games] with your call
  sign (e.g. `AW-7F3A`, shown on the leaderboard); we delete the entries with that call sign within 30 days. Or in
  the game: **Settings → Help → "Delete my ranking data"** (D-93, D-114) deletes your daily and weekly entries and
  the anonymous account at once; it needs a connection.
- Purpose and processors: as in the Polish text above (to be confirmed).

## Otwarte sprawy dla właściciela
1. Administrator danych (pełna nazwa i adres) i kontakt.
2. ~~Okres przechowywania i usuwanie na żądanie~~ — rozstrzygnięte w D-77 (90 dni, e-mail). Do uzupełnienia tylko
   adres e-mail administratora (pkt 1).
3. Czy Data Safety (Google Play) i App Privacy (App Store) mają deklarować „identyfikatory: User ID (anonimowy)”
   i „dane o grze”. Gotowe odpowiedzi do formularzy obu sklepów (zgodne z kodem, test `test:privacy-declarations`):
   `docs/store/privacy-declarations.md` (R1f, D-219) — czekają na potwierdzenie Q-03.
