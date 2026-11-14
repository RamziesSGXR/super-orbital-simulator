// Story check, no browser: runs the economy, the Broken Station and a save and load, and prints what reached the commander.
// Usage: node test/story.mjs [minutes=16] [seed=1] [answer: first | last | none]
import { Station } from '../js/sim.js';
import { C } from '../js/config.js';
const minutes = +(process.argv[2] || 16), seed = +(process.argv[3] || 1), how = process.argv[4] || 'first';
let bad = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) bad++; };
const run = (st, min, log) => {
  for (let i = 0; i < min * 60 * 20; i++) {
    st.step(0.05);
    for (const e of st.events) {
      if (e.type === 'comms' && (e.request || e.auto)) log.push(`${st.stamp()} [${e.from}] ${e.text}${e.options ? '  {' + e.options.join(' | ') + '}' : ''}`);
      if (e.type === 'tier') log.push(`${st.stamp()} TIER ${C.tiers[e.tier].name}`);
      if (e.type === 'raid') log.push(`${st.stamp()} RAID ${e.state}${e.hits ? ' hits ' + e.hits.length : ''}`);
    }
    st.events.length = 0;
    if (how !== 'none') for (const r of [...st.requests]) st.answer(r.id, how === 'first' ? 0 : r.options.length - 1);
  }
};
const st = new Station(seed, 'run'), b = (t, h, p, r = 0) => { const x = st.build(t, h, p, r); if (!x.ok) throw new Error(`${t}: ${x.why}`); return x.id; };
const core = b('core', 1, 1), re = b('reactor', core, 1); b('spire', re, 1); b('hab', 1, 4); b('hab', 1, 5); b('dockport', 1, 2); b('cargo', 1, 3); b('core', 1, 0);
const log = []; run(st, minutes, log);
console.log(log.join('\n'));
console.log(`\nweek ${st.week()} day ${st.dow()}  cap ${st.capability()}  credits ${Math.round(st.credits)}  staff ${JSON.stringify(st.staff)}`);
console.log(`stock ${Object.entries(st.stock).map(([k, x]) => `${k} ${Math.round(x)}`).join(', ')}  short ${Object.entries(st.short).filter(([, x]) => x).map(([k]) => k).join(',') || 'none'}`);
console.log(`mood ${Object.entries(st.sat).map(([k, x]) => `${k} ${Math.round(x)}`).join(', ')}  auto ${st.stats.auto}  raids ${st.stats.raidsWon}/${st.stats.raidsLost}  research ${Math.round(st.stats.research)}`);
const kinds = new Set(st.reqLog.map((r) => r.kind));
check('time moves in days and weeks', st.week() >= 2 && st.day === Math.floor(st.t / C.time.daySec));
check('crates stock the stores', Object.values(st.stock).some((x) => x > C.supply.start));
check('a faction changed the station without asking', st.stats.auto >= 1);
check('something reached the commander', st.reqLog.length >= 2, [...kinds].join(','));
check('everyone has a story', st.agents.every((a) => a.story.length >= 1));
check('a raid came', st.stats.raidsWon + st.stats.raidsLost >= 1 || minutes < 15);
// save and load: the same station, and it keeps running the same way
const json = JSON.stringify(st.save()), st2 = Station.load(JSON.parse(json));
check('a save loads', !!st2 && st2.parts.size === st.parts.size && st2.agents.length === st.agents.length && st2.capability() === st.capability(), `${Math.round(json.length / 1024)} KB`);
for (let i = 0; i < 1200; i++) { st.step(0.05); st2.step(0.05); } st.events.length = 0;
check('and runs on identically', st2.stats.crates === st.stats.crates && Math.abs(st2.credits - st.credits) < 1e-6 && st2.agents.length === st.agents.length);
// the Broken Station
const w = new Station(seed, 'broken'), dark0 = [...w.parts.values()].filter((p) => p.fault).length, wl = [];
check('the Broken Station starts dark', w.parts.size >= 15 && dark0 >= 5 && w.goal && w.residents() === 4, `${w.parts.size} parts, ${dark0} dark`);
run(w, 10, wl);
const dark1 = [...w.parts.values()].filter((p) => p.fault).length;
check('its engineers bring parts back', dark1 < dark0, `${dark0} -> ${dark1}; ${w.goalItems().map((i) => `${i.label} ${i.have}/${i.need}`).join(', ')}`);
// free play: nothing asks
const f = new Station(seed, 'sandbox'); for (let i = 0; i < 6000; i++) f.step(0.05);
check('free play has no requests, raids or shortages', !f.requests.length && !f.reqLog.length && !Object.values(f.short).some(Boolean));
console.log(bad ? `\n${bad} FAILED` : '\nALL PASS');
process.exit(bad ? 1 : 0);
