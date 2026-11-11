// ============================================================
//  Red simulada para PRUEBAS (añade ?mock a la URL).
//  Sincroniza varias pestañas del MISMO navegador sin Firebase.
//  El juego real nunca la usa.
// ============================================================
export async function connect() {
  const pid = Math.random().toString(36).slice(2, 10);
  const bc = new BroadcastChannel('cd-mock');
  let code = '';
  const subs = [];
  let actionCb = null;
  // Una clave de localStorage por dato (y por jugador) para que las pestañas no se pisen.
  const MAPS = ['players', 'c'];
  const key = (kind, id) => 'cdmock:' + code + ':' + kind + (id ? ':' + id : '');
  const read = (k) => JSON.parse(localStorage.getItem(k) || 'null');
  const loadKind = (kind) => {
    if (!MAPS.includes(kind)) return read(key(kind));
    const out = {}, pre = key(kind) + ':';
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(pre)) out[k.slice(pre.length)] = read(k);
    }
    return Object.keys(out).length ? out : null;
  };
  // Cada pestaña guarda una copia en memoria; los cambios viajan dentro del mensaje.
  let cache = {};
  const seed = () => { cache = {}; for (const k of ['meta', 's', 'players', 'c']) cache[k] = loadKind(k); };
  const fire = (kind) => subs.filter((s) => s.kind === kind).forEach((s) => s.cb(cache[kind] ?? null));
  const apply = (kind, id, val) => {
    if (!MAPS.includes(kind)) { cache[kind] = val; return; }
    const m = { ...(cache[kind] || {}) };
    if (val === null) delete m[id]; else m[id] = val;
    cache[kind] = Object.keys(m).length ? m : null;
  };
  const put = (kind, id, val) => {
    if (!code) return;
    if (val === null) localStorage.removeItem(key(kind, id)); else localStorage.setItem(key(kind, id), JSON.stringify(val));
    apply(kind, id, val);
    bc.postMessage({ code, kind, id, val }); fire(kind);
  };
  bc.onmessage = (ev) => {
    if (ev.data.code !== code) return;
    if (ev.data.action) { if (actionCb) actionCb(ev.data.action); return; }
    apply(ev.data.kind, ev.data.id, ev.data.val); fire(ev.data.kind);
  };
  const api = {
    pid,
    get code() { return code; },
    async create(name) {
      code = 'TEST';
      Object.keys(localStorage).filter((k) => k.startsWith('cdmock:')).forEach((k) => localStorage.removeItem(k));
      seed();
      put('meta', '', { host: pid, started: false });
      put('players', pid, { name, slot: 0, at: Date.now() });
      return code;
    },
    async join(c, name) {
      code = c; seed();
      if (!cache.meta) { code = ''; throw new Error('No existe ninguna sala con ese código.'); }
      const used = Object.values(cache.players || {}).map((p) => p.slot);
      if (used.length >= 4) { code = ''; throw new Error('La sala está llena (máximo 4 jugadores).'); }
      let slot = 0; while (used.includes(slot)) slot++;
      put('players', pid, { name, slot, at: Date.now() });
      return code;
    },
    on(kind, cb) { subs.push({ kind, cb }); cb(cache[kind] ?? null); },
    onAction(cb) { actionCb = cb; return () => { actionCb = null; }; },
    act(a) { bc.postMessage({ code, action: a }); },
    publish(str) { put('s', '', str); },
    cursor(c) { put('c', pid, c); },
    async setMeta(m) { put('meta', '', { ...(cache.meta || {}), ...m }); },
    async claimHost(old) { const m = cache.meta; if (m.host === old) put('meta', '', { ...m, host: pid }); },
    leave() {
      if (!code) return;
      put('players', pid, null); put('c', pid, null);
      subs.length = 0; code = '';
    },
  };
  return api;
}
