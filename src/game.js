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
const OX = 44, OY = 64;                // field canvas margins (OY leaves room for the stands)
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
const { clubs: CLUBS, icons: ICONS, themes: THEMES } = window.AZZ_DATA;
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
const BALLSPR = [0, 1].map(f => {
  const c = document.createElement('canvas'); c.width = c.height = 12; const g = c.getContext('2d');
  let rows = ['..wwwwww..','.wwkkwwww.','wwkkkwwkww','wwwkwwkkkw','wwwwwwwkww','wkwwwwwwww','kkkwwkkwww','wkwwkkkwww','.wwwwkwww.','..wwwwww..'];
  if (f) rows = rows.map(s => [...s].reverse().join(''));
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.') return;
    g.fillStyle = ch === 'k' ? '#1a1a24' : (x + y > 12 ? '#c4cadc' : '#ffffff'); g.fillRect(x+1, y+1, 1, 1); }));
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
const keeperSkill = p => cpuSide(p.team) ? D().gk : GK_MATE;

class Player {
  constructor(team, role) {
    Object.assign(this, { team, role, x:0, y:0, vx:0, vy:0, state:ST.IDLE, st:0, fx:team?-1:1, fy:0,
      charge:0, kickSuper:false, superType:'tiger', kickDone:false, hit:new Set(), tBall:false,
      sm:1, tr:1, human:false, aiCd:0, anim:0, fallExpr:'cry', mood:null, z:0, vz:0, buff:null, buffT:0, dingCd:0,
      name:'', num:10, look:0, slot:9, home:null, react:0, holdT:0, saved:false, ora:false, passTo:null,
      stam:1, tired:false, sprinting:false,
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
  if (L === LEN && Wd === WID) return false;
  LEN = L; WID = Wd; Y0 = WID/2 - 40; Y1 = WID/2 + 40;
  FCV.width = FRONT.width = Math.ceil(OX + LEN + WID*SK + 44); FCV.height = FRONT.height = Math.ceil(OY + WID*SY + 30);
  return true;
}
const ball = { shotT:0, passTo:null, passAt:null, x:LEN/2, y:WID/2, z:0, vx:0, vy:0, vz:0, owner:null, superType:null, gs:1, lock:null, lockT:0, last:null, rot:0, drag:1,
  kick(dx, dy, pow, lift, by, type) {
    this.owner = null; this.vx = dx*pow; this.vy = dy*pow; this.vz = lift; this.superType = type || null; this.gs = 1;
    this.shot = false; this.shotT = 0; this.passTo = null; this.passAt = null;
    this.lock = by; this.lockT = 0.3; this.last = by;
    this.beam = null;
    if (type === 'tiger') { this.vz = 18; this.gs = 0.12; }
    else if (type === 'kame') { this.vz = 0; this.z = Math.max(this.z, 8); this.gs = 0; this.vx *= 1.3; this.vy *= 1.3; this.beam = { x: this.x, y: this.y, t: 0.9 }; }
    else if (type === 'rasen') { this.vz = 30; this.z = Math.max(this.z, 6); this.gs = 0.18; this.vx *= 1.05; this.vy *= 1.05; }
    this.wt = 0;
    if (this.vz > 0 && this.z <= 0) this.z = 0.01;
  } };
const game = { mode:'title', t:0, time:MATCH, score:[0,0], goalT:0, weather:'rain', wind:{x:0,y:0}, windT:0, lightT:6,
  len:MATCH, chasers:[[], []], shake:0, flash:0, bolt:null, banner:null, announce:null, ctrlCd:0, kickoffTeam:0, hitstop:0, fury:[0,0], furyFlash:[0,0], switchFlash:0, wantSwitch:false, paused:false, emoCd:0, tauntT:8, wxChanged:false };
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
const goalX = team => team === 0 ? LEN : 0;
const ownX = team => team === 0 ? 0 : LEN;

function surfaceAt(x, y) { let s = null;
  for (const pt of patches) for (const e of pt.blobs) if (((x-e.x)/e.rx)**2 + ((y-e.y)/e.ry)**2 < 1) { if (pt.type === 'puddle') return 'puddle'; s = 'mud'; }
  return s; }

// lift > 0 throws the player into the air (cartwheel until they land)
function knockDown(p, dx, dy, force, expr, lift) {
  if (p.state === ST.FALL || p.state === ST.STUN) return;
  if (p.buff === 'horn') { shield(p); return; }
  if (ball.owner === p) { ball.owner = null; ball.lock = p; ball.lockT = 0.5; ball.vx = dx*80; ball.vy = dy*80; ball.vz = 70; ball.z = 0.01; }
  const n = norm(dx, dy); p.vx = n.x*force; p.vy = n.y*force; p.charge = 0; p.fallExpr = expr || 'cry';
  setState(p, ST.FALL); fury(p.team, 12);
  if (lift) { p.vx *= 0.6; p.vy *= 0.6; p.vz = lift; p.z = Math.max(p.z, 0.01); if (lift >= 150) sfx('boing'); }
  if (p.team === 0) emote(nearestRival(p), Math.random() < 0.5 ? 'laugh' : 'finger'); else p.grudge = true;
}
function keeperSave(p) {
  const b = ball, K = keeperSkill(p), spd = hyp(b.vx, b.vy);
  p.saved = true;
  if (b.superType) return;   // super shots blow the keeper away instead (see the knock loop in updBall)
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
const gravK = () => chaosIs('moon') ? 0.32 : 1;
const giant = () => chaosIs('giant');

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
  if (!chaosOn) return;
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
  for (const p of players) { p.dingCd -= dt; if (p.buff && (p.buffT -= dt) <= 0) p.buff = null; }
}
// cosmetic only (runs on the guest too): exhaust, falling rocks, chili flames, espresso steam
function chaosFx(dt) {
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
  if (p.local && NET.role === 'solo') { setHuman(m); game.ctrlCd = 0.6; }
}

function updPlayer(p, dt) {
  p.st += dt;
  const surf = surfaceAt(p.x, p.y);
  p.sm = surf === 'mud' ? 0.58 : surf === 'puddle' ? 0.85 : 1;
  p.tr = surf === 'puddle' ? 0.16 : surf === 'mud' ? 0.8 : 1;
  if (chaosIs('ice')) p.tr = Math.min(p.tr, 0.13);
  const turbo = (chaosIs('espresso') ? 1.5 : 1)*(p.buff === 'pepper' ? 1.4 : 1);
  const i = p.inp;
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
      const sp = MAXSP * p.sm * turbo * spr * (p.human ? 1 : aiSp) * (ball.owner === p ? 0.9 : 1);
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
    if (!b.superType) { b.vx += game.wind.x*dt; b.vy += game.wind.y*dt; }
    if (b.z <= 0) land();
  } else {
    const s = hyp(b.vx, b.vy);
    if (s > 0) { const ns = Math.max(0, s - 125*b.drag*dt); b.vx *= ns/s; b.vy *= ns/s; }
    b.vx += game.wind.x*0.2*dt; b.vy += game.wind.y*0.2*dt;
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
    if (b.x < 0) { if (mouth && b.z < GH) scored(1); else endBounce(0, 1); }
    else if (b.x > LEN) { if (mouth && b.z < GH) scored(0); else { endBounce(LEN, -1); if (b.last && b.last.team === 0 && Math.random() < 0.6) emote(nearestRival(b), Math.random() < 0.5 ? 'laugh' : 'zzz'); } }
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
  if (b.vz < -90) { b.vz = -b.vz*0.45; b.vx *= 0.85; b.vy *= 0.85; sfx('bounce'); } else b.vz = 0;
}
function possession(dt) {
  const b = ball;
  if (b.owner) fury(b.owner.team, dt*4);
  if (!b.owner && !b.superType && b.z < 34) {
    let best = null, bd = 99;
    // your own shot flies past your teammates: for a second after the kick, and after that while it's still quick
    const shot = b.shot && b.last && (b.shotT < 1 || hyp(b.vx, b.vy) > 100);
    for (const p of players) { if (p.state > ST.RUN || (b.lock === p && b.lockT > 0)) continue;
      if (shot && p.team === b.last.team) continue;
      const gk = p.role === 'gk', meant = b.passTo === p;   // the player a pass is meant for reaches a bit further and higher
      const reach = gk ? 15 : REACH*(giant() ? 1.9 : 1)*(meant ? 1.6 : 1);
      if (b.z >= (gk ? 34 : giant() ? 22 : meant ? 16 : 10)) continue;   // keepers use their hands
      const d = dist(p, b); if (d < reach && d < bd) { bd = d; best = p; } }
    if (best && best.role === 'gk' && hyp(b.vx, b.vy) > 230 && b.last && b.last.team !== best.team) keeperSave(best);
    else if (best) { if (b.last && b.last !== best && b.last.team === best.team) fury(best.team, 10); // pass received
      b.owner = best; best.holdT = 0; b.passTo = null; b.passAt = null; }
  } else if (b.owner) {
    for (const p of players) {
      if (p.team === b.owner.team || p.state > ST.RUN || b.owner.buff === 'horn' || b.owner.role === 'gk') continue;
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
  const dir = p.team === 0 ? 1 : -1; let best = null, bs = -0.5;
  for (const m of players) { if (m.team !== p.team || m === p || m.role === 'gk') continue;
    const d = dist(p, m); if (d < 40 || d > 340) continue;
    const press = players.some(q => q.team !== p.team && dist(q, m) < 30) ? 2 : 0;
    const sc = dir*(m.x - p.x)/100 - press - d/400 + (m.human ? 0.8 : 0) - (laneBlocked(p, m.x, m.y) ? 0.6 : 0); if (sc > bs) { bs = sc; best = m; } }
  return best;
}
function aiKeeper(p, dt) {
  const i = p.inp, b = ball, own = ownX(p.team), dir = own === 0 ? 1 : -1, K = keeperSkill(p);
  i.kickHeld = false; i.mx = i.my = 0;
  if (p.state > ST.RUN) return;
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
  const gx = goalX(p.team), gy = WID/2, dir = p.team === 0 ? 1 : -1;
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
  const sw = keys.has('l') || keys.has('c') || touchSwitch;
  if (sw && !prevSwitch && !(ball.owner && ball.owner.team === 0)) game.wantSwitch = true;
  prevSwitch = sw;
}
let touchSwitch = false, prevSwitch = false, touchSprint = false;
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
  if (ball.owner && ball.owner.team === 1) bonus = (other.x < ball.owner.x ? -0.15 : 0.2) - (cur.x < ball.owner.x ? -0.15 : 0.2);
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
// the pad follows the game: KICK shows the charge and turns into SUPER with full FURIA, the second button
// says what it will do (PASS with the ball, TACKLE without, ORA! when a super tackle is possible),
// SWITCH only shows when it can do something
const PAD = { root: document.getElementById('pad'), A: document.getElementById('bA'), B: document.getElementById('bB'), S: document.getElementById('bS'),
  R: document.getElementById('bR'), ringR: document.querySelector('#bR .chg circle'),
  lbA: document.getElementById('lbA'), lbB: document.getElementById('lbB'), ring: document.querySelector('#bA .chg circle'), key: '' };
function updPad() {
  if (!TOUCH) return;
  const p = players.find(q => q.local); if (!p || game.mode === 'title') return;
  const holder = NET.role === 'guest' ? players.find(q => dist(q, ball) < 14 && ball.z < 6) : ball.owner;
  const has = holder === p, fr = furyReady(p) && p.role !== 'gk';
  const b = has ? 'pass' : fr && holder && holder.team !== p.team && dist(p, holder) < 70 ? 'ora' : 'tackle';
  const sw = !has && NET.role === 'solo' && players.filter(q => q.team === p.team && q.role !== 'gk').length > 1;
  const ch = Math.round(Math.min(1, p.charge/CHARGE)*20);
  const st = Math.round(p.stam*20);
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
  const G1c = hex('#46cf40'), G1d = hex('#3cbc38'), G2a = hex('#30a82e'), G2b = hex('#44c83e'), TRK = hex('#bcbcc4'), TRK2 = hex('#a4a4b0');
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

  // stands: crowd rows
  const crowdBottom = OY - 14*SY - 26;
  for (let row = 0; row < 5; row++) {
    const yy = 2 + row*6;
    if (yy + 6 > crowdBottom) break;
    for (let x = (row % 2) * 3; x < FWd; x += 6) {
      if (rr() < 0.07) continue;
      const f = rr(), shirt = f < 0.55 ? TEAMS[0].jersey : f < 0.75 ? '#ffffff' : f < 0.92 ? TEAMS[1].jersey : '#f2c230';
      const dim = 0.55 + row*0.1; g.globalAlpha = Math.min(1, dim);
      g.fillStyle = shirt; g.fillRect(x, yy + 4, 5, 3);
      g.fillStyle = '#ffb88a'; g.fillRect(x+1, yy+1, 3, 3);
      g.fillStyle = rr() < 0.7 ? '#1a1420' : '#a8381c'; g.fillRect(x+1, yy, 3, 1);
      if (rr() < 0.15) { g.fillStyle = '#ffb88a'; g.fillRect(x + (rr()<0.5?0:4), yy-1, 1, 2); }
    }
  }
  g.globalAlpha = 1;
  // ad boards
  const bTop = Math.round(crowdBottom), bH = 13;
  const boards = [['#1d4f8f','#ffffff','AZZURRI'], ['#d8344a','#ffffff','PIZZA'], ['#f4f1e6','#1d4f8f','SFOGLIA'], ['#1a1420','#f2c230','VESUVIO'], ['#4aa8f0','#ffffff','CAFFE'], ['#ffffff','#d8344a','GOL TV']];
  for (let i = 0, x = 0; x < FWd; i++, x += 74) {
    const [bg, fg, txt] = boards[i % boards.length];
    g.fillStyle = '#100810'; g.fillRect(x, bTop-1, 74, bH+2);
    g.fillStyle = bg; g.fillRect(x+1, bTop, 72, bH);
    ptext(g, txt, x + 37, bTop + 3, 8, fg, 'center');
  }
  g.fillStyle = '#d8d8e0'; g.fillRect(0, bTop + bH + 1, FWd, 3);

  // pitch lines
  const L = (x0, y0, x1, y1) => { const a = P(x0, y0), b = P(x1, y1); pline(g, a.x, a.y, b.x, b.y, '#ffffff', 2); };
  const arc = (cx, cy, rad, a0, a1) => { let prev = null;
    for (let k = 0; k <= 48; k++) { const a = a0 + (a1-a0)*k/48, p = P(cx + Math.cos(a)*rad, cy + Math.sin(a)*rad);
      if (prev) pline(g, prev.x, prev.y, p.x, p.y, '#ffffff', 2); prev = p; } };
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
  if (w === 'clear') { add('mud', 30, 16); add('mud', 22, 12); }
  else {
    add('mud', 34, 18); add('mud', 26, 14); add('puddle', 34, 18); add('puddle', 28, 15); add('puddle', 24, 13); add('puddle', 30, 16);
    if (w === 'storm') { add('puddle', 26, 14); add('mud', 24, 13); }
  }
  buildField(); newWind(); game.lightT = rnd(4, 8);
  rain = [];
  if (w !== 'clear') for (let i = 0; i < (w === 'storm' ? 120 : 80); i++) rain.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(200, 300) });
}
const WXNAME = { clear: 'СОЛНЦЕ!', rain: 'ДОЖДЬ!', storm: 'ГРОЗА!' };
function randomWeather(not) { const opts = ['clear', 'rain', 'rain', 'storm', 'storm'].filter(w => w !== not); return opts[Math.floor(Math.random()*opts.length)]; }
function newWind() {
  const a = Math.random()*Math.PI*2, m = game.weather === 'storm' ? rnd(45, 90) : game.weather === 'rain' ? rnd(8, 24) : 0;
  game.wind = { x: Math.cos(a)*m, y: Math.sin(a)*m*0.5 }; game.windT = rnd(7, 11);
}
function updWeather(dt) {
  if (NET.role === 'guest') { updRain(dt); return; }
  game.windT -= dt; if (game.windT <= 0 && game.weather === 'storm') newWind();
  if (weatherOn && game.mode === 'play' && !game.wxChanged && game.time < game.len/2) {
    game.wxChanged = true; const next = randomWeather(game.weather);
    if (next !== game.weather) { setWeather(next); game.announce = { text: WXNAME[next], col: '#8fe0ff', t: 1.6 }; }
  }
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
  for (const d of rain) { d.y += d.s*dt; d.x += (game.wind.x*1.2 - 40)*dt;
    if (d.y > H) { d.y = rnd(-20, 0); d.x = rnd(0, W+40); } if (d.x < -10) d.x += W+20; if (d.x > W+10) d.x -= W+20; }
}
function makeRain(w) { rain = []; if (w === 'rain' || w === 'storm') for (let i = 0; i < (w === 'storm' ? 120 : 80); i++) rain.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(200, 300) }); }

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
}
const r1 = v => Math.round(v*10)/10, r2 = v => Math.round(v*100)/100;
function buildSnap() {
  return { mid: NET.mid, md: NET.mode, gm: game.mode, t: r1(game.time), sc: game.score, fu: [Math.round(game.fury[0]), Math.round(game.fury[1])], gp: NET.guestPeer,
    P: players.map(p => [r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), p.state, r2(p.st), r2(p.fx), r2(p.fy), r2(p.charge),
      p.mood === 'cheer' ? 1 : p.mood === 'sad' ? 2 : 0, EXPR.indexOf(p.fallExpr), p.tag || 0,
      p.emote ? EMOS.indexOf(p.emote.type) : -1, p.emote ? r1(p.emote.t) : 0, p.emote ? r2(p.emote.age) : 0, p.kickSuper ? 1 : 0, p.bike ? 1 : 0, r1(p.z), ITEMS.indexOf(p.buff), Math.round(p.stam*20), p.tired ? 1 : 0, p.sprinting ? 1 : 0]),
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
  const sp = keys.has('shift') || keys.has('u') || touchSprint;
  const inp = { mx: s ? r2(s.x) : 0, my: s ? r2(s.y) : 0, k: k ? 1 : 0, kr: NET.kr, tc: NET.tc, sp: sp ? 1 : 0 };
  const key = JSON.stringify(inp); if (key !== NET.lastIn) { NET.lastIn = key; setPresence({ in: inp }); }
}
function applySnap(s) {
  if (s.mid !== NET.mid) {
    NET.mid = s.mid; NET.mode = s.md; MODE = s.md === 'vs' ? 1 : 2; setTeams('nap', 'rom'); setPitch(MODE); buildTeams(MODE); game.pv = -1; parts = [];
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
  s.P.forEach((a, i) => { const p = players[i]; if (!p) return;
    p.tx = a[0]; p.ty = a[1]; p.vx = a[2]; p.vy = a[3];
    p.state = a[4]; p.st = a[5]; p.fx = a[6]; p.fy = a[7]; p.charge = a[8];
    p.mood = a[9] === 1 ? 'cheer' : a[9] === 2 ? 'sad' : null; p.fallExpr = EXPR[a[10]] || 'cry'; p.tag = a[11];
    p.human = a[11] > 0; p.local = a[11] === 2; p.kickSuper = !!a[15]; p.bike = !!a[16]; p.tz = a[17] || 0; p.buff = ITEMS[a[18]] || null;
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
  if (game.mode === 'play' && prevMode === 'end') { showOv(null); startMusic(); }
}
function guestUpdate(dt) {
  game.shake = Math.max(0, game.shake - dt); game.flash = Math.max(0, game.flash - dt*2);
  if (!NET.room) return;
  const h = NET.room.peers().find(p => p.peer === NET.hostPeer), s = h && h.presence && h.presence.s;
  if (s && s !== NET.lastS && s.gp === NET.myPeer && Array.isArray(s.P)) { NET.lastS = s; applySnap(s); }
  updRain(dt); updParts(dt); chaosFx(dt);
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

// ================== match flow ==================
function kickoff11(team) {
  const place = (q, x, y) => { Object.assign(q, { x, y, vx:0, vy:0, z:0, vz:0, buff:null, charge:0, mood:null, fx:q.team?-1:1, fy:0 }); q.state = -1; setState(q, ST.IDLE); };
  for (const q of players) { const f = Math.min(q.home.x, 0.44); place(q, q.team === 0 ? f*LEN : (1 - f)*LEN, q.home.y*WID); }
  const o = players.find(q => q.team === team && q.role === 'att'), dir = team === 0 ? 1 : -1;
  place(o, LEN/2 - dir*10, WID/2);
  Object.assign(ball, { x: o.x + o.fx*9, y: o.y + 1, z:0, vx:0, vy:0, vz:0, superType:null, gs:1, owner:o, lock:null, lockT:0, beam:null });
  setHuman(team === 0 ? o : players.find(q => q.team === 0 && q.role === 'att'));
  game.switchFlash = 0; game.mode = 'play'; game.announce = { text:'KICK OFF!', col:'#ffffff', t:1.1 }; sfx('whistle'); startMusic();
}
function kickoff(team) {
  if (MODE === 11) return kickoff11(team);
  const c = WID/2, na = players.find(p => p.team === 0 && p.role === 'att'), nd = players.find(p => p.team === 0 && p.role === 'def'),
        ra = players.find(p => p.team === 1 && p.role === 'att'), rd = players.find(p => p.team === 1 && p.role === 'def');
  const place = (p, x, y) => { Object.assign(p, { x, y, vx:0, vy:0, z:0, vz:0, buff:null, charge:0, mood:null, fx:p.team?-1:1, fy:0 }); p.state = -1; setState(p, ST.IDLE); };
  place(na, team === 0 ? LEN/2-10 : LEN/2-60, team === 0 ? c : c-30);
  if (nd) place(nd, LEN*0.12, c);
  place(ra, team === 1 ? LEN/2+10 : LEN/2+60, team === 1 ? c : c+30);
  if (rd) place(rd, LEN*0.88, c);
  for (const q of players) if (q.role === 'gk') place(q, q.team === 0 ? 10 : LEN - 10, c);
  const o = team === 0 ? na : ra;
  Object.assign(ball, { x: o.x + o.fx*9, y: o.y + 1, z:0, vx:0, vy:0, vz:0, superType:null, gs:1, owner:o, lock:null, lockT:0, beam:null });
  assignControl(na, nd, ra); game.switchFlash = 0; game.mode = 'play'; game.announce = { text:'KICK OFF!', col:'#ffffff', t:1.1 }; sfx('whistle'); startMusic();
}
function scored(team) {
  const pts = chaosOn && game.time <= X2T ? 2 : 1;
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
const OVS = ['ovMenu', 'ovPause', 'ovEnd', 'ovBye', 'ovOnline', 'ovHelp', 'ovTeams'];
function showOv(id) {
  for (const o of OVS) $(o).hidden = o !== id;
  if (id === 'ovOnline') renderLobby();
  document.body.classList.toggle('in-menu', !!id);
  if (id) { const first = $(id).querySelector('.items:not([hidden]) .mi'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 30); }
}
// mode: 1 / 2 = arcade (Napoli vs Roma), 11 = reality with the clubs picked on the team screen
function startMatch(mode) {
  if (NET.role === 'guest') return;
  if (mode === 11) setTeams(CLUB_KEYS[pick[0]], CLUB_KEYS[pick[1]]); else setTeams('nap', 'rom');
  MODE = mode; setPitch(mode); buildTeams(mode); NET.mid = (NET.mid + 1) % 100000; NET.rK = NET.rT = -1;
  game.len = mode === 11 ? MATCH11 : MATCH;
  game.score = [0,0]; game.fury = [0, 0]; game.furyFlash = [0, 0]; game.time = game.len; parts = []; game.banner = null; game.bolt = null; game.paused = false;
  game.wxChanged = false; game.tauntT = rnd(5, 9); game.emoCd = 0;
  game.chaos = null; game.vespa = null; game.lastChaos = null; game.chaosT = rnd(12, 16); game.itemT = rnd(5, 8); game.x2 = false; items = []; pops = [];
  setWeather(weatherOn ? randomWeather(null) : 'off'); kickoff(0); showOv(null);
  const dl = derbyLine(); if (dl) game.banner = null, game.announce = { text: dl, col: '#ffd23a', t: 2.2 };
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
  game.mode = 'title'; game.paused = false; stopMusic(); MODE = 2; setTeams('nap', 'rom'); if (setPitch(2)) setWeather(game.weather || 'rain'); buildTeams(2);
  const c = WID/2;
  [[LEN/2-40, c-20], [LEN/2-90, c+30], [LEN/2+40, c+20], [LEN/2+90, c-30], [20, c], [LEN-20, c]].forEach(([x, y], i) => Object.assign(players[i], { x, y, fx: i % 4 < 2 && i !== 5 ? 1 : -1 }));
  Object.assign(ball, { x: LEN/2, y: c, z: 0, vx: 0, vy: 0, vz: 0, owner: null, superType: null });
  game.banner = null; game.announce = null; game.tauntT = 2; game.chaos = null; game.vespa = null; items = []; pops = [];
}
function menuPage(id) { for (const k of ['mMain', 'mPlay', 'mOpts']) $(k).hidden = k !== id; const f = $(id).querySelector('.mi'); if (f) f.focus({ preventScroll: true }); }
function toMenu() { netLeave(); attract(); showOv('ovMenu'); menuPage('mMain'); }
function setPaused(v) {
  if (game.mode !== 'play' && game.mode !== 'goal') return;
  game.paused = v && NET.role === 'solo';   // online the match keeps running for your friend
  keys.clear(); touchKick = touchTackle = touchSwitch = false; prevKick = prevTackle = false;
  syncSound(); showOv(v ? 'ovPause' : null);
}
function syncSound() { for (const id of ['miSound', 'miSnd']) { $(id).innerHTML = 'ЗВУК <b>' + (muted ? 'ВЫКЛ' : 'ВКЛ') + '</b>'; $(id).classList.toggle('off', muted); } }
// settings live in this browser only (localStorage may be unavailable: then defaults)
const store = { get(k, d) { try { const v = localStorage.getItem('azz-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('azz-' + k, JSON.stringify(v)); } catch (e) {} } };
diff = clamp(store.get('diff', 1) | 0, 0, DIFFS.length - 1); chaosOn = store.get('chaos', true) !== false; weatherOn = store.get('wx', true) !== false;
let pick = store.get('pick', [0, 2]);
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
    $('club' + side).textContent = c.name; $('star' + side).textContent = 'ЗВЕЗДА: ' + c.names[10];
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, 40, 40); g.drawImage(getSprite(c, 'cheer', 'shout', 0, 'side', { look: 0, num: 9 }), 0, 0);
  }
  const codes = pick.map(k => CLUBS[CLUB_KEYS[k]].code).sort().join('');
  $('derby').textContent = codes === 'RHOZIM' ? 'ДЕРБИ ОДНОЙ СТРАНЫ!' : codes === 'NAPROM' ? 'ДЕРБИ СОЛНЦА!' : codes.includes('PRK') ? 'МАТЧ ПОКАЖЕТ ЦТ КНДР' : '';
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
  $('miAgain').hidden = NET.role === 'guest';
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
    else { if (NET.role === 'solo') updControl(dt); humanInput(); remoteInput(); if (MODE === 11) computeChasers(); for (const p of players) if (!p.human) ai(p, dt); }
  } else if (game.mode === 'goal') {
    game.goalT -= dt; if (game.banner) game.banner.t += dt;
    if (game.goalT <= 0) { game.banner = null; kickoff(game.kickoffTeam); }
  }
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
    updChaos(dt);
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
  if (z > 2 && p.state === ST.FALL) {   // cartwheel through the air in 90-degree steps, NES style
    const up = getSprite(p.team, 'idle', 'bulge', 0, 'side', lookOf(p));
    ctx.save(); ctx.translate(x, y - 20); ctx.rotate((Math.floor(p.st*14) % 4)*Math.PI/2); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(up, -20, -20); ctx.restore(); return;
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
  if (giant()) { const d = Math.round(12*BIGK); ctx.drawImage(BALLSPR[Math.floor(b.rot/16) % 2], x - (d >> 1), y - d, d, d); return; }
  ctx.drawImage(BALLSPR[Math.floor(b.rot/8) % 2], x-6, y-12);
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
  const f0 = getSprite(0,'idle','grit',0,'side',{ look: 0 }), f1 = getSprite(1,'idle','grit',0,'side',{ look: 0 });
  ctx.fillStyle = TEAMS[0].hudBg; ctx.fillRect(x+2, HUD.y+2, 19, HUD.h-4);
  ctx.drawImage(f0, 11, 1, 19, 17, x+2, HUD.y+2, 19, 17);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x+21, HUD.y+2, 1, HUD.h-4); ctx.fillRect(x+sw-22, HUD.y+2, 1, HUD.h-4);
  ctx.fillStyle = TEAMS[1].hudBg; ctx.fillRect(x+sw-21, HUD.y+2, 19, HUD.h-4);
  ctx.save(); ctx.translate(x+sw-2, 0); ctx.scale(-1, 1); ctx.drawImage(f1, 11, 1, 19, 17, 0, HUD.y+2, 19, 17); ctx.restore();
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
  if (chaosIs('ice')) { ctx.fillStyle = 'rgba(220,248,255,.34)'; ctx.fillRect(0, 0, W, H); }
  for (const p of players) { const s = S(p.x, p.y), k = clamp(1 - (p.z || 0)/120, 0.4, 1); pellipse(s.x, s.y, Math.round(9*k), 2, 'rgba(0,30,0,.35)'); }
  for (const it of items) { const s = S(it.x, it.y); pellipse(s.x, s.y, 5, 1, 'rgba(0,30,0,.35)'); }
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
  if (rain.length) { ctx.fillStyle = 'rgba(190,225,255,.6)'; const dx = (game.wind.x*1.2 - 40)/250;
    for (const d of rain) for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(d.x + dx*k), Math.round(d.y + k), 1, 1); }
  drawBeam();
  drawBolt();
  drawOffscreen();
  cam.x = cx; cam.y = cy;
  if (game.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(REDUCED ? 0.3 : 0.85, game.flash)})`; ctx.fillRect(0, 0, W, H); }
  if (game.mode !== 'title') { drawHUD(); drawChaosBar(); }
  if (NET.role === 'guest' && game.mode === 'play' && performance.now() - NET.snapAt > 600 && Math.floor(game.t*4) % 2)
    ptext(ctx, 'СВЯЗЬ…', W/2, H - 34, 8, '#ff9a5a', 'center', '#100810');   // waiting for the host
  if (game.banner) { const t = game.banner.t, sc = t < 0.25 ? 8 + 16*(t/0.25) : 24, y = 78 + Math.sin(t*6)*3;
    const cyc = ['#ffffff', game.banner.col, '#f2c230', game.banner.col][Math.floor(t*12) % 4];
    ptext(ctx, game.banner.text, W/2, y, Math.round(sc), cyc, 'center', '#100810'); }
  if (game.announce) { const a = game.announce, k = clamp((1.3 - a.t)*6, 0, 1), fits = a.text.length*16 <= W - 12;
    ptext(ctx, a.text, W/2, 42, fits ? Math.round(8 + 8*k) : 8, a.col, 'center', '#100810'); }
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
click('miAgain', () => startMatch(MODE));
click('miOnline', () => { NET.ui = 'idle'; NET.msg = ''; showOv('ovOnline'); });
click('miHelp', () => showOv('ovHelp'));
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
document.addEventListener('visibilitychange', () => { if (document.hidden) { if ((game.mode === 'play' || game.mode === 'goal') && NET.role === 'solo') setPaused(true); keys.clear(); touchStick = null; touchKick = touchTackle = touchSwitch = false; } });
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
