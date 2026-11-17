// What is inside each room, drawn in METRES. No three.js here: a plan is a list of boxes and cylinders, and a list of spots where
// a person can stand without being inside anything. parts.js turns the plan into geometry; the view stands people on the spots.
//
// A room is furnished the way a real one is: against the walls, with clear floor to walk on.
//   * Fittings come as KITS: a kit is one bay of real things at real sizes (a bed with its bedside table and wardrobe, a galley
//     counter, a treatment bed with its monitor), a few metres wide and at most 2.4 m deep.
//   * Kits stand in ROWS along the back wall, the front wall, and back to back across a deep room, with AISLES between the rows.
//   * A cross lane down the middle joins every aisle to the door (or, on an open deck, to the lift in the middle).
//   * People stand in front of a kit or in an aisle, and walk aisle, cross lane, door. They never cross a kit or a wall.
// The plan's frame: x along the door wall, z from the back wall (−) to the door wall (+), y up from the floor, origin at the centre.

const R = 2.4;                 // the depth of a row of kits
export const OPEN = new Set(['empty', 'shuttlebay', 'pelicanpad', 'eaglepad', 'fighterbay']);      // no walls, no rows

// ---------------------------------------------------------------- furniture, in a kit's own frame
// k.b(w, h, d, role, x, z, y)  a box w wide, h high, d deep, standing at height y; x across the bay, z out from the wall.
// k.c(r, h, role, x, z, y)     an upright cylinder.      k.cx / k.cz: a cylinder lying across the bay / out from the wall, axis at y.
const chair = (k, x, z, back = 1, role = 'locker') => { k.b(0.45, 0.08, 0.45, role, x, z, 0.4); k.b(0.08, 0.4, 0.08, 'dark', x, z); k.b(0.45, 0.45, 0.06, role, x, z + back * 0.22, 0.48); };
const stool = (k, x, z, h = 0.45) => { k.c(0.17, 0.06, 'locker', x, z, h - 0.06); k.c(0.04, h - 0.06, 'dark', x, z); };
const table = (k, x, z, w, d, h = 0.75, role = 'wood') => { k.b(w, 0.05, d, role, x, z, h - 0.05); k.b(Math.min(0.5, w * 0.4), h - 0.05, Math.min(0.5, d * 0.4), 'dark', x, z); };
const bed = (k, x, w = 0.95, role = 'bed') => { k.b(w, 0.32, 2.0, 'wood', x, 1.05); k.b(w - 0.06, 0.16, 1.94, role, x, 1.05, 0.32); k.b(w * 0.62, 0.1, 0.36, 'white', x, 0.3, 0.48); k.b(w, 0.75, 0.06, 'wood', x, 0.04); };
const bunk = (k, x) => {
  for (const y of [0.25, 1.25]) { k.b(0.95, 0.08, 2.0, 'locker', x, 1.05, y); k.b(0.88, 0.14, 1.9, 'bed', x, 1.05, y + 0.08); k.b(0.5, 0.08, 0.32, 'white', x, 0.3, y + 0.22); }
  for (const dx of [-0.45, 0.45]) for (const z of [0.08, 2.02]) k.b(0.06, 1.9, 0.06, 'locker', x + dx, z);
  for (const y of [0.5, 0.8, 1.1]) k.b(0.4, 0.04, 0.04, 'locker', x, 2.06, y);
};
const lockers = (k, x, n = 3, role = 'locker') => { for (let i = 0; i < n; i++) { const lx = x + (i - (n - 1) / 2) * 0.42; k.b(0.4, 1.9, 0.5, role, lx, 0.27); k.b(0.3, 0.04, 0.02, 'dark', lx, 0.53, 1.5); k.b(0.04, 0.12, 0.02, 'steel', lx + 0.12, 0.53, 1.0); } };
const shelves = (k, x, w, rows = 4, fill = ['crate', 'white', 'locker', 'awning']) => {
  k.b(w, 1.95, 0.06, 'locker', x, 0.05); for (const dx of [-w / 2 + 0.03, w / 2 - 0.03]) k.b(0.06, 1.95, 0.45, 'locker', x + dx, 0.25);
  for (let r = 0; r < rows; r++) { const y = 0.1 + r * (1.8 / rows); k.b(w, 0.04, 0.45, 'locker', x, 0.25, y); const n = Math.max(1, Math.floor(w / 0.42)); for (let i = 0; i < n; i++) if ((i + r) % 4 !== 3) k.b(0.32, 1.8 / rows - 0.14, 0.34, fill[(i + r * 2) % fill.length], x + (i - (n - 1) / 2) * (w - 0.2) / n, 0.26, y + 0.04); }
};
const consoleDesk = (k, x, z, w = 1.3, face = -1, glow = 'glow') => {      // face −1: the operator looks at the wall
  k.b(w, 0.72, 0.7, 'inner', x, z); k.b(w, 0.04, 0.74, 'dark', x, z, 0.72);
  k.b(w * 0.8, 0.42, 0.05, 'dark', x, z + face * 0.26, 0.78); k.b(w * 0.74, 0.36, 0.02, glow, x, z + face * 0.225, 0.81); k.b(w * 0.5, 0.02, 0.16, 'steel', x, z - face * 0.12, 0.76);
};
const screen = (k, x, w, h = 0.9, y = 0.95, role = 'glow') => { k.b(w + 0.1, h + 0.1, 0.06, 'dark', x, 0.04, y - 0.05); k.b(w, h, 0.03, role, x, 0.085, y); };
const plant = (k, x, z, h = 1.1) => { k.c(0.2, 0.36, 'white', x, z); k.c(0.06, h - 0.5, 'wood', x, z, 0.36, 6); k.c(0.3, 0.5, 'plant', x, z, h - 0.5, 7); };
const rackUnit = (k, x, w = 0.65, light = 'glow') => { k.b(w, 2.05, 0.65, 'steel', x, 0.35); k.b(w - 0.1, 1.7, 0.03, 'dark', x, 0.69, 0.2); for (let i = 0; i < 5; i++) k.b(w - 0.22, 0.05, 0.02, light, x, 0.71, 0.4 + i * 0.32); };
const crateBox = (k, x, z, s = 0.6, y = 0, role = 'crate') => { k.b(s, s, s, role, x, z, y); k.b(s + 0.02, 0.06, s + 0.02, 'dark', x, z, y + s * 0.45); };
const partition = (k, x, len = 2.1, h = 2.0, role = 'wall') => k.b(0.08, h, len, role, x, len / 2);

