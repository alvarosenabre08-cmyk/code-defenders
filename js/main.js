// ============================================================
//  Leones TD — interfaz, entrada del jugador y pegamento con la red
//
//  Modelo de red: el navegador del ANFITRIÓN ejecuta la simulación y publica
//  instantáneas; los demás envían acciones y dibujan lo que reciben.
//  Si el anfitrión se va, el jugador más antiguo de la sala hereda el puesto.
//
//  Cada jugador entra con su cuenta y ocupa un puesto (0-3) con su color, su oro, su mazo y sus torres.
// ============================================================
import { W, H, CELL, COLS, MAPS, PLAYER_COLORS, PLAYER_COLOR_NAMES, TOWERS, RARITY, ENEMIES, CARDS, ABIL, skin, skipBonus, waveSummary } from './data.js';
import {
  newGame, step, settle, applyAction, setRoster, setDeck, pack, unpack, STEP, TARGET_MODES,
  cellFree, underLimit, limitFor, towerAt, buildCost, upgradeCost, lockReason, sellValue, tStats, tRange,
} from './sim.js';
import { render, addFx, clearFx, drawTower, drawMapThumb } from './render.js';
import { isConfigured } from './net.js';
import * as account from './account.js';
import * as prog from './meta.js';
import * as homeUI from './home.js';

const $ = (id) => document.getElementById(id);
const now = () => performance.now() / 1000;
const MOCK = new URLSearchParams(location.search).has('mock');
const PUBLISH_MS = 150;

// ---------- estado ----------
let me = null;           // cuenta con la que se ha entrado: { uid, name, profile }
let net = null, solo = false, myName = '';
let meta = null, players = {}, selMap = 0;
let S = null;            // estado autoritativo (solo anfitrión)
let G = null;            // estado que se dibuja (anfitrión: S; cliente: última instantánea)
let prevMap = null, snapAt = 0, lastSnapStr = null;
let isHost = false, stopActions = null, simTimer = null, acc = 0, lastTick = 0, outFx = [], lastPub = 0, dirty = false;
let placing = null, movingId = null, selId = null, selOb = -1, hover = null;
let mouse = { x: -100, y: -100 }, mouseDirty = false, cursors = {};
const curView = {};
let msg = '', msgWarn = false, msgUntil = 0, panelSig = '';

const slotNames = {};    // último nombre visto en cada puesto
/** Mi puesto (0-3): decide mi color, mi oro y qué torres son mías. */
const mySlot = () => (solo || !net ? 0 : players[net.pid]?.slot ?? 0);
const myGold = () => (G ? G.money[mySlot()] || 0 : 0);
const slotName = (s) => slotNames[s] || 'otro jugador';
/** Puestos de los jugadores conectados ahora mismo. */
const presentSlots = () => (solo ? [0] : [...new Set(Object.values(players).map((p) => p.slot))].filter((x) => x >= 0 && x < 4));
const fmt = (n) => Math.round(n).toLocaleString('es-ES');

const cv = $('cv'), ctx = cv.getContext('2d');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- pantallas ----------
const SCREENS = ['login', 'home', 'lobby', 'game'];
function show(name) {
  for (const x of SCREENS) $(x).classList.toggle('hidden', x !== name);
  const inRoom = name === 'lobby' || name === 'game';
  $('chat').classList.toggle('hidden', solo || !net || !inRoom);
  $('chat').classList.toggle('lobby', name === 'lobby');
  $('btnChat').classList.toggle('hidden', solo || !net);
}
const current = () => SCREENS.find((x) => !$(x).classList.contains('hidden'));

// ---------- entrar con la cuenta ----------
async function doAuth(mode) {
  $('loginMsg').textContent = 'Conectando…';
  $('btnLogin').disabled = $('btnRegister').disabled = true;
  try {
    afterLogin(await account[mode]($('inName').value, $('inPin').value, $('chkRemember').checked));
    $('loginMsg').textContent = ''; $('inPin').value = '';
  } catch (err) {
    $('loginMsg').textContent = err.message || String(err);
  }
  $('btnLogin').disabled = $('btnRegister').disabled = false;
}
function afterLogin(acc) {
  me = acc; myName = acc.name;
  prog.normalize(me.profile); // completa lo que falte (cuentas de antes de los cofres, datos a medias...)
  homeUI.start();
  renderHome(); show('home');
}
homeUI.init({ profile: () => me?.profile, save: () => account.save({}) });

