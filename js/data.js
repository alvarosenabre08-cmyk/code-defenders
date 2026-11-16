// ============================================================
//  Leones TD — datos del juego
//  (Las claves internas —firewall, gc, bug…— vienen de la versión anterior y no se muestran al jugador.)
//  Mapas, torres (3 ramas × 5 tiers), enemigos, cartas y oleadas.
//  Para equilibrar el juego basta con tocar los números de este archivo.
// ============================================================

export const W = 1280, H = 640, CELL = 40, COLS = 32, ROWS = 16;
export const PLAYER_COLORS = ['#00f0ff', '#ff3fa4', '#b6ff3f', '#ffb03f'];
export const PLAYER_COLOR_NAMES = ['cian', 'rosa', 'verde', 'naranja'];
export const SPEEDS = [1, 2, 4, 6];
export const MAX_TIER = 5;

// ============================================================
//  MAPAS
//  routes:  listas de puntos (en celdas). Los enemigos siguen una ruta.
//  entries: por qué ruta entran y desde qué oleada (w = peso del reparto).
//  forks:   cruce con una señal que los jugadores giran para desviar los barriles.
//  obs:     rocas, troncos o ruinas que estorban [x, y, coste de quitarlos].
//  zones:   tramos del camino: 'heat' (brasas / lava) o 'cool' (río).
//  traps:   'bomb' (dinamita) o 'gate' (puente levadizo).
//  pads:    tótems de poder: la torre construida encima hace +30% de daño.
// ============================================================
const MAP_DEFS = [
  {
    name: 'Sabana', diff: 'Fácil', tag: 'Llanura dorada', skin: 'sabana',
    desc: 'Un solo camino largo. Unas brasas que queman a los barriles, 2 cargas de dinamita y rocas que estorban en los mejores sitios.',
    theme: { a: '#ffd447', b: '#ff7a3d' },
    waves: 20, hp: 0.9, money: 500, life: 100, camoFrom: 8, armorFrom: 11, flyFrom: 13, flyMul: 0.6,
    routes: [[[-1, 2], [5, 2], [5, 12], [11, 12], [11, 4], [18, 4], [18, 13], [25, 13], [25, 7], [30, 7]]],
    entries: [{ r: 0, from: 1, w: 1 }],
    forks: [],
    base: { x: 30, y: 6, w: 2, h: 3 },
    obs: [[6, 3, 60], [6, 11, 80], [10, 11, 80], [8, 7, 100], [12, 5, 80], [17, 5, 80], [15, 8, 120], [19, 12, 80], [24, 12, 80], [22, 9, 100]],
    zones: [{ t: 'heat', x0: 11, y0: 6, x1: 11, y1: 10 }],
    traps: [{ t: 'bomb', x: 8, y: 11 }, { t: 'bomb', x: 21, y: 12 }],
    pads: [],
  },
  {
    name: 'Selva', diff: 'Medio', tag: 'El cruce del río', skin: 'selva',
    desc: 'Cruce con señal: decidid por qué rama ruedan los barriles. En la oleada 8 se abre una cueva. Puente levadizo, brasas y un río que los moja.',
    theme: { a: '#8be85a', b: '#ffd447' },
    waves: 25, hp: 1, money: 500, life: 100, camoFrom: 6, armorFrom: 9, flyFrom: 10, flyMul: 0.8,
    routes: [
      [[-1, 8], [9, 8], [9, 3], [20, 3], [20, 8], [25, 8], [25, 12], [30, 12]],
      [[-1, 8], [9, 8], [9, 13], [20, 13], [20, 8], [25, 8], [25, 12], [30, 12]],
      [[20, -1], [20, 8], [25, 8], [25, 12], [30, 12]],
    ],
    entries: [{ r: 0, from: 1, w: 2 }, { r: 2, from: 8, w: 1 }],
    forks: [{ r: 0, alt: 1, at: [9, 8], cell: [10, 8] }],
    base: { x: 30, y: 11, w: 2, h: 3 },
    obs: [[8, 7, 90], [8, 9, 90], [10, 6, 90], [10, 10, 90], [19, 9, 110], [21, 9, 110], [21, 6, 110], [24, 9, 130], [24, 11, 130], [26, 11, 130], [14, 4, 80], [14, 12, 80]],
    zones: [{ t: 'heat', x0: 12, y0: 3, x1: 17, y1: 3 }, { t: 'cool', x0: 12, y0: 13, x1: 17, y1: 13 }],
    traps: [{ t: 'gate', x: 23, y: 8 }, { t: 'bomb', x: 27, y: 11 }, { t: 'bomb', x: 4, y: 7 }],
    pads: [],
  },
  {
    name: 'Volcán', diff: 'Difícil', tag: 'Tierra de lava', skin: 'volcan',
    desc: 'La guarida está en el centro y atacan por dos frentes a la vez. Poco sitio, muchos barriles voladores y solo 75 vidas. Liberad los tótems de poder: +30% de daño.',
    theme: { a: '#ff8a4a', b: '#ffd447' },
    waves: 30, hp: 0.65, money: 650, life: 75, camoFrom: 6, armorFrom: 7, flyFrom: 7, flyMul: 1,
    routes: [
      [[-1, 2], [4, 2], [4, 13], [9, 13], [9, 5], [12, 5], [12, 8], [14, 8]],
      [[32, 13], [27, 13], [27, 2], [22, 2], [22, 10], [19, 10], [19, 8], [17, 8]],
    ],
    entries: [{ r: 0, from: 1, w: 1 }, { r: 1, from: 1, w: 1 }],
    forks: [],
    base: { x: 15, y: 7, w: 2, h: 3 },
    obs: [[7, 8, 220], [24, 7, 220], [11, 7, 220], [20, 9, 220],
      [5, 3, 90], [5, 7, 90], [8, 6, 100], [5, 12, 90], [8, 12, 90], [10, 6, 110], [13, 7, 120], [13, 9, 120],
      [18, 7, 120], [18, 9, 120], [21, 3, 90], [23, 5, 100], [26, 8, 90], [26, 12, 90], [21, 11, 100], [23, 11, 90]],
    zones: [{ t: 'heat', x0: 4, y0: 5, x1: 4, y1: 9 }, { t: 'heat', x0: 27, y0: 5, x1: 27, y1: 9 }],
    traps: [{ t: 'gate', x: 9, y: 9 }, { t: 'gate', x: 22, y: 6 }, { t: 'bomb', x: 10, y: 4 }, { t: 'bomb', x: 20, y: 11 }],
    pads: [[7, 8], [24, 7], [11, 7], [20, 9]],
  },
];

/** Posición en píxeles a una distancia d del inicio de la ruta r. */
export function pathPos(M, r, d) {
  const R = M.R[r];
  if (d <= 0) return { x: R.pts[0].x, y: R.pts[0].y };
  if (d >= R.len) { const p = R.pts[R.pts.length - 1]; return { x: p.x, y: p.y }; }
  for (const s of R.seg) {
    if (d <= s.s + s.len) {
      const f = (d - s.s) / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f };
    }
  }
  return { x: 0, y: 0 };
}

/** Punto de cualquier ruta más cercano a (x,y). */
export function nearestD(M, x, y) {
  let best = { r: 0, d: 0, dist: Infinity };
  M.R.forEach((R, r) => {
    for (let d = 30; d < R.len - 30; d += 4) {
      const p = pathPos(M, r, d), q = Math.hypot(p.x - x, p.y - y);
      if (q < best.dist) best = { r, d, dist: q };
    }
  });
  return best;
}

function dAt(M, r, [cx, cy]) {
  const tx = cx * CELL + 20, ty = cy * CELL + 20;
  for (let d = 0; d <= M.R[r].len; d += 2) {
    const p = pathPos(M, r, d);
    if (Math.hypot(p.x - tx, p.y - ty) <= 3) return d;
  }
  return -1;
}

function buildMap(def) {
  const M = { ...def };
  const key = (x, y) => y * COLS + x;
  M.R = def.routes.map((wp) => {
    const pts = wp.map(([x, y]) => ({ x: x * CELL + 20, y: y * CELL + 20 }));
    const seg = [];
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y);
      seg.push({ a, b, len: l, s: len });
      len += l;
    }
    return { pts, seg, len };
  });
  M.blocked = new Set();
  for (const wp of def.routes) {
    for (let i = 0; i < wp.length - 1; i++) {
      const [x0, y0] = wp[i], [x1, y1] = wp[i + 1];
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      let x = x0, y = y0;
      for (;;) {
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) M.blocked.add(key(x, y));
        if (x === x1 && y === y1) break;
        x += dx; y += dy;
      }
    }
  }
  const b = def.base;
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) M.blocked.add(key(x, y));
  M.bx = b.x * CELL; M.by = b.y * CELL; M.bw = b.w * CELL; M.bh = b.h * CELL;
  M.bcx = M.bx + M.bw / 2; M.bcy = M.by + M.bh / 2;
  M.flyLen = M.R.map((R) => Math.hypot(R.pts[0].x - M.bcx, R.pts[0].y - M.bcy) - 30);
  M.obsAt = new Map(def.obs.map((o, i) => [key(o[0], o[1]), i]));
  M.padAt = new Set(def.pads.map(([x, y]) => key(x, y)));
  M.trapAt = new Map(def.traps.map((t, i) => [key(t.x, t.y), i]));
  for (const t of def.traps) if (t.t === 'bomb') M.blocked.add(key(t.x, t.y));
  M.swAt = new Map(def.forks.map((f, i) => [key(f.cell[0], f.cell[1]), i]));
  for (const f of def.forks) M.blocked.add(key(f.cell[0], f.cell[1]));
  M.forks = def.forks.map((f) => ({ ...f, d: dAt(M, f.r, f.at) }));
  M.gateD = def.traps.map((t) => (t.t === 'gate' ? M.R.map((_, r) => dAt(M, r, [t.x, t.y])) : null));
  M.zoneAt = new Map();
  for (const z of def.zones) for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) M.zoneAt.set(key(x, y), z.t);
  return M;
}
export const MAPS = MAP_DEFS.map(buildMap);

