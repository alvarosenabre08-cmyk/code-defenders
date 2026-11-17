// ============================================================
//  Leones TD — pestañas Misiones, Logros, Estadísticas y Perfil,
//  insignias dibujadas por código y avisos ("¡logro conseguido!").
// ============================================================
import { MAPS, TOWERS, TOWER_KEYS, RARITY } from './data.js';
import * as Q from './goals.js';
import { towerIcon, towerCard } from './home.js';
import * as prog from './meta.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = Q.fmtN;
const TAU = Math.PI * 2, INK = '#3a2413';
let api = null;

// ---------- insignias ----------
function ink(c, fill, w = 2) { c.fillStyle = fill; c.fill(); c.lineWidth = w; c.strokeStyle = INK; c.stroke(); }
/** Dibujos de las insignias, centrados en (0,0), de unos 20 px de radio. */
const PICTO = {
  paw(c) {
    c.beginPath(); c.ellipse(0, 5, 8, 6.5, 0, 0, TAU); ink(c, '#fff5e0');
    for (const [x, y] of [[-8, -5], [-3, -9.5], [3, -9.5], [8, -5]]) { c.beginPath(); c.arc(x, y, 3.2, 0, TAU); ink(c, '#fff5e0', 1.6); }
  },
  trophy(c) {
    c.beginPath(); c.moveTo(-9, -11); c.lineTo(9, -11); c.quadraticCurveTo(9, 3, 0, 4); c.quadraticCurveTo(-9, 3, -9, -11); ink(c, '#ffd23f');
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 10, -6, 4, s > 0 ? -1.6 : 1.6 - Math.PI, s > 0 ? 1.6 : -1.6 - Math.PI, s < 0); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); }
    c.beginPath(); c.rect(-2, 4, 4, 5); ink(c, '#ffd23f', 1.6);
    c.beginPath(); c.rect(-7, 9, 14, 4); ink(c, '#b97a3a', 1.6);
  },
  sun(c) {
    for (let i = 0; i < 10; i++) { c.save(); c.rotate((i / 10) * TAU); c.beginPath(); c.moveTo(-3, -9); c.lineTo(0, -15); c.lineTo(3, -9); c.closePath(); ink(c, '#ffb52a', 1.4); c.restore(); }
    c.beginPath(); c.arc(0, 0, 9, 0, TAU); ink(c, '#ffe14a');
  },
  leaf(c) {
    c.beginPath(); c.moveTo(-10, 10); c.quadraticCurveTo(-12, -10, 11, -11); c.quadraticCurveTo(10, 10, -10, 10); ink(c, '#7fd65a');
    c.beginPath(); c.moveTo(-10, 10); c.lineTo(6, -6); c.lineWidth = 1.6; c.strokeStyle = INK; c.stroke();
  },
  fire(c) {
    c.beginPath(); c.moveTo(0, -14); c.quadraticCurveTo(12, -2, 9, 6); c.quadraticCurveTo(6, 13, 0, 13); c.quadraticCurveTo(-8, 13, -9, 5); c.quadraticCurveTo(-10, -3, -3, -6); c.quadraticCurveTo(-2, -1, 1, -2); c.quadraticCurveTo(3, -8, 0, -14); ink(c, '#ff6a2a');
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(6, 5, 4, 9); c.quadraticCurveTo(0, 12, -3, 9); c.quadraticCurveTo(-4, 4, 0, 0); c.fillStyle = '#ffe14a'; c.fill();
  },
  shield(c) {
    c.beginPath(); c.moveTo(0, -13); c.lineTo(11, -8); c.quadraticCurveTo(11, 7, 0, 14); c.quadraticCurveTo(-11, 7, -11, -8); c.closePath(); ink(c, '#e6ecf2');
    c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 10); c.moveTo(-7, -3); c.lineTo(7, -3); c.lineWidth = 2.4; c.strokeStyle = '#e8344a'; c.stroke();
  },
  barrel(c) {
    c.beginPath(); c.moveTo(-8, -12); c.quadraticCurveTo(-12, 0, -8, 12); c.lineTo(8, 12); c.quadraticCurveTo(12, 0, 8, -12); c.closePath(); ink(c, '#b97a3a');
    c.beginPath(); for (const y of [-6, 6]) { c.moveTo(-10.5, y); c.lineTo(10.5, y); } c.lineWidth = 2.6; c.strokeStyle = '#7d8792'; c.stroke();
    c.beginPath(); c.moveTo(-6, -2); c.lineTo(6, 2); c.moveTo(6, -2); c.lineTo(-6, 2); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  },
  map(c) {
    c.beginPath(); c.moveTo(-12, -9); c.lineTo(-4, -12); c.lineTo(4, -9); c.lineTo(12, -12); c.lineTo(12, 9); c.lineTo(4, 12); c.lineTo(-4, 9); c.lineTo(-12, 12); c.closePath(); ink(c, '#f2e3b3');
    c.setLineDash([2.5, 2.5]); c.beginPath(); c.moveTo(-8, 6); c.quadraticCurveTo(-2, -6, 6, -4); c.lineWidth = 1.6; c.strokeStyle = '#e8344a'; c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(4, -7); c.lineTo(9, -2); c.moveTo(9, -7); c.lineTo(4, -2); c.lineWidth = 2; c.stroke();
  },
  star(c) {
    c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = (i / 10) * TAU - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); ink(c, '#ffd23f');
  },
  crown(c) {
    c.beginPath(); c.moveTo(-12, 8); c.lineTo(-12, -6); c.lineTo(-6, 0); c.lineTo(0, -10); c.lineTo(6, 0); c.lineTo(12, -6); c.lineTo(12, 8); c.closePath(); ink(c, '#ffd23f');
    for (const [x, col] of [[-6, '#3fa9f5'], [0, '#e8344a'], [6, '#3fa9f5']]) { c.beginPath(); c.arc(x, 4, 2, 0, TAU); c.fillStyle = col; c.fill(); }
  },
  chest(c) {
    c.beginPath(); c.roundRect(-12, -2, 24, 13, 2); ink(c, '#b97a3a');
    c.beginPath(); c.moveTo(-12, -2); c.quadraticCurveTo(-12, -12, 0, -12); c.quadraticCurveTo(12, -12, 12, -2); c.closePath(); ink(c, '#c98a4a');
    c.beginPath(); c.roundRect(-3, -4, 6, 7, 1.5); ink(c, '#ffd23f', 1.5);
  },
  bolt(c) {
    c.beginPath(); c.moveTo(3, -14); c.lineTo(-8, 2); c.lineTo(-1, 2); c.lineTo(-4, 14); c.lineTo(8, -3); c.lineTo(1, -3); c.closePath(); ink(c, '#ffe14a');
  },
  coin(c) {
    c.beginPath(); c.arc(0, 0, 11, 0, TAU); ink(c, '#ffd23f');
    c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.lineWidth = 1.5; c.strokeStyle = '#c9952a'; c.stroke();
    c.fillStyle = INK; c.font = '900 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('€', 0, 0.5);
  },
  scroll(c) {
    c.beginPath(); c.roundRect(-9, -11, 18, 22, 2); ink(c, '#fff5e0');
    for (const y of [-11, 11]) { c.beginPath(); c.ellipse(0, y, 11, 2.6, 0, 0, TAU); ink(c, '#f2d77a', 1.6); }
    c.beginPath(); for (const y of [-5, -1, 3]) { c.moveTo(-5, y); c.lineTo(5, y); } c.moveTo(-5, 7); c.lineTo(1, 7); c.lineWidth = 1.4; c.strokeStyle = '#b8743a'; c.stroke();
  },
};
/** Medalla de un logro. locked = gris (todavía no conseguido). */
export function drawBadge(c, a, x, y, s = 1, locked = false) {
  c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
  if (locked) c.filter = 'grayscale(1) brightness(0.75)';
  for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 4, 10); c.lineTo(sx * 11, 30); c.lineTo(sx * 5, 27); c.lineTo(sx * 3, 32); c.lineTo(sx * -2, 12); c.closePath(); ink(c, sx < 0 ? '#e8344a' : '#3fa9f5', 2); }
  c.beginPath(); c.arc(0, 0, 21, 0, TAU); ink(c, a.c, 3);
  c.beginPath(); c.arc(0, 0, 16.5, 0, TAU); c.fillStyle = 'rgba(58,36,19,0.35)'; c.fill();
  c.beginPath(); c.arc(-7, -8, 5, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
  c.save(); c.scale(0.9, 0.9); (PICTO[a.icon] || PICTO.star)(c); c.restore();
  c.restore();
}
/** Insignia en un canvas nuevo, lista para meter en la página. */
export function badgeIcon(id, size = 40, locked = false) {
  const a = Q.ACH_BY_ID[id], cv = document.createElement('canvas');
  cv.width = cv.height = size * 2; cv.style.width = cv.style.height = size + 'px';
  if (a) { const g = cv.getContext('2d'); g.scale((size * 2) / 70, (size * 2) / 70); drawBadge(g, a, 35, 27, 1, locked); }
  cv.className = 'badge-ic';
  cv.title = a ? `${a.n}: ${a.d}` : '';
  return cv;
}

