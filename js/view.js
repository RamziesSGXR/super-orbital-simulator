// The 3D view: the blueprint space, the station, its rooms, ships, people, and the ways of looking at them.
//   BLUEPRINT  green lines on black in a 3D drawing space (three planes through the origin), for building
//   HULL       the station as it would look, under its sun, over a planet, with moons
//   LIFE SIGNS an x-ray: the hull fades to a ghost and every person aboard glows through the walls (people on EVA too)
//   CUTAWAY    the quarter facing the camera sliced away to show the decks and rooms inside (works with any view)
// The sky is a skybox: it moves with the camera, so stars, sun and moons never slide about when you pan or zoom.
import * as THREE from './vendor/three.js';
import { C } from './config.js';
import { buildPart, buildShip, buildRoom, buildSuit, buildFigure, buildRaider, buildEagle, FIGURES, SLOTS, WALK, partPath, wayPoint, onWalk, slotSpot, doorSide, sillY, liftR, FL, LIFT_R } from './parts.js';
import { paintWorld, WORLDS, WORLD_TYPES } from './planets.js';
import { RNG } from './rng.js';
import { drawLogo, ensureLogo } from './logo.js';

const GREEN = 0x7fe9e0, YELLOW = 0xf5d547, BLUE = 0x7fe9e0;      // the drawing lines are cyan and selections amber, as in the interface
const ROLE_COL = { resident: [0.85, 1, 0.9], hauler: [0.3, 0.72, 1], engineer: [1, 0.76, 0.25], officer: [1, 0.35, 0.29], medic: [0.6, 1, 0.75], aide: [0.96, 0.84, 0.28], scientist: [0.7, 0.55, 1], gunner: [1, 0.6, 0.23], carry: [1, 0.69, 0.13], eva: [1, 1, 1] };
const UP = new THREE.Vector3(0, 1, 0), XAXIS = new THREE.Vector3(1, 0, 0);
// Traffic: the room a ship needs on its way in (SHIP_LANE: three lines this far apart, each with this much room round it), the room it needs from another ship (SHIP_R), each part's
// own box (BOXES, by type), and the order the eight holding places fill in, so two ships waiting are never side by side.
const SHIP_LANE = { shuttle: [0.75, 0.9], freighter: [0.75, 0.9], warship: [1.0, 1.7] }, SHIP_R = { shuttle: 1.9, freighter: 2.6, warship: 5 }, BOXES = new Map(), HOLD_ORDER = [0, 4, 2, 6, 1, 5, 3, 7];
const SHIP_BOX = { shuttle: [1.9, 0.75, 1.4], freighter: [3.1, 0.8, 1.4], warship: [7.1, 1.6, 2.1] };      // half a docked ship: along it, up, across
// THE SHAPE OF A PART, as flying things see it: not one box round the whole of it (a ring would be a solid disc, and a gun's long
// barrel would fill the space beside it) but a set of small boxes that follow the hull. The hull's surface is sampled every half
// unit or so, the samples are sorted into cells, and each cell that holds any becomes a box drawn tight round them. Worked out once
// for each kind of part. Returns the box round everything, with the small boxes ([x0, y0, z0, x1, y1, z1], the part's own frame) on it.
const HULLISH = new Set(['hull', 'trim', 'dark', 'panel', 'glass', 'pod', 'decal', 'glow']), CELL = 1.3;
function shapeOf(type) {
  let b = BOXES.get(type); if (b) return b;
  const g = buildPart(type), cells = new Map(), A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), P = new THREE.Vector3();
  const put = (p) => { const k = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)},${Math.floor(p.z / CELL)}`; let c = cells.get(k); if (!c) cells.set(k, c = [p.x, p.y, p.z, p.x, p.y, p.z]); else { if (p.x < c[0]) c[0] = p.x; if (p.y < c[1]) c[1] = p.y; if (p.z < c[2]) c[2] = p.z; if (p.x > c[3]) c[3] = p.x; if (p.y > c[4]) c[4] = p.y; if (p.z > c[5]) c[5] = p.z; } };
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!o.isMesh || !HULLISH.has(o.userData.role)) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, nT = (idx ? idx.count : pos.count) / 3;
    for (let t = 0; t < nT; t++) {
      const ia = idx ? idx.getX(t * 3) : t * 3, ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      A.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld); Cc.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
      const n = Math.min(24, Math.max(1, Math.ceil(Math.max(A.distanceTo(B), B.distanceTo(Cc), Cc.distanceTo(A)) / 0.55)));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) put(P.copy(A).multiplyScalar(i / n).addScaledVector(B, j / n).addScaledVector(Cc, (n - i - j) / n));
    }
  });
  b = new THREE.Box3().setFromObject(g);
  g.traverse((x) => { if (x.geometry) x.geometry.dispose(); });
  b.boxes = [...cells.values()].map((c) => [c[0] - 0.06, c[1] - 0.06, c[2] - 0.06, c[3] + 0.06, c[4] + 0.06, c[5] + 0.06]);
  if (!b.boxes.length) b.boxes = [[b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]];
  BOXES.set(type, b);
  return b;
}
// A heading as a rotation that keeps the ship level: nose along `look`, deck up (no roll), whichever way it is going.
const _lx = new THREE.Vector3(), _ly = new THREE.Vector3(), _lz = new THREE.Vector3(), _lm = new THREE.Matrix4();
function level(look, q) {
  _lx.copy(look).normalize(); _lz.crossVectors(_lx, UP);
  if (_lz.lengthSq() < 1e-4) _lz.set(0, 0, 1);      // going straight up or down: any side will do, so always the same one
  _lz.normalize(); _ly.crossVectors(_lz, _lx);
  return q.setFromRotationMatrix(_lm.makeBasis(_lx, _ly, _lz));
}
const NO_SHADE = new Set(['glass', 'glow', 'line', 'innerLine', 'wire', 'lane', 'decal', 'tileLine', 'mark', 'screen', 'blue', 'spark', 'alarm']);
const LOD_KEEP = new Set(['tile', 'tileLine', 'hall', 'wall', 'mark', 'lane', 'carpet']);      // what a far room keeps: its floor, walls and faction mark
const OPEN_HIDE = new Set(['hull', 'trim', 'glass', 'glow', 'decal', 'dark', 'blue', 'pod']);
const CUT_IN = ['hall', 'inner', 'innerLine', 'lane', 'tileLine', 'wood', 'white', 'steel', 'sofa', 'fdark', 'fblue', 'fscreen', 'bed', 'locker', 'shell', 'carpet', 'wall', 'craft', 'craftTrim', 'crate', 'plant', 'awning', 'cross', 'alarm', 'spark'];
const RESIDENTS = ['resident', 'resident2', 'resident3', 'resident4'];
// The rooms each job stands in when it is in a part that has them, best first.
const STAND = { resident: ['quarters', 'bunks', 'mess', 'bar', 'lounge', 'market', 'hydro'], hauler: ['cargostore'], engineer: ['workshop'], officer: ['secoffice'], medic: ['medbay'],
  aide: ['brass', 'ops'], scientist: ['lab'], gunner: ['guncrew', 'barrack', 'eaglepad', 'pelicanpad', 'dronerack', 'fab', 'mess', 'bar'] };
const KEEP_OUT = new Set(['empty', 'magazine', 'ordnance']);
// Where each platform part fires or launches from, in its own frame.
const MUZZLE = { gunmount: [1.9, -3.2, 0], battery: [2.5, -4.7, 0], lance: [3.2, -7.8, 0], dronebay: [1.7, -1.2, 0], relay: [1.2, -1.2, 0], eaglehangar: [7.4, -0.6, 0], pelicanbay: [8.4, -0.8, 0], hangar: [8.4, -0.8, 0], fabshop: [2.9, -1.4, 0], barracks: [2.6, -1, 0] };
const SLOGANS = ['LIBERTY', 'SUPER EARTH', 'REPORT FOR\nGRATITUDE', 'A HAPPY STATION IS\nA COMPLIANT STATION', 'DEMOCRACY\nNEVER SLEEPS', 'HAVE YOU PAID YOUR\nLIBERTY CONTRIBUTION?'];

export class View {
  constructor(canvas, st) {
    this.st = st;
    this.canvas = canvas;
    const R = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    R.localClippingEnabled = true;
    R.setClearColor(0x000000);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 6000);
    this.camera.position.set(26, 17, 30);
    this.controls = new THREE.OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 0.3, maxDistance: 260, screenSpacePanning: true, zoomToCursor: true, zoomSpeed: 2.2 });
    this.mode = 'blueprint'; this.cutaway = false; this.open = false; this.overlay = true; this.portMode = 'near'; this.touch = false;
    // The cutaway is one plane that faces the camera, just in front of what you are looking at: everything nearer than it is cut.
    this.clip = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)];
    this._materials();
    this._world();
    this.partObjs = new Map(); this.roomObjs = new Map(); this.shipObjs = new Map();
    this.markers = new THREE.Group(); this.scene.add(this.markers); this.dot = new THREE.SphereGeometry(1, 10, 8);
    this.ghost = null; this.ghostKey = '';
    this.sel = null; this.selLines = null; this.edit = null; this.slotHot = null; this.slotLines = null;
    this.suits = new THREE.Group(); this.scene.add(this.suits); this.suitPool = []; this.evaPos = []; this.boxes = new Map();
    this.sparks = new THREE.Group(); this.scene.add(this.sparks);
    this._agentsInit(); this._figuresInit(); this._raidInit();
    this.ray = new THREE.Raycaster(); this.ray.params.Line.threshold = 0.2;
    this.setMode('blueprint');
    this.resize();
  }

  setStation(st) {
    for (const o of this.partObjs.values()) this.scene.remove(o);
    for (const o of this.roomObjs.values()) this.scene.remove(o.group);
    for (const o of this.shipObjs.values()) this.scene.remove(o);
    this.partObjs.clear(); this.roomObjs.clear(); this.shipObjs.clear();
    this.select(null); this.editPart(null); this.markers.clear(); this.setGhost(null, null, 0);
    this.st = st;
    this.newSky(st.seed);
  }

  // ---------------------------------------------------------------- materials
  _materials() {
    const B = (o) => new THREE.MeshBasicMaterial(o), S = (o) => new THREE.MeshStandardMaterial(o), L = (o) => new THREE.LineBasicMaterial(o);
    const M = this.M = {
      bpHull: B({ color: 0x0b2426, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
      bpLine: L({ color: GREEN, transparent: true, opacity: 0.85 }),
      bpInner: B({ color: 0x0a2414, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
      bpInnerLine: L({ color: GREEN, transparent: true, opacity: 0.22 }),
      bpGlow: B({ color: 0xffe27a, transparent: true, opacity: 0.55 }),
      bpPanel: B({ color: 0x0b2a16, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
      bpTileLine: L({ color: GREEN, transparent: true, opacity: 0.4 }),
      hull: S({ color: 0x8c9690, metalness: 0.55, roughness: 0.5, flatShading: true, side: THREE.DoubleSide }),
      hullLine: L({ color: 0x1c2620, transparent: true, opacity: 0.55 }),
      inner: S({ color: 0x8a7a62, metalness: 0.1, roughness: 0.9, side: THREE.DoubleSide }),
      innerLine: L({ color: 0x2a2014, transparent: true, opacity: 0.5 }),
      tileLine: L({ color: 0x0c0c0c, transparent: true, opacity: 0.6 }),
      glow: B({ color: 0xfff1b0 }),
      thHull: S({ color: 0x9aa59e, metalness: 0.5, roughness: 0.5, flatShading: true, side: THREE.DoubleSide }), thPod: S({ color: 0xb08a3a, metalness: 0.3, roughness: 0.7, flatShading: true }),
      thGlass: S({ color: 0x8fe0c8, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), thPanel: S({ color: 0x1c2f5a, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }),
      glass: S({ color: 0x8fe0c8, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
      panel: S({ color: 0x1c2f5a, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }),
      wire: L({ color: 0xaab6b0 }),
      pod: S({ color: 0xb08a3a, metalness: 0.3, roughness: 0.7, flatShading: true }),
      crate: S({ color: 0xc08a3a, roughness: 0.8, flatShading: true }),
      plant: S({ color: 0x4fae58, roughness: 0.9 }), awning: B({ color: 0xd06a8a }), cross: B({ color: 0xff4a4a }), alarm: B({ color: 0xff3a2a }), spark: B({ color: 0xbfe8ff }),
      suit: S({ color: 0xeeeeea, roughness: 0.6 }), visor: B({ color: 0xffb020 }),
      trim: S({ color: 0xf5d547, metalness: 0.35, roughness: 0.55, flatShading: true, side: THREE.DoubleSide }),
      decal: B({ color: 0xffffff, side: THREE.DoubleSide }),
      dark: S({ color: 0x15171a, metalness: 0.6, roughness: 0.45, flatShading: true }), blue: B({ color: 0x5fc8ff }),
      wall: S({ color: 0xb9ab8e, roughness: 0.9, metalness: 0.02 }), lane: B({ color: 0xffe9a0 }),
      wood: S({ color: 0x8b6b4a, roughness: 0.8 }), white: S({ color: 0xe6e9e4, roughness: 0.6 }), steel: S({ color: 0xaab2b6, roughness: 0.35, metalness: 0.75 }), sofa: S({ color: 0x8a4f3c, roughness: 0.95 }),
      hall: S({ color: 0x9a8a6a, roughness: 0.95, side: THREE.DoubleSide }),
      fdark: S({ color: 0x1d2024, metalness: 0.5, roughness: 0.5 }), fblue: B({ color: 0x5fc8ff }), fscreen: B({ color: 0xffffff }),
      bed: S({ color: 0x9fb4c8, roughness: 0.95 }), locker: S({ color: 0x4a5258, roughness: 0.6, metalness: 0.4 }), shell: S({ color: 0xc9a23a, roughness: 0.4, metalness: 0.7 }), carpet: S({ color: 0x7a2a2a, roughness: 1 }),
      craft: S({ color: 0x8c9690, metalness: 0.5, roughness: 0.5, flatShading: true }), craftTrim: S({ color: 0xf5d547, metalness: 0.3, roughness: 0.6, flatShading: true }),
      raider: S({ color: 0x3a2226, metalness: 0.6, roughness: 0.4, flatShading: true }), raiderGlow: B({ color: 0xff5a3a }),
      xHull: B({ color: 0x0c2a1a, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }),
      xLine: L({ color: 0x3f8f68, transparent: true, opacity: 0.28 }),
      xInnerLine: L({ color: 0x3f8f68, transparent: true, opacity: 0.12 }),
      xGlow: B({ color: 0x3f8f68, transparent: true, opacity: 0.2 }),
      eHull: B({ color: 0x7fe9e0, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }),
      eLine: L({ color: GREEN, transparent: true, opacity: 0.6 }),
      eInnerLine: L({ color: GREEN, transparent: true, opacity: 0.18 }),
      dimHull: B({ color: 0x1a2a22, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
      dimLine: L({ color: 0x5a8a70, transparent: true, opacity: 0.18 }),
      build: L({ color: YELLOW, transparent: true, opacity: 0.8 }),
      gone: L({ color: 0xff5a4a, transparent: true, opacity: 0.8 }),
      hidden: B({ visible: false }),
      ghostOk: B({ color: GREEN, transparent: true, opacity: 0.22, depthWrite: false }), ghostOkLine: L({ color: GREEN, transparent: true, opacity: 0.9 }),
      ghostBad: B({ color: 0xff4a4a, transparent: true, opacity: 0.22, depthWrite: false }), ghostBadLine: L({ color: 0xff4a4a, transparent: true, opacity: 0.9 }),
      sel: L({ color: YELLOW, depthTest: false, transparent: true, opacity: 0.95 }),
      slotHot: L({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.95 }),
      port: B({ color: BLUE, depthTest: false, transparent: true, opacity: 0.45 }),
      portBad: B({ color: 0xff6a5a, depthTest: false, transparent: true, opacity: 0.25 }),
      portHot: B({ color: 0xdff4ff, depthTest: false, transparent: true, opacity: 0.95 }),
    };
    // One floor colour per room, so a cutaway reads at a glance.
    this.tileMats = {};
    for (const [k, r] of Object.entries(C.rooms)) this.tileMats[k] = S({ color: r.col, roughness: 0.85, metalness: 0.05 });
    this.tileBp = B({ color: GREEN, transparent: true, opacity: 0.08, depthWrite: false });
    // The propaganda screen: one canvas shared by every screen, changing slogan every few seconds.
    const sc = this.screenCv = document.createElement('canvas'); sc.width = 384; sc.height = 224;
    this.screenTex = new THREE.CanvasTexture(sc); this.screenTex.colorSpace = THREE.SRGBColorSpace;
    M.fscreen.map = this.screenTex;
    M.screen = B({ map: this.screenTex }); M.bpScreen = B({ map: this.screenTex, transparent: true, opacity: 0.35 });      // the front only: from behind, a screen is its back
    this.shows = {};
    this.slogan = -1; this._drawSlogan(0);
    this.clipped = ['bpHull', 'bpLine', 'bpGlow', 'bpPanel', 'hull', 'hullLine', 'glow', 'glass', 'panel', 'wire', 'pod', 'trim', 'decal', 'dark', 'blue', 'xHull', 'xLine', 'xGlow', 'build', 'gone', 'screen', 'bpScreen', 'dimHull', 'dimLine'];
    for (const k of this.clipped) M[k].clipIntersection = true;
    this.decalCv = document.createElement('canvas'); this.decalCv.width = 512; this.decalCv.height = 256;
    this.decalTex = new THREE.CanvasTexture(this.decalCv); this.decalTex.colorSpace = THREE.SRGBColorSpace; M.decal.map = this.decalTex;
    this.plateTex = {}; this.peopleK = 1;
    this._surfaces();
    this.setLivery({ ...C.livery.def });
  }
  // ---------------------------------------------------------------- surfaces: what fittings, floors and walls are made of
  // Each is painted once in near-white, so the material's own colour tints it. Fittings are skinned in metres (parts.js), one
  // repeat every 2 m, so a 256-pixel tile is 128 pixels to the metre.
  _paint(kind) {
    const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const c = cv.getContext('2d'), r = new RNG(kind.length * 131 + kind.charCodeAt(0));
    c.fillStyle = '#f2f2f0'; c.fillRect(0, 0, N, N);
    const line = (x0, y0, x1, y1, col, w = 1) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    const speck = (n, a0, a1, w = 2, h = 1) => { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${r.chance(0.5) ? '0,0,0' : '255,255,255'},${r.range(a0, a1)})`; c.fillRect(r.int(N), r.int(N), 1 + r.int(w), 1 + r.int(h)); } };
    if (kind === 'deck') {      // deck plate: 1 m plates with seams, corner bolts and a non-slip stipple
      speck(900, 0.03, 0.1, 2, 2);
      for (const o of [0, 128]) { line(o + 1, 0, o + 1, N, 'rgba(0,0,0,0.5)', 2); line(0, o + 1, N, o + 1, 'rgba(0,0,0,0.5)', 2); line(o + 3, 0, o + 3, N, 'rgba(255,255,255,0.35)'); line(0, o + 3, N, o + 3, 'rgba(255,255,255,0.35)'); }
      c.fillStyle = 'rgba(0,0,0,0.45)'; for (const x of [10, 118, 138, 246]) for (const y of [10, 118, 138, 246]) { c.beginPath(); c.arc(x, y, 2.2, 0, 6.3); c.fill(); }
      for (let y = 24; y < N; y += 16) for (let x = 24 + (y % 32 ? 8 : 0); x < N; x += 16) if ((x % 128 > 16 && x % 128 < 112) && (y % 128 > 16 && y % 128 < 112)) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, y, 5, 2); }
    } else if (kind === 'wood') {      // boards with a running grain
      for (let y = 0; y < N; y += 32) { c.fillStyle = `rgba(90,50,10,${r.range(0.02, 0.1)})`; c.fillRect(0, y, N, 32); line(0, y + 0.5, N, y + 0.5, 'rgba(40,20,0,0.22)'); const j = r.int(N); line(j, y, j, y + 32, 'rgba(40,20,0,0.18)'); }
      for (let i = 0; i < 260; i++) { const y = r.int(N), x = r.int(N), l = 20 + r.int(90); c.strokeStyle = `rgba(60,30,0,${r.range(0.04, 0.12)})`; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + l * 0.3, y + r.range(-2, 2), x + l * 0.6, y + r.range(-2, 2), x + l, y); c.stroke(); }
    } else if (kind === 'steel') {      // brushed, with a seam and rivets
      for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(${r.chance(0.5) ? '0,0,0' : '255,255,255'},${r.range(0.03, 0.12)})`; c.fillRect(r.int(N), r.int(N), 10 + r.int(60), 1); }
      line(0, 127.5, N, 127.5, 'rgba(0,0,0,0.3)'); line(0, 129.5, N, 129.5, 'rgba(255,255,255,0.4)'); c.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 16; x < N; x += 32) { c.beginPath(); c.arc(x, 120, 1.6, 0, 6.3); c.fill(); }
    } else if (kind === 'cloth') {      // a weave
      for (let y = 0; y < N; y += 4) for (let x = 0; x < N; x += 4) { c.fillStyle = `rgba(0,0,0,${((x + y) / 4) % 2 ? 0.16 : 0.04})`; c.fillRect(x, y, 4, 4); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x, y, 2, 1); }
      speck(500, 0.02, 0.1, 3, 3);
    } else if (kind === 'wall') {      // wall panels 1 m wide, a rail at 1 m, a kick strip at the floor
      for (const x of [0, 128]) { line(x + 1, 0, x + 1, N, 'rgba(0,0,0,0.35)', 2); line(x + 3.5, 0, x + 3.5, N, 'rgba(255,255,255,0.4)'); }
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, N - 14, N, 14); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 122, N, 5); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(0, 120, N, 2);
      for (const x of [64, 192]) { c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x - 10, 60, 20, 12); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x - 10, 60, 20, 2); }
      speck(300, 0.02, 0.06, 3, 1);
    } else if (kind === 'plastic') {      // moulded panels
      for (const o of [0, 128]) { line(o + 0.5, 0, o + 0.5, N, 'rgba(0,0,0,0.18)'); line(0, o + 0.5, N, o + 0.5, 'rgba(0,0,0,0.18)'); }
      speck(200, 0.02, 0.05, 2, 2);
    } else if (kind === 'locker') {      // sheet metal doors with vents and a handle line
      for (let x = 0; x < N; x += 64) { line(x + 0.5, 0, x + 0.5, N, 'rgba(0,0,0,0.5)'); line(x + 2.5, 0, x + 2.5, N, 'rgba(255,255,255,0.25)'); for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x + 16, 30 + i * 8, 32, 3); c.fillRect(x + 16, 158 + i * 8, 32, 3); } }
      line(0, 127.5, N, 127.5, 'rgba(0,0,0,0.4)'); speck(400, 0.02, 0.08, 8, 1);
    } else if (kind === 'crate') {      // one face of a crate: a frame, a brace and a stencil
      c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(0, 0, N, N); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 22; c.strokeRect(11, 11, N - 22, N - 22); c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2; c.strokeRect(24, 24, N - 48, N - 48);
      line(24, N - 24, N - 24, 24, 'rgba(0,0,0,0.4)', 18); c.fillStyle = 'rgba(0,0,0,0.55)'; c.font = 'bold 34px ui-monospace, Menlo, monospace'; c.textAlign = 'center'; c.fillText('SE-710', N / 2, 70);
    } else if (kind === 'brass') {      // a shell case: turned bands
      for (let y = 0; y < N; y += 2) { c.fillStyle = `rgba(0,0,0,${r.range(0, 0.1)})`; c.fillRect(0, y, N, 1); } for (const y of [40, 46, 200]) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, y, N, 3); }
    } else if (kind === 'leaf') { for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(${r.chance(0.6) ? '0,40,0' : '220,255,160'},${r.range(0.1, 0.4)})`; c.beginPath(); c.ellipse(r.int(N), r.int(N), 3 + r.int(7), 2 + r.int(3), r.range(0, 3.1), 0, 6.3); c.fill(); } }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  _surfaces() {
    const M = this.M, T = {}; for (const k of ['deck', 'wood', 'steel', 'cloth', 'wall', 'plastic', 'locker', 'crate', 'brass', 'leaf']) T[k] = this._paint(k);
    const set = (m, t) => { m.map = t; m.needsUpdate = true; };
    set(M.inner, T.deck); for (const m of Object.values(this.tileMats)) set(m, T.deck);
    set(M.wood, T.wood); set(M.steel, T.steel); set(M.locker, T.locker); set(M.wall, T.wall); set(M.white, T.plastic); set(M.crate, T.crate); set(M.shell, T.brass); set(M.plant, T.leaf);
    for (const m of [M.sofa, M.bed, M.carpet, M.hall]) set(m, T.cloth);
    this.surf = T;
  }
  // ---------------------------------------------------------------- livery: colours, hull plating, interior fit-out, lights, emblem
  // Hull plating is painted once per style, in greys, and the hull colour tints it. One tile is 2 units (10 m) square.
  _plating(style) {
    if (this.plateTex[style]) return this.plateTex[style];
    const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const c = cv.getContext('2d'), r = new RNG(style.length * 977 + 31);
    c.fillStyle = '#eceeee'; c.fillRect(0, 0, N, N);
    const line = (x0, y0, x1, y1, col = 'rgba(0,0,0,0.5)', w = 2) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    const panel = (x, y, w, h) => {
      c.fillStyle = `rgba(${r.chance(0.5) ? '0,0,0' : '255,255,255'},${r.range(0.02, 0.12)})`; c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
      line(x + 2, y + 3, x + w - 2, y + 3, 'rgba(255,255,255,0.35)', 1); line(x + 3, y + 2, x + 3, y + h - 2, 'rgba(255,255,255,0.25)', 1);
      c.fillStyle = 'rgba(0,0,0,0.45)'; for (const [dx, dy] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) { c.beginPath(); c.arc(x + dx, y + dy, 1.6, 0, 6.3); c.fill(); }
    };
    if (style === 'panels' || style === 'worn' || style === 'hazard') {
      for (let y = 0; y < N; y += 128) for (let x = 0; x < N; x += 128) { if (r.chance(0.35)) { panel(x, y, 64, 128); panel(x + 64, y, 64, 128); } else if (r.chance(0.3)) { panel(x, y, 128, 64); panel(x, y + 64, 128, 64); } else panel(x, y, 128, 128); }
      for (let i = 0; i < 10; i++) { const x = r.int(4) * 128 + 20 + r.int(60), y = r.int(4) * 128 + 20 + r.int(60); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, y, 26, 10); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x, y, 26, 2); }
    } else if (style === 'plates') {
      for (let y = 0; y < N; y += 256) for (let x = -128; x < N; x += 256) { const ox = (y / 256) % 2 ? 128 : 0; panel(x + ox, y, 256, 256); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 6; c.strokeRect(x + ox + 14, y + 14, 228, 228); c.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < 6; k++) for (const yy of [26, 230]) { c.beginPath(); c.arc(x + ox + 36 + k * 37, y + yy, 4, 0, 6.3); c.fill(); } }
    } else { for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(0,0,0,${r.range(0.01, 0.05)})`; c.fillRect(r.int(N), r.int(N), 2 + r.int(30), 1); } line(0, 0, N, 0, 'rgba(0,0,0,0.25)', 2); line(0, 0, 0, N, 'rgba(0,0,0,0.25)', 2); }
    if (style === 'worn') {
      for (let i = 0; i < 60; i++) { const x = r.int(N), y = r.int(N), h = 30 + r.int(140), g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(30,20,10,${r.range(0.12, 0.3)})`); g.addColorStop(1, 'rgba(30,20,10,0)'); c.fillStyle = g; c.fillRect(x, y, 3 + r.int(8), h); }
      for (let i = 0; i < 16; i++) { const x = r.int(N), y = r.int(N), rad = 14 + r.int(40), g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(255,255,255,${r.range(0.1, 0.4)})`; c.fillRect(r.int(N), r.int(N), 1 + r.int(4), 1 + r.int(3)); }
    }
    if (style === 'hazard') { c.save(); c.beginPath(); c.rect(0, 224, N, 64); c.clip(); c.fillStyle = 'rgba(0,0,0,0.62)'; for (let x = -64; x < N + 64; x += 64) { c.beginPath(); c.moveTo(x, 288); c.lineTo(x + 32, 288); c.lineTo(x + 96, 224); c.lineTo(x + 64, 224); c.closePath(); c.fill(); } c.restore(); line(0, 224, N, 224, 'rgba(0,0,0,0.6)', 3); line(0, 288, N, 288, 'rgba(0,0,0,0.6)', 3); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return (this.plateTex[style] = t);
  }
  _drawDecal() {
    const L = this.livery, c = this.decalCv.getContext('2d'), W = 512, H = 256;
    c.fillStyle = L.accent; c.fillRect(0, 0, W, H);
    c.strokeStyle = L.trim; c.lineWidth = 8; c.strokeRect(10, 10, W - 20, H - 20);
    c.fillStyle = L.trim; c.strokeStyle = L.trim; c.lineJoin = 'round';
    const name = (L.name || 'SUPER EARTH').toUpperCase().slice(0, 18), cx = 128, cy = 128;
    c.save(); c.translate(L.emblem === 'none' ? -400 : cx, cy);
    if (L.emblem === 'crest') { if (this.faction) drawLogo(c, this.faction.logo, -104, -104, 208); }
    else if (L.emblem === 'wings') { for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 12, -6); c.lineTo(s * 92, -52); c.lineTo(s * 70, -16); c.lineTo(s * 86, -14); c.lineTo(s * 58, 14); c.lineTo(s * 70, 16); c.lineTo(s * 12, 44); c.closePath(); c.fill(); } c.beginPath(); c.moveTo(0, -64); c.lineTo(20, 0); c.lineTo(0, 70); c.lineTo(-20, 0); c.closePath(); c.fill(); }
    else if (L.emblem === 'star') { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 34 : 82; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 94, 0, 6.3); c.stroke(); }
    else if (L.emblem === 'shield') { c.beginPath(); c.moveTo(-70, -76); c.lineTo(70, -76); c.lineTo(70, 6); c.quadraticCurveTo(64, 62, 0, 88); c.quadraticCurveTo(-64, 62, -70, 6); c.closePath(); c.fill(); c.fillStyle = L.accent; c.fillRect(-12, -62, 24, 128); c.fillRect(-56, -22, 112, 22); }
    else if (L.emblem === 'laurel') { for (const s of [1, -1]) for (let i = 0; i < 7; i++) { const a = Math.PI / 2 + s * (0.35 + i * 0.33); c.save(); c.translate(Math.cos(a) * 70, Math.sin(a) * 70); c.rotate(a + s * 1.0); c.beginPath(); c.ellipse(0, 0, 22, 9, 0, 0, 6.3); c.fill(); c.restore(); } c.beginPath(); c.arc(0, 0, 26, 0, 6.3); c.fill(); }
    c.restore();
    c.fillStyle = L.trim; c.textBaseline = 'middle'; c.textAlign = L.emblem === 'none' ? 'center' : 'left';
    const tx = L.emblem === 'none' ? W / 2 : 250, maxW = L.emblem === 'none' ? W - 60 : W - 280, words = name.split(' '), lines = [];
    let fs = 64; c.font = `bold ${fs}px "Chakra Petch", ui-monospace, Menlo, monospace`;
    let cur = ''; for (const w of words) { if (cur && c.measureText(`${cur} ${w}`).width > maxW) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w; } lines.push(cur);
    while (fs > 22 && (lines.some((l) => c.measureText(l).width > maxW) || lines.length * fs * 1.1 > 190)) { fs -= 4; c.font = `bold ${fs}px "Chakra Petch", ui-monospace, Menlo, monospace`; }
    lines.forEach((l, i) => c.fillText(l, tx, H / 2 + (i - (lines.length - 1) / 2) * fs * 1.1));
    this.decalTex.needsUpdate = true;
  }
  // YOUR FACTION: its crest on the nameplates and screens, its motto on the screens, its uniform on the station's troopers.
  setFaction(f) {
    this.faction = f;
    const redo = () => { if (this.livery) this._drawDecal(); for (const x of Object.values(this.shows || {})) x.k = -1; };
    redo(); ensureLogo(f.logo).then(redo);      // an uploaded picture is decoded first; the crest is drawn until it is
    const L = f.look || {};
    if (this.figs) for (const [set, pose] of [[this.figs, 'stand'], [this.figsW, 'walk']]) { const im = set.trooper; im.geometry.dispose(); im.geometry = buildFigure('trooper', pose, L); }
  }
  setLivery(L) {
    const M = this.M, D = C.livery;
    this.livery = L = { ...D.def, ...L };
    const tex = this._plating(D.plating[L.plating] ? L.plating : 'panels');
    for (const m of [M.hull, M.thHull, M.craft]) { m.color.set(L.hull); m.map = tex; m.needsUpdate = true; }
    M.trim.color.set(L.trim); M.craftTrim.color.set(L.trim); M.dark.color.set(L.accent).multiplyScalar(0.6); M.wire.color.set(L.accent).lerp(new THREE.Color(0xaab6b0), 0.5);
    const I = D.interior[L.interior] || D.interior.ministry;
    M.inner.color.set(I.floor); M.wall.color.set(I.wall); M.lane.color.set(I.lane); M.hall.color.set(I.floor).lerp(new THREE.Color(I.lane), 0.38);
    M.glow.color.set(D.lights[L.lights] || D.lights.warm);
    this._drawDecal();
    this.thumbs = null;
  }
  // PROPAGANDA SCREENS. Each programme has its own picture, shared by every screen showing it. Words are wrapped and sized to fit
  // inside the frame, whatever their length.
  _show(prog) {
    let x = this.shows[prog];
    if (!x) {
      const cv = document.createElement('canvas'); cv.width = 768; cv.height = 448;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); mat.clipIntersection = true; mat.clippingPlanes = this.M.screen.clippingPlanes;
      x = this.shows[prog] = { cv, tex, mat, k: -1, at: -1 };
    }
    return x;
  }
  _showOn(o, p) {
    if (p.type !== 'billboard') return;
    const prog = p.show || 'slogans', m = this._show(prog).mat; o.userData.show = prog;
    const ours = new Set([this.M.screen, ...Object.values(this.shows).map((y) => y.mat)]);      // the picture, not a blueprint or build look
    o.traverse((x) => { if (x.userData.role === 'screen' && ours.has(x.material)) x.material = m; });
  }
  _screens(now) {
    const st = this.st, used = new Set(); for (const p of st.parts.values()) if (p.type === 'billboard') used.add(p.show || 'slogans');
    for (const prog of used) {
      const x = this._show(prog), S = C.screens, live = prog === 'station', k = Math.floor(now / (prog === 'news' ? 7 : 5));
      if (k === x.k && !(live && now - x.at > 2)) continue;
      x.k = k; x.at = now;
      const lines = prog === 'own' ? st.screenLines || S.own : prog === 'station' ? null : S[prog];
      drawScreen(x.cv, prog, lines ? lines[k % lines.length] : null, st, this.livery, k, this.faction);
      x.tex.needsUpdate = true;
    }
  }
  _drawSlogan(i) {
    const c = this.screenCv.getContext('2d'), W = c.canvas.width, H = c.canvas.height;
    c.fillStyle = '#05080a'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#ffe600'; c.lineWidth = 6; c.strokeRect(8, 8, W - 16, H - 16);
    c.fillStyle = '#ffe600'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const lines = SLOGANS[i % SLOGANS.length].split('\n'), fs = lines.length > 1 ? 34 : 56;
    c.font = `bold ${fs}px ui-monospace, Menlo, Consolas, monospace`;
    lines.forEach((l, k) => c.fillText(l, W / 2, H / 2 + (k - (lines.length - 1) / 2) * fs * 1.15));
    c.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);
    this.screenTex.needsUpdate = true;
  }
  // The material a role wears in the current mode. dim: another part while you edit one part's interior.
  // edit: the part being edited, whose hull turns to glass so every room inside shows.
  mat(role, state, dim, edit, solid = false) {
    const M = this.M, m = this.mode;
    if (state === 'building') return role === 'line' || role === 'wire' ? M.build : M.hidden;
    if (state === 'demolish' && (role === 'line' || role === 'wire')) return M.gone;
    if (role === 'decal' && (edit || dim || m !== 'hull')) return M.hidden;
    if (role === 'lane') return dim || m === 'life' ? M.hidden : m === 'blueprint' && !edit ? M.bpGlow : edit || this.cutaway || this.open ? M.lane : M.hidden;
    if (edit) return { line: M.eLine, wire: M.eLine, innerLine: M.eInnerLine, glow: M.glow, screen: M.screen, panel: M.panel }[role] || M.eHull;
    if (dim) return { line: M.dimLine, wire: M.dimLine, innerLine: M.hidden, inner: M.hidden }[role] || (role === 'glow' ? M.hidden : M.dimHull);
    if (m === 'blueprint') return { trim: M.bpHull, dark: M.bpHull, blue: M.bpGlow, hull: M.bpHull, line: M.bpLine, inner: M.bpInner, innerLine: M.bpInnerLine, glow: M.bpGlow, glass: M.bpHull, panel: M.bpPanel, wire: M.bpLine, pod: M.bpHull, screen: M.bpScreen }[role] || M.bpInner;
    if (m === 'life') return { trim: M.xHull, dark: M.xHull, blue: M.xGlow, hull: M.xHull, line: M.xLine, inner: M.hidden, innerLine: M.xInnerLine, glow: M.xGlow, glass: M.xHull, panel: M.xHull, wire: M.xLine, pod: M.xHull, screen: M.xHull }[role] || M.hidden;
    const inside = this.cutaway || this.open || !!this.edit;
    // INSIDE: the hull is taken away and only its edges are left, so every deck can be seen from anywhere. Ships keep their hulls.
    if (this.open && !solid && OPEN_HIDE.has(role)) return M.hidden;
    return { hull: M.hull, line: M.hullLine, inner: inside ? M.inner : M.hidden, innerLine: inside ? M.innerLine : M.hidden, glow: M.glow, glass: M.glass, panel: M.panel, wire: M.wire, pod: M.pod, screen: M.screen }[role] || M[role] || M.inner;
  }
  _dress(obj, state, dim = false, edit = false, solid = false) { obj.traverse((o) => { if (o.userData.role) o.material = this.mat(o.userData.role, state, dim, edit, solid); }); }
  _dressRoom(g, dim, edit = false) {
    const m = edit ? 'hull' : this.mode;
    g.traverse((o) => {
      const r = o.userData.role; if (!r) return;
      if (dim) { o.material = this.M.hidden; return; }
      if (r === 'mark') { o.material = m === 'life' ? this.M.hidden : o.userData.mat; return; }
      if (r === 'tile') o.material = m === 'blueprint' ? this.tileBp : m === 'life' ? this.M.hidden : this.tileMats[o.userData.room];
      else if (r === 'tileLine') o.material = m === 'blueprint' ? this.M.bpTileLine : m === 'life' ? this.M.xInnerLine : this.M.tileLine;
      else if (m === 'blueprint') o.material = r === 'glow' || r === 'spark' || r === 'lane' ? this.M.bpGlow : r === 'line' ? this.M.bpInnerLine : this.M.bpInner;
      else if (m === 'life') o.material = this.M.hidden;
      else o.material = { hull: this.M.craft, trim: this.M.craftTrim, glass: this.M.thGlass, line: this.M.tileLine, decal: this.M.hidden, dark: this.M.fdark, blue: this.M.fblue, screen: this.M.fscreen }[r] || this.M[r] || this.M.inner;
    });
  }
  _dim(id) { return !!this.edit && this.edit !== id; }

  // ---------------------------------------------------------------- the space around the station
  _world() {
    const s = this.scene;
    this.amb = new THREE.AmbientLight(0x9fb3a8, 0.5); s.add(this.amb);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.4); s.add(this.sun); s.add(this.sun.target);
    // Cast shadows (a setting, off to start): the sun's shadow map covers the build zone, so one part shades another.
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.rim = new THREE.DirectionalLight(0x6fd0ff, 0.7); this.rim.position.set(-50, -20, -40); s.add(this.rim);
    this.bpLight = new THREE.AmbientLight(0xffffff, 0.0); s.add(this.bpLight);

    // Three drawing planes through the origin, like a technical drawing in 3D space, with X, Y and Z marked.
    const g = this.grids = new THREE.Group();
    const plane = (rot, op) => { const gh = new THREE.GridHelper(120, 60, GREEN, GREEN); gh.material.transparent = true; gh.material.opacity = op; gh.material.depthWrite = false; rot(gh); g.add(gh); };
    plane(() => {}, 0.1); plane((o) => o.rotateX(Math.PI / 2), 0.04); plane((o) => o.rotateZ(Math.PI / 2), 0.04);
    const axis = (to, col) => g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([to.clone().multiplyScalar(-60), to.clone().multiplyScalar(60)]), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.5 })));
    axis(new THREE.Vector3(1, 0, 0), 0xff6a5a); axis(new THREE.Vector3(0, 1, 0), GREEN); axis(new THREE.Vector3(0, 0, 1), BLUE);
    for (const [t, p, c] of [['X', [62, 0, 0], '#ff6a5a'], ['-X', [-62, 0, 0], '#ff6a5a'], ['Y', [0, 62, 0], '#9dffb8'], ['-Y', [0, -62, 0], '#9dffb8'], ['Z', [0, 0, 62], '#4db8ff'], ['-Z', [0, 0, -62], '#4db8ff']]) { const sp = this._label(t, c); sp.position.set(...p); g.add(sp); }
    s.add(g);

    // The permitted build zone: three dashed circles of the sphere it may not leave.
    this.zone = new THREE.Group();
    for (const rot of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]]) {
      const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: YELLOW, dashSize: 0.02, gapSize: 0.015, transparent: true, opacity: 0.45 }));
      l.computeLineDistances(); l.rotation.set(...rot); this.zone.add(l);
    }
    s.add(this.zone);
    // The skybox: stars, the sun and moons. It follows the camera, so it never shifts with panning or zooming.
    this.sky = new THREE.Group(); s.add(this.sky);
    this.planet = null; this.newSky(7);
  }
  // A new sky and world for each station: a random sun direction, planet type and moons.
  newSky(seed) {
    const r = new RNG((seed * 9301 + 49297) % 233280 || 7);
    this.sky.clear();
    if (this.planet) { this.scene.remove(this.planet); this.planet = null; }
    const sp = [];
    for (let i = 0; i < 2400; i++) { const u = r.next() * 2 - 1, a = r.next() * Math.PI * 2, R = 1500; sp.push(Math.sqrt(1 - u * u) * Math.cos(a) * R, u * R, Math.sqrt(1 - u * u) * Math.sin(a) * R); }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)),
      new THREE.PointsMaterial({ color: 0xdfeee6, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false }));
    this.sky.add(this.stars);
    // The sun, up and to one side, with a soft glow; the key light comes from it.
    // The planet sits below and behind the station as first seen, so it fills the background; the sun lights it from one side.
    const pa = Math.atan2(-0.66, -0.62) + r.range(-0.8, 0.8), pe = -r.range(0.72, 0.92);
    const sa = pa + (r.chance(0.5) ? 1 : -1) * r.range(1.6, 2.6), se = r.range(0.2, 0.6);
    this.sunDir = new THREE.Vector3(Math.cos(sa) * Math.cos(se), Math.sin(se), Math.sin(sa) * Math.cos(se));
    const sc = document.createElement('canvas'); sc.width = sc.height = 256;
    const x = sc.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(0.08, 'rgba(255,250,220,1)'); gr.addColorStop(0.2, 'rgba(255,220,150,0.35)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sunSprite.position.copy(this.sunDir).multiplyScalar(1300); this.sunSprite.scale.setScalar(380); this.sky.add(this.sunSprite);
    this.sun.position.copy(this.sunDir).multiplyScalar(100);
    // The planet below, of a random type, lit by the sun.
    this.worldType = WORLD_TYPES[r.int(WORLD_TYPES.length)];
    const W = WORLDS[this.worldType], tex = paintWorld(this.worldType, Math.floor(r.next() * 9999));
    const mapT = new THREE.CanvasTexture(tex.map); mapT.colorSpace = THREE.SRGBColorSpace;
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(600, 96, 48), new THREE.MeshStandardMaterial({ map: mapT, roughness: 1, metalness: 0 }));
    this.planet.position.set(Math.cos(pa) * Math.cos(pe) * 1150, Math.sin(pe) * 1150, Math.sin(pa) * Math.cos(pe) * 1150); this.planet.rotation.set(r.range(-0.4, 0.4), r.range(0, 6.28), r.range(-0.3, 0.3));
    if (tex.clouds) {
      const ct = new THREE.CanvasTexture(tex.clouds); ct.colorSpace = THREE.SRGBColorSpace;
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(606, 96, 48), new THREE.MeshStandardMaterial({ map: ct, transparent: true, depthWrite: false, roughness: 1 }));
      this.planet.add(this.clouds);
    } else this.clouds = null;
    // The atmosphere: a rim of light, brightest where you look through the most air.
    if (W.atmo) this.planet.add(new THREE.Mesh(new THREE.SphereGeometry(628, 64, 32), new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(W.atmo) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; void main() { float f = 1.0 - abs(dot(vN, vV)); gl_FragColor = vec4(c, pow(f, 2.5) * 0.85); }',
    })));
    this.scene.add(this.planet);
    // One or two moons, far off in the skybox.
    const nm = 1 + r.int(2);
    for (let i = 0; i < nm; i++) {
      const t = r.chance(0.6) ? 'moon' : r.pick(['ice', 'mars', 'desert']), mt = new THREE.CanvasTexture(paintWorld(t, Math.floor(r.next() * 9999), 256).map); mt.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r.range(14, 40), 32, 16), new THREE.MeshStandardMaterial({ map: mt, roughness: 1 }));
      const a = pa + (i ? -1 : 1) * r.range(0.6, 1.1), e = r.range(-0.05, 0.3);
      m.position.set(Math.cos(a) * Math.cos(e) * 1100, Math.sin(e) * 1100, Math.sin(a) * Math.cos(e) * 1100);
      this.sky.add(m);
    }
    this.setMode(this.mode);
  }
  _label(text, col) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d'); x.font = 'bold 40px ui-monospace, Menlo, Consolas, monospace'; x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.8 }));
    sp.scale.set(4, 2, 1); return sp;
  }

  // ---------------------------------------------------------------- modes
  setMode(m) {
    this.mode = m;
    const bp = m === 'blueprint', hull = m === 'hull';
    if (this.grids) this.grids.visible = bp && this.overlay;
    if (this.planet) this.planet.visible = hull;
    if (this.sky) for (const o of this.sky.children) o.visible = hull || o === this.stars;
    if (this.stars) this.stars.material.opacity = hull ? 0.85 : 0.3;
    if (this.sun) { this.sun.visible = hull; this.rim.visible = hull; }
    this._redress();
  }
  // Fly the camera and what it looks at together. fwd and right run along the deck (never up or down); up is straight up; turn
  // swings the camera round what it is looking at. Speed grows with distance, so it is fine close in and quick far out.
  // Drawing quality: how many pixels are drawn for each one on the screen.
  // LIGHT: how strong the sun is (k, 0.4 to 1.6) and how dark the side away from it goes (shade, 0 to 1: at 1 almost black, as in
  // hard vacuum; at 0 evenly lit). shadows: whether parts cast real shadows on each other.
  setLight(k = 1, shade = 0.5, shadows = false) {
    this.sun.intensity = 2.4 * k; this.rim.intensity = 0.7 * Math.min(1.3, k) * (1.3 - shade * 0.6);
    this.amb.intensity = 0.06 + 0.88 * (1 - shade);
    const R = this.renderer;
    if (R.shadowMap.enabled !== !!shadows) { R.shadowMap.enabled = !!shadows; R.shadowMap.type = THREE.PCFSoftShadowMap; this.sun.castShadow = !!shadows; this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    this.shadows = !!shadows;
  }
  // Which meshes cast and take shadows: solid hull and fittings do; glass, glows, lines and markers do not.
  _shade(o) { o.traverse((x) => { if (!x.isMesh || x.isInstancedMesh) return; const r = x.userData.role; const solid = !NO_SHADE.has(r); x.castShadow = solid; x.receiveShadow = solid; }); }
  // The shadow camera follows the station: an orthographic box round the sun's view of the build zone.
  _sunBox() {
    if (!this.shadows) return;
    const R = Math.max(8, this.st.radius || 8) + 4, c = this.sun.shadow.camera;
    this.sun.target.position.set(0, 0, 0); this.sun.position.copy(this.sunDir).multiplyScalar(R + 20);
    if (c.right !== R) { c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 2 * R + 40; c.updateProjectionMatrix(); }
  }
  // LEVEL OF DETAIL inside: a room's fittings are only drawn where they can be seen, and at a size where they tell. With the hull
  // closed a room shows only when the camera is close enough to see in at a window; with the inside showing (cutaway, open, edit,
  // the plans) a room far away keeps its floor and walls and leaves out its fittings, and one too small to see, or wholly on the
  // camera's side of the cut, is not drawn. lodK: the Inside detail setting (0.5 low, 1 normal, 2 high).
  _lod() {
    const cam = this.camera, tanH = Math.tan(cam.fov * Math.PI / 360), q = this.lodK || 1;
    const seen = this.mode !== 'hull' || this.cutaway || this.open || !!this.edit, cut = this.cutaway && !this.edit ? this.clip[0] : null;
    let n = 0;
    for (const [id, r] of this.roomObjs) {
      if (!r.rad) { const b = new THREE.Box3().setFromObject(r.group), sp = b.getBoundingSphere(new THREE.Sphere()); r.mid = sp.center; r.rad = sp.radius; r.det = []; r.group.traverse((x) => { if ((x.isMesh || x.isLineSegments) && !LOD_KEEP.has(x.userData.role)) r.det.push(x); }); }
      const d = Math.max(0.01, cam.position.distanceTo(r.mid)), f = r.rad / (d * tanH);
      let lv;
      if (this.edit === id || d < r.rad) lv = 2;
      else if (this.mode === 'life') lv = 0;
      else if (!seen) lv = f > 0.45 / q ? 2 : 0;
      else if (cut && cut.distanceToPoint(r.mid) < -r.rad) lv = 0;
      else lv = f > 0.09 / q ? 2 : f > 0.018 / q ? 1 : 0;
      if (lv !== r.lv) { r.lv = lv; r.group.visible = lv > 0; for (const x of r.det) x.visible = lv === 2; }
      n += lv === 2 ? 1 : 0;
    }
    this.lodFull = n;
  }
  setQuality(q) { const d = devicePixelRatio || 1; this.renderer.setPixelRatio(q === 'low' ? Math.min(d, 1) * 0.75 : q === 'high' ? Math.min(d, 3) : Math.min(d, 2)); }
  fly(fwd, right, up, turn, dt) {
    const cam = this.camera.position, tg = this.controls.target, off = this._fo || (this._fo = new THREE.Vector3()), f = this._ff || (this._ff = new THREE.Vector3()), r = this._fr || (this._fr = new THREE.Vector3());
    off.copy(cam).sub(tg);
    const dist = off.length(), sp = Math.max(1.2, dist * 0.9) * dt * (this.flyK || 1);
    f.set(-off.x, 0, -off.z); if (f.lengthSq() < 1e-8) f.set(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0); f.normalize();
    r.set(-f.z, 0, f.x);
    const mx = (f.x * fwd + r.x * right) * sp, mz = (f.z * fwd + r.z * right) * sp, my = up * sp;
    tg.x += mx; tg.z += mz; tg.y += my; cam.x += mx; cam.z += mz; cam.y += my;
    if (turn) { off.copy(cam).sub(tg).applyAxisAngle(UP, turn * dt * 1.4); cam.copy(tg).add(off); }
    this.controls.autoRotate = false;
  }
  setCutaway(on) { this.cutaway = on; this._redress(); }
  setOpen(on) { this.open = on; this._redress(); }
  setOverlay(on) { this.overlay = on; this.grids.visible = on && this.mode === 'blueprint'; this.markers.visible = on; if (this.selLines) this.selLines.visible = on && !this.edit; if (this.editLbl) this.editLbl.visible = on; }
  _redress() {
    if (!this.partObjs) return;
    for (const [id, o] of this.partObjs) { const p = this.st.parts.get(id); this._dress(o, p ? p.state : 'active', this._dim(id), this.edit === id); if (p) this._showOn(o, p); }
    for (const [id, r] of this.roomObjs) this._dressRoom(r.group, this._dim(id), this.edit === id);
    for (const o of this.shipObjs.values()) this._dress(o, 'active', !!this.edit, false, true);
    // The cut takes the hull and everything inside it that is nearer than the plane: decks, rooms, fittings and people.
    const planes = this.cutaway && !this.edit ? this.clip : null;
    for (const m of [...this.clipped.map((k) => this.M[k]), ...Object.values(this.shows || {}).map((x) => x.mat), ...CUT_IN.map((k) => this.M[k]), ...Object.values(this.tileMats), this.figMat, this.crateIM && this.crateIM.material]) if (m) { m.clippingPlanes = planes; m.clipShadows = true; m.needsUpdate = true; }
    const life = this.mode === 'life';
    this.agentMat.size = life ? 0.9 : 0.55;
    this.agentMat.depthTest = !life && !this.cutaway && !this.open && !this.edit;
    // People show as life signs in the x-ray, and as small figures wherever you can see inside the hull.
    this.peopleOn = this.mode !== 'hull' || this.cutaway || this.open || !!this.edit;
    this.figOn = this.peopleOn && !life;
    this.agentPts.visible = this.peopleOn;
    for (const f of [...Object.values(this.figs), ...Object.values(this.figsW)]) f.visible = this.figOn;
    this.crateIM.visible = this.figOn;
  }

  // ---------------------------------------------------------------- sync with the simulation
  sync(now, dt) {
    const st = this.st;
    for (const [id, o] of this.partObjs) if (!st.parts.has(id)) { this.scene.remove(o); this.partObjs.delete(id); if (this.sel === id) this.select(null); if (this.edit === id) this.editPart(null); }
    for (const [id, r] of this.roomObjs) if (!st.parts.has(id)) { this.scene.remove(r.group); this.roomObjs.delete(id); }
    for (const p of st.parts.values()) {
      let o = this.partObjs.get(p.id);
      if (!o) {
        o = buildPart(p.type); o.position.set(...p.pos); o.quaternion.set(...p.quat);
        o.traverse((x) => { x.userData.part = p.id; });
        this._shade(o); this.scene.add(o); this.partObjs.set(p.id, o); o.userData.state = '';
      }
      if (o.userData.state !== p.state) { o.userData.state = p.state; this._dress(o, p.state, this._dim(p.id), this.edit === p.id); this._showOn(o, p); }
      if (p.type === 'billboard' && o.userData.show !== (p.show || 'slogans')) this._showOn(o, p);
      this._rooms(p);
    }
    this.zone.scale.setScalar(st.radius);
    this._ships(now, dt);
    this._eva(now);
    this._agents(now);
    this._raid(now, dt);
    this._shots(dt);
    this._lifts(dt);
    this._airlocks();
    if (this.edit) { const p = st.parts.get(this.edit); if (p && p.rooms.join(',') !== this.editSig) this._editLabels(); }
    // The cut faces the camera and sits a little in front of what you are looking at, so it works from any side and any distance.
    if (this.cutaway && !this.edit) {
      const tg = this.controls.target, n = this.clip[0].normal.copy(tg).sub(this.camera.position), d = n.length();
      n.multiplyScalar(1 / Math.max(1e-6, d));
      const lead = Math.max(0.2, Math.min(2.5, d * 0.12));
      this.clip[0].constant = -(n.x * tg.x + n.y * tg.y + n.z * tg.z) + lead;
    }
    if (this.selLines) { const o = this.partObjs.get(this.sel); if (o) { this.selLines.position.copy(o.position); this.selLines.quaternion.copy(o.quaternion); } }
    const k = Math.floor(now / 5); if (k !== this.slogan) { this.slogan = k; this._drawSlogan(k); }
    this._screens(now);
    if (this.clouds) this.clouds.rotation.y += dt * 0.004;
  }
  // Each part's rooms: rebuilt only when they change.
  _rooms(p) {
    const lay = SLOTS[p.type];
    if (!lay || p.state === 'building') return;
    const sig = `${p.rooms.join(',')}|${p.marks.join(',')}|${(p.fit || []).join(',')}|${C.scale.m}`;
    let r = this.roomObjs.get(p.id);
    if (r && r.sig === sig) return;
    if (r) this.scene.remove(r.group);
    const g = new THREE.Group();
    lay.forEach((s, i) => {
      const room = p.rooms[i] || 'empty', rg = buildRoom(room, s.w, s.d, doorSide(p.type, s), (p.fit && p.fit[i]) || 0);
      rg.position.set(...s.p); rg.rotation.y = s.ry;
      rg.traverse((x) => { x.userData.part = p.id; x.userData.slot = i; });
      // A room a faction asked for carries that faction's colour: a bar along the front edge and a flag on a short post.
      const mk = p.marks[i];
      if (mk && C.div[mk]) {
        const col = new THREE.Color(C.div[mk].col), m = new THREE.MeshBasicMaterial({ color: col });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.94, 0.012, 0.04), m); bar.position.set(0, 0.34, s.d * 0.475);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), m); post.position.set(s.w * 0.44, 0.28, s.d * 0.47);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.01), m); flag.position.set(s.w * 0.44 - 0.09, 0.47, s.d * 0.47);
        for (const x of [bar, post, flag]) { x.userData.role = 'mark'; x.userData.mat = m; x.userData.part = p.id; x.userData.slot = i; }
        rg.add(bar, post, flag);
      }
      g.add(rg);
    });
    g.position.set(...p.pos); g.quaternion.set(...p.quat);
    this._shade(g); this.scene.add(g);
    this.roomObjs.set(p.id, { group: g, sig }); this.roomVer = (this.roomVer || 0) + 1;
    this._dressRoom(g, this._dim(p.id), this.edit === p.id);
  }

  // ---------------------------------------------------------------- TRAFFIC: ships keep clear of the station and of each other
  // The station as flying things see it: one box round every part (in the part's own frame, so a solar wing is a thin slab and a
  // ring is a flat disc), and one sphere round the lot, the ENVELOPE. Everything that flies stays outside the envelope except
  // on its way in to a berth or out of one, and that way is checked against the boxes.
  _obstacles() {
    const st = this.st; let sig = ''; for (const p of st.parts.values()) sig += p.id + ',';
    if (sig === this._obSig) return;
    this._obSig = sig; this.obs = [];
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of st.parts.values()) {
      const b = shapeOf(p.type);
      const q = new THREE.Quaternion(...p.quat), pos = new THREE.Vector3(...p.pos), c = b.getCenter(new THREE.Vector3()).applyQuaternion(q).add(pos), r = b.getSize(new THREE.Vector3()).length() / 2;
      this.obs.push({ id: p.id, pos, q, qi: q.clone().invert(), boxes: b.boxes, c, r });
      lo.min(c.clone().subScalar(r)); hi.max(c.clone().addScalar(r));
    }
    // The room a docked ship takes up at every open-air berth counts as hull too (for every ship but the one whose berth it is).
    const docks = [...st.parts.values()].filter((p) => st.def(p).berth).sort((a, b) => a.id - b.id), vols = new Map();
    for (const p of docks) {
      const kind = st.def(p).ships[0], B = this._berthAt(p, kind);
      if (B.inside) continue;
      const h = SHIP_BOX[kind], o = { id: -p.id, of: p.id, ship: true, off: true, pos: B.pos, q: level(B.nose, new THREE.Quaternion()), boxes: [[-h[0], -h[1], -h[2], h[0], h[1], h[2]]], c: B.pos, r: Math.hypot(...h) };
      o.qi = o.q.clone().invert(); this.obs.push(o); vols.set(p.id, o);
      lo.min(o.c.clone().subScalar(o.r)); hi.max(o.c.clone().addScalar(o.r));
    }
    this.envC = this.obs.length ? lo.clone().add(hi).multiplyScalar(0.5) : new THREE.Vector3();
    this.envR = this.obs.reduce((m, o) => Math.max(m, o.c.distanceTo(this.envC) + o.r), 4);
    // WHICH BERTHS ARE OPEN. A berth is open if a ship can come straight in to it and reach it from outside the station without
    // touching a hull. Oldest first: where two berths are in each other's way, the older one stays open. Ships do not use a
    // shut berth, so nothing ever has to fly through the station to dock.
    const shut = new Map();      // berth -> what is in its way
    for (const p of docks) {
      const kind = st.def(p).ships[0], w = this._wayOut(this._berthAt(p, kind), kind, this.envR + 7);
      if (w.clear) { const o = vols.get(p.id); if (o) o.off = false; continue; }
      const by = w.by && st.parts.get(w.by.ship ? w.by.of : w.by.id);
      shut.set(p.id, by ? (w.by.ship ? `the berth at ${st.name(by)}` : st.name(by)) : 'the station');
    }
    this.shut = shut;
    if (st.setShut) st.setShut(shut);
  }
  // Would building this close a berth? The names of the berths (its own included) that would have no clear way in.
  berthWarn(type, pl) {
    const st = this.st, d = C.parts[type]; this._obstacles();
    const b = shapeOf(type);
    const q = new THREE.Quaternion(...pl.quat), pos = new THREE.Vector3(...pl.pos), ghost = { id: 1e9, pos, q, qi: q.clone().invert(), boxes: b.boxes, c: b.getCenter(new THREE.Vector3()).applyQuaternion(q).add(pos), r: b.getSize(new THREE.Vector3()).length() / 2 };
    const out = [];
    this.obs.push(ghost);
    for (const p of st.parts.values()) { const pd = st.def(p); if (!pd.berth || this.shut.has(p.id)) continue; if (ghost.c.distanceTo(new THREE.Vector3(...st.center(p))) > ghost.r + 30) continue; const kind = pd.ships[0]; if (!this._wayOut(this._berthAt(p, kind), kind, this.envR + 7).clear) out.push(st.name(p)); }
    if (d.berth) { const kind = d.ships[0], fake = { id: 1e9, type, pos: pl.pos, quat: pl.quat }; if (!this._wayOut(this._berthAt(fake, kind), kind, Math.max(this.envR, ghost.c.distanceTo(this.envC) + ghost.r) + 7).clear) out.push('its own berth'); }
    this.obs.pop();
    return out;
  }
  // How far a point is from the nearest hull (below 0: inside one), and the way out of it. `skip`: a part that does not count
  // (a ship's own berth). `ships`: other ships count too, as spheres.
  _gap(P, skip = 0, ships = null, out = null) {
    let best = Infinity; const l = this._v3, n = out;
    for (const o of this.obs) {
      if (o.id === skip || o.of === skip || o.off) continue;
      if (P.distanceTo(o.c) - o.r > best) continue;
      l.copy(P).sub(o.pos).applyQuaternion(o.qi);
      for (const b of o.boxes) {      // the small boxes that follow this part's hull
        const cx = Math.max(b[0], Math.min(b[3], l.x)), cy = Math.max(b[1], Math.min(b[4], l.y)), cz = Math.max(b[2], Math.min(b[5], l.z));
        let dx = l.x - cx, dy = l.y - cy, dz = l.z - cz, d = Math.hypot(dx, dy, dz);
        if (d >= best) continue;
        if (d < 1e-6) {      // inside the box: the shortest way out is through the nearest face
          const f = [[l.x - b[0], -1, 0, 0], [b[3] - l.x, 1, 0, 0], [l.y - b[1], 0, -1, 0], [b[4] - l.y, 0, 1, 0], [l.z - b[2], 0, 0, -1], [b[5] - l.z, 0, 0, 1]].reduce((a, c) => (c[0] < a[0] ? c : a));
          d = -f[0]; dx = f[1]; dy = f[2]; dz = f[3];
        } else { dx /= d; dy /= d; dz /= d; }
        if (d < best) { best = d; this._near = o; if (n) n.set(dx, dy, dz).applyQuaternion(o.q); }
      }
    }
    if (ships) for (const [x, r] of ships) { const d = P.distanceTo(x) - r; if (d < best) { best = d; if (n) { n.copy(P).sub(x); if (n.lengthSq() < 1e-8) n.set(0, 1, 0); n.normalize(); } } }
    return best;
  }
  // Can a ship of this kind fly the straight line from a to b without touching a hull? A ship flies level, and is wider than it is
  // tall, so the room it needs is a flat slab: three lines side by side, each with room round it. `more` is extra room all round.
  _clearLine(a, b, kind, skip, more = 0) {
    const [off, rad] = SHIP_LANE[kind], n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.8)), P = new THREE.Vector3();
    const side = new THREE.Vector3().subVectors(b, a).cross(UP); if (side.lengthSq() < 1e-6) side.set(0, 0, 1); side.normalize();
    for (let i = 0; i <= n; i++) for (const k of [0, -off, off]) if (this._gap(P.copy(a).lerp(b, i / n).addScaledVector(side, k), skip) < rad + more) { this._block = this._near; return false; }
    return true;
  }
  // A holding place of its own for every ship that is waiting or on its way in: eight of them round the station, well outside it.
  _holdSlot(s) {
    this.holdSlots ||= new Map();
    for (const id of [...this.holdSlots.keys()]) if (!this.st.ships.some((x) => x.id === id && x.state !== 'depart' && x.state !== 'docked')) this.holdSlots.delete(id);
    if (!this.holdSlots.has(s.id)) { const used = new Set(this.holdSlots.values()); let k = 0; while (used.has(k) && k < 15) k++; this.holdSlots.set(s.id, k); }
    return this.holdSlots.get(s.id);
  }
  _holdPos(k) {
    const a = HOLD_ORDER[k % 8] * Math.PI / 4 + 0.4 + Math.floor(k / 8) * 0.39, R = this.envR + 22 + (k % 3) * 3;
    return new THREE.Vector3(Math.cos(a) * R, (k % 2 ? 3 : -3), Math.sin(a) * R).add(this.envC);
  }
  // Where a ship sits when docked, the way out of its berth, and which way its nose points there.
  _berthOf(s) { const dp = this.st.parts.get(s.dock || s.lastDock); return dp && this.st.def(dp).berth ? this._berthAt(dp, s.kind) : null; }
  _berthAt(dp, kind) {
    const b = this.st.berth(dp), inside = dp.type === 'hangar' || dp.type === 'drydock', out = new THREE.Vector3(...b.dir), off = C.shipOff[kind] ?? 3;
    if (dp.type === 'hangar') b.pos[1] -= 1.25;      // a shuttle sets down on the hangar floor
    const pos = new THREE.Vector3(...b.pos).add(out.clone().multiplyScalar(dp.type === 'hangar' ? -3 : off));
    // mouth: where the room a docked ship takes up begins (at an open-air berth, the berth itself; in a bay, where the ship sits)
    return { pos, out, inside, mouth: inside ? pos : new THREE.Vector3(...b.pos).addScaledVector(out, 0.3), nose: inside ? out.clone() : out.clone().negate(), id: dp.id };      // into a hangar or drydock they back in, nose out
  }
  // THE GATE for a ship at M inside the envelope: the point on its own lane, outside the envelope, that it can reach by a straight
  // line clear of every hull. `first` is the line it would like best (straight out of its berth). Null if M is already outside.
  _gate(M, lane, kind, skip, first) {
    const E = this.envC;
    if (M.distanceTo(E) >= lane) return null;
    const radial = M.clone().sub(E); if (radial.lengthSq() < 1e-6) radial.copy(first || UP); radial.normalize();
    const f = first || radial, mix = (a, b, k) => a.clone().addScaledVector(b, k).normalize(), side = new THREE.Vector3().crossVectors(UP, radial); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
    const tries = [f, mix(f, radial, 1), radial, mix(radial, UP, 0.8), mix(radial, UP, -0.8), mix(f, UP, 0.8), mix(f, UP, -0.8), mix(radial, side, 0.8), mix(radial, side, -0.8), UP, UP.clone().negate(), mix(f, side, 1), mix(f, side, -1)];
    const at = (d) => { const m = M.clone().sub(E), bq = m.dot(d), t = -bq + Math.sqrt(Math.max(0, bq * bq - m.lengthSq() + lane * lane)); return M.clone().addScaledVector(d, t); };
    let by = null;
    for (const d of tries) { const g = at(d); if (this._clearLine(M, g, kind, skip, 0.3)) return g; by ||= this._block; }
    const g = at(radial); g.blocked = by; return g;
  }
  // THE WAY between a berth and open space, as points from the berth outward: straight out of the berth as far as is clear, then
  // on to the gate.
  _wayOut(B, kind, lane) {
    const pts = [B.pos.clone()];
    let L = 0; for (const t of [12, 9, 6]) if (this._clearLine(B.mouth, B.pos.clone().addScaledVector(B.out, t), kind, B.id)) { L = t; break; }
    pts.clear = L > 0; if (!L) { pts.by = this._block; L = 4; }
    const M = B.pos.clone().addScaledVector(B.out, L), G = this._gate(M, lane, kind, B.id, B.out);
    pts.push(B.pos.clone().addScaledVector(B.out, L * 0.5), M);
    if (G) { pts.push(M.clone().lerp(G, 0.35), G); if (G.blocked) { pts.clear = false; pts.by ||= G.blocked; } }      // a point part of the way along keeps the curve close to the line that was checked
    pts.gate = pts[pts.length - 1];
    return pts;
  }
  // Round the outside of the station from one point to another, never nearer its middle than either end is.
  _round(a, b) {
    const E = this.envC, ua = a.clone().sub(E), ub = b.clone().sub(E), ra = ua.length(), rb = ub.length(), qa = new THREE.Quaternion(), out = [];
    ua.normalize(); ub.normalize(); qa.setFromUnitVectors(ua, ub);
    const ang = ua.angleTo(ub), n = Math.max(1, Math.ceil(ang / 0.22)), q = new THREE.Quaternion(), id = new THREE.Quaternion();
    for (let i = 1; i < n; i++) { const t = i / n; q.copy(id).slerp(qa, t); out.push(ua.clone().applyQuaternion(q).multiplyScalar(ra + (rb - ra) * t).add(E)); }
    return out;
  }
  // A ship's route for the state it is in, drawn once and kept until its state, its berth or the station changes.
  _routeFor(s, o) {
    const u = o.userData, key = `${s.state}|${s.dock}|${s.lastDock}`, dur = s.state === 'approach' ? C.ships.approachSec : C.ships.departSec;
    if (u.route && u.route.key === key && u.route.sig === this._obSig) return u.route;
    const from = o.position.clone(), B = this._berthOf(s), k = this.holdSlots ? this.holdSlots.get(s.id) ?? 0 : 0, lane = this.envR + 7 + (k % 8) * 2.5, E = this.envC;
    const again = u.route && u.route.key === key;      // the station changed under it: go on from where it is now
    let pts, gate = null;
    if (s.state === 'approach' && B) {
      const way = this._wayOut(B, s.kind, lane); gate = way.gate; way.reverse();      // gate ... berth
      pts = [from, ...this._round(from, way[0]), ...way];
    } else {      // leaving: out of the berth by the same way, or straight out from wherever it is, and away
      let way;
      if (B && u.was === 'docked' && !again) { way = this._wayOut(B, s.kind, lane); gate = way.gate; }
      else { const G = this._gate(from, lane, s.kind, B ? B.id : 0, null); way = G ? [from, G] : [from]; }
      const last = way[way.length - 1], dir = last.clone().sub(E); if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0); dir.normalize();
      pts = [...way, last.clone().addScaledVector(dir, 40), last.clone().addScaledVector(dir, 170)];
    }
    const clean = [pts[0]]; for (const x of pts) if (x.distanceTo(clean[clean.length - 1]) > 0.05) clean.push(x);
    if (clean.length < 2) clean.push(clean[0].clone().add(UP));
    u.route = { key, sig: this._obSig, curve: new THREE.CatmullRomCurve3(clean, false, 'centripetal'), u0: again ? Math.min(0.95, s.t / dur) : 0, tail: B ? B.pos.clone() : null };
    // how far along the curve the gate is (0 to 1): inside it the ship keeps the heading its berth wants; outside it, it may turn
    const R = u.route; R.gateAt = s.state === 'approach' ? 1 : 0;
    if (gate) { let bd = Infinity; const P = new THREE.Vector3(); for (let i = 0; i <= 80; i++) { const d = R.curve.getPointAt(i / 80, P).distanceTo(gate); if (d < bd) { bd = d; R.gateAt = i / 80; } } }
    return R;
  }
  _ships(now, dt) {
    const st = this.st, S = C.ships;
    this._obstacles();
    for (const [id, o] of this.shipObjs) if (!st.ships.some((s) => s.id === id)) { this.scene.remove(o); this.shipObjs.delete(id); }
    const ease = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); }, fly = [];
    for (const s of st.ships) {
      let o = this.shipObjs.get(s.id), fresh = false;
      if (!o) { o = buildShip(s.kind); o.scale.setScalar(C.shipScale[s.kind] || 1); this._dress(o, 'active', !!this.edit, false, true); this._shade(o); this.scene.add(o); this.shipObjs.set(s.id, o); o.userData.push = new THREE.Vector3(); o.userData.nom = new THREE.Vector3(); fresh = true; }
      const u = o.userData, pos = u.nom, look = u.look ||= new THREE.Vector3();
      let free = 1;      // how free it is to step aside for another ship: not at all on the last of the way in to a berth
      if (s.state === 'hold') {
        const hold = this._holdPos(this._holdSlot(s)), dir = hold.clone().sub(this.envC).normalize(), k = ease(s.t / 5);
        pos.copy(hold).addScaledVector(dir, (1 - k) * 180); pos.y += Math.sin(now * 0.4 + s.seed * 9) * 0.3;
        if (k >= 1) look.crossVectors(UP, dir); else look.copy(dir).negate();
      } else if (s.state === 'docked') {
        const B = this._berthOf(s); if (B) { pos.copy(B.pos); look.copy(B.nose); } else pos.copy(o.position);
        free = 0;
      } else {
        if (fresh) {      // first seen already on its way: in from deep space beyond its holding place, or out from its berth
          if (s.state === 'approach') { const h = this._holdPos(this._holdSlot(s)); o.position.copy(h).addScaledVector(h.clone().sub(this.envC).normalize(), 70); }
          else o.position.copy((this._berthOf(s) || { pos: this.envC }).pos);
          u.was = s.state === 'depart' ? 'docked' : 'hold';
        }
        const R = this._routeFor(s, o), dur = s.state === 'approach' ? S.approachSec : S.departSec, raw = Math.min(1, Math.max(0, (s.t / dur - R.u0) / (1 - R.u0)));
        const t = s.state === 'approach' ? ease(raw) : Math.pow(raw, 2.2);
        R.curve.getPointAt(t, pos); R.curve.getTangentAt(Math.min(0.999, t), look);
        if (R.tail) {
          // Between the gate and the berth there is no room to turn round, so a ship holds the heading its berth wants: one that
          // docks nose in backs out as far as the gate before it turns; one that docks nose out turns before the gate and backs in.
          const B = this._berthOf(s), noseIn = !B || !B.inside, inGate = s.state === 'approach' ? t > R.gateAt - 0.06 : t < R.gateAt + 0.02;
          if (inGate && (s.state === 'approach') !== noseIn) look.negate();
          free = Math.min(1, Math.max(0, (pos.distanceTo(R.tail) - 5) / 8));      // and no stepping aside on the last of the way in
        }
      }
      u.free = free; u.dock = s.dock || s.lastDock;
      fly.push([s, o]);
    }
    this.shipSph = fly.filter(([, o]) => o.visible).map(([s, o]) => [o.position, SHIP_R[s.kind]]);
    // KEEPING APART. Two ships closer than their hulls allow: the one free to move steps aside (the later arrival, if both are),
    // and eases back when the way is clear. A ship at a berth, or on the last of its way in, holds its line.
    for (const [s, o] of fly) {
      const u = o.userData, want = this._sc.set(0, 0, 0), d3 = this._col3 ||= new THREE.Vector3();
      if (u.free > 0) for (const [s2, o2] of fly) {
        if (o2 === o) continue;
        const u2 = o2.userData; if (u2.free >= u.free && s2.id > s.id) continue;      // that one gives way to this one
        const need = SHIP_R[s.kind] + SHIP_R[s2.kind] + 1.5, d = d3.copy(u.nom).sub(u2.nom).length();
        if (d >= need) continue;
        if (d < 1e-3) d3.set(0, 1, 0); else d3.multiplyScalar(1 / d);
        d3.y += d3.y >= 0 ? 0.6 : -0.6; d3.normalize();      // mostly over or under, so it does not swing wide round the station
        want.addScaledVector(d3, need - d);
      }
      u.push.lerp(want, 1 - Math.exp(-(dt || 0.016) * 3));
      o.position.copy(u.nom).addScaledVector(u.push, u.free);
      // stepping aside must not put it into a hull: if it would, step half as far, or not at all
      if (u.push.lengthSq() * u.free > 1e-4) for (const k of [0.5, 0]) { if (this._gap(o.position, u.dock) >= SHIP_LANE[s.kind][0] + SHIP_LANE[s.kind][1]) break; o.position.copy(u.nom).addScaledVector(u.push, u.free * k); }
      if (u.look.lengthSq() > 1e-6) o.quaternion.slerp(level(u.look, this._qb), s.state === 'docked' ? 1 : 1 - Math.exp(-(dt || 0.016) * 2.6));
      o.visible = !(s.state === 'depart' && s.t > S.departSec * 0.96);
      if (u.was !== s.state && s.state !== 'depart') u.was = s.state;
      if (s.kind === 'freighter') { let i = 0; const n = s.state === 'docked' ? s.crates : s.state === 'depart' ? 0 : 8; o.traverse((x) => { if (x.userData.role === 'pod') x.visible = i++ < n; }); }
    }
  }

  // ---------------------------------------------------------------- people: life signs inside, suits outside
  _agentsInit() {
    const N = 900, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    geo.setDrawRange(0, 0);
    const dc = document.createElement('canvas'); dc.width = dc.height = 64;
    const dx = dc.getContext('2d'), gr = dx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    dx.fillStyle = gr; dx.fillRect(0, 0, 64, 64);
    this.agentMat = new THREE.PointsMaterial({ size: 0.55, map: new THREE.CanvasTexture(dc), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.agentPts = new THREE.Points(geo, this.agentMat);
    this.agentPts.frustumCulled = false; this.agentPts.renderOrder = 5;
    this.scene.add(this.agentPts);
  }
  // ---- where people are. Nobody floats through a wall: they stand in a room that suits their job, leave by its door, follow the
  // part's walk (corridor, ring or lift) to the join, and do the same on the other side.
  _toLocal(p, w) { const o = this._tl || (this._tl = new THREE.Vector3()), qi = this._tq || (this._tq = new THREE.Quaternion()); qi.set(...p.quat).invert(); o.set(w[0] - p.pos[0], w[1] - p.pos[1], w[2] - p.pos[2]).applyQuaternion(qi); return [o.x, o.y, o.z]; }
  // A person's own spot in a part: { spot, door } in the part's frame.
  _rest(a, p) {
    const key = p.id * 4096 + ((this.roomVer || 0) & 4095);
    if (a._rk === key) return a._rs;
    const lay = SLOTS[p.type], d = C.parts[p.type];
    let out;
    if (lay && lay.length) {
      const want = STAND[a.role] || STAND.resident;
      let idx = [];
      for (const r of want) { idx = lay.map((_, i) => i).filter((i) => p.rooms[i] === r); if (idx.length) break; }
      if (!idx.length) idx = lay.map((_, i) => i).filter((i) => !KEEP_OUT.has(p.rooms[i]));
      if (!idx.length) idx = lay.map((_, i) => i);
      const si = idx[Math.floor(a.seed * 997) % idx.length];
      out = slotSpot(p.type, si, a.seed, p.rooms[si] || 'empty', (p.fit && p.fit[si]) || 0);
    } else {
      const c = [d.center[0] + (a.seed - 0.5) * 0.8, d.center[1], d.center[2]], w = onWalk(p.type, c);
      out = { spot: w ? [w[0], w[1], w[2] + (a.seed * 5.1 % 1 - 0.5) * 0.2] : [c[0], c[1] - 0.2, (a.seed * 5.1 % 1 - 0.5) * 0.5], door: null };
    }
    a._rk = key; a._rs = out;
    return out;
  }
  // Where someone passing through a part is taken to be when the view has not seen which way they came in.
  _hubPt(p) { const d = C.parts[p.type]; return onWalk(p.type, d.center) || d.center; }
  // A leg inside one part, between two ends (parts.js, partPath), as world points with running lengths. `hide` lists the lifts on
  // the way, as circles on the ground: inside one, the walker is in a closed lift and is not drawn.
  _leg(p, from, to) {
    const P = partPath(p, from, to), out = P.pts.map((l) => addRot(p.pos, p.quat, [l[0], l[1] + FL, l[2]])), len = [0];
    for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1], out[i][2] - out[i - 1][2]));
    const hide = P.hide.map(([x, z, r]) => { const w = addRot(p.pos, p.quat, [x, 0, z]); return [w[0], w[2], r]; });
    return { pts: out, len, hide, pid: p.id };
  }
  _along(L, f) {
    const total = L.len[L.len.length - 1], want = Math.max(0, Math.min(1, f)) * total;
    let i = 1; while (i < L.len.length - 1 && L.len[i] < want) i++;
    const a = L.pts[i - 1], b = L.pts[i] || a, seg = L.len[i] - L.len[i - 1], t = seg > 1e-6 ? (want - L.len[i - 1]) / seg : 0;
    const dx = b[0] - a[0], dz = b[2] - a[2], x = a[0] + dx * t, z = a[2] + dz * t;
    let hid = 0; for (const h of L.hide) if (Math.hypot(x - h[0], z - h[1]) < h[2]) { hid = L.pid; break; }
    return [x, a[1] + (b[1] - a[1]) * t, z, Math.hypot(dx, dz) > 1e-4 ? Math.atan2(dx, dz) : null, null, hid];
  }
  // Where a person is, as [x, y, z, heading, facing, lift]. Heading is null when they are standing. `lift` is the id of the part
  // whose lift they are inside (so they are not drawn), or 0.
  agentPos(a, now) {
    const st = this.st, p = st.parts.get(a.at);
    if (!p) return null;
    if (a._at !== a.at) { a._prev = a._at; a._at = a.at; }
    if (a.path.length) {
      const to = st.parts.get(a.path[0]);
      if (to) {
        const key = `${a.at}|${to.id}|${a.leg || 0}|${a.path.length}|${this.roomVer || 0}`;
        if (a._wk !== key) {
          const e = st.edge(p, to), jA = this._toLocal(p, e.conn), jB = this._toLocal(to, e.conn);
          // They set out from their own place; or, passing through, from where the way they came in by met this part's walk.
          let from;
          if ((a.leg || 0) === 0) from = this._rest(a, p);
          else { const prev = st.parts.get(a._prev), near = prev && prev.id !== to.id && (prev.parent === p.id || p.parent === prev.id); from = { walk: near ? wayPoint(p, this._toLocal(p, st.edge(prev, p).conn)) : this._hubPt(p) }; }
          a._wk = key; a._we = e;
          a._wa = this._leg(p, from, { join: jA });
          a._wb = this._leg(to, { join: jB }, a.path.length === 1 ? this._rest(a, to) : { walk: wayPoint(to, jB) });
        }
        const e = a._we;
        return a.s < e.da ? this._along(a._wa, a.s / Math.max(0.01, e.da)) : this._along(a._wb, (a.s - e.da) / Math.max(0.01, e.db));
      }
    }
    const rs = this._rest(a, p), r = rs.spot;
    const w = addRot(p.pos, p.quat, [r[0], r[1] + FL, r[2]]);
    return [w[0], w[1], w[2], null, rs.face ?? null, 0];
  }
  // THE LIFTS. A lift is a closed tube (parts.js draws it), so there is no car to see. What shows where the car is, is a band of
  // light round the tube at the car's roof: it goes to whoever is riding, and with nobody aboard it calls at each deck in turn.
  _lifts(dt) {
    const st = this.st, show = this.figOn;
    for (const [id, c] of this.lifts) if (!st.parts.has(id)) { this.scene.remove(c.obj); this.lifts.delete(id); }
    for (const p of st.parts.values()) {
      const lay = SLOTS[p.type];
      if (liftR(p.type) !== LIFT_R || !lay || !lay.length || p.state !== 'active') continue;
      let c = this.lifts.get(p.id);
      if (!c) {
        const g = new THREE.Group(), band = new THREE.Mesh(new THREE.TorusGeometry(LIFT_R * 1.07, 0.011, 6, 24).rotateX(Math.PI / 2), this.M.lane);
        band.position.y = 0.335; g.add(band); this.scene.add(g);
        const ys = [...new Set(lay.map((sl) => sl.p[1]))].sort((u, v) => u - v).map((y) => p.pos[1] + y + FL);
        c = { obj: g, y: ys[0], ys, at: 0, dir: 1, wait: 2 + (p.id % 5), quiet: 0 }; this.lifts.set(p.id, c);
      }
      const want = this.liftRider.get(p.id);
      if (want !== undefined) { c.y += Math.max(-dt * 6, Math.min(dt * 6, want - c.y)); c.quiet = 0; }
      else if (c.ys.length > 1 && (c.quiet += dt) > 5) {      // nobody aboard for a while: call at the next deck, wait, and go on
        const to = c.ys[c.at];
        if (Math.abs(to - c.y) > 1e-3) c.y += Math.max(-dt * 0.9, Math.min(dt * 0.9, to - c.y));
        else if ((c.wait -= dt) <= 0) { if (c.at + c.dir < 0 || c.at + c.dir >= c.ys.length) c.dir = -c.dir; c.at += c.dir; c.wait = 4; }
      }
      c.obj.position.set(p.pos[0], c.y, p.pos[2]); c.obj.visible = show;
    }
  }
  // AIRLOCK DOORS. A side port with nowhere to walk to beyond it keeps its airlock shut. Every shut door on the station is one
  // batch: a steel door with a red bar across it, standing in the airlock frame that parts.js drew at the port.
  _airlocks() {
    const st = this.st, MAX = 800;
    if (!this.alDoor) {
      this.alDoor = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.27, 0.24), this.M.steel, MAX); this.alBar = new THREE.InstancedMesh(new THREE.BoxGeometry(0.026, 0.03, 0.2), this.M.alarm, MAX);
      for (const im of [this.alDoor, this.alBar]) { im.count = 0; im.frustumCulled = false; this.scene.add(im); }
    }
    this.alDoor.visible = this.alBar.visible = this.mode === 'hull';
    let sig = ''; for (const p of st.parts.values()) sig += `${p.id}${p.state[0]}${p.kids.join('.')};`;
    if (sig === this._alSig) return;
    this._alSig = sig;
    const m4 = new THREE.Matrix4(), pq = new THREE.Quaternion(), qy = new THREE.Quaternion(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (const p of st.parts.values()) {
      if (p.state !== 'active' || !WALK[p.type]) continue;
      C.parts[p.type].ports.forEach((q, i) => {
        if (Math.abs(q[4]) > 0.7 || n >= MAX) return;
        const nb = p.used.has(i) ? p.kids.map((k) => st.parts.get(k)).find((k) => k && k.pport === i) || st.parts.get(p.parent) : null;
        if (nb && nb.state === 'active' && WALK[nb.type]) return;      // open: there is somewhere to walk to
        const y = sillY(p.type, q[1]) + FL;
        pq.set(...p.quat); qy.setFromAxisAngle(UP, -Math.atan2(q[5], q[3])); pq.multiply(qy);
        for (const [im, ly] of [[this.alDoor, 0.14], [this.alBar, 0.15]]) { v3.set(...addRot(p.pos, p.quat, [q[0] - q[3] * 0.11, y + ly, q[2] - q[5] * 0.11])); m4.compose(v3, pq, one); im.setMatrixAt(n, m4); }
        n++;
      });
    }
    for (const im of [this.alDoor, this.alBar]) { im.count = n; im.instanceMatrix.needsUpdate = true; }
  }
  // Keep the camera on one person: what it looks at glides to them, and the camera goes with it, so the angle and distance are yours.
  follow(a, dt) {
    const P = this.agentPos(a, performance.now() / 1000);
    if (!P) return false;
    const tg = this.controls.target, k = 1 - Math.exp(-dt * 7), dx = (P[0] - tg.x) * k, dy = (P[1] + 0.1 * this.peopleK - tg.y) * k, dz = (P[2] - tg.z) * k;
    tg.x += dx; tg.y += dy; tg.z += dz; this.camera.position.x += dx; this.camera.position.y += dy; this.camera.position.z += dz;
    this.controls.autoRotate = false;
    return true;
  }
  // Bring the camera in to a given distance from what it is looking at, if it is further away than that.
  closeIn(dist) { const off = this.camera.position.clone().sub(this.controls.target), d = off.length(); if (d > dist) this.camera.position.copy(this.controls.target).add(off.multiplyScalar(dist / d)); }
  // How big a figure is drawn: the standard height (C.scale) over the height it was modelled at, times the player's own setting.
  personK() { return C.scale.person / C.scale.m / 0.33 * this.peopleK; }
  _agents(now) {
    const pos = this.agentPts.geometry.attributes.position, col = this.agentPts.geometry.attributes.color;
    let n = 0;
    const put = (P, c) => { if (n >= pos.count) return; pos.setXYZ(n, P[0], P[1] + 0.1, P[2]); col.setXYZ(n, c[0], c[1], c[2]); n++; };
    const count = {}, fig = this.figOn, m4 = this._m4, qa = this._qa, qb = this._qb, sc = this._sc, v3 = this._v3, tintc = this._col;
    let crates = 0;
    this.liftRider.clear();
    for (const a of this.st.agents) {
      if (a.eva) continue;
      const P = this.agentPos(a, now);
      if (!P) continue;
      if (!fig) { put(P, a.carry ? ROLE_COL.carry : ROLE_COL[a.role] || ROLE_COL.resident); continue; }
      if (P[5]) { this.liftRider.set(P[5], P[1]); continue; }      // inside a lift: the tube is closed, so there is nobody to draw
      // A figure stands on the deck of the part it is in, turned the way it walks (or a way of its own when it is standing).
      // A gunner is drawn by where they live: a trooper from a barrack room, a pilot from a pad, a gun crew otherwise.
      let fk = a.role;
      if (fk === 'resident') fk = RESIDENTS[Math.floor(a.seed * 4) % 4];
      if (fk === 'gunner') { const hp = this.st.parts.get(a.home), ht = hp ? hp.type : ''; fk = ht === 'barracks' ? 'trooper' : ht === 'eaglehangar' || ht === 'pelicanbay' ? (a.seed < 0.5 ? 'pilot' : 'gunner') : 'gunner'; }
      const walking = a.path.length > 0 && !P[5], ck = walking ? `w${fk}` : fk;
      const im = (walking ? this.figsW : this.figs)[fk] || this.figs.resident, i = count[ck] = (count[ck] || 0), part = this.st.parts.get(a.at);
      if (i >= im.instanceMatrix.count) continue;
      count[ck] = i + 1;
      if (P[3] !== null && P[3] !== undefined) qa.setFromAxisAngle(UP, P[3] + Math.sin(now * 9 + a.seed * 30) * 0.1);
      else { qa.set(...part.quat); qb.setFromAxisAngle(UP, P[4] !== null && P[4] !== undefined ? P[4] + Math.sin(now * 0.4 + a.seed * 20) * 0.25 : a.seed * 6.283); qa.multiply(qb); }
      v3.set(P[0], P[1], P[2]);
      const step = Math.sin(now * 7 + a.seed * 40), bob = walking ? 1 - Math.abs(step) * 0.03 : 1;
      const ps = this.personK();
      m4.compose(v3, qa, sc.set(walking && step < 0 ? -ps : ps, ps * bob, ps)); im.setMatrixAt(i, m4);
      if (a.carry && crates < this.crateIM.instanceMatrix.count) { v3.set(0, 0.2 * ps, 0.08 * ps).applyQuaternion(qa).add(sc.set(P[0], P[1], P[2])); m4.compose(v3, qa, sc.set(ps * 1.3, ps * 1.3, ps * 1.3)); this.crateIM.setMatrixAt(crates++, m4); }
    }
    for (const r of FIGURES) { const im = this.figs[r], iw = this.figsW[r]; im.count = fig ? count[r] || 0 : 0; im.instanceMatrix.needsUpdate = true; iw.count = fig ? count[`w${r}`] || 0 : 0; iw.instanceMatrix.needsUpdate = true; }
    this.crateIM.count = crates; this.crateIM.instanceMatrix.needsUpdate = true;
    for (const P of this.evaPos) put(P, ROLE_COL.eva);
    this.agentPts.geometry.setDrawRange(0, n);
    pos.needsUpdate = true; col.needsUpdate = true;
  }
  _figuresInit() {
    // figs: people standing; figsW: people in mid-stride (mirrored left and right as they walk, so the material is two-sided)
    this.figs = {}; this.figsW = {};
    const mat = this.figMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.02, side: THREE.DoubleSide });
    for (const r of FIGURES) for (const [set, pose] of [[this.figs, 'stand'], [this.figsW, 'walk']]) {
      const im = new THREE.InstancedMesh(buildFigure(r, pose), mat, 160);
      im.count = 0; im.frustumCulled = false; im.visible = false; this.scene.add(im); set[r] = im;
    }
    this.lifts = new Map(); this.liftRider = new Map();
    this.crateIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), new THREE.MeshStandardMaterial({ color: 0xc08a3a, roughness: 0.8, flatShading: true }), 200);
    this.crateIM.count = 0; this.crateIM.frustumCulled = false; this.crateIM.visible = false; this.scene.add(this.crateIM);
    this._m4 = new THREE.Matrix4(); this._qa = new THREE.Quaternion(); this._qb = new THREE.Quaternion(); this._sc = new THREE.Vector3(); this._v3 = new THREE.Vector3(); this._col = new THREE.Color();
    this.peopleOn = false; this.figOn = false;
  }
  // ---------------------------------------------------------------- a raid: darts making passes, the station's guns answering
  _raidInit() {
    this.raiders = new THREE.Group(); this.scene.add(this.raiders); this.raiders.visible = false;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(64 * 6), 3)); geo.setDrawRange(0, 0);
    this.tracers = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9 })); this.tracers.frustumCulled = false; this.scene.add(this.tracers);
    const g2 = geo.clone(); this.bolts = new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.9 })); this.bolts.frustumCulled = false; this.scene.add(this.bolts);
  }
  _raid(now, dt) {
    const r = this.st.raid, on = !!r && (r.state === 'fight' || r.t > C.raid.warnSec - 8);
    this.raiders.visible = on; this.tracers.visible = this.bolts.visible = !!r && r.state === 'fight';
    if (!on) { if (this.raiders.children.length) this.raiders.clear(); return; }
    while (this.raiders.children.length < r.n) { const o = buildRaider(); o.traverse((x) => { if (x.userData.role) x.material = this.M[x.userData.role]; }); this.raiders.add(o); }
    // Raiders circle OUTSIDE the station, never through it: six tilted rings at six distances just beyond the envelope, the darts
    // on each ring evenly spaced and all going the same way, so no two cross. One that meets a ship lifts over it.
    this._obstacles();
    const E = this.envC, R0 = this.envR + 4, fight = r.state === 'fight', inn = fight ? 1 : Math.max(0, 1 - (C.raid.warnSec - r.t) / 8), BANDS = 6;
    const u = new THREE.Vector3(), w = new THREE.Vector3(), nrm = new THREE.Vector3(), tan = new THREE.Vector3();
    this.raiders.children.forEach((o, i) => {
      const band = i % BANDS, lap = Math.floor(i / BANDS), inBand = Math.ceil((r.n - band) / BANDS), sgn = band % 2 ? -1 : 1;
      const rr = R0 + band * 2.4, tilt = (0.3 + band * 0.16) * sgn, az = r.seed * 6.283 + band * 1.1;
      nrm.set(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));      // the ring's own axis
      u.crossVectors(nrm, UP); if (u.lengthSq() < 1e-6) u.set(1, 0, 0); u.normalize(); w.crossVectors(nrm, u);
      const a = sgn * now * 9 / rr + r.seed * 6.283 + band * 1.3 + lap * 6.283 / Math.max(1, inBand);
      let lift = 0; for (const so of this.shipObjs.values()) { if (!so.visible) continue; const d = so.position.distanceTo(o.position); if (d < 11) lift = Math.max(lift, (11 - d) * 1.3); }
      o.userData.lift = (o.userData.lift || 0) + (lift - (o.userData.lift || 0)) * Math.min(1, dt * 6);
      const dist = rr + o.userData.lift + (1 - inn) * 240;
      o.position.copy(E).addScaledVector(u, Math.cos(a) * dist).addScaledVector(w, Math.sin(a) * dist);
      tan.copy(u).multiplyScalar(-Math.sin(a) * sgn).addScaledVector(w, Math.cos(a) * sgn);
      o.lookAt(tan.add(o.position)); o.rotateY(-Math.PI / 2);
    });
    if (!fight) return;
    const guns = [...this.st.parts.values()].filter((p) => p.state === 'active' && !p.fault && (p.type === 'turret' || p.type === 'shield')), all = [...this.st.parts.values()];
    const tp = this.tracers.geometry.attributes.position, bp = this.bolts.geometry.attributes.position;
    let nt = 0, nb = 0;
    this.raiders.children.forEach((o, i) => {
      const k = Math.floor(now * 5 + i * 1.3);
      if (guns.length && (k + i) % 3 === 0 && nt < 60) { const g = this.st.center(guns[(k + i) % guns.length]), f = (now * 5 + i * 1.3) % 1; tp.setXYZ(nt++, g[0] + (o.position.x - g[0]) * f, g[1] + (o.position.y - g[1]) * f, g[2] + (o.position.z - g[2]) * f); const f2 = Math.min(1, f + 0.12); tp.setXYZ(nt++, g[0] + (o.position.x - g[0]) * f2, g[1] + (o.position.y - g[1]) * f2, g[2] + (o.position.z - g[2]) * f2); }
      if (k % 4 === 1 && nb < 60) { const t = this.st.center(all[(k * 7 + i) % all.length]), f = (now * 5 + i * 1.3) % 1; bp.setXYZ(nb++, o.position.x + (t[0] - o.position.x) * f, o.position.y + (t[1] - o.position.y) * f, o.position.z + (t[2] - o.position.z) * f); const f2 = Math.min(1, f + 0.1); bp.setXYZ(nb++, o.position.x + (t[0] - o.position.x) * f2, o.position.y + (t[1] - o.position.y) * f2, o.position.z + (t[2] - o.position.z) * f2); }
    });
    this.tracers.geometry.setDrawRange(0, nt); this.bolts.geometry.setDrawRange(0, nb); tp.needsUpdate = true; bp.needsUpdate = true;
    void dt;
  }
  // ---------------------------------------------------------------- the platform answering a call: fire going down, craft leaving
  fire(e) {
    const p = this.st.parts.get(e.part), o = p && this.partObjs.get(p.id);
    if (!o) return;
    this.shotList ||= []; this.shotGrp ||= (() => { const g = new THREE.Group(); this.scene.add(g); return g; })();
    const from = new THREE.Vector3(...(MUZZLE[p.type] || C.parts[p.type].center)).applyQuaternion(o.quaternion).add(o.position);
    const beam = (r, len, col, life, delay = 0, speed = 0) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.position.copy(from).add(new THREE.Vector3(0, -len / 2, 0)); m.visible = false; this.shotGrp.add(m);
      this.shotList.push({ o: m, t: -delay, life, vy: -speed, fade: true });
    };
    const flash = (r, col) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.copy(from); this.shotGrp.add(m); this.shotList.push({ o: m, t: 0, life: 0.35, vy: 0, fade: true, grow: 2.5 }); };
    const craft = (obj, life) => {
      obj.traverse((x) => { if (x.userData.role) x.material = { hull: this.M.craft, trim: this.M.craftTrim, glass: this.M.thGlass, glow: this.M.glow, line: this.M.hullLine }[x.userData.role] || this.M[x.userData.role] || this.M.craft; });
      const out = new THREE.Vector3(1, 0, 0).applyQuaternion(o.quaternion);
      obj.position.copy(from); obj.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), out.clone().add(new THREE.Vector3(0, -0.5, 0)).normalize());
      this.shotGrp.add(obj); this.shotList.push({ o: obj, t: 0, life, dir: out, craft: true, skip: p.id });
    };
    if (e.sys === 'gun') { for (let i = 0; i < 6; i++) beam(0.05, 6, 0xffd98a, 0.5, i * 0.12, 260); flash(0.35, 0xffd98a); }
    else if (e.sys === 'orbital') { beam(0.16, 14, 0xfff0c0, 0.9, 0, 200); flash(0.9, 0xffe0a0); }
    else if (e.sys === 'classified') { beam(0.5, 900, 0x9fe8ff, 1.8); beam(0.18, 900, 0xffffff, 1.8); flash(1.6, 0x9fe8ff); }
    else if (e.sys === 'eagle') craft(buildEagle(), 6);
    else if (e.sys === 'seaf') { const s = buildShip('shuttle'); s.scale.setScalar(C.shipScale.shuttle); craft(s, 7); }
    else if (e.sys === 'uav') { const g = new THREE.Group(), c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 4).rotateZ(-Math.PI / 2)); c.userData.role = 'hull'; const w = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.9)); w.userData.role = 'hull'; g.add(c, w); craft(g, 6); }
    else { const g = new THREE.Group(), c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5)); c.userData.role = 'pod'; g.add(c); craft(g, 6); }
  }
  _shots(dt) {
    if (!this.shotList || !this.shotList.length) return;
    for (const s of [...this.shotList]) {
      s.t += dt;
      if (s.t < 0) continue;
      s.o.visible = true;
      const k = s.t / s.life;
      if (s.craft) {
        const sp = 3 + s.t * s.t * 4; s.o.position.addScaledVector(s.dir, sp * dt * (k < 0.3 ? 1 : 0.6)); s.o.position.y -= sp * dt * Math.min(1.4, k * 2.5);
        // a craft leaving for the ground steers round any hull or ship in its way (its own bay does not count)
        if (this.obs) { const n = this._sc, d = this._gap(s.o.position, s.skip, this.shipSph, n); if (d < 1.7) s.o.position.addScaledVector(n, Math.min(1.7 - d, dt * 9)); }
      }
      else { s.o.position.y += s.vy * dt; if (s.grow) s.o.scale.setScalar(1 + k * s.grow); if (s.fade) s.o.material.opacity = Math.max(0, 0.95 * (1 - k)); }
      if (k >= 1) { this.shotGrp.remove(s.o); if (!s.craft) { s.o.geometry.dispose(); s.o.material.dispose(); } this.shotList.splice(this.shotList.indexOf(s), 1); }
    }
  }
  // A picture of a part for the build menu: drawn once, in its hull colours, from the game's usual angle.
  thumb(type) {
    this.thumbs ||= new Map();
    if (this.thumbs.has(type)) return this.thumbs.get(type);
    const W = 168, H = 112;
    try {
      if (!this.th) {
        const sc = new THREE.Scene(); sc.add(new THREE.AmbientLight(0xb8c8c0, 1.1));
        const sun = new THREE.DirectionalLight(0xfff4e0, 2.6); sun.position.set(-6, 10, 7); sc.add(sun);
        const rim = new THREE.DirectionalLight(0x7fe9e0, 0.9); rim.position.set(6, -4, -8); sc.add(rim);
        this.th = { sc, rt: new THREE.WebGLRenderTarget(W, H, { samples: 4 }), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400), px: new Uint8Array(W * H * 4), cv: Object.assign(document.createElement('canvas'), { width: W, height: H }) };
        this.th.rt.texture.colorSpace = THREE.SRGBColorSpace;
      }
      const { sc, rt, cam, px, cv } = this.th, M = this.M, R = this.renderer;
      const g = buildPart(type);
      g.traverse((o) => { const r = o.userData.role; if (r) o.material = { trim: M.trim, dark: M.dark, decal: M.decal, hull: M.thHull, line: M.hullLine, inner: M.hidden, innerLine: M.hidden, glow: M.glow, glass: M.thGlass, panel: M.thPanel, wire: M.wire, pod: M.thPod, screen: M.glow }[r] || M.hidden; });
      sc.add(g);
      const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), rad = box.getSize(new THREE.Vector3()).length() / 2 || 1;
      cam.position.copy(c).add(new THREE.Vector3(0.62, 0.52, 0.6).normalize().multiplyScalar(120)); cam.lookAt(c);
      const a = W / H, k = rad * 0.86; Object.assign(cam, { left: -k * a, right: k * a, top: k, bottom: -k }); cam.updateProjectionMatrix();
      const cc = new THREE.Color(); R.getClearColor(cc); const ca = R.getClearAlpha();
      R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(sc, cam);
      R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(null); R.setClearColor(cc, ca);
      sc.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      const x = cv.getContext('2d'), im = x.createImageData(W, H);
      for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      x.putImageData(im, 0, 0);
      const url = cv.toDataURL(); this.thumbs.set(type, url); return url;
    } catch (e) { this.thumbs.set(type, null); return null; }
  }
  // The current picture, as a PNG.
  snapshot(now) { this.render(now); return this.canvas.toDataURL('image/png'); }
  // EVA: suits round parts being built, round faults being fixed, and round warships in the drydock. Nobody manages them.
  _eva(now) {
    const st = this.st, jobs = [];
    for (const p of st.parts.values()) if (p.state === 'building') for (let i = 0; i < 2; i++) jobs.push({ p, k: p.seed + i * 0.37 });
    for (const a of st.agents) {
      if (!a.eva) continue;
      const p = st.parts.get(a.at);
      if (!p) continue;
      if (a.task === 'drydock') { const o = this.shipObjs.get(a.ship); if (o) jobs.push({ ship: o, k: a.seed }); }
      else jobs.push({ p, k: a.seed });
    }
    while (this.suitPool.length < jobs.length) { const s = buildSuit(); s.traverse((x) => { if (x.userData.role) x.material = this.M[x.userData.role]; }); this.suits.add(s); this.suitPool.push(s); }
    this.evaPos = [];
    const sc = (this.mode === 'blueprint' ? 1.1 : 0.6) * this.peopleK;
    this.suitPool.forEach((s, i) => {
      const j = jobs[i];
      s.visible = !!j && this.mode !== 'life';
      if (!j) return;
      if (j.ship) {
        const a = j.k * 6.283 + now * 0.12, c = j.ship.position;
        s.position.set(c.x + Math.cos(a) * 2.2, c.y + Math.sin(j.k * 13 + now * 0.2) * 0.8, c.z + Math.sin(a) * 2.2);
        s.lookAt(c);
      } else {
        const [pos, look] = this._surface(j.p, j.k, now);
        s.position.set(...pos); s.lookAt(...look);
      }
      s.scale.setScalar(sc);
      this.evaPos.push([s.position.x, s.position.y, s.position.z]);
    });
    // Welding sparks: a few flickering points where the suits work.
    if (!this.sparkPts) {
      this.sparkPts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(300 * 3), 3)),
        new THREE.PointsMaterial({ color: 0xcfeaff, size: 0.18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.sparkPts.frustumCulled = false; this.scene.add(this.sparkPts);
    }
    const sp = this.sparkPts.geometry.attributes.position; let n = 0;
    for (let i = 0; i < jobs.length && n < 290; i++) {
      const s = this.suitPool[i]; if (!s.visible || Math.sin(now * 23 + i * 7) < 0.2) continue;
      const toward = s.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.3 * sc);
      for (let k = 0; k < 3; k++) sp.setXYZ(n++, s.position.x + toward.x + Math.sin(now * 40 + k) * 0.06, s.position.y + toward.y + Math.cos(now * 37 + k * 2) * 0.06, s.position.z + toward.z);
    }
    this.sparkPts.geometry.setDrawRange(0, n); sp.needsUpdate = true;
    this.sparkPts.visible = this.mode !== 'life';
  }

  // A spot on a part's outer skin for someone on EVA, drifting slowly, and the point on the hull they face.
  _surface(p, k, now) {
    const d = C.parts[p.type], ring = { ring: [7, 1.05], bigring: [12.5, 0.75] }[p.type];
    let l, n;
    if (ring) {
      const a = k * 6.283 + Math.sin(now * 0.05 + k * 9) * 0.15, up = k * 7 % 1 < 0.5 ? 1 : -1;
      l = [Math.cos(a) * ring[0], up * (ring[1] + 0.3), Math.sin(a) * ring[0]]; n = [0, up, 0];
    } else {
      let b = this.boxes.get(p.type);
      if (!b) { b = new THREE.Box3().setFromObject(buildPart(p.type)); this.boxes.set(p.type, b); }
      const arm = d.ports[0][6] === 'L', f = Math.floor(k * 4000) % 4, sgn = f % 2 ? 1 : -1;
      const ax = arm ? 0 : 1, faceAx = arm ? (f < 2 ? 1 : 2) : (f < 2 ? 0 : 2), other = 3 - ax - faceAx;
      const mid = (i) => (b.min.getComponent(i) + b.max.getComponent(i)) / 2, half = (i) => (b.max.getComponent(i) - b.min.getComponent(i)) / 2;
      l = [0, 0, 0]; n = [0, 0, 0];
      l[ax] = mid(ax) + half(ax) * 0.7 * Math.sin(k * 31 + now * 0.06);
      l[other] = mid(other) + half(other) * 0.4 * Math.sin(k * 17);
      l[faceAx] = mid(faceAx) + sgn * (half(faceAx) + 0.25); n[faceAx] = sgn;
    }
    const pos = addRot(p.pos, p.quat, l), look = addRot(p.pos, p.quat, [l[0] - n[0], l[1] - n[1], l[2] - n[2]]);
    return [pos, look];
  }

  // ---------------------------------------------------------------- building aids: small, see-through blue dots for free ports
  // near: only ports close to the pointer (all of them, faint, on a touch screen). off: none drawn, but snapping still works.
  showPorts(type, rot, hot, px, py) {
    this.markers.clear();
    this.portList = type ? this.st.freePorts() : [];
    if (!type || this.portMode === 'off' || !this.overlay) return;
    const r = this.canvas.getBoundingClientRect(), camD = this.camera.position.distanceTo(this.controls.target), base = Math.max(0.1, camD * 0.0045);
    for (const fp of this.portList) {
      const isHot = hot && hot.part === fp.part && hot.i === fp.i;
      if (!this.touch && !isHot) {
        if (px == null) continue;
        const v = new THREE.Vector3(...fp.pos).project(this.camera);
        if (v.z > 1) continue;
        const sx = (v.x + 1) / 2 * r.width + r.left, sy = (1 - v.y) / 2 * r.height + r.top;
        if ((sx - px) ** 2 + (sy - py) ** 2 > 150 * 150) continue;
      }
      const ok = this.st.canBuild(type, fp.part, fp.i, rot).ok;
      const m = new THREE.Mesh(this.dot, isHot ? this.M.portHot : ok ? this.M.port : this.M.portBad);
      m.position.set(...fp.pos); m.scale.setScalar(base * (isHot ? 1.8 : this.touch ? 1.3 : 1));
      m.userData.port = fp; m.renderOrder = 10;
      this.markers.add(m);
    }
  }
  setGhost(type, port, rot) {
    const key = port ? `${type}:${port.part}:${port.i}:${rot}` : '';
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; }
    if (!port) return;
    const host = this.st.parts.get(port.part); if (!host) return;
    const pl = this.st.placement(type, host, port.i, rot), ok = this.st.canBuild(type, port.part, port.i, rot).ok;
    const g = buildPart(type);
    g.traverse((o) => { const r = o.userData.role; if (r) o.material = r === 'line' || r === 'wire' || r === 'innerLine' ? (ok ? this.M.ghostOkLine : this.M.ghostBadLine) : r === 'inner' || r === 'glow' ? this.M.hidden : (ok ? this.M.ghostOk : this.M.ghostBad); });
    g.position.set(...pl.pos); g.quaternion.set(...pl.quat);
    this.ghost = g; this.scene.add(g);
  }
  select(id) {
    if (this.selLines) { this.scene.remove(this.selLines); this.selLines = null; }
    this.sel = id;
    const o = id && this.partObjs.get(id);
    if (!o) return;
    const lines = new THREE.Group();
    o.traverse((x) => { if (x.userData.role === 'line' || x.userData.role === 'wire') { const l = new THREE.LineSegments(x.geometry, this.M.sel); l.renderOrder = 9; lines.add(l); } });
    lines.position.copy(o.position); lines.quaternion.copy(o.quaternion); lines.visible = this.overlay && !this.edit;
    this.selLines = lines; this.scene.add(lines);
  }
  focus(id, close = false) {
    const p = this.st.parts.get(id); if (!p) return;
    const c = this.st.center(p), d = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.set(...c);
    if (close) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(...p.quat));
      d.normalize(); if (d.dot(up) < 0.55) d.add(up.multiplyScalar(1.3)).normalize();
      d.setLength(Math.max(8, C.parts[p.type].r * 3.3 + 4));
    }
    this.camera.position.copy(this.controls.target).add(d);
  }
  // Interior editing: the part is cut open facing you and everything else fades to a ghost.
  editPart(id) {
    this.edit = id || null; this.slotHot = null; this._slotOutline(null);
    if (id) { this.focus(id, true); if (this.selLines) this.selLines.visible = false; }
    else if (this.selLines) this.selLines.visible = this.overlay;
    this._editLabels();
    this._redress();
  }
  // A name tag over each room of the part being edited.
  _editLabels() {
    if (this.editLbl) { this.editLbl.traverse((o) => { if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } }); this.scene.remove(this.editLbl); this.editLbl = null; }
    const p = this.edit && this.st.parts.get(this.edit), lay = p && SLOTS[p.type];
    this.editSig = p ? p.rooms.join(',') : '';
    if (!lay) return;
    const g = new THREE.Group();
    lay.forEach((s, i) => {
      const r = C.rooms[p.rooms[i] || 'empty'], sp = this._tag(`${i + 1} ${r.short || 'EMPTY'}`, r.col);
      const k = Math.min(0.8, Math.max(0.42, s.w * 0.22));
      sp.scale.set(k, k * 0.32, 1); sp.position.set(s.p[0], s.p[1] + 0.55, s.p[2]);
      g.add(sp);
    });
    g.position.set(...p.pos); g.quaternion.set(...p.quat);
    this.editLbl = g; this.scene.add(g);
  }
  _tag(text, col) {
    const c = document.createElement('canvas'); c.width = 200; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(2,14,7,0.82)'; x.fillRect(2, 6, 196, 52); x.fillStyle = col; x.fillRect(2, 6, 8, 52);
    x.strokeStyle = 'rgba(157,255,184,0.6)'; x.lineWidth = 2; x.strokeRect(2, 6, 196, 52);
    x.font = 'bold 30px ui-monospace, Menlo, Consolas, monospace'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 104, 33);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 12; return sp;
  }
  setSlotHot(hit) {
    const key = hit ? `${hit.part}:${hit.slot}` : '';
    if (key === (this.slotHot ? `${this.slotHot.part}:${this.slotHot.slot}` : '')) return;
    this.slotHot = hit; this._slotOutline(hit);
  }
  _slotOutline(hit) {
    if (this.slotLines) { this.scene.remove(this.slotLines); this.slotLines = null; }
    if (!hit) return;
    const p = this.st.parts.get(hit.part), s = SLOTS[p.type][hit.slot];
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(s.w, 0.5, s.d)); geo.translate(0, 0.25, 0);
    const l = new THREE.LineSegments(geo, this.M.slotHot); l.renderOrder = 11;
    const g = new THREE.Group(); g.add(l); l.position.set(...s.p); l.rotation.y = s.ry;
    g.position.set(...p.pos); g.quaternion.set(...p.quat);
    this.slotLines = g; this.scene.add(g);
  }

  // ---------------------------------------------------------------- picking
  _ndc(x, y) { const r = this.canvas.getBoundingClientRect(); return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); }
  // The nearest free port to the pointer, within 30 px on screen (even when the dots are switched off).
  pickPort(x, y) {
    const r = this.canvas.getBoundingClientRect();
    let best = null, bd = 30 * 30;
    for (const fp of this.portList || []) {
      const v = new THREE.Vector3(...fp.pos).project(this.camera);
      if (v.z > 1) continue;
      const sx = (v.x + 1) / 2 * r.width + r.left, sy = (1 - v.y) / 2 * r.height + r.top, d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bd) { bd = d; best = fp; }
    }
    return best;
  }
  // The person nearest to the pointer, within 14 px, when the dots are showing (Life Signs, Cutaway, or editing a part).
  pickAgent(x, y) {
    if (!this.peopleOn) return 0;
    const r = this.canvas.getBoundingClientRect(), now = performance.now() / 1000, v = new THREE.Vector3();
    let best = 0, bd = 14 * 14;
    for (const a of this.st.agents) {
      if (a.eva) continue;
      const P = this.agentPos(a, now);
      if (!P) continue;
      v.set(P[0], P[1], P[2]).project(this.camera);
      if (v.z > 1) continue;
      const sx = (v.x + 1) / 2 * r.width + r.left, sy = (1 - v.y) / 2 * r.height + r.top, d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bd) { bd = d; best = a.id; }
    }
    return best;
  }
  // Where a person is on the screen, and how far from the camera. Null when they are behind it.
  agentScreen(a, now) {
    const P = this.agentPos(a, now);
    if (!P || a.eva) return null;
    const v = this._v3.set(P[0], P[1] + 0.24 * this.peopleK, P[2]), d = v.distanceTo(this.camera.position);
    v.project(this.camera);
    if (v.z > 1) return null;
    const r = this.canvas.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * r.width + r.left, y: (1 - v.y) / 2 * r.height + r.top, d };
  }
  // Move the camera's target to a person, keeping the same angle and distance.
  lookAtAgent(a) {
    const P = this.agentPos(a, performance.now() / 1000);
    if (!P) return;
    const d = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.set(P[0], P[1], P[2]); this.camera.position.copy(this.controls.target).add(d);
  }
  pickPart(x, y) {
    this.ray.setFromCamera(this._ndc(x, y), this.camera);
    const objs = []; for (const o of this.partObjs.values()) o.traverse((m) => { if (m.isMesh && m.userData.role && m.userData.role !== 'inner' && m.material.visible !== false) objs.push(m); });
    const hit = this.ray.intersectObjects(objs, false).find((h) => !this.cutaway || !!this.edit || this.clip.some((pl) => pl.distanceToPoint(h.point) >= 0));
    return hit ? hit.object.userData.part : null;
  }
  // A room slot under the pointer, in the part being edited.
  pickSlot(x, y) {
    const r = this.edit && this.roomObjs.get(this.edit);
    if (!r) return null;
    this.ray.setFromCamera(this._ndc(x, y), this.camera);
    const tiles = []; r.group.traverse((m) => { if (m.userData.role === 'tile') tiles.push(m); });
    const hit = this.ray.intersectObjects(tiles, false)[0];
    return hit ? { part: hit.object.userData.part, slot: hit.object.userData.slot } : null;
  }

  // ---------------------------------------------------------------- frame
  frame() {
    let r = 4;
    for (const p of this.st.parts.values()) { const c = this.st.center(p); r = Math.max(r, Math.hypot(c[0], c[1], c[2]) + C.parts[p.type].r); }
    const d = Math.max(16, r * 2.3);
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(d * 0.62, d * 0.42, d * 0.66);
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  render() {
    this.controls.update();
    this._lod(); this._sunBox();
    this.sky.position.copy(this.camera.position);
    this.zone.visible = this.overlay && (this.mode === 'blueprint' || this.markers.children.length > 0);
    this.renderer.render(this.scene, this.camera);
  }
}

function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
// Words wrapped to a width, at the largest size that fits in a box: [lines, font size].
function fitText(c, text, w, h, max, min, weight, family) {
  const words = String(text).split(/\s+/).filter(Boolean);
  for (let fs = max; fs >= min; fs -= 2) {
    c.font = `${weight} ${fs}px ${family}`; const lines = []; let cur = '';
    for (const wd of words) { const t = cur ? `${cur} ${wd}` : wd; if (c.measureText(t).width <= w) cur = t; else { if (cur) lines.push(cur); cur = wd; } }
    if (cur) lines.push(cur);
    if (lines.every((l) => c.measureText(l).width <= w) && lines.length * fs * 1.12 <= h) return [lines, fs];
  }
  c.font = `${weight} ${min}px ${family}`; return [[String(text).slice(0, 40)], min];
}
// One programme's picture: a header bar with the channel and the station's name, the message fitted in the middle, a footer.
function drawScreen(cv, prog, msg, st, liv, k, fac) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, Y = '#ffe600', F = 'ui-sans-serif, "Helvetica Neue", Arial, sans-serif';
  const head = { slogans: 'MINISTRY OF TRUTH', news: 'WAR NEWS · LIVE', recruit: 'ENLIST · SEAF', station: 'STATION BULLETIN', own: 'COMMANDER’S NOTICE' }[prog];
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, prog === 'recruit' ? '#2a0606' : '#06090c'); bg.addColorStop(1, prog === 'recruit' ? '#0d0202' : '#020305');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.fillStyle = Y; c.fillRect(0, 0, W, 54); c.fillStyle = '#111'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = `700 26px ${F}`; c.fillText(head, fac ? 70 : 28, 28);
  if (fac) { c.save(); drawLogo(c, fac.logo, 20, 4, 46); c.restore(); }
  c.textAlign = 'right'; c.font = `600 22px ${F}`; c.fillText(String((liv && liv.name) || 'SUPER EARTH').toUpperCase().slice(0, 26), W - 28, 28);
  c.textAlign = 'center';
  if (prog === 'station') {
    const nm = String((liv && liv.name) || 'Orbital Station').toUpperCase(), [l1, f1] = fitText(c, nm, W - (fac ? 300 : 120), 150, 76, 30, 800, F), tx = fac ? W / 2 + 80 : W / 2;
    if (fac) { c.save(); drawLogo(c, fac.logo, 60, 72, 170); c.restore(); c.textAlign = 'center'; }
    c.fillStyle = Y; c.font = `800 ${f1}px ${F}`; l1.forEach((l, i) => c.fillText(l, tx, 150 + (i - (l1.length - 1) / 2) * f1 * 1.1));
    const rows = [['RESIDENTS', st.residents()], ['MORALE', Math.round(st.morale)], ['CRATES', st.stats.crates], ['SHIPS SERVED', st.stats.ships]];
    rows.forEach(([a, b], i) => { const x = W / 2 + (i - 1.5) * 175; c.fillStyle = '#9fb0a8'; c.font = `600 18px ${F}`; c.fillText(a, x, 300); c.fillStyle = '#fff'; c.font = `700 46px ${F}`; c.fillText(String(b), x, 346); });
  } else {
    const [lines, fs] = fitText(c, msg || '', W - 110, H - 54 - 90, 92, 20, 800, F);
    c.fillStyle = prog === 'news' ? '#ffffff' : Y; c.font = `800 ${fs}px ${F}`;
    const mid = 54 + (H - 54 - 40) / 2; lines.forEach((l, i) => c.fillText(l, W / 2, mid + (i - (lines.length - 1) / 2) * fs * 1.12));
  }
  c.fillStyle = 'rgba(255,230,0,0.85)'; c.fillRect(28, H - 34, W - 56, 3);
  c.fillStyle = '#9fb0a8'; c.font = `600 17px ${F}`; c.textAlign = 'left'; c.fillText(prog === 'news' ? 'REPORTED BY THE MINISTRY OF TRUTH' : prog === 'recruit' ? 'SEE A DEMOCRACY OFFICER' : fac ? String(fac.motto || 'For Super Earth.').toUpperCase().slice(0, 48) : 'FOR SUPER EARTH', 28, H - 15);
  c.textAlign = 'right'; c.fillText(`WEEK ${st.week()} · DAY ${st.dow()}`, W - 28, H - 15);
  c.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
  void k;
}
function addRot(pos, quat, l) {
  const [x, y, z, w] = quat, [px, py, pz] = l;
  const ix = w * px + y * pz - z * py, iy = w * py + z * px - x * pz, iz = w * pz + x * py - y * px, iw = -x * px - y * py - z * pz;
  return [pos[0] + ix * w + iw * -x + iy * -z - iz * -y, pos[1] + iy * w + iw * -y + iz * -x - ix * -z, pos[2] + iz * w + iw * -z + ix * -y - iy * -x];
}
