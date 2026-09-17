import { GIMBAL } from '../sim/config.js';
import { scaleKm, pattern, beamPos } from '../sim/radar.js';
import { missileRelative } from '../sim/missile.js';
import { projectFeature } from './map.js';
import { P } from './palette.js';

const DPR = Math.min(2, devicePixelRatio || 1);
const FONT = '11px "Share Tech Mono", monospace';
const FONT_SM = '10px "Share Tech Mono", monospace';

function fit(cv) {
  const r = cv.parentElement.getBoundingClientRect();
  const w = Math.max(1, r.width - 6), h = Math.max(1, r.height - 6);
  cv.width = Math.floor(w * DPR);
  cv.height = Math.floor(h * DPR);
  const g = cv.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  return { g, w, h };
}

function grid(g, w, h, cols, rows) {
  g.strokeStyle = P.greenFaint; g.lineWidth = 1;
  for (let i = 1; i < cols; i++) { const x = (i / cols) * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let i = 1; i < rows; i++) { const y = (i / rows) * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = P.greenDim;
  g.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function label(g, t, x, y, c, font) {
  g.font = font || FONT_SM; g.fillStyle = c; g.fillText(t, x, y);
}

const contactColor = (c) => c.locked ? '#9c8f7c' : (P[{ air: 'green', sea: 'sea', ground_fixed: 'gnd', ground_mover: 'gnd' }[c.kind]] || P.green);

function drawGlyph(g, kind, x, y, s, color) {
  g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 8;
  if (kind === 'air') {
    g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath(); g.fill();
  } else if (kind === 'sea') {
    g.beginPath(); g.arc(x, y, s * 0.9, 0, Math.PI * 2); g.fill();
  } else {
    g.fillRect(x - s * 0.85, y - s * 0.85, s * 1.7, s * 1.7);
  }
  g.shadowBlur = 0;
}

/* ------------------------------------------------------------ B-SCOPE */
/* x = azimuth across the full mechanical gimbal travel, y = range (near
 * at the bottom, far at the top) - the classic B-scope layout. */
export function drawB(cv, world, radar, missiles, terrain, time) {
  const { g, w, h } = fit(cv);
  g.clearRect(0, 0, w, h);
  const az0 = -GIMBAL.azLimit, az1 = GIMBAL.azLimit;
  const maxR = scaleKm(radar);
  const X = (az) => ((az - az0) / (az1 - az0)) * w;
  const Y = (rn) => h - Math.min(1, rn / maxR) * h;

  // ground truth terrain, re-projected from the ownship's real position
  g.lineWidth = 1.3;
  for (const f of terrain) {
    g.strokeStyle = f.sea ? 'rgba(62,200,255,.16)' : 'rgba(45,255,106,.10)';
    g.beginPath(); let started = false;
    for (const rel of projectFeature(world.own, f, maxR, GIMBAL.azLimit)) {
      if (!rel) { started = false; continue; }
      const px = X(rel.az), py = Y(rel.rangeKm);
      started ? g.lineTo(px, py) : g.moveTo(px, py);
      started = true;
    }
    g.stroke();
  }

  grid(g, w, h, 8, 4);
  for (let i = 1; i <= 4; i++) { label(g, Math.round(maxR * i / 4) + ' KM', 5, Y(maxR * i / 4) - 5, P.greenDim); }
  for (const a of [-60, -30, 0, 30, 60]) { label(g, (a > 0 ? '+' : '') + a + '°', X(a) - 11, h - 6, P.greenDim); }

  // current scan sector (pattern box in azimuth only - range is unbounded)
  const pat = pattern(radar);
  g.strokeStyle = 'rgba(255,176,0,.5)'; g.setLineDash([4, 3]); g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(X(radar.antAz - pat.az), 0); g.lineTo(X(radar.antAz - pat.az), h); g.stroke();
  g.beginPath(); g.moveTo(X(radar.antAz + pat.az), 0); g.lineTo(X(radar.antAz + pat.az), h); g.stroke();
  g.setLineDash([]);

  // instantaneous beam
  const beam = beamPos(radar);
  const bx = X(beam.az);
  const grd = g.createLinearGradient(bx - 40, 0, bx + 40, 0);
  grd.addColorStop(0, 'rgba(196,255,214,0)'); grd.addColorStop(0.5, 'rgba(196,255,214,.14)'); grd.addColorStop(1, 'rgba(196,255,214,0)');
  g.fillStyle = grd; g.fillRect(bx - 40, 0, 80, h);
  g.strokeStyle = 'rgba(196,255,214,.9)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx, h); g.stroke();

  drawContacts(g, radar, world.time, X, Y, (c) => c.az, (c) => c.rangeKm, true);

  for (const m of missiles) {
    if (!m.alive) { continue; }
    const rel = missileRelative(world, m);
    if (rel.rangeKm > maxR || Math.abs(rel.az) > GIMBAL.azLimit) { continue; }
    drawMissile(g, X(rel.az), Y(rel.rangeKm), m, world);
  }

  // ownship
  g.strokeStyle = 'rgba(196,255,214,.9)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(X(0) - 9, h - 1); g.lineTo(X(0), h - 13); g.lineTo(X(0) + 9, h - 1); g.stroke();
}

/* ------------------------------------------------------------ C-SCOPE */
/* x = azimuth, y = elevation - the whole gimbal envelope. */
export function drawC(cv, world, radar, missiles, time) {
  const { g, w, h } = fit(cv);
  g.clearRect(0, 0, w, h);
  const X = (az) => ((az + GIMBAL.azLimit) / (2 * GIMBAL.azLimit)) * w;
  const Y = (el) => (1 - (el + GIMBAL.elLimit) / (2 * GIMBAL.elLimit)) * h;
  grid(g, w, h, 6, 4);

  const pat = pattern(radar);
  g.strokeStyle = 'rgba(255,176,0,.55)'; g.setLineDash([4, 3]); g.lineWidth = 1.3;
  g.strokeRect(X(radar.antAz - pat.az), Y(radar.antEl + pat.el),
    X(radar.antAz + pat.az) - X(radar.antAz - pat.az), Y(radar.antEl - pat.el) - Y(radar.antEl + pat.el));
  g.setLineDash([]);

  g.strokeStyle = P.greenDim; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke();

  const beam = beamPos(radar);
  g.fillStyle = 'rgba(196,255,214,.9)'; g.beginPath(); g.arc(X(beam.az), Y(beam.el), 3, 0, Math.PI * 2); g.fill();

  drawContacts(g, radar, world.time, X, Y, (c) => c.az, (c) => c.el, false);

  for (const m of missiles) {
    if (!m.alive) { continue; }
    const rel = missileRelative(world, m);
    if (Math.abs(rel.az) > GIMBAL.azLimit || Math.abs(rel.el) > GIMBAL.elLimit) { continue; }
    drawMissile(g, X(rel.az), Y(rel.el), m, world);
  }
  label(g, '-90', 4, h - 6, P.greenDim); label(g, '+90', w - 30, h - 6, P.greenDim); label(g, '+60', 4, 14, P.greenDim);
}

/* ------------------------------------------------------------ E-SCOPE */
/* x = range, y = elevation. */
export function drawE(cv, world, radar, missiles, time) {
  const { g, w, h } = fit(cv);
  g.clearRect(0, 0, w, h);
  const maxR = scaleKm(radar);
  const X = (rn) => Math.min(1, rn / maxR) * w;
  const Y = (el) => (1 - (el + GIMBAL.elLimit) / (2 * GIMBAL.elLimit)) * h;
  grid(g, w, h, 8, 4);
  g.strokeStyle = P.greenDim; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke();
  label(g, '0°', 4, Y(0) - 5, P.greenDim);
  for (let i = 1; i <= 3; i++) { label(g, Math.round(maxR * i / 4), X(maxR * i / 4) - 10, h - 6, P.greenDim); }
  label(g, maxR + ' KM', w - 46, h - 6, P.greenDim);

  const pat = pattern(radar);
  g.strokeStyle = 'rgba(255,176,0,.55)'; g.setLineDash([4, 3]); g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, Y(radar.antEl + pat.el)); g.lineTo(w, Y(radar.antEl + pat.el)); g.stroke();
  g.beginPath(); g.moveTo(0, Y(radar.antEl - pat.el)); g.lineTo(w, Y(radar.antEl - pat.el)); g.stroke();
  g.setLineDash([]);

  const beam = beamPos(radar);
  g.strokeStyle = 'rgba(196,255,214,.85)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, Y(beam.el)); g.lineTo(w, Y(beam.el)); g.stroke();

  drawContacts(g, radar, world.time, X, Y, (c) => c.rangeKm, (c) => c.el, false);

  for (const m of missiles) {
    if (!m.alive) { continue; }
    const rel = missileRelative(world, m);
    if (rel.rangeKm > maxR || Math.abs(rel.el) > GIMBAL.elLimit) { continue; }
    drawMissile(g, X(rel.rangeKm), Y(rel.el), m, world);
  }
}

/* ------------------------------------------------------------ shared */
function drawContacts(g, radar, now, X, Y, gx, gy, withReadout) {
  for (const [id, b] of radar.blips) {
    if (radar.tracks.has(id)) { continue; }        // TWS track drawn instead, below
    const age = now - b.t, alpha = Math.max(0, 1 - age / 1.4);
    g.globalAlpha = alpha;
    drawGlyph(g, b.kind, X(gx(b)), Y(gy(b)), 6, contactColor(b));
    g.globalAlpha = 1;
  }
  for (const [id, t] of radar.tracks) {
    const x = X(gx(t)), y = Y(gy(t));
    const fresh = now - t.lastPaint < 0.2;
    const locked = radar.lockedId === id;
    const selected = radar.selectedId === id;
    drawGlyph(g, t.kind, x, y, fresh ? 7.5 : 6, contactColor(t));
    if (selected || locked) {
      g.strokeStyle = locked ? P.amber : 'rgba(255,255,255,.75)';
      g.lineWidth = locked ? 2 : 1.4;
      g.strokeRect(x - 12, y - 12, 24, 24);
    }
    if (withReadout && (locked || selected)) {
      label(g, t.name, x - 12, y - 17, locked ? P.amber : P.bright, FONT);
      if (locked) {
        label(g, `${t.rangeKm.toFixed(1)} KM   ${t.altM ? (t.altM.toFixed(0) + ' M') : ''}`.trim(), x - 12, y + 26, 'rgba(255,176,0,.85)');
      }
    } else if (!withReadout && (locked || selected)) {
      label(g, t.name, x + 14, y + 4, locked ? P.amber : P.bright, FONT_SM);
    }
  }
}

function drawMissile(g, x, y, m, world) {
  g.save();
  g.translate(x, y);
  g.fillStyle = m.w.color; g.shadowColor = m.w.color; g.shadowBlur = 10;
  g.beginPath(); g.moveTo(0, -6); g.lineTo(3.5, 4); g.lineTo(-3.5, 4); g.closePath(); g.fill();
  g.shadowBlur = 0;
  g.restore();
}
