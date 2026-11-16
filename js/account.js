// ============================================================
//  Leones TD — cuentas (nombre de usuario + PIN de 4 dígitos)
//
//  Dónde se guarda (Firebase Realtime Database):
//    cd_names/UID          true            → para saber si un nombre ya está cogido
//    cd_users/UID/CLAVE    { name, created, st: {...}, lastGid }   → el progreso
//
//  CLAVE = SHA-256 del nombre + PIN. El PIN nunca se guarda: solo se puede leer la cuenta
//  si se conoce la clave, es decir, si se sabe el PIN. Es una seguridad básica (un PIN de
//  4 dígitos se puede adivinar probando), suficiente para jugar entre amigos.
//
//  Sin Firebase configurado (o con ?mock) las cuentas se guardan en este navegador.
// ============================================================
import { isConfigured, firebase } from './net.js';

const LOCAL = !isConfigured() || new URLSearchParams(location.search).has('mock');
const SESSION = 'leonestd_session';
let cur = null; // { uid, key, name, profile }

export const isLocal = () => LOCAL;
export const current = () => cur;
const uidOf = (name) => String(name || '').trim().toLowerCase();

function check(name, pin) {
  const uid = uidOf(name);
  if (!/^[a-z0-9_]{3,12}$/.test(uid)) throw new Error('El nombre debe tener de 3 a 12 letras o números (sin espacios ni acentos).');
  if (!/^\d{4}$/.test(String(pin))) throw new Error('El PIN son 4 números.');
  return uid;
}
async function keyOf(uid, pin) {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador no permite cifrar el PIN: abre el juego desde su dirección https.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`leonestd|${uid}|${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const blank = (name) => ({ name, created: Date.now(), st: { games: 0, wins: 0, kills: 0, dmg: 0, gold: 0, best: {}, mapWins: {} }, lastGid: '' });

// ---------- almacenamiento ----------
const store = LOCAL ? {
  async taken(uid) { return localStorage.getItem('leonestd_acc:' + uid) !== null; },
  async create(uid, key, profile) { localStorage.setItem('leonestd_acc:' + uid, JSON.stringify({ key, profile })); },
  async read(uid, key) { const a = JSON.parse(localStorage.getItem('leonestd_acc:' + uid) || 'null'); return a && a.key === key ? a.profile : null; },
  async write(uid, key, profile) { localStorage.setItem('leonestd_acc:' + uid, JSON.stringify({ key, profile })); },
} : {
  async taken(uid) { const { db, database } = await firebase(); return (await db.get(db.ref(database, 'cd_names/' + uid))).exists(); },
  async create(uid, key, profile) {
    const { db, database } = await firebase();
    await db.set(db.ref(database, 'cd_names/' + uid), true); // las reglas solo dejan crearlo si no existía
    await db.set(db.ref(database, `cd_users/${uid}/${key}`), profile);
  },
  async read(uid, key) { const { db, database } = await firebase(); return (await db.get(db.ref(database, `cd_users/${uid}/${key}`))).val(); },
  async write(uid, key, profile) { const { db, database } = await firebase(); await db.set(db.ref(database, `cd_users/${uid}/${key}`), profile); },
};

function open(uid, key, profile, remember) {
  profile.st = { ...blank('').st, ...(profile.st || {}) };
  cur = { uid, key, name: profile.name, profile };
  const data = JSON.stringify({ uid, key });
  sessionStorage.setItem(SESSION, data);                    // aguanta recargas de la pestaña
  if (remember) localStorage.setItem(SESSION, data);        // "recordarme en este ordenador"
  return cur;
}
const friendly = (err) => new Error(/permission|PERMISSION/.test(String(err?.message || err))
  ? 'Firebase ha rechazado la operación: revisa que las reglas de la base de datos sean las del README.'
  : 'Error de conexión: ' + (err?.message || err));

// ---------- operaciones ----------
export async function register(name, pin, remember) {
  const uid = check(name, pin), key = await keyOf(uid, pin);
  let taken;
  try { taken = await store.taken(uid); } catch (err) { throw friendly(err); }
  if (taken) throw new Error('Ese nombre ya está cogido. Elige otro o pulsa Entrar si es tu cuenta.');
  const profile = blank(String(name).trim());
  try { await store.create(uid, key, profile); } catch (err) { throw friendly(err); }
  return open(uid, key, profile, remember);
}

export async function login(name, pin, remember) {
  const uid = check(name, pin), key = await keyOf(uid, pin);
  let profile, taken;
  try { profile = await store.read(uid, key); if (!profile) taken = await store.taken(uid); } catch (err) { throw friendly(err); }
  if (!profile) throw new Error(taken ? 'PIN incorrecto.' : 'No existe ninguna cuenta con ese nombre. Pulsa Crear cuenta.');
  return open(uid, key, profile, remember);
}

/** Recupera la sesión guardada en este navegador (si la hay). */
export async function resume() {
  const raw = sessionStorage.getItem(SESSION) || localStorage.getItem(SESSION);
  if (!raw) return null;
  try {
    const { uid, key } = JSON.parse(raw);
    const profile = await store.read(uid, key);
    if (!profile) { logout(); return null; }
    return open(uid, key, profile, false);
  } catch { return null; }
}

/** Guarda cambios en el perfil (por ejemplo, las estadísticas al acabar una partida). */
export async function save(patch) {
  if (!cur) return null;
  Object.assign(cur.profile, patch);
  await store.write(cur.uid, cur.key, cur.profile);
  return cur;
}

export function logout() {
  cur = null;
  sessionStorage.removeItem(SESSION); localStorage.removeItem(SESSION);
}
