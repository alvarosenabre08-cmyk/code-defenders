// ============================================================
//  Leones TD — misiones, logros y estadísticas de cada cuenta
//  Funciones puras (sin red ni página): se pueden probar solas.
//
//  En el perfil se guarda:
//    ms   { d: día, dp: [progreso x3], dc: [reclamada x3], w: semana, wp, wc }
//    ach  { idLogro: día en que se consiguió }
//    st   estadísticas (ver addGame)
//    badge  logro elegido como insignia · fav  torre favorita
// ============================================================
import { MAPS, TOWERS, TOWER_KEYS } from './data.js';

// ---------- fechas: las misiones cambian a medianoche (hora del ordenador) ----------
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Lunes de la semana de esa fecha. */
export function weekKey(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return dayKey(m);
}
/** Milisegundos hasta que cambian las diarias (medianoche) y las semanales (lunes a medianoche). */
export function resetsIn(d = new Date()) {
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 - ((d.getDay() + 6) % 7));
  return { day: mid - d, week: mon - d };
}

// ---------- misiones ----------
/**
 * Cada misión: texto, objetivo (n), filetes (f) y cómo avanza:
 *   game(g) → cuánto suma una partida (g = resumen de la partida, ver gameSummary en main.js)
 *   chest   → cuenta cofres abiertos
 *   max     → el progreso es el mejor valor, no la suma
 */
export const MISSIONS = {
  // diarias
  d_kills: { t: 'Rompe {n} barriles', n: 150, f: 30, game: (g) => g.kills },
  d_games: { t: 'Juega {n} partidas', n: 2, f: 25, game: () => 1 },
  d_abil: { t: 'Usa {n} habilidades', n: 3, f: 30, game: (g) => g.abil },
  d_wave: { t: 'Llega a la oleada {n} en cualquier mapa', n: 10, f: 25, max: 1, game: (g) => g.wave },
  d_build: { t: 'Construye {n} torres', n: 15, f: 20, game: (g) => g.built },
  d_ups: { t: 'Compra {n} mejoras', n: 20, f: 25, game: (g) => g.ups },
  d_win: { t: 'Gana una partida', n: 1, f: 40, game: (g) => +g.won },
  d_coop: { t: 'Juega una partida con amigos', n: 1, f: 30, game: (g) => +(g.players > 1) },
  d_dmg: { t: 'Haz {n} de daño', n: 20000, f: 25, game: (g) => g.dmg },
  d_gold: { t: 'Gana {n} de oro en partidas', n: 2000, f: 25, game: (g) => g.gold },
  d_chest: { t: 'Abre un cofre', n: 1, f: 20, chest: 1 },
  // semanales
  w_kills: { t: 'Rompe {n} barriles', n: 1500, f: 120, game: (g) => g.kills },
  w_wins: { t: 'Gana {n} partidas', n: 5, f: 150, game: (g) => +g.won },
  w_selva: { t: 'Gana en Selva', n: 1, f: 150, game: (g) => +(g.won && g.map === 1) },
  w_volcan: { t: 'Gana en Volcán', n: 1, f: 200, game: (g) => +(g.won && g.map === 2) },
  w_big: { t: 'Llega a la oleada {n} en Pantano, Cañón o Ciudadela', n: 15, f: 150, max: 1, game: (g) => (g.map >= 3 ? g.wave : 0) },
  w_abil: { t: 'Usa {n} habilidades', n: 25, f: 120, game: (g) => g.abil },
  w_t5: { t: 'Lleva {n} ramas al nivel 5', n: 3, f: 120, game: (g) => g.t5 },
  w_rare: { t: 'Gana con una torre Épica o Legendaria en tu mazo', n: 1, f: 150, game: (g) => +(g.won && g.deckRar >= 2) },
  w_chest: { t: 'Abre {n} cofres', n: 5, f: 100, chest: 1 },
  w_coop: { t: 'Gana {n} partidas con amigos', n: 2, f: 150, game: (g) => +(g.won && g.players > 1) },
  w_perfect: { t: 'Gana una partida sin perder vidas', n: 1, f: 200, game: (g) => +(g.won && g.lost === 0) },
};
const DAILY = Object.keys(MISSIONS).filter((k) => k[0] === 'd');
const WEEKLY = Object.keys(MISSIONS).filter((k) => k[0] === 'w');
/** 1500 → "1.500" (el formato español no pone el punto en números de 4 cifras). */
export const fmtN = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const missionText = (id) => MISSIONS[id].t.replace('{n}', fmtN(MISSIONS[id].n));

