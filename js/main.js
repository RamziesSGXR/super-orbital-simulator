// Boot, the main loop, input and the HUD. The simulation (sim.js) never touches the page; the view (view.js) draws it.
import { C } from './config.js';
import { Station } from './sim.js';
import { View } from './view.js';
import { partIcon } from './parts.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const HOTKEYS = ['q', 'w', 'e', 't', 'y', 'a', 's', 'd', 'f', 'g', 'z', 'c', 'v', 'b', 'n'];
const audio = new Audio();
const ui = { started: false, tool: null, rot: 0, hot: null, sel: null, paused: false, speed: 1, view: 'blueprint', cut: false };

// ---------------------------------------------------------------- the title backdrop: an original example station, turning slowly
function demoStation() {
  const s = new Station(3, 'sandbox');
  const b = (t, h, p, r = 0) => s.build(t, h, p, r).id;
  const c1 = b('core', 1, 1), re = b('reactor', c1, 1); b('spire', re, 1);
  b('solar', c1, 2); b('solar', c1, 3);
  const ring = b('ring', 1, 0), c2 = b('core', ring, 1), big = b('bigring', c2, 1), c3 = b('core', big, 1); b('spire', c3, 1);
  for (const p of [2, 3, 4, 5]) b('dockport', ring, p);
  for (const p of [2, 4, 6]) b('pylon', big, p);
  b('cargo', 1, 2); b('hab', 1, 3); b('hab', 1, 4); b('cargo', 1, 5);
  for (let i = 0; i < 40; i++) s.step(0.5);
  return s;
}
let st = demoStation();
const view = new View($('view'), st);
window.__view = view;
view.setMode('hull');
view.controls.autoRotate = true; view.controls.autoRotateSpeed = 0.6;
view.camera.position.set(30, 14, 34);

// ---------------------------------------------------------------- start
function start(mode) {
  audio.unlock();
  st = new Station(Number(qs.get('seed')) || (Date.now() % 100000), mode);
  window.__st = st; window.__ui = ui;
  view.setStation(st);
  view.controls.autoRotate = false;
  view.frame();
  ui.started = true; ui.tool = null; ui.sel = null; ui.hot = null;
  setView('blueprint'); setCut(false);
  $('s-title').classList.remove('on'); $('hud').classList.remove('hidden');
  msgs.length = 0;
  const free = mode === 'sandbox';
  ui.speed = 1; $('b-speed').textContent = '1×';
  $('b-sim').classList.toggle('hidden', !free); $('simpanel').classList.toggle('hidden', !free); $('b-sim').classList.toggle('on', free);
  $('t-traffic').classList.add('on'); $('t-traffic').textContent = 'TRAFFIC ON';
  say(free ? 'Free play: every part, no costs. Test tools are under SIM (K). Build anything.' : 'The Ministry welcomes you, Station Master. Start with a Docking Port on Station Command.', 'gold');
  buildGrid(); hud(); info();
}
$('b-economy').onclick = () => start('run');
$('b-free').onclick = () => start('sandbox');
$('b-restart').onclick = () => { $('s-menu').classList.remove('on'); $('simpanel').classList.add('hidden'); $('b-sim').classList.add('hidden'); ui.started = false; $('hud').classList.add('hidden'); $('s-title').classList.add('on'); st = demoStation(); view.setStation(st); view.setMode('hull'); view.setCutaway(false); view.controls.autoRotate = true; };

