// firebase.js
import { initializeApp } from "firebase/app";
import { 
  initializeAuth, 
  indexedDBLocalPersistence, 
  inMemoryPersistence, 
  browserPopupRedirectResolver 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// 1. Sizning yangi Firebase konfiguratsiyangiz
const firebaseConfig = {
  apiKey: "AIzaSyCG_2OrLoKRVCo67huOQgW4cHxZ6Kt0pXM",
  authDomain: "restourant-e6cce.firebaseapp.com",
  projectId: "restourant-e6cce",
  storageBucket: "restourant-e6cce.firebasestorage.app",
  messagingSenderId: "812324770813",
  appId: "1:812324770813:web:edb6b19dc3c4eba73e3f94",
  measurementId: "G-5TNRN204JG"
};

// 2. Asosiy va ikkilamchi ilovalarni ishga tushirish
const app = initializeApp(firebaseConfig);
const secondaryApp = initializeApp(firebaseConfig, "Secondary");

// 3. Analytics (xavfsiz ishga tushirish)
let analytics;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

// 4. Asosiy Auth (Doimiy sessiya - IndexedDB)
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

// 5. Firestore ma'lumotlar bazasi
export const db = getFirestore(app);

// 6. Secondary Auth (Vaqtinchalik sessiya - InMemory)
// Admin sessiyasini buzmagan holda xodimlarni boshqarish uchun
export const secondaryAuth = initializeAuth(secondaryApp, {
  persistence: inMemoryPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});