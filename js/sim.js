// ============================================================
//  Code Defenders — simulación (solo la ejecuta el anfitrión de la sala)
//  Sin DOM ni red: estado puro + step() + applyAction() + pack()/unpack().
// ============================================================
import {
  CELL, COLS, ROWS, MAX_WAVE, START_MONEY, START_LIFE, PATH_LEN, BLOCKED,
  TOWERS, TOWER_KEYS, ENEMIES, ENEMY_KEYS, pathPos, nearestD, genWave, hpMult, waveBonus,
} from './data.js';

export const STEP = 1 / 30;
export const MAX_LEVEL = 3;

export function newGame() {
  return { ph: 'play', pa: 0, pb: '', w: 0, wt: 0, si: 0, ic: 15, money: START_MONEY, life: START_LIFE, nid: 1, kills: 0, T: [], E: [], _fx: [] };
}

// ---------- utilidades de torres ----------
const lvMult = (l) => 1 + 0.6 * (l - 1);
export const towerRange = (k, l) => (TOWERS[k].range || 0) * (1 + 0.08 * (l - 1));
export const upgradeCost = (t) => Math.round(TOWERS[t.k].cost * 0.8 * t.l);
export const sellValue = (t) => Math.floor(t.inv * 0.6);
export function buildCost(S, k) {
  const d = TOWERS[k];
  return d.cost + (d.extra ? d.extra * S.T.filter((t) => t.k === k).length : 0);
}
export function cellFree(S, cx, cy, ignoreId) {
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
  if (BLOCKED.has(cy * COLS + cx)) return false;
  return !S.T.some((t) => t.x === cx && t.y === cy && t.i !== ignoreId);
}
export const towerAt = (S, cx, cy) => S.T.find((t) => t.x === cx && t.y === cy);
const tx = (t) => t.x * CELL + CELL / 2, ty = (t) => t.y * CELL + CELL / 2;

/** Punto de reunión de los Threads de una Thread Factory (-1 si la ruta queda lejos). */
function rally(t) {
  if (t.k !== 'thread') { t._rd = -1; return; }
  const n = nearestD(tx(t), ty(t));
  t._rd = n.dist <= towerRange('thread', t.l) ? n.d : -1;
}
export const soldierD = (t, j) => t._rd + (j - (t.s.length - 1) / 2) * 14;

function syncSoldiers(t) {
  if (t.k !== 'thread') return;
  const n = TOWERS.thread.units[t.l - 1], hp = TOWERS.thread.uhp * lvMult(t.l);
  while (t.s.length < n) t.s.push({ h: hp, r: 0, e: 0, c: 0 });
}
function releaseSoldiers(t) { for (const s of t.s) s.e = 0; }

function mkTower(S, k, cx, cy, cost) {
  const t = { i: S.nid++, k, x: cx, y: cy, l: 1, c: 0, dz: 0, inv: cost, cy: TOWERS[k].period || 2, a: 0, s: [], _b: 0 };
  syncSoldiers(t); rally(t);
  S.T.push(t);
  return t;
}
function mkEnemy(S, k, d) {
  const m = Math.round(ENEMIES[k].hp * hpMult(Math.max(1, S.w)));
  S.E.push({ i: S.nid++, k, d, h: m, m, sl: 0, sf: 0, st: 0, im: 0, b: 0, ac: 0 });
}

