// ============================================================
//  Code Defenders — simulación (solo la ejecuta el anfitrión de la sala)
//  Sin DOM ni red: estado puro + step() + applyAction() + pack()/unpack().
// ============================================================
import {
  CELL, COLS, ROWS, MAX_WAVE, START_MONEY, START_LIFE, PATH_LEN, BLOCKED,
  TOWERS, TOWER_KEYS, ENEMIES, ENEMY_KEYS, pathPos, nearestD, genWave, hpMult, waveBonus,
  stats, pathLock, skin,
} from './data.js';

export const STEP = 1 / 30;

export function newGame() {
  return { ph: 'play', pa: 0, pb: '', au: 0, w: 0, wt: 0, si: 0, ic: 15, money: START_MONEY, life: START_LIFE, nid: 1, kills: 0, T: [], E: [], _fx: [] };
}

// ---------- utilidades de torres ----------
export const tStats = (t) => stats(t.k, t.p);
/** Alcance real de la torre (incluye el aura de alcance del Linter). */
export const tRange = (t) => tStats(t).range * (1 + (t._rb || 0));
export function upgradeCost(t, i) {
  const u = TOWERS[t.k].paths[i].ups[t.p[i]];
  return u ? Math.round(u.c * (1 - (t._disc || 0))) : 0;
}
export const sellValue = (t) => Math.floor(t.inv * 0.7);
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
  t._rd = n.dist <= tStats(t).range ? n.d : -1;
}
export const soldierD = (t, j) => t._rd + (j - (t.s.length - 1) / 2) * 14;

function syncSoldiers(t) {
  if (t.k !== 'thread') return;
  const s = tStats(t);
  while (t.s.length < s.units) t.s.push({ h: s.uhp, r: 0, e: 0, c: 0 });
  if (t.s.length > s.units) t.s.length = s.units;
  for (const u of t.s) if (u.h > 0) u.h = Math.max(u.h, s.uhp * 0.5);
}
function releaseSoldiers(t) { for (const s of t.s) s.e = 0; }

