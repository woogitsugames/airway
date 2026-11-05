// [night-11am] R7a, D-243: the privacy policy v1 (site/i18n.js privacy.*, copied into the game by test:privacy-text)
// says what the code and the legal register say. It has the RESEARCH R7 structure in order and keeps the draft
// banner; every activity of the art. 30 record (docs/legal/README.md) has a purpose line with the same GDPR art. 6
// point; every endpoint and stored field of docs/store/privacy-declarations.md is described in plain words (a new data
// flow fails until the policy names it); retention numbers equal RETENTION_DAYS and the register (180-day backups,
// 30-day e-mail deletion); the in-game switches it names are the game's real labels.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';
import { translations } from '../site/i18n.js';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
type Lang = 'pl' | 'en';
const LANGS: Lang[] = ['pl', 'en'];
const site = translations as Record<Lang, Record<string, string>>;
const game: Record<Lang, Record<string, string>> = { pl, en };
const sectionCount = Object.keys(site.pl).filter((key) => /^privacy\.s\d+\.title$/.test(key)).length;
const body = (lang: Lang, n: number): string => site[lang][`privacy.s${n}.body`] ?? '';
const all = (lang: Lang): string => Array.from({ length: sectionCount }, (_, i) => body(lang, i + 1)).join('\n');

/** Body rows of the table between `<!-- name -->` markers (same reader as test-legal-register.mjs). */
function tableRows(text: string, name: string): string[][] {
  const match = text.match(new RegExp(`<!-- ${name} -->([\\s\\S]*?)<!-- /${name} -->`));
  assert.ok(match, `table ${name}`);
  return match[1]!.trim().split('\n').filter((line) => line.startsWith('|')).slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}
const ticks = (text: string): string[] => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
const register = read('docs/legal/README.md');
const declarations = read('docs/store/privacy-declarations.md');

