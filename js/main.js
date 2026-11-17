// Boot, the main loop, input and the HUD. The simulation (sim.js) never touches the page; the view (view.js) draws it.
import { C } from './config.js';
import { Station } from './sim.js';
import { View } from './view.js';
import { partIcon, SLOTS } from './parts.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];      // parts in the open group; the letters are for the camera
const VIEWS = ['blueprint', 'hull', 'life'];
// Camera keys held down right now: W A S D along the deck, Space up, Shift down, Q and E to swing round.
const held = new Set(), FLY = new Set(['w', 'a', 's', 'd', 'q', 'e', ' ', 'shift']);          // the parts of the open group, left to right
const GROUP_SHORT = { platform: 'FIRE', structure: 'STRUCT', habitation: 'HAB', docking: 'DOCK', industry: 'INDUS', power: 'POWER', defence: 'DEF', comms: 'COMMS' };
const ROLE = { hauler: 'haulers', engineer: 'engineers', officer: 'officers', medic: 'medics', aide: 'aides', scientist: 'scientists', gunner: 'gunners' };
const ROLE_ONE = { hauler: 'Hauler', engineer: 'Engineer', officer: 'Democracy Officer', medic: 'Medic', aide: 'Aide', scientist: 'Scientist', gunner: 'Gunner', resident: 'Resident' };
const PLACES = { hauler: 'Cargo Stores, Cargo Racks and Station Command', engineer: 'Workshops', officer: 'Security Offices', medic: 'Medbays', aide: 'Brass Suites', scientist: 'Laboratories', gunner: 'Gun Crew Rooms, Barrack Rooms, pads and racks' };
const SAVE_KEY = 'sos.save.06', LIVERY_KEY = 'sos.livery';
// What people say, in a bubble over their head, when you are close enough to see them.
const CHAT = {
  hauler: ['Mind your toes.', 'Another crate of liberty.', 'Who labelled this?', 'Coffee first. Then crates.', 'This one rattles.'],
  engineer: ['It was like that when I got here.', 'Hand me the big wrench.', 'Hull is load-bearing. Mostly.', 'Who signed off on this weld?', 'Parts. I need parts.'],
  officer: ['Papers, citizen.', 'Move along.', 'Report unpatriotic activity.', 'I am watching that crate.', 'Democracy never sleeps. Neither do I.'],
  medic: ['Next.', 'Take two and report for gratitude.', 'That will heal. Probably.', 'Wash your hands, citizen.', 'I need more medkits.'],
  aide: ['The admiral will notice that.', 'This corridor is a disgrace.', 'Has anyone seen the good cutlery?', 'Smile. There is an inspection.', 'File it in triplicate.'],
  gunner: ['Shot out.', 'Splash, over.', 'Who moved my ear defenders?', 'Danger close means close.', 'Tell the Tigers it is on the way.', 'More shells. Always more shells.'],
  scientist: ['Fascinating.', 'That reading cannot be right.', 'Do not touch that.', 'The planet is doing something.', 'I will need a bigger dish.'],
  resident: ['Long queue at the mess again.', 'Lovely view of the war today.', 'Have you paid your Liberty Contribution?', 'They moved the bar again.', 'I heard a rumour about the coffee.', 'My bunk hums.'],
};
const ORDER_NAMES = { rations: 'RATIONS', shift: 'SHIFTS', plan: 'MAINTENANCE PLAN', checks: 'SHIP INSPECTIONS', care: 'MEDICAL CARE', mix: 'TRAFFIC MIX', rate: 'TRAFFIC VOLUME', broadcast: 'BROADCAST' };
// Radio channels: who is talking, on which channel, in which colour, and how they sign off.
const CH = {
  ministry:    { n: 1, name: 'MINISTRY OF ORBITAL AFFAIRS', col: '#ffe600', off: ['For Super Earth.', 'Liberty prevails.', 'Ministry out.'] },
  traffic:     { n: 2, name: 'TRAFFIC CONTROL', col: '#e6e6e6', off: ['Control out.', 'Keep the lanes clear.', 'Control standing by.'] },
  supply:      { n: 3, name: 'MINISTRY OF SUPPLY', col: C.div.supply.col, off: ['Supply out.', 'Every crate counts.'] },
  maintenance: { n: 4, name: 'PATRIOTIC MAINTENANCE', col: C.div.maintenance.col, off: ['Maintenance out.', 'Wrenches up.'] },
  security:    { n: 5, name: 'DEMOCRACY OFFICERS', col: C.div.security.col, off: ['Stay vigilant.', 'Report unpatriotic activity.'] },
  truth:       { n: 6, name: 'MINISTRY OF TRUTH', col: C.div.truth.col, off: ['This message has been approved.', 'Truth out.'] },
  colonists:   { n: 7, name: 'CIVILIAN BAND', col: '#b9e6c8', off: ['', 'Thank you for your service.'] },
  medical:     { n: 8, name: 'MEDICAL CORPS', col: C.div.medical.col, off: ['Corps out.', 'Stay healthy, stay free.'] },
  command:     { n: 10, name: 'COMMAND STAFF', col: C.div.command.col, off: ['By your leave, Commander.', 'Staff out.'] },
  science:     { n: 11, name: 'SCIENCE DIRECTORATE', col: C.div.science.col, off: ['Directorate out.', 'More data soon.'] },
  gunnery:     { n: 12, name: 'FIRE SUPPORT COMMAND', col: C.div.gunnery.col, off: ['Guns out.', 'On the way.', 'Standing by for calls.'] },
  captain:     { n: 9, name: 'SHIP-TO-STATION', col: '#7fc8ff', off: ['Over.', 'Over and out.', 'For democracy, over.'] },
};
const audio = new Audio();
const ui = { started: false, tool: null, rot: 0, hot: null, sel: null, paused: false, speed: 1, view: 'hull', cut: false, open: false, follow: 0, group: 'structure',
  edit: null, room: null, slot: null, px: null, py: null, portsDirty: false, dots: true, clean: false, div: 'ledger', comms: true, person: 0 };

// ---------------------------------------------------------------- the title backdrop: an example station, turning slowly
function demoStation() {
  const s = new Station(3, 'sandbox');
  const b = (t, h, p, r = 0) => { const x = s.build(t, h, p, r); return x.ok ? x.id : 0; };
  const c1 = b('core', 1, 1), re = b('reactor', c1, 1); b('spire', re, 1);
  b('solar', c1, 2); b('solar', c1, 4); b('dish', c1, 3); b('billboard', c1, 5);
  // Below Station Command, toward the planet: a ring, the docking ring, the promenade, and the platform's guns underneath.
  const ring = b('ring', 1, 0), c2 = b('core', ring, 0), big = b('bigring', c2, 0), disc = b('disc', big, 0), c3 = b('core', disc, 0);
  for (const p of [2, 3, 4, 5]) b('dockport', ring, p);
  b('pylon', big, 2); b('hangar', big, 3); b('pylon', big, 4); b('drydock', big, 5); b('eaglehangar', big, 6); b('tanks', big, 7);
  b('battery', c2, 2); b('battery', c2, 4); b('barracks', c2, 3); b('dronebay', c2, 5);
  b('battery', c3, 2); b('battery', c3, 4); b('gunmount', c3, 0); b('relay', c3, 3); b('fabshop', c3, 5);
  b('cargo', 1, 2); b('hab', 1, 3); b('hab', 1, 4); b('cargo', 1, 5);
  for (let i = 0; i < 44; i++) s.step(0.5);
  s.addColonists(30);
  return s;
}
let st = demoStation();
const view = new View($('view'), st);
window.__view = view;
view.newSky(st.seed);
view.setMode('hull');
view.controls.autoRotate = true; view.controls.autoRotateSpeed = 0.5;
view.camera.position.set(34, 16, 40);

// ---------------------------------------------------------------- start
function start(mode, saved) {
  audio.unlock();
  st = saved || new Station(Number(qs.get('seed')) || (Date.now() % 100000), mode);
  st._noAdvice = !SET.advice;
  mode = st.mode;
  window.__st = st; window.__ui = ui; window.__edit = startEdit; window.__follow = setFollow;
  view.setStation(st);
  st.livery = { ...loadLivery(), ...(st.livery || {}) }; view.setLivery(st.livery);
  view.controls.autoRotate = false;
  view.frame();
  Object.assign(ui, { started: true, tool: null, sel: null, hot: null, edit: null, room: null, slot: null, group: 'structure', speed: 1, person: 0 });
  setView('hull'); setCut(false); setOpen(false); setClean(false);
  $('s-title').classList.remove('on'); $('hud').classList.remove('hidden');
  $('b-speed').textContent = '1×';
  const free = mode === 'sandbox';
  $('b-sim').classList.toggle('hidden', !free);
  closeFloats(null);
  simPanel(free && innerHeight > 520, true);
  $('t-traffic').classList.add('on'); $('t-traffic').textContent = 'TRAFFIC ON';
  $('c-list').innerHTML = ''; typing.length = 0; reqEls.clear(); deskSig = ''; setComms(true); clearBubbles();
  if (saved) radio('ministry', `Welcome back, Commander. Week ${st.week()}, day ${st.dow()}. The station kept your seat warm.`);
  else if (free) radio('ministry', 'Free play, Commander. Every part and every room is open to you, and none of it costs a credit. Build whatever you like.');
  else if (mode === 'run') radio('ministry', `Welcome aboard, Commander. The Ministry grants you an Outpost permit and ${C.start.credits.toLocaleString('en-US')} CR. This station is here to support the troops on the planet below. Start with a Ship Gun from FIRE SUPPORT, a Docking Port, and somewhere to put the cargo.`);
  if (!saved) radio('ministry', free ? 'Your divisions answer on the Commander\'s channel (O). Select a part and press EDIT INSIDE (I) to build out its rooms.' : 'Lay the station out, then let your people at it. They will change it to suit themselves, and only trouble will reach your desk.', { dim: true });
  buildGrid(); hud(); info();
}
function loadLivery() { try { return { ...C.livery.def, ...(JSON.parse(localStorage.getItem(LIVERY_KEY)) || {}) }; } catch (e) { return { ...C.livery.def }; } }
const readSave = () => { try { return Station.load(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch (e) { return null; } };
function writeSave() { if (!ui.started || st.sandbox) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(st.save())); lastSave = performance.now(); } catch (e) { /* no storage here: the game plays on without saving */ } }
function titleButtons() { $('b-continue').classList.toggle('hidden', !readSave()); $('b-economy').classList.toggle('primary', !readSave()); }
titleButtons();
$('b-economy').onclick = () => start('run');
$('b-broken').onclick = () => start('broken');
$('b-free').onclick = () => start('sandbox');
$('b-continue').onclick = () => { const s = readSave(); if (s) start(s.mode, s); else titleButtons(); };
$('b-restart').onclick = () => {
  $('s-menu').classList.remove('on'); if (ui.paused) pause(false); endEdit(); setTool(null);
  closeFloats(null); $('simpanel').classList.add('hidden');
  writeSave(); ui.started = false; setClean(false); $('hud').classList.add('hidden'); $('s-title').classList.add('on'); clearBubbles(); titleButtons();
  st = demoStation(); view.setStation(st); view.setMode('hull'); view.setCutaway(false); view.setOpen(false); view.controls.autoRotate = true; view.camera.position.set(34, 16, 40); view.controls.target.set(0, 0, 0);
};

// ---------------------------------------------------------------- the build panel: groups of parts, like a corvette builder
const partsOf = (g) => Object.keys(C.parts).filter((t) => C.parts[t].group === g && !C.parts[t].fixed);
function buildGrid() {
  const tabs = $('groups'); tabs.innerHTML = ''; tabs.classList.remove('hidden');
  for (const g of C.groups) {
    const b = document.createElement('button');
    b.className = 'gt'; b.type = 'button'; b.dataset.g = g.id; b.textContent = GROUP_SHORT[g.id]; b.title = `${g.name} · Tab for the next group`;
    b.onclick = () => { audio.play('click'); ui.group = g.id; buildGrid(); };
    tabs.appendChild(b);
  }
  const grid = $('cmd'); grid.innerHTML = ''; grid.classList.remove('pal');
  partsOf(ui.group).forEach((t, i) => {
    const b = document.createElement('button'), d = C.parts[t];
    b.className = 'cb'; b.type = 'button'; b.dataset.t = t;
    const pic = view.thumb(t);
    b.innerHTML = `${pic ? `<img src="${pic}" alt="">` : partIcon(t)}<kbd>${KEYS[i].toUpperCase()}</kbd><span class="cn">${d.name}</span><span class="cc">${d.cost}</span>`;
    b.title = `${d.name} · ${d.cost} CR`;
    b.onclick = () => { audio.unlock(); setTool(ui.tool === t ? null : t); };
    b.onpointerenter = () => { if (!ui.tool) info({ part: t }); };
    b.onpointerleave = () => { if (!ui.tool) info(null); };
    grid.appendChild(b);
  });
  gridState();
}
function gridState() {
  if (ui.edit) { paletteState(); return; }
  for (const b of $('cmd').children) {
    const t = b.dataset.t, d = C.parts[t], locked = !st.partOpen(t);
    b.classList.toggle('locked', locked); b.dataset.lock = locked ? C.tiers[d.tier].name : '';
    b.classList.toggle('poor', !locked && st.credits < d.cost);
    b.classList.toggle('on', ui.tool === t);
  }
  for (const b of $('groups').children) {
    b.classList.toggle('on', b.dataset.g === ui.group);
    b.classList.toggle('none', partsOf(b.dataset.g).every((t) => !st.partOpen(t)));
  }
}
function setTool(t) {
  if (t && !st.partOpen(t)) { audio.play('deny'); toast(`${C.parts[t].name} unlocks at ${C.tiers[C.parts[t].tier].name}. The UPGRADES panel (U) shows the way.`); return; }
  if (t && ui.edit) endEdit();
  ui.tool = t; ui.hot = null; infoPeek = null; audio.play('click'); hideTip();
  if (t) { select(null); if (C.parts[t].group !== ui.group) { ui.group = C.parts[t].group; buildGrid(); } }
  view.setGhost(null, null, 0);
  if (t) ui.portsDirty = true; else view.showPorts(null);
  gridState(); info();
}
function select(id) { ui.sel = id; ui.person = 0; ui.follow = 0; view.select(id); info(); }
// Click a person to read about them; click them again (or press F, or FOLLOW) and the camera stays with them.
function pickPerson(id) { if (ui.person === id && ui.follow !== id) { setFollow(id); return; } select(null); ui.person = id; audio.play('click'); info(); }
function setFollow(id) {
  audio.play('click');
  if (!id) { ui.follow = 0; info(); return; }
  if (ui.person !== id) { select(null); ui.person = id; }
  ui.follow = id;
  // so they can be seen: take the hull away if nothing else is showing the inside, and come in close
  if (!ui.edit && ui.view === 'hull' && !ui.open && !ui.cut) setOpen(true);
  const a = st.agents.find((x) => x.id === id); if (a) { view.lookAtAgent(a); view.closeIn(1.8); }
  info();
}

