// Contact sheets: every direction side by side (portrait game, upgrade, menu) for the owner's comparison.
import { writePage } from '../lib/page.mjs';
import { dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const D = [['diorama', 'A · Diorama 3D'], ['airmail', 'B · Poczta lotnicza'], ['atlas', 'C · Atlas'], ['chart', 'D · Mapa pilota (odrzucona)']];
for (const screen of ['game', 'upgrade', 'menu']) {
  const w = 4 * 412 + 5 * 24, h = 915 + 80;
  writePage(dir, screen, { w, h, title: screen, fonts: [{ family: 'Fam', file: 'FamiljenGrotesk-700.ttf', weight: 700 }], css: 'body{background:#222;font-family:Fam;color:#eee}',
    body: D.map(([k, t], i) => `<div style="position:absolute;left:${24 + i * 436}px;top:20px;font-size:22px">${t}</div><img src="../${k}/png/${screen}-p.png" style="position:absolute;left:${24 + i * 436}px;top:60px;width:412px;height:915px">`).join('') });
}