// ---------- avisos ----------
/** Aviso arriba a la derecha que se va solo. */
export function toast(html, badge = null) {
  const el = document.createElement('div');
  el.className = 'toast';
  if (badge) el.append(badgeIcon(badge, 44));
  const t = document.createElement('div'); t.innerHTML = html; el.append(t);
  $('toasts').append(el);
  setTimeout(() => el.classList.add('out'), 4600);
  setTimeout(() => el.remove(), 5200);
}
/** Avisa de las misiones completadas y los logros nuevos (res = lo que devuelven addGame / addChests). */
export function celebrate(res) {
  if (!res) return;
  const n = res.missions.length + res.ach.length;
  if (n > 4) { // muchos a la vez: un solo aviso
    toast(`<b>${res.ach.length ? `¡${res.ach.length} ${res.ach.length === 1 ? 'logro nuevo' : 'logros nuevos'}!` : ''}${res.ach.length && res.missions.length ? '<br>' : ''}${res.missions.length ? `${res.missions.length} ${res.missions.length === 1 ? 'misión completada' : 'misiones completadas'}` : ''}</b><br><small>Míralos en Logros y Misiones</small>`, res.ach[0]?.id || null);
    updateNavDot();
    return;
  }
  for (const m of res.missions) toast(`<b>¡Misión completada!</b><br>${esc(m.text)}<br><small>Reclama ${m.f} filetes en Misiones</small>`);
  for (const a of res.ach) toast(`<b>¡Logro: ${esc(a.n)}!</b><br>${esc(a.d)}<br><small>+${a.f} filetes</small>`, a.id);
  updateNavDot();
}
/** Texto para la pantalla de fin de partida. */
export function summaryHtml(res) {
  if (!res || (!res.missions.length && !res.ach.length)) return '';
  return [
    ...res.missions.map((m) => `<span class="g-m">✔ Misión: ${esc(m.text)} <b>(+${m.f}, reclámala en Misiones)</b></span>`),
    ...res.ach.map((a) => `<span class="g-a">★ Logro: ${esc(a.n)} <b>(+${a.f} filetes)</b></span>`),
  ].join('');
}
/** Punto en la pestaña Misiones cuando hay recompensas por reclamar. */
export function updateNavDot() {
  const p = api && api.profile(), b = document.querySelector('[data-tab=misiones]');
  if (!p || !b) return;
  const n = Q.claimable(p);
  b.dataset.dot = n || '';
}

