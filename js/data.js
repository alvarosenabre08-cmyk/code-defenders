// ============================================================
//  Code Defenders — datos del juego (mapa, torres, enemigos, oleadas)
//  Para equilibrar el juego basta con tocar los números de este archivo.
// ============================================================

export const W = 1280, H = 640, CELL = 40, COLS = 32, ROWS = 16;
export const MAX_WAVE = 20;
export const START_MONEY = 450, START_LIFE = 100;
export const PLAYER_COLORS = ['#00f0ff', '#ff3fa4', '#b6ff3f', '#ffb03f'];

// ---------- Ruta (en celdas) ----------
const WP = [[-1, 2], [5, 2], [5, 12], [11, 12], [11, 4], [18, 4], [18, 13], [25, 13], [25, 7], [30, 7]];
export const PTS = WP.map(([x, y]) => ({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 }));

const SEG = [];
let total = 0;
for (let i = 0; i < PTS.length - 1; i++) {
  const a = PTS[i], b = PTS[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
  SEG.push({ a, b, len, s: total });
  total += len;
}
export const PATH_LEN = total;

/** Posición en píxeles a una distancia d del inicio de la ruta. */
export function pathPos(d) {
  if (d <= 0) return { x: PTS[0].x, y: PTS[0].y };
  if (d >= PATH_LEN) return { x: PTS[PTS.length - 1].x, y: PTS[PTS.length - 1].y };
  for (const s of SEG) {
    if (d <= s.s + s.len) {
      const f = (d - s.s) / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f };
    }
  }
  return { x: 0, y: 0 };
}

/** Punto de la ruta más cercano a (x,y): devuelve distancia recorrida y separación. */
export function nearestD(x, y) {
  let best = 0, bd = Infinity;
  for (let d = 30; d < PATH_LEN - 50; d += 4) {
    const p = pathPos(d), q = Math.hypot(p.x - x, p.y - y);
    if (q < bd) { bd = q; best = d; }
  }
  return { d: best, dist: bd };
}

// Celdas donde NO se puede construir (ruta + servidor)
export const BLOCKED = new Set();
for (let i = 0; i < WP.length - 1; i++) {
  const [x0, y0] = WP[i], [x1, y1] = WP[i + 1];
  const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  let x = x0, y = y0;
  for (;;) {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) BLOCKED.add(y * COLS + x);
    if (x === x1 && y === y1) break;
    x += dx; y += dy;
  }
}
export const BASE = { x: 30 * CELL, y: 6 * CELL, w: 2 * CELL, h: 3 * CELL };
for (let y = 6; y <= 8; y++) for (let x = 30; x <= 31; x++) BLOCKED.add(y * COLS + x);

// ---------- Torres ----------
// Nivel 1-3. Cada nivel: +60% daño y +8% alcance. Mejora = 80% del coste base × nivel.
export const TOWER_KEYS = ['firewall', 'gc', 'thread', 'linter', 'debugger', 'docker', 'balancer', 'backup'];
export const TOWERS = {
  firewall: { name: 'Firewall', color: '#ff6a3d', cost: 100, range: 130, dmg: 9, rate: 0.18,
    desc: 'Ataque directo de alta cadencia contra el enemigo más avanzado.' },
  gc: { name: 'Garbage Collector', color: '#7dff5a', cost: 175, range: 115, dmg: 16, rate: 1.1, splash: 55, slow: 0.4, slowT: 1.6,
    desc: 'Daño en área y ralentiza un 40% a todo lo que alcanza.' },
  thread: { name: 'Thread Factory', color: '#ffd23f', cost: 200, range: 120, units: [3, 4, 5], uhp: 70, udmg: 8, urate: 0.6, respawn: 6,
    desc: 'Genera Threads que bajan a la ruta y bloquean enemigos cuerpo a cuerpo. Colócala cerca del camino.' },
  linter: { name: 'Linter / Optimizer', color: '#c77dff', cost: 150, range: 100, buff: [0.25, 0.35, 0.45],
    desc: 'Soporte: las torres adyacentes hacen más daño y disparan más rápido. No ataca.' },
  debugger: { name: 'Debugger', color: '#ff3fa4', cost: 250, range: 330, dmg: 130, rate: 2.2,
    desc: 'Francotirador: un disparo enorme al enemigo con más vida (jefes primero).' },
  docker: { name: 'Docker Container', color: '#3fb8ff', cost: 225, range: 75, dps: 14, stun: [2, 2.5, 3], cycle: 6,
    desc: 'Trampa de zona: daño continuo y cada 6 s frena en seco a todo lo que tenga dentro.' },
  balancer: { name: 'Load Balancer', color: '#3fffe0', cost: 225, range: 140, dmg: 24, rate: 0.9, hops: [3, 4, 5], hopR: 95, fall: 0.75,
    desc: 'Rayo en cadena que rebota entre varios enemigos.' },
  backup: { name: 'Backup Unit', color: '#e8f1ff', cost: 150, income: [12, 20, 30], period: 5, extra: 40,
    desc: 'Genera CPU pasivamente cada 5 s. Cada Backup extra cuesta 40 más.' },
};

// ---------- Enemigos ----------
export const ENEMY_KEYS = ['bug', 'leak', 'npe', 'ddos', 'boss', 'branch'];
export const ENEMIES = {
  bug: { name: 'Bug', color: '#ff5a5a', hp: 30, sp: 55, rw: 5, dmg: 1, r: 9, atk: 5 },
  leak: { name: 'Memory Leak', color: '#5affc8', hp: 95, sp: 34, rw: 11, dmg: 3, r: 13, atk: 8, regen: 0.03 },
  npe: { name: 'NullPointerException', color: '#d08bff', hp: 50, sp: 85, rw: 8, dmg: 2, r: 9, atk: 0, ghost: true },
  ddos: { name: 'DDoS Packet', color: '#ffffff', hp: 13, sp: 105, rw: 2, dmg: 1, r: 6, atk: 3 },
  boss: { name: 'Merge Conflict', color: '#ffcc00', hp: 1600, sp: 22, rw: 120, dmg: 30, r: 24, atk: 30, boss: true, split: 2 },
  branch: { name: 'Conflict Branch', color: '#ff9d00', hp: 260, sp: 42, rw: 20, dmg: 6, r: 13, atk: 10 },
};

// ---------- Oleadas ----------
export const hpMult = (w) => 1 + 0.3 * (w - 1) + 0.07 * (w - 1) ** 2;
export const waveBonus = (w) => 40 + 8 * w;

const cache = {};
/** Lista ordenada de apariciones {t, type} de la oleada w (determinista). */
export function genWave(w) {
  if (cache[w]) return cache[w];
  const out = [];
  const add = (type, n, gap, start) => { for (let i = 0; i < n; i++) out.push({ t: start + i * gap, type }); };
  add('bug', 8 + 2 * w, Math.max(0.35, 0.9 - w * 0.03), 0);
  if (w >= 3) add('leak', Math.floor(w * 0.9) - 1, 1.6, 3);
  if (w >= 4) add('npe', w - 1, 1.1, 6);
  if (w >= 6) add('ddos', 8 + w * 2, 0.16, 10);
  if (w >= 11) add('ddos', 8 + w * 2, 0.16, 18);
  if (w % 5 === 0) add('boss', w >= 20 ? 2 : 1, 8, 12);
  out.sort((a, b) => a.t - b.t);
  return (cache[w] = out);
}
