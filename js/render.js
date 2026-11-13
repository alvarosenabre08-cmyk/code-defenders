// ============================================================
//  Leones TD — dibujo en Canvas 2D, estilo dibujo animado
//  Todo se pinta por código (sin imágenes): los leones y barriles se
//  dibujan una vez en un lienzo oculto ("sprite") y luego se reutilizan.
// ============================================================
import { W, H, CELL, COLS, ROWS, MAPS, TOWERS, ENEMIES, ENEMY_KEYS, pathPos, stats, skin } from './data.js';
import { tStats, tRange, soldierD, epos } from './sim.js';

const TAU = Math.PI * 2;
const INK = '#3a2413';
const FONT = '"Trebuchet MS", "Arial Rounded MT Bold", "Segoe UI", Verdana, sans-serif';
const FUR = '#f4b548', FUR_D = '#dc9430', MUZZLE = '#ffe6b0', MANE = '#a9541c';
const bgs = {};
const cache = new Map();
const fxs = [];

// ---------- utilidades ----------
function ink(c, fill, lw = 2) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
function txt(c, str, x, y, fill, size, align = 'center') {
  c.font = `900 ${size}px ${FONT}`; c.textAlign = align; c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size / 4); c.strokeStyle = INK; c.strokeText(str, x, y);
  c.fillStyle = fill; c.fillText(str, x, y);
}
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function star(c, x, y, r1, r2, n, rot = 0) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r2 : r1; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath();
}
function line(c, x0, y0, x1, y1, color, w) {
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
  c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = w + 2.4; c.stroke(); c.strokeStyle = color; c.lineWidth = w; c.stroke();
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Devuelve (creándolo la primera vez) un lienzo oculto de `size` px lógicos dibujado con fn. */
function sprite(key, size, fn) {
  let s = cache.get(key);
  if (!s) {
    s = document.createElement('canvas'); s.width = s.height = size * 2;
    const c = s.getContext('2d');
    c.scale(2, 2); c.translate(size / 2, size / 2); c.lineJoin = 'round'; c.lineCap = 'round';
    fn(c);
    cache.set(key, s);
  }
  return s;
}
function routeLine(c, R) { c.beginPath(); R.pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p.x, p.y)); }

// ============================================================
//  FONDOS (uno por mapa, se dibujan una sola vez)
// ============================================================
const SKINS = {
  sabana: { ground: '#c4d063', blobs: ['#b4c354', '#d4dc7c', '#aab94b'], tuft: '#8a9e38', edge: '#8a5a2b', dirt: '#e6b871', dirt2: '#d3a25a', heat: 'BRASAS' },
  selva: { ground: '#58aa4b', blobs: ['#4b9b41', '#69ba5a', '#408d39'], tuft: '#2c7429', edge: '#5d3b1c', dirt: '#c69150', dirt2: '#ad793d', heat: 'BRASAS' },
  volcan: { ground: '#5e4c52', blobs: ['#503f46', '#6d5a60', '#473941'], tuft: '#3a2d33', edge: '#261b20', dirt: '#a2969e', dirt2: '#8a7e88', heat: 'LAVA' },
};

function buildBg(mi) {
  const M = MAPS[mi], sk = SKINS[M.skin], R = rng(1234 + mi * 77);
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const c = bg.getContext('2d');
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = sk.ground; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 110; i++) {
    c.globalAlpha = 0.5; c.fillStyle = sk.blobs[i % 3];
    c.beginPath(); c.ellipse(R() * W, R() * H, 25 + R() * 70, 14 + R() * 40, R() * 3, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
  if (M.skin === 'volcan') {
    // grietas de lava y piedras
    for (let i = 0; i < 22; i++) {
      let x = R() * W, y = R() * H;
      const an = R() * TAU;
      c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 5; j++) { const a2 = an + (R() - 0.5) * 1.1; x += Math.cos(a2) * 16; y += Math.sin(a2) * 16; c.lineTo(x, y); }
      c.strokeStyle = '#2f2227'; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#d9621f'; c.lineWidth = 1.8; c.globalAlpha = 0.8; c.stroke(); c.globalAlpha = 1;
    }
    for (let i = 0; i < 60; i++) { c.beginPath(); c.ellipse(R() * W, R() * H, 3 + R() * 5, 2 + R() * 4, R() * 3, 0, TAU); c.fillStyle = i % 2 ? '#3d3036' : '#75636a'; c.fill(); }
  } else {
    // matas de hierba y flores
    for (let i = 0; i < 230; i++) {
      const x = R() * W, y = R() * H, h = 4 + R() * 5;
      c.strokeStyle = sk.tuft; c.lineWidth = 1.6; c.beginPath();
      c.moveTo(x - 3, y); c.lineTo(x - 5, y - h); c.moveTo(x, y); c.lineTo(x, y - h - 2); c.moveTo(x + 3, y); c.lineTo(x + 5, y - h); c.stroke();
    }
    const fl = M.skin === 'selva' ? ['#ff6fa8', '#ffe14a', '#ffffff', '#ff9d4a'] : ['#fff2a8', '#ffffff', '#ffd447'];
    for (let i = 0; i < (M.skin === 'selva' ? 70 : 40); i++) {
      const x = R() * W, y = R() * H; c.fillStyle = fl[i % fl.length];
      for (let j = 0; j < 5; j++) { c.beginPath(); c.arc(x + Math.cos(j * 1.256) * 2.6, y + Math.sin(j * 1.256) * 2.6, 1.7, 0, TAU); c.fill(); }
      c.fillStyle = '#e8902e'; c.beginPath(); c.arc(x, y, 1.4, 0, TAU); c.fill();
    }
    if (M.skin === 'selva') for (let i = 0; i < 60; i++) {
      const x = R() * W, y = R() * H, a = R() * TAU;
      c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.ellipse(0, 0, 9, 4, 0, 0, TAU); c.fillStyle = i % 2 ? '#3c8a35' : '#74c463'; c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); c.restore();
    }
  }
  // camino de tierra
  for (const Rt of M.R) { routeLine(c, Rt); c.strokeStyle = INK; c.lineWidth = 43; c.stroke(); }
  for (const Rt of M.R) { routeLine(c, Rt); c.strokeStyle = sk.edge; c.lineWidth = 39; c.stroke(); }
  for (const Rt of M.R) { routeLine(c, Rt); c.strokeStyle = sk.dirt; c.lineWidth = 32; c.stroke(); }
  c.globalAlpha = 0.45;
  for (const Rt of M.R) { routeLine(c, Rt); c.strokeStyle = sk.dirt2; c.lineWidth = 18; c.stroke(); }
  c.globalAlpha = 1;
  M.R.forEach((Rt, r) => {
    for (let d = 6; d < Rt.len; d += 11) {
      const p = pathPos(M, r, d), ox = (R() - 0.5) * 24, oy = (R() - 0.5) * 24;
      c.beginPath(); c.ellipse(p.x + ox, p.y + oy, 1.5 + R() * 2.5, 1 + R() * 1.8, R() * 3, 0, TAU);
      c.fillStyle = R() > 0.5 ? sk.edge : '#fff3d0'; c.globalAlpha = 0.35; c.fill();
    }
  });
  c.globalAlpha = 1;
  // carteles de entrada
  for (const en of M.entries) {
    const p = M.R[en.r].pts[0];
    if (p.x < 0) txt(c, 'ENTRADA ▶', 8, p.y - 28, '#fff5d6', 12, 'left');
    else if (p.x > W) txt(c, '◀ ENTRADA', W - 8, p.y - 28, '#fff5d6', 12, 'right');
    else txt(c, '▼ ENTRADA', p.x + 28, 18, '#fff5d6', 12, 'left');
  }
  return bg;
}

