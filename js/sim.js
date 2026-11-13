// ============================================================
//  Code Defenders — simulación (solo la ejecuta el anfitrión de la sala)
//  Sin DOM ni red: estado puro + step() + applyAction() + pack()/unpack().
// ============================================================
import {
  CELL, COLS, ROWS, MAPS, SPEEDS, MAX_TIER, TOWERS, TOWER_KEYS, ENEMIES, ENEMY_KEYS, CARDS,
  pathPos, nearestD, genWave, hpMult, waveBonus, skipBonus, stats, pathLock, skin, calcMods,
} from './data.js';

export const STEP = 1 / 30;
export const TARGET_MODES = ['Primero', 'Último', 'Más fuerte', 'Más cercano'];
const BOMB_CD = 50, GATE_CD = 45, GATE_T = 4, SWITCH_CD = 8, BOMB_R = 95;

export function newGame(map = 0) {
  const M = MAPS[map] ? MAPS[map] : MAPS[0];
  const S = {
    ph: 'play', pa: 0, pb: '', au: 0, sp: 1, map: MAPS[map] ? map : 0, w: 0, wt: 0, si: 0, ic: 20,
    money: M.money, life: M.life, nid: 1, kills: 0, T: [], E: [],
    ob: M.obs.map(() => 0), sw: M.forks.map(() => 0), swc: 0, tr: M.traps.map(() => ({ c: 0, a: 0 })),
    md: [], cd: null, _fx: [], _spawn: [], _boom: [], _bounty: 0,
  };
  S._m = calcMods(S.md);
  offerCards(S);
  return S;
}

// ---------- utilidades de torres ----------
export const tStats = (t) => stats(t.k, t.p);
/** Alcance real de la torre (incluye aura del Linter y parches). */
export const tRange = (S, t) => tStats(t).range * (1 + (t._rb || 0)) * S._m.range;
export function upgradeCost(S, t, i) {
  const u = TOWERS[t.k].paths[i].ups[t.p[i]];
  return u ? Math.round(u.c * (1 - (t._disc || 0)) * (1 - S._m.upDisc)) : 0;
}
/** '' si la rama i de la torre t se puede mejorar; si no, el motivo (incluye la regla de Tier 5 único). */
export function lockReason(S, t, i) {
  const l = pathLock(t.p, i);
  if (l) return l;
  if (t.p[i] === MAX_TIER - 1 && S.T.some((q) => q !== t && q.k === t.k && q.p[i] >= MAX_TIER)) return 'Ya existe un Tier 5 de esta rama en el mapa';
  return '';
}
export const sellValue = (t) => Math.floor(t.inv * 0.7);
export function buildCost(S, k) {
  const d = TOWERS[k];
  return d.cost + (d.extra ? d.extra * S.T.filter((t) => t.k === k).length : 0);
}
/** false si ya se ha alcanzado el máximo de torres de ese tipo (Backups). */
export const underLimit = (S, k) => !TOWERS[k].max || S.T.filter((t) => t.k === k).length < TOWERS[k].max;
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

function mkTower(S, k, cx, cy, cost) {
  const t = { i: S.nid++, k, x: cx, y: cy, p: [0, 0, 0], tg: k === 'debugger' ? 2 : 0, c: 0, dz: 0, inv: cost, cy: 2, a: 0, ac: 0, at: 0, s: [] };
  syncSoldiers(S, t); rally(S, t);
  S.T.push(t);
  return t;
}
function mkEnemy(S, k, r, d) {
  const M = MAPS[S.map];
  const m = Math.round(ENEMIES[k].hp * hpMult(Math.max(1, S.w)) * M.hp * S._m.ehp);
  const e = { i: S.nid++, k, r, d, h: m, m, sl: 0, sf: 0, st: 0, im: 0, b: 0, ac: 0, bn: 0, bt: 0, vu: 0, vt: 0, fz: 0, wt: 0, oi: 0, oc: 0, cc: 0, rv: 0 };
  place(M, e);
  S.E.push(e);
  return e;
}

function offerCards(S) {
  const pool = CARDS.map((_, i) => i), out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  S.cd = out;
}

