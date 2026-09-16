import { TILE, FLOOR } from '../world/world.js';
import { FLOORS, WALL_C, P } from './palette.js';
import { hash2, TAU } from '../core/rng.js';
import { drawDecor, drawProp, drawTarget, drawTank, roundRect } from './sprites.js';

export class Renderer {
  constructor(world) {
    this.world = world;
    this.decalScale = 0.25;
    this.decals = null;
    this.dg = null;
    // Tread marks are a nicety. A device that refuses the extra canvas
    // (low memory, mostly iOS) should still get the game.
    try {
      const c = document.createElement('canvas');
      c.width = Math.ceil(world.pxW * this.decalScale);
      c.height = Math.ceil(world.pxH * this.decalScale);
      const dg = c.getContext('2d');
      if (dg) {
        dg.fillStyle = 'rgba(58,40,22,0.5)';
        this.decals = c;
        this.dg = dg;
      } else {
        console.warn('[garrison] no 2D context for the decal layer; skipping tread marks');
      }
    } catch (e) {
      console.warn('[garrison] decal layer unavailable', e);
    }
  }

  /** Tread mark / scorch stamped into the ground layer. */
  stamp(x, y, r, alpha = 0.22, color = '58,40,22') {
    if (!this.dg) { return; }
    const s = this.decalScale;
    this.dg.globalAlpha = alpha;
    this.dg.fillStyle = `rgba(${color},1)`;
    this.dg.beginPath();
    this.dg.arc(x * s, y * s, r * s, 0, TAU);
    this.dg.fill();
    this.dg.globalAlpha = 1;
  }

