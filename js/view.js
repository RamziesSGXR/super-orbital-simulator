// The 3D view: the blueprint space, the station, ships, people, and the four ways of looking at them.
//   BLUEPRINT  green lines on black in a 3D drawing space (three planes through the origin), for building
//   HULL       the station as it would look, with the planet below
//   LIFE SIGNS an x-ray: the hull fades to a ghost and every person aboard shows as a dot, through the walls
//   CUTAWAY    a quarter of the station sliced away, facing the camera, showing the decks inside (works with any view)
import * as THREE from './vendor/three.js';
import { C } from './config.js';
import { buildPart, buildShip } from './parts.js';

const GREEN = 0x9dffb8, YELLOW = 0xffe600;
const ROLE_COL = { resident: [0.85, 1, 0.9], hauler: [0.3, 0.72, 1], carry: [1, 0.69, 0.13] };

export class View {
  constructor(canvas, st) {
    this.st = st;
    this.canvas = canvas;
    const R = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    R.localClippingEnabled = true;
    R.setClearColor(0x000000);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
    this.camera.position.set(26, 17, 30);
    const OC = THREE.OrbitControls;
    this.controls = new OC(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 5, maxDistance: 160, screenSpacePanning: true });
    this.controls.target.set(0, 0, 0);
    this.mode = 'blueprint'; this.cutaway = false;
    this.clip = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    this._materials();
    this._world();
    this.partObjs = new Map(); this.shipObjs = new Map();
    this.markers = new THREE.Group(); this.scene.add(this.markers); this.octa = new THREE.OctahedronGeometry(1, 0);
    this.ghost = null; this.ghostKey = '';
    this.sel = null; this.selLines = null;
    this._agentsInit();
    this.ray = new THREE.Raycaster(); this.ray.params.Line.threshold = 0.2;
    this.setMode('blueprint');
    this.resize();
  }

  setStation(st) {
    for (const o of this.partObjs.values()) this.scene.remove(o);
    for (const o of this.shipObjs.values()) this.scene.remove(o);
    this.partObjs.clear(); this.shipObjs.clear(); this.select(null); this.markers.clear(); this.setGhost(null, null, 0);
    this.st = st;
  }

  // ---------------------------------------------------------------- materials
  _materials() {
    const M = this.M = {
      bpHull: new THREE.MeshBasicMaterial({ color: 0x0b2a16, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
      bpLine: new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.85 }),
      bpInner: new THREE.MeshBasicMaterial({ color: 0x0a2414, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
      bpInnerLine: new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.22 }),
      bpGlow: new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.55 }),
      bpPanel: new THREE.MeshBasicMaterial({ color: 0x0b2a16, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
      hull: new THREE.MeshStandardMaterial({ color: 0x8c9690, metalness: 0.55, roughness: 0.5, flatShading: true, side: THREE.DoubleSide }),
      hullLine: new THREE.LineBasicMaterial({ color: 0x1c2620, transparent: true, opacity: 0.55 }),
      inner: new THREE.MeshStandardMaterial({ color: 0x6f5a3a, metalness: 0.1, roughness: 0.9, side: THREE.DoubleSide }),
      innerLine: new THREE.LineBasicMaterial({ color: 0x2a2014, transparent: true, opacity: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xfff1b0 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x8fe0c8, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
      panel: new THREE.MeshStandardMaterial({ color: 0x1c2f5a, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }),
      wire: new THREE.LineBasicMaterial({ color: 0xaab6b0 }),
      pod: new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.3, roughness: 0.7, flatShading: true }),
      xHull: new THREE.MeshBasicMaterial({ color: 0x0c2a1a, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }),
      xLine: new THREE.LineBasicMaterial({ color: 0x3f8f68, transparent: true, opacity: 0.28 }),
      xInnerLine: new THREE.LineBasicMaterial({ color: 0x3f8f68, transparent: true, opacity: 0.12 }),
      xGlow: new THREE.MeshBasicMaterial({ color: 0x3f8f68, transparent: true, opacity: 0.2 }),
      build: new THREE.LineBasicMaterial({ color: YELLOW, transparent: true, opacity: 0.8 }),
      gone: new THREE.LineBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.8 }),
      hidden: new THREE.MeshBasicMaterial({ visible: false }),
      ghostOk: new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.22, depthWrite: false }),
      ghostOkLine: new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.9 }),
      ghostBad: new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.22, depthWrite: false }),
      ghostBadLine: new THREE.LineBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.9 }),
      sel: new THREE.LineBasicMaterial({ color: YELLOW, depthTest: false, transparent: true, opacity: 0.95 }),
      port: new THREE.MeshBasicMaterial({ color: YELLOW, depthTest: false, transparent: true, opacity: 0.9 }),
      portBad: new THREE.MeshBasicMaterial({ color: 0xff6a5a, depthTest: false, transparent: true, opacity: 0.55 }),
      portHot: new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
    };
    for (const k of ['bpHull', 'bpLine', 'bpGlow', 'bpPanel', 'hull', 'hullLine', 'glow', 'glass', 'panel', 'wire', 'pod', 'xHull', 'xLine', 'xGlow', 'build', 'gone']) {
      M[k].clipIntersection = true;
    }
  }
  // The material each role wears in the current mode.
  mat(role, state) {
    const M = this.M, m = this.mode;
    if (state === 'building') return role === 'line' || role === 'wire' ? M.build : M.hidden;
    if (state === 'demolish' && (role === 'line' || role === 'wire')) return M.gone;
    if (m === 'blueprint') return { hull: M.bpHull, line: M.bpLine, inner: M.bpInner, innerLine: M.bpInnerLine, glow: M.bpGlow, glass: M.bpHull, panel: M.bpPanel, wire: M.bpLine, pod: M.bpHull }[role];
    if (m === 'life') return { hull: M.xHull, line: M.xLine, inner: M.hidden, innerLine: M.xInnerLine, glow: M.xGlow, glass: M.xHull, panel: M.xHull, wire: M.xLine, pod: M.xHull }[role];
    const inside = this.cutaway;
    return { hull: M.hull, line: M.hullLine, inner: inside ? M.inner : M.hidden, innerLine: inside ? M.innerLine : M.hidden, glow: M.glow, glass: M.glass, panel: M.panel, wire: M.wire, pod: M.pod }[role];
  }
  _dress(obj, state) { obj.traverse((o) => { if (o.userData.role) o.material = this.mat(o.userData.role, state); }); }

  // ---------------------------------------------------------------- the space around the station
  _world() {
    const s = this.scene;
    s.add(new THREE.AmbientLight(0x9fb3a8, 0.55));
    const key = new THREE.DirectionalLight(0xfff4e0, 2.2); key.position.set(40, 60, 30); s.add(key);
    const rim = new THREE.DirectionalLight(0x6fd0ff, 0.9); rim.position.set(-50, -20, -40); s.add(rim);
    this.hullLights = [key, rim];

    // Three drawing planes through the origin, like a technical drawing in 3D space, with X, Y and Z marked.
    const g = this.grids = new THREE.Group();
    const plane = (rot, op) => {
      const gh = new THREE.GridHelper(96, 48, GREEN, GREEN);
      gh.material.transparent = true; gh.material.opacity = op; gh.material.depthWrite = false;
      rot(gh); g.add(gh); return gh;
    };
    plane(() => {}, 0.12);
    plane((o) => o.rotateX(Math.PI / 2), 0.045);
    plane((o) => o.rotateZ(Math.PI / 2), 0.045);
    const axis = (to, col) => {
      const geo = new THREE.BufferGeometry().setFromPoints([to.clone().multiplyScalar(-48), to.clone().multiplyScalar(48)]);
      g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55 })));
    };
    axis(new THREE.Vector3(1, 0, 0), 0xff6a5a); axis(new THREE.Vector3(0, 1, 0), GREEN); axis(new THREE.Vector3(0, 0, 1), 0x4db8ff);
    for (const [t, p, c] of [['X', [50, 0, 0], '#ff6a5a'], ['-X', [-50, 0, 0], '#ff6a5a'], ['Y', [0, 50, 0], '#9dffb8'], ['-Y', [0, -50, 0], '#9dffb8'], ['Z', [0, 0, 50], '#4db8ff'], ['-Z', [0, 0, -50], '#4db8ff']]) {
      const sp = this._label(t, c); sp.position.set(...p); g.add(sp);
    }
    s.add(g);

    // The permitted build zone: three dashed circles of the sphere it may not leave.
    this.zone = new THREE.Group();
    for (const rot of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]]) {
      const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: YELLOW, dashSize: 0.02, gapSize: 0.015, transparent: true, opacity: 0.5 }));
      l.computeLineDistances(); l.rotation.set(...rot); this.zone.add(l);
    }
    s.add(this.zone);

    // Stars, and the planet below for the hull view.
    const sp = []; let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 1800; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 900; sp.push(Math.sqrt(1 - u * u) * Math.cos(a) * r, u * r, Math.sqrt(1 - u * u) * Math.sin(a) * r); }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)),
      new THREE.PointsMaterial({ color: 0xcfe8da, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7 }));
    s.add(this.stars);
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(420, 64, 32), new THREE.MeshStandardMaterial({ color: 0x3e5a48, roughness: 1, metalness: 0 }));
    this.planet.position.set(60, -520, -120); s.add(this.planet);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(428, 64, 32), new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.08, side: THREE.BackSide }));
    this.planet.add(atmo);
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
    this.grids.visible = bp;
    this.planet.visible = hull;
    this.stars.material.opacity = hull ? 0.8 : 0.35;
    for (const l of this.hullLights) l.visible = hull;
    this._redress();
  }
  setCutaway(on) { this.cutaway = on; this._redress(); }
  _redress() {
    for (const [id, o] of this.partObjs) { const p = this.st.parts.get(id); this._dress(o, p ? p.state : 'active'); }
    for (const o of this.shipObjs.values()) this._dress(o, 'active');
    const planes = this.cutaway ? this.clip : null;
    for (const k of ['bpHull', 'bpLine', 'bpGlow', 'bpPanel', 'hull', 'hullLine', 'glow', 'glass', 'panel', 'wire', 'xHull', 'xLine', 'xGlow', 'build', 'gone']) {
      this.M[k].clippingPlanes = planes; this.M[k].needsUpdate = true;
    }
    const life = this.mode === 'life';
    this.agentMat.size = life ? 0.9 : 0.6;
    this.agentMat.depthTest = !life && !this.cutaway ? true : false;
    this.agentMat.opacity = life ? 1 : 0.95;
    this.agentPts.visible = this.mode !== 'hull' || this.cutaway;
  }

  // ---------------------------------------------------------------- sync with the simulation
  sync(now) {
    const st = this.st;
    for (const [id, o] of this.partObjs) if (!st.parts.has(id)) { this.scene.remove(o); this.partObjs.delete(id); if (this.sel === id) this.select(null); }
    for (const p of st.parts.values()) {
      let o = this.partObjs.get(p.id);
      if (!o) {
        o = buildPart(p.type); o.position.set(...p.pos); o.quaternion.set(...p.quat);
        o.traverse((x) => { x.userData.part = p.id; });
        this.scene.add(o); this.partObjs.set(p.id, o); o.userData.state = '';
      }
      if (o.userData.state !== p.state) { o.userData.state = p.state; this._dress(o, p.state); }
    }
    this.zone.scale.setScalar(st.radius);
    // Ships
    for (const [id, o] of this.shipObjs) if (!st.ships.some((s) => s.id === id)) { this.scene.remove(o); this.shipObjs.delete(id); }
    for (const s of st.ships) {
      let o = this.shipObjs.get(s.id);
      if (!o) { o = buildShip(s.kind); this._dress(o, 'active'); this.scene.add(o); this.shipObjs.set(s.id, o); }
      this._placeShip(s, o, now);
    }
    this._agents(now);
    if (this.cutaway) {   // the cut faces the camera
      const t = Math.atan2(this.camera.position.z - this.controls.target.z, this.camera.position.x - this.controls.target.x);
      this.clip[0].normal.set(-Math.cos(t - Math.PI / 4), 0, -Math.sin(t - Math.PI / 4)); this.clip[0].constant = this.clip[0].normal.dot(this.controls.target) * -1;
      this.clip[1].normal.set(-Math.cos(t + Math.PI / 4), 0, -Math.sin(t + Math.PI / 4)); this.clip[1].constant = this.clip[1].normal.dot(this.controls.target) * -1;
    }
    if (this.selLines) { const o = this.partObjs.get(this.sel); if (o) { this.selLines.position.copy(o.position); this.selLines.quaternion.copy(o.quaternion); } }
  }

  _placeShip(s, o, now) {
    const st = this.st, S = C.ships, a = s.seed * Math.PI * 2;
    const hold = new THREE.Vector3(Math.cos(a) * 34, Math.sin(s.seed * 17) * 8, Math.sin(a) * 34);
    const far = hold.clone().multiplyScalar(4);
    const dockId = s.dock || s.lastDock, dp = st.parts.get(dockId), b = dp ? st.berth(dp) : null;
    const berth = b ? new THREE.Vector3(...b.pos).add(new THREE.Vector3(...b.dir).multiplyScalar(s.kind === 'shuttle' ? 1.2 : 2.6)) : hold;
    const nose = b ? new THREE.Vector3(...b.dir).negate() : new THREE.Vector3(1, 0, 0);
    let pos, look;
    const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    if (s.state === 'hold') {
      const k = ease(s.t / 3); pos = far.clone().lerp(hold, k);
      pos.y += Math.sin(now * 0.6 + s.seed * 9) * 0.3; look = hold.clone().sub(far);
      if (k >= 1) look = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    } else if (s.state === 'approach') {
      const k = ease(s.t / S.approachSec), mid = berth.clone().add(new THREE.Vector3(...(b ? b.dir : [0, 1, 0])).multiplyScalar(10));
      pos = k < 0.7 ? hold.clone().lerp(mid, k / 0.7) : mid.clone().lerp(berth, (k - 0.7) / 0.3);
      look = k < 0.7 ? mid.clone().sub(hold) : nose.clone();
    } else if (s.state === 'docked') { pos = berth.clone(); look = nose.clone(); }
    else {
      const k = Math.min(1, s.t / S.departSec), out = berth.clone().add(nose.clone().negate().multiplyScalar(14));
      pos = k < 0.4 ? berth.clone().lerp(out, k / 0.4) : out.clone().lerp(out.clone().add(nose.clone().negate().multiplyScalar(120)), (k - 0.4) / 0.6);
      look = nose.clone().negate();
    }
    o.position.copy(pos);
    if (look.lengthSq() > 1e-6) {
      const want = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), look.normalize());
      o.quaternion.slerp(want, s.state === 'docked' ? 1 : 0.15);
    }
    o.visible = !(s.state === 'depart' && s.t > S.departSec * 0.95);
    // Freighter pods empty as the crates come off.
    if (s.kind === 'freighter') { let i = 0; const n = s.state === 'docked' ? s.crates : s.state === 'depart' ? 0 : 8; o.traverse((x) => { if (x.userData.role === 'pod') x.visible = i++ < n; }); }
  }

  // ---------------------------------------------------------------- people
  _agentsInit() {
    const N = 600;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    geo.setDrawRange(0, 0);
    // A soft round dot, drawn once, so people read as glowing life signs and not squares.
    const dc = document.createElement('canvas'); dc.width = dc.height = 64;
    const dx = dc.getContext('2d'), gr = dx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    dx.fillStyle = gr; dx.fillRect(0, 0, 64, 64);
    this.agentMat = new THREE.PointsMaterial({ size: 0.4, map: new THREE.CanvasTexture(dc), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.agentPts = new THREE.Points(geo, this.agentMat);
    this.agentPts.frustumCulled = false; this.agentPts.renderOrder = 5;
    this.scene.add(this.agentPts);
  }
  // Where a person is drawn: walking through a join, or idling somewhere inside the part they are in.
  agentPos(a, now) {
    const st = this.st, p = st.parts.get(a.at);
    if (!p) return null;
    if (a.path.length) {
      const to = st.parts.get(a.path[0]);
      if (to) {
        const e = st.edge(p, to), s = a.s;
        const P = s < e.da ? lerp(e.ca, e.conn, s / Math.max(0.01, e.da)) : lerp(e.conn, e.cb, (s - e.da) / Math.max(0.01, e.db));
        return P;
      }
    }
    const k = a.seed, d = C.parts[p.type], t = now * 0.05 * (k - 0.5);
    let l;
    switch (p.type) {
      case 'ring': { const ang = k * 6.283 + t; l = [Math.cos(ang) * 7, -0.25, Math.sin(ang) * 7]; break; }
      case 'bigring': { const ang = k * 6.283 + t; l = [Math.cos(ang) * 12, -0.1, Math.sin(ang) * 12]; break; }
      case 'disc': { const ang = k * 6.283 + t, r = 2 + (k * 7.3 % 1) * 3; l = [Math.cos(ang) * r, 0.05, Math.sin(ang) * r]; break; }
      case 'drum': { const ang = k * 6.283 + t; l = [Math.cos(ang) * 3.8, k > 0.5 ? 0.6 : -0.3, Math.sin(ang) * 3.8]; break; }
      case 'dome': { const ang = k * 6.283; l = [Math.cos(ang) * 1.4, 0.4, Math.sin(ang) * 1.4]; break; }
      case 'command': case 'core': case 'reactor': { const ang = k * 6.283; l = [Math.cos(ang) * 0.7, (k * 3.7 % 1) * 2 - 1, Math.sin(ang) * 0.7]; break; }
      default: l = [d.center[0] + (k - 0.5) * 2.4, -0.3, (k * 5.1 % 1 - 0.5) * 0.8];
    }
    return addRot(p.pos, p.quat, l);
  }
  _agents(now) {
    const pos = this.agentPts.geometry.attributes.position, col = this.agentPts.geometry.attributes.color;
    let n = 0;
    for (const a of this.st.agents) {
      if (n >= pos.count) break;
      const P = this.agentPos(a, now);
      if (!P) continue;
      pos.setXYZ(n, P[0], P[1] + 0.05, P[2]);
      const c = a.carry ? ROLE_COL.carry : ROLE_COL[a.role];
      col.setXYZ(n, c[0], c[1], c[2]);
      n++;
    }
    this.agentPts.geometry.setDrawRange(0, n);
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  // ---------------------------------------------------------------- building aids
  showPorts(type, rot, hot) {
    this.markers.clear();
    if (!type) return;
    const camD = this.camera.position.distanceTo(this.controls.target);
    for (const fp of this.st.freePorts()) {
      const ok = this.st.canBuild(type, fp.part, fp.i, rot).ok;
      const m = new THREE.Mesh(this.octa, hot && hot.part === fp.part && hot.i === fp.i ? this.M.portHot : ok ? this.M.port : this.M.portBad);
      m.position.set(...fp.pos); m.scale.setScalar(Math.max(0.28, camD * 0.011) * (ok ? 1 : 0.7));
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
    const host = this.st.parts.get(port.part), pl = this.st.placement(type, host, port.i, rot), ok = this.st.canBuild(type, port.part, port.i, rot).ok;
    const g = buildPart(type);
    g.traverse((o) => { const r = o.userData.role; if (r) o.material = r === 'line' || r === 'wire' || r === 'innerLine' ? (ok ? this.M.ghostOkLine : this.M.ghostBadLine) : r === 'inner' ? this.M.hidden : (ok ? this.M.ghostOk : this.M.ghostBad); });
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
    lines.position.copy(o.position); lines.quaternion.copy(o.quaternion);
    this.selLines = lines; this.scene.add(lines);
  }
  // Point the camera at the whole station, from a three-quarter view, at a distance that fits it.
  frame() {
    let r = 4;
    for (const p of this.st.parts.values()) { const c = this.st.center(p); r = Math.max(r, Math.hypot(c[0], c[1], c[2]) + C.parts[p.type].r); }
    const d = Math.max(16, r * 2.3);
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(d * 0.62, d * 0.42, d * 0.66);
  }
  focus(id) { const p = this.st.parts.get(id); if (p) this.controls.target.set(...this.st.center(p)); }

  // ---------------------------------------------------------------- picking
  _ndc(x, y) { const r = this.canvas.getBoundingClientRect(); return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); }
  pickPort(x, y) {
    this.ray.setFromCamera(this._ndc(x, y), this.camera);
    const hit = this.ray.intersectObjects(this.markers.children, false)[0];
    if (hit) return hit.object.userData.port;
    // Generous for fingers and small markers: the nearest marker within 26 px of the pointer.
    let best = null, bd = 26 * 26;
    const r = this.canvas.getBoundingClientRect();
    for (const m of this.markers.children) {
      const v = m.position.clone().project(this.camera);
      if (v.z > 1) continue;
      const sx = (v.x + 1) / 2 * r.width + r.left, sy = (1 - v.y) / 2 * r.height + r.top, d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bd) { bd = d; best = m.userData.port; }
    }
    return best;
  }
  pickPart(x, y) {
    this.ray.setFromCamera(this._ndc(x, y), this.camera);
    const objs = []; for (const o of this.partObjs.values()) o.traverse((m) => { if (m.isMesh && m.userData.role && m.userData.role !== 'inner') objs.push(m); });
    const hit = this.ray.intersectObjects(objs, false)[0];
    return hit ? hit.object.userData.part : null;
  }

  // ---------------------------------------------------------------- frame
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  render(now) {
    this.controls.update();
    const camD = this.camera.position.distanceTo(this.controls.target);
    for (const m of this.markers.children) m.rotation.y = now * 1.5;
    if (this.markers.children.length) { const s0 = Math.max(0.28, camD * 0.011); for (const m of this.markers.children) if (m.material === this.M.port) m.scale.setScalar(s0 * (1 + 0.12 * Math.sin(now * 5))); }
    this.zone.visible = this.mode === 'blueprint' || this.markers.children.length > 0;
    this.renderer.render(this.scene, this.camera);
  }
}

function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function addRot(pos, quat, l) {
  const [x, y, z, w] = quat, [px, py, pz] = l;
  const ix = w * px + y * pz - z * py, iy = w * py + z * px - x * pz, iz = w * pz + x * py - y * px, iw = -x * px - y * py - z * pz;
  return [pos[0] + ix * w + iw * -x + iy * -z - iz * -y, pos[1] + iy * w + iw * -y + iz * -x - ix * -z, pos[2] + iz * w + iw * -z + ix * -y - iy * -x];
}
