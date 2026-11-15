// Several close-up screenshots of the demo station in one browser session.
// Usage: node test/shots.mjs <baseUrl> <name>=<js that returns [part, [dx,dy,dz] target offset, [dx,dy,dz] camera offset, edit?]> ...
import { chromium } from 'playwright';
const [,, base, ...shots] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/index.html?free&seed=5`); await page.waitForTimeout(2500);
await page.evaluate("import('/test/demo.js').then(()=>{window.__ids=window.__demo();})"); await page.waitForTimeout(2500);
await page.evaluate("document.getElementById('sp-x').click(); document.getElementById('c-x').click(); 1");
for (const sh of shots) {
  const i = sh.indexOf('='), name = sh.slice(0, i), js = sh.slice(i + 1);
  await page.evaluate(`(() => { const s = __st, v = __view; const [p, t, c, mode] = (${js}); const o = s.parts.get(p.id); if (mode === 'edit') __edit(p.id); else { const dn = document.getElementById('a-done'); if (dn) dn.click(); } const base = addRot(o); function addRot(o) { return o.pos; } v.controls.target.set(base[0] + t[0], base[1] + t[1], base[2] + t[2]); v.camera.position.set(base[0] + c[0], base[1] + c[1], base[2] + c[2]); if (mode === 'cut' && !v.cutaway) document.querySelector('.vb[data-v=cut]').click(); })()`);
  await page.waitForTimeout(2500);
  await page.evaluate(`(() => { const s = __st, v = __view; const [p, t, c] = (${js}); const o = s.parts.get(p.id).pos; v.controls.target.set(o[0] + t[0], o[1] + t[1], o[2] + t[2]); v.camera.position.set(o[0] + c[0], o[1] + c[1], o[2] + c[2]); })()`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `test/shots/${name}.png`, timeout: 120000 });
}
console.log(errs.slice(0, 6).join('\n') || 'no page errors');
await b.close();
