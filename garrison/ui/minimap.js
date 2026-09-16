import { TILE, FLOOR } from '../world/world.js';
import { TAU } from '../core/rng.js';

/** Small parchment map: static geometry pre-rendered once, markers live. */
export class Minimap {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.g = canvas.getContext('2d');
    this.scale = Math.min(canvas.width / world.W, canvas.height / world.H);
    this.ox = (canvas.width - world.W * this.scale) / 2;
    this.oy = (canvas.height - world.H * this.scale) / 2;
    this.base = document.createElement('canvas');
    this.base.width = canvas.width;
    this.base.height = canvas.height;
    this.ready = !!(this.g && this.base.getContext('2d'));
    if (this.ready) { this._renderBase(); }
    this.acc = 0;
  }

  _renderBase() {
    const g = this.base.getContext('2d');
    if (!g) { return; }
    const w = this.world, s = this.scale;
    g.clearRect(0, 0, this.base.width, this.base.height);
    for (let ty = 0; ty < w.H; ty++) {
      for (let tx = 0; tx < w.W; tx++) {
        const i = ty * w.W + tx;
        if (w.grid[i] !== FLOOR) { continue; }
        const room = w.roomAt[i] >= 0 ? w.rooms[w.roomAt[i]] : null;
        g.fillStyle = room ? (room.hub ? '#e9d4a4' : '#dcc292') : '#c9ab7c';
        g.fillRect(this.ox + tx * s, this.oy + ty * s, Math.ceil(s), Math.ceil(s));
      }
    }
    // room outlines
    for (const r of w.rooms) {
      g.strokeStyle = 'rgba(90,60,32,0.55)';
      g.lineWidth = 1;
      g.strokeRect(this.ox + r.x * s + 0.5, this.oy + r.y * s + 0.5, r.w * s - 1, r.h * s - 1);
    }
  }

  draw(state, dt) {
    if (!this.ready) { return; }
    this.acc += dt;
    if (this.acc < 1 / 20) { return; }
    this.acc = 0;
    const g = this.g, s = this.scale;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.base, 0, 0);

    for (const t of this.world.targets) {
      const x = this.ox + (t.x / TILE) * s, y = this.oy + (t.y / TILE) * s;
      if (t.state === 'done') {
        g.fillStyle = '#6aa84f';
      } else if (t.locked) {
        g.fillStyle = '#9c8f7c';
      } else {
        g.fillStyle = t.visited ? '#3f7a2c' : '#c4503f';
      }
      g.beginPath(); g.arc(x, y, 3.4, 0, TAU); g.fill();
      g.strokeStyle = '#3b2a1b'; g.lineWidth = 1; g.stroke();
    }

    const tk = state.tank;
    const x = this.ox + (tk.x / TILE) * s, y = this.oy + (tk.y / TILE) * s;
    g.save();
    g.translate(x, y);
    g.rotate(tk.angle);
    g.fillStyle = '#3b2a1b';
    g.beginPath(); g.moveTo(5, 0); g.lineTo(-3.5, 3.5); g.lineTo(-3.5, -3.5); g.closePath(); g.fill();
    g.fillStyle = '#f6e3bd';
    g.beginPath(); g.moveTo(3.4, 0); g.lineTo(-2.2, 2.2); g.lineTo(-2.2, -2.2); g.closePath(); g.fill();
    g.restore();
  }
}
