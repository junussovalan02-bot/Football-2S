// Fallback link through a public MQTT broker over secure WebSocket, for networks where direct WebRTC
// can't get through (typical for Wi-Fi <-> 4G, carrier NAT) or the PeerJS server is down.
// Both phones just open a WSS connection like any website, so it works wherever the web works.
// Messages are the same JSON as on the direct link; the broker only forwards them.
//
// Topics (CODE = game code):  .../CODE/info  host announcement (retained, refreshed every 15 s)
//                             .../CODE/h     host -> guest     .../CODE/g   guest -> host
// Every message carries `from` (sender id); host messages also carry `to` (the guest they are for).
//
// Exposes window.AzzRelay:
//   host(code, myId, onGuest)  -> Promise<session>   onGuest(conn) for every new guest hello
//   join(code, myId)           -> Promise<conn>      resolves when the host is found (rejects 'notfound' | 'network')
// A conn looks like a PeerJS DataConnection: peer, open, send(obj), close(), on('data'|'close', fn).
//
// Dev: ?relay=ws://127.0.0.1:8888 uses a local broker instead of the public ones.
(function () {
  const BASE = 'azzurri-arcade/v1/';
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const brokers = () => { const q = new URLSearchParams(location.search).get('relay'); return q ? [q] : BROKERS; };
  const enc = new TextEncoder(), dec = new TextDecoder();

  // ---- a tiny MQTT 3.1.1 client: CONNECT, SUBSCRIBE, PUBLISH (QoS 0, retain), PING
  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const varLen = n => { const out = []; do { let d = n % 128; n = Math.floor(n/128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return out; };
  const packet = (head, body) => { const u = new Uint8Array(1 + varLen(body.length).length + body.length); const h = [head, ...varLen(body.length)]; u.set(h, 0); u.set(body, h.length); return u; };

  function mqtt(url, onMessage) {
    return new Promise((resolve, reject) => {
      let ws; try { ws = new WebSocket(url, ['mqtt']); } catch (e) { reject(e); return; }
      ws.binaryType = 'arraybuffer';
      let buf = new Uint8Array(0), ok = false, ping = null, pid = 1, closed = false;
      const fail = () => { if (!ok) { ok = true; reject(new Error('network')); try { ws.close(); } catch (e) {} } };
      const timer = setTimeout(fail, 6000);
      const client = {
        publish(topic, text, retain) { if (ws.readyState !== 1) return; const body = [...str(topic), ...(text ? enc.encode(text) : [])]; ws.send(packet(0x30 | (retain ? 1 : 0), body)); },
        subscribe(topic) { const id = pid++; ws.send(packet(0x82, [id >> 8, id & 255, ...str(topic), 0])); },
        close() { closed = true; clearInterval(ping); try { ws.send(new Uint8Array([0xe0, 0])); ws.close(); } catch (e) {} },
        onclose: null,
      };
      ws.onopen = () => {
        const id = 'azz' + Math.random().toString(36).slice(2, 12);
        ws.send(packet(0x10, [...str('MQTT'), 4, 0x02, 0, 30, ...str(id)]));
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
  async function connectAny(onMessage) {
    for (const url of brokers()) { try { return await mqtt(url, onMessage); } catch (e) {} }
    throw new Error('network');
  }

  function makeConn(peer, sendFn, closeFn) {
    const ev = { data: [], close: [], open: [], error: [] };
    const c = {
      peer, open: true,
      send(m) { if (c.open) sendFn(m); },
      close() { if (!c.open) return; c.open = false; closeFn && closeFn(); c.emit('close'); },
      on(name, fn) { (ev[name] || (ev[name] = [])).push(fn); },
      emit(name, v) { for (const fn of (ev[name] || []).slice()) fn(v); },
    };
    return c;
  }

  // host: announce the code, turn each guest hello into a conn
  async function host(code, myId, onGuest) {
    const t = BASE + code, conns = new Map();
    const client = await connectAny((topic, m) => {
      if (topic !== t + '/g' || !m || typeof m.from !== 'string') return;
      let c = conns.get(m.from);
      if (!c && m.full) {   // a new guest says hello
        c = makeConn(m.from, msg => client.publish(t + '/h', JSON.stringify({ ...msg, from: myId(), to: m.from })), () => conns.delete(m.from));
        conns.set(m.from, c); onGuest(c);
      }
      if (c) c.emit('data', m);
    });
    client.subscribe(t + '/g');
    const announce = () => client.publish(t + '/info', JSON.stringify({ id: myId(), ts: Date.now() }), true);
    announce(); const iv = setInterval(announce, 15000);
    client.onclose = () => { clearInterval(iv); for (const c of [...conns.values()]) c.close(); };
    return { close() { clearInterval(iv); client.publish(t + '/info', '', true); for (const c of [...conns.values()]) c.close(); setTimeout(() => client.close(), 200); } };
  }

  // guest: find the host's announcement, then talk on the code's topics
  async function join(code, myId) {
    const t = BASE + code; let conn = null, found = null, hostId = null;
    const client = await connectAny((topic, m) => {
      if (topic === t + '/info') { if (m && m.id && Date.now() - (m.ts || 0) < 120000 && found) { hostId = m.id; found(); } return; }
      if (topic === t + '/h' && conn && m && m.to === myId) conn.emit('data', m);
    });
    await new Promise((resolve, reject) => {
      found = () => { found = null; resolve(); };
      client.subscribe(t + '/info'); client.subscribe(t + '/h');
      setTimeout(() => { if (found) { found = null; client.close(); reject(new Error('notfound')); } }, 3500);
    });
    conn = makeConn(hostId, m => client.publish(t + '/g', JSON.stringify({ ...m, from: myId })), () => setTimeout(() => client.close(), 200));
    client.onclose = () => conn.close();
    return conn;
  }

  window.AzzRelay = { host, join };
})();
