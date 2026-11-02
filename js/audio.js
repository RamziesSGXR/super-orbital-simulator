// Synthesised sound, built the same way as Orbital Fury's: noise and oscillators, no audio files.
export class Audio {
  constructor() { this.ctx = null; this.master = null; this.muted = false; this.last = {}; this.noise = null; }

  // Browsers only allow audio after a user gesture, so this is called from a click or tap.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.45; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      let s = 12345; for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
      this.noise = buf;
    } catch { this.ctx = null; }
  }
  mute(on) { this.muted = on; if (this.master) this.master.gain.value = on ? 0 : 0.45; }
  _ok(key, gap) { if (!this.ctx) return false; const t = this.ctx.currentTime; if (t - (this.last[key] || -9) < gap) return false; this.last[key] = t; return true; }
  _tone(f0, f1, dur, gain, type = 'sine', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.012, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  _noise(dur, f0, f1, gain, type = 'lowpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; src.loop = true; f.type = type;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur + 0.05);
  }

  play(key) {
    if (!this.ctx || this.muted) return;
    switch (key) {
      case 'click': if (this._ok(key, 0.04)) this._tone(1400, 1100, 0.04, 0.05, 'square'); break;
      case 'place': if (this._ok(key, 0.05)) { this._noise(0.12, 900, 200, 0.25); this._tone(160, 90, 0.12, 0.2, 'triangle'); } break;
      case 'built': if (this._ok(key, 0.2)) { this._tone(520, 520, 0.08, 0.08, 'square'); this._tone(780, 780, 0.1, 0.08, 'square', 0.09); } break;
      case 'deny': if (this._ok(key, 0.15)) this._tone(220, 160, 0.14, 0.12, 'sawtooth'); break;
      case 'dock': if (this._ok(key, 0.3)) { this._tone(90, 60, 0.25, 0.3, 'triangle'); this._noise(0.5, 3000, 400, 0.12, 'highpass', 0.08); } break;
      case 'crate': if (this._ok(key, 0.12)) { this._tone(1760, 1760, 0.05, 0.03, 'sine'); this._tone(2640, 2640, 0.06, 0.025, 'sine', 0.04); } break;
      case 'fault': if (this._ok(key, 1)) { this._tone(660, 660, 0.12, 0.1, 'square'); this._tone(440, 440, 0.16, 0.1, 'square', 0.15); } break;
      case 'fixed': if (this._ok(key, 0.5)) this._tone(400, 900, 0.18, 0.08, 'triangle'); break;
      case 'caught': if (this._ok(key, 0.5)) { this._tone(880, 880, 0.07, 0.08, 'square'); this._tone(1175, 1175, 0.12, 0.08, 'square', 0.08); } break;
      case 'contraband': if (this._ok(key, 0.8)) this._tone(140, 90, 0.5, 0.12, 'sawtooth'); break;
      case 'lost': if (this._ok(key, 0.8)) this._tone(500, 200, 0.4, 0.08, 'triangle'); break;
      case 'comms': if (this._ok(key, 0.6)) { this._noise(0.07, 2400, 1800, 0.05, 'bandpass'); this._tone(1320, 1320, 0.05, 0.035, 'sine', 0.07); } break;
      case 'milestone': if (this._ok(key, 2)) [523, 659, 784, 1047].forEach((f, i) => this._tone(f, f, 0.22, 0.12, 'square', i * 0.12)); break;
    }
  }
}
