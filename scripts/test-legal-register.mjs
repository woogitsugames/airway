// [night-12av] R7d, D-239: docs/legal/README.md is the legal launch register. Sections present and every one marked
// "to verify with the lawyer"; every D-/Q- reference exists; dates are real calendar days and the store/US deadlines
// from RESEARCH R7 are listed; the GDPR art. 30 record covers every endpoint and every stored field that
// docs/store/privacy-declarations.md declares (so a new data flow fails until the register gains it), its retention
// equals the server's RETENTION_DAYS; the data controller stays a Q-01 placeholder; docs/FIREBASE.md has the
// processing-terms acceptance step.
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ' — ' + detail}`);
}
const read = (path) => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
// Same readers as test-doc-ids.mjs (that script runs its checks on import).
const decisionIds = (text) => [...text.matchAll(/^## D-(\d+)\b/gm)].map((m) => Number(m[1]));
const questionIds = (text) => [...text.matchAll(/^\|\s*Q-(\d+)\b/gm)].map((m) => Number(m[1]));

/** Body rows of the table between `<!-- name -->` markers, as trimmed cells (header and rule dropped). */
function tableRows(text, name) {
  const match = text.match(new RegExp(`<!-- ${name} -->([\\s\\S]*?)<!-- /${name} -->`));
  if (!match) return null;
  return match[1].trim().split('\n').filter((line) => line.startsWith('|')).slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}
const refs = (text, letter) => [...new Set([...text.matchAll(new RegExp(`\\b${letter}-(\\d+)\\b`, 'g'))].map((m) => Number(m[1])))];
/** dd.mm.yyyy and yyyy-mm-dd dates that are not real calendar days. */
function badDates(text) {
  const bad = [];
  const test = (raw, y, m, d) => {
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d) bad.push(raw);
  };
  for (const [raw, d, m, y] of text.matchAll(/\b(\d{2})\.(\d{2})\.(\d{4})\b/g)) test(raw, y, m, d);
  for (const [raw, y, m, d] of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) test(raw, y, m, d);
  return bad;
}
const ticks = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

check('reader: bad dates', badDates('01.02.2027 31.04.2027 2026-02-30 2026-11-04').join() === '31.04.2027,2026-02-30');

const PATH = 'docs/legal/README.md';
const doc = read(PATH);
const decisions = new Set(decisionIds(read('docs/DECISIONS.md')));
const questions = new Set(questionIds(read('docs/OWNER-QUESTIONS.md')));
check(`${PATH} exists`, doc.length > 0);
check('not presented as legal advice', /To nie jest porada prawna/.test(doc));

const sections = doc.split(/\n(?=## )/).slice(1);
const headings = ['## 1. Rejestr czynności przetwarzania (art. 30 RODO)', '## 2. Akceptacja warunków przetwarzania Firebase',
  '## 3. Deklaracje przedsiębiorcy (trader)', '## 4. Przedstawiciel w Wielkiej Brytanii (art. 27 UK GDPR)',
  '## 5. USA — stanowe ustawy o wieku w sklepach (sprawdzić przed premierą w USA)', '## 6. Inne punkty przed premierą',
  '## 7. Pytania do prawnika (jedna konsultacja)'];
check('required sections in order', JSON.stringify(sections.map((s) => s.split('\n')[0])) === JSON.stringify(headings),
  sections.map((s) => s.split('\n')[0]).join(' | '));
const unmarked = sections.slice(0, 5).filter((s) => !/Do\s+weryfikacji\s+z\s+prawnikiem/.test(s)).map((s) => s.split('\n')[0]);
check('sections 1–5 each say "Do weryfikacji z prawnikiem"', unmarked.length === 0, unmarked.join(', '));

const missingD = refs(doc, 'D').filter((n) => !decisions.has(n));
const missingQ = refs(doc, 'Q').filter((n) => !questions.has(n));
check(`every D- reference exists (${refs(doc, 'D').length})`, refs(doc, 'D').length > 10 && missingD.length === 0, missingD.map((n) => 'D-' + n).join(', '));
check(`every Q- reference exists (${refs(doc, 'Q').length})`, refs(doc, 'Q').length > 5 && missingQ.length === 0, missingQ.map((n) => 'Q-' + n).join(', '));
check('every date is a real day', badDates(doc).length === 0, badDates(doc).join(', '));

// Controller stays a Q-01 placeholder (owner-only).
const controller = Object.fromEntries((tableRows(doc, 'legal:controller') ?? []).map((row) => [row[0], row[1]]));
check('data controller and contact stay Q-01 placeholders',
  /^\[Q-01 — do uzupełnienia/.test(controller['Administrator (nazwa, adres)'] ?? '')
  && /^\[Q-01 — do uzupełnienia/.test(controller['Kontakt w sprawie danych'] ?? '')
  && /Q-67/.test(controller['Przedstawiciel w UK (art. 27 UK GDPR)'] ?? ''));

// Art. 30 record vs the store declarations and the server.
const ropa = tableRows(doc, 'legal:ropa') ?? [];
check(`art. 30 record: every row has 11 filled cells (${ropa.length})`,
  ropa.length >= 5 && ropa.every((row) => row.length === 11 && row.every(Boolean)),
  ropa.filter((row) => row.length !== 11 || !row.every(Boolean)).map((row) => row[0]).join(', '));
check('art. 30 record: legal basis per row names a GDPR art. 6 point', ropa.every((row) => /art\. 6 ust\. 1 lit\. [a-f]/.test(row[3])));
const declarations = read('docs/store/privacy-declarations.md');
const endpoints = (tableRows(declarations, 'privacy:endpoints') ?? []).map((row) => ticks(row[0])[0]);
const ropaText = ropa.map((row) => row.join(' | ')).join('\n');
const ropaTicks = new Set(ticks(ropaText));
const missingEndpoints = endpoints.filter((e) => !ropaTicks.has(e));
check(`art. 30 record names every declared endpoint (${endpoints.length})`, endpoints.length >= 5 && missingEndpoints.length === 0, missingEndpoints.join(', '));
const storedFields = (tableRows(declarations, 'privacy:stored') ?? []).flatMap((row) => ticks(row[1]));
const missingFields = [...new Set(storedFields)].filter((f) => !ropaTicks.has(f));
check(`art. 30 record names every stored field (${new Set(storedFields).size})`, storedFields.length >= 10 && missingFields.length === 0, missingFields.join(', '));
const retention = Number((read('functions/src/logic.ts').match(/RETENTION_DAYS\s*=\s*(\d+)/) ?? [])[1]);
const p1 = ropa.find((row) => row[0] === 'P1');
check(`leaderboard retention = RETENTION_DAYS (${retention})`, retention > 0 && p1 && p1[8].startsWith(`${retention} dni`) && /D-77/.test(p1[8]));
check('art. 30 record: Auth IP logs and 180-day backups, Cloud Run logs, hosting logs',
  /180 dni/.test(ropaText) && /IP w logach Auth/.test(ropaText) && /Cloud Run/.test(ropaText) && /hostingu/.test(ropaText));

// Firebase processing terms.
const terms = tableRows(doc, 'legal:firebase-terms') ?? [];
const firebase = read('docs/FIREBASE.md');
check('Firebase processing terms: owner step with a date field', terms.some((row) => /Data Processing and Security Terms/.test(row[0]) && row[1] === '**właściciel**' && /RRRR-MM-DD/.test(row[3])));
check('docs/FIREBASE.md has the acceptance step linking the register',
  /Firebase Data Processing and Security Terms\*\* i \*\*zaakceptuj\*\*/.test(firebase) && firebase.includes('docs/legal/README.md'));

// Trader declarations with dates (RESEARCH R7).
const trader = tableRows(doc, 'legal:trader') ?? [];
const traderText = trader.map((row) => row.join(' | ')).join('\n');
check('trader: Google at creation / by 01.02.2027, shown from 01.03.2027; Apple before EU submission',
  trader.some((row) => row[0] === 'Google Play' && /przy zakładaniu/.test(row[2]) && /01\.02\.2027/.test(row[2]))
  && trader.some((row) => row[0] === 'Google Play' && /01\.03\.2027/.test(row[2]))
  && trader.some((row) => row[0] === 'App Store' && /przed pierwszym zgłoszeniem w UE/.test(row[2]))
  && /D-134/.test(traderText));

// UK and US.
const uk = Object.fromEntries((tableRows(doc, 'legal:uk') ?? []).map((row) => [row[0], row[1]]));
check('UK art. 27: Q-67 → A (D-136) waits for the lawyer', /D-136/.test(uk['Stan'] ?? '') && /Q-67 → A \(D-136\)/.test(doc));
const us = tableRows(doc, 'legal:us-age') ?? [];
const usDate = (state) => us.find((row) => row[0].startsWith(state))?.[1] ?? '';
check('US age laws: Texas in force, Louisiana 01.07.2026, Alabama 01.01.2027, Utah 06.05.2027, re-check before US launch',
  /w mocy/.test(usDate('Teksas')) && usDate('Luizjana') === '01.07.2026' && usDate('Alabama') === '01.01.2027'
  && usDate('Utah').startsWith('06.05.2027') && us.every((row) => row[3]) && /przed premierą w USA/.test(doc));

const release = read('docs/RELEASE.md');
check('docs/RELEASE.md links the register from the Firebase, privacy, trader lines and RL-29',
  ['RL-03', 'RL-11', 'RL-15', 'RL-29'].every((id) => release.split('\n').some((line) => line.startsWith(`| ${id} |`) && line.includes('docs/legal/README.md'))));

console.log(`SUMMARY test:legal-register seed=0 cases=${passed + failed} passed=${passed} failed=${failed} ` +
  `activities=${ropa.length} endpoints=${endpoints.length} fields=${new Set(storedFields).size}`);
process.exitCode = failed ? 1 : 0;
