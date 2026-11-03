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
- Przechowywanie: wpisy rankingu przez [do ustalenia, propozycja: 90 dni], potem usuwane.
- Firebase może przetwarzać adres IP i dane techniczne żądań (logi). Dostawca: Google Ireland Ltd. / Google LLC
  (możliwy transfer poza EOG — do opisania zgodnie z umową powierzenia Firebase).
- Bez reklam, śledzenia i analityki. Gra działa w pełni offline; wynik czeka w kolejce na urządzeniu, dopóki nie
  będzie połączenia.
- Usunięcie danych: [do ustalenia — propozycja: przycisk „Usuń mój wpis rankingu” w ustawieniach lub e-mail na
  contact@airway.games z widocznym znakiem wywoławczym].

## EN — proposed text

**Daily challenge leaderboards.** When leaderboards are enabled, finishing the official daily game sends to our server
(Google Firebase, region `europe-west1`, Belgium): the challenge date, the game rules version, your score and the
record of your moves in that game (a list of commands). The server replays the game from these moves to check the
score. Sending requires an anonymous Firebase Authentication account with a random identifier; you never provide a
name, e-mail or phone number. The leaderboard shows only a call sign derived from that identifier (e.g. `AW-7F3A`)
and the score. Purpose, retention, processors and deletion: as in the Polish text above (to be confirmed).

## Otwarte sprawy dla właściciela
1. Administrator danych (pełna nazwa i adres) i kontakt.
2. Okres przechowywania wpisów (propozycja 90 dni) i sposób usuwania na żądanie.
3. Czy Data Safety (Google Play) i App Privacy (App Store) mają deklarować „identyfikatory: User ID (anonimowy)”
   i „dane o grze”.
