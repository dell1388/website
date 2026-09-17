/**
 * Vehicle profiles: fixed parameters of each kind of object. A port of
 * skysim/profiles.py, plus a few profiles added for this game (a fighter
 * for ownship/air contacts, and the three weapon airframes) registered the
 * same way the upstream engine expects callers to add their own.
 */

// How thrust is pointed.
//   "velocity" - along the flight path (jets, rockets past the tower)
//   "vector"   - along a commanded direction (multirotors, missiles that
//                thrust-vector, vertical lift-off)
//   "none"     - unpowered (gliders, balloons, dropped payloads)
export const THRUST_MODES = ['velocity', 'vector', 'none'];
export const KINDS = ['aircraft', 'rotorcraft', 'rocket', 'balloon', 'projectile'];

/**
 * @typedef {object} Profile
 * @property {string} name
 * @property {string} kind
 * @property {number} massKg          dry mass (without fuel/propellant)
 * @property {number} refAreaM2       aerodynamic reference area
 * @property {number} cd0             zero-lift drag coefficient
 * @property {number} clMax           max lift coefficient (0 = no wings)
 * @property {number} aspectRatio     wing aspect ratio (0 = skip induced drag)
 * @property {number} maxG            structural/control accel limit, in g
 * @property {number} thrustN         max thrust at full throttle
 * @property {number} fuelKg          usable fuel/propellant loaded
 * @property {number} burnRateKgs     consumption at full throttle
 * @property {string} thrustMode
 * @property {number} maxSpeedMps     soft envelope cap
 * @property {number} serviceCeilingM
 * @property {number} volumeM3        displaced volume at sea level (balloons)
 * @property {number} expansionRatio  how far the envelope can stretch (1 = rigid)
 * @property {number} captureRadiusM  PURSUE-mode rendezvous range (0 = not equipped)
 * @property {number} burstAltitudeM  balloons: envelope bursts above this
 * @property {number} radiusM         collision radius
 */

function profile(p) {
  return {
    name: p.name, kind: p.kind,
    massKg: p.massKg, refAreaM2: p.refAreaM2,
    cd0: p.cd0 ?? 0.3, clMax: p.clMax ?? 0.0, aspectRatio: p.aspectRatio ?? 0.0,
    maxG: p.maxG ?? 3.0,
    thrustN: p.thrustN ?? 0.0, fuelKg: p.fuelKg ?? 0.0, burnRateKgs: p.burnRateKgs ?? 0.0,
    thrustMode: p.thrustMode ?? 'none',
    maxSpeedMps: p.maxSpeedMps ?? 1.0e9, serviceCeilingM: p.serviceCeilingM ?? 1.0e9,
    volumeM3: p.volumeM3 ?? 0.0, expansionRatio: p.expansionRatio ?? 1.0,
    captureRadiusM: p.captureRadiusM ?? 0.0, burstAltitudeM: p.burstAltitudeM ?? 0.0,
    radiusM: p.radiusM ?? 5.0,
  };
}

export function wetMassKg(p) { return p.massKg + p.fuelKg; }
export function isPowered(p) { return p.thrustN > 0.0 && p.thrustMode !== 'none'; }

/** A copy with overrides, e.g. variant(AIRLINER, 'heavy', {fuelKg: 30000}). */
export function variant(p, name, changes) {
  return { ...p, ...changes, name };
}

export const AIRLINER = profile({
  name: 'airliner', kind: 'aircraft',
  massKg: 42000.0, refAreaM2: 122.0, cd0: 0.021, clMax: 1.4, aspectRatio: 9.0,
  maxG: 2.5, thrustN: 220000.0, fuelKg: 16000.0, burnRateKgs: 1.2,
  thrustMode: 'velocity', maxSpeedMps: 265.0, serviceCeilingM: 12500.0, radiusM: 30.0,
});

