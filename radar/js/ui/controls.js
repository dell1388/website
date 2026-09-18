/** The CONTROLS overlay - a static key-bindings reference, toggled by the
 *  footer button, the C key, or Escape. Same open/close pattern as the
 *  dossier, just without any rows to build (the content is fixed markup
 *  in index.html). */
export function buildControls() {
  const panel = document.getElementById('controls');
  const btn = document.getElementById('ctrlBtn');
  const close = document.getElementById('ctrlClose');
  if (!panel) { return; }
  const toggle = (on) => panel.classList.toggle('on', on ?? !panel.classList.contains('on'));
  if (btn) { btn.addEventListener('click', () => { toggle(); btn.blur(); }); }
  if (close) { close.addEventListener('click', () => { toggle(false); close.blur(); }); }
  return { toggle, isOpen: () => panel.classList.contains('on') };
}
