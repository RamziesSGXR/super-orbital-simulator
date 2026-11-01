// Runs the station with no browser: builds a scripted station, plays N minutes and prints the economy.
// Usage: node test/headless.mjs [minutes=12] [layout=near|far] [seed=1]
import { Station } from '../js/sim.js';
import { v } from '../js/math3.js';

const minutes = Number(process.argv[2] || 12), layout = process.argv[3] || 'near', seed = Number(process.argv[4] || 1);
const st = new Station(seed);
const b = (type, host, port, rot = 0) => { const r = st.build(type, host, port, rot); if (!r.ok) throw new Error(`${type} on ${host}:${port}: ${r.why}`); return r.id; };

// Command (id 1) has ports 0 (down), 1 (up) and 2-5 round its side.
const core = b('core', 1, 1);
const reactor = b('reactor', core, 1);
b('spire', reactor, 1);
b('hab', 1, 4); b('hab', 1, 5);
if (layout === 'near') {
  b('dockport', 1, 2);          // the bay right on Command
  b('cargo', 1, 3);             // and the cargo on the other side of it
} else {
  // The bay at the end of a long truss below, the cargo at the end of another one above.
  const low = b('core', 1, 0);
  let t = b('truss', low, 2); t = b('truss', t, 1);
  b('dockport', t, 1);
  const u = b('truss', reactor, 3);
  b('cargo', u, 1);
}
const fmt = (x) => Math.round(x).toLocaleString('en-US');
const dt = 1 / 20;
let ms = null;
console.log(`layout=${layout} seed=${seed}  parts=${st.parts.size}  reach=${Math.max(...[...st.parts.values()].map((p) => v.len(st.center(p)))).toFixed(1)}`);
console.log('min   credits  net/min  res/beds  morale  crates  ships  lost  power  haulers');
for (let s = 1; s <= minutes * 60 / dt; s++) {
  st.step(dt);
  for (const e of st.events) if (e.type === 'milestone' && ms === null) ms = st.t;
  st.events.length = 0;
  if (s % Math.round(60 / dt) === 0) {
    console.log(`${String(Math.round(st.t / 60)).padStart(3)}  ${fmt(st.credits).padStart(8)}  ${fmt(st.netPerMin()).padStart(7)}  ${String(st.residents()).padStart(3)}/${String(st.beds()).padEnd(4)}  ${String(Math.round(st.morale)).padStart(6)}  ${String(st.stats.crates).padStart(6)}  ${String(st.stats.ships).padStart(5)}  ${String(st.stats.lost).padStart(4)}  ${st.demand}/${st.supply}   ${st.agents.filter((a) => a.role === 'hauler').length}`);
  }
}
console.log(`milestone ${ms === null ? 'not reached' : 'at ' + (ms / 60).toFixed(1) + ' min'}; agents ${st.agents.length}; free ports ${st.freePorts().length}`);
