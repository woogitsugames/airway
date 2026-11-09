// [night-74a R3] D-323/D-329: the world objects on the NASA globe, after the UI-A mockups
// (docs/styles/kierunki-2026-11c/makiety/ui-a/, `ui.js` pinOf/routeLayer/drawPlane, `ui.css` .pin/.casing/.core/
// .planned/.plane/.jam-*): airport points (light dot with a dark outline; hub = a ring around a dark core with the
// hub mark; curfew = a barrier bar across, a shape), routes as a screen ribbon with a dark casing and a light core
// (widebody solid, turboprop dashed), the route being drawn as a yellow grease pencil with dots past the range, plane
// silhouettes 31 / 38 px with a dark outline and a shadow on the globe (no navigation lights), and the jam zone as a
// red ring with the countdown arc on a light rim. The shaders and sizes live here; the layers, the draws (one each)
// and the buffers are the ones in `objects.ts`, which imports this module (one lazy chunk; [night-82a R6] D-337: the
// only object style since the old print went).
import type { ObjectStyle } from './objects';

/**
 * What the earth shaders take from `objects.ts` (passed in, not imported: the two modules would import each other's
 * values): the atlas SDF lookup and the draw-on time.
 */
export interface EarthStyleShared {
  readonly atlasSdf: () => string;
  readonly revealMs: number;
}

/** Mockup palette: enamel black casing, cream core, the UI-A red (D-324 `--board-red`) and the sign yellow. */
export const EARTH_OBJECT_INKS = {
  casing: '#0B0B0B',
  cream: '#EFE7D3',
  red: '#C0231B',
  sign: '#F3C317',
} as const;
/** Point radii in CSS px (mockup `.pin` r 5.4 + 2.2 stroke; `.hub-outer` r 12.5 + 2.2 stroke, `.hub-inner` r 9). */
export const EARTH_POINT_HALF_PX = { airport: 6.5, hub: 13.6 } as const;
/** Jam zone: ring radius = the point's half size + this many px (hub: 21 px as in the mockup). */
export const EARTH_JAM_GAP_PX = 7.5;
/** Route ribbon widths in CSS px [casing, core]; a negative core marks the dashed turboprop core. */
export const EARTH_ROUTE_WIDTH_PX = { turboprop: [6, -3.2], widebody: [7, 3.2] } as const;
/** Turboprop core dash (mockup `stroke-dasharray: 7 5`). */
export const EARTH_DASH_PX = [7, 5] as const;
/** The finger-drawn route [casing, core] (mockup `.planned-casing` 6.5, `.planned` 3.4). */
export const EARTH_PREVIEW_WIDTH_PX = [6.5, 3.4] as const;
/** Plane silhouettes (mockup `drawPlane`: 31 / 38 pt), dark outline, shadow offset on screen (right, down). */
export const EARTH_PLANE_SIZE_PX = { turboprop: 31, widebody: 38 } as const;
export const EARTH_PLANE_OUTLINE_PX = 2;
export const EARTH_PLANE_SHADOW_PX = [2, 7] as const;

