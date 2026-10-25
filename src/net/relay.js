// Fallback link through a public MQTT broker over secure WebSocket, for networks where direct WebRTC
// can't get through (typical for Wi-Fi <-> 4G, carrier NAT) or the PeerJS server is down.
// Both phones just open a WSS connection like any website, so it works wherever the web works.
// Messages are the same JSON as on the direct link; the broker only forwards them.
//
// Topics (CODE = game code):  .../CODE/info  host announcement (retained, refreshed every 15 s)
//                             .../CODE/h     host -> guest     .../CODE/g   guest -> host
// Every message carries `from` (sender id); host messages also carry `to` (the guest they are for).
//
// Several brokers on different ports (one on 443) so a network that blocks some ports still gets through.
// The host stays connected to every broker it can reach (and reconnects after the phone wakes up: iOS
// drops sockets of a page in the background, e.g. while you send the link in a messenger); the guest asks
// all brokers at once and uses the first one where the host is announced.
//
// Exposes window.AzzRelay:
//   host(code, myId, onGuest, onStatus) -> Promise<session>  onGuest(conn) for every new guest hello;
//                                          session.ok() = brokers connected now, session.close()
//   join(code, myId)           -> Promise<conn>      resolves when the host is found (rejects 'notfound' | 'network')
// A conn looks like a PeerJS DataConnection: peer, open, send(obj), close(), on('data'|'close', fn).
//
// Dev: ?relay=ws://127.0.0.1:8888 uses a local broker instead of the public ones.
(function () {
  const BASE = 'azzurri-arcade/v1/';
  const BROKERS = [{ url: 'wss://broker.emqx.io:8084/mqtt' }, { url: 'wss://broker.hivemq.com:8884/mqtt' },
    { url: 'wss://test.mosquitto.org:8081/mqtt' }, { url: 'wss://public.cloud.shiftr.io', user: 'public', pass: 'public' }];
  const brokers = () => { const q = new URLSearchParams(location.search).get('relay'); return q ? q.split(',').map(url => ({ url })) : BROKERS; };
  const enc = new TextEncoder(), dec = new TextDecoder();

  // ---- a tiny MQTT 3.1.1 client: CONNECT, SUBSCRIBE, PUBLISH (QoS 0, retain), PING
  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const varLen = n => { const out = []; do { let d = n % 128; n = Math.floor(n/128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return out; };
  const packet = (head, body) => { const u = new Uint8Array(1 + varLen(body.length).length + body.length); const h = [head, ...varLen(body.length)]; u.set(h, 0); u.set(body, h.length); return u; };

  function mqtt(url, onMessage, user, pass) {
    return new Promise((resolve, reject) => {
      let ws; try { ws = new WebSocket(url, ['mqtt']); } catch (e) { reject(e); return; }
      ws.binaryType = 'arraybuffer';
      let buf = new Uint8Array(0), ok = false, ping = null, pid = 1, closed = false;
      const fail = () => { if (!ok) { ok = true; reject(new Error('network')); try { ws.close(); } catch (e) {} } };
      const timer = setTimeout(fail, 6000);
      const client = {
        publish(topic, text, retain) { if (ws.readyState !== 1) return; const body = [...str(topic), ...(text ? enc.encode(text) : [])]; ws.send(packet(0x30 | (retain ? 1 : 0), body)); },
        subscribe(topic) { const id = pid++; ws.send(packet(0x82, [id >> 8, id & 255, ...str(topic), 0])); },
        busy() { return ws.bufferedAmount > 24000; },
        close() { closed = true; clearInterval(ping); try { ws.send(new Uint8Array([0xe0, 0])); ws.close(); } catch (e) {} },
        onclose: null,
      };
      ws.onopen = () => {
        const id = 'azz' + Math.random().toString(36).slice(2, 12);
        const flags = 0x02 | (user ? 0x80 : 0) | (pass ? 0x40 : 0);
        ws.send(packet(0x10, [...str('MQTT'), 4, flags, 0, 30, ...str(id), ...(user ? str(user) : []), ...(pass ? str(pass) : [])]));
      };
      ws.onmessage = e => {
        const add = new Uint8Array(e.data), nb = new Uint8Array(buf.length + add.length); nb.set(buf); nb.set(add, buf.length); buf = nb;
        for (;;) {   // there can be several MQTT packets in one frame, or half of one
          if (buf.length < 2) break;
          let len = 0, mul = 1, i = 1, d;
          do { if (i >= buf.length) return; d = buf[i++]; len += (d & 127)*mul; mul *= 128; } while (d & 128);
          if (buf.length < i + len) break;
          const type = buf[0] >> 4, qos = (buf[0] >> 1) & 3, body = buf.subarray(i, i + len);
          buf = buf.slice(i + len);
          if (type === 2) {   // CONNACK
            clearTimeout(timer);
            if (body[1] !== 0) { fail(); return; }
            ok = true; ping = setInterval(() => { if (ws.readyState === 1) ws.send(new Uint8Array([0xc0, 0])); }, 20000); resolve(client);
          } else if (type === 3) {   // PUBLISH
            const tl = (body[0] << 8) | body[1], topic = dec.decode(body.subarray(2, 2 + tl)), payload = body.subarray(2 + tl + (qos ? 2 : 0));
            if (payload.length) { try { onMessage(topic, JSON.parse(dec.decode(payload))); } catch (e) {} }
          }
        }
      };
      ws.onerror = fail;
      ws.onclose = () => { clearInterval(ping); fail(); if (ok && !closed && client.onclose) client.onclose(); };
    });
  }

  function makeConn(peer, sendFn, closeFn, busyFn) {
    const ev = { data: [], close: [], open: [], error: [] };
    const c = {
      peer, open: true, relay: true, busy: () => !!(busyFn && busyFn()),
      send(m) { if (c.open) sendFn(m); },
      close() { if (!c.open) return; c.open = false; closeFn && closeFn(); c.emit('close'); },
      on(name, fn) { (ev[name] || (ev[name] = [])).push(fn); },
      emit(name, v) { for (const fn of (ev[name] || []).slice()) fn(v); },
    };
    return c;
  }

  // host: stay on every reachable broker, announce the code, turn each guest hello into a conn
  function host(code, myId, onGuest, onStatus) {
    const t = BASE + code, entries = brokers().map(b => ({ b, cl: null, busy: false, wait: 3000, conns: new Map() }));
    let dead = false, first = null, failed = 0;
    const ok = () => entries.filter(e => e.cl).length;
    const announce = e => e.cl && e.cl.publish(t + '/info', JSON.stringify({ id: myId(), ts: Date.now() }), true);
    function keep(e) {
      if (dead || e.cl || e.busy) return;
      e.busy = true;
      mqtt(e.b.url, (topic, m) => {
        if (topic !== t + '/g' || !m || typeof m.from !== 'string') return;
        let c = e.conns.get(m.from);
        if (!c && m.full) {   // a new guest says hello
          c = makeConn(m.from, msg => e.cl && e.cl.publish(t + '/h', JSON.stringify({ ...msg, from: myId(), to: m.from })), () => e.conns.delete(m.from), () => !e.cl || e.cl.busy());
          e.conns.set(m.from, c); onGuest(c);
        }
        if (c) c.emit('data', m);
      }, e.b.user, e.b.pass).then(cl => {
        e.busy = false;
        if (dead) { cl.close(); return; }
        e.cl = cl; e.wait = 3000; cl.subscribe(t + '/g'); announce(e);
        cl.onclose = () => { e.cl = null; for (const c of [...e.conns.values()]) c.close(); onStatus && onStatus(); setTimeout(() => keep(e), 1500); };
        onStatus && onStatus(); if (first) { first(); first = null; }
      }, () => {
        e.busy = false; e.wait = Math.min(30000, e.wait*2);
        if (first && ++failed === entries.length) { first = null; fail(); }
        setTimeout(() => keep(e), e.wait);
      });
    }
    let fail;
    const iv = setInterval(() => entries.forEach(announce), 15000);
    const wake = () => { if (document.visibilityState === 'visible') entries.forEach(e => { e.wait = 3000; keep(e); }); };
    document.addEventListener('visibilitychange', wake);
    const session = {
      ok,
      close() {
        dead = true; clearInterval(iv); document.removeEventListener('visibilitychange', wake);
        for (const e of entries) { for (const c of [...e.conns.values()]) c.close(); if (e.cl) { const cl = e.cl; e.cl = null; cl.publish(t + '/info', '', true); setTimeout(() => cl.close(), 200); } }
      },
    };
    return new Promise((resolve, reject) => {
      first = () => resolve(session);
      fail = () => { session.close(); reject(new Error('network')); };
      entries.forEach(keep);
    });
  }

  // guest: ask every broker at once, use the first one where the host is announced
  function join(code, myId) {
    const t = BASE + code, list = brokers(), clients = [];
    return new Promise((resolve, reject) => {
      let done = false, connected = 0, failed = 0, conn = null;
      const finish = (err, win) => {
        if (done) return; done = true; clearTimeout(timer);
        for (const cl of clients) if (cl !== win) cl.close();
        if (err) reject(new Error(err)); else resolve(conn);
      };
      const timer = setTimeout(() => finish(connected ? 'notfound' : 'network'), 6000);
      for (const b of list) {
        const box = { cl: null };
        mqtt(b.url, (topic, m) => {
          if (topic === t + '/info') {
            if (done || !m || !m.id || Date.now() - (m.ts || 0) > 120000) return;
            const cl = box.cl;
            conn = makeConn(m.id, msg => cl.publish(t + '/g', JSON.stringify({ ...msg, from: myId })), () => setTimeout(() => cl.close(), 200), () => cl.busy());
            cl.onclose = () => conn.close();
            box.mine = true; finish(null, cl);
          } else if (topic === t + '/h' && box.mine && conn && m && m.to === myId) conn.emit('data', m);
        }, b.user, b.pass).then(cl => {
          if (done) { cl.close(); return; }
          box.cl = cl; clients.push(cl); connected++;
          cl.subscribe(t + '/info'); cl.subscribe(t + '/h');
        }, () => { if (++failed === list.length) finish('network'); });
      }
    });
  }

  window.AzzRelay = { host, join };
})();
