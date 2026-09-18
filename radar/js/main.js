import { buildWorld, tickWorld } from './sim/world.js';
import { createRadar, mode, pattern, setMode, setScale, setPattern, slewGimbal,
         movePipper, updatePipperSelection, centerGimbal,
         tickRadar, stepSelection, toggleLock } from './sim/radar.js';
import { MISSILES, LOADOUT, canFire } from './sim/weapons.js';
import { MODES, SCALES_KM, patternsFor } from './sim/config.js';
import { launchMissile, tickMissile } from './sim/missile.js';
import { simulateIntercept } from './sim/intercept.js';
import { buildTerrain } from './render/map.js';
import { drawB, drawC, drawE } from './render/scopes.js';
import { Input } from './core/input.js';
import { buildButtonGroups, updateHud, toast } from './ui/hud.js';
import { buildDossier } from './ui/dossier.js';
import { buildControls } from './ui/controls.js';
import { initChooser } from './ui/chooser.js';

export const VERSION = '2026.09.17-1';

class Game {
  constructor() {
    this.world = buildWorld();
    this.radar = createRadar();
    this.terrain = buildTerrain();
    this.missiles = [];
    this.ammo = { ...LOADOUT };
    this.selectedWeapon = 'amraam';   // the player's own pick now - nothing auto-selects by target kind
    this.input = new Input();
    this.dossier = buildDossier();
    this.controls = buildControls();
    this.controlsSwapped = false;   // false: arrows=gimbal, WASD=pipper
    this.canvasB = document.getElementById('bscope');
    this.canvasC = document.getElementById('cscope');
    this.canvasE = document.getElementById('escope');
    this.flash = document.getElementById('flash') || this._makeFlash();

    buildButtonGroups({
      onCycleMode: () => this._cycleMode(),
      onCycleScale: () => this._cycleScale(),
      onCyclePattern: () => this._cyclePattern(),
      onSelectWeapon: (id) => this._selectWeapon(id),
    });

    document.getElementById('dosClose')?.addEventListener('click', () => this.dossier?.toggle(false));
    document.getElementById('swapBtn')?.addEventListener('click', (e) => { this._toggleSwap(); e.currentTarget.blur(); });
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.dossier?.isOpen()) { this.dossier.toggle(false); }
        if (this.controls?.isOpen()) { this.controls.toggle(false); }
      }
      // Not KeyD: D also drives the pipper (or, swapped, the gimbal) right,
      // and every WASD tap would otherwise flip the dossier open.
      // Slash ('/', as in "?" for help).
      if (e.code === 'Slash') { this.dossier?.toggle(); }
      if (e.code === 'KeyC') { this.controls?.toggle(); }
      // 1/2/3: pick which weapon SPACE will fire - plain number keys are
      // free (nothing else in this game uses digits).
      if (e.code === 'Digit1') { this._selectWeapon('amraam'); }
      else if (e.code === 'Digit2') { this._selectWeapon('harpoon'); }
      else if (e.code === 'Digit3') { this._selectWeapon('hellfire'); }

      // Alt+letter is a one-shot action - arrows/WASD stay reserved for the
      // gimbal and pipper (whichever way round), so these live on Alt.
      if (!e.altKey) { return; }
      if (e.code === 'KeyG') { e.preventDefault(); this._cycleMode(); }
      else if (e.code === 'KeyS') { e.preventDefault(); this._cycleScale(); }
      else if (e.code === 'KeyF') { e.preventDefault(); this._cyclePattern(); }
      else if (e.code === 'KeyA') { e.preventDefault(); this._centerScan(); }
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
    const span = patternsFor(mode(this.radar)).length;
    setPattern(this.radar, (this.radar.patternIndex + 1) % span);
    toast(pattern(this.radar).label);
  }

  _centerScan() {
    if (centerGimbal(this.radar)) { toast('SCAN CENTRED'); }
    else { toast('NO AUTO-CENTRE · SRC', 'deny'); }
  }

  _selectWeapon(id) {
    if (this.selectedWeapon === id) { return; }
    this.selectedWeapon = id;
    toast('SELECTED · ' + MISSILES[id].label, 'good');
  }

  _toggleSwap() {
    this.controlsSwapped = !this.controlsSwapped;
    const btn = document.getElementById('swapBtn');
    btn?.classList.toggle('on', this.controlsSwapped);
    relabelControls(this.controlsSwapped);
    toast(this.controlsSwapped ? 'ARROWS = PIPPER · WASD = GIMBAL' : 'ARROWS = GIMBAL · WASD = PIPPER', 'good');
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

    const arrowAz = input.axis('ArrowLeft', 'ArrowRight'), arrowV = input.axis('ArrowDown', 'ArrowUp');
    const wasdAz = input.axis('KeyA', 'KeyD'), wasdV = input.axis('KeyS', 'KeyW');
    const [gimbalAz, gimbalEl] = this.controlsSwapped ? [wasdAz, wasdV] : [arrowAz, arrowV];
    const [pipAz, pipRange] = this.controlsSwapped ? [arrowAz, arrowV] : [wasdAz, wasdV];

    // Once locked, the radar itself slaves the antenna onto the target (see
    // tickRadar) - manual gimbal/pipper input is parked so it can't fight
    // that single-target-track behaviour.
    if (!radar.lockedId) {
      slewGimbal(radar, gimbalAz, gimbalEl, dt);
      if (pipAz || pipRange) {
        movePipper(radar, pipAz, pipRange, dt);
        // Only claim the selection while the pipper is actually being
        // steered - otherwise a pipper left resting near an old contact
        // would silently fight a later TAB press every single frame.
        updatePipperSelection(radar);
      }
    }

    const hadLock = radar.lockedId;
    tickWorld(world, dt);
    tickRadar(radar, world, dt);
    if (hadLock && !radar.lockedId) { toast('LOCK LOST', 'deny'); }

    if (input.hit('Tab') && !radar.lockedId) { stepSelection(radar); }
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
      else if (!m.alive) {
        const name = world.contacts.find((c) => c.id === m.targetId)?.name || 'target';
        toast((m.expired ? 'SELF-DESTRUCT · ' : 'MISSILE LOST · ') + name, 'deny');
      }
    }
    this.missiles = this.missiles.filter((m) => m.alive);

    // Projected-intercept cue for whatever's selected right now, using
    // whichever weapon is actually selected to fire - "if I fired THIS on
    // THIS, would it connect?" A weapon that would refuse the shot outright
    // (see weapons.js's canFire) doesn't need a simulation to know the
    // answer. Otherwise this runs a full engine forward simulation (see
    // intercept.js), so it's recomputed a few times a second - not every
    // frame - and reused in between.
    if (!radar.selectedId) {
      this.cue = null;
    } else if (world.time - (this._cueAt || -Infinity) >= 0.25) {
      const target = world.contacts.find((c) => c.id === radar.selectedId);
      if (!target || !target.alive) {
        this.cue = null;
      } else if (!canFire(this.selectedWeapon, target.kind)) {
        this.cue = { noShot: true, hit: false, t: 0, point: { x: target.x, y: target.y, altM: target.altM } };
      } else {
        this.cue = simulateIntercept(world, this.selectedWeapon, target);
      }
      this._cueAt = world.time;
    }

    updateHud(world, radar, this.missiles, this.ammo, this.selectedWeapon);
    drawB(this.canvasB, world, radar, this.missiles, this.terrain, world.time, this.cue);
    drawC(this.canvasC, world, radar, this.missiles, world.time);
    drawE(this.canvasE, world, radar, this.missiles, world.time, this.cue);
  }

  _launch() {
    const { radar, world, ammo, selectedWeapon } = this;
    if (!radar.lockedId) { toast('NO LOCK', 'deny'); return; }
    const track = radar.tracks.get(radar.lockedId);
    if (!track) { toast('NO LOCK', 'deny'); return; }
    const target = world.contacts.find((c) => c.id === radar.lockedId);
    if (!target) { return; }
    if (!canFire(selectedWeapon, target.kind)) {
      toast(MISSILES[selectedWeapon].label + ' WILL NOT FIRE ON THAT', 'deny');
      return;
    }
    if (!ammo[selectedWeapon]) { toast('NO AMMO · ' + MISSILES[selectedWeapon].label, 'deny'); return; }
    ammo[selectedWeapon]--;
    this.missiles.push(launchMissile(world, selectedWeapon, target));
    toast(MISSILES[selectedWeapon].label + ' AWAY · ' + target.name, 'good');
  }

  _resolveHit(m) {
    const target = this.world.contacts.find((c) => c.id === m.targetId);
    if (!target) { return; }
    this.flash.classList.remove('hit'); void this.flash.offsetWidth; this.flash.classList.add('hit');
    if (m.noDamage) {
      // A real hit - the round closed and fuzed - but the wrong warhead
      // for the job, so the target rides it out.
      toast('HIT · NO KILL - INSUFFICIENT DAMAGE · ' + target.name, 'deny');
      return;
    }
    target.alive = false;
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

function relabelControls(swapped) {
  const set = (id, text) => { const el = document.getElementById(id); if (el) { el.textContent = text; } };
  set('hintArrowAz', swapped ? 'pipper az' : 'antenna az');
  set('hintArrowV', swapped ? 'pipper range' : 'antenna el');
  set('hintWasd', swapped ? 'antenna' : 'pipper');
}

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
