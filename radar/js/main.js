import { buildWorld, tickWorld } from './sim/world.js';
import { createRadar, mode, setMode, setScale, setPattern, slewGimbal,
         movePipper, updatePipperSelection,
         tickRadar, stepSelection, toggleLock } from './sim/radar.js';
import { WEAPON_BY_KIND } from '../content/targets.js';
import { LOADOUT } from './sim/weapons.js';
import { MODES, SCALES_KM, PATTERNS } from './sim/config.js';
import { launchMissile, tickMissile } from './sim/missile.js';
import { buildTerrain } from './render/map.js';
import { drawB, drawC, drawE } from './render/scopes.js';
import { Input } from './core/input.js';
import { buildButtonGroups, updateHud, toast } from './ui/hud.js';
import { buildDossier } from './ui/dossier.js';
import { initChooser } from './ui/chooser.js';

export const VERSION = '2026.09.17-1';

class Game {
  constructor() {
    this.world = buildWorld();
    this.radar = createRadar();
    this.terrain = buildTerrain();
    this.missiles = [];
    this.ammo = { ...LOADOUT };
    this.input = new Input();
    this.dossier = buildDossier();
    this.canvasB = document.getElementById('bscope');
    this.canvasC = document.getElementById('cscope');
    this.canvasE = document.getElementById('escope');
    this.flash = document.getElementById('flash') || this._makeFlash();

    buildButtonGroups({
      onMode: (i) => { setMode(this.radar, i); toast(mode(this.radar).label, 'good'); },
      onScale: (i) => setScale(this.radar, i),
      onPattern: (i) => setPattern(this.radar, i),
    });

    document.getElementById('dosClose')?.addEventListener('click', () => this.dossier?.toggle(false));
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.dossier?.isOpen()) { this.dossier.toggle(false); }
      // Not KeyD: D also drives the pipper right, and every WASD tap would
      // otherwise flip the dossier open. Slash ('/', as in "?" for help).
      if (e.code === 'Slash') { this.dossier?.toggle(); }

      // Alt+letter cycles a setting one step - arrows stay reserved for the
      // gimbal and WASD for the pipper, so these live on the modifier.
      if (!e.altKey) { return; }
      if (e.code === 'KeyG') { e.preventDefault(); this._cycleMode(); }
      else if (e.code === 'KeyS') { e.preventDefault(); this._cycleScale(); }
      else if (e.code === 'KeyF') { e.preventDefault(); this._cyclePattern(); }
    });

    this.last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  _cycleMode() {
    setMode(this.radar, (this.radar.modeIndex + 1) % MODES.length);
    toast(mode(this.radar).label, 'good');
  }

  _cycleScale() {
    setScale(this.radar, (this.radar.scaleIndex + 1) % SCALES_KM.length);
    toast(SCALES_KM[this.radar.scaleIndex] + ' KM');
  }

  _cyclePattern() {
    setPattern(this.radar, (this.radar.patternIndex + 1) % PATTERNS.length);
    toast(PATTERNS[this.radar.patternIndex].label);
  }

  _makeFlash() {
    const d = document.createElement('div');
    d.id = 'flash';
    document.body.appendChild(d);
    return d;
  }

  _frame(now) {
    requestAnimationFrame((t) => this._frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    try { this._tick(dt); } catch (err) {
      this._errs = (this._errs || 0) + 1;
      if (this._errs <= 3) { console.error('[radar] frame error', err); }
    }
    this.input.endFrame();
  }

  _tick(dt) {
    const { input, world, radar } = this;

    slewGimbal(radar, input.axis('ArrowLeft', 'ArrowRight'), input.axis('ArrowDown', 'ArrowUp'), dt);
    const pipAz = input.axis('KeyA', 'KeyD'), pipEl = input.axis('KeyS', 'KeyW');
    if (pipAz || pipEl) {
      movePipper(radar, pipAz, pipEl, dt);
      // Only claim the selection while the pipper is actually being steered -
      // otherwise a pipper left resting near an old contact would silently
      // fight a later TAB press every single frame.
      updatePipperSelection(radar);
    }

    const hadLock = radar.lockedId;
    tickWorld(world, dt);
    tickRadar(radar, world, dt);
    if (hadLock && !radar.lockedId) { toast('LOCK LOST', 'deny'); }

    if (input.hit('Tab')) { stepSelection(radar); }
    if (input.hit('Enter')) {
      const r = toggleLock(radar, world);
      if (r === 'locked') { toast('LOCK · ' + radar.tracks.get(radar.lockedId).name, 'good'); }
      else if (r === 'unlocked') { toast('LOCK RELEASED'); }
      else if (r === 'denied') { toast('DENIED · NO-STRIKE', 'deny'); }
    }
    if (input.hit('Space')) { this._launch(); }

    for (const m of this.missiles) {
      if (!m.alive) { continue; }
      tickMissile(world, m, dt);
      if (m.hit) { this._resolveHit(m); }
      else if (!m.alive) { toast('MISSILE LOST · ' + (world.contacts.find((c) => c.id === m.targetId)?.name || 'target'), 'deny'); }
    }
    this.missiles = this.missiles.filter((m) => m.alive);

    updateHud(world, radar, this.missiles, this.ammo);
    drawB(this.canvasB, world, radar, this.missiles, this.terrain, world.time);
    drawC(this.canvasC, world, radar, this.missiles, world.time);
    drawE(this.canvasE, world, radar, this.missiles, world.time);
  }

  _launch() {
    const { radar, world, ammo } = this;
    if (!radar.lockedId) { toast('NO LOCK', 'deny'); return; }
    const track = radar.tracks.get(radar.lockedId);
    if (!track) { toast('NO LOCK', 'deny'); return; }
    const target = world.contacts.find((c) => c.id === radar.lockedId);
    if (!target) { return; }
    const weaponId = WEAPON_BY_KIND[target.kind];
    if (!ammo[weaponId]) { toast('NO AMMO · ' + weaponId.toUpperCase(), 'deny'); return; }
    ammo[weaponId]--;
    this.missiles.push(launchMissile(world, weaponId, target));
    toast('MISSILE AWAY · ' + target.name, 'good');
  }

  _resolveHit(m) {
    const target = this.world.contacts.find((c) => c.id === m.targetId);
    if (!target) { return; }
    target.alive = false;
    this.flash.classList.remove('hit'); void this.flash.offsetWidth; this.flash.classList.add('hit');
    if (radarLockedOnThis(this.radar, target.id)) { this.radar.lockedId = null; }
    if (target.href) {
      toast('SPLASH · ' + target.name, 'good');
      setTimeout(() => { location.href = target.href; }, 700);
    } else {
      toast('SPLASH · ' + target.name);
    }
  }
}

function radarLockedOnThis(radar, id) { return radar.lockedId === id; }

let booted = false;
function boot() {
  if (booted) { return; }
  booted = true;
  console.info(`%c[radar] ${VERSION}%c loaded from ${import.meta.url}`,
    'color:#2dff6a;font-weight:bold', 'color:inherit');
  window.__radar = new Game();
}

const ready = initChooser(boot);
if (ready) { boot(); }