// ---------------------------------------------------------------- command grid
function buildGrid() {
  const g = $('cmd'); g.innerHTML = '';
  C.grid.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'cb'; b.type = 'button'; b.dataset.t = t;
    b.innerHTML = `${partIcon(t)}<kbd>${HOTKEYS[i].toUpperCase()}</kbd>`;
    b.title = `${C.parts[t].name} · ${C.parts[t].cost} CR`;
    b.onclick = () => { audio.unlock(); setTool(ui.tool === t ? null : t); };
    b.onpointerenter = () => { if (!ui.tool) info(t); };
    b.onpointerleave = () => { if (!ui.tool) info(); };
    g.appendChild(b);
  });
}
function gridState() {
  for (const b of $('cmd').children) {
    const d = C.parts[b.dataset.t], locked = d.locked && !st.unlocked.has(d.locked);
    b.classList.toggle('locked', !!locked);
    b.classList.toggle('poor', !locked && st.credits < d.cost);
    b.classList.toggle('on', ui.tool === b.dataset.t);
  }
}
function setTool(t) {
  if (t && C.parts[t].locked && !st.unlocked.has(C.parts[t].locked)) { audio.play('deny'); say(`${C.parts[t].name} needs the Garrison Permit.`, 'warn'); return; }
  ui.tool = t; ui.hot = null; audio.play('click'); $('tip').classList.add('hidden');
  if (t) select(null);
  view.showPorts(t, ui.rot); view.setGhost(null, null, 0);
  gridState(); info();
}
function select(id) { ui.sel = id; view.select(id); info(); }

// ---------------------------------------------------------------- views
function setView(v) {
  ui.view = v; view.setMode(v);
  for (const b of document.querySelectorAll('.vb')) if (b.dataset.v !== 'cut') b.classList.toggle('on', b.dataset.v === v);
}
function setCut(on) { ui.cut = on; view.setCutaway(on); document.querySelector('.vb[data-v="cut"]').classList.toggle('on', on); }
for (const b of document.querySelectorAll('.vb')) b.onclick = () => { audio.play('click'); if (b.dataset.v === 'cut') setCut(!ui.cut); else setView(b.dataset.v); };

// ---------------------------------------------------------------- pointer: a short press is a click, anything longer orbits
const cv = $('view');
let down = null;
cv.addEventListener('pointerdown', (e) => { audio.unlock(); down = { x: e.clientX, y: e.clientY, t: performance.now(), b: e.button }; });
cv.addEventListener('pointerup', (e) => {
  if (!down || !ui.started) { down = null; return; }
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 600, b = down.b;
  down = null;
  if (moved > 7 || !quick) return;
  if (b === 2) { setTool(null); select(null); return; }
  click(e.clientX, e.clientY);
});
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointermove', (e) => { if (ui.started && e.buttons === 0) hover(e.clientX, e.clientY); });
cv.addEventListener('pointerleave', () => { $('tip').classList.add('hidden'); });

function click(x, y) {
  if (ui.tool) {
    const p = view.pickPort(x, y);
    if (!p) return;
    const r = st.build(ui.tool, p.part, p.i, ui.rot);
    if (r.ok) { audio.play('place'); ui.hot = null; view.setGhost(null, null, 0); view.showPorts(ui.tool, ui.rot); $('tip').classList.add('hidden'); }
    else { audio.play('deny'); say(r.why, 'warn'); }
    return;
  }
  const id = view.pickPart(x, y);
  select(id || null);
  if (id) audio.play('click');
}
function hover(x, y) {
  const tip = $('tip');
  if (ui.tool) {
    const p = view.pickPort(x, y);
    const same = p && ui.hot && p.part === ui.hot.part && p.i === ui.hot.i;
    if (!same) { ui.hot = p; view.showPorts(ui.tool, ui.rot, p); view.setGhost(ui.tool, p, ui.rot); }
    if (p) {
      const chk = st.canBuild(ui.tool, p.part, p.i, ui.rot);
      tip.innerHTML = `<b>${C.parts[ui.tool].name}</b> on ${st.name(st.parts.get(p.part))}<br>${chk.ok ? 'Click to build · R turns it' : `<span class="down">${chk.why}</span>`}`;
      showTip(x, y);
    } else tip.classList.add('hidden');
    return;
  }
  const id = view.pickPart(x, y);
  if (id) { const p = st.parts.get(id); tip.innerHTML = `<b>${st.name(p)}</b>${p.state !== 'active' ? ` · ${p.state === 'building' ? 'building' : 'coming down'}` : ''}`; showTip(x, y); }
  else tip.classList.add('hidden');
}
function showTip(x, y) {
  const tip = $('tip'); tip.classList.remove('hidden');
  tip.style.left = `${Math.min(innerWidth - tip.offsetWidth - 8, x + 16)}px`; tip.style.top = `${Math.max(48, y - tip.offsetHeight - 12)}px`;
}