// ---------------------------------------------------------------- building out a part's insides, room by room
const canEdit = (id) => { const p = st.parts.get(id); return !!p && !!SLOTS[p.type] && p.state === 'active'; };
function startEdit(id) {
  if (!canEdit(id)) return;
  if (ui.tool) setTool(null);
  ui.edit = id; ui.room = null; ui.slot = null; ui.sel = id; infoPeek = null; view.select(id);
  view.editPart(id); buildPalette(); info(); audio.play('click');
}
function endEdit() {
  if (!ui.edit) return;
  ui.edit = null; ui.room = null; ui.slot = null;
  view.editPart(null); view.setSlotHot(null); view.select(ui.sel); buildGrid(); info();
}
function buildPalette() {
  $('groups').classList.add('hidden');
  const grid = $('cmd'); grid.innerHTML = ''; grid.classList.add('pal');
  for (const r of C.roomOrder) {
    const R = C.rooms[r], b = document.createElement('button');
    b.className = 'rb'; b.type = 'button'; b.dataset.r = r;
    b.innerHTML = `<i style="background:${R.col}"></i><b>${R.short || 'EMPTY'}</b><small>${R.cost ? `${R.cost}` : 'free'}</small>`;
    b.title = `${R.name}${R.about ? ` · ${R.about}` : ''}`;
    b.onclick = () => pickRoom(r);
    b.onpointerenter = () => info({ room: r });
    b.onpointerleave = () => info(null);
    grid.appendChild(b);
  }
  paletteState();
}
function paletteState() {
  const p = st.parts.get(ui.edit); if (!p) return;
  for (const b of $('cmd').children) {
    const r = b.dataset.r, R = C.rooms[r], locked = !st.roomOpen(r), na = !!R.bay && !C.parts[p.type].bay;
    b.classList.toggle('locked', locked); b.dataset.lock = locked ? C.tiers[R.tier].name : na ? 'BAYS ONLY' : '';
    b.classList.toggle('na', !locked && na);
    b.classList.toggle('poor', !locked && !na && st.credits < R.cost);
    b.classList.toggle('on', ui.room === r);
  }
}
function pickRoom(r) {
  audio.unlock();
  ui.room = ui.room === r && ui.slot == null ? null : r;
  if (ui.slot != null && ui.room) paint(ui.edit, ui.slot);
  else audio.play('click');
  paletteState(); info();
}
function paint(id, slot) {
  const r = st.setRoom(id, slot, ui.room);
  if (r.ok) audio.play('place');
  else if (r.why === 'Already that room') { if (st.refit(id, slot).ok) audio.play('click'); }      // the same room again: rearrange it
  else if (r.why) { audio.play('deny'); toast(r.why); }
  info();
}
function editClick(x, y) {
  const hit = view.pickSlot(x, y);
  if (hit) {
    if (ui.room && !(view.touch && ui.slot !== hit.slot)) paint(hit.part, hit.slot);
    ui.slot = hit.slot; view.setSlotHot(hit); audio.play('click'); info();
    return;
  }
  const id = view.pickPart(x, y);
  if (id && id !== ui.edit && canEdit(id)) { startEdit(id); return; }
  ui.slot = null; view.setSlotHot(null); info();
}

// ---------------------------------------------------------------- views
function setView(v) {
  ui.view = v; view.setMode(v);
  for (const b of document.querySelectorAll('.vb')) if (b.dataset.v !== 'cut' && b.dataset.v !== 'open') b.classList.toggle('on', b.dataset.v === v);
}
function setCut(on) { ui.cut = on; view.setCutaway(on); document.querySelector('.vb[data-v="cut"]').classList.toggle('on', on); }
// INSIDE takes the hull away and leaves its edges, so every deck can be seen from any side. It is a way of looking at the hull view.
function setOpen(on) { ui.open = on; view.setOpen(on); document.querySelector('.vb[data-v="open"]').classList.toggle('on', on); if (on && ui.view !== 'hull') setView('hull'); }
for (const b of document.querySelectorAll('.vb')) b.onclick = () => { audio.play('click'); if (b.dataset.v === 'cut') setCut(!ui.cut); else if (b.dataset.v === 'open') setOpen(!ui.open); else setView(b.dataset.v); };
function setDots(on = !ui.dots) {
  ui.dots = on; view.portMode = on ? 'near' : 'off'; ui.portsDirty = true;
  $('b-dots').textContent = on ? 'DOTS ON' : 'DOTS OFF'; $('b-dots').classList.toggle('on', on);
  if (!ui.tool) view.showPorts(null);
}
$('b-dots').onclick = () => { audio.play('click'); setDots(); };
// Hide everything but the station, for a clean look (and screenshots).
function setClean(on) {
  ui.clean = on;
  $('app').classList.toggle('clean', on); view.setOverlay(!on);
  $('cleanbar').classList.toggle('hidden', !on); hideTip(); if (on) clearBubbles(); $('app').classList.remove('peek'); peekT = 0;
  if (on && ui.tool) setTool(null);
  if (on && ui.edit) endEdit();
  if (on) { select(null); closeFloats(null); $('simpanel').classList.add('hidden'); view.showPorts(null); view.setGhost(null, null, 0); }
}
$('b-hide').onclick = () => { audio.play('click'); setClean(true); };
$('b-showui').onclick = () => { audio.play('click'); setClean(false); };
$('b-photo').onclick = () => {
  const a = document.createElement('a'); a.href = view.snapshot(performance.now() / 1000); a.download = `super-orbital-simulator-week-${st.week()}.png`; a.click(); audio.play('place');
};

// ---------------------------------------------------------------- pointer: a short press is a click, anything longer orbits
const cv = $('view');
let down = null;
cv.addEventListener('pointerdown', (e) => { audio.unlock(); view.touch = e.pointerType === 'touch'; down = { x: e.clientX, y: e.clientY, t: performance.now(), b: e.button }; });
cv.addEventListener('pointerup', (e) => {
  if (!down || !ui.started) { down = null; return; }
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 600, b = down.b;
  down = null;
  if (moved > 8 || !quick) return;
  if (b === 2) { if (ui.edit) { if (ui.room) { ui.room = null; paletteState(); info(); } else endEdit(); } else { setTool(null); select(null); } return; }
  click(e.clientX, e.clientY);
});
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointermove', (e) => {
  if (!ui.started) return;
  ui.px = e.clientX; ui.py = e.clientY; if (ui.tool) ui.portsDirty = true;
  if (e.buttons === 0 && e.pointerType !== 'touch') hover(e.clientX, e.clientY);
});
cv.addEventListener('pointerleave', () => { hideTip(); ui.px = ui.py = null; ui.portsDirty = true; });

let peekT = 0;
function click(x, y) {
  if (ui.clean) { $('app').classList.add('peek'); peekT = 3.5; return; }      // tap the station to bring the SHOW UI button back for a moment
  if (ui.edit) { editClick(x, y); return; }
  if (ui.tool) {
    const p = view.pickPort(x, y);
    if (!p) return;
    // On a touch screen the first tap shows the part in place; a second tap on the same port builds it.
    if (view.touch && !(ui.hot && ui.hot.part === p.part && ui.hot.i === p.i)) {
      ui.hot = p; view.setGhost(ui.tool, p, ui.rot); ui.portsDirty = true; portTip(p, x, y, 'Tap again to build');
      return;
    }
    const r = st.build(ui.tool, p.part, p.i, ui.rot);
    if (r.ok) { audio.play('place'); ui.hot = null; view.setGhost(null, null, 0); ui.portsDirty = true; hideTip(); }
    else { audio.play('deny'); toast(r.why); }
    return;
  }
  const who = view.pickAgent(x, y);
  if (who) { pickPerson(who); return; }
  const id = view.pickPart(x, y);
  select(id || null);
  if (id) audio.play('click');
}
function hover(x, y) {
  if (ui.clean) return;
  const tip = $('tip');
  if (ui.edit) {
    const hit = view.pickSlot(x, y);
    view.setSlotHot(hit || (ui.slot != null ? { part: ui.edit, slot: ui.slot } : null));
    if (hit) {
      const p = st.parts.get(hit.part), R = C.rooms[p.rooms[hit.slot] || 'empty'];
      let line = 'Pick a room on the left to build here';
      if (ui.room) { const chk = st.canRoom(hit.part, hit.slot, ui.room); line = chk.ok ? `Click: make it a ${C.rooms[ui.room].name} · ${C.rooms[ui.room].cost} CR` : `<span class="down">${chk.why}</span>`; }
      tip.innerHTML = `<b>Room ${hit.slot + 1} · ${R.name}</b><br>${line}`; showTip(x, y);
    } else hideTip();
    return;
  }
  if (ui.tool) {
    const p = view.pickPort(x, y);
    const same = p && ui.hot && p.part === ui.hot.part && p.i === ui.hot.i;
    if (!same) { ui.hot = p; ui.portsDirty = true; view.setGhost(ui.tool, p, ui.rot); }
    if (p) portTip(p, x, y, 'Click to build · R turns it'); else hideTip();
    return;
  }
  const who = view.pickAgent(x, y), pa = who && st.agents.find((a) => a.id === who);
  if (pa) { tip.innerHTML = `<b>${pa.name}</b> · ${ROLE_ONE[pa.role]}<br>${st.doing(pa)}`; showTip(x, y); return; }
  const id = view.pickPart(x, y);
  if (id) {
    const p = st.parts.get(id);
    tip.innerHTML = `<b>${st.name(p)}</b>${p.state === 'building' ? ' · building' : p.state === 'demolish' ? ' · coming down' : p.fault ? ' · <span class="down">fault</span>' : ''}`;
    showTip(x, y);
  } else hideTip();
}
function portTip(p, x, y, ok) {
  const chk = st.canBuild(ui.tool, p.part, p.i, ui.rot);
  // Building across a berth's approach is allowed (any shape is), but it shuts the berth, so it is said before the click.
  let shut = '';
  if (chk.ok) {
    const key = `${ui.tool}|${p.part}|${p.i}|${ui.rot}|${st.parts.size}`;
    if (!ui.bw || ui.bw.key !== key) { let names = []; try { names = view.berthWarn(ui.tool, st.placement(ui.tool, st.parts.get(p.part), p.i, ui.rot)); } catch (e) { names = []; } ui.bw = { key, names }; }
    if (ui.bw.names.length) shut = `<br><span class="down">No clear way in for ships: this would shut ${ui.bw.names.join(', ')}</span>`;
  }
  // and what its upkeep would do to the accounts, if that would put the station in the red
  if (chk.ok && !st.sandbox) { const n = st.ledger().credits.net - st.costOf(ui.tool).up; if (n < -0.5) shut += `<br><span class="warn">With its upkeep the station would lose ${Math.round(-n)} CR a minute</span>`; }
  $('tip').innerHTML = `<b>${C.parts[ui.tool].name}</b> on ${st.name(st.parts.get(p.part))}<br>${chk.ok ? ok + shut : `<span class="down">${chk.why}</span>`}`;
  showTip(x, y);
}
function showTip(x, y) {
  const tip = $('tip'); tip.classList.remove('hidden');
  tip.style.left = `${Math.min(innerWidth - tip.offsetWidth - 8, x + 16)}px`; tip.style.top = `${Math.max(48, y - tip.offsetHeight - 12)}px`;
}
function hideTip() { $('tip').classList.add('hidden'); $('tip').classList.remove('wide'); }
let toastT = 0;
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); toastT = 2.6; }

