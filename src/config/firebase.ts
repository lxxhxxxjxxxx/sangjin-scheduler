import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAzsOYfNuzLnZ460OcLZ-k7RJ-3oFiAjOA",
  authDomain: "sangjin-scheduler.firebaseapp.com",
  projectId: "sangjin-scheduler",
  storageBucket: "sangjin-scheduler.firebasestorage.app",
  messagingSenderId: "704277673896",
  appId: "1:704277673896:web:aab9d84942ba5be7068f9d",
  measurementId: "G-SF4NGNVKSX"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Auth 초기화 (웹 persistence 설정)
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});

export const db = getFirestore(app);
export default app;
