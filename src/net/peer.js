// Online transport for two phones anywhere, joined by a short code. Two links, same messages:
//  1. direct WebRTC through PeerJS: the host registers PREFIX+CODE on the PeerJS broker, the guest connects;
//  2. relay through a public MQTT broker (src/net/relay.js) when the direct link can't be made in a few
//     seconds (Wi-Fi <-> 4G, carrier NAT) or the PeerJS server is down.
// The host listens on both; the guest tries direct first, then the relay.
//
// Implements the room interface from index.js, plus:
//   room.host(code) -> Promise   take the code and wait for a friend      (rejects Error 'taken' | 'network')
//   room.join(code) -> Promise   connect, resolves once the host's presence arrived (rejects 'notfound' | 'network' | 'timeout')
//   room.leave()                 hang up, back to "only me"
// Wire format (JSON): {t:'p', patch, full} merges into the sender's presence (null deletes a field),
// {t:'h'} is a heartbeat so a phone that locked its screen is dropped within a few seconds.
//
// Dev: ?peer=localhost:9000 uses a local PeerServer (npx peer --port 9000) instead of the public one.
(function () {
  const PREFIX = 'azzurri-arcade-', HEARTBEAT = 1000, DEAD = 6000, DIRECT_TIMEOUT = 5000;

  function options() {
    const q = new URLSearchParams(location.search).get('peer');
    if (!q) return { debug: 0 };
    const [host, port] = q.split(':');
    return { host, port: +port || 9000, path: '/', secure: location.protocol === 'https:', debug: 0 };
  }
  const localId = () => 'me-' + Math.random().toString(36).slice(2, 10);

  function create() {
    let peer = null, relay = null, conn = null, myId = localId(), mine = Object.freeze({}), theirs = null, heard = 0, gen = 0;
    const hasPeer = () => !!window.Peer && new URLSearchParams(location.search).get('peer') !== 'off';
    const handlers = [];
    let snap = Object.freeze([]);

    const rebuild = () => {
      const list = [Object.freeze({ peer: myId, by: myId, isMe: true, sameTab: true, presence: mine })];
      if (theirs) list.push(theirs);
      snap = Object.freeze(list);
      for (const h of handlers.slice()) h({ peers: snap });
    };
    const send = m => { if (conn && conn.open) { try { conn.send(m); } catch (e) {} } };

    function hangUp(c) { if (!c) return; if (conn === c) { conn = null; theirs = null; rebuild(); } try { c.close(); } catch (e) {} }

    // one friend at a time: a new connection (say, the friend reconnecting after a screen lock) replaces the old one
    function attach(c, onFirst) {
      if (conn && conn !== c) hangUp(conn);
      conn = c; theirs = null; heard = Date.now();
      const hello = () => send({ t: 'p', patch: mine, full: true });
      if (c.open) hello(); else c.on('open', hello);
      c.on('data', m => {
        if (conn !== c || !m || typeof m !== 'object') return;
        heard = Date.now();
        if (m.t !== 'p' || !m.patch || typeof m.patch !== 'object') return;
        const next = m.full || !theirs ? {} : { ...theirs.presence };
        for (const k in m.patch) { if (m.patch[k] === null) delete next[k]; else next[k] = m.patch[k]; }
        theirs = Object.freeze({ peer: c.peer, by: c.peer, isMe: false, sameTab: false, presence: Object.freeze(next) });
        rebuild();
        if (onFirst) { const f = onFirst; onFirst = null; f(); }
      });
      const gone = () => { if (conn === c) { conn = null; theirs = null; rebuild(); } };
      c.on('close', gone); c.on('error', gone);
    }

    // back from the background (iOS froze the page): re-register the code on the PeerJS server right away
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && peer && !peer.destroyed && peer.disconnected) { try { peer.reconnect(); } catch (e) {} }
    });
    setInterval(() => {
      if (!conn) return;
      if (conn.open && Date.now() - heard > DEAD) { hangUp(conn); return; }
      send({ t: 'h' });
    }, HEARTBEAT);

    function reset() {
      const c = conn, p = peer, r = relay;
      conn = null; peer = null; relay = null; theirs = null; myId = localId(); gen++;
      if (c) { try { c.close(); } catch (e) {} }
      if (p) { try { p.destroy(); } catch (e) {} }
      if (r) { try { r.close(); } catch (e) {} }
      rebuild();
    }
    function directJoin(code, g) {   // resolves with nothing once the host's presence came over WebRTC
      return new Promise((resolve, reject) => {
        if (!hasPeer()) { reject(new Error('network')); return; }
        let done = false, p;
        const fail = why => { if (done) return; done = true; clearTimeout(timer); if (peer === p) { peer = null; try { p.destroy(); } catch (e) {} } if (conn && conn.peer === PREFIX + code) { const c = conn; conn = null; theirs = null; try { c.close(); } catch (e) {} } reject(new Error(why)); };
        const timer = setTimeout(() => fail('timeout'), DIRECT_TIMEOUT);
        try { p = new window.Peer(options()); } catch (e) { fail('network'); return; }
        peer = p;
        p.on('open', id => {
          if (peer !== p || gen !== g) return;
          myId = id; rebuild();
          attach(p.connect(PREFIX + code, { reliable: true, serialization: 'json' }), () => { if (done) return; done = true; clearTimeout(timer); resolve(); });
        });
        p.on('error', e => fail(e && e.type === 'peer-unavailable' ? 'notfound' : 'network'));
      });
    }

    return {
      presence(patch) {
        const next = { ...mine };
        for (const k in patch) { if (patch[k] === null) delete next[k]; else next[k] = patch[k]; }
        mine = Object.freeze(next); send({ t: 'p', patch }); rebuild();
        return Promise.resolve();
      },
      peers() { return snap; },
      onPeers(fn) { handlers.push(fn); setTimeout(rebuild, 0); return () => { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); }; },

      // listen on both links; ready as soon as one of them is up
      host(code) {
        reset();
        const g = gen; myId = PREFIX + code; rebuild();
        const direct = new Promise((resolve, reject) => {
          if (!hasPeer()) { reject(new Error('network')); return; }
          let done = false, p;
          try { p = new window.Peer(PREFIX + code, options()); } catch (e) { reject(new Error('network')); return; }
          peer = p;
          p.on('open', () => { if (peer !== p) return; done = true; rebuild(); resolve(); });
          p.on('connection', c => { if (peer !== p) { c.close(); return; } attach(c); });
          // lost the broker (phone slept): keep talking to the friend, re-register the code in the background
          p.on('disconnected', () => { rebuild(); setTimeout(() => { if (peer === p && !p.destroyed && p.disconnected) p.reconnect(); }, 1500); });
          p.on('error', e => { if (done || peer !== p) return; done = true; reject(new Error(e && e.type === 'unavailable-id' ? 'taken' : 'network')); });
        });
        const viaRelay = window.AzzRelay ? window.AzzRelay.host(code, () => myId, c => { if (gen === g) attach(c); }, () => { if (gen === g) rebuild(); })
          .then(r => { if (gen !== g) { r.close(); throw new Error('stale'); } relay = r; rebuild(); }) : Promise.reject(new Error('network'));
        return new Promise((resolve, reject) => {
          let fails = 0, taken = false;
          const no = e => { if (e && e.message === 'taken') taken = true; if (++fails === 2) { if (gen === g) reset(); reject(new Error(taken ? 'taken' : 'network')); } };
          direct.then(resolve, no); viaRelay.then(resolve, no);
        });
      },

      // direct first; if it doesn't come up in a few seconds, through the relay
      async join(code, onStage) {
        reset();
        const g = gen;
        try { await directJoin(code, g); return; } catch (e) { if (gen !== g) throw new Error('stale'); }
        if (!window.AzzRelay) { reset(); throw new Error('network'); }
        onStage && onStage('relay');
        myId = localId(); rebuild();
        let c;
        try { c = await window.AzzRelay.join(code, myId); } catch (e) { if (gen === g) reset(); throw e; }
        if (gen !== g) { c.close(); throw new Error('stale'); }
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => { if (gen === g) reset(); reject(new Error('timeout')); }, 8000);
          attach(c, () => { clearTimeout(timer); resolve(); });
        });
      },

      leave() {
        // let the last presence ("I left") reach the friend before hanging up
        const c = conn, p = peer, r = relay;
        conn = null; peer = null; relay = null; theirs = null; myId = localId(); gen++; rebuild();
        setTimeout(() => { try { c && c.close(); } catch (e) {} try { p && p.destroy(); } catch (e) {} try { r && r.close(); } catch (e) {} }, 300);
      },
      connected() { return true; },
      linkKind() { return conn ? (conn.relay ? 'relay' : 'direct') : null; },
      // true while the link still has a lot queued: skip a snapshot instead of piling up latency
      busy() { if (!conn) return false; if (conn.relay) return conn.busy(); const dc = conn.dataChannel; return (dc && dc.bufferedAmount > 48000) || (conn.bufferSize || 0) > 3; },
      // for the host's lobby: which links are up right now
      links() { return { direct: !!(peer && peer.open && !peer.disconnected && !peer.destroyed), relay: relay ? relay.ok() : 0 }; },
    };
  }
  window.AzzNetPeer = { create, PREFIX };
})();