/** Elige 3 misiones a partir de la fecha: todos los jugadores tienen las mismas ese día/semana. */
function pick(pool, key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const a = pool.slice(), out = [];
  while (out.length < 3) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; out.push(a.splice(h % a.length, 1)[0]); }
  return out;
}
export const dailyIds = (d) => pick(DAILY, 'd' + d);
export const weeklyIds = (w) => pick(WEEKLY, 'w' + w);

// ---------- logros ----------
/** icon: dibujo de la insignia · c: color · f: filetes al conseguirlo · ok(p, g): se comprueba con el perfil (y la partida recién jugada). */
export const ACH = [
  { id: 'first_game', n: 'Primeros pasos', d: 'Juega tu primera partida.', icon: 'paw', c: '#c9a36a', f: 20, ok: (p) => p.st.games >= 1 },
  { id: 'first_win', n: 'Primera victoria', d: 'Gana una partida.', icon: 'trophy', c: '#ffd23f', f: 40, ok: (p) => p.st.wins >= 1 },
  { id: 'win_sabana', n: 'Señor de la Sabana', d: 'Gana en Sabana.', icon: 'sun', c: '#e8c93f', f: 40, ok: (p) => (p.st.mapWins[0] || 0) >= 1 },
  { id: 'win_selva', n: 'Señor de la Selva', d: 'Gana en Selva.', icon: 'leaf', c: '#4fbf5a', f: 80, ok: (p) => (p.st.mapWins[1] || 0) >= 1 },
  { id: 'win_volcan', n: 'Señor del Volcán', d: 'Gana en Volcán.', icon: 'fire', c: '#ff6a2a', f: 150, ok: (p) => (p.st.mapWins[2] || 0) >= 1 },
  { id: 'win_pantano', n: 'Señor del Pantano', d: 'Gana en Pantano.', icon: 'leaf', c: '#6fd0c0', f: 200, ok: (p) => (p.st.mapWins[3] || 0) >= 1 },
  { id: 'win_canon', n: 'Señor del Cañón', d: 'Gana en Cañón.', icon: 'map', c: '#ffae6a', f: 260, ok: (p) => (p.st.mapWins[4] || 0) >= 1 },
  { id: 'win_ciudadela', n: 'Señor de la Ciudadela', d: 'Gana en Ciudadela, el mapa más difícil.', icon: 'crown', c: '#a9c8ff', f: 350, ok: (p) => (p.st.mapWins[5] || 0) >= 1 },
  { id: 'perfect', n: 'Sin un rasguño', d: 'Gana una partida sin perder ninguna vida.', icon: 'shield', c: '#6bc8f0', f: 80, ok: (p, g) => !!g && g.won && g.lost === 0 },
  { id: 'perfect_volcan', n: 'Corazón de lava', d: 'Gana en Volcán sin perder ninguna vida.', icon: 'shield', c: '#e8341a', f: 300, ok: (p, g) => !!g && g.won && g.lost === 0 && g.map === 2 },
  { id: 'kills_1k', n: 'Rompebarriles', d: 'Rompe 1.000 barriles.', icon: 'barrel', c: '#b8743a', f: 40, ok: (p) => p.st.mk >= 1000 },
  { id: 'kills_10k', n: 'Tonelero', d: 'Rompe 10.000 barriles.', icon: 'barrel', c: '#b9c2cc', f: 120, ok: (p) => p.st.mk >= 10000 },
  { id: 'kills_50k', n: 'Pesadilla de los barriles', d: 'Rompe 50.000 barriles.', icon: 'barrel', c: '#ffd23f', f: 300, ok: (p) => p.st.mk >= 50000 },
  { id: 'games_10', n: 'Habitual', d: 'Juega 10 partidas.', icon: 'paw', c: '#4fb0ff', f: 40, ok: (p) => p.st.games >= 10 },
  { id: 'games_50', n: 'Veterano', d: 'Juega 50 partidas.', icon: 'paw', c: '#c084f5', f: 150, ok: (p) => p.st.games >= 50 },
  { id: 'wins_10', n: 'Ganador', d: 'Gana 10 partidas.', icon: 'trophy', c: '#4fb0ff', f: 80, ok: (p) => p.st.wins >= 10 },
  { id: 'wins_25', n: 'Campeón', d: 'Gana 25 partidas.', icon: 'trophy', c: '#c084f5', f: 200, ok: (p) => p.st.wins >= 25 },
  { id: 'all_maps', n: 'Trotamundos', d: `Gana en los ${MAPS.length} mapas.`, icon: 'map', c: '#5fe0d0', f: 150, ok: (p) => MAPS.every((_, i) => (p.st.mapWins[i] || 0) >= 1) },
  { id: 'lvl5', n: 'Primer nivel 5', d: 'Sube una torre al nivel 5.', icon: 'star', c: '#ffd23f', f: 100, ok: (p) => Object.values(p.tw).some((c) => c.l >= 5) },
  { id: 'legend', n: 'Toque de leyenda', d: 'Consigue una torre Legendaria.', icon: 'crown', c: '#ffb52a', f: 60, ok: (p) => TOWER_KEYS.some((k) => TOWERS[k].rar === 3 && p.tw[k]) },
  { id: 'collector', n: 'Coleccionista', d: 'Consigue las 20 torres.', icon: 'crown', c: '#c084f5', f: 300, ok: (p) => TOWER_KEYS.every((k) => p.tw[k]) },
  { id: 'chests_10', n: 'Buscatesoros', d: 'Abre 10 cofres.', icon: 'chest', c: '#b97a3a', f: 40, ok: (p) => p.inv.opened >= 10 },
  { id: 'chests_50', n: 'Cazatesoros', d: 'Abre 50 cofres.', icon: 'chest', c: '#ffd23f', f: 150, ok: (p) => p.inv.opened >= 50 },
  { id: 't5', n: 'Obra maestra', d: 'Lleva una rama de mejora al nivel 5.', icon: 'star', c: '#e8643c', f: 40, ok: (p) => p.st.t5 >= 1 },
  { id: 'abil_100', n: 'Maestro de habilidades', d: 'Usa 100 habilidades.', icon: 'bolt', c: '#b07be8', f: 100, ok: (p) => p.st.abil >= 100 },
  { id: 'pack4', n: 'Manada completa', d: 'Gana una partida con 4 jugadores.', icon: 'paw', c: '#ff3fa4', f: 120, ok: (p, g) => !!g && g.won && g.players >= 4 },
  { id: 'mvp', n: 'El mejor de la manada', d: 'Haz más daño que nadie en una victoria con amigos.', icon: 'crown', c: '#00f0ff', f: 80, ok: (p, g) => !!g && g.won && g.players > 1 && g.mvp },
  { id: 'phoenix', n: 'Renacido', d: 'Que tu León Fénix salve la guarida.', icon: 'fire', c: '#ffa23a', f: 60, ok: (p, g) => !!g && g.revived },
  { id: 'rich', n: 'Bolsillo lleno', d: 'Gana 10.000 de oro en una sola partida.', icon: 'coin', c: '#ffd23f', f: 80, ok: (p, g) => !!g && g.gold >= 10000 },
  { id: 'missions_10', n: 'Cumplidor', d: 'Reclama 10 misiones.', icon: 'scroll', c: '#f2d77a', f: 80, ok: (p) => p.st.missions >= 10 },
  { id: 'missions_50', n: 'Incansable', d: 'Reclama 50 misiones.', icon: 'scroll', c: '#c084f5', f: 250, ok: (p) => p.st.missions >= 50 },
];
export const ACH_BY_ID = Object.fromEntries(ACH.map((a) => [a.id, a]));

