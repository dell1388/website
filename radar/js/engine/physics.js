/**
 * Force models: atmosphere, drag, lift, buoyancy, thrust, gravity.
 * A straight port of skysim/physics.py - textbook point-mass aerodynamics
 * over a flat local frame, valid from the surface up to ~60 km. Everything
 * here is a pure function of state, so the integrator can call it as often
 * as it likes.
 */
import { UP, Vec3 } from './vec.js';

export const G0 = 9.80665;            // m/s^2, standard gravity at the surface
export const R_EARTH = 6371000.0;     // m, mean radius (only used for g(h) falloff)
export const R_AIR = 287.05287;       // J/(kg*K), specific gas constant for dry air
export const GAMMA = 1.4;             // ratio of specific heats

export const CEILING_M = 60000.0;

// International Standard Atmosphere: [base alt m, base temp K, base pressure Pa, lapse K/m]
const ISA_LAYERS = [
  [0.0, 288.15, 101325.0, -0.0065],
  [11000.0, 216.65, 22632.06, 0.0],
  [20000.0, 216.65, 5474.889, 0.001],
  [32000.0, 228.65, 868.0187, 0.0028],
  [47000.0, 270.65, 110.9063, 0.0],
  [51000.0, 270.65, 66.93887, -0.0028],
  [71000.0, 214.65, 3.956420, -0.002],
];
const ISA_TOP_M = 84852.0;
const ISA_TOP_T = 186.946;
const ISA_TOP_RHO = 6.958e-6;

// Above the ISA table, an approximate piecewise-exponential fit to the upper
// atmosphere: [ceiling m, scale height m].
const UPPER_LAYERS = [[150000.0, 7990.0], [500000.0, 42200.0], [1.0e9, 60000.0]];

/** Returns [density kg/m^3, pressure Pa, speed of sound m/s] at altitude. */
export function atmosphere(altitudeM) {
  let h = altitudeM;
  if (h <= 0.0) { h = 0.0; }

  if (h <= ISA_TOP_M) {
    let [baseH, baseT, baseP, lapse] = ISA_LAYERS[0];
    for (const layer of ISA_LAYERS) {
      if (h >= layer[0]) { [baseH, baseT, baseP, lapse] = layer; }
      else { break; }
    }
    const dh = h - baseH;
    let temp, pressure;
    if (lapse === 0.0) {
      temp = baseT;
      pressure = baseP * Math.exp(-G0 * dh / (R_AIR * baseT));
    } else {
      temp = baseT + lapse * dh;
      pressure = baseP * Math.pow(temp / baseT, -G0 / (lapse * R_AIR));
    }
    const density = pressure / (R_AIR * temp);
    return [density, pressure, Math.sqrt(GAMMA * R_AIR * temp)];
  }

  let density = ISA_TOP_RHO;
  let hBase = ISA_TOP_M;
  for (const [ceiling, scale] of UPPER_LAYERS) {
    const top = Math.min(h, ceiling);
    density *= Math.exp(-(top - hBase) / scale);
    hBase = top;
    if (h <= ceiling) { break; }
  }
  const temp = ISA_TOP_T;
  return [density, density * R_AIR * temp, Math.sqrt(GAMMA * R_AIR * temp)];
}

/** g at altitude (m/s^2): g0 scaled by inverse square of radius. */
export function gravityMagnitude(altitudeM) {
  const ratio = R_EARTH / (R_EARTH + Math.max(0.0, altitudeM));
  return G0 * ratio * ratio;
}

/** Gravitational acceleration, straight down in the world frame. */
export function gravityAccel(position, altitudeFalloff = true) {
  const g = altitudeFalloff ? gravityMagnitude(position.z) : G0;
  return new Vec3(0, 0, -g);
}

export function dynamicPressure(density, speed) {
  return 0.5 * density * speed * speed;
}

export function machNumber(speed, soundSpeed) {
  return soundSpeed <= 0.0 ? 0.0 : speed / soundSpeed;
}

