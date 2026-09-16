import { TILE } from '../world/world.js';

/**
 * One shootable target per room that has an `href`.
 * Rooms with `locked` get an unbreakable sign instead - shooting it just
 * rattles and shows the locked label.
 */
export function buildTargets(world) {
  const targets = [];
  for (const r of world.rooms) {
    if (r.hub) { continue; }
    targets.push({
      room: r,
      id: r.id,
      label: r.name,
      blurb: r.blurb,
      href: r.href || null,
      locked: r.locked || null,
      accent: r.accent || '#c98f4b',
      x: (r.x + r.w / 2) * TILE,
      y: (r.y + r.h / 2) * TILE,
      r: 26,
      hp: 3,
      maxHp: 3,
      state: 'idle',              // idle | breaking | done
      shake: 0,
      bob: Math.random() * 6.28,
      openT: 0,
      visited: localStorage.getItem('garrison.visited.' + r.id) === '1',
      dead: false,
    });
  }
  return targets;
}

export function markVisited(t) {
  try { localStorage.setItem('garrison.visited.' + t.id, '1'); } catch (e) { /* private mode */ }
  t.visited = true;
}
