// The station simulation. No DOM and no 3D library: it runs the same in the browser and headless in Node (test/headless.mjs).
// The station is a tree of parts joined at ports, and each part holds rooms. People walk along the tree, part to part, through
// the joins; the distance between two parts is the real distance through the join, so where you put things matters.
// What a part does comes from its rooms (quarters, cargo stores, workshops...) plus a few things the part itself does (power,
// berths, defence). Divisions are funded from the Commander's panel: the budget buys staff, up to the places their rooms have.
import { C } from './config.js';
import { RNG } from './rng.js';
import { v, q } from './math3.js';

const NAMES = ['Honest Work', 'Steady Progress', 'Fair Weather', 'Good Neighbors', 'Quiet Resolve', 'Open Skies', 'Sturdy Ballots',
  'Shared Prosperity', 'Cheerful Compliance', 'Sensible Shoes', 'Unanimous Consent', 'Bright Mornings', 'Fair Play', 'Civic Duty',
  'Common Sense', 'Rightful Order', 'Patient Thunder', 'Reliable Freedom'];
const WARSHIPS = ['SES Hammer of Justice', 'SES Fist of Steady Progress', 'SES Banner of Fair Play', 'SES Gavel of Civic Duty', 'SES Rampart of Liberty', 'SES Pledge of Quiet Resolve'];
const PROPAGANDA = [
  'Every crate unloaded is a bullet delivered. Thank you, citizen.',
  'A happy station is a compliant station.',
  'The Liberty Contribution keeps the lights on. Literally.',
  'Remember: the hull is load-bearing. So is your loyalty.',
  'Today\'s mess special: Freedom Loaf. Seconds are patriotic.',
  'Report unapproved goods to your nearest Democracy Officer.',
  'The war is going well. Please continue to work.',
  'Space is cold. Democracy is warm. Stay inside.',
];
const FIRST = ['Mara', 'Teo', 'Ines', 'Dax', 'Lena', 'Okoye', 'Priya', 'Jonas', 'Sana', 'Rook', 'Ada', 'Viktor', 'Nell', 'Kofi', 'Mina', 'Bram', 'Yuki', 'Hale',
  'Corin', 'Tala', 'Emeka', 'Rhea', 'Soren', 'Zadie', 'Marek', 'Imani', 'Cass', 'Oren', 'Dilys', 'Pavel'];
const LAST = ['Voss', 'Marsh', 'Okafor', 'Lindqvist', 'Reyes', 'Tanaka', 'Brandt', 'Halloran', 'Ng', 'Castellan', 'Ibarra', 'Quill', 'Moreau', 'Sato', 'Dunmore',
  'Achebe', 'Petrov', 'Kessler', 'Aldana', 'Fenwick', 'Ruiz', 'Sorensen', 'Bell', 'Nakamura', 'Odum', 'Larkin', 'Vance', 'Mbeki', 'Hart', 'Ivanova'];
const STAFF = { hauler: 'supply', engineer: 'maintenance', officer: 'security', medic: 'medical' };
const FACTIONS = ['supply', 'maintenance', 'security', 'medical'];
const COMPLAIN = {
  supply: ['Commander, my haulers are walking half the station with every crate. {why}', 'Supply is not happy. {why}'],
  maintenance: ['Commander, Maintenance is stretched thin. {why}', 'The engineers are grumbling. {why}'],
  security: ['Commander, the Officers feel exposed. {why}', 'Security is not happy. {why}'],
  medical: ['Commander, Medical cannot reach the people it should. {why}', 'The medics are not happy. {why}'],
};
const PRAISE = {
  supply: 'Supply wanted you to know: the cargo flows, and the haulers noticed.',
  maintenance: 'Maintenance reports: good layout, short walks, hands happy. Wrenches up.',
  security: 'Security reports: every bay watched. The Officers are in good spirits.',
  medical: 'Medical reports: the Medbay is where it should be. Spirits are high.',
};
const STRUCTURAL = new Set(['command', 'core', 'longcore', 'junction', 'truss', 'node', 'tube']);

export class Station {
  constructor(seed = 1, mode = 'run') {
    this.rng = new RNG(seed);
    this.seed = seed;
    this.mode = mode;
    this.sandbox = mode === 'sandbox';
    this.t = 0;
    this.credits = this.sandbox ? C.sandbox.credits : C.start.credits;
    this.tax = C.start.tax;
    this.tier = this.sandbox ? C.tiers.length - 1 : 0;
    this.radius = C.tiers[this.tier].radius;
    this.div = {};
    for (const k of C.divOrder) {
      const d = C.div[k], order = {};
      for (const [o, opts] of Object.entries(d.orders)) order[o] = o === 'rate' ? 'normal' : opts[0][0];
      this.div[k] = { budget: this.sandbox && d.staff ? C.budgetMax : d.budget ?? 0, order };    // free play starts fully staffed
    }
    this.parts = new Map();
    this.nextId = 1;
    this.agents = []; this.ships = []; this.events = [];
    this.morale = C.morale.base; this.unrest = 0; this.eff = 1; this.supply = 0; this.demand = 0;
    this.stats = { crates: 0, ships: 0, lost: 0, colonists: 0, left: 0, caught: 0, contraband: 0, repairs: 0, faults: 0 };
    this.totals = { trade: 0, tax: 0, income: 0, upkeep: 0, wages: 0, build: 0 };
    this.buckets = Array.from({ length: 60 }, () => ({ s: -1, v: 0 }));
    this.timers = { freighter: 6, shuttle: 12, warship: 40, leave: C.morale.leaveSec, talk: 50 };
    this.traffic = true;
    this.crateTimes = []; this.berthTimes = [];
    this.staff = { hauler: 0, engineer: 0, officer: 0, medic: 0 };
    this.homes = { hauler: 0, engineer: 0, officer: 0, medic: 0 };
    // Factions: how happy each is (0 to 100), what it thinks is wrong, goodwill from your decisions, and what it has asked for.
    this.sat = {}; this.why = {}; this.favor = {}; this.cool = {}; this.praised = {};
    for (const k of FACTIONS) { this.sat[k] = C.faction.start; this.why[k] = ''; this.favor[k] = 0; this.cool[k] = 30; this.praised[k] = -300; }
    this.requests = []; this.reqLog = [];
    this.timers.fac = 0; this.timers.request = this.rng.range(C.faction.requestSec[0], C.faction.requestSec[1]);
    const cmd = this._make('command', 0, -1, 0, [0, 0, 0], q.id());
    cmd.state = 'active'; cmd.prog = 1;
    this.root = cmd.id;
    this._refresh();
  }

