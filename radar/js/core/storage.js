/**
 * Same defensive localStorage wrapper as the tank game (garrison/core/storage.js).
 * Kept as its own copy so radar/ has no build-time dependency on garrison/.
 */
let store = null;
try {
  const probe = '__radar_probe__';
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
  store = window.localStorage;
} catch (e) { store = null; }

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
