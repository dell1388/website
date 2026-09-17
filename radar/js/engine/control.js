/**
 * Autopilots: turn a Command into a steering demand for this tick. A port
 * of skysim/control.py. Each function returns the acceleration the vehicle
 * should feel (m/s^2, world frame, gravity compensation included), a
 * throttle setting, and - for thrust-vectoring bodies - where to point the
 * motor. The world then works out whether the aerodynamics can actually
 * deliver it.
 */
import * as physics from './physics.js';
import { Mode, headingVector } from './bodies.js';
import { UP, Vec3 } from './vec.js';

// Gains. Loose enough to be stable at 20-50 Hz, tight enough to look flown.
const K_ALT = 0.18;
const K_VS = 1.3;
const K_TURN = 1.6;
const K_SPEED = 0.05;
const K_POS = 0.6;
const K_VEL = 1.4;

export class Demand {
  constructor(accel = new Vec3(), throttle = 0.0, thrustDir = UP) {
    this.accel = accel; this.throttle = throttle; this.thrustDir = thrustDir;
  }
}

function clamp01(x) { return x < 0.0 ? 0.0 : (x > 1.0 ? 1.0 : x); }
function dir(v, fallback = UP) { return v.mag2 > 1e-18 ? v.unit() : fallback; }
function forward(body) { return dir(body.velocity); }

/**
 * Vertical acceleration to capture and hold an altitude (gravity included).
 * The climb rate is capped at a fraction of current speed: chasing a big
 * altitude error at a steep angle just bleeds energy and stalls the wing.
 */
export function verticalDemand(body, targetAltitudeM, maxClimbMps = null) {
  if (maxClimbMps === null) { maxClimbMps = Math.max(2.0, 0.25 * body.speedMps); }
  const err = targetAltitudeM - body.altitudeM;
  const vsWant = Math.max(-maxClimbMps, Math.min(maxClimbMps, K_ALT * err));
  const g = physics.gravityMagnitude(body.altitudeM);
  return g + K_VS * (vsWant - body.velocity.z);
}

/** Horizontal acceleration that swings the flight path toward a direction. */
export function turnDemand(body, desiredDir) {
  const speed = body.groundSpeedMps();
  if (speed < 1e-3) { return new Vec3(); }
  const want = new Vec3(desiredDir.x, desiredDir.y, 0.0).unit();
  const have = new Vec3(body.velocity.x, body.velocity.y, 0.0).unit();
  const err = want.sub(have.scale(want.dot(have)));
  return err.scale(K_TURN * speed);
}

/** Proportional speed hold; full throttle when no target is given. */
export function throttleForSpeed(body, targetSpeedMps) {
  if (targetSpeedMps == null) { return 1.0; }
  const cap = Math.min(targetSpeedMps, body.profile.maxSpeedMps);
  return clamp01(0.5 + K_SPEED * (cap - body.speedMps));
}

/** Hold heading, altitude and speed - defaults taken from current state. */
export function holdDemand(body, cmd) {
  const alt = cmd.altitudeM != null ? cmd.altitudeM : body.altitudeM;
  const hdg = cmd.headingDeg != null ? cmd.headingDeg : body.headingDeg();
  let accel = turnDemand(body, headingVector(hdg));
  accel = accel.add(UP.scale(verticalDemand(body, alt)));
  return new Demand(accel, throttleForSpeed(body, cmd.speedMps), forward(body));
}

/** Steer to a point; the waypoint's z is the altitude to hold. */
export function waypointDemand(body, cmd) {
  const wp = cmd.waypoint || body.position;
  const toWp = new Vec3(wp.x - body.position.x, wp.y - body.position.y, 0.0);
  const alt = cmd.altitudeM != null ? cmd.altitudeM : wp.z;
  let accel;
  if (toWp.mag < 50.0) {
    accel = UP.scale(verticalDemand(body, alt));
  } else {
    accel = turnDemand(body, toWp).add(UP.scale(verticalDemand(body, alt)));
  }
  return new Demand(accel, throttleForSpeed(body, cmd.speedMps), forward(body));
}

/**
 * Trail another object, holding a standoff distance behind it. Plain
 * proportional steering toward the trail point, with a speed hold on the
 * leader - the pattern a camera drone or a formation flight uses.
 */
export function followDemand(body, cmd, target) {
  if (target == null || !target.active) { return holdDemand(body, new_(cmd, { mode: Mode.HOLD })); }
  const behind = target.velocity.unit().scale(-Math.max(0.0, cmd.standoffM));
  const wantPos = target.position.add(behind);
  const toGo = wantPos.sub(body.position);
  const alt = cmd.altitudeM != null ? cmd.altitudeM : wantPos.z;
  const accel = turnDemand(body, toGo).add(UP.scale(verticalDemand(body, alt)));
  const wantSpeed = target.speedMps + 0.4 * Math.sqrt(new Vec3(toGo.x, toGo.y, 0.0).mag);
  return new Demand(accel, throttleForSpeed(body, wantSpeed), forward(body));
}

/** Convert a desired acceleration into a (throttle, thrust direction) pair
 *  for a thrust-vectoring body - there is no wing to ask for lift instead. */
function vectoredThrust(body, accel) {
  const thrustN = Math.max(1e-6, body.profile.thrustN);
  const need = accel.mag * body.massKg;
  return new Demand(new Vec3(), clamp01(need / thrustN), dir(accel));
}