// ============================================================
//  LEONES (torres)
// ============================================================
/** Cuerpo visto desde arriba, mirando a la derecha: cola, tronco y chaleco. */
function lionBody(c, o) {
  c.beginPath(); c.moveTo(-18, 0); c.quadraticCurveTo(-31, 8, -28, -7);
  c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = FUR; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.arc(-28, -8, 4, 0, TAU); ink(c, o.mane || MANE, 1.6);
  c.beginPath(); c.ellipse(-9, 0, 11.5, 9.5, 0, 0, TAU); ink(c, FUR, 2.2);
  if (o.tier >= 2) {
    c.save(); c.beginPath(); c.ellipse(-9, 0, 11.5, 9.5, 0, 0, TAU); c.clip();
    c.fillStyle = o.acc; c.fillRect(-18.5, -10, 8, 20);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-18.5, -10, 8, 4);
    c.restore();
    c.beginPath(); c.ellipse(-9, 0, 11.5, 9.5, 0, 0, TAU); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke();
  }
}
/** Patas delanteras (y hombreras a partir de Tier 4). */
function paws(c, o, fx = 9, fy = 9.5) {
  for (const s of [-1, 1]) {
    c.beginPath(); c.ellipse(fx, s * fy, 5, 3.6, s * 0.45, 0, TAU); ink(c, FUR, 2);
    if (o.tier >= 4) { c.beginPath(); c.arc(-9, s * 9.5, 4.6, 0, TAU); ink(c, o.acc, 1.8); c.beginPath(); c.arc(-10, s * 10.3, 1.4, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill(); }
  }
}
/** Cabeza con melena. Cinta en Tier 3+, corona en Tier 5. */
function lionHead(c, o) {
  const mane = o.mane || MANE;
  for (const pass of [0, 1]) {
    c.beginPath();
    for (let i = 0; i < 11; i++) { const a = ((i + 0.5) / 11) * TAU, r = pass ? 4.9 : 6.6; c.moveTo(Math.cos(a) * 7.8 + r, Math.sin(a) * 7.8); c.arc(Math.cos(a) * 7.8, Math.sin(a) * 7.8, r, 0, TAU); }
    c.fillStyle = pass ? mane : INK; c.fill();
  }
  c.beginPath(); c.arc(0, 0, 9.5, 0, TAU); c.fillStyle = mane; c.fill();
  for (const s of [-1, 1]) {
    c.beginPath(); c.arc(-3.5, s * 7.8, 3.3, 0, TAU); ink(c, FUR, 1.6);
    c.beginPath(); c.arc(-3.5, s * 7.8, 1.5, 0, TAU); c.fillStyle = '#e88a7a'; c.fill();
  }
  c.beginPath(); c.arc(1.5, 0, 8.4, 0, TAU); ink(c, FUR, 2);
  if (o.tier >= 3) {
    c.save(); c.beginPath(); c.arc(1.5, 0, 8.4, 0, TAU); c.clip();
    c.fillStyle = o.acc; c.fillRect(-4, -10, 3.8, 20); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-4, -10, 1, 20);
    c.restore(); c.beginPath(); c.arc(1.5, 0, 8.4, 0, TAU); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  }
  c.beginPath(); c.ellipse(6.4, 0, 4.2, 5, 0, 0, TAU); c.fillStyle = MUZZLE; c.fill();
  c.beginPath(); c.ellipse(9.4, 0, 2.1, 2.8, 0, 0, TAU); c.fillStyle = '#5a2d1a'; c.fill();
  for (const s of [-1, 1]) {
    c.beginPath(); c.ellipse(3.4, s * 4.1, 1.9, 2.3, 0, 0, TAU); c.fillStyle = '#2a1608'; c.fill();
    c.beginPath(); c.arc(4, s * 4.1 - 0.7, 0.7, 0, TAU); c.fillStyle = '#fff'; c.fill();
  }
  if (o.tier >= 5) {
    star(c, -3, 0, 6.5, 3.6, 5, Math.PI); ink(c, '#ffd23f', 1.6);
    c.beginPath(); c.arc(-3, 0, 1.8, 0, TAU); c.fillStyle = '#e8344a'; c.fill();
  }
}
function arrow(c, x0, x1, y, fire) {
  line(c, x0, y, x1, y, '#c99a5a', 1.6);
  c.beginPath(); c.moveTo(x1 + 5, y); c.lineTo(x1 - 1, y - 3); c.lineTo(x1 - 1, y + 3); c.closePath(); ink(c, fire ? '#ff8a2a' : '#dfe6ec', 1.2);
  if (fire) { c.beginPath(); c.arc(x1 + 2, y, 2.2, 0, TAU); c.fillStyle = '#ffe14a'; c.fill(); }
}

const DRAW = {
  // León Arquero: arco (ballesta en la rama 1, flechas de fuego en la rama 3)
  firewall(c, o) {
    c.translate(-4, 0);
    lionBody(c, o);
    rr(c, -20, -12, 10, 5.5, 2); ink(c, '#8a4f1f', 1.6);
    c.fillStyle = '#e8344a'; c.fillRect(-22, -11.4, 2.6, 1.8); c.fillRect(-22, -9, 2.6, 1.8);
    const fire = o.p[2] >= 2, multi = o.p[1] >= 3 || o.p[2] >= 3;
    if (o.p[0] >= 3) {
      const k = o.p[0] >= 4 ? 1.15 : 1;
      c.save(); c.scale(k, k);
      rr(c, 8, -3.2, 21, 6.4, 2); ink(c, '#8a4f1f', 1.8);
      c.beginPath(); c.moveTo(24, -15); c.quadraticCurveTo(33, 0, 24, 15); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = o.p[0] >= 4 ? '#c9d1d9' : '#b9742f'; c.lineWidth = 3.2; c.stroke();
      c.strokeStyle = '#fff5e0'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(24, -15); c.lineTo(13, 0); c.lineTo(24, 15); c.stroke();
      arrow(c, 13, 31, 0, false);
      c.restore();
    } else {
      c.beginPath(); c.moveTo(16, -15); c.quadraticCurveTo(28, 0, 16, 15); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = '#b9742f'; c.lineWidth = 3.2; c.stroke();
      c.strokeStyle = '#fff5e0'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(16, -15); c.lineTo(12, 0); c.lineTo(16, 15); c.stroke();
      if (multi) { c.save(); c.rotate(-0.26); arrow(c, 12, 26, 0, fire); c.rotate(0.52); arrow(c, 12, 26, 0, fire); c.restore(); }
      arrow(c, 11, 28, 0, fire);
    }
    paws(c, o, 10, 8.5);
    lionHead(c, o);
  },
  // León Cañonero: cañón de agua delante
  gc(c, o) {
    for (const s of [-1, 1]) { c.beginPath(); c.arc(12, s * 12.5, 5.5, 0, TAU); ink(c, '#8a4f1f', 2); c.beginPath(); c.arc(12, s * 12.5, 1.8, 0, TAU); c.fillStyle = INK; c.fill(); }
    c.save(); c.translate(-11, 0); lionBody(c, o); c.restore();
    const tri = o.p[2] >= 3, hh = o.p[0] >= 3 ? 9 : 6.8;
    if (tri) for (const y of [-8.5, 0, 8.5]) { rr(c, 2, y - 3.2, 27, 6.4, 3); ink(c, '#5b636e', 1.8); rr(c, 26, y - 4, 4, 8, 1.5); ink(c, '#3e444c', 1.6); }
    else {
      rr(c, 1, -hh, 28, hh * 2, 5); ink(c, '#5b636e', 2.2);
      c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(5, -hh + 2, 21, 2.4);
      rr(c, 27, -hh - 1.2, 4.5, hh * 2 + 2.4, 2); ink(c, '#3e444c', 1.8);
      for (const x of [11, 20]) { c.fillStyle = o.tier >= 2 ? o.acc : '#3fa9f5'; c.fillRect(x, -hh, 3, hh * 2); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(x, -hh, 3, hh * 2); }
    }
    c.save(); c.translate(-11, 0); paws(c, o, 10, 8.5); lionHead(c, o); c.restore();
  },
  // León Cazador: jabalina larga y pluma
  debugger(c, o) {
    c.translate(-4, 0);
    lionBody(c, o);
    const big = o.p[0] >= 3;
    for (const s of o.p[2] >= 3 ? [1, -1] : [1]) {
      line(c, -19, s * 12, 26, s * 12, '#b97a3a', 2.2);
      c.beginPath(); c.moveTo(big ? 39 : 36, s * 12); c.lineTo(25, s * 12 - (big ? 5.5 : 4)); c.lineTo(25, s * 12 + (big ? 5.5 : 4)); c.closePath(); ink(c, big ? '#ff8a6a' : '#e6ecf2', 1.6);
      c.fillStyle = '#e8344a'; c.fillRect(-21, s * 12 - 2.8, 4.5, 2); c.fillRect(-21, s * 12 + 0.8, 4.5, 2);
    }
    paws(c, o, 9, 10.5);
    lionHead(c, o);
    c.save(); c.translate(-7, -8); c.rotate(-0.9);
    c.beginPath(); c.ellipse(0, 0, 7, 2.6, 0, 0, TAU); ink(c, o.tier >= 2 ? o.acc : '#5ad67a', 1.4);
    c.restore();
  },
  // León Chamán: bastón con cristal y tocado de plumas
  balancer(c, o) {
    c.translate(-4, 0);
    lionBody(c, o);
    for (const s of o.p[2] >= 3 ? [1, -1] : [1]) {
      line(c, 4, s * 11.5, 23, s * 11.5, '#8a4f1f', 2.4);
      const R0 = o.p[0] >= 3 ? 7 : 5.5;
      c.beginPath(); c.arc(26, s * 11.5, R0, 0, TAU); ink(c, o.p[0] >= 3 ? '#ffe14a' : '#5ae0f0', 1.8);
      c.beginPath(); c.arc(24.4, s * 11.5 - 1.8, R0 * 0.34, 0, TAU); c.fillStyle = '#fff'; c.fill();
    }
    paws(c, o, 9, 10.5);
    for (let i = -2; i <= 2; i++) {
      c.save(); c.rotate(Math.PI + i * 0.42); c.beginPath(); c.ellipse(14, 0, 6.5, 2.6, 0, 0, TAU);
      ink(c, i % 2 ? '#ffffff' : (o.tier >= 2 ? o.acc : '#35c8d8'), 1.4); c.restore();
    }
    lionHead(c, o);
  },
  // León Tamborilero: tambor grande delante
  linter(c, o) {
    c.translate(-7, 0);
    lionBody(c, o);
    c.beginPath(); c.arc(21, 0, 11.5, 0, TAU); ink(c, o.tier >= 2 ? o.acc : '#d6453a', 2.2);
    c.strokeStyle = '#fff5d6'; c.lineWidth = 1.2; c.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, b = ((i + 0.5) / 10) * TAU; c.moveTo(21 + Math.cos(a) * 8.4, Math.sin(a) * 8.4); c.lineTo(21 + Math.cos(b) * 11, Math.sin(b) * 11); }
    c.stroke();
    c.beginPath(); c.arc(21, 0, 8, 0, TAU); ink(c, '#f9ecc8', 1.6);
    line(c, 10, -8.5, 19, -3.5, '#c99a5a', 1.6); line(c, 10, 8.5, 19, 3.5, '#c99a5a', 1.6);
    for (const s of [-1, 1]) { c.beginPath(); c.arc(19.5, s * 3.5, 2.1, 0, TAU); ink(c, '#fff', 1); }
    paws(c, o, 9, 9);
    lionHead(c, o);
  },
  // León Alquimista: caldero de brea y sombrero morado
  docker(c, o) {
    c.translate(-8, 0);
    lionBody(c, o);
    c.beginPath(); c.arc(23, 0, 12.5, 0, TAU); ink(c, '#40454e', 2.4);
    c.beginPath(); c.arc(23, 0, 9.2, 0, TAU); ink(c, o.tier >= 2 ? o.acc : '#9a6ae6', 1.6);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    for (const [x, y, r] of [[20, -3, 2.6], [26, 2, 1.9], [22, 4.5, 1.4], [27, -4, 1.2]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    paws(c, o, 10, 9.5);
    lionHead(c, o);
    c.beginPath(); c.arc(1.5, 0, 8.6, Math.PI * 0.5, Math.PI * 1.5); c.closePath(); ink(c, '#7a4ad0', 1.8);
    star(c, -3, 0, 3, 1.3, 5, 0); c.fillStyle = '#ffe14a'; c.fill();
  },
  // León Mercader: puesto con toldo de rayas
  backup(c, o) {
    rr(c, -18, -6, 36, 24, 4); ink(c, '#caa56c', 2.2);
    rr(c, -16, 6, 32, 10, 3); ink(c, '#a8692f', 2);
    const coins = Math.min(5, 2 + o.tier);
    for (let i = 0; i < coins; i++) { c.beginPath(); c.arc(-12 + i * (24 / Math.max(1, coins - 1)), 10 + (i % 2), 3.2, 0, TAU); ink(c, '#ffd23f', 1.4); c.beginPath(); c.arc(-12.8 + i * (24 / Math.max(1, coins - 1)), 9.2 + (i % 2), 1, 0, TAU); c.fillStyle = '#fff6c2'; c.fill(); }
    c.save(); c.translate(0, -1); c.rotate(Math.PI / 2); c.scale(0.6, 0.6); lionHead(c, o); c.restore();
    c.save(); rr(c, -20, -20, 40, 15, 4); c.clip();
    for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#fff5e0' : (o.tier >= 2 ? o.acc : '#e8443a'); c.fillRect(-20 + i * 5.72, -20, 5.72, 15); }
    c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(-20, -9, 40, 4);
    c.restore(); rr(c, -20, -20, 40, 15, 4); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke();
    if (o.tier >= 3) { rr(c, 8, -4, 9, 7, 2); ink(c, '#8a4f1f', 1.6); c.fillStyle = '#ffd23f'; c.fillRect(11, -2, 3, 3); }
    if (o.tier >= 5) { star(c, 0, -13, 5.5, 2.8, 5, -Math.PI / 2); ink(c, '#ffd23f', 1.4); }
  },
  // Cuartel de Leonas: choza de paja con estandarte
  thread(c, o) {
    if (o.p[0] >= 3) { for (let i = 0; i < 12; i++) { c.save(); c.rotate((i / 12) * TAU); c.beginPath(); c.moveTo(16, -3.5); c.lineTo(23, 0); c.lineTo(16, 3.5); c.closePath(); ink(c, '#b9c2cc', 1.4); c.restore(); } }
    c.beginPath(); c.arc(0, 0, 17.5, 0, TAU); ink(c, '#e3bd62', 2.4);
    c.strokeStyle = '#b98a36'; c.lineWidth = 1.3; c.beginPath();
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; c.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); c.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); }
    c.stroke();
    c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.strokeStyle = '#c99a44'; c.lineWidth = 1.4; c.stroke();
    c.beginPath(); c.arc(0, 0, 4.6, 0, TAU); ink(c, o.tier >= 2 ? o.acc : '#b98a36', 1.8);
    c.beginPath(); c.ellipse(0, 14.5, 6, 5, 0, Math.PI, 0); c.closePath(); ink(c, '#3a2413', 1.6);
    if (o.p[2] >= 2) { line(c, -12, -12, 6, 6, '#b97a3a', 1.5); line(c, 12, -12, -6, 6, '#b97a3a', 1.5); }
    line(c, 11, -4, 11, -21, '#8a4f1f', 1.6);
    c.beginPath(); c.moveTo(11.5, -21); c.lineTo(23, -17.5); c.lineTo(11.5, -13); c.closePath(); ink(c, o.acc, 1.6);
    if (o.tier >= 5) { star(c, 0, 0, 7, 3.6, 5, -Math.PI / 2); ink(c, '#ffd23f', 1.5); }
  },
};
const FIXED = { linter: Math.PI / 2, docker: Math.PI / 2, backup: 0, thread: 0 };

