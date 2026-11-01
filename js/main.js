// Boot, the main loop, input and the HUD. The simulation lives in sim.js and never touches the page.
import { C } from './config.js';
import { Station } from './sim.js';
import { Renderer } from './render.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const st = new Station(Number(qs.get('seed')) || (Date.now() % 100000));
const R = new Renderer($('view'));
const audio = new Audio();
const ui = { tool: null, hover: null, paused: false, speed: 1, painting: false, lastPaint: -1, started: false };
window.__st = st; window.__ui = ui; window.__R = R;   // for the browser tests

// ---------------------------------------------------------------- palette
const pal = $('palette');
for (const t of C.palette) {
  const d = C.mods[t], b = document.createElement('button');
  b.className = 'pb'; b.type = 'button'; b.dataset.t = t;
  b.innerHTML = `<kbd>${d.key}</kbd><span class="pn">${d.name.toUpperCase()}</span><span class="pc">${d.cost} CR</span>`;
  b.onclick = () => { audio.unlock(); setTool(ui.tool === t ? null : t); };
  pal.appendChild(b);
}
function setTool(t) {
  if (t && t !== 'demolish' && C.mods[t].locked && !st.unlocked.has(C.mods[t].locked)) { audio.play('deny'); say('That module needs the Garrison Permit.', 'warn'); return; }
  ui.tool = t; audio.play('click');
  for (const b of pal.children) b.classList.toggle('on', b.dataset.t === t);
  $('btn-demo').classList.toggle('on', t === 'demolish');
  R.cv.style.cursor = t ? 'crosshair' : 'default';
}
function paletteState() {
  for (const b of pal.children) {
    const d = C.mods[b.dataset.t], locked = d.locked && !st.unlocked.has(d.locked);
    b.classList.toggle('locked', !!locked);
    b.classList.toggle('poor', !locked && st.credits < d.cost);
    b.querySelector('.pc').textContent = locked ? 'GARRISON' : `${d.cost} CR`;
  }
}

// ---------------------------------------------------------------- input
function pointerCell(e) {
  const r = R.cv.getBoundingClientRect(), h = R.cellAt(e.clientX - r.left, e.clientY - r.top);
  return { ...h, mod: st.modAt(h.c, h.r), px: e.clientX, py: e.clientY };
}
function act(h, fromDrag) {
  if (!ui.tool) return;
  if (ui.tool === 'demolish') {
    if (h.mod && st.demolish(h.c, h.r)) audio.play('place'); else if (!fromDrag) audio.play('deny');
    return;
  }
  const res = st.build(ui.tool, h.c, h.r);
  if (res.ok) audio.play('place');
  else if (!fromDrag) { audio.play('deny'); say(res.why, 'warn'); }
}
R.cv.addEventListener('pointermove', (e) => {
  ui.hover = pointerCell(e);
  if (ui.painting && ['corridor', 'lift', 'demolish'].includes(ui.tool)) {
    const k = ui.hover.r * 1000 + ui.hover.c;
    if (k !== ui.lastPaint) { ui.lastPaint = k; act(ui.hover, true); }
  }
  tip();
});
R.cv.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (e.button === 2) { setTool(null); return; }
  ui.hover = pointerCell(e);
  ui.painting = true; ui.lastPaint = ui.hover.r * 1000 + ui.hover.c;
  act(ui.hover, false);
  tip();
});
addEventListener('pointerup', () => { ui.painting = false; });
R.cv.addEventListener('pointerleave', () => { ui.hover = null; tip(); });
R.cv.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (!ui.started) return;
  const k = e.key.toLowerCase();
  const t = C.palette.find((p) => C.mods[p].key === k);
  if (t) { setTool(ui.tool === t ? null : t); return; }
  if (k === 'x') setTool(ui.tool === 'demolish' ? null : 'demolish');
  else if (k === 'b') toggleBudget();
  else if (k === ' ') { e.preventDefault(); togglePause(); }
  else if (k === 'escape') { if ($('s-budget').classList.contains('on')) toggleBudget(false); else setTool(null); }
});
addEventListener('resize', () => R.resize());