// ---------------------------------------------------------------- kits. w and d in metres; use: where people stand (x across the bay,
// or [x, z]); once: only one per room. Unless it says otherwise a person stands 0.45 m in front of the kit.
export const K = {
  // ---- a home
  bedDouble: { w: 3.3, d: 2.2, use: [-0.45], f: (k) => { bed(k, -0.45, 1.5); for (const x of [-1.4, 0.5]) { k.b(0.4, 0.45, 0.4, 'wood', x, 0.25); k.b(0.1, 0.22, 0.1, 'glow', x, 0.2, 0.45); } k.b(0.75, 2.0, 0.6, 'wood', 1.25, 0.32); k.b(0.02, 1.7, 0.02, 'dark', 1.25, 0.63, 0.15); k.b(1.7, 0.02, 0.9, 'carpet', -0.45, 1.7); } },
  bedSingle: { w: 2.0, d: 2.2, use: [-0.3], f: (k) => { bed(k, -0.45, 0.95); k.b(0.4, 0.45, 0.4, 'wood', 0.3, 0.25); k.b(0.1, 0.22, 0.1, 'glow', 0.3, 0.2, 0.45); k.b(0.55, 2.0, 0.6, 'wood', 0.7, 1.0); } },
  wet: { w: 2.2, d: 2.2, once: true, use: [0], f: (k) => {      // a wet room: shower, toilet, basin, behind its own walls
    partition(k, -1.06); partition(k, 1.06); for (const x of [-0.72, 0.72]) k.b(0.6, 2.0, 0.08, 'wall', x, 2.14);
    k.b(0.9, 0.08, 0.9, 'white', -0.55, 0.5); k.b(0.04, 1.9, 0.9, 'glass', -0.08, 0.5); k.b(0.06, 0.3, 0.06, 'steel', -0.55, 0.1, 1.8);
    k.b(0.4, 0.4, 0.55, 'white', 0.62, 0.35); k.b(0.44, 0.5, 0.18, 'white', 0.62, 0.1, 0.3);
    k.b(0.55, 0.12, 0.42, 'white', 0.62, 1.5, 0.78); k.b(0.3, 0.78, 0.3, 'white', 0.62, 1.52); k.b(0.03, 0.6, 0.45, 'glow', 0.99, 1.5, 1.1);
  } },
  kitchen: { w: 3.0, d: 0.75, use: [-0.6, 0.5], f: (k) => {
    k.b(2.3, 0.88, 0.62, 'white', -0.35, 0.33); k.b(2.3, 0.04, 0.66, 'steel', -0.35, 0.34, 0.88);
    k.b(0.5, 0.02, 0.4, 'dark', -1.1, 0.34, 0.92); k.b(0.45, 0.02, 0.42, 'dark', 0.2, 0.34, 0.92); k.b(0.04, 0.3, 0.04, 'steel', -1.1, 0.12, 0.92);
    k.b(0.65, 1.95, 0.68, 'steel', 1.15, 0.36); k.b(0.04, 0.9, 0.03, 'dark', 0.9, 0.72, 0.8);
    k.b(2.3, 0.6, 0.35, 'white', -0.35, 0.19, 1.5); k.b(0.5, 0.36, 0.4, 'steel', -0.45, 0.3, 0.92); k.b(0.3, 0.2, 0.02, 'glow', -0.45, 0.51, 1.0);
  } },
  dining: { w: 2.6, d: 2.2, use: [[1.02, 1.15], [-1.02, 1.15]], f: (k) => { table(k, 0, 1.15, 1.3, 0.85); for (const x of [-0.33, 0.33]) { chair(k, x, 0.5, -1, 'wood'); chair(k, x, 1.8, 1, 'wood'); } k.c(0.1, 0.16, 'glow', 0, 1.15, 0.75); } },
  living: { w: 3.5, d: 2.4, use: [[1.38, 1.2], [-1.38, 1.2]], f: (k) => {
    screen(k, 0, 1.5, 0.85, 0.95); k.b(1.9, 0.4, 0.42, 'wood', 0, 0.25);
    k.b(2.0, 0.42, 0.8, 'sofa', 0, 1.95); k.b(2.0, 0.5, 0.2, 'sofa', 0, 2.26, 0.42); for (const x of [-0.92, 0.92]) k.b(0.16, 0.62, 0.8, 'sofa', x, 1.95);
    k.b(0.9, 0.36, 0.5, 'wood', 0, 1.08); k.b(1.9, 0.02, 1.2, 'carpet', 0, 1.2); plant(k, 1.38, 0.35);
  } },
  desk: { w: 1.6, d: 1.3, f: (k) => { k.b(1.4, 0.05, 0.65, 'wood', 0, 0.36, 0.7); for (const x of [-0.62, 0.62]) k.b(0.06, 0.7, 0.6, 'wood', x, 0.36); k.b(0.6, 0.38, 0.04, 'dark', 0, 0.16, 0.85); k.b(0.54, 0.32, 0.02, 'glow', 0, 0.19, 0.88); chair(k, 0, 0.98, 1); k.b(1.2, 0.04, 0.25, 'wood', 0, 0.14, 1.5); k.b(0.5, 0.2, 0.18, 'awning', -0.2, 0.14, 1.54); } },
  bookshelf: { w: 1.3, d: 0.5, f: (k) => shelves(k, 0, 1.2, 4, ['awning', 'crate', 'bed', 'plant']) },
  plantPot: { w: 0.8, d: 0.65, use: [], f: (k) => plant(k, 0, 0.32, 1.3) },
  // ---- crew
  bunks: { w: 2.4, d: 2.2, use: [0], f: (k) => { bunk(k, -0.65); bunk(k, 0.65); } },
  lockerRow: { w: 1.5, d: 0.6, f: (k) => lockers(k, 0, 3) },
  bench: { w: 1.9, d: 0.55, f: (k) => { k.b(1.7, 0.08, 0.4, 'wood', 0, 0.28, 0.4); for (const x of [-0.7, 0.7]) k.b(0.08, 0.4, 0.36, 'dark', x, 0.28); k.b(1.7, 0.04, 0.3, 'locker', 0, 0.2, 1.6); for (let i = 0; i < 4; i++) k.b(0.26, 0.2, 0.24, 'steel', -0.6 + i * 0.4, 0.2, 1.64); } },
  kitRack: { w: 1.7, d: 0.55, f: (k) => { k.b(1.6, 0.06, 0.4, 'locker', 0, 0.22, 1.7); k.b(1.6, 0.06, 0.3, 'locker', 0, 0.18, 0.5); for (let i = 0; i < 4; i++) { k.b(0.28, 0.24, 0.3, 'craft', -0.6 + i * 0.4, 0.22, 1.76); k.b(0.07, 1.0, 0.1, 'dark', -0.6 + i * 0.4, 0.14, 0.56); k.b(0.3, 0.2, 0.3, 'dark', -0.6 + i * 0.4, 0.25); } } },
  exercise: { w: 2.6, d: 2.0, f: (k) => {      // a treadmill and a resistance frame, as on any station
    k.b(0.8, 0.22, 1.7, 'dark', -0.7, 1.0); k.b(0.66, 0.02, 1.4, 'locker', -0.7, 1.05, 0.22); for (const x of [-1.05, -0.35]) k.b(0.05, 1.1, 0.05, 'steel', x, 0.3, 0.22); k.b(0.76, 0.3, 0.06, 'dark', -0.7, 0.28, 1.25); k.b(0.5, 0.2, 0.02, 'glow', -0.7, 0.32, 1.3);
    for (const x of [0.25, 1.0]) k.b(0.07, 2.0, 0.07, 'steel', x, 0.25); k.b(0.9, 0.07, 0.07, 'steel', 0.62, 0.25, 1.95); k.b(1.0, 0.06, 0.06, 'dark', 0.62, 0.6, 1.3); k.b(0.6, 0.4, 0.9, 'locker', 0.62, 0.75);
  } },
  // ---- the mess
  galley: { w: 4.0, d: 1.9, once: true, use: [-1.2, 0, 1.2], f: (k) => {      // the cooks' side against the wall, a serving counter in front
    k.b(3.8, 0.9, 0.6, 'steel', 0, 0.32); k.b(0.6, 0.5, 0.5, 'steel', -1.4, 0.3, 0.9); k.b(0.4, 0.3, 0.02, 'glow', -1.4, 0.56, 1.0); k.b(0.6, 0.5, 0.5, 'steel', -0.6, 0.3, 0.9); k.b(0.4, 0.3, 0.02, 'glow', -0.6, 0.56, 1.0);
    k.b(0.7, 1.95, 0.68, 'steel', 1.5, 0.36); k.c(0.2, 0.5, 'steel', 0.5, 0.3, 0.9); k.b(3.6, 0.5, 0.35, 'white', 0, 0.19, 1.6);
    k.b(3.8, 1.0, 0.5, 'white', 0, 1.6); k.b(3.8, 0.04, 0.6, 'steel', 0, 1.6, 1.0); for (let i = 0; i < 5; i++) k.b(0.5, 0.03, 0.34, ['glow', 'plant', 'awning', 'crate', 'glow'][i], -1.4 + i * 0.6, 1.6, 1.04); k.b(3.8, 0.04, 0.3, 'glass', 0, 1.6, 1.4);
    k.b(0.4, 0.3, 0.4, 'locker', 1.6, 1.6, 1.04);
  } },
  messTable: { w: 2.3, d: 2.3, use: [0], f: (k) => { k.b(0.8, 0.05, 2.0, 'wood', 0, 1.1, 0.7); for (const z of [0.3, 1.9]) k.b(0.5, 0.7, 0.1, 'dark', 0, z); for (const x of [-0.68, 0.68]) { k.b(0.36, 0.06, 2.0, 'locker', x, 1.1, 0.4); for (const z of [0.3, 1.9]) k.b(0.3, 0.4, 0.08, 'dark', x, z); } for (let i = 0; i < 3; i++) k.b(0.34, 0.03, 0.26, 'steel', (i % 2 ? 0.18 : -0.18), 0.5 + i * 0.6, 0.75); } },
  drinks: { w: 1.3, d: 0.7, f: (k) => { k.b(1.2, 0.9, 0.6, 'steel', 0, 0.32); k.c(0.2, 0.55, 'steel', -0.3, 0.32, 0.9); k.b(0.08, 0.1, 0.1, 'dark', -0.3, 0.56, 1.0); k.b(0.5, 0.7, 0.5, 'white', 0.3, 0.3, 0.9); k.b(0.36, 0.3, 0.02, 'glow', 0.3, 0.56, 1.2); for (let i = 0; i < 3; i++) k.c(0.05, 0.12, 'white', -0.05 + i * 0.12, 0.5, 0.9, 6); } },
  // ---- lounge
  viewSofa: { w: 3.4, d: 2.4, use: [[1.5, 1.2], [-1.5, 1.2]], f: (k) => { k.b(3.2, 1.5, 0.05, 'dark', 0, 0.04, 0.5); k.b(3.0, 1.34, 0.03, 'glass', 0, 0.09, 0.58); k.b(3.0, 0.5, 0.02, 'glow', 0, 0.075, 0.6); k.b(2.2, 0.42, 0.8, 'sofa', 0, 1.95); k.b(2.2, 0.5, 0.2, 'sofa', 0, 2.26, 0.42); for (const x of [-1.02, 1.02]) k.b(0.16, 0.62, 0.8, 'sofa', x, 1.95); k.b(1.0, 0.36, 0.5, 'wood', 0, 1.05); } },
  armchairs: { w: 2.4, d: 1.5, f: (k) => { for (const x of [-0.7, 0.7]) { k.b(0.7, 0.42, 0.7, 'sofa', x, 0.5); k.b(0.7, 0.45, 0.16, 'sofa', x, 0.2, 0.42); } k.c(0.26, 0.5, 'wood', 0, 0.5, 0, 10); k.c(0.08, 0.2, 'glow', 0, 0.5, 0.5, 6); } },
  gameTable: { w: 2.0, d: 2.0, use: [[0, 2.3]], f: (k) => { k.c(0.55, 0.05, 'wood', 0, 1.0, 0.7, 14); k.c(0.1, 0.7, 'dark', 0, 1.0); for (const [x, z] of [[-0.75, 1.0], [0.75, 1.0], [0, 0.3]]) stool(k, x, z); k.b(0.4, 0.02, 0.4, 'plant', 0, 1.0, 0.75); } },
  // ---- hydroponics
  growRack: { w: 1.7, d: 0.8, f: (k) => { for (const x of [-0.78, 0.78]) k.b(0.05, 2.1, 0.6, 'steel', x, 0.4); for (let r = 0; r < 4; r++) { const y = 0.15 + r * 0.5; k.b(1.56, 0.1, 0.6, 'white', 0, 0.4, y); k.b(1.46, 0.2, 0.5, 'plant', 0, 0.4, y + 0.1); k.b(1.5, 0.03, 0.08, 'glow', 0, 0.4, y + 0.42); } } },
  growBed: { w: 2.6, d: 1.5, f: (k) => { k.b(2.4, 0.5, 1.2, 'white', 0, 0.7); k.b(2.3, 0.06, 1.1, 'wood', 0, 0.7, 0.5); for (let i = 0; i < 5; i++) for (const z of [0.4, 1.0]) { k.c(0.03, 0.5, 'wood', -0.96 + i * 0.48, z, 0.56, 5); k.c(0.2, 0.45, 'plant', -0.96 + i * 0.48, z, 0.95, 6); } k.b(2.4, 0.04, 0.1, 'glow', 0, 0.7, 2.0); for (const x of [-1.17, 1.17]) k.b(0.05, 2.0, 0.05, 'steel', x, 0.7); } },
  waterTank: { w: 1.4, d: 1.3, f: (k) => { k.c(0.55, 1.7, 'white', -0.05, 0.65, 0.1, 14); k.c(0.57, 0.08, 'steel', -0.05, 0.65, 1.0, 14); k.b(0.4, 0.5, 0.4, 'steel', 0.45, 1.05); k.b(0.06, 1.2, 0.06, 'steel', 0.45, 0.65, 0.5); k.b(0.2, 0.14, 0.02, 'glow', 0.45, 1.26, 0.3); } },
  seedBench: { w: 1.8, d: 0.75, f: (k) => { table(k, 0, 0.36, 1.6, 0.6, 0.9, 'steel'); for (let i = 0; i < 6; i++) { k.b(0.2, 0.1, 0.2, 'white', -0.62 + i * 0.25, 0.36, 0.9); k.c(0.07, 0.12 + (i % 3) * 0.05, 'plant', -0.62 + i * 0.25, 0.36, 1.0, 5); } k.b(1.5, 0.03, 0.08, 'glow', 0, 0.2, 1.6); } },
  // ---- workshop
  workbench: { w: 2.5, d: 0.8, f: (k) => { k.b(2.3, 0.08, 0.7, 'wood', 0, 0.38, 0.85); for (const x of [-1.05, 1.05]) k.b(0.1, 0.85, 0.6, 'dark', x, 0.38); k.b(2.3, 0.9, 0.04, 'locker', 0, 0.04, 1.05); for (let i = 0; i < 6; i++) k.b(0.06, 0.3 + (i % 3) * 0.1, 0.03, i % 2 ? 'steel' : 'alarm', -0.9 + i * 0.36, 0.08, 1.2); k.b(0.25, 0.2, 0.2, 'steel', -0.8, 0.5, 0.93); k.b(0.5, 0.25, 0.35, 'crate', 0.6, 0.35, 0.93); k.b(0.6, 0.5, 0.5, 'locker', 0, 0.38); } },
  lathe: { w: 2.0, d: 1.3, f: (k) => { k.b(1.7, 0.75, 0.6, 'locker', 0, 0.6); k.b(0.5, 0.5, 0.55, 'steel', -0.58, 0.6, 0.75); k.cx(0.12, 0.9, 'steel', 0.15, 0.6, 1.0); k.b(0.3, 0.3, 0.4, 'steel', 0.68, 0.6, 0.75); k.b(0.3, 0.2, 0.02, 'glow', -0.58, 0.9, 0.95); k.b(0.08, 0.08, 0.08, 'spark', 0.15, 0.6, 1.12); } },
  printer: { w: 1.6, d: 1.4, f: (k) => { for (const [x, z] of [[-0.6, 0.2], [0.6, 0.2], [-0.6, 1.2], [0.6, 1.2]]) k.b(0.07, 1.8, 0.07, 'steel', x, z); k.b(1.3, 0.07, 1.1, 'steel', 0, 0.7, 1.8); k.b(1.2, 0.4, 1.0, 'locker', 0, 0.7); k.b(1.3, 0.05, 0.08, 'dark', 0, 0.7, 1.3); k.b(0.14, 0.2, 0.14, 'glow', 0.1, 0.7, 1.1); k.b(0.5, 0.35, 0.5, 'crate', 0, 0.7, 0.4); } },
  partsBins: { w: 1.6, d: 0.55, f: (k) => shelves(k, 0, 1.5, 5, ['steel', 'crate', 'locker', 'alarm']) },
  weldBay: { w: 2.0, d: 1.5, f: (k) => { table(k, -0.2, 0.7, 1.2, 0.8, 0.85, 'steel'); k.b(0.4, 0.1, 0.3, 'dark', -0.2, 0.7, 0.85); k.b(0.07, 0.07, 0.07, 'spark', -0.1, 0.7, 0.98); for (const x of [0.65, 0.88]) { k.c(0.11, 1.3, x > 0.7 ? 'alarm' : 'steel', x, 0.25, 0, 8); k.c(0.04, 0.12, 'dark', x, 0.25, 1.3, 6); } k.b(0.06, 1.9, 1.3, 'dark', -0.96, 0.7); } },
  suitRack: { w: 1.9, d: 0.9, f: (k) => { k.b(1.8, 2.1, 0.06, 'locker', 0, 0.05); for (const x of [-0.5, 0.5]) { k.b(0.6, 0.75, 0.42, 'white', x, 0.4, 0.75); k.b(0.44, 0.75, 0.3, 'white', x, 0.4); k.b(0.4, 0.4, 0.4, 'white', x, 0.4, 1.5); k.b(0.3, 0.2, 0.03, 'glow', x, 0.61, 1.62); k.b(0.5, 0.6, 0.25, 'steel', x, 0.18, 0.85); } } },
  // ---- cargo
  palletRack: { w: 2.8, d: 1.2, f: (k) => { for (const x of [-1.3, 0, 1.3]) for (const z of [0.15, 1.05]) k.b(0.09, 2.3, 0.09, 'alarm', x, z); for (let r = 0; r < 3; r++) { const y = 0.05 + r * 0.78; if (r) k.b(2.7, 0.07, 1.0, 'locker', 0, 0.6, y - 0.07); for (const x of [-0.65, 0.65]) if ((r + (x > 0 ? 1 : 0)) % 3 !== 2) { crateBox(k, x - 0.28, 0.6, 0.5, y); crateBox(k, x + 0.28, 0.6, 0.5, y, r % 2 ? 'steel' : 'crate'); } } } },
  floorStack: { w: 1.9, d: 1.5, f: (k) => { crateBox(k, -0.45, 0.45, 0.8); crateBox(k, 0.45, 0.45, 0.8, 0, 'steel'); crateBox(k, -0.45, 1.05, 0.6); crateBox(k, -0.4, 0.45, 0.6, 0.8); crateBox(k, 0.5, 1.1, 0.5, 0, 'white'); } },
  barrels: { w: 1.8, d: 1.1, f: (k) => { for (const [x, z, r] of [[-0.4, 0.35, 'steel'], [0.25, 0.35, 'alarm'], [-0.1, 0.8, 'steel'], [0.55, 0.8, 'white']]) { k.c(0.29, 0.9, r, x, z, 0, 10); k.c(0.3, 0.05, 'dark', x, z, 0.3, 10); k.c(0.3, 0.05, 'dark', x, z, 0.62, 10); } } },
  loader: { w: 1.8, d: 2.0, f: (k) => { k.b(1.0, 0.5, 1.2, 'alarm', 0, 0.75, 0.15); k.b(0.9, 0.5, 0.5, 'dark', 0, 0.5, 0.65); for (const x of [-0.5, 0.5]) for (const z of [0.35, 1.15]) k.cx(0.2, 0.14, 'dark', x, z, 0.2); for (const x of [-0.3, 0.3]) { k.b(0.07, 1.7, 0.07, 'steel', x, 1.38); k.b(0.1, 0.05, 0.6, 'steel', x, 1.7, 0.1); } k.b(0.2, 0.2, 0.05, 'glow', 0, 0.2, 0.9); } },
  // ---- control rooms
  opsBay: { w: 2.8, d: 2.2, use: [0], f: (k) => { screen(k, 0, 2.3, 1.1, 1.0); consoleDesk(k, -0.68, 1.35, 1.25); consoleDesk(k, 0.68, 1.35, 1.25); chair(k, -0.68, 1.95, 1); chair(k, 0.68, 1.95, 1); } },
  holoTable: { w: 2.6, d: 2.3, use: [[0, 2.45], [1.05, 1.15], [-1.05, 1.15]], f: (k) => { k.c(0.75, 0.8, 'dark', 0, 1.15, 0, 16); k.c(0.68, 0.03, 'glow', 0, 1.15, 0.8, 16); k.c(0.5, 0.6, 'glass', 0, 1.15, 0.84, 12); k.c(0.2, 0.3, 'glow', 0, 1.15, 0.95, 5); } },
  servers: { w: 1.5, d: 0.75, f: (k) => { rackUnit(k, -0.35, 0.65, 'blue'); rackUnit(k, 0.35, 0.65, 'blue'); } },
  sideConsole: { w: 1.5, d: 1.4, f: (k) => { consoleDesk(k, 0, 0.4, 1.3); chair(k, 0, 1.05, 1); } },
  // ---- market
  stall: { w: 2.6, d: 1.7, use: [-0.5, 0.5], f: (k) => { k.b(2.2, 0.9, 0.6, 'wood', 0, 1.3); for (const x of [-1.1, 1.1]) for (const z of [0.15, 1.55]) k.b(0.06, 2.2, 0.06, 'steel', x, z); k.b(2.4, 0.06, 1.7, 'awning', 0, 0.85, 2.2); k.b(2.4, 0.3, 0.04, 'awning', 0, 1.7, 1.94); for (let i = 0; i < 5; i++) k.b(0.34, 0.16, 0.4, ['plant', 'crate', 'glow', 'white', 'alarm'][i], -0.84 + i * 0.42, 1.3, 0.9); shelves(k, 0, 2.0, 3, ['crate', 'plant', 'white', 'awning']); } },
  vending: { w: 1.1, d: 0.8, f: (k) => { k.b(0.95, 1.9, 0.7, 'steel', 0, 0.37); k.b(0.6, 1.1, 0.02, 'glow', -0.12, 0.73, 0.6); k.b(0.2, 0.5, 0.02, 'dark', 0.32, 0.73, 1.0); k.b(0.6, 0.2, 0.02, 'dark', -0.12, 0.73, 0.2); } },
  noodleBar: { w: 2.8, d: 1.9, use: [-0.8, 0, 0.8], f: (k) => { k.b(2.6, 0.9, 0.5, 'steel', 0, 0.28); k.c(0.22, 0.4, 'steel', -0.8, 0.28, 0.9); k.c(0.22, 0.4, 'steel', -0.2, 0.28, 0.9); k.b(2.6, 0.5, 0.04, 'awning', 0, 0.04, 1.7); k.b(2.2, 0.3, 0.02, 'glow', 0, 0.07, 1.8); k.b(2.6, 1.05, 0.4, 'wood', 0, 1.2); for (let i = 0; i < 4; i++) { stool(k, -0.9 + i * 0.6, 1.65, 0.7); k.c(0.1, 0.07, 'white', -0.9 + i * 0.6, 1.2, 1.05, 8); } } },
  // ---- the Liberty Lounge
  barCounter: { w: 3.8, d: 2.0, once: true, use: [-1.2, 0, 1.2], f: (k) => {
    k.b(3.6, 2.0, 0.35, 'locker', 0, 0.2); for (let r = 0; r < 3; r++) { k.b(3.4, 0.03, 0.3, 'glow', 0, 0.25, 0.95 + r * 0.35); for (let i = 0; i < 14; i++) k.c(0.04, 0.22, ['plant', 'awning', 'crate', 'glass', 'white'][(i + r) % 5], -1.56 + i * 0.24, 0.3, 0.98 + r * 0.35, 5); }
    k.b(3.6, 1.05, 0.5, 'wood', 0, 1.3); k.b(3.7, 0.05, 0.6, 'dark', 0, 1.3, 1.05); for (const x of [-0.9, -0.7, 0.8]) { k.b(0.06, 0.3, 0.06, 'steel', x, 1.2, 1.1); } k.b(3.6, 0.08, 0.08, 'steel', 0, 1.58, 0.2);
    for (let i = 0; i < 6; i++) stool(k, -1.5 + i * 0.6, 1.82, 0.72);
  } },
  booth: { w: 2.4, d: 2.0, use: [0], f: (k) => { for (const x of [-0.82, 0.82]) { k.b(0.5, 0.45, 1.6, 'sofa', x, 0.9); k.b(0.14, 1.1, 1.6, 'sofa', x + Math.sign(x) * 0.25, 0.9); } table(k, 0, 0.9, 0.75, 1.3); k.c(0.08, 0.14, 'glow', 0, 0.9, 0.75, 6); k.b(2.2, 1.1, 0.1, 'wood', 0, 0.05); } },
  arcade: { w: 1.0, d: 1.0, f: (k) => { k.b(0.75, 1.7, 0.7, 'dark', 0, 0.4); k.b(0.6, 0.45, 0.02, 'glow', 0, 0.76, 1.1); k.b(0.7, 0.1, 0.3, 'awning', 0, 0.8, 0.9); } },
  kegs: { w: 1.4, d: 0.9, f: (k) => { for (const [x, y] of [[-0.35, 0.3], [0.35, 0.3], [0, 0.85]]) k.cz(0.3, 0.75, 'steel', x, 0.45, y); k.b(1.3, 0.06, 0.8, 'wood', 0, 0.45); } },
  // ---- medbay
  treatBed: { w: 2.6, d: 2.3, use: [0.75], f: (k) => { k.b(0.95, 0.55, 2.0, 'steel', -0.3, 1.1); k.b(0.9, 0.14, 1.95, 'white', -0.3, 1.1, 0.55); k.b(0.6, 0.1, 0.4, 'bed', -0.3, 0.35, 0.69); k.b(0.9, 0.06, 1.1, 'bed', -0.3, 1.5, 0.69); k.b(0.06, 1.5, 0.06, 'steel', 0.45, 0.3); k.b(0.45, 0.35, 0.08, 'dark', 0.45, 0.3, 1.2); k.b(0.38, 0.28, 0.02, 'glow', 0.45, 0.35, 1.24); k.b(0.04, 1.9, 0.04, 'steel', -0.95, 0.3); k.c(0.07, 0.2, 'glass', -0.95, 0.3, 1.6, 6); k.b(0.05, 1.9, 2.0, 'white', 1.24, 1.05); } },
  autoDoc: { w: 2.8, d: 1.5, f: (k) => { k.b(2.4, 0.6, 1.0, 'white', 0, 0.75); k.cx(0.48, 2.2, 'glass', 0, 0.75, 0.75); k.b(2.1, 0.08, 0.7, 'bed', 0, 0.75, 0.6); k.b(0.3, 1.5, 0.5, 'steel', -1.2, 0.3); k.b(0.02, 0.3, 0.3, 'glow', -1.04, 0.3, 1.0); k.b(2.2, 0.05, 0.05, 'glow', 0, 1.26, 0.62); } },
  medCabinet: { w: 1.5, d: 0.55, f: (k) => { k.b(1.4, 1.95, 0.45, 'white', 0, 0.25); k.b(0.02, 1.7, 0.02, 'steel', 0, 0.48, 0.1); k.b(0.12, 0.4, 0.02, 'cross', -0.35, 0.48, 1.2); k.b(0.4, 0.12, 0.02, 'cross', -0.35, 0.48, 1.34); k.b(0.5, 0.5, 0.02, 'glass', 0.35, 0.48, 1.1); } },
  scanner: { w: 2.0, d: 1.6, use: [[0, 2.05]], f: (k) => { for (const x of [-0.7, 0.7]) k.b(0.3, 2.1, 0.9, 'white', x, 0.8); k.b(1.7, 0.3, 0.9, 'white', 0, 0.8, 2.1); for (const x of [-0.54, 0.54]) k.b(0.02, 1.8, 0.6, 'glow', x, 0.8, 0.15); k.b(1.0, 0.04, 0.8, 'dark', 0, 0.8); } },
  reception: { w: 2.0, d: 1.5, once: true, f: (k) => { k.b(1.8, 1.05, 0.5, 'white', 0, 1.2); k.b(1.8, 0.04, 0.6, 'steel', 0, 1.2, 1.05); k.b(0.5, 0.3, 0.04, 'dark', 0.4, 1.05, 1.09); chair(k, 0, 0.6, -1); k.b(0.3, 0.5, 0.02, 'cross', -0.6, 1.46, 0.3); k.b(0.6, 0.2, 0.02, 'cross', -0.6, 1.46, 0.45); } },
  basin: { w: 1.0, d: 0.6, f: (k) => { k.b(0.8, 0.85, 0.5, 'steel', 0, 0.28); k.b(0.5, 0.04, 0.34, 'white', 0, 0.3, 0.85); k.b(0.04, 0.3, 0.04, 'steel', 0, 0.1, 0.85); k.b(0.6, 0.6, 0.03, 'glass', 0, 0.05, 1.2); } },
  // ---- security
  dutyDesk: { w: 2.2, d: 1.5, once: true, f: (k) => { k.b(2.0, 0.75, 0.7, 'locker', 0, 1.1); k.b(2.0, 0.05, 0.76, 'dark', 0, 1.1, 0.75); for (const x of [-0.5, 0.3]) { k.b(0.55, 0.35, 0.04, 'dark', x, 0.95, 0.85); k.b(0.5, 0.3, 0.02, 'glow', x, 0.925, 0.875); } chair(k, 0, 0.5, -1, 'dark'); k.c(0.07, 0.25, 'alarm', 0.85, 1.1, 0.8, 6); } },
  cell: { w: 2.6, d: 2.3, use: [[0, 2.75]], f: (k) => {
    for (let x = -1.2; x <= 1.21; x += 0.2) if (Math.abs(x) > 0.42) k.b(0.045, 2.2, 0.045, 'locker', x, 2.2);
    for (let z = 0.2; z < 2.2; z += 0.2) for (const x of [-1.2, 1.2]) k.b(0.045, 2.2, 0.045, 'locker', x, z);
    k.b(2.45, 0.06, 0.06, 'locker', 0, 2.2, 2.2); for (const x of [-1.2, 1.2]) k.b(0.06, 0.06, 2.2, 'locker', x, 1.1, 2.2); k.b(0.84, 0.06, 0.06, 'alarm', 0, 2.2, 2.05);
    k.b(1.9, 0.08, 0.6, 'steel', -0.2, 0.34, 0.42); k.b(0.3, 0.42, 0.5, 'dark', -0.9, 0.34); k.b(0.3, 0.42, 0.5, 'dark', 0.5, 0.34); k.b(0.4, 0.4, 0.5, 'steel', 0.95, 0.5);
  } },
  gunLocker: { w: 1.5, d: 0.55, f: (k) => { k.b(1.4, 1.95, 0.45, 'dark', 0, 0.25); k.b(1.4, 0.1, 0.02, 'alarm', 0, 0.48, 1.6); for (let i = 0; i < 5; i++) k.b(0.05, 0.9, 0.02, 'steel', -0.48 + i * 0.24, 0.48, 0.5); k.b(0.14, 0.14, 0.03, 'glow', 0.55, 0.48, 1.1); } },
  monitorWall: { w: 2.6, d: 1.5, f: (k) => { for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { k.b(0.56, 0.4, 0.05, 'dark', -0.9 + i * 0.6, 0.05, 1.05 + r * 0.46); k.b(0.5, 0.34, 0.02, (i + r) % 3 ? 'glow' : 'blue', -0.9 + i * 0.6, 0.085, 1.08 + r * 0.46); } consoleDesk(k, 0, 0.75, 2.2); } },
  // ---- the Ministry of Truth
  studio: { w: 3.4, d: 2.4, once: true, use: [[1.45, 2.0], [-1.45, 2.0]], f: (k) => {
    screen(k, 0, 2.8, 1.5, 0.5, 'screen'); k.b(2.0, 0.8, 0.55, 'white', 0, 0.85); k.b(2.1, 0.05, 0.65, 'trim', 0, 0.85, 0.8); k.b(0.6, 0.02, 0.5, 'trim', 0, 1.13, 0.2);
    for (const x of [-1.4, 1.4]) { k.b(0.06, 1.9, 0.06, 'steel', x, 1.3); k.b(0.4, 0.3, 0.2, 'dark', x, 1.25, 1.75); k.b(0.34, 0.24, 0.02, 'glow', x, 1.14, 1.78); }
    k.b(0.05, 1.3, 0.05, 'steel', 0, 2.05); for (const [x, z] of [[-0.25, 2.25], [0.25, 2.25], [0, 1.8]]) k.b(0.04, 0.5, 0.04, 'steel', x, z); k.b(0.3, 0.3, 0.5, 'dark', 0, 2.0, 1.3); k.c(0.1, 0.1, 'glass', 0, 1.72, 1.4, 8);
  } },
  posters: { w: 1.8, d: 0.6, f: (k) => { k.b(1.7, 1.3, 0.05, 'dark', 0, 0.04, 0.6); for (let i = 0; i < 3; i++) { k.b(0.5, 0.75, 0.02, ['trim', 'awning', 'alarm'][i], -0.56 + i * 0.56, 0.08, 0.9); k.b(0.3, 0.3, 0.02, 'white', -0.56 + i * 0.56, 0.095, 1.25); } k.b(1.4, 0.5, 0.5, 'wood', 0, 0.3); for (let i = 0; i < 4; i++) k.b(0.3, 0.06, 0.4, i % 2 ? 'white' : 'trim', -0.5 + i * 0.33, 0.3, 0.5 + (i % 2) * 0.06); } },
  votingBooth: { w: 1.4, d: 1.3, use: [[0, 1.75]], f: (k) => { for (const x of [-0.6, 0.6]) k.b(0.06, 2.0, 1.1, 'wall', x, 0.6); k.b(1.26, 2.0, 0.06, 'wall', 0, 0.06); k.b(0.6, 1.4, 0.03, 'carpet', -0.3, 1.14, 0.6); k.b(0.7, 0.9, 0.4, 'white', 0, 0.3); k.b(0.3, 0.02, 0.06, 'dark', 0, 0.3, 0.9); k.b(0.5, 0.25, 0.02, 'trim', 0, 0.1, 1.5); } },
  // ---- the brass suite
  bigDesk: { w: 3.2, d: 2.3, once: true, use: [[0, 2.75]], f: (k) => {
    k.b(3.0, 0.02, 2.1, 'carpet', 0, 1.15); k.b(2.0, 0.78, 0.9, 'wood', 0, 1.3); k.b(2.1, 0.04, 1.0, 'dark', 0, 1.3, 0.78); k.b(0.6, 0.5, 0.6, 'sofa', 0, 0.6); k.b(0.6, 0.7, 0.14, 'sofa', 0, 0.3, 0.5); k.b(0.5, 0.3, 0.04, 'glow', 0.5, 1.2, 0.84); k.c(0.08, 0.3, 'trim', -0.7, 1.3, 0.82, 6);
    for (const x of [-1.3, 1.3]) { k.c(0.03, 2.2, 'steel', x, 0.2, 0, 6); k.b(0.5, 0.8, 0.03, x < 0 ? 'trim' : 'awning', x - Math.sign(x) * 0.27, 0.2, 1.3); k.c(0.14, 0.06, 'dark', x, 0.2, 0, 8); }
    k.b(1.0, 0.7, 0.03, 'trim', 0, 0.05, 1.3);
  } },
  conference: { w: 3.6, d: 2.3, use: [[1.55, 1.15], [-1.55, 1.15]], f: (k) => { k.b(2.4, 0.06, 1.0, 'wood', 0, 1.15, 0.7); for (const x of [-0.8, 0.8]) k.b(0.3, 0.7, 0.5, 'dark', x, 1.15); for (const x of [-0.8, 0, 0.8]) { chair(k, x, 0.42, -1, 'sofa'); chair(k, x, 1.88, 1, 'sofa'); } k.c(0.25, 0.04, 'glow', 0, 1.15, 0.76, 10); } },
  drinksCabinet: { w: 1.3, d: 0.55, f: (k) => { k.b(1.2, 1.0, 0.45, 'wood', 0, 0.25); k.b(1.1, 0.7, 0.3, 'glass', 0, 0.2, 1.0); for (let i = 0; i < 5; i++) k.c(0.045, 0.28, ['crate', 'plant', 'white', 'awning', 'glass'][i], -0.4 + i * 0.2, 0.22, 1.02, 5); k.b(1.2, 0.04, 0.4, 'wood', 0, 0.22, 1.7); } },
  trophies: { w: 1.5, d: 0.55, f: (k) => { k.b(1.4, 0.9, 0.45, 'wood', 0, 0.25); k.b(1.3, 0.9, 0.38, 'glass', 0, 0.25, 0.9); for (let i = 0; i < 3; i++) { k.c(0.07, 0.3, 'shell', -0.42 + i * 0.42, 0.25, 0.95, 6); k.b(0.2, 0.05, 0.2, 'dark', -0.42 + i * 0.42, 0.25, 0.9); } k.b(1.1, 0.5, 0.03, 'trim', 0, 0.05, 1.95 - 0.5); } },
  // ---- the laboratory
  labBench: { w: 2.6, d: 0.85, f: (k) => { k.b(2.4, 0.86, 0.7, 'white', 0, 0.38); k.b(2.4, 0.04, 0.74, 'dark', 0, 0.38, 0.86); k.b(0.2, 0.36, 0.26, 'dark', -0.9, 0.4, 0.9); k.b(0.12, 0.1, 0.12, 'glow', -0.9, 0.48, 1.0); for (let i = 0; i < 5; i++) k.c(0.035, 0.16, ['glow', 'blue', 'plant', 'awning', 'glow'][i], -0.4 + i * 0.1, 0.3, 0.9, 5); k.c(0.1, 0.2, 'glass', 0.3, 0.4, 0.9, 8); k.b(0.5, 0.34, 0.4, 'steel', 0.85, 0.38, 0.9); k.b(0.3, 0.14, 0.02, 'blue', 0.85, 0.59, 1.0); k.b(2.4, 0.04, 0.3, 'steel', 0, 0.18, 1.55); } },
  gloveBox: { w: 1.8, d: 1.0, f: (k) => { k.b(1.6, 0.85, 0.8, 'steel', 0, 0.45); k.b(1.5, 0.75, 0.7, 'glass', 0, 0.45, 0.85); k.b(1.6, 0.06, 0.8, 'steel', 0, 0.45, 1.6); for (const x of [-0.35, 0.35]) k.cz(0.11, 0.1, 'dark', x, 0.82, 1.15); k.b(0.3, 0.2, 0.2, 'glow', 0, 0.45, 0.9); } },
  specimenTank: { w: 1.4, d: 1.3, f: (k) => { k.c(0.5, 0.3, 'steel', 0, 0.65, 0, 14); k.c(0.45, 1.5, 'glass', 0, 0.65, 0.3, 14); k.c(0.5, 0.2, 'steel', 0, 0.65, 1.8, 14); k.c(0.16, 0.7, 'blue', 0, 0.65, 0.6, 6); k.c(0.4, 0.04, 'glow', 0, 0.65, 0.3, 12); } },
  centrifuge: { w: 1.1, d: 0.9, f: (k) => { k.b(0.9, 0.8, 0.75, 'white', 0, 0.42); k.c(0.34, 0.2, 'steel', 0, 0.42, 0.8, 12); k.b(0.3, 0.1, 0.02, 'glow', 0, 0.8, 0.5); } },
  whiteboard: { w: 2.2, d: 0.3, f: (k) => { k.b(2.0, 1.1, 0.04, 'white', 0, 0.04, 0.8); for (let i = 0; i < 5; i++) k.b(0.5 + (i % 3) * 0.3, 0.03, 0.01, i % 2 ? 'blue' : 'alarm', -0.4 + (i % 2) * 0.3, 0.065, 1.0 + i * 0.16); k.b(2.0, 0.04, 0.1, 'steel', 0, 0.08, 0.76); } },
  // ---- gun crews
  fireControl: { w: 3.0, d: 2.3, once: true, use: [0], f: (k) => { screen(k, 0, 2.6, 1.2, 1.0, 'alarm'); k.b(2.4, 1.0, 0.02, 'dark', 0, 0.1, 1.1); k.cz(0.3, 0.02, 'glow', -0.6, 0.11, 1.4); k.b(1.0, 0.04, 0.02, 'glow', 0.5, 0.11, 1.8); k.b(1.0, 0.04, 0.02, 'glow', 0.5, 0.11, 1.5); consoleDesk(k, -0.72, 1.4, 1.3, -1, 'alarm'); consoleDesk(k, 0.72, 1.4, 1.3, -1); chair(k, -0.72, 2.0, 1, 'dark'); chair(k, 0.72, 2.0, 1, 'dark'); } },
  plotTable: { w: 2.6, d: 2.2, use: [[0, 2.45], [1.05, 1.1]], f: (k) => { k.b(1.5, 0.85, 1.1, 'dark', 0, 1.1); k.b(1.4, 0.03, 1.0, 'glow', 0, 1.1, 0.85); k.b(0.5, 0.25, 0.3, 'glass', -0.2, 1.1, 0.9); k.b(0.1, 0.1, 0.1, 'alarm', 0.3, 0.9, 0.9); } },
  readyRack: { w: 1.7, d: 0.6, f: (k) => { lockers(k, -0.2, 3, 'dark'); k.b(0.3, 0.6, 0.3, 'alarm', 0.68, 0.2); k.c(0.08, 0.5, 'alarm', 0.68, 0.2, 0.9, 6); } },
  // ---- magazines and ordnance
  shellRack: { w: 2.2, d: 1.4, f: (k) => { k.b(2.0, 0.2, 1.2, 'locker', 0, 0.65); for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { k.c(0.15, 1.1, 'shell', -0.8 + i * 0.4, 0.25 + j * 0.4, 0.2, 8); k.c(0.1, 0.2, 'alarm', -0.8 + i * 0.4, 0.25 + j * 0.4, 1.3, 6); } k.b(2.0, 0.06, 0.06, 'steel', 0, 1.25, 1.0); for (const x of [-1.0, 1.0]) k.b(0.06, 1.0, 0.06, 'steel', x, 1.25); } },
  shellCradle: { w: 2.4, d: 1.0, f: (k) => { for (const y of [0.35, 0.95, 1.55]) { k.cx(0.2, 1.8, 'shell', 0, 0.5, y); k.cx(0.21, 0.2, 'alarm', 0.8, 0.5, y); for (const x of [-0.7, 0.7]) k.b(0.1, 0.12, 0.6, 'locker', x, 0.5, y - 0.3); } for (const x of [-1.05, 1.05]) k.b(0.08, 1.9, 0.6, 'locker', x, 0.5); } },
  hoist: { w: 1.6, d: 1.5, use: [[0, 1.95]], f: (k) => { for (const x of [-0.65, 0.65]) k.b(0.1, 2.3, 0.1, 'alarm', x, 0.75); k.b(1.4, 0.14, 0.14, 'alarm', 0, 0.75, 2.2); k.b(0.03, 0.9, 0.03, 'steel', 0, 0.75, 1.3); k.c(0.16, 0.9, 'shell', 0, 0.75, 0.4, 8); k.b(0.9, 0.12, 0.9, 'locker', 0, 0.75); } },
  blastDoor: { w: 1.6, d: 0.3, use: [], f: (k) => { k.b(1.5, 2.2, 0.16, 'dark', 0, 0.1); for (let i = 0; i < 4; i++) k.b(1.5, 0.14, 0.02, 'alarm', 0, 0.19, 0.2 + i * 0.5); k.b(0.2, 0.2, 0.04, 'glow', 0.55, 0.2, 1.2); } },
  bombTrolley: { w: 2.6, d: 1.1, f: (k) => { k.b(2.2, 0.1, 0.7, 'locker', 0, 0.55, 0.3); for (const x of [-0.8, 0.8]) for (const z of [0.25, 0.85]) k.cx(0.14, 0.1, 'dark', x, z, 0.15); k.cx(0.24, 1.7, 'shell', 0, 0.55, 0.66); k.cx(0.25, 0.25, 'alarm', 0.6, 0.55, 0.66); for (const z of [0.3, 0.8]) k.b(0.3, 0.02, 0.06, 'dark', -0.95, z, 0.66); k.b(0.3, 0.5, 0.02, 'dark', -0.95, 0.55, 0.41); k.b(0.06, 0.6, 0.06, 'steel', 1.15, 0.55, 0.4); } },
  bombRack: { w: 2.6, d: 1.0, f: (k) => { for (const x of [-1.2, 1.2]) for (const z of [0.15, 0.85]) k.b(0.08, 2.0, 0.08, 'alarm', x, z); for (const y of [0.4, 1.05, 1.7]) { k.b(2.4, 0.05, 0.8, 'locker', 0, 0.5, y - 0.26); k.cx(0.2, 1.6, 'shell', -0.1, 0.5, y); k.cx(0.21, 0.2, 'alarm', 0.55, 0.5, y); } } },
  // ---- SEAF
  rifleRack: { w: 2.2, d: 0.55, f: (k) => { k.b(2.1, 1.9, 0.06, 'locker', 0, 0.05); k.b(2.1, 0.1, 0.3, 'locker', 0, 0.2, 0.25); k.b(2.1, 0.06, 0.2, 'locker', 0, 0.16, 1.2); for (let i = 0; i < 10; i++) { k.b(0.06, 1.0, 0.08, 'dark', -0.9 + i * 0.2, 0.2, 0.35); k.b(0.05, 0.25, 0.12, 'craft', -0.9 + i * 0.2, 0.24, 0.5); } } },
  armourStands: { w: 2.0, d: 0.8, f: (k) => { for (const x of [-0.62, 0, 0.62]) { k.c(0.04, 1.1, 'steel', x, 0.4, 0, 6); k.c(0.18, 0.04, 'dark', x, 0.4, 0, 8); k.b(0.5, 0.55, 0.3, 'craft', x, 0.4, 1.0); k.b(0.3, 0.26, 0.3, 'craft', x, 0.4, 1.58); k.b(0.22, 0.06, 0.02, 'trim', x, 0.56, 1.68); } } },
  ammoCrates: { w: 2.3, d: 1.25, f: (k) => { for (const [x, z, y] of [[-0.55, 0.4, 0], [0.2, 0.4, 0], [-0.55, 0.4, 0.42], [0.75, 0.9, 0], [-0.2, 0.95, 0]]) { k.b(0.7, 0.4, 0.5, 'craft', x, z, y); k.b(0.72, 0.08, 0.52, 'alarm', x, z, y + 0.16); } } },
  cleaningBench: { w: 2.2, d: 0.8, f: (k) => { table(k, 0, 0.4, 2.0, 0.7, 0.9, 'steel'); k.b(1.1, 0.06, 0.1, 'dark', -0.3, 0.4, 0.9); k.b(0.2, 0.1, 0.2, 'alarm', 0.6, 0.35, 0.9); k.b(2.0, 0.6, 0.04, 'locker', 0, 0.05, 1.1); for (let i = 0; i < 5; i++) k.b(0.05, 0.3, 0.02, 'steel', -0.8 + i * 0.4, 0.08, 1.25); } },
  // ---- drones
  droneCradle: { w: 2.6, d: 1.9, f: (k) => { for (const x of [-0.5, 0.5]) { k.b(0.08, 0.7, 1.6, 'steel', x, 0.9); } k.b(1.2, 0.08, 0.1, 'steel', 0, 0.3, 0.7); k.b(1.2, 0.08, 0.1, 'steel', 0, 1.5, 0.7); k.b(0.5, 0.3, 1.5, 'craft', 0, 0.9, 0.78); k.b(2.2, 0.06, 0.45, 'craft', 0, 1.0, 0.95); k.b(0.9, 0.05, 0.3, 'craft', 0, 0.3, 0.95); k.b(0.2, 0.14, 0.1, 'glow', 0, 1.68, 0.84); k.c(0.16, 0.14, 'dark', 0, 1.3, 0.62, 8); } },
  chargeStation: { w: 1.2, d: 0.9, f: (k) => { k.b(1.0, 1.6, 0.5, 'steel', 0, 0.3); for (let i = 0; i < 3; i++) { k.b(0.24, 0.5, 0.02, 'dark', -0.3 + i * 0.3, 0.56, 0.7); k.b(0.14, 0.06, 0.02, i === 1 ? 'alarm' : 'glow', -0.3 + i * 0.3, 0.57, 1.3); } k.cz(0.03, 0.3, 'dark', 0.3, 0.7, 0.3); } },
  // ---- the fabricator
  fabCell: { w: 2.6, d: 2.2, use: [[0, 2.65]], f: (k) => { for (const [x, z] of [[-1.1, 0.2], [1.1, 0.2], [-1.1, 2.0], [1.1, 2.0]]) k.b(0.1, 2.2, 0.1, 'steel', x, z); for (const z of [0.2, 2.0]) k.b(2.3, 0.1, 0.1, 'steel', 0, z, 2.1); k.b(0.12, 0.12, 1.8, 'alarm', 0.2, 1.1, 2.1); k.b(0.3, 0.5, 0.3, 'dark', 0.2, 1.1, 1.6); k.b(0.1, 0.1, 0.1, 'spark', 0.2, 1.1, 1.5); k.b(2.0, 0.2, 1.6, 'locker', 0, 1.1); crateBox(k, 0.2, 1.1, 0.9, 0.2, 'craft'); } },
  hopper: { w: 1.4, d: 1.2, f: (k) => { k.c(0.5, 1.0, 'steel', 0, 0.6, 1.0, 12); k.c(0.2, 0.6, 'steel', 0, 0.6, 0.4, 8); for (const [x, z] of [[-0.4, 0.2], [0.4, 0.2], [-0.4, 1.0], [0.4, 1.0]]) k.b(0.06, 1.2, 0.06, 'dark', x, z); k.b(0.3, 0.2, 0.02, 'glow', 0, 1.11, 1.3); } },
  conveyor: { w: 3.2, d: 0.9, f: (k) => { k.b(3.0, 0.1, 0.7, 'dark', 0, 0.45, 0.7); for (const x of [-1.3, 0, 1.3]) k.b(0.1, 0.7, 0.6, 'steel', x, 0.45); for (const x of [-0.9, 0.2, 1.1]) crateBox(k, x, 0.45, 0.5, 0.8, 'craft'); for (const z of [0.1, 0.8]) k.b(3.0, 0.08, 0.04, 'alarm', 0, z, 0.8); } },
};

