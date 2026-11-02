// [task-29] Small self-contained illustrated globe for the website, not the game renderer.
// Canvas 2D works without WebGL and has no runtime dependencies or network requests.
const TAU = Math.PI * 2;
const TO_RAD = Math.PI / 180;
const TEX_W = 1024;
const TEX_H = 512;
const SIZE = 282;
const CONTINENTS = [
  [[-166,67],[-151,72],[-131,69],[-122,60],[-134,53],[-127,47],[-124,40],[-117,32],[-111,28],[-102,25],[-97,17],[-88,14],[-83,8],[-78,9],[-80,18],[-86,22],[-90,29],[-97,31],[-98,38],[-87,43],[-80,48],[-67,47],[-58,53],[-69,60],[-83,63],[-94,70],[-111,73],[-140,69]],
  [[-80,12],[-73,9],[-66,11],[-61,9],[-56,4],[-50,0],[-47,-9],[-41,-16],[-46,-24],[-51,-30],[-56,-34],[-62,-39],[-69,-55],[-74,-50],[-75,-42],[-72,-34],[-71,-18],[-77,-8],[-82,0]],
  [[-11,36],[-10,43],[-1,44],[6,45],[10,43],[17,45],[21,39],[28,41],[35,36],[42,39],[49,41],[54,48],[65,53],[85,56],[99,53],[113,57],[126,54],[142,51],[157,58],[175,60],[176,49],[160,41],[147,37],[140,32],[130,33],[123,26],[115,19],[108,13],[105,7],[99,4],[105,-8],[115,-8],[125,-6],[130,-3],[135,-7],[133,-14],[124,-10],[114,-1],[107,0],[100,8],[92,17],[81,8],[78,14],[72,20],[69,25],[60,26],[51,18],[43,13],[42,22],[36,30],[31,31],[27,34],[22,38],[15,37],[10,36],[1,37]],
  [[-17,36],[-5,36],[11,37],[25,32],[34,30],[43,12],[51,10],[45,-2],[40,-10],[35,-21],[32,-29],[20,-35],[13,-32],[10,-24],[5,-12],[-1,-2],[-8,5],[-14,19]],
  [[112,-11],[116,-20],[124,-21],[133,-14],[140,-11],[145,-14],[152,-25],[153,-30],[148,-38],[137,-39],[128,-35],[116,-34],[113,-25]],
  [[-55,59],[-45,59],[-42,63],[-43,76],[-51,83],[-60,80],[-62,70]],
  [[47,-13],[49,-16],[48,-25],[45,-26],[43,-19]],
  [[-24,64],[-14,65],[-13,67],[-20,67]],
  [[-180,-69],[-150,-69],[-112,-72],[-77,-70],[-43,-73],[0,-71],[45,-69],[90,-73],[134,-69],[180,-68],[180,-90],[-180,-90]]
];
const CITY = [
  { code: 'LHR', lon: -0.45, lat: 51.47, hub: true },
  { code: 'JFK', lon: -73.78, lat: 40.64 },
  { code: 'WAW', lon: 20.97, lat: 52.17 },
  { code: 'DXB', lon: 55.36, lat: 25.25, hub: true },
  { code: 'LOS', lon: 3.32, lat: 6.58 },
  { code: 'SIN', lon: 103.99, lat: 1.35 },
  { code: 'HND', lon: 139.78, lat: 35.55 }
];
const LINKS = [[0,1],[0,2],[0,3],[0,4],[3,5],[3,6]];
const CLOUDS = [[-32,54,25],[43,34,18],[-94,31,13],[124,14,15],[-53,-18,17]];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function seededRandom() {
  let state = 0xA1A1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let v = Math.imul(state ^ (state >>> 15), state | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}
function mapX(lon) { return (lon + 180) / 360 * TEX_W; }
function mapY(lat) { return (90 - lat) / 180 * TEX_H; }
function fillPolygon(ctx, points, color, stroke = null) {
  ctx.beginPath();
  points.forEach(([lon, lat], i) => i ? ctx.lineTo(mapX(lon), mapY(lat)) : ctx.moveTo(mapX(lon), mapY(lat)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke(); }
}
function makeWorldTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W; canvas.height = TEX_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = '#1f5f86'; ctx.fillRect(0, 0, TEX_W, TEX_H);
  const rng = seededRandom();
  for (let i = 0; i < 3900; i++) {
    ctx.fillStyle = rng() > 0.54 ? 'rgba(145,205,211,.11)' : 'rgba(8,48,82,.09)';
    ctx.fillRect(rng() * TEX_W, rng() * TEX_H, rng() * 8 + 1, rng() * 2 + .7);
  }
  for (const land of CONTINENTS) fillPolygon(ctx, land, '#86b35a', '#549d79');
  const regions = [
    { poly: [[-17,34],[30,33],[33,22],[42,12],[26,8],[5,13],[-12,16]], color: '#dcb36e' },
    { poly: [[32,31],[62,31],[60,17],[45,12]], color: '#dcb36e' },
    { poly: [[72,42],[111,44],[131,33],[118,24],[78,25]], color: '#9ab974' },
    { poly: [[112,-12],[145,-12],[154,-27],[137,-34],[115,-30]], color: '#dcb36e' },
    { poly: [[-120,55],[-80,53],[-82,43],[-107,44]], color: '#4f8a45' },
    { poly: [[-78,9],[-48,7],[-53,-15],[-71,-21]], color: '#4f8a45' },
    { poly: [[-17,9],[31,9],[25,-10],[-7,-8]], color: '#4f8a45' },
    { poly: [[-64,74],[-44,76],[-46,61],[-55,61]], color: '#f3f1ea' },
    { poly: [[-180,-68],[180,-68],[180,-90],[-180,-90]], color: '#f3f1ea' }
  ];
  for (const item of regions) fillPolygon(ctx, item.poly, item.color);
  // High-altitude land ridges and small forests are baked into the texture once.
  const chains = [
    [[-125,57],[-117,43],[-109,35]], [[-75,7],[-72,-6],[-69,-24],[-71,-39]],
    [[6,46],[13,47],[19,48]], [[42,39],[58,38]], [[70,35],[84,30],[98,30]]
  ];
  for (const chain of chains) {
    for (let j = 0; j < chain.length - 1; j++) {
      const [a,b] = [chain[j],chain[j + 1]];
      for (let k = 0; k < 22; k++) {
        const q = k / 22;
        const x = mapX(a[0] + (b[0] - a[0]) * q) + (rng() - .5) * 11;
        const y = mapY(a[1] + (b[1] - a[1]) * q) + (rng() - .5) * 8;
        ctx.fillStyle = rng() > .55 ? '#e0dacb' : '#7d8975';
        ctx.beginPath(); ctx.moveTo(x, y - 4 - rng() * 3);
        ctx.lineTo(x - 3, y + 2); ctx.lineTo(x + 3, y + 2); ctx.fill();
      }
    }
  }
  return ctx.getImageData(0, 0, TEX_W, TEX_H).data;
}
function xyz(lon, lat) {
  const phi = lon * TO_RAD, theta = lat * TO_RAD;
  const c = Math.cos(theta);
  return { x: c * Math.sin(phi), y: Math.sin(theta), z: c * Math.cos(phi) };
}
function buildRoutes() {
  return LINKS.map(([a,b]) => {
    const start = xyz(CITY[a].lon, CITY[a].lat), end = xyz(CITY[b].lon, CITY[b].lat);
    const dot = clamp(start.x*end.x + start.y*end.y + start.z*end.z, -1, 1);
    const angle = Math.acos(dot), sin = Math.sin(angle);
    const points = [];
    for (let i = 0; i <= 44; i++) {
      const t = i / 44;
      const k1 = sin > .00001 ? Math.sin((1-t)*angle)/sin : 1-t;
      const k2 = sin > .00001 ? Math.sin(t*angle)/sin : t;
      const x = start.x*k1 + end.x*k2, y = start.y*k1 + end.y*k2, z = start.z*k1 + end.z*k2;
      const r = 1.033 + .055 * Math.sin(Math.PI*t);
      points.push({ x:x*r, y:y*r, z:z*r });
    }
    return points;
  });
}

export function mountGlobe(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const texture = makeWorldTexture();
  if (!texture) return;
  const image = document.createElement('canvas'); image.width = SIZE; image.height = SIZE;
  const imageCtx = image.getContext('2d', { alpha: true });
  if (!imageCtx) return;
  const pixels = imageCtx.createImageData(SIZE, SIZE);
  const count = SIZE*SIZE;
  const baseU = new Float32Array(count), baseV = new Uint16Array(count), shade = new Float32Array(count);
  const coast = pixels.data;
  const half = (SIZE-1)/2, invHalf = 1/half;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = y*SIZE+x, nx = (x-half)*invHalf, ny = (half-y)*invHalf, rr = nx*nx+ny*ny;
    if (rr > 1) { baseV[i] = 65535; continue; }
    const nz = Math.sqrt(1-rr);
    baseU[i] = (Math.atan2(nx,nz)/TAU + .5)*TEX_W;
    baseV[i] = clamp(Math.floor((.5-Math.asin(ny)/Math.PI)*TEX_H),0,TEX_H-1);
    const light = clamp(.43 + .65*(nx*(-.45)+ny*.54+nz*.72), .20, 1.10);
    shade[i] = light * (.90 + .10*nz);
  }
  const routes = buildRoutes();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let width = 520, height = 520, dpr = 1, radius = 204;
  let yaw = -18 * TO_RAD, time = 0, lastTime = 0, visible = true, pointer = null, frame = 0;
  const rotatePoint = (p, sine, cosine) => ({
    x: p.x*cosine - p.z*sine,
    y: p.y,
    z: p.x*sine + p.z*cosine
  });
  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width)); height = Math.max(1, Math.round(bounds.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    radius = Math.min(width,height)*.407;
    render();
  };
  function sphere() {
    const offset = yaw/TAU*TEX_W;
    for (let i=0; i<count; i++) {
      const d = i*4, v = baseV[i];
      if (v === 65535) { coast[d+3]=0; continue; }
      let u = Math.floor(baseU[i]+offset) % TEX_W;
      if (u < 0) u += TEX_W;
      const idx = (v*TEX_W+u)*4, light = shade[i];
      coast[d] = texture[idx]*light;
      coast[d+1] = texture[idx+1]*light;
      coast[d+2] = texture[idx+2]*light;
      coast[d+3] = 255;
    }
    imageCtx.putImageData(pixels,0,0);
    const cx = width*.5, cy = height*.51;
    ctx.save();
    ctx.strokeStyle = 'rgba(31,95,134,.26)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(cx,cy,radius*1.08,0,TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(247,243,234,.65)'; ctx.lineWidth = 3;
    ctx.beginPath();ctx.arc(cx,cy,radius+3,0,TAU);ctx.stroke();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image,cx-radius,cy-radius,radius*2,radius*2);
    ctx.restore();
  }
  function drawRoute(points, sine, cosine, index) {
    const cx = width*.5, cy = height*.51;
    ctx.lineWidth = Math.max(1.3,radius*.009);
    ctx.strokeStyle = index%3===0 ? 'rgba(255,233,160,.94)' : 'rgba(249,249,241,.88)';
    ctx.beginPath(); let drawing = false;
    for (let i=0; i<points.length; i++) {
      const v = points[i], x = v.x*cosine-v.z*sine, z = v.x*sine+v.z*cosine;
      const r = Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z);
      if (z < -.01 || x*x+v.y*v.y > r*r) { drawing=false;continue; }
      const px = cx+x*radius, py=cy-v.y*radius;
      if (drawing) ctx.lineTo(px,py); else ctx.moveTo(px,py);
      drawing=true;
    }
    ctx.stroke();
    const progress = reduced ? .45 : (time*.00007 + index*.13) % 1;
    const n = clamp(Math.round(progress*(points.length-1)),0,points.length-2);
    const plane=points[n], next=points[n+1];
    const now=rotatePoint(plane,sine,cosine), after=rotatePoint(next,sine,cosine);
    if (now.z < 0 || after.z < 0) return;
    const size = Math.max(3,radius*.028);
    const heading = Math.atan2(after.y-now.y,after.x-now.x);
    ctx.save();ctx.translate(cx+now.x*radius,cy-now.y*radius);ctx.rotate(-heading);
    ctx.fillStyle='#fff7e3';ctx.strokeStyle='#204b50';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(-size*.48,-size*.38);ctx.lineTo(-size*.20,0);ctx.lineTo(-size*.48,size*.38);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function markAirports(sine,cosine) {
    const cx=width*.5,cy=height*.51;
    for (let i=0;i<CITY.length;i++) {
      const city=CITY[i], pos=xyz(city.lon,city.lat), p=rotatePoint(pos,sine,cosine);
      if (p.z < .17) continue;
      const x=cx+p.x*radius, y=cy-p.y*radius;
      const ring=city.hub?radius*.033:radius*.022;
      ctx.beginPath();ctx.arc(x,y,ring,0,TAU);ctx.fillStyle='rgba(251,248,241,.96)';ctx.fill();
      ctx.beginPath();ctx.arc(x,y,ring*.52,0,TAU);ctx.fillStyle=city.hub?'#ff7a3d':'#13302e';ctx.fill();
      if (city.hub && p.z > .4) {
        ctx.strokeStyle='#f7f3ea';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(x,y,ring*1.65,0,TAU);ctx.stroke();
      }
      if ((i===0||i===3||i===1) && p.z > .4) {
        ctx.font=`700 ${Math.max(10, radius*.052)}px OverpassMono, monospace`;
        ctx.textAlign='left';ctx.textBaseline='middle';
        const pad=5, tw=ctx.measureText(city.code).width;
        const boxX=x+ring+6, boxY=y-12;
        ctx.fillStyle='#fbf8f1';ctx.fillRect(boxX,boxY,tw+pad*2,23);
        ctx.fillStyle='#13302e';ctx.fillText(city.code,boxX+pad,boxY+11.5);
      }
    }
  }
  function clouds(sine,cosine) {
    const cx=width*.5,cy=height*.51;
    for (let i=0;i<CLOUDS.length;i++) {
      const cloud=CLOUDS[i], pos=xyz(cloud[0] + (reduced ? 0 : time*.00023),cloud[1]), p=rotatePoint(pos,sine,cosine);
      if (p.z < .24) continue;
      const x=cx+p.x*radius*1.014,y=cy-p.y*radius*1.014;
      const size=cloud[2]/100*radius;
      ctx.save();ctx.translate(x,y);ctx.rotate(-.21);
      ctx.globalAlpha=.43*p.z;
      ctx.fillStyle='#f9f6ea';
      ctx.beginPath();ctx.ellipse(0,0,size,Math.max(2,size*.28),0,0,TAU);ctx.fill();ctx.restore();
    }
  }
  function render() {
    if (!width||!height) return;
    ctx.clearRect(0,0,width,height);
    sphere();
    const sine=Math.sin(yaw), cosine=Math.cos(yaw);
    // A route is a set of sampled great-circle points, elevated slightly above the world.
    for(let j=0;j<routes.length;j++) drawRoute(routes[j],sine,cosine,j);
    markAirports(sine,cosine);
    clouds(sine,cosine);
  }
  function tick(now) {
    frame=0;
    if (!visible || document.hidden) { lastTime=0; return; }
    if (!lastTime) lastTime=now;
    const dt=Math.min(70,now-lastTime);lastTime=now;
    if (!pointer) yaw=(yaw+dt*.000035)%TAU;
    time+=dt;
    render();
    frame=window.setTimeout(()=>requestAnimationFrame(tick),40);
  }
  function start() {
    if (!visible || document.hidden || reduced || frame) return;
    lastTime=0;frame=window.setTimeout(()=>requestAnimationFrame(tick),40);
  }
  function endDrag(event) {
    if (pointer && pointer.id===event.pointerId) {
      pointer=null;canvas.releasePointerCapture?.(event.pointerId);start();
    }
  }
  canvas.addEventListener('pointerdown',(event)=>{
    if(event.button!==0 || pointer) return;
    pointer={id:event.pointerId,x:event.clientX};
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove',(event)=>{
    if (!pointer||event.pointerId!==pointer.id) return;
    yaw-=(event.clientX-pointer.x)*.006;
    pointer.x=event.clientX;
    if (reduced) render();
  });
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  const sizeObserver=typeof ResizeObserver==='function' ? new ResizeObserver(resize) : null;
  sizeObserver?.observe(canvas);
  window.addEventListener('resize',resize,{passive:true});
  const intersection=typeof IntersectionObserver==='function'
    ? new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible) start();}, {threshold:0}) : null;
  intersection?.observe(canvas);
  document.addEventListener('visibilitychange',start);
  resize();
  canvas.closest('.hero-visual')?.classList.add('globe-ready');
  start();
}
