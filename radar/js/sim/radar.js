import { MODES, SCALES_KM, PATTERNS, GIMBAL, PIPPER, SWEEP_DEG_PER_SEC,
         BLIP_FADE_SEC, TRACK_COAST_SEC } from './config.js';
import { relativeTo } from './world.js';
import { clamp, wrapDeg } from '../core/rng.js';

const BEAM_HALF_AZ = 3.5;
const BEAM_HALF_EL = 3;

/**
 * The radar set. Owns antenna pointing, the scan sweep, and the two things
 * that make a mode legible to a player: transient "blips" (SRC - flash and
 * fade) and persistent "tracks" (TWS - remembered, dead-reckoned between
 * revisits, and the only thing that can be locked).
 */
export function createRadar() {
  return {
    modeIndex: 1, scaleIndex: 3, patternIndex: 2,   // TWS, 100km, 60x10
    antAz: 0, antEl: -5,
    sweepAz: 0, sweepDir: 1, barIndex: 0, barEl: 0,
    pipperAz: 0, pipperRangeKm: 25,
    blips: new Map(),       // id -> { az, el, rangeKm, altM, name, kind, t }
    tracks: new Map(),      // id -> { ...blip fields, vAz, vEl, vRange, lastPaint }
    selectedId: null,
    lockedId: null,
    lastDenyId: null, lastDenyT: -99,
  };
}

export const mode = (r) => MODES[r.modeIndex];
export const scaleKm = (r) => SCALES_KM[r.scaleIndex];
export const pattern = (r) => PATTERNS[r.patternIndex];

/**
 * Keep the antenna such that its whole scan box (antAz +/- pattern.az,
 * antEl +/- pattern.el) sits inside the gimbal's mechanical limits - the
 * box must never be even partially off the B/C-scope. Every pattern's
 * half-angle is comfortably smaller than the gimbal limit on both axes, so
 * this range is never empty.
 */
function clampToScanBox(r) {
  const pat = pattern(r);
  r.antAz = clamp(r.antAz, -(GIMBAL.azLimit - pat.az), GIMBAL.azLimit - pat.az);
  r.antEl = clamp(r.antEl, -(GIMBAL.elLimit - pat.el), GIMBAL.elLimit - pat.el);
}

export function setMode(r, i) {
  r.modeIndex = clamp(i, 0, MODES.length - 1);
  r.blips.clear(); r.tracks.clear();
  r.selectedId = null; r.lockedId = null;
  r.barIndex = 0; r.sweepAz = 0; r.sweepDir = 1;
}
export function setScale(r, i) {
  r.scaleIndex = clamp(i, 0, SCALES_KM.length - 1);
  r.pipperRangeKm = clamp(r.pipperRangeKm, 0, scaleKm(r));
}
export function setPattern(r, i) {
  r.patternIndex = clamp(i, 0, PATTERNS.length - 1);
  r.barIndex = 0; r.sweepAz = 0; r.sweepDir = 1;
  clampToScanBox(r);   // a wider pattern can make the current antenna position invalid
}

/** ALT+A: snap the antenna back to dead ahead, level. */
export function centerGimbal(r) {
  r.antAz = 0; r.antEl = 0;
  clampToScanBox(r);
}

/** Move the gimbal (antenna centre) by a slew rate over dt, from input axes
 *  in [-1, 1] for az (right positive) and el (up positive). Clamped so the
 *  whole scan box - not just the centre - always stays on the B/C-scope. */
export function slewGimbal(r, azAxis, elAxis, dt) {
  r.antAz += azAxis * GIMBAL.slewDegPerSec * dt;
  r.antEl += elAxis * GIMBAL.slewDegPerSec * dt;
  clampToScanBox(r);
}

/** Move the pipper (selection reticle) on the B-scope's own axes - azimuth
 *  and range - independently of the antenna, free to roam the whole gimbal
 *  azimuth envelope and the current scale's full range. */
