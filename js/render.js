// The blueprint view: a side-on technical cross-section of the hull, in the Orbital Fury thermal palette.
// Everything is drawn in code. World units: x in frames (columns), y in decks (rows); one deck is DECK times as tall as a frame is wide.
import { C } from './config.js';
import { COLS, ROWS, inHull } from './sim.js';
import { RNG } from './rng.js';

const DECK = 1.35;
const G = '157,255,184';                       // phosphor green
const ROLE = { resident: '#d8ffe4', logistics: '#4db8ff', engineering: '#ffc340', security: '#ff5a4a' };
const SHORT = { corridor: '', lift: 'LIFT', dock: 'BAY', cargo: 'CARGO', quarters: 'QUARTERS', reactor: 'REACTOR',
  engineering: 'ENG', canteen: 'CANTEEN', security: 'SEC', command: 'COMMAND' };

export class Renderer {
  constructor(cv) {
    this.cv = cv; this.g = cv.getContext('2d');
    this.ov = document.createElement('canvas'); this.ov.className = 'ovfx';
    cv.parentNode.insertBefore(this.ov, cv.nextSibling);
    this.floaters = [];
    this.pad = { top: 92, bottom: 150, side: 12 };
    const r = new RNG(7);
    this.stars = Array.from({ length: 160 }, () => ({ x: r.next(), y: r.next(), s: r.range(0.4, 1.4), a: r.range(0.15, 0.6) }));
    this.resize();
  }

  resize() {
    const dpr = this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = this.W = Math.max(320, Math.round(innerWidth * dpr)), H = this.H = Math.max(240, Math.round(innerHeight * dpr));
    this.cv.width = W; this.cv.height = H; this.ov.width = W; this.ov.height = H;
    const narrow = innerWidth < 700, short = innerHeight < 520;
    this.pad = { top: (short ? 56 : narrow ? 112 : 96) * dpr, bottom: (short ? 84 : narrow ? 158 : 148) * dpr, side: 10 * dpr };
    // Fit the hull plus a margin of open space round it (for the ships) into the area between the HUD bars.
    const spanX = COLS + 3, spanY = (ROWS + 2.6) * DECK;
    const cw = Math.min((W - 2 * this.pad.side) / spanX, (H - this.pad.top - this.pad.bottom) / spanY);
    this.cw = Math.max(6 * dpr, cw); this.dh = this.cw * DECK;
    this.ox = (W - COLS * this.cw) / 2;
    this.oy = this.pad.top + ((H - this.pad.top - this.pad.bottom) - ROWS * this.dh) / 2;
    this._overlay();
    this._outline = null;
  }

  sx(x) { return this.ox + x * this.cw; }
  sy(y) { return this.oy + y * this.dh; }
  // Screen pixel (CSS px) to the cell under it.
  cellAt(px, py) {
    const x = (px * this.dpr - this.ox) / this.cw, y = (py * this.dpr - this.oy) / this.dh;
    return { c: Math.floor(x), r: Math.floor(y), fx: x, fy: y };
  }

  float(x, y, text, col) { this.floaters.push({ x, y, text, col, t: 0 }); }

  _overlay() {
    const { W, H, dpr } = this, c = this.ov.getContext('2d');
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(0,0,0,0.20)';
    const gap = Math.max(3, Math.round(3 * dpr));
    for (let y = 0; y < H; y += gap) c.fillRect(0, y, W, Math.max(1, Math.round(dpr)));
    const n = document.createElement('canvas'); n.width = n.height = 128;
    const nc = n.getContext('2d'), id = nc.createImageData(128, 128), r = new RNG(3);
    for (let i = 0; i < id.data.length; i += 4) { const v = r.next() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    nc.putImageData(id, 0, 0);
    c.globalAlpha = 0.04; c.fillStyle = c.createPattern(n, 'repeat'); c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = `rgba(${G},0.5)`; c.lineWidth = Math.max(1, dpr * 1.5);
    const m = 8 * dpr, l = 26 * dpr;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
      c.beginPath(); c.moveTo(x, y + l * sy); c.lineTo(x, y); c.lineTo(x + l * sx, y); c.stroke();
    }
  }