function towerSprite(k, p) {
  return sprite('T' + k + p.join(''), 96, (c) => {
    const sk = skin(k, p), sc = 0.92 * (1 + sk.tier * 0.035);
    c.scale(sc, sc);
    DRAW[k](c, { acc: sk.accent, tier: sk.tier, dom: sk.dom, p, mane: sk.tier >= 5 ? '#c9781c' : MANE });
  });
}
/** Dibuja una torre. (Lo usa también la tienda para sus iconos.) */
export function drawTower(ctx, k, x, y, p, ang, time, off) {
  p = p || [0, 0, 0];
  const img = towerSprite(k, p), a = FIXED[k] !== undefined ? FIXED[k] : ang;
  ctx.save();
  ctx.translate(x, y);
  if (off) ctx.globalAlpha *= 0.45;
  const b = 1 + 0.025 * Math.sin(time * 3 + x * 0.7 + y);
  ctx.rotate(a); ctx.scale(b, 2 - b);
  ctx.drawImage(img, -48, -48, 96, 96);
  ctx.restore();
  const total = p[0] + p[1] + p[2];
  if (total && !off) {
    // marcas de tier por rama (3 columnas de hasta 5)
    TOWERS[k].paths.forEach((P, i) => {
      for (let j = 0; j < p[i]; j++) {
        ctx.fillStyle = INK; ctx.fillRect(x - 11.5 + i * 8, y + 22.5 - j * 3.4, 7, 3.6);
        ctx.fillStyle = P.color; ctx.fillRect(x - 10.7 + i * 8, y + 23.2 - j * 3.4, 5.4, 2.2);
      }
    });
  }
}
function leonaSprite(big, color) {
  return sprite('L' + big + color, 40, (c) => {
    if (big) c.scale(1.55, 1.55);
    c.beginPath(); c.ellipse(-4, 0, 6, 5, 0, 0, TAU); ink(c, FUR, 1.8);
    c.beginPath(); c.arc(-1.5, 0, 5.2, Math.PI * 0.5, Math.PI * 1.5, true); c.strokeStyle = color; c.lineWidth = 2.4; c.stroke();
    for (const s of [-1, 1]) { c.beginPath(); c.arc(0.5, s * 4.6, 2.1, 0, TAU); ink(c, FUR_D, 1.3); }
    c.beginPath(); c.arc(3, 0, 5, 0, TAU); ink(c, FUR, 1.8);
    c.beginPath(); c.ellipse(6, 0, 2.3, 2.8, 0, 0, TAU); c.fillStyle = MUZZLE; c.fill();
    c.beginPath(); c.arc(7.6, 0, 1.2, 0, TAU); c.fillStyle = '#5a2d1a'; c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.arc(4.2, s * 2.4, 1, 0, TAU); c.fillStyle = '#2a1608'; c.fill(); }
    if (big) { for (const s of [-1, 1]) { c.beginPath(); c.arc(-5, s * 4.8, 2.6, 0, TAU); ink(c, '#cfd6dd', 1.2); } }
  });
}

