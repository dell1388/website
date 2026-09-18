# Deploying to igry.mooo.com

Upload, next to each other at the web root:

```
index.html        the tank page
classic.html      plain card list
garrison/         the whole directory, folders intact
radar/            the whole directory, folders intact - the plane version
radarworld/       the whole directory, folders intact - 3D debug/world view
bg.jpg            only used by classic.html; already there
```

## Do not put anything in /js/ or /style.css

The root `/js/` directory belongs to **Aetherfall**: `/wizardgame/` loads
`/js/main.js` by absolute path, which in turn imports `/js/render.js`,
`/js/net.js`, `/js/ui.js`, `/js/input.js` and `/shared/*.js`. Its page also
loads `/style.css` from the root.

Anything this project ships lives under `garrison/`, `radar/` or
`radarworld/` so none of them can collide with it. An earlier layout used a
top-level `js/` folder; uploading that would have overwritten Aetherfall's
client and broken the wizard game. `radar/` has its own `style.css` and its
own `js/` tree (`radar/js/...`), entirely separate from both the root
`/js/` and `garrison/js/`; `radarworld/` is the same again, plus it loads
three.js from a CDN (via an import map in its `index.html`) rather than
anything local - the only page on this site with an external script
dependency, so a deploy failure there is more likely a blocked CDN than a
namespace collision.

## Checking a deploy

```
curl -sI http://igry.mooo.com/garrison/main.js             # 200
curl -sI http://igry.mooo.com/garrison/render/renderer.js  # 200
curl -sI http://igry.mooo.com/radar/js/main.js             # 200
curl -sI http://igry.mooo.com/radar/js/sim/radar.js        # 200
curl -sI http://igry.mooo.com/radarworld/js/main.js        # 200
curl -s  http://igry.mooo.com/js/main.js | head -3         # still Aetherfall's client
```

In the browser console each page announces itself:

```
[garrison] <version> loaded from http://igry.mooo.com/garrison/main.js?v=N
[radar] <version> loaded from http://igry.mooo.com/radar/js/main.js?v=N
[radarworld] <version> loaded from http://igry.mooo.com/radarworld/js/main.js?v=N
```

No banner means the wrong script answered, and the on-screen failsafe panel
will say which file is missing.