// ---------------------------------------------------------------- what each room is made of, in the order it is laid out
export const ROOMS = {
  quarters: ['bedDouble', 'wet', 'desk', 'bedSingle', 'kitchen', 'living', 'dining', 'bookshelf', 'plantPot'],
  bunks: ['bunks', 'lockerRow', 'bunks', 'wet', 'bench', 'messTable', 'bunks', 'lockerRow'],
  barrack: ['bunks', 'kitRack', 'bunks', 'lockerRow', 'wet', 'bench', 'exercise', 'messTable'],
  mess: ['galley', 'messTable', 'messTable', 'drinks', 'messTable', 'plantPot', 'messTable', 'vending'],
  lounge: ['viewSofa', 'armchairs', 'plantPot', 'gameTable', 'bookshelf', 'viewSofa', 'drinks', 'exercise'],
  gym: ['exercise', 'lockerRow', 'exercise', 'gameTable', 'bench', 'drinks', 'exercise', 'arcade', 'plantPot'],
  hydro: ['growRack', 'growBed', 'growRack', 'waterTank', 'seedBench', 'growRack', 'growBed'],
  workshop: ['workbench', 'lathe', 'partsBins', 'printer', 'weldBay', 'suitRack', 'workbench', 'lockerRow'],
  cargostore: ['palletRack', 'floorStack', 'palletRack', 'barrels', 'loader', 'palletRack', 'floorStack'],
  ops: ['opsBay', 'holoTable', 'servers', 'opsBay', 'sideConsole', 'servers', 'drinks'],
  market: ['stall', 'noodleBar', 'vending', 'stall', 'floorStack', 'stall', 'plantPot', 'bench'],
  bar: ['barCounter', 'booth', 'arcade', 'booth', 'kegs', 'gameTable', 'booth', 'plantPot'],
  medbay: ['reception', 'treatBed', 'treatBed', 'medCabinet', 'autoDoc', 'scanner', 'basin', 'treatBed', 'wet'],
  secoffice: ['dutyDesk', 'cell', 'gunLocker', 'monitorWall', 'cell', 'lockerRow', 'bench', 'bookshelf'],
  customs: ['monitorWall', 'dutyDesk', 'lockerRow', 'bench', 'monitorWall', 'gunLocker'],
  truth: ['studio', 'sideConsole', 'posters', 'votingBooth', 'servers', 'posters', 'votingBooth', 'bookshelf'],
  brass: ['bigDesk', 'conference', 'drinksCabinet', 'bedDouble', 'wet', 'trophies', 'living', 'plantPot'],
  lab: ['labBench', 'specimenTank', 'gloveBox', 'centrifuge', 'whiteboard', 'servers', 'labBench', 'specimenTank'],
  guncrew: ['fireControl', 'plotTable', 'readyRack', 'sideConsole', 'bench', 'lockerRow', 'drinks'],
  magazine: ['shellRack', 'hoist', 'shellCradle', 'blastDoor', 'shellRack', 'shellCradle'],
  armoury: ['rifleRack', 'armourStands', 'ammoCrates', 'cleaningBench', 'rifleRack', 'gunLocker', 'ammoCrates'],
  dronerack: ['droneCradle', 'chargeStation', 'sideConsole', 'droneCradle', 'partsBins', 'workbench'],
  ordnance: ['bombRack', 'bombTrolley', 'blastDoor', 'bombRack', 'bombTrolley', 'hoist'],
  fab: ['fabCell', 'hopper', 'conveyor', 'sideConsole', 'floorStack', 'fabCell', 'partsBins'],
};

