// Every station part, room and ship, drawn in code from simple shapes: cylinders, rings, lathed profiles and boxes. No model files.
// A part is a group of pieces, each tagged with a role so the view can restyle them per view mode:
//   hull  - the outer skin (its edges become the blueprint lines)   inner - decks and fittings, seen in the cutaway
//   glow  - windows and lights                                       glass - domes and blisters
//   panel - solar cells                                              wire  - thin lattice lines
//   pod   - cargo containers                                         screen - the propaganda screen
// Port positions in config.js and slot positions here match these shapes.
import * as THREE from './vendor/three.js';

import { C } from './config.js';
import { roomPlan, OPEN } from './rooms.js';
const TAU = Math.PI * 2;
const V2 = (x, y) => new THREE.Vector2(x, y);
const along = (g) => g.rotateZ(-Math.PI / 2);        // a Y-axis cylinder turned to lie along +X
const flat = (g) => g.rotateX(Math.PI / 2);          // a torus turned to lie in the XZ plane

// ---------------------------------------------------------------- slots: where each room sits inside a part
// Each slot is a floor tile in the part's own frame: its centre, its turn about Y, and its size (w along its X, d along its Z).
// Rooms never fill the whole deck: every part keeps a WALK, the way people move through it, and each room opens onto it by a door.
const around = (n, r, y, w, d, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i + 0.5) * TAU / n; return { p: [Math.cos(a) * r, y, Math.sin(a) * r], ry: -Math.PI / 2 - a, w, d }; });
const stack = (ys, w, d = w, x = 0) => ys.map((y) => ({ p: [x, y, 0], ry: 0, w, d }));
const row = (xs, y, w, d, z = 0) => xs.map((x) => ({ p: [x, y, z], ry: 0, w, d }));
const at = (x, y, z, w, d) => ({ p: [x, y, z], ry: 0, w, d });
export const SLOTS = {
  command: stack([-0.98, 0.02, 0.92], 1.5),
  core: stack([-0.73, 0.77], 1.5),
  longcore: stack([-2.23, -0.73, 0.77, 2.27], 1.5),
  junction: stack([0.02], 2.1),
  reactor: [{ p: [1.45, 0.02, 0], ry: 0, w: 0.9, d: 1.4 }],
  hab: row([1.2, 2.4, 3.6], -0.53, 1.1, 1.1, -0.22),
  cargo: row([1.2, 2.4, 3.6], -0.53, 1.1, 1.1, -0.22),
  ring: around(12, 7.22, -0.31, 3.3, 1.0),
  bigring: around(12, 12.14, -0.19, 5.6, 0.6),
  drum: [...around(4, 4.08, -0.73, 2.7, 0.9, Math.PI / 4 - TAU / 8), ...around(4, 4.08, 0.17, 2.7, 0.9, Math.PI / 4 - TAU / 8)],
  disc: around(8, 3.0, -0.13, 1.9, 1.7),
  tower: stack([-2.88, -1.73, -0.58, 0.62, 1.77, 2.92], 2.1),
  dome: stack([0.23], 2.8),
  blister: [{ p: [1.4, -0.38, 0], ry: 0, w: 1.4, d: 1.4 }],
  hangar: [at(5.2, -1.58, -0.3, 4.4, 4.0), at(1.55, -1.58, -1.55, 2.3, 1.9), at(1.55, -1.58, 0.45, 2.3, 1.9)],
  pelicanbay: [at(5.2, -1.58, -0.3, 4.4, 4.0), at(1.55, -1.58, -1.55, 2.3, 1.9), at(1.55, -1.58, 0.45, 2.3, 1.9)],
  eaglehangar: [at(4.7, -1.38, -1.25, 3.8, 1.9), at(4.7, -1.38, 0.75, 3.8, 1.9), at(1.45, -1.38, -0.3, 2.1, 3.6)],
  drydock: row([0.55, 1.45], -0.72, 0.85, 1.4, -0.3),
  refinery: row([1.1, 2.9], -1.08, 1.6, 1.15, -0.3),
  gunmount: row([0.95, 2.45], -0.62, 1.3, 1.15, -0.28),
  battery: row([0.9, 2.3, 3.7], -0.62, 1.25, 1.15, -0.28),
  dronebay: row([0.85, 2.15], -0.62, 1.15, 1.15, -0.28),
  barracks: row([1.0, 2.6, 4.2], -0.62, 1.45, 1.25, -0.3),
  fabshop: row([1.2, 3.2], -0.62, 1.8, 1.25, -0.3),
  lance: row([1.0, 2.6, 4.2], -0.72, 1.45, 1.4, -0.35),
};
// How people move through each part. shaft: a lift up the middle, one deck per stop. hall: a corridor along the part at floor
// height (y) and to one side (z). ring: a corridor round the part at radius R; `spokes` are the angles of the walkways to the hub.
const deg = (xs) => xs.map((x) => x * Math.PI / 180);
export const WALK = {
  command: { k: 'shaft' }, core: { k: 'shaft' }, longcore: { k: 'shaft' }, junction: { k: 'shaft' }, tower: { k: 'shaft' }, dome: { k: 'shaft' },
  reactor: { k: 'ring', R: 0.95, y: 0.02 },
  hab: { k: 'hall', y: -0.53, z: 0.6 }, cargo: { k: 'hall', y: -0.53, z: 0.6 },
  ring: { k: 'ring', R: 6.45, y: -0.31, spokes: deg([0, 90, 180, 270]) }, bigring: { k: 'ring', R: 11.66, y: -0.19, spokes: deg([30, 90, 150, 210, 270, 330]) },
  drum: { k: 'ring', R: 3.38, spokes: deg([0, 90, 180, 270]) }, disc: { k: 'ring', R: 4.55, y: -0.13, spokes: deg([0, 45, 90, 135, 180, 225, 270, 315]) },
  blister: { k: 'hall', y: -0.38, z: 0 }, dockport: { k: 'hall', y: -0.43, z: 0 }, tube: { k: 'hall', y: -0.3, z: 0 }, truss: { k: 'hall', y: -0.28, z: 0 },
  hangar: { k: 'hall', y: -1.58, z: 2.15 }, pelicanbay: { k: 'hall', y: -1.58, z: 2.15 }, eaglehangar: { k: 'hall', y: -1.38, z: 2.0 },
  drydock: { k: 'hall', y: -0.72, z: 0.75 }, refinery: { k: 'hall', y: -1.08, z: 0.62 },
  gunmount: { k: 'hall', y: -0.62, z: 0.62 }, battery: { k: 'hall', y: -0.62, z: 0.62 }, dronebay: { k: 'hall', y: -0.62, z: 0.62 },
  barracks: { k: 'hall', y: -0.62, z: 0.72 }, fabshop: { k: 'hall', y: -0.62, z: 0.72 }, lance: { k: 'hall', y: -0.72, z: 0.8 },
};
// The deck someone stands on at height y inside a part: the highest floor at or just below it.
export function floorY(type, y) {
  const W = WALK[type], lay = SLOTS[type];
  if (W && W.y !== undefined) return W.y;
  if (!lay || !lay.length) return y;
  const ys = [...new Set(lay.map((s) => s.p[1]))].sort((a, b) => a - b);
  let best = ys[0];
  for (const f of ys) if (f <= y + 0.36) best = f;
  return best;
}
// The point on a part's walk nearest to p (all in the part's own frame).
export function onWalk(type, p, toward) {
  const W = WALK[type];
  if (!W) return null;
  const y = floorY(type, p[1]);
  if (W.k === 'shaft') return [0, y, 0];
  if (W.k === 'hall') return [p[0], y, W.z];
  let a = Math.atan2(p[2], p[0]);
  if (Math.hypot(p[0], p[2]) < 0.4 && toward) a = Math.atan2(toward[2], toward[0]);
  return [Math.cos(a) * W.R, y, Math.sin(a) * W.R];
}
// The way from a to b through a part, as a list of points: off the spot, along the walk, onto the other spot.
export function walkPath(type, a, b) {
  const W = WALK[type];
  if (!W) return [a, b];
  const A = [a[0], floorY(type, a[1]), a[2]], B = [b[0], floorY(type, b[1]), b[2]];
  const pa = onWalk(type, A, B), pb = onWalk(type, B, A), out = [A];
  if (W.k === 'ring') {
    // someone at the hub goes out along a spoke first
    const hub = (P, Q) => { if (Math.hypot(P[0], P[2]) > 0.4 || !W.spokes) return null; const t = Math.atan2(Q[2], Q[0]); let best = W.spokes[0]; for (const s of W.spokes) if (Math.abs(Math.atan2(Math.sin(s - t), Math.cos(s - t))) < Math.abs(Math.atan2(Math.sin(best - t), Math.cos(best - t)))) best = s; return [Math.cos(best) * W.R, P[1], Math.sin(best) * W.R]; };
    const ha = hub(A, B), hb = hub(B, A), s = ha || pa, e = hb || pb;
    out.push(s);
    let a0 = Math.atan2(s[2], s[0]), d = Math.atan2(e[2], e[0]) - a0; d = Math.atan2(Math.sin(d), Math.cos(d));
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.2));
    for (let i = 1; i <= n; i++) { const t = a0 + d * i / n; out.push([Math.cos(t) * W.R, s[1] + (e[1] - s[1]) * i / n, Math.sin(t) * W.R]); }
  } else { out.push(pa); out.push(pb); }
  out.push(B);
  return out;
}
// Which side of a slot its door is on: the side nearest the walk. Null on an open deck round a lift.
export function doorSide(type, s) {
  const W = WALK[type];
  if (!W || W.k === 'shaft') return null;
  const w = onWalk(type, s.p), dx = w[0] - s.p[0], dz = w[2] - s.p[2], c = Math.cos(s.ry), sn = Math.sin(s.ry);
  const lx = dx * c - dz * sn, lz = dx * sn + dz * c;      // into the slot's own frame
  if (Math.hypot(lx, lz) < 0.05) return null;
  return Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? '+x' : '-x') : (lz > 0 ? '+z' : '-z');
}
// A slot's room plan (rooms.js works in metres, with the door wall at +Z), and how to bring a point of it into the part's frame.
const PLAIN = new Set(['crate', 'glow', 'lane', 'screen', 'glass', 'spark', 'blue', 'alarm', 'cross', 'awning']);      // drawn with their own box coordinates, or with none
const TURN = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };
function slotPlan(type, i, room, variant) {
  const s = SLOTS[type][i], side = doorSide(type, s), m = C.scale.m, sw = side === '+x' || side === '-x';
  const plan = roomPlan(room, (sw ? s.d : s.w) * 0.96 * m, (sw ? s.w : s.d) * 0.96 * m, side, variant);
  const th = TURN[side] ?? 0, ct = Math.cos(th), st = Math.sin(th), c = Math.cos(s.ry), sn = Math.sin(s.ry);
  const at = (x, z) => { const lx = (x * ct + z * st) / m, lz = (-x * st + z * ct) / m; return [s.p[0] + lx * c + lz * sn, s.p[1], s.p[2] - lx * sn + lz * c]; };
  return { plan, at, turn: th + s.ry };
}
// A person's own place in a slot, in the part's frame: where they stand, which way they face (null: any), the clear way from there
// to the door, and the door (on an open deck, the lift in the middle). People with work to stand at take those places first.
export function slotSpot(type, i, k, room = 'empty', variant = 0) {
  const { plan, at, turn } = slotPlan(type, i, room, variant);
  const use = plan.spots.filter((x) => !x.idle), idle = plan.spots.filter((x) => x.idle);
  const pool = use.length && (k * 13.7 % 1 < 0.8 || !idle.length) ? use : idle, sp = pool[Math.floor(k * 7919) % pool.length];
  const j = sp.idle ? (k * 5.3 % 1 - 0.5) * 0.9 : (k * 5.3 % 1 - 0.5) * 0.24;
  return { spot: at(sp.x + j, sp.z), via: sp.via.map(([x, z]) => at(x, z)), door: at(plan.door[0], plan.door[1]), face: sp.face === null ? null : sp.face + turn };
}

