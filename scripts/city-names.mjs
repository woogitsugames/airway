// [night-12ai] R7j, D-213: city and region names for the wave-1 languages (de, fr, es, pt = pt-BR) from Wikidata
// labels (CC0). Three steps, each reproducible; only the last runs in tests and it needs no network:
//   node scripts/city-names.mjs --resolve   map new cities to Wikidata ids (search by English name, nearest item
//                                           within 40 km of our coordinates) → scripts/data/city-wikidata.json
//   node scripts/city-names.mjs --fetch     snapshot the labels of every mapped id → scripts/data/wikidata-labels.json
//   node scripts/city-names.mjs [--check]   snapshot + reviewed overrides → src/data/city-names.json (offline;
//                                           --check compares with the committed file instead of writing)
// The overrides (scripts/data/city-names-overrides.json) are the human review: names players know that differ from
// the Wikidata label (pt-BR "Nova York", de "New York"), each with a reason. PL/EN names stay in src/data (D-107).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './ts-test-loader.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAP_FILE = resolve(ROOT, 'scripts/data/city-wikidata.json');
const LABELS_FILE = resolve(ROOT, 'scripts/data/wikidata-labels.json');
const OVERRIDES_FILE = resolve(ROOT, 'scripts/data/city-names-overrides.json');
const OUT_FILE = resolve(ROOT, 'src/data/city-names.json');
const API = 'https://www.wikidata.org/w/api.php';
const USER_AGENT = 'airway-city-names/1.0 (https://airway.games; build script)';

const { CITIES } = await import('../src/data/index.ts');
const { REGION_IDS } = await import('../src/data/regions.ts');
const { PLANNED_LANGUAGE_ENTRIES } = await import('../src/i18n/languages.ts');

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

async function api(params) {
  const url = API + '?' + new URLSearchParams({ format: 'json', ...params });
  // Polite pace (Wikidata answers 429 to bursts): one request per second, back off on refusals.
  for (let attempt = 0; ; attempt++) {
    await new Promise((done) => setTimeout(done, 1000));
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    if (response.ok) return response.json();
    if (attempt >= 6) throw new Error(`${response.status} ${url}`);
    const wait = Number(response.headers.get('retry-after')) || 10 * (attempt + 1);
    await new Promise((done) => setTimeout(done, wait * 1000));
  }
}

function km(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/**
 * Wikidata ids of the cities through their English Wikipedia article (our English name, or `titles[code]` where the
 * name is ambiguous), 50 per request; then one SPARQL query for the coordinates: every item must lie within 40 km
 * of our rounded coordinates, so a wrong article (a state, a namesake) is caught.
 */
async function resolveCities(mapping) {
  const titleOf = (city) => mapping.titles?.[city.code] ?? city.nameEn;
  const found = {};
  for (let i = 0; i < CITIES.length; i += 50) {
    const batch = CITIES.slice(i, i + 50);
    const reply = await api({ action: 'wbgetentities', sites: 'enwiki', titles: batch.map(titleOf).join('|'), props: 'sitelinks',
      sitefilter: 'enwiki', redirects: 'yes' });
    const byTitle = new Map();
    for (const entity of Object.values(reply.entities)) if (entity.id) byTitle.set(entity.sitelinks?.enwiki?.title, entity.id);
    const normalized = new Map((reply.normalized?.n ? [reply.normalized.n].flat() : []).map((n) => [n.from, n.to]));
    const redirects = new Map((reply.redirects ? [reply.redirects].flat() : []).map((r) => [r.from, r.to]));
    for (const city of batch) {
      let title = titleOf(city);
      title = normalized.get(title) ?? title;
      title = redirects.get(title) ?? title;
      const id = byTitle.get(title) ?? Object.values(reply.entities).find((e) => e.title === title || e.sitelinks?.enwiki?.title === title)?.id;
      if (id) found[city.code] = id;
    }
  }
  const query = `SELECT ?item ?lat ?lon ?label WHERE { VALUES ?item { ${Object.values(found).map((id) => 'wd:' + id).join(' ')} }
    ?item p:P625/psv:P625 [ wikibase:geoLatitude ?lat; wikibase:geoLongitude ?lon ].
    OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") } }`;
  const response = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query),
    { headers: { 'user-agent': USER_AGENT, accept: 'application/sparql-results+json' } });
  if (!response.ok) throw new Error('SPARQL ' + response.status);
  const coords = new Map();
  for (const row of (await response.json()).results.bindings) {
    const id = row.item.value.split('/').pop();
    (coords.get(id) ?? coords.set(id, []).get(id)).push({ lat: Number(row.lat.value), lon: Number(row.lon.value), label: row.label?.value });
  }
  const problems = [];
  for (const city of CITIES) {
    const id = found[city.code];
    if (!id) { problems.push(`${city.code}: no enwiki article "${titleOf(city)}" (add titles.${city.code})`); continue; }
    const near = Math.min(...(coords.get(id) ?? []).map((c) => km(city.lat, city.lon, c.lat, c.lon)));
    const label = coords.get(id)?.[0]?.label ?? '';
    console.log(`${city.code}\t${city.nameEn}\t${id}\t${label}\t${Number.isFinite(near) ? Math.round(near) + ' km' : 'no coordinate'}`);
    if (!(near <= 40)) problems.push(`${city.code}: ${id} "${label}" is ${Math.round(near)} km from our point`);
  }
  return { found, problems };
}

