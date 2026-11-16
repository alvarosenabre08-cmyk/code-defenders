// ============================================================
//  Leones TD — simulación (solo la ejecuta el anfitrión de la sala)
//  Sin DOM ni red: estado puro + step() + applyAction() + pack()/unpack().
//  Cada jugador ocupa un puesto (0-3) con su propio oro y su mazo de torres; cada torre tiene dueño (t.o).
//  El comportamiento de cada torre lo decide TOWERS[k].ai (varias torres comparten el mismo).
// ============================================================
import {
  CELL, COLS, ROWS, MAPS, SPEEDS, MAX_TIER, TOWERS, TOWER_KEYS, ENEMIES, ENEMY_KEYS, CARDS, CARD_BASE, ABIL,
  pathPos, nearestD, genWave, hpMult, waveBonus, skipBonus, stats, pathLock, skin, calcMods,
} from './data.js';

export const STEP = 1 / 30;
export const TARGET_MODES = ['Primero', 'Último', 'Más fuerte', 'Más cercano'];
let gidN = 0; // contador para el identificador de partida (sin usar Math.random: no altera el azar del juego)
const BOMB_CD = 50, GATE_CD = 45, GATE_T = 4, SWITCH_CD = 8, BOMB_R = 95;

/**
 * Partida nueva. act = puestos (0-3) de los jugadores presentes.
 * Cada jugador tiene su propio oro: money[puesto]. El oro inicial del mapa se reparte entre todos.
 */
/** Bonus permanente por nivel de carta (1-5): +2,5% de daño y alcance por nivel, hasta +10%. */
export const lvMul = (t) => 1 + 0.025 * ((t.lv || 1) - 1);

/** Limpia un mazo [[clave, nivel], ...]: solo torres que existen, sin repetir y con nivel 1-5. */
function cleanDeck(deck) {
  const out = [];
  for (const d of Array.isArray(deck) ? deck : []) {
    const k = Array.isArray(d) ? d[0] : d, lv = Array.isArray(d) ? d[1] | 0 : 1;
    if (TOWERS[k] && !out.some((x) => x[0] === k)) out.push([k, Math.max(1, Math.min(5, lv || 1))]);
  }
  return out.length ? out : null;
}
/** Fija el mazo de un jugador (solo la primera vez: no se puede cambiar a mitad de partida). */
export function setDeck(S, slot, deck) {
  if (slot < 0 || slot > 3 || S.dk[slot]) return false;
  S.dk[slot] = cleanDeck(deck);
  return !!S.dk[slot];
}

/** decks = { puesto: [[clave, nivel], ...] } (opcional; sin mazo se puede construir cualquier torre). */
export function newGame(map = 0, act = [0], decks = null) {
  const M = MAPS[map] ? MAPS[map] : MAPS[0];
  act = [...new Set(act)].filter((s) => s >= 0 && s < 4).sort();
  if (!act.length) act = [0];
  const S = {
    ph: 'play', pa: 0, pb: '', au: 0, sp: 1, map: MAPS[map] ? map : 0, w: 0, wt: 0, si: 0, ic: 20,
    money: [0, 0, 0, 0], act, gr: 0, st: [[0, 0], [0, 0], [0, 0], [0, 0]], gid: Date.now().toString(36) + (gidN++ % 1296).toString(36),
    life: M.life, nid: 1, kills: 0, T: [], E: [],
    ob: M.obs.map(() => 0), sw: M.forks.map(() => 0), swc: 0, tr: M.traps.map(() => ({ c: 0, a: 0 })),
    dk: [0, 1, 2, 3].map((i) => cleanDeck(decks && decks[i])), rvu: 0,
    md: [], cd: null, _fx: [], _spawn: [], _boom: [], _bounty: [0, 0, 0, 0], _gb: 0, _gr: 0, _gs: 0, _src: null,
  };
  for (const s of act) { S.money[s] = Math.floor(M.money / act.length); S.gr |= 1 << s; }
  S._m = calcMods(S.md);
  offerCards(S);
  return S;
}

// ---------- oro por jugador ----------
/** Da oro a un jugador (cuenta para su estadística de oro ganado). */
function give(S, s, amt) { S.money[s] += amt; S.st[s][1] += amt; }
/** Reparte oro a partes iguales entre los jugadores presentes. */
function shareGold(S, amt) { for (const s of S.act) give(S, s, amt / S.act.length); }

/**
 * El anfitrión avisa de qué puestos están presentes.
 *  · Jugador nuevo: entra con una ayuda de oro (solo la primera vez que se usa ese puesto).
 *  · Jugador que se va: sus torres pasan al jugador con menos torres y su oro se reparte.
 */
export function setRoster(S, slots) {
  slots = [...new Set(slots)].filter((s) => s >= 0 && s < 4).sort();
  if (!slots.length) return false;
  const added = slots.filter((s) => !S.act.includes(s)), gone = S.act.filter((s) => !slots.includes(s));
  if (!added.length && !gone.length) return false;
  S.act = slots;
  for (const s of added) if (!(S.gr & (1 << s))) { S.gr |= 1 << s; S.money[s] += Math.round(100 + 20 * S.w); }
  for (const s of gone) {
    const cnt = (q) => S.T.filter((t) => t.o === q).length;
    const heir = slots.reduce((b, q) => (b < 0 || cnt(q) < cnt(b) ? q : b), -1);
    for (const t of S.T) if (t.o === s) t.o = heir;
    const g = S.money[s]; S.money[s] = 0;
    for (const q of slots) S.money[q] += g / slots.length;
  }
  return true;
}

// ---------- utilidades de torres ----------
export const tStats = (t) => stats(t.k, t.p);
/** Alcance real de la torre (incluye aura del Linter y parches). */
export const tRange = (S, t) => tStats(t).range * (1 + (t._rb || 0)) * S._m.range * (1 + (S._gr || 0)) * lvMul(t);
export function upgradeCost(S, t, i) {
  const u = TOWERS[t.k].paths[i].ups[t.p[i]];
  return u ? Math.round(u.c * (1 - (t._disc || 0)) * (1 - S._m.upDisc)) : 0;
}
/** '' si la rama i de la torre t se puede mejorar; si no, el motivo (incluye la regla de Tier 5 único). */
export function lockReason(S, t, i) {
  const l = pathLock(t.p, i);
  if (l) return l;
  if (t.p[i] === MAX_TIER - 1 && S.T.some((q) => q !== t && q.k === t.k && q.p[i] >= MAX_TIER)) return 'Ya hay un nivel 5 de esta rama en el mapa';
  return '';
}
export const sellValue = (t) => Math.floor(t.inv * 0.7);
export function buildCost(S, k) {
  const d = TOWERS[k];
  return d.cost + (d.extra ? d.extra * S.T.filter((t) => t.k === k).length : 0);
}
/** Máximo de torres de un tipo por jugador (0 = sin límite). El límite del mapa se reparte entre los presentes. */
export const limitFor = (S, k) => TOWERS[k].each || (TOWERS[k].max ? Math.max(1, Math.floor(TOWERS[k].max / S.act.length)) : 0);
/** false si el jugador del puesto sl ya tiene el máximo de torres de ese tipo (Mercaderes). */
export const underLimit = (S, k, sl) => !limitFor(S, k) || S.T.filter((t) => t.k === k && t.o === sl).length < limitFor(S, k);
export function cellFree(S, cx, cy, ignoreId) {
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
  const M = MAPS[S.map], key = cy * COLS + cx;
  if (M.blocked.has(key)) return false;
  const oi = M.obsAt.get(key);
  if (oi !== undefined && !S.ob[oi]) return false;
  return !S.T.some((t) => t.x === cx && t.y === cy && t.i !== ignoreId);
}
export const towerAt = (S, cx, cy) => S.T.find((t) => t.x === cx && t.y === cy);
const tx = (t) => t.x * CELL + CELL / 2, ty = (t) => t.y * CELL + CELL / 2;