// ---------- acciones de los jugadores ----------
/** Aplica una acción. Devuelve true si cambió algo. */
export function applyAction(S, a) {
  if (!a || typeof a !== 'object') return false;
  if (a.t === 'restart') {
    if (S.ph === 'play') return false;
    Object.assign(S, newGame());
    return true;
  }
  if (S.ph !== 'play') return false;
  switch (a.t) {
    case 'pause':
      S.pa = S.pa ? 0 : 1; S.pb = String(a.n || '').slice(0, 14);
      return true;
    case 'next':
      if (S.ic > 0 && !S.pa) { S.ic = 0.01; return true; }
      return false;
    case 'build': {
      if (!TOWERS[a.k] || !cellFree(S, a.cx, a.cy)) return false;
      const cost = buildCost(S, a.k);
      if (S.money < cost) return false;
      S.money -= cost; mkTower(S, a.k, a.cx, a.cy, cost);
      return true;
    }
    case 'up': {
      const t = S.T.find((q) => q.i === a.id);
      if (!t || t.l >= MAX_LEVEL) return false;
      const cost = upgradeCost(t);
      if (S.money < cost) return false;
      S.money -= cost; t.inv += cost; t.l++;
      syncSoldiers(t); rally(t);
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
      releaseSoldiers(t); rally(t);
      return true;
    }
  }
  return false;
}

// ---------- combate ----------
function damage(S, e, amt) {
  if (e.h <= 0) return;
  e.h -= amt;
  if (e.h > 0) return;
  e.h = 0;
  const def = ENEMIES[e.k];
  S.money += def.rw; S.kills++;
  S._fx.push(['p', Math.round(e._x), Math.round(e._y), ENEMY_KEYS.indexOf(e.k)]);
  if (def.split) for (let n = 0; n < def.split; n++) S._spawn.push(['branch', Math.max(0, e.d - n * 16)]);
}
function inRange(S, x, y, r) {
  const out = [];
  for (const e of S.E) if (e.h > 0 && (e._x - x) ** 2 + (e._y - y) ** 2 <= r * r) out.push(e);
  return out;
}
const first = (list) => list.reduce((b, e) => (!b || e.d > b.d ? e : b), null);

/** Calcula el buff de Linter de cada torre (t._b) y devuelve un Map id->torre. */
export function calcBuffs(S) {
  const lint = S.T.filter((t) => t.k === 'linter' && t.dz <= 0);
  const tById = new Map();
  for (const t of S.T) {
    tById.set(t.i, t);
    let b = 0;
    if (t.k !== 'linter') for (const l of lint) {
      if (Math.hypot(tx(l) - tx(t), ty(l) - ty(t)) <= towerRange('linter', l.l)) b = Math.max(b, TOWERS.linter.buff[l.l - 1]);
    }
    t._b = b;
  }
  return tById;
}