$('btn-demo').onclick = () => setTool(ui.tool === 'demolish' ? null : 'demolish');
$('btn-budget').onclick = () => toggleBudget();
$('btn-budget-close').onclick = () => toggleBudget(false);
$('btn-pause').onclick = () => togglePause();
$('btn-speed').onclick = () => { ui.speed = ui.speed === 1 ? 2 : ui.speed === 2 ? 4 : 1; $('btn-speed').textContent = `${ui.speed}×`; audio.play('click'); };
$('btn-mute').onclick = () => { audio.unlock(); audio.mute(!audio.muted); $('btn-mute').classList.toggle('on', audio.muted); };
function togglePause(on = !ui.paused) { ui.paused = on; $('btn-pause').textContent = on ? '▶' : 'II'; $('btn-pause').classList.toggle('on', on); audio.play('click'); }
$('btn-begin').onclick = () => begin();
function begin() {
  audio.unlock();
  ui.started = true;
  $('s-title').classList.remove('on'); $('hud').classList.remove('hidden');
  $('hullname').textContent = C.hull.name.toUpperCase();
  say('The Ministry welcomes you, Station Master. Start with a Docking Bay on the top or bottom deck.', 'gold');
  R.resize();
}

// ---------------------------------------------------------------- budget
const DIVS = ['logistics', 'engineering', 'security'];
function toggleBudget(on = !$('s-budget').classList.contains('on')) {
  $('s-budget').classList.toggle('on', on); audio.play('click');
  if (on) { $('in-tax').value = st.tax; for (const k of DIVS) $(`in-${k}`).value = st.budget[k]; budgetText(); }
}
$('in-tax').oninput = (e) => { st.setTax(+e.target.value); budgetText(); };
for (const k of DIVS) $(`in-${k}`).oninput = (e) => { st.setBudget(k, +e.target.value); budgetText(); };
const WHO = { logistics: 'haulers', engineering: 'engineers', security: 'officers' };
const NEED = { logistics: 'a Cargo Hold', engineering: 'an Engineering Bay', security: 'a Security Post' };
const HOME = { logistics: 'Station Command (3) and each Cargo Hold (2)', engineering: 'each Engineering Bay (3)', security: 'each Security Post (3)' };
function budgetText() {
  const p = st.moraleParts();
  $('bv-tax').textContent = `${st.tax}%`;
  $('bn-tax').textContent = `+${Math.round(st.taxPerMin())} CR/min from ${st.residents()} residents · morale ${p.tax >= 0 ? '+' : ''}${Math.round(p.tax)}`;
  for (const k of DIVS) {
    const d = C.div[k], funded = Math.floor(st.budget[k] / d.wage);
    $(`bv-${k}`).textContent = `${st.budget[k]} CR/min`;
    $(`bn-${k}`).textContent = st.cap[k]
      ? `Funds ${funded} ${WHO[k]} at ${d.wage} CR/min each · ${st.staff[k]} working (places: ${st.cap[k]}, from ${HOME[k]})`
      : `No places for ${WHO[k]} yet: build ${NEED[k]}.`;
  }
  const net = st.netPerMin();
  $('ledger').innerHTML = `<span>Tax</span><span class="up">+${Math.round(st.taxPerMin())} /min</span>`
    + `<span>Wages</span><span class="down">−${Math.round(st.wages())} /min</span>`
    + `<span>Upkeep</span><span class="down">−${Math.round(st.upkeep())} /min</span>`
    + `<span>Trade so far</span><span class="up">+${Math.round(st.totals.trade + st.totals.fines)}</span>`
    + `<span><b>Net, last minute</b></span><span class="${net >= 0 ? 'up' : 'down'}"><b>${net >= 0 ? '+' : '−'}${Math.abs(Math.round(net))} /min</b></span>`;
}

