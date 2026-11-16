// ============================================================
//  Leones TD — menú principal: Torres (colección), Bolsa (filetes y cofres) y Mazos
//  Todo lo que se cambia aquí se guarda en la cuenta del jugador.
// ============================================================
import { TOWERS, TOWER_KEYS, RARITY } from './data.js';
import { drawTower } from './render.js';
import * as prog from './meta.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('es-ES');
const TAU = Math.PI * 2, INK = '#3a2413';

let api = null;       // { profile(): perfil de la cuenta, save(): promesa que lo guarda }
let deckSel = 0;      // mazo que se está editando en la pestaña Mazos
let saveTimer = 0;

/** Torres ordenadas por calidad (y dentro, por el orden de siempre). */
const SORTED = [...TOWER_KEYS].sort((a, b) => TOWERS[a].rar - TOWERS[b].rar || TOWER_KEYS.indexOf(a) - TOWER_KEYS.indexOf(b));

// ---------- piezas compartidas ----------
/** Icono de una torre en un canvas nuevo. size = lado en píxeles de pantalla. p = mejoras [a, b, c]. */
export function towerIcon(k, size = 68, p = null) {
  const ic = document.createElement('canvas');
  ic.width = ic.height = size * 2;
  ic.style.width = ic.style.height = size + 'px';
  const g = ic.getContext('2d'), s = (size * 2) / 68;
  g.scale(s, s);
  drawTower(g, k, 34, 33, p, 0.35, 0, false);
  return ic;
}
export const stars = (l) => `<span class="stars">${'★'.repeat(l)}<i>${'★'.repeat(prog.MAX_LEVEL - l)}</i></span>`;
function copiesBar(c) {
  if (!c.need) return '<span class="cop max">Nivel máximo</span>';
  return `<span class="cop"><span class="copbar"><i style="width:${Math.round((c.c / c.need) * 100)}%"></i></span>${c.c}/${c.need} copias</span>`;
}
/** Tarjeta de torre con el marco de su calidad y las estrellas de su nivel. */
export function towerCard(k, c, { mini = false, onClick = null, note = '' } = {}) {
  const d = TOWERS[k], el = document.createElement(onClick ? 'button' : 'div');
  el.className = `tc r${d.rar} ${c.owned ? 'lv' + c.l : 'locked'}${mini ? ' mini' : ''}`;
  el.style.setProperty('--rc', RARITY[d.rar].c);
  const t = document.createElement('div');
  t.className = 'tc-txt';
  t.innerHTML = `<b>${d.name}</b><span class="rar">${RARITY[d.rar].n}${mini ? '' : ` · ${d.cost} de oro`}</span>`
    + (c.owned ? stars(c.l) + (mini ? '' : copiesBar(c)) : '<span class="lockt">Bloqueada · sale en cofres</span>')
    + (note ? `<span class="note2">${note}</span>` : '');
  el.append(towerIcon(k, mini ? 50 : 68), t);
  if (onClick) el.onclick = onClick;
  return el;
}
/** Iconos pequeños de un mazo [[clave, nivel], ...] (se usa en la sala y en el juego). */
export function deckIcons(deck, size = 34) {
  const box = document.createElement('span');
  box.className = 'dicons';
  for (const [k, l] of deck || []) {
    if (!TOWERS[k]) continue;
    const w = document.createElement('span');
    w.className = 'dicon r' + TOWERS[k].rar;
    w.style.setProperty('--rc', RARITY[TOWERS[k].rar].c);
    w.title = `${TOWERS[k].name} · ${RARITY[TOWERS[k].rar].n} · nivel ${l}`;
    w.append(towerIcon(k, size));
    if (l > 1) { const s = document.createElement('i'); s.textContent = l + '★'; w.append(s); }
    box.append(w);
  }
  return box;
}