function mkTower(S, k, cx, cy, cost) {
  const t = { i: S.nid++, k, x: cx, y: cy, p: [0, 0, 0], c: 0, dz: 0, inv: cost, cy: 2, a: 0, s: [], _b: 0, _rr: 0, _rb: 0, _disc: 0 };
  syncSoldiers(t); rally(t);
  S.T.push(t);
  return t;
}
function mkEnemy(S, k, d) {
  const m = Math.round(ENEMIES[k].hp * hpMult(Math.max(1, S.w)));
  S.E.push({ i: S.nid++, k, d, h: m, m, sl: 0, sf: 0, st: 0, im: 0, b: 0, ac: 0, bn: 0, bt: 0, vu: 0, vt: 0, fz: 0 });
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
    case 'auto':
      S.au = S.au ? 0 : 1;
      if (S.au && S.ic > 1) S.ic = 1;
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
      const t = S.T.find((q) => q.i === a.id), i = a.p | 0;
      if (!t || i < 0 || i > 2 || pathLock(t.p, i)) return false;
      calcBuffs(S);
      const cost = upgradeCost(t, i);
      if (S.money < cost) return false;
      S.money -= cost; t.inv += cost; t.p = t.p.slice(); t.p[i]++;
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

// ---------- estados alterados de los enemigos ----------
function damage(S, e, amt) {
  if (e.h <= 0) return;
  if (e.vt > 0) amt *= 1 + e.vu;
  e.h -= amt;
  if (e.h > 0) return;
  e.h = 0;
  const def = ENEMIES[e.k];
  S.money += def.rw; S.kills++;
  S._fx.push(['p', Math.round(e._x), Math.round(e._y), ENEMY_KEYS.indexOf(e.k)]);
  if (def.split) for (let n = 0; n < def.split; n++) S._spawn.push(['branch', Math.max(0, e.d - n * 16)]);
  if (e.fz > 0) S._boom.push([e._x, e._y, Math.min(400, e.m * 0.3)]);
}
function slowE(e, f, t) {
  if (!f) return;
  if (e.sl <= 0 || f >= e.sf) { e.sf = f; e.sl = Math.max(e.sl, t); }
}
function stunE(e, t) {
  if (!t) return;
  e.st = Math.max(e.st, ENEMIES[e.k].boss ? t / 2 : t);
}
function burnE(e, dps, t) {
  if (!dps) return;
  e.bn = Math.max(e.bn, dps); e.bt = Math.max(e.bt, t);
}
function vulnE(e, v, t) {
  if (!v) return;
  if (e.vt <= 0 || v >= e.vu) { e.vu = v; e.vt = Math.max(e.vt, t); }
}

function inRange(S, x, y, r) {
  const out = [];
  for (const e of S.E) if (e.h > 0 && (e._x - x) ** 2 + (e._y - y) ** 2 <= r * r) out.push(e);
  return out;
}
const byFirst = (a, b) => b.d - a.d;

/** Calcula los efectos del Linter sobre cada torre y devuelve un Map id->torre. */
export function calcBuffs(S) {
  const lint = S.T.filter((t) => t.k === 'linter' && t.dz <= 0);
  const tById = new Map();
  for (const t of S.T) {
    tById.set(t.i, t);
    let b = 0, rr = 0, rb = 0, disc = 0;
    for (const l of lint) {
      if (l === t) continue;
      const ls = tStats(l);
      if (Math.hypot(tx(l) - tx(t), ty(l) - ty(t)) > ls.range) continue;
      disc = Math.max(disc, ls.disc);
      if (t.k === 'linter') continue;
      b = Math.max(b, ls.buff); rr = Math.max(rr, ls.rateBuff); rb = Math.max(rb, ls.rbuff);
    }
    t._b = b; t._rr = rr; t._rb = rb; t._disc = disc;
  }
  return tById;
}

/** Avanza la simulación dt segundos. */
export function step(S, dt) {
  if (S.ph !== 'play' || S.pa) return;
  S._spawn = []; S._boom = [];

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
      endWave(S);
    }
  }

  const tById = calcBuffs(S);

  // --- Threads disponibles para bloquear ---
  const free = [];
  for (const t of S.T) {
    if (t.k !== 'thread' || t._rd < 0 || t.dz > 0) continue;
    const gb = tStats(t).ghostBlock;
    t.s.forEach((s, j) => { if (s.h > 0 && !s.e) free.push({ t, j, s, gb, d: soldierD(t, j) }); });
  }

  // --- enemigos ---
  for (const e of S.E) {
    const def = ENEMIES[e.k];
    if (e.sl > 0) e.sl -= dt;
    if (e.im > 0) e.im -= dt;
    if (e.vt > 0) e.vt -= dt;
    if (e.fz > 0) e.fz -= dt;
    if (e.bt > 0) { e.bt -= dt; damage(S, e, e.bn * dt); } else e.bn = 0;
    if (e.h <= 0) continue;
    if (def.regen && e.h < e.m) e.h = Math.min(e.m, e.h + e.m * def.regen * dt);
    if (e.st > 0) {
      e.st -= dt;
    } else if (e.b) {
      const t = tById.get(e.b >> 3), s = t && t.s[e.b & 7];
      if (!s || s.h <= 0 || s.e !== e.i || t.dz > 0) e.b = 0;
      else {
        e.ac -= dt;
        if (e.ac <= 0) {
          e.ac = 0.8 / (1 - tStats(t).uslow); s.h -= def.atk;
          if (s.h <= 0) { s.h = 0; s.r = tStats(t).respawn; s.e = 0; e.b = 0; }
        }
      }
    } else {
      e.d += def.sp * (e.sl > 0 ? 1 - e.sf : 1) * dt;
      for (const o of free) {
        if (def.ghost && !o.gb) continue;
        if (!o.s.e && Math.abs(o.d - e.d) < 9) { o.s.e = e.i; e.b = o.t.i * 8 + o.j; e.ac = 0.4; break; }
      }
      if (e.d >= PATH_LEN) { S.life -= def.dmg; e.h = 0; S._fx.push(['h']); }
    }
    const p = pathPos(e.d); e._x = p.x; e._y = p.y;
  }
  const eById = new Map(S.E.map((e) => [e.i, e]));

  // --- torres ---
  for (const t of S.T) {
    if (t.dz > 0) { t.dz -= dt; continue; }
    const s = tStats(t), x = tx(t), y = ty(t), col = skin(t.k, t.p).accent;
    const range = s.range * (1 + t._rb), dm = 1 + t._b, cd = 1 / (1 + t._b * 0.5 + t._rr);
    const hit = (e, base) => {
      let d = base * dm;
      if (s.heavy > 1 && ENEMIES[e.k].heavy) d *= s.heavy;
      if (s.crit && Math.random() < s.crit) { d *= s.critM; S._fx.push(['x', Math.round(e._x), Math.round(e._y)]); }
      damage(S, e, d);
    };
    if (t.c > 0) t.c -= dt;
    t.cy -= dt;
    switch (t.k) {
      case 'firewall': {
        if (t.c > 0) break;
        const list = inRange(S, x, y, range).sort(byFirst).slice(0, s.targets);
        if (!list.length) break;
        t.c = s.rate * cd; t.a = Math.atan2(list[0]._y - y, list[0]._x - x);
        for (const e of list) {
          S._fx.push(['b', x, y, Math.round(e._x), Math.round(e._y), col]);
          if (s.splash) {
            S._fx.push(['f', Math.round(e._x), Math.round(e._y), s.splash, col]);
            for (const o of inRange(S, e._x, e._y, s.splash)) { burnE(o, s.burn, s.burnT); if (o !== e) hit(o, s.dmg * 0.5); }
          } else burnE(e, s.burn, s.burnT);
          hit(e, s.dmg);
        }
        break;
      }
      case 'gc': {
        const list = inRange(S, x, y, range);
        if (s.pulse && t.cy <= 0 && list.length) {
          t.cy = s.pulse;
          for (const e of list) stunE(e, 1.5);
          S._fx.push(['d', x, y, Math.round(range), col]);
        }
        if (t.c > 0 || !list.length) break;
        t.c = s.rate * cd;
        for (const e of list.sort(byFirst).slice(0, s.targets)) {
          const cx = e._x, cy = e._y;
          S._fx.push(['a', x, y, Math.round(cx), Math.round(cy), Math.round(s.splash), col]);
          for (const o of inRange(S, cx, cy, s.splash)) {
            slowE(o, s.slow, s.slowT); vulnE(o, s.vuln, 3);
            if (s.finalizer) o.fz = 3;
            hit(o, s.dmg);
          }
        }
        break;
      }
      case 'debugger': {
        const list = inRange(S, x, y, range);
        if (!list.length) break;
        const prio = (q) => (ENEMIES[q.k].boss ? 1e9 : 0) + q.m + q.d * 1e-3;
        list.sort((a, b) => prio(b) - prio(a));
        if (s.mark && t.cy <= 0) {
          t.cy = 6; vulnE(list[0], 1, 4);
          S._fx.push(['k', Math.round(list[0]._x), Math.round(list[0]._y)]);
        }
        if (t.c > 0) break;
        t.c = s.rate * cd; t.a = Math.atan2(list[0]._y - y, list[0]._x - x);
        for (const e of list.slice(0, s.targets)) {
          S._fx.push(['s', x, y, Math.round(e._x), Math.round(e._y), col]);
          stunE(e, s.stun);
          if (s.splash) {
            S._fx.push(['f', Math.round(e._x), Math.round(e._y), s.splash, col]);
            for (const o of inRange(S, e._x, e._y, s.splash)) { slowE(o, s.slow, s.slowT); if (o !== e) hit(o, s.dmg * 0.4); }
          }
          hit(e, s.dmg);
        }
        break;
      }
      case 'balancer': {
        if (t.c > 0) break;
        const starts = inRange(S, x, y, range).sort(byFirst).slice(0, s.chains);
        if (!starts.length) break;
        t.c = s.rate * cd;
        const hitSet = new Set();
        for (let e of starts) {
          if (hitSet.has(e.i)) continue;
          const pts = [x, y];
          let dmg = s.dmg;
          for (let h = 0; e && h <= s.hops; h++) {
            hitSet.add(e.i); pts.push(Math.round(e._x), Math.round(e._y));
            const ox = e._x, oy = e._y;
            slowE(e, s.slow, 1.5); stunE(e, s.stun);
            hit(e, dmg); dmg *= s.fall;
            e = inRange(S, ox, oy, s.hopR).filter((q) => !hitSet.has(q.i))
              .reduce((b, q) => (!b || (q._x - ox) ** 2 + (q._y - oy) ** 2 < (b._x - ox) ** 2 + (b._y - oy) ** 2 ? q : b), null);
          }
          S._fx.push(['c', pts, col]);
        }
        break;
      }
      case 'docker': {
        const list = inRange(S, x, y, range);
        if (t.cy <= 0 && list.length) {
          t.cy = s.cycle;
          for (const e of list) if (e.im <= 0) { stunE(e, s.stun); e.im = e.st + 2; }
          S._fx.push(['d', x, y, Math.round(range), col]);
        }
        for (const e of list) {
          slowE(e, s.slow, 0.25); vulnE(e, s.vuln, 0.25);
          if (s.execute && !ENEMIES[e.k].boss && e.h < e.m * s.execute) { S._fx.push(['x', Math.round(e._x), Math.round(e._y)]); damage(S, e, e.h + 1); continue; }
          hit(e, s.dps * dt);
        }
        break;
      }
      case 'backup': {
        if (t.cy <= 0) {
          t.cy = s.period;
          const inc = Math.round(s.income);
          S.money += inc; S._fx.push(['m', x, y - 14, inc]);
        }
        break;
      }
      case 'linter': {
        if (s.aslow) for (const e of inRange(S, x, y, range)) slowE(e, s.aslow, 0.25);
        if (!s.shoot || t.c > 0) break;
        const e = inRange(S, x, y, range).sort(byFirst)[0];
        if (!e) break;
        t.c = s.srate;
        S._fx.push(['b', x, y, Math.round(e._x), Math.round(e._y), col]);
        damage(S, e, s.sdmg);
        break;
      }
      case 'thread': {
        t.s.forEach((u, j) => {
          if (u.h <= 0) {
            u.r -= dt;
            if (u.r <= 0) { u.h = s.uhp; u.e = 0; u.c = 0; }
            return;
          }
          if (u.e) {
            const e = eById.get(u.e);
            if (!e || e.h <= 0 || e.b !== t.i * 8 + j) { u.e = 0; return; }
            u.c -= dt;
            if (u.c <= 0) { u.c = s.urate * cd; hit(e, s.udmg); }
          } else if (u.h < s.uhp) u.h = Math.min(s.uhp, u.h + s.uhp * 0.05 * dt);
        });
        if (s.shoot && t.c <= 0) {
          const e = inRange(S, x, y, range).sort(byFirst)[0];
          if (e) { t.c = s.srate * cd; S._fx.push(['b', x, y, Math.round(e._x), Math.round(e._y), col]); hit(e, s.sdmg); }
        }
        break;
      }
    }
  }

  // --- explosiones del Finalizer ---
  for (let n = 0; n < S._boom.length && n < 60; n++) {
    const [bx, by, bd] = S._boom[n];
    S._fx.push(['f', Math.round(bx), Math.round(by), 60, '#c77dff']);
    for (const o of inRange(S, bx, by, 60)) damage(S, o, bd);
  }

  // --- limpieza ---
  S.E = S.E.filter((e) => e.h > 0);
  for (const [k, d] of S._spawn) { mkEnemy(S, k, d); const e = S.E[S.E.length - 1], p = pathPos(e.d); e._x = p.x; e._y = p.y; }
  if (S.life <= 0) { S.life = 0; S.ph = 'lost'; }
}