// Bake a built group down to one mesh (or one set of lines) per role, so a part or a room costs a handful of draw calls however
// many pieces it was drawn from. Sub-groups (fittings turned to face a door, a craft on a pad) are folded in where they stand.
function bake(g) {
  g.updateMatrixWorld(true);
  const by = new Map();
  g.traverse((o) => { if ((o.isMesh || o.isLineSegments) && o.userData.role) { const k = (o.isMesh ? 'm:' : 'l:') + o.userData.role; if (!by.has(k)) by.set(k, []); by.get(k).push(o); } });
  const out = new THREE.Group();
  for (const [k, list] of by) {
    const geos = list.map((o) => { const x = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); x.applyMatrix4(o.matrixWorld); return x; });
    const n = geos.reduce((t, x) => t + x.attributes.position.count, 0), mesh = k[0] === 'm', geo = new THREE.BufferGeometry();
    const names = ['position']; if (mesh) { names.push('normal'); if (geos.every((x) => x.attributes.uv)) names.push('uv'); }
    for (const name of names) {
      const size = name === 'uv' ? 2 : 3, arr = new Float32Array(n * size); let off = 0;
      for (const x of geos) { const at = x.attributes[name]; if (at) arr.set(at.array.subarray(0, at.count * size), off); off += x.attributes.position.count * size; }
      geo.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    for (const x of geos) x.dispose();
    const o = mesh ? new THREE.Mesh(geo) : new THREE.LineSegments(geo);
    Object.assign(o.userData, list[0].userData); out.add(o);
  }
  return out;
}

