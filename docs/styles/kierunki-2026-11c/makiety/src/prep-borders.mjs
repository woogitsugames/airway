// Country borders (Natural Earth via world-atlas, ISC) as one MultiLineString JSON.
// usage: node prep-borders.mjs <out.json>   (run from a dir with world-atlas + topojson-client in node_modules)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.cwd() + '/');
const topo = require('topojson-client');
const w = JSON.parse(fs.readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));
const mesh = topo.mesh(w, w.objects.countries, (a, b) => a !== b);
fs.writeFileSync(process.argv[2], JSON.stringify({ coordinates: mesh.coordinates.map(l => l.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)])) }));
