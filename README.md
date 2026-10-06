# d2-live-site

The one-page site at <https://d2-live.pltanton.dev>: what [d2-live](https://github.com/pltanton/d2-live)
does, shown with recordings of the real tool.

```
fixture/order-fsm.d2     the diagram the walkthrough and the recording start from
build/story.mjs          the walkthrough: each step is d2-live's own edit ops + render
record/scenes.mjs        one scene per video: mouse, keys, outside edits
record/overlay.mjs       cursor, click ripple and key badges drawn into the recording
record/record.mjs        runs d2-live on a copy of the fixture, records each scene
record/Dockerfile        node, chromium and ffmpeg for the recorder
record.sh                builds d2-live for linux and records inside the container
site/                    the page: plain HTML, CSS and a little JS, no build
.github/workflows/       records and deploys to GitHub Pages
docs/dispatch.yml        workflow for d2-live that rebuilds this site on a tag
```

## Walkthrough

```sh
D2LIVE=$(which d2-live) node build/story.mjs   # writes site/story/
```

## Record

Docker and Go are the only requirements; nothing opens on your screen.

```sh
D2LIVE_SRC=../d2-live ./record.sh            # every scene
D2LIVE_SRC=../d2-live ./record.sh hero       # just the one the page uses
```

Videos land in `videos/` as `NAME.mp4` with a poster `NAME.jpg`.

## Preview

```sh
ln -sfn ../videos site/videos && python3 -m http.server -d site
```

## Deploy

Pushing to `main` records and deploys. CI records the latest `v*` tag of d2-live
(else `main`); `workflow_dispatch` takes another ref. Copy `docs/dispatch.yml`
into d2-live to rebuild the site on every release.
