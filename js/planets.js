// Planets and moons, painted in code the way Orbital Fury paints Mars: noise sampled on the sphere (so there is no seam),
// mapped to a palette per world type. Orbital Fury's biomes are here too: ice, highlands, desert, jungle and a rocky moon.
import { Noise } from './noise.js';
import { RNG } from './rng.js';

const TAU = Math.PI * 2;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const WORLDS = {
  mars:      { name: 'Mars-type', atmo: 0xff9a6a, clouds: 0 },
  ice:       { name: 'Ice world', atmo: 0xbfe8ff, clouds: 0.25 },
  highlands: { name: 'Highland world', atmo: 0x8fd0ff, clouds: 0.45 },
  desert:    { name: 'Desert world', atmo: 0xffd29a, clouds: 0.1 },
  jungle:    { name: 'Jungle world', atmo: 0x9fe8b0, clouds: 0.6 },
  moon:      { name: 'Barren rock', atmo: 0x000000, clouds: 0 },
};
export const WORLD_TYPES = ['mars', 'ice', 'highlands', 'desert', 'jungle', 'moon'];

// A latitude-longitude picture (W x W/2) as a canvas, and a cloud layer (alpha) when the world has weather.
export function paintWorld(type, seed, W = 512) {
  const H = W / 2, n = new Noise(seed), n2 = new Noise(seed + 77), rng = new RNG(seed + 5);
  const tri = (N, px, py, pz, k, oct) => {
    const wx = px * px, wy = py * py, wz = pz * pz, s = wx + wy + wz;
    return (N.fbm(py * k + 11, pz * k + 7, oct) * wx + N.fbm(pz * k + 3, px * k + 19, oct) * wy + N.fbm(px * k + 5, py * k + 13, oct) * wz) / s;
  };
  // craters for rocky worlds: centres on the sphere and radii
  const craters = type === 'moon' || type === 'mars' ? Array.from({ length: type === 'moon' ? 90 : 30 }, () => {
    const u = rng.range(-1, 1), a = rng.range(0, TAU), c = Math.sqrt(1 - u * u);
    return [c * Math.cos(a), u, c * Math.sin(a), rng.range(0.03, type === 'moon' ? 0.16 : 0.08)];
  }) : [];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const img = cv.getContext('2d').createImageData(W, H), px = img.data;
  const W2 = WORLDS[type];
  let ccv = null, cimg = null;
  if (W2.clouds) { ccv = document.createElement('canvas'); ccv.width = W; ccv.height = H; cimg = ccv.getContext('2d').createImageData(W, H); }
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * TAU, X = cl * Math.cos(lon), Y = sl, Z = cl * Math.sin(lon);
      const e = tri(n, X, Y, Z, 2.4, 5), d = tri(n, X, Y, Z, 7, 3), t = sstep(0.3, 0.68, e + (d - 0.5) * 0.25);
      const polar = sstep(1.12, 1.3, Math.abs(lat) + (d - 0.5) * 0.2);
      let c;
      switch (type) {
        case 'mars': {
          c = mix([64, 30, 20], [178, 84, 46], t);
          if (t > 0.72) c = mix(c, [226, 156, 108], (t - 0.72) / 0.28 * 0.6);
          c = mix(c, [238, 226, 220], polar);
          break;
        }
        case 'ice': {
          c = mix([70, 104, 140], [214, 232, 246], t);
          const crack = (1 - sstep(0.006, 0.03, Math.abs(tri(n2, X, Y, Z, 6, 3) - 0.5))) * 0.5;
          c = mix(c, [40, 70, 110], crack);
          c = mix(c, [250, 252, 255], polar);
          break;
        }
        case 'highlands': {
          // soft edges between sea, beach and land, so the coast does not step at this texture size
          let land = mix([46, 110, 46], [150, 160, 80], clamp01((t - 0.38) / 0.4));
          if (t > 0.82) land = mix(land, [130, 124, 112], (t - 0.82) / 0.18);
          c = mix(mix([18, 48, 92], [34, 86, 130], clamp01(t / 0.32)), [190, 180, 120], sstep(0.3, 0.335, t));
          c = mix(c, land, sstep(0.35, 0.39, t));
          c = mix(c, [240, 246, 250], polar);
          break;
        }
        case 'desert': {
          const dune = 0.5 + 0.5 * Math.sin((lat * 40 + d * 9) + e * 6);
          c = mix([150, 96, 54], [222, 178, 118], t * 0.8 + dune * 0.2);
          if (t < 0.2) c = mix(c, [92, 62, 44], (0.2 - t) / 0.2);
          c = mix(c, [236, 226, 206], polar * 0.6);
          break;
        }
        case 'jungle': {
          c = mix(mix([16, 50, 60], [28, 80, 80], clamp01(t / 0.28)), mix([14, 64, 30], [52, 120, 44], clamp01((t - 0.28) / 0.6)), sstep(0.25, 0.3, t));
          const river = (1 - sstep(0.004, 0.018, Math.abs(tri(n2, X, Y, Z, 4, 3) - 0.5))) * 0.7 * sstep(0.3, 0.34, t);
          c = mix(c, [40, 96, 110], river);
          break;
        }
        default: {
          c = mix([70, 70, 74], [168, 166, 160], t);
          break;
        }
      }
      for (const [cx, cy, cz, r] of craters) {
        const dd = Math.acos(Math.max(-1, Math.min(1, X * cx + Y * cy + Z * cz)));
        if (dd < r * 1.25) { const k = dd / r; c = k < 1 ? mix(c, [c[0] * 0.62, c[1] * 0.62, c[2] * 0.62], 0.7 * (1 - k * k)) : mix(c, [Math.min(255, c[0] * 1.3), Math.min(255, c[1] * 1.3), Math.min(255, c[2] * 1.3)], 0.6 * (1.25 - k) * 4); }
      }
      const o = (y * W + x) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
      if (cimg) {
        const cl2 = tri(n2, X * 1.3, Y * 2.2, Z * 1.3, 3, 5), a = sstep(0.62 - W2.clouds * 0.25, 0.78, cl2);
        cimg.data[o] = 255; cimg.data[o + 1] = 255; cimg.data[o + 2] = 255; cimg.data[o + 3] = a * 230;
      }
    }
  }
  cv.getContext('2d').putImageData(img, 0, 0);
  if (ccv) ccv.getContext('2d').putImageData(cimg, 0, 0);
  return { map: cv, clouds: ccv };
}
