/**
 * Weapon display metadata. The actual flight dynamics (mass, thrust, wing,
 * fuel, agility) live as engine profiles in ../engine/profiles.js - this is
 * just the label/color/kind-routing layer the radar UI reads, plus which
 * engine profile each weapon flies.
 */
export const MISSILES = {
  sparrow: { id: 'sparrow', label: 'AIM-7 SPARROW', profile: 'sparrow_missile', color: '#ffb000' },
  harpoon: { id: 'harpoon', label: 'AGM-84 HARPOON', profile: 'harpoon_missile', color: '#3ec8ff' },
  hellfire: { id: 'hellfire', label: 'AGM-114L LONGBOW', profile: 'hellfire_missile', color: '#ffe14d' },
};

/** Ammunition carried at the start of a session - unlimited, per request. */
export const LOADOUT = { sparrow: Infinity, harpoon: Infinity, hellfire: Infinity };