// ---------------------------------------------------------------- keys
addEventListener('keydown', (e) => {
  if (!ui.started || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (FLY.has(k) && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector('.screen.on')) { held.add(k); if (k === ' ') e.preventDefault(); if (k !== 'shift') return; }
  if (ui.clean) { if (k === 'h' || k === 'escape') setClean(false); return; }
  if (k === 'tab') { e.preventDefault(); if (ui.edit) return; const i = C.groups.findIndex((g) => g.id === ui.group), n = C.groups.length; ui.group = C.groups[(i + (e.shiftKey ? n - 1 : 1)) % n].id; audio.play('click'); buildGrid(); return; }
  const gi = KEYS.indexOf(k), list = partsOf(ui.group);
  if (!ui.edit && gi >= 0 && gi < list.length) { const t = list[gi]; setTool(ui.tool === t ? null : t); return; }
  if (k === 'r') { ui.rot = (ui.rot + 1) % 8; audio.play('click'); if (ui.tool) { ui.portsDirty = true; view.ghostKey = ''; view.setGhost(ui.tool, ui.hot, ui.rot); } info(); }
  else if (k === 'x') demolishSel();
  else if (k === 'f' && ui.sel) view.focus(ui.sel);
  else if (k === 'f' && ui.person) setFollow(ui.follow === ui.person ? 0 : ui.person);
  else if (k === 'i') { if (ui.edit) endEdit(); else if (ui.sel && canEdit(ui.sel)) startEdit(ui.sel); }
  else if (k === 'escape') {
    if ($('s-menu').classList.contains('on')) { if (ui.mpage !== 'main' && menuFrom === 'game') menuPage('main'); else menu(false); }
    else if (!$('cmdr').classList.contains('hidden')) cmdr(false);
    else if (!$('upg').classList.contains('hidden')) upg(false);
    else if (ui.edit) { if (ui.room) { ui.room = null; paletteState(); info(); } else endEdit(); }
    else { setTool(null); select(null); }
  }
  else if (k === 'p') pause();
  else if (k === 'v') { audio.play('click'); setView(VIEWS[(VIEWS.indexOf(ui.view) + 1) % VIEWS.length]); }
  else if (k === 'g') { audio.play('click'); setCut(!ui.cut); }
  else if (k === 't') { audio.play('click'); setOpen(!ui.open); }
  else if (k === 'm') menu();
  else if (k === 'k') simPanel();
  else if (k === 'o') cmdr();
  else if (k === 'u') upg();
  else if (k === 'c') { setComms(!ui.comms); audio.play('click'); }
  else if (k === 'j') { setDots(); SET.dots = ui.dots; applySet('dots'); audio.play('click'); }
  else if (k === 'h') setClean(true);
});
addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); held.delete(k); if (k === ' ' && e.target.tagName !== 'INPUT') e.preventDefault(); });
addEventListener('blur', () => held.clear());
// A button that has just been clicked keeps the keyboard; let go of it, or Space (up) would press it again.
addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
function demolishSel() {
  if (!ui.sel) return;
  if (ui.edit === ui.sel) endEdit();
  const r = st.demolish(ui.sel);
  if (r.ok) { audio.play('place'); select(null); } else { audio.play('deny'); toast(r.why); }
}
function pause(on = !ui.paused) { ui.paused = on; $('b-pause').textContent = on ? '▶' : 'II'; $('b-pause').classList.toggle('on', on); audio.play('click'); }
$('b-pause').onclick = () => pause();
$('b-speed').onclick = () => {
  const steps = st.sandbox ? [1, 2, 4, 8, 16] : [1, 2, 4, 8];
  ui.speed = steps[(steps.indexOf(ui.speed) + 1) % steps.length] || 1; $('b-speed').textContent = `${ui.speed}×`; audio.play('click');
};

// ---------------------------------------------------------------- station comms: every channel, typed out as it comes in
const typing = [], reqEls = new Map();
const OUTCOME = { approved: 'APPROVED', denied: 'DENIED', expired: 'NO ANSWER', void: 'NO LONGER POSSIBLE' };
// Answer what is on the desk: `i` is the place of the choice in the request's options.
function answer(id, i) {
  const r = st.answer(id, i);
  if (!r.ok) { audio.play('deny'); if (r.why) toast(r.why); }
  else audio.play(i === 0 ? 'place' : 'click');
  drawDesk(); info(); if (!$('cmdr').classList.contains('hidden')) drawFac();
}
// The desk: one card for each thing waiting on an answer, with its choices.
let deskSig = '';
function drawDesk() {
  const sig = st.requests.map((r) => r.id).join(','), box = $('desk');
  box.classList.toggle('hidden', !st.requests.length);
  $('app').classList.toggle('desk-on', st.requests.length > 0);
  $('dk-n').textContent = st.requests.length || '';
  if (sig !== deskSig) {
    deskSig = sig;
    $('dk-list').innerHTML = st.requests.map((r) => { const d = C.div[r.k]; return `<div class="dk" style="--c:${d.col}" data-id="${r.id}"><i>${r.kind === 'dilemma' ? 'A MATTER OF PEOPLE' : r.kind === 'conflict' ? `${C.factions[r.k].who.toUpperCase()} AGAINST ${C.factions[r.other].who.toUpperCase()}` : r.kind === 'allot' ? `${d.short} · WEEKLY ALLOTMENT` : `${d.short} · REQUEST`}<em></em></i><p>${r.text}</p><div class="dk-b">${r.options.map((o, i) => `<button type="button" class="btn${i === 0 ? ' primary' : ''}" data-i="${i}">${o}</button>`).join('')}</div></div>`; }).join('');
    for (const b of $('dk-list').querySelectorAll('button')) b.onclick = () => answer(+b.closest('.dk').dataset.id, +b.dataset.i);
  }
  for (const el of $('dk-list').children) { const r = st.requests.find((x) => x.id === +el.dataset.id); if (r) el.querySelector('em').textContent = `${Math.max(0, Math.round(C.faction.ttl - r.t))} s`; }
}
const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function radio(from, text, o = {}) {
  const ch = CH[from] || CH.ministry, list = $('c-list');
  radioLog.push({ who: `CH ${ch.n} · ${ch.name}`, col: ch.col, at: ui.started ? clock(st.t) : '', text, cls: o.warn ? ' warn' : o.gold ? ' gold' : o.dim ? ' dim' : '' }); if (radioLog.length > 400) radioLog.shift();
  const el = document.createElement('div');
  el.className = `cm new${o.warn ? ' warn' : ''}${o.gold ? ' gold' : ''}${o.dim ? ' dim' : ''}`;
  el.style.setProperty('--c', ch.col);
  const bars = 2 + Math.floor(Math.random() * 3), off = ch.off[Math.floor(Math.random() * ch.off.length)];
  el.innerHTML = `<div class="cmh"><span class="led"></span><b>CH ${ch.n} · ${ch.name}</b><span class="sig">${'▂▄▆█'.slice(0, bars)}<s>${'▂▄▆█'.slice(bars)}</s></span><time>${ui.started ? clock(st.t) : ''}</time></div><div class="cmt"></div>${off ? `<div class="cms">— ${off}</div>` : ''}`;
  const body = (from === 'captain' || from === 'colonists') && Math.random() < 0.3 ? `*kssht* ${text}` : text;
  // Something that needs an answer is marked: the choices are on the desk.
  if (o.request) {
    const bar = document.createElement('div');
    bar.className = 'rq-bar'; bar.innerHTML = '<span class="rq-out wait">ON YOUR DESK</span>';
    el.appendChild(bar); reqEls.set(o.request, bar);
  }
  typing.push({ el: el.querySelector('.cmt'), wrap: el, full: body, i: 0 });
  const stick = list.scrollTop + list.clientHeight >= list.scrollHeight - 30;
  list.appendChild(el);
  while (list.children.length > 40) list.removeChild(list.firstChild);
  if (stick) list.scrollTop = list.scrollHeight;
  if (!ui.comms) { ui.unread = (ui.unread || 0) + 1; $('c-badge').textContent = ui.unread; }
  if (!o.dim) audio.play('comms');
}
function typeTick(dt) {
  while (typing.length > 3) { const m = typing.shift(); m.el.textContent = m.full; m.wrap.classList.remove('new'); }
  for (let k = typing.length - 1; k >= 0; k--) {
    const m = typing[k]; m.i += dt * 70;
    const n = Math.min(m.full.length, Math.floor(m.i));
    m.el.textContent = m.full.slice(0, n) + (n < m.full.length ? '▌' : '');
    if (n >= m.full.length) { m.wrap.classList.remove('new'); typing.splice(k, 1); }
  }
  if (typing.length) { const list = $('c-list'); if (list.scrollTop + list.clientHeight >= list.scrollHeight - 60) list.scrollTop = list.scrollHeight; }
}
function setComms(on) {
  ui.comms = on;
  $('comms').classList.toggle('hidden', !on); $('c-open').classList.toggle('hidden', on);
  if (on) { ui.unread = 0; $('c-badge').textContent = ''; const l = $('c-list'); l.scrollTop = l.scrollHeight; }
}
$('c-x').onclick = () => { audio.play('click'); setComms(false); };
$('c-open').onclick = () => { audio.play('click'); setComms(true); };

