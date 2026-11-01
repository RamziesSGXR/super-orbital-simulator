// The station simulation. No DOM and no 3D library: it runs the same in the browser and headless in Node (test/headless.mjs).
// The station is a tree of parts joined at ports. People walk along that tree, part to part, through the joins;
// the distance between two parts is the real distance through the join, so where you put things matters.
import { C } from './config.js';
import { RNG } from './rng.js';
import { v, q } from './math3.js';

const NAMES = ['Honest Work', 'Steady Progress', 'Fair Weather', 'Good Neighbors', 'Quiet Resolve', 'Open Skies', 'Sturdy Ballots',
  'Shared Prosperity', 'Cheerful Compliance', 'Sensible Shoes', 'Unanimous Consent', 'Bright Mornings', 'Fair Play', 'Civic Duty',
  'Common Sense', 'Rightful Order', 'Patient Thunder', 'Reliable Freedom'];
const PROPAGANDA = [
  'Every crate unloaded is a bullet delivered. Thank you, citizen.',
  'A happy station is a compliant station.',
  'The Liberty Contribution keeps the lights on. Literally.',
  'Remember: the hull is load-bearing. So is your loyalty.',
  'Today\'s promenade special: Freedom Loaf. Seconds are patriotic.',
  'Report unapproved goods to your nearest Democracy Officer.',
  'The war is going well. Please continue to work.',
];

export class Station {
  constructor(seed = 1, mode = 'run') {
    this.rng = new RNG(seed);
    this.mode = mode;
    this.sandbox = mode === 'sandbox';
    this.t = 0;
    this.credits = this.sandbox ? C.sandbox.credits : C.start.credits;
    this.tax = C.start.tax;
    this.radius = this.sandbox ? C.sandbox.radius : C.start.radius;
    this.unlocked = new Set(this.sandbox ? ['garrison'] : []);
    this.done = {};
    this.parts = new Map();
    this.nextId = 1;
    this.agents = []; this.ships = []; this.events = [];
    this.morale = C.morale.base; this.eff = 1; this.supply = 0; this.demand = 0;
    this.stats = { crates: 0, ships: 0, lost: 0, colonists: 0, left: 0 };
    this.totals = { trade: 0, tax: 0, upkeep: 0, build: 0 };
    this.buckets = Array.from({ length: 60 }, () => ({ s: -1, v: 0 }));
    this.timers = { freighter: 5, shuttle: 10, leave: C.morale.leaveSec, talk: 45 };
    const cmd = this._make('command', 0, -1, 0, [0, 0, 0], q.id());
    cmd.state = 'active'; cmd.prog = 1;
    this.root = cmd.id;
    this._refresh();
  }

  // ---------------------------------------------------------------- geometry
  def(p) { return C.parts[p.type]; }
  name(p) { return p.type === 'command' ? 'Station Command' : `${this.def(p).name} ${p.n}`; }
  // World position and facing of one of a part's ports.
  port(p, i) {
    const d = this.def(p).ports[i];
    return { pos: v.add(p.pos, q.rot(p.quat, [d[0], d[1], d[2]])), dir: q.rot(p.quat, [d[3], d[4], d[5]]), kind: d[6] };
  }
  center(p) { return v.add(p.pos, q.rot(p.quat, this.def(p).center)); }
  berth(p) {
    const b = this.def(p).berth;
    return b ? { pos: v.add(p.pos, q.rot(p.quat, [b[0], b[1], b[2]])), dir: q.rot(p.quat, [b[3], b[4], b[5]]) } : null;
  }
  // Where a new part would sit if attached to `host`'s port `pi`, turned `rot` steps of 45 degrees about the port's axis.
  placement(type, host, pi, rot = 0) {
    const d = C.parts[type], tp = this.port(host, pi), base = d.ports[0];
    const align = q.fromTo([base[3], base[4], base[5]], v.mul(tp.dir, -1));
    const quat = q.mul(q.axisAngle(tp.dir, rot * Math.PI / 4), align);
    const pos = v.sub(tp.pos, q.rot(quat, [base[0], base[1], base[2]]));
    return { pos, quat };
  }
  freePorts() {
    const out = [];
    for (const p of this.parts.values()) {
      if (p.state === 'demolish') continue;
      this.def(p).ports.forEach((_, i) => { if (!p.used.has(i)) out.push({ part: p.id, i, ...this.port(p, i) }); });
    }
    return out;
  }

