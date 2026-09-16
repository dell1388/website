/**
 * MODULE SYSTEM
 * =============
 * A module is a plain object with any of these optional hooks:
 *
 *   { id, init(ctx), update(dt, ctx), drawWorld(g, ctx), drawUI(g, ctx),
 *     on(event, data, ctx) }
 *
 * `drawWorld` runs inside the camera transform (world coordinates),
 * `drawUI` runs in screen coordinates on top of everything.
 *
 * Events currently emitted by the game:
 *   'start', 'fire', 'target:hit', 'target:destroyed', 'target:locked',
 *   'prop:destroyed', 'room:enter', 'wall:hit', 'pause', 'resume'
 *
 * Register new modules in js/modules/index.js - nothing else to wire up.
 */
export class Registry {
  constructor(ctx) { this.ctx = ctx; this.mods = []; }

  add(mod) {
    if (!mod || !mod.id) { return; }
    this.mods.push(mod);
    if (mod.init) { try { mod.init(this.ctx); } catch (e) { console.warn('[module]', mod.id, e); } }
    return mod;
  }

  addAll(list) { list.forEach((m) => this.add(m)); return this; }

  update(dt) {
    for (const m of this.mods) { if (m.update) { m.update(dt, this.ctx); } }
  }

  drawWorld(g) {
    for (const m of this.mods) { if (m.drawWorld) { g.save(); m.drawWorld(g, this.ctx); g.restore(); } }
  }

  drawUI(g) {
    for (const m of this.mods) { if (m.drawUI) { g.save(); m.drawUI(g, this.ctx); g.restore(); } }
  }

  emit(event, data) {
    for (const m of this.mods) { if (m.on) { m.on(event, data, this.ctx); } }
  }
}