function endWave(S) {
  let bonus = waveBonus(S.w), heal = 0, interest = 0;
  for (const t of S.T) {
    if (t.k !== 'backup') continue;
    const s = tStats(t);
    bonus += s.waveBonus; heal += s.heal; interest = Math.max(interest, s.interest);
  }
  if (interest) bonus += Math.min(interest >= 0.08 ? 400 : 150, Math.floor(S.money * interest));
  S.money += bonus;
  if (heal && S.life < START_LIFE) { S.life = Math.min(START_LIFE, S.life + heal); S._fx.push(['l', heal]); }
  S.ic = S.au ? 1 : 12;
  S._fx.push(['m', 640, 300, bonus]);
}

// ---------- serialización (lo que viaja por la red) ----------
const r1 = (n) => Math.round(n * 10) / 10;

export function pack(S, fx) {
  return JSON.stringify({
    p: S.ph, pa: S.pa, pb: S.pb, au: S.au, w: S.w, wt: r1(S.wt), si: S.si, ic: r1(S.ic), mo: Math.floor(S.money), li: S.life, n: S.nid, ki: S.kills,
    T: S.T.map((t) => [t.i, TOWER_KEYS.indexOf(t.k), t.x, t.y, t.p[0] * 100 + t.p[1] * 10 + t.p[2], r1(t.c), r1(t.dz), t.inv, r1(t.cy), r1(t.a), t.s.map((s) => [r1(s.h), r1(s.r), s.e, r1(s.c)])]),
    E: S.E.map((e) => [e.i, ENEMY_KEYS.indexOf(e.k), r1(e.d), Math.ceil(e.h), e.m, r1(e.sl), e.sf, r1(e.st), r1(e.im), e.b, r1(e.ac), e.bn, r1(e.bt), e.vu, r1(e.vt), r1(e.fz)]),
    f: fx || [],
  });
}