/**
 * Zero-lift Cd with a smooth transonic rise, plus an induced term. The Mach
 * factor is a shape, not wind-tunnel data: flat subsonic, a peak near Mach
 * 1, settling to a higher-than-subsonic supersonic value.
 */
export function dragCoefficient(cd0, mach, induced = 0.0) {
  let factor;
  if (mach < 0.8) { factor = 1.0; }
  else if (mach < 1.2) { factor = 1.0 + 2.5 * (mach - 0.8) / 0.4; }
  else { factor = Math.max(1.4, 3.5 / Math.sqrt(mach / 1.2)); }
  return cd0 * factor + induced;
}

/** Cdi = Cl^2 / (pi * AR * e). */
export function inducedDragCoefficient(cl, aspectRatio, efficiency = 0.8) {
  if (aspectRatio <= 0.0) { return 0.0; }
  return (cl * cl) / (Math.PI * aspectRatio * efficiency);
}

/** D = -q * Cd * S * v_hat (N), always opposing motion. */
export function dragForce(velocity, density, cd, area) {
  const speed = velocity.mag;
  if (speed < 1e-6 || density <= 0.0) { return new Vec3(); }
  return velocity.unit().scale(-dynamicPressure(density, speed) * cd * area);
}

/** L = q * Cl * S (N), perpendicular to velocity, toward `upHint`. */
export function liftForce(velocity, density, cl, area, upHint = UP) {
  const speed = velocity.mag;
  if (speed < 1e-6 || Math.abs(cl) < 1e-12) { return new Vec3(); }
  const liftDir = upHint.perpTo(velocity);
  if (liftDir.mag2 < 1e-12) { return new Vec3(); }
  return liftDir.unit().scale(dynamicPressure(density, speed) * cl * area);
}

/** Cl needed to pull `accelMps2` of turn, saturated at clMax. */
export function liftCoefficientFor(accelMps2, massKg, density, speed, area, clMax) {
  const q = dynamicPressure(density, speed);
  if (q <= 1e-9 || area <= 0.0) { return 0.0; }
  return Math.min(Math.abs(accelMps2) * massKg / (q * area), clMax);
}

/** Archimedes: B = rho_air * V * g, straight up. Zero for non-lifting bodies. */
export function buoyancyForce(volumeM3, density, altitudeM = 0.0) {
  if (volumeM3 <= 0.0 || density <= 0.0) { return new Vec3(); }
  return UP.scale(density * volumeM3 * gravityMagnitude(altitudeM));
}

/**
 * Displaced volume of a gas envelope at altitude. A fixed mass of lifting
 * gas expands as the air thins (V ~ 1/rho), until the envelope reaches its
 * stretch limit and volume stops growing - which is why a free balloon
 * climbs at a near-constant rate, then floats.
 */
export function balloonVolume(baseVolumeM3, expansionRatio, density, seaLevelDensity = 1.225) {
  if (baseVolumeM3 <= 0.0) { return 0.0; }
  if (density <= 1e-12) { return baseVolumeM3 * Math.max(1.0, expansionRatio); }
  const grown = baseVolumeM3 * (seaLevelDensity / density);
  return Math.min(grown, baseVolumeM3 * Math.max(1.0, expansionRatio));
}

/** Thrust along a unit pointing direction (N). */
export function thrustForce(direction, magnitude) {
  if (magnitude <= 0.0) { return new Vec3(); }
  return direction.unit().scale(magnitude);
}

export function weightForce(massKg, position, altitudeFalloff = true) {
  return gravityAccel(position, altitudeFalloff).scale(massKg);
}

/** Steady-state fall speed where drag balances weight (m/s). */
export function terminalVelocity(massKg, cd, area, altitudeM = 0.0) {
  const [density] = atmosphere(altitudeM);
  if (density <= 0.0 || cd <= 0.0 || area <= 0.0) { return Infinity; }
  return Math.sqrt(2.0 * massKg * G0 / (density * cd * area));
}
