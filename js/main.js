// Boot, the main loop, input and the HUD. The simulation (sim.js) never touches the page; the view (view.js) draws it.
import { C } from './config.js';
import { Station } from './sim.js';
import { View } from './view.js';
import { partIcon, SLOTS } from './parts.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const KEYS = ['q', 'w', 'e', 't', 'y', 'a', 's', 'd'];          // the parts of the open group, left to right
const GROUP_SHORT = { structure: 'STRUCT', habitation: 'HAB', docking: 'DOCK', industry: 'INDUS', power: 'POWER', defence: 'DEF', comms: 'COMMS' };
const ROLE = { hauler: 'haulers', engineer: 'engineers', officer: 'officers', medic: 'medics' };
const ROLE_ONE = { hauler: 'Hauler', engineer: 'Engineer', officer: 'Democracy Officer', medic: 'Medic', resident: 'Resident' };
const PLACES = { hauler: 'Cargo Stores, Cargo Racks and Station Command', engineer: 'Workshops', officer: 'Security Offices', medic: 'Medbays' };
const ORDER_NAMES = { shift: 'SHIFTS', plan: 'MAINTENANCE PLAN', checks: 'SHIP INSPECTIONS', care: 'MEDICAL CARE', mix: 'TRAFFIC MIX', rate: 'TRAFFIC VOLUME', broadcast: 'BROADCAST' };
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
  captain:     { n: 9, name: 'SHIP-TO-STATION', col: '#7fc8ff', off: ['Over.', 'Over and out.', 'For democracy, over.'] },
};
const audio = new Audio();
const ui = { started: false, tool: null, rot: 0, hot: null, sel: null, paused: false, speed: 1, view: 'hull', cut: false, group: 'structure',
  edit: null, room: null, slot: null, px: null, py: null, portsDirty: false, dots: true, clean: false, div: 'supply', comms: true, person: 0 };

