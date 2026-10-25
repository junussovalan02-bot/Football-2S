# Game design

## Modes
- **1 НА 1** — one player per team vs AI Roma.
- **2 НА 2** — you control one Napoli player; control auto-switches to whoever reaches the ball first
  (`reachTime`), or press СМЕНА / `L`.
- **С ДРУГОМ** (online) — host picks *ВМЕСТЕ ПРОТИВ РОМЫ* (2v2, both on Napoli: 1P + 2P) or
  *ДРУГ ПРОТИВ ДРУГА* (1v1, guest plays Roma) and gets a 5-character code (no O/0/I/1/L) plus
  ПОДЕЛИТЬСЯ (share sheet / copy link `?join=CODE`). The friend taps ВОЙТИ ПО КОДУ (auto-joins at the
  5th character) or just opens the link. If the guest drops mid-match (screen lock, bad network),
  their player turns AI and "2P ВЫШЕЛ" shows; re-entering the same code brings them back into the same
  match ("2P ВЕРНУЛСЯ"). The guest's lobby keeps the last code filled in for that.
- **КАОС ВКЛ/ВЫКЛ** — random events, pickups and double goals at the end (see «КАОС» below).
- **ПОГОДА ВКЛ/ВЫКЛ** — when on, weather is random at kickoff and may change once at half time.
- Match: 2 minutes. After a goal the team that conceded kicks off.

## Controls
| Action | Touch | Keyboard |
|---|---|---|
| Run (8 directions) | floating joystick, left half of screen | arrows / WASD |
| Kick | УДАР (tap) | J / Space / Z |
| Strong or super shot | hold УДАР ≥ 0.5 s, release | hold J |
| Tackle (no ball) / pass (with ball) | ПОДКАТ/ПАС | K / X |
| Switch player | СМЕНА | L / C / Shift |
| Pause | II in the HUD | P / Esc |

In 1v1 "pass" becomes a lob over the opponent.

## No rules
No fouls. Sliding tackles knock anyone down (even teammates). Fire balls flatten whoever they hit.
Fallen players cry with stars around their head; lightning shows a skeleton for a second.

## FURIA meter (one per team, bars under the score)
Fills by:
| Event | + |
|---|---|
| dribbling | 4 / s |
| receiving a teammate's pass | 10 |
| stealing the ball | 12 |
| knocking an opponent down with a tackle | 18 |
| being knocked down | 12 |
| being struck by lightning | 15 |
| being taunted (Napoli only) | 6 |
| conceding a goal | 30 |

At 100 it blinks, plays a jingle and shows FURIA!. **One super shot empties it.**

## Shots
| Shot | Condition | Effect |
|---|---|---|
| normal | tap УДАР | aim assist toward goal mouth when facing the goal |
| TIRO FORTE | hold УДАР, FURIA not full | ×1.22 power |
| volley | ball in the air at head height (`aerial`: z 9–46, close), tap УДАР | hard low shot |
| **FUOCO** | FURIA + hold УДАР while running | flat fire ball, ignores wind, knocks players down |
| **VESUVIO** | FURIA + hold УДАР standing still, >190 units from the opponent's goal (Napoli only) | sky-high lob, eruption on landing knocks down everyone within 48 |
| **GOLFO** | FURIA + ball at head height, tap УДАР | overhead bicycle kick; ball travels as a wave swinging across the box, knocks defenders down |

Roma's fire ball is called LUPA. While charging, the name of the shot that will fire is shown under
the player; "ЖМИ!" appears when a GOLFO is available.

## AI (Roma is deliberately weaker)
Roma: 82 % speed, lazy turning, less lead when chasing, tackles rarely (range 17, cooldown 2.4 s),
wider shooting spread, steals at 0.6/s vs Napoli's 1.6/s. Uses supers only with full FURIA.
Napoli teammate AI uses the same rules but is sharper.

## Weather
- **Rain**: puddles (slippery: traction 0.16, ball drag ×5) and mud (speed ×0.58), light wind.
- **Storm**: more puddles, strong wind that changes every 7–11 s and pushes the ball in the air,
  lightning every 5–10 s stuns a random player.
- **Clear**: a couple of mud patches. **Off**: clean pitch, no wind.

