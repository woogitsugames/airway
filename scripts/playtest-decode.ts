// [night-12ap] R3j, D-231: `npm run playtest:decode -- answers.txt [more.txt]` — every `AW1:` line pasted from the
// logbook's "Copy summary" (survey answers, e-mails) as CSV on stdout, one row per run, for the decision table in
// docs/PLAYTEST.md. Without files it reads stdin. Counts go to stderr so `> runs.csv` stays clean.
import { readFileSync } from 'node:fs';
import { playtestCsv } from '../src/game/playtestRecord.ts';

const files = process.argv.slice(2).filter((arg) => arg !== '--');
const text = files.length ? files.map((file) => readFileSync(file, 'utf8')).join('\n') : readFileSync(0, 'utf8');
const out = playtestCsv(text);
process.stdout.write(out.csv);
console.error(`playtest:decode records=${out.records} rows=${out.rows} skipped=${out.skipped}`);
if (!out.records) process.exitCode = 1;