// ---------------------------------------------------------------- the Commander's channel: fund the divisions and give them standing orders
function closeFloats(except) {
  for (const id of ['cmdr', 'upg', 'liv']) if (id !== except) $(id).classList.add('hidden');
  $('b-cmdr').classList.toggle('on', except === 'cmdr'); $('b-upg').classList.toggle('on', except === 'upg'); $('b-liv').classList.toggle('on', except === 'liv');
  $('app').classList.toggle('float-open', !!except);
}
function cmdr(on = $('cmdr').classList.contains('hidden')) {
  audio.play('click');
  closeFloats(on ? 'cmdr' : null);
  $('cmdr').classList.toggle('hidden', !on);
  if (on) drawCmdr();
}
$('b-cmdr').onclick = () => cmdr(); $('cm-x').onclick = () => cmdr(false);
let cmType = null;
function drawCmdr() {
  const tabs = $('cm-tabs'); tabs.innerHTML = '';
  {      // the accounts come first: where everything comes from and goes, and what the station is asked for next
    const b = document.createElement('button');
    b.type = 'button'; b.className = `dt lgt${ui.div === 'ledger' ? ' on' : ''}`; b.style.setProperty('--c', '#f5d547'); b.dataset.k = 'ledger';
    b.innerHTML = '<span class="led"></span>ACCOUNTS<small id="dt-ledger"></small>';
    b.onclick = () => { ui.div = 'ledger'; audio.play('click'); drawCmdr(); };
    tabs.appendChild(b);
  }
  for (const k of C.divOrder) {
    const d = C.div[k], b = document.createElement('button');
    b.type = 'button'; b.className = `dt${k === ui.div ? ' on' : ''}`; b.style.setProperty('--c', d.col); b.dataset.k = k;
    b.innerHTML = `<span class="led"></span>${d.short}<small id="dt-${k}"></small>`;
    b.onclick = () => { ui.div = k; audio.play('click'); drawCmdr(); };
    tabs.appendChild(b);
  }
  if (ui.div === 'ledger') { $('cm-main').innerHTML = `<div class="dh" style="--c:#f5d547"><b>THE STATION'S ACCOUNTS</b><span class="sig">▂▄▆█</span></div>`
      + (st.sandbox ? '' : `<div class="brow"><span class="bl">LIBERTY CONTRIBUTION · THE COLONIST TAX</span><span class="bv" id="bv-tax"></span><input id="in-tax" type="range" min="0" max="30" step="1" value="${st.tax}"><span class="bn" id="bn-tax"></span></div>`)
      + '<div class="lg" id="lg"></div>';
    if ($('in-tax')) $('in-tax').oninput = (e) => { st.setTax(+e.target.value); cmdrText(); };
    cmType = null; facSig = ''; cmdrText(); return;
  }
  const k = ui.div, d = C.div[k], ch = CH[k], div = st.div[k];
  let h = `<div class="dh" style="--c:${d.col}"><b>CH ${ch.n} · ${d.name.toUpperCase()}</b><span class="sig">▂▄▆█</span></div><div class="rep" id="cm-rep"></div><div id="cm-fac"></div>`;
  if (d.uses) h += `<div class="brow"><span class="bl">WEEKLY ALLOTMENT · ${C.supplies[d.uses].name.toUpperCase()}</span><span class="bv" id="cm-bv"></span>`
    + `<input id="cm-budget" type="range" min="0" max="${C.allotMax}" step="1" value="${div.allot}"><span class="bn" id="cm-bn"></span></div>`;
  if (k === 'supply') h += '<div class="stores" id="cm-stores"></div>';
  if (k === 'gunnery') h += '<div class="plat" id="cm-plat"></div>';
  for (const [o, opts] of Object.entries(d.orders)) {
    h += `<div class="ord"><span class="ol">${ORDER_NAMES[o] || o.toUpperCase()}</span><div class="obs">${opts.map(([v, l]) => `<button type="button" class="btn ob${(div.order[o] ?? opts[0][0]) === v ? ' on' : ''}" data-o="${o}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  }
  $('cm-main').innerHTML = h; facSig = '';
  if ($('cm-budget')) $('cm-budget').oninput = (e) => { st.setAllot(k, +e.target.value); cmdrText(); };
  for (const b of $('cm-main').querySelectorAll('.ob')) b.onclick = () => {
    if (st.div[k].order[b.dataset.o] === b.dataset.v) return;
    st.setOrder(k, b.dataset.o, b.dataset.v); audio.play('click');
    for (const x of $('cm-main').querySelectorAll(`.ob[data-o="${b.dataset.o}"]`)) x.classList.toggle('on', x === b);
    cmType = { el: $('cm-rep'), full: st.report(k), i: 0 };
  };
  cmType = { el: $('cm-rep'), full: st.report(k), i: 0 };
  cmdrText(); drawFac();
}
// A faction's page: its mood, what it wants, any request waiting for your answer, and its people by name.
let facSig = '';
function drawFac() {
  const box = $('cm-fac'); if (!box) return;
  const k = ui.div, F = C.factions[k];
  if (!F) { box.innerHTML = ''; facSig = ''; return; }
  const crew = st.crew(k), req = st.requests.find((r) => r.k === k && r.kind !== 'dilemma'), shown = crew.slice(0, 8);
  const sig = `${k}|${req ? req.id : 0}|${shown.map((a) => a.id).join(',')}|${crew.length}`;
  if (sig !== facSig) {
    facSig = sig;
    box.innerHTML = `<div class="fac"><div class="fh"><b>${F.who.toUpperCase()} · MOOD</b><span class="fs"></span></div><div class="fbar"><i></i></div>`
      + `<p class="fw"><b>Wants:</b> ${F.wants}</p><p class="fy"></p>`
      + (req ? `<div class="freq"><span>${req.text} <em class="ft"></em></span>${req.options.map((o, i) => `<button type="button" class="btn${i === 0 ? ' primary' : ''}" data-i="${i}">${o}</button>`).join('')}</div>` : '')
      + `<div class="crew"><b>${ROLE[C.div[k].staff].toUpperCase()} ON STATION (${crew.length})</b>${shown.map((a) => `<button type="button" class="pp" data-id="${a.id}">${a.name}<small></small></button>`).join('')}${crew.length > shown.length ? `<em>+${crew.length - shown.length} more</em>` : ''}</div></div>`;
    for (const b of box.querySelectorAll('.freq button')) b.onclick = () => answer(req.id, +b.dataset.i);
    for (const b of box.querySelectorAll('.pp')) b.onclick = () => { const a = st.agents.find((x) => x.id === +b.dataset.id); if (a) { pickPerson(a.id); view.lookAtAgent(a); } };
  }
  const sat = Math.round(st.sat[k]), cls = sat >= 65 ? 'ok' : sat >= C.faction.low ? 'mid' : 'bad';
  box.querySelector('.fs').textContent = sat; box.querySelector('.fs').className = `fs ${cls}`;
  box.querySelector('.fbar').className = `fbar ${cls}`; box.querySelector('.fbar i').style.width = `${sat}%`;
  box.querySelector('.fy').textContent = st.why[k] || '';
  if (req) box.querySelector('.ft').textContent = `${Math.max(0, Math.round(C.faction.ttl - req.t))} s left`;
  for (const b of box.querySelectorAll('.pp')) { const a = st.agents.find((x) => x.id === +b.dataset.id); b.querySelector('small').textContent = a ? st.doing(a) : ''; }
}
function cmdrText() {
  for (const k of C.divOrder) {
    const d = C.div[k], s = $(`dt-${k}`); if (!s) continue;
    s.textContent = d.staff ? `${st.staff[d.staff]}` : k === 'truth' ? (st.div.truth.order.broadcast === 'silence' ? 'off' : 'on') : st.div.traffic.order.rate;
  }
  if ($('dt-ledger')) { const n = st.sandbox ? 0 : st.ledger().credits.net; $('dt-ledger').textContent = st.sandbox ? '' : `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n))}`; $('dt-ledger').style.color = n < -0.5 ? 'var(--red)' : ''; }
  if (ui.div === 'ledger' && $('in-tax')) {
    const p = st.moraleParts(), i = $('in-tax'); if (document.activeElement !== i) i.value = st.tax;
    $('bv-tax').textContent = `${st.tax}%`; $('bn-tax').textContent = `+${Math.round(st.taxPerMin())} CR a minute from ${st.residents()} residents · morale ${p.tax >= 0 ? '+' : ''}${Math.round(p.tax)}. Up to ${C.morale.taxFree}% they do not mind; every point above costs ${C.morale.taxPenalty} morale.`;
  }
  if (ui.div === 'ledger') { const box = $('lg'); if (box) { const html = ledgerPage(); if (html !== box._html) { box._html = html; box.innerHTML = html; } } return; }
  const k = ui.div, d = C.div[k], div = st.div[k];
  if ($('cm-bv')) {
    const r = d.staff, sup = C.supplies[d.uses], can = Math.floor(div.allot / d.per);
    $('cm-bv').textContent = `${div.allot} ${sup.unit} a week`;
    $('cm-bn').textContent = `${st.staff[r]} ${ROLE[r]} on duty at ${d.per} ${sup.unit} each a week · ${st.homes[r]} places in ${PLACES[r]} · ${Math.floor(st.stock[d.uses])} in the stores.`
      + (st.short[k] ? ' The stores are empty: they are going without.' : can > st.homes[r] ? ' More than the places need: build more places, or lower it.' : can < st.homes[r] ? ` Raise it to fill ${st.homes[r] - can} more.` : '');
  }
  if ($('cm-stores')) $('cm-stores').innerHTML = '<b>THE STORES</b>' + Object.entries(C.supplies).map(([t, S]) => { const need = st.weeklyNeed(t), have = Math.floor(st.stock[t]); return `<span class="${have < need / 7 ? 'bad' : have < need ? 'warn' : ''}"><i>${S.name}</i>${st.sandbox ? '∞' : have}<small> · ${Math.round(need)} a week</small></span>`; }).join('') + `<em>${st.weekIn} crates in so far this week, ${st.lastWeek.in} last week. Freighters bring more of whatever is short.</em>`;
  if ($('cm-plat')) {
    const P = st.platform();
    $('cm-plat').innerHTML = `<b>THE PLATFORM · ${Math.round(P.ready * 100)}% READY</b>` + P.sys.map((x) => `<div class="ps${!x.open ? ' off' : x.n ? (x.ready > 0.8 ? ' ok' : x.ready > 0.4 ? ' mid' : ' bad') : ' none'}"><span>${x.name}</span><span class="pn">${x.n}/${x.max}</span><span class="pb"><i style="width:${Math.round(x.ready * 100)}%"></i></span><em>${x.n && !x.why ? 'Ready' : x.why}</em></div>`).join('')
      + `<em>Calls from the ground answered: ${st.stats.calls || 0}. Missed: ${st.stats.missed || 0}. Shells in the stores: ${st.sandbox ? '∞' : Math.floor(st.stock.shells)}.</em>`;
  }
  if (!cmType) { const r = $('cm-rep'); if (r) r.textContent = st.report(k); }
}
// ---------------------------------------------------------------- THE ACCOUNTS: where everything comes from and goes
const sgn = (x, d = 0) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d).replace(/\.0$/, '')}`;
const lrow = (label, val, cls = '', note = '') => `<div class="lr"><span>${label}${note ? `<small>${note}</small>` : ''}</span><b class="${cls}">${val}</b></div>`;
const money = (x) => lrow(x.label, `${sgn(x.v, Math.abs(x.v) < 10 ? 1 : 0)}`, x.v > 0.04 ? 'up' : x.v < -0.04 ? 'down' : 'dim', x.note || '');
const days = (d) => (d === Infinity ? '—' : d < 1 ? 'under a day' : `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);
const WHO = (k) => (CH[k] ? CH[k].name : k.toUpperCase());
// One section of the accounts. `full`: every line (the Commander's page); otherwise the few that matter most (the hover).
function ledgerSec(sec, L, full) {
  const c = L.credits, cut = (xs, n) => (full ? xs : xs.slice(0, n));
  if (sec === 'credits') {
    if (st.sandbox) return '<b class="lh">CREDITS</b><p>Free play: credits are without limit.</p>';
    return `<b class="lh">CREDITS · ${Math.round(c.now).toLocaleString('en-US')} CR<i class="${c.net >= 0 ? 'up' : 'down'}">${sgn(c.net)} a minute</i></b>`
      + `<div class="lsub">COMING IN, a minute</div>${cut(c.ins, 4).map(money).join('')}${lrow('<em>In</em>', sgn(c.income), 'up')}`
      + `<div class="lsub">GOING OUT, a minute${full ? ' · upkeep, biggest first' : ''}</div>${cut(c.outs, 4).map(money).join('')}${!full && c.outs.length > 4 ? lrow(`and ${c.outs.length - 4} more lines`, '', 'dim') : ''}${lrow('<em>Out</em>', sgn(c.spend), 'down')}`
      + `<div class="lnet ${c.net >= 0 ? 'up' : 'down'}">${c.net >= 0 ? `Gaining ${Math.round(c.net)} CR a minute.` : `Losing ${Math.round(-c.net)} CR a minute. ${c.now <= 0 ? 'The station is in debt: morale −15 until it is not.' : `At this rate the credits run out in ${days(c.runway)}.`}`}</div>`
      + (c.idle.n ? `<p class="warn">${c.idle.n} part${c.idle.n > 1 ? 's stand' : ' stands'} empty or broken and still cost${c.idle.n > 1 ? '' : 's'} ${Math.round(c.idle.v)} CR a minute.</p>` : '')
      + (full ? `<p>Spent on building so far: ${Math.round(c.built).toLocaleString('en-US')} CR. Earned from trade so far: ${Math.round(c.traded).toLocaleString('en-US')} CR. Trade lines show the last minute; the rest are what the station pays and earns right now.</p>` : '');
  }
  if (sec === 'power') {
    const p = L.power;
    return `<b class="lh">POWER · ${p.demand} used of ${p.supply} made<i class="${p.eff < 1 ? 'down' : 'up'}">${p.eff < 1 ? `running at ${Math.round(p.eff * 100)}%` : `${p.supply - p.demand} spare`}</i></b>`
      + `<div class="lsub">MADE BY</div>${cut(p.make, 4).map((x) => lrow(x.label, sgn(x.v), x.v ? 'up' : 'down')).join('') || lrow('Nothing', '0', 'down')}`
      + `<div class="lsub">USED BY</div>${cut(p.use, 5).map((x) => lrow(x.label, sgn(x.v), 'down')).join('')}${!full && p.use.length > 5 ? lrow(`and ${p.use.length - 5} more`, '', 'dim') : ''}`
      + (p.eff < 1 ? '<p class="warn">Short of power, everything works slower and morale falls. Build a Solar Array or a Reactor Core.</p>' : '');
  }
  if (sec === 'people') {
    const p = L.people;
    return `<b class="lh">PEOPLE · ${p.residents} residents in ${p.beds} beds<i class="${p.free ? 'up' : 'dim'}">${p.free} free</i></b><p>${p.leaving ? '<span class="down">Morale is so low that residents are leaving.</span> ' : ''}${p.why}</p>`
      + `<div class="lsub">STAFF ON DUTY, of the places built for them</div>${p.staff.filter((x) => full || x.places).map((x) => lrow(WHO(x.k), `${x.on} / ${x.places}`, x.places && !x.on ? 'down' : x.on < x.places ? 'warn' : 'up')).join('')}`
      + (full ? '<p>Staff are kept by weekly supplies, not credits: each division\'s page sets how many it keeps on duty.</p>' : '');
  }
  if (sec === 'morale') {
    const m = L.morale, S = C.ships.shuttleMorale, lv = C.morale.leaveBelow;
    // where it has been: four readings a day, with the two lines that matter drawn across
    let chart = '';
    if (m.log.length > 1) {
      const W = 300, H = 46, n = m.log.length, X = (i) => (i / (n - 1) * W).toFixed(1), Y = (v) => (H - Math.max(0, Math.min(100, v)) / 100 * H).toFixed(1);
      chart = `<svg class="mlog" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Morale over the last ${Math.round(n / 4)} days"><line x1="0" x2="${W}" y1="${Y(S)}" y2="${Y(S)}" class="l1"/><line x1="0" x2="${W}" y1="${Y(lv)}" y2="${Y(lv)}" class="l2"/><polyline points="${m.log.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}"/></svg>`
        + `<div class="mkey"><span>${Math.round(n / 4)} day${Math.round(n / 4) === 1 ? '' : 's'} ago: ${m.log[0]}</span><span>lowest ${Math.min(...m.log)} · highest ${Math.max(...m.log)}</span><span>now ${Math.round(m.now)}</span></div>`;
    }
    const ways = (full ? m.ways : m.ways.slice(0, 3)).map((w) => `<div class="lr way"><span>${w.label}<small>${w.cost}</small></span><b class="up">+${Math.round(w.gain)}</b>${full ? (w.do ? `<button type="button" class="btn" data-do="${w.do}">DO IT</button>` : '<i></i>') : ''}</div>`).join('');
    return `<b class="lh">MORALE · ${Math.round(m.now)}<i class="${m.target >= m.now - 0.5 ? 'up' : 'down'}">${Math.abs(m.target - m.now) < 1.5 ? 'steady' : `${m.target > m.now ? 'rising' : 'falling'} towards ${Math.round(m.target)}`}</i></b>${full ? chart : ''}`
      + `<div class="lsub">WHAT MAKES IT UP</div>${m.lines.map((x) => lrow(x.label, sgn(x.v), x.v >= 0 ? 'up' : 'down')).join('')}`
      + (ways ? `<div class="lsub">WAYS TO RAISE IT${full ? '' : ' · the quickest'}</div>${ways}` : '')
      + `<p>Below ${S} colonists stop coming. Below ${lv} residents leave.${full ? ' Morale moves towards its total a little at a time, so a change takes a day or so to show.' : ''}</p>`;
  }
  if (sec === 'stores') {
    const s = L.stores;
    if (st.sandbox) return '<b class="lh">THE STORES</b><p>Free play: the stores never run out.</p>';
    return `<b class="lh">THE STORES · ${Math.round(s.need)} crates needed a week<i class="${s.lastWeek >= s.need ? 'up' : 'warn'}">${s.weekIn} in so far, ${s.lastWeek} last week</i></b>`
      + `<div class="lsub">IN THE STORES · USED A WEEK · LASTS</div>${s.supplies.filter((x) => full || x.need > 0).map((x) => lrow(x.label, `${x.have} · ${Math.round(x.need)} · ${x.need > 0 ? days(x.days) : '—'}`, x.short || (x.need > 0 && x.days < 1) ? 'down' : x.need > 0 && x.days < 3 ? 'warn' : '', x.by)).join('')}`
      + `<p>${s.berths ? `${s.berths} berth${s.berths > 1 ? 's' : ''} for freighters and ${s.haulers} hauler${s.haulers === 1 ? '' : 's'} on duty bring it in. Freighters carry more of whatever is short.` : '<span class="down">No berth for freighters: nothing can come in.</span>'}</p>`;
  }
  if (sec === 'cap') {
    const k = L.cap;
    return `<b class="lh">CAPABILITY · ${k.now.toLocaleString('en-US')}<i>the score</i></b>${cut(k.lines, 5).map((x) => lrow(x.label, sgn(x.v), 'up')).join('')}${lrow('The factions\' mood', `× ${k.mood.toFixed(2)}`, k.mood >= 1 ? 'up' : 'down')}`
      + (full ? '<p>What the station adds to the war effort. It opens the upgrade path.</p>' : '');
  }
  if (sec === 'ready') {
    const P = st.platform();
    return `<b class="lh">THE PLATFORM · ${Math.round(P.ready * 100)}% ready</b>${P.sys.filter((x) => x.open).map((x) => lrow(x.name, x.n ? `${Math.round(x.ready * 100)}%` : 'not built', x.n ? (x.ready > 0.8 ? 'up' : x.ready > 0.4 ? 'warn' : 'down') : 'dim', x.n && !x.why ? '' : x.why)).join('')}`
      + `<p>Calls from the ground answered: ${st.stats.calls || 0}. Missed: ${st.stats.missed || 0}.</p>`;
  }
  if (sec === 'ships' || sec === 'trade') {
    const T = L.trade, by = (k) => st.ships.filter((x) => x.state === k).length, shut = st._shut ? [...st._shut] : [], D = T.demand, rateK = C.ships.rate[st.div.traffic.order.rate];
    const repW = T.rep > 0.7 ? 'good' : T.rep > 0.4 ? 'fair' : 'poor';
    return `<b class="lh">TRADE · ${Math.round(D.total * rateK)} crates a minute asked for<i class="${T.price >= 1 ? 'up' : 'warn'}">${T.fee} CR a crate</i></b>`
      + `<div class="lsub">WHY FREIGHTERS COME, crates a minute</div>${lrow(`The sector's trade for a ${C.tiers[st.tier].name.toLowerCase()}`, D.base.toFixed(0))}${lrow(`Reputation: ${repW}`, `× ${D.repK.toFixed(2)}`, T.rep > 0.5 ? 'up' : 'down', 'ships served on time raise it; ships kept waiting or lost lower it')}${D.hub > 1.001 ? lrow('Spires and Operations Centres', `× ${D.hub.toFixed(2)}`, 'up') : ''}${D.runs ? lrow('Supply runs: the stores are short', `+${D.runs.toFixed(0)}`, 'up') : ''}${rateK !== 1 ? lrow(`Traffic Control: ${st.div.traffic.order.rate} traffic`, `× ${rateK}`, rateK > 1 ? 'warn' : 'dim') : ''}`
      + `<div class="lsub">THE PRICE OF A CRATE</div>${lrow('Crates taken in, a minute', T.supply.toFixed(1))}${lrow('Market price', `× ${T.price.toFixed(2)}`, T.price >= 1 ? 'up' : 'down', T.price < 0.95 ? 'more crates come in than the sector wants moved: each is worth less' : T.price > 1.05 ? 'fewer crates come in than the sector wants: each is worth more' : 'supply and demand are level')}`
      + `<div class="lsub">BERTHS</div>${lrow('For freighters · shuttles · warships', `${st.berths('freighter').length} · ${st.berths('shuttle').length} · ${st.berths('warship').length}`)}${lrow('Enough for this much trade', `about ${T.needBerths}`, T.berths.n >= T.needBerths ? 'up' : 'warn')}${lrow('Busy now · busy on average', `${T.berths.busy} · ${T.berths.occ.toFixed(1)}`)}${T.berths.spare ? lrow('More than the trade needs', `${T.berths.spare}`, T.berths.spare > 1 ? 'warn' : '', `each still costs ${C.parts.dockport.up} CR a minute`) : ''}${lrow('Waiting · coming in · docked', `${by('hold')} · ${by('approach')} · ${by('docked')}`)}${lrow('Served · lost', `${st.stats.ships} · ${st.stats.lost}`, st.stats.lost ? 'warn' : '')}`
      + shut.map(([id, w]) => `<p class="warn">${st.name(st.parts.get(id))} is shut: ${w} is across its approach.</p>`).join('')
      + T.notYet.map((x) => `<p class="warn">${x.name} takes no ships until a ${x.room} is fitted inside it.</p>`).join('')
      + (full ? '<p>More berths do not bring more ships. Ships come for the trade; berths serve them. A berth past what the trade needs stands idle and still costs upkeep.</p>' : '');
  }
  return '';
}
function asksHtml(max) {
  const A = st.asks(); if (!A.length) return '';
  return A.slice(0, max).map((a) => `<div class="ask${a.urgent ? ' urgent' : ''}"><i>${WHO(a.from)}</i><b>${a.text}</b><span>${a.why}</span></div>`).join('') + (A.length > max ? `<div class="ask more">and ${A.length - max} more</div>` : '');
}
function ledgerPage() {
  const L = st.ledger(), asks = asksHtml(6);
  return (asks ? `<section id="lg-asks"><b class="lh">ASKED OF YOU<i>most pressing first</i></b>${asks}</section>` : '')
    + ['credits', 'trade', 'stores', 'power', 'people', 'morale', 'cap'].map((k) => `<section id="lg-${k}">${ledgerSec(k, L, true)}</section>`).join('');
}
// A way to raise morale that is an order: given on the spot. (On pointer down, because the page redraws itself as numbers change.)
const WAYS = {
  tax: () => st.setTax(C.morale.taxFree), festival: () => st.celebrate(), rations2: () => st.setOrder('supply', 'rations', 'double'), rations1: () => st.setOrder('supply', 'rations', 'normal'),
  shift: () => st.setOrder('supply', 'shift', 'normal'), care: () => st.setOrder('medical', 'care', 'free'), patriotic: () => st.setOrder('truth', 'broadcast', 'patriotic'),
};
$('cm-main').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-do]'); if (!b || !WAYS[b.dataset.do]) return;
  e.preventDefault(); const r = WAYS[b.dataset.do]();
  if (r && r.ok === false) { audio.play('deny'); toast(r.why); } else audio.play('click');
  cmdrText();
});
// Hover a readout on the top bar: where it comes from and where it goes. Click it: the full accounts.
const RI = { 'r-cap': 'cap', 'r-cr': 'credits', 'r-pw': 'power', 'r-pop': 'people', 'r-mo': 'morale', 'r-rdy': 'ready', 'r-sh': 'trade' };
function riTip() { $('tip').innerHTML = `<div class="lg tipl">${ledgerSec(ui.riTip, st.ledger(), false)}<p class="dim">Click for the full accounts.</p></div>`; }
function openLedger(sec) {
  ui.div = sec === 'ready' ? 'gunnery' : 'ledger';
  audio.play('click'); closeFloats('cmdr'); $('cmdr').classList.remove('hidden'); drawCmdr();
  const el = $(`lg-${sec}`); if (el) el.scrollIntoView({ block: 'start' });
}
for (const [id, sec] of Object.entries(RI)) {
  const el = $(id).closest('.ri'); el.removeAttribute('title'); el.classList.add('acc');
  el.onmouseenter = el.onmousemove = (e) => { if (e.pointerType === 'touch') return; ui.riTip = sec; $('tip').classList.add('wide'); riTip(); showTip(Math.max(0, e.clientX - 40), 0); };
  el.onmouseleave = () => { ui.riTip = null; hideTip(); };
  el.onclick = () => { ui.riTip = null; hideTip(); openLedger(sec); };
}
function cmTick(dt) {
  if (!cmType) return;
  cmType.i += dt * 110;
  const n = Math.min(cmType.full.length, Math.floor(cmType.i));
  cmType.el.textContent = cmType.full.slice(0, n) + (n < cmType.full.length ? '▌' : '');
  if (n >= cmType.full.length) cmType = null;
}

