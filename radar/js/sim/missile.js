/**
 * Missile flight, run on the ported skysim engine (../engine/) instead of
 * a hand-rolled guidance loop. Each round is a real point-mass Body flying
 * Mode.PURSUE - the engine's own proportional-navigation law (nulling the
 * line-of-sight rotation rate, see engine/control.js) - in a small
 * dedicated engine World of its own.
 *
 * PURSUE steers toward another Body looked up by id in that same World, but
 * our targets (radar contacts) live outside the engine entirely. So each
 * missile carries a "phantom" - an inert stand-in Body placed at the real
 * target's live position/velocity and re-synced from ground truth every
 * tick before the engine steps - which is what the missile's guidance
 * actually chases. Capture (within the profile's captureRadiusM, doubling
 * as the fuze radius) is the engine's own event, not a bespoke hit check.
 *
 * Running dry (fuelExhausted) does NOT end the flight - a real motor burns
 * for a few seconds to tens of seconds and the round coasts unpowered the
 * rest of the way on stored energy and lift, same as a real Sparrow/
 * Harpoon/Hellfire; the engine's own thrust model already cuts thrust to
 * zero once fuel is gone, so this falls out for free. "Out of range" is a
 * generous overall flight-time cap - a few multiples of the burn time -
 * as the actual self-destruct: a safety valve against a round that can
 * genuinely never catch its target, not the primary reachability gate.
 */
const COAST_FACTOR = 3.0;   // multiple of the fuel-burn time a round may coast unpowered
import { World as EngineWorld } from '../engine/world.js';
import { Command, Mode } from '../engine/bodies.js';
import { Vec3 } from '../engine/vec.js';
import * as profiles from '../engine/profiles.js';
import { relativeTo, contactVelocityVec, boresightVelocity, PHANTOM_ALT_FLOOR_M } from './world.js';
import { MISSILES } from './weapons.js';

const MISSILE_DT = 0.02;   // fixed sub-step the engine's guidance/control gains are tuned for

/**
 * Launches a round of `weaponId` from the ownship at `target` (a live
 * contact object). The missile only ever knows its assigned target id -
 * losing radar lock afterward does not affect a round already in flight,
 * matching how a real weapon flies once released.
 */
export function launchMissile(world, weaponId, target) {
  const w = MISSILES[weaponId];
  const prof = profiles.get(w.profile);
  const own = world.own;
  const launchVel = boresightVelocity(own, target);

  const engine = new EngineWorld({ dt: MISSILE_DT, collisions: false, separationM: 0 });
  const phantom = engine.spawn(
    profiles.get('phantom_target'),
    new Vec3(target.x, target.y, Math.max(target.altM, PHANTOM_ALT_FLOOR_M)), contactVelocityVec(target),
    { name: 'phantom', command: new Command({ mode: Mode.BALLISTIC }) },
  );
  const body = engine.spawn(
    prof, new Vec3(own.x, own.y, own.altM), launchVel,
    { name: weaponId, command: new Command({ mode: Mode.PURSUE, targetId: phantom.id }) },
  );

  const burnTimeS = prof.burnRateKgs > 0 ? prof.fuelKg / prof.burnRateKgs : 0;
  return {
    weaponId, targetId: target.id, w, engine, body, phantom,
    x: body.position.x, y: body.position.y, altM: body.position.z,
    headingDeg: body.headingDeg(), pitchDeg: body.flightPathAngleDeg(), speed: body.speedMps,
    t: 0, maxFlightSec: burnTimeS * COAST_FACTOR, alive: true, hit: false, expired: false,
  };
}

/** Advance one missile by dt. Marks it dead (hit, dry, or crashed) as needed. */
export function tickMissile(world, m, dt) {
  if (!m.alive) { return; }
  const target = world.contacts.find((c) => c.id === m.targetId);
  if (!target || !target.alive) { m.alive = false; return; }

  // Re-sync the phantom to the real target's current position/velocity
  // before stepping, so the engine's own guidance chases ground truth.
  m.phantom.position = new Vec3(target.x, target.y, Math.max(target.altM, PHANTOM_ALT_FLOOR_M));
  m.phantom.velocity = contactVelocityVec(target);

  let remaining = dt;
  while (remaining > 1e-9) {
    const step = Math.min(MISSILE_DT, remaining);
    m.engine.step(step);
    remaining -= step;
  }
  m.t += dt;

  m.x = m.body.position.x; m.y = m.body.position.y; m.altM = m.body.position.z;
  m.speed = m.body.speedMps;
  m.headingDeg = m.body.headingDeg();
  m.pitchDeg = m.body.flightPathAngleDeg();

  for (const e of m.engine.drainEvents()) {
    if (e.kind === 'beacon_attached' && e.id === m.body.id) { m.alive = false; m.hit = true; }
  }
  if (m.alive && m.t > m.maxFlightSec) { m.alive = false; m.expired = true; }
  // Flew itself into the ground, or out past the engine's own airspace bounds.
  if (m.alive && !m.body.active) { m.alive = false; }
}

/** Missile's own range/az/el from the ownship, for drawing on the scopes. */
export function missileRelative(world, m) {
  return relativeTo(world.own, { x: m.x, y: m.y, altM: m.altM });
}

/** A point `aheadKm` along the missile's current heading/pitch - used to
 *  draw a small direction-of-travel pointer on the scopes. Straight-line
 *  projection (no guidance curvature); at these short lookaheads the turn
 *  the round can actually pull in that time is negligible next to how
 *  short the pointer is drawn. */
export function missileAheadPoint(m, aheadKm) {
  const hRad = m.headingDeg * Math.PI / 180, pRad = m.pitchDeg * Math.PI / 180;
  const d = aheadKm * 1000;
  return {
    x: m.x + Math.sin(hRad) * Math.cos(pRad) * d,
    y: m.y + Math.cos(hRad) * Math.cos(pRad) * d,
    altM: m.altM + Math.sin(pRad) * d,
  };
}

export function timeToImpactSec(world, m) {
  const target = world.contacts.find((c) => c.id === m.targetId);
  if (!target) { return null; }
  const dist = Math.hypot(target.x - m.x, target.y - m.y, target.altM - m.altM);
  return m.speed > 1 ? dist / m.speed : null;
}
