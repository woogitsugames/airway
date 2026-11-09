// Public render API. Everything outside src/render should import from here.
export {
  createWorldRenderer, CITY_PICK_RADIUS_DP,
  type WorldRenderer, type WorldRendererOptions, type WorldStats, type CityView, type HubLoadView,
  type RouteView, type PlaneView, type RoutePreviewView, type ScreenPoint, type PickResult,
  type AirportScreenBox, // [ext-04 E2]
} from './world';
export { GlobeOrbitCamera, clampCameraDpr } from './camera';
export type { OrbitCameraOptions, OrbitCameraState, SafeAreaInsets, GeoPoint } from './camera';
export {
  AdaptiveFrameScheduler, chooseQualityPreset, resolveQualityProfile,
  AdaptiveQualityMonitor, adaptiveSteps, applyAdaptiveSteps, frameDue, QUALITY_PREFERENCES, SAVER_MAX_FPS,
  type AdaptiveStep, type QualityPreference, type QualityPreset, type QualityProfile, type FrameCallback,
} from './quality';
export { subsolarLongitudeAt, NOVEMBER_SUBSOLAR_LATITUDE_DEG, menuSunTick } from './sun'; // [night-79a R4] menuSunTick
export { latLonToVec3, vec3ToLatLon, normalizeLon, type LonLat } from './globe/geo-math';
export type { AircraftKind } from './routes';
export { contrastRatio, relativeLuminance, type LayerContrast, type PixelRect } from './contrast'; // [task-34]
export { insetsFromLayout, menuFraming, solveZoomForRadius, menuSpinRate, MENU_SPIN_DEG_PER_S, type LayoutRect, type MenuFraming } from './framing'; // [task-34] [task-39]
export { globeFrameFraming, type GlobeFrameFraming } from './framing'; // [night-79a R4] D-334
export { createMenuNetwork, type MenuNetwork } from './menuNetwork'; // [task-34]
export { SURFACE_ANCHOR_ALTITUDE } from './projection'; // [night-72a R2] D-327: altitude of projectAirport / projectLonLat
export { gpuRendererString, webgl2Available } from './contextGuard'; // [night-11h] D-118
export { STAMP_SIZE_PX, jamArcShare } from './marks'; // [ext-04 E1] D-283; [night-82a R6] D-337: marks.ts