// ---------------------------------------------------------------- the upgrade path, Age of Empires style
function upg(on = $('upg').classList.contains('hidden')) {
  audio.play('click');
  closeFloats(on ? 'upg' : null);
  $('upg').classList.toggle('hidden', !on);
  if (on) drawUpg();
}
$('b-upg').onclick = () => upg(); $('b-age').onclick = () => upg(); $('up-x').onclick = () => upg(false);
const NUM = ['I', 'II', 'III', 'IV', 'V'];
function needsText(T) {
  const n = T.needs || {}, out = [];
  if (n.residents) out.push(`${n.residents} residents`); if (n.cap) out.push(`${n.cap} capability`); if (n.crates) out.push(`${n.crates} crates traded`);
  if (n.power) out.push(`${n.power} power`); if (n.morale) out.push(`morale ${n.morale}`); if (n.ready) out.push(`platform ${n.ready}% ready`);
  for (const r of n.rooms || []) out.push(`a ${C.rooms[r].name}`);
  return out.join(' · ');
}
let upgHTML = '';
function drawUpg() {
  const nx = st.next();
  const h = C.tiers.map((T, i) => {
    const s = st.sandbox || i < st.tier ? 'done' : i === st.tier ? 'now' : i === st.tier + 1 ? 'next' : 'later';
    const label = { done: 'GRANTED', now: 'CURRENT', next: 'NEXT', later: 'LOCKED' }[s];
    const parts = Object.keys(C.parts).filter((t) => (C.parts[t].tier ?? -1) === i && !C.parts[t].fixed);
    const rooms = C.roomOrder.filter((r) => C.rooms[r].tier === i);
    let req = '';
    if (s === 'next' && nx) req = `<div class="reqs">${nx.items.map((it) => `<div class="req${it.ok ? ' ok' : ''}"><span>${it.label}</span><span>${Math.min(it.have, it.need)}/${it.need}</span><i style="width:${Math.min(100, it.have / it.need * 100)}%"></i></div>`).join('')}</div>`;
    else if (s === 'later') req = `<div class="rq">Needs ${needsText(T)}</div>`;
    return `<div class="tier ${s}"><div class="tn"><span class="tb">${NUM[i]}</span><b>${T.name}</b><em>${label}</em><span class="tz">BUILD ZONE ${T.radius}</span></div>`
      + `<p>${T.about}</p>${req}`
      + (parts.length || rooms.length ? `<div class="unl">${parts.map((t) => `<span class="up-p" title="${C.parts[t].name}">${partIcon(t)}<small>${C.parts[t].name}</small></span>`).join('')}`
        + `${rooms.map((r) => `<span class="up-r" style="--c:${C.rooms[r].col}" title="${C.rooms[r].about || ''}">${C.rooms[r].name}</span>`).join('')}</div>` : '')
      + '</div>';
  }).join('');
  if (h !== upgHTML) { upgHTML = h; $('up-list').innerHTML = h; }
}

