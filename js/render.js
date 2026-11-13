// ============================================================
//  Code Defenders — dibujo en Canvas 2D (todo vectorial, sin imágenes)
// ============================================================
import { W, H, CELL, COLS, ROWS, MAPS, TOWERS, ENEMIES, ENEMY_KEYS, pathPos, stats, skin } from './data.js';
import { tStats, tRange, soldierD, epos } from './sim.js';

const TAU = Math.PI * 2;
const bgs = {};
const fxs = [];

// ---------- helpers ----------
function neon(ctx, color, w = 2) {
  const a = ctx.globalAlpha;
  ctx.strokeStyle = color;
  ctx.globalAlpha = a * 0.22; ctx.lineWidth = w + 6; ctx.stroke();
  ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke();
}
function poly(ctx, x, y, r, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
function routeLine(ctx, R) {
  ctx.beginPath();
  R.pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
}
function label(ctx, text, x, y, color, size = 9) {
  ctx.font = `bold ${size}px monospace`; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function buildBg(mi) {
  const M = MAPS[mi], th = M.theme;
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const c = bg.getContext('2d');
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, th.bg0); g.addColorStop(1, th.bg1);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // rejilla
  c.globalAlpha = 0.08; c.strokeStyle = th.a; c.lineWidth = 1; c.beginPath();
  for (let x = 0; x <= COLS; x++) { c.moveTo(x * CELL + 0.5, 0); c.lineTo(x * CELL + 0.5, H); }
  for (let y = 0; y <= ROWS; y++) { c.moveTo(0, y * CELL + 0.5); c.lineTo(W, y * CELL + 0.5); }
  c.stroke();
  // decoración distinta por mapa
  c.globalAlpha = 0.12; c.fillStyle = th.a;
  for (let i = 0; i < 70; i++) {
    const x = ((i * 7919 + mi * 13) % COLS) * CELL, y = ((i * 104729 + mi * 7) % ROWS) * CELL;
    if (mi === 1) c.fillRect(x - 8, y - 1, 16, 2); else if (mi === 2) { poly(c, x, y, 4, 4, 0); c.fill(); } else c.fillRect(x - 2, y - 2, 4, 4);
  }
  c.globalAlpha = 1;
  // rutas
  c.lineJoin = 'round'; c.lineCap = 'butt';
  c.globalAlpha = 0.18; for (const R of M.R) { routeLine(c, R); c.strokeStyle = th.a; c.lineWidth = 42; c.stroke(); }
  c.globalAlpha = 1;
  for (const R of M.R) { routeLine(c, R); c.strokeStyle = th.a; c.lineWidth = 36; c.stroke(); }
  for (const R of M.R) { routeLine(c, R); c.strokeStyle = '#0a1224'; c.lineWidth = 32; c.stroke(); }
  // zonas (base estática)
  for (const z of M.zones) {
    c.fillStyle = z.t === 'heat' ? 'rgba(255,70,30,0.22)' : 'rgba(60,170,255,0.22)';
    c.fillRect(z.x0 * CELL + 4, z.y0 * CELL + 4, (z.x1 - z.x0 + 1) * CELL - 8, (z.y1 - z.y0 + 1) * CELL - 8);
  }
  // entradas
  c.font = 'bold 11px monospace';
  for (const en of M.entries) {
    const p = M.R[en.r].pts[0];
    c.fillStyle = th.b;
    if (p.x < 0) { c.textAlign = 'left'; c.fillText('>> INCOMING', 6, p.y - 26); }
    else if (p.x > W) { c.textAlign = 'right'; c.fillText('INCOMING <<', W - 6, p.y - 26); }
    else { c.textAlign = 'left'; c.fillText('vv INCOMING', p.x + 26, 14); }
  }
  return bg;
}

// ---------- torres ----------
export function drawTower(ctx, k, x, y, p, ang, time, off) {
  p = p || [0, 0, 0];
  const sk = skin(k, p), total = p[0] + p[1] + p[2];
  const col = off ? '#566' : sk.main, acc = off ? '#566' : sk.accent;
  if (sk.tier >= 3 && !off) drawUltimate(ctx, x, y, sk.dom, acc, time, sk.tier);
  ctx.save();
  ctx.translate(x, y);
  const sc = 1 + total * 0.03;
  ctx.scale(sc, sc);
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#0b1020';
  switch (k) {
    case 'firewall':
      poly(ctx, 0, 0, 15, 6, TAU / 12); ctx.fill(); neon(ctx, col);
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(19, -4); ctx.moveTo(2, 4); ctx.lineTo(19, 4);
      if (p[1] >= 3 || p[2] >= 3) { ctx.moveTo(2, 0); ctx.lineTo(22, 0); }
      if (p[0] >= 3) { ctx.moveTo(2, 0); ctx.lineTo(28, 0); }
      neon(ctx, col, p[0] >= 3 ? 3.5 : 2.5);
      if (p[2] >= 4) { ctx.beginPath(); ctx.arc(22, 0, 4 + Math.sin(time * 20) * 1.5, 0, TAU); ctx.fillStyle = '#ff9d00'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fillStyle = col; ctx.fill();
      break;
    case 'gc': {
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill(); neon(ctx, col);
      const r = time * 1.5, n = p[2] >= 3 ? 5 : 3;
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(0, 0, 9, r + i * TAU / n, r + i * TAU / n + (n > 3 ? 0.8 : 1.4)); neon(ctx, col, 2.5); }
      if (p[0] >= 3) { ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
      break;
    }
    case 'thread':
      ctx.beginPath(); ctx.rect(-14, -14, 28, 28); ctx.fill(); neon(ctx, col);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 8, -8); ctx.lineTo(i * 8 + Math.sin(time * 4 + i) * 2, 8); neon(ctx, col, p[0] >= 3 ? 3.5 : 2); }
      break;
    case 'linter':
      poly(ctx, 0, 0, 16, 4, 0); ctx.fill(); neon(ctx, col);
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-2, 5); ctx.lineTo(7, -5); neon(ctx, col, 2.5);
      break;
    case 'debugger':
      poly(ctx, 0, 0, 14, 3, ang); ctx.fill(); neon(ctx, col);
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(26 + p[0] * 2, 0);
      if (p[2] >= 3) { ctx.moveTo(4, -5); ctx.lineTo(24, -5); }
      neon(ctx, col, 3);
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fillStyle = col; ctx.fill();
      break;
    case 'docker':
      ctx.beginPath(); ctx.rect(-16, -11, 32, 22); ctx.fill(); neon(ctx, col);
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) { ctx.moveTo(i * 6, -7); ctx.lineTo(i * 6, 7); }
      neon(ctx, col, 1.5);
      break;
    case 'balancer': {
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); neon(ctx, col);
      const n = p[2] >= 3 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = time * 0.8 + i * TAU / n, px = Math.cos(a) * 15, py = Math.sin(a) * 15;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(px, py); neon(ctx, col, 1.5);
        ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fillStyle = col; ctx.fill();
      }
      break;
    }
    case 'backup':
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 9 - i * 9, 14, 5, 0, 0, TAU); ctx.fillStyle = '#0b1020'; ctx.fill(); neon(ctx, col, 1.8); }
      break;
  }
  ctx.restore();
  // detalles de rama
  if (sk.tier >= 1) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fillStyle = acc; ctx.fill(); }
  if (sk.tier >= 2) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = acc; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(12, 10); ctx.lineTo(16, 14); ctx.lineTo(10, 14); ctx.stroke(); }
    ctx.restore();
  }
  // marcas de tier por rama (3 columnas de hasta 5)
  if (total && !off) {
    TOWERS[k].paths.forEach((P, i) => {
      ctx.fillStyle = P.color;
      for (let j = 0; j < p[i]; j++) ctx.fillRect(x - 10 + i * 7, y + 23 - j * 3, 5, 2);
    });
  }
}

