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

  // =========================================================
  // STATE
  // =========================================================
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(
    localStorage.getItem("appLang") || "uz"
  );
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

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
  // LANGUAGE REF SYNC
  // =========================================================
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // =========================================================
  // TEXT TRANSLATIONS
  // =========================================================
  const TEXT = {
    uz: {
      title: "Oshxona Navbati",
      activeCount: "ta faol stol",
      inQueue: "NAVBATDA",
      readyBtn: "Tayyor",
      empty: "Hozircha faol buyurtmalar yo‘q",
      emptySub: "Yangi buyurtma tushganda avtomatik paydo bo‘ladi.",
      logoutTitle: "Tizimdan chiqishni tasdiqlaysizmi?",
      yes: "Ha",
      no: "Yo‘q",
      newOrder: "Yangi buyurtma tushdi!",
      readyMessage: "Taom tayyor! Ofitsiantga yuborildi.",
      langName: "O'zbekcha",
      minAgo: "daq. o'tdi",
      cafeName: "Karavan Kafe",
      allTaken: "Barcha taomlar olib ketildi ✅",
      soundOn: "Ovozni yoqish",
      soundOnSuccess: "🔊 Ovoz yoqildi!",
      soundOff: "Ovoz yoqilmagan",
      soundRequired: "Yangi buyurtma ovozini eshitish uchun ovozni yoqing.",
    },
    ru: {
      title: "Очередь Кухни",
      activeCount: "активных столов",
      inQueue: "В ОЧЕРЕДИ",
      readyBtn: "Готово",
      empty: "Активных заказов нет",
      emptySub: "Новые заказы появятся автоматически.",
      logoutTitle: "Вы действительно хотите выйти?",
      yes: "Да",
      no: "Нет",
      newOrder: "Новый заказ!",
      readyMessage: "Блюдо готово! Отправлено официанту.",
      langName: "Русский",
      minAgo: "мин. назад",
      cafeName: "Karavan Kafe",
      allTaken: "Все блюда забраны ✅",
      soundOn: "Включить звук",
      soundOnSuccess: "🔊 Звук включён!",
      soundOff: "Звук не включён",
      soundRequired: "Включите звук, чтобы слышать новые заказы.",
    },
  };

  const t = TEXT[language] || TEXT.uz;

  const toggleLanguage = () => {
    const nextLang = language === "uz" ? "ru" : "uz";
    setLanguage(nextLang);
    localStorage.setItem("appLang", nextLang);
  };

  // =========================================================
  // 🔊 WEB AUDIO CONTEXT ENGINE
  // =========================================================
  const getAudioContext = () => {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        console.error("Brauzer Web Audio API ni qo'llamaydi.");
        return null;
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }

      return audioCtxRef.current;
    } catch (error) {
      console.error("AudioContext yaratishda xatolik:", error);
      return null;
    }
  };

  const unlockAudio = async () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return false;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.00001, ctx.currentTime);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.01);

      audioEnabledRef.current = true;
      setAudioEnabled(true);
      return true;
    } catch (error) {
      console.error("Audio unlock xatosi:", error);
      return false;
    }
  };

  const enableAudio = async () => {
    const success = await unlockAudio();
    if (success) {
      toast.success(t.soundOnSuccess, { autoClose: 2000 });
      await playNewOrderSound();
    }
  };

  useEffect(() => {
    const handleInteraction = async () => {
      if (!audioEnabledRef.current) {
        await unlockAudio();
      }
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  // =========================================================
  // 🔊 AUDIO SOUND EFFECTS
  // =========================================================
  const playNewOrderSound = async () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const start = ctx.currentTime;

      const beep = (delay, frequency, duration, volume = 0.75) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start + delay);

        gain.gain.setValueAtTime(0.0001, start + delay);
        gain.gain.exponentialRampToValueAtTime(volume, start + delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start(start + delay);
        oscillator.stop(start + delay + duration + 0.05);
      };

      beep(0, 880, 0.3, 0.75);
      beep(0.35, 1100, 0.3, 0.8);
      beep(0.7, 880, 0.45, 0.75);
    } catch (error) {
      console.error("New order audio error:", error);
    }
  };

  const playReadySound = async () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const start = ctx.currentTime;

      const beep = (delay, frequency, duration) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, start + delay);

        gain.gain.setValueAtTime(0.0001, start + delay);
        gain.gain.exponentialRampToValueAtTime(0.6, start + delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start(start + delay);
        oscillator.stop(start + delay + duration + 0.05);
      };

      beep(0, 660, 0.25);
      beep(0.3, 880, 0.25);
      beep(0.6, 1100, 0.35);
    } catch (error) {
      console.error("Ready audio error:", error);
    }
  };

  // =========================================================
  // 🔔 NOTIFICATION QUEUE
  // =========================================================
  const showNextNotification = async () => {
    if (notificationPlayingRef.current || notificationQueueRef.current.length === 0) {
      return;
    }

    notificationPlayingRef.current = true;
    const notification = notificationQueueRef.current.shift();

    try {
      if (audioEnabledRef.current) {
        await playNewOrderSound();
      }

      toast.info(`🔔 Stol №${notification.tableNumber}: ${notification.message}`, {
        position: "top-center",
        autoClose: 4000,
        toastId: notification.id,
      });
    } catch (error) {
      console.error("Notification display error:", error);
    }

    setTimeout(() => {
      notificationPlayingRef.current = false;
      showNextNotification();
    }, 1800);
  };

  // =========================================================
  // 🔥 FIRESTORE REALTIME SYNC
  // =========================================================
  useEffect(() => {
    setLoading(true);
    const ordersRef = collection(db, "orders");

    const unsubscribe = onSnapshot(
      ordersRef,
      (snapshot) => {
        try {
          const allOrders = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));

          const kitchenOrders = allOrders.filter((order) => {
            const rawItems = Array.isArray(order.kitchenItems)
              ? order.kitchenItems
              : Array.isArray(order.items)
              ? order.items
              : Array.isArray(order.products)
              ? order.products
              : [];

            if (rawItems.length === 0) return false;

            return rawItems.some(
              (item) => item.readyForWaiter !== true && item.waiterTaken !== true
            );
          });

          const getTime = (order) => {
            if (order.createdAt?.seconds) return order.createdAt.seconds * 1000;
            if (order.createdAt?.toDate) return order.createdAt.toDate().getTime();
            if (typeof order.createdAt === "number") return order.createdAt;
            return Date.now();
          };

          kitchenOrders.sort((a, b) => getTime(a) - getTime(b));

          if (isInitialLoadRef.current) {
            kitchenOrders.forEach((order) => {
              previousOrdersRef.current.set(order.id, order);
            });
            isInitialLoadRef.current = false;
          } else {
            kitchenOrders.forEach((order) => {
              const oldOrder = previousOrdersRef.current.get(order.id);
              const tableNumber =
                order.tableNumber ?? order.table ?? order.tableNo ?? "—";

              if (!oldOrder) {
                notificationQueueRef.current.push({
                  id: `new-order-${order.id}`,
                  tableNumber,
                  message:
                    languageRef.current === "ru"
                      ? "Новый заказ!"
                      : "Yangi buyurtma tushdi!",
                });
                showNextNotification();
              } else {
                const getItems = (o) =>
                  o.kitchenItems || o.items || o.products || [];
                const oldItems = getItems(oldOrder);
                const newItems = getItems(order);

                if (newItems.length > oldItems.length) {
                  notificationQueueRef.current.push({
                    id: `new-item-${order.id}-${newItems.length}-${Date.now()}`,
                    tableNumber,
                    message:
                      languageRef.current === "ru"
                        ? "Добавлено новое блюдо!"
                        : "Yangi taom qo'shildi!",
                  });
                  showNextNotification();
                }
              }

              previousOrdersRef.current.set(order.id, order);
            });
          }

          setOrders(kitchenOrders);
          setLoading(false);
        } catch (error) {
          console.error("Firestore parsing error:", error);
          setLoading(false);
        }
      },
      (error) => {
        console.error("Firestore listener error:", error);
        toast.error("Baza bilan aloqa uzildi: " + error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================================================
  // 🍽️ TAOMNI TAYYOR DEB BELGILASH
  // =========================================================
  const handleItemReady = async (order, itemIndex) => {
    try {
      let fieldName = "kitchenItems";
      if (Array.isArray(order.kitchenItems)) fieldName = "kitchenItems";
      else if (Array.isArray(order.items)) fieldName = "items";
      else if (Array.isArray(order.products)) fieldName = "products";

      const rawItems = order[fieldName] || [];
      const updatedItems = [...rawItems];
      const item = updatedItems[itemIndex];

      if (!item) {
        toast.error("Taom ma'lumotlari topilmadi!");
        return;
      }

      if (item.readyForWaiter === true) {
        toast.info("Bu taom allaqachon tayyor.");
        return;
      }

      updatedItems[itemIndex] = {
        ...item,
        readyForWaiter: true,
        waiterTaken: false,
        readyAt: new Date().toISOString(),
      };

      const allReady =
        updatedItems.length > 0 &&
        updatedItems.every(
          (curr) => curr.readyForWaiter === true || curr.waiterTaken === true
        );

      await updateDoc(doc(db, "orders", order.id), {
        [fieldName]: updatedItems,
        kitchenStatus: allReady ? "ready" : "preparing",
        status: allReady ? "ready" : "preparing",
        updatedAt: serverTimestamp(),
      });

      if (audioEnabledRef.current) {
        await playReadySound();
      }

      toast.success(
        `✅ ${item.name || item.title || item.productName || "Taom"} ${t.readyMessage}`,
        { autoClose: 2500 }
      );
    } catch (error) {
      console.error("Taomni tayyor qilishda xatolik:", error);
      toast.error("Xatolik yuz berdi!");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Chiqishda xatolik!");
    }
  };

  // =========================================================
  // RENDER UI
  // =========================================================
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-amber-500">{t.title}</h1>
          <p className="text-sm text-gray-400">{t.cafeName}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={enableAudio}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              audioEnabled
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
            }`}
          >
            {audioEnabled ? `🔊 ${t.soundOn}` : `🔇 ${t.soundOff}`}
          </button>

          <button
            onClick={toggleLanguage}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
          >
            🌐 {t.langName}
          </button>

          <button
            onClick={() => setShowLogoutModal(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
          >
            🚪 Chiqish
          </button>
        </div>
      </header>

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center items-center py-20 text-amber-500">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-gray-800/50 rounded-2xl border border-gray-800">
          <p className="text-xl font-semibold text-gray-300">{t.empty}</p>
          <p className="text-sm text-gray-500 mt-2">{t.emptySub}</p>
        </div>
      ) : (
        /* Orders Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => {
            const tableNo =
              order.tableNumber ?? order.table ?? order.tableNo ?? "—";
            const items =
              order.kitchenItems || order.items || order.products || [];

            return (
              <div
                key={order.id}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
                    <span className="text-lg font-bold text-amber-400">
                      Stol №{tableNo}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                      {t.inQueue}
                    </span>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {items.map((item, idx) => {
                      const isReady = item.readyForWaiter === true;
                      if (item.waiterTaken === true) return null;

                      return (
                        <li
                          key={idx}
                          className="flex justify-between items-center bg-gray-900/60 p-2.5 rounded-lg border border-gray-700/50"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-200">
                              {item.name || item.title || item.productName || "Taom"}
                            </p>
                            <span className="text-xs text-amber-500 font-bold">
                              x{item.quantity || item.count || 1}
                            </span>
                          </div>

                          <button
                            disabled={isReady}
                            onClick={() => handleItemReady(order, idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              isReady
                                ? "bg-emerald-600/20 text-emerald-400 cursor-not-allowed border border-emerald-500/30"
                                : "bg-amber-500 hover:bg-amber-600 text-gray-950 shadow-md"
                            }`}
                          >
                            {isReady ? "✓ Tayyor" : t.readyBtn}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl">
            <p className="text-lg font-semibold text-gray-200 mb-6">
              {t.logoutTitle}
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleLogout}
                className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition"
              >
                {t.yes}
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-5 py-2 rounded-xl text-sm font-semibold transition"
              >
                {t.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenQueue;