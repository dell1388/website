import { GIMBAL } from '../sim/config.js';
import { scaleKm, pattern, beamPos } from '../sim/radar.js';
import { missileRelative, missileAheadPoint } from '../sim/missile.js';
import { relativeTo } from '../sim/world.js';
import { projectFeature } from './map.js';
import { P } from './palette.js';
import { DEG } from '../core/rng.js';

const DPR = Math.min(2, devicePixelRatio || 1);
const FONT = '11px "Share Tech Mono", monospace';
const FONT_SM = '10px "Share Tech Mono", monospace';

/** E-scope's vertical span is a fixed altitude window in metres, not the
 *  gimbal's elevation limit - see drawE(). */
const ALT_MIN = 0, ALT_MAX = 12000;

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

/** A crosshair reticle - the WASD-driven pipper used to select a track. */
function drawPipper(g, x, y) {
  g.strokeStyle = '#eafff5'; g.lineWidth = 1.4;
  g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  g.moveTo(x - 15, y); g.lineTo(x - 5, y);
  g.moveTo(x + 5, y); g.lineTo(x + 15, y);
  g.moveTo(x, y - 15); g.lineTo(x, y - 5);
  g.moveTo(x, y + 5); g.lineTo(x, y + 15);
  g.stroke();
}

/** Small direction-of-travel pointer off a missile glyph, from its current
 *  scope position `(x,y)` out to its projected position `(x2,y2)`. */
function drawHeadingPointer(g, x, y, x2, y2, color) {
  g.strokeStyle = color; g.lineWidth = 1.4; g.shadowColor = color; g.shadowBlur = 5;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
  g.shadowBlur = 0;
}

/** Projected-intercept cue: where a shot fired right now would connect (or
 *  run out of motor trying to, or simply refuse to fire at all). A hit
 *  reads as a small green diamond, a miss as an amber ring, a wrong-weapon
 *  "would refuse to fire" as a dim grey slash - either way it's a
 *  forecast, not a real hit, so it never plays the flash/hit effects a
 *  real one does. */
function drawInterceptCue(g, x, y, status, text) {
  const color = status === 'hit' ? '#2dff6a' : status === 'noshot' ? '#9c8f7c' : '#ff5a3c';
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 1.5;
  g.shadowColor = color; g.shadowBlur = status === 'noshot' ? 0 : 6;
  if (status === 'hit') {
    g.beginPath();
    g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y);
    g.closePath(); g.stroke();
  } else {
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.stroke();
  }
  g.shadowBlur = 0;
  if (text) { label(g, text, x + 9, y - 9, color, FONT_SM); }
}

function cueLabel(cue) {
  if (cue.noShot) { return 'NO SHOT'; }
  return cue.hit ? `T+${Math.round(cue.t)}S` : 'OUT';
}
function cueStatus(cue) {
  if (cue.noShot) { return 'noshot'; }
  return cue.hit ? 'hit' : 'miss';
}

/** Cheap, seedless, deterministic 0..1 noise - just for the E-scope's
 *  decorative ground clutter, which needs no world-space meaning at all. */
function hash(n) {
  n = (n << 13) ^ n;
  return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff;
}

/* ------------------------------------------------------------ B-SCOPE */
/* x = azimuth across the full mechanical gimbal travel, y = range (near
 * at the bottom, far at the top) - the classic B-scope layout. */
