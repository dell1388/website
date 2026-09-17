/**
 * Objects the world tracks, and the command each one is flying. A port of
 * skysim/bodies.py.
 */
import { UP, Vec3 } from './vec.js';

export const MAX_OBJECTS = 32;

export const Status = Object.freeze({
  ACTIVE: 'active',
  LANDED: 'landed',
  DESTROYED: 'destroyed',
  EXITED: 'exited',
  SPENT: 'spent',
});

export const Mode = Object.freeze({
  BALLISTIC: 'ballistic',
  HOLD: 'hold',
  HEADING: 'heading',
  WAYPOINT: 'waypoint',
  HOVER: 'hover',
  FOLLOW: 'follow',
  ASCENT: 'ascent',
  PURSUE: 'pursue',
});

/** What the autopilot is being asked to do. All fields optional. */
export class Command {
  constructor({
    mode = Mode.BALLISTIC, headingDeg = null, altitudeM = null, speedMps = null,
    waypoint = null, targetId = null, standoffM = 500.0,
    pitchDeg = 90.0, pitchOverS = 0.0, throttle = null,
  } = {}) {
    this.mode = mode;
    this.headingDeg = headingDeg;
    this.altitudeM = altitudeM;
    this.speedMps = speedMps;
    this.waypoint = waypoint;
    this.targetId = targetId;
    this.standoffM = standoffM;
    this.pitchDeg = pitchDeg;
    this.pitchOverS = pitchOverS;
    this.throttle = throttle;
  }
  toDict() {
    return {
      mode: this.mode, heading_deg: this.headingDeg, altitude_m: this.altitudeM,
      speed_mps: this.speedMps, waypoint: this.waypoint ? this.waypoint.toDict() : null,
      target_id: this.targetId, standoff_m: this.standoffM,
      pitch_deg: this.pitchDeg, pitch_over_s: this.pitchOverS, throttle: this.throttle,
    };
  }
}

let _nextId = 1;
export function resetIds() { _nextId = 1; }

/** A point mass flying under the force model in engine/world.js. */
export class Body {
  constructor({
    profile, position, velocity, id = null, name = '', label = '',
    status = Status.ACTIVE, command = null, fuelKg = -1.0,
  }) {
    this.profile = profile;
    this.position = position;
    this.velocity = velocity;
    this.id = id ?? _nextId++;
    this.name = name;
    this.label = label;
    this.status = status;
    this.command = command || new Command();
    this.fuelKg = fuelKg;
    this.throttle = 0.0;
    this.ageS = 0.0;
    this.burst = false;
    // Search-and-rescue: set once a PURSUE body reaches its target, after
    // which it rides along with that object instead of flying itself.
    this.attachedTo = null;
    this.thrustDir = UP;
    this.accelCmd = new Vec3();
    this.mach = 0.0;
    this.loadFactorG = 0.0;

    if (!this.name) { this.name = `${this.profile.name}-${this.id}`; }
    if (this.fuelKg < 0.0) { this.fuelKg = this.profile.fuelKg; }
    if (this.velocity.mag > 1e-6) { this.thrustDir = this.velocity.unit(); }
  }

  get kind() { return this.profile.kind; }
  get massKg() { return this.profile.massKg + Math.max(0.0, this.fuelKg); }
  get altitudeM() { return this.position.z; }
  get speedMps() { return this.velocity.mag; }
  get active() { return this.status === Status.ACTIVE; }
  /** Displaced volume; a burst balloon displaces nothing. */
  get volumeM3() { return this.burst ? 0.0 : this.profile.volumeM3; }
  /** A burst envelope trails behind as a crude parachute. */
  get dragCd0() { return this.profile.cd0 * (this.burst ? 2.5 : 1.0); }

  /** Compass heading of the ground track: 0 = north, 90 = east. */
  headingDeg() {
    return ((Math.atan2(this.velocity.x, this.velocity.y) * 180 / Math.PI) + 360) % 360;
  }
  /** Climb angle above the horizon, in degrees. */
  flightPathAngleDeg() {
    const horiz = Math.hypot(this.velocity.x, this.velocity.y);
    return (horiz || this.velocity.z) ? Math.atan2(this.velocity.z, horiz) * 180 / Math.PI : 0.0;
  }
  groundSpeedMps() { return Math.hypot(this.velocity.x, this.velocity.y); }

  toDict() {
    return {
      id: this.id, name: this.name, label: this.label, profile: this.profile.name,
      kind: this.kind, status: this.status,
      position: this.position.toDict(), velocity: this.velocity.toDict(),
      altitude_m: this.altitudeM, speed_mps: this.speedMps,
      ground_speed_mps: this.groundSpeedMps(), vertical_speed_mps: this.velocity.z,
      heading_deg: this.headingDeg(), flight_path_angle_deg: this.flightPathAngleDeg(),
      mach: this.mach, load_factor_g: this.loadFactorG, mass_kg: this.massKg,
      fuel_kg: Math.max(0.0, this.fuelKg), throttle: this.throttle, age_s: this.ageS,
      burst: this.burst, attached_to: this.attachedTo, command: this.command.toDict(),
    };
  }
}

/** Unit horizontal vector for a compass heading (0 = north, 90 = east). */
export function headingVector(headingDeg) {
  const rad = headingDeg * Math.PI / 180;
  return new Vec3(Math.sin(rad), Math.cos(rad), 0.0);
}
