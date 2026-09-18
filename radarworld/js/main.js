/**
 * World View: a live 3D plot of every contact's TRUE position relative to
 * ownship - the same simulated world the radar page runs (imported
 * straight from it, not a reimplementation), rendered as real geometry you
 * can orbit and zoom around rather than a flat top-down readout. Nothing
 * here is gated by a mode, a gimbal limit, or a scan pattern - it's an
 * omniscient reference view, not a sensor picture.
 *
 * Ownship sits fixed at the scene origin every frame (everything else is
 * plotted relative to it) - that's what lets OrbitControls' target stay
 * put while ownship actually flies on, with no per-frame recentring hacks.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildWorld, tickWorld } from '../../radar/js/sim/world.js';
import { KIND_COLOR, P } from '../../radar/js/render/palette.js';

export const VERSION = '2026.09.18-1';

// 1 scene unit = 1 km horizontally. Altitude gets its own exaggeration - to
// scale, 12 km of altitude next to a 100+ km range would read as almost
// perfectly flat, which defeats the point of a 3D debug view.
const KM = 1000;
const ALT_EXAGGERATION = 4;
const VIEW_KM = [25, 50, 100, 200, 400];
const RING_KM = [25, 50, 100, 200];

const $ = (id) => document.getElementById(id);

/** World-relative-to-ownship metres -> scene units (km horizontally, exaggerated km vertically). */
function toScene(dxM, dyM, daltM) {
  return new THREE.Vector3(dxM / KM, (daltM / KM) * ALT_EXAGGERATION, -dyM / KM);
}

function makeDotTexture(colorCss) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, colorCss);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  return new THREE.CanvasTexture(c);
}

/** A canvas-textured, camera-facing text label with a fixed screen size. */
function makeLabelSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, sizeAttenuation: false, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.16, 0.04, 1);
  sprite.renderOrder = 10;
  sprite.userData.canvas = canvas;
  sprite.userData.ctx = canvas.getContext('2d');
  sprite.userData.lastText = '';
  return sprite;
}

function drawLabel(sprite, line1, line2, color) {
  const key = line1 + '|' + line2 + '|' + color;
  if (sprite.userData.lastText === key) { return; }
  sprite.userData.lastText = key;
  const ctx = sprite.userData.ctx, canvas = sprite.userData.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '700 26px "Share Tech Mono", monospace';
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 6;
  ctx.fillText(line1, 4, 26);
  ctx.font = '22px "Share Tech Mono", monospace';
  ctx.fillStyle = 'rgba(196,255,214,.85)';
  ctx.shadowBlur = 3;
  ctx.fillText(line2, 4, 54);
  sprite.material.map.needsUpdate = true;
}

/** A ring on the ground (y=0), centred on the scene origin (ownship), with a range label at true north. */
function buildRing(radiusKm, color) {
  const group = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.sin(a) * radiusKm, 0, Math.cos(a) * radiusKm));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28 }));
  group.add(line);

  const label = makeLabelSprite();
  label.scale.set(0.16, 0.04, 1);
  label.position.set(0, 0.05, -radiusKm);
  drawLabel(label, radiusKm + ' KM', '', 'rgba(196,255,214,.55)');
  group.add(label);
  return group;
}

function buildOwnshipMesh() {
  const group = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 5.5, 4),
    new THREE.MeshBasicMaterial({ color: P.bright }),
  );
  cone.rotation.x = -Math.PI / 2;   // apex (was +Y) now points to -Z, i.e. north in this scene
  cone.rotation.y = Math.PI / 4;    // square the 4-sided cone up so a flat face reads as the nose
  group.add(cone);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeDotTexture(P.bright), transparent: true, sizeAttenuation: false, depthTest: false, opacity: 0.9,
  }));
  glow.scale.set(0.05, 0.05, 1);
  glow.renderOrder = 9;
  group.add(glow);
  return group;
}

class WorldView3D {
  constructor() {
    this.world = buildWorld();
    this.canvas = $('map');
    this.viewKm = null;   // null = auto-fit, set once at boot and on demand
    this.markers = new Map();   // contact id -> { blip, label, stalk }
    this._dotTextureCache = new Map();

    this._initThree();
    this._buildStaticScene();
    this._buildZoomButtons();

    this.viewKm = this._autoFitKm();
    this._applyDistance(this.viewKm);

    this.last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
    addEventListener('resize', () => this._resize());
  }

