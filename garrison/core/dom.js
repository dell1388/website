/**
 * DOM lookups that fail loudly and usefully.
 *
 * The usual cause of a missing node is a stale cached index.html paired with
 * fresh scripts, so say that out loud rather than dying on `null.getContext`.
 */

export function el(id) { return document.getElementById(id); }

export function requireCanvas(id) {
  const node = el(id);
  if (!node) {
    throw new Error(
      `Missing <canvas id="${id}"> — this page looks out of date. ` +
      'Hard-refresh (Ctrl/Cmd + Shift + R).');
  }
  if (typeof node.getContext !== 'function') {
    throw new Error(`#${id} is a <${node.tagName.toLowerCase()}>, not a <canvas>.`);
  }
  const ctx = node.getContext('2d');
  if (!ctx) { throw new Error(`Could not get a 2D context from #${id}.`); }
  return { canvas: node, ctx };
}

const LINKS = [
  ['/clockwords/', 'Word War 3'],
  ['/wizardgame/', 'Aetherfall'],
  ['/vehicle-spotter/', 'Vehicle Spotter'],
  ['/classic.html', 'Field Notes'],
];

/**
 * Reveal the fallback links. Builds the panel from scratch when the markup
 * does not have one, so an out-of-date page still gets you somewhere.
 */
export function showFallback(why) {
  let panel = el('bootFail');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'bootFail';
    panel.className = 'screen';
    panel.innerHTML =
      '<div class="panel boot-panel"><h2>The tank would not start</h2>' +
      '<p>Something went wrong loading the game. The pages are all still here:</p>' +
      '<ul class="link-list">' +
      LINKS.map(([href, name]) => `<li><a href="${href}">${name}</a></li>`).join('') +
      '</ul><p id="bootFailWhy" class="boot-why"></p></div>';
    // Inline styling in case the stylesheet is what went missing.
    panel.style.cssText =
      'position:fixed;inset:0;z-index:99;display:grid;place-content:center;' +
      'padding:24px;background:rgba(24,14,6,0.94);color:#f6e3bd;' +
      'font-family:ui-monospace,monospace;text-align:center;line-height:1.7';
    document.body.appendChild(panel);
  }
  panel.classList.remove('hidden');
  const w = el('bootFailWhy');
  if (!w || !why) { return; }
  let text = String((why && why.message) || why).slice(0, 160);
  // The first stack frame tells you which file really threw, which matters
  // when the page might be serving scripts from somewhere unexpected.
  const frame = why && why.stack && String(why.stack).split('\n')
    .map((l) => l.trim())
    .find((l) => l.includes('.js'));
  if (frame) { text += `\n${frame.slice(0, 120)}`; }
  w.style.whiteSpace = 'pre-wrap';
  w.textContent = text;
}

/** A one-line nag when the page is missing HUD nodes the scripts expect. */
export function warnStale(missing) {
  console.warn('[garrison] page is missing:', missing.join(', '),
               '- index.html is probably cached. Hard-refresh to update it.');
  if (el('staleWarning')) { return; }
  const bar = document.createElement('div');
  bar.id = 'staleWarning';
  bar.textContent = 'This page looks cached — hard-refresh (Ctrl/Cmd + Shift + R) for the latest version.';
  bar.style.cssText =
    'position:fixed;left:50%;transform:translateX(-50%);bottom:10px;z-index:80;' +
    'padding:8px 16px;border-radius:8px;border:2px solid #402713;' +
    'background:#8a5a2e;color:#f6e3bd;font:14px ui-monospace,monospace;' +
    'box-shadow:0 4px 0 rgba(37,23,11,0.5)';
  bar.addEventListener('click', () => bar.remove());
  document.body.appendChild(bar);
}