// Hull pieces get skin coordinates measured in station units (one repeat every 2 units), so plating is the same size on every part.
function skin(geom, k = 0.5) {
  const g = geom.index ? geom.toNonIndexed() : geom, P = g.attributes.position, uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i += 3) {
    const ax = P.getX(i), ay = P.getY(i), az = P.getZ(i), ux = P.getX(i + 1) - ax, uy = P.getY(i + 1) - ay, uz = P.getZ(i + 1) - az, vx = P.getX(i + 2) - ax, vy = P.getY(i + 2) - ay, vz = P.getZ(i + 2) - az;
    const nx = Math.abs(uy * vz - uz * vy), ny = Math.abs(uz * vx - ux * vz), nz = Math.abs(ux * vy - uy * vx);
    for (let j = 0; j < 3; j++) {
      const x = P.getX(i + j), y = P.getY(i + j), z = P.getZ(i + j);
      if (ny >= nx && ny >= nz) { uv[(i + j) * 2] = x * k; uv[(i + j) * 2 + 1] = z * k; }
      else if (nx >= nz) { uv[(i + j) * 2] = z * k; uv[(i + j) * 2 + 1] = y * k; }
      else { uv[(i + j) * 2] = x * k; uv[(i + j) * 2 + 1] = y * k; }
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function buildPart(type) {
  const g = new THREE.Group();
  const put = (geom, role, x = 0, y = 0, z = 0, opt = {}) => {
    geom.translate(x, y, z);
    const m = new THREE.Mesh(role === 'hull' || role === 'trim' ? skin(geom) : role === 'inner' || role === 'hall' || role === 'wall' ? skin(geom, C.scale.m / 2) : geom); m.userData.role = role; g.add(m);
    if ((role === 'hull' || role === 'glass' || role === 'inner') && !opt.noEdges) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geom, opt.angle ?? 28)); e.userData.role = role === 'inner' ? 'innerLine' : 'line'; g.add(e);
    }
    return m;
  };
  // A module body with its corners cut: an eight-sided section drawn along +X from x = 0 to L.
  const oct = (L, w, h, ch = 0.3) => {
    const sh = new THREE.Shape(), a = w / 2, b = h / 2;
    sh.moveTo(-a + ch, -b); sh.lineTo(a - ch, -b); sh.lineTo(a, -b + ch); sh.lineTo(a, b - ch); sh.lineTo(a - ch, b); sh.lineTo(-a + ch, b); sh.lineTo(-a, b - ch); sh.lineTo(-a, -b + ch); sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }).rotateY(Math.PI / 2);
  };
  const collar = (r = 0.62) => put(along(new THREE.CylinderGeometry(r, r, 0.3, 16)), 'trim', 0.1, 0, 0);
  const ports = (n, x0, dx, y, z) => { for (let i = 0; i < n; i++) for (const s of [1, -1]) put(new THREE.BoxGeometry(0.3, 0.16, 0.04), 'glow', x0 + i * dx, y, s * z); };
  // A nameplate: the station's emblem and name, on a backing plate. It faces +Z (or −Z).
  const plate = (x, y, z, w = 1.0, h = 0.5, back = false) => {
    put(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), 'trim', x, y, z - (back ? -0.02 : 0.02), { noEdges: true });
    const pl = new THREE.PlaneGeometry(w, h); if (back) pl.rotateY(Math.PI);
    put(pl, 'decal', x, y, z + (back ? -0.006 : 0.006), { noEdges: true });
  };
  // An open bay: floor, roof, two walls and a back, with a lit door frame at the far end.
  const bay = (L, hy, hz) => {
    put(new THREE.BoxGeometry(L, 0.2, hz * 2), 'hull', L / 2, -hy, 0); put(new THREE.BoxGeometry(L, 0.2, hz * 2), 'hull', L / 2, hy, 0);
    put(new THREE.BoxGeometry(L, hy * 2 + 0.2, 0.2), 'hull', L / 2, 0, hz); put(new THREE.BoxGeometry(L, hy * 2 + 0.2, 0.2), 'hull', L / 2, 0, -hz); put(new THREE.BoxGeometry(0.2, hy * 2 + 0.2, hz * 2 + 0.2), 'hull', 0.1, 0, 0);
    for (const z of [hz + 0.11, -hz - 0.11]) for (let i = 0; i < Math.floor(L - 1); i++) put(new THREE.BoxGeometry(0.5, 0.18, 0.04), 'glow', 0.9 + i * 1.1, hy * 0.55, z);
    for (const y of [hy - 0.1, -hy + 0.1]) { put(new THREE.BoxGeometry(0.25, 0.25, hz * 2 + 0.3), 'trim', L, y, 0, { noEdges: true }); put(new THREE.BoxGeometry(0.08, 0.08, hz * 2 - 0.4), 'glow', L + 0.06, y * 0.9, 0); }
    for (const z of [hz, -hz]) put(new THREE.BoxGeometry(0.25, hy * 2, 0.25), 'trim', L, 0, z, { noEdges: true });
    put(new THREE.BoxGeometry(L - 0.2, 0.1, 0.03), 'trim', L / 2, -hy * 0.45, hz + 0.115, { noEdges: true }); put(new THREE.BoxGeometry(L - 0.2, 0.1, 0.03), 'trim', L / 2, -hy * 0.45, -hz - 0.115, { noEdges: true });
    plate(L * 0.5, hy * 0.05, hz + 0.13, 1.6, 0.8); plate(L * 0.5, hy * 0.05, -hz - 0.13, 1.6, 0.8, true);
  };
  const wire = (pts) => {
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)));
    l.userData.role = 'wire'; g.add(l);
  };
  const windows = (n, r, y, w = 0.18, h = 0.14, a0 = 0) => {
    for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n, b = new THREE.BoxGeometry(0.05, h, w); b.rotateY(-a); put(b, 'glow', Math.cos(a) * r, y, Math.sin(a) * r); }
  };
  const decks = (rIn, rOut, ys, seg = 32) => { for (const y of ys) put(new THREE.RingGeometry(rIn, rOut, seg).rotateX(-Math.PI / 2), 'inner', 0, y, 0, { angle: 60 }); };
  const shaft = (h) => { for (const [x, z] of [[0.13, 0.13], [-0.13, 0.13], [0.13, -0.13], [-0.13, -0.13]]) put(new THREE.BoxGeometry(0.016, h, 0.016), 'inner', x, 0, z, { noEdges: true }); };
  const box = (w, h, d, role, x, y, z, opt) => put(new THREE.BoxGeometry(w, h, d), role, x, y, z, opt);

  switch (type) {
    case 'command': {
      put(new THREE.CylinderGeometry(1.2, 1.2, 3.4, 24), 'hull');
      put(new THREE.CylinderGeometry(1.9, 1.9, 0.6, 24), 'hull', 0, 0.95, 0);
      put(new THREE.CylinderGeometry(1.2, 1.9, 0.45, 24), 'hull', 0, 1.47, 0);
      put(new THREE.CylinderGeometry(1.55, 1.55, 0.3, 24), 'hull', 0, -1.2, 0);
      windows(16, 1.92, 0.95, 0.3, 0.16);
      plate(0, -0.35, 1.22, 1.0, 0.5); plate(0, -0.35, -1.22, 1.0, 0.5, true);
      shaft(3.2);
      break;
    }
    case 'core': case 'longcore': {
      const h = type === 'core' ? 3 : 6;
      put(new THREE.CylinderGeometry(1.2, 1.2, h, 24), 'hull');
      for (const y of type === 'core' ? [-1.15, 1.15] : [-2.9, -1.5, 0, 1.5, 2.9]) put(flat(new THREE.TorusGeometry(1.24, 0.09, 6, 24)), 'trim', 0, y, 0, { noEdges: true });
      for (const y of type === 'core' ? [0.3] : [-2.0, -0.6, 0.9, 2.3]) windows(8, 1.22, y, 0.2, 0.12);
      shaft(h - 0.1);
      break;
    }
    case 'junction': {
      put(new THREE.CylinderGeometry(1.6, 1.6, 1.6, 12), 'hull', 0, 0, 0, { angle: 20 });
      for (const y of [-0.8, 0.8]) put(flat(new THREE.TorusGeometry(1.6, 0.1, 6, 24)), 'trim', 0, y, 0, { noEdges: true });
      windows(12, 1.62, 0.35, 0.3, 0.12);
      shaft(1.5);
      break;
    }
    case 'reactor': {
      const prof = [V2(1.2, -1.75), V2(1.5, -1.55), V2(2.2, -0.7), V2(2.2, 0.7), V2(1.5, 1.55), V2(1.2, 1.75)];
      put(new THREE.LatheGeometry(prof, 28), 'hull');
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8, b = new THREE.BoxGeometry(0.7, 1.2, 0.08); b.rotateY(-a); put(b, 'hull', Math.cos(a) * 2.45, 0, Math.sin(a) * 2.45); }
      put(new THREE.CylinderGeometry(0.55, 0.55, 2.8, 16), 'glow');
      decks(0.7, 2.1, [0]);
      break;
    }
    case 'spire': {
      put(new THREE.CylinderGeometry(0.35, 1.2, 4, 16), 'hull');
      put(flat(new THREE.TorusGeometry(1.0, 0.12, 6, 20)), 'trim', 0, -1.0, 0, { noEdges: true });
      const p = [0, 2, 0, 0, 5.2, 0];
      for (const [y, w] of [[2.8, 1.4], [3.6, 1.0], [4.4, 0.6]]) p.push(-w, y, 0, w, y, 0, 0, y, -w, 0, y, w);
      wire(p);
      put(new THREE.SphereGeometry(0.16, 8, 6), 'glow', 0, 5.25, 0);
      break;
    }
    case 'ring': case 'bigring': {
      const big = type === 'bigring', R = big ? 12 : 7, tube = big ? 0.6 : 0.95, hubH = big ? 1.2 : 1.4, spokes = big ? 6 : 4;
      put(new THREE.CylinderGeometry(1.3, 1.3, hubH, 24), 'hull');
      for (let i = 0; i < spokes; i++) {
        const a = (big ? Math.PI / 6 : 0) + i * TAU / spokes, len = R - tube - 1.3, s = new THREE.CylinderGeometry(big ? 0.16 : 0.22, big ? 0.16 : 0.22, len, 8);
        along(s); s.rotateY(-a); put(s, 'hull', Math.cos(a) * (1.3 + len / 2), 0, Math.sin(a) * (1.3 + len / 2), { angle: 50 });
      }
      put(flat(new THREE.TorusGeometry(R, tube, big ? 8 : 12, big ? 96 : 72)), 'hull', 0, 0, 0, { angle: 35 });
      windows(big ? 48 : 32, R + tube + 0.01, 0, 0.22, 0.14);
      decks(R - tube * 0.75, R + tube * 0.75, [-tube * 0.35], big ? 96 : 72);
      break;
    }
    case 'disc': {
      const prof = [V2(1.2, -0.8), V2(4.6, -0.8), V2(5.6, -0.25), V2(5.6, 0.25), V2(4.6, 0.8), V2(1.2, 0.8), V2(1.2, -0.8)];
      put(new THREE.LatheGeometry(prof, 48), 'hull', 0, 0, 0, { angle: 20 });
      windows(36, 5.61, 0, 0.26, 0.2);
      decks(1.3, 5.3, [-0.15], 48);
      break;
    }
    case 'drum': {
      const prof = [V2(3.0, -1.3), V2(4.4, -1.3), V2(4.7, -0.9), V2(4.7, 0.9), V2(4.4, 1.3), V2(3.0, 1.3), V2(3.0, -1.3)];
      put(new THREE.LatheGeometry(prof, 48), 'hull', 0, 0, 0, { angle: 20 });
      put(new THREE.CylinderGeometry(1.3, 1.3, 2.6, 24), 'hull');
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4, b = new THREE.BoxGeometry(1.8, 0.4, 0.4); b.rotateY(-a); put(b, 'hull', Math.cos(a) * 2.15, 0, Math.sin(a) * 2.15); }
      windows(28, 4.71, 0.45, 0.22, 0.14); windows(28, 4.71, -0.45, 0.22, 0.14, 0.11);
      decks(3.1, 4.6, [-0.75, 0.15], 48);
      break;
    }
    case 'tower': {
      put(new THREE.CylinderGeometry(1.8, 1.8, 6.4, 6), 'hull', 0, 0, 0, { angle: 20 });
      put(new THREE.CylinderGeometry(1.25, 1.8, 0.3, 6), 'hull', 0, 3.35, 0);
      put(new THREE.CylinderGeometry(1.8, 1.25, 0.3, 6), 'hull', 0, -3.35, 0);
      for (let k = 0; k < 6; k++) for (let i = 0; i < 6; i++) { const a = i * TAU / 6, b = new THREE.BoxGeometry(0.05, 0.22, 0.7); b.rotateY(-a); put(b, 'glow', Math.cos(a) * 1.57, -2.6 + k * 1.15, Math.sin(a) * 1.57); }
      for (const y of [-2.9, -1.75, -0.6, 0.6, 1.75, 2.9]) put(new THREE.CylinderGeometry(1.5, 1.5, 0.04, 6), 'inner', 0, y, 0, { angle: 60 });
      shaft(6.6);
      break;
    }
    case 'dome': {
      put(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 24), 'hull');
      put(new THREE.SphereGeometry(2.1, 20, 8, 0, TAU, 0, Math.PI / 2), 'glass', 0, 0.2, 0, { angle: 10 });
      break;
    }
    case 'blister': {
      put(along(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 16)), 'hull', 0.25, 0, 0);
      put(new THREE.SphereGeometry(1.3, 20, 12), 'glass', 1.4, 0, 0, { angle: 12 });
      put(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 20), 'inner', 1.4, -0.42, 0, { angle: 60 });
      break;
    }
    case 'dockport': {
      put(along(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 16)), 'hull', 1.1, 0, 0);
      put(new THREE.TorusGeometry(0.85, 0.13, 6, 20).rotateY(Math.PI / 2), 'trim', 2.2, 0, 0, { noEdges: true });
      for (const [y, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) box(0.1, 0.12, 0.12, 'glow', 2.32, y, z);
      box(2.0, 0.05, 0.9, 'inner', 1.1, -0.45, 0, { angle: 60 });
      break;
    }
    case 'pylon': {
      box(5, 0.7, 0.7, 'hull', 2.5, 0, 0); box(0.9, 0.9, 0.9, 'hull', 5, 0, 0); box(0.6, 4.2, 0.6, 'hull', 5, 2.5, 0);
      put(flat(new THREE.TorusGeometry(0.75, 0.14, 6, 20)), 'trim', 5, 4.7, 0, { noEdges: true });
      for (const y of [1.2, 2.4, 3.6]) box(0.62, 0.1, 0.62, 'glow', 5, y, 0);
      put(new THREE.SphereGeometry(0.14, 8, 6), 'glow', 5, 5.05, 0);
      break;
    }
    case 'hangar': case 'pelicanbay': { bay(8, 1.7, 2.7); break; }
    case 'eaglehangar': { bay(7, 1.5, 2.4); break; }
    case 'drydock': {
      box(2, 1.8, 2.4, 'hull', 1, 0, 0);
      for (let i = 0; i < 4; i++) box(0.5, 0.18, 0.04, 'glow', 1, 0.45, i < 2 ? 1.22 : -1.22);
      const p = [], h = 2.3, x1 = 17;
      for (const [y, z] of [[h, h], [h, -h], [-h, h], [-h, -h]]) { box(x1 - 2, 0.18, 0.18, 'hull', (x1 + 2) / 2, y, z, { noEdges: true }); p.push(2, y, z, x1, y, z); }
      for (let x = 2; x <= x1 + 0.01; x += 3) {
        p.push(x, h, h, x, h, -h, x, h, -h, x, -h, -h, x, -h, -h, x, -h, h, x, -h, h, x, h, h);
        for (const [y, z] of [[h, h], [h, -h], [-h, h], [-h, -h]]) put(new THREE.SphereGeometry(0.1, 6, 4), 'glow', x, y, z);
      }
      wire(p);
      box(x1 - 2, 0.1, 0.5, 'trim', (x1 + 2) / 2, h + 0.15, 0, { noEdges: true });
      break;
    }
    // ---- the fire support platform
    case 'gunmount': {
      put(oct(3.4, 2.0, 1.6), 'hull', 0.2, 0, 0); collar();
      ports(3, 0.9, 0.55, 0.3, 1.01); box(3.3, 0.09, 2.02, 'trim', 1.9, -0.32, 0, { noEdges: true });
      plate(2.9, 0.22, 1.02, 0.7, 0.36); plate(2.9, 0.22, -1.02, 0.7, 0.36, true);
      put(new THREE.CylinderGeometry(0.8, 0.95, 0.35, 20), 'hull', 1.9, -0.95, 0); put(new THREE.SphereGeometry(0.62, 16, 10), 'hull', 1.9, -1.3, 0, { angle: 40 });
      for (const z of [0.22, -0.22]) { put(new THREE.CylinderGeometry(0.11, 0.14, 1.7, 10), 'hull', 1.9, -2.3, z, { noEdges: true }); put(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 10), 'trim', 1.9, -3.05, z, { noEdges: true }); put(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10), 'glow', 1.9, -3.17, z); }
      break;
    }
    case 'battery': {
      put(oct(4.6, 2.0, 1.6), 'hull', 0.2, 0, 0); collar();
      ports(4, 0.9, 0.55, 0.3, 1.01); box(4.5, 0.09, 2.02, 'trim', 2.5, -0.32, 0, { noEdges: true });
      plate(4.0, 0.22, 1.02, 0.7, 0.36); plate(4.0, 0.22, -1.02, 0.7, 0.36, true);
      box(1.5, 0.7, 1.5, 'hull', 2.5, -1.1, 0); put(new THREE.CylinderGeometry(0.36, 0.44, 3.0, 14), 'hull', 2.5, -2.9, 0, { angle: 40 });
      for (const y of [-1.9, -2.7, -3.5]) put(flat(new THREE.TorusGeometry(0.45, 0.07, 6, 16)), 'trim', 2.5, y, 0, { noEdges: true });
      put(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 14), 'hull', 2.5, -4.5, 0); put(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 14), 'glow', 2.5, -4.69, 0);
      for (const [x, z] of [[1.95, 0.55], [3.05, 0.55], [1.95, -0.55], [3.05, -0.55]]) put(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), 'hull', x, -2.1, z, { noEdges: true });
      break;
    }
    case 'dronebay': {
      put(oct(3.0, 2.0, 1.6), 'hull', 0.2, 0, 0); collar();
      ports(2, 0.9, 0.6, 0.3, 1.01); box(2.9, 0.09, 2.02, 'trim', 1.7, -0.32, 0, { noEdges: true });
      for (const z of [-0.5, 0, 0.5]) { box(2.2, 0.06, 0.08, 'hull', 1.7, -0.95, z, { noEdges: true }); const d = new THREE.ConeGeometry(0.14, 0.7, 4); d.rotateZ(-Math.PI / 2); put(d, 'hull', 1.4 + z * 0.6, -1.12, z); box(0.5, 0.02, 0.5, 'hull', 1.3 + z * 0.6, -1.12, z, { noEdges: true }); put(new THREE.SphereGeometry(0.04, 6, 4), 'glow', 1.76 + z * 0.6, -1.12, z); }
      put(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), 'hull', 2.8, 1.2, 0.6, { noEdges: true }); put(new THREE.SphereGeometry(0.06, 6, 4), 'glow', 2.8, 1.68, 0.6);
      break;
    }
    case 'relay': {
      put(along(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8)), 'hull', 0.6, 0, 0, { noEdges: true }); box(0.4, 0.4, 0.4, 'hull', 1.2, 0, 0);
      const prof = []; for (let i = 0; i <= 8; i++) { const r = 0.05 + i * 0.15; prof.push(V2(r, r * r / 2.6)); }
      put(new THREE.LatheGeometry(prof, 24).rotateX(Math.PI), 'hull', 1.2, -0.25, 0, { angle: 30 });
      put(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), 'hull', 1.2, -0.7, 0, { noEdges: true }); put(new THREE.SphereGeometry(0.09, 8, 6), 'glow', 1.2, -1.12, 0);
      break;
    }
    case 'barracks': {
      put(oct(5.0, 2.2, 1.6), 'hull', 0.1, 0, 0); collar(); put(along(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 16)), 'trim', 5.1, 0, 0);
      ports(6, 0.9, 0.6, 0.3, 1.11); box(4.9, 0.09, 2.22, 'trim', 2.6, -0.32, 0, { noEdges: true });
      plate(4.45, 0.24, 1.12, 0.7, 0.36); plate(4.45, 0.24, -1.12, 0.7, 0.36, true);
      break;
    }
    case 'fabshop': {
      put(oct(4.2, 2.2, 1.6), 'hull', 0.1, 0, 0); collar(); put(along(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 16)), 'trim', 4.3, 0, 0);
      ports(3, 0.9, 0.6, 0.3, 1.11); box(4.1, 0.09, 2.22, 'trim', 2.2, -0.32, 0, { noEdges: true });
      for (const [x, z] of [[1.2, 0.5], [1.2, -0.5]]) { put(new THREE.CylinderGeometry(0.2, 0.26, 0.7, 10), 'hull', x, 1.1, z); put(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10), 'glow', x, 1.47, z); }
      for (let i = 0; i < 4; i++) box(0.5, 0.45, 0.5, 'pod', 2.6 + (i % 2) * 0.6, -1.05, i < 2 ? 0.35 : -0.35);
      break;
    }
    case 'lance': {
      put(oct(6.0, 2.4, 1.8, 0.35), 'hull', 0.2, 0, 0); collar(0.7);
      ports(6, 0.9, 0.8, 0.35, 1.21); box(5.9, 0.1, 2.42, 'trim', 3.2, -0.36, 0, { noEdges: true });
      plate(5.4, 0.3, 1.22, 0.9, 0.45); plate(5.4, 0.3, -1.22, 0.9, 0.45, true);
      box(2.2, 0.9, 2.2, 'hull', 3.2, -1.3, 0); put(new THREE.CylinderGeometry(0.7, 0.9, 6, 16), 'hull', 3.2, -4.7, 0, { angle: 40 });
      for (const y of [-2.4, -3.6, -4.8, -6.0, -7.2]) put(flat(new THREE.TorusGeometry(0.95, 0.1, 6, 20)), 'trim', 3.2, y, 0, { noEdges: true });
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; put(new THREE.SphereGeometry(0.34, 12, 8), 'hull', 3.2 + Math.cos(a) * 1.25, -2.0, Math.sin(a) * 1.25, { angle: 40 }); put(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), 'glow', 3.2 + Math.cos(a) * 1.25, -2.8, Math.sin(a) * 1.25); }
      put(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 16), 'glow', 3.2, -7.72, 0);
      break;
    }
    case 'truss': {
      const L = 5, h = 0.4, p = [];
      for (const [y, z] of [[h, h], [h, -h], [-h, h], [-h, -h]]) { p.push(0, y, z, L, y, z); box(L, 0.09, 0.09, 'hull', L / 2, y, z, { noEdges: true }); }
      for (let x = 0; x <= L + 0.01; x += 1) p.push(x, h, h, x, h, -h, x, h, -h, x, -h, -h, x, -h, -h, x, -h, h, x, -h, h, x, h, h);
      for (let x = 0; x < L - 0.01; x += 1) p.push(x, h, h, x + 1, -h, h, x, h, -h, x + 1, -h, -h, x, h, h, x + 1, h, -h, x, -h, h, x + 1, -h, -h);
      wire(p);
      box(L, 0.04, 0.5, 'inner', L / 2, -0.3, 0, { angle: 60 });
      break;
    }
    case 'tube': {
      put(along(new THREE.CylinderGeometry(0.5, 0.5, 4, 12)), 'hull', 2, 0, 0, { angle: 40 });
      for (const x of [0.3, 2, 3.7]) put(new THREE.TorusGeometry(0.53, 0.07, 6, 16).rotateY(Math.PI / 2), 'trim', x, 0, 0, { noEdges: true });
      for (let i = 0; i < 6; i++) box(0.3, 0.1, 0.04, 'glow', 0.6 + i * 0.55, 0.15, 0.5);
      box(3.8, 0.03, 0.6, 'inner', 2, -0.32, 0, { angle: 60 });
      break;
    }
    case 'node': {
      put(new THREE.SphereGeometry(0.78, 16, 10), 'hull', 0.9, 0, 0, { angle: 40 });
      for (const [x, y, z, ax] of [[0.15, 0, 0, 'x'], [1.65, 0, 0, 'x'], [0.9, 0.75, 0, 'y'], [0.9, -0.75, 0, 'y'], [0.9, 0, 0.75, 'z'], [0.9, 0, -0.75, 'z']]) {
        const c = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
        if (ax === 'x') along(c); if (ax === 'z') c.rotateX(Math.PI / 2);
        put(c, 'hull', x, y, z);
      }
      break;
    }
    case 'cargo': case 'hab': {
      put(along(new THREE.CylinderGeometry(1, 1, 3.6, 20)), 'hull', 2.4, 0, 0);
      put(along(new THREE.CylinderGeometry(1, 0.55, 0.6, 20)), 'hull', 4.5, 0, 0);
      put(along(new THREE.CylinderGeometry(0.55, 1, 0.6, 20)), 'hull', 0.3, 0, 0);
      for (const x of [1.2, 2.4, 3.6]) put(new THREE.TorusGeometry(1.04, 0.08, 6, 20).rotateY(Math.PI / 2), 'trim', x, 0, 0, { noEdges: true });
      box(3.4, 0.07, 2.02, 'trim', 2.4, -0.2, 0, { noEdges: true });
      if (type === 'cargo') for (const z of [1.01, -1.01]) box(2.6, 0.08, 0.04, 'glow', 2.4, 0.5, z);
      else for (let i = 0; i < 6; i++) for (const z of [1.0, -1.0]) box(0.3, 0.2, 0.04, 'glow', 0.9 + i * 0.6, 0.15, z);
      break;
    }
    case 'rack': {
      const p = [], L = 4, h = 1, w = 1;
      for (const [y, z] of [[h, w], [h, -w], [-h, w], [-h, -w]]) p.push(0, y, z, L, y, z);
      for (let x = 0; x <= L + 0.01; x += 1) p.push(x, h, w, x, h, -w, x, h, -w, x, -h, -w, x, -h, -w, x, -h, w, x, -h, w, x, h, w);
      wire(p);
      for (const [y, z] of [[h, w], [h, -w], [-h, w], [-h, -w]]) box(L, 0.12, 0.12, 'hull', L / 2, y, z, { noEdges: true });
      for (let i = 0; i < 8; i++) box(0.85, 0.8, 0.85, 'pod', 0.55 + (i % 4) * 0.97, i < 4 ? 0.45 : -0.45, (i % 2 ? 0.45 : -0.45));
      break;
    }
    case 'tanks': {
      put(along(new THREE.CylinderGeometry(0.25, 0.25, 4.2, 8)), 'hull', 2.1, 0, 0, { noEdges: true });
      for (const x of [0.95, 2.15, 3.35]) {
        put(new THREE.SphereGeometry(0.85, 16, 10), 'hull', x, 0, 0, { angle: 35 });
        put(flat(new THREE.TorusGeometry(0.87, 0.06, 6, 20)), 'trim', x, 0, 0, { noEdges: true });
      }
      for (const z of [0.5, -0.5]) put(along(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6)), 'hull', 2.1, -0.75, z, { noEdges: true });
      box(0.1, 0.1, 0.1, 'glow', 4.2, 0, 0);
      break;
    }
    case 'refinery': {
      box(3.6, 2.4, 2, 'hull', 2, 0, 0);
      for (const [x, z] of [[1.3, 0.45], [2.7, -0.45]]) {
        put(new THREE.CylinderGeometry(0.28, 0.36, 1.6, 12), 'hull', x, 2.0, z);
        put(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), 'glow', x, 2.82, z);
      }
      for (const z of [1.1, -1.1]) for (const y of [-0.5, 0.3]) put(along(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 6)), 'hull', 2, y, z, { noEdges: true });
      for (let i = 0; i < 3; i++) box(0.4, 0.15, 0.04, 'glow', 1 + i * 1, 0.8, 1.01);
      break;
    }
    case 'solar': {
      put(along(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8)), 'hull', 0.6, 0, 0, { noEdges: true });
      box(0.22, 0.22, 1.4, 'hull', 1.2, 0, 0);
      const p = [];
      for (const s of [1, -1]) {
        box(2.2, 0.06, 5.2, 'panel', 1.2, 0, s * 3.4);
        for (let i = 0; i <= 8; i++) { const z = s * (0.8 + i * 0.65); p.push(0.1, 0.05, z, 2.3, 0.05, z); }
        for (const x of [0.1, 0.65, 1.2, 1.75, 2.3]) p.push(x, 0.05, s * 0.8, x, 0.05, s * 6.0);
      }
      wire(p);
      break;
    }
    case 'radiator': {
      put(along(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8)), 'hull', 0.5, 0, 0, { noEdges: true });
      box(0.3, 0.3, 0.3, 'hull', 1.0, 0, 0);
      const p = [];
      for (const s of [1, -1]) {
        box(1.8, 3.4, 0.05, 'hull', 1.9, s * 1.95, 0, { angle: 10 });
        for (let i = 0; i < 9; i++) { const y = s * (0.4 + i * 0.4); p.push(1.0, y, 0.03, 2.8, y, 0.03); }
      }
      wire(p);
      break;
    }
    case 'turret': {
      put(along(new THREE.CylinderGeometry(0.7, 0.6, 0.5, 16)), 'hull', 0.25, 0, 0);
      box(0.8, 0.7, 1.0, 'hull', 0.95, 0, 0);
      for (const z of [0.25, -0.25]) put(along(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 8)), 'hull', 2.0, 0.08, z, { noEdges: true });
      box(0.06, 0.12, 0.3, 'glow', 1.36, 0.2, 0);
      break;
    }
    case 'shield': {
      box(1.4, 0.3, 0.3, 'hull', 0.7, 0, 0);
      put(new THREE.TorusGeometry(0.6, 0.08, 6, 20).rotateY(Math.PI / 2), 'trim', 1.6, 0, 0, { noEdges: true });
      put(new THREE.SphereGeometry(0.42, 16, 10), 'glow', 1.75, 0, 0);
      break;
    }
    case 'dish': {
      put(along(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8)), 'hull', 0.5, 0, 0, { noEdges: true });
      const prof = []; for (let i = 0; i <= 8; i++) { const r = 0.05 + i * 0.18; prof.push(V2(r, r * r / 3)); }
      put(along(new THREE.LatheGeometry(prof, 24)), 'hull', 1.0, 0, 0, { angle: 30 });
      put(along(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6)), 'hull', 1.45, 0, 0, { noEdges: true });
      put(new THREE.SphereGeometry(0.1, 8, 6), 'glow', 1.9, 0, 0);
      break;
    }
    case 'billboard': {
      box(0.8, 0.25, 0.25, 'hull', 0.4, 0, 0);
      box(0.15, 2.5, 4.1, 'hull', 0.9, 0, 0);
      const s = new THREE.PlaneGeometry(3.8, 2.2); s.rotateY(Math.PI / 2);
      put(s, 'screen', 0.98, 0, 0, { noEdges: true });
      break;
    }
  }
  // The way through: a deck plate and a corridor with a lit centre line, a ring walk, or lift stops.
  const W = WALK[type], lay = SLOTS[type];
  // HALLWAYS. A hallway is a carpet runner 3.4 m wide with a lit centre line. The side that has no rooms on it gets a waist-high
  // wall with a handrail and wall lights, broken where a port opens through it.
  const HW = 0.19, WH = 0.14, def = C.parts[type];
  if (W && W.k === 'hall') {
    const bb = new THREE.Box3().setFromObject(g), x0 = Math.max(0.05, bb.min.x + 0.12), x1 = bb.max.x - 0.12, wide = { hab: 1.66, cargo: 1.66, gunmount: 1.8, battery: 1.8, dronebay: 1.8, barracks: 2.0, fabshop: 2.0, lance: 2.2, refinery: 1.8 }[type];
    if (wide) box(x1 - x0, 0.03, wide, 'inner', (x0 + x1) / 2, W.y - 0.02, 0, { angle: 60 });
    const through = lay && lay.some((sl) => Math.abs(sl.p[2] - W.z) < 0.1);      // the walk runs through the room itself
    if (!through) {
      box(x1 - x0, 0.005, HW * 2, 'hall', (x0 + x1) / 2, W.y + 0.0025, W.z, { noEdges: true });
      for (const sd of [1, -1]) {
        if (lay && lay.some((sl) => Math.sign(sl.p[2] - W.z) === sd)) continue;      // rooms on this side: their own walls and doors face the hall
        const gaps = def.ports.filter((q) => Math.abs(q[4]) < 0.7 && Math.sign(q[5]) === sd && Math.abs(q[5]) > 0.7).map((q) => q[0]).sort((u, v) => u - v);
        let x = x0;
        for (const gx of [...gaps, null]) {
          const end = gx === null ? x1 : gx - 0.17, len = end - x;
          if (len > 0.08) {
            const zc = W.z + sd * (HW + 0.007);
            box(len, WH, 0.014, 'wall', x + len / 2, W.y + WH / 2, zc, { noEdges: true }); box(len, 0.008, 0.014, 'locker', x + len / 2, W.y + 0.105, W.z + sd * (HW - 0.012), { noEdges: true });
            for (let lx = x + 0.2; lx < end - 0.1; lx += 0.6) box(0.14, 0.012, 0.004, 'lane', lx, W.y + 0.122, W.z + sd * (HW - 0.001));
          }
          if (gx !== null) x = gx + 0.17;
        }
      }
    }
    for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.5) box(0.22, 0.012, 0.035, 'lane', x, W.y + 0.004, W.z);
  } else if (W && W.k === 'ring') {
    const ys = W.y !== undefined ? [W.y] : [...new Set(lay.map((s) => s.p[1]))];
    const roomR = lay && lay.length ? Math.hypot(lay[0].p[0], lay[0].p[2]) : 0, sd = roomR > W.R ? -1 : 1;      // the wall goes on the side away from the rooms
    for (const y of ys) {
      const n = Math.round(W.R * 5); for (let i = 0; i < n; i++) { const a = i * TAU / n, b = new THREE.BoxGeometry(0.035, 0.012, 0.22); b.rotateY(-a); put(b, 'lane', Math.cos(a) * W.R, y + 0.004, Math.sin(a) * W.R); }
      if (!lay || type === 'reactor') continue;
      put(new THREE.RingGeometry(W.R - HW, W.R + HW, Math.max(32, Math.round(W.R * 10))).rotateX(-Math.PI / 2), 'hall', 0, y + 0.003, 0, { noEdges: true });
      // openings: at the spokes on the inner side, at the side ports on the outer side
      const open = sd < 0 ? (W.spokes || []) : def.ports.filter((q) => Math.abs(q[4]) < 0.7 && Math.hypot(q[0], q[2]) > W.R).map((q) => Math.atan2(q[2], q[0]));
      const wr = W.R + sd * (HW + 0.007), m = Math.max(24, Math.round(wr * 7)), seg = TAU * wr / m;
      for (let i = 0; i < m; i++) {
        const a = (i + 0.5) * TAU / m;
        if (open.some((o) => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) * wr < 0.2 + seg / 2)) continue;
        const wl = new THREE.BoxGeometry(0.014, WH, seg * 1.02); wl.rotateY(-a); put(wl, 'wall', Math.cos(a) * wr, y + WH / 2, Math.sin(a) * wr, { noEdges: true });
        const hr = new THREE.BoxGeometry(0.014, 0.008, seg * 1.02); hr.rotateY(-a); put(hr, 'locker', Math.cos(a) * (wr - sd * 0.02), y + 0.105, Math.sin(a) * (wr - sd * 0.02), { noEdges: true });
        if (i % 3 === 0) { const li = new THREE.BoxGeometry(0.004, 0.012, 0.14); li.rotateY(-a); put(li, 'lane', Math.cos(a) * (wr - sd * 0.008), y + 0.122, Math.sin(a) * (wr - sd * 0.008)); }
      }
    }
    // the walkways along the spokes, from the hub out to the ring walk
    const y0 = W.y !== undefined ? W.y : Math.min(...lay.map((s) => s.p[1]));
    for (const a of W.spokes || []) {
      const r0 = 0.3, r1 = W.R - HW, sp = new THREE.BoxGeometry(r1 - r0, 0.005, HW * 1.6); sp.rotateY(-a);
      if (lay && type !== 'reactor') put(sp, 'hall', Math.cos(a) * (r0 + r1) / 2, y0 + 0.0025, Math.sin(a) * (r0 + r1) / 2, { noEdges: true });
      for (let r = 0.6; r < W.R - 0.2; r += 0.5) { const b = new THREE.BoxGeometry(0.22, 0.012, 0.035); b.rotateY(-a); put(b, 'lane', Math.cos(a) * r, y0 + 0.004, Math.sin(a) * r); }
    }
  } else if (W && W.k === 'shaft' && lay) {
    // A lift stop on every deck (a lit ring and four door frames), and a spiral stair round the lift from each deck to the next.
    // The stair leaves each deck just past the +Z side and climbs away from it, so the ways in to the lift from +Z and −Z stay clear.
    const ys = [...new Set(lay.map((s) => s.p[1]))].sort((a, b) => a - b);
    // the lift tower: square braces up the rails, and on every deck a lobby mat, a lit ring, four door frames and a call post
    for (let y = ys[0] + 0.3; y < ys[ys.length - 1] + 0.3; y += 0.15) for (const [x, z, w, d] of [[0, 0.13, 0.26, 0.01], [0, -0.13, 0.26, 0.01], [0.13, 0, 0.01, 0.26], [-0.13, 0, 0.01, 0.26]]) box(w, 0.01, d, 'inner', x, y, z, { noEdges: true });
    for (const y of ys) { put(new THREE.RingGeometry(0.14, 0.3, 24).rotateX(-Math.PI / 2), 'hall', 0, y + 0.043, 0, { noEdges: true }); for (const [x, z] of [[0.17, 0.17], [-0.17, -0.17]]) { box(0.02, 0.13, 0.02, 'locker', x, y + 0.105, z, { noEdges: true }); box(0.024, 0.03, 0.024, 'lane', x, y + 0.16, z); }
      put(flat(new THREE.TorusGeometry(0.28, 0.012, 4, 20)), 'lane', 0, y + 0.045, 0); for (const [x, z, sx, sz] of [[0, 0.14, 1, 0], [0, -0.14, 1, 0], [0.14, 0, 0, 1], [-0.14, 0, 0, 1]]) {      // a door frame on each side of the lift
      for (const e of [-0.075, 0.075]) box(0.012, 0.25, 0.012, 'inner', x + sx * e, y + 0.165, z + sz * e, { noEdges: true });
      box(sx ? 0.162 : 0.012, 0.012, sz ? 0.162 : 0.012, 'inner', x, y + 0.296, z, { noEdges: true }); box(sx ? 0.1 : 0.014, 0.008, sz ? 0.1 : 0.014, 'lane', x, y + 0.286, z);
    } }
    for (let i = 0; i + 1 < ys.length; i++) {
      const y0 = ys[i] + 0.04, rise = ys[i + 1] - ys[i], n = Math.max(12, Math.round(rise * C.scale.m / 0.24)), a0 = 105 * Math.PI / 180, sweep = Math.PI * 3;
      for (let k = 1; k <= n; k++) { const a = a0 + sweep * k / n, st = new THREE.BoxGeometry(0.105, 0.008, 0.06); st.rotateY(-a); put(st, 'inner', Math.cos(a) * 0.205, y0 + rise * k / n - 0.004, Math.sin(a) * 0.205, { noEdges: true }); if (k % 3 === 0) { const b = new THREE.BoxGeometry(0.006, 0.1, 0.006); put(b, 'inner', Math.cos(a) * 0.255, y0 + rise * k / n + 0.05, Math.sin(a) * 0.255, { noEdges: true }); } }
    }
  }
  // A hatch at every port: a door frame standing on the deck just inside the hull, or a ring in the deck for a port above or below.
  if (W && C.parts[type]) for (const [x, y, z, dx, dy, dz] of C.parts[type].ports) {
    if (Math.abs(dy) > 0.7) { put(flat(new THREE.TorusGeometry(0.2, 0.014, 4, 16)), 'inner', x, y - dy * 0.08, z, { noEdges: true }); put(flat(new THREE.TorusGeometry(0.16, 0.008, 4, 16)), 'lane', x, y - dy * 0.08, z); continue; }
    const a = Math.atan2(dx, dz), fy = floorY(type, y), px = x - dx * 0.12, pz = z - dz * 0.12;
    const hb = (w, h, d, lx, ly, role) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(lx, ly, 0); b.rotateY(a); put(b, role, px, fy, pz, { noEdges: true }); };
    for (const sx of [-1, 1]) { hb(0.03, 0.27, 0.05, sx * 0.125, 0.135, 'inner'); hb(0.07, 0.25, 0.02, sx * 0.175, 0.125, 'inner'); }
    hb(0.28, 0.03, 0.05, 0, 0.285, 'inner'); hb(0.2, 0.006, 0.07, 0, 0.004, 'lane'); hb(0.12, 0.012, 0.055, 0, 0.262, 'lane');
  }
  return bake(g);
}

