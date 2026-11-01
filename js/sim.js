// The station simulation. No DOM, no Math.random: it runs the same in the browser and headless in Node (test/headless.mjs).
// The world is a side-on cross-section: columns are frames along the hull, rows are decks (row 0 is the top deck).
// People walk along decks and only change deck in lift shafts. Ships fly in open space and berth at docking bays.
import { C } from './config.js';
import { RNG } from './rng.js';

export const COLS = C.hull.cols, ROWS = C.hull.rows.length;
const idx = (c, r) => r * COLS + c;
const colOf = (i) => i % COLS, rowOf = (i) => Math.floor(i / COLS);

const IDEALS = ['Honest Work', 'Steady Progress', 'Fair Weather', 'Good Neighbors', 'Quiet Resolve', 'Open Skies', 'Sturdy Ballots',
  'Shared Prosperity', 'Cheerful Compliance', 'Sensible Shoes', 'Unanimous Consent', 'Bright Mornings', 'Fair Play', 'Civic Duty',
  'Common Sense', 'Rightful Order', 'Patient Thunder', 'Reliable Freedom'];

const PROPAGANDA = [
  'Every crate unloaded is a bullet delivered. Thank you, citizen.',
  'A happy station is a compliant station.',
  'The Liberty Contribution keeps the lights on. Literally.',
  'Report unapproved goods to your nearest Democracy Officer.',
  'Remember: the hull is load-bearing. So is your loyalty.',
  'Today\'s canteen special: Freedom Loaf. Seconds are patriotic.',
  'Maintenance is a form of love. Fund your engineers.',
  'The war is going well. Please continue to work.',
];

export function inHull(c, r) {
  if (r < 0 || r >= ROWS) return false;
  const [a, b] = C.hull.rows[r];
  return c >= a && c <= b;
}

export class Station {
  constructor(seed = 1) {
    this.rng = new RNG(seed);
    this.t = 0;
    this.credits = C.start.credits;
    this.tax = C.start.tax;
    this.budget = { ...C.start.budget };
    this.grid = new Array(COLS * ROWS).fill(0);   // module id per cell, 0 = empty
    this.mods = new Map();
    this.nextId = 1;
    this.agents = [];
    this.ships = [];
    this.events = [];
    this.morale = C.morale.base; this.unrest = 0;
    this.eff = 1; this.supply = 0; this.demand = 0;
    this.permitAll = false;
    this.unlocked = new Set();
    this.done = {};
    this.stats = { crates: 0, ships: 0, lost: 0, caught: 0, contraband: 0, colonists: 0, left: 0 };
    this.totals = { trade: 0, tax: 0, fines: 0, wages: 0, upkeep: 0, build: 0 };
    this.buckets = Array.from({ length: 60 }, () => ({ s: -1, v: 0 }));
    this.timers = { freighter: 6, shuttle: 12, leave: C.morale.leaveSec, talk: 40 };
    this.staff = { logistics: 0, engineering: 0, security: 0 };
    this.cap = { logistics: 0, engineering: 0, security: 0 };
    const { col, row } = C.hull.command;
    this._add('command', col, row, true);
    this._layout();
  }

  // ---------------------------------------------------------------- hull and placement
  permitted(c, r) { return inHull(c, r) && (this.permitAll || (c >= C.hull.permit.c0 && c <= C.hull.permit.c1)); }
  modAt(c, r) { return (inHull(c, r) && this.mods.get(this.grid[idx(c, r)])) || null; }

  // Which side of a module faces open space (for docking bays), or null.
  exterior(m) {
    for (let i = 0; i < m.w; i++) {
      const c = m.col + i, r = m.row;
      if (!inHull(c, r - 1)) return { dir: 'up', c, r };
      if (!inHull(c, r + 1)) return { dir: 'down', c, r };
    }
    if (!inHull(m.col - 1, m.row)) return { dir: 'left', c: m.col, r: m.row };
    if (!inHull(m.col + m.w, m.row)) return { dir: 'right', c: m.col + m.w - 1, r: m.row };
    return null;
  }