  // ---------------------------------------------------------------- geometry
  def(p) { return C.parts[p.type]; }
  name(p) { return p.type === 'command' ? 'Station Command' : `${this.def(p).name} ${p.n}`; }
  port(p, i) {
    const d = this.def(p).ports[i];
    return { pos: v.add(p.pos, q.rot(p.quat, [d[0], d[1], d[2]])), dir: q.rot(p.quat, [d[3], d[4], d[5]]), kind: d[6] };
  }
  center(p) { return v.add(p.pos, q.rot(p.quat, this.def(p).center)); }
  berth(p) {
    const b = this.def(p).berth;
    return b ? { pos: v.add(p.pos, q.rot(p.quat, [b[0], b[1], b[2]])), dir: q.rot(p.quat, [b[3], b[4], b[5]]) } : null;
  }
  // Where a new part would sit on `host`'s port `pi`, turned `rot` steps of 45 degrees about the port's axis.
  placement(type, host, pi, rot = 0) {
    const d = C.parts[type], tp = this.port(host, pi), base = d.ports[0];
    const align = q.fromTo([base[3], base[4], base[5]], v.mul(tp.dir, -1));
    const quat = q.mul(q.axisAngle(tp.dir, rot * Math.PI / 4), align);
    return { pos: v.sub(tp.pos, q.rot(quat, [base[0], base[1], base[2]])), quat };
  }
  freePorts() {
    const out = [];
    for (const p of this.parts.values()) {
      if (p.state === 'demolish') continue;
      this.def(p).ports.forEach((_, i) => { if (!p.used.has(i)) out.push({ part: p.id, i, ...this.port(p, i) }); });
    }
    return out;
  }

  // ---------------------------------------------------------------- unlocks and building
  partOpen(type) { return this.sandbox || (C.parts[type].tier ?? 0) <= this.tier; }
  roomOpen(r) { return this.sandbox || (C.rooms[r].tier ?? 0) <= this.tier; }
  canBuild(type, hostId, pi, rot = 0) {
    const d = C.parts[type], host = this.parts.get(hostId);
    if (!d || d.fixed) return { ok: false, why: 'Not buildable' };
    if (!this.partOpen(type)) return { ok: false, why: `Unlocks at ${C.tiers[d.tier].name}` };
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
    if (p.state === 'building') { this._money(this.def(p).cost, 'build'); this._remove(p); return chk; }
    p.state = 'demolish'; p.prog = 0;
    this.events.push({ type: 'demolish', part: p });
    this._refresh();
    return chk;
  }
  // Rooms: paint a slot inside a part.
  canRoom(id, slot, room) {
    const p = this.parts.get(id), r = C.rooms[room];
    if (!p || !r) return { ok: false, why: '' };
    if (!p.rooms || slot < 0 || slot >= p.rooms.length) return { ok: false, why: 'No room there' };
    if (p.rooms[slot] === room) return { ok: false, why: 'Already that room' };
    if (!this.roomOpen(room)) return { ok: false, why: `Unlocks at ${C.tiers[r.tier].name}` };
    if (r.bay && !this.def(p).bay) return { ok: false, why: 'Only inside a Hangar or Drydock' };
    if (this.credits < r.cost) return { ok: false, why: 'Not enough credits' };
    return { ok: true, why: '' };
  }
  setRoom(id, slot, room, mark = null) {
    const chk = this.canRoom(id, slot, room);
    if (!chk.ok) return chk;
    const p = this.parts.get(id);
    this._money(-C.rooms[room].cost, 'build');
    p.rooms[slot] = room; p.marks[slot] = mark;
    for (const a of this.agents) if (a.home === p.id) a.home = 0;    // anyone housed here finds their place again
    this.events.push({ type: 'room', part: p, slot });
    this._refresh();
    return chk;
  }

  _make(type, parent, pport, rot, pos, quat) {
    const n = [...this.parts.values()].filter((x) => x.type === type).length + 1;
    const p = { id: this.nextId++, type, parent, pport, rot, pos, quat, n, used: new Set(parent ? [0] : []), kids: [],
      state: 'building', prog: 0, seed: this.rng.next(), rooms: [...(C.parts[type].rooms || [])], marks: [], fault: false, fixer: 0 };
    this.parts.set(p.id, p);
    return p;
  }
  _remove(p) {
    const host = this.parts.get(p.parent);
    if (host) { host.used.delete(p.pport); host.kids = host.kids.filter((k) => k !== p.id); }
    this.parts.delete(p.id);
    for (const s of this.ships) if (s.dock === p.id) this._depart(s, true);
    for (const a of [...this.agents]) {
      if (a.at === p.id || a.path.includes(p.id)) { a.at = this.root; a.path = []; a.s = 0; a.task = null; a.wait = 0.5; a.carry = false; a.eva = false; }
      if (a.home === p.id) a.home = 0;
    }
    this.events.push({ type: 'removed', id: p.id });
    this._refresh();
  }

  works(p) { return !!p && p.state === 'active' && !p.fault; }
  has(p, room) { return !!p.rooms && p.rooms.includes(room); }
  list(test) { return [...this.parts.values()].filter((p) => this.works(p) && test(this.def(p), p)); }

  // ---------------------------------------------------------------- walking
  nbrs(p) { const out = p.kids.map((k) => this.parts.get(k)).filter((x) => x && x.state === 'active'); const h = this.parts.get(p.parent); if (h && h.state === 'active') out.push(h); return out; }
  edge(a, b) {
    const child = b.parent === a.id ? b : a;
    const conn = this.port(child, 0).pos, ca = this.center(a), cb = this.center(b);
    const da = v.dist(ca, conn), db = v.dist(conn, cb);
    return { ca, conn, cb, da, db, len: Math.max(0.3, da + db) };
  }
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
  walkDist(fromId, path) { let d = 0, a = this.parts.get(fromId); for (const id of path) { const b = this.parts.get(id); d += this.edge(a, b).len; a = b; } return d; }

