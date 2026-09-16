import { TAU } from './rng.js';

/** Flat-array-free but pooled-ish particle system. Cheap and cheerful. */
export class Particles {
  constructor(limit = 900) { this.list = []; this.limit = limit; }

  spawn(o) {
    if (this.list.length >= this.limit) { this.list.shift(); }
    this.list.push({
      x: 0, y: 0, vx: 0, vy: 0, life: 0.6, max: 0.6, size: 4, drag: 0.9,
      color: '#fff', shape: 'square', spin: 0, rot: 0, grav: 0, fade: 1, glow: 0, ...o,
    });
  }

  burst(x, y, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (opts.speed || 120) * (0.35 + Math.random() * 0.9);
      const life = (opts.life || 0.6) * (0.6 + Math.random() * 0.8);
      this.spawn({
        ...opts,
        x, y,
        vx: Math.cos(a) * sp + (opts.vx || 0),
        vy: Math.sin(a) * sp + (opts.vy || 0),
        life, max: life,
        size: (opts.size || 4) * (0.6 + Math.random() * 0.9),
        rot: Math.random() * TAU,
        spin: (Math.random() * 2 - 1) * 8,
        color: Array.isArray(opts.color) ? opts.color[(Math.random() * opts.color.length) | 0] : opts.color,
      });
    }
  }

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l.splice(i, 1); continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  draw(g) {
    for (const p of this.list) {
      const t = p.life / p.max;
      g.globalAlpha = Math.min(1, t * p.fade + (1 - p.fade));
      const s = p.size * (p.shape === 'smoke' ? (2 - t) : t * 0.6 + 0.4);
      g.save();
      g.translate(p.x, p.y);
      if (p.glow) { g.shadowColor = p.color; g.shadowBlur = p.glow; }
      g.fillStyle = p.color;
      if (p.shape === 'square') {
        g.rotate(p.rot);
        g.fillRect(-s / 2, -s / 2, s, s);
      } else if (p.shape === 'spark') {
        g.rotate(p.rot);
        g.fillRect(-s * 1.6, -s * 0.28, s * 3.2, s * 0.56);
      } else {
        g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
      }
      g.restore();
    }
    g.globalAlpha = 1;
    g.shadowBlur = 0;
  }
}
