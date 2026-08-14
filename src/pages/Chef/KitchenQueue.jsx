import React, { useEffect, useRef, useState } from "react";

import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import {
  getAuth,
  signOut,
} from "firebase/auth";

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

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Audio
  const audioCtxRef = useRef(null);

  // Oldingi buyurtmalar
  const previousOrderIdsRef = useRef([]);

  // Oldingi item holatlari
  const previousItemStatesRef = useRef({});

  const isInitialLoad = useRef(true);

  // =========================================================
  // 🔊 AUDIO
  // =========================================================

  const getAudioContext = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioCtx) return null;

        audioCtxRef.current = new AudioCtx();
      }

      return audioCtxRef.current;
    } catch (error) {
      console.error("Audio context error:", error);
      return null;
    }
  };

  const playKitchenSound = () => {
    try {
      const ctx = getAudioContext();

      if (!ctx) return;

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);

      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.exponentialRampToValueAtTime(
        0.5,
        now + 0.03
      );

      gain1.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.35
      );

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.35);

      setTimeout(() => {
        try {
          const ctx2 = getAudioContext();

          if (!ctx2) return;

          const now2 = ctx2.currentTime;

          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();

          osc2.type = "sine";
          osc2.frequency.setValueAtTime(
            1046.5,
            now2
          );

          gain2.gain.setValueAtTime(
            0.0001,
            now2
          );

          gain2.gain.exponentialRampToValueAtTime(
            0.55,
            now2 + 0.03
          );

          gain2.gain.exponentialRampToValueAtTime(
            0.001,
            now2 + 0.55
          );

          osc2.connect(gain2);
          gain2.connect(ctx2.destination);

          osc2.start(now2);
          osc2.stop(now2 + 0.55);
        } catch (error) {
          console.error(error);
        }
      }, 180);
    } catch (error) {
      console.error("Audio error:", error);
    }
  };

  // =========================================================
  // 🔓 BROWSER AUDIO UNLOCK
  // =========================================================

  useEffect(() => {
    const unlockAudio = () => {
      try {
        const ctx = getAudioContext();

        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
      } catch {}
    };

    window.addEventListener(
      "click",
      unlockAudio
    );

    window.addEventListener(
      "touchstart",
      unlockAudio
    );

    window.addEventListener(
      "keydown",
      unlockAudio
    );

    return () => {
      window.removeEventListener(
        "click",
        unlockAudio
      );

      window.removeEventListener(
        "touchstart",
        unlockAudio
      );

      window.removeEventListener(
        "keydown",
        unlockAudio
      );
    };
  }, []);

  // =========================================================
  // 🌍 TEXT
  // =========================================================

  const TEXT = {
    uz: {
      queueTitle: "Oshxona navbati",

      activeOrders: "ta faol buyurtma",

      inQueue: "NAVBATDA",

      preparing: "Tayyorlanmoqda",

      readyBtn: "Tayyor",

      readyWaiting:
        "Tayyor — ofitsiant kutmoqda",

      empty:
        "Hozircha faol buyurtmalar yo‘q",

      emptyText:
        "Yangi buyurtma tushganda avtomatik paydo bo‘ladi.",

      logoutConfirmTitle:
        "Tizimdan chiqmoqchimisiz?",

      yes: "Ha",

      no: "Yo‘q",

      newOrder:
        "Yangi buyurtma tushdi!",

      readyMessage:
        "Taom tayyor! Ofitsiantga yuborildi.",

      langName: "O'zbekcha",

      minAgo: "daq. o'tdi",

      cafeName: "Karavan Kafe",

      allTaken:
        "Barcha taomlar olib ketildi ✅",
    },

    ru: {
      queueTitle: "Очередь кухни",

      activeOrders:
        "активных заказов",

      inQueue: "В ОЧЕРЕДИ",

      preparing: "Готовится",

      readyBtn: "Готово",

      readyWaiting:
        "Готово — ждёт официанта",

      empty:
        "Активных заказов пока нет",

      emptyText:
        "Новые заказы появятся автоматически.",

      logoutConfirmTitle:
        "Выйти из системы?",

      yes: "Да",

      no: "Нет",

      newOrder:
        "Новый заказ!",

      readyMessage:
        "Блюдо готово! Отправлено официанту.",

      langName: "Русский",

      minAgo: "мин. назад",

      cafeName: "Karavan Kafe",

      allTaken:
        "Все блюда забраны ✅",
    },
  };

  const t = TEXT[language] || TEXT.uz;

  const toggleLanguage = () => {
    const nextLang =
      language === "uz" ? "ru" : "uz";

    setLanguage(nextLang);

    localStorage.setItem(
      "appLang",
      nextLang
    );
  };

  // =========================================================
  // 🔥 FIRESTORE
  // =========================================================

  useEffect(() => {
    setLoading(true);

    const ordersRef = collection(
      db,
      "orders"
    );

    const unsubscribe = onSnapshot(
      ordersRef,
      (snapshot) => {
        try {
          const allOrders =
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            }));

          // =====================================================
          // FAQAT OSHXONADA HALI OLIB KETILMAGAN TAOMLAR
          // =====================================================

          const kitchenOrders =
            allOrders.filter((order) => {
              const rawItems =
                Array.isArray(
                  order.kitchenItems
                )
                  ? order.kitchenItems
                  : Array.isArray(
                      order.items
                    )
                  ? order.items
                  : Array.isArray(
                      order.products
                    )
                  ? order.products
                  : [];

              if (!rawItems.length) {
                return false;
              }

              // Faqat waiterTaken=false bo'lgan taomlar
              return rawItems.some(
                (item) =>
                  item.waiterTaken !== true
              );
            });

          // =====================================================
          // SORT
          // =====================================================

          const getTime = (order) => {
            if (
              order.createdAt?.seconds
            ) {
              return (
                order.createdAt.seconds *
                1000
              );
            }

            if (
              order.createdAt?.toDate
            ) {
              return order.createdAt
                .toDate()
                .getTime();
            }

            if (
              typeof order.createdAt ===
              "number"
            ) {
              return order.createdAt;
            }

            return Date.now();
          };

          kitchenOrders.sort(
            (a, b) =>
              getTime(a) - getTime(b)
          );

          // =====================================================
          // 🔊 YANGI BUYURTMA ANIQLASH
          // =====================================================

          const currentOrderIds =
            kitchenOrders.map(
              (order) => order.id
            );

          if (
            isInitialLoad.current
          ) {
            isInitialLoad.current = false;
          } else {
            const hasNewOrder =
              currentOrderIds.some(
                (id) =>
                  !previousOrderIdsRef.current.includes(
                    id
                  )
              );

            if (hasNewOrder) {
              toast.info(
                `🔔 ${t.newOrder}`,
                {
                  autoClose: 3000,
                }
              );

              // 🔊 avtomatik ovoz
              playKitchenSound();
            }
          }

          previousOrderIdsRef.current =
            currentOrderIds;

          // =====================================================
          // 🔊 YANGI TAYYOR BO'LGAN TAOMNI ANIQLASH
          // =====================================================

          const newItemStates = {};

          kitchenOrders.forEach(
            (order) => {
              const rawItems =
                Array.isArray(
                  order.kitchenItems
                )
                  ? order.kitchenItems
                  : Array.isArray(
                      order.items
                    )
                  ? order.items
                  : Array.isArray(
                      order.products
                    )
                  ? order.products
                  : [];

              rawItems.forEach(
                (item, index) => {
                  const key = `${order.id}_${index}`;

                  newItemStates[key] =
                    item.readyForWaiter ===
                    true;
                }
              );
            }
          );

          // =====================================================
          // STATE UPDATE
          // =====================================================

          previousItemStatesRef.current =
            newItemStates;

          setOrders(kitchenOrders);

          setLoading(false);
        } catch (error) {
          console.error(
            "Xatolik:",
            error
          );

          setLoading(false);
        }
      },
      (error) => {
        console.error(
          "❌ Firestore xatosi:",
          error
        );

        toast.error(
          "Buyurtmalarni yuklashda xatolik: " +
            error.message
        );

        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // =========================================================
  // 🪑 STOLLAR BO'YICHA GURUHLASH
  // =========================================================

  const groupedTables =
    Object.values(
      orders.reduce(
        (acc, order) => {
          const tableKey = String(
            order.tableNumber ??
              order.table ??
              order.tableNo ??
              "Noma'lum"
          );

          if (!acc[tableKey]) {
            acc[tableKey] = {
              tableNumber:
                tableKey,

              createdAt:
                order.createdAt,

              ordersList: [],
            };
          }

          acc[tableKey].ordersList.push(
            order
          );

          return acc;
        },
        {}
      )
    ).sort(
      (a, b) =>
        Number(a.tableNumber) -
        Number(b.tableNumber)
    );

  // =========================================================
  // 🍽️ OSHPAZ TAOMNI TAYYOR QILADI
  //
  // 1. readyForWaiter = true
  // 2. waiterTaken = false
  //
  // Taom OSHXONADA QOLADI.
  //
  // Ofitsiant "Yetkazildi" bosgandan keyin:
  //
  // waiterTaken = true
  //
  // Shundan keyin oshxonadan yo'qoladi.
  // =========================================================

  const handleItemReady = async (
    order,
    itemIndex
  ) => {
    try {
      let fieldName = "kitchenItems";

      let rawItems = [];

      if (
        Array.isArray(
          order.kitchenItems
        )
      ) {
        fieldName = "kitchenItems";

        rawItems = order.kitchenItems;
      } else if (
        Array.isArray(order.items)
      ) {
        fieldName = "items";

        rawItems = order.items;
      } else if (
        Array.isArray(order.products)
      ) {
        fieldName = "products";

        rawItems = order.products;
      }

      const updatedItems = [
        ...rawItems,
      ];

      const item =
        updatedItems[itemIndex];

      if (!item) {
        toast.error(
          "Taom topilmadi!"
        );

        return;
      }

      // =====================================================
      // ALLAQACHON TAYYOR BO'LSA QAYTA BOSILMAYDI
      // =====================================================

      if (
        item.readyForWaiter === true
      ) {
        toast.info(
          "Bu taom allaqachon tayyor."
        );

        return;
      }

      // =====================================================
      // 🔥 FAQAT BOSILGAN TAOM TAYYOR
      // =====================================================

      updatedItems[itemIndex] = {
        ...item,

        // Oshpaz tayyor qildi
        readyForWaiter: true,

        // Ofitsiant hali olib ketmadi
        waiterTaken: false,

        // Tayyor bo'lgan vaqt
        readyAt:
          new Date().toISOString(),
      };

      // =====================================================
      // BARCHA TAOMLAR TAYYORMI?
      // =====================================================

      const allReady =
        updatedItems.length > 0 &&
        updatedItems.every(
          (currentItem) =>
            currentItem.readyForWaiter ===
              true ||
            currentItem.waiterTaken ===
              true
        );

      // =====================================================
      // FIRESTORE UPDATE
      // =====================================================

      await updateDoc(
        doc(
          db,
          "orders",
          order.id
        ),
        {
          [fieldName]:
            updatedItems,

          // Barcha taom tayyor bo'lsa ready
          kitchenStatus: allReady
            ? "ready"
            : "preparing",

          status: allReady
            ? "ready"
            : "preparing",

          updatedAt:
            serverTimestamp(),
        }
      );

      // =====================================================
      // 🔊 OSHPAZ TAYYOR QILGANDA SIGNAL
      // =====================================================

      playKitchenSound();

      toast.success(
        `✅ ${
          item.name ||
          item.title ||
          item.productName ||
          "Taom"
        } ${t.readyMessage}`,
        {
          autoClose: 2000,
        }
      );
    } catch (error) {
      console.error(
        "❌ Taomni tayyor qilishda xatolik:",
        error
      );

      toast.error(
        "Taomni tayyor qilishda xatolik!"
      );
    }
  };

  // =========================================================
  // 🚪 LOGOUT
  // =========================================================

  const confirmLogout = async () => {
    try {
      await signOut(auth);

      navigate("/login");
    } catch (error) {
      toast.error(
        "Chiqishda xatolik!"
      );
    }
  };

  // =========================================================
  // ⏰ TIME
  // =========================================================

  const formatTime = (createdAt) => {
    try {
      if (
        createdAt?.toDate
      ) {
        return createdAt
          .toDate()
          .toLocaleTimeString(
            "uz-UZ",
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          );
      }

      if (
        createdAt?.seconds
      ) {
        return new Date(
          createdAt.seconds * 1000
        ).toLocaleTimeString(
          "uz-UZ",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );
      }

      if (
        typeof createdAt ===
        "number"
      ) {
        return new Date(
          createdAt
        ).toLocaleTimeString(
          "uz-UZ",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );
      }

      return "";
    } catch {
      return "";
    }
  };

  const getElapsedTime =
    (createdAt) => {
      if (!createdAt) {
        return `0 ${t.minAgo}`;
      }

      let timeMs = 0;

      if (
        createdAt.toDate
      ) {
        timeMs =
          createdAt
            .toDate()
            .getTime();
      } else if (
        createdAt.seconds
      ) {
        timeMs =
          createdAt.seconds *
          1000;
      } else if (
        typeof createdAt ===
        "number"
      ) {
        timeMs = createdAt;
      } else {
        return `0 ${t.minAgo}`;
      }

      const diffMinutes =
        Math.floor(
          (Date.now() -
            timeMs) /
            (1000 * 60)
        );

      return `${
        diffMinutes < 0
          ? 0
          : diffMinutes
      } ${t.minAgo}`;
    };

  const currentUser =
    auth.currentUser
      ?.displayName ||
    auth.currentUser
      ?.email?.split("@")[0] ||
    "oshpaz";

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f5ed",
        padding: "20px",
        fontFamily:
          "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >

        {/* NAVBAR */}

        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.03)",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                background: "#f59e0b",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "center",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "20px",
              }}
            >
              🏢
            </div>

            <span
              style={{
                fontSize: "18px",
                fontWeight: "800",
              }}
            >
              {t.cafeName}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >

            {/* OVOZ BUTTONI OLIB TASHLANDI */}

            <button
              onClick={toggleLanguage}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "20px",
                padding:
                  "8px 16px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              🌐 {t.langName}
            </button>

            <button
              onClick={() =>
                setShowLogoutModal(
                  true
                )
              }
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "20px",
                padding:
                  "8px 16px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              🍳 {currentUser}
            </button>
          </div>
        </div>

        {/* HEADER */}

        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding:
              "24px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            marginBottom: "24px",
          }}
        >
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "800",
              margin: 0,
            }}
          >
            {t.queueTitle}
          </h1>

          <div
            style={{
              background: "#e0f2fe",
              color: "#0369a1",
              padding:
                "10px 20px",
              borderRadius: "12px",
              fontWeight: "700",
            }}
          >
            {groupedTables.length}{" "}
            {t.activeOrders}
          </div>
        </div>

        {/* MAIN */}

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px",
              fontSize: "18px",
            }}
          >
            ⏳ Yuklanmoqda...
          </div>
        ) : groupedTables.length ===
          0 ? (
          <div
            style={{
              textAlign: "center",
              padding:
                "60px 20px",
              background:
                "#ffffff",
              borderRadius: "16px",
            }}
          >
            <h3
              style={{
                fontSize: "22px",
                fontWeight: "800",
              }}
            >
              {t.empty}
            </h3>

            <p
              style={{
                color: "#64748b",
              }}
            >
              {t.emptyText}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: "20px",
            }}
          >
            {groupedTables.map(
              (
                group,
                groupIndex
              ) => {

                const allItems = [];

                group.ordersList.forEach(
                  (order) => {
                    const rawItems =
                      Array.isArray(
                        order.kitchenItems
                      )
                        ? order.kitchenItems
                        : Array.isArray(
                            order.items
                          )
                        ? order.items
                        : Array.isArray(
                            order.products
                          )
                        ? order.products
                        : [];

                    rawItems.forEach(
                      (
                        item,
                        originalIndex
                      ) => {
                        allItems.push({
                          ...item,

                          originalIndex,

                          parentOrder:
                            order,
                        });
                      }
                    );
                  }
                );

                // =================================================
                // FAQAT OFITSIANT OLIB KETMAGAN TAOMLAR
                // =================================================

                const visibleItems =
                  allItems.filter(
                    (item) =>
                      item.waiterTaken !==
                      true
                  );

                return (
                  <div
                    key={
                      group.tableNumber
                    }
                    style={{
                      background:
                        "#ffffff",

                      borderRadius:
                        "20px",

                      border:
                        "2px solid #f59e0b",

                      padding:
                        "20px 24px",

                      boxShadow:
                        "0 4px 12px rgba(245,158,11,0.08)",
                    }}
                  >

                    {/* TABLE HEADER */}

                    <div
                      style={{
                        display:
                          "flex",

                        alignItems:
                          "center",

                        justifyContent:
                          "space-between",

                        marginBottom:
                          "18px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap: "12px",
                        }}
                      >
                        <span
                          style={{
                            background:
                              "#f97316",

                            color:
                              "#ffffff",

                            fontSize:
                              "12px",

                            fontWeight:
                              "800",

                            padding:
                              "6px 14px",

                            borderRadius:
                              "20px",
                          }}
                        >
                          {t.inQueue}{" "}
                          {groupIndex +
                            1}
                          -CHI
                        </span>

                        <span
                          style={{
                            fontSize:
                              "20px",

                            fontWeight:
                              "800",
                          }}
                        >
                          Stol №
                          {
                            group.tableNumber
                          }
                        </span>
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >
                        <span
                          style={{
                            background:
                              "#e0f2fe",

                            color:
                              "#2563eb",

                            padding:
                              "4px 12px",

                            borderRadius:
                              "12px",

                            fontSize:
                              "13px",

                            fontWeight:
                              "700",
                          }}
                        >
                          {t.preparing}
                        </span>

                        <div
                          style={{
                            fontSize:
                              "13px",

                            color:
                              "#64748b",

                            marginTop:
                              "4px",
                          }}
                        >
                          {formatTime(
                            group.createdAt
                          )}
                          {" • "}
                          {getElapsedTime(
                            group.createdAt
                          )}
                        </div>
                      </div>
                    </div>

                    {/* TAOMLAR */}

                    <div
                      style={{
                        display:
                          "flex",

                        flexDirection:
                          "column",

                        gap: "8px",
                      }}
                    >
                      {visibleItems.length ===
                      0 ? (
                        <div
                          style={{
                            padding:
                              "16px",

                            color:
                              "#64748b",

                            textAlign:
                              "center",

                            fontWeight:
                              "700",
                          }}
                        >
                          {t.allTaken}
                        </div>
                      ) : (
                        visibleItems.map(
                          (
                            item,
                            idx
                          ) => {

                            const isReady =
                              item.readyForWaiter ===
                              true;

                            return (
                              <div
                                key={`${item.parentOrder.id}-${item.originalIndex}-${idx}`}
                                style={{
                                  background:
                                    isReady
                                      ? "#f0fdf4"
                                      : "#f8fafc",

                                  border:
                                    isReady
                                      ? "1px solid #86efac"
                                      : "1px solid #e2e8f0",

                                  borderRadius:
                                    "12px",

                                  padding:
                                    "12px 18px",

                                  display:
                                    "flex",

                                  alignItems:
                                    "center",

                                  justifyContent:
                                    "space-between",
                                }}
                              >

                                <div>
                                  <div
                                    style={{
                                      fontWeight:
                                        "800",

                                      fontSize:
                                        "16px",
                                    }}
                                  >
                                    {item.name ||
                                      item.title ||
                                      item.productName ||
                                      "Taom"}
                                  </div>

                                  {isReady && (
                                    <div
                                      style={{
                                        marginTop:
                                          "3px",

                                        color:
                                          "#15803d",

                                        fontSize:
                                          "12px",

                                        fontWeight:
                                          "700",
                                      }}
                                    >
                                      🔔 Ofitsiant
                                      kutmoqda
                                    </div>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display:
                                      "flex",

                                    alignItems:
                                      "center",

                                    gap:
                                      "12px",
                                  }}
                                >

                                  {/* TAYYOR BUTTON */}

                                  <button
                                    type="button"
                                    disabled={
                                      isReady
                                    }
                                    onClick={() =>
                                      handleItemReady(
                                        item.parentOrder,
                                        item.originalIndex
                                      )
                                    }
                                    style={{
                                      background:
                                        isReady
                                          ? "#dcfce7"
                                          : "#e0f2fe",

                                      color:
                                        isReady
                                          ? "#15803d"
                                          : "#2563eb",

                                      border:
                                        isReady
                                          ? "1px solid #86efac"
                                          : "1px solid #bfdbfe",

                                      borderRadius:
                                        "10px",

                                      padding:
                                        "8px 16px",

                                      fontWeight:
                                        "800",

                                      fontSize:
                                        "14px",

                                      cursor:
                                        isReady
                                          ? "default"
                                          : "pointer",

                                      minWidth:
                                        "180px",
                                    }}
                                  >
                                    {isReady
                                      ? "✅ Tayyor — kutmoqda"
                                      : "👨‍🍳 Tayyor"}
                                  </button>

                                  <span
                                    style={{
                                      fontWeight:
                                        "800",

                                      fontSize:
                                        "16px",

                                      minWidth:
                                        "35px",

                                      textAlign:
                                        "right",
                                    }}
                                  >
                                    x
                                    {item.quantity ||
                                      item.count ||
                                      1}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        )
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* LOGOUT */}

        {showLogoutModal && (
          <div
            style={{
              position:
                "fixed",

              inset: 0,

              background:
                "rgba(15,23,42,0.4)",

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              zIndex: 1000,
            }}
            onClick={() =>
              setShowLogoutModal(
                false
              )
            }
          >
            <div
              style={{
                background:
                  "#fff",

                borderRadius:
                  "20px",

                padding:
                  "28px",

                maxWidth:
                  "380px",

                width: "90%",

                textAlign:
                  "center",
              }}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <h3
                style={{
                  fontSize:
                    "20px",

                  marginBottom:
                    "20px",
                }}
              >
                {
                  t.logoutConfirmTitle
                }
              </h3>

              <div
                style={{
                  display:
                    "flex",

                  gap: "12px",
                }}
              >
                <button
                  onClick={
                    confirmLogout
                  }
                  style={{
                    flex: 1,

                    padding:
                      "12px",

                    background:
                      "#ef4444",

                    color:
                      "#fff",

                    border:
                      "none",

                    borderRadius:
                      "10px",

                    fontWeight:
                      "700",
                  }}
                >
                  {t.yes}
                </button>

                <button
                  onClick={() =>
                    setShowLogoutModal(
                      false
                    )
                  }
                  style={{
                    flex: 1,

                    padding:
                      "12px",

                    background:
                      "#f1f5f9",

                    color:
                      "#475569",

                    border:
                      "none",

                    borderRadius:
                      "10px",

                    fontWeight:
                      "700",
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