// ---------------------------------------------------------------- rooms: a floor tile and everything rooms.js planned for it
// Built in the tile's own frame (floor at y = 0, w along X, d along Z). `door` is the side the door is on ('+z', '-z', '+x', '-x'),
// or null for an open deck round a lift. The plan is in metres; here it is shrunk to station units and turned to face the door.
export function buildRoom(room, w, d, door = null, variant = 0) {
  const g = new THREE.Group(), f = new THREE.Group(), m = C.scale.m;
  // fittings and the floor get skin coordinates in metres (one repeat every 2 m), so wood, steel and deck plate are the same size everywhere
  const add = (grp, geom, role, x, y, z) => { geom.translate(x, y, z); const o = new THREE.Mesh(grp === f && !PLAIN.has(role) ? skin(geom, 0.5) : role === 'tile' ? skin(geom, m / 2) : geom); o.userData.role = role; grp.add(o); return o; };
  const tile = add(g, new THREE.BoxGeometry(w * 0.96, 0.04, d * 0.96), 'tile', 0, 0.02, 0);
  tile.userData.room = room;
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(tile.geometry)); e.userData.role = 'tileLine'; g.add(e);
  const side = door === '+x' || door === '-x';
  const plan = roomPlan(room, (side ? d : w) * 0.96 * m, (side ? w : d) * 0.96 * m, door, variant);
  f.rotation.y = TURN[door] ?? 0; f.scale.setScalar(1 / m); f.position.y = 0.04; g.add(f);
  for (const it of plan.items) {
    if (it[0] === 'b') add(f, new THREE.BoxGeometry(it[2], it[3], it[4]), it[1], it[5], it[6], it[7]);
    else if (it[0] === 'c') add(f, new THREE.CylinderGeometry(it[2], it[2], it[3], it[7] || 10), it[1], it[4], it[5], it[6]);
    else if (it[0] === 'cx') add(f, new THREE.CylinderGeometry(it[2], it[2], it[3], 10).rotateZ(Math.PI / 2), it[1], it[4], it[5], it[6]);
    else add(f, new THREE.CylinderGeometry(it[2], it[2], it[3], 10).rotateX(Math.PI / 2), it[1], it[4], it[5], it[6]);
  }
  if (OPEN.has(room) && room !== 'empty') {      // a pad: its markings, and the craft that lives on it
    const a = w * 0.42, b = d * 0.4;
    for (const z of [-b, b]) add(g, new THREE.BoxGeometry(a * 2, 0.008, 0.03), 'lane', 0, 0.044, z);
    for (const x of [-a, a]) add(g, new THREE.BoxGeometry(0.03, 0.008, b * 2), 'lane', x, 0.044, 0);
    for (const x of [-a * 0.6, 0, a * 0.6]) add(g, new THREE.BoxGeometry(0.2, 0.008, 0.03), 'alarm', x, 0.044, 0);
    for (const [x, z] of [[a * 0.85, b * 0.8], [-a * 0.85, b * 0.8]]) { add(g, new THREE.BoxGeometry(0.12, 0.09, 0.08), 'locker', x, 0.085, z); add(g, new THREE.BoxGeometry(0.1, 0.05, 0.06), 'alarm', x, 0.155, z); }
    if (room === 'eaglepad') { const eg = buildEagle(); eg.scale.setScalar(C.shipScale.eagle); eg.position.set(-0.1, 0.045, 0); g.add(eg); add(g, new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8).rotateZ(Math.PI / 2), 'shell', a * 0.85, 0.2, b * 0.8); }
    if (room === 'pelicanpad') { const pg = buildShip('shuttle'); pg.scale.setScalar(C.shipScale.shuttle); pg.position.set(0, 0.32, 0); g.add(pg); }
    if (room === 'fighterbay') for (const z of [-d * 0.2, d * 0.2]) { const c = new THREE.ConeGeometry(0.18, 0.8, 3); c.rotateZ(-Math.PI / 2); add(g, c, 'hull', 0, 0.2, z); }
  }
  return bake(g);
}
// An Eagle on its pad: a wedge of a fuselage, swept wings, twin tails and bombs under the wings. Drawn at C.shipScale.eagle: about 15 m.
export function buildEagle() {
  const g = new THREE.Group();
  const put = (geom, role, x = 0, y = 0, z = 0) => { geom.translate(x, y, z); const m = new THREE.Mesh(geom); m.userData.role = role; g.add(m); return m; };
  const P = (pts, depth, y) => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z))); const e = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); e.rotateX(Math.PI / 2); e.translate(0, y + depth, 0); return e; };
  put(P([[1.3, 0], [0.5, 0.2], [-1.0, 0.24], [-1.15, 0.12], [-1.15, -0.12], [-1.0, -0.24], [0.5, -0.2]], 0.2, 0.12), 'hull');
  for (const s of [1, -1]) {
    put(P([[0.3, s * 0.2], [-0.5, s * 1.05], [-0.95, s * 1.05], [-0.8, s * 0.2]], 0.04, 0.18), 'hull');
    const fin = new THREE.BoxGeometry(0.4, 0.34, 0.03); fin.rotateX(s * -0.3); put(fin, 'hull', -0.95, 0.46, s * 0.2);
    put(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 6).rotateZ(Math.PI / 2), 'shell', -0.45, 0.13, s * 0.55); put(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 6).rotateZ(Math.PI / 2), 'shell', -0.55, 0.13, s * 0.8);
    put(new THREE.BoxGeometry(0.04, 0.12, 0.04), 'locker', 0.3 - 0.9 * (s > 0 ? 1 : 1), 0.06, s * 0.3);
  }
  put(new THREE.BoxGeometry(0.04, 0.12, 0.04), 'locker', 0.8, 0.06, 0);
  put(new THREE.BoxGeometry(0.42, 0.1, 0.2), 'glass', 0.55, 0.36, 0);
  put(new THREE.BoxGeometry(0.06, 0.16, 0.3), 'glow', -1.17, 0.22, 0);
  put(new THREE.BoxGeometry(0.5, 0.05, 0.5), 'trim', -0.2, 0.33, 0);
  return g;
}