// ---------- Misiones ----------
const left = (ms) => { const h = Math.floor(ms / 3600000), d = Math.floor(h / 24); return d >= 1 ? `${d} d ${h % 24} h` : h >= 1 ? `${h} h ${Math.floor((ms % 3600000) / 60000)} min` : `${Math.max(1, Math.floor(ms / 60000))} min`; };
function renderMissions() {
  const p = api.profile(), list = Q.missions(p), r = Q.resetsIn();
  $('msDayLeft').textContent = `· cambian en ${left(r.day)}`;
  $('msWeekLeft').textContent = `· cambian en ${left(r.week)}`;
  for (const [box, kind] of [[$('msDaily'), 'd'], [$('msWeekly'), 'w']]) {
    box.textContent = '';
    for (const m of list.filter((x) => x.kind === kind)) {
      const el = document.createElement('div');
      el.className = 'mission' + (m.claimed ? ' done' : m.ready ? ' ready' : '');
      el.innerHTML = `<div class="m-txt"><b>${esc(m.text)}</b>
        <span class="copbar big"><i style="width:${Math.round((m.prog / m.n) * 100)}%"></i></span>
        <small>${fmt(m.prog)} / ${fmt(m.n)}</small></div>
        <div class="m-rew"><i class="steak"></i> ${m.f}</div>`;
      const b = document.createElement('button');
      b.className = 'btn small' + (m.ready ? ' primary' : '');
      b.textContent = m.claimed ? 'Reclamada' : m.ready ? 'Reclamar' : 'En curso';
      b.disabled = !m.ready;
      b.onclick = () => claim(m.kind, m.i);
      el.append(b);
      box.append(el);
    }
  }
}
function claim(kind, i) {
  const p = api.profile(), got = Q.claim(p, kind, i);
  if (!got) return;
  const res = { missions: [], ach: Q.checkAch(p) }; // reclamar misiones también da logros
  $('msMsg').textContent = `+${got} filetes. ¡Gástalos en la Bolsa!`;
  api.save(); celebrate(res); api.refreshAll();
}

