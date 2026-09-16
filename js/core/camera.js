import { clamp, lerp } from './rng.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.shake = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.bounds = null;           // {w,h} in world px
    this.viewW = 1; this.viewH = 1;
  }

  kick(amount) { this.shake = Math.min(24, this.shake + amount); }

  follow(tx, ty, dt) {
    const k = 1 - Math.pow(0.0015, dt);
    this.x = lerp(this.x, tx, k);
    this.y = lerp(this.y, ty, k);
    this.zoom = lerp(this.zoom, this.targetZoom, 1 - Math.pow(0.05, dt));
    this.shake *= Math.pow(0.0025, dt);
    if (this.shake < 0.05) { this.shake = 0; }
    const s = this.shake;
    this.shakeX = (Math.random() * 2 - 1) * s;
    this.shakeY = (Math.random() * 2 - 1) * s;
    if (this.bounds) {
      const hw = this.viewW / (2 * this.zoom), hh = this.viewH / (2 * this.zoom);
      this.x = this.bounds.w <= hw * 2 ? this.bounds.w / 2 : clamp(this.x, hw, this.bounds.w - hw);
      this.y = this.bounds.h <= hh * 2 ? this.bounds.h / 2 : clamp(this.y, hh, this.bounds.h - hh);
    }
  }

  apply(g) {
    g.translate(this.viewW / 2 + this.shakeX, this.viewH / 2 + this.shakeY);
    g.scale(this.zoom, this.zoom);
    g.translate(-this.x, -this.y);
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.viewW / 2 - this.shakeX) / this.zoom + this.x,
      y: (sy - this.viewH / 2 - this.shakeY) / this.zoom + this.y,
    };
  }

  view() {
    const hw = this.viewW / (2 * this.zoom), hh = this.viewH / (2 * this.zoom);
    return { x0: this.x - hw, y0: this.y - hh, x1: this.x + hw, y1: this.y + hh };
  }
}
