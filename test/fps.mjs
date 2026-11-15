// Frame rate check under software rendering: node test/fps.mjs [baseUrl] [query]
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8080', Q = process.argv[3] || 'economy&seed=1';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
await page.goto(`${BASE}/index.html?${Q}`); await page.waitForTimeout(1500);
await page.evaluate(() => { const s = window.__st, bb = (t, h, k) => s.build(t, h, k).id; bb('dockport', 1, 2); bb('cargo', 1, 3); bb('hab', 1, 4); bb('hab', 1, 5); const c = bb('core', 1, 1); bb('reactor', c, 1); bb('gunmount', c, 2); for (let i = 0; i < 30 * 200; i++) s.step(1 / 30); });
const fps = async (label) => { const n = await page.evaluate(() => new Promise((res) => { let k = 0; const t0 = performance.now(); const f = () => { k++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(k / 3); }; requestAnimationFrame(f); })); console.log(label, n.toFixed(1), 'fps'); };
await fps('hull');
for (const [k, v] of Object.entries(JSON.parse(process.argv[4] || '{}'))) { await page.evaluate(v); await fps(k); }
await b.close();