## Taunts
Roma players pop up emotes (laugh, tongue, middle finger, angry, cry, zzz) when they knock you down,
steal, you miss, they score / concede, or randomly every 7–12 s.

## Tuning constants (top of "game state" in game.js)
`MAXSP 102, ACC 1050, KPOW 345, KLIFT 80, CHARGE 0.5, TSPD 205, TTIME 0.42, KTIME 0.22, FALLT 0.85,
STUNT 1.1, REACH 12, KREACH 20, GRAV 560, MATCH 120`. Pitch `LEN 720 × WID 200`, goal mouth
`Y0..Y1` = WID/2 ± 40, crossbar `GH 46`.


## КАОС (v0.10)

Toggle in the play menu (КАОС ВКЛ/ВЫКЛ, on by default; online the host's setting applies). Code: section
`// ==== CAOS` in `src/game.js` (`updChaos`, `chaosFx`, `startChaos`, `updVespa`, `quakeHit`, `pickUp`).

### События (one at a time)
First one 12–16 s after kickoff, then 12–18 s after the previous one ends; never the same twice in a row.
Name pops up under the HUD, a label with a countdown bar sits at the bottom centre.

| Событие | Длит. | Что происходит |
|---|---|---|
| МЯЧ-ГИГАНТ | 9 s | Ball drawn ×2.5; pickup reach ×1.9 (and up to z 22), kick reach +12, dribble offset 20. A free ball faster than 150 u/s below z 34 knocks players over (force 200, lift 140) and loses 20 % speed per hit. |
| ПИЦЦА-ЭКСПРЕСС | 7 s | A pizza boy on a Vespa crosses the pitch lengthwise at 290 u/s in a random lane, twice (second pass after ~3 s, other direction). Hits everyone in a 18 u radius (force 230, lift 280), smashes a free low ball (360 u/s), drops a PIZZA pickup at the halfway line. |
| ЛУНА | 10 s | Gravity ×0.32 for the ball and for flying players: long floaty shots, lots of volleys/GOLFO chances. Violet tint. |
| ЭСПРЕССО | 8 s | Everyone runs and accelerates ×1.5, tackles ×1.25, the music plays 1.4× faster, steam over the heads. |
| ВЕСУВИЙ | 6 s | Constant light shake, rocks fall. Every 0.9–1.4 s a shock near the ball: players within 70 u fall with 70 % chance (lift 170), a free ball on the ground pops up (vz 230). |
| ГОЛОЛЁД | 9 s | Traction capped at 0.13 (skating), ball rolling drag ×0.35. Pale tint and glints. |

### Предметы
Every 7–11 s one spawns (max 2 on the pitch) within ±150 u of the ball, away from players; lives 10 s,
blinks the last 2 s. Picked up by running over it (11 u, not while flying). AI detours to a pickup within
65 u (Roma 45 u) when the ball is more than 30 u away.

| Предмет | Эффект |
|---|---|
| ПИЦЦА | +35 FURIA to the team. |
| ПЕРЧИК | 6 s: speed and acceleration ×1.4, flames; running (>70 u/s) into an opponent knocks them over (force 200, lift 120), +8 FURIA. |
| КОРНЕТТО | 7 s: immune to tackles, super shots, the Vespa, quakes and lightning (golden ring, «динь»); your ball can't be stolen. |

### Полёты
`knockDown(p, dx, dy, force, expr, lift)` — with `lift` the player flies (`p.z`, `p.vz`), spins in 90° steps
with the bulging face and lands with dust and one small bounce; FALL lasts until they land. Lifts: Vespa 280,
erupt 200, quake 170, giant ball 140, FUOCO/GOLFO 120, chili 120. Plain tackles don't lift.

### ГОЛ = 2 ОЧКА
With КАОС on, goals in the last 20 s count double (announced at 0:20, banner «GOOOL! x2»).

### Online
Snapshot fields: `ch` [event, time left], `ve` [x, y, dir] of the Vespa, `it` pickups, and per player `z`
and buff. New sounds (`chaos`, `vespa`, `pickup`, `boing`, `ding`) and bursts (`pick`, `ding`, `dust`,
`quake`) relay through `sfx()`/`burst()`. Cosmetic particles run in `chaosFx` on both sides.
