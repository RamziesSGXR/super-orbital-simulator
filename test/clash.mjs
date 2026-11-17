// Clash check: a part may not run through another (solid.js, Station.clashWith), but it may touch, sit into the part it joins,
// and nest.
//   1. every kind of part can still be put on a plain station somewhere;
//   2. a part that would cross another is refused, says what it would run into, and build() refuses it too;
//   3. joining a part to its host is never refused for the host alone on the usual ports (side ports for modules, top for guns);
//   4. the test is quick enough to run for every port when the dots are shown.
// Usage: node test/clash.mjs
import { Station } from '../js/sim.js';
import { C } from '../js/config.js';

let bad = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); if (!ok) bad++; };
const types = Object.keys(C.parts).filter((t) => !C.parts[t].fixed);
const grow = (seed, n) => {
  const s = new Station(seed, 'sandbox'); s.credits = 1e9;
  for (let i = 0, k = 0; i < 2000 && k < n; i++) { const t = ['core', 'junction', 'hab', 'tube', 'cargo', 'node'][s.rng.int(6)], fs = s.freePorts(), f = fs[s.rng.int(fs.length)]; if (f && s.canBuild(t, f.part, f.i).ok) { s.parts.get(s.build(t, f.part, f.i).id).state = 'active'; k++; } }
  return s;
};

// 1. every kind can go somewhere
{
  const s = grow(3, 12), none = types.filter((t) => !s.freePorts().some((f) => s.canBuild(t, f.part, f.i).ok || !/run into/.test(s.canBuild(t, f.part, f.i).why)));
  check('every kind of part can still be built somewhere on a plain station', !none.length, none.join(', '));
}
// 2. crossing is refused
{
  let found = null;
  for (let seed = 1; seed < 30 && !found; seed++) {
    const s = grow(seed, 20);
    for (const f of s.freePorts()) { for (const t of ['ring', 'drum', 'tower']) { const r = s.canBuild(t, f.part, f.i); if (!r.ok && /run into/.test(r.why)) { found = { s, t, f, r }; break; } } if (found) break; }
  }
  check('a part that would run through another is refused, and says what it would hit', !!found && /It would run into \S/.test(found.r.why), found && found.r.why);
  if (found) { const n = found.s.parts.size, b = found.s.build(found.t, found.f.part, found.f.i); check('build() refuses it too, and nothing is built', !b.ok && found.s.parts.size === n); }
}
// 3. joins: each kind on each kind, alone, on ports where it is meant to go
{
  const bad3 = [];
  for (const ht of ['core', 'junction', 'hab', 'cargo', 'node', 'tube', 'longcore']) for (const t of ['hab', 'cargo', 'core', 'junction', 'gunmount', 'dockport', 'solar', 'reactor', 'billboard', 'dome']) {
    const s = new Station(1, 'sandbox'); s.credits = 1e9; const cmd = [...s.parts.values()][0];
    const f0 = s.freePorts().find((f) => f.part === cmd.id && s.canBuild(ht, f.part, f.i).ok); if (!f0) continue;
    const h = s.parts.get(s.build(ht, f0.part, f0.i).id); h.state = 'active';
    const fs = s.freePorts().filter((f) => f.part === h.id && Math.abs(s.port(h, f.i).dir[1]) < 0.7 === !C.parts[t].keel && Math.abs(s.port(h, f.i).dir[1]) < 0.7 !== (t === 'gunmount' || t === 'dome'));
    for (const f of fs) { const r = s.canBuild(t, f.part, f.i); if (!r.ok && /the part it joins/.test(r.why)) bad3.push(`${t} on ${ht} port ${f.i}`); }
  }
  check('modules on side ports and guns and domes on top ports are never refused for the part they join', !bad3.length, bad3.slice(0, 8).join('; '));
}
// 4. speed
{
  const s = grow(7, 30), t0 = performance.now(); let k = 0;
  for (const f of s.freePorts()) { s.canBuild('ring', f.part, f.i); k++; }
  const ms = performance.now() - t0;
  check('testing every free port for a ring takes under half a second', ms < 500, `${k} ports in ${ms.toFixed(0)} ms`);
}
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
