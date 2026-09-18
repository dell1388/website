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
    core/             rng, input, storage
    engine/           the flight-physics engine (see below) - vec, physics,
                       profiles, bodies, control, world
    sim/              ownship + contacts (flown on the engine), the radar
                       set, missile flight, the intercept-cue calculator
    render/           the B/C/E-scope drawers, the background terrain map
    ui/               HUD, the target dossier, the plane/tank chooser
```

**The flight model is a real point-mass physics engine**, not kinematics -
a JS port of [skysim](https://github.com/dell1388/bvr-sim): International
Standard Atmosphere, thrust/drag/lift/weight, fixed-step RK4 integration,
and an autopilot layer (heading/altitude/speed hold, proportional-navigation
pursuit). Ownship and every "air" contact are engine bodies flying its
`Mode.HEADING` autopilot - real banked turns and altitude/speed hold, not a
fixed heading drift. Ground/sea contacts stay simple position data (they
don't fly, and the engine's own ground-contact handling would just fight a
stationary vehicle); each missile is a `Mode.PURSUE` body in its own small
dedicated engine world, chasing a "phantom" stand-in synced to the real
target's live position/velocity every tick (PURSUE steers toward a Body by
id in the *same* engine world, and radar contacts don't live in the engine).
`radar/js/engine/` is the engine itself - profile-driven and reusable for
anything else that should fly on real physics; `radar/js/sim/world.js` and
`missile.js` are where this game wires it in.

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
  lock, so you can't launch out of a plain search mode. They're genuinely
  different jobs, not the same search with a memory bolted on: SRC gets the
  wider half of the pattern list (a wide, low-revisit sweep, since it isn't
  trying to keep a track alive) and TWS gets the narrower half (`SRC_PATTERN_RANGE`
  / `TWS_PATTERN_RANGE` in `sim/config.js`) - and only a TWS mode auto-recentres
  on `ALT A`; a SRC mode is a manual wide search by design, so that shortcut
  is disabled there.
- **Mode gates what you can even see**: an air target answers SRC/TWS, plus
  the HDN ("head-on") pair while it's actually closing on ownship - HDN is
  a threat-detection mode, not a general-purpose air search, and it never
  answers for anything on the ground. A moving ground target only answers
  the GMTI modes; a real moving-target indicator works by rejecting
  zero-Doppler returns, so it's built to reject anything that isn't moving,
  which is why a *fixed* ground target instead needs a GMAP ("ground-map")
  mode. A surface contact only answers TWS SEA. The dossier (`/`, or the
  button) explains this per-target.

**Missiles** are auto-selected by target class - AIM-7 Sparrow (air),
AGM-84 Harpoon (surface), AGM-114L Hellfire (ground) - and are real engine
bodies (`engine/profiles.js`) flying `Mode.PURSUE`: thrust burns fuel for a
few tens of seconds, then the round coasts unpowered on stored energy and
lift, same as a real weapon, rather than vanishing the instant the motor
burns out. "Out of range" is a generous overall flight-time cap (a multiple
of the burn time) as a safety valve against a round that can genuinely
never catch its target - not the primary reachability gate. Sparrow is far
more agile than the other two (`maxG` in its profile); Harpoon barely
turns. Ammo is unlimited (`js/sim/weapons.js`'s `LOADOUT`).

A **projected-intercept cue** (`js/sim/intercept.js`) runs the same engine,
profile and guidance against the current selection - forecasting the
target at its current velocity - to answer "if I fired now, would this
connect, and when": a green diamond with a time-to-impact if so, a red
slashed circle marked OUT if the shot would run out of road first. It's a
forecast, not a real launch, and is recomputed a few times a second (it's
a full physics simulation, not a cheap analytic guess) rather than every
frame.

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
| `ALT` `A` | centre the antenna |
| `/` | target dossier |
| `SWAP KEYS` button | swap which of arrows/WASD drives the gimbal vs. the pipper |
| mode / scale / pattern buttons | click to change directly |

The pipper is a second reticle, moved with WASD (or, with `SWAP KEYS`,
the arrows), that lives on the B-scope using its own axes - azimuth and
range - and reaches anywhere in the gimbal envelope/current scale
regardless of where the antenna's scan box is - point it near a track and
that track becomes the selection, same role `TAB` plays, just spatial
instead of a list. It only grabs the selection while actually being moved,
so leaving it resting near an old contact never fights a later `TAB`
press. Locking parks manual gimbal/pipper input entirely: the radar itself
slaves the antenna straight onto the locked target every tick (see
`sim/radar.js`), so the display updates smoothly instead of only stepping
when the beam happens to sweep back over it - and if the target manoeuvres
past the gimbal's own mechanical limits (±90° az, ±60° el), the antenna
physically can't follow and the lock fails, the same as a real single-
target-track radar losing a contact that outran its gimbal.

Two things worth knowing if you're editing the sim:

- **A stationary target still has to sit within reach.** The ownship flies
  a fixed straight line north forever, so a fixed target's closest possible
  range is its crossrange offset, forever - `content/targets.js` keeps this
  in mind when placing ground/sea targets, and a target that falls far
  enough behind respawns ahead instead of being lost for the rest of the
  session (`sim/world.js`'s `respawnAhead`).
- **A weapon's effective range comes from its engine profile, not a flat
  number.** Tuning `engine/profiles.js` (thrust, fuel, `clMax`, `maxG`)
  changes what's actually reachable - see the intercept cue for whether a
  given shot is realistic before assuming a target's placement is wrong.

## The world view (`/radarworld/`)

A live **3D** plot of every contact's *true* position relative to ownship -
no radar set in between, and not a flat readout: real geometry you drag to
orbit and scroll to zoom, meant for watching the sim run and debugging it
rather than for gameplay. It imports `radar/js/sim/world.js` directly (the
same simulated world the radar page runs, not a reimplementation) and
renders it with [three.js](https://threejs.org/), loaded from a CDN via an
import map (`index.html`) - the only external script dependency anywhere
on this site; every other page is hand-rolled canvas 2D.

```
radarworld/
  index.html   the shell + HUD + the <script type="importmap"> for three.js
  style.css    same phosphor-green panel language as the radar page
  js/main.js   ticks the same world, builds/updates the three.js scene