// ---------- mazos: cómo viajan por la red ----------
/** Mazo → texto corto para la sala: "firewall1,gc3,king1". */
const deckStr = (deck) => deck.map(([k, l]) => k + l).join(',');
function parseDeck(str) {
  const out = [];
  for (const part of String(str || '').split(',')) {
    const m = /^([a-z]+)([1-5])$/.exec(part);
    if (m && TOWERS[m[1]] && !out.some((x) => x[0] === m[1])) out.push([m[1], +m[2]]);
  }
  return out.slice(0, prog.DECK_SIZE);
}
const myDeckStr = () => deckStr(prog.activeDeck(me.profile));
/** Mazos de los jugadores conectados, por puesto. */
function decksBySlot() {
  const out = {};
  for (const q of Object.values(players)) { const d = parseDeck(q.dk); if (d.length && q.slot >= 0 && q.slot < 4) out[q.slot] = d; }
  return out;
}
$('btnLogin').onclick = () => doAuth('login');
$('btnRegister').onclick = () => doAuth('register');
$('inPin').addEventListener('keydown', (e) => { if (e.key === 'Enter') doAuth('login'); });
$('inName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('inPin').focus(); });
$('btnLogout').onclick = () => { account.logout(); location.reload(); };
if (account.isLocal()) $('loginMsg').textContent = MOCK ? 'Modo de pruebas: las cuentas se guardan en este navegador.' : 'Sin Firebase configurado: las cuentas se guardan solo en este navegador.';
account.resume().then((acc) => { if (acc) afterLogin(acc); }).catch(() => {});

// ---------- menú principal ----------
$('homeNav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  for (const n of $('homeNav').children) n.classList.toggle('sel', n === b);
  for (const t of document.querySelectorAll('#home .tab')) t.classList.toggle('hidden', t.id !== 'tab-' + b.dataset.tab);
});
function renderHome() {
  if (!me) return;
  homeUI.refresh();
  const st = me.profile.st, since = new Date(me.profile.created || Date.now()).toLocaleDateString('es-ES');
  $('homeName').textContent = me.name;
  $('homeSub').textContent = `${st.games} partidas · ${st.wins} victorias`;
  const best = MAPS.map((M, i) => `<div class="sbox"><b>${st.best?.[i] || 0}<small> / ${M.waves}</small></b><small>Mejor oleada en ${M.name}${st.mapWins?.[i] ? ` · ${st.mapWins[i]} ${st.mapWins[i] === 1 ? 'victoria' : 'victorias'}` : ''}</small></div>`).join('');
  $('statGrid').innerHTML = `
    <div class="sbox"><b>${fmt(st.games)}</b><small>Partidas jugadas</small></div>
    <div class="sbox"><b>${fmt(st.wins)}</b><small>Victorias</small></div>
    <div class="sbox"><b>${fmt(st.kills)}</b><small>Barriles rotos (por tu manada)</small></div>
    <div class="sbox"><b>${fmt(st.dmg)}</b><small>Daño hecho por tus torres</small></div>
    <div class="sbox"><b>${fmt(st.gold)}</b><small>Oro ganado</small></div>${best}`;
  $('profileBox').innerHTML = `Nombre: <b>${esc(me.name)}</b><br>Cuenta creada el <b>${since}</b><br>Partidas: <b>${st.games}</b> · Victorias: <b>${st.wins}</b>`
    + (account.isLocal() ? '<br><span style="color:var(--amber)">Esta cuenta está guardada solo en este navegador.</span>' : '');
}
// ---------- jugar: crear sala, unirse o práctica ----------
if (!isConfigured() && !MOCK) {
  $('btnCreate').disabled = $('btnJoin').disabled = true;
  $('menuMsg').textContent = 'Multijugador desactivado: falta pegar la configuración de Firebase en js/firebase-config.js';
}
async function getNet() {
  if (net) return net;
  const mod = MOCK ? await import('./net-mock.js') : await import('./net.js');
  net = await mod.connect();
  return net;
}
async function enterRoom(fn) {
  if (!me) return;
  $('menuMsg').textContent = 'Conectando…';
  try {
    await getNet();
    await fn();
    $('menuMsg').textContent = '';
    $('lobbyCode').textContent = $('hudCode').textContent = net.code;
    show('lobby');
    subscribe();
  } catch (err) {
    console.error(err);
    $('menuMsg').textContent = err.message?.includes('sala') ? err.message : 'Error de conexión: ' + (err.message || err);
  }
}
$('btnCreate').onclick = () => enterRoom(() => net.create(myName, me.uid, myDeckStr()));
$('btnJoin').onclick = () => {
  const code = $('inCode').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { $('menuMsg').textContent = 'El código son 4 letras.'; return; }
  enterRoom(() => net.join(code, myName, me.uid, myDeckStr()));
};
$('inCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnSolo').onclick = () => {
  if (!me) return;
  solo = true; isHost = true;
  players = { me: { name: myName, slot: 0, dk: myDeckStr() } }; slotNames[0] = myName;
  $('lobbyCode').textContent = $('hudCode').textContent = 'SOLO';
  updateLobby(); show('lobby');
};
// Salir al menú: se recarga la página (la sesión se recupera sola y vuelves al menú principal)
$('btnLeave').onclick = () => { net?.leave(); location.reload(); };
addEventListener('pagehide', () => net?.leave());

// ---------- sala ----------
function subscribe() {
  net.on('meta', (m) => {
    meta = m;
    if (m && typeof m.map === 'number') selMap = m.map;
    evalHost(); updateLobby();
    if (m?.started && current() !== 'game') show('game');
    if (m && !m.started && current() === 'game') toLobby();
  });
  net.on('players', (p) => {
    players = p || {};
    for (const q of Object.values(players)) slotNames[q.slot] = q.name;
    playersChanged(); evalHost(); updateLobby();
  });
  net.on('s', (str) => {
    lastSnapStr = str || null;
    if (isHost) return;
    if (!str) { G = null; return; }
    const u = unpack(str);
    prevMap = G ? new Map(G.E.map((e) => [e.i, e.d])) : null;
    G = u.S; snapAt = performance.now();
    addFx(u.fx, now());
  });
  net.on('c', (c) => { cursors = c || {}; });
  net.onChat(addChat);
}
function toLobby() {
  G = null; S = null; clearFx(); cancel();
  $('overlay').className = 'overlay hidden'; $('overlay').dataset.state = '';
  $('cards').classList.add('hidden');
  show('lobby'); updateLobby();
}

// selector de mapa
const mapBtns = MAPS.map((M, i) => {
  const b = document.createElement('button');
  b.className = 'map';
  const th = document.createElement('canvas'); th.width = 256; th.height = 128;
  const txt = document.createElement('div');
  txt.innerHTML = `<b style="color:${M.theme.a}">${i + 1}. ${M.name}</b> <span class="diff d${i}">${M.diff}</span><small>${M.tag} · ${M.waves} oleadas · ${M.life} vidas</small><p>${M.desc}</p>`;
  b.append(th, txt);
  b.onclick = () => {
    if (!isHost) return;
    selMap = i;
    if (net && !solo) net.setMeta({ map: i });
    updateLobby();
  };
  $('mapSel').append(b);
  requestAnimationFrame(() => drawMapThumb(th, i));
  return b;
});

function sortedPlayers() {
  return Object.entries(players).sort((a, b) => (a[1].slot ?? 9) - (b[1].slot ?? 9));
}
let lobbySig = '';
function updateLobby() {
  const list = sortedPlayers(), myId = net ? net.pid : 'me';
  const sig = JSON.stringify([list.map((p) => [p[0], p[1].name, p[1].slot, p[1].dk]), meta?.host, solo, me?.profile.deck, me?.profile.decks.map((d) => d.n + d.t.join())]);
  if (sig !== lobbySig) {
    lobbySig = sig;
    const ul = $('lobbyPlayers');
    ul.textContent = '';
    for (let i = 0; i < (solo ? 1 : 4); i++) {
      const p = list[i], li = document.createElement('li');
      if (!p) { li.className = 'empty'; li.textContent = 'esperando…'; ul.append(li); continue; }
      const col = PLAYER_COLORS[p[1].slot % 4];
      li.style.borderColor = col;
      li.innerHTML = `<span style="color:${col}">${esc(p[1].name)}${p[0] === meta?.host ? ' ★' : ''}${p[0] === myId ? ' (tú)' : ''}<small> · ${PLAYER_COLOR_NAMES[p[1].slot % 4]}</small></span>`;
      li.append(homeUI.deckIcons(parseDeck(p[1].dk), 30));
      ul.append(li);
    }
    // mi mazo: se puede cambiar aquí entre los que tengo guardados
    const box = $('lobbyDeck');
    box.textContent = '';
    if (me) {
      const lab = document.createElement('label'), sel = document.createElement('select');
      lab.textContent = 'Tu mazo: ';
      me.profile.decks.forEach((d, i) => {
        const o = document.createElement('option');
        o.value = i; o.textContent = `${d.n} (${d.t.length}/${prog.DECK_SIZE})`; o.disabled = !prog.deckPlayable(d.t); o.selected = i === me.profile.deck;
        sel.append(o);
      });
      sel.onchange = () => {
        me.profile.deck = +sel.value;
        account.save({}).catch((err) => console.error(err));
        if (solo) players.me.dk = myDeckStr(); else net?.setDeck(myDeckStr());
        updateLobby();
      };
      lab.append(sel);
      box.append(lab);
    }
  }
  $('btnStart').classList.toggle('hidden', !isHost);
  mapBtns.forEach((b, i) => { b.classList.toggle('sel', i === selMap); b.disabled = !isHost; });
  $('lobbyMsg').textContent = solo ? 'Práctica en solitario: elige mapa y empieza.'
    : isHost ? `${list.length}/4 jugadores. Elige el mapa y empieza cuando quieras.` : 'Esperando a que el anfitrión (★) elija mapa y empiece…';
}
/** Oro de los compañeros en la barra de arriba (el mío va aparte, en grande). */
let chipSig = '';
function updateChips() {
  const mine = mySlot(), here = presentSlots();
  const rows = G.act.filter((x) => x !== mine).map((x) => [x, Math.floor(G.money[x] || 0), here.includes(x)]);
  const sig = mine + '|' + rows.join(';') + '|' + rows.map((r) => slotName(r[0])).join();
  if (sig === chipSig) return;
  chipSig = sig;
  $('hudMine').style.setProperty('--mine', PLAYER_COLORS[mine]);
  $('hudPlayers').innerHTML = rows.map(([x, gold, on]) =>
    `<span class="chip${on ? '' : ' away'}" style="border-color:${PLAYER_COLORS[x]};color:${PLAYER_COLORS[x]}" title="${on ? 'Oro de ' + esc(slotName(x)) : esc(slotName(x)) + ' se ha desconectado'}"><span class="nm">${esc(slotName(x))}</span><i class="coin"></i>${gold}</span>`).join('');
}
$('btnStart').onclick = () => {
  if (!isHost) return;
  clearFx();
  S = G = newGame(selMap, presentSlots(), decksBySlot()); dirty = true;
  if (solo) { startSim(); show('game'); } else net.setMeta({ started: true, map: selMap });
};

