# Game design

## Modes (v0.11)
Main menu (v0.18.1): **КАРЬЕРА · АРКАДА · С ДРУГОМ · НАСТРОЙКИ · ПРАВИЛА · КОЛЛЕКЦИЯ**. АРКАДА holds 1 НА 1, 2 НА 2 and 11 НА 11.
- **11 НА 11** (in АРКАДА; calmer CAOS than 1v1/2v2) — team screen: pick your club and the opponent (◀ ▶, can't pick the same twice;
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
- Match: 2 minutes (arcade) / 3 minutes (11 on 11), two halves. After a goal the team that conceded kicks off.

## Mascots and half-time (v0.17, `// ==== mascots & half-time` in game.js)
- **Walk-out** before every match (`game.mode = 'show'`, `game.show = {kind:'intro'}`, 4.6 s): both clubs' mascots
  walk in from the sides, dance at the centre circle with confetti, shout their chant and walk off. They are living
  characters (`mascot: [name, type, chant]` in data.js, drawn by `MASC[type]` in game.js, 48×60, walk / dance / flex
  frames, blinking): ПИЦЦЕТТА (pizza slice with legs), ВОЛЧАРА (wolf in the kit), ПРИЗРАК, ТРИЛЛИОН (banknote in a top
  hat), ТОВ. РАКЕТА, БЕРКУТ, КОНЬ БАТЫР (a horse walking like a man, in a deel), БАГЕТТО (beret, moustache), СОСИСКИН
  (lederhosen), СЭР ЧАЙНИК (teapot with monocle), ТОРО (pumped bull), ПЕТУХ ГАЛУ, ГАУДА (cheese in clogs),
  ПИНГВИН-КАЧОК (abs, chain, biceps), КРАБ, СВЕЧКА (papal red shoes), РЫБА С НОГАМИ. A custom club gets one by its emoji,
  otherwise БАНАН. Muscle types flex instead of dancing, the ghost floats. A tap on the pitch or УДАР skips (solo only).
  The match title is shown after the walk-out.
- **Half-time** when the clock reaches half: whistle, mascots again (3.5 s), a board with ПЕРЕРЫВ, the score, a silly
  stat («ВЛАДЕНИЕ: 50% ПАНИКИ») and the new weather (the old mid-match weather change moved here). Then the teams
  **swap ends**: `game.flip = 1`, `dirOf(team)` / `goalX` / `ownX` / `mirX` flip, the other team kicks off, «2-Й ТАЙМ!».
  Everything that used to assume «team 0 attacks right» goes through `dirOf` (AI, keepers, skills, kickoffs, scoring).
- Online: `ho: [half, flip, showKind, showT, joke, weather]` in the snapshot; the guest draws the show itself.

## Clubs (v0.15, data in `src/data.js`)
17 countries/clubs, all names invented: МОНГОЛИЯ (uniform, like North Korea), НАПОЛИ, РОМА, РОДЕЗИЯ, ЗИМБАБВЕ, КНДР, КАЗАХСТАН, ФРАНЦИЯ, ГЕРМАНИЯ, АНГЛИЯ,
ИСПАНИЯ, ПОРТУГАЛИЯ, НИДЕРЛАНДЫ, АНТАРКТИДА, СИЛЕНД, ВАТИКАН, АТЛАНТИДА. Each has: kit (+ pattern: stripes, hoops, sash,
penguin front), keeper kit, flag (`dir`: v / h / cross / diag / kaz), 2–4 looks (skin, hair colour and style: spiky,
pomp, crop, long), 11 surnames (one joke name each), taunt emojis `emo`, home pitch `home`.
- **Faces** (`featFor`, deterministic per club + slot): beard, moustache, glasses, bald, headband, long hair; Antarctica
  and Sealand are extra bearded (white polar beards). **Sealand's №10 МАЛЫШ is a short bearded player** (`short`
  squeezes the body, same head). **North Korea is `uniform`**: one look, no features — discipline.
- **Emojis** (31 pixel icons, `ICONS`): pizza, volcano, wolf, ghost, money, rocket, horse, beshbarmak, eagle, baguette,
  croissant, beret, pretzel, sausage, tea, umbrella, bull, paella, sardine, rooster, tulip, cheese, clog, penguin,
  snowflake, anchor, crab, key, candle, trident, fish. The rival side taunts with its own emojis half of the time;
  after your goal your two nearest players show your country's emoji.
