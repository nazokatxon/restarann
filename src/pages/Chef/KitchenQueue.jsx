import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db } from "../../firebase/config.js";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const KitchenQueue = () => {
  const navigate = useNavigate();
  const auth = getAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(
    localStorage.getItem("appLang") || "uz"
  );
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const previousOrderIdsRef = useRef([]);
  const isInitialLoad = useRef(true); // Birinchi yuklanishni kuzatish uchun

  // ⭐ FIX: AudioContext faqat BIR MARTA yaratiladi va useRef'da saqlanadi.
  // Avvalgi kodda har safar playSynthBeep() chaqirilganda YANGI AudioContext
  // yaratilardi — bu esa brauzerning autoplay siyosati tufayli "suspended"
  // holatda qolib, foydalanuvchi tugma bosmagan holatlarda (masalan,
  // Firestore'dan kelgan yangi buyurtmada) OVOZ CHIQMAY QOLARDI.
  const audioCtxRef = useRef(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  };

  // 🔊 ELEKTRON OVOZ GENERATORI (Web Audio API)
  const playSynthBeep = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) {
        console.warn("⚠️ AudioContext yaratilmadi (brauzer qo'llab-quvvatlamaydi)");
        return;
      }

      // ⭐ FIX: agar context "suspended" bo'lsa (masalan sahifa hali
      // gesture bilan unlock qilinmagan bo'lsa), avval resume qilamiz
      if (ctx.state === "suspended") {
        ctx.resume().catch((e) => console.warn("resume xatosi:", e));
      }

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      gain1.gain.setValueAtTime(0.5, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.4);

      setTimeout(() => {
        try {
          if (ctx.state === "suspended") ctx.resume();
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(1046.5, ctx.currentTime);
          gain2.gain.setValueAtTime(0.6, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.6);
        } catch (e) {}
      }, 150);
    } catch (e) {
      console.error("Audio synth error:", e);
    }
  };

  const playKitchenSound = () => {
    console.log("🔊 playKitchenSound() chaqirildi");
    playSynthBeep();
  };

  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
    setAudioUnlocked(true);
    playKitchenSound();
    toast.success("Ovoz muvaffaqiyatli yoqildi!", { autoClose: 1500 });
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (!audioUnlocked) setAudioUnlocked(true);
      // ⭐ FIX: har safar bosilganda contextni "resume" qilib turamiz,
      // shunda brauzer uni qayta uxlatib qo'ymaydi
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") ctx.resume();
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("touchstart", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("touchstart", handleGlobalClick);
    };
  }, [audioUnlocked]);

  // 🌍 TEXTS
  const TEXT = {
    uz: {
      queueTitle: "Oshxona navbati",
      activeOrders: "ta faol buyurtma",
      inQueue: "NAVBATDA",
      preparing: "Tayyorlanmoqda",
      readyBtn: "Tayyor",
      empty: "Hozircha faol buyurtmalar yo‘q",
      emptyText: "Yangi buyurtma tushganda avtomatik paydo bo‘ladi.",
      logoutConfirmTitle: "Tizimdan chiqmoqchimisiz?",
      yes: "Ha",
      no: "Yo'q",
      newOrder: "Yangi buyurtma tushdi!",
      langName: "O'zbekcha",
      minAgo: "daq. o'tdi",
      cafeName: "Karavan Kafe",
    },
    ru: {
      queueTitle: "Очередь кухни",
      activeOrders: "активных заказов",
      inQueue: "В ОЧЕРЕДИ",
      preparing: "Готовится",
      readyBtn: "Готово",
      empty: "Активных заказов пока нет",
      emptyText: "Новые заказы появятся автоматически.",
      logoutConfirmTitle: "Выйти из системы?",
      yes: "Да",
      no: "Нет",
      newOrder: "Новый заказ!",
      langName: "Русский",
      minAgo: "мин. назад",
      cafeName: "Karavan Kafe",
    },
  };

  const t = TEXT[language] || TEXT.uz;

  const toggleLanguage = () => {
    const nextLang = language === "uz" ? "ru" : "uz";
    setLanguage(nextLang);
    localStorage.setItem("appLang", nextLang);
  };

  // 🔥 FIRESTORE LISTENER (FAQAT YANGI ORDER KELGANDA OVOZ BERYAPTI)
  // ⭐ FIX: dependency array'dan `audioUnlocked` olib tashlandi — u o'zgarganda
  // butun listener qayta ulanib, `isInitialLoad` va `previousOrderIdsRef`
  // holatini yo'qotib qo'yardi (bu ham ovoz/bildirishnoma o'tkazib
  // yuborilishiga sabab bo'lishi mumkin edi).
  useEffect(() => {
    setLoading(true);
    const ordersRef = collection(db, "orders");

    console.log("👂 Firestore 'orders' listener ulanmoqda...");

    const unsubscribe = onSnapshot(
      ordersRef,
      (snapshot) => {
        try {
          console.log(`📦 Snapshot keldi. Jami hujjatlar: ${snapshot.docs.length}`);

          const allOrders = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          const kitchenOrders = allOrders.filter((order) => {
            const st = String(order.status || "").toLowerCase();
            const kSt = String(order.kitchenStatus || "").toLowerCase();

            const isFinished =
              st === "delivered" || st === "completed" || st === "finish" ||
              kSt === "delivered" || kSt === "completed" || kSt === "finish";

            return !isFinished;
          });

          console.log(`🍲 Faol (oshxona uchun) buyurtmalar: ${kitchenOrders.length}`);

          kitchenOrders.sort((a, b) => {
            const getTime = (o) => {
              if (o.createdAt?.seconds) return o.createdAt.seconds * 1000;
              if (o.createdAt?.toDate) return o.createdAt.toDate().getTime();
              if (typeof o.createdAt === "number") return o.createdAt;
              return Date.now();
            };
            return getTime(a) - getTime(b);
          });

          const currentIds = kitchenOrders.map((o) => o.id);

          // AGAR BIRINCHI MARTA YUKLANISH BO'LSA - FAQAT ID'LARNI SAQLAYDI, OVOZ CHALMAYDI
          if (isInitialLoad.current) {
            isInitialLoad.current = false;
            console.log("ℹ️ Birinchi yuklanish — ovoz chalinmaydi, faqat ID'lar saqlanadi");
          } else {
            // FAQAT OFITSIANT YANGI BUYURTMA URXAN BO'LSA OVOZ VA TOAST CHIQARADI
            const hasNewOrder = currentIds.some(
              (id) => !previousOrderIdsRef.current.includes(id)
            );

            if (hasNewOrder) {
              console.log("🆕 YANGI BUYURTMA ANIQLANDI! Ovoz chalinadi.");
              toast.info(`🔔 ${t.newOrder}`, { autoClose: 3000 });
              playKitchenSound();
            }
          }

          previousOrderIdsRef.current = currentIds;
          setOrders(kitchenOrders);
          setLoading(false);
        } catch (error) {
          console.error("Xatolik:", error);
          setLoading(false);
        }
      },
      (error) => {
        // ⭐ FIX: listener xatosi bo'lsa endi foydalanuvchiga ham ko'rinadi
        console.error("❌ Firestore listener xatosi (orders):", error);
        console.error("Xato kodi:", error.code, "| Xabar:", error.message);
        toast.error("Buyurtmalarni yuklashda xatolik: " + error.message);
        setLoading(false);
      }
    );

    return () => {
      console.log("🔌 Firestore listener uzilmoqda");
      unsubscribe();
    };
  }, [language]);

  // STOLLAR BO'YICHA GURUHLASH
  const groupedTables = Object.values(
    orders.reduce((acc, order) => {
      const tableKey = String(
        order.tableNumber ?? order.table ?? order.tableNo ?? "Noma'lum"
      );

      if (!acc[tableKey]) {
        acc[tableKey] = {
          tableNumber: tableKey,
          createdAt: order.createdAt,
          ordersList: [],
        };
      }

      acc[tableKey].ordersList.push(order);
      return acc;
    }, {})
  ).sort((a, b) => Number(a.tableNumber) - Number(b.tableNumber));

  // TUGMA BOSILGANDA TAYYOR QILISH VA OSHPAZ RO‘YXATIDAN YO‘QOTISH
  const handleItemReadyToggle = async (order, itemIndex) => {
    try {
      let fieldName = "kitchenItems";
      let rawItems = [];

      if (Array.isArray(order.kitchenItems)) {
        fieldName = "kitchenItems";
        rawItems = order.kitchenItems;
      } else if (Array.isArray(order.items)) {
        fieldName = "items";
        rawItems = order.items;
      } else if (Array.isArray(order.products)) {
        fieldName = "products";
        rawItems = order.products;
      }

      const updatedItems = [...rawItems];

      if (updatedItems[itemIndex]) {
        // Bir marta bosilganda taom tayyor bo'ladi.
        // Qayta bosib holatni orqaga qaytarish yo'q.
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          isReady: true,
        };
      }

      const isAllDone =
        updatedItems.length > 0 &&
        updatedItems.every((item) => Boolean(item.isReady));

      const updatePayload = {
        [fieldName]: updatedItems,
        updatedAt: serverTimestamp(),
      };

      if (isAllDone) {
        // Barcha taomlar tayyor bo'lsa, afitsiantga ham shu status yuboriladi.
        updatePayload.kitchenStatus = "ready";
        updatePayload.status = "ready";
      } else {
        // Bitta taom qayta ochilsa, buyurtma yana tayyorlanmoqda holatiga qaytadi.
        updatePayload.kitchenStatus = "preparing";
        updatePayload.status = "preparing";
      }

      await updateDoc(doc(db, "orders", order.id), updatePayload);

      // Taom tayyor bo‘lgach oshpaz ro‘yxatidan yo‘qoladi.
      // Barcha taomlar tayyor bo‘lsa kitchenStatus=ready bo‘ladi va
      // afitsiant tomoni tayyor xabarini oladi.

      toast.success(
        isAllDone ? "✅ Buyurtma tayyor! Afitsiantga yuborildi." : "🍽️ Taom tayyor!",
        { autoClose: 1500 }
      );
    } catch (error) {
      console.error("Xatolik:", error);
      toast.error("Xatolik yuz berdi!");
    }
  };

  const confirmLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      toast.error("Chiqishda xatolik!");
    }
  };

  const formatTime = (createdAt) => {
    try {
      if (createdAt?.toDate) {
        return createdAt.toDate().toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      if (createdAt?.seconds) {
        return new Date(createdAt.seconds * 1000).toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return "";
    } catch {
      return "";
    }
  };

  const getElapsedTime = (createdAt) => {
    if (!createdAt) return `0 ${t.minAgo}`;
    let timeMs = 0;
    if (createdAt.toDate) timeMs = createdAt.toDate().getTime();
    else if (createdAt.seconds) timeMs = createdAt.seconds * 1000;
    else if (typeof createdAt === "number") timeMs = createdAt;
    else return `0 ${t.minAgo}`;

    const diffMinutes = Math.floor((Date.now() - timeMs) / (1000 * 60));
    return `${diffMinutes < 0 ? 0 : diffMinutes} ${t.minAgo}`;
  };

  const currentUser = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || "oshpaz";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f5ed",
        padding: "20px",
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        {/* TOP NAVBAR */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                background: "#f59e0b",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "20px",
              }}
            >
              🏢
            </div>
            <span style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>
              {t.cafeName}
            </span>
            <span
              style={{
                background: "#fef3c7",
                color: "#d97706",
                fontSize: "11px",
                fontWeight: "bold",
                padding: "3px 8px",
                borderRadius: "6px",
              }}
            >
              v1.0
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={unlockAudio}
              style={{
                background: audioUnlocked ? "#dcfce7" : "#fef3c7",
                border: "none",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: "700",
                color: audioUnlocked ? "#166534" : "#b45309",
                cursor: "pointer",
              }}
            >
              🔔 {audioUnlocked ? "Ovoz faol" : "Ovozni tekshirish"}
            </button>

            <button
              onClick={toggleLanguage}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              🌐 {t.langName}
            </button>

            <button
              onClick={() => setShowLogoutModal(true)}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              🍳 {currentUser}
            </button>
          </div>
        </div>

        {/* HEADER STATS */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <h1 style={{ fontSize: "28px", fontWeight: "800", margin: 0, color: "#0f172a" }}>
            {t.queueTitle}
          </h1>

          <div
            style={{
              background: "#e0f2fe",
              color: "#0369a1",
              padding: "10px 20px",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "15px",
            }}
          >
            {groupedTables.length} {t.activeOrders}
          </div>
        </div>

        {/* MAIN ORDERS SECTION */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", fontSize: "18px", color: "#334155" }}>
            ⏳ Yuklanmoqda...
          </div>
        ) : groupedTables.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <h3 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginBottom: "8px" }}>
              {t.empty}
            </h3>
            <p style={{ color: "#64748b", fontSize: "15px", margin: 0, fontWeight: "500" }}>
              {t.emptyText}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {groupedTables.map((group, index) => {
              const allItems = [];

              group.ordersList.forEach((order) => {
                const rawItems = Array.isArray(order.kitchenItems)
                  ? order.kitchenItems
                  : Array.isArray(order.items)
                  ? order.items
                  : Array.isArray(order.products)
                  ? order.products
                  : [];

                rawItems.forEach((item, originalIndex) => {
                  allItems.push({
                    ...item,
                    originalIndex,
                    parentOrder: order,
                  });
                });
              });

              return (
                <div
                  key={group.tableNumber}
                  style={{
                    background: "#ffffff",
                    borderRadius: "20px",
                    border: "2px solid #f59e0b",
                    padding: "20px 24px",
                    boxShadow: "0 4px 12px rgba(245, 158, 11, 0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "18px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span
                        style={{
                          background: "#f97316",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: "800",
                          padding: "6px 14px",
                          borderRadius: "20px",
                        }}
                      >
                        {t.inQueue} {index + 1}-CHI
                      </span>
                      <span style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
                        Stol №{group.tableNumber}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          background: "#e0f2fe",
                          color: "#2563eb",
                          padding: "4px 12px",
                          borderRadius: "12px",
                          fontSize: "13px",
                          fontWeight: "700",
                          display: "inline-block",
                          marginBottom: "4px",
                        }}
                      >
                        {t.preparing}
                      </span>
                      <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>
                        {formatTime(group.createdAt)} • {getElapsedTime(group.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* TAOMLAR */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {allItems.filter((item) => !item.isReady).length === 0 ? (
                      <div style={{ padding: "12px", color: "#64748b", fontSize: "14px" }}>
                        Xabarnoma: Ushbu stol buyurtmasida taomlar ro'yxati topilmadi.
                      </div>
                    ) : (
                      allItems
                        .filter((item) => !item.isReady)
                        .map((item, idx) => (
                        <div
                          key={`${item.parentOrder.id}-${idx}`}
                          style={{
                            background: "#f8fafc",
                            borderRadius: "12px",
                            padding: "12px 18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div style={{ fontWeight: "700", fontSize: "16px", color: "#0f172a" }}>
                            {item.name || item.title || item.productName || "Taom"}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <button
                              type="button"
                              onClick={() =>
                                handleItemReadyToggle(
                                  item.parentOrder,
                                  item.originalIndex
                                )
                              }
                              style={{
                                background: "#e0f2fe",
                                color: "#2563eb",
                                border: "1px solid #bfdbfe",
                                borderRadius: "10px",
                                padding: "8px 16px",
                                fontWeight: "800",
                                fontSize: "14px",
                                cursor: "pointer",
                                minWidth: "128px",
                                boxShadow: "none",
                              }}
                            >
                              Tayyorlanmoqda
                            </button>

                            <span
                              style={{
                                fontWeight: "800",
                                fontSize: "16px",
                                color: "#0f172a",
                                minWidth: "28px",
                                textAlign: "right",
                              }}
                            >
                              x{item.quantity || item.count || 1}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LOGOUT MODAL */}
        {showLogoutModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowLogoutModal(false)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "20px",
                padding: "28px",
                maxWidth: "380px",
                width: "90%",
                textAlign: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: "20px", margin: "0 0 20px 0", color: "#0f172a" }}>
                {t.logoutConfirmTitle}
              </h3>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={confirmLogout}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {t.yes}
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {t.no}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default KitchenQueue;