  // ---------------------------------------------------------------- what the station adds up to
  _refresh() {
    let sup = 0, dem = 0, beds = 0, leisure = 0, income = 0, defence = 0, food = 0, broadcast = 0, ops = 0;
    const homes = { hauler: 0, engineer: 0, officer: 0, medic: 0 };
    let spires = 0, fuel = 0, refine = 0;
    this.cargoIds = new Set(); this.homeParts = { hauler: [], engineer: [], officer: [], medic: [] };
    for (const p of this.parts.values()) {
      if (p.state !== 'active') continue;
      const d = this.def(p);
      if (d.pw < 0) { if (!p.fault) sup -= d.pw; } else dem += d.pw;
      const ok = !p.fault;
      for (const r of p.rooms) { const R = C.rooms[r]; if (R.beds) beds += R.beds; }
      if (!ok) continue;
      if (d.leisure) leisure += d.leisure;
      if (d.defence) defence += d.defence;
      if (d.traffic) spires += d.traffic;
      if (d.fuel) fuel++;
      if (d.refine) refine++;
      if (d.cargo) this.cargoIds.add(p.id);
      for (const [role, n] of Object.entries(d.homes || {})) { homes[role] += n; this.homeParts[role].push(p.id); }
      for (const r of p.rooms) {
        const R = C.rooms[r];
        leisure += R.leisure || 0; income += R.income || 0; defence += R.defence || 0; food += R.food || 0; broadcast += R.broadcast || 0;
        if (R.traffic) ops++;
        if (R.cargo) this.cargoIds.add(p.id);
        for (const [role, n] of Object.entries(R.homes || {})) { homes[role] += n; if (!this.homeParts[role].includes(p.id)) this.homeParts[role].push(p.id); }
      }
    }
    this.supply = sup; this.demand = dem; this.eff = dem <= 0 ? 1 : Math.min(1, sup / dem);
    this.capBeds = beds; this.leisure = leisure; this.income = income; this.defence = defence; this.food = food; this.broadcast = broadcast;
    this.trafficMul = 1 + Math.min(0.4, spires) + 0.1 * Math.min(3, ops);
    this.fuelN = Math.min(3, fuel); this.refineN = Math.min(2, refine);
    this.homes = homes;
    for (const [role, k] of Object.entries(STAFF)) this.staff[role] = Math.min(homes[role], Math.floor(this.div[k].budget / C.div[k].wage));
  }
  beds() { return this.capBeds; }
  residents() { let n = 0; for (const a of this.agents) if (a.role === 'resident') n++; return n; }
  berths(kind) {
    return this.list((d, p) => d.berth && (!d.berthRoom || this.has(p, d.berthRoom)) && (!kind || d.ships.includes(kind)));
  }
  roomCount(room) { let n = 0; for (const p of this.parts.values()) if (this.works(p)) for (const r of p.rooms) if (r === room) n++; return n; }
  upkeep() {
    let s = 0;
    for (const p of this.parts.values()) if (p.state === 'active') { s += this.def(p).up; for (const r of p.rooms) s += C.rooms[r].up || 0; }
    s = s * (this.div.maintenance.order.plan === 'preventive' ? 1.2 : 1) - this.food;
    return Math.max(0, s);
  }
  wages() {
    let s = 0;
    for (const [role, k] of Object.entries(STAFF)) s += this.staff[role] * C.div[k].wage;
    if (this.div.truth.order.broadcast !== 'silence') s += this.div.truth.budget;
    if (this.div.medical.order.care === 'free' && this.staff.medic) s += 10;
    return s;
  }
  incomePerMin() {
    let s = this.residents() ? this.income : 0;
    if (this.div.medical.order.care === 'fees') s += 2 * this.staff.medic;
    return s;
  }
  taxPerMin() { return this.residents() * this.tax * C.econ.taxPerPct; }
  setTax(x) { this.tax = Math.max(0, Math.min(30, Math.round(x))); }
  setBudget(k, x) { this.div[k].budget = Math.max(0, Math.min(C.budgetMax, Math.round(x))); this._refresh(); }
  setOrder(k, o, val) { this.div[k].order[o] = val; this._refresh(); this.events.push({ type: 'order', from: k, text: this.ack(k, o, val) }); }
  broadcastBoost() {
    const o = this.div.truth.order.broadcast;
    if (o !== 'patriotic') return 0;
    return Math.min(8, (this.div.truth.budget / 10) * (1 + 0.5 * this.broadcast));
  }
  moraleParts() {
    const M = C.morale, sh = this.div.supply.order.shift === 'double', care = this.div.medical.order.care;
    const tax = this.tax > M.taxFree ? -(this.tax - M.taxFree) * M.taxPenalty : (M.taxFree - this.tax) * M.taxBonus;
    const faulty = [...this.parts.values()].filter((p) => p.fault && p.rooms.length).length;
    return {
      base: M.base, tax, leisure: Math.max(-10, Math.min(M.leisureMax, this.leisure)), power: -M.power * (1 - this.eff),
      unrest: -this.unrest, faults: -M.faulty * faulty, medical: this.staff.medic ? (care === 'free' ? 4 : -2) : 0,
      broadcast: this.broadcastBoost(), shifts: sh ? -5 : 0, broke: this.credits < 0 ? -15 : 0,
    };
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
  say(from, text, extra = {}) { this.events.push({ type: 'comms', from, text, ...extra }); }

  // ---------------------------------------------------------------- the upgrade path
  next() {
    const T = C.tiers[this.tier + 1];
    if (!T) return null;
    const n = T.needs, items = [];
    if (n.residents) items.push({ label: 'Residents', have: this.residents(), need: n.residents });
    if (n.cap) items.push({ label: 'Capability', have: this.capability(), need: n.cap });
    if (n.crates) items.push({ label: 'Crates traded', have: this.stats.crates, need: n.crates });
    if (n.power) items.push({ label: 'Power supply', have: this.supply, need: n.power });
    if (n.morale) items.push({ label: 'Morale', have: Math.round(this.morale), need: n.morale });
    for (const r of n.rooms || []) items.push({ label: `${C.rooms[r].name} running`, have: this.roomCount(r), need: 1 });
    for (const i of items) i.ok = i.have >= i.need;
    return { ...T, items };
  }
  unlocksOf(tier) {
    return { parts: Object.entries(C.parts).filter(([, d]) => (d.tier ?? -1) === tier).map(([, d]) => d.name),
      rooms: Object.entries(C.rooms).filter(([, r]) => r.tier === tier).map(([, r]) => r.name) };
  }
  _tiers() {
    const n = this.next();
    if (!n || !n.items.every((i) => i.ok)) return;
    this.tier++; this.radius = C.tiers[this.tier].radius;
    const u = this.unlocksOf(this.tier);
    this.events.push({ type: 'tier', tier: this.tier });
    this.say('ministry', `${C.tiers[this.tier].name} STATUS GRANTED. The build zone grows to ${this.radius} units. Unlocked: ${[...u.parts, ...u.rooms].join(', ') || 'the Ministry\'s gratitude'}.`, { gold: true });
    this._refresh();
  }

  // ---------------------------------------------------------------- factions: what each division wants, and how happy it is
  // Walking distance from the nearest of `sources` to every active part (a multi-source Dijkstra over the joins).
  distMap(sources) {
    const dist = new Map(), open = [], done = new Set();
    for (const id of sources) if (this.parts.get(id)) { dist.set(id, 0); open.push(id); }
    while (open.length) {
      open.sort((a, b) => dist.get(a) - dist.get(b));
      const id = open.shift();
      if (done.has(id)) continue;
      done.add(id);
      const p = this.parts.get(id);
      for (const n of this.nbrs(p)) {
        const d = dist.get(id) + this.edge(p, n).len;
        if (!dist.has(n.id) || d < dist.get(n.id)) { dist.set(n.id, d); open.push(n.id); }
      }
    }
    return dist;
  }
  // Happy factions work faster, unhappy ones slower.
  mood(role) {
    const k = STAFF[role], F = C.faction;
    return k ? F.speedMin + (F.speedMax - F.speedMin) * this.sat[k] / 100 : 1;
  }
  _active() { return [...this.parts.values()].filter((p) => p.state === 'active'); }
  _withRoom(room) { return this._active().filter((p) => !p.fault && p.rooms.includes(room)).map((p) => p.id); }
  // What the layout is worth to each faction right now (0 to 100), and the reason in the faction's own terms.
  _targets() {
    const out = {}, act = this._active(), fb = this.berths('freighter').map((p) => p.id);
    const avg = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length), clamp = (x) => Math.max(5, Math.min(100, x));
    const cargo = [...this.cargoIds];
    if (!fb.length) out.supply = { t: 55, why: 'There are no docking ports yet.' };
    else if (!cargo.length) out.supply = { t: 15, why: 'There is nowhere to put the cargo.' };
    else {
      const dm = this.distMap(cargo), d = avg(fb.map((b) => dm.get(b) ?? 60)), lost = this.stats.lost / Math.max(1, this.stats.ships + this.stats.lost);
      out.supply = { t: clamp(100 - d * 3 - lost * 40), why: `Crates walk ${Math.round(d)} units from the docks to a store.${lost > 0.2 ? ' Ships are giving up and leaving.' : ''}` };
    }
    const shops = this._withRoom('workshop'), body = act.filter((p) => !STRUCTURAL.has(p.type)).map((p) => p.id), faults = act.filter((p) => p.fault).length;
    if (!body.length) out.maintenance = { t: 55, why: 'There is little to maintain yet.' };
    else if (!shops.length) out.maintenance = { t: 15, why: 'There is no Workshop to work from.' };
    else {
      const dm = this.distMap(shops), d = avg(body.map((b) => dm.get(b) ?? 60));
      out.maintenance = { t: clamp(100 - d * 2.5 - Math.min(45, faults * 15)), why: `The nearest Workshop is ${Math.round(d)} units from the average part.${faults ? ` ${faults} fault${faults > 1 ? 's are' : ' is'} still open.` : ''}` };
    }
    const offices = this._withRoom('secoffice');
    if (!fb.length) out.security = { t: 55, why: 'There are no docking bays to watch yet.' };
    else if (!offices.length) out.security = { t: 20, why: 'There is no Security Office, so every bay is unwatched.' };
    else {
      const dm = this.distMap(offices), cover = fb.filter((b) => (dm.get(b) ?? 99) <= C.securityReach).length / fb.length;
      out.security = { t: clamp(30 + 70 * cover - Math.min(20, this.unrest * 1.5)), why: cover < 1 ? `Only ${Math.round(cover * 100)}% of the docking bays are within reach of a Security Office.` : 'Smugglers keep getting through.' };
    }
    const bays = this._withRoom('medbay'), beds = act.filter((p) => p.rooms.some((r) => C.rooms[r].beds)).map((p) => p.id);
    if (!this.residents()) out.medical = { t: 55, why: 'There is no one to look after yet.' };
    else if (!bays.length) out.medical = { t: 20, why: 'There is no Medbay.' };
    else {
      const dm = this.distMap(bays), d = avg(beds.map((b) => dm.get(b) ?? 60));
      out.medical = { t: clamp(100 - d * 3), why: `The Medbay is ${Math.round(d)} units from the average bed.` };
    }
    // A faction cannot be blamed for a room the Ministry has not allowed yet.
    for (const k of FACTIONS) if (!this.roomOpen(C.factions[k].room)) out[k] = { t: 55, why: `The Ministry has not yet allowed ${C.factions[k].ask.replace(/^an? /, '')}s.` };
    for (const [role, k] of Object.entries(STAFF)) if (this.homes[role] > 0 && this.staff[role] === 0) { out[k].t = Math.max(5, out[k].t - 20); out[k].why = `No one is on the budget to staff it. ${out[k].why}`; }
    return out;
  }
  _factions(dt) {
    const F = C.faction;
    if ((this.timers.fac -= dt) <= 0) { this.timers.fac = F.evalSec; this.target = this._targets(); }
    if (!this.target) return;
    for (const k of FACTIONS) {
      const f = this.favor[k];
      this.favor[k] = f - Math.sign(f) * Math.min(Math.abs(f), F.favorDecay * dt);
      const T = this.target[k], goal = Math.max(0, Math.min(100, T.t + this.favor[k]));
      this.sat[k] += Math.max(-F.easeSec * dt, Math.min(F.easeSec * dt, goal - this.sat[k]));
      this.why[k] = T.why;
      this.cool[k] -= dt;
      if (this.sandbox || this.t < 60) continue;
      if (this.sat[k] < F.low && this.cool[k] <= 0) { this.cool[k] = F.cooldown; this.say(k, this.rng.pick(COMPLAIN[k]).replace('{why}', T.why), { warn: true }); }
      else if (this.sat[k] > F.high && this.t - this.praised[k] > F.praiseCooldown) { this.praised[k] = this.t; this.say(k, PRAISE[k], { gold: true }); }
    }
  }
  // The overall score: what the station adds to the war effort, nudged by how happy its factions are.
  capability() {
    const K = C.capability, sat = FACTIONS.reduce((s, k) => s + this.sat[k], 0) / FACTIONS.length;
    const staff = Object.values(this.staff).reduce((s, x) => s + x, 0);
    const raw = this.stats.crates * K.crate + this.stats.ships * K.ship + this.residents() * K.resident + this.defence * K.defence + (this.stats.repairs || 0) * K.repair + staff * K.staff;
    return Math.round(raw * (0.7 + 0.6 * sat / 100));
  }
  crew(k) { return this.agents.filter((a) => a.role === C.div[k].staff); }
  doing(a) {
    if (a.eva) return a.task === 'drydock' ? 'on EVA, repairing a warship' : 'on EVA, repairing the hull';
    if (a.carry) return 'carrying a crate to a store';
    switch (a.task) {
      case 'pick': return 'going to collect a crate';
      case 'fix': return 'heading out to a fault';
      case 'drydock': return 'heading to the drydock';
      case 'inspect': return 'inspecting a ship';
      case 'rounds': return 'doing rounds';
      case 'leave': return 'leaving the station';
      case 'out': return 'out for a walk';
      case 'back': return 'heading home';
      default: return a.role === 'resident' ? 'at home' : 'on station';
    }
  }

