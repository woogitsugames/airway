// [task-21] Isolated, deterministic render fixture until tasks 06/10/11 land on dev.
// This is not a simulation or a substitute for an integrated gameplay benchmark.
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DirectionalLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  AdaptiveFrameScheduler,
  applyQualityProfile,
  resolveQualityProfile,
  type QualityPreference,
} from './quality';

const CITY_COUNT = 40;
const PLANE_COUNT = 100;
const ROUTE_COUNT = 40;
const SEED = '0xA1A1';
const SPEED = 4;
const HISTORY = 8192;
const UP = new Vector3(0, 1, 0);

export interface PerfSnapshot {
  renderedFrames: number;
  simulatedMinutes: number;
  drawCalls: number;
  triangles: number;
  overlayDomElements: number;
  geometries: number;
  textures: number;
  lastRenderCpuMs: number;
  lastFrameIntervalMs: number;
}

export interface PerfSummary {
  frameCount: number;
  meanRenderCpuMs: number;
  p95RenderCpuMs: number;
  maxRenderCpuMs: number;
  meanFrameIntervalMs: number;
  p95FrameIntervalMs: number;
}

export interface PerfFixture {
  readonly seed: string;
  readonly speed: number;
  readonly counts: { cities: number; planes: number; routes: number };
  readonly preset: string;
  readonly pixelRatio: number;
  read(): PerfSnapshot;
  summarize(): PerfSummary;
  setInteracting(value: boolean): void;
  dispose(): void;
}

function summarizeHistory(buffer: Float32Array, recorded: number): {
  mean: number;
  p95: number;
  max: number;
} {
  const length = Math.min(recorded, HISTORY);
  if (length === 0) return { mean: 0, p95: 0, max: 0 };
  const sorted = new Array<number>(length);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const value = buffer[i];
    sorted[i] = value;
    sum += value;
  }
  sorted.sort((a, b) => a - b);
  return {
    mean: sum / length,
    p95: sorted[Math.ceil(length * 0.95) - 1],
    max: sorted[length - 1],
  };
}

