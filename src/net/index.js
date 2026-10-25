// Picks the online transport for the game.
//
// The game only needs a "room" object with this shape (same as the Claude artifact room):
//   room.presence(patch)   -> Promise   merge fields into MY shared object (null removes a field)
//   room.peers()           -> Peer[]    everyone here incl. me: {peer, by, isMe, sameTab, presence}
//   room.onPeers(fn, onError)           call fn whenever anyone's presence changes / joins / leaves
// and optionally a "user" object with profiles(ids) -> {id: {name}}.
//
// Order of preference:
//   1. ?net=local in the URL        -> BroadcastChannel (two tabs of one browser, for development)
//   2. PeerJS loaded (src/vendor)   -> WebRTC, friends join by a 5-letter code (src/net/peer.js)
//   3. window.claude.use('room')    -> running inside a Claude artifact (or forced with ?net=claude)
//   4. window.AzzNetCustom          -> your own transport (WebSocket / WebRTC) — see docs/ONLINE.md
//   5. nothing                      -> online menu says "unavailable", offline modes still work
// Transports with room.host(code) / room.join(code) get the code lobby; the others list open games.
(function () {
  async function connect() {
    const q = new URLSearchParams(location.search);
    if (q.get('net') === 'local' && window.AzzNetLocal) return { room: window.AzzNetLocal.create(), user: null };
    if (q.get('net') !== 'claude' && window.Peer && window.AzzNetPeer) return { room: window.AzzNetPeer.create(), user: null };
    if (window.claude && typeof window.claude.use === 'function') {
      const room = await window.claude.use('room');
      if (room) { const user = await window.claude.use('user').catch(() => null); return { room, user }; }
    }
    if (window.AzzNetCustom && typeof window.AzzNetCustom.connect === 'function') return window.AzzNetCustom.connect();
    return null;
  }
  window.AzzNet = { connect };
})();
