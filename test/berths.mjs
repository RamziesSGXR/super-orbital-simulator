// Which berths get used? Builds a station with every kind of berth in free play, runs it, and counts the ships at each.
// Usage: node test/berths.mjs <baseUrl> [minutes] [seed]
import { chromium } from 'playwright';
const [,, base, mins = '10', seed = '5'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1200, height: 700 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/index.html?free&seed=${seed}`); await page.waitForTimeout(2500);
await page.evaluate(() => {
  const s = window.__st, log = window.__log = [], bld = (t, h, p) => { const x = s.build(t, h, p); if (!x.ok) log.push(`no ${t} on ${h}:${p} (${x.why})`); return x.id; };
  const c1 = bld('core', 1, 1), j = bld('junction', c1, 1);
  const h = bld('hab', 1, 2); bld('cargo', 1, 3); bld('dockport', 1, 4); bld('dockport', 1, 5);
  bld('dockport', h, 1); bld('dockport', h, 2);
  const hg = bld('hangar', c1, 2); const dd = bld('drydock', c1, 3); bld('pylon', c1, 4); bld('pylon', c1, 5);
  bld('dockport', j, 2); bld('dockport', j, 4); bld('pylon', j, 6);
  for (let i = 0; i < 30 * 30; i++) s.step(1 / 30);
  if (hg) s.setRoom(hg, 0, 'shuttlebay'); if (dd) s.setRoom(dd, 0, 'workshop');
  s.addColonists(10);
});
await page.waitForTimeout(3000);
const out = await page.evaluate((mins) => {
  const s = window.__st, v = window.__view, used = new Map(), kinds = {};
  v._ships(0, 0.1);
  let now = 100;
  for (let k = 0; k < mins * 600; k++) { s.step(0.1); now += 0.1; v._ships(now, 0.1); for (const x of s.ships) if (x.state === 'docked' && x.t < 0.1) { used.set(x.dock, (used.get(x.dock) || 0) + 1); kinds[x.kind] = (kinds[x.kind] || 0) + 1; } s.events.length = 0; }
  const rows = [...s.parts.values()].filter((p) => s.def(p).berth).map((p) => `${String(p.id).padStart(3)} ${s.name(p).padEnd(22)} ships ${String(used.get(p.id) || 0).padStart(3)}  ${v.shut.has(p.id) ? 'SHUT: ' + v.shut.get(p.id) : s.berths().some((x) => x.id === p.id) ? 'open' : s.berthStatus(p).why}`);
  return { rows, kinds, lost: s.stats.lost, log: window.__log };
}, +mins);
await page.evaluate(() => { for (const id of ['sp-x', 'c-x']) { const e = document.getElementById(id); if (e) e.click(); } const v = window.__view, E = v.envC; v.controls.autoRotate = false; v.controls.target.copy(E); v.camera.position.set(E.x + v.envR * 0.9, E.y + v.envR * 0.75, E.z + v.envR * 1.1); });
await page.waitForTimeout(2500); await page.screenshot({ path: 'test/shots/berths-wide.png', timeout: 120000 });
await page.evaluate(() => { const s = window.__st, v = window.__view, p = [...s.parts.values()].find((x) => x.type === 'dockport' && s.berthStatus(x).k === 'open') || [...s.parts.values()].find((x) => x.type === 'dockport'), B = v._berthAt(p, 'freighter'); v.controls.target.copy(B.mouth); v.camera.position.copy(B.mouth).addScaledVector(B.out, 3.5).add({ x: 1.2, y: 1.6, z: 1.8 }); });
await page.waitForTimeout(2500); await page.screenshot({ path: 'test/shots/berths-lights.png', timeout: 120000 });
for (const id of await page.evaluate(() => [...window.__view.shut.keys()])) {
  await page.evaluate((id) => { const s = window.__st, v = window.__view, p = s.parts.get(id), B = v._berthAt(p, 'freighter'), c = B.pos.clone().addScaledVector(B.out, 4); v.controls.target.copy(c); v.camera.position.copy(c).addScaledVector(B.out, 16).add({ x: 6, y: 9, z: 6 }); v.controls.autoRotate = false; }, id);
  await page.waitForTimeout(2500); await page.screenshot({ path: `test/shots/shut-${id}.png`, timeout: 120000 });
}
for (const l of out.log) console.log('note', l);
console.log(out.rows.join('\n'));
console.log('ships by kind', JSON.stringify(out.kinds), 'lost', out.lost);
console.log(errs.join('\n') || 'no page errors');
await b.close();
