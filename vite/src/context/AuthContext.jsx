import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";

import { db } from "../Firebase/config";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [cafeId, setCafeId] = useState(null);
  const [cafeName, setCafeName] = useState("");
  const [loading, setLoading] = useState(true);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("app_user");
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setRole(parsedUser.role || parsedUser.rol || null);
        setCafeId(parsedUser.cafeId || null);
        setCafeName(parsedUser.cafeName || "");
      } catch (err) {
        console.error("Saqlangan foydalanuvchini o'qishda xatolik:", err);
        localStorage.removeItem("app_user");
      }
    }
    setLoading(false);
  }, []);

  const fetchCafeData = async (currentCafeId) => {
    if (!currentCafeId) {
      setCafeName("");
      return "";
    }
    try {
      const cafeDocRef = doc(db, "cafes", currentCafeId);
      const cafeDocSnap = await getDoc(cafeDocRef);
      if (cafeDocSnap.exists()) {
        const cData = cafeDocSnap.data();
        const cName = cData.name || cData.title || "Kafe";
        setCafeName(cName);
        return cName;
      }
    } catch (error) {
      console.error("Kafe ma'lumotlarini olishda xatolik:", error);
    }
    setCafeName("");
    return "";
  };

  const login = async (username, password) => {
    const cleanUsername = username ? username.trim() : "";
    const cleanPassword = password ? password.trim() : "";

    if (!cleanUsername || !cleanPassword) {
      throw new Error("Login va parolni kiriting!");
    }

    // 1. Avval Firestore'dan mos username bo'yicha qidiramiz
    const q = query(
      collection(db, "users"),
      where("username", "==", cleanUsername)
    );

    let querySnapshot = await getDocs(q);
    let userData = null;
    let userId = null;

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      userData = docSnap.data();
      userId = docSnap.id;
    } else {
      // 2. Agar topilmasa, harflar registri (katta-kichik) bo'yicha barcha users'ni tekshiramiz
      const allSnapshot = await getDocs(collection(db, "users"));
      allSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.username && data.username.trim().toLowerCase() === cleanUsername.toLowerCase()) {
          userData = data;
          userId = docSnap.id;
        }
      });
    }

    if (!userData) {
      throw new Error("Foydalanuvchi topilmadi");
    }

    if (String(userData.password).trim() !== cleanPassword) {
      throw new Error("Parol noto'g'ri");
    }

    const userRole = userData.role || userData.rol || "chef";
    const uCafeId = userData.cafeId ? String(userData.cafeId).trim() : null;
    
    let fetchedCafeName = "";
    if (uCafeId) {
      try {
        fetchedCafeName = await fetchCafeData(uCafeId);
      } catch (e) {
        console.error("Kafe nomini olishda xato:", e);
      }
    }

    const userObject = {
      uid: userId,
      username: userData.username,
      role: userRole,
      cafeId: uCafeId,
      cafeName: fetchedCafeName,
      ...userData,
    };

    setUser(userObject);
    setRole(userRole);
    setCafeId(uCafeId);
    localStorage.setItem("app_user", JSON.stringify(userObject));

    return userRole;
  };

  const registerStaff = async (username, password, extraData = {}) => {
    try {
      const newDocRef = doc(collection(db, "users"));
      const newStaff = {
        username: username,
        password: password,
        role: extraData.role || "waiter",
        cafeId: extraData.cafeId || cafeId,
        status: extraData.status || "active",
        createdAt: serverTimestamp(),
        ...extraData,
      };

      await setDoc(newDocRef, newStaff);
      return { id: newDocRef.id, ...newStaff };
    } catch (error) {
      console.error("Xodim yaratishda xatolik:", error);
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem("app_user");
    setUser(null);
    setRole(null);
    setCafeId(null);
    setCafeName("");
  };

  const playOrderReadySound = async () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }

      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") await ctx.resume();

      const now = ctx.currentTime;
      const tone = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.18, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration);
      };

      tone(520, 0, 0.18);
      tone(700, 0.18, 0.16);
      tone(880, 0.34, 0.2);
    } catch (error) {
      console.error("Order ready audio error:", error);
    }
  };

  useEffect(() => {
    const unlockAudio = async () => {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!user || !cafeId || (role !== "waiter" && role !== "ofitsiant")) return;

    const q = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId),
      where("waiterId", "==", user.uid),
      where("kitchenStatus", "==", "ready")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added" && change.type !== "modified") return;

        const orderData = { id: change.doc.id, ...change.doc.data() };

        if (orderData.waiterNotified) return;

        toast.info(`🛎 Stol №${orderData.tableNumber || "-"} uchun buyurtma tayyor!`, {
          position: "top-right",
          style: { backgroundColor: "#8B4513", color: "#ffffff" },
          icon: "🍽",
        });

        playOrderReadySound();

        updateDoc(doc(db, "orders", orderData.id), {
          waiterNotified: true,
        }).catch((err) => {
          console.error("waiterNotified update error:", err);
        });
      });
    });

    return () => unsubscribe();
  }, [user, cafeId, role]);

  const value = {
    user,
    role,
    cafeId,
    cafeName,
    loading,
    login,
    registerStaff,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}