// ---------- perfil ----------
const ST0 = () => ({ games: 0, wins: 0, kills: 0, mk: 0, dmg: 0, gold: 0, abil: 0, built: 0, ups: 0, t5: 0, perfect: 0, mvp: 0, coop: 0, missions: 0, slowed: 0, heal: 0, gift: 0, retos: 0, best: {}, mapWins: {}, mapGames: {}, tb: {} });
const num = (x) => Math.max(0, Math.floor(+x || 0));
const nums = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).map(([k, v]) => [k, num(v)]));
const arr3 = (a, f) => [0, 1, 2].map((i) => f(Array.isArray(a) ? a[i] : a && a[i]));

/** Completa y repara la parte de misiones, logros, estadísticas y perfil (Firebase devuelve a veces datos a medias). */
export function normalize(p) {
  const s = p.st && typeof p.st === 'object' ? p.st : {}, st = ST0();
  for (const k of Object.keys(st)) st[k] = typeof st[k] === 'object' ? nums(s[k]) : num(s[k]);
  st.tb = Object.fromEntries(Object.entries(st.tb).filter(([k]) => TOWERS[k]));
  p.st = st;
  const m = p.ms && typeof p.ms === 'object' ? p.ms : {};
  p.ms = { d: String(m.d || ''), dp: arr3(m.dp, num), dc: arr3(m.dc, (x) => (x ? 1 : 0)), w: String(m.w || ''), wp: arr3(m.wp, num), wc: arr3(m.wc, (x) => (x ? 1 : 0)) };
  p.ach = Object.fromEntries(Object.entries(p.ach && typeof p.ach === 'object' ? p.ach : {}).filter(([k]) => ACH_BY_ID[k]));
  if (p.badge && !p.ach[p.badge]) p.badge = '';
  p.badge = p.badge || '';
  p.fav = TOWERS[p.fav] && p.tw && p.tw[p.fav] ? p.fav : '';
  return p;
}

