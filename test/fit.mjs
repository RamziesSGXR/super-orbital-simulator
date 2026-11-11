// Fit check: opens the interface at several screen sizes and reports anything that is cut off, spills out of its box,
// leaves the screen, or sits on top of another panel.
// Usage: npm start (in another terminal), then node test/fit.mjs [baseUrl=http://localhost:8080]
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8080';
fs.mkdirSync('test/shots', { recursive: true });
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const SIZES = [[1366, 768, false], [1024, 600, false], [844, 390, true], [740, 360, true], [667, 375, true], [568, 320, true], [390, 844, true]].filter(([w, h]) => !ONLY || ONLY.includes(`${w}x${h}`));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;

// Runs in the page. Returns a list of problems.
function audit() {
  const out = [], W = innerWidth, H = innerHeight;
  const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const label = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`;
  const hud = document.getElementById('hud');
  for (const e of hud.querySelectorAll('*')) {
    if (!vis(e) || e.closest('svg') || e.closest('.hidden')) continue;
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    // Leaves the screen.
    const scrolls = (() => { for (let q = e.parentElement; q && q !== hud; q = q.parentElement) if (['auto', 'scroll'].includes(getComputedStyle(q).overflowY)) return true; return false; })();
    const sideways = r.right > W + 1 || r.left < -1, vertical = r.bottom > H + 1 || r.top < -1;
    if (sideways || (vertical && !scrolls)) { if (!e.closest('.cmd, .groups')) out.push(`off screen: ${label(e)} (${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)})`); continue; }
    if (vertical) continue;      // inside a box that scrolls: reachable
    // Text cut off by its own box.
    if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 1 && s.textOverflow !== 'ellipsis') out.push(`clipped text: ${label(e)} (${e.scrollWidth} in ${e.clientWidth})`);
    // Spills out of the box that is meant to hold it.
    let p = e.parentElement;
    while (p && p !== hud) {
      const ps = getComputedStyle(p);
      if (['hidden', 'auto', 'scroll', 'clip'].includes(ps.overflowX) && !(ps.overflowX === 'auto' || ps.overflowX === 'scroll')) {
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 1.5 || r.left < pr.left - 1.5) { out.push(`spills: ${label(e)} out of ${label(p)}`); }
        break;
      }
      if (['auto', 'scroll'].includes(ps.overflowX)) break;
      p = p.parentElement;
    }
  }
  // Panels on top of each other.
  const boxes = ['#top', '#panel', '#comms', '#c-open', '#cmdr', '#upg', '#simpanel', '#info'].map((q) => [q, document.querySelector(q)]).filter(([, e]) => e && vis(e));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [qa, a] = boxes[i], [qb, b] = boxes[j];
    if (qa === '#panel' && qb === '#info' || qa === '#info' && qb === '#panel') continue;
    const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    if (A.left < B.right - 2 && B.left < A.right - 2 && A.top < B.bottom - 2 && B.top < A.bottom - 2) out.push(`overlap: ${qa} and ${qb}`);
  }
  // The top bar must fit on one line.
  const top = document.getElementById('top');
  if (top.scrollWidth > top.clientWidth + 1) out.push(`top bar is wider than the screen (${top.scrollWidth} > ${top.clientWidth})`);
  const res = top.querySelector('.res');
  if (res && res.scrollWidth > res.clientWidth + 1) out.push(`resource readout is cut off (${res.scrollWidth} > ${res.clientWidth})`);
  return out;
}

for (const [w, h, touch] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const states = [];
  const seen = async (name, shot) => {
    const probs = await page.evaluate(audit);
    for (const p of probs) { console.log(`FAIL  ${w}x${h}  ${name}: ${p}`); bad++; }
    if (!probs.length) console.log(`PASS  ${w}x${h}  ${name}`);
    if (shot) await page.screenshot({ path: `test/shots/fit-${w}x${h}-${shot}.png`, timeout: 120000 }).catch(() => {});
  };
  // Economy, a built station, a request waiting, comms open.
  await page.goto(`${BASE}/index.html?economy&seed=1`); await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const s = window.__st, b = (t, h, k, r = 0) => s.build(t, h, k, r).id;
    b('dockport', 1, 2); b('cargo', 1, 3); b('hab', 1, 4); b('hab', 1, 5); const c = b('core', 1, 1); b('reactor', c, 1);
    s.credits = 5000; for (let i = 0; i < 30 * 200; i++) s.step(1 / 30);
    s.tier = 1; s.radius = 40; s.timers.request = 0; for (let i = 0; i < 60; i++) s.step(1 / 30);
    for (let i = 0; i < 6; i++) s.say(['traffic', 'ministry', 'captain', 'maintenance', 'security', 'supply'][i], 'A long message to see how a line of station chatter wraps inside the comms window at this width, Commander.', { warn: i % 2 });
  });
  await page.waitForTimeout(2500);
  await seen('economy, comms open', 'economy');
  await page.keyboard.press('o').catch(() => {}); if (touch) await page.tap('#b-cmdr').catch(() => {}); await page.waitForTimeout(500);
  for (const k of ['supply', 'maintenance', 'security', 'truth']) {
    await page.click(`#cm-tabs .dt[data-k="${k}"]`).catch(() => {}); await page.waitForTimeout(250);
    await seen(`commander, ${k}`, k === 'security' ? 'commander' : null);
  }
  await page.keyboard.press('Escape'); await page.evaluate(() => document.getElementById('cm-x').click()); await page.waitForTimeout(150);
  await page.keyboard.press('u').catch(() => {}); await page.waitForTimeout(300);
  await seen('upgrade path', 'upgrades');
  await page.evaluate(() => document.getElementById('up-x').click());
  // Select a part, then a person, then edit inside.
  await page.evaluate(() => { const s = window.__st, p = [...s.parts.values()].find((x) => x.type === 'hab'); window.__ui.sel = p.id; window.__view.select(p.id); });
  await page.waitForTimeout(500);
  await seen('a part selected', 'part');
  await page.evaluate(() => { const a = window.__st.agents.find((x) => x.role !== 'resident'); window.__ui.sel = null; window.__ui.person = a.id; });
  await page.waitForTimeout(500);
  await seen('a person selected', 'person');
  await page.evaluate(() => { window.__ui.person = 0; });
  await page.keyboard.press('i'); await page.waitForTimeout(600);
  // free play controls
  await page.goto(`${BASE}/index.html?free&seed=2`); await page.waitForTimeout(1200);
  await page.keyboard.press('k'); await page.waitForTimeout(200);
  if (!(await page.isVisible('#simpanel'))) await page.keyboard.press('k');
  await page.evaluate(() => { const s = window.__st, b = (t, h, k) => s.build(t, h, k).id; b('dockport', 1, 2); b('cargo', 1, 3); b('hab', 1, 4); s.addColonists(8); for (let i = 0; i < 600; i++) s.step(1 / 30); });
  await page.waitForTimeout(800);
  await seen('free play controls', 'free');
  if (errs.length) { console.log(`FAIL  ${w}x${h}  page errors: ${errs.join(' | ')}`); bad++; }
  await page.close();
}
await browser.close();
console.log(bad ? `\n${bad} PROBLEMS` : '\nEVERYTHING FITS');
process.exit(bad ? 1 : 0);
