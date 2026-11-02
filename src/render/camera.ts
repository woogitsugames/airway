/**
 * Globe orbit camera. It accepts the structural PerspectiveCamera API from three.js,
 * so it can be tested without a WebGL context or an installed globe renderer.
 * The globe owns world coordinates (radius 1 by default); this module only moves
 * the view and never touches the authoritative simulation.
 */
export interface PerspectiveCameraPort {
  fov: number;
  aspect: number;
  position: { set(x: number, y: number, z: number): unknown };
  up: { set(x: number, y: number, z: number): unknown };
  lookAt(x: number, y: number, z: number): unknown;
  setViewOffset(fullWidth: number, fullHeight: number, x: number, y: number, width: number, height: number): unknown;
  updateProjectionMatrix(): unknown;
}

export interface SafeAreaInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface GeoPoint {
  lon: number;
  lat: number;
}

export interface OrbitCameraOptions {
  radius?: number;
  longitude?: number;
  latitude?: number;
  zoom?: number;
  fov?: number;
}

export interface OrbitCameraState {
  longitude: number;
  latitude: number;
  zoom: number;
  tiltDegrees: number;
  rollRadians: number;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const MAX_LATITUDE = 78;
const MAX_FRAME_SECONDS = 0.05;
const FRICTION_PER_SECOND = 7;
const NORTH_ALIGN_PER_SECOND = 3.2;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const wrapLongitude = (v: number): number => ((v + 180) % 360 + 360) % 360 - 180;

/** A mobile browser's CSS pixels are dp for the gesture and safe-area contract. */
export function clampCameraDpr(dpr: number): number {
  return Number.isFinite(dpr) ? clamp(dpr, 1, 2) : 1;
}

export class GlobeOrbitCamera {
  readonly camera: PerspectiveCameraPort;
  readonly radius: number;
  private longitude: number;
  private latitude: number;
  private zoom: number;
  private width = 412;
  private height = 915;
  private fitDistance = 4;
  private yawVelocity = 0;
  private pitchVelocity = 0;
  private roll = 0;
  private pointerActive = false;
  private rotated = false;
  private safeTop = 0;
  private safeRight = 0;
  private safeBottom = 0;
  private safeLeft = 0;
  private eyeX = 0;
  private eyeY = 0;
  private eyeZ = 0;
  private centerX = 0;
  private centerY = 0;
  private centerZ = 0;
  private northX = 0;
  private northY = 1;
  private northZ = 0;

  constructor(camera: PerspectiveCameraPort, options: OrbitCameraOptions = {}) {
    this.camera = camera;
    this.radius = Number.isFinite(options.radius) && (options.radius ?? 0) > 0 ? options.radius! : 1;
    this.longitude = wrapLongitude(options.longitude ?? 14);
    this.latitude = clamp(options.latitude ?? 49, -MAX_LATITUDE, MAX_LATITUDE);
    this.zoom = clamp(options.zoom ?? 1, MIN_ZOOM, MAX_ZOOM);
    camera.fov = clamp(options.fov ?? 30, 15, 75);
    this.setViewport(this.width, this.height);
  }

  /** CSS-pixel dimensions; reserve HUD, notch and dock so the globe remains visible. */
  setViewport(width: number, height: number, insets: SafeAreaInsets = {}): void {
    this.width = Math.max(1, Number.isFinite(width) ? width : 1);
    this.height = Math.max(1, Number.isFinite(height) ? height : 1);
    this.safeTop = clamp(insets.top ?? 0, 0, this.height * 0.4);
    this.safeBottom = clamp(insets.bottom ?? 0, 0, this.height * 0.4);
    this.safeLeft = clamp(insets.left ?? 0, 0, this.width * 0.4);
    this.safeRight = clamp(insets.right ?? 0, 0, this.width * 0.4);
    this.camera.aspect = this.width / this.height;
    const freeWidth = this.width - this.safeLeft - this.safeRight;
    const freeHeight = this.height - this.safeTop - this.safeBottom;
    const halfFieldTangent = Math.tan((this.camera.fov * DEG) / 2);
    const fitTangent = Math.max(0.001, halfFieldTangent * 0.87 * Math.min(freeWidth, freeHeight) / this.height);
    this.fitDistance = this.radius * Math.sqrt(1 + 1 / (fitTangent * fitTangent));
    // three.js view offsets are CSS-pixel sub-frustum shifts, NOT device pixels.
    this.camera.setViewOffset(
      this.width, this.height,
      -(this.safeLeft - this.safeRight) / 2,
      -(this.safeTop - this.safeBottom) / 2,
      this.width, this.height,
    );
    this.apply();
  }

