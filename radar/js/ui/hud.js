import { MODES, SCALES_KM, PATTERNS, patternRangeFor } from '../sim/config.js';
import { mode, scaleKm, pattern } from '../sim/radar.js';
import { MISSILES, LOADOUT } from '../sim/weapons.js';
import { timeToImpactSec } from '../sim/missile.js';

const $ = (id) => document.getElementById(id);
const KIND_SYM = { air: '◇', sea: '⬢', ground_fixed: '▣', ground_mover: '▣' };
const KIND_CLASS = { air: 'air', sea: 'sea', ground_fixed: 'gnd', ground_mover: 'gnd' };

export function buildButtonGroups({ onMode, onScale, onPattern }) {
  fillGroup('modeGroup', MODES.map((m) => m.label), onMode);
  fillGroup('scaleGroup', SCALES_KM.map((s) => String(s)), onScale);
  fillGroup('patternGroup', PATTERNS.map((p) => p.label), onPattern);
}

function fillGroup(id, labels, onPick) {
  const el = $(id);
  if (!el) { return; }
  labels.forEach((label, i) => {
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = label; b.dataset.i = i;
    b.addEventListener('click', () => { onPick(i); b.blur(); });
    el.appendChild(b);
  });
}

function highlightGroup(id, index) {
  const el = $(id);
  if (!el) { return; }
  [...el.querySelectorAll('.btn')].forEach((b, i) => b.classList.toggle('on', i === index));
}

/** Grey out (and actually disable) patterns the current mode can't fly -
 *  SRC never gets the tightest box, TWS never gets the widest. */
function markPatternAvailability(radarMode) {
  const el = $('patternGroup');
  if (!el) { return; }
  const [lo, hi] = patternRangeFor(radarMode);
  [...el.querySelectorAll('.btn')].forEach((b, i) => { b.disabled = i < lo || i > hi; });
}

export function updateHud(world, radar, missiles, ammo) {
  const own = world.own;
  set('rMach', own.mach.toFixed(2));
  set('rAlt', Math.round(own.altM));
  set('rHdg', String(Math.round(own.headingDeg)).padStart(3, '0'));
  set('rAz', (radar.antAz >= 0 ? '+' : '') + Math.round(radar.antAz).toString().padStart(2, '0'));
  set('rEl', (radar.antEl >= 0 ? '+' : '') + Math.round(radar.antEl).toString().padStart(2, '0'));
  set('rTracks', String(radar.tracks.size).padStart(2, '0'));
  set('rMode', mode(radar).label);
  set('capB', `${scaleKm(radar)} KM · ${pattern(radar).label}`);

  const inFlight = missiles.filter((m) => m.alive);
  if (inFlight.length) {
    const m = inFlight[inFlight.length - 1];
    const tti = timeToImpactSec(world, m);
    set('rTti', tti != null ? fmtClock(tti) : '--:--');
  } else {
    set('rTti', '--:--');
  }

  highlightGroup('modeGroup', radar.modeIndex);
  highlightGroup('scaleGroup', radar.scaleIndex);
  highlightGroup('patternGroup', radar.patternIndex);
  markPatternAvailability(mode(radar));

  renderTracks(radar);
  renderStores(ammo);
}

function renderTracks(radar) {
  const root = $('trackList');
  if (!root) { return; }
  const ids = [...radar.tracks.keys()].sort((a, b) => radar.tracks.get(a).rangeKm - radar.tracks.get(b).rangeKm);
  root.innerHTML = ids.map((id) => {
    const t = radar.tracks.get(id);
    const sel = id === radar.selectedId ? ' sel' : '';
    const kc = KIND_CLASS[t.kind] || 'air';
    const alt = t.altM ? Math.round(t.altM) : (t.kind === 'sea' ? 'SEA' : (t.kind === 'ground_mover' ? 'GMTI' : 'GMAP'));
    return `<div class="trk ${kc}${sel}" data-id="${id}">
      <span class="sym">${KIND_SYM[t.kind] || '?'}</span>
      <span class="nm">${t.name}</span>
      <span class="n">${t.rangeKm.toFixed(1)}</span>
      <span class="n">${alt}</span>
      <span class="n">${id === radar.lockedId ? 'LOCK' : ''}</span>
    </div>`;
  }).join('') || '<div class="empty-hint">no tracks - sweep the beam over a contact</div>';
}

function renderStores(ammo) {
  const root = $('storesList');
  if (!root) { return; }
  root.innerHTML = Object.values(MISSILES).map((w) => {
    const total = LOADOUT[w.id];
    const left = ammo[w.id];
    const unlimited = !isFinite(total);
    const rail = unlimited
      ? ''
      : Array.from({ length: total }, (_, i) => `<i class="${i < left ? '' : 'spent'}"></i>`).join('');
    return `<div class="st${(unlimited || left > 0) ? ' on' : ''}">
      <span class="w">${w.label}</span><span class="rail">${rail}</span>
      <span class="q">${unlimited ? '' : left}</span>
    </div>`;
  }).join('');
}

let toastTimer = null;
export function toast(msg, kind) {
  const el = $('toast');
  if (!el) { return; }
  el.textContent = msg;
  el.className = kind ? `show ${kind}` : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function set(id, text) { const el = $(id); if (el) { el.textContent = text; } }
function fmtClock(sec) {
  sec = Math.max(0, sec);
  return Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
}
