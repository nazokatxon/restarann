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

  // Ro'yxatdan o'tish
  const register = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    return userCredential.user;
  };

  // XODIM YARATISH
  const registerStaff = async (email, password, extraData = {}) => {
    if (!secondaryAuth) {
      console.error("secondaryAuth Firebase config faylida topilmadi!");
      throw new Error("Firebase secondaryAuth sozlanmagan.");
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      const newUser = userCredential.user;

      await setDoc(doc(db, "users", newUser.uid), {
        email,
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

  // Kirish funksiyasi ichida setRole va setCafeId darhol yangilanishini ta'minlaymiz
  const login = async (email, password) => {
    setLoading(true);
    try {
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

  // Chiqish
  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUser(null);
    setRole(null);
    setCafeId(null);
    setLoading(false);
  };

  // MUHIM TO'G'RILANISH: Asinxron zanjirni to'g'ri boshqarish
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true); // Yuklanishni boshlaymiz
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser.uid); // Firestore'dan ma'lumot to'liq kelishini kutadi
      } else {
        setUser(null);
        setRole(null);
        setCafeId(null);
      }
      setLoading(false); // Faqat barcha ma'lumotlar yuklanib bo'lingach yopiladi
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
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}