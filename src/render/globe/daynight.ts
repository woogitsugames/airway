/**
 * [task-34] Day/night grading for the globe's lit materials (terrain, trees, rocks, clouds).
 * The sun and moon lights do the shading; this only grades colour by the sun's elevation at each
 * surface point: a soft, warm dusk/dawn band along the terminator and a cool, moonlit palette on the
 * night side. Gameplay layers (routes, airports, planes) do NOT use it: they stay readable at night.
 * One shared uniform object, so moving the sun never recompiles a shader.
 */
import type { Material, MeshStandardMaterial, Vector3 } from 'three';

/** Elevation (dot of surface normal and sun direction) where the night palette is fully on/off. */
export const NIGHT_FULL_DOT = -0.2;
export const NIGHT_NONE_DOT = 0.06;
/** Half width of the warm terminator band in the same units. */
export const DUSK_HALF_WIDTH = 0.16;
/**
 * [task-39] D-49: extra night darkening of warm, bright albedo (desert, beach sand). Under the cool
 * moon grade those read as a pale blue-grey plate brighter than the rest of the land. `r - b` of the
 * linear albedo (desert 0.56, sand 0.51, grass/forest/rock ≤ 0.14, snow/ice ≈ 0) picks them out.
 */
export const NIGHT_SAND_MASK_FROM = 0.25;
export const NIGHT_SAND_MASK_TO = 0.45;
/** Night multiplier of a full desert, on top of the common night grade (darker, less blue). */
export const NIGHT_SAND_GRADE = [0.6, 0.56, 0.48] as const;

const VERTEX_DECL = 'varying vec3 vAwSurface;\n';
const VERTEX_BODY = `
  vec4 awWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    awWorld = instanceMatrix * awWorld;
  #endif
  vAwSurface = (modelMatrix * awWorld).xyz;
`;
const FRAGMENT_DECL = 'uniform vec3 awSunDirection;\nvarying vec3 vAwSurface;\n';
const FRAGMENT_BODY = `
  {
    float awSun = dot(normalize(vAwSurface), awSunDirection);
    float awNight = 1.0 - smoothstep(${NIGHT_FULL_DOT.toFixed(3)}, ${NIGHT_NONE_DOT.toFixed(3)}, awSun);
    float awDusk = 1.0 - smoothstep(0.0, ${DUSK_HALF_WIDTH.toFixed(3)}, abs(awSun - 0.01));
    // Night: cool moonlit palette, never black, so land and sea stay apart.
    vec3 awMoon = diffuseColor.rgb * vec3(0.035, 0.055, 0.11);
    outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.42, 0.56, 0.9) + awMoon, awNight);
    // [task-39] Deserts and sand: darker and less blue at night than the generic grade (D-49).
    float awSand = smoothstep(${NIGHT_SAND_MASK_FROM.toFixed(3)}, ${NIGHT_SAND_MASK_TO.toFixed(3)}, diffuseColor.r - diffuseColor.b);
    outgoingLight *= mix(vec3(1.0), vec3(${NIGHT_SAND_GRADE.map((v) => v.toFixed(3)).join(', ')}), awSand * awNight);
    // Terminator: a warm band (low sun) on both sides of the line, strongest on the day side.
    outgoingLight += diffuseColor.rgb * vec3(0.42, 0.16, 0.04) * awDusk * (1.0 - 0.6 * awNight);
  }
`;

/** Patch a lit three.js material in place; `sunDirection` is the live `SunLights.direction`. */
export function applyDayNightGrading(material: Material, sunDirection: Vector3): void {
  const standard = material as MeshStandardMaterial;
  if (!standard.isMeshStandardMaterial || standard.userData['awDayNight']) return;
  standard.userData['awDayNight'] = true;
  const uniform = { value: sunDirection };
  standard.onBeforeCompile = (shader) => {
    shader.uniforms['awSunDirection'] = uniform;
    shader.vertexShader = VERTEX_DECL + shader.vertexShader.replace(
      '#include <project_vertex>', '#include <project_vertex>' + VERTEX_BODY);
    shader.fragmentShader = FRAGMENT_DECL + shader.fragmentShader.replace(
      '#include <opaque_fragment>', FRAGMENT_BODY + '#include <opaque_fragment>');
  };
  standard.customProgramCacheKey = () => 'aw-daynight';
  standard.needsUpdate = true;
}
