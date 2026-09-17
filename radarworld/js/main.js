/**
 * World View: a plain top-down plot of every contact's TRUE position
 * relative to ownship - the same simulated world the radar page runs
 * (imported straight from it, not a re-implementation), just drawn without
 * any of the radar set in between. Nothing here is gated by a mode, a
 * gimbal limit, or a scan pattern - it's an omniscient reference view, not
 * a sensor picture.
 */
import { buildWorld, tickWorld } from '../../radar/js/sim/world.js';
import { KIND_COLOR, P } from '../../radar/js/render/palette.js';

export const VERSION = '2026.09.18-1';

const ZOOM_KM = [25, 50, 100, 200, 400];   // preset view half-widths; null = auto
const AUTO_MIN_KM = 15, AUTO_MAX_KM = 300, AUTO_MARGIN = 1.15;
const DPR = Math.min(2, devicePixelRatio || 1);

const $ = (id) => document.getElementById(id);

class WorldView {
  constructor() {
    this.world = buildWorld();
    this.canvas = $('map');
    this.zoomKm = null;   // null = auto-fit

    this._buildZoomButtons();
    this.last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  _buildZoomButtons() {
    const root = $('zoomGroup');
    if (!root) { return; }
    const mk = (label, value) => {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = label;
      b.addEventListener('click', () => { this.zoomKm = value; this._highlightZoom(); b.blur(); });
      root.appendChild(b);
      return b;
    };
    this._zoomButtons = [mk('AUTO', null), ...ZOOM_KM.map((km) => mk(km + ' KM', km))];
    this._highlightZoom();
  }

  _highlightZoom() {
    (this._zoomButtons || []).forEach((b) => b.classList.toggle('on', b.textContent === (this.zoomKm == null ? 'AUTO' : this.zoomKm + ' KM')));
  }

  _frame(now) {
    requestAnimationFrame((t) => this._frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    try { this._tick(dt); } catch (err) {
      this._errs = (this._errs || 0) + 1;
      if (this._errs <= 3) { console.error('[radarworld] frame error', err); }
    }
  }

  _tick(dt) {
    tickWorld(this.world, dt);
    this._draw();
    this._updateHud();
  }

  _radiusKm() {
    if (this.zoomKm != null) { return this.zoomKm; }
    let maxKm = 0;
    for (const c of this.world.contacts) {
      if (!c.alive) { continue; }
      const km = Math.hypot(c.x - this.world.own.x, c.y - this.world.own.y) / 1000;
      if (km > maxKm) { maxKm = km; }
    }
    return Math.max(AUTO_MIN_KM, Math.min(AUTO_MAX_KM, maxKm * AUTO_MARGIN || AUTO_MIN_KM));
  }

  _fit() {
    const cv = this.canvas;
    const r = cv.parentElement.getBoundingClientRect();
    const w = Math.max(1, r.width - 6), h = Math.max(1, r.height - 6);
    cv.width = Math.floor(w * DPR); cv.height = Math.floor(h * DPR);
    const g = cv.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { g, w, h };
  }

  _draw() {
    const { g, w, h } = this._fit();
    g.clearRect(0, 0, w, h);
    const own = this.world.own;
    const radiusKm = this._radiusKm();
    const pxPerKm = (Math.min(w, h) / 2) / radiusKm;
    const cx = w / 2, cy = h / 2;
    const X = (eastM) => cx + (eastM / 1000) * pxPerKm;
    const Y = (northM) => cy - (northM / 1000) * pxPerKm;

    const capEl = $('wScale');
    if (capEl) { capEl.textContent = (this.zoomKm == null ? 'AUTO · ' : '') + Math.round(radiusKm) + ' KM'; }

    // range rings, every quarter of the current radius
    g.strokeStyle = P.greenFaint; g.fillStyle = P.greenDim; g.font = '10px "Share Tech Mono", monospace';
    for (let i = 1; i <= 4; i++) {
      const rk = radiusKm * i / 4;
      g.beginPath(); g.arc(cx, cy, rk * pxPerKm, 0, Math.PI * 2); g.stroke();
      g.fillText(Math.round(rk) + ' KM', cx + 4, cy - rk * pxPerKm - 3);
    }
    g.strokeStyle = P.greenDim;
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, h); g.moveTo(0, cy); g.lineTo(w, cy); g.stroke();
    g.fillStyle = P.bright; g.fillText('N', cx - 4, 12);

    // contacts - true position, no sensor gating of any kind
    for (const c of this.world.contacts) {
      const x = X(c.x - own.x), y = Y(c.y - own.y);
      const color = !c.href ? '#9c8f7c' : (KIND_COLOR[c.kind] || P.green);
      g.globalAlpha = c.alive ? 1 : 0.35;
      g.fillStyle = color; g.shadowColor = color; g.shadowBlur = c.alive ? 7 : 0;
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = P.bright; g.font = '11px "Share Tech Mono", monospace';
      g.fillText(c.name, x + 8, y - 6);
      g.fillStyle = P.greenDim; g.font = '10px "Share Tech Mono", monospace';
      const rangeKm = Math.hypot(c.x - own.x, c.y - own.y) / 1000;
      g.fillText(rangeKm.toFixed(1) + ' KM  ' + Math.round(c.altM) + ' M', x + 8, y + 7);
      g.globalAlpha = 1;
    }

    // ownship, always dead centre, pointed along its heading (north, fixed)
    g.strokeStyle = P.bright; g.fillStyle = P.bright; g.lineWidth = 2;
    g.shadowColor = P.bright; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(cx, cy - 11); g.lineTo(cx + 8, cy + 9); g.lineTo(cx, cy + 4); g.lineTo(cx - 8, cy + 9); g.closePath(); g.fill();
    g.shadowBlur = 0;

    this._renderContactList();
  }

  _renderContactList() {
    const root = $('contactList');
    if (!root) { return; }
    const own = this.world.own;
    const rows = this.world.contacts
      .map((c) => ({ c, rangeKm: Math.hypot(c.x - own.x, c.y - own.y) / 1000 }))
      .sort((a, b) => a.rangeKm - b.rangeKm);
    root.innerHTML = rows.map(({ c, rangeKm }) => `
      <div class="crow${c.alive ? '' : ' dead'}">
        <span class="nm">${c.name}</span>
        <span class="rng">${rangeKm.toFixed(1)} KM</span>
      </div>`).join('');
  }

  _updateHud() {
    const own = this.world.own;
    const set = (id, text) => { const el = $(id); if (el) { el.textContent = text; } };
    set('wTime', fmtClock(this.world.time));
    set('wAlt', Math.round(own.altM));
    set('wMach', own.mach.toFixed(2));
    set('wHdg', String(Math.round(own.headingDeg)).padStart(3, '0'));
    set('wCount', String(this.world.contacts.length).padStart(2, '0'));
  }
}

function fmtClock(sec) {
  sec = Math.max(0, sec);
  return Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
}

let booted = false;
function boot() {
  if (booted) { return; }
  booted = true;
  console.info(`%c[radarworld] ${VERSION}%c loaded from ${import.meta.url}`,
    'color:#2dff6a;font-weight:bold', 'color:inherit');
  window.__world = new WorldView();
}

boot();
