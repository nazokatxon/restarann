import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
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

// ======================================================
// CONTEXT
// ======================================================
const AuthContext = createContext(null);

// ======================================================
// useAuth
// ======================================================
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth faqat AuthProvider ichida ishlatilishi kerak!");
  }
  return context;
}

// ======================================================
// AUTH PROVIDER
// ======================================================
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [cafeId, setCafeId] = useState(null);
  const [loading, setLoading] = useState(true);

  // ====================================================
  // FIRESTORE'DAN USER MA'LUMOTLARINI OLISH
  // ====================================================
  const fetchUserData = useCallback(async (uid) => {
    try {
      console.log("Firestore user olinmoqda:", uid);
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        console.log("Firestore user topildi:", data);

        setRole(data.role || null);
        setCafeId(data.cafeId || null);

        return data;
      }

      console.warn("Firestore users ichida user topilmadi:", uid);
      setRole(null);
      setCafeId(null);
      return null;
    } catch (error) {
      console.error("Foydalanuvchi ma'lumotlarini olishda xatolik:", error);
      setRole(null);
      setCafeId(null);
      return null;
    }
  }, []);

  // ====================================================
  // ODDIY REGISTER
  // ====================================================
  const register = useCallback(async (email, password) => {
    try {
      const emailNormalized = email.trim().toLowerCase();
      console.log("Register:", emailNormalized);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        emailNormalized,
        password
      );

      return userCredential.user;
    } catch (error) {
      console.error("Register xatoligi:", error);
      throw error;
    }
  }, []);

  // ====================================================
  // XODIM YARATISH (REGISTER STAFF)
  // ====================================================
  const registerStaff = useCallback(async (usernameOrEmail, password, extraData = {}) => {
    try {
      if (!secondaryAuth) {
        throw new Error("secondaryAuth mavjud emas. firebase config ni tekshiring.");
      }
      if (!usernameOrEmail) throw new Error("Xodim loginini kiriting.");
      if (!password) throw new Error("Xodim parolini kiriting.");
      if (password.length < 6) throw new Error("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");

      let email = usernameOrEmail.includes("@")
        ? usernameOrEmail.trim().toLowerCase()
        : `${usernameOrEmail.trim().toLowerCase()}@kafe.uz`;

      const username = email.split("@")[0].trim().toLowerCase();
      const staffCafeId = extraData.cafeId || cafeId;

      if (!staffCafeId) {
        throw new Error("Cafe ID topilmadi. Adminning cafeId ma'lumotini tekshiring.");
      }

      console.log("Firebase Authentication user yaratilmoqda:", email);
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );

      const newUser = userCredential.user;

      const userData = {
        uid: newUser.uid,
        email: email,
        username: username,
        password: password.trim(),
        fullName: extraData.fullName || "",
        role: extraData.role || "waiter",
        cafeId: staffCafeId,
        phone: extraData.phone || "",
        salary: Number(extraData.salary || 0),
        status: extraData.status || "active",
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", newUser.uid), userData);
      await signOut(secondaryAuth);

      console.log("Xodim muvaffaqiyatli yaratildi:", email);
      return newUser;
    } catch (error) {
      console.error("Xodim yaratishda xatolik:", error);
      throw error;
    }
  }, [cafeId]);

  // ====================================================
  // LOGIN
  // ====================================================
  const login = useCallback(async (usernameOrEmail, password) => {
    setLoading(true);

    try {
      if (!usernameOrEmail) throw new Error("Loginni kiriting.");
      if (!password) throw new Error("Parolni kiriting.");

      let email = usernameOrEmail.includes("@")
        ? usernameOrEmail.trim().toLowerCase()
        : `${usernameOrEmail.trim().toLowerCase()}@kafe.uz`;

      console.log("Login qilinmoqda:", email);

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const currentUser = userCredential.user;
      const data = await fetchUserData(currentUser.uid);

      if (!data) {
        await signOut(auth);
        throw new Error("Foydalanuvchi ma'lumotlari topilmadi.");
      }

      if (data.status === "inactive") {
        await signOut(auth);
        throw new Error("Sizning hisobingiz bloklangan.");
      }

      setUser(currentUser);
      setRole(data.role || null);
      setCafeId(data.cafeId || null);

      return data.role || null;
    } catch (error) {
      console.error("Login xatoligi:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchUserData]);

  // ====================================================
  // LOGOUT
  // ====================================================
  const logout = useCallback(async () => {
    setLoading(true);

    try {
      await signOut(auth);

      if (secondaryAuth) {
        try {
          await signOut(secondaryAuth);
        } catch (secondaryError) {
          console.warn("Secondary logout xatoligi:", secondaryError);
        }
      }

      setUser(null);
      setRole(null);
      setCafeId(null);
      console.log("Logout muvaffaqiyatli.");
    } catch (error) {
      console.error("Logout xatoligi:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // ====================================================
  // AUTH DATA SETTER
  // ====================================================
  const setAuthData = useCallback(({ user, role, cafeId }) => {
    setUser(user || null);
    setRole(role || null);
    setCafeId(cafeId || null);
  }, []);

  // ====================================================
  // AUTH OBSERVER
  // ====================================================
  useEffect(() => {
    console.log("Auth listener ishga tushdi.");

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setLoading(true);

        if (currentUser) {
          console.log("Auth user topildi:", currentUser.email);
          setUser(currentUser);

          const data = await fetchUserData(currentUser.uid);

          if (data) {
            setRole(data.role || null);
            setCafeId(data.cafeId || null);
          } else {
            setRole(null);
            setCafeId(null);
          }
        } else {
          console.log("Auth user mavjud emas.");
          setUser(null);
          setRole(null);
          setCafeId(null);
        }
      } catch (error) {
        console.error("Auth listener xatoligi:", error);
        setUser(null);
        setRole(null);
        setCafeId(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      console.log("Auth listener to'xtatildi.");
      unsubscribe();
    };
  }, [fetchUserData]);

  // ====================================================
  // CONTEXT VALUE (MEMOIZED)
  // ====================================================
  const value = useMemo(
    () => ({
      user,
      role,
      cafeId,
      loading,
      login,
      register,
      registerStaff,
      logout,
      setAuthData,
    }),
    [user, role, cafeId, loading, login, register, registerStaff, logout, setAuthData]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}