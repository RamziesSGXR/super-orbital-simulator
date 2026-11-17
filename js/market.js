// THE MARKET: why freighters come, and what a crate is worth.
//
// Freighters do not come because there are berths. They come because the sector has trade to move through the station: the
// DEMAND, in crates a minute. Demand grows with the station's standing (its tier), with its REPUTATION (ships served on time
// raise it; ships kept waiting, turned away or left half unloaded lower it), with a Spire or Operations Centre, and when the
// station is short of supplies the Ministry sends supply runs on top. Traffic Control's rate order asks the sector for more
// or fewer ships than that.
//
// Berths are capacity, not demand. Enough berths serve every ship that comes and keep the reputation up; more than that stand
// idle and still cost upkeep. The PRICE of a crate moves with supply and demand: when the station takes in more crates than the
// sector wants moved (opening the lanes wide), each one is worth less; when it takes in fewer, each one is worth more.
import { C } from './config.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function installMarket(Station) {
  Object.assign(Station.prototype, {
    _mk() { return (this.market ||= { rep: C.market.rep0, seen: [], lastUse: {} }); },
    // Crates a minute the sector wants moved through this station, and where that comes from.
    tradeDemand() {
      const M = C.market, m = this._mk(), base = M.base[Math.min(this.tier, M.base.length - 1)], repK = M.repLo + (M.repHi - M.repLo) * m.rep;
      const need = this.sandbox ? 0 : Object.keys(C.supplies).reduce((s, t) => s + (this.short[t] || (this.stock[t] || 0) < this.weeklyNeed(t) * 0.5 ? 1 : 0), 0);
      const runs = Math.min(M.runsMax, need * M.runPer);
      return { base, repK, hub: this.trafficMul, runs, total: base * repK * this.trafficMul + runs };
    },
    // What the station has taken in: crates a minute, over the last few minutes.
    tradeSupply() {
      const m = this._mk(), win = C.market.windowSec;
      while (m.seen.length && m.seen[0] < this.t - win) m.seen.shift();
      return m.seen.length * 60 / Math.min(win, Math.max(30, this.t));
    },
    // What a crate is worth now: the base fee (with refineries) times the market's price.
    priceK() {
      const M = C.market, d = this.tradeDemand().total, s = this.tradeSupply();
      if (this.t < 60 || s < 0.5) return 1;      // nothing to judge by yet
      return clamp(Math.pow(d / s, M.elastic), M.priceLo, M.priceHi);
    },
    crateFee() { return Math.round((C.econ.crateFee + this.refineN * C.parts.refinery.refine) * this.priceK() * 10) / 10; },
    // How many seconds until the next freighter: the demand, asked up or down by Traffic Control.
    _freighterGap(rateK) {
      const d = this.tradeDemand().total * rateK, per = C.market.cratesPerShip;
      return 60 * per / Math.max(0.5, d) * this.rng.range(0.75, 1.25);
    },
    _sawCrate() { this._mk().seen.push(this.t); },
    // Reputation: served on time raises it; a ship lost, turned away or kept waiting lowers it.
    _rep(dx) { const m = this._mk(); m.rep = clamp(m.rep + dx, 0, 1); },
    // Which free berth a ship goes to: the one that has stood idle longest, so every berth is used and none is favoured.
    pickBerth(kind) {
      const m = this._mk(), busy = new Set(this.ships.filter((o) => o.dock && o.state !== 'depart').map((o) => o.dock));
      const free = this.berths(kind).filter((p) => !busy.has(p.id));
      if (!free.length) return null;
      return free.reduce((a, b) => ((m.lastUse[b.id] ?? -1) < (m.lastUse[a.id] ?? -1) ? b : a));
    },
    // Whether a berth can take a ship now, and if not, why: open, busy, building, fault, power, room (needs a room inside), shut.
    berthStatus(p) {
      const d = this.def(p);
      if (!d.berth) return null;
      if (p.state !== 'active') return { k: 'building', why: 'still being built' };
      if (this._shut && this._shut.has(p.id)) return { k: 'shut', why: `no clear way in: ${this._shut.get(p.id)} is across its approach` };
      if (p.fault) return { k: 'fault', why: 'broken down: engineers will mend it' };
      if (d.berthRoom && !this.has(p, d.berthRoom)) return { k: 'room', why: `takes no ships until a ${C.rooms[d.berthRoom].name} is fitted inside it` };
      const sh = this.ships.find((x) => x.dock === p.id && x.state !== 'depart');
      return sh ? { k: 'busy', why: sh.state === 'docked' ? `${sh.name} is docked${sh.kind === 'freighter' ? `, ${sh.crates} crates aboard` : ''}` : `${sh.name} is coming in`, ship: sh } : { k: 'open', why: 'free' };
    },
    _usedBerth(id) { this._mk().lastUse[id] = this.t; },
    // How busy the freighter berths are: how many have had a ship at them, on average, over the last few minutes; how many the
    // trade needs (that average, with room for ships that come close together); and how many more there are than that.
    _occ(dt) {
      const m = this._mk(), fb = new Set(this.berths('freighter').map((p) => p.id));
      const busy = this.ships.filter((s) => s.kind === 'freighter' && s.dock && fb.has(s.dock) && s.state !== 'depart').length;
      m.occ = (m.occ ?? 0) + (busy - (m.occ ?? 0)) * Math.min(1, dt / C.market.occSec);
      m.occT = (m.occT || 0) + dt;
    },
    berthUse() {
      const fb = this.berths('freighter'), m = this._mk(), occ = m.occ ?? 0;
      const busy = fb.filter((p) => this.ships.some((s) => s.dock === p.id && s.state !== 'depart')).length;
      const need = Math.max(1, Math.ceil(occ * 1.4 + 0.35)), known = (m.occT || 0) > C.market.occSec;
      return { n: fb.length, busy, occ, need, spare: known ? Math.max(0, fb.length - need) : 0 };
    },
  });
}