// ---------- chat ----------
const chatLog = $('chatLog'), chatIn = $('chatIn');
let lastChat = -1e9, knownPlayers = null;
const knownNames = {};
function addChat(m) {
  if (!m || !m.m) return;
  const div = document.createElement('div');
  if (m.sys) { div.className = 'sys'; div.textContent = m.m; }
  else {
    const b = document.createElement('b');
    b.style.color = PLAYER_COLORS[(m.s | 0) % 4];
    b.textContent = String(m.n || '?').slice(0, 12) + ':';
    div.append(b, document.createTextNode(String(m.m).slice(0, 120)));
  }
  chatLog.append(div);
  while (chatLog.children.length > 40) chatLog.firstChild.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
  setTimeout(() => div.classList.add('old'), 12000);
}
function openChat() { $('chat').classList.add('open'); chatIn.focus(); chatLog.scrollTop = chatLog.scrollHeight; }
function closeChat() { $('chat').classList.remove('open'); chatIn.blur(); }
chatIn.addEventListener('focus', () => $('chat').classList.add('open'));
chatIn.addEventListener('blur', () => $('chat').classList.remove('open'));
chatIn.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') { chatIn.value = ''; closeChat(); return; }
  if (e.key !== 'Enter') return;
  const m = chatIn.value.trim();
  if (!m) { chatIn.value = ''; closeChat(); return; }
  if (performance.now() - lastChat < 600) return; // anti-spam: conserva el texto
  chatIn.value = '';
  lastChat = performance.now();
  net.chat(myName, mySlot(), m.slice(0, 120));
  closeChat();
});
/** Avisos de "X se ha unido / ha salido" en el chat. */
function playersChanged() {
  const cur = new Set(Object.keys(players));
  if (knownPlayers) {
    for (const id of cur) if (!knownPlayers.has(id) && id !== net.pid) addChat({ sys: 1, m: `${players[id].name} se ha unido.` });
    for (const id of knownPlayers) if (!cur.has(id) && knownNames[id]) addChat({ sys: 1, m: `${knownNames[id]} ha salido.` });
  }
  knownPlayers = cur;
  for (const id of cur) knownNames[id] = players[id].name;
}

// ---------- anfitrión ----------
function evalHost() {
  if (!meta || !net) return;
  const mine = meta.host === net.pid;
  if (mine && !isHost) becomeHost();
  else if (!mine && isHost) stopHost();
  // ¿el anfitrión se ha ido? El jugador más antiguo hereda la partida.
  const ids = Object.keys(players);
  if (!mine && ids.length && players[net.pid] && !players[meta.host]) {
    const order = Object.entries(players).sort((a, b) => (a[1].at || 0) - (b[1].at || 0) || a[0].localeCompare(b[0]));
    if (order[0][0] === net.pid) net.claimHost(meta.host);
  }
}
function becomeHost() {
  isHost = true;
  if (meta.started) {
    if (!S) S = lastSnapStr ? unpack(lastSnapStr).S : newGame(selMap, presentSlots(), decksBySlot());
    G = S; prevMap = null; dirty = true;
  }
  stopActions = net.onAction((a) => { if (S && applyAction(S, a)) { settle(S); dirty = true; } });
  startSim();
}
function stopHost() {
  isHost = false; S = null;
  if (stopActions) stopActions();
  stopActions = null;
  clearInterval(simTimer); simTimer = null;
}
/**
 * El anfitrión mantiene la lista de jugadores de la partida. Si alguien se desconecta se le
 * guarda el sitio 15 s (por si solo ha recargado o se le ha caído el wifi); pasado ese tiempo,
 * sus torres pasan al jugador con menos torres y su oro se reparte.
 */
const GRACE_MS = 15000, goneAt = {};
let lastMode = '';
function syncRoster() {
  const here = presentSlots();
  if (!here.length) return;
  const t = performance.now(), want = here.slice(), before = S.act.slice();
  for (const x of S.act) {
    if (here.includes(x)) { delete goneAt[x]; continue; }
    goneAt[x] ??= t;
    if (t - goneAt[x] < GRACE_MS) want.push(x); else delete goneAt[x];
  }
  // el mazo de cada jugador se fija la primera vez que aparece en la partida (también si entra tarde)
  const decks = decksBySlot();
  for (const x of here) if (!S.dk[x] && decks[x] && setDeck(S, x, decks[x])) dirty = true;
  if (!setRoster(S, want)) return;
  dirty = true;
  for (const x of before) if (!S.act.includes(x)) S._fx.push(['t', 640, 220, `${slotName(x)} se ha ido: sus torres y su oro pasan a la manada`, PLAYER_COLORS[x], 4]);
  for (const x of S.act) if (!before.includes(x)) S._fx.push(['t', 640, 220, `${slotName(x)} se une a la partida`, PLAYER_COLORS[x], 3]);
}
function startSim() {
  clearInterval(simTimer);
  lastTick = performance.now(); acc = 0;
  simTimer = setInterval(tick, 33);
}
function tick() {
  const t = performance.now(), dt = (t - lastTick) / 1000;
  lastTick = t;
  if (!S) return;
  if (!solo && net && S.ph === 'play') syncRoster();
  if (S.ph !== 'play' || S.pa || S.cd) acc = 0;
  else {
    // velocidad x1/x2/x4/x6: se dan más pasos de simulación por tick
    acc = Math.min(acc + dt * S.sp, 2 * S.sp); // si la pestaña estuvo en segundo plano, recupera hasta 2 s
    let n = 0;
    while (acc >= STEP && n++ < 400) { step(S, STEP); acc -= STEP; }
  }
  if (S._fx.length) { addFx(S._fx, now()); outFx.push(...S._fx); S._fx.length = 0; }
  if (solo || !net) { outFx.length = 0; return; }
  const every = S.ph === 'play' && !S.pa && !S.cd ? PUBLISH_MS : 2000;
  // fin de partida, pausa o reliquias: se publica al momento para que todos lo vean a la vez
  const mode = S.ph + (S.pa ? 'p' : '') + (S.cd ? 'c' : '') + S.gid;
  if (mode !== lastMode) { lastMode = mode; dirty = true; }
  if (dirty || t - lastPub >= every) {
    if (outFx.length > 60) { const cut = outFx.length - 24; outFx = outFx.filter((f, i) => f[0] !== 'b' || i >= cut).slice(-70); }
    net.publish(pack(S, outFx));
    outFx = []; lastPub = t; dirty = false;
  }
}

