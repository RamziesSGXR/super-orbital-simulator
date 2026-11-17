// Walk check: in every part, along every way a person can take (port to port, port to a place in a room, room to room):
//   1. there is floor under every step that can be seen (a hallway, a deck plate or a room's own floor);
//   2. nobody walks through a wall, a fitting, or a craft parked on a pad;
//   3. every side port opens onto a deck at the standard sill (0.4 below the port), so floors meet level at every join;
//   4. the only changes of height happen inside a lift, where nobody is drawn.
// Usage: node test/walks.mjs [type ...]
import * as THREE from '../js/vendor/three.js';
import { C } from '../js/config.js';
import { SLOTS, WALK, FL, buildPart, buildRoom, doorSide, slotSpot, slotLocal, partPath, wayPoint, sillY } from '../js/parts.js';
import { OPEN } from '../js/rooms.js';

const BODY = 0.24, STEP = 0.03, FLOOR = new Set(['hall', 'inner', 'steel', 'tile']);
const only = process.argv.slice(2);
let bad = 0, paths = 0, steps = 0, types = 0;
const kinds = new Map();      // one line for each different fault, with how many ways it spoils
const fail = (msg, key = msg) => { bad++; const k = kinds.get(key); if (k) k.n++; else kinds.set(key, { n: 1, msg }); };
const foot = (it) => {
  if (it[0] === 'b') return { x0: it[5] - it[2] / 2, x1: it[5] + it[2] / 2, z0: it[7] - it[4] / 2, z1: it[7] + it[4] / 2, y0: it[6] - it[3] / 2, y1: it[6] + it[3] / 2 };
  if (it[0] === 'c') return { x0: it[4] - it[2], x1: it[4] + it[2], z0: it[6] - it[2], z1: it[6] + it[2], y0: it[5] - it[3] / 2, y1: it[5] + it[3] / 2 };
  if (it[0] === 'cx') return { x0: it[4] - it[3] / 2, x1: it[4] + it[3] / 2, z0: it[6] - it[2], z1: it[6] + it[2], y0: it[5] - it[2], y1: it[5] + it[2] };
  return { x0: it[4] - it[2], x1: it[4] + it[2], z0: it[6] - it[3] / 2, z1: it[6] + it[3] / 2, y0: it[5] - it[2], y1: it[5] + it[2] };
};
const CRAFT = { eaglepad: [-0.95, 0.85, 0.74], pelicanpad: [-0.9, 0.9, 0.8], shuttlebay: [-0.9, 0.9, 0.8] };      // the craft on a pad, in the tile's frame: x from, x to, half-width

