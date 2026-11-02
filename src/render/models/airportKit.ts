/**
 * [M1] Procedural low-poly building kit shared by every airport and landmark: each piece is ONE
 * instanced mesh (draw call) for the whole world, positioned per instance and tinted per instance
 * (instanceColor × vertex colour). No downloaded assets; Diorama palette only.
 */
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute,
  MeshStandardMaterial, SphereGeometry, TorusGeometry,
} from 'three';
import { UI_SELF_LIGHT } from './planes';

export type KitPiece =
  | 'airfield' | 'block' | 'gable' | 'hip' | 'dome' | 'tiered' | 'pyramid'
  | 'tower' | 'palm' | 'snow' | 'lattice' | 'arch';

/** Draw order and identity of the kit meshes (one InstancedMesh each). */
export const KIT_PIECES: readonly KitPiece[] = [
  'airfield', 'block', 'gable', 'hip', 'dome', 'tiered', 'pyramid', 'tower', 'palm', 'snow', 'lattice', 'arch',
];

/** Self-lit share per piece (D-47): gameplay buildings like the old pads, scenery a little dimmer. */
export const KIT_SELF_LIGHT: Readonly<Record<KitPiece, number>> = {
  airfield: UI_SELF_LIGHT, block: UI_SELF_LIGHT, gable: UI_SELF_LIGHT, hip: UI_SELF_LIGHT,
  dome: UI_SELF_LIGHT, tiered: UI_SELF_LIGHT, pyramid: UI_SELF_LIGHT, tower: UI_SELF_LIGHT,
  palm: 0.3, snow: 0.35, lattice: 0.4, arch: 0.4,
};

interface Coloured { geometry: BufferGeometry; color: string }

const tmp = new Color();
/** Merge parts into one non-indexed geometry with a per-vertex colour attribute. */
export function mergeColoured(parts: readonly Coloured[]): BufferGeometry {
  const flat = parts.map((p) => ({ g: p.geometry.index ? p.geometry.toNonIndexed() : p.geometry, c: p.color, src: p.geometry }));
  let count = 0;
  for (const p of flat) count += p.g.getAttribute('position').count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const p of flat) {
    p.g.computeVertexNormals();
    const a = p.g.getAttribute('position');
    const n = p.g.getAttribute('normal');
    tmp.set(p.c);
    for (let i = 0; i < a.count; i++, o++) {
      pos[o * 3] = a.getX(i); pos[o * 3 + 1] = a.getY(i); pos[o * 3 + 2] = a.getZ(i);
      nor[o * 3] = n.getX(i); nor[o * 3 + 1] = n.getY(i); nor[o * 3 + 2] = n.getZ(i);
      col[o * 3] = tmp.r; col[o * 3 + 1] = tmp.g; col[o * 3 + 2] = tmp.b;
    }
    if (p.g !== p.src) p.g.dispose();
    p.src.dispose();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

const W = '#FFFFFF';
const one = (geometry: BufferGeometry, color = W): BufferGeometry => mergeColoured([{ geometry, color }]);
/** Square frustum, footprint side `bottom`, base at y0. */
const frustum = (top: number, bottom: number, h: number, y0: number): BufferGeometry =>
  new CylinderGeometry(top * Math.SQRT1_2, bottom * Math.SQRT1_2, h, 4, 1).rotateY(Math.PI / 4).translate(0, y0 + h / 2, 0);

function prism(ridge: number): BufferGeometry {
  // Unit footprint [-.5,.5]², base y=0, height 1. ridge = half-length of the ridge along x (0.5 = gable).
  const r = ridge;
  const v = [
    -.5, 0, -.5, .5, 0, -.5, .5, 0, .5, -.5, 0, .5, // base 0..3
    -r, 1, 0, r, 1, 0, // ridge 4,5
  ];
  const faces = [
    [0, 4, 5], [0, 5, 1], // north slope
    [3, 2, 5], [3, 5, 4], // south slope
    [0, 3, 4], [1, 5, 2], // hips/gable ends
    [0, 1, 2], [0, 2, 3], // bottom
  ];
  const out: number[] = [];
  for (const f of faces) for (const i of f) out.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out, 3));
  // Make every triangle face outward regardless of winding above.
  const p = g.getAttribute('position');
  for (let t = 0; t < p.count; t += 3) {
    const ax = p.getX(t), ay = p.getY(t), az = p.getZ(t);
    const bx = p.getX(t + 1) - ax, by = p.getY(t + 1) - ay, bz = p.getZ(t + 1) - az;
    const cx = p.getX(t + 2) - ax, cy = p.getY(t + 2) - ay, cz = p.getZ(t + 2) - az;
    const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
    const mx = (ax + p.getX(t + 1) + p.getX(t + 2)) / 3, my = (ay + p.getY(t + 1) + p.getY(t + 2)) / 3 - .3;
    const mz = (az + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    if (nx * mx + ny * my + nz * mz < 0) {
      const x = p.getX(t + 1), y = p.getY(t + 1), z = p.getZ(t + 1);
      p.setXYZ(t + 1, p.getX(t + 2), p.getY(t + 2), p.getZ(t + 2));
      p.setXYZ(t + 2, x, y, z);
    }
  }
  return g;
}