export const LIGHT_AIRCRAFT = profile({
  name: 'light_aircraft', kind: 'aircraft',
  massKg: 780.0, refAreaM2: 16.2, cd0: 0.032, clMax: 1.6, aspectRatio: 7.4,
  maxG: 3.8, thrustN: 2400.0, fuelKg: 110.0, burnRateKgs: 0.011,
  thrustMode: 'velocity', maxSpeedMps: 78.0, serviceCeilingM: 4200.0, radiusM: 6.0,
});

export const GLIDER = profile({
  name: 'glider', kind: 'aircraft',
  massKg: 350.0, refAreaM2: 11.0, cd0: 0.012, clMax: 1.5, aspectRatio: 22.0,
  maxG: 4.0, thrustMode: 'none', maxSpeedMps: 70.0, serviceCeilingM: 8000.0, radiusM: 8.0,
});

export const SURVEY_DRONE = profile({
  name: 'survey_drone', kind: 'rotorcraft',
  massKg: 6.5, refAreaM2: 0.28, cd0: 0.9, maxG: 2.0,
  thrustN: 180.0, fuelKg: 0.0, burnRateKgs: 0.0,
  thrustMode: 'vector', maxSpeedMps: 22.0, serviceCeilingM: 4000.0, radiusM: 1.0,
});

export const SOUNDING_ROCKET = profile({
  name: 'sounding_rocket', kind: 'rocket',
  massKg: 260.0, refAreaM2: 0.13, cd0: 0.32, maxG: 12.0,
  thrustN: 42000.0, fuelKg: 760.0, burnRateKgs: 26.0,
  thrustMode: 'vector', maxSpeedMps: 1800.0, radiusM: 3.0,
});

export const WEATHER_BALLOON = profile({
  name: 'weather_balloon', kind: 'balloon',
  massKg: 3.2, refAreaM2: 7.5, cd0: 0.55, maxG: 0.5,
  thrustMode: 'none', maxSpeedMps: 60.0,
  volumeM3: 14.0, expansionRatio: 80.0, burstAltitudeM: 30000.0, radiusM: 2.0,
});

export const DROPSONDE = profile({
  name: 'dropsonde', kind: 'projectile',
  massKg: 0.4, refAreaM2: 0.16, cd0: 1.2, maxG: 0.0,
  thrustMode: 'none', radiusM: 0.5,
});

export const SAR_DRONE = profile({
  name: 'sar_drone', kind: 'aircraft',
  massKg: 180.0, refAreaM2: 3.2, cd0: 0.028, clMax: 1.3, aspectRatio: 8.0,
  maxG: 6.0, thrustN: 9000.0, fuelKg: 120.0, burnRateKgs: 0.4,
  thrustMode: 'velocity', maxSpeedMps: 260.0, serviceCeilingM: 15000.0,
  radiusM: 1.5, captureRadiusM: 25.0,
});

export const CARGO_CAPSULE = profile({
  name: 'cargo_capsule', kind: 'projectile',
  massKg: 120.0, refAreaM2: 1.8, cd0: 0.9, maxG: 0.0,
  thrustMode: 'none', radiusM: 1.5,
});

export const HIGH_ALT_PLATFORM = profile({
  name: 'high_alt_platform', kind: 'balloon',
  massKg: 95.0, refAreaM2: 40.0, cd0: 0.6, maxG: 0.3,
  thrustMode: 'none', maxSpeedMps: 40.0,
  volumeM3: 2600.0, expansionRatio: 1.0, burstAltitudeM: 0.0, radiusM: 15.0,
});

// --- added for this game --------------------------------------------------

/** Ownship and the "air" contacts (Aetherfall, the bogeys): a supersonic-
 *  capable fighter-class airframe, needed since the tank/radar game's
 *  ownship cruises at Mach 1.2 - well past anything in the upstream
 *  profile set. */
export const FIGHTER = profile({
  name: 'fighter', kind: 'aircraft',
  massKg: 9000.0, refAreaM2: 28.0, cd0: 0.024, clMax: 1.3, aspectRatio: 3.2,
  maxG: 7.5, thrustN: 130000.0, fuelKg: 3000.0, burnRateKgs: 0.9,
  thrustMode: 'velocity', maxSpeedMps: 620.0, serviceCeilingM: 18000.0, radiusM: 8.0,
});