  canBuild(type, hostId, pi, rot = 0) {
    const d = C.parts[type], host = this.parts.get(hostId);
    if (!d || d.fixed) return { ok: false, why: 'Not buildable' };
    if (d.locked && !this.unlocked.has(d.locked)) return { ok: false, why: 'Needs the Garrison Permit' };
    if (!host || host.state === 'demolish') return { ok: false, why: 'Nothing to attach to' };
    if (host.used.has(pi)) return { ok: false, why: 'That port is taken' };
    const pl = this.placement(type, host, pi, rot), c = v.add(pl.pos, q.rot(pl.quat, d.center));
    if (v.len(c) + d.r * 0.5 > this.radius) return { ok: false, why: 'Outside the permitted build zone' };
    // No clash test on purpose: parts may overlap and nest (a ring inside a ring), so players can build any shape.
    if (this.credits < d.cost) return { ok: false, why: 'Not enough credits' };
    return { ok: true, why: '' };
  }

  build(type, hostId, pi, rot = 0) {
    const chk = this.canBuild(type, hostId, pi, rot);
    if (!chk.ok) return chk;
    const host = this.parts.get(hostId), pl = this.placement(type, host, pi, rot);
    this._money(-C.parts[type].cost, 'build');
    const p = this._make(type, host.id, pi, rot, pl.pos, pl.quat);
    host.used.add(pi); host.kids.push(p.id);
    this.events.push({ type: 'build', part: p });
    return { ok: true, why: '', id: p.id };
  }

  canDemolish(id) {
    const p = this.parts.get(id);
    if (!p) return { ok: false, why: '' };
    if (p.type === 'command') return { ok: false, why: 'Station Command stays' };
    if (p.kids.length) return { ok: false, why: 'Remove the parts attached to it first' };
    if (p.state === 'demolish') return { ok: false, why: 'Already coming down' };
    return { ok: true, why: '' };
  }
  demolish(id) {
    const chk = this.canDemolish(id);
    if (!chk.ok) return chk;
    const p = this.parts.get(id);
    if (p.state === 'building') { this._money(this.def(p).cost, 'build'); this._remove(p); return chk; }   // cancelled: full refund
    p.state = 'demolish'; p.prog = 0;
    this.events.push({ type: 'demolish', part: p });
    this._refresh();
    return chk;
  }

  _make(type, parent, pport, rot, pos, quat) {
    const n = [...this.parts.values()].filter((x) => x.type === type).length + 1;
    const p = { id: this.nextId++, type, parent, pport, rot, pos, quat, n, used: new Set(parent ? [0] : []), kids: [],
      state: 'building', prog: 0, seed: this.rng.next() };
    this.parts.set(p.id, p);
    return p;
  }
  _remove(p) {
    const host = this.parts.get(p.parent);
    if (host) { host.used.delete(p.pport); host.kids = host.kids.filter((k) => k !== p.id); }
    this.parts.delete(p.id);
    for (const s of this.ships) if (s.dock === p.id) this._depart(s, true);
    for (const a of [...this.agents]) {
      if (a.at === p.id || a.path.includes(p.id) || a.home === p.id) { a.at = this.root; a.path = []; a.s = 0; a.task = null; a.wait = 0.5; if (a.carry) a.carry = false; }
    }
    this.events.push({ type: 'removed', id: p.id });
    this._refresh();
  }

  works(p) { return !!p && p.state === 'active'; }
  list(test) { return [...this.parts.values()].filter((p) => this.works(p) && test(this.def(p), p)); }

