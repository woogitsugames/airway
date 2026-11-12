# Audyt zależności i licencji — 8 listopada 2026

Stan: 8.11.2026 około 20:43 CET; baza `origin/dev` `316d556686f2579cb8d4ba1fa785915c442af803`. To techniczna inwentaryzacja do weryfikacji przed wydaniem, nie opinia prawna. Nie aktualizowano zależności ani lockfile.

## Wynik i granice

- `npm audit --omit=dev --json` w katalogu głównym, z dostępem do rejestru: **0 zgłoszeń** (0 info, low, moderate, high i critical). npm podaje `prod=11`, w tym projekt główny; poniżej 10 unikalnych zainstalowanych pakietów. Jest to stan znanych zgłoszeń i drzewa tego lockfile w chwili badania, a nie dowód bezpieczeństwa aplikacji.
- `npm ci` i dodatkowy pełny `npm audit` zgłosiły **7 podatnych węzłów** w drzewie obejmującym dev: 1 moderate i 6 high. Nie utożsamiać tego wyniku z zerem dla produkcyjnego drzewa npm; ryzyka w narzędziach budowania także wymagają osobnej oceny.
- `functions/package.json` zawiera bezpośrednie produkcyjne `firebase-admin@13.4.0` i `firebase-functions@6.4.0`. Repo nie śledzi dla `functions/` lockfile: `npm audit --omit=dev` w tym katalogu zakończył się `ENOLOCK`. Nie ustalono pełnego rozwiązanego drzewa, licencji przechodnich ani stanu podatności backendu; nie tworzono lockfile. Potrzebna osobna, powtarzalna inwentaryzacja wersji faktycznie wdrożonych i ich audyt.
- Android `android/app/build.gradle` ma także zależności AndroidX i moduły natywne, a `ios/App/Podfile` — CocoaPods. Nie zbadano ich rozwiązanego grafu, licencji ani podatności, jak również rzeczywistej zawartości binarnych APK/AAB/IPA, serwera lub docelowego wdrożenia. Graficzne zasoby, fonty, obrazy i ich szczególne warunki pozostają osobnym zakresem `docs/ASSETS.md`.

## Produkcyjne pakiety npm z głównego lockfile

Stan wersji z `package-lock.json`; pole `license` oraz obecność pliku licencji sprawdzono w zainstalowanym pakiecie po `npm ci`. „Bezpośrednia” oznacza wpis w głównym `dependencies`; nie dowodzi, że każdy bajt pakietu trafia do każdego produktu.

| Pakiet | Wersja | Droga | Deklarowana licencja | Plik w pakiecie |
|---|---:|---|---|---|
| `@capacitor/android` | 8.5.3 | bezpośrednia | MIT | `LICENSE` |
| `@capacitor/core` | 8.5.3 | bezpośrednia | MIT | `LICENSE` |
| `@capacitor/filesystem` | 8.1.5 | bezpośrednia | MIT | `LICENSE` |
| `@capacitor/haptics` | 8.0.2 | bezpośrednia | MIT | `LICENSE` |
| `@capacitor/ios` | 8.5.3 | bezpośrednia | MIT | `LICENSE` |
| `@capacitor/preferences` | 8.0.1 | bezpośrednia | MIT | `LICENSE` |
| `@capacitor/share` | 8.0.1 | bezpośrednia | MIT | `LICENSE` |
| `three` | 0.170.0 | bezpośrednia | MIT | `LICENSE` |
| `@capacitor/synapse` | 1.0.4 | przechodnia przez filesystem | ISC | `LICENSE.md` |
| `tslib` | 2.8.1 | przechodnia przez core | 0BSD | `LICENSE.txt` |

Wszystkie pliki licencji są obecne w `node_modules`, lecz nie sprawdzono, czy informacje i teksty licencji są zachowane w każdym rozpowszechnianym artefakcie natywnym i webowym. Sama wartość pola `license` nie zastępuje przeglądu pełnej treści licencji, wyjątków i warunków dystrybucji.

## Porównanie z rejestrem

- `docs/ASSETS.md` § „Libraries (dev only, mockups)” wymienia `three` 0.170 jako MIT w sekcji opisanej jako wyłącznie developerska; równocześnie `package.json` wymienia `three` jako zależność produkcyjną, a `src/render/` ją wykorzystuje. Rekomendacja: przy najbliższym przeglądzie rejestru wyraźnie dopisać jej produkcyjne użycie i rozdzielić mockupy od wydania.
- Ustawienia (`src/ui/settings/settings.ts`, tablica `ASSETS`) wymieniają `three` jako MIT, ale nie wymieniają pakietów Capacitor, `@capacitor/synapse` ani `tslib`. To stwierdzenie zakresu listy, nie rozstrzygnięcie spełnienia warunków licencji: zbadać zawartość i wymagane noty każdego finalnego artefaktu.
- `docs/legal/README.md` dotyczy głównie rejestru przetwarzania i obowiązków przed premierą, nie jest pełnym spisem licencji zależności. `npm run test:legal-register`: 21/21 PASS, obejmuje m.in. strukturę rejestru, odwołania i zgodność deklarowanych przepływów danych; **nie audytuje licencji, zależności ani obecności not w artefaktach**.

## Pozostałe znaleziska i zalecenia

| Priorytet | Znalezisko | Działanie |
|---|---|---|
| P1 | Backend bez śledzonego lockfile i bez wyniku audytu drzewa. | Ustalić wersje faktycznie wdrożone, sporządzić pełne SBOM i audyt, następnie przyjąć kontrolowaną strategię lockfile i ponowić analizę. |
| P1 | Stan not i licencji w rzeczywistych artefaktach nieznany. | Wygenerować inwentarz pakietów dla web, Android, iOS i backendu, sprawdzić treści licencji i noty w konkretnych wydaniach z osobą odpowiedzialną za zgodność. |
| P2 | Pełny audyt npm zgłasza 7 węzłów: `fflate` moderate; `nanoid`, `picomatch`, `postcss`, `rollup`, `source-map-js`, `vite` high. | Ocenić ścieżki wykorzystania narzędzi deweloperskich i sprawdzone wersje napraw w osobnym zadaniu; nie uruchamiać automatycznej aktualizacji w tym audycie. Podstawą są zgłoszenia rejestru npm na czas badania, nie ocena eksploatowalności tej aplikacji. |
| P2 | `docs/ASSETS.md` opisuje `three` w sekcji dev-only mimo produkcyjnego wpisu. | Doprecyzować zakres sekcji i po zakończeniu inwentaryzacji odnotować odpowiednie pakiety, licencje i sposób spełnienia warunków w dokumentacji wydania. |

Przykładowe zgłoszenia związane z pełnym audytem: [fflate](https://github.com/advisories/GHSA-px8p-9vwx-vf98), [nanoid](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [picomatch](https://github.com/advisories/GHSA-3v7f-55p6-f55p), [postcss](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [rollup](https://github.com/advisories/GHSA-mw96-cpmx-2vgc), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [vite](https://github.com/advisories/GHSA-93m4-6634-74q7). Lista linków jest przykładowa; pełny wynik zawiera także inne advisory dla części pakietów.

## Kontrole

`npm ci`: PASS; `npm run test:fast`: 119/119 PASS; `npm run build`: PASS; `npm run test:doc-ids`: 23/23 PASS; `npm run test:legal-register`: 21/21 PASS. Wszystkie na wskazanym bazowym drzewie; raport nie zmienia wykonywalnego kodu ani manifestów.
