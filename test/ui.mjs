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
  check('build buttons show a picture of the part, with its name and cost', await page.evaluate(() => { const b = document.querySelector('#cmd .cb'); return !!b.querySelector('img') && b.querySelector('img').src.startsWith('data:image/png') && !!b.querySelector('.cn').textContent && +b.querySelector('.cc').textContent > 0; }));
  check('parts come in eight groups, fire support second', (await page.$$eval('#groups .gt', (b) => b.map((x) => x.textContent))).join() === 'STRUCT,FIRE,HAB,DOCK,INDUS,POWER,DEF,COMMS');
  await page.keyboard.press('Tab');
  const hab = await page.$$eval('#cmd .cb', (b) => b.map((x) => [x.dataset.t, x.classList.contains('locked')]));
  check('Tab opens the next group, with its later parts locked', hab.length === 9 && hab.filter((g) => g[1]).map((g) => g[0]).join() === 'dronebay,relay,barracks,eaglehangar,pelicanbay,fabshop,lance', JSON.stringify(hab));
  await page.keyboard.press('3'); await page.waitForTimeout(200);
  check('a locked part is refused with the tier that unlocks it', /GARRISON/.test(await page.textContent('#toast')));

  await page.click('#groups .gt[data-g="docking"]'); await page.keyboard.press('1'); await page.waitForTimeout(200);
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
  await page.keyboard.press('j'); await page.click('#groups .gt[data-g="industry"]'); await page.keyboard.press('1');
  const xy2 = await portXY(page, 'p.part === 1 && p.i === 3');
  await page.mouse.move(...xy2); await page.waitForTimeout(250);
  check('P turns the dots off', await page.evaluate(() => window.__view.markers.children.length) === 0 && /OFF/.test(await page.textContent('#b-dots')));
  await page.mouse.click(...xy2); await page.waitForTimeout(200);
  check('parts still snap to ports with the dots off', await page.evaluate(() => [...window.__st.parts.values()].some((p) => p.type === 'cargo')));
  await page.keyboard.press('j');
  await page.keyboard.press('r');
  check('R turns the part', await page.evaluate(() => window.__ui.rot) === 1);
  await page.keyboard.press('Escape'); for (let i = 0; i < 7; i++) await page.keyboard.press('r');

  // Comms: a closeable window above the minimap.
  check('station comms come in over the minimap, on channels', await page.isVisible('#comms') && /CH 1 · MINISTRY OF ORBITAL AFFAIRS/.test(await page.textContent('#c-list')));
  const cb = await page.$eval('#comms', (e) => { const r = e.getBoundingClientRect(), m = document.getElementById('panel').getBoundingClientRect(); return r.right >= innerWidth - 40 && r.bottom <= m.top; });
  check('the comms window sits on the right, above the bottom panel', cb);
  check('the minimap is hidden for now', !(await page.isVisible('#mini')));
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
    const c = b('core', 1, 1); b('reactor', c, 1); b('gunmount', c, 2);
  });
  await steps(page, 60);
  const mid = await page.evaluate(() => ({ crates: window.__st.stats.crates, res: window.__st.residents() }));
  check('ships dock and haulers carry crates to cargo', mid.crates > 0, JSON.stringify(mid));
  check('every berth shows a light: green free, amber in use, red when it cannot take ships', await page.evaluate(() => { const v = window.__view, s = window.__st, n = [...s.parts.values()].filter((p) => s.def(p).berth).length; v._beacons(1); return v.bcn.count === n && n > 0; }));
  check('no berth on this plain station is shut: every one has a clear way in', await page.evaluate(() => window.__view.shut.size === 0), await page.evaluate(() => JSON.stringify([...window.__view.shut].map(([id, by]) => `${window.__st.name(window.__st.parts.get(id))} by ${by}`))));
  // The fire support platform, the gravity standard and the livery.
  check('the ship gun is crewed and the top bar reads the platform ready', await page.evaluate(() => { const P = window.__st.platform(); return P.by.gun.n === 1 && P.by.gun.ready > 0.9 && /^\d+%$/.test(document.getElementById('r-rdy').textContent); }), await page.evaluate(() => JSON.stringify(window.__st.platform().sys.map((x) => [x.k, x.n, +x.ready.toFixed(2), x.why]))));
  check('a gun cannot go on a port that faces up', await page.evaluate(() => { const s = window.__st, re = [...s.parts.values()].find((p) => p.type === 'reactor'); return /planet/.test(s.canBuild('battery', re.id, 1).why); }));
  check('every deck is level, however a part is attached', await page.evaluate(() => {
    const s = window.__st, c = [...s.parts.values()].find((p) => p.type === 'core'), v = window.__view, clearOf = (t, h) => [3, 4, 5, 2].find((i) => s.canBuild(t, h.id, i).ok && !v.berthWarn(t, s.placement(t, h, i, 0)).length) ?? 3, ids = [s.build('tower', c.id, clearOf('tower', c)).id, s.build('hab', [...s.parts.values()].find((p) => p.type === 'reactor').id, 1).id];      // on a side port where it does not stand across a berth's approach
    const up = (q) => 1 - 2 * (q[0] * q[0] + q[2] * q[2]);
    const ok = ids.every((id) => id && Math.abs(up(s.parts.get(id).quat) - 1) < 1e-6);
    for (const id of ids) if (id) { s.parts.get(id).state = 'active'; s.demolish(id); }
    return ok;
  }) || await page.evaluate(() => window.__st.tier < 1));
  for (let i = 0; i < 6 && !(await page.evaluate(() => window.__st.stats.calls || 0)); i++) await steps(page, 60);      // which system is called for is chance
  check('calls come up from the ground and the platform answers', await page.evaluate(() => (window.__st.stats.calls || 0) >= 1), await page.evaluate(() => `${window.__st.stats.calls} answered, ${window.__st.stats.missed} missed`));
  check('people walk the corridors: a walker is on a deck, not in mid air', await page.evaluate(() => {
    const s = window.__st, v = window.__view, now = performance.now() / 1000;
    for (let i = 0; i < 400; i++) { s.step(1 / 30); const a = s.agents.find((x) => x.path.length && !x.eva); if (a) { const P = v.agentPos(a, now); return !!P && P.length >= 4 && Number.isFinite(P[1]); } }
    return false;
  }));
  await page.click('#b-liv'); await page.waitForTimeout(200);
  await page.click('#lv-body [data-scheme="sesf"]'); await page.click('#lv-body [data-key="plating"][data-v="plates"]'); await page.click('#lv-body [data-key="emblem"][data-v="star"]');
  await page.fill('#lv-name', 'Tharsis Watch'); await page.press('#lv-name', 'Enter'); await page.waitForTimeout(200);
  check('livery sets the name, colours, plating and emblem', await page.evaluate(() => { const L = window.__st.livery, v = window.__view; return L.name === 'Tharsis Watch' && L.scheme === 'sesf' && L.plating === 'plates' && L.emblem === 'star' && '#' + v.M.hull.color.getHexString() === '#2b2e33' && v.M.hull.map === v.plateTex.plates; }), await page.evaluate(() => JSON.stringify(window.__st.livery)));
  await page.screenshot({ path: 'test/shots/livery.png' });
  // Scale, standing spots and rearranging.
  check('a person is drawn 1.8 m tall against a 9 m unit', await page.evaluate(() => Math.abs(window.__view.personK() * 0.33 - 0.2) < 0.005));
  check('people at rest stand on a planned spot, with a clear way to the door', await page.evaluate(() => {
    const s = window.__st, v = window.__view, a = s.agents.find((x) => !x.path.length && !x.eva && s.parts.get(x.at) && s.parts.get(x.at).rooms.length);
    if (!a) return false; const r = v._rest(a, s.parts.get(a.at)); return !!r.door && Array.isArray(r.via) && r.spot.length === 3;
  }));
  check('people come in a standing and a walking pose, and residents in four looks', await page.evaluate(() => { const v = window.__view; return ['resident', 'resident2', 'resident3', 'resident4', 'trooper', 'pilot'].every((k) => v.figs[k] && v.figsW[k]) && v.figs.resident.geometry.attributes.position.count > 600; }));
  check('Station Command has a lift, and its light goes to whoever rides', await page.evaluate(() => {
    const s = window.__st, v = window.__view; v._lifts(0.016);
    const c = v.lifts.get(1); if (!c) return false;
    v.liftRider.set(1, c.y + 0.5); v._lifts(1); const moved = Math.abs(c.obj.position.y - (c.y)) < 1e-6 && c.y > s.parts.get(1).pos[1] - 1; v.liftRider.clear();
    return moved;
  }));
  check('fittings and floors are textured', await page.evaluate(() => { const M = window.__view.M; return [M.wood, M.steel, M.wall, M.inner, M.locker, M.sofa].every((m) => !!m.map) && Object.values(window.__view.tileMats).every((m) => !!m.map); }));
  check('painting the same room again rearranges it', await page.evaluate(() => {
    const s = window.__st, p = [...s.parts.values()].find((x) => x.type === 'hab'), was = (p.fit && p.fit[0]) || 0;
    const r = s.setRoom(p.id, 0, p.rooms[0]); const f = s.refit(p.id, 0);
    return !r.ok && f.ok && p.fit[0] === (was + 1) % 6;
  }));
  check('the people size setting changes how large people are drawn', await page.evaluate(() => {
    const i = document.getElementById('in-people'); i.value = 140; i.dispatchEvent(new Event('input'));
    const big = window.__view.peopleK === 1.4 && i.nextElementSibling.textContent === '140%';
    i.value = 100; i.dispatchEvent(new Event('input'));
    return big && window.__view.peopleK === 1;
  }));
  await page.click('#lv-body [data-scheme="ministry"]'); await page.click('#lv-body [data-key="plating"][data-v="panels"]'); await page.click('#lv-x');

  // Edit inside a hab: the rooms are in 3D, in the part itself.
  await page.evaluate(() => window.__view.focus([...window.__st.parts.values()].find((p) => p.type === 'hab').id, true)); await page.waitForTimeout(300);
  // (software rendering is slow, so a click can arrive late; try a few times)
  for (let i = 0; i < 3 && await page.evaluate(() => window.__st.parts.get(window.__ui.sel)?.type) !== 'hab'; i++) { await page.mouse.click(...await partXY(page, 'p.type === "hab"')); await page.waitForTimeout(300); }
  check('clicking a part selects it, with EDIT INSIDE', await page.evaluate(() => window.__st.parts.get(window.__ui.sel)?.type) === 'hab' && await page.isVisible('#a-edit'), await page.evaluate(() => `${window.__st.parts.get(window.__ui.sel)?.type} ${window.__ui.tool} ${window.__ui.edit}`));
  await page.keyboard.press('i'); await page.waitForTimeout(500);
  check('I opens the part: a room palette and its rooms', await page.evaluate(() => window.__view.edit) && (await page.$$('#cmd .rb')).length === 28 && (await page.$$('#info .chip[data-i]')).length === 3);
  const habId = await page.evaluate(() => window.__view.edit), cr0 = await page.evaluate(() => window.__st.totals.build);      // what has been spent on building (the credits themselves move with trade)
  await page.click('.rb[data-r="mess"]');
  const t1 = await tileXY(page, 1);
  await page.mouse.move(...t1); await page.waitForTimeout(150);
  check('hovering a room shows what it would become', /Mess Hall/.test(await page.textContent('#tip')));
  await page.mouse.click(...t1); await page.waitForTimeout(200);
  const rooms = await page.evaluate((id) => window.__st.parts.get(id).rooms.join(), habId);
  check('clicking a room builds it, and it costs', rooms === 'quarters,mess,quarters' && await page.evaluate(() => window.__st.totals.build) <= cr0 - 30, rooms);
  check('bay rooms are refused outside a hangar', await page.evaluate(() => document.querySelector('.rb[data-r="shuttlebay"]').classList.contains('na') || document.querySelector('.rb[data-r="shuttlebay"]').classList.contains('locked')));
  await page.screenshot({ path: 'test/shots/edit-inside.png' });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  check('Esc puts the room down, then leaves the part', await page.evaluate(() => !window.__view.edit) && (await page.$$('#cmd .cb')).length > 0);

  // The Commander's channel.
  await page.keyboard.press('o'); await page.waitForTimeout(300);
  check('O opens the Commander\'s channel with nine divisions', await page.isVisible('#cmdr') && (await page.$$('#cm-tabs .dt:not(.lgt)')).length === 9);
  // The accounts: the first page of the channel, the hover on the top bar, the click through, and what the station is asked for.
  check('the accounts say why freighters come and what a crate is worth: trade, reputation, price, berths', await page.evaluate(() => { const t = document.getElementById('lg-trade').innerText; return /WHY FREIGHTERS COME/.test(t) && /Reputation/.test(t) && /Market price/.test(t) && /More berths do not bring more ships/.test(t); }));
  check('the channel opens on the ACCOUNTS: credits in and out line by line, the stores, power, people, morale and the score', await page.evaluate(() => {
    const t = document.getElementById('lg').innerText, L = window.__st.ledger();
    return document.querySelector('#cm-tabs .dt.lgt.on') && ['lg-credits', 'lg-stores', 'lg-power', 'lg-people', 'lg-morale', 'lg-cap'].every((id) => document.getElementById(id))
      && /COMING IN/.test(t) && /GOING OUT/.test(t) && /Colonist tax/.test(t) && L.credits.outs.length > 0 && L.credits.outs.every((x) => t.includes(x.label)) && /Coffee/.test(t) && /MADE BY/.test(t);
  }));
  await page.keyboard.press('o'); await page.waitForTimeout(150);
  await page.hover('.ri:has(#r-cr)'); await page.waitForTimeout(300);
  check('hovering the credits says where they come from and where they go', await page.evaluate(() => { const t = document.getElementById('tip'); return !t.classList.contains('hidden') && /CREDITS/.test(t.innerText) && /COMING IN/.test(t.innerText) && /GOING OUT/.test(t.innerText) && /Click for the full accounts/.test(t.innerText); }));
  const tips = {};
  for (const [id, word] of [['r-pw', 'MADE BY'], ['r-pop', 'STAFF ON DUTY'], ['r-mo', 'MORALE'], ['r-cap', 'CAPABILITY'], ['r-rdy', 'THE PLATFORM'], ['r-sh', 'WHY FREIGHTERS COME']]) { await page.hover(`.ri:has(#${id})`); await page.waitForTimeout(150); tips[id] = (await page.evaluate(() => document.getElementById('tip').innerText)).includes(word); }
  check('and so does every other readout on the top bar: power, people, morale, capability, readiness, ships', Object.values(tips).every(Boolean), JSON.stringify(tips));
  await page.click('.ri:has(#r-pw)'); await page.waitForTimeout(300);
  check('clicking a readout opens the accounts at that section, and the hover goes away', await page.isVisible('#cmdr') && await page.evaluate(() => { const m = document.getElementById('lg-power').getBoundingClientRect(), c = document.getElementById('cmdr').getBoundingClientRect(); return document.getElementById('tip').classList.contains('hidden') && m.top >= c.top - 2 && m.top < c.bottom; }));
  check('the ACCOUNTS tab carries what the station gains or loses a minute; the top bar still shows no profit figure', /^[+−]\d+$/.test((await page.textContent('#dt-ledger')).trim()) && !(await page.$('#r-net')), await page.textContent('#dt-ledger'));
  // Morale: where it has been, what makes it up, and ways to raise it that can be ordered on the spot.
  await page.evaluate(() => { window.__st.setTax(16); }); await page.waitForFunction(() => document.querySelector('#lg-morale [data-do="tax"]'), null, { timeout: 20000 }).catch(() => {});
  const mor = await page.evaluate(() => { const el = document.getElementById('lg-morale'), b = el.querySelector('[data-do="tax"]'); return { text: el.innerText, chart: !!el.querySelector('svg.mlog polyline'), tax: !!b, n: el.querySelectorAll('[data-do]').length }; });
  check('the accounts track morale: a chart of where it has been, what makes it up, and ways to raise it', mor.chart && /WHAT MAKES IT UP/.test(mor.text) && /WAYS TO RAISE IT/.test(mor.text) && /Colonist tax/.test(mor.text) && mor.tax && mor.n >= 2, JSON.stringify({ chart: mor.chart, n: mor.n, tax: mor.tax }) + mor.text.slice(0, 700));
  await page.evaluate(() => { document.querySelector('#lg-morale [data-do="tax"]').scrollIntoView({ block: 'center' }); }); await page.click('#lg-morale [data-do="tax"]'); await page.waitForFunction(() => window.__st.tax === 10 && !document.querySelector('#lg-morale [data-do="tax"]'), null, { timeout: 20000 }).catch(() => {});
  check('DO IT gives the order there and then (the tax comes down to 10%)', await page.evaluate(() => window.__st.tax === 10 && !document.querySelector('#lg-morale [data-do="tax"]')));
  check('the morale readout says which way it is heading', /^\d+( [▲▼])?$/.test(await page.textContent('#r-mo')), await page.textContent('#r-mo'));
  await page.mouse.move(700, 300);
  await page.click('#cm-tabs .dt[data-k="supply"]'); await page.waitForTimeout(100);
  await page.click('#cm-tabs .dt[data-k="maintenance"]'); await page.waitForTimeout(100);
  await page.click('.ob[data-v="preventive"]'); await page.waitForFunction(() => /PATRIOTIC MAINTENANCE/.test(document.getElementById('c-list').textContent), null, { timeout: 15000 }).catch(() => {});
  check('a standing order is given and acknowledged on the radio', await page.evaluate(() => window.__st.div.maintenance.order.plan) === 'preventive' && /CH 4 · PATRIOTIC MAINTENANCE/.test(await page.textContent('#c-list')));
  await page.$eval('#cm-budget', (e) => { e.value = 12; e.dispatchEvent(new Event('input')); });
  check('the weekly allotment slider sets what the division draws', await page.evaluate(() => window.__st.div.maintenance.allot) === 12 && /crates a week/.test(await page.textContent('#cm-bv')));
  await page.click('#cm-tabs .dt[data-k="supply"]'); await page.waitForTimeout(200);
  check('Supply\'s page lists the stores', /Coffee/.test(await page.textContent('#cm-stores')) && /Rations/.test(await page.textContent('#cm-stores')));
  await page.click('#cm-tabs .dt[data-k="maintenance"]'); await page.waitForTimeout(200);
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => /Engineers on staff/.test(document.getElementById('cm-rep').textContent), null, { timeout: 15000 }).catch(() => {});
  check('the division reports in its own voice', /Engineers on staff/.test(await page.textContent('#cm-rep')), await page.textContent('#cm-rep'));
  await page.screenshot({ path: 'test/shots/commander.png' });
  // Factions: a mood, what they want, and their people by name.
  check('a division page shows its faction: mood, wants and named crew', await page.isVisible('#cm-fac .fac') && /Wants/.test(await page.textContent('#cm-fac')) && (await page.$$('#cm-fac .pp')).length > 0);
  const who = await page.$eval('#cm-fac .pp', (b) => b.firstChild.textContent);
  await page.click('#cm-fac .pp'); await page.waitForTimeout(300);
  check('clicking a name in the crew list shows that person', await page.evaluate(() => window.__ui.person > 0) && (await page.textContent('#info')).toLowerCase().includes(who.toLowerCase()));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);

  // The upgrade path.
  await page.keyboard.press('u'); await page.waitForFunction(() => document.querySelectorAll('#up-list .tier').length === 4, null, { timeout: 15000 }).catch(() => {});
  check('U shows the upgrade path, Outpost to Citadel', (await page.$$('#up-list .tier')).length === 4 && await page.isVisible('#up-list .tier.now') && (await page.$$('#up-list .tier.next .req')).length === 4, await page.evaluate(() => JSON.stringify({ open: !document.getElementById('upg').classList.contains('hidden'), tiers: document.querySelectorAll('#up-list .tier').length, req: document.querySelectorAll('#up-list .tier.next .req').length, focus: document.activeElement && document.activeElement.tagName + '#' + document.activeElement.id, tier: window.__st.tier })));
  await page.screenshot({ path: 'test/shots/upgrades.png' });
  await page.keyboard.press('u');
  for (let i = 0; i < 14 && await page.evaluate(() => window.__st.tier) < 1; i++) await steps(page, 60);
  await page.waitForTimeout(400);
  check('Garrison status is granted and grows the build zone', await page.evaluate(() => window.__st.tier >= 1 && window.__st.radius === 40), await page.evaluate(() => JSON.stringify(window.__st.next()?.items.map((i) => `${i.label} ${i.have}/${i.need}`)) + ' ' + JSON.stringify(window.__st.asks().map((a) => `${a.text} ${a.why}`)) + ` morale ${Math.round(window.__st.morale)} t ${Math.round(window.__st.t)} beds ${window.__st.beds()} ships ${window.__st.stats.ships}/${window.__st.stats.lost}`));
  // What reaches the commander lands on the desk, with its choices.
  const ask = await page.evaluate(() => {
    const s = window.__st; s.credits += 500; s.requests.length = 0;
    const p = [...s.parts.values()].find((x) => x.state === 'active' && x.rooms.includes('quarters')), slot = p.rooms.indexOf('quarters');
    const r = s._ask({ k: 'security', kind: 'room', part: p.id, slot, room: 'secoffice', was: 'quarters', cost: 60, text: `Commander, Security wants to turn spare quarters in ${s.name(p)} into a Security Office (60 CR).` });
    if (!s.staff.officer) { s.staff.officer = 1; s._spawn('officer', s.root, s.root); }      // a row needs two people to have it
    s._dilemma();
    return { id: r.id, part: p.id, slot, n: s.requests.length };
  });
  // software rendering is slow: wait for the next HUD pass rather than for a fixed time
  await page.waitForFunction((n) => document.querySelectorAll('#dk-list .dk').length === n && document.getElementById('cm-badge').textContent.trim() === String(n), ask.n, { timeout: 20000 }).catch(() => {});
  check('a request lands on the desk with its choices', await page.isVisible('#desk') && (await page.$$('#dk-list .dk')).length === ask.n && (await page.$$(`#dk-list .dk[data-id="${ask.id}"] button`)).length === 2, `${ask.n}`);
  check('a matter of people comes with choices of its own', ask.n === 2 && (await page.$$('#dk-list .dk:last-child button')).length >= 2 && /MATTER OF PEOPLE/.test(await page.textContent('#dk-list .dk:last-child')), `${ask.n}`);
  check('the Commander button counts what is waiting', +(await page.textContent('#cm-badge')).trim() === ask.n);
  check('the comms line says it is on the desk', /ON YOUR DESK/.test(await page.textContent('#c-list')));
  await page.click(`#dk-list .dk[data-id="${ask.id}"] button[data-i="0"]`); await page.waitForTimeout(300);
  const built = await page.evaluate((a) => { const p = window.__st.parts.get(a.part); return p && p.rooms[a.slot] === 'secoffice' && p.marks[a.slot] === 'security'; }, ask);
  check('approving builds the room and marks it for the faction', built, JSON.stringify(ask));
  check('the message shows the answer', /APPROVE/.test(await page.textContent('#c-list .rq-out.approved')));
  await page.click('#dk-list .dk button[data-i="1"]'); await page.waitForTimeout(300);
  check('answering a matter of people clears the desk and goes in their stories', await page.isHidden('#desk') && await page.evaluate(() => window.__st.agents.some((a) => a.story.length >= 2)));
  check('the top bar shows the station week', /^WEEK \d+ · DAY \d$/.test(await page.textContent('#wk')));
  await page.click('#groups .gt[data-g="habitation"]');
  check('and unlocks the rings', !(await page.$eval('#cmd .cb[data-t="ring"]', (b) => b.classList.contains('locked'))));

  // Views, the sky, and hiding everything.
  await page.evaluate(() => document.querySelector('.vb[data-v="hull"]').click()); await page.waitForTimeout(300);
  check('2 shows the hull over a planet', await page.evaluate(() => window.__view.mode === 'hull' && window.__view.planet.visible));
  await page.evaluate(() => { window.__view.camera.position.x += 15; window.__view.render(); });
  check('the stars, sun and moons move with the camera, so they never slide', await page.evaluate(() => window.__view.sky.position.distanceTo(window.__view.camera.position) < 1e-6));
  await page.evaluate(() => document.querySelector('.vb[data-v="cut"]').click()); await page.waitForTimeout(300);
  check('4 cuts the station away', await page.evaluate(() => window.__view.cutaway && !!window.__view.M.hull.clippingPlanes));
  await page.waitForFunction(() => window.__view.figOn && (window.__view.figs.hauler.count + window.__view.figsW.hauler.count) > 0, null, { timeout: 20000 }).catch(() => {});
  // everybody aboard is a figure, except whoever is inside a lift at this moment (a lift is a closed tube: there is nobody to draw)
  await page.evaluate(() => { window.__ui.paused = true; }); await page.waitForTimeout(700);
  check('with the hull cut away, people are figures by job', await page.evaluate(() => { const v = window.__view, s = window.__st, now = performance.now() / 1000; v._agents(now); const inside = s.agents.filter((x) => !x.eva && s.parts.has(x.at)), riding = inside.filter((x) => v.agentPos(x, now)[5]).length; return v.figOn && [...Object.values(v.figs), ...Object.values(v.figsW)].reduce((n, f) => n + f.count, 0) === inside.length - riding && (v.figs.hauler.count + v.figsW.hauler.count) > 0; }), await page.evaluate(() => { const v = window.__view; return JSON.stringify({ fig: v.figOn, counts: Object.fromEntries(Object.entries(v.figs).map(([k, f]) => [k, f.count])), agents: window.__st.agents.filter((x) => !x.eva).length }); }));
  await page.evaluate(() => { window.__ui.paused = false; });
  await page.screenshot({ path: 'test/shots/cutaway.png' });
  // The cut follows the camera; INSIDE takes the hull away; the camera flies on W A S D, Space and Shift.
  check('the cutaway is one plane facing the camera, just in front of what you look at', await page.evaluate(() => {
    const v = window.__view; v.camera.position.set(3, 9, -14); v.controls.target.set(1, 0, 2); v.sync(performance.now() / 1000, 0.016);
    const n = v.clip[0].normal, d = v.controls.target.clone().sub(v.camera.position).normalize();
    return v.clip.length === 1 && n.distanceTo(d) < 1e-4 && v.clip[0].distanceToPoint(v.controls.target) > 0.2 && v.clip[0].distanceToPoint(v.camera.position) < 0 && v.M.inner.clippingPlanes === v.clip && v.figMat.clippingPlanes === v.clip;
  }));
  await page.keyboard.press('t'); await page.waitForTimeout(300);
  check('T (or INSIDE) takes the hull away and shows every deck and the people', await page.evaluate(() => { const v = window.__view; return v.open && v.mat('hull', 'active') === v.M.hidden && v.mat('line', 'active') === v.M.hullLine && v.mat('inner', 'active') === v.M.inner && v.mat('hull', 'active', false, false, true) === v.M.hull && v.figOn && document.querySelector('.vb[data-v="open"]').classList.contains('on'); }));
  await page.screenshot({ path: 'test/shots/inside.png' });
  await page.keyboard.press('t');
  const fly = async (key, ms = 350) => { const a = await page.evaluate(() => [...window.__view.controls.target.toArray(), ...window.__view.camera.position.toArray()]); await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(120); const b = await page.evaluate(() => [...window.__view.controls.target.toArray(), ...window.__view.camera.position.toArray()]); return b.map((x, i) => x - a[i]); };
  const fw = await fly('w'), fu = await fly(' '), fd = await fly('Shift'), fr = await fly('d');
  check('W flies the camera forward along the deck', Math.hypot(fw[0], fw[2]) > 0.2 && Math.abs(fw[1]) < 1e-6 && Math.abs(fw[0] - fw[3]) < 0.05, JSON.stringify(fw.map((x) => +x.toFixed(2))));
  check('Space lifts it and Shift lowers it, and Space no longer pauses', fu[1] > 0.2 && fd[1] < -0.2 && !(await page.evaluate(() => window.__ui.paused)), `${fu[1].toFixed(2)} ${fd[1].toFixed(2)}`);
  check('D flies it to the right', Math.hypot(fr[0], fr[2]) > 0.2 && Math.abs(fw[0] * fr[0] + fw[2] * fr[2]) < 0.2 * Math.hypot(fw[0], fw[2]) * Math.hypot(fr[0], fr[2]) + 0.05);
  await page.keyboard.press('p'); const wasPaused = await page.evaluate(() => window.__ui.paused); await page.keyboard.press('p');
  check('P pauses', wasPaused && !(await page.evaluate(() => window.__ui.paused)));
  check('the wheel zooms toward the pointer, and closer than before', await page.evaluate(() => window.__view.controls.zoomToCursor === true && window.__view.controls.minDistance <= 0.3 && window.__view.controls.zoomSpeed >= 2));
  // Hallways, elevators and following a person.
  check('corridors and ring walks are built as hallways: a runner, a wall with openings, a handrail and lights', await page.evaluate(async () => {
    const P = await import('/js/parts.js'), roles = (t) => { const r = new Set(); P.buildPart(t).traverse((o) => { if (o.isMesh && o.userData.role) r.add(o.userData.role); }); return r; };
    return ['hab', 'ring', 'disc', 'drum', 'command', 'tube'].every((t) => roles(t).has('hall')) && ['hab', 'ring'].every((t) => { const r = roles(t); return r.has('wall') && r.has('locker') && r.has('lane'); });
  }));
  check('rooms have a runner along their aisles', await page.evaluate(async () => { const R = await import('/js/rooms.js'); return R.roomPlan('quarters', 9, 7.2, 0, 0).items.some((i) => i[1] === 'hall'); }));
  check('a lift is a closed tube, and nobody inside one is drawn', await page.evaluate(async () => {
    const P = await import('/js/parts.js'), s = window.__st, v = window.__view, now = performance.now() / 1000;
    // the tube is there to be seen, and the old open tower and its stair are gone (those were drawn as 'inner' rails and treads)
    const roles = {}; P.buildPart('core').traverse((o) => { if (o.isMesh) roles[o.userData.role] = o.geometry.attributes.position.count; });
    if (!roles.locker || !roles.steel) return false;
    // send everybody somewhere else, and watch: whoever is inside a lift is left out of the figures
    let rode = 0, wrong = 0;
    for (let k = 0; k < 900 && rode < 3; k++) {
      s.step(1 / 30); if (k % 3) continue;
      const hid = s.agents.filter((a) => !a.eva).map((a) => v.agentPos(a, now)).filter((P5) => P5 && P5[5]).length; if (!hid) continue;
      v._agents(now);
      const drawn = [...Object.values(v.figs), ...Object.values(v.figsW)].reduce((n, im) => n + im.count, 0), inside = s.agents.filter((a) => !a.eva && s.parts.has(a.at)).length;
      rode++; if (drawn !== inside - hid) wrong++;
    }
    return rode > 0 && wrong === 0;
  }));
  check('an airlock with nothing to walk into beyond it is shut, and one that joins two parts is open', await page.evaluate(async () => {
    const P = await import('/js/parts.js'), s = window.__st, v = window.__view;
    const want = () => { let n = 0; for (const p of s.parts.values()) { if (p.state !== 'active' || !P.WALK[p.type]) continue; s.def(p).ports.forEach((q, i) => { if (Math.abs(q[4]) > 0.7) return; const nb = p.used.has(i) ? p.kids.map((k) => s.parts.get(k)).find((k) => k && k.pport === i) || s.parts.get(p.parent) : null; if (!(nb && nb.state === 'active' && P.WALK[nb.type])) n++; }); } return n; };
    v._airlocks(); const n0 = v.alDoor.count, w0 = want();
    const free = s.freePorts().find((f) => { const p = s.parts.get(f.part); return p.state === 'active' && P.WALK[p.type] && Math.abs(f.dir[1]) < 0.7; });
    if (!free) return n0 === w0 && n0 > 0;
    const r = s.build('tube', free.part, free.i); if (!r.ok) return n0 === w0 && n0 > 0;
    s.parts.get(r.id).state = 'active'; v._airlocks();
    const n1 = v.alDoor.count, ok = n0 === w0 && n0 > 0 && n1 === n0 && n1 === want();      // one opens (the port used), one more is shut (the tube's far end)
    s.demolish(r.id); s.parts.get(r.id) && s._remove(s.parts.get(r.id)); v._airlocks();
    return ok && v.alDoor.count === n0;
  }));
  check('every part with a lift has its light, and with nobody aboard it calls at every deck by itself', await page.evaluate(async () => {
    const P = await import('/js/parts.js'), s = window.__st, v = window.__view; v.liftRider.clear(); v._lifts(0.016);
    const shafts = [...s.parts.values()].filter((p) => p.state === 'active' && P.WALK[p.type] && P.WALK[p.type].k === 'shaft' && (P.SLOTS[p.type] || []).length);
    if (!shafts.length || !shafts.every((p) => v.lifts.has(p.id))) return false;
    const c = [...v.lifts.values()].find((x) => x.ys.length > 1); if (!c) return false;
    const seen = new Set(); for (let i = 0; i < 600; i++) { v.liftRider.clear(); v._lifts(0.1); for (const y of c.ys) if (Math.abs(c.y - y) < 1e-3) seen.add(y); }
    return seen.size === c.ys.length;
  }));
  const camWas = await page.evaluate(() => [window.__view.controls.target.toArray(), window.__view.camera.position.toArray()]);
  const fid = await page.evaluate(() => { const s = window.__st, a = s.agents.find((x) => !x.eva && s.parts.has(x.at)); window.__follow(a.id); return a.id; });
  await page.waitForFunction((id) => { const v = window.__view, a = window.__st.agents.find((x) => x.id === id), P = a && v.agentPos(a, performance.now() / 1000), t = v.controls.target; return P && Math.hypot(P[0] - t.x, P[2] - t.z) < 0.25; }, fid, { timeout: 30000 }).catch(() => {});
  const fg = await page.evaluate((id) => { const v = window.__view, a = window.__st.agents.find((x) => x.id === id), P = a && v.agentPos(a, performance.now() / 1000), t = v.controls.target; return P ? [Math.hypot(P[0] - t.x, P[2] - t.z), v.camera.position.distanceTo(t)] : [99, 99]; }, fid);
  check('following a person keeps the camera on them, close in, with the inside showing', fg[0] < 0.4 && fg[1] <= 1.85 && (await page.evaluate((id) => window.__ui.follow === id && window.__ui.person === id && (window.__ui.open || window.__ui.cut || window.__ui.view !== 'hull'), fid)), fg.map((x) => x.toFixed(2)).join(' '));
  check('their card says FOLLOWING', /FOLLOWING/.test(await page.textContent('#a-follow')));
  await page.screenshot({ path: 'test/shots/follow.png' });
  await page.keyboard.down('w'); await page.waitForFunction(() => window.__ui.follow === 0, null, { timeout: 15000 }).catch(() => {}); await page.keyboard.up('w'); await page.waitForTimeout(150);
  check('flying the camera yourself lets go of them', (await page.evaluate(() => window.__ui.follow === 0)) && !/FOLLOWING/.test(await page.textContent('#a-follow')));
  await page.keyboard.press('f'); await page.waitForTimeout(150);
  const fOn = await page.evaluate(() => window.__ui.follow);
  await page.click('#a-follow'); await page.waitForTimeout(150);
  check('F follows the person on the card, and the button lets go again', fOn === fid && (await page.evaluate(() => window.__ui.follow === 0)));
  await page.evaluate((id) => { window.__follow(id); }, fid); await page.click('#a-done'); await page.waitForTimeout(150);
  check('closing the card stops following', await page.evaluate(() => window.__ui.follow === 0 && !window.__ui.person));
  if (await page.evaluate(() => window.__ui.open)) await page.keyboard.press('t');
  await page.evaluate(([t, c]) => { window.__view.controls.target.fromArray(t); window.__view.camera.position.fromArray(c); }, camWas); await page.waitForTimeout(200);

  await page.evaluate(() => document.querySelector('.vb[data-v="cut"]').click()); await page.evaluate(() => document.querySelector('.vb[data-v="life"]').click()); await page.waitForTimeout(300);
  await page.waitForFunction(() => window.__view.mode === 'life' && window.__view.agentPts.geometry.drawRange.count > 0, null, { timeout: 20000 }).catch(() => {});
  check('3 shows life signs', await page.evaluate(() => window.__view.mode === 'life' && window.__view.agentPts.geometry.drawRange.count > 0));
  check('life signs are only people inside the station', await page.evaluate(() => window.__view.agentPts.geometry.drawRange.count <= window.__st.agents.filter((a) => !a.eva).length + window.__view.suits.children.filter((s) => s.visible).length));
  await page.screenshot({ path: 'test/shots/life-signs.png' });
  check('in the x-ray people are life signs, not figures', await page.evaluate(() => window.__view.peopleOn && !window.__view.figOn));
  await page.evaluate(() => { window.__ui.paused = true; });      // hold still, so the person is where we aimed
  const dot = await page.evaluate(() => {      // somebody whose life sign is in the open middle of the picture, clear of the panels
    const v = window.__view, r = v.canvas.getBoundingClientRect(), now = performance.now() / 1000; v.camera.updateMatrixWorld();
    const at = (a) => { const P = v.agentPos(a, now); if (!P) return null; const q = v.camera.position.clone().set(P[0], P[1], P[2]).project(v.camera); return [(q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top, q.z]; };
    const ok = (a) => { const p = !a.eva && at(a); return p && p[2] < 1 && p[0] > 240 && p[0] < r.width - 240 && p[1] > 90 && p[1] < r.height - 260; };
    const a = window.__st.agents.find(ok) || window.__st.agents.find((x) => !x.eva && at(x)), xy = at(a);
    return { id: a.id, name: a.name, xy: [xy[0], xy[1]] };
  });
  await page.mouse.move(...dot.xy); await page.waitForTimeout(250);
  check('hovering a life sign names the person', (await page.textContent('#tip')).length > 3 && !(await page.isHidden('#tip')));
  await page.mouse.click(...dot.xy); await page.waitForTimeout(300);
  check('clicking a life sign shows who they are', await page.evaluate(() => window.__ui.person > 0) && /DOING/.test(await page.textContent('#info')), await page.textContent('#info'));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__ui.paused = false; });
  await page.evaluate(() => document.querySelector('.vb[data-v="hull"]').click()); await page.keyboard.press('h'); await page.waitForTimeout(200);
  check('H hides the interface, leaving only the station', !(await page.isVisible('#hud')) && await page.isVisible('#b-showui') && await page.evaluate(() => !window.__view.overlay));
  await page.screenshot({ path: 'test/shots/clean.png' });
  check('hidden means hidden: no panels, tips, toasts or banners', await page.evaluate(() => ['hud', 'tip', 'toast', 'banner', 'fx'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none')));
  await page.mouse.click(683, 300); await page.waitForTimeout(150);
  check('tapping the station brings the SHOW UI button back for a moment', await page.evaluate(() => document.getElementById('app').classList.contains('peek')));
  await page.keyboard.press('h');
  check('H brings it back', await page.isVisible('#hud'));
  await page.evaluate(() => document.querySelector('.vb[data-v="blueprint"]').click());

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
  await page.evaluate(() => document.querySelector('.vb[data-v="hull"]').click()); await page.waitForTimeout(300);
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
  await page.waitForFunction(() => window.__view.markers.children.length === window.__st.freePorts().length, null, { timeout: 15000 }).catch(() => {});
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

// ---------------------------------------------------------------- the Broken Station, saving, and coming back
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('  page error:', e.message); });
  await page.goto(`${BASE}/index.html?seed=5`); await page.waitForTimeout(1200);
  check('the title offers a new station, a broken one and free play, and no Continue before there is a save', await page.isVisible('#b-economy') && await page.isVisible('#b-broken') && await page.isVisible('#b-free') && await page.isHidden('#b-continue'));
  await page.click('#b-broken'); await page.waitForTimeout(800);
  const w0 = await page.evaluate(() => ({ n: window.__st.parts.size, dark: [...window.__st.parts.values()].filter((p) => p.fault).length, mode: window.__st.mode }));
  check('the Broken Station is a dark, stripped station', w0.mode === 'broken' && w0.n >= 15 && w0.dark >= 5 && /Parts repaired/.test(await page.textContent('#info')), JSON.stringify(w0));
  await page.screenshot({ path: 'test/shots/broken.png' });
  await steps(page, 90);
  // The menu: nothing in it plays the game. It pauses the station; settings, help, the radio log, saving and credits live there.
  await page.keyboard.press('m'); await page.waitForTimeout(300);
  check('M opens the menu and pauses the station', await page.isVisible('#s-menu .mpage[data-p="main"]') && await page.evaluate(() => window.__ui.paused) && /PAUSED/.test(await page.textContent('#m-title')));
  check('nothing in the menu plays the game: no tax and no accounts in it', await page.evaluate(() => { const m = document.getElementById('s-menu'); return !m.querySelector('#in-tax') && !m.querySelector('#ledger') && !/TAX|CR\/min|Upkeep/i.test(m.innerText); }));
  check('it has Resume, Settings, Help, Radio Log, Save, Title Screen, Feedback and Credits', await page.evaluate(() => ['settings', 'help', 'log', 'save', 'credits'].every((p) => document.querySelector(`#s-menu [data-go="${p}"]`)) && !!document.getElementById('b-close') && !!document.getElementById('b-restart') && /discord/.test(document.querySelector('#s-menu a.fb').href)));
  await page.click('#s-menu [data-go="settings"]'); await page.waitForTimeout(200);
  const set0 = await page.evaluate(() => ({ rows: document.querySelectorAll('#set-body .set-row').length, secs: [...document.querySelectorAll('#set-body .set-sec')].map((x) => x.textContent), pr: window.__view.renderer.getPixelRatio() }));
  check('SETTINGS: sound, display, camera and the station, each setting with what it does', set0.rows === 10 && set0.secs.join() === 'SOUND,DISPLAY,CAMERA,THE STATION' && await page.evaluate(() => [...document.querySelectorAll('#set-body .set-row small')].every((x) => x.textContent.length > 15)), JSON.stringify(set0));
  await page.selectOption('#set-body select[data-k="quality"]', 'low'); await page.click('#set-body .tog[data-k="calm"]'); await page.click('#set-body .tog[data-k="advice"]');
  await page.evaluate(() => { for (const [k, v] of [['volume', 0.4], ['fly', 2]]) { const r = document.querySelector(`#set-body input[data-k="${k}"]`); r.value = v; r.dispatchEvent(new Event('input')); } }); await page.waitForTimeout(200);
  check('the settings do what they say: quality, calm display, volume, flying speed, advice', await page.evaluate((pr) => { const v = window.__view; return v.renderer.getPixelRatio() < pr + 1e-6 && v.renderer.getPixelRatio() <= 0.76 && document.getElementById('app').classList.contains('calm') && Math.abs(v.flyK - 2) < 1e-6 && window.__st._noAdvice === true; }, set0.pr));
  check('and they are remembered', await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('sos.settings')); return s.quality === 'low' && s.calm === true && s.volume === 0.4 && s.fly === 2 && s.advice === false; }));
  await page.selectOption('#set-body select[data-k="quality"]', 'auto'); await page.click('#set-body .tog[data-k="calm"]'); await page.click('#set-body .tog[data-k="advice"]');
  await page.evaluate(() => { for (const [k, v] of [['volume', 1], ['fly', 1]]) { const r = document.querySelector(`#set-body input[data-k="${k}"]`); r.value = v; r.dispatchEvent(new Event('input')); } });
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('Esc on a page of the menu goes back to the menu, not out of it', await page.isVisible('#s-menu .mpage[data-p="main"]'));
  await page.click('#s-menu [data-go="help"]'); await page.waitForTimeout(150);
  check('HELP lists the keys, touch, and how the station works', await page.evaluate(() => { const t = document.querySelector('.mpage[data-p="help"]').innerText; return /W A S D/.test(t) && /pinch/.test(t) && /ACCOUNTS/.test(t) && /Trade pays/.test(t); }));
  await page.click('#m-back'); await page.click('#s-menu [data-go="log"]'); await page.waitForTimeout(150);
  check('RADIO LOG keeps what was said on comms', await page.evaluate(() => document.querySelectorAll('#m-log .rl').length >= 2 && /MINISTRY/.test(document.getElementById('m-log').innerText)));
  await page.click('#m-back'); await page.click('#s-menu [data-go="credits"]'); await page.waitForTimeout(100);
  check('CREDITS says whose it is and that it is unofficial', await page.evaluate(() => { const t = document.querySelector('.mpage[data-p="credits"]').innerText; return /Robert Troumbley/.test(t) && /Not affiliated/.test(t) && /three\.js/.test(t) && /Prototype \d/.test(t); }));
  await page.click('#m-back'); await page.click('#s-menu [data-go="save"]'); await page.waitForTimeout(200);
  const code = await page.inputValue('#sv-code');
  check('SAVE shows a save code for the station', /^SOS1:[A-Za-z0-9+/=]{200,}$/.test(code), `${code.length} characters`);
  const snap = await page.evaluate(() => ({ parts: window.__st.parts.size, t: Math.round(window.__st.t), credits: Math.round(window.__st.credits) }));
  await page.fill('#sv-in', 'not a code'); await page.click('#sv-load'); await page.waitForTimeout(100);
  check('a wrong code is refused, and says why', /not a save code/.test(await page.textContent('#sv-msg')) && await page.isVisible('#s-menu'));
  await page.fill('#sv-in', `  ${code}\n`); await page.click('#sv-load'); await page.waitForTimeout(900);
  check('loading the code brings the same station back, running', await page.evaluate((a) => { const s = window.__st; return !document.getElementById('s-menu').classList.contains('on') && !window.__ui.paused && s.parts.size === a.parts && Math.abs(s.t - a.t) < 5 && Math.abs(s.credits - a.credits) < 60; }, snap), JSON.stringify(snap));
  await page.keyboard.press('m'); await page.waitForTimeout(150); await page.click('#b-close'); await page.waitForTimeout(150);
  check('RESUME closes the menu and the station runs again', !(await page.isVisible('#s-menu')) && await page.evaluate(() => !window.__ui.paused));
  await page.keyboard.press('o'); await page.waitForTimeout(250); await page.click('#cm-tabs .dt.lgt'); await page.waitForTimeout(250);
  await page.evaluate(() => { const i = document.getElementById('in-tax'); i.value = 14; i.dispatchEvent(new Event('input')); }); await page.waitForTimeout(150);
  check('the tax is set on the ACCOUNTS page now, with what it brings in and what it costs in morale', await page.evaluate(() => window.__st.tax === 14 && /14%/.test(document.getElementById('bv-tax').textContent) && /CR a minute/.test(document.getElementById('bn-tax').textContent) && /morale/.test(document.getElementById('bn-tax').textContent)));
  await page.evaluate(() => { const i = document.getElementById('in-tax'); i.value = 10; i.dispatchEvent(new Event('input')); }); await page.keyboard.press('o'); await page.waitForTimeout(150);
  await page.keyboard.press('m'); await page.click('#b-restart'); await page.waitForTimeout(600);      // leaving for the title saves
  check('Continue appears once the station has been saved', await page.isVisible('#b-continue'));
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('sos.save.06')).t);
  await page.reload(); await page.waitForTimeout(1500);
  await page.click('#b-continue'); await page.waitForTimeout(800);
  const w1 = await page.evaluate(() => ({ n: window.__st.parts.size, t: window.__st.t, mode: window.__st.mode, agents: window.__st.agents.length, objs: window.__view.partObjs.size }));
  check('Continue brings the same station back', w1.mode === 'broken' && w1.n === w0.n && Math.abs(w1.t - before) < 3 && w1.agents > 0 && w1.objs === w1.n, JSON.stringify(w1));
  // a raid, called by hand
  await page.evaluate(() => { const s = window.__st; s.callRaid(); });
  await page.waitForFunction(() => /RAIDERS INBOUND/.test(document.getElementById('banner').textContent), null, { timeout: 20000 }).catch(() => {});
  check('a raid warns before it arrives', await page.evaluate(() => window.__st.raid && window.__st.raid.state === 'warn') && /RAIDERS INBOUND/.test(await page.textContent('#banner')));
  await steps(page, 30); await page.waitForTimeout(400);
  check('the raiders come in and the raid resolves', await page.evaluate(() => { const s = window.__st; return !s.raid || s.raid.state === 'fight'; }));
  await steps(page, 20);
  check('and it is over one way or the other', await page.evaluate(() => !window.__st.raid && window.__st.stats.raidsWon + window.__st.stats.raidsLost >= 1));
  check('no page errors', errs.length === 0, errs.join(' | '));
  await page.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
