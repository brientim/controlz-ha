# AGENTS.md

ControlZ-style Rooms and Tiles for Home Assistant (Lovelace custom cards + `custom:controlz-rooms` dashboard strategy). Plain `HTMLElement` + shadow DOM, bundled with esbuild into `dist/controlz-ha.js`. No Lit and no Home Assistant frontend imports.

- `npm test`: unit tests for `src/model.js` (pure: area resolution, entity → tile kind, room badges, security view). Keep logic there, not in elements.
- `npm run build` then `npm run serve`, then open `http://127.0.0.1:8765/dev/harness.html` to check visually against the mock `hass` (`dev/fixture.js`). Use headless Chrome for full-width screenshots (`dev/screenshots/`).
- Deploy to the lab install: `python3 scripts/deploy.py` (see README for env vars). Never commit tokens, LAN addresses or screenshots of a live Home Assistant — this repo is public.
- HACS packaging: `hacs.json` + GitHub release asset `controlz-ha.js`. Release with `./scripts/release.sh` after bumping `package.json` (`npm version patch --no-git-tag-version`). `.github/workflows/validate.yml` runs `hacs/action` (category `plugin`) plus tests and build.
- Design source of truth is ControlZ: `~/Developer/ControlZ/Targets/ControlZ/HTML/_preview_*_tiles.html` (tile size contract) and `~/Developer/ControlZ/docs/guides/ROOM_TILE_AND_SIDEBAR_BADGES.md` (badge rules). Keep them aligned when either side changes.
- Tile heights are fixed per size (Large 200 / Thin 100 / Compact 150). Never let a tile grow; move controls into the room sheet instead. Verify with `dev/harness.html?fit=1` (headless Chrome `--dump-dom`) — it must report zero problems.
- Every slider goes through `rangeRow()` in `src/controls.js`. Brightness (lightbulb icon, amber/white fill) and covering position (blinds icon, blue fill) must never look alike — they sit together on mixed room tiles.
- `src/room-icons.js` ports ControlZ `Targets/ControlZ/DeviceModels/RoomIconRegistry.swift` (SF entries, same order and suggestions). Keep it aligned when the Swift registry changes; import only named `@mdi/js` exports so esbuild tree-shakes the rest.
- Elements diff a JSON view model before re-rendering (`CzElement.requestRender`); Home Assistant pushes `hass` on every state change, so never re-render unconditionally.
