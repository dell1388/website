import { mode, scaleKm, pattern } from '../sim/radar.js';
import { MISSILES, LOADOUT } from '../sim/weapons.js';
import { timeToImpactSec } from '../sim/missile.js';

const $ = (id) => document.getElementById(id);
const KIND_SYM = { air: '◇', sea: '⬢', ground_fixed: '▣', ground_mover: '▣' };
const KIND_CLASS = { air: 'air', sea: 'sea', ground_fixed: 'gnd', ground_mover: 'gnd' };

/** MODE/SCALE/PATTERN are single click-to-cycle indicators, not a button
 *  per option - MODE alone has 9 possible values, which is exactly what
 *  used to blow the footer's layout out. Same cycle the ALT+G/S/F
 *  shortcuts already drive. */
export function buildButtonGroups({ onCycleMode, onCycleScale, onCyclePattern, onSelectWeapon }) {
  bindCycle('modeInd', onCycleMode);
  bindCycle('scaleInd', onCycleScale);
  bindCycle('patternInd', onCyclePattern);

  // One delegated listener rather than re-binding per row - renderStores
  // rebuilds #storesList's innerHTML every tick, so per-element listeners
  // would need re-attaching just as often.
  const stores = $('storesList');
  if (stores && onSelectWeapon) {
    stores.addEventListener('click', (e) => {
      const row = e.target.closest('.st');
      if (row?.dataset.weapon) { onSelectWeapon(row.dataset.weapon); }
    });
  }
}

function bindCycle(id, onCycle) {
  const el = $(id);
  if (el && onCycle) { el.addEventListener('click', () => { onCycle(); el.blur(); }); }
}

export function updateHud(world, radar, missiles, ammo, selectedWeapon) {
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

  set('modeInd', mode(radar).label);
  set('scaleInd', scaleKm(radar) + ' KM');
  set('patternInd', pattern(radar).label);

  renderTracks(radar);
  renderStores(ammo, selectedWeapon);
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

let lastStoresSig = null;
function renderStores(ammo, selectedWeapon) {
  const root = $('storesList');
  if (!root) { return; }
  // Ammo barely ever changes (it's unlimited by default) and the selection
  // only changes on a keypress/click - rebuilding this every single frame
  // at 60fps would mean the row a click just landed on can be detached and
  // replaced mid-click, which is exactly the kind of thing that makes a
  // click flaky for a real user too, not just a test.
  const sig = selectedWeapon + '|' + Object.values(MISSILES).map((w) => ammo[w.id]).join(',');
  if (sig === lastStoresSig) { return; }
  lastStoresSig = sig;
  root.innerHTML = Object.values(MISSILES).map((w) => {
    const total = LOADOUT[w.id];
    const left = ammo[w.id];
    const unlimited = !isFinite(total);
    const rail = unlimited
      ? ''
      : Array.from({ length: total }, (_, i) => `<i class="${i < left ? '' : 'spent'}"></i>`).join('');
    const sel = w.id === selectedWeapon ? ' sel' : '';
    return `<div class="st${(unlimited || left > 0) ? ' on' : ''}${sel}" data-weapon="${w.id}">
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
