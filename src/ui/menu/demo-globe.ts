// [task-14] Temporary decorative renderer until task 03 supplies the shared globe API.
// This scene never reads or advances game simulation state.
import {
  AmbientLight, BufferGeometry, CatmullRomCurve3, Color, ConeGeometry, CylinderGeometry,
  DirectionalLight, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry,
  Mesh, MeshLambertMaterial, PerspectiveCamera, Scene, ShapeUtils, SphereGeometry,
  Vector2, Vector3, WebGLRenderer, TubeGeometry,
} from 'three';

interface DemoHandle { dispose(): void }
const LAND: Array<{ color: number; outline: number[][] }> = [
  { color: 0x86b35a, outline: [[-11,36],[-10,43],[-5,44],[-9,50],[-5,58],[5,60],[9,56],[17,57],[23,54],[29,46],[39,43],[33,37],[24,35],[18,40],[10,36],[3,43],[-6,36]] },
  { color: 0xdcb36e, outline: [[-17,37],[-3,36],[11,35],[26,32],[34,25],[43,11],[41,-12],[30,-34],[18,-35],[13,-24],[7,-6],[-4,5],[-12,15]] },
  { color: 0x6caa55, outline: [[-80,8],[-73,12],[-62,8],[-51,2],[-49,-14],[-56,-31],[-68,-55],[-75,-43],[-81,-10]] },
  { color: 0x83b05a, outline: [[-166,60],[-151,67],[-129,72],[-120,60],[-104,56],[-90,50],[-82,26],[-96,17],[-108,23],[-117,34],[-126,49],[-143,55]] },
  { color: 0x80ac59, outline: [[32,42],[45,61],[65,72],[96,73],[130,58],[148,45],[138,35],[120,20],[111,6],[103,0],[86,9],[73,20],[57,28],[46,37]] },
  { color: 0x9fbe6c, outline: [[113,-11],[131,-12],[153,-25],[145,-40],[120,-35]] },
  { color: 0xf3f1ea, outline: [[-44,81],[-38,82],[-28,82],[-23,75],[-42,59],[-52,60],[-56,72]] },
];
const AIRPORTS: ReadonlyArray<readonly [number, number]> = [[-0.1,51.5],[2.35,48.9],[13.4,52.5],[-74,40.7],[31,30],[28.9,41],[12.5,41.9]];
const ROUTES: ReadonlyArray<readonly [number, number]> = [[0,1],[0,2],[1,4],[2,6],[6,5],[3,0]];

function sphereAt(lon: number, lat: number, radius: number): Vector3 {
  const a = lon * Math.PI / 180;
  const b = lat * Math.PI / 180;
  return new Vector3(radius * Math.cos(b) * Math.sin(a), radius * Math.sin(b), radius * Math.cos(b) * Math.cos(a));
}

