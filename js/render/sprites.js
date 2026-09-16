import { P } from './palette.js';
import { TAU } from '../core/rng.js';

const rr = (g, x, y, w, h, r) => {
  g.beginPath();
  if (g.roundRect) { g.roundRect(x, y, w, h, r); }
  else {
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
};

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function shadow(g, x, y, rx, ry = rx * 0.6, alpha = 0.26) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = '#241608';
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  g.restore();
}

/* ------------------------------------------------------------------ tank */
export function drawTank(g, t, time) {
  const bob = Math.sin(time * 9 + t.treadOffset * 0.2) * (t.speed01 * 0.8);
  shadow(g, t.x + 3, t.y + 6, 24, 15, 0.3);
  g.save();
  g.translate(t.x, t.y + bob);
  g.rotate(t.angle);

  // treads
  for (const side of [-1, 1]) {
    const ty = side * 15;
    g.fillStyle = '#2f2114';
    rr(g, -24, ty - 8, 48, 16, 5); g.fill();
    g.fillStyle = '#463222';
    rr(g, -22, ty - 6, 44, 12, 4); g.fill();
    g.fillStyle = '#241a10';
    const off = ((t.treadOffset * side) % 8 + 8) % 8;
    for (let i = -3; i < 6; i++) {
      const x = -22 + i * 8 + off;
      if (x < -22 || x > 16) { continue; }
      g.fillRect(x, ty - 6, 3, 12);
    }
    // wheel bumps
    g.fillStyle = 'rgba(255,240,210,0.10)';
    g.fillRect(-22, ty - 7, 44, 2);
  }

  // hull
  g.fillStyle = P.ink;
  rr(g, -22, -14, 44, 28, 7); g.fill();
  g.fillStyle = '#7c9450';
  rr(g, -20.5, -12.5, 41, 25, 6); g.fill();
  g.fillStyle = '#8fa85c';
  rr(g, -20.5, -12.5, 41, 11, 6); g.fill();
  g.fillStyle = 'rgba(58,40,22,0.35)';
  g.fillRect(-20.5, 5, 41, 7);
  // cream stripe + rivets
  g.fillStyle = P.cream;
  g.fillRect(-4, -12.5, 5, 25);
  g.fillStyle = 'rgba(60,44,26,0.55)';
  for (const rx of [-17, -9, 3, 13]) { g.fillRect(rx, -13.5, 2, 2); g.fillRect(rx, 11.5, 2, 2); }
  // headlights
  g.fillStyle = '#ffe9a8';
  g.beginPath(); g.arc(19, -8, 2.6, 0, TAU); g.arc(19, 8, 2.6, 0, TAU); g.fill();

  // turret
  g.rotate(t.turret - t.angle);
  const recoil = -t.recoil * 6;
  g.fillStyle = P.ink;
  rr(g, 8 + recoil, -4.5, 34, 9, 3); g.fill();
  g.fillStyle = '#6d8547';
  rr(g, 9 + recoil, -3.5, 31, 7, 2.5); g.fill();
  g.fillStyle = '#89a45a';
  g.fillRect(10 + recoil, -3.5, 29, 2.4);
  // muzzle brake
  g.fillStyle = P.ink;
  rr(g, 36 + recoil, -6, 8, 12, 2.5); g.fill();
  g.fillStyle = '#5d7440';
  rr(g, 37 + recoil, -5, 6, 10, 2); g.fill();

  g.fillStyle = P.ink;
  g.beginPath(); g.arc(recoil * 0.4, 0, 14, 0, TAU); g.fill();
  g.fillStyle = '#829b53';
  g.beginPath(); g.arc(recoil * 0.4, 0, 12.5, 0, TAU); g.fill();
  g.fillStyle = '#93ad60';
  g.beginPath(); g.arc(recoil * 0.4, -2, 9.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(58,40,22,0.35)';
  g.beginPath(); g.arc(recoil * 0.4 - 3, 3, 4.5, 0, TAU); g.fill();
  // hatch handle
  g.strokeStyle = P.ink; g.lineWidth = 1.6;
  g.beginPath(); g.arc(recoil * 0.4 - 3, 3, 4.5, 0, TAU); g.stroke();

  // pennant
  g.rotate(-(t.turret - t.angle));
  g.strokeStyle = P.ink; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(-18, -11); g.lineTo(-19, -20); g.stroke();
  const wave = Math.sin(time * 6) * 1.6;
  g.fillStyle = P.red;
  g.beginPath();
  g.moveTo(-19, -20); g.lineTo(-27, -18 + wave); g.lineTo(-19, -14); g.closePath(); g.fill();

  g.restore();
}

/* ---------------------------------------------------------------- target */
export function drawTarget(g, t, time) {
  const bob = Math.sin(time * 2 + t.bob) * 2.2;
  const sx = t.shake > 0 ? (Math.random() * 2 - 1) * t.shake * 4 : 0;
  const locked = !!t.locked;
  shadow(g, t.x, t.y + 26, 22, 9, 0.3);

  g.save();
  g.translate(t.x + sx, t.y + bob);

  // post
  g.fillStyle = P.woodDark; g.fillRect(-4, 6, 8, 24);
  g.fillStyle = P.wood; g.fillRect(-3, 6, 4, 24);
  g.fillStyle = P.woodDark; g.fillRect(-14, 28, 28, 5);

  // glow halo
  const pulse = 0.5 + Math.sin(time * 3 + t.bob) * 0.5;
  g.save();
  const rad = 40 + pulse * 8;
  const hg = g.createRadialGradient(0, 0, 10, 0, 0, rad);
  const hc = locked ? '160,150,138' : hexToRgb(t.accent);
  hg.addColorStop(0, `rgba(${hc},${0.32 + pulse * 0.18})`);
  hg.addColorStop(1, `rgba(${hc},0)`);
  g.fillStyle = hg;
  g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.fill();
  g.restore();

  if (locked) {
    // chained board
    g.fillStyle = P.ink; rr(g, -26, -22, 52, 40, 5); g.fill();
    g.fillStyle = '#9c8f7c'; rr(g, -24, -20, 48, 36, 4); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = -20; i < 20; i += 8) { g.fillRect(-24, i, 48, 2); }
    g.strokeStyle = '#6a6156'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-26, -8); g.lineTo(26, 6); g.stroke();
    g.beginPath(); g.moveTo(-26, 8); g.lineTo(26, -6); g.stroke();
    g.fillStyle = P.gold;
    g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
    g.fillStyle = P.ink; g.fillRect(-2, -1, 4, 6);
  } else {
    const hurt = 1 - t.hp / t.maxHp;
    const rings = [
      { r: 25, c: P.cream }, { r: 20, c: P.red }, { r: 15, c: P.cream },
      { r: 10, c: P.red }, { r: 5, c: P.gold },
    ];
    g.fillStyle = P.ink;
    g.beginPath(); g.arc(0, 0, 27, 0, TAU); g.fill();
    for (const ring of rings) {
      g.fillStyle = ring.c;
      g.beginPath(); g.arc(0, 0, ring.r, 0, TAU); g.fill();
    }
    g.strokeStyle = P.ink; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 25, 0, TAU); g.stroke();
    // damage cracks
    if (hurt > 0) {
      g.strokeStyle = 'rgba(58,40,22,0.75)'; g.lineWidth = 2;
      const n = Math.round(hurt * 3) + 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + t.bob;
        g.beginPath();
        g.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
        g.lineTo(Math.cos(a + 0.4) * 24, Math.sin(a + 0.4) * 24);
        g.stroke();
      }
    }
    if (t.visited) {
      g.fillStyle = P.green;
      g.beginPath(); g.arc(20, -20, 8, 0, TAU); g.fill();
      g.strokeStyle = P.cream; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(16.5, -20); g.lineTo(19, -17); g.lineTo(23.5, -23.5); g.stroke();
    }
  }
  g.restore();

  // hanging sign
  drawSign(g, t.x + sx, t.y - 52 + bob * 0.6, t.label.toUpperCase(), locked ? '#9c8f7c' : t.accent);
}

