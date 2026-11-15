// Room check: in every room, at every size the station uses, nobody stands inside a fitting or a wall, and the way from each
// standing spot to the door is clear. Usage: node test/rooms.mjs
import { C } from '../js/config.js';
import { SLOTS, doorSide } from '../js/parts.js';
import { roomPlan, ROOMS, OPEN } from '../js/rooms.js';

const BODY = 0.24;      // half the width of a person, in metres
let bad = 0, plans = 0, spotsN = 0, itemsN = 0;
const sizes = new Map();
for (const [type, lay] of Object.entries(SLOTS)) for (const s of lay) { const side = doorSide(type, s), sw = side === '+x' || side === '-x', m = C.scale.m; sizes.set(`${((sw ? s.d : s.w) * 0.96 * m).toFixed(2)}|${((sw ? s.w : s.d) * 0.96 * m).toFixed(2)}|${side ? 1 : 0}`, [(sw ? s.d : s.w) * 0.96 * m, (sw ? s.w : s.d) * 0.96 * m, side, type]); }
const foot = (it) => {
  if (it[0] === 'b') return { x0: it[5] - it[2] / 2, x1: it[5] + it[2] / 2, z0: it[7] - it[4] / 2, z1: it[7] + it[4] / 2, y0: it[6] - it[3] / 2, y1: it[6] + it[3] / 2 };
  if (it[0] === 'c') return { x0: it[4] - it[2], x1: it[4] + it[2], z0: it[6] - it[2], z1: it[6] + it[2], y0: it[5] - it[3] / 2, y1: it[5] + it[3] / 2 };
  if (it[0] === 'cx') return { x0: it[4] - it[3] / 2, x1: it[4] + it[3] / 2, z0: it[6] - it[2], z1: it[6] + it[2], y0: it[5] - it[2], y1: it[5] + it[2] };
  return { x0: it[4] - it[2], x1: it[4] + it[2], z0: it[6] - it[3] / 2, z1: it[6] + it[3] / 2, y0: it[5] - it[2], y1: it[5] + it[2] };
};
for (const room of [...Object.keys(ROOMS), ...OPEN]) for (const [W, D, side, type] of sizes.values()) for (const v of [0, 1, 2, 3]) {
  const plan = roomPlan(room, W, D, side, v); plans++; itemsN += plan.items.length;
  const solid = plan.items.map(foot).filter((f) => f.y1 > 0.08 && f.y0 < 1.85);      // rugs and things overhead do not count
  const hit = (x, z) => solid.find((f) => x > f.x0 - BODY && x < f.x1 + BODY && z > f.z0 - BODY && z < f.z1 + BODY);
  for (const sp of plan.spots) {
    spotsN++;
    const pts = [[sp.x, sp.z], ...sp.via, plan.door];
    let why = '';
    if (Math.abs(sp.x) > W / 2 || Math.abs(sp.z) > D / 2) why = 'outside the room';
    for (let i = 0; i < pts.length - 1 && !why; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1));
      for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, f = hit(x, z); if (f && !(i === pts.length - 2 && k > n - 4)) { why = `walks into something at ${x.toFixed(1)}, ${z.toFixed(1)}`; break; } }
    }
    if (why) { bad++; if (bad <= 25) console.log(`FAIL  ${room} ${W.toFixed(1)}×${D.toFixed(1)} m (${type}, ${side || 'lift'}, arrangement ${v}): spot ${sp.x.toFixed(1)}, ${sp.z.toFixed(1)} ${why}`); }
  }
  if (ROOMS[room] && plan.spots.filter((s) => !s.idle).length === 0 && D > 4.2 && W > 6) { bad++; console.log(`FAIL  ${room} ${W.toFixed(1)}×${D.toFixed(1)} m: nothing was fitted`); }
}
console.log(`${plans} room plans, ${itemsN} fittings, ${spotsN} standing spots`);
console.log(bad ? `${bad} PROBLEMS` : 'ALL CLEAR');
process.exit(bad ? 1 : 0);