/** Envía una acción: el anfitrión la aplica directamente, el resto la manda por la red. */
function act(a) {
  a.n = myName; a.s = mySlot();
  if (isHost && S) { if (applyAction(S, a)) { settle(S); dirty = true; } }
  else if (net) net.act(a);
}

// ---------- mensajes de la barra inferior ----------
function info(text, warn) { msg = text; msgWarn = !!warn; msgUntil = now() + (warn ? 2.5 : 4); }
const firstSeen = {};
/** Texto de la próxima oleada (con aviso si aparece un enemigo nuevo). */
function previewText() {
  const w = G.w + 1, M = MAPS[G.map];
  if (w > M.waves) return '';
  const key = G.map * 100 + w;
  if (!firstSeen[key]) {
    const seen = new Set();
    for (let i = 1; i < w; i++) for (const [k] of waveSummary(G.map, i)) seen.add(k);
    const sum = waveSummary(G.map, w), nu = sum.find(([k]) => !seen.has(k) && ENEMIES[k].tip);
    firstSeen[key] = `Próxima oleada ${w}: ` + sum.map(([k, n]) => `${ENEMIES[k].name} ×${n}`).join(' · ')
      + (nu ? `  —  NUEVO ${ENEMIES[nu[0]].name}: ${ENEMIES[nu[0]].tip}` : '');
  }
  return firstSeen[key];
}
function hoverText() {
  if (!hover || placing) return '';
  const M = MAPS[G.map], key = hover.cy * COLS + hover.cx;
  const t = towerAt(G, hover.cx, hover.cy);
  if (t) return t.o === mySlot()
    ? `${TOWERS[t.k].name} ${t.p.join('-')}: U/I/O mejorar rama · T objetivo · Q habilidad · M mover · X vender`
    : `${TOWERS[t.k].name} ${t.p.join('-')} de ${slotName(t.o)}: solo su dueño puede mejorarla, venderla o moverla.`;
  const oi = M.obsAt.get(key);
  if (oi !== undefined && !G.ob[oi]) return `Obstáculo: estorba. Haz clic y quítalo por ${M.obs[oi][2]} de oro (o pulsa X).` + (M.padAt.has(key) ? ' Debajo hay un tótem de poder (+30% de daño).' : '');
  if (M.padAt.has(key)) return 'Tótem de poder: la torre que construyas aquí hace +30% de daño.';
  const ti = M.trapAt.get(key);
  if (ti !== undefined) {
    return M.traps[ti].t === 'bomb'
      ? 'Dinamita: haz clic para detonarla. Explosión en área, aturde y prende a los barriles aceitados. Recarga 50 s.'
      : 'Puente levadizo: haz clic para levantarlo 4 s (los barriles se amontonan delante). Recarga 45 s.';
  }
  if (M.swAt.has(key)) return 'Señal del cruce: haz clic para desviar los barriles por la otra rama. Recarga 8 s.';
  const z = M.zoneAt.get(key);
  if (z === 'heat') return 'Brasas / lava: queman a los barriles que pasan (más cuanto más lentos vayan) y hacen explotar a los aceitados.';
  if (z === 'cool') return 'Río: deja MOJADOS a los barriles. El León Chamán les hace una Descarga.';
  return '';
}
function idleText() {
  if (G.cd) return 'Elegid una reliquia: cualquiera de la manada puede escoger.';
  if (G.ph === 'play' && G.ic > 0) return previewText();
  return 'U/I/O mejorar rama · T objetivo · Q habilidad · X vender · M mover · F velocidad · Espacio saltar · H ayuda';
}

// ---------- tienda: las torres de MI mazo ----------
const shopBtns = {};
let shopKeys = [], shopSig = '';
function buildShop() {
  const dk = (G && G.dk && G.dk[mySlot()]) || prog.DEFAULT_DECK.map((k) => [k, 1]);
  const sig = dk.map((x) => x.join('')).join();
  if (sig === shopSig) return;
  shopSig = sig; shopKeys = dk.map((x) => x[0]);
  if (placing && !movingId && !shopKeys.includes(placing)) placing = null;
  $('shop').textContent = '';
  for (const k of Object.keys(shopBtns)) delete shopBtns[k];
  dk.forEach(([k, lv], i) => {
    const d = TOWERS[k], b = document.createElement('button');
    b.className = `item r${d.rar} lv${lv}`;
    b.style.setProperty('--rc', RARITY[d.rar].c);
    const txt = document.createElement('div');
    txt.innerHTML = `<b style="color:${d.color}">${d.name}</b>${lv > 1 ? `<span class="stars">${'★'.repeat(lv)}</span> ` : ''}<span class="cost"></span> <span class="key">[${i + 1}]</span>`;
    b.append(homeUI.towerIcon(k, 56), txt);
    b.onclick = () => choose(k);
    b.onmouseenter = () => info(`${d.name} (${RARITY[d.rar].n}${lv > 1 ? `, nivel ${lv}: +${Math.round(prog.levelBonus(lv) * 1000) / 10}% de daño y alcance` : ''}): ${d.desc}`);
    $('shop').append(b);
    shopBtns[k] = { b, cost: txt.querySelector('.cost'), last: -1 };
  });
}
function choose(k) {
  movingId = null; selId = null; selOb = -1;
  placing = placing === k ? null : k;
  if (placing) info(`${TOWERS[k].name}: ${TOWERS[k].desc}`);
  mouseDirty = true;
}
function cancel() { placing = null; movingId = null; selId = null; selOb = -1; mouseDirty = true; }