/** Dibuja el icono del filete (se usa como imagen de fondo de .steak). */
function steakIcon() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.lineJoin = 'round';
  c.beginPath(); c.moveTo(14, 20); c.bezierCurveTo(22, 4, 52, 6, 56, 26); c.bezierCurveTo(60, 46, 40, 60, 24, 54); c.bezierCurveTo(6, 48, 6, 34, 14, 20); c.closePath();
  c.fillStyle = '#fff1dc'; c.fill(); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.moveTo(19, 24); c.bezierCurveTo(25, 13, 46, 13, 49, 28); c.bezierCurveTo(52, 42, 38, 52, 26, 47); c.bezierCurveTo(14, 43, 14, 33, 19, 24); c.closePath();
  c.fillStyle = '#e8443a'; c.fill();
  c.fillStyle = '#ff8a7a'; c.beginPath(); c.ellipse(30, 26, 8, 4, -0.4, 0, TAU); c.fill();
  c.beginPath(); c.arc(38, 38, 5, 0, TAU); c.fillStyle = '#fff1dc'; c.fill(); c.lineWidth = 2.5; c.stroke();
  return cv.toDataURL();
}

// ---------- cofre dibujado ----------
/** Cofre de madera. open 0-1 = cuánto se ha levantado la tapa. glow = color de la luz que sale. */
function drawChest(c, x, y, s, open, glow) {
  c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round';
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 44, 70, 12, 0, 0, TAU); c.fill();
  if (open > 0 && glow) {
    const g = c.createLinearGradient(0, -20, 0, -150);
    g.addColorStop(0, glow); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalAlpha = Math.min(1, open * 1.4) * 0.85; c.fillStyle = g;
    c.beginPath(); c.moveTo(-52, -18); c.lineTo(-90, -160); c.lineTo(90, -160); c.lineTo(52, -18); c.closePath(); c.fill();
    c.globalAlpha = 1;
  }
  const box = (px, py, w, h, r, fill) => { c.beginPath(); c.roundRect(px, py, w, h, r); c.fillStyle = fill; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(); };
  // interior (se ve al abrir)
  if (open > 0) { box(-56, -24, 112, 30, 4, '#3a2413'); c.fillStyle = glow || '#ffd23f'; c.globalAlpha = 0.9; c.fillRect(-52, -20, 104, 12); c.globalAlpha = 1; }
  // caja
  box(-60, -14, 120, 58, 8, '#a8692f');
  c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(-56, -10, 112, 8);
  c.strokeStyle = '#7a4a1e'; c.lineWidth = 2; c.beginPath(); for (const px of [-30, 0, 30]) { c.moveTo(px, -12); c.lineTo(px, 42); } c.stroke();
  for (const px of [-48, 38]) box(px, -14, 10, 58, 2, '#ffd23f');
  // tapa
  c.save(); c.translate(0, -14 - open * 34); c.rotate(-open * 0.16);
  c.beginPath(); c.moveTo(-64, 2); c.lineTo(-64, -18); c.quadraticCurveTo(-64, -44, 0, -44); c.quadraticCurveTo(64, -44, 64, -18); c.lineTo(64, 2); c.closePath();
  c.fillStyle = '#b97a3a'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(-10, -32, 40, 6, 0, 0, TAU); c.fill();
  for (const px of [-48, 38]) { c.beginPath(); c.moveTo(px, 2); c.lineTo(px, -34 - (px < 0 ? 0 : 0)); c.lineTo(px + 10, -36); c.lineTo(px + 10, 2); c.closePath(); c.fillStyle = '#ffd23f'; c.fill(); c.stroke(); }
  box(-11, -10, 22, 22, 5, '#ffd23f');
  c.fillStyle = INK; c.beginPath(); c.arc(0, -1, 3.4, 0, TAU); c.fill(); c.fillRect(-1.6, 0, 3.2, 7);
  c.restore();
  c.restore();
}

