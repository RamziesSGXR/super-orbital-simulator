// Every station part, room and ship, drawn in code from simple shapes: cylinders, rings, lathed profiles and boxes. No model files.
// A part is a group of pieces, each tagged with a role so the view can restyle them per view mode:
//   hull  - the outer skin (its edges become the blueprint lines)   inner - decks and fittings, seen in the cutaway
//   glow  - windows and lights                                       glass - domes and blisters
//   panel - solar cells                                              wire  - thin lattice lines
//   pod   - cargo containers                                         screen - the propaganda screen
// Port positions in config.js and slot positions here match these shapes.
import * as THREE from './vendor/three.js';

const TAU = Math.PI * 2;
const V2 = (x, y) => new THREE.Vector2(x, y);
const along = (g) => g.rotateZ(-Math.PI / 2);        // a Y-axis cylinder turned to lie along +X
const flat = (g) => g.rotateX(Math.PI / 2);          // a torus turned to lie in the XZ plane

// ---------------------------------------------------------------- slots: where each room sits inside a part
// Each slot is a floor tile in the part's own frame: its centre, its turn about Y, and its size (w along its X, d along its Z).
const around = (n, r, y, w, d, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i + 0.5) * TAU / n; return { p: [Math.cos(a) * r, y, Math.sin(a) * r], ry: -Math.PI / 2 - a, w, d }; });
const stack = (ys, w, d = w, x = 0) => ys.map((y) => ({ p: [x, y, 0], ry: 0, w, d }));
const row = (xs, y, w, d) => xs.map((x) => ({ p: [x, y, 0], ry: 0, w, d }));
export const SLOTS = {
  command: stack([-0.98, 0.02, 0.92], 1.5),
  core: stack([-0.73, 0.77], 1.5),
  longcore: stack([-2.23, -0.73, 0.77, 2.27], 1.5),
  junction: stack([0.02], 2.1),
  reactor: [{ p: [1.45, 0.02, 0], ry: 0, w: 1.1, d: 1.6 }],
  hab: row([1.2, 2.4, 3.6], -0.53, 1.1, 1.5),
  cargo: row([1.2, 2.4, 3.6], -0.53, 1.1, 1.5),
  ring: around(12, 7, -0.31, 3.2, 1.25),
  bigring: around(12, 12, -0.19, 5.6, 0.8),
  drum: [...around(4, 3.85, -0.73, 2.6, 1.3, Math.PI / 4 - TAU / 8), ...around(4, 3.85, 0.17, 2.6, 1.3, Math.PI / 4 - TAU / 8)],
  disc: around(8, 3.3, -0.13, 2.1, 1.7),
  tower: stack([-2.88, -1.73, -0.58, 0.62, 1.77, 2.92], 2.1),
  dome: stack([0.23], 2.8),
  blister: [{ p: [1.4, -0.38, 0], ry: 0, w: 1.4, d: 1.4 }],
  hangar: row([1.1, 3.0, 4.9], -1.38, 1.8, 3.4),
  drydock: row([0.55, 1.45], -0.72, 0.85, 2.0),
  refinery: row([1.2, 2.8], -1.08, 1.4, 1.7),
};

