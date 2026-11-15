import { chromium } from 'playwright';
const [,, url, out, ...acts] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs=[]; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.goto(url); await page.waitForTimeout(2500);
for (const a of acts) { await page.evaluate(a); await page.waitForTimeout(1500); }
await page.screenshot({ path: out, timeout: 120000 });
console.log(errs.slice(0,8).join('\n') || 'no errors');
await b.close();
