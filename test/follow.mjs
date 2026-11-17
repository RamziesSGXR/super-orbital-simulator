// Screenshots of following a person, and of the lift in Station Command. Usage: node test/follow.mjs <baseUrl>
import { chromium } from 'playwright';
const [,, base] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/index.html?free&seed=5`); await page.waitForTimeout(2500);
await page.evaluate("import('/test/demo.js').then(()=>{window.__ids=window.__demo();})"); await page.waitForTimeout(4000);
await page.evaluate("document.getElementById('sp-x').click(); document.getElementById('c-x').click(); 1");
// follow somebody who is walking
const who = await page.evaluate(() => { const s = __st; const a = s.agents.filter((x) => x.path.length > 1 && !x.eva).sort((x, y) => y.path.length - x.path.length)[0] || s.agents[0]; __follow(a.id); __view.closeIn(1.3); return [a.id, a.name, a.role, a.path.length]; });
console.log('following', who.join(' '));
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(2200);
  const d = await page.evaluate((id) => { const v = __view, a = __st.agents.find((x) => x.id === id); if (!a) return 'gone'; const P = v.agentPos(a, performance.now() / 1000), t = v.controls.target; return [Math.hypot(P[0] - t.x, P[1] + 0.1 * v.peopleK - t.y, P[2] - t.z).toFixed(3), __ui.follow, __ui.open, v.camera.position.distanceTo(t).toFixed(2), 'in lift:' + P[5], __st.parts.get(a.at).type, a.path.length].join(' '); }, who[0]);
  console.log('gap follow open dist:', d);
  await page.screenshot({ path: `test/shots/follow${i}.png`, timeout: 120000 });
}
// the elevator in Station Command
await page.evaluate(() => { __follow(0); const v = __view, p = __st.parts.get(1).pos, c = v.lifts.get(1); v.controls.target.set(p[0], c.y + 0.12, p[2]); v.camera.position.set(p[0] + 0.9, c.y + 0.7, p[2] + 1.1); });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/shots/cab.png', timeout: 120000 });
console.log(await page.evaluate(() => JSON.stringify([...__view.lifts].map(([id, c]) => [id, __st.parts.get(id).type, c.ys.length, +c.y.toFixed(2)]))));
console.log(errs.slice(0, 6).join('\n') || 'no page errors');
await b.close();
