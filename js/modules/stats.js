/** Tracks shots, hits and rooms opened; feeds the HUD accuracy readout. */
export default {
  id: 'stats',
  data: { shots: 0, hits: 0, opened: 0, distance: 0 },

  init(ctx) {
    try {
      const saved = JSON.parse(localStorage.getItem('garrison.stats') || 'null');
      if (saved) { this.data = { ...this.data, ...saved }; }
    } catch (e) { /* ignore */ }
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

  _save() {
    try { localStorage.setItem('garrison.stats', JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
};
