/** Discrete-key input for the radar page: gimbal on the arrows, everything
 *  else edge-triggered. No mouse aiming needed here. */
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    const blocked = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
    ]);
    addEventListener('keydown', (e) => {
      if (blocked.has(e.code)) { e.preventDefault(); }
      if (e.repeat) { return; }
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  endFrame() { this.pressed.clear(); }
}