function landMesh(outline: number[][], color: number): Mesh {
  const corners = outline.map(([lon, lat]) => new Vector2(lon, lat));
  const faces = ShapeUtils.triangulateShape(corners, []);
  const vertices: number[] = [];
  const subdivision = 6;
  function onSphere(a: Vector3, b: Vector3, c: Vector3, i: number, j: number): Vector3 {
    const u = i / subdivision, v = j / subdivision;
    return new Vector3(
      a.x * (1 - u - v) + b.x * u + c.x * v,
      a.y * (1 - u - v) + b.y * u + c.y * v,
      a.z * (1 - u - v) + b.z * u + c.z * v,
    ).normalize().multiplyScalar(1.015);
  }
  function triangle(a: Vector3, b: Vector3, c: Vector3): void {
    vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  for (const face of faces) {
    const [a, b, c] = face.map((idx) => sphereAt(outline[idx][0], outline[idx][1], 1));
    for (let i = 0; i < subdivision; i++) for (let j = 0; j < subdivision - i; j++) {
      const p0 = onSphere(a, b, c, i, j);
      const p1 = onSphere(a, b, c, i + 1, j);
      const p2 = onSphere(a, b, c, i, j + 1);
      triangle(p0, p1, p2);
      if (i + j < subdivision - 1) triangle(p1, onSphere(a, b, c, i + 1, j + 1), p2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return new Mesh(geometry, new MeshLambertMaterial({ color, side: DoubleSide, flatShading: true }));
}

function makePlane(): Group {
  const plane = new Group();
  const cream = new MeshLambertMaterial({color:0xf7f3ea});
  const teal = new MeshLambertMaterial({color:0x13302e});
  const fuselage = new Mesh(new ConeGeometry(.024,.105,4),cream);
  fuselage.rotation.x=Math.PI/2;
  plane.add(fuselage);
  const wings = new Mesh(new CylinderGeometry(.008,.015,.105,4),cream);
  wings.rotation.z=Math.PI/2;
  plane.add(wings);
  const tail = new Mesh(new ConeGeometry(.018,.04,3),teal);
  tail.position.z=.052;
  plane.add(tail);
  plane.scale.setScalar(1.2);
  return plane;
}

/** Adapter returns null when WebGL is unavailable; UI remains operable. */
export function mountMenuDemo(host: HTMLElement): DemoHandle | null {
  let renderer: WebGLRenderer;
  try { renderer = new WebGLRenderer({antialias:true, alpha:false, powerPreference:'low-power'}); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
  const scene = new Scene();
  scene.background = new Color('#8cc3d8');
  const camera = new PerspectiveCamera(35,1,.1,100);
  camera.position.set(0,.2,4.9);
  const world = new Group();
  scene.add(world);
  const water = new Mesh(new IcosahedronGeometry(1,5),new MeshLambertMaterial({color:0x1f5f86,flatShading:true}));
  world.add(water);
  const shelf = new Mesh(new IcosahedronGeometry(1.006,3),new MeshLambertMaterial({color:0x4aa3b8,transparent:true,opacity:.13,flatShading:true}));
  world.add(shelf);
  for (const {color,outline} of LAND) world.add(landMesh(outline,color));
  const airportMaterial = new MeshLambertMaterial({color:0xffc72c});
  const globeDot = new SphereGeometry(.018,5,4);
  for (const [lon,lat] of AIRPORTS) {
    const mesh = new Mesh(globeDot,airportMaterial);
    mesh.position.copy(sphereAt(lon,lat,1.034));
    world.add(mesh);
  }
  const routeMaterial = new MeshLambertMaterial({color:0xf7f3ea});
  const planes: Array<{model:Group; coords:Vector3[]; offset:number}> = [];
  for (let index=0;index<ROUTES.length;index++) {
    const [from,to]=ROUTES[index];
    const [fromLon,fromLat]=AIRPORTS[from];
    const [toLon,toLat]=AIRPORTS[to];
    const origin=sphereAt(fromLon,fromLat,1.04);
    const destination=sphereAt(toLon,toLat,1.04);
    const middle=origin.clone().add(destination).normalize().multiplyScalar(1.16 + origin.distanceTo(destination)*.11);
    const path=new CatmullRomCurve3([origin,middle,destination]);
    const coords=path.getPoints(66);
    const route=new Mesh(new TubeGeometry(path,66,.004,4,false),routeMaterial);
    world.add(route);
    const model=makePlane();
    world.add(model);
    planes.push({model,coords,offset:index/ROUTES.length});
  }
  const light = new DirectionalLight(0xffffff,2.25); light.position.set(-3,4,5); scene.add(light);
  scene.add(new AmbientLight(0xffffff,1.5));
  let frame = 0;
  let stopped = false;
  let visible = true;
  let clock = 0;
  const ahead = new Vector3();
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  const visibilityObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting ?? true;});
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  function resize():void {
    const width=Math.max(host.clientWidth,1),height=Math.max(host.clientHeight,1);
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.position.z=width/height < .7 ? 4.2 : 4.5;
    camera.updateProjectionMatrix();
    world.position.x=width>height ? 1.16 : .05;
    world.position.y=width>height ? -.12 : .12;
  }
  function tick():void {
    if (stopped) return;
    if (visible && host.isConnected && document.visibilityState !== 'hidden') {
      if (!reduced) clock+=.00072;
      world.rotation.y=-.12 + (reduced ? 0 : Math.sin(clock*.25)*.1);
      for (const {model,coords,offset} of planes) {
        const t=(clock+offset)%1;
        const at=Math.min(coords.length-2,Math.floor(t*(coords.length-1)));
        const alpha=t*(coords.length-1)-at;
        const a=coords[at], b=coords[at+1];
        model.position.set(a.x+(b.x-a.x)*alpha,a.y+(b.y-a.y)*alpha,a.z+(b.z-a.z)*alpha);
        ahead.copy(b);
        model.lookAt(ahead);
      }
      renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(tick);
  }
  host.append(renderer.domElement);
  observer?.observe(host);
  visibilityObserver?.observe(host);
  window.addEventListener('resize',resize);
  resize(); tick();
  return {dispose(){stopped=true;cancelAnimationFrame(frame);observer?.disconnect();visibilityObserver?.disconnect();window.removeEventListener('resize',resize);scene.traverse(o=>{if (o instanceof Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)m.dispose();}});renderer.dispose();renderer.domElement.remove();}};
}

