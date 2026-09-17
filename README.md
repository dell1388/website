# Garrison

The front page is a small top-down tank game. It drops you straight into the
motor pool - no splash screen. You drive with **WASD**, aim the turret with the
mouse (or the arrow keys), and put three shells through the target in a room to
open that room's page.

```
index.html          the game shell + HUD markup
classic.html        plain card list, same wooden theme, no scripts
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

## The radar version (`/radar/`)

Same idea as the tank, different vehicle: a top-down aircraft radar. Sweep
the beam with the arrow keys, get a track, lock it, launch, and a hit opens
that contact's page.

```
radar/
  index.html          the radar shell + HUD markup
  style.css           heavier military styling: phosphor green, stencil type
  content/targets.js  >>> THE FILE YOU EDIT TO ADD A RADAR TARGET <<<
  js/
    main.js           wires it together and runs the frame loop
    core/             rng, atmosphere (mach<->m/s), input, storage
    sim/              ownship + contacts, the radar set, missile flight
    render/           the B/C/E-scope drawers, the background terrain map
    ui/               HUD, the target dossier, the plane/tank chooser
```

**The radar teaches three real distinctions**, each with a target built
around it:

- **B-scope** (azimuth vs range), **C-scope** (azimuth vs elevation) and
  **E-scope** (range vs altitude, in metres) are three views of the same
  picture. The antenna's elevation is still an angle, so on the E-scope the
  beam and the scan box are drawn as radial lines pivoting out of the
  ownship's own altitude at zero range - altitude = range × tan(angle) - so
  they visibly swing up and down as elevation changes, never a level line.
  A scattering of dim ground-clutter dots near the bottom is purely for
  orientation (it isn't a real return, and doesn't try to be).
- **SRC vs TWS**: SRC paints a contact and lets it fade; TWS remembers it as
  a track that coasts between beam revisits - only a TWS mode can hold a
  lock, so you can't launch out of a plain search mode.
- **Mode gates what you can even see**: an air target only answers SRC/TWS,
  a moving ground target only answers the GMTI modes, a fixed one only the
  HDN modes, and a surface contact only TWS SEA. The dossier (`/`, or the
  button) explains this per-target.

**Missiles** are auto-selected by target class - AIM-7 Sparrow (air),
AGM-84 Harpoon (surface), AGM-114L Hellfire (ground) - and modelled with a
boost phase and a coast phase, each capped by its own max-G turn rate the
guidance can't exceed (Sparrow is far more agile than the other two, per
the brief; Harpoon barely turns at all). No range or fuel limit - see
below. Ammo is finite per weapon (`js/sim/weapons.js`).

Since the ownship flies a fixed straight line north forever (no player
control over heading), a stationary target's closest possible range is
fixed at its crossrange offset for the whole flight - **that offset has to
sit inside the assigned weapon's range**, or the shot is unwinnable no
matter when it's fired. `content/targets.js` keeps this in mind when
placing ground/sea targets; keep it in mind adding a new one.

### Controls (radar)

| key | |
|---|---|
| `←` `→` | antenna azimuth (±90°) |
| `↑` `↓` | antenna elevation (±60°) |
| `W` `A` `S` `D` | the pipper - a selection reticle, independent of the antenna |
| `TAB` | step the selection through current tracks |
| `ENTER` | lock / unlock the selection |
| `SPACE` | launch at the lock |
| `ALT` `G` | cycle mode |
| `ALT` `S` | cycle scale |
| `ALT` `F` | cycle pattern |
| `/` | target dossier |
| mode / scale / pattern buttons | click to change directly |

The pipper is a second reticle, moved with WASD, that lives on the C-scope
(az/el) and reaches anywhere in the gimbal envelope regardless of the
current scan box - point it near a track and that track becomes the
selection, same role `TAB` plays, just spatial instead of a list. It only
grabs the selection while actually being moved, so leaving it resting near
an old contact never fights a later `TAB` press.

Two things worth knowing if you're editing the sim:

- **Missiles don't run out of range or fuel.** A shot ends on a hit or when
  the target dies - full stop. There's a very generous distance safety
  valve (`MAX_FLIGHT_DISTANCE_M` in `weapons.js`) purely so a round that can
  genuinely never catch a maneuvering target doesn't fly forever; it should
  never be reachable in ordinary play.
- **A stationary target still has to sit within reach.** The ownship flies
  a fixed straight line, so a fixed target's closest possible range is its
  crossrange offset, forever - that part hasn't changed even though the
  *weapon's* range cap is gone. `content/targets.js` has more on this.

### Plane or tank?

Both front pages share one preference (`localStorage['garrison.pilot']`).
`/radar/` asks once, on a machine that has never chosen, with the overlay
you see on first load; picking TANK sends you to `/`, picking PLANE starts
the sim and is remembered. `/` has **no such prompt** - dialogue-on-load was
removed from the tank page earlier - but a returning "plane" preference
silently sends the bare `/` straight to `/radar/`, and each page carries a
plain link to the other (the tank's pause menu; the radar's header) so the
switch is always available without a gate in front of it.