// ---------------------------------------------------------------- the title backdrop: an example station, turning slowly
function demoStation() {
  const s = new Station(3, 'sandbox');
  const b = (t, h, p, r = 0) => { const x = s.build(t, h, p, r); return x.ok ? x.id : 0; };
  const c1 = b('core', 1, 1), re = b('reactor', c1, 1); b('spire', re, 1);
  b('solar', c1, 2); b('solar', c1, 4); b('dish', c1, 3); b('billboard', c1, 5);
  const ring = b('ring', 1, 0), c2 = b('core', ring, 1), big = b('bigring', c2, 1), disc = b('disc', big, 1); b('dome', disc, 1);
  for (const p of [2, 3, 4, 5]) b('dockport', ring, p);
  b('pylon', big, 2); b('hangar', big, 3); b('pylon', big, 4); b('drydock', big, 5); b('pylon', big, 6); b('tanks', big, 7);
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
function start(mode) {
  audio.unlock();
  st = new Station(Number(qs.get('seed')) || (Date.now() % 100000), mode);
  window.__st = st; window.__ui = ui;
  view.setStation(st);
  view.controls.autoRotate = false;
  view.frame();
  Object.assign(ui, { started: true, tool: null, sel: null, hot: null, edit: null, room: null, slot: null, group: 'structure', speed: 1, person: 0 });
  setView('hull'); setCut(false); setClean(false);
  $('s-title').classList.remove('on'); $('hud').classList.remove('hidden');
  $('b-speed').textContent = '1×';
  const free = mode === 'sandbox';
  $('b-sim').classList.toggle('hidden', !free);
  closeFloats(null);
  simPanel(free && innerHeight > 520, true);
  $('t-traffic').classList.add('on'); $('t-traffic').textContent = 'TRAFFIC ON';
  $('c-list').innerHTML = ''; typing.length = 0; reqEls.clear(); setComms(true);
  if (free) radio('ministry', 'Free play, Commander. Every part and every room is open to you, and none of it costs a credit. Build whatever you like.');
  else radio('ministry', `Welcome aboard, Commander. The Ministry grants you an Outpost permit and ${C.start.credits.toLocaleString('en-US')} CR. Start with a Docking Port, and somewhere to put the cargo.`);
  radio('ministry', 'Your divisions answer on the Commander\'s channel (O). Select a part and press EDIT INSIDE (I) to build out its rooms.', { dim: true });
  buildGrid(); hud(); info();
}
$('b-economy').onclick = () => start('run');
$('b-free').onclick = () => start('sandbox');
$('b-restart').onclick = () => {
  $('s-menu').classList.remove('on'); endEdit(); setTool(null);
  closeFloats(null); $('simpanel').classList.add('hidden');
  ui.started = false; setClean(false); $('hud').classList.add('hidden'); $('s-title').classList.add('on');
  st = demoStation(); view.setStation(st); view.setMode('hull'); view.setCutaway(false); view.controls.autoRotate = true; view.camera.position.set(34, 16, 40); view.controls.target.set(0, 0, 0);
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
    b.innerHTML = `${partIcon(t)}<kbd>${KEYS[i].toUpperCase()}</kbd>`;
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
function select(id) { ui.sel = id; ui.person = 0; view.select(id); info(); }
function pickPerson(id) { select(null); ui.person = id; audio.play('click'); info(); }

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
  else if (r.why && r.why !== 'Already that room') { audio.play('deny'); toast(r.why); }
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
  for (const b of document.querySelectorAll('.vb')) if (b.dataset.v !== 'cut') b.classList.toggle('on', b.dataset.v === v);
}
function setCut(on) { ui.cut = on; view.setCutaway(on); document.querySelector('.vb[data-v="cut"]').classList.toggle('on', on); }
for (const b of document.querySelectorAll('.vb')) b.onclick = () => { audio.play('click'); if (b.dataset.v === 'cut') setCut(!ui.cut); else setView(b.dataset.v); };
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
  $('b-showui').classList.toggle('hidden', !on); hideTip(); $('app').classList.remove('peek'); peekT = 0;
  if (on && ui.tool) setTool(null);
  if (on && ui.edit) endEdit();
  if (on) { select(null); closeFloats(null); $('simpanel').classList.add('hidden'); view.showPorts(null); view.setGhost(null, null, 0); }
}
$('b-hide').onclick = () => { audio.play('click'); setClean(true); };
$('b-showui').onclick = () => { audio.play('click'); setClean(false); };

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
  $('tip').innerHTML = `<b>${C.parts[ui.tool].name}</b> on ${st.name(st.parts.get(p.part))}<br>${chk.ok ? ok : `<span class="down">${chk.why}</span>`}`;
  showTip(x, y);
}
function showTip(x, y) {
  const tip = $('tip'); tip.classList.remove('hidden');
  tip.style.left = `${Math.min(innerWidth - tip.offsetWidth - 8, x + 16)}px`; tip.style.top = `${Math.max(48, y - tip.offsetHeight - 12)}px`;
}
function hideTip() { $('tip').classList.add('hidden'); }
let toastT = 0;
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); toastT = 2.6; }

