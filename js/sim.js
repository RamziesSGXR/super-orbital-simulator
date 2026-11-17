// The station simulation. No DOM and no 3D library: it runs the same in the browser and headless in Node (test/headless.mjs).
// The station is a tree of parts joined at ports, and each part holds rooms. People walk along the tree, part to part, through
// the joins; the distance between two parts is the real distance through the join, so where you put things matters.
// What a part does comes from its rooms (quarters, cargo stores, workshops...) plus a few things the part itself does (power,
// berths, defence). Divisions are funded from the Commander's panel: the budget buys staff, up to the places their rooms have.
import { C } from './config.js';
import { RNG } from './rng.js';
import { v, q } from './math3.js';
import { installPlatform } from './platform.js';
import { installStory } from './story.js';
import { installLedger } from './ledger.js';
import { installMarket } from './market.js';
import { solidOf, inSolid } from './solid.js';

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
export const STAFF = { hauler: 'supply', engineer: 'maintenance', officer: 'security', medic: 'medical', aide: 'command', scientist: 'science', gunner: 'gunnery' };
export const FACTIONS = ['supply', 'maintenance', 'security', 'medical', 'command', 'science', 'gunnery'];
// The room each faction calls its own, for telling whose space a room is.
export const ROOM_OF = { cargostore: 'supply', workshop: 'maintenance', secoffice: 'security', medbay: 'medical', brass: 'command', lab: 'science', guncrew: 'gunnery' };
const COMPLAIN = {
  supply: ['Commander, my haulers are walking half the station with every crate. {why}', 'Supply is not happy. {why}'],
  maintenance: ['Commander, Maintenance is stretched thin. {why}', 'The engineers are grumbling. {why}'],
  security: ['Commander, the Officers feel exposed. {why}', 'Security is not happy. {why}'],
  medical: ['Commander, Medical cannot reach the people it should. {why}', 'The medics are not happy. {why}'],
  command: ['Commander, the staff are embarrassed to receive visitors. {why}', 'Command is not happy. {why}'],
  science: ['Commander, the Directorate cannot do its work like this. {why}', 'The scientists are muttering. {why}'],
  gunnery: ['Commander, the platform is not ready and the troops below can tell. {why}', 'Gunnery is not happy. {why}'],
};
const PRAISE = {
  supply: 'Supply wanted you to know: the cargo flows, and the haulers noticed.',
  maintenance: 'Maintenance reports: good layout, short walks, hands happy. Wrenches up.',
  security: 'Security reports: every bay watched. The Officers are in good spirits.',
  medical: 'Medical reports: the Medbay is where it should be. Spirits are high.',
  command: 'Command notes: the station is a credit to the Ministry. The brass were impressed.',
  science: 'Science reports: clean readings, short walks to the instruments. The Directorate is pleased.',
  gunnery: 'Gunnery reports: every call answered. The squads below send their thanks, in their way.',
};
export const STRUCTURAL = new Set(['command', 'core', 'longcore', 'junction', 'truss', 'node', 'tube']);