export function buildPart(type) {
  const g = new THREE.Group();
  const put = (geom, role, x = 0, y = 0, z = 0, opt = {}) => {
    geom.translate(x, y, z);
    const m = new THREE.Mesh(geom); m.userData.role = role; g.add(m);
    if ((role === 'hull' || role === 'glass' || role === 'inner') && !opt.noEdges) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geom, opt.angle ?? 28)); e.userData.role = role === 'inner' ? 'innerLine' : 'line'; g.add(e);
    }
    return m;
  };
  const wire = (pts) => {
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)));
    l.userData.role = 'wire'; g.add(l);
  };
  const windows = (n, r, y, w = 0.18, h = 0.14, a0 = 0) => {
    for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n, b = new THREE.BoxGeometry(0.05, h, w); b.rotateY(-a); put(b, 'glow', Math.cos(a) * r, y, Math.sin(a) * r); }
  };
  const decks = (rIn, rOut, ys, seg = 32) => { for (const y of ys) put(new THREE.RingGeometry(rIn, rOut, seg).rotateX(-Math.PI / 2), 'inner', 0, y, 0, { angle: 60 }); };
  const shaft = (h) => put(new THREE.CylinderGeometry(0.22, 0.22, h, 8), 'inner', 0, 0, 0, { angle: 60 });
  const box = (w, h, d, role, x, y, z, opt) => put(new THREE.BoxGeometry(w, h, d), role, x, y, z, opt);

  switch (type) {
    case 'command': {
      put(new THREE.CylinderGeometry(1.2, 1.2, 3.4, 24), 'hull');
      put(new THREE.CylinderGeometry(1.9, 1.9, 0.6, 24), 'hull', 0, 0.95, 0);
      put(new THREE.CylinderGeometry(1.2, 1.9, 0.45, 24), 'hull', 0, 1.47, 0);
      put(new THREE.CylinderGeometry(1.55, 1.55, 0.3, 24), 'hull', 0, -1.2, 0);
      windows(16, 1.92, 0.95, 0.3, 0.16);
      shaft(3.2);
      break;
    }
    case 'core': case 'longcore': {
      const h = type === 'core' ? 3 : 6;
      put(new THREE.CylinderGeometry(1.2, 1.2, h, 24), 'hull');
      for (const y of type === 'core' ? [-1.15, 1.15] : [-2.9, -1.5, 0, 1.5, 2.9]) put(flat(new THREE.TorusGeometry(1.24, 0.09, 6, 24)), 'hull', 0, y, 0, { noEdges: true });
      for (const y of type === 'core' ? [0.3] : [-2.0, -0.6, 0.9, 2.3]) windows(8, 1.22, y, 0.2, 0.12);
      shaft(h - 0.1);
      break;
    }
    case 'junction': {
      put(new THREE.CylinderGeometry(1.6, 1.6, 1.6, 12), 'hull', 0, 0, 0, { angle: 20 });
      for (const y of [-0.8, 0.8]) put(flat(new THREE.TorusGeometry(1.6, 0.1, 6, 24)), 'hull', 0, y, 0, { noEdges: true });
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
      put(flat(new THREE.TorusGeometry(1.0, 0.12, 6, 20)), 'hull', 0, -1.0, 0, { noEdges: true });
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
      put(new THREE.TorusGeometry(0.85, 0.13, 6, 20).rotateY(Math.PI / 2), 'hull', 2.2, 0, 0, { noEdges: true });
      for (const [y, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) box(0.1, 0.12, 0.12, 'glow', 2.32, y, z);
      box(2.0, 0.05, 0.9, 'inner', 1.1, -0.45, 0, { angle: 60 });
      break;
    }
    case 'pylon': {
      box(5, 0.7, 0.7, 'hull', 2.5, 0, 0); box(0.9, 0.9, 0.9, 'hull', 5, 0, 0); box(0.6, 4.2, 0.6, 'hull', 5, 2.5, 0);
      put(flat(new THREE.TorusGeometry(0.75, 0.14, 6, 20)), 'hull', 5, 4.7, 0, { noEdges: true });
      for (const y of [1.2, 2.4, 3.6]) box(0.62, 0.1, 0.62, 'glow', 5, y, 0);
      put(new THREE.SphereGeometry(0.14, 8, 6), 'glow', 5, 5.05, 0);
      break;
    }
    case 'hangar': {
      box(6, 0.2, 4, 'hull', 3, -1.5, 0); box(6, 0.2, 4, 'hull', 3, 1.5, 0);
      box(6, 3.2, 0.2, 'hull', 3, 0, 2); box(6, 3.2, 0.2, 'hull', 3, 0, -2); box(0.2, 3.2, 4.2, 'hull', 0.1, 0, 0);
      for (const z of [2.05, -2.05]) for (let i = 0; i < 5; i++) box(0.5, 0.18, 0.04, 'glow', 0.9 + i * 1.1, 0.9, z);
      box(0.25, 0.25, 4.3, 'hull', 6, 1.4, 0); box(0.25, 0.25, 4.3, 'hull', 6, -1.4, 0);
      box(0.08, 0.08, 3.6, 'glow', 6.05, 1.25, 0); box(0.08, 0.08, 3.6, 'glow', 6.05, -1.25, 0);
      break;
    }
    case 'drydock': {
      box(2, 1.8, 2.4, 'hull', 1, 0, 0);
      for (let i = 0; i < 4; i++) box(0.5, 0.18, 0.04, 'glow', 1, 0.45, i < 2 ? 1.22 : -1.22);
      const p = [];
      for (const [y, z] of [[1.6, 1.6], [1.6, -1.6], [-1.6, 1.6], [-1.6, -1.6]]) { box(10, 0.16, 0.16, 'hull', 7, y, z, { noEdges: true }); p.push(2, y, z, 12, y, z); }
      for (let x = 2; x <= 12.01; x += 2.5) {
        p.push(x, 1.6, 1.6, x, 1.6, -1.6, x, 1.6, -1.6, x, -1.6, -1.6, x, -1.6, -1.6, x, -1.6, 1.6, x, -1.6, 1.6, x, 1.6, 1.6);
        for (const [y, z] of [[1.6, 1.6], [1.6, -1.6], [-1.6, 1.6], [-1.6, -1.6]]) put(new THREE.SphereGeometry(0.1, 6, 4), 'glow', x, y, z);
      }
      wire(p);
      box(10, 0.1, 0.5, 'hull', 7, 1.75, 0, { noEdges: true });
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
      for (const x of [0.3, 2, 3.7]) put(new THREE.TorusGeometry(0.53, 0.07, 6, 16).rotateY(Math.PI / 2), 'hull', x, 0, 0, { noEdges: true });
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
      for (const x of [1.2, 2.4, 3.6]) put(new THREE.TorusGeometry(1.04, 0.08, 6, 20).rotateY(Math.PI / 2), 'hull', x, 0, 0, { noEdges: true });
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
        put(flat(new THREE.TorusGeometry(0.87, 0.06, 6, 20)), 'hull', x, 0, 0, { noEdges: true });
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
      put(new THREE.TorusGeometry(0.6, 0.08, 6, 20).rotateY(Math.PI / 2), 'hull', 1.6, 0, 0, { noEdges: true });
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
  return g;
}

// ---------------------------------------------------------------- rooms: a floor tile, and the furniture that says what it is
// Built in the tile's own frame (floor at y = 0, w along X, d along Z). Heights stay under half a unit to fit the thinnest decks.
export function buildRoom(room, w, d) {
  const g = new THREE.Group();
  const put = (geom, role, x = 0, y = 0, z = 0) => { geom.translate(x, y, z); const m = new THREE.Mesh(geom); m.userData.role = role; g.add(m); return m; };
  const box = (bw, bh, bd, role, x, y, z) => put(new THREE.BoxGeometry(bw, bh, bd), role, x, y + bh / 2, z);
  const tile = put(new THREE.BoxGeometry(w * 0.94, 0.04, d * 0.94), 'tile', 0, 0.02, 0);
  tile.userData.room = room;
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(tile.geometry)); e.userData.role = 'tileLine'; g.add(e);
  const W = w * 0.42, D = d * 0.42, s = Math.min(1, Math.min(w, d) / 1.3);
  switch (room) {
    case 'quarters': for (const x of [-W * 0.5, W * 0.5]) { box(0.3 * s, 0.12, 0.6 * s, 'inner', x, 0.04, -D * 0.3); box(0.1, 0.32, 0.18, 'inner', x, 0.04, D * 0.6); } break;
    case 'bunks': for (const x of [-W * 0.6, -W * 0.2, W * 0.2, W * 0.6]) { box(0.22 * s, 0.1, 0.6 * s, 'inner', x, 0.04, 0); box(0.22 * s, 0.1, 0.6 * s, 'inner', x, 0.26, 0); } break;
    case 'mess': box(W * 1.2, 0.04, D * 0.5, 'inner', 0, 0.22, 0); for (const x of [-W * 0.4, W * 0.4]) for (const z of [-D * 0.5, D * 0.5]) put(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 6), 'inner', x, 0.12, z); break;
    case 'lounge': box(W * 1.4, 0.16, 0.25, 'inner', 0, 0.04, -D * 0.6); box(0.06, 0.2, D * 1.4, 'glow', W * 0.95, 0.15, 0); break;
    case 'hydro': for (const x of [-W * 0.6, 0, W * 0.6]) { box(0.3 * s, 0.1, D * 1.5, 'inner', x, 0.04, 0); box(0.24 * s, 0.14, D * 1.4, 'plant', x, 0.14, 0); } break;
    case 'workshop': box(W * 1.2, 0.2, 0.3, 'inner', 0, 0.04, -D * 0.6); box(0.3, 0.25, 0.3, 'inner', W * 0.7, 0.04, D * 0.4); put(new THREE.SphereGeometry(0.05, 6, 4), 'spark', 0, 0.3, -D * 0.6); break;
    case 'cargostore': for (let i = 0; i < 4; i++) box(0.32 * s, 0.3, 0.32 * s, 'crate', (i % 2 ? 1 : -1) * W * 0.45, 0.04 + (i > 1 ? 0.3 : 0), (i > 1 ? 0.1 : -0.1) * D); break;
    case 'ops': for (const x of [-W * 0.6, 0, W * 0.6]) { box(0.3 * s, 0.22, 0.25, 'inner', x, 0.04, -D * 0.4); box(0.26 * s, 0.14, 0.03, 'glow', x, 0.3, -D * 0.4 + 0.13); } break;
    case 'market': for (const x of [-W * 0.6, 0, W * 0.6]) { box(0.3 * s, 0.2, 0.3 * s, 'inner', x, 0.04, 0); box(0.36 * s, 0.03, 0.4 * s, 'awning', x, 0.36, 0.05); } break;
    case 'bar': box(W * 1.5, 0.22, 0.2, 'inner', 0, 0.04, -D * 0.3); for (const x of [-W * 0.5, 0, W * 0.5]) put(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 6), 'inner', x, 0.1, D * 0.3); box(W * 1.2, 0.05, 0.04, 'glow', 0, 0.3, -D * 0.55); break;
    case 'medbay': for (const x of [-W * 0.5, W * 0.5]) box(0.3 * s, 0.16, 0.65 * s, 'inner', x, 0.04, 0); box(0.04, 0.18, 0.06, 'cross', 0, 0.25, -D * 0.7); box(0.04, 0.06, 0.18, 'cross', 0, 0.31, -D * 0.7); break;
    case 'secoffice': box(W * 0.9, 0.2, 0.3, 'inner', 0, 0.04, 0); box(0.05, 0.2, 0.2, 'alarm', W * 0.8, 0.15, -D * 0.6); break;
    case 'truth': box(0.05, 0.3, D * 1.3, 'glow', -W * 0.9, 0.08, 0); box(0.2, 0.2, 0.2, 'inner', W * 0.3, 0.04, 0); break;
    case 'shuttlebay': { box(w * 0.6, 0.01, 0.06, 'glow', 0, 0.04, -D * 0.8); box(w * 0.6, 0.01, 0.06, 'glow', 0, 0.04, D * 0.8); break; }
    case 'fighterbay': for (const z of [-D * 0.45, D * 0.45]) { const f = new THREE.ConeGeometry(0.25, 0.9, 3); f.rotateZ(-Math.PI / 2); put(f, 'inner', 0, 0.2, z); } break;
  }
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
    put(along(new THREE.CylinderGeometry(0.15, 0.55, 2.2, 10)), 'hull');
    put(new THREE.BoxGeometry(1.0, 0.08, 1.8), 'hull', -0.4, -0.1, 0);
    put(new THREE.BoxGeometry(0.1, 0.25, 0.5), 'glow', -1.15, 0, 0);
  } else if (kind === 'warship') {
    const prof = new THREE.Shape(); prof.moveTo(4.2, 0); prof.lineTo(-3, 1.1); prof.lineTo(-3.6, 0.9); prof.lineTo(-3.6, -0.9); prof.lineTo(-3, -1.1); prof.closePath();
    const hull = new THREE.ExtrudeGeometry(prof, { depth: 0.9, bevelEnabled: false }); hull.rotateX(Math.PI / 2); hull.translate(0, 0.45, 0);
    put(hull, 'hull');
    put(new THREE.BoxGeometry(1.4, 0.9, 0.6), 'hull', -1.4, 0.85, 0);
    put(new THREE.BoxGeometry(0.9, 0.5, 2.6), 'hull', -2.8, 0, 0);
    for (const z of [0.7, 0, -0.7]) put(new THREE.BoxGeometry(0.12, 0.35, 0.35), 'glow', -3.65, 0, z);
    for (let i = 0; i < 6; i++) put(new THREE.BoxGeometry(0.25, 0.06, 0.04), 'glow', 1.6 - i * 0.6, 0.6, 0.46);
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
    case 'billboard': return s('<path d="M2 12h4M6 4h16v14H6zM9 9h10M9 13h7"/>');
    default: return s('<circle cx="12" cy="12" r="6"/>');
  }
}