/** Pasa a las misiones de hoy y de esta semana si han cambiado (lo de antes se pierde). */
export function roll(p, now = new Date()) {
  const d = dayKey(now), w = weekKey(now);
  if (p.ms.d !== d) Object.assign(p.ms, { d, dp: [0, 0, 0], dc: [0, 0, 0] });
  if (p.ms.w !== w) Object.assign(p.ms, { w, wp: [0, 0, 0], wc: [0, 0, 0] });
}
/** Las 6 misiones actuales con su progreso. */
export function missions(p, now = new Date()) {
  roll(p, now);
  const row = (id, prog, done, i, kind) => ({ id, i, kind, text: missionText(id), n: MISSIONS[id].n, f: MISSIONS[id].f, prog: Math.min(prog, MISSIONS[id].n), claimed: !!done, ready: !done && prog >= MISSIONS[id].n });
  return [
    ...dailyIds(p.ms.d).map((id, i) => row(id, p.ms.dp[i], p.ms.dc[i], i, 'd')),
    ...weeklyIds(p.ms.w).map((id, i) => row(id, p.ms.wp[i], p.ms.wc[i], i, 'w')),
  ];
}
export const claimable = (p, now) => missions(p, now).filter((m) => m.ready).length;

/** Avanza las misiones. step(def) = cuánto suma; devuelve las que se acaban de completar. */
function advance(p, step, now) {
  roll(p, now);
  const done = [];
  for (const [ids, prog, kind] of [[dailyIds(p.ms.d), p.ms.dp, 'd'], [weeklyIds(p.ms.w), p.ms.wp, 'w']]) {
    ids.forEach((id, i) => {
      const def = MISSIONS[id], v = num(step(def));
      if (!v) return;
      const before = prog[i];
      prog[i] = Math.min(def.n, def.max ? Math.max(prog[i], v) : prog[i] + v);
      if (before < def.n && prog[i] >= def.n) done.push({ id, kind, text: missionText(id), f: def.f });
    });
  }
  return done;
}

