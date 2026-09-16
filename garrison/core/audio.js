import { load, save } from './storage.js';

/**
 * Procedural audio - no asset files. Everything is synthesised with WebAudio,
 * so new sounds are just new little functions on this class.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = load('garrison.muted') === '1';
    this.started = false;
    this.engine = null;
  }

  start() {
    if (this.started) { return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.started = true;
      this._buildEngine();
      this._ambience();
    } catch (e) {
      // Some browsers refuse a context outright. Play on in silence.
      console.warn('[garrison] audio unavailable', e);
      this.ctx = null;
      this.master = null;
      this.engine = null;
      this.started = true;
    }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') { this.ctx.resume(); } }

  toggleMute() {
    this.muted = !this.muted;
    save('garrison.muted', this.muted ? '1' : '0');
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime + 0.15);
    }
    return this.muted;
  }

  _noiseBuffer(sec = 1) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { d[i] = Math.random() * 2 - 1; }
    return buf;
  }

  _buildEngine() {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 42;
    const sub = c.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 21;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 220;
    filt.Q.value = 3;
    const gain = c.createGain();
    gain.gain.value = 0.0;
    osc.connect(filt); sub.connect(filt); filt.connect(gain); gain.connect(this.master);
    osc.start(); sub.start();
    this.engine = { osc, sub, filt, gain };
  }

  /** speed01: 0..1, throttle: 0..1 */
  engineState(speed01, throttle) {
    if (!this.engine) { return; }
    const t = this.ctx.currentTime;
    const f = 34 + speed01 * 46 + throttle * 10;
    this.engine.osc.frequency.setTargetAtTime(f, t, 0.12);
    this.engine.sub.frequency.setTargetAtTime(f / 2, t, 0.12);
    this.engine.filt.frequency.setTargetAtTime(180 + speed01 * 520, t, 0.15);
    this.engine.gain.gain.setTargetAtTime(0.05 + speed01 * 0.075, t, 0.2);
  }

  _ambience() {
    // Soft wind bed: filtered noise, very quiet.
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(4);
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 480; f.Q.value = 0.6;
    const g = this.ctx.createGain(); g.gain.value = 0.025;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 0.015;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(); lfo.start();
  }

  fire() {
    if (!this.ctx) { return; }
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this._noiseBuffer(0.6);
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    const g = c.createGain();
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.55);

    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    const og = c.createGain();
    og.gain.setValueAtTime(0.7, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.4);
  }

  ping(freq = 880, dur = 0.16, type = 'triangle', vol = 0.3) {
    if (!this.ctx) { return; }
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  hit() { this.ping(520, 0.14, 'square', 0.22); this.ping(780, 0.1, 'triangle', 0.16); }
  thud() { this.ping(120, 0.12, 'sine', 0.25); }
  ui() { this.ping(660, 0.07, 'square', 0.12); }

  /** Bright arpeggio when a door opens. */
  fanfare() {
    if (!this.ctx) { return; }
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => this.ping(f, 0.3, 'triangle', 0.26), i * 90);
    });
  }

  denied() { this.ping(180, 0.12, 'sawtooth', 0.18); setTimeout(() => this.ping(140, 0.18, 'sawtooth', 0.15), 90); }
}