// 'mul' holds a name shared by many languages (Oslo, Abuja): Wikidata stores it once instead of per language.
const LABEL_LANGUAGES = [...new Set([...PLANNED_LANGUAGE_ENTRIES.flatMap((entry) => entry.wikidata), 'mul'])];

async function fetchLabels(mapping) {
  const ids = [...new Set([...Object.values(mapping.cities), ...Object.values(mapping.regions)])].sort();
  const labels = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = await api({ action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels',
      languages: ['en', ...LABEL_LANGUAGES].join('|') });
    for (const id of ids.slice(i, i + 50)) {
      const entity = batch.entities[id];
      if (!entity || entity.missing !== undefined) throw new Error('missing Wikidata item ' + id);
      labels[id] = Object.fromEntries(Object.entries(entity.labels ?? {}).map(([language, label]) => [language, label.value])
        .sort(([a], [b]) => a.localeCompare(b)));
    }
  }
  return labels;
}

/** Snapshot + overrides → { cities: { code: { de, fr, es, pt } }, regions: { … } } (pure, offline). */
export function buildNames(mapping, snapshot, overrides) {
  const problems = [];
  const pick = (kind, key, id) => {
    const out = {};
    for (const entry of PLANNED_LANGUAGE_ENTRIES) {
      const override = overrides[kind]?.[key]?.[entry.code];
      const label = [...entry.wikidata, 'mul'].map((language) => snapshot.labels[id]?.[language]).find(Boolean);
      // A disambiguation suffix in a label ("Córdoba (Argentinien)") is not part of the name.
      const name = override?.name ?? label?.replace(/\s*\([^)]*\)$/, '');
      if (!name) problems.push(`${kind} ${key} (${id}): no ${entry.code} label`);
      else out[entry.code] = name;
    }
    return out;
  };
  const cities = Object.fromEntries(CITIES.map((city) => [city.code, mapping.cities[city.code]
    ? pick('cities', city.code, mapping.cities[city.code]) : (problems.push('city ' + city.code + ': no Wikidata id'), {})]));
  const regions = Object.fromEntries(REGION_IDS.map((region) => [region, mapping.regions[region]
    ? pick('regions', region, mapping.regions[region]) : (problems.push('region ' + region + ': no Wikidata id'), {})]));
  return {
    names: {
      source: 'Wikidata labels (CC0 1.0), reviewed overrides in scripts/data/city-names-overrides.json',
      retrieved: snapshot.retrieved,
      languages: PLANNED_LANGUAGE_ENTRIES.map((entry) => entry.code),
      cities, regions,
    },
    problems,
  };
}

const args = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.includes('--resolve')) {
    const mapping = readJson(MAP_FILE);
    const { found, problems } = await resolveCities(mapping);
    for (const problem of problems) console.error('FAIL ' + problem);
    mapping.cities = found;
    writeJson(MAP_FILE, mapping);
    console.log(`SUMMARY city-names:resolve cities=${Object.keys(found).length}/${CITIES.length} problems=${problems.length}`);
    if (problems.length) process.exitCode = 1;
  } else if (args.includes('--fetch')) {
    const mapping = readJson(MAP_FILE);
    const labels = await fetchLabels(mapping);
    writeJson(LABELS_FILE, { source: 'https://www.wikidata.org (CC0 1.0)', retrieved: new Date().toISOString().slice(0, 10), labels });
    for (const city of CITIES) {
      const en = labels[mapping.cities[city.code]]?.en;
      if (en !== city.nameEn) console.log(`review ${city.code}: our "${city.nameEn}", Wikidata en "${en}"`);
    }
    console.log(`SUMMARY city-names:fetch ids=${Object.keys(labels).length} languages=${LABEL_LANGUAGES.join(',')}`);
  } else {
    const { names, problems } = buildNames(readJson(MAP_FILE), readJson(LABELS_FILE), readJson(OVERRIDES_FILE));
    for (const problem of problems) console.error('FAIL ' + problem);
    const text = JSON.stringify(names, null, 2) + '\n';
    let stale = false;
    if (args.includes('--check')) stale = readFileSync(OUT_FILE, 'utf8') !== text;
    else if (!problems.length) writeFileSync(OUT_FILE, text);
    if (stale) console.error('FAIL src/data/city-names.json differs from a rebuild (run node scripts/city-names.mjs)');
    console.log(`SUMMARY city-names cities=${Object.keys(names.cities).length} regions=${Object.keys(names.regions).length} ` +
      `languages=${names.languages.join(',')} problems=${problems.length}${args.includes('--check') ? ' stale=' + stale : ''}`);
    if (problems.length || stale) process.exitCode = 1;
  }
}