  // ---------------------------------------------------------------- requests: a faction asks for a room, you approve or deny
  // The place it would like: the part furthest from what it has (or the first it has none for), and the nearest free slot to that.
  _needPoint(k) {
    const act = this._active(), fb = this.berths('freighter').map((p) => p.id);
    let have, subjects;
    if (k === 'supply') { have = [...this.cargoIds]; subjects = fb; }
    else if (k === 'maintenance') { have = this._withRoom('workshop'); subjects = act.filter((p) => !STRUCTURAL.has(p.type)).map((p) => p.id); }
    else if (k === 'security') { have = this._withRoom('secoffice'); subjects = fb; }
    else { have = this._withRoom('medbay'); subjects = this.residents() ? act.filter((p) => p.rooms.some((r) => C.rooms[r].beds)).map((p) => p.id) : []; }
    if (!subjects.length) return null;
    if (!have.length) return { part: subjects[0], far: Infinity };
    const dm = this.distMap(have);
    let worst = null;
    for (const id of subjects) { const d = dm.get(id) ?? 99; if (!worst || d > worst.far) worst = { part: id, far: d }; }
    return worst.far > C.faction.farUnits ? worst : null;
  }
  _freeSlot(p) {
    const taken = new Set(this.requests.filter((r) => r.part === p.id).map((r) => r.slot));
    let slot = p.rooms.findIndex((r, i) => r === 'empty' && !taken.has(i));
    if (slot >= 0) return slot;
    const beds = p.rooms.reduce((s, r) => s + (C.rooms[r].beds || 0), 0);
    const housed = this.agents.filter((a) => a.role === 'resident' && a.home === p.id && !a.leaving).length;
    return beds - housed >= 2 ? p.rooms.findIndex((r, i) => r === 'quarters' && !taken.has(i)) : -1;
  }
  _propose() {
    const order = FACTIONS.filter((k) => !this.requests.some((r) => r.k === k)).sort((a, b) => this.sat[a] - this.sat[b]);
    for (const k of order) {
      const room = C.factions[k].room, cost = C.rooms[room].cost;
      if (!this.roomOpen(room) || this.credits < cost) continue;
      const need = this._needPoint(k);
      if (!need) continue;
      const dm = this.distMap([need.part]);
      let best = null;
      for (const p of this._active()) {
        if (p.fault || !dm.has(p.id)) continue;
        const slot = this._freeSlot(p);
        if (slot >= 0 && (!best || dm.get(p.id) < best.d)) best = { p, slot, d: dm.get(p.id) };
      }
      if (!best || best.d > need.far * 0.6) continue;
      const F = C.factions[k], req = { id: this.nextId++, k, part: best.p.id, slot: best.slot, room, was: best.p.rooms[best.slot], cost, t: 0 };
      this.requests.push(req);
      this.say(k, need.far === Infinity
        ? `Commander, ${F.who} has nothing of its own yet. We request ${F.ask} in ${this.name(best.p)} (${cost} CR).`
        : `Commander, ${F.who} requests ${F.ask} in ${this.name(best.p)} (${cost} CR). ${this.why[k]}`, { request: req.id });
      return true;
    }
    return false;
  }
  _requests(dt) {
    if (this.sandbox) return;
    const F = C.faction;
    for (const r of [...this.requests]) {
      r.t += dt;
      if (r.t >= F.ttl) { this._close(r, 'expired'); this.favor[r.k] += F.ignore; this.say(r.k, `No answer on our request, Commander. We will remember that.`, { warn: true }); }
    }
    if ((this.timers.request -= dt) <= 0) {
      this.timers.request = this.rng.range(F.requestSec[0], F.requestSec[1]);
      if (this.requests.length < F.pending) this._propose();
    }
  }
  _close(r, outcome) { this.requests.splice(this.requests.indexOf(r), 1); this.reqLog.push({ k: r.k, outcome, t: this.t }); this.events.push({ type: 'request', id: r.id, outcome }); }
  approve(id) {
    const r = this.requests.find((x) => x.id === id);
    if (!r) return { ok: false, why: 'That request has closed.' };
    const p = this.parts.get(r.part);
    if (!p || p.state !== 'active' || p.rooms[r.slot] !== r.was) { this._close(r, 'void'); return { ok: false, why: 'That space is no longer free.' }; }
    const res = this.setRoom(r.part, r.slot, r.room, r.k);
    if (!res.ok) return res;
    this._close(r, 'approved');
    this.favor[r.k] = Math.min(25, this.favor[r.k] + C.faction.approve);
    this.say(r.k, `Thank you, Commander. ${C.factions[r.k].ask[0].toUpperCase()}${C.factions[r.k].ask.slice(1)} is going into ${this.name(p)}, marked for ${C.factions[r.k].who}.`, { gold: true });
    return { ok: true, why: '' };
  }
  deny(id) {
    const r = this.requests.find((x) => x.id === id);
    if (!r) return { ok: false, why: 'That request has closed.' };
    this._close(r, 'denied');
    this.favor[r.k] = Math.max(-25, this.favor[r.k] + C.faction.deny);
    this.say(r.k, 'Understood, Commander. The answer is no. We will make do.', { dim: true });
    return { ok: true, why: '' };
  }