// ---------------------------------------------------------------- keys
addEventListener('keydown', (e) => {
  if (!ui.started || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (ui.clean) { if (k === 'h' || k === 'escape') setClean(false); return; }
  if (k === 'tab') { e.preventDefault(); if (ui.edit) return; const i = C.groups.findIndex((g) => g.id === ui.group), n = C.groups.length; ui.group = C.groups[(i + (e.shiftKey ? n - 1 : 1)) % n].id; audio.play('click'); buildGrid(); return; }
  const gi = KEYS.indexOf(k), list = partsOf(ui.group);
  if (!ui.edit && gi >= 0 && gi < list.length) { const t = list[gi]; setTool(ui.tool === t ? null : t); return; }
  if (k === 'r') { ui.rot = (ui.rot + 1) % 8; audio.play('click'); if (ui.tool) { ui.portsDirty = true; view.ghostKey = ''; view.setGhost(ui.tool, ui.hot, ui.rot); } info(); }
  else if (k === 'x') demolishSel();
  else if (k === 'f' && ui.sel) view.focus(ui.sel);
  else if (k === 'i') { if (ui.edit) endEdit(); else if (ui.sel && canEdit(ui.sel)) startEdit(ui.sel); }
  else if (k === 'escape') {
    if ($('s-menu').classList.contains('on')) menu(false);
    else if (!$('cmdr').classList.contains('hidden')) cmdr(false);
    else if (!$('upg').classList.contains('hidden')) upg(false);
    else if (ui.edit) { if (ui.room) { ui.room = null; paletteState(); info(); } else endEdit(); }
    else { setTool(null); select(null); }
  }
  else if (k === ' ') { e.preventDefault(); pause(); }
  else if (k === '1') setView('blueprint'); else if (k === '2') setView('hull'); else if (k === '3') setView('life'); else if (k === '4') setCut(!ui.cut);
  else if (k === 'm') menu();
  else if (k === 'k') simPanel();
  else if (k === 'o') cmdr();
  else if (k === 'u') upg();
  else if (k === 'c') { setComms(!ui.comms); audio.play('click'); }
  else if (k === 'p') { setDots(); audio.play('click'); }
  else if (k === 'h') setClean(true);
});
function demolishSel() {
  if (!ui.sel) return;
  if (ui.edit === ui.sel) endEdit();
  const r = st.demolish(ui.sel);
  if (r.ok) { audio.play('place'); select(null); } else { audio.play('deny'); toast(r.why); }
}
function pause(on = !ui.paused) { ui.paused = on; $('b-pause').textContent = on ? '▶' : 'II'; $('b-pause').classList.toggle('on', on); audio.play('click'); }
$('b-pause').onclick = () => pause();
$('b-speed').onclick = () => {
  const steps = st.sandbox ? [1, 2, 4, 8, 16] : [1, 2, 4];
  ui.speed = steps[(steps.indexOf(ui.speed) + 1) % steps.length] || 1; $('b-speed').textContent = `${ui.speed}×`; audio.play('click');
};

// ---------------------------------------------------------------- station comms: every channel, typed out as it comes in
const typing = [], reqEls = new Map();
const OUTCOME = { approved: 'APPROVED', denied: 'DENIED', expired: 'NO ANSWER', void: 'NO LONGER POSSIBLE' };
// Answer a faction's request, from the comms window or from its tab in the Commander's channel.
function answer(id, yes) {
  const r = yes ? st.approve(id) : st.deny(id);
  if (!r.ok) { audio.play('deny'); if (r.why) toast(r.why); }
  else audio.play(yes ? 'place' : 'click');
  info(); if (!$('cmdr').classList.contains('hidden')) drawFac();
}
const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function radio(from, text, o = {}) {
  const ch = CH[from] || CH.ministry, list = $('c-list');
  const el = document.createElement('div');
  el.className = `cm new${o.warn ? ' warn' : ''}${o.gold ? ' gold' : ''}${o.dim ? ' dim' : ''}`;
  el.style.setProperty('--c', ch.col);
  const bars = 2 + Math.floor(Math.random() * 3), off = ch.off[Math.floor(Math.random() * ch.off.length)];
  el.innerHTML = `<div class="cmh"><span class="led"></span><b>CH ${ch.n} · ${ch.name}</b><span class="sig">${'▂▄▆█'.slice(0, bars)}<s>${'▂▄▆█'.slice(bars)}</s></span><time>${ui.started ? clock(st.t) : ''}</time></div><div class="cmt"></div>${off ? `<div class="cms">— ${off}</div>` : ''}`;
  const body = (from === 'captain' || from === 'colonists') && Math.random() < 0.3 ? `*kssht* ${text}` : text;
  // A faction asking for something carries its answer buttons right in the message.
  if (o.request) {
    const bar = document.createElement('div');
    bar.className = 'rq-bar';
    bar.innerHTML = '<button type="button" class="btn primary" data-a="ok">APPROVE</button><button type="button" class="btn" data-a="no">DENY</button>';
    bar.onclick = (ev) => { const b = ev.target.closest('button'); if (b) answer(o.request, b.dataset.a === 'ok'); };
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
  for (const id of ['cmdr', 'upg']) if (id !== except) $(id).classList.add('hidden');
  $('b-cmdr').classList.toggle('on', except === 'cmdr'); $('b-upg').classList.toggle('on', except === 'upg');
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
  for (const k of C.divOrder) {
    const d = C.div[k], b = document.createElement('button');
    b.type = 'button'; b.className = `dt${k === ui.div ? ' on' : ''}`; b.style.setProperty('--c', d.col); b.dataset.k = k;
    b.innerHTML = `<span class="led"></span>${d.short}<small id="dt-${k}"></small>`;
    b.onclick = () => { ui.div = k; audio.play('click'); drawCmdr(); };
    tabs.appendChild(b);
  }
  const k = ui.div, d = C.div[k], ch = CH[k], div = st.div[k];
  let h = `<div class="dh" style="--c:${d.col}"><b>CH ${ch.n} · ${d.name.toUpperCase()}</b><span class="sig">▂▄▆█</span></div><div class="rep" id="cm-rep"></div><div id="cm-fac"></div>`;
  if (d.budget != null) h += `<div class="brow"><span class="bl">${d.staff ? 'BUDGET FOR WAGES' : 'BROADCAST BUDGET'}</span><span class="bv" id="cm-bv"></span>`
    + `<input id="cm-budget" type="range" min="0" max="${C.budgetMax}" step="2" value="${div.budget}"><span class="bn" id="cm-bn"></span></div>`;
  for (const [o, opts] of Object.entries(d.orders)) {
    h += `<div class="ord"><span class="ol">${ORDER_NAMES[o] || o.toUpperCase()}</span><div class="obs">${opts.map(([v, l]) => `<button type="button" class="btn ob${div.order[o] === v ? ' on' : ''}" data-o="${o}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  }
  $('cm-main').innerHTML = h; facSig = '';
  if ($('cm-budget')) $('cm-budget').oninput = (e) => { st.setBudget(k, +e.target.value); cmdrText(); };
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
  const crew = st.crew(k), req = st.requests.find((r) => r.k === k), shown = crew.slice(0, 8);
  const sig = `${k}|${req ? req.id : 0}|${shown.map((a) => a.id).join(',')}|${crew.length}`;
  if (sig !== facSig) {
    facSig = sig;
    const where = req && st.parts.get(req.part);
    box.innerHTML = `<div class="fac"><div class="fh"><b>${F.who.toUpperCase()} · MOOD</b><span class="fs"></span></div><div class="fbar"><i></i></div>`
      + `<p class="fw"><b>Wants:</b> ${F.wants}</p><p class="fy"></p>`
      + (req ? `<div class="freq"><span>REQUEST: ${F.ask} in ${where ? st.name(where) : 'a part'} · ${req.cost} CR · <em class="ft"></em></span><button type="button" class="btn primary" data-a="ok">APPROVE</button><button type="button" class="btn" data-a="no">DENY</button></div>` : '')
      + `<div class="crew"><b>${ROLE[C.div[k].staff].toUpperCase()} ON STATION (${crew.length})</b>${shown.map((a) => `<button type="button" class="pp" data-id="${a.id}">${a.name}<small></small></button>`).join('')}${crew.length > shown.length ? `<em>+${crew.length - shown.length} more</em>` : ''}</div></div>`;
    for (const b of box.querySelectorAll('.freq button')) b.onclick = () => answer(req.id, b.dataset.a === 'ok');
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
  const k = ui.div, d = C.div[k], div = st.div[k];
  if ($('cm-bv')) {
    $('cm-bv').textContent = `${div.budget} CR/min`;
    if (d.staff) {
      const r = d.staff, afford = Math.floor(div.budget / d.wage);
      $('cm-bn').textContent = `${st.staff[r]} ${ROLE[r]} on staff at ${d.wage} CR/min each · ${st.homes[r]} places in ${PLACES[r]}.`
        + (afford > st.homes[r] ? ' The budget would pay for more: build more places.' : afford < st.homes[r] ? ` Raise the budget to fill ${st.homes[r] - afford} more.` : '');
    } else $('cm-bn').textContent = st.div.truth.order.broadcast === 'silence' ? 'Nothing is spent while the Ministry is silent.' : `Morale from broadcasts: +${st.broadcastBoost().toFixed(0)}. Truth Offices make them carry further.`;
  }
  if (!cmType) { const r = $('cm-rep'); if (r) r.textContent = st.report(k); }
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
  if (n.power) out.push(`${n.power} power`); if (n.morale) out.push(`morale ${n.morale}`);
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
    ['Staff H · E · O · M', `${s.hauler} · ${s.engineer} · ${s.officer} · ${s.medic}`],
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

// ---------------------------------------------------------------- menu
function menu(on = !$('s-menu').classList.contains('on')) { $('s-menu').classList.toggle('on', on); audio.play('click'); if (on) { $('in-tax').value = st.tax; menuText(); } }
$('b-menu').onclick = () => menu(); $('b-close').onclick = () => menu(false);
$('b-mute').onclick = () => { audio.unlock(); audio.mute(!audio.muted); $('b-mute').textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON'; };
$('in-tax').oninput = (e) => { st.setTax(+e.target.value); menuText(); };
function menuText() {
  const p = st.moraleParts();
  $('bv-tax').textContent = `${st.tax}%`;
  $('bn-tax').textContent = `+${Math.round(st.taxPerMin())} CR/min from ${st.residents()} residents · morale ${p.tax >= 0 ? '+' : ''}${Math.round(p.tax)}`;
  const net = st.netPerMin(), row = (k, v, c) => `<span>${k}</span><span class="${c}">${v}</span>`;
  $('ledger').innerHTML = row('Tax', `+${Math.round(st.taxPerMin())} /min`, 'up') + row('Shops and bars', `+${Math.round(st.incomePerMin())} /min`, 'up')
    + row('Upkeep', `−${Math.round(st.upkeep())} /min`, 'down') + row('Wages and broadcasts', `−${Math.round(st.wages())} /min`, 'down')
    + row('Trade so far', `+${Math.round(st.totals.trade)}`, 'up')
    + `<span><b>Running profit, last minute</b></span><span class="${net >= 0 ? 'up' : 'down'}"><b>${net >= 0 ? '+' : '−'}${Math.abs(Math.round(net))} /min</b></span>`;
}

// ---------------------------------------------------------------- events from the simulation
let bannerT = 0;
function drain() {
  for (const e of st.events) {
    if (!ui.started) continue;
    switch (e.type) {
      case 'built': audio.play('built'); break;
      case 'crate': audio.play('crate'); break;
      case 'comms': radio(e.from, e.text, e); if (e.from === 'maintenance' && e.warn) audio.play('fault'); break;
      case 'order': radio(e.from, e.text); break;
      case 'request': { const bar = reqEls.get(e.id); if (bar) { bar.innerHTML = `<span class="rq-out ${e.outcome}">${OUTCOME[e.outcome] || ''}</span>`; reqEls.delete(e.id); } break; }
      case 'tier': {
        audio.play('milestone');
        const T = C.tiers[e.tier], u = st.unlocksOf(e.tier);
        $('banner').innerHTML = `${T.name} STATUS GRANTED<small>The build zone grows to ${T.radius}. ${[...u.parts, ...u.rooms].length ? `New: ${[...u.parts, ...u.rooms].join(', ')}.` : ''}</small>`;
        $('banner').classList.add('show'); bannerT = 6; buildGrid();
        break;
      }
    }
  }
  st.events.length = 0;
}

// ---------------------------------------------------------------- HUD
function hud() {
  $('r-cr').textContent = st.sandbox ? '∞' : Math.round(st.credits).toLocaleString('en-US');
  $('r-cap').textContent = st.capability().toLocaleString('en-US');
  $('cm-badge').textContent = st.requests.length || '';
  $('r-pw').textContent = `${st.demand}/${st.supply}`; $('r-pw').style.color = st.eff < 1 ? 'var(--red)' : '';
  $('r-pop').textContent = `${st.residents()}/${st.beds()}`;
  const mo = Math.round(st.morale); $('r-mo').textContent = mo; $('r-mo').style.color = mo >= 55 ? '' : mo >= 35 ? 'var(--amber)' : 'var(--red)';
  $('r-sh').textContent = `${st.stats.ships} · ${st.stats.lost}`;
  const n = st.next();
  $('tier').textContent = st.sandbox ? 'FREE PLAY' : C.tiers[st.tier].name;
  $('tier-next').textContent = st.sandbox ? 'every part and room unlocked' : n ? `next: ${n.name} · ${n.items.filter((i) => i.ok).length}/${n.items.length}` : 'the top of the path';
  gridState();
  if (!ui.tool) info();
  if ($('s-menu').classList.contains('on')) menuText();
  if (st.sandbox && !$('simpanel').classList.contains('hidden')) simStats();
  if (!$('cmdr').classList.contains('hidden')) { cmdrText(); drawFac(); }
  if (!$('upg').classList.contains('hidden')) drawUpg();
  fitComms();
}
// The comms window sits above the minimap and gives way to the free play panel above it.
function fitComms() {
  const panelTop = $('panel').getBoundingClientRect().top, topBar = $('top').getBoundingClientRect().bottom;
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
      + `<div class="st">${stat('COST', `${d.cost} CR`, st.credits < d.cost && !st.sandbox ? 'bad' : '')}${stat('POWER', pw(d))}${stat('UPKEEP', `${d.up}/min`)}${SLOTS[t] ? stat('ROOMS', SLOTS[t].length) : ''}${sumStats(s)}${d.crates ? stat('CRATES', d.crates) : ''}</div>`
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
    if (d.berth) { const sh = st.ships.find((x) => x.dock === p.id); extra += stat('BERTH', d.berthRoom && !st.has(p, d.berthRoom) ? `needs a ${C.rooms[d.berthRoom].name}` : sh ? `${sh.name}${sh.state === 'docked' && sh.kind === 'freighter' ? `, ${sh.crates} crates` : sh.state === 'approach' ? ', approaching' : ''}` : 'empty'); }
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
    + `<div class="ia">Pick a part from a group on the left, then click near a port. Select a built part to build out its rooms. Drag to orbit, right-drag to pan, scroll to zoom.</div>`
    + `<div class="st moods">${['supply', 'maintenance', 'security', 'medical'].map((k) => stat(C.factions[k].who.toUpperCase(), Math.round(st.sat[k]), st.sat[k] < C.faction.low ? 'bad' : st.sat[k] >= 65 ? 'ok' : 'warn')).join('')}</div>`
    + (st.sandbox || !n ? '' : `<ul class="ms">${n.items.map((i) => `<li class="${i.ok ? 'ok' : ''}">${i.label} ${Math.min(i.have, i.need)}/${i.need}</li>`).join('')}<li class="nx">Next: ${n.name}. The full path is under UPGRADES (U).</li></ul>`));
}
// One person: who they are, who they work for, and what they are doing right now.
function personInfo(a) {
  const k = C.divOrder.find((d) => C.div[d].staff === a.role), home = st.parts.get(a.home), at = st.parts.get(a.at);
  setInfo(`<div class="in edit"><span>${a.name.toUpperCase()}</span><button class="btn" id="a-focus" type="button">FOCUS <small>F</small></button><button class="btn primary" id="a-done" type="button">DONE</button></div>`
    + `<div class="ia">${ROLE_ONE[a.role]}${k ? `, ${C.factions[k].who}` : ''}. ${k ? `${C.factions[k].who} is ${st.sat[k] >= 65 ? 'in good spirits' : st.sat[k] >= C.faction.low ? 'getting by' : 'unhappy'}.` : ''}</div>`
    + `<div class="st">${stat('DOING', st.doing(a))}${stat('IN', at ? st.name(at) : '—')}${stat(a.role === 'resident' ? 'QUARTERS' : 'POSTED', home ? st.name(home) : '—')}${stat('ABOARD', clock(st.t - a.since))}</div>`, () => {
    $('a-focus').onclick = () => view.lookAtAgent(a);
    $('a-done').onclick = () => { audio.play('click'); select(null); };
  });
}
function editInfo(peekRoom) {
  const p = st.parts.get(ui.edit);
  if (!p) { endEdit(); return; }
  const r = peekRoom || ui.room, R = r && C.rooms[r], s = roomSums(p.rooms);
  const chips = p.rooms.map((x, i) => `<button type="button" class="chip${ui.slot === i ? ' on' : ''}" data-i="${i}" style="--c:${C.rooms[x].col}">${i + 1} ${C.rooms[x].short || '—'}</button>`).join('');
  const sel = ui.slot != null ? `Room ${ui.slot + 1} is a <b>${C.rooms[p.rooms[ui.slot]].name}</b>. ` : '';
  const how = R ? `<b>${R.name}</b>${R.cost ? ` · ${R.cost} CR` : ''}${R.up ? ` · upkeep ${R.up}/min` : ''}. ${R.about || 'Clears the room.'}`
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
function drawMini() {
  const W = mini.width, H = mini.height, R = W / 2 - 6, span = Math.max(20, st.radius) * 1.05, k = R / span;
  mx.clearRect(0, 0, W, H);
  mx.save(); mx.translate(W / 2, H / 2);
  mx.strokeStyle = 'rgba(157,255,184,0.12)'; mx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { mx.beginPath(); mx.arc(0, 0, R * i / 4, 0, 6.283); mx.stroke(); }
  mx.beginPath(); mx.moveTo(-R, 0); mx.lineTo(R, 0); mx.moveTo(0, -R); mx.lineTo(0, R); mx.stroke();
  mx.setLineDash([4, 4]); mx.strokeStyle = 'rgba(255,230,0,0.6)'; mx.beginPath(); mx.arc(0, 0, st.radius * k, 0, 6.283); mx.stroke(); mx.setLineDash([]);
  for (const p of st.parts.values()) {
    const c = st.center(p), x = c[0] * k, y = c[2] * k, sel = p.id === ui.sel;
    mx.strokeStyle = sel ? '#ffe600' : p.fault ? '#ffb020' : p.state === 'active' ? 'rgba(157,255,184,0.9)' : 'rgba(255,230,0,0.6)'; mx.fillStyle = mx.strokeStyle;
    if (RINGS[p.type]) { mx.beginPath(); mx.arc(x, y, RINGS[p.type] * k, 0, 6.283); mx.stroke(); }
    else if (C.parts[p.type].ports[0][6] === 'L') { const b0 = st.port(p, 0).pos; mx.beginPath(); mx.moveTo(b0[0] * k, b0[2] * k); mx.lineTo(x + (x - b0[0] * k), y + (y - b0[2] * k)); mx.lineWidth = 2; mx.stroke(); mx.lineWidth = 1; }
    else { mx.fillRect(x - 2, y - 2, 4, 4); }
  }
  for (const s of st.ships) {
    const o = view.shipObjs.get(s.id); if (!o) continue;
    const x = o.position.x * k, y = o.position.z * k;
    if (Math.hypot(x, y) > R) continue;
    mx.fillStyle = s.state === 'hold' ? '#ffe600' : s.kind === 'warship' ? '#ff6a5a' : '#4db8ff'; mx.fillRect(x - 2, y - 2, 4, 4);
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

// ---------------------------------------------------------------- scanlines, vignette and corner marks over everything (as in Orbital Fury)
function fx() {
  const c = $('fx'), dpr = Math.min(devicePixelRatio || 1, 2), W = c.width = Math.round(innerWidth * dpr), H = c.height = Math.round(innerHeight * dpr), g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.16)'; const gap = Math.max(3, Math.round(3 * dpr));
  for (let y = 0; y < H; y += gap) g.fillRect(0, y, W, Math.max(1, Math.round(dpr)));
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}
addEventListener('resize', () => { view.resize(); fx(); if (ui.started) fitComms(); });
fx();

// ---------------------------------------------------------------- loop
const STEP = 1 / 30;
let last = performance.now(), acc = 0, hudT = 0, miniT = 0;
function frame(nowMs) {
  const now = nowMs / 1000, dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
  if (!ui.paused) {
    acc += dt * (ui.started ? ui.speed : 1);
    let n = 0;
    while (acc >= STEP && n++ < 20) { st.step(STEP); acc -= STEP; }
    if (n >= 20) acc = 0;
  }
  drain();
  view.sync(now, dt);
  if (ui.tool && ui.portsDirty) { ui.portsDirty = false; view.showPorts(ui.tool, ui.rot, ui.hot, ui.px, ui.py); }
  view.render(now);
  typeTick(dt); cmTick(dt);
  if (ui.started) {
    if ((hudT -= dt) <= 0) { hudT = 0.25; hud(); if (ui.tool) ui.portsDirty = true; }
    if ((miniT -= dt) <= 0) { miniT = 0.1; drawMini(); }
    if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');
    if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
    if (peekT > 0 && (peekT -= dt) <= 0) $('app').classList.remove('peek');
  }
  requestAnimationFrame(frame);
}
if (qs.has('economy') || qs.has('run')) start('run'); else if (qs.has('free') || qs.has('sandbox')) start('sandbox');
requestAnimationFrame(frame);
