import React, {
  useEffect,
  useRef,
  useState,
} from "react";

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

  // =========================================================
  // STATE
  // =========================================================

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [language, setLanguage] = useState(
    localStorage.getItem("appLang") || "uz"
  );

  const [showLogoutModal, setShowLogoutModal] =
    useState(false);

  const [audioEnabled, setAudioEnabled] =
    useState(false);


  // =========================================================
  // REFS
  // =========================================================

  const audioCtxRef = useRef(null);

  const audioEnabledRef = useRef(false);

  const previousOrdersRef = useRef(new Map());

  const previousItemsRef = useRef(new Map());

  const isInitialLoadRef = useRef(true);

  const notificationQueueRef = useRef([]);

  const notificationPlayingRef = useRef(false);

  const languageRef = useRef(language);


  // =========================================================
  // LANGUAGE REF
  // =========================================================

  useEffect(() => {
    languageRef.current = language;
  }, [language]);


  // =========================================================
  // TEXT
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

      soundOn:
        "Ovozni yoqish",

      soundOnSuccess:
        "🔊 Ovoz yoqildi!",

      soundOff:
        "Ovoz yoqilmagan",

      soundRequired:
        "Yangi buyurtma ovozini eshitish uchun ovozni yoqing.",
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

      soundOn:
        "Включить звук",

      soundOnSuccess:
        "🔊 Звук включён!",

      soundOff:
        "Звук не включён",

      soundRequired:
        "Включите звук, чтобы слышать новые заказы.",
    },
  };


  const t =
    TEXT[language] || TEXT.uz;


  // =========================================================
  // AUDIO CONTEXT
  // =========================================================

  const getAudioContext = () => {
    try {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) {
        console.error(
          "Brauzer Web Audio API ni qo'llamaydi."
        );

        return null;
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current =
          new AudioContext();
      }

      return audioCtxRef.current;
    } catch (error) {
      console.error(
        "AudioContext yaratishda xatolik:",
        error
      );

      return null;
    }
  };


  // =========================================================
  // 🔊 AUDIO UNLOCK
  // =========================================================

  const unlockAudio = async () => {
    try {
      const ctx =
        getAudioContext();

      if (!ctx) {
        toast.error(
          "Brauzer audio funksiyasini qo'llamaydi."
        );

        return false;
      }

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      /*
       * MUHIM:
       * AudioContext ishlayotganini tekshirish uchun
       * juda qisqa, deyarli eshitilmaydigan signal.
       */

      const oscillator =
        ctx.createOscillator();

      const gain =
        ctx.createGain();

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(
        440,
        ctx.currentTime
      );

      gain.gain.setValueAtTime(
        0.00001,
        ctx.currentTime
      );

      oscillator.connect(gain);

      gain.connect(ctx.destination);

      oscillator.start();

      oscillator.stop(
        ctx.currentTime + 0.01
      );

      audioEnabledRef.current =
        true;

      setAudioEnabled(true);

      return true;
    } catch (error) {
      console.error(
        "Audio unlock xatosi:",
        error
      );

      return false;
    }
  };


  // =========================================================
  // 🔊 OVOZNI YOQISH BUTTON
  // =========================================================

  const enableAudio = async () => {
    const success =
      await unlockAudio();

    if (success) {
      toast.success(
        t.soundOnSuccess,
        {
          autoClose: 2000,
        }
      );

      /*
       * Ovoz ishlayotganini tekshirish
       */
      await playNewOrderSound();
    }
  };


  // =========================================================
  // BROWSER INTERACTION
  // =========================================================

  useEffect(() => {
    const handleInteraction =
      async () => {
        if (
          !audioEnabledRef.current
        ) {
          await unlockAudio();
        }
      };

    window.addEventListener(
      "click",
      handleInteraction
    );

    window.addEventListener(
      "touchstart",
      handleInteraction
    );

    window.addEventListener(
      "keydown",
      handleInteraction
    );

    return () => {
      window.removeEventListener(
        "click",
        handleInteraction
      );

      window.removeEventListener(
        "touchstart",
        handleInteraction
      );

      window.removeEventListener(
        "keydown",
        handleInteraction
      );
    };
  }, []);


  // =========================================================
  // 🔊 NEW ORDER SOUND
  // =========================================================

  const playNewOrderSound =
    async () => {
      try {
        const ctx =
          getAudioContext();

        if (!ctx) return;

        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const start =
          ctx.currentTime;

        /*
         * 1-signal
         */
        const beep = (
          delay,
          frequency,
          duration,
          volume = 0.7
        ) => {
          const oscillator =
            ctx.createOscillator();

          const gain =
            ctx.createGain();

          oscillator.type =
            "sine";

          oscillator.frequency.setValueAtTime(
            frequency,
            start + delay
          );

          gain.gain.setValueAtTime(
            0.0001,
            start + delay
          );

          gain.gain.exponentialRampToValueAtTime(
            volume,
            start + delay + 0.03
          );

          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            start +
              delay +
              duration
          );

          oscillator.connect(gain);

          gain.connect(
            ctx.destination
          );

          oscillator.start(
            start + delay
          );

          oscillator.stop(
            start +
              delay +
              duration +
              0.05
          );
        };


        /*
         * Kuchliroq 3 signal
         */

        beep(
          0,
          880,
          0.3,
          0.75
        );

        beep(
          0.35,
          1100,
          0.3,
          0.8
        );

        beep(
          0.7,
          880,
          0.45,
          0.75
        );

      } catch (error) {
        console.error(
          "New order audio error:",
          error
        );
      }
    };


  // =========================================================
  // 🔔 READY SOUND
  // =========================================================

  const playReadySound =
    async () => {
      try {
        const ctx =
          getAudioContext();

        if (!ctx) return;

        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const start =
          ctx.currentTime;

        const beep = (
          delay,
          frequency,
          duration
        ) => {
          const oscillator =
            ctx.createOscillator();

          const gain =
            ctx.createGain();

          oscillator.type =
            "triangle";

          oscillator.frequency.setValueAtTime(
            frequency,
            start + delay
          );

          gain.gain.setValueAtTime(
            0.0001,
            start + delay
          );

          gain.gain.exponentialRampToValueAtTime(
            0.6,
            start +
              delay +
              0.03
          );

          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            start +
              delay +
              duration
          );

          oscillator.connect(gain);

          gain.connect(
            ctx.destination
          );

          oscillator.start(
            start + delay
          );

          oscillator.stop(
            start +
              delay +
              duration +
              0.05
          );
        };


        beep(
          0,
          660,
          0.25
        );

        beep(
          0.3,
          880,
          0.25
        );

        beep(
          0.6,
          1100,
          0.35
        );

      } catch (error) {
        console.error(
          "Ready audio error:",
          error
        );
      }
    };


  // =========================================================
  // 🔔 NOTIFICATION QUEUE
  // =========================================================

  const showNextNotification =
    async () => {
      if (
        notificationPlayingRef.current
      ) {
        return;
      }

      if (
        notificationQueueRef.current
          .length === 0
      ) {
        return;
      }

      notificationPlayingRef.current =
        true;

      const notification =
        notificationQueueRef.current.shift();

      try {
        if (
          audioEnabledRef.current
        ) {
          await playNewOrderSound();
        }

        toast.info(
          `🔔 Stol №${notification.tableNumber}: ${notification.message}`,
          {
            position:
              "top-center",

            autoClose: 4000,

            toastId:
              notification.id,
          }
        );
      } catch (error) {
        console.error(
          error
        );
      }

      setTimeout(() => {
        notificationPlayingRef.current =
          false;

        showNextNotification();
      }, 1800);
    };


  // =========================================================
  // 🔥 FIRESTORE LISTENER
  // =========================================================

  useEffect(() => {
    setLoading(true);

    const ordersRef =
      collection(
        db,
        "orders"
      );

    const unsubscribe =
      onSnapshot(
        ordersRef,
        (snapshot) => {
          try {
            const allOrders =
              snapshot.docs.map(
                (item) => ({
                  id: item.id,
                  ...item.data(),
                })
              );


            // =================================================
            // ACTIVE KITCHEN ORDERS
            // =================================================

            const kitchenOrders =
              allOrders.filter(
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


                  if (
                    rawItems.length ===
                    0
                  ) {
                    return false;
                  }


                  /*
                   * Oshxonada hali qolgan
                   * taom bo'lsa order ko'rinadi.
                   */

                  return rawItems.some(
                    (item) =>
                      item.waiterTaken !==
                      true
                  );
                }
              );


            // =================================================
            // SORT
            // =================================================

            const getTime =
              (order) => {
                if (
                  order.createdAt
                    ?.seconds
                ) {
                  return (
                    order.createdAt
                      .seconds * 1000
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
                getTime(a) -
                getTime(b)
            );


            // =================================================
            // 🔔 NEW ORDER DETECTION
            // =================================================

            const currentOrdersMap =
              new Map();

            kitchenOrders.forEach(
              (order) => {
                currentOrdersMap.set(
                  order.id,
                  order
                );
              }
            );


            /*
             * Birinchi Firestore load'da
             * ovoz CHIQARMAYDI.
             */

            if (
              isInitialLoadRef.current
            ) {
              kitchenOrders.forEach(
                (order) => {
                  previousOrdersRef.current.set(
                    order.id,
                    order
                  );
                }
              );

              isInitialLoadRef.current =
                false;
            } else {

              kitchenOrders.forEach(
                (order) => {
                  const oldOrder =
                    previousOrdersRef.current.get(
                      order.id
                    );


                  /*
                   * 1. Yangi order
                   */

                  if (!oldOrder) {
                    const tableNumber =
                      order.tableNumber ??
                      order.table ??
                      order.tableNo ??
                      "—";


                    notificationQueueRef.current.push(
                      {
                        id:
                          `new-order-${order.id}`,

                        tableNumber,

                        message:
                          languageRef.current ===
                          "ru"
                            ? "Новый заказ!"
                            : "Yangi buyurtma tushdi!",
                      }
                    );

                    showNextNotification();
                  }


                  /*
                   * 2. Yangi item qo'shilgan
                   *
                   * Agar mavjud orderga
                   * ofitsiant yana taom qo'shsa
                   * ham signal beradi.
                   */

                  if (oldOrder) {
                    const oldItems =
                      Array.isArray(
                        oldOrder.kitchenItems
                      )
                        ? oldOrder.kitchenItems
                        : Array.isArray(
                            oldOrder.items
                          )
                        ? oldOrder.items
                        : Array.isArray(
                            oldOrder.products
                          )
                        ? oldOrder.products
                        : [];


                    const newItems =
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


                    if (
                      newItems.length >
                      oldItems.length
                    ) {
                      const tableNumber =
                        order.tableNumber ??
                        order.table ??
                        order.tableNo ??
                        "—";


                      notificationQueueRef.current.push(
                        {
                          id:
                            `new-item-${order.id}-${newItems.length}-${Date.now()}`,

                          tableNumber,

                          message:
                            languageRef.current ===
                            "ru"
                              ? "Добавлено новое блюдо!"
                              : "Yangi taom qo'shildi!",
                        }
                      );

                      showNextNotification();
                    }
                  }


                  previousOrdersRef.current.set(
                    order.id,
                    order
                  );
                }
              );
            }


            // =================================================
            // 🔔 READY ITEM DETECTION
            // =================================================

            const currentItemsMap =
              new Map();


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
                  (
                    item,
                    index
                  ) => {
                    const key =
                      `${order.id}_${index}`;


                    currentItemsMap.set(
                      key,
                      item.readyForWaiter ===
                        true
                    );


                    const oldReady =
                      previousItemsRef.current.get(
                        key
                      ) === true;


                    const newReady =
                      item.readyForWaiter ===
                      true;


                    /*
                     * Bu yerda ready sound
                     * faqat yangi false -> true
                     */

                    if (
                      !isInitialLoadRef.current &&
                      !oldReady &&
                      newReady
                    ) {
                      /*
                       * Kitchen o'zi tayyor qilgan
                       * item uchun ofitsiantga
                       * signal.
                       */

                      if (
                        audioEnabledRef.current
                      ) {
                        playReadySound();
                      }


                      toast.success(
                        `✅ ${
                          item.name ||
                          item.title ||
                          item.productName ||
                          "Taom"
                        } ${
                          languageRef.current ===
                          "ru"
                            ? "готово!"
                            : "tayyor!"
                        }`,
                        {
                          autoClose: 2500,
                        }
                      );
                    }
                  }
                );
              }
            );


            previousItemsRef.current =
              currentItemsMap;


            // =================================================
            // STATE
            // =================================================

            setOrders(
              kitchenOrders
            );

            setLoading(false);

          } catch (error) {
            console.error(
              "Firestore data error:",
              error
            );

            setLoading(false);

            toast.error(
              "Buyurtmalarni yuklashda xatolik!"
            );
          }
        },

        (error) => {
          console.error(
            "Firestore listener error:",
            error
          );

          toast.error(
            "Buyurtmalarni kuzatishda xatolik: " +
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
  // GROUP TABLES
  // =========================================================

  const groupedTables =
    Object.values(
      orders.reduce(
        (acc, order) => {
          const tableKey =
            String(
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


          acc[
            tableKey
          ].ordersList.push(
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
  // HANDLE ITEM READY
  // =========================================================

  const handleItemReady = async (
    order,
    itemIndex
  ) => {
    try {
      let fieldName =
        "kitchenItems";

      let rawItems = [];


      if (
        Array.isArray(
          order.kitchenItems
        )
      ) {
        fieldName =
          "kitchenItems";

        rawItems =
          order.kitchenItems;
      } else if (
        Array.isArray(
          order.items
        )
      ) {
        fieldName =
          "items";

        rawItems =
          order.items;
      } else if (
        Array.isArray(
          order.products
        )
      ) {
        fieldName =
          "products";

        rawItems =
          order.products;
      }


      const updatedItems =
        [...rawItems];


      const item =
        updatedItems[itemIndex];


      if (!item) {
        toast.error(
          "Taom topilmadi!"
        );

        return;
      }


      if (
        item.readyForWaiter ===
        true
      ) {
        toast.info(
          "Bu taom allaqachon tayyor."
        );

        return;
      }


      // =====================================================
      // READY
      // =====================================================

      updatedItems[
        itemIndex
      ] = {
        ...item,

        readyForWaiter: true,

        waiterTaken: false,

        readyAt:
          new Date().toISOString(),
      };


      // =====================================================
      // ALL READY
      // =====================================================

      const allReady =
        updatedItems.length >
          0 &&
        updatedItems.every(
          (currentItem) =>
            currentItem.readyForWaiter ===
              true ||
            currentItem.waiterTaken ===
              true
        );


      // =====================================================
      // FIRESTORE
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

          kitchenStatus:
            allReady
              ? "ready"
              : "preparing",

          status:
            allReady
              ? "ready"
              : "preparing",

          updatedAt:
            serverTimestamp(),
        }
      );


      // =====================================================
      // LOCAL SOUND
      // =====================================================

      if (
        audioEnabledRef.current
      ) {
        await playReadySound();
      }


      toast.success(
        `✅ ${
          item.name ||
          item.title ||
          item.productName ||
          "Taom"
        } ${
          t.readyMessage
        }`,
        {
          autoClose: 2500,
        }
      );

    } catch (error) {
      console.error(
        "Taomni tayyor qilishda xatolik:",
        error
      );

      toast.error(
        "Taomni tayyor qilishda xatolik!"
      );
    }
  };


  // =========================================================
  // LOGOUT
  // =========================================================

  const confirmLogout =
    async () => {
      try {
        await signOut(auth);

        navigate(
          "/login"
        );
      } catch (error) {
        console.error(
          error
        );

        toast.error(
          "Chiqishda xatolik!"
        );
      }
    };


  // =========================================================
  // TIME
  // =========================================================

  const formatTime =
    (createdAt) => {
      try {
        if (
          createdAt?.toDate
        ) {
          return createdAt
            .toDate()
            .toLocaleTimeString(
              "uz-UZ",
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit",
              }
            );
        }


        if (
          createdAt?.seconds
        ) {
          return new Date(
            createdAt.seconds *
              1000
          ).toLocaleTimeString(
            "uz-UZ",
            {
              hour:
                "2-digit",

              minute:
                "2-digit",
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
              hour:
                "2-digit",

              minute:
                "2-digit",
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
        timeMs =
          createdAt;
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


  // =========================================================
  // USER
  // =========================================================

  const currentUser =
    auth.currentUser
      ?.displayName ||
    auth.currentUser
      ?.email
      ?.split("@")[0] ||
    "oshpaz";


  // =========================================================
  // LANGUAGE
  // =========================================================

  const toggleLanguage =
    () => {
      const nextLang =
        language === "uz"
          ? "ru"
          : "uz";


      setLanguage(
        nextLang
      );


      localStorage.setItem(
        "appLang",
        nextLang
      );
    };


  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      style={{
        minHeight:
          "100vh",

        background:
          "#f7f5ed",

        padding:
          "20px",

        fontFamily:
          "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",

        color:
          "#0f172a",
      }}
    >

      <div
        style={{
          maxWidth:
            "1200px",

          margin:
            "0 auto",
        }}
      >

        {/* ===================================================
            NAVBAR
        =================================================== */}

        <div
          style={{
            background:
              "#ffffff",

            borderRadius:
              "16px",

            padding:
              "12px 20px",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            boxShadow:
              "0 2px 8px rgba(0,0,0,0.03)",

            marginBottom:
              "24px",
          }}
        >

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

            <div
              style={{
                width:
                  "42px",

                height:
                  "42px",

                background:
                  "#f59e0b",

                borderRadius:
                  "10px",

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                color:
                  "#fff",

                fontWeight:
                  "bold",

                fontSize:
                  "20px",
              }}
            >
              🍳
            </div>


            <span
              style={{
                fontSize:
                  "18px",

                fontWeight:
                  "800",
              }}
            >
              {t.cafeName}
            </span>

          </div>


          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "10px",

              flexWrap:
                "wrap",

              justifyContent:
                "flex-end",
            }}
          >

            {/* =================================================
                AUDIO BUTTON
            ================================================= */}

            <button
              onClick={
                enableAudio
              }
              style={{
                background:
                  audioEnabled
                    ? "#dcfce7"
                    : "#fee2e2",

                color:
                  audioEnabled
                    ? "#15803d"
                    : "#dc2626",

                border:
                  audioEnabled
                    ? "1px solid #86efac"
                    : "1px solid #fca5a5",

                borderRadius:
                  "20px",

                padding:
                  "8px 14px",

                fontSize:
                  "13px",

                fontWeight:
                  "800",

                cursor:
                  "pointer",
              }}
            >
              {audioEnabled
                ? "🔊 Ovoz yoqilgan"
                : `🔇 ${t.soundOn}`}
            </button>


            {/* LANGUAGE */}

            <button
              onClick={
                toggleLanguage
              }
              style={{
                background:
                  "#f1f5f9",

                border:
                  "none",

                borderRadius:
                  "20px",

                padding:
                  "8px 16px",

                fontSize:
                  "14px",

                fontWeight:
                  "600",

                cursor:
                  "pointer",
              }}
            >
              🌐 {t.langName}
            </button>


            {/* USER */}

            <button
              onClick={() =>
                setShowLogoutModal(
                  true
                )
              }
              style={{
                background:
                  "#f1f5f9",

                border:
                  "none",

                borderRadius:
                  "20px",

                padding:
                  "8px 16px",

                fontSize:
                  "14px",

                fontWeight:
                  "600",

                cursor:
                  "pointer",
              }}
            >
              🍳 {currentUser}
            </button>

          </div>
        </div>


        {/* ===================================================
            AUDIO WARNING
        =================================================== */}

        {!audioEnabled && (
          <div
            style={{
              background:
                "#fff7ed",

              border:
                "1px solid #fdba74",

              color:
                "#9a3412",

              borderRadius:
                "14px",

              padding:
                "12px 16px",

              marginBottom:
                "20px",

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "space-between",

              gap:
                "12px",

              flexWrap:
                "wrap",
            }}
          >

            <span
              style={{
                fontWeight:
                  "700",

                fontSize:
                  "14px",
              }}
            >
              🔇 {t.soundRequired}
            </span>


            <button
              onClick={
                enableAudio
              }
              style={{
                background:
                  "#ea580c",

                color:
                  "#fff",

                border:
                  "none",

                borderRadius:
                  "10px",

                padding:
                  "9px 16px",

                fontWeight:
                  "800",

                cursor:
                  "pointer",
              }}
            >
              🔊 {t.soundOn}
            </button>

          </div>
        )}


        {/* ===================================================
            HEADER
        =================================================== */}

        <div
          style={{
            background:
              "#ffffff",

            borderRadius:
              "16px",

            padding:
              "24px 32px",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            marginBottom:
              "24px",

            gap:
              "15px",

            flexWrap:
              "wrap",
          }}
        >

          <h1
            style={{
              fontSize:
                "28px",

              fontWeight:
                "800",

              margin:
                0,
            }}
          >
            {t.queueTitle}
          </h1>


          <div
            style={{
              background:
                "#e0f2fe",

              color:
                "#0369a1",

              padding:
                "10px 20px",

              borderRadius:
                "12px",

              fontWeight:
                "700",
            }}
          >
            {groupedTables.length}{" "}
            {t.activeOrders}
          </div>

        </div>


        {/* ===================================================
            MAIN
        =================================================== */}

        {loading ? (

          <div
            style={{
              textAlign:
                "center",

              padding:
                "60px",

              fontSize:
                "18px",
            }}
          >
            ⏳ Yuklanmoqda...
          </div>

        ) : groupedTables.length ===
          0 ? (

          <div
            style={{
              textAlign:
                "center",

              padding:
                "60px 20px",

              background:
                "#ffffff",

              borderRadius:
                "16px",
            }}
          >

            <h3
              style={{
                fontSize:
                  "22px",

                fontWeight:
                  "800",
              }}
            >
              {t.empty}
            </h3>


            <p
              style={{
                color:
                  "#64748b",
              }}
            >
              {t.emptyText}
            </p>

          </div>

        ) : (

          <div
            style={{
              display:
                "flex",

              flexDirection:
                "column",

              gap:
                "20px",
            }}
          >

            {groupedTables.map(
              (
                group,
                groupIndex
              ) => {

                const allItems =
                  [];


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

                        gap:
                          "10px",

                        flexWrap:
                          "wrap",
                      }}
                    >

                      <div
                        style={{
                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap:
                            "12px",

                          flexWrap:
                            "wrap",
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
                          Stol №{" "}
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


                    {/* ITEMS */}

                    <div
                      style={{
                        display:
                          "flex",

                        flexDirection:
                          "column",

                        gap:
                          "8px",
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

                                  gap:
                                    "15px",

                                  flexWrap:
                                    "wrap",
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
                                    {
                                      item.name ||
                                      item.title ||
                                      item.productName ||
                                      "Taom"
                                    }
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

                                  {/* READY */}

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


                                  {/* QUANTITY */}

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


        {/* ===================================================
            LOGOUT MODAL
        =================================================== */}

        {showLogoutModal && (

          <div
            style={{
              position:
                "fixed",

              inset:
                0,

              background:
                "rgba(15,23,42,0.4)",

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              zIndex:
                1000,

              padding:
                "20px",
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

                width:
                  "90%",

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

                  gap:
                    "12px",
                }}
              >

                <button
                  onClick={
                    confirmLogout
                  }
                  style={{
                    flex:
                      1,

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

                    cursor:
                      "pointer",
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
                    flex:
                      1,

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

                    cursor:
                      "pointer",
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