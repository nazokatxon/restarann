import React, { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, secondaryAuth } from "../firebase/config.js";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [cafeId, setCafeId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Foydalanuvchi ma'lumotlarini Firestore'dan olish
  const fetchUserData = async (uid) => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        setRole(data.role || null);
        setCafeId(data.cafeId || null);
        return data;
      } else {
        setRole(null);
        setCafeId(null);
        return null;
      }
    } catch (error) {
      console.error("Foydalanuvchi ma'lumotlarini olishda xatolik:", error);
      setRole(null);
      setCafeId(null);
      return null;
    }
  };

  // Ro'yxatdan o'tish (Agar email ishlatilsa)
  const register = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    return userCredential.user;
  };

  // XODIM YARATISH (Username orqali - avtomatik @kafe.uz qo'shiladi)
  const registerStaff = async (usernameOrEmail, password, extraData = {}) => {
    if (!secondaryAuth) {
      console.error("secondaryAuth Firebase config faylida topilmadi!");
      throw new Error("Firebase secondaryAuth sozlanmagan.");
    }

    try {
      // Agar kiritilgan qiymatda @ belgisi bo'lmasa, uni username deb bilib @kafe.uz qo'shamiz
      const email = usernameOrEmail.includes("@") 
        ? usernameOrEmail 
        : `${usernameOrEmail.trim().toLowerCase()}@kafe.uz`;

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      const newUser = userCredential.user;

      await setDoc(doc(db, "users", newUser.uid), {
        email,
        username: usernameOrEmail.includes("@") ? "" : usernameOrEmail.trim(),
        fullName: extraData.fullName || "",
        role: extraData.role || "waiter",
        cafeId: extraData.cafeId || cafeId,
        phone: extraData.phone || "",
        status: extraData.status || "active",
        createdAt: serverTimestamp(),
      });

      await signOut(secondaryAuth);
      return newUser;
    } catch (error) {
      console.error("Xodim yaratishda xatolik:", error);
      throw error;
    }
  };

  // KIRISH (Username yoki Email orqali ishlashi uchun moslashtirildi)
  const login = async (usernameOrEmail, password) => {
    setLoading(true);
    try {
      // Agar @ belgisi bo'lmasa, uni avtomatik emailga (username@kafe.uz) aylantiramiz
      const email = usernameOrEmail.includes("@") 
        ? usernameOrEmail 
        : `${usernameOrEmail.trim().toLowerCase()}@kafe.uz`;

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const data = await fetchUserData(userCredential.user.uid);
      setLoading(false);
      return data?.role || null;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };
  const setAuthData = ({ user, role, cafeId }) => {
  setUser(user || null);
  setRole(role || null);
  setCafeId(cafeId || null);
};

  // Chiqish
  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUser(null);
    setRole(null);
    setCafeId(null);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser.uid);
      } else {
        setUser(null);
        setRole(null);
        setCafeId(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const value = {
  user,
  role,
  cafeId,
  loading,
  login,
  register,
  registerStaff,
  logout,
  setAuthData,
};

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}