/** Thrust-vectoring station keeping: park over a point at an altitude. */
export function hoverDemand(body, cmd) {
  const wp = cmd.waypoint || body.position;
  const alt = cmd.altitudeM != null ? cmd.altitudeM : wp.z;
  const wantPos = new Vec3(wp.x, wp.y, alt);
  const err = wantPos.sub(body.position);
  const speedCap = body.profile.maxSpeedMps;
  const velWant = err.scale(K_POS).clamp(speedCap);
  let accel = velWant.sub(body.velocity).scale(K_VEL);
  accel = accel.clamp(body.profile.maxG * physics.G0);
  accel = accel.add(UP.scale(physics.gravityMagnitude(body.altitudeM)));
  return vectoredThrust(body, accel);
}

/**
 * Steering accel that nulls the line-of-sight rotation rate. omega = (r x
 * v_rel) / |r|^2 is how fast the bearing to the target is swinging; driving
 * it to zero puts the pursuer on a straight-line intercept course. This is
 * the standard convergent-pursuit law behind any moving-target rendezvous
 * or tracking task - aiming at a lead point instead (pure pursuit) looks
 * similar but does not actually converge when the pursuer is much faster
 * than the target: it overshoots and loops, forever.
 */
export function losRateAccel(pursuerPos, pursuerVel, targetPos, targetVel, gain) {
  const r = targetPos.sub(pursuerPos);
  const rng2 = Math.max(1.0, r.mag2);
  const vRel = targetVel.sub(pursuerVel);
  const omega = r.cross(vRel).scale(1 / rng2);
  return omega.cross(pursuerVel).scale(gain);
}

/**
 * Close on a moving target (aircraft rendezvous, or - in this game - a
 * missile's terminal guidance). Steering is delivered as wing lift for a
 * winged airframe (line-of-sight guidance - a bank-and-turn body cannot
 * brake, so it has to fly a converging course rather than chase a point),
 * or as vectored thrust for a rotorcraft-style body, which can simply servo
 * onto the target directly.
 */
export function pursuitDemand(body, cmd, target) {
  const vectored = body.profile.thrustMode === 'vector';
  if (target == null || !target.active) {
    if (vectored) {
      return hoverDemand(body, new_(cmd, { mode: Mode.HOVER, waypoint: body.position, altitudeM: body.altitudeM }));
    }
    return holdDemand(body, new_(cmd, { mode: Mode.HOLD }));
  }

  const speedCap = Math.max(1.0, body.profile.maxSpeedMps);

  if (vectored) {
    const rng = target.position.sub(body.position).mag;
    const leadS = Math.min(6.0, rng / speedCap);
    const aimPoint = target.position.add(target.velocity.scale(leadS));
    const velWant = aimPoint.sub(body.position).clamp(speedCap);
    let accel = velWant.sub(body.velocity).scale(K_VEL);
    accel = accel.clamp(body.profile.maxG * physics.G0);
    accel = accel.add(UP.scale(physics.gravityMagnitude(body.altitudeM)));
    return vectoredThrust(body, accel);
  }

  let accel = losRateAccel(body.position, body.velocity, target.position, target.velocity, 3.5);
  accel = new Vec3(accel.x, accel.y, 0.0).add(UP.scale(verticalDemand(body, target.altitudeM)));
  return new Demand(accel, throttleForSpeed(body, speedCap), forward(body));
}

/** Rocket pitch program: straight up, then a constant-attitude climb. */
export function ascentDemand(body, cmd) {
  let direction;
  if (body.ageS < cmd.pitchOverS) {
    direction = UP;
  } else {
    const pitch = Math.max(-90.0, Math.min(90.0, cmd.pitchDeg)) * Math.PI / 180;
    const horiz = headingVector(cmd.headingDeg != null ? cmd.headingDeg : 0.0);
    direction = horiz.scale(Math.cos(pitch)).add(UP.scale(Math.sin(pitch))).unit();
  }
  const lit = body.fuelKg > 0.0;
  let throttle = lit ? (cmd.throttle != null ? cmd.throttle : 1.0) : 0.0;
  if (!lit && body.speedMps > 1e-3) { direction = body.velocity.unit(); }
  return new Demand(new Vec3(), clamp01(throttle), direction);
}

/** Small helper: a shallow copy of a Command with overrides (mirrors the
 *  ad hoc `Command(mode=...)` literals the Python autopilots build). */
function new_(cmd, overrides) {
  return Object.assign(Object.create(Object.getPrototypeOf(cmd)), cmd, overrides);
}

/** Dispatch on the body's command mode. */
export function solve(body, target = null) {
  const cmd = body.command;
  let d;
  if (cmd.mode === Mode.BALLISTIC) { d = new Demand(new Vec3(), 0.0, forward(body)); }
  else if (cmd.mode === Mode.HOVER) { d = hoverDemand(body, cmd); }
  else if (cmd.mode === Mode.ASCENT) { d = ascentDemand(body, cmd); }
  else if (cmd.mode === Mode.WAYPOINT) { d = waypointDemand(body, cmd); }
  else if (cmd.mode === Mode.FOLLOW) { d = followDemand(body, cmd, target); }
  else if (cmd.mode === Mode.PURSUE) { d = pursuitDemand(body, cmd, target); }
  else { d = holdDemand(body, cmd); }  // HOLD and HEADING share a law

  if (cmd.throttle != null && cmd.mode !== Mode.ASCENT) {
    d = new Demand(d.accel, clamp01(cmd.throttle), d.thrustDir);
  }
  if (!(body.profile.thrustN > 0.0 && body.profile.thrustMode !== 'none')) {
    d = new Demand(d.accel, 0.0, d.thrustDir);
  }
  return d;
}