// ---------- entrada en el canvas ----------
function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
}
cv.addEventListener('pointermove', (e) => {
  mouse = toCanvas(e); mouseDirty = true;
  hover = { cx: Math.floor(mouse.x / CELL), cy: Math.floor(mouse.y / CELL) };
});
cv.addEventListener('pointerleave', () => { hover = null; });
cv.addEventListener('contextmenu', (e) => { e.preventDefault(); cancel(); });
cv.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !G) return;
  mouse = toCanvas(e);
  const cx = Math.floor(mouse.x / CELL), cy = Math.floor(mouse.y / CELL);
  hover = { cx, cy };
  if (G.ph !== 'play' || G.cd) return;
  const M = MAPS[G.map], key = cy * COLS + cx, oi = M.obsAt.get(key), hasOb = oi !== undefined && !G.ob[oi];
  if (placing) {
    if (hasOb) return info('Ahí hay un obstáculo: quítalo primero (clic sobre él sin torre elegida, o X).', true);
    if (movingId) {
      if (!cellFree(G, cx, cy, movingId)) return info('Ahí no se puede colocar.', true);
      act({ t: 'move', id: movingId, cx, cy });
      selId = movingId; placing = null; movingId = null;
    } else {
      if (!underLimit(G, placing, mySlot())) return info(`Máximo ${limitFor(G, placing)} ${TOWERS[placing].name} por jugador en esta partida.`, true);
      if (!cellFree(G, cx, cy)) return info('Ahí no se puede construir (camino, guarida, estructura u ocupado).', true);
      if (myGold() < buildCost(G, placing)) return info('No tienes oro suficiente.', true);
      act({ t: 'build', k: placing, cx, cy });
      if (!e.shiftKey) placing = null; // Mayús + clic para seguir construyendo
    }
    return;
  }
  const t = towerAt(G, cx, cy);
  selId = t ? t.i : null; selOb = -1;
  if (t) return;
  if (hasOb) { selOb = oi; return; }
  const ti = M.trapAt.get(key);
  if (ti !== undefined) {
    if (G.tr[ti].c > 0) return info(`Recargando: ${Math.ceil(G.tr[ti].c)} s.`, true);
    act({ t: 'trap', i: ti });
    return info(M.traps[ti].t === 'bomb' ? '¡Dinamita detonada!' : 'Puente levantado: paso cerrado 4 s.');
  }
  const si = M.swAt.get(key);
  if (si !== undefined) {
    if (G.swc > 0) return info(`La señal aún no se puede girar: ${Math.ceil(G.swc)} s.`, true);
    act({ t: 'sw', i: si });
    info('Señal girada: los barriles irán por la otra rama.');
  }
});

/** Torre sobre la que actúan las teclas: la seleccionada o, si no hay, la que está bajo el ratón. */
function targetTower() {
  if (!G) return null;
  if (selId) { const t = G.T.find((q) => q.i === selId); if (t) return t; }
  return hover ? towerAt(G, hover.cx, hover.cy) : null;
}
function targetOb() {
  if (!G) return -1;
  if (selOb >= 0 && !G.ob[selOb]) return selOb;
  if (!hover) return -1;
  const oi = MAPS[G.map].obsAt.get(hover.cy * COLS + hover.cx);
  return oi !== undefined && !G.ob[oi] ? oi : -1;
}
const NO_TOWER = 'Selecciona una torre o pon el ratón encima.';
/** true si la torre es mía; si no, avisa de quién es. */
function mine(t) {
  if (t.o === mySlot()) return true;
  info(`Esa torre es de ${slotName(t.o)}: solo su dueño puede mejorarla, venderla o moverla.`, true);
  return false;
}
const PATH_KEYS = ['U', 'I', 'O'];
function upgrade(t, i) {
  if (!t) return info(NO_TOWER, true);
  if (!mine(t)) return;
  const P = TOWERS[t.k].paths[i], lock = lockReason(G, t, i);
  if (lock) return info(`${P.name}: ${lock}.`, true);
  const cost = upgradeCost(G, t, i), u = P.ups[t.p[i]];
  if (myGold() < cost) return info(`No tienes oro suficiente: "${u.n}" cuesta ${cost}.`, true);
  act({ t: 'up', id: t.i, p: i });
  info(`${TOWERS[t.k].name} → ${u.n} (nivel ${t.p[i] + 1}): ${u.d}`);
}
function sell(t) {
  if (!t) return info(NO_TOWER, true);
  if (!mine(t)) return;
  act({ t: 'sell', id: t.i });
  info(`${TOWERS[t.k].name}: vendido por ${sellValue(t)} de oro.`);
  if (selId === t.i) selId = null;
}
function clearOb(i) {
  const o = MAPS[G.map].obs[i];
  if (myGold() < o[2]) return info(`No tienes oro suficiente: quitar el obstáculo cuesta ${o[2]}.`, true);
  act({ t: 'clear', i });
  info('Obstáculo eliminado: ya se puede construir ahí.');
  selOb = -1;
}
function startMove(t) {
  if (!t) return info(NO_TOWER, true);
  if (!mine(t)) return;
  selId = t.i; placing = t.k; movingId = t.i;
  info('Haz clic en la nueva posición (la torre tarda 3 s en reiniciarse). Esc cancela.');
}
function cycleTarget(t) {
  if (!t) return info(NO_TOWER, true);
  if (!mine(t)) return;
  act({ t: 'tgt', id: t.i });
  info(`${TOWERS[t.k].name}: objetivo → ${TARGET_MODES[(t.tg + 1) % TARGET_MODES.length]}.`);
}
function ability(t) {
  if (!t) return info(NO_TOWER, true);
  if (!mine(t)) return;
  const s = tStats(t);
  if (!s.ab) return info('Esta torre no tiene habilidad activa (se desbloquea en el nivel 4 de la rama 2).', true);
  if (t.ac > 0) return info(`${ABIL[s.ab].n}: recargando, ${Math.ceil(t.ac)} s.`, true);
  act({ t: 'abil', id: t.i });
  info(`¡${ABIL[s.ab].n}! — ${ABIL[s.ab].d}.`);
}
function cycleTower() {
  const list = G ? G.T.filter((t) => t.o === mySlot()).sort((a, b) => a.x - b.x || a.y - b.y) : [];
  if (!list.length) return;
  const i = list.findIndex((t) => t.i === selId);
  selId = list[(i + 1) % list.length].i;
  placing = null; movingId = null; selOb = -1;
}
const toggleKeys = () => $('keys').classList.toggle('hidden');

addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName !== 'INPUT' && net && !solo && (current() === 'lobby' || current() === 'game')) { e.preventDefault(); openChat(); return; }
  if (current() !== 'game' || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const playing = G && G.ph === 'play';
  if (k === 'Escape') { cancel(); $('keys').classList.add('hidden'); }
  else if (k === 'h') toggleKeys();
  else if (k === 'p') act({ t: 'pause' });
  else if (!playing) return;
  else if (G.cd) { if (k >= '1' && k <= '3') act({ t: 'card', i: +k - 1 }); }
  else if (k >= '1' && k <= '8') { if (shopKeys[+k - 1]) choose(shopKeys[+k - 1]); }
  else if (k === ' ') { e.preventDefault(); act({ t: 'next' }); }
  else if (k === 'a') act({ t: 'auto' });
  else if (k === 'f') act({ t: 'speed' });
  else if (k === 'u') upgrade(targetTower(), 0);
  else if (k === 'i') upgrade(targetTower(), 1);
  else if (k === 'o') upgrade(targetTower(), 2);
  else if (k === 't') cycleTarget(targetTower());
  else if (k === 'q') ability(targetTower());
  else if (k === 'x' || k === 'Delete' || k === 'Backspace') {
    e.preventDefault();
    const t = targetTower(), oi = targetOb();
    if (!t && oi >= 0) clearOb(oi); else sell(t);
  }
  else if (k === 'm') startMove(targetTower());
  else if (k === 'Tab') { e.preventDefault(); cycleTower(); }
});
$('btnPause').onclick = () => act({ t: 'pause' });
$('btnNext').onclick = () => act({ t: 'next' });
$('btnAuto').onclick = () => act({ t: 'auto' });
$('btnSpeed').onclick = () => act({ t: 'speed' });
$('btnKeys').onclick = toggleKeys;
$('btnChat').onclick = (e) => { e.currentTarget.blur(); openChat(); };
$('ovBtn').onclick = () => { if (G?.ph === 'play') act({ t: 'pause' }); else act({ t: 'restart' }); };
$('ovBtn2').onclick = () => {
  if (!isHost) return;
  if (solo) { clearInterval(simTimer); toLobby(); }
  else { S = null; net.publish(null); net.setMeta({ started: false }); }
};
$('cards').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) act({ t: 'card', i: +b.dataset.i });
});
$('abil').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b || !G) return;
  const t = G.T.find((q) => q.i === +b.dataset.id);
  if (t) { selId = t.i; selOb = -1; ability(t); }
});

// cursor propio -> red (máx. 10 veces/s)
setInterval(() => {
  if (!net || solo || !mouseDirty || current() !== 'game') return;
  mouseDirty = false;
  net.cursor({ x: Math.round(mouse.x), y: Math.round(mouse.y), b: movingId ? '' : placing || '' });
}, 100);

// ---------- panel de torre / obstáculo seleccionado ----------
const r0 = (n) => Math.round(n * 10) / 10;
function statLines(t, st) {
  const L = [], ai = TOWERS[t.k].ai;
  if (st.dmg) L.push(`Daño ${Math.round(st.dmg)} cada ${r0(st.rate)}s${st.targets > 1 ? ` ×${st.targets}` : ''}`);
  if (st.dps && ai === 'beam') L.push(`Rayo de ${Math.round(st.dps)} daño/s que sube hasta x${1 + st.rampMax}`);
  else if (st.dps) L.push(`${Math.round(st.dps)} daño/s · ${t.k === 'frost' ? 'congela' : 'atrapa'} ${r0(st.stun)}s cada ${st.cycle}s`);
  if (st.units) L.push(`${st.units} leonas · ${Math.round(st.uhp * G._m.thread)} vida · ${r0(st.udmg)} daño`);
  if (st.sdmg) L.push(`Lanza ${Math.round(st.sdmg)} cada ${r0(st.srate)}s`);
  if (st.buff) L.push(`Tambor +${Math.round(st.buff * 100)}% daño`);
  if (st.rateBuff) L.push(`+${Math.round(st.rateBuff * 100)}% cadencia`);
  if (st.hops) L.push(`${st.hops} saltos${st.chains > 1 ? ` ×${st.chains} rayos` : ''}`);
  if (st.burn) L.push(`Quema ${st.burn}/s`);
  if (st.income) L.push(`+${Math.round(st.income * G._m.tdm.backup)} de oro cada ${st.period}s`);
  if (st.heal) L.push(`+${st.heal} vidas/oleada`);
  if (st.steal) L.push(`Roba ${st.steal} de oro cada ${r0(st.stealCd)}s mientras ataca`);
  if (st.pctHp) L.push(`Quita un ${r0(st.pctHp * 100)}% de la vida máxima por golpe`);
  if (st.stack) L.push(`Remates: ${t.kc || 0} → +${Math.round(Math.min(st.stackMax, (t.kc || 0) * st.stack) * 100)}% de daño (máx. +${Math.round(st.stackMax * 100)}%)`);
  if (st.gbuff) L.push(`+${Math.round(st.gbuff * 100)}% de daño${st.grange ? ` y +${Math.round(st.grange * 100)}% de alcance` : ''} a TODAS las torres`);
  if (st.gslow) L.push(`Ralentiza un ${Math.round(st.gslow * 100)}% a todos los barriles`);
  if (st.revive) L.push((G.rvu >> t.o) & 1 ? 'Renacer: ya usado en esta partida' : `Renacer: salva la guarida con ${st.revive} vidas`);
  if (st.range >= 2000) L.push('Alcance: todo el mapa');
  else if (st.range) L.push(`Alcance ${Math.round(tRange(G, t))}`);
  const tags = [];
  if (st.detect || t._det || G._m.detect) tags.push('ve camuflados');
  if (st.pierce + (t._ap || 0) + G._m.pierce > 0 && t.k !== 'backup') tags.push(st.pierce >= 99 ? 'ignora blindaje' : `perfora ${st.pierce + (t._ap || 0) + G._m.pierce}`);
  if (st.airM) tags.push(`x${st.airM} a voladores`);
  if (st.knock) tags.push('empuja');
  if (st.wound) tags.push('impide repararse');
  if (t.lv > 1) tags.push(`nivel ${t.lv}: +${Math.round(prog.levelBonus(t.lv) * 1000) / 10}% daño y alcance`);
  if (G._gb) tags.push(`Rey León +${Math.round(G._gb * 100)}%`);
  if (t._pad) tags.push('tótem +30%');
  if (t._b) tags.push(`tambor +${Math.round(t._b * 100)}%`);
  return L.join(' · ') + (tags.length ? `<br><span class="tags">${tags.join(' · ')}</span>` : '');
}
const canTarget = (t, st) => ['firewall', 'gc', 'sniper', 'chain', 'beam'].includes(TOWERS[t.k].ai) || st.shoot;