/** Posición de un enemigo (los voladores van en línea recta al servidor). */
export function epos(M, k, r, d) {
  if (ENEMIES[k].fly) {
    const p0 = M.R[r].pts[0], f = Math.max(0, Math.min(1, d / M.flyLen[r]));
    return { x: p0.x + (M.bcx - p0.x) * f, y: p0.y + (M.bcy - p0.y) * f };
  }
  return pathPos(M, r, d);
}
function place(M, e) {
  const def = ENEMIES[e.k], p = epos(M, e.k, e.r, e.d);
  e._x = p.x; e._y = p.y;
  e._rem = (def.fly ? M.flyLen[e.r] : M.R[e.r].len) - e.d;
}

/** Punto de reunión de los Threads de una Thread Factory (_rd = -1 si la ruta queda lejos). */
function rally(S, t) {
  if (t.k !== 'thread') { t._rd = -1; return; }
  const n = nearestD(MAPS[S.map], tx(t), ty(t));
  t._rd = n.dist <= tStats(t).range ? n.d : -1;
  t._rt = n.r;
}
export const soldierD = (t, j) => t._rd + (j - (t.s.length - 1) / 2) * 14;

function syncSoldiers(S, t) {
  if (t.k !== 'thread') return;
  const s = tStats(t), hp = s.uhp * S._m.thread;
  while (t.s.length < s.units) t.s.push({ h: hp, r: 0, e: 0, c: 0 });
  if (t.s.length > s.units) t.s.length = s.units;
  for (const u of t.s) if (u.h > 0) u.h = Math.max(u.h, hp * 0.5);
}

function mkTower(S, k, cx, cy, cost, o, lv) {
  const t = { i: S.nid++, k, o, lv: lv || 1, tt: 0, rp: 0, kc: 0, x: cx, y: cy, p: [0, 0, 0], tg: TOWERS[k].tg || 0, c: 0, dz: 0, inv: cost, cy: 2, a: 0, ac: 0, at: 0, s: [] };
  syncSoldiers(S, t); rally(S, t);
  S.T.push(t);
  return t;
}
function mkEnemy(S, k, r, d) {
  const M = MAPS[S.map];
  const m = Math.round(ENEMIES[k].hp * hpMult(Math.max(1, S.w)) * M.hp * S._m.ehp);
  const e = { i: S.nid++, k, r, d, h: m, m, sl: 0, sf: 0, st: 0, im: 0, b: 0, ac: 0, bn: 0, bt: 0, vu: 0, vt: 0, fz: 0, wt: 0, oi: 0, oc: 0, cc: 0, rv: 0, kb: 0, nr: 0, dm: [0, 0, 0, 0], dn: 0, bo: -1, fo: -1 };
  place(M, e);
  S.E.push(e);
  return e;
}

function offerCards(S) {
  // las "Maestrías" solo salen para torres que alguien lleva en su mazo
  const keys = new Set();
  for (const d of S.dk) if (d) for (const x of d) keys.add(x[0]);
  const pool = CARDS.map((_, i) => i).filter((i) => i < CARD_BASE || !keys.size || keys.has(TOWER_KEYS[i - CARD_BASE])), out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  S.cd = out;
}

// ---------- acciones de los jugadores ----------
/** Aplica una acción. Devuelve true si cambió algo. */
export function applyAction(S, a) {
  if (!a || typeof a !== 'object') return false;
  if (a.t === 'restart') {
    if (S.ph === 'play') return false;
    Object.assign(S, newGame(S.map, S.act, S.dk));
    return true;
  }
  if (S.ph !== 'play') return false;
  const M = MAPS[S.map];
  const sl = S.act.includes(a.s) ? a.s : -1; // puesto del jugador que envía la acción
  /** Torre de la acción, solo si es del jugador que la envía. */
  const own = () => { const t = S.T.find((q) => q.i === a.id); return t && t.o === sl ? t : null; };
  switch (a.t) {
    case 'pause':
      S.pa = S.pa ? 0 : 1; S.pb = String(a.n || '').slice(0, 14);
      return true;
    case 'speed':
      S.sp = SPEEDS.includes(a.v) ? a.v : SPEEDS[(SPEEDS.indexOf(S.sp) + 1) % SPEEDS.length];
      return true;
    case 'card': {
      const id = S.cd && S.cd[a.i | 0];
      if (id === undefined || id === false || id === null) return false;
      S.md.push(id);
      if (CARDS[id].now) CARDS[id].now(S, (n) => shareGold(S, n));
      S._m = calcMods(S.md); S.cd = null;
      S._fx.push(['t', 640, 150, 'RELIQUIA: ' + CARDS[id].n, '#ffe14a', 2.2]);
      return true;
    }
    case 'auto':
      S.au = S.au ? 0 : 1;
      if (S.au && S.ic > 1 && !S.cd) callEarly(S, 1);
      return true;
    case 'next':
      if (S.ic > 0 && !S.pa && !S.cd) { callEarly(S, 0.01); return true; }
      return false;
    case 'build': {
      if (sl < 0 || !TOWERS[a.k] || !underLimit(S, a.k, sl) || !cellFree(S, a.cx, a.cy)) return false;
      const card = S.dk[sl] ? S.dk[sl].find((x) => x[0] === a.k) : [a.k, 1];
      if (!card) return false; // esa torre no está en su mazo
      const cost = buildCost(S, a.k);
      if (S.money[sl] < cost) return false;
      S.money[sl] -= cost; mkTower(S, a.k, a.cx, a.cy, cost, sl, card[1]);
      return true;
    }
    case 'up': {
      const t = own(), i = a.p | 0;
      if (!t || i < 0 || i > 2 || lockReason(S, t, i)) return false;
      calcBuffs(S);
      const cost = upgradeCost(S, t, i);
      if (S.money[sl] < cost) return false;
      S.money[sl] -= cost; t.inv += cost; t.p = t.p.slice(); t.p[i]++;
      syncSoldiers(S, t); rally(S, t);
      return true;
    }
    case 'sell': {
      const t = own();
      if (!t) return false;
      S.money[sl] += sellValue(t);
      S.T = S.T.filter((q) => q !== t);
      return true;
    }
    case 'move': {
      const t = own();
      if (!t || !cellFree(S, a.cx, a.cy, t.i)) return false;
      t.x = a.cx; t.y = a.cy; t.dz = 3; // 3 s "reiniciando" tras moverla
      for (const s of t.s) s.e = 0;
      rally(S, t);
      return true;
    }
    case 'tgt': {
      const t = own();
      if (!t) return false;
      t.tg = (t.tg + 1) % TARGET_MODES.length;
      return true;
    }
    case 'abil': {
      const t = own();
      return !!t && !S.pa && !S.cd && useAbility(S, t);
    }
    case 'clear': {
      const i = a.i | 0, o = M.obs[i];
      if (sl < 0 || !o || S.ob[i] || S.money[sl] < o[2]) return false;
      S.money[sl] -= o[2]; S.ob[i] = 1;
      S._fx.push(['f', o[0] * CELL + 20, o[1] * CELL + 20, 40, '#9aa7ff']);
      return true;
    }
    case 'trap': {
      const i = a.i | 0, def = M.traps[i], tr = S.tr[i];
      if (!def || tr.c > 0 || S.pa || S.cd) return false;
      if (def.t === 'bomb') {
        tr.c = BOMB_CD;
        const x = def.x * CELL + 20, y = def.y * CELL + 20;
        S._boom.push([x, y, 45 * hpMult(Math.max(1, S.w)) * M.hp, BOMB_R, 1, '#ffb03f', 1, sl]); // la dinamita es de quien la detona
      } else { tr.a = GATE_T; tr.c = GATE_CD; }
      return true;
    }
    case 'sw': {
      const i = a.i | 0;
      if (i < 0 || i >= S.sw.length || S.swc > 0) return false;
      S.sw[i] = S.sw[i] ? 0 : 1; S.swc = SWITCH_CD;
      return true;
    }
  }
  return false;
}