// ---------------------------------------------------------------- an EVA suit: a small white figure with a lit visor and a tether light
export function buildSuit() {
  const g = new THREE.Group();
  const put = (geom, role, x = 0, y = 0, z = 0) => { geom.translate(x, y, z); const m = new THREE.Mesh(geom); m.userData.role = role; g.add(m); return m; };
  put(new THREE.BoxGeometry(0.13, 0.22, 0.1), 'suit', 0, 0, 0);
  put(new THREE.SphereGeometry(0.075, 8, 6), 'suit', 0, 0.17, 0);
  put(new THREE.BoxGeometry(0.06, 0.04, 0.02), 'visor', 0, 0.17, 0.06);
  put(new THREE.BoxGeometry(0.1, 0.15, 0.06), 'suit', 0, 0.02, -0.08);
  for (const x of [-0.04, 0.04]) put(new THREE.BoxGeometry(0.04, 0.16, 0.04), 'suit', x, -0.19, 0);
  for (const x of [-0.09, 0.09]) put(new THREE.BoxGeometry(0.035, 0.15, 0.035), 'suit', x, 0.0, 0.02);
  return g;
}

// ---------------------------------------------------------------- people: one small figure per job, about a third of a unit tall.
// Each is a single geometry with its colours baked in, so the view can draw hundreds of them at once. The torso of a resident is
// left white: the view tints it per person.
const tint = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const merge = (list) => {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g)), n = parts.reduce((s, g) => s + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) { const a = new Float32Array(n * 3); let o = 0; for (const g of parts) { a.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(a, 3)); }
  return out;
};
// ---------------------------------------------------------------- people
// A figure is modelled in metres as a 1.8 m person from rounded parts (tapered limbs, a head, hair, hands and shoes), coloured by
// vertex, then shrunk to the 0.33 units the view scales from. Each has a standing pose and a mid-stride pose; the view mirrors the
// stride left and right to make a walk. Residents come in four looks; every job has its own clothes and kit.
export const FIGURES = ['resident', 'resident2', 'resident3', 'resident4', 'hauler', 'engineer', 'officer', 'medic', 'aide', 'scientist', 'gunner', 'trooper', 'pilot'];
const LOOKS = {
  resident: { skin: '#e0b48c', hair: '#3a2a1c', top: '#d9dde0', legs: '#4a4f58' },
  resident2: { skin: '#8d5a3c', hair: '#17120e', top: '#c9744a', legs: '#33415a', style: 'long' },
  resident3: { skin: '#f0c8a4', hair: '#b98a4a', top: '#5f8f7a', legs: '#6a5a48', style: 'bun', skirt: true },
  resident4: { skin: '#b97f58', hair: '#8a8a90', top: '#7a6aa8', legs: '#2e3238', style: 'bald' },
  hauler: { skin: '#c99670', hair: '#2a2019', top: '#3d7fc4', legs: '#27425e', style: 'hat' }, engineer: { skin: '#e0b48c', hair: '#5a3a22', top: '#e0a83a', legs: '#5a4a1e', style: 'hat' },
  officer: { skin: '#a87552', hair: '#17120e', top: '#22242a', legs: '#17181c', style: 'hat' }, medic: { skin: '#f0c8a4', hair: '#7a4a2a', top: '#f2f4ee', legs: '#d8dcd6', shoes: '#e8eaec', style: 'hat' },
  aide: { skin: '#d9a67c', hair: '#2a2019', top: '#6c7a5e', legs: '#3c4438', style: 'hat' }, scientist: { skin: '#8d5a3c', hair: '#17120e', top: '#eef0f4', legs: '#3a3f4a', style: 'bun' },
  gunner: { skin: '#e0b48c', hair: '#3a2a1c', top: '#c7652a', legs: '#b0561f' }, trooper: { skin: '#c99670', hair: '#2a2019', top: '#5d6a4a', legs: '#3f4a34', shoes: '#22261e', style: 'hat' },
  pilot: { skin: '#e0b48c', hair: '#3a2a1c', top: '#6b737e', legs: '#5d646e', style: 'hat' },
};
export function buildFigure(key, pose = 'stand') {
  const L = LOOKS[key] || LOOKS.resident, g = [], sw = pose === 'walk' ? 0.5 : 0, shoes = L.shoes || '#26262a';
  const done = (geo, hex) => { geo.computeVertexNormals(); g.push(tint(geo, hex)); };
  const bx = (w, h, d, x, y, z, hex) => done(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
  const cyl = (rt, rb, h, x, y, z, hex, sz = 1, seg = 8) => done(new THREE.CylinderGeometry(rt, rb, h, seg).scale(1, 1, sz).translate(x, y, z), hex);
  const ball = (r, x, y, z, hex, sx = 1, sy = 1, sz = 1, ws = 8, hs = 6, th = Math.PI) => done(new THREE.SphereGeometry(r, ws, hs, 0, TAU, 0, th).scale(sx, sy, sz).translate(x, y, z), hex);
  // a limb hangs from its joint and swings about X; `end` is something at its far end (a hand, a shoe)
  const limb = (rt, rb, len, px, py, ang, lean, hex, end) => {
    const c = new THREE.CylinderGeometry(rt, rb, len, 6, 1, true); c.translate(0, -len / 2, 0); c.rotateZ(lean); c.rotateX(ang); c.translate(px, py, 0); done(c, hex);
    if (end) { const e = end(); e.translate(0, -len, 0); e.rotateZ(lean); e.rotateX(ang); e.translate(px, py, 0); done(e, end.hex); }
  };
  const shoe = () => new THREE.SphereGeometry(0.075, 6, 4).scale(1, 0.62, 1.75).translate(0, 0.02, 0.05); shoe.hex = shoes;
  const hand = () => new THREE.SphereGeometry(0.05, 6, 4).translate(0, -0.02, 0); hand.hex = L.skin;
  limb(0.088, 0.062, 0.84, -0.1, 0.9, sw, 0, L.legs, shoe); limb(0.088, 0.062, 0.84, 0.1, 0.9, -sw, 0, L.legs, shoe);
  cyl(0.158, 0.15, 0.18, 0, 0.88, 0, L.legs, 0.72);
  cyl(0.2, 0.158, 0.56, 0, 1.16, 0, L.top, 0.62, 10);
  for (const s of [-1, 1]) ball(0.085, s * 0.2, 1.4, 0, L.top, 1, 0.9, 0.9, 6, 4);
  limb(0.056, 0.044, 0.6, -0.235, 1.41, -sw * 0.8, -0.1, L.top, hand); limb(0.056, 0.044, 0.6, 0.235, 1.41, sw * 0.8, 0.1, L.top, hand);
  cyl(0.05, 0.056, 0.1, 0, 1.47, 0, L.skin);
  ball(0.118, 0, 1.63, 0, L.skin, 1, 1.12, 1, 10, 7);
  for (const s of [-1, 1]) bx(0.026, 0.03, 0.02, s * 0.045, 1.65, 0.108, '#1c1a1a');
  if (L.style !== 'bald' && L.style !== 'hat') ball(0.126, 0, 1.655, -0.018, L.hair, 1, 1.1, 1, 10, 5, 1.7);
  if (L.style === 'hat') ball(0.122, 0, 1.63, -0.02, L.hair, 1, 1.1, 1, 8, 4, 2.0);
  if (L.style === 'long') bx(0.2, 0.3, 0.07, 0, 1.5, -0.1, L.hair);
  if (L.style === 'bun') ball(0.06, 0, 1.76, -0.09, L.hair, 1, 1, 1, 6, 4);
  if (L.skirt) cyl(0.16, 0.25, 0.46, 0, 0.7, 0, L.top, 0.78, 10);
  switch (key) {
    case 'hauler': cyl(0.206, 0.166, 0.34, 0, 1.2, 0, '#f5d547', 0.64, 10); cyl(0.208, 0.2, 0.04, 0, 1.2, 0, '#d0d4d8', 0.64, 10); cyl(0.124, 0.124, 0.07, 0, 1.745, 0, '#27425e'); bx(0.17, 0.016, 0.12, 0, 1.715, 0.13, '#27425e'); break;
    case 'engineer': ball(0.136, 0, 1.69, 0, '#f5d547', 1, 0.95, 1.05, 10, 4, Math.PI / 2); cyl(0.16, 0.16, 0.014, 0, 1.692, 0.01, '#f5d547', 1.1, 10); cyl(0.17, 0.168, 0.07, 0, 0.93, 0, '#3a3026', 0.74); bx(0.08, 0.1, 0.06, 0.15, 0.9, 0.06, '#6a4a2a'); bx(0.24, 0.34, 0.12, 0, 1.2, -0.17, '#6a6f74'); break;
    case 'officer': cyl(0.126, 0.118, 0.07, 0, 1.745, 0, '#17181c'); cyl(0.145, 0.132, 0.03, 0, 1.795, 0, '#17181c'); bx(0.17, 0.016, 0.1, 0, 1.715, 0.13, '#17181c'); bx(0.05, 0.03, 0.01, 0, 1.75, 0.123, '#f5d547'); bx(0.4, 0.95, 0.02, 0, 0.98, -0.14, '#a8201a'); cyl(0.172, 0.17, 0.05, 0, 0.94, 0, '#a8201a', 0.74); bx(0.05, 0.05, 0.01, -0.09, 1.3, 0.122, '#f5d547'); break;
    case 'medic': bx(0.03, 0.11, 0.01, 0, 1.25, 0.126, '#e0352b'); bx(0.1, 0.035, 0.01, 0, 1.25, 0.126, '#e0352b'); cyl(0.124, 0.124, 0.06, 0, 1.745, 0, '#5fbf8a'); bx(0.2, 0.16, 0.1, -0.2, 0.92, 0.02, '#e8eaec'); bx(0.03, 0.06, 0.01, -0.2, 0.92, 0.072, '#e0352b'); break;
    case 'aide': for (const s of [-1, 1]) bx(0.1, 0.03, 0.12, s * 0.21, 1.475, 0, '#f5d547'); ball(0.128, 0.015, 1.74, 0, '#3c4438', 1.05, 0.42, 1.05, 8, 4); bx(0.16, 0.22, 0.02, 0.16, 1.05, 0.14, '#e8e2c8'); break;
    case 'scientist': cyl(0.205, 0.215, 0.5, 0, 0.72, -0.01, '#eef0f4', 0.66, 10); bx(0.21, 0.045, 0.03, 0, 1.655, 0.1, '#7fe9e0'); bx(0.05, 0.08, 0.01, 0.1, 1.3, 0.124, '#9a6cff'); break;
    case 'gunner': for (const s of [-1, 1]) { const c = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8).rotateZ(Math.PI / 2).translate(s * 0.125, 1.63, 0); done(c, '#f5d547'); } bx(0.25, 0.02, 0.035, 0, 1.765, 0, '#22262a'); cyl(0.172, 0.17, 0.06, 0, 0.94, 0, '#22262a', 0.74); for (const s of [-1, 1]) bx(0.1, 0.1, 0.03, s * 0.1, 0.5, 0.075, '#22262a'); break;
    case 'trooper': ball(0.142, 0, 1.65, -0.005, '#4c5a3c', 1, 1.06, 1.06, 10, 6, 2.1); bx(0.2, 0.05, 0.04, 0, 1.62, 0.115, '#f5d547'); cyl(0.215, 0.18, 0.36, 0, 1.24, 0, '#3f4a34', 0.72, 10); for (const s of [-1, 1]) { ball(0.1, s * 0.235, 1.43, 0, '#3f4a34', 1, 0.8, 1, 6, 4); bx(0.1, 0.11, 0.03, s * 0.1, 0.5, 0.075, '#3f4a34'); } bx(0.26, 0.36, 0.14, 0, 1.22, -0.19, '#3f4a34'); bx(0.05, 0.09, 0.72, 0.17, 1.05, 0.2, '#1c1e20'); bx(0.04, 0.14, 0.06, 0.17, 0.96, 0.22, '#1c1e20'); break;
    case 'pilot': ball(0.138, 0, 1.65, -0.005, '#e8eaec', 1, 1.06, 1.06, 10, 6, 2.2); bx(0.21, 0.07, 0.05, 0, 1.65, 0.105, '#f5a020'); cyl(0.205, 0.195, 0.12, 0, 1.37, 0, '#f5d547', 0.66, 10); for (const s of [-1, 1]) bx(0.04, 0.4, 0.02, s * 0.09, 1.15, 0.122, '#2a2e34'); bx(0.16, 0.1, 0.08, 0.2, 0.92, 0.04, '#2a2e34'); break;
  }
  return merge(g).scale(0.33 / 1.8, 0.33 / 1.8, 0.33 / 1.8);
}
// A raider: a small dark dart with a hot engine.
export function buildRaider() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 4).rotateZ(-Math.PI / 2)); body.userData.role = 'raider'; g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 2.2).translate(-0.5, 0, 0)); wing.userData.role = 'raider'; g.add(wing);
  const eng = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.5).translate(-1.12, 0, 0)); eng.userData.role = 'raiderGlow'; g.add(eng);
  return g;
}

