import { makeRng, TAU } from '../core/rng.js';

/** Floating pollen motes + fireflies. Pure decoration, safe to delete. */
const rng = makeRng(4242);

export default {
  id: 'ambience',
  motes: [],

  init(ctx) {
    const w = ctx.world;
    for (let i = 0; i < 90; i++) {
      this.motes.push({
        x: rng.range(0, w.pxW), y: rng.range(0, w.pxH),
        z: rng.range(0.4, 1), phase: rng.range(0, TAU),
        speed: rng.range(6, 22), size: rng.range(1.6, 3.6),
        firefly: rng.chance(0.25),
      });
    }
  },

  update(dt, ctx) {
    const w = ctx.world;
    for (const m of this.motes) {
      m.phase += dt * (0.6 + m.z);
      m.x += Math.cos(m.phase * 0.7) * m.speed * dt + 8 * dt;
      m.y += Math.sin(m.phase) * m.speed * dt * 0.6;
      if (m.x > w.pxW) { m.x = 0; }
      if (m.x < 0) { m.x = w.pxW; }
      if (m.y > w.pxH) { m.y = 0; }
      if (m.y < 0) { m.y = w.pxH; }
    }
  },

  drawWorld(g, ctx) {
    const v = ctx.camera.view();
    const t = ctx.time;
    for (const m of this.motes) {
      if (m.x < v.x0 - 20 || m.x > v.x1 + 20 || m.y < v.y0 - 20 || m.y > v.y1 + 20) { continue; }
      const twinkle = 0.45 + Math.sin(t * 3 + m.phase) * 0.45;
      if (m.firefly) {
        g.globalAlpha = 0.5 * twinkle;
        g.fillStyle = '#ffe9a0';
        g.beginPath(); g.arc(m.x, m.y, m.size * 2.6, 0, TAU); g.fill();
        g.globalAlpha = twinkle;
        g.fillStyle = '#fff8d4';
        g.beginPath(); g.arc(m.x, m.y, m.size * 0.8, 0, TAU); g.fill();
      } else {
        g.globalAlpha = 0.28 * twinkle * m.z;
        g.fillStyle = '#fff3d0';
        g.beginPath(); g.arc(m.x, m.y, m.size, 0, TAU); g.fill();
      }
    }
    g.globalAlpha = 1;
  },
};
