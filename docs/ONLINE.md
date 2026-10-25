# Online play

## Why it didn't work inside Claude
The game was first published as a Claude artifact using its live `room` capability. That room only
admits members of the artifact owner's organization (and sometimes invited guests on plans that allow
it). Two personal accounts can't meet there, so the friend always saw "ОНЛАЙН НЕДОСТУПЕН".
A password in the lobby would not help: the friend isn't let into the room at all.

## How the game syncs (already implemented, transport-agnostic)
Host-authoritative. The host's phone runs the whole simulation; the guest sends input and draws
snapshots. Everything goes through ONE shared "presence" object per peer:

```
host  presence: { app:'azz', role:'host', code, mode:'coop'|'vs', open, gp:<guest peer id>, s:<snapshot> }
guest presence: { app:'azz', role:'guest', code, in:{ mx, my, k, kr, tc } }
idle  presence: { app:'azz', role:'idle' }
```
- `in.mx/my` stick (−1..1), `k` kick held, `kr` kick-release counter, `tc` tackle-press counter
  (counters, so a dropped message never loses a press).
- `s` = `buildSnap()` sent ~20 times/s: positions, states, ball, score, FURIA, weather patches,
  banners, plus a small ring of recent events `ev` (sounds, particle bursts) the guest replays once.
- The guest interpolates toward the snapshot (`guestUpdate`).
- Snapshot size is ~1.5–3 KB JSON. Fine for WebRTC data channels or WebSocket.

The game talks to a `room` object (see `src/net/index.js`):
```
room.presence(patch) -> Promise      // merge into my presence; null deletes a field
room.peers() -> Peer[]               // {peer, by, isMe, sameTab, presence}, me included
room.onPeers(fn, onError) -> unsubscribe
```
Any transport that provides this works. `src/net/local.js` is a 60-line example over BroadcastChannel.

## Relay fallback (v0.12)
Real phones often can't open a direct WebRTC link (Wi-Fi <-> 4G, carrier-grade NAT), and the free PeerJS
broker/TURN servers are not always up. So the transport now has a second link with the same messages:
a public **MQTT broker over secure WebSocket** (`src/net/relay.js`, a ~100-line MQTT 3.1.1 client, QoS 0).
Brokers tried in order: `broker.emqx.io:8084`, `broker.hivemq.com:8884`, `test.mosquitto.org:8081`.
- Host: listens on PeerJS **and** the relay; ready when either is up. Announces itself on the retained topic
  `azzurri-arcade/v1/CODE/info` every 15 s (cleared on leave). Guest messages arrive on `.../g`, host sends on
  `.../h` with `to` = guest id.
- Guest: tries direct for 5 s, then the relay (status line: «Напрямую не вышло, соединяемся через сервер…»).
  Not found = no fresh announcement (<2 min) within 3.5 s.
- Everything above (heartbeat, rejoin into the running match, host leaving) works the same on both links.
- Traffic through the relay: ~20 snapshots/s × 2–3 KB. Topics are public: anyone who knows the code could
  read the game state (only positions and score, nothing personal).
- Dev: `?relay=ws://127.0.0.1:8888` (local broker: `npm i aedes ws`, see the test notes), `?peer=off`
  forces relay only.

## Join by code (done, v0.9)
WebRTC peer-to-peer through **PeerJS** (`src/net/peer.js`, library vendored in `src/vendor/peerjs.min.js`,
so there is no CDN dependency and `build-single.py` inlines it too).

- Host: `room.host(CODE)` registers the PeerJS id `azzurri-arcade-CODE` on the free public broker
  (`0.peerjs.com`). Id already taken → new code (up to 4 tries). CODE = 5 chars from
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- Guest: `room.join(CODE)` opens an anonymous Peer and connects (`reliable`, JSON). Resolves when the host's
  presence arrives; rejects `notfound` (no such code), `timeout` (15 s), `network`.
- Wire: `{t:'p', patch, full}` — presence patches (null deletes); the full presence is sent on connect.
  `{t:'h'}` heartbeat every 1 s; silence for 6 s = the other phone is gone.
- One friend per host. A new connection replaces the old one, so a friend whose phone slept can re-enter
  the code; the host re-attaches them to the running match instead of restarting it.
- Host loses the broker (phone backgrounded): the data channel keeps working, the code is re-registered.
- NAT: PeerJS's default config has Google STUN and the PeerJS TURN relays (`eu-0/us-0.turn.peerjs.com`),
  which usually covers Wi-Fi ↔ 4G. If some network still can't connect, add a TURN of our own
  (Metered / Cloudflare) to `options()` in `peer.js`.

Lobby (`renderLobby`): idle → ВМЕСТЕ / ПРОТИВ / ВОЙТИ ПО КОДУ; host → big code + ПОДЕЛИТЬСЯ; enter →
code field. `?join=CODE` on load goes straight to joining and is removed from the address bar.

### Testing without the internet
```
npm i peer express && node -e "const e=require('express'),{ExpressPeerServer}=require('peer');const a=e();const s=a.listen(9000,'127.0.0.1');a.use('/',ExpressPeerServer(s,{path:'/'}))"
open http://localhost:8080/?peer=127.0.0.1:9000     # in two browsers / profiles
```
In headless Chromium start it with `--disable-features=WebRtcHideLocalIpsWithMdns`, otherwise two
contexts can't find each other without STUN.

`?net=local` (BroadcastChannel) still works and also supports codes; `?net=claude` forces the Claude
artifact room.

### Still to test on real devices
Two phones on different networks (Wi-Fi + 4G), landscape, 2-minute match, goal events, lightning,
guest locking the screen and coming back, host leaving mid-match.

### Fallback: tiny WebSocket relay (own server)
If WebRTC proves unreliable on some mobile networks: Node + `ws`, rooms keyed by CODE, forwards `{t:'p'}`
messages between the two sockets; deploy free on Render / Fly.io. Expose it as `window.AzzNetCustom`
with the same `host/join/leave` methods.
