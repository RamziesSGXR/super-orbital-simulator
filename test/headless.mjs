// Runs the station with no browser: builds a scripted station, plays N minutes and prints the economy.
// Usage: node test/headless.mjs [minutes=12] [layout=near|far|big] [seed=1]
import { Station } from '../js/sim.js';

const minutes = Number(process.argv[2] || 12), layout = process.argv[3] || 'near', seed = Number(process.argv[4] || 1);
const st = new Station(seed, layout === 'big' ? 'sandbox' : 'run');
const b = (type, host, port, rot = 0) => { const r = st.build(type, host, port, rot); if (!r.ok) throw new Error(`${type} on ${host}:${port}: ${r.why}`); return r.id; };

// Command (id 1) has ports 0 (down), 1 (up) and 2-5 round its side.
const core = b('core', 1, 1);
const reactor = b('reactor', core, 1);
b('spire', reactor, 1);
b('hab', 1, 4); b('hab', 1, 5);
if (layout === 'near') {
  b('dockport', 1, 2); b('cargo', 1, 3);
} else if (layout === 'far') {
  const low = b('core', 1, 0);
  let t = b('truss', low, 2); t = b('truss', t, 1);
  b('dockport', t, 1);
  const u = b('truss', reactor, 3);
  b('cargo', u, 1);
} else {
  // A big station for free play: a ring, a docking ring with pylons, a hangar, a drydock, and rooms changed inside.
  b('dockport', 1, 2); b('cargo', 1, 3);
  const ring = b('ring', 1, 0), c2 = b('core', ring, 1), big = b('bigring', c2, 1);
  for (const p of [2, 3, 4, 5, 6, 7]) b(p % 2 ? 'pylon' : 'dockport', big, p);
  b('hangar', core, 2); b('drydock', core, 3); b('solar', core, 4); b('solar', core, 5);
  for (let i = 0; i < 40; i++) st.step(0.5);
  st.setRoom(ring, 0, 'secoffice'); st.setRoom(ring, 1, 'medbay'); st.setRoom(ring, 2, 'market'); st.setRoom(ring, 3, 'workshop');
}
const fmt = (x) => Math.round(x).toLocaleString('en-US');
const dt = 1 / 20;
const tiers = [];
console.log(`layout=${layout} seed=${seed}  parts=${st.parts.size}`);
console.log('min   credits  net/min  res/beds  morale  crates  ships  lost  power   staff H/E/O/M  faults caught/miss  cap  sat S/M/O/D  req');
// Like a commander who says yes to everything: approve each request as it comes in, so the whole loop gets exercised.
const approveAll = process.argv[5] === 'approve';
for (let s = 1; s <= minutes * 60 / dt; s++) {
  st.step(dt);
  for (const e of st.events) if (e.type === 'tier') tiers.push(`${e.tier}@${(st.t / 60).toFixed(1)}m`);
  st.events.length = 0;
  if (approveAll) for (const r of [...st.requests]) st.approve(r.id);
  if (s % Math.round(60 / dt) === 0) {
    const S = st.staff;
    console.log(`${String(Math.round(st.t / 60)).padStart(3)}  ${fmt(st.credits).padStart(8)}  ${fmt(st.netPerMin()).padStart(7)}  ${String(st.residents()).padStart(3)}/${String(st.beds()).padEnd(4)}  ${String(Math.round(st.morale)).padStart(6)}  ${String(st.stats.crates).padStart(6)}  ${String(st.stats.ships).padStart(5)}  ${String(st.stats.lost).padStart(4)}  ${String(st.demand).padStart(3)}/${String(st.supply).padEnd(3)}  ${S.hauler}/${S.engineer}/${S.officer}/${S.medic}         ${st.stats.faults}/${st.stats.fixed || 0}  ${st.stats.caught}/${st.stats.contraband}   ${String(st.capability()).padStart(5)}  ${['supply', 'maintenance', 'security', 'medical'].map((k) => Math.round(st.sat[k])).join('/')}  ${st.reqLog.length}+${st.requests.length}`);
  }
}
console.log(`tiers reached: ${tiers.join(' ') || 'none'}; agents ${st.agents.length}; repairs ${st.stats.repairs}`);
