// ============================================================
//  Leones TD — progreso entre partidas
//  Filetes, cofres (gacha), niveles de carta, colección y mazos.
//  Funciones puras: no tocan la red ni la página, así que se pueden probar solas.
//
//  Lo que se guarda en el perfil de cada cuenta:
//    inv   { fil, chests, pity, opened, hist: [[torre, resultado, extra], ...] }
//    tw    { clave: { l: nivel 1-5, c: copias sueltas } }   → torres que tiene
//    decks [ { n: nombre, t: [claves] } ]                    → mazos guardados
//    deck  índice del mazo elegido
// ============================================================
import { TOWERS, TOWER_KEYS, STARTERS, MAPS } from './data.js';

export const CHEST_COST = 100;
/** Probabilidad (%) de cada calidad al abrir un cofre: Común, Rara, Épica, Legendaria. */
export const ODDS = [55, 30, 12, 3];
/** Seguro de mala suerte: si pasan 9 cofres sin Épica o mejor, el 10º la trae seguro. */
export const PITY = 10;
export const MAX_LEVEL = 5;
/** Copias necesarias para pasar del nivel 1 al 2, del 2 al 3, del 3 al 4 y del 4 al 5. */
export const COPIES = [1, 2, 4, 8];
/** Bonus de daño y alcance por nivel (nivel 5 = +10%). Debe coincidir con lvMul de sim.js. */
export const levelBonus = (l) => 0.025 * (Math.max(1, Math.min(MAX_LEVEL, l)) - 1);
/** Filetes que se devuelven por cada copia que ya no sirve (torre al nivel 5), según su calidad. */
export const REFUND = [10, 20, 50, 150];
export const DECK_SIZE = 6;
export const MAX_DECKS = 5;
export const HIST = 12;
/** Cuánto multiplica cada mapa los filetes ganados (los difíciles dan más). */
export const MAP_FACTOR = [1, 1.4, 1.8, 2.2, 2.6, 3];

/** Mazo con el que empieza una cuenta nueva (6 de las 8 torres iniciales; se puede cambiar en Mazos). */
export const DEFAULT_DECK = ['firewall', 'gc', 'debugger', 'docker', 'balancer', 'backup'];

const byRarity = [0, 1, 2, 3].map((r) => TOWER_KEYS.filter((k) => TOWERS[k].rar === r));

/** Progreso de una cuenta recién creada: las 8 torres iniciales, un mazo y un cofre de bienvenida. */
export function defaults() {
  const tw = {};
  for (const k of STARTERS) tw[k] = { l: 1, c: 0 };
  return {
    inv: { fil: 0, chests: 1, pity: 0, opened: 0, hist: [] },
    tw,
    decks: [{ n: 'Mazo 1', t: DEFAULT_DECK.slice() }],
    deck: 0,
  };
}

/** Completa y repara el progreso de un perfil (cuentas antiguas, datos que Firebase devuelve a medias...). */
export function normalize(p) {
  const d = defaults();
  const inv = p.inv && typeof p.inv === 'object' ? p.inv : d.inv;
  p.inv = {
    fil: Math.max(0, Math.floor(+inv.fil || 0)), chests: Math.max(0, Math.floor(+inv.chests || 0)),
    pity: Math.max(0, Math.min(PITY - 1, Math.floor(+inv.pity || 0))), opened: Math.max(0, Math.floor(+inv.opened || 0)),
    hist: (Array.isArray(inv.hist) ? inv.hist : []).filter((h) => Array.isArray(h) && TOWERS[h[0]]).slice(0, HIST),
  };
  const tw = {};
  for (const k of TOWER_KEYS) {
    const c = p.tw && p.tw[k];
    if (c || STARTERS.includes(k)) tw[k] = { l: Math.max(1, Math.min(MAX_LEVEL, Math.floor(+(c && c.l) || 1))), c: Math.max(0, Math.floor(+(c && c.c) || 0)) };
  }
  p.tw = tw;
  const decks = (Array.isArray(p.decks) ? p.decks : []).filter((x) => x && typeof x === 'object').slice(0, MAX_DECKS).map((x, i) => ({
    n: String(x.n || 'Mazo ' + (i + 1)).slice(0, 16),
    t: [...new Set(Array.isArray(x.t) ? x.t : [])].filter((k) => tw[k]).slice(0, DECK_SIZE),
  }));
  p.decks = decks.length ? decks : d.decks;
  p.deck = Math.max(0, Math.min(p.decks.length - 1, Math.floor(+p.deck || 0)));
  return p;
}

