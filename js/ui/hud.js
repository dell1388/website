import { TILE } from '../world/world.js';

const $ = (sel) => document.querySelector(sel);

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
        this.roomName.textContent = room.name;
        this.roomBlurb.textContent = room.blurb || '';
        this.showToast(room.name, room.blurb);
        state.registry.emit('room:enter', room);
      } else {
        this.roomName.textContent = 'The Approach';
        this.roomBlurb.textContent = 'dirt track between rooms';
      }
    }

    const r = tank.reload > 0 ? 1 - tank.reload / tank.reloadTime : 1;
    this.reloadFill.style.transform = `scaleX(${r})`;
    this.reloadFill.classList.toggle('ready', r >= 1);
    this.reloadLabel.textContent = r >= 1 ? 'SHELL READY' : 'RELOADING';
    this.speedFill.style.transform = `scaleX(${Math.min(1, tank.speed01)})`;

    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) { this.toast.classList.remove('show'); }
    }

    if (state.stats) {
      const acc = state.stats.shots ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
      const km = (state.stats.distance / TILE / 25).toFixed(2);
      this.statLine.textContent = `ACC ${acc}%  ·  ${state.stats.shots} FIRED  ·  ${km} KM`;
    }
  }
}
