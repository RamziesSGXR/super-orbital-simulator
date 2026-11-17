// Market check, no browser: freighters come for the trade, not for the berths. Builds the same station with 1 to 8 Docking Ports
// and runs each for the same time. Then the price: opening the lanes wide brings more crates and each is worth less.
// Usage: node test/market.mjs [minutes=20] [seed=1]
import { Station } from '../js/sim.js';
import { C } from '../js/config.js';
const mins = +(process.argv[2] || 20), seed = +(process.argv[3] || 1);
let bad = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) bad++; };
const run = (st, sec) => { for (let i = 0; i < sec * 20; i++) { st.step(0.05); st.events.length = 0; for (const r of [...st.requests]) st.answer(r.id, 0); } };
function station(docks, rate = 'normal', tier = 0) {
  const st = new Station(seed, 'run'); st.tier = tier; const b = (t, h, p) => { const x = st.build(t, h, p); if (!x.ok) throw new Error(`${t} on ${h}:${p}: ${x.why}`); return x.id; };
  st.credits = 99999; st.setOrder('traffic', 'rate', rate);
  const c = b('core', 1, 1), h = b('cargo', 1, 3); b('hab', 1, 4); b('solar', c, 2);
  const c2 = b('core', c, 1), spots = [[1, 2], [1, 5], [c, 3], [c, 4], [c, 5], [h, 1], [h, 2], [c2, 3]];
  for (let i = 0; i < docks; i++) b('dockport', ...spots[i]);
  run(st, 60); st.addColonists(4);
  const s0 = { ...st.stats }, arrivals = () => st.stats.ships + st.stats.lost;
  const a0 = arrivals(), cr0 = st.stats.crates, t0 = st.totals.trade || 0, used = {};
  for (let k = 0; k < mins * 60; k++) { run(st, 1); for (const x of st.ships) if (x.state === 'docked' && x.dock) used[x.dock] = 1; }
  const L = st.ledger();
  return { docks, ships: arrivals() - a0, lost: st.stats.lost - s0.lost, crates: st.stats.crates - cr0, trade: Math.round((st.totals.trade || 0) - t0), price: st.priceK(), rep: st._mk().rep, used: Object.keys(used).length, idle: L.trade.berths.spare, need: L.trade.needBerths, demand: L.trade.demand.total };
}
const R = [1, 2, 4, 8].map((n) => station(n));
console.log(' docks  ships  lost  crates  trade CR  price  reputation  berths used  spare  enough for');
for (const r of R) console.log(`${String(r.docks).padStart(6)} ${String(r.ships).padStart(6)} ${String(r.lost).padStart(5)} ${String(r.crates).padStart(7)} ${String(r.trade).padStart(9)}  ${r.price.toFixed(2)}  ${r.rep.toFixed(2).padStart(10)}  ${String(r.used).padStart(11)} ${String(r.idle).padStart(5)} ${String(r.need).padStart(11)}`);
const [one, two, four, eight] = R;
check('going from 2 to 8 berths does not bring many more ships', eight.ships <= two.ships * 1.25 + 3, `${two.ships} → ${eight.ships}`);
const busy1 = station(1, 'normal', 2), busy4 = station(4, 'normal', 2);
console.log(`  a fortress's trade: 1 berth ${busy1.ships} ships, ${busy1.lost} lost, reputation ${busy1.rep.toFixed(2)} · 4 berths ${busy4.ships} ships, ${busy4.lost} lost, reputation ${busy4.rep.toFixed(2)}`);
check('too few berths for the trade: ships are lost and the reputation falls; enough berths keep it up', busy1.lost > busy4.lost + 3 && busy1.rep < busy4.rep - 0.1);
check('every berth on the station is used, not only the first', four.used === 4 && eight.used >= 7, `${four.used}/4, ${eight.used}/8`);
check('with more berths than the trade needs, the extra ones are reported', eight.idle >= 4 && eight.need <= 3 && one.idle === 0, `${eight.idle} spare, enough for ${eight.need}`);
const wide = station(4, 'high'), thin = station(4, 'low');
console.log(`  high traffic: ${wide.crates} crates at ×${wide.price.toFixed(2)} = ${wide.trade} CR · low: ${thin.crates} crates at ×${thin.price.toFixed(2)} = ${thin.trade} CR · normal: ${four.crates} crates, ${four.trade} CR`);
check('opening the lanes brings more crates, each worth less', wide.crates > four.crates && wide.price < four.price - 0.05);
check('thinning the traffic brings fewer crates, each worth more', thin.crates < four.crates && thin.price > four.price + 0.05);
check('so more traffic is not simply more money', wide.trade < four.trade * (wide.crates / four.crates) * 0.92, `${(wide.trade / four.trade).toFixed(2)}× the money for ${(wide.crates / four.crates).toFixed(2)}× the crates`);
// shortages bring supply runs
{
  const st = new Station(seed, 'run'); for (const k of Object.keys(C.supplies)) st.stock[k] = 0;
  const d0 = st.tradeDemand(); st.short.rations = true; const d1 = st.tradeDemand();
  check('a station short of supplies is sent supply runs on top', d0.runs > 0 && d1.total >= d0.total && d0.total > d0.base * d0.repK * d0.hub, `+${d0.runs} crates a minute`);
}
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
