# Deploying to igry.mooo.com

Upload, next to each other at the web root:

```
index.html        the tank page
classic.html      plain card list
garrison/         the whole directory, folders intact (26 files)
bg.jpg            only used by classic.html; already there
```

## Do not put anything in /js/ or /style.css

The root `/js/` directory belongs to **Aetherfall**: `/wizardgame/` loads
`/js/main.js` by absolute path, which in turn imports `/js/render.js`,
`/js/net.js`, `/js/ui.js`, `/js/input.js` and `/shared/*.js`. Its page also
loads `/style.css` from the root.

Anything this project ships lives under `garrison/` so the two cannot collide.
An earlier layout used a top-level `js/` folder; uploading that would have
overwritten Aetherfall's client and broken the wizard game.

## Checking a deploy

```
curl -sI http://igry.mooo.com/garrison/main.js          # 200
curl -sI http://igry.mooo.com/garrison/render/renderer.js  # 200
curl -s  http://igry.mooo.com/js/main.js | head -3      # still Aetherfall's client
```

In the browser console the page announces itself:

```
[garrison] 2026.09.16-4 loaded from http://igry.mooo.com/garrison/main.js?v=4
```

No banner means the wrong script answered, and the on-screen failsafe panel
will say which file is missing.
