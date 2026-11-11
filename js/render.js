// ============================================================
//  Code Defenders — dibujo en Canvas 2D (todo vectorial, sin imágenes)
// ============================================================
import { W, H, CELL, COLS, ROWS, PTS, BASE, TOWERS, ENEMIES, ENEMY_KEYS, pathPos, START_LIFE } from './data.js';
import { towerRange, soldierD } from './sim.js';

const TAU = Math.PI * 2;
let bg = null;
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
function pathLine(ctx) {
  ctx.beginPath();
  PTS.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
}

function buildBg() {
  bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const c = bg.getContext('2d');
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#070b18'); g.addColorStop(1, '#0d0718');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // rejilla
  c.strokeStyle = 'rgba(0,240,255,0.07)'; c.lineWidth = 1; c.beginPath();
  for (let x = 0; x <= COLS; x++) { c.moveTo(x * CELL + 0.5, 0); c.lineTo(x * CELL + 0.5, H); }
  for (let y = 0; y <= ROWS; y++) { c.moveTo(0, y * CELL + 0.5); c.lineTo(W, y * CELL + 0.5); }
  c.stroke();
  // "pistas de circuito" decorativas
  c.fillStyle = 'rgba(0,240,255,0.10)';
  for (let i = 0; i < 70; i++) {
    const x = ((i * 7919) % COLS) * CELL, y = ((i * 104729) % ROWS) * CELL;
    c.fillRect(x - 2, y - 2, 4, 4);
  }
  // ruta
  c.lineJoin = 'round'; c.lineCap = 'butt';
  pathLine(c); c.strokeStyle = 'rgba(0,240,255,0.18)'; c.lineWidth = 42; c.stroke();
  pathLine(c); c.strokeStyle = '#00f0ff'; c.lineWidth = 36; c.stroke();
  pathLine(c); c.strokeStyle = '#0a1224'; c.lineWidth = 32; c.stroke();
  // entrada
  c.fillStyle = '#ff3fa4'; c.font = 'bold 11px monospace'; c.textAlign = 'left';
  c.fillText('>> INCOMING', 6, PTS[0].y - 26);
}

// ---------- torres ----------
export function drawTower(ctx, k, x, y, l, ang, time, off) {
  const col = off ? '#566' : TOWERS[k].color;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#0b1020';
  switch (k) {
    case 'firewall':
      poly(ctx, 0, 0, 15, 6, TAU / 12); ctx.fill(); neon(ctx, col);
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(19, -4); ctx.moveTo(2, 4); ctx.lineTo(19, 4); neon(ctx, col, 2.5);
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fillStyle = col; ctx.fill();
      break;
    case 'gc': {
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill(); neon(ctx, col);
      const r = time * 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(0, 0, 9, r + i * TAU / 3, r + i * TAU / 3 + 1.4); neon(ctx, col, 2.5);
      }
      break;
    }
    case 'thread':
      ctx.beginPath(); ctx.rect(-14, -14, 28, 28); ctx.fill(); neon(ctx, col);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 8, -8); ctx.lineTo(i * 8 + Math.sin(time * 4 + i) * 2, 8); neon(ctx, col, 2);
      }
      break;
    case 'linter': {
      poly(ctx, 0, 0, 16, 4, 0); ctx.fill(); neon(ctx, col);
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-2, 5); ctx.lineTo(7, -5); neon(ctx, col, 2.5);
      break;
    }
    case 'debugger':
      poly(ctx, 0, 0, 14, 3, ang); ctx.fill(); neon(ctx, col);
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(26, 0); neon(ctx, col, 3);
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fillStyle = col; ctx.fill();
      break;
    case 'docker':
      ctx.beginPath(); ctx.rect(-16, -11, 32, 22); ctx.fill(); neon(ctx, col);
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) { ctx.moveTo(i * 6, -7); ctx.lineTo(i * 6, 7); }
      neon(ctx, col, 1.5);
      break;
    case 'balancer':
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); neon(ctx, col);
      for (let i = 0; i < 3; i++) {
        const a = time * 0.8 + i * TAU / 3, px = Math.cos(a) * 15, py = Math.sin(a) * 15;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(px, py); neon(ctx, col, 1.5);
        ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fillStyle = col; ctx.fill();
      }
      break;
    case 'backup':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(0, 9 - i * 9, 14, 5, 0, 0, TAU); ctx.fillStyle = '#0b1020'; ctx.fill(); neon(ctx, col, 1.8);
      }
      break;
  }
  ctx.restore();
  // nivel
  ctx.fillStyle = off ? '#566' : '#fff';
  for (let i = 0; i < l; i++) ctx.fillRect(x - l * 3 + i * 6 + 1, y + 16, 4, 3);
}

