import { buildWorld, TILE } from './world/world.js';
import { buildProps } from './world/props.js';
import { buildTargets, markVisited } from './entities/target.js';
import { Tank } from './entities/tank.js';
import { Bullets } from './entities/bullet.js';
import { Input } from './core/input.js';
import { Camera } from './core/camera.js';
import { Particles } from './core/particles.js';
import { Audio } from './core/audio.js';
import { Renderer, drawDecor } from './render/renderer.js';
import { Registry } from './modules/registry.js';
import MODULES from './modules/index.js';
import { HUD } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { Overlays } from './ui/overlays.js';
import { clamp } from './core/rng.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.g = this.canvas.getContext('2d');
    this.world = buildWorld();
    this.world.props = buildProps(this.world);
    this.world.targets = buildTargets(this.world);

    this.tank = new Tank(this.world);
    this.bullets = new Bullets(this.world);
    this.particles = new Particles();
    this.camera = new Camera();
    this.input = new Input(this.canvas);
    this.audio = new Audio();
    this.renderer = new Renderer(this.world);
    this.hud = new HUD(this.world);
    this.minimap = new Minimap(document.getElementById('minimap'), this.world);
    this.overlays = new Overlays(this);

    this.time = 0;
    this.paused = false;
    this.running = false;
    this.treadT = 0;
    this.stats = null;

    this.registry = new Registry(this);
    this.registry.addAll(MODULES);

    this.camera.x = this.tank.x;
    this.camera.y = this.tank.y;
    this._resize();
    addEventListener('resize', () => this._resize());

    document.getElementById('muteBtn').addEventListener('click', () => this._toggleMute());
    document.getElementById('menuBtn').addEventListener('click', () => this.overlays.setPaused(true));

    this.last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  begin() {
    this.running = true;
    this.audio.start();
    this.audio.resume();
    this.registry.emit('start', null);
    this.hud.showToast('The Motor Pool', 'WASD to drive · aim · fire');
  }

  _toggleMute() {
    const m = this.audio.toggleMute();
    const btn = document.getElementById('muteBtn');
    btn.classList.toggle('off', m);
    btn.setAttribute('aria-pressed', String(!m));
  }

  _resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
    this.camera.viewW = w;
    this.camera.viewH = h;
    this.camera.bounds = { w: this.world.pxW, h: this.world.pxH };
    this.baseZoom = clamp(Math.min(w, h * 1.5) / 940, 0.7, 1.9);
  }

  _frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;

    if (this.running) {
      // pause + mute stay live while paused, so Esc toggles both ways
      if (this.input.hit('Escape') || this.input.hit('KeyP')) { this.overlays.setPaused(!this.paused); }
      if (this.input.hit('KeyM')) { this._toggleMute(); }
      if (!this.paused) { this._update(dt); }
    } else {
      this._idleCamera(dt);
      if (this.input.hit('Space') || this.input.hit('Enter') || this.input.hit('KeyW')) {
        this.overlays.start();
      }
    }

    this._draw(dt);
    this.input.endFrame();
    requestAnimationFrame((t) => this._frame(t));
  }

  _idleCamera(dt) {
    const hub = this.world.hub;
    const cx = (hub.x + hub.w / 2) * TILE, cy = (hub.y + hub.h / 2) * TILE;
    const a = this.time * 0.13;
    this.camera.targetZoom = this.baseZoom * 0.92;
    this.camera.follow(cx + Math.cos(a) * 190, cy + Math.sin(a) * 120, dt);
    this.particles.update(dt);
    this.registry.update(dt);
  }

  _update(dt) {
    const input = this.input;

    const aim = input.aimMode === 'mouse'
      ? this.camera.screenToWorld(input.mouse.x, input.mouse.y)
      : null;

    this.tank.update(dt, input, aim);

    if (input.fireHeld && this.tank.canFire()) { this._fire(); }

    this.bullets.update(dt, {
      onWall: (x, y) => {
        this.particles.burst(x, y, 7, {
          color: ['#d9c39a', '#b59367', '#8a6b45'], speed: 150, life: 0.4, size: 3.4, drag: 0.85,
        });
        this.renderer.stamp(x, y, 7, 0.12);
        this.audio.thud();
        this.registry.emit('wall:hit', { x, y });
      },
      onProp: (p, b) => this._hitProp(p, b),
      onTarget: (t, b) => this._hitTarget(t, b),
      onTrail: (b) => {
        this.particles.spawn({
          x: b.x, y: b.y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: 3,
          color: '#e8d4ae', shape: 'smoke', drag: 0.9, fade: 0.6,
        });
      },
    });

    // tread marks
    this.treadT -= dt;
    if (Math.abs(this.tank.speed) > 25 && this.treadT <= 0) {
      this.treadT = 0.035;
      const a = this.tank.angle + Math.PI / 2;
      for (const side of [-1, 1]) {
        this.renderer.stamp(
          this.tank.x + Math.cos(a) * 15 * side,
          this.tank.y + Math.sin(a) * 15 * side, 6, 0.07);
      }
      if (Math.random() < 0.3) {
        this.particles.spawn({
          x: this.tank.x - Math.cos(this.tank.angle) * 20,
          y: this.tank.y - Math.sin(this.tank.angle) * 20,
          vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
          life: 0.7, max: 0.7, size: 5, color: 'rgba(214,196,164,0.55)', shape: 'smoke', drag: 0.94,
        });
      }
    }

    for (const p of this.world.props) { if (p.hitFlash > 0) { p.hitFlash -= dt; } }
    for (const t of this.world.targets) { if (t.shake > 0) { t.shake = Math.max(0, t.shake - dt * 3); } }

    this.particles.update(dt);
    this.registry.update(dt);

    const spd = this.tank.speed01;
    this.camera.targetZoom = this.baseZoom * (1 - spd * 0.06);
    const lead = this.tank.speed * 0.28;
    this.camera.follow(
      this.tank.x + Math.cos(this.tank.angle) * lead,
      this.tank.y + Math.sin(this.tank.angle) * lead, dt);

    this.audio.engineState(spd, Math.abs(this.tank.throttle));
    this.hud.update(dt, this);
  }

  _fire() {
    const m = this.tank.fire();
    this.bullets.spawn(m.x, m.y, m.angle);
    this.camera.kick(7);
    this.audio.fire();
    const ca = Math.cos(m.angle), sa = Math.sin(m.angle);
    this.particles.burst(m.x + ca * 6, m.y + sa * 6, 14, {
      color: ['#fff3c4', '#ffd47a', '#ff9d4d'], speed: 260, life: 0.32, size: 5,
      vx: ca * 130, vy: sa * 130, drag: 0.82, glow: 12, shape: 'spark',
    });
    this.particles.burst(m.x, m.y, 8, {
      color: 'rgba(226,212,186,0.75)', speed: 70, life: 0.9, size: 6,
      vx: ca * 40, vy: sa * 40, shape: 'smoke', drag: 0.9, fade: 0.5,
    });
    this.registry.emit('fire', m);
  }

  _hitProp(p, b) {
    this.particles.burst(b.x, b.y, 10, {
      color: p.kind === 'crystal' ? ['#cbbcff', '#9f8ce6', '#fff'] : ['#c78a4e', '#8a5a2e', '#e0c093'],
      speed: 180, life: 0.5, size: 4, drag: 0.86,
    });
    this.camera.kick(3);
    p.hitFlash = 0.08;
    if (p.hp > 0) {
      p.hp--;
      this.audio.hit();
      if (p.hp <= 0) {
        p.dead = true;
        this.renderer.stamp(p.x, p.y, 16, 0.16);
        this.particles.burst(p.x, p.y, 22, {
          color: ['#c78a4e', '#8a5a2e', '#e0c093', '#5c3a1c'],
          speed: 260, life: 0.75, size: 5, drag: 0.88,
        });
        this.audio.ping(300, 0.22, 'square', 0.2);
        this.camera.kick(6);
        this.registry.emit('prop:destroyed', p);
      }
    } else {
      this.audio.thud();
    }
  }

  _hitTarget(t, b) {
    if (t.state === 'done') { return; }
    this.camera.kick(5);
    t.shake = 1;

    if (t.locked || !t.href) {
      this.audio.denied();
      this.particles.burst(b.x, b.y, 10, {
        color: ['#9c8f7c', '#d8c6a4', '#6a6156'], speed: 150, life: 0.45, size: 4, drag: 0.86,
      });
      this.hud.showToast(t.label, t.locked || 'sealed');
      this.registry.emit('target:locked', t);
      return;
    }

    t.hp--;
    this.audio.hit();
    this.particles.burst(b.x, b.y, 16, {
      color: ['#f6e3bd', '#c4503f', '#e8b44a'], speed: 220, life: 0.5, size: 4.5, drag: 0.85,
    });
    this.registry.emit('target:hit', t);

    if (t.hp <= 0) {
      t.state = 'done';
      markVisited(t);
      this.hud.markOpen(t);
      this.camera.kick(14);
      this.audio.fanfare();
      this.particles.burst(t.x, t.y, 46, {
        color: ['#f6e3bd', '#c4503f', '#e8b44a', t.accent], speed: 340, life: 1.1, size: 6, drag: 0.9,
      });
      this.particles.burst(t.x, t.y, 20, {
        color: 'rgba(240,226,196,0.7)', speed: 120, life: 1.4, size: 10, shape: 'smoke', drag: 0.93, fade: 0.4,
      });
      this.registry.emit('target:destroyed', t);
      this.overlays.breach(t, () => { location.href = t.href; });
    } else {
      this.hud.showToast(t.label, `${t.hp} hit${t.hp > 1 ? 's' : ''} to breach`);
    }
  }

  _draw(dt) {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.camera.viewW, this.camera.viewH);
    g.fillStyle = '#2b1d10';
    g.fillRect(0, 0, this.camera.viewW, this.camera.viewH);

    g.save();
    this.camera.apply(g);
    const view = this.camera.view();

    this.renderer.drawFloor(g, view);
    for (const d of this.world.decor) {
      if (d.x < view.x0 - 30 || d.x > view.x1 + 30 || d.y < view.y0 - 30 || d.y > view.y1 + 30) { continue; }
      drawDecor(g, d, this.time);
    }
    this.renderer.drawRoomBanners(g, view, this.time);
    this.renderer.drawWalls(g, view, this.time);
    this.renderer.drawEntities(g, this, this.time);
    this.renderer.drawLighting(g, this);
    this.registry.drawWorld(g);   // modules draw above the light pass
    g.restore();

    this.registry.drawUI(g);
    this.minimap.draw(this, dt);
  }
}

// Wait for the pixel fonts so canvas text is not drawn in a fallback face.
let booted = false;
const boot = () => {
  if (booted) { return; }
  booted = true;
  window.game = new Game();
};
if (document.fonts && document.fonts.ready) {
  setTimeout(boot, 1500);
  document.fonts.ready.then(boot).catch(boot);
} else { boot(); }
