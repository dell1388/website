/**
 * Radar modes. `kinds` is which target classes the mode will paint at all;
 * `tws` distinguishes a fading raw return (search) from a remembered,
 * updated track (track-while-scan) - only a TWS mode can hold a lock.
 * `requireApproaching` (HDN only) additionally demands the contact's range
 * actually be shrinking - see world.js's `isApproaching`.
 *
 * SRC and TWS aren't just "the same search with or without a memory" - see
 * `patternRangeFor` below for how their available patterns differ, and
 * `centerGimbal` in radar.js for why only a TWS mode can auto-recentre.
 *
 * HDN ("head-on") is for picking an approaching aircraft out of the sky,
 * not for ground search - a closing air target only, regardless of mode.
 * GMAP ("ground map") is the fixed-target counterpart to GMTI: GMTI is a
 * genuine moving-target indicator (it works by rejecting zero-Doppler
 * returns, so a stationary target IS the clutter it's built to ignore),
 * while GMAP is what actually resolves something that isn't moving at all.
 */
export const MODES = [
  { id: 'SRC',      label: 'SRC',      kinds: ['air'],           tws: false },
  { id: 'TWS',      label: 'TWS',      kinds: ['air'],           tws: true },
  { id: 'SRC_HDN',  label: 'SRC HDN',  kinds: ['air'],           tws: false, requireApproaching: true },
  { id: 'TWS_HDN',  label: 'TWS HDN',  kinds: ['air'],           tws: true,  requireApproaching: true },
  { id: 'SRC_GMAP', label: 'SRC GMAP', kinds: ['ground_fixed'],  tws: false },
  { id: 'TWS_GMAP', label: 'TWS GMAP', kinds: ['ground_fixed'],  tws: true },
  { id: 'SRC_GMTI', label: 'SRC GMTI', kinds: ['ground_mover'],  tws: false },
  { id: 'TWS_GMTI', label: 'TWS GMTI', kinds: ['ground_mover'],  tws: true },
  { id: 'TWS_SEA',  label: 'TWS SEA',  kinds: ['sea'],           tws: true },
];

export const SCALES_KM = [10, 25, 50, 100];

/** { az, el } half-angle of the search box, and how many elevation bars it
 *  takes to fill it - a wider pattern revisits any one spot less often. */
export const PATTERNS = [
  { label: '15×15', az: 7.5,  el: 7.5,  bars: 4 },
  { label: '30×15', az: 15,   el: 7.5,  bars: 4 },
  { label: '60×10', az: 30,   el: 5,    bars: 2 },
  { label: '120×5', az: 60,   el: 2.5,  bars: 1 },
];

/**
 * SRC and TWS get different jobs, not just a memory toggle: SRC sweeps a
 * wide volume at a low revisit rate (fine, since it isn't trying to keep a
 * track alive between passes), while TWS narrows the box to revisit often
 * enough to actually maintain one - it never gets the widest pattern, and
 * SRC never gets the tightest. Index into `PATTERNS`, inclusive.
 */
export const SRC_PATTERN_RANGE = [1, 3];   // 30x15 .. 120x5
export const TWS_PATTERN_RANGE = [0, 2];   // 15x15 .. 60x10
export const patternRangeFor = (m) => (m.tws ? TWS_PATTERN_RANGE : SRC_PATTERN_RANGE);

export const GIMBAL = {
  azLimit: 90, elLimit: 60,
  slewDegPerSec: 70,        // arrow-key slew rate
};

/** The selection reticle - independent of the antenna, living on the
 *  B-scope's own axes (azimuth, range) rather than the antenna's (az, el),
 *  and free to roam the whole gimbal envelope / current scale regardless
 *  of where the antenna's scan box currently is. */
export const PIPPER = {
  slewDegPerSec: 85,
  slewRangeFractionPerSec: 0.4,   // fraction of the current scale, per second
  selectRadiusDeg: 6,             // how close (az) it has to sit to grab a track
  selectRangeFraction: 0.07,      // how close (range, as a fraction of scale)
};

/** Beam sweep speed in degrees/second of azimuth travel. */
export const SWEEP_DEG_PER_SEC = 46;

/** How long a search-mode (non-TWS) blip stays lit after the beam passes. */
export const BLIP_FADE_SEC = 1.4;

/** A TWS track that hasn't been revisited in this long is dropped. */
export const TRACK_COAST_SEC = 6;
