// SOLIDS: the space inside a part's hull, as a grid of small cells, so the station can tell when a new part would run into one
// already built. Parts may still nest: a ring inside a bigger ring, a module in the open middle of a disc. Only hull running
// through hull is refused.
//
// Each kind of part is filled once. Its hull pieces are built as they are drawn (unmerged), and every vertical column of the grid
// is crossed with each closed piece: between an entry and the next exit the column is inside, as a ray test would find. Pieces
// thinner than a cell (solar wings, masts, screens) take no cells; they cannot clash.
import { buildPart } from './parts.js';

export const RES = 0.25;      // one cell: 0.25 units, about 2.25 m
const SOLID = new Set(['hull', 'trim', 'dark', 'panel', 'glass', 'pod']);
const OFF = 0.0731;           // columns stand a little off the round numbers, so none runs exactly down a seam
const cache = new Map();
const key = (i, j, k) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);

export function solidOf(type) {
  let s = cache.get(type); if (s) return s;
  const g = buildPart(type, true), cells = new Set();
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!o.isMesh || !SOLID.has(o.userData.role)) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = (idx ? idx.count : pos.count) / 3, e = o.matrixWorld.elements;
    const P = (i) => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
    const cols = new Map();
    for (let t = 0; t < n; t++) {
      const a = P(idx ? idx.getX(t * 3) : t * 3), b = P(idx ? idx.getX(t * 3 + 1) : t * 3 + 1), c = P(idx ? idx.getX(t * 3 + 2) : t * 3 + 2);
      const d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
      if (Math.abs(d) < 1e-12) continue;      // edge-on from above: no column crosses it
      const i0 = Math.ceil(Math.min(a[0], b[0], c[0]) / RES - 0.5 - OFF), i1 = Math.floor(Math.max(a[0], b[0], c[0]) / RES - 0.5 - OFF);
      const k0 = Math.ceil(Math.min(a[2], b[2], c[2]) / RES - 0.5 - OFF), k1 = Math.floor(Math.max(a[2], b[2], c[2]) / RES - 0.5 - OFF);
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
        const x = (i + 0.5 + OFF) * RES, z = (k + 0.5 + OFF) * RES;
        const u = ((x - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (z - a[2])) / d, w = ((b[0] - a[0]) * (z - a[2]) - (x - a[0]) * (b[2] - a[2])) / d;
        if (u < 0 || w < 0 || u + w > 1) continue;
        const y = a[1] + u * (b[1] - a[1]) + w * (c[1] - a[1]), ck = i * 4096 + k;
        let L = cols.get(ck); if (!L) cols.set(ck, L = [i, k]); L.push(y);
      }
    }
    for (const L of cols.values()) {
      const ys = L.slice(2).sort((p, q) => p - q);
      for (let m = 0; m + 1 < ys.length; m += 2) for (let j = Math.ceil(ys[m] / RES - 0.5); j <= Math.floor(ys[m + 1] / RES - 0.5); j++) cells.add(key(L[0], j, L[1]));
    }
  });
  g.traverse((x) => { if (x.geometry) x.geometry.dispose(); });
  // the cells as a list of centres too, and a sphere round them for a quick first test
  const list = new Float32Array(cells.size * 3); let m = 0, cx = 0, cy = 0, cz = 0;
  for (const kk of cells) { const i = Math.floor(kk / 1048576) - 512, j = Math.floor((kk % 1048576) / 1024) - 512, k = (kk % 1024) - 512; list[m++] = (i + 0.5 + OFF) * RES; list[m++] = (j + 0.5) * RES; list[m++] = (k + 0.5 + OFF) * RES; cx += list[m - 3]; cy += list[m - 2]; cz += list[m - 1]; }
  const N = Math.max(1, cells.size), c = [cx / N, cy / N, cz / N]; let r = 0;
  for (let p = 0; p < list.length; p += 3) r = Math.max(r, Math.hypot(list[p] - c[0], list[p + 1] - c[1], list[p + 2] - c[2]));
  // the DEEP cells: those with solid on all six sides, a cell or more in from the hull. Two parts that only touch share no deep
  // cell with each other's solid; one that runs through another does.
  const deep = []; let p2 = 0;
  for (const kk of cells) { if (cells.has(kk + 1) && cells.has(kk - 1) && cells.has(kk + 1024) && cells.has(kk - 1024) && cells.has(kk + 1048576) && cells.has(kk - 1048576)) deep.push(list[p2], list[p2 + 1], list[p2 + 2]); p2 += 3; }
  s = { cells, list, deep: new Float32Array(deep), c, r: r + RES };
  cache.set(type, s);
  return s;
}
// Is a point (in the part's own frame) inside its solid? (Iteration order of `cells` matches `list`.)
export function inSolid(s, x, y, z) { return s.cells.has(key(Math.floor(x / RES - OFF), Math.floor(y / RES), Math.floor(z / RES - OFF))); }
