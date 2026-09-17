import { makeRng } from '../core/rng.js';
import { relativeTo, KM } from '../sim/world.js';

/**
 * A handful of fixed terrain polylines in world space (coastlines / ridge
 * lines), generated once. They register correctly under the B-scope as the
 * ownship actually moves - not a scrolling illusion, a real re-projection
 * of fixed ground each frame - which is the point: the picture moves
 * because you do.
 */
export function buildTerrain() {
  const rng = makeRng(240915);
  const features = [];
  for (let i = 0; i < 14; i++) {
    const pts = [];
    let x = rng.range(-140, 140) * KM;
    let y = rng.range(-40, 220) * KM;
    for (let k = 0; k < 16; k++) {
      pts.push({ x, y });
      x += rng.range(-6, 6) * KM;
      y += rng.range(4, 10) * KM;
    }
    features.push({ pts, sea: i % 4 === 0 });
  }
  return features;
}

/** Project a terrain feature into the ownship's current az/range frame. */
export function* projectFeature(own, feature, maxRangeKm, azLimit) {
  for (const p of feature.pts) {
    const rel = relativeTo(own, p);
    const inRange = rel.rangeKm > 0.5 && rel.rangeKm <= maxRangeKm && Math.abs(rel.az) <= azLimit;
    yield inRange ? rel : null;
  }
}