  // ---------------------------------------------------------------- walking
  nbrs(p) { const out = p.kids.map((k) => this.parts.get(k)).filter((x) => this.works(x)); const h = this.parts.get(p.parent); if (h && this.works(h)) out.push(h); return out; }
  // The join between two neighbouring parts, and the walking distance through it.
  edge(a, b) {
    const child = b.parent === a.id ? b : a;
    const conn = this.port(child, 0).pos, ca = this.center(a), cb = this.center(b);
    const da = v.dist(ca, conn), db = v.dist(conn, cb);
    return { ca, conn, cb, da, db, len: Math.max(0.3, da + db) };
  }
  // Shortest walk from part `from` to the nearest part passing `goal`: a list of part ids (start excluded), or null.
  route(from, goal) {
    const start = this.parts.get(from);
    if (!start) return null;
    if (goal(start)) return [];
    const dist = new Map([[from, 0]]), prev = new Map(), open = [from], done = new Set();
    while (open.length) {
      open.sort((a, b) => dist.get(a) - dist.get(b));
      const id = open.shift();
      if (done.has(id)) continue;
      done.add(id);
      const p = this.parts.get(id);
      if (id !== from && goal(p)) { const path = [id]; let k = prev.get(id); while (k !== from) { path.push(k); k = prev.get(k); } return path.reverse(); }
      for (const n of this.nbrs(p)) {
        const d = dist.get(id) + this.edge(p, n).len;
        if (!dist.has(n.id) || d < dist.get(n.id)) { dist.set(n.id, d); prev.set(n.id, id); open.push(n.id); }
      }
    }
    return null;
  }
  walkDist(fromId, path) {
    let d = 0, a = this.parts.get(fromId);
    for (const id of path) { const b = this.parts.get(id); d += this.edge(a, b).len; a = b; }
    return d;
  }

  // ---------------------------------------------------------------- derived numbers
  _refresh() {
    let sup = 0, dem = 0;
    for (const p of this.parts.values()) {
      if (p.state !== 'active') continue;
      const pw = this.def(p).pw;
      if (pw < 0) sup -= pw; else dem += pw;
    }
    this.supply = sup; this.demand = dem;
    this.eff = dem <= 0 ? 1 : Math.min(1, sup / dem);
    this.haulerCap = this.list((d) => d.haulers).reduce((s, p) => s + this.def(p).haulers, 0);
  }
  beds() { return this.list((d) => d.beds).reduce((s, p) => s + this.def(p).beds, 0); }
  residents() { let n = 0; for (const a of this.agents) if (a.role === 'resident') n++; return n; }
  berths() { return this.list((d) => d.berth); }
  upkeep() { let s = 0; for (const p of this.parts.values()) if (p.state === 'active') s += this.def(p).up; return s; }
  taxPerMin() { return this.residents() * this.tax * C.econ.taxPerPct; }
  setTax(x) { this.tax = Math.max(0, Math.min(30, Math.round(x))); }
  moraleParts() {
    const M = C.morale;
    const tax = this.tax > M.taxFree ? -(this.tax - M.taxFree) * M.taxPenalty : (M.taxFree - this.tax) * M.taxBonus;
    const prom = Math.min(M.promenadeMax, this.list((d) => d.promenade).length) * C.parts.disc.promenade;
    const garden = Math.min(M.gardenMax, this.list((d) => d.garden).length) * C.parts.dome.garden;
    return { base: M.base, tax, promenade: prom, garden, power: -M.power * (1 - this.eff), broke: this.credits < 0 ? -15 : 0 };
  }
  _money(x, cat) {
    if (this.sandbox && cat === 'build') return;
    this.credits += x;
    this.totals[cat] = (this.totals[cat] || 0) + x;
    if (cat === 'build') return;
    const s = Math.floor(this.t), b = this.buckets[s % 60];
    if (b.s !== s) { b.s = s; b.v = 0; }
    b.v += x;
  }
  netPerMin() { const s = Math.floor(this.t); let x = 0; for (const b of this.buckets) if (b.s > s - 60 && b.s <= s) x += b.v; return x * 60 / Math.min(60, Math.max(1, this.t)); }

  milestone() {
    const M = C.milestones[0];
    const items = [
      { label: 'Residents', have: this.residents(), need: M.residents },
      { label: 'Crates traded', have: this.stats.crates, need: M.crates },
      { label: 'Power supply', have: this.supply, need: M.power },
    ];
    for (const i of items) i.ok = i.have >= i.need;
    return { ...M, items, done: !!this.done[M.id] || this.sandbox };
  }

