// The 3D view: the blueprint space, the station, its rooms, ships, people, and the ways of looking at them.
//   BLUEPRINT  green lines on black in a 3D drawing space (three planes through the origin), for building
//   HULL       the station as it would look, under its sun, over a planet, with moons
//   LIFE SIGNS an x-ray: the hull fades to a ghost and every person aboard glows through the walls (people on EVA too)
//   CUTAWAY    the quarter facing the camera sliced away to show the decks and rooms inside (works with any view)
// The sky is a skybox: it moves with the camera, so stars, sun and moons never slide about when you pan or zoom.
import * as THREE from './vendor/three.js';
import { C } from './config.js';
import { buildPart, buildShip, buildRoom, buildSuit, SLOTS } from './parts.js';
import { paintWorld, WORLDS, WORLD_TYPES } from './planets.js';
import { RNG } from './rng.js';

const GREEN = 0x9dffb8, YELLOW = 0xffe600, BLUE = 0x4db8ff;
const ROLE_COL = { resident: [0.85, 1, 0.9], hauler: [0.3, 0.72, 1], engineer: [1, 0.76, 0.25], officer: [1, 0.35, 0.29], medic: [0.6, 1, 0.75], carry: [1, 0.69, 0.13], eva: [1, 1, 1] };
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
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 6000);
    this.camera.position.set(26, 17, 30);
    this.controls = new THREE.OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 3, maxDistance: 260, screenSpacePanning: true });
    this.mode = 'blueprint'; this.cutaway = false; this.overlay = true; this.portMode = 'near'; this.touch = false;
    this.clip = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    this._materials();
    this._world();
    this.partObjs = new Map(); this.roomObjs = new Map(); this.shipObjs = new Map();
    this.markers = new THREE.Group(); this.scene.add(this.markers); this.dot = new THREE.SphereGeometry(1, 10, 8);
    this.ghost = null; this.ghostKey = '';
    this.sel = null; this.selLines = null; this.edit = null; this.slotHot = null; this.slotLines = null;
    this.suits = new THREE.Group(); this.scene.add(this.suits); this.suitPool = []; this.evaPos = []; this.boxes = new Map();
    this.sparks = new THREE.Group(); this.scene.add(this.sparks);
    this._agentsInit();
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
      bpHull: B({ color: 0x0b2a16, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
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
      glass: S({ color: 0x8fe0c8, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
      panel: S({ color: 0x1c2f5a, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }),
      wire: L({ color: 0xaab6b0 }),
      pod: S({ color: 0xb08a3a, metalness: 0.3, roughness: 0.7, flatShading: true }),
      crate: S({ color: 0xc08a3a, roughness: 0.8, flatShading: true }),
      plant: B({ color: 0x4fcf5a }), awning: B({ color: 0xd06a8a }), cross: B({ color: 0xff4a4a }), alarm: B({ color: 0xff3a2a }), spark: B({ color: 0xbfe8ff }),
      suit: S({ color: 0xeeeeea, roughness: 0.6 }), visor: B({ color: 0xffb020 }),
      xHull: B({ color: 0x0c2a1a, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }),
      xLine: L({ color: 0x3f8f68, transparent: true, opacity: 0.28 }),
      xInnerLine: L({ color: 0x3f8f68, transparent: true, opacity: 0.12 }),
      xGlow: B({ color: 0x3f8f68, transparent: true, opacity: 0.2 }),
      eHull: B({ color: 0x9dffb8, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }),
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
    M.screen = B({ map: this.screenTex, side: THREE.DoubleSide }); M.bpScreen = B({ map: this.screenTex, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    this.slogan = -1; this._drawSlogan(0);
    this.clipped = ['bpHull', 'bpLine', 'bpGlow', 'bpPanel', 'hull', 'hullLine', 'glow', 'glass', 'panel', 'wire', 'pod', 'xHull', 'xLine', 'xGlow', 'build', 'gone', 'screen', 'bpScreen', 'dimHull', 'dimLine'];
    for (const k of this.clipped) M[k].clipIntersection = true;
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
  mat(role, state, dim, edit) {
    const M = this.M, m = this.mode;
    if (state === 'building') return role === 'line' || role === 'wire' ? M.build : M.hidden;
    if (state === 'demolish' && (role === 'line' || role === 'wire')) return M.gone;
    if (edit) return { line: M.eLine, wire: M.eLine, innerLine: M.eInnerLine, glow: M.glow, screen: M.screen, panel: M.panel }[role] || M.eHull;
    if (dim) return { line: M.dimLine, wire: M.dimLine, innerLine: M.hidden, inner: M.hidden }[role] || (role === 'glow' ? M.hidden : M.dimHull);
    if (m === 'blueprint') return { hull: M.bpHull, line: M.bpLine, inner: M.bpInner, innerLine: M.bpInnerLine, glow: M.bpGlow, glass: M.bpHull, panel: M.bpPanel, wire: M.bpLine, pod: M.bpHull, screen: M.bpScreen }[role] || M.bpInner;
    if (m === 'life') return { hull: M.xHull, line: M.xLine, inner: M.hidden, innerLine: M.xInnerLine, glow: M.xGlow, glass: M.xHull, panel: M.xHull, wire: M.xLine, pod: M.xHull, screen: M.xHull }[role] || M.hidden;
    const inside = this.cutaway || !!this.edit;
    return { hull: M.hull, line: M.hullLine, inner: inside ? M.inner : M.hidden, innerLine: inside ? M.innerLine : M.hidden, glow: M.glow, glass: M.glass, panel: M.panel, wire: M.wire, pod: M.pod, screen: M.screen }[role] || M[role] || M.inner;
  }
  _dress(obj, state, dim = false, edit = false) { obj.traverse((o) => { if (o.userData.role) o.material = this.mat(o.userData.role, state, dim, edit); }); }
  _dressRoom(g, dim, edit = false) {
    const m = edit ? 'hull' : this.mode;
    g.traverse((o) => {
      const r = o.userData.role; if (!r) return;
      if (dim) { o.material = this.M.hidden; return; }
      if (r === 'tile') o.material = m === 'blueprint' ? this.tileBp : m === 'life' ? this.M.hidden : this.tileMats[o.userData.room];
      else if (r === 'tileLine') o.material = m === 'blueprint' ? this.M.bpTileLine : m === 'life' ? this.M.xInnerLine : this.M.tileLine;
      else if (m === 'blueprint') o.material = r === 'glow' || r === 'spark' ? this.M.bpGlow : this.M.bpInner;
      else if (m === 'life') o.material = this.M.hidden;
      else o.material = this.M[r] || this.M.inner;
    });
  }
  _dim(id) { return !!this.edit && this.edit !== id; }

  // ---------------------------------------------------------------- the space around the station
  _world() {
    const s = this.scene;
    s.add(new THREE.AmbientLight(0x9fb3a8, 0.5));
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.4); s.add(this.sun); s.add(this.sun.target);
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
    const pa = Math.atan2(-0.66, -0.62) + r.range(-0.8, 0.8), pe = -r.range(0.38, 0.6);
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
  setCutaway(on) { this.cutaway = on; this._redress(); }
  setOverlay(on) { this.overlay = on; this.grids.visible = on && this.mode === 'blueprint'; this.markers.visible = on; if (this.selLines) this.selLines.visible = on && !this.edit; if (this.editLbl) this.editLbl.visible = on; }
  _redress() {
    if (!this.partObjs) return;
    for (const [id, o] of this.partObjs) { const p = this.st.parts.get(id); this._dress(o, p ? p.state : 'active', this._dim(id), this.edit === id); }
    for (const [id, r] of this.roomObjs) this._dressRoom(r.group, this._dim(id), this.edit === id);
    for (const o of this.shipObjs.values()) this._dress(o, 'active', !!this.edit);
    const planes = this.cutaway && !this.edit ? this.clip : null;
    for (const k of this.clipped) { this.M[k].clippingPlanes = planes; this.M[k].needsUpdate = true; }
    const life = this.mode === 'life';
    this.agentMat.size = life ? 0.9 : 0.55;
    this.agentMat.depthTest = !life && !this.cutaway && !this.edit;
    this.agentPts.visible = this.mode !== 'hull' || this.cutaway || !!this.edit;
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
        this.scene.add(o); this.partObjs.set(p.id, o); o.userData.state = '';
      }
      if (o.userData.state !== p.state) { o.userData.state = p.state; this._dress(o, p.state, this._dim(p.id), this.edit === p.id); }
      this._rooms(p);
    }
    this.zone.scale.setScalar(st.radius);
    for (const [id, o] of this.shipObjs) if (!st.ships.some((s) => s.id === id)) { this.scene.remove(o); this.shipObjs.delete(id); }
    for (const s of st.ships) {
      let o = this.shipObjs.get(s.id);
      if (!o) { o = buildShip(s.kind); this._dress(o, 'active', !!this.edit); this.scene.add(o); this.shipObjs.set(s.id, o); }
      this._placeShip(s, o, now);
    }
    this._eva(now);
    this._agents(now);
    if (this.edit) { const p = st.parts.get(this.edit); if (p && p.rooms.join(',') !== this.editSig) this._editLabels(); }
    // The cut faces the camera, through what you are looking at.
    if (this.cutaway && !this.edit) {
      const tg = this.controls.target, t = Math.atan2(this.camera.position.z - tg.z, this.camera.position.x - tg.x);
      this.clip[0].normal.set(-Math.cos(t - Math.PI / 4), 0, -Math.sin(t - Math.PI / 4)); this.clip[0].constant = -this.clip[0].normal.dot(tg);
      this.clip[1].normal.set(-Math.cos(t + Math.PI / 4), 0, -Math.sin(t + Math.PI / 4)); this.clip[1].constant = -this.clip[1].normal.dot(tg);
    }
    if (this.selLines) { const o = this.partObjs.get(this.sel); if (o) { this.selLines.position.copy(o.position); this.selLines.quaternion.copy(o.quaternion); } }
    const k = Math.floor(now / 5); if (k !== this.slogan) { this.slogan = k; this._drawSlogan(k); }
    if (this.clouds) this.clouds.rotation.y += dt * 0.004;
  }
  // Each part's rooms: rebuilt only when they change.
  _rooms(p) {
    const lay = SLOTS[p.type];
    if (!lay || p.state === 'building') return;
    const sig = p.rooms.join(',');
    let r = this.roomObjs.get(p.id);
    if (r && r.sig === sig) return;
    if (r) this.scene.remove(r.group);
    const g = new THREE.Group();
    lay.forEach((s, i) => {
      const room = p.rooms[i] || 'empty', rg = buildRoom(room, s.w, s.d);
      rg.position.set(...s.p); rg.rotation.y = s.ry;
      rg.traverse((x) => { x.userData.part = p.id; x.userData.slot = i; });
      g.add(rg);
    });
    g.position.set(...p.pos); g.quaternion.set(...p.quat);
    this.scene.add(g);
    this.roomObjs.set(p.id, { group: g, sig });
    this._dressRoom(g, this._dim(p.id), this.edit === p.id);
  }

  _placeShip(s, o, now) {
    const st = this.st, S = C.ships, a = s.seed * Math.PI * 2;
    const hold = new THREE.Vector3(Math.cos(a) * 44, Math.sin(s.seed * 17) * 10, Math.sin(a) * 44);
    const far = hold.clone().multiplyScalar(5);
    const dp = st.parts.get(s.dock || s.lastDock), b = dp ? st.berth(dp) : null;
    const inside = dp && (dp.type === 'hangar' || dp.type === 'drydock');
    const off = s.kind === 'shuttle' ? 1.2 : s.kind === 'warship' ? 3 : 2.6;
    const out = b ? new THREE.Vector3(...b.dir) : new THREE.Vector3(0, 1, 0);
    const berth = b ? new THREE.Vector3(...b.pos).add(out.clone().multiplyScalar(dp.type === 'hangar' ? -2.2 : off)) : hold;
    const nose = inside ? out.clone() : out.clone().negate();      // into a hangar or drydock they back in, nose out
    let pos, look;
    const ease = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
    if (s.state === 'hold') {
      const k = ease(s.t / 5); pos = far.clone().lerp(hold, k); pos.y += Math.sin(now * 0.4 + s.seed * 9) * 0.3;
      look = k >= 1 ? new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)) : hold.clone().sub(far);
    } else if (s.state === 'approach') {
      const k = ease(s.t / S.approachSec), mid = berth.clone().add(out.clone().multiplyScalar(inside ? 14 : 12));
      pos = k < 0.65 ? hold.clone().lerp(mid, k / 0.65) : mid.clone().lerp(berth, (k - 0.65) / 0.35);
      look = k < 0.65 ? mid.clone().sub(hold) : nose.clone();
    } else if (s.state === 'docked') { pos = berth.clone(); look = nose.clone(); }
    else {
      const k = ease(s.t / S.departSec), exit = berth.clone().add(out.clone().multiplyScalar(16));
      pos = k < 0.4 ? berth.clone().lerp(exit, k / 0.4) : exit.clone().lerp(exit.clone().add(out.clone().multiplyScalar(160)), (k - 0.4) / 0.6);
      look = out.clone();
    }
    o.position.copy(pos);
    if (look.lengthSq() > 1e-6) { const want = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), look.normalize()); o.quaternion.slerp(want, s.state === 'docked' ? 1 : 0.06); }
    o.visible = !(s.state === 'depart' && s.t > S.departSec * 0.96);
    if (s.kind === 'freighter') { let i = 0; const n = s.state === 'docked' ? s.crates : s.state === 'depart' ? 0 : 8; o.traverse((x) => { if (x.userData.role === 'pod') x.visible = i++ < n; }); }
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
  // Where a person is: walking through a join, or somewhere inside the part they are in (a room's floor when it has rooms).
  agentPos(a, now) {
    const st = this.st, p = st.parts.get(a.at);
    if (!p) return null;
    if (a.path.length) {
      const to = st.parts.get(a.path[0]);
      if (to) { const e = st.edge(p, to), s = a.s; return s < e.da ? lerp(e.ca, e.conn, s / Math.max(0.01, e.da)) : lerp(e.conn, e.cb, (s - e.da) / Math.max(0.01, e.db)); }
    }
    const k = a.seed, lay = SLOTS[p.type], d = C.parts[p.type];
    let l;
    if (lay && lay.length) {
      const s = lay[Math.floor(k * 997) % lay.length], u = (k * 7.31 % 1 - 0.5) * s.w * 0.7, w = (k * 3.77 % 1 - 0.5) * s.d * 0.6 + Math.sin(now * 0.3 + k * 20) * 0.05;
      const c = Math.cos(s.ry), sn = Math.sin(s.ry);
      l = [s.p[0] + u * c + w * sn, s.p[1] + 0.12, s.p[2] - u * sn + w * c];
    } else l = [d.center[0] + (k - 0.5) * 1.2, d.center[1] - 0.2, (k * 5.1 % 1 - 0.5) * 0.5];
    return addRot(p.pos, p.quat, l);
  }
  _agents(now) {
    const pos = this.agentPts.geometry.attributes.position, col = this.agentPts.geometry.attributes.color;
    let n = 0;
    const put = (P, c) => { if (n >= pos.count) return; pos.setXYZ(n, P[0], P[1] + 0.05, P[2]); col.setXYZ(n, c[0], c[1], c[2]); n++; };
    for (const a of this.st.agents) {
      if (a.eva) continue;
      const P = this.agentPos(a, now);
      if (P) put(P, a.carry ? ROLE_COL.carry : ROLE_COL[a.role] || ROLE_COL.resident);
    }
    for (const P of this.evaPos) put(P, ROLE_COL.eva);
    this.agentPts.geometry.setDrawRange(0, n);
    pos.needsUpdate = true; col.needsUpdate = true;
  }
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
    const sc = this.mode === 'blueprint' ? 2 : 1.5;
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
      const k = Math.min(1.7, Math.max(0.8, s.w * 0.42));
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
    this.sky.position.copy(this.camera.position);
    this.zone.visible = this.overlay && (this.mode === 'blueprint' || this.markers.children.length > 0);
    this.renderer.render(this.scene, this.camera);
  }
}

function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function addRot(pos, quat, l) {
  const [x, y, z, w] = quat, [px, py, pz] = l;
  const ix = w * px + y * pz - z * py, iy = w * py + z * px - x * pz, iz = w * pz + x * py - y * px, iw = -x * px - y * py - z * pz;
  return [pos[0] + ix * w + iw * -x + iy * -z - iz * -y, pos[1] + iy * w + iw * -y + iz * -x - ix * -z, pos[2] + iz * w + iw * -z + ix * -y - iy * -x];
}