/** Aspecto de Tier 3+: una forma distinta por rama. En Tier 5 se añade una corona. */
function drawUltimate(ctx, x, y, dom, c, time, tier) {
  ctx.save();
  ctx.translate(x, y);
  if (tier >= 5) {
    ctx.save(); ctx.rotate(-time * 0.7);
    ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(28, -4); ctx.lineTo(34, 0); ctx.lineTo(28, 4); ctx.fillStyle = c; ctx.fill(); }
    ctx.restore();
  }
  const big = tier >= 4 ? 1.12 : 1;
  ctx.scale(big, big);
  if (dom === 0) {
    ctx.rotate(time * 1.2);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const r = i % 2 ? 19 : 24, a = (i / 16) * TAU; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); neon(ctx, c, 1.5);
  } else if (dom === 1) {
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 28);
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 4);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    poly(ctx, 0, 0, 22, 6, time * 0.4); neon(ctx, c, 1.5);
  } else {
    ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.strokeStyle = c; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    const n = tier >= 4 ? 4 : 3;
    for (let i = 0; i < n; i++) { const a = time * 2 + i * TAU / n; poly(ctx, Math.cos(a) * 21, Math.sin(a) * 21, 4, 4, a); ctx.fillStyle = c; ctx.fill(); }
  }
  ctx.restore();
}

