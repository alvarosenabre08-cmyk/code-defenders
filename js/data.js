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
// Cada torre tiene 3 ramas de 3 niveles (estilo Bloons TD6):
//   · Solo se pueden mejorar 2 ramas de la misma torre.
//   · Solo una de ellas puede llegar al nivel 3.
// Cada mejora es una función que modifica las estadísticas (s) de la torre.
export const TOWER_KEYS = ['firewall', 'gc', 'thread', 'linter', 'debugger', 'docker', 'balancer', 'backup'];
export const MAX_TIER = 3;
const up = (n, c, d, m) => ({ n, c, d, m });

export const TOWERS = {
  firewall: {
    name: 'Firewall', color: '#ff6a3d', cost: 100,
    desc: 'Ataque directo de alta cadencia contra el enemigo más avanzado.',
    base: { range: 130, dmg: 9, rate: 0.18, targets: 1, burn: 0, burnT: 0, splash: 0, crit: 0, critM: 1, heavy: 1 },
    paths: [
      { name: 'Packet Filter', color: '#ffd23f', ups: [
        up('Reglas optimizadas', 70, 'Dispara un 33% más rápido.', (s) => { s.rate *= 0.75; }),
        up('Doble puerto', 220, 'Dispara a 2 enemigos a la vez.', (s) => { s.targets = 2; }),
        up('Deep Packet Inspection', 900, 'Ametralladora: 3 objetivos y cadencia brutal.', (s) => { s.rate *= 0.45; s.targets = 3; s.dmg *= 1.3; }),
      ] },
      { name: 'Incendio', color: '#ff2a1a', ups: [
        up('Reglas endurecidas', 90, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Thermal Throttling', 250, 'Quema: 6 de daño/s durante 3 s.', (s) => { s.burn = 6; s.burnT = 3; }),
        up('Firewall Ígneo', 950, 'Lanzallamas: daño en área y quemadura fuerte.', (s) => { s.splash = 45; s.burn = 18; s.dmg *= 1.4; }),
      ] },
      { name: 'Zero Trust', color: '#3fb8ff', ups: [
        up('Puertos extendidos', 60, '+25% de alcance.', (s) => { s.range *= 1.25; }),
        up('Blacklist', 200, 'x2 de daño contra jefes, Leaks y Branches.', (s) => { s.heavy = 2; }),
        up('Zero Trust', 850, '25% de crítico x4 y aún más alcance.', (s) => { s.crit = 0.25; s.critM = 4; s.range *= 1.2; }),
      ] },
    ],
  },
  gc: {
    name: 'Garbage Collector', color: '#7dff5a', cost: 175,
    desc: 'Daño en área y ralentiza a todo lo que alcanza.',
    base: { range: 115, dmg: 16, rate: 1.1, splash: 55, slow: 0.4, slowT: 1.6, targets: 1, vuln: 0, finalizer: 0, pulse: 0 },
    paths: [
      { name: 'Mark & Sweep', color: '#b6ff3f', ups: [
        up('Barrido amplio', 100, '+35% de radio de explosión.', (s) => { s.splash *= 1.35; }),
        up('Pausa larga', 250, 'Ralentiza un 60% durante más tiempo.', (s) => { s.slow = 0.6; s.slowT = 2.5; }),
        up('Stop-the-World', 1100, 'Cada 8 s congela 1,5 s a TODOS los enemigos en su alcance.', (s) => { s.pulse = 8; }),
      ] },
      { name: 'Generacional', color: '#ff9d00', ups: [
        up('Young Gen', 120, '+60% de daño.', (s) => { s.dmg *= 1.6; }),
        up('Old Gen', 300, 'Más rápido y +30% de daño.', (s) => { s.rate *= 0.7; s.dmg *= 1.3; }),
        up('G1 Collector', 1200, 'Lanza 3 bombas a la vez.', (s) => { s.targets = 3; s.dmg *= 1.5; }),
      ] },
      { name: 'Weak References', color: '#c77dff', ups: [
        up('Soft References', 80, '+20% de alcance.', (s) => { s.range *= 1.2; }),
        up('Weak Ref', 260, 'Marca enemigos: reciben +25% de daño de todo durante 3 s.', (s) => { s.vuln = 0.25; }),
        up('Finalizer', 1000, 'Marca más fuerte y los marcados EXPLOTAN al morir.', (s) => { s.vuln = 0.35; s.finalizer = 1; }),
      ] },
    ],
  },
  thread: {
    name: 'Thread Factory', color: '#ffd23f', cost: 200,
    desc: 'Genera Threads que bloquean enemigos cuerpo a cuerpo. Colócala cerca del camino.',
    base: { range: 120, units: 3, uhp: 70, udmg: 8, urate: 0.6, respawn: 6, ghostBlock: 0, uslow: 0, shoot: 0, sdmg: 0, srate: 1, big: 0 },
    paths: [
      { name: 'Thread Pool', color: '#fff36b', ups: [
        up('Pool ampliado', 120, '+1 thread.', (s) => { s.units += 1; }),
        up('Respawn rápido', 280, '+1 thread y reaparecen el doble de rápido.', (s) => { s.units += 1; s.respawn *= 0.5; }),
        up('ForkJoinPool', 1000, '+3 threads más resistentes.', (s) => { s.units += 3; s.uhp *= 1.3; }),
      ] },
      { name: 'Heavy Threads', color: '#ff6a3d', ups: [
        up('Threads robustos', 110, '+60% de vida.', (s) => { s.uhp *= 1.6; }),
        up('Threads armados', 300, 'x2,2 de daño.', (s) => { s.udmg *= 2.2; }),
        up('Daemon Thread', 1100, 'Menos threads pero GIGANTES: x5 vida, x3 daño.', (s) => { s.units = Math.max(2, Math.ceil(s.units / 2)); s.uhp *= 5; s.udmg *= 3; s.big = 1; }),
      ] },
      { name: 'Async', color: '#3fffe0', ups: [
        up('Null checks', 100, 'Los threads pueden bloquear NullPointerExceptions.', (s) => { s.ghostBlock = 1; }),
        up('Timeouts', 260, 'Los enemigos bloqueados atacan un 50% más lento.', (s) => { s.uslow = 0.5; }),
        up('Virtual Threads', 950, 'La fábrica también dispara rayos a distancia.', (s) => { s.shoot = 1; s.sdmg = 30; s.srate = 0.5; s.range *= 1.2; }),
      ] },
    ],
  },
  linter: {
    name: 'Linter / Optimizer', color: '#c77dff', cost: 150,
    desc: 'Soporte: las torres cercanas hacen más daño y disparan más rápido.',
    base: { range: 100, buff: 0.25, rbuff: 0, rateBuff: 0, disc: 0, shoot: 0, sdmg: 0, srate: 1, aslow: 0 },
    paths: [
      { name: 'Strict Mode', color: '#ff3fa4', ups: [
        up('Reglas estrictas', 90, '+10% más de daño a las torres cercanas.', (s) => { s.buff += 0.1; }),
        up('Code Style', 220, '+15% de alcance a las torres cercanas.', (s) => { s.rbuff = 0.15; }),
        up('Code Review', 900, '+30% más de daño (total +65%).', (s) => { s.buff += 0.3; }),
      ] },
      { name: 'Static Analysis', color: '#3fb8ff', ups: [
        up('Análisis rápido', 100, 'Las torres cercanas disparan un 15% más rápido.', (s) => { s.rateBuff = 0.15; }),
        up('Análisis global', 200, '+40% de radio del aura.', (s) => { s.range *= 1.4; }),
        up('CI Pipeline', 950, 'Las torres cercanas disparan un 45% más rápido.', (s) => { s.rateBuff = 0.45; }),
      ] },
      { name: 'Refactor', color: '#5aff7d', ups: [
        up('Autofix', 80, 'El Linter también dispara.', (s) => { s.shoot = 1; s.sdmg = 8; s.srate = 0.6; }),
        up('Deprecation', 220, 'Ralentiza un 25% a los enemigos en su aura.', (s) => { s.aslow = 0.25; }),
        up('Prettier', 800, 'Las mejoras de las torres cercanas cuestan un 25% menos.', (s) => { s.disc = 0.25; }),
      ] },
    ],
  },
  debugger: {
    name: 'Debugger', color: '#ff3fa4', cost: 250,
    desc: 'Francotirador: un disparo enorme al enemigo con más vida (jefes primero).',
    base: { range: 330, dmg: 130, rate: 2.2, targets: 1, splash: 0, stun: 0, slow: 0, slowT: 0, heavy: 1, mark: 0 },
    paths: [
      { name: 'Breakpoint', color: '#ff2a6a', ups: [
        up('Breakpoint', 150, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Conditional Breakpoint', 400, '+40% de daño y aturde 0,6 s.', (s) => { s.dmg *= 1.4; s.stun = 0.6; }),
        up('Core Dump', 1500, 'Disparo devastador (x3) y x2 contra jefes.', (s) => { s.dmg *= 3; s.heavy = 2; }),
      ] },
      { name: 'Step Over', color: '#ffd23f', ups: [
        up('Step Over', 120, 'Dispara un 33% más rápido.', (s) => { s.rate *= 0.75; }),
        up('Step Into', 350, 'Dispara aún más rápido.', (s) => { s.rate *= 0.7; }),
        up('Hot Reload', 1300, 'Semiautomático y 2 objetivos a la vez.', (s) => { s.rate *= 0.5; s.targets = 2; }),
      ] },
      { name: 'Stack Trace', color: '#7dff5a', ups: [
        up('Stack Trace', 140, 'El disparo explota en área.', (s) => { s.splash = 40; }),
        up('Heap Dump', 380, 'Explosión más grande que ralentiza.', (s) => { s.splash = 60; s.slow = 0.4; s.slowT = 2; }),
        up('Heap Analyzer', 1200, 'Cada 6 s marca al enemigo más fuerte: recibe x2 de daño de todo.', (s) => { s.mark = 1; }),
      ] },
    ],
  },
  docker: {
    name: 'Docker Container', color: '#3fb8ff', cost: 225,
    desc: 'Trampa de zona: daño continuo y cada pocos segundos frena en seco a todo lo que tenga dentro.',
    base: { range: 75, dps: 14, stun: 2, cycle: 6, slow: 0, vuln: 0, execute: 0 },
    paths: [
      { name: 'Orquestación', color: '#6be0ff', ups: [
        up('Contenedor grande', 120, '+25% de zona.', (s) => { s.range *= 1.25; }),
        up('Restart policy', 300, 'Congela 1 s más.', (s) => { s.stun += 1; }),
        up('Kubernetes', 1200, 'Congela cada 3 s en vez de cada 6 y zona más grande.', (s) => { s.cycle = 3; s.range *= 1.15; }),
      ] },
      { name: 'Resource Limits', color: '#ff3f5a', ups: [
        up('CPU limit', 130, '+60% de daño.', (s) => { s.dps *= 1.6; }),
        up('Memory limit', 320, '+70% de daño.', (s) => { s.dps *= 1.7; }),
        up('OOM Killer', 1300, 'Elimina al instante a enemigos normales con menos del 25% de vida.', (s) => { s.execute = 0.25; s.dps *= 1.3; }),
      ] },
      { name: 'Volúmenes', color: '#5affc8', ups: [
        up('Volumen', 100, 'Ralentiza un 30% dentro de la zona.', (s) => { s.slow = 0.3; }),
        up('Bind mount', 250, 'Ralentiza un 50% dentro de la zona.', (s) => { s.slow = 0.5; }),
        up('Sandbox', 1000, 'Los enemigos dentro reciben +30% de daño de todo.', (s) => { s.vuln = 0.3; }),
      ] },
    ],
  },
  balancer: {
    name: 'Load Balancer', color: '#3fffe0', cost: 225,
    desc: 'Rayo en cadena que rebota entre varios enemigos.',
    base: { range: 140, dmg: 24, rate: 0.9, hops: 3, hopR: 95, fall: 0.75, chains: 1, slow: 0, stun: 0 },
    paths: [
      { name: 'Round Robin', color: '#9dfff0', ups: [
        up('Más nodos', 120, '+1 rebote.', (s) => { s.hops += 1; }),
        up('Cluster', 300, '+2 rebotes y saltos más largos.', (s) => { s.hops += 2; s.hopR *= 1.2; }),
        up('Service Mesh', 1100, '+5 rebotes y casi no pierde fuerza.', (s) => { s.hops += 5; s.fall = 0.92; }),
      ] },
      { name: 'Overload', color: '#ffe66b', ups: [
        up('Sobrecarga', 130, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Pico de tráfico', 330, '+60% de daño.', (s) => { s.dmg *= 1.6; }),
        up('Tormenta de rayos', 1250, 'Lanza 3 cadenas a la vez.', (s) => { s.chains = 3; s.dmg *= 1.2; }),
      ] },
      { name: 'Throttling', color: '#c77dff', ups: [
        up('Rate limit', 100, 'El rayo ralentiza un 30%.', (s) => { s.slow = 0.3; }),
        up('Backpressure', 280, 'El rayo aturde 0,25 s.', (s) => { s.stun = 0.25; }),
        up('Circuit Breaker', 1000, 'Aturde 0,8 s, más alcance y más rápido.', (s) => { s.stun = 0.8; s.range *= 1.25; s.rate *= 0.8; }),
      ] },
    ],
  },
  backup: {
    name: 'Backup Unit', color: '#e8f1ff', cost: 150, extra: 40,
    desc: 'Genera CPU pasivamente cada 5 s. Cada Backup extra cuesta 40 más.',
    base: { income: 12, period: 5, waveBonus: 0, interest: 0, heal: 0 },
    paths: [
      { name: 'Incremental', color: '#ffffff', ups: [
        up('Backup diario', 100, '+50% de CPU generada.', (s) => { s.income *= 1.5; }),
        up('Backup horario', 250, '+60% de CPU generada.', (s) => { s.income *= 1.6; }),
        up('Cloud Backup', 900, 'x2,5 de CPU generada.', (s) => { s.income *= 2.5; }),
      ] },
      { name: 'Inversión', color: '#ffe66b', ups: [
        up('Bonus de oleada', 90, '+25 CPU al acabar cada oleada.', (s) => { s.waveBonus = 25; }),
        up('Intereses', 250, '+3% de la CPU guardada al acabar cada oleada (máx. 150).', (s) => { s.interest = 0.03; }),
        up('Fondo de inversión', 900, '+8% de intereses (máx. 400) y +80 por oleada.', (s) => { s.interest = 0.08; s.waveBonus = 80; }),
      ] },
      { name: 'Snapshot', color: '#5aff7d', ups: [
        up('Snapshot', 80, 'Repara +1 de vida del servidor por oleada.', (s) => { s.heal = 1; }),
        up('RAID', 220, 'Repara +3 de vida por oleada.', (s) => { s.heal = 3; }),
        up('Disaster Recovery', 800, 'Repara +6 de vida por oleada.', (s) => { s.heal = 6; }),
      ] },
    ],
  },
};

const statCache = new Map();
/** Estadísticas de una torre de tipo k con niveles de rama p = [a, b, c]. */
export function stats(k, p) {
  const key = k + p.join('');
  let s = statCache.get(key);
  if (s) return s;
  const d = TOWERS[k];
  s = { ...d.base };
  d.paths.forEach((P, i) => { for (let j = 0; j < p[i]; j++) P.ups[j].m(s); });
  statCache.set(key, s);
  return s;
}

/** '' si la rama i se puede mejorar; si no, el motivo. */
export function pathLock(p, i) {
  if (p[i] >= MAX_TIER) return 'Rama al máximo';
  if (p[i] === 0 && p.filter((x) => x > 0).length >= 2) return 'Solo se pueden usar 2 ramas';
  if (p[i] === MAX_TIER - 1 && p.some((x, j) => j !== i && x >= MAX_TIER)) return 'Solo una rama puede llegar a nivel 3';
  return '';
}

/** Color de "skin" de la torre: el de su rama dominante a partir de nivel 2. */
export function skin(k, p) {
  let dom = -1, best = 0;
  p.forEach((v, i) => { if (v > best) { best = v; dom = i; } });
  const base = TOWERS[k].color;
  return { dom, tier: best, main: best >= 2 ? TOWERS[k].paths[dom].color : base, accent: dom >= 0 ? TOWERS[k].paths[dom].color : base };
}

// ---------- Enemigos ----------
export const ENEMY_KEYS = ['bug', 'leak', 'npe', 'ddos', 'boss', 'branch'];
export const ENEMIES = {
  bug: { name: 'Bug', color: '#ff5a5a', hp: 30, sp: 55, rw: 5, dmg: 1, r: 9, atk: 5 },
  leak: { name: 'Memory Leak', color: '#5affc8', hp: 95, sp: 34, rw: 11, dmg: 3, r: 13, atk: 8, regen: 0.03, heavy: true },
  npe: { name: 'NullPointerException', color: '#d08bff', hp: 50, sp: 85, rw: 8, dmg: 2, r: 9, atk: 0, ghost: true },
  ddos: { name: 'DDoS Packet', color: '#ffffff', hp: 13, sp: 105, rw: 2, dmg: 1, r: 6, atk: 3 },
  boss: { name: 'Merge Conflict', color: '#ffcc00', hp: 1600, sp: 22, rw: 120, dmg: 30, r: 24, atk: 30, boss: true, heavy: true, split: 2 },
  branch: { name: 'Conflict Branch', color: '#ff9d00', hp: 260, sp: 42, rw: 20, dmg: 6, r: 13, atk: 10, heavy: true },
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
