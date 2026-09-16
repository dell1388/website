import { TILE } from '../world/world.js';
import { clamp, angleDelta, TAU } from '../core/rng.js';

const HULL_R = 15;

export class Tank {
  constructor(world) {
    this.world = world;
    this.x = world.spawn.x;
    this.y = world.spawn.y;
    this.angle = world.spawn.angle;      // hull heading
    this.turret = world.spawn.angle;     // turret heading
    this.speed = 0;
    this.vx = 0; this.vy = 0;
    this.treadOffset = 0;
    this.reload = 0;
    this.reloadTime = 0.85;
    this.recoil = 0;
    this.throttle = 0;
    this.turn = 0;
    this.boost = 0;
    this.r = HULL_R;
    this.maxSpeed = 235;
    this.bumped = 0;
  }

  get speed01() { return Math.min(1, Math.abs(this.speed) / this.maxSpeed); }

  update(dt, input, aimWorld) {
    const fwd = input.axis('KeyS', 'KeyW', -input.touch.dy);
    const turn = input.axis('KeyA', 'KeyD', input.touch.dx);
    const boosting = input.down('ShiftLeft') || input.down('ShiftRight');
    this.boost += ((boosting ? 1 : 0) - this.boost) * Math.min(1, dt * 6);
    this.throttle = fwd;
    this.turn = turn;

    const maxS = this.maxSpeed * (1 + this.boost * 0.42);
    const accel = 720 * (1 + this.boost * 0.3);
    if (fwd !== 0) {
      this.speed += fwd * accel * dt;
    } else {
      const drag = 900 * dt;
      this.speed = Math.abs(this.speed) <= drag ? 0 : this.speed - Math.sign(this.speed) * drag;
    }
    this.speed = clamp(this.speed, -maxS * 0.55, maxS);

    // Tanks pivot in place, but turn faster when rolling.
    const rate = (1.75 + Math.min(1, Math.abs(this.speed) / 170) * 0.9) * (1 - this.boost * 0.2);
    this.angle += turn * rate * dt * (this.speed < -5 ? -1 : 1);
    this.angle = (this.angle + TAU * 2) % TAU;

    const nx = Math.cos(this.angle) * this.speed;
    const ny = Math.sin(this.angle) * this.speed;
    this.vx = nx; this.vy = ny;
    this._move(nx * dt, ny * dt);

    this.treadOffset += (this.speed * dt) / 6 + Math.abs(turn) * dt * 7;

    // Turret aim
    if (aimWorld) {
      const want = Math.atan2(aimWorld.y - this.y, aimWorld.x - this.x);
      const d = angleDelta(this.turret, want);
      const step = 6.2 * dt;
      this.turret += clamp(d, -step, step);
    } else {
      const t = (input.down('ArrowRight') || input.down('KeyE') ? 1 : 0) -
                (input.down('ArrowLeft') || input.down('KeyQ') ? 1 : 0);
      this.turret += t * 2.6 * dt;
    }
    this.turret = (this.turret + TAU * 2) % TAU;

    if (this.reload > 0) { this.reload = Math.max(0, this.reload - dt); }
    this.recoil *= Math.pow(0.0006, dt);
    if (this.bumped > 0) { this.bumped -= dt; }
  }

  /** Axis-separated circle-vs-tile resolution. */
  _move(dx, dy) {
    const w = this.world;
    let hit = false;
    this.x += dx;
    if (this._collides()) { this.x -= dx; hit = true; this.speed *= 0.3; }
    this.y += dy;
    if (this._collides()) { this.y -= dy; hit = true; this.speed *= 0.3; }
    // props
    for (const p of w.props) {
      if (p.dead) { continue; }
      const ddx = this.x - p.x, ddy = this.y - p.y;
      const dist = Math.hypot(ddx, ddy);
      const min = this.r + p.r;
      if (dist < min && dist > 0.001) {
        const push = (min - dist);
        this.x += (ddx / dist) * push;
        this.y += (ddy / dist) * push;
        this.speed *= 0.55;
        hit = true;
      }
    }
    if (hit && this.bumped <= 0) { this.bumped = 0.25; }
    return hit;
  }

  _collides() {
    const w = this.world, r = this.r;
    const x0 = Math.floor((this.x - r) / TILE), x1 = Math.floor((this.x + r) / TILE);
    const y0 = Math.floor((this.y - r) / TILE), y1 = Math.floor((this.y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!w.isWall(tx, ty)) { continue; }
        const cx = clamp(this.x, tx * TILE, tx * TILE + TILE);
        const cy = clamp(this.y, ty * TILE, ty * TILE + TILE);
        if ((this.x - cx) ** 2 + (this.y - cy) ** 2 < r * r) { return true; }
      }
    }
    return false;
  }

  canFire() { return this.reload <= 0; }

  fire() {
    this.reload = this.reloadTime;
    this.recoil = 1;
    const mx = this.x + Math.cos(this.turret) * 34;
    const my = this.y + Math.sin(this.turret) * 34;
    // recoil shove
    this.speed -= 28 * Math.cos(angleDelta(this.angle, this.turret));
    return { x: mx, y: my, angle: this.turret };
  }
}
