import { MISSILES, FUZE_RADIUS_M } from './weapons.js';
import { DEG, RAD, wrapDeg, clamp } from '../core/rng.js';
import { relativeTo } from './world.js';

const G_MPS2 = 9.81;

/** Shortest distance from point p to the segment a->b, in 3D. */
function pointToSegmentDist3D(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  const t = abLenSq > 1e-6 ? clamp((apx * abx + apy * aby + apz * abz) / abLenSq, 0, 1) : 0;
  const cx = ax + abx * t, cy = ay + aby * t, cz = az + abz * t;
  return Math.hypot(px - cx, py - cy, pz - cz);
}
const DRAG_EASE = 0.18;   // how fast a coasting round settles onto cruise speed

/**
 * Launches a round of `weaponId` from the ownship at `target` (a live
 * contact object). The missile only ever knows its assigned target id -
 * losing radar lock afterward does not affect a round already in flight,
 * matching how a real weapon flies once released.
 */
export function launchMissile(world, weaponId, target) {
  const w = MISSILES[weaponId];
  const own = world.own;
  const rel = relativeTo(own, target);
  const bearing = (own.headingDeg + rel.az) * DEG;
  return {
    weaponId, targetId: target.id, w,
    x: own.x, y: own.y, altM: own.altM,
    headingDeg: own.headingDeg + rel.az,
    pitchDeg: rel.el,
    speed: w.launchMps,
    t: 0, distanceM: 0,
    alive: true, hit: false, expired: false,
  };
}

/** Advance one missile by dt. Marks it dead (hit or spent) as needed. */
export function tickMissile(world, m, dt) {
  if (!m.alive) { return; }
  m.t += dt;

  // Range, modelled as a flight-time limit (motor/fuel burn) rather than a
  // distance - still going when the clock runs out means a self-destruct,
  // not a hit.
  if (m.t > m.w.maxFlightSec) { m.alive = false; m.expired = true; return; }

  // --- speed profile: boost, then ease onto the cruise speed ---
  if (m.t <= m.w.boostSec) {
    m.speed = m.w.launchMps + m.w.boostMps2 * m.t;
  } else {
    m.speed += (m.w.cruiseMps - m.speed) * DRAG_EASE * dt;
  }

  const target = world.contacts.find((c) => c.id === m.targetId);
  if (!target || !target.alive) { m.alive = false; return; }

  // --- guidance: turn toward the target's current position, rate-limited ---
  const dx = target.x - m.x, dy = target.y - m.y, dz = target.altM - m.altM;
  const groundDist = Math.hypot(dx, dy);
  const wantHeading = Math.atan2(dx, dy) * RAD;
  const wantPitch = Math.atan2(dz, groundDist) * RAD;

  const maxTurnDegPerSec = (m.w.maxGTurn * G_MPS2 / Math.max(m.speed, 1)) * RAD;
  const step = maxTurnDegPerSec * dt;
  m.headingDeg = wrapDeg(m.headingDeg + clamp(wrapDeg(wantHeading - m.headingDeg), -step, step));
  m.pitchDeg = clamp(m.pitchDeg + clamp(wantPitch - m.pitchDeg, -step, step), -85, 85);

  const hRad = m.headingDeg * DEG, pRad = m.pitchDeg * DEG;
  const stepM = m.speed * dt;
  const oldX = m.x, oldY = m.y, oldAlt = m.altM;
  m.x += Math.sin(hRad) * Math.cos(pRad) * stepM;
  m.y += Math.cos(hRad) * Math.cos(pRad) * stepM;
  m.altM += Math.sin(pRad) * stepM;
  m.distanceM += stepM;

  // --- fuze / miss conditions ---
  // A fast round can close more than the fuze radius in a single tick, so
  // check the target's distance to the whole travelled segment (old->new
  // position), not just the endpoints - otherwise a close pass can "tunnel"
  // through the fuze radius between two samples and never register a hit.
  const missDist = pointToSegmentDist3D(
    target.x, target.y, target.altM, oldX, oldY, oldAlt, m.x, m.y, m.altM);
  if (missDist < FUZE_RADIUS_M) { m.alive = false; m.hit = true; return; }
}

/** Missile's own range/az/el from the ownship, for drawing on the scopes. */
export function missileRelative(world, m) {
  return relativeTo(world.own, { x: m.x, y: m.y, altM: m.altM });
}

export function timeToImpactSec(world, m) {
  const target = world.contacts.find((c) => c.id === m.targetId);
  if (!target) { return null; }
  const dist = Math.hypot(target.x - m.x, target.y - m.y, target.altM - m.altM);
  return m.speed > 1 ? dist / m.speed : null;
}
