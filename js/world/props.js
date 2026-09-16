import { TILE } from './world.js';
import { makeRng } from '../core/rng.js';

const BLOCKING = {
  crate:   { r: 15, hp: 2, shadow: 16 },
  barrel:  { r: 13, hp: 2, shadow: 14 },
  tyre:    { r: 14, hp: 3, shadow: 15 },
  anvil:   { r: 15, hp: 0, shadow: 16 },
  lantern: { r: 9,  hp: 1, shadow: 10 },
  tree:    { r: 17, hp: 0, shadow: 20 },
  crystal: { r: 12, hp: 2, shadow: 13 },
};

/** Solid, mostly shootable scenery placed inside rooms. */
export function buildProps(world) {
  const rng = makeRng(555123);
  const props = [];
  for (const r of world.rooms) {
    const kinds = (r.decor || []).filter((k) => BLOCKING[k]);
    if (!kinds.length) { continue; }
    const tries = r.w * r.h * 0.25;
    for (let i = 0; i < tries; i++) {
      const tx = r.x + rng.int(1, r.w - 2);
      const ty = r.y + rng.int(1, r.h - 2);
      if (world.isWall(tx, ty)) { continue; }
      // keep doorways and the room centre clear
      let open = true;
      for (let dy = -1; dy <= 1 && open; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (world.isWall(tx + dx, ty + dy)) { open = false; break; }
        }
      }
      if (!open) { continue; }
      const dcx = Math.abs(tx - (r.x + r.w / 2)), dcy = Math.abs(ty - (r.y + r.h / 2));
      if (dcx < 3.5 && dcy < 3.5) { continue; }
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      if (props.some((p) => Math.hypot(p.x - x, p.y - y) < TILE * 1.4)) { continue; }
      const kind = rng.pick(kinds);
      const def = BLOCKING[kind];
      props.push({
        kind, x, y, r: def.r, hp: def.hp, maxHp: def.hp, shadow: def.shadow,
        dead: false, hitFlash: 0, wobble: rng.range(0, 6.28), room: r.id,
      });
      if (props.length > 140) { return props; }
    }
  }
  return props;
}

export { BLOCKING };