export function movePipper(r, azAxis, rangeAxis, dt) {
  r.pipperAz = clamp(r.pipperAz + azAxis * PIPPER.slewDegPerSec * dt, -GIMBAL.azLimit, GIMBAL.azLimit);
  const maxR = scaleKm(r);
  r.pipperRangeKm = clamp(
    r.pipperRangeKm + rangeAxis * maxR * PIPPER.slewRangeFractionPerSec * dt, 0, maxR);
}

/**
 * Whatever live track sits closest to the pipper "grabs" the selection.
 * Azimuth and range live in different units, so closeness is each error as
 * a fraction of its own threshold, combined - both have to be reasonably
 * small at once, not just one of them. If nothing qualifies, the existing
 * selection (however it got there - TAB or an earlier pipper pass) is left
 * alone rather than cleared, so drifting the reticle through a gap doesn't
 * cost you your pick.
 */
export function updatePipperSelection(r) {
  const rangeThreshold = Math.max(1, scaleKm(r) * PIPPER.selectRangeFraction);
  let bestId = null, bestScore = 1;
  for (const [id, t] of r.tracks) {
    const azErr = Math.abs(wrapDeg(t.az - r.pipperAz)) / PIPPER.selectRadiusDeg;
    const rngErr = Math.abs(t.rangeKm - r.pipperRangeKm) / rangeThreshold;
    const score = Math.hypot(azErr, rngErr);
    if (score < bestScore) { bestScore = score; bestId = id; }
  }
  if (bestId) { r.selectedId = bestId; }
}

/** Current instantaneous beam centre, in absolute (nose-relative) degrees. */
export function beamPos(r) {
  return { az: r.antAz + r.sweepAz, el: r.antEl + r.barEl };
}

function advanceSweep(r, dt) {
  const pat = pattern(r);
  r.sweepAz += r.sweepDir * SWEEP_DEG_PER_SEC * dt;
  if (r.sweepAz > pat.az) { r.sweepAz = pat.az; r.sweepDir = -1; stepBar(r, pat); }
  if (r.sweepAz < -pat.az) { r.sweepAz = -pat.az; r.sweepDir = 1; stepBar(r, pat); }
}

function stepBar(r, pat) {
  r.barIndex = (r.barIndex + 1) % pat.bars;
  r.barEl = pat.bars <= 1 ? 0
    : -pat.el + (r.barIndex + 0.5) * (2 * pat.el / pat.bars);
}

/** One radar tick. Unlocked: sweep the beam, paint contacts it crosses, age
 *  out blips and stale tracks, and dead-reckon live tracks forward between
 *  revisits. Locked: this is single-target-track behaviour, not search -
 *  the scan stops entirely and the antenna slaves straight onto the locked
 *  contact's true position every tick, so its track updates smoothly
 *  instead of only stepping when the beam happens to sweep back over it. */
