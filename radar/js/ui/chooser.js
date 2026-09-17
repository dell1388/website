import { load, save } from '../core/storage.js';

const KEY = 'garrison.pilot';

/**
 * First-visit "tank or plane" choice, shared with the tank homepage via the
 * same storage key. Returns true if the sim should start immediately
 * (a preference already existed), false if it must wait for `onPlane`.
 */
export function initChooser(onPlane) {
  const pref = load(KEY);
  const el = document.getElementById('chooser');
  const tank = document.getElementById('chTank');
  const plane = document.getElementById('chPlane');

  const choose = (which, btn) => {
    if (btn) { btn.blur(); }               // else Space/Enter would re-fire it
    save(KEY, which);
    el.classList.remove('on');
    if (which === 'tank') { location.href = '/'; } else if (onPlane) { onPlane(); }
  };
  if (tank) { tank.addEventListener('click', () => choose('tank', tank)); }
  if (plane) { plane.addEventListener('click', () => choose('plane', plane)); }

  if (!pref) { el.classList.add('on'); return false; }
  return true;
}
