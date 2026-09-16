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
    this._run(mod, 'init', () => mod.init(this.ctx));
    return mod;
  }

  addAll(list) { list.forEach((m) => this.add(m)); return this; }

  /**
   * A module that throws is dropped rather than allowed to take the frame
   * loop with it - a broken decoration should never cost you the website.
   */
  _run(mod, hook, fn) {
    if (!mod[hook] || mod.__dead) { return; }
    try {
      fn();
    } catch (e) {
      mod.__dead = true;
      console.warn(`[garrison] module "${mod.id}" disabled after an error in ${hook}()`, e);
    }
  }

  update(dt) {
    for (const m of this.mods) { this._run(m, 'update', () => m.update(dt, this.ctx)); }
  }

  drawWorld(g) {
    for (const m of this.mods) {
      this._run(m, 'drawWorld', () => { g.save(); try { m.drawWorld(g, this.ctx); } finally { g.restore(); } });
    }
  }

  drawUI(g) {
    for (const m of this.mods) {
      this._run(m, 'drawUI', () => { g.save(); try { m.drawUI(g, this.ctx); } finally { g.restore(); } });
    }
  }

  emit(event, data) {
    for (const m of this.mods) { this._run(m, 'on', () => m.on(event, data, this.ctx)); }
  }
}