// Section topics in the order of RESEARCH R7 "Luki w tekście polityki" (title words, PL / EN).
const TOPICS: Array<[string, RegExp, RegExp]> = [
  ['controller', /odpowiada/, /responsible/], ['summary', /skrócie/, /short/], ['device', /urządzeniu/, /device/],
  ['leaderboard', /Ranking/, /leaderboard/], ['purposes and legal bases', /podstawy prawne/, /legal bases/],
  ['recipients', /Odbiorcy/, /Recipients/], ['transfers', /poza EOG/, /outside the EEA/],
  ['retention', /Jak długo/, /How long/], ['rights', /prawa/, /rights/], ['age', /Wiek/, /Age/],
  ['profiling', /Profilowanie/, /Profiling/], ['website', /airway\.games/, /airway\.games/],
  ['security', /Bezpieczeństwo/, /Security/], ['changes and date', /Zmiany/, /Changes/],
];
test(`structure: ${TOPICS.length} sections in the R7 order, PL and EN`, () => {
  assert.equal(sectionCount, TOPICS.length);
  TOPICS.forEach(([name, plTitle, enTitle], i) => {
    assert.match(site.pl[`privacy.s${i + 1}.title`] ?? '', plTitle, `pl s${i + 1} ${name}`);
    assert.match(site.en[`privacy.s${i + 1}.title`] ?? '', enTitle, `en s${i + 1} ${name}`);
    assert.ok(body('pl', i + 1) && body('en', i + 1), `s${i + 1} body`);
  });
});
test('draft banner: to verify with a lawyer, not legal advice; versioned date with an effective date', () => {
  assert.match(site.pl['privacy.warning'] ?? '', /do weryfikacji z prawnikiem/);
  assert.match(site.pl['privacy.warning'] ?? '', /porada prawna/);
  assert.match(site.en['privacy.warning'] ?? '', /to be verified with a lawyer/);
  assert.match(site.en['privacy.warning'] ?? '', /legal advice/);
  assert.match(site.pl['privacy.date'] ?? '', /Data wejścia w życie/);
  assert.match(site.en['privacy.date'] ?? '', /Effective date/);
});
test('the old "no transfer to our servers" claim is gone (wrong for the leaderboard build)', () => {
  assert.doesNotMatch(all('pl'), /bez .*przekazywania danych osobowych do naszych serwerów/);
  assert.doesNotMatch(all('en'), /without .*transfer of personal information to our own servers/);
});
test('controller and UK representative follow the register (Q-01 / Q-67 placeholders while open)', () => {
  const controller = Object.fromEntries(tableRows(register, 'legal:controller').map((row) => [row[0], row[1]]));
  const uk = Object.fromEntries(tableRows(register, 'legal:uk').map((row) => [row[0], row[1]]));
  for (const lang of LANGS) {
    if (/^\[Q-01/.test(controller['Administrator (nazwa, adres)'] ?? '')) assert.match(body(lang, 1), /\[Q-01:/, lang);
    if (/^\[/.test(uk['Wynik konsultacji'] ?? '')) assert.match(body(lang, 1), /\[Q-67:/, lang);
  }
});

// Art. 30 record → one purpose line in section 5 with the same art. 6 point (same line order in PL and EN).
const PURPOSES: Record<string, [RegExp, RegExp]> = {
  P1: [/rankingu dziennego/, /daily and weekly leaderboards/], P2: [/oszustw/, /cheating/],
  P3: [/Anonimowe konto/, /anonymous account/], P4: [/Usunięcie danych/, /Deleting data/],
  P5: [/logi żądań/, /request logs/], P6: [/e-mail/, /e-mails/], P7: [/logi hostingu/, /hosting logs/],
};
const ropa = tableRows(register, 'legal:ropa');
test(`purposes: every art. 30 activity (${ropa.length}) has its line and the same legal basis`, () => {
  const lines = (lang: Lang) => body(lang, 5).split('\n').filter((line) => line.startsWith('• '));
  for (const row of ropa) {
    const id = row[0]!;
    assert.ok(PURPOSES[id], `${id} is in the register but has no policy purpose — add it to section 5 and PURPOSES`);
    const letter = row[3]!.match(/art\. 6 ust\. 1 lit\. ([a-f])/)?.[1];
    assert.ok(letter, `${id} basis`);
    const plLine = lines('pl').find((line) => PURPOSES[id]![0].test(line));
    const enLine = lines('en').find((line) => PURPOSES[id]![1].test(line));
    assert.ok(plLine?.includes(`art. 6 ust. 1 lit. ${letter} RODO`), `pl ${id}: ${plLine}`);
    assert.ok(enLine?.includes(`Art. 6(1)(${letter}) GDPR`), `en ${id}: ${enLine}`);
    assert.equal(lines('pl').indexOf(plLine!), lines('en').indexOf(enLine!), `${id}: PL and EN lines in the same order`);
  }
});

// Declared endpoints and fields → plain words in the policy (PL / EN). Technical envelope fields are not personal.
const ENDPOINTS: Record<string, [string, string]> = {
  'accounts:signUp': ['anonimowe konto Firebase Authentication', 'anonymous Firebase Authentication account'],
  token: ['ostatniego logowania', 'last signed in'],
  submitDaily: ['po zakończeniu oficjalnej gry dnia', 'finishing the official daily run'],
  getBoards: ['Inni gracze widzą', 'Other players see'],
  deleteMyData: ['Usuń moje dane rankingu', 'Delete my ranking data'],
};
const SUBMISSION: Record<string, [string, string] | null> = {
  v: null, mode: null, dateKey: ['datę wyzwania', 'challenge date'], seed: ['ziarno świata', 'world seed'],
  rulesVersion: ['wersję zasad gry', 'game rules version'], endTick: ['długość gry', 'length of the run'],
  claimedScore: ['deklarowany wynik', 'claimed score'], journal: ['zapis Twoich ruchów', 'record of your moves'],
};
const STORED: Record<string, [string, string]> = {
  uid: ['identyfikator konta', 'account identifier'], callSign: ['znak wywoławczy', 'call sign'], score: ['wynik', 'score'],
  weeks: ['tygodni (ranking dnia)', 'weeks played (daily board)'], days: ['dni (ranking tygodnia)', 'days (weekly board)'],
  hash: ['skrót kontrolny gry', 'check hash of the run'], at: ['czas zapisu', 'time of the entry'],
  expireAt: ['datę automatycznego usunięcia', 'automatic deletion date'], entries: ['Inni gracze widzą', 'Other players see'],
};
const words = (map: Record<string, [string, string] | null>, ids: string[], what: string): void => {
  for (const id of new Set(ids)) {
    assert.ok(id in map, `${what} ${id} is declared but the policy does not describe it — add it here and to section 4`);
    const pair = map[id];
    if (!pair) continue;
    LANGS.forEach((lang, i) => assert.ok(all(lang).includes(pair[i]!), `${lang}: ${what} ${id} → "${pair[i]}"`));
  }
};
const endpointRows = tableRows(declarations, 'privacy:endpoints');
test(`data categories: every declared endpoint (${endpointRows.length}) and submission field`, () => {
  words(ENDPOINTS, endpointRows.map((row) => ticks(row[0]!)[0]!), 'endpoint');
  const submit = endpointRows.find((row) => ticks(row[0]!)[0] === 'submitDaily');
  assert.ok(submit, 'submitDaily row');
  words(SUBMISSION, ticks(submit![3]!).map((field) => field.replace(/^data\.submission\./, '')), 'submission field');
});
test('data categories: every stored field', () => {
  const fields = tableRows(declarations, 'privacy:stored').flatMap((row) => ticks(row[1]!));
  assert.ok(fields.length >= 10);
  words(STORED, fields, 'stored field');
});
test('the record of moves is described as not stored, as the declarations say', () => {
  assert.match(declarations, /journal is replayed and \*\*not stored\*\*/);
  assert.match(body('pl', 8), /Zapis ruchów: nie jest przechowywany/);
  assert.match(body('en', 8), /Record of moves: not stored/);
});

// Retention numbers.
test('retention: leaderboard = RETENTION_DAYS; backups, Auth IP logs and e-mail deletion = the register', () => {
  const retention = Number(read('functions/src/logic.ts').match(/RETENTION_DAYS\s*=\s*(\d+)/)?.[1]);
  const row = (id: string): string[] => ropa.find((r) => r[0] === id) ?? [];
  assert.ok(row('P1')[8]!.startsWith(`${retention} dni`));
  const backups = row('P3')[8]!.match(/do (\d+) dni w kopiach/)?.[1];
  const mail = row('P4')[8]!.match(/do (\d+) dni/)?.[1];
  assert.ok(backups && mail && /kilka tygodni/.test(row('P3')[8]!), 'register cells');
  assert.match(body('pl', 8), new RegExp(`Wpisy rankingu: ${retention} dni`));
  assert.match(body('en', 8), new RegExp(`Leaderboard entries: ${retention} days`));
  assert.match(body('pl', 8), new RegExp(`do ${backups} dni w kopiach`));
  assert.match(body('en', 8), new RegExp(`up to ${backups} days in Google's backups`));
  assert.match(body('pl', 8), /kilka tygodni/);
  assert.match(body('en', 8), /a few weeks/);
  assert.match(body('pl', 9), new RegExp(`w ciągu ${mail} dni`));
  assert.match(body('en', 9), new RegExp(`within ${mail} days`));
});
test('processor, region and transfer mechanism match the register', () => {
  const p1 = (ropa.find((r) => r[0] === 'P1') ?? []).join(' ');
  assert.match(p1, /europe-west1/);
  assert.match(p1, /Data Privacy Framework/);
  for (const lang of LANGS) {
    assert.match(body(lang, 4) + body(lang, 6), /europe-west1/, lang);
    assert.match(body(lang, 6), /Firebase Data Processing and Security Terms/, lang);
    assert.match(body(lang, 7), /EU-US Data Privacy Framework/, lang);
    assert.match(body(lang, 7), /SCC/, lang);
  }
});
test('rights: objection (art. 21) and complaint to UODO; age 13+; no profiling', () => {
  assert.match(body('pl', 9), /art\. 21 RODO/);
  assert.match(body('en', 9), /Art\. 21 GDPR/);
  assert.match(body('pl', 9), /Prezesa Urzędu Ochrony Danych Osobowych/);
  assert.match(body('en', 9), /UODO/);
  assert.match(body('pl', 10), /13 lat/);
  assert.match(body('en', 10), /13 and over/);
  assert.match(body('pl', 11), /Nie profilujemy/);
  assert.match(body('en', 11), /do not profile/);
});
test('the switches the policy names are the game\'s own labels', () => {
  for (const lang of LANGS) {
    assert.ok(body(lang, 9).includes(`„${game[lang]['settings.shareRanking']}”`) || body(lang, 9).includes(`"${game[lang]['settings.shareRanking']}"`),
      `${lang}: settings.shareRanking`);
    const del = (game[lang]['settings.deleteRanking'] ?? '').toLowerCase();
    assert.ok(body(lang, 9).toLowerCase().includes(del), `${lang}: settings.deleteRanking`);
    assert.ok(all(lang).includes(game[lang]['logbook.copy'] ?? '\u0000'), `${lang}: logbook.copy`);
    assert.ok(body(lang, 9).includes(`${game[lang]['settings.group.help']}`), `${lang}: settings.group.help`);
  }
});

console.log(`SUMMARY test:privacy-policy seed=0 cases=${passed + failed} passed=${passed} failed=${failed} sections=${sectionCount} ` +
  `activities=${ropa.length} endpoints=${endpointRows.length}`);
if (failed) process.exitCode = 1;
