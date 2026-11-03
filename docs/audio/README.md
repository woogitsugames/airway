# Podglądy dźwięku (N3, D-71)

Trzy 30-sekundowe nagrania prawdziwego silnika Web Audio gry (`src/audio/engine.ts`), wyrenderowane offline
w Chromium (`OfflineAudioContext`) przez `npm run audio:previews`. Mono, 22 050 Hz, 16 bit. Bez sampli: wszystko
jest syntezą z oscylatorów i generowanego szumu.

| Plik | Co słychać |
| --- | --- |
| `preview-1-calm-europe.wav` | Spokojny poranek w Europie: przyloty (trójkąt) i przesiadki (krótki sinus) w skalach EUN/EUS, rozkwit świtu nad Frankfurtem na początku, „tag” przy nowej trasie (6 s, 14,5 s, 22 s), dzwonek nowego miasta (18 s), pieczątka ulepszenia (26 s). |
| `preview-2-hub-tension.wav` | Frankfurt się zapełnia: dron węzła narasta od 60% do 100% obciążenia, dudnienie przyspiesza do ok. 6 Hz, cztery „tik-tak” czekania na slot (9, 15, 19, 22 s); w 25 s ulga — dron gaśnie. |
| `preview-3-week-turn.wav` | Sieć przez kilka regionów (każdy region ma własną odmianę tej samej skali pentatonicznej); w 11,5 s koniec tygodnia: kadencja dominanta → tonika i zmiana tonacji o kwintę, potem świt nad Tokio (19 s) i nowe miasto w Oceanii (24 s). |

Poziomy: szczyty ok. −7…−9 dBFS, RMS −26…−31 dBFS; w teście przeciążenia (160 przylotów w 2 s) limiter trzyma
szczyt poniżej −1 dBFS (`npm run test:audio-render`). Odsłuch na telefonie (głośnik i słuchawki) wciąż potrzebny.