export function drawB(cv, world, radar, missiles, terrain, time, cue) {
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
    const mx = X(rel.az), my = Y(rel.rangeKm);
    const ahead = missileAheadPoint(m, maxR * 0.05);
    const aheadRel = relativeTo(world.own, ahead);
    drawHeadingPointer(g, mx, my, X(aheadRel.az), Y(aheadRel.rangeKm), m.w.color);
    drawMissile(g, mx, my, m, world);
  }

  // projected-intercept cue for the current selection - where a shot fired
  // right now would connect, or run out of motor trying to
  if (cue && cue.point) {
    const rel = relativeTo(world.own, cue.point);
    if (rel.rangeKm <= maxR && Math.abs(rel.az) <= GIMBAL.azLimit) {
      drawInterceptCue(g, X(rel.az), Y(rel.rangeKm), cueStatus(cue), cueLabel(cue));
    }
  }

  // ownship
  g.strokeStyle = 'rgba(196,255,214,.9)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(X(0) - 9, h - 1); g.lineTo(X(0), h - 13); g.lineTo(X(0) + 9, h - 1); g.stroke();

  // the pipper lives here - same axes as everything else on this scope
  drawPipper(g, X(radar.pipperAz), Y(radar.pipperRangeKm));
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

  // pipper cross-reference: just its azimuth (it has no elevation of its
  // own now - it lives on the B-scope's az/range axes).
  g.strokeStyle = 'rgba(234,255,245,.5)'; g.setLineDash([2, 3]); g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(X(radar.pipperAz), 0); g.lineTo(X(radar.pipperAz), h); g.stroke();
  g.setLineDash([]);

  label(g, '-90', 4, h - 6, P.greenDim); label(g, '+90', w - 30, h - 6, P.greenDim); label(g, '+60', 4, 14, P.greenDim);
}

/* ------------------------------------------------------------ E-SCOPE */
/* x = range, y = altitude in metres (not elevation angle - a fixed window
 * on the world, same units contacts and missiles actually live in). The
 * antenna's elevation is still an angle, so the beam and the scan box are
 * drawn as radial lines pivoting out of the ownship's own altitude at
 * range zero: at a fixed angle, altitude = range * tan(angle), which is
 * exactly a line through that pivot - swinging up and down as elevation
 * changes, never a level line. */