export function unpack(str) {
  const o = JSON.parse(str);
  const S = { ph: o.p, pa: o.pa, pb: o.pb, au: o.au || 0, w: o.w, wt: o.wt, si: o.si, ic: o.ic, money: o.mo, life: o.li, nid: o.n, kills: o.ki, _fx: [] };
  S.T = (o.T || []).map((a) => {
    const t = { i: a[0], k: TOWER_KEYS[a[1]], x: a[2], y: a[3], p: [Math.floor(a[4] / 100), Math.floor(a[4] / 10) % 10, a[4] % 10], c: a[5], dz: a[6], inv: a[7], cy: a[8], a: a[9], _b: 0,
      s: (a[10] || []).map((s) => ({ h: s[0], r: s[1], e: s[2], c: s[3] })) };
    rally(t);
    return t;
  });
  calcBuffs(S);
  S.E = (o.E || []).map((a) => {
    const e = { i: a[0], k: ENEMY_KEYS[a[1]], d: a[2], h: a[3], m: a[4], sl: a[5], sf: a[6], st: a[7], im: a[8], b: a[9], ac: a[10], bn: a[11] || 0, bt: a[12] || 0, vu: a[13] || 0, vt: a[14] || 0, fz: a[15] || 0 };
    const p = pathPos(e.d); e._x = p.x; e._y = p.y;
    return e;
  });
  return { S, fx: o.f || [] };
}
