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
const markerXY = (page, pred) => page.evaluate((src) => {
  const v = window.__view, f = new Function('p', `return ${src}`);
  const m = v.markers.children.find((x) => f(x.userData.port));
  if (!m) return null;
  const q = m.position.clone().project(v.camera), r = v.canvas.getBoundingClientRect();
  return [(q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top];
}, pred);

// ---------------------------------------------------------------- desktop
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/index.html?seed=1`); await page.waitForTimeout(1500);
  check('the title shows over a demo station', await page.isVisible('#s-title') && await page.evaluate(() => window.__view.partObjs.size) > 10);
  await page.screenshot({ path: 'test/shots/title.png' });
  await page.click('#b-economy'); await page.waitForTimeout(500);
  check('ECONOMY starts with Station Command alone and 2,000 CR', await page.evaluate(() => window.__st.parts.size === 1 && window.__st.credits === 2000));
  const grid = await page.$$eval('#cmd .cb', (b) => b.map((x) => [x.dataset.t, x.classList.contains('locked')]));
  check('the command grid has 15 parts, 5 locked until the Garrison Permit', grid.length === 15 && grid.filter((g) => g[1]).length === 5, grid.filter((g) => g[1]).map((g) => g[0]).join());

  await page.keyboard.press('t'); await page.waitForTimeout(200);
  check('a locked part is refused with a reason', /Garrison Permit/.test(await page.textContent('#msgs')));
  await page.keyboard.press('f'); await page.waitForTimeout(300);
  check('picking a part lights the free ports', await page.evaluate(() => window.__view.markers.children.length) === 6);
  const xy = await markerXY(page, 'p.i === 2');
  await page.mouse.move(...xy); await page.waitForTimeout(200);
  check('hovering a port shows a ghost of the part', await page.evaluate(() => !!window.__view.ghost));
  await page.mouse.click(...xy); await page.waitForTimeout(200);
  check('clicking the port builds the docking port', await page.evaluate(() => [...window.__st.parts.values()].some((p) => p.type === 'dockport')));
  await page.keyboard.press('r');
  check('R turns the part', await page.evaluate(() => window.__ui.rot) === 1);
  await page.keyboard.press('Escape'); await page.keyboard.press('r'); await page.keyboard.press('r'); await page.keyboard.press('r'); await page.keyboard.press('r'); await page.keyboard.press('r'); await page.keyboard.press('r'); await page.keyboard.press('r');

  await page.evaluate(() => {
    const s = window.__st, b = (t, h, k, r = 0) => s.build(t, h, k, r).id;
    b('cargo', 1, 3); b('hab', 1, 4); b('hab', 1, 5);
    const c = b('core', 1, 1); b('reactor', c, 1);
    window.__ui.speed = 4;
  });
  await page.waitForTimeout(15000);
  const mid = await page.evaluate(() => ({ crates: window.__st.stats.crates, res: window.__st.residents(), ships: window.__st.ships.length }));
  check('ships dock and haulers carry crates to cargo', mid.crates > 0, JSON.stringify(mid));
  await page.waitForFunction(() => window.__st.residents() > 0, null, { timeout: 60000 }).catch(() => {});
  check('colonists move in', await page.evaluate(() => window.__st.residents()) > 0);
  await page.waitForFunction(() => window.__st.milestone().done, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(400);
  check('the Garrison Permit is granted and grows the build zone', await page.evaluate(() => window.__st.milestone().done && window.__st.radius === 40));
  check('and unlocks the big parts', await page.$$eval('#cmd .cb.locked', (b) => b.length) === 0);
  await page.evaluate(() => { window.__ui.speed = 1; });

  await page.keyboard.press('2'); await page.waitForTimeout(300);
  check('2 shows the hull', await page.evaluate(() => window.__view.mode) === 'hull');
  await page.keyboard.press('4'); await page.waitForTimeout(300);
  check('4 cuts the station away', await page.evaluate(() => window.__view.cutaway && !!window.__view.M.hull.clippingPlanes));
  await page.screenshot({ path: 'test/shots/cutaway.png' });
  await page.keyboard.press('4'); await page.keyboard.press('3'); await page.waitForTimeout(300);
  check('3 shows life signs', await page.evaluate(() => window.__view.mode === 'life' && window.__view.agentPts.geometry.drawRange.count > 0));
  await page.screenshot({ path: 'test/shots/life-signs.png' });
  await page.keyboard.press('1');

  // Select by clicking, then demolish.
  await page.evaluate(() => window.__view.frame()); await page.waitForTimeout(600);
  const reactorXY = await page.evaluate(() => {
    const v = window.__view, p = [...window.__st.parts.values()].find((x) => x.type === 'reactor'), o = v.partObjs.get(p.id);
    const q = o.position.clone().project(v.camera), r = v.canvas.getBoundingClientRect();
    return [(q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top];
  });
  await page.mouse.click(...reactorXY); await page.waitForTimeout(200);
  check('clicking a part selects it', await page.evaluate(() => window.__st.parts.get(window.__ui.sel)?.type) === 'reactor');
  await page.keyboard.press('x'); await page.waitForTimeout(200);
  check('X demolishes a part with nothing attached', await page.evaluate(() => [...window.__st.parts.values()].find((p) => p.type === 'reactor')?.state) === 'demolish');
  const refused = await page.evaluate(() => window.__st.canDemolish([...window.__st.parts.values()].find((p) => p.type === 'core').id));
  check('a part holding others cannot be demolished', !refused.ok && /attached/.test(refused.why));
  await page.screenshot({ path: 'test/shots/desktop.png' });
  check('no page errors on desktop', errs.length === 0, errs.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- free play: the simulation test tools
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/index.html?seed=4`); await page.waitForTimeout(1200);
  await page.click('#b-free'); await page.waitForTimeout(400);
  check('FREE PLAY opens with the test tools showing', await page.isVisible('#simpanel') && await page.isVisible('#b-sim') && /FREE PLAY/.test(await page.textContent('#tier')));
  await page.click('#t-freighter'); await page.waitForTimeout(200);
  check('+ FREIGHTER with no berth says why', /Docking Port/.test(await page.textContent('#msgs')) && await page.evaluate(() => window.__st.ships.length) === 0);
  await page.evaluate(() => { const s = window.__st, b = (t, h, k) => s.build(t, h, k).id; b('dockport', 1, 2); b('cargo', 1, 3); b('hab', 1, 4); for (let i = 0; i < 20; i++) s.step(0.5); });
  await page.click('#t-traffic'); await page.click('#t-clear'); await page.waitForTimeout(200);
  check('TRAFFIC OFF and CLEAR SHIPS empty the sky', await page.evaluate(() => !window.__st.traffic && window.__st.ships.length === 0));
  await page.evaluate(() => { for (let i = 0; i < 120; i++) window.__st.step(0.5); });
  check('with traffic off, no ships come on their own', await page.evaluate(() => window.__st.ships.length) === 0);
  await page.click('#t-freighter'); await page.waitForTimeout(100);
  check('+ FREIGHTER sends one in', await page.evaluate(() => window.__st.ships.filter((x) => x.kind === 'freighter').length) === 1);
  await page.click('#t-colonists'); await page.waitForTimeout(100);
  check('+ 10 COLONISTS fills the free beds', await page.evaluate(() => window.__st.residents()) === 6);
  for (let i = 0; i < 4; i++) await page.click('#b-speed');
  check('free play runs up to 16×', (await page.textContent('#b-speed')).trim() === '16×');
  await page.waitForTimeout(3000);
  check('the readout shows crates moving', await page.evaluate(() => window.__st.stats.crates) > 0 && /Crates \/ min/.test(await page.textContent('#t-stats')));
  await page.screenshot({ path: 'test/shots/free-play.png' });
  await page.keyboard.press('k'); await page.waitForTimeout(100);
  check('K hides the test tools', !(await page.isVisible('#simpanel')));
  check('no page errors in free play', errs.length === 0, errs.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- phone held sideways
{
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/index.html?free&seed=2`); await page.waitForTimeout(1200);
  check('free play starts with every part and no costs', await page.evaluate(() => window.__st.sandbox && window.__st.unlocked.has('garrison')));
  await page.tap('#cmd .cb[data-t="ring"]'); await page.waitForTimeout(300);
  const xy = await markerXY(page, 'p.i === 0');
  await page.touchscreen.tap(...xy); await page.waitForTimeout(300);
  check('tapping a port builds on a phone', await page.evaluate(() => [...window.__st.parts.values()].some((p) => p.type === 'ring')));
  await page.screenshot({ path: 'test/shots/phone.png' });
  check('no page errors on the phone', errs.length === 0, errs.join(' | '));
  await page.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