let chestRaf = 0;
/** Animación de apertura: el cofre tiembla, se abre con la luz del color de la calidad y sale la torre. */
function playChest(res) {
  const cv = $('chestCv'), c = cv.getContext('2d'), d = TOWERS[res.k], col = RARITY[res.rar].c;
  const icon = towerIcon(res.k, 110), t0 = performance.now(), wait = 1.15 + res.rar * 0.3; // las buenas se hacen esperar
  let shown = false;
  $('chestModal').classList.remove('hidden');
  $('chestTitle').textContent = 'Abriendo…'; $('chestTitle').style.color = '';
  cv.parentElement.style.removeProperty('--rc');
  $('chestText').innerHTML = '&nbsp;';
  $('btnChestAgain').classList.add('hidden'); $('btnChestClose').classList.add('hidden');
  const skip = () => { cv._skip = true; };
  cv._skip = false; cv.onclick = skip;
  cancelAnimationFrame(chestRaf);
  const reveal = () => {
    shown = true;
    const what = { new: '¡TORRE NUEVA!', up: `¡SUBE AL NIVEL ${res.l}!`, copy: 'Copia conseguida', fil: `Ya estaba al máximo: +${res.fil} filetes` }[res.what];
    $('chestTitle').textContent = d.name; $('chestTitle').style.color = col;
    cv.parentElement.style.setProperty('--rc', col);
    $('chestText').innerHTML = `<span class="rar" style="color:${col}">${RARITY[res.rar].n}</span> · <b>${what}</b>`
      + (res.what === 'copy' ? ` (${res.c}/${res.need} para el nivel ${res.l + 1})` : '')
      + (res.what === 'up' ? ` Ahora hace +${Math.round(prog.levelBonus(res.l) * 1000) / 10}% de daño y alcance.` : '')
      + (res.what === 'new' ? ' Ya puedes meterla en un mazo.' : '')
      + (res.forced ? '<br><small>Seguro de mala suerte: Épica garantizada.</small>' : '');
    const left = api.profile().inv.chests;
    $('btnChestAgain').classList.toggle('hidden', left < 1);
    $('btnChestAgain').textContent = `Abrir otro (${left})`;
    $('btnChestClose').classList.remove('hidden');
  };
  const frame = () => {
    let t = (performance.now() - t0) / 1000;
    if (cv._skip && t < wait + 0.9) t = wait + 0.9;
    c.clearRect(0, 0, cv.width, cv.height);
    const cx = cv.width / 2, cy = 250;
    if (t < wait) {
      const k = t / wait, sh = Math.sin(t * 38) * (2 + k * 9);
      // la luz de la calidad se va colando por la rendija
      if (k > 0.55) { c.globalAlpha = (k - 0.55) * 1.6; c.fillStyle = col; c.beginPath(); c.ellipse(cx, cy - 22, 90 + sh, 16, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
      c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 31) * 0.02 * (1 + k * 3)); drawChest(c, sh, 0, 1.25, 0, null); c.restore();
    } else {
      const o = Math.min(1, (t - wait) / 0.35), q = Math.min(1, Math.max(0, (t - wait - 0.15) / 0.55)), ease = 1 - (1 - q) ** 3;
      // rayos giratorios
      c.save(); c.translate(cx, 120); c.rotate(t * 0.5); c.globalAlpha = 0.5 * ease;
      for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(-22, -230); c.lineTo(22, -230); c.closePath(); c.fillStyle = i % 2 ? col : '#fff6c2'; c.fill(); }
      c.restore(); c.globalAlpha = 1;
      drawChest(c, cx, cy, 1.25, o, col);
      if (q > 0) {
        const y = cy - 40 - ease * 92, s = 0.3 + ease * 0.9 + Math.sin(t * 3) * 0.02;
        c.beginPath(); c.arc(cx, y, 62 * s, 0, TAU); c.fillStyle = 'rgba(58,36,19,0.55)'; c.fill(); c.lineWidth = 6; c.strokeStyle = col; c.stroke();
        c.drawImage(icon, cx - 82 * s, y - 80 * s, 164 * s, 164 * s);
        if (res.rar >= 2) for (let i = 0; i < 8; i++) { const a = t * 1.4 + i * TAU / 8, r = 86 + Math.sin(t * 4 + i) * 8; c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + Math.cos(a) * r, y + Math.sin(a) * r, 3, 0, TAU); c.fill(); }
      }
      if (t < wait + 0.25) { c.globalAlpha = 1 - (t - wait) / 0.25; c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.globalAlpha = 1; }
      if (q >= 1 && !shown) reveal();
    }
    if (!$('chestModal').classList.contains('hidden')) chestRaf = requestAnimationFrame(frame);
  };
  frame();
}