  // ---------------------------------------------------------------- the step
  step(dt) {
    this.t += dt;
    let changed = false;
    const meanSec = C.faults.meanSec * (this.div.maintenance.order.plan === 'preventive' ? 2 : 1);
    for (const p of [...this.parts.values()]) {
      if (p.state === 'building') {
        p.prog += dt / Math.max(0.1, this.def(p).build);
        if (p.prog >= 1) { p.state = 'active'; p.prog = 1; changed = true; this.events.push({ type: 'built', part: p }); }
      } else if (p.state === 'demolish') {
        p.prog += dt / C.demolish.sec;
        if (p.prog >= 1) { this._money(Math.round(this.def(p).cost * C.demolish.refund), 'build'); this._remove(p); }
      } else if (!p.fault && !STRUCTURAL.has(p.type) && this.rng.chance(dt / meanSec)) { this._fault(p); changed = true; }
    }
    if (changed) this._refresh();
    this._staff();
    this._ships(dt);
    this._residents(dt);
    for (const a of [...this.agents]) this._agent(a, dt);
    const k = dt / 60;
    if (this.residents()) this._money(this.taxPerMin() * k, 'tax');
    const inc = this.incomePerMin(); if (inc) this._money(inc * k, 'income');
    const u = this.upkeep(); if (u) this._money(-u * k, 'upkeep');
    const w = this.wages(); if (w) this._money(-w * k, 'wages');
    const p = this.moraleParts(), target = Math.max(0, Math.min(100, Object.values(p).reduce((s, x) => s + x, 0)));
    this.morale += Math.max(-1.5 * dt, Math.min(1.5 * dt, target - this.morale));
    this.unrest = Math.max(0, this.unrest - dt * C.morale.contraband / C.morale.unrestDecaySec);
    this._factions(dt);
    this._requests(dt);
    this._tiers();
    if ((this.timers.talk -= dt) <= 0) {
      this.timers.talk = 70 + this.rng.range(0, 40);
      if (this.div.truth.order.broadcast !== 'silence') this.say('truth', this.rng.pick(PROPAGANDA), { dim: true });
    }
  }

