/**
 * Projected-intercept calculator: "if I fired this weapon at this target
 * right now, would it connect - and where?" It runs the same engine used
 * for a real launch (missile.js) - the same profile, the same Mode.PURSUE
 * proportional-navigation guidance, the same fuel/capture events - against
 * a target whose future position is extrapolated at its CURRENT velocity
 * rather than read live each step, since nothing else is known about what
 * it will do next. That is what turns "relative velocity + missile
 * telemetry" into an actual 3D forward simulation rather than a guess.
 *
 * Mirrors missile.js's own reachability rule exactly (predicted vs. actual
 * must agree): running out of fuel just cuts thrust, it doesn't end the
 * flight - the round coasts, same as a real one - and only a generous
 * overall flight-time cap (a multiple of the burn time) calls it unreachable.
 */
import { World as EngineWorld } from '../engine/world.js';
import { Command, Mode } from '../engine/bodies.js';
import { Vec3 } from '../engine/vec.js';
import * as profiles from '../engine/profiles.js';
import { contactVelocityVec, boresightVelocity, PHANTOM_ALT_FLOOR_M } from './world.js';
import { MISSILES } from './weapons.js';

const STEP_SEC = 0.02;
const COAST_FACTOR = 3.0;

/**
 * Simulates a hypothetical `weaponId` launch at `target` from the current
 * world state. Returns { hit, t, point: {x,y,altM} } - `point` is the
 * intercept point if `hit`, otherwise wherever the round sat the instant it
 * ran dry (where it would self-destruct) - useful either way as a "reach"
 * cue on the scopes.
 */
export function simulateIntercept(world, weaponId, target) {
  const w = MISSILES[weaponId];
  const prof = profiles.get(w.profile);
  const own = world.own;
  const launchVel = boresightVelocity(own, target);
  const targetVel = contactVelocityVec(target);

  const engine = new EngineWorld({ dt: STEP_SEC, collisions: false, separationM: 0 });
  const phantom = engine.spawn(
    profiles.get('phantom_target'),
    new Vec3(target.x, target.y, Math.max(target.altM, PHANTOM_ALT_FLOOR_M)), targetVel,
    { command: new Command({ mode: Mode.BALLISTIC }) },
  );
  const body = engine.spawn(
    prof, new Vec3(own.x, own.y, own.altM), launchVel,
    { command: new Command({ mode: Mode.PURSUE, targetId: phantom.id }) },
  );

  let tx = target.x, ty = target.y, tz = target.altM;
  const point = () => ({ x: body.position.x, y: body.position.y, altM: body.position.z });
  const burnTimeS = prof.burnRateKgs > 0 ? prof.fuelKg / prof.burnRateKgs : 0;
  const maxFlightSec = burnTimeS * COAST_FACTOR;
  const maxSteps = Math.ceil(maxFlightSec / STEP_SEC);

  for (let i = 0; i < maxSteps; i++) {
    engine.step(STEP_SEC);
    // Constant-velocity forecast: carry the phantom in a straight line
    // rather than let it drift under its own (irrelevant) ballistic physics.
    tx += targetVel.x * STEP_SEC; ty += targetVel.y * STEP_SEC; tz += targetVel.z * STEP_SEC;
    phantom.position = new Vec3(tx, ty, Math.max(tz, PHANTOM_ALT_FLOOR_M));
    phantom.velocity = targetVel;

    for (const e of engine.drainEvents()) {
      if (e.kind === 'beacon_attached' && e.id === body.id) { return { hit: true, t: body.ageS, point: point() }; }
    }
    if (!body.active) { return { hit: false, t: body.ageS, point: point() }; }
  }
  return { hit: false, t: body.ageS, point: point() };
}