/** Empieza ya la siguiente oleada y paga el bonus por los segundos saltados. */
function callEarly(S, left) {
  const bonus = Math.round(skipBonus(S.w, S.ic - left) * S._m.wave);
  if (bonus > 0) { shareGold(S, bonus); S._fx.push(['t', 640, 340, `+${bonus} de oro por saltar`, '#ffe14a', 1.4]); }
  S.ic = left;
}

function useAbility(S, t) {
  const s = tStats(t), M = MAPS[S.map];
  if (!s.ab || t.ac > 0 || t.dz > 0) return false;
  t.ac = s.abCd * S._m.abCd;
  S._src = t;
  const x = tx(t), y = ty(t), col = skin(t.k, t.p).accent, r = tRange(S, t);
  const dm = (1 + (t._b || 0)) * S._m.dmg * S._m.tdm[t.k] * (1 + (S._gb || 0)) * lvMul(t);
  const alive = S.E.filter((e) => e.h > 0);
  /** Barriles a su alcance (o todos, si la habilidad es global). */
  const near = () => (s.abAll ? alive : alive.filter((e) => (e._x - x) ** 2 + (e._y - y) ** 2 <= r * r));
  const strong = (e) => (ENEMIES[e.k].boss ? 1e9 : 0) + e.h;
  switch (s.ab) {
    case 'lockdown':
      for (const q of s.abAll ? S.T.filter((q) => q.k === t.k) : [t]) q.at = s.abT;
      break;
    case 'stw':
      for (const e of alive) {
        stunE(e, s.abT);
        if (s.abDmg) damage(S, e, e.m * (ENEMIES[e.k].boss ? 0.05 : s.abDmg), 'x', 0, t.o);
      }
      S._fx.push(['g', col]);
      break;
    case 'fork':
      t.at = s.abT;
      for (const u of t.s) { u.h = s.uhp * S._m.thread; u.r = 0; }
      break;
    case 'ci':
      t.at = s.abT;
      break;
    case 'kill': {
      const str = (e) => (ENEMIES[e.k].boss ? 1e9 : 0) + e.h;
      alive.sort((a, b) => str(b) - str(a));
      for (const e of alive.slice(0, s.abN)) {
        S._fx.push(['s', x, y, Math.round(e._x), Math.round(e._y), '#ffffff']);
        if (ENEMIES[e.k].boss) damage(S, e, e.m * s.abBoss, 'x', 0, t.o); else damage(S, e, e.h + 1, 'x', 0, t.o);
      }
      break;
    }
    case 'prune': {
      for (const e of alive) {
        if (ENEMIES[e.k].fly) continue;
        if (!s.abAll && (e._x - x) ** 2 + (e._y - y) ** 2 > r * r) continue;
        damage(S, e, e.m * (ENEMIES[e.k].boss ? 0.08 : s.abDmg), 'a', 0, t.o);
        stunE(e, 3);
      }
      S._fx.push(s.abAll ? ['g', col] : ['d', x, y, Math.round(r), col]);
      break;
    }
    case 'surge': {
      let n = 0;
      for (const e of alive) {
        if (n++ < 40) S._fx.push(['z', Math.round(e._x), Math.round(e._y)]);
        damage(S, e, s.dmg * s.abPow * dm * (e.wt > 0 ? s.wetM * S._m.shock : 1), 'e', 99, t.o);
        stunE(e, 1.5);
      }
      S._fx.push(['g', col]);
      break;
    }
    case 'restore': {
      const before = S.life;
      S.life = Math.max(S.life, Math.min(M.life, S.life + s.abHeal));
      S._fx.push(['l', S.life - before]);
      break;
    }
    case 'volley': {
      let n = 0;
      for (const e of near()) {
        if (n++ < 30) S._fx.push(['b', x, y, Math.round(e._x), Math.round(e._y), col]);
        damage(S, e, s.dmg * s.abPow * dm, 'k', 99, t.o);
      }
      break;
    }
    case 'net':
      for (const e of near()) { stunE(e, s.abT); e.wt = Math.max(e.wt, (s.wetT || 0) * S._m.wet); }
      S._fx.push(s.abAll ? ['g', col] : ['d', x, y, Math.round(r), col]);
      break;
    case 'quake':
      for (const e of alive) { knockE(S, e, s.abPow, true); stunE(e, s.abT); }
      S._fx.push(['g', col]);
      break;
    case 'nova':
      for (const e of near()) { stunE(e, s.abT); vulnE(e, s.abV, s.abT + 2); e.wt = Math.max(e.wt, 4 * S._m.wet); }
      S._fx.push(s.abAll ? ['g', col] : ['d', x, y, Math.round(r), col]);
      break;
    case 'heist': {
      const gold = Math.min(s.abCap, alive.length * s.abPow);
      give(S, t.o, gold);
      for (const e of alive) stunE(e, 1);
      S._fx.push(['m', x, y - 14, gold]);
      break;
    }
    case 'flock': {
      const hitSet = new Set(alive.filter((e) => ENEMIES[e.k].fly));
      for (const e of [...alive].sort((a, b) => strong(b) - strong(a)).slice(0, s.abN)) hitSet.add(e);
      let n = 0;
      for (const e of hitSet) {
        if (n++ < 30) S._fx.push(['s', x, y, Math.round(e._x), Math.round(e._y), col]);
        damage(S, e, s.dmg * s.abPow * dm * (ENEMIES[e.k].fly ? s.airM || 1 : 1), 'k', 99, t.o);
      }
      break;
    }
    case 'barrage':
      for (const e of [...alive].sort((a, b) => strong(b) - strong(a)).slice(0, s.abN)) {
        S._boom.push([e._x, e._y, s.dmg * s.abPow * dm, s.splash, s.fire ? 1 : 0, col, 0, t.o]);
      }
      break;
    case 'eclipse':
      for (const e of alive) vulnE(e, s.abV, s.abT);
      S._fx.push(['g', '#2a1a4a']);
      break;
    case 'judge': {
      const st = 1 + Math.min(s.stackMax || 0, (t.kc || 0) * (s.stack || 0));
      for (const e of alive) damage(S, e, s.dmg * s.abPow * dm * st, 'k', 99, t.o);
      S._fx.push(['g', col]);
      break;
    }
    case 'roar':
      for (const e of alive) stunE(e, s.abT);
      t.at = s.abT2; // mientras dura, todas las torres atacan el doble de rápido (ver calcBuffs)
      S._fx.push(['g', col]);
      break;
    case 'firerain':
      for (const e of alive) burnE(S, e, s.abPow, s.abT, true, t.o);
      S._fx.push(['g', '#ff6a2a']);
      break;
    case 'rewind':
      for (const e of alive) { knockE(S, e, s.abPow, true); stunE(e, s.abT); }
      S._fx.push(['g', col]);
      break;
  }
  S._src = null;
  S._fx.push(['t', x, y - 34, '¡' + ABIL[s.ab].n + '!', '#ffe14a', 1.1]);
  return true;
}

