# Azzurri Arcade — notes for Claude Code

Retro arcade football in the spirit of Goal 3 / Kunio-kun (NES): 5 clubs (Napoli, Roma, Rhodesia, Zimbabwe, North Korea),
11-on-11 «РЕАЛЬНОСТЬ» and 1v1/2v2 «АРКАДА», keepers, anime-parody supers, chibi pixel players,
oblique side view, no rules (tackles, knock-downs), weather, super shots, taunt emotes.
The owner plays it on a **phone** (iPhone, landscape) and wants to play **online with a friend**.
Talk to the owner in **Russian**; code, comments and commit messages in English.

## Run

```
npx --yes serve -l 8080 .        # or: python3 -m http.server 8080
open http://localhost:8080/            # single player
open http://localhost:8080/?net=local  # in TWO tabs: test online (BroadcastChannel, no server)
open http://localhost:8080/?peer=127.0.0.1:9000  # PeerJS against a local PeerServer (docs/ONLINE.md)
open http://localhost:8080/?peer=off&relay=ws://127.0.0.1:8888  # relay only, local MQTT broker (docs/ONLINE.md)
python3 tools/build-single.py          # -> dist/azzurri-arcade.html (one self-contained file)
```

No build step, no npm dependencies (PeerJS is vendored). Plain ES2020 in classic `<script>` tags (not modules) so the same code
can be inlined into one HTML file for a Claude artifact.

## Files

| Path | What |
|---|---|
| `index.html` | Page shell: canvas, menus (overlays `ov*`: main with pages mMain/mPlay/mOpts, ovTeams, …), touch pad. Loads `src/net/*.js` then `src/game.js`. |
| `src/style.css` | Menus, CRT screen effect, touch controls, portrait/landscape layout. |
| `src/data.js` | Plain data: `clubs` (kits, flags, looks, names, emojis, home pitch, mascot), `icons` (12×12 emoji char maps), `themes` (pitches). Loaded before game.js. |
| `src/story.js` | Career story texts: cast, chapters/beats, random events, press conferences, headlines, board demands, ceremony. |
| `src/game.js` | Everything else, one IIFE, sections marked `// ====`. See code map below. |
| `src/net/index.js` | Picks the online transport → `window.AzzNet.connect()` returns `{room, user}`. |
| `src/net/local.js` | Dev transport over BroadcastChannel (two tabs). |
| `src/net/peer.js` | Real online: `room.host(code)` / `room.join(code)` / `leave()`; direct PeerJS/WebRTC, falls back to the relay. |
| `src/net/relay.js` | Relay link through a public MQTT broker over WSS (tiny MQTT client), used when WebRTC can't connect. |
| `src/vendor/peerjs.min.js` | PeerJS 1.5.4, vendored (MIT). Don't edit. |
| `.github/workflows/pages.yml` | Deploys `index.html` + `src/` to GitHub Pages on every push. |
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
- **Clubs** — `CLUBS` from data.js (kit, keeper kit `gk`, `looks`, 11 `names`, `emo`, `home`, `flag`), faces `featFor`,
  flags `drawFlagIcon`, `TEAMS` = the two
  clubs of the current match (`setTeams`), `CLUB_KEYS`, team screen `pick`/`renderTeams`/`cycleTeam`.
- **Sprites** — `getSprite(team|club, pose, expr, frame, view, {look, gk, ssj, num})`, 40×40 cells, cached by
  club code. Poses: idle, run(0–2), kick, charge, cheer, tackle, fall, dive, shock (skeleton). Expressions:
  normal, grit, shout, bulge, cry. `lookOf(p)` builds the options for a player (gold hair = `SSJ`).
- **Emotes** — Roma players show pixel icons in speech bubbles (`emote()`, `updEmotes()`).
- **Audio** — WebAudio square/noise SFX (`sfx`) and a chiptune loop. `sfx()` also relays to the online guest.
- **Game state** — `players[]` (`buildTeams(MODE)`: 1/2 arcade with keepers last, 11 = `F442`), `ball`, `game`,
  `MODE`, `setPitch`. Player state machine `ST`: IDLE, RUN, KICK, TACKLE, FALL, STUN, DIVE.
  `updPlayer`, `updBall`, `possession`, `separate`, `doKick`, `doPass` (`facingMate`), `knockDown`, `electrocute`,
  keepers `keeperSave`, `dive`. Difficulty `DIFFS`/`diff`/`D()`, `cpuSide`, `keeperSkill`.
