// Pictures of the accounts: the hover on the top bar, the Commander's ACCOUNTS page and the overview's ask, in a story game that
// has been overbuilt on purpose so that it is losing credits. Usage: node test/accounts.mjs <baseUrl> [WxH]
import { chromium } from 'playwright';
const [,, base, size = '1366x768'] = process.argv, [w, h] = size.split('x').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: w, height: h } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/index.html?economy&seed=4`); await page.waitForTimeout(2500);
console.log(await page.evaluate(() => {
  const s = window.__st, out = [];
  const bld = (t, hst, p) => { const x = s.build(t, hst, p); if (!x.ok) out.push(`no ${t}: ${x.why}`); return x.id; };
  const h1 = bld('hab', 1, 2), c = bld('cargo', 1, 3); bld('dockport', 1, 4); bld('hab', 1, 5); bld('solar', h1, 1); bld('core', 1, 1); bld('gunmount', 1, 0);
  for (let i = 0; i < 30 * 60 * 5; i++) s.step(1 / 30);
  out.push(`credits ${Math.round(s.credits)} net ${s.ledger().credits.net.toFixed(1)} residents ${s.residents()} asks ${s.asks().length}`);
  return out.join('\n');
}));
await page.waitForTimeout(1500);
await page.evaluate(() => { for (const id of ['c-x']) { const e = document.getElementById(id); if (e) e.click(); } });
await page.screenshot({ path: `test/shots/acc-overview-${size}.png`, timeout: 120000 });
for (const id of ['r-cr', 'r-pw', 'r-pop', 'r-mo']) { if (!(await page.isVisible(`.ri:has(#${id})`))) continue;      // a narrow screen hides some readouts: the ACCOUNTS page still has them all
  await page.hover(`.ri:has(#${id})`); await page.waitForTimeout(500); await page.screenshot({ path: `test/shots/acc-hover-${id}-${size}.png`, timeout: 120000 }); }
await page.click('.ri:has(#r-cr)'); await page.waitForTimeout(800);
await page.screenshot({ path: `test/shots/acc-page-${size}.png`, timeout: 120000 });
await page.evaluate(() => { document.getElementById('cm-main').scrollTop = 99999; const s = document.querySelector('.cm-body'); if (s) s.scrollTop = 99999; const c = document.getElementById('cmdr'); c.scrollTop = 99999; }); await page.waitForTimeout(500);
await page.screenshot({ path: `test/shots/acc-page2-${size}.png`, timeout: 120000 });
console.log(await page.evaluate(() => document.getElementById('lg').innerText.slice(0, 1500)));
console.log(errs.join('\n') || 'no page errors');
await b.close();
