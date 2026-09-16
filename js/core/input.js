import { TAU } from './rng.js';

/**
 * Keyboard + mouse + touch input. Aim follows the mouse when the mouse is
 * moving, otherwise arrow keys / Q-E rotate the turret (keyboard-only play).
 */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();     // edge-triggered, cleared each frame
    this.mouse = { x: 0, y: 0, inside: false };
    this.fireHeld = false;
    this.aimMode = 'key';         // 'key' | 'mouse'
    this.touch = { active: false, dx: 0, dy: 0, id: null };
    this.enabled = true;
    this._bind();
  }

  _bind() {
    const blocked = new Set([
      'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
    ]);
    addEventListener('keydown', (e) => {
      if (e.repeat) { return; }
      if (blocked.has(e.code)) { e.preventDefault(); }
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
          e.code === 'KeyQ' || e.code === 'KeyE') { this.aimMode = 'key'; }
      if (e.code === 'Space') { this.fireHeld = true; }
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') { this.fireHeld = false; }
    });
    addEventListener('blur', () => { this.keys.clear(); this.fireHeld = false; });

    const toLocal = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.inside = true;
    };
    this.canvas.addEventListener('mousemove', (e) => { toLocal(e); this.aimMode = 'mouse'; });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) { return; }
      toLocal(e); this.aimMode = 'mouse'; this.fireHeld = true;
    });
    addEventListener('mouseup', () => { this.fireHeld = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch: left half = virtual stick, right half = aim + fire.
    this.canvas.addEventListener('touchstart', (e) => this._touch(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this._touch(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this._touch(e), { passive: false });
  }

  _touch(e) {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    let stick = null, aim = null;
    for (const t of e.touches) {
      const x = t.clientX - r.left, y = t.clientY - r.top;
      if (x < r.width * 0.45) {
        if (!this.touch.active) { this.touch.ox = x; this.touch.oy = y; this.touch.active = true; }
        stick = { x, y };
      } else { aim = { x, y }; }
    }
    if (stick) {
      this.touch.dx = (stick.x - this.touch.ox) / 60;
      this.touch.dy = (stick.y - this.touch.oy) / 60;
    } else { this.touch.active = false; this.touch.dx = this.touch.dy = 0; }
    if (aim) { this.mouse.x = aim.x; this.mouse.y = aim.y; this.aimMode = 'mouse'; this.fireHeld = true; }
    else if (e.type !== 'touchstart') { this.fireHeld = false; }
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  /** Axis helper: returns -1 / 0 / 1 plus analogue touch. */
  axis(neg, pos, touchVal = 0) {
    let v = (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
    if (!v && this.touch.active) { v = Math.max(-1, Math.min(1, touchVal)); }
    return v;
  }
  endFrame() { this.pressed.clear(); }
}

export { TAU };
