// js/cloud.js — облачный слой PhotoBoost
import {
  auth, db,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, orderBy, limit, runTransaction, serverTimestamp
} from './firebase-init.js';

const Cloud = {
  onAuth(cb) { return onAuthStateChanged(auth, cb); },

  async register(name, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await cred.user.updateProfile({ displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      name: name,
      email: email,
      plan: 'free',
      freeUsage: 2,
      proExpiry: null,
      totalProcessed: 0,
      totalSavedBytes: 0,
      paidClicked: false,
      createdAt: serverTimestamp()
    });
    return cred.user;
  },

  async login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },

  async logout() { await signOut(auth); },

  async sendPasswordReset(email) { await sendPasswordResetEmail(auth, email); },

  async loadProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },

  async updateProfile(uid, data) {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
  },

  async pushHistory(uid, item) {
    const ref = await addDoc(collection(db, 'users', uid, 'history'), Object.assign({}, item, {
      createdAt: serverTimestamp()
    }));
    return ref.id;
  },

  async loadHistory(uid, limitCount) {
    const q = query(collection(db, 'users', uid, 'history'), orderBy('createdAt', 'desc'), limit(limitCount || 200));
    const snap = await getDocs(q);
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  },

  async addReview(data) {
    return addDoc(collection(db, 'reviews'), Object.assign({}, data, {
      createdAt: serverTimestamp()
    }));
  },

  async loadReviews(limitCount) {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(limitCount || 30));
    const snap = await getDocs(q);
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  },

  async deleteReview(id, uid) {
    const ref = doc(db, 'reviews', id);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().authorUid === uid) {
      await deleteDoc(ref);
    }
  },

  async activateCode(code, uid) {
    const ref = doc(db, 'proCodes', code);
    return runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Код не найден. Проверьте правильность ввода.');
      if (snap.data().status !== 'active') throw new Error('Этот код уже был использован.');
      tx.update(ref, {
        status: 'used',
        usedBy: uid,
        usedAt: serverTimestamp()
      });
      return snap.data();
    });
  }
};

export { Cloud };
window.Cloud = Cloud;