export function tickRadar(r, world, dt) {
  const now = world.time;

  if (r.lockedId) {
    const id = r.lockedId;
    const target = world.contacts.find((c) => c.id === id);
    const prev = r.tracks.get(id);
    // A behind-respawn or far-side wrap teleports the contact instead of
    // moving it - a lock can't survive a jump like that (nothing physically
    // flew there), so drop it and let search re-acquire normally.
    const warped = target && prev && prev.warpGen !== undefined && prev.warpGen !== target.warpGen;
    const rel = target ? relativeTo(world.own, target) : null;
    // The gimbal physically cannot point past its own mechanical limits -
    // if the target has flown outside them, the antenna can't stay on it
    // and the lock fails, same as a real STT radar losing a target that
    // outran its gimbal.
    const outOfGimbal = rel && (Math.abs(rel.az) > GIMBAL.azLimit || Math.abs(rel.el) > GIMBAL.elLimit);
    if (target && target.alive && !warped && !outOfGimbal) {
      r.antAz = rel.az;
      r.antEl = rel.el;
      r.sweepAz = 0; r.barEl = 0;
      const track = { az: rel.az, el: rel.el, rangeKm: rel.rangeKm, altM: target.altM,
                       name: target.name, kind: target.kind, accent: target.accent,
                       locked: target.locked, href: target.href, t: now,
                       lastPaint: now, vAz: 0, vEl: 0, vRange: 0, warpGen: target.warpGen };
      r.tracks.set(id, track);
      r.blips.set(id, { ...track });
    } else {
      r.lockedId = null;
      if (r.selectedId === id) { r.selectedId = null; }
      r.tracks.delete(id);
      r.blips.delete(id);
    }
  } else {
    advanceSweep(r, dt);
    const m = mode(r);
    const beam = beamPos(r);
    const maxRange = scaleKm(r);

    for (const c of world.contacts) {
      if (!c.alive || !m.kinds.includes(c.kind)) { continue; }
      const rel = relativeTo(world.own, c);
      if (rel.rangeKm > maxRange) { continue; }
      if (Math.abs(wrapDeg(rel.az - beam.az)) > BEAM_HALF_AZ) { continue; }
      if (Math.abs(rel.el - beam.el) > BEAM_HALF_EL) { continue; }

      const paint = { az: rel.az, el: rel.el, rangeKm: rel.rangeKm, altM: c.altM,
                       name: c.name, kind: c.kind, accent: c.accent,
                       locked: c.locked, href: c.href, t: now, warpGen: c.warpGen };
      r.blips.set(c.id, paint);

      if (m.tws) {
        const prev = r.tracks.get(c.id);
        const track = { ...paint, lastPaint: now, vAz: 0, vEl: 0, vRange: 0 };
        if (prev) {
          const ddt = Math.max(0.05, now - prev.lastPaint);
          track.vAz = wrapDeg(rel.az - prev.az) / ddt;
          track.vEl = (rel.el - prev.el) / ddt;
          track.vRange = (rel.rangeKm - prev.rangeKm) / ddt;
        }
        r.tracks.set(c.id, track);
      }
    }
  }

  for (const [id, b] of r.blips) { if (now - b.t > BLIP_FADE_SEC) { r.blips.delete(id); } }

  for (const [id, t] of r.tracks) {
    if (id === r.lockedId) { continue; }   // already updated live, above
    const age = now - t.lastPaint;
    if (age > TRACK_COAST_SEC) {
      r.tracks.delete(id);
      if (r.lockedId === id) { r.lockedId = null; }
      if (r.selectedId === id) { r.selectedId = null; }
      continue;
    }
    // Dead-reckon the displayed position between revisits.
    t.az = wrapDeg(t.az + t.vAz * dt);
    t.el += t.vEl * dt;
    t.rangeKm = Math.max(0, t.rangeKm + t.vRange * dt);
  }
}

/** TAB: step the selection to the next live track (by ascending range). */
export function stepSelection(r) {
  const ids = [...r.tracks.keys()].sort(
    (a, b) => r.tracks.get(a).rangeKm - r.tracks.get(b).rangeKm);
  if (!ids.length) { r.selectedId = null; return; }
  const i = ids.indexOf(r.selectedId);
  r.selectedId = ids[(i + 1) % ids.length];
}

/** ENTER: acquire or release a lock on the current selection.
 *  Returns 'locked' | 'unlocked' | 'denied' | null (nothing to do). */
export function toggleLock(r, world) {
  if (!r.selectedId) { return null; }
  if (r.lockedId === r.selectedId) { r.lockedId = null; return 'unlocked'; }
  const track = r.tracks.get(r.selectedId);
  if (!track) { return null; }
  if (track.locked) {
    r.lastDenyId = r.selectedId; r.lastDenyT = world.time;
    return 'denied';
  }
  r.lockedId = r.selectedId;
  return 'locked';
}
