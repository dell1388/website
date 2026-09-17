/**
 * Missile models. Everything here is an arcade approximation picked for
 * readable behaviour on the scopes, not a targeting reference:
 *   - boostMps2 accelerates the round for boostSec, then it coasts at
 *     roughly constant speed (light drag bleed)
 *   - maxGTurn caps how hard it can bend its own flight path per second -
 *     the "pull capability" the brief asked for. Sparrow out-turns the
 *     other two by a wide margin; Harpoon barely turns at all
 *   - maxFlightSec models "range" as a motor/fuel burn time rather than a
 *     distance - a round that's still going when its clock runs out
 *     self-destructs instead of flying forever.
 *
 * Every round's whole speed profile (launch/boost/cruise) is doubled and
 * its agility halved from the original tuning - faster but far less able
 * to correct for a crossing or maneuvering target, which is what makes the
 * projected-intercept cue on the scopes worth having.
 */
export const MISSILES = {
  sparrow: {
    id: 'sparrow', label: 'AIM-7 SPARROW', forKind: 'air',
    launchMps: 520, boostMps2: 420, boostSec: 3.2, cruiseMps: 1700,
    maxGTurn: 9, maxFlightSec: 80, color: '#ffb000',
  },
  harpoon: {
    id: 'harpoon', label: 'AGM-84 HARPOON', forKind: 'sea',
    launchMps: 360, boostMps2: 180, boostSec: 4.5, cruiseMps: 580,
    maxGTurn: 2, maxFlightSec: 300, color: '#3ec8ff',
  },
  hellfire: {
    id: 'hellfire', label: 'AGM-114L LONGBOW', forKind: 'ground',
    launchMps: 280, boostMps2: 280, boostSec: 2.0, cruiseMps: 760,
    maxGTurn: 4.5, maxFlightSec: 130, color: '#ffe14d',
  },
};

/** Ammunition carried at the start of a session - unlimited, per request. */
export const LOADOUT = { sparrow: Infinity, harpoon: Infinity, hellfire: Infinity };

export const FUZE_RADIUS_M = 45;