// ---------- enemigos ----------
function drawEnemy(ctx, e, x, y, time) {
  const def = ENEMIES[e.k], col = def.color, r = def.r;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0b1020';
  switch (e.k) {
    case 'bug': {
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        const w = Math.sin(time * 14 + e.i + i) * 2;
        ctx.moveTo(-r - 4, i * 5 + w); ctx.lineTo(r + 4, i * 5 - w);
      }
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, r - 2, r, 0, 0, TAU); ctx.fill(); neon(ctx, col, 2);
      break;
    }
    case 'leak': {
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * TAU, rr = r + Math.sin(a * 3 + time * 3 + e.i) * 2.5;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
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
    case 'boss':
    case 'branch': {
      poly(ctx, 0, 0, r, 8, time * 0.6); ctx.fill(); neon(ctx, col, 3);
      poly(ctx, 0, 0, r * 0.6, 4, -time); neon(ctx, '#ff3f5a', 2);
      ctx.fillStyle = col; ctx.font = `bold ${e.k === 'boss' ? 11 : 8}px monospace`; ctx.textAlign = 'center';
      ctx.fillText(e.k === 'boss' ? '<<<>>>' : '<<<', 0, 4);
      break;
    }
  }
  ctx.restore();
  if (e.st > 0) { ctx.strokeStyle = '#3fb8ff'; ctx.lineWidth = 2; ctx.strokeRect(x - r - 4, y - r - 4, r * 2 + 8, r * 2 + 8); }
  else if (e.sl > 0) { ctx.strokeStyle = 'rgba(125,255,90,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.stroke(); }
  if (e.h < e.m) {
    const w = Math.max(16, r * 2.2);
    ctx.fillStyle = '#300'; ctx.fillRect(x - w / 2, y - r - 9, w, 3);
    ctx.fillStyle = def.boss ? '#ffcc00' : '#5aff7d'; ctx.fillRect(x - w / 2, y - r - 9, w * Math.max(0, e.h / e.m), 3);
  }
}

