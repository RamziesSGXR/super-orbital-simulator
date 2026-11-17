// Pictures of a Propaganda Screen: each programme from the front, the back, and a long line of the commander's own; and the
// docking lamps on a berth, close up. Usage: node test/screens.mjs <baseUrl>
import { chromium } from 'playwright';
const [,, base] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/index.html?free&seed=5`); await page.waitForTimeout(2500);
await page.evaluate(() => { const s = window.__st; window.__bb = s.build('billboard', 1, 2).id; window.__dp = s.build('dockport', 1, 4).id; for (let i = 0; i < 30 * 20; i++) s.step(1 / 30); s.addColonists(8); for (const id of ['sp-x', 'c-x']) { const e = document.getElementById(id); if (e) e.click(); } window.__view.controls.autoRotate = false; });
const look = (side, dist = 7, up = 0.25) => page.evaluate(([side, dist, up]) => { const s = window.__st, v = window.__view, p = s.parts.get(window.__bb), q = p.quat, rot = (x) => { const [qx, qy, qz, qw] = q, [vx, vy, vz] = x, ix = qw * vx + qy * vz - qz * vy, iy = qw * vy + qz * vx - qx * vz, iz = qw * vz + qx * vy - qy * vx, iw = -qx * vx - qy * vy - qz * vz; return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx]; };
  const n = rot([1, 0, 0]), c = rot([0.9, 0, 0]).map((x, i) => x + p.pos[i]); v.controls.target.set(...c); v.camera.position.set(c[0] + n[0] * dist * side + n[2] * 2.2 * side, c[1] + dist * up, c[2] + n[2] * dist * side - n[0] * 2.2 * side); }, [side, dist, up]);
for (const prog of ['slogans', 'news', 'recruit', 'station', 'own']) {
  await page.evaluate((prog) => { window.__st.setShow(window.__bb, prog); if (prog === 'own') window.__st.setScreenLines('ALL HANDS: THE CAFETERIA ON DECK THREE IS NOW SERVING LIBERTY LOAF WITH EXTRA DEMOCRACY GRAVY'); }, prog);
  await look(1); await page.waitForTimeout(2200); await page.screenshot({ path: `test/shots/screen-${prog}.png`, timeout: 120000 });
}
await page.evaluate(() => { const s = window.__st, v = window.__view, p = s.parts.get(window.__bb), [qx, qy, qz, qw] = p.quat, n = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy + qz * qw), 2 * (qx * qz - qy * qw)], c = [p.pos[0] + n[0] * 0.8, p.pos[1], p.pos[2] + n[2] * 0.8], side = [-n[2], 0, n[0]]; v.controls.target.set(...c); v.camera.position.set(c[0] - n[0] * 1.2 + side[0] * 5, c[1] + 1.6, c[2] - n[2] * 1.2 + side[2] * 5); }); await page.waitForTimeout(2000); await page.screenshot({ path: 'test/shots/screen-back.png', timeout: 120000 });
// the card
await page.evaluate(() => { window.__view.select && null; }); 
await page.evaluate(() => { const s = window.__st, v = window.__view, p = s.parts.get(window.__dp), B = v._berthAt(p, 'freighter'); v.controls.target.copy(B.mouth); v.camera.position.copy(B.mouth).addScaledVector(B.out, 4).add({ x: 1.5, y: 1.2, z: 2 }); });
await page.waitForTimeout(2200); await page.screenshot({ path: 'test/shots/dock-lamps.png', timeout: 120000 });
console.log(errs.join('\n') || 'no page errors');
await b.close();
