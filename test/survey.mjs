// A look inside one of every kind of part that people walk through: builds them all in free play and takes an INSIDE picture of each.
// Usage: node test/survey.mjs <baseUrl> [type[:zoom[:height[:turn]]] ...]      (pictures land in test/shots/s-<type>.png; HULL=1 keeps the hull on)
import { chromium } from 'playwright';
const [,, base, ...want] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${base}/index.html?free&seed=5${process.env.HULL ? '#hull' : ''}`); await page.waitForTimeout(2500);
const ids = await page.evaluate(() => {
  const s = window.__st, ids = { command: [1] }, b = (t, h, p, r = 0) => { const x = s.build(t, h, p, r); if (!x.ok) { console.error('build', t, 'on', h, p, x.why); return 0; } (ids[t] ||= []).push(x.id); return x.id; };
  const c1 = b('core', 1, 1), j = b('junction', c1, 1), re = b('reactor', j, 1), ring = b('ring', re, 1), drum = b('drum', ring, 1), disc = b('disc', drum, 1), tw = b('tower', disc, 1); b('dome', tw, 1);
  const lc = b('longcore', 1, 0), br = b('bigring', lc, 0), low = b('core', br, 0);
  b('hab', 1, 2); b('cargo', 1, 3); const tb = b('tube', 1, 4), nd = b('node', tb, 1); b('blister', nd, 1); b('hab', nd, 4); b('dockport', nd, 5); b('tube', nd, 2); b('barracks', 1, 5);
  b('hangar', c1, 2); b('eaglehangar', c1, 3); b('pelicanbay', c1, 4); const fs = b('fabshop', c1, 5);
  const gm = b('gunmount', j, 2); b('battery', j, 3); b('dronebay', j, 4); b('lance', j, 5); const rf = b('refinery', j, 6); b('drydock', j, 7);
  const tr = b('truss', lc, 2); b('hab', tr, 1); b('hab', gm, 1); b('tube', rf, 2); b('hab', fs, 2);
  b('hab', ring, 2); b('cargo', drum, 2); b('hab', disc, 3); b('hab', tw, 2); b('dockport', br, 2); b('hab', low, 2); b('core', 1 && ids.hab[0], 1);
  for (let i = 0; i < 60 * 40; i++) s.step(1 / 30);
  const set = (id, rooms) => rooms.forEach((r, i) => s.setRoom(id, i, r));
  set(c1, ['ops', 'workshop']); set(j, ['mess']); set(lc, ['lab', 'medbay', 'bar', 'quarters']); set(low, ['guncrew', 'truth']); set(tw, ['quarters', 'lab', 'mess', 'bar', 'medbay', 'market']);
  s.addColonists(60);
  for (let i = 0; i < 60 * 30; i++) s.step(1 / 30);
  return ids;
});
await page.waitForTimeout(3000);
await page.evaluate(() => { for (const id of ['sp-x', 'c-x']) { const e = document.getElementById(id); if (e) e.click(); } if (!location.hash.includes('hull')) document.querySelector('.vb[data-v=open]').click(); });
const all = Object.keys(ids);
for (const w of (want.length ? want : all)) {
  const [type, zoom = '1', high = '0.8', turn = '0.7'] = w.split(':'), id = (ids[type] || [])[0];
  if (!id) { console.log('none built:', type); continue; }
  const set = `(() => { const s = __st, v = __view, p = s.parts.get(${id}), d = s.def(p), c = s.center(p), R = Math.max(1.2, d.r) * ${zoom}; v.controls.target.set(c[0], c[1] - 0.3, c[2]); v.camera.position.set(c[0] + Math.cos(${turn}) * R, c[1] + R * ${high}, c[2] + Math.sin(${turn}) * R); })()`;
  await page.evaluate(set); await page.waitForTimeout(2200); await page.evaluate(set); await page.waitForTimeout(900);
  await page.screenshot({ path: `test/shots/s-${type}.png`, timeout: 120000 });
}
console.log(errs.slice(0, 8).join('\n') || 'no page errors');
await b.close();
