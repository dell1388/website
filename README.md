# Garrison

The front page is a small top-down tank game. It drops you straight into the
motor pool - no splash screen. You drive with **WASD**, aim the turret with the
mouse (or the arrow keys), and put three shells through the target in a room to
open that room's page.

```
index.html          the game shell + HUD markup
classic.html        the old plain card list (still linked, still works)
garrison/
  style.css         all styling: wooden panels, keycaps, overlays
  main.js           wires everything together and runs the frame loop
  content/site.js   >>> THE FILE YOU EDIT TO ADD A PAGE <<<
  core/             rng, input, camera, particles, procedural audio
  world/            map builder (rooms + corridors), scenery props
  entities/         tank, shells, targets
  render/           palette, procedural sprites, tile/wall renderer
  ui/               HUD, minimap, pause/breach overlays
  modules/          the plug-in system + the modules that ship with it
```

Everything the game owns lives under `garrison/`, deliberately: the site
already serves another game's client from `/js/` (`/wizardgame/` loads
`/js/main.js` by absolute path), so a top-level `js/` folder here would
collide with it. Keep new files inside `garrison/` and nothing can clash.

Everything is hand-drawn on a canvas at runtime — there are no image assets,
and the only sound is synthesised with WebAudio. The page needs a web server
(ES modules don't load from `file://`).

---

## Adding a page

Open `garrison/content/site.js` and add a room:

```js
{
  id: 'observatory',            // unique, also the localStorage key
  name: 'Star Charts',          // shown on the sign, HUD and minimap
  blurb: 'Point the telescope, name the constellation.',
  x: 60, y: 22, w: 14, h: 11,   // tile coords; keep clear of other rooms
  floor: 'stone',               // wood | stone | grass | dirt | tile | sand
  accent: '#6fb6d8',            // colour for the sign, halo and minimap pip
  href: '/observatory/',        // omit (or null) + add `locked: 'SOON'`
  corridor: { order: 'h' },     // 'h' = go sideways first, 'v' = vertically
  decor: ['crate', 'lantern', 'flowers'],
}
```

That single object gets you the carved room, a corridor dug from the hub, a
doorway, scenery, a shootable target, a waymarker trail of chevrons in the
corridor, a minimap pin and a HUD objective row.

Available decor kinds: `crate`, `barrel`, `tyre`, `anvil`, `lantern`, `tree`,
`crystal` (solid, mostly shootable) and `flowers`, `grass`, `rug` (flat).

Rooms with no `href` need a `locked` label — their target is chained shut and
shooting it just rattles the chains. That's how "The Workshop" and
"The Greenhouse" are parked until there's something behind them.

## Adding a feature (modules)

A module is a plain object with optional hooks, registered in
`garrison/modules/index.js`:

```js
export default {
  id: 'weather',
  init(ctx) {},                 // ctx = the game: world, tank, camera, audio, hud…
  update(dt, ctx) {},
  drawWorld(g, ctx) {},         // world coordinates, above the light pass
  drawUI(g, ctx) {},            // screen coordinates, above everything
  on(event, data, ctx) {},
};
```

Events: `start`, `fire`, `target:hit`, `target:destroyed`, `target:locked`,
`prop:destroyed`, `room:enter`, `wall:hit`, `pause`, `resume`.

Three ship already: `ambience` (pollen and fireflies), `hints` (the floating
label near a target) and `stats` (accuracy and distance in the HUD).

## Controls

| key | |
|---|---|
| `W` `A` `S` `D` | drive |
| mouse / `←` `→` / `Q` `E` | aim the turret |
| `SPACE` or left click | fire |
| `SHIFT` | boost |
| `M` | mute |
| `ESC` or `P` | menu, with direct links to every page |

Touch: drag the left half of the screen to drive, touch the right half to aim
and fire. Every destination is also a plain link in the Esc menu, in the HUD
list (the rows are clickable), in `classic.html` and in the `<noscript>` block,
so nobody is forced to play to get somewhere.

If the game script fails to load or throws on startup, a fallback panel with
those plain links takes over the page - the front page never becomes a dead
end. Saved state (visited rooms, mute, stats) goes through `garrison/core/storage.js`,
which falls back to memory where `localStorage` is blocked.
