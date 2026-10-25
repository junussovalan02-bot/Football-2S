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