// ---------- guardar ----------
function save(now) {
  clearTimeout(saveTimer);
  const run = () => api.save().catch((err) => { console.error(err); $('bagMsg').textContent = $('deckMsg').textContent = 'No se ha podido guardar en tu cuenta. Revisa la conexión.'; });
  if (now) return run();
  saveTimer = setTimeout(run, 500);
  return null;
}

// ---------- Torres (colección) ----------
function renderTowers() {
  const p = api.profile(), grid = $('towerGrid');
  grid.textContent = '';
  let n = 0;
  for (const k of SORTED) { const c = prog.card(p, k); if (c.owned) n++; grid.append(towerCard(k, c, { onClick: () => showTower(k) })); }
  $('towerCount').textContent = `· tienes ${n} de ${TOWER_KEYS.length}`;
}
function showTower(k) {
  const p = api.profile(), d = TOWERS[k], c = prog.card(p, k), col = RARITY[d.rar].c, box = $('towerDetail');
  box.textContent = '';
  box.style.setProperty('--rc', col);
  const head = document.createElement('div');
  head.className = 'td-head';
  const txt = document.createElement('div');
  txt.innerHTML = `<h3 style="color:${col}">${d.name}</h3>
    <p><span class="rar" style="color:${col}">${RARITY[d.rar].n}</span> · ${d.cost} de oro${d.each ? ' · 1 por jugador' : d.max ? ` · máximo ${d.max} entre todos` : ''}</p>
    <p class="td-desc">${esc(d.desc)}</p>
    ${c.owned
      ? `<p>${stars(c.l)} Nivel ${c.l}${c.l > 1 ? `: <b>+${Math.round(prog.levelBonus(c.l) * 1000) / 10}%</b> de daño y alcance` : ''} · ${c.need ? `${c.c}/${c.need} copias para el nivel ${c.l + 1}` : `nivel máximo (cada copia que salga da ${prog.REFUND[d.rar]} filetes)`}</p>`
      : '<p class="lockt">Todavía no la tienes: sale en los cofres.</p>'}`;
  head.append(towerIcon(k, 104), txt);
  const paths = document.createElement('div');
  paths.className = 'td-paths';
  d.paths.forEach((P, i) => {
    const col2 = document.createElement('div');
    col2.className = 'td-path';
    col2.style.setProperty('--pc', P.color);
    const tiers = [0, 0, 0]; tiers[i] = 5;
    const h = document.createElement('div');
    h.className = 'td-ph';
    h.append(towerIcon(k, 56, tiers));
    h.insertAdjacentHTML('beforeend', `<b>Rama ${i + 1}<br>${esc(P.name)}</b>`);
    col2.append(h);
    col2.insertAdjacentHTML('beforeend', P.ups.map((u, j) => `<div class="td-up"><b>${j + 1}. ${esc(u.n)}</b> <span>${u.c}</span><small>${esc(u.d)}</small></div>`).join(''));
    paths.append(col2);
  });
  const close = document.createElement('button');
  close.className = 'btn ghost'; close.textContent = 'Cerrar';
  close.onclick = () => $('towerModal').classList.add('hidden');
  box.append(head, paths, close);
  $('towerModal').classList.remove('hidden');
}

