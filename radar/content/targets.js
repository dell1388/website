/**
 * TARGET DEFINITIONS
 * ===================
 * Every contact the radar can paint. `href` is the page a lock-and-kill
 * opens; leave it out (with `locked`) for a no-strike practice contact,
 * same convention as garrison/content/site.js.
 *
 * kind:
 *   'air'          - moving aircraft, painted by SRC / TWS
 *   'ground_fixed' - stationary, low return, painted by SRC HDN / TWS HDN
 *   'ground_mover' - stationary position but classed as a mover, painted
 *                    only by SRC GMTI / TWS GMTI
 *   'sea'          - stationary surface contact, painted by TWS SEA
 *
 * Position is set in km, east/north of the origin the player starts over
 * (x = east, y = north). Air targets get a heading (compass degrees) and a
 * mach speed; they fly that vector forever and re-spawn on the far side
 * when they leave the operating area. Ground/sea targets do not translate,
 * but a 'ground_mover' gets a small leashed wander so it still reads as a
 * moving contact up close.
 */
export const TARGETS = [
  {
    id: 'aetherfall',
    name: 'AETHERFALL',
    kind: 'air',
    href: '/wizardgame/',
    accent: '#2dff6a',
    x: -22, y: 42,
    altM: 8200, headingDeg: 205, mach: 0.95,
    dossier: {
      cls: 'AIR',
      modes: 'SRC · TWS',
      profile: 'M0.80–1.10, 500–10,000 m, manoeuvring. Fast mover, crosses ' +
        'the scan box quickly - lead it or lose it.',
    },
  },
  {
    id: 'wordwar3',
    name: 'WORD WAR 3',
    kind: 'ground_mover',
    href: '/clockwords/',
    accent: '#ffe14d',
    x: 7, y: 22,
    dossier: {
      cls: 'GROUND',
      modes: 'SRC GMTI · TWS GMTI',
      profile: 'Armoured column. Only paints in a GMTI mode; invisible to ' +
        'plain air search or the ground map.',
    },
  },
  {
    id: 'vehiclespotter',
    name: 'VEHICLE SPOTTER',
    kind: 'sea',
    href: '/vehicle-spotter/',
    accent: '#3ec8ff',
    x: 55, y: 61,
    dossier: {
      cls: 'SURFACE',
      modes: 'TWS SEA',
      profile: 'Stationary hull, large return. Sea mode only, and it sits ' +
        'well out - needs the 100 km scale.',
    },
  },
  {
    id: 'fieldnotes',
    name: 'FIELD NOTES',
    kind: 'ground_fixed',
    href: '/classic.html',
    accent: '#ffe14d',
    x: -8, y: 38,
    dossier: {
      cls: 'GROUND',
      modes: 'SRC HDN · TWS HDN',
      profile: 'Static site, low return, hidden in clutter. Needs a HDN ' +
        'mode and a tight scan pattern to resolve.',
    },
  },
  {
    id: 'workshop',
    name: 'THE WORKSHOP',
    kind: 'ground_fixed',
    href: null,
    locked: 'UNDER CONSTRUCTION',
    accent: '#9c8f7c',
    x: 8, y: 34,
    dossier: {
      cls: 'NO-STRIKE',
      modes: '—',
      profile: 'Under construction. Paints on the scope, refuses lock.',
    },
  },
];

/** Decorative practice contacts - lockable and shootable, open nothing. */
export const BOGEYS = [
  // Placed so it sits inside the default antenna box (TWS, 60x10, boresight
  // dead ahead) the instant the page loads - the beam's own idle sweep finds
  // it within a couple of seconds with no player input, proving the radar
  // works before anyone has to learn how to search with it.
  { id: 'bogey1', name: 'BOGEY 1', kind: 'air', x: 5, y: 29, altM: 4400, headingDeg: 260, mach: 1.05 },
  { id: 'bogey2', name: 'BOGEY 2', kind: 'air', x: -60, y: 80, altM: 1200, headingDeg: 95, mach: 0.82 },
];

export const WEAPON_BY_KIND = {
  air: 'sparrow',
  ground_mover: 'hellfire',
  ground_fixed: 'hellfire',
  sea: 'harpoon',
};

export const OWNSHIP = { mach: 1.2, altM: 6000, headingDeg: 0 };
