import { TILE } from '../world/world.js';
import { P } from '../render/palette.js';
import { load, save } from '../core/storage.js';

/** Contextual floating hint above the nearest target, plus first-run coaching. */
export default {
  id: 'hints',
  shotFired: false,
  moved: false,
  t: 0,

  init() { this.seen = load('garrison.seenHints') === '1'; },

  update(dt, ctx) {
    this.t += dt;
    if (Math.abs(ctx.tank.speed) > 40) { this.moved = true; }
    if (this.moved && this.shotFired && !this.seen) {
      this.seen = true;
      save('garrison.seenHints', '1');
    }
  },

  on(ev) { if (ev === 'fire') { this.shotFired = true; } },

  drawWorld(g, ctx) {
    const { tank, world } = ctx;
    let best = null, bestD = 260;
    for (const t of world.targets) {
      if (t.state === 'done') { continue; }
      const d = Math.hypot(t.x - tank.x, t.y - tank.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) { return; }
    const alpha = Math.max(0, Math.min(1, (260 - bestD) / 90));
    g.globalAlpha = alpha * 0.95;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '11px "VT323", ui-monospace, monospace';
    const msg = best.locked ? best.locked : (best.blurb || 'SHOOT TO ENTER');
    const sub = best.locked ? 'sealed for now' : 'shoot the target to enter';

    const y = best.y + 46;
    g.font = '16px "VT323", ui-monospace, monospace';
    const w = Math.max(g.measureText(msg).width, g.measureText(sub).width) + 28;
    g.fillStyle = 'rgba(48,32,18,0.82)';
    g.beginPath();
    if (g.roundRect) { g.roundRect(best.x - w / 2, y, w, 44, 8); } else { g.rect(best.x - w / 2, y, w, 44); }
    g.fill();
    g.strokeStyle = 'rgba(246,227,189,0.35)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = P.cream;
    g.fillText(msg, best.x, y + 15);
    g.fillStyle = best.locked ? '#d8b36a' : '#a9c98a';
    g.font = '15px "VT323", ui-monospace, monospace';
    g.fillText(sub.toUpperCase(), best.x, y + 32);
    g.globalAlpha = 1;
  },
};