  // ---------------------------------------------------------------- the step
  step(dt) {
    this.t += dt;
    let changed = false;
    for (const p of [...this.parts.values()]) {
      if (p.state === 'building') {
        p.prog += dt / Math.max(0.1, this.def(p).build);
        if (p.prog >= 1) { p.state = 'active'; p.prog = 1; changed = true; this.events.push({ type: 'built', part: p }); }
      } else if (p.state === 'demolish') {
        p.prog += dt / C.demolish.sec;
        if (p.prog >= 1) { this._money(Math.round(this.def(p).cost * C.demolish.refund), 'build'); this._remove(p); }
      }
    }
    if (changed) this._refresh();
    this._staff();
    this._ships(dt);
    this._residents(dt);
    for (const a of [...this.agents]) this._agent(a, dt);
    const k = dt / 60;
    if (this.residents()) this._money(this.taxPerMin() * k, 'tax');
    const u = this.upkeep(); if (u) this._money(-u * k, 'upkeep');
    const p = this.moraleParts(), target = Math.max(0, Math.min(100, Object.values(p).reduce((s, x) => s + x, 0)));
    this.morale += Math.max(-1.5 * dt, Math.min(1.5 * dt, target - this.morale));
    this._milestone();
    if ((this.timers.talk -= dt) <= 0) { this.timers.talk = 50 + this.rng.range(0, 30); this.events.push({ type: 'talk', text: this.rng.pick(PROPAGANDA) }); }
  }

  _milestone() {
    const m = this.milestone();
    if (m.done || !m.items.every((i) => i.ok)) return;
    this.done[m.id] = true; this.unlocked.add(m.id); this.radius = m.radius;
    this.events.push({ type: 'milestone', text: `${m.name} GRANTED. The build zone grows. Unlocked: rings, promenades, drums and pylons.` });
  }

  _staff() {
    const want = this.haulerCap || 0, have = this.agents.filter((a) => a.role === 'hauler');
    for (let i = have.length; i < want; i++) this._spawn('hauler', this.root, this.root);
    if (have.length > want) for (const a of have.filter((x) => !x.task).slice(0, have.length - want)) this._drop(a);
  }
  _spawn(role, at, home) {
    const a = { id: this.nextId++, role, at, home, path: [], s: 0, wait: this.rng.range(0, 1), task: null, carry: false, ship: 0, seed: this.rng.next() };
    this.agents.push(a); return a;
  }
  _drop(a) {
    if (a.task === 'pick') { const s = this.ships.find((x) => x.id === a.ship); if (s) s.reserved = Math.max(0, s.reserved - 1); }
    this.agents.splice(this.agents.indexOf(a), 1);
  }

  _residents(dt) {
    const homes = this.list((d) => d.beds);
    const load = new Map(homes.map((h) => [h.id, 0]));
    for (const a of this.agents) if (a.role === 'resident' && load.has(a.home)) load.set(a.home, load.get(a.home) + 1);
    for (const a of this.agents) {
      if (a.role !== 'resident' || a.leaving || load.has(a.home)) continue;
      const h = homes.find((x) => load.get(x.id) < this.def(x).beds);
      if (h) { a.home = h.id; load.set(h.id, load.get(h.id) + 1); } else this._leave(a);
    }
    if (this.morale < C.morale.leaveBelow && this.residents() > 0) {
      if ((this.timers.leave -= dt) <= 0) {
        this.timers.leave = C.morale.leaveSec;
        const a = this.agents.find((x) => x.role === 'resident' && !x.leaving);
        if (a) { this._leave(a); this.events.push({ type: 'left', text: 'A citizen has emigrated. This has been noted.' }); }
      }
    } else this.timers.leave = C.morale.leaveSec;
  }
  _leave(a) { a.leaving = true; a.path = []; a.wait = 0; a.task = null; }
  freeBeds() {
    const out = [];
    for (const h of this.list((d) => d.beds)) {
      const n = this.agents.filter((a) => a.role === 'resident' && a.home === h.id && !a.leaving).length;
      for (let i = n; i < this.def(h).beds; i++) out.push(h);
    }
    return out;
  }