export function drawE(cv, world, radar, missiles, time, cue) {
  const { g, w, h } = fit(cv);
  g.clearRect(0, 0, w, h);
  const maxR = scaleKm(radar);
  const ownAlt = world.own.altM;
  const X = (rn) => Math.min(1, rn / maxR) * w;
  const Y = (altM) => h - Math.min(1, Math.max(0, (altM - ALT_MIN) / (ALT_MAX - ALT_MIN))) * h;

  // A fixed elevation angle traces altitude = ownAlt + range*tan(angle) - a
  // straight line through the pivot at (range 0, ownAlt). Pointed steeply at
  // the ground or the sky, that line legitimately runs off the top or
  // bottom of this scope's altitude window before reaching max range -
  // unlike the B/C-scope's scan box (kept fully on-screen by clamping the
  // gimbal itself), the E-scope's box is EXPECTED to go off-screen and has
  // to be clipped accurately there rather than smeared into a wrong shape.
  const altAtRange = (angleDeg, rangeKm) => ownAlt + rangeKm * 1000 * Math.tan(angleDeg * DEG);
  /** Where this radial actually leaves the visible altitude window, if it
   *  does before maxR - the true crossing point, not a distorted guess. */
  const clipRadial = (angleDeg) => {
    const endAlt = altAtRange(angleDeg, maxR);
    if (endAlt >= ALT_MIN && endAlt <= ALT_MAX) { return { rKm: maxR, alt: endAlt, offScope: false }; }
    const targetAlt = endAlt > ALT_MAX ? ALT_MAX : ALT_MIN;
    const tanA = Math.tan(angleDeg * DEG);          // guaranteed meaningfully nonzero here
    const rKm = (targetAlt - ownAlt) / (1000 * tanA);
    return { rKm: Math.min(maxR, Math.max(0, rKm)), alt: targetAlt, offScope: true };
  };
  const radial = (angleDeg, color, dash) => {
    const end = clipRadial(angleDeg);
    g.strokeStyle = color;
    if (dash) { g.setLineDash(dash); }
    g.beginPath(); g.moveTo(X(0), Y(ownAlt)); g.lineTo(X(end.rKm), Y(end.alt)); g.stroke();
    if (dash) { g.setLineDash([]); }
    if (end.offScope) {
      // small chevron at the true exit point, pointing the way it keeps
      // going - makes "this leaves the scope here" unambiguous rather than
      // reading as "the beam just stops."
      const dir = end.alt >= ALT_MAX ? -1 : 1;
      const ex = X(end.rKm), ey = Y(end.alt);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(ex, ey + dir * 7); g.lineTo(ex - 4, ey + dir * 2); g.lineTo(ex + 4, ey + dir * 2);
      g.closePath(); g.fill();
    }
  };

  grid(g, w, h, 8, 4);
  for (let i = 0; i <= 4; i++) {
    const alt = ALT_MIN + (ALT_MAX - ALT_MIN) * i / 4;
    label(g, Math.round(alt) + ' M', 5, Y(alt) - 5, P.greenDim);
  }
  for (let i = 1; i <= 3; i++) { label(g, Math.round(maxR * i / 4), X(maxR * i / 4) - 10, h - 6, P.greenDim); }
  label(g, maxR + ' KM', w - 46, h - 6, P.greenDim);

  // decorative ground clutter - purely for orientation, not a real return.
  // Density is a fraction of the current scale so it reads the same at any
  // zoom, not spaced against a fixed world distance.
  // Flat, glow-less dots wash out against the CRT scanline/vignette
  // overlay - every real return on these scopes gets a shadowBlur glow to
  // read against that texture, so clutter needs the same treatment.
  const N_CLUTTER = 130;
  g.shadowColor = P.green; g.fillStyle = P.green;
  for (let i = 0; i < N_CLUTTER; i++) {
    const h1 = hash(i), h2 = hash(i + 7331), h3 = hash(i + 91711);
    const rangeKm = ((i + h1) / N_CLUTTER) * maxR;
    const altM = h2 * 900;
    const twinkle = 0.5 + 0.5 * Math.sin(time * 2.4 + i * 1.7);
    g.globalAlpha = 0.45 + 0.4 * twinkle * (0.5 + 0.5 * h3);
    g.shadowBlur = 3 + h3 * 2;
    const s = 2 + h3 * 1.4;
    g.fillRect(X(rangeKm) - s / 2, Y(altM) - s / 2, s, s);
  }
  g.shadowBlur = 0; g.globalAlpha = 1;

  // own-altitude reference. Offset well clear of the left-edge tick labels
  // (x=5) since ownAlt can legitimately land exactly on a gridline value.
  g.strokeStyle = 'rgba(234,255,245,.4)'; g.setLineDash([2, 4]); g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, Y(ownAlt)); g.lineTo(w, Y(ownAlt)); g.stroke();
  g.setLineDash([]);
  label(g, 'OWN ' + Math.round(ownAlt) + 'M', 62, Y(ownAlt) - 5, 'rgba(234,255,245,.6)');

  // scan box, swinging on the same pivot as the beam
  const pat = pattern(radar);
  radial(radar.antEl + pat.el, 'rgba(255,176,0,.55)', [4, 3]);
  radial(radar.antEl - pat.el, 'rgba(255,176,0,.55)', [4, 3]);

  // the beam itself, pivoting up and down with elevation - not a level line
  const beam = beamPos(radar);
  radial(beam.el, 'rgba(196,255,214,.85)');

  drawContacts(g, radar, world.time, X, Y, (c) => c.rangeKm, (c) => c.altM, false);

  for (const m of missiles) {
    if (!m.alive) { continue; }
    const rel = missileRelative(world, m);
    if (rel.rangeKm > maxR) { continue; }
    const mx = X(rel.rangeKm), my = Y(m.altM);
    const ahead = missileAheadPoint(m, maxR * 0.05);
    const aheadRel = relativeTo(world.own, ahead);
    drawHeadingPointer(g, mx, my, X(aheadRel.rangeKm), Y(ahead.altM), m.w.color);
    drawMissile(g, mx, my, m, world);
  }

  // projected-intercept cue for the current selection
  if (cue && cue.point) {
    const rel = relativeTo(world.own, cue.point);
    if (rel.rangeKm <= maxR) {
      drawInterceptCue(g, X(rel.rangeKm), Y(cue.point.altM), cueStatus(cue), cueLabel(cue));
    }
  }

  // pipper cross-reference: just its range, the axis this scope shares with it
  g.strokeStyle = 'rgba(234,255,245,.5)'; g.setLineDash([2, 3]); g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(X(radar.pipperRangeKm), 0); g.lineTo(X(radar.pipperRangeKm), h); g.stroke();
  g.setLineDash([]);
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
