/** Same tiny deterministic PRNG as the tank game - keeps the radar's
 *  practice contacts and terrain features stable across reloads. */
export function makeRng(seed = 1337) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + r() * (hi - lo);
  r.int = (lo, hi) => Math.floor(r.range(lo, hi + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

/** Wrap an angle in degrees to (-180, 180]. */
export function wrapDeg(d) {
  d = d % 360;
  if (d > 180) { d -= 360; }
  if (d <= -180) { d += 360; }
  return d;
}

/** Shortest signed difference b-a in degrees. */
export function deltaDeg(a, b) { return wrapDeg(b - a); }