// ============================================================
//  TORRES — 3 ramas × 5 tiers (reglas estilo Bloons TD6)
//   · Máximo 2 ramas por torre; la tercera queda bloqueada.
//   · Una rama principal hasta Tier 5; la secundaria, como mucho Tier 2.
//   · Solo puede existir UN Tier 5 de cada rama de cada tipo de torre en el mapa.
//  Rama 1 = poder bruto · Rama 2 = utilidad + habilidad activa (Tier 4) · Rama 3 = cadencia / efectos.
//  Tipos de daño: k normal · x explosivo · e eléctrico · a ácido  (el blindaje frena k y e).
// ============================================================
// Las 8 primeras son las torres con las que empieza toda cuenta; el resto sale en cofres.
// (No cambies el orden: las partidas en curso guardan las torres por su posición en esta lista.)
export const TOWER_KEYS = ['firewall', 'gc', 'thread', 'linter', 'debugger', 'docker', 'balancer', 'backup',
  'sling', 'fisher', 'brawler', 'frost', 'bandit', 'falcon', 'catapult', 'solar', 'reaper', 'king', 'phoenix', 'time'];
export const STARTERS = TOWER_KEYS.slice(0, 8);
/** Calidades: 0 Común · 1 Rara · 2 Épica · 3 Legendaria */
export const RARITY = [
  { n: 'Común', c: '#c9d1d9' }, { n: 'Rara', c: '#4fb0ff' }, { n: 'Épica', c: '#c084f5' }, { n: 'Legendaria', c: '#ffb52a' },
];
/** Valores por defecto de las estadísticas: cada torre solo declara lo que cambia. */
const D = (o) => ({ range: 0, dmg: 0, rate: 1, targets: 1, type: 'k', pierce: 0, detect: 0, heavy: 1, crit: 0, critM: 1,
  burn: 0, burnT: 3, splash: 0, slow: 0, slowT: 1.5, stun: 0, line: 0, mark: 0, reveal: 0, ...o });
const up = (n, c, d, m) => ({ n, c, d, m });

export const ABIL = {
  lockdown: { n: 'Frenesí', d: 'dispara el triple de rápido durante unos segundos' },
  stw: { n: 'Glaciación', d: 'congela a TODOS los barriles' },
  fork: { n: 'Rugido de guerra', d: 'leonas invulnerables y con el triple de daño' },
  ci: { n: 'Redoble', d: 'las torres cercanas atacan el doble de rápido' },
  kill: { n: 'Golpe mortal', d: 'destruye al barril más fuerte' },
  prune: { n: 'Erupción', d: 'daña y atrapa a todo lo que haya en la brea' },
  surge: { n: 'Furia del cielo', d: 'un rayo golpea y aturde a todos los barriles' },
  restore: { n: 'Poción de vida', d: 'recupera vidas de la guarida' },
  volley: { n: 'Lluvia de piedras', d: 'una pedrada fortísima a todos los barriles a su alcance' },
  net: { n: 'Gran red', d: 'atrapa a los barriles durante unos segundos' },
  quake: { n: 'Terremoto', d: 'empuja hacia atrás y aturde a TODOS los barriles' },
  nova: { n: 'Era glacial', d: 'congela a los barriles y los deja frágiles' },
  heist: { n: 'Golpe maestro', d: 'roba oro por cada barril del mapa y los aturde' },
  flock: { n: 'Bandada', d: 'los halcones golpean a todos los voladores y a los barriles más fuertes' },
  barrage: { n: 'Bombardeo', d: 'una lluvia de rocas sobre los barriles más fuertes' },
  eclipse: { n: 'Eclipse', d: 'TODOS los barriles reciben más daño durante unos segundos' },
  judge: { n: 'Juicio final', d: 'un hachazo a TODOS los barriles' },
  roar: { n: 'Rugido del rey', d: 'aturde a TODOS los barriles y todas las torres atacan el doble de rápido' },
  firerain: { n: 'Lluvia de fuego', d: 'quema a TODOS los barriles y hace explotar a los aceitados' },
  rewind: { n: 'Rebobinar', d: 'todos los barriles retroceden por el camino' },
};