// ---------- daño y estados alterados ----------
/**
 * type: k normal · e eléctrico · x explosivo · a ácido · f fuego · c frío. prc = blindaje que ignora.
 * o = puesto del jugador que hace el daño (-1 = de nadie: brasas, lava, explosiones de barril).
 * bo/bf = dueño y fuerza del tambor que potencia el golpe: si es de otro jugador, se lleva la
 *         mitad del daño extra que aporta su tambor.
 */
function damage(S, e, amt, type, prc, o = -1, bo = -1, bf = 0) {
  if (e.h <= 0) return;
  const def = ENEMIES[e.k];
  if (def.armor) {
    if (type === 'x' || type === 'a') amt *= 1.5;
    else if (type !== 'f' && type !== 'c') { // el fuego y el frío no chocan contra el blindaje
      amt -= Math.max(0, def.armor - (prc || 0));
      if (amt <= 0) { if (Math.random() < 0.15) S._fx.push(['r', Math.round(e._x), Math.round(e._y)]); return; }
    }
  }
  if (e.vt > 0) amt *= 1 + e.vu;
  const real = Math.min(amt, e.h);
  if (o >= 0) {
    let part = 0;
    if (bo >= 0 && bo !== o && bf > 0) { part = real * (bf / (1 + bf)) * 0.5; e.dm[bo] += part; S.st[bo][0] += part; }
    e.dm[o] += real - part; S.st[o][0] += real - part;
  } else e.dn += real;
  e.h -= amt;
  if (e.h > 0) return;
  e.h = 0;
  payout(S, e); S.kills++;
  const src = S._src; // torre que lo remata (para el Verdugo y el oro por remate)
  if (src) { src.kc = (src.kc || 0) + 1; const kg = tStats(src).killGold; if (kg) give(S, src.o, kg); }
  S._fx.push(['p', Math.round(e._x), Math.round(e._y), ENEMY_KEYS.indexOf(e.k)]);
  if (def.split) for (let n = 0; n < def.split; n++) S._spawn.push(['branch', e.r, Math.max(0, e.d - n * 16)]);
  if (e.fz > 0) S._boom.push([e._x, e._y, Math.min(400, e.m * 0.3), 60, 0, '#c77dff', 0, e.fo]);
  if (S._m.boom) S._boom.push([e._x, e._y, Math.min(500, e.m * S._m.boom), 50, 0, '#ff5a5a', 0, -1]);
}
/** Reparte el oro de un barril roto según el daño que le hizo cada jugador. */
function payout(S, e) {
  const act = S.act, n = act.length, base = ENEMIES[e.k].rw * S._m.kill;
  let tot = e.dn, pool = e.dn; // pool = daño de nadie (o de jugadores que ya no están): a partes iguales
  for (let s = 0; s < 4; s++) { tot += e.dm[s]; if (!act.includes(s)) pool += e.dm[s]; }
  for (const s of act) give(S, s, base * (tot > 0 ? (e.dm[s] + pool / n) / tot : 1 / n) * (1 + S._bounty[s]));
}
function slowE(e, f, t) {
  if (!f) return;
  if (e.sl <= 0 || f >= e.sf) { e.sf = f; e.sl = Math.max(e.sl, t); }
}
/** Empuja al barril hacia atrás por el camino (los voladores no; los jefes, poco). */
function knockE(S, e, px, force) {
  const def = ENEMIES[e.k];
  if (!px || def.fly || e.h <= 0 || (!force && e.kb > 0)) return;
  e.kb = 1.5; e.b = 0;
  e.d = Math.max(0, e.d - px * (def.boss ? 0.3 : 1));
  place(MAPS[S.map], e);
}
function stunE(e, t) {
  if (!t) return;
  e.st = Math.max(e.st, ENEMIES[e.k].boss ? t / 2 : t);
}
function vulnE(e, v, t) {
  if (!v) return;
  if (e.vt <= 0 || v >= e.vu) { e.vu = v; e.vt = Math.max(e.vt, t); }
}
/** COMBO Explosión de aceite: un barril ACEITADO que recibe fuego explota en área. */
function ignite(S, e, o) {
  if (e.oi <= 0 || e.h <= 0) return;
  e.oi = 0; e.oc = 3;
  S._boom.push([e._x, e._y, Math.min(900, 25 + e.m * 0.1) * S._m.combo, 55, 1, '#ff9d00', 0, o]); // el combo es de quien pone el fuego
  S._fx.push(['t', Math.round(e._x), Math.round(e._y) - 18, '¡BOOM!', '#ff9d00', 0.8]);
}
function burnE(S, e, dps, t, fire, o = -1) {
  if (!dps) return;
  if (e.bt <= 0 || dps >= e.bn) e.bo = o; // la quemadura es de quien puso la más fuerte
  e.bn = Math.max(e.bn, dps); e.bt = Math.max(e.bt, t);
  if (fire) ignite(S, e, o);
}

function leak(S, e) {
  S.life -= ENEMIES[e.k].dmg; e.h = 0; S._fx.push(['h']);
  if (S._lk) S._lk[e.k] = (S._lk[e.k] || 0) + ENEMIES[e.k].dmg;
}

const visible = (S, e, det) => det || !ENEMIES[e.k].camo || e.rv > 0 || S._m.detect;
/** Enemigos vivos dentro del radio. det = la torre detecta ofuscados (o es un efecto de área). */
function inRange(S, x, y, r, det) {
  const out = [];
  for (const e of S.E) if (e.h > 0 && (e._x - x) ** 2 + (e._y - y) ** 2 <= r * r && visible(S, e, det)) out.push(e);
  return out;
}
const strength = (e) => (ENEMIES[e.k].boss ? 1e9 : 0) + e.h + (ENEMIES[e.k].armor || 0) * 20;
/** Elige objetivos según la prioridad de la torre: 0 primero · 1 último · 2 más fuerte · 3 más cercano. */
function pick(S, x, y, r, det, mode, n) {
  const list = inRange(S, x, y, r, det);
  if (list.length > 1) {
    if (mode === 1) list.sort((a, b) => b._rem - a._rem);
    else if (mode === 2) list.sort((a, b) => strength(b) - strength(a));
    else if (mode === 3) list.sort((a, b) => (a._x - x) ** 2 + (a._y - y) ** 2 - (b._x - x) ** 2 - (b._y - y) ** 2);
    else list.sort((a, b) => a._rem - b._rem);
  }
  return n && list.length > n ? list.slice(0, n) : list;
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const f = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - dx * f, py - ay - dy * f);
}

