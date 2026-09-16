const SPEED = 880;
const LIFE = 2.2;

export class Bullets {
  constructor(world) { this.world = world; this.list = []; }

  spawn(x, y, angle) {
    this.list.push({
      x, y, px: x, py: y,
      vx: Math.cos(angle) * SPEED, vy: Math.sin(angle) * SPEED,
      angle, life: LIFE, trail: 0,
    });
  }

  /** onWall(x,y,normalAngle) / onProp(prop,b) / onTarget(target,b) */
  update(dt, { onWall, onProp, onTarget, onTrail }) {
    const w = this.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.life -= dt;
      if (b.life <= 0) { this.list.splice(i, 1); continue; }
      b.px = b.x; b.py = b.y;
      // sub-step so fast shells cannot tunnel through a 40px wall
      const steps = 3;
      let removed = false;
      for (let s = 0; s < steps && !removed; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;

        for (const t of w.targets) {
          if (t.state === 'done' || t.dead) { continue; }
          if (Math.hypot(b.x - t.x, b.y - t.y) < t.r) {
            onTarget && onTarget(t, b); this.list.splice(i, 1); removed = true; break;
          }
        }
        if (removed) { break; }

        for (const p of w.props) {
          if (p.dead) { continue; }
          if (Math.hypot(b.x - p.x, b.y - p.y) < p.r) {
            onProp && onProp(p, b); this.list.splice(i, 1); removed = true; break;
          }
        }
        if (removed) { break; }

        if (w.isWallPx(b.x, b.y)) {
          const nx = w.isWallPx(b.x, b.py) ? -1 : 1;
          onWall && onWall(b.x, b.y, Math.atan2(nx > 0 ? -b.vy : 0, -b.vx));
          this.list.splice(i, 1); removed = true; break;
        }
      }
      if (!removed) {
        b.trail -= dt;
        if (b.trail <= 0) { b.trail = 0.02; onTrail && onTrail(b); }
      }
    }
  }
}

export { SPEED as BULLET_SPEED };
