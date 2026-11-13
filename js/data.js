// ============================================================
//  Leones TD — datos del juego
//  (Las claves internas —firewall, gc, bug…— vienen de la versión anterior y no se muestran al jugador.)
//  Mapas, torres (3 ramas × 5 tiers), enemigos, cartas y oleadas.
//  Para equilibrar el juego basta con tocar los números de este archivo.
// ============================================================

export const W = 1280, H = 640, CELL = 40, COLS = 32, ROWS = 16;
export const PLAYER_COLORS = ['#00f0ff', '#ff3fa4', '#b6ff3f', '#ffb03f'];
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
export const TOWER_KEYS = ['firewall', 'gc', 'thread', 'linter', 'debugger', 'docker', 'balancer', 'backup'];
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
};

export const TOWERS = {
  firewall: {
    name: 'León Arquero', color: '#e8843c', cost: 100,
    desc: 'Dispara flechas muy rápido. Daño normal: el blindaje lo frena.',
    base: { range: 130, dmg: 9, rate: 0.18, targets: 1, type: 'k', pierce: 0, detect: 0, burn: 0, burnT: 3, splash: 0, crit: 0, critM: 1, heavy: 1, line: 0, slow: 0 },
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
    name: 'León Cañonero', color: '#3fa9f5', cost: 175,
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
    name: 'Cuartel de Leonas', color: '#e0b040', cost: 200,
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
    name: 'León Tamborilero', color: '#b07be8', cost: 150,
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
    name: 'León Cazador', color: '#e0457a', cost: 250,
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
    name: 'León Alquimista', color: '#8a5ad6', cost: 225,
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
    name: 'León Chamán', color: '#35c8d8', cost: 225,
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
    name: 'León Mercader', color: '#f2c230', cost: 150, extra: 60, max: 4,
    desc: 'Su puesto genera oro cada 5 s. Cada Mercader extra cuesta 60 más. Máximo 4.',
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
export const CARDS = [
  { n: 'Sangre caliente', d: 'Todas las torres atacan un 12% más rápido.', e: (m) => { m.rate *= 0.89; } },
  { n: 'Vista de lince', d: '+10% de alcance para todas las torres.', e: (m) => { m.range *= 1.1; } },
  { n: 'Fuerza de la manada', d: '+10% de daño para todas las torres.', e: (m) => { m.dmg *= 1.1; } },
  { n: 'Botín', d: '+20% de oro por cada barril destruido.', e: (m) => { m.kill *= 1.2; } },
  { n: 'Siesta reparadora', d: '+20 vidas para la guarida ahora mismo.', e: () => {}, now: (S) => { S.life += 20; } },
  { n: 'Barriles de pólvora', d: 'Los barriles explotan al romperse y dañan a los de alrededor.', e: (m) => { m.boom += 0.12; } },
  { n: 'Día de mercado', d: 'Todas las mejoras cuestan un 10% menos.', e: (m) => { m.upDisc = 1 - (1 - m.upDisc) * 0.9; } },
  { n: 'Rugido incansable', d: 'Las habilidades se recargan un 30% más rápido.', e: (m) => { m.abCd *= 0.7; } },
  { n: 'Cofre del tesoro', d: '+400 de oro ahora mismo.', e: () => {}, now: (S) => { S.money += 400; } },
  { n: 'Sequía', d: 'Las quemaduras hacen +60% de daño y las explosiones de aceite +50%.', e: (m) => { m.burn *= 1.6; m.combo *= 1.5; } },
  { n: 'Temporada de lluvias', d: 'Mojado dura el doble y la Descarga hace +40% de daño.', e: (m) => { m.wet *= 2; m.shock *= 1.4; } },
  { n: 'Ojos en la noche', d: 'Todas las torres ven barriles camuflados.', e: (m) => { m.detect = 1; } },
  { n: 'Colmillos de acero', d: 'Todas las torres ignoran 5 de blindaje.', e: (m) => { m.pierce += 5; } },
  { n: 'Leonas de élite', d: 'Las leonas tienen +50% de vida y de daño.', e: (m) => { m.thread *= 1.5; } },
  { n: 'Tributo', d: '+30% de oro al acabar oleadas y al saltarlas.', e: (m) => { m.wave *= 1.3; } },
  { n: 'Pacto con las hienas', d: '+700 de oro ahora, pero los barriles futuros tienen +8% de vida.', e: (m) => { m.ehp *= 1.08; }, now: (S) => { S.money += 700; } },
  ...TOWER_KEYS.map((k) => ({
    n: 'Maestría: ' + TOWERS[k].name,
    d: k === 'backup' ? 'Los Mercaderes generan +25% de oro.' : k === 'linter' ? 'Los tambores dan un 25% más de bonificación.' : k === 'thread' ? 'Las leonas y lanzas del Cuartel hacen +25% de daño.' : `Los ${TOWERS[k].name} hacen +25% de daño.`,
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