/** Calcula los efectos de Linter, racks de GPU y Backups sobre cada torre. Devuelve Map id->torre. */
export function calcBuffs(S) {
  const M = MAPS[S.map], m = S._m;
  const lint = S.T.filter((t) => t.k === 'linter' && t.dz <= 0);
  const cfAll = lint.some((l) => l.at > 0 && tStats(l).abAll) || S.T.some((q) => q.at > 0 && tStats(q).ab === 'roar');
  let gb = 0, gr = 0, gs = 0; // Rey León (daño y alcance globales) y León del Tiempo (lentitud global): no se acumulan
  const tById = new Map();
  const bounty = [0, 0, 0, 0];
  for (const t of S.T) {
    tById.set(t.i, t);
    let bo = -1, b = 0, rr = 0, rb = 0, disc = 0, det = 0, ap = 0, cf = cfAll ? 1 : 0;
    for (const l of lint) {
      if (l === t) continue;
      const ls = tStats(l);
      if (Math.hypot(tx(l) - tx(t), ty(l) - ty(t)) > ls.range * m.range) continue;
      disc = Math.max(disc, ls.disc);
      if (t.k === 'linter') continue;
      if (ls.buff * m.tdm.linter > b) { b = ls.buff * m.tdm.linter; bo = l.o; }
      rr = Math.max(rr, ls.rateBuff); rb = Math.max(rb, ls.rbuff);
      det = det || ls.adetect; ap = Math.max(ap, ls.apierce);
      if (l.at > 0) cf = 1;
    }
    t._b = b; t._bo = bo; t._rr = rr; t._rb = rb; t._disc = disc; t._det = det; t._ap = ap; t._cf = cf;
    t._pad = M.padAt.has(t.y * COLS + t.x) ? 1 : 0;
    const ts = tStats(t);
    if (ts.bounty && t.o >= 0) bounty[t.o] = Math.max(bounty[t.o], ts.bounty);
    if (t.dz <= 0) { gb = Math.max(gb, ts.gbuff || 0); gr = Math.max(gr, ts.grange || 0); gs = Math.max(gs, ts.gslow || 0); }
  }
  S._bounty = bounty; S._gb = gb; S._gr = gr; S._gs = gs;
  return tById;
}