  // ---------------------------------------------------------------- agents
  _agent(a, dt) {
    if (a.path.length) { this._walk(a, dt); return; }
    if (a.wait > 0) { a.wait -= dt; if (a.wait > 0) return; if (a.pending) { const p = a.pending; a.pending = null; this._done(a, p); return; } }
    this._think(a);
  }
  _walk(a, dt) {
    let left = dt * C.walk.speed * (0.55 + 0.45 * this.eff);
    while (left > 0 && a.path.length) {
      const from = this.parts.get(a.at), to = this.parts.get(a.path[0]);
      if (!from || !to || !this.works(to)) { a.path = []; a.s = 0; break; }
      const L = this.edge(from, to).len;
      if (a.s + left >= L) { left -= L - a.s; a.s = 0; a.at = to.id; a.path.shift(); }
      else { a.s += left; left = 0; }
    }
    if (!a.path.length) this._arrive(a);
  }
  _go(a, goal, task) {
    const p = this.route(a.at, goal);
    if (!p) return false;
    a.path = p; a.s = 0; a.task = task;
    if (!p.length) this._arrive(a);
    return true;
  }
  _think(a) {
    if (a.role === 'hauler') return this._hauler(a);
    if (a.leaving) {
      if (!this._go(a, (p) => this.works(p) && this.def(p).berth, 'leave')) this._gone(a);
      return;
    }
    // Residents: home, then somewhere social, then home again.
    const goHome = a.task === 'back' || this.rng.next() >= 0.6;
    if (!goHome) {
      const spots = this.list((d, p) => d.promenade || d.garden || p.type === 'command' || p.type === 'ring' || p.type === 'bigring').filter((p) => p.id !== a.at);
      if (spots.length) { const t = this.rng.pick(spots).id; if (this._go(a, (p) => p.id === t, 'out')) return; }
    }
    if (a.at === a.home) { a.task = null; a.wait = this.rng.range(6, 16); return; }
    if (!this._go(a, (p) => p.id === a.home, 'home')) { a.task = null; a.wait = 3; }
  }
  _hauler(a) {
    const cargo = (p) => this.works(p) && this.def(p).cargo;
    if (a.carry) { if (!this._go(a, cargo, 'drop')) { a.task = null; a.wait = 1; } return; }
    const hasCargo = this.list((d) => d.cargo).length > 0;
    const open = hasCargo ? this.ships.filter((s) => s.state === 'docked' && s.kind === 'freighter' && s.crates - s.reserved > 0) : [];
    if (open.length) {
      const docks = new Map(open.map((s) => [s.dock, s]));
      const p = this.route(a.at, (x) => docks.has(x.id));
      if (p) {
        const end = p.length ? p[p.length - 1] : a.at, s = docks.get(end);
        s.reserved++; a.ship = s.id; a.path = p; a.s = 0; a.task = 'pick';
        if (!p.length) this._arrive(a);
        return;
      }
    }
    if (a.at !== a.home) { if (!this._go(a, (x) => x.id === a.home, 'home')) { a.task = null; a.wait = 1; } return; }
    a.task = null; a.wait = this.rng.range(1, 2.5);
  }
  _arrive(a) {
    if (a.task === 'pick') { a.wait = C.walk.pickSec; a.pending = 'pick'; return; }
    if (a.task === 'drop') { a.wait = C.walk.dropSec; a.pending = 'drop'; return; }
    if (a.task === 'leave') { this.stats.left++; this._gone(a); return; }
    if (a.task === 'out') { a.wait = this.rng.range(5, 12); a.task = 'back'; return; }
    a.wait = a.role === 'resident' ? this.rng.range(6, 16) : this.rng.range(1, 2); a.task = null;
  }
  _gone(a) { const i = this.agents.indexOf(a); if (i >= 0) this.agents.splice(i, 1); }
  _done(a, what) {
    if (what === 'pick') {
      const s = this.ships.find((x) => x.id === a.ship);
      a.task = null;
      if (s && s.state === 'docked' && s.crates > 0) { s.crates--; a.carry = true; }
      if (s) s.reserved = Math.max(0, s.reserved - 1);
    } else if (what === 'drop') {
      a.carry = false; a.task = null;
      this._money(C.econ.crateFee, 'trade'); this.stats.crates++;
      this.events.push({ type: 'crate', part: a.at });
    }
  }

