import { TARGETS } from '../../content/targets.js';

const CLASS_KEY = { air: 'air', ground_fixed: 'gnd', ground_mover: 'gnd', sea: 'sea' };

export function buildDossier() {
  const root = document.getElementById('dossierRows');
  if (!root) { return; }
  root.innerHTML = TARGETS.map((t) => {
    const nostrike = !t.href;
    const rowClass = nostrike ? 'nostrike' : CLASS_KEY[t.kind];
    const d = t.dossier || {};
    return `<div class="dos-grid row ${rowClass}">
      <span class="d-name">${t.name}<em>${describeKind(t)}</em></span>
      <span class="d-cls">${d.cls || ''}</span>
      <span class="d-mode">${d.modes || '—'}</span>
      <span class="d-prof">${d.profile || ''}</span>
      <span class="d-opens">${t.href || '—'}</span>
    </div>`;
  }).join('');

  const panel = document.getElementById('dossier');
  const btn = document.getElementById('dossierBtn');
  const close = document.getElementById('dosClose');
  const toggle = (on) => panel.classList.toggle('on', on ?? !panel.classList.contains('on'));
  if (btn) { btn.addEventListener('click', () => { toggle(); btn.blur(); }); }
  if (close) { close.addEventListener('click', () => { toggle(false); close.blur(); }); }
  return { toggle, isOpen: () => panel.classList.contains('on') };
}

function describeKind(t) {
  if (t.kind === 'air') { return '◇ air contact'; }
  if (t.kind === 'sea') { return '⬢ surface contact'; }
  if (t.kind === 'ground_mover') { return '▣ ground contact, moving'; }
  return '▣ ground contact' + (t.href ? '' : ' · no-strike');
}