function updatePanel() {
  const p = $('panel');
  const t = G && selId ? G.T.find((q) => q.i === selId) : null;
  if (!t) {
    if (selId && !placing) selId = null;
    if (G && selOb >= 0 && !G.ob[selOb]) {
      const M = MAPS[G.map], o = M.obs[selOb], can = myGold() >= o[2], pad = M.padAt.has(o[1] * COLS + o[0]);
      const sig = ['ob', selOb, can].join();
      if (sig === panelSig) return;
      panelSig = sig;
      p.classList.remove('hidden'); p.classList.toggle('left', o[0] > 16);
      p.innerHTML = `<h3 style="color:#ffe14a">Obstáculo</h3>
        <p>Ocupa un buen sitio. Quítalo para poder construir aquí.</p>
        ${pad ? '<p style="color:#ffe14a">Debajo hay un tótem de poder: la torre que pongas hará +30% de daño.</p>' : ''}
        <div class="btns"><button class="btn small wide" data-a="clear" ${can ? '' : 'disabled'}>Quitar · ${o[2]} de oro [X]</button></div>`;
      return;
    }
    selOb = -1;
    if (panelSig) { p.classList.add('hidden'); panelSig = ''; }
    return;
  }
  const d = TOWERS[t.k], st = tStats(t), own = t.o === mySlot(), gold = myGold();
  const rows = d.paths.map((P, i) => {
    const lock = lockReason(G, t, i), u = P.ups[t.p[i]], cost = u ? upgradeCost(G, t, i) : 0;
    return { P, i, lock, u, cost, can: !lock && gold >= cost };
  });
  const abCd = Math.ceil(Math.max(0, t.ac));
  const sig = [t.i, t.o, own, slotName(t.o), t.p.join(''), t.tg, t._disc, t._b, t._pad, G.md.length, t.kc, G.rvu, G._gb, rows.map((r) => r.can + r.lock).join(''), t.x > 16, t._rd < 0, abCd, t.at > 0].join();
  if (sig === panelSig) return;
  panelSig = sig;
  p.classList.remove('hidden');
  p.classList.toggle('left', t.x > 16);
  const sk = skin(t.k, t.p);
  const title = sk.tier ? d.paths[sk.dom].ups[sk.tier - 1].n : d.name;
  const tag = `<span class="owner" style="background:${PLAYER_COLORS[t.o] || '#ccc'}">${own ? 'Tuya' : 'De ' + esc(slotName(t.o))}</span>`;
  if (!own) {
    // torre de un compañero: solo se puede mirar
    p.innerHTML = `<h3 style="color:${sk.main}">${esc(title)} <small>${t.p.join('-')}</small></h3>
      <p class="sub">${d.name} <span class="rar" style="color:${RARITY[d.rar].c}">${RARITY[d.rar].n}</span> ${tag}</p>
      <p style="color:var(--text)">${statLines(t, st)}</p>
      ${rows.map((r) => `<div class="path" style="--pc:${r.P.color}"><div class="ptop"><b>${r.i + 1}. ${r.P.name}</b><span class="pips">${[0, 1, 2, 3, 4].map((j) => `<i class="${j < t.p[r.i] ? 'on' : ''}"></i>`).join('')}</span></div></div>`).join('')}
      <p>Solo ${esc(slotName(t.o))} puede mejorarla, venderla o moverla.</p>`;
    return;
  }
  p.innerHTML = `<h3 style="color:${sk.main}">${esc(title)} <small>${t.p.join('-')}</small></h3>
    <p class="sub">${d.name} <span class="rar" style="color:${RARITY[d.rar].c}">${RARITY[d.rar].n}</span> ${tag}${t._disc ? ` · <span style="color:var(--lime)">−${Math.round(t._disc * 100)}% en mejoras</span>` : ''}</p>
    <p style="color:var(--text)">${statLines(t, st)}</p>
    ${t.k === 'thread' && t._rd < 0 ? '<p style="color:var(--pink)">¡Demasiado lejos del camino! Muévelo.</p>' : ''}
    ${st.ab ? `<button class="btn small abil ${abCd ? '' : 'ready'}" data-a="abil" ${abCd ? 'disabled' : ''}>⚡ ${ABIL[st.ab].n} [Q] ${abCd ? `· ${abCd}s` : '· LISTA'}</button><small class="abd">${ABIL[st.ab].d}</small>` : ''}
    ${rows.map((r) => `
      <div class="path" style="--pc:${r.P.color}">
        <div class="ptop"><b>${r.i + 1}. ${r.P.name}</b><span class="pips">${[0, 1, 2, 3, 4].map((j) => `<i class="${j < t.p[r.i] ? 'on' : ''}"></i>`).join('')}</span></div>
        ${r.u && !r.lock
          ? `<button class="btn small up" data-a="up" data-p="${r.i}" ${r.can ? '' : 'disabled'}>[${PATH_KEYS[r.i]}] Nv.${t.p[r.i] + 1} ${esc(r.u.n)} · ${r.cost}</button><small>${esc(r.u.d)}</small>`
          : `<small class="lock">${r.lock}</small>`}
      </div>`).join('')}
    <div class="btns">
      ${canTarget(t, st) ? `<button class="btn small wide" data-a="tgt">Objetivo: ${TARGET_MODES[t.tg]} [T]</button>` : ''}
      <button class="btn small" data-a="move">Mover [M]</button>
      <button class="btn small danger" data-a="sell">Vender +${sellValue(t)} [X]</button>
    </div>`;
}
$('panel').addEventListener('click', (e) => {
  const a = e.target.dataset?.a;
  if (!a || !G) return;
  if (a === 'clear') { if (selOb >= 0) clearOb(selOb); return; }
  const t = G.T.find((q) => q.i === selId);
  if (!t) return;
  if (a === 'up') upgrade(t, +e.target.dataset.p);
  else if (a === 'sell') sell(t);
  else if (a === 'move') startMove(t);
  else if (a === 'tgt') cycleTarget(t);
  else if (a === 'abil') ability(t);
});

// ---------- HUD ----------
const cacheTxt = {};
function setTxt(id, v) { if (cacheTxt[id] !== v) { cacheTxt[id] = v; $(id).textContent = v; } }
let abilSig = '', cardSig = '';
function updateHud() {
  const M = MAPS[G.map];
  setTxt('hudMap', M.name);
  setTxt('hudWave', `${G.w}/${M.waves}`);
  const gold = myGold(), slot = mySlot();
  setTxt('hudCpu', String(Math.floor(gold)));
  updateChips();
  setTxt('hudLife', String(Math.max(0, G.life)));
  const lf = Math.max(0, Math.min(1, G.life / M.life));
  const bar = $('hudLifeBar');
  bar.style.width = lf * 100 + '%';
  bar.style.background = lf > 0.5 ? 'var(--cyan)' : lf > 0.25 ? 'var(--amber)' : 'var(--pink)';
  const waiting = G.ph === 'play' && G.ic > 0 && !G.cd;
  $('btnNext').disabled = !waiting || !!G.pa;
  setTxt('hudNext', waiting ? `+${Math.round(skipBonus(G.w, G.ic) * G._m.wave)} · ${Math.ceil(G.ic)}s` : '');
  setTxt('btnAuto', G.au ? 'Auto [A]: ON' : 'Auto [A]: OFF');
  $('btnAuto').classList.toggle('on', !!G.au);
  setTxt('btnSpeed', `Vel. x${G.sp} [F]`);
  $('btnSpeed').classList.toggle('on', G.sp > 1);
  buildShop();
  for (const k of shopKeys) {
    const s = shopBtns[k], c = buildCost(G, k), full = !underLimit(G, k, slot);
    const label = full ? 'MÁX.' : c + ' oro';
    if (s.last !== label) { s.last = label; s.cost.textContent = label; }
    s.b.classList.toggle('poor', full || gold < c);
    s.b.classList.toggle('sel', placing === k && !movingId);
  }
  // barra de información
  const live = now() < msgUntil, text = live ? msg : hoverText() || idleText();
  if (cacheTxt.info !== text) { cacheTxt.info = text; $('info').textContent = text; }
  $('info').classList.toggle('warn', live && msgWarn);

  // barra de habilidades activas
  const ab = G.T.filter((t) => t.o === slot && tStats(t).ab);
  const sig = ab.map((t) => t.i + ':' + Math.ceil(Math.max(0, t.ac)) + (t.at > 0 ? 'a' : '')).join();
  if (sig !== abilSig) {
    abilSig = sig;
    $('abil').innerHTML = ab.map((t) => {
      const s = tStats(t), cd = Math.ceil(Math.max(0, t.ac));
      return `<button class="btn small ${cd ? '' : 'ready'}" data-id="${t.i}" style="--pc:${skin(t.k, t.p).accent}" title="${ABIL[s.ab].d}">⚡ ${ABIL[s.ab].n}${cd ? ` ${cd}s` : ''}</button>`;
    }).join('');
  }

  // parches (cartas)
  const cs = G.ph === 'play' && G.cd ? G.cd.join() : '';
  if (cs !== cardSig) {
    cardSig = cs;
    $('cards').classList.toggle('hidden', !cs);
    if (cs) {
      $('cardList').innerHTML = G.cd.map((id, i) => `<button class="cardb" data-i="${i}"><span class="num">${i + 1}</span><b>${esc(CARDS[id].n)}</b><p>${esc(CARDS[id].d)}</p></button>`).join('');
      $('cardSub').textContent = G.w === 0 ? 'Antes de empezar: elegid 1 de 3 (clic o teclas 1-3)' : `¡Tonel gigante destruido! Elegid 1 de 3 (clic o teclas 1-3) · reliquias activas: ${G.md.length}`;
    }
  }

  // capas de pausa / fin
  const ov = $('overlay');
  const state = G.ph !== 'play' ? G.ph : G.pa ? 'pause' : '';
  if (ov.dataset.state !== state + G.pb) {
    ov.dataset.state = state + G.pb;
    ov.className = 'overlay ' + (state || 'hidden');
    $('ovBtn2').classList.toggle('hidden', state === 'pause' || !isHost);
    $('ovScore').classList.toggle('hidden', state !== 'won' && state !== 'lost');
    $('ovFil').classList.toggle('hidden', state !== 'won' && state !== 'lost');
    if (state === 'won' || state === 'lost') { $('ovScore').innerHTML = scoreTable(); recordResult(); }
    if (state === 'pause') { $('ovTitle').textContent = 'PAUSA'; $('ovSub').textContent = `Pausado por ${G.pb || '?'} — cualquiera puede reanudar`; $('ovBtn').textContent = 'Reanudar'; }
    if (state === 'won') { $('ovTitle').textContent = '¡VICTORIA!'; $('ovSub').textContent = `La manada ha defendido ${M.name} durante ${M.waves} oleadas y le quedan ${G.life} vidas. ¡Buen trabajo!`; $('ovBtn').textContent = 'Jugar otra vez'; }
    if (state === 'lost') { $('ovTitle').textContent = 'LA GUARIDA HA CAÍDO'; $('ovSub').textContent = `Los barriles arrasaron ${M.name} en la oleada ${G.w} de ${M.waves}.`; $('ovBtn').textContent = 'Reintentar'; }
  }
}

/** Marcador de fin de partida: daño y oro ganado de cada jugador. */
function scoreTable() {
  const total = G.act.reduce((a, x) => a + G.st[x][0], 0) || 1;
  return '<tr><th>Jugador</th><th>Daño</th><th>% del daño</th><th>Oro ganado</th></tr>' + [...G.act].sort((a, b) => G.st[b][0] - G.st[a][0]).map((x) =>
    `<tr><td style="color:${PLAYER_COLORS[x]}">${esc(slotName(x))}${x === mySlot() ? ' (tú)' : ''}</td><td class="n">${fmt(G.st[x][0])}</td><td class="n">${Math.round((G.st[x][0] / total) * 100)}%</td><td class="n">${fmt(G.st[x][1])}</td></tr>`).join('');
}
/** Guarda el resultado en mi cuenta (una sola vez por partida). */
let savedGid = '';
function recordResult() {
  const x = mySlot(), won = G.ph === 'won', gain = prog.reward(G.map, G.w, won);
  $('ovFil').innerHTML = !me || !G.act.includes(x) ? '' : gain ? `<i class="steak"></i> +${gain} filetes${won ? '' : ' (ganando te llevas más)'}` : 'Aguanta al menos una oleada para ganar filetes.';
  if (!me || !G.gid || savedGid === G.gid || !G.act.includes(x)) return;
  savedGid = G.gid;
  if (me.profile.lastGid === G.gid) return; // ya estaba guardada (por ejemplo, tras recargar la página)
  const st = me.profile.st;
  me.profile.inv.fil += gain;
  const next = {
    ...st, games: st.games + 1, wins: st.wins + (won ? 1 : 0), kills: st.kills + G.kills, dmg: st.dmg + G.st[x][0], gold: st.gold + G.st[x][1],
    best: { ...st.best, [G.map]: Math.max(st.best?.[G.map] || 0, G.w) },
    mapWins: { ...st.mapWins, [G.map]: (st.mapWins?.[G.map] || 0) + (won ? 1 : 0) },
  };
  account.save({ st: next, lastGid: G.gid, inv: me.profile.inv }).then(renderHome).catch((err) => { console.error(err); info('No se ha podido guardar el resultado en tu cuenta.', true); });
}

// ---------- bucle de dibujo ----------
function frame() {
  requestAnimationFrame(frame);
  if (current() !== 'game' || !G) return;
  const t = now();
  // cursores de los demás, suavizados
  const list = [];
  for (const [pid, c] of Object.entries(cursors)) {
    if (!net || pid === net.pid || !players[pid]) continue;
    const v = (curView[pid] ||= { x: c.x, y: c.y });
    v.x += (c.x - v.x) * 0.3; v.y += (c.y - v.y) * 0.3;
    list.push({ x: v.x, y: v.y, b: c.b, name: players[pid].name, color: PLAYER_COLORS[players[pid].slot % 4] });
  }
  const mv = movingId ? G.T.find((q) => q.i === movingId) : null;
  if (movingId && !mv) { movingId = null; placing = null; }
  render(ctx, G, {
    time: t,
    prev: isHost ? null : prevMap,
    alpha: Math.min(1, (performance.now() - snapAt) / PUBLISH_MS),
    hover, placing, placingP: mv ? mv.p : null, movingId, selId, selOb,
    valid: !!(placing && hover && cellFree(G, hover.cx, hover.cy, movingId || undefined) && (movingId || (underLimit(G, placing, mySlot()) && myGold() >= buildCost(G, placing)))),
    cursors: list,
  });
  updateHud();
  updatePanel();
}
requestAnimationFrame(frame);

// acceso para pruebas automáticas
window.__cd = { prog, get G() { return G; }, get isHost() { return isHost; }, get net() { return net; }, get me() { return me; }, get slot() { return mySlot(); }, act };
