// ============================================================
//  Code Defenders — interfaz, entrada del jugador y pegamento con la red
//
//  Modelo de red: el navegador del ANFITRIÓN ejecuta la simulación y publica
//  instantáneas; los demás envían acciones y dibujan lo que reciben.
//  Si el anfitrión se va, el jugador más antiguo de la sala hereda el puesto.
// ============================================================
import { W, H, CELL, MAX_WAVE, START_LIFE, PLAYER_COLORS, TOWERS, TOWER_KEYS, MAX_TIER, pathLock, skin } from './data.js';
import { newGame, step, applyAction, pack, unpack, STEP, cellFree, towerAt, buildCost, upgradeCost, sellValue, tStats, tRange } from './sim.js';
import { render, addFx, drawTower } from './render.js';
import { isConfigured } from './net.js';

const $ = (id) => document.getElementById(id);
const now = () => performance.now() / 1000;
const MOCK = new URLSearchParams(location.search).has('mock');
const PUBLISH_MS = 140;

// ---------- estado ----------
let net = null, solo = false, myName = '';
let meta = null, players = {};
let S = null;            // estado autoritativo (solo anfitrión)
let G = null;            // estado que se dibuja (anfitrión: S; cliente: última instantánea)
let prevMap = null, snapAt = 0, lastSnapStr = null;
let isHost = false, stopActions = null, simTimer = null, acc = 0, lastTick = 0, outFx = [], lastPub = 0, dirty = false;
let placing = null, movingId = null, selId = null, hover = null;
let mouse = { x: -100, y: -100 }, mouseDirty = false, cursors = {};
const curView = {};
let infoTimer = 0, panelSig = '';

const cv = $('cv'), ctx = cv.getContext('2d');

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
  $('hudCode').textContent = 'SOLO';
  S = G = newGame();
  startSim(); updateChips(); show('game');
};
$('btnLeave').onclick = () => { net?.leave(); location.reload(); };
addEventListener('pagehide', () => net?.leave());

// ---------- sala ----------
function subscribe() {
  net.on('meta', (m) => { meta = m; evalHost(); updateLobby(); if (m?.started && current() !== 'game') show('game'); });
  net.on('players', (p) => { players = p || {}; playersChanged(); evalHost(); updateLobby(); updateChips(); });
  net.on('s', (str) => {
    if (!str) return;
    lastSnapStr = str;
    if (isHost) return;
    const u = unpack(str);
    prevMap = G ? new Map(G.E.map((e) => [e.i, e.d])) : null;
    G = u.S; snapAt = performance.now();
    addFx(u.fx, now());
  });
  net.on('c', (c) => { cursors = c || {}; });
  net.onChat(addChat);
}

// ---------- chat ----------
const chatLog = $('chatLog'), chatIn = $('chatIn');
let lastChat = -1e9, knownPlayers = null;
function addChat(msg) {
  if (!msg || !msg.m) return;
  const div = document.createElement('div');
  if (msg.sys) { div.className = 'sys'; div.textContent = msg.m; }
  else {
    const b = document.createElement('b');
    b.style.color = PLAYER_COLORS[(msg.s | 0) % 4];
    b.textContent = String(msg.n || '?').slice(0, 12) + ':';
    div.append(b, document.createTextNode(String(msg.m).slice(0, 120)));
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
  const now = new Set(Object.keys(players));
  if (knownPlayers) {
    for (const id of now) if (!knownPlayers.has(id) && id !== net.pid) addChat({ sys: 1, m: `${players[id].name} se ha unido.` });
    for (const id of knownPlayers) if (!now.has(id) && knownNames[id]) addChat({ sys: 1, m: `${knownNames[id]} ha salido.` });
  }
  knownPlayers = now;
  for (const id of now) knownNames[id] = players[id].name;
}
const knownNames = {};
function sortedPlayers() {
  return Object.entries(players).sort((a, b) => (a[1].slot ?? 9) - (b[1].slot ?? 9));
}
function updateLobby() {
  const list = sortedPlayers();
  let html = '';
  for (let i = 0; i < 4; i++) {
    const p = list[i];
    html += p
      ? `<li style="border-color:${PLAYER_COLORS[p[1].slot % 4]};color:${PLAYER_COLORS[p[1].slot % 4]}">${esc(p[1].name)}${p[0] === meta?.host ? ' ★' : ''}${p[0] === net.pid ? ' (tú)' : ''}</li>`
      : '<li class="empty">esperando…</li>';
  }
  $('lobbyPlayers').innerHTML = html;
  $('btnStart').classList.toggle('hidden', !isHost);
  $('lobbyMsg').textContent = isHost ? `${list.length}/4 jugadores. Puedes empezar cuando quieras.` : 'Esperando a que el anfitrión (★) empiece la partida…';
}
function updateChips() {
  $('hudPlayers').innerHTML = sortedPlayers()
    .map(([, p]) => `<span class="chip" style="border-color:${PLAYER_COLORS[p.slot % 4]};color:${PLAYER_COLORS[p.slot % 4]}">${esc(p.name)}</span>`).join('');
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

$('btnStart').onclick = () => {
  if (!isHost) return;
  S = G = newGame(); dirty = true;
  net.setMeta({ started: true });
};

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
    if (!S) S = lastSnapStr ? unpack(lastSnapStr).S : newGame();
    G = S; prevMap = null; dirty = true;
  }
  stopActions = net.onAction((a) => { if (S && applyAction(S, a)) dirty = true; });
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
  if (S.ph !== 'play' || S.pa) acc = 0;
  else {
    acc = Math.min(acc + dt, 2); // si la pestaña estuvo en segundo plano, recupera hasta 2 s
    while (acc >= STEP) { step(S, STEP); acc -= STEP; }
  }
  if (S._fx.length) { addFx(S._fx, now()); outFx.push(...S._fx); S._fx.length = 0; }
  if (solo || !net) { outFx.length = 0; return; }
  const every = S.ph === 'play' && !S.pa ? PUBLISH_MS : 2000;
  if (dirty || t - lastPub >= every) {
    if (outFx.length > 80) outFx.splice(0, outFx.length - 80);
    net.publish(pack(S, outFx));
    outFx = []; lastPub = t; dirty = false;
  }
}