- **FURIA / supers** — `fury(team, n)`, `furyReady`, `superFor` (tiger / kame / rasen), ORA in the TACKLE
  branch, `superFx`, `drawBeam`. See docs/DESIGN.md.
- **CAOS** — random events `game.chaos` (`startChaos`, `updChaos`), Vespa `game.vespa`, pickups `items`
  (`spawnItem`, `pickUp`, buffs `p.buff`), flying players (`p.z`, `lift` in `knockDown`), cosmetic `chaosFx`.
  Toggle `chaosOn`. Rules and numbers: docs/DESIGN.md «КАОС».
- **AI** — `ai(p, dt)` writes into `p.inp` exactly like a human: `aiKeeper`, `aiReal` (11v11, `computeChasers`,
  formation), `aiArcade`; shared `steer`, `shootAt`, `bestPassTarget`, `skillOf`.
- **Input** — keyboard + floating touch joystick (`zoneL`) + hold buttons; `humanInput`, auto player switch `updControl`.
- **Pitch themes** — `TH`/`setTheme`, physics multipliers `ph()`, scenery `drawBack`/`drawFore`, ad boards `ADS`,
  critters `CRIT`/`CRITSPR`/`spawnCritter`/`updCritter`. Posts/crossbar and `ball.curve` in `updBall`.
- **Career** — `career` (localStorage), `makeClub`, `registerCareer` (custom club = `CLUBS.my`), `newTour`, `placeMe`
  (your player, `p.me`, `meLocked`), `careerResult`, screens `openCareer`/`openCreate`/`openTour`/`fly`/`flyGo`.
- **Career story** — `ensureStory` (`career.story`), scene player `playScene`/`sceneNext`/`sceneTap` (overlay `ovStory`,
  portraits `drawFace`/`castClub`), `preMatch` (beat or event + board demand), `postMatch` (verdict, press conference,
  firing), `ceremony`, `newGoal`/`goalMet`, modifiers via `startMatch(…, {mod})` (`game.curse`, `game.modTxt`).
- **Mascots & half-time** — `game.mode = 'show'`, `game.show`, `startShow('intro'|'half')`, `updShow`, `drawMascot`,
  `drawHalfBoard`, `halfWeather`; ends swap via `game.flip` → `dirOf`/`goalX`/`ownX`/`mirX`.
- **Skills & silliness** — `SKILLS`, `useSkill`, runners `game.runners`/`updRunners`/`drawRunner`, `freeze`, `scare`, `boo`,
  `pee`/`pees`, gags `updGags`, words `say` (TXTS). Pad button `bK`.
- **Rules screen** — `HELP` scene painters + `helpLoop`.
- **Field / weather** — `buildField` bakes pitch, stands, ad boards and goal nets into canvases;
  `setWeather` (clear/rain/storm/off), puddles & mud `patches`, wind, lightning.
- **Online** — `NET`, host/guest, `hostGame`/`joinByCode`/`joinGame`, `buildSnap`/`applySnap`, `guestUpdate`,
  lobby `renderLobby`, share link `shareGame`, `?join=` in `tryAutoJoin`. See docs/ONLINE.md.
- **Match flow / menus** — `kickoff`/`kickoff11`, `scored`, `startMatch(1|2|11)`, `derbyLine`, `endLine`, `toMenu`,
  `menuPage`, `setPaused`, `endMatch`, `showOv`; settings `store`/`syncOpts`/`nextDiff`. The title screen
  runs a live background (Vespa rides through).
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

1. ~~Online with a friend by code~~ — done in v0.9 (PeerJS, `docs/ONLINE.md`). Needs a real two-phone
   test on Wi-Fi + 4G; add our own TURN if some networks can't connect.
2. ~~Static hosting~~ — GitHub Pages workflow; https://junussovalan02-bot.github.io/Football-2S/
3. ~~Goalkeepers, more clubs, difficulty, 11 on 11~~ — v0.11.
4. ~~Career, 16 countries, themed pitches, rules cards~~ — v0.15.
5. ~~Mascots, half-time with switching ends, story career (parody)~~ — v0.17.
6. Ideas not done yet: 11v11 online, career difficulty curve, replay of goals, PWA install (manifest + icon), tornado /
   goats / bomb ball events, crowd sounds, aftertouch, headers.