// ---------- Bolsa ----------
function renderBag() {
  const p = api.profile(), inv = p.inv;
  $('homeFil').textContent = $('bagFil').textContent = fmt(inv.fil);
  $('bagChests').textContent = inv.chests;
  $('btnBuyChest').disabled = inv.fil < prog.CHEST_COST;
  $('btnOpenChest').disabled = inv.chests < 1;
  $('btnOpenChest').textContent = inv.chests > 1 ? `Abrir un cofre (${inv.chests})` : 'Abrir un cofre';
  const left = prog.pityLeft(p);
  $('bagPity').textContent = left <= 1 ? 'Seguro de mala suerte: ¡tu próximo cofre trae una Épica o Legendaria segura!'
    : `Seguro de mala suerte: Épica o mejor garantizada en ${left} cofres como mucho.`;
  $('bagOdds').innerHTML = RARITY.map((r, i) => {
    const pool = TOWER_KEYS.filter((k) => TOWERS[k].rar === i), have = pool.filter((k) => prog.owned(p, k)).length;
    return `<div class="odd" style="--rc:${r.c}"><b>${prog.ODDS[i]}%</b><span>${r.n}</span><small>${have}/${pool.length} conseguidas</small></div>`;
  }).join('');
  const cop = $('bagCopies');
  cop.textContent = '';
  for (const k of SORTED) { const c = prog.card(p, k); if (c.owned) cop.append(towerCard(k, c, { onClick: () => showTower(k) })); }
  const WHAT = { new: '¡torre nueva!', up: 'subió al nivel', copy: 'copia · nivel', fil: 'al máximo →' };
  $('bagHist').innerHTML = inv.hist.length
    ? inv.hist.map(([k, what, x]) => `<div class="hrow" style="--rc:${RARITY[TOWERS[k].rar].c}"><b>${TOWERS[k].name}</b><span class="rar">${RARITY[TOWERS[k].rar].n}</span><span>${WHAT[what] || ''}${what === 'new' ? '' : what === 'fil' ? ` +${x} filetes` : ' ' + x}</span></div>`).join('')
    : '<p class="note">Todavía no has abierto ningún cofre. Tienes uno de bienvenida esperándote.</p>';
  const ic = $('bagChestIc'), g = ic.getContext('2d');
  g.clearRect(0, 0, ic.width, ic.height);
  drawChest(g, 64, 60, 0.82, 0, null);
}
function buy() {
  const p = api.profile();
  if (!prog.buyChest(p)) { $('bagMsg').textContent = `Te faltan ${prog.CHEST_COST - p.inv.fil} filetes. Se ganan al acabar cada partida.`; return; }
  $('bagMsg').textContent = 'Cofre comprado: ábrelo ahora o guárdalo para luego.';
  save(true); refresh();
}
function open() {
  const p = api.profile();
  if (p.inv.chests < 1) return;
  const res = prog.openChest(p);
  if (!res) return;
  $('bagMsg').textContent = '';
  save(true);      // se guarda antes de enseñar el premio: recargar la página no cambia lo que ha salido
  refresh();
  playChest(res);
}

