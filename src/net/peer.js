// Online transport for two phones anywhere: WebRTC peer-to-peer through PeerJS, joined by a short code.
// The host registers the id PREFIX+CODE on the PeerJS broker (free public server), the guest connects to it.
// After that the phones talk directly (or through PeerJS's TURN relay when NAT is strict).
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
  const PREFIX = 'azzurri-arcade-', HEARTBEAT = 1000, DEAD = 6000, JOIN_TIMEOUT = 15000;

  function options() {
    const q = new URLSearchParams(location.search).get('peer');
    if (!q) return { debug: 0 };
    const [host, port] = q.split(':');
    return { host, port: +port || 9000, path: '/', secure: location.protocol === 'https:', debug: 0 };
  }
  const localId = () => 'me-' + Math.random().toString(36).slice(2, 10);

  function create() {
    let peer = null, conn = null, myId = localId(), mine = Object.freeze({}), theirs = null, heard = 0;
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

    setInterval(() => {
      if (!conn) return;
      if (conn.open && Date.now() - heard > DEAD) { hangUp(conn); return; }
      send({ t: 'h' });
    }, HEARTBEAT);

    function reset() {
      const c = conn, p = peer;
      conn = null; peer = null; theirs = null; myId = localId();
      if (c) { try { c.close(); } catch (e) {} }
      if (p) { try { p.destroy(); } catch (e) {} }
      rebuild();
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

      host(code) {
        reset();
        return new Promise((resolve, reject) => {
          const p = new window.Peer(PREFIX + code, options()); peer = p;
          let done = false;
          p.on('open', id => { if (peer !== p) return; done = true; myId = id; rebuild(); resolve(); });
          p.on('connection', c => { if (peer !== p) { c.close(); return; } attach(c); });
          // lost the broker (phone slept): keep talking to the friend, re-register the code in the background
          p.on('disconnected', () => setTimeout(() => { if (peer === p && !p.destroyed && p.disconnected) p.reconnect(); }, 1500));
          p.on('error', e => {
            if (done || peer !== p) return;
            done = true; reset(); reject(new Error(e && e.type === 'unavailable-id' ? 'taken' : 'network'));
          });
        });
      },

      join(code) {
        reset();
        return new Promise((resolve, reject) => {
          const p = new window.Peer(options()); peer = p;
          let done = false;
          const fail = why => { if (done || peer !== p) return; done = true; clearTimeout(timer); reset(); reject(new Error(why)); };
          const timer = setTimeout(() => fail('timeout'), JOIN_TIMEOUT);
          p.on('open', id => {
            if (peer !== p) return;
            myId = id; rebuild();
            const c = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
            attach(c, () => { if (done) return; done = true; clearTimeout(timer); resolve(); });
          });
          p.on('error', e => fail(e && e.type === 'peer-unavailable' ? 'notfound' : 'network'));
        });
      },

      leave() {
        // let the last presence ("I left") reach the friend before hanging up
        const c = conn, p = peer;
        conn = null; peer = null; theirs = null; myId = localId(); rebuild();
        setTimeout(() => { try { c && c.close(); } catch (e) {} try { p && p.destroy(); } catch (e) {} }, 300);
      },
      connected() { return true; },
    };
  }
  window.AzzNetPeer = { create, PREFIX };
})();
