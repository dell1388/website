/**
 * Weapon display metadata and target-compatibility rules. The actual flight
 * dynamics (mass, thrust, wing, fuel, agility) live as engine profiles in
 * ../engine/profiles.js - this is the label/color layer plus which engine
 * profile each weapon flies, and the compatibility rules the player has to
 * work out for themselves since nothing auto-selects a weapon anymore.
 */
export const MISSILES = {
  amraam: { id: 'amraam', label: 'AIM-120C-5', profile: 'amraam_missile', color: '#ffb000' },
  harpoon: { id: 'harpoon', label: 'AGM-84C', profile: 'harpoon_missile', color: '#3ec8ff' },
  hellfire: { id: 'hellfire', label: 'AGM-114L', profile: 'hellfire_missile', color: '#ffe14d' },
};

/** Ammunition carried at the start of a session - unlimited, per request. */
export const LOADOUT = { amraam: Infinity, harpoon: Infinity, hellfire: Infinity };

/**
 * Whether `weaponId` will even leave the rail at a target of `targetKind` -
 * the player picks the weapon now, so picking wrong has to actually mean
 * something instead of the game quietly doing the sensible thing anyway:
 *   - AMRAAM: an active-radar air-to-air round, refuses a ground target
 *     outright (it'll still go after a surface contact - nothing stops a
 *     radar missile physically flying at a slow, unmanoeuvring ship).
 *   - AGM-84C: an anti-ship missile, only ever fires at a surface contact.
 *   - AGM-114L: a fire-and-forget round with no target-type interlock at
 *     all - see `profileFor` and `isNoDamage` for what actually happens
 *     when it's sent after something it wasn't built for.
 */
export function canFire(weaponId, targetKind) {
  if (weaponId === 'amraam') { return targetKind !== 'ground_fixed' && targetKind !== 'ground_mover'; }
  if (weaponId === 'harpoon') { return targetKind === 'sea'; }
  return true;
}

/**
 * The engine profile a launch actually flies. Hellfire fired at an air
 * target still leaves the rail (see `canFire`) but is carrying a laser/
 * fire-and-forget seeker built for a slow or stationary target, not a
 * manoeuvring aircraft - modelled as sharply reduced agility rather than a
 * scripted miss, so it's a *plausible* failure (a lucky shot can still
 * connect) instead of a guaranteed one.
 */
export function profileNameFor(weaponId, targetKind) {
  const w = MISSILES[weaponId];
  if (weaponId === 'hellfire' && targetKind === 'air') { return 'hellfire_missile_vs_air'; }
  return w.profile;
}

/**
 * Hellfire's warhead is sized for armour and structures, not a ship's
 * hull - a hit still happens (the round can still close and fuze), but it
 * doesn't do the job: the target survives.
 */
export function isNoDamage(weaponId, targetKind) {
  return weaponId === 'hellfire' && targetKind === 'sea';
}
