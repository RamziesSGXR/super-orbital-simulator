// THE CREST MAKER, the same as FOB Super Commander's (its js/logo.js): a crest shape, a symbol, a pattern, colours and up to four
// letters, drawn in code, or a picture of your own. Here it goes on the station's nameplate, every Propaganda Screen, and the
// shoulder of the station's troopers.

export const SHAPES = ['shield', 'circle', 'hex', 'diamond', 'square', 'chevron', 'star', 'pentagon', 'pennant', 'roundel', 'oval'];
export const SYMBOLS = ['eagle', 'fist', 'skull', 'helmet', 'star', 'sword', 'bolt', 'planet', 'globe', 'wings', 'gear', 'tower', 'flame', 'crosshair', 'anchor', 'chevrons', 'none'];
export const PATTERNS = ['none', 'halves', 'stripe', 'band', 'chevron', 'quarters', 'cross', 'diagonal', 'border'];
export const UNIFORMS = ['#8fb0cc', '#2c5a94', '#5b6650', '#7a7f74', '#4a5a6a', '#3b3f3a', '#8a7a5a', '#2e4a2a', '#d9dbd2', '#1d3f8a', '#8a1c1c', '#111111', '#6b5a8a', '#b8862b', '#ffe600', '#c0392b'];
export const PALETTE = ['#ffe600', '#f4f4f4', '#1b2a1a', '#2e4a2a', '#8a1c1c', '#c0392b', '#1d3f8a', '#3da9ff', '#3d4247', '#111111', '#ffb020', '#7a3fa0', '#0f6b5c', '#b8862b'];

function crest(g, shape) {
  g.beginPath();
  switch (shape) {
    case 'circle': g.arc(50, 50, 46, 0, Math.PI * 2); break;
    case 'hex': for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(50 + Math.cos(a) * 47, 50 + Math.sin(a) * 47); } break;
    case 'diamond': g.moveTo(50, 3); g.lineTo(97, 50); g.lineTo(50, 97); g.lineTo(3, 50); break;
    case 'square': g.roundRect(6, 6, 88, 88, 8); break;
    case 'chevron': g.moveTo(6, 6); g.lineTo(94, 6); g.lineTo(94, 70); g.lineTo(50, 96); g.lineTo(6, 70); break;
    case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 30 : 49; g.lineTo(50 + Math.cos(a) * r, 54 + Math.sin(a) * r); } break;
    case 'pentagon': for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; g.lineTo(50 + Math.cos(a) * 48, 54 + Math.sin(a) * 48); } break;
    case 'pennant': g.moveTo(8, 4); g.lineTo(92, 4); g.lineTo(92, 96); g.lineTo(50, 76); g.lineTo(8, 96); break;
    case 'roundel': g.arc(50, 50, 47, 0, Math.PI * 2); break;
    case 'oval': g.ellipse(50, 50, 38, 47, 0, 0, Math.PI * 2); break;
    default: g.moveTo(8, 6); g.lineTo(92, 6); g.lineTo(92, 46); g.quadraticCurveTo(90, 82, 50, 97); g.quadraticCurveTo(10, 82, 8, 46); break;
  }
  g.closePath();
}