  canPlace(type, c, r) {
    const d = C.mods[type];
    if (!d || d.fixed) return { ok: false, why: 'Not buildable' };
    if (d.locked && !this.unlocked.has(d.locked)) return { ok: false, why: 'Needs the Garrison Permit' };
    for (let i = 0; i < d.w; i++) {
      if (!inHull(c + i, r)) return { ok: false, why: 'Outside the hull' };
      if (!this.permitted(c + i, r)) return { ok: false, why: 'Outside the permitted section' };
      if (this.grid[idx(c + i, r)]) return { ok: false, why: 'Already built here' };
    }
    if (d.exterior && !this.exterior({ col: c, row: r, w: d.w })) return { ok: false, why: 'A docking bay must touch open space' };
    if (this.credits < d.cost) return { ok: false, why: 'Not enough credits' };
    return { ok: true, why: '' };
  }

  build(type, c, r) {
    const chk = this.canPlace(type, c, r);
    if (!chk.ok) return chk;
    const d = C.mods[type];
    this._money(-d.cost, 'build');
    const m = this._add(type, c, r, false);
    this.events.push({ type: 'build', mod: m });
    this._layout();
    return chk;
  }

  demolish(c, r) {
    const m = this.modAt(c, r);
    if (!m || m.fixed || m.state === 'demolish') return false;
    if (m.state === 'building') { this._money(C.mods[m.type].cost, 'build'); this._remove(m); return true; }   // cancelled: full refund
    m.state = 'demolish'; m.prog = 0;
    this.events.push({ type: 'demolish', mod: m });
    return true;
  }

  _add(type, c, r, fixed) {
    const d = C.mods[type];
    const n = [...this.mods.values()].filter((m) => m.type === type).length + 1;
    const m = { id: this.nextId++, type, col: c, row: r, w: d.w, fixed, n, state: fixed ? 'active' : 'building', prog: fixed ? 1 : 0,
      fault: false, fixer: 0, connected: false, ship: 0, reach: {} };
    this.mods.set(m.id, m);
    for (let i = 0; i < d.w; i++) this.grid[idx(c + i, r)] = m.id;
    return m;
  }

  _remove(m) {
    for (let i = 0; i < m.w; i++) this.grid[idx(m.col + i, m.row)] = 0;
    this.mods.delete(m.id);
    for (const s of this.ships) if (s.dock === m.id) { s.dock = 0; this._depart(s, true); }
    this._layout();
    // Anyone standing in it is moved to Command; any walk through it is recomputed.
    const cmd = this.command();
    for (const a of this.agents) {
      if (!this._walkable(a.cell)) { a.cell = idx(cmd.col, cmd.row); a.x = cmd.col + 0.5; a.y = cmd.row; }
      a.path = []; a.wait = Math.min(a.wait, 0.2);
    }
  }

  command() { for (const m of this.mods.values()) if (m.type === 'command') return m; return null; }
  name(m) { return m.type === 'command' ? 'Station Command' : `${C.mods[m.type].name} ${m.n}`; }
  works(m) { return !!m && m.state !== 'building' && m.connected && !m.fault; }
  count(type, test = (m) => this.works(m)) { let n = 0; for (const m of this.mods.values()) if (m.type === type && test(m)) n++; return n; }