// ============================================================
//  BARRILES (enemigos)
// ============================================================
const BARREL = {
  bug: { wood: '#c8793a', stave: '#9c5a26', hoop: '#6f7680', lid: '#e0a060' },
  leak: { wood: '#86b24e', stave: '#5f8a34', hoop: '#55606a', lid: '#a9cf6b' },
  npe: { wood: '#d9c9f7', stave: '#b29be0', hoop: '#9a86c9', lid: '#efe6ff' },
  ddos: { wood: '#f0d9a0', stave: '#cdb070', hoop: '#8a8f98', lid: '#fff0c8' },
  boss: { wood: '#7a4322', stave: '#552c14', hoop: '#f2c230', lid: '#9a5a30' },
  branch: { wood: '#e0902f', stave: '#b06a1c', hoop: '#6f7680', lid: '#f2b25a' },
  rootkit: { wood: '#7a9a44', stave: '#56742e', hoop: '#4b5a2e', lid: '#93b25a' },
  ransom: { wood: '#aab3bd', stave: '#7d8792', hoop: '#59626c', lid: '#c9d1d9' },
  zeroday: { wood: '#e8923c', stave: '#b96a22', hoop: '#6f7680', lid: '#f6b566' },
};
function barrelPath(c, w, h) {
  c.beginPath(); c.moveTo(-w * 0.72, -h); c.lineTo(w * 0.72, -h); c.quadraticCurveTo(w * 1.22, 0, w * 0.72, h);
  c.lineTo(-w * 0.72, h); c.quadraticCurveTo(-w * 1.22, 0, -w * 0.72, -h); c.closePath();
}
function barrelSprite(k) {
  const r = ENEMIES[k].r, size = Math.ceil(r * 3.4 + 22);
  return sprite('B' + k, size, (c) => {
    const o = BARREL[k], w = r * 1.05, h = r * 1.3;
    barrelPath(c, w, h); ink(c, o.wood, 2.2);
    c.save(); barrelPath(c, w, h); c.clip();
    c.strokeStyle = o.stave; c.lineWidth = Math.max(1, r * 0.11);
    for (const i of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(i * w * 0.95, -h); c.quadraticCurveTo(i * w * 1.75, 0, i * w * 0.95, h); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(w * 0.3, -h, w, h * 2);
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(-w * 0.8, -h, w * 0.26, h * 2);
    if (k === 'rootkit') { for (const [x, y, rx, col] of [[-0.4, -0.5, 0.45, '#4f6b2a'], [0.35, 0, 0.5, '#a39650'], [-0.2, 0.55, 0.4, '#3f5a22'], [0.5, -0.7, 0.3, '#4f6b2a']]) { c.beginPath(); c.ellipse(x * w, y * h, rx * w, rx * w * 0.7, x, 0, TAU); c.fillStyle = col; c.fill(); } }
    if (k === 'leak') { for (const [x, y, rx] of [[-0.5, 0.3, 0.3], [0.4, -0.35, 0.34], [0.1, 0.7, 0.26]]) { c.beginPath(); c.ellipse(x * w, y * h, rx * w, rx * w * 0.8, 0, 0, TAU); c.fillStyle = '#4f8a34'; c.fill(); } }
    if (k === 'ransom') { c.fillStyle = '#4a525b'; for (const y of [-0.82, -0.28, 0.28, 0.82]) for (const x of [-0.6, 0, 0.6]) { c.beginPath(); c.arc(x * w, y * h, r * 0.09 + 0.5, 0, TAU); c.fill(); } }
    for (const y of [-h * 0.56, h * 0.56]) {
      c.fillStyle = o.hoop; c.fillRect(-w * 1.3, y - r * 0.17, w * 2.6, r * 0.34);
      c.strokeStyle = INK; c.lineWidth = 1.1; c.strokeRect(-w * 1.3, y - r * 0.17, w * 2.6, r * 0.34);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-w * 0.75, y - r * 0.17, w * 0.25, r * 0.34);
    }
    c.restore();
    barrelPath(c, w, h); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.ellipse(0, -h, w * 0.72, h * 0.17, 0, 0, TAU); ink(c, o.lid, 1.6);
    // distintivos
    if (k === 'leak' || k === 'rootkit') {
      for (const [x, a] of [[-0.3, -0.7], [0.25, 0.5], [0, -0.1]]) { c.save(); c.translate(x * w, -h - 1); c.rotate(a - Math.PI / 2); c.beginPath(); c.ellipse(5, 0, 5.5, 2.4, 0, 0, TAU); ink(c, k === 'leak' ? '#6fd04a' : '#4f7a2a', 1.3); c.restore(); }
    }
    if (k === 'npe') {
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * w * 0.36, -h * 0.08, w * 0.17, h * 0.2, 0, 0, TAU); c.fillStyle = '#3a2a5a'; c.fill(); }
      c.beginPath(); c.ellipse(0, h * 0.34, w * 0.16, h * 0.13, 0, 0, TAU); c.fillStyle = '#3a2a5a'; c.fill();
    }
    if (k === 'ransom') {
      c.beginPath(); c.arc(0, -1, r * 0.3, Math.PI, 0); c.strokeStyle = INK; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = '#e0e6ec'; c.lineWidth = 1.6; c.stroke();
      rr(c, -r * 0.42, -1, r * 0.84, r * 0.62, 1.5); ink(c, '#ffd23f', 1.4);
    }
    if (k === 'branch') { c.beginPath(); c.moveTo(-w * 0.2, -h); c.lineTo(w * 0.1, -h * 0.5); c.lineTo(-w * 0.25, -h * 0.1); c.lineTo(w * 0.15, h * 0.4); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke(); }
    if (k === 'boss') {
      for (const s of [-1, 1]) {
        c.beginPath(); c.ellipse(s * w * 0.4, -h * 0.05, w * 0.22, h * 0.17, 0, 0, TAU); ink(c, '#fff', 1.6);
        c.beginPath(); c.arc(s * w * 0.36, -h * 0.02, w * 0.1, 0, TAU); c.fillStyle = '#c0182a'; c.fill();
        c.beginPath(); c.moveTo(s * w * 0.72, -h * 0.38); c.lineTo(s * w * 0.12, -h * 0.2); c.strokeStyle = INK; c.lineWidth = 3.4; c.stroke();
      }
      c.beginPath(); c.moveTo(-w * 0.42, h * 0.3); c.lineTo(-w * 0.2, h * 0.22); c.lineTo(0, h * 0.32); c.lineTo(w * 0.2, h * 0.22); c.lineTo(w * 0.42, h * 0.3); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke();
      for (const x of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(x * w - 4, -h - 2); c.lineTo(x * w, -h - 11); c.lineTo(x * w + 4, -h - 2); c.closePath(); ink(c, '#f2c230', 1.6); }
    }
  });
}
function drawEnemy(ctx, e, x, y, time, M) {
  const def = ENEMIES[e.k], BS = def.boss ? 1.1 : 1.25, r = def.r * BS, img = barrelSprite(e.k), size = (img.width / 2) * BS;
  const stunned = e.st > 0;
  const wob = stunned ? 0 : Math.sin(time * 7 + e.i * 1.3) * 0.11, hop = stunned ? 0 : -Math.abs(Math.sin(time * 8 + e.i)) * 1.6;
  if (def.fly) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 5, y + 22, r, r * 0.4, 0, 0, TAU); ctx.fill();
    y -= 8 + Math.sin(time * 4 + e.i) * 2;
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(time * 16 + e.i));
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(x + s * r * 0.8, y - 2); ctx.scale(s, flap);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(12, -16, 22, -6); ctx.quadraticCurveTo(15, -3, 17, 3); ctx.quadraticCurveTo(9, 1, 9, 6); ctx.quadraticCurveTo(4, 3, 0, 5); ctx.closePath();
      ink(ctx, '#ffffff', 1.8); ctx.restore();
    }
  } else {
    if (e.oi > 0) { ctx.fillStyle = 'rgba(20,14,26,0.55)'; ctx.beginPath(); ctx.ellipse(x, y + r * 1.2, r * 1.5, r * 0.55, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + r * 1.25, r * 0.95, r * 0.34, 0, 0, TAU); ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y + hop); ctx.rotate(wob);
  if (def.camo) ctx.globalAlpha = e.rv > 0 ? 0.95 : 0.4 + 0.12 * Math.sin(time * 6 + e.i);
  else if (def.ghost) ctx.globalAlpha = 0.6 + 0.22 * Math.sin(time * 9 + e.i);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  const top = y - r * 1.5;
  // estados
  if (e.oi > 0) { ctx.fillStyle = '#1b1422'; for (const [dx, dy] of [[-0.5, 0.2], [0.4, -0.3], [0.1, 0.7]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r + hop, r * 0.2 + 0.6, 0, TAU); ctx.fill(); } }
  if (e.wt > 0) {
    for (let i = 0; i < 3; i++) {
      const a = time * 2 + e.i + i * 2.1, dx = Math.cos(a) * (r + 5), dy = Math.sin(a) * (r * 0.6) - 2;
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy - 4.5); ctx.quadraticCurveTo(x + dx + 4, y + dy + 2, x + dx, y + dy + 3); ctx.quadraticCurveTo(x + dx - 4, y + dy + 2, x + dx, y + dy - 4.5); ink(ctx, '#5ac8ff', 1.2);
    }
  }
  if (e.bt > 0) {
    const f = 1 + 0.25 * Math.sin(time * 22 + e.i);
    ctx.beginPath(); ctx.moveTo(x - 5, top + 3); ctx.quadraticCurveTo(x - 7, top - 5 * f, x - 1, top - 11 * f); ctx.quadraticCurveTo(x + 1, top - 5, x + 4, top - 8 * f); ctx.quadraticCurveTo(x + 8, top - 2, x + 5, top + 3); ctx.closePath(); ink(ctx, '#ff7a1a', 1.4);
    ctx.beginPath(); ctx.arc(x, top, 2.6, 0, TAU); ctx.fillStyle = '#ffe14a'; ctx.fill();
  }
  if (e.vt > 0) {
    const col = e.vu >= 1 ? '#ff3a3a' : '#c77dff';
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + time; ctx.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4)); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12)); } ctx.stroke();
  }
  if (stunned) {
    for (let i = 0; i < 3; i++) { const a = time * 5 + i * TAU / 3; star(ctx, x + Math.cos(a) * (r + 2), top - 2 + Math.sin(a) * 3, 4, 1.8, 5, a); ink(ctx, '#ffe14a', 1.1); }
  } else if (e.sl > 0 && e.wt <= 0) {
    ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(x, y + r * 1.2, r + 2, Math.PI * 1.1 + time * 2, Math.PI * 1.9 + time * 2); ctx.stroke();
  }
  if (e.h < e.m) {
    const w = Math.max(18, r * 2.4), bx = x - w / 2, by = top - (e.bt > 0 ? 16 : 7);
    rr(ctx, bx - 1, by - 1, w + 2, 6, 3); ctx.fillStyle = INK; ctx.fill();
    rr(ctx, bx, by, Math.max(2, w * Math.max(0, e.h / e.m)), 4, 2); ctx.fillStyle = def.boss ? '#ffd23f' : def.armor ? '#c9d1d9' : '#6fe04a'; ctx.fill();
  }
}