  drawFloor(g, view) {
    const w = this.world;
    const x0 = Math.max(0, Math.floor(view.x0 / TILE) - 1);
    const x1 = Math.min(w.W - 1, Math.floor(view.x1 / TILE) + 1);
    const y0 = Math.max(0, Math.floor(view.y0 / TILE) - 1);
    const y1 = Math.min(w.H - 1, Math.floor(view.y1 / TILE) + 1);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const i = ty * w.W + tx;
        if (w.grid[i] !== FLOOR) { continue; }
        const f = FLOORS[w.style[i]] || FLOORS[0];
        const px = tx * TILE, py = ty * TILE;
        const h = hash2(tx, ty, 3);
        g.fillStyle = f.base;
        g.fillRect(px, py, TILE, TILE);

        const st = w.style[i];
        if (st === 1) {                                  // wood planks
          g.fillStyle = h > 0.5 ? f.a : f.b;
          g.fillRect(px, py + (h > 0.5 ? 0 : TILE / 2), TILE, TILE / 2);
          g.fillStyle = f.joint;
          g.fillRect(px, py + TILE / 2 - 1, TILE, 2);
          g.fillRect(px + (h * TILE | 0), py, 2, TILE / 2);
        } else if (st === 0 || st === 4) {               // stone / arcane tiles
          const q = TILE / 2;
          for (let sy = 0; sy < 2; sy++) {
            for (let sx = 0; sx < 2; sx++) {
              const hh = hash2(tx * 2 + sx, ty * 2 + sy, 11);
              g.fillStyle = hh > 0.5 ? f.a : f.b;
              g.fillRect(px + sx * q + 1, py + sy * q + 1, q - 2, q - 2);
            }
          }
          g.fillStyle = f.joint;
          g.globalAlpha = 0.5;
          g.fillRect(px, py + q - 1, TILE, 1.5);
          g.fillRect(px + q - 1, py, 1.5, TILE);
          g.globalAlpha = 1;
        } else {                                          // grass / dirt / sand
          g.fillStyle = h > 0.55 ? f.a : f.b;
          const n = 3;
          for (let k = 0; k < n; k++) {
            const hx = hash2(tx, ty, 17 + k), hy = hash2(tx, ty, 29 + k);
            g.fillRect(px + hx * (TILE - 10), py + hy * (TILE - 10), 6 + hx * 5, 5 + hy * 4);
          }
        }
      }
    }

    // ground decals (tread marks, scorches) - blit only the visible slice
    const s = this.decalScale;
    if (!this.decals) { return; }
    const dx0 = Math.max(0, Math.floor(view.x0)), dy0 = Math.max(0, Math.floor(view.y0));
    const dx1 = Math.min(w.pxW, Math.ceil(view.x1)), dy1 = Math.min(w.pxH, Math.ceil(view.y1));
    if (dx1 > dx0 && dy1 > dy0) {
      g.save();
      g.globalAlpha = 0.85;
      g.drawImage(
        this.decals,
        dx0 * s, dy0 * s, (dx1 - dx0) * s, (dy1 - dy0) * s,
        dx0, dy0, dx1 - dx0, dy1 - dy0);
      g.restore();
    }
  }

  drawRoomBanners(g, view, time) {
    const g2 = g;
    for (const r of this.world.rooms) {
      const cx = (r.x + r.w / 2) * TILE;
      const cy = (r.y + 0.9) * TILE;
      if (cx < view.x0 - 300 || cx > view.x1 + 300 || cy < view.y0 - 200 || cy > view.y1 + 200) { continue; }
      g2.save();
      g2.textAlign = 'center';
      g2.textBaseline = 'middle';
      g2.font = '12px "Press Start 2P", ui-monospace, monospace';
      g2.globalAlpha = 0.5;
      g2.lineWidth = 5;
      g2.strokeStyle = 'rgba(250,236,205,0.55)';
      g2.strokeText(r.name.toUpperCase(), cx, cy);
      g2.fillStyle = 'rgba(70,48,28,0.85)';
      g2.fillText(r.name.toUpperCase(), cx, cy);
      g2.restore();
    }
  }

  drawWalls(g, view, time) {
    const w = this.world;
    const x0 = Math.max(0, Math.floor(view.x0 / TILE) - 1);
    const x1 = Math.min(w.W - 1, Math.floor(view.x1 / TILE) + 1);
    const y0 = Math.max(0, Math.floor(view.y0 / TILE) - 1);
    const y1 = Math.min(w.H - 1, Math.floor(view.y1 / TILE) + 2);

    // drop shadows onto floors first
    g.save();
    g.fillStyle = 'rgba(40,26,14,0.22)';
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!w.isWall(tx, ty)) { continue; }
        if (!w.isWall(tx, ty + 1)) { g.fillRect(tx * TILE, (ty + 1) * TILE, TILE, 9); }
        if (!w.isWall(tx + 1, ty)) { g.fillRect((tx + 1) * TILE, ty * TILE, 7, TILE); }
      }
    }
    g.restore();

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!w.isWall(tx, ty)) { continue; }
        const px = tx * TILE, py = ty * TILE;
        const mask = w.wallMask(tx, ty);
        const exposed = mask !== 15;
        const h = hash2(tx, ty, 5);

        g.fillStyle = exposed ? WALL_C.face : WALL_C.top;
        g.fillRect(px, py, TILE, TILE);

        if (!exposed) {
          // deep rock: barely-there texture so the void is not a flat slab
          g.fillStyle = h > 0.5 ? 'rgba(255,225,185,0.035)' : 'rgba(20,12,5,0.22)';
          g.fillRect(px + 4 + h * 18, py + 5 + h * 16, 10 + h * 8, 8 + h * 6);
          g.fillStyle = 'rgba(20,12,5,0.14)';
          g.fillRect(px, py + TILE - 2, TILE, 2);
          g.fillRect(px + TILE - 2, py, 2, TILE);
          continue;
        }

        {
          // chunky block bevel
          g.fillStyle = WALL_C.faceHi;
          g.fillRect(px + 2, py + 2, TILE - 4, TILE - 8);
          g.fillStyle = WALL_C.outer;
          g.fillRect(px + 2, py + TILE - 8, TILE - 4, 6);
          // stone speckle
          g.fillStyle = 'rgba(255,235,195,0.08)';
          g.fillRect(px + 5 + h * 12, py + 6 + h * 10, 7, 5);
          g.fillStyle = 'rgba(40,24,12,0.18)';
          g.fillRect(px + 20 - h * 10, py + 20 + h * 8, 9, 6);

          // cap on the south-facing edge (the face you look at)
          if (!(mask & 4)) {
            g.fillStyle = WALL_C.cap;
            g.fillRect(px, py + TILE - 12, TILE, 12);
            g.fillStyle = WALL_C.capHi;
            g.fillRect(px, py + TILE - 12, TILE, 3);
          }
          // moss on top edge when facing an open floor
          if (!(mask & 1)) {
            g.fillStyle = WALL_C.capHi;
            g.fillRect(px, py, TILE, 4);
            if (h > 0.55) {
              g.fillStyle = WALL_C.moss;
              g.fillRect(px + 4 + h * 10, py, 12 + h * 8, 3);
              g.fillRect(px + 6 + h * 8, py + 3, 6, 2);
            }
          }
          if (!(mask & 2)) { g.fillStyle = 'rgba(40,24,12,0.22)'; g.fillRect(px + TILE - 4, py, 4, TILE); }
          if (!(mask & 8)) { g.fillStyle = 'rgba(255,235,195,0.07)'; g.fillRect(px, py, 4, TILE); }

          g.strokeStyle = 'rgba(38,24,12,0.55)';
          g.lineWidth = 1;
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
      }
    }
  }

  drawEntities(g, state, time) {
    const { world, tank, particles, bullets } = state;
    const view = state.camera.view();
    const sortable = [];
    for (const p of world.props) {
      if (p.dead) { continue; }
      if (p.x < view.x0 - 60 || p.x > view.x1 + 60 || p.y < view.y0 - 60 || p.y > view.y1 + 60) { continue; }
      sortable.push({ y: p.y, draw: (gg) => drawProp(gg, p, time) });
    }
    for (const t of world.targets) {
      if (t.state === 'done') { continue; }
      sortable.push({ y: t.y, draw: (gg) => drawTarget(gg, t, time) });
    }
    sortable.push({ y: tank.y, draw: (gg) => drawTank(gg, tank, time) });
    sortable.sort((a, b) => a.y - b.y);
    for (const s of sortable) { s.draw(g); }

    // shells
    for (const b of bullets.list) {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.angle);
      g.globalAlpha = 0.35;
      g.fillStyle = '#ffdca0';
      g.fillRect(-22, -2.5, 24, 5);
      g.globalAlpha = 1;
      g.fillStyle = P.ink; roundRect(g, -7, -3.5, 14, 7, 3); g.fill();
      g.fillStyle = '#ffe9b0'; roundRect(g, -6, -2.5, 12, 5, 2.5); g.fill();
      g.fillStyle = '#fff6dd'; g.fillRect(2, -1.5, 3, 3);
      g.restore();
    }
    particles.draw(g);
  }

  /**
   * One cached radial pass: warm haze in the middle, dusk at the edges.
   * Single source-over fill keeps this cheap on software rasterisers.
   */
  drawLighting(g, state) {
    const { camera } = state;
    const view = camera.view();
    const w = view.x1 - view.x0, h = view.y1 - view.y0;
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (key !== this._lightKey) {
      this._lightKey = key;
      this._lightR = Math.max(w, h) * 0.78;
    }
    const r = this._lightR;
    const grad = g.createRadialGradient(camera.x, camera.y - h * 0.06, r * 0.12, camera.x, camera.y, r);
    grad.addColorStop(0, 'rgba(255,241,206,0.13)');
    grad.addColorStop(0.42, 'rgba(255,226,178,0.05)');
    grad.addColorStop(0.72, 'rgba(78,48,22,0.12)');
    grad.addColorStop(1, 'rgba(34,20,9,0.52)');
    g.fillStyle = grad;
    g.fillRect(view.x0 - 2, view.y0 - 2, w + 4, h + 4);
  }
}

export { drawDecor };