  // ---------------------------------------------------------------- walking
  _walkable(i) { const m = this.mods.get(this.grid[i]); return !!m && m.state !== 'building'; }
  _isLift(i) { const m = this.mods.get(this.grid[i]); return !!m && m.type === 'lift' && m.state !== 'building'; }
  _nbrs(i, out) {
    out.length = 0;
    const c = colOf(i), r = rowOf(i);
    if (c > 0 && this._walkable(i - 1)) out.push(i - 1);
    if (c < COLS - 1 && this._walkable(i + 1)) out.push(i + 1);
    if (this._isLift(i)) {
      if (r > 0 && this._isLift(i - COLS)) out.push(i - COLS);
      if (r < ROWS - 1 && this._isLift(i + COLS)) out.push(i + COLS);
    }
    return out;
  }
  // Breadth-first distances (in cells) from a set of start cells.
  _dist(starts) {
    const d = new Int16Array(COLS * ROWS).fill(-1), q = [], nb = [];
    for (const s of starts) if (this._walkable(s)) { d[s] = 0; q.push(s); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      for (const j of this._nbrs(i, nb)) if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); }
    }
    return d;
  }
  // The shortest walk from a cell to the nearest cell that passes `goal`, as a list of cells (start excluded), or null.
  route(from, goal) {
    if (!this._walkable(from)) return null;
    if (goal(from)) return [];
    const prev = new Int32Array(COLS * ROWS).fill(-2), q = [from], nb = [];
    prev[from] = -1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      for (const j of this._nbrs(i, nb)) {
        if (prev[j] !== -2) continue;
        prev[j] = i;
        if (goal(j)) { const p = [j]; let k = i; while (k !== from) { p.push(k); k = prev[k]; } return p.reverse(); }
        q.push(j);
      }
    }
    return null;
  }
  cellsOf(m) { const out = []; for (let i = 0; i < m.w; i++) out.push(idx(m.col + i, m.row)); return out; }
  inMod(goalFn) { return (i) => { const m = this.mods.get(this.grid[i]); return !!m && goalFn(m); }; }

  // Recompute everything that depends on the layout: who is connected to Command, reach, power, staff places.
  _layout() {
    const cmd = this.command();
    const d = this._dist(this.cellsOf(cmd));
    for (const m of this.mods.values()) m.connected = m.state !== 'building' && this.cellsOf(m).some((i) => d[i] >= 0);
    // Reach: which bays each security post covers, and whether each quarters has a canteen close enough.
    for (const m of this.mods.values()) {
      if (m.type === 'security' || m.type === 'quarters') {
        const dm = this._dist(this.cellsOf(m));
        m.reach = { d: dm };
      }
    }
    this._power();
    this._caps();
  }
  _power() {
    let sup = 0, dem = 0;
    for (const m of this.mods.values()) {
      if (m.state === 'building') continue;
      const p = C.mods[m.type].pw;
      if (p < 0) { if (!m.fault) sup -= p; } else if (m.connected) dem += p;
    }
    this.supply = sup; this.demand = dem;
    this.eff = dem <= 0 ? 1 : Math.min(1, sup / dem);
  }
  _caps() {
    this.cap.logistics = 3 + 2 * this.count('cargo');
    this.cap.engineering = 3 * this.count('engineering');
    this.cap.security = 3 * this.count('security');
    for (const k of Object.keys(this.cap)) this.staff[k] = Math.min(this.cap[k], Math.floor(this.budget[k] / C.div[k].wage));
  }
  setBudget(k, v) { this.budget[k] = Math.max(0, Math.min(C.budgetMax, Math.round(v))); this._caps(); }
  setTax(v) { this.tax = Math.max(0, Math.min(30, Math.round(v))); }

  // ---------------------------------------------------------------- money
  _money(v, cat) {
    this.credits += v;
    this.totals[cat] = (this.totals[cat] || 0) + v;
    if (cat === 'build') return;           // the per-minute figure is the running profit: building is shown by the credits
    const s = Math.floor(this.t), b = this.buckets[s % 60];
    if (b.s !== s) { b.s = s; b.v = 0; }
    b.v += v;
  }
  netPerMin() { const s = Math.floor(this.t); let v = 0; for (const b of this.buckets) if (b.s > s - 60 && b.s <= s) v += b.v; return v * 60 / Math.min(60, Math.max(1, this.t)); }
  beds() { let n = 0; for (const m of this.mods.values()) if (m.type === 'quarters' && m.state !== 'building' && m.connected) n += C.mods.quarters.beds; return n; }
  residents() { let n = 0; for (const a of this.agents) if (a.role === 'resident') n++; return n; }
  upkeep() { let v = 0; for (const m of this.mods.values()) if (m.state !== 'building') v += C.mods[m.type].up; return v; }
  wages() { let v = 0; for (const k of Object.keys(this.staff)) v += this.staff[k] * C.div[k].wage; return v; }
  taxPerMin() { return this.residents() * this.tax * C.econ.taxPerPct; }

  // ---------------------------------------------------------------- the step
  step(dt) {
    this.t += dt;
    let relayout = false;
    for (const m of [...this.mods.values()]) {
      if (m.state === 'building') {
        m.prog += dt / Math.max(0.1, C.mods[m.type].build);
        if (m.prog >= 1) { m.state = 'active'; m.prog = 1; relayout = true; this.events.push({ type: 'built', mod: m }); }
      } else if (m.state === 'demolish') {
        m.prog += dt / C.demolish.sec;
        if (m.prog >= 1) { this._money(Math.round(C.mods[m.type].cost * C.demolish.refund), 'build'); this._remove(m); }
      } else if (!m.fixed && !m.fault && m.type !== 'corridor' && m.type !== 'engineering' && this.rng.chance(dt / C.faults.meanSec)) {
        m.fault = true; relayout = true;
        this.events.push({ type: 'fault', mod: m, text: this.staff.engineering
          ? `FAULT: ${this.name(m)}. The Department of Patriotic Maintenance is on its way.`
          : `FAULT: ${this.name(m)}. No engineers are funded to fix it.` });
      }
    }
    if (relayout) this._layout();
    this._syncStaff();
    this._ships(dt);
    this._residents(dt);
    for (const a of [...this.agents]) this._agent(a, dt);
    this._economy(dt);
    this._moraleStep(dt);
    this._milestones();
    if ((this.timers.talk -= dt) <= 0) { this.timers.talk = 55 + this.rng.range(0, 30); this.events.push({ type: 'talk', text: this.rng.pick(PROPAGANDA) }); }
  }

  _economy(dt) {
    const k = dt / 60;
    if (this.residents()) this._money(this.taxPerMin() * k, 'tax');
    const w = this.wages(); if (w) this._money(-w * k, 'wages');
    const u = this.upkeep(); if (u) this._money(-u * k, 'upkeep');
  }

  moraleParts() {
    const M = C.morale, res = this.agents.filter((a) => a.role === 'resident');
    const tax = this.tax > M.taxFree ? -(this.tax - M.taxFree) * M.taxPenalty : (M.taxFree - this.tax) * M.taxBonus;
    let fed = 0;
    if (res.length) {
      const canteens = [...this.mods.values()].filter((m) => m.type === 'canteen' && this.works(m));
      for (const a of res) {
        const q = this.mods.get(a.home);
        if (q && q.reach.d && canteens.some((c) => this.cellsOf(c).some((i) => q.reach.d[i] >= 0 && q.reach.d[i] <= M.canteenReach))) fed++;
      }
    }
    const canteen = res.length ? M.canteen * fed / res.length : 0;
    const faulty = -M.faultyQuarters * this.count('quarters', (m) => m.fault);
    const power = -M.power * (1 - this.eff);
    const unpaid = this.credits < 0 ? -15 : 0;
    return { base: M.base, tax, canteen, unrest: -this.unrest, faulty, power, unpaid };
  }
  _moraleStep(dt) {
    const p = this.moraleParts();
    const target = Math.max(0, Math.min(100, Object.values(p).reduce((s, v) => s + v, 0)));
    const rate = 1.5 * dt;
    this.morale += Math.max(-rate, Math.min(rate, target - this.morale));
    this.unrest = Math.max(0, this.unrest - dt * C.morale.contraband / C.morale.unrestDecaySec);
  }

  milestone() {
    const M = C.milestones[0];
    const items = [
      { label: 'Residents', have: this.residents(), need: M.residents },
      { label: 'Crates traded', have: this.stats.crates, need: M.crates },
      ...M.needs.map((t) => ({ label: `${C.mods[t].name} running`, have: this.count(t), need: 1 })),
    ];
    for (const it of items) it.ok = it.have >= it.need;
    return { ...M, items, done: !!this.done[M.id] };
  }
  _milestones() {
    const m = this.milestone();
    if (m.done || !m.items.every((i) => i.ok)) return;
    this.done[m.id] = true; this.unlocked.add(m.id); this.permitAll = true;
    this.events.push({ type: 'milestone', text: `${m.name} GRANTED. The Ministry approves the whole hull. Unlocked: Canteen, Security Post.` });
    this._layout();
  }

  // ---------------------------------------------------------------- staff and residents
  _syncStaff() {
    for (const role of Object.keys(this.staff)) {
      const want = this.staff[role], have = this.agents.filter((a) => a.role === role);
      const homes = [...this.mods.values()].filter((m) => m.type === C.div[role].home && this.works(m));
      if (have.length > want) {
        const drop = have.sort((a, b) => (a.task ? 1 : 0) - (b.task ? 1 : 0)).slice(0, have.length - want);
        for (const a of drop) this._despawn(a);
      } else if (have.length < want && homes.length) {
        for (let i = have.length; i < want; i++) {
          const h = homes[i % homes.length];
          this._spawn(role, h, idx(h.col + (i % h.w), h.row));
        }
      }
      // Staff whose home is gone move to another one, or are let go.
      for (const a of [...this.agents]) if (a.role === role && !this.mods.get(a.home)) { const h = homes[0]; if (h) a.home = h.id; else this._despawn(a); }
    }
  }
  _spawn(role, home, cell) {
    const a = { id: this.nextId++, role, home: home.id, cell, x: colOf(cell) + 0.5, y: rowOf(cell), path: [], wait: this.rng.range(0, 1.5),
      task: null, carry: false, ship: 0, jx: this.rng.range(-0.3, 0.3), leaving: false };
    this.agents.push(a);
    return a;
  }
  _despawn(a) {
    if (a.task === 'fix') { const m = this.mods.get(a.target); if (m && m.fixer === a.id) m.fixer = 0; }
    if (a.task === 'pick') { const s = this.ships.find((x) => x.id === a.ship); if (s) s.reserved = Math.max(0, s.reserved - 1); }
    this.agents.splice(this.agents.indexOf(a), 1);
  }

  _residents(dt) {
    // Homeless residents (their quarters went) look for a free bed, or leave.
    const quarters = [...this.mods.values()].filter((m) => m.type === 'quarters' && m.state !== 'building' && m.connected);
    const load = new Map(quarters.map((q) => [q.id, 0]));
    for (const a of this.agents) if (a.role === 'resident' && load.has(a.home)) load.set(a.home, load.get(a.home) + 1);
    for (const a of this.agents) {
      if (a.role !== 'resident' || load.has(a.home) || a.leaving) continue;
      const q = quarters.find((x) => load.get(x.id) < C.mods.quarters.beds);
      if (q) { a.home = q.id; load.set(q.id, load.get(q.id) + 1); a.path = []; } else this._leave(a);
    }
    if (this.morale < C.morale.leaveBelow && this.residents() > 0) {
      if ((this.timers.leave -= dt) <= 0) {
        this.timers.leave = C.morale.leaveSec;
        const a = this.agents.find((x) => x.role === 'resident' && !x.leaving);
        if (a) { this._leave(a); this.events.push({ type: 'left', text: 'A citizen has emigrated. This has been noted.' }); }
      }
    } else this.timers.leave = C.morale.leaveSec;
  }
  _leave(a) { a.leaving = true; a.path = []; a.wait = 0; a.task = 'leave'; }
  freeBeds() {
    const quarters = [...this.mods.values()].filter((m) => m.type === 'quarters' && m.state !== 'building' && m.connected);
    const out = [];
    for (const q of quarters) {
      const n = this.agents.filter((a) => a.role === 'resident' && a.home === q.id && !a.leaving).length;
      for (let i = n; i < C.mods.quarters.beds; i++) out.push(q);
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
    const unpaid = a.role !== 'resident' && this.credits < 0 ? 0.6 : 1;
    let budget = dt * (0.55 + 0.45 * this.eff) * unpaid;
    while (budget > 0 && a.path.length) {
      const n = a.path[0], tx = colOf(n) + 0.5 + a.jx * 0.6, ty = rowOf(n);
      const vert = rowOf(n) !== rowOf(a.cell);
      const sp = vert ? C.walk.lift : C.walk.speed;
      const dx = tx - a.x, dy = ty - a.y, dist = Math.hypot(dx, dy), stepLen = sp * budget;
      if (dist <= stepLen) { a.x = tx; a.y = ty; a.cell = n; a.path.shift(); budget -= dist / sp; }
      else { a.x += dx / dist * stepLen; a.y += dy / dist * stepLen; budget = 0; }
    }
    if (!a.path.length) this._arrive(a);
  }
  _go(a, goal, task) {
    const p = this.route(a.cell, goal);
    if (!p) return false;
    a.path = p; a.task = task;
    if (!p.length) this._arrive(a);
    return true;
  }
  _home(a) {
    const h = this.mods.get(a.home);
    if (!h) return;
    if (this.grid[a.cell] === h.id) { a.task = null; a.wait = this.rng.range(1.5, 4); return; }
    if (!this._go(a, this.inMod((m) => m.id === h.id), 'home')) { a.task = null; a.wait = 2; }
  }

  _think(a) {
    if (a.role === 'logistics') return this._thinkHauler(a);
    if (a.role === 'engineering') return this._thinkEngineer(a);
    if (a.role === 'security') { if (a.task !== 'home') this._home(a); else { a.task = null; a.wait = this.rng.range(2, 5); } return; }
    return this._thinkResident(a);
  }

  _thinkHauler(a) {
    const cargoGoal = this.inMod((m) => m.type === 'cargo' && this.works(m));
    if (a.carry) { if (!this._go(a, cargoGoal, 'drop')) { a.task = null; a.wait = 1; } return; }
    const hasCargo = this.count('cargo') > 0;
    const open = hasCargo ? this.ships.filter((s) => s.state === 'docked' && s.kind === 'freighter' && s.crates - s.reserved > 0 && this.works(this.mods.get(s.dock))) : [];
    if (open.length) {
      const docks = new Set(open.map((s) => s.dock));
      const p = this.route(a.cell, this.inMod((m) => docks.has(m.id)));
      if (p) {
        const end = p.length ? p[p.length - 1] : a.cell;
        const s = open.find((x) => x.dock === this.grid[end]);
        s.reserved++; a.ship = s.id; a.path = p; a.task = 'pick';
        if (!p.length) this._arrive(a);
        return;
      }
    }
    if (a.task === 'home') { a.task = null; a.wait = this.rng.range(1, 2.5); return; }
    this._home(a);
  }

  _thinkEngineer(a) {
    const broken = [...this.mods.values()].filter((m) => m.fault && !m.fixer && m.state !== 'demolish');
    if (broken.length) {
      const ids = new Set(broken.map((m) => m.id));
      const p = this.route(a.cell, this.inMod((m) => ids.has(m.id)));
      if (p) {
        const end = p.length ? p[p.length - 1] : a.cell, m = this.mods.get(this.grid[end]);
        m.fixer = a.id; a.target = m.id; a.path = p; a.task = 'fix';
        if (!p.length) this._arrive(a);
        return;
      }
    }
    if (a.task === 'home') { a.task = null; a.wait = this.rng.range(1, 3); return; }
    this._home(a);
  }

  _thinkResident(a) {
    if (a.leaving) {
      if (a.task === 'gone') return;
      if (!this._go(a, this.inMod((m) => m.type === 'dock' && this.works(m)), 'leave')) this._removeAgent(a);
      return;
    }
    const r = this.rng.next();
    if (a.task === 'out') { this._home(a); return; }
    if (r < 0.5 && this.count('canteen') && this._go(a, this.inMod((m) => m.type === 'canteen' && this.works(m)), 'out')) return;
    if (r < 0.75 && this._go(a, this.inMod((m) => m.type === 'command'), 'out')) return;
    this._home(a);
  }
  _removeAgent(a) { const i = this.agents.indexOf(a); if (i >= 0) this.agents.splice(i, 1); }

  _arrive(a) {
    const C2 = C.walk;
    if (a.task === 'pick') { a.wait = C2.pickSec; a.pending = 'pick'; return; }
    if (a.task === 'drop') { a.wait = C2.dropSec; a.pending = 'drop'; return; }
    if (a.task === 'fix') { a.wait = C2.repairSec / (0.5 + 0.5 * this.eff); a.pending = 'fix'; return; }
    if (a.task === 'inspect') { a.wait = 3; a.pending = 'inspect'; return; }
    if (a.task === 'leave') { this.stats.left++; this._removeAgent(a); return; }
    if (a.task === 'out') { a.wait = this.rng.range(6, 14); return; }
    if (a.task === 'home') { a.wait = a.role === 'resident' ? this.rng.range(8, 20) : this.rng.range(1, 3); return; }
  }
  _done(a, what) {
    if (what === 'pick') {
      const s = this.ships.find((x) => x.id === a.ship);
      a.task = null;
      if (s && s.state === 'docked' && s.crates > 0) { s.crates--; s.reserved = Math.max(0, s.reserved - 1); a.carry = true; }
      else if (s) s.reserved = Math.max(0, s.reserved - 1);
      return;
    }
    if (what === 'drop') {
      a.carry = false; a.task = null;
      this._money(C.econ.crateFee, 'trade'); this.stats.crates++;
      this.events.push({ type: 'crate', x: a.x, y: a.y });
      return;
    }
    if (what === 'fix') {
      const m = this.mods.get(a.target);
      a.task = null;
      if (m && m.fixer === a.id) { m.fault = false; m.fixer = 0; this._layout(); this.events.push({ type: 'fixed', mod: m, text: `${this.name(m)} repaired. Maintenance is a form of love.` }); }
      return;
    }
    if (what === 'inspect') { a.task = null; this._home(a); }
  }

  // ---------------------------------------------------------------- ships
  _ships(dt) {
    const S = C.ships, docks = this.count('dock');
    if (docks > 0) {
      if ((this.timers.freighter -= dt) <= 0) {
        this.timers.freighter = S.freighterSec / (1 + 0.5 * (docks - 1)) * this.rng.range(0.75, 1.25);
        this._arrival('freighter');
      }
      const vac = this.freeBeds().length;
      if (vac > 0 && this.morale >= S.shuttleMorale && !this.ships.some((s) => s.kind === 'shuttle' && s.state !== 'outbound')) {
        if ((this.timers.shuttle -= dt) <= 0) { this.timers.shuttle = S.shuttleSec * this.rng.range(0.8, 1.2); this._arrival('shuttle'); }
      }
    }
    // Waiting ships take a free working bay, oldest first.
    const free = [...this.mods.values()].filter((m) => m.type === 'dock' && this.works(m) && !this.ships.some((s) => s.dock === m.id));
    for (const s of this.ships.filter((x) => x.state === 'hold').sort((p, q) => p.born - q.born)) {
      if (!free.length) break;
      const m = free.shift();
      s.dock = m.id; s.state = 'inbound';
      const b = this.berth(m); s.tx = b.x; s.ty = b.y; s.face = b.face;
    }
    let qi = 0;
    for (const s of [...this.ships]) {
      if (s.state === 'hold') {
        s.wait += dt;
        const hp = this._holdPoint(s, qi++); s.tx = hp.x; s.ty = hp.y;
        if (s.wait > S.waitSec) { this.stats.lost++; this.events.push({ type: 'lost', text: `${s.name} gave up waiting for a berth. Trade lost.` }); this._depart(s, true); }
      }
      if (s.state === 'docked') {
        const m = this.mods.get(s.dock);
        if (!m) { this._depart(s, true); continue; }
        if (s.kind === 'shuttle') { if ((s.wait -= dt) <= 0) this._depart(s, false); }
        else if (s.crates <= 0 && s.reserved <= 0) this._depart(s, false);
      }
      this._fly(s, dt);
    }
  }
  _arrival(kind) {
    const S = C.ships;
    if (this.ships.filter((s) => s.state === 'hold').length >= S.queueMax) {
      this.stats.lost++;
      this.events.push({ type: 'lost', text: 'A freighter was turned away: every berth and holding slot is full.' });
      return;
    }
    const side = this.rng.chance(0.5) ? -1 : 1;
    const s = { id: this.nextId++, kind, name: `${kind === 'shuttle' ? 'Shuttle' : 'Freighter'} ${this.rng.pick(IDEALS)}`,
      smuggler: kind === 'freighter' && this.rng.chance(S.smugglerChance), side, born: this.t,
      x: side < 0 ? -8 : COLS + 8, y: this.rng.range(-1, ROWS + 1), tx: 0, ty: 0, face: side < 0 ? 0 : Math.PI, ang: side < 0 ? 0 : Math.PI,
      state: 'hold', dock: 0, crates: 0, reserved: 0, wait: 0 };
    this.ships.push(s);
  }
  _holdPoint(s, qi) { return { x: s.side < 0 ? 0.6 : COLS - 0.6, y: 0.2 + qi * 1.9 + (s.side < 0 ? 0 : 0.9) }; }
  // Where a ship sits when berthed at a bay, and which way it points.
  berth(m) {
    const e = this.exterior(m), cx = m.col + m.w / 2;
    if (!e) return { x: cx, y: m.row - 1, face: Math.PI / 2 };
    if (e.dir === 'up') return { x: cx, y: m.row - 0.8, face: Math.PI / 2 };
    if (e.dir === 'down') return { x: cx, y: m.row + 1.8, face: -Math.PI / 2 };
    if (e.dir === 'left') return { x: m.col - 1.2, y: m.row + 0.5, face: 0 };
    return { x: m.col + m.w + 1.2, y: m.row + 0.5, face: Math.PI };
  }
  _fly(s, dt) {
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), v = C.ships.speed * dt * (s.state === 'inbound' ? Math.min(1, 0.35 + d / 3) : 1);
    if (d > 0.02) {
      const k = Math.min(1, v / d); s.x += dx * k; s.y += dy * k;
      const want = s.state === 'inbound' && d < 1.2 ? s.face : Math.atan2(dy, dx);
      let da = want - s.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      s.ang += da * Math.min(1, dt * 5);
    } else if (s.state === 'inbound') this._docked(s);
    if (s.state === 'outbound' && d <= 0.5) this.ships.splice(this.ships.indexOf(s), 1);
  }
  _docked(s) {
    const m = this.mods.get(s.dock);
    if (!m) { this._depart(s, true); return; }
    s.state = 'docked'; s.x = s.tx; s.y = s.ty; s.ang = s.face;
    this._money(C.econ.dockFee, 'trade');
    if (s.kind === 'shuttle') {
      const beds = this.freeBeds(), n = Math.min(C.ships.colonists, beds.length);
      const cell = idx(m.col, m.row);
      for (let i = 0; i < n; i++) { const a = this._spawn('resident', beds[i], cell); a.wait = i * 0.6; a.task = 'out'; }
      this.stats.colonists += n;
      s.wait = 3;
      this.events.push({ type: 'dock', ship: s, mod: m, text: n ? `${s.name} docked at ${this.name(m)}: ${n} colonists. Welcome, citizens! Report for gratitude.` : `${s.name} docked at ${this.name(m)}.` });
      return;
    }
    s.crates = C.ships.crates;
    this.events.push({ type: 'dock', ship: s, mod: m, text: `${s.name} docked at ${this.name(m)}. Commerce is patriotism.` });
    if (s.smuggler) {
      const post = [...this.mods.values()].find((p) => p.type === 'security' && this.works(p) && p.reach.d &&
        this.agents.some((a) => a.role === 'security') && this.cellsOf(m).some((i) => p.reach.d[i] >= 0 && p.reach.d[i] <= C.securityReach));
      if (post) {
        this.stats.caught++; this._money(C.econ.fine, 'fines');
        this.events.push({ type: 'caught', mod: m, text: `Democracy Officers seized unapproved goods from ${s.name}. +${C.econ.fine} CR fine.` });
        const off = this.agents.find((a) => a.role === 'security' && a.home === post.id && !a.task) || this.agents.find((a) => a.role === 'security' && !a.task);
        if (off) this._go(off, this.inMod((x) => x.id === m.id), 'inspect');
      } else {
        this.stats.contraband++; this.unrest += C.morale.contraband;
        this.events.push({ type: 'contraband', mod: m, text: `Unapproved goods from ${s.name} have reached the lower decks. Questions are being asked.` });
      }
    }
  }
  _depart(s, lost) {
    if (lost && s.state === 'docked' && s.crates > 0) this.stats.lost++;
    if (s.state === 'docked' || s.state === 'inbound') this.stats.ships += lost ? 0 : 1;
    s.state = 'outbound'; s.dock = 0; s.crates = 0; s.reserved = 0;
    s.tx = s.side < 0 ? -10 : COLS + 10; s.ty = s.y + (s.y < ROWS / 2 ? -3 : 3);
    for (const a of this.agents) if (a.task === 'pick' && a.ship === s.id) { a.task = null; a.path = []; }
  }
}