  /** Called on every pointer-down: inertia stops, including when an edit begins. */
  beginInteraction(): void {
    this.pointerActive = true;
    this.rotated = false;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  /** Only an actual orbit drag is allowed to produce post-release inertia. */
  endInteraction(allowInertia = true): void {
    this.pointerActive = false;
    if (!this.rotated || !allowInertia) {
      this.yawVelocity = 0;
      this.pitchVelocity = 0;
    }
    this.rotated = false;
  }

  /** Horizontal/vertical CSS-pixel displacement of a one-finger orbit gesture. */
  rotatePixels(dx: number, dy: number, elapsedMs: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const degreesPerPixel = 190 / Math.max(240, Math.min(this.width, this.height));
    const yaw = -dx * degreesPerPixel;
    const pitch = dy * degreesPerPixel;
    const previousLatitude = this.latitude;
    this.longitude = wrapLongitude(this.longitude + yaw);
    this.latitude = clamp(this.latitude + pitch, -MAX_LATITUDE, MAX_LATITUDE);
    const seconds = Math.max(0.008, Math.min(0.08, elapsedMs / 1000 || 0.016));
    // Limit flick speed so a delayed event does not launch a runaway globe.
    const velocityCap = 480;
    this.yawVelocity = clamp(yaw / seconds, -velocityCap, velocityCap);
    this.pitchVelocity = clamp((this.latitude - previousLatitude) / seconds, -velocityCap, velocityCap);
    // A subtle transient roll is straightened gently after release, not sprung.
    this.roll = clamp(this.roll + dx * 0.00006, -0.1, 0.1);
    this.rotated = true;
    this.apply();
  }

  /** Explicit edge-turn while drawing; never adds inertia. The route tool owns the trigger. */
  rotateAtLimb(degrees: number): void {
    if (!Number.isFinite(degrees)) return;
    this.longitude = wrapLongitude(this.longitude + clamp(degrees, -4, 4));
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.apply();
  }

  zoomBy(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    this.setZoom(this.zoom * factor);
  }

  setZoom(zoom: number): void {
    if (!Number.isFinite(zoom)) return;
    this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    this.apply();
  }

  setTarget(longitude: number, latitude: number): void {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    this.longitude = wrapLongitude(longitude);
    this.latitude = clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE);
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.apply();
  }

  /** Fit the visible globe disk; the far hemisphere cannot all be seen at once. */
  fitNetwork(points: readonly GeoPoint[] = []): void {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const point of points) {
      if (!Number.isFinite(point.lon) || !Number.isFinite(point.lat)) continue;
      const lat = point.lat * DEG;
      const lon = point.lon * DEG;
      const cos = Math.cos(lat);
      x += cos * Math.sin(lon);
      y += Math.sin(lat);
      z += cos * Math.cos(lon);
    }
    if (Math.hypot(x, y, z) > 0.0001) {
      this.longitude = wrapLongitude(Math.atan2(x, z) * RAD);
      this.latitude = clamp(Math.atan2(y, Math.hypot(x, z)) * RAD, -MAX_LATITUDE, MAX_LATITUDE);
    }
    this.zoom = 1;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.roll = 0;
    this.apply();
  }