// ============================================================
//  EFECTOS
// ============================================================
const DUR = { b: 0.13, s: 0.38, a: 0.55, c: 0.28, d: 0.6, p: 0.45, m: 1.1, h: 0.5, w: 2.4, f: 0.42, x: 0.6, k: 1.2, l: 1.5, g: 0.5, z: 0.5, r: 0.45 };
export function addFx(list, now) {
  for (const f of list) fxs.push({ f, t0: now, dur: f[0] === 't' ? f[5] || 1 : DUR[f[0]] || 0.3 });
  if (fxs.length > 400) fxs.splice(0, fxs.length - 400);
}
export function clearFx() { fxs.length = 0; }
function burst(ctx, x, y, r, a, c1, c2) {
  ctx.globalAlpha = a;
  star(ctx, x, y, r, r * 0.62, 9, x); ink(ctx, c1, 2);
  star(ctx, x, y, r * 0.6, r * 0.34, 8, y); ctx.fillStyle = c2; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
}
function drawFx(ctx, now) {
  for (let i = fxs.length - 1; i >= 0; i--) {
    const { f, t0, dur } = fxs[i], p = (now - t0) / dur;
    if (p >= 1 || p < 0) { fxs.splice(i, 1); continue; }
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (f[0]) {
      case 'b': { // flecha / proyectil pequeño
        const x = f[1] + (f[3] - f[1]) * p, y = f[2] + (f[4] - f[2]) * p, an = Math.atan2(f[4] - f[2], f[3] - f[1]);
        ctx.translate(x, y); ctx.rotate(an);
        line(ctx, -9, 0, 3, 0, '#f7e3b0', 1.8);
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(2, -3); ctx.lineTo(2, 3); ctx.closePath(); ink(ctx, f[5] || '#dfe6ec', 1.2);
        break;
      }
      case 's': { // jabalina / virote
        const q = Math.min(1, p / 0.35), x = f[1] + (f[3] - f[1]) * q, y = f[2] + (f[4] - f[2]) * q, an = Math.atan2(f[4] - f[2], f[3] - f[1]);
        if (p < 0.35) {
          ctx.globalAlpha = 0.5; line(ctx, f[1] + (x - f[1]) * 0.5, f[2] + (y - f[2]) * 0.5, x, y, '#ffffff', 2);
          ctx.globalAlpha = 1; ctx.translate(x, y); ctx.rotate(an);
          line(ctx, -22, 0, 2, 0, '#b97a3a', 2.4);
          ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(0, -4.5); ctx.lineTo(0, 4.5); ctx.closePath(); ink(ctx, f[5] || '#dfe6ec', 1.4);
        } else burst(ctx, f[3], f[4], 8 + (p - 0.35) * 22, 1 - (p - 0.35) / 0.65, '#fff5d6', f[5] || '#ffd23f');
        break;
      }
      case 'a': { // bomba de agua: vuela y salpica
        if (p < 0.4) {
          const q = p / 0.4, x = f[1] + (f[3] - f[1]) * q, y = f[2] + (f[4] - f[2]) * q - Math.sin(q * Math.PI) * 26;
          ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(f[1] + (f[3] - f[1]) * q, f[2] + (f[4] - f[2]) * q + 6, 6, 2.5, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ink(ctx, '#3f6fd0', 1.8);
          ctx.beginPath(); ctx.arc(x - 2, y - 2, 1.8, 0, TAU); ctx.fillStyle = '#cfe6ff'; ctx.fill();
        } else {
          const q = (p - 0.4) / 0.6, R0 = f[5] * (0.45 + 0.55 * q);
          ctx.globalAlpha = (1 - q) * 0.3; ctx.beginPath(); ctx.arc(f[3], f[4], R0, 0, TAU); ctx.fillStyle = '#6fc4ff'; ctx.fill();
          ctx.globalAlpha = 1 - q; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.6; ctx.strokeStyle = '#eaf6ff'; ctx.stroke();
          ctx.fillStyle = f[6] || '#5ac8ff';
          for (let j = 0; j < 8; j++) { const a = j * 0.785 + f[3]; ctx.beginPath(); ctx.arc(f[3] + Math.cos(a) * R0 * 1.05, f[4] + Math.sin(a) * R0 * 1.05 - Math.sin(q * Math.PI) * 8, 3 * (1 - q) + 1, 0, TAU); ctx.fill(); }
        }
        break;
      }
      case 'c': { // rayo en cadena
        const q = f[1];
        ctx.globalAlpha = 1 - p * p;
        ctx.beginPath();
        for (let j = 0; j < q.length; j += 2) {
          if (j === 0) { ctx.moveTo(q[0], q[1]); continue; }
          const dx = q[j] - q[j - 2], dy = q[j + 1] - q[j - 1], L = Math.hypot(dx, dy) || 1;
          for (const t of [0.33, 0.66]) { const k = Math.sin(j * 9.1 + t * 7 + t0 * 50) * 9; ctx.lineTo(q[j - 2] + dx * t - (dy / L) * k, q[j - 1] + dy * t + (dx / L) * k); }
          ctx.lineTo(q[j], q[j + 1]);
        }
        ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = f[2] || '#ffe14a'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.stroke();
        break;
      }
      case 'd': { // pulso de zona
        ctx.globalAlpha = 1 - p;
        ctx.beginPath(); ctx.arc(f[1], f[2], f[3] * (0.3 + 0.7 * p), 0, TAU);
        ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = f[4] || '#8a5ad6'; ctx.lineWidth = 4; ctx.stroke();
        break;
      }
      case 'p': { // barril roto: astillas
        const col = ENEMIES[ENEMY_KEYS[f[3]]].color;
        ctx.globalAlpha = 1 - p;
        for (let j = 0; j < 6; j++) {
          const a = j * TAU / 6 + f[1], d = 5 + p * 20;
          ctx.save(); ctx.translate(f[1] + Math.cos(a) * d, f[2] + Math.sin(a) * d - Math.sin(p * Math.PI) * 8); ctx.rotate(a + p * 6);
          rr(ctx, -4, -1.6, 8, 3.2, 1); ink(ctx, col, 1.2); ctx.restore();
        }
        if (p < 0.5) { star(ctx, f[1], f[2], 9 + p * 10, 5, 7, f[1]); ctx.globalAlpha = 1 - p * 2; ink(ctx, '#ffffff', 1.6); }
        break;
      }
      case 'm':
        ctx.globalAlpha = Math.min(1, (1 - p) * 2);
        ctx.beginPath(); ctx.arc(f[1] - 22, f[2] - p * 26 - 5, 6, 0, TAU); ink(ctx, '#ffd23f', 1.6);
        txt(ctx, '+' + f[3], f[1] + 4, f[2] - p * 26, '#ffe14a', 14);
        break;
      case 'f': // explosión
        burst(ctx, f[1], f[2], f[3] * (0.45 + 0.6 * p), 1 - p, f[4] || '#ff8a2a', '#ffe14a');
        break;
      case 'x':
        ctx.globalAlpha = Math.min(1, (1 - p) * 2); txt(ctx, '¡CRÍTICO!', f[1], f[2] - 18 - p * 16, '#ff5a4a', 14);
        break;
      case 'r':
        ctx.globalAlpha = 1 - p; txt(ctx, '¡CLANK!', f[1], f[2] - 16 - p * 10, '#dfe6ec', 11);
        break;
      case 'z':
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.beginPath();
        for (let j = 0; j < 6; j++) { const a = j * 1.05 + t0 * 40; ctx.moveTo(f[1] + Math.cos(a) * 6, f[2] + Math.sin(a) * 6); ctx.lineTo(f[1] + Math.cos(a) * (12 + p * 14), f[2] + Math.sin(a) * (12 + p * 14)); }
        ctx.stroke();
        txt(ctx, '¡ZAP!', f[1], f[2] - 20 - p * 10, '#5ae0f0', 13);
        break;
      case 'k':
        ctx.globalAlpha = 1 - p * 0.6;
        ctx.beginPath(); ctx.arc(f[1], f[2], 28 - p * 12, 0, TAU); ctx.moveTo(f[1] - 32, f[2]); ctx.lineTo(f[1] + 32, f[2]); ctx.moveTo(f[1], f[2] - 32); ctx.lineTo(f[1], f[2] + 32);
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 2.4; ctx.stroke();
        break;
      case 'l':
        ctx.globalAlpha = Math.min(1, (1 - p) * 2); txt(ctx, '+' + f[1] + ' ♥', W / 2, 230 - p * 20, '#ff6a7a', 24);
        break;
      case 't':
        ctx.globalAlpha = Math.min(1, (1 - p) * 2.5); txt(ctx, f[3], f[1], f[2] - p * 16, f[4] || '#fff', dur > 1.2 ? 26 : 13);
        break;
      case 'g':
        ctx.globalAlpha = (1 - p) * 0.35; ctx.fillStyle = f[1] || '#fff'; ctx.fillRect(0, 0, W, H);
        break;
      case 'h':
        ctx.globalAlpha = (1 - p) * 0.38; ctx.fillStyle = '#ff2030'; ctx.fillRect(0, 0, W, H);
        break;
      case 'w': {
        ctx.globalAlpha = Math.min(1, (1 - p) * 2);
        const s = 1 + Math.max(0, 0.25 - p) * 1.2;
        ctx.translate(W / 2, 110); ctx.scale(s, s);
        txt(ctx, `OLEADA ${f[1]}`, 0, 0, '#ffe14a', 46);
        if (f[1] % 5 === 0) txt(ctx, '¡TONEL GIGANTE!', 0, 36, '#ff5a4a', 24);
        break;
      }
    }
    ctx.restore();
  }
}

// ============================================================
//  ESTRUCTURAS DEL MAPA
// ============================================================
function obstacleSprite(skinName, v, pad) {
  return sprite('O' + skinName + v + (pad ? 'p' : ''), 48, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(1, 12, 17, 6, 0, 0, TAU); c.fill();
    if (skinName === 'selva') {
      if (v) { // arbusto
        for (const [x, y, r, col] of [[-7, 3, 10, '#2f7a2c'], [7, 4, 10, '#2f7a2c'], [0, -5, 12, '#3f9a38']]) { c.beginPath(); c.arc(x, y, r, 0, TAU); ink(c, col, 2); }
        for (const [x, y] of [[-6, -2], [5, -7], [2, 4]]) { c.beginPath(); c.arc(x, y, 2.2, 0, TAU); ink(c, '#ff5a7a', 1); }
      } else { // tocón
        c.beginPath(); c.ellipse(0, 4, 14, 10, 0, 0, TAU); ink(c, '#7a4a22', 2.2);
        c.beginPath(); c.ellipse(0, -1, 14, 9, 0, 0, TAU); ink(c, '#d9a866', 2.2);
        c.strokeStyle = '#a8763a'; c.lineWidth = 1.3; for (const r of [9, 5.5, 2.2]) { c.beginPath(); c.ellipse(0, -1, r, r * 0.64, 0, 0, TAU); c.stroke(); }
        c.save(); c.translate(11, -6); c.rotate(-0.6); c.beginPath(); c.ellipse(0, 0, 6, 2.8, 0, 0, TAU); ink(c, '#5ac84a', 1.3); c.restore();
      }
    } else if (skinName === 'volcan') {
      for (const [x, w, h, col] of v ? [[-8, 9, 20, '#3a2f3f'], [3, 10, 26, '#4a3d52'], [11, 7, 15, '#30262f']] : [[-9, 8, 15, '#30262f'], [-1, 11, 24, '#4a3d52'], [9, 8, 18, '#3a2f3f']]) {
        c.beginPath(); c.moveTo(x - w / 2, 10); c.lineTo(x, 10 - h); c.lineTo(x + w / 2, 10); c.closePath(); ink(c, col, 2);
        c.beginPath(); c.moveTo(x, 10 - h); c.lineTo(x - w * 0.18, 10); c.lineTo(x - w / 2, 10); c.closePath(); c.fillStyle = 'rgba(255,255,255,0.14)'; c.fill();
      }
    } else {
      for (const [x, y, rx, ry, col] of v ? [[-6, 3, 10, 8, '#9a9288'], [7, 5, 8, 6.5, '#857d74'], [1, -5, 8, 6.5, '#aaa298']] : [[5, 3, 11, 8.5, '#9a9288'], [-8, 5, 7.5, 6, '#857d74'], [-2, -5, 7.5, 6, '#aaa298']]) {
        c.beginPath(); c.ellipse(x, y, rx, ry, 0.2, 0, TAU); ink(c, col, 2.2);
        c.beginPath(); c.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.25, 0.2, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill();
      }
    }
    if (pad) { star(c, 13, -13, 6, 2.8, 5, -Math.PI / 2); ink(c, '#ffd23f', 1.4); }
  });
}
function denSprite(mi) {
  const M = MAPS[mi];
  return sprite('D' + mi, 190, (c) => {
    const R = rng(99 + mi), w = M.bw / 2 + 6, h = M.bh / 2 + 3;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(4, h * 0.9, w * 1.05, h * 0.3, 0, 0, TAU); c.fill();
    const pts = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, k = 0.9 + R() * 0.16; pts.push([Math.cos(a) * w * k, Math.sin(a) * h * k]); }
    c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p[0], p[1])); c.closePath(); ink(c, M.skin === 'volcan' ? '#6d5f66' : '#a59a8d', 3);
    c.save(); c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p[0], p[1])); c.closePath(); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.beginPath(); c.ellipse(-w * 0.3, -h * 0.45, w * 0.7, h * 0.4, -0.3, 0, TAU); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.16)'; c.beginPath(); c.ellipse(w * 0.4, h * 0.6, w * 0.8, h * 0.45, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) { const x = (R() - 0.5) * w * 1.4, y = (R() - 0.5) * h * 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 22, y + (R() - 0.5) * 22); c.stroke(); }
    c.restore();
    // entrada de la cueva
    c.beginPath(); c.moveTo(-15, h * 0.42); c.quadraticCurveTo(-16, h * 0.42 - 34, 0, h * 0.42 - 36); c.quadraticCurveTo(16, h * 0.42 - 34, 15, h * 0.42); c.closePath(); ink(c, '#2a1a10', 2.6);
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 5, h * 0.42 - 15, 2.6, 3.2, 0, 0, TAU); c.fillStyle = '#ffe14a'; c.fill(); c.beginPath(); c.ellipse(s * 5, h * 0.42 - 15, 1, 2.6, 0, 0, TAU); c.fillStyle = '#2a1a10'; c.fill(); }
  });
}
function drawDen(ctx, G, M, time) {
  const img = denSprite(G.map);
  ctx.drawImage(img, M.bcx - 95, M.bcy - 95, 190, 190);
  // estandarte
  const fx = M.bcx - M.bw / 2 + 4, fy = M.bcy - M.bh / 2 + 2;
  line(ctx, fx, fy + 22, fx, fy - 22, '#8a4f1f', 2.4);
  ctx.beginPath(); ctx.moveTo(fx + 1, fy - 22);
  ctx.quadraticCurveTo(fx + 12, fy - 26 + Math.sin(time * 5) * 2, fx + 24, fy - 20 + Math.sin(time * 5 + 1) * 2);
  ctx.lineTo(fx + 24, fy - 6 + Math.sin(time * 5 + 1) * 2); ctx.quadraticCurveTo(fx + 12, fy - 11 + Math.sin(time * 5) * 2, fx + 1, fy - 8); ctx.closePath(); ink(ctx, '#e8443a', 2);
  star(ctx, fx + 12, fy - 15 + Math.sin(time * 5) * 2, 4.5, 2.2, 5, -Math.PI / 2); ctx.fillStyle = '#ffd23f'; ctx.fill();
  // barra de vida
  const lf = Math.max(0, Math.min(1, G.life / M.life)), bw = M.bw + 6, bx = Math.min(W - bw - 6, M.bcx - bw / 2), by = M.by + M.bh + 8;
  rr(ctx, bx - 2, by - 2, bw + 4, 12, 6); ctx.fillStyle = INK; ctx.fill();
  rr(ctx, bx, by, Math.max(6, bw * lf), 8, 4); ctx.fillStyle = lf > 0.5 ? '#6fe04a' : lf > 0.25 ? '#ffb03f' : '#ff4a4a'; ctx.fill();
  txt(ctx, 'GUARIDA', M.bcx, M.by - 10, '#fff5d6', 11);
}