// ---------------------------------------------------------------- ticker and events
const lines = [];
function say(text, cls = 'info') {
  lines.push({ text, cls, t: performance.now() });
  while (lines.length > 3) lines.shift();
  $('ticker').innerHTML = lines.map((l, i) => `<div class="${l.cls}${i < lines.length - 1 ? ' old' : ''}">${l.text}</div>`).join('');
}
let bannerT = 0;
function banner(title, sub) { const b = $('banner'); b.innerHTML = `${title}<small>${sub}</small>`; b.classList.add('show'); bannerT = 5; }
function drain() {
  for (const e of st.events) {
    switch (e.type) {
      case 'built': if (e.mod.type !== 'corridor') audio.play('built'); break;
      case 'crate': audio.play('crate'); R.float(e.x, e.y, `+${C.econ.crateFee}`, '#ffe600'); break;
      case 'dock': audio.play('dock'); say(e.text); break;
      case 'fault': audio.play('fault'); say(e.text, 'warn'); break;
      case 'fixed': audio.play('fixed'); say(e.text, 'info'); break;
      case 'caught': audio.play('caught'); say(e.text, 'gold'); R.float(e.mod.col + 1, e.mod.row, `+${C.econ.fine}`, '#ffe600'); break;
      case 'contraband': audio.play('contraband'); say(e.text, 'bad'); break;
      case 'lost': audio.play('lost'); say(e.text, 'bad'); break;
      case 'left': say(e.text, 'warn'); break;
      case 'milestone': audio.play('milestone'); say(e.text, 'gold'); banner('GARRISON PERMIT GRANTED', 'The whole hull is yours. Canteen and Security Post unlocked.'); break;
      case 'talk': say(e.text, 'dim'); break;
    }
  }
  st.events.length = 0;
}

// ---------------------------------------------------------------- HUD text
function hudText() {
  const net = st.netPerMin();
  $('cr').textContent = Math.round(st.credits).toLocaleString('en-US');
  $('net').textContent = `${net >= 0 ? '+' : '−'}${Math.abs(Math.round(net))}/min`;
  $('net').className = net >= 0 ? 'up' : 'down';
  const mo = Math.round(st.morale), moCol = mo >= 55 ? 'var(--g)' : mo >= 35 ? 'var(--amber)' : 'var(--red)';
  const waiting = st.ships.filter((s) => s.state === 'hold').length;
  $('stats').innerHTML = `<span>RESIDENTS</span><span>${st.residents()} / ${st.beds()}</span>`
    + `<span>MORALE</span><span><i class="bar"><u style="width:${mo}%;background:${moCol}"></u></i>${mo}</span>`
    + `<span>POWER</span><span style="color:${st.eff < 1 ? 'var(--red)' : '#fff'}">${st.demand} / ${st.supply}</span>`
    + `<span>SHIPS</span><span>${st.stats.ships} served · ${st.stats.lost} lost</span>`
    + `<span>WAITING</span><span style="color:${waiting ? 'var(--yellow)' : '#fff'}">${waiting}</span>`
    + `<span>TAX</span><span>${st.tax}%</span>`;
  const m = st.milestone();
  $('ms').classList.toggle('done', m.done);
  $('ms').innerHTML = m.done
    ? `<div class="ph">MILESTONE</div><div class="mn">${m.name} ✓</div><div class="un">The whole hull is open. More milestones come after this test.</div>`
    : `<div class="ph">NEXT MILESTONE</div><div class="mn">${m.name}</div><ul>${m.items.map((i) => `<li class="${i.ok ? 'ok' : ''}">${i.label} ${Math.min(i.have, i.need)}/${i.need}</li>`).join('')}</ul><div class="un">Unlocks: ${m.unlocks}</div>`;
  const anyDock = [...st.mods.values()].some((x) => x.type === 'dock');
  const orders = [
    ['Build a Docking Bay on the top or bottom deck', anyDock],
    ['Connect it to Command with lifts and corridors', st.count('dock') > 0],
    ['Build a Cargo Hold, connected too', st.count('cargo') > 0],
    ['Build Quarters for colonists', st.beds() > 0],
    ['Build a Reactor before the power runs out', st.count('reactor') > 0],
    ['Build an Engineering Bay for repairs', st.count('engineering') > 0],
  ];
  const first = orders.findIndex((o) => !o[1]);
  $('orders').classList.toggle('hidden', first < 0);
  $('orders-list').innerHTML = orders.map((o, i) => `<li class="${o[1] ? 'ok' : i === first ? 'now' : ''}">${o[0]}</li>`).join('');
  paletteState();
  if ($('s-budget').classList.contains('on')) budgetText();
}

