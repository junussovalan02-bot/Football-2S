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

## Plan: join by code (task #1)
Two good options. Pick A unless the owner wants a server.

### A. WebRTC peer-to-peer with PeerJS (no own server)
- Load `https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js`.
- Host creates `new Peer('azz-' + CODE)` where CODE is 5 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
  Guest creates an anonymous `Peer()` and `peer.connect('azz-' + CODE)`.
- Wrap the `DataConnection` into the room interface: each side keeps `mine` presence; on change send
  `{t:'p', presence}`; on receive store the other side as a Peer and call onPeers handlers.
  Use `{ reliable: false }` channel for snapshots if latency matters, reliable for the rest.
- Uses the public PeerJS broker for signalling (free) and Google STUN. Some mobile networks need TURN;
  if friends on 4G can't connect, add a TURN server (e.g. Metered free tier or Cloudflare Calls).

### B. Tiny WebSocket relay (own server)
- Node + `ws`, rooms keyed by CODE, forwards `{t:'p'}` messages between the two sockets.
  Deploy free on Render / Fly.io / Railway. More reliable through mobile NAT, needs a server.

### Lobby changes in `index.html` / `renderLobby()`
- Online menu: **СОЗДАТЬ ИГРУ** → choose ВМЕСТЕ / ПРОТИВ → big code on screen + "ПОДЕЛИТЬСЯ"
  (Web Share API / copy link `?join=CODE`).
- **ВОЙТИ ПО КОДУ** → 5 letter input (pixel style, big, uppercase, auto-submit at 5).
- Opening `?join=CODE` goes straight to joining.
- Keep the current host/guest flow: once the guest's presence `role:'guest', code` appears, the host
  starts the match (`onNetPeers`).

### Must-test
Two real phones on different networks (Wi-Fi + 4G), landscape, 2-minute match, goal events,
lightning, reconnect when the guest locks the screen, host leaving mid-match.
