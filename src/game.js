// Azzurri Arcade — game logic, rendering, input, AI and online sync.
// One IIFE on purpose: it is also inlined into a single HTML file for Claude artifacts (tools/build-single.py).
(() => {
'use strict';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
if (!TOUCH) document.body.classList.add('no-touch');

// ================== world & projection (oblique side view, like Goal 3) ==================
let W = 320; const H = 180; // W adapts to the screen's shape (240–400), H is fixed
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

let LEN = 720, WID = 200;              // x = length of the pitch, y = depth (0 = far touchline); bigger for 11 on 11, see setPitch
const SK = 0.3, SY = 0.8;              // oblique slant and depth squash
let OX = 44, OY = 64;                  // field canvas margins (OY leaves room for the stands / scenery; taller on the big pitch)
let Y0 = WID/2 - 40, Y1 = WID/2 + 40; const GH = 46, GD = 24; // goal mouth, crossbar height, net depth
const P = (x, y, z) => ({ x: OX + x + y*SK, y: OY + y*SY - (z||0) }); // field-canvas coords
const cam = { x: 0, y: 0 };
const S = (x, y, z) => { const p = P(x, y, z); return { x: p.x - cam.x, y: p.y - cam.y }; };
const hyp = Math.hypot, clamp = (x,a,b) => x<a?a:x>b?b:x, rnd = (a,b) => a + Math.random()*(b-a);
const dist = (p, q) => hyp(p.x-q.x, p.y-q.y);
function norm(x, y) { const l = hyp(x, y) || 1; return { x: x/l, y: y/l }; }

// ================== palette ==================
const PAL = { skin:'#ffb88a', skinS:'#e0845a', white:'#ffffff', ink:'#100810', mouth:'#b4243a', tongue:'#ff7a8a', tear:'#8fe0ff', blush:'#ff8f8f', bone:'#f3f0dc', ghost:'#1b2a6e' };
// Clubs, emoji icons and pitch themes are plain data in src/data.js
const { clubs: CLUBS, icons: ICONS, themes: THEMES, LOOK } = window.AZZ_DATA;
const CLUB_KEYS = Object.keys(CLUBS);
const SSJ = { hair:'#ffe14a', hairHi:'#fff6b0', style:'spiky' };   // full FURIA: super saiyan hair
let TEAMS = [CLUBS.nap, CLUBS.rom];                                  // side 0 (you) and side 1 in the current match
function setTeams(a, b) { TEAMS = [CLUBS[a], CLUBS[b]]; }

// ================== sprites (40x40 cells, anchor = feet at (20,39)) ==================
const CELL = 40;
function outline(g, col, w, h) {
  const d = g.getImageData(0, 0, w, h).data, mk = [];
  const a = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y*w+x)*4+3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!a(x,y) && (a(x-1,y)||a(x+1,y)||a(x,y-1)||a(x,y+1))) mk.push(x, y);
  g.fillStyle = col; for (let i = 0; i < mk.length; i += 2) g.fillRect(mk[i], mk[i+1], 1, 1);
}
const DIG = { '0':['XXX','X.X','X.X','X.X','XXX'], '1':['.X.','XX.','.X.','.X.','XXX'], '2':['XXX','..X','XXX','X..','XXX'], '3':['XXX','..X','XXX','..X','XXX'],
  '4':['X.X','X.X','XXX','..X','..X'], '5':['XXX','X..','XXX','..X','XXX'], '6':['XXX','X..','XXX','X.X','XXX'], '7':['XXX','..X','.X.','.X.','.X.'],
  '8':['XXX','X.X','XXX','X.X','XXX'], '9':['XXX','X.X','XXX','..X','XXX'] };

// Player features (T.f): bald, beard, mus(tache), glasses, long hair, band; 'short' is handled in getSprite
function headSide(r, T, expr) {
  const f = T.f || {};
  if (f.bald) { r(2,6,4,6,T.hair); r(4,2,16,5,T.skin); r(3,4,2,3,T.skin); r(8,2,4,1,'#ffe0c8'); }   // horseshoe of hair, shiny top
  else if (T.style === 'crop') { r(2,4,4,6,T.hair); r(3,2,18,4,T.hair); } else { r(2,3,5,9,T.hair); r(3,1,19,6,T.hair); }
  if (T.style === 'long' && !f.bald) { r(1,4,6,15,T.hair); r(2,18,4,2,T.hairHi); }
  r(5,6,16,10,T.skin); r(6,16,14,1,T.skin); r(8,17,10,1,T.skinS); r(5,13,1,3,T.skinS); r(6,16,2,1,T.skinS);
  if (f.bald) {}
  else if (T.style === 'spiky') {
    r(5,0,2,1,T.hair); r(10,0,3,1,T.hair); r(16,0,2,1,T.hair); r(20,2,3,2,T.hair); r(22,4,1,1,T.hair);
    r(6,7,4,1,T.hair); r(7,8,2,1,T.hair); r(12,7,3,1,T.hair); r(17,7,4,1,T.hair); r(19,8,2,1,T.hair);
    r(8,2,3,1,T.hairHi); r(15,2,2,1,T.hairHi); r(3,5,1,3,T.hairHi);
  } else if (T.style === 'crop') {
    r(5,6,3,1,T.hair); r(17,6,3,1,T.hair); r(8,3,4,1,T.hairHi); r(15,3,3,1,T.hairHi);
  } else if (T.style === 'long') {
    r(6,0,13,2,T.hair); r(5,6,14,1,T.hair); r(8,1,6,1,T.hairHi);
  } else {
    r(6,0,12,1,T.hair); r(18,0,4,2,T.hair); r(21,1,2,4,T.hair);
    r(6,7,6,1,T.hair); r(16,7,5,1,T.hair); r(7,8,3,1,T.hair);
    r(9,1,6,1,T.hairHi); r(19,1,2,1,T.hairHi); r(3,5,1,3,T.hairHi);
  }
  r(4,10,2,3,T.skin); r(5,11,1,1,T.skinS);
  if (f.band) { r(3,5,18,2,T.trim); r(3,5,18,1,'#ffffff'); }
  const bc = f.beardCol || T.hair;
  if (f.beard) { r(5,12,2,5,bc); r(6,16,14,2,bc); r(8,18,10,1,bc); r(18,14,3,3,bc); }
  const I = PAL.ink, Wt = PAL.white;
  const brows = () => { r(8,8,2,1,I); r(10,9,2,1,I); r(14,9,2,1,I); r(16,8,3,1,I); };
  const eyes = () => { r(9,10,3,1,I); r(9,11,3,2,Wt); r(11,11,1,2,I); r(15,10,3,1,I); r(15,11,3,2,Wt); r(17,11,1,2,I); };
  const nose = () => r(20,12,1,2,T.skinS);
  switch (expr) {
    case 'grit': brows(); eyes(); nose(); r(12,14,6,1,I); r(12,15,6,1,Wt); r(12,16,6,1,I); r(14,15,1,1,I); r(16,15,1,1,I); break;
    case 'shout': brows(); eyes(); r(12,13,6,4,PAL.mouth); r(12,13,6,1,Wt); r(13,16,4,1,PAL.tongue); r(7,13,2,1,PAL.blush); r(19,13,2,1,PAL.blush); break;
    case 'bulge': r(8,8,4,1,I); r(14,8,4,1,I); r(8,9,4,4,Wt); r(14,9,4,4,Wt); r(10,11,1,1,I); r(16,11,1,1,I);
      r(14,14,3,3,PAL.mouth); r(15,15,1,1,I); r(21,7,1,2,PAL.tear); break;
    case 'cry': r(8,9,2,1,I); r(10,8,2,1,I); r(14,8,2,1,I); r(16,9,2,1,I); r(9,12,3,1,I); r(15,12,3,1,I);
      r(10,13,1,4,PAL.tear); r(16,13,1,4,PAL.tear); r(13,15,4,1,PAL.mouth); r(12,16,1,1,I); r(17,16,1,1,I); break;
    default: brows(); eyes(); nose(); r(13,15,4,1,I);
  }
  if (f.mus && expr !== 'shout' && expr !== 'bulge') { r(12,13,8,2,bc); r(11,14,1,1,bc); r(20,14,1,1,bc); }
  if (f.glasses && expr !== 'bulge') { const G = '#202030', L = '#bfe8ff';
    r(8,9,5,1,G); r(8,13,5,1,G); r(8,10,1,3,G); r(12,10,1,3,G); r(9,10,3,1,L);
    r(14,9,5,1,G); r(14,13,5,1,G); r(14,10,1,3,G); r(18,10,1,3,G); r(15,10,3,1,L); r(13,10,1,1,G); r(19,10,3,1,G); }
}
function headBack(r, T) {
  const f = T.f || {};
  if (f.bald) { r(3,2,18,9,T.skin); r(2,9,20,5,T.hair); r(4,14,16,2,T.skin); r(9,16,6,2,T.skinS); r(1,9,2,3,T.skin); r(21,9,2,3,T.skin); r(8,3,4,1,'#ffe0c8'); return; }
  if (T.style === 'long') { r(3,1,18,19,T.hair); r(7,3,3,1,T.hairHi); r(13,4,4,1,T.hairHi); r(1,9,2,3,T.skin); r(21,9,2,3,T.skin); return; }
  if (T.style === 'crop') { r(3,2,18,9,T.hair); r(4,11,16,5,T.skin); r(7,4,3,1,T.hairHi); r(13,5,4,1,T.hairHi); r(9,16,6,2,T.skinS); r(1,9,2,3,T.skin); r(21,9,2,3,T.skin); return; }
  r(3,1,18,15,T.hair);
  if (T.style === 'spiky') { r(5,0,2,1,T.hair); r(10,0,3,1,T.hair); r(16,0,2,1,T.hair); r(2,4,1,6,T.hair); r(21,4,1,6,T.hair); }
  else { r(6,0,12,1,T.hair); r(2,4,1,7,T.hair); r(21,4,1,7,T.hair); }
  r(7,3,3,1,T.hairHi); r(13,4,4,1,T.hairHi); r(10,9,4,1,T.hairHi);
  r(9,16,6,2,T.skinS); r(1,9,2,3,T.skin); r(21,9,2,3,T.skin);
}
function body(r, T, pose, frame, view) {
  const leg = (x, y, len, bdx) => { r(x,y,3,2,T.skin); r(x,y+2,3,len-2,T.socks); r(x,y+2,1,len-2,T.socksS); r(x+bdx,y+len,5,2,T.boots); };
  if (pose === 'run') {
    if (frame === 0) { leg(7,30,5,-2); leg(14,29,5,1); }
    else if (frame === 2) { leg(14,30,5,-2); leg(9,29,5,1); }
    else { leg(8,30,6,0); leg(13,30,6,0); }
  } else if (pose === 'kick') {
    leg(8,30,6,0); r(16,26,3,3,T.skin); r(19,25,4,3,T.socks); r(19,27,4,1,T.socksS); r(23,23,3,5,T.boots);
  } else { leg(8,30,6,0); leg(13,30,6,0); }
  r(6,26,12,4,T.shorts); r(6,26,2,4,T.shortsS); r(11,29,2,1,T.shortsS);
  r(6,18,12,8,T.jersey); r(6,18,2,8,T.jerseyS); r(6,25,12,1,T.jerseyS);
  if (T.pattern === 'stripes') for (let x = 9; x < 18; x += 3) r(x,18,1,7,T.stripe);
  else if (T.pattern === 'hoops') { r(8,20,10,1,T.stripe); r(8,23,10,1,T.stripe); }
  else if (T.pattern === 'sash') for (let k = 0; k < 7; k++) r(16-k*1.5|0,18+k,2,1,T.trim);
  else if (T.pattern === 'penguin' && view === 'side') { r(10,19,7,6,'#ffffff'); r(11,25,5,1,'#ffffff'); }
  if (view === 'side') { r(10,18,4,1,T.trim); r(11,19,2,1,T.trim); }
  else {
    r(8,18,8,1,T.trim);
    const num = T.num, startX = num.length === 2 ? 8 : 10;
    [...num].forEach((ch, k) => DIG[ch].forEach((row, yy) => [...row].forEach((c, xx) => { if (c === 'X') r(startX + k*4 + xx, 19 + yy, 1, 1, T.trim); })));
  }
}
function arms(r, T, pose, frame) {
  const sl = (x,y,w,h) => { r(x,y,w,h,T.sleeve); r(x,y,1,h,T.sleeveS); }, hd = (x,y,w,h) => r(x,y,w,h,T.gloves || T.skin);
  switch (pose) {
    case 'run':
      sl(3,18,3,4); sl(18,18,3,4);
      if (frame === 0) { hd(1,21,3,3); hd(20,20,3,3); } else if (frame === 2) { hd(4,22,3,3); hd(17,21,3,3); } else { hd(3,22,3,3); hd(18,22,3,3); }
      break;
    case 'kick': sl(2,18,4,3); sl(18,18,4,3); hd(0,16,3,3); hd(22,16,3,3); break;
    case 'cheer': sl(3,16,3,3); sl(18,16,3,3); hd(2,12,3,4); hd(19,12,3,4); hd(1,10,4,3); hd(19,10,4,3); break;
    case 'charge': sl(3,18,3,4); sl(18,18,3,4); hd(1,22,3,3); hd(16,23,3,3); break;
    default: sl(3,18,3,4); sl(18,18,3,4); hd(3,22,3,3); hd(18,22,3,3);
  }
}
function skeleton(r) {
  r(3,0,19,18,PAL.ghost); r(4,18,16,12,PAL.ghost); r(6,30,12,8,PAL.ghost);
  const B = PAL.bone, I = PAL.ink;
  r(5,2,14,11,B); r(7,13,10,2,B); r(8,15,8,2,B);
  r(7,6,4,4,I); r(13,6,4,4,I); r(11,10,2,2,I); r(8,13,1,2,I); r(10,13,1,2,I); r(12,13,1,2,I); r(14,13,1,2,I);
  r(11,18,2,11,B); r(7,19,10,1,B); r(7,21,10,1,B); r(8,23,8,1,B); r(9,25,6,1,B);
  r(5,18,1,7,B); r(18,18,1,7,B); r(4,25,2,2,B); r(18,25,2,2,B);
  r(8,28,8,2,B); r(9,30,1,6,B); r(14,30,1,6,B); r(8,36,4,1,B); r(14,36,4,1,B);
}
function layDown(src) {
  const t = document.createElement('canvas'); t.width = t.height = CELL;
  const tg = t.getContext('2d'); tg.translate(0, CELL); tg.rotate(-Math.PI/2); tg.drawImage(src, 0, 0);
  const d = tg.getImageData(0,0,CELL,CELL).data; let x0 = CELL, x1 = 0, y1 = 0;
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (d[(y*CELL+x)*4+3]) { if (x<x0) x0=x; if (x>x1) x1=x; if (y>y1) y1=y; }
  const o = document.createElement('canvas'); o.width = o.height = CELL;
  o.getContext('2d').drawImage(t, Math.round(20 - (x0+x1+1)/2), 38 - y1);
  return o;
}
const SPR = new Map();
// team: side index (0/1) or a club object; v: { look, gk, ssj, num } for the individual player
function getSprite(team, pose, expr, frame, view, v) {
  if (view === 'back') expr = 'normal';
  const C = typeof team === 'number' ? TEAMS[team] : team, o = v || {};
  const key = C.code+'|'+pose+'|'+expr+'|'+frame+'|'+view+'|'+(o.look||0)+'|'+(o.gk?1:0)+'|'+(o.ssj?1:0)+'|'+(o.num||'')+'|'+(o.feat||'')+'|'+(o.lookObj ? JSON.stringify(o.lookObj) : '');
  let c = SPR.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = CELL;
  const fl = {}; for (const w of (o.feat || '').split(' ')) if (w) fl[w] = true;
  if (fl.white) fl.beardCol = '#e8eef4';
  const T = Object.assign({}, C, o.lookObj || C.looks[(o.look || 0) % C.looks.length], o.gk ? C.gk : null, o.gk ? { gloves:'#f4f4f4' } : null,
    o.ssj ? SSJ : null, { num: String(o.num || 10), f: fl });
  const g = c.getContext('2d');
  const base = pose === 'tackle' ? 'kick' : pose === 'dive' ? 'cheer' : (pose === 'fall' || pose === 'shock') ? 'idle' : pose;
  const ox = 8, oy = ((base === 'run' && frame === 1) || (base === 'cheer' && frame === 1)) ? 0 : 1;
  const r = (x,y,w,h,col) => { g.fillStyle = col; g.fillRect(ox+x, oy+y, w, h); };
  if (pose === 'shock' && frame === 0) { skeleton(r); outline(g, '#ffe14a', CELL, CELL); }
  else {
    body(r, T, base, frame, view);
    if (view === 'back') headBack(r, T); else headSide(r, T, pose === 'shock' ? 'bulge' : expr);
    arms(r, T, base, frame);
    if (fl.short) {   // a short player: same head, squeezed body (head lowered 7 px)
      const t = document.createElement('canvas'); t.width = t.height = CELL; t.getContext('2d').drawImage(c, 0, 0); g.clearRect(0, 0, CELL, CELL);
      g.drawImage(t, 0, 0, CELL, 19, 0, 7, CELL, 19); g.drawImage(t, 0, 19, CELL, 6, 0, 26, CELL, 6);
      g.drawImage(t, 0, 27, CELL, 3, 0, 32, CELL, 3); g.drawImage(t, 0, 35, CELL, 5, 0, 35, CELL, 5);
    }
    outline(g, PAL.ink, CELL, CELL);
    if (pose === 'shock') { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,228,60,.55)'; g.fillRect(0,0,CELL,CELL); g.globalCompositeOperation = 'source-over'; }
  }
  if (pose === 'tackle' || pose === 'fall' || pose === 'dive') c = layDown(c);
  SPR.set(key, c);
  return c;
}
// the ball: a shaded sphere with patches that roll around it (8 frames)
const BALLSPR = [0, 1, 2, 3, 4, 5, 6, 7].map(f => {
  const c = document.createElement('canvas'); c.width = c.height = 12; const g = c.getContext('2d');
  const spots = [[0, 0], [1.25, -0.55], [-1.25, -0.55], [2.5, 0.35], [-2.5, 0.35], [0.6, 1.15], [-0.6, -1.25], [3.14, -0.9]];
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const dx = (x - 5.5)/5.2, dy = (y - 5.5)/5.2; if (dx*dx + dy*dy > 1) continue;
    const lon = Math.asin(clamp(dx/Math.sqrt(Math.max(0.01, 1 - dy*dy)), -1, 1)) + f*Math.PI/8, lat = Math.asin(clamp(dy, -1, 1));
    let spot = false;
    for (const [sl, sb] of spots) { let d = Math.abs(((lon - sl + Math.PI*3) % (Math.PI*2)) - Math.PI); if (d*d*0.9 + (lat - sb)**2 < 0.16) spot = true; }
    const light = -dx*0.6 - dy*0.8;
    g.fillStyle = spot ? (light > 0.3 ? '#3a3a4a' : '#1a1a24') : light > 0.45 ? '#ffffff' : light > -0.35 ? '#e8ecf4' : '#b8c0d4';
    g.fillRect(x, y, 1, 1);
  }
  outline(g, PAL.ink, 12, 12); return c;
});


// ================== taunt emotes (pixel icons) ==================
function makeIcon(fn) {
  const c = document.createElement('canvas'); c.width = c.height = 14; const g = c.getContext('2d');
  const r = (x,y,w,h,col) => { g.fillStyle = col; g.fillRect(x+1, y+1, w, h); };
  fn(r); outline(g, PAL.ink, 14, 14); return c;
}
const face = (r, col, sh) => { for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const d = (x-5.5)**2 + (y-5.5)**2;
  if (d <= 31) r(x, y, 1, 1, d > 18 && x + y > 13 ? sh : col); } };
const YL = '#ffd23a', YS = '#e89a1a', K = PAL.ink, TB = '#4ab8ff';
const EMO = {
  cry: makeIcon(r => { face(r, YL, YS); r(2,3,1,1,K); r(3,4,2,1,K); r(9,3,1,1,K); r(7,4,2,1,K);
    r(3,5,1,5,TB); r(8,5,1,5,TB); r(4,7,4,3,K); r(5,8,2,2,'#e8344a'); }),
  angry: makeIcon(r => { face(r, '#ff6a3a', '#cc3a1a'); r(2,3,2,1,K); r(4,4,1,1,K); r(8,3,2,1,K); r(7,4,1,1,K);
    r(3,5,2,1,K); r(7,5,2,1,K); r(4,8,4,1,K); r(3,9,1,1,K); r(8,9,1,1,K); r(10,0,2,1,'#ffffff'); r(11,1,1,1,'#ffffff'); }),
  laugh: makeIcon(r => { face(r, YL, YS); r(3,3,1,1,K); r(2,4,1,1,K); r(4,4,1,1,K); r(8,3,1,1,K); r(7,4,1,1,K); r(9,4,1,1,K);
    r(3,6,6,1,K); r(3,7,6,1,'#ffffff'); r(3,8,6,1,'#e8344a'); r(4,9,4,1,K); r(0,5,1,2,TB); r(11,5,1,2,TB); }),
  tongue: makeIcon(r => { face(r, YL, YS); r(3,3,2,2,K); r(7,4,2,1,K); r(3,7,6,1,K); r(5,8,3,3,'#ff6a8a'); r(6,9,1,1,'#d8345a'); }),
  finger: makeIcon(r => { const S = PAL.skin, SS = PAL.skinS;
    r(5,0,2,6,S); r(5,0,2,1,'#ffe0cc'); r(2,5,8,3,S); r(4,5,1,2,SS); r(7,5,1,2,SS); r(3,8,6,3,S); r(1,7,2,2,S); r(8,8,1,3,SS); r(3,11,6,1,'#a01c2c'); }),
  zzz: makeIcon(r => { const B = '#4aa8f0'; r(5,0,6,1,B); r(9,1,1,1,B); r(8,2,1,1,B); r(7,3,1,1,B); r(6,4,1,1,B); r(5,5,6,1,B);
    r(0,7,4,1,B); r(2,8,1,1,B); r(1,9,1,1,B); r(0,10,4,1,B); })
};
// pickups (12x12 + outline)
const ITEMSPR = {
  pizza: makeIcon(r => { r(0,0,12,3,'#c87a2a'); r(0,0,12,1,'#e8a050'); for (let y = 3; y < 12; y++) { const w = Math.max(1, 12 - (y-2)*1.3|0), x0 = (12-w) >> 1; r(x0, y, w, 1, '#ffd23a'); }
    r(3,4,2,2,'#d8344a'); r(7,5,2,2,'#d8344a'); r(5,8,2,2,'#d8344a'); r(4,3,1,1,'#3a9a3a'); r(8,7,1,1,'#3a9a3a'); }),
  pepper: makeIcon(r => { r(7,0,2,2,'#2a8a2a'); r(6,2,4,2,'#3aaa3a'); r(4,3,6,3,'#e8241a'); r(3,5,6,3,'#e8241a'); r(2,7,5,2,'#e8241a'); r(1,9,4,1,'#c8140a'); r(0,10,2,1,'#c8140a');
    r(5,4,2,1,'#ff8a6a'); r(4,6,1,1,'#ff8a6a'); }),
  horn: makeIcon(r => { r(1,0,4,3,'#f2c230'); r(1,0,4,1,'#fff3a0'); r(2,3,4,3,'#d8241a'); r(3,6,4,2,'#d8241a'); r(5,8,3,2,'#d8241a'); r(7,9,3,1,'#b8140a'); r(9,8,2,1,'#b8140a'); r(10,7,1,1,'#b8140a');
    r(3,3,1,2,'#ff7a6a'); r(4,6,1,1,'#ff7a6a'); }),
};
// pizza delivery boy on a Vespa, facing right (36x28)
const VESPA = (() => {
  const c = document.createElement('canvas'); c.width = 36; c.height = 28; const g = c.getContext('2d');
  const r = (x,y,w,h,col) => { g.fillStyle = col; g.fillRect(x+1, y, w, h); };
  const VB = '#8fd8e8', VS = '#4aa0b8', TIRE = '#202030';
  r(24,4,9,7,'#d8344a'); r(24,4,9,1,'#ff6a7a'); r(24,7,9,1,'#ffffff'); r(26,5,5,1,'#ffffff');           // pizza boxes on the rack
  r(23,11,10,2,'#5a5a68');
  r(14,8,7,6,'#d8344a'); r(14,13,7,1,'#a01c2c');                                                       // rider: red jacket
  r(13,0,9,8,'#ffffff'); r(13,0,9,1,'#d8dce8'); r(19,2,4,4,'#3a4a7a'); r(20,2,2,1,'#8fb8ff');          // helmet + visor
  r(12,9,3,2,'#d8344a'); r(8,9,4,2,PAL.skin);                                                          // arm on the handlebar
  r(15,14,5,4,'#2a3a6a'); r(12,17,4,2,'#2a3a6a'); r(11,19,3,1,'#202030');                              // legs
  r(19,13,13,8,VB); r(19,19,13,2,VS); r(27,14,4,2,'#ffffff');                                          // rear cowl
  r(9,19,11,3,VB); r(9,21,11,1,VS);                                                                    // floorboard
  r(5,6,4,15,VB); r(5,6,1,15,'#c8f0f8'); r(8,6,1,15,VS); r(4,4,7,2,'#5a5a68'); r(3,7,2,3,'#ffe14a');    // leg shield, bars, light
  r(3,21,7,7,TIRE); r(5,23,3,3,'#a4acc4'); r(25,21,7,7,TIRE); r(27,23,3,3,'#a4acc4');                   // wheels
  outline(g, PAL.ink, 36, 28); return c;
})();
for (const [k, ic] of Object.entries(ICONS)) EMO[k] = makeIcon(r => ic.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') r(x, y, 1, 1, ic.pal[ch]); })));
// ================== team skills, scares, puddles and silly gags ==================
// Every country has its own skill (button with the team's name, AI uses it too), recharging SKILL_CD s.
// While it recharges the same button is БУ!: scare opponents nearby — they drop the ball, run away and may wet
// themselves (a slippery puddle). Random gags hit random players: sneezing, laces, mum calling, pigeon, dancing, a spider.
const SKILL_CD = 24;
const SKILLS = {
  herd:      { name: 'ТАБУН!', short: 'ТАБУН', desc: 'табун всадников топчет соперников' },
  eagle:     { name: 'БЕРКУТ!', short: 'БЕРКУТ', desc: 'орёл уносит мяч соперника твоему нападающему' },
  lava:      { name: 'ВЕСУВИЙ!', short: 'ЛАВА', desc: 'на соперников падают вулканические бомбы' },
  shields:   { name: 'ГЛАДИАТОРЫ!', short: 'ЩИТЫ', desc: 'вся команда 6 с неуязвима' },
  ghost:     { name: 'ПРИЗРАКИ!', short: 'УУУУ', desc: 'команда-призрак: сквозь вас не пройти, а враги в ужасе' },
  inflation: { name: 'ИНФЛЯЦИЯ!', short: '$$$', desc: 'FURIA соперника обесценивается, твоя растёт' },
  rocket:    { name: 'РАКЕТА!', short: 'РАКЕТА', desc: 'ракета разносит штрафную соперника' },
  strike:    { name: 'ЗАБАСТОВКА!', short: 'СТАЧКА', desc: 'соперники бастуют 3 с' },
  order:     { name: 'ОРДНУНГ!', short: 'СТРОЙ', desc: 'соперники строятся в шеренгу у своих ворот' },
  home:      { name: 'ФУТБОЛ ЕДЕТ ДОМОЙ!', short: 'ДОМОЙ', desc: 'мяч сам катится к чужим воротам' },
  bull:      { name: 'КОРРИДА!', short: 'БЫК', desc: 'бык проносится сквозь соперников' },
  feint:     { name: 'ФИНТЫ!', short: 'ФИНТ', desc: 'игрока с мячом не сбить и не отобрать 5 с' },
  bikes:     { name: 'ВЕЛОСИПЕДЫ!', short: 'ВЕЛИК', desc: 'команда пересаживается на велики' },
  blizzard:  { name: 'МЕТЕЛЬ!', short: 'МЕТЕЛЬ', desc: 'соперники вмерзают в лёд' },
  cannon:    { name: 'ПУШКА!', short: 'ПУШКА', desc: 'ядро прошивает защиту насквозь' },
  miracle:   { name: 'ЧУДО!', short: 'ЧУДО', desc: 'следующий удар вратарь не возьмёт' },
  tsunami:   { name: 'ЦУНАМИ!', short: 'ВОЛНА', desc: 'волна смывает соперников к их воротам' },
};
const SKILL_KEYS = Object.keys(SKILLS);
const RK = ['horse', 'bull', 'cannon', 'wave', 'eagle', 'rocket', 'lava', 'camel'], FRZ = ['strike', 'ice', 'phone', 'poop', 'dance', 'sneeze', 'order'];
const TXTS = ['ОПИСАЛСЯ!', 'АПЧХИ!', 'ШНУРКИ!', 'АЛЛО, МАМА?', 'ГОЛУБЬ!', 'ТАНЦУЕТ!', 'ПАУК!', 'БУ!', 'ДЗЫНЬ!', 'ТВОЙ ГОЛ!', 'НЕТ!'];
let pees = [];
// a word over someone's head (relayed to the online guest)
function say(text, x, y, col) { const s = P(x, y, 44); burst('txt', s.x, s.y, TXTS.indexOf(text)); }
function freeze(q, k, t) {
  if (q.state === ST.FALL || q.state === ST.STUN) return;
  q.freeze = { k, t };
  if (ball.owner === q && ['strike', 'ice', 'order', 'sneeze'].includes(k)) { ball.owner = null; ball.lock = q; ball.lockT = 0.6; ball.vx = rnd(-60, 60); ball.vy = rnd(-60, 60); }
}
function pee(q) {
  pees.push({ x: q.x, y: q.y + 2, t: 12 }); if (pees.length > 12) pees.shift();
  q.peeT = 2.5; say('ОПИСАЛСЯ!', q.x, q.y); sfx('pee');
}
function scare(q, src) {
  if (q.freeze || q.state > ST.RUN || q.role === 'gk' || q.buff === 'horn') return;
  const n = norm((q.x - src.x) || rnd(-1, 1), q.y - src.y); q.fear = { t: 1.1, dx: n.x, dy: n.y };
  if (ball.owner === q) { ball.owner = null; ball.lock = q; ball.lockT = 0.8; ball.vx = -n.x*40; ball.vy = -n.y*40; }
  emote(q, 'cry', true); sfx('scream'); if (Math.random() < 0.45) pee(q);
}
function boo(p) {
  p.scareCd = 5; say('БУ!', p.x, p.y); sfx('boo');
  for (const q of players) if (q.team !== p.team && dist(q, p) < 55) scare(q, p);
}
function humanSkill(p) { if (game.skillCd[p.team] <= 0) useSkill(p.team); else if (p.scareCd <= 0) boo(p); }
function useSkill(team) {
  if (game.mode !== 'play' || game.skillCd[team] > 0) return false;
  const c = TEAMS[team], k = SKILLS[c.skill] ? c.skill : 'herd'; game.skillCd[team] = SKILL_CD;
  game.announce = { text: SKILLS[k].name, col: c.color, t: 1.6 }; sfx('skill');
  const dir = dirOf(team), foes = players.filter(q => q.team !== team), mates = players.filter(q => q.team === team);
  const field = foes.filter(q => q.role !== 'gk'), R = o => game.runners.push(Object.assign({ team, dir, t: 0, z: 0, hit: new Set() }, o));
  switch (k) {
    case 'herd': for (let n = 0; n < 5; n++) R({ k: 'horse', x: dir > 0 ? -40 - n*30 : LEN + 40 + n*30, y: WID*(0.12 + n*0.19) + rnd(-8, 8), sp: 340 }); sfx('neigh'); break;
    case 'bull': R({ k: 'bull', x: dir > 0 ? -40 : LEN + 40, y: clamp(ball.y, 20, WID - 20), sp: 300 }); sfx('moo'); break;
    case 'cannon': { const tg = ball.owner && ball.owner.team !== team ? ball.owner : field.sort((a, b) => dist(a, ball) - dist(b, ball))[0]; R({ k: 'cannon', x: tg ? tg.x : ball.x, y: -20, z: 10, sp: 420, dir: 1 }); sfx('boom'); break; }
    case 'tsunami': R({ k: 'wave', x: dir > 0 ? 0 : LEN, y: WID/2, sp: 260 }); break;
    case 'eagle': R({ k: 'eagle', x: ball.x - dir*220, y: -30, z: 60, phase: 0 }); break;
    case 'rocket': R({ k: 'rocket', x: goalX(team) - dir*40, y: WID/2, z: 190 }); break;
    case 'lava': field.sort(() => Math.random() - 0.5).slice(0, 6).forEach((q, n) => R({ k: 'lava', x: q.x + rnd(-10, 10), y: q.y + rnd(-6, 6), z: 150 + n*45 })); break;
    case 'shields': for (const q of mates) { q.buff = 'horn'; q.buffT = 6; } break;
    case 'ghost': for (const q of mates) q.ghost = 5; for (const q of field) if (mates.some(m => dist(m, q) < 70)) scare(q, mates.find(m => dist(m, q) < 70)); break;
    case 'inflation': game.fury[1 - team] = 0; fury(team, 40); for (let n = 0; n < 60; n++) spawn(cam.x + rnd(0, W), cam.y - rnd(0, 40), rnd(-20, 20), rnd(40, 90), rnd(1.5, 3), n % 2 ? '#6ac85a' : '#d8f0c8', 3, 20); break;
    case 'strike': for (const q of foes) { freeze(q, 'strike', q.role === 'gk' ? 2 : 3); } break;
    case 'blizzard': for (const q of foes) freeze(q, 'ice', 2.2); for (let n = 0; n < 80; n++) spawn(cam.x + rnd(0, W), cam.y + rnd(0, H), rnd(-60, 60), rnd(-20, 40), rnd(0.6, 1.4), '#ffffff', 2, 0); break;
    case 'order': { const ox = ownX(1 - team), d2 = ox === 0 ? 1 : -1;
      field.forEach((q, n) => { const s0 = P(q.x, q.y); burst('dust', s0.x, s0.y); q.x = ox + d2*(LEN*0.2 + (n % 2)*22); q.y = WID*(0.12 + 0.76*n/Math.max(1, field.length - 1)); q.vx = q.vy = 0; freeze(q, 'order', 1.3); });
      if (ball.owner && ball.owner.team !== team) ball.owner = null; break; }
    case 'home': if (ball.owner && ball.owner.team !== team) ball.owner = null; ball.home = { team, t: 2.6 }; ball.superType = null; break;
    case 'feint': { const q = ball.owner && ball.owner.team === team ? ball.owner : mates.filter(m => m.role !== 'gk').sort((a, b) => dist(a, ball) - dist(b, ball))[0]; if (q) { q.buff = 'feint'; q.buffT = 5; } break; }
    case 'bikes': for (const q of mates) if (q.role !== 'gk') q.cycle = 6; break;
    case 'miracle': game.miracle[team] = 9; break;
  }
  return true;
}
function trample(r, rad, lift) {
  for (const q of players) if (q.team !== r.team && !r.hit.has(q) && hyp(q.x - r.x, (q.y - r.y)*1.3) < rad) {
    r.hit.add(q); knockDown(q, r.k === 'cannon' ? 0.2 : r.dir, r.k === 'cannon' ? 1 : (q.y - r.y)/12 || 0.3, 220, 'bulge', lift);
    if (q.state === ST.FALL) { sfx('hit'); game.shake = Math.max(game.shake, 0.2); if (Math.random() < 0.3) pee(q); } }
}
function updRunners(dt) {
  for (let i = game.runners.length - 1; i >= 0; i--) {
    const r = game.runners[i], b = ball; r.t += dt; let done = r.t > 8;
    switch (r.k) {
      case 'horse': case 'bull': r.x += r.dir*r.sp*dt; trample(r, r.k === 'bull' ? 22 : 18, r.k === 'bull' ? 250 : 220);
        if (Math.random() < 0.4) { const q = P(r.x - r.dir*12, r.y); spawn(q.x, q.y, -r.dir*30, rnd(-30, -10), 0.5, '#c8a870', 3, 30); }
        if (r.x < -100 || r.x > LEN + 100) done = true; break;
      case 'cannon': r.y += r.sp*dt; trample(r, 13, 200); { const q = P(r.x, r.y, r.z); spawn(q.x, q.y, rnd(-10, 10), -20, 0.6, '#a0a0a8', 3, -20); } if (r.y > WID + 30) done = true; break;
      case 'wave': r.x += r.dir*r.sp*dt;
        for (const q of players) if (q.team !== r.team && !r.hit.has(q) && Math.abs(q.x - r.x) < 14) { r.hit.add(q); knockDown(q, r.dir, rnd(-0.3, 0.3), 230, 'bulge', 90); }
        if (!b.owner && Math.abs(b.x - r.x) < 16 && b.z < 20) b.vx = r.dir*Math.max(Math.abs(b.vx), 300);
        if (r.x < -20 || r.x > LEN + 20) done = true; break;
      case 'eagle': {
        if (r.phase === 0) { const tx = b.x, ty = b.y, n = norm(tx - r.x, ty - r.y); r.x += n.x*320*dt; r.y += n.y*320*dt; r.z = Math.max(18, r.z - 40*dt);
          if (hyp(tx - r.x, ty - r.y) < 12) { b.owner = null; r.phase = 1; sfx('squawk');
            const ms = players.filter(q => q.team === r.team && q.role !== 'gk'); r.to = ms.sort((a, c) => r.dir*(c.x - a.x))[0]; } }
        else { const m = r.to; if (!m) { done = true; break; } const n = norm(m.x - r.x, m.y - r.y); r.x += n.x*300*dt; r.y += n.y*300*dt;
          b.x = r.x; b.y = r.y; b.z = Math.max(0, r.z - 8); b.vx = b.vy = b.vz = 0; b.owner = null;
          if (hyp(m.x - r.x, m.y - r.y) < 10) { b.z = 0; b.owner = m; b.last = m; done = true; } }
        break; }
      case 'rocket': r.z -= 220*dt; { const q = P(r.x, r.y, r.z + 14); spawn(q.x, q.y, rnd(-10, 10), -30, 0.4, Math.random() < 0.5 ? '#ff8a1a' : '#ffd23a', 3, -40); }
        if (r.z <= 0) { for (const q of players) if (q.team !== r.team && hyp(q.x - r.x, q.y - r.y) < 75) knockDown(q, (q.x - r.x) || 1, q.y - r.y, 230, 'bulge', 200);
          const s0 = P(r.x, r.y); burst('quake', s0.x, s0.y); burst('super', s0.x, s0.y); sfx('boom'); game.shake = 0.6; game.flash = Math.max(game.flash, 0.4); hitstop(0.1); done = true; } break;
      case 'lava': r.z -= 210*dt;
        if (r.z <= 0) { for (const q of players) if (q.team !== r.team && hyp(q.x - r.x, q.y - r.y) < 24) knockDown(q, (q.x - r.x) || 1, q.y - r.y, 180, 'bulge', 160);
          const s0 = P(r.x, r.y); burst('lava', s0.x, s0.y); sfx('hit'); game.shake = Math.max(game.shake, 0.3); done = true; } break;
    }
    if (done) game.runners.splice(i, 1);
  }
}
function drawRunner(r) {
  const s0 = S(r.x, r.y), x = Math.round(s0.x), y = Math.round(s0.y), z = Math.round(r.z || 0), fr = Math.floor(game.t*10) % 2;
  const put = (spr, yy, flip) => { if (!flip) ctx.drawImage(spr, x - (spr.width >> 1), yy - spr.height + 2); else { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -(spr.width >> 1), yy - spr.height + 2); ctx.restore(); } };
  if (r.k === 'horse') put(CRITSPR.horse[fr], y + fr, r.dir < 0);
  else if (r.k === 'bull') put(CRITSPR.bull[fr], y + fr, r.dir < 0);
  else if (r.k === 'cannon') { pellipse(x, y, 5, 2, 'rgba(0,30,0,.4)'); pellipse(x, y - 12, 5, 5, '#202030'); ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x - 2, y - 15, 2, 2); }
  else if (r.k === 'eagle') { pellipse(x, y, 6, 2, 'rgba(0,30,0,.3)'); put(CRITSPR.eagle[fr], y - z, r.dir < 0); }
  else if (r.k === 'rocket' || r.k === 'lava') {
    pellipseRing(x, y, 12, 4, Math.floor(game.t*12) % 2 ? '#ff3a1a' : '#ffd23a');
    if (r.k === 'rocket') { ctx.save(); ctx.translate(x, y - z); ctx.scale(1, -1); ctx.drawImage(EMO.rocket, -7, -7); ctx.restore(); }
    else { pellipse(x, y - z - 5, 5, 5, '#5a2a1a'); pellipse(x - 1, y - z - 6, 3, 3, '#ff5a1a'); }
  }
}
function drawWave(r) {
  const a = S(r.x, -6), b2 = S(r.x, WID + 6);
  for (const [w, c, o] of [[16, 'rgba(40,140,230,.55)', -6], [9, 'rgba(120,210,255,.75)', -2], [3, '#ffffff', 2]]) pline(ctx, a.x + o*r.dir, a.y - 10, b2.x + o*r.dir, b2.y - 10, c, w);
}
function updGags(dt) {
  if (!chaosOn || game.mode !== 'play') return;
  if ((game.gagT -= dt) > 0) return; game.gagT = rnd(9, 15);
  const pool = players.filter(q => q.role !== 'gk' && q.state <= ST.RUN && !q.freeze && !q.fear && (!q.human || Math.random() < 0.25)); if (!pool.length) return;
  const p = pool[Math.floor(Math.random()*pool.length)], k = ['sneeze', 'laces', 'phone', 'poop', 'dance', 'spider'][Math.floor(Math.random()*6)];
  switch (k) {
    case 'sneeze': say('АПЧХИ!', p.x, p.y); sfx('sneeze'); if (ball.owner === p) { const a = Math.random()*Math.PI*2; ball.kick(Math.cos(a), Math.sin(a), 170, 60, p, null); }
      freeze(p, 'sneeze', 0.6); { const q = P(p.x + p.fx*10, p.y, 26); for (let n = 0; n < 12; n++) spawn(q.x, q.y, p.fx*rnd(40, 90), rnd(-30, 20), 0.5, '#d8f0ff', 2, 60); } break;
    case 'laces': say('ШНУРКИ!', p.x, p.y); knockDown(p, p.fx, p.fy, 60, 'cry', 0); break;
    case 'phone': say('АЛЛО, МАМА?', p.x, p.y); sfx('ring'); freeze(p, 'phone', 1.7); break;
    case 'poop': say('ГОЛУБЬ!', p.x, p.y); sfx('splat'); p.poopT = 4; freeze(p, 'poop', 0.9); break;
    case 'dance': say('ТАНЦУЕТ!', p.x, p.y); freeze(p, 'dance', 1.5); break;
    case 'spider': say('ПАУК!', p.x, p.y); scare(p, { x: p.x + p.fx*10, y: p.y + p.fy*10 }); break;
  }
}

// Critters that live on themed pitches and wander across now and then (11 on 11 / career only).
// speed u/s, r = hit radius, lift = how far they throw players (0 = they just shove), axis 'y' = they cross the
// pitch's width, fly = height, life = they stand still for a while, steal = they carry the ball off.
const CRIT = {
  elephant: { speed: 60, r: 24, lift: 230, every: [14, 22], snd: 'trumpet', name: 'СЛОН!' },
  panda:    { speed: 38, r: 15, lift: 0, every: [12, 18], name: 'ПАНДА!' },
  snowman:  { speed: 0, r: 12, lift: 0, life: 12, every: [14, 20], name: 'СНЕГОВИК!' },
  penguin:  { speed: 240, r: 11, lift: 120, every: [8, 13], name: 'ПИНГВИН!' },
  horse:    { speed: 330, r: 20, lift: 260, every: [11, 17], snd: 'neigh', name: 'ДЖИГИТ!' },
  crab:     { speed: 90, r: 9, lift: 70, axis: 'y', every: [8, 13], name: 'КРАБ!' },
  cow:      { speed: 45, r: 20, lift: 0, every: [13, 19], snd: 'moo', name: 'КОРОВА!' },
  seagull:  { speed: 190, r: 16, lift: 0, fly: 26, steal: true, every: [10, 16], snd: 'squawk', name: 'ЧАЙКА!' },
  pigeon:   { speed: 140, r: 10, lift: 0, fly: 8, every: [8, 12], name: 'ГОЛУБИ!' },
  camel:    { speed: 50, r: 20, lift: 0, every: [12, 18], snd: 'moo', name: 'ВЕРБЛЮД!' },
  shark:    { speed: 230, r: 16, lift: 200, every: [11, 17], name: 'АКУЛА!' },
};
const CRITSPR = (() => {
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    fn((x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }); outline(g, PAL.ink, w, h); return c; };
  const two = (w, h, fn) => [mk(w, h, r => fn(r, 0)), mk(w, h, r => fn(r, 1))];
  const K = PAL.ink;
  return {
    elephant: two(36, 26, (r, f) => { const G = '#9a9aa8', D = '#7a7a88';
      r(4,6,22,13,G); r(22,3,10,12,G); r(19,4,5,10,D); r(29,12,3,9,G); r(27,20,3,2,G); r(27,13,4,1,'#ffffff'); r(28,6,1,1,K); r(3,8,1,5,D);
      for (const [x, k] of [[6,0],[11,1],[18,0],[22,1]]) r(x, 18, 4, 6 - (k === f ? 2 : 0), D); }),
    panda: two(22, 20, (r, f) => { r(3,6,14,9,'#ffffff'); r(3,14,4,5 - f,K); r(13,14,4,4 + f,K); r(2,8,3,5,K); r(15,8,3,5,K);
      r(11,0,10,8,'#ffffff'); r(11,0,2,2,K); r(19,0,2,2,K); r(13,3,2,2,K); r(17,3,2,2,K); r(20,5,1,1,K); }),
    snowman: two(18, 26, (r, f) => { r(2,13,14,12,'#ffffff'); r(4,7,10,7,'#ffffff'); r(5,1,8,7,'#ffffff'); r(5,0,8,2,'#202030'); r(4,2,10,1,'#202030');
      r(7,4,1,1,K); r(10,4,1,1,K); r(12,5,4,1,'#ff8a1a'); r(8,9,1,1,K); r(8,15,1,1,K); r(8,18,1,1,K); r(0,8 + f,4,1,'#6a4020'); r(14,9 - f,4,1,'#6a4020'); r(4,7,10,1,'#d8243a'); }),
    penguin: two(18, 12, (r, f) => { r(2,3,12,7,'#202030'); r(3,6,10,3,'#ffffff'); r(11,1,6,7,'#202030'); r(14,3,1,1,'#ffffff'); r(16,4,2,1,'#ff9a1a'); r(0,4 + f,2,3,'#ff9a1a'); }),
    horse: two(32, 30, (r, f) => { const B = '#8a4a2a', M = '#3a2010';
      r(6,12,18,8,B); r(21,6,5,9,B); r(23,3,8,5,B); r(20,4,3,7,M); r(28,4,1,1,K); r(2,12,4,7,M);
      for (const [x, k] of [[7,0],[11,1],[18,0],[22,1]]) r(x + (k === f ? 1 : -1), 20, 2, 8, B);
      r(11,4,6,8,'#2fb8e8'); r(12,0,5,4,'#e8a070'); r(11,-1,7,2,'#d8243a'); r(10,-1,1,3,'#ffd23a'); r(17,6,5,2,'#2fb8e8'); r(12,11,3,4,'#202030'); }),
    crab: [EMO.crab, EMO.crab],
    cow: two(30, 22, (r, f) => { r(4,5,18,10,'#ffffff'); r(7,6,5,4,K); r(14,9,4,4,K); r(20,2,8,8,'#ffffff'); r(20,2,3,3,K); r(26,7,3,3,'#ffb0b0'); r(24,4,1,1,K);
      r(20,0,1,2,'#e8e0c8'); r(26,0,1,2,'#e8e0c8'); r(10,15,4,2,'#ffb0b0'); r(2,6,2,6,K);
      for (const [x, k] of [[5,0],[9,1],[16,0],[19,1]]) r(x, 15, 3, 6 - (k === f ? 1 : 0), '#e8e8e8'); }),
    seagull: two(20, 12, (r, f) => { r(6,5,9,4,'#ffffff'); r(14,4,4,3,'#ffffff'); r(18,5,2,1,'#ffd23a'); r(16,4,1,1,K); r(4,6,3,2,'#c8c8d0');
      if (f) { r(2,1,8,3,'#a0a0b0'); r(10,1,5,3,'#a0a0b0'); } else { r(3,8,7,3,'#a0a0b0'); r(10,8,5,3,'#a0a0b0'); } }),
    pigeon: two(24, 12, (r, f) => { for (const [x, y] of [[0,4],[9,0],[16,5]]) { r(x+1,y+3,6,3,'#8a8a98'); r(x+5,y+1,3,3,'#6a6a7a'); r(x+7,y+2,1,1,'#ffd23a');
      if (f) r(x+2,y,4,2,'#a0a0b0'); else r(x+2,y+6,4,2,'#a0a0b0'); } }),
    camel: two(30, 28, (r, f) => { const C = '#d8a050', D = '#a8742a'; r(4,10,18,8,C); r(7,6,5,5,C); r(14,6,5,5,C); r(20,4,4,10,C); r(22,1,7,5,C); r(27,2,1,1,K); r(3,11,2,6,D);
      for (const [x, k] of [[6,0],[9,1],[17,0],[20,1]]) r(x, 18, 2, 9 - (k === f ? 2 : 0), D); r(8,5,9,2,'#d8243a'); }),
    bull: two(32, 22, (r, f) => { const B = '#2a1a14', D = '#141010'; r(4,6,20,10,B); r(21,3,9,9,B); r(20,1,2,3,'#f4f0e8'); r(28,1,2,3,'#f4f0e8'); r(26,6,1,1,'#ff3a1a'); r(28,9,3,2,'#c87a6a'); r(2,7,2,6,D);
      for (const [x, k] of [[5,0],[9,1],[17,0],[21,1]]) r(x, 16, 3, 6 - (k === f ? 2 : 0), D); r(4,6,20,1,'#4a3a2a'); }),
    eagle: two(26, 16, (r, f) => { const B = '#6a4020', D = '#3a2410'; r(8,6,10,5,B); r(17,4,5,5,'#f4f4f4'); r(22,6,3,2,'#ffd23a'); r(19,5,1,1,K); r(4,8,4,3,D);
      if (f) { r(6,0,6,6,B); r(13,1,5,5,B); } else { r(5,11,7,5,B); r(13,11,5,4,B); } r(12,11,2,3,'#ffd23a'); }),
    shark: two(22, 14, (r, f) => { for (let k = 0; k < 10; k++) r(6 + (k*0.6|0), k, 10 - k, 1, '#7a8a9a'); r(0,10,22,2,'#bfe8ff'); r(2 + f*2,12,18,2,'#5aa8d8'); }),
  };
})();
function spawnCritter() {
  const kind = TH.critter, C = CRIT[kind]; if (!C) return;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const cr = { kind, dir, t: 0, life: C.life || 0, held: 0 };
  if (C.life) { cr.x = clamp(ball.x + rnd(-120, 120), 80, LEN - 80); cr.y = rnd(40, WID - 40); }
  else if (C.axis === 'y') { cr.x = clamp(ball.x + rnd(-140, 140), 40, LEN - 40); cr.y = dir > 0 ? -12 : WID + 12; }
  else { cr.x = dir > 0 ? -40 : LEN + 40; cr.y = clamp(ball.y + rnd(-60, 60), 20, WID - 20); }
  game.critter = cr; if (C.snd) sfx(C.snd);
  game.announce = { text: C.name, col: '#ffe14a', t: 1.2 };
}
function updCritter(dt) {
  const cr = game.critter, C = CRIT[cr.kind]; cr.t += dt;
  if (C.axis === 'y') cr.y += cr.dir*C.speed*dt; else cr.x += cr.dir*C.speed*dt;
  if (C.fly) cr.z = C.fly + Math.sin(cr.t*6)*3; else cr.z = 0;
  for (const p of players) {
    if (p.state === ST.FALL || p.state === ST.STUN || C.fly) continue;
    const d = hyp(p.x - cr.x, (p.y - cr.y)*1.3);
    if (d < C.r) {
      if (C.lift) { knockDown(p, C.axis === 'y' ? 0.3 : cr.dir, C.axis === 'y' ? cr.dir : (p.y - cr.y)/12 || 0.3, 200, 'bulge', C.lift); if (p.state === ST.FALL) { sfx('hit'); game.shake = Math.max(game.shake, 0.2); } }
      else { const n = norm(p.x - cr.x || 1, p.y - cr.y); p.x = cr.x + n.x*C.r; p.y = clamp(cr.y + n.y*C.r/1.3, 4, WID - 4); }   // big and calm: you just bump off
    }
  }
  const b = ball;
  if (C.steal && !cr.held && !b.owner && b.z < 40 && hyp(b.x - cr.x, b.y - cr.y) < C.r) { cr.held = 1.4; sfx('squawk'); }
  if (cr.held > 0) { cr.held -= dt; b.owner = null; b.x = cr.x + cr.dir*6; b.y = cr.y; b.z = (cr.z || 0) - 2; b.vx = cr.dir*C.speed; b.vy = 0; b.vz = 0;
    if (cr.held <= 0) { cr.held = -1; b.vz = 40; b.superType = null; } }
  else if (!C.fly && !b.owner && b.z < 26 && hyp(b.x - cr.x, (b.y - cr.y)*1.3) < C.r) {   // the ball bounces off it
    const n = norm(b.x - cr.x || 1, b.y - cr.y), sp = Math.max(120, hyp(b.vx, b.vy)*0.8);
    b.vx = n.x*sp + (C.axis === 'y' ? 0 : cr.dir*C.speed); b.vy = n.y*sp; b.vz = Math.max(b.vz, 60); b.z = Math.max(b.z, 1); b.x = cr.x + n.x*(C.r + 2); sfx('bounce');
  }
  const out = C.life ? cr.t > C.life : C.axis === 'y' ? (cr.y < -20 || cr.y > WID + 20) : (cr.x < -60 || cr.x > LEN + 60);
  if (out) { game.critter = null; game.critterT = rnd(...C.every); }
}
function drawCritter() {
  const cr = game.critter, spr = CRITSPR[cr.kind][Math.floor(cr.t*(cr.kind === 'snowman' ? 2 : 8)) % 2];
  const s = S(cr.x, cr.y, cr.z || 0), x = Math.round(s.x), y = Math.round(s.y) + (cr.kind === 'horse' ? Math.floor(cr.t*10) % 2 : 0);
  if (cr.kind === 'snowman' && cr.life - cr.t < 2) ctx.globalAlpha = Math.max(0.2, (cr.life - cr.t)/2);   // melting
  if (cr.dir > 0 || CRIT[cr.kind].axis === 'y') ctx.drawImage(spr, x - (spr.width >> 1), y - spr.height + 2);
  else { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -(spr.width >> 1), y - spr.height + 2); ctx.restore(); }
  ctx.globalAlpha = 1;
}
const TAUNTS = ['tongue', 'finger', 'laugh', 'zzz', 'finger'];
const clubEmo = team => { const e = TEAMS[team].emo || []; return e[Math.floor(Math.random()*e.length)] || 'laugh'; };
function emote(p, type, force) {
  if (!p || (p.team !== 1 && !force)) return;
  if (!force && (game.emoCd > 0 || (p.emote && p.emote.t > 0.8))) return;
  if (p.team === 1 && Math.random() < 0.55 && !['cry', 'angry'].includes(type)) type = clubEmo(1);   // their country's own taunts
  p.emote = { type, t: 2.8, age: 0 }; game.emoCd = 1.4; if (p.team === 1) fury(0, 6);   // being mocked makes you angrier
  if (AC && !muted) { try { tone('square', 880, 1320, 0.07, 0.06); tone('square', 1320, 1760, 0.06, 0.05, 0.07); } catch (e) {} }
}
const nearestRival = q => players.filter(p => p.team === 1 && p.state <= ST.KICK).sort((a, b) => dist(a, q) - dist(b, q))[0];
function updEmotes(dt) {
  game.emoCd -= dt;
  for (const p of players) if (p.emote) { p.emote.t -= dt; p.emote.age += dt; if (p.emote.t <= 0) p.emote = null; }
  if (game.mode !== 'play' && game.mode !== 'title') return;
  game.tauntT -= dt;
  if (game.tauntT <= 0) {
    game.tauntT = rnd(7, 12);
    const pool = players.filter(p => p.team === 1 && p.state <= ST.RUN && !p.emote);
    if (pool.length) emote(pool[Math.floor(Math.random()*pool.length)], TAUNTS[Math.floor(Math.random()*TAUNTS.length)]);
  }
}
function drawEmote(p) {
  const e = p.emote; if (!e) return;
  const s = S(p.x, p.y), x = Math.round(s.x), lying = p.state === ST.FALL || p.state === ST.TACKLE;
  const pop = Math.min(1, e.age/0.12), bw = Math.max(4, Math.round(22*pop)), bh = Math.max(4, Math.round(20*pop));
  const by = Math.round(s.y) - (lying ? 46 : 66) + (Math.floor(game.t*3) % 2), bx = x - (bw >> 1);
  if (e.t < 0.3) ctx.globalAlpha = e.t/0.3;
  ctx.fillStyle = PAL.ink; ctx.fillRect(bx+1, by, bw-2, bh); ctx.fillRect(bx, by+1, bw, bh-2);
  ctx.fillRect(x-3, by+bh-1, 7, 2); ctx.fillRect(x-1, by+bh+1, 3, 2); ctx.fillRect(x, by+bh+3, 1, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(bx+2, by+1, bw-4, bh-2); ctx.fillRect(bx+1, by+2, bw-2, bh-4);
  ctx.fillRect(x-2, by+bh-2, 5, 2); ctx.fillRect(x, by+bh, 1, 2);
  if (pop >= 1) {
    const wob = e.type === 'finger' ? (Math.floor(game.t*8) % 2) : 0;
    ctx.drawImage(EMO[e.type], x-7, by+3 - wob);
  }
  ctx.globalAlpha = 1;
}

// ================== pixel helpers ==================
function pline(g, x0, y0, x1, y1, col, w) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1-x0), dy = -Math.abs(y1-y0), sx = x0<x1?1:-1, sy = y0<y1?1:-1; let e = dx+dy;
  g.fillStyle = col; const o = (w-1) >> 1;
  for (let i = 0; i < 4000; i++) { g.fillRect(x0-o, y0-o, w, w); if (x0 === x1 && y0 === y1) break;
    const e2 = 2*e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function pellipse(cx, cy, rx, ry, col) {
  ctx.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx*Math.sqrt(Math.max(0, 1 - (y*y)/(ry*ry+0.01)))); ctx.fillRect(cx-w, cy+y, w*2+1, 1); }
}
function ptext(g, str, x, y, size, col, align, stroke) {
  g.font = size + 'px "Press Start 2P", monospace'; g.textAlign = align || 'left'; g.textBaseline = 'top';
  if (stroke) { g.fillStyle = stroke; const s = Math.max(1, Math.round(size/8));
    for (const [a,b] of [[-s,0],[s,0],[0,-s],[0,s],[-s,-s],[s,s],[-s,s],[s,-s],[s,s+s],[0,s+s]]) g.fillText(str, x+a, y+b); }
  g.fillStyle = col; g.fillText(str, x, y);
}

// ================== audio ==================
let AC = null, muted = false, noiseBuf = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)();
    const n = Math.floor(AC.sampleRate*0.7); noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random()*2-1;
  } catch (e) { AC = null; }
}
function tone(type, f0, f1, dur, vol, delay) {
  const t = AC.currentTime + (delay||0), o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), t+dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t+dur+0.02);
}
function noise(dur, vol, freq, delay) {
  const t = AC.currentTime + (delay||0), s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t+dur);
}
function sfx(k) { netEv('s', k); sfxLocal(k); }
function sfxLocal(k) {
  if (!AC || muted) return;
  try { switch (k) {
    case 'kick': tone('square',320,90,0.08,0.14); noise(0.05,0.18,2200); break;
    case 'pass': tone('square',420,200,0.06,0.1); break;
    case 'ready': [784, 988, 1175, 1568].forEach((f, i) => tone('square', f, f, 0.07, 0.07, i*0.06)); break;
    case 'tackle': noise(0.2,0.22,900); break;
    case 'bounce': tone('triangle',220,120,0.05,0.1); break;
    case 'super': tone('sawtooth',160,1400,0.45,0.1); tone('square',80,700,0.45,0.05); break;
    case 'boom': noise(0.6,0.45,500); tone('sine',90,30,0.5,0.35); break;
    case 'hit': tone('square',640,80,0.16,0.1); noise(0.1,0.2,3000); break;
    case 'zap': noise(0.4,0.4,7000); tone('square',900,60,0.35,0.08); break;
    case 'goal': [523,659,784,1046,784,1046].forEach((f,i) => tone('square',f,f*1.001,0.12,0.1,i*0.11)); break;
    case 'whistle': tone('sine',2600,2500,0.22,0.13); tone('sine',2600,2550,0.4,0.13,0.28); break;
    case 'chaos': [392,523,659,523,784].forEach((f,i) => tone('square',f,f,0.08,0.08,i*0.07)); break;
    case 'vespa': tone('sawtooth',90,140,0.7,0.07); tone('square',660,660,0.12,0.07); tone('square',520,520,0.14,0.07,0.16); break;
    case 'pickup': tone('square',988,1976,0.12,0.08); tone('square',1318,2637,0.1,0.06,0.08); break;
    case 'boing': tone('square',240,1100,0.32,0.06); break;
    case 'ding': tone('triangle',1568,1568,0.15,0.1); break;
    case 'tiger': noise(0.5,0.35,700); tone('sawtooth',260,70,0.5,0.12); tone('square',120,500,0.3,0.05); break;
    case 'kame': tone('sine',200,1600,0.35,0.12); noise(0.7,0.3,4000,0.3); tone('sawtooth',90,60,0.6,0.08,0.3); break;
    case 'rasen': tone('sawtooth',500,1800,0.45,0.06); tone('square',1800,600,0.45,0.04); noise(0.4,0.15,6000); break;
    case 'ora': for (let k = 0; k < 8; k++) { tone('square',520 + k*30,140,0.05,0.08,k*0.06); noise(0.04,0.15,2500,k*0.06); } break;
    case 'dive': noise(0.15,0.18,1200); break;
    case 'blip': tone('square',660,700,0.04,0.05); break;
    case 'honk': tone('square',420,300,0.12,0.12); tone('square',380,280,0.12,0.12,0.15); break;
    case 'skill': [523,784,1046,1568].forEach((f,i) => tone('square',f,f,0.09,0.09,i*0.06)); noise(0.3,0.15,3000,0.2); break;
    case 'boo': tone('sawtooth',160,90,0.45,0.12); noise(0.3,0.2,600); break;
    case 'scream': tone('square',1200,1800,0.18,0.06); tone('square',1800,900,0.3,0.06,0.18); break;
    case 'pee': for (let k = 0; k < 10; k++) noise(0.05,0.06,5000 + k*200,k*0.06); break;
    case 'sneeze': noise(0.08,0.1,1500); noise(0.25,0.3,4000,0.12); break;
    case 'ring': for (let k = 0; k < 4; k++) tone('square',1320,1320,0.06,0.05,k*0.12); break;
    case 'splat': noise(0.12,0.25,900); tone('sine',300,80,0.15,0.1); break;
    case 'trumpet': tone('sawtooth',260,520,0.25,0.08); tone('sawtooth',520,300,0.4,0.07,0.25); break;
    case 'neigh': for (let k = 0; k < 5; k++) tone('square',900 - k*60,700 - k*60,0.06,0.05,k*0.07); break;
    case 'moo': tone('sawtooth',140,110,0.7,0.08); break;
    case 'squawk': tone('square',1400,900,0.12,0.06); tone('square',1300,800,0.12,0.06,0.14); break;
    case 'post': tone('triangle',1800,1700,0.4,0.12); tone('square',2400,2300,0.2,0.04); break;
    case 'catch': tone('square',300,200,0.06,0.12); noise(0.06,0.2,800); break;
    case 'parry': tone('square',700,200,0.12,0.1); noise(0.08,0.25,2000); break;
  } } catch (e) {}
}

// ================== chiptune (original tarantella loop) ==================
const MEL = [69,72,76,81,76,72, 71,74,76,80,76,74, 69,72,76,81,79,77, 76,74,72,71,72,74,
             77,76,74,72,71,69, 68,71,74,76,74,71, 69,76,81,76,72,76, 69,0,69,0,69,0];
const BASS = [45,40,45,40,38,40,45,45];
let musicOn = false, musicTimer = null, nextT = 0, mstep = 0;
const EIGHTH = 0.145, mtof = n => 440*Math.pow(2, (n-69)/12);
function note(type, f, t, dur, vol) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
function schedMusic() {
  if (!AC || !musicOn) return;
  if (muted || game.paused) { nextT = AC.currentTime + 0.1; return; }
  while (nextT < AC.currentTime + 0.2) {
    const s = mstep % MEL.length, bar = Math.floor(s/6), beat = s % 6;
    try {
      if (MEL[s]) note('square', mtof(MEL[s]), nextT, EIGHTH*0.9, 0.035);
      if (beat === 0 || beat === 3) note('triangle', mtof(BASS[bar]), nextT, EIGHTH*2.6, 0.12);
      if (beat === 0 || beat === 3) { const n = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
        n.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000; g.gain.setValueAtTime(beat ? 0.04 : 0.07, nextT);
        g.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.05); n.connect(f).connect(g).connect(AC.destination); n.start(nextT); n.stop(nextT + 0.06); }
    } catch (e) {}
    nextT += EIGHTH*(chaosIs('espresso') ? 0.7 : 1); mstep++;   // espresso speeds the tarantella up
  }
}
function startMusic() { if (!AC || musicOn) return; musicOn = true; nextT = AC.currentTime + 0.15; mstep = 0; musicTimer = setInterval(schedMusic, 40); }
function stopMusic() { musicOn = false; clearInterval(musicTimer); }

// ================== game state ==================
const ST = { IDLE:0, RUN:1, KICK:2, TACKLE:3, FALL:4, STUN:5, DIVE:6 };
const MAXSP = 102, ACC = 1050, ACCH = 1600, KPOW = 345, KLIFT = 80, CHARGE = 0.42, TSPD = 205, TTIME = 0.42;   // ACCH: humans turn faster
const KCONTACT = 0.045, KTIME = 0.18, FALLT = 0.85, STUNT = 1.1, REACH = 12, KREACH = 20, GRAV = 560, MATCH = 120, MATCH11 = 180;
// difficulty: how the computer's team plays (speed, turning, tackling, aim, steals, FURIA gain, its keeper)
const DIFFS = [
  { name:'Я СЛАБАК',   speed:0.74, turn:3,   tackle:0.9, cd:3.2, tackleR:15, spread:70, steal:0.35, lead:0.05, loose:2.5, fury:0.7,  gk:{ react:0.34, dive:170, catch:0.3, err:30 } },
  { name:'Я НОРМ',     speed:0.84, turn:4.5, tackle:1.6, cd:2.4, tackleR:17, spread:52, steal:0.6,  lead:0.08, loose:3.5, fury:1,    gk:{ react:0.24, dive:205, catch:0.45, err:20 } },
  { name:'Я МУТАНТ',   speed:0.95, turn:8,   tackle:3,   cd:1.6, tackleR:20, spread:34, steal:1.0,  lead:0.18, loose:6,   fury:1.25, gk:{ react:0.15, dive:240, catch:0.6, err:11 } },
  { name:'Я ЧУДОВИЩЕ', speed:1.04, turn:14,  tackle:5,   cd:1.0, tackleR:23, spread:20, steal:1.6,  lead:0.25, loose:8,   fury:1.5,  gk:{ react:0.08, dive:270, catch:0.75, err:5 } },
];
const GK_MATE = { react:0.16, dive:235, catch:0.55, err:16 };   // your own keeper is decent on every level
let diff = 1;
const D = () => DIFFS[diff];
// the right side is played by the computer unless a friend plays it online
const cpuSide = team => team === 1 && !(NET.role === 'host' && NET.mode === 'vs') && NET.role !== 'guest';
const CURSED_GK = { react:0.45, dive:150, catch:0.2, err:40 };   // career: the shaman's curse
const keeperSkill = p => game.curse && p.team === 1 ? CURSED_GK : cpuSide(p.team) ? D().gk : GK_MATE;

class Player {
  constructor(team, role) {
    Object.assign(this, { team, role, x:0, y:0, vx:0, vy:0, state:ST.IDLE, st:0, fx:team?-1:1, fy:0,
      charge:0, kickSuper:false, superType:'tiger', kickDone:false, hit:new Set(), tBall:false,
      sm:1, tr:1, human:false, aiCd:0, anim:0, fallExpr:'cry', mood:null, z:0, vz:0, buff:null, buffT:0, dingCd:0,
      name:'', num:10, look:0, slot:9, home:null, react:0, holdT:0, saved:false, ora:false, passTo:null,
      stam:1, tired:false, sprinting:false, freeze:null, fear:null, peeT:0, poopT:0, ghost:0, cycle:0, scareCd:0,
      inp:{ mx:0, my:0, kickHeld:false, kickReleased:false, tacklePressed:false, sprint:false } });
  }
}
let players = [];
let MODE = 2, weatherOn = true;
// 4-4-2 for 11 on 11: [role, depth 0 (own goal)..1 (their goal), width 0..1], squad order matches club.names
const F442 = [['gk',.03,.5], ['def',.2,.14], ['def',.17,.38], ['def',.17,.62], ['def',.2,.86],
  ['mid',.38,.14], ['mid',.34,.4], ['mid',.34,.6], ['mid',.38,.86], ['att',.5,.42], ['att',.5,.58]];
const NUMS = [1, 2, 4, 5, 3, 7, 8, 6, 11, 10, 9];
// faces of a squad: a deterministic mix of beards, moustaches, glasses, bald heads, long hair, headbands
function featFor(c, slot) {
  if (c.uniform) return '';
  if (c.special && c.special[slot]) return c.special[slot];
  let h = 7; for (const ch of c.code + slot) h = (h*31 + ch.charCodeAt(0)) % 1000003;
  const rnd01 = () => { h = (h*1103515245 + 12345) % 2147483648; return h/2147483648; };
  const out = [], beardy = c.beardy ? 0.25 : 0;
  const b = rnd01(); if (b < 0.2 + beardy) out.push('beard'); else if (b < 0.34 + beardy) out.push('mus');
  if (rnd01() < 0.14) out.push('bald'); if (rnd01() < 0.13) out.push('glasses'); if (rnd01() < 0.08) out.push('band');
  if (c.code === 'ANT' && out.includes('beard')) out.push('white');
  return out.join(' ');
}
// arcade keeps its old order (outfield first, keepers last) so online snapshots line up
function buildTeams(mode) {
  const mk = (team, slot, role) => { const q = new Player(team, role || F442[slot][0]), c = TEAMS[team];
    Object.assign(q, { slot, name: c.names[slot], num: NUMS[slot], look: (slot*7 + team*3) % c.looks.length, feat: featFor(c, slot), home: { x: F442[slot][1], y: F442[slot][2] } }); return q; };
  if (mode === 11) players = [0, 1].flatMap(t => F442.map((f, k) => mk(t, k)));
  else if (mode === 1) players = [mk(0, 10, 'att'), mk(1, 10, 'att'), mk(0, 0), mk(1, 0)];
  else players = [mk(0, 10, 'att'), mk(0, 2, 'def'), mk(1, 10, 'att'), mk(1, 2, 'def'), mk(0, 0), mk(1, 0)];
}
// arcade 720x200, reality 1200x380 (the field canvases are resized and rebuilt)
function setPitch(mode) {
  const L = mode === 11 ? 1200 : 720, Wd = mode === 11 ? 380 : 200;
  const oy = mode === 11 ? 92 : 64;
  if (L === LEN && Wd === WID && oy === OY) return false;
  LEN = L; WID = Wd; Y0 = WID/2 - 40; Y1 = WID/2 + 40; OY = oy;
  FCV.width = FRONT.width = Math.ceil(OX + LEN + WID*SK + 44); FCV.height = FRONT.height = Math.ceil(OY + WID*SY + 30);
  return true;
}
const ball = { shotT:0, passTo:null, passAt:null, x:LEN/2, y:WID/2, z:0, vx:0, vy:0, vz:0, owner:null, superType:null, gs:1, lock:null, lockT:0, last:null, rot:0, drag:1,
  kick(dx, dy, pow, lift, by, type) {
    this.owner = null; this.vx = dx*pow; this.vy = dy*pow; this.vz = lift; this.superType = type || null; this.gs = 1;
    this.shot = false; this.shotT = 0; this.passTo = null; this.passAt = null; this.curve = 0; this.home = null; this.miracle = false;
    this.lock = by; this.lockT = 0.3; this.last = by;
    this.beam = null;
    if (type === 'tiger') { this.vz = 18; this.gs = 0.12; }
    else if (type === 'kame') { this.vz = 0; this.z = Math.max(this.z, 8); this.gs = 0; this.vx *= 1.3; this.vy *= 1.3; this.beam = { x: this.x, y: this.y, t: 0.9 }; }
    else if (type === 'rasen') { this.vz = 30; this.z = Math.max(this.z, 6); this.gs = 0.18; this.vx *= 1.05; this.vy *= 1.05; }
    this.wt = 0;
    if (this.vz > 0 && this.z <= 0) this.z = 0.01;
  } };
const game = { mode:'title', t:0, time:MATCH, score:[0,0], goalT:0, weather:'rain', wind:{x:0,y:0}, windT:0, lightT:6,
  len:MATCH, chasers:[[], []], runners:[], skillCd:[0, 0], miracle:[0, 0], gagT:10, shake:0, flash:0, bolt:null, banner:null, announce:null, ctrlCd:0, kickoffTeam:0, hitstop:0, fury:[0,0], furyFlash:[0,0], switchFlash:0, wantSwitch:false, paused:false, emoCd:0, tauntT:8, half:1, flip:0, show:null };
let patches = [], parts = [], rain = [], pops = [];

function hitstop(t) { game.hitstop = Math.max(game.hitstop, t); }
function setState(p, s) { if (p.state === s) return;
  if (p.grudge && (p.state === ST.FALL || p.state === ST.STUN) && s === ST.IDLE) { p.grudge = false; emote(p, Math.random() < 0.6 ? 'angry' : 'cry'); }
  p.state = s; p.st = 0;
  if (s === ST.KICK) p.kickDone = false; if (s === ST.TACKLE) { p.hit.clear(); p.tBall = false; } else p.ora = false;
  if (s === ST.DIVE) p.saved = false; }
function approach(p, tx, ty, md) { const dx = tx-p.vx, dy = ty-p.vy, l = hyp(dx,dy);
  if (l <= md) { p.vx = tx; p.vy = ty; } else { p.vx += dx/l*md; p.vy += dy/l*md; } }
const mateOf = p => players.find(q => q.team === p.team && q !== p && q.role !== 'gk');
const keeperOf = team => players.find(q => q.team === team && q.role === 'gk');
// after half-time the teams swap ends: game.flip = 1 means team 0 now attacks to the left
const dirOf = team => (team ^ game.flip) ? -1 : 1;
const goalX = team => dirOf(team) > 0 ? LEN : 0;
const ownX = team => dirOf(team) > 0 ? 0 : LEN;
const mirX = x => game.flip ? LEN - x : x;   // a spot given for the first half, on the current half's side

function surfaceAt(x, y) { let s = null;
  for (const pt of patches) for (const e of pt.blobs) if (((x-e.x)/e.rx)**2 + ((y-e.y)/e.ry)**2 < 1) { if (pt.type === 'puddle') return 'puddle'; s = 'mud'; }
  return s; }

// lift > 0 throws the player into the air (cartwheel until they land)
function knockDown(p, dx, dy, force, expr, lift) {
  if (p.state === ST.FALL || p.state === ST.STUN) return;
  if (p.buff === 'horn' || p.buff === 'feint' || p.ghost > 0) { shield(p); return; }
  if (lift >= 150 && Math.random() < 0.2) setTimeout(() => { if (players.includes(p)) pee(p); }, 400);   // scared stiff
  if (ball.owner === p) { ball.owner = null; ball.lock = p; ball.lockT = 0.5; ball.vx = dx*80; ball.vy = dy*80; ball.vz = 70; ball.z = 0.01; }
  const n = norm(dx, dy); p.vx = n.x*force; p.vy = n.y*force; p.charge = 0; p.fallExpr = expr || 'cry';
  setState(p, ST.FALL); fury(p.team, 12);
  if (lift) { p.vx *= 0.6; p.vy *= 0.6; p.vz = lift; p.z = Math.max(p.z, 0.01); if (lift >= 150) sfx('boing'); }
  if (p.team === 0) emote(nearestRival(p), Math.random() < 0.5 ? 'laugh' : 'finger'); else p.grudge = true;
}
function keeperSave(p) {
  const b = ball, K = keeperSkill(p), spd = hyp(b.vx, b.vy);
  p.saved = true;
  if (b.superType || b.miracle) return;   // super shots blow the keeper away instead; a miracle can't be stopped
  if (spd < 230 || Math.random() < K.catch) { b.owner = p; b.vx = b.vy = b.vz = 0; b.z = 0; b.last = p; p.holdT = 0; sfx('catch'); }
  else {   // punched away: the rebound is up for grabs
    const dir = ownX(p.team) === 0 ? 1 : -1;
    b.vx = dir*Math.max(80, Math.abs(b.vx)*rnd(0.3, 0.5)); b.vy = rnd(-1, 1)*160; b.vz = rnd(90, 170); b.z = Math.max(b.z, 1);
    b.lock = p; b.lockT = 0.4; b.last = p; sfx('parry');
  }
  game.announce = { text: 'СЕЙВ!', col: '#ffffff', t: 1.1 };
  const s = P(b.x, b.y, b.z + 6); burst('ding', s.x, s.y); fury(p.team, 10);
}
// dive just fast enough to meet the ball at the line (capped by the keeper's skill: too far = goal)
function dive(p, dx, dy, spd, t) {
  const v = Math.min(spd, hyp(dx*0.3, dy)/Math.max(t, 0.1)*1.1 + 25), n = norm(dx*0.3, dy);
  p.vx = n.x*v; p.vy = n.y*v; p.vz = 110; p.z = Math.max(p.z, 0.01);
  p.charge = 0; setState(p, ST.DIVE); sfx('dive');
}
function shield(p) {
  if (p.dingCd > 0) return; p.dingCd = 0.4;
  const s = P(p.x, p.y, 20); burst('ding', s.x, s.y); sfx('ding');
}
function electrocute(p) {
  if (p.buff === 'horn') { shield(p); return; }
  if (ball.owner === p) { ball.owner = null; const a = Math.random()*Math.PI*2; ball.kick(Math.cos(a), Math.sin(a), 90, 160, p, null); }
  p.vx = p.vy = 0; p.charge = 0; setState(p, ST.STUN); fury(p.team, 15);
  if (p.team === 0) emote(nearestRival(p), 'laugh'); else p.grudge = true;
}
// ================== CAOS: random events, pickups, flying players ==================
const CHAOS = {
  giant:    { name: 'МЯЧ-ГИГАНТ!',     label: 'ГИГАНТ', dur: 9,  col: '#ffd23a' },
  vespa:    { name: 'ПИЦЦА-ЭКСПРЕСС!', label: 'ВЕСПА',  dur: 7,  col: '#ff6a5a' },
  moon:     { name: 'ЛУНА!',           label: 'ЛУНА',   dur: 10, col: '#c8b8ff' },
  espresso: { name: 'ЭСПРЕССО!',       label: 'ТУРБО',  dur: 8,  col: '#e8b070' },
  quake:    { name: 'ВЕСУВИЙ!',        label: 'ТРЯСКА', dur: 6,  col: '#ff5a3a' },
  ice:      { name: 'ГОЛОЛЁД!',        label: 'ЛЁД',    dur: 9,  col: '#9fe8ff' },
};
const CHAOS_KEYS = Object.keys(CHAOS), ITEMS = ['pizza', 'pepper', 'horn'];
const ITEMNAME = { pizza: '+FURIA', pepper: 'ПЕРЧИК!', horn: 'КОРНЕТТО!' };
const VSPD = 290, BIGK = 2.5, X2T = 20;   // vespa speed, giant ball scale, last seconds when a goal counts double
let chaosOn = true, items = [];
const chaosIs = t => !!game.chaos && game.chaos.type === t;
const gravK = () => (chaosIs('moon') ? 0.32 : 1)*ph('grav');
const giant = () => chaosIs('giant');
// pitch theme (src/data.js THEMES): scenery, colours, weather, critters and physics multipliers
let TH = THEMES.stadium, themeKey = 'stadium';
function setTheme(k) { themeKey = THEMES[k] ? k : 'stadium'; TH = THEMES[themeKey]; }
const ph = k => (TH.phys && TH.phys[k] !== undefined) ? TH.phys[k] : 1;

function startChaos(type) {
  game.chaos = { type, t: CHAOS[type].dur }; game.lastChaos = type;
  game.announce = { text: CHAOS[type].name, col: CHAOS[type].col, t: 1.6 }; sfx('chaos');
  if (type === 'vespa') spawnVespa();
  if (type === 'quake') game.quakeT = 0.7;
}
function spawnVespa() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  game.vespa = { x: dir > 0 ? -40 : LEN + 40, y: rnd(30, WID - 30), dir, t: 0, drop: false, hitBall: false };
  if (game.mode !== 'title') sfx('vespa');
}
function spawnItem(type, x, y) {
  for (let k = 0; k < 20 && x === undefined; k++) {
    const tx = clamp(ball.x + rnd(-150, 150), 60, LEN - 60), ty = rnd(25, WID - 25);
    if (players.every(q => hyp(q.x - tx, q.y - ty) > 45)) { x = tx; y = ty; }
  }
  if (x !== undefined) items.push({ type: type || ITEMS[Math.floor(Math.random()*ITEMS.length)], x, y, t: 10 });
}
function pickUp(p, it) {
  const s = P(it.x, it.y, 12); burst('pick', s.x, s.y, ITEMS.indexOf(it.type)); sfx('pickup');
  if (it.type === 'pizza') fury(p.team, 35);
  else { p.buff = it.type; p.buffT = it.type === 'pepper' ? 6 : 7; }
}
// Vesuvius wakes up: a shock under a random spot near the ball throws players up and pops the ball
function quakeHit() {
  const cx = clamp(ball.x + rnd(-60, 60), 20, LEN - 20), cy = rnd(30, WID - 30);
  for (const p of players) if (hyp(p.x - cx, p.y - cy) < 70 && Math.random() < 0.7) knockDown(p, (p.x - cx) || 1, p.y - cy, 120, 'bulge', 170);
  if (!ball.owner && ball.z < 5) { ball.vz = 230; ball.z = 0.01; ball.vx += rnd(-60, 60); ball.vy += rnd(-40, 40); }
  const s = P(cx, cy); burst('quake', s.x, s.y); sfx('boom'); game.shake = Math.max(game.shake, 0.45); hitstop(0.05);
}
function updVespa(dt) {
  const v = game.vespa; v.t += dt; v.x += v.dir*VSPD*dt; v.y = clamp(v.y + Math.sin(v.t*5)*30*dt, 12, WID - 12);
  for (const p of players) if (p.state !== ST.FALL && p.state !== ST.STUN && hyp(p.x - v.x, (p.y - v.y)*1.3) < 18) {
    knockDown(p, v.dir, ((p.y - v.y) || rnd(-1, 1))/12, 230, 'bulge', 280);
    if (p.state === ST.FALL) { sfx('hit'); game.shake = Math.max(game.shake, 0.25); hitstop(0.05); }
  }
  if (!v.hitBall && !ball.owner && ball.z < 22 && hyp(ball.x - v.x, ball.y - v.y) < 16) {
    v.hitBall = true; ball.kick(v.dir, rnd(-0.4, 0.4), 360, 140, null, null); sfx('kick');
  }
  if (!v.drop && game.mode !== 'title' && (v.x - LEN/2)*v.dir > 0) { v.drop = true; spawnItem('pizza', v.x, v.y); }   // the delivery boy drops a pizza
  if (v.dir > 0 ? v.x > LEN + 50 : v.x < -50) game.vespa = null;
}
function updChaos(dt) {
  if (!chaosOn) { if (MODE === 11 && TH.critter && game.mode === 'play') { if (game.critter) updCritter(dt); else if ((game.critterT -= dt) <= 0) spawnCritter(); } return; }
  if (game.mode === 'play') {
    if (!game.x2 && game.time <= X2T) { game.x2 = true; game.announce = { text: 'ГОЛ = 2 ОЧКА!', col: '#ffd23a', t: 2 }; sfx('chaos'); }
    if (game.chaos) {
      const c = game.chaos; c.t -= dt;
      if (c.type === 'vespa' && !game.vespa && !c.second && c.t < CHAOS.vespa.dur - 3) { c.second = true; spawnVespa(); }
      if (c.type === 'quake') { game.shake = Math.max(game.shake, 0.12); game.quakeT -= dt; if (game.quakeT <= 0) { game.quakeT = rnd(0.9, 1.4); quakeHit(); } }
      if (c.t <= 0 && !game.vespa) { game.chaos = null; game.chaosT = rnd(12, 18); }
    } else if ((game.chaosT -= dt) <= 0) {
      const pool = CHAOS_KEYS.filter(k => k !== game.lastChaos);
      startChaos(pool[Math.floor(Math.random()*pool.length)]);
    }
    if ((game.itemT -= dt) <= 0) { game.itemT = rnd(7, 11); if (items.length < 2) spawnItem(); }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]; it.t -= dt;
    if (it.t <= 0) { items.splice(i, 1); continue; }
    const p = game.mode === 'play' && players.find(q => q.state <= ST.KICK && q.z < 8 && dist(q, it) < 11);
    if (p) { items.splice(i, 1); pickUp(p, it); }
  }
  if (game.vespa) updVespa(dt);
  updGags(dt);
  if (MODE === 11 && TH.critter && game.mode === 'play') {
    if (game.critter) updCritter(dt); else if ((game.critterT -= dt) <= 0) spawnCritter();
  } else if (game.critter) updCritter(dt);
  for (const p of players) { p.dingCd -= dt; if (p.buff && (p.buffT -= dt) <= 0) p.buff = null; }
}
// cosmetic only (runs on the guest too): exhaust, falling rocks, chili flames, espresso steam
function chaosFx(dt) {
  if (TH.bubbles && Math.random() < dt*14) spawn(cam.x + rnd(0, W), cam.y + H + 2, rnd(-6, 6), rnd(-50, -25), rnd(1.5, 3), Math.random() < 0.5 ? '#bfe8ff' : '#ffffff', Math.random() < 0.3 ? 2 : 1, -4);
  if (TH.leaves && Math.random() < dt*5) spawn(cam.x + rnd(0, W), cam.y - 2, rnd(10, 30), rnd(20, 40), rnd(2, 4), Math.random() < 0.5 ? '#6ad05a' : '#3a9a2a', 2, 0);
  if (TH.dust && Math.random() < dt*2) { const x = cam.x + rnd(0, W), y = cam.y + rnd(60, H); for (let k = 0; k < 8; k++) spawn(x + rnd(-6, 6), y, rnd(-30, 30), rnd(-40, -10), rnd(0.5, 1), '#d8a860', 2, 30); }
  const v = game.vespa;
  if (v && Math.random() < 0.7) { const q = P(v.x - v.dir*14, v.y, 4); spawn(q.x, q.y, -v.dir*rnd(20, 50), rnd(-20, -5), 0.4, Math.random() < 0.5 ? '#c8c8d0' : '#8a8a98', 2, -30); }
  if (chaosIs('quake') && Math.random() < dt*30) spawn(cam.x + rnd(0, W), cam.y - 4, rnd(-10, 10), rnd(60, 120), rnd(0.8, 1.4), Math.random() < 0.5 ? '#5a4a4a' : '#ff7a2a', Math.random() < 0.3 ? 3 : 2, 200);
  if (chaosIs('ice') && Math.random() < dt*25) spawn(cam.x + rnd(0, W), cam.y + rnd(40, H), 0, -6, 0.4, '#ffffff', 1, 0);   // ice glints
  for (const p of players) {
    if (p.buff === 'pepper' && hyp(p.vx, p.vy) > 40 && Math.random() < 0.8) { const q = P(p.x - p.fx*6, p.y, rnd(0, 6) + (p.z || 0));
      spawn(q.x + rnd(-2, 2), q.y, -p.fx*20, rnd(-30, -10), 0.3, ['#fff3a0', '#ffd23a', '#ff6a1a'][Math.floor(Math.random()*3)], 2, -40); }
    if (chaosIs('espresso') && Math.random() < dt*6) { const q = P(p.x, p.y, 42 + (p.z || 0)); spawn(q.x + rnd(-3, 3), q.y, rnd(-5, 5), -25, 0.6, '#e8e8f0', 2, -10); }
  }
}

// super shots, a nod to famous anime: running = tiger shot, standing = energy beam, overhead = spinning sphere,
// FURIA + tackle when they have the ball close by = a barrage of punches
const SUPERNAME = { tiger:'ТИГРИНЫЙ УДАР!', kame:'КАМЕХАМЕХА!', rasen:'РАСЕНГАН!', ora:'ОРА-ОРА-ОРА!' };
const SUPERSHORT = { tiger:'ТИГР', kame:'КАМЕ', rasen:'РАСЕН' };
// FURIA: each team fills one meter by playing; a full meter unlocks one super shot.
function fury(team, n) {
  if (team !== 0 && team !== 1 || game.mode !== 'play') return;
  if (n > 0 && cpuSide(team)) n *= D().fury;
  if (n > 0 && MODE === 11) n *= 0.35;   // 22 players make a lot more events: fill slower
  const was = game.fury[team]; game.fury[team] = clamp(was + n, 0, 100);
  if (was < 100 && game.fury[team] >= 100) {
    game.furyFlash[team] = 1.2;
    if (players.some(p => p.team === team && p.local)) { game.announce = { text: 'СУПЕР-САЙЯН!', col: '#ffe14a', t: 1.3 }; buzz(25); }
    sfx('ready');
  }
}
const furyReady = p => game.fury[p.team] >= 100;
// what the super would be right now (null = not allowed)
function superFor(p) {
  if (!furyReady(p)) return null;
  if (p.role === 'gk') return null;
  const moving = p.human ? !!(p.inp.mx || p.inp.my) : hyp(p.vx, p.vy) > 30;
  return moving ? 'tiger' : 'kame';
}
const aerial = p => !ball.owner && ball.z >= 9 && ball.z <= 46 && dist(p, ball) <= KREACH + 2;

function doKick(p) {
  if (!(ball.owner === p || (dist(p, ball) <= KREACH + (p.bike ? 4 : 0) + (giant() ? 12 : 0) && ball.z < (p.bike ? 50 : 30)))) return;
  let dx = p.fx, dy = p.fy;
  const gx = goalX(p.team), t = norm(gx-p.x, WID/2-p.y), tl = hyp(gx-p.x, WID/2-p.y);
  if (dx*t.x + dy*t.y > 0.3 && (tl < 280 || p.superType === 'kame')) {
    const lead = Math.abs(gx - p.x), ty = clamp(p.y + (Math.abs(dx) > 0.05 ? dy/Math.abs(dx) : 0)*lead, Y0+8, Y1-8);
    const n = norm(gx - p.x, ty - p.y); dx = n.x; dy = n.y;
  }
  shotKick(p, dx, dy);
}
function shotKick(p, dx, dy) {
  if (p.kickSuper) {
    game.fury[p.team] = 0;
    ball.kick(dx, dy, KPOW*1.45, KLIFT, p, p.superType); if (p.local) buzz(30);
    game.announce = { text: SUPERNAME[p.superType], col: p.superType === 'tiger' ? '#ff9a1a' : '#7fe0ff', t: 1.4 };
    sfx(p.superType); game.shake = Math.max(game.shake, 0.25); hitstop(0.1);
    const s = P(ball.x, ball.y, ball.z);
    burst('super', s.x, s.y);
  } else if (p.bike) { // volley without FURIA: hard, low, no magic
    ball.kick(dx, dy, KPOW*1.2, 40, p, null); sfx('kick'); game.shake = Math.max(game.shake, 0.12); fury(p.team, 6);
  } else if (p.strong) { // charged without FURIA: TIRO FORTE
    ball.kick(dx, dy, KPOW*1.22, KLIFT*0.7, p, null); sfx('kick'); game.shake = Math.max(game.shake, 0.1);
  } else { ball.kick(dx, dy, KPOW, KLIFT*rnd(0.5,1.2), p, null); sfx('kick'); }
  ball.shot = true;   // a shot, not a pass: the shooter's teammates won't trap it (see possession)
  if (game.miracle[p.team] > 0) { ball.miracle = true; game.miracle[p.team] = 0; }
  // curve: the stick held sideways to the shot when it leaves the foot bends it (AI adds a little random swerve)
  const sx = p.human ? p.inp.mx : rnd(-0.4, 0.4), sy = p.human ? p.inp.my : rnd(-0.4, 0.4);
  ball.curve = !p.kickSuper || p.superType === 'tiger' ? clamp(dx*sy - dy*sx, -1, 1)*170 : 0;
}
// an opponent standing in the lane between two points (a ground pass would be cut out)
function laneBlocked(p, tx, ty) {
  const dx = tx - p.x, dy = ty - p.y, l2 = dx*dx + dy*dy || 1;
  return players.some(q => { if (q.team === p.team || q.state > ST.RUN) return false;
    const u = ((q.x - p.x)*dx + (q.y - p.y)*dy)/l2; if (u < 0.12 || u > 0.92) return false;
    return hyp(p.x + dx*u - q.x, p.y + dy*u - q.y) < 15; });
}
const marked = m => players.some(q => q.team !== m.team && q.role !== 'gk' && dist(q, m) < 28);
// pass target for a human: the teammate closest to where the stick points (or where you face), open ones
// and clear lanes preferred; with nobody in that direction, the nearest teammate
function facingMate(p) {
  const ax = p.inp.mx || p.fx, ay = p.inp.my || p.fy, al = hyp(ax, ay) || 1;
  let best = null, bs = -99, near = null, nd = 1e9;
  for (const m of players) { if (m.team !== p.team || m === p || m.role === 'gk') continue;
    const dx = m.x - p.x, dy = m.y - p.y, d = hyp(dx, dy); if (d < 20 || d > 430) continue;
    if (d < nd) { nd = d; near = m; }
    const c = (dx*ax + dy*ay)/(d*al); if (c < 0.35) continue;   // a cone of about 70 degrees each side
    const sc = c*2 - d/350 - (marked(m) ? 0.6 : 0) - (laneBlocked(p, m.x, m.y) ? 0.5 : 0);
    if (sc > bs) { bs = sc; best = m; } }
  return best || near;
}
// Pass physics: aim where the receiver will be when the ball arrives. A ground pass is hit just hard
// enough to reach him at ~90 u/s against the grass friction; a long one, or one with an opponent in the
// lane, is lofted to drop at his feet. The receiver runs to the spot (AI) and the spot is marked.
const FRIC = 125;
function passPlan(p, m) {
  const o = { x: ball.x, y: ball.y, team: p.team };   // measured from the ball, it's a step in front of the passer
  let tx = m.x, ty = m.y, v0 = 150, vz = 12, T = 0.5, lob = false;
  for (let k = 0; k < 3; k++) {
    const d = Math.max(1, hyp(tx - o.x, ty - o.y));
    lob = d > 230 || laneBlocked(o, tx, ty);
    if (lob) { v0 = clamp(d*1.1, 160, 300); T = d/v0; vz = GRAV*gravK()*T/2; }
    else { v0 = Math.min(330, Math.sqrt(90*90 + 2*FRIC*d)); T = (v0 - Math.sqrt(Math.max(0, v0*v0 - 2*FRIC*d)))/FRIC; vz = 12; }
    tx = clamp(m.x + m.vx*T*0.8, 6, LEN - 6); ty = clamp(m.y + m.vy*T*0.8, 6, WID - 6);
  }
  return { tx, ty, v0, vz, lob };
}
function doPass(p) {
  const target = p.passTo || (MODE === 11 ? facingMate(p) : mateOf(p)); p.passTo = null;
  if (!target) { // 1 на 1: вместо паса — парашют через соперника
    const n = norm(goalX(p.team) - p.x, WID/2 - p.y); p.fx = n.x; p.fy = n.y; p.bike = p.strong = false;
    ball.kick(n.x, n.y, 200, 210, p, null); p.kickSuper = false; setState(p, ST.KICK); p.kickDone = true; sfx('pass'); return;
  }
  const m = target, pl = passPlan(p, m), n = norm(pl.tx - ball.x, pl.ty - ball.y);
  p.fx = n.x; p.fy = n.y; p.bike = p.strong = false;
  ball.kick(n.x, n.y, pl.v0, pl.vz, p, null); ball.passTo = m; ball.passAt = { x: pl.tx, y: pl.ty };
  p.kickSuper = false; setState(p, ST.KICK); p.kickDone = true; sfx('pass');
  if (p.local && NET.role === 'solo' && !meLocked()) { setHuman(m); game.ctrlCd = 0.6; }
}

function updPlayer(p, dt) {
  p.st += dt;
  const surf = surfaceAt(p.x, p.y);
  p.sm = surf === 'mud' ? 0.58 : surf === 'puddle' ? 0.85 : 1;
  p.tr = surf === 'puddle' ? 0.16 : surf === 'mud' ? 0.8 : 1;
  p.tr *= ph('traction');
  if (chaosIs('ice')) p.tr = Math.min(p.tr, 0.13);
  if (pees.some(q => hyp(q.x - p.x, (q.y - p.y)*1.4) < 9)) p.tr = Math.min(p.tr, 0.18);   // slippery
  const turbo = (chaosIs('espresso') ? 1.5 : 1)*(p.buff === 'pepper' ? 1.4 : 1)*(p.cycle > 0 ? 1.5 : 1)*(p.buff === 'feint' ? 1.3 : 1);
  const i = p.inp;
  p.peeT -= dt; p.poopT -= dt; p.ghost -= dt; p.cycle -= dt; p.scareCd -= dt;
  if (p.freeze && (p.freeze.t -= dt) <= 0) p.freeze = null;
  if (p.fear && (p.fear.t -= dt) <= 0) p.fear = null;
  if (p.freeze) { i.mx = i.my = 0; i.kickReleased = i.tacklePressed = i.kickHeld = false; }
  else if (p.fear) { i.mx = p.fear.dx; i.my = p.fear.dy; i.kickReleased = i.tacklePressed = false; i.sprint = true; }
  if (game.mode === 'goal') { i.mx = i.my = 0; i.kickReleased = i.tacklePressed = false; i.kickHeld = false; }
  switch (p.state) {
    case ST.IDLE: case ST.RUN: {
      const aiSp = p.role === 'gk' ? 1 : p.team ? (cpuSide(1) ? D().speed : DIFFS[1].speed) : 0.93;
      // sprint: ×1.35 (×1.22 with the ball) for about 2.5 s of stamina; run dry and you must catch your breath
      const want = i.sprint && (i.mx || i.my) && !p.tired && p.stam > 0;
      if (want) { p.stam = Math.max(0, p.stam - dt*0.4); if (p.stam <= 0) p.tired = true; }
      else { p.stam = Math.min(1, p.stam + dt*(p.tired ? 0.18 : 0.25)); if (p.tired && p.stam > 0.35) p.tired = false; }
      p.sprinting = want;
      const spr = want ? (ball.owner === p ? 1.22 : 1.35) : 1;
      const sp = MAXSP * p.sm * turbo * spr * ph('speed') * (p.human ? 1 : aiSp) * (ball.owner === p ? 0.9 : 1);
      approach(p, i.mx*sp, i.my*sp, (p.human ? ACCH : ACC)*p.tr*turbo*(want ? 1.2 : 1)*dt);
      if (p.buff === 'pepper' && hyp(p.vx, p.vy) > 70) for (const q of players)   // chili: run people over
        if (q.team !== p.team && q.state <= ST.KICK && dist(p, q) < 14) { knockDown(q, p.vx, p.vy, 200, 'bulge', 120);
          if (q.state === ST.FALL) { sfx('hit'); hitstop(0.05); game.shake = Math.max(game.shake, 0.15); fury(p.team, 8); } }
      if (i.mx || i.my) { const l = hyp(i.mx, i.my); p.fx = i.mx/l; p.fy = i.my/l; }   // facing is always a unit vector (analog stick)
      setState(p, hyp(p.vx, p.vy) > 4 ? ST.RUN : ST.IDLE);
      if (i.kickHeld) p.charge += dt;
      if (i.kickReleased) {
        const charged = p.charge >= CHARGE, sup = superFor(p);
        p.bike = aerial(p);                                   // ball in the air at your head → overhead kick
        p.superType = p.bike ? (furyReady(p) && p.role !== 'gk' ? 'rasen' : null) : (charged ? sup : null);
        p.kickSuper = !!p.superType; p.strong = charged && !p.kickSuper;
        p.charge = 0; setState(p, ST.KICK);
      }
      else if (i.tacklePressed) {
        p.charge = 0;
        if (ball.owner === p) doPass(p);
        else {
          const ow = ball.owner, ora = furyReady(p) && p.role !== 'gk' && ow && ow.team !== p.team && dist(p, ow) < 70 && (p.human || p.oraOk);
          const ts = TSPD*(chaosIs('espresso') ? 1.25 : 1)*(ora ? 1.6 : 1); p.vx = p.fx*ts; p.vy = p.fy*ts; setState(p, ST.TACKLE); sfx('tackle');
          if (ora) { p.ora = true; game.fury[p.team] = 0; game.announce = { text: SUPERNAME.ora, col: '#ffe14a', t: 1.4 }; sfx('ora'); hitstop(0.08); }
        }
        p.oraOk = false;
      }
      break; }
    case ST.KICK:
      approach(p, 0, 0, ACC*p.tr*dt);
      if (!p.kickDone && p.st >= KCONTACT) { p.kickDone = true; doKick(p); }
      if (p.st >= KTIME) setState(p, ST.IDLE);
      break;
    case ST.TACKLE:
      approach(p, 0, 0, TSPD*(p.ora ? 0.7 : 1.5)*p.tr*dt);
      if (p.ora && Math.random() < 0.5) { const q = P(p.x + p.fx*14 + rnd(-8, 8), p.y + rnd(-6, 6), rnd(8, 30)); burst('ora', q.x, q.y); }
      for (const q of players) {
        if (q === p || p.hit.has(q) || q.state === ST.FALL || q.state === ST.STUN) continue;
        if (dist(p, q) < (p.ora ? 26 : 16)) { p.hit.add(q); const had = ball.owner === q;
          knockDown(q, p.fx, p.fy, p.ora ? 220 : 165, p.ora ? 'bulge' : 'cry', p.ora ? 190 : 0); fury(p.team, q.team !== p.team ? 18 : 0); sfx('hit'); buzz(q.local ? 40 : 15); game.shake = Math.max(game.shake, 0.12); hitstop(0.08);
          if (had) { ball.kick(p.fx, p.fy, 140, 30, p, null); p.tBall = true; } }
      }
      if (!p.tBall && !ball.owner && ball.z < 10 && dist(p, ball) < 16) { p.tBall = true; ball.kick(p.fx, p.fy, hyp(p.vx,p.vy)*1.2+60, 0, p, null); sfx('kick'); }
      if (p.st >= (p.ora ? 0.65 : TTIME)) setState(p, ST.IDLE);
      break;
    case ST.DIVE:   // keeper dive: fly sideways, grab or punch the ball on contact, then lie down for a moment
      if ((p.st > 0.45 && p.z <= 0) || p.saved) approach(p, 0, 0, 600*dt);
      if (!p.saved && !ball.owner && ball.z < 36 && dist(p, ball) < 15) keeperSave(p);
      if (p.st >= 0.95 && p.z <= 0) setState(p, ST.IDLE);
      break;
    case ST.FALL: if (p.z <= 0) approach(p, 0, 0, 280*p.tr*dt); if (p.st >= FALLT && p.z <= 0) setState(p, ST.IDLE); break;
    case ST.STUN: p.vx = p.vy = 0; if (p.st >= STUNT) setState(p, ST.IDLE); break;
  }
  // a player blown into the goal mouth may end up in the net; otherwise stay on the pitch (walk out smoothly)
  const inNet = p.state === ST.FALL && p.y > Y0 && p.y < Y1;
  p.x = clamp(p.x + p.vx*dt, inNet ? -GD + 6 : -GD, inNet ? LEN + GD - 6 : LEN + GD); p.y = clamp(p.y + p.vy*dt, 4, WID-4);
  if (!inNet && (p.x < 4 || p.x > LEN - 4)) p.x += (clamp(p.x, 4, LEN - 4) - p.x)*Math.min(1, dt*8);
  if (p.z > 0 || p.vz > 0) {   // flying after a big hit
    p.vz -= GRAV*gravK()*dt; p.z += p.vz*dt;
    if (p.z <= 0) { p.z = 0; if (p.vz < -160) { p.vz = -p.vz*0.3; const s = P(p.x, p.y); burst('dust', s.x, s.y); sfx('bounce'); } else p.vz = 0; }
  }
  const spd = hyp(p.vx, p.vy), prevStep = Math.floor(p.anim/20);
  p.anim += spd*dt;
  if ((p.state === ST.RUN && spd > 50 && Math.floor(p.anim/20) !== prevStep) || (p.state === ST.TACKLE && Math.random() < 0.6)) {
    const q = P(p.x - p.fx*6, p.y);
    if (surf === 'puddle') for (let k = 0; k < 3; k++) spawn(q.x+rnd(-4,4), q.y-1, rnd(-30,30), rnd(-70,-30), 0.35, k ? '#a6e4e6' : '#ffffff', 2, 300);
    else if (surf === 'mud') spawn(q.x+rnd(-3,3), q.y-1, rnd(-20,20), rnd(-40,-15), 0.35, '#5c4a26', 2, 200);
    else if (p.state === ST.TACKLE) spawn(q.x+rnd(-3,3), q.y-1, rnd(-25,25), rnd(-50,-20), 0.35, Math.random()<0.5 ? '#2a8a2a' : '#7ae070', 2, 260);
    else { spawn(q.x-2, q.y-2, -p.fx*12, -8, 0.3, '#e8f4e0', 2, 0); spawn(q.x+1, q.y-3, -p.fx*8, -12, 0.25, '#c8dcc0', 1, 0);
      if (p.sprinting) for (let k = 0; k < 3; k++) spawn(q.x + rnd(-3, 3), q.y - 2, -p.fx*rnd(20, 45), rnd(-20, -6), 0.35, '#ffffff', 2, 40); }
  }
  i.kickReleased = false; i.tacklePressed = false;
}

function updBall(dt) {
  const b = ball; b.lockT -= dt; b.shotT += dt;
  if (b.owner) {
    const o = b.owner;
    if (o.state > ST.KICK && o.state !== ST.DIVE) b.owner = null;
    else { const k = Math.min(1, dt*20);
      b.x += (o.x + o.fx*(giant() ? 20 : o.sprinting ? 13 : 9) - b.x)*k;   // sprinting pushes the ball further ahead b.y += (o.y + o.fy*5 + 1 - b.y)*k; b.vx = o.vx; b.vy = o.vy; b.z = 0; b.vz = 0;
      b.rot += hyp(o.vx, o.vy)*dt; return; }
  }
  const surf = surfaceAt(b.x, b.y); b.drag = (surf === 'puddle' ? 5 : surf === 'mud' ? 2.5 : 1)*(chaosIs('ice') ? 0.35 : 1);
  if (b.z > 0 || b.vz > 0) {
    b.vz -= GRAV*b.gs*gravK()*dt; b.z += b.vz*dt;
    if (TH.phys.air && !b.superType) { const k = 1 - TH.phys.air*dt; b.vx *= k; b.vy *= k; }   // water slows the ball down
    if (!b.superType) { b.vx += game.wind.x*dt; b.vy += game.wind.y*dt; }
    if (b.z <= 0) land();
  } else {
    const s = hyp(b.vx, b.vy);
    if (s > 0) { const ns = Math.max(0, s - 125*b.drag*ph('fric')*dt); b.vx *= ns/s; b.vy *= ns/s; }
    b.vx += game.wind.x*0.2*dt; b.vy += game.wind.y*0.2*dt;
  }
  if (b.home && !b.owner) {   // 'football is coming home': the ball rolls itself toward their goal
    if ((b.home.t -= dt) <= 0) b.home = null;
    else { const n = norm(goalX(b.home.team) - b.x, WID/2 - b.y), k = Math.min(1, dt*3); b.vx += (n.x*240 - b.vx)*k; b.vy += (n.y*240 - b.vy)*k; if (b.z <= 0) b.vz = 0; }
  }
  if (b.miracle && !b.owner) { const q = P(b.x, b.y, b.z + 5); spawn(q.x + rnd(-4, 4), q.y + rnd(-4, 4), rnd(-10, 10), rnd(-20, 0), 0.4, Math.random() < 0.5 ? '#ffe14a' : '#ffffff', 2, 0); }
  if (b.curve && !b.owner) {   // side force across the flight, fading out
    const v = hyp(b.vx, b.vy); if (v > 60) { b.vx += -b.vy/v*b.curve*dt; b.vy += b.vx/v*b.curve*dt; }
    b.curve *= Math.max(0, 1 - 1.4*dt); if (Math.abs(b.curve) < 5) b.curve = 0;
  }
  b.x += b.vx*dt; b.y += b.vy*dt; b.rot += hyp(b.vx, b.vy)*dt;
  if (b.beam) { b.beam.t -= dt; if (b.beam.t <= 0) b.beam = null; }
  if (b.superType === 'kame' && hyp(b.vx, b.vy) < 120) { b.superType = null; b.gs = 1; }
  if (b.superType === 'rasen') { b.wt = (b.wt || 0) + dt; b.y += Math.cos(b.wt*15)*150*dt; }  // the spinning sphere zigzags across the box
  else if (hyp(b.vx, b.vy) > 290 && !b.owner) { const q = P(b.x, b.y, b.z + 5); spawn(q.x - b.vx*0.02, q.y, -b.vx*0.1, 0, 0.12, '#ffffff', 1, 0); }  // speed streak
  if (b.superType && b.z <= 0 && b.vz <= 0 && hyp(b.vx, b.vy) < 70) { b.superType = null; b.gs = 1; }

  if (b.y < 2) { b.y = 2; b.vy = Math.abs(b.vy)*0.6; }
  if (b.y > WID-2) { b.y = WID-2; b.vy = -Math.abs(b.vy)*0.6; }
  const mouth = b.y > Y0 && b.y < Y1;
  const endBounce = (x, sign) => { b.x = x; b.vx = sign*Math.abs(b.vx)*0.35; b.vy *= 0.6; b.superType = null; b.gs = 1; sfx('bounce'); };
  if (game.mode === 'goal') {
    if (b.x < -GD+4) { b.x = -GD+4; b.vx = 0; } if (b.x > LEN+GD-4) { b.x = LEN+GD-4; b.vx = 0; }
    if (b.x < 0 || b.x > LEN) { b.vx *= 0.9; b.vy *= 0.9; b.y = clamp(b.y, Y0+3, Y1-3); if (b.z > GH-4) { b.z = GH-4; b.vz = Math.min(0, b.vz); } }
  } else if (game.mode === 'title') {
    if (b.x < 0) endBounce(0, 1); else if (b.x > LEN) endBounce(LEN, -1);
  } else {
    // the frame of the goal: posts at Y0 / Y1 and the crossbar at GH send the ball back with a ring
    const post = Math.min(Math.abs(b.y - Y0), Math.abs(b.y - Y1)) < 3.5 && b.z < GH + 2, bar = mouth && Math.abs(b.z - GH) < 3.5;
    if ((b.x < 0 || b.x > LEN) && (post || bar) && !b.superType) {
      const side = b.x < 0 ? 1 : -1; b.x = b.x < 0 ? 1 : LEN - 1;
      b.vx = side*Math.abs(b.vx)*0.55; if (post) b.vy = (b.y < WID/2 ? -1 : 1)*Math.abs(b.vy)*0.6 + rnd(-40, 40); if (bar) { b.vz = -Math.abs(b.vz)*0.4 - 40; b.z = GH - 4; }
      sfx('post'); game.shake = Math.max(game.shake, 0.15); say('ДЗЫНЬ!', b.x, b.y);
    }
    else if (b.x < 0) { if (mouth && b.z < GH) scored(1 ^ game.flip); else endBounce(0, 1); }
    else if (b.x > LEN) { if (mouth && b.z < GH) scored(game.flip); else { endBounce(LEN, -1); if (b.last && b.last.team === game.flip && Math.random() < 0.6) emote(nearestRival(b), Math.random() < 0.5 ? 'laugh' : 'zzz'); } }
  }
  if (b.superType) {
    superFx(b);
    for (const p of players) {
      if (p === b.last || p.state === ST.FALL || p.state === ST.STUN) continue;
      if (dist(p, b) < 14 && b.z < 36) { knockDown(p, b.vx, b.vy, 190, 'bulge', 120); b.vx *= 0.88; b.vy *= 0.88; sfx('hit'); game.shake = Math.max(game.shake, 0.3); hitstop(0.12); }
    }
  }
  if (giant() && !b.owner && hyp(b.vx, b.vy) > 150 && b.z < 34) for (const p of players) {   // the giant ball bowls people over
    if ((p === b.last && b.lockT > 0) || p.state === ST.FALL || p.state === ST.STUN) continue;
    if (dist(p, b) < 20) { knockDown(p, b.vx, b.vy, 200, 'bulge', 140); if (p.state === ST.FALL) { b.vx *= 0.8; b.vy *= 0.8; sfx('hit'); game.shake = Math.max(game.shake, 0.25); hitstop(0.06); } }
  }
}
// trail of each super (host and guest)
function superFx(b) {
  const s = P(b.x, b.y, b.z + 5), t = b.superType;
  if (t === 'tiger') for (let k = 0; k < 4; k++) spawn(s.x+rnd(-4,4), s.y+rnd(-4,4), -b.vx*0.18+rnd(-15,15), -b.vy*0.1+rnd(-25,5), rnd(0.2,0.45), ['#ffd23a','#ff9a1a','#100810','#ff9a1a'][k], 3, 0);
  else if (t === 'rasen') for (let k = 0; k < 4; k++) { const a = game.t*30 + k*Math.PI/2; spawn(s.x + Math.cos(a)*8, s.y + Math.sin(a)*4, -b.vx*0.08, -b.vy*0.05, rnd(0.2,0.4), ['#ffffff','#8fe0ff','#4ab8ff','#2a74c4'][k], 2, 0); }
  else if (t === 'kame') for (let k = 0; k < 3; k++) spawn(s.x+rnd(-3,3), s.y+rnd(-3,3), rnd(-20,20), rnd(-20,20), rnd(0.2,0.35), ['#ffffff','#8fe0ff','#4ab8ff'][k], 3, 0);
}
function land() {
  const b = ball; b.z = 0;
  if (b.vz < -90/Math.max(0.6, ph('bounce'))) { b.vz = -b.vz*Math.min(0.85, 0.45*ph('bounce')); b.vx *= 0.85; b.vy *= 0.85; sfx('bounce'); } else b.vz = 0;
}
function possession(dt) {
  const b = ball;
  if (b.owner) fury(b.owner.team, dt*4);
  if (!b.owner && !b.superType && b.z < 34) {
    let best = null, bd = 99;
    // your own shot flies past your teammates: for a second after the kick, and after that while it's still quick
    const shot = b.shot && b.last && (b.shotT < 1 || hyp(b.vx, b.vy) > 100);
    for (const p of players) { if (p.state > ST.RUN || p.freeze || (b.lock === p && b.lockT > 0)) continue;
      if (shot && p.team === b.last.team) continue;
      const gk = p.role === 'gk', meant = b.passTo === p;   // the player a pass is meant for reaches a bit further and higher
      const reach = gk ? 15 : REACH*(giant() ? 1.9 : 1)*(meant ? 1.6 : 1);
      if (b.z >= (gk ? 34 : giant() ? 22 : meant ? 16 : 10)) continue;   // keepers use their hands
      const d = dist(p, b); if (d < reach && d < bd) { bd = d; best = p; } }
    if (best && best.role === 'gk' && hyp(b.vx, b.vy) > 230 && b.last && b.last.team !== best.team) keeperSave(best);
    else if (best) { if (b.last && b.last !== best && b.last.team === best.team) fury(best.team, 10); // pass received
      b.owner = best; best.holdT = 0; b.passTo = null; b.passAt = null; b.home = null; }
  } else if (b.owner) {
    for (const p of players) {
      if (p.team === b.owner.team || p.state > ST.RUN || p.freeze || b.owner.buff === 'horn' || b.owner.buff === 'feint' || b.owner.ghost > 0 || b.owner.role === 'gk') continue;
      if (dist(p, b) < 9 && Math.random() < dt*(p.team === 1 ? (cpuSide(1) ? D().steal : 0.6) : 1.6)*(b.owner.sprinting ? 1.5 : 1)) { const prev = b.owner; b.owner = p; b.lock = prev; b.lockT = 0.5; fury(p.team, 12); if (p.team === 1 && Math.random() < 0.7) emote(p, 'tongue'); break; }
    }
  }
}
function separate() {
  for (let i = 0; i < players.length; i++) for (let j = i+1; j < players.length; j++) {
    const a = players[i], c = players[j], d = dist(a, c);
    if (a.z > 4 || c.z > 4) continue;
    if (d > 0 && d < 12) { const k = (12-d)/2, nx = (c.x-a.x)/d, ny = (c.y-a.y)/d; a.x -= nx*k; a.y -= ny*k; c.x += nx*k; c.y += ny*k; }
  }
}

// ================== AI ==================
function ai(p, dt) {
  if (p.role === 'gk') return aiKeeper(p, dt);
  if (MODE === 11) return aiReal(p, dt);
  aiArcade(p, dt);
}
// AI difficulty numbers for this player's side (your teammates play like before)
const skillOf = p => p.team === 1 ? (cpuSide(1) ? D() : DIFFS[1]) : null;
function steer(p, tx, ty, dt) {
  const i = p.inp, b = ball, Dd = skillOf(p);
  if (b.owner !== p && items.length) {   // grab a pickup on the way when the ball is not right here
    const it = items.reduce((a, q) => dist(p, q) < dist(p, a) ? q : a);
    if (dist(p, it) < (Dd ? 45 : 65) && dist(p, b) > 30) { tx = it.x; ty = it.y; }
  }
  const dx = tx-p.x, dy = ty-p.y, l = hyp(dx, dy);
  let wx = 0, wy = 0; if (l >= 5) { wx = dx/l; wy = dy/l; }
  if (Dd) { const k = Math.min(1, dt*Dd.turn); i.mx += (wx - i.mx)*k; i.my += (wy - i.my)*k; }   // the rival turns lazily (less on hard levels)
  else { i.mx = wx; i.my = wy; }
}
// shoot at the corner away from the keeper
function shootAt(p, spread) {
  const gx = goalX(p.team), k = keeperOf(1 - p.team), side = k ? (k.y < WID/2 ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1);
  const a = norm(gx - p.x, WID/2 + side*rnd(12, 32) + rnd(-spread, spread)*0.5 - p.y); p.fx = a.x; p.fy = a.y;
}
function bestPassTarget(p) {
  const dir = dirOf(p.team); let best = null, bs = -0.5;
  for (const m of players) { if (m.team !== p.team || m === p || m.role === 'gk') continue;
    const d = dist(p, m); if (d < 40 || d > 340) continue;
    const press = players.some(q => q.team !== p.team && dist(q, m) < 30) ? 2 : 0;
    const sc = dir*(m.x - p.x)/100 - press - d/400 + (m.human ? 0.8 : 0) - (laneBlocked(p, m.x, m.y) ? 0.6 : 0); if (sc > bs) { bs = sc; best = m; } }
  return best;
}
function aiKeeper(p, dt) {
  const i = p.inp, b = ball, own = ownX(p.team), dir = own === 0 ? 1 : -1, K = keeperSkill(p);
  i.kickHeld = false; i.mx = i.my = 0;
  if (p.state > ST.RUN || p.freeze || b.miracle) return;   // frozen, or a blessed shot: he just watches
  if (b.owner === p) {   // hold it a moment, then throw it to a free teammate or punt it long
    p.holdT += dt;
    if (p.holdT > 0.9) { p.holdT = 0; const m = bestPassTarget(p);
      if (m && Math.random() < 0.6) { p.passTo = m; i.tacklePressed = true; }
      else { p.fx = dir; p.fy = rnd(-0.4, 0.4); p.charge = CHARGE; i.kickReleased = true; } }
    return;
  }
  const lineX = own + dir*8;
  let tx = own + dir*(Math.abs(b.x - own) < 130 ? 14 : 8), ty = clamp(WID/2 + (b.y - WID/2)*0.65, Y0 + 4, Y1 - 4);
  if (!b.owner && b.vx*dir < -110) {   // a shot is coming: read it, then step across or dive
    const t = (lineX - b.x)/b.vx;
    if (p.react === 0) p.guess = rnd(-K.err, K.err);   // how well this keeper reads the shot
    const yi = b.y + b.vy*t + p.guess;
    if (t > 0 && t < 1.1 && yi > Y0 - 16 && yi < Y1 + 16) {
      p.react += dt;
      if (p.react >= K.react) {
        if (Math.abs(yi - p.y) > 9 && t < 0.6) { dive(p, lineX - p.x, yi - p.y, K.dive, t); return; }
        tx = lineX; ty = yi;
      }
    }
  } else p.react = 0;
  // a loose ball in our box: come and claim it
  if (!b.owner && Math.abs(b.x - own) < 70 && b.y > Y0 - 40 && b.y < Y1 + 40 && b.z < 20 && hyp(b.vx, b.vy) < 160) { tx = b.x; ty = b.y; }
  const dx = tx - p.x, dy = ty - p.y, l = hyp(dx, dy);
  if (l > 3) { i.mx = dx/l*Math.min(1, l/12); i.my = dy/l*Math.min(1, l/12); }
}
// 11 on 11: the one or two players nearest to the ball go for it, the rest keep the 4-4-2 shape
function computeChasers() {
  for (const t of [0, 1]) game.chasers[t] = players.filter(q => q.team === t && q.role !== 'gk' && q.state <= ST.KICK)
    .map(q => [q, reachTime(q)]).sort((a, c) => a[1] - c[1]).slice(0, 2).map(e => e[0]);
}
function aiReal(p, dt) {
  const i = p.inp, b = ball, Dd = skillOf(p) || { tackle: 5, cd: 1.3, tackleR: 22, spread: 28, lead: 0.25, loose: 8 };
  i.kickHeld = false; p.aiCd -= dt;
  if (p.state > ST.RUN) { i.mx = i.my = 0; return; }
  const gx = goalX(p.team), gy = WID/2, dir = dirOf(p.team);
  if (b.owner === p) {
    const dg = hyp(gx - p.x, gy - p.y), opps = players.filter(q => q.team !== p.team && q.role !== 'gk');
    if (dg < 175 || (dg < 260 && Math.random() < dt*0.6)) {
      shootAt(p, Dd.spread);
      if (furyReady(p) ? Math.random() < 0.6 : Math.random() < 0.3) p.charge = CHARGE;
      i.mx = i.my = 0; i.kickReleased = true; return;
    }
    const near = opps.reduce((x, q) => dist(q, p) < dist(x, p) ? q : x);
    const pressed = dist(near, p) < 36 && Math.sign(near.x - p.x) === dir;
    if (pressed && Math.random() < dt*3) { const m = bestPassTarget(p); if (m) { p.passTo = m; i.tacklePressed = true; return; } }
    const hm = players.find(q => q.team === p.team && q.human && q !== p);   // play your human teammate in when he's free
    if (hm && !marked(hm) && dir*(hm.x - p.x) > -60 && dist(p, hm) < 330 && !laneBlocked(p, hm.x, hm.y) && Math.random() < dt*1.4) { p.passTo = hm; i.tacklePressed = true; return; }
    let ty = gy; if (dist(near, p) < 44 && pressed) ty = p.y + (p.y < near.y ? -70 : 70);
    return steer(p, gx, clamp(ty, 15, WID - 15), dt);
  }
  if (b.passTo === p && !b.owner && b.passAt) return steer(p, b.passAt.x, b.passAt.y, dt);   // meet the pass
  const rank = game.chasers[p.team].indexOf(p), theyHave = b.owner && b.owner.team !== p.team, weHave = b.owner && b.owner.team === p.team;
  if (rank === 0 || (rank === 1 && theyHave)) {
    const ow = b.owner;
    if (ow && ow.team !== p.team && dist(p, ow) < Dd.tackleR && p.aiCd <= 0 && Math.random() < dt*Dd.tackle) {
      const a = norm(ow.x - p.x, ow.y - p.y); p.fx = a.x; p.fy = a.y; p.oraOk = Math.random() < 0.5; i.tacklePressed = true; p.aiCd = Dd.cd; return;
    }
    if (!ow && dist(p, b) < 18 && b.z < 46 && Math.random() < dt*Dd.loose) { shootAt(p, Dd.spread*2); i.mx = i.my = 0; i.kickReleased = true; return; }
    return steer(p, b.x + b.vx*Dd.lead, b.y + b.vy*Dd.lead, dt);
  }
  // formation: slide with the ball, push up when we have it, drop when they do
  const h = p.home, bf = dir > 0 ? b.x/LEN : 1 - b.x/LEN;
  const fx = clamp(h.x + (weHave ? 0.12 : theyHave ? -0.05 : 0) + (bf - 0.5)*0.45 + (p.role === 'att' && weHave ? 0.08 : 0), 0.06, 0.94);
  const tx = dir > 0 ? fx*LEN : (1 - fx)*LEN, ty = clamp(h.y*WID + (b.y - WID/2)*0.3, 15, WID - 15);
  steer(p, tx, ty, dt);
}
function aiArcade(p, dt) {
  const i = p.inp; i.kickHeld = false; p.aiCd -= dt;
  if (p.state > ST.RUN) { i.mx = i.my = 0; return; }
  const b = ball, gx = goalX(p.team), gy = WID/2, ox = ownX(p.team), m = mateOf(p) || p, rival = p.team === 1, Dd = skillOf(p) || DIFFS[1];
  if (b.passTo === p && !b.owner && b.passAt) return steer(p, b.passAt.x, b.passAt.y, dt);   // meet the pass
  const opps = players.filter(q => q.team !== p.team);
  let tx = p.x, ty = p.y;
  if (b.owner === p) {
    const dg = hyp(gx-p.x, gy-p.y);
    if (dg < 170 || (dg < 250 && Math.random() < dt*0.5)) {
      shootAt(p, rival ? Dd.spread : 28);
      if (furyReady(p) ? Math.random() < (rival ? 0.45 : 0.7) : Math.random() < 0.25) p.charge = CHARGE;
      i.mx = i.my = 0; i.kickReleased = true; return;
    }
    const near = opps.reduce((x, q) => dist(q,p) < dist(x,p) ? q : x);
    if (Math.abs(m.x-gx) + 40 < Math.abs(p.x-gx) && dist(near,p) < 34 && Math.random() < dt*1.2) { i.tacklePressed = true; return; }
    // the computer teammate gives it to you when you're free and not behind him
    if (m.human && m !== p && !marked(m) && Math.abs(m.x-gx) < Math.abs(p.x-gx) + 60 && !laneBlocked(p, m.x, m.y) && Math.random() < dt*1.4) { i.tacklePressed = true; return; }
    tx = gx; ty = gy;
    if (dist(near, p) < 44 && Math.sign(near.x-p.x) === Math.sign(gx-p.x)) ty = p.y + (p.y < near.y ? -60 : 60);
  } else {
    const myD = dist(p, b), mateD = dist(m, b), nearOwn = Math.abs(b.x-ox) < LEN*0.42;
    const chase = p.role === 'att' ? (myD < mateD + 50 || !b.owner || b.owner.team !== p.team)
                                   : (nearOwn && (myD <= mateD || !b.owner || b.owner.team !== p.team));
    if (b.owner && b.owner.team === p.team) {
      tx = p.role === 'att' ? gx + (ox-gx)*0.28 : ox + (gx-ox)*0.22; ty = gy + (p.role === 'att' ? (b.y < gy ? 50 : -50) : 0);
    } else if (chase) {
      const lead = rival ? Dd.lead : 0.25; tx = b.x + b.vx*lead; ty = b.y + b.vy*lead;
      const ow = b.owner;
      if (ow && ow.team !== p.team && dist(p, ow) < (rival ? Dd.tackleR : 22) && p.aiCd <= 0 && Math.random() < dt*(rival ? Dd.tackle : 5)) {
        const a = norm(ow.x-p.x, ow.y-p.y); p.fx = a.x; p.fy = a.y; p.oraOk = Math.random() < 0.5; i.tacklePressed = true; p.aiCd = rival ? Dd.cd : 1.3; return;
      }
      if (!ow && myD < 18 && b.z < 46 && Math.random() < dt*(rival ? Dd.loose : 8)) {
        const a = norm(gx-p.x, gy-p.y); p.fx = a.x; p.fy = a.y; i.mx = i.my = 0; i.kickReleased = true; return;
      }
    } else {
      tx = ox + (b.x-ox)*0.2 + (ox === 0 ? 18 : -18); ty = clamp(gy + (b.y-gy)*0.6, Y0-10, Y1+10);
    }
  }
  steer(p, tx, ty, dt);
}

// ================== human input ==================
const keys = new Set(); let touchStick = null, touchKick = false, touchTackle = false, prevKick = false, prevTackle = false;
addEventListener('keydown', e => { audioInit(); if (e.target && e.target.tagName === 'INPUT') return; const k = e.key.toLowerCase(); keys.add(k);
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); touchKick = touchTackle = false; touchStick = null; });
function readStick() {
  let x = 0, y = 0;
  if (keys.has('arrowleft') || keys.has('a')) x -= 1; if (keys.has('arrowright') || keys.has('d')) x += 1;
  if (keys.has('arrowup') || keys.has('w')) y -= 1; if (keys.has('arrowdown') || keys.has('s')) y += 1;
  if (!x && !y && touchStick) {   // touch: analog, full speed from half deflection, small dead zone
    const l = hyp(touchStick.x, touchStick.y); if (l < 0.16) return null;
    const k = Math.min(1, l/0.5)/l; return { x: touchStick.x*k, y: touchStick.y*k };
  }
  if (hyp(x, y) < 0.3) return null;
  const a = Math.round(Math.atan2(y, x)/(Math.PI/4))*(Math.PI/4);
  return { x: Math.cos(a), y: Math.sin(a) };
}
function humanInput() {
  const p = players.find(q => q.local); if (!p) return;
  const s = readStick(), i = p.inp;
  i.mx = s ? s.x : 0; i.my = s ? s.y : 0;
  if (!s && ball.passTo === p && !ball.owner && ball.passAt) {   // a pass is coming and you're not steering: step to it
    const dx = ball.passAt.x - p.x, dy = ball.passAt.y - p.y, l = hyp(dx, dy); if (l > 5) { i.mx = dx/l; i.my = dy/l; } }
  i.sprint = keys.has('shift') || keys.has('u') || touchSprint;
  const k = keys.has('j') || keys.has(' ') || keys.has('z') || touchKick;
  const t = keys.has('k') || keys.has('x') || touchTackle;
  i.kickHeld = k; if (prevKick && !k) i.kickReleased = true; if (t && !prevTackle) i.tacklePressed = true;
  prevKick = k; prevTackle = t;
  const sk = keys.has('i') || touchSkill;
  if (sk && !prevSkill) humanSkill(p);
  prevSkill = sk;
  const sw = keys.has('l') || keys.has('c') || touchSwitch;
  if (sw && !prevSwitch && !(ball.owner && ball.owner.team === 0)) game.wantSwitch = true;
  prevSwitch = sw;
}
let touchSwitch = false, prevSwitch = false, touchSprint = false, touchSkill = false, prevSkill = false;
function setHuman(p) {
  for (const q of players) if (q.team === 0) {
    if (q.human && q !== p) { q.charge = 0; q.inp.mx = q.inp.my = 0; }
    if (!q.human && q === p) game.switchFlash = 0.45;
    q.human = q.local = q === p; q.tag = q === p ? 1 : 0;
  }
}
// time for a player to reach the ball, using where the ball will be by then
function reachTime(p) {
  let t = dist(p, ball)/MAXSP;
  for (let k = 0; k < 3; k++) { const bx = ball.x + ball.vx*t*0.7, by = ball.y + ball.vy*t*0.7; t = hyp(bx-p.x, by-p.y)/MAXSP; }
  if (p.state === ST.FALL || p.state === ST.STUN) t += 1;
  if (p.state === ST.KICK || p.state === ST.TACKLE) t += 0.3;
  return t;
}
function updControl(dt) {
  game.ctrlCd -= dt;
  if (meLocked()) { const me = players.find(q => q.me); if (me && !me.human) setHuman(me); game.wantSwitch = false; return; }
  const team = players.filter(p => p.team === 0 && p.role !== 'gk'), cur = team.find(p => p.human) || team[0];
  let other = null, to = 99;
  for (const q of team) if (q !== cur) { const t = reachTime(q); if (t < to) { to = t; other = q; } }
  if (!other) { game.wantSwitch = false; if (!cur.human) setHuman(cur); return; }
  const pt = ball.passTo;   // a pass is on its way to one of ours: you control the receiver
  if (pt && pt.team === 0 && pt.role !== 'gk' && !ball.owner) { game.wantSwitch = false; if (!pt.human) setHuman(pt); return; }
  if (ball.owner && ball.owner.team === 0) { game.wantSwitch = false; if (!ball.owner.human && ball.owner.role !== 'gk') setHuman(ball.owner); return; }
  if (game.wantSwitch) { game.wantSwitch = false; setHuman(other); game.ctrlCd = 0.8; return; }
  if (cur.charge > 0 || cur.state === ST.KICK || cur.state === ST.TACKLE) return;
  // your player is down and the ball is not ours: hand over at once
  if ((cur.state === ST.FALL || cur.state === ST.STUN) && other.state <= ST.RUN) { setHuman(other); game.ctrlCd = 0.6; return; }
  if (game.ctrlCd > 0) return;
  const tc = reachTime(cur);
  // when Roma has the ball, prefer the player who is goal-side of the carrier
  let bonus = 0;
  if (ball.owner && ball.owner.team === 1) { const d0 = dirOf(0); bonus = (d0*(other.x - ball.owner.x) < 0 ? -0.15 : 0.2) - (d0*(cur.x - ball.owner.x) < 0 ? -0.15 : 0.2); }
  if (to + bonus + 0.3 < tc) { setHuman(other); game.ctrlCd = 0.7; }
}
// floating joystick: put your thumb anywhere on the left side, the stick appears under it
const zoneL = document.getElementById('zoneL'), stick = document.getElementById('stick'), knob = document.getElementById('knob');
let stickId = null, stickC = { x: 0, y: 0 };
function stickHome() { const r = zoneL.getBoundingClientRect(); const x = Math.min(r.width*0.42, 110) + 6, y = r.height - 96;
  stick.style.left = x + 'px'; stick.style.top = Math.max(70, y) + 'px'; knob.style.transform = ''; stick.classList.remove('live'); }
function stickMove(e) {
  const R = 46; let x = e.clientX - stickC.x, y = e.clientY - stickC.y; const l = hyp(x, y);
  if (l > R) { // drag the base along so the stick never "runs out"
    const over = l - R; stickC.x += x/l*over; stickC.y += y/l*over; x = x/l*R; y = y/l*R;
    const zr = zoneL.getBoundingClientRect(); stick.style.left = (stickC.x - zr.left) + 'px'; stick.style.top = (stickC.y - zr.top) + 'px';
  }
  knob.style.transform = `translate(${x}px,${y}px)`; touchStick = { x: x/R, y: y/R };
}
zoneL.addEventListener('pointerdown', e => {
  if (stickId !== null) return; audioInit(); stickId = e.pointerId; zoneL.setPointerCapture(e.pointerId);
  const zr = zoneL.getBoundingClientRect(); stickC = { x: e.clientX, y: e.clientY };
  stick.style.left = (e.clientX - zr.left) + 'px'; stick.style.top = (e.clientY - zr.top) + 'px'; stick.classList.add('live');
  stickMove(e); e.preventDefault();
});
zoneL.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; touchStick = null; stickHome(); };
zoneL.addEventListener('pointerup', stickEnd); zoneL.addEventListener('pointercancel', stickEnd); zoneL.addEventListener('lostpointercapture', stickEnd);
const buzz = ms => { if (!TOUCH) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
function holdBtn(el, set) {
  const on = e => { audioInit(); try { el.setPointerCapture(e.pointerId); } catch (err) {} set(true); el.classList.add('on'); buzz(8); e.preventDefault(); };
  const off = () => { set(false); el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
holdBtn(document.getElementById('bA'), v => touchKick = v);
holdBtn(document.getElementById('bB'), v => touchTackle = v);
holdBtn(document.getElementById('bS'), v => touchSwitch = v);
holdBtn(document.getElementById('bR'), v => touchSprint = v);
holdBtn(document.getElementById('bK'), v => touchSkill = v);
// the pad follows the game: KICK shows the charge and turns into SUPER with full FURIA, the second button
// says what it will do (PASS with the ball, TACKLE without, ORA! when a super tackle is possible),
// SWITCH only shows when it can do something
const PAD = { root: document.getElementById('pad'), A: document.getElementById('bA'), B: document.getElementById('bB'), S: document.getElementById('bS'),
  R: document.getElementById('bR'), ringR: document.querySelector('#bR .chg circle'),
  K: document.getElementById('bK'), lbK: document.getElementById('lbK'), ringK: document.querySelector('#bK .chg circle'),
  lbA: document.getElementById('lbA'), lbB: document.getElementById('lbB'), ring: document.querySelector('#bA .chg circle'), key: '' };
function updPad() {
  if (!TOUCH) return;
  const p = players.find(q => q.local); if (!p || game.mode === 'title') return;
  const holder = NET.role === 'guest' ? players.find(q => dist(q, ball) < 14 && ball.z < 6) : ball.owner;
  const has = holder === p, fr = furyReady(p) && p.role !== 'gk';
  const b = has ? 'pass' : fr && holder && holder.team !== p.team && dist(p, holder) < 70 ? 'ora' : 'tackle';
  const sw = !has && NET.role === 'solo' && !meLocked() && players.filter(q => q.team === p.team && q.role !== 'gk').length > 1;
  const ch = Math.round(Math.min(1, p.charge/CHARGE)*20);
  const st = Math.round(p.stam*20), cd = game.skillCd[p.team] || 0, sk = SKILLS[TEAMS[p.team].skill] || SKILLS.herd;
  const kl = cd <= 0 ? sk.short : p.scareCd <= 0 ? 'БУ!' : '...', kr = Math.round((1 - cd/SKILL_CD)*20);
  if (PAD.kl !== kl + kr) { PAD.kl = kl + kr; PAD.lbK.textContent = kl; PAD.ringK.style.strokeDashoffset = String(100 - kr*5); PAD.K.classList.toggle('ready', cd <= 0); }
  const key = b + (fr ? 1 : 0) + (sw ? 1 : 0) + ch + p.team + TEAMS[p.team].code + '|' + st + (p.tired ? 't' : '');
  if (key === PAD.key) return; PAD.key = key;
  PAD.root.style.setProperty('--team', TEAMS[p.team].color);
  for (const c of ['pass', 'ora', 'tackle']) PAD.B.classList.toggle(c, c === b);   // classList keeps the pressed state
  PAD.lbB.textContent = b === 'pass' ? 'ПАС' : b === 'ora' ? 'ОРА!' : 'ПОДКАТ';
  PAD.A.classList.toggle('super', fr); PAD.A.classList.toggle('full', ch >= 20); PAD.lbA.textContent = fr ? 'СУПЕР' : 'УДАР';
  PAD.ring.style.strokeDashoffset = String(100 - ch*5);
  PAD.S.classList.toggle('off', !sw);
  PAD.ringR.style.strokeDashoffset = String(100 - st*5); PAD.R.classList.toggle('tired', p.tired);
}

// ================== field (pre-rendered) ==================
const FCV = document.createElement('canvas');
FCV.width = Math.ceil(OX + LEN + WID*SK + 44); FCV.height = Math.ceil(OY + WID*SY + 30);
const FRONT = document.createElement('canvas'); FRONT.width = FCV.width; FRONT.height = FCV.height;
function hex(c) { const n = parseInt(c.slice(1), 16); return [n>>16, (n>>8)&255, n&255]; }
function buildField() {
  const g = FCV.getContext('2d'), FWd = FCV.width, FHt = FCV.height;
  g.imageSmoothingEnabled = false;
  const img = g.createImageData(FWd, FHt), d = img.data;
  const put = (x, y, c) => { const k = (y*FWd + x)*4; d[k] = c[0]; d[k+1] = c[1]; d[k+2] = c[2]; d[k+3] = 255; };
  const G1c = hex(TH.grass[0]), G1d = hex(TH.grass[1]), G2a = hex(TH.grass[2]), G2b = hex(TH.grass[3]), TRK = hex(TH.track[0]), TRK2 = hex(TH.track[1]);
  const pud = hex('#a6e4e6'), pudE = hex('#62bccc'), pudH = hex('#e4fbff'), mudA = hex('#2f7a2c'), mudB = hex('#5c4a26'), mudC = hex('#3e3418');
  const TRACK_TOP = Math.round(OY - 14*SY - 26) + 14;
  let seed = 11; const rr = () => (seed = (seed*16807) % 2147483647) / 2147483647;
  for (let fy = 0; fy < FHt; fy++) {
    const y = (fy - OY)/SY;
    for (let fx = 0; fx < FWd; fx++) {
      const x = fx - OX - y*SK;
      if (y < -14) { put(fx, fy, fy >= TRACK_TOP ? (((fx + fy) & 3) ? TRK : TRK2) : [16, 14, 26]); continue; }
      const inGrass = y <= WID + 14 && x >= -40 && x <= LEN + 40;
      if (!inGrass) { put(fx, fy, ((fx + fy) & 3) ? TRK : TRK2); continue; }
      let c = Math.floor((y + 14)/22) % 2 === 0
        ? ((fx*7 + fy*13) % 29 === 0 ? G1d : G1c)
        : (((fx + fy) & 1) ? G2a : G2b);
      for (const pt of patches) {
        let best = 9;
        for (const e of pt.blobs) best = Math.min(best, ((x-e.x)/e.rx)**2 + ((y-e.y)/e.ry)**2);
        if (best >= 1) continue;
        if (pt.type === 'puddle') c = best > 0.72 ? (((fx+fy)&1) ? pudE : pud) : ((fx*31 + fy*17) % 41 === 0 ? pudH : ((fx*13+fy*7) % 53 === 0 ? G2a : pud));
        else c = best > 0.7 ? (((fx+fy)&1) ? mudA : c) : (((fx*5 + fy*3) % 7 < 3) ? mudB : ((fx+fy)&1 ? mudA : mudC));
      }
      put(fx, fy, c);
    }
  }
  g.putImageData(img, 0, 0);

  // scenery behind the pitch
  const crowdBottom = OY - 14*SY - 26;
  drawBack(g, TH.back, crowdBottom, FWd, rr);
  // ad boards
  const bTop = Math.round(crowdBottom), bH = 13;
  const boards = (ADS[TH.back] || ADS.crowd).map((t, i) => [BOARDCOL[i % BOARDCOL.length][0], BOARDCOL[i % BOARDCOL.length][1], t]);
  for (let i = 0, x = 0; x < FWd; i++, x += 74) {
    const [bg, fg, txt] = boards[i % boards.length];
    g.fillStyle = '#100810'; g.fillRect(x, bTop-1, 74, bH+2);
    g.fillStyle = bg; g.fillRect(x+1, bTop, 72, bH);
    ptext(g, txt, x + 37, bTop + 3, 8, fg, 'center');
  }
  g.fillStyle = '#d8d8e0'; g.fillRect(0, bTop + bH + 1, FWd, 3);

  // pitch lines
  const LC = TH.line || '#ffffff';
  const L = (x0, y0, x1, y1) => { const a = P(x0, y0), b = P(x1, y1); pline(g, a.x, a.y, b.x, b.y, LC, 2); };
  const arc = (cx, cy, rad, a0, a1) => { let prev = null;
    for (let k = 0; k <= 48; k++) { const a = a0 + (a1-a0)*k/48, p = P(cx + Math.cos(a)*rad, cy + Math.sin(a)*rad);
      if (prev) pline(g, prev.x, prev.y, p.x, p.y, LC, 2); prev = p; } };
  L(0,0,LEN,0); L(0,WID,LEN,WID); L(0,0,0,WID); L(LEN,0,LEN,WID); L(LEN/2,0,LEN/2,WID);
  arc(LEN/2, WID/2, 52, 0, Math.PI*2);
  const big = WID > 300, bh = big ? 115 : 70, bd = big ? 130 : 96, sh = big ? 58 : 40, sd = big ? 44 : 32, ps = big ? 88 : 66;
  for (const [gx, s] of [[0, 1], [LEN, -1]]) {
    L(gx, WID/2-bh, gx + s*bd, WID/2-bh); L(gx + s*bd, WID/2-bh, gx + s*bd, WID/2+bh); L(gx + s*bd, WID/2+bh, gx, WID/2+bh);
    L(gx, WID/2-sh, gx + s*sd, WID/2-sh); L(gx + s*sd, WID/2-sh, gx + s*sd, WID/2+sh); L(gx + s*sd, WID/2+sh, gx, WID/2+sh);
    const sp = P(gx + s*ps, WID/2); g.fillStyle = '#ffffff'; g.fillRect(Math.round(sp.x)-1, Math.round(sp.y)-1, 3, 2);
    arc(gx + s*ps, WID/2, 44, s > 0 ? -0.82 : Math.PI - 0.82 + 0, s > 0 ? 0.82 : Math.PI + 0.82);
  }
  const cs = P(LEN/2, WID/2); g.fillStyle = '#ffffff'; g.fillRect(Math.round(cs.x)-1, Math.round(cs.y)-1, 3, 2);
  arc(0, 0, 8, 0, Math.PI/2); arc(LEN, 0, 8, Math.PI/2, Math.PI); arc(0, WID, 8, -Math.PI/2, 0); arc(LEN, WID, 8, Math.PI, Math.PI*1.5);
  drawFore(g, TH.back, FWd, FHt, rr);
  // far corner flags (near ones are drawn live)
  for (const x of [0, LEN]) drawFlag(g, P(x, 0));
  // goals are static: bake the back nets into the field and the near posts into a front layer
  drawGoalBack(false, g, P); drawGoalBack(true, g, P);
  const gf = FRONT.getContext('2d'); gf.clearRect(0, 0, FRONT.width, FRONT.height);
  drawGoalFront(false, gf, P); drawGoalFront(true, gf, P);
  // substitutes standing on the track
  const trackY = bTop + bH + 6;
  [[0, 0.16, 'idle'], [0, 0.2, 'cheer'], [0, 0.25, 'idle'], [1, 0.78, 'idle'], [1, 0.83, 'idle']].forEach(([t, fx, pose]) => {
    const spr = getSprite(t, pose, pose === 'cheer' ? 'shout' : 'normal', 0, 'side'), px = Math.round(OX + LEN*fx);
    if (t === 1) { g.save(); g.translate(px, 0); g.scale(-1, 1); g.drawImage(spr, -20, trackY - 39); g.restore(); }
    else g.drawImage(spr, px - 20, trackY - 39);
  });
}
const ADS = {
  crowd: ['AZZURRI', 'PIZZA', 'SFOGLIA', 'VESUVIO', 'CAFFE', 'GOL TV'], snowcrowd: ['ГЛИНТВЕЙН', 'ШАРФЫ', 'ЛЫЖИ', 'ЗИМА TV'],
  bricks: ['ЧАЙ', 'ЗОНТЫ', 'ПУДИНГ', 'ТУМАН TV'], savanna: ['САФАРИ', 'БАОБАБ', 'МАНГО', 'ЛЕВ TV'],
  bamboo: ['ПАНДА', 'РИС', 'ЧАЙ', 'БАМБУК'], icebergs: ['ПИНГВИН', 'ИГЛУ', 'ТЮЛЕНЬ', 'ЛЁД TV'],
  steppe: ['КУМЫС', 'БАУРСАК', 'БЕШБАРМАК', 'СТЕПЬ TV'], sea: ['САРДИНЫ', 'СЁРФ', 'КРЕМ SPF', 'ПЛЯЖ TV'],
  windmills: ['ТЮЛЬПАН', 'СЫР', 'ВЕЛИК', 'МЕЛЬНИЦА'], ocean: ['ЯКОРЬ', 'РЫБА', 'МАЯК', 'ШТОРМ TV'],
  dunes: ['ВЕРБЛЮД', 'АЙРАГ', 'ЮРТА', 'ГОБИ TV'], colonnade: ['ДЖЕЛАТО', 'ФРЕСКА', 'КЛЮЧИ', 'ГЕЛАТО'], reef: ['КОРАЛЛ', 'ЖЕМЧУГ', 'ПУЗЫРИ', 'НЕПТУН'],
};
const BOARDCOL = [['#1d4f8f','#ffffff'], ['#d8344a','#ffffff'], ['#f4f1e6','#1d4f8f'], ['#1a1420','#f2c230'], ['#4aa8f0','#ffffff'], ['#ffffff','#d8344a']];
// paints the strip above the ad boards (0..bot) for a theme: stands, sky, landscape
function drawBack(g, kind, bot, FW, rr) {
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const sky = cols => { for (let i = 0; i < cols.length; i++) R(0, bot*i/cols.length, FW, bot/cols.length + 1, cols[i]); };
  const tri = (x, base, w, h, c, cap) => { for (let k = 0; k < h; k++) { const ww = w*(k + 1)/h; R(x - ww/2, base - h + k, ww, 1, k < h*0.3 && cap ? cap : c); } };
  const crowd = (bg, hat) => {
    R(0, 0, FW, bot, bg);
    for (let row = 0; row*6 + 8 < bot; row++) {
      const yy = 2 + row*6;
      for (let x = (row % 2)*3; x < FW; x += 6) {
        if (rr() < 0.07) continue;
        const f = rr(), shirt = f < 0.55 ? TEAMS[0].jersey : f < 0.75 ? '#ffffff' : f < 0.92 ? TEAMS[1].jersey : '#f2c230';
        g.globalAlpha = Math.min(1, 0.55 + row*0.08);
        R(x, yy + 4, 5, 3, shirt); R(x + 1, yy + 1, 3, 3, rr() < 0.25 ? '#8a5634' : '#ffb88a');
        if (hat) { R(x + 1, yy - 1, 3, 2, rr() < 0.5 ? '#d8243a' : '#2a4ad8'); R(x + 2, yy - 2, 1, 1, '#ffffff'); }
        else R(x + 1, yy, 3, 1, rr() < 0.7 ? '#1a1420' : '#a8381c');
        if (rr() < 0.15) R(x + (rr() < 0.5 ? 0 : 4), yy - 1, 1, 2, '#ffb88a');
      }
    }
    g.globalAlpha = 1;
  };
  switch (kind) {
    case 'snowcrowd': crowd('#2a3040', true); for (let x = 0; x < FW; x += 2) R(x, 0, 2, 1 + (rr()*2|0), '#ffffff'); break;
    case 'bricks': crowd('#5a2a24', false); for (let y = bot - 8; y < bot; y += 3) for (let x = (y % 2)*4; x < FW; x += 8) R(x, y, 7, 2, '#8a3a2a'); break;
    case 'savanna': {
      sky(['#ff8a3a', '#ffa04a', '#ffb85a', '#ffcf78', '#ffe09a']);
      for (let x = 0; x < FW; x += 300) { R(x + 200, bot*0.25, 24, 24, '#fff0b0'); R(x + 196, bot*0.25 + 4, 32, 16, '#fff0b0'); }   // sun
      for (let x = 0; x < FW; x += 2) R(x, bot - 10 - Math.sin(x/60)*4, 2, 14, '#c88a3a');
      for (let x = 30; x < FW; x += 70 + (rr()*50|0)) {   // acacias
        const h = 16 + (rr()*10|0), y = bot - 6;
        R(x, y - h, 3, h, '#3a2410'); R(x - 14, y - h - 4, 31, 5, '#3a4a1a'); R(x - 9, y - h - 7, 21, 3, '#3a4a1a'); R(x - 4, y - h - 2, 4, 3, '#3a2410');
        if (rr() < 0.3) { const gx = x + 30; R(gx, y - 22, 3, 16, '#e8b040'); R(gx, y - 25, 6, 3, '#e8b040'); R(gx - 8, y - 10, 12, 5, '#e8b040');   // giraffe
          R(gx - 8, y - 5, 1, 5, '#a86a20'); R(gx + 3, y - 5, 1, 5, '#a86a20'); R(gx - 5, y - 9, 2, 2, '#a86a20'); R(gx + 1, y - 18, 1, 2, '#a86a20'); }
      }
      break; }
    case 'bamboo': {
      sky(['#d8f0c8', '#c0e8b0', '#a8dc98']);
      for (let x = 0; x < FW; x += 4 + (rr()*4|0)) {
        const c = ['#3a8a2a', '#4aa83a', '#5ac04a', '#2a7020'][rr()*4|0], w = 2 + (rr()*2|0);
        R(x, 0, w, bot, c); for (let y = (rr()*9|0); y < bot; y += 9) R(x, y, w, 1, '#1a5014');
        if (rr() < 0.4) R(x + w, (rr()*bot)|0, 4, 1, '#6ad05a');
      }
      for (let x = 60; x < FW; x += 260) { const y = bot - 14; R(x, y, 12, 10, '#ffffff'); R(x + 2, y - 7, 8, 7, '#ffffff');   // panda sitting
        R(x + 2, y - 8, 2, 2, '#141010'); R(x + 8, y - 8, 2, 2, '#141010'); R(x + 3, y - 5, 2, 2, '#141010'); R(x + 7, y - 5, 2, 2, '#141010');
        R(x - 1, y + 2, 3, 5, '#141010'); R(x + 10, y + 2, 3, 5, '#141010'); R(x + 11, y - 2, 4, 2, '#5ac04a'); }
      break; }
    case 'icebergs': {
      sky(['#9ad0f4', '#b8dcf8', '#d4ecfc', '#e8f6fe']);
      for (let x = 0; x < FW; x += 60 + (rr()*40|0)) tri(x, bot - 6, 50 + rr()*40, 18 + rr()*20, '#e8f4fc', '#ffffff');
      R(0, bot - 8, FW, 8, '#f4fafe');
      for (let x = 4; x < FW; x += 7) { if (rr() < 0.25) continue; const y = bot - 9; R(x, y - 6, 4, 7, '#202030'); R(x + 1, y - 4, 2, 4, '#ffffff'); R(x + 1, y - 6, 2, 1, '#ff9a1a'); }
      break; }
    case 'steppe': {
      sky(['#4ab0ec', '#6abcf0', '#8acaf4', '#aad8f8']);
      for (let x = 0; x < FW; x += 70) tri(x + 35, bot - 8, 110, 26 + (rr()*12|0), '#6a7a9a', '#ffffff');
      R(0, bot - 10, FW, 10, '#c8b048');
      for (let x = 40; x < FW; x += 110 + (rr()*80|0)) { const y = bot - 9;   // yurts
        R(x, y - 8, 18, 8, '#f4f0e4'); R(x + 2, y - 11, 14, 3, '#f4f0e4'); R(x + 5, y - 13, 8, 2, '#e8e0d0'); R(x, y - 6, 18, 1, '#d8243a'); R(x + 7, y - 6, 4, 6, '#a8541a'); }
      for (let x = 120; x < FW; x += 400) { R(x, 8, 10, 2, '#3a2410'); R(x + 3, 7, 4, 2, '#3a2410'); R(x - 3, 6, 3, 2, '#3a2410'); R(x + 10, 6, 3, 2, '#3a2410'); }   // eagle
      break; }
    case 'sea': {
      sky(['#5ac0f8', '#7accf8', '#9ad8fa']);
      R(0, bot*0.55, FW, bot*0.45, '#2a8ad8'); for (let x = 0; x < FW; x += 6) R(x + (rr()*4|0), bot*0.55 + (rr()*bot*0.4|0), 3, 1, '#bfe8ff');
      R(0, bot - 4, FW, 4, '#f2dc9a');
      for (let x = 50; x < FW; x += 150 + (rr()*60|0)) { for (let k = 0; k < 22; k++) R(x + Math.sin(k/6)*4, bot - 4 - k, 3, 1, '#8a5a2a');   // palms
        const tx = x + Math.sin(22/6)*4, ty = bot - 26; for (const [dx, dy] of [[-12, 3], [-7, -2], [0, -4], [7, -2], [12, 3]]) R(tx + Math.min(0, dx), ty + Math.min(0, dy), Math.abs(dx) || 3, 3, '#2a8a2a'); }
      break; }
    case 'windmills': {
      sky(['#80c0f0', '#a0d0f6', '#c0e0fa']);
      const cols = ['#e8243a', '#ffd23a', '#ff6a9a', '#ffffff', '#ff8a1a'];
      for (let k = 0; k < 5; k++) R(0, bot - 12 + k*2, FW, 2, cols[k]);
      for (let x = 60; x < FW; x += 180 + (rr()*80|0)) { const y = bot - 12;
        R(x, y - 22, 8, 22, '#8a5a3a'); R(x - 1, y - 24, 10, 3, '#5a3a2a'); const cx = x + 4, cy = y - 22;
        pline(g, cx - 12, cy - 12, cx + 12, cy + 12, '#f4f0e8', 2); pline(g, cx - 12, cy + 12, cx + 12, cy - 12, '#f4f0e8', 2); }
      break; }
    case 'ocean': {
      sky(['#2a3448', '#3a4458', '#4a5468']);
      R(0, bot*0.45, FW, bot*0.55, '#1a3a5a'); for (let x = 0; x < FW; x += 5) R(x, bot*0.45 + (rr()*bot*0.5|0), 4, 1, '#cfe0f0');
      R(0, bot - 9, FW, 2, '#a85a2a'); R(0, bot - 5, FW, 2, '#a85a2a'); for (let x = 0; x < FW; x += 24) R(x, bot - 10, 2, 10, '#7a3a1a');
      break; }
    case 'colonnade': {
      sky(['#8ac8f4', '#a8d8f8', '#c8e8fa']);
      const mid = FW/2; for (let k = 0; k < 16; k++) { const w = Math.sqrt(256 - k*k)*3; R(mid - w, bot*0.35 - k, w*2, 1, '#8a9ab0'); }   // dome
      R(0, bot*0.45, FW, bot*0.55, '#e8e0d0'); R(0, bot*0.45, FW, 3, '#c8c0b0');
      for (let x = 4; x < FW; x += 20) { R(x, bot*0.3, 8, bot*0.7, '#f8f4ec'); R(x + 6, bot*0.3, 2, bot*0.7, '#d0c8b8'); R(x - 1, bot*0.3, 10, 3, '#d8d0c0'); }
      break; }
    case 'dunes': {
      sky(['#9ad0f0', '#c0dcf0', '#f0d8b0', '#f8c890']);
      for (const [base, amp, col] of [[bot - 14, 8, '#e0a868'], [bot - 6, 6, '#d09858']]) for (let x = 0; x < FW; x += 2) { const h = amp + Math.sin(x/47 + base)*amp; R(x, base - h, 2, bot - base + h, col); }
      for (let x = 70; x < FW; x += 300) for (let n = 0; n < 3; n++) { const cx = x + n*16, cy = bot - 20;   // caravan
        R(cx, cy, 10, 4, '#7a5030'); R(cx + 2, cy - 2, 3, 2, '#7a5030'); R(cx + 9, cy - 4, 2, 5, '#7a5030'); R(cx + 10, cy - 5, 3, 2, '#7a5030'); R(cx + 1, cy + 4, 1, 4, '#7a5030'); R(cx + 7, cy + 4, 1, 4, '#7a5030'); }
      break; }
    case 'reef': {
      sky(['#0a2a5a', '#0e3a6a', '#124a7a', '#1a5a8a']);
      for (let x = 0; x < FW; x += 40) for (let k = 0; k < bot; k += 2) R(x + k*0.4, k, 2, 2, 'rgba(160,220,255,.08)');
      for (let x = 0; x < FW; x += 10 + (rr()*12|0)) { const c = ['#ff6a9a', '#ff8a3a', '#b86aff', '#ffd23a', '#5af0c0'][rr()*5|0], h = 6 + (rr()*12|0);
        R(x, bot - h, 3, h, c); R(x - 2, bot - h + 2, 2, 3, c); R(x + 3, bot - h + 4, 2, 3, c); }
      for (let k = 0; k < FW/40; k++) { const x = rr()*FW, y = 6 + rr()*(bot - 20); R(x, y, 5, 3, '#ffd23a'); R(x + 5, y + 1, 2, 1, '#ffd23a'); R(x - 2, y, 2, 3, '#ff8a1a'); }
      break; }
    default: crowd('#100e1a', false);
  }
}
// the near side of the pitch (below the touchline): small props per theme
function drawFore(g, kind, FW, FH, rr) {
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const top = Math.round(OY + (WID + 14)*SY) + 2;
  for (let x = rr()*20; x < FW; x += 14 + rr()*26) {
    const y = top + 2 + rr()*Math.max(1, FH - top - 12);
    switch (kind) {
      case 'savanna': R(x, y, 1, 6, '#8a7a2a'); R(x + 2, y - 2, 1, 8, '#a89a3a'); R(x + 4, y + 1, 1, 5, '#8a7a2a'); if (rr() < 0.2) R(x + 8, y + 3, 6, 3, '#9a8a7a'); break;
      case 'bamboo': R(x, y - 6, 2, 12, '#4aa83a'); R(x, y - 2, 2, 1, '#1a5014'); R(x + 3, y - 3, 2, 9, '#3a8a2a'); R(x + 2, y - 5, 4, 1, '#6ad05a'); break;
      case 'snowcrowd': R(x, y, 12, 4, '#ffffff'); R(x + 2, y - 2, 8, 2, '#f4f8fc'); R(x + 1, y + 3, 10, 1, '#c8d8e8'); break;
      case 'icebergs': if (rr() < 0.5) { R(x, y - 4, 4, 6, '#202030'); R(x + 1, y - 2, 2, 4, '#ffffff'); R(x + 1, y - 4, 2, 1, '#ff9a1a'); } else { R(x, y, 10, 5, '#d8f0fc'); R(x, y, 10, 1, '#ffffff'); } break;
      case 'steppe': R(x, y, 1, 5, '#a8902a'); R(x + 2, y - 1, 1, 6, '#c8b048'); if (rr() < 0.15) { R(x + 6, y + 2, 5, 2, '#8a8a8a'); } break;
      case 'sea': if (rr() < 0.3) { R(x, y - 8, 1, 10, '#ffffff'); R(x - 5, y - 9, 11, 3, ['#ff6a6a', '#4ab8ff', '#ffd23a'][rr()*3|0]); } else { R(x, y, 3, 2, '#fff0e0'); R(x + 1, y - 1, 1, 1, '#ffd0c0'); } break;
      case 'windmills': R(x, y - 3, 1, 6, '#3a9a3a'); R(x - 1, y - 5, 3, 3, ['#e8243a', '#ffd23a', '#ff6a9a', '#ffffff'][rr()*4|0]); break;
      case 'ocean': R(x, y, 10, 1, '#cfe0f0'); R(x + 3, y + 2, 6, 1, '#8aa8c8'); break;
      case 'colonnade': if (rr() < 0.4) { R(x, y - 2, 8, 6, '#c8743a'); R(x + 1, y - 7, 6, 5, '#3a9a3a'); R(x + 2, y - 8, 2, 2, '#e8243a'); } break;
      case 'dunes': if (rr() < 0.4) { R(x, y, 5, 3, '#a87a4a'); R(x + 1, y - 1, 3, 1, '#c89a6a'); } else { R(x, y - 3, 1, 4, '#8a7a3a'); R(x + 2, y - 2, 1, 3, '#8a7a3a'); } break;
      case 'reef': R(x, y - 6, 2, 10, '#2a8a5a'); R(x + 2, y - 3, 2, 7, '#3aa86a'); if (rr() < 0.3) R(x + 6, y + 2, 4, 3, '#ff8aa8'); break;
      case 'bricks': if (rr() < 0.25) { R(x, y - 6, 1, 8, '#202030'); R(x - 4, y - 8, 9, 3, '#202030'); } break;
      default: return;
    }
  }
}
// a country flag from club.flag / club.dir (used on the HUD, team picker and the world tour)
function drawFlagIcon(g, c, x, y, w, h) {
  const f = c.flag || [c.jersey], R = (a, b, ww, hh, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, ww, hh); };
  switch (c.dir) {
    case 'h': for (let i = 0; i < f.length; i++) R(0, Math.floor(h*i/f.length), w, Math.ceil(h/f.length), f[i]); break;
    case 'cross': R(0, 0, w, h, f[0]); R(0, (h >> 1) - 1, w, 2 + (h & 1), f[1]); R((w >> 1) - 1, 0, 2 + (w & 1), h, f[1]); break;
    case 'diag': for (let k = 0; k < h; k++) { const b = Math.round(w - (k + 0.5)*w/h); R(0, k, b, 1, f[0]); R(b, k, w - b, 1, f[2]); R(b - 1, k, 2, 1, f[1]); } break;
    case 'mng': { for (let i = 0; i < 3; i++) R(Math.floor(w*i/3), 0, Math.ceil(w/3), h, f[i]); const cx = Math.floor(w/6);
      R(cx - 1, 2, 2, 1, '#ffd23a'); R(cx - 2, 4, 4, 2, '#ffd23a'); R(cx - 1, 7, 2, Math.max(1, h - 9), '#ffd23a'); break; }
    case 'kaz': { R(0, 0, w, h, f[0]); const cx = w >> 1, cy = (h >> 1) - 1; R(cx - 2, cy - 2, 4, 4, '#ffd23a'); R(cx - 1, cy - 3, 2, 6, '#ffd23a'); R(cx - 3, cy - 1, 6, 2, '#ffd23a');
      R(cx - 4, cy + 3, 8, 1, '#ffd23a'); R(1, 1, 1, h - 2, '#ffd23a'); break; }
    default: for (let i = 0; i < f.length; i++) R(Math.floor(w*i/f.length), 0, Math.ceil(w/f.length), h, f[i]);
  }
}
function drawFlag(g, p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  g.fillStyle = '#100810'; g.fillRect(x-1, y-22, 3, 23);
  g.fillStyle = '#ffffff'; g.fillRect(x, y-21, 1, 21);
  g.fillStyle = '#100810'; g.fillRect(x+1, y-23, 9, 7);
  g.fillStyle = '#e83a3a'; g.fillRect(x+1, y-22, 7, 5); g.fillStyle = '#ff7a6a'; g.fillRect(x+1, y-22, 7, 1);
}

// ================== weather ==================
function setWeather(w) {
  game.weather = w; patches = []; game.pv = (game.pv || 0) + 1;
  if (w === 'off') { buildField(); game.wind = { x: 0, y: 0 }; rain = []; return; }
  const add = (type, rx, ry) => {
    for (let tries = 0; tries < 40; tries++) {
      const x = rnd(60, LEN-60), y = rnd(30, WID-30);
      if (hyp(x-LEN/2, y-WID/2) < 50) continue;
      if (patches.some(p => hyp(p.x-x, (p.y-y)*1.6) < p.rx + rx + 20)) continue;
      const blobs = [{ x, y, rx, ry }];
      for (let k = 0; k < 3; k++) blobs.push({ x: x + rnd(-rx*0.6, rx*0.6), y: y + rnd(-ry*0.5, ry*0.5), rx: rx*rnd(0.4,0.7), ry: ry*rnd(0.4,0.8) });
      patches.push({ type, x, y, rx, ry, blobs }); return;
    }
  };
  if (w === 'clear') { if (TH.grass === THEMES.stadium.grass || themeKey === 'rainy') { add('mud', 30, 16); add('mud', 22, 12); } }
  else if (w === 'snow') {}
  else {
    add('mud', 34, 18); add('mud', 26, 14); add('puddle', 34, 18); add('puddle', 28, 15); add('puddle', 24, 13); add('puddle', 30, 16);
    if (w === 'storm') { add('puddle', 26, 14); add('mud', 24, 13); }
  }
  buildField(); newWind(); game.lightT = rnd(4, 8);
  makeRain(w);
}
const WXNAME = { clear: 'СОЛНЦЕ!', rain: 'ДОЖДЬ!', storm: 'ГРОЗА!', snow: 'СНЕГ!' };
function randomWeather(not) { const opts = ['clear', 'rain', 'rain', 'storm', 'storm'].filter(w => w !== not); return opts[Math.floor(Math.random()*opts.length)]; }
function newWind() {
  const a = Math.random()*Math.PI*2, m = TH.wind ? TH.wind*rnd(0.7, 1.2) : game.weather === 'storm' ? rnd(45, 90) : game.weather === 'rain' ? rnd(8, 24) : 0;
  game.wind = { x: Math.cos(a)*m, y: Math.sin(a)*m*0.5 }; game.windT = rnd(7, 11);
}
function updWeather(dt) {
  if (NET.role === 'guest') { updRain(dt); return; }
  game.windT -= dt; if (game.windT <= 0 && (game.weather === 'storm' || TH.wind)) newWind();
  if (game.weather === 'storm' && game.mode === 'play') {
    game.lightT -= dt;
    if (game.lightT <= 0) {
      game.lightT = rnd(5, 10);
      const pool = players.filter(p => p.state <= ST.KICK), p = pool[Math.floor(Math.random()*pool.length)];
      if (p) { electrocute(p); const s = P(p.x, p.y, 34); game.bolt = { x: s.x, y: s.y, t: 0.3, seed: Math.random()*1000 };
        game.flash = REDUCED ? 0.25 : 0.7; game.shake = Math.max(game.shake, 0.3); sfx('zap'); hitstop(0.12); }
    }
  }
  updRain(dt);
}
function updRain(dt) {
  const snow = game.weather === 'snow';
  for (const d of rain) { d.y += d.s*dt; d.x += snow ? (game.wind.x*0.4 + Math.sin(game.t*2 + d.ph)*12)*dt : (game.wind.x*1.2 - 40)*dt;
    if (d.y > H) { d.y = rnd(-20, 0); d.x = rnd(0, W+40); } if (d.x < -10) d.x += W+20; if (d.x > W+10) d.x -= W+20; }
}
function makeRain(w) { rain = [];
  if (w === 'rain' || w === 'storm') for (let i = 0; i < (w === 'storm' ? 120 : 80); i++) rain.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(200, 300) });
  if (w === 'snow') for (let i = 0; i < 90; i++) rain.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(18, 40), ph: rnd(0, 6) }); }

// ================== online: two friends, one host runs the match ==================
// Built on a pluggable "room" (src/net/). Each page keeps one "presence" object:
//   host  → {app, role:'host', code, mode, open, gp (guest peer), s (match snapshot ~20/s)}
//   guest → {app, role:'guest', code, in (buttons and stick)}
// The host simulates everything; the guest sends its input and draws the host's snapshot.
const NET = { role: 'solo', room: null, user: null, ready: false, myPeer: null, mode: null, code: null, guestPeer: null, hostPeer: null,
  ev: [], evId: 0, lastEv: -1, lastS: null, mid: 0, rK: -1, rT: -1, lastPres: 0, kr: 0, tc: 0, pk: false, pt: false, names: {}, msg: '',
  snapN: 0, ptPv: -1, ptLeft: 0, snapAt: 0, hostReady: false, started: false, joining: null, lastCode: '', ui: 'idle', booted: false,
  autoJoin: (new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || null };
// game codes: 5 characters without look-alikes (no O/0, I/1/L)
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_ABC[Math.floor(Math.random()*CODE_ABC.length)]).join('');
const cleanCode = v => String(v || '').toUpperCase().split('').filter(c => CODE_ABC.includes(c)).join('').slice(0, 5);
const EXPR = ['normal', 'grit', 'shout', 'bulge', 'cry'], EMOS = Object.keys(EMO), SUPS = [null, 'tiger', 'kame', 'rasen'];
function netEv(...a) { if (NET.role !== 'host') return; NET.ev.push([++NET.evId, ...a]); if (NET.ev.length > 14) NET.ev.shift(); }
function setPresence(patch) { if (!NET.room) return; NET.room.presence(patch).catch(() => {}); }
function myPeerId() { const me = NET.room && NET.room.peers().find(p => p.sameTab); return me ? me.peer : null; }
// the friend plays Roma's striker head to head, or Napoli's defender together
const friendPlayer = () => players.find(p => NET.mode === 'vs' ? p.team === 1 && p.role === 'att' : p.team === 0 && p.role === 'def');
function assignControl(na, nd, ra) {
  for (const p of players) { p.human = p.local = false; p.tag = 0; }
  if (NET.role === 'host') {
    Object.assign(na, { human: true, local: true, tag: 1 });
    const friend = friendPlayer();
    if (friend && NET.guestPeer) Object.assign(friend, { human: true, tag: 2 });
  } else setHuman(na);
}
function remoteInput() {
  if (NET.role !== 'host' || !NET.room) return;
  const rp = players.find(p => p.tag === 2); if (!rp) return;
  const g = NET.room.peers().find(p => p.peer === NET.guestPeer), i = g && g.presence && g.presence.in;
  if (!i || typeof i !== 'object') { rp.inp.mx = rp.inp.my = 0; rp.inp.kickHeld = rp.inp.sprint = false; return; }
  const mx = +i.mx || 0, my = +i.my || 0, l = hyp(mx, my);
  rp.inp.mx = l > 1 ? mx/l : mx; rp.inp.my = l > 1 ? my/l : my; rp.inp.kickHeld = !!i.k; rp.inp.sprint = !!i.sp;
  const kr = +i.kr || 0, tc = +i.tc || 0;
  if (NET.rK < 0) { NET.rK = kr; NET.rT = tc; }
  if (kr > NET.rK) { rp.inp.kickReleased = true; NET.rK = kr; }
  if (tc > NET.rT) { rp.inp.tacklePressed = true; NET.rT = tc; }
  const sk = +i.sk || 0; if (NET.rS < 0) NET.rS = sk; if (sk > NET.rS) { NET.rS = sk; humanSkill(rp); }
}
const r1 = v => Math.round(v*10)/10, r2 = v => Math.round(v*100)/100;
const BUFFS = ['pizza', 'pepper', 'horn', 'feint'];
const stateBits = p => (p.freeze ? 1 + FRZ.indexOf(p.freeze.k) : 0) | (p.peeT > 0 ? 16 : 0) | (p.poopT > 0 ? 32 : 0) | (p.ghost > 0 ? 64 : 0) | (p.cycle > 0 ? 128 : 0) | (p.fear ? 256 : 0);
function buildSnap() {
  return { mid: NET.mid, md: NET.mode, gm: game.mode, t: r1(game.time), sc: game.score, fu: [Math.round(game.fury[0]), Math.round(game.fury[1])], gp: NET.guestPeer,
    P: players.map(p => [r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), p.state, r2(p.st), r2(p.fx), r2(p.fy), r2(p.charge),
      p.mood === 'cheer' ? 1 : p.mood === 'sad' ? 2 : 0, EXPR.indexOf(p.fallExpr), p.tag || 0,
      p.emote ? EMOS.indexOf(p.emote.type) : -1, p.emote ? r1(p.emote.t) : 0, p.emote ? r2(p.emote.age) : 0, p.kickSuper ? 1 : 0, p.bike ? 1 : 0, r1(p.z), BUFFS.indexOf(p.buff), Math.round(p.stam*20), p.tired ? 1 : 0, p.sprinting ? 1 : 0, stateBits(p)]),
    B: [r1(ball.x), r1(ball.y), r1(ball.z), r1(ball.vx), r1(ball.vy), SUPS.indexOf(ball.superType), ball.beam ? r1(ball.beam.x) : 0, ball.beam ? r1(ball.beam.y) : 0, ball.beam ? r2(ball.beam.t) : 0, ball.passAt ? Math.round(ball.passAt.x) : 0, ball.passAt ? Math.round(ball.passAt.y) : 0, ball.passTo ? players.indexOf(ball.passTo) : -1],
    sh: r2(game.shake), fl: r2(game.flash), bo: game.bolt ? [r1(game.bolt.x), r1(game.bolt.y), r2(game.bolt.t), Math.round(game.bolt.seed)] : 0,
    an: game.announce ? [game.announce.text, game.announce.col, r2(game.announce.t)] : 0,
    bn: game.banner ? [game.banner.text, game.banner.col, r2(game.banner.t)] : 0,
    wx: game.weather, wd: [r1(game.wind.x), r1(game.wind.y)], pv: game.pv,
    // the puddle map is big and rarely changes: send it for a while after a change and now and then
    pt: NET.ptPv !== game.pv || NET.ptLeft > 0 || NET.snapN % 60 === 0 ? patches.map(p => [p.type === 'puddle' ? 1 : 0, p.blobs.map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.rx), Math.round(b.ry)])]) : 0,
    ch: game.chaos ? [CHAOS_KEYS.indexOf(game.chaos.type), r1(game.chaos.t)] : 0,
    ve: game.vespa ? [r1(game.vespa.x), r1(game.vespa.y), game.vespa.dir] : 0,
    it: items.map(i => [ITEMS.indexOf(i.type), r1(i.x), r1(i.y), r1(i.t)]),
    pe: pees.map(q => [Math.round(q.x), Math.round(q.y)]), sk: [r1(game.skillCd[0]), r1(game.skillCd[1])], bm: ball.miracle ? 1 : 0,
    ru: game.runners.map(r => [RK.indexOf(r.k), r1(r.x), r1(r.y), r1(r.z || 0), r.dir || 1, r.team]),
    ho: [game.half, game.flip, game.show ? (game.show.kind === 'half' ? 2 : 1) : 0, game.show ? r2(game.show.t) : 0, game.show ? game.show.j : 0, game.show && game.show.wx || 0],
    ev: NET.ev };
}
function hostBroadcast() {
  // 20 snapshots/s on a direct link, 15 through the relay; if the link is still busy sending, skip this one
  const now = performance.now(), relay = NET.room.linkKind && NET.room.linkKind() === 'relay';
  if (now - NET.lastPres < (relay ? 66 : 50) || !NET.guestPeer) return;
  if (NET.room.busy && NET.room.busy()) return;
  NET.lastPres = now; NET.snapN++;
  if (NET.ptPv !== game.pv) { NET.ptPv = game.pv; NET.ptLeft = 20; } else if (NET.ptLeft > 0) NET.ptLeft--;
  setPresence({ s: buildSnap() });
}
async function hostGame(mode) {
  if (!NET.ready || NET.role !== 'solo' || NET.joining) return;
  NET.msg = ''; NET.role = 'host'; NET.mode = mode; NET.guestPeer = null; NET.started = false; NET.ev = []; NET.evId = 0;
  const room = NET.room; NET.hostReady = !room.host;
  for (let tries = 0; ; tries++) {
    const code = NET.code = newCode(); renderLobby();
    if (!room.host) break;
    try { await room.host(code); if (NET.role !== 'host' || NET.code !== code) return; NET.hostReady = true; break; }
    catch (e) {
      if (NET.role !== 'host' || NET.code !== code) return;
      if (e.message === 'taken' && tries < 3) continue;
      NET.role = 'solo'; NET.msg = 'НЕТ СВЯЗИ С СЕРВЕРОМ'; renderLobby(); lobbyFocus(); return;
    }
  }
  setPresence({ app: 'azz', role: 'host', code: NET.code, mode, open: true, gp: null, s: null, in: null });
  renderLobby(); lobbyFocus();
}
async function joinByCode(raw) {
  const code = cleanCode(raw);
  if (!NET.ready || NET.role !== 'solo' || NET.joining) return;
  if (code.length !== 5) { NET.msg = 'В КОДЕ 5 СИМВОЛОВ'; renderLobby(); return; }
  NET.msg = ''; NET.joining = code; NET.lastCode = code; NET.viaRelay = false; renderLobby();
  const room = NET.room;
  if (room.join) {
    try { await room.join(code, stage => { if (NET.joining === code && stage === 'relay') { NET.viaRelay = true; renderLobby(); } }); }
    catch (e) {
      if (NET.joining !== code) return;
      NET.joining = null; NET.ui = 'enter';
      NET.msg = e.message === 'notfound' ? 'ИГРА ' + code + ' НЕ НАЙДЕНА' : e.message === 'timeout' ? 'ДРУГ НЕ ОТВЕЧАЕТ' : 'НЕТ СВЯЗИ С СЕРВЕРОМ';
      renderLobby(); lobbyFocus(); return;
    }
    if (NET.joining !== code) return;
  }
  NET.joining = null;
  const h = room.peers().find(p => !p.isMe && p.presence && p.presence.app === 'azz' && p.presence.role === 'host' && p.presence.code === code);
  if (!h) { if (room.leave) room.leave(); NET.ui = 'enter'; NET.msg = 'ИГРА ' + code + ' НЕ НАЙДЕНА'; renderLobby(); lobbyFocus(); return; }
  joinGame(h.peer);
}
function joinGame(peer) {
  const h = NET.room && NET.room.peers().find(p => p.peer === peer); if (!h) return;
  NET.role = 'guest'; NET.hostPeer = peer; NET.code = h.presence.code; NET.mode = h.presence.mode; NET.lastS = null; NET.lastEv = -1; NET.mid = -1;
  NET.kr = NET.tc = 0; NET.msg = '';
  setPresence({ app: 'azz', role: 'guest', code: NET.code, in: { mx: 0, my: 0, k: 0, kr: 0, tc: 0 }, s: null, open: null, gp: null });
  renderLobby();
}
function netLeave() {
  if (NET.role === 'solo') return;
  NET.role = 'solo'; NET.guestPeer = NET.hostPeer = null; NET.hostReady = false;
  setPresence({ app: 'azz', role: 'idle', code: null, mode: null, open: null, gp: null, s: null, in: null });
  if (NET.room && NET.room.leave) NET.room.leave();
}
function netLost(msg) {
  const rejoin = NET.role === 'guest' && NET.lastCode && NET.room && NET.room.join;
  netLeave(); stopMusic(); NET.msg = msg; NET.ui = rejoin ? 'enter' : 'idle'; attract(); showOv('ovOnline');
  if (rejoin) $('codeIn').value = NET.lastCode;
}
function onNetPeers() {
  NET.myPeer = myPeerId();
  const peers = NET.room.peers();
  if (NET.role === 'host') {
    if (!NET.guestPeer) {
      const g = peers.find(p => !p.isMe && p.presence && p.presence.app === 'azz' && p.presence.role === 'guest' && p.presence.code === NET.code);
      if (g) {
        NET.guestPeer = g.peer; NET.rK = NET.rT = -1; NET.ptPv = -1; setPresence({ open: false, gp: g.peer });
        if (NET.started && game.mode !== 'title') {   // the friend came back (e.g. after locking the phone): same match goes on
          const f = friendPlayer(); if (f) Object.assign(f, { human: true, tag: 2 });
          game.announce = { text: '2P ВЕРНУЛСЯ', col: '#7fe0ff', t: 1.6 };
        } else {
          NET.started = true; startMatch(NET.mode === 'vs' ? 1 : 2);
          game.announce = { text: '2P В ИГРЕ!', col: '#7fe0ff', t: 1.6 };
        }
      }
    } else if (!peers.find(p => p.peer === NET.guestPeer)) {
      const rp = players.find(p => p.tag === 2); if (rp) { rp.human = false; rp.tag = 0; }
      NET.guestPeer = null; setPresence({ gp: null, s: null, open: true });
      if (game.mode === 'play' || game.mode === 'goal') game.announce = { text: '2P ВЫШЕЛ', col: '#ff6a6a', t: 2 };
    }
  } else if (NET.role === 'guest') {
    const h = peers.find(p => p.peer === NET.hostPeer);
    if (!h) netLost('СВЯЗЬ С ДРУГОМ ПРОПАЛА');
    else if (!h.presence || h.presence.role !== 'host') netLost('ДРУГ ЗАКРЫЛ ИГРУ');
    else if (h.presence.gp && h.presence.gp !== NET.myPeer) netLost('ЭТА ИГРА УЖЕ ЗАНЯТА');
  }
  if (!$('ovOnline').hidden) renderLobby();
}
function renderLobby() {
  const st = $('netStatus'), list = $('gameList'), back = $('miNetBack'), hint = $('netHint');
  const view = id => { for (const k of ['nIdle', 'nCode', 'nJoin']) $(k).hidden = k !== id; };
  list.textContent = ''; hint.textContent = '';
  if (!NET.ready) {
    view(null); back.textContent = 'НАЗАД';
    st.textContent = NET.room === false ? 'ОНЛАЙН НЕДОСТУПЕН' : 'ПОДКЛЮЧЕНИЕ…';
    if (NET.room === false) hint.textContent = 'Модуль связи не загрузился. Проверь интернет и обнови страницу. Против Ромы можно играть и без него.';
    return;
  }
  back.textContent = NET.role === 'solo' && !NET.joining && NET.ui !== 'enter' ? 'НАЗАД' : 'ОТМЕНА';
  if (NET.role === 'host') {
    const what = NET.mode === 'vs' ? 'ДРУГ ПРОТИВ ДРУГА' : 'ВМЕСТЕ ПРОТИВ РОМЫ';
    if (!NET.hostReady) { view(null); st.textContent = what + ' · СОЗДАЁМ ИГРУ…'; return; }
    view('nCode'); $('codeBig').textContent = NET.code;
    const L = NET.room.links ? NET.room.links() : null, up = !L || L.direct || L.relay;
    st.textContent = what + (up ? ' · ЖДЁМ ДРУГА…' : ' · НЕТ СВЯЗИ, ПЕРЕПОДКЛЮЧАЕМСЯ…');
    hint.textContent = (L ? 'СВЯЗЬ: НАПРЯМУЮ ' + (L.direct ? 'ОК' : 'НЕТ') + ' · СЕРВЕР ' + (L.relay ? 'ОК' : 'НЕТ') + '. ' : '') +
      'Отправь другу ссылку или продиктуй код. Друг: С ДРУГОМ > ВОЙТИ ПО КОДУ.';
    return;
  }
  if (NET.role === 'guest' || NET.joining) { view(null); st.textContent = 'ПОДКЛЮЧАЕМСЯ К ' + (NET.joining || NET.code) + '…';
    if (NET.viaRelay) hint.textContent = 'Напрямую не вышло, соединяемся через сервер…'; return; }
  if (NET.ui === 'enter') {
    view('nJoin'); st.textContent = NET.msg || 'ВВЕДИ КОД С ЭКРАНА ДРУГА';
    hint.textContent = 'Код из 5 букв и цифр виден на экране у того, кто создал игру.';
    return;
  }
  view('nIdle');
  hint.textContent = 'Создай игру и получишь код. Друг открывает эту же ссылку и входит по коду.';
  const open = NET.room.peers().filter(p => !p.isMe && p.presence && p.presence.app === 'azz' && p.presence.role === 'host' && p.presence.open);
  st.textContent = NET.msg || (open.length ? 'ДРУГ УЖЕ ЖДЁТ — ЗАХОДИ' : 'СОЗДАЙ ИГРУ ИЛИ ВОЙДИ ПО КОДУ');
  const need = [];
  for (const p of open) {
    const b = document.createElement('button'); b.className = 'mi join';
    const nm = (p.by && NET.names[p.by]) || 'ДРУГ';
    if (p.by && !(p.by in NET.names)) need.push(p.by);
    b.textContent = '▶ ВОЙТИ: ' + nm.toUpperCase().slice(0, 14) + ' · ' + (p.presence.mode === 'vs' ? 'ПРОТИВ' : 'ВМЕСТЕ');
    b.addEventListener('click', () => { audioInit(); joinGame(p.peer); });
    list.appendChild(b);
  }
  if (need.length && NET.user) {
    need.forEach(id => NET.names[id] = '');
    NET.user.profiles(need).then(ps => { for (const id of need) NET.names[id] = (ps && ps[id] && ps[id].name) || ''; if (!$('ovOnline').hidden) renderLobby(); }).catch(() => {});
  }
}
// ---- guest side
function guestSendInput() {
  const s = readStick();
  const k = keys.has('j') || keys.has(' ') || keys.has('z') || touchKick, t = keys.has('k') || keys.has('x') || touchTackle;
  if (NET.pk && !k) NET.kr++; if (t && !NET.pt) NET.tc++; NET.pk = k; NET.pt = t;
  const sp = keys.has('shift') || keys.has('u') || touchSprint, skb = keys.has('i') || touchSkill;
  if (skb && !NET.psk) NET.sk = (NET.sk || 0) + 1; NET.psk = skb;
  const inp = { mx: s ? r2(s.x) : 0, my: s ? r2(s.y) : 0, k: k ? 1 : 0, kr: NET.kr, tc: NET.tc, sp: sp ? 1 : 0, sk: NET.sk || 0 };
  const key = JSON.stringify(inp); if (key !== NET.lastIn) { NET.lastIn = key; setPresence({ in: inp }); }
}
function applySnap(s) {
  if (s.mid !== NET.mid) {
    NET.mid = s.mid; NET.mode = s.md; MODE = s.md === 'vs' ? 1 : 2; setTeams('nap', 'rom'); setTheme('stadium'); setPitch(MODE); buildTeams(MODE); game.pv = -1; parts = [];
    NET.lastEv = s.ev && s.ev.length ? s.ev[s.ev.length-1][0] : 0; showOv(null); startMusic();
    s.P.forEach((a, i) => { if (players[i]) { players[i].x = a[0]; players[i].y = a[1]; } });
    ball.x = s.B[0]; ball.y = s.B[1]; updCamera(0, true);
  }
  NET.snapAt = performance.now();
  if (s.pv !== game.pv && s.pt) {
    game.pv = s.pv; game.weather = s.wx;
    patches = (s.pt || []).map(([t, bl]) => ({ type: t ? 'puddle' : 'mud', blobs: bl.map(([x, y, rx, ry]) => ({ x, y, rx, ry })) }));
    buildField(); makeRain(s.wx);
  }
  const prevMode = game.mode;
  game.time = s.t; game.score = s.sc; if (s.fu) game.fury = s.fu; game.mode = s.gm; game.wind = { x: s.wd[0], y: s.wd[1] };
  game.shake = Math.max(game.shake, s.sh); game.flash = Math.max(game.flash, s.fl);
  game.bolt = s.bo ? { x: s.bo[0], y: s.bo[1], t: s.bo[2], seed: s.bo[3] } : null;
  game.announce = s.an ? { text: s.an[0], col: s.an[1], t: s.an[2] } : null;
  game.banner = s.bn ? { text: s.bn[0], col: s.bn[1], t: s.bn[2] } : null;
  game.chaos = s.ch ? { type: CHAOS_KEYS[s.ch[0]], t: s.ch[1] } : null;
  if (s.ve) { if (!game.vespa) game.vespa = { x: s.ve[0], y: s.ve[1], dir: s.ve[2], t: 0 };
    Object.assign(game.vespa, { tx: s.ve[0], ty: s.ve[1], dir: s.ve[2] }); } else game.vespa = null;
  items = (s.it || []).map(([k, x, y, t]) => ({ type: ITEMS[k], x, y, t }));
  pees = (s.pe || []).map(([x, y]) => ({ x, y, t: 1 })); game.skillCd = s.sk || [0, 0]; ball.miracle = !!s.bm;
  if (s.ho) { game.half = s.ho[0]; game.flip = s.ho[1];
    if (!s.ho[2]) game.show = null; else { const kind = s.ho[2] === 2 ? 'half' : 'intro'; if (!game.show || game.show.kind !== kind) game.show = { kind, t: 0, j: 0 }; game.show.t = s.ho[3]; game.show.j = s.ho[4]; game.show.wx = s.ho[5] || ''; } }
  game.runners = (s.ru || []).map(([k, x, y, z, dir, team]) => ({ k: RK[k], x, y, z, dir, team, t: 0 }));
  s.P.forEach((a, i) => { const p = players[i]; if (!p) return;
    p.tx = a[0]; p.ty = a[1]; p.vx = a[2]; p.vy = a[3];
    p.state = a[4]; p.st = a[5]; p.fx = a[6]; p.fy = a[7]; p.charge = a[8];
    p.mood = a[9] === 1 ? 'cheer' : a[9] === 2 ? 'sad' : null; p.fallExpr = EXPR[a[10]] || 'cry'; p.tag = a[11];
    p.human = a[11] > 0; p.local = a[11] === 2; p.kickSuper = !!a[15]; p.bike = !!a[16]; p.tz = a[17] || 0; p.buff = BUFFS[a[18]] || null;
    const sb = a[22] || 0; p.freeze = sb & 15 ? { k: FRZ[(sb & 15) - 1], t: 1 } : null; p.peeT = sb & 16 ? 1 : 0; p.poopT = sb & 32 ? 1 : 0;
    p.ghost = sb & 64 ? 1 : 0; p.cycle = sb & 128 ? 1 : 0; p.fear = sb & 256 ? { t: 1, dx: 0, dy: 0 } : null;
    p.stam = (a[19] === undefined ? 20 : a[19])/20; p.tired = !!a[20]; p.sprinting = !!a[21];
    p.emote = a[12] >= 0 ? { type: EMOS[a[12]], t: a[13], age: a[14] } : null;
    if (Math.abs(p.tx - p.x) > 60 || Math.abs(p.ty - p.y) > 60) { p.x = p.tx; p.y = p.ty; } });
  ball.tx = s.B[0]; ball.ty = s.B[1]; ball.tz = s.B[2]; ball.vx = s.B[3]; ball.vy = s.B[4]; ball.superType = SUPS[s.B[5]] || null;
  ball.beam = s.B[8] ? { x: s.B[6], y: s.B[7], t: s.B[8] } : null;
  ball.passAt = s.B[9] || s.B[10] ? { x: s.B[9], y: s.B[10] } : null; ball.passTo = players[s.B[11]] || null;
  if (Math.abs(ball.tx - ball.x) > 80) { ball.x = ball.tx; ball.y = ball.ty; ball.z = ball.tz; }
  for (const e of (s.ev || [])) { if (e[0] <= NET.lastEv) continue; NET.lastEv = e[0];
    if (e[1] === 's') { if (e[2] === 'whistle' && game.mode === 'end') stopMusic(); sfxLocal(e[2]); if (e[2] === 'hit') buzz(20); }
    if (e[1] === 'b') { burst(e[2], e[3], e[4], e[5], true); if (e[2] === 'goal') buzz(50); } }
  if (game.mode === 'end' && prevMode !== 'end') endMatch();
  if ((game.mode === 'play' || game.mode === 'show') && prevMode === 'end') { showOv(null); startMusic(); }
}
function guestUpdate(dt) {
  game.shake = Math.max(0, game.shake - dt); game.flash = Math.max(0, game.flash - dt*2);
  if (!NET.room) return;
  const h = NET.room.peers().find(p => p.peer === NET.hostPeer), s = h && h.presence && h.presence.s;
  if (s && s !== NET.lastS && s.gp === NET.myPeer && Array.isArray(s.P)) { NET.lastS = s; applySnap(s); }
  updRain(dt); updParts(dt); chaosFx(dt); if (game.mode === 'show') updShow(dt);
  if (NET.mid < 0) return;
  guestSendInput();
  // between snapshots keep everything moving along its last velocity (up to 0.4 s), then glide toward it,
  // so a late packet doesn't freeze the picture
  const k = Math.min(1, dt*12), predict = (performance.now() - NET.snapAt) < 400;
  for (const p of players) { if (p.tx === undefined) continue;
    if (predict && p.state <= ST.RUN) { p.tx += p.vx*dt; p.ty += p.vy*dt; }
    p.x += (p.tx - p.x)*k; p.y += (p.ty - p.y)*k; p.z += ((p.tz || 0) - p.z)*k; p.st += dt;
    const spd = hyp(p.vx, p.vy), prev = Math.floor(p.anim/20); p.anim += spd*dt;
    if (p.state === ST.RUN && spd > 50 && Math.floor(p.anim/20) !== prev) { const q = P(p.x - p.fx*6, p.y); spawn(q.x-2, q.y-2, -p.fx*12, -8, 0.3, '#e8f4e0', 2, 0); }
    if (p.emote) { p.emote.t -= dt; p.emote.age += dt; if (p.emote.t <= 0) p.emote = null; } }
  const v = game.vespa; if (v && v.tx !== undefined) { v.t += dt; v.x += v.dir*VSPD*dt; v.x += (v.tx - v.x)*k*0.5; v.y += (v.ty - v.y)*k; }
  for (const it of items) it.t -= dt;
  if (ball.tx !== undefined) { if (predict) { ball.tx += ball.vx*dt; ball.ty += ball.vy*dt; } ball.x += (ball.tx - ball.x)*k; ball.y += (ball.ty - ball.y)*k; ball.z += (ball.tz - ball.z)*k; ball.rot += hyp(ball.vx, ball.vy)*dt; }
  if (ball.superType) superFx(ball);
  if (game.bolt) { game.bolt.t -= dt; if (game.bolt.t <= 0) game.bolt = null; }
  if (game.banner) game.banner.t += dt;
  if (game.announce) { game.announce.t -= dt; if (game.announce.t <= 0) game.announce = null; }
  updCamera(dt, false);
}
function lobbyFocus() {
  if ($('ovOnline').hidden) return;
  const el = !$('nJoin').hidden ? $('codeIn') : $('ovOnline').querySelector('.items:not([hidden]) .mi');
  if (el) setTimeout(() => el.focus({ preventScroll: true }), 30);
}
// a shared link ?join=CODE goes straight to joining
function tryAutoJoin() {
  if (!NET.autoJoin || !NET.booted) return;
  showOv('ovOnline');
  if (!NET.ready) return;
  const code = NET.autoJoin; NET.autoJoin = null;
  try { const u = new URL(location.href); u.searchParams.delete('join'); history.replaceState(null, '', u); } catch (e) {}
  NET.ui = 'enter'; $('codeIn').value = code; joinByCode(code);
}
function shareLink() {
  const u = new URL(location.href); u.hash = ''; u.searchParams.set('join', NET.code);
  return u.toString();
}
async function shareGame() {
  const url = shareLink(), text = 'Сыграем в Azzurri Arcade? Код игры: ' + NET.code;
  const done = t => { $('miShare').textContent = t; setTimeout(() => { $('miShare').textContent = 'ПОДЕЛИТЬСЯ'; }, 2000); };
  if (navigator.share) { try { await navigator.share({ title: 'Azzurri Arcade', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text + '\n' + url); done('ССЫЛКА СКОПИРОВАНА'); }
  catch (e) { $('netHint').textContent = url; done('СКОПИРУЙ ССЫЛКУ НИЖЕ'); }
}
// connect to the room when the viewer offers one
(async () => {
  try {
    // The transport is pluggable: see src/net/. Any object with presence()/peers()/onPeers() works.
    const net = window.AzzNet ? await window.AzzNet.connect() : null;
    const room = net && net.room;
    if (!room) { NET.room = false; if (!$('ovOnline').hidden) renderLobby(); return; }
    NET.room = room; NET.user = net.user || null;
    room.onPeers(onNetPeers, () => { NET.room = false; NET.ready = false; if (NET.role !== 'solo') netLost('СВЯЗЬ ПРОПАЛА'); else if (!$('ovOnline').hidden) renderLobby(); });
    await room.presence({ app: 'azz', role: 'idle' });
    NET.ready = true; NET.myPeer = myPeerId();
    if (!$('ovOnline').hidden) renderLobby();
    tryAutoJoin();
  } catch (e) { NET.room = false; NET.ready = false; if (!$('ovOnline').hidden) renderLobby(); }
})();

// ================== mascots & half-time ==================
// Before kick-off both clubs' mascots (a costume with a giant emoji head) walk out to the centre circle, dance
// and shout their chant; at half-time they come back while the board shows the score and a silly stat. Then the
// teams swap ends (game.flip) and the other side kicks off. game.show = { kind: 'intro' | 'half', t, j }.
const SHOW_LEN = { intro: 4.6, half: 5 };
const HALF_JOKES = ['ТРЕНЕР ЕСТ ЧИПСЫ', 'ВЛАДЕНИЕ: 50% ПАНИКИ', 'ВРАТАРЬ ЗВОНИТ МАМЕ', 'СУДЬЯ УШЁЛ ЗА ШАУРМОЙ',
  'КОММЕНТАТОР УСНУЛ', 'ТАКТИКА: БЕЖАТЬ К МЯЧУ', 'ФАНАТЫ СПОРЯТ О ПИЦЦЕ', 'НАПАДАЮЩИЙ ИЩЕТ БУТСУ', 'УДАРОВ В СТВОР: ПРИМЕРНО', 'xG: НЕ СПРАШИВАЙ'];
function startShow(kind) {
  game.show = { kind, t: 0, j: Math.floor(Math.random()*HALF_JOKES.length) }; game.mode = 'show';
  ball.owner = null; Object.assign(ball, { x: LEN/2, y: WID/2, z: 0, vx: 0, vy: 0, vz: 0, superType: null, beam: null, passTo: null, passAt: null });
  if (kind === 'half') { sfx('whistle'); game.banner = null; game.announce = null; game.show.wx = halfWeather();
    const [a, b] = game.score; for (const p of players) { p.mood = a === b ? null : (a > b) === (p.team === 0) ? 'cheer' : 'sad'; p.charge = 0; } }
  else sfx('skill');
}
// where a mascot stands at show time t (field units); phase: 0 walk in, 1 dance, 2 walk off
function mascotPos(team, t, kind) {
  const L = SHOW_LEN[kind], s = team ? 1 : -1, hx = LEN/2 + s*44, hy = WID/2 + 24;
  if (t < 1.4) { const k = t/1.4; return { x: hx + s*(1 - k)*170, y: hy + (1 - k)*30, ph: 0 }; }
  if (t < L - 0.9) return { x: hx, y: hy, ph: 1 };
  const k = (t - (L - 0.9))/0.9; return { x: hx, y: hy + k*(WID/2 + 30), ph: 2 };
}
let showTap = false;   // a tap on the pitch skips the show too
cv.addEventListener('pointerdown', () => { if (game.mode === 'show') showTap = true; });
function updShow(dt) {
  const sh = game.show; if (!sh) return;
  sh.t += dt;
  if (sh.t > 1.4 && sh.t < SHOW_LEN[sh.kind] - 0.9 && Math.random() < dt*14) {   // confetti in both clubs' colours
    const s = P(LEN/2 + rnd(-110, 110), WID/2 + 24, 70); spawn(s.x, s.y - 30, rnd(-40, 40), rnd(-30, 10), rnd(0.8, 1.4), [TEAMS[0].color, TEAMS[1].color, '#ffffff', '#ffd23a'][Math.floor(Math.random()*4)], 2, 40); }
  if (NET.role === 'guest') return;
  for (const p of players) { const i = p.inp; i.mx = i.my = 0; i.kickHeld = i.kickReleased = i.tacklePressed = i.sprint = false; updPlayer(p, dt); }
  separate(); updBall(dt);
  const skip = NET.role === 'solo' && sh.t > 0.6 && (keys.has('j') || keys.has(' ') || keys.has('enter') || touchKick || showTap);
  showTap = false;
  if (sh.t < SHOW_LEN[sh.kind] && !skip) return;
  game.show = null; game.banner = null; touchKick = false; keys.delete('j'); keys.delete(' '); keys.delete('enter');
  if (sh.kind === 'half') {
    game.flip = 1; game.half = 2; kickoff(1); game.announce = { text: '2-Й ТАЙМ!', col: '#ffe14a', t: 1.4 };
  } else { kickoff(0); game.announce = game.modTxt ? { text: game.modTxt + '!', col: '#ff9a5a', t: 1.6 } : game.introAnn; }
}
// ---- living mascots: each is its own character drawn pixel by pixel (48x60 cell, feet at y 58, facing right).
// A spec paints the body with the helpers below; legs and arms are shared: walk frames swing them, 'dance'
// raises the arms, 'flex' shows the biceps. Cached per type, pose, blink and club (some wear the club's kit).
const MW = 48, MH = 60, MCX = 24, MFY = 58, MSPR = new Map();
const MASC_STYLE = { penguin: 'flex', bull: 'flex', wolf: 'flex', horse: 'flex', ghost: 'float' };
const MASC_BY_EMO = { pizza: 'pizza', volcano: 'pizza', wolf: 'wolf', ghost: 'ghost', money: 'note', rocket: 'rocket', horse: 'horse', ger: 'horse', bow: 'horse',
  eagle: 'eagle', bowl: 'eagle', baguette: 'baguette', croissant: 'baguette', beret: 'baguette', sausage: 'sausage', pretzel: 'sausage', tea: 'teapot', umbrella: 'teapot',
  bull: 'bull', paella: 'bull', rooster: 'rooster', sardine: 'fish', cheese: 'cheese', tulip: 'cheese', clog: 'cheese', penguin: 'penguin', snowflake: 'penguin',
  crab: 'crab', anchor: 'crab', candle: 'candle', key: 'candle', fish: 'fish', trident: 'fish' };
function mascotSprite(type, pose, blink, club) {
  const key = type + '|' + pose + '|' + (blink ? 1 : 0) + '|' + club.code; let c = MSPR.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = MW; c.height = MH; const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const E = (cx, cy, rx, ry, col) => { for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx*Math.sqrt(Math.max(0, 1 - (dy/(ry + 0.5))**2))); R(cx - hw, cy + dy, hw*2 + 1, 1, col); } };
  const walk = pose.startsWith('walk'), ph = +pose.slice(-1), arms = pose.startsWith('flex') ? 'flex' : pose.startsWith('dance') ? 'up' : 'down';
  const H = {
    legs(hipY, col, shoe, o) {   // two legs from the hips to the feet; walking swings them, dancing spreads them
      o = o || {}; const w = o.w || 3, gap = o.gap || 2, sw = o.shoeW || 5, sh = o.shoeH || 2;
      [[MCX - gap - w, -1], [MCX + gap, 1]].forEach(([x0, side]) => {
        const off = walk ? (ph ? side : -side)*3 : side*2, lift = !walk && ph === (side > 0 ? 1 : 0) ? 2 : walk && (ph ? side : -side) > 0 ? 1 : 0;
        const y1 = MFY - sh - lift;
        for (let y = hipY; y < y1; y++) { const k = (y - hipY)/Math.max(1, y1 - hipY); R(x0 + off*k, y, w, 1, o.sock && k > 0.55 ? o.sock : col); }
        R(x0 + off - 1, y1, sw, sh, shoe);
      });
    },
    arms(sx, sy, col, hand, o) {   // returns where the hands are, for claws and gloves
      o = o || {}; const w = o.w || 2, len = o.len || 8, hw = o.hw || w + 1, hh = o.hh || 2, out = [];
      for (const side of [-1, 1]) {
        const x = side < 0 ? MCX - sx - w : MCX + sx;
        if (arms === 'down') { const sw = walk ? (ph ? side : -side) : 0; R(x + sw, sy, w, len, col); if (o.hi) R(x + sw + (side < 0 ? 0 : w - 1), sy + 1, 1, len - 2, o.hi); R(x + sw - (side < 0 ? hw - w : 0), sy + len, hw, hh, hand); out.push([x + sw, sy + len]); }
        else if (arms === 'up') { const up = (ph ? side : -side) > 0 ? 2 : 0, ox = side*2;
          for (let k = 0; k < len; k++) R(x + ox*k/len, sy - k, w, 1, col); R(x + ox - (side < 0 ? hw - w : 0), sy - len - hh - up, hw, hh + up, hand); out.push([x + ox, sy - len - hh - up]); }
        else { const ux = side < 0 ? x - 6 : x, fx = side < 0 ? ux : ux + 6 + w - w, pump = ph ? 1 : 0;   // flex: biceps up
          R(ux, sy, 6 + w, w, col); R(ux + 1 + (side < 0 ? 0 : 1), sy - 2 - pump, 5, 2 + pump, col); R(fx, sy - 7, w, 7, col);
          if (o.hi) { R(ux + 2 + (side < 0 ? 0 : 1), sy - 2 - pump, 3, 1, o.hi); R(fx + (side < 0 ? 0 : w - 1), sy - 6, 1, 4, o.hi); }
          R(fx - 1, sy - 7 - hh - 1, w + 2, hh + 1, hand); out.push([fx, sy - 9]); }
      }
      return out;
    },
    eyes(x, y, o) {   // big cartoon eyes looking right; blink = a line
      o = o || {}; const gap = o.gap || 5;
      for (const ex of o.one ? [x] : [x, x + gap]) {
        if (blink) { R(ex, y + 1, 3, 1, PAL.ink); continue; }
        R(ex, y, 3, 3, o.white || '#ffffff'); R(ex + 1 + (o.cross ? 0 : 1), y + 1, 1, 2, o.pupil || PAL.ink);
        if (o.brow) R(ex - (o.brow > 0 ? 0 : 1), y - 1 - (o.brow > 1 ? 1 : 0), 4, 1, PAL.ink);
      }
    },
    mouth(x, y, open) { if (open) { R(x, y, 5, 3, PAL.ink); R(x + 1, y + 1, 3, 2, '#e8344a'); } else { R(x, y + 1, 5, 1, PAL.ink); R(x - 1, y, 1, 1, PAL.ink); R(x + 5, y, 1, 1, PAL.ink); } },
  };
  const talk = !walk && ph === 1, C = club;
  (MASC[type] || MASC.banana)(R, E, H, { talk, walk, ph, C });
  outline(g, PAL.ink, MW, MH); MSPR.set(key, c); return c;
}
const MASC = {
  penguin(R, E, H, f) {   // ПИНГВИН-КАЧОК: abs, chain, sweatband and huge flippers
    H.legs(49, '#ff9a1a', '#ff9a1a', { w: 3, shoeW: 7 });
    E(MCX, 35, 11, 15, '#202030'); E(MCX + 1, 38, 7, 11, '#f4f4f4');
    R(21, 35, 8, 1, '#c8c8d4'); R(21, 39, 8, 1, '#c8c8d4'); R(21, 43, 8, 1, '#c8c8d4'); R(25, 34, 1, 13, '#c8c8d4');
    R(14, 23, 21, 2, '#d8243a'); R(17, 31, 15, 1, '#ffd23a'); R(23, 32, 3, 2, '#ffd23a');
    H.eyes(22, 26, { brow: 1 }); R(31, 28, 6, 2, '#ff9a1a'); R(31, 30, 5, 1, '#d87a10');
    H.arms(10, 32, '#2a2a3c', '#2a2a3c', { w: 4, len: 9, hw: 5, hh: 3, hi: '#5a5a74' });
  },
  pizza(R, E, H, f) {   // a slice with legs
    H.legs(42, '#e8b070', '#d8243a', { w: 2, gap: 2 });
    for (let y = 16; y <= 46; y++) { const w = Math.round(28*(1 - (y - 16)/32)) + 2, x0 = MCX - Math.floor(w/2); R(x0, y, w, 1, '#ffd23a'); R(x0 + w - 2, y, 2, 1, '#f0a020'); }
    R(9, 12, 30, 5, '#c8803a'); R(10, 12, 28, 2, '#f0c070'); R(28, 21, 2, 9, '#ffd23a'); R(28, 30, 2, 2, '#f0a020');
    E(15, 21, 2, 2, '#c8302a'); E(32, 22, 2, 2, '#c8302a'); E(24, 35, 2, 2, '#c8302a'); R(19, 31, 2, 1, '#3a9a3a'); R(27, 29, 2, 1, '#3a9a3a');
    H.eyes(19, 20); H.mouth(21, 26, f.talk);
    H.arms(12, 19, '#e8b070', '#ffffff', { w: 2, len: 8, hw: 4, hh: 3 });
  },
  banana(R, E, H, f) {
    H.legs(46, '#202030', '#ffffff', { w: 2, shoeW: 6, shoeH: 3 });
    const cx = y => 21 + Math.round(7*((y - 29)/18)**2);
    for (let y = 11; y <= 47; y++) { const w = Math.round(12*Math.sin(Math.PI*(y - 9)/40)) + 2, x0 = cx(y) - Math.floor(w/2); R(x0, y, w, 1, '#ffe14a'); R(x0 + w - 2, y, 2, 1, '#e8b020'); R(x0 + 1, y, 1, 1, '#fff6b0'); }
    R(cx(11) - 1, 6, 3, 6, '#6a4a1a'); R(cx(47) - 1, 47, 3, 2, '#3a2a10'); R(18, 33, 2, 1, '#c89a1a'); R(24, 40, 2, 1, '#c89a1a');
    H.eyes(17, 22); H.mouth(19, 28, f.talk);
    H.arms(10, 29, '#202030', '#ffffff', { w: 2, len: 8, hw: 4, hh: 3 });
  },
  horse(R, E, H, f) {   // a horse that walks like a man, in a deel
    R(12, 34, 3, 12, '#201818'); R(11, 44, 3, 4, '#201818');
    H.legs(44, '#8a5a2a', '#2a2020', { w: 4, gap: 2, shoeW: 6, shoeH: 3 });
    R(16, 27, 16, 19, f.C.jersey); R(16, 27, 2, 19, f.C.trim || '#ffd23a'); R(16, 38, 16, 2, '#ffd23a'); R(30, 27, 2, 19, f.C.jerseyS);
    R(23, 18, 7, 10, '#8a5a2a'); E(29, 14, 6, 5, '#8a5a2a'); R(31, 13, 10, 7, '#8a5a2a'); R(31, 18, 10, 2, '#6a4422'); R(39, 15, 1, 1, '#3a2010');
    R(26, 5, 2, 5, '#8a5a2a'); R(29, 5, 2, 5, '#8a5a2a'); R(20, 8, 4, 18, '#201818'); R(19, 10, 2, 3, '#201818'); R(19, 16, 2, 3, '#201818');
    H.eyes(28, 11, { one: true, brow: 1 }); R(34, 20, 6, 1, '#ffffff'); if (f.talk) R(34, 21, 6, 2, PAL.ink);
    H.arms(9, 29, '#8a5a2a', '#2a2020', { w: 3, len: 9, hw: 4, hh: 3, hi: '#b07a40' });
  },
  eagle(R, E, H, f) {   // the golden eagle, scarf in the club colour
    H.legs(46, '#ffd23a', '#ffd23a', { w: 2, shoeW: 7 });
    E(MCX, 36, 10, 12, '#6a4422'); for (let k = 0; k < 4; k++) R(19 + (k % 2)*4, 32 + k*4, 6, 1, '#8a5a2a');
    E(26, 19, 7, 7, '#d8a040'); R(20, 13, 6, 2, '#f0c060'); R(32, 18, 5, 3, '#ffd23a'); R(35, 21, 2, 2, '#c89a1a');
    R(18, 26, 15, 3, f.C.jersey); R(28, 28, 3, 5, f.C.jersey);
    H.eyes(26, 16, { one: true, brow: 2 });
    const hs = H.arms(10, 31, '#6a4422', '#3a2210', { w: 4, len: 9, hw: 5, hh: 4 });
    for (const [x, y] of hs) R(x, y + 4, 4, 1, '#d8a040');
  },
  wolf(R, E, H, f) {   // the she-wolf of Rome, in the kit
    R(11, 33, 4, 9, '#8a8a98'); R(10, 40, 3, 3, '#c8c8d4');
    H.legs(45, '#8a8a98', '#4a4a58', { w: 4, gap: 2, shoeW: 6, shoeH: 3 });
    R(16, 28, 17, 15, f.C.jersey); R(16, 28, 17, 2, f.C.trim || '#ffd23a'); R(16, 42, 17, 4, f.C.shorts);
    E(25, 19, 8, 7, '#8a8a98'); R(31, 19, 7, 5, '#8a8a98'); R(31, 22, 7, 2, '#c8c8d4'); R(36, 19, 3, 2, PAL.ink);
    R(19, 8, 3, 6, '#8a8a98'); R(26, 8, 3, 6, '#8a8a98'); R(20, 10, 1, 3, '#e89ab0'); R(27, 10, 1, 3, '#e89ab0');
    H.eyes(25, 15, { one: true, white: '#ffd23a', brow: 2 }); R(32, 24, 1, 2, '#ffffff'); R(36, 24, 1, 2, '#ffffff'); if (f.talk) R(32, 24, 5, 1, PAL.ink);
    H.arms(10, 30, '#8a8a98', '#6a6a78', { w: 4, len: 9, hw: 5, hh: 3, hi: '#b0b0c0' });
  },
  ghost(R, E, H, f) {   // floats, no legs
    E(MCX, 22, 12, 12, '#f4f4f8'); R(12, 22, 25, 24, '#f4f4f8'); R(33, 22, 4, 24, '#c8c8e0');
    for (let x = 12; x < 37; x += 4) R(x, 46 + ((x/4 + f.ph) % 2)*2, 3, 3, '#f4f4f8');
    if (f.talk) E(26, 34, 2, 3, PAL.ink); else R(24, 34, 5, 2, PAL.ink);
    H.eyes(20, 24, { pupil: PAL.ink, white: PAL.ink }); R(20, 24, 1, 1, '#ffffff'); R(25, 24, 1, 1, '#ffffff');
    H.arms(12, 30, '#f4f4f8', '#f4f4f8', { w: 4, len: 5, hw: 4, hh: 2 });
  },
  note(R, E, H, f) {   // a hundred-trillion banknote with legs, top hat and gloves
    H.legs(46, '#202030', '#202030', { w: 2, shoeW: 6 });
    R(13, 14, 22, 32, '#7ab868'); R(15, 16, 18, 28, '#a8d890'); R(31, 16, 2, 28, '#7ab868');
    for (let i = 0; i < 5; i++) { R(16 + i*3, 17, 2, 3, '#3a7a2a'); R(16 + i*3 + 0, 41, 2, 3, '#3a7a2a'); }
    E(24, 29, 6, 7, '#cfe8c0'); H.eyes(20, 26); H.mouth(21, 32, f.talk);
    R(16, 11, 16, 3, '#202030'); R(19, 2, 10, 9, '#202030'); R(19, 8, 10, 2, '#d8243a');
    H.arms(11, 26, '#202030', '#ffffff', { w: 2, len: 8, hw: 4, hh: 3 });
  },
  rocket(R, E, H, f) {
    H.legs(44, '#a8a8b8', '#202030', { w: 3, shoeW: 6, shoeH: 3 });
    for (let y = 2; y < 14; y++) { const w = Math.round((y - 1)*1.1); R(MCX - Math.floor(w/2), y, w, 1, '#d8243a'); }
    R(18, 13, 12, 32, '#e8e8f0'); R(27, 13, 3, 32, '#a8a8b8'); R(13, 34, 5, 11, '#d8243a'); R(30, 34, 5, 11, '#d8243a');
    E(24, 22, 4, 4, '#4ab8ff'); R(21, 19, 3, 2, '#c8f0ff');
    H.eyes(20, 21, { gap: 5 }); R(22, 31, 4, 4, '#d8243a'); R(21, 32, 6, 2, '#d8243a');
    H.mouth(21, 37, f.talk);
    H.arms(6, 26, '#a8a8b8', '#202030', { w: 3, len: 8, hw: 4, hh: 3 });
  },
  baguette(R, E, H, f) {   // with a beret and a moustache
    H.legs(46, '#202030', '#202030', { w: 2, shoeW: 6, sock: '#ffffff' });
    E(24, 9, 6, 4, '#d89a4a'); R(18, 9, 13, 38, '#d89a4a'); R(28, 9, 3, 38, '#b0742a');
    for (let k = 0; k < 4; k++) R(19, 24 + k*6, 7, 1, '#f0c070');
    E(24, 5, 8, 2, '#202030'); R(24, 1, 2, 2, '#202030');
    H.eyes(19, 11); R(19, 17, 11, 2, '#202030'); R(18, 16, 2, 1, '#202030'); R(29, 16, 2, 1, '#202030'); if (f.talk) R(22, 19, 5, 2, PAL.ink);
    R(18, 21, 13, 2, '#d8243a');
    H.arms(7, 24, '#202030', '#ffffff', { w: 2, len: 8, hw: 4, hh: 3 });
  },
  sausage(R, E, H, f) {   // bratwurst in lederhosen and a Tyrolean hat
    H.legs(46, '#c8603a', '#6a4a2a', { w: 3, shoeW: 6, sock: '#ffffff' });
    E(24, 12, 7, 4, '#c8603a'); R(17, 12, 15, 34, '#c8603a'); E(24, 46, 7, 2, '#c8603a'); R(29, 12, 3, 34, '#9a4022'); R(19, 14, 2, 26, '#e8906a');
    R(16, 6, 17, 3, '#3a6a2a'); R(19, 1, 11, 5, '#3a6a2a'); R(30, 0, 2, 6, '#d8243a');
    H.eyes(19, 14); R(19, 20, 11, 2, '#6a4a2a'); H.mouth(21, 23, f.talk);
    R(17, 30, 15, 16, '#6a4a2a'); R(19, 26, 2, 6, '#6a4a2a'); R(28, 26, 2, 6, '#6a4a2a'); R(19, 33, 11, 2, '#8a6a3a');
    H.arms(8, 27, '#c8603a', '#c8603a', { w: 3, len: 8, hw: 4, hh: 3 });
  },
  teapot(R, E, H, f) {   // a proper gentleman: top hat and monocle
    H.legs(44, '#202030', '#202030', { w: 3, shoeW: 6 });
    E(24, 35, 12, 10, '#f4f4f8'); R(13, 33, 23, 2, '#2a4ad8'); for (let k = 0; k < 4; k++) R(15 + k*6, 39, 2, 2, '#2a4ad8');
    R(35, 31, 4, 3, '#f4f4f8'); R(38, 27, 3, 5, '#f4f4f8'); R(10, 29, 3, 10, '#f4f4f8'); R(11, 28, 4, 2, '#f4f4f8'); R(11, 38, 4, 2, '#f4f4f8');
    E(24, 25, 8, 2, '#f4f4f8'); R(16, 22, 16, 2, '#202030'); R(19, 11, 10, 11, '#202030'); R(19, 19, 10, 2, '#d8243a');
    H.eyes(19, 29); R(23, 28, 5, 5, '#ffd23a'); R(24, 29, 3, 3, '#ffffff'); R(25, 30, 1, 2, PAL.ink); R(27, 33, 1, 5, '#ffd23a');
    R(19, 34, 9, 1, '#202030'); if (f.talk) R(21, 36, 5, 2, PAL.ink);
    H.arms(12, 33, '#202030', '#ffffff', { w: 2, len: 8, hw: 4, hh: 3 });
  },
  bull(R, E, H, f) {   // pumped, nose ring, bandana
    H.legs(45, '#2a2a32', '#4a4a58', { w: 5, gap: 1, shoeW: 7, shoeH: 3 });
    E(MCX, 34, 11, 11, '#2a2a32'); R(18, 29, 6, 4, '#4a4a58'); R(26, 29, 6, 4, '#4a4a58'); R(21, 36, 8, 1, '#3a3a48'); R(21, 40, 8, 1, '#3a3a48');
    R(15, 42, 19, 5, '#d8243a');
    E(26, 17, 7, 6, '#2a2a32'); R(29, 18, 8, 6, '#5a4a48'); R(32, 20, 1, 1, PAL.ink); R(35, 20, 1, 1, PAL.ink); R(32, 24, 4, 2, '#ffd23a');
    R(18, 9, 3, 4, '#f4f0dc'); R(16, 7, 2, 3, '#f4f0dc'); R(31, 9, 3, 4, '#f4f0dc'); R(33, 7, 2, 3, '#f4f0dc');
    R(19, 23, 14, 3, '#d8243a'); H.eyes(23, 14, { white: '#ff4a3a', brow: 2 });
    H.arms(11, 30, '#2a2a32', '#4a4a58', { w: 5, len: 9, hw: 5, hh: 3, hi: '#5a5a6a' });
  },
  rooster(R, E, H, f) {   // the Barcelos rooster: black with bright hearts
    R(9, 22, 4, 16, '#2a4ad8'); R(12, 20, 3, 12, '#2a9a3a'); R(7, 28, 3, 12, '#d8243a'); R(14, 18, 2, 8, '#ffd23a');
    H.legs(45, '#ffd23a', '#ffd23a', { w: 2, shoeW: 7 });
    E(24, 35, 9, 11, '#202030'); E(22, 35, 2, 2, '#d8243a'); E(27, 39, 2, 2, '#ffd23a'); E(21, 41, 1, 1, '#2a4ad8'); E(28, 32, 1, 1, '#ffffff');
    E(27, 18, 6, 6, '#202030'); R(23, 8, 3, 5, '#d8243a'); R(26, 7, 3, 6, '#d8243a'); R(29, 9, 3, 4, '#d8243a');
    R(33, 18, 5, 2, '#ffd23a'); R(33, 20, 4, 1, '#e8a020'); R(32, 22, 2, 4, '#d8243a');
    H.eyes(27, 15, { one: true, brow: 1 }); if (f.talk) R(34, 20, 3, 1, PAL.ink);
    H.arms(9, 31, '#202030', '#d8243a', { w: 3, len: 8, hw: 4, hh: 3 });
  },
  cheese(R, E, H, f) {   // a wedge of gouda in clogs
    H.legs(44, '#ff8a1a', '#f0c040', { w: 3, shoeW: 8, shoeH: 3 });
    for (let x = 11; x <= 37; x++) { const top = Math.round(14 + (x - 11)*0.55); R(x, top, 1, 45 - top, '#ffd23a'); R(x, top, 1, 2, '#fff0a0'); }
    R(35, 34, 3, 11, '#e0a020'); E(15, 34, 2, 2, '#e0a020'); E(31, 38, 2, 2, '#e0a020'); E(22, 41, 1, 1, '#e0a020'); E(33, 29, 1, 1, '#e0a020');
    H.eyes(18, 23); H.mouth(20, 29, f.talk);
    H.arms(13, 28, '#ffd23a', '#ffffff', { w: 2, len: 8, hw: 4, hh: 3 });
  },
  crab(R, E, H, f) {   // walks on two legs, waves its claws
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) R(s < 0 ? 9 - k : 36 + k, 30 + k*3, 4, 2, '#e84a2a');
    H.legs(38, '#e84a2a', '#a82a1a', { w: 3, shoeW: 5, shoeH: 3 });
    R(19, 16, 2, 9, '#e84a2a'); R(28, 16, 2, 9, '#e84a2a'); E(20, 15, 2, 2, '#ffffff'); E(29, 15, 2, 2, '#ffffff');
    R(21, 15, 1, 2, PAL.ink); R(30, 15, 1, 2, PAL.ink);
    E(24, 31, 12, 8, '#e84a2a'); R(16, 35, 18, 3, '#a82a1a'); H.mouth(22, 30, f.talk);
    const hs = H.arms(12, 30, '#e84a2a', '#e84a2a', { w: 3, len: 6, hw: 7, hh: 5 });
    for (const [x, y] of hs) R(x + 1, y, 1, 3, PAL.ink);
  },
  candle(R, E, H, f) {   // a Vatican candle in red papal shoes
    H.legs(46, '#f4f0e0', '#d8243a', { w: 2, shoeW: 6 });
    R(18, 16, 12, 31, '#f4f0e0'); R(27, 16, 3, 31, '#c8c0a8'); R(18, 16, 3, 6, '#fffef8'); R(24, 16, 2, 8, '#fffef8');
    R(23, 11, 2, 5, '#202020'); E(24, 6, 3, 5 - f.ph, '#ff8a1a'); E(24, 7, 1, 3, '#ffe14a');
    R(23, 33, 2, 8, '#ffd23a'); R(21, 35, 6, 2, '#ffd23a');
    H.eyes(19, 21); H.mouth(21, 27, f.talk);
    H.arms(8, 25, '#f4f0e0', '#ffffff', { w: 2, len: 8, hw: 4, hh: 3 });
  },
  fish(R, E, H, f) {   // a fish on long hairy human legs
    H.legs(36, '#ffd0b8', '#d8243a', { w: 2, gap: 3, shoeW: 6, shoeH: 3 });
    R(17, 42, 1, 1, '#6a3a2a'); R(30, 40, 1, 1, '#6a3a2a'); R(18, 47, 1, 1, '#6a3a2a');
    for (let k = 0; k < 7; k++) R(5 + k, 22 + k, 2, 16 - k*2, '#2ad8c8');
    E(25, 29, 14, 9, '#2ad8c8'); R(13, 31, 26, 4, '#c8f8f0'); R(19, 19, 9, 3, '#1a9a9a');
    for (let k = 0; k < 4; k++) R(15 + k*4, 26 + (k % 2)*2, 2, 1, '#1a9a9a');
    E(32, 26, 3, 3, '#ffffff'); R(33, 26, 1, 2, PAL.ink);
    R(37, 30, 3, 3, '#ff8a9a'); if (f.talk) R(38, 31, 2, 1, PAL.ink);
    H.arms(6, 31, '#1a9a9a', '#2ad8c8', { w: 3, len: 4, hw: 4, hh: 2 });
  },
};
// what a club brings: its own mascot from data.js, or one made from its emoji (a custom club), else the banana
const mascotOf = team => { const c = TEAMS[team]; if (c.mascot) return c.mascot;
  const e = c.emo && c.emo[0], ty = MASC_BY_EMO[e] || 'banana'; return [ty === 'banana' ? 'БАНАН' : (EMO_RU[e] || 'ТАЛИСМАН'), ty, 'ВПЕРЁД!']; };
function drawMascot(team) {
  const sh = game.show, m = mascotOf(team), c = TEAMS[team], q = mascotPos(team, sh.t, sh.kind), s = S(q.x, q.y), t = sh.t;
  const type = m[1], style = MASC_STYLE[type] || 'dance';
  const pose = q.ph === 1 ? (style === 'flex' ? 'flex' : 'dance') + (Math.floor(t*4 + team) % 2) : 'walk' + (Math.floor(t*8) % 2);
  const blink = (t*10 + team*13) % 28 < 1.4, img = mascotSprite(type, pose, blink, c);
  const hop = style === 'float' ? Math.round(5 + Math.sin(t*4 + team)*3) : q.ph === 1 ? Math.round(Math.abs(Math.sin(t*8 + team))*4) : 0;
  // walking in: face the way you go; dancing: turn around now and then
  const faceL = q.ph === 0 ? team === 1 : q.ph === 1 ? (Math.floor(t*1.5 + team) % 2 === 1) : team === 1;
  const x = Math.round(s.x), y = Math.round(s.y);
  pellipse(s.x, s.y, 11, 2, 'rgba(0,30,0,.35)');
  if (faceL) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(img, -MCX, y - MFY - hop); ctx.restore(); }
  else ctx.drawImage(img, x - MCX, y - MFY - hop);
  if (q.ph === 1) {   // name tag and the chant
    ptext(ctx, m[0], x, y - 68 - team*9, 8, c.color === '#ffffff' ? '#ffffff' : c.color, 'center', '#100810');
    const ct = t - 1.8 - team*0.7; if (ct > 0 && ct < 1.2) ptext(ctx, m[2], x, y - 86, 8, '#ffffff', 'center', '#100810');
  }
}
function drawHalfBoard() {
  const sh = game.show; if (!sh || sh.kind !== 'half' || sh.t < 0.5) return;
  const wx = sh.wx || '', w = Math.min(W - 16, 220), hh = wx ? 62 : 50, x = Math.round((W - w)/2), y = 40, j = HALF_JOKES[sh.j % HALF_JOKES.length];
  ctx.fillStyle = '#100810'; ctx.fillRect(x, y, w, hh); ctx.fillStyle = '#ffd23a'; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + hh - 2, w - 2, 1);
  ptext(ctx, 'ПЕРЕРЫВ', W/2, y + 6, 8, Math.floor(game.t*4) % 2 ? '#ffe14a' : '#ffffff', 'center');
  ptext(ctx, TEAMS[0].code + '  ' + game.score[0] + ' : ' + game.score[1] + '  ' + TEAMS[1].code, W/2, y + 20, 8, '#ffffff', 'center');
  ptext(ctx, j, W/2, y + 34, 8, '#8fe0ff', 'center');
  if (wx) ptext(ctx, 'ПРОГНОЗ: ' + wx, W/2, y + 46, 8, '#ff9a5a', 'center');
}
function halfWeather() {   // the weather may change for the second half (not on pitches with their own climate)
  if (!weatherOn || TH.weather) return '';
  const next = randomWeather(game.weather); if (next === game.weather) return '';
  setWeather(next); return WXNAME[next];
}

// ================== match flow ==================
function kickoff11(team) {
  const place = (q, x, y) => { Object.assign(q, { x, y, vx:0, vy:0, z:0, vz:0, buff:null, charge:0, mood:null, fx:dirOf(q.team), fy:0 }); q.state = -1; setState(q, ST.IDLE); };
  for (const q of players) { const f = Math.min(q.home.x, 0.44); place(q, mirX(q.team === 0 ? f*LEN : (1 - f)*LEN), q.home.y*WID); }
  const o = players.find(q => q.team === team && q.role === 'att'), dir = dirOf(team);
  place(o, LEN/2 - dir*10, WID/2);
  Object.assign(ball, { x: o.x + o.fx*9, y: o.y + 1, z:0, vx:0, vy:0, vz:0, superType:null, gs:1, owner:o, lock:null, lockT:0, beam:null });
  setHuman(meLocked() ? players.find(q => q.me) : team === 0 ? o : players.find(q => q.team === 0 && q.role === 'att'));
  game.switchFlash = 0; game.mode = 'play'; game.announce = { text:'KICK OFF!', col:'#ffffff', t:1.1 }; sfx('whistle'); startMusic();
}
function kickoff(team) {
  if (MODE === 11) return kickoff11(team);
  const c = WID/2, na = players.find(p => p.team === 0 && p.role === 'att'), nd = players.find(p => p.team === 0 && p.role === 'def'),
        ra = players.find(p => p.team === 1 && p.role === 'att'), rd = players.find(p => p.team === 1 && p.role === 'def');
  const place = (p, x, y) => { Object.assign(p, { x, y, vx:0, vy:0, z:0, vz:0, buff:null, charge:0, mood:null, fx:dirOf(p.team), fy:0 }); p.state = -1; setState(p, ST.IDLE); };
  place(na, mirX(team === 0 ? LEN/2-10 : LEN/2-60), team === 0 ? c : c-30);
  if (nd) place(nd, mirX(LEN*0.12), c);
  place(ra, mirX(team === 1 ? LEN/2+10 : LEN/2+60), team === 1 ? c : c+30);
  if (rd) place(rd, mirX(LEN*0.88), c);
  for (const q of players) if (q.role === 'gk') place(q, ownX(q.team) === 0 ? 10 : LEN - 10, c);
  const o = team === 0 ? na : ra;
  Object.assign(ball, { x: o.x + o.fx*9, y: o.y + 1, z:0, vx:0, vy:0, vz:0, superType:null, gs:1, owner:o, lock:null, lockT:0, beam:null });
  assignControl(na, nd, ra); game.switchFlash = 0; game.mode = 'play'; game.announce = { text:'KICK OFF!', col:'#ffffff', t:1.1 }; sfx('whistle'); startMusic();
}
function scored(team) {
  const pts = chaosOn && game.time <= X2T ? 2 : 1;
  if (game.career && team === 0 && ball.last && ball.last.me) { game.myGoals += pts; pops.push({ text: 'ТВОЙ ГОЛ!', col: '#ffe14a', x: P(ball.x, ball.y).x, y: P(ball.x, ball.y).y - 30, t: 1.6 }); }
  fury(1-team, 30); game.score[team] += pts; game.mode = 'goal'; buzz(team === 0 ? [40, 40, 80] : 60); game.goalT = 2.2; game.kickoffTeam = 1-team;
  ball.owner = null; ball.superType = null; ball.gs = 1;
  for (const p of players) { p.mood = p.team === team ? 'cheer' : 'sad'; p.charge = 0; }
  const rivals = players.filter(p => p.team === 1);
  rivals.slice(0, 3).forEach((p, k) => emote(p, team === 1 ? (k === 0 ? clubEmo(1) : 'laugh') : (k === 0 ? 'cry' : 'angry'), true));
  if (team === 0) players.filter(p => p.team === 0 && p.role !== 'gk').sort((a, b) => dist(a, ball) - dist(b, ball)).slice(0, 2).forEach(p => emote(p, clubEmo(0), true));
  game.banner = { text: (team === 0 ? 'GOOOL!' : 'GOL ' + TEAMS[1].code) + (pts > 1 ? ' x2' : ''), col: TEAMS[team].color, t: 0 };
  game.flash = Math.max(game.flash, 0.35); game.shake = 0.4; sfx('goal');
  const s = P(ball.x, ball.y, ball.z);
  burst('goal', s.x, s.y, team);
}
const $ = id => document.getElementById(id);
const OVS = ['ovMenu', 'ovPause', 'ovEnd', 'ovBye', 'ovOnline', 'ovHelp', 'ovTeams', 'ovCareer', 'ovCreate', 'ovTour', 'ovFlight', 'ovStory'];
function showOv(id) {
  for (const o of OVS) $(o).hidden = o !== id;
  if (id === 'ovOnline') renderLobby();
  document.body.classList.toggle('in-menu', !!id);
  if (id) { const first = $(id).querySelector('.items:not([hidden]) .mi'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 30); }
}
// mode: 1 / 2 = arcade (Napoli vs Roma), 11 = reality with the clubs picked on the team screen
// opt (career): { a, b: club keys, theme, career: true }
function startMatch(mode, opt) {
  if (NET.role === 'guest') return;
  game.career = !!(opt && opt.career); game.lastOpt = opt || null; game.myGoals = 0;
  if (opt) setTeams(opt.a, opt.b); else if (mode === 11) setTeams(CLUB_KEYS[pick[0]], CLUB_KEYS[pick[1]]); else setTeams('nap', 'rom');
  setTheme(opt ? opt.theme : mode === 11 ? (fieldPick || TEAMS[1].home) : 'stadium');
  game.critter = null; game.critterT = rnd(8, 14);
  MODE = mode; setPitch(mode); buildTeams(mode); if (game.career) placeMe(); NET.mid = (NET.mid + 1) % 100000; NET.rK = NET.rT = -1;
  game.len = mode === 11 ? MATCH11 : MATCH;
  game.score = [0,0]; game.fury = [0, 0]; game.furyFlash = [0, 0]; game.time = game.len; parts = []; game.banner = null; game.bolt = null; game.paused = false;
  game.half = 1; game.flip = 0; game.show = null; game.tauntT = rnd(5, 9); game.emoCd = 0;
  game.chaos = null; game.vespa = null; game.lastChaos = null; game.chaosT = rnd(12, 16); game.itemT = rnd(5, 8); game.x2 = false; items = []; pops = [];
  game.runners = []; pees = []; game.skillCd = [12, 12]; game.miracle = [0, 0]; game.gagT = rnd(8, 13); NET.rS = -1;
  const mod = opt && opt.mod; game.curse = mod === 'curse'; game.modTxt = mod ? STORY.modName[mod] : '';
  if (mod === 'fury') game.fury[0] = 100; if (mod === 'skill') game.skillCd[0] = 0; if (mod === 'tired') game.fury[1] = 100;
  setWeather(!weatherOn ? 'off' : TH.weather || randomWeather(null)); kickoff(0); showOv(null); startShow('intro'); startMusic();
  // the title of the match shows when the mascots leave, so it doesn't cover them
  game.announce = null; game.introAnn = { text: derbyLine() || (MODE === 11 ? TH.name + ' · ' + TEAMS[1].name : TEAMS[0].name + ' - ' + TEAMS[1].name), col: '#ffe14a', t: 2.2 };
}
// little jokes for special pairings
function derbyLine() {
  const c = TEAMS.map(t => t.code).sort().join('');
  if (MODE !== 11) return '';
  if (c === 'RHOZIM') return 'ДЕРБИ ОДНОЙ СТРАНЫ!';
  if (c === 'NAPROM') return 'ДЕРБИ СОЛНЦА!';
  if (c === 'ENGGER') return 'ВЕЧНОЕ ПРОТИВОСТОЯНИЕ!';
  if (c === 'ESPPOR') return 'ИБЕРИЙСКОЕ ДЕРБИ!';
  if (c === 'FRAGER') return 'КЛАССИКА ЕВРОПЫ!';
  if (c.includes('PRK')) return 'ЭФИР ЦТ КНДР';
  return '';
}
function attract() {
  game.mode = 'title'; game.paused = false; stopMusic(); MODE = 2; game.flip = 0; game.show = null; setTeams('nap', 'rom'); game.critter = null; game.career = false;
  const th = themeKey !== 'stadium'; setTheme('stadium'); if (setPitch(2) || th) setWeather(game.weather === 'snow' ? 'rain' : game.weather || 'rain'); buildTeams(2);
  const c = WID/2;
  [[LEN/2-40, c-20], [LEN/2-90, c+30], [LEN/2+40, c+20], [LEN/2+90, c-30], [20, c], [LEN-20, c]].forEach(([x, y], i) => Object.assign(players[i], { x, y, fx: i % 4 < 2 && i !== 5 ? 1 : -1 }));
  Object.assign(ball, { x: LEN/2, y: c, z: 0, vx: 0, vy: 0, vz: 0, owner: null, superType: null });
  game.banner = null; game.announce = null; game.tauntT = 2; game.chaos = null; game.vespa = null; items = []; pops = []; game.runners = []; pees = [];
}
function menuPage(id) { for (const k of ['mMain', 'mPlay', 'mOpts']) $(k).hidden = k !== id; const f = $(id).querySelector('.mi'); if (f) f.focus({ preventScroll: true }); }
function toMenu() { netLeave(); attract(); showOv('ovMenu'); menuPage('mMain'); }
function setPaused(v) {
  if (game.mode !== 'play' && game.mode !== 'goal' && game.mode !== 'show') return;
  game.paused = v && NET.role === 'solo';   // online the match keeps running for your friend
  keys.clear(); touchKick = touchTackle = touchSwitch = false; prevKick = prevTackle = false;
  syncSound(); showOv(v ? 'ovPause' : null);
}
function syncSound() { for (const id of ['miSound', 'miSnd']) { $(id).innerHTML = 'ЗВУК <b>' + (muted ? 'ВЫКЛ' : 'ВКЛ') + '</b>'; $(id).classList.toggle('off', muted); } }
// settings live in this browser only (localStorage may be unavailable: then defaults)
const store = { get(k, d) { try { const v = localStorage.getItem('azz-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('azz-' + k, JSON.stringify(v)); } catch (e) {} } };
diff = clamp(store.get('diff', 1) | 0, 0, DIFFS.length - 1); chaosOn = store.get('chaos', true) !== false; weatherOn = store.get('wx', true) !== false;
let pick = store.get('pick', [0, 2]), fieldPick = null;   // null = the opponent's home pitch
const THEME_KEYS = Object.keys(THEMES);
if (!Array.isArray(pick) || pick.length !== 2 || pick.some(v => !(v >= 0 && v < CLUB_KEYS.length)) || pick[0] === pick[1]) pick = [0, 2];
function syncOpts() {
  for (const id of ['miDiff', 'miDiffA', 'miDiffT']) $(id).innerHTML = 'СЛОЖНОСТЬ <b>' + D().name + '</b>';
  $('diffTag').textContent = D().name;
  for (const [id, on, label] of [['miWx', weatherOn, 'ПОГОДА'], ['miChaos', chaosOn, 'КАОС']]) {
    $(id).innerHTML = label + ' <b>' + (on ? 'ВКЛ' : 'ВЫКЛ') + '</b>'; $(id).classList.toggle('off', !on); $(id).setAttribute('aria-pressed', String(on)); }
  syncSound();
}
function nextDiff() { diff = (diff + 1) % DIFFS.length; store.set('diff', diff); syncOpts(); }
function renderTeams() {
  for (const side of [0, 1]) {
    const c = CLUBS[CLUB_KEYS[pick[side]]], g = $('kit' + side).getContext('2d');
    $('club' + side).textContent = c.name; $('star' + side).textContent = 'СКИЛЛ: ' + (SKILLS[c.skill] || SKILLS.herd).name;
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, 40, 40); g.drawImage(getSprite(c, 'cheer', 'shout', 0, 'side', { look: 0, num: 9, feat: featFor(c, 9) }), 0, 0);
    g.fillStyle = '#100810'; g.fillRect(0, 0, 14, 10); drawFlagIcon(g, c, 1, 1, 12, 8);
  }
  const codes = pick.map(k => CLUBS[CLUB_KEYS[k]].code).sort().join('');
  const opp = CLUBS[CLUB_KEYS[pick[1]]];
  $('miField').innerHTML = 'ПОЛЕ <b>' + (fieldPick ? THEMES[fieldPick].name : THEMES[opp.home].name + ' (ДОМА)') + '</b>';
  $('derby').textContent = codes === 'RHOZIM' ? 'ДЕРБИ ОДНОЙ СТРАНЫ!' : codes === 'NAPROM' ? 'ДЕРБИ СОЛНЦА!' : codes.includes('PRK') ? 'МАТЧ ПОКАЖЕТ ЦТ КНДР' : '';
}
function cycleField() {
  const i = fieldPick === null ? -1 : THEME_KEYS.indexOf(fieldPick);
  fieldPick = i + 1 >= THEME_KEYS.length ? null : THEME_KEYS[i + 1]; renderTeams();
}
function cycleTeam(side, d) {
  do pick[side] = (pick[side] + d + CLUB_KEYS.length) % CLUB_KEYS.length; while (pick[side] === pick[1 - side]);
  store.set('pick', pick); renderTeams();
}
function endLine(a, b) {
  const [A, B] = TEAMS, codes = [A.code, B.code], win = a > b ? A : a < b ? B : null;
  if (codes.includes('RHO') && codes.includes('ZIM')) return 'Родезия и Зимбабве — одна и та же страна. Победила дружба.';
  if (codes.includes('PRK')) return win && win.code === 'PRK' ? 'ЦТАК сообщает: великая победа. Как всегда.' : 'ЦТАК сообщает: КНДР победила 7:0. Табло было неисправно.';
  if (win && win.code === 'ZIM') return 'Премиальные: 100 триллионов зимбабвийских долларов. Хватит на булочку.';
  if (win && win.code === 'RHO') return 'Результат не засчитан: такой страны нет с 1980 года.';
  const lose = !win ? null : win === A ? B : A;
  if (lose && lose.code === 'ENG') return 'Англия проиграла. Футбол снова не вернулся домой.';
  const J = { KAZ: 'Казахстан побеждает! Бешбармак за счёт федерации.', FRA: 'Франция побеждает. Багеты летят на поле.',
    GER: 'Германия побеждает. Строго по расписанию.', ENG: 'Футбол вернулся домой!', ESP: 'Испания побеждает. Сиеста заслужена.',
    POR: 'Португалия побеждает. Сардины за счёт заведения.', NED: 'Тотальный футбол и тотальные тюльпаны.',
    ANT: 'Пингвины в восторге. Полярники тоже.', SEA: 'Силенд побеждает. Отпраздновали всем населением — 27 человек.',
    VAT: 'Ватикан побеждает. Победа одобрена свыше.', ATL: 'Атлантида побеждает. Где стадион — до сих пор неизвестно.' };
  if (win && J[win.code]) return J[win.code];
  if (lose && lose.code === 'ANT') return 'Антарктида проиграла, но сохранила хладнокровие.';
  return win ? win.name.charAt(0) + win.name.slice(1).toLowerCase() + ' забирает матч. Весь стадион поёт.' : 'Ничья. Решим в реванше.';
}
function endMatch() {
  game.mode = 'end'; sfx('whistle'); stopMusic();
  const [a, b] = game.score, [A, B] = TEAMS;
  document.getElementById('finalScore').innerHTML = `${A.code} <span class="sc">${a} : ${b}</span> ${B.code}`;
  document.getElementById('finalLine').textContent = endLine(a, b);
  $('miAgain').hidden = NET.role === 'guest' || game.career; $('miToTour').hidden = !game.career; $('miToTour').textContent = 'ПРЕСС-КОНФЕРЕНЦИЯ';
  if (game.career) $('finalLine').textContent += ' ' + careerResult(a, b);
  if (NET.role === 'guest') $('finalLine').textContent += ' Реванш запускает тот, кто создал игру.';
  showOv('ovEnd');
}

// ================== particles (field-canvas coords) ==================
function burst(kind, x, y, team, relayed) {
  if (!relayed) netEv('b', kind, Math.round(x), Math.round(y), team || 0);
  if (kind === 'super') for (let i = 0; i < 20; i++) spawn(x, y, rnd(-90,90), rnd(-110,20), rnd(0.3,0.6), i%2?'#ffd23a':'#ff6a1a', 2, 200);
  if (kind === 'pick') { for (let i = 0; i < 16; i++) spawn(x, y, rnd(-70, 70), rnd(-90, -10), rnd(0.3, 0.6), ['#ffffff', '#ffd23a', '#ff6a5a'][i%3], 2, 160);
    const it = ITEMS[team || 0]; pops.push({ text: ITEMNAME[it], col: it === 'pizza' ? '#ffd23a' : it === 'pepper' ? '#ff6a3a' : '#ff9a9a', x, y: y - 8, t: 1 }); }
  if (kind === 'ora') { for (let i = 0; i < 6; i++) spawn(x, y, rnd(-80, 80), rnd(-80, 40), rnd(0.15, 0.3), i%2 ? '#ffe14a' : '#ffffff', 2, 0);
    if (Math.random() < 0.15) pops.push({ text: 'ОРА!', col: Math.random() < 0.5 ? '#ffe14a' : '#ff6a9a', x: x + rnd(-10, 10), y, t: 0.6 }); }
  if (kind === 'txt') pops.push({ text: TXTS[team || 0] || '!', col: TXTS[team] === 'ОПИСАЛСЯ!' ? '#ffe14a' : TXTS[team] === 'БУ!' ? '#ff6a6a' : '#ffffff', x, y, t: 1.3 });
  if (kind === 'lava') for (let i = 0; i < 24; i++) spawn(x, y, rnd(-80, 80), rnd(-120, -20), rnd(0.4, 0.9), ['#ff3a10', '#ff9a1a', '#ffe14a', '#3a2a2a'][i % 4], i % 3 ? 2 : 3, 300);
  if (kind === 'ding') for (let i = 0; i < 10; i++) spawn(x, y, rnd(-60, 60), rnd(-60, 20), rnd(0.2, 0.4), i%2 ? '#ffd23a' : '#ffffff', 2, 0);
  if (kind === 'dust') for (let i = 0; i < 10; i++) spawn(x + rnd(-6, 6), y - 1, rnd(-50, 50), rnd(-40, -10), rnd(0.3, 0.5), i%2 ? '#e8f4e0' : '#9ab890', 2, 150);
  if (kind === 'quake') for (let i = 0; i < 36; i++) { const a = i/36*Math.PI*2; spawn(x, y, Math.cos(a)*120, Math.sin(a)*40 - 40, rnd(0.4, 0.7), ['#5c4a26', '#3e3418', '#ff7a2a'][i%3], i%4 ? 2 : 3, 200); }
  if (kind === 'goal') for (let i = 0; i < 44; i++) spawn(x, y, rnd(-130,130), rnd(-170,-20), rnd(0.6,1.2), ['#ffffff', TEAMS[team||0].color, '#f2c230'][i%3], 2, 260);
}
function spawn(x, y, vx, vy, life, col, s, g) { if (parts.length > 600) return; parts.push({ x, y, vx, vy, life, max: life, col, s, g }); }
function updParts(dt) {
  for (let i = pops.length-1; i >= 0; i--) if ((pops[i].t -= dt) <= 0) pops.splice(i, 1);
  for (let i = parts.length-1; i >= 0; i--) { const p = parts[i]; p.life -= dt;
  if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g*dt; p.x += p.vx*dt; p.y += p.vy*dt; } }

// ================== update ==================
// Camera: follows a point between the ball and your player, with a smoothed look-ahead,
// a dead zone (no jitter when the ball wiggles at your feet) and a critically damped spring.
const camV = { x: 0, y: 0 }, look = { x: 0 };
function updCamera(dt, snap) {
  const b = P(ball.x, ball.y, ball.z*0.3), h = players.find(p => p.local);
  look.x += (clamp(ball.vx*0.2, -48, 48) - look.x)*Math.min(1, dt*2.2);
  let fx = b.x + look.x, fy = b.y;
  if (game.mode === 'title') { const q = P(LEN/2 + Math.sin(game.t*0.12)*250, WID/2); fx = q.x; fy = q.y; }
  if (h && game.mode === 'play') { const hp = P(h.x, h.y); fx = fx*0.75 + hp.x*0.25; fy = fy*0.7 + (hp.y - 16)*0.3; }
  let tx = fx - W/2, ty = fy - H*0.6;
  if (snap) { cam.x = clamp(tx, 0, FCV.width - W); cam.y = clamp(ty, 0, FCV.height - H); camV.x = camV.y = 0; return; }
  const ex = tx - cam.x, ey = ty - cam.y;
  tx = Math.abs(ex) < 14 ? cam.x : tx - Math.sign(ex)*14;
  ty = Math.abs(ey) < 10 ? cam.y : ty - Math.sign(ey)*10;
  tx = clamp(tx, 0, FCV.width - W); ty = clamp(ty, 0, FCV.height - H);
  camV.x += ((tx - cam.x)*30 - camV.x*11)*dt; camV.y += ((ty - cam.y)*18 - camV.y*8.5)*dt;
  cam.x = clamp(cam.x + camV.x*dt, 0, FCV.width - W); cam.y = clamp(cam.y + camV.y*dt, 0, FCV.height - H);
}
function update(dt) {
  game.t += dt;
  if (NET.role === 'guest') { guestUpdate(dt); return; }
  game.shake = Math.max(0, game.shake - dt); game.flash = Math.max(0, game.flash - dt*2);
  if (game.bolt) { game.bolt.t -= dt; if (game.bolt.t <= 0) game.bolt = null; }
  if (game.announce) { game.announce.t -= dt; if (game.announce.t <= 0) game.announce = null; }
  if (game.paused) return;
  game.switchFlash = Math.max(0, game.switchFlash - dt);
  game.furyFlash[0] = Math.max(0, game.furyFlash[0] - dt); game.furyFlash[1] = Math.max(0, game.furyFlash[1] - dt);
  updEmotes(dt);
  updWeather(dt); updParts(dt); chaosFx(dt);
  if (game.hitstop > 0) { game.hitstop -= dt; return; }
  if (game.mode === 'play') {
    game.time -= dt;
    if (game.time <= 0) { game.time = 0; endMatch(); }
    else if (game.half === 1 && game.time <= game.len/2) { game.time = game.len/2; startShow('half'); }
    else { if (NET.role === 'solo') updControl(dt); humanInput(); remoteInput(); if (MODE === 11) computeChasers(); for (const p of players) if (!p.human) ai(p, dt); }
  } else if (game.mode === 'goal') {
    game.goalT -= dt; if (game.banner) game.banner.t += dt;
    if (game.goalT <= 0) { game.banner = null; kickoff(game.kickoffTeam); }
  }
  if (game.mode === 'show') updShow(dt);
  if (game.mode === 'title') {   // menu background: the pizza boy sometimes rides through the players
    if (!game.vespa && Math.random() < dt*0.08) spawnVespa();
    if (game.vespa) updVespa(dt);
    for (const p of players) { p.inp.mx = p.inp.my = 0; updPlayer(p, dt); }
    updBall(dt);
  }
  if (game.mode === 'play' || game.mode === 'goal') {
    for (const p of players) updPlayer(p, dt);
    separate(); updBall(dt);
    if (game.mode === 'play') possession(dt);
    updChaos(dt); updRunners(dt);
    for (let k = pees.length - 1; k >= 0; k--) if ((pees[k].t -= dt) <= 0) pees.splice(k, 1);
    if (game.mode === 'play') { for (const t of [0, 1]) { game.skillCd[t] = Math.max(0, game.skillCd[t] - dt); game.miracle[t] = Math.max(0, game.miracle[t] - dt); }
      if (cpuSide(1) && game.skillCd[1] <= 0 && Math.random() < dt*0.12) useSkill(1); }
  }
  updCamera(dt, false);
  if (NET.role === 'host') hostBroadcast();
}

// ================== render ==================
function drawGoalBack(right, g, S) {
  const xl = right ? LEN : 0, xb = right ? LEN + GD : -GD, zb = GH - 10, net = 'rgba(255,255,255,0.85)';
  const ln = (a, b, col, w) => pline(g, a.x, a.y, b.x, b.y, col, w);
  for (let k = 0; k <= 10; k++) { const y = Y0 + (Y1-Y0)*k/10; ln(S(xb, y, 0), S(xb, y, zb), net, 1); ln(S(xb, y, zb), S(xl, y, GH), net, 1); }
  for (let h = 0; h <= 6; h++) { const z = zb*h/6; ln(S(xb, Y0, z), S(xb, Y1, z), net, 1); }
  for (let j = 1; j <= 3; j++) { const x = xl + (xb-xl)*j/4, z = GH + (zb-GH)*j/4; ln(S(x, Y0, z), S(x, Y1, z), net, 1); }
  // far side net
  for (let j = 0; j <= 4; j++) { const x = xl + (xb-xl)*j/4, z = GH + (zb-GH)*j/4; ln(S(x, Y0, 0), S(x, Y0, z), net, 1); }
  for (let h = 1; h <= 6; h++) ln(S(xl, Y0, GH*h/6), S(xb, Y0, zb*h/6), net, 1);
  // frame: far post, crossbar, back bars
  for (const [w, col] of [[5, '#100810'], [3, '#ffffff']]) {
    ln(S(xl, Y0, 0), S(xl, Y0, GH), col, w); ln(S(xl, Y0, GH), S(xl, Y1, GH), col, w);
  }
  ln(S(xb, Y0, 0), S(xb, Y0, zb), '#d8d8e0', 2); ln(S(xb, Y1, 0), S(xb, Y1, zb), '#d8d8e0', 2); ln(S(xb, Y0, zb), S(xb, Y1, zb), '#d8d8e0', 2);
}
function drawGoalFront(right, g, S) {
  const xl = right ? LEN : 0, xb = right ? LEN + GD : -GD, zb = GH - 10, net = 'rgba(255,255,255,0.85)';
  const ln = (a, b, col, w) => pline(g, a.x, a.y, b.x, b.y, col, w);
  for (let j = 0; j <= 4; j++) { const x = xl + (xb-xl)*j/4, z = GH + (zb-GH)*j/4; ln(S(x, Y1, 0), S(x, Y1, z), net, 1); }
  for (let h = 1; h <= 6; h++) ln(S(xl, Y1, GH*h/6), S(xb, Y1, zb*h/6), net, 1);
  for (const [w, col] of [[5, '#100810'], [3, '#ffffff']]) { ln(S(xl, Y1, 0), S(xl, Y1, GH), col, w); }
  ln(S(xl, Y1, GH), S(xb, Y1, zb), '#d8d8e0', 2);
}
// super saiyan hair: the whole team in arcade; on the big pitch only your player and the ball carrier, so it stays readable
const lookOf = p => ({ look: p.look, gk: p.role === 'gk', num: p.num, feat: p.feat, lookObj: p.lookObj,
  ssj: p.role !== 'gk' && game.fury[p.team] >= 100 && game.mode !== 'title' && (MODE !== 11 || p.local || ball.owner === p) });
function spriteFor(p) {
  let pose = 'idle', expr = 'normal', frame = 0, view = p.fy < -0.5 ? 'back' : 'side';
  const flip = p.fx < -0.01 || (Math.abs(p.fx) < 0.01 && p.team === 1);
  if (p.mood === 'cheer' && p.state <= ST.RUN) { pose = 'cheer'; expr = 'shout'; frame = Math.floor(game.t*6) % 2; view = 'side'; }
  else if (p.mood === 'sad' && p.state <= ST.RUN) { expr = 'cry'; view = 'side'; }
  else switch (p.state) {
    case ST.IDLE: if (p.charge > 0.15) { pose = 'charge'; expr = 'grit'; } break;
    case ST.RUN: pose = 'run'; frame = [0,1,2,1][Math.floor(p.anim/10) % 4]; if (p.charge > 0.15) expr = 'grit'; break;
    case ST.KICK: pose = 'kick'; expr = 'shout'; view = 'side'; break;
    case ST.TACKLE: pose = 'tackle'; expr = 'shout'; view = 'side'; break;
    case ST.FALL: pose = 'fall'; expr = p.fallExpr; view = 'side'; break;
    case ST.STUN: pose = 'shock'; frame = Math.floor(p.st*12) % 2; view = 'side'; break;
    case ST.DIVE: pose = 'dive'; expr = 'grit'; view = 'side'; break;
  }
  const fz = p.freeze && p.freeze.k;
  if (fz && p.state <= ST.RUN) { view = 'side'; pose = fz === 'dance' ? 'cheer' : 'idle'; frame = fz === 'dance' ? Math.floor(game.t*8) % 2 : 0;
    expr = fz === 'ice' || fz === 'poop' ? 'bulge' : fz === 'sneeze' ? 'shout' : fz === 'strike' ? 'grit' : fz === 'dance' ? 'shout' : 'normal'; }
  if (p.fear && p.state <= ST.RUN) expr = 'bulge';
  if (p.peeT > 0 && p.state <= ST.RUN) expr = 'cry';
  return { spr: getSprite(p.team, pose, expr, frame, view, lookOf(p)), flip };
}
function drawPlayer(p) {
  const s = S(p.x, p.y), x = Math.round(s.x), z = Math.round(p.z || 0), y = Math.round(s.y) - z, { spr, flip } = spriteFor(p);
  if (ball.owner === p && game.mode !== 'title') {   // who has the ball: a ring in the team colour
    const k = Math.floor(game.t*8) % 2; pellipseRing(x, y + z + 1, 13, 5, '#100810'); pellipseRing(x, y + z, 13, 5, k ? TEAMS[p.team].color : '#ffffff');
  }
  if (p.buff === 'horn') pellipseRing(x, y + z, 12, 4, Math.floor(game.t*10) % 2 ? '#ffd23a' : '#fff3a0');
  if (p.role !== 'gk' && game.fury[p.team] >= 100 && p.state <= ST.RUN && (p.local || ball.owner === p) && Math.random() < 0.5) {   // saiyan aura
    const q = P(p.x, p.y); spawn(q.x + rnd(-9, 9), q.y - rnd(0, 30) - z, 0, rnd(-70, -30), 0.3, Math.random() < 0.5 ? '#ffe14a' : '#fff6b0', 2, 0); }
  if (p.buff === 'pepper') pellipse(x, y + z, 11, 3, Math.floor(game.t*12) % 2 ? 'rgba(255,90,30,.55)' : 'rgba(255,200,40,.45)');
  if (p.cycle > 0 && p.state <= ST.RUN) { const yb = y + z; pellipseRing(x - 8, yb - 3, 4, 4, '#202030'); pellipseRing(x + 8, yb - 3, 4, 4, '#202030');
    pline(ctx, x - 8, yb - 3, x, yb - 9, '#ff8a1a', 2); pline(ctx, x, yb - 9, x + 8, yb - 3, '#ff8a1a', 2); }
  if (p.buff === 'feint' && Math.random() < 0.6) { const q = P(p.x, p.y, rnd(0, 30)); spawn(q.x + rnd(-10, 10), q.y, 0, -30, 0.4, ['#ff3a3a', '#ffd23a', '#5ac04a', '#4ab8ff', '#b86aff'][Math.floor(Math.random()*5)], 2, 0); }
  if (p.ghost > 0) ctx.globalAlpha = Math.floor(game.t*10) % 2 ? 0.35 : 0.55;
  if (p.peeT > 0) { /* shivers */ }
  if (z > 2 && p.state === ST.FALL) {   // cartwheel through the air in 90-degree steps, NES style
    const up = getSprite(p.team, 'idle', 'bulge', 0, 'side', lookOf(p));
    ctx.save(); ctx.translate(x, y - 20); ctx.rotate((Math.floor(p.st*14) % 4)*Math.PI/2); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(up, -20, -20); ctx.restore(); ctx.globalAlpha = 1; return;
  }
  if (p.charge >= CHARGE && p.state <= ST.RUN && furyReady(p)) {
    pellipse(x, y, 14, 4, Math.floor(game.t*16) % 2 ? 'rgba(255,190,40,.6)' : 'rgba(255,90,30,.5)');
    if (Math.random() < 0.6) { const q = P(p.x, p.y); spawn(q.x+rnd(-10,10), q.y-rnd(0,34), 0, rnd(-60,-25), 0.35, '#ffd23a', 2, 0); }
  }
  if (p.bike && p.state === ST.KICK) { // upside-down overhead kick, lifted off the ground
    const lift = Math.round(18*Math.sin(Math.min(1, p.st/KTIME)*Math.PI)) + 8;
    ctx.save(); ctx.translate(x, y - 20 - lift); ctx.scale(flip ? 1 : -1, -1); ctx.drawImage(spr, -20, -20); ctx.restore();
  } else if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -20, y-39); ctx.restore(); }
  else ctx.drawImage(spr, x-20, y-39);
  ctx.globalAlpha = 1;
  const fz = p.freeze && p.freeze.k;
  if (fz === 'ice') { ctx.fillStyle = 'rgba(160,225,255,.55)'; ctx.fillRect(x - 12, y - 40, 24, 41); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 10, y - 38, 2, 12); ctx.fillRect(x - 12, y - 40, 24, 1); }
  if (fz === 'strike') { ctx.fillStyle = '#6a4020'; ctx.fillRect(x + 9, y - 46, 1, 22); ctx.fillStyle = '#100810'; ctx.fillRect(x + 1, y - 55, 18, 11); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y - 54, 16, 9);
    ctx.fillStyle = '#d8243a'; ctx.fillRect(x + 4, y - 52, 12, 1); ctx.fillRect(x + 4, y - 49, 9, 1); }
  if (fz === 'phone') { ctx.fillStyle = '#100810'; ctx.fillRect(x + (flip ? -9 : 6), y - 30, 4, 7); ctx.fillStyle = Math.floor(game.t*8) % 2 ? '#7fe0ff' : '#ffffff'; ctx.fillRect(x + (flip ? -8 : 7), y - 29, 2, 4); }
  if (p.poopT > 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y - 41, 8, 3); ctx.fillRect(x - 2, y - 43, 4, 2); ctx.fillRect(x + 2, y - 38, 1, 3); ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x - 1, y - 42, 2, 1); }
  if (p.state === ST.FALL && p.st > 0.2) {
    const hx = x + (flip ? 11 : -11), hy = y - 20;
    for (let k = 0; k < 3; k++) { const a = game.t*7 + k*2.1; ctx.fillStyle = '#ffe14a';
      const sx = Math.round(hx + Math.cos(a)*9), sy = Math.round(hy + Math.sin(a)*3); ctx.fillRect(sx, sy-1, 1, 3); ctx.fillRect(sx-1, sy, 3, 1); }
  }
  if (p.charge > 0.15 && p.state <= ST.RUN && superFor(p) === 'kame') {   // energy ball between the hands
    const r = Math.round(2 + Math.min(1, p.charge/CHARGE)*4), hx = x + (flip ? -9 : 9), hy = y - 18;
    pellipse(hx, hy, r + 2, r + 2, 'rgba(120,220,255,.45)'); pellipse(hx, hy, r, r, Math.floor(game.t*20) % 2 ? '#ffffff' : '#8fe0ff');
  }
  if (p.state === ST.STUN && Math.random() < 0.6) { const q = P(p.x, p.y); spawn(q.x+rnd(-12,12), q.y-rnd(4,36), rnd(-40,40), rnd(-40,40), 0.12, Math.random()<0.5?'#ffffff':'#ffe14a', 1, 0); }
  if (ball.owner === p && game.mode === 'play' && p.name) ptext(ctx, p.name, x + 1, y - (p.tag ? 70 : 54), 8, '#ffffff', 'center', '#100810');
  if (p.tag && game.mode === 'play') {
    const bob = Math.floor(game.t*4) % 2, ty = y - 50 - bob, col = p.tag === 2 ? '#7fe0ff' : '#f2c230';
    ptext(ctx, p.tag === 2 ? '2P' : '1P', x+1, ty-9, 8, col, 'center', '#100810');
    ctx.fillStyle = '#100810'; ctx.fillRect(x-4, ty, 9, 5);
    ctx.fillStyle = col; ctx.fillRect(x-3, ty, 7, 1); ctx.fillRect(x-2, ty+1, 5, 1); ctx.fillRect(x-1, ty+2, 3, 1); ctx.fillRect(x, ty+3, 1, 1);
    if (p.local && game.switchFlash > 0) { const k = 1 - game.switchFlash/0.45, rx = Math.round(6 + k*14), ry = Math.round(2 + k*4);
      ctx.globalAlpha = 1 - k; pellipseRing(x, y, rx, ry, '#f2c230'); ctx.globalAlpha = 1; }
    if (p.local && p.charge > 0.05) {
      const k = Math.min(1, p.charge/CHARGE), sup = superFor(p);
      ctx.fillStyle = '#100810'; ctx.fillRect(x-11, y+4, 22, 5);
      ctx.fillStyle = k >= 1 ? (sup ? (Math.floor(game.t*14)%2 ? '#ff6a1a' : '#ffe14a') : '#ffffff') : '#4aa8f0'; ctx.fillRect(x-10, y+5, Math.round(20*k), 3);
      if (k >= 1) ptext(ctx, sup ? SUPERSHORT[sup] : 'FORTE', x, y+11, 8, sup ? '#ffd23a' : '#ffffff', 'center', '#100810');
    }
    if (p.local && furyReady(p) && aerial(p) && p.state <= ST.RUN) ptext(ctx, 'ЖМИ!', x, y-64, 8, '#7fe0ff', 'center', '#100810');
  }
}
function pellipseRing(cx, cy, rx, ry, col) {
  ctx.fillStyle = col; let prev = null;
  for (let a = 0; a <= 64; a++) { const t = a/64*Math.PI*2, px = Math.round(cx + Math.cos(t)*rx), py = Math.round(cy + Math.sin(t)*ry);
    if (!prev || prev[0] !== px || prev[1] !== py) { ctx.fillRect(px, py, 2, 1); prev = [px, py]; } }
}
// arrow at the screen edge when your player is off camera
function drawOffscreen() {
  const h = players.find(p => p.local); if (!h || game.mode !== 'play') return;
  const s = S(h.x, h.y, 20); if (s.x > 6 && s.x < W-6 && s.y > 28 && s.y < H-4) return;
  const x = clamp(s.x, 10, W-10), y = clamp(s.y, 34, H-10), col = Math.floor(game.t*6) % 2 ? '#f2c230' : '#ffffff';
  const dx = s.x < 6 ? -1 : s.x > W-6 ? 1 : 0, dy = s.y < 28 ? -1 : s.y > H-4 ? 1 : 0;
  ctx.fillStyle = '#100810'; ctx.fillRect(x-7, y-7, 15, 15); ctx.fillStyle = col; ctx.fillRect(x-6, y-6, 13, 13);
  ctx.fillStyle = '#100810';
  for (let k = 0; k < 4; k++) { if (dx) ctx.fillRect(x + dx*(3-k) - (dx<0?0:0), y-k, 1, k*2+1); else ctx.fillRect(x-k, y + dy*(3-k), k*2+1, 1); }
}
function drawBall() {
  const b = ball, s = S(b.x, b.y, b.z), x = Math.round(s.x), y = Math.round(s.y);
  const t = b.superType;
  if (t === 'tiger') { pellipse(x, y-6, 10, 8, 'rgba(255,150,30,.6)'); for (let k = -1; k <= 1; k++) { ctx.fillStyle = '#100810'; ctx.fillRect(x + k*4 - 1, y - 13 + (Math.floor(game.t*20) % 2), 2, 14); } }
  if (t === 'kame') { pellipse(x, y-6, 11, 9, 'rgba(120,220,255,.5)'); pellipse(x, y-6, 8, 7, 'rgba(255,255,255,.8)'); }
  if (t === 'rasen') { pellipse(x, y-6, 10, 9, 'rgba(70,170,255,.55)'); const a = game.t*25; for (let k = 0; k < 3; k++) { ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x + Math.cos(a + k*2.1)*7), Math.round(y - 6 + Math.sin(a + k*2.1)*6), 2, 2); } }
  const fr = ((Math.floor(b.rot/5) % 8) + 8) % 8;
  if (giant()) { const d = Math.round(12*BIGK); ctx.drawImage(BALLSPR[fr], x - (d >> 1), y - d, d, d); return; }
  ctx.drawImage(BALLSPR[fr], x-6, y-12);
}
function drawItem(it) {
  if (it.t < 2 && Math.floor(game.t*10) % 2) return;   // blinks before it disappears
  const s = S(it.x, it.y), x = Math.round(s.x), y = Math.round(s.y), bob = Math.round(Math.sin(game.t*4 + it.x)*2);
  ctx.drawImage(ITEMSPR[it.type], x - 7, y - 20 + bob);
}
function drawVespa() {
  const v = game.vespa, s = S(v.x, v.y), x = Math.round(s.x), y = Math.round(s.y) + (Math.floor(game.t*14) % 2);
  if (v.dir > 0) ctx.drawImage(VESPA, x - 18, y - 27);
  else { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(VESPA, -18, y - 27); ctx.restore(); }
}
function drawChaosBar() {
  const c = game.chaos; if (!c || game.mode === 'title') return;
  const d = CHAOS[c.type], k = clamp(c.t/d.dur, 0, 1), w = 60, x = Math.round(W/2 - w/2), y = H - 9;
  ptext(ctx, d.label, W/2, y - 11, 8, d.col, 'center', '#100810');
  ctx.fillStyle = '#100810'; ctx.fillRect(x - 1, y, w + 2, 5); ctx.fillStyle = d.col; ctx.fillRect(x, y + 1, Math.round(w*k), 3);
}
function drawWeatherIcon(x, y) {
  const w = game.weather, R = (a,b,c,d,col) => { ctx.fillStyle = col; ctx.fillRect(x+a, y+b, c, d); };
  if (w === 'off') { ptext(ctx, '-', x+8, y+4, 8, '#7c86a0', 'center'); return; }
  if (w === 'clear') { R(5,3,6,10,'#ffd23a'); R(3,5,10,6,'#ffd23a'); R(7,0,2,2,'#ffd23a'); R(7,14,2,2,'#ffd23a'); R(0,7,2,2,'#ffd23a'); R(14,7,2,2,'#ffd23a'); return; }
  const cc = w === 'storm' ? '#7c86a0' : '#5aa8f0', ch = w === 'storm' ? '#a4acc4' : '#9fd0ff';
  R(4,1,7,3,cc); R(2,3,13,4,cc); R(0,5,16,3,cc); R(4,1,5,1,ch); R(2,3,3,1,ch);
  if (w === 'rain') for (const dx of [2,6,10,14]) { R(dx,10,1,2,'#4aa8f0'); R(dx-1,12,1,2,'#4aa8f0'); }
  else { R(8,8,3,2,'#ffe14a'); R(6,10,3,2,'#ffe14a'); R(8,12,2,3,'#ffe14a'); }
}
function drawWindIcon(x, y) {
  const m = hyp(game.wind.x, game.wind.y), c1 = m > 50 ? '#ff9a5a' : '#4aa8f0', c2 = m > 50 ? '#ffd0a0' : '#9fd0ff';
  if (m < 1) { ptext(ctx, '-', x+8, y+4, 8, '#7c86a0', 'center'); return; }
  const flip = game.wind.x < 0;
  ctx.save(); if (flip) { ctx.translate(x*2+16, 0); ctx.scale(-1, 1); }
  const R = (a,b,c,d,col) => { ctx.fillStyle = col; ctx.fillRect(x+a, y+b, c, d); };
  R(0,3,11,2,c1); R(11,1,2,2,c1); R(13,2,1,2,c1); R(10,0,2,1,c2);
  R(2,7,13,2,c1); R(3,11,8,2,c1); R(11,12,2,2,c1); R(12,14,1,1,c2);
  if (m > 50) R(0,15,4,1,c1);
  ctx.restore();
}
const HUD = { y: 3, h: 21 };
function box(x, w) {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x+1, HUD.y, w-2, HUD.h); ctx.fillRect(x, HUD.y+1, w, HUD.h-2);
  ctx.fillStyle = '#100810'; ctx.fillRect(x+2, HUD.y+2, w-4, HUD.h-4);
}
function drawHUD() {
  const compact = W < 300, sw = compact ? 132 : 158, tw = compact ? 46 : 54;
  const total = tw + 2 + sw + 2 + (compact ? 0 : 28) + 28 + 22;
  let x = Math.round((W - total)/2);
  box(x, tw);
  const t = Math.ceil(game.time), mm = String(Math.floor(t/60)).padStart(2,'0'), ss = String(t%60).padStart(2,'0');
  ptext(ctx, mm+':'+ss, x+tw/2, HUD.y+7, 8, game.time < 15 && game.mode === 'play' && Math.floor(game.t*3)%2 ? '#ff6a6a' : '#ffffff', 'center');
  x += tw + 2;
  box(x, sw); const c = x + sw/2;
  // country flags on both ends of the score box
  ctx.fillStyle = TEAMS[0].hudBg; ctx.fillRect(x+2, HUD.y+2, 19, HUD.h-4); drawFlagIcon(ctx, TEAMS[0], x+3, HUD.y+5, 17, 11);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x+21, HUD.y+2, 1, HUD.h-4); ctx.fillRect(x+sw-22, HUD.y+2, 1, HUD.h-4);
  ctx.fillStyle = TEAMS[1].hudBg; ctx.fillRect(x+sw-21, HUD.y+2, 19, HUD.h-4); drawFlagIcon(ctx, TEAMS[1], x+sw-20, HUD.y+5, 17, 11);
  ptext(ctx, TEAMS[0].code, x+25, HUD.y+7, 8, '#ffffff'); ptext(ctx, TEAMS[1].code, x+sw-25, HUD.y+7, 8, '#ffffff', 'right');
  ptext(ctx, String(game.score[0]), c-11, HUD.y+7, 8, '#f2c230', 'center');
  ptext(ctx, ':', c+1, HUD.y+7, 8, '#ffffff', 'center');
  ptext(ctx, String(game.score[1]), c+13, HUD.y+7, 8, '#f2c230', 'center');
  { // FURIA meters: NAP fills to the right, ROM to the left, blink when full
    const by = HUD.y + HUD.h + 1, half = Math.floor((sw - 8)/2);
    ctx.fillStyle = '#100810'; ctx.fillRect(x+2, by, sw-4, 5);
    for (const t of [0, 1]) {
      const v = game.fury[t]/100, w = Math.round((half-2)*v), full = v >= 1, on = full && Math.floor(game.t*8) % 2;
      ctx.fillStyle = full ? (on ? '#ffffff' : '#ffd23a') : TEAMS[t].color;
      if (t === 0) ctx.fillRect(x+4, by+1, w, 3); else ctx.fillRect(x+sw-4-w, by+1, w, 3);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(c, by, 1, 5);
    for (const t of [0, 1]) if (game.fury[t] >= 100) ptext(ctx, 'FURIA', t ? x+sw-6 : x+6, by+6, 8, Math.floor(game.t*6)%2 ? '#ffd23a' : '#ffffff', t ? 'right' : 'left', '#100810');
  }
  x += sw + 2;
  if (!compact) { box(x, 26); drawWindIcon(x+5, HUD.y+3); x += 28; }
  box(x, 26); drawWeatherIcon(x+5, HUD.y+3); HUD.wxX = x;
  x += 28;
  box(x, 22); ctx.fillStyle = '#ffffff'; ctx.fillRect(x+7, HUD.y+6, 3, 9); ctx.fillRect(x+12, HUD.y+6, 3, 9);
  HUD.sndX = x;
}
function drawBeam() {
  const bm = ball.beam; if (!bm) return;
  const a = S(bm.x, bm.y, 8), b = S(ball.x, ball.y, ball.z + 5), k = clamp(bm.t/0.9, 0, 1);
  for (const [w, col] of [[Math.round(4 + 8*k), 'rgba(80,190,255,.45)'], [Math.round(2 + 5*k), 'rgba(170,235,255,.85)'], [Math.max(1, Math.round(3*k)), '#ffffff']])
    pline(ctx, a.x, a.y, b.x, b.y, col, w);
}
function drawBolt() {
  const b = game.bolt; if (!b) return;
  const tx = b.x - cam.x, ty = b.y - cam.y;
  let seed = b.seed; const rr = () => (seed = (seed*9301 + 49297) % 233280) / 233280;
  let x = tx + (rr()-0.5)*60, y = 0; const pts = [[x, y]];
  while (y < ty) { y = Math.min(ty, y + 12 + rr()*12); x += (rr()-0.5)*20; if (y >= ty) x = tx; pts.push([x, y]); }
  for (const [w, col] of [[5, 'rgba(143,224,255,.6)'], [2, '#ffffff']])
    for (let i = 1; i < pts.length; i++) pline(ctx, pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1], col, w);
}
function render() {
  const shx = game.shake > 0 && !REDUCED ? Math.round(rnd(-3,3)*game.shake*2) : 0, shy = game.shake > 0 && !REDUCED ? Math.round(rnd(-2,2)*game.shake*2) : 0;
  const cx = cam.x, cy = cam.y; cam.x = Math.round(cx) + shx; cam.y = Math.round(cy) + shy;
  ctx.fillStyle = '#100e1a'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(FCV, -cam.x, -cam.y);
  const standH = Math.round(OY - 14*SY - 26);
  if ((game.mode === 'goal' || game.banner) && ['crowd', 'snowcrowd', 'bricks'].includes(TH.back) && Math.floor(game.t*8) % 2)   // the crowd jumps
    ctx.drawImage(FCV, 0, 0, FCV.width, standH, -cam.x, -cam.y - 2, FCV.width, standH);
  if (chaosIs('ice')) { ctx.fillStyle = 'rgba(220,248,255,.34)'; ctx.fillRect(0, 0, W, H); }
  for (const p of players) { const s = S(p.x, p.y), k = clamp(1 - (p.z || 0)/120, 0.4, 1); pellipse(s.x, s.y, Math.round(9*k), 2, 'rgba(0,30,0,.35)'); }
  for (const it of items) { const s = S(it.x, it.y); pellipse(s.x, s.y, 5, 1, 'rgba(0,30,0,.35)'); }
  for (const q of pees) { const s = S(q.x, q.y); pellipse(s.x, s.y, 9, 3, 'rgba(240,210,40,.75)'); pellipse(s.x - 2, s.y - 1, 4, 1, 'rgba(255,245,160,.9)'); }
  for (const r of game.runners) if (r.k === 'wave') drawWave(r);
  { const s = S(ball.x, ball.y), k = clamp(1 - ball.z/180, 0.4, 1)*(giant() ? BIGK : 1); pellipse(s.x, s.y, Math.max(2, Math.round(6*k)), giant() ? 4 : 2, 'rgba(0,30,0,.4)'); }
  if (ball.passAt && !ball.owner && ball.passTo && game.mode === 'play') {   // where the pass will land
    const s = S(ball.passAt.x, ball.passAt.y), k = Math.floor(game.t*8) % 2, col = TEAMS[ball.passTo.team].color;
    pellipseRing(s.x, s.y + 1, 9, 3, '#100810'); pellipseRing(s.x, s.y, 9, 3, k ? col : '#ffffff');
    ctx.fillStyle = k ? col : '#ffffff'; ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 9, 3, 5); ctx.fillRect(Math.round(s.x), Math.round(s.y) - 4, 1, 2);
  }
  const ents = players.map(p => ({ y: p.y, f: () => drawPlayer(p) }));
  ents.push({ y: ball.y + 0.5, f: drawBall });
  for (const it of items) ents.push({ y: it.y, f: () => drawItem(it) });
  if (game.vespa) ents.push({ y: game.vespa.y, f: drawVespa });
  if (game.critter) ents.push({ y: game.critter.y, f: drawCritter });
  for (const r of game.runners) if (r.k !== 'wave') ents.push({ y: r.y, f: () => drawRunner(r) });
  if (game.show) for (const t of [0, 1]) ents.push({ y: mascotPos(t, game.show.t, game.show.kind).y, f: () => drawMascot(t) });
  ents.push({ y: Y1 + 0.1, f: () => ctx.drawImage(FRONT, -cam.x, -cam.y) });
  ents.push({ y: WID + 0.1, f: () => { for (const x of [0, LEN]) { const p = P(x, WID); drawFlag(ctx, { x: p.x - cam.x, y: p.y - cam.y }); } } });
  ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
  for (const p of parts) { const a = p.life/p.max; ctx.globalAlpha = Math.min(1, a*1.5); ctx.fillStyle = p.col;
    const s = Math.max(1, Math.round(p.s*(0.5 + a*0.5))); ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), s, s); }
  ctx.globalAlpha = 1;
  for (const q of pops) ptext(ctx, q.text, Math.round(q.x - cam.x), Math.round(q.y - cam.y - (1 - q.t)*18), 8, q.col, 'center', '#100810');
  for (const p of players) drawEmote(p);
  if (game.weather === 'storm') { ctx.fillStyle = 'rgba(10,12,40,.28)'; ctx.fillRect(0, 0, W, H); }
  if (chaosIs('moon')) { ctx.fillStyle = 'rgba(40,20,90,.3)'; ctx.fillRect(0, 0, W, H); }
  if (chaosIs('quake')) { ctx.fillStyle = 'rgba(255,60,20,.1)'; ctx.fillRect(0, 0, W, H); }
  if (rain.length && game.weather === 'snow') { ctx.fillStyle = '#ffffff'; for (const d of rain) ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s > 30 ? 2 : 1, d.s > 30 ? 2 : 1); }
  else if (rain.length) { ctx.fillStyle = 'rgba(190,225,255,.6)'; const dx = (game.wind.x*1.2 - 40)/250;
    for (const d of rain) for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(d.x + dx*k), Math.round(d.y + k), 1, 1); }
  if (TH.tint) { ctx.fillStyle = TH.tint; ctx.fillRect(0, 0, W, H); }
  drawBeam();
  drawBolt();
  drawOffscreen();
  cam.x = cx; cam.y = cy;
  if (game.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(REDUCED ? 0.3 : 0.85, game.flash)})`; ctx.fillRect(0, 0, W, H); }
  if (game.mode !== 'title') { drawHUD(); drawChaosBar(); drawHalfBoard(); }
  if (game.show && NET.role === 'solo' && game.show.t > 0.6 && Math.floor(game.t*2) % 2) ptext(ctx, 'ТАП - ПРОПУСТИТЬ', W/2, H - 12, 8, '#ffffff', 'center', '#100810');
  if (NET.role === 'guest' && game.mode === 'play' && performance.now() - NET.snapAt > 600 && Math.floor(game.t*4) % 2)
    ptext(ctx, 'СВЯЗЬ…', W/2, H - 34, 8, '#ff9a5a', 'center', '#100810');   // waiting for the host
  if (game.banner) { const t = game.banner.t, sc = t < 0.25 ? 8 + 16*(t/0.25) : 24, y = 78 + Math.sin(t*6)*3;
    const cyc = ['#ffffff', game.banner.col, '#f2c230', game.banner.col][Math.floor(t*12) % 4];
    ptext(ctx, game.banner.text, W/2, y, Math.round(sc), cyc, 'center', '#100810'); }
  if (game.announce) { const a = game.announce, k = clamp((1.3 - a.t)*6, 0, 1), fits = a.text.length*16 <= W - 12;
    ptext(ctx, a.text, W/2, 42, fits ? Math.round(8 + 8*k) : 8, a.col, 'center', '#100810'); }
}

// ================== career: your club or your player on a world tour ==================
// Saved in this browser. A season = TOUR_LEN away matches, each in the opponent's country on its home pitch;
// between them a short flight. Team career: a club you design. Player career: you make one player, join a
// club and control only him (teammates pass to you); your goals are counted.
const TOUR_LEN = 8;
const KITCOL = ['#d8243a', '#2a4ad8', '#2a9a3a', '#ffd23a', '#ff8a1a', '#9a3ad8', '#ffffff', '#202030', '#2fb8e8', '#ff6a9a', '#8a4a2a', '#7ae070'];
const KITNAME = ['КРАСНЫЙ', 'СИНИЙ', 'ЗЕЛЁНЫЙ', 'ЖЁЛТЫЙ', 'ОРАНЖЕВЫЙ', 'ФИОЛЕТ', 'БЕЛЫЙ', 'ЧЁРНЫЙ', 'ГОЛУБОЙ', 'РОЗОВЫЙ', 'КОРИЧНЕВЫЙ', 'САЛАТОВЫЙ'];
const EMO_RU = { pizza:'ПИЦЦА', volcano:'ВУЛКАН', wolf:'ВОЛК', ghost:'ПРИЗРАК', money:'ДЕНЬГИ', rocket:'РАКЕТА', horse:'КОНЬ', bowl:'БЕШБАРМАК', eagle:'ОРЁЛ',
  baguette:'БАГЕТ', croissant:'КРУАССАН', beret:'БЕРЕТ', pretzel:'КРЕНДЕЛЬ', sausage:'СОСИСКА', tea:'ЧАЙ', umbrella:'ЗОНТ', bull:'БЫК', paella:'ПАЭЛЬЯ',
  sardine:'САРДИНА', rooster:'ПЕТУХ', tulip:'ТЮЛЬПАН', cheese:'СЫР', clog:'САБО', penguin:'ПИНГВИН', snowflake:'СНЕЖИНКА', anchor:'ЯКОРЬ', crab:'КРАБ',
  key:'КЛЮЧ', candle:'СВЕЧА', trident:'ТРЕЗУБЕЦ', fish:'РЫБА', ger:'ЮРТА', bow:'ЛУК', camel:'ВЕРБЛЮД' };
const SKINS = [['light', 'СВЕТЛАЯ'], ['tan', 'СМУГЛАЯ'], ['dark', 'ТЁМНАЯ'], ['east', 'АЗИАТСКАЯ'], ['pale', 'БЛЕДНАЯ']];
const HAIRS = [['spiky', '#1a1420', '#463c5e', 'ЁЖИК'], ['pomp', '#141010', '#3a3030', 'ЧЁЛКА'], ['crop', '#3a2414', '#6a4428', 'КОРОТКАЯ'],
  ['spiky', '#d8b040', '#fff0a0', 'БЛОНД'], ['pomp', '#a8381c', '#d8622e', 'РЫЖАЯ'], ['long', '#141010', '#3a3030', 'ДЛИННАЯ'], ['long', '#d8b040', '#fff0a0', 'ЛОКОНЫ']];
const FACES = [['', 'ОБЫЧНОЕ'], ['beard', 'БОРОДА'], ['mus', 'УСЫ'], ['glasses', 'ОЧКИ'], ['beard glasses', 'БОРОДА+ОЧКИ'], ['bald', 'ЛЫСЫЙ'], ['bald beard', 'ЛЫСЫЙ+БОРОДА'], ['band', 'ПОВЯЗКА']];
const ROLES = [['att', 'НАПАДАЮЩИЙ', 10], ['mid', 'ПОЛУЗАЩИТНИК', 6], ['def', 'ЗАЩИТНИК', 2]];
const NAMEPOOL = ['МЯЧИКОВ', 'ШТАНГИН', 'ФИНТОВ', 'УДАЛОВ', 'ПАСОВ', 'ВОРОТОВ', 'СВИСТКОВ', 'ПОДКАТОВ', 'НАВЕСОВ', 'БУТСИН', 'ГАЗОНОВ',
  'ЛЕВША', 'ДРИБЛИН', 'ПЕНАЛЬТИ', 'СЕЙВОВ', 'ТАЙМОВ', 'КРОССОВ', 'ГОЛОВИН'];
const shade = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16)*k)).map(v => Math.min(255, v).toString(16).padStart(2, '0')).join('');
let career = store.get('career', null);
if (career && (!Array.isArray(career.tour) || !career.kind)) career = null;
let draft = null;
const meLocked = () => game.career && career && career.kind === 'player';
const myKey = () => career.kind === 'team' ? 'my' : career.clubKey;
// a club built from the team form
function makeClub(t) {
  const j = KITCOL[t.shirt], sh = KITCOL[t.shorts], dark = shade(j, 0.72), light = t.shirt === 6 || t.shirt === 3 || t.shirt === 11;
  return { code: t.name.replace(/[^A-ZА-ЯЁ]/gi, '').slice(0, 3).toUpperCase() || 'МОЯ', name: t.name.toUpperCase(),
    jersey: j, jerseyS: dark, sleeve: j, sleeveS: dark, trim: light ? '#202030' : '#ffffff', shorts: sh, shortsS: shade(sh, 0.75), socks: j, socksS: dark, boots: '#202030',
    color: j === '#202030' ? '#c8c8d4' : j, hudBg: dark, home: t.home, emo: [t.emo, 'laugh'], flag: [j, sh, j], dir: 'v', skill: t.skill || 'herd',
    gk: { jersey: '#3ac85a', jerseyS: '#249a40', sleeve: '#3ac85a', sleeveS: '#249a40', shorts: '#202030', shortsS: '#101018', socks: '#3ac85a', socksS: '#249a40', trim: '#ffffff' },
    looks: [{ ...LOOK.light, hair: '#1a1420', hairHi: '#463c5e', style: 'spiky' }, { ...LOOK.dark, hair: '#141010', hairHi: '#3a3030', style: 'crop' },
      { ...LOOK.tan, hair: '#3a2414', hairHi: '#6a4428', style: 'pomp' }, { ...LOOK.light, hair: '#d8b040', hairHi: '#fff0a0', style: 'crop' }],
    names: t.names };
}
function registerCareer() { delete CLUBS.my; if (career && career.kind === 'team') CLUBS.my = makeClub(career.team); SPR.clear(); }
function newTour() {
  const mine = career.kind === 'team' ? [] : [career.clubKey], pool = CLUB_KEYS.filter(k => !mine.includes(k));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  career.tour = pool.slice(0, TOUR_LEN).map(key => ({ key, r: null })); career.round = 0;
  career.season = (career.season || 0) + 1; career.stats = { w: 0, d: 0, l: 0, gf: 0, ga: 0, goals: 0 };
  const st = ensureStory(), ri = career.tour.findIndex(s => s.key === st.rival.club);   // the season ends against the rival
  if (ri >= 0) [career.tour[ri], career.tour[TOUR_LEN - 1]] = [career.tour[TOUR_LEN - 1], career.tour[ri]];
  else if (st.rival.club !== myKey()) career.tour[TOUR_LEN - 1].key = st.rival.club;
  st.goal = newGoal(); st.mod = null; st.pending = null; st.board = Math.max(st.board, 50);   // a new season, new hope
}
// your player takes his slot in the club you joined
function placeMe() {
  if (!career || career.kind !== 'player') return;
  const pl = career.player, slot = ROLES[pl.role][2], p = players.find(q => q.team === 0 && q.slot === slot); if (!p) return;
  const H = HAIRS[pl.hair], sk = LOOK[SKINS[pl.skin][0]];
  Object.assign(p, { me: true, name: pl.name, num: 7, feat: [FACES[pl.face][0], pl.short ? 'short' : ''].join(' ').trim(),
    lookObj: { ...sk, hair: H[1], hairHi: H[2], style: H[0] } });
}
function careerResult(a, b) {
  const st = career.stats, stop = career.tour[career.round]; if (!stop) return '';
  stop.r = [a, b]; st.gf += a; st.ga += b; st.goals += game.myGoals || 0;
  if (a > b) st.w++; else if (a === b) st.d++; else st.l++;
  const sy = ensureStory(), res = a > b ? 'w' : a === b ? 'd' : 'l', opp = CLUBS[stop.key].name, ok = goalMet(sy.goal, a, b);
  sy.board = clamp(sy.board + (ok ? 12 : -18), 0, 100); sy.fame += res === 'w' ? 6 : res === 'd' ? 2 : 0;
  sy.pending = { res, a, b, opp, ok };
  if (sy.mod === 'promise') { const kept = career.kind === 'player' ? (game.myGoals || 0) > 0 : a > 0; sy.pending.promise = kept; sy.fame = Math.max(0, sy.fame + (kept ? 30 : -20)); }
  addNews(storyFill(any(STORY.results[res]), { opp }) + ' ' + a + ':' + b);
  sy.mod = null; career.round++; sy.goal = career.round < TOUR_LEN ? newGoal() : null; store.set('career', career);
  const pts = st.w*3 + st.d, mine = career.kind === 'player' ? ` Твоих голов: ${game.myGoals || 0}.` : '';
  return (ok ? 'ЗАДАЧА ВЫПОЛНЕНА. ' : 'ЗАДАЧА ПРОВАЛЕНА. ') + `Турне: ${career.round}/${TOUR_LEN}, очков: ${pts}.${mine}`;
}
// ---- screens
function openCareer() {
  const has = !!career; $('carHub').hidden = !has; $('carNew').hidden = has;
  $('carInfo').textContent = has ? (career.kind === 'team' ? 'КЛУБ ' + career.team.name.toUpperCase() : career.player.name + ' · ' + CLUBS[career.clubKey].name) + ' · СЕЗОН ' + career.season : 'СОЗДАЙ КЛУБ ИЛИ ИГРОКА';
  showOv('ovCareer');
}
const FORM = {
  team: [['name'], ['shirt', 'ФУТБОЛКА', () => KITCOL.length, v => KITNAME[v]], ['shorts', 'ШОРТЫ', () => KITCOL.length, v => KITNAME[v]],
    ['emo', 'ЭМОДЗИ', () => Object.keys(EMO_RU).length, v => EMO_RU[Object.keys(EMO_RU)[v]]], ['home', 'ДОМ. ПОЛЕ', () => THEME_KEYS.length, v => THEMES[THEME_KEYS[v]].name],
    ['skill', 'СКИЛЛ', () => SKILL_KEYS.length, v => SKILLS[SKILL_KEYS[v]].short]],
  player: [['name'], ['skin', 'КОЖА', () => SKINS.length, v => SKINS[v][1]], ['hair', 'ПРИЧЁСКА', () => HAIRS.length, v => HAIRS[v][3]],
    ['face', 'ЛИЦО', () => FACES.length, v => FACES[v][1]], ['short', 'РОСТ', () => 2, v => v ? 'КОРОТЫШКА' : 'ОБЫЧНЫЙ'],
    ['role', 'ПОЗИЦИЯ', () => ROLES.length, v => ROLES[v][1]], ['club', 'КОМАНДА', () => CLUB_KEYS.length, v => CLUBS[CLUB_KEYS[v]].name]],
};
function openCreate(kind) {
  draft = kind === 'team' ? { kind, name: 'ДРУЖБА', shirt: 0, shorts: 6, emo: 0, home: 0, skill: 0 } : { kind, name: 'ИГРОК', skin: 0, hair: 0, face: 0, short: 0, role: 0, club: 0 };
  $('crTitle').innerHTML = kind === 'team' ? 'СВОЯ КОМАНДА<span>ФОРМА И ХАРАКТЕР</span>' : 'СВОЙ ИГРОК<span>ВНЕШНОСТЬ И КЛУБ</span>';
  const box = $('crFields'); box.textContent = '';
  const inp = document.createElement('input'); inp.className = 'codein namein'; inp.id = 'crName'; inp.maxLength = 12; inp.value = draft.name;
  inp.setAttribute('aria-label', kind === 'team' ? 'Название клуба' : 'Имя игрока'); inp.autocomplete = 'off'; inp.spellcheck = false;
  inp.addEventListener('input', () => { draft.name = inp.value.toUpperCase().slice(0, 12); renderCreate(); }); box.appendChild(inp);
  for (const [key, label, n] of FORM[kind]) { if (!label) continue;
    const b = document.createElement('button'); b.className = 'mi'; b.dataset.k = key;
    b.addEventListener('click', () => { audioInit(); draft[key] = (draft[key] + 1) % n(); renderCreate(); }); box.appendChild(b); }
  renderCreate(); showOv('ovCreate');
}
function draftClub() {
  if (draft.kind === 'team') return makeClub({ name: draft.name || 'КЛУБ', shirt: draft.shirt, shorts: draft.shorts, emo: Object.keys(EMO_RU)[draft.emo], home: THEME_KEYS[draft.home], skill: SKILL_KEYS[draft.skill], names: NAMEPOOL.slice(0, 11) });
  return CLUBS[CLUB_KEYS[draft.club]];
}
function renderCreate() {
  for (const [key, label, , fmt] of FORM[draft.kind]) { if (!label) continue; const b = $('crFields').querySelector(`[data-k="${key}"]`); b.innerHTML = label + ' <b>' + fmt(draft[key]) + '</b>'; }
  const c = draftClub(), g = $('crKit').getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 40, 40); SPR.clear();
  const v = draft.kind === 'team' ? { look: 0, num: 10 } : { num: 7, feat: [FACES[draft.face][0], draft.short ? 'short' : ''].join(' ').trim(),
    lookObj: { ...LOOK[SKINS[draft.skin][0]], hair: HAIRS[draft.hair][1], hairHi: HAIRS[draft.hair][2], style: HAIRS[draft.hair][0] } };
  g.drawImage(getSprite(c, 'cheer', 'shout', 0, 'side', v), 0, 0);
  g.fillStyle = '#100810'; g.fillRect(0, 0, 14, 10); drawFlagIcon(g, c, 1, 1, 12, 8);
  if (draft.kind === 'team') g.drawImage(EMO[Object.keys(EMO_RU)[draft.emo]], 26, 0);
  $('crName2').textContent = draft.kind === 'team' ? (draft.name || 'КЛУБ') : (draft.name || 'ИГРОК') + ' · ' + c.name;
}
function finishCreate() {
  const nm = (draft.name || '').trim() || (draft.kind === 'team' ? 'КЛУБ' : 'ИГРОК');
  if (draft.kind === 'team') {
    const names = NAMEPOOL.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    career = { v: 1, kind: 'team', team: { name: nm, shirt: draft.shirt, shorts: draft.shorts, emo: Object.keys(EMO_RU)[draft.emo], home: THEME_KEYS[draft.home], skill: SKILL_KEYS[draft.skill], names: names.slice(0, 11) } };
  } else career = { v: 1, kind: 'player', clubKey: CLUB_KEYS[draft.club], player: { name: nm, skin: draft.skin, hair: draft.hair, face: draft.face, short: draft.short, role: draft.role } };
  newTour(); registerCareer(); store.set('career', career); openTour();
}
function openTour() {
  registerCareer();
  const sy = ensureStory();
  if (sy.pending) { postMatch(openTour); return; }
  const me = CLUBS[myKey()], st = career.stats, done = career.round >= TOUR_LEN, list = $('tourList'); list.textContent = '';
  $('tourWho').textContent = (career.kind === 'team' ? me.name : career.player.name + ' · ' + me.name) + ' · СЕЗОН ' + career.season;
  career.tour.forEach((stop, i) => {
    const c = CLUBS[stop.key], li = document.createElement('li'), fl = document.createElement('canvas'); fl.width = 14; fl.height = 10;
    const fg = fl.getContext('2d'); fg.fillStyle = '#100810'; fg.fillRect(0, 0, 14, 10); drawFlagIcon(fg, c, 1, 1, 12, 8);
    li.appendChild(fl); const tx = document.createElement('span');
    const r = stop.r, res = r ? (r[0] > r[1] ? ' ПОБЕДА ' : r[0] === r[1] ? ' НИЧЬЯ ' : ' ПОРАЖЕНИЕ ') + r[0] + ':' + r[1] : i === career.round ? ' < СЛЕДУЮЩИЙ' : '';
    tx.textContent = c.name + ' · ' + THEMES[c.home].name + res; li.appendChild(tx);
    li.className = r ? (r[0] > r[1] ? 'w' : r[0] === r[1] ? 'd' : 'l') : i === career.round ? 'next' : ''; list.appendChild(li);
  });
  const pts = st.w*3 + st.d, mine = career.kind === 'player' ? ' · ТВОИ ГОЛЫ ' + st.goals : '';
  let title = '';
  if (done) title = pts >= 19 ? 'ЧЕМПИОН МИРОВОГО ТУРНЕ! ' : pts >= 13 ? 'ПРИЗЁР ТУРНЕ! ' : pts >= 7 ? 'КРЕПКИЙ СЕРЕДНЯК. ' : 'ТУРИСТ. ПОЛЕТЕЛИ ЕЩЁ? ';
  if (done && career.kind === 'player' && st.goals >= 8) title += 'ЗОЛОТАЯ БУТСА! ';
  $('tourStats').textContent = title + 'ОЧКИ ' + pts + ' · В ' + st.w + ' Н ' + st.d + ' П ' + st.l + ' · МЯЧИ ' + st.gf + ':' + st.ga + mine;
  $('miFly').textContent = done ? 'НОВЫЙ СЕЗОН' : 'ЛЕТИМ!';
  $('tourMeta').textContent = 'ФАНАТЫ ' + fansTxt(sy.fame) + ' · ДОВЕРИЕ ' + sy.board + '% · ' + STORY.traitName[mainTrait(sy)] + (sy.mod ? ' · ' + STORY.modName[sy.mod] : '');
  $('tourGoal').textContent = sy.goal && !done ? 'ПРЕЗИДЕНТ: ' + sy.goal.t + ' (' + sy.goal.threat + ')' : '';
  const nw = $('tourNews'); nw.textContent = ''; for (const h of sy.news.slice(0, 3)) { const li = document.createElement('li'); li.textContent = storyFill(h); nw.appendChild(li); }
  $('tourWho').textContent += ' · ' + storyFill(chapter().title).split('.')[0];
  showOv('ovTour');
}
// the flight to the next stop, then the match
let flightRaf = 0;
function fly() {
  if (career.round >= TOUR_LEN) { newTour(); store.set('career', career); openTour(); return; }
  preMatch(flyGo);
}
function flyGo() {
  const stop = career.tour[career.round], dest = CLUBS[stop.key], from = CLUBS[myKey()];
  $('flightTxt').textContent = 'ЛЕТИМ: ' + dest.name + ' · ' + THEMES[dest.home].name;
  showOv('ovFlight'); sfx('whistle');
  const cv2 = $('flightCv'), g = cv2.getContext('2d'), t0 = performance.now();
  cancelAnimationFrame(flightRaf);
  const tick = now => {
    const t = (now - t0)/1000; g.imageSmoothingEnabled = false;
    ['#4ab0ec', '#6abcf0', '#8acaf4', '#aad8f8'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i*30, 240, 30); });
    g.fillStyle = '#ffffff'; for (let k = 0; k < 7; k++) { const x = ((k*53 - t*60) % 280 + 280) % 280 - 30, y = 12 + (k*29) % 90; g.fillRect(x, y, 26, 5); g.fillRect(x + 5, y - 3, 14, 3); }
    g.fillStyle = '#100810'; g.fillRect(6, 96, 26, 18); drawFlagIcon(g, from, 7, 97, 24, 16); g.fillRect(208, 96, 26, 18); drawFlagIcon(g, dest, 209, 97, 24, 16);
    const k = Math.min(1, t/2), px = 20 + k*190, py = 70 - Math.sin(k*Math.PI)*40 + Math.sin(t*8);
    for (let d = 1; d < 12; d++) { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(px - d*6, py + 3 + Math.sin(k*Math.PI)*d*0.8, 3, 1); }
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(px + x), Math.round(py + y), w, h); };
    R(-12, -2, 24, 6, '#100810'); R(-11, -1, 22, 4, '#f4f4f4'); R(-11, 1, 22, 1, from.jersey); R(9, -1, 4, 3, '#4ab8ff');
    R(-2, -7, 5, 6, '#100810'); R(-1, -6, 3, 5, '#d8dce8'); R(-3, 3, 7, 4, '#100810'); R(-2, 3, 5, 3, '#d8dce8'); R(-12, -6, 4, 5, '#100810'); R(-11, -5, 2, 4, from.jersey);
    if (t < 2.4 && !$('ovFlight').hidden) flightRaf = requestAnimationFrame(tick);
    else if (!$('ovFlight').hidden) startMatch(11, { a: myKey(), b: stop.key, theme: dest.home, career: true, mod: career.story && career.story.mod });
  };
  flightRaf = requestAnimationFrame(tick);
}

// ================== career story ==================
// A parody of sports-game career modes, texts in src/story.js. Each season is a chapter: fixed story beats before
// some rounds (agent, rival, board, family twist), random silly events before the others, a board demand for
// every match, a press conference after it, getting fired (and rehired: nobody else wants the job) when the
// board's trust hits zero, and the «golden ball» ceremony at the end. Choices change fans, trust, your
// personality and give modifiers for the next match. State: career.story, saved with the career.
const STORY = window.AZZ_STORY;
const any = a => a[Math.floor(Math.random()*a.length)];
function ensureStory() {
  if (!career.story) career.story = { fame: 1, board: 60, trait: { calm: 0, fire: 0, mad: 0 }, news: [], seen: {}, fired: 0, mod: null, goal: null, pending: null };
  const st = career.story;
  if (!st.rival) { const last = career.tour[career.tour.length - 1]; st.rival = { name: any(STORY.rivals), club: last ? last.key : any(CLUB_KEYS.filter(k => k !== myKey())) }; }
  if (!st.big) st.big = any(STORY.bigClubs);
  if (!st.goal && career.round < TOUR_LEN) st.goal = newGoal();
  return st;
}
function newGoal() {
  const final = career.round === TOUR_LEN - 1, pool = STORY.goals.filter(g => !g.player || career.kind === 'player');
  const g = final ? STORY.goals[0] : career.round < 2 ? any(pool.filter(g => g.k !== 'margin' && g.k !== 'win')) : any(pool);
  return { k: g.k, t: g.t, threat: any(STORY.threats) };
}
function goalMet(g, a, b) {
  switch (g.k) { case 'win': return a > b; case 'nolose': return a >= b; case 'score2': return a >= 2; case 'clean': return b <= 1;
    case 'margin': return a - b >= 2; case 'mine': return (game.myGoals || 0) > 0; } return true;
}
function storyFill(text, extra) {
  const st = career.story || {}, stop = career.tour[Math.min(career.round, career.tour.length - 1)], x = extra || {};
  const map = { ME: career.kind === 'player' ? career.player.name : 'ТРЕНЕР', CLUB: CLUBS[myKey()].name, RIV: st.rival ? st.rival.name : '',
    RCLUB: st.rival && CLUBS[st.rival.club] ? CLUBS[st.rival.club].name : '', OPP: x.opp || (stop ? CLUBS[stop.key].name : ''), BIG: st.big || '', S: career.season };
  return text.replace(/\{(\w+)\}/g, (m, k) => map[k] !== undefined ? map[k] : m);
}
function storyFx(fx) {
  const st = career.story; if (!fx) return;
  if (fx.f) st.fame = Math.max(0, st.fame + fx.f);
  if (fx.b) st.board = clamp(st.board + fx.b, 0, 100);
  if (fx.t) st.trait[fx.t] = (st.trait[fx.t] || 0) + 1;
  if (fx.m) st.mod = fx.m;
  if (fx.news) addNews(fx.news);
  store.set('career', career);
}
const fansTxt = n => { const v = n*1000 + 3; return v >= 1e6 ? (v/1e6).toFixed(1) + 'M' : v >= 1000 ? Math.round(v/1000) + 'K' : String(v); };
const mainTrait = st => Object.keys(st.trait).reduce((a, k) => st.trait[k] > st.trait[a] ? k : a, 'calm');
// ---- portraits: the cast are drawn with the game's own player sprite in their own outfits
function castClub(key, c) {
  const j = c.kit[0], sh = c.kit[1], H = c.hair;
  return { code: 'CAST' + key, jersey: j, jerseyS: shade(j, 0.72), sleeve: j, sleeveS: shade(j, 0.72), trim: '#ffffff', shorts: sh, shortsS: shade(sh, 0.75),
    socks: sh, socksS: shade(sh, 0.75), boots: '#202030', looks: [{ ...LOOK[c.skin], hair: H[1], hairHi: H[2], style: H[0] }] };
}
function drawFace(who, talk) {
  const g = $('stFace').getContext('2d'), c = STORY.cast[who] || {}; g.imageSmoothingEnabled = false;
  g.fillStyle = '#1c2a52'; g.fillRect(0, 0, 40, 40); g.fillStyle = '#24366a'; for (let y = 0; y < 40; y += 4) g.fillRect(0, y, 40, 2);
  const expr = talk ? 'shout' : 'normal';
  if (c.icon) { g.drawImage(EMO[c.icon], 6, 6 + (talk ? -1 : 0), 28, 28); return; }
  if (who === 'me') {
    if (career.kind === 'player') { const pl = career.player, H = HAIRS[pl.hair];
      g.drawImage(getSprite(CLUBS[myKey()], 'idle', expr, 0, 'side', { num: 7, feat: [FACES[pl.face][0], pl.short ? 'short' : ''].join(' ').trim(), lookObj: { ...LOOK[SKINS[pl.skin][0]], hair: H[1], hairHi: H[2], style: H[0] } }), 0, 1); }
    else g.drawImage(getSprite(CLUBS[myKey()], 'idle', expr, 0, 'side', { look: 0, num: 1, feat: 'mus' }), 0, 1);
    return;
  }
  if (who === 'rival') { const rc = CLUBS[career.story.rival.club] || CLUBS.nap;
    g.drawImage(getSprite(rc, 'idle', talk ? 'shout' : 'grit', 0, 'side', { look: 0, num: 10, ssj: true, feat: 'band' }), 0, 1); return; }
  if (c.kit) g.drawImage(getSprite(castClub(who, c), 'idle', expr, 0, 'side', { num: 0, feat: c.feat }), 0, 1);
}
// ---- the scene player: one line at a time, typed out, with a talking portrait; choices are buttons
let sceneQ = [], sceneEnd = null, typeT = 0, typeFull = '', typeN = 0, typeWho = '';
function playScene(steps, title, done) {
  sceneQ = steps.slice(); sceneEnd = done; $('stTitle').textContent = storyFill(title || ''); showOv('ovStory'); sceneNext();
}
function sceneNext() {
  clearInterval(typeT);
  const step = sceneQ.shift();
  if (!step) { const d = sceneEnd; sceneEnd = null; if (d) d(); return; }
  const [who, text, ch] = step, c = STORY.cast[who] || {};
  typeWho = who; $('stScene').classList.toggle('narr', who === 'narr');
  $('stWho').textContent = who === 'me' ? (career.kind === 'player' ? career.player.name : 'ТЫ, ТРЕНЕР') : who === 'rival' ? career.story.rival.name : c.name || '';
  typeFull = storyFill(text); typeN = 0; $('stText').textContent = '';
  if (who !== 'narr') drawFace(who, true);
  typeT = setInterval(() => { typeN += 2; $('stText').textContent = typeFull.slice(0, typeN);
    if (typeWho !== 'narr') drawFace(typeWho, typeN < typeFull.length && Math.floor(typeN/6) % 2 === 0);
    if (typeN >= typeFull.length) clearInterval(typeT); }, 33);
  if (who !== 'narr' && Math.random() < 0.5) sfx(who === 'goose' ? 'honk' : 'blip');
  const box = $('stChoices'); box.textContent = '';
  const btn = (label, fn, go) => { const b = document.createElement('button'); b.className = 'mi' + (go ? ' go' : ''); b.textContent = label;
    b.addEventListener('click', () => { audioInit(); fn(); }); box.appendChild(b); return b; };
  if (ch) for (const [label, fx, reply] of ch) btn(storyFill(label), () => { storyFx(fx); sceneQ = (reply || []).concat(sceneQ); sceneNext(); });
  else btn('ДАЛЕЕ ▶', sceneNext, true);
  const first = box.querySelector('.mi'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
}
function sceneTap() {   // tapping the speech box shows the whole line at once
  if (typeN < typeFull.length) { typeN = typeFull.length; $('stText').textContent = typeFull; clearInterval(typeT); if (typeWho !== 'narr') drawFace(typeWho, false); }
  else if (!$('stChoices').querySelector('.mi:not(.go)')) sceneNext();
}
// ---- story flow around the matches
function chapter() { return STORY.chapters[Math.min(career.season, STORY.chapters.length) - 1]; }
// before a match: this round's beat, or now and then a random event; then the board's demand
function preMatch(go) {
  const st = ensureStory(), key = 's' + career.season + 'r' + career.round, ch = chapter();
  if (st.seen[key]) { go(); return; }
  st.seen[key] = 1; store.set('career', career);
  let steps = ch.beats[career.round];
  if (!steps && Math.random() < 0.7) { const pool = STORY.events.map((e, i) => i).filter(i => !st.seen['e' + career.season + '_' + i]);
    if (pool.length) { const i = any(pool); st.seen['e' + career.season + '_' + i] = 1; steps = STORY.events[i]; } }
  const demand = ['boss', 'Задача на матч с {OPP}: ' + st.goal.t + '. ' + st.goal.threat + '.'];
  playScene((steps || []).concat([demand]), ch.title, go);
}
function addNews(text) { const st = career.story; st.news.unshift(text); st.news = st.news.slice(0, 6); }
// after the match: the board's verdict, the press conference, maybe getting fired, at the end of the season the ceremony
function postMatch(done) {
  const st = ensureStory(), pm = st.pending; if (!pm) { done(); return; }
  const steps = [];
  steps.push(['boss', any(pm.ok ? STORY.verdict.ok : STORY.verdict.fail)]);
  if (pm.promise !== undefined) steps.push(pm.promise ? ['narr', 'Обещание выполнено! Фанаты носят тебя на руках. Уронили два раза, но это любя.']
    : ['rival', 'Гола нет! Всем скажешь, что пользуешься моими духами. «{RIV} NOIR», 199 евро.']);
  const [q, ans] = any(STORY.press[pm.res]), outlet = any(STORY.outlets);
  steps.push(['press', outlet + ': ' + q, ['calm', 'fire', 'mad'].map((t, i) => { const hl = storyFill(any(STORY.headlines[t]), { opp: pm.opp });
    return [ans[i], { ...STORY.pressFx[t], t, news: hl }, [['press', 'ЗАГОЛОВОК: ' + hl]]]; })]);
  playScene(steps, 'ПРЕСС-КОНФЕРЕНЦИЯ', () => {
    st.pending = null; store.set('career', career);
    const next = () => career.round >= TOUR_LEN && !st.seen['cer' + career.season] ? ceremony(done) : done();
    if (st.board <= 0) { st.board = 30; st.fired++; addNews(career.kind === 'player' ? '{ME} НА ТРАНСФЕРЕ ЗА 1 ЕВРО. ПОКУПАТЕЛЕЙ НЕТ' : 'ТРЕНЕРА УВОЛИЛИ И ТУТ ЖЕ ВЕРНУЛИ');
      store.set('career', career); playScene(STORY.fired[career.kind], 'УВОЛЬНЕНИЕ', next); }
    else next();
  });
}
function ceremony(done) {
  const st = career.story, s = career.stats, pts = s.w*3 + s.d, C = STORY.ceremony;
  st.seen['cer' + career.season] = 1; store.set('career', career);
  const win = pts >= 19 || (career.kind === 'player' && s.goals >= 10);
  playScene(C.intro.concat(win ? C.gold : pts >= 13 ? C.silver : C.none, [['narr', C.trait[mainTrait(st)]]], C.outro), 'ЗОЛОТОЙ МЯЧ', () => {
    addNews(win ? '{ME} ВЗЯЛ ЗОЛОТОЙ МЯЧ. МАМЫ ЛИКУЮТ' : '{RIV} СНОВА ЛУЧШИЙ. {ME} ДЕРЖИТ ЛИЦО'); store.set('career', career); done(); });
}

// ================== rules screen: looping mini-animations ==================
// Each card replays its move in an 80x48 scene drawn with the game's own sprites (Napoli vs Roma).
const HELP = (() => {
  const P0 = { look: 0, num: 10 }, sp = (team, pose, expr, frame, ssj) => getSprite(team ? CLUBS.rom : CLUBS.nap, pose, expr, frame, 'side', { ...P0, ssj });
  const grass = g => { for (let y = 0; y < 48; y += 8) { g.fillStyle = (y/8) % 2 ? '#3cbc38' : '#46cf40'; g.fillRect(0, y, 80, 8); } };
  const put = (g, s, x, y, flip) => { if (flip) { g.save(); g.translate(Math.round(x), 0); g.scale(-1, 1); g.drawImage(s, -20, Math.round(y) - 39); g.restore(); } else g.drawImage(s, Math.round(x) - 20, Math.round(y) - 39); };
  const ballAt = (g, x, y, t) => g.drawImage(BALLSPR[Math.floor(t*20) % 8], Math.round(x) - 6, Math.round(y) - 12);
  const dot = (g, x, y, c, s) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), s || 2, s || 2); };
  const goal = (g, x) => { g.fillStyle = '#ffffff'; g.fillRect(x, 10, 2, 30); g.fillRect(x, 10, 10, 2); for (let k = 0; k < 5; k++) g.fillRect(x + 2 + k*2, 12, 1, 28); };
  const run = (t) => Math.floor(t*10) % 3;
  return {
    furia(g, t) { grass(g); const on = t > 1.2; put(g, sp(0, on ? 'cheer' : 'idle', on ? 'shout' : 'normal', Math.floor(t*6) % 2, on), 40, 44);
      g.fillStyle = '#100810'; g.fillRect(10, 2, 60, 6); g.fillStyle = on ? (Math.floor(t*8) % 2 ? '#ffffff' : '#ffd23a') : '#4aa8f0'; g.fillRect(11, 3, Math.min(58, t/1.2*58), 4);
      if (on) for (let k = 0; k < 6; k++) dot(g, 30 + ((k*13 + t*40) % 22), 40 - ((k*7 + t*60) % 30), k % 2 ? '#ffe14a' : '#fff6b0'); },
    tiger(g, t) { grass(g); goal(g, 70); const x = Math.min(28, 6 + t*30);
      put(g, sp(0, t > 0.9 && t < 1.2 ? 'kick' : 'run', 'grit', run(t), true), x, 44);
      if (t < 1) ballAt(g, x + 9, 44, t); else { const bx = x + 9 + (t - 1)*90; for (let k = 0; k < 6; k++) dot(g, bx - k*5, 37 + (k % 2), k % 2 ? '#100810' : '#ff9a1a', 3);
        if (bx < 72) ballAt(g, bx, 43, t); if (t > 1.45) put(g, sp(1, 'fall', 'bulge', 0), 66, 44); } },
    kame(g, t) { grass(g); goal(g, 70); put(g, sp(0, t < 1.2 ? 'charge' : 'kick', 'grit', 0, true), 16, 44);
      if (t < 1.2) { const r = 1 + t*3; g.fillStyle = 'rgba(120,220,255,.6)'; g.fillRect(24 - r, 26 - r, r*2 + 2, r*2 + 2); dot(g, 24 - r/2, 26 - r/2, '#ffffff', r + 1); }
      else { const bx = Math.min(70, 26 + (t - 1.2)*120); g.fillStyle = 'rgba(80,190,255,.6)'; g.fillRect(26, 37, bx - 26, 6); g.fillStyle = '#ffffff'; g.fillRect(26, 39, bx - 26, 2); ballAt(g, bx, 45, t); } },
    rasen(g, t) { grass(g); goal(g, 70); const k = Math.min(1, t/0.9), bx = 8 + k*22, bz = Math.sin(k*Math.PI)*20 + (1 - k)*4;
      if (t < 1) { put(g, sp(0, 'idle', 'normal', 0, true), 30, 44); ballAt(g, bx, 40 - bz, t); }
      else { const ft = t - 1; if (ft < 0.3) { g.save(); g.translate(30, 18); g.scale(-1, -1); g.drawImage(sp(0, 'kick', 'shout', 0, true), -20, -20); g.restore(); } else put(g, sp(0, 'idle', 'normal', 0, true), 30, 44);
        const x = 36 + ft*60, y = 40 + Math.cos(ft*14)*6; for (let i = 0; i < 4; i++) { const a = t*25 + i*1.6; dot(g, x + Math.cos(a)*6 - 3, y - 6 + Math.sin(a)*4, ['#ffffff', '#8fe0ff', '#4ab8ff', '#2a74c4'][i]); } if (x < 72) ballAt(g, x, y, t); } },
    ora(g, t) { grass(g); const x = Math.min(34, 10 + t*40); put(g, sp(0, t > 0.5 ? 'tackle' : 'run', 'shout', run(t), true), x, 44);
      if (t < 0.6) { put(g, sp(1, 'run', 'normal', run(t)), 46, 44, true); ballAt(g, 40, 44, t); }
      else { const ft = t - 0.6; g.save(); g.translate(52 + ft*24, 30 - Math.sin(Math.min(1, ft)*Math.PI)*16); g.rotate((Math.floor(ft*14) % 4)*Math.PI/2); g.drawImage(sp(1, 'idle', 'bulge', 0), -20, -20); g.restore();
        if (ft < 0.8) for (let k = 0; k < 4; k++) dot(g, 40 + Math.random()*16, 20 + Math.random()*16, k % 2 ? '#ffe14a' : '#ffffff', 2);
        if (ft < 0.8 && Math.floor(ft*6) % 2) ptext(g, 'ОРА!', 52, 4, 8, '#ff6a9a', 'center', '#100810'); } },
    pass(g, t) { grass(g); put(g, sp(0, 'idle', 'normal', 0), 12, 44); const k = Math.min(1, Math.max(0, (t - 0.4)/1.2));
      put(g, sp(0, k < 1 ? 'run' : 'idle', 'normal', run(t)), 60 - (1 - k)*6, 34 + k*4); const tx = 58, ty = 38;
      if (k < 1) { if (Math.floor(t*8) % 2) { g.fillStyle = '#4aa8f0'; g.fillRect(tx - 6, ty, 12, 1); g.fillRect(tx - 1, ty - 5, 2, 4); } ballAt(g, 20 + (tx - 20)*k, 44 + (ty - 44)*k, t); }
      else ballAt(g, tx + 6, ty, t); },
    curve(g, t) { grass(g); goal(g, 70); put(g, sp(1, 'idle', 'normal', 0), 44, 44, true); put(g, sp(0, t < 0.3 ? 'kick' : 'idle', 'grit', 0), 10, 44);
      const k = Math.min(1, t/1.1), x = 18 + k*52, y = 44 - Math.sin(k*Math.PI)*16;
      for (let i = 0; i < k*12; i++) { const kk = i/12; dot(g, 18 + kk*52, 44 - Math.sin(kk*Math.PI)*16 - 4, 'rgba(255,255,255,.7)', 1); }
      if (k < 1) ballAt(g, x, y, t); else if (Math.floor(t*6) % 2) ptext(g, 'ДЗЫНЬ!', 40, 2, 8, '#ffffff', 'center', '#100810'); },
    sprint(g, t) { grass(g); const x = (t*70) % 110 - 15; put(g, sp(0, 'run', 'grit', Math.floor(t*16) % 3), x, 44);
      for (let k = 0; k < 4; k++) dot(g, x - 10 - k*6, 42 - (k % 2), '#ffffff', 2);
      g.fillStyle = '#100810'; g.fillRect(64, 4, 12, 12); g.fillStyle = '#7ae070'; g.fillRect(65, 5 + (t/2.4)*10, 10, 10 - (t/2.4)*10); },
    gk(g, t) { grass(g); goal(g, 70); const k = Math.min(1, t/0.6), bx = 10 + k*56, by = 44 - k*14;
      if (t < 0.45) put(g, CLUBS.rom && getSprite(CLUBS.rom, 'idle', 'grit', 0, 'side', { gk: true }), 64, 44, true);
      else { g.save(); g.translate(62, 26); g.drawImage(getSprite(CLUBS.rom, 'dive', 'grit', 0, 'side', { gk: true }), -20, -20); g.restore(); }
      if (t < 0.6) ballAt(g, bx, by, t); else { ballAt(g, 52 - (t - 0.6)*30, 30 + (t - 0.6)*20, t); if (Math.floor(t*6) % 2) ptext(g, 'СЕЙВ!', 30, 2, 8, '#ffffff', 'center', '#100810'); } },
    chaos(g, t) { grass(g); put(g, sp(0, 'idle', 'bulge', 0), 40, 44); const x = -20 + t*60; g.drawImage(VESPA, Math.round(x) - 18, 17);
      if (x > 30) { g.save(); g.translate(40, 20 - (x - 30)*0.5); g.rotate((Math.floor(t*14) % 4)*Math.PI/2); g.drawImage(sp(0, 'idle', 'bulge', 0), -20, -20); g.restore(); } },
    skill(g, t) { grass(g); const x = -30 + t*70;
      if (x < 34) { put(g, sp(1, 'idle', 'normal', 0), 56, 44, true); }
      else { g.save(); g.translate(56 + (x - 34)*0.4, 26 - Math.sin(Math.min(1, (x - 34)/30)*Math.PI)*12); g.rotate((Math.floor(t*14) % 4)*Math.PI/2); g.drawImage(sp(1, 'idle', 'bulge', 0), -20, -20); g.restore(); }
      for (let n = 0; n < 3; n++) g.drawImage(CRITSPR.horse[Math.floor(t*10 + n) % 2], Math.round(x - n*22) - 16, 8 + n*12);
      if (t > 1.4) { g.fillStyle = 'rgba(240,210,40,.8)'; g.fillRect(48, 44, 16, 3); ptext(g, 'ОПИСАЛСЯ!', 40, 2, 8, '#ffe14a', 'center', '#100810'); } },
    gags(g, t) { grass(g); const ph = Math.floor(t/0.8) % 3;
      if (ph === 0) { put(g, sp(0, 'idle', 'shout', 0), 40, 44); for (let n = 0; n < 6; n++) dot(g, 50 + n*4 + (t % 0.8)*20, 22 + (n % 3), '#d8f0ff', 2); ptext(g, 'АПЧХИ!', 40, 2, 8, '#ffffff', 'center', '#100810'); }
      else if (ph === 1) { put(g, sp(0, 'idle', 'normal', 0), 40, 44); g.fillStyle = '#100810'; g.fillRect(46, 15, 4, 7); g.fillStyle = Math.floor(t*8) % 2 ? '#7fe0ff' : '#fff'; g.fillRect(47, 16, 2, 4); ptext(g, 'МАМА?', 40, 2, 8, '#ffffff', 'center', '#100810'); }
      else { put(g, sp(0, 'idle', 'bulge', 0), 40, 44); g.fillStyle = '#ffffff'; g.fillRect(36, 4, 8, 3); g.fillRect(38, 2, 4, 2); ptext(g, 'ГОЛУБЬ!', 40, 2, 8, '#ffffff', 'center', '#100810'); } },
    items(g, t) { grass(g); ['pizza', 'pepper', 'horn'].forEach((k, i) => g.drawImage(ITEMSPR[k], 12 + i*24, 18 + Math.round(Math.sin(t*4 + i)*2))); },
    fields(g, t) { const th = ['snow', 'ice', 'savanna', 'underwater'][Math.floor(t/0.6) % 4], T = THEMES[th];
      for (let y = 0; y < 48; y += 8) { g.fillStyle = (y/8) % 2 ? T.grass[2] : T.grass[0]; g.fillRect(0, y, 80, 8); }
      ptext(g, T.name, 40, 4, 8, '#ffffff', 'center', '#100810'); put(g, sp(0, 'run', 'normal', run(t)), 40, 46);
      if (th === 'savanna') g.drawImage(CRITSPR.elephant[0], 4, 18); if (th === 'ice') g.drawImage(CRITSPR.penguin[0], 56, 34); },
  };
})();
let helpRaf = 0;
function helpLoop() {
  cancelAnimationFrame(helpRaf);
  const cvs = [...document.querySelectorAll('#ovHelp canvas.anim')], t0 = performance.now();
  const tick = now => {
    if ($('ovHelp').hidden) return;
    const t = ((now - t0)/1000) % 2.4;
    for (const c of cvs) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 80, 48); try { HELP[c.dataset.a](g, t); } catch (e) {} }
    helpRaf = requestAnimationFrame(tick);
  };
  helpRaf = requestAnimationFrame(tick);
}

// ================== canvas taps (weather / sound) ==================
cv.addEventListener('pointerdown', e => {
  audioInit();
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left)*W/r.width, y = (e.clientY - r.top)*H/r.height;
  if (y > HUD.y + HUD.h + 4) return;
  if (HUD.sndX && x >= HUD.sndX - 4 && x < HUD.sndX + 26) setPaused(true);
});
const click = (id, fn) => $(id).addEventListener('click', () => { audioInit(); if (AC && !muted) { try { tone('square', 660, 990, 0.05, 0.05); } catch (e) {} } fn(); });
click('miPlay', () => menuPage('mPlay'));
click('miBack', () => menuPage('mMain'));
click('miOpts', () => menuPage('mOpts'));
click('miOptsBack', () => menuPage('mMain'));
click('miReal', () => { renderTeams(); showOv('ovTeams'); });
click('miTeamsBack', () => { showOv('ovMenu'); menuPage('mMain'); });
click('miKick', () => startMatch(11));
click('miCareer', openCareer);
click('miCarGo', openTour);
click('miCarNew', () => { $('carHub').hidden = true; $('carNew').hidden = false; $('carInfo').textContent = 'НАЧНЁМ С НУЛЯ?'; });
click('miCarBack', () => { showOv('ovMenu'); menuPage('mMain'); });
click('miCarNewBack', () => { if (career) openCareer(); else { showOv('ovMenu'); menuPage('mMain'); } });
click('miNewTeam', () => openCreate('team'));
click('miNewPlayer', () => openCreate('player'));
click('miCrOk', finishCreate);
click('miCrBack', openCareer);
click('miFly', fly);
click('miTourBack', () => { showOv('ovMenu'); menuPage('mMain'); });
click('miToTour', () => { attract(); openTour(); });
$('stScene').addEventListener('click', () => { audioInit(); sceneTap(); });
click('miField', cycleField);
for (const side of [0, 1]) { click('tPrev' + side, () => cycleTeam(side, -1)); click('tNext' + side, () => cycleTeam(side, 1)); }
click('mi11', () => startMatch(1));
click('mi22', () => startMatch(2));
for (const id of ['miDiff', 'miDiffA', 'miDiffT']) click(id, nextDiff);
click('miSnd', () => { muted = !muted; syncSound(); });
click('miChaos', () => { chaosOn = !chaosOn; store.set('chaos', chaosOn); syncOpts(); });
click('miWx', () => { weatherOn = !weatherOn; store.set('wx', weatherOn); syncOpts(); });
click('miExit', () => { stopMusic(); showOv('ovBye'); });
click('miBackFromBye', toMenu);
click('miResume', () => setPaused(false));
click('miSound', () => { muted = !muted; syncSound(); });
click('miQuit', toMenu);
click('miAgain', () => startMatch(MODE, game.lastOpt || undefined));
click('miOnline', () => { NET.ui = 'idle'; NET.msg = ''; showOv('ovOnline'); });
click('miHelp', () => { showOv('ovHelp'); helpLoop(); });
click('miHelpBack', () => { showOv('ovMenu'); menuPage('mMain'); });
click('miHostCoop', () => hostGame('coop'));
click('miHostVs', () => hostGame('vs'));
click('miJoinCode', () => { NET.ui = 'enter'; NET.msg = ''; if (!$('codeIn').value) $('codeIn').value = NET.lastCode; renderLobby(); lobbyFocus(); });
click('miShare', shareGame);
$('nJoin').addEventListener('submit', e => { e.preventDefault(); audioInit(); joinByCode($('codeIn').value); });
$('codeIn').addEventListener('input', e => {
  const el = e.target, v = cleanCode(el.value); if (el.value !== v) el.value = v;
  if (v.length === 5 && e.inputType !== 'deleteContentBackward') { audioInit(); joinByCode(v); }
});
click('miNetBack', () => {
  NET.msg = '';
  if (NET.joining) { NET.joining = null; if (NET.room && NET.room.leave) NET.room.leave(); NET.ui = 'enter'; renderLobby(); lobbyFocus(); return; }
  if (NET.role !== 'solo') { netLeave(); renderLobby(); lobbyFocus(); return; }
  if (NET.ui === 'enter') { NET.ui = 'idle'; renderLobby(); lobbyFocus(); return; }
  showOv('ovMenu'); menuPage('mMain');
});
click('miToMenu', toMenu);
// keyboard: arrows move the menu cursor, P / Esc pauses
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  const open = OVS.map($).find(o => !o.hidden);
  if (open && (k === 'arrowdown' || k === 'arrowup')) {
    const items = [...open.querySelectorAll('.items:not([hidden]) .mi')], i = items.indexOf(document.activeElement);
    const n = items[(i + (k === 'arrowdown' ? 1 : -1) + items.length) % items.length]; if (n) n.focus({ preventScroll: true });
  }
  if ((k === 'p' || k === 'escape') && !e.repeat && !(e.target && e.target.tagName === 'INPUT')) { if (game.paused) setPaused(false); else if (!open) setPaused(true); }
});
const stage = document.getElementById('stage');
const screenEl = document.getElementById('screen');
const app = document.getElementById('app');
let fitting = false;
function fit() {
  if (fitting) return; fitting = true;
  const vw = innerWidth, vh = innerHeight, portrait = TOUCH && vh > vw;
  document.body.classList.toggle('portrait', portrait); document.body.classList.toggle('landscape', TOUCH && !portrait);
  document.body.classList.toggle('touch', TOUCH);
  const ar = app.getBoundingClientRect(), cs = getComputedStyle(app);
  const aw = ar.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  let newW, s;
  if (portrait) {
    newW = 256;                                   // taller picture → bigger players on a narrow screen
    s = Math.min(aw/newW, (ar.height*0.5)/H);
  } else {
    const ah = ar.height - 8;   // the viewer's own padding (top bar, home indicator) is already outside #app
    newW = Math.round(clamp(H*(aw/ah), 260, 400)/2)*2;   // fill wide phones without black bars
    s = Math.min(aw/newW, ah/H);
    if (s >= 2) s = Math.floor(s*4)/4;
  }
  s = Math.max(0.3, s);
  if (newW !== W) { W = newW; cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false; rain.forEach(d => d.x = rnd(0, W)); }
  screenEl.style.width = Math.floor(W*s) + 'px'; screenEl.style.height = Math.floor(H*s) + 'px';
  // joystick zone: below the picture in portrait, lower-left of the picture in landscape
  const sr = screenEl.getBoundingClientRect();
  if (portrait) { zoneL.style.top = Math.round(sr.bottom + 6) + 'px'; zoneL.style.height = 'auto'; zoneL.style.width = '55%'; }
  else { zoneL.style.top = Math.round(vh*0.3) + 'px'; zoneL.style.height = 'auto'; zoneL.style.width = '48%'; }
  if (stickId === null) stickHome();
  fitting = false;
}
new ResizeObserver(fit).observe(document.body); addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 120));

// phone hygiene: no pinch/double-tap zoom, no long-press menus, pause when the app goes to background
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('contextmenu', e => { if (e.target.closest('#app')) e.preventDefault(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (['play', 'goal', 'show'].includes(game.mode) && NET.role === 'solo') setPaused(true); keys.clear(); touchStick = null; touchKick = touchTackle = touchSwitch = false; } });
if (TOUCH && document.fullscreenEnabled) {
  $('miFull').hidden = false;
  click('miFull', () => { const el = document.documentElement;
    const p = document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen({ navigationUI: 'hide' });
    Promise.resolve(p).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => { $('miFull').hidden = true; })
      .finally(() => setTimeout(fit, 200)); });
}

// ================== boot ==================
let last = 0, acc = 0; const STEP = 1/60;
function frame(ts) {
  const dt = Math.min(0.1, (ts - (last || ts))/1000); last = ts; acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render(); updPad(); requestAnimationFrame(frame);
}
const fontReady = document.fonts && document.fonts.load ? document.fonts.load('8px "Press Start 2P"').catch(() => {}) : Promise.resolve();
Promise.race([fontReady, new Promise(r => setTimeout(r, 1500))]).then(() => {
  setWeather('rain'); syncOpts(); toMenu();
  updCamera(0, true); fit(); requestAnimationFrame(frame);
  NET.booted = true; tryAutoJoin();
});
})();