/** Envía una acción: el anfitrión la aplica directamente, el resto la manda por la red. */
function act(a) {
  a.n = myName;
  if (isHost && S) { if (applyAction(S, a)) dirty = true; }
  else if (net) net.act(a);
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
  movingId = null; selId = null;
  placing = placing === k ? null : k;
  if (placing) info(`${TOWERS[k].name}: ${TOWERS[k].desc}`);
  mouseDirty = true;
}
function cancel() { placing = null; movingId = null; selId = null; mouseDirty = true; }
function info(text, warn) {
  $('info').textContent = text; $('info').classList.toggle('warn', !!warn);
  infoTimer = warn ? now() + 2.5 : 0;
}

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
  if (G.ph !== 'play') return;
  if (placing) {
    if (movingId) {
      if (!cellFree(G, cx, cy, movingId)) return info('Ahí no se puede colocar.', true);
      act({ t: 'move', id: movingId, cx, cy });
      selId = movingId; placing = null; movingId = null;
    } else {
      if (!cellFree(G, cx, cy)) return info('Ahí no se puede construir (ruta, servidor u ocupado).', true);
      if (G.money < buildCost(G, placing)) return info('CPU insuficiente.', true);
      act({ t: 'build', k: placing, cx, cy });
      if (!e.shiftKey) placing = null; // Mayús + clic para seguir construyendo
    }
    return;
  }
  const t = towerAt(G, cx, cy);
  selId = t ? t.i : null;
});
/** Torre sobre la que actúan U/X/M: la seleccionada o, si no hay, la que está bajo el ratón. */
function targetTower() {
  if (!G) return null;
  if (selId) { const t = G.T.find((q) => q.i === selId); if (t) return t; }
  return hover ? towerAt(G, hover.cx, hover.cy) : null;
}
const PATH_KEYS = ['U', 'I', 'O'];
function upgrade(t, i) {
  if (!t) return info('Selecciona una torre o pon el ratón encima.', true);
  const P = TOWERS[t.k].paths[i], lock = pathLock(t.p, i);
  if (lock) return info(`${P.name}: ${lock}.`, true);
  const cost = upgradeCost(t, i), u = P.ups[t.p[i]];
  if (G.money < cost) return info(`CPU insuficiente: "${u.n}" cuesta ${cost}.`, true);
  act({ t: 'up', id: t.i, p: i });
  info(`${TOWERS[t.k].name} → ${u.n}: ${u.d}`);
}
function sell(t) {
  if (!t) return info('Selecciona una torre o pon el ratón encima.', true);
  act({ t: 'sell', id: t.i });
  info(`${TOWERS[t.k].name} vendida (+${sellValue(t)} CPU).`);
  if (selId === t.i) selId = null;
}
function startMove(t) {
  if (!t) return info('Selecciona una torre o pon el ratón encima.', true);
  selId = t.i; placing = t.k; movingId = t.i;
  info('Haz clic en la nueva posición (la torre tarda 3 s en reiniciarse). Esc cancela.');
}
function cycleTower() {
  if (!G || !G.T.length) return;
  const list = [...G.T].sort((a, b) => a.x - b.x || a.y - b.y);
  const i = list.findIndex((t) => t.i === selId);
  selId = list[(i + 1) % list.length].i;
  placing = null; movingId = null;
}
const toggleKeys = () => $('keys').classList.toggle('hidden');

addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName !== 'INPUT' && net && !solo && current() !== 'menu') { e.preventDefault(); openChat(); return; }
  if (current() !== 'game' || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const playing = G && G.ph === 'play';
  if (k === 'Escape') { cancel(); $('keys').classList.add('hidden'); }
  else if (k >= '1' && k <= '8') choose(TOWER_KEYS[+k - 1]);
  else if (k === 'p') act({ t: 'pause' });
  else if (k === 'h') toggleKeys();
  else if (!playing) return;
  else if (k === ' ') { e.preventDefault(); act({ t: 'next' }); }
  else if (k === 'a') act({ t: 'auto' });
  else if (k === 'u') upgrade(targetTower(), 0);
  else if (k === 'i') upgrade(targetTower(), 1);
  else if (k === 'o') upgrade(targetTower(), 2);
  else if (k === 'x' || k === 'Delete' || k === 'Backspace') { e.preventDefault(); sell(targetTower()); }
  else if (k === 'm') startMove(targetTower());
  else if (k === 'Tab') { e.preventDefault(); cycleTower(); }
});
$('btnPause').onclick = () => act({ t: 'pause' });
$('btnNext').onclick = () => act({ t: 'next' });
$('btnAuto').onclick = () => act({ t: 'auto' });
$('btnKeys').onclick = toggleKeys;
$('btnChat').onclick = (e) => { e.currentTarget.blur(); openChat(); };
$('ovBtn').onclick = () => { if (G?.ph === 'play') act({ t: 'pause' }); else act({ t: 'restart' }); };

// cursor propio -> red (máx. 10 veces/s)
setInterval(() => {
  if (!net || solo || !mouseDirty || current() !== 'game') return;
  mouseDirty = false;
  net.cursor({ x: Math.round(mouse.x), y: Math.round(mouse.y), b: movingId ? '' : placing || '' });
}, 100);

// ---------- panel de torre seleccionada ----------
function updatePanel() {
  const t = G && selId ? G.T.find((q) => q.i === selId) : null;
  if (!t) {
    if (selId && !placing) selId = null;
    if (panelSig) { $('panel').classList.add('hidden'); panelSig = ''; }
    return;
  }
  const d = TOWERS[t.k], st = tStats(t);
  const rows = d.paths.map((P, i) => {
    const lock = pathLock(t.p, i), u = P.ups[t.p[i]], cost = u ? upgradeCost(t, i) : 0;
    return { P, i, lock, u, cost, can: !lock && G.money >= cost };
  });
  const sig = [t.i, t.p.join(''), t._disc, rows.map((r) => r.can).join(''), t.x > 16, t._rd < 0].join();
  if (sig === panelSig) return;
  panelSig = sig;
  const p = $('panel');
  p.classList.remove('hidden');
  p.classList.toggle('left', t.x > 16);
  const r0 = (n) => Math.round(n * 10) / 10;
  const lines = [];
  if (st.dmg) lines.push(`Daño ${Math.round(st.dmg)} cada ${r0(st.rate)}s${st.targets > 1 ? ` ×${st.targets}` : ''}`);
  if (st.dps) lines.push(`${Math.round(st.dps)} daño/s · congela ${r0(st.stun)}s cada ${st.cycle}s`);
  if (st.units) lines.push(`${st.units} threads · ${Math.round(st.uhp)} vida · ${r0(st.udmg)} daño`);
  if (st.buff) lines.push(`+${Math.round(st.buff * 100)}% daño a torres cercanas`);
  if (st.hops) lines.push(`${st.hops} rebotes${st.chains > 1 ? ` ×${st.chains} cadenas` : ''}`);
  if (st.income) lines.push(`+${Math.round(st.income)} CPU cada ${st.period}s`);
  if (t.k !== 'backup') lines.push(`Alcance ${Math.round(tRange(t))}`);
  const sk = skin(t.k, t.p);
  const title = sk.tier ? d.paths[sk.dom].ups[sk.tier - 1].n : d.name;
  p.innerHTML = `<h3 style="color:${sk.main}">${esc(title)} <small>${t.p.join('-')}</small></h3>
    <p class="sub">${d.name}${t._disc ? ` · <span style="color:var(--lime)">−${Math.round(t._disc * 100)}% en mejoras</span>` : ''}</p>
    <p style="color:var(--text)">${lines.join(' · ')}</p>
    ${t.k === 'thread' && t._rd < 0 ? '<p style="color:var(--pink)">¡Demasiado lejos de la ruta! Muévela.</p>' : ''}
    ${rows.map((r) => `
      <div class="path" style="--pc:${r.P.color}">
        <div class="ptop"><b>${r.P.name}</b><span class="pips">${[0, 1, 2].map((j) => `<i class="${j < t.p[r.i] ? 'on' : ''}"></i>`).join('')}</span></div>
        ${r.u && !r.lock
          ? `<button class="btn small up" data-a="up" data-p="${r.i}" ${r.can ? '' : 'disabled'}>[${PATH_KEYS[r.i]}] ${esc(r.u.n)} · ${r.cost} CPU</button><small>${esc(r.u.d)}</small>`
          : `<small class="lock">${r.lock}</small>`}
      </div>`).join('')}
    <div class="btns">
      <button class="btn small" data-a="move">Mover [M]</button>
      <button class="btn small danger" data-a="sell">Vender +${sellValue(t)} [X]</button>
    </div>`;
}
$('panel').addEventListener('click', (e) => {
  const a = e.target.dataset?.a, t = G?.T.find((q) => q.i === selId);
  if (!a || !t) return;
  if (a === 'up') upgrade(t, +e.target.dataset.p);
  else if (a === 'sell') sell(t);
  else if (a === 'move') startMove(t);
});