function symbol(g, sym) {
  g.beginPath();
  switch (sym) {
    case 'eagle':   // spread wings and a head, the Federation way
      g.moveTo(50, 30); g.lineTo(56, 38); g.lineTo(54, 40); g.lineTo(50, 37); g.lineTo(46, 40); g.lineTo(44, 38); g.closePath();
      for (const s of [-1, 1]) {
        g.moveTo(50 + s * 4, 44);
        for (let i = 0; i < 5; i++) { g.lineTo(50 + s * (14 + i * 7), 30 + i * 3); g.lineTo(50 + s * (12 + i * 7), 40 + i * 4); }
        g.lineTo(50 + s * 6, 62); g.closePath();
      }
      g.moveTo(44, 46); g.lineTo(56, 46); g.lineTo(54, 70); g.lineTo(50, 76); g.lineTo(46, 70); g.closePath();
      break;
    case 'skull':
      g.arc(50, 44, 18, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(62, 66); g.lineTo(38, 66); g.closePath();
      g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath();
      g.arc(43, 46, 5, 0, 7); g.moveTo(62, 46); g.arc(57, 46, 5, 0, 7); g.moveTo(50, 52); g.lineTo(53, 58); g.lineTo(47, 58); g.closePath();
      for (let i = 0; i < 3; i++) g.rect(42 + i * 6, 62, 3, 6);
      g.fill(); g.globalCompositeOperation = 'source-over'; return;
    case 'star':
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 27; g.lineTo(50 + Math.cos(a) * r, 50 + Math.sin(a) * r); }
      g.closePath(); break;
    case 'sword':
      g.moveTo(50, 16); g.lineTo(55, 26); g.lineTo(55, 62); g.lineTo(45, 62); g.lineTo(45, 26); g.closePath();
      g.rect(36, 62, 28, 5); g.rect(47, 67, 6, 12); g.arc(50, 82, 4, 0, 7); break;
    case 'bolt':
      g.moveTo(58, 14); g.lineTo(34, 54); g.lineTo(48, 54); g.lineTo(40, 86); g.lineTo(66, 42); g.lineTo(52, 42); g.closePath(); break;
    case 'planet':
      g.arc(50, 50, 16, 0, 7); g.fill(); g.beginPath();
      g.ellipse(50, 50, 30, 9, -0.35, 0, 7); g.lineWidth = 4; g.strokeStyle = g.fillStyle; g.stroke(); return;
    case 'gear':
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 22 : 28; g.lineTo(50 + Math.cos(a) * r, 50 + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(50, 50, 9, 0, 7); g.fill();
      g.globalCompositeOperation = 'source-over'; return;
    case 'fist':   // the Helldiver salute: a clenched fist on an upright forearm
      g.roundRect(35, 22, 30, 28, 7); g.rect(41, 48, 18, 36); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath();
      for (const x of [42.5, 50, 57.5]) g.rect(x - 1, 22, 2, 12);
      g.rect(35, 38, 9, 2); g.fill(); g.globalCompositeOperation = 'source-over'; return;
    case 'helmet':
      g.arc(50, 54, 26, Math.PI, 0); g.lineTo(76, 62); g.lineTo(24, 62); g.closePath(); g.rect(30, 62, 40, 6); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.roundRect(32, 44, 36, 8, 3); g.fill(); g.globalCompositeOperation = 'source-over'; return;
    case 'globe':
      g.arc(50, 50, 26, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 3; g.beginPath();
      g.ellipse(50, 50, 11, 26, 0, 0, 7); g.moveTo(24, 50); g.lineTo(76, 50); g.moveTo(28, 37); g.lineTo(72, 37); g.moveTo(28, 63); g.lineTo(72, 63); g.stroke();
      g.globalCompositeOperation = 'source-over'; return;
    case 'wings':
      for (const s of [-1, 1]) { g.moveTo(50 + s * 6, 46); for (let i = 0; i < 5; i++) { g.lineTo(50 + s * (16 + i * 7), 28 + i * 3); g.lineTo(50 + s * (14 + i * 7), 38 + i * 4); } g.lineTo(50 + s * 8, 62); g.closePath(); }
      g.moveTo(58, 52); g.arc(50, 52, 8, 0, 7); break;
    case 'tower':
      g.rect(36, 34, 28, 48); g.rect(30, 80, 40, 6); for (let i = 0; i < 4; i++) g.rect(32 + i * 10, 24, 6, 12); g.rect(32, 34, 36, 4); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(50, 70, 6, Math.PI, 0); g.rect(44, 70, 12, 10); g.fill(); g.globalCompositeOperation = 'source-over'; return;
    case 'flame':
      g.moveTo(50, 14); g.bezierCurveTo(70, 36, 74, 54, 66, 70); g.bezierCurveTo(60, 84, 40, 84, 34, 70); g.bezierCurveTo(28, 56, 36, 46, 42, 38);
      g.bezierCurveTo(44, 50, 48, 54, 52, 54); g.bezierCurveTo(54, 40, 46, 28, 50, 14); break;
    case 'crosshair':
      g.lineWidth = 5; g.strokeStyle = g.fillStyle; g.arc(50, 50, 22, 0, 7); g.moveTo(50, 18); g.lineTo(50, 38); g.moveTo(50, 62); g.lineTo(50, 82);
      g.moveTo(18, 50); g.lineTo(38, 50); g.moveTo(62, 50); g.lineTo(82, 50); g.stroke(); g.beginPath(); g.arc(50, 50, 4, 0, 7); break;
    case 'anchor':
      g.lineWidth = 6; g.strokeStyle = g.fillStyle; g.lineCap = 'round'; g.arc(50, 24, 6, 0, 7); g.moveTo(50, 30); g.lineTo(50, 80);
      g.moveTo(36, 40); g.lineTo(64, 40); g.moveTo(26, 62); g.quadraticCurveTo(30, 82, 50, 82); g.quadraticCurveTo(70, 82, 74, 62); g.stroke(); g.lineCap = 'butt'; return;
    case 'chevrons':
      for (let i = 0; i < 3; i++) { const y = 30 + i * 14; g.moveTo(26, y); g.lineTo(50, y + 14); g.lineTo(74, y); g.lineTo(74, y + 7); g.lineTo(50, y + 21); g.lineTo(26, y + 7); g.closePath(); }
      break;
    default: return;
  }
  g.fill();
}

// An uploaded logo: kept on the device as a small PNG inside the save, and decoded once before drawing.
const IMGS = new Map();
export async function ensureLogo(logo) {
  if (!logo?.img || IMGS.has(logo.img)) return;
  const im = new Image(); im.src = logo.img;
  try { await im.decode(); IMGS.set(logo.img, im); } catch { /* a broken image falls back to the crest */ }
}
// Reads a picture file and shrinks it to at most 128 px, so the save stays small. Rejects anything over 2 MB.
export async function readUpload(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('That file is not a picture.');
  if (file.size > 2 * 1024 * 1024) throw new Error('That picture is over 2 MB.');
  const url = URL.createObjectURL(file), im = new Image(); im.src = url;
  try { await im.decode(); } finally { URL.revokeObjectURL(url); }
  const k = Math.min(1, 128 / Math.max(im.width, im.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  const data = c.toDataURL('image/png'); await ensureLogo({ img: data }); return data;
}

function pattern(g, logo) {
  const p = logo.pattern; if (!p || p === 'none') return;
  g.save(); g.fillStyle = logo.pc || logo.rim; g.beginPath();
  if (p === 'halves') g.rect(50, 0, 50, 100);
  else if (p === 'stripe') g.rect(40, 0, 20, 100);
  else if (p === 'band') g.rect(0, 40, 100, 20);
  else if (p === 'chevron') { g.moveTo(0, 62); g.lineTo(50, 32); g.lineTo(100, 62); g.lineTo(100, 80); g.lineTo(50, 50); g.lineTo(0, 80); }
  else if (p === 'quarters') { g.rect(50, 0, 50, 50); g.rect(0, 50, 50, 50); }
  else if (p === 'cross') { g.rect(42, 0, 16, 100); g.rect(0, 42, 100, 16); }
  else if (p === 'diagonal') { g.moveTo(0, 0); g.lineTo(28, 0); g.lineTo(100, 72); g.lineTo(100, 100); g.lineTo(72, 100); g.lineTo(0, 28); }
  if (p === 'border') { g.translate(50, 50); g.scale(0.8, 0.8); g.translate(-50, -50); crest(g, logo.shape); g.lineWidth = 5; g.strokeStyle = logo.pc || logo.rim; g.stroke(); }
  else g.fill();
  g.restore();
}

// A trooper seen from the front, for the faction editor's preview of the uniform.
export function drawTrooper(g, f, x, y, s) {
  const L = lookOf(f); g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
  g.fillStyle = '#22251f'; g.fillRect(36, 70, 12, 28); g.fillRect(52, 70, 12, 28);
  g.fillStyle = L.uniform; g.fillRect(30, 34, 40, 38); g.fillRect(18, 36, 11, 30); g.fillRect(71, 36, 11, 30);
  g.fillStyle = L.armband; g.fillRect(18, 46, 11, 6); g.fillRect(71, 46, 11, 6);
  if (L.crest) { const im = IMGS.get(f.logo.img); if (im) g.drawImage(im, 19, 37, 9, 9); else { g.save(); drawLogo(g, f.logo, 19, 37, 9); g.restore(); } }
  g.fillStyle = '#c99a78'; g.beginPath(); g.arc(50, 24, 10, 0, 7); g.fill();
  g.fillStyle = L.helmet; g.beginPath(); g.arc(50, 22, 12, Math.PI, 0); g.fill(); g.fillRect(37, 20, 26, 4);
  g.restore();
}
// The look of a faction's troopers; older saves have none, so it is worked out from the faction colours.
export function lookOf(f) {
  const mix = (a, b, k) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.substr(1 + i, 2), 16) * (1 - k) + parseInt(b.substr(1 + i, 2), 16) * k).toString(16).padStart(2, '0')).join('');
  void mix;   // SEAF issue by default: light-blue armour, a blue helmet; the faction's colour goes on the armband
  return { uniform: '#8fb0cc', helmet: '#2c5a94', armband: f.secondary, crest: true, ...(f.look || {}) };
}

// Draws a logo into a 2D context at (x, y), size s.
export function drawLogo(g, logo, x = 0, y = 0, s = 100) {
  const up = logo.img && IMGS.get(logo.img);
  if (up) {   // an uploaded logo replaces the crest, fitted inside the square
    const k = Math.min(s / up.width, s / up.height), w = up.width * k, h = up.height * k;
    g.drawImage(up, x + (s - w) / 2, y + (s - h) / 2, w, h); return;
  }
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
  crest(g, logo.shape); g.fillStyle = logo.bg; g.fill();
  g.lineWidth = 5; g.strokeStyle = logo.rim; g.stroke();
  if (logo.shape === 'roundel') { g.beginPath(); g.arc(50, 50, 39, 0, 7); g.lineWidth = 3; g.strokeStyle = logo.rim; g.stroke(); }
  g.save(); crest(g, logo.shape); g.clip();
  pattern(g, logo);
  const hasText = !!(logo.text && logo.text.trim());
  if (hasText && logo.symbol !== 'none') { g.translate(50, 44); g.scale(0.78, 0.78); g.translate(-50, -50); }
  g.fillStyle = logo.fg; symbol(g, logo.symbol);
  g.restore();
  if (hasText) {
    const t = logo.text.trim().toUpperCase().slice(0, 4);
    g.fillStyle = logo.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const big = logo.symbol === 'none';
    g.font = `bold ${big ? (t.length > 2 ? 30 : 40) : (t.length > 2 ? 14 : 18)}px ui-monospace, Menlo, Consolas, monospace`;
    g.fillText(t, 50, big ? 52 : 80);
  }
  g.restore();
}

export function logoCanvas(logo, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  drawLogo(c.getContext('2d'), logo, size * 0.02, size * 0.02, size * 0.96);
  return c;
}
