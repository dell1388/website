/**
 * Missile models. Everything here is an arcade approximation picked for
 * readable behaviour on the scopes, not a targeting reference:
 *   - boostMps2 accelerates the round for boostSec, then it coasts at
 *     roughly constant speed (light drag bleed)
 *   - maxGTurn caps how hard it can bend its own flight path per second -
 *     the "pull capability" the brief asked for. Sparrow out-turns the
 *     other two by a wide margin; Harpoon barely turns at all
 *
 * Range and fuel are deliberately not modelled - flight ends on a hit or
 * when the target dies, nothing else.
 */
export const MISSILES = {
  sparrow: {
    id: 'sparrow', label: 'AIM-7 SPARROW', forKind: 'air',
    launchMps: 260, boostMps2: 210, boostSec: 3.2, cruiseMps: 850,
    maxGTurn: 18, color: '#ffb000',
  },
  harpoon: {
    id: 'harpoon', label: 'AGM-84 HARPOON', forKind: 'sea',
    launchMps: 180, boostMps2: 90, boostSec: 4.5, cruiseMps: 290,
    maxGTurn: 4, color: '#3ec8ff',
  },
  hellfire: {
    id: 'hellfire', label: 'AGM-114L LONGBOW', forKind: 'ground',
    launchMps: 140, boostMps2: 140, boostSec: 2.0, cruiseMps: 380,
    maxGTurn: 9, color: '#ffe14d',
  },
};

/** Ammunition carried at the start of a session. */
export const LOADOUT = { sparrow: 4, harpoon: 2, hellfire: 6 };

export const FUZE_RADIUS_M = 45;

/**
 * Not a gameplay limit - a safety valve. Without a range/fuel cutoff a
 * round that can genuinely never catch its target (out-agility'd by a
 * maneuvering target, say) would fly forever, quietly piling up in the
 * missile list. Comfortably beyond anything reachable in this world
 * (max scale is 100 km) so it never reads as "the missile ran out."
 */
export const MAX_FLIGHT_DISTANCE_M = 400000;
