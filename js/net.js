// ============================================================
//  Code Defenders — red (Firebase Realtime Database)
//
//  Estructura en la base de datos:
//    cd_rooms/CODE/meta      { host, started, at }
//    cd_rooms/CODE/players   { pid: { name, slot, at } }
//    cd_rooms/CODE/s         instantánea del juego (texto JSON, la escribe el anfitrión)
//    cd_rooms/CODE/a         cola de acciones de los jugadores (las consume el anfitrión)
//    cd_rooms/CODE/c         { pid: { x, y, b } }  cursores
// ============================================================
import { firebaseConfig } from './firebase-config.js';

const V = '10.12.2';
export const MAX_PLAYERS = 4;
export const isConfigured = () =>
  !!firebaseConfig.apiKey && !/PEGA_AQUI/.test(firebaseConfig.apiKey) && !!firebaseConfig.databaseURL && !/PEGA_AQUI/.test(firebaseConfig.databaseURL);

const randCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

export async function connect() {
  const [{ initializeApp }, db] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`),
  ]);
  const database = db.getDatabase(initializeApp(firebaseConfig));
  const pid = Math.random().toString(36).slice(2, 10);
  let code = '';
  const unsubs = [];
  const R = (p) => db.ref(database, 'cd_rooms/' + code + (p ? '/' + p : ''));

  async function enter(name, slot) {
    await db.onDisconnect(R('players/' + pid)).remove();
    await db.onDisconnect(R('c/' + pid)).remove();
    await db.set(R('players/' + pid), { name, slot, at: db.serverTimestamp() });
  }

  return {
    pid,
    get code() { return code; },

    async create(name) {
      for (let i = 0; i < 20; i++) {
        code = randCode();
        const s = await db.get(R('players'));
        if (!s.exists()) break; // libre (o abandonada: se reutiliza)
      }
      await db.set(R(), { meta: { host: pid, started: false, at: db.serverTimestamp() } });
      await enter(name, 0);
      return code;
    },

    async join(c, name) {
      code = c;
      const s = await db.get(R());
      const room = s.val();
      if (!room || !room.meta) { code = ''; throw new Error('No existe ninguna sala con ese código.'); }
      const used = Object.values(room.players || {}).map((p) => p.slot);
      if (used.length >= MAX_PLAYERS) { code = ''; throw new Error('La sala está llena (máximo 4 jugadores).'); }
      let slot = 0;
      while (used.includes(slot)) slot++;
      await enter(name, slot);
      return code;
    },

    /** kind: 'meta' | 'players' | 's' | 'c' */
    on(kind, cb) { unsubs.push(db.onValue(R(kind), (snap) => cb(snap.val()))); },

    /** Solo el anfitrión: recibe y borra las acciones de la cola. Devuelve función para dejar de escuchar. */
    onAction(cb) {
      return db.onChildAdded(R('a'), (snap) => { const v = snap.val(); db.remove(snap.ref); cb(v); });
    },

    act(a) { if (code) db.push(R('a'), a); },
    publish(str) { if (code) db.set(R('s'), str); },
    cursor(c) { if (code) db.set(R('c/' + pid), c); },
    setMeta(m) { return db.update(R('meta'), m); },
    /** Si el anfitrión (old) se ha ido, intenta quedarse con el puesto. */
    claimHost(old) { return db.runTransaction(R('meta/host'), (cur) => (cur === old || cur === null ? pid : undefined)); },

    leave() {
      unsubs.forEach((u) => u()); unsubs.length = 0;
      if (code) { db.remove(R('players/' + pid)); db.remove(R('c/' + pid)); }
      code = '';
    },
  };
}