/** Avanza la simulación dt segundos. */
export function step(S, dt) {
  if (S.ph !== 'play' || S.pa || S.cd) return;
  const M = MAPS[S.map], m = S._m;

  if (S.swc > 0) S.swc -= dt;
  for (const tr of S.tr) { if (tr.c > 0) tr.c -= dt; if (tr.a > 0) tr.a -= dt; }

  // --- oleadas ---
  if (S.ic > 0) {
    S.ic -= dt;
    if (S.ic <= 0) {
      S.ic = 0; S.w++; S.wt = 0; S.si = 0; S._fx.push(['w', S.w]);
      for (const en of M.entries) if (en.from === S.w && S.w > 1) S._fx.push(['t', 640, 190, '¡SE HA ABIERTO UNA CUEVA!', '#ff5a4a', 3]);
    }
  } else {
    const q = genWave(S.map, S.w);
    S.wt += dt;
    if (S.si < q.length && q[S.si].t <= S.wt) {
      const cyc = [];
      for (const en of M.entries) if (en.from <= S.w) for (let n = 0; n < en.w; n++) cyc.push(en.r);
      while (S.si < q.length && q[S.si].t <= S.wt) { mkEnemy(S, q[S.si].type, cyc[S.si % cyc.length], 0); S.si++; }
    }
    if (S.si >= q.length && !S.E.some((e) => e.h > 0)) {
      if (S.w >= M.waves) { S.ph = 'won'; return; }
      endWave(S);
    }
  }

  const tById = calcBuffs(S);

  // --- Threads disponibles para bloquear ---
  const free = [];
  for (const t of S.T) {
    if (t.k !== 'thread' || t._rd < 0 || t.dz > 0) continue;
    const s = tStats(t), det = s.detect || t._det;
    t.s.forEach((u, j) => {
      if (u.h > 0 && !u.e) { const p = pathPos(M, t._rt, soldierD(t, j)); free.push({ t, j, u, gb: s.ghostBlock, det, x: p.x, y: p.y }); }
    });
  }

  // --- enemigos ---
  for (const e of S.E) {
    if (e.h <= 0) continue;
    const def = ENEMIES[e.k];
    if (e.sl > 0) e.sl -= dt;
    if (e.im > 0) e.im -= dt;
    if (e.vt > 0) e.vt -= dt;
    if (e.fz > 0) e.fz -= dt;
    if (e.wt > 0) e.wt -= dt;
    if (e.oi > 0) e.oi -= dt;
    if (e.oc > 0) e.oc -= dt;
    if (e.cc > 0) e.cc -= dt;
    if (e.rv > 0) e.rv -= dt;
    if (e.kb > 0) e.kb -= dt;
    if (e.nr > 0) e.nr -= dt;
    if (e.bt > 0) { e.bt -= dt; damage(S, e, e.bn * m.burn * dt, 'f', 0, e.bo); } else e.bn = 0;
    if (e.h <= 0) continue;
    if (def.regen && e.h < e.m && e.bt <= 0 && e.nr <= 0) e.h = Math.min(e.m, e.h + e.m * def.regen * dt);
    if (e.st > 0) {
      e.st -= dt;
    } else if (e.b) {
      const t = tById.get(e.b >> 3), u = t && t.s[e.b & 7];
      if (!u || u.h <= 0 || u.e !== e.i || t.dz > 0) e.b = 0;
      else {
        e.ac -= dt;
        if (e.ac <= 0) {
          const s = tStats(t);
          e.ac = 0.8 / (1 - s.uslow);
          if (t.at <= 0) u.h -= def.atk * hpMult(S.w) ** 0.4;
          if (u.h <= 0) { u.h = 0; u.r = s.respawn; u.e = 0; e.b = 0; }
        }
      }
    } else {
      let nd = e.d + def.sp * (e.sl > 0 ? 1 - e.sf : 1) * (1 - S._gs * (def.boss ? 0.5 : 1)) * dt;
      if (def.fly) {
        e.d = nd;
        if (nd >= M.flyLen[e.r]) { leak(S, e); continue; }
      } else {
        // bifurcación: el Router decide la rama al llegar
        M.forks.forEach((f, fi) => { if (e.r === f.r && e.d < f.d && nd >= f.d && S.sw[fi]) e.r = f.alt; });
        // ventanas de mantenimiento: nadie pasa mientras están activas
        for (let ti = 0; ti < M.traps.length; ti++) {
          if (!M.gateD[ti] || S.tr[ti].a <= 0) continue;
          const gd = M.gateD[ti][e.r] - 10;
          if (gd >= 0 && e.d <= gd && nd > gd) nd = gd;
        }
        e.d = nd;
        for (const o of free) {
          if (o.u.e || (def.ghost && !o.gb)) continue;
          if (def.camo && !o.det && e.rv <= 0 && !m.detect) continue;
          if ((o.x - e._x) ** 2 + (o.y - e._y) ** 2 < 100) { o.u.e = e.i; e.b = o.t.i * 8 + o.j; e.ac = 0.4; break; }
        }
        if (e.d >= M.R[e.r].len) { leak(S, e); continue; }
        // zonas del mapa
        const z = M.zoneAt.get(Math.floor(e._y / CELL) * COLS + Math.floor(e._x / CELL));
        if (z === 'heat') burnE(S, e, 3 + S.w * 1.5, 1, true, -1);
        else if (z === 'cool') e.wt = Math.max(e.wt, 2.5 * m.wet);
      }
    }
    place(M, e);
  }
  const eById = new Map(S.E.map((e) => [e.i, e]));

  // --- torres ---
  for (const t of S.T) {
    if (t.ac > 0) t.ac -= dt;
    if (t.at > 0) t.at -= dt;
    if (t.dz > 0) { t.dz -= dt; continue; }
    const s = tStats(t), ai = TOWERS[t.k].ai, x = tx(t), y = ty(t), col = skin(t.k, t.p).accent;
    const range = tRange(S, t);
    const dm = (1 + t._b) * (t._pad ? 1.3 : 1) * m.dmg * m.tdm[t.k] * (1 + S._gb) * lvMul(t);
    const cd = m.rate / ((1 + t._rr) * (t._cf ? 2 : 1));
    const det = s.detect || t._det || m.detect;
    const prc = s.pierce + t._ap + m.pierce;
    S._src = t;
    const hit = (e, base, type) => {
      const def = ENEMIES[e.k];
      let d = base * dm;
      if (s.heavy > 1 && def.heavy) d *= s.heavy;
      if (s.airM && def.fly) d *= s.airM;
      if (s.stack) d *= 1 + Math.min(s.stackMax, (t.kc || 0) * s.stack);          // Verdugo: más fuerte con cada remate
      if (s.crit && Math.random() < s.crit) { d *= s.critM; S._fx.push(['x', Math.round(e._x), Math.round(e._y)]); }
      if (s.pctHp) d += e.m * s.pctHp * (def.boss ? 0.25 : 1);                      // % de la vida máxima
      if (s.execHit && !def.boss && e.h < e.m * s.execHit) { S._fx.push(['x', Math.round(e._x), Math.round(e._y)]); damage(S, e, e.h + 1, 'f', 99, t.o); return; }
      if (s.wound) e.nr = Math.max(e.nr, s.wound);                                  // heridas: el barril no se repara
      damage(S, e, d, type || s.type, prc, t.o, t._bo, t._b);
      if (s.knock && e.h > 0) knockE(S, e, s.knock);
    };
    if (t.c > 0) t.c -= dt;
    t.cy -= dt;
    // pulso periódico alrededor de la torre (Cañonero "Diluvio", rugido del Rey León)
    if (s.pulse && t.cy <= 0 && !s.mark && ai !== 'aura' && ai !== 'backup') {
      const all = inRange(S, x, y, range, true);
      if (all.length) {
        t.cy = s.pulse;
        for (const e of all) { stunE(e, s.pulseT || 1.5); vulnE(e, s.pulseV || 0, 4); }
        S._fx.push(['d', x, y, Math.round(Math.min(range, 400)), col]);
      }
    }
    switch (ai) {
      // ---- disparo directo: Arquero, Luchador (cuerpo a cuerpo), Bandido ----
      case 'firewall': {
        if (t._sc > 0) t._sc -= dt;
        if (t.c > 0) break;
        const list = pick(S, x, y, range, det, t.tg, s.targets);
        if (!list.length) break;
        t.c = s.rate * cd * (t.at > 0 ? 1 / 3 : 1);
        t.a = Math.atan2(list[0]._y - y, list[0]._x - x);
        const one = (e) => { burnE(S, e, s.burn, s.burnT, !!s.fire, t.o); slowE(e, s.slow, 1.5); stunE(e, s.stun); hit(e, s.dmg); };
        for (const e of list) {
          if (s.line) {
            const an = Math.atan2(e._y - y, e._x - x), ex = x + Math.cos(an) * range, ey = y + Math.sin(an) * range;
            S._fx.push(['s', x, y, Math.round(ex), Math.round(ey), col]);
            for (const o of S.E) if (o.h > 0 && visible(S, o, det) && distSeg(o._x, o._y, x, y, ex, ey) < 14) one(o);
          } else {
            S._fx.push(s.melee ? ['f', Math.round(e._x), Math.round(e._y), 18, col] : ['b', x, y, Math.round(e._x), Math.round(e._y), col]);
            if (s.splash) {
              S._fx.push(['f', Math.round(e._x), Math.round(e._y), s.splash, col]);
              for (const o of inRange(S, e._x, e._y, s.splash, true)) if (o !== e) { burnE(S, o, s.burn, s.burnT, !!s.fire, t.o); hit(o, s.dmg * 0.5, s.fire ? 'f' : s.type); }
            }
            one(e);
          }
        }
        if (s.steal && !(t._sc > 0)) { t._sc = s.stealCd; give(S, t.o, s.steal); S._fx.push(['m', x, y - 14, s.steal]); } // Bandido: roba mientras ataca
        break;
      }
      // ---- bombas en área: Cañonero, Catapulta, Fénix ----
      case 'gc': {
        if (t.c > 0) break;
        const list = pick(S, x, y, range, det, t.tg, s.targets);
        if (!list.length) break;
        t.c = s.rate * cd; t.a = Math.atan2(list[0]._y - y, list[0]._x - x);
        for (const e of list) {
          const cx = e._x, cy = e._y;
          S._fx.push(['a', x, y, Math.round(cx), Math.round(cy), Math.round(s.splash), col, s.rock ? 1 : s.fireball ? 2 : 0]);
          for (const o of inRange(S, cx, cy, s.splash, true)) {
            slowE(o, s.slow, s.slowT); vulnE(o, s.vuln, 3); stunE(o, s.stun);
            if (s.wetT) o.wt = Math.max(o.wt, s.wetT * m.wet);
            burnE(S, o, s.burn, 3, !!s.fire, t.o);
            if (s.finalizer) { o.fz = 3; o.fo = t.o; }
            hit(o, s.dmg);
          }
        }
        break;
      }
      // ---- un golpe fuerte a un objetivo: Cazador, Pescador, Halconero, Verdugo, Rey León, León del Tiempo ----
      case 'sniper': {
        if (s.mark && t.cy <= 0) {
          const e = pick(S, x, y, range, det, 2, 1)[0];
          if (e) { t.cy = s.mark; vulnE(e, 1, 4); S._fx.push(['k', Math.round(e._x), Math.round(e._y)]); }
        }
        if (t.c > 0) break;
        let list = pick(S, x, y, range, det, t.tg, s.airGlobal ? 0 : s.targets);
        if (s.airGlobal) { // Halconero: primero los voladores, estén donde estén
          const air = S.E.filter((e) => e.h > 0 && ENEMIES[e.k].fly && visible(S, e, det)).sort((a, b) => a._rem - b._rem);
          list = [...air, ...list.filter((e) => !ENEMIES[e.k].fly)].slice(0, s.targets);
        }
        if (!list.length) break;
        t.c = s.rate * cd; t.a = Math.atan2(list[0]._y - y, list[0]._x - x);
        for (const e of list) {
          S._fx.push(s.melee ? ['f', Math.round(e._x), Math.round(e._y), 20, col] : ['s', x, y, Math.round(e._x), Math.round(e._y), col, s.bird ? 1 : s.magic ? 2 : 0]);
          stunE(e, s.stun); slowE(e, s.slow, s.slowT);
          if (s.wetT) e.wt = Math.max(e.wt, s.wetT * m.wet);
          if (s.reveal) e.rv = 30;
          if (s.splash) {
            S._fx.push(['f', Math.round(e._x), Math.round(e._y), s.splash, col]);
            for (const o of inRange(S, e._x, e._y, s.splash, true)) if (o !== e) {
              if (s.wetT) { o.wt = Math.max(o.wt, s.wetT * m.wet); slowE(o, s.slow, s.slowT); }
              hit(o, s.dmg * 0.4, 'x');
            }
          }
          hit(e, s.dmg);
        }
        break;
      }
      // ---- proyectil que salta de barril en barril: Chamán (rayo), Hondero (piedras) ----
      case 'chain': {
        if (t.c > 0) break;
        const starts = pick(S, x, y, range, det, t.tg, s.chains);
        if (!starts.length) break;
        t.c = s.rate * cd; t.a = Math.atan2(starts[0]._y - y, starts[0]._x - x);
        const done = new Set();
        for (let e of starts) {
          if (done.has(e.i)) continue;
          const pts = [x, y];
          let dmg = s.dmg;
          for (let h = 0; e && h <= s.hops; h++) {
            done.add(e.i); pts.push(Math.round(e._x), Math.round(e._y));
            const ox = e._x, oy = e._y;
            slowE(e, s.slow, 1.5); stunE(e, s.stun);
            if (e.wt > 0 && s.type === 'e') {
              // COMBO Descarga: barril mojado + rayo
              if (e.cc <= 0) { e.cc = 2; stunE(e, 0.25); S._fx.push(['z', Math.round(ox), Math.round(oy)]); }
              hit(e, dmg * s.wetM * m.shock);
            } else hit(e, dmg);
            dmg *= s.fall;
            e = inRange(S, ox, oy, s.hopR, det).filter((q) => !done.has(q.i))
              .reduce((b, q) => (!b || (q._x - ox) ** 2 + (q._y - oy) ** 2 < (b._x - ox) ** 2 + (b._y - oy) ** 2 ? q : b), null);
          }
          S._fx.push(['c', pts, col, s.type === 'e' ? 0 : 1]);
        }
        break;
      }
      // ---- zona alrededor de la torre: Alquimista (brea), Escarcha (frío) ----
      case 'aura': {
        const list = inRange(S, x, y, range, true).filter((e) => s.air || !ENEMIES[e.k].fly);
        if (t.cy <= 0 && list.length) {
          t.cy = s.cycle;
          for (const e of list) if (e.im <= 0) { stunE(e, s.stun); e.im = e.st + 2; }
          S._fx.push(['d', x, y, Math.round(range), col]);
        }
        for (const e of list) {
          const boss = ENEMIES[e.k].boss;
          slowE(e, s.slow, 0.25); vulnE(e, s.vuln, 0.25);
          if (s.oilT && e.oc <= 0) e.oi = Math.max(e.oi, s.oilT);
          if (s.wetT) e.wt = Math.max(e.wt, s.wetT * m.wet);
          burnE(S, e, s.burn, 3, false, t.o);
          if (s.execute && !boss && e.h < e.m * s.execute) { S._fx.push(['x', Math.round(e._x), Math.round(e._y)]); damage(S, e, e.h + 1, 'a', 0, t.o); continue; }
          hit(e, s.dps * dt * (boss ? s.bossM : 1));
        }
        break;
      }
      // ---- rayo continuo que coge fuerza sobre el mismo objetivo: León Solar ----
      case 'beam': {
        let e = t.tt ? eById.get(t.tt) : null;
        if (!e || e.h <= 0 || !visible(S, e, det) || (e._x - x) ** 2 + (e._y - y) ** 2 > range * range) {
          e = pick(S, x, y, range, det, t.tg, 1)[0] || null;
          t.tt = e ? e.i : 0; t.rp = 0;
        }
        if (s.revealAura) for (const o of inRange(S, x, y, range, true)) o.rv = Math.max(o.rv, 1);
        if (!e) break;
        t.a = Math.atan2(e._y - y, e._x - x); t.rp += dt;
        const pow = s.dps * dt * (1 + Math.min(s.rampMax, s.ramp * t.rp));
        if (s.beams) {
          const ex = e._x, ey = e._y;
          const others = inRange(S, ex, ey, 90, det).filter((o) => o !== e).sort((a, b) => (a._x - ex) ** 2 + (a._y - ey) ** 2 - (b._x - ex) ** 2 - (b._y - ey) ** 2).slice(0, s.beams);
          for (const o of others) { burnE(S, o, s.burn, 1, !!s.fire, t.o); hit(o, pow * 0.6); }
        }
        burnE(S, e, s.burn, 1, !!s.fire, t.o);
        hit(e, pow);
        if (e.h <= 0) { t.tt = 0; t.rp = 0; }
        break;
      }
      case 'backup': {
        if (t.cy <= 0) {
          t.cy = s.period;
          const inc = Math.round(s.income * m.tdm.backup);
          give(S, t.o, inc); S._fx.push(['m', x, y - 14, inc]);
        }
        break;
      }
      case 'linter': {
        if (s.aslow) for (const e of inRange(S, x, y, range, true)) slowE(e, s.aslow, 0.25);
        if (!s.shoot || t.c > 0) break;
        const list = pick(S, x, y, range, det, t.tg, s.stargets);
        if (!list.length) break;
        t.c = s.srate * cd;
        for (const e of list) { S._fx.push(['b', x, y, Math.round(e._x), Math.round(e._y), col]); hit(e, s.sdmg); }
        break;
      }
      case 'thread': {
        const uhp = s.uhp * m.thread, boost = (t.at > 0 ? 3 : 1) * m.thread;
        t.s.forEach((u, j) => {
          if (u.h <= 0) {
            u.r -= dt;
            if (u.r <= 0) { u.h = uhp; u.e = 0; u.c = 0; }
            return;
          }
          if (u.e) {
            const e = eById.get(u.e);
            if (!e || e.h <= 0 || e.b !== t.i * 8 + j) { u.e = 0; return; }
            u.c -= dt;
            if (u.c <= 0) {
              u.c = s.urate * cd;
              if (s.cleave) for (const o of inRange(S, e._x, e._y, 34, true)) if (o !== e) hit(o, s.udmg * boost * 0.6);
              hit(e, s.udmg * boost);
            }
          } else if (u.h < uhp) u.h = Math.min(uhp, u.h + uhp * 0.05 * dt);
        });
        if (s.shoot && t.c <= 0) {
          const list = pick(S, x, y, range, det, t.tg, s.stargets);
          if (list.length) {
            t.c = s.srate * cd;
            for (const e of list) { S._fx.push(['b', x, y, Math.round(e._x), Math.round(e._y), col]); hit(e, s.sdmg * m.thread); }
          }
        }
        break;
      }
    }
  }
  S._src = null;

  finish(S);
}

