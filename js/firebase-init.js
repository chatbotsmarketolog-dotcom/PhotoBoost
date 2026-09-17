// js/firebase-init.js — инициализация Firebase и экспорт Firestore-функций
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs,
  query, where, orderBy, limit,
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
const db = getFirestore(app);

export {
  db,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs,
  query, where, orderBy, limit,
  runTransaction, serverTimestamp
};
