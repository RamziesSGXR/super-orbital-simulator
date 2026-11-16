// Does the person card, with its FOLLOW button, fit? Usage: node test/card.mjs <baseUrl>
import { chromium } from 'playwright';
const [,, base] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h, touch] of [[1366, 768, false], [1024, 768, false], [844, 390, true], [390, 844, true]]) {
  const page = await b.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  await page.goto(`${base}/index.html?free&seed=5`); await page.waitForTimeout(2500);
  await page.evaluate("import('/test/demo.js').then(()=>{window.__ids=window.__demo();})"); await page.waitForTimeout(3000);
  await page.evaluate(() => { for (const id of ['sp-x', 'c-x']) { const e = document.getElementById(id); if (e) e.click(); } const a = __st.agents[0]; __follow(a.id); });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const f = document.getElementById('a-follow'), d = document.getElementById('a-done'); if (!f || !d) return 'no card'; const q = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }; const A = q(f), B = q(d); const vis = (R) => R[0] >= 0 && R[2] <= innerWidth && R[1] >= 0 && R[3] <= innerHeight; const top = (e) => { const r = e.getBoundingClientRect(), t = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return t === e || e.contains(t); }; return JSON.stringify({ follow: A, done: B, onScreen: vis(A) && vis(B), clickable: top(f) && top(d), apart: A[2] <= B[0] || A[3] <= B[1], text: f.textContent }); });
  console.log(`${w}x${h}`, r);
  await page.screenshot({ path: `test/shots/card-${w}x${h}.png`, timeout: 120000 });
  await page.close();
}
await b.close();