/** Avanza la simulación dt segundos. */
export function step(S, dt) {
  if (S.ph !== 'play' || S.pa) return;
  S._spawn = [];

  // --- oleadas ---
  if (S.ic > 0) {
    S.ic -= dt;
    if (S.ic <= 0) { S.ic = 0; S.w++; S.wt = 0; S.si = 0; S._fx.push(['w', S.w]); }
  } else {
    const q = genWave(S.w);
    S.wt += dt;
    while (S.si < q.length && q[S.si].t <= S.wt) { mkEnemy(S, q[S.si].type, 0); S.si++; }
    if (S.si >= q.length && S.E.length === 0) {
      if (S.w >= MAX_WAVE) { S.ph = 'won'; return; }
      const bonus = waveBonus(S.w);
      S.money += bonus; S.ic = 12;
      S._fx.push(['m', 640, 300, bonus]);
    }
  }

  // --- buffs de Linter ---
  const tById = calcBuffs(S);

  // --- Threads disponibles para bloquear ---
  const free = [];
  for (const t of S.T) {
    if (t.k !== 'thread' || t._rd < 0 || t.dz > 0) continue;
    t.s.forEach((s, j) => { if (s.h > 0 && !s.e) free.push({ t, j, s, d: soldierD(t, j) }); });
  }

  // --- enemigos ---
  for (const e of S.E) {
    const def = ENEMIES[e.k];
    if (e.sl > 0) e.sl -= dt;
    if (e.im > 0) e.im -= dt;
    if (def.regen && e.h < e.m) e.h = Math.min(e.m, e.h + e.m * def.regen * dt);
    if (e.st > 0) {
      e.st -= dt;
    } else if (e.b) {
      const t = tById.get(e.b >> 3), s = t && t.s[e.b & 7];
      if (!s || s.h <= 0 || s.e !== e.i || t.dz > 0) e.b = 0;
      else {
        e.ac -= dt;
        if (e.ac <= 0) {
          e.ac = 0.8; s.h -= def.atk;
          if (s.h <= 0) { s.h = 0; s.r = TOWERS.thread.respawn; s.e = 0; e.b = 0; }
        }
      }
    } else {
      e.d += def.sp * (e.sl > 0 ? 1 - e.sf : 1) * dt;
      if (!def.ghost) {
        for (const o of free) {
          if (!o.s.e && Math.abs(o.d - e.d) < 9) { o.s.e = e.i; e.b = o.t.i * 8 + o.j; e.ac = 0.4; break; }
        }
      }
      if (e.d >= PATH_LEN) { S.life -= def.dmg; e.h = 0; S._fx.push(['h']); }
    }
    const p = pathPos(e.d); e._x = p.x; e._y = p.y;
  }
  const eById = new Map(S.E.map((e) => [e.i, e]));

  // --- torres ---
  for (const t of S.T) {
    if (t.dz > 0) { t.dz -= dt; continue; }
    const d = TOWERS[t.k], x = tx(t), y = ty(t);
    const range = towerRange(t.k, t.l), dm = lvMult(t.l) * (1 + t._b), rm = 1 / (1 + t._b * 0.5);
    if (t.c > 0) t.c -= dt;
    switch (t.k) {
      case 'firewall': {
        if (t.c > 0) break;
        const e = first(inRange(S, x, y, range));
        if (!e) break;
        t.c = d.rate * rm; t.a = Math.atan2(e._y - y, e._x - x);
        S._fx.push(['b', x, y, Math.round(e._x), Math.round(e._y)]);
        damage(S, e, d.dmg * dm);
        break;
      }
      case 'gc': {
        if (t.c > 0) break;
        const e = first(inRange(S, x, y, range));
        if (!e) break;
        t.c = d.rate * rm;
        const cx = e._x, cy = e._y;
        S._fx.push(['a', x, y, Math.round(cx), Math.round(cy), d.splash]);
        for (const o of inRange(S, cx, cy, d.splash)) { o.sl = d.slowT; o.sf = d.slow; damage(S, o, d.dmg * dm); }
        break;
      }
      case 'debugger': {
        if (t.c > 0) break;
        const list = inRange(S, x, y, range);
        if (!list.length) break;
        const e = list.reduce((b, q) => {
          const pb = (ENEMIES[b.k].boss ? 1e9 : 0) + b.m, pq = (ENEMIES[q.k].boss ? 1e9 : 0) + q.m;
          return pq > pb || (pq === pb && q.d > b.d) ? q : b;
        });
        t.c = d.rate * rm; t.a = Math.atan2(e._y - y, e._x - x);
        S._fx.push(['s', x, y, Math.round(e._x), Math.round(e._y)]);
        damage(S, e, d.dmg * dm);
        break;
      }
      case 'balancer': {
        if (t.c > 0) break;
        let e = first(inRange(S, x, y, range));
        if (!e) break;
        t.c = d.rate * rm;
        const pts = [x, y], hit = new Set();
        let dmg = d.dmg * dm;
        for (let h = 0; e && h <= d.hops[t.l - 1]; h++) {
          hit.add(e.i); pts.push(Math.round(e._x), Math.round(e._y));
          const ox = e._x, oy = e._y;
          damage(S, e, dmg); dmg *= d.fall;
          e = inRange(S, ox, oy, d.hopR).filter((q) => !hit.has(q.i))
            .reduce((b, q) => (!b || (q._x - ox) ** 2 + (q._y - oy) ** 2 < (b._x - ox) ** 2 + (b._y - oy) ** 2 ? q : b), null);
        }
        S._fx.push(['c', pts]);
        break;
      }
      case 'docker': {
        const list = inRange(S, x, y, range);
        t.cy -= dt;
        if (t.cy <= 0 && list.length) {
          t.cy = d.cycle;
          const stun = d.stun[t.l - 1];
          for (const e of list) if (e.im <= 0) { e.st = ENEMIES[e.k].boss ? stun / 2 : stun; e.im = e.st + 3; }
          S._fx.push(['d', x, y, Math.round(range)]);
        }
        for (const e of list) damage(S, e, d.dps * dm * dt);
        break;
      }
      case 'backup': {
        t.cy -= dt;
        if (t.cy <= 0) {
          t.cy = d.period;
          const inc = d.income[t.l - 1];
          S.money += inc; S._fx.push(['m', x, y - 14, inc]);
        }
        break;
      }
      case 'thread': {
        const uhp = d.uhp * lvMult(t.l);
        t.s.forEach((s, j) => {
          if (s.h <= 0) {
            s.r -= dt;
            if (s.r <= 0) { s.h = uhp; s.e = 0; s.c = 0; }
            return;
          }
          if (s.e) {
            const e = eById.get(s.e);
            if (!e || e.h <= 0 || e.b !== t.i * 8 + j) { s.e = 0; return; }
            s.c -= dt;
            if (s.c <= 0) { s.c = d.urate * rm; damage(S, e, d.udmg * dm); }
          } else if (s.h < uhp) s.h = Math.min(uhp, s.h + uhp * 0.05 * dt);
        });
        break;
      }
    }
  }

  // --- limpieza ---
  S.E = S.E.filter((e) => e.h > 0);
  for (const [k, d] of S._spawn) { mkEnemy(S, k, d); const e = S.E[S.E.length - 1], p = pathPos(e.d); e._x = p.x; e._y = p.y; }
  if (S.life <= 0) { S.life = 0; S.ph = 'lost'; }
}

