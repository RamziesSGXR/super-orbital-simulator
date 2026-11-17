// Pictures of the menu and its pages. Usage: node test/menu.mjs <baseUrl> [WxH]
import { chromium } from 'playwright';
const [,, base, size = '1366x768'] = process.argv, [w, h] = size.split('x').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: w, height: h }, hasTouch: w < 900, isMobile: w < 900 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/index.html?economy&seed=4`); await page.waitForTimeout(2500);
await page.evaluate(() => { const s = window.__st; s.build('hab', 1, 4); s.build('dockport', 1, 2); s.build('cargo', 1, 3); for (let i = 0; i < 30 * 60 * 4; i++) s.step(1 / 30); });
await page.waitForTimeout(1200);
await page.evaluate(() => document.getElementById('b-menu').click()); await page.waitForTimeout(500);
await page.screenshot({ path: `test/shots/menu-main-${size}.png`, timeout: 120000 });
for (const p of ['settings', 'help', 'log', 'save', 'credits']) {
  await page.evaluate((p) => document.querySelector(`#s-menu [data-go="${p}"]`).click(), p); await page.waitForTimeout(400);
  await page.screenshot({ path: `test/shots/menu-${p}-${size}.png`, timeout: 120000 });
  const fit = await page.evaluate(() => { const c = document.querySelector('.mcard').getBoundingClientRect(), out = []; if (c.left < 0 || c.right > innerWidth + 1 || c.top < 0 || c.bottom > innerHeight + 1) out.push(`card ${Math.round(c.left)},${Math.round(c.top)} to ${Math.round(c.right)},${Math.round(c.bottom)} in ${innerWidth}x${innerHeight}`); for (const e of document.querySelectorAll('.mpage.on *')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > c.right + 1 || r.left < c.left - 1)) { out.push(`${e.tagName}.${e.className} spills sideways`); break; } } return out.join('; ') || 'fits'; });
  console.log(p.padEnd(9), fit);
  await page.evaluate(() => document.getElementById('m-back').click()); await page.waitForTimeout(200);
}
console.log(errs.join('\n') || 'no page errors');
await b.close();