  // ---------------------------------------------------------------- frame
  draw(st, ui, now, dt) {
    const g = this.g, { W, H, cw, dh, dpr } = this;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    this._space(g, now);
    this._grid(g);
    this._hull(g, st);
    for (const m of st.mods.values()) this._module(g, st, m, now, ui);
    this._ghost(g, st, ui);
    for (const s of st.ships) this._ship(g, st, s, now);
    for (const a of st.agents) this._agent(g, a);
    this._floaters(g, dt);
    if (ui.hover && ui.hover.mod) {
      const m = ui.hover.mod;
      g.strokeStyle = '#fff'; g.lineWidth = 1.5 * dpr;
      g.strokeRect(this.sx(m.col) + 1, this.sy(m.row) + 1, m.w * cw - 2, dh - 2);
    }
  }

  _space(g, now) {
    const { W, H, dpr } = this;
    for (const s of this.stars) {
      const x = ((s.x * W + now * 2 * dpr * s.s) % W), y = s.y * H;
      g.fillStyle = `rgba(${G},${s.a})`; g.fillRect(x, y, s.s * dpr, s.s * dpr);
    }
    // The planet below, drawn as a survey contour plot.
    const cx = W * 0.72, cy = H + H * 0.62, R = H * 0.95;
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = 'rgba(10,40,22,0.55)'; g.fill();
    g.clip();
    g.strokeStyle = `rgba(${G},0.10)`; g.lineWidth = dpr;
    for (let i = 1; i < 9; i++) { g.beginPath(); g.ellipse(cx - R * 0.2, cy - R * 0.55, R * 0.12 * i, R * 0.05 * i, -0.2, 0, Math.PI * 2); g.stroke(); }
    g.restore();
    g.beginPath(); g.arc(cx, cy, R, Math.PI * 1.08, Math.PI * 1.92); g.strokeStyle = `rgba(${G},0.35)`; g.lineWidth = 1.5 * dpr; g.stroke();
  }

  _grid(g) {
    const { cw, dh, dpr } = this;
    g.lineWidth = dpr;
    for (let c = -3; c <= COLS + 3; c++) {
      g.strokeStyle = c % 4 === 0 ? `rgba(${G},0.07)` : `rgba(${G},0.035)`;
      g.beginPath(); g.moveTo(this.sx(c), this.sy(-1.6)); g.lineTo(this.sx(c), this.sy(ROWS + 1.6)); g.stroke();
    }
    for (let r = -1; r <= ROWS + 1; r++) {
      g.strokeStyle = `rgba(${G},0.05)`;
      g.beginPath(); g.moveTo(this.sx(-3), this.sy(r)); g.lineTo(this.sx(COLS + 3), this.sy(r)); g.stroke();
    }
    // Frame numbers above, deck names to the left: the drawing's dimensioning.
    const fs = Math.max(8 * dpr, Math.min(11 * dpr, cw * 0.32));
    g.font = `${fs}px ui-monospace, Menlo, Consolas, monospace`; g.textAlign = 'center'; g.fillStyle = `rgba(${G},0.45)`;
    for (let c = 0; c < COLS; c += 2) g.fillText(`F${String(c + 1).padStart(2, '0')}`, this.sx(c + 0.5), this.sy(-1.15));
    g.textAlign = 'right';
    for (let r = 0; r < ROWS; r++) {
      const a = C.hull.rows[r][0];
      g.fillText(`DECK ${r + 1}`, this.sx(a) - cw * 0.35, this.sy(r + 0.62));
    }
    // A dimension line under the hull.
    g.strokeStyle = `rgba(${G},0.35)`; g.beginPath();
    const y = this.sy(ROWS + 1.15), x0 = this.sx(3), x1 = this.sx(29);
    g.moveTo(x0, y); g.lineTo(x1, y); g.moveTo(x0, y - 4 * dpr); g.lineTo(x0, y + 4 * dpr); g.moveTo(x1, y - 4 * dpr); g.lineTo(x1, y + 4 * dpr); g.stroke();
    g.textAlign = 'center'; g.fillStyle = `rgba(${G},0.5)`;
    g.fillText(`${C.hull.name.toUpperCase()}  ·  26 FRAMES  ·  6 DECKS`, (x0 + x1) / 2, y - 5 * dpr);
  }

