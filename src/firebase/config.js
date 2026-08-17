import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCG_2OrLoKRVCo67huOQgW4cHxZ6Kt0pXM",
  authDomain: "restourant-e6cce.firebaseapp.com",
  projectId: "restourant-e6cce",
  storageBucket: "restourant-e6cce.firebasestorage.app",
  messagingSenderId: "812324770813",
  appId: "1:812324770813:web:edb6b19dc3c4eba73e3f94",
  measurementId: "G-5TNRN204JG"
};

// 1. App mavjud bo'lsa shuni oladi, bo'lmasa yaratadi
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const secondaryApp = getApps().find(a => a.name === "Secondary") 
  || initializeApp(firebaseConfig, "Secondary");

// 2. Standart getAuth (Initalize xatolarining oldini oladi)
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

// 3. Firestore
export const db = getFirestore(app);

// 4. Analytics
export let analytics;
isSupported().then((supported) => {
  if (supported) analytics = getAnalytics(app);
}).catch((err) => console.warn(err));

export default app;