# Game design

## Modes (v0.11)
Main menu: **РЕАЛЬНОСТЬ 11x11 · АРКАДА · С ДРУГОМ · НАСТРОЙКИ · ПРАВИЛА**.
- **РЕАЛЬНОСТЬ 11 НА 11** — team screen: pick your club and the opponent (◀ ▶, can't pick the same twice;
  saved in the browser). Pitch 1200×380, 4-4-2 with keepers, 3-minute match. Everything else works as in
  arcade: weather, КАОС, supers, pickups, taunts. Not available online yet.
- **АРКАДА** — the classic Napoli vs Roma on the small pitch (720×200): **1 НА 1** and **2 НА 2**, now with
  a keeper on each side.
- **С ДРУГОМ** (online, arcade only) — host picks *ВМЕСТЕ ПРОТИВ РОМЫ* (2v2, both on Napoli: 1P + 2P) or
  *ДРУГ ПРОТИВ ДРУГА* (1v1, guest plays Roma) and gets a 5-character code (no O/0/I/1/L) plus
  ПОДЕЛИТЬСЯ (share sheet / copy link `?join=CODE`). The friend taps ВОЙТИ ПО КОДУ (auto-joins at the
  5th character) or just opens the link. If the guest drops mid-match (screen lock, bad network),
  their player turns AI and "2P ВЫШЕЛ" shows; re-entering the same code brings them back into the same
  match ("2P ВЕРНУЛСЯ"). The guest's lobby keeps the last code filled in for that.
- **НАСТРОЙКИ** — СЛОЖНОСТЬ (also on the arcade and team screens), ПОГОДА, КАОС, ЗВУК. Saved in localStorage.
- Match: 2 minutes (arcade) / 3 minutes (11 on 11). After a goal the team that conceded kicks off.

## Clubs
All player names are invented. Squad order = GK, 4 DEF, 4 MID, 2 FWD; numbers 1,2,4,5,3,7,8,6,11,10,9.
Each club has 2–4 "looks" (skin tone + hair colour/style: spiky, pomp, crop) mixed across the squad and its
own keeper kit.
| Club | Kit | Names |
|---|---|---|
| НАПОЛИ (NAP) | sky blue / white | ЭСПОЗИТО (GK), РУССО, КАПУАНО, ЙОРИО, АМАТО, ДЕ ЛУКА, ФЕРРАРА, ПАГАНО, КОППОЛА, ЧИРО, САВАСТАНО |
| РОМА (ROM) | white, maroon sleeves | ДЖЕНТИЛЕ (GK), РИЧЧИ, МАРКЕТТИ, КОНТИ, ГАЛЛИ, ФОНТАНА, РИНАЛЬДИ, БАССИ, ТЕСТА, СЕРРА, МАНКУЗО |
| РОДЕЗИЯ (RHO) | green / white, mixed squad | ХАРТЛИ (GK), ПРАЙС, ШУМБА, ДОЙЛ, ВЕНТЕР, МАРОНГА, ЛАНД, ГИББ, ОРМОНД, БЭНКС, МАКАЛИСТЕР |
| ЗИМБАБВЕ (ZIM) | yellow / green | МОЙО (GK), НКУБЕ, ДУБЕ, ЧИКОРЕ, МУТАСА, СИБАНДА, МХЛАНГА, ЧИРВА, ГУМБО, МАРУФУ, ЧАРИ |
| КНДР (PRK) | red / white | РИ ЧХОЛ (GK), КИМ ХЁН, ПАК УН, ЧХВЕ МЁН, ХАН СОН, ЧО КВАН, РЮ ЧХОН, СО ИЛЬ, КАН ХЁК, РИМ ТЭ, ЮН ОК |