// How many of S's deep cells lie inside T's solid (each placed at pos/quat). Cells within C.clash.joinR of `join` do not count.
function clashCells(S, sp, sq, T, tp, tq, join) {
  const R = qmat(q.mul(q.conj(tq), sq)), t = q.rot(q.conj(tq), v.sub(sp, tp)), jl = join ? q.rot(q.conj(sq), v.sub(join, sp)) : null, jr2 = C.clash.joinR ** 2, d = S.deep, max = C.clash.cells;
  let n = 0;
  for (let i = 0; i < d.length && n <= max; i += 3) {
    const x = d[i], y = d[i + 1], z = d[i + 2];
    if (jl && (x - jl[0]) ** 2 + (y - jl[1]) ** 2 + (z - jl[2]) ** 2 < jr2) continue;
    if (inSolid(T, R[0] * x + R[1] * y + R[2] * z + t[0], R[3] * x + R[4] * y + R[5] * z + t[1], R[6] * x + R[7] * y + R[8] * z + t[2])) n++;
  }
  return n;
}
function qmat([x, y, z, w]) {
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}

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
      this.div[k] = { allot: this.sandbox && d.staff ? C.allotMax : d.allot ?? 0, order };    // free play starts fully staffed
    }
    this.parts = new Map();
    this.nextId = 1;
    this.agents = []; this.ships = []; this.events = [];
    this.morale = C.morale.base; this.unrest = 0; this.eff = 1; this.supply = 0; this.demand = 0;
    this.stats = { crates: 0, ships: 0, lost: 0, colonists: 0, left: 0, caught: 0, contraband: 0, repairs: 0, faults: 0, research: 0, raidsWon: 0, raidsLost: 0, auto: 0 };
    this.totals = { trade: 0, tax: 0, income: 0, upkeep: 0, wages: 0, build: 0 };
    this.buckets = Array.from({ length: 60 }, () => ({ s: -1, v: 0 }));
    this.timers = { freighter: 6, shuttle: 12, warship: 40, leave: C.morale.leaveSec, talk: 50 };
    this.traffic = true;
    this.crateTimes = []; this.berthTimes = [];
    this.staff = {}; this.homes = {};
    for (const role of Object.keys(STAFF)) { this.staff[role] = 0; this.homes[role] = 0; }
    // Factions: how happy each is (0 to 100), what it thinks is wrong, goodwill from your decisions, and what it has asked for.
    this.sat = {}; this.why = {}; this.favor = {}; this.cool = {}; this.praised = {};
    for (const k of FACTIONS) { this.sat[k] = C.faction.start; this.why[k] = ''; this.favor[k] = 0; this.cool[k] = 30; this.praised[k] = -300; }
    this.requests = []; this.reqLog = [];
    this.timers.fac = 0; this.timers.request = this.rng.range(C.faction.requestSec[0], C.faction.requestSec[1]);
    const cmd = this._make('command', 0, -1, 0, [0, 0, 0], q.id());
    cmd.state = 'active'; cmd.prog = 1;
    this.root = cmd.id;
    this._storyInit();
    this._refresh();
    if (mode === 'broken') this._wreck();
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
  // Where a new part would sit on `host`'s port `pi`. Decks are level everywhere (gravity points to the keel), so a part with
  // anything to stand on is only ever turned about the vertical: `rot` steps of 45 degrees. LOOSE parts (arrays, dishes, guns)
  // mate face to face and may be rolled about the port instead.
  //   side port, arm part      it sticks straight out                  up/down port, spine part   it stacks (by its top port when hung below)
  //   side port, spine part    it stands beside, touching by its rim    up/down port, arm part     it sits on top or hangs beneath
  placement(type, host, pi, rot = 0) {
    const d = C.parts[type], tp = this.port(host, pi), base = d.ports[0], join = tp.pos;
    const yaw = (a) => q.axisAngle([0, 1, 0], a), step = rot * Math.PI / 4;
    const hostLevel = Math.abs(q.rot(host.quat, [0, 1, 0])[1]) > 0.99;
    if (d.loose || !hostLevel) {
      const align = q.fromTo([base[3], base[4], base[5]], v.mul(tp.dir, -1));
      const quat = q.mul(q.axisAngle(tp.dir, step), align);
      return { pos: v.sub(tp.pos, q.rot(quat, [base[0], base[1], base[2]])), quat, base: 0, join };
    }
    const tv = Math.abs(tp.dir[1]) > 0.7, bv = Math.abs(base[4]) > 0.7;
    if (!tv && !bv) {
      // turn the base to face the port: both lie flat, so this is a turn about the vertical
      const quat = yaw(Math.atan2(base[5], base[3]) - Math.atan2(-tp.dir[2], -tp.dir[0]));
      return { pos: v.sub(tp.pos, q.rot(quat, [base[0], base[1], base[2]])), quat, base: 0, join };
    }
    if (tv && bv) {
      const quat = yaw(step);
      let bi = 0;
      if (Math.sign(base[4]) === Math.sign(tp.dir[1])) {      // the base faces the same way as the port: mate by the other end if it has one
        bi = d.ports.findIndex((x, i) => i > 0 && Math.abs(x[4]) > 0.7 && Math.sign(x[4]) !== Math.sign(tp.dir[1]));
        if (bi < 0) { const quat2 = q.mul(q.axisAngle(tp.dir, step), q.fromTo([base[3], base[4], base[5]], v.mul(tp.dir, -1))); return { pos: v.sub(tp.pos, q.rot(quat2, [base[0], base[1], base[2]])), quat: quat2, base: 0, join, flipped: true }; }
      }
      const b = d.ports[bi];
      return { pos: v.sub(tp.pos, q.rot(quat, [b[0], b[1], b[2]])), quat, base: bi, join };
    }
    if (bv) {      // a spine part on a side port: it stands beside the host, one of its own side ports mated to the host's, airlock to airlock
      const side = d.ports.map((x, i) => [x, i]).filter(([x]) => Math.abs(x[4]) < 0.7);
      if (side.length) {      // R picks which of its side ports faces the host
        const [k, ki] = side[((rot % side.length) + side.length) % side.length], quat = yaw(Math.atan2(k[5], k[3]) - Math.atan2(-tp.dir[2], -tp.dir[0]));
        return { pos: v.sub(tp.pos, q.rot(quat, [k[0], k[1], k[2]])), quat, base: ki, join };
      }
      const quat = yaw(step), rad = d.rad ?? 1.2;      // no side port of its own (a dome, a spire): it stands clear of the port
      return { pos: [tp.pos[0] + tp.dir[0] * rad, tp.pos[1], tp.pos[2] + tp.dir[2] * rad], quat, base: -1, join };
    }
    // an arm part on a port that faces up or down: it sits on top, or hangs beneath, with the middle of its hallway over the port,
    // so the lift tube in the port comes up through a hatch in the hallway floor
    const way = C.ways[type], quat = yaw(step), hh = d.hh ?? 1, c = q.rot(quat, [d.center[0], 0, way && way.k === 'hall' ? way.z : d.center[2]]);
    return { pos: [tp.pos[0] - c[0], tp.pos[1] + Math.sign(tp.dir[1]) * hh, tp.pos[2] - c[2]], quat, base: -1, join };
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
    const tpd = this.port(host, pi).dir;
    if (d.keel && tpd[1] > 0.7) return { ok: false, why: 'Its guns face the planet: use a side port or one underneath' };
    const pl = this.placement(type, host, pi, rot), c = v.add(pl.pos, q.rot(pl.quat, d.center));
    if (pl.flipped && d.rooms) return { ok: false, why: 'This part stands upright: use a port that faces up' };
    if (v.len(c) + d.r * 0.5 > this.radius) return { ok: false, why: 'Outside the permitted build zone' };
    // Parts may nest (a ring inside a ring, a module in the open middle of a disc), but one hull may not run through another.
    const hit = this.clashWith(type, host, pl);
    if (hit) return { ok: false, why: `It would run into ${hit === host ? 'the part it joins' : this.name(hit)}` };
    if (this.credits < d.cost) return { ok: false, why: 'Not enough credits' };
    return { ok: true, why: '' };
  }
  // The part a new one would run into, or null. Its solid (solid.js) is tested against every part near it: more than a few cells of
  // one inside the other is a clash. Against the part it joins, the cells right round the joining port do not count (that is where
  // the two are meant to meet). Answers are kept until the station changes.
  clashWith(type, host, pl) {
    const ver = `${this.parts.size}|${this._ver || 0}`;
    if (this._clashVer !== ver) { this._clashVer = ver; this._clashMemo = new Map(); }
    const mk = `${type}|${host.id}|${pl.pos.map((x) => x.toFixed(3))}|${pl.quat.map((x) => x.toFixed(4))}`;
    if (this._clashMemo.has(mk)) return this.parts.get(this._clashMemo.get(mk)) || null;
    const A = solidOf(type), ca = v.add(pl.pos, q.rot(pl.quat, A.c)), join = pl.join || this.port(host, 0).pos;
    let hit = null;
    for (const p of this.parts.values()) {
      if (p.state === 'demolish') continue;
      const B = solidOf(p.type), cb = v.add(p.pos, q.rot(p.quat, B.c));
      if (v.dist(ca, cb) > A.r + B.r) continue;
      // each one's deep cells (a cell or more inside its hull) through the other's solid: touching is allowed, running through is not
      const n = clashCells(A, pl.pos, pl.quat, B, p.pos, p.quat, p === host ? join : null) + clashCells(B, p.pos, p.quat, A, pl.pos, pl.quat, p === host ? join : null);
      if (n > C.clash.cells) { hit = p; break; }
    }
    this._clashMemo.set(mk, hit ? hit.id : 0);
    return hit;
  }
  build(type, hostId, pi, rot = 0) {
    const chk = this.canBuild(type, hostId, pi, rot);
    if (!chk.ok) return chk;
    const host = this.parts.get(hostId), pl = this.placement(type, host, pi, rot);
    this._money(-C.parts[type].cost, 'build');
    const p = this._make(type, host.id, pi, rot, pl.pos, pl.quat, pl.base, pl.join);
    if (type === 'billboard' && this.screenDefault) p.show = this.screenDefault;      // a new screen shows what the others were set to in the livery
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
  // `by` is 'player' when the commander paints the room, or a faction when it does so itself or you approved its request.
  // Rearrange a room: the same fittings, laid out another way. Free, and it changes nothing but how the room looks.
  // A Propaganda Screen's programme, and the station's own lines for screens set to YOUR OWN.
  setShow(id, prog) {
    const p = this.parts.get(id); if (!p || p.type !== 'billboard' || !C.screens.programs.some(([k]) => k === prog)) return false;
    p.show = prog; this.events.push({ type: 'show', part: id }); return true;
  }
  setScreenLines(text) {
    const S = C.screens, lines = String(text || '').split(/\n+/).map((x) => { const t = x.replace(/\s+/g, ' ').trim().toUpperCase(); return t.length <= S.maxChars ? t : t.slice(0, S.maxChars).replace(/\s+\S*$/, '') + '…'; }).filter(Boolean).slice(0, S.maxLines);
    this.screenLines = lines.length ? lines : null; this.events.push({ type: 'show', part: 0 }); return this.screenLines || S.own;
  }
  refit(id, slot) {
    const p = this.parts.get(id);
    if (!p || !p.rooms[slot] || p.rooms[slot] === 'empty') return { ok: false, why: 'Nothing to rearrange' };
    p.fit ||= []; p.fit[slot] = ((p.fit[slot] || 0) + 1) % 6;
    this.events.push({ type: 'room', part: p, slot });
    return { ok: true, n: p.fit[slot] };
  }
  setRoom(id, slot, room, mark = null, by = 'player') {
    const chk = this.canRoom(id, slot, room);
    if (!chk.ok) return chk;
    const p = this.parts.get(id);
    this._money(-C.rooms[room].cost, 'build');
    const owner = p.marks[slot] || ROOM_OF[p.rooms[slot]];
    if (by === 'player' && !this.sandbox && owner && owner !== ROOM_OF[room]) this._meddled(owner, p, p.rooms[slot]);
    p.rooms[slot] = room; p.marks[slot] = mark; if (p.fit) p.fit[slot] = 0;
    for (const a of this.agents) if (a.home === p.id) a.home = 0;    // anyone housed here finds their place again
    this.events.push({ type: 'room', part: p, slot });
    this._refresh();
    return chk;
  }

  _make(type, parent, pport, rot, pos, quat, base = 0, join = null) {
    this._ver = (this._ver || 0) + 1;
    const n = [...this.parts.values()].filter((x) => x.type === type).length + 1;
    const p = { id: this.nextId++, type, parent, pport, rot, pos, quat, n, join, used: new Set(parent && base >= 0 ? [base] : []), kids: [],
      state: 'building', prog: 0, seed: this.rng.next(), rooms: [...(C.parts[type].rooms || [])], marks: [], fault: false, fixer: 0 };
    this.parts.set(p.id, p);
    return p;
  }
  _remove(p) {
    this._ver = (this._ver || 0) + 1;
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
    const conn = child.join || this.port(child, 0).pos, ca = this.center(a), cb = this.center(b);
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
    const homes = {};
    let spires = 0, fuel = 0, refine = 0;
    this.cargoIds = new Set(); this.homeParts = {};
    for (const role of Object.keys(STAFF)) { homes[role] = 0; this.homeParts[role] = []; }
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
    this.platformN = 0; this.magN = 0;
    const mags = [];
    for (const p of this.parts.values()) if (p.state === 'active') { if (this.def(p).sys) this.platformN++; if (p.rooms.some((r) => C.rooms[r].mag)) { this.magN++; mags.push(p.id); } }
    this.magNear = 0;
    if (mags.length) { const dm = this.distMap(mags); for (const p of this.parts.values()) if (p.state === 'active' && !this.def(p).sys && p.rooms.some((r) => C.rooms[r].beds) && (dm.get(p.id) ?? 99) <= C.platform.bedsNear) this.magNear++; }
    for (const [role, k] of Object.entries(STAFF)) this.staff[role] = Math.min(homes[role], Math.floor(this.div[k].allot / C.div[k].per));
  }
  beds() { return this.capBeds; }
  residents() { let n = 0; for (const a of this.agents) if (a.role === 'resident') n++; return n; }
  berths(kind) {
    return this.list((d, p) => d.berth && (!d.berthRoom || this.has(p, d.berthRoom)) && (!kind || d.ships.includes(kind)) && !(this._shut && this._shut.has(p.id)));
  }
  // Berths with no clear way in for a ship, and what is in the way (the view works this out from the shape of the station).
  // Ships do not use them. It is said once, when a berth is first found shut: news, not nagging.
  setShut(map) {
    const was = this._shut || new Map(); this._shut = map;
    for (const [id, by] of map) if (!was.has(id)) { const p = this.parts.get(id); if (p && p.state !== 'demolish') this.say('traffic', `${this.name(p)} has no clear way in: ${by} is across its approach. Ships will not use it until the way is clear.`, { warn: true }); }
  }
  roomCount(room) { let n = 0; for (const p of this.parts.values()) if (this.works(p)) for (const r of p.rooms) if (r === room) n++; return n; }
  upkeep() {
    let s = 0;
    for (const p of this.parts.values()) if (p.state === 'active') { s += this.def(p).up; for (const r of p.rooms) s += C.rooms[r].up || 0; }
    s = s * (this.div.maintenance.order.plan === 'preventive' ? 1.2 : 1) - this.food;
    return Math.max(0, s);
  }
  wages() {
    // Staff are kept in supplies, not credits: the only wage bill left is free care.
    return this.div.medical.order.care === 'free' && this.staff.medic ? 10 : 0;
  }
  incomePerMin() {
    let s = this.residents() ? this.income : 0;
    if (this.div.medical.order.care === 'fees') s += 2 * this.staff.medic;
    return s;
  }
  taxPerMin() { return this.residents() * this.tax * C.econ.taxPerPct; }
  setTax(x) { this.tax = Math.max(0, Math.min(30, Math.round(x))); }
  // A LIBERTY DAY: a day of flags, speeches and an open bar, paid for in credits. Morale goes up at once and wears off over a few
  // days. One a week at most.
  // A CONTRABAND AMNESTY: hand it in, no questions asked. Unrest is halved at once; it costs credits; one every few days.
  canAmnesty() {
    const A = C.morale.amnesty, wait = (this.amnestyT ?? -1e9) + A.every * C.time.daySec - this.t;
    if (this.unrest < 2) return { ok: false, why: 'There is no unrest to calm' };
    if (wait > 0) return { ok: false, why: `The next can be held in ${Math.ceil(wait / C.time.daySec)} days` };
    if (!this.sandbox && this.credits < A.cost) return { ok: false, why: `It costs ${A.cost} CR` };
    return { ok: true, why: '' };
  }
  amnesty() {
    const chk = this.canAmnesty(); if (!chk.ok) return chk;
    if (!this.sandbox) this._money(-C.morale.amnesty.cost, 'amnesty');
    this.amnestyT = this.t; this.unrest /= 2;
    this.say('security', 'Contraband amnesty declared. Bring it to the nearest officer, no questions asked. The bins are filling up.', { gold: true });
    return chk;
  }
  canCelebrate() {
    const F = C.morale.festival, wait = (this.cheerT ?? -1e9) + F.every * C.time.daySec - this.t;
    if (!this.residents()) return { ok: false, why: 'Nobody lives aboard yet' };
    if (wait > 0) return { ok: false, why: `The next can be held in ${Math.ceil(wait / C.time.daySec)} days` };
    if (!this.sandbox && this.credits < F.cost) return { ok: false, why: `It costs ${F.cost} CR` };
    return { ok: true, why: '' };
  }
  celebrate() {
    const chk = this.canCelebrate(); if (!chk.ok) return chk;
    const F = C.morale.festival;
    if (!this.sandbox) this._money(-F.cost, 'festival');
    this.cheer = F.gain; this.cheerT = this.t;
    this.say('truth', `Liberty Day is declared. Flags on every deck, speeches at noon, and the bar is open. Morale +${F.gain}, for a few days.`, { gold: true });
    return chk;
  }
  setAllot(k, x) { this.div[k].allot = Math.max(0, Math.min(C.allotMax, Math.round(x))); this._refresh(); }
  setOrder(k, o, val) { this.div[k].order[o] = val; this._refresh(); this.events.push({ type: 'order', from: k, text: this.ack(k, o, val) }); }
  broadcastBoost() {
    const o = this.div.truth.order.broadcast;
    if (o !== 'patriotic') return 0;
    return Math.min(8, 2 + 2 * this.broadcast);
  }
  moraleParts() {
    const M = C.morale, sh = this.div.supply.order.shift === 'double', care = this.div.medical.order.care;
    const tax = this.tax > M.taxFree ? -(this.tax - M.taxFree) * M.taxPenalty : (M.taxFree - this.tax) * M.taxBonus;
    const faulty = [...this.parts.values()].filter((p) => p.fault && p.rooms.length).length;
    return {
      base: M.base, tax, leisure: Math.max(-10, Math.min(M.leisureMax, this.leisure)), power: -M.power * (1 - this.eff),
      unrest: -this.unrest, faults: -M.faulty * faulty, medical: this.staff.medic ? (care === 'free' ? 4 : -2) : 0,
      broadcast: this.broadcastBoost(), shifts: sh ? -5 : 0, broke: this.credits < 0 ? -15 : 0, rations: this.short.rations ? -10 : 0, magazines: this.magNear ? -M.magazine : 0,
      rationing: this.residents() && !this.short.rations ? M.ration[this.div.supply.order.rations || 'normal'][0] : 0, festival: this.cheer || 0,
    };
  }
  // `line`: which line of the accounts it belongs on, where a category has several (trade: crates, docking, repairs, fines).
  _money(x, cat, line = cat) {
    if (this.sandbox && cat === 'build') return;
    this.credits += x;
    this.totals[cat] = (this.totals[cat] || 0) + x;
    if (cat === 'build') return;
    const s = Math.floor(this.t), b = this.buckets[s % 60];
    if (b.s !== s) { b.s = s; b.v = 0; }
    b.v += x;
    const f = ((this._flow ||= {})[line] ||= Array.from({ length: 60 }, () => ({ s: -1, v: 0 })))[s % 60];      // the last minute, line by line (ledger.js)
    if (f.s !== s) { f.s = s; f.v = 0; }
    f.v += x;
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
    if (n.ready) items.push({ label: 'Platform readiness', have: Math.round(this.platform().ready * 100), need: n.ready });
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
    if (this.tier >= 1 && fb.length && offices.length && this.defence < this.raidStrength() - 2) { out.security.t = Math.max(5, out.security.t - 15); out.security.why = `The hull is under-gunned: defence ${this.defence} against raids of about ${this.raidStrength()}. ${out.security.why}`; }
    const suites = this._withRoom('brass');
    if (!suites.length) out.command = { t: 25, why: 'There is no Brass Suite to receive visiting officers.' };
    else {
      const dm = this.distMap(suites), d = dm.get(this.root) ?? 60, shortN = Object.values(this.short).filter(Boolean).length;
      out.command = { t: clamp(100 - d * 3 - Math.min(30, faults * 10) - shortN * 8), why: faults ? `${faults} part${faults > 1 ? 's are' : ' is'} out of order. Command likes everything working.` : shortN ? 'The stores are running short. Command likes them full.' : `The Brass Suite is ${Math.round(d)} units from Station Command.` };
    }
    const labs = this._withRoom('lab'), gear = act.filter((p) => !p.fault && ['spire', 'dish', 'dome', 'blister'].includes(p.type)).map((p) => p.id);
    if (!labs.length) out.science = { t: 25, why: 'There is no Laboratory.' };
    else if (!gear.length) out.science = { t: 45, why: 'There is no antenna, dome or observation blister to work with.' };
    else {
      const dm = this.distMap(gear), d = avg(labs.map((b) => dm.get(b) ?? 60));
      out.science = { t: clamp(100 - d * 3), why: `The labs are ${Math.round(d)} units from the nearest instruments.` };
    }
    out.gunnery = this._gunneryTarget();
    // A faction cannot be blamed for a room the Ministry has not allowed yet.
    for (const k of FACTIONS) if (!this.roomOpen(C.factions[k].room)) out[k] = { t: 55, why: `The Ministry has not yet allowed ${C.factions[k].ask.replace(/^an? /, '')}s.` };
    for (const [role, k] of Object.entries(STAFF)) if (this.homes[role] > 0 && this.staff[role] === 0) { out[k].t = Math.max(5, out[k].t - 20); out[k].why = `There is no allotment to keep anyone on duty. ${out[k].why}`; }
    for (const k of FACTIONS) if (this.short[k]) { out[k].t = Math.max(5, out[k].t - C.faction.short); out[k].why = `We are out of ${C.supplies[C.div[k].uses].name.toLowerCase()}. ${out[k].why}`; }
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
    const raw = this.stats.crates * K.crate + this.stats.ships * K.ship + this.residents() * K.resident + this.defence * K.defence + (this.stats.repairs || 0) * K.repair + staff * K.staff
      + this.stats.research * K.research + this.stats.raidsWon * K.raid + (this.stats.calls || 0) * K.call + this.platform().score * K.platform;
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
      case 'guns': return 'checking the guns';
      case 'rounds': return a.role === 'aide' ? 'inspecting the station' : a.role === 'scientist' ? 'taking readings' : 'doing rounds';
      case 'leave': return 'leaving the station';
      case 'out': return 'out for a walk';
      case 'back': return 'heading home';
      default: return a.role === 'resident' ? 'at home' : a.role === 'gunner' ? 'standing by for a call' : 'on station';
    }
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
    // Unrest fades by itself, faster with Democracy Officers on duty, and never runs past its ceiling.
    this.unrest = Math.min(C.morale.unrestMax, Math.max(0, this.unrest - dt * C.morale.contraband / C.morale.unrestDecaySec * (1 + 0.25 * Math.min(4, this.staff.officer || 0))));
    if (this.cheer) this.cheer = Math.max(0, this.cheer - dt * C.morale.festival.gain / (C.morale.festival.days * C.time.daySec));      // a Liberty Day wears off
    this._factions(dt);
    this._requests(dt);
    this._story(dt);
    this._platform(dt);
    this._advise(dt);
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
      name: `${this.rng.pick(FIRST)} ${this.rng.pick(LAST)}`, since: this.t, story: [], n: 0 };
    this.agents.push(a);
    this.note(a, role === 'resident' ? 'Came aboard as a colonist.' : `Reported for duty with ${C.factions[STAFF[role]].who}.`);
    return a;
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
      if (a.s + left >= L) { left -= L - a.s; a.s = 0; a.at = to.id; a.path.shift(); a.leg = (a.leg || 0) + 1; } else { a.s += left; left = 0; }
    }
    if (!a.path.length) this._arrive(a);
  }
  _go(a, goal, task) {
    const p = this.route(a.at, goal);
    if (!p) return false;
    a.path = p; a.s = 0; a.task = task; a.leg = 0;
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
    if (a.role === 'gunner') {
      if (a.task !== 'guns' && this.rng.chance(0.35)) {
        const spots = this.list((d, p) => d.sys || this.has(p, 'mess') || this.has(p, 'bar')).filter((p) => p.id !== a.at);
        if (spots.length) { const t = this.rng.pick(spots).id; if (this._go(a, (p) => p.id === t, 'guns')) return; }
      }
      return this._goHome(a, [4, 10]);
    }
    if (a.role === 'aide' || a.role === 'scientist') {
      if (a.task !== 'rounds' && this.rng.chance(0.5)) {
        const spots = a.role === 'aide' ? this.list((d, p) => p.type === 'command' || this.has(p, 'ops') || this.has(p, 'mess') || d.berth)
          : this.list((d, p) => ['spire', 'dish', 'dome', 'blister'].includes(p.type) || this.has(p, 'lounge') || this.has(p, 'hydro'));
        if (spots.length) { const t = this.rng.pick(spots).id; if (t !== a.at && this._go(a, (p) => p.id === t, 'rounds')) return; }
      }
      return this._goHome(a, [4, 9]);
    }
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
    if (a.task === 'fix') { a.wait = W.repairSec / (0.5 + 0.5 * this.eff) / this.mood(a.role) * (this.take('parts', C.supply.repairParts) ? 1 : 2.5); a.pending = 'fix'; a.eva = true; return; }
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
      if (s && s.state === 'docked' && s.crates > 0) { s.crates--; a.carry = true; a.cargo = (s.manifest && s.manifest.pop()) || 'rations'; }
      if (s) s.reserved = Math.max(0, s.reserved - 1);
    } else if (what === 'drop') {
      a.carry = false; a.task = null;
      this._money(this.crateFee(), 'trade', 'crates'); this._sawCrate(); this.stats.crates++; this.crateTimes.push(this.t);
      this.stock[a.cargo || 'rations'] = (this.stock[a.cargo || 'rations'] || 0) + 1; this.weekIn++;
      if (++a.n % 25 === 0) this.note(a, `Carried a ${a.n}th crate to the stores.`);
      this.events.push({ type: 'crate', part: a.at });
    } else if (what === 'fix') {
      const p = this.parts.get(a.target);
      a.task = null;
      if (p && p.fixer === a.id) {
        p.fault = false; p.fixer = 0; this.stats.fixed = (this.stats.fixed || 0) + 1; this._refresh();
        this.note(a, `Went out on the hull and repaired ${this.name(p)}.`);
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
        this.timers.freighter = this._freighterGap(rate);      // by the market's demand, not by how many berths there are
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
    this._occ(dt);
    for (const s of this.ships.filter((x) => x.state === 'hold').sort((a, b) => a.born - b.born)) {
      const b = this.pickBerth(s.kind);
      if (!b) continue;
      s.dock = b.id; s.state = 'approach'; s.t = 0; this._usedBerth(b.id);
      if (s.t0 !== undefined && this.t - s.t0 > C.ships.waitSec * 0.5) this._rep(C.market.lost * 0.25);      // kept waiting a long while
    }
    for (const s of [...this.ships]) {
      s.t += dt;
      if (s.state === 'hold' && s.t > S.waitSec) { this.stats.lost++; if (s.kind === 'freighter') this._rep(C.market.lost); this.say('traffic', `${s.name} gave up waiting for a berth and jumped away. Trade lost.`, { warn: true }); this._depart(s, true); }
      else if (s.state === 'approach' && s.t >= S.approachSec) this._docked(s);
      else if (s.state === 'docked') {
        if (!this.parts.get(s.dock)) { this._depart(s, true); continue; }
        if (s.inspect > 0) s.inspect -= dt;
        if (s.kind === 'shuttle' ? s.t > 4 : s.kind === 'warship' ? s.repair >= 1 : s.crates <= 0 && s.reserved <= 0 && s.inspect <= 0) this._depart(s, false);
        else if (s.kind === 'warship') {
          const hands = this.agents.filter((a) => a.task === 'drydock' && a.ship === s.id && a.eva).length;
          s.repair += dt / S.repairSec * (0.25 + 0.75 * Math.min(1, hands / 2));
          if (s.repair >= 1) { this._money(S.repairFee, 'trade', 'repairs'); this.stats.repairs++; this.say('captain', `${s.name}: repairs complete. Your yard did fine work, Commander. Transferring ${S.repairFee} CR. Back to the front.`); }
        }
      } else if (s.state === 'depart' && s.t >= S.departSec) this.ships.splice(this.ships.indexOf(s), 1);
    }
  }
  _arrival(kind) {
    if (this.ships.filter((s) => s.state === 'hold').length >= C.ships.queueMax) {
      this.stats.lost++; if (kind === 'freighter') this._rep(C.market.turned); this.say('traffic', 'A ship was turned away: every berth and holding slot is full.', { warn: true }); return;
    }
    const name = kind === 'warship' ? this.rng.pick(WARSHIPS) : `${kind === 'shuttle' ? 'Shuttle' : 'Freighter'} ${this.rng.pick(NAMES)}`;
    this.ships.push({ id: this.nextId++, kind, name, born: this.t, state: 'hold', t: 0, dock: 0, crates: 0, reserved: 0, inspect: 0, repair: 0, crew: 0,
      seed: this.rng.next(), lastDock: 0, t0: this.t, smuggler: kind === 'freighter' && this.rng.chance(C.ships.smuggler) });
    if (kind === 'warship') this.say('traffic', `${name} is inbound with battle damage, requesting the drydock.`);
  }
  _docked(s) {
    const p = this.parts.get(s.dock);
    if (!p) { this._depart(s, true); return; }
    s.state = 'docked'; s.t = 0; s.lastDock = p.id; s.dockedAt = this.t;
    this._money(C.econ.dockFee + this.fuelN * C.parts.tanks.fuel, 'trade', 'docking');
    if (s.kind === 'shuttle') {
      const beds = this.freeBeds(), n = Math.min(C.ships.colonists, beds.length);
      for (let i = 0; i < n; i++) { const a = this._spawn('resident', p.id, beds[i].id); a.wait = i * 0.5; a.task = 'back'; }
      this.stats.colonists += n;
      this.say('captain', n ? `${s.name} at ${this.name(p)}. ${n} colonists disembarking. Welcome, citizens! Report for gratitude.` : `${s.name} at ${this.name(p)}, no one to drop off.`);
      return;
    }
    if (s.kind === 'warship') { this.say('traffic', `${s.name} is in the drydock. Engineers to EVA stations.`); return; }
    s.crates = this.def(p).crates || 6;
    s.manifest = this.manifest(s.crates);
    this.say(this.rng.chance(0.5) ? 'captain' : 'traffic', this.rng.chance(0.5) ? `${s.name}, clamps locked at ${this.name(p)}. ${s.crates} crates of liberty for you.` : `${s.name} has docked at ${this.name(p)} with ${s.crates} crates.`);
    // Democracy Officers check freighters at bays near a Security Office.
    const every = this.div.security.order.checks === 'every';
    const post = this.staff.officer ? this.list((d, x) => this.has(x, 'secoffice')).find((o) => { const r = this.route(o.id, (x) => x.id === p.id); return r && this.walkDist(o.id, r) <= C.securityReach; }) : null;
    if (post && every) s.inspect = C.walk.inspectSec;
    // A Customs Scanner scans every freighter docking within reach, staff or none.
    const scan = this.list((d, x) => this.has(x, 'customs')).some((o) => { const r = this.route(o.id, (x) => x.id === p.id); return r && this.walkDist(o.id, r) <= C.securityReach; });
    if (s.smuggler) {
      const caught = (post && (every || this.rng.chance(0.5))) || (scan && this.rng.chance(C.morale.scanner));
      if (caught) {
        this.stats.caught++; this._money(C.econ.fine, 'trade', 'fines');
        this.say('security', `Unapproved goods seized from ${s.name}. A ${C.econ.fine} CR fine has been collected. Democracy is safe.`, { gold: true });
        const off = this.agents.find((a) => a.role === 'officer' && !a.task);
        if (off) { this._go(off, (x) => x.id === p.id, 'inspect'); this.note(off, `Seized unapproved goods from ${s.name}.`); }
      } else {
        this.stats.contraband++; this.unrest += C.morale.contraband;
        this.say('security', `Unapproved goods from ${s.name} have reached the residents. ${post || scan ? 'Our checks missed it.' : 'Nothing watches that bay: a Customs Scanner or a Security Office nearby would.'}`, { warn: true });
      }
    }
  }
  _depart(s, lost) {
    if (!lost && s.kind === 'freighter') this._rep(C.market.served);
    if (!lost) { this.stats.ships++; if (s.dockedAt != null) { this.berthTimes.push(this.t - s.dockedAt); if (this.berthTimes.length > 20) this.berthTimes.shift(); } }
    else if (s.state === 'docked' && s.crates > 0) { this.stats.lost++; if (s.kind === 'freighter') this._rep(C.market.lost); }
    s.lastDock = s.dock || s.lastDock; s.state = 'depart'; s.t = 0; s.dock = 0; s.crates = 0; s.reserved = 0;
    for (const a of this.agents) if ((a.task === 'pick' || a.task === 'drydock') && a.ship === s.id) { a.task = null; a.path = []; a.s = 0; a.eva = false; }
  }

  // ---------------------------------------------------------------- division reports, in their own voices
  report(k) {
    const st = this.staff, open = [...this.parts.values()].filter((p) => p.fault);
    switch (k) {
      case 'supply': { const b = this.busy('hauler'); return `Haulers on shift: ${st.hauler} of ${this.homes.hauler} places, ${b.busy} carrying right now. Crates this minute: ${this.cratesPerMin().toFixed(0)}. Ships waiting: ${this.ships.filter((s) => s.state === 'hold').length}. ${this.cargoIds.size ? 'Every crate accounted for, Commander.' : 'We have nowhere to put cargo. Build a Cargo Store.'}`; }
      case 'maintenance': return `Engineers on staff: ${st.engineer} of ${this.homes.engineer} places. Open faults: ${open.length}${open.length ? ` (${open.slice(0, 3).map((p) => this.name(p)).join(', ')})` : ''}. Faults fixed: ${this.stats.fixed || 0}. ${st.engineer ? 'Suits charged and ready.' : 'Give us a Workshop and an allotment of parts and we\'ll keep her flying.'}`;
      case 'security': return `Officers on duty: ${st.officer} of ${this.homes.officer} places. Smugglers caught: ${this.stats.caught}, slipped through: ${this.stats.contraband}. ${this.homes.officer ? 'Bays near a Security Office are watched.' : 'Without a Security Office, every bay is unwatched.'}`;
      case 'medical': return `Medics: ${st.medic} of ${this.homes.medic} places. ${st.medic ? (this.div.medical.order.care === 'free' ? 'Free care for every citizen: morale is up.' : 'Fees are being collected at the door.') : 'No Medbay, no medics. Citizens are treating themselves.'}`;
      case 'traffic': { const bf = this.berths('freighter').length; return `Berths: ${bf} for freighters, ${this.berths('shuttle').length} for shuttles, ${this.berths('warship').length} drydock. Ships served: ${this.stats.ships}, lost: ${this.stats.lost}. Average time at berth: ${this.avgBerth() == null ? 'no data yet' : this.avgBerth().toFixed(0) + ' s'}.`; }
      case 'command': return `Aides on staff: ${st.aide} of ${this.homes.aide} places. Open faults: ${open.length}. Stores running short: ${Object.entries(this.short).filter(([, x]) => x).map(([k2]) => k2).join(', ') || 'none'}. ${this.homes.aide ? 'The suite is ready for inspection at any hour.' : 'We have nowhere fit to receive the brass, Commander.'}`;
      case 'science': return `Scientists: ${st.scientist} of ${this.homes.scientist} places. Research logged: ${Math.floor(this.stats.research)}. ${this.homes.scientist ? 'Readings are coming in.' : 'Give us a Laboratory and we will tell you things about this planet you will wish you did not know.'}`;
      case 'gunnery': { const P = this.platform(); return `Gunners, pilots and troopers on duty: ${st.gunner} of ${this.homes.gunner} places. Platform readiness: ${Math.round(P.ready * 100)}%. Calls answered: ${this.stats.calls || 0}, missed: ${this.stats.missed || 0}. ${this.platformN ? (P.ready > 0.8 ? 'The troops below know we are here.' : 'We are not where the Ministry expects us to be, Commander.') : 'There is no gun on this station. Build a Ship Gun or an Orbital Battery.'}`; }
      case 'truth': return this.div.truth.order.broadcast === 'silence' ? 'The Ministry is silent, by your order. Citizens are left alone with their thoughts.' : `Broadcasting ${this.div.truth.order.broadcast === 'patriotic' ? 'the Patriotic Hour' : 'the Recruitment Drive'} on every screen. Morale from broadcasts: +${this.broadcastBoost().toFixed(0)}. Truth Offices aboard: ${this.broadcast}.`;
    }
    return '';
  }
  ack(k, o, val) {
    const lines = {
      shift: { normal: 'Back to normal shifts, Commander.', double: 'Double shifts it is. The haulers won\'t thank you.' },
      rations: { normal: 'Standard rations for all hands.', double: 'Double rations. The mess will be a happier place, while the lockers last.', short: 'Short rations from today. Nobody will thank us for it.' },
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

installStory(Station);
installPlatform(Station);
installLedger(Station);
installMarket(Station);
