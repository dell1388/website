import { MODES, SCALES_KM, PATTERNS, GIMBAL, SWEEP_DEG_PER_SEC,
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

export function setMode(r, i) {
  r.modeIndex = clamp(i, 0, MODES.length - 1);
  r.blips.clear(); r.tracks.clear();
  r.selectedId = null; r.lockedId = null;
  r.barIndex = 0; r.sweepAz = 0; r.sweepDir = 1;
}
export function setScale(r, i) { r.scaleIndex = clamp(i, 0, SCALES_KM.length - 1); }
export function setPattern(r, i) {
  r.patternIndex = clamp(i, 0, PATTERNS.length - 1);
  r.barIndex = 0; r.sweepAz = 0; r.sweepDir = 1;
}

/** Move the gimbal (antenna centre) by a slew rate over dt, from input axes
 *  in [-1, 1] for az (right positive) and el (up positive). */
export function slewGimbal(r, azAxis, elAxis, dt) {
  r.antAz = clamp(r.antAz + azAxis * GIMBAL.slewDegPerSec * dt, -GIMBAL.azLimit, GIMBAL.azLimit);
  r.antEl = clamp(r.antEl + elAxis * GIMBAL.slewDegPerSec * dt, -GIMBAL.elLimit, GIMBAL.elLimit);
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

/** One radar tick: sweep the beam, paint contacts it crosses, age out
 *  blips and stale tracks, and dead-reckon live tracks forward. */
export function tickRadar(r, world, dt) {
  advanceSweep(r, dt);
  const m = mode(r);
  const beam = beamPos(r);
  const maxRange = scaleKm(r);
  const now = world.time;

  for (const c of world.contacts) {
    if (!c.alive || !m.kinds.includes(c.kind)) { continue; }
    const rel = relativeTo(world.own, c);
    if (rel.rangeKm > maxRange) { continue; }
    if (Math.abs(wrapDeg(rel.az - beam.az)) > BEAM_HALF_AZ) { continue; }
    if (Math.abs(rel.el - beam.el) > BEAM_HALF_EL) { continue; }

    const paint = { az: rel.az, el: rel.el, rangeKm: rel.rangeKm, altM: c.altM,
                     name: c.name, kind: c.kind, accent: c.accent,
                     locked: c.locked, href: c.href, t: now };
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

  for (const [id, b] of r.blips) { if (now - b.t > BLIP_FADE_SEC) { r.blips.delete(id); } }

  for (const [id, t] of r.tracks) {
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