```

Ownship sits fixed at the scene origin every frame - everything else is
plotted relative to it (`toScene()`), which is what lets `OrbitControls`'
target stay put while ownship actually flies on, with no per-frame
recentring. Altitude is exaggerated ×4 (`ALT_EXAGGERATION`) so vertical
separation actually reads next to 100+ km horizontal ranges; a thin
drop-line ties each contact to its ground projection the way an ATC 3D
view would. Contacts are billboarded sprites (constant screen size
regardless of zoom, like a real symbol set) with a canvas-textured name/
range/altitude label; nearer contacts draw their label on top of farther
ones when they cluster together, since both ignore the depth buffer.

It's a separate, independent world instance - opening it doesn't share
live state with an already-open radar tab (there's no backend to share it
over), just the same deterministic starting conditions. `VIEW DISTANCE`
re-points the camera at a preset distance along whatever direction you're
already looking (a zoom shortcut, not a view reset) or auto-fits to
whatever's currently furthest out.

### Plane or tank?

Both front pages share one preference (`localStorage['garrison.pilot']`).
`/radar/` asks once, on a machine that has never chosen, with the overlay
you see on first load; picking TANK sends you to `/`, picking PLANE starts
the sim and is remembered. `/` has **no such prompt** - dialogue-on-load was
removed from the tank page earlier - but a returning "plane" preference
silently sends the bare `/` straight to `/radar/`, and each page carries a
plain link to the other (the tank's pause menu; the radar's header) so the
switch is always available without a gate in front of it.
