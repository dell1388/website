import { TILE } from '../world/world.js';

const $ = (sel) => document.querySelector(sel);
/** The HUD is optional furniture: never die because a node went missing. */
const text = (node, value) => { if (node) { node.textContent = value; } };

export class HUD {
  constructor(world) {
    this.world = world;
    this.roomName = $('#roomName');
    this.roomBlurb = $('#roomBlurb');
    this.reloadFill = $('#reloadFill');
    this.reloadLabel = $('#reloadLabel');
    this.speedFill = $('#speedFill');
    this.objectives = $('#objectives');
    this.statLine = $('#statLine');
    this.toast = $('#toast');
    this.currentRoom = null;
    this.toastT = 0;
    this._buildObjectives();
  }

  _buildObjectives() {
    if (!this.objectives) { this.rows = new Map(); return; }
    this.objectives.innerHTML = '';
    this.rows = new Map();
    for (const t of this.world.targets) {
      const li = document.createElement('li');
      li.className = 'obj' + (t.locked ? ' locked' : '') + (t.visited ? ' visited' : '');
      li.innerHTML = `<span class="pip" style="--pip:${t.accent}"></span>
        <span class="obj-name">${t.label}</span>
        <span class="obj-state">${t.locked ? 'locked' : t.visited ? 'seen' : 'target'}</span>`;
      if (t.href) {
        li.tabIndex = 0;
        li.title = 'Jump straight to ' + t.label;
        li.addEventListener('click', () => { location.href = t.href; });
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter') { location.href = t.href; } });
      }
      this.objectives.appendChild(li);
      this.rows.set(t.id, li);
    }
  }

  markOpen(t) {
    const li = this.rows.get(t.id);
    if (!li) { return; }
    li.classList.add('open');
    li.querySelector('.obj-state').textContent = 'open';
  }

  showToast(title, sub) {
    if (!this.toast) { return; }
    this.toast.innerHTML = `<strong>${title}</strong><em>${sub || ''}</em>`;
    this.toast.classList.add('show');
    this.toastT = 2.6;
  }

  update(dt, state) {
    const { tank, world } = state;
    const room = world.roomAtPx(tank.x, tank.y);
    if (room !== this.currentRoom) {
      this.currentRoom = room;
      if (room) {
        text(this.roomName, room.name);
        text(this.roomBlurb, room.blurb || '');
        this.showToast(room.name, room.blurb);
        state.registry.emit('room:enter', room);
      } else {
        text(this.roomName, 'The Approach');
        text(this.roomBlurb, 'dirt track between rooms');
      }
    }

    const r = tank.reload > 0 ? 1 - tank.reload / tank.reloadTime : 1;
    if (this.reloadFill) {
      this.reloadFill.style.transform = `scaleX(${r})`;
      this.reloadFill.classList.toggle('ready', r >= 1);
    }
    text(this.reloadLabel, r >= 1 ? 'SHELL READY' : 'RELOADING');
    if (this.speedFill) { this.speedFill.style.transform = `scaleX(${Math.min(1, tank.speed01)})`; }

    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0 && this.toast) { this.toast.classList.remove('show'); }
    }

    if (state.stats && this.statLine) {
      const acc = state.stats.shots ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
      const km = (state.stats.distance / TILE / 25).toFixed(2);
      text(this.statLine, `ACC ${acc}%  ·  ${state.stats.shots} FIRED  ·  ${km} KM`);
    }
  }
}