/** Geometry of one kit piece. Pieces are unit-sized where they are tinted per instance. */
export function kitGeometry(piece: KitPiece): BufferGeometry {
  switch (piece) {
    case 'airfield': // pad + runway + centre line, the old city pad at size factor 1
      return mergeColoured([
        { geometry: new CylinderGeometry(.026, .028, .004, 20).translate(0, .001, 0), color: '#EFE9DA' },
        { geometry: new BoxGeometry(.008, .002, .046).rotateY(.5).translate(-.008, .004, 0), color: '#3B4046' },
        { geometry: new BoxGeometry(.0012, .0022, .04).rotateY(.5).translate(-.008, .0054, 0), color: '#F5F1E6' },
      ]);
    case 'block': return one(new BoxGeometry(1, 1, 1).translate(0, .5, 0));
    case 'gable': return one(prism(.5));
    case 'hip': return one(prism(.22));
    case 'dome': return one(new SphereGeometry(.5, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 2, 1));
    case 'tiered': // two flared roofs, the upper one smaller: reads Asian at a glance without a replica
      return mergeColoured([
        { geometry: frustum(.62, 1.2, .38, 0), color: W },
        { geometry: frustum(.5, .5, .16, .38), color: '#E8E1D2' },
        { geometry: frustum(0, .8, .46, .54), color: W },
      ]);
    case 'pyramid': return one(frustum(0, 1, 1, 0));
    case 'tower': // hub control tower: shaft + cab (sea-green glass)
      return mergeColoured([
        { geometry: new CylinderGeometry(.0018, .0024, .02, 6).translate(0, .01, 0), color: '#F2EFE6' },
        { geometry: new CylinderGeometry(.0042, .003, .004, 8).translate(0, .021, 0), color: '#2A8F8A' },
        { geometry: new CylinderGeometry(.0044, .0044, .0008, 8).translate(0, .0234, 0), color: '#3B4046' },
      ]);
    case 'palm': { // trunk + five drooping leaves; ~0.012 tall
      const parts: Coloured[] = [
        { geometry: new CylinderGeometry(.0005, .0008, .011, 5).translate(0, .0055, 0), color: '#8A6A45' },
      ];
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        parts.push({ geometry: new BoxGeometry(.0058, .0005, .0016).translate(.0029, 0, 0).rotateZ(-.42)
          .rotateY(a).translate(0, .0112, 0), color: i % 2 ? '#3F8A3A' : '#2F7A36' });
      }
      return mergeColoured(parts);
    }
    case 'snow': { // irregular low snow field under a northern pad (unit radius)
      const g = new CylinderGeometry(1, 1, 1, 9, 1);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const a = Math.atan2(z, x);
        const k = 1 + .14 * Math.sin(a * 3 + .7) + .08 * Math.sin(a * 5);
        p.setXYZ(i, x * k, p.getY(i), z * k);
      }
      return one(g.translate(0, .5, 0), SNOW_TONE);
    }
    case 'lattice': { // generic tapering lattice tower on four legs (~0.03 tall)
      const parts: Coloured[] = [];
      const c = '#7A6A58';
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        parts.push({ geometry: new BoxGeometry(.0011, .013, .0011).rotateZ(sx * .3).rotateX(-sz * .3)
          .translate(sx * .0036, .0062, sz * .0036), color: c });
      }
      parts.push({ geometry: frustum(.006, .0085, .0012, .011), color: '#6A5B4B' });
      parts.push({ geometry: frustum(.0026, .0048, .011, .0122), color: c });
      parts.push({ geometry: frustum(.0034, .0034, .0009, .021), color: '#6A5B4B' });
      parts.push({ geometry: frustum(0, .0022, .009, .0219), color: c });
      return mergeColoured(parts);
    }
    case 'arch': { // a deck on piers under one parabolic-looking arch (tinted per city)
      return mergeColoured([
        { geometry: new TorusGeometry(.012, .0011, 3, 9, Math.PI).translate(0, .0015, 0), color: W },
        { geometry: new BoxGeometry(.034, .0012, .0034).translate(0, .0042, 0), color: '#D9D4C6' },
        { geometry: new BoxGeometry(.0024, .0052, .0036).translate(-.0155, .0018, 0), color: '#B9B3A6' },
        { geometry: new BoxGeometry(.0024, .0052, .0036).translate(.0155, .0018, 0), color: '#B9B3A6' },
      ]);
    }
  }
}
const SNOW_TONE = '#F3F1EA';

/**
 * Lambert-ish standard material whose self-lit share follows the per-instance colour (three.js'
 * `emissive` is a single uniform colour, so it is computed from diffuseColor in the shader).
 */
export function kitMaterial(piece: KitPiece): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, roughness: 0.88 });
  const self = KIT_SELF_LIGHT[piece];
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance = diffuseColor.rgb * ' + self.toFixed(3) + ';');
  };
  material.customProgramCacheKey = () => 'aw-kit-' + self.toFixed(3);
  material.userData['selfLight'] = self;
  return material;
}
