// [ext-03] Country borders (Natural Earth admin-0 50m via world-atlas, public domain / ISC) as lon/lat polylines
// for the "Mapa" texture bake: node dev/globe-look/borders.mjs > borders.json (land borders only, no coastlines).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mesh } from 'topojson-client';
const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));
const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
process.stdout.write(JSON.stringify(borders.coordinates.map((line) => line.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]))));
