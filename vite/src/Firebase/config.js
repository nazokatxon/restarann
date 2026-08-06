import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCG_2OrLoKRVCo67huOQgW4cHxZ6Kt0pXM",
  authDomain: "restaurant-e6cce.firebaseapp.com",
  projectId: "restaurant-e6cce", // <-- 'u' harfi bor-yo'qligini Console'dan aniqlab oling
  storageBucket: "restaurant-e6cce.firebasestorage.app",
  messagingSenderId: "812324770813",
  appId: "1:812324770813:web:edb6b19dc3c4eba73e3f94",
  measurementId: "G-5TNRN204JG"
};

// Asosiy Firebase ilovasi
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Ikkinchi Firebase ilovasi (Admin/Chef yaratishda joriy sessiya uzilib ketmasligi uchun)
const secondaryApp = getApps().find(a => a.name === "SecondaryApp") 
  || initializeApp(firebaseConfig, "SecondaryApp");

const secondaryAuth = getAuth(secondaryApp);

export { app, auth, db, secondaryAuth };