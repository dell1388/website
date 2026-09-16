import { MAP, ROOMS, SPAWN } from '../content/site.js';
import { makeRng, hash2 } from '../core/rng.js';

export const TILE = 40;
export const WALL = 0;
export const FLOOR = 1;

export const STYLE = { stone: 0, wood: 1, grass: 2, dirt: 3, tile: 4, sand: 5 };

/**
 * Builds the playable grid from the room list in content/site.js.
 * Rooms are carved as rectangles, then an L-shaped corridor is dug from the
 * hub centre to each room centre, which automatically punches a doorway.
 */
export function buildWorld() {
  const W = MAP.width, H = MAP.height;
  const grid = new Uint8Array(W * H);          // WALL / FLOOR
  const style = new Uint8Array(W * H);         // STYLE.*
  const roomAt = new Int8Array(W * H).fill(-1);
  const rng = makeRng(20240916);

  const idx = (x, y) => y * W + x;
  const rooms = ROOMS.map((r, i) => ({
    ...r, index: i,
    cx: r.x + (r.w >> 1), cy: r.y + (r.h >> 1),
    discovered: false,
  }));
  const hub = rooms.find((r) => r.hub) || rooms[0];

  const carve = (x, y, s, room) => {
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) { return; }
    grid[idx(x, y)] = FLOOR;
    style[idx(x, y)] = s;
    if (room >= 0) { roomAt[idx(x, y)] = room; }
  };

  for (const r of rooms) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) { carve(x, y, STYLE[r.floor] ?? 0, r.index); }
    }
  }

  const corridorWidth = 3;
  const half = corridorWidth >> 1;
  const digH = (x0, x1, y) => {
    const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
    for (let x = a; x <= b; x++) {
      for (let o = -half; o <= half; o++) {
        if (grid[idx(x, y + o)] !== FLOOR) { carve(x, y + o, STYLE.dirt, -1); }
      }
    }
  };
  const digV = (y0, y1, x) => {
    const [a, b] = y0 < y1 ? [y0, y1] : [y1, y0];
    for (let y = a; y <= b; y++) {
      for (let o = -half; o <= half; o++) {
        if (grid[idx(x + o, y)] !== FLOOR) { carve(x + o, y, STYLE.dirt, -1); }
      }
    }
  };

  const corridors = [];
  for (const r of rooms) {
    if (r === hub) { continue; }
    const order = (r.corridor && r.corridor.order) || 'h';
    const segs = [];
    if (order === 'h') {
      digH(hub.cx, r.cx, hub.cy); digV(hub.cy, r.cy, r.cx);
      segs.push({ axis: 'h', from: hub.cx, to: r.cx, at: hub.cy });
      segs.push({ axis: 'v', from: hub.cy, to: r.cy, at: r.cx });
    } else {
      digV(hub.cy, r.cy, hub.cx); digH(hub.cx, r.cx, r.cy);
      segs.push({ axis: 'v', from: hub.cy, to: r.cy, at: hub.cx });
      segs.push({ axis: 'h', from: hub.cx, to: r.cx, at: r.cy });
    }
    corridors.push({ room: r, segs });
  }

  const world = {
    W, H, grid, style, roomAt, rooms, hub, rng, corridors,
    pxW: W * TILE, pxH: H * TILE,
    idx,
    isWall(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) { return true; }
      return grid[ty * W + tx] === WALL;
    },
    isWallPx(x, y) { return world.isWall(Math.floor(x / TILE), Math.floor(y / TILE)); },
    roomAtPx(x, y) {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) { return null; }
      const i = roomAt[ty * W + tx];
      return i >= 0 ? rooms[i] : null;
    },
    /** Neighbour bitmask: 1=N 2=E 4=S 8=W walls (used by the wall renderer). */
    wallMask(tx, ty) {
      return (world.isWall(tx, ty - 1) ? 1 : 0) | (world.isWall(tx + 1, ty) ? 2 : 0) |
             (world.isWall(tx, ty + 1) ? 4 : 0) | (world.isWall(tx - 1, ty) ? 8 : 0);
    },
  };

  world.spawn = { x: (SPAWN.x + 0.5) * TILE, y: (SPAWN.y + 0.5) * TILE, angle: SPAWN.angle };
  world.decor = buildDecor(world);
  return world;
}

/** Non-blocking scatter: flowers, tufts, pebbles, rugs. Purely visual. */
function buildDecor(world) {
  const out = [];
  const rng = makeRng(99117);
  for (const r of world.rooms) {
    const kinds = r.decor || [];
    const area = r.w * r.h;
    const count = Math.round(area * 0.22);
    for (let i = 0; i < count; i++) {
      const tx = r.x + rng.int(0, r.w - 1);
      const ty = r.y + rng.int(0, r.h - 1);
      if (world.isWall(tx, ty)) { continue; }
      // keep the middle of the room clear for the target + driving room
      const dcx = Math.abs(tx - (r.x + r.w / 2)), dcy = Math.abs(ty - (r.y + r.h / 2));
      if (dcx < 2.5 && dcy < 2.5) { continue; }
      let kind = 'pebble';
      const roll = rng();
      if (kinds.includes('flowers') && roll < 0.42) { kind = 'flower'; }
      else if (kinds.includes('grass') && roll < 0.6) { kind = 'tuft'; }
      else if (roll < 0.72) { kind = 'tuft'; }
      else if (roll < 0.86) { kind = 'pebble'; }
      else { kind = 'crack'; }
      out.push({
        kind,
        x: (tx + rng.range(0.2, 0.8)) * TILE,
        y: (ty + rng.range(0.2, 0.8)) * TILE,
        v: hash2(tx, ty, 7),
        s: rng.range(0.75, 1.3),
      });
    }
  }
  // painted waymarkers down the middle of each corridor, pointing at the room
  const inAnyRoom = (tx, ty) => world.rooms.some(
    (r) => tx >= r.x - 1 && tx < r.x + r.w + 1 && ty >= r.y - 1 && ty < r.y + r.h + 1);
  for (const c of world.corridors) {
    for (const seg of c.segs) {
      const step = seg.to > seg.from ? 1 : -1;
      const ang = seg.axis === 'h' ? (step > 0 ? 0 : Math.PI) : (step > 0 ? Math.PI / 2 : -Math.PI / 2);
      for (let i = 2; Math.abs(i) < Math.abs(seg.to - seg.from) - 1; i += 3) {
        const v = seg.from + i * step;
        const tx = seg.axis === 'h' ? v : seg.at;
        const ty = seg.axis === 'h' ? seg.at : v;
        if (world.isWall(tx, ty) || inAnyRoom(tx, ty)) { continue; }
        out.push({
          kind: 'chevron', x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE,
          a: ang, c: c.room.accent, v: 0, s: 1,
        });
      }
    }
  }

  // sparse tufts along the corridors so they do not look bare
  for (let ty = 1; ty < world.H - 1; ty++) {
    for (let tx = 1; tx < world.W - 1; tx++) {
      if (world.grid[world.idx(tx, ty)] !== FLOOR) { continue; }
      if (world.roomAt[world.idx(tx, ty)] !== -1) { continue; }
      if (!rng.chance(0.16)) { continue; }
      out.push({
        kind: rng.chance(0.4) ? 'tuft' : 'pebble',
        x: (tx + rng.range(0.15, 0.85)) * TILE,
        y: (ty + rng.range(0.15, 0.85)) * TILE,
        v: hash2(tx, ty, 13), s: rng.range(0.6, 1.0),
      });
    }
  }
  return out;
}
