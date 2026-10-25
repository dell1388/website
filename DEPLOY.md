# Deploying to igry.mooo.com

## Automatic (GitHub Actions)

Every push to `main` runs `.github/workflows/deploy.yml`, which rsyncs the
files below to the server over SSH, then curls the live site to check it.
It can also be run by hand: Actions tab -> Deploy -> Run workflow.

One-time setup, in the repo's Settings -> Secrets and variables -> Actions:

| secret | value |
|---|---|
| `SSH_HOST` | `igry.mooo.com` (or `150.136.7.214`) |
| `SSH_USER` | the login user on the server, e.g. `ubuntu` or `opc` |
| `SSH_KEY` | a private key whose public half is in that user's `~/.ssh/authorized_keys` |
| `DEPLOY_PATH` | the web root, e.g. `/var/www/html` |
| `SSH_KNOWN_HOSTS` | optional: output of `ssh-keyscan igry.mooo.com`, pins the server key |

Make a dedicated key rather than reusing your own:

```
ssh-keygen -t ed25519 -f deploy_key -N ""           # on your machine
ssh-copy-id -i deploy_key.pub USER@igry.mooo.com    # or append it by hand
```

Paste `deploy_key` (the private one) into `SSH_KEY`, then delete the local
copy. The user needs write access to `DEPLOY_PATH`. Until all four required
secrets exist, the workflow skips with a warning instead of failing.

The workflow only ever touches the files listed below; `--delete` is scoped
to `garrison/`, so other projects at the web root are left alone.

## Manual

Upload, next to each other at the web root:

```
index.html        the tank page
classic.html      plain card list
sitemap.xml       sitemap
garrison/         the whole directory, folders intact
bg.jpg            only used by classic.html; already there
```

## Do not put anything in /js/ or /style.css

The root `/js/` directory belongs to **Aetherfall**: `/wizardgame/` loads
`/js/main.js` by absolute path, which in turn imports `/js/render.js`,
`/js/net.js`, `/js/ui.js`, `/js/input.js` and `/shared/*.js`. Its page also
loads `/style.css` from the root.

Anything this project ships lives under `garrison/` so it can't collide with
it. An earlier layout used a top-level `js/` folder; uploading that would
have overwritten Aetherfall's client and broken the wizard game.

## Checking a deploy

```
curl -sI http://igry.mooo.com/garrison/main.js             # 200
curl -sI http://igry.mooo.com/garrison/render/renderer.js  # 200
curl -s  http://igry.mooo.com/js/main.js | head -3         # still Aetherfall's client
```

In the browser console the page announces itself:

```
[garrison] <version> loaded from http://igry.mooo.com/garrison/main.js?v=N
```

No banner means the wrong script answered, and the on-screen failsafe panel
will say which file is missing.
