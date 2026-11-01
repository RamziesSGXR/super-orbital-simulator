// Every station part, drawn in code from simple shapes: cylinders, rings, lathed profiles and boxes. No model files.
// A part is a group of pieces, each tagged with a role so the view can restyle them per view mode:
//   hull  - the outer skin (its edges become the blueprint lines)   inner - decks and fittings, seen in the cutaway
//   glow  - windows and lights                                       glass - domes
//   panel - solar cells                                              wire  - thin lattice lines
// Port positions in config.js match these shapes.
import * as THREE from './vendor/three.js';

const TAU = Math.PI * 2;
const V2 = (x, y) => new THREE.Vector2(x, y);
const along = (g) => g.rotateZ(-Math.PI / 2);        // a Y-axis cylinder turned to lie along +X
const flat = (g) => g.rotateX(Math.PI / 2);          // a torus or ring turned to lie in the XZ plane

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
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo); l.userData.role = 'wire'; g.add(l);
  };
  const windows = (n, r, y, w = 0.18, h = 0.14, a0 = 0) => {
    for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n, b = new THREE.BoxGeometry(0.05, h, w); b.rotateY(-a); put(b, 'glow', Math.cos(a) * r, y, Math.sin(a) * r); }
  };
  const decks = (rIn, rOut, ys, seg = 32) => { for (const y of ys) put(new THREE.RingGeometry(rIn, rOut, seg).rotateX(-Math.PI / 2), 'inner', 0, y, 0, { angle: 60 }); };
  const shaft = (h) => put(new THREE.CylinderGeometry(0.25, 0.25, h, 8), 'inner', 0, 0, 0, { angle: 60 });

  switch (type) {
    case 'command': {
      put(new THREE.CylinderGeometry(1.2, 1.2, 3.4, 24), 'hull');
      put(new THREE.CylinderGeometry(1.9, 1.9, 0.6, 24), 'hull', 0, 0.95, 0);
      put(new THREE.CylinderGeometry(1.2, 1.9, 0.45, 24), 'hull', 0, 1.47, 0);
      put(new THREE.CylinderGeometry(1.55, 1.55, 0.3, 24), 'hull', 0, -1.2, 0);
      windows(16, 1.92, 0.95, 0.3, 0.16);
      decks(0.3, 1.12, [-1.0, 0, 0.9]); shaft(3.2);
      break;
    }
    case 'core': {
      put(new THREE.CylinderGeometry(1.2, 1.2, 3, 24), 'hull');
      for (const y of [-1.15, 1.15]) put(flat(new THREE.TorusGeometry(1.24, 0.09, 6, 24)), 'hull', 0, y, 0, { noEdges: true });
      windows(8, 1.22, 0.3, 0.2, 0.12);
      decks(0.3, 1.12, [-0.75, 0.75]); shaft(2.9);
      break;
    }
    case 'reactor': {
      const prof = [V2(1.2, -1.75), V2(1.5, -1.55), V2(2.2, -0.7), V2(2.2, 0.7), V2(1.5, 1.55), V2(1.2, 1.75)];
      put(new THREE.LatheGeometry(prof, 28), 'hull');
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8, b = new THREE.BoxGeometry(0.7, 1.2, 0.08); b.rotateY(-a); put(b, 'hull', Math.cos(a) * 2.45, 0, Math.sin(a) * 2.45, { noEdges: false }); }
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
      decks(0.2, 0.9, [-1.2]);
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
      decks(R - tube * 0.7, R + tube * 0.7, [-tube * 0.35], big ? 96 : 72);
      decks(0.3, 1.2, [0]);
      break;
    }
    case 'disc': {
      const prof = [V2(1.2, -0.8), V2(4.6, -0.8), V2(5.6, -0.25), V2(5.6, 0.25), V2(4.6, 0.8), V2(1.2, 0.8), V2(1.2, -0.8)];
      put(new THREE.LatheGeometry(prof, 48), 'hull', 0, 0, 0, { angle: 20 });
      windows(36, 5.61, 0, 0.26, 0.2);
      decks(1.3, 5.3, [-0.15], 48);
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12, b = new THREE.BoxGeometry(1.8, 0.6, 0.06); b.rotateY(-a); put(b, 'inner', Math.cos(a) * 3.4, 0.15, Math.sin(a) * 3.4, { angle: 60 }); }
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
    case 'dome': {
      put(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 24), 'hull');
      put(new THREE.SphereGeometry(2.1, 20, 8, 0, TAU, 0, Math.PI / 2), 'glass', 0, 0.2, 0, { angle: 10 });
      for (const [x, z, h] of [[0, 0, 1.4], [0.9, 0.5, 1.0], [-0.8, 0.6, 1.1], [0.3, -0.9, 0.9], [-0.7, -0.6, 0.8]]) {
        put(new THREE.ConeGeometry(0.35, h, 6), 'inner', x, 0.25 + h / 2 + 0.2, z, { angle: 60 });
        put(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 4), 'inner', x, 0.35, z, { noEdges: true });
      }
      decks(0.2, 2.0, [0.21], 24);
      break;
    }
    case 'dockport': {
      put(along(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 16)), 'hull', 1.1, 0, 0);
      put(new THREE.TorusGeometry(0.85, 0.13, 6, 20).rotateY(Math.PI / 2), 'hull', 2.2, 0, 0, { noEdges: true });
      for (const [y, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) put(new THREE.BoxGeometry(0.1, 0.12, 0.12), 'glow', 2.32, y, z);
      put(new THREE.BoxGeometry(2.0, 0.05, 0.9), 'inner', 1.1, -0.45, 0, { angle: 60 });
      break;
    }
    case 'pylon': {
      put(new THREE.BoxGeometry(5, 0.7, 0.7), 'hull', 2.5, 0, 0);
      put(new THREE.BoxGeometry(0.9, 0.9, 0.9), 'hull', 5, 0, 0);
      put(new THREE.BoxGeometry(0.6, 4.2, 0.6), 'hull', 5, 2.5, 0);
      put(flat(new THREE.TorusGeometry(0.75, 0.14, 6, 20)), 'hull', 5, 4.7, 0, { noEdges: true });
      for (const y of [1.2, 2.4, 3.6]) put(new THREE.BoxGeometry(0.62, 0.1, 0.62), 'glow', 5, y, 0);
      put(new THREE.SphereGeometry(0.14, 8, 6), 'glow', 5, 5.05, 0);
      break;
    }
    case 'truss': {
      const L = 5, h = 0.4, p = [];
      for (const [y, z] of [[h, h], [h, -h], [-h, h], [-h, -h]]) { p.push(0, y, z, L, y, z); put(new THREE.BoxGeometry(L, 0.09, 0.09), 'hull', L / 2, y, z, { noEdges: true }); }
      for (let x = 0; x <= L + 0.01; x += 1) p.push(x, h, h, x, h, -h, x, h, -h, x, -h, -h, x, -h, -h, x, -h, h, x, -h, h, x, h, h);
      for (let x = 0; x < L - 0.01; x += 1) p.push(x, h, h, x + 1, -h, h, x, h, -h, x + 1, -h, -h, x, h, h, x + 1, h, -h, x, -h, h, x + 1, -h, -h);
      wire(p);
      put(new THREE.BoxGeometry(L, 0.04, 0.5), 'inner', L / 2, -0.3, 0, { angle: 60 });
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
      put(new THREE.BoxGeometry(3.4, 0.05, 1.5), 'inner', 2.4, -0.55, 0, { angle: 60 });
      if (type === 'cargo') {
        for (let i = 0; i < 6; i++) put(new THREE.BoxGeometry(0.5, 0.45, 0.5), 'inner', 1.2 + (i % 3) * 0.6, -0.3 + Math.floor(i / 3) * 0.47, -0.3, { angle: 60 });
        for (const z of [1.01, -1.01]) put(new THREE.BoxGeometry(2.6, 0.08, 0.04), 'glow', 2.4, 0.5, z);
      } else {
        for (let i = 0; i < 6; i++) for (const z of [1.0, -1.0]) put(new THREE.BoxGeometry(0.3, 0.2, 0.04), 'glow', 0.9 + i * 0.6, 0.15, z);
        for (const y of [-0.3, 0.2]) put(new THREE.BoxGeometry(3.0, 0.06, 0.5), 'inner', 2.4, y, 0.55, { angle: 60 });
      }
      break;
    }
    case 'solar': {
      put(along(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8)), 'hull', 0.6, 0, 0, { noEdges: true });
      put(new THREE.BoxGeometry(0.22, 0.22, 1.4), 'hull', 1.2, 0, 0);
      const p = [];
      for (const s of [1, -1]) {
        put(new THREE.BoxGeometry(2.2, 0.06, 5.2), 'panel', 1.2, 0, s * 3.4);
        for (let i = 0; i <= 8; i++) { const z = s * (0.8 + i * 0.65); p.push(0.1, 0.05, z, 2.3, 0.05, z); }
        for (const x of [0.1, 0.65, 1.2, 1.75, 2.3]) p.push(x, 0.05, s * 0.8, x, 0.05, s * 6.0);
      }
      wire(p);
      break;
    }
  }
  return g;
}

