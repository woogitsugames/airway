// [night-12au] R2f + R6g, D-238: docs/LAUNCH.md is the owner's launch plan. Every D-/Q- reference exists, the
// timeline covers R2's steps (T−12 … T+12, with the D-131 rhythm), every row names who acts and why, dates are real
// calendar dates, the content table follows D-131, and the store-event drafts fit Apple's/Play's limits without
// price or "free" wording (Apple rejects it; R2).
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ' — ' + detail}`);
}
// Same readers as test-doc-ids.mjs (that script runs its checks on import).
const decisionIds = (text) => [...text.matchAll(/^## D-(\d+)\b/gm)].map((m) => Number(m[1]));
const questionIds = (text) => [...text.matchAll(/^\|\s*Q-(\d+)\b/gm)].map((m) => Number(m[1]));
const read = (path) => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };

const PATH = 'docs/LAUNCH.md';
const doc = read(PATH);
const decisions = new Set(decisionIds(read('docs/DECISIONS.md')));
const questions = new Set(questionIds(read('docs/OWNER-QUESTIONS.md')));

/** Body rows of the table between `<!-- launch:name -->` markers, as trimmed cells (header and rule dropped). */
export function tableRows(text, name) {
  const match = text.match(new RegExp(`<!-- launch:${name} -->([\\s\\S]*?)<!-- /launch:${name} -->`));
  if (!match) return null;
  return match[1].trim().split('\n').filter((line) => line.startsWith('|')).slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}
/** D-NN / Q-NN references in a text (numbers, deduplicated). */
export function refs(text, letter) {
  return [...new Set([...text.matchAll(new RegExp(`\\b${letter}-(\\d+)\\b`, 'g'))].map((m) => Number(m[1])))];
}
/** dd.mm.yyyy dates that are not real calendar days. */
export function badDates(text) {
  return [...text.matchAll(/\b(\d{2})\.(\d{2})\.(\d{4})\b/g)].filter(([, d, m, y]) => {
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return date.getUTCFullYear() !== +y || date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d;
  }).map((m) => m[0]);
}
const PRICE = /\bfree\b|darmow|za darmo|bezpłat|\bprice\b|\bcena\b|\bcen[ayę]\b|[€$£]|\bzł\b|\bEUR\b|\bUSD\b|%|#1|\bbest\b|najlepsz/i;
const OWNERS = new Set(['właściciel', '**właściciel**', 'właściciel + agent', 'agent']);

// Self-checks of the readers on synthetic text.
check('reader: finds bad dates', badDates('18.01.2027 31.02.2027 29.02.2028 29.02.2027').join() === '31.02.2027,29.02.2027');
check('reader: price words', PRICE.test('Play for free') && PRICE.test('Za darmo') && PRICE.test('only 4,99 €') && !PRICE.test('Freight and hubs'));
check('reader: tables and refs',
  JSON.stringify(tableRows('<!-- launch:x -->\n| a | b |\n|---|---|\n| 1 | D-9, Q-2 |\n<!-- /launch:x -->', 'x')) === '[["1","D-9, Q-2"]]'
  && refs('D-9 D-10 D-9 Q-2', 'D').join() === '9,10');

check(`${PATH} exists`, doc.length > 0);
for (const heading of ['## Zasady', '## Oś czasu (T = premiera)', '## Pokazy', '## Lista twórców wideo (szablon)',
  '## Treści po premierze', '## Teksty wydarzeń', '### Apple In-App Events', '### Google Play — promocja „Major update”']) {
  check(`section "${heading}"`, doc.includes(`\n${heading}\n`));
}

const missingD = refs(doc, 'D').filter((n) => !decisions.has(n));
const missingQ = refs(doc, 'Q').filter((n) => !questions.has(n));
check(`every D- reference exists (${refs(doc, 'D').length})`, refs(doc, 'D').length > 5 && missingD.length === 0,
  missingD.map((n) => 'D-' + n).join(', '));
check(`every Q- reference exists (${refs(doc, 'Q').length})`, refs(doc, 'Q').length > 3 && missingQ.length === 0,
  missingQ.map((n) => 'Q-' + n).join(', '));
check('every dd.mm.yyyy date is a real day', badDates(doc).length === 0, badDates(doc).join(', '));

// Rules from R2/D-16.
check('rule: never "free"/price in event or graphic texts',
  /Nigdy nie piszemy „free”/.test(doc) && /grafikach/.test(doc));
check('rule: no pre-registration reward (D-16, no IAP)', /Bez nagrody za przedrejestrację/.test(doc) && /IAP/.test(doc));

// Timeline.
const timeline = tableRows(doc, 'timeline') ?? [];
const when = timeline.map((row) => row[0]);
const stepAt = (mark, pattern) => timeline.some((row) => row[0] === mark && pattern.test(row[1]));
check(`timeline rows (${timeline.length})`, timeline.length >= 12);
check('timeline: every row has 5 cells, an owner and a D-/Q- reference',
  timeline.every((row) => row.length === 5 && OWNERS.has(row[2]) && /\b[DQ]-\d+\b/.test(row[3])),
  timeline.filter((row) => !(row.length === 5 && OWNERS.has(row[2]) && /\b[DQ]-\d+\b/.test(row[3]))).map((r) => r[1]).join('; '));
check('timeline: T−12 … T+12 in order',
  ['T−12 tyg.', 'T−10 tyg.', 'T−8 tyg.', 'T−4 tyg.', 'T', 'T+4 tyg.', 'T+8 tyg.', 'T+12 tyg.'].every((m) => when.includes(m))
  && when.map((m) => m === 'T' ? 0 : Number(m.replace('−', '-').match(/T([+-]\d+)/)?.[1])).every((v, i, a) => i === 0 || v >= a[i - 1]),
  when.join(' | '));
check('timeline: R2 steps (closed test, press page, Apple nomination, pre-order, pre-registration ≤ 90 days, creators, Opening week)',
  stepAt('T−12 tyg.', /Test zamknięty/) && stepAt('T−12 tyg.', /Strona prasowa/) && stepAt('T−10 tyg.', /Nominacja/)
  && stepAt('T−8 tyg.', /Pre-order/) && stepAt('T−8 tyg.', /Przedrejestracja.*90 dni.*bez nagrody/)
  && stepAt('T−4 tyg.', /twórców.*embarga/) && stepAt('T', /Tydzień otwarcia/));
check('timeline: first puzzle update at T+4 per D-131 (not R2\'s T+6), linked to D-193',
  timeline.some((row) => row[0] === 'T+4 tyg.' && /31–40/.test(row[1]) && /D-131/.test(row[3]) && /D-193/.test(row[3]))
  && !when.includes('T+6 tyg.'));
check('timeline: owner-only steps marked (consoles, nominations, pre-order)',
  timeline.filter((row) => row[2] === '**właściciel**').length >= 6
  && timeline.filter((row) => /Nominacja|Pre-order|Przedrejestracja/.test(row[1])).every((row) => row[2] === '**właściciel**'));

// Showcases.
const showcases = tableRows(doc, 'showcases') ?? [];
check('showcases: Big Indie Pitch Mobile 18.01.2027 and Digital Dragons 2027 (TBC)',
  showcases.some((row) => /Big Indie Pitch/.test(row[0]) && row[1] === '18.01.2027')
  && showcases.some((row) => /Digital Dragons 2027/.test(row[0]) && /NIEPEWNE/.test(row[5])));

// Creator template.
const creators = (doc.match(/<!-- launch:creators -->\n(\|[^\n]*)/) ?? [])[1] ?? '';
check('creator list template: name, channel, audience, contact, status; kept out of the repo',
  /Nazwa \| Kanał \| Odbiorcy \| Kontakt \| Status/.test(creators) && /listy nie trzymamy w repo/.test(doc));

// Content after launch (R6g, D-131).
const content = tableRows(doc, 'content') ?? [];
check('content table: T / T+4 / T+8 / T+12 with a mechanic, teaching puzzles and a store event each',
  ['T', 'T+4 tyg.', 'T+8 tyg.', 'T+12 tyg.'].every((m, i) => content[i]?.[0] === m)
  && content.every((row) => row.length === 6 && row[2] && row[3] && /E\d/.test(row[4]) && /D-131/.test(row[5])));

// Store-event texts.
const apple = tableRows(doc, 'apple-events') ?? [];
const appleBad = apple.filter((row) => row.length !== 6 || !/^(Challenge|Major Update)$/.test(row[1])
  || [...row[3]].length > 30 || [...row[4]].length > 50 || [...row[5]].length > 120 || !row[3] || !row[4] || !row[5]);
check(`Apple events: PL+EN each, name ≤ 30, short ≤ 50, long ≤ 120 (${apple.length})`,
  apple.length >= 8 && appleBad.length === 0
  && [...new Set(apple.map((row) => row[0]))].every((id) => ['EN', 'PL'].every((lang) => apple.some((row) => row[0] === id && row[2] === lang))),
  appleBad.map((row) => `${row[0]} ${row[2]} ${[...row[3]].length}/${[...row[4]].length}/${[...row[5]].length}`).join('; '));
const play = tableRows(doc, 'play-promos') ?? [];
const playBad = play.filter((row) => row.length !== 4 || [...row[2]].length > 30 || [...row[3]].length > 80 || !row[2] || !row[3]);
check(`Play "Major update" promos: PL+EN each, title ≤ 30, text ≤ 80 (${play.length})`,
  play.length >= 2 && playBad.length === 0 && /28 dni/.test(doc) && /60 dni/.test(doc) && /nie mogą się powtarzać/.test(doc),
  playBad.map((row) => `${row[0]} ${row[1]} ${[...row[2]].length}/${[...row[3]].length}`).join('; '));
const priced = [...apple.flatMap((row) => row.slice(3)), ...play.flatMap((row) => row.slice(2))].filter((cell) => PRICE.test(cell));
check('event texts never mention price or "free"', priced.length === 0, priced.join(' / '));

check('docs/RELEASE.md links the launch plan', /`docs\/LAUNCH\.md`/.test(read('docs/RELEASE.md')) && /D-238/.test(read('docs/RELEASE.md')));

console.log(`SUMMARY test:launch-plan seed=0 cases=${passed + failed} passed=${passed} failed=${failed} ` +
  `timeline=${timeline.length} apple=${apple.length} play=${play.length}`);
process.exitCode = failed ? 1 : 0;