  _initThree() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03150a);
    scene.fog = new THREE.Fog(0x03150a, 250, 900);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 4000);
    camera.position.set(95, 42, 115);   // low, oblique - shows the exaggerated altitude separation clearly

    const controls = new OrbitControls(camera, this.canvas);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 3200;
    controls.maxPolarAngle = Math.PI * 0.495;   // stop just short of going under the ground

    this.renderer = renderer; this.scene = scene; this.camera = camera; this.controls = controls;
  }

  _buildStaticScene() {
    const grid = new THREE.GridHelper(4000, 100, 0x1a8a3c, 0x11340f);
    grid.material.transparent = true; grid.material.opacity = 0.35;
    this.scene.add(grid);

    for (const km of RING_KM) { this.scene.add(buildRing(km, 0x1a8a3c)); }

    // a faint N/E cross through the origin, for orientation
    const crossPts = [
      new THREE.Vector3(0, 0.02, -400), new THREE.Vector3(0, 0.02, 400),
      new THREE.Vector3(-400, 0.02, 0), new THREE.Vector3(400, 0.02, 0),
    ];
    const crossGeo = new THREE.BufferGeometry().setFromPoints(crossPts);
    crossGeo.setIndex([0, 1, 2, 3]);
    this.scene.add(new THREE.LineSegments(crossGeo, new THREE.LineBasicMaterial({ color: 0x2dff6a, transparent: true, opacity: 0.25 })));

    const north = makeLabelSprite();
    north.scale.set(0.1, 0.03, 1);
    north.position.set(0, 0.05, -8);
    drawLabel(north, 'N', '', P.bright);
    this.scene.add(north);

    this.ownMesh = buildOwnshipMesh();
    this.scene.add(this.ownMesh);
  }

  _buildZoomButtons() {
    const root = $('zoomGroup');
    if (!root) { return; }
    const mk = (label, value) => {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = label;
      b.addEventListener('click', () => { this.viewKm = value; this._applyDistance(value == null ? this._autoFitKm() : value); this._highlightZoom(); b.blur(); });
      root.appendChild(b);
      return b;
    };
    this._zoomButtons = [mk('AUTO', null), ...VIEW_KM.map((km) => mk(km + ' KM', km))];
    this._highlightZoom();
  }

  _highlightZoom() {
    (this._zoomButtons || []).forEach((b) => b.classList.toggle('on', b.textContent === (this.viewKm == null ? 'AUTO' : this.viewKm + ' KM')));
  }

  /** Re-point the camera at the current distance along its existing viewing
   *  direction - a zoom preset, not a full view reset, so orbiting first
   *  and then picking a distance doesn't throw away the chosen angle. */
  _applyDistance(km) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    const dist = dir.length() > 1e-6 ? dir.length() : 1;
    dir.multiplyScalar((km * 0.9) / dist);
    this.camera.position.copy(this.controls.target).add(dir);
  }

  _autoFitKm() {
    let maxKm = 0;
    for (const c of this.world.contacts) {
      if (!c.alive) { continue; }
      const km = Math.hypot(c.x - this.world.own.x, c.y - this.world.own.y) / KM;
      if (km > maxKm) { maxKm = km; }
    }
    return Math.max(15, Math.min(300, (maxKm || 15) * 1.3));
  }

  _resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / Math.max(1, r.height);
    this.camera.updateProjectionMatrix();
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
    this._resize();
    this._updateMarkers();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._updateHud();
  }

  _dotTexture(colorCss) {
    let tex = this._dotTextureCache.get(colorCss);
    if (!tex) { tex = makeDotTexture(colorCss); this._dotTextureCache.set(colorCss, tex); }
    return tex;
  }

  _markerFor(c) {
    let m = this.markers.get(c.id);
    if (m) { return m; }
    const color = !c.href ? '#9c8f7c' : (KIND_COLOR[c.kind] || P.green);
    const blip = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._dotTexture(color), transparent: true, sizeAttenuation: false, depthTest: false,
    }));
    blip.scale.set(0.028, 0.028, 1);
    blip.renderOrder = 8;
    const label = makeLabelSprite();
    const stalkGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const stalk = new THREE.Line(stalkGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    this.scene.add(blip, label, stalk);
    m = { blip, label, stalk, color };
    this.markers.set(c.id, m);
    return m;
  }

  _updateMarkers() {
    const own = this.world.own;
    // Nearer contacts draw their label on top of farther ones (both use
    // depthTest:false so draw order, not the depth buffer, decides which
    // overlapping label wins) - when several contacts cluster together,
    // at least the closest one stays legible.
    const withDist = this.world.contacts.map((c) => ({
      c, camDist: toScene(c.x - own.x, c.y - own.y, c.altM - own.altM).distanceTo(this.camera.position),
    })).sort((a, b) => b.camDist - a.camDist);

    withDist.forEach(({ c, camDist }, i) => {
      const m = this._markerFor(c);
      const pos = toScene(c.x - own.x, c.y - own.y, c.altM - own.altM);
      m.blip.position.copy(pos);
      m.blip.material.opacity = c.alive ? 1 : 0.3;
      m.blip.renderOrder = 8 + i;
      m.label.position.copy(pos).add(new THREE.Vector3(0, 0.11, 0));
      m.label.visible = true;
      m.label.renderOrder = 100 + i;
      const rangeKm = Math.hypot(c.x - own.x, c.y - own.y) / KM;
      drawLabel(m.label, c.name, rangeKm.toFixed(1) + ' KM · ' + Math.round(c.altM) + ' M', m.color);

      const ground = pos.clone(); ground.y = 0;
      const positions = m.stalk.geometry.attributes.position.array;
      positions[0] = ground.x; positions[1] = ground.y; positions[2] = ground.z;
      positions[3] = pos.x; positions[4] = pos.y; positions[5] = pos.z;
      m.stalk.geometry.attributes.position.needsUpdate = true;
      m.stalk.material.opacity = c.alive ? 0.5 : 0.15;
    });
    this._renderContactList();
  }

  _renderContactList() {
    const root = $('contactList');
    if (!root) { return; }
    const own = this.world.own;
    const rows = this.world.contacts
      .map((c) => ({ c, rangeKm: Math.hypot(c.x - own.x, c.y - own.y) / KM }))
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
    set('wScale', this.viewKm == null ? 'AUTO' : this.viewKm + ' KM');
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
  window.__world = new WorldView3D();
}

boot();
