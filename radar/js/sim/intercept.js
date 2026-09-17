/**
 * Projected-intercept calculator: "if I fired this weapon at this target
 * right now, would it connect - and where?" It runs the exact same
 * boost/coast speed profile and G-limited proportional guidance as a real
 * missile (see missile.js), just against a target whose future position is
 * extrapolated from its CURRENT velocity rather than looked up live each
 * step - a straightforward constant-velocity forecast, not a claim the
 * target will actually fly that path. That's enough to turn "relative
 * velocity + missile telemetry" into a simple 3D forward simulation: at
 * each step, advance the hypothetical target by its velocity, then run one
 * physics step of the same guidance math a live round uses, and check the
 * same fuze radius for a hit.
 */
import { MISSILES, FUZE_RADIUS_M } from './weapons.js';
import { DEG, RAD, wrapDeg, clamp } from '../core/rng.js';
import { relativeTo } from './world.js';
import { machToMps } from '../core/atmos.js';
import { G_MPS2, DRAG_EASE, pointToSegmentDist3D } from './missile.js';

const STEP_SEC = 0.15;

/** Constant-velocity estimate of a contact's current motion, in m/s. Air
 *  contacts fly a fixed heading/mach; everything else (including a
 *  ground_mover's leashed wander) is treated as stationary - the wander has
 *  no net drift, so zero is the right forecast for it. */
function contactVelocity(c) {
  if (c.kind === 'air') {
    const spd = machToMps(c.mach, c.altM);
    const h = c.headingDeg * DEG;
    return { vx: Math.sin(h) * spd, vy: Math.cos(h) * spd, vz: 0 };
  }
  return { vx: 0, vy: 0, vz: 0 };
}

/**
 * Simulates a hypothetical `weaponId` launch at `target` from the current
 * world state. Returns:
 *   { hit, t, point: {x,y,altM} }
 * `point` is the intercept point if `hit`, otherwise the round's position
 * at the moment its flight-time timer would run out (where it would
 * self-destruct) - useful either way as a "reach" cue on the scopes.
 */
export function simulateIntercept(world, weaponId, target) {
  const w = MISSILES[weaponId];
  const own = world.own;
  const rel = relativeTo(own, target);
  const vel = contactVelocity(target);

  let mx = own.x, my = own.y, malt = own.altM;
  let headingDeg = own.headingDeg + rel.az;
  let pitchDeg = rel.el;
  let speed = w.launchMps;
  let t = 0;
  let tx = target.x, ty = target.y, tz = target.altM;

  while (t < w.maxFlightSec) {
    t += STEP_SEC;
    if (t <= w.boostSec) {
      speed = w.launchMps + w.boostMps2 * t;
    } else {
      speed += (w.cruiseMps - speed) * DRAG_EASE * STEP_SEC;
    }

    tx += vel.vx * STEP_SEC; ty += vel.vy * STEP_SEC; tz += vel.vz * STEP_SEC;

    const dx = tx - mx, dy = ty - my, dz = tz - malt;
    const groundDist = Math.hypot(dx, dy);
    const wantHeading = Math.atan2(dx, dy) * RAD;
    const wantPitch = Math.atan2(dz, groundDist) * RAD;

    const maxTurnDegPerSec = (w.maxGTurn * G_MPS2 / Math.max(speed, 1)) * RAD;
    const step = maxTurnDegPerSec * STEP_SEC;
    headingDeg = wrapDeg(headingDeg + clamp(wrapDeg(wantHeading - headingDeg), -step, step));
    pitchDeg = clamp(pitchDeg + clamp(wantPitch - pitchDeg, -step, step), -85, 85);

    const hRad = headingDeg * DEG, pRad = pitchDeg * DEG;
    const stepM = speed * STEP_SEC;
    const oldX = mx, oldY = my, oldAlt = malt;
    mx += Math.sin(hRad) * Math.cos(pRad) * stepM;
    my += Math.cos(hRad) * Math.cos(pRad) * stepM;
    malt += Math.sin(pRad) * stepM;

    const missDist = pointToSegmentDist3D(tx, ty, tz, oldX, oldY, oldAlt, mx, my, malt);
    if (missDist < FUZE_RADIUS_M) {
      return { hit: true, t, point: { x: mx, y: my, altM: malt } };
    }
  }
  return { hit: false, t, point: { x: mx, y: my, altM: malt } };
}
