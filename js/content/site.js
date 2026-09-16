/**
 * SITE CONTENT
 * ============
 * This is the ONE file you edit to add a new page to the world.
 *
 * Add a room object below and the world builder will:
 *   - carve the room out of the map
 *   - dig a corridor from the hub to it
 *   - place a shootable target that navigates to `href`
 *   - add it to the minimap + objective list
 *
 * Tile coordinates are in tiles (TILE = 40px of world space).
 * Rooms must not overlap and should stay >= 2 tiles from the map edge.
 */

export const MAP = { width: 84, height: 60 };

/** Floor styles: 'wood' | 'stone' | 'grass' | 'dirt' | 'tile' | 'sand' */
export const ROOMS = [
  {
    id: 'hub',
    name: 'The Motor Pool',
    blurb: 'Pick a road. Shoot the sign.',
    x: 35, y: 24, w: 14, h: 12,
    floor: 'stone',
    accent: '#c98f4b',
    hub: true,
    decor: ['lantern', 'crate', 'flowers'],
  },
  {
    id: 'armory',
    name: 'Word War 3',
    blurb: 'Type words to fire shells at an armoured column.',
    x: 9, y: 5, w: 17, h: 12,
    floor: 'wood',
    accent: '#b0533f',
    href: '/clockwords/',
    corridor: { order: 'h' },
    decor: ['crate', 'barrel', 'rug'],
  },
  {
    id: 'spire',
    name: 'Aetherfall',
    blurb: 'A duelling arena for wizards. Bind spells, or type them.',
    x: 58, y: 5, w: 17, h: 12,
    floor: 'tile',
    accent: '#7a6bd6',
    href: '/wizardgame/',
    corridor: { order: 'h' },
    decor: ['lantern', 'crystal', 'rug'],
  },
  {
    id: 'yard',
    name: 'Vehicle Spotter',
    blurb: 'Name the vehicle in the photo. 32 vehicles, five eras.',
    x: 8, y: 40, w: 18, h: 14,
    floor: 'sand',
    accent: '#7d9b4e',
    href: '/vehicle-spotter/',
    corridor: { order: 'h' },
    decor: ['crate', 'barrel', 'tyre', 'grass'],
  },
  {
    id: 'workshop',
    name: 'The Workshop',
    blurb: 'Where the next thing gets built. Empty for now.',
    x: 59, y: 40, w: 17, h: 14,
    floor: 'wood',
    accent: '#d3a03c',
    href: null,               // no href => target is a "locked" sign, cannot be shot open
    locked: 'UNDER CONSTRUCTION',
    corridor: { order: 'h' },
    decor: ['crate', 'anvil', 'lantern'],
  },
  {
    id: 'greenhouse',
    name: 'The Greenhouse',
    blurb: 'Sunlight, soil and absolutely no tanks allowed.',
    x: 34, y: 3, w: 16, h: 12,
    floor: 'grass',
    accent: '#5aa05a',
    href: null,
    locked: 'SEASONAL',
    corridor: { order: 'v' },
    decor: ['flowers', 'tree', 'grass', 'crystal'],
  },
  {
    id: 'archive',
    name: 'Field Notes',
    blurb: 'Notes, credits and the old plain-text front page.',
    x: 36, y: 46, w: 13, h: 11,
    floor: 'stone',
    accent: '#8d7bb0',
    href: '/classic.html',
    corridor: { order: 'v' },
    decor: ['crate', 'lantern', 'rug'],
  },
];

/** Where the tank starts (tile coords, inside the hub). */
export const SPAWN = { x: 42, y: 32, angle: -Math.PI / 2 };

export const SITE = {
  title: 'GARRISON',
  subtitle: 'drive · aim · breach',
  credit: {
    text: 'Background: CV90120 by Swadim, CC BY-SA 4.0',
    href: 'https://commons.wikimedia.org/wiki/File:CV90120.jpg',
  },
};