// ---------- serialización (lo que viaja por la red) ----------
const r1 = (n) => Math.round(n * 10) / 10;

export function pack(S, fx) {
  return JSON.stringify({
    p: S.ph, pa: S.pa, pb: S.pb, w: S.w, wt: r1(S.wt), si: S.si, ic: r1(S.ic), mo: Math.floor(S.money), li: S.life, n: S.nid, ki: S.kills,
    T: S.T.map((t) => [t.i, TOWER_KEYS.indexOf(t.k), t.x, t.y, t.l, r1(t.c), r1(t.dz), t.inv, r1(t.cy), r1(t.a), t.s.map((s) => [r1(s.h), r1(s.r), s.e, r1(s.c)])]),
    E: S.E.map((e) => [e.i, ENEMY_KEYS.indexOf(e.k), r1(e.d), Math.ceil(e.h), e.m, r1(e.sl), e.sf, r1(e.st), r1(e.im), e.b, r1(e.ac)]),
    f: fx || [],
  });
}

export function unpack(str) {
  const o = JSON.parse(str);
  const S = { ph: o.p, pa: o.pa, pb: o.pb, w: o.w, wt: o.wt, si: o.si, ic: o.ic, money: o.mo, life: o.li, nid: o.n, kills: o.ki, _fx: [] };
  S.T = (o.T || []).map((a) => {
    const t = { i: a[0], k: TOWER_KEYS[a[1]], x: a[2], y: a[3], l: a[4], c: a[5], dz: a[6], inv: a[7], cy: a[8], a: a[9], _b: 0,
      s: (a[10] || []).map((s) => ({ h: s[0], r: s[1], e: s[2], c: s[3] })) };
    rally(t);
    return t;
  });
  calcBuffs(S);
  S.E = (o.E || []).map((a) => {
    const e = { i: a[0], k: ENEMY_KEYS[a[1]], d: a[2], h: a[3], m: a[4], sl: a[5], sf: a[6], st: a[7], im: a[8], b: a[9], ac: a[10] };
    const p = pathPos(e.d); e._x = p.x; e._y = p.y;
    return e;
  });
  return { S, fx: o.f || [] };
}