for (const type of Object.keys(WALK)) {
  if (only.length && !only.includes(type)) continue;
  const d = C.parts[type], W = WALK[type], lay = SLOTS[type] || [];
  types++;
  // 3. the standard sill
  for (const q of d.ports) if (Math.abs(q[4]) < 0.7) { const off = sillY(type, q[1]) - q[1]; if (Math.abs(off + 0.4) > 0.005) fail(`${type}: the port at ${q.slice(0, 3)} opens onto a deck ${(-off).toFixed(2)} below it, not 0.40`); }
  // the part as built, with its usual rooms (and, for parts whose rooms start empty, a furnished set too)
  const sets = [d.rooms || lay.map(() => 'empty')];
  if (lay.length && sets[0].every((r) => r === 'empty')) sets.push(lay.map((_, i) => ['quarters', 'workshop', 'ops', 'mess'][i % 4]));
  if (lay.length && W.k === 'shaft') sets.push(lay.map((_, i) => ['lab', 'medbay', 'bar', 'cargostore'][i % 4]));
  for (const rooms of sets) {
    const p = { type, rooms, fit: [] }, world = new THREE.Group(), part = buildPart(type);
    world.add(part);
    const slots = lay.map((s, i) => {
      const rg = buildRoom(rooms[i] || 'empty', s.w, s.d, doorSide(type, s), 0); rg.position.set(...s.p); rg.rotation.y = s.ry; world.add(rg);
      const L = slotLocal(type, i, rooms[i] || 'empty', 0);
      return { s, L, room: rooms[i] || 'empty', solid: L.plan.items.map(foot).filter((f) => f.y1 > 0.08 && f.y0 < 1.85), hw: s.w * 0.48, hd: s.d * 0.48 };
    });
    world.updateMatrixWorld(true);
    const floors = []; world.traverse((o) => { if (o.isMesh && FLOOR.has(o.userData.role)) { o.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); floors.push(o); } });
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), seen = new Map();
    const floorUnder = (x, y, z) => {
      const k = `${Math.round(x / 0.02)}|${Math.round(y / 0.02)}|${Math.round(z / 0.02)}`;
      if (!seen.has(k)) {      // a ray that runs exactly down the seam between two floor pieces can slip through, so a miss is tried again a hair to the side
        let h = null;
        for (const [ox, oz] of [[0, 0], [0.0013, 0.0017], [-0.0017, 0.0011]]) { ray.set(new THREE.Vector3(x + ox, y + FL + 0.05, z + oz), down); ray.far = 0.2; h = ray.intersectObjects(floors, false)[0]; if (h) break; }
        seen.set(k, h ? h.distance - 0.05 : null);
      }
      return seen.get(k);
    };
    // the ends: every port, and a few people's own places in every room
    const ends = d.ports.map((q, i) => ({ name: `port ${i}`, e: { join: q.slice(0, 3) }, j: q }));
    lay.forEach((s, i) => { for (const k of [0.11, 0.37, 0.62, 0.93]) ends.push({ name: `room ${i} (${rooms[i]})`, e: slotSpot(type, i, k, rooms[i] || 'empty', 0), slot: i }); });
    // someone on top of the part, coming down a tube into the hallway (a part standing on a roof port of another)
    if (W.k === 'hall') ends.push({ name: 'the floor hatch', e: { join: [d.center[0], -1, W.z] } });
    for (let a = 0; a < ends.length; a++) for (let b = 0; b < ends.length; b++) {
      if (a === b || (ends[a].slot !== undefined && ends[a].slot === ends[b].slot)) continue;
      const A = ends[a], B = ends[b], P = partPath(p, A.e, B.e), label = `${type} [${rooms.join(',')}] ${A.name} → ${B.name}`;
      paths++;
      // passing through: the same check on the way in alone, which is how a leg is drawn when the path goes on (wayPoint)
      if (A.e.join && a < b) { const w = wayPoint(p, A.e.join); if (!w || w.some((x) => !Number.isFinite(x))) fail(`${label}: no way in`); }
      let why = '', last = null;
      for (let i = 0; i + 1 < P.pts.length && !why; i++) {
        const u = P.pts[i], v = P.pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(v[0] - u[0], v[1] - u[1], v[2] - u[2]) / STEP));
        for (let k = 0; k <= n && !why; k++) {
          const x = u[0] + (v[0] - u[0]) * k / n, y = u[1] + (v[1] - u[1]) * k / n, z = u[2] + (v[2] - u[2]) * k / n;
          const hid = P.hide.some((h) => Math.hypot(x - h[0], z - h[1]) < h[2]);
          steps++;
          if (hid) { last = null; continue; }
          // 4. no change of height in sight
          if (last && Math.abs(y - last) > 0.004) { why = `changes height in the open at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`; break; }
          last = y;
          // 1. floor under every step (the very edge of a port, in the hull's own thickness, is let off)
          const atPort = [A, B].some((E) => E.j && Math.hypot(x - E.j[0], z - E.j[2]) < 0.06);
          const f = atPort ? 0 : floorUnder(x, y, z);
          if (f === null || Math.abs(f) > 0.035) { why = `no floor at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}${f === null ? '' : ` (the nearest is ${f.toFixed(3)} below)`}`; break; }
          // 2. nothing in the way: in every room the step is inside (rooms.mjs has already cleared each person's way to their own door)
          for (const sl of slots) {
            if (Math.abs(y - sl.s.p[1]) > 0.05) continue;
            const [rx, rz, lx, lz] = sl.L.to([x, y, z]);
            if (Math.abs(lx) > sl.hw + 0.03 || Math.abs(lz) > sl.hd + 0.03) continue;
            const own = (E) => E.slot !== undefined && slots[E.slot] === sl;
            const cr = CRAFT[sl.room];
            if (cr && lx > cr[0] && lx < cr[1] && Math.abs(lz) < cr[2]) { why = `walks through the craft on the pad at ${x.toFixed(2)}, ${z.toFixed(2)}`; break; }
            if (own(A) || own(B)) continue;
            const nearDoor = Math.hypot(rx - sl.L.plan.door[0], rz - sl.L.plan.door[1]) < 0.5;
            const hit = !nearDoor && sl.solid.find((g) => rx > g.x0 - BODY && rx < g.x1 + BODY && rz > g.z0 - BODY && rz < g.z1 + BODY);
            if (hit) { why = `walks into something in ${sl.room} at ${x.toFixed(2)}, ${z.toFixed(2)} (room ${rx.toFixed(1)}, ${rz.toFixed(1)} m)`; break; }
          }
        }
      }
      if (why) fail(`${label}: ${why}`, `${type}: ${why}`);
    }
  }
}
for (const k of [...kinds.values()].slice(0, 60)) console.log(`FAIL  ${k.msg}${k.n > 1 ? `   (and ${k.n - 1} more ways)` : ''}`);
console.log(`${types} kinds of part, ${paths} ways through them, ${steps} steps`);
console.log(bad ? `${bad} PROBLEMS` : 'ALL CLEAR');
process.exit(bad ? 1 : 0);