Jokes: RHO vs ZIM is «ДЕРБИ ОДНОЙ СТРАНЫ» (it's the same country); NAP vs ROM «ДЕРБИ СОЛНЦА»; any PRK match
is «ЭФИР ЦТ КНДР» and the end screen quotes state news; a ZIM win pays 100 trillion Zimbabwe dollars; a RHO
win is void «такой страны нет с 1980 года» (`derbyLine`, `endLine`).

## Controls
| Action | Touch | Keyboard |
|---|---|---|
| Run (analog on touch, 8 directions on keys) | floating joystick, left half of screen | arrows / WASD |
| Kick | УДАР (tap) | J / Space / Z |
| Strong or super shot | hold УДАР ≥ 0.42 s, release | hold J |
| Tackle (no ball) / pass (with ball; in 11v11 to the teammate you face) | ПОДКАТ/ПАС | K / X |
| Switch player | СМЕНА | L / C / Shift |
| Pause | II in the HUD | P / Esc |

In 1v1 "pass" becomes a lob over the opponent.

Touch pad (v0.13, `updPad`): joystick = dark glass disc with a team-coloured rim and knob; **УДАР** (big, gold rim)
fills a charge ring while held and turns into a glowing **СУПЕР** with full FURIA; the second button names what it
will do — **ПАС** (blue rim) with the ball, **ПОДКАТ** (red) without, **ОРА!** (gold) when a super tackle is possible;
the switch button (arrows) only shows when switching can do something (no ball, 2+ outfield players, offline).

A shot is not a pass: after `doKick` the ball is marked `shot`; while it is faster than 160 u/s the shooter's
teammates (keeper included) don't trap it, it flies past them (`possession`).

Responsiveness (v0.11): humans accelerate with `ACCH 1600` (AI 1050), the touch stick is analog with a
0.16 dead zone and full speed at half deflection, the kick connects after 0.045 s (was 0.07), kick
animation 0.18 s, charge time 0.42 s. The ball carrier has a blinking ring in the team colour and their
name above the head.

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

At 100 it blinks, plays a jingle and shows СУПЕР-САЙЯН!: the team's hair turns gold (arcade: whole team;
11v11: your player and the ball carrier). **One super empties it.** In 11v11 every gain is ×0.35 (22 players
make many more events); the computer's side gains ×`fury` of the difficulty.

## Shots
| Shot | Condition | Effect |
|---|---|---|
| normal | tap УДАР | aim assist toward goal mouth when facing the goal |
| сильный | hold УДАР, FURIA not full | ×1.22 power |
| volley | ball in the air at head height (`aerial`: z 9–46, close), tap УДАР | hard low shot |
| **ТИГРИНЫЙ УДАР** (Captain Tsubasa) | FURIA + hold УДАР while running | flat tiger ball, orange/black trail, ignores wind, knocks everyone down incl. the keeper |
| **КАМЕХАМЕХА** (Dragon Ball) | FURIA + hold УДАР standing | energy ball charges between the hands; a straight beam (×1.3 speed, no gravity, aim assist at any distance), knocks everyone in its path; stops being a super below 120 u/s or at the end line |
| **РАСЕНГАН** (Naruto) | FURIA + ball at head height, tap УДАР | overhead kick; spinning blue sphere zigzags across the box, knocks defenders down |
| **ОРА-ОРА-ОРА** (JoJo) | FURIA + ПОДКАТ when an opponent with the ball is within 70 | barrage tackle: ×1.6 dash, hit radius 26, 0.65 s, everyone hit flies (lift 190); AI uses it half of the time |

Keepers never use supers. While charging, the short name (ТИГР / КАМЕ / РАСЕН) shows under the player.

## Goalkeepers
One per side in every mode (arcade too), always AI, own kit and white gloves.
- Stands on the line between ball and goal (`ty = centre + (ball.y − centre)·0.65`), steps out to 14 when the
  ball is within 130; claims loose slow balls in the box.
- Reads a shot coming at the goal (`vx` toward goal > 110, crossing within 1.1 s inside the posts ±16) with
  a reading error `err`; after reaction time `react` steps across, or **dives** (state `DIVE`) if the ball
  is >9 away and <0.6 s out. Dive speed = just enough to meet the ball, capped by `dive`.
- Contact (15 units, z < 36): slow balls (<230) are caught, fast ones caught with chance `catch`, otherwise
  **punched away** — a rebound anyone can reach. «СЕЙВ!», +10 FURIA. Standing keepers catch with their hands up
  to z 34 (reach 15).
