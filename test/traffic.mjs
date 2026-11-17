// Traffic check: builds a busy station in free play and flies it for a long while, watching everything that flies.
//   ships: never inside a hull (nose, middle and tail), never inside each other;      raiders: never inside the station, a ship or each other;
//   craft leaving for the ground: never inside a hull.
// Usage: node test/traffic.mjs <baseUrl> [minutes] [seed]
import { chromium } from 'playwright';
const [,, base, mins = '30', seed = '5'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/index.html?free&seed=${seed}`); await page.waitForTimeout(2500);
await page.evaluate(() => {
  const s = window.__st, ids = window.__ids = {}, log = window.__log = [];
  const bld = (t, h, p, r = 0) => { const x = s.build(t, h, p, r); if (!x.ok) { log.push(`could not build ${t} on ${h}:${p}: ${x.why}`); return 0; } (ids[t] ||= []).push(x.id); return x.id; };
  // a crowded station: berths facing every way, some of them pointing at other parts
  const c1 = bld('core', 1, 1), j = bld('junction', c1, 1), ring = bld('ring', j, 1), tw = bld('tower', ring, 1);
  const lc = bld('longcore', 1, 0), low = bld('core', lc, 0);
  const h1 = bld('hab', 1, 2), h2 = bld('cargo', 1, 3), tb = bld('tube', 1, 4); bld('barracks', 1, 5);
  bld('dockport', h1, 1); bld('dockport', h1, 2); bld('dockport', h2, 3); bld('dockport', tb, 1);
  bld('hangar', c1, 2); bld('drydock', c1, 3); bld('pylon', c1, 4); bld('eaglehangar', c1, 5);
  bld('dockport', j, 2); bld('dockport', j, 4); bld('pelicanbay', j, 6); bld('solar', j, 3); bld('solar', j, 5); bld('gunmount', j, 7);
  bld('dockport', lc, 2); bld('dockport', lc, 6); bld('dockport', low, 2); bld('cargo', low, 3); bld('dockport', low, 4); bld('pylon', low, 5);
  bld('dockport', ring, 2); bld('hab', ring, 3); bld('dockport', tw, 2); bld('dish', tw, 4);
  for (let i = 0; i < 60 * 40; i++) s.step(1 / 30);
  s.addColonists(40);
});
await page.waitForTimeout(3000);      // a few frames, so the view has every part
const out = await page.evaluate(async (mins) => {
  const THREE = await import('/js/vendor/three.js');
  const s = window.__st, v = window.__view, ids = window.__ids, log = window.__log;
  v._ships(0, 0.1); s.clearShips(); v._ships(0, 0.1);      // start with empty skies: ships sent in before the view had looked at the station do not count
  const shutAtStart = [...v.shut].map(([id, by]) => `${s.name(s.parts.get(id))} (by ${by})`);
  const fwd = new THREE.Vector3(), sdw = new THREE.Vector3(), HIGH = { shuttle: 0.6, freighter: 0.65, warship: 1.4 }, P = new THREE.Vector3(), HALF = { shuttle: 1.5, freighter: 2.7, warship: 6 }, BEAM = { shuttle: 1.2, freighter: 1.2, warship: 1.8 };
  const worst = { hull: 99, hullAt: '', ships: 99, shipsAt: '', raider: 99, raiderShip: 99, raiderRaider: 99, craft: 99 }, bad = [];
  const seen = { approach: 0, depart: 0, docked: 0, hold: 0, kinds: new Set(), raids: 0, craft: 0, reroute: 0 };
  let now = 100, lastState = new Map();
  const dt = 0.1, steps = Math.round(mins * 60 / dt);
  for (let k = 0; k < steps; k++) {
    s.step(dt); now += dt; v._ships(now, dt); v._raid(now, dt); v._shots(dt); s.events.length = 0;
    const fly = s.ships.map((x) => [x, v.shipObjs.get(x.id)]).filter(([, o]) => o && o.visible);
    for (const [x, o] of fly) {
      if (lastState.get(x.id) !== x.state) { lastState.set(x.id, x.state); seen[x.state]++; seen.kinds.add(x.kind); if (x.state === 'approach' && v.shut.has(x.dock) && bad.length < 12) bad.push(`a ${x.kind} was sent to a shut berth (${x.dock})`); }
      if (x.state === 'docked') continue;
      // far outside the envelope there is nothing to hit
      if (o.position.distanceTo(v.envC) > v.envR + 40) continue;
      fwd.set(1, 0, 0).applyQuaternion(o.quaternion); sdw.set(0, 0, 1).applyQuaternion(o.quaternion);
      // the hull, as points: nose and tail, the middle (half its height), and either side of the middle (its beam)
      for (const [f, w, need] of [[0, 0, HIGH[x.kind]], [0.85, 0, 0.25], [-0.85, 0, 0.25], [0, 1, 0.3], [0, -1, 0.3]]) {
        const g = v._gap(P.copy(o.position).addScaledVector(fwd, f * HALF[x.kind]).addScaledVector(sdw, w * (BEAM[x.kind] - 0.3)), o.userData.dock) - need;
        if (g < worst.hull) { worst.hull = g; worst.hullAt = `${x.kind} ${x.state} t=${x.t.toFixed(1)} at ${o.position.toArray().map((n) => n.toFixed(1))} ${f ? (f > 0 ? 'nose' : 'tail') : w ? 'side' : 'middle'}`; }
        if (g < 0 && bad.length < 12) bad.push(`in a hull by ${(-g).toFixed(2)}: ${x.kind} ${x.state} t=${x.t.toFixed(1)} ${f ? (f > 0 ? 'nose' : 'tail') : w ? 'side' : 'middle'} at ${P.toArray().map((n) => n.toFixed(1))} dock ${o.userData.dock} (${(s.parts.get(o.userData.dock) || {}).type})`);
      }
      for (const [y, o2] of fly) {
        if (y.id <= x.id && y.state !== 'docked') continue;
        const g = o.position.distanceTo(o2.position) - BEAM[x.kind] - BEAM[y.kind] - 0.4;
        if (g < worst.ships) { worst.ships = g; worst.shipsAt = `${x.kind} ${x.state} t=${x.t.toFixed(1)} dock ${x.dock || x.lastDock} and ${y.kind} ${y.state} dock ${y.dock || y.lastDock} at ${o.position.toArray().map((n) => n.toFixed(1))}`; }
        if (g < 0 && bad.length < 12) bad.push(`two ships ${(-g).toFixed(2)} into each other: ${x.kind} ${x.state} t=${x.t.toFixed(1)} and ${y.kind} ${y.state} t=${y.t.toFixed(1)} at ${o.position.toArray().map((n) => n.toFixed(1))}`);
      }
    }
    if (s.raid && s.raid.state === 'fight') {
      const rs = v.raiders.children;
      rs.forEach((o, i) => {
        const g = v._gap(o.position) - 1.2; if (g < worst.raider) worst.raider = g;
        if (g < 0 && bad.length < 12) bad.push(`a raider in a hull by ${(-g).toFixed(2)}`);
        for (const [x, o2] of fly) { const d = o.position.distanceTo(o2.position) - BEAM[x.kind] - 1.1; if (d < worst.raiderShip) worst.raiderShip = d; }
        for (let m = i + 1; m < rs.length; m++) { const d = o.position.distanceTo(rs[m].position) - 2.2; if (d < worst.raiderRaider) worst.raiderRaider = d; }
      });
    }
    for (const sh of v.shotList || []) if (sh.craft && sh.t > 0.8) { const g = v._gap(sh.o.position, sh.skip) - 0.6; if (g < worst.craft) worst.craft = g; if (g < 0 && bad.length < 12) bad.push(`a craft leaving for the ground is in a hull by ${(-g).toFixed(2)} at ${sh.o.position.toArray().map((n) => n.toFixed(1))}`); }
    // now and then: a raid, a sortie from every bay, and a berth pulled out from under a ship on its way in
    if (k % 2400 === 1200 && !s.raid) { s.callRaid && s.callRaid(); seen.raids++; }
    if (k % 300 === 150) for (const t of ['eaglehangar', 'pelicanbay', 'hangar', 'barracks', 'gunmount']) for (const id of ids[t] || []) { const sys = { eaglehangar: 'eagle', pelicanbay: 'seaf', hangar: 'seaf', barracks: 'seaf', gunmount: 'uav' }[t]; if (s.parts.get(id)) { v.fire({ sys, part: id }); seen.craft++; } }
    if (k % 3000 === 2000) { const x = s.ships.find((y) => y.state === 'approach' && y.t > 3 && y.t < 9); if (x) { const d = s.parts.get(x.dock); if (d && d.type === 'dockport') { s._remove(d); seen.reroute++; } } }
  }
  seen.kinds = [...seen.kinds];
  return { worst, bad, seen, log, envR: v.envR, parts: s.parts.size, shutAtStart, docks: [...s.parts.values()].filter((p) => s.def(p).berth).length };
}, +mins);
console.log(`station of ${out.parts} parts, envelope radius ${out.envR.toFixed(1)}; ${out.docks} berths, shut for want of a clear way in: ${out.shutAtStart.join(', ') || 'none'}`);
for (const l of out.log) console.log('note:', l);
console.log('seen:', JSON.stringify(out.seen));
const w = out.worst;
console.log(`closest a ship's hull came to the station: ${w.hull.toFixed(2)}   (${w.hullAt})`);
console.log(`closest two ships' hulls came:              ${w.ships.toFixed(2)}   (${w.shipsAt})`);
console.log(`closest a raider came to the station ${w.raider.toFixed(2)}, to a ship ${w.raiderShip.toFixed(2)}, to another raider ${w.raiderRaider.toFixed(2)}; a craft leaving for the ground ${w.craft.toFixed(2)}`);
for (const l of out.bad) console.log('FAIL ', l);
for (const e of errs.slice(0, 5)) console.log('page error:', e);
const ok = !out.bad.length && !errs.length && w.raiderShip >= 0 && w.raiderRaider >= 0 && out.seen.approach > 5 && out.seen.depart > 5;
console.log(ok ? 'ALL CLEAR' : 'PROBLEMS');
await b.close(); process.exit(ok ? 0 : 1);