// ---------------------------------------------------------------- ships. Freighters carry container pods; shuttles are small; warships are long and armoured.
export function buildShip(kind) {
  const g = new THREE.Group();
  const put = (geom, role, x = 0, y = 0, z = 0) => {
    geom.translate(x, y, z);
    const m = new THREE.Mesh(geom); m.userData.role = role; g.add(m);
    if (role === 'hull') { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 30)); e.userData.role = 'line'; g.add(e); }
    return m;
  };
  if (kind === 'shuttle') {
    // A Pelican, after the one in Orbital Fury: a troop bay with a blunt nose, broad wings, twin tail fins, a jet pod under each wing.
    const k = 1.25, P = (pts, depth, y) => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x * k, z * k) : sh.moveTo(x * k, z * k))); const e = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); e.rotateX(Math.PI / 2); e.translate(0, y + depth, 0); return e; };
    put(P([[1, -0.1], [1, 0.1], [0.78, 0.26], [-0.8, 0.24], [-1, 0.12], [-1, -0.12], [-0.8, -0.24], [0.78, -0.26]], 0.42, -0.2), 'hull');
    for (const g of [-1, 1]) {
      put(P([[0.2, g * 0.24], [0.02, g * 0.95], [-0.3, g * 0.95], [-0.36, g * 0.24]], 0.06, 0.12), 'hull');
      const fin = new THREE.BoxGeometry(0.34 * k, 0.4 * k, 0.04); fin.rotateX(g * -0.35); fin.rotateY(g * -0.25); put(fin, 'hull', -0.9 * k, 0.36, g * 0.26 * k);
      put(along(new THREE.CylinderGeometry(0.13 * k, 0.15 * k, 0.62 * k, 10)), 'hull', -0.12 * k, 0.02, g * 0.62 * k);
      put(along(new THREE.CylinderGeometry(0.09 * k, 0.09 * k, 0.05, 10)), 'glow', -0.45 * k, 0.02, g * 0.62 * k);
      put(new THREE.BoxGeometry(0.05, 0.05, 0.05), 'glow', -0.14 * k, 0.2, g * 0.95 * k);
    }
    put(new THREE.BoxGeometry(0.3 * k, 0.16, 0.34 * k), 'glass', 0.74 * k, 0.24, 0);
    put(new THREE.BoxGeometry(0.5 * k, 0.03, 0.4 * k).rotateZ(0.35), 'hull', -1.08 * k, -0.24, 0);
  } else if (kind === 'warship') {
    // After the Super Destroyer in Orbital Fury: a long hull with blue light lines, a bridge fin, and a black drive block astern.
    const prof = new THREE.Shape(); prof.moveTo(4.4, 0); prof.lineTo(3.2, 0.45); prof.lineTo(-2.6, 1.05); prof.lineTo(-2.6, -1.05); prof.lineTo(3.2, -0.45); prof.closePath();
    const hull = new THREE.ExtrudeGeometry(prof, { depth: 0.8, bevelEnabled: false }); hull.rotateX(Math.PI / 2); hull.translate(0, 0.4, 0);
    put(hull, 'hull');
    put(new THREE.BoxGeometry(1.3, 1.5, 2.5), 'dark', -3.2, 0, 0);
    put(new THREE.BoxGeometry(1.6, 0.55, 0.5), 'hull', -1.2, 0.68, 0); put(new THREE.BoxGeometry(0.5, 0.3, 0.52), 'glass', -0.6, 0.72, 0);
    for (const z of [0.8, 0, -0.8]) put(new THREE.BoxGeometry(0.1, 0.5, 0.5), 'blue', -3.88, 0, z);
    for (const s of [1, -1]) { const l = new THREE.BoxGeometry(5.4, 0.05, 0.04); l.rotateY(s * 0.1); put(l, 'blue', 0.4, 0.2, s * 0.76); const l2 = new THREE.BoxGeometry(5.4, 0.05, 0.04); l2.rotateY(s * 0.1); put(l2, 'blue', 0.4, -0.2, s * 0.76); }
    for (const x of [1.6, 0.4, -0.8]) put(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), 'hull', x, -0.5, 0);
  } else {
    put(new THREE.BoxGeometry(4.2, 0.6, 0.7), 'hull', -0.3, 0, 0);
    put(new THREE.BoxGeometry(0.9, 0.9, 1.0), 'hull', 1.9, 0.15, 0);
    for (let i = 0; i < 4; i++) for (const z of [0.75, -0.75]) put(new THREE.BoxGeometry(0.85, 0.8, 0.7), 'pod', -1.9 + i * 0.95, 0, z);
    for (const z of [0.3, -0.3]) put(new THREE.BoxGeometry(0.12, 0.35, 0.35), 'glow', -2.45, 0, z);
  }
  return g;
}