export function drawSign(g, x, y, text, accent) {
  g.save();
  g.translate(x, y);
  g.font = '700 13px "Press Start 2P", ui-monospace, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.max(90, g.measureText(text).width + 26);
  const h = 30;
  // chains
  g.strokeStyle = 'rgba(58,40,22,0.7)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-w / 2 + 10, h / 2); g.lineTo(-w / 2 + 14, h / 2 + 14); g.stroke();
  g.beginPath(); g.moveTo(w / 2 - 10, h / 2); g.lineTo(w / 2 - 14, h / 2 + 14); g.stroke();

  g.fillStyle = P.ink; rr(g, -w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 6); g.fill();
  g.fillStyle = P.wood; rr(g, -w / 2, -h / 2, w, h, 5); g.fill();
  g.fillStyle = 'rgba(255,235,195,0.16)'; g.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, 5);
  g.fillStyle = accent; g.fillRect(-w / 2 + 4, h / 2 - 6, w - 8, 3);
  g.fillStyle = P.cream;
  g.fillText(text, 0, 1);
  g.restore();
}

/* ----------------------------------------------------------------- props */
export function drawProp(g, p, time) {
  shadow(g, p.x, p.y + p.r * 0.75, p.shadow, p.shadow * 0.5, 0.25);
  g.save();
  g.translate(p.x, p.y);
  const flash = p.hitFlash > 0;
  if (flash) { g.translate((Math.random() * 2 - 1) * 2, (Math.random() * 2 - 1) * 2); }
  switch (p.kind) {
    case 'crate': {
      g.fillStyle = P.ink; rr(g, -16, -16, 32, 32, 4); g.fill();
      g.fillStyle = flash ? '#f8e6c0' : P.wood; rr(g, -14, -14, 28, 28, 3); g.fill();
      g.strokeStyle = P.woodDark; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-13, -13); g.lineTo(13, 13); g.moveTo(13, -13); g.lineTo(-13, 13); g.stroke();
      g.fillStyle = 'rgba(255,235,195,0.18)'; g.fillRect(-14, -14, 28, 4);
      break;
    }
    case 'barrel': {
      g.fillStyle = P.ink; g.beginPath(); g.ellipse(0, 0, 14, 15, 0, 0, TAU); g.fill();
      g.fillStyle = flash ? '#f8e6c0' : '#a4623a';
      g.beginPath(); g.ellipse(0, 0, 12.4, 13.4, 0, 0, TAU); g.fill();
      g.strokeStyle = '#6d3f22'; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(0, -4, 12, 4, 0, 0, Math.PI); g.stroke();
      g.beginPath(); g.ellipse(0, 5, 12, 4, 0, 0, Math.PI); g.stroke();
      g.fillStyle = '#c07d4c'; g.beginPath(); g.ellipse(0, -3, 8, 6, 0, 0, TAU); g.fill();
      break;
    }
    case 'tyre': {
      g.fillStyle = '#2b2118'; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill();
      g.fillStyle = flash ? '#f8e6c0' : '#3b2e22'; g.beginPath(); g.arc(0, -1, 13, 0, TAU); g.fill();
      g.fillStyle = '#20180f'; g.beginPath(); g.arc(0, -1, 6, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, -1, 10, 0, TAU); g.stroke();
      break;
    }
    case 'anvil': {
      g.fillStyle = P.ink; rr(g, -15, -4, 30, 12, 3); g.fill();
      g.fillStyle = '#5c6470'; rr(g, -13, -3, 26, 9, 2); g.fill();
      g.fillStyle = '#767f8c'; g.fillRect(-13, -3, 26, 3);
      g.fillStyle = P.ink; rr(g, -7, 6, 14, 9, 2); g.fill();
      break;
    }
    case 'lantern': {
      const glow = 0.6 + Math.sin(time * 3 + p.wobble) * 0.4;
      g.save();
      const lg = g.createRadialGradient(0, -6, 3, 0, -6, 52);
      lg.addColorStop(0, `rgba(255,224,150,${0.42 * glow})`);
      lg.addColorStop(0.45, `rgba(255,208,120,${0.16 * glow})`);
      lg.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = lg;
      g.beginPath(); g.arc(0, -6, 52, 0, TAU); g.fill();
      g.restore();
      g.fillStyle = P.woodDark; g.fillRect(-2, -2, 4, 18);
      g.fillStyle = P.ink; rr(g, -8, -18, 16, 18, 3); g.fill();
      g.fillStyle = '#ffdf9b'; rr(g, -6, -16, 12, 13, 2); g.fill();
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(0, -10 + Math.sin(time * 6) * 0.6, 3.4, 0, TAU); g.fill();
      break;
    }
    case 'tree': {
      g.fillStyle = P.woodDark; g.fillRect(-5, 2, 10, 16);
      g.fillStyle = '#2f5722'; g.beginPath(); g.arc(0, -6, 20, 0, TAU); g.fill();
      g.fillStyle = '#3f7a2c';
      g.beginPath(); g.arc(-6, -10, 14, 0, TAU); g.arc(8, -4, 13, 0, TAU); g.fill();
      g.fillStyle = '#56a03a';
      g.beginPath(); g.arc(-4, -14, 9, 0, TAU); g.fill();
      break;
    }
    case 'crystal': {
      const glow = 0.5 + Math.sin(time * 2 + p.wobble) * 0.5;
      g.save();
      const cg = g.createRadialGradient(0, -4, 2, 0, -4, 40);
      cg.addColorStop(0, `rgba(198,182,255,${0.40 * glow})`);
      cg.addColorStop(1, 'rgba(150,130,240,0)');
      g.fillStyle = cg;
      g.beginPath(); g.arc(0, -4, 40, 0, TAU); g.fill();
      g.restore();
      g.fillStyle = P.ink;
      g.beginPath(); g.moveTo(0, -22); g.lineTo(11, 2); g.lineTo(0, 14); g.lineTo(-11, 2); g.closePath(); g.fill();
      g.fillStyle = flash ? '#fff' : '#9f8ce6';
      g.beginPath(); g.moveTo(0, -19); g.lineTo(8.5, 2); g.lineTo(0, 11); g.lineTo(-8.5, 2); g.closePath(); g.fill();
      g.fillStyle = '#c9bcff';
      g.beginPath(); g.moveTo(0, -19); g.lineTo(0, 11); g.lineTo(-8.5, 2); g.closePath(); g.fill();
      break;
    }
    default: break;
  }
  g.restore();
}