/** Recoge la recompensa de una misión completada. kind 'd' o 'w', i = 0-2. Devuelve los filetes (0 si no se puede). */
export function claim(p, kind, i, now = new Date()) {
  roll(p, now);
  const ids = kind === 'd' ? dailyIds(p.ms.d) : weeklyIds(p.ms.w), prog = kind === 'd' ? p.ms.dp : p.ms.wp, got = kind === 'd' ? p.ms.dc : p.ms.wc;
  const id = ids[i];
  if (!id || got[i] || prog[i] < MISSIONS[id].n) return 0;
  got[i] = 1; p.inv.fil += MISSIONS[id].f; p.st.missions++;
  return MISSIONS[id].f;
}

/** Logros nuevos: los marca, da sus filetes y los devuelve. g = partida recién jugada (opcional). */
export function checkAch(p, g = null, now = new Date()) {
  const out = [];
  for (const a of ACH) {
    if (p.ach[a.id] || !a.ok(p, g)) continue;
    p.ach[a.id] = dayKey(now); p.inv.fil += a.f;
    out.push(a);
  }
  return out;
}

/**
 * Apunta una partida terminada: estadísticas, misiones y logros.
 * g = { map, won, wave, players, kills, dmg, gold, abil, built, ups, t5, tb:{torre:n}, lost, mvp, revived, deckRar, teamKills }
 * Devuelve { missions: [completadas], ach: [logros nuevos] }.
 */
export function addGame(p, g, now = new Date()) {
  const s = p.st, m = g.map;
  s.games++; if (g.won) s.wins++;
  s.kills += num(g.teamKills); s.mk += num(g.kills); s.dmg += num(g.dmg); s.gold += num(g.gold);
  s.abil += num(g.abil); s.built += num(g.built); s.ups += num(g.ups); s.t5 += num(g.t5);
  s.slowed += num(g.slowed); s.heal += num(g.heal); s.gift += num(g.gift); s.retos += num(g.retos);
  if (g.won && g.lost === 0) s.perfect++;
  if (g.won && g.mvp && g.players > 1) s.mvp++;
  if (g.players > 1) s.coop++;
  s.best[m] = Math.max(s.best[m] || 0, num(g.wave));
  s.mapGames[m] = (s.mapGames[m] || 0) + 1;
  if (g.won) s.mapWins[m] = (s.mapWins[m] || 0) + 1;
  for (const [k, n] of Object.entries(g.tb || {})) if (TOWERS[k]) s.tb[k] = (s.tb[k] || 0) + num(n);
  const missionsDone = advance(p, (def) => (def.game ? def.game(g) : 0), now);
  return { missions: missionsDone, ach: checkAch(p, g, now) };
}

/** Tras abrir cofres: avanzan las misiones de cofres y se comprueban los logros de colección. */
export function addChests(p, n = 1, now = new Date()) {
  const missionsDone = advance(p, (def) => (def.chest ? n : 0), now);
  return { missions: missionsDone, ach: checkAch(p, null, now) };
}

/** Torre más construida (para estadísticas y como favorita por defecto). */
export function mostUsed(p) {
  let best = '', n = 0;
  for (const [k, c] of Object.entries(p.st.tb)) if (c > n) { best = k; n = c; }
  return { k: best, n };
}
export const favorite = (p) => p.fav || mostUsed(p).k || 'firewall';