  _hull(g, st) {
    const { cw, dh, dpr } = this;
    // Hull cells, with the parts outside the permit hatched.
    for (let r = 0; r < ROWS; r++) {
      const [a, b] = C.hull.rows[r];
      g.fillStyle = 'rgba(14,48,26,0.42)';
      g.fillRect(this.sx(a), this.sy(r), (b - a + 1) * cw, dh);
      for (let c = a; c <= b; c++) {
        if (st.permitted(c, r)) continue;
        g.save(); g.beginPath(); g.rect(this.sx(c), this.sy(r), cw, dh); g.clip();
        g.strokeStyle = `rgba(${G},0.10)`; g.lineWidth = dpr;
        for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(this.sx(c) + k * cw * 0.5, this.sy(r + 1)); g.lineTo(this.sx(c) + k * cw * 0.5 + dh, this.sy(r)); g.stroke(); }
        g.restore();
      }
    }
    // Deck plates: a thin line under each deck.
    g.strokeStyle = `rgba(${G},0.22)`; g.lineWidth = dpr;
    for (let r = 0; r < ROWS - 1; r++) {
      const a = Math.max(C.hull.rows[r][0], C.hull.rows[r + 1][0]), b = Math.min(C.hull.rows[r][1], C.hull.rows[r + 1][1]) + 1;
      g.beginPath(); g.moveTo(this.sx(a), this.sy(r + 1)); g.lineTo(this.sx(b), this.sy(r + 1)); g.stroke();
    }
    // The hull outline: every edge between a hull cell and open space, drawn twice for the double line of a drawing.
    g.lineCap = 'square';
    for (const [w, a] of [[3.2, 0.12], [1.6, 0.9]]) {
      g.strokeStyle = `rgba(${G},${a})`; g.lineWidth = w * dpr; g.beginPath();
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!inHull(c, r)) continue;
        const x = this.sx(c), y = this.sy(r);
        if (!inHull(c, r - 1)) { g.moveTo(x, y); g.lineTo(x + cw, y); }
        if (!inHull(c, r + 1)) { g.moveTo(x, y + dh); g.lineTo(x + cw, y + dh); }
        if (!inHull(c - 1, r)) { g.moveTo(x, y); g.lineTo(x, y + dh); }
        if (!inHull(c + 1, r)) { g.moveTo(x + cw, y); g.lineTo(x + cw, y + dh); }
      }
      g.stroke();
    }
    // The permit boundary.
    if (!st.permitAll) {
      const { c0, c1 } = C.hull.permit;
      g.setLineDash([6 * dpr, 4 * dpr]); g.strokeStyle = 'rgba(255,230,0,0.75)'; g.lineWidth = 1.5 * dpr;
      g.strokeRect(this.sx(c0) - 3 * dpr, this.sy(0) - 3 * dpr, (c1 - c0 + 1) * cw + 6 * dpr, ROWS * dh + 6 * dpr);
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,230,0,0.85)'; g.textAlign = 'left';
      g.font = `${Math.max(8 * dpr, cw * 0.28)}px ui-monospace, Menlo, Consolas, monospace`;
      g.fillText('PERMITTED SECTION', this.sx(c0) - 2 * dpr, this.sy(ROWS) + Math.max(12 * dpr, cw * 0.48));
    }
  }

  _module(g, st, m, now, ui) {
    const { cw, dh, dpr } = this, d = C.mods[m.type];
    const x = this.sx(m.col) + 1.5 * dpr, y = this.sy(m.row) + 1.5 * dpr, w = m.w * cw - 3 * dpr, h = dh - 3 * dpr;
    const building = m.state === 'building', dem = m.state === 'demolish';
    const dark = !building && !m.connected;
    const flick = st.eff < 1 && !building && d.pw > 0 && Math.sin(now * 23 + m.id) > 0.6 ? 0.45 : 1;
    g.save();
    g.globalAlpha = (dark ? 0.45 : 1) * flick;
    if (m.type === 'corridor') {
      g.fillStyle = 'rgba(30,80,45,0.35)'; g.fillRect(x, y + h * 0.55, w, h * 0.45);
      g.strokeStyle = `rgba(${G},${building ? 0.4 : 0.55})`; g.lineWidth = dpr;
      g.setLineDash([3 * dpr, 3 * dpr]); g.beginPath(); g.moveTo(x, y + h * 0.55); g.lineTo(x + w, y + h * 0.55); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w, y + h); g.stroke();
    } else {
      g.fillStyle = m.type === 'command' ? 'rgba(60,55,0,0.55)' : 'rgba(8,36,18,0.92)';
      g.fillRect(x, y, w, h);
      if (building) g.setLineDash([4 * dpr, 3 * dpr]);
      g.strokeStyle = m.type === 'command' ? 'rgba(255,230,0,0.9)' : `rgba(${G},${building ? 0.5 : 0.85})`;
      g.lineWidth = (m.type === 'command' ? 1.8 : 1.2) * dpr;
      g.strokeRect(x, y, w, h);
      g.setLineDash([]);
      if (!building) this._icon(g, st, m, x, y, w, h, now);
      const label = SHORT[m.type] + (m.type === 'command' ? '' : ` ${m.n}`);
      const fs = Math.max(7 * dpr, Math.min(11 * dpr, cw * 0.26));
      g.font = `${fs}px ui-monospace, Menlo, Consolas, monospace`; g.textAlign = 'left';
      g.fillStyle = m.type === 'command' ? 'rgba(255,230,0,0.95)' : `rgba(${G},0.9)`;
      if (w > fs * 3) g.fillText(m.w === 1 && label.length > 5 ? label.split(' ')[0] : label, x + 3 * dpr, y + fs + 1 * dpr);
    }
    g.restore();
    // Status marks over the top.
    const fs = Math.max(7 * dpr, Math.min(10 * dpr, cw * 0.24));
    g.font = `bold ${fs}px ui-monospace, Menlo, Consolas, monospace`; g.textAlign = 'center';
    if (building || dem) {
      g.fillStyle = dem ? 'rgba(255,90,74,0.25)' : 'rgba(157,255,184,0.18)';
      g.fillRect(x, y + h - 4 * dpr, w * (dem ? 1 - m.prog : m.prog), 4 * dpr);
      g.fillStyle = dem ? '#ff7a6a' : `rgba(${G},0.9)`;
      if (dem) { g.setLineDash([4 * dpr, 3 * dpr]); g.strokeStyle = '#ff5a4a'; g.lineWidth = 1.2 * dpr; g.strokeRect(x, y, w, h); g.setLineDash([]); }
      if (w > fs * 5) g.fillText(dem ? 'TEARDOWN' : 'BUILDING', x + w / 2, y + h / 2 + fs * 0.35);
    } else if (m.fault) {
      const blink = Math.sin(now * 8) > 0;
      g.strokeStyle = blink ? '#ffb020' : 'rgba(255,176,32,0.4)'; g.lineWidth = 2 * dpr; g.strokeRect(x, y, w, h);
      g.fillStyle = '#ffb020'; g.fillText(m.fixer ? 'REPAIR' : 'FAULT', x + w / 2, y + h - 5 * dpr);
    } else if (!m.connected && m.type !== 'corridor') {
      g.fillStyle = '#ffb020'; if (w > fs * 4) g.fillText('NO ACCESS', x + w / 2, y + h - 5 * dpr); else g.fillText('!', x + w / 2, y + h - 5 * dpr);
    } else if (!m.connected) {
      g.fillStyle = '#ffb020'; g.fillText('!', x + w / 2, y + h * 0.4);
    }
  }

  _icon(g, st, m, x, y, w, h, now) {
    const { dpr } = this, cx = x + w / 2, cy = y + h * 0.58, s = Math.min(w, h);
    g.strokeStyle = `rgba(${G},0.6)`; g.fillStyle = `rgba(${G},0.6)`; g.lineWidth = dpr;
    switch (m.type) {
      case 'lift': {
        g.beginPath(); g.moveTo(x + w * 0.25, y); g.lineTo(x + w * 0.25, y + h); g.moveTo(x + w * 0.75, y); g.lineTo(x + w * 0.75, y + h); g.stroke();
        const k = s * 0.12;
        g.beginPath(); g.moveTo(cx - k, cy - k * 0.6); g.lineTo(cx, cy - k * 1.6); g.lineTo(cx + k, cy - k * 0.6);
        g.moveTo(cx - k, cy + k * 0.6); g.lineTo(cx, cy + k * 1.6); g.lineTo(cx + k, cy + k * 0.6); g.stroke();
        break;
      }
      case 'dock': {
        const e = st.exterior(m);
        g.strokeStyle = 'rgba(255,230,0,0.8)'; g.lineWidth = 1.5 * dpr;
        const occupied = st.ships.some((sh) => sh.dock === m.id && sh.state === 'docked');
        if (e && (e.dir === 'up' || e.dir === 'down')) {
          const yy = e.dir === 'up' ? y + 2 * dpr : y + h - 2 * dpr, k = e.dir === 'up' ? 1 : -1;
          for (const xx of [x + w * 0.22, x + w * 0.78]) { g.beginPath(); g.moveTo(xx - 5 * dpr, yy + k * 8 * dpr); g.lineTo(xx, yy); g.lineTo(xx + 5 * dpr, yy + k * 8 * dpr); g.stroke(); }
        } else if (e) {
          const xx = e.dir === 'left' ? x + 2 * dpr : x + w - 2 * dpr, k = e.dir === 'left' ? 1 : -1;
          for (const yy of [y + h * 0.3, y + h * 0.75]) { g.beginPath(); g.moveTo(xx + k * 8 * dpr, yy - 5 * dpr); g.lineTo(xx, yy); g.lineTo(xx + k * 8 * dpr, yy + 5 * dpr); g.stroke(); }
        }
        if (occupied) { g.fillStyle = 'rgba(255,230,0,0.18)'; g.fillRect(x, y, w, h); }
        break;
      }
      case 'cargo': {
        const n = 6, bw = w / 8, bh = h / 7;
        for (let i = 0; i < n; i++) { const bx = x + w * 0.2 + (i % 3) * bw * 2, by = y + h - bh * (1.4 + Math.floor(i / 3) * 1.3); g.strokeRect(bx, by, bw * 1.6, bh); }
        break;
      }
      case 'quarters': {
        for (let i = 0; i < 3; i++) { const yy = y + h * (0.42 + i * 0.18); g.beginPath(); g.moveTo(x + w * 0.12, yy); g.lineTo(x + w * 0.42, yy); g.moveTo(x + w * 0.58, yy); g.lineTo(x + w * 0.88, yy); g.stroke(); }
        break;
      }
      case 'reactor': {
        const R = s * 0.26, live = !m.fault;
        g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
        if (live) { g.fillStyle = `rgba(157,255,184,${0.25 + 0.15 * Math.sin(now * 3 + m.id)})`; g.beginPath(); g.arc(cx, cy, R * 0.45, 0, Math.PI * 2); g.fill(); }
        const a0 = live ? now * 1.6 : 0;
        g.beginPath(); for (let i = 0; i < 3; i++) { const a = a0 + i * 2.094; g.moveTo(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } g.stroke();
        break;
      }
      case 'engineering': {
        const R = s * 0.2;
        g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
        g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * R * 1.35, cy + Math.sin(a) * R * 1.35); } g.stroke();
        break;
      }
      case 'canteen': {
        g.beginPath(); g.moveTo(x + w * 0.25, cy + s * 0.12); g.lineTo(x + w * 0.75, cy + s * 0.12); g.moveTo(cx, cy + s * 0.12); g.lineTo(cx, y + h - 3 * dpr); g.stroke();
        for (const xx of [x + w * 0.35, x + w * 0.62]) g.strokeRect(xx, cy - s * 0.06, s * 0.08, s * 0.16);
        break;
      }
      case 'security': {
        const k = s * 0.22;
        g.strokeStyle = 'rgba(255,90,74,0.85)';
        g.beginPath(); g.moveTo(cx - k, cy - k); g.lineTo(cx + k, cy - k); g.lineTo(cx + k, cy + k * 0.2); g.lineTo(cx, cy + k * 1.1); g.lineTo(cx - k, cy + k * 0.2); g.closePath(); g.stroke();
        break;
      }
      case 'command': {
        const R = s * 0.22; g.fillStyle = 'rgba(255,230,0,0.85)';
        g.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        g.closePath(); g.fill();
        break;
      }
    }
  }

  _ghost(g, st, ui) {
    if (!ui.tool || !ui.hover || ui.hover.c == null) return;
    const { cw, dh, dpr } = this, { c, r } = ui.hover;
    if (ui.tool === 'demolish') return;
    const d = C.mods[ui.tool], chk = st.canPlace(ui.tool, c, r);
    const x = this.sx(c), y = this.sy(r), w = d.w * cw;
    g.fillStyle = chk.ok ? 'rgba(157,255,184,0.22)' : 'rgba(255,74,74,0.22)'; g.fillRect(x, y, w, dh);
    g.strokeStyle = chk.ok ? '#9dffb8' : '#ff4a4a'; g.lineWidth = 1.5 * dpr; g.setLineDash([5 * dpr, 3 * dpr]); g.strokeRect(x, y, w, dh); g.setLineDash([]);
  }

  _agent(g, a) {
    const { dpr, cw } = this;
    const x = this.sx(a.x), y = this.sy(a.y + 0.86), r = Math.max(1.8 * dpr, cw * 0.085);
    g.fillStyle = ROLE[a.role] || '#fff';
    g.fillRect(x - r * 0.7, y - r * 2.4, r * 1.4, r * 2.4);
    g.beginPath(); g.arc(x, y - r * 3.1, r * 0.8, 0, Math.PI * 2); g.fill();
    if (a.carry) { g.fillStyle = '#ffb020'; g.fillRect(x + r * 0.6, y - r * 2.6, r * 1.8, r * 1.6); }
  }

  _ship(g, st, s, now) {
    const { cw, dpr } = this, x = this.sx(s.x), y = this.sy(s.y), L = cw * (s.kind === 'shuttle' ? 1.1 : 1.8), Wd = cw * (s.kind === 'shuttle' ? 0.55 : 0.7);
    g.save(); g.translate(x, y); g.rotate(s.ang);
    const moving = s.state !== 'docked';
    if (moving) {   // engine glow at the stern
      g.fillStyle = `rgba(255,176,32,${0.5 + 0.3 * Math.sin(now * 30 + s.id)})`;
      g.beginPath(); g.moveTo(-L / 2, -Wd * 0.25); g.lineTo(-L / 2 - cw * 0.45, 0); g.lineTo(-L / 2, Wd * 0.25); g.fill();
    }
    g.fillStyle = 'rgba(6,28,14,0.95)'; g.strokeStyle = s.state === 'hold' ? 'rgba(255,230,0,0.85)' : `rgba(${G},0.9)`; g.lineWidth = 1.2 * dpr;
    g.beginPath();
    if (s.kind === 'shuttle') {
      g.moveTo(L / 2, 0); g.quadraticCurveTo(L * 0.2, -Wd / 2, -L / 2, -Wd / 2.4); g.lineTo(-L / 2, Wd / 2.4); g.quadraticCurveTo(L * 0.2, Wd / 2, L / 2, 0);
    } else {
      g.moveTo(L / 2, 0); g.lineTo(L * 0.3, -Wd / 2); g.lineTo(-L / 2, -Wd / 2); g.lineTo(-L / 2, Wd / 2); g.lineTo(L * 0.3, Wd / 2); g.closePath();
    }
    g.fill(); g.stroke();
    if (s.kind === 'freighter') {   // container blocks, emptying as the crates come off
      const n = s.state === 'docked' ? s.crates : 6;
      g.strokeStyle = `rgba(${G},0.6)`;
      for (let i = 0; i < 6; i++) {
        const bx = -L / 2 + L * 0.06 + (i % 3) * L * 0.22, by = i < 3 ? -Wd * 0.4 : Wd * 0.04;
        if (i < n) { g.fillStyle = 'rgba(255,176,32,0.55)'; g.fillRect(bx, by, L * 0.18, Wd * 0.36); }
        g.strokeRect(bx, by, L * 0.18, Wd * 0.36);
      }
    }
    g.restore();
    if (s.state === 'docked' || s.state === 'hold') {
      g.font = `${Math.max(7 * dpr, cw * 0.22)}px ui-monospace, Menlo, Consolas, monospace`; g.textAlign = 'center';
      g.fillStyle = s.state === 'hold' ? 'rgba(255,230,0,0.8)' : `rgba(${G},0.65)`;
      const label = s.state === 'hold' ? `${s.name.split(' ').slice(1).join(' ')} · WAITING ${Math.max(0, Math.ceil(C.ships.waitSec - s.wait))}s` : '';
      if (label) g.fillText(label.toUpperCase(), x, y + cw * 0.75);
    }
  }

  _floaters(g, dt) {
    const { dpr, cw } = this;
    g.textAlign = 'center'; g.font = `bold ${Math.max(9 * dpr, cw * 0.3)}px ui-monospace, Menlo, Consolas, monospace`;
    for (const f of this.floaters) {
      f.t += dt;
      const a = Math.max(0, 1 - f.t / 1.4);
      g.fillStyle = f.col; g.globalAlpha = a;
      g.fillText(f.text, this.sx(f.x), this.sy(f.y + 0.3) - f.t * 18 * dpr);
    }
    g.globalAlpha = 1;
    this.floaters = this.floaters.filter((f) => f.t < 1.4);
  }
}