const ABOUT = {
  corridor: 'A walkway. Cheap, and every route needs them.',
  lift: 'The only way between decks. Stack lifts to make a shaft.',
  dock: 'A berth for one ship. Freighters bring 6 crates; shuttles bring colonists.',
  cargo: `Haulers carry crates here: +${C.econ.crateFee} CR each. Also makes room for 2 haulers.`,
  quarters: `Beds for ${C.mods.quarters.beds} residents, who pay the Liberty Contribution.`,
  reactor: `Supplies ${-C.mods.reactor.pw} power.`,
  engineering: 'Home of up to 3 engineers, who walk out and fix faults.',
  canteen: `Residents whose quarters are within ${C.morale.canteenReach} cells' walk are happier.`,
  security: `Democracy Officers inspect smugglers at bays within ${C.securityReach} cells' walk.`,
  command: 'The heart of the station. Everything must connect to it. Home of 3 haulers.',
};
function tip() {
  const el = $('tip'), h = ui.hover;
  if (!h || !ui.started) { el.classList.add('hidden'); return; }
  let html = '';
  if (ui.tool && ui.tool !== 'demolish') {
    const d = C.mods[ui.tool], chk = st.canPlace(ui.tool, h.c, h.r);
    html = `<div class="tn">${d.name.toUpperCase()} · ${d.cost} CR</div><div>${ABOUT[ui.tool]}</div>`
      + `<div class="${chk.ok ? 'good' : 'bad'}">${chk.ok ? `Click to build. Upkeep ${d.up} CR/min, power ${d.pw > 0 ? d.pw : '+' + -d.pw}.` : chk.why}</div>`;
  } else if (h.mod) {
    const m = h.mod, d = C.mods[m.type];
    let state = '<span class="good">Running</span>';
    if (m.state === 'building') state = `<span class="warn">Building ${Math.round(m.prog * 100)}%</span>`;
    else if (m.state === 'demolish') state = '<span class="bad">Being torn down</span>';
    else if (m.fault) state = `<span class="warn">FAULT: ${m.fixer ? 'an engineer is on it' : st.staff.engineering ? 'waiting for an engineer' : 'no engineers funded'}</span>`;
    else if (!m.connected) state = '<span class="warn">No access: connect it to Station Command</span>';
    else if (st.eff < 1 && d.pw > 0) state = '<span class="warn">Low power: build a Reactor</span>';
    let extra = '';
    if (m.type === 'dock') { const s = st.ships.find((x) => x.dock === m.id); extra = s ? `${s.name}: ${s.state === 'docked' ? (s.kind === 'freighter' ? `${s.crates} crates aboard` : 'colonists disembarking') : 'on approach'}` : 'Empty'; }
    if (m.type === 'quarters') extra = `${st.agents.filter((a) => a.role === 'resident' && a.home === m.id).length} / ${d.beds} residents`;
    if (m.type === 'security') extra = `${st.agents.filter((a) => a.role === 'security' && a.home === m.id).length} officers`;
    if (m.type === 'engineering') extra = `${st.agents.filter((a) => a.role === 'engineering' && a.home === m.id).length} engineers`;
    html = `<div class="tn">${st.name(m).toUpperCase()}</div><div>${ABOUT[m.type]}</div><div>${state}</div>${extra ? `<div>${extra}</div>` : ''}`
      + (ui.tool === 'demolish' && !m.fixed ? `<div class="bad">Click to tear down: refunds ${Math.round(d.cost * C.demolish.refund)} CR</div>` : '');
  } else { el.classList.add('hidden'); return; }
  el.innerHTML = html; el.classList.remove('hidden');
  const w = el.offsetWidth, hh = el.offsetHeight;
  el.style.left = `${Math.min(innerWidth - w - 8, h.px + 16)}px`;
  el.style.top = `${Math.max(8, h.py - hh - 14)}px`;
}

// ---------------------------------------------------------------- loop
const STEP = 1 / 30;
let last = performance.now(), acc = 0, hudT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (ui.started && !ui.paused) {
    acc += dt * ui.speed;
    let n = 0;
    while (acc >= STEP && n++ < 12) { st.step(STEP); acc -= STEP; }
    if (n >= 12) acc = 0;
  }
  drain();
  R.draw(st, ui, now / 1000, ui.paused ? 0 : dt);
  if ((hudT -= dt) <= 0 && ui.started) { hudT = 0.25; hudText(); if (ui.hover) tip(); }
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');
  requestAnimationFrame(frame);
}
if (qs.has('skip')) begin();
requestAnimationFrame(frame);