// ---------- Logros ----------
function renderAch() {
  const p = api.profile(), box = $('achGrid');
  box.textContent = '';
  const n = Object.keys(p.ach).length;
  $('achCount').textContent = `· ${n} de ${Q.ACH.length}`;
  for (const a of [...Q.ACH].sort((x, y) => !!p.ach[y.id] - !!p.ach[x.id])) {
    const got = p.ach[a.id], el = document.createElement('div');
    el.className = 'ach' + (got ? ' got' : '');
    el.style.setProperty('--ac', a.c);
    el.append(badgeIcon(a.id, 56, !got));
    const t = document.createElement('div');
    t.innerHTML = `<b>${esc(a.n)}</b><small>${esc(a.d)}</small><span>${got ? `Conseguido el ${got.split('-').reverse().join('/')}` : `<i class="steak"></i> ${a.f}`}</span>`;
    el.append(t);
    box.append(el);
  }
}

// ---------- Estadísticas ----------
function renderStats() {
  const p = api.profile(), st = p.st, used = Q.mostUsed(p);
  const box = (v, l) => `<div class="sbox"><b>${v}</b><small>${l}</small></div>`;
  $('statGrid').innerHTML = [
    box(fmt(st.games), 'Partidas jugadas'),
    box(fmt(st.wins), `Victorias${st.games ? ` (${Math.round((st.wins / st.games) * 100)}%)` : ''}`),
    box(fmt(st.mk), 'Barriles rotos por ti'),
    box(fmt(st.kills), 'Barriles rotos con tu manada'),
    box(fmt(st.dmg), 'Daño total de tus torres'),
    box(fmt(st.gold), 'Oro ganado'),
    box(fmt(st.built), 'Torres construidas'),
    box(fmt(st.ups), 'Mejoras compradas'),
    box(fmt(st.t5), 'Ramas llevadas al nivel 5'),
    box(fmt(st.abil), 'Habilidades usadas'),
    box(fmt(st.slowed), 'Barriles ralentizados'),
    box(fmt(st.heal), 'Vidas curadas'),
    box(fmt(st.gift), 'Oro donado a compañeros'),
    box(fmt(st.retos), 'Retos cooperativos cumplidos'),
    box(fmt(st.perfect), 'Victorias sin perder vidas'),
    box(fmt(st.coop), 'Partidas con amigos'),
    box(fmt(st.mvp), 'Veces el mejor de la manada'),
    box(fmt(p.inv.opened), 'Cofres abiertos'),
    box(fmt(st.missions), 'Misiones cumplidas'),
    box(`${Object.keys(p.ach).length}<small> / ${Q.ACH.length}</small>`, 'Logros'),
    box(`${Object.keys(p.tw).length}<small> / ${TOWER_KEYS.length}</small>`, 'Torres en tu colección'),
    box(used.k ? `<span class="small-b">${TOWERS[used.k].name}</span>` : '—', 'Torre más usada'),
  ].join('');
  $('statMaps').innerHTML = '<tr><th>Mapa</th><th>Partidas</th><th>Victorias</th><th>Mejor oleada</th></tr>'
    + MAPS.map((M, i) => `<tr><td>${M.name}</td><td class="n">${fmt(st.mapGames[i] || 0)}</td><td class="n">${fmt(st.mapWins[i] || 0)}</td><td class="n">${st.best[i] || 0} / ${M.waves}</td></tr>`).join('');
  const top = Object.entries(st.tb).sort((a, b) => b[1] - a[1]).slice(0, 6), max = top[0] ? top[0][1] : 1;
  const bars = $('statTowers');
  bars.textContent = '';
  if (!top.length) bars.innerHTML = '<p class="note">Todavía no has construido ninguna torre.</p>';
  for (const [k, n] of top) {
    const row = document.createElement('div');
    row.className = 'bar';
    row.style.setProperty('--rc', RARITY[TOWERS[k].rar].c);
    row.append(towerIcon(k, 40));
    row.insertAdjacentHTML('beforeend', `<b>${TOWERS[k].name}</b><span class="track"><i style="width:${Math.max(4, (n / max) * 100)}%"></i></span><small>${fmt(n)}</small>`);
    bars.append(row);
  }
}

