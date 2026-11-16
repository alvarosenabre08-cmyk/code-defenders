// ============================================================
//  Leones TD — red (Firebase Realtime Database)
//
//  Estructura en la base de datos:
//    cd_rooms/CODE/meta      { host, started, map, at }
//    cd_rooms/CODE/players   { pid: { name, slot, uid, at } }   quién está conectado ahora
//    cd_rooms/CODE/seats     { uid: slot }   puesto (0-3) reservado para cada cuenta: si se te
//                            cae la conexión y vuelves, recuperas tu color, tu oro y tus torres
//    cd_rooms/CODE/s         instantánea del juego (texto JSON, la escribe el anfitrión)
//    cd_rooms/CODE/a         cola de acciones de los jugadores (las consume el anfitrión)
//    cd_rooms/CODE/c         { pid: { x, y, b } }  cursores
//    cd_rooms/CODE/chat      mensajes del chat { n, s, m, at }
//  (Las cuentas están en cd_names y cd_users: ver account.js)
// ============================================================
import { firebaseConfig } from './firebase-config.js';

const V = '10.12.2';
export const MAX_PLAYERS = 4;
export const isConfigured = () =>
  !!firebaseConfig.apiKey && !/PEGA_AQUI/.test(firebaseConfig.apiKey) && !!firebaseConfig.databaseURL && !/PEGA_AQUI/.test(firebaseConfig.databaseURL);

let fbP = null;
/** Carga Firebase una sola vez. Devuelve { db (funciones), database (conexión) }. */
export function firebase() {
  return (fbP ||= Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`),
  ]).then(([{ initializeApp }, db]) => ({ db, database: db.getDatabase(initializeApp(firebaseConfig)) })));
}

const randCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

/**
 * Elige puesto para la cuenta uid dentro del mapa de asientos { uid: puesto }.
 * used = puestos de los jugadores conectados ahora. Devuelve el mapa nuevo, o null si la sala está llena.
 */
export function pickSeat(seats, uid, used) {
  seats = { ...(seats || {}) };
  if (seats[uid] !== undefined) return seats;                       // ya tenía puesto: lo recupera
  const taken = Object.values(seats);
  let slot = [0, 1, 2, 3].find((s) => !taken.includes(s));
  if (slot === undefined) {                                         // los 4 reservados: quitar el de alguien que ya no está
    const old = Object.keys(seats).find((u) => !used.includes(seats[u]));
    if (old === undefined) return null;
    slot = seats[old]; delete seats[old];
  }
  seats[uid] = slot;
  return seats;
}

export async function connect() {
  const { db, database } = await firebase();
  const pid = Math.random().toString(36).slice(2, 10);
  let code = '';
  const unsubs = [];
  const R = (p) => db.ref(database, 'cd_rooms/' + code + (p ? '/' + p : ''));

  async function enter(name, slot, uid) {
    await db.onDisconnect(R('players/' + pid)).remove();
    await db.onDisconnect(R('c/' + pid)).remove();
    await db.set(R('players/' + pid), { name, slot, uid, at: db.serverTimestamp() });
  }

  return {
    pid,
    get code() { return code; },

    async create(name, uid) {
      for (let i = 0; i < 20; i++) {
        code = randCode();
        const s = await db.get(R('players'));
        if (!s.exists()) break; // libre (o abandonada: se reutiliza)
      }
      await db.set(R(), { meta: { host: pid, started: false, at: db.serverTimestamp() }, seats: { [uid]: 0 } });
      await enter(name, 0, uid);
      return code;
    },

    async join(c, name, uid) {
      code = c;
      const room = (await db.get(R())).val();
      if (!room || !room.meta) { code = ''; throw new Error('No existe ninguna sala con ese código.'); }
      const used = Object.values(room.players || {}).filter((p) => p.uid !== uid).map((p) => p.slot);
      // transacción: dos personas que entran a la vez nunca reciben el mismo puesto
      const res = await db.runTransaction(R('seats'), (cur) => {
        const next = pickSeat(cur, uid, used);
        return next === null ? undefined : next;
      });
      const seats = res.snapshot.val() || {};
      if (!res.committed || seats[uid] === undefined) { code = ''; throw new Error('La sala está llena (máximo 4 jugadores).'); }
      await enter(name, seats[uid], uid);
      return code;
    },

    /** kind: 'meta' | 'players' | 's' | 'c' */
    on(kind, cb) { unsubs.push(db.onValue(R(kind), (snap) => cb(snap.val()))); },

    /** Solo el anfitrión: recibe y borra las acciones de la cola. Devuelve función para dejar de escuchar. */
    onAction(cb) {
      return db.onChildAdded(R('a'), (snap) => { const v = snap.val(); db.remove(snap.ref); cb(v); });
    },

    act(a) { if (code) db.push(R('a'), a); },
    /** Envía un mensaje al chat de la sala. */
    chat(n, slot, m) { if (code) db.push(R('chat'), { n, s: slot, m, at: db.serverTimestamp() }); },
    /** Recibe los últimos 30 mensajes y los nuevos. */
    onChat(cb) { unsubs.push(db.onChildAdded(db.query(R('chat'), db.limitToLast(30)), (snap) => cb(snap.val()))); },
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
