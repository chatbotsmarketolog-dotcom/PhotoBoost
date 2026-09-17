// js/firebase-init.js — инициализация Firebase + ре-экспорт всех нужных функций
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs,
  query, orderBy, limit, where,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDu0LYyiKzYQtuhiE_FiDxcs4TEfMmzH0s",
  authDomain: "photoboost-web.firebaseapp.com",
  projectId: "photoboost-web",
  storageBucket: "photoboost-web.firebasestorage.app",
  messagingSenderId: "1079187313126",
  appId: "1:1079187313126:web:2d64f5715e34f2e188c627"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth, db,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs,
  query, orderBy, limit, where,
  runTransaction, serverTimestamp
};