/** Explosiones pendientes, limpieza de muertos y fin de partida. También se usa tras una acción. */
function finish(S) {
  for (let n = 0; n < S._boom.length && n < 80; n++) {
    const [bx, by, bd, br, fire, col, stun, own = -1] = S._boom[n];
    S._fx.push(['f', Math.round(bx), Math.round(by), br, col]);
    for (const o of inRange(S, bx, by, br, true)) {
      if (stun) stunE(o, 1);
      damage(S, o, bd, 'x', 0, own);
      if (fire) { burnE(S, o, 4 + S.w, 2, false, own); ignite(S, o, own); }
    }
  }
  S._boom.length = 0;
  if (S.E.some((e) => e.h <= 0)) S.E = S.E.filter((e) => e.h > 0);
  for (const [k, r, d] of S._spawn) mkEnemy(S, k, r, d);
  S._spawn.length = 0;
  if (S.life <= 0) {
    // León Fénix: se sacrifica y salva la guarida (una vez por jugador y partida)
    const ph = S.T.find((t) => tStats(t).revive && t.o >= 0 && !(S.rvu & (1 << t.o)));
    if (ph) {
      const s = tStats(ph);
      S.rvu |= 1 << ph.o; S.life = s.revive; ph.dz = 45;
      if (s.reviveStun) for (const e of S.E) stunE(e, s.reviveStun);
      S._fx.push(['g', '#ff6a2a'], ['t', 640, 260, '¡EL FÉNIX SALVA LA GUARIDA!', '#ffb52a', 3.5]);
    } else { S.life = 0; S.ph = 'lost'; }
  }
}
/** Llamar tras applyAction para resolver explosiones/bajas provocadas por habilidades y trampas. */
export function settle(S) { if (S.ph === 'play' && (S._boom.length || S._spawn.length || S.E.some((e) => e.h <= 0))) finish(S); }