// ---------- acciones de los jugadores ----------
/** Aplica una acción. Devuelve true si cambió algo. */
export function applyAction(S, a) {
  if (!a || typeof a !== 'object') return false;
  if (a.t === 'restart') {
    if (S.ph === 'play') return false;
    Object.assign(S, newGame(S.map));
    return true;
  }
  if (S.ph !== 'play') return false;
  const M = MAPS[S.map];
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
      if (CARDS[id].now) CARDS[id].now(S);
      S._m = calcMods(S.md); S.cd = null;
      S._fx.push(['t', 640, 150, 'PARCHE: ' + CARDS[id].n, '#b6ff3f', 2.2]);
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
      if (!TOWERS[a.k] || !underLimit(S, a.k) || !cellFree(S, a.cx, a.cy)) return false;
      const cost = buildCost(S, a.k);
      if (S.money < cost) return false;
      S.money -= cost; mkTower(S, a.k, a.cx, a.cy, cost);
      return true;
    }
    case 'up': {
      const t = S.T.find((q) => q.i === a.id), i = a.p | 0;
      if (!t || i < 0 || i > 2 || lockReason(S, t, i)) return false;
      calcBuffs(S);
      const cost = upgradeCost(S, t, i);
      if (S.money < cost) return false;
      S.money -= cost; t.inv += cost; t.p = t.p.slice(); t.p[i]++;
      syncSoldiers(S, t); rally(S, t);
      return true;
    }
    case 'sell': {
      const t = S.T.find((q) => q.i === a.id);
      if (!t) return false;
      S.money += sellValue(t);
      S.T = S.T.filter((q) => q !== t);
      return true;
    }
    case 'move': {
      const t = S.T.find((q) => q.i === a.id);
      if (!t || !cellFree(S, a.cx, a.cy, t.i)) return false;
      t.x = a.cx; t.y = a.cy; t.dz = 3; // 3 s "reiniciando" tras moverla
      for (const s of t.s) s.e = 0;
      rally(S, t);
      return true;
    }
    case 'tgt': {
      const t = S.T.find((q) => q.i === a.id);
      if (!t) return false;
      t.tg = (t.tg + 1) % TARGET_MODES.length;
      return true;
    }
    case 'abil': {
      const t = S.T.find((q) => q.i === a.id);
      return !!t && !S.pa && !S.cd && useAbility(S, t);
    }
    case 'clear': {
      const i = a.i | 0, o = M.obs[i];
      if (!o || S.ob[i] || S.money < o[2]) return false;
      S.money -= o[2]; S.ob[i] = 1;
      S._fx.push(['f', o[0] * CELL + 20, o[1] * CELL + 20, 40, '#9aa7ff']);
      return true;
    }
    case 'trap': {
      const i = a.i | 0, def = M.traps[i], tr = S.tr[i];
      if (!def || tr.c > 0 || S.pa || S.cd) return false;
      if (def.t === 'bomb') {
        tr.c = BOMB_CD;
        const x = def.x * CELL + 20, y = def.y * CELL + 20;
        S._boom.push([x, y, 45 * hpMult(Math.max(1, S.w)) * M.hp, BOMB_R, 1, '#ffb03f', 1]);
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
  if (bonus > 0) { S.money += bonus; S._fx.push(['t', 640, 340, `+${bonus} CPU por saltar`, '#ffe66b', 1.4]); }
  S.ic = left;
}

function useAbility(S, t) {
  const s = tStats(t), M = MAPS[S.map];
  if (!s.ab || t.ac > 0 || t.dz > 0) return false;
  t.ac = s.abCd * S._m.abCd;
  const x = tx(t), y = ty(t), col = skin(t.k, t.p).accent;
  const dm = (1 + (t._b || 0)) * S._m.dmg * S._m.tdm[t.k];
  const alive = S.E.filter((e) => e.h > 0);
  switch (s.ab) {
    case 'lockdown':
      for (const q of s.abAll ? S.T.filter((q) => q.k === 'firewall') : [t]) q.at = s.abT;
      break;
    case 'stw':
      for (const e of alive) {
        stunE(e, s.abT);
        if (s.abDmg) damage(S, e, e.m * (ENEMIES[e.k].boss ? 0.05 : s.abDmg), 'x');
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
        if (ENEMIES[e.k].boss) damage(S, e, e.m * s.abBoss, 'x'); else damage(S, e, e.h + 1, 'x');
      }
      break;
    }
    case 'prune': {
      const r = tRange(S, t);
      for (const e of alive) {
        if (ENEMIES[e.k].fly) continue;
        if (!s.abAll && (e._x - x) ** 2 + (e._y - y) ** 2 > r * r) continue;
        damage(S, e, e.m * (ENEMIES[e.k].boss ? 0.08 : s.abDmg), 'a');
        stunE(e, 3);
      }
      S._fx.push(s.abAll ? ['g', col] : ['d', x, y, Math.round(r), col]);
      break;
    }
    case 'surge': {
      let n = 0;
      for (const e of alive) {
        if (n++ < 40) S._fx.push(['z', Math.round(e._x), Math.round(e._y)]);
        damage(S, e, s.dmg * s.abPow * dm * (e.wt > 0 ? s.wetM * S._m.shock : 1), 'e', 99);
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
  }
  S._fx.push(['t', x, y - 30, s.ab === 'kill' ? 'kill -9' : 'HABILIDAD', col, 1]);
  return true;
}

// ---------- daño y estados alterados ----------
/** type: k cinético · e eléctrico · x explosivo · a ácido · f fuego. prc = blindaje que ignora. */
function damage(S, e, amt, type, prc) {
  if (e.h <= 0) return;
  const def = ENEMIES[e.k];
  if (def.armor) {
    if (type === 'x' || type === 'a') amt *= 1.5;
    else if (type !== 'f') {
      amt -= Math.max(0, def.armor - (prc || 0));
      if (amt <= 0) { if (Math.random() < 0.15) S._fx.push(['r', Math.round(e._x), Math.round(e._y)]); return; }
    }
  }
  if (e.vt > 0) amt *= 1 + e.vu;
  e.h -= amt;
  if (e.h > 0) return;
  e.h = 0;
  S.money += def.rw * S._m.kill * (1 + S._bounty); S.kills++;
  S._fx.push(['p', Math.round(e._x), Math.round(e._y), ENEMY_KEYS.indexOf(e.k)]);
  if (def.split) for (let n = 0; n < def.split; n++) S._spawn.push(['branch', e.r, Math.max(0, e.d - n * 16)]);
  if (e.fz > 0) S._boom.push([e._x, e._y, Math.min(400, e.m * 0.3), 60, 0, '#c77dff']);
  if (S._m.boom) S._boom.push([e._x, e._y, Math.min(500, e.m * S._m.boom), 50, 0, '#ff5a5a']);
}
function slowE(e, f, t) {
  if (!f) return;
  if (e.sl <= 0 || f >= e.sf) { e.sf = f; e.sl = Math.max(e.sl, t); }
}
function stunE(e, t) {
  if (!t) return;
  e.st = Math.max(e.st, ENEMIES[e.k].boss ? t / 2 : t);
}
function vulnE(e, v, t) {
  if (!v) return;
  if (e.vt <= 0 || v >= e.vu) { e.vu = v; e.vt = Math.max(e.vt, t); }
}
/** COMBO Stack Overflow: un enemigo ENREDADO que recibe fuego explota en área. */
function ignite(S, e) {
  if (e.oi <= 0 || e.h <= 0) return;
  e.oi = 0; e.oc = 3;
  S._boom.push([e._x, e._y, Math.min(900, 25 + e.m * 0.1) * S._m.combo, 55, 1, '#ff9d00']);
  S._fx.push(['t', Math.round(e._x), Math.round(e._y) - 18, 'STACK OVERFLOW', '#ff9d00', 0.8]);
}
function burnE(S, e, dps, t, fire) {
  if (!dps) return;
  e.bn = Math.max(e.bn, dps); e.bt = Math.max(e.bt, t);
  if (fire) ignite(S, e);
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
  const cfAll = lint.some((l) => l.at > 0 && tStats(l).abAll);
  const tById = new Map();
  let bounty = 0;
  for (const t of S.T) {
    tById.set(t.i, t);
    let b = 0, rr = 0, rb = 0, disc = 0, det = 0, ap = 0, cf = cfAll ? 1 : 0;
    for (const l of lint) {
      if (l === t) continue;
      const ls = tStats(l);
      if (Math.hypot(tx(l) - tx(t), ty(l) - ty(t)) > ls.range * m.range) continue;
      disc = Math.max(disc, ls.disc);
      if (t.k === 'linter') continue;
      b = Math.max(b, ls.buff * m.tdm.linter); rr = Math.max(rr, ls.rateBuff); rb = Math.max(rb, ls.rbuff);
      det = det || ls.adetect; ap = Math.max(ap, ls.apierce);
      if (l.at > 0) cf = 1;
    }
    t._b = b; t._rr = rr; t._rb = rb; t._disc = disc; t._det = det; t._ap = ap; t._cf = cf;
    t._pad = M.padAt.has(t.y * COLS + t.x) ? 1 : 0;
    if (t.k === 'backup') bounty = Math.max(bounty, tStats(t).bounty);
  }
  S._bounty = bounty;
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
      for (const en of M.entries) if (en.from === S.w && S.w > 1) S._fx.push(['t', 640, 190, '¡NUEVO PUERTO ABIERTO!', '#ff3f5a', 3]);
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
    if (e.bt > 0) { e.bt -= dt; damage(S, e, e.bn * m.burn * dt, 'f'); } else e.bn = 0;
    if (e.h <= 0) continue;
    if (def.regen && e.h < e.m && e.bt <= 0) e.h = Math.min(e.m, e.h + e.m * def.regen * dt);
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
      let nd = e.d + def.sp * (e.sl > 0 ? 1 - e.sf : 1) * dt;
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
        if (z === 'heat') burnE(S, e, 3 + S.w * 1.5, 1, true);
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
    const s = tStats(t), x = tx(t), y = ty(t), col = skin(t.k, t.p).accent;
    const range = tRange(S, t);
    const dm = (1 + t._b) * (t._pad ? 1.3 : 1) * m.dmg * m.tdm[t.k];
    const cd = m.rate / ((1 + t._rr) * (t._cf ? 2 : 1));
    const det = s.detect || t._det || m.detect;
    const prc = s.pierce + t._ap + m.pierce;
    const hit = (e, base, type) => {
      let d = base * dm;
      if (s.heavy > 1 && ENEMIES[e.k].heavy) d *= s.heavy;
      if (s.crit && Math.random() < s.crit) { d *= s.critM; S._fx.push(['x', Math.round(e._x), Math.round(e._y)]); }
      damage(S, e, d, type || s.type, prc);
    };
    if (t.c > 0) t.c -= dt;
    t.cy -= dt;
    switch (t.k) {
      case 'firewall': {
        if (t.c > 0) break;
        const list = pick(S, x, y, range, det, t.tg, s.targets);
        if (!list.length) break;
        t.c = s.rate * cd * (t.at > 0 ? 1 / 3 : 1);
        t.a = Math.atan2(list[0]._y - y, list[0]._x - x);
        const one = (e) => { burnE(S, e, s.burn, s.burnT, true); slowE(e, s.slow, 1.5); hit(e, s.dmg); };
        for (const e of list) {
          if (s.line) {
            const an = Math.atan2(e._y - y, e._x - x), ex = x + Math.cos(an) * range, ey = y + Math.sin(an) * range;
            S._fx.push(['s', x, y, Math.round(ex), Math.round(ey), col]);
            for (const o of S.E) if (o.h > 0 && visible(S, o, det) && distSeg(o._x, o._y, x, y, ex, ey) < 14) one(o);
          } else {
            S._fx.push(['b', x, y, Math.round(e._x), Math.round(e._y), col]);
            if (s.splash) {
              S._fx.push(['f', Math.round(e._x), Math.round(e._y), s.splash, col]);
              for (const o of inRange(S, e._x, e._y, s.splash, true)) if (o !== e) { burnE(S, o, s.burn, s.burnT, true); hit(o, s.dmg * 0.5, 'f'); }
            }
            one(e);
          }
        }
        break;
      }
      case 'gc': {
        if (s.pulse && t.cy <= 0) {
          const all = inRange(S, x, y, range, true);
          if (all.length) { t.cy = s.pulse; for (const e of all) stunE(e, 1.5); S._fx.push(['d', x, y, Math.round(range), col]); }
        }
        if (t.c > 0) break;
        const list = pick(S, x, y, range, det, t.tg, s.targets);
        if (!list.length) break;
        t.c = s.rate * cd;
        for (const e of list) {
          const cx = e._x, cy = e._y;
          S._fx.push(['a', x, y, Math.round(cx), Math.round(cy), Math.round(s.splash), col]);
          for (const o of inRange(S, cx, cy, s.splash, true)) {
            slowE(o, s.slow, s.slowT); vulnE(o, s.vuln, 3);
            o.wt = Math.max(o.wt, s.wetT * m.wet);
            burnE(S, o, s.burn, 3, false);
            if (s.finalizer) o.fz = 3;
            hit(o, s.dmg);
          }
        }
        break;
      }
      case 'debugger': {
        if (s.mark && t.cy <= 0) {
          const e = pick(S, x, y, range, det, 2, 1)[0];
          if (e) { t.cy = s.mark; vulnE(e, 1, 4); S._fx.push(['k', Math.round(e._x), Math.round(e._y)]); }
        }
        if (t.c > 0) break;
        const list = pick(S, x, y, range, det, t.tg, s.targets);
        if (!list.length) break;
        t.c = s.rate * cd; t.a = Math.atan2(list[0]._y - y, list[0]._x - x);
        for (const e of list) {
          S._fx.push(['s', x, y, Math.round(e._x), Math.round(e._y), col]);
          stunE(e, s.stun); slowE(e, s.slow, s.slowT);
          if (s.reveal) e.rv = 30;
          if (s.splash) {
            S._fx.push(['f', Math.round(e._x), Math.round(e._y), s.splash, col]);
            for (const o of inRange(S, e._x, e._y, s.splash, true)) if (o !== e) hit(o, s.dmg * 0.4, 'x');
          }
          hit(e, s.dmg);
        }
        break;
      }
      case 'balancer': {
        if (t.c > 0) break;
        const starts = pick(S, x, y, range, det, t.tg, s.chains);
        if (!starts.length) break;
        t.c = s.rate * cd;
        const done = new Set();
        for (let e of starts) {
          if (done.has(e.i)) continue;
          const pts = [x, y];
          let dmg = s.dmg;
          for (let h = 0; e && h <= s.hops; h++) {
            done.add(e.i); pts.push(Math.round(e._x), Math.round(e._y));
            const ox = e._x, oy = e._y;
            slowE(e, s.slow, 1.5); stunE(e, s.stun);
            if (e.wt > 0) {
              // COMBO Cortocircuito: enemigo refrigerado + electricidad
              if (e.cc <= 0) { e.cc = 2; stunE(e, 0.25); S._fx.push(['z', Math.round(ox), Math.round(oy)]); }
              hit(e, dmg * s.wetM * m.shock);
            } else hit(e, dmg);
            dmg *= s.fall;
            e = inRange(S, ox, oy, s.hopR, det).filter((q) => !done.has(q.i))
              .reduce((b, q) => (!b || (q._x - ox) ** 2 + (q._y - oy) ** 2 < (b._x - ox) ** 2 + (b._y - oy) ** 2 ? q : b), null);
          }
          S._fx.push(['c', pts, col]);
        }
        break;
      }
      case 'docker': {
        const list = inRange(S, x, y, range, true).filter((e) => !ENEMIES[e.k].fly);
        if (t.cy <= 0 && list.length) {
          t.cy = s.cycle;
          for (const e of list) if (e.im <= 0) { stunE(e, s.stun); e.im = e.st + 2; }
          S._fx.push(['d', x, y, Math.round(range), col]);
        }
        for (const e of list) {
          const boss = ENEMIES[e.k].boss;
          slowE(e, s.slow, 0.25); vulnE(e, s.vuln, 0.25);
          if (e.oc <= 0) e.oi = Math.max(e.oi, s.oilT);
          burnE(S, e, s.burn, 3, false);
          if (s.execute && !boss && e.h < e.m * s.execute) { S._fx.push(['x', Math.round(e._x), Math.round(e._y)]); damage(S, e, e.h + 1, 'a'); continue; }
          hit(e, s.dps * dt * (boss ? s.bossM : 1));
        }
        break;
      }
      case 'backup': {
        if (t.cy <= 0) {
          t.cy = s.period;
          const inc = Math.round(s.income * m.tdm.backup);
          S.money += inc; S._fx.push(['m', x, y - 14, inc]);
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

  finish(S);
}

/** Explosiones pendientes, limpieza de muertos y fin de partida. También se usa tras una acción. */
function finish(S) {
  for (let n = 0; n < S._boom.length && n < 80; n++) {
    const [bx, by, bd, br, fire, col, stun] = S._boom[n];
    S._fx.push(['f', Math.round(bx), Math.round(by), br, col]);
    for (const o of inRange(S, bx, by, br, true)) {
      if (stun) stunE(o, 1);
      damage(S, o, bd, 'x');
      if (fire) { burnE(S, o, 4 + S.w, 2, false); ignite(S, o); }
    }
  }
  S._boom.length = 0;
  if (S.E.some((e) => e.h <= 0)) S.E = S.E.filter((e) => e.h > 0);
  for (const [k, r, d] of S._spawn) mkEnemy(S, k, r, d);
  S._spawn.length = 0;
  if (S.life <= 0) { S.life = 0; S.ph = 'lost'; }
}
/** Llamar tras applyAction para resolver explosiones/bajas provocadas por habilidades y trampas. */
export function settle(S) { if (S.ph === 'play' && (S._boom.length || S._spawn.length || S.E.some((e) => e.h <= 0))) finish(S); }

function endWave(S) {
  const M = MAPS[S.map];
  let bonus = waveBonus(S.w), heal = 0, interest = 0, cap = 0;
  for (const t of S.T) {
    if (t.k !== 'backup') continue;
    const s = tStats(t);
    bonus += s.waveBonus; heal += s.heal;
    if (s.interest > interest) { interest = s.interest; cap = s.intCap; }
  }
  if (interest) bonus += Math.min(cap, Math.floor(S.money * interest));
  bonus = Math.round(bonus * S._m.wave);
  S.money += bonus;
  if (heal && S.life < M.life) { const b = S.life; S.life = Math.min(M.life, S.life + heal); S._fx.push(['l', S.life - b]); }
  S._fx.push(['m', 640, 300, bonus]);
  S.ic = 12;
  if (S.w % 5 === 0) offerCards(S); // tras cada jefe: elegir parche
  if (S.au) callEarly(S, 1);
}

// ---------- serialización (lo que viaja por la red) ----------
const r1 = (n) => Math.round(n * 10) / 10;

export function pack(S, fx) {
  return JSON.stringify({
    p: S.ph, pa: S.pa, pb: S.pb, au: S.au, sp: S.sp, mp: S.map, w: S.w, wt: r1(S.wt), si: S.si, ic: r1(S.ic), mo: Math.floor(S.money), li: S.life, n: S.nid, ki: S.kills,
    ob: S.ob.join(''), sw: S.sw.join(''), sc: Math.ceil(Math.max(0, S.swc)), tr: S.tr.map((t) => [Math.ceil(Math.max(0, t.c)), r1(Math.max(0, t.a))]), md: S.md, cd: S.cd,
    T: S.T.map((t) => {
      const a = [t.i, TOWER_KEYS.indexOf(t.k), t.x, t.y, t.p[0] * 100 + t.p[1] * 10 + t.p[2], t.tg, r1(Math.max(0, t.c)), r1(Math.max(0, t.dz)), t.inv, r1(t.cy), r1(t.a), Math.ceil(Math.max(0, t.ac)), r1(Math.max(0, t.at))];
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
  const S = { ph: o.p, pa: o.pa, pb: o.pb, au: o.au || 0, sp: o.sp || 1, map: o.mp || 0, w: o.w, wt: o.wt, si: o.si, ic: o.ic, money: o.mo, life: o.li, nid: o.n, kills: o.ki,
    ob: String(o.ob || '').split('').map(Number), sw: String(o.sw || '').split('').map(Number), swc: o.sc || 0, tr: (o.tr || []).map((a) => ({ c: a[0], a: a[1] })),
    md: o.md || [], cd: o.cd || null, _fx: [], _spawn: [], _boom: [], _bounty: 0 };
  S._m = calcMods(S.md);
  const M = MAPS[S.map];
  S.T = (o.T || []).map((a) => {
    const t = { i: a[0], k: TOWER_KEYS[a[1]], x: a[2], y: a[3], p: [Math.floor(a[4] / 100), Math.floor(a[4] / 10) % 10, a[4] % 10], tg: a[5], c: a[6], dz: a[7], inv: a[8], cy: a[9], a: a[10], ac: a[11], at: a[12],
      s: (a[13] || []).map((u) => ({ h: u[0], r: u[1], e: 0, c: 0, f: u[2] })) };
    rally(S, t);
    return t;
  });
  calcBuffs(S);
  S.E = (o.E || []).map((a) => {
    const f = a[6];
    const e = { i: a[0], k: ENEMY_KEYS[a[1]], r: a[2], d: a[3], h: a[4], m: a[5], sl: f & 1 ? 0.5 : 0, sf: 0.4, st: f & 2 ? 0.3 : 0, im: 0, b: 0, ac: 0,
      bn: 0, bt: f & 4 ? 0.5 : 0, vu: f & 128 ? 1 : 0.25, vt: f & 8 ? 0.5 : 0, fz: 0, wt: f & 16 ? 1 : 0, oi: f & 32 ? 1 : 0, oc: 0, cc: 0, rv: f & 64 ? 5 : 0 };
    place(M, e);
    return e;
  });
  return { S, fx: o.f || [] };
}