  // ---------------------------------------------------------------- staff and residents
  _staff() {
    for (const role of Object.keys(STAFF)) {
      const want = this.staff[role], have = this.agents.filter((a) => a.role === role);
      const homes = this.homeParts[role].map((id) => this.parts.get(id)).filter((x) => x);
      if (have.length > want) for (const a of have.sort((x, y) => (x.task ? 1 : 0) - (y.task ? 1 : 0)).slice(0, have.length - want)) this._drop(a);
      else if (homes.length) for (let i = have.length; i < want; i++) { const h = homes[i % homes.length]; this._spawn(role, h.id, h.id); }
      for (const a of this.agents) if (a.role === role && (!a.home || !this.parts.get(a.home))) a.home = homes.length ? homes[this.rng.int(homes.length)].id : this.root;
    }
  }
  _spawn(role, at, home) {
    const a = { id: this.nextId++, role, at, home, path: [], s: 0, wait: this.rng.range(0, 1), task: null, carry: false, ship: 0, seed: this.rng.next(), eva: false,
      name: `${this.rng.pick(FIRST)} ${this.rng.pick(LAST)}`, since: this.t };
    this.agents.push(a); return a;
  }
  _drop(a) {
    if (a.task === 'pick') { const s = this.ships.find((x) => x.id === a.ship); if (s) s.reserved = Math.max(0, s.reserved - 1); }
    if (a.task === 'fix') { const p = this.parts.get(a.target); if (p && p.fixer === a.id) p.fixer = 0; }
    this.agents.splice(this.agents.indexOf(a), 1);
  }
  freeBeds() {
    const out = [];
    for (const p of this.parts.values()) {
      if (p.state !== 'active') continue;
      const beds = p.rooms.reduce((s, r) => s + (C.rooms[r].beds || 0), 0);
      if (!beds) continue;
      const n = this.agents.filter((a) => a.role === 'resident' && a.home === p.id && !a.leaving).length;
      for (let i = n; i < beds; i++) out.push(p);
    }
    return out;
  }
  _residents(dt) {
    // Everyone with no bed (their room was changed or their part came down) finds a free one, or leaves.
    const count = new Map();
    let homeless = false;
    for (const a of this.agents) {
      if (a.role !== 'resident' || a.leaving) continue;
      const h = this.parts.get(a.home), beds = h && h.state === 'active' ? h.rooms.reduce((s, r) => s + (C.rooms[r].beds || 0), 0) : 0;
      const n = (count.get(a.home) || 0) + 1; count.set(a.home, n);
      if (n > beds) { a.homeless = true; homeless = true; }
    }
    if (homeless) {
      const free = this.freeBeds();
      for (const a of this.agents) if (a.homeless) { a.homeless = false; const f = free.shift(); if (f) a.home = f.id; else this._leave(a); }
    }
    if (this.morale < C.morale.leaveBelow && this.residents() > 0) {
      if ((this.timers.leave -= dt) <= 0) {
        this.timers.leave = C.morale.leaveSec;
        const a = this.agents.find((x) => x.role === 'resident' && !x.leaving);
        if (a) { this._leave(a); this.say('colonists', 'A citizen has asked to leave the station. This has been noted.', { warn: true }); }
      }
    } else this.timers.leave = C.morale.leaveSec;
  }
  _leave(a) { a.leaving = true; a.path = []; a.wait = 0; a.task = null; }