/**
 * Weapon airframes. Each flies Mode.PURSUE (see control.js's
 * pursuitDemand) against a target snapshot fed in every tick - the engine's
 * own proportional-navigation guidance law, not a hand-rolled pursuit loop.
 * `captureRadiusM` doubles as the fuze radius; running out of fuel (no more
 * thrust) is this game's "out of range" self-destruct, in place of the old
 * flat flight-time timer. Tuned so drag-limited top speed and burn duration
 * land roughly where the previous "double speed, half agility" tuning did,
 * while maxG keeps the same relative ordering (Sparrow most agile).
 */
export const SPARROW_MISSILE = profile({
  name: 'sparrow_missile', kind: 'aircraft',
  massKg: 120.0, refAreaM2: 0.09, cd0: 0.3, clMax: 3.0, aspectRatio: 3.5,
  maxG: 16.0, thrustN: 11500.0, fuelKg: 75.0, burnRateKgs: 0.9,
  thrustMode: 'velocity', maxSpeedMps: 1400.0, radiusM: 0.2, captureRadiusM: 45.0,
});

export const HARPOON_MISSILE = profile({
  name: 'harpoon_missile', kind: 'aircraft',
  massKg: 235.0, refAreaM2: 0.16, cd0: 0.28, clMax: 2.5, aspectRatio: 2.5,
  maxG: 6.0, thrustN: 8500.0, fuelKg: 190.0, burnRateKgs: 0.55,
  thrustMode: 'velocity', maxSpeedMps: 650.0, radiusM: 0.25, captureRadiusM: 45.0,
});

export const HELLFIRE_MISSILE = profile({
  name: 'hellfire_missile', kind: 'aircraft',
  massKg: 49.0, refAreaM2: 0.05, cd0: 0.3, clMax: 4.5, aspectRatio: 4.0,
  maxG: 25.0, thrustN: 9500.0, fuelKg: 50.0, burnRateKgs: 0.65,
  thrustMode: 'velocity', maxSpeedMps: 900.0, radiusM: 0.15, captureRadiusM: 45.0,
});

/** Inert stand-in for a stationary (ground/sea) target inside a missile's
 *  own dedicated engine world - see sim/missileEngine.js. Never thrusts or
 *  lifts; its position/velocity are overwritten from ground truth every
 *  tick, so its own (trivial) ballistic drift never accumulates. */
export const PHANTOM_TARGET = profile({
  name: 'phantom_target', kind: 'projectile',
  massKg: 1.0, refAreaM2: 0.01, cd0: 0.0, thrustMode: 'none', radiusM: 0.1,
});

const REGISTRY = new Map();

export function register(p) {
  if (!KINDS.includes(p.kind)) { throw new Error(`unknown kind ${p.kind}; have ${KINDS}`); }
  if (!THRUST_MODES.includes(p.thrustMode)) {
    throw new Error(`unknown thrustMode ${p.thrustMode}; have ${THRUST_MODES}`);
  }
  REGISTRY.set(p.name, p);
  return p;
}

for (const p of [AIRLINER, LIGHT_AIRCRAFT, GLIDER, SURVEY_DRONE, SOUNDING_ROCKET,
                  WEATHER_BALLOON, HIGH_ALT_PLATFORM, DROPSONDE, CARGO_CAPSULE, SAR_DRONE,
                  FIGHTER, SPARROW_MISSILE, HARPOON_MISSILE, HELLFIRE_MISSILE, PHANTOM_TARGET]) {
  register(p);
}

export function get(name) {
  const p = REGISTRY.get(name);
  if (!p) { throw new Error(`unknown profile ${name}; have ${names().join(', ')}`); }
  return p;
}

export function names() { return [...REGISTRY.keys()].sort(); }
