# Azzurri Arcade — notes for Claude Code

Retro arcade football in the spirit of Goal 3 / Kunio-kun (NES): Napoli vs Roma, chibi pixel players,
oblique side view, no rules (tackles, knock-downs), weather, super shots, taunt emotes.
The owner plays it on a **phone** (iPhone, landscape) and wants to play **online with a friend**.
Talk to the owner in **Russian**; code, comments and commit messages in English.

## Run

```
npx --yes serve -l 8080 .        # or: python3 -m http.server 8080
open http://localhost:8080/            # single player
open http://localhost:8080/?net=local  # in TWO tabs: test online (BroadcastChannel, no server)
python3 tools/build-single.py          # -> dist/azzurri-arcade.html (one self-contained file)
```

No build step, no dependencies. Plain ES2020 in classic `<script>` tags (not modules) so the same code
can be inlined into one HTML file for a Claude artifact.

## Files

| Path | What |
|---|---|
| `index.html` | Page shell: canvas, menus (overlays `ov*`), touch pad. Loads `src/net/*.js` then `src/game.js`. |
| `src/style.css` | Menus, CRT screen effect, touch controls, portrait/landscape layout. |
| `src/game.js` | Everything else, one IIFE, sections marked `// ====`. See code map below. |
| `src/net/index.js` | Picks the online transport → `window.AzzNet.connect()` returns `{room, user}`. |
| `src/net/local.js` | Dev transport over BroadcastChannel (two tabs). |
| `tools/build-single.py` | Inlines CSS/JS into `dist/azzurri-arcade.html`. |
| `docs/GDD.md` | Game design document: vision, pillars, references (with images), art direction, modes, roadmap. |
| `docs/DESIGN.md` | Game rules, controls, FURIA meter, super shots, AI, tuning constants. |
| `docs/research/` | Goal 3 / NWC / Goal! Two analysis, competitors, audit of our game with the prioritized backlog. |
| `docs/img/` | `ours/` screenshots + sprite sheet + palette, `refs/` owner's references. |
| `tools/playtest.py` | Headless phone-size playtest → `playtest/*.png`, fails on JS errors. |
| `.claude/agents/` | Subagents: `game-designer`, `pixel-art-director`, `playtester`. |
| `docs/ONLINE.md` | Online protocol and the plan for code/password sessions. |
| `godot/*.gd` | Early Godot 4 prototype scripts (player state machine, ball). Reference only. |
| `assets/source/` | Owner's isometric tileset (unused: wrong perspective) and the Goal 3 reference screenshot. |

All graphics are drawn by code (sprites built pixel by pixel in `getSprite`, field pre-rendered in
`buildField`). There are no image files at runtime. Font: Press Start 2P from Google Fonts.

## Code map of `src/game.js`

- **World & projection** — field units: `x` 0..LEN along the pitch, `y` 0..WID depth (0 = far touchline),
  `z` height. `P(x,y,z)` → field-canvas pixels, `S()` → screen pixels (minus camera). Logical screen is
  `W×180` (W adapts 240–400 to the phone's aspect), scaled up with `image-rendering: pixelated`.
- **Sprites** — `getSprite(team, pose, expr, frame, view)`, 40×40 cells, cached. Poses: idle, run(0–2),
  kick, charge, cheer, tackle, fall, shock (skeleton). Expressions: normal, grit, shout, bulge, cry.
- **Emotes** — Roma players show pixel icons in speech bubbles (`emote()`, `updEmotes()`).
- **Audio** — WebAudio square/noise SFX (`sfx`) and a chiptune loop. `sfx()` also relays to the online guest.
- **Game state** — `players[]`, `ball`, `game`. Player state machine `ST`: IDLE, RUN, KICK, TACKLE, FALL, STUN.
  `updPlayer`, `updBall`, `possession`, `separate`, `doKick`, `doPass`, `knockDown`, `electrocute`.
- **FURIA** — `fury(team, n)`, `furyReady`, `superFor`, `aerial`. See docs/DESIGN.md.
- **AI** — `ai(p, dt)` writes into `p.inp` exactly like a human (`rival` = Roma, deliberately weaker).
- **Input** — keyboard + floating touch joystick (`zoneL`) + hold buttons; `humanInput`, auto player switch `updControl`.
- **Field / weather** — `buildField` bakes pitch, stands, ad boards and goal nets into canvases;
  `setWeather` (clear/rain/storm/off), puddles & mud `patches`, wind, lightning.
- **Online** — `NET`, host/guest, `buildSnap`/`applySnap`, `guestUpdate`, lobby `renderLobby`. See docs/ONLINE.md.
- **Match flow / menus** — `kickoff`, `scored`, `startMatch(mode)`, `toMenu`, `setPaused`, `endMatch`, `showOv`.
- **Render** — `render()`, depth-sorted by `y`; HUD drawn on canvas (`drawHUD`) incl. FURIA bars.
- **Layout** — `fit()` resizes canvas for portrait/landscape; the joystick zone follows the canvas.

## Conventions

- Keep the NES look: integer pixel positions (`Math.round`), hard edges, black outlines, limited palette.
  Draw on canvas with `fillRect`/`pline`/`ptext`; no smoothing.
- Fixed 60 Hz update (`STEP`), render every animation frame.
- Phone first: test at 844×390 (landscape) and 390×844 (portrait), touch only. No hover-only UI.
- Every new gameplay event that the guest must see: emit it through `sfx()` / `burst()` (they relay
  via `netEv`) or add a field to `buildSnap`/`applySnap`.
- UI copy is Russian, pixel-font friendly (short, uppercase in menus).

## Subagents (use them)

- **game-designer** — before any gameplay change: writes the spec (rules, numbers, touch controls,
  online sync, test plan) and keeps the docs in sync.
- **pixel-art-director** — any sprite / animation / HUD / effect work and screenshot review.
- **playtester** — after every change: runs `tools/playtest.py`, checks screenshots, tests online in two tabs.

Typical flow: game-designer spec → implement in the main session → pixel-art-director for visuals →
playtester → fix → commit.

## Open tasks (owner's wishes, in order)

See also the prioritized backlog in `docs/research/azzurri-audit.md` (goalkeepers are #1 there).

1. **Real online with a friend on two phones, joined by a code/password.** Inside Claude artifacts the
   live room only admits people from one organization, so two personal accounts can't meet there.
   Build a transport outside Claude — plan and protocol in `docs/ONLINE.md` — and a lobby with
   "СОЗДАТЬ ИГРУ" (shows a 4–6 char code) / "ВОЙТИ ПО КОДУ" (enter code).
2. Deploy to a static host (GitHub Pages / Netlify / itch.io) so the friend just opens a link.
3. Ideas not done yet: goalkeepers, 3v3, more clubs, a GIF-ish replay of goals, PWA install (manifest + icon).