export const TOWERS = {
  firewall: {
    name: 'León Arquero', rar: 0, ai: 'firewall', color: '#e8843c', cost: 100,
    desc: 'Dispara flechas muy rápido. Daño normal: el blindaje lo frena.',
    base: { range: 130, dmg: 9, rate: 0.18, targets: 1, type: 'k', pierce: 0, detect: 0, burn: 0, burnT: 3, fire: 1, splash: 0, crit: 0, critM: 1, heavy: 1, line: 0, slow: 0 },
    paths: [
      { name: 'Ballesta', color: '#f2c230', ups: [
        up('Puntas afiladas', 90, '+40% de daño.', (s) => { s.dmg *= 1.4; }),
        up('Flechas perforantes', 230, '+25% de daño e ignora 8 de blindaje.', (s) => { s.dmg *= 1.25; s.pierce += 8; }),
        up('Ballesta pesada', 620, 'Virote pesado que ATRAVIESA a todos los barriles en línea.', (s) => { s.line = 1; s.dmg *= 2.4; s.rate *= 1.7; s.pierce = 99; }),
        up('Balista', 1500, 'x2 de daño, x2 contra barriles pesados y más alcance.', (s) => { s.dmg *= 2; s.heavy = 2; s.range *= 1.2; }),
        up('Balista del Rey', 5000, 'x2,5 de daño, 25% de crítico x3 y más cadencia.', (s) => { s.dmg *= 2.5; s.crit = 0.25; s.critM = 3; s.rate *= 0.75; }),
      ] },
      { name: 'Vigía', color: '#3fa9f5', ups: [
        up('Arco largo', 70, '+20% de alcance.', (s) => { s.range *= 1.2; }),
        up('Ojo de halcón', 170, 'Ve barriles camuflados.', (s) => { s.detect = 1; }),
        up('Flechas de red', 480, 'Dispara a 2 objetivos y los ralentiza un 30%.', (s) => { s.targets += 1; s.slow = 0.3; }),
        up('Frenesí', 1400, 'HABILIDAD: dispara el triple de rápido durante 8 s. +30% de daño.', (s) => { s.ab = 'lockdown'; s.abT = 8; s.abCd = 45; s.dmg *= 1.3; }),
        up('Señor de la caza', 4200, '3 objetivos, +60% de daño. Frenesí dura 14 s y afecta a TODOS los Arqueros.', (s) => { s.targets += 1; s.dmg *= 1.6; s.abT = 14; s.abCd = 35; s.abAll = 1; }),
      ] },
      { name: 'Fuego', color: '#f0452a', ups: [
        up('Carcaj rápido', 80, 'Dispara un 25% más rápido.', (s) => { s.rate *= 0.8; }),
        up('Flechas de fuego', 240, 'Quema: 6 de daño/s durante 3 s. El fuego ignora el blindaje.', (s) => { s.burn = 6; }),
        up('Doble arco', 620, 'Un objetivo más, más cadencia y quemadura de 10/s.', (s) => { s.targets += 1; s.rate *= 0.85; s.burn = 10; }),
        up('Flechas incendiarias', 1500, 'Las flechas prenden en área. Quemadura de 20/s.', (s) => { s.splash = 42; s.burn = 20; }),
        up('Tormenta de fuego', 4500, 'Cadencia casi doble, 2 objetivos más y quemadura de 45/s.', (s) => { s.rate *= 0.55; s.targets += 2; s.burn = 45; }),
      ] },
    ],
  },
  gc: {
    name: 'León Cañonero', rar: 0, ai: 'gc', color: '#3fa9f5', cost: 175,
    desc: 'Bombas de agua explosivas en área: ralentizan y dejan MOJADO. Fuerte contra blindados.',
    base: { range: 115, dmg: 16, rate: 1.1, splash: 55, slow: 0.4, slowT: 1.6, wetT: 2.5, targets: 1, type: 'x', pierce: 0, detect: 0, heavy: 1, vuln: 0, finalizer: 0, pulse: 0, burn: 0 },
    paths: [
      { name: 'Gran calibre', color: '#f29a2e', ups: [
        up('Pólvora extra', 110, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Bala de hierro', 280, '+40% de daño y x1,5 contra barriles pesados.', (s) => { s.dmg *= 1.4; s.heavy = 1.5; }),
        up('Mortero', 700, 'Bombas pesadas: x1,8 de daño y +40% de radio.', (s) => { s.dmg *= 1.8; s.splash *= 1.4; }),
        up('Bombarda', 1700, 'x2 de daño y más cadencia.', (s) => { s.dmg *= 2; s.rate *= 0.8; }),
        up('El Devastador', 5200, 'x3 de daño y radio enorme.', (s) => { s.dmg *= 3; s.splash *= 1.5; }),
      ] },
      { name: 'Marea', color: '#7fe0ff', ups: [
        up('Mira larga', 90, '+20% de alcance.', (s) => { s.range *= 1.2; }),
        up('Catalejo', 220, 'Ve camuflados. Ralentiza un 60% y moja durante más tiempo.', (s) => { s.detect = 1; s.slow = 0.6; s.slowT = 2.5; s.wetT = 4; }),
        up('Marca de agua', 520, 'Marca a los barriles: reciben +25% de daño de todo durante 3 s.', (s) => { s.vuln = 0.25; }),
        up('Glaciación', 1500, 'HABILIDAD: congela 3 s a TODOS los barriles del mapa.', (s) => { s.ab = 'stw'; s.abT = 3; s.abCd = 60; }),
        up('Era de hielo', 4500, 'La habilidad congela 5 s y quita un 20% de vida. Los marcados explotan al romperse.', (s) => { s.abT = 5; s.abCd = 45; s.abDmg = 0.2; s.vuln = 0.4; s.finalizer = 1; }),
      ] },
      { name: 'Ráfaga', color: '#b07be8', ups: [
        up('Recarga rápida', 100, 'Dispara un 25% más rápido.', (s) => { s.rate *= 0.8; }),
        up('Agua venenosa', 260, 'Deja veneno: 8 de daño/s durante 3 s.', (s) => { s.burn = 8; }),
        up('Triple cañón', 650, 'Lanza 3 bombas a la vez.', (s) => { s.targets = 3; }),
        up('Batería de cañones', 1600, 'Cadencia +65% y veneno de 18/s.', (s) => { s.rate *= 0.6; s.burn = 18; }),
        up('Diluvio', 4600, '6 bombas a la vez y cada 6 s congela 1,5 s todo su alcance.', (s) => { s.targets = 6; s.rate *= 0.75; s.pulse = 6; }),
      ] },
    ],
  },
  thread: {
    name: 'Cuartel de Leonas', rar: 0, ai: 'thread', color: '#e0b040', cost: 200,
    desc: 'Entrena leonas que bajan al camino y frenan a los barriles cuerpo a cuerpo. Colócalo cerca del camino.',
    base: { range: 120, units: 3, uhp: 70, udmg: 8, urate: 0.6, respawn: 6, type: 'k', pierce: 0, detect: 0, heavy: 1, ghostBlock: 0, uslow: 0, shoot: 0, sdmg: 0, srate: 1, stargets: 1, big: 0, cleave: 0 },
    paths: [
      { name: 'Guerreras', color: '#e8643c', ups: [
        up('Leonas robustas', 110, '+60% de vida.', (s) => { s.uhp *= 1.6; }),
        up('Garras de acero', 280, 'x2 de daño e ignoran 8 de blindaje.', (s) => { s.udmg *= 2; s.pierce += 8; }),
        up('Veteranas', 700, 'x2 de vida y x2 de daño.', (s) => { s.uhp *= 2; s.udmg *= 2; }),
        up('Titanas', 1700, 'Una leona menos, pero GIGANTES: x3 de vida y x2,5 de daño.', (s) => { s.units = Math.max(2, s.units - 1); s.uhp *= 3; s.udmg *= 2.5; s.big = 1; }),
        up('Reinas de guerra', 5000, 'x3 de vida y daño. Sus zarpazos dañan en área.', (s) => { s.uhp *= 3; s.udmg *= 3; s.cleave = 1; }),
      ] },
      { name: 'Manada', color: '#f5e06b', ups: [
        up('Más leonas', 120, '+1 leona.', (s) => { s.units += 1; }),
        up('Buen olfato', 240, 'Las leonas ven camuflados y frenan a los barriles fantasma.', (s) => { s.ghostBlock = 1; s.detect = 1; }),
        up('Refuerzos', 520, '+1 leona, vuelven el doble de rápido y los barriles frenados golpean más lento.', (s) => { s.units += 1; s.respawn *= 0.5; s.uslow = 0.5; }),
        up('Rugido de guerra', 1500, 'HABILIDAD: 10 s de leonas invulnerables con el triple de daño. Vuelven todas.', (s) => { s.ab = 'fork'; s.abT = 10; s.abCd = 50; }),
        up('Gran manada', 4300, '+3 leonas más resistentes. El Rugido dura 16 s.', (s) => { s.units += 3; s.uhp *= 1.5; s.abT = 16; s.abCd = 38; }),
      ] },
      { name: 'Cazadoras', color: '#4fd6c0', ups: [
        up('Zarpazo rápido', 100, 'Las leonas golpean un 33% más rápido.', (s) => { s.urate *= 0.75; }),
        up('Lanzadoras', 300, 'El cuartel también lanza lanzas a distancia.', (s) => { s.shoot = 1; s.sdmg = 14; s.srate = 0.5; }),
        up('Doble lanza', 650, 'Lanza a 2 objetivos, x2 de daño y más rápido.', (s) => { s.stargets = 2; s.sdmg *= 2; s.srate *= 0.7; }),
        up('Emboscada', 1600, '+2 leonas, más alcance y más cadencia de lanzas.', (s) => { s.units += 2; s.range *= 1.2; s.srate *= 0.6; }),
        up('Lluvia de lanzas', 4500, 'Lanza a 4 objetivos con x2 de daño y el doble de rápido.', (s) => { s.stargets = 4; s.sdmg *= 2; s.srate *= 0.5; }),
      ] },
    ],
  },
  linter: {
    name: 'León Tamborilero', rar: 1, ai: 'linter', color: '#b07be8', cost: 150,
    desc: 'Apoyo: las torres que oyen su tambor hacen más daño.',
    base: { range: 100, buff: 0.2, rbuff: 0, rateBuff: 0, disc: 0, shoot: 0, sdmg: 0, srate: 1, stargets: 1, aslow: 0, type: 'k', pierce: 0, detect: 0, heavy: 1, adetect: 0, apierce: 0 },
    paths: [
      { name: 'Ritmo de guerra', color: '#f0456a', ups: [
        up('Tambor grande', 100, 'El tambor da +30% de daño.', (s) => { s.buff += 0.1; }),
        up('Ritmo cortante', 260, 'Las torres cercanas ignoran 6 de blindaje.', (s) => { s.apierce = 6; }),
        up('Marcha de guerra', 700, 'El tambor da +50% de daño.', (s) => { s.buff += 0.2; }),
        up('Tambores de guerra', 1800, 'El tambor da +75% de daño.', (s) => { s.buff += 0.25; }),
        up('Trueno de la sabana', 5500, 'El tambor da +125% de daño y se oye más lejos.', (s) => { s.buff += 0.5; s.range *= 1.3; }),
      ] },
      { name: 'Vigilancia', color: '#3fa9f5', ups: [
        up('Eco lejano', 90, '+25% de radio del tambor.', (s) => { s.range *= 1.25; }),
        up('Toque de alerta', 220, 'Las torres cercanas ven camuflados.', (s) => { s.adetect = 1; s.detect = 1; }),
        up('Ritmo largo', 500, 'Las torres cercanas ganan +15% de alcance.', (s) => { s.rbuff = 0.15; }),
        up('Redoble', 1500, 'HABILIDAD: 10 s en los que las torres cercanas atacan el doble de rápido.', (s) => { s.ab = 'ci'; s.abT = 10; s.abCd = 60; }),
        up('Gran redoble', 4500, '+30% de cadencia permanente. El Redoble afecta a TODO el mapa.', (s) => { s.rateBuff = Math.max(s.rateBuff, 0.3); s.abAll = 1; s.abCd = 50; }),
      ] },
      { name: 'Artesano', color: '#5ad67a', ups: [
        up('Baquetas voladoras', 90, 'El Tamborilero también ataca lanzando baquetas.', (s) => { s.shoot = 1; s.sdmg = 8; s.srate = 0.5; }),
        up('Ritmo pesado', 230, 'Ralentiza un 25% a los barriles que oyen el tambor.', (s) => { s.aslow = 0.25; }),
        up('Buen trato', 550, 'Mejoras un 15% más baratas y +15% de cadencia alrededor.', (s) => { s.disc = 0.15; s.rateBuff = Math.max(s.rateBuff, 0.15); }),
        up('Lluvia de baquetas', 1400, 'Ataca a 3 objetivos con x3 de daño. +25% de cadencia alrededor.', (s) => { s.sdmg *= 3; s.stargets = 3; s.rateBuff = Math.max(s.rateBuff, 0.25); }),
        up('Maestro tamborilero', 4200, 'Mejoras un 30% más baratas, +40% de cadencia y ralentiza un 40%.', (s) => { s.disc = 0.3; s.rateBuff = Math.max(s.rateBuff, 0.4); s.aslow = 0.4; }),
      ] },
    ],
  },
  debugger: {
    name: 'León Cazador', rar: 1, ai: 'sniper', tg: 2, color: '#e0457a', cost: 250,
    desc: 'Lanza jabalinas a una distancia enorme. Ve camuflados e ignora el blindaje.',
    base: { range: 330, dmg: 130, rate: 2.2, targets: 1, type: 'k', pierce: 99, detect: 1, splash: 0, stun: 0, slow: 0, slowT: 2, heavy: 1, mark: 0, crit: 0, critM: 1, reveal: 0 },
    paths: [
      { name: 'Jabalina pesada', color: '#e8344a', ups: [
        up('Punta de hierro', 160, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Lanza de caza mayor', 400, '+40% de daño y x1,5 contra barriles pesados.', (s) => { s.dmg *= 1.4; s.heavy = 1.5; }),
        up('Jabalina explosiva', 900, 'x2 de daño y la jabalina EXPLOTA en área.', (s) => { s.dmg *= 2; s.splash = 45; }),
        up('Arpón', 2200, 'x2,2 de daño y x2,5 contra pesados.', (s) => { s.dmg *= 2.2; s.heavy = 2.5; }),
        up('Matagigantes', 6000, 'x3 de daño y 30% de crítico x3.', (s) => { s.dmg *= 3; s.crit = 0.3; s.critM = 3; }),
      ] },
      { name: 'Rastreo', color: '#6fd65a', ups: [
        up('Rastreador', 130, 'Sus jabalinas DESCUBREN a los camuflados para todas las torres.', (s) => { s.reveal = 1; }),
        up('Golpe aturdidor', 380, 'Aturde 0,6 s.', (s) => { s.stun = 0.6; }),
        up('Marca de caza', 800, 'Cada 6 s marca al barril más fuerte: recibe x2 de daño de todo.', (s) => { s.mark = 6; }),
        up('Golpe mortal', 1800, 'HABILIDAD: destruye al barril más fuerte (a un jefe le quita un 20%).', (s) => { s.ab = 'kill'; s.abN = 1; s.abBoss = 0.2; s.abCd = 60; }),
        up('Depredador alfa', 5000, 'Golpe mortal afecta a los 4 más fuertes (35% a jefes). Marca cada 3 s.', (s) => { s.abN = 4; s.abBoss = 0.35; s.abCd = 42; s.mark = 3; }),
      ] },
      { name: 'Brazo rápido', color: '#f2c230', ups: [
        up('Brazo rápido', 140, 'Lanza un 33% más rápido.', (s) => { s.rate *= 0.75; }),
        up('Brazo de hierro', 360, 'Lanza aún más rápido.', (s) => { s.rate *= 0.72; }),
        up('Doble jabalina', 850, 'Lanza a 2 objetivos a la vez.', (s) => { s.targets = 2; }),
        up('Ráfaga de lanzas', 2000, 'Cadencia casi doble.', (s) => { s.rate *= 0.55; }),
        up('Cazador incansable', 5200, '3 objetivos, el doble de rápido y ralentiza un 50%.', (s) => { s.targets = 3; s.rate *= 0.5; s.slow = 0.5; }),
      ] },
    ],
  },
  docker: {
    name: 'León Alquimista', rar: 1, ai: 'aura', color: '#8a5ad6', cost: 225,
    desc: 'Su caldero cubre una zona de brea ácida: daña, deja ACEITADO y atrapa cada 6 s. Ignora el blindaje. No afecta a voladores.',
    base: { range: 75, dps: 14, stun: 2, cycle: 6, type: 'a', pierce: 0, detect: 1, heavy: 1, slow: 0, vuln: 0, execute: 0, oilT: 2.5, burn: 0, bossM: 1 },
    paths: [
      { name: 'Ácido', color: '#a8e03a', ups: [
        up('Brea ácida', 130, '+60% de daño.', (s) => { s.dps *= 1.6; }),
        up('Fórmula fuerte', 320, '+60% de daño.', (s) => { s.dps *= 1.6; }),
        up('Disolvente', 800, '+40% de daño. Destruye a los barriles normales con menos del 15% de vida.', (s) => { s.dps *= 1.4; s.execute = 0.15; }),
        up('Ácido real', 1900, 'x2 de daño y destruye por debajo del 25%.', (s) => { s.dps *= 2; s.execute = 0.25; }),
        up('Piedra filosofal', 5200, 'x2,5 de daño, destruye por debajo del 40% y +50% contra jefes.', (s) => { s.dps *= 2.5; s.execute = 0.4; s.bossM = 1.5; }),
      ] },
      { name: 'Gran caldero', color: '#6bc8f0', ups: [
        up('Caldero grande', 120, '+25% de zona.', (s) => { s.range *= 1.25; }),
        up('Brea espesa', 300, 'Atrapa 1 s más.', (s) => { s.stun += 1; }),
        up('Maldición', 650, 'Los barriles dentro reciben +25% de daño de todo.', (s) => { s.vuln = 0.25; }),
        up('Erupción', 1600, 'HABILIDAD: quita un 25% de vida a todo lo que haya en la brea y lo atrapa 3 s.', (s) => { s.ab = 'prune'; s.abDmg = 0.25; s.abCd = 50; }),
        up('Caldero volcánico', 4800, 'Atrapa cada 3 s, zona más grande y la Erupción afecta a TODO el mapa.', (s) => { s.cycle = 3; s.range *= 1.3; s.abAll = 1; s.abCd = 45; }),
      ] },
      { name: 'Brea pegajosa', color: '#4fd6a0', ups: [
        up('Pegamento', 100, 'Ralentiza un 30% dentro de la zona.', (s) => { s.slow = 0.3; }),
        up('Brea densa', 260, 'Ralentiza un 50% y el aceite dura el doble.', (s) => { s.slow = 0.5; s.oilT = 5; }),
        up('Residuo corrosivo', 600, 'El ácido sigue actuando al salir: 12/s durante 3 s.', (s) => { s.burn = 12; }),
        up('Charco enorme', 1500, 'Zona +30%, +50% de daño y ácido de 25/s.', (s) => { s.range *= 1.3; s.dps *= 1.5; s.burn = 25; }),
        up('Pantano negro', 4400, 'Ralentiza un 70%, ácido de 50/s y +20% de daño recibido.', (s) => { s.slow = 0.7; s.burn = 50; s.vuln = Math.max(s.vuln, 0.2); }),
      ] },
    ],
  },
  balancer: {
    name: 'León Chamán', rar: 1, ai: 'chain', color: '#35c8d8', cost: 225,
    desc: 'Rayo en cadena que salta de barril en barril. DESCARGA: +60% de daño a barriles mojados.',
    base: { range: 140, dmg: 24, rate: 0.9, hops: 3, hopR: 95, fall: 0.75, chains: 1, type: 'e', pierce: 0, detect: 0, heavy: 1, slow: 0, stun: 0, wetM: 1.6 },
    paths: [
      { name: 'Tormenta', color: '#f5e06b', ups: [
        up('Rayo potente', 130, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Alto voltaje', 330, '+40% de daño e ignora 8 de blindaje.', (s) => { s.dmg *= 1.4; s.pierce += 8; }),
        up('Arco de luz', 800, 'x1,8 de daño y los saltos casi no pierden fuerza.', (s) => { s.dmg *= 1.8; s.fall = 0.9; }),
        up('Relámpago', 2000, 'x2 de daño. La Descarga hace x2,2.', (s) => { s.dmg *= 2; s.wetM = 2.2; }),
        up('Dios del trueno', 5500, 'x2,5 de daño y lanza 2 rayos.', (s) => { s.dmg *= 2.5; s.chains = Math.max(s.chains, 2); }),
      ] },
      { name: 'Hechizos', color: '#b07be8', ups: [
        up('Bastón largo', 100, '+20% de alcance.', (s) => { s.range *= 1.2; }),
        up('Tercer ojo', 260, 'Ve camuflados y ralentiza un 30%.', (s) => { s.detect = 1; s.slow = 0.3; }),
        up('Parálisis', 650, 'El rayo aturde 0,3 s.', (s) => { s.stun = 0.3; }),
        up('Furia del cielo', 1700, 'HABILIDAD: un rayo golpea (daño ×4) y aturde 1,5 s a TODOS los barriles.', (s) => { s.ab = 'surge'; s.abPow = 4; s.abCd = 50; }),
        up('Gran chamán', 4800, 'Aturde 0,7 s. Furia del cielo hace daño ×10.', (s) => { s.stun = 0.7; s.abPow = 10; s.abCd = 36; }),
      ] },
      { name: 'Cadena', color: '#8ff0e0', ups: [
        up('Más saltos', 120, '+1 salto.', (s) => { s.hops += 1; }),
        up('Rayo saltarín', 300, '+2 saltos y más largos.', (s) => { s.hops += 2; s.hopR *= 1.2; }),
        up('Doble rayo', 750, 'Lanza 2 rayos a la vez.', (s) => { s.chains = Math.max(s.chains, 2); }),
        up('Red eléctrica', 1800, '+4 saltos y +40% de cadencia.', (s) => { s.hops += 4; s.rate *= 0.7; }),
        up('Tempestad', 5000, '4 rayos, más cadencia y más alcance.', (s) => { s.chains = 4; s.rate *= 0.7; s.range *= 1.3; }),
      ] },
    ],
  },
  backup: {
    name: 'León Mercader', rar: 0, ai: 'backup', color: '#f2c230', cost: 150, extra: 60, max: 4,
    desc: 'Su puesto genera oro para su dueño cada 5 s. Cada Mercader extra cuesta 60 más. Máximo 4 entre todos.',
    base: { range: 0, income: 8, period: 5, waveBonus: 0, interest: 0, intCap: 0, heal: 0, bounty: 0, type: 'k', pierce: 0, detect: 0, heavy: 1 },
    paths: [
      { name: 'Comercio', color: '#f5e9c8', ups: [
        up('Buen género', 110, '+50% de oro generado.', (s) => { s.income *= 1.5; }),
        up('Clientela fiel', 280, '+60% de oro generado.', (s) => { s.income *= 1.6; }),
        up('Caravana', 700, '+80% de oro generado.', (s) => { s.income *= 1.8; }),
        up('Gran bazar', 1800, 'x2 de oro generado.', (s) => { s.income *= 2; }),
        up('Imperio comercial', 5000, 'x2,5 de oro generado.', (s) => { s.income *= 2.5; }),
      ] },
      { name: 'Curandero', color: '#5ad67a', ups: [
        up('Vendas', 80, 'Recupera 1 vida por oleada.', (s) => { s.heal = 1; }),
        up('Hierbas', 220, 'Recupera 2 vidas por oleada.', (s) => { s.heal = 2; }),
        up('Botica', 550, 'Recupera 4 vidas por oleada.', (s) => { s.heal = 4; }),
        up('Poción de vida', 1400, 'HABILIDAD: recupera 25 vidas al instante.', (s) => { s.ab = 'restore'; s.abHeal = 25; s.abCd = 90; }),
        up('Elixir real', 4000, 'La Poción recupera 60 vidas. 8 vidas por oleada.', (s) => { s.abHeal = 60; s.abCd = 75; s.heal = 8; }),
      ] },
      { name: 'Tesoro', color: '#f29a2e', ups: [
        up('Propina', 90, '+25 de oro al acabar cada oleada.', (s) => { s.waveBonus = 25; }),
        up('Ahorros', 260, '+3% del oro guardado por oleada (máx. 120).', (s) => { s.interest = 0.03; s.intCap = 120; }),
        up('Recompensas', 600, '+15% de oro por cada barril destruido.', (s) => { s.bounty = 0.15; }),
        up('Banco de la sabana', 1500, '6% de intereses (máx. 300) y +70 de oro por oleada.', (s) => { s.interest = 0.06; s.intCap = 300; s.waveBonus = 70; }),
        up('Tesoro del Rey', 4500, '10% de intereses (máx. 700) y +30% de oro por barril.', (s) => { s.interest = 0.1; s.intCap = 700; s.bounty = 0.3; }),
      ] },
    ],
  },

  // ======================= TORRES DE COFRE =======================
  sling: {
    name: 'León Hondero', rar: 0, ai: 'chain', color: '#c9a36a', cost: 85,
    desc: 'Barato y rápido: sus piedras rebotan en un segundo barril.',
    base: D({ range: 120, dmg: 14, rate: 0.75, hops: 1, hopR: 85, fall: 0.8, chains: 1, wetM: 1 }),
    paths: [
      { name: 'Piedras grandes', color: '#b8743a', ups: [
        up('Canto rodado', 70, '+40% de daño.', (s) => { s.dmg *= 1.4; }),
        up('Piedra afilada', 180, '+30% de daño e ignora 6 de blindaje.', (s) => { s.dmg *= 1.3; s.pierce += 6; }),
        up('Pedrusco', 500, 'x2 de daño y aturde 0,3 s.', (s) => { s.dmg *= 2; s.stun = 0.3; }),
        up('Roca de río', 1300, 'x2 de daño y x2 contra barriles pesados.', (s) => { s.dmg *= 2; s.heavy = 2; }),
        up('Honda de titán', 4200, 'x3 de daño y cada pedrada EMPUJA al barril hacia atrás.', (s) => { s.dmg *= 3; s.knock = 22; }),
      ] },
      { name: 'Puntería', color: '#3fa9f5', ups: [
        up('Honda larga', 60, '+20% de alcance.', (s) => { s.range *= 1.2; }),
        up('Buen ojo', 150, 'Ve barriles camuflados.', (s) => { s.detect = 1; }),
        up('Tiro certero', 420, '20% de crítico x3.', (s) => { s.crit = 0.2; s.critM = 3; }),
        up('Lluvia de piedras', 1200, 'HABILIDAD: una pedrada (daño ×6) a TODOS los barriles a su alcance.', (s) => { s.ab = 'volley'; s.abPow = 6; s.abCd = 40; }),
        up('Maestro hondero', 3600, 'Crítico 35% x4. La Lluvia de piedras llega a TODO el mapa.', (s) => { s.crit = 0.35; s.critM = 4; s.abAll = 1; s.abCd = 32; }),
      ] },
      { name: 'Rebotes', color: '#5ad67a', ups: [
        up('Piedra saltarina', 70, '+1 rebote.', (s) => { s.hops += 1; }),
        up('Mano rápida', 170, 'Dispara un 25% más rápido.', (s) => { s.rate *= 0.8; }),
        up('Carambola', 480, '+2 rebotes y más largos.', (s) => { s.hops += 2; s.hopR *= 1.2; }),
        up('Doble honda', 1250, 'Lanza 2 piedras a la vez y +30% de daño.', (s) => { s.chains = 2; s.dmg *= 1.3; }),
        up('Tormenta de piedras', 3800, '4 piedras, +3 rebotes, +50% de daño y más cadencia.', (s) => { s.chains = 4; s.hops += 3; s.rate *= 0.7; s.dmg *= 1.5; }),
      ] },
    ],
  },
  fisher: {
    name: 'León Pescador', rar: 0, ai: 'sniper', color: '#4fb8c9', cost: 120,
    desc: 'Lanza redes que frenan y MOJAN al barril. Poco daño, mucho control.',
    base: D({ range: 150, dmg: 14, rate: 1.0, slow: 0.5, slowT: 2, wetT: 3 }),
    paths: [
      { name: 'Arpón', color: '#e8643c', ups: [
        up('Anzuelo afilado', 90, 'x2 de daño.', (s) => { s.dmg *= 2; }),
        up('Arpón', 230, 'x2,5 de daño e ignora el blindaje.', (s) => { s.dmg *= 2.5; s.pierce = 99; }),
        up('Arpón doble', 600, 'x2,5 de daño.', (s) => { s.dmg *= 2.5; }),
        up('Arpón ballenero', 1500, 'x2 de daño y x2,5 contra barriles pesados.', (s) => { s.dmg *= 2; s.heavy = 2.5; }),
        up('Leviatán', 4500, 'x3 de daño y cada golpe quita un 3% de la vida máxima.', (s) => { s.dmg *= 3; s.pctHp = 0.03; }),
      ] },
      { name: 'Redes', color: '#6bc8f0', ups: [
        up('Caña larga', 70, '+20% de alcance.', (s) => { s.range *= 1.2; }),
        up('Red fina', 160, 'Ve camuflados y los DESCUBRE para todas las torres.', (s) => { s.detect = 1; s.reveal = 1; }),
        up('Red pesada', 450, 'La red atrapa 0,7 s.', (s) => { s.stun = 0.7; }),
        up('Gran red', 1300, 'HABILIDAD: atrapa 4 s a todos los barriles a su alcance.', (s) => { s.ab = 'net'; s.abT = 4; s.abCd = 45; }),
        up('Red de arrastre', 3800, '3 redes a la vez. La Gran red atrapa a TODO el mapa 5 s.', (s) => { s.targets = Math.max(s.targets, 3); s.abAll = 1; s.abT = 5; s.abCd = 40; }),
      ] },
      { name: 'Marea', color: '#3f6fd0', ups: [
        up('Manos rápidas', 80, 'Lanza un 25% más rápido.', (s) => { s.rate *= 0.75; }),
        up('Red empapada', 190, 'Mojado dura el doble y ralentiza un 65%.', (s) => { s.wetT = 6; s.slow = 0.65; }),
        up('Doble red', 520, 'Lanza a 2 objetivos.', (s) => { s.targets = Math.max(s.targets, 2); }),
        up('Aguacero', 1300, 'Las redes salpican en área y lanza más rápido.', (s) => { s.splash = 50; s.rate *= 0.75; }),
        up('Maremoto', 3900, '4 objetivos, mucho más rápido y ralentiza un 80%.', (s) => { s.targets = Math.max(s.targets, 4); s.rate *= 0.6; s.slow = 0.8; }),
      ] },
    ],
  },
  brawler: {
    name: 'León Luchador', rar: 1, ai: 'firewall', color: '#e8643c', cost: 180,
    desc: 'Cuerpo a cuerpo: pega fuerte a los barriles que pasan a su lado y los EMPUJA hacia atrás.',
    base: D({ range: 72, dmg: 45, rate: 0.7, knock: 18, melee: 1 }),
    paths: [
      { name: 'Puños de hierro', color: '#b9c2cc', ups: [
        up('Nudillos', 130, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Guantes de hierro', 320, '+40% de daño e ignora 8 de blindaje.', (s) => { s.dmg *= 1.4; s.pierce += 8; }),
        up('Onda de choque', 800, 'Cada golpe daña en área.', (s) => { s.splash = 45; }),
        up('Rompetoneles', 1900, 'x2 de daño y x2,5 contra barriles pesados.', (s) => { s.dmg *= 2; s.heavy = 2.5; }),
        up('Puño del titán', 5200, 'x2,5 de daño y cada golpe quita un 4% de la vida máxima.', (s) => { s.dmg *= 2.5; s.pctHp = 0.04; }),
      ] },
      { name: 'Llaves', color: '#b07be8', ups: [
        up('Brazos largos', 100, '+25% de alcance.', (s) => { s.range *= 1.25; }),
        up('Buen olfato', 220, 'Ve barriles camuflados.', (s) => { s.detect = 1; }),
        up('Llave de cabeza', 600, 'Aturde 0,5 s.', (s) => { s.stun = 0.5; }),
        up('Terremoto', 1600, 'HABILIDAD: empuja hacia atrás a TODOS los barriles y los aturde 1,5 s.', (s) => { s.ab = 'quake'; s.abPow = 70; s.abT = 1.5; s.abCd = 55; }),
        up('Campeón', 4600, 'Empuja el doble. El Terremoto empuja mucho más y aturde 3 s.', (s) => { s.knock *= 2; s.abPow = 140; s.abT = 3; s.abCd = 45; }),
      ] },
      { name: 'Combo', color: '#ffd23f', ups: [
        up('Jab', 110, 'Golpea un 25% más rápido.', (s) => { s.rate *= 0.75; }),
        up('Gancho', 280, 'Golpea a 2 barriles a la vez.', (s) => { s.targets = 2; }),
        up('Uno-dos', 700, 'Golpea un 30% más rápido.', (s) => { s.rate *= 0.7; }),
        up('Frenesí de golpes', 1700, '3 barriles a la vez y 25% de crítico x2,5.', (s) => { s.targets = 3; s.crit = 0.25; s.critM = 2.5; }),
        up('Huracán de puños', 4800, '5 barriles a la vez y el doble de rápido.', (s) => { s.targets = 5; s.rate *= 0.5; }),
      ] },
    ],
  },
  frost: {
    name: 'León Escarcha', rar: 1, ai: 'aura', color: '#7fd0ff', cost: 200,
    desc: 'Aura de frío: ralentiza y MOJA a los barriles cercanos (también a los VOLADORES) y no les deja REPARARSE. Los congela cada 8 s.',
    base: D({ range: 95, dps: 6, type: 'c', slow: 0.3, wetT: 2, stun: 1, cycle: 8, air: 1, wound: 1, oilT: 0, vuln: 0, execute: 0, bossM: 1 }),
    paths: [
      { name: 'Ventisca', color: '#5ab8ff', ups: [
        up('Viento helado', 140, 'x2 de daño.', (s) => { s.dps *= 2; }),
        up('Granizo', 340, 'x2 de daño.', (s) => { s.dps *= 2; }),
        up('Ventisca', 850, 'x2 de daño y +15% de aura.', (s) => { s.dps *= 2; s.range *= 1.15; }),
        up('Cero absoluto', 2000, 'x2 de daño.', (s) => { s.dps *= 2; }),
        up('Glaciar', 5400, 'x2,5 de daño y destruye a los barriles normales con menos del 20% de vida.', (s) => { s.dps *= 2.5; s.execute = 0.2; }),
      ] },
      { name: 'Hielo eterno', color: '#c9e8ff', ups: [
        up('Aura amplia', 120, '+20% de aura.', (s) => { s.range *= 1.2; }),
        up('Escarcha profunda', 260, 'Congela 0,5 s más.', (s) => { s.stun += 0.5; }),
        up('Permafrost', 700, 'Congela cada 5 s.', (s) => { s.cycle = 5; }),
        up('Era glacial', 1700, 'HABILIDAD: congela 4 s a los barriles a su alcance y los deja frágiles (+30% de daño recibido).', (s) => { s.ab = 'nova'; s.abT = 4; s.abV = 0.3; s.abCd = 50; }),
        up('Invierno eterno', 4800, 'Congela cada 3 s. La Era glacial afecta a TODO el mapa.', (s) => { s.cycle = 3; s.abAll = 1; s.abCd = 45; }),
      ] },
      { name: 'Escarcha', color: '#9ff0e8', ups: [
        up('Frío intenso', 110, 'Ralentiza un 45%.', (s) => { s.slow = 0.45; }),
        up('Humedad', 250, 'Ralentiza un 55% y Mojado dura más.', (s) => { s.slow = 0.55; s.wetT = 5; }),
        up('Fragilidad', 650, 'Los barriles dentro reciben +15% de daño de todo.', (s) => { s.vuln = 0.15; }),
        up('Niebla helada', 1500, '+25% de aura y ralentiza un 65%.', (s) => { s.range *= 1.25; s.slow = 0.65; }),
        up('Corazón de hielo', 4400, 'Ralentiza un 75% y los barriles reciben +30% de daño.', (s) => { s.slow = 0.75; s.vuln = 0.3; }),
      ] },
    ],
  },
  bandit: {
    name: 'León Bandido', rar: 1, ai: 'firewall', color: '#8a7ae6', cost: 170, max: 4,
    desc: 'Lanza dagas y ROBA 1 de oro cada 1,5 s mientras ataca. Máximo 4 entre todos.',
    base: D({ range: 115, dmg: 14, rate: 0.4, steal: 1, stealCd: 1.5, bounty: 0 }),
    paths: [
      { name: 'Dagas', color: '#e8344a', ups: [
        up('Filo', 110, '+80% de daño.', (s) => { s.dmg *= 1.8; }),
        up('Dagas perforantes', 280, '+60% de daño e ignora 8 de blindaje.', (s) => { s.dmg *= 1.6; s.pierce += 8; }),
        up('Puñalada', 700, '20% de crítico x3.', (s) => { s.crit = 0.2; s.critM = 3; }),
        up('Veneno', 1700, 'Envenena: 18 de daño/s durante 3 s.', (s) => { s.burn = 18; }),
        up('Asesino', 5000, 'x3,5 de daño y 35% de crítico x4.', (s) => { s.dmg *= 3.5; s.crit = 0.35; s.critM = 4; }),
      ] },
      { name: 'Emboscada', color: '#3fa9f5', ups: [
        up('Lanzamiento largo', 80, '+20% de alcance.', (s) => { s.range *= 1.2; }),
        up('Ojo de ladrón', 190, 'Ve barriles camuflados.', (s) => { s.detect = 1; }),
        up('Doble daga', 520, 'Lanza a 2 objetivos.', (s) => { s.targets = 2; }),
        up('Golpe maestro', 1500, 'HABILIDAD: roba 4 de oro por cada barril del mapa (máx. 150) y los aturde 1 s.', (s) => { s.ab = 'heist'; s.abPow = 4; s.abCap = 150; s.abCd = 60; }),
        up('Rey de los ladrones', 4300, '3 objetivos. El Golpe maestro roba 8 por barril (máx. 400).', (s) => { s.targets = 3; s.abPow = 8; s.abCap = 400; }),
      ] },
      { name: 'Botín', color: '#ffd23f', ups: [
        up('Manos largas', 120, 'Roba cada 1,1 s.', (s) => { s.stealCd = 1.1; }),
        up('Recompensa', 300, '+10% de oro por barril para su dueño.', (s) => { s.bounty = 0.1; }),
        up('Saqueo', 700, 'Roba 2 de oro cada vez.', (s) => { s.steal = 2; }),
        up('Tesorero', 1700, 'Roba 3 de oro y +20% de oro por barril.', (s) => { s.steal = 3; s.bounty = 0.2; }),
        up('Gran golpe', 4600, 'Roba 5 de oro y +30% de oro por barril.', (s) => { s.steal = 5; s.bounty = 0.3; }),
      ] },
    ],
  },
  falcon: {
    name: 'León Halconero', rar: 1, ai: 'sniper', color: '#b8743a', cost: 220,
    desc: 'Su halcón caza a los barriles VOLADORES en cualquier punto del mapa (daño x2). También ataca a los de tierra cercanos.',
    base: D({ range: 140, dmg: 55, rate: 0.9, airGlobal: 1, airM: 2, bird: 1 }),
    paths: [
      { name: 'Garras', color: '#e8643c', ups: [
        up('Garras afiladas', 150, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Pico de acero', 380, '+40% de daño e ignora el blindaje.', (s) => { s.dmg *= 1.4; s.pierce = 99; }),
        up('Águila real', 900, 'x2 de daño.', (s) => { s.dmg *= 2; }),
        up('Depredador', 2100, 'x2 de daño y x3 contra voladores.', (s) => { s.dmg *= 2; s.airM = 3; }),
        up('Roc', 5600, 'x3 de daño y x2 contra barriles pesados.', (s) => { s.dmg *= 3; s.heavy = 2; }),
      ] },
      { name: 'Cetrería', color: '#6fd65a', ups: [
        up('Vuelo alto', 110, '+25% de alcance.', (s) => { s.range *= 1.25; }),
        up('Vista de halcón', 250, 'Ve camuflados y los DESCUBRE para todas las torres.', (s) => { s.detect = 1; s.reveal = 1; }),
        up('Picado', 650, 'Aturde 0,5 s.', (s) => { s.stun = 0.5; }),
        up('Bandada', 1600, 'HABILIDAD: golpe (daño ×5) a todos los voladores y a los 6 barriles más fuertes.', (s) => { s.ab = 'flock'; s.abPow = 5; s.abN = 6; s.abCd = 45; }),
        up('Señor de los cielos', 4600, 'Caza por TODO el mapa también en tierra. La Bandada pega ×12 a los 15 más fuertes.', (s) => { s.range = 9999; s.abPow = 12; s.abN = 15; }),
      ] },
      { name: 'Bandada', color: '#ffd23f', ups: [
        up('Aleteo rápido', 130, 'Ataca un 25% más rápido.', (s) => { s.rate *= 0.75; }),
        up('Segundo halcón', 340, 'Ataca a 2 objetivos.', (s) => { s.targets = 2; }),
        up('Vuelo rasante', 800, 'Un 30% más rápido y ralentiza un 30%.', (s) => { s.rate *= 0.7; s.slow = 0.3; }),
        up('Tercer halcón', 1900, 'Ataca a 3 objetivos.', (s) => { s.targets = 3; }),
        up('Nube de halcones', 5000, '5 objetivos y mucho más rápido.', (s) => { s.targets = 5; s.rate *= 0.6; }),
      ] },
    ],
  },
  catapult: {
    name: 'León Catapulta', rar: 2, ai: 'gc', color: '#b09a80', cost: 380,
    desc: 'Lanza rocas a CUALQUIER punto del mapa. Lenta, pero golpea en área y destroza a los blindados.',
    base: D({ range: 9999, dmg: 60, rate: 3.4, splash: 60, type: 'x', rock: 1, wetT: 0, vuln: 0, finalizer: 0, pulse: 0 }),
    paths: [
      { name: 'Roca gigante', color: '#b8743a', ups: [
        up('Roca maciza', 250, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Contrapeso', 600, '+40% de daño y +20% de radio.', (s) => { s.dmg *= 1.4; s.splash *= 1.2; }),
        up('Roca aturdidora', 1400, 'x1,5 de daño y aturde 0,8 s a todo lo que alcanza.', (s) => { s.dmg *= 1.5; s.stun = 0.8; }),
        up('Peñasco', 3200, 'x2 de daño y x2 contra barriles pesados.', (s) => { s.dmg *= 2; s.heavy = 2; }),
        up('Meteorito', 8000, 'x2,5 de daño, radio enorme y FUEGO: quema 35/s y hace explotar a los aceitados.', (s) => { s.dmg *= 2.5; s.splash *= 1.4; s.burn = 35; s.fire = 1; }),
      ] },
      { name: 'Artillería', color: '#3fa9f5', ups: [
        up('Engranajes', 200, 'Dispara un 20% más rápido.', (s) => { s.rate *= 0.8; }),
        up('Catalejo', 420, 'Ve barriles camuflados.', (s) => { s.detect = 1; }),
        up('Roca marcada', 1100, 'Los barriles alcanzados reciben +20% de daño de todo durante 3 s.', (s) => { s.vuln = 0.2; }),
        up('Bombardeo', 2600, 'HABILIDAD: 8 rocas (daño ×2) sobre los barriles más fuertes.', (s) => { s.ab = 'barrage'; s.abN = 8; s.abPow = 2; s.abCd = 50; }),
        up('Asedio', 7000, 'Dispara un 30% más rápido. El Bombardeo lanza 20 rocas.', (s) => { s.rate *= 0.7; s.abN = 20; }),
      ] },
      { name: 'Metralla', color: '#ffd23f', ups: [
        up('Doble carga', 300, 'Lanza 2 rocas a la vez.', (s) => { s.targets = 2; }),
        up('Recarga rápida', 650, 'Dispara un 20% más rápido.', (s) => { s.rate *= 0.8; }),
        up('Triple carga', 1500, 'Lanza 3 rocas a la vez.', (s) => { s.targets = 3; }),
        up('Cascotes', 3400, '+30% de radio y las esquirlas hacen 12 de daño/s durante 3 s.', (s) => { s.splash *= 1.3; s.burn = 12; }),
        up('Lluvia de rocas', 7500, '6 rocas a la vez y más rápido.', (s) => { s.targets = 6; s.rate *= 0.75; }),
      ] },
    ],
  },
  solar: {
    name: 'León Solar', rar: 2, ai: 'beam', tg: 2, color: '#ffc83d', cost: 420,
    desc: 'Rayo de sol continuo que hace MÁS daño cuanto más tiempo lleva sobre el mismo barril (hasta x4). Ignora el blindaje.',
    base: D({ range: 150, dps: 40, type: 'f', ramp: 0.5, rampMax: 3, beams: 0, revealAura: 0 }),
    paths: [
      { name: 'Lupa', color: '#ff8a2a', ups: [
        up('Lente pulida', 280, '+50% de daño.', (s) => { s.dps *= 1.5; }),
        up('Foco', 650, 'El rayo puede llegar a x6.', (s) => { s.rampMax = 5; }),
        up('Rayo concentrado', 1500, 'x1,8 de daño.', (s) => { s.dps *= 1.8; }),
        up('Lente de cristal', 3400, 'x2 de daño y x2 contra barriles pesados.', (s) => { s.dps *= 2; s.heavy = 2; }),
        up('Supernova', 8500, 'x2,5 de daño y el rayo puede llegar a x12.', (s) => { s.dps *= 2.5; s.rampMax = 11; }),
      ] },
      { name: 'Amanecer', color: '#ffe14a', ups: [
        up('Luz lejana', 220, '+20% de alcance.', (s) => { s.range *= 1.2; }),
        up('Luz reveladora', 480, 'Ve camuflados y DESCUBRE a todos los que tenga a su alcance.', (s) => { s.detect = 1; s.revealAura = 1; }),
        up('Rayo abrasador', 1200, 'Quema 15/s y hace explotar a los aceitados.', (s) => { s.burn = 15; s.fire = 1; }),
        up('Eclipse', 2800, 'HABILIDAD: durante 6 s TODOS los barriles reciben +50% de daño.', (s) => { s.ab = 'eclipse'; s.abT = 6; s.abV = 0.5; s.abCd = 60; }),
        up('Mediodía', 7500, 'Quema 40/s. El Eclipse dura 10 s y da +100% de daño.', (s) => { s.burn = 40; s.abT = 10; s.abV = 1; }),
      ] },
      { name: 'Prisma', color: '#c77dff', ups: [
        up('Prisma', 300, 'El rayo se divide: daña también al barril más cercano al objetivo (60%).', (s) => { s.beams = 1; }),
        up('Calentamiento', 650, 'El rayo coge fuerza el doble de rápido.', (s) => { s.ramp = 1; }),
        up('Doble prisma', 1500, 'Se divide en 2 rayos más.', (s) => { s.beams = 2; }),
        up('Arcoíris', 3300, 'Se divide en 3 rayos más y +15% de alcance.', (s) => { s.beams = 3; s.range *= 1.15; }),
        up('Caleidoscopio', 8000, 'Se divide en 6 rayos más y coge fuerza aún más rápido.', (s) => { s.beams = 6; s.ramp = 1.5; }),
      ] },
    ],
  },
  reaper: {
    name: 'León Verdugo', rar: 2, ai: 'sniper', color: '#c0455a', cost: 400,
    desc: 'Hachazo lento y brutal que impide REPARARSE al barril. Cada barril que REMATA le da +1% de daño para el resto de la partida (máx. +100%).',
    base: D({ range: 120, dmg: 125, rate: 1.6, stack: 0.01, stackMax: 1, melee: 1, wound: 5 }),
    paths: [
      { name: 'Hacha', color: '#e8344a', ups: [
        up('Hacha afilada', 260, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Hacha pesada', 620, '+40% de daño e ignora el blindaje.', (s) => { s.dmg *= 1.4; s.pierce = 99; }),
        up('Tajo', 1500, 'x1,5 de daño y el hachazo daña en área.', (s) => { s.dmg *= 1.5; s.splash = 50; }),
        up('Decapitador', 3300, 'x1,6 de daño y REMATA a los barriles normales con menos del 15% de vida.', (s) => { s.dmg *= 1.6; s.execHit = 0.15; }),
        up('Segador', 8200, 'x2,2 de daño, remata por debajo del 30% y puede acumular hasta +300%.', (s) => { s.dmg *= 2.2; s.execHit = 0.3; s.stackMax = 3; }),
      ] },
      { name: 'Sentencia', color: '#b07be8', ups: [
        up('Brazo largo', 200, '+25% de alcance.', (s) => { s.range *= 1.25; }),
        up('Olfato de sangre', 450, 'Ve barriles camuflados.', (s) => { s.detect = 1; }),
        up('Miedo', 1100, 'Aturde 0,3 s y ralentiza un 40%.', (s) => { s.stun = 0.3; s.slow = 0.4; s.slowT = 2; }),
        up('Juicio final', 2700, 'HABILIDAD: un hachazo (daño ×3) a TODOS los barriles.', (s) => { s.ab = 'judge'; s.abPow = 3; s.abCd = 60; }),
        up('Verdugo real', 7200, '+2% por barril rematado. El Juicio final pega ×8.', (s) => { s.stack = 0.02; s.abPow = 8; }),
      ] },
      { name: 'Sed de batalla', color: '#ffd23f', ups: [
        up('Furia', 240, 'Ataca un 25% más rápido.', (s) => { s.rate *= 0.75; }),
        up('Botín de guerra', 550, '+3 de oro por cada barril que remata.', (s) => { s.killGold = 3; }),
        up('Torbellino', 1400, '2 objetivos y un 20% más rápido.', (s) => { s.targets = 2; s.rate *= 0.8; }),
        up('Sanguinario', 3200, '+2% por barril rematado y un 25% más rápido.', (s) => { s.stack = 0.02; s.rate *= 0.75; }),
        up('Carnicero', 7800, '4 objetivos y +8 de oro por barril rematado.', (s) => { s.targets = 4; s.killGold = 8; }),
      ] },
    ],
  },
  king: {
    name: 'Rey León', rar: 3, ai: 'sniper', color: '#ffd23f', cost: 700, each: 1,
    desc: 'Su presencia da +8% de daño a TODAS las torres del mapa. Ruge cada 10 s y aturde a los barriles cercanos. Solo 1 por jugador.',
    base: D({ range: 130, dmg: 60, rate: 1.0, gbuff: 0.08, grange: 0, pulse: 10, pulseT: 1, pulseV: 0, melee: 1 }),
    paths: [
      { name: 'Garra real', color: '#e8643c', ups: [
        up('Zarpazo', 400, '+60% de daño.', (s) => { s.dmg *= 1.6; }),
        up('Garras de oro', 950, '+50% de daño e ignora el blindaje.', (s) => { s.dmg *= 1.5; s.pierce = 99; }),
        up('Zarpazo doble', 2200, 'x1,5 de daño y 2 objetivos.', (s) => { s.dmg *= 1.5; s.targets = 2; }),
        up('Ira del rey', 4800, 'x2 de daño y sus zarpazos dañan en área.', (s) => { s.dmg *= 2; s.splash = 55; }),
        up('Rey de reyes', 11000, 'x2 de daño, 4 objetivos y 30% de crítico x3.', (s) => { s.dmg *= 2; s.targets = 4; s.crit = 0.3; s.critM = 3; }),
      ] },
      { name: 'Rugido', color: '#b07be8', ups: [
        up('Rugido potente', 350, 'El rugido aturde 2 s.', (s) => { s.pulseT = 2; }),
        up('Voz de mando', 800, 'Ve camuflados y ruge cada 7 s.', (s) => { s.detect = 1; s.pulse = 7; }),
        up('Rugido atronador', 1900, '+30% de alcance y el rugido deja a los barriles frágiles (+20% de daño).', (s) => { s.range *= 1.3; s.pulseV = 0.2; }),
        up('Rugido del rey', 4500, 'HABILIDAD: aturde 4 s a TODOS los barriles y todas las torres atacan el doble de rápido 6 s.', (s) => { s.ab = 'roar'; s.abT = 4; s.abT2 = 6; s.abCd = 70; }),
        up('Soberano', 10000, 'Ruge cada 4 s. La habilidad aturde 6 s y acelera 10 s.', (s) => { s.pulse = 4; s.abT = 6; s.abT2 = 10; }),
      ] },
      { name: 'Corona', color: '#ffd23f', ups: [
        up('Corona de bronce', 450, '+12% de daño a todas las torres.', (s) => { s.gbuff = 0.12; }),
        up('Corona de plata', 1000, '+16% de daño y +5% de alcance a todas las torres.', (s) => { s.gbuff = 0.16; s.grange = 0.05; }),
        up('Corona de oro', 2400, '+20% de daño a todas las torres.', (s) => { s.gbuff = 0.2; }),
        up('Estandarte real', 5000, '+25% de daño y +8% de alcance a todas las torres.', (s) => { s.gbuff = 0.25; s.grange = 0.08; }),
        up('Imperio', 12000, '+35% de daño y +12% de alcance a todas las torres.', (s) => { s.gbuff = 0.35; s.grange = 0.12; }),
      ] },
    ],
  },
  phoenix: {
    name: 'León Fénix', rar: 3, ai: 'gc', color: '#ff6a2a', cost: 650, each: 1,
    desc: 'Bolas de fuego en área que queman y hacen explotar a los aceitados. Si la guarida cae, se sacrifica y la deja con 20 vidas (una vez por partida). Solo 1 por jugador.',
    base: D({ range: 150, dmg: 55, rate: 1.3, splash: 55, type: 'f', burn: 12, fire: 1, revive: 20, reviveStun: 0, wetT: 0, vuln: 0, finalizer: 0, pulse: 0, fireball: 1 }),
    paths: [
      { name: 'Llamarada', color: '#ff2a1a', ups: [
        up('Brasas', 350, '+50% de daño.', (s) => { s.dmg *= 1.5; }),
        up('Llama azul', 850, '+40% de daño y quema 25/s.', (s) => { s.dmg *= 1.4; s.burn = 25; }),
        up('Bola de fuego', 2000, 'x1,8 de daño y +30% de radio.', (s) => { s.dmg *= 1.8; s.splash *= 1.3; }),
        up('Infierno', 4600, 'x2 de daño y quema 50/s.', (s) => { s.dmg *= 2; s.burn = 50; }),
        up('Sol naciente', 11000, 'x2,5 de daño, quema 110/s y radio enorme.', (s) => { s.dmg *= 2.5; s.burn = 110; s.splash *= 1.3; }),
      ] },
      { name: 'Renacer', color: '#ffd23f', ups: [
        up('Cenizas', 300, 'Al renacer deja la guarida con 30 vidas.', (s) => { s.revive = 30; }),
        up('Ojo de fuego', 700, 'Ve barriles camuflados.', (s) => { s.detect = 1; }),
        up('Renacimiento', 1700, 'Deja 40 vidas y, al renacer, aturde 4 s a todos los barriles.', (s) => { s.revive = 40; s.reviveStun = 4; }),
        up('Lluvia de fuego', 4200, 'HABILIDAD: quema a TODOS los barriles (40/s durante 5 s) y hace explotar a los aceitados.', (s) => { s.ab = 'firerain'; s.abPow = 40; s.abT = 5; s.abCd = 60; }),
        up('Ave inmortal', 10000, 'Deja 60 vidas al renacer. La Lluvia de fuego quema 120/s.', (s) => { s.revive = 60; s.abPow = 120; }),
      ] },
      { name: 'Plumas', color: '#ff9d4a', ups: [
        up('Aleteo', 380, 'Dispara un 25% más rápido.', (s) => { s.rate *= 0.75; }),
        up('Dos llamas', 900, 'Lanza 2 bolas de fuego.', (s) => { s.targets = 2; }),
        up('Vuelo ardiente', 2100, 'Un 25% más rápido y +20% de alcance.', (s) => { s.rate *= 0.75; s.range *= 1.2; }),
        up('Tres llamas', 4800, 'Lanza 3 bolas de fuego.', (s) => { s.targets = 3; }),
        up('Tormenta ígnea', 11500, '5 bolas de fuego y más rápido.', (s) => { s.targets = 5; s.rate *= 0.7; }),
      ] },
    ],
  },
  time: {
    name: 'León del Tiempo', rar: 3, ai: 'sniper', tg: 2, color: '#5fe0d0', cost: 700, each: 1,
    desc: 'Ralentiza un 8% a TODOS los barriles del mapa. Sus golpes los "envejecen": quitan un 3% de su vida máxima (menos a los jefes) y no les dejan REPARARSE. Solo 1 por jugador.',
    base: D({ range: 140, dmg: 45, rate: 1.2, pctHp: 0.03, gslow: 0.08, magic: 1, wound: 4 }),
    paths: [
      { name: 'Paradoja', color: '#b07be8', ups: [
        up('Arena del tiempo', 400, 'Quita un 4% de la vida máxima.', (s) => { s.pctHp = 0.04; }),
        up('Óxido', 950, 'x2 de daño e ignora el blindaje.', (s) => { s.dmg *= 2; s.pierce = 99; }),
        up('Envejecer', 2200, 'Quita un 6% y ralentiza un 30%.', (s) => { s.pctHp = 0.06; s.slow = 0.3; s.slowT = 2; }),
        up('Polvo', 5000, 'Quita un 8% y ataca a 2 objetivos.', (s) => { s.pctHp = 0.08; s.targets = 2; }),
        up('Fin de los tiempos', 12000, 'Quita un 12% y ataca a 3 objetivos.', (s) => { s.pctHp = 0.12; s.targets = 3; }),
      ] },
      { name: 'Rebobinar', color: '#3fa9f5', ups: [
        up('Reloj largo', 300, '+25% de alcance.', (s) => { s.range *= 1.25; }),
        up('Ojo del tiempo', 700, 'Ve camuflados y los DESCUBRE para todas las torres.', (s) => { s.detect = 1; s.reveal = 1; }),
        up('Bucle', 1800, 'Aturde 0,5 s.', (s) => { s.stun = 0.5; }),
        up('Rebobinar', 4400, 'HABILIDAD: TODOS los barriles retroceden un buen tramo del camino.', (s) => { s.ab = 'rewind'; s.abPow = 220; s.abT = 0; s.abCd = 75; }),
        up('Señor del tiempo', 10500, 'Rebobinar los manda el doble de lejos y los aturde 2 s.', (s) => { s.abPow = 450; s.abT = 2; s.abCd = 60; }),
      ] },
      { name: 'Cámara lenta', color: '#5fe0d0', ups: [
        up('Tic', 450, 'Ralentiza un 12% a todos los barriles.', (s) => { s.gslow = 0.12; }),
        up('Tac', 1000, 'Ralentiza un 16% a todos los barriles.', (s) => { s.gslow = 0.16; }),
        up('Reloj de arena', 2300, 'Ralentiza un 20% y ataca un 20% más rápido.', (s) => { s.gslow = 0.2; s.rate *= 0.8; }),
        up('Tiempo detenido', 5000, 'Ralentiza un 25% a todos los barriles.', (s) => { s.gslow = 0.25; }),
        up('Eternidad', 12000, 'Ralentiza un 32% a todos los barriles.', (s) => { s.gslow = 0.32; }),
      ] },
    ],
  },
};

const statCache = new Map();
/** Estadísticas de una torre de tipo k con tiers p = [a, b, c] (modificadores acumulativos). */
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

/** Reglas de ramas (5-2-0). Devuelve '' si la rama i se puede mejorar; si no, el motivo. */
export function pathLock(p, i) {
  if (p[i] >= MAX_TIER) return 'Rama al máximo';
  const others = [0, 1, 2].filter((j) => j !== i);
  if (p[i] === 0 && others.every((j) => p[j] > 0)) return 'Bloqueada: solo 2 ramas por torre';
  if (p[i] >= 2 && others.some((j) => p[j] >= 3)) return 'Rama secundaria: máximo nivel 2';
  return '';
}

/** Aspecto de la torre: color de su rama dominante a partir de Tier 2. */
export function skin(k, p) {
  let dom = -1, best = 0;
  p.forEach((v, i) => { if (v > best) { best = v; dom = i; } });
  const base = TOWERS[k].color;
  return { dom, tier: best, main: best >= 2 ? TOWERS[k].paths[dom].color : base, accent: dom >= 0 ? TOWERS[k].paths[dom].color : base };
}

// ============================================================
//  ENEMIGOS
//  camo: camuflado (solo lo ven torres con detección) · armor: blindaje (resta daño a cada golpe k/e)
//  fly: volador (línea recta a la guarida) · regen: se repara · ghost: las leonas no lo frenan
// ============================================================
export const ENEMY_KEYS = ['bug', 'leak', 'npe', 'ddos', 'boss', 'branch', 'rootkit', 'ransom', 'zeroday'];
export const ENEMIES = {
  bug: { name: 'Barril de madera', color: '#c8793a', hp: 30, sp: 55, rw: 5, dmg: 1, r: 9, atk: 5 },
  leak: { name: 'Barril musgoso', color: '#7fae4a', hp: 95, sp: 34, rw: 11, dmg: 3, r: 13, atk: 8, regen: 0.03, heavy: true,
    tip: 'Se REPARA solo. El fuego y el ácido detienen la reparación.' },
  npe: { name: 'Barril fantasma', color: '#cdb8f0', hp: 50, sp: 85, rw: 8, dmg: 2, r: 9, atk: 0, ghost: true,
    tip: 'Rápido, y las leonas no pueden frenarlo.' },
  ddos: { name: 'Barrilete', color: '#f0d9a0', hp: 13, sp: 105, rw: 2, dmg: 1, r: 6, atk: 3,
    tip: 'Enjambre rapidísimo: usa daño en área y rayos en cadena.' },
  boss: { name: 'Tonel gigante', color: '#f2c230', hp: 1600, sp: 22, rw: 120, dmg: 30, r: 24, atk: 30, boss: true, heavy: true, split: 2 },
  branch: { name: 'Medio tonel', color: '#d98a2e', hp: 260, sp: 42, rw: 20, dmg: 6, r: 13, atk: 10, heavy: true },
  rootkit: { name: 'Barril camuflado', color: '#6f8f3f', hp: 48, sp: 62, rw: 9, dmg: 2, r: 9, atk: 5, camo: true,
    tip: 'CAMUFLADO: solo lo ven torres con detección (León Cazador o mejoras de la rama 2). Las explosiones y zonas sí le dañan.' },
  ransom: { name: 'Barril de hierro', color: '#9aa3ad', hp: 150, sp: 30, rw: 16, dmg: 4, r: 13, atk: 10, armor: 10, heavy: true,
    tip: 'BLINDADO: cada golpe pierde 10 de daño. Débil a explosiones y ácido (Cañonero, Alquimista), fuego y perforantes.' },
  zeroday: { name: 'Barril volador', color: '#e58a3a', hp: 55, sp: 58, rw: 10, dmg: 2, r: 10, atk: 0, fly: true,
    tip: 'VOLADOR: ignora el camino y va en línea recta a la guarida. Ni las leonas, ni la brea, ni las trampas le afectan.' },
};

// ============================================================
//  RELIQUIAS (cartas roguelike): se elige 1 de 3 al empezar y tras cada jefe.
//  e(m) modifica los multiplicadores globales; now(S) es un efecto inmediato.
// ============================================================
/** Número de reliquias generales; a partir de ahí hay una "Maestría" por cada torre (mismo orden que TOWER_KEYS). */
export const CARD_BASE = 16;
export const CARDS = [
  { n: 'Sangre caliente', d: 'Todas las torres atacan un 12% más rápido.', e: (m) => { m.rate *= 0.89; } },
  { n: 'Vista de lince', d: '+10% de alcance para todas las torres.', e: (m) => { m.range *= 1.1; } },
  { n: 'Fuerza de la manada', d: '+10% de daño para todas las torres.', e: (m) => { m.dmg *= 1.1; } },
  { n: 'Botín', d: '+20% de oro por cada barril destruido.', e: (m) => { m.kill *= 1.2; } },
  { n: 'Siesta reparadora', d: '+20 vidas para la guarida ahora mismo.', e: () => {}, now: (S) => { S.life += 20; } },
  { n: 'Barriles de pólvora', d: 'Los barriles explotan al romperse y dañan a los de alrededor.', e: (m) => { m.boom += 0.12; } },
  { n: 'Día de mercado', d: 'Todas las mejoras cuestan un 10% menos.', e: (m) => { m.upDisc = 1 - (1 - m.upDisc) * 0.9; } },
  { n: 'Rugido incansable', d: 'Las habilidades se recargan un 30% más rápido.', e: (m) => { m.abCd *= 0.7; } },
  { n: 'Cofre del tesoro', d: '+400 de oro ahora mismo, a repartir entre todos.', e: () => {}, now: (S, share) => share(400) },
  { n: 'Sequía', d: 'Las quemaduras hacen +60% de daño y las explosiones de aceite +50%.', e: (m) => { m.burn *= 1.6; m.combo *= 1.5; } },
  { n: 'Temporada de lluvias', d: 'Mojado dura el doble y la Descarga hace +40% de daño.', e: (m) => { m.wet *= 2; m.shock *= 1.4; } },
  { n: 'Ojos en la noche', d: 'Todas las torres ven barriles camuflados.', e: (m) => { m.detect = 1; } },
  { n: 'Colmillos de acero', d: 'Todas las torres ignoran 5 de blindaje.', e: (m) => { m.pierce += 5; } },
  { n: 'Leonas de élite', d: 'Las leonas tienen +50% de vida y de daño.', e: (m) => { m.thread *= 1.5; } },
  { n: 'Tributo', d: '+30% de oro al acabar oleadas y al saltarlas.', e: (m) => { m.wave *= 1.3; } },
  { n: 'Pacto con las hienas', d: '+700 de oro ahora (a repartir), pero los barriles futuros tienen +8% de vida.', e: (m) => { m.ehp *= 1.08; }, now: (S, share) => share(700) },
  ...TOWER_KEYS.map((k) => ({
    n: 'Maestría: ' + TOWERS[k].name,
    d: k === 'backup' ? 'Los Mercaderes generan +25% de oro.' : k === 'linter' ? 'Los tambores dan un 25% más de bonificación.' : k === 'thread' ? 'Las leonas y lanzas del Cuartel hacen +25% de daño.' : `${TOWERS[k].name}: +25% de daño.`,
    e: (m) => { m.tdm[k] *= 1.25; },
  })),
];

/** Multiplicadores globales resultantes de los parches elegidos. */
export function calcMods(md) {
  const m = { dmg: 1, rate: 1, range: 1, kill: 1, boom: 0, upDisc: 0, abCd: 1, burn: 1, combo: 1, shock: 1, wet: 1, detect: 0, pierce: 0, thread: 1, wave: 1, ehp: 1, tdm: {} };
  for (const k of TOWER_KEYS) m.tdm[k] = 1;
  for (const i of md || []) if (CARDS[i]) CARDS[i].e(m);
  return m;
}

// ============================================================
//  OLEADAS
// ============================================================
export const hpMult = (w) => 1 + 0.3 * (w - 1) + 0.07 * (w - 1) ** 2;
export const waveBonus = (w) => 40 + 8 * w;
export const skipBonus = (w, sec) => Math.round(sec * (1.5 + 0.3 * w));

const waveCache = {};
/** Lista ordenada de apariciones {t, type} de la oleada w del mapa mi (determinista). */
export function genWave(mi, w) {
  const key = mi * 100 + w;
  if (waveCache[key]) return waveCache[key];
  const M = MAPS[mi], out = [];
  const add = (type, n, gap, start) => { for (let i = 0; i < n; i++) out.push({ t: start + i * gap, type }); };
  add('bug', 8 + 2 * w, Math.max(0.3, 0.9 - w * 0.03), 0);
  if (w >= 3) add('leak', Math.floor(w * 0.9) - 1, 1.6, 3);
  if (w >= 4) add('npe', w - 1, 1.1, 6);
  if (w >= M.camoFrom) add('rootkit', 2 + Math.floor((w - M.camoFrom) * 0.8), 1.3, 4);
  if (w >= 6) add('ddos', 8 + w * 2, 0.16, 10);
  if (w >= 11) add('ddos', 8 + w * 2, 0.16, 18);
  if (w >= M.armorFrom) add('ransom', 1 + Math.floor((w - M.armorFrom) * 0.6), 2.2, 8);
  if (w >= M.flyFrom) add('zeroday', Math.round((2 + (w - M.flyFrom) * 0.7) * M.flyMul), 1.5, 5);
  if (w % 5 === 0) add('boss', 1 + Math.floor(w / 20) + (w >= 30 ? 1 : 0), 8, 12);
  out.sort((a, b) => a.t - b.t);
  return (waveCache[key] = out);
}

/** Resumen de una oleada: [[tipo, cantidad], ...] */
export function waveSummary(mi, w) {
  const c = {};
  for (const s of genWave(mi, w)) c[s.type] = (c[s.type] || 0) + 1;
  return ENEMY_KEYS.filter((k) => c[k]).map((k) => [k, c[k]]);
}
