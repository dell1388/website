/**
 * A toy International Standard Atmosphere, just enough to turn "mach 1.2 at
 * 6000m" into an actual speed and to make higher altitude flight faster in
 * real units for the same mach number - the one bit of real aerodynamics
 * this game leans on. Everything else is arcade physics.
 */

/** Static air temperature at altitude (m) in Kelvin, troposphere model. */
export function isaTempK(altM) {
  const h = Math.min(altM, 11000);           // isothermal above the tropopause
  return 288.15 - 0.0065 * h;
}

/** Speed of sound at altitude (m), metres/second. */
export function speedOfSound(altM) {
  return Math.sqrt(1.4 * 287.05287 * isaTempK(altM));
}

export function machToMps(mach, altM) { return mach * speedOfSound(altM); }
export function mpsToMach(mps, altM) { return mps / speedOfSound(altM); }