/* ----------------------------------------------------------------- decor */
const FLOWER_COLORS = ['#e86a8a', '#f2c14e', '#8fa9ff', '#e8f0a0', '#d78ce8'];
export function drawDecor(g, d, time) {
  const x = d.x, y = d.y, s = d.s;
  switch (d.kind) {
    case 'flower': {
      const c = FLOWER_COLORS[(d.v * FLOWER_COLORS.length) | 0];
      const sway = Math.sin(time * 1.6 + d.v * 9) * 0.8;
      g.strokeStyle = '#4b7a33'; g.lineWidth = 1.6 * s;
      g.beginPath(); g.moveTo(x, y + 4 * s); g.lineTo(x + sway, y - 2 * s); g.stroke();
      g.fillStyle = c;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + d.v;
        g.beginPath();
        g.arc(x + sway + Math.cos(a) * 2.6 * s, y - 2 * s + Math.sin(a) * 2.6 * s, 2.1 * s, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#ffe9a0';
      g.beginPath(); g.arc(x + sway, y - 2 * s, 1.7 * s, 0, TAU); g.fill();
      break;
    }
    case 'tuft': {
      const sway = Math.sin(time * 1.3 + d.v * 12) * 1.2;
      g.strokeStyle = d.v > 0.5 ? '#4f8a35' : '#5f9e42';
      g.lineWidth = 1.7 * s; g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(x + i * 3 * s, y + 3 * s);
        g.quadraticCurveTo(x + i * 3.6 * s, y - 1 * s, x + i * 4 * s + sway, y - 5 * s);
        g.stroke();
      }
      break;
    }
    case 'pebble': {
      g.fillStyle = 'rgba(60,44,26,0.30)';
      g.beginPath(); g.ellipse(x, y, 3.2 * s, 2.3 * s, d.v * 3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,240,210,0.16)';
      g.beginPath(); g.ellipse(x - 0.6, y - 0.8, 2 * s, 1.3 * s, d.v * 3, 0, TAU); g.fill();
      break;
    }
    case 'chevron': {
      g.save();
      g.translate(x, y);
      g.rotate(d.a);
      for (let i = 0; i < 2; i++) {
        const o = i * 11 - 6;
        g.beginPath();
        g.moveTo(o, -13); g.lineTo(o + 11, 0); g.lineTo(o, 13);
        g.lineTo(o - 5.5, 13); g.lineTo(o + 5.5, 0); g.lineTo(o - 5.5, -13);
        g.closePath();
        g.globalAlpha = 0.28;
        g.fillStyle = '#3b2a1b';
        g.translate(0, 2); g.fill(); g.translate(0, -2);
        g.globalAlpha = 0.62;
        g.fillStyle = d.c || '#e8b44a';
        g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
      break;
    }
    case 'crack': {
      g.strokeStyle = 'rgba(50,36,20,0.16)'; g.lineWidth = 1.4 * s;
      g.beginPath();
      g.moveTo(x - 7 * s, y - 2 * s);
      g.lineTo(x - 1 * s, y + 1 * s);
      g.lineTo(x + 4 * s, y - 3 * s);
      g.lineTo(x + 9 * s, y + 2 * s);
      g.stroke();
      break;
    }
    default: break;
  }
}

export { rr as roundRect };
