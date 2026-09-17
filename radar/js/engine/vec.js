/**
 * Minimal 3D vector math - a straight port of skysim/vec.py.
 *
 * World frame is a local ENU tangent frame: x=east, y=north, z=up (metres),
 * origin on the surface. This is the exact same convention the rest of the
 * radar game already uses for contact/ownship positions, so no axis
 * conversion is needed anywhere this plugs in.
 */
export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  add(o) { return new Vec3(this.x + o.x, this.y + o.y, this.z + o.z); }
  sub(o) { return new Vec3(this.x - o.x, this.y - o.y, this.z - o.z); }
  scale(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }
  neg() { return new Vec3(-this.x, -this.y, -this.z); }
  dot(o) { return this.x * o.x + this.y * o.y + this.z * o.z; }
  cross(o) {
    return new Vec3(
      this.y * o.z - this.z * o.y,
      this.z * o.x - this.x * o.z,
      this.x * o.y - this.y * o.x,
    );
  }
  get mag2() { return this.dot(this); }
  get mag() { return Math.sqrt(this.mag2); }
  unit() {
    const m = this.mag;
    return m < 1e-12 ? ZERO : this.scale(1 / m);
  }
  clamp(limit) {
    const m = this.mag;
    return (m <= limit || m < 1e-12) ? this : this.scale(limit / m);
  }
  /** Component of self perpendicular to `axis`. */
  perpTo(axis) {
    const a = axis.unit();
    return this.sub(a.scale(this.dot(a)));
  }
  toDict() { return { x: this.x, y: this.y, z: this.z }; }
  static fromAny(v) {
    if (v instanceof Vec3) { return v; }
    if (Array.isArray(v)) { return new Vec3(v[0] || 0, v[1] || 0, v[2] || 0); }
    return new Vec3(v?.x || 0, v?.y || 0, v?.z || 0);
  }
}

export const ZERO = new Vec3(0, 0, 0);
export const EAST = new Vec3(1, 0, 0);
export const NORTH = new Vec3(0, 1, 0);
export const UP = new Vec3(0, 0, 1);
