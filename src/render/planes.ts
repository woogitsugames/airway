/** Read-only aircraft snapshot adapter and allocation-free per-frame presentation. */
import {
  CircleGeometry, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4,
  MeshBasicMaterial, PerspectiveCamera, Quaternion, Vector3, BoxGeometry,
  CylinderGeometry,
} from 'three';
import {
  distanceForSegment, sampleRouteDistance, type AircraftKind,
  type PreparedRoute, type RouteLayer,
} from './routes';
import { createInstancedPlaneModel } from './models/planes';

/** progress01 is an integer from 0 to progressScale (default 10,000). */
export interface PlaneRenderSnapshot {
  readonly id: string;
  readonly routeId: string;
  readonly segment: number;
  readonly progress01: number;
  readonly direction?: 1 | -1;
  readonly type?: AircraftKind;
  readonly load: number;
  readonly capacity?: number;
}

export interface PlaneLayerOptions {
  readonly maxPlanes?: number;
  readonly progressScale?: number;
  /** Camera distance from centre below which the five-segment load tag appears. */
  readonly loadTagZoomDistance?: number;
}

export interface PlaneRenderStats {
  readonly planes: number;
  readonly turboprops: number;
  readonly widebodies: number;
  /** Geometry passes only; consult renderer.info.render.calls for measured WebGL draw calls. */
  readonly mainPassCalls: number;
  readonly triangles: number;
  readonly droppedPlanes: number;
}

interface PlaneTrack {
  route: PreparedRoute;
  type: AircraftKind;
  slot: number;
  fromDistance: number;
  toDistance: number;
  direction: 1 | -1;
  load: number;
  capacity: number;
}

const NEAR_LANDING = 0.08;
const DEFAULT_PROGRESS_SCALE = 10_000;
const BAR_STEPS = 5;
const LOADED = new Color('#f7f3ea');
const EMPTY = new Color('#6b7f7a');
const CRITICAL = new Color('#c8352a');

export function planeProgressDistance(
  route: PreparedRoute, snapshot: PlaneRenderSnapshot, progressScale = DEFAULT_PROGRESS_SCALE,
): number {
  if (!Number.isFinite(snapshot.progress01) || progressScale <= 0) return Number.NaN;
  return distanceForSegment(route, snapshot.segment,
    snapshot.progress01 / progressScale, snapshot.direction === -1 ? -1 : 1);
}

/** Interpolating route distance instead of segment-local progress prevents waypoint jumps. */
export function interpolatePlaneDistance(fromDistance: number, toDistance: number, alpha: number): number {
  const weight = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0;
  return fromDistance + (toDistance - fromDistance) * weight;
}

export class PlaneLayer {
  readonly group = new Group();
  private readonly routes: RouteLayer;
  private readonly maxPlanes: number;
  private readonly progressScale: number;
  private readonly zoomThreshold: number;
  private readonly turboprops;
  private readonly widebodies;
  private readonly shadow: InstancedMesh;
  private readonly trails: InstancedMesh;
  private readonly bars: InstancedMesh;
  private readonly tracks: PlaneTrack[] = [];
  private readonly prior = new Map<string, PlaneRenderSnapshot>();
  private readonly position = new Vector3();
  private readonly forward = new Vector3();
  private readonly up = new Vector3();
  private readonly right = new Vector3();
  private readonly north = new Vector3();
  private readonly cameraRight = new Vector3();
  private readonly cameraUp = new Vector3();
  private readonly shadowPosition = new Vector3();
  private readonly barPosition = new Vector3();
  private readonly modelScale = new Vector3();
  private readonly shadowScale = new Vector3();
  private readonly barScale = new Vector3(0.0041, 0.0029, 0.0008);
  private readonly modelRotation = new Quaternion();
  private readonly shadowRotation = new Quaternion();
  private readonly worldMatrix = new Matrix4();
  private readonly basis = new Matrix4();
  private readonly shadowMatrix = new Matrix4();
  private readonly trailMatrix = new Matrix4();
  private readonly leftTrail = new Matrix4();
  private readonly rightTrail = new Matrix4();
  private readonly barMatrix = new Matrix4();
  private readonly cameraRotation = new Quaternion();
  private readonly shadowMaterial: MeshBasicMaterial;
  private readonly trailMaterial: MeshBasicMaterial;
  private readonly barMaterial: MeshBasicMaterial;
  private dropped = 0;
  private countTurboprop = 0;
  private countWidebody = 0;