// ---------------------------------------------------------------- keys
addEventListener('keydown', (e) => {
  if (!ui.started || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(), gi = HOTKEYS.indexOf(k);
  if (gi >= 0 && gi < C.grid.length) { const t = C.grid[gi]; setTool(ui.tool === t ? null : t); return; }
  if (k === 'r') { ui.rot = (ui.rot + 1) % 8; audio.play('click'); if (ui.tool) { view.showPorts(ui.tool, ui.rot, ui.hot); view.ghostKey = ''; view.setGhost(ui.tool, ui.hot, ui.rot); } info(); }
  else if (k === 'x') demolishSel();
  else if (k === 'f' && ui.sel) view.focus(ui.sel);
  else if (k === 'escape') { if ($('s-menu').classList.contains('on')) menu(false); else { setTool(null); select(null); } }
  else if (k === ' ') { e.preventDefault(); pause(); }
  else if (k === '1') setView('blueprint'); else if (k === '2') setView('hull'); else if (k === '3') setView('life'); else if (k === '4') setCut(!ui.cut);
  else if (k === 'm') menu();
  else if (k === 'k') simPanel();
});
function demolishSel() {
  if (!ui.sel) return;
  const r = st.demolish(ui.sel);
  if (r.ok) { audio.play('place'); select(null); } else { audio.play('deny'); say(r.why, 'warn'); }
}
function pause(on = !ui.paused) { ui.paused = on; $('b-pause').textContent = on ? '▶' : 'II'; $('b-pause').classList.toggle('on', on); audio.play('click'); }
$('b-pause').onclick = () => pause();
$('b-speed').onclick = () => {
  const steps = st.sandbox ? [1, 2, 4, 8, 16] : [1, 2, 4];   // free play runs faster, for testing
  ui.speed = steps[(steps.indexOf(ui.speed) + 1) % steps.length] || 1; $('b-speed').textContent = `${ui.speed}×`; audio.play('click');
};

// ---------------------------------------------------------------- free play test tools
function simPanel(on = $('simpanel').classList.contains('hidden')) { if (!st.sandbox) return; $('simpanel').classList.toggle('hidden', !on); $('b-sim').classList.toggle('on', on); audio.play('click'); }
$('b-sim').onclick = () => simPanel();
$('t-freighter').onclick = () => { if (st.spawnShip('freighter')) { audio.play('click'); say('Test: a freighter is on its way.', 'dim'); } else { audio.play('deny'); say('Build a Docking Port or Pylon first.', 'warn'); } };
$('t-shuttle').onclick = () => { if (st.spawnShip('shuttle')) { audio.play('click'); say('Test: a shuttle is on its way.', 'dim'); } else { audio.play('deny'); say('Build a Docking Port or Pylon first.', 'warn'); } };
$('t-colonists').onclick = () => { const n = st.addColonists(10); if (n) { audio.play('click'); say(`Test: ${n} colonists moved in at Station Command.`, 'dim'); } else { audio.play('deny'); say('No free beds: build Habs, Rings or Drums first.', 'warn'); } };
$('t-clear').onclick = () => { st.clearShips(); audio.play('click'); say('Test: every ship cleared.', 'dim'); };
$('t-traffic').onclick = () => { st.traffic = !st.traffic; $('t-traffic').classList.toggle('on', st.traffic); $('t-traffic').textContent = st.traffic ? 'TRAFFIC ON' : 'TRAFFIC OFF'; audio.play('click'); };
function simStats() {
  const p = st.moraleParts(), h = st.haulersBusy(), ab = st.avgBerth(), by = (k) => st.ships.filter((x) => x.state === k).length;
  const sgn = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))}`;
  const mm = Math.floor(st.t / 60), ss = String(Math.floor(st.t % 60)).padStart(2, '0');
  $('t-stats').innerHTML = [
    ['Sim time', `${mm}:${ss} at ${ui.speed}×`],
    ['Crates / min', st.cratesPerMin().toFixed(1)],
    ['Ships wait · in · docked', `${by('hold')} · ${by('approach')} · ${by('docked')}`],
    ['Avg time at berth', ab == null ? '—' : `${ab.toFixed(1)} s`],
    ['Haulers busy', `${h.busy} / ${h.all}`],
    ['Berths', st.berths().length],
    ['Pop / beds', `${st.residents()} / ${st.beds()}`],
    ['Power use / supply', `${st.demand} / ${st.supply} (${Math.round(st.eff * 100)}%)`],
    ['Crates · ships · lost', `${st.stats.crates} · ${st.stats.ships} · ${st.stats.lost}`],
    ['Morale', `${Math.round(st.morale)}`],
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')
    + `<span class="wide">${p.base} base ${sgn(p.tax)} tax ${sgn(p.promenade + p.garden)} leisure ${sgn(p.power)} power${p.broke ? ` ${sgn(p.broke)} broke` : ''}</span>`;
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
  const net = st.netPerMin();
  $('ledger').innerHTML = `<span>Tax</span><span class="up">+${Math.round(st.taxPerMin())} /min</span>`
    + `<span>Upkeep</span><span class="down">−${Math.round(st.upkeep())} /min</span>`
    + `<span>Trade so far</span><span class="up">+${Math.round(st.totals.trade)}</span>`
    + `<span><b>Running profit, last minute</b></span><span class="${net >= 0 ? 'up' : 'down'}"><b>${net >= 0 ? '+' : '−'}${Math.abs(Math.round(net))} /min</b></span>`;
}

// ---------------------------------------------------------------- messages
const msgs = [];
function say(text, cls = 'info') {
  msgs.push({ text, cls, t: performance.now() });
  while (msgs.length > 5) msgs.shift();
  drawMsgs();
}
function drawMsgs() {
  const now = performance.now();
  $('msgs').innerHTML = msgs.filter((m) => now - m.t < 16000).map((m, i, a) => `<div class="m-${m.cls}${i < a.length - 1 ? ' old' : ''}">${m.text}</div>`).join('');
}
let bannerT = 0;
function drain() {
  for (const e of st.events) {
    if (!ui.started) continue;
    switch (e.type) {
      case 'built': audio.play('built'); break;
      case 'crate': audio.play('crate'); break;
      case 'dock': audio.play('dock'); say(e.text); break;
      case 'lost': audio.play('lost'); say(e.text, 'bad'); break;
      case 'left': say(e.text, 'warn'); break;
      case 'milestone': audio.play('milestone'); say(e.text, 'gold'); $('banner').innerHTML = 'GARRISON PERMIT GRANTED<small>The build zone grows. Rings, promenades, drums and pylons unlocked.</small>'; $('banner').classList.add('show'); bannerT = 5; break;
      case 'talk': say(e.text, 'dim'); break;
    }
  }
  st.events.length = 0;
}

// ---------------------------------------------------------------- HUD
function hud() {
  const net = st.netPerMin();
  $('r-cr').textContent = st.sandbox ? '∞' : Math.round(st.credits).toLocaleString('en-US');
  $('r-net').textContent = st.sandbox ? '' : `${net >= 0 ? '+' : '−'}${Math.abs(Math.round(net))}/min`; $('r-net').className = net >= 0 ? 'up' : 'down';
  $('r-pw').textContent = `${st.demand}/${st.supply}`; $('r-pw').style.color = st.eff < 1 ? 'var(--red)' : '';
  $('r-pop').textContent = `${st.residents()}/${st.beds()}`;
  const mo = Math.round(st.morale); $('r-mo').textContent = mo; $('r-mo').style.color = mo >= 55 ? '' : mo >= 35 ? 'var(--amber)' : 'var(--red)';
  $('r-sh').textContent = `${st.stats.ships} · ${st.stats.lost}`;
  const m = st.milestone();
  $('tier').textContent = st.sandbox ? 'FREE PLAY' : m.done ? 'GARRISON' : 'OUTPOST';
  $('tier-next').textContent = st.sandbox ? 'every part, no costs · test tools under SIM' : m.done ? 'more milestones after this test' : `next: ${m.name} · ${m.items.filter((i) => i.ok).length}/${m.items.length}`;
  gridState();
  if (!ui.tool) info();
  if ($('s-menu').classList.contains('on')) menuText();
  if (st.sandbox && !$('simpanel').classList.contains('hidden')) simStats();
}
let infoHTML = '';
function setInfo(html, bind) { if (html === infoHTML) return; infoHTML = html; $('info').innerHTML = html; if (bind) bind(); }
function stat(label, value, cls = '') { return `<span class="${cls}"><i>${label}</i>${value}</span>`; }
function info(peek) {
  const t = ui.tool || peek;
  if (t) {
    const d = C.parts[t];
    setInfo(`<div class="in">${d.name.toUpperCase()}</div><div class="ia">${d.about}</div>`
      + `<div class="st">${stat('COST', `${d.cost} CR`, st.credits < d.cost && !st.sandbox ? 'bad' : '')}${stat('POWER', d.pw < 0 ? `+${-d.pw}` : `−${d.pw}`)}${stat('UPKEEP', `${d.up}/min`)}${d.beds ? stat('BEDS', d.beds) : ''}${d.crates ? stat('CRATES', d.crates) : ''}</div>`
      + (ui.tool ? `<div class="ia">Click a glowing port to attach it. <b>R</b> turns it (${ui.rot * 45}°). Right-click or Esc puts it down.</div>` : ''));
    return;
  }
  const p = ui.sel && st.parts.get(ui.sel);
  if (p) {
    const d = C.parts[p.type];
    const state = p.state === 'building' ? `<span class="warn">Building ${Math.round(p.prog * 100)}%</span>` : p.state === 'demolish' ? '<span class="bad">Coming down</span>' : '<span class="ok">Running</span>';
    let extra = '';
    if (d.beds) extra += stat('RESIDENTS', `${st.agents.filter((a) => a.role === 'resident' && a.home === p.id).length}/${d.beds}`);
    if (d.berth) { const s = st.ships.find((x) => x.dock === p.id); extra += stat('BERTH', s ? `${s.name}${s.state === 'docked' && s.kind === 'freighter' ? `, ${s.crates} crates` : s.state === 'approach' ? ', approaching' : ''}` : 'empty'); }
    const cd = st.canDemolish(p.id);
    setInfo(`<div class="in">${st.name(p).toUpperCase()}</div><div class="ia">${d.about}</div>`
      + `<div class="st">${stat('STATUS', state)}${stat('POWER', d.pw < 0 ? `+${-d.pw}` : `−${d.pw}`)}${extra}</div>`
      + `<div class="acts"><button class="btn" id="a-focus" type="button">FOCUS <small>F</small></button>${p.type !== 'command' ? `<button class="btn" id="a-demo" type="button" ${cd.ok ? '' : 'disabled'} title="${cd.why}">DEMOLISH <small>X</small> ${cd.ok ? `+${Math.round(d.cost * C.demolish.refund)} CR` : ''}</button>` : ''}</div>`, () => {
      $('a-focus').onclick = () => view.focus(p.id);
      if ($('a-demo')) $('a-demo').onclick = () => demolishSel();
    });
    return;
  }
  const m = st.milestone();
  setInfo(`<div class="in">${st.sandbox ? 'FREE PLAY' : 'STATION OVERVIEW'}</div>`
    + `<div class="ia">Pick a part from the grid, then click a glowing port. Click a part to select it. Drag to orbit, right-drag to pan, scroll to zoom.</div>`
    + (st.sandbox || m.done ? '' : `<ul class="ms">${m.items.map((i) => `<li class="${i.ok ? 'ok' : ''}">${i.label} ${Math.min(i.have, i.need)}/${i.need}</li>`).join('')}<li class="ok" style="color:var(--g-dim)">Unlocks: ${m.unlocks}</li></ul>`));
}

// ---------------------------------------------------------------- minimap: the station from above
const mini = $('mini'), mx = mini.getContext('2d');
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
    mx.strokeStyle = sel ? '#ffe600' : p.state === 'active' ? 'rgba(157,255,184,0.9)' : 'rgba(255,230,0,0.6)'; mx.fillStyle = mx.strokeStyle;
    if (p.type === 'ring' || p.type === 'bigring' || p.type === 'disc' || p.type === 'drum') { mx.beginPath(); mx.arc(x, y, ({ ring: 7, bigring: 12, disc: 5.6, drum: 4.7 })[p.type] * k, 0, 6.283); mx.stroke(); }
    else if (C.parts[p.type].ports[0][6] === 'L') { const b0 = st.port(p, 0).pos; mx.beginPath(); mx.moveTo(b0[0] * k, b0[2] * k); mx.lineTo(x + (x - b0[0] * k), y + (y - b0[2] * k)); mx.lineWidth = 2; mx.stroke(); mx.lineWidth = 1; }
    else { mx.fillRect(x - 2, y - 2, 4, 4); }
  }
  for (const s of st.ships) {
    const o = view.shipObjs.get(s.id); if (!o) continue;
    const x = o.position.x * k, y = o.position.z * k;
    if (Math.hypot(x, y) > R) continue;
    mx.fillStyle = s.state === 'hold' ? '#ffe600' : '#4db8ff'; mx.fillRect(x - 2, y - 2, 4, 4);
  }
  // The camera's view, as a wedge.
  const cam = view.camera.position, tg = view.controls.target, a = Math.atan2(tg.z - cam.z, tg.x - cam.x), cx = cam.x * k, cy = cam.z * k;
  const d = Math.min(R * 0.9, Math.hypot(cam.x, cam.z) * k);
  mx.fillStyle = 'rgba(255,255,255,0.08)'; mx.strokeStyle = 'rgba(255,255,255,0.5)';
  mx.beginPath(); mx.moveTo(Math.max(-R, Math.min(R, cx)), Math.max(-R, Math.min(R, cy)));
  mx.arc(Math.max(-R, Math.min(R, cx)), Math.max(-R, Math.min(R, cy)), d * 0.5 + 10, a - 0.35, a + 0.35); mx.closePath(); mx.fill(); mx.stroke();
  mx.restore();
}
mini.addEventListener('click', (e) => {   // click the minimap to look there
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
addEventListener('resize', () => { view.resize(); fx(); });
fx();

// ---------------------------------------------------------------- loop
const STEP = 1 / 30;
let last = performance.now(), acc = 0, hudT = 0, miniT = 0;
function frame(nowMs) {
  const now = nowMs / 1000, dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
  if (!ui.paused) {
    acc += dt * (ui.started ? ui.speed : 1);
    let n = 0;
    while (acc >= STEP && n++ < 12) { st.step(STEP); acc -= STEP; }
    if (n >= 12) acc = 0;
  }
  drain();
  view.sync(now);
  view.render(now);
  if (ui.started) {
    if ((hudT -= dt) <= 0) { hudT = 0.25; hud(); drawMsgs(); if (ui.tool) view.showPorts(ui.tool, ui.rot, ui.hot); }
    if ((miniT -= dt) <= 0) { miniT = 0.1; drawMini(); }
    if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');
  }
  requestAnimationFrame(frame);
}
if (qs.has('economy') || qs.has('run')) start('run'); else if (qs.has('free') || qs.has('sandbox')) start('sandbox');
requestAnimationFrame(frame);