// ---------------------------------------------------------------- the plan
const cache = new Map();
export function roomPlan(room, W, D, door, variant = 0) {
  const key = `${room}|${W.toFixed(2)}|${D.toFixed(2)}|${door ? 1 : 0}|${variant}`;
  if (cache.has(key)) return cache.get(key);
  const items = [], spots = [], hw = W / 2, hd = D / 2, lift = !door, pad = OPEN.has(room);
  const out = { items, spots, W, D, door: lift ? [0, 0] : [0, hd] };
  const t = 0.12, H = 1.25;      // walls are drawn to waist height so the room can be seen into; the door frame stands full height
  if (door && !pad) {      // a doorway 1.2 m wide and 2.1 m high
    const gap = 1.2, wl = (W - gap) / 2;
    items.push(['b', 'wall', W, H, t, 0, H / 2, -hd + t / 2], ['b', 'wall', t, H, D, -hw + t / 2, H / 2, 0], ['b', 'wall', t, H, D, hw - t / 2, H / 2, 0]);
    for (const s of [-1, 1]) items.push(['b', 'wall', wl, H, t, s * (gap / 2 + wl / 2), H / 2, hd - t / 2], ['b', 'locker', 0.1, 2.1, t + 0.06, s * (gap / 2 + 0.05), 1.05, hd - t / 2]);
    // a sliding door, drawn open: its two leaves stand aside on the corridor face of the wall, each with a lit edge
    for (const s of [-1, 1]) items.push(['b', 'steel', 0.6, 2.05, 0.05, s * (gap / 2 + 0.34), 1.025, hd + 0.03], ['b', 'lane', 0.04, 1.5, 0.06, s * (gap / 2 + 0.07), 1.0, hd + 0.03], ['b', 'alarm', 0.5, 0.08, 0.055, s * (gap / 2 + 0.34), 1.0, hd + 0.03]);
    items.push(['b', 'locker', gap + 1.5, 0.08, 0.1, 0, 2.14, hd + 0.03]);
    items.push(['b', 'locker', gap + 0.2, 0.1, t + 0.06, 0, 2.15, hd - t / 2], ['b', 'lane', gap - 0.2, 0.02, t + 0.1, 0, 0.01, hd - t / 2], ['b', 'glow', 0.5, 0.08, t + 0.08, 0, 2.15, hd - t / 2]);
  }
  const x0 = -hw + t + 0.12, x1 = hw - t - 0.12, zb = -hd + t, zf = hd - t, depth = zf - zb, G = lift ? 2.5 : 0.9;
  const kits = (ROOMS[room] || []).map((n) => K[n]), rows = [], aisles = [];
  if (kits.length && depth >= R + 1.4) {
    if (depth < 2 * R + 1.6) { const a = (zb + R + zf) / 2; rows.push({ z: zb, dir: 1, a, split: false }); aisles.push(a); }
    else {
      const k = Math.floor((depth - 2 * R - 1.6) / (2 * R + 1.6)), aw = (depth - 2 * R - 2 * R * k) / (k + 1);
      let z = zb + R;
      rows.push({ z: zb, dir: 1, a: z + aw / 2, split: false }); aisles.push(z + aw / 2);
      for (let j = 0; j < k; j++) { const zc = z + aw + R; rows.push({ z: zc, dir: -1, a: z + aw / 2, split: true }, { z: zc, dir: 1, a: zc + R + aw / 2, split: true }); aisles.push(zc + R + aw / 2); z = zc + R; }
      rows.push({ z: zf, dir: -1, a: zf - R - aw / 2, split: !lift });
    }
  } else aisles.push(pad ? hd * 0.86 : 0);
  // fill each row from the room's list, in order, leaving the cross lane clear where the row lies across it
  let ci = variant, flip = variant % 2 ? -1 : 1;
  const once = new Set();
  for (const row of rows) {
    const segs = row.split ? [[x0, -G], [G, x1]] : [[x0, x1]];
    for (const [a, b] of segs) {
      const len = b - a, list = []; let used = 0, miss = 0;
      while (miss < kits.length && list.length < 40) {
        const kt = kits[ci % kits.length]; ci++;
        if ((kt.once && once.has(kt)) || used + kt.w > len) { miss++; continue; }
        list.push(kt); used += kt.w + 0.12; miss = 0; if (kt.once) once.add(kt);
      }
      if (!list.length) continue;
      const total = list.reduce((s, kt) => s + kt.w, 0), gap = (len - total) / (list.length + 1);
      let x = a + gap;
      for (const kt of list) {
        const cx = x + kt.w / 2, sx = row.dir * flip, X = (lx) => cx + sx * lx, Z = (lz) => row.z + row.dir * lz;
        kt.f({
          b: (w, h, d, role, lx, lz, y = 0) => items.push(['b', role, w, h, d, X(lx), y + h / 2, Z(lz)]),
          c: (r, h, role, lx, lz, y = 0, seg = 10) => items.push(['c', role, r, h, X(lx), y + h / 2, Z(lz), seg]),
          cx: (r, l, role, lx, lz, y = 0) => items.push(['cx', role, r, l, X(lx), y, Z(lz)]),
          cz: (r, l, role, lx, lz, y = 0) => items.push(['cz', role, r, l, X(lx), y, Z(lz)]),
        });
        for (const u of kt.use || [0]) {
          const lx = Array.isArray(u) ? u[0] : u, lz = Array.isArray(u) ? u[1] : kt.d + 0.45, front = Math.max(lz, kt.d + 0.45);
          const via = []; if (front > lz + 0.01) via.push([X(lx), Z(front)]);
          via.push([X(lx), row.a], [0, row.a]);
          spots.push({ x: X(lx), z: Z(lz), face: row.dir > 0 ? Math.PI : 0, via });
        }
        x += kt.w + gap;
      }
    }
  }
  // HALLWAYS inside a room: a carpet runner along every aisle and down the cross lane to the door (or the lift)
  if (!pad && rows.length) {
    for (const a of aisles) items.push(['b', 'hall', x1 - x0, 0.016, 1.2, (x0 + x1) / 2, 0.008, a]);
    const za = Math.min(...aisles), zc = lift ? Math.max(...aisles) : hd - t;
    if (zc - za > 0.2) items.push(['b', 'hall', 1.2, 0.017, zc - za, 0, 0.0085, (za + zc) / 2]);
  }
  // people with nothing to stand at stand in the aisles (on a pad: along its front edge and at its corners)
  for (const a of aisles) for (let x = x0 + 0.9; x <= x1 - 0.9 + 1e-6; x += 2.3) if (!(lift && Math.abs(x) < 3.0 && Math.abs(a) < 3.0)) spots.push({ x, z: a, face: null, via: [[0, a]], idle: true });
  if (pad && room !== 'empty') for (const s of [-1, 1]) spots.push({ x: s * hw * 0.92, z: -hd * 0.86, face: null, via: [[s * hw * 0.92, hd * 0.86], [0, hd * 0.86]], idle: true });
  if (!spots.length) spots.push({ x: 0, z: aisles[0] || 0, face: null, via: [], idle: true });
  out.aisles = aisles;      // where the lanes run (z, in metres): the ways in from the edge of an open deck
  cache.set(key, out);
  return out;
}