// ---------- Perfil ----------
function renderProfile() {
  const p = api.profile(), fav = Q.favorite(p), card = $('profileCard');
  card.textContent = '';
  const left = document.createElement('div'); left.className = 'pc-badge';
  if (p.badge) left.append(badgeIcon(p.badge, 84)); else left.innerHTML = '<span class="no-badge">Sin insignia</span>';
  const mid = document.createElement('div'); mid.className = 'pc-txt';
  const a = Q.ACH_BY_ID[p.badge];
  mid.innerHTML = `<h3>${esc(api.name())}</h3>${a ? `<p class="pc-title" style="color:${a.c}">${esc(a.n)}</p>` : ''}
    <p>${fmt(p.st.games)} partidas · ${fmt(p.st.wins)} victorias · ${Object.keys(p.ach).length} logros</p>
    <p>Torre favorita: <b>${TOWERS[fav].name}</b>${p.fav ? '' : ' <small>(la que más usas)</small>'}</p>`;
  const right = document.createElement('div'); right.className = 'pc-fav';
  right.append(towerIcon(fav, 96));
  card.append(left, mid, right);

  const bp = $('badgePick');
  bp.textContent = '';
  const none = document.createElement('button');
  none.className = 'bpick' + (!p.badge ? ' sel' : ''); none.textContent = 'Ninguna';
  none.onclick = () => { p.badge = ''; api.save(); renderProfile(); };
  bp.append(none);
  const got = Q.ACH.filter((x) => p.ach[x.id]);
  for (const x of got) {
    const b = document.createElement('button');
    b.className = 'bpick' + (p.badge === x.id ? ' sel' : '');
    b.title = `${x.n}: ${x.d}`;
    b.append(badgeIcon(x.id, 46));
    b.onclick = () => { p.badge = x.id; api.save(); renderProfile(); };
    bp.append(b);
  }
  if (!got.length) bp.insertAdjacentHTML('beforeend', '<p class="note">Consigue logros para desbloquear insignias.</p>');

  const fp = $('favPick');
  fp.textContent = '';
  for (const k of [...TOWER_KEYS].sort((x, y) => TOWERS[x].rar - TOWERS[y].rar)) {
    if (!p.tw[k]) continue;
    const el = towerCard(k, prog.card(p, k), { mini: true, note: k === p.fav ? 'Favorita' : '', onClick: () => { p.fav = p.fav === k ? '' : k; api.save(); renderProfile(); } });
    if (k === p.fav) el.classList.add('fav');
    fp.append(el);
  }
  $('profileBox').innerHTML = `Cuenta creada el <b>${new Date(p.created || Date.now()).toLocaleDateString('es-ES')}</b>`
    + (api.isLocal() ? '<br><span style="color:var(--amber)">Esta cuenta está guardada solo en este navegador.</span>' : '');
}

// ---------- arranque ----------
/** a = { profile(), save(), name(), isLocal(), refreshAll() } */
export function init(a) { api = a; }
export function refresh() {
  if (!api || !api.profile()) return;
  renderMissions(); renderAch(); renderStats(); renderProfile(); updateNavDot();
}