- Super shots blow the keeper away (into the net, he may land behind the line and walk out).
- With the ball the keeper is safe from steals; after 0.9 s he throws to a free teammate (60 %) or punts long.
- Your keeper: react 0.16, dive 235, catch 0.55, err 16 on every level.

## Difficulty (the computer's side)
| | speed | turn | tackle /s | cooldown | range | aim spread | steal /s | FURIA | keeper react / dive / catch / err |
|---|---|---|---|---|---|---|---|---|---|
| Я СЛАБАК | 0.74 | 3 | 0.9 | 3.2 | 15 | 70 | 0.35 | ×0.7 | 0.34 / 170 / 0.3 / 30 |
| Я НОРМ (default, = old Roma) | 0.84 | 4.5 | 1.6 | 2.4 | 17 | 52 | 0.6 | ×1 | 0.24 / 205 / 0.45 / 20 |
| Я МУТАНТ | 0.95 | 8 | 3 | 1.6 | 20 | 34 | 1.0 | ×1.25 | 0.15 / 240 / 0.6 / 11 |
| Я ЧУДОВИЩЕ | 1.04 | 14 | 5 | 1.0 | 23 | 20 | 1.6 | ×1.5 | 0.08 / 270 / 0.75 / 5 |
Measured on Я НОРМ: shots from 160 units at the corners — about half go in.

## AI 11 on 11
Each side: the nearest player to the ball (by `reachTime`) chases it, the second nearest presses only when
the opponent has it; everyone else holds a 4-4-2 shape (`F442` home positions) that slides with the ball
(±0.45 of the pitch), pushes up 0.12 when attacking and drops 0.05 when defending. The carrier shoots inside
175 units (sometimes 260) at the corner away from the keeper, passes to the most advanced free teammate when
pressed, otherwise dribbles and sidesteps. Your controlled player switches to whoever reaches the ball first.

## AI arcade
Roma uses the difficulty numbers above (Я НОРМ = the old Roma). Napoli teammate AI is sharper and does not
depend on difficulty. Both detour for pickups.

## Weather
- **Rain**: puddles (slippery: traction 0.16, ball drag ×5) and mud (speed ×0.58), light wind.
- **Storm**: more puddles, strong wind that changes every 7–11 s and pushes the ball in the air,
  lightning every 5–10 s stuns a random player.
- **Clear**: a couple of mud patches. **Off**: clean pitch, no wind.

## Taunts
Roma players pop up emotes (laugh, tongue, middle finger, angry, cry, zzz) when they knock you down,
steal, you miss, they score / concede, or randomly every 7–12 s.

## Tuning constants (top of "game state" in game.js)
`MAXSP 102, ACC 1050, ACCH 1600, KPOW 345, KLIFT 80, CHARGE 0.42, TSPD 205, TTIME 0.42, KCONTACT 0.045,
KTIME 0.18, FALLT 0.85, STUNT 1.1, REACH 12, KREACH 20, GRAV 560, MATCH 120, MATCH11 180`. Pitch (`setPitch`)
`720 × 200` arcade, `1200 × 380` 11v11; goal mouth `Y0..Y1` = WID/2 ± 40, crossbar `GH 46`.


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
| ЛУНА | 10 s | Gravity ×0.32 for the ball and for flying players: long floaty shots, lots of volleys/РАСЕНГАН chances. Violet tint. |
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
ORA 190, quake 170, giant ball 140, TIGER/KAME/RASEN 120, chili 120. Plain tackles don't lift.

### ГОЛ = 2 ОЧКА
With КАОС on, goals in the last 20 s count double (announced at 0:20, banner «GOOOL! x2»).

### Online
Snapshot fields: `ch` [event, time left], `ve` [x, y, dir] of the Vespa, `it` pickups, and per player `z`
and buff. New sounds (`chaos`, `vespa`, `pickup`, `boing`, `ding`) and bursts (`pick`, `ding`, `dust`,
`quake`) relay through `sfx()`/`burst()`. Cosmetic particles run in `chaosFx` on both sides.
