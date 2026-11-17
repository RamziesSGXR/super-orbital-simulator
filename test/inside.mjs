// Inside check: everything inside a part (decks, hallways, rooms, fittings) must stay inside its hull. Builds every part that has
// a closed hull, furnishes its rooms, and tests points of every interior surface against the hull (a ray cast: inside if it crosses
// a closed hull piece an odd number of times). Usage: node test/inside.mjs [type ...]
import * as THREE from '../js/vendor/three.js';
import { C } from '../js/config.js';
import { SLOTS, buildPart, buildRoom, doorSide } from '../js/parts.js';
const HULL = new Set(['hull', 'trim', 'glass']),      // the solid shell: hull plating, collars and rings, and the glass of a blister or dome
  OUTSIDE_OK = new Set(['hull', 'trim', 'dark', 'panel', 'glass', 'pod', 'decal', 'glow', 'screen', 'line', 'wire', 'blue', 'mark']);
// parts that are closed vessels (bays, the drydock and truss are open to space by design)
const CLOSED = ['command', 'core', 'longcore', 'junction', 'tower', 'reactor', 'hab', 'cargo', 'ring', 'bigring', 'drum', 'disc', 'node', 'tube', 'dockport', 'blister', 'barracks', 'fabshop', 'gunmount', 'battery', 'dronebay', 'lance', 'refinery', 'dome'];
const only = process.argv.slice(2), FURNISH = ['quarters', 'mess', 'workshop', 'cargostore', 'lab', 'bar', 'medbay', 'ops'];
let bad = 0;
const ray = new THREE.Raycaster(), dir = [new THREE.Vector3(1, 0.0123, 0.0071).normalize(), new THREE.Vector3(-0.013, 0.0091, 1).normalize()];
for (const type of CLOSED) {
  if (only.length && !only.includes(type)) continue;
  const g = new THREE.Group(), part = buildPart(type, true); g.add(part);
  (SLOTS[type] || []).forEach((s, i) => { const r = buildRoom(C.parts[type].rooms ? C.parts[type].rooms[i] : FURNISH[i % FURNISH.length], s.w, s.d, doorSide(type, s), 0); r.position.set(...s.p); r.rotation.y = s.ry; g.add(r); });
  g.updateMatrixWorld(true);
  const hull = [], inner = [];
  g.traverse((o) => { if (!o.isMesh || !o.userData.role) return; if (HULL.has(o.userData.role)) { o.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); hull.push(o); } else if (!OUTSIDE_OK.has(o.userData.role)) inner.push(o); });
  const P = new THREE.Vector3(), worst = new Map();
  // inside a hull piece: an odd number of crossings of THAT piece, both ways; inside the part: inside any of its pieces
  const inOne = (m, p) => dir.every((d) => { ray.set(p, d); ray.far = 200; const hits = ray.intersectObject(m, false); let n = 0, last = -1; for (const h of hits) { if (h.distance - last > 1e-4) n++; last = h.distance; } return n % 2 === 1; });
  const near = (m, p) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld).expandByScalar(0.01).containsPoint(p); };
  const inside = (p) => hull.some((m) => near(m, p) && inOne(m, p));
  // flush with the shell counts as inside (a hull is a polygon, so its wall is a few centimetres in from its nominal radius)
  const T = 0.03, OFF = [[T, 0, 0], [-T, 0, 0], [0, T, 0], [0, -T, 0], [0, 0, T], [0, 0, -T]].map((x) => new THREE.Vector3(...x)), Q = new THREE.Vector3();
  const insideish = (p) => inside(p) || OFF.some((o) => inside(Q.copy(p).add(o)));
  const ports = C.parts[type].ports;
  let out = 0, tested = 0;
  for (const o of inner) {
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 60));
    for (let i = 0; i < pos.count; i += step) {
      P.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); tested++;
      if (ports.some((q) => Math.hypot(P.x - q[0], P.y - q[1], P.z - q[2]) < 0.22)) continue;      // in a port's opening: it carries on into the next part
      if (ports.some((q) => Math.abs(q[4]) < 0.7 && Math.hypot(P.x - q[0], P.z - q[2]) < 0.45 && Math.abs(P.y - q[1]) < 0.5)) continue;      // the passage from the wall out to a side port: walled, floored, roofed
      if (!insideish(P)) { out++; const k = o.userData.role; if (!worst.has(k)) worst.set(k, P.toArray().map((x) => x.toFixed(2))); }
    }
  }
  const pct = (100 * out / Math.max(1, tested)).toFixed(1);
  console.log(`${out ? 'FAIL' : 'PASS'}  ${type.padEnd(12)} ${out} of ${tested} interior points outside the hull (${pct}%)${out ? '  e.g. ' + [...worst].slice(0, 4).map(([k, p]) => `${k} at ${p}`).join('; ') : ''}`);
  if (out) bad++;
}
console.log(bad ? `${bad} PARTS LEAK` : 'ALL INSIDE');
process.exit(bad ? 1 : 0);