export const owned = (p, k) => !!(p.tw && p.tw[k]);
/** Estado de una torre en la colección. need = copias para el siguiente nivel (0 si ya está al máximo). */
export function card(p, k) {
  const c = p.tw && p.tw[k];
  if (!c) return { owned: false, l: 0, c: 0, need: 0 };
  return { owned: true, l: c.l, c: c.c, need: c.l >= MAX_LEVEL ? 0 : COPIES[c.l - 1] };
}

/** Mazo elegido tal y como lo necesita la partida: [[clave, nivel], ...]. */
export function activeDeck(p) {
  const d = p.decks[p.deck] || p.decks[0];
  return d.t.filter((k) => p.tw[k]).map((k) => [k, p.tw[k].l]);
}
/** Un mazo vale para jugar si tiene al menos una torre que ataque (solo Mercaderes no defiende nada). */
export const deckPlayable = (keys) => keys.some((k) => TOWERS[k] && TOWERS[k].ai !== 'backup');

/** Filetes que da una partida: más por oleada superada, por ganar y por la dificultad del mapa. */
export function reward(mi, wave, won) {
  const M = MAPS[mi];
  if (!M) return 0;
  const done = won ? M.waves : Math.max(0, Math.min(M.waves, wave) - 1); // la oleada en la que caes no cuenta
  return Math.round((done * 3 + (won ? 40 : 0)) * (MAP_FACTOR[mi] || 1));
}

export function buyChest(p) {
  if (p.inv.fil < CHEST_COST) return false;
  p.inv.fil -= CHEST_COST; p.inv.chests++;
  return true;
}

/** Sortea la torre de un cofre. rnd = función de azar (0-1), para poder probarlo. */
export function roll(pity, rnd = Math.random) {
  let odds = ODDS, forced = false;
  if (pity >= PITY - 1) { odds = [0, 0, ODDS[2], ODDS[3]]; forced = true; } // seguro: Épica o Legendaria
  let x = rnd() * odds.reduce((a, b) => a + b, 0), rar = 0;
  for (rar = 0; rar < 3; rar++) { if (x < odds[rar]) break; x -= odds[rar]; }
  const pool = byRarity[rar];
  return { k: pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))], rar, forced };
}

/**
 * Añade una torre a la colección.
 * Devuelve qué ha pasado: 'new' (torre nueva), 'up' (sube de nivel), 'copy' (copia guardada) o 'fil' (ya estaba al máximo → filetes).
 */
export function grant(p, k) {
  const rar = TOWERS[k].rar;
  let c = p.tw[k];
  if (!c) { p.tw[k] = { l: 1, c: 0 }; return { k, rar, what: 'new', l: 1, c: 0, need: COPIES[0], fil: 0 }; }
  if (c.l >= MAX_LEVEL) { p.inv.fil += REFUND[rar]; return { k, rar, what: 'fil', l: c.l, c: 0, need: 0, fil: REFUND[rar] }; }
  c.c++;
  let what = 'copy';
  if (c.c >= COPIES[c.l - 1]) { c.c -= COPIES[c.l - 1]; c.l++; what = 'up'; }
  return { k, rar, what, l: c.l, c: c.c, need: c.l >= MAX_LEVEL ? 0 : COPIES[c.l - 1], fil: 0 };
}

/** Abre uno de los cofres guardados. Devuelve el resultado (o null si no quedan). */
export function openChest(p, rnd = Math.random) {
  if (p.inv.chests < 1) return null;
  const r = roll(p.inv.pity, rnd);
  p.inv.chests--; p.inv.opened++;
  p.inv.pity = r.rar >= 2 ? 0 : p.inv.pity + 1;
  const res = { ...grant(p, r.k), forced: r.forced };
  p.inv.hist = [[res.k, res.what, res.what === 'fil' ? res.fil : res.l], ...p.inv.hist].slice(0, HIST);
  return res;
}

/** Cofres que faltan para el seguro de Épica. */
export const pityLeft = (p) => PITY - p.inv.pity;
