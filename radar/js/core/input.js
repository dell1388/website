/** Discrete-key input for the radar page: gimbal on the arrows, the pipper
 *  on WASD, everything else edge-triggered. No mouse aiming needed here. */
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.alt = false;
    const blocked = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
    ]);
    addEventListener('keydown', (e) => {
      if (blocked.has(e.code)) { e.preventDefault(); }
      if (e.key === 'Alt') { this.alt = true; }
      if (e.repeat) { return; }
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => {
      if (e.key === 'Alt') { this.alt = false; }
      this.keys.delete(e.code);
    });
    addEventListener('blur', () => { this.keys.clear(); this.alt = false; });
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  /** Zero while Alt is held, so an Alt+letter shortcut doesn't also drive
   *  whatever that same letter controls unmodified (e.g. Alt+S vs S). */
  axis(neg, pos) {
    if (this.alt) { return 0; }
    return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
  }
  endFrame() { this.pressed.clear(); }
}
