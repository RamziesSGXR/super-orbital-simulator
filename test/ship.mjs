// Pictures of one ship model from four sides, in a scene of its own (lit, on grey). Usage: node test/ship.mjs <baseUrl> [kind]
import { chromium } from 'playwright';
const [,, base, kind = 'shuttle'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(`${base}/index.html?free&seed=5`); await page.waitForTimeout(2500);
const shots = await page.evaluate(async (kind) => {
  const THREE = await import('/js/vendor/three.js'), P = await import('/js/parts.js'), v = window.__view;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x3a3f45);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(3, 5, 4); sc.add(d);
  const sh = P.buildShip(kind); v._dress(sh, 'active', false, false, true); sc.add(sh);
  const box = new THREE.Box3().setFromObject(sh), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length();
  const cam = new THREE.PerspectiveCamera(35, 1.5, 0.01, 100), out = [], rt = v.renderer, cv = rt.domElement;
  for (const [x, y, z] of [[1, 0.5, 0.9], [-1, 0.45, 0.7], [0.15, 1.6, 0.2], [-0.2, 0.08, 1.2]]) {
    cam.position.copy(c).add(new THREE.Vector3(x, y, z).normalize().multiplyScalar(r * 1.25)); cam.lookAt(c);
    rt.setSize(900, 600, false); rt.render(sc, cam); out.push(cv.toDataURL('image/png'));
  }
  return out;
}, kind);
const fs = await import('fs');
shots.forEach((u, i) => fs.writeFileSync(`test/shots/ship-${kind}-${i}.png`, Buffer.from(u.split(',')[1], 'base64')));
await b.close();
