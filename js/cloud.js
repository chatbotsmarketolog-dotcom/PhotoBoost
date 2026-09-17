// js/cloud.js — облачный слой PhotoBoost: авторизация, профили, история, отзывы, коды
import {
  db, doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, orderBy, limit,
  runTransaction, serverTimestamp
} from './firebase-init.js';

const SESSION_KEY = 'pbSessionUid';

// ---------- утилиты ----------
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hashPassword(password, salt) { return sha256(salt + '::' + password); }
function makeUid() {
  if (crypto.randomUUID) return 'u_' + crypto.randomUUID().replace(/-/g, '');
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
function makeErr(code, message) { const e = new Error(message); e.code = code; return e; }

async function findUserByEmail(email) {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return Object.assign({ uid: d.id }, d.data());
}

const Cloud = {

  // ---------- РЕГИСТРАЦИЯ ----------
  async register(name, email, password) {
    const em = String(email).toLowerCase().trim();
    if (!name) throw makeErr('bad-name', 'Введите имя');
    if (password.length < 6) throw makeErr('short-pass', 'Пароль должен быть минимум 6 символов');
    const existing = await findUserByEmail(em);
    if (existing) throw makeErr('email-in-use', 'Пользователь с таким email уже зарегистрирован. Войдите или восстановите пароль.');
    const uid = makeUid();
    const salt = Math.random().toString(36).slice(2, 10);
    const passHash = await hashPassword(password, salt);
    await setDoc(doc(db, 'users', uid), {
      uid: uid,
      name: name,
      email: em,
      salt: salt,
      passHash: passHash,
      plan: 'free',
      freeUsage: 2,
      totalProcessed: 0,
      totalSavedBytes: 0,
      paidClicked: false,
      createdAt: serverTimestamp()
    });
    localStorage.setItem(SESSION_KEY, uid);
    return { uid: uid, name: name, email: em, displayName: name };
  },

  // ---------- ВХОД ----------
  async login(email, password) {
    const em = String(email).toLowerCase().trim();
    const user = await findUserByEmail(em);
    if (!user) throw makeErr('bad-creds', 'Неверный email или пароль');
    const hash = await hashPassword(password, user.salt || '');
    if (hash !== user.passHash) throw makeErr('bad-creds', 'Неверный email или пароль');
    localStorage.setItem(SESSION_KEY, user.uid);
    return { uid: user.uid, name: user.name, email: user.email, displayName: user.name };
  },

  // ---------- ВЫХОД ----------
  async logout() { localStorage.removeItem(SESSION_KEY); },

  // ---------- ТЕКУЩАЯ СЕССИЯ ----------
  async onAuth(cb) {
    const uid = localStorage.getItem(SESSION_KEY);
    if (!uid) { cb(null); return; }
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) { localStorage.removeItem(SESSION_KEY); cb(null); return; }
      const d = snap.data();
      cb(Object.assign({ uid: snap.id, displayName: d.name }, d));
    } catch (e) { cb(null); }
  },

  // ---------- СБРОС ПАРОЛЯ (email -> новый пароль) ----------
  async userExists(email) {
    return !!(await findUserByEmail(String(email).toLowerCase().trim()));
  },
  async resetPassword(email, newPassword) {
    const em = String(email).toLowerCase().trim();
    const user = await findUserByEmail(em);
    if (!user) throw makeErr('no-user', 'Пользователь с таким email не найден');
    if (newPassword.length < 6) throw makeErr('short-pass', 'Пароль должен быть минимум 6 символов');
    const salt = user.salt || Math.random().toString(36).slice(2, 10);
    const passHash = await hashPassword(newPassword, salt);
    await updateDoc(doc(db, 'users', user.uid), { salt: salt, passHash: passHash });
    return true;
  },

  // ---------- ПРОФИЛЬ ----------
  async loadProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },
  async updateProfile(uid, data) {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
  },

  // ---------- ИСТОРИЯ ОБРАБОТОК ----------
  async pushHistory(uid, item) {
    const ref = await addDoc(
      collection(db, 'users', uid, 'history'),
      Object.assign({}, item, { createdAt: serverTimestamp() })
    );
    return ref.id;
  },
  async loadHistory(uid, limitCount) {
    const q = query(
      collection(db, 'users', uid, 'history'),
      orderBy('createdAt', 'desc'),
      limit(limitCount || 200)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  },

  // ---------- ОТЗЫВЫ ----------
  async addReview(data) {
    return addDoc(
      collection(db, 'reviews'),
      Object.assign({}, data, { createdAt: serverTimestamp() })
    );
  },
  async loadReviews(limitCount) {
    const q = query(
      collection(db, 'reviews'),
      orderBy('createdAt', 'desc'),
      limit(limitCount || 30)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  },
  async deleteReview(id, uid) {
    const ref = doc(db, 'reviews', id);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().authorUid === uid) await deleteDoc(ref);
  },

  // ---------- КОДЫ АКТИВАЦИИ PRO ----------
  async activateCode(code, uid) {
    const ref = doc(db, 'proCodes', code);
    return runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw makeErr('no-code', 'Код не найден. Проверьте правильность ввода.');
      if (snap.data().status !== 'active') throw makeErr('used-code', 'Этот код уже был использован.');
      tx.update(ref, { status: 'used', usedBy: uid, usedAt: serverTimestamp() });
      return snap.data();
    });
  }
};

export { Cloud };
window.Cloud = Cloud;