// A ship, drawn the same way. Freighters carry container pods; shuttles are small and rounded. The nose points along +X.
export function buildShip(kind) {
  const g = new THREE.Group();
  const put = (geom, role, x = 0, y = 0, z = 0) => {
    geom.translate(x, y, z);
    const m = new THREE.Mesh(geom); m.userData.role = role; g.add(m);
    if (role === 'hull') { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 30)); e.userData.role = 'line'; g.add(e); }
    return m;
  };
  if (kind === 'shuttle') {
    put(along(new THREE.CylinderGeometry(0.15, 0.55, 2.2, 10)), 'hull', 0, 0, 0);
    put(new THREE.BoxGeometry(1.0, 0.08, 1.8), 'hull', -0.4, -0.1, 0);
    put(new THREE.BoxGeometry(0.1, 0.25, 0.5), 'glow', -1.15, 0, 0);
  } else {
    put(new THREE.BoxGeometry(4.2, 0.6, 0.7), 'hull', -0.3, 0, 0);
    put(new THREE.BoxGeometry(0.9, 0.9, 1.0), 'hull', 1.9, 0.15, 0);
    for (let i = 0; i < 4; i++) for (const z of [0.75, -0.75]) put(new THREE.BoxGeometry(0.85, 0.8, 0.7), 'pod', -1.9 + i * 0.95, 0, z);
    for (const z of [0.3, -0.3]) put(new THREE.BoxGeometry(0.12, 0.35, 0.35), 'glow', -2.45, 0, z);
  }
  return g;
}

