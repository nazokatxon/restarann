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
  const [languageOpen, setLanguageOpen] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // 🚪 CHIQISH MODAL OYNASI STATE'I
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const audioContextRef = useRef(null);
  const previousOrderIdsRef = useRef([]);

  // 🔊 AUDIO
  const playKitchenSound = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const playBeep = (startTime, frequency, duration) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.45, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playBeep(now, 880, 0.25);
      playBeep(now + 0.3, 988, 0.25);
      playBeep(now + 0.6, 1174, 0.35);

      setAudioUnlocked(true);
    } catch (error) {
      console.log("Audio error:", error);
    }
  };

  const unlockAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      setAudioUnlocked(true);
    } catch (error) {
      console.log(error);
    }
  };

  // 🌍 TEXTS
  const TEXT = {
    uz: {
      title: "Buyurtmalar",
      subtitle: "Karavan Kafe — KDS Queue",
      waiting: "Kutilmoqda",
      preparing: "Tayyorlanmoqda",
      total: "Jami",
      empty: "Hozircha faol buyurtmalar yo‘q",
      emptyText: "Yangi buyurtma tushganda avtomatik paydo bo‘ladi.",
      table: "Stol",
      logout: "Chiqish",
      logoutConfirmTitle: "Tizimdan chiqmoqchimisiz?",
      logoutConfirmText: "Rostdan ham tizimdan chiqishni xohlaysizmi?",
      yes: "Ha",
      no: "Yo'q",
      sound: "Ovozni yoqish",
      newOrder: "Yangi buyurtma!",
      readyBtn: "Tayyor",
      allReadyBtn: "✓ Barchasi tayyor",
    },
    ru: {
      title: "Заказы",
      subtitle: "Karavan Kafe — KDS Queue",
      waiting: "Ожидает",
      preparing: "Готовится",
      total: "Всего",
      empty: "Активных заказов пока нет",
      emptyText: "Новые заказы появятся автоматически.",
      table: "Стол",
      logout: "Выйти",
      logoutConfirmTitle: "Выйти из системы?",
      logoutConfirmText: "Вы действительно хотите выйти?",
      yes: "Да",
      no: "Нет",
      sound: "Включить звук",
      newOrder: "Новый заказ!",
      readyBtn: "Готово",
      allReadyBtn: "✓ Всё готово",
    },
    en: {
      title: "Orders",
      subtitle: "Karavan Kafe — KDS Queue",
      waiting: "Waiting",
      preparing: "Preparing",
      total: "Total",
      empty: "No active orders",
      emptyText: "New orders will appear automatically.",
      table: "Table",
      logout: "Logout",
      logoutConfirmTitle: "Logout of system?",
      logoutConfirmText: "Are you sure you want to log out?",
      yes: "Yes",
      no: "No",
      sound: "Enable sound",
      newOrder: "New order!",
      readyBtn: "Done",
      allReadyBtn: "✓ All Ready",
    },
  };

  const t = TEXT[language] || TEXT.uz;

  // 🔥 FIRESTORE REALTIME LISTEN
  useEffect(() => {
    setLoading(true);
    const ordersRef = collection(db, "orders");

    const unsubscribe = onSnapshot(
      ordersRef,
      (snapshot) => {
        try {
          const allOrders = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          const kitchenOrders = allOrders.filter((order) => {
            const rawItems = Array.isArray(order.kitchenItems)
              ? order.kitchenItems
              : Array.isArray(order.items)
              ? order.items
              : [];

            const pendingItems = rawItems.filter((i) => !i.isReady);

            if (pendingItems.length === 0) return false;

            const kitchenStatus = String(
              order.kitchenStatus || ""
            ).toLowerCase();
            const status = String(order.status || "").toLowerCase();

            if (
              kitchenStatus === "delivered" ||
              status === "delivered"
            ) {
              return false;
            }

            return true;
          });

          kitchenOrders.sort((a, b) => {
            const getTime = (o) => {
              if (o.createdAt?.seconds) return o.createdAt.seconds * 1000;
              if (o.createdAt?.toDate) return o.createdAt.toDate().getTime();
              if (typeof o.createdAt === "number") return o.createdAt;
              return 0;
            };
            return getTime(a) - getTime(b);
          });

          const currentIds = kitchenOrders.map((o) => o.id);
          if (
            previousOrderIdsRef.current.length > 0 &&
            kitchenOrders.some((o) => !previousOrderIdsRef.current.includes(o.id))
          ) {
            toast.info(`🔔 ${t.newOrder}`, { autoClose: 4000 });
            if (audioUnlocked) playKitchenSound();
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
        console.error("Firestore listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [audioUnlocked, language]);

  // 🍲 BIRDONA TAOM TAYYOR BO'LGANDA UNI YO'QOTISH
  const handleItemReadyToggle = async (order, itemIndex) => {
    try {
      const rawItems = Array.isArray(order.kitchenItems)
        ? order.kitchenItems
        : Array.isArray(order.items)
        ? order.items
        : [];

      const updatedItems = [...rawItems];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        isReady: true,
      };

      const remainingItems = updatedItems.filter((item) => !item.isReady);
      const isAllDone = remainingItems.length === 0;

      const updatePayload = {
        kitchenStatus: isAllDone ? "ready" : "preparing",
        updatedAt: serverTimestamp(),
      };

      if (Array.isArray(order.kitchenItems)) {
        updatePayload.kitchenItems = updatedItems;
      } else {
        updatePayload.items = updatedItems;
      }

      await updateDoc(doc(db, "orders", order.id), updatePayload);
    } catch (error) {
      console.error("Tugma bosishda xatolik:", error);
      toast.error("Xatolik yuz berdi!");
    }
  };

  // ✅ BARCHASI TAYYOR TUGMASI
  const handleAllItemsReady = async (order) => {
    try {
      const rawItems = Array.isArray(order.kitchenItems)
        ? order.kitchenItems
        : Array.isArray(order.items)
        ? order.items
        : [];

      const updatedItems = rawItems.map((item) => ({
        ...item,
        isReady: true,
      }));

      const updatePayload = {
        kitchenStatus: "ready",
        status: "ready",
        updatedAt: serverTimestamp(),
      };

      if (Array.isArray(order.kitchenItems)) {
        updatePayload.kitchenItems = updatedItems;
      } else {
        updatePayload.items = updatedItems;
      }

      await updateDoc(doc(db, "orders", order.id), updatePayload);
      toast.success(`Stol ${order.tableNumber ?? order.table ?? ""} tayyor!`);
    } catch (error) {
      console.error("Barchasi tayyor tugmasida xatolik:", error);
      toast.error("Xatolik yuz berdi!");
    }
  };

  // 🚪 CHIQISH HAQIDA ANIQ CHIQADIGAN MANTIQ
  const confirmLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      toast.error("Chiqishda xatolik!");
    }
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem("appLang", lang);
    setLanguageOpen(false);
  };

  const formatTime = (order) => {
    try {
      if (order.createdAt?.toDate) {
        return order.createdAt.toDate().toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      if (order.createdAt?.seconds) {
        return new Date(order.createdAt.seconds * 1000).toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return "";
    } catch {
      return "";
    }
  };

  const waitingCount = orders.filter(
    (o) => (o.kitchenStatus || "pending") === "pending"
  ).length;
  const preparingCount = orders.filter(
    (o) => o.kitchenStatus === "preparing"
  ).length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f1ea",
        padding: "20px",
        color: "#30352d",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* HEADER */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2dad0",
            borderRadius: "20px",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "28px" }}>👨‍🍳</span>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 900 }}>
                KARAVAN • KAFE
              </div>
              <div style={{ fontSize: "11px", color: "#8d8a80", fontWeight: 800 }}>
                KDS SYSTEM
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", position: "relative" }}>
            <button
              onClick={() => setLanguageOpen(!languageOpen)}
              style={{
                border: "1px solid #ddd",
                background: "#f9f9f9",
                borderRadius: "10px",
                padding: "8px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🌐 {language.toUpperCase()}
            </button>
            {languageOpen && (
              <div
                style={{
                  position: "absolute",
                  right: "90px",
                  top: "45px",
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "5px",
                  zIndex: 10,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              >
                <div onClick={() => changeLanguage("uz")} style={{ padding: "8px", cursor: "pointer" }}>🇺🇿 O'zbekcha</div>
                <div onClick={() => changeLanguage("ru")} style={{ padding: "8px", cursor: "pointer" }}>🇷🇺 Русский</div>
                <div onClick={() => changeLanguage("en")} style={{ padding: "8px", cursor: "pointer" }}>🇬🇧 English</div>
              </div>
            )}

            {/* CHIQISH TUGMASI (MODAL OYNASINI OCHADI) */}
            <button
              onClick={() => setShowLogoutModal(true)}
              style={{
                border: "1px solid #f2c2b8",
                background: "#fff0ed",
                color: "#c0392b",
                borderRadius: "10px",
                padding: "8px 14px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* STATS */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 900 }}>
              {t.title}
            </h1>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ background: "#fff3cd", padding: "6px 12px", borderRadius: "8px", fontWeight: 800, color: "#856404" }}>
              {t.waiting}: {waitingCount}
            </span>
            <span style={{ background: "#d4edda", padding: "6px 12px", borderRadius: "8px", fontWeight: 800, color: "#155724" }}>
              {t.preparing}: {preparingCount}
            </span>
            <span style={{ background: "#e2e3e5", padding: "6px 12px", borderRadius: "8px", fontWeight: 800, color: "#383d41" }}>
              {t.total}: {orders.length}
            </span>
          </div>
        </div>

        {!audioUnlocked && (
          <button
            onClick={() => {
              unlockAudio();
              playKitchenSound();
            }}
            style={{
              width: "100%",
              marginBottom: "15px",
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid #ffebaba",
              background: "#fff8e7",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🔊 {t.sound}
          </button>
        )}

        {/* BUYURTMALAR GRID */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            ⏳ Yuklanmoqda...
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px",
              background: "#fff",
              borderRadius: "16px",
            }}
          >
            <h3>{t.empty}</h3>
            <p style={{ color: "#888" }}>{t.emptyText}</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {orders.map((order) => {
              const rawItems = Array.isArray(order.kitchenItems)
                ? order.kitchenItems
                : Array.isArray(order.items)
                ? order.items
                : [];

              const activeItems = rawItems
                .map((item, originalIndex) => ({ ...item, originalIndex }))
                .filter((item) => !item.isReady);

              return (
                <div
                  key={order.id}
                  style={{
                    border: "1px solid #e0d8cc",
                    borderRadius: "16px",
                    background: "#fff",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* CARD HEADER */}
                  <div
                    style={{
                      padding: "14px",
                      background: "#FAF7EE",
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "18px", fontWeight: 900 }}>
                        🪑 {t.table} {order.tableNumber ?? order.table ?? "—"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#888" }}>
                        {formatTime(order)}
                      </div>
                    </div>
                  </div>

                  {/* TAOMLAR RO'YXATI */}
                  <div style={{ padding: "14px", flex: 1 }}>
                    {activeItems.map((item, idx) => {
                      const itemName =
                        item.name || item.title || item.foodName || "Taom";
                      const quantity = item.quantity || item.qty || 1;

                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 0",
                            borderBottom:
                              idx !== activeItems.length - 1
                                ? "1px solid #f0f0f0"
                                : "none",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: "15px",
                                color: "#333",
                              }}
                            >
                              {itemName}{" "}
                              <span
                                style={{
                                  background: "#eee",
                                  padding: "2px 6px",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  marginLeft: "4px",
                                }}
                              >
                                x{quantity}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleItemReadyToggle(order, item.originalIndex)
                            }
                            style={{
                              border: "none",
                              background: "#27ae60",
                              color: "#fff",
                              borderRadius: "8px",
                              padding: "8px 14px",
                              fontWeight: 900,
                              fontSize: "13px",
                              cursor: "pointer",
                              transition: "0.2s",
                            }}
                          >
                            ✓ Tayyor
                          </button>
                        </div>
                      );
                    })}

                    {order.note && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "8px",
                          background: "#fff9e6",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "#666",
                        }}
                      >
                        📝 {order.note}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      background: "#fcfcfc",
                      borderTop: "1px solid #f0f0f0",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleAllItemsReady(order)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "#2e7d32",
                        color: "#fff",
                        borderRadius: "10px",
                        padding: "12px",
                        fontWeight: 900,
                        fontSize: "14px",
                        cursor: "pointer",
                        boxShadow: "0 4px 10px rgba(46, 125, 50, 0.2)",
                      }}
                    >
                      {t.allReadyBtn}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 🚪 CHIQISH UCHUN HA / YO'Q MODAL OYNASI */}
        {showLogoutModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              backdropFilter: "blur(2px)",
            }}
            onClick={() => setShowLogoutModal(false)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "360px",
                width: "90%",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                textAlign: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>🚪</div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: 800 }}>
                {t.logoutConfirmTitle}
              </h3>
              <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: "14px" }}>
                {t.logoutConfirmText}
              </p>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={confirmLogout}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#c0392b",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  {t.yes}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #ccc",
                    background: "#f8f8f8",
                    color: "#333",
                    fontWeight: 800,
                    fontSize: "14px",
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