// ---------- enemigos ----------
function drawEnemy(ctx, e, x, y, time, M) {
  const def = ENEMIES[e.k], col = def.color, r = def.r;
  ctx.save();
  if (def.fly) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x + 7, y + 13, r, r * 0.45, 0, 0, TAU); ctx.fill(); }
  ctx.translate(x, y);
  if (def.camo) ctx.globalAlpha = e.rv > 0 ? 0.95 : 0.42 + 0.12 * Math.sin(time * 6 + e.i);
  ctx.fillStyle = '#0b1020';
  switch (e.k) {
    case 'bug': {
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) { const w = Math.sin(time * 14 + e.i + i) * 2; ctx.moveTo(-r - 4, i * 5 + w); ctx.lineTo(r + 4, i * 5 - w); }
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, r - 2, r, 0, 0, TAU); ctx.fill(); neon(ctx, col, 2);
      break;
    }
    case 'leak': {
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU, rr = r + Math.sin(a * 3 + time * 3 + e.i) * 2.5; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = 'rgba(90,255,200,0.18)'; ctx.fill(); neon(ctx, col, 2);
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fillStyle = col; ctx.fill();
      break;
    }
    case 'npe':
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 9 + e.i);
      ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); neon(ctx, col, 2);
      ctx.beginPath(); ctx.moveTo(-r, r); ctx.lineTo(r, -r); neon(ctx, col, 1.5);
      break;
    case 'ddos':
      poly(ctx, 0, 0, r, 3, time * 6 + e.i); ctx.fillStyle = col; ctx.fill();
      break;
    case 'rootkit':
      // ofuscado: rombo "glitch" con ojo tachado
      poly(ctx, Math.sin(time * 23 + e.i) > 0.8 ? 3 : 0, 0, r + 1, 4, 0); ctx.fill();
      ctx.setLineDash([4, 3]); neon(ctx, col, 2); ctx.setLineDash([]);
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, TAU); ctx.moveTo(-5, 5); ctx.lineTo(5, -5); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      break;
    case 'ransom':
      // blindado: placa doble con candado
      ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); ctx.fillStyle = '#1b2233'; ctx.fill(); neon(ctx, col, 3.5);
      ctx.beginPath(); ctx.rect(-r + 4, -r + 4, r * 2 - 8, r * 2 - 8); ctx.strokeStyle = '#6b7890'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -2, 3.5, Math.PI, 0); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(-5, -2, 10, 7);
      break;
    case 'zeroday': {
      // volador: dardo apuntando al servidor
      ctx.rotate(Math.atan2(M.bcy - y, M.bcx - x));
      ctx.beginPath(); ctx.moveTo(r + 3, 0); ctx.lineTo(-r, -r); ctx.lineTo(-r + 5, 0); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill(); neon(ctx, col, 2);
      ctx.fillStyle = `rgba(255,200,80,${0.5 + 0.5 * Math.sin(time * 30)})`; ctx.fillRect(-r - 6, -1.5, 6, 3);
      break;
    }
    case 'boss':
    case 'branch':
      poly(ctx, 0, 0, r, 8, time * 0.6); ctx.fill(); neon(ctx, col, 3);
      poly(ctx, 0, 0, r * 0.6, 4, -time); neon(ctx, '#ff3f5a', 2);
      ctx.fillStyle = col; ctx.font = `bold ${e.k === 'boss' ? 11 : 8}px monospace`; ctx.textAlign = 'center';
      ctx.fillText(e.k === 'boss' ? '<<<>>>' : '<<<', 0, 4);
      break;
  }
  ctx.restore();
  // estados
  if (e.wt > 0) { ctx.strokeStyle = '#4fc3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 2, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.fillStyle = '#4fc3ff'; ctx.beginPath(); ctx.arc(x, y + r + 5, 2, 0, TAU); ctx.fill(); }
  if (e.oi > 0) { ctx.strokeStyle = '#d6b23a'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i <= 12; i++) { const a = (i / 12) * TAU, rr = r + 5 + (i % 2 ? 2 : -1); ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.stroke(); }
  if (e.bt > 0) { ctx.fillStyle = `rgba(255,${120 + Math.floor(Math.sin(time * 30 + e.i) * 60)},40,0.9)`; ctx.beginPath(); ctx.arc(x + Math.sin(time * 9 + e.i) * r * 0.6, y - r * 0.7, 3, 0, TAU); ctx.fill(); }
  if (e.vt > 0) { ctx.strokeStyle = e.vu >= 1 ? '#7dff5a' : '#c77dff'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, r + 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (e.st > 0) { ctx.strokeStyle = '#3fb8ff'; ctx.lineWidth = 2; ctx.strokeRect(x - r - 4, y - r - 4, r * 2 + 8, r * 2 + 8); }
  else if (e.sl > 0 && e.wt <= 0) { ctx.strokeStyle = 'rgba(125,255,90,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.stroke(); }
  if (e.h < e.m) {
    const w = Math.max(16, r * 2.2);
    ctx.fillStyle = '#300'; ctx.fillRect(x - w / 2, y - r - 9, w, 3);
    ctx.fillStyle = def.boss ? '#ffcc00' : def.armor ? '#c0c8d8' : '#5aff7d'; ctx.fillRect(x - w / 2, y - r - 9, w * Math.max(0, e.h / e.m), 3);
  }
}

// ---------- efectos ----------
const DUR = { b: 0.09, s: 0.35, a: 0.4, c: 0.25, d: 0.6, p: 0.4, m: 1.1, h: 0.5, w: 2.4, f: 0.35, x: 0.5, k: 1.2, l: 1.5, g: 0.5, z: 0.45, r: 0.4 };
export function addFx(list, now) {
  for (const f of list) fxs.push({ f, t0: now, dur: f[0] === 't' ? f[5] || 1 : DUR[f[0]] || 0.3 });
  if (fxs.length > 400) fxs.splice(0, fxs.length - 400);
}
export function clearFx() { fxs.length = 0; }
function drawFx(ctx, now) {
  for (let i = fxs.length - 1; i >= 0; i--) {
    const { f, t0, dur } = fxs[i], p = (now - t0) / dur;
    if (p >= 1 || p < 0) { fxs.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = 1 - p;
    switch (f[0]) {
      case 'b':
        ctx.beginPath(); ctx.moveTo(f[1], f[2]); ctx.lineTo(f[3], f[4]); neon(ctx, f[5] || TOWERS.firewall.color, 1.5);
        break;
      case 's':
        ctx.beginPath(); ctx.moveTo(f[1], f[2]); ctx.lineTo(f[3], f[4]); neon(ctx, f[5] || TOWERS.debugger.color, 4 * (1 - p) + 1);
        ctx.beginPath(); ctx.arc(f[3], f[4], 6 + p * 18, 0, TAU); neon(ctx, '#fff', 1.5);
        break;
      case 'a':
        ctx.beginPath(); ctx.moveTo(f[1], f[2]); ctx.lineTo(f[3], f[4]); neon(ctx, f[6] || TOWERS.gc.color, 1.5);
        ctx.beginPath(); ctx.arc(f[3], f[4], f[5] * (0.3 + 0.7 * p), 0, TAU);
        ctx.globalAlpha = (1 - p) * 0.3; ctx.fillStyle = f[6] || TOWERS.gc.color; ctx.fill(); ctx.globalAlpha = 1 - p; neon(ctx, f[6] || TOWERS.gc.color, 2);
        break;
      case 'c': {
        const q = f[1];
        ctx.beginPath();
        for (let j = 0; j < q.length; j += 2) {
          if (j === 0) { ctx.moveTo(q[0], q[1]); continue; }
          const mx = (q[j - 2] + q[j]) / 2 + Math.sin(j * 9.1 + t0 * 50) * 8, my = (q[j - 1] + q[j + 1]) / 2 + Math.cos(j * 7.3 + t0 * 50) * 8;
          ctx.lineTo(mx, my); ctx.lineTo(q[j], q[j + 1]);
        }
        neon(ctx, f[2] || TOWERS.balancer.color, 2);
        break;
      }
      case 'd': {
        const k = 1 - p * 0.3;
        ctx.beginPath(); ctx.rect(f[1] - f[3] * k, f[2] - f[3] * k, f[3] * 2 * k, f[3] * 2 * k); neon(ctx, f[4] || TOWERS.docker.color, 3);
        break;
      }
      case 'p': {
        const col = ENEMIES[ENEMY_KEYS[f[3]]].color;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        for (let j = 0; j < 6; j++) {
          const a = j * TAU / 6 + f[1];
          ctx.moveTo(f[1] + Math.cos(a) * (4 + p * 8), f[2] + Math.sin(a) * (4 + p * 8));
          ctx.lineTo(f[1] + Math.cos(a) * (8 + p * 16), f[2] + Math.sin(a) * (8 + p * 16));
        }
        ctx.stroke();
        break;
      }
      case 'm':
        label(ctx, '+' + f[3] + ' CPU', f[1], f[2] - p * 26, '#ffe66b', 13);
        break;
      case 'f': {
        const g = ctx.createRadialGradient(f[1], f[2], 2, f[1], f[2], f[3]);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, f[4]); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = (1 - p) * 0.7; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f[1], f[2], f[3] * (0.5 + 0.5 * p), 0, TAU); ctx.fill();
        break;
      }
      case 'x':
        label(ctx, 'CRIT!', f[1], f[2] - 16 - p * 14, '#ffffff', 14);
        break;
      case 'r':
        label(ctx, 'BLINDAJE', f[1], f[2] - 14 - p * 10, '#c0c8d8', 9);
        break;
      case 'z':
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath();
        for (let j = 0; j < 5; j++) { const a = j * 1.3 + t0 * 40; ctx.moveTo(f[1], f[2]); ctx.lineTo(f[1] + Math.cos(a) * (10 + p * 14), f[2] + Math.sin(a) * (10 + p * 14)); }
        ctx.stroke();
        label(ctx, 'CORTOCIRCUITO', f[1], f[2] - 18 - p * 10, '#4fc3ff', 9);
        break;
      case 'k':
        ctx.strokeStyle = '#7dff5a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f[1], f[2], 26 - p * 12, 0, TAU); ctx.moveTo(f[1] - 30, f[2]); ctx.lineTo(f[1] + 30, f[2]); ctx.moveTo(f[1], f[2] - 30); ctx.lineTo(f[1], f[2] + 30); ctx.stroke();
        break;
      case 'l':
        ctx.globalAlpha = 1; label(ctx, '+' + f[1] + ' VIDA', W / 2, 230 - p * 20, '#5aff7d', 20);
        break;
      case 't':
        ctx.globalAlpha = Math.min(1, (1 - p) * 2.5); label(ctx, f[3], f[1], f[2] - p * 16, f[4] || '#fff', dur > 1.2 ? 22 : 11);
        break;
      case 'g':
        ctx.globalAlpha = (1 - p) * 0.3; ctx.fillStyle = f[1] || '#fff'; ctx.fillRect(0, 0, W, H);
        break;
      case 'h':
        ctx.globalAlpha = (1 - p) * 0.35; ctx.fillStyle = '#ff2040'; ctx.fillRect(0, 0, W, H);
        break;
      case 'w':
        ctx.globalAlpha = Math.min(1, (1 - p) * 2);
        label(ctx, f[1] % 5 === 0 ? `OLEADA ${f[1]} — MERGE CONFLICT` : `OLEADA ${f[1]}`, W / 2, 110, '#ffffff', 40);
        break;
    }
    ctx.restore();
  }
}

// ---------- estructuras del mapa ----------
function drawStructures(ctx, G, M, time, o) {
  const th = M.theme;
  // zonas animadas
  for (const z of M.zones) {
    for (let cy = z.y0; cy <= z.y1; cy++) for (let cx = z.x0; cx <= z.x1; cx++) {
      const x = cx * CELL + 20, y = cy * CELL + 20, ph = time * 3 + cx * 1.7 + cy * 2.3;
      if (z.t === 'heat') {
        ctx.fillStyle = `rgba(255,${90 + Math.floor(60 * Math.sin(ph))},30,${0.35 + 0.2 * Math.sin(ph * 1.3)})`;
        ctx.beginPath(); ctx.moveTo(x - 7, y + 9); ctx.quadraticCurveTo(x - 9, y - 2, x, y - 11 - 3 * Math.sin(ph)); ctx.quadraticCurveTo(x + 9, y - 2, x + 7, y + 9); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(80,190,255,${0.45 + 0.25 * Math.sin(ph)})`;
        const dy = ((time * 14 + cx * 11) % 20) - 10;
        ctx.beginPath(); ctx.arc(x - 6, y + dy, 2.5, 0, TAU); ctx.arc(x + 7, y - dy * 0.6, 2, 0, TAU); ctx.fill();
      }
    }
    const lx = (z.x0 + z.x1 + 1) * CELL / 2, ly = z.y0 === z.y1 ? z.y0 * CELL - 5 : (z.y0 + z.y1 + 1) * CELL / 2;
    ctx.save(); ctx.translate(lx, ly); if (z.y0 !== z.y1) { ctx.translate(-26, 0); ctx.rotate(-Math.PI / 2); }
    label(ctx, z.t === 'heat' ? 'SOBRECALENTAMIENTO' : 'FUGA DE REFRIGERANTE', 0, 0, z.t === 'heat' ? '#ff8a3d' : '#4fc3ff', 9);
    ctx.restore();
  }
  // racks de GPU
  for (const [cx, cy] of M.pads) {
    const x = cx * CELL + 20, y = cy * CELL + 20;
    poly(ctx, x, y, 18, 6, 0); ctx.fillStyle = 'rgba(255,230,107,0.10)'; ctx.fill();
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 3 + cx); neon(ctx, '#ffe66b', 1.5); ctx.globalAlpha = 1;
    label(ctx, 'GPU +30%', x, y + 30, '#ffe66b', 8);
  }
  // código legacy (obstáculos)
  M.obs.forEach((ob, i) => {
    if (G.ob[i]) return;
    const x = ob[0] * CELL, y = ob[1] * CELL, pad = M.padAt.has(ob[1] * COLS + ob[0]);
    ctx.fillStyle = '#141a2b'; ctx.fillRect(x + 4, y + 4, 32, 32);
    ctx.strokeStyle = pad ? '#ffe66b' : '#5b6785'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 4.5, y + 4.5, 31, 31);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 5, y + 5, 30, 30); ctx.clip();
    ctx.strokeStyle = 'rgba(120,135,170,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let d = -40; d < 40; d += 7) { ctx.moveTo(x + d, y + 40); ctx.lineTo(x + d + 40, y); }
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#8fa0c8'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('{…}', x + 20, y + 24);
    if (o.selOb === i) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, 36, 36); }
  });
  // trampas
  M.traps.forEach((tr, i) => {
    const st = G.tr[i] || { c: 0, a: 0 }, x = tr.x * CELL + 20, y = tr.y * CELL + 20, ready = st.c <= 0;
    if (tr.t === 'bomb') {
      ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fillStyle = '#1a1206'; ctx.fill();
      ctx.globalAlpha = ready ? 0.7 + 0.3 * Math.sin(time * 5) : 0.4; neon(ctx, '#ffb03f', 2); ctx.globalAlpha = 1;
      ctx.fillStyle = ready ? '#ffb03f' : '#7a6030'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText(ready ? '!' : String(Math.ceil(st.c)), x, y + 5);
      label(ctx, 'BOMBA LÓGICA', x, y - 19, ready ? '#ffb03f' : '#7a6030', 8);
    } else {
      const active = st.a > 0;
      ctx.strokeStyle = active ? '#ffffff' : ready ? '#b6ff3f' : '#56633a'; ctx.lineWidth = 2;
      ctx.strokeRect(tr.x * CELL + 1, tr.y * CELL + 1, 38, 38);
      if (active) {
        ctx.fillStyle = `rgba(182,255,63,${0.35 + 0.25 * Math.sin(time * 12)})`; ctx.fillRect(tr.x * CELL + 2, tr.y * CELL + 2, 36, 36);
        ctx.strokeStyle = '#b6ff3f'; ctx.lineWidth = 3; ctx.beginPath();
        for (let d = -30; d < 40; d += 12) { ctx.moveTo(tr.x * CELL + d, tr.y * CELL + 38); ctx.lineTo(tr.x * CELL + d + 30, tr.y * CELL + 2); }
        ctx.save(); ctx.beginPath(); ctx.rect(tr.x * CELL + 2, tr.y * CELL + 2, 36, 36); ctx.clip(); ctx.stroke(); ctx.restore();
      } else {
        ctx.fillStyle = ready ? '#b6ff3f' : '#56633a'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
        ctx.fillText(ready ? '▮▮' : String(Math.ceil(st.c)), x, y + 4);
      }
      label(ctx, active ? 'CERRADO ' + Math.ceil(st.a) + 's' : 'MANTENIMIENTO', x, tr.y * CELL - 3, active ? '#fff' : ready ? '#b6ff3f' : '#56633a', 8);
    }
  });
  // routers (bifurcaciones)
  M.forks.forEach((f, i) => {
    const x = f.cell[0] * CELL + 20, y = f.cell[1] * CELL + 20, on = G.sw[i] ? f.alt : f.r;
    const a = pathPos(M, on, f.d), b = pathPos(M, on, f.d + 60), an = Math.atan2(b.y - a.y, b.x - a.x), ready = G.swc <= 0;
    ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fillStyle = '#0b1020'; ctx.fill(); neon(ctx, ready ? th.b : '#4a5a66', 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(an);
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(7, 0); ctx.moveTo(2, -6); ctx.lineTo(9, 0); ctx.lineTo(2, 6); ctx.strokeStyle = ready ? th.b : '#4a5a66'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    label(ctx, ready ? 'ROUTER' : 'ROUTER ' + Math.ceil(G.swc) + 's', x, y - 21, ready ? th.b : '#4a5a66', 8);
    // flechas sobre la rama activa
    ctx.fillStyle = th.b;
    for (let n = 1; n <= 3; n++) { const p = pathPos(M, on, f.d + 30 + n * 36 + ((time * 40) % 36)); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(an); ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.fill(); ctx.restore(); }
  });
  // puertos aún cerrados
  for (const en of M.entries) {
    if (en.from <= Math.max(1, G.w + (G.ic > 0 ? 1 : 0))) continue;
    const R = M.R[en.r], p0 = R.pts[0], p1 = R.pts[1];
    const x = Math.max(20, Math.min(W - 20, p0.x)), y = Math.max(20, Math.min(H - 20, p0.y));
    ctx.fillStyle = 'rgba(5,7,15,0.8)';
    const vert = p0.x === p1.x;
    if (vert) ctx.fillRect(x - 18, Math.min(y, y + 80 * Math.sign(p1.y - p0.y)) - (p1.y > p0.y ? 20 : -20), 36, 80); else ctx.fillRect(Math.min(x, x + 80 * Math.sign(p1.x - p0.x)), y - 18, 80, 36);
    ctx.strokeStyle = '#ff3f5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 14, y - 14); ctx.lineTo(x + 14, y + 14); ctx.moveTo(x + 14, y - 14); ctx.lineTo(x - 14, y + 14); ctx.stroke();
    label(ctx, `PUERTO CERRADO · abre en la oleada ${en.from}`, Math.max(150, Math.min(W - 150, x - (vert ? 150 : 0))), vert ? y + 4 : y - 26, '#ff3f5a', 10);
  }
}

// ---------- escena completa ----------
/**
 * G: estado del juego. o: { time, prev (Map id->d de la instantánea anterior), alpha,
 *    hover {cx,cy}, placing (tipo), placingP, movingId, valid, selId, selOb, cursors [{x,y,name,color,b}] }
 */
export function render(ctx, G, o) {
  const M = MAPS[G.map], th = M.theme, time = o.time;
  ctx.drawImage(bgs[G.map] || (bgs[G.map] = buildBg(G.map)), 0, 0);

  // flujo animado sobre las rutas en uso
  const used = new Set();
  for (const en of M.entries) {
    if (en.from > G.w + 1) continue;
    let r = en.r;
    M.forks.forEach((f, i) => { if (f.r === r && G.sw[i]) r = f.alt; });
    used.add(r);
  }
  ctx.save();
  ctx.setLineDash([6, 22]); ctx.lineDashOffset = -time * 40; ctx.globalAlpha = 0.35; ctx.strokeStyle = th.a; ctx.lineWidth = 2;
  for (const r of used) { routeLine(ctx, M.R[r]); ctx.stroke(); }
  ctx.restore();

  drawStructures(ctx, G, M, time, o);

  // servidor principal
  const lifeF = G.life / M.life, bc = lifeF > 0.5 ? th.a : lifeF > 0.25 ? '#ffb03f' : '#ff3f5a';
  ctx.beginPath(); ctx.rect(M.bx + 6, M.by + 6, M.bw - 12, M.bh - 12); ctx.fillStyle = '#0b1020'; ctx.fill(); neon(ctx, bc, 3);
  for (let i = 0; i < 5; i++) {
    const yy = M.by + 16 + i * 19;
    ctx.strokeStyle = bc; ctx.lineWidth = 1; ctx.strokeRect(M.bx + 14, yy, M.bw - 28, 13);
    ctx.fillStyle = Math.sin(time * 5 + i * 1.7) > 0 ? bc : '#123'; ctx.fillRect(M.bx + 18, yy + 4, 5, 5);
    ctx.fillStyle = Math.sin(time * 3 + i) > 0.3 ? '#5aff7d' : '#123'; ctx.fillRect(M.bx + 27, yy + 4, 5, 5);
  }
  label(ctx, 'PROD', M.bx + M.bw / 2, M.by + M.bh + 6, bc, 10);

  // zonas y auras (debajo de todo)
  for (const t of G.T) {
    const x = t.x * CELL + 20, y = t.y * CELL + 20;
    if (t.k === 'docker') {
      const r = tRange(G, t), c = skin(t.k, t.p).main;
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      ctx.globalAlpha = 0.07; ctx.fillStyle = c; ctx.fill();
      ctx.globalAlpha = 0.5; ctx.setLineDash([8, 8]); ctx.lineDashOffset = time * 20; ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    } else if (t.k === 'linter') {
      ctx.beginPath(); ctx.arc(x, y, tRange(G, t) * (0.96 + 0.04 * Math.sin(time * 2)), 0, TAU);
      ctx.strokeStyle = t.at > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(199,125,255,0.25)'; ctx.lineWidth = t.at > 0 ? 2.5 : 1.5; ctx.stroke();
    }
  }

  // Threads (soldados)
  for (const t of G.T) {
    if (t.k !== 'thread' || t._rd < 0) continue;
    const st = tStats(t), uhp = st.uhp * G._m.thread, ucol = t.at > 0 ? '#ffffff' : skin(t.k, t.p).main, ur = st.big ? 11 : 6;
    t.s.forEach((s, j) => {
      if (s.h <= 0) return;
      const p = pathPos(M, t._rt, soldierD(t, j)), y = p.y + (j % 2 ? 7 : -7);
      poly(ctx, p.x, y, ur, st.big ? 5 : 3, time * (s.e || s.f ? 10 : 1) + j); ctx.fillStyle = '#0b1020'; ctx.fill(); neon(ctx, ucol, 2);
      if (s.h < uhp) { ctx.fillStyle = ucol; ctx.fillRect(p.x - ur, y - ur - 5, ur * 2 * Math.min(1, s.h / uhp), 2); }
    });
  }

  // enemigos (interpolados si somos cliente); los voladores se dibujan al final
  const flyers = [];
  for (const e of G.E) {
    if (e.h <= 0) continue;
    let d = e.d;
    if (o.prev && o.prev.has(e.i)) { const pd = o.prev.get(e.i); d = pd + (e.d - pd) * o.alpha; }
    const p = epos(M, e.k, e.r, d);
    const x = p.x + ((e.i * 37) % 11) - 5, y = p.y + ((e.i * 53) % 11) - 5;
    if (ENEMIES[e.k].fly) flyers.push([e, x, y]); else drawEnemy(ctx, e, x, y, time, M);
  }

  // torres
  for (const t of G.T) {
    const x = t.x * CELL + 20, y = t.y * CELL + 20, off = t.dz > 0 || o.movingId === t.i, st = tStats(t);
    if (o.selId === t.i) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(t.x * CELL + 1.5, t.y * CELL + 1.5, CELL - 3, CELL - 3);
      const r = t.k === 'backup' ? 0 : tRange(G, t);
      if (r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke(); }
    }
    if (t._b > 0 || t._cf) { ctx.beginPath(); ctx.arc(x, y, 19, 0, TAU); ctx.strokeStyle = t._cf ? 'rgba(255,255,255,0.9)' : 'rgba(199,125,255,0.6)'; ctx.lineWidth = t._cf ? 2 : 1; ctx.stroke(); }
    if (t.at > 0 && t.k !== 'linter') { ctx.beginPath(); ctx.arc(x, y, 22 + 2 * Math.sin(time * 14), 0, TAU); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke(); }
    drawTower(ctx, t.k, x, y, t.p, t.a, time, off);
    if (st.ab && !off) {
      // indicador de habilidad: rombo brillante si está lista
      const ready = t.ac <= 0;
      poly(ctx, x + 15, y - 15, 5, 4, 0); ctx.fillStyle = ready ? (Math.sin(time * 6) > 0 ? '#ffffff' : '#ffe66b') : '#39425a'; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (t.dz > 0) label(ctx, 'REBOOT', x, y - 20, '#fff', 9);
    if (t.k === 'thread' && t._rd < 0) label(ctx, 'SIN RUTA', x, y - 20, '#ff3f5a', 9);
  }

  for (const [e, x, y] of flyers) drawEnemy(ctx, e, x, y, time, M);

  drawFx(ctx, time);

  // celda bajo el ratón con estructura
  if (o.hover && !o.placing) {
    const key = o.hover.cy * COLS + o.hover.cx, oi = M.obsAt.get(key);
    if ((oi !== undefined && !G.ob[oi]) || M.trapAt.has(key) || M.swAt.has(key)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.strokeRect(o.hover.cx * CELL + 1.5, o.hover.cy * CELL + 1.5, CELL - 3, CELL - 3); ctx.setLineDash([]);
    }
  }

  // fantasma de construcción
  if (o.placing && o.hover) {
    const x = o.hover.cx * CELL + 20, y = o.hover.cy * CELL + 20, pp = o.placingP || [0, 0, 0];
    ctx.fillStyle = o.valid ? 'rgba(90,255,125,0.18)' : 'rgba(255,63,90,0.25)';
    ctx.fillRect(o.hover.cx * CELL, o.hover.cy * CELL, CELL, CELL);
    const r = o.placing === 'backup' ? 0 : stats(o.placing, pp).range * G._m.range;
    if (r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = o.valid ? 'rgba(255,255,255,0.5)' : 'rgba(255,63,90,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.save(); ctx.globalAlpha = 0.7; drawTower(ctx, o.placing, x, y, pp, 0, time, !o.valid); ctx.restore();
  }

  // cursores de los compañeros
  for (const c of o.cursors || []) {
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.b && TOWERS[c.b]) { ctx.globalAlpha = 0.5; drawTower(ctx, c.b, 26, 26, null, 0, time, false); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(5, 13); ctx.lineTo(12, 12); ctx.closePath();
    ctx.fillStyle = c.color; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
    const w = ctx.measureText(c.name).width;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(12, 16, w + 8, 15);
    ctx.fillStyle = c.color; ctx.fillText(c.name, 16, 27);
    ctx.restore();
  }
}

/** Miniatura de un mapa para el selector de la sala. */
export function drawMapThumb(cv, mi) {
  const c = cv.getContext('2d'), M = MAPS[mi];
  c.drawImage(bgs[mi] || (bgs[mi] = buildBg(mi)), 0, 0, cv.width, cv.height);
  const k = cv.width / W;
  c.save(); c.scale(k, k);
  for (const ob of M.obs) { c.fillStyle = '#5b6785'; c.fillRect(ob[0] * CELL + 6, ob[1] * CELL + 6, 28, 28); }
  for (const [x, y] of M.pads) { c.fillStyle = '#ffe66b'; c.fillRect(x * CELL + 10, y * CELL + 10, 20, 20); }
  for (const t of M.traps) { c.fillStyle = t.t === 'bomb' ? '#ffb03f' : '#b6ff3f'; c.beginPath(); c.arc(t.x * CELL + 20, t.y * CELL + 20, 14, 0, TAU); c.fill(); }
  for (const f of M.forks) { c.fillStyle = M.theme.b; c.beginPath(); c.arc(f.cell[0] * CELL + 20, f.cell[1] * CELL + 20, 18, 0, TAU); c.fill(); }
  c.fillStyle = '#0b1020'; c.fillRect(M.bx + 4, M.by + 4, M.bw - 8, M.bh - 8);
  c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeRect(M.bx + 4, M.by + 4, M.bw - 8, M.bh - 8);
  c.restore();
}
