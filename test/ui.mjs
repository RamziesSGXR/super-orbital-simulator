// Browser test: plays the prototype through the real page on a desktop and on a phone held sideways.
// Usage: npm start (in another terminal), then node test/ui.mjs [baseUrl=http://localhost:8080]
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8080';
fs.mkdirSync('test/shots', { recursive: true });
let fails = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) fails++; };

const browser = await chromium.launch();

// ---------------------------------------------------------------- desktop
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/index.html?seed=1`); await page.waitForTimeout(500);
  check('the title screen shows', await page.isVisible('#s-title') && /SUPER ORBITAL SIMULATOR/.test(await page.textContent('h1')));
  await page.click('#btn-begin'); await page.waitForTimeout(300);
  check('BEGIN opens the station', await page.isVisible('#hud') && !(await page.isVisible('#s-title')));
  const pal = await page.$$eval('#palette .pb', (b) => b.map((x) => [x.dataset.t, x.classList.contains('locked')]));
  check('the palette has 9 modules, Canteen and Security locked', pal.length === 9 && pal.filter((p) => p[1]).map((p) => p[0]).join() === 'canteen,security', JSON.stringify(pal));

  // Build a bay by clicking, the way a player does.
  const cellXY = (c, r) => page.evaluate(([c, r]) => { const R = window.__R; return [(R.sx(c + 0.5)) / R.dpr, (R.sy(r + 0.5)) / R.dpr]; }, [c, r]);
  await page.click('#palette .pb[data-t="dock"]');
  let [x, y] = await cellXY(17, 3);
  await page.mouse.click(x, y); await page.waitForTimeout(150);
  check('a bay inside the hull is refused, with the reason', /open space/.test(await page.textContent('#ticker')));
  [x, y] = await cellXY(11, 0);
  await page.mouse.click(x, y); await page.waitForTimeout(150);
  check('a bay on the top deck is built', await page.evaluate(() => [...window.__st.mods.values()].some((m) => m.type === 'dock')));
  [x, y] = await cellXY(3, 2);
  await page.mouse.click(x, y); await page.waitForTimeout(150);
  check('outside the permitted section is refused', /permitted section/.test(await page.textContent('#ticker')));

  // Lay a lift shaft by dragging.
  await page.keyboard.press('2');
  const a = await cellXY(13, 0), b = await cellXY(13, 2);
  await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(b[0], (a[1] + b[1]) / 2, { steps: 4 }); await page.mouse.move(...b, { steps: 4 }); await page.mouse.up();
  check('dragging lays a lift shaft', await page.evaluate(() => [0, 1, 2].every((r) => window.__st.modAt(13, r)?.type === 'lift')));
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    const s = window.__st, B = (t, c, r) => s.build(t, c, r);
    B('corridor', 12, 2); B('reactor', 10, 2); B('cargo', 11, 1); B('quarters', 16, 2); B('quarters', 18, 2); B('engineering', 20, 2);
    window.__ui.speed = 4;
  });
  await page.screenshot({ path: 'test/shots/desktop-start.png' });
  await page.waitForTimeout(12000);
  const mid = await page.evaluate(() => ({ crates: window.__st.stats.crates, res: window.__st.residents(), net: window.__st.netPerMin() }));
  check('ships dock and haulers bring crates to cargo', mid.crates > 0, JSON.stringify(mid));
  check('colonists move in', mid.res > 0);
  await page.waitForFunction(() => window.__st.milestone().done, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(500);
  check('the Garrison Permit is granted', await page.evaluate(() => window.__st.milestone().done && window.__st.permitAll));
  check('and unlocks the Canteen and Security Post', await page.$$eval('#palette .pb.locked', (b) => b.length) === 0);
  await page.keyboard.press('b'); await page.waitForTimeout(200);
  check('B opens the budget', await page.isVisible('#s-budget'));
  await page.fill('#in-tax', '25'); await page.dispatchEvent('#in-tax', 'input');
  check('the tax slider sets the tax', await page.evaluate(() => window.__st.tax) === 25);
  await page.screenshot({ path: 'test/shots/desktop-budget.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.evaluate(() => { window.__ui.speed = 1; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test/shots/desktop-running.png' });
  check('no page errors on desktop', errs.length === 0, errs.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- phone held sideways
{
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/index.html?seed=2&skip`); await page.waitForTimeout(500);
  const cw = await page.evaluate(() => window.__R.cw / window.__R.dpr);
  check('on a phone held sideways the hull is big enough to tap', cw >= 18, `${cw.toFixed(1)} px per frame`);
  await page.tap('#palette .pb[data-t="dock"]');
  const [x, y] = await page.evaluate(() => { const R = window.__R; return [R.sx(11.5) / R.dpr, R.sy(0.5) / R.dpr]; });
  await page.touchscreen.tap(x, y); await page.waitForTimeout(200);
  check('tapping builds', await page.evaluate(() => [...window.__st.mods.values()].some((m) => m.type === 'dock')));
  await page.screenshot({ path: 'test/shots/phone-landscape.png' });
  check('no page errors on the phone', errs.length === 0, errs.join(' | '));
  await page.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
