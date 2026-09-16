/**
 * localStorage is not always there: private windows, blocked third-party
 * storage and some embedded webviews throw on the very first access.
 * A dead save slot must never take the game down with it.
 */
let store = null;
try {
  const probe = '__garrison_probe__';
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
  store = window.localStorage;
} catch (e) {
  store = null;
}

const memory = new Map();

export function load(key, fallback = null) {
  try {
    const v = store ? store.getItem(key) : (memory.has(key) ? memory.get(key) : null);
    return v === null ? fallback : v;
  } catch (e) { return fallback; }
}

export function save(key, value) {
  try {
    if (store) { store.setItem(key, String(value)); } else { memory.set(key, String(value)); }
  } catch (e) { /* quota or blocked - not worth caring about */ }
}

export function loadJSON(key, fallback = null) {
  try { return JSON.parse(load(key, 'null')) ?? fallback; } catch (e) { return fallback; }
}

export function saveJSON(key, value) {
  try { save(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}