export function mountPerformanceFixture(
  host: HTMLElement,
  preference: QualityPreference = 'medium',
): PerfFixture {
  const profile = resolveQualityProfile(preference);
  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 20);
  camera.position.set(0.7, 0.6, 3.5);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({
    alpha: false, antialias: profile.antialias, powerPreference: 'high-performance',
  });
  applyQualityProfile(renderer, profile);
  renderer.setClearColor('#8CC3D8');
  host.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';

  const ambient = new AmbientLight('#ffffff', 1.45);
  scene.add(ambient);
  const sun = new DirectionalLight('#fff3db', 2.4);
  sun.position.set(2, 3, 4);
  sun.castShadow = profile.shadowEnabled;
  if (profile.shadowEnabled) {
    sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 12;
  }
  scene.add(sun);

  const geometries: BufferGeometry[] = [];
  const materials = [
    new MeshLambertMaterial({ color: '#1F5F86', flatShading: true }),
    new MeshBasicMaterial({ color: '#FFC72C' }),
    new MeshLambertMaterial({ color: '#F7F3EA', flatShading: true }),
    new MeshBasicMaterial({ color: '#F3F1EA', transparent: true, opacity: 0.72 }),
    new LineBasicMaterial({ color: '#FBF8F1', transparent: true, opacity: 0.85 }),
  ];
  const globeGeometry = new SphereGeometry(
    1, profile.globeWidthSegments, profile.globeHeightSegments,
  );
  geometries.push(globeGeometry);
  const globe = new Mesh(globeGeometry, materials[0]);
  globe.receiveShadow = profile.shadowEnabled;
  scene.add(globe);

  const cities: Vector3[] = [];
  for (let i = 0; i < CITY_COUNT; i++) {
    // A fixed spatial lattice; no randomness and no authoritative simulation state.
    const latitude = (((i * 43) % 124) - 62) * Math.PI / 180;
    const longitude = (((i * 97) % 360) - 180) * Math.PI / 180;
    cities.push(new Vector3(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(longitude),
    ));
  }

  const dummy = new Object3D();
  const work = new Vector3();
  const tangent = new Vector3();
  const projected = new Vector3();

  const airportGeometry = new CylinderGeometry(0.025, 0.025, 0.012, 8);
  geometries.push(airportGeometry);
  const airports = new InstancedMesh(airportGeometry, materials[1], CITY_COUNT);
  airports.frustumCulled = false;
  for (let i = 0; i < CITY_COUNT; i++) {
    dummy.position.copy(cities[i]).multiplyScalar(1.014);
    dummy.quaternion.setFromUnitVectors(UP, cities[i]);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    airports.setMatrixAt(i, dummy.matrix);
  }
  airports.instanceMatrix.needsUpdate = true;
  scene.add(airports);

  const routeGeometry = new BufferGeometry();
  const segmentCount = profile.routeSegments;
  const routePositions = new Float32Array(ROUTE_COUNT * segmentCount * 6);
  let offset = 0;
  for (let route = 0; route < ROUTE_COUNT; route++) {
    const from = cities[route];
    const to = cities[(route + 7 + route % 4) % CITY_COUNT];
    for (let segment = 0; segment < segmentCount; segment++) {
      for (let endpoint = 0; endpoint < 2; endpoint++) {
        const fraction = (segment + endpoint) / segmentCount;
        work.lerpVectors(from, to, fraction).normalize();
        work.multiplyScalar(1.07 + 0.11 * Math.sin(Math.PI * fraction));
        routePositions[offset++] = work.x;
        routePositions[offset++] = work.y;
        routePositions[offset++] = work.z;
      }
    }
  }
  routeGeometry.setAttribute('position', new BufferAttribute(routePositions, 3));
  geometries.push(routeGeometry);
  const routes = new LineSegments(routeGeometry, materials[4]);
  routes.frustumCulled = false;
  scene.add(routes);

  const planeGeometry = new BoxGeometry(
    0.036, 0.013, 0.075, 1 + profile.planeDetail, 1, 1 + profile.planeDetail,
  );
  geometries.push(planeGeometry);
  const planes = new InstancedMesh(planeGeometry, materials[2], PLANE_COUNT);
  planes.frustumCulled = false;
  planes.castShadow = profile.shadowEnabled;
  scene.add(planes);

  const cloudGeometry = new SphereGeometry(0.036, 6, 4);
  geometries.push(cloudGeometry);
  const clouds = new InstancedMesh(cloudGeometry, materials[3], profile.cloudInstances);
  clouds.frustumCulled = false;
  for (let i = 0; i < profile.cloudInstances; i++) {
    const latitude = (((i * 37) % 138) - 69) * Math.PI / 180;
    const longitude = (((i * 81) % 360) - 180) * Math.PI / 180;
    dummy.position.set(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(longitude),
    ).multiplyScalar(1.12);
    dummy.quaternion.identity();
    dummy.scale.setScalar(0.7 + (i % 4) * 0.16);
    dummy.updateMatrix();
    clouds.setMatrixAt(i, dummy.matrix);
  }
  clouds.instanceMatrix.needsUpdate = true;
  scene.add(clouds);

  const overlay = document.createElement('div');
  overlay.dataset.perfOverlay = 'true';
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  const tags: HTMLSpanElement[] = [];
  for (let i = 0; i < Math.min(CITY_COUNT, profile.maxOverlayItems); i++) {
    const tag = document.createElement('span');
    tag.dataset.perfOverlayItem = 'true';
    tag.textContent = String(i + 1);
    tag.style.cssText =
      'position:absolute;padding:1px 3px;background:#FBF8F1;color:#13302E;' +
      'font:11px monospace;display:none;white-space:nowrap';
    overlay.appendChild(tag);
    tags.push(tag);
  }
  host.appendChild(overlay);

  let width = 1;
  let height = 1;
  const resize = (): void => {
    width = Math.max(1, host.clientWidth || window.innerWidth);
    height = Math.max(1, host.clientHeight || window.innerHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // Camera and cities are stationary in the idle fixture. No DOM writes on a frame.
    for (let i = 0; i < CITY_COUNT; i++) {
      const tag = tags[i];
      if (cities[i].dot(camera.position) <= 1.0) {
        tag.style.display = 'none';
        continue;
      }
      projected.copy(cities[i]).multiplyScalar(1.05).project(camera);
      if (projected.z < -1 || projected.z > 1) {
        tag.style.display = 'none';
        continue;
      }
      tag.style.display = 'block';
      tag.style.left = Math.round((projected.x + 1) * width / 2) + 'px';
      tag.style.top = Math.round((1 - projected.y) * height / 2) + 'px';
    }
  };
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  resizeObserver?.observe(host);
  window.addEventListener('resize', resize);
  resize();

  const cpuHistory = new Float32Array(HISTORY);
  const intervalHistory = new Float32Array(HISTORY);
  let frameCount = 0;
  let elapsedSimulationMs = 0;
  let lastRenderCpuMs = 0;
  let lastFrameIntervalMs = 0;

  const paint = (_timestamp: number, elapsedMs: number): void => {
    elapsedSimulationMs += elapsedMs * SPEED;
    const progress = elapsedSimulationMs / 100000;
    for (let plane = 0; plane < PLANE_COUNT; plane++) {
      const route = plane % ROUTE_COUNT;
      const from = cities[route];
      const to = cities[(route + 7 + route % 4) % CITY_COUNT];
      const fraction = (progress + ((plane * 37) % 100) / 100) % 1;
      dummy.position.lerpVectors(from, to, fraction).normalize();
      dummy.position.multiplyScalar(1.065 + 0.10 * Math.sin(Math.PI * fraction));
      tangent.copy(to).sub(from).normalize();
      dummy.quaternion.setFromUnitVectors(UP, tangent);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      planes.setMatrixAt(plane, dummy.matrix);
    }
    planes.instanceMatrix.needsUpdate = true;

    const start = performance.now();
    renderer.render(scene, camera);
    lastRenderCpuMs = performance.now() - start;
    lastFrameIntervalMs = elapsedMs;
    const index = frameCount % HISTORY;
    cpuHistory[index] = lastRenderCpuMs;
    intervalHistory[index] = elapsedMs;
    frameCount++;
  };

  // Reuse one frame callback; no per-frame Object3D/Vector3/array allocations.
  const scheduler = new AdaptiveFrameScheduler(host, paint);

  return {
    seed: SEED,
    speed: SPEED,
    counts: { cities: CITY_COUNT, planes: PLANE_COUNT, routes: ROUTE_COUNT },
    preset: profile.preset,
    pixelRatio: profile.pixelRatio,
    read: (): PerfSnapshot => ({
      renderedFrames: frameCount,
      simulatedMinutes: elapsedSimulationMs / 60000,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      overlayDomElements: overlay.childElementCount,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      lastRenderCpuMs,
      lastFrameIntervalMs,
    }),
    summarize: (): PerfSummary => {
      const cpu = summarizeHistory(cpuHistory, frameCount);
      const interval = summarizeHistory(intervalHistory, frameCount);
      return {
        frameCount,
        meanRenderCpuMs: cpu.mean,
        p95RenderCpuMs: cpu.p95,
        maxRenderCpuMs: cpu.max,
        meanFrameIntervalMs: interval.mean,
        p95FrameIntervalMs: interval.p95,
      };
    },
    setInteracting: (value: boolean): void => scheduler.setInteracting(value),
    dispose: (): void => {
      scheduler.dispose();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      overlay.remove();
      for (let i = 0; i < geometries.length; i++) geometries[i].dispose();
      for (let i = 0; i < materials.length; i++) materials[i].dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