// ---------- HUD ----------
const cacheTxt = {};
function setTxt(id, v) { if (cacheTxt[id] !== v) { cacheTxt[id] = v; $(id).textContent = v; } }
function updateHud() {
  setTxt('hudWave', `${G.w}/${MAX_WAVE}`);
  setTxt('hudCpu', String(Math.floor(G.money)));
  setTxt('hudLife', String(Math.max(0, G.life)));
  const lf = Math.max(0, G.life / START_LIFE);
  const bar = $('hudLifeBar');
  bar.style.width = lf * 100 + '%';
  bar.style.background = lf > 0.5 ? 'var(--cyan)' : lf > 0.25 ? 'var(--amber)' : 'var(--pink)';
  const waiting = G.ph === 'play' && G.ic > 0;
  $('btnNext').disabled = !waiting || !!G.pa;
  setTxt('btnAuto', G.au ? 'Auto [A]: ON' : 'Auto [A]: OFF');
  $('btnAuto').classList.toggle('on', !!G.au);
  setTxt('hudNext', waiting ? `${Math.ceil(G.ic)}s` : '');
  for (const k of TOWER_KEYS) {
    const s = shopBtns[k], c = buildCost(G, k);
    if (s.last !== c) { s.last = c; s.cost.textContent = c + ' CPU'; }
    s.b.classList.toggle('poor', G.money < c);
    s.b.classList.toggle('sel', placing === k && !movingId);
  }
  if (infoTimer && now() > infoTimer) info('U/I/O mejorar rama 1/2/3 · X vender · M mover · Enter chat · A automático · H todas las teclas.');
  // capas de pausa / fin
  const ov = $('overlay');
  const state = G.ph !== 'play' ? G.ph : G.pa ? 'pause' : '';
  if (ov.dataset.state !== state + G.pb) {
    ov.dataset.state = state + G.pb;
    ov.className = 'overlay ' + (state || 'hidden');
    if (state === 'pause') { $('ovTitle').textContent = '⏸ PAUSA'; $('ovSub').textContent = `Pausado por ${G.pb || '?'} — cualquiera puede reanudar`; $('ovBtn').textContent = 'Reanudar'; }
    if (state === 'won') { $('ovTitle').textContent = 'RELEASE COMPLETADA'; $('ovSub').textContent = 'Producción ha sobrevivido a las 20 oleadas. Buen trabajo, equipo.'; $('ovBtn').textContent = 'Jugar otra vez'; }
    if (state === 'lost') { $('ovTitle').textContent = 'SERVIDOR CAÍDO'; $('ovSub').textContent = `Producción cayó en la oleada ${G.w}. Toca hacer rollback.`; $('ovBtn').textContent = 'Reintentar'; }
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
    hover, placing, placingP: mv ? mv.p : null, movingId, selId,
    valid: !!(placing && hover && cellFree(G, hover.cx, hover.cy, movingId || undefined) && (movingId || G.money >= buildCost(G, placing))),
    cursors: list,
  });
  updateHud();
  updatePanel();
}
requestAnimationFrame(frame);

// acceso para pruebas automáticas
window.__cd = { get G() { return G; }, get isHost() { return isHost; }, get net() { return net; }, act };