function drawStructures(ctx, G, M, time, o) {
  const sk = SKINS[M.skin];
  // zonas: brasas / lava y río
  for (const z of M.zones) {
    const x = z.x0 * CELL, y = z.y0 * CELL, w = (z.x1 - z.x0 + 1) * CELL, h = (z.y1 - z.y0 + 1) * CELL, vert = h > w;
    ctx.save();
    rr(ctx, x + (vert ? 4 : 0), y + (vert ? 0 : 4), w - (vert ? 8 : 0), h - (vert ? 0 : 8), 8); ctx.clip();
    if (z.t === 'heat') {
      ctx.fillStyle = '#e8501a'; ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 14; i++) {
        const px = x + ((i * 53.7) % w), py = y + ((i * 31.3 + time * (6 + (i % 3) * 3)) % h), r = 5 + (i % 4) * 2.5 + Math.sin(time * 3 + i) * 1.5;
        ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fillStyle = i % 3 ? '#ff9a2a' : '#ffd84a'; ctx.fill();
      }
      ctx.fillStyle = `rgba(255,240,150,${0.12 + 0.1 * Math.sin(time * 4)})`; ctx.fillRect(x, y, w, h);
    } else {
      ctx.fillStyle = '#3f9be0'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const px = x + ((i * 47.1 + time * 16) % (w + 30)) - 15, py = y + 8 + ((i * 23.7) % (h - 12));
        ctx.beginPath(); ctx.moveTo(px - 8, py); ctx.quadraticCurveTo(px - 4, py - 4, px, py); ctx.quadraticCurveTo(px + 4, py + 4, px + 8, py); ctx.stroke();
      }
    }
    ctx.restore();
    rr(ctx, x + (vert ? 4 : 0), y + (vert ? 0 : 4), w - (vert ? 8 : 0), h - (vert ? 0 : 8), 8); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.save();
    if (vert) { ctx.translate(x - 5, y + h / 2); ctx.rotate(-Math.PI / 2); } else ctx.translate(x + w / 2, y - 3);
    txt(ctx, z.t === 'heat' ? sk.heat : 'RÍO', 0, 0, z.t === 'heat' ? '#ffb84a' : '#9fdcff', 11);
    ctx.restore();
  }
  // tótems de poder
  for (const [cx, cy] of M.pads) {
    const x = cx * CELL + 20, y = cy * CELL + 20, g = 0.5 + 0.5 * Math.sin(time * 3 + cx);
    ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ink(ctx, '#b9ab94', 2.2);
    ctx.beginPath(); ctx.arc(x, y, 13.5, 0, TAU); ctx.strokeStyle = `rgba(255,210,63,${0.55 + 0.45 * g})`; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = `rgba(255,210,63,${0.6 + 0.4 * g})`;
    ctx.beginPath(); ctx.ellipse(x, y + 3, 5, 4, 0, 0, TAU); ctx.fill();
    for (const [dx, dy] of [[-6, -3], [-2, -7], [2, -7], [6, -3]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2, 0, TAU); ctx.fill(); }
  }
  // rocas, troncos y ruinas (obstáculos)
  M.obs.forEach((ob, i) => {
    if (G.ob[i]) return;
    const x = ob[0] * CELL + 20, y = ob[1] * CELL + 20, pad = M.padAt.has(ob[1] * COLS + ob[0]);
    ctx.drawImage(obstacleSprite(M.skin, i % 2, pad), x - 24, y - 24, 48, 48);
    if (o.selOb === i) { rr(ctx, x - 20, y - 20, 40, 40, 8); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); }
  });
  // trampas
  M.traps.forEach((tr, i) => {
    const st = G.tr[i] || { c: 0, a: 0 }, x = tr.x * CELL + 20, y = tr.y * CELL + 20, ready = st.c <= 0;
    if (tr.t === 'bomb') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 15, 5, 0, 0, TAU); ctx.fill();
      ctx.save(); if (!ready) ctx.globalAlpha = 0.5;
      for (const dx of [-8, 0, 8]) { rr(ctx, x + dx - 4, y - 10, 8, 22, 3); ink(ctx, '#e8443a', 2); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x + dx - 2.5, y - 8, 1.8, 16); }
      rr(ctx, x - 13.5, y - 2, 27, 5, 2); ink(ctx, '#3a2413', 1.4);
      ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.quadraticCurveTo(x + 5, y - 19, x + 11, y - 15); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.restore();
      if (ready) { star(ctx, x + 11, y - 15, 5 + Math.sin(time * 14) * 1.5, 2.2, 6, time * 5); ink(ctx, '#ffe14a', 1.2); }
      else txt(ctx, String(Math.ceil(st.c)), x, y + 6, '#fff5d6', 14);
      txt(ctx, 'DINAMITA', x, y - 23, ready ? '#ffe14a' : '#d9cdb5', 9);
    } else {
      const active = st.a > 0, cx0 = tr.x * CELL, cy0 = tr.y * CELL;
      if (active) {
        rr(ctx, cx0 + 1, cy0 + 1, 38, 38, 5); ink(ctx, '#1e1410', 2.4);
        ctx.save(); rr(ctx, cx0 + 3, cy0 + 3, 34, 34, 4); ctx.clip();
        for (let d = -40; d < 50; d += 14) { ctx.beginPath(); ctx.moveTo(cx0 + d, cy0 + 40); ctx.lineTo(cx0 + d + 14, cy0 + 40); ctx.lineTo(cx0 + d + 54, cy0); ctx.lineTo(cx0 + d + 40, cy0); ctx.closePath(); ctx.fillStyle = Math.round(d / 14) % 2 ? '#ffe14a' : '#e8443a'; ctx.globalAlpha = 0.9; ctx.fill(); }
        ctx.restore();
        txt(ctx, 'CERRADO ' + Math.ceil(st.a), x, cy0 - 4, '#ffffff', 10);
      } else {
        rr(ctx, cx0 + 2, cy0 + 2, 36, 36, 4); ink(ctx, ready ? '#b97a3a' : '#8a6a48', 2.2);
        ctx.strokeStyle = 'rgba(58,36,19,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let k = 1; k < 5; k++) { ctx.moveTo(cx0 + 2 + k * 7.2, cy0 + 3); ctx.lineTo(cx0 + 2 + k * 7.2, cy0 + 37); }
        ctx.stroke();
        for (const [dx, dy] of [[6, 6], [34, 6], [6, 34], [34, 34]]) { ctx.beginPath(); ctx.arc(cx0 + dx, cy0 + dy, 2, 0, TAU); ctx.fillStyle = '#5b636e'; ctx.fill(); }
        if (!ready) txt(ctx, String(Math.ceil(st.c)), x, y + 5, '#fff5d6', 14);
        txt(ctx, 'PUENTE', x, cy0 - 4, ready ? '#ffe14a' : '#d9cdb5', 9);
      }
    }
  });
  // señales de cruce
  M.forks.forEach((f, i) => {
    const x = f.cell[0] * CELL + 20, y = f.cell[1] * CELL + 20, on = G.sw[i] ? f.alt : f.r;
    const a = pathPos(M, on, f.d), b = pathPos(M, on, f.d + 60), an = Math.atan2(b.y - a.y, b.x - a.x), ready = G.swc <= 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 13, 14, 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ink(ctx, '#9a9288', 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.scale(1.25, 1.25);
    ctx.beginPath(); ctx.moveTo(-15, -6); ctx.lineTo(8, -6); ctx.lineTo(17, 0); ctx.lineTo(8, 6); ctx.lineTo(-15, 6); ctx.closePath(); ink(ctx, ready ? '#e6b871' : '#a8906c', 2.2);
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(5, 0); ctx.moveTo(1, -3.5); ctx.lineTo(6, 0); ctx.lineTo(1, 3.5); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    txt(ctx, ready ? 'SEÑAL' : 'SEÑAL ' + Math.ceil(G.swc), x, y - 21, ready ? '#ffe14a' : '#d9cdb5', 9);
    // flechas sobre la rama activa
    for (let n = 0; n < 3; n++) {
      const p = pathPos(M, on, f.d + 34 + n * 36 + ((time * 40) % 36));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(an); ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -6); ctx.lineTo(-1, 0); ctx.lineTo(-4, 6); ctx.closePath(); ink(ctx, '#fff5d6', 1.4); ctx.restore();
    }
  });
  // cuevas aún cerradas
  for (const en of M.entries) {
    if (en.from <= Math.max(1, G.w + (G.ic > 0 ? 1 : 0))) continue;
    const Rt = M.R[en.r], p0 = Rt.pts[0], p1 = Rt.pts[1], dx = Math.sign(p1.x - p0.x), dy = Math.sign(p1.y - p0.y);
    const x = Math.max(20, Math.min(W - 20, p0.x)), y = Math.max(20, Math.min(H - 20, p0.y));
    for (let n = 0; n < 2; n++) {
      const bx = x + dx * n * 34, by = y + dy * n * 34;
      for (const [ox, oy, rx, ry, col] of [[-9, 4, 12, 10, '#857d74'], [9, 5, 11, 9, '#9a9288'], [0, -7, 12, 10, '#aaa298']]) {
        ctx.beginPath(); ctx.ellipse(bx + ox, by + oy, rx, ry, 0.2, 0, TAU); ink(ctx, col, 2.2);
      }
    }
    txt(ctx, `CUEVA CERRADA · se abre en la oleada ${en.from}`, Math.max(170, Math.min(W - 170, x - (dy ? 170 : 0))), dy ? y + 6 : y - 30, '#fff5d6', 12);
  }
}