// Line icons for the command grid, as inline SVG (24 x 24).
export function partIcon(type) {
  const s = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">${d}</svg>`;
  switch (type) {
    case 'core': return s('<rect x="8" y="3" width="8" height="18" rx="1"/><path d="M8 8h8M8 16h8"/>');
    case 'reactor': return s('<path d="M9 3h6l4 7v4l-4 7H9l-4-7v-4z"/><circle cx="12" cy="12" r="2.5"/>');
    case 'spire': return s('<path d="M7 21h10L13 9h-2zM12 9V2M9 5h6"/>');
    case 'ring': return s('<ellipse cx="12" cy="13" rx="10" ry="5"/><ellipse cx="12" cy="13" rx="6.5" ry="2.8"/><path d="M10 6v10h4V6z"/>');
    case 'bigring': return s('<ellipse cx="12" cy="13" rx="11" ry="4.5"/><path d="M11 6v10h2V6zM12 13l-9 1M12 13l9 1"/>');
    case 'disc': return s('<path d="M2 12q0-3 10-3t10 3-10 3-10-3z"/><path d="M2 12v1.5q0 3 10 3t10-3V12M10 4v5M14 4v5"/>');
    case 'drum': return s('<ellipse cx="12" cy="8" rx="9" ry="3"/><path d="M3 8v7q0 3 9 3t9-3V8"/><path d="M6 12h2M10 12.5h2M14 12.5h2"/>');
    case 'dome': return s('<path d="M3 17a9 9 0 0 1 18 0zM2 19h20"/><path d="M12 16v-4l-2 2M12 13l2-2"/>');
    case 'dockport': return s('<path d="M2 12h3M5 8h11v8H5zM16 6v12M19 6v12"/>');
    case 'pylon': return s('<path d="M2 18h13V5M15 5h-2M15 5h2"/><circle cx="15" cy="3.5" r="1.5"/>');
    case 'truss': return s('<path d="M2 8h20M2 16h20M4 8l4 8 4-8 4 8 4-8M4 8v8M20 8v8"/>');
    case 'node': return s('<circle cx="12" cy="12" r="4"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>');
    case 'cargo': return s('<rect x="3" y="7" width="18" height="10" rx="4"/><rect x="7" y="10" width="4" height="4"/><rect x="13" y="10" width="4" height="4"/>');
    case 'hab': return s('<rect x="3" y="7" width="18" height="10" rx="4"/><path d="M7 11h2M11 11h2M15 11h2"/>');
    case 'solar': return s('<path d="M11 12h2M2 6h8v12H2zM14 6h8v12h-8zM6 6v12M18 6v12M2 12h8M14 12h8"/>');
    default: return s('<circle cx="12" cy="12" r="6"/>');
  }
}
