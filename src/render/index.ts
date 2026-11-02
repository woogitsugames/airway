// Public render API. Everything outside src/render should import from here.
export {
  createWorldRenderer, DIORAMA_SKY, CITY_PICK_RADIUS_DP,
  type WorldRenderer, type WorldRendererOptions, type WorldStats, type CityView, type HubLoadView,
  type RouteView, type PlaneView, type RoutePreviewView, type ScreenPoint, type PickResult,
} from './world';
export { GlobeOrbitCamera, clampCameraDpr } from './camera';
export type { OrbitCameraOptions, OrbitCameraState, SafeAreaInsets, GeoPoint } from './camera';
export {
  AdaptiveFrameScheduler, chooseQualityPreset, resolveQualityProfile,
  type QualityPreference, type QualityPreset, type QualityProfile, type FrameCallback,
} from './quality';
export { subsolarLongitudeAt, NOVEMBER_SUBSOLAR_LATITUDE_DEG } from './sun';
export { latLonToVec3, vec3ToLatLon, normalizeLon, type LonLat } from './globe/geo-math';
export type { AircraftKind } from './routes';
export { renderModel } from './modelPreview';
export { contrastRatio, relativeLuminance, type LayerContrast, type PixelRect } from './contrast'; // [task-34]
export { insetsFromLayout, menuFraming, solveZoomForRadius, menuSpinRate, MENU_SPIN_DEG_PER_S, type LayoutRect, type MenuFraming } from './framing'; // [task-34] [task-39]
export { createMenuNetwork, type MenuNetwork } from './menuNetwork'; // [task-34]
