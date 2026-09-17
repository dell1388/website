/** Radar modes. `kinds` is which target classes the mode will paint at all;
 *  `tws` distinguishes a fading raw return (search) from a remembered,
 *  updated track (track-while-scan) - only a TWS mode can hold a lock. */
export const MODES = [
  { id: 'SRC',      label: 'SRC',      kinds: ['air'],           tws: false },
  { id: 'TWS',      label: 'TWS',      kinds: ['air'],           tws: true },
  { id: 'SRC_HDN',  label: 'SRC HDN',  kinds: ['ground_fixed'],  tws: false },
  { id: 'TWS_HDN',  label: 'TWS HDN',  kinds: ['ground_fixed'],  tws: true },
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

export const GIMBAL = {
  azLimit: 90, elLimit: 60,
  slewDegPerSec: 70,        // arrow-key slew rate
};

/** The WASD-driven selection reticle - independent of the antenna, and free
 *  to roam the whole gimbal envelope regardless of the current scan box. */
export const PIPPER = {
  slewDegPerSec: 85,
  selectRadiusDeg: 6,       // how close it has to sit to a track to grab it
};

/** Beam sweep speed in degrees/second of azimuth travel. */
export const SWEEP_DEG_PER_SEC = 46;

/** How long a search-mode (non-TWS) blip stays lit after the beam passes. */
export const BLIP_FADE_SEC = 1.4;

/** A TWS track that hasn't been revisited in this long is dropped. */
export const TRACK_COAST_SEC = 6;
