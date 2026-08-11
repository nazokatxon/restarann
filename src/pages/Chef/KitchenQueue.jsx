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
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const audioContextRef = useRef(null);
  const previousOrderIdsRef = useRef([]);

  // 🔊 SIFATLI OVOZ SIGNALINI CHAQIRISH FUNKSIYASI
  const playKitchenSound = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // MP3 audio faylni chalish
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.volume = 1.0;
      await audio.play();
    } catch (error) {
      // Agar fayl yuklanmasa, zaxira beeper (sinus signal) ishlatiladi
      try {
        const ctx = audioContextRef.current;
        if (!ctx) return;
        const playBeep = (startTime, frequency, duration) => {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, startTime);
          gain.gain.setValueAtTime(0.0001, startTime);
          gain.gain.exponentialRampToValueAtTime(0.5, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.start(startTime);
          oscillator.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        playBeep(now, 880, 0.2);
        playBeep(now + 0.25, 1174, 0.3);
      } catch (e) {
        console.log("Audio play error:", e);
      }
    }
  };

  // 🔓 EKRANNING IXTIYORIY JOYIGA BOSILGANDA OVOZNI ISHGA TUSHORISH
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
      console.log("Unlock error:", error);
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (!audioUnlocked) {
        unlockAudio();
      }
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("touchstart", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("touchstart", handleGlobalClick);
    };
  }, [audioUnlocked]);

  // 🌍 MATNLAR
  const TEXT = {
    uz: {
      title: "Buyurtmalar",
      subtitle: "Karavan Kafe — KDS Queue",
      waiting: "Kutilmoqda",
      preparing: "Tayyorlanmoqda",
      total: "Jami stollar",
      empty: "Hozircha faol buyurtmalar yo‘q",
      emptyText: "Yangi buyurtma tushganda avtomatik paydo bo‘ladi.",
      table: "Stol",
      logout: "Chiqish",
      logoutConfirmTitle: "Tizimdan chiqmoqchimisiz?",
      logoutConfirmText: "Rostdan ham tizimdan chiqishni xohlaysizmi?",
      yes: "Ha",
      no: "Yo'q",
      soundOn: "Ovoz faol",
      soundOff: "Ovozni yoqish",
      newOrder: "Yangi buyurtma tushdi!",
      readyBtn: "Tayyor",
      allReadyBtn: "✓ Barchasi tayyor",
    },
    ru: {
      title: "Заказы",
      subtitle: "Karavan Kafe — KDS Queue",
      waiting: "Ожидает",
      preparing: "Готовится",
      total: "Всего столов",
      empty: "Активных заказов пока нет",
      emptyText: "Новые заказы появятся автоматически.",
      table: "Стол",
      logout: "Выйти",
      logoutConfirmTitle: "Выйти из системы?",
      logoutConfirmText: "Вы действительно хотите выйти?",
      yes: "Да",
      no: "Нет",
      soundOn: "Звук включен",
      soundOff: "Включить звук",
      newOrder: "Новый заказ!",
      readyBtn: "Готово",
      allReadyBtn: "✓ Всё готово",
    },
  };

  const t = TEXT[language] || TEXT.uz;

  // 🔥 FIRESTORE LISTENERS
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

            const kitchenStatus = String(order.kitchenStatus || "").toLowerCase();
            const status = String(order.status || "").toLowerCase();

            if (kitchenStatus === "delivered" || status === "delivered") {
              return false;
            }
            if (kitchenStatus === "ready" || status === "ready") {
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

          // 🛎️ YANGI BUYURTMA TUSHGANDA OVOZ CHIQARISH
          if (
            previousOrderIdsRef.current.length > 0 &&
            kitchenOrders.some((o) => !previousOrderIdsRef.current.includes(o.id))
          ) {
            toast.info(`🔔 ${t.newOrder}`, { autoClose: 4000 });
            playKitchenSound();
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

  // 🗂️ STOLLAR BO'YICHA BIRLASHTIRISH
  const groupedTables = Object.values(
    orders.reduce((acc, order) => {
      const tableKey = String(order.tableNumber ?? order.table ?? "Noma'lum");

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

  // 🍲 TAOM TAYYOR BO'LGANDA
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
        status: isAllDone ? "ready" : "preparing",
        updatedAt: serverTimestamp(),
      };

      if (Array.isArray(order.kitchenItems)) {
        updatePayload.kitchenItems = updatedItems;
      } else {
        updatePayload.items = updatedItems;
      }

      await updateDoc(doc(db, "orders", order.id), updatePayload);
    } catch (error) {
      console.error("Xatolik:", error);
      toast.error("Xatolik yuz berdi!");
    }
  };

  // ✅ BARCHA TAOMLAR TAYYOR
  const handleAllTableItemsReady = async (tableGroup) => {
    try {
      for (const order of tableGroup.ordersList) {
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
      }
      toast.success(`Stol ${tableGroup.tableNumber} tayyor deb belgilandi!`);
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
                KDS OSHPAZ PANELI
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* OVOZ TUGMASI */}
            <button
              onClick={() => {
                unlockAudio();
                playKitchenSound();
              }}
              style={{
                border: "none",
                background: audioUnlocked ? "#d4edda" : "#fff3cd",
                color: audioUnlocked ? "#155724" : "#856404",
                borderRadius: "10px",
                padding: "8px 14px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {audioUnlocked ? `🔊 ${t.soundOn}` : `🔔 ${t.soundOff}`}
            </button>

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

        {/* BUYURTMALAR */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            ⏳ Yuklanmoqda...
          </div>
        ) : groupedTables.length === 0 ? (
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
            {groupedTables.map((group) => {
              const allActiveItems = [];
              group.ordersList.forEach((order) => {
                const rawItems = Array.isArray(order.kitchenItems)
                  ? order.kitchenItems
                  : Array.isArray(order.items)
                  ? order.items
                  : [];

                rawItems.forEach((item, originalIndex) => {
                  if (!item.isReady) {
                    allActiveItems.push({
                      ...item,
                      originalIndex,
                      parentOrder: order,
                    });
                  }
                });
              });

              return (
                <div
                  key={group.tableNumber}
                  style={{
                    border: "1px solid #e0d8cc",
                    borderRadius: "16px",
                    background: "#fff",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
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
                        🪑 {t.table} №{group.tableNumber}
                      </div>
                      <div style={{ fontSize: "12px", color: "#888" }}>
                        {formatTime(group.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: "14px", flex: 1 }}>
                    {allActiveItems.map((item, idx) => (
                      <div
                        key={`${item.parentOrder.id}-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          borderBottom:
                            idx !== allActiveItems.length - 1
                              ? "1px solid #f0f0f0"
                              : "none",
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: "15px" }}>
                          {item.name || item.title}{" "}
                          <span
                            style={{
                              background: "#eee",
                              padding: "2px 6px",
                              borderRadius: "6px",
                              fontSize: "12px",
                            }}
                          >
                            x{item.quantity || 1}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleItemReadyToggle(
                              item.parentOrder,
                              item.originalIndex
                            )
                          }
                          style={{
                            border: "none",
                            background: "#27ae60",
                            color: "#fff",
                            borderRadius: "8px",
                            padding: "8px 14px",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          ✓ {t.readyBtn}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: "12px 14px", background: "#fcfcfc" }}>
                    <button
                      type="button"
                      onClick={() => handleAllTableItemsReady(group)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "#2e7d32",
                        color: "#fff",
                        borderRadius: "10px",
                        padding: "12px",
                        fontWeight: 900,
                        cursor: "pointer",
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

        {/* LOGOUT MODAL */}
        {showLogoutModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.4)",
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
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "360px",
                width: "90%",
                textAlign: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>{t.logoutConfirmTitle}</h3>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "20px",
                }}
              >
                <button
                  onClick={confirmLogout}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#c0392b",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 800,
                  }}
                >
                  {t.yes}
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#eee",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 800,
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