  /** Invoke once per frame; no heap allocation and no autonomous motion during edits. */
  update(elapsedSeconds: number): void {
    if (this.pointerActive || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return;
    const dt = Math.min(elapsedSeconds, MAX_FRAME_SECONDS);
    if (Math.abs(this.yawVelocity) > 0.01 || Math.abs(this.pitchVelocity) > 0.01) {
      this.longitude = wrapLongitude(this.longitude + this.yawVelocity * dt);
      this.latitude = clamp(this.latitude + this.pitchVelocity * dt, -MAX_LATITUDE, MAX_LATITUDE);
      if (Math.abs(this.latitude) >= MAX_LATITUDE) this.pitchVelocity = 0;
      const damping = Math.exp(-FRICTION_PER_SECOND * dt);
      this.yawVelocity *= damping;
      this.pitchVelocity *= damping;
      if (Math.abs(this.yawVelocity) < 0.01) this.yawVelocity = 0;
      if (Math.abs(this.pitchVelocity) < 0.01) this.pitchVelocity = 0;
    }
    if (Math.abs(this.roll) > 0.00001) {
      this.roll *= Math.exp(-NORTH_ALIGN_PER_SECOND * dt);
      if (Math.abs(this.roll) < 0.00001) this.roll = 0;
    }
    if (this.yawVelocity || this.pitchVelocity || this.roll) this.apply();
  }

  /** Signed factor of a finger near the globe silhouette (40 CSS-pixel band). */
  getLimbEdgeFactor(x: number, y: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    // Camera-space axes for the oblique view, without a three.js allocation.
    const vx = this.centerX - this.eyeX;
    const vy = this.centerY - this.eyeY;
    const vz = this.centerZ - this.eyeZ;
    const vlen = Math.hypot(vx, vy, vz);
    const fx = vx / vlen;
    const fy = vy / vlen;
    const fz = vz / vlen;
    const rx0 = fy * this.northZ - fz * this.northY;
    const ry0 = fz * this.northX - fx * this.northZ;
    const rz0 = fx * this.northY - fy * this.northX;
    const rlen = Math.hypot(rx0, ry0, rz0);
    const rx = rx0 / rlen;
    const ry = ry0 / rlen;
    const rz = rz0 / rlen;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;
    const ox = -this.eyeX;
    const oy = -this.eyeY;
    const oz = -this.eyeZ;
    const depth = ox * fx + oy * fy + oz * fz;
    if (depth <= this.radius) return 0;
    const tanHalfY = Math.tan(this.camera.fov * DEG / 2);
    const projectedX = (ox * rx + oy * ry + oz * rz) / (depth * tanHalfY);
    const projectedY = (ox * ux + oy * uy + oz * uz) / (depth * tanHalfY);
    const shiftX = (this.safeLeft - this.safeRight) / 2;
    const shiftY = (this.safeTop - this.safeBottom) / 2;
    const centerPixelX = this.width / 2 + projectedX * this.height / 2 + shiftX;
    const centerPixelY = this.height / 2 - projectedY * this.height / 2 + shiftY;
    const distance = Math.hypot(this.eyeX, this.eyeY, this.eyeZ);
    const discRadius = this.height / (2 * tanHalfY) * this.radius /
      Math.sqrt(Math.max(0.0001, distance * distance - this.radius * this.radius));
    const fromCenter = Math.hypot(x - centerPixelX, y - centerPixelY);
    if (fromCenter > discRadius + 40 || fromCenter < discRadius - 40) return 0;
    const depthIntoBand = clamp((fromCenter - discRadius + 40) / 40, 0, 1);
    return Math.sign(x - centerPixelX) * depthIntoBand;
  }

  getState(): OrbitCameraState {
    return {
      longitude: this.longitude,
      latitude: this.latitude,
      zoom: this.zoom,
      tiltDegrees: this.tiltDegrees(),
      rollRadians: this.roll,
    };
  }

  private tiltDegrees(): number {
    return 7 + (this.zoom - 1) * 6.5;
  }

  private apply(): void {
    const lon = this.longitude * DEG;
    const lat = this.latitude * DEG;
    const eyeLat = clamp(this.latitude - this.tiltDegrees(), -87, 87) * DEG;
    const targetX = this.radius * Math.cos(lat) * Math.sin(lon);
    const targetY = this.radius * Math.sin(lat);
    const targetZ = this.radius * Math.cos(lat) * Math.cos(lon);
    const distance = this.radius + (this.fitDistance - this.radius) / this.zoom;
    const eyeX = distance * Math.cos(eyeLat) * Math.sin(lon);
    const eyeY = distance * Math.sin(eyeLat);
    const eyeZ = distance * Math.cos(eyeLat) * Math.cos(lon);
    // Tangent geographic north with Rodrigues rotation for slight orbit roll.
    const northX = -Math.sin(lat) * Math.sin(lon);
    const northY = Math.cos(lat);
    const northZ = -Math.sin(lat) * Math.cos(lon);
    const forwardX = targetX - eyeX;
    const forwardY = targetY - eyeY;
    const forwardZ = targetZ - eyeZ;
    const inv = 1 / Math.hypot(forwardX, forwardY, forwardZ);
    const fx = forwardX * inv;
    const fy = forwardY * inv;
    const fz = forwardZ * inv;
    const sine = Math.sin(this.roll);
    const cosine = Math.cos(this.roll);
    const dot = fx * northX + fy * northY + fz * northZ;
    const remaining = (1 - cosine) * dot;
    this.eyeX = eyeX;
    this.eyeY = eyeY;
    this.eyeZ = eyeZ;
    this.centerX = targetX;
    this.centerY = targetY;
    this.centerZ = targetZ;
    this.northX = northX * cosine + (fy * northZ - fz * northY) * sine + fx * remaining;
    this.northY = northY * cosine + (fz * northX - fx * northZ) * sine + fy * remaining;
    this.northZ = northZ * cosine + (fx * northY - fy * northX) * sine + fz * remaining;
    this.camera.position.set(eyeX, eyeY, eyeZ);
    this.camera.up.set(this.northX, this.northY, this.northZ);
    this.camera.lookAt(targetX, targetY, targetZ);
  }
}