// ---------------------------------------------------------------- livery: the station's name, colours, plating, fit-out and emblem
function livery(on = $('liv').classList.contains('hidden')) {
  audio.play('click');
  closeFloats(on ? 'liv' : null);
  $('liv').classList.toggle('hidden', !on);
  if (on) drawLivery();
}
function setLivery(patch) {
  st.livery = { ...st.livery, ...patch };
  view.setLivery(st.livery);
  try { localStorage.setItem(LIVERY_KEY, JSON.stringify(st.livery)); } catch (e) { /* no storage here */ }
  buildGrid(); drawLivery();
}
function drawLivery() {
  const L = st.livery, D = C.livery, esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = (key, opts, label) => `<div class="lv-row"><span class="ol">${label}</span><div class="obs">${Object.entries(opts).map(([k, v]) => `<button type="button" class="btn ob${L[key] === k ? ' on' : ''}" data-key="${key}" data-v="${k}">${typeof v === 'string' && v[0] !== '#' ? v : v.name || k.toUpperCase()}</button>`).join('')}</div></div>`;
  $('lv-body').innerHTML = `<div class="lv-row"><span class="ol">STATION NAME</span><input id="lv-name" type="text" maxlength="18" placeholder="SUPER EARTH" value="${esc(L.name || '')}"></div>`
    + `<div class="lv-row"><span class="ol">COLOURS</span><div class="obs">${Object.entries(D.schemes).map(([k, v]) => `<button type="button" class="btn ob sw${L.scheme === k ? ' on' : ''}" data-scheme="${k}"><i style="background:${v.hull}"></i><i style="background:${v.trim}"></i><i style="background:${v.accent}"></i>${v.name}</button>`).join('')}</div></div>`
    + `<div class="lv-row"><span class="ol">YOUR OWN</span><div class="obs cols"><label>Hull<input type="color" data-col="hull" value="${L.hull}"></label><label>Trim<input type="color" data-col="trim" value="${L.trim}"></label><label>Accent<input type="color" data-col="accent" value="${L.accent}"></label></div></div>`
    + pick('plating', D.plating, 'HULL PLATING') + pick('interior', D.interior, 'INTERIOR') + pick('lights', Object.fromEntries(Object.keys(D.lights).map((k) => [k, k[0].toUpperCase() + k.slice(1)])), 'LIGHTS') + pick('emblem', D.emblems, 'EMBLEM');
  $('lv-name').onchange = (e) => setLivery({ name: e.target.value.trim() });
  for (const b of $('lv-body').querySelectorAll('[data-scheme]')) b.onclick = () => { const S = D.schemes[b.dataset.scheme]; setLivery({ scheme: b.dataset.scheme, hull: S.hull, trim: S.trim, accent: S.accent }); };
  for (const b of $('lv-body').querySelectorAll('[data-key]')) b.onclick = () => setLivery({ [b.dataset.key]: b.dataset.v });
  for (const i of $('lv-body').querySelectorAll('[data-col]')) i.onchange = () => setLivery({ scheme: 'own', [i.dataset.col]: i.value });
}
$('b-liv').onclick = () => livery(); $('lv-x').onclick = () => livery(false);