function endWave(S) {
  const M = MAPS[S.map];
  // bonus de oleada: a partes iguales. Lo que dan los Mercaderes es de su dueño.
  const base = Math.round(waveBonus(S.w) * S._m.wave);
  let total = base, heal = 0;
  shareGold(S, base);
  for (const sl of S.act) {
    let wb = 0, interest = 0, cap = 0;
    for (const t of S.T) {
      if (t.k !== 'backup' || t.o !== sl) continue;
      const s = tStats(t);
      wb += s.waveBonus; heal += s.heal;
      if (s.interest > interest) { interest = s.interest; cap = s.intCap; }
    }
    const extra = Math.round((wb + (interest ? Math.min(cap, Math.floor(S.money[sl] * interest)) : 0)) * S._m.wave);
    if (extra) { give(S, sl, extra); total += extra; }
  }
  if (heal && S.life < M.life) { const b = S.life; S.life = Math.min(M.life, S.life + heal); S._fx.push(['l', S.life - b]); }
  S._fx.push(['m', 640, 300, total]);
  S.ic = 12;
  if (S.w % 5 === 0) offerCards(S); // tras cada jefe: elegir reliquia
  if (S.au) callEarly(S, 1);
}

// ---------- serialización (lo que viaja por la red) ----------
const r1 = (n) => Math.round(n * 10) / 10;

export function pack(S, fx) {
  return JSON.stringify({
    p: S.ph, pa: S.pa, pb: S.pb, au: S.au, sp: S.sp, mp: S.map, w: S.w, wt: r1(S.wt), si: S.si, ic: r1(S.ic), mo: S.money.map(Math.floor), ac: S.act, gr: S.gr, st: S.st.map((a) => [Math.round(a[0]), Math.round(a[1])]), gi: S.gid, dk: S.dk.map((d) => (d ? d.map((x) => [TOWER_KEYS.indexOf(x[0]), x[1]]) : 0)), ru: S.rvu, li: S.life, n: S.nid, ki: S.kills,
    ob: S.ob.join(''), sw: S.sw.join(''), sc: Math.ceil(Math.max(0, S.swc)), tr: S.tr.map((t) => [Math.ceil(Math.max(0, t.c)), r1(Math.max(0, t.a))]), md: S.md, cd: S.cd,
    T: S.T.map((t) => {
      const a = [t.i, TOWER_KEYS.indexOf(t.k), t.x, t.y, t.p[0] * 100 + t.p[1] * 10 + t.p[2], t.tg, r1(Math.max(0, t.c)), r1(Math.max(0, t.dz)), t.inv, r1(t.cy), r1(t.a), Math.ceil(Math.max(0, t.ac)), r1(Math.max(0, t.at)), t.o, t.lv || 1,
        t.tt || tStats(t).stack ? [t.tt || 0, r1(t.rp || 0), t.kc || 0] : 0];
      if (t.s.length) a.push(t.s.map((u) => [Math.round(u.h), r1(Math.max(0, u.r)), u.e ? 1 : 0]));
      return a;
    }),
    E: S.E.map((e) => [e.i, ENEMY_KEYS.indexOf(e.k), e.r, Math.round(e.d), Math.ceil(e.h), e.m,
      (e.sl > 0 ? 1 : 0) | (e.st > 0 ? 2 : 0) | (e.bt > 0 ? 4 : 0) | (e.vt > 0 ? 8 : 0) | (e.wt > 0 ? 16 : 0) | (e.oi > 0 ? 32 : 0) | (e.rv > 0 ? 64 : 0) | (e.vt > 0 && e.vu >= 1 ? 128 : 0)]),
    f: fx || [],
  });
}

export function unpack(str) {
  const o = JSON.parse(str);
  const S = { ph: o.p, pa: o.pa, pb: o.pb, au: o.au || 0, sp: o.sp || 1, map: o.mp || 0, w: o.w, wt: o.wt, si: o.si, ic: o.ic, money: o.mo, act: o.ac || [0], gr: o.gr || 0, st: o.st || [[0, 0], [0, 0], [0, 0], [0, 0]], gid: o.gi || '', dk: (o.dk || [0, 0, 0, 0]).map((d) => (d ? d.map((x) => [TOWER_KEYS[x[0]], x[1]]) : null)), rvu: o.ru || 0, life: o.li, nid: o.n, kills: o.ki,
    ob: String(o.ob || '').split('').map(Number), sw: String(o.sw || '').split('').map(Number), swc: o.sc || 0, tr: (o.tr || []).map((a) => ({ c: a[0], a: a[1] })),
    md: o.md || [], cd: o.cd || null, _fx: [], _spawn: [], _boom: [], _bounty: [0, 0, 0, 0], _gb: 0, _gr: 0, _gs: 0, _src: null };
  S._m = calcMods(S.md);
  const M = MAPS[S.map];
  S.T = (o.T || []).map((a) => {
    const t = { i: a[0], k: TOWER_KEYS[a[1]], x: a[2], y: a[3], p: [Math.floor(a[4] / 100), Math.floor(a[4] / 10) % 10, a[4] % 10], tg: a[5], c: a[6], dz: a[7], inv: a[8], cy: a[9], a: a[10], ac: a[11], at: a[12], o: a[13], lv: a[14] || 1, tt: a[15] ? a[15][0] : 0, rp: a[15] ? a[15][1] : 0, kc: a[15] ? a[15][2] : 0,
      s: (a[16] || []).map((u) => ({ h: u[0], r: u[1], e: 0, c: 0, f: u[2] })) };
    rally(S, t);
    return t;
  });
  calcBuffs(S);
  S.E = (o.E || []).map((a) => {
    const f = a[6];
    const e = { i: a[0], k: ENEMY_KEYS[a[1]], r: a[2], d: a[3], h: a[4], m: a[5], sl: f & 1 ? 0.5 : 0, sf: 0.4, st: f & 2 ? 0.3 : 0, im: 0, b: 0, ac: 0,
      bn: 0, bt: f & 4 ? 0.5 : 0, vu: f & 128 ? 1 : 0.25, vt: f & 8 ? 0.5 : 0, fz: 0, wt: f & 16 ? 1 : 0, oi: f & 32 ? 1 : 0, oc: 0, cc: 0, rv: f & 64 ? 5 : 0, kb: 0, nr: 0, dm: [0, 0, 0, 0], dn: 0, bo: -1, fo: -1 };
    place(M, e);
    return e;
  });
  return { S, fx: o.f || [] };
}