- Jokes: derby lines (RHO–ZIM «одной страны», NAP–ROM «солнца», ENG–GER, ESP–POR, FRA–GER) and end-screen lines
  per winner/loser (`derbyLine`, `endLine`).

## Team skills (v0.16)
Purple button (keyboard I). Each club has `skill` in data.js; recharge 24 s (both sides start at 12 s); the computer's
side uses its skill at random when ready (0.12/s). Online the guest's presses are relayed (`in.sk`).
| Club | Skill | Effect |
|---|---|---|
| MNG | ТАБУН | 5 horsemen gallop across from your side, trampling opponents (lift 220) |
| KAZ | БЕРКУТ | an eagle grabs the ball wherever it is and drops it at your most advanced player's feet |
| NAP | ВЕСУВИЙ | 6 lava bombs fall on opponents (radius 24, lift 160) |
| ROM | ГЛАДИАТОРЫ | your team can't be knocked down for 6 s |
| RHO | ПРИЗРАКИ | your team is a ghost for 5 s (can't be tackled or robbed); opponents near you get scared |
| ZIM | ИНФЛЯЦИЯ | the opponent's FURIA drops to 0, yours +40, banknotes rain |
| PRK | РАКЕТА | a rocket lands in their box: everyone within 75 flies, keeper included |
| FRA | ЗАБАСТОВКА | opponents stop with protest signs for 3 s (keeper 2 s) and drop the ball |
| GER | ОРДНУНГ | opponents are lined up in two neat rows in their own half, frozen 1.3 s |
| ENG | ФУТБОЛ ЕДЕТ ДОМОЙ | the ball rolls itself to their goal for 2.6 s unless someone takes it |
| ESP | КОРРИДА | a bull charges across at the ball's depth |
| POR | ФИНТЫ | your ball carrier can't be knocked down or robbed for 5 s, ×1.3 speed, rainbow sparks |
| NED | ВЕЛОСИПЕДЫ | your outfield players ride bikes for 6 s (×1.5 speed) |
| ANT | МЕТЕЛЬ | opponents freeze in ice blocks for 2.2 s |
| SEA | ПУШКА | a cannonball crosses the pitch through the opponent nearest the ball |
| VAT | ЧУДО | your next shot within 9 s can't be saved: the keeper just watches |
| ATL | ЦУНАМИ | a wave sweeps from your side to theirs, washing opponents and the ball toward their goal |
Your own career club chooses its skill on the creation screen.

## БУ!, puddles and gags (v0.16)
- While the skill recharges the button is **БУ!** (5 s cooldown): opponents within 55 get scared — they drop the ball,
  run away for 1.1 s with bulging eyes and 45 % of the time **wet themselves** («ОПИСАЛСЯ!»): a yellow puddle that stays
  12 s and is slippery (traction 0.18) for anyone. Big hits (lift ≥ 150) also have a 20 % chance, trampling 30 %.
- **Gags** (with КАОС on, every 9–15 s, a random outfield player, you only 25 % of the time): АПЧХИ! (loses the ball,
  0.6 s), ШНУРКИ! (trips), АЛЛО, МАМА? (stands with a phone 1.7 s), ГОЛУБЬ! (bird mess on the head, 0.9 s),
  ТАНЦУЕТ! (dances 1.5 s), ПАУК! (scared, may wet himself).
- Online: freeze/fear/puddle/ghost/bike state, puddles, skill runners and cooldowns are in the snapshot; words relay as
  `burst('txt')`.

## Pitches (themes, `THEMES` in data.js)
11 on 11 plays at the opponent's home pitch (or pick ПОЛЕ on the team screen); arcade and online stay in the stadium.
| Theme | Home of | Physics | Weather / extras | Critter |
|---|---|---|---|---|
| СТАДИОН | NAP, FRA, ESP | — | random | — |
| САВАННА | RHO, ZIM | bounce ×1.4, friction ×0.8 | sun, dust | elephant (slow, throws players) |
| БАМБУК | PRK | friction ×1.1 | falling leaves | panda (slow, you bump off) |
| СНЕГ | GER | friction ×2.2, bounce ×0.45, traction ×0.55, speed ×0.9 | snowfall, red lines | snowman (stands 12 s, melts) |
| ЛЁД | ANT | friction ×0.3, traction ×0.14 | penguins in the stands | penguin sliding on its belly |
| СТЕПЬ | KAZ | friction ×0.9 | constant wind 55 | Kazakh horseman (fast, throws players far) |
| ПЛЯЖ | POR | friction ×2.6, bounce ×0.35, speed ×0.85 | sea, palms | crab crossing the width |
| ДОЖДЬ | ENG | — | rain, brick stands | — |
| ТЮЛЬПАНЫ | NED | — | wind 35, windmills | cow |
| ПЛАТФОРМА | SEA | bounce ×1.6, friction ×0.7 | storm, rusty rails | seagull: flies off with the ball for 1.4 s |
| ПЬЯЦЦА | ROM, VAT | bounce ×1.5, friction ×0.75 | colonnade and dome | pigeons |
| ГОБИ | MNG | friction ×1.8, bounce ×0.6, speed ×0.92 | wind 70, dust, dunes and a caravan | camel |
| ДНО ОКЕАНА | ATL | gravity ×0.45, water drag 0.5/s, speed ×0.9 | blue tint, bubbles | shark fin |
Critters (`CRIT`, `spawnCritter`, `updCritter`) come every 8–22 s with a name pop-up; fast ones knock players flying,
big calm ones shove players aside; the ball bounces off them. Scenery behind the pitch (`drawBack`) and props along the
near touchline (`drawFore`) are per theme; the scenery strip is taller on the big pitch (`OY` 92).

## Physics additions (v0.15)
- **Posts and crossbar**: a ball crossing the goal line within 3.5 of a post (below the bar) or at bar height rebounds
  (×0.55) with a «ДЗЫНЬ!» and a ring.
- **Curve**: holding the stick sideways to the shot at the release bends it (`ball.curve` up to 170 u/s² across the
  flight, fading ×(1−1.4/s)); AI shots get a little random swerve. Supers don't curve except the tiger shot.

## Career (v0.15, `// ==== career` in game.js)
Main menu КАРЬЕРА. Saved in localStorage (`azz-career`).
- **СВОЯ КОМАНДА**: name (12 chars, code = first 3 letters), shirt and shorts colour (12 colours), emoji, home pitch;
  the squad gets random funny surnames and mixed looks.
- **СВОЙ ИГРОК**: name, skin, hair, face (beard, moustache, glasses, bald…), height (normal / short), position
  (НАП → slot 10, ПЗ → 6, ЗАЩ → 2), club to join. In matches you control only him (no switching; teammates pass to
  him); his goals are counted («ТВОЙ ГОЛ!»).
- **Мировое турне**: 8 away matches against random countries on their home pitches, 3 min, 11 on 11. Before each a
  2.4 s flight animation (your flag → theirs). Win 3 / draw 1. At the end: ≥19 pts ЧЕМПИОН, ≥13 ПРИЗЁР, ≥7 СЕРЕДНЯК,
  else ТУРИСТ; 8+ own goals in player mode = ЗОЛОТАЯ БУТСА. Then НОВЫЙ СЕЗОН with a new route.

### Story (v0.17, texts in `src/story.js`, engine `// ==== career story` in game.js)
A parody of sports-game career modes, exaggerated. Scenes are typed lines with a talking pixel portrait (the cast are
drawn with the player sprite in their own outfits: МАМА, АГЕНТ ЖОРА «мне всего 95%», ПРЕЗИДЕНТ КЛУБА, ТРЕНЕР ПАЛЫЧ,
ДОКТОР, ФАНАТ, ШАМАН; ЖУРНАЛИСТ / ГУСЬ / ВЕДУЩИЙ are icons) and 3 answers: СКРОМНЯГА (calm) / ДЕРЗКИЙ (fire) /
ПОЕХАВШИЙ (mad).
- **Chapters** = seasons: 1 «ПАРЕНЬ ИЗ ДВОРА» (agent signs you with a goose's paw, the rival appears, transfer
  rumour paid in pearls, training where the cone wins, the final), 2 «СЛАВА И ЛАПША» (reality show, the rival is your
  long-lost twin, the stadium sold for a parking lot, «ушиб эго»), 3+ «ЛЕГЕНДА (ВРОДЕ)». Beats before rounds 1, 2, 4,
  6, 8; before the other rounds a random event (70 %): tabloids, energy-drink sponsor, a fan's goat, 1-1-8 tactics,
  your video-game rating is lower than the goose's, mum asks if you ate, shaman, barber, naming rights.
- **Rival** (made-up name, ПАОЛО ПАФОСНИ etc.) — his club is always the last match of the season.
- **Board demand** for every match (ПОБЕДИТЬ, НЕ ПРОИГРАТЬ, ЗАБИТЬ 2, ПРОПУСТИТЬ ≤1, РАЗНИЦА 2, ЗАБИТЬ САМОМУ; the
  final = win) with a threat; met +12 trust, failed −18. Trust 0 → fired… and rehired at 30 % (nobody else wants it).
- **Press conference** after every match (button ПРЕСС-КОНФЕРЕНЦИЯ): a question by result, three answers, a headline
  goes to the news feed on the route screen. calm +3 trust +3 fans, fire +12 fans −6 trust, mad +8 fans.
- **Match modifiers** from choices (shown at kick-off): fury (start with full FURIA), skill (skill ready),
  tired (the rival starts with full FURIA), curse (their keeper plays like a beginner), promise (score or the fans laugh).
- **ЗОЛОТОЙ МЯЧ** ceremony after the season: gold (≥19 pts or 10 own goals), «ПОЧТИ» (≥13), else the rival wins;
  the season's title by your most frequent answer type.
- Route screen shows ФАНАТЫ, ДОВЕРИЕ, personality, the next modifier, the president's demand and the last headlines.
- State `career.story` = {fame, board, trait, news, seen, fired, mod, goal, pending, rival, big}; an old save gets it on
  the next visit.

## Rules screen
Cards with looping 80×48 mini-animations drawn with the game sprites (`HELP`, `helpLoop`): super-saiyan, tiger, beam,
spinning sphere, ORA, pass, curve/post, sprint, keeper, chaos, pickups, pitches.

## Camera and your player (v0.17.2, `updCamera`)
- The camera follows the ball but leans 35 % toward your player and never lets him leave the screen: the target is
  clamped so he stays 44 px from the sides, below the HUD, and a hard limit catches up if the spring lags.
- Your player: a pulsing ring under the feet (yellow, 2P cyan), a fat bouncing arrow with «ТЫ» (solo) / 1P / 2P.
- Off-screen arrows at the screen edge for your player and for the ball, kept clear of the joystick and the buttons.

## Controls
| Action | Touch | Keyboard |
|---|---|---|
| Run (analog on touch, 8 directions on keys) | floating joystick, left half of screen | arrows / WASD |
| Kick | УДАР (tap) | J / Space / Z |
| Strong or super shot | hold УДАР ≥ 0.42 s, release | hold J |
| Tackle (no ball) / pass (with ball; in 11v11 to the teammate you face) | ПОДКАТ/ПАС | K / X |
| Sprint | push the stick to the very edge (≥ 0.92) for 0.2 s | Shift / U |
| Taunt | ХА! | T |
| Block a super shot | tap УДАР fast while it flies at you (button reads БЛОК!) | J |
| Switch player | СМЕНА | L / C |
| Pause | II in the HUD | P / Esc |

In 1v1 "pass" becomes a lob over the opponent.

Touch pad (v0.13, `updPad`): joystick = dark glass disc with a team-coloured rim and knob; **УДАР** (big, gold rim)
fills a charge ring while held and turns into a glowing **СУПЕР** with full FURIA; the second button names what it
will do — **ПАС** (blue rim) with the ball, **ПОДКАТ** (red) without, **ОРА!** (gold) when a super tackle is possible;
the switch button (arrows) only shows when switching can do something (no ball, 2+ outfield players, offline).

A shot is not a pass: after `doKick` the ball is marked `shot`; for 1 s after the kick, and after that while it is
faster than 100 u/s, the shooter's teammates (keeper included) don't trap it, it flies past them (`possession`).

**Passing (v0.14).** Target (`facingMate`, 11v11): the teammate closest to where the stick points (or the player
faces) within ~70°, open players and clear lanes preferred; nobody there → the nearest teammate. Arcade: the only
mate. Physics (`passPlan`, measured from the ball): aim where the receiver will be on arrival; a ground pass gets
`v0 = √(90² + 2·125·d)` so it arrives at ~90 u/s; longer than 230 or with an opponent in the lane (`laneBlocked`,
15 units) it is lofted (`vz = g·T/2`) to drop at his feet. The receiver gets reach ×1.6 and can take it up to
z 16; AI receivers run to the spot, a human receiver steps to it when not steering; the spot is marked with a
blinking ring + arrow; control stays on the receiver while the ball travels. The computer teammate plays an
open human teammate in (rate 1.4/s, not when marked, behind or with the lane blocked); `bestPassTarget` favours
the human (+0.8) and avoids blocked lanes.

**Sprint (v0.14, v0.18: no button).** Push the stick to the edge for 0.2 s (touch) / Shift or U: speed ×1.35 (×1.22 with the ball, the ball runs further ahead and
is 1.5× easier to steal), acceleration ×1.2. Stamina lasts ~2.5 s (−0.4/s), refills at 0.25/s; run dry and you are
tired until 35 % (refill 0.18/s). A green bar under your player shows stamina (red when tired). Online: input `sp`,
snapshot carries stamina/tired/sprinting. Switch player is now L / C only.

Responsiveness (v0.11): humans accelerate with `ACCH 1600` (AI 1050), the touch stick is analog with a
0.16 dead zone and full speed at half deflection, the kick connects after 0.045 s (was 0.07), kick
animation 0.18 s, charge time 0.42 s. The ball carrier has a blinking ring in the team colour and their
name above the head.

**ДРАЗНИЛКИ (v0.18).** The pink ХА! button (where sprint was): your player shows a taunt (your country's emoji,
laugh or tongue) and sometimes says something cheeky (СЛАБО?, ДОГОНИ!…), cooldown 2 s. Rivals within 80 get angry:
their FURIA +4 each — taunting has a price. Online: input counter `tt`.

**Purple button (v0.18).** One meaning at a time: the country skill when charged; while it charges it is dim, and
БУ! lights up (red rim) only when a rival is within 55 and the scare is ready. No rival near — БУ! does nothing.

**БЛОК! (v0.18).** When a super shot is kicked, `game.block = {team, taps}` opens for the other side. Each tap of
УДАР adds 7.5 % (max 45 %) on top of 5 %; the keeper's reach grows with taps (14 → 26). If he gets it: the ball
bounces out, «БЛОК!», crowd roar, FURIA +25. The computer taps by difficulty (1.5 / 3 / 4.5 / 6 per s). Online:
the guest's kick releases count as taps; snapshot `bk`.

## Match start, stars, crowd (v0.18)
- **Countdown**: after the walk-out (and after half-time) 3..2..1 (2.4 s, beeps), then a random shout as a banner
  (ПОЕХАЛИ!, ЗА ГУСЯ!, Я ЗАБЫЛ ПРАВИЛА!…). `game.mode = 'count'`, synced as `ho[6]`.
- **Career flight = real loading**: the match is built behind the flight screen (`startMatch(…, {hold})`, mode
  `load`), then all players' sprites and both mascots are cached a few per frame; the plane's progress and the bar
  follow the real work, with silly tips (СТРИЖЁМ ГАЗОН…). Lands → `releaseMatch()`.
- **Stars** (solo only): ★ win + 2 random tasks of 8 (3 goals, concede ≤1, super goal, knock 3 down, use the skill,
  2 БУ!, goal in the last 20 s, taunt 3 times), shown on a board during the countdown and in the pause menu; result
  on the end screen. Totals unlock ball skins in КОЛЛЕКЦИЯ: АРБУЗ 3, ПИЦЦА 6, ГЛОБУС 10, КАПУСТА 15, ГЛАЗ 20,
  ЗОЛОТОЙ 30, ЯЙЦО ГУСЯ 45. Nothing is spent, no timers.
- **Crowd**: looped noise through a band filter, louder near the goals / on supers / during shows, roar on goals and
  blocks, «ооо» on posts and hard saves, a drum now and then (`updCrowd`).
- **First-time tips** in the match (once each, solo): sprint, FURIA, skill, БУ!, taunt, block.
- **Silliness pace** (`PACE`): arcade CAOS every 14–20 s (first 12–16), gags 12–18 s; 11 on 11 / career CAOS 24–34 s
  (first 20–26), gags 22–32 s. One thing at a time: gags and animals wait while CAOS runs, CAOS waits for an animal;
  gags never hit the human who has the ball.

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
- At half-time the weather may change (not on pitches with their own climate).

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