// A function, not a constant: interpolated values would keep this module in a release build.
const POINT_VERTEX = (): string => /* glsl */ `
attribute vec3 aCenter;
attribute vec4 aShape; // x: hub, y: closed by curfew, z: jam
varying vec2 vPx;
varying vec4 vShape;
void main() {
  float hs = aShape.x > 0.5 ? ${EARTH_POINT_HALF_PX.hub.toFixed(1)} : ${EARTH_POINT_HALF_PX.airport.toFixed(1)};
  vPx = position.xy * (hs + 3.0) * 2.0;
  vShape = aShape;
  if (!awFacing(aCenter)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = awOffset(projectionMatrix * viewMatrix * vec4(aCenter, 1.0), vPx * uScale);
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const POINT_FRAGMENT = (): string => /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uRed;
varying vec2 vPx;
varying vec4 vShape;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float cover(float d, float aa) { return clamp(0.5 - d / aa, 0.0, 1.0); }
void main() {
  float aa = max(fwidth(vPx.x), 1e-4);
  float r = length(vPx);
  bool jam = vShape.z > 0.5;
  bool closed = vShape.y > 0.5;
  // Jammed: white and red (the mandatory-sign colours of the UI-A jam sign); otherwise cream and enamel black.
  vec3 light = jam ? vec3(1.0) : uPaper;
  vec3 dark = jam ? uRed : uInk;
  float outer, lightPart;
  if (vShape.x > 0.5) {
    // Hub: a light ring (r 9 … 11.4) in a 2.2 px dark outline around a dark core with the hub mark (three bars).
    outer = cover(r - 13.6, aa);
    lightPart = cover(r - 11.4, aa) * (1.0 - cover(r - 9.0, aa));
    float mark;
    if (closed) {
      // Curfew: a barrier bar across the core instead of the mark.
      mark = cover(sdBox(vPx, vec2(6.4, 1.5)), aa);
    } else {
      vec2 bar = vec2(0.75, 5.5);
      float d = sdBox(vPx, bar);
      d = min(d, sdBox(awRot(vPx, 1.0471976), bar));
      d = min(d, sdBox(awRot(vPx, 2.0943951), bar));
      mark = cover(d, aa);
    }
    lightPart = max(lightPart, mark);
  } else if (closed) {
    // Curfew: a dark disc with a light rim and a light barrier bar across (a no-entry sign: the shape says closed).
    outer = cover(r - 7.6, aa);
    lightPart = max(outer * (1.0 - cover(r - 6.5, aa)), cover(sdBox(vPx, vec2(4.2, 1.2)), aa));
  } else {
    // Airport: a light dot r 4.3 in a 2.2 px dark outline.
    outer = cover(r - 6.5, aa);
    lightPart = cover(r - 4.3, aa);
  }
  vec3 colour = mix(dark, light, lightPart);
  float alpha = max(outer, lightPart);
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(colour, alpha);
  #include <colorspace_fragment>
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const JAM_VERTEX = (): string => /* glsl */ `
attribute vec3 aCenter;
attribute vec2 aJam; // x: ring radius px, y: share of the grace period left
varying vec2 vPx;
varying vec2 vJam;
void main() {
  vPx = position.xy * (aJam.x + 7.0) * 2.0;
  vJam = aJam;
  if (!awFacing(aCenter)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = awOffset(projectionMatrix * viewMatrix * vec4(aCenter, 1.0), vPx * uScale);
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const JAM_FRAGMENT = (): string => /* glsl */ `
uniform vec3 uRed;
uniform vec3 uPaper;
uniform vec3 uInk;
varying vec2 vPx;
varying vec2 vJam;
float cover(float d, float aa) { return clamp(0.5 - d / aa, 0.0, 1.0); }
void main() {
  float aa = max(fwidth(vPx.x), 1e-4);
  float r = length(vPx), R = vJam.x;
  float off = abs(r - R);
  // A light rim 7 px wide inside a 1 px dark edge (it reads on the desert by day and on the city lights by night) and
  // on it the countdown: a 4.5 px red arc from 12 o'clock, clockwise, as long as the share of the grace period left.
  // The red ring is the jammed point's own outline (white and red, POINT_FRAGMENT). Static: no pulse.
  float edge = cover(off - 4.5, aa);
  float rim = cover(off - 3.5, aa);
  float angle = atan(vPx.x, vPx.y);
  if (angle < 0.0) angle += 6.2831853;
  float arcOn = clamp((vJam.y * 6.2831853 - angle) * r / aa + 0.5, 0.0, 1.0);
  float red = cover(off - 2.25, aa) * arcOn;
  vec3 colour = mix(mix(uInk, uPaper, rim), uRed, red);
  float alpha = max(edge * 0.85, max(rim, red));
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(colour, alpha);
  #include <colorspace_fragment>
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const RIBBON_FRAGMENT = (shared: EarthStyleShared): string => /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uSign;
uniform float uTime;
uniform float uPxPerRad;
uniform float uDash; // 0 = route (casing + core); 1 = the route being drawn (yellow grease pencil)
varying float vSide;
varying vec2 vWidth;
varying vec3 vTrack;
varying vec3 vWorld;
float cover(float d, float aa) { return clamp(0.5 - d / aa, 0.0, 1.0); }
void main() {
  if (awHidden(vWorld)) discard;
  if (vTrack.x > (uTime - vTrack.y) * ${(1000 / shared.revealMs).toFixed(1)}) discard;
  float aa = 1.0 / uDpr;
  float px = abs(vSide) * (vWidth.x + 1.0);
  float coreHalf = abs(vWidth.y);
  float casing = cover(px - vWidth.x, aa);
  float core = cover(px - coreHalf, aa);
  float along = vTrack.z * uPxPerRad;
  float w = max(fwidth(along), 1e-4);
  if (uDash > 0.5) {
    if (vTrack.y > 0.5) {
      // Past the plane's range: round yellow dots (r 2) in a dark ring, every 8 px.
      float d = length(vec2(mod(along, 8.0) - 4.0, px));
      casing = cover(d - 3.2, aa);
      core = cover(d - 2.0, aa);
    } else {
      // Grease pencil: the wax width breathes a little along the stroke (moves with the line, not with time).
      core = cover(px - coreHalf * (0.9 + 0.1 * sin(along * 0.9) * sin(along * 0.37)), aa);
    }
    float alpha = max(casing * 0.7, core * 0.95);
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(mix(uInk, uSign, core), alpha);
  } else {
    // A negative core width marks the turboprop: its core is dashed ${EARTH_DASH_PX[0]}/${EARTH_DASH_PX[1]} px, the casing shows between.
    if (vWidth.y < 0.0) {
      float f = mod(along, ${(EARTH_DASH_PX[0] + EARTH_DASH_PX[1]).toFixed(1)});
      core *= clamp((${EARTH_DASH_PX[0].toFixed(1)} - f) / w + 0.5, 0.0, 1.0) * clamp(f / w + 0.5, 0.0, 1.0);
    }
    float alpha = max(casing * 0.9, core);
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(mix(uInk, uPaper, core), alpha);
  }
  #include <colorspace_fragment>
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const PLANE_VERTEX = (): string => /* glsl */ `
attribute vec3 aPos;
attribute vec3 aFwd;
attribute vec2 aMeta; // x: widebody, y: load share
varying vec2 vPx;
varying vec2 vMeta;
varying float vAngle;
void main() {
  vec4 c = projectionMatrix * viewMatrix * vec4(aPos, 1.0);
  vec4 f = projectionMatrix * viewMatrix * vec4(aPos + aFwd * 0.01, 1.0);
  vec2 d = (f.xy / f.w - c.xy / c.w) * uViewport;
  vAngle = atan(d.y, d.x);
  vMeta = aMeta;
  vPx = position.xy * 72.0;
  if (!awFacing(aPos)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = awOffset(c, vPx * uScale);
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const PLANE_FRAGMENT = (shared: EarthStyleShared): string => /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform float uShadow;
varying vec2 vPx;
varying vec2 vMeta;
varying float vAngle;
${shared.atlasSdf()}
float cover(float d, float aa) { return clamp(0.5 - d / aa, 0.0, 1.0); }
void main() {
  float aa = max(fwidth(vPx.x), 1e-4);
  bool wide = vMeta.x > 0.5;
  float size = wide ? ${EARTH_PLANE_SIZE_PX.widebody.toFixed(1)} : ${EARTH_PLANE_SIZE_PX.turboprop.toFixed(1)};
  // The icon's nose points up (+y on screen); turn it onto the course. Screen y runs up here, so "down" is −y.
  float turn = 1.5707963 - vAngle;
  float d = awPlaneSdf(awRot(vPx, turn), size, wide);
  float ds = awPlaneSdf(awRot(vPx - vec2(${EARTH_PLANE_SHADOW_PX[0].toFixed(1)}, -${EARTH_PLANE_SHADOW_PX[1].toFixed(1)}), turn), size, wide);
  float fill = cover(d, aa);
  float body = cover(d - ${EARTH_PLANE_OUTLINE_PX.toFixed(1)}, aa);
  // No load bar under the silhouette: the UI-A mockups draw none, and at 31–38 px the detached bar read as a stray
  // dash in the shots (owner question in the PR). vMeta.y (load share) stays in the buffer for a later stage.
  // The shadow on the globe: the silhouette offset down-right, soft-edged, black; under the plane only.
  float shadow = clamp(0.5 - ds / 2.0, 0.0, 1.0) * uShadow * (1.0 - body);
  float alpha = body + shadow;
  if (alpha <= 0.0) discard;
  vec3 colour = mix(uInk, uPaper, fill) * body / alpha; // the shadow is black, so it only adds coverage
  gl_FragColor = vec4(colour, alpha);
  #include <colorspace_fragment>
}`;

/** The NASA-globe style for the shared object layers. */
export const earthObjectStyle = (shared: EarthStyleShared): ObjectStyle => ({
  name: 'earth',
  inks: { paper: EARTH_OBJECT_INKS.cream, ink: EARTH_OBJECT_INKS.casing, red: EARTH_OBJECT_INKS.red, sign: EARTH_OBJECT_INKS.sign },
  stampVertex: POINT_VERTEX, stampFragment: POINT_FRAGMENT, jamVertex: JAM_VERTEX, jamFragment: JAM_FRAGMENT,
  ribbonFragment: () => RIBBON_FRAGMENT(shared), planeVertex: PLANE_VERTEX, planeFragment: () => PLANE_FRAGMENT(shared),
  stampHalf: EARTH_POINT_HALF_PX,
  jamRadius: (half) => half + EARTH_JAM_GAP_PX,
  routeWidth: EARTH_ROUTE_WIDTH_PX,
  previewWidth: EARTH_PREVIEW_WIDTH_PX,
  // Shadow strength by day; at night it fades to a trace (it would be black on black).
  shadow: (daylight) => 0.38 * (0.3 + 0.7 * Math.max(0, Math.min(1, daylight))),
});