// ---------------------------------------------------------------- free play controls
function simPanel(on = $('simpanel').classList.contains('hidden'), quiet = false) {
  if (!st.sandbox) on = false;
  $('simpanel').classList.toggle('hidden', !on); $('b-sim').classList.toggle('on', on); if (!quiet) audio.play('click');
}
$('b-sim').onclick = () => simPanel(); $('sp-x').onclick = () => simPanel(false);
const callIn = (kind, what) => { if (st.spawnShip(kind)) { audio.play('click'); radio('traffic', `${what} cleared for approach.`); } else { audio.play('deny'); toast(kind === 'warship' ? 'Warships need a Drydock with a Workshop inside.' : kind === 'shuttle' ? 'Shuttles need a Docking Port, a Pylon or a Hangar with a Shuttle Bay.' : 'Freighters need a Docking Port or a Pylon.'); } };
$('t-freighter').onclick = () => callIn('freighter', 'A freighter is');
$('t-shuttle').onclick = () => callIn('shuttle', 'A colonist shuttle is');
$('t-warship').onclick = () => callIn('warship', 'A damaged warship is');
$('t-colonists').onclick = () => { const n = st.addColonists(10); if (n) { audio.play('click'); radio('colonists', `${n} citizens came aboard at Station Command and went looking for their quarters.`); } else { audio.play('deny'); toast('No free beds: build Quarters inside a Hab, a Ring or a Drum.'); } };
$('t-raid').onclick = () => { if (st.raid) { audio.play('deny'); toast('A raid is already under way.'); } else { st.callRaid(); audio.play('click'); } };
$('t-fault').onclick = () => { if (st.breakPart()) audio.play('fault'); else { audio.play('deny'); toast('Nothing that can break yet.'); } };
$('t-clear').onclick = () => { st.clearShips(); audio.play('click'); radio('traffic', 'All ships waved off. The lanes are clear.'); };
$('t-traffic').onclick = () => { st.traffic = !st.traffic; $('t-traffic').classList.toggle('on', st.traffic); $('t-traffic').textContent = st.traffic ? 'TRAFFIC ON' : 'TRAFFIC OFF'; audio.play('click'); };
function simStats() {
  const p = st.moraleParts(), h = st.busy('hauler'), ab = st.avgBerth(), by = (k) => st.ships.filter((x) => x.state === k).length, s = st.staff;
  const sgn = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))}`;
  $('t-stats').innerHTML = [
    ['Time', `${clock(st.t)} at ${ui.speed}×`],
    ['Crates / min', st.cratesPerMin().toFixed(1)],
    ['Ships wait · in · docked', `${by('hold')} · ${by('approach')} · ${by('docked')}`],
    ['Avg time at berth', ab == null ? '—' : `${ab.toFixed(1)} s`],
    ['Haulers busy', `${h.busy} / ${h.all}`],
    ['Staff H · E · O · M · A · S', `${s.hauler} · ${s.engineer} · ${s.officer} · ${s.medic} · ${s.aide} · ${s.scientist}`],
    ['Week · day', `${st.week()} · ${st.dow()}`],
    ['Berths F · S · W', `${st.berths('freighter').length} · ${st.berths('shuttle').length} · ${st.berths('warship').length}`],
    ['Pop / beds', `${st.residents()} / ${st.beds()}`],
    ['Power use / supply', `${st.demand} / ${st.supply} (${Math.round(st.eff * 100)}%)`],
    ['Crates · ships · lost', `${st.stats.crates} · ${st.stats.ships} · ${st.stats.lost}`],
    ['Faults · fixed', `${st.stats.faults} · ${st.stats.fixed || 0}`],
    ['Smugglers caught · missed', `${st.stats.caught} · ${st.stats.contraband}`],
    ['Morale', `${Math.round(st.morale)}`],
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')
    + `<span class="wide">${Object.entries(p).filter(([k, x]) => k === 'base' || Math.round(x)).map(([k, x]) => `${k === 'base' ? Math.round(x) : sgn(x)} ${k}`).join(' ')}</span>`;
}

// ---------------------------------------------------------------- THE MENU: nothing in it plays the game. It pauses the station.
// Settings, help, the radio log, saving and credits, laid out the way Orbital Fury's pause menu is. (The tax and the accounts
// that used to be here are in the Commander's channel, under ACCOUNTS.)
const SET_KEY = 'sos.settings', PEOPLE_KEY = 'sos.people';
const SET = { volume: 1, muted: false, quality: 'auto', fps: 'auto', people: 100, dots: true, calm: false, fly: 1, zoom: 1, advice: true };
try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY)) || {}); const p = +localStorage.getItem(PEOPLE_KEY); if (p && !localStorage.getItem(SET_KEY)) SET.people = p; } catch (e) { /* no storage here: the settings last for this visit */ }
function applySet(key) {
  const all = !key, is = (k) => all || key === k;
  if (is('volume') || is('muted')) { audio.volume(SET.volume); audio.mute(SET.muted); }
  if (is('quality')) view.setQuality(SET.quality);
  if (is('people')) view.peopleK = Math.max(60, Math.min(160, +SET.people || 100)) / 100;
  if (is('dots') && ui.dots !== SET.dots) setDots(SET.dots);
  if (is('calm')) $('app').classList.toggle('calm', SET.calm);
  if (is('fly')) view.flyK = SET.fly;
  if (is('zoom')) view.controls.zoomSpeed = 2.2 * SET.zoom;
  if (is('advice') && st) st._noAdvice = !SET.advice;
  if (key) try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) { /* no storage here */ }
}
function setPeople(v) { SET.people = Math.max(60, Math.min(160, +v || 100)); applySet('people'); const i = $('in-people'); if (i) { i.value = SET.people; i.nextElementSibling.textContent = `${SET.people}%`; } }
function buildSettings() {
  const body = $('set-body'); body.innerHTML = '';
  const sec = (name) => { const h = document.createElement('h3'); h.className = 'set-sec'; h.textContent = name; body.appendChild(h); };
  const row = (label, hint, control) => { const r = document.createElement('div'); r.className = 'set-row'; r.innerHTML = `<div>${label}<small>${hint}</small></div>`; r.appendChild(control); body.appendChild(r); };
  const toggle = (key) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn tog'; b.dataset.k = key; const paint = () => { b.textContent = SET[key] ? 'ON' : 'OFF'; b.classList.toggle('on', !!SET[key]); }; b.onclick = () => { SET[key] = !SET[key]; paint(); applySet(key); audio.unlock(); audio.play('click'); }; paint(); return b; };
  const select = (key, opts) => { const el = document.createElement('select'); el.dataset.k = key; for (const [v, l] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = l; el.appendChild(o); } el.value = String(SET[key]); el.onchange = () => { SET[key] = el.value; applySet(key); }; return el; };
  const range = (key, min, max, step, show, id) => { const w = document.createElement('span'); w.className = 'set-vol'; const r = document.createElement('input'), v = document.createElement('b'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = SET[key]; r.dataset.k = key; if (id) r.id = id; const paint = () => { v.textContent = show(+r.value); }; r.oninput = () => { SET[key] = +r.value; paint(); applySet(key); }; paint(); w.append(r, v); return w; };
  const pct = (x) => `${Math.round(x * 100)}%`;
  sec('SOUND');
  row('Volume', 'Everything the station makes a noise about.', range('volume', 0, 1, 0.05, pct));
  row('Mute', 'Silence, without losing the volume you set.', toggle('muted'));
  sec('DISPLAY');
  row('Drawing quality', 'Low draws fewer pixels: smoother on a phone or an old laptop. High is sharper on a fine screen.', select('quality', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']]));
  row('Frames a second', 'A limit saves battery and keeps a laptop cool.', select('fps', [['auto', 'As many as the screen shows'], ['60', '60'], ['30', '30']]));
  row('People size', '100% is true to scale: a person is 1.8 m and a deck unit is 9 m.', range('people', 60, 160, 10, (x) => `${x}%`, 'in-people'));
  row('Port dots', 'The little dots that show where a part can go (J).', toggle('dots'));
  row('Calm display', 'No blinking lights or flashing banners.', toggle('calm'));
  sec('CAMERA');
  row('Flying speed', 'How fast W A S D, Space and Shift move the camera.', range('fly', 0.4, 2.5, 0.1, pct));
  row('Zoom speed', 'How far one turn of the wheel, or one pinch, goes.', range('zoom', 0.4, 2, 0.1, pct));
  sec('THE STATION');
  row('Advice on the radio', 'The Ministry and the factions say what the station needs when it matters, and once a week. Off: it is still listed under ACCOUNTS.', toggle('advice'));
}
buildSettings(); applySet();
const radioLog = [];      // everything said on comms this visit, for the RADIO LOG
let menuWas = false, menuFrom = 'game', lastSave = 0;
function menuPage(p) {
  for (const el of document.querySelectorAll('#s-menu .mpage')) el.classList.toggle('on', el.dataset.p === p);
  const title = { main: ui.started ? 'PAUSED' : 'MENU', settings: 'SETTINGS', help: 'HELP', log: 'RADIO LOG', save: 'SAVE', credits: 'CREDITS' }[p];
  $('m-title').textContent = title; $('m-backrow').classList.toggle('hidden', p === 'main'); $('m-eye').textContent = ui.started ? 'The station is paused' : 'Super Orbital Simulator';
  ui.mpage = p;
  if (p === 'settings') buildSettings();
  if (p === 'main') { $('m-status').textContent = ui.started ? `${st.sandbox ? 'Free play' : C.tiers[st.tier].name} · week ${st.week()}, day ${st.dow()} · ${st.parts.size} parts · ${st.residents()} residents` : ''; $('m-saved').textContent = st.sandbox ? 'Free play is not saved' : lastSave ? `Saved ${Math.max(0, Math.round((performance.now() - lastSave) / 1000))} s ago` : 'Saves by itself'; $('m-ver').textContent = `Prototype ${C.version}`; }
  if (p === 'log') { const box = $('m-log'); box.innerHTML = radioLog.length ? radioLog.map((x) => `<div class="rl${x.cls}" style="--c:${x.col}"><b>${x.who}</b><time>${x.at}</time><span>${x.text}</span></div>`).join('') : '<p class="fine">Nothing has been said yet.</p>'; box.scrollTop = box.scrollHeight; }
  if (p === 'save') saveText();
  if (p === 'credits') $('cr-ver').textContent = `Prototype ${C.version}.`;
}
function menu(on = !$('s-menu').classList.contains('on'), page = 'main') {
  const was = $('s-menu').classList.contains('on');
  $('s-menu').classList.toggle('on', on); audio.play('click');
  if (on && !was) { menuFrom = ui.started ? 'game' : 'title'; menuWas = ui.paused; if (ui.started && !ui.paused) pause(true); }
  if (!on && was && ui.started && !menuWas && ui.paused) pause(false);      // the station goes on from where it was
  if (on) menuPage(page);
}
$('b-menu').onclick = () => menu(); $('b-close').onclick = () => menu(false); $('m-x').onclick = () => menu(false);
$('m-back').onclick = () => { audio.play('click'); if (menuFrom === 'title') menu(false); else menuPage('main'); };
$('b-settings-t').onclick = () => { audio.unlock(); menu(true, 'settings'); };
for (const b of document.querySelectorAll('#s-menu [data-go]')) b.onclick = () => { audio.play('click'); menuPage(b.dataset.go); };
// Saving: by itself every few seconds; here, now; and as a code that can be carried to another device.
const toCode = (o) => `SOS1:${btoa(unescape(encodeURIComponent(JSON.stringify(o))))}`;
const fromCode = (t) => { const m = /SOS1:([A-Za-z0-9+/=\s]+)/.exec(t || ''); if (!m) return null; try { return JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/\s+/g, ''))))); } catch (e) { return null; } };
function saveText() {
  const free = st.sandbox || !ui.started;
  $('sv-status').textContent = !ui.started ? 'No station is running. A save code can still be loaded below.' : st.sandbox ? 'Free play is not saved: it is a sandbox.' : `The station saves itself every 15 seconds, and when you leave for the title screen. ${lastSave ? `Last saved ${Math.max(0, Math.round((performance.now() - lastSave) / 1000))} seconds ago.` : ''}`;
  $('sv-now').disabled = free; $('sv-copy').disabled = free;
  $('sv-code').value = free ? '' : toCode(st.save()); $('sv-msg').textContent = '';
}
$('sv-now').onclick = () => { writeSave(); audio.play('built'); saveText(); $('sv-msg').textContent = 'Saved.'; };
$('sv-copy').onclick = async () => {
  const t = $('sv-code'); t.focus(); t.select();
  let ok = false; try { await navigator.clipboard.writeText(t.value); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
  $('sv-msg').textContent = ok ? `Copied: ${t.value.length.toLocaleString('en-US')} characters.` : 'Could not copy from here. The code is selected: copy it by hand.';
};
$('sv-load').onclick = () => {
  const data = fromCode($('sv-in').value), s = data && (() => { try { return Station.load(data); } catch (e) { return null; } })();
  if (!s) { audio.play('deny'); $('sv-msg').textContent = data ? `That code is from another version of the game (this is ${C.version}).` : 'That is not a save code. It starts with SOS1:'; return; }
  $('sv-in').value = ''; $('s-menu').classList.remove('on'); $('s-title').classList.remove('on'); ui.paused = false; $('b-pause').textContent = 'II'; $('b-pause').classList.remove('on');
  start(s.mode, s); writeSave();
};
// ---------------------------------------------------------------- events from the simulation
let bannerT = 0;
function showBanner(title, sub, sec, bad = false) { const b = $('banner'); b.innerHTML = `${title}<small>${sub}</small>`; b.classList.toggle('bad', bad); b.classList.add('show'); bannerT = sec; }
function drain() {
  for (const e of st.events) {
    if (!ui.started) continue;
    switch (e.type) {
      case 'built': audio.play('built'); break;
      case 'crate': audio.play('crate'); break;
      case 'comms': radio(e.from, e.text, e); if (e.from === 'maintenance' && e.warn) audio.play('fault'); break;
      case 'order': radio(e.from, e.text); break;
      case 'request': { const bar = reqEls.get(e.id); if (bar) { bar.innerHTML = `<span class="rq-out ${e.outcome}">${e.label || OUTCOME[e.outcome] || ''}</span>`; reqEls.delete(e.id); } drawDesk(); break; }
      case 'week': audio.play('milestone'); break;
      case 'raid':
        if (e.state === 'warn') { audio.play('fault'); showBanner('RAIDERS INBOUND', `Defence ${st._defence()} against about ${st.raid ? st.raid.strength : '?'}. Turrets, shields, fighters and officers all count.`, 5, true); }
        else if (e.state === 'over') { audio.play(e.hits.length ? 'fault' : 'milestone'); showBanner(e.hits.length ? 'THE RAIDERS GOT THROUGH' : 'RAID DRIVEN OFF', e.hits.length ? `${e.hits.length} part${e.hits.length > 1 ? 's' : ''} damaged. Engineers are on their way.` : 'No damage. Security is very pleased with itself.', 5, e.hits.length > 0); }
        break;
      case 'restored': audio.play('milestone'); showBanner('STATION RESTORED', 'Every part lit, the decks refitted, people aboard.', 8); break;
      case 'auto': audio.play('built'); break;
      case 'fire': view.fire(e); audio.play(e.sys === 'gun' || e.sys === 'orbital' || e.sys === 'classified' ? 'fault' : 'crate'); break;
      case 'tier': {
        audio.play('milestone');
        const T = C.tiers[e.tier], u = st.unlocksOf(e.tier);
        showBanner(`${T.name} STATUS GRANTED`, `The build zone grows to ${T.radius}. ${[...u.parts, ...u.rooms].length ? `New: ${[...u.parts, ...u.rooms].join(', ')}.` : ''}`, 6); buildGrid();
        break;
      }
    }
  }
  st.events.length = 0;
}

// ---------------------------------------------------------------- HUD
function hud() {
  $('r-cr').textContent = st.sandbox ? '∞' : Math.round(st.credits).toLocaleString('en-US');
  if (ui.riTip) riTip();
  $('r-cap').textContent = st.capability().toLocaleString('en-US');
  $('cm-badge').textContent = st.requests.length || '';
  $('wk').textContent = `WEEK ${st.week()} · DAY ${st.dow()}`; $('w-fill').style.width = `${(st.weekPart() * 100).toFixed(1)}%`;
  drawDesk();
  $('r-pw').textContent = `${st.demand}/${st.supply}`; $('r-pw').style.color = st.eff < 1 ? 'var(--red)' : '';
  $('r-pop').textContent = `${st.residents()}/${st.beds()}`;
  const mo = Math.round(st.morale), mt = Object.values(st.moraleParts()).reduce((s, x) => s + x, 0); $('r-mo').textContent = `${mo}${mt > st.morale + 2 ? ' ▲' : mt < st.morale - 2 ? ' ▼' : ''}`; $('r-mo').style.color = mo >= 55 ? '' : mo >= 35 ? 'var(--amber)' : 'var(--red)';
  $('r-sh').textContent = `${st.stats.ships} · ${st.stats.lost}`;
  const rdy = Math.round(st.platform().ready * 100); $('r-rdy').textContent = `${rdy}%`; $('r-rdy').style.color = !st.platformN ? 'var(--red)' : rdy >= 60 ? '' : 'var(--amber)';
  const n = st.next();
  $('tier').textContent = st.sandbox ? 'FREE PLAY' : C.tiers[st.tier].name;
  $('tier-next').textContent = st.sandbox ? '' : n ? ` · next ${n.items.filter((i) => i.ok).length}/${n.items.length}` : ' · top of the path';
  gridState();
  if (!ui.tool) info();
  if (st.sandbox && !$('simpanel').classList.contains('hidden')) simStats();
  if (!$('cmdr').classList.contains('hidden')) { cmdrText(); drawFac(); }
  if (!$('upg').classList.contains('hidden')) drawUpg();
  fitComms();
}
// The comms window sits above the minimap and gives way to the free play panel above it.
function fitComms() {
  const panelTop = $('panel').getBoundingClientRect().top, desk = $('desk'), topBar = (desk.classList.contains('hidden') ? $('top') : desk).getBoundingClientRect().bottom;
  $('comms').style.maxHeight = `${Math.max(84, Math.min(innerHeight * (innerHeight < 520 ? 0.3 : 0.4), panelTop - topBar - 24))}px`;
}
let infoHTML = '', infoPeek = null;
function setInfo(html, bind) { if (html === infoHTML) return; infoHTML = html; $('info').innerHTML = html; if (bind) bind(); }
function stat(label, value, cls = '') { return `<span class="${cls}"><i>${label}</i>${value}</span>`; }
const pw = (d) => (d.pw < 0 ? `+${-d.pw}` : `−${d.pw}`);
function roomSums(rooms) {
  const s = { beds: 0, leisure: 0, income: 0, homes: {} };
  for (const r of rooms) { const R = C.rooms[r]; s.beds += R.beds || 0; s.leisure += R.leisure || 0; s.income += R.income || 0; for (const [k, v] of Object.entries(R.homes || {})) s.homes[k] = (s.homes[k] || 0) + v; }
  return s;
}
function sumStats(s) {
  return (s.beds ? stat('BEDS', s.beds) : '') + (s.leisure ? stat('MORALE', `${s.leisure > 0 ? '+' : ''}${s.leisure}`) : '') + (s.income ? stat('INCOME', `+${s.income}/min`) : '')
    + Object.entries(s.homes).map(([k, v]) => stat(ROLE[k].toUpperCase(), v)).join('');
}
function info(peek) {
  if (peek !== undefined) infoPeek = peek;
  const pk = ui.tool ? { part: ui.tool } : infoPeek;
  if (ui.edit) { editInfo(pk && pk.room); return; }
  if (pk && pk.part) {
    const t = pk.part, d = C.parts[t], locked = !st.partOpen(t), s = roomSums(d.rooms || []);
    setInfo(`<div class="in">${d.name.toUpperCase()}${locked ? ` <span class="lk">${C.tiers[d.tier].name}</span>` : ''}</div><div class="ia">${d.about}</div>`
      + `<div class="st">${stat('COST', `${d.cost} CR`, st.credits < d.cost && !st.sandbox ? 'bad' : '')}${stat('POWER', pw(d))}${stat('UPKEEP', `${d.up}/min`)}${st.sandbox ? '' : (() => { const n = st.ledger().credits.net - st.costOf(t).up; return stat('NET AFTER', `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n))}/min`, n < -0.5 ? 'bad' : 'ok'); })()}${SLOTS[t] ? stat('ROOMS', SLOTS[t].length) : ''}${sumStats(s)}${d.crates ? stat('CRATES', d.crates) : ''}</div>`
      + (ui.tool ? `<div class="ia">Click near a port to attach it (little blue dots near the pointer). <b>R</b> turns it (${ui.rot * 45}°). Right-click or Esc puts it down.</div>` : ''));
    return;
  }
  if (ui.person) {
    const a = st.agents.find((x) => x.id === ui.person);
    if (a) { personInfo(a); return; }
    ui.person = 0;
  }
  const p = ui.sel && st.parts.get(ui.sel);
  if (p) {
    const d = C.parts[p.type];
    const state = p.state === 'building' ? `<span class="warn">Building ${Math.round(p.prog * 100)}%</span>` : p.state === 'demolish' ? '<span class="bad">Coming down</span>'
      : p.fault ? `<span class="warn">Fault: ${st.agents.some((a) => a.eva && a.at === p.id) ? 'engineers on EVA' : st.staff.engineer ? 'engineers on the way' : 'no engineers'}</span>` : '<span class="ok">Running</span>';
    let extra = '';
    const s = roomSums(p.rooms), housed = st.agents.filter((a) => a.home === p.id);
    if (s.beds) extra += stat('RESIDENTS', `${housed.filter((a) => a.role === 'resident').length}/${s.beds}`);
    const staff = housed.filter((a) => a.role !== 'resident').length; if (staff) extra += stat('STAFF', staff);
    if (d.berth) { const b = st.berthStatus(p); extra += stat('BERTH', ['open', 'busy'].includes(b.k) ? b.why : `<span class="down">${b.why}</span>`); }
    const counts = {}; for (const r of p.rooms) counts[r] = (counts[r] || 0) + 1;
    const chips = Object.entries(counts).map(([r, n]) => `<span class="chip" style="--c:${C.rooms[r].col}">${C.rooms[r].short || 'EMPTY'}${n > 1 ? ` ×${n}` : ''}</span>`).join('');
    const cd = st.canDemolish(p.id), ed = SLOTS[p.type];
    setInfo(`<div class="in">${st.name(p).toUpperCase()}</div>${chips ? `<div class="chips">${chips}</div>` : `<div class="ia">${d.about}</div>`}`
      + `<div class="st">${stat('STATUS', state)}${stat('POWER', pw(d))}${extra}</div>`
      + `<div class="acts"><button class="btn" id="a-focus" type="button">FOCUS <small>F</small></button>`
      + (ed ? `<button class="btn hl" id="a-edit" type="button" ${p.state === 'active' ? '' : 'disabled'}>EDIT INSIDE <small>I</small></button>` : '')
      + (p.type !== 'command' ? `<button class="btn" id="a-demo" type="button" ${cd.ok ? '' : 'disabled'} title="${cd.why}">DEMOLISH <small>X</small> ${cd.ok ? `+${Math.round(d.cost * C.demolish.refund)} CR` : ''}</button>` : '') + '</div>', () => {
      $('a-focus').onclick = () => view.focus(p.id);
      if ($('a-edit')) $('a-edit').onclick = () => startEdit(p.id);
      if ($('a-demo')) $('a-demo').onclick = () => demolishSel();
    });
    return;
  }
  const n = st.next();
  setInfo(`<div class="in">${st.sandbox ? 'FREE PLAY' : `STATION OVERVIEW · ${C.tiers[st.tier].name}`}</div>`
    + (() => { const a = st.asks()[0]; return `<div class="ia${a ? ' asked' : ''}">${st.requests.length ? `<b>${st.requests.length} on your desk.</b> ` : ''}${a ? `<b class="${a.urgent ? 'down' : ''}">${a.text}</b> <span class="why">${a.why}</span> <button type="button" class="lk2" id="a-accts">ACCOUNTS</button>` : 'Pick a part on the left and click near a port. Select a part to set its rooms. The factions do the rest: their moods are below.'}</div>`; })()
    + (st.goal && !st.goal.done ? `<ul class="ms">${st.goalItems().map((i) => `<li class="${i.ok ? 'ok' : ''}">${i.label} ${Math.min(i.have, i.need)}/${i.need}</li>`).join('')}<li class="nx">Bring the station back: every item above.</li></ul>` : '')
    + `<div class="st moods">${Object.keys(C.factions).filter((k) => st.roomOpen(C.factions[k].room)).map((k) => stat(C.factions[k].who.toUpperCase(), Math.round(st.sat[k]), st.sat[k] < C.faction.low ? 'bad' : st.sat[k] >= 65 ? 'ok' : 'warn')).join('')}</div>`
    + (st.sandbox || !n || (st.goal && !st.goal.done) ? '' : `<ul class="ms">${n.items.map((i) => `<li class="${i.ok ? 'ok' : ''}">${i.label} ${Math.min(i.have, i.need)}/${i.need}</li>`).join('')}<li class="nx">Next: ${n.name}. The full path is under UPGRADES (U).</li></ul>`), () => { const b = $('a-accts'); if (b) b.onclick = () => openLedger('asks'); });
}
// One person: who they are, who they work for, and what they are doing right now.
function personInfo(a) {
  const k = C.divOrder.find((d) => C.div[d].staff === a.role), home = st.parts.get(a.home), at = st.parts.get(a.at);
  const fol = ui.follow === a.id;
  setInfo(`<div class="in edit"><span>${a.name.toUpperCase()}</span><button class="btn${fol ? ' on' : ''}" id="a-follow" type="button" title="Keep the camera on this person (F). Click them again in the station to do the same.">${fol ? 'FOLLOWING' : 'FOLLOW'} <small>F</small></button><button class="btn primary" id="a-done" type="button">DONE</button></div>`
    + `<div class="ia">${ROLE_ONE[a.role]}${k ? `, ${C.factions[k].who}` : ''}. ${k ? `${C.factions[k].who} is ${st.sat[k] >= 65 ? 'in good spirits' : st.sat[k] >= C.faction.low ? 'getting by' : 'unhappy'}.` : ''}</div>`
    + `<div class="st">${stat('DOING', st.doing(a))}${stat('IN', at ? st.name(at) : '—')}${stat(a.role === 'resident' ? 'QUARTERS' : 'POSTED', home ? st.name(home) : '—')}${stat('ABOARD', `${Math.max(1, Math.round((st.t - a.since) / C.time.daySec))} days`)}</div>`
    + `<ul class="story">${a.story.slice(-3).reverse().map((x) => `<li><i>${x.d}</i>${x.text}</li>`).join('')}</ul>`, () => {
    $('a-follow').onclick = () => setFollow(ui.follow === a.id ? 0 : a.id);
    $('a-done').onclick = () => { audio.play('click'); select(null); };
  });
}
function editInfo(peekRoom) {
  const p = st.parts.get(ui.edit);
  if (!p) { endEdit(); return; }
  const r = peekRoom || ui.room, R = r && C.rooms[r], s = roomSums(p.rooms);
  const chips = p.rooms.map((x, i) => `<button type="button" class="chip${ui.slot === i ? ' on' : ''}" data-i="${i}" style="--c:${C.rooms[x].col}">${i + 1} ${C.rooms[x].short || '—'}</button>`).join('');
  const sel = ui.slot != null ? `Room ${ui.slot + 1} is a <b>${C.rooms[p.rooms[ui.slot]].name}</b>. ` : '';
  const how = R ? `<b>${R.name}</b>${R.cost ? ` · ${R.cost} CR` : ''}${R.up ? ` · upkeep ${R.up}/min` : ''}. ${R.about || 'Clears the room.'}${r !== 'empty' ? ' Click a room that is already one to rearrange it.' : ''}`
    : `${sel}Pick a room on the left, then click a room inside the part${view.touch ? ' (or tap a number below)' : ''}.`;
  setInfo(`<div class="in edit"><span>EDITING · ${st.name(p).toUpperCase()}</span><button class="btn" id="a-focus" type="button">FOCUS <small>F</small></button><button class="btn primary" id="a-done" type="button">DONE <small>I</small></button></div>`
    + `<div class="ia">${how}</div><div class="chips">${chips}</div><div class="st">${sumStats(s) || stat('ROOMS', 'all empty')}</div>`, () => {
    $('a-done').onclick = () => { audio.play('click'); endEdit(); };
    $('a-focus').onclick = () => view.focus(p.id, true);
    for (const b of $('info').querySelectorAll('.chip[data-i]')) b.onclick = () => {
      const i = +b.dataset.i; ui.slot = ui.slot === i ? null : i;
      view.setSlotHot(ui.slot != null ? { part: p.id, slot: i } : null); audio.play('click'); info();
    };
  });
}

// ---------------------------------------------------------------- minimap: the station from above
const mini = $('mini'), mx = mini.getContext('2d');
const RINGS = { ring: 7, bigring: 12.5, disc: 5.6, drum: 4.7 };
// The minimap is switched off for now (the player asked for it hidden). Set MINIMAP to true to bring it back.
const MINIMAP = false;
mini.classList.toggle('hidden', !MINIMAP);
function drawMini() {
  if (!MINIMAP) return;
  const W = mini.width, H = mini.height, R = W / 2 - 6, span = Math.max(20, st.radius) * 1.05, k = R / span;
  mx.clearRect(0, 0, W, H);
  mx.save(); mx.translate(W / 2, H / 2);
  mx.strokeStyle = 'rgba(127,233,224,0.14)'; mx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { mx.beginPath(); mx.arc(0, 0, R * i / 4, 0, 6.283); mx.stroke(); }
  mx.beginPath(); mx.moveTo(-R, 0); mx.lineTo(R, 0); mx.moveTo(0, -R); mx.lineTo(0, R); mx.stroke();
  mx.setLineDash([4, 4]); mx.strokeStyle = 'rgba(245,213,71,0.6)'; mx.beginPath(); mx.arc(0, 0, st.radius * k, 0, 6.283); mx.stroke(); mx.setLineDash([]);
  for (const p of st.parts.values()) {
    const c = st.center(p), x = c[0] * k, y = c[2] * k, sel = p.id === ui.sel;
    mx.strokeStyle = sel ? '#f5d547' : p.fault ? '#ff6a4d' : p.state === 'active' ? 'rgba(127,233,224,0.9)' : 'rgba(245,213,71,0.6)'; mx.fillStyle = mx.strokeStyle;
    if (RINGS[p.type]) { mx.beginPath(); mx.arc(x, y, RINGS[p.type] * k, 0, 6.283); mx.stroke(); }
    else if (C.parts[p.type].ports[0][6] === 'L') { const b0 = st.port(p, 0).pos; mx.beginPath(); mx.moveTo(b0[0] * k, b0[2] * k); mx.lineTo(x + (x - b0[0] * k), y + (y - b0[2] * k)); mx.lineWidth = 2; mx.stroke(); mx.lineWidth = 1; }
    else { mx.fillRect(x - 2, y - 2, 4, 4); }
  }
  for (const s of st.ships) {
    const o = view.shipObjs.get(s.id); if (!o) continue;
    const x = o.position.x * k, y = o.position.z * k;
    if (Math.hypot(x, y) > R) continue;
    mx.fillStyle = s.state === 'hold' ? '#f5d547' : s.kind === 'warship' ? '#e6eadc' : '#7fe9e0'; mx.fillRect(x - 2, y - 2, 4, 4);
  }
  const cam = view.camera.position, tg = view.controls.target, a = Math.atan2(tg.z - cam.z, tg.x - cam.x), cx = cam.x * k, cy = cam.z * k;
  const d = Math.min(R * 0.9, Math.hypot(cam.x, cam.z) * k), clampR = (v) => Math.max(-R, Math.min(R, v));
  mx.fillStyle = 'rgba(255,255,255,0.08)'; mx.strokeStyle = 'rgba(255,255,255,0.5)';
  mx.beginPath(); mx.moveTo(clampR(cx), clampR(cy)); mx.arc(clampR(cx), clampR(cy), d * 0.5 + 10, a - 0.35, a + 0.35); mx.closePath(); mx.fill(); mx.stroke();
  mx.restore();
}
mini.addEventListener('click', (e) => {
  const r = mini.getBoundingClientRect(), R = r.width / 2 - 6 * r.width / mini.width, span = Math.max(20, st.radius) * 1.05;
  const x = (e.clientX - r.left - r.width / 2) / R * span, z = (e.clientY - r.top - r.height / 2) / R * span;
  const d = view.camera.position.clone().sub(view.controls.target);
  view.controls.target.set(x, view.controls.target.y, z); view.camera.position.copy(view.controls.target).add(d);
});

// ---------------------------------------------------------------- four corner brackets frame the view, as in Orbital Fury. Nothing else lies over the scene.
function fx() {
  const c = $('fx'), dpr = Math.min(devicePixelRatio || 1, 2), W = c.width = Math.round(innerWidth * dpr), H = c.height = Math.round(innerHeight * dpr), g = c.getContext('2d');
  const L = 18 * dpr, m = 6 * dpr, top = 46 * dpr;
  g.strokeStyle = 'rgba(127,233,224,0.55)'; g.lineWidth = 1.4 * dpr; g.beginPath();
  for (const [x, y, sx, sy] of [[m, top, 1, 1], [W - m, top, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { g.moveTo(x + L * sx, y); g.lineTo(x, y); g.lineTo(x, y + L * sy); }
  g.stroke();
}
// ---------------------------------------------------------------- speech bubbles: people near the camera say something now and then
let bubbles = [], chatT = 5;
function clearBubbles() { for (const b of bubbles) b.el.remove(); bubbles = []; }
function bubbleTick(dt, now) {
  if (!ui.started || ui.clean || !view.figOn) { if (bubbles.length) clearBubbles(); return; }
  if ((chatT -= dt) <= 0) {
    chatT = 4 + Math.random() * 5;
    const near = st.agents.filter((a) => !a.eva && !bubbles.some((b) => b.id === a.id)).map((a) => ({ a, s: view.agentScreen(a, now) })).filter((x) => x.s && x.s.d < 26 && x.s.x > 60 && x.s.x < innerWidth - 60 && x.s.y > 80 && x.s.y < innerHeight - 200);
    if (near.length) {
      const { a } = near[Math.floor(Math.random() * near.length)], pool = CHAT[a.role] || CHAT.resident;
      const k = C.divOrder.find((d) => C.div[d].staff === a.role);
      const line = k && st.short[k] && Math.random() < 0.6 ? `We are out of ${C.supplies[C.div[k].uses].name.toLowerCase()}.` : k && st.sat[k] < C.faction.low && Math.random() < 0.5 ? 'Nobody asked us about any of this.' : pool[Math.floor(Math.random() * pool.length)];
      if (bubbles.length >= 3) { bubbles[0].el.remove(); bubbles.shift(); }
      const el = document.createElement('div'); el.className = 'bubble'; el.innerHTML = `<i>${a.name}</i>${line}`; $('bubbles').appendChild(el);
      bubbles.push({ id: a.id, el, t: 4.5 });
    }
  }
  for (const b of bubbles) {
    b.t -= dt;
    const a = st.agents.find((x) => x.id === b.id), s = a && view.agentScreen(a, now);
    if (!s || b.t <= 0) { b.el.remove(); b.dead = true; continue; }
    b.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%) translateY(-14px)`; b.el.style.opacity = Math.min(1, b.t * 2);
  }
  bubbles = bubbles.filter((b) => !b.dead);
}
addEventListener('pagehide', writeSave);
addEventListener('resize', () => { view.resize(); fx(); if (ui.started) fitComms(); });
fx();