  // ---------------------------------------------------------------- ships
  _ships(dt) {
    const S = C.ships, berths = this.berths();
    if (berths.length) {
      const spires = Math.min(2, this.list((d) => d.traffic).length);
      if ((this.timers.freighter -= dt) <= 0) {
        this.timers.freighter = S.freighterSec / (1 + 0.5 * (berths.length - 1)) / (1 + 0.2 * spires) * this.rng.range(0.75, 1.25);
        this._arrive2('freighter');
      }
      if (this.freeBeds().length && this.morale >= S.shuttleMorale && !this.ships.some((s) => s.kind === 'shuttle' && s.state !== 'depart')) {
        if ((this.timers.shuttle -= dt) <= 0) { this.timers.shuttle = S.shuttleSec * this.rng.range(0.8, 1.2); this._arrive2('shuttle'); }
      }
    }
    const free = berths.filter((b) => !this.ships.some((s) => s.dock === b.id && s.state !== 'depart'));
    for (const s of this.ships.filter((x) => x.state === 'hold').sort((a, b) => a.born - b.born)) {
      if (!free.length) break;
      s.dock = free.shift().id; s.state = 'approach'; s.t = 0;
    }
    for (const s of [...this.ships]) {
      s.t += dt;
      if (s.state === 'hold' && s.t > S.waitSec) { this.stats.lost++; this.events.push({ type: 'lost', text: `${s.name} gave up waiting for a berth. Trade lost.` }); this._depart(s, true); }
      else if (s.state === 'approach' && s.t >= S.approachSec) this._docked(s);
      else if (s.state === 'docked') {
        if (!this.parts.get(s.dock)) this._depart(s, true);
        else if (s.kind === 'shuttle' ? s.t > 3 : s.crates <= 0 && s.reserved <= 0) this._depart(s, false);
      } else if (s.state === 'depart' && s.t >= S.departSec) this.ships.splice(this.ships.indexOf(s), 1);
    }
  }
  _arrive2(kind) {
    if (this.ships.filter((s) => s.state === 'hold').length >= C.ships.queueMax) {
      this.stats.lost++; this.events.push({ type: 'lost', text: 'A freighter was turned away: every berth and holding slot is full.' }); return;
    }
    this.ships.push({ id: this.nextId++, kind, name: `${kind === 'shuttle' ? 'Shuttle' : 'Freighter'} ${this.rng.pick(NAMES)}`, born: this.t,
      state: 'hold', t: 0, dock: 0, crates: 0, reserved: 0, seed: this.rng.next(), lastDock: 0 });
  }
  _docked(s) {
    const p = this.parts.get(s.dock);
    if (!p) { this._depart(s, true); return; }
    s.state = 'docked'; s.t = 0; s.lastDock = p.id;
    this._money(C.econ.dockFee, 'trade');
    if (s.kind === 'shuttle') {
      const beds = this.freeBeds(), n = Math.min(C.ships.colonists, beds.length);
      for (let i = 0; i < n; i++) { const a = this._spawn('resident', p.id, beds[i].id); a.wait = i * 0.5; a.task = 'back'; }
      this.stats.colonists += n;
      this.events.push({ type: 'dock', ship: s, text: n ? `${s.name} docked at ${this.name(p)}: ${n} colonists. Welcome, citizens! Report for gratitude.` : `${s.name} docked at ${this.name(p)}.` });
      return;
    }
    s.crates = this.def(p).crates;
    this.events.push({ type: 'dock', ship: s, text: `${s.name} docked at ${this.name(p)} with ${s.crates} crates. Commerce is patriotism.` });
  }
  _depart(s, lost) {
    if (!lost) this.stats.ships++;
    else if (s.state === 'docked' && s.crates > 0) this.stats.lost++;
    s.lastDock = s.dock || s.lastDock; s.state = 'depart'; s.t = 0; s.dock = 0; s.crates = 0; s.reserved = 0;
    for (const a of this.agents) if (a.task === 'pick' && a.ship === s.id) { a.task = null; a.path = []; a.s = 0; }
  }
}
