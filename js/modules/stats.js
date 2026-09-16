import { loadJSON, saveJSON } from '../core/storage.js';

/** Tracks shots, hits and rooms opened; feeds the HUD accuracy readout. */
export default {
  id: 'stats',
  data: { shots: 0, hits: 0, opened: 0, distance: 0 },

  init(ctx) {
    const saved = loadJSON('garrison.stats');
    if (saved) { this.data = { ...this.data, ...saved }; }
    ctx.stats = this.data;
  },

  update(dt, ctx) {
    this.data.distance += Math.abs(ctx.tank.speed) * dt;
  },

  on(ev, data, ctx) {
    if (ev === 'fire') { this.data.shots++; }
    if (ev === 'target:hit' || ev === 'prop:destroyed') { this.data.hits++; }
    if (ev === 'target:destroyed') { this.data.opened++; this._save(); }
    if (ev === 'pause') { this._save(); }
  },

  _save() { saveJSON('garrison.stats', this.data); },
};
