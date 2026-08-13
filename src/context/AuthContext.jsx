import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  auth,
  db,
  secondaryAuth,
} from "../firebase/config.js";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [cafeId, setCafeId] = useState(null);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // FIRESTORE'DAN USER MA'LUMOTLARINI OLISH
  // ==========================================

  const fetchUserData = async (uid) => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();

        setRole(data.role || null);
        setCafeId(data.cafeId || null);

        return data;
      }

      setRole(null);
      setCafeId(null);

      return null;
    } catch (error) {
      console.error(
        "Foydalanuvchi ma'lumotlarini olishda xatolik:",
        error
      );

      setRole(null);
      setCafeId(null);

      return null;
    }
  };

  // ==========================================
  // ODDIY RO'YXATDAN O'TISH
  // ==========================================

  const register = async (email, password) => {
    const userCredential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    return userCredential.user;
  };

  // ==========================================
  // XODIM YARATISH
  // ==========================================

  const registerStaff = async (
    usernameOrEmail,
    password,
    extraData = {}
  ) => {
    if (!secondaryAuth) {
      console.error(
        "secondaryAuth Firebase config faylida topilmadi!"
      );

      throw new Error(
        "Firebase secondaryAuth sozlanmagan."
      );
    }

    try {
      // Username bo'lsa avtomatik @kafe.uz qo'shiladi
      const email = usernameOrEmail.includes("@")
        ? usernameOrEmail.trim().toLowerCase()
        : `${usernameOrEmail.trim().toLowerCase()}@kafe.uz`;

      console.log("Xodim yaratilmoqda:", email);

      // Firebase Authentication'da user yaratish
      const userCredential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );

      const newUser = userCredential.user;

      // Firestore'ga user ma'lumotlarini yozish
      await setDoc(
        doc(db, "users", newUser.uid),
        {
          email: email,

          username: usernameOrEmail.includes("@")
            ? usernameOrEmail.split("@")[0].trim()
            : usernameOrEmail.trim(),

          fullName: extraData.fullName || "",

          role: extraData.role || "waiter",

          cafeId: extraData.cafeId || cafeId,

          phone: extraData.phone || "",

          salary: Number(extraData.salary) || 0,

          status: extraData.status || "active",

          createdAt: serverTimestamp(),
        }
      );

      // Secondary auth'dan chiqamiz
      await signOut(secondaryAuth);

      console.log(
        "Xodim muvaffaqiyatli yaratildi:",
        email
      );

      return newUser;

    } catch (error) {
      console.error(
        "Xodim yaratishda xatolik:",
        error
      );

      throw error;
    }
  };

  // ==========================================
  // LOGIN
  // ==========================================

  const login = async (
    usernameOrEmail,
    password
  ) => {
    setLoading(true);

    try {
      // Username kiritilsa @kafe.uz qo'shamiz
      const email = usernameOrEmail.includes("@")
        ? usernameOrEmail.trim().toLowerCase()
        : `${usernameOrEmail.trim().toLowerCase()}@kafe.uz`;

      console.log("Login qilinmoqda:", email);

      // Firebase Authentication orqali kirish
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const currentUser = userCredential.user;

      // Firestore'dan role/cafeId olish
      const data = await fetchUserData(
        currentUser.uid
      );

      setUser(currentUser);

      setLoading(false);

      return data?.role || null;

    } catch (error) {
      console.error(
        "Login xatoligi:",
        error
      );

      setLoading(false);

      throw error;
    }
  };

  // ==========================================
  // AUTH DATA
  // ==========================================

  const setAuthData = ({
    user,
    role,
    cafeId,
  }) => {
    setUser(user || null);
    setRole(role || null);
    setCafeId(cafeId || null);
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = async () => {
    setLoading(true);

    try {
      await signOut(auth);

      setUser(null);
      setRole(null);
      setCafeId(null);

    } catch (error) {
      console.error(
        "Logout xatoligi:",
        error
      );

      throw error;

    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // AUTH HOLATINI KUZATISH
  // ==========================================

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {

          setLoading(true);

          if (currentUser) {
            setUser(currentUser);

            await fetchUserData(
              currentUser.uid
            );

          } else {
            setUser(null);
            setRole(null);
            setCafeId(null);
          }

          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, []);

  // ==========================================
  // CONTEXT
  // ==========================================

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