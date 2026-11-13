// ============================================================
//  Code Defenders — interfaz, entrada del jugador y pegamento con la red
//
//  Modelo de red: el navegador del ANFITRIÓN ejecuta la simulación y publica
//  instantáneas; los demás envían acciones y dibujan lo que reciben.
//  Si el anfitrión se va, el jugador más antiguo de la sala hereda el puesto.
// ============================================================
import { W, H, CELL, COLS, MAPS, PLAYER_COLORS, TOWERS, TOWER_KEYS, ENEMIES, CARDS, ABIL, skin, skipBonus, waveSummary } from './data.js';
import {
  newGame, step, settle, applyAction, pack, unpack, STEP, TARGET_MODES,
  cellFree, underLimit, towerAt, buildCost, upgradeCost, lockReason, sellValue, tStats, tRange,
} from './sim.js';
import { render, addFx, clearFx, drawTower, drawMapThumb } from './render.js';
import { isConfigured } from './net.js';

const $ = (id) => document.getElementById(id);
const now = () => performance.now() / 1000;
const MOCK = new URLSearchParams(location.search).has('mock');
const PUBLISH_MS = 150;

// ---------- estado ----------
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

const cv = $('cv'), ctx = cv.getContext('2d');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- pantallas ----------
function show(name) {
  for (const s of ['menu', 'lobby', 'game']) $(s).classList.toggle('hidden', s !== name);
  $('chat').classList.toggle('hidden', solo || !net || name === 'menu');
  $('chat').classList.toggle('lobby', name === 'lobby');
  $('btnChat').classList.toggle('hidden', solo || !net);
}
const current = () => ['menu', 'lobby', 'game'].find((s) => !$(s).classList.contains('hidden'));

// ---------- menú ----------
$('inName').value = localStorage.getItem('cd_name') || '';
if (!isConfigured() && !MOCK) {
  $('btnCreate').disabled = $('btnJoin').disabled = true;
  $('menuMsg').textContent = 'Multijugador desactivado: falta pegar la configuración de Firebase en js/firebase-config.js';
}
function readName() {
  myName = ($('inName').value.trim() || 'dev_' + Math.floor(Math.random() * 90 + 10)).slice(0, 12);
  localStorage.setItem('cd_name', myName);
}
async function getNet() {
  if (net) return net;
  const mod = MOCK ? await import('./net-mock.js') : await import('./net.js');
  net = await mod.connect();
  return net;
}
async function enterRoom(fn) {
  readName();
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
$('btnCreate').onclick = () => enterRoom(() => net.create(myName));
$('btnJoin').onclick = () => {
  const code = $('inCode').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { $('menuMsg').textContent = 'El código son 4 letras.'; return; }
  enterRoom(() => net.join(code, myName));
};
$('inCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnSolo').onclick = () => {
  readName();
  solo = true; isHost = true;
  players = { me: { name: myName, slot: 0 } };
  $('lobbyCode').textContent = $('hudCode').textContent = 'SOLO';
  updateLobby(); updateChips(); show('lobby');
};
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
  net.on('players', (p) => { players = p || {}; playersChanged(); evalHost(); updateLobby(); updateChips(); });
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
  txt.innerHTML = `<b style="color:${M.theme.a}">${i + 1}. ${M.name}</b> <span class="diff d${i}">${M.diff}</span><small>${M.tag} · ${M.waves} oleadas · ${M.life} de vida</small><p>${M.desc}</p>`;
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
function updateLobby() {
  const list = sortedPlayers(), myId = net ? net.pid : 'me';
  let html = '';
  for (let i = 0; i < (solo ? 1 : 4); i++) {
    const p = list[i];
    html += p
      ? `<li style="border-color:${PLAYER_COLORS[p[1].slot % 4]};color:${PLAYER_COLORS[p[1].slot % 4]}">${esc(p[1].name)}${p[0] === meta?.host ? ' ★' : ''}${p[0] === myId ? ' (tú)' : ''}</li>`
      : '<li class="empty">esperando…</li>';
  }
  $('lobbyPlayers').innerHTML = html;
  $('btnStart').classList.toggle('hidden', !isHost);
  mapBtns.forEach((b, i) => { b.classList.toggle('sel', i === selMap); b.disabled = !isHost; });
  $('lobbyMsg').textContent = solo ? 'Práctica en solitario: elige mapa y empieza.'
    : isHost ? `${list.length}/4 jugadores. Elige el mapa y empieza cuando quieras.` : 'Esperando a que el anfitrión (★) elija mapa y empiece…';
}
function updateChips() {
  $('hudPlayers').innerHTML = sortedPlayers()
    .map(([, p]) => `<span class="chip" style="border-color:${PLAYER_COLORS[p.slot % 4]};color:${PLAYER_COLORS[p.slot % 4]}">${esc(p.name)}</span>`).join('');
}
$('btnStart').onclick = () => {
  if (!isHost) return;
  clearFx();
  S = G = newGame(selMap); dirty = true;
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
  const me = players[net.pid];
  net.chat(myName, me ? me.slot : 0, m.slice(0, 120));
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
    if (!S) S = lastSnapStr ? unpack(lastSnapStr).S : newGame(selMap);
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
function startSim() {
  clearInterval(simTimer);
  lastTick = performance.now(); acc = 0;
  simTimer = setInterval(tick, 33);
}
function tick() {
  const t = performance.now(), dt = (t - lastTick) / 1000;
  lastTick = t;
  if (!S) return;
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
  if (dirty || t - lastPub >= every) {
    if (outFx.length > 60) { const cut = outFx.length - 24; outFx = outFx.filter((f, i) => f[0] !== 'b' || i >= cut).slice(-70); }
    net.publish(pack(S, outFx));
    outFx = []; lastPub = t; dirty = false;
  }
}

/** Envía una acción: el anfitrión la aplica directamente, el resto la manda por la red. */
function act(a) {
  a.n = myName;
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
  if (t) return `${TOWERS[t.k].name} ${t.p.join('-')}: U/I/O mejorar rama · T objetivo · Q habilidad · M mover · X vender`;
  const oi = M.obsAt.get(key);
  if (oi !== undefined && !G.ob[oi]) return `Código legacy: estorba. Haz clic y elimínalo por ${M.obs[oi][2]} CPU (o pulsa X).` + (M.padAt.has(key) ? ' Debajo hay un rack de GPU (+30% de daño).' : '');
  if (M.padAt.has(key)) return 'Rack de GPU: la torre que construyas aquí hace +30% de daño.';
  const ti = M.trapAt.get(key);
  if (ti !== undefined) {
    return M.traps[ti].t === 'bomb'
      ? 'Bomba lógica: haz clic para detonarla. Daño explosivo en área, aturde y prende a los enemigos enredados. Recarga 50 s.'
      : 'Ventana de mantenimiento: haz clic para cerrar el paso 4 s (los enemigos se amontonan). Recarga 45 s.';
  }
  if (M.swAt.has(key)) return 'Router: haz clic para desviar el tráfico por la otra rama. Recarga 8 s.';
  const z = M.zoneAt.get(key);
  if (z === 'heat') return 'Sobrecalentamiento: quema a los enemigos que pasan (más cuanto más lentos vayan) y hace explotar a los enredados.';
  if (z === 'cool') return 'Fuga de refrigerante: deja REFRIGERADOS a los enemigos. El Load Balancer les hace Cortocircuito.';
  return '';
}
function idleText() {
  if (G.cd) return 'Elegid un parche: cualquiera del equipo puede escoger.';
  if (G.ph === 'play' && G.ic > 0) return previewText();
  return 'U/I/O mejorar rama · T objetivo · Q habilidad · X vender · M mover · F velocidad · Espacio saltar · H ayuda';
}

// ---------- tienda ----------
const shopBtns = {};
for (const [i, k] of TOWER_KEYS.entries()) {
  const d = TOWERS[k], b = document.createElement('button');
  b.className = 'item';
  const ic = document.createElement('canvas'); ic.width = ic.height = 44;
  drawTower(ic.getContext('2d'), k, 22, 20, null, -0.6, 0.4, false);
  const txt = document.createElement('div');
  txt.innerHTML = `<b style="color:${d.color}">${d.name}</b><span class="cost"></span> <span class="key">[${i + 1}]</span>`;
  b.append(ic, txt);
  b.onclick = () => choose(k);
  b.onmouseenter = () => info(`${d.name}: ${d.desc}`);
  $('shop').append(b);
  shopBtns[k] = { b, cost: txt.querySelector('.cost'), last: -1 };
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
    if (hasOb) return info('Ahí hay código legacy: elimínalo primero (clic sobre él sin torre elegida, o X).', true);
    if (movingId) {
      if (!cellFree(G, cx, cy, movingId)) return info('Ahí no se puede colocar.', true);
      act({ t: 'move', id: movingId, cx, cy });
      selId = movingId; placing = null; movingId = null;
    } else {
      if (!underLimit(G, placing)) return info(`Máximo ${TOWERS[placing].max} ${TOWERS[placing].name} por partida.`, true);
      if (!cellFree(G, cx, cy)) return info('Ahí no se puede construir (ruta, servidor, estructura u ocupado).', true);
      if (G.money < buildCost(G, placing)) return info('CPU insuficiente.', true);
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
    return info(M.traps[ti].t === 'bomb' ? '¡Bomba lógica detonada!' : 'Ventana de mantenimiento: paso cerrado 4 s.');
  }
  const si = M.swAt.get(key);
  if (si !== undefined) {
    if (G.swc > 0) return info(`El router se está reconfigurando: ${Math.ceil(G.swc)} s.`, true);
    act({ t: 'sw', i: si });
    info('Router conmutado: el tráfico nuevo irá por la otra rama.');
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
const PATH_KEYS = ['U', 'I', 'O'];
function upgrade(t, i) {
  if (!t) return info(NO_TOWER, true);
  const P = TOWERS[t.k].paths[i], lock = lockReason(G, t, i);
  if (lock) return info(`${P.name}: ${lock}.`, true);
  const cost = upgradeCost(G, t, i), u = P.ups[t.p[i]];
  if (G.money < cost) return info(`CPU insuficiente: "${u.n}" cuesta ${cost}.`, true);
  act({ t: 'up', id: t.i, p: i });
  info(`${TOWERS[t.k].name} → ${u.n} (Tier ${t.p[i] + 1}): ${u.d}`);
}
function sell(t) {
  if (!t) return info(NO_TOWER, true);
  act({ t: 'sell', id: t.i });
  info(`${TOWERS[t.k].name} vendida (+${sellValue(t)} CPU).`);
  if (selId === t.i) selId = null;
}
function clearOb(i) {
  const o = MAPS[G.map].obs[i];
  if (G.money < o[2]) return info(`CPU insuficiente: eliminar el código legacy cuesta ${o[2]}.`, true);
  act({ t: 'clear', i });
  info('Código legacy eliminado: ya se puede construir ahí.');
  selOb = -1;
}
function startMove(t) {
  if (!t) return info(NO_TOWER, true);
  selId = t.i; placing = t.k; movingId = t.i;
  info('Haz clic en la nueva posición (la torre tarda 3 s en reiniciarse). Esc cancela.');
}
function cycleTarget(t) {
  if (!t) return info(NO_TOWER, true);
  act({ t: 'tgt', id: t.i });
  info(`${TOWERS[t.k].name}: objetivo → ${TARGET_MODES[(t.tg + 1) % TARGET_MODES.length]}.`);
}
function ability(t) {
  if (!t) return info(NO_TOWER, true);
  const s = tStats(t);
  if (!s.ab) return info('Esta torre no tiene habilidad activa (se desbloquea en el Tier 4 de la rama 2).', true);
  if (t.ac > 0) return info(`${ABIL[s.ab].n}: recargando, ${Math.ceil(t.ac)} s.`, true);
  act({ t: 'abil', id: t.i });
  info(`¡${ABIL[s.ab].n}! — ${ABIL[s.ab].d}.`);
}
function cycleTower() {
  if (!G || !G.T.length) return;
  const list = [...G.T].sort((a, b) => a.x - b.x || a.y - b.y);
  const i = list.findIndex((t) => t.i === selId);
  selId = list[(i + 1) % list.length].i;
  placing = null; movingId = null; selOb = -1;
}
const toggleKeys = () => $('keys').classList.toggle('hidden');

addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName !== 'INPUT' && net && !solo && current() !== 'menu') { e.preventDefault(); openChat(); return; }
  if (current() !== 'game' || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const playing = G && G.ph === 'play';
  if (k === 'Escape') { cancel(); $('keys').classList.add('hidden'); }
  else if (k === 'h') toggleKeys();
  else if (k === 'p') act({ t: 'pause' });
  else if (!playing) return;
  else if (G.cd) { if (k >= '1' && k <= '3') act({ t: 'card', i: +k - 1 }); }
  else if (k >= '1' && k <= '8') choose(TOWER_KEYS[+k - 1]);
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
  const L = [];
  if (st.dmg) L.push(`Daño ${Math.round(st.dmg)} cada ${r0(st.rate)}s${st.targets > 1 ? ` ×${st.targets}` : ''}`);
  if (st.dps) L.push(`${Math.round(st.dps)} daño/s · congela ${r0(st.stun)}s cada ${st.cycle}s`);
  if (st.units) L.push(`${st.units} threads · ${Math.round(st.uhp)} vida · ${r0(st.udmg)} daño`);
  if (st.sdmg) L.push(`Disparo ${Math.round(st.sdmg)} cada ${r0(st.srate)}s`);
  if (st.buff) L.push(`Aura +${Math.round(st.buff * 100)}% daño`);
  if (st.rateBuff) L.push(`+${Math.round(st.rateBuff * 100)}% cadencia`);
  if (st.hops) L.push(`${st.hops} rebotes${st.chains > 1 ? ` ×${st.chains} cadenas` : ''}`);
  if (st.burn) L.push(`Quema ${st.burn}/s`);
  if (st.income) L.push(`+${Math.round(st.income * G._m.tdm.backup)} CPU cada ${st.period}s`);
  if (st.heal) L.push(`+${st.heal} vida/oleada`);
  if (t.k !== 'backup') L.push(`Alcance ${Math.round(tRange(G, t))}`);
  const tags = [];
  if (st.detect || t._det || G._m.detect) tags.push('ve ofuscados');
  if (st.pierce + (t._ap || 0) + G._m.pierce > 0 && t.k !== 'backup') tags.push(st.pierce >= 99 ? 'ignora blindaje' : `perfora ${st.pierce + (t._ap || 0) + G._m.pierce}`);
  if (t._pad) tags.push('rack GPU +30%');
  if (t._b) tags.push(`Linter +${Math.round(t._b * 100)}%`);
  return L.join(' · ') + (tags.length ? `<br><span class="tags">${tags.join(' · ')}</span>` : '');
}
const canTarget = (t, st) => ['firewall', 'gc', 'debugger', 'balancer'].includes(t.k) || st.shoot;

function updatePanel() {
  const p = $('panel');
  const t = G && selId ? G.T.find((q) => q.i === selId) : null;
  if (!t) {
    if (selId && !placing) selId = null;
    if (G && selOb >= 0 && !G.ob[selOb]) {
      const M = MAPS[G.map], o = M.obs[selOb], can = G.money >= o[2], pad = M.padAt.has(o[1] * COLS + o[0]);
      const sig = ['ob', selOb, can].join();
      if (sig === panelSig) return;
      panelSig = sig;
      p.classList.remove('hidden'); p.classList.toggle('left', o[0] > 16);
      p.innerHTML = `<h3 style="color:#9aa7ff">Código legacy</h3>
        <p>Nadie sabe qué hace, pero ocupa un buen sitio. Elimínalo para poder construir aquí.</p>
        ${pad ? '<p style="color:#ffe66b">Debajo hay un rack de GPU: la torre que pongas hará +30% de daño.</p>' : ''}
        <div class="btns"><button class="btn small" data-a="clear" ${can ? '' : 'disabled'}>Eliminar · ${o[2]} CPU [X]</button></div>`;
      return;
    }
    selOb = -1;
    if (panelSig) { p.classList.add('hidden'); panelSig = ''; }
    return;
  }
  const d = TOWERS[t.k], st = tStats(t);
  const rows = d.paths.map((P, i) => {
    const lock = lockReason(G, t, i), u = P.ups[t.p[i]], cost = u ? upgradeCost(G, t, i) : 0;
    return { P, i, lock, u, cost, can: !lock && G.money >= cost };
  });
  const abCd = Math.ceil(Math.max(0, t.ac));
  const sig = [t.i, t.p.join(''), t.tg, t._disc, t._b, t._pad, G.md.length, rows.map((r) => r.can + r.lock).join(''), t.x > 16, t._rd < 0, abCd, t.at > 0].join();
  if (sig === panelSig) return;
  panelSig = sig;
  p.classList.remove('hidden');
  p.classList.toggle('left', t.x > 16);
  const sk = skin(t.k, t.p);
  const title = sk.tier ? d.paths[sk.dom].ups[sk.tier - 1].n : d.name;
  p.innerHTML = `<h3 style="color:${sk.main}">${esc(title)} <small>${t.p.join('-')}</small></h3>
    <p class="sub">${d.name}${t._disc ? ` · <span style="color:var(--lime)">−${Math.round(t._disc * 100)}% en mejoras</span>` : ''}</p>
    <p style="color:var(--text)">${statLines(t, st)}</p>
    ${t.k === 'thread' && t._rd < 0 ? '<p style="color:var(--pink)">¡Demasiado lejos de la ruta! Muévela.</p>' : ''}
    ${st.ab ? `<button class="btn small abil ${abCd ? '' : 'ready'}" data-a="abil" ${abCd ? 'disabled' : ''}>⚡ ${ABIL[st.ab].n} [Q] ${abCd ? `· ${abCd}s` : '· LISTA'}</button><small class="abd">${ABIL[st.ab].d}</small>` : ''}
    ${rows.map((r) => `
      <div class="path" style="--pc:${r.P.color}">
        <div class="ptop"><b>${r.i + 1}. ${r.P.name}</b><span class="pips">${[0, 1, 2, 3, 4].map((j) => `<i class="${j < t.p[r.i] ? 'on' : ''}"></i>`).join('')}</span></div>
        ${r.u && !r.lock
          ? `<button class="btn small up" data-a="up" data-p="${r.i}" ${r.can ? '' : 'disabled'}>[${PATH_KEYS[r.i]}] T${t.p[r.i] + 1} ${esc(r.u.n)} · ${r.cost}</button><small>${esc(r.u.d)}</small>`
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
  setTxt('hudCpu', String(Math.floor(G.money)));
  setTxt('hudLife', String(Math.max(0, G.life)));
  const lf = Math.max(0, Math.min(1, G.life / M.life));
  const bar = $('hudLifeBar');
  bar.style.width = lf * 100 + '%';
  bar.style.background = lf > 0.5 ? 'var(--cyan)' : lf > 0.25 ? 'var(--amber)' : 'var(--pink)';
  const waiting = G.ph === 'play' && G.ic > 0 && !G.cd;
  $('btnNext').disabled = !waiting || !!G.pa;
  setTxt('hudNext', waiting ? `+${Math.round(skipBonus(G.w, G.ic) * G._m.wave)} CPU · ${Math.ceil(G.ic)}s` : '');
  setTxt('btnAuto', G.au ? 'Auto [A]: ON' : 'Auto [A]: OFF');
  $('btnAuto').classList.toggle('on', !!G.au);
  setTxt('btnSpeed', `Velocidad x${G.sp} [F]`);
  $('btnSpeed').classList.toggle('on', G.sp > 1);
  for (const k of TOWER_KEYS) {
    const s = shopBtns[k], c = buildCost(G, k), full = !underLimit(G, k);
    const label = full ? 'MÁX.' : c + ' CPU';
    if (s.last !== label) { s.last = label; s.cost.textContent = label; }
    s.b.classList.toggle('poor', full || G.money < c);
    s.b.classList.toggle('sel', placing === k && !movingId);
  }
  // barra de información
  const live = now() < msgUntil, text = live ? msg : hoverText() || idleText();
  if (cacheTxt.info !== text) { cacheTxt.info = text; $('info').textContent = text; }
  $('info').classList.toggle('warn', live && msgWarn);

  // barra de habilidades activas
  const ab = G.T.filter((t) => tStats(t).ab);
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
      $('cardSub').textContent = G.w === 0 ? 'Antes de empezar: elegid 1 de 3 (clic o teclas 1-3)' : `Jefe superado. Elegid 1 de 3 (clic o teclas 1-3) · parches activos: ${G.md.length}`;
    }
  }

  // capas de pausa / fin
  const ov = $('overlay');
  const state = G.ph !== 'play' ? G.ph : G.pa ? 'pause' : '';
  if (ov.dataset.state !== state + G.pb) {
    ov.dataset.state = state + G.pb;
    ov.className = 'overlay ' + (state || 'hidden');
    $('ovBtn2').classList.toggle('hidden', state === 'pause' || !isHost);
    if (state === 'pause') { $('ovTitle').textContent = '⏸ PAUSA'; $('ovSub').textContent = `Pausado por ${G.pb || '?'} — cualquiera puede reanudar`; $('ovBtn').textContent = 'Reanudar'; }
    if (state === 'won') { $('ovTitle').textContent = 'RELEASE COMPLETADA'; $('ovSub').textContent = `${M.name} ha sobrevivido a las ${M.waves} oleadas con ${G.life} de vida. Buen trabajo, equipo.`; $('ovBtn').textContent = 'Jugar otra vez'; }
    if (state === 'lost') { $('ovTitle').textContent = 'SERVIDOR CAÍDO'; $('ovSub').textContent = `${M.name} cayó en la oleada ${G.w} de ${M.waves}. Toca hacer rollback.`; $('ovBtn').textContent = 'Reintentar'; }
  }
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
    valid: !!(placing && hover && cellFree(G, hover.cx, hover.cy, movingId || undefined) && (movingId || (underLimit(G, placing) && G.money >= buildCost(G, placing)))),
    cursors: list,
  });
  updateHud();
  updatePanel();
}
requestAnimationFrame(frame);

// acceso para pruebas automáticas
window.__cd = { get G() { return G; }, get isHost() { return isHost; }, get net() { return net; }, act };