// ---------- Mazos ----------
function renderDecks() {
  const p = api.profile();
  deckSel = Math.max(0, Math.min(p.decks.length - 1, deckSel));
  const d = p.decks[deckSel], tabs = $('deckTabs');
  tabs.textContent = '';
  p.decks.forEach((x, i) => {
    const b = document.createElement('button');
    b.className = 'dtab' + (i === deckSel ? ' sel' : '');
    b.innerHTML = `${esc(x.n)}${i === p.deck ? ' <span class="use">EN USO</span>' : ''}<small>${x.t.length}/${prog.DECK_SIZE}</small>`;
    b.onclick = () => { deckSel = i; renderDecks(); };
    tabs.append(b);
  });
  if (p.decks.length < prog.MAX_DECKS) {
    const b = document.createElement('button');
    b.className = 'dtab add'; b.textContent = '+ Nuevo mazo';
    b.onclick = () => { p.decks.push({ n: 'Mazo ' + (p.decks.length + 1), t: [] }); deckSel = p.decks.length - 1; save(); renderDecks(); };
    tabs.append(b);
  }
  if (document.activeElement !== $('deckName')) $('deckName').value = d.n;
  $('btnDeckUse').disabled = deckSel === p.deck || !prog.deckPlayable(d.t);
  $('btnDeckUse').textContent = deckSel === p.deck ? 'Mazo en uso' : 'Usar este mazo';
  $('btnDeckDel').disabled = p.decks.length < 2;
  const slots = $('deckSlots');
  slots.textContent = '';
  for (let i = 0; i < prog.DECK_SIZE; i++) {
    const k = d.t[i];
    if (k) slots.append(towerCard(k, prog.card(p, k), { mini: true, onClick: () => toggle(k), note: `Tecla ${i + 1}` }));
    else { const e = document.createElement('div'); e.className = 'tc mini empty'; e.textContent = 'Hueco libre'; slots.append(e); }
  }
  $('deckMsg').textContent = !d.t.length ? 'Mazo vacío: añade torres de tu colección.'
    : !prog.deckPlayable(d.t) ? 'Este mazo no tiene ninguna torre que ataque: así no se puede usar.'
    : d.t.length < prog.DECK_SIZE ? `Puedes añadir ${prog.DECK_SIZE - d.t.length} ${prog.DECK_SIZE - d.t.length === 1 ? 'torre más' : 'torres más'}.` : '';
  const pool = $('deckPool');
  pool.textContent = '';
  for (const k of SORTED) {
    const c = prog.card(p, k);
    if (!c.owned) continue;
    const el = towerCard(k, c, { mini: true, onClick: () => toggle(k), note: d.t.includes(k) ? 'En el mazo' : '' });
    if (d.t.includes(k)) el.classList.add('in');
    pool.append(el);
  }
}
function toggle(k) {
  const p = api.profile(), d = p.decks[deckSel], i = d.t.indexOf(k);
  if (i >= 0) d.t.splice(i, 1);
  else if (d.t.length >= prog.DECK_SIZE) { $('deckMsg').textContent = `El mazo ya tiene ${prog.DECK_SIZE} torres: saca una antes.`; return; }
  else d.t.push(k);
  // el mazo en uso siempre tiene que poder jugarse
  if (deckSel === p.deck && !prog.deckPlayable(d.t)) { const ok = p.decks.findIndex((x) => prog.deckPlayable(x.t)); if (ok >= 0) p.deck = ok; }
  save(); renderDecks();
}

// ---------- arranque ----------
export function init(a) {
  api = a;
  document.documentElement.style.setProperty('--steak', `url(${steakIcon()})`);
  $('btnBuyChest').onclick = buy;
  $('btnOpenChest').onclick = open;
  $('btnChestAgain').onclick = open;
  $('btnChestClose').onclick = () => { $('chestModal').classList.add('hidden'); cancelAnimationFrame(chestRaf); };
  $('towerModal').addEventListener('click', (e) => { if (e.target === $('towerModal')) $('towerModal').classList.add('hidden'); });
  $('deckName').addEventListener('input', () => { const p = api.profile(); p.decks[deckSel].n = $('deckName').value.slice(0, 16) || 'Mazo ' + (deckSel + 1); save(); renderDecks(); });
  $('btnDeckUse').onclick = () => { const p = api.profile(); if (prog.deckPlayable(p.decks[deckSel].t)) { p.deck = deckSel; save(); renderDecks(); } };
  $('btnDeckDel').onclick = () => {
    const p = api.profile();
    if (p.decks.length < 2) return;
    p.decks.splice(deckSel, 1);
    if (p.deck === deckSel) p.deck = Math.max(0, p.decks.findIndex((x) => prog.deckPlayable(x.t)));
    else if (p.deck > deckSel) p.deck--;
    deckSel = Math.min(deckSel, p.decks.length - 1);
    save(); renderDecks();
  };
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $('towerModal').classList.add('hidden');
    if (!$('btnChestClose').classList.contains('hidden')) $('btnChestClose').click();
  });
}
/** Vuelve a pintar Torres, Bolsa y Mazos con los datos de la cuenta. */
export function refresh() {
  if (!api || !api.profile()) return;
  deckSel = Math.min(deckSel, api.profile().decks.length - 1);
  renderTowers(); renderBag(); renderDecks();
}
/** Al entrar con una cuenta: la pestaña Mazos empieza en el mazo en uso. */
export function start() { deckSel = api.profile().deck; refresh(); }
