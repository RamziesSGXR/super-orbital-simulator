// The station's story layer, mixed into Station (see the last line of sim.js). No DOM and no 3D.
//   time      - station days and weeks
//   supplies  - coffee, parts, ammunition and the rest arrive by the crate and are drawn a day at a time from weekly allotments
//   requests  - what reaches the commander: a faction asking for a room, two factions wanting the same space, an allotment
//               change, or a choice about named people. Small changes never ask: the faction just makes them.
//   raids     - raiders test the hull from Garrison on
//   wreck     - the Broken Station start
//   save      - the whole station to and from plain JSON
import { C } from './config.js';
import { RNG } from './rng.js';
import { v, q } from './math3.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const SUPPLY_OF = {};      // supply type -> faction
for (const [k, d] of Object.entries(C.div)) if (d.uses) SUPPLY_OF[d.uses] = k;

// Choices about people. `need(st)` returns the cast (or null); `text(cast, st)` the line; `opts` the answers and what they do.
// fx: goodwill by faction; morale: a one-off nudge to unrest (positive is bad); note: what goes in each person's story.
const DILEMMAS = [
  // Asked at any tier, as soon as smuggled goods have the habs restless (see _requests): unrest must always have a way down.
  { id: 'contraband', urgent: true,
    need: (st) => st.unrest >= 12 && st.residents() ? { a: st.someone('resident'), b: st.someone('officer') || st.someone('hauler') || st.someone('resident') } : null,
    text: (c, st) => `Smuggled goods are all over the habs. Resident ${c.a.name} was found selling them from a bunk; ${c.b.name} brought it to your desk. How do we deal with it?`,
    opts: [
      { label: 'CRACK DOWN', fx: { security: 8, command: -3 }, unrest: -14, note: ['Lost a bunk full of goods in the crackdown.', 'Took part in the Commander\'s crackdown.'], say: ['security', 'Every bunk searched. The habs are quiet, and not happy about it.'] },
      { label: 'AMNESTY · 80 CR', fx: { security: -3, command: 2 }, unrest: -10, credits: -80, note: ['Handed it in under the amnesty.', 'Ran the amnesty bins.'], say: ['colonists', 'The amnesty bins filled in an hour. Nobody asked any questions.'] },
      { label: 'LET IT PASS', fx: { security: -8 }, unrest: 3, note: ['Kept selling, with the Commander\'s blind eye.', 'Was told to let it pass.'], say: ['security', 'Understood. We will not search the habs.'] },
    ] },
  { id: 'checkpoint',
    need: (st) => st.staff.officer && st.staff.hauler && st.stats.ships > 4 ? { a: st.someone('hauler'), b: st.someone('officer'), p: st.berths('freighter')[0] } : null,
    text: (c, st) => `Hauler ${c.a.name} shoved Officer ${c.b.name} at the ${st.name(c.p)} checkpoint, after a third search this shift. Both want you to rule on it.`,
    opts: [
      { label: 'BACK SECURITY', fx: { security: 10, supply: -10 }, note: ['Was written up after the checkpoint row.', 'Was backed by the Commander after the checkpoint row.'], say: ['security', 'The search stands. Thank you, Commander.'] },
      { label: 'BACK SUPPLY', fx: { supply: 10, security: -10 }, note: ['Was cleared by the Commander after the checkpoint row.', 'Was told to ease off the haulers.'], say: ['supply', 'The haulers heard. They will remember it, Commander.'] },
      { label: 'SEND BOTH TO THE BAR', fx: { supply: 2, security: 2 }, unrest: -3, note: ['Was sent to the bar with an Officer, on the Commander\'s orders.', 'Was sent to the bar with a hauler, on the Commander\'s orders.'], say: ['colonists', 'They were seen sharing a table. Nobody knows what was said.'] },
    ] },
  { id: 'still',
    need: (st) => st.staff.officer && st.staff.engineer ? { a: st.someone('engineer'), b: st.someone('officer'), p: st.parts.get(st._withRoom('workshop')[0]) } : null,
    text: (c, st) => `Officer ${c.b.name} found a still behind the benches in ${c.p ? st.name(c.p) : 'a workshop'}. Engineer ${c.a.name} says it is "a coolant experiment".`,
    opts: [
      { label: 'CONFISCATE IT', fx: { security: 8, maintenance: -8 }, note: ['Lost the still to Security.', 'Confiscated a still from Maintenance.'], say: ['security', 'Unapproved beverages destroyed. Mostly.'] },
      { label: 'LOOK AWAY', fx: { maintenance: 9, security: -8 }, unrest: 4, note: ['Kept the still, with the Commander looking the other way.', 'Was told to forget about the still.'], say: ['maintenance', 'Coolant experiment continues. Results are promising.'] },
      { label: 'MOVE IT TO THE BAR', fx: { maintenance: 3, security: -2, command: -4 }, unrest: -4, need: 'bar', note: ['Now supplies the Liberty Lounge, unofficially.', 'Was overruled about the still.'], say: ['colonists', 'The Liberty Lounge has a new house special. Morale is up.'] },
    ] },
  { id: 'overtime',
    need: (st) => st.staff.medic && st.residents() > 6 ? { a: st.someone('medic'), b: st.someone('resident') } : null,
    text: (c) => `Medic ${c.a.name} has worked three shifts straight looking after ${c.b.name} and the others on that deck, and will not stop unless ordered.`,
    opts: [
      { label: 'ORDER REST', fx: { medical: 6, command: 2 }, unrest: 2, note: ['Was ordered to rest by the Commander.', 'Waited a day longer for the medic.'], say: ['medical', 'Standing down. Reluctantly.'] },
      { label: 'COMMEND AND CONTINUE', fx: { medical: -5, command: 3 }, unrest: -4, note: ['Was commended for three straight shifts.', 'Was looked after by a medic who would not go home.'], say: ['medical', 'Commendation received. Coffee would also be welcome.'] },
      { label: 'SEND MORE MEDKITS', fx: { medical: 10, supply: -4 }, stock: { medkits: -4 }, note: ['Got the extra medkits they asked for.', 'Was treated properly at last.'], say: ['medical', 'Supplies received. That is how you run a ward.'] },
    ] },
  { id: 'readings',
    need: (st) => st.staff.scientist && st.staff.aide ? { a: st.someone('scientist'), b: st.someone('aide') } : null,
    text: (c) => `Scientist ${c.a.name} wants to publish readings that show the planet below is less pacified than the Ministry says. Aide ${c.b.name} wants the file sealed.`,
    opts: [
      { label: 'SEAL IT', fx: { command: 10, science: -10 }, note: ['Had their readings sealed.', 'Sealed the readings, with the Commander\'s backing.'], say: ['truth', 'The planet is entirely pacified. It always has been.'] },
      { label: 'PUBLISH', fx: { science: 12, command: -10 }, unrest: 5, research: 20, note: ['Published the readings.', 'Was overruled about the readings.'], say: ['science', 'Published. The Directorate thanks you. The Ministry may not.'] },
    ] },
  { id: 'inspection',
    need: (st) => st.staff.aide && st.staff.engineer ? { a: st.someone('aide'), b: st.someone('engineer') } : null,
    text: (c) => `Aide ${c.a.name} wants every corridor polished for a visiting admiral. Engineer ${c.b.name} says the crews are needed on real repairs.`,
    opts: [
      { label: 'POLISH THE CORRIDORS', fx: { command: 10, maintenance: -9 }, note: ['Got the corridors polished for the admiral.', 'Spent a shift polishing corridors.'], say: ['command', 'The admiral remarked on the floors. Favourably.'] },
      { label: 'REPAIRS COME FIRST', fx: { maintenance: 10, command: -8 }, note: ['Was told repairs come first.', 'Was backed by the Commander: repairs first.'], say: ['maintenance', 'Thank you, Commander. The admiral can step over the cables.'] },
    ] },
  { id: 'dangerclose',
    need: (st) => st.staff.gunner && st.staff.officer && (st.stats.calls || 0) >= 3 ? { a: st.someone('gunner'), b: st.someone('officer') } : null,
    text: (c, st) => `The ${st.rng.pick(C.platform.squads)} are calling fire onto their own position. Gunner ${c.a.name} will not fire without your word. Officer ${c.b.name} says the regulation is clear: a call is a call.`,
    opts: [
      { label: 'FIRE AS CALLED', fx: { gunnery: -6, security: 8, command: 4 }, note: ['Fired on a squad\'s own position, as called, on the Commander\'s word.', 'Saw a call answered by the book.'], say: ['gunnery', 'Shot out. Nothing more on that channel, Commander.'] },
      { label: 'HOLD FIRE', fx: { gunnery: 8, security: -8, command: -4 }, unrest: 2, note: ['Was told to hold fire, and held it.', 'Was overruled about a call for fire.'], say: ['gunnery', 'Holding. They are still talking down there. For now.'] },
      { label: 'WALK IT IN SHORT', fx: { gunnery: 4, security: -2 }, stock: { shells: -2 }, note: ['Walked the fire in short of the squad, shell by shell.', 'Watched Gunnery bend a regulation.'], say: ['gunnery', 'Two shells short of them, then one. They are moving again.'] },
    ] },
  { id: 'magazine',
    need: (st) => st.magNear && st.staff.gunner && st.residents() > 3 ? { a: st.someone('resident'), b: st.someone('gunner') } : null,
    text: (c) => `${c.a.name} has asked to be moved: their bunk shares a deck with a magazine and they have stopped sleeping. Gunner ${c.b.name} says the bulkhead is rated for it.`,
    opts: [
      { label: 'THE BULKHEAD IS RATED', fx: { gunnery: 6, medical: -4 }, unrest: 4, note: ['Was told the bulkhead is rated.', 'Was backed by the Commander about the magazine.'], say: ['colonists', 'Somebody has chalked "RATED" on the magazine door.'] },
      { label: 'FIND THEM ANOTHER BUNK', fx: { medical: 5, gunnery: -3 }, unrest: -3, note: ['Was moved away from the magazine.', 'Lost an argument about a bulkhead.'], say: ['medical', 'Moved, and asleep within the hour.'] },
    ] },
  { id: 'crate',
    need: (st) => st.staff.hauler && st.staff.scientist ? { a: st.someone('hauler'), b: st.someone('scientist') } : null,
    text: (c) => `A crate of instruments went into the stores as "assorted glassware" and Hauler ${c.a.name} has issued half of it to the mess. Scientist ${c.b.name} wants it back.`,
    opts: [
      { label: 'RETURN IT TO SCIENCE', fx: { science: 9, supply: -6 }, stock: { instruments: 3 }, note: ['Had to collect the glassware from the mess.', 'Got the instruments back.'], say: ['science', 'Recovered. Some of it smells of soup.'] },
      { label: 'THE MESS KEEPS IT', fx: { supply: 5, science: -9 }, unrest: -3, note: ['Kept the mess in glassware.', 'Lost a crate of instruments to the mess.'], say: ['colonists', 'The mess now serves drinks in very precise measures.'] },
    ] },
];