  constructor(routes: RouteLayer, options: PlaneLayerOptions = {}) {
    this.routes = routes;
    this.maxPlanes = Math.max(1, Math.floor(options.maxPlanes ?? 100));
    this.progressScale = options.progressScale ?? DEFAULT_PROGRESS_SCALE;
    if (!Number.isFinite(this.progressScale) || this.progressScale <= 0) {
      throw new Error('PlaneLayer progressScale must be a positive number');
    }
    this.zoomThreshold = options.loadTagZoomDistance ?? 3.0;
    this.turboprops = createInstancedPlaneModel('turboprop', this.maxPlanes);
    this.widebodies = createInstancedPlaneModel('widebody', this.maxPlanes);
    this.group.add(this.turboprops.group, this.widebodies.group);

    this.shadowMaterial = new MeshBasicMaterial({ color: '#153a40', transparent: true,
      opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.shadow = new InstancedMesh(new CircleGeometry(1, 12), this.shadowMaterial, this.maxPlanes);
    this.shadow.instanceMatrix.setUsage(DynamicDrawUsage);
    this.shadow.count = 0;
    this.shadow.frustumCulled = false;
    this.shadow.renderOrder = 2;
    this.group.add(this.shadow);

    this.trailMaterial = new MeshBasicMaterial({ color: '#fffaf0', transparent: true,
      opacity: 0.46, depthWrite: false });
    // A pair of short exhaust trails is one instanced pass for every widebody.
    this.trails = new InstancedMesh(
      new CylinderGeometry(0.016, 0.005, 1.1, 5).rotateX(Math.PI / 2),
      this.trailMaterial, this.maxPlanes * 2,
    );
    this.trails.instanceMatrix.setUsage(DynamicDrawUsage);
    this.trails.count = 0;
    this.trails.frustumCulled = false;
    this.group.add(this.trails);
    this.leftTrail.makeTranslation(-0.37, -0.02, -1.30);
    this.rightTrail.makeTranslation(0.37, -0.02, -1.30);

    this.barMaterial = new MeshBasicMaterial({ color: '#ffffff', depthTest: true, depthWrite: false });
    this.bars = new InstancedMesh(new BoxGeometry(1, 1, 1), this.barMaterial, this.maxPlanes * BAR_STEPS);
    this.bars.instanceMatrix.setUsage(DynamicDrawUsage);
    this.bars.count = 0;
    this.bars.visible = false;
    this.bars.frustumCulled = false;
    this.group.add(this.bars);
  }

  /** Called on tick boundaries, never on the WebGL frame loop. Does not mutate the simulation. */
  setSnapshots(previous: readonly PlaneRenderSnapshot[], current: readonly PlaneRenderSnapshot[]): void {
    this.prior.clear();
    for (let i = 0; i < previous.length; i++) this.prior.set(previous[i].id, previous[i]);
    this.tracks.length = 0;
    this.dropped = 0;
    this.countTurboprop = 0;
    this.countWidebody = 0;
    for (let i = 0; i < current.length; i++) {
      const now = current[i];
      const route = this.routes.getRoute(now.routeId);
      if (!route) { this.dropped++; continue; }
      const type = now.type ?? route.type;
      const before = this.prior.get(now.id);
      const toDistance = planeProgressDistance(route, now, this.progressScale);
      if (!Number.isFinite(toDistance)) { this.dropped++; continue; }
      let fromDistance = toDistance;
      if (before && before.routeId === now.routeId && (before.type ?? route.type) === type) {
        const priorDistance = planeProgressDistance(route, before, this.progressScale);
        if (Number.isFinite(priorDistance)) fromDistance = priorDistance;
      }
      const slot = type === 'widebody' ? this.countWidebody++ : this.countTurboprop++;
      if (slot >= this.maxPlanes || this.tracks.length >= this.maxPlanes) {
        this.dropped++;
        if (type === 'widebody') this.countWidebody--;
        else this.countTurboprop--;
        continue;
      }
      const capacity = Math.max(1, now.capacity ?? (type === 'widebody' ? 300 : 48));
      const load = Math.max(0, Math.min(capacity, Number.isFinite(now.load) ? now.load : 0));
      this.tracks.push({ route, type, slot, fromDistance, toDistance,
        direction: now.direction === -1 ? -1 : 1, load, capacity });
      for (let step = 0; step < BAR_STEPS; step++) {
        const active = (step + 0.5) / BAR_STEPS <= load / capacity;
        this.bars.setColorAt((this.tracks.length - 1) * BAR_STEPS + step,
          active ? (load / capacity >= 0.8 ? CRITICAL : LOADED) : EMPTY);
      }
    }
    this.turboprops.setCount(this.countTurboprop);
    this.widebodies.setCount(this.countWidebody);
    this.shadow.count = this.tracks.length;
    this.trails.count = this.countWidebody * 2;
    this.bars.count = this.tracks.length * BAR_STEPS;
    if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true;
  }

  /** Call per animation frame with [0,1] tick accumulator fraction. Never allocates. */
  update(alpha: number, camera: PerspectiveCamera): void {
    camera.getWorldQuaternion(this.cameraRotation);
    this.cameraRight.set(1, 0, 0).applyQuaternion(this.cameraRotation);
    this.cameraUp.set(0, 1, 0).applyQuaternion(this.cameraRotation);
    this.bars.visible = camera.position.length() <= this.zoomThreshold && this.tracks.length > 0;

    for (let i = 0; i < this.tracks.length; i++) {
      const track = this.tracks[i];
      const distance = interpolatePlaneDistance(track.fromDistance, track.toDistance, alpha);
      sampleRouteDistance(track.route, distance, this.position, this.forward);
      if (track.direction === -1) this.forward.negate();
      this.up.copy(this.position).normalize();
      this.right.crossVectors(this.up, this.forward).normalize();
      this.north.crossVectors(this.forward, this.right).normalize();
      // Each leg has a short linear take-off/landing transition, with no springs.
      let leg = track.route.arcs.length - 1;
      for (let j = 0; j < track.route.arcs.length - 1; j++) {
        if (distance < track.route.cumulative[j + 1]) { leg = j; break; }
      }
      const legProgress = Math.max(0, Math.min(1,
        (distance - track.route.cumulative[leg]) / track.route.arcs[leg].angle));
      const climb = Math.min(1, legProgress / NEAR_LANDING, (1 - legProgress) / NEAR_LANDING);
      this.position.addScaledVector(this.up, 0.01 * Math.max(0, climb));
      this.basis.makeBasis(this.right, this.north, this.forward);
      this.modelRotation.setFromRotationMatrix(this.basis);
      const size = track.type === 'widebody' ? 0.045 : 0.04;
      this.modelScale.set(size, size, size);
      this.worldMatrix.compose(this.position, this.modelRotation, this.modelScale);
      if (track.type === 'widebody') {
        this.widebodies.setMatrix(track.slot, this.worldMatrix);
        this.trailMatrix.multiplyMatrices(this.worldMatrix, this.leftTrail);
        this.trails.setMatrixAt(track.slot * 2, this.trailMatrix);
        this.trailMatrix.multiplyMatrices(this.worldMatrix, this.rightTrail);
        this.trails.setMatrixAt(track.slot * 2 + 1, this.trailMatrix);
      } else {
        this.turboprops.setMatrix(track.slot, this.worldMatrix);
      }

      this.shadowPosition.copy(this.up).multiplyScalar(1.009);
      this.basis.makeBasis(this.right, this.forward, this.up);
      this.shadowRotation.setFromRotationMatrix(this.basis);
      const shadowSize = track.type === 'widebody' ? 0.026 : 0.02;
      this.shadowScale.set(shadowSize, shadowSize * 0.55, 1);
      this.shadowMatrix.compose(this.shadowPosition, this.shadowRotation, this.shadowScale);
      this.shadow.setMatrixAt(i, this.shadowMatrix);
      if (this.bars.visible) {
        for (let step = 0; step < BAR_STEPS; step++) {
          this.barPosition.copy(this.position).addScaledVector(this.up, 0.019)
            .addScaledVector(this.cameraUp, 0.036)
            .addScaledVector(this.cameraRight, (step - 2) * 0.0048);
          this.barMatrix.compose(this.barPosition, this.cameraRotation, this.barScale);
          this.bars.setMatrixAt(i * BAR_STEPS + step, this.barMatrix);
        }
      }
    }
    if (this.countWidebody) this.widebodies.finishFrame();
    if (this.countTurboprop) this.turboprops.finishFrame();
    if (this.tracks.length) this.shadow.instanceMatrix.needsUpdate = true;
    if (this.countWidebody) this.trails.instanceMatrix.needsUpdate = true;
    if (this.bars.visible) this.bars.instanceMatrix.needsUpdate = true;
  }

  get stats(): PlaneRenderStats {
    const calls = (this.countTurboprop ? this.turboprops.meshes.length : 0) +
      (this.countWidebody ? this.widebodies.meshes.length + 1 : 0) +
      (this.tracks.length ? 1 : 0) + (this.bars.visible ? 1 : 0);
    return {
      planes: this.tracks.length, turboprops: this.countTurboprop,
      widebodies: this.countWidebody, mainPassCalls: calls, droppedPlanes: this.dropped,
      triangles: this.countTurboprop * this.turboprops.trianglesPerPlane +
        this.countWidebody * this.widebodies.trianglesPerPlane +
        this.tracks.length * (this.shadow.geometry.index ? this.shadow.geometry.index.count / 3 : this.shadow.geometry.getAttribute('position').count / 3) +
        this.countWidebody * 2 * (this.trails.geometry.index ? this.trails.geometry.index.count / 3 : this.trails.geometry.getAttribute('position').count / 3) +
        (this.bars.visible ? this.tracks.length * BAR_STEPS * 12 : 0),
    };
  }

  dispose(): void {
    this.turboprops.dispose();
    this.widebodies.dispose();
    this.shadow.dispose();
    this.shadow.geometry.dispose();
    this.shadowMaterial.dispose();
    this.trails.dispose();
    this.trails.geometry.dispose();
    this.trailMaterial.dispose();
    this.bars.dispose();
    this.bars.geometry.dispose();
    this.barMaterial.dispose();
    this.group.clear();
    this.tracks.length = 0;
    this.prior.clear();
  }
}
