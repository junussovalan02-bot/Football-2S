// Development transport: two tabs of the same browser talk over BroadcastChannel.
// Open http://localhost:8080/?net=local in two tabs to test hosting/joining without any server.
// Implements the same room interface as the Claude artifact room (see index.js).
(function () {
  function create(channelName) {
    const ch = new BroadcastChannel(channelName || 'azz-room');
    const me = 'p' + Math.random().toString(36).slice(2, 10);
    let mine = Object.freeze({});
    const others = new Map();              // peer -> frozen Peer
    const handlers = [];
    let snap = Object.freeze([]);

    const rebuild = () => {
      snap = Object.freeze([
        Object.freeze({ peer: me, by: 'local-' + me, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: mine, updatedAt: Date.now() }),
        ...others.values(),
      ]);
      for (const h of handlers) h({ peers: snap, joined: [], left: [], updated: [] });
    };
    const send = (hello) => ch.postMessage({ t: 'p', peer: me, presence: mine, hello });

    ch.onmessage = (e) => {
      const m = e.data || {};
      if (m.t === 'p') {
        others.set(m.peer, Object.freeze({ peer: m.peer, by: 'local-' + m.peer, isMe: false, sameTab: false, kind: 'viewer', guest: false,
          presence: Object.freeze(m.presence || {}), updatedAt: Date.now() }));
        rebuild();
        if (m.hello) send(false);
      } else if (m.t === 'bye') { others.delete(m.peer); rebuild(); }
    };
    addEventListener('pagehide', () => ch.postMessage({ t: 'bye', peer: me }));

    return {
      presence(patch) {
        const next = { ...mine, ...patch };
        for (const k in patch) if (patch[k] === null) delete next[k];
        mine = Object.freeze(next); send(false); rebuild();
        return Promise.resolve();
      },
      peers() { return snap; },
      onPeers(fn) { handlers.push(fn); setTimeout(() => { rebuild(); send(true); }, 0); return () => handlers.splice(handlers.indexOf(fn), 1); },
      connected() { return true; },
    };
  }
  window.AzzNetLocal = { create };
})();