export function installStory(Station) {
  Object.assign(Station.prototype, {
    // ------------------------------------------------------------------------------------------------ set-up
    _storyInit() {
      this.stock = {}; this.short = {}; this.owed = {};
      for (const k of Object.keys(C.supplies)) { this.stock[k] = this.sandbox ? 999 : C.supply.start; this.short[k] = false; this.owed[k] = 0; }
      for (const k of Object.keys(C.div)) this.short[k] = false;
      this.day = 0; this.weekIn = 0; this.lastWeek = { in: 0, cap: 0 };
      this.raid = null; this.goal = null;
      this.timers.dilemma = this.rng.range(C.faction.dilemmaSec[0], C.faction.dilemmaSec[1]);
      this.timers.raid = C.raid.firstSec; this.timers.grumble = 0;
      this.asked = new Set();
    },
    // ------------------------------------------------------------------------------------------------ time
    week() { return Math.floor(this.day / C.time.week) + 1; }, dow() { return this.day % C.time.week + 1; },
    dayPart() { return (this.t % C.time.daySec) / C.time.daySec; },
    weekPart() { return (this.day % C.time.week + this.dayPart()) / C.time.week; },
    stamp() { return `W${this.week()} D${this.dow()}`; },
    note(a, text) { if (!a) return; a.story.push({ d: this.stamp(), text }); if (a.story.length > 8) a.story.shift(); },
    someone(role) { const xs = this.agents.filter((a) => a.role === role && !a.leaving); return xs.length ? this.rng.pick(xs) : null; },

    // ------------------------------------------------------------------------------------------------ supplies
    // Take `n` of a supply from the stores. False (and nothing taken) when there is not enough.
    take(type, n) { if (this.sandbox) return true; if ((this.stock[type] || 0) < n) return false; this.stock[type] -= n; return true; },
    weeklyNeed(type) {
      if (type === 'rations') return this.residents() * C.supply.rationPerResident * C.morale.ration[this.div.supply.order.rations || 'normal'][1];
      const k = SUPPLY_OF[type];
      return k ? this.div[k].allot + (type === 'shells' && this.platformN ? 5 : 0) : 0;
    },
    // What a freighter brings: more of whatever the stores are shortest of, against a week's need.
    manifest(n) {
      const types = Object.keys(C.supplies), w = types.map((t) => Math.max(0.6, this.weeklyNeed(t) * 1.6 + 2 - (this.stock[t] || 0)));
      const sum = w.reduce((s, x) => s + x, 0), out = [];
      for (let i = 0; i < n; i++) { let r = this.rng.next() * sum, j = 0; while (j < types.length - 1 && (r -= w[j]) > 0) j++; out.push(types[j]); }
      return out;
    },
    _draw() {      // once a day
      if (this.sandbox) return;
      for (const type of Object.keys(C.supplies)) {
        const k = SUPPLY_OF[type], staffed = type === 'rations' ? this.residents() > 0 : this.staff[C.div[k].staff] > 0;
        this.owed[type] += staffed ? this.weeklyNeed(type) / C.time.week : 0;
        const want = Math.floor(this.owed[type]);
        if (want < 1) { if (!staffed) this._short(type, false); continue; }
        const got = Math.min(want, Math.floor(this.stock[type] || 0));
        this.stock[type] -= got; this.owed[type] -= want;
        this._short(type, got < want);
      }
    },
    _short(type, on) {
      const k = SUPPLY_OF[type] || 'rations';
      if (this.short[k] === on) return;
      this.short[k] = on;
      const name = C.supplies[type].name.toLowerCase();
      if (on) this.say(type === 'rations' ? 'colonists' : k, type === 'rations' ? 'The ration lockers are empty. People are going hungry, Commander.' : `We are out of ${name}, Commander. The stores have none to issue.`, { warn: true });
      else if (this.t > 5) this.say(type === 'rations' ? 'colonists' : k, `${cap(name)} is back on the shelves.`, { dim: true });
    },
    _weekly() {
      const capNow = this.capability(), gain = capNow - this.lastWeek.cap;
      const shorts = Object.entries(this.short).filter(([, x]) => x).map(([k]) => k === 'rations' ? 'rations' : C.supplies[C.div[k].uses].name.toLowerCase());
      if (!this.sandbox) this.say('ministry', `Week ${this.week() - 1} report. Capability ${capNow} (${gain >= 0 ? '+' : ''}${gain}). ${this.weekIn} crates into the stores. ${shorts.length ? `Short of: ${shorts.join(', ')}.` : 'No shortages.'}`, { gold: gain > 0 && !shorts.length });
      this.lastWeek = { in: this.weekIn, cap: capNow }; this.weekIn = 0;
      // and the one thing most worth doing next, so growing is never a guess
      if (!this.sandbox && !this._noAdvice) { const ask = this.asks().find((x) => !x.urgent); if (ask) this.say(ask.from === 'colonists' ? 'colonists' : ask.from, `Asked of you this week. ${ask.text} ${ask.why}`); }
      this.events.push({ type: 'week', week: this.week() });
      if (!this.sandbox) this._allotAsk();
    },
    // A faction with more places than its allotment keeps on duty asks for more, at the start of a week.
    _allotAsk() {
      if (this.requests.length >= C.faction.pending) return;
      const F = this._factionKeys().filter((k) => !this.requests.some((r) => r.k === k)).map((k) => {
        const d = C.div[k], want = Math.min(C.allotMax, this.homes[d.staff] * d.per);
        return { k, d, want, gap: want - this.div[k].allot };
      }).filter((x) => x.gap >= x.d.per).sort((a, b) => b.gap - a.gap);
      const x = F[0];
      if (!x) return;
      const to = Math.min(x.want, this.div[x.k].allot + x.d.per * 2), sup = C.supplies[x.d.uses], n = Math.floor(to / x.d.per);
      const total = Object.keys(SUPPLY_OF).reduce((s, t) => s + this.weeklyNeed(t), 0) + this.weeklyNeed('rations');
      const tight = this.lastWeek.in > 0 && total + (to - this.div[x.k].allot) > this.lastWeek.in;
      // When the stores cannot cover it, someone else has to give something up: that is the choice.
      const rival = tight ? this._factionKeys().filter((k) => k !== x.k && this.div[k].allot >= C.div[k].per * 2).sort((a, b) => this.sat[b] - this.sat[a])[0] : null;
      const text = `${C.factions[x.k].who} asks to raise its weekly ${sup.name.toLowerCase()} from ${this.div[x.k].allot} to ${to} ${sup.unit}, enough to keep ${n} on duty.`
        + (rival ? ` The stores took in ${this.lastWeek.in} crates last week and cannot cover it unless ${C.factions[rival].who} gives up ${to - this.div[x.k].allot}.` : '');
      this._ask({ k: x.k, kind: 'allot', to, rival, text, options: rival ? ['APPROVE', `TAKE IT FROM ${C.factions[rival].who.toUpperCase()}`, 'DENY'] : ['APPROVE', 'DENY'] });
    },
    _factionKeys() { return Object.keys(C.factions).filter((k) => this.roomOpen(C.factions[k].room)); },

    // ------------------------------------------------------------------------------------------------ what reaches the commander
    _ask(r) {
      const req = { id: this.nextId++, t: 0, options: ['APPROVE', 'DENY'], ...r };
      this.requests.push(req);
      this.say(req.k, req.text, { request: req.id, options: req.options });
      return req;
    },
    // The place a faction would like a room: the part furthest from what it has, or the first it has none for.
    _needPoint(k) {
      const act = this._active(), fb = this.berths('freighter').map((p) => p.id), room = C.factions[k].room;
      const have = k === 'supply' ? [...this.cargoIds] : this._withRoom(room);
      let subjects;
      if (k === 'supply' || k === 'security') subjects = fb;
      else if (k === 'maintenance') subjects = act.filter((p) => !['command', 'core', 'longcore', 'junction', 'truss', 'node', 'tube'].includes(p.type)).map((p) => p.id);
      else if (k === 'medical') subjects = this.residents() ? act.filter((p) => p.rooms.some((r) => C.rooms[r].beds)).map((p) => p.id) : [];
      else if (k === 'command') subjects = [this.root];
      else if (k === 'gunnery') subjects = act.filter((p) => C.parts[p.type].sys).map((p) => p.id);
      else subjects = act.filter((p) => ['spire', 'dish', 'dome', 'blister'].includes(p.type)).map((p) => p.id);
      if (!subjects.length) return k === 'science' && !have.length ? { part: this.root, far: Infinity } : null;
      if (!have.length) return { part: subjects[0], far: Infinity };
      const dm = this.distMap(have);
      let worst = null;
      for (const id of subjects) { const d = dm.get(id) ?? 99; if (!worst || d > worst.far) worst = { part: id, far: d }; }
      return worst.far > C.faction.farUnits ? worst : null;
    },
    _slotFor(p, kinds) {
      const taken = new Set(this.requests.filter((r) => r.part === p.id).map((r) => r.slot));
      if (kinds.includes('empty')) { const i = p.rooms.findIndex((r, j) => r === 'empty' && !taken.has(j)); if (i >= 0) return { slot: i, kind: 'empty' }; }
      if (kinds.includes('quarters')) {
        const beds = p.rooms.reduce((s, r) => s + (C.rooms[r].beds || 0), 0), housed = this.agents.filter((a) => a.role === 'resident' && a.home === p.id && !a.leaving).length;
        if (beds - housed >= 2) { const i = p.rooms.findIndex((r, j) => r === 'quarters' && !taken.has(j)); if (i >= 0) return { slot: i, kind: 'quarters' }; }
      }
      return null;
    },
    // One faction, the least happy first, tries to get what it needs: it takes an empty space itself, asks for quarters, or,
    // when another faction holds the only space near enough, the two of them bring it to the commander.
    _propose() {
      const F = C.faction, order = this._factionKeys().filter((k) => !this.requests.some((r) => r.k === k)).sort((a, b) => this.sat[a] - this.sat[b]);
      for (const k of order) {
        const room = C.factions[k].room, cost = C.rooms[room].cost, who = C.factions[k].who, ask = C.factions[k].ask;
        if (this.credits < cost) continue;
        const need = this._needPoint(k);
        if (!need) continue;
        const dm = this.distMap([need.part]), near = this._active().filter((p) => !p.fault && dm.has(p.id) && dm.get(p.id) <= (need.far === Infinity ? 40 : need.far * 0.6)).sort((a, b) => dm.get(a.id) - dm.get(b.id));
        for (const p of near) {
          const s = this._slotFor(p, ['empty']);
          if (s && cost <= F.autoCost && cost <= this.credits * F.autoShare) {
            if (!this.setRoom(p.id, s.slot, room, k, k).ok) continue;
            this.stats.auto++;
            this.say(k, `${who} has set up ${ask} in ${this.name(p)}, where it was needed. ${cost} CR from station funds.`, { auto: true });
            this.events.push({ type: 'auto', k, part: p.id, slot: s.slot });
            return true;
          }
          if (s) { this._ask({ k, kind: 'room', part: p.id, slot: s.slot, room, was: 'empty', cost, text: `Commander, ${who} requests ${ask} in ${this.name(p)} (${cost} CR). ${this.why[k]}` }); return true; }
        }
        for (const p of near) {
          const s = this._slotFor(p, ['quarters']);
          if (s) { this._ask({ k, kind: 'room', part: p.id, slot: s.slot, room, was: 'quarters', cost, text: `Commander, ${who} wants to turn spare quarters in ${this.name(p)} into ${ask} (${cost} CR). ${this.why[k]}` }); return true; }
        }
        // Nothing free: is another faction sitting where this one wants to be?
        for (const p of near) {
          for (let i = 0; i < p.rooms.length; i++) {
            const other = p.marks[i] || this._ownerOf(p.rooms[i]);
            if (!other || other === k || this.requests.some((r) => r.part === p.id && r.slot === i)) continue;
            if (this.roomCount(p.rooms[i]) < 2) continue;                 // never their last one
            const key = `${k}:${p.id}:${i}`;
            if (this.asked.has(key)) continue;
            this.asked.add(key);
            this._ask({ k, kind: 'conflict', part: p.id, slot: i, room, was: p.rooms[i], other, cost,
              text: `${who} wants ${C.factions[other].who}'s ${C.rooms[p.rooms[i]].name} in ${this.name(p)} turned into ${ask} (${cost} CR). ${this.why[k]} ${C.factions[other].who} objects.`,
              options: [`SIDE WITH ${who.toUpperCase()}`, `SIDE WITH ${C.factions[other].who.toUpperCase()}`] });
            return true;
          }
        }
      }
      return false;
    },
    _ownerOf(room) { return { cargostore: 'supply', workshop: 'maintenance', secoffice: 'security', medbay: 'medical', brass: 'command', lab: 'science' }[room] || null; },
    _meddled(owner, p, room) {
      this.favor[owner] = Math.max(-25, this.favor[owner] + C.faction.meddle);
      if (this.timers.grumble <= 0) { this.timers.grumble = 20; this.say(owner, `Commander, that was our ${C.rooms[room].name} in ${this.name(p)}. Noted.`, { dim: true }); }
    },
    _dilemma() {
      if (this.requests.length >= C.faction.pending) return;
      const pool = this.rng.shuffle([...DILEMMAS]);
      for (const D of pool) {
        if (D.urgent || this.requests.some((r) => r.dilemma === D.id)) continue;
        const cast = D.need(this);
        if (!cast || !cast.a || !cast.b) continue;
        const opts = D.opts.filter((o) => !o.need || this.roomCount(o.need) > 0);
        this._ask({ k: 'command', kind: 'dilemma', dilemma: D.id, cast: [cast.a.id, cast.b.id], opts: opts.map((o) => D.opts.indexOf(o)), text: D.text(cast, this), options: opts.map((o) => o.label), from: 'desk' });
        return;
      }
    },
    _requests(dt) {
      if (this.sandbox) return;
      const F = C.faction;
      this.timers.grumble -= dt;
      for (const r of [...this.requests]) {
        r.t += dt;
        if (r.t < F.ttl) continue;
        this._close(r, 'expired');
        if (r.kind === 'dilemma') this.say('command', 'The matter on your desk settled itself, Commander. Nobody is pleased.', { dim: true });
        else { this.favor[r.k] += F.ignore; this.say(r.k, 'No answer on our request, Commander. We will remember that.', { warn: true }); }
      }
      if ((this.timers.request -= dt) <= 0) {
        this.timers.request = this.rng.range(F.requestSec[0], F.requestSec[1]);
        if (this.requests.length < F.pending) this._propose();
      }
      // smuggled goods in the habs come to the desk at any tier, and before anything else (once every two days at most)
      if (this.unrest >= 12 && this.t - (this.contraAsk ?? -1e9) > 2 * C.time.daySec && !this.requests.some((r) => r.dilemma === 'contraband')) { const D = DILEMMAS[0], c = D.need(this); if (c && c.a && c.b && this.requests.length < C.faction.pending + 1) { this.contraAsk = this.t; this._ask({ k: 'security', kind: 'dilemma', dilemma: D.id, cast: [c.a.id, c.b.id], opts: [0, 1, 2], text: D.text(c, this), options: D.opts.map((o) => o.label), from: 'desk' }); } }
      if (this.tier >= 1 && (this.timers.dilemma -= dt) <= 0) { this.timers.dilemma = this.rng.range(F.dilemmaSec[0], F.dilemmaSec[1]); this._dilemma(); }
    },
    _close(r, outcome, label) { this.requests.splice(this.requests.indexOf(r), 1); this.reqLog.push({ k: r.k, kind: r.kind, outcome, t: this.t }); this.events.push({ type: 'request', id: r.id, outcome, label }); },
    _favor(k, x) { if (k in this.favor) this.favor[k] = Math.max(-25, Math.min(25, this.favor[k] + x)); },
    // Answer what is on the desk: `i` is the option's place in the request's `options`.
    answer(id, i) {
      const r = this.requests.find((x) => x.id === id), F = C.faction;
      if (!r) return { ok: false, why: 'That has closed.' };
      const label = r.options[i];
      if (r.kind === 'room' || r.kind === 'conflict') {
        const p = this.parts.get(r.part), who = C.factions[r.k].who;
        if (!p || p.state !== 'active' || p.rooms[r.slot] !== r.was) { this._close(r, 'void'); return { ok: false, why: 'That space has changed since.' }; }
        if (i === 0) {
          const res = this.setRoom(r.part, r.slot, r.room, r.k, r.k);
          if (!res.ok) return res;
          this._close(r, 'approved', label); this._favor(r.k, F.approve);
          if (r.other) { this.asked.add(`${r.other}:${r.part}:${r.slot}`); this._favor(r.other, -10); this.say(r.other, `So ${who} gets our space in ${this.name(p)}. Understood, Commander.`, { dim: true }); }
          this.say(r.k, `Thank you, Commander. ${cap(C.factions[r.k].ask)} is going into ${this.name(p)}, marked for ${who}.`, { gold: true });
        } else {
          this._close(r, 'denied', label); this._favor(r.k, F.deny);
          if (r.other) { this._favor(r.other, 6); this.say(r.other, 'Thank you for standing by us, Commander.', {}); }
          this.say(r.k, 'Understood, Commander. The answer is no. We will make do.', { dim: true });
        }
      } else if (r.kind === 'allot') {
        const d = C.div[r.k], add = r.to - this.div[r.k].allot;
        if (label === 'DENY') { this._close(r, 'denied', label); this._favor(r.k, F.deny); this.say(r.k, 'Understood. We will stretch what we have.', { dim: true }); }
        else {
          if (i === 1 && r.rival) { this.setAllot(r.rival, this.div[r.rival].allot - add); this._favor(r.rival, -10); this.say(r.rival, `Our ${C.supplies[C.div[r.rival].uses].name.toLowerCase()} cut to feed ${C.factions[r.k].who}. Noted, Commander.`, { warn: true }); }
          this.setAllot(r.k, r.to); this._close(r, 'approved', label); this._favor(r.k, 8);
          this.say(r.k, `Allotment raised to ${r.to} ${C.supplies[d.uses].unit} a week. Thank you, Commander.`, { gold: true });
        }
      } else if (r.kind === 'dilemma') {
        const D = DILEMMAS.find((x) => x.id === r.dilemma), o = D.opts[r.opts[i]];
        for (const [k, x] of Object.entries(o.fx || {})) this._favor(k, x);
        if (o.unrest) this.unrest = Math.max(0, this.unrest + o.unrest);
        if (o.credits && !this.sandbox) this._money(o.credits, 'desk');
        if (o.research) this.stats.research += o.research;
        for (const [t, x] of Object.entries(o.stock || {})) this.stock[t] = Math.max(0, (this.stock[t] || 0) + x);
        r.cast.forEach((aid, j) => this.note(this.agents.find((a) => a.id === aid), o.note[j]));
        this._close(r, 'approved', label);
        if (o.say) this.say(o.say[0], o.say[1], {});
      }
      return { ok: true, why: '' };
    },
    approve(id) { return this.answer(id, 0); },
    deny(id) { const r = this.requests.find((x) => x.id === id); return this.answer(id, r ? r.options.length - 1 : 1); },

    // ------------------------------------------------------------------------------------------------ raids
    raidStrength() { return C.raid.base + C.raid.perTier * this.tier; },
    callRaid() { if (!this.raid) this._raidStart(); },
    _raidStart() {
      const R = C.raid, s = Math.round(this.raidStrength() * this.rng.range(0.8, 1.3));
      this.raid = { state: 'warn', t: 0, strength: s, seed: this.rng.next(), n: 3 + Math.min(5, Math.floor(s / 4)) };
      this.say('security', `Raiders inbound, Commander: ${this.raid.n} ships, strength about ${s}. Our defence is ${this._defence()}. ${R.warnSec} seconds.`, { warn: true });
      this.events.push({ type: 'raid', state: 'warn' });
    },
    _defence() { return Math.round(this.defence + this.staff.officer * 0.5); },
    _raids(dt) {
      const R = C.raid;
      if (!this.raid) {
        if (this.sandbox || this.tier < 1) return;
        if ((this.timers.raid -= dt) <= 0) { this.timers.raid = this.rng.range(R.everySec[0], R.everySec[1]); this._raidStart(); }
        return;
      }
      const r = this.raid; r.t += dt;
      if (r.state === 'warn' && r.t >= R.warnSec) { r.state = 'fight'; r.t = 0; this.events.push({ type: 'raid', state: 'fight' }); }
      else if (r.state === 'fight' && r.t >= R.fightSec) {
        const def = this._defence(), hits = Math.max(0, Math.min(R.maxHits, Math.ceil((r.strength - def) / R.perHit)));
        const targets = this.rng.shuffle(this._active().filter((p) => !p.fault && !['command', 'core', 'longcore', 'junction', 'truss', 'node', 'tube'].includes(p.type))).slice(0, hits);
        for (const p of targets) { p.fault = true; this.stats.faults++; }
        if (targets.length) {
          this.stats.raidsLost++; this.unrest += 4 * targets.length; this._favor('security', -6); this._refresh();
          this.say('security', `The raiders are gone. They hit ${targets.map((p) => this.name(p)).join(', ')}. We needed ${r.strength - def} more defence, Commander.`, { warn: true });
        } else {
          this.stats.raidsWon++; this._favor('security', 8);
          this.say('security', `Raid driven off with no damage. Defence ${def} against ${r.strength}. The gun crews send their regards.`, { gold: true });
          for (const a of this.agents) if (a.role === 'officer') this.note(a, 'Stood to during a raid that was driven off.');
        }
        this.events.push({ type: 'raid', state: 'over', hits: targets.map((p) => p.id) });
        this.raid = null;
      }
    },

    // ------------------------------------------------------------------------------------------------ the daily round
    _story(dt) {
      const day = Math.floor(this.t / C.time.daySec);
      if (day !== this.day) {
        const wk = this.week();
        this.day = day; this._draw(); this.events.push({ type: 'day', day });
        if (this.week() !== wk) this._weekly();
      }
      if (this.staff.scientist) this.stats.research += dt / 60 * C.researchPerMin * this.staff.scientist * this.mood('scientist') * (this.short.science ? 0.4 : 1);
      this._raids(dt);
      if (this.goal && !this.goal.done) this._goal();
    },

    // ------------------------------------------------------------------------------------------------ the Broken Station
    // An old station the last commander walked away from: most of it dark, half its rooms stripped, a handful of people left.
    _wreck() {
      const add = (type, host, port, rot = 0) => {
        const h = this.parts.get(host), pl = this.placement(type, h, port, rot), p = this._make(type, h.id, port, rot, pl.pos, pl.quat);
        h.used.add(port); h.kids.push(p.id); p.state = 'active'; p.prog = 1; return p.id;
      };
      this.tier = 1; this.radius = C.tiers[1].radius; this.credits = 900;
      const c1 = add('core', 1, 1), re = add('reactor', c1, 1), c2 = add('longcore', re, 1), rg = add('ring', c2, 1); add('spire', rg, 1);
      const c0 = add('core', 1, 0); add('dome', c0, 1);
      const h1 = add('hab', 1, 2), h2 = add('hab', 1, 4), tr = add('truss', 1, 3); add('dockport', tr, 1); const cg = add('cargo', 1, 5);
      add('dockport', cg, 1); add('solar', c1, 2, 2); add('solar', c1, 4, 2);
      add('blister', h1, 1); add('tanks', h2, 1); add('dish', c0, 3); add('turret', c0, 5);
      // Strip rooms and break parts, but leave Station Command, one dock, the cargo module and the first hab working.
      const keep = new Set([this.root, cg, h1]);
      let dock = 0;
      for (const p of this.parts.values()) {
        if (p.type === 'dockport' && !dock) { dock = p.id; keep.add(p.id); }
        p.rooms = p.rooms.map((r, i) => keep.has(p.id) ? r : (this.rng.chance(0.55) ? 'empty' : r));
        if (!keep.has(p.id) && !['core', 'longcore', 'truss'].includes(p.type) && this.rng.chance(0.9)) p.fault = true;
      }
      for (const k of Object.keys(C.supplies)) this.stock[k] = 4;
      this.stock.parts = 8;
      this._refresh();
      this.addColonists(4);
      const total = [...this.parts.values()].filter((p) => p.fault).length;
      this.goal = { kind: 'restore', total, done: false, empty: [...this.parts.values()].reduce((n, p) => n + p.rooms.filter((r) => r === 'empty').length, 0) };
      this.say('ministry', `Commander, welcome to what is left of this station. ${total} parts are dark, half the rooms are stripped, and the stores are nearly bare. Bring it back.`, { gold: true });
    },
    goalItems() {
      if (!this.goal) return [];
      const dark = [...this.parts.values()].filter((p) => p.fault).length, empty = [...this.parts.values()].reduce((s, p) => s + p.rooms.filter((r) => r === 'empty').length, 0);
      return [{ label: 'Parts repaired', have: this.goal.total - Math.min(this.goal.total, dark), need: this.goal.total }, { label: 'Residents', have: this.residents(), need: 20 },
        { label: 'Stripped rooms refitted', have: Math.max(0, this.goal.empty - empty), need: Math.min(8, this.goal.empty) }, { label: 'Power', have: Math.round(this.eff * 100), need: 100 }].map((i) => ({ ...i, ok: i.have >= i.need }));
    },
    _goal() {
      if (this.t < 5 || !this.goalItems().every((i) => i.ok)) return;
      this.goal.done = true; this.stats.raidsWon += 2;
      this.say('ministry', 'STATION RESTORED. Every part lit, the decks refitted, people aboard. The Ministry has taken notice, Commander.', { gold: true });
      this.events.push({ type: 'restored' });
    },

    // ------------------------------------------------------------------------------------------------ saving
    save() {
      const skip = new Set(['events', 'rng', 'target', '_clashMemo', '_clashVer']);
      const enc = (x) => x instanceof Map ? { __m: [...x].map(([k, y]) => [k, enc(y)]) } : x instanceof Set ? { __s: [...x] }
        : Array.isArray(x) ? x.map(enc) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([k]) => k[0] !== '_').map(([k, y]) => [k, enc(y)])) : x === Infinity ? '__inf' : x;
      const out = { v: C.version, rng: this.rng.s };
      for (const [k, x] of Object.entries(this)) if (!skip.has(k)) out[k] = enc(x);
      return out;
    },
  });
  // Rebuild a station from what save() returned. Null if it is not one of ours.
  Station.load = (data) => {
    if (!data || !data.parts || !data.div || String(data.v).split('.').slice(0, 2).join('.') !== C.version.split('.').slice(0, 2).join('.')) return null;
    const dec = (x) => x && x.__m ? new Map(x.__m.map(([k, y]) => [k, dec(y)])) : x && x.__s ? new Set(x.__s)
      : Array.isArray(x) ? x.map(dec) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, dec(y)])) : x === '__inf' ? Infinity : x;
    const st = Object.create(Station.prototype);
    for (const [k, x] of Object.entries(data)) if (k !== 'v' && k !== 'rng') st[k] = dec(x);
    st.rng = new RNG(1); st.rng.s = data.rng; st.events = [];
    st._refresh();
    return st;
  };
  void v; void q;
}