function rangeCircle(ctx, x, y, r, ok = true) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = ok ? 'rgba(255,255,255,0.16)' : 'rgba(255,60,60,0.2)'; ctx.fill();
  ctx.strokeStyle = 'rgba(58,36,19,0.55)'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.strokeStyle = ok ? 'rgba(255,255,255,0.9)' : 'rgba(255,120,120,0.95)'; ctx.lineWidth = 1.6; ctx.stroke();
}

// ============================================================
//  ESCENA COMPLETA
// ============================================================
/**
 * G: estado del juego. o: { time, prev (Map id->d de la instantánea anterior), alpha,
 *    hover {cx,cy}, placing (tipo), placingP, movingId, valid, selId, selOb, cursors [{x,y,name,color,b}] }
 */
export function render(ctx, G, o) {
  const M = MAPS[G.map], time = o.time;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.drawImage(bgs[G.map] || (bgs[G.map] = buildBg(G.map)), 0, 0);

  drawStructures(ctx, G, M, time, o);

  // zonas de brea (Alquimista) y ondas del tambor: debajo de todo
  for (const t of G.T) {
    const x = t.x * CELL + 20, y = t.y * CELL + 20;
    if (t.k === 'docker') {
      const r = tRange(G, t), c = skin(t.k, t.p).main;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU, rr2 = r * (0.965 + 0.03 * Math.sin(a * 3 + time * 1.2 + t.i) + 0.015 * Math.sin(a * 7 - time)); ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
      ctx.closePath(); ctx.fillStyle = 'rgba(36,22,48,0.5)'; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.4, r * 0.55, r * 0.28, -0.4, 0, TAU); ctx.fill(); ctx.restore();
      ctx.beginPath(); for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU, rr2 = r * (0.965 + 0.03 * Math.sin(a * 3 + time * 1.2 + t.i) + 0.015 * Math.sin(a * 7 - time)); ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
      ctx.strokeStyle = 'rgba(20,12,28,0.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = c; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1;
      for (let i = 0; i < 5; i++) { const a = i * 1.9 + t.i, d = r * (0.25 + 0.13 * i), b = (time * 0.8 + i * 0.37) % 1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + b * 4, 0, TAU); ctx.strokeStyle = `rgba(200,180,230,${0.7 * (1 - b)})`; ctx.lineWidth = 1.5; ctx.stroke(); }
    } else if (t.k === 'linter') {
      const r = tRange(G, t), hot = t.at > 0;
      for (let i = 0; i < 2; i++) {
        const b = (time * (hot ? 1.6 : 0.6) + i * 0.5) % 1;
        ctx.beginPath(); ctx.arc(x, y, r * b, 0, TAU); ctx.strokeStyle = hot ? `rgba(255,255,255,${0.9 * (1 - b)})` : `rgba(255,245,214,${0.55 * (1 - b)})`; ctx.lineWidth = hot ? 4 : 2.5; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.setLineDash([7, 9]); ctx.strokeStyle = 'rgba(58,36,19,0.4)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }
  }

  drawDen(ctx, G, M, time);

  // leonas del cuartel
  for (const t of G.T) {
    if (t.k !== 'thread' || t._rd < 0) continue;
    const st = tStats(t), uhp = st.uhp * G._m.thread, col = t.at > 0 ? '#ffffff' : skin(t.k, t.p).accent;
    const img = leonaSprite(st.big ? 1 : 0, col);
    t.s.forEach((s, j) => {
      if (s.h <= 0) return;
      const d = soldierD(t, j), p = pathPos(M, t._rt, d), q = pathPos(M, t._rt, d - 8);
      const x = p.x, y = p.y + (j % 2 ? 8 : -8), an = Math.atan2(q.y - p.y, q.x - p.x), fight = s.e || s.f;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 5, st.big ? 11 : 7, st.big ? 5 : 3, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(x + (fight ? Math.cos(an) * Math.abs(Math.sin(time * 12 + j)) * 4 : 0), y + (fight ? Math.sin(an) * Math.abs(Math.sin(time * 12 + j)) * 4 : 0)); ctx.rotate(an);
      ctx.drawImage(img, -20, -20, 40, 40); ctx.restore();
      if (s.h < uhp) { const w = st.big ? 22 : 14; rr(ctx, x - w / 2 - 1, y - (st.big ? 19 : 13), w + 2, 5, 2.5); ctx.fillStyle = INK; ctx.fill(); rr(ctx, x - w / 2, y - (st.big ? 18 : 12), Math.max(2, w * Math.min(1, s.h / uhp)), 3, 1.5); ctx.fillStyle = '#6fe04a'; ctx.fill(); }
    });
  }

  // barriles (interpolados si somos cliente); los voladores se dibujan al final
  const flyers = [], ground = [];
  for (const e of G.E) {
    if (e.h <= 0) continue;
    let d = e.d;
    if (o.prev && o.prev.has(e.i)) { const pd = o.prev.get(e.i); d = pd + (e.d - pd) * o.alpha; }
    const p = epos(M, e.k, e.r, d);
    (ENEMIES[e.k].fly ? flyers : ground).push([e, p.x + ((e.i * 37) % 11) - 5, p.y + ((e.i * 53) % 11) - 5]);
  }
  ground.sort((a, b) => a[2] - b[2]);
  for (const [e, x, y] of ground) drawEnemy(ctx, e, x, y, time, M);

  // torres
  const sel = o.selId ? G.T.find((t) => t.i === o.selId) : null;
  if (sel && sel.k !== 'backup') rangeCircle(ctx, sel.x * CELL + 20, sel.y * CELL + 20, tRange(G, sel));
  for (const t of [...G.T].sort((a, b) => a.y - b.y)) {
    const x = t.x * CELL + 20, y = t.y * CELL + 20, off = t.dz > 0 || o.movingId === t.i, st = tStats(t), tier = Math.max(...t.p);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 13, 17, 7, 0, 0, TAU); ctx.fill();
    if (o.selId === t.i) { ctx.beginPath(); ctx.ellipse(x, y + 12, 21, 9, 0, 0, TAU); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); }
    if (tier >= 5 && !off) {
      // aura dorada de Tier 5
      const g = ctx.createRadialGradient(x, y, 8, x, y, 34);
      g.addColorStop(0, 'rgba(255,220,80,0.55)'); g.addColorStop(1, 'rgba(255,220,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) { const a = time * 1.6 + i * TAU / 4; star(ctx, x + Math.cos(a) * 26, y + Math.sin(a) * 26, 4, 1.6, 4, a); ctx.fillStyle = '#fff6c2'; ctx.fill(); }
    }
    if (t.at > 0 && t.k !== 'linter') { ctx.beginPath(); ctx.arc(x, y, 25 + 2 * Math.sin(time * 14), 0, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2.6; ctx.stroke(); }
    if (t._cf) { ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke(); }
    drawTower(ctx, t.k, x, y, t.p, t.a, time, off);
    if (t._b > 0 && !off) txt(ctx, '♪', x - 17, y - 12 + Math.sin(time * 5 + t.i) * 2, '#e0b0ff', 13);
    if (st.ab && !off) {
      const ready = t.ac <= 0, s = ready ? 1 + 0.15 * Math.sin(time * 7) : 0.85;
      ctx.beginPath(); ctx.arc(x + 16, y - 16, 7 * s, 0, TAU); ink(ctx, ready ? '#ffe14a' : '#8a8f98', 1.8);
      txt(ctx, ready ? '!' : String(Math.ceil(t.ac)), x + 16, y - 12.5, ready ? '#3a2413' : '#fff', ready ? 11 : 8);
    }
    if (t.dz > 0) txt(ctx, 'MUDANZA', x, y - 24, '#fff', 10);
    if (t.k === 'thread' && t._rd < 0) txt(ctx, 'LEJOS DEL CAMINO', x, y - 26, '#ff8a7a', 10);
  }

  for (const [e, x, y] of flyers) drawEnemy(ctx, e, x, y, time, M);

  drawFx(ctx, time);

  // celda con estructura bajo el ratón
  if (o.hover && !o.placing) {
    const key = o.hover.cy * COLS + o.hover.cx, oi = M.obsAt.get(key);
    if ((oi !== undefined && !G.ob[oi]) || M.trapAt.has(key) || M.swAt.has(key)) {
      rr(ctx, o.hover.cx * CELL + 1, o.hover.cy * CELL + 1, CELL - 2, CELL - 2, 8);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  // construcción: rejilla suave, casilla y alcance
  if (o.placing) {
    ctx.strokeStyle = 'rgba(58,36,19,0.16)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, H); }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(W, y * CELL + 0.5); }
    ctx.stroke();
    if (o.hover) {
      const x = o.hover.cx * CELL + 20, y = o.hover.cy * CELL + 20, pp = o.placingP || [0, 0, 0];
      rr(ctx, o.hover.cx * CELL + 2, o.hover.cy * CELL + 2, CELL - 4, CELL - 4, 8);
      ctx.fillStyle = o.valid ? 'rgba(110,230,90,0.45)' : 'rgba(255,70,70,0.45)'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      const r = o.placing === 'backup' ? 0 : stats(o.placing, pp).range * G._m.range;
      if (r) rangeCircle(ctx, x, y, r, o.valid);
      ctx.save(); ctx.globalAlpha = 0.8; drawTower(ctx, o.placing, x, y, pp, 0, time, !o.valid); ctx.restore();
    }
  }

  // cursores de los compañeros
  for (const c of o.cursors || []) {
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.b && TOWERS[c.b]) { ctx.globalAlpha = 0.55; ctx.scale(0.7, 0.7); drawTower(ctx, c.b, 36, 36, null, 0, time, false); ctx.scale(1 / 0.7, 1 / 0.7); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 18); ctx.lineTo(5, 14); ctx.lineTo(12.5, 13); ctx.closePath(); ink(ctx, c.color, 2);
    ctx.font = `900 11px ${FONT}`; ctx.textAlign = 'left';
    const w = ctx.measureText(c.name).width;
    rr(ctx, 12, 16, w + 10, 16, 6); ink(ctx, c.color, 1.6);
    ctx.fillStyle = INK; ctx.fillText(c.name, 17, 28);
    ctx.restore();
  }
}

/** Miniatura de un mapa para el selector de la sala. */
export function drawMapThumb(cv, mi) {
  const c = cv.getContext('2d'), M = MAPS[mi];
  c.drawImage(bgs[mi] || (bgs[mi] = buildBg(mi)), 0, 0, cv.width, cv.height);
  const k = cv.width / W;
  c.save(); c.scale(k, k); c.lineJoin = 'round';
  for (const z of M.zones) { c.fillStyle = z.t === 'heat' ? '#ff7a2a' : '#3f9be0'; c.fillRect(z.x0 * CELL, z.y0 * CELL, (z.x1 - z.x0 + 1) * CELL, (z.y1 - z.y0 + 1) * CELL); }
  M.obs.forEach((ob, i) => c.drawImage(obstacleSprite(M.skin, i % 2, false), ob[0] * CELL - 10, ob[1] * CELL - 10, 60, 60));
  for (const [x, y] of M.pads) { star(c, x * CELL + 20, y * CELL + 20, 22, 10, 5, -Math.PI / 2); c.fillStyle = '#ffd23f'; c.fill(); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); }
  for (const t of M.traps) { c.beginPath(); c.arc(t.x * CELL + 20, t.y * CELL + 20, 16, 0, TAU); c.fillStyle = t.t === 'bomb' ? '#e8443a' : '#b97a3a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); }
  for (const f of M.forks) { c.beginPath(); c.arc(f.cell[0] * CELL + 20, f.cell[1] * CELL + 20, 20, 0, TAU); c.fillStyle = '#ffe14a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); }
  c.drawImage(denSprite(mi), M.bcx - 120, M.bcy - 120, 240, 240);
  c.restore();
}
