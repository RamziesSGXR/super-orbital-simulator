// THE ACCOUNTS: where the credits, the power, the people, the morale and the supplies come from and go to, line by line; and
// THE ASKS: what the station needs next, said plainly, with the reason. Nothing here changes the station. It only adds it up,
// so the commander is never left guessing why the credits are draining or what to build to grow.
import { C } from './config.js';

const sum = (xs) => xs.reduce((s, x) => s + x.v, 0);
const MORALE = { base: 'A quiet station', tax: 'Colonist tax', leisure: 'Bars, markets and parks', power: 'Short of power', unrest: 'Unrest and contraband', faults: 'Faults in living quarters',
  medical: 'Medical care', broadcast: 'Broadcasts', shifts: 'Double shifts', broke: 'The station is in debt', rations: 'No rations', magazines: 'Magazines beside the beds',
  rationing: 'The rations order', festival: 'Liberty Day' };

export function installLedger(Station) {
  Object.assign(Station.prototype, {
    // Credits a minute in one line of the accounts, measured over the last minute of play.
    flow(key) {
      const f = this._flow && this._flow[key]; if (!f) return 0;
      const s = Math.floor(this.t); let x = 0;
      for (const b of f) if (b.s > s - 60 && b.s <= s) x += b.v;
      return x * 60 / Math.min(60, Math.max(1, this.t));
    },
    // Every part or room of a kind as one line: "3 × Habitation Module".
    _group(pick) {
      const m = new Map();
      for (const p of this.parts.values()) {
        if (p.state !== 'active') continue;
        for (const [name, v, note] of pick(p, this.def(p))) { const g = m.get(name) || { label: name, n: 0, v: 0, note }; g.n++; g.v += v; m.set(name, g); }
      }
      return [...m.values()].map((g) => ({ ...g, label: g.n > 1 ? `${g.n} × ${g.label}` : g.label })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    },
    ledger() {
      const res = this.residents(), E = C.econ, day = C.time.daySec / 60;      // a station day, in minutes
      // ------------------------------------------------ credits, a minute
      const ins = [], outs = [];
      const cpm = this.cratesPerMin();
      ins.push({ label: 'Crates unloaded', v: this.flow('crates'), note: `${cpm.toFixed(1)} a minute at ${this.crateFee()} CR each (market price ×${this.priceK().toFixed(2)})`, live: true });
      ins.push({ label: 'Docking fees', v: this.flow('docking'), note: `${E.dockFee + this.fuelN * C.parts.tanks.fuel} CR a ship`, live: true });
      for (const [k, label] of [['repairs', 'Warships repaired'], ['fines', 'Smugglers fined']]) { const v = this.flow(k); if (v > 0.05) ins.push({ label, v, live: true }); }
      ins.push({ label: 'Colonist tax', v: res ? this.taxPerMin() : 0, note: `${res} residents at ${this.tax}%` });
      ins.push(...this._group((p) => (p.fault || !res ? [] : p.rooms.filter((r) => C.rooms[r].income).map((r) => [C.rooms[r].name, C.rooms[r].income]))));
      if (this.div.medical.order.care === 'fees' && this.staff.medic) ins.push({ label: 'Medical fees', v: 2 * this.staff.medic, note: `${this.staff.medic} medics` });
      const mul = this.div.maintenance.order.plan === 'preventive' ? 1.2 : 1;
      const up = [...this._group((p, d) => (d.up ? [[d.name, -d.up * mul]] : [])), ...this._group((p) => p.rooms.filter((r) => C.rooms[r].up).map((r) => [`${C.rooms[r].name} (room)`, -C.rooms[r].up * mul]))].sort((a, b) => a.v - b.v);
      const gross = -sum(up), top = up.slice(0, 7), rest = up.slice(7);
      outs.push(...top);
      if (rest.length) outs.push({ label: `Everything else (${rest.reduce((s, x) => s + x.n, 0)} parts and rooms)`, v: sum(rest) });
      if (mul > 1) outs[outs.length - 1].note = 'includes preventive maintenance, +20%';
      if (this.food > 0 && gross > 0) outs.push({ label: 'Food grown aboard', v: Math.min(this.food, gross), note: 'comes off the upkeep' });
      if (this.wages()) outs.push({ label: 'Free medical care', v: -this.wages() });
      const income = sum(ins), spend = sum(outs), net = income + spend;
      // parts that cost upkeep and do nothing: every room empty, or broken down
      let idleN = 0, idleV = 0;
      for (const p of this.parts.values()) { if (p.state !== 'active') continue; const d = this.def(p); if ((p.rooms.length && p.rooms.every((r) => r === 'empty')) || p.fault) { idleN++; idleV += d.up * mul; } }
      const credits = { now: this.credits, ins, outs, income, spend, net, perDay: net * day, runway: net < -0.05 && !this.sandbox ? Math.max(0, this.credits) / -net / day : null,
        idle: { n: idleN, v: idleV }, built: -(this.totals.build || 0), traded: this.totals.trade || 0 };
      // ------------------------------------------------ power
      const power = { supply: this.supply, demand: this.demand, eff: this.eff,
        make: this._group((p, d) => (d.pw < 0 ? [[d.name + (p.fault ? ' (broken down)' : ''), p.fault ? 0 : -d.pw]] : [])),
        use: this._group((p, d) => (d.pw > 0 ? [[d.name, -d.pw]] : [])) };
      // ------------------------------------------------ people
      const S = C.ships, free = this.freeBeds().length, mix = this.div.traffic.order.mix;
      const why = !this.berths('shuttle').length ? 'No berth a shuttle can use. Build a Docking Port, a Pylon, or a Hangar with a Shuttle Bay.'
        : !free ? 'Every bed is taken. Fit Quarters into a Habitation Module, a Ring or a Drum.'
          : this.morale < S.shuttleMorale ? `Morale is ${Math.round(this.morale)}. Colonists stop coming below ${S.shuttleMorale}.`
            : mix === 'freight' ? 'Traffic Control is set to freighters only.' : `Shuttles bring ${S.colonists} colonists at a time while there are free beds.`;
      const people = { residents: res, beds: this.beds(), free, why, leaving: this.morale < C.morale.leaveBelow,
        staff: Object.keys(C.div).filter((k) => C.div[k].staff).map((k) => ({ k, label: C.div[k].short, on: this.staff[C.div[k].staff], places: this.homes[C.div[k].staff] })) };
      // ------------------------------------------------ morale
      const mp = this.moraleParts(), morale = { now: this.morale, target: Math.max(0, Math.min(100, Object.values(mp).reduce((s, x) => s + x, 0))),
        lines: Object.entries(mp).filter(([, v]) => Math.abs(v) > 0.05).map(([k, v]) => ({ label: MORALE[k] || k, v })), ways: this.moraleWays(mp), log: this.mlog || [] };
      // ------------------------------------------------ supplies, a week
      const who = {}; for (const [k, d] of Object.entries(C.div)) if (d.uses) who[d.uses] = k;
      const supplies = Object.entries(C.supplies).map(([t, s]) => {
        const need = this.weeklyNeed(t), have = this.sandbox ? Infinity : Math.floor(this.stock[t] || 0), k = who[t];
        return { type: t, label: s.name, unit: s.unit, have, need, days: need > 0 ? have / (need / C.time.week) : Infinity, by: t === 'rations' ? `${res} residents` : k ? `${C.div[k].short}: ${this.staff[C.div[k].staff]} on duty` : '', short: !!this.short[k || 'rations'] };
      });
      const stores = { supplies, weekIn: this.weekIn || 0, lastWeek: (this.lastWeek && this.lastWeek.in) || 0, need: supplies.reduce((s, x) => s + x.need, 0), berths: this.berths('freighter').length, haulers: this.staff.hauler };
      // ------------------------------------------------ capability (the score)
      const K = C.capability, st = this.stats, staff = Object.values(this.staff).reduce((s, x) => s + x, 0), sat = Object.keys(C.factions).reduce((s, k) => s + this.sat[k], 0) / Object.keys(C.factions).length;
      const lines = [['Crates traded', st.crates * K.crate], ['Ships served', st.ships * K.ship], ['Residents', res * K.resident], ['Defences', this.defence * K.defence], ['Warships repaired', (st.repairs || 0) * K.repair],
        ['Staff on duty', staff * K.staff], ['Research', st.research * K.research], ['Raids beaten off', st.raidsWon * K.raid], ['Calls from the ground answered', (st.calls || 0) * K.call], ['The platform', this.platform().score * K.platform]]
        .filter(([, v]) => v > 0.05).map(([label, v]) => ({ label, v }));
      const cap = { now: this.capability(), lines, mood: 0.7 + 0.6 * sat / 100 };
      // ------------------------------------------------ trade: why freighters come, and what a crate is worth (market.js)
      const D = this.tradeDemand(), use = this.berthUse();
      const trade = { demand: D, supply: this.tradeSupply(), price: this.priceK(), fee: this.crateFee(), rep: this._mk().rep, berths: use,
        needBerths: use.need,
        waiting: this.ships.filter((s) => s.state === 'hold' && s.kind === 'freighter').length,
        notYet: [...this.parts.values()].filter((p) => p.state === 'active' && this.def(p).berth && this.def(p).berthRoom && !this.has(p, this.def(p).berthRoom)).map((p) => ({ name: this.name(p), room: C.rooms[this.def(p).berthRoom].name })) };
      return { credits, power, people, morale, stores, cap, trade };
    },
    // WAYS TO RAISE MORALE, from where it stands now: each with what it would add, what it costs, and (where it is an order the
    // commander can give on the spot) the order. Biggest gain first. Things already done are left out.
    moraleWays(mp = this.moraleParts()) {
      const M = C.morale, o = this.div, res = this.residents(), out = [], add = (label, gain, cost, act) => out.push({ label, gain, cost, do: act || null });
      if (!res) return out;
      if (mp.broke) add('Get the station out of debt', -mp.broke, 'see CREDITS above');
      if (mp.rations) add('Get rations back into the lockers', -mp.rations, 'freighters bring them: a berth, haulers, a Cargo Store');
      if (mp.power < -0.5) add('Make enough power', -mp.power, 'a Solar Array or a Reactor Core');
      if (this.tax > M.taxFree) add(`Lower the colonist tax to ${M.taxFree}% (now ${this.tax}%)`, (this.tax - M.taxFree) * M.taxPenalty, `−${Math.round(res * (this.tax - M.taxFree) * C.econ.taxPerPct)} CR a minute`, 'tax');
      else if (this.tax > 0) add(`Lower the colonist tax (now ${this.tax}%)`, this.tax * M.taxBonus, `each point is +${M.taxBonus} morale and −${(res * C.econ.taxPerPct).toFixed(0)} CR a minute`);
      const F = M.festival, fc = this.canCelebrate();
      add(`Hold a Liberty Day${fc.ok ? '' : ` (${fc.why.toLowerCase()})`}`, F.gain, `${F.cost} CR, wears off over ${F.days} days, one a week`, fc.ok ? 'festival' : null);
      const rat = o.supply.order.rations || 'normal';
      if (rat === 'short') add('Go back to standard rations', -M.ration.short[0], 'rations go twice as fast as now', 'rations1');
      else if (rat === 'normal' && !mp.rations) add('Issue double rations', M.ration.double[0], 'rations go twice as fast', 'rations2');
      if (mp.shifts) add('Go back to normal shifts', -mp.shifts, 'haulers work at their usual pace', 'shift');
      if (this.staff.medic && o.medical.order.care !== 'free') add('Give free medical care', 6, '10 CR a minute, and the fees are lost', 'care');
      else if (!this.staff.medic) add('Put medics on duty and give free care', 4, 'a Medbay, medkits for Medical, then 10 CR a minute');
      if (o.truth.order.broadcast !== 'patriotic') add('Broadcast the Patriotic Hour', Math.min(8, 2 + 2 * this.broadcast), o.truth.order.broadcast === 'recruitment' ? 'shuttles come at their usual rate' : 'no cost', 'patriotic');
      else if (this.broadcast < 3) add('Open another Truth Office', 2, 'each adds 2 to the Patriotic Hour, up to +8');
      const room = M.leisureMax - Math.max(-10, this.leisure);
      if (room > 0) add('Build somewhere to spend an evening', Math.min(room, 3), `Liberty Lounge +3, Mess Hall, Observation Lounge and Recreation Deck +2 each (now ${Math.round(this.leisure)} of ${M.leisureMax})`);
      const bunks = this.roomCount('bunks'); if (bunks) add(`Turn ${bunks > 1 ? `${bunks} Bunk Rooms` : 'the Bunk Room'} into Quarters`, bunks, 'half the beds');
      if (mp.faults) add('Mend the faults in living quarters', -mp.faults, this.staff.engineer ? 'engineers are on it: more of them is faster' : 'no engineers on duty: raise Maintenance\'s spare parts');
      if (mp.unrest < -0.5) {
        const am = this.canAmnesty(), every = o.security.order.checks === 'every';
        add(`Declare a contraband amnesty${am.ok ? '' : ` (${am.why.toLowerCase()})`}`, -mp.unrest / 2, `${C.morale.amnesty.cost} CR, halves the unrest at once`, am.ok ? 'amnesty' : null);
        if (!this.roomCount('customs')) add('Fit a Customs Scanner near the berths', -mp.unrest * 0.3, `${C.rooms.customs.cost} CR: stops 6 smuggled loads in 10 from then on, with no staff`);
        if (this.staff.officer && !every) add('Inspect every ship', -mp.unrest * 0.3, 'officers catch every smuggler at bays near them; unloading waits a little', 'checks');
        else if (!this.staff.officer && this.partOpen && C.rooms.secoffice.tier <= this.tier) add('Put Democracy Officers on duty', -mp.unrest * 0.3, 'a Security Office near the berths: they catch smugglers and calm the habs faster');
      }
      if (mp.magazines) add('Move the magazines away from the beds', -mp.magazines, 'or the beds away from the magazines');
      return out.filter((w) => w.gain > 0.4).sort((a, b) => (!!b.do - !!a.do) || b.gain - a.gain);
    },
    // WHAT THE STATION IS ASKED FOR NEXT. Most pressing first: what is going wrong now, then what stands between the station and
    // its next tier. Each ask says who asks, what for, and why, in terms of what to build or change.
    asks() {
      if (this.sandbox) return [];
      const L = this.ledger(), out = [], c = L.credits, add = (from, tag, text, why, urgent = false) => out.push({ from, tag, text, why, urgent });
      const fb = L.stores.berths, r1 = (x) => Math.round(Math.abs(x));
      // -- a berth with no clear way in: ships cannot use it, and everything that comes by ship stops
      const shut = [...(this._shut || [])].map(([id, by]) => [this.parts.get(id), by]).filter(([p]) => p && p.state === 'active');
      const noDock = shut.length ? `${this.name(shut[0][0])} is shut (${shut[0][1]} is across its approach): clear the way in, or build a berth where ships can reach it.` : null;
      if (shut.length) add('traffic', 'shut', `${shut.length > 1 ? `${shut.length} berths are` : `${this.name(shut[0][0])} is`} shut: ships have no clear way in.`, `${shut.map(([p, by]) => `${this.name(p)}: ${by} is across its approach`).slice(0, 2).join('. ')}. Take that down, or build the berth where its approach is clear.`, !fb);
      // -- credits
      if (c.net < -0.5 && (c.runway !== null && c.runway < 4 || this.credits < 0)) {
        const fix = !fb ? noDock || 'Build a Docking Port: trade is what pays for a station.'
          : c.idle.n ? `${c.idle.n} ${c.idle.n > 1 ? 'parts stand' : 'part stands'} empty or broken and still cost${c.idle.n > 1 ? '' : 's'} ${r1(c.idle.v)} CR a minute. Fit them out, mend them or take them down.`
            : this.cratesPerMin() < 1 && this.staff.hauler < this.homes.hauler ? 'Freighters are not being unloaded fast enough: raise Supply\'s coffee to put more haulers on duty.'
              : this.cratesPerMin() < 1 ? 'More trade is the cure: another Docking Port, or a Cargo Store nearer the berths.'
                : L.people.residents && this.tax < 12 ? `Raise the colonist tax (now ${this.tax}%), or build a Market for them to spend in.` : 'Take down what the station does not need, or bring in more trade with another berth.';
        add('ministry', 'credits', this.credits < 0 ? `The station is ${r1(this.credits)} CR in debt and losing ${r1(c.net)} CR a minute.` : `The station is losing ${r1(c.net)} CR a minute: ${r1(c.income)} in, ${r1(c.spend)} out. The credits run out in ${c.runway < 1 ? 'under a day' : `${Math.round(c.runway)} days`}.`, fix, true);
      }
      else if (c.net < -0.5) add('ministry', 'net', `The station spends ${r1(c.net)} CR a minute more than it earns${c.runway !== null && c.runway < 40 ? `: the credits last ${Math.round(c.runway)} more days` : ''}.`, !fb ? noDock || 'Trade is what pays for a station: build a Docking Port and a Cargo Bay.' : c.idle.n ? `${c.idle.n} ${c.idle.n > 1 ? 'parts stand' : 'part stands'} empty or broken and cost ${r1(c.idle.v)} CR a minute.` : 'Build what earns before what costs: berths, cargo stores and residents pay; everything else is upkeep.');
      // -- trade: berths standing idle, or too few, or a berth that needs a room before it is one
      const T = L.trade;
      if (T.berths.spare >= 2) add('traffic', 'idle', `The station has ${T.berths.n} freighter berths and the trade keeps about ${T.berths.occ < 1 ? 'one' : Math.round(T.berths.occ)} busy.`, `The sector sends about ${Math.round(T.demand.total)} crates a minute, enough for ${T.needBerths} berth${T.needBerths > 1 ? 's' : ''}. More berths do not bring more ships: reputation, standing and a Spire or Operations Centre do. Each idle Docking Port still costs ${C.parts.dockport.up} CR a minute.`);
      if (T.waiting >= 2 || (this.stats.lost && T.rep < 0.35)) add('traffic', 'berths', `Freighters are waiting for a berth${T.rep < 0.45 ? ', and the station\'s reputation is falling' : ''}.`, 'Ships kept waiting or turned away lower the reputation, and fewer come. Another berth, or more haulers to unload faster, keeps them moving.', T.rep < 0.3);
      for (const x of T.notYet.slice(0, 2)) add('traffic', `room-${x.name}`, `${x.name} takes no ships yet.`, `Fit a ${x.room} inside it (select it, then EDIT INSIDE).`);
      // -- power
      if (this.eff < 1) add('maintenance', 'power', `Power is short: the station needs ${this.demand} and makes ${this.supply}. Everything runs at ${Math.round(this.eff * 100)}%.`, 'Build a Solar Array or a Reactor Core, or mend one that has broken down.', true);
      // -- supplies
      const sh = L.stores.supplies.filter((s) => s.short);
      if (sh.length) add('supply', 'supplies', `The stores are out of ${sh.map((s) => s.label.toLowerCase()).join(', ')}.`, !fb ? noDock || 'Supplies come by freighter: build a Docking Port.' : !this.cargoIds.size ? 'There is nowhere to put crates: fit a Cargo Store into a Cargo Bay.' : !this.staff.hauler ? 'There are no haulers on duty to unload: raise Supply\'s coffee.' : 'Freighters bring more of whatever is short. More berths and haulers bring it faster, or lower the allotments that draw on it.', true);
      // -- morale
      if ((this.morale < C.ships.shuttleMorale + 10 || L.morale.target < C.ships.shuttleMorale + 5) && L.people.residents) {
        const worst = [...L.morale.lines].filter((x) => x.v < 0).sort((a, b) => a.v - b.v)[0], way = L.morale.ways[0];
        add('colonists', 'morale', `Morale is ${Math.round(this.morale)}${L.morale.target < this.morale - 2 ? ` and falling towards ${Math.round(L.morale.target)}` : ''}. ${this.morale < C.morale.leaveBelow ? 'Residents are leaving.' : `Below ${C.ships.shuttleMorale} colonists stop coming; below ${C.morale.leaveBelow} residents leave.`}`,
          `${worst ? `The worst of it: ${worst.label.toLowerCase()} (${Math.round(worst.v)}). ` : ''}${way ? `Quickest help: ${way.label.toLowerCase()} (+${Math.round(way.gain)}).` : ''}`, true);
      }
      // -- a faction with places and nobody on duty
      for (const s of L.people.staff) if (s.places > 0 && s.on === 0) { const d = C.div[s.k]; add(s.k, `staff-${s.k}`, `${d.name} has ${s.places} places and nobody on duty.`, `Raise its weekly ${C.supplies[d.uses].name.toLowerCase()} in the Commander's channel: ${d.per} ${C.supplies[d.uses].unit} keep one on duty.`); break; }
      // -- the next tier: what is still missing, and how to get it
      const n = this.next();
      if (n) for (const i of n.items) {
        if (i.ok) continue;
        const short = `${i.label}: ${Math.min(i.have, i.need)} of ${i.need}.`, pre = `For ${n.name} status`;
        if (i.label === 'Residents') add('ministry', 'tier-residents', `${pre}: ${i.need} residents (now ${i.have}).`, L.people.free ? L.people.why : `There ${L.people.beds === 1 ? 'is' : 'are'} ${L.people.beds} bed${L.people.beds === 1 ? '' : 's'}. Fit Quarters into a Habitation Module: each room holds ${C.rooms.quarters.beds}.`);
        else if (i.label === 'Capability') add('ministry', 'tier-cap', `${pre}: capability ${i.need} (now ${i.have}).`, 'Every crate, ship, resident, defence and member of staff adds to it, and happy factions multiply it.');
        else if (i.label === 'Power supply') add('ministry', 'tier-power', `${pre}: ${i.need} power made (now ${i.have}).`, 'Build Solar Arrays or a Reactor Core.');
        else if (i.label === 'Platform readiness') { const g = this._gunneryTarget(); add('gunnery', 'tier-ready', `${pre}: the platform ${i.need}% ready (now ${i.have}%).`, g.why); }
        else if (i.label === 'Crates traded') add('ministry', 'tier-crates', `${pre}: ${i.need} crates traded (now ${i.have}).`, fb ? 'Keep the berths busy: haulers and a Cargo Store nearby move crates faster.' : 'Build a Docking Port and a Cargo Bay.');
        else if (i.label === 'Morale') add('ministry', 'tier-morale', `${pre}: morale ${i.need} (now ${i.have}).`, 'Bars, markets, parks and lower tax raise it.');
        else add('ministry', `tier-${i.label}`, `${pre}: ${short}`, 'Paint the room into a part with a free slot (select the part, then EDIT ROOMS).');
      }
      return out;
    },
    // What building this would do to the accounts: credits a minute, and power.
    costOf(type) { const d = C.parts[type], mul = this.div.maintenance.order.plan === 'preventive' ? 1.2 : 1, up = (d.up || 0) * mul + (d.rooms || []).reduce((s, r) => s + (C.rooms[r].up || 0) * mul, 0); return { up, pw: d.pw || 0 }; },
    // THE VOICE. An urgent ask is said on the radio once when it first comes up, and again only if it is still there days later.
    // The rest wait in the accounts and the overview for whoever looks. A warning is also given before the credits turn.
    _advise(dt) {
      // morale is kept, four readings a day for two weeks, so it can be seen where it has been
      if (this.t - (this.mlogT ?? -1e9) >= C.time.daySec / 4) { this.mlogT = this.t; (this.mlog ||= []).push(Math.round(this.morale)); if (this.mlog.length > 56) this.mlog.shift(); }
      if (this.sandbox || this.t < 45 || this._noAdvice) return;
      if ((this._adv = (this._adv || 0) + dt) < 4) return;
      this._adv = 0; this._said ||= {};
      const again = C.time.daySec * 4;
      for (const a of this.asks()) {
        if (!a.urgent || this.t - (this._said[a.tag] ?? -1e9) < again) continue;
        this._said[a.tag] = this.t;
        this.say(a.from === 'colonists' ? 'colonists' : a.from, `${a.text} ${a.why}`, { warn: true });
        return;      // one thing at a time
      }
    },
  });
}