// ---------------------------------------------------------------- loop
const STEP = 1 / 30;
let last = performance.now(), acc = 0, hudT = 0, miniT = 0, saveT = 15;
function frame(nowMs) {
  if (SET.fps !== 'auto' && nowMs - last < 1000 / +SET.fps - 2) { requestAnimationFrame(frame); return; }      // a limit on frames a second
  const now = nowMs / 1000, dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
  if (!ui.paused) {
    acc += dt * (ui.started ? ui.speed : 1);
    let n = 0;
    while (acc >= STEP && n++ < 20) { st.step(STEP); acc -= STEP; }
    if (n >= 20) acc = 0;
  }
  drain();
  // Following someone: the camera stays with them until you fly it yourself, pick something else, or they leave the station.
  if (ui.follow) {
    const a = st.agents.find((x) => x.id === ui.follow);
    if (!a || ['w', 'a', 's', 'd', ' ', 'shift'].some((k) => held.has(k)) || !view.follow(a, dt)) { ui.follow = 0; info(); }
  }
  if (held.size && ui.started) view.fly((held.has('w') ? 1 : 0) - (held.has('s') ? 1 : 0), (held.has('d') ? 1 : 0) - (held.has('a') ? 1 : 0), (held.has(' ') ? 1 : 0) - (held.has('shift') ? 1 : 0), (held.has('e') ? 1 : 0) - (held.has('q') ? 1 : 0), dt);
  view.sync(now, dt);
  if (ui.tool && ui.portsDirty) { ui.portsDirty = false; view.showPorts(ui.tool, ui.rot, ui.hot, ui.px, ui.py); }
  view.render(now);
  typeTick(dt); cmTick(dt); bubbleTick(dt, now);
  if (ui.started) {
    if ((hudT -= dt) <= 0) { hudT = 0.25; hud(); if (ui.tool) ui.portsDirty = true; }
    if ((miniT -= dt) <= 0) { miniT = 0.1; drawMini(); }
    if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');
    if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
    if (peekT > 0 && (peekT -= dt) <= 0) $('app').classList.remove('peek');
    if ((saveT -= dt) <= 0) { saveT = 15; writeSave(); }
  }
  requestAnimationFrame(frame);
}
if (qs.has('economy') || qs.has('run')) start('run'); else if (qs.has('broken')) start('broken'); else if (qs.has('free') || qs.has('sandbox')) start('sandbox');
requestAnimationFrame(frame);