// ---------------------------------------------------------------- line icons for the command grid, as inline SVG (24 x 24)
export function partIcon(type) {
  const s = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">${d}</svg>`;
  switch (type) {
    case 'core': return s('<rect x="8" y="3" width="8" height="18" rx="1"/><path d="M8 8h8M8 16h8"/>');
    case 'longcore': return s('<rect x="9" y="1" width="6" height="22" rx="1"/><path d="M9 6h6M9 12h6M9 18h6M6 9h3M15 15h3"/>');
    case 'junction': return s('<rect x="4" y="8" width="16" height="8" rx="1"/><path d="M12 2v6M12 16v6M1 12h3M20 12h3"/>');
    case 'reactor': return s('<path d="M9 3h6l4 7v4l-4 7H9l-4-7v-4z"/><circle cx="12" cy="12" r="2.5"/>');
    case 'spire': return s('<path d="M7 21h10L13 9h-2zM12 9V2M9 5h6"/>');
    case 'ring': return s('<ellipse cx="12" cy="13" rx="10" ry="5"/><ellipse cx="12" cy="13" rx="6.5" ry="2.8"/><path d="M10 6v10h4V6z"/>');
    case 'bigring': return s('<ellipse cx="12" cy="13" rx="11" ry="4.5"/><path d="M11 6v10h2V6zM12 13l-9 1M12 13l9 1"/>');
    case 'disc': return s('<path d="M2 12q0-3 10-3t10 3-10 3-10-3z"/><path d="M2 12v1.5q0 3 10 3t10-3V12M10 4v5M14 4v5"/>');
    case 'drum': return s('<ellipse cx="12" cy="8" rx="9" ry="3"/><path d="M3 8v7q0 3 9 3t9-3V8"/><path d="M6 12h2M10 12.5h2M14 12.5h2"/>');
    case 'tower': return s('<path d="M8 2h8l2 3v14l-2 3H8l-2-3V5z"/><path d="M9 7h6M9 11h6M9 15h6"/>');
    case 'dome': return s('<path d="M3 17a9 9 0 0 1 18 0zM2 19h20"/><path d="M12 16v-4l-2 2M12 13l2-2"/>');
    case 'blister': return s('<circle cx="14" cy="12" r="7"/><path d="M2 10h5v4H2M10 16h8"/>');
    case 'dockport': return s('<path d="M2 12h3M5 8h11v8H5zM16 6v12M19 6v12"/>');
    case 'pylon': return s('<path d="M2 18h13V5M15 5h-2M15 5h2"/><circle cx="15" cy="3.5" r="1.5"/>');
    case 'hangar': return s('<path d="M2 6h18v12H2zM20 6v12"/><path d="M8 13l4-2 4 2M12 11v4" />');
    case 'drydock': return s('<rect x="2" y="9" width="4" height="6"/><path d="M6 5h16v14H6M10 5v14M14 5v14M18 5v14"/>');
    case 'truss': return s('<path d="M2 8h20M2 16h20M4 8l4 8 4-8 4 8 4-8M4 8v8M20 8v8"/>');
    case 'node': return s('<circle cx="12" cy="12" r="4"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>');
    case 'tube': return s('<rect x="2" y="9" width="20" height="6" rx="3"/><path d="M8 9v6M16 9v6"/>');
    case 'cargo': return s('<rect x="3" y="7" width="18" height="10" rx="4"/><rect x="7" y="10" width="4" height="4"/><rect x="13" y="10" width="4" height="4"/>');
    case 'hab': return s('<rect x="3" y="7" width="18" height="10" rx="4"/><path d="M7 11h2M11 11h2M15 11h2"/>');
    case 'rack': return s('<rect x="3" y="5" width="18" height="14"/><rect x="5" y="7" width="6" height="4"/><rect x="13" y="7" width="6" height="4"/><rect x="5" y="13" width="6" height="4"/>');
    case 'tanks': return s('<path d="M1 12h22"/><circle cx="6" cy="12" r="4"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="12" r="4"/>');
    case 'refinery': return s('<rect x="3" y="10" width="18" height="10"/><path d="M7 10V4h3v6M14 10V6h3v4"/>');
    case 'solar': return s('<path d="M11 12h2M2 6h8v12H2zM14 6h8v12h-8zM6 6v12M18 6v12M2 12h8M14 12h8"/>');
    case 'radiator': return s('<path d="M2 12h6M8 2h12v8H8zM8 14h12v8H8zM8 6h12M8 18h12"/>');
    case 'turret': return s('<path d="M3 16h6v-6H3zM9 11h4l2-2h7M9 14h4l2 1h7"/>');
    case 'shield': return s('<path d="M2 12h8"/><circle cx="15" cy="12" r="3"/><path d="M15 3a9 9 0 0 1 0 18" stroke-dasharray="2 2"/>');
    case 'dish': return s('<path d="M2 12h6M9 4q8 8 0 16M9 12h7"/><circle cx="17" cy="12" r="1"/>');
    case 'gunmount': return s('<rect x="3" y="4" width="18" height="8" rx="1"/><circle cx="12" cy="13" r="3"/><path d="M10.5 15v7M13.5 15v7"/>');
    case 'battery': return s('<rect x="2" y="3" width="20" height="7" rx="1"/><path d="M9 10h6v3H9zM10.5 13v8h3v-8M9 21h6"/>');
    case 'dronebay': return s('<rect x="3" y="4" width="18" height="8" rx="1"/><path d="M6 15h12M7 18l3-1.5-3-1.5zM13 18l3-1.5-3-1.5z"/>');
    case 'relay': return s('<path d="M2 8h8M5 13q7 8 14 0zM12 13v-5M12 19v2"/>');
    case 'barracks': return s('<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 10v4M10 10v4M14 10v4M18 10v4"/>');
    case 'eaglehangar': return s('<path d="M2 6h18v12H2zM20 6v12"/><path d="M15 12l-8-3v2l-2 1 2 1v2z"/>');
    case 'pelicanbay': return s('<path d="M2 6h18v12H2zM20 6v12"/><path d="M6 10h8l2 2-2 2H6zM9 8v8"/>');
    case 'fabshop': return s('<rect x="2" y="8" width="20" height="10" rx="1"/><path d="M6 8V4h3v4M12 11h6v4h-6z"/>');
    case 'lance': return s('<rect x="2" y="2" width="20" height="6" rx="1"/><path d="M9 8h6l-1 14h-4zM8 12h8M8.5 16h7"/>');
    case 'billboard': return s('<path d="M2 12h4M6 4h16v14H6zM9 9h10M9 13h7"/>');
    default: return s('<circle cx="12" cy="12" r="6"/>');
  }
}
