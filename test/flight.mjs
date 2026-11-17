// Pictures of one ship coming in, docking and leaving, a few seconds apart. Usage: node test/flight.mjs <baseUrl> [kind]
import { chromium } from 'playwright';
const [,, base, kind = 'freighter'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/index.html?free&seed=5`); await page.waitForTimeout(2500);
await page.evaluate("import('/test/demo.js').then(()=>{window.__ids=window.__demo();})"); await page.waitForTimeout(4000);
await page.evaluate((kind) => {
  for (const id of ['sp-x', 'c-x']) { const e = document.getElementById(id); if (e) e.click(); }
  const s = window.__st, v = window.__view; window.__ui.paused = true; s.clearShips(); s.timers.freighter = s.timers.shuttle = s.timers.warship = 1e9;
  s.spawnShip(kind); v.controls.autoRotate = false;
  v.controls.target.set(v.envC.x, v.envC.y, v.envC.z); v.camera.position.set(v.envC.x + v.envR * 1.5, v.envC.y + v.envR * 1.9, v.envC.z + v.envR * 2.3);
}, kind);
let n = 0;
const shot = async (label) => { await page.waitForTimeout(1500); await page.screenshot({ path: `test/shots/flight-${String(n++).padStart(2, '0')}-${label}.png`, timeout: 120000 }); };
const step = (sec) => page.evaluate((sec) => { const s = window.__st, v = window.__view; let now = (window.__now ||= 500); for (let i = 0; i < sec * 20; i++) { s.step(0.05); now += 0.05; v._ships(now, 0.05); } window.__now = now; const x = s.ships[0]; return x ? `${x.kind} ${x.state} t=${x.t.toFixed(1)} at ${v.shipObjs.get(x.id).position.toArray().map((q) => q.toFixed(1))} dock ${x.dock}` : 'gone'; }, sec);
for (const [sec, label] of [[4, 'arriving'], [3, 'holding'], [4, 'in1'], [3, 'in2'], [3, 'in3'], [3, 'in4'], [2.5, 'docked'], [0, '']]) { const r = await step(sec); console.log(label.padEnd(9), r); if (label) await shot(label); }
// make it leave: empty its hold
await page.evaluate(() => { const x = window.__st.ships[0]; if (x) { x.crates = 0; x.reserved = 0; x.inspect = 0; x.repair = 1; } });
for (const [sec, label] of [[1.5, 'out1'], [2, 'out2'], [2, 'out3'], [2, 'out4']]) { const r = await step(sec); console.log(label.padEnd(9), r); await shot(label); }
console.log(errs.join('\n') || 'no page errors');
await b.close();