  // ---------------------------------------------------------------- agents
  _agent(a, dt) {
    if (a.path.length) { this._walk(a, dt); return; }
    if (a.wait > 0) { a.wait -= dt; if (a.wait > 0) return; if (a.pending) { const p = a.pending; a.pending = null; this._done(a, p); return; } }
    this._think(a);
  }
  _walk(a, dt) {
    const fast = a.role === 'hauler' && this.div.supply.order.shift === 'double' ? 1.4 : 1;
    let left = dt * C.walk.speed * (0.55 + 0.45 * this.eff) * fast * (a.role !== 'resident' && this.credits < 0 ? 0.6 : 1) * this.mood(a.role);
    while (left > 0 && a.path.length) {
      const from = this.parts.get(a.at), to = this.parts.get(a.path[0]);
      if (!from || !to || to.state !== 'active') { a.path = []; a.s = 0; break; }
      const L = this.edge(from, to).len;
      if (a.s + left >= L) { left -= L - a.s; a.s = 0; a.at = to.id; a.path.shift(); } else { a.s += left; left = 0; }
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
  _goHome(a, idle = [1, 2.5]) {
    if (a.at === a.home) { a.task = null; a.wait = this.rng.range(idle[0], idle[1]); return; }
    if (!this._go(a, (x) => x.id === a.home, 'home')) { a.task = null; a.wait = 1.5; }
  }
  _think(a) {
    if (a.role === 'hauler') return this._hauler(a);
    if (a.role === 'engineer') return this._engineer(a);
    if (a.role === 'medic') {
      if (a.task !== 'rounds' && this.rng.chance(0.5)) {
        const homes = [...new Set(this.agents.filter((x) => x.role === 'resident').map((x) => x.home))].filter((h) => this.parts.get(h));
        if (homes.length) { const t = this.rng.pick(homes); if (this._go(a, (p) => p.id === t, 'rounds')) return; }
      }
      return this._goHome(a, [3, 7]);
    }
    if (a.role === 'officer') return this._goHome(a, [2, 5]);
    if (a.leaving) { if (!this._go(a, (p) => this.works(p) && this.def(p).berth, 'leave')) this._gone(a); return; }
    // Residents: home, then somewhere social, then home again.
    const goHome = a.task === 'back' || this.rng.next() >= 0.6;
    if (!goHome) {
      const spots = this.list((d, p) => p.type === 'command' || p.rooms.some((r) => C.rooms[r].leisure > 0) || d.leisure).filter((p) => p.id !== a.at);
      if (spots.length) { const t = this.rng.pick(spots).id; if (this._go(a, (p) => p.id === t, 'out')) return; }
    }
    if (!a.home) { a.task = null; a.wait = 2; return; }
    this._goHome(a, [6, 16]);
  }
  _hauler(a) {
    const cargo = (p) => this.works(p) && this.cargoIds.has(p.id);
    if (a.carry) { if (!this._go(a, cargo, 'drop')) { a.task = null; a.wait = 1; } return; }
    const open = this.cargoIds.size ? this.ships.filter((s) => s.state === 'docked' && s.kind === 'freighter' && s.inspect <= 0 && s.crates - s.reserved > 0) : [];
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
    this._goHome(a);
  }
  _engineer(a) {
    const broken = [...this.parts.values()].filter((p) => p.fault && !p.fixer && p.state === 'active');
    if (broken.length) {
      const ids = new Set(broken.map((p) => p.id)), path = this.route(a.at, (p) => ids.has(p.id));
      if (path) {
        const end = path.length ? path[path.length - 1] : a.at, p = this.parts.get(end);
        p.fixer = a.id; a.target = p.id; a.path = path; a.s = 0; a.task = 'fix';
        if (!path.length) this._arrive(a);
        return;
      }
    }
    // A warship in drydock needs hands on its hull.
    const ws = this.ships.find((s) => s.state === 'docked' && s.kind === 'warship' && (s.crew || 0) < 3);
    if (ws && this.rng.chance(0.6)) { ws.crew = (ws.crew || 0) + 1; a.ship = ws.id; if (this._go(a, (p) => p.id === ws.dock, 'drydock')) return; ws.crew--; }
    this._goHome(a, [2, 4]);
  }
  _arrive(a) {
    const W = C.walk;
    if (a.task === 'pick') { a.wait = W.pickSec; a.pending = 'pick'; return; }
    if (a.task === 'drop') { a.wait = W.dropSec; a.pending = 'drop'; return; }
    if (a.task === 'fix') { a.wait = W.repairSec / (0.5 + 0.5 * this.eff) / this.mood(a.role); a.pending = 'fix'; a.eva = true; return; }
    if (a.task === 'drydock') { a.wait = 8; a.pending = 'drydock'; a.eva = true; return; }
    if (a.task === 'inspect') { a.wait = W.inspectSec; a.pending = 'inspect'; return; }
    if (a.task === 'leave') { this.stats.left++; this._gone(a); return; }
    if (a.task === 'out' || a.task === 'rounds') { a.wait = this.rng.range(5, 12); a.task = 'back'; return; }
    a.wait = a.role === 'resident' ? this.rng.range(6, 16) : this.rng.range(1, 2); a.task = null;
  }
  _gone(a) { const i = this.agents.indexOf(a); if (i >= 0) this.agents.splice(i, 1); }
  _done(a, what) {
    a.eva = false;
    if (what === 'pick') {
      const s = this.ships.find((x) => x.id === a.ship);
      a.task = null;
      if (s && s.state === 'docked' && s.crates > 0) { s.crates--; a.carry = true; }
      if (s) s.reserved = Math.max(0, s.reserved - 1);
    } else if (what === 'drop') {
      a.carry = false; a.task = null;
      this._money(C.econ.crateFee + this.refineN * C.parts.refinery.refine, 'trade'); this.stats.crates++; this.crateTimes.push(this.t);
      this.events.push({ type: 'crate', part: a.at });
    } else if (what === 'fix') {
      const p = this.parts.get(a.target);
      a.task = null;
      if (p && p.fixer === a.id) {
        p.fault = false; p.fixer = 0; this.stats.fixed = (this.stats.fixed || 0) + 1; this._refresh();
        this.say('maintenance', `${this.name(p)} is back online. Hull integrity restored, Commander.`);
      }
    } else if (what === 'drydock') {
      const s = this.ships.find((x) => x.id === a.ship);
      if (s) s.crew = Math.max(0, (s.crew || 1) - 1);
      a.task = null;
    } else if (what === 'inspect') { a.task = null; }
  }

  // ---------------------------------------------------------------- free play controls
  _fault(p) {
    p.fault = true; this.stats.faults++;
    this.say('maintenance', this.staff.engineer ? `Fault on ${this.name(p)}. A team is suiting up for EVA.` : `Fault on ${this.name(p)}. We have no engineers on staff to fix it, Commander.`, { warn: true });
  }
  // Free play: break a random working part, to watch the engineers go out on EVA.
  breakPart() {
    const c = [...this.parts.values()].filter((p) => p.state === 'active' && !p.fault && !STRUCTURAL.has(p.type));
    if (!c.length) return null;
    const p = this.rng.pick(c); this._fault(p); this._refresh(); return p;
  }
  spawnShip(kind) { if (!this.berths(kind).length) return false; this._arrival(kind); return true; }
  addColonists(n) {
    const beds = this.freeBeds(), k = Math.min(n, beds.length);
    for (let i = 0; i < k; i++) { const a = this._spawn('resident', this.root, beds[i].id); a.task = 'back'; a.wait = i * 0.2; }
    this.stats.colonists += k;
    return k;
  }
  clearShips() { this.ships.length = 0; for (const a of this.agents) if (a.task === 'pick') { a.task = null; a.path = []; a.s = 0; } }
  cratesPerMin() { while (this.crateTimes.length && this.crateTimes[0] < this.t - 60) this.crateTimes.shift(); return this.crateTimes.length * 60 / Math.min(60, Math.max(1, this.t)); }
  avgBerth() { const b = this.berthTimes; return b.length ? b.reduce((x, y) => x + y, 0) / b.length : null; }
  busy(role) { const h = this.agents.filter((a) => a.role === role); return { busy: h.filter((a) => a.carry || ['pick', 'drop', 'fix', 'drydock', 'inspect'].includes(a.task)).length, all: h.length }; }

  // ---------------------------------------------------------------- ships
  _ships(dt) {
    const S = C.ships, T = this.div.traffic.order, rate = S.rate[T.rate], mix = T.mix;
    if (this.traffic) {
      const fb = this.berths('freighter');
      if (fb.length && mix !== 'colonists' && (this.timers.freighter -= dt) <= 0) {
        this.timers.freighter = S.freighterSec / (1 + 0.5 * (fb.length - 1)) / this.trafficMul / rate * this.rng.range(0.75, 1.25);
        this._arrival('freighter');
      }
      const recruit = this.div.truth.order.broadcast === 'recruitment' ? 1.5 : 1;
      if (this.berths('shuttle').length && mix !== 'freight' && this.freeBeds().length && this.morale >= S.shuttleMorale && !this.ships.some((s) => s.kind === 'shuttle' && s.state !== 'depart')) {
        if ((this.timers.shuttle -= dt * recruit) <= 0) { this.timers.shuttle = S.shuttleSec * this.rng.range(0.8, 1.2); this._arrival('shuttle'); }
      }
      if (this.berths('warship').length && mix === 'all' && !this.ships.some((s) => s.kind === 'warship' && s.state !== 'depart')) {
        if ((this.timers.warship -= dt) <= 0) { this.timers.warship = S.warshipSec * this.rng.range(0.8, 1.3); this._arrival('warship'); }
      }
    }
    for (const s of this.ships.filter((x) => x.state === 'hold').sort((a, b) => a.born - b.born)) {
      const b = this.berths(s.kind).find((p) => !this.ships.some((o) => o.dock === p.id && o.state !== 'depart'));
      if (!b) continue;
      s.dock = b.id; s.state = 'approach'; s.t = 0;
    }
    for (const s of [...this.ships]) {
      s.t += dt;
      if (s.state === 'hold' && s.t > S.waitSec) { this.stats.lost++; this.say('traffic', `${s.name} gave up waiting for a berth and jumped away. Trade lost.`, { warn: true }); this._depart(s, true); }
      else if (s.state === 'approach' && s.t >= S.approachSec) this._docked(s);
      else if (s.state === 'docked') {
        if (!this.parts.get(s.dock)) { this._depart(s, true); continue; }
        if (s.inspect > 0) s.inspect -= dt;
        if (s.kind === 'shuttle' ? s.t > 4 : s.kind === 'warship' ? s.repair >= 1 : s.crates <= 0 && s.reserved <= 0 && s.inspect <= 0) this._depart(s, false);
        else if (s.kind === 'warship') {
          const hands = this.agents.filter((a) => a.task === 'drydock' && a.ship === s.id && a.eva).length;
          s.repair += dt / S.repairSec * (0.25 + 0.75 * Math.min(1, hands / 2));
          if (s.repair >= 1) { this._money(S.repairFee, 'trade'); this.stats.repairs++; this.say('captain', `${s.name}: repairs complete. Your yard did fine work, Commander. Transferring ${S.repairFee} CR. Back to the front.`); }
        }
      } else if (s.state === 'depart' && s.t >= S.departSec) this.ships.splice(this.ships.indexOf(s), 1);
    }
  }
  _arrival(kind) {
    if (this.ships.filter((s) => s.state === 'hold').length >= C.ships.queueMax) {
      this.stats.lost++; this.say('traffic', 'A ship was turned away: every berth and holding slot is full.', { warn: true }); return;
    }
    const name = kind === 'warship' ? this.rng.pick(WARSHIPS) : `${kind === 'shuttle' ? 'Shuttle' : 'Freighter'} ${this.rng.pick(NAMES)}`;
    this.ships.push({ id: this.nextId++, kind, name, born: this.t, state: 'hold', t: 0, dock: 0, crates: 0, reserved: 0, inspect: 0, repair: 0, crew: 0,
      seed: this.rng.next(), lastDock: 0, smuggler: kind === 'freighter' && this.rng.chance(C.ships.smuggler) });
    if (kind === 'warship') this.say('traffic', `${name} is inbound with battle damage, requesting the drydock.`);
  }
  _docked(s) {
    const p = this.parts.get(s.dock);
    if (!p) { this._depart(s, true); return; }
    s.state = 'docked'; s.t = 0; s.lastDock = p.id; s.dockedAt = this.t;
    this._money(C.econ.dockFee + this.fuelN * C.parts.tanks.fuel, 'trade');
    if (s.kind === 'shuttle') {
      const beds = this.freeBeds(), n = Math.min(C.ships.colonists, beds.length);
      for (let i = 0; i < n; i++) { const a = this._spawn('resident', p.id, beds[i].id); a.wait = i * 0.5; a.task = 'back'; }
      this.stats.colonists += n;
      this.say('captain', n ? `${s.name} at ${this.name(p)}. ${n} colonists disembarking. Welcome, citizens! Report for gratitude.` : `${s.name} at ${this.name(p)}, no one to drop off.`);
      return;
    }
    if (s.kind === 'warship') { this.say('traffic', `${s.name} is in the drydock. Engineers to EVA stations.`); return; }
    s.crates = this.def(p).crates || 6;
    this.say(this.rng.chance(0.5) ? 'captain' : 'traffic', this.rng.chance(0.5) ? `${s.name}, clamps locked at ${this.name(p)}. ${s.crates} crates of liberty for you.` : `${s.name} has docked at ${this.name(p)} with ${s.crates} crates.`);
    // Democracy Officers check freighters at bays near a Security Office.
    const every = this.div.security.order.checks === 'every';
    const post = this.staff.officer ? this.list((d, x) => this.has(x, 'secoffice')).find((o) => { const r = this.route(o.id, (x) => x.id === p.id); return r && this.walkDist(o.id, r) <= C.securityReach; }) : null;
    if (post && every) s.inspect = C.walk.inspectSec;
    if (s.smuggler) {
      const caught = post && (every || this.rng.chance(0.5));
      if (caught) {
        this.stats.caught++; this._money(C.econ.fine, 'trade');
        this.say('security', `Unapproved goods seized from ${s.name}. A ${C.econ.fine} CR fine has been collected. Democracy is safe.`, { gold: true });
        const off = this.agents.find((a) => a.role === 'officer' && !a.task);
        if (off) this._go(off, (x) => x.id === p.id, 'inspect');
      } else {
        this.stats.contraband++; this.unrest += C.morale.contraband;
        this.say('security', `Unapproved goods from ${s.name} have reached the residents. ${post ? 'Our spot check missed it.' : 'No officers were near that bay.'}`, { warn: true });
      }
    }
  }
  _depart(s, lost) {
    if (!lost) { this.stats.ships++; if (s.dockedAt != null) { this.berthTimes.push(this.t - s.dockedAt); if (this.berthTimes.length > 20) this.berthTimes.shift(); } }
    else if (s.state === 'docked' && s.crates > 0) this.stats.lost++;
    s.lastDock = s.dock || s.lastDock; s.state = 'depart'; s.t = 0; s.dock = 0; s.crates = 0; s.reserved = 0;
    for (const a of this.agents) if ((a.task === 'pick' || a.task === 'drydock') && a.ship === s.id) { a.task = null; a.path = []; a.s = 0; a.eva = false; }
  }

  // ---------------------------------------------------------------- division reports, in their own voices
  report(k) {
    const st = this.staff, open = [...this.parts.values()].filter((p) => p.fault);
    switch (k) {
      case 'supply': { const b = this.busy('hauler'); return `Haulers on shift: ${st.hauler} of ${this.homes.hauler} places, ${b.busy} carrying right now. Crates this minute: ${this.cratesPerMin().toFixed(0)}. Ships waiting: ${this.ships.filter((s) => s.state === 'hold').length}. ${this.cargoIds.size ? 'Every crate accounted for, Commander.' : 'We have nowhere to put cargo. Build a Cargo Store.'}`; }
      case 'maintenance': return `Engineers on staff: ${st.engineer} of ${this.homes.engineer} places. Open faults: ${open.length}${open.length ? ` (${open.slice(0, 3).map((p) => this.name(p)).join(', ')})` : ''}. Faults fixed: ${this.stats.fixed || 0}. ${st.engineer ? 'Suits charged and ready.' : 'Give us a Workshop and a budget and we\'ll keep her flying.'}`;
      case 'security': return `Officers on duty: ${st.officer} of ${this.homes.officer} places. Smugglers caught: ${this.stats.caught}, slipped through: ${this.stats.contraband}. ${this.homes.officer ? 'Bays near a Security Office are watched.' : 'Without a Security Office, every bay is unwatched.'}`;
      case 'medical': return `Medics: ${st.medic} of ${this.homes.medic} places. ${st.medic ? (this.div.medical.order.care === 'free' ? 'Free care for every citizen: morale is up.' : 'Fees are being collected at the door.') : 'No Medbay, no medics. Citizens are treating themselves.'}`;
      case 'traffic': { const bf = this.berths('freighter').length; return `Berths: ${bf} for freighters, ${this.berths('shuttle').length} for shuttles, ${this.berths('warship').length} drydock. Ships served: ${this.stats.ships}, lost: ${this.stats.lost}. Average time at berth: ${this.avgBerth() == null ? 'no data yet' : this.avgBerth().toFixed(0) + ' s'}.`; }
      case 'truth': return this.div.truth.order.broadcast === 'silence' ? 'The Ministry is silent, by your order. Citizens are left alone with their thoughts.' : `Broadcasting ${this.div.truth.order.broadcast === 'patriotic' ? 'the Patriotic Hour' : 'the Recruitment Drive'} on every screen. Morale from broadcasts: +${this.broadcastBoost().toFixed(0)}. Truth Offices aboard: ${this.broadcast}.`;
    }
    return '';
  }
  ack(k, o, val) {
    const lines = {
      shift: { normal: 'Back to normal shifts, Commander.', double: 'Double shifts it is. The haulers won\'t thank you.' },
      plan: { reactive: 'Understood. We fix what breaks.', preventive: 'Preventive maintenance schedule in effect.' },
      checks: { spot: 'Spot checks only. Faster, and riskier.', every: 'Every ship will be inspected. No exceptions.' },
      care: { free: 'Free care for all citizens. Democracy heals.', fees: 'Fees in effect. Payment before treatment.' },
      mix: { all: 'Clearing all traffic to approach.', freight: 'Freighters only. Shuttles will be waved off.', colonists: 'Colonist shuttles only. Freighters will be waved off.' },
      rate: { low: 'Thinning the traffic.', normal: 'Normal traffic.', high: 'Opening the lanes. Expect a crowd.' },
      broadcast: { patriotic: 'The Patriotic Hour begins now.', recruitment: 'The Recruitment Drive is on every screen.', silence: 'Broadcasts suspended. This is highly irregular.' },
    };
    return (lines[o] && lines[o][val]) || 'Orders received.';
  }
}