// ---------- efectos ----------
const DUR = { b: 0.09, s: 0.35, a: 0.4, c: 0.25, d: 0.6, p: 0.4, m: 1.1, h: 0.5, w: 2.2 };
export function addFx(list, now) {
  for (const f of list) fxs.push({ f, t0: now, dur: DUR[f[0]] || 0.3 });
  if (fxs.length > 400) fxs.splice(0, fxs.length - 400);
}
function drawFx(ctx, now) {
  for (let i = fxs.length - 1; i >= 0; i--) {
    const { f, t0, dur } = fxs[i], p = (now - t0) / dur;
    if (p >= 1) { fxs.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = 1 - p;
    switch (f[0]) {
      case 'b':
        ctx.beginPath(); ctx.moveTo(f[1], f[2]); ctx.lineTo(f[3], f[4]); neon(ctx, TOWERS.firewall.color, 1.5);
        break;
      case 's':
        ctx.beginPath(); ctx.moveTo(f[1], f[2]); ctx.lineTo(f[3], f[4]); neon(ctx, TOWERS.debugger.color, 4 * (1 - p) + 1);
        ctx.beginPath(); ctx.arc(f[3], f[4], 6 + p * 18, 0, TAU); neon(ctx, '#fff', 1.5);
        break;
      case 'a':
        ctx.beginPath(); ctx.moveTo(f[1], f[2]); ctx.lineTo(f[3], f[4]); neon(ctx, TOWERS.gc.color, 1.5);
        ctx.beginPath(); ctx.arc(f[3], f[4], f[5] * (0.3 + 0.7 * p), 0, TAU);
        ctx.fillStyle = 'rgba(125,255,90,0.15)'; ctx.fill(); neon(ctx, TOWERS.gc.color, 2);
        break;
      case 'c': {
        const q = f[1];
        ctx.beginPath();
        for (let j = 0; j < q.length; j += 2) {
          if (j === 0) { ctx.moveTo(q[0], q[1]); continue; }
          const mx = (q[j - 2] + q[j]) / 2 + Math.sin(j * 9.1 + t0 * 50) * 8, my = (q[j - 1] + q[j + 1]) / 2 + Math.cos(j * 7.3 + t0 * 50) * 8;
          ctx.lineTo(mx, my); ctx.lineTo(q[j], q[j + 1]);
        }
        neon(ctx, TOWERS.balancer.color, 2);
        break;
      }
      case 'd':
        ctx.beginPath(); ctx.rect(f[1] - f[3] * (1 - p * 0.3), f[2] - f[3] * (1 - p * 0.3), f[3] * 2 * (1 - p * 0.3), f[3] * 2 * (1 - p * 0.3));
        neon(ctx, TOWERS.docker.color, 3);
        break;
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
        ctx.fillStyle = '#ffe66b'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
        ctx.fillText('+' + f[3] + ' CPU', f[1], f[2] - p * 26);
        break;
      case 'h':
        ctx.globalAlpha = (1 - p) * 0.35; ctx.fillStyle = '#ff2040'; ctx.fillRect(0, 0, W, H);
        break;
      case 'w':
        ctx.globalAlpha = Math.min(1, (1 - p) * 2);
        ctx.fillStyle = '#00f0ff'; ctx.font = 'bold 42px monospace'; ctx.textAlign = 'center';
        ctx.fillText(f[1] % 5 === 0 ? `OLEADA ${f[1]} — MERGE CONFLICT` : `OLEADA ${f[1]}`, W / 2, 110);
        break;
    }
    ctx.restore();
  }
}

// ---------- escena completa ----------
/**
 * G: estado del juego. o: { time, prev (Map id->d de la instantánea anterior), alpha,
 *    hover {cx,cy}, placing (tipo), movingId, valid, selId, cursors [{x,y,name,color,b}] }
 */
export function render(ctx, G, o) {
  if (!bg) buildBg();
  const time = o.time;
  ctx.drawImage(bg, 0, 0);

  // flujo animado sobre la ruta
  ctx.save();
  pathLine(ctx); ctx.setLineDash([6, 22]); ctx.lineDashOffset = -time * 40;
  ctx.strokeStyle = 'rgba(0,240,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  // servidor principal
  const lifeF = G.life / START_LIFE, bc = lifeF > 0.5 ? '#00f0ff' : lifeF > 0.25 ? '#ffb03f' : '#ff3f5a';
  ctx.beginPath(); ctx.rect(BASE.x + 6, BASE.y + 6, BASE.w - 12, BASE.h - 12); ctx.fillStyle = '#0b1020'; ctx.fill(); neon(ctx, bc, 3);
  for (let i = 0; i < 5; i++) {
    const yy = BASE.y + 16 + i * 19;
    ctx.strokeStyle = bc; ctx.lineWidth = 1; ctx.strokeRect(BASE.x + 14, yy, BASE.w - 28, 13);
    ctx.fillStyle = Math.sin(time * 5 + i * 1.7) > 0 ? bc : '#123'; ctx.fillRect(BASE.x + 18, yy + 4, 5, 5);
    ctx.fillStyle = Math.sin(time * 3 + i) > 0.3 ? '#5aff7d' : '#123'; ctx.fillRect(BASE.x + 27, yy + 4, 5, 5);
  }
  ctx.fillStyle = bc; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
  ctx.fillText('PROD', BASE.x + BASE.w / 2, BASE.y + BASE.h + 6);

  // zonas y auras (debajo de todo)
  for (const t of G.T) {
    const x = t.x * CELL + 20, y = t.y * CELL + 20;
    if (t.k === 'docker') {
      const r = towerRange('docker', t.l);
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = 'rgba(63,184,255,0.07)'; ctx.fill();
      ctx.setLineDash([8, 8]); ctx.lineDashOffset = time * 20; ctx.strokeStyle = 'rgba(63,184,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    } else if (t.k === 'linter') {
      ctx.beginPath(); ctx.arc(x, y, towerRange('linter', t.l) * (0.92 + 0.08 * Math.sin(time * 2)), 0, TAU);
      ctx.strokeStyle = 'rgba(199,125,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  // Threads (soldados)
  for (const t of G.T) {
    if (t.k !== 'thread' || t._rd < 0) continue;
    const uhp = TOWERS.thread.uhp * (1 + 0.6 * (t.l - 1));
    t.s.forEach((s, j) => {
      if (s.h <= 0) return;
      const p = pathPos(soldierD(t, j)), y = p.y + (j % 2 ? 7 : -7);
      poly(ctx, p.x, y, 6, 3, time * (s.e ? 10 : 1) + j); ctx.fillStyle = '#0b1020'; ctx.fill(); neon(ctx, TOWERS.thread.color, 2);
      if (s.h < uhp) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(p.x - 6, y - 11, 12 * (s.h / uhp), 2); }
    });
  }

  // enemigos (interpolados si somos cliente)
  for (const e of G.E) {
    let d = e.d;
    if (o.prev && o.prev.has(e.i)) { const pd = o.prev.get(e.i); d = pd + (e.d - pd) * o.alpha; }
    const p = pathPos(d);
    drawEnemy(ctx, e, p.x + ((e.i * 37) % 11) - 5, p.y + ((e.i * 53) % 11) - 5, time);
  }

  // torres
  for (const t of G.T) {
    const x = t.x * CELL + 20, y = t.y * CELL + 20, off = t.dz > 0 || o.movingId === t.i;
    if (o.selId === t.i) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(t.x * CELL + 1.5, t.y * CELL + 1.5, CELL - 3, CELL - 3);
      const r = towerRange(t.k, t.l);
      if (r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke(); }
    }
    if (t._b > 0) { ctx.beginPath(); ctx.arc(x, y, 19, 0, TAU); ctx.strokeStyle = 'rgba(199,125,255,0.6)'; ctx.lineWidth = 1; ctx.stroke(); }
    drawTower(ctx, t.k, x, y, t.l, t.a, time, off);
    if (t.dz > 0) { ctx.fillStyle = '#fff'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText('REBOOT', x, y - 20); }
    if (t.k === 'thread' && t._rd < 0) { ctx.fillStyle = '#ff3f5a'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText('SIN RUTA', x, y - 20); }
  }

  drawFx(ctx, time);

  // fantasma de construcción
  if (o.placing && o.hover) {
    const x = o.hover.cx * CELL + 20, y = o.hover.cy * CELL + 20, lvl = o.placingLvl || 1;
    ctx.fillStyle = o.valid ? 'rgba(90,255,125,0.18)' : 'rgba(255,63,90,0.25)';
    ctx.fillRect(o.hover.cx * CELL, o.hover.cy * CELL, CELL, CELL);
    const r = towerRange(o.placing, lvl);
    if (r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = o.valid ? 'rgba(255,255,255,0.5)' : 'rgba(255,63,90,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.save(); ctx.globalAlpha = 0.7; drawTower(ctx, o.placing, x, y, lvl, 0, time, !o.valid); ctx.restore();
  }

  // cursores de los compañeros
  for (const c of o.cursors || []) {
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.b && TOWERS[c.b]) { ctx.globalAlpha = 0.5; drawTower(ctx, c.b, 26, 26, 0, 0, time, false); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(5, 13); ctx.lineTo(12, 12); ctx.closePath();
    ctx.fillStyle = c.color; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
    const w = ctx.measureText(c.name).width;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(12, 16, w + 8, 15);
    ctx.fillStyle = c.color; ctx.fillText(c.name, 16, 27);
    ctx.restore();
  }
}
