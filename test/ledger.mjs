// Accounts check, no browser: the breakdown has to be TRUE (its lines add up to what the credits actually do), and the station
// has to be asked for the right thing before a credit spiral, not after.
// Usage: node test/ledger.mjs [seed=1]
import { Station } from '../js/sim.js';
import { C } from '../js/config.js';
const seed = +(process.argv[2] || 1);
let bad = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) bad++; };
const run = (st, sec, said) => { for (let i = 0; i < sec * 20; i++) { st.step(0.05); for (const e of st.events) if (e.type === 'comms' && said) said.push(`[${e.from}] ${e.text}`); st.events.length = 0; for (const r of [...st.requests]) st.answer(r.id, 0); } };
const mk = () => { const st = new Station(seed, 'run'); st.b = (t, h, p, r = 0) => { const x = st.build(t, h, p, r); if (!x.ok) throw new Error(`${t}: ${x.why}`); return x.id; }; return st; };

// 1. A working station: the lines of the accounts add up to what the credits really did over the next minute.
{
  const st = mk(); st.b('hab', 1, 4); st.b('hab', 1, 5); st.b('dockport', 1, 2); st.b('cargo', 1, 3); st.b('solar', st.b('core', 1, 1), 2);
  run(st, 300);
  // Trade comes a shipload at a time, so one minute can differ from the next: the test is that over a longer run the accounts
  // and the credits tell the same story.
  const c0 = st.credits; let acc = 0; const MIN = 12;
  for (let i = 0; i < 60 * MIN; i++) { acc += st.ledger().credits.net / 60; run(st, 1); }
  const real = st.credits - c0;
  console.log(`      ${MIN} minutes of play: the accounts said ${acc.toFixed(0)} CR, the credits moved ${real.toFixed(0)} CR`);
  const L = st.ledger(), c = L.credits;
  check('the credit lines add up to what the credits really do', Math.abs(real - acc) < Math.max(30, Math.abs(real) * 0.08), `${(100 * (acc - real) / Math.abs(real)).toFixed(1)}% apart`);
  check('income, spending and net agree with their lines', Math.abs(c.income - c.ins.reduce((s, x) => s + x.v, 0)) < 1e-6 && Math.abs(c.spend - c.outs.reduce((s, x) => s + x.v, 0)) < 1e-6 && Math.abs(c.net - c.income - c.spend) < 1e-6);
  check('upkeep in the accounts is the upkeep the station pays', Math.abs(-c.outs.filter((x) => x.label !== 'Free medical care').reduce((s, x) => s + x.v, 0) - st.upkeep()) < 1e-6, `${st.upkeep()} a minute`);
  check('power made and used match the readout', L.power.make.reduce((s, x) => s + x.v, 0) === st.supply && -L.power.use.reduce((s, x) => s + x.v, 0) === st.demand, `${st.demand} of ${st.supply}`);
  check('morale lines add up to where morale is heading', Math.abs(L.morale.lines.reduce((s, x) => s + x.v, 0) - Object.values(st.moraleParts()).reduce((s, x) => s + x, 0)) < 0.2);
  check('every supply is listed with what is in the stores and what a week uses', L.stores.supplies.length === Object.keys(C.supplies).length && L.stores.supplies.every((x) => x.have === Math.floor(st.stock[x.type]) && x.need === st.weeklyNeed(x.type)));
  check('a station that pays its way is asked only for what grows it', st.asks().length > 0 && st.asks().every((a) => !a.urgent), st.asks().map((a) => a.tag).join(', '));
}
// 2. A new station with nothing built: asked for trade first, not scolded.
{
  const st = mk(); run(st, 50);
  const A = st.asks();
  check('a new station is asked for a Docking Port first', A[0] && /Docking Port/.test(A[0].why) && !A[0].urgent, A[0] && `${A[0].text} ${A[0].why}`);
  check('and for what its next tier needs, with how to get it', A.some((a) => a.tag === 'tier-residents') && A.every((a) => a.why && a.why.length > 10));
}
// 3. Overbuilt and earning nothing: the warning comes while there are still credits, names the cause, and is said once.
{
  const st = mk(), said = [];
  let h = 1; for (let i = 0; i < 4; i++) { h = st.b('core', h, 1); for (const p of [2, 3, 4, 5]) st.b('hab', h, p); }
  st.credits = 400; run(st, 240, said);
  const c = st.ledger().credits, A = st.asks(), warn = said.filter((x) => /losing|in debt/.test(x));
  console.log(`      overbuilt: ${Math.round(st.credits)} CR, net ${c.net.toFixed(1)} a minute, ${c.idle.n} parts idle costing ${c.idle.v}`);
  check('an overbuilt station is told it is losing credits, and why', A[0] && A[0].tag === 'credits' && A[0].urgent && /Docking Port|empty or broken/.test(A[0].why), A[0] && `${A[0].text} ${A[0].why}`);
  check('the warning went out on the radio while there was still something to act on', warn.length >= 1 && warn.length <= 2, `${warn.length} time(s): ${warn[0] || ''}`);
  check('the parts standing empty are counted with what they cost', c.idle.n >= 4 && c.idle.v >= 4 * C.parts.core.up, `${c.idle.n} parts empty or broken, costing ${c.idle.v} a minute`);
  check('building more is priced before the click', st.costOf('hab').up >= C.parts.hab.up && st.costOf('solar').pw < 0);
}
// 4. Power short, and a faction with nobody on duty: both asked for by name.
{
  const st = mk(); for (const p of [2, 3, 4, 5]) st.b('gunmount', 1, p);
  run(st, 60);
  const A = st.asks();
  check('short of power: Maintenance asks for a Solar Array or a Reactor', st.eff < 1 && A.some((a) => a.tag === 'power' && a.urgent && /Solar Array/.test(a.why)), `${st.demand} of ${st.supply}`);
}
// 5. Morale: every way to raise it does what it says, and where it has been is kept.
{
  const st = mk(); st.b('hab', 1, 4); st.b('dockport', 1, 2); st.b('cargo', 1, 3);
  run(st, 360); st.setTax(18); run(st, 5);
  const target = () => Object.values(st.moraleParts()).reduce((s, x) => s + x, 0), way = (id) => st.ledger().morale.ways.find((w) => w.do === id);
  check('there are residents to have morale, and it has been recorded four times a day', st.residents() > 0 && st.mlog.length >= 30 && st.mlog.length <= 56, `${st.mlog.length} readings`);
  check('the ways to raise morale are listed, orders first, each with what it adds and what it costs', st.ledger().morale.ways.length >= 4 && st.ledger().morale.ways.every((w) => w.gain > 0 && w.cost) && !!st.ledger().morale.ways[0].do);
  let t0 = target(), w = way('tax'); st.setTax(C.morale.taxFree);
  check('lowering the tax adds what it said it would', w && Math.abs(target() - t0 - w.gain) < 0.01 && !way('tax'), w && `+${w.gain}`);
  t0 = target(); w = way('rations2'); const need0 = st.weeklyNeed('rations'); st.setOrder('supply', 'rations', 'double');
  check('double rations add what they said, and rations go twice as fast', w && Math.abs(target() - t0 - w.gain) < 0.01 && st.weeklyNeed('rations') === need0 * 2 && !way('rations2'));
  st.setOrder('supply', 'rations', 'short');
  check('short rations halve what is eaten and cost morale', st.weeklyNeed('rations') === need0 / 2 && Math.abs(target() - t0 - C.morale.ration.short[0]) < 0.01 && !!way('rations1'));
  st.setOrder('supply', 'rations', 'normal');
  t0 = target(); w = way('festival'); const c0 = st.credits, r = st.celebrate();
  check('a Liberty Day costs its credits and lifts morale at once', r.ok && w && Math.abs(target() - t0 - w.gain) < 0.01 && Math.abs(c0 - st.credits - C.morale.festival.cost) < 0.5, `+${w && w.gain} for ${C.morale.festival.cost} CR`);
  check('another cannot be held the same week', !st.celebrate().ok && !way('festival') && /next can be held/.test(st.canCelebrate().why), st.canCelebrate().why);
  run(st, C.morale.festival.days * C.time.daySec + 2);
  check('and it wears off in a few days', (st.cheer || 0) === 0);
  check('a Recreation Deck is a room like any other, and adds leisure', C.rooms.gym.leisure === 2 && C.roomOrder.includes('gym'));
}
// 6. Contraband: unrest has a ceiling, and there is always a way to bring it down.
{
  const st = mk(); st.b('hab', 1, 4); st.b('dockport', 1, 2); st.b('cargo', 1, 3);
  run(st, 200); st.unrest = 5000; run(st, 1);
  check('unrest can never run away: it stops at its ceiling', st.unrest <= C.morale.unrestMax && st.moraleParts().unrest >= -C.morale.unrestMax, `unrest ${st.unrest.toFixed(0)}`);
  st.requests.length = 0; st.unrest = 25; st.contraAsk = undefined;
  for (let i = 0; i < 40 && !st.requests.some((r) => r.dilemma === 'contraband'); i++) { st.step(0.05); st.events.length = 0; }
  const r = st.requests.find((x) => x.dilemma === 'contraband');
  check('smuggled goods in the habs come to the commander\'s desk, at any tier', !!r && st.tier === 0 && r.options.join() === 'CRACK DOWN,AMNESTY · 80 CR,LET IT PASS', r && r.text);
  const u0 = st.unrest; if (r) st.answer(r.id, 0);
  check('cracking down brings it down at once', st.unrest <= u0 - 13, `${u0.toFixed(0)} → ${st.unrest.toFixed(0)}`);
  st.unrest = 20; const w = st.ledger().morale.ways.find((x) => x.do === 'amnesty'), c0 = st.credits, u1 = st.unrest; st.amnesty();
  check('an amnesty halves it, for its credits, and is listed among the ways to raise morale', !!w && Math.abs(st.unrest - u1 / 2) < 0.01 && Math.abs(c0 - st.credits - C.morale.amnesty.cost) < 0.5 && !st.canAmnesty().ok);
  check('a Customs Scanner can be built at an Outpost, and is offered as a way out', C.rooms.customs.tier === 0 && st.ledger().morale.ways.some((x) => /Customs Scanner/.test(x.label)));
  // a scanner near the berth catches smugglers with nobody on duty
  const sc = mk(); const h = sc.b('cargo', 1, 3); sc.b('dockport', 1, 2); sc.b('hab', 1, 4); run(sc, 30); sc.setRoom(h, 1, 'customs'); C.ships.smuggler = 1;
  run(sc, 600); C.ships.smuggler = 0.15;
  check('a Customs Scanner stops most smuggled loads with no officers aboard', sc.stats.caught > sc.stats.contraband && sc.stats.caught >= 5 && !sc.staff.officer, `caught ${sc.stats.caught}, slipped through ${sc.stats.contraband}`);
}
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
