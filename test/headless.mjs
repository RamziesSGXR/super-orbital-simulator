// Runs the station with no browser: builds a scripted layout, plays N minutes and prints the economy.
// Usage: node test/headless.mjs [minutes=12] [layout=near|far] [seed=1]
import { Station } from '../js/sim.js';

const minutes = Number(process.argv[2] || 12), layout = process.argv[3] || 'near', seed = Number(process.argv[4] || 1);
const st = new Station(seed);
const must = (t, c, r) => { const res = st.build(t, c, r); if (!res.ok) throw new Error(`${t} at ${c},${r}: ${res.why}`); };

// A lift shaft beside Command (frames 13, decks 1-3) and a short corridor out to the reactor.
for (const r of [0, 1, 2]) must('lift', 13, r);
must('corridor', 12, 2);
must('reactor', 10, 2);
if (layout === 'near') {
  must('dock', 11, 0);         // top deck, right next to the shaft
  must('cargo', 11, 1);        // one deck down, also next to the shaft
} else {
  // The bay at the far end of the top deck, the cargo at the far end of the bottom deck.
  for (const c of [14, 15, 16, 17, 18, 19]) must('corridor', c, 0);
  must('dock', 20, 0);
  for (const r of [3, 4, 5]) must('lift', 13, r);
  for (const c of [10, 11, 12]) must('corridor', c, 5);
  must('cargo', 8, 5);
}
must('quarters', 16, 2);
must('quarters', 18, 2);
must('engineering', 20, 2);

const fmt = (v) => Math.round(v).toLocaleString('en-US');
const dt = 1 / 20;
let faults = 0, fixed = 0, msAt = null;
console.log(`layout=${layout} seed=${seed}`);
console.log('min   credits  net/min  res/beds  morale  crates  ships  lost  smug(c/x)  power  staff L/E');
for (let s = 1; s <= minutes * 60 / dt; s++) {
  st.step(dt);
  for (const e of st.events) { if (e.type === 'fault') faults++; if (e.type === 'fixed') fixed++; if (e.type === 'milestone' && msAt === null) msAt = st.t; }
  st.events.length = 0;
  if (s % Math.round(60 / dt) === 0) {
    const m = Math.round(st.t / 60);
    console.log(`${String(m).padStart(3)}  ${fmt(st.credits).padStart(8)}  ${fmt(st.netPerMin()).padStart(7)}  ${String(st.residents()).padStart(3)}/${String(st.beds()).padEnd(4)}  ${String(Math.round(st.morale)).padStart(6)}  ${String(st.stats.crates).padStart(6)}  ${String(st.stats.ships).padStart(5)}  ${String(st.stats.lost).padStart(4)}  ${String(st.stats.caught).padStart(4)}/${String(st.stats.contraband).padEnd(4)}  ${st.supply}/${st.demand}  ${st.staff.logistics}/${st.staff.engineering}`);
  }
}
console.log(`faults ${faults}, repaired ${fixed}; milestone ${msAt === null ? 'not reached' : 'at ' + (msAt / 60).toFixed(1) + ' min'}; agents ${st.agents.length}`);
console.log('totals', Object.fromEntries(Object.entries(st.totals).map(([k, v]) => [k, Math.round(v)])));
