// Browser test: plays the prototype through the real page on a desktop and on a phone held sideways.
// Usage: npm start (in another terminal), then node test/ui.mjs [baseUrl=http://localhost:8080]
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8080';
fs.mkdirSync('test/shots', { recursive: true });
let fails = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) fails++; };
// Software WebGL, so the test runs on machines without a GPU.
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// Where a free port is on screen (pred is a test on the port, as source text).
const portXY = (page, pred) => page.evaluate((src) => {
  const v = window.__view, f = new Function('p', `return ${src}`);
  const fp = window.__st.freePorts().find((p) => f(p));
  if (!fp) return null;
  v.camera.updateMatrixWorld(); const q = v.camera.position.clone().set(...fp.pos).project(v.camera), r = v.canvas.getBoundingClientRect();
  return [(q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top];
}, pred);
const partXY = (page, pred) => page.evaluate((src) => {
  const v = window.__view, f = new Function('p', `return ${src}`), p = [...window.__st.parts.values()].find((x) => f(x));
  v.camera.updateMatrixWorld(); const c = window.__st.center(p), q = v.camera.position.clone().set(...c).project(v.camera), r = v.canvas.getBoundingClientRect();
  return [(q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top];
}, pred);
const tileXY = (page, slot) => page.evaluate((slot) => {
  const v = window.__view, g = v.roomObjs.get(v.edit).group; let t;
  g.traverse((m) => { if (!t && m.userData.role === 'tile' && m.userData.slot === slot) t = m; });
  v.camera.updateMatrixWorld(); const q = t.getWorldPosition(t.position.clone()).project(v.camera), r = v.canvas.getBoundingClientRect();
  return [(q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top];
}, slot);
const steps = (page, sec) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__st.step(1 / 30); }, Math.round(sec * 30));

// ---------------------------------------------------------------- desktop, economy
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('  page error:', e.message); });
  await page.goto(`${BASE}/index.html?seed=1`); await page.waitForTimeout(1500);
  check('the title shows over a demo station', await page.isVisible('#s-title') && await page.evaluate(() => window.__view.partObjs.size) > 20);
  await page.screenshot({ path: 'test/shots/title.png' });
  await page.click('#b-economy'); await page.waitForTimeout(500);
  check('ECONOMY starts with Station Command alone and 2,500 CR', await page.evaluate(() => window.__st.parts.size === 1 && window.__st.credits > 2490 && window.__st.credits <= 2500));
  check('Hull is the default view', await page.evaluate(() => window.__view.mode === 'hull' && window.__ui.view === 'hull') && await page.$eval('.vb[data-v="hull"]', (b) => b.classList.contains('on')));
  check('the top bar shows capability, not a profit figure', await page.evaluate(() => !document.getElementById('r-net') && /^\d/.test(document.getElementById('r-cap').textContent)));
  check('parts come in seven groups', (await page.$$eval('#groups .gt', (b) => b.map((x) => x.textContent))).join() === 'STRUCT,HAB,DOCK,INDUS,POWER,DEF,COMMS');
  await page.keyboard.press('Tab');
  const hab = await page.$$eval('#cmd .cb', (b) => b.map((x) => [x.dataset.t, x.classList.contains('locked')]));
  check('Tab opens the next group, with its later parts locked', hab.length === 7 && hab.filter((g) => g[1]).map((g) => g[0]).join() === 'ring,drum,disc,tower', JSON.stringify(hab));
  await page.keyboard.press('w'); await page.waitForTimeout(200);
  check('a locked part is refused with the tier that unlocks it', /GARRISON/.test(await page.textContent('#toast')));

  await page.click('#groups .gt[data-g="docking"]'); await page.keyboard.press('q'); await page.waitForTimeout(200);
  check('a group key picks its part', await page.evaluate(() => window.__ui.tool) === 'dockport');
  await page.mouse.move(40, 300); await page.waitForTimeout(200);
  check('no port dots far from the pointer', await page.evaluate(() => window.__view.markers.children.length) === 0);
  const xy = await portXY(page, 'p.part === 1 && p.i === 2');
  await page.mouse.move(...xy); await page.waitForTimeout(250);
  const near = await page.evaluate(() => window.__view.markers.children.length);
  check('small dots show only on the ports near the pointer', near > 0 && near < 6, `${near} of 6`);
  check('the dots are see-through', await page.evaluate(() => window.__view.M.port.opacity < 0.6));
  check('hovering a port shows a ghost of the part', await page.evaluate(() => !!window.__view.ghost));
  await page.mouse.click(...xy); await page.waitForTimeout(200);
  check('clicking the port builds the docking port', await page.evaluate(() => [...window.__st.parts.values()].some((p) => p.type === 'dockport')));
  await page.keyboard.press('p'); await page.click('#groups .gt[data-g="industry"]'); await page.keyboard.press('q');
  const xy2 = await portXY(page, 'p.part === 1 && p.i === 3');
  await page.mouse.move(...xy2); await page.waitForTimeout(250);
  check('P turns the dots off', await page.evaluate(() => window.__view.markers.children.length) === 0 && /OFF/.test(await page.textContent('#b-dots')));
  await page.mouse.click(...xy2); await page.waitForTimeout(200);
  check('parts still snap to ports with the dots off', await page.evaluate(() => [...window.__st.parts.values()].some((p) => p.type === 'cargo')));
  await page.keyboard.press('p');
  await page.keyboard.press('r');
  check('R turns the part', await page.evaluate(() => window.__ui.rot) === 1);
  await page.keyboard.press('Escape'); for (let i = 0; i < 7; i++) await page.keyboard.press('r');

  // Comms: a closeable window above the minimap.
  check('station comms come in over the minimap, on channels', await page.isVisible('#comms') && /CH 1 · MINISTRY OF ORBITAL AFFAIRS/.test(await page.textContent('#c-list')));
  const cb = await page.$eval('#comms', (e) => { const r = e.getBoundingClientRect(), m = document.getElementById('mini').getBoundingClientRect(); return r.right >= m.right - 2 && r.bottom <= m.top; });
  check('the comms window sits on the right, above the minimap', cb);
  await page.click('#c-x');
  check('the comms window closes', !(await page.isVisible('#comms')) && await page.isVisible('#c-open'));
  await page.evaluate(() => window.__st.say('traffic', 'A message while the window is closed.'));
  await page.waitForFunction(() => document.getElementById('c-badge').textContent !== '', null, { timeout: 5000 }).catch(() => {});
  check('closed comms count unread messages', +(await page.textContent('#c-badge')).trim() >= 1);
  await page.keyboard.press('c');
  check('C opens them again', await page.isVisible('#comms') && (await page.textContent('#c-badge')).trim() === '');

  // Build out a little station and let it run.
  await page.evaluate(() => {
    const s = window.__st, b = (t, h, k, r = 0) => s.build(t, h, k, r).id;
    b('hab', 1, 4); b('hab', 1, 5);
    const c = b('core', 1, 1); b('reactor', c, 1);
  });
  await steps(page, 60);
  const mid = await page.evaluate(() => ({ crates: window.__st.stats.crates, res: window.__st.residents() }));
  check('ships dock and haulers carry crates to cargo', mid.crates > 0, JSON.stringify(mid));

  // Edit inside a hab: the rooms are in 3D, in the part itself.
  await page.evaluate(() => window.__view.focus([...window.__st.parts.values()].find((p) => p.type === 'hab').id, true)); await page.waitForTimeout(300);
  // (software rendering is slow, so a click can arrive late; try a few times)
  for (let i = 0; i < 3 && await page.evaluate(() => window.__st.parts.get(window.__ui.sel)?.type) !== 'hab'; i++) { await page.mouse.click(...await partXY(page, 'p.type === "hab"')); await page.waitForTimeout(300); }
  check('clicking a part selects it, with EDIT INSIDE', await page.evaluate(() => window.__st.parts.get(window.__ui.sel)?.type) === 'hab' && await page.isVisible('#a-edit'), await page.evaluate(() => `${window.__st.parts.get(window.__ui.sel)?.type} ${window.__ui.tool} ${window.__ui.edit}`));
  await page.keyboard.press('i'); await page.waitForTimeout(500);
  check('I opens the part: a room palette and its rooms', await page.evaluate(() => window.__view.edit) && (await page.$$('#cmd .rb')).length === 16 && (await page.$$('#info .chip[data-i]')).length === 3);
  const habId = await page.evaluate(() => window.__view.edit), cr0 = await page.evaluate(() => window.__st.credits);
  await page.click('.rb[data-r="mess"]');
  const t1 = await tileXY(page, 1);
  await page.mouse.move(...t1); await page.waitForTimeout(150);
  check('hovering a room shows what it would become', /Mess Hall/.test(await page.textContent('#tip')));
  await page.mouse.click(...t1); await page.waitForTimeout(200);
  const rooms = await page.evaluate((id) => window.__st.parts.get(id).rooms.join(), habId);
  check('clicking a room builds it, and it costs', rooms === 'quarters,mess,quarters' && await page.evaluate(() => window.__st.credits) < cr0 - 25, rooms);
  check('bay rooms are refused outside a hangar', await page.evaluate(() => document.querySelector('.rb[data-r="shuttlebay"]').classList.contains('na') || document.querySelector('.rb[data-r="shuttlebay"]').classList.contains('locked')));
  await page.screenshot({ path: 'test/shots/edit-inside.png' });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  check('Esc puts the room down, then leaves the part', await page.evaluate(() => !window.__view.edit) && (await page.$$('#cmd .cb')).length > 0);

  // The Commander's channel.
  await page.keyboard.press('o'); await page.waitForTimeout(300);
  check('O opens the Commander\'s channel with six divisions', await page.isVisible('#cmdr') && (await page.$$('#cm-tabs .dt')).length === 6);
  await page.click('#cm-tabs .dt[data-k="maintenance"]'); await page.waitForTimeout(100);
  await page.click('.ob[data-v="preventive"]'); await page.waitForTimeout(300);
  check('a standing order is given and acknowledged on the radio', await page.evaluate(() => window.__st.div.maintenance.order.plan) === 'preventive' && /CH 4 · PATRIOTIC MAINTENANCE/.test(await page.textContent('#c-list')));
  await page.$eval('#cm-budget', (e) => { e.value = 40; e.dispatchEvent(new Event('input')); });
  check('the budget slider funds the division', await page.evaluate(() => window.__st.div.maintenance.budget) === 40);
  await page.waitForTimeout(1200);
  check('the division reports in its own voice', /Engineers on staff/.test(await page.textContent('#cm-rep')));
  await page.screenshot({ path: 'test/shots/commander.png' });
  // Factions: a mood, what they want, and their people by name.
  check('a division page shows its faction: mood, wants and named crew', await page.isVisible('#cm-fac .fac') && /Wants/.test(await page.textContent('#cm-fac')) && (await page.$$('#cm-fac .pp')).length > 0);
  const who = await page.$eval('#cm-fac .pp', (b) => b.firstChild.textContent);
  await page.click('#cm-fac .pp'); await page.waitForTimeout(300);
  check('clicking a name in the crew list shows that person', await page.evaluate(() => window.__ui.person > 0) && (await page.textContent('#info')).toLowerCase().includes(who.toLowerCase()));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);

  // The upgrade path.
  await page.keyboard.press('u'); await page.waitForTimeout(200);
  check('U shows the upgrade path, Outpost to Citadel', (await page.$$('#up-list .tier')).length === 4 && await page.isVisible('#up-list .tier.now') && (await page.$$('#up-list .tier.next .req')).length === 3);
  await page.screenshot({ path: 'test/shots/upgrades.png' });
  await page.keyboard.press('u');
  for (let i = 0; i < 14 && await page.evaluate(() => window.__st.tier) < 1; i++) await steps(page, 60);
  await page.waitForTimeout(400);
  check('Garrison status is granted and grows the build zone', await page.evaluate(() => window.__st.tier >= 1 && window.__st.radius === 40), await page.evaluate(() => JSON.stringify(window.__st.next()?.items.map((i) => `${i.label} ${i.have}/${i.need}`))));
  // A faction asks for a room: approve it from the comms window.
  await page.evaluate(() => { window.__st.credits += 500; window.__st.timers.request = 0; });
  await steps(page, 2); await page.waitForTimeout(500);
  const askN = await page.evaluate(() => window.__st.requests.length);
  check('a faction asks for a room, with APPROVE and DENY on the comms', askN >= 1 && (await page.$$('#c-list .rq-bar button')).length >= 2, `${askN}`);
  check('the Commander button counts what is waiting', +(await page.textContent('#cm-badge')).trim() === askN);
  const ask = await page.evaluate(() => ({ ...window.__st.requests[0] }));
  await page.locator('#c-list .rq-bar button[data-a="ok"]').first().click(); await page.waitForTimeout(300);
  const built = await page.evaluate((a) => { const p = window.__st.parts.get(a.part); return p && p.rooms[a.slot] === a.room && p.marks[a.slot] === a.k; }, ask);
  check('approving builds the room and marks it for the faction', built, JSON.stringify(ask));
  check('the message shows the answer', /APPROVED/.test(await page.textContent('#c-list')));
  await page.click('#groups .gt[data-g="habitation"]');
  check('and unlocks the rings', !(await page.$eval('#cmd .cb[data-t="ring"]', (b) => b.classList.contains('locked'))));

  // Views, the sky, and hiding everything.
  await page.keyboard.press('2'); await page.waitForTimeout(300);
  check('2 shows the hull over a planet', await page.evaluate(() => window.__view.mode === 'hull' && window.__view.planet.visible));
  await page.evaluate(() => { window.__view.camera.position.x += 15; window.__view.render(); });
  check('the stars, sun and moons move with the camera, so they never slide', await page.evaluate(() => window.__view.sky.position.distanceTo(window.__view.camera.position) < 1e-6));
  await page.keyboard.press('4'); await page.waitForTimeout(300);
  check('4 cuts the station away', await page.evaluate(() => window.__view.cutaway && !!window.__view.M.hull.clippingPlanes));
  await page.screenshot({ path: 'test/shots/cutaway.png' });
  await page.keyboard.press('4'); await page.keyboard.press('3'); await page.waitForTimeout(300);
  check('3 shows life signs', await page.evaluate(() => window.__view.mode === 'life' && window.__view.agentPts.geometry.drawRange.count > 0));
  check('life signs are only people inside the station', await page.evaluate(() => window.__view.agentPts.geometry.drawRange.count <= window.__st.agents.filter((a) => !a.eva).length + window.__view.suits.children.filter((s) => s.visible).length));
  await page.screenshot({ path: 'test/shots/life-signs.png' });
  await page.evaluate(() => { window.__ui.paused = true; });      // hold still, so the person is where we aimed
  const dot = await page.evaluate(() => { const v = window.__view, a = window.__st.agents.find((x) => !x.eva && v.agentPos(x, performance.now() / 1000)); v.camera.updateMatrixWorld(); const P = v.agentPos(a, performance.now() / 1000), q = v.camera.position.clone().set(...P).project(v.camera), r = v.canvas.getBoundingClientRect(); return { id: a.id, name: a.name, xy: [(q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top] }; });
  await page.mouse.move(...dot.xy); await page.waitForTimeout(250);
  check('hovering a life sign names the person', (await page.textContent('#tip')).length > 3 && !(await page.isHidden('#tip')));
  await page.mouse.click(...dot.xy); await page.waitForTimeout(300);
  check('clicking a life sign shows who they are', await page.evaluate(() => window.__ui.person > 0) && /DOING/.test(await page.textContent('#info')), await page.textContent('#info'));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__ui.paused = false; });
  await page.keyboard.press('2'); await page.keyboard.press('h'); await page.waitForTimeout(200);
  check('H hides the interface, leaving only the station', !(await page.isVisible('#hud')) && await page.isVisible('#b-showui') && await page.evaluate(() => !window.__view.overlay));
  await page.screenshot({ path: 'test/shots/clean.png' });
  check('hidden means hidden: no panels, tips, toasts or banners', await page.evaluate(() => ['hud', 'tip', 'toast', 'banner', 'fx'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none')));
  await page.mouse.click(683, 300); await page.waitForTimeout(150);
  check('tapping the station brings the SHOW UI button back for a moment', await page.evaluate(() => document.getElementById('app').classList.contains('peek')));
  await page.keyboard.press('h');
  check('H brings it back', await page.isVisible('#hud'));
  await page.keyboard.press('1');

  // Demolish.
  await page.evaluate(() => window.__view.frame()); await page.waitForTimeout(400);
  await page.mouse.click(...await partXY(page, 'p.type === "dockport"')); await page.waitForTimeout(200);
  check('clicking a part selects it', await page.evaluate(() => window.__st.parts.get(window.__ui.sel)?.type) === 'dockport');
  await page.keyboard.press('x'); await page.waitForTimeout(200);
  check('X demolishes a part with nothing attached', await page.evaluate(() => [...window.__st.parts.values()].find((p) => p.type === 'dockport')?.state) === 'demolish');
  const refused = await page.evaluate(() => window.__st.canDemolish([...window.__st.parts.values()].find((p) => p.type === 'core').id));
  check('a part holding others cannot be demolished', !refused.ok && /attached/.test(refused.why));
  await page.screenshot({ path: 'test/shots/desktop.png' });
  check('no page errors on desktop', errs.length === 0, errs.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- free play
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('  page error:', e.message); });
  await page.goto(`${BASE}/index.html?seed=4`); await page.waitForTimeout(1200);
  await page.click('#b-free'); await page.waitForTimeout(400);
  check('FREE PLAY opens with its controls showing', await page.isVisible('#simpanel') && /FREE PLAY/.test(await page.textContent('#tier')));
  check('nothing on screen calls itself a test', !/test/i.test(await page.evaluate(() => document.getElementById('hud').innerText)));
  await page.click('#t-freighter'); await page.waitForTimeout(200);
  check('+ FREIGHTER with no berth says why', /Docking Port/.test(await page.textContent('#toast')) && await page.evaluate(() => window.__st.ships.length) === 0);
  await page.evaluate(() => { const s = window.__st, b = (t, h, k) => s.build(t, h, k).id; b('dockport', 1, 2); b('cargo', 1, 3); b('hab', 1, 4); window.__dd = b('drydock', 1, 5); });
  await steps(page, 20);
  await page.click('#t-traffic'); await page.click('#t-clear'); await page.waitForTimeout(200);
  check('TRAFFIC OFF and CLEAR SHIPS empty the sky', await page.evaluate(() => !window.__st.traffic && window.__st.ships.length === 0));
  await steps(page, 60);
  check('with traffic off, no ships come on their own', await page.evaluate(() => window.__st.ships.length) === 0);
  await page.click('#t-freighter'); await page.waitForTimeout(100);
  check('+ FREIGHTER sends one in', await page.evaluate(() => window.__st.ships.filter((x) => x.kind === 'freighter').length) === 1);
  await page.click('#t-warship'); await page.waitForTimeout(100);
  check('+ WARSHIP sends a damaged warship to the drydock', await page.evaluate(() => window.__st.ships.some((x) => x.kind === 'warship')));
  await page.click('#t-colonists'); await page.waitForTimeout(100);
  check('+ 10 COLONISTS fills the free beds', await page.evaluate(() => window.__st.residents() === window.__st.beds()));
  const f0 = await page.evaluate(() => window.__st.stats.faults);
  await page.click('#t-fault'); await page.waitForTimeout(100);
  check('BREAK A PART breaks something', await page.evaluate(() => window.__st.stats.faults) === f0 + 1);
  await page.waitForFunction(() => window.__st.agents.some((a) => a.eva), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('engineers go out on EVA, in suits', await page.evaluate(() => window.__st.agents.some((a) => a.eva) && window.__view.suits.children.some((s) => s.visible)));
  await page.keyboard.press('2'); await page.waitForTimeout(300);
  await page.screenshot({ path: 'test/shots/eva.png' });
  for (let i = 0; i < 4; i++) await page.click('#b-speed');
  check('free play runs up to 16×', (await page.textContent('#b-speed')).trim() === '16×');
  await steps(page, 90); await page.waitForTimeout(400);
  check('the readout shows crates moving', await page.evaluate(() => window.__st.stats.crates) > 0 && /Crates \/ min/.test(await page.textContent('#t-stats')));
  await page.screenshot({ path: 'test/shots/free-play.png' });
  await page.keyboard.press('k'); await page.waitForTimeout(100);
  check('K hides the controls', !(await page.isVisible('#simpanel')));
  check('no page errors in free play', errs.length === 0, errs.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- phone held sideways
{
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('  page error:', e.message); });
  await page.goto(`${BASE}/index.html?free&seed=2`); await page.waitForTimeout(1200);
  check('free play starts with every part and no costs', await page.evaluate(() => window.__st.sandbox && window.__st.tier === 3));
  await page.tap('#groups .gt[data-g="habitation"]'); await page.tap('#cmd .cb[data-t="ring"]'); await page.waitForTimeout(300);
  await page.touchscreen.tap(420, 200); await page.waitForTimeout(200);   // a tap on empty space marks this as a touch screen
  const free = await page.evaluate(() => window.__st.freePorts().length);
  check('on a touch screen every free port shows a faint dot', await page.evaluate(() => window.__view.markers.children.length) === free, `${free}`);
  const xy = await portXY(page, 'p.part === 1 && p.i === 0');
  await page.touchscreen.tap(...xy); await page.waitForTimeout(300);
  check('the first tap shows the part in place', await page.evaluate(() => !!window.__view.ghost && ![...window.__st.parts.values()].some((p) => p.type === 'ring')));
  await page.touchscreen.tap(...xy); await page.waitForTimeout(300);
  check('a second tap builds it', await page.evaluate(() => [...window.__st.parts.values()].some((p) => p.type === 'ring')));
  await page.screenshot({ path: 'test/shots/phone.png' });
  await steps(page, 15);
  await page.evaluate(() => { const r = [...window.__st.parts.values()].find((p) => p.type === 'ring'); window.__ui.sel = r.id; window.__view.select(r.id); });
  check('on a short screen the free play controls start folded away', !(await page.isVisible('#simpanel')));
  await page.keyboard.press('i'); await page.waitForTimeout(500);
  await page.tap('#info .chip[data-i="2"]'); await page.tap('.rb[data-r="bar"]'); await page.waitForTimeout(200);
  check('on a phone, tap a room number then a room to build it', await page.evaluate(() => [...window.__st.parts.values()].find((p) => p.type === 'ring').rooms[2]) === 'bar');
  await page.screenshot({ path: 'test/shots/phone-edit.png' });
  await page.keyboard.press('i'); await page.tap('#b-cmdr'); await page.waitForTimeout(400);
  await page.screenshot({ path: 'test/shots/phone-commander.png' });
  check('no page errors on the phone', errs.length === 0, errs.join(' | '));
  await page.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
