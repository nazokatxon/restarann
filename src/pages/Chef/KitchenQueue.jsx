import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "uz", label: "O'zbekcha", flag: "🇺🇿" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const TEXT = {
  uz: {
    kitchen: "Oshxona",
    orders: "Buyurtmalar",
    newOrder: "Yangi buyurtma keldi!",
    newOrderFrom: (table) => `Stol #${table} dan yangi buyurtma`,
    logout: "Chiqish",
    orderTime: "Buyurtma vaqti",
    pending: "Kutilmoqda",
    preparing: "Tayyorlanmoqda",
    ready: "Tayyor",
    delivered: "Yetkazildi",
    noOrders: "Hozircha faol buyurtmalar yo'q",
    autoAppear:
      "Yangi buyurtma tushganda avtomatik ravishda shu yerda paydo bo'ladi.",
    activateAudio:
      "Ovoz signalini yoqish uchun ekranga bir marta bosing",
    allDone: "Barcha taomlar yetkazildi",
    portion: "porsiya",
    note: "Izoh",
    new: "Yangi",
    min: "min",
    confirmLogout: "Tizimdan chiqishni tasdiqlaysizmi?",
    cancel: "Bekor qilish",
  },

  ru: {
    kitchen: "Кухня",
    orders: "Заказы",
    newOrder: "Новый заказ!",
    newOrderFrom: (table) => `Новый заказ со стола #${table}`,
    logout: "Выйти",
    orderTime: "Время заказа",
    pending: "Ожидает",
    preparing: "Готовится",
    ready: "Готово",
    delivered: "Доставлено",
    noOrders: "Активных заказов пока нет",
    autoAppear: "Новый заказ появится здесь автоматически.",
    activateAudio:
      "Нажмите на экран один раз, чтобы включить звуковой сигнал",
    allDone: "Все блюда доставлены",
    portion: "порция",
    note: "Комментарий",
    new: "Новый",
    min: "мин",
    confirmLogout: "Вы уверены, что хотите выйти?",
    cancel: "Отмена",
  },

  en: {
    kitchen: "Kitchen",
    orders: "Orders",
    newOrder: "New order received!",
    newOrderFrom: (table) => `New order from table #${table}`,
    logout: "Log out",
    orderTime: "Order time",
    pending: "Waiting",
    preparing: "Preparing",
    ready: "Ready",
    delivered: "Delivered",
    noOrders: "No active orders yet",
    autoAppear: "A new order will appear here automatically.",
    activateAudio: "Click the screen once to enable the sound alert",
    allDone: "All dishes delivered",
    portion: "portion",
    note: "Note",
    new: "New",
    min: "min",
    confirmLogout: "Are you sure you want to log out?",
    cancel: "Cancel",
  },
};

export default function KitchenQueue() {
  const { t, i18n } = useTranslation();
  const { cafeId } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [language, setLanguage] = useState(
    () => localStorage.getItem("appLang") || "uz"
  );

  const kitchenAudioCtxRef = useRef(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const isInitialLoad = useRef(true);
  const [, setTick] = useState(0);

  const tr = TEXT[language] || TEXT.uz;

  const changeLanguage = (code) => {
    setLanguage(code);
    localStorage.setItem("appLang", code);
    i18n.changeLanguage(code);
    setLanguageOpen(false);
  };

  const playKitchenVibeSound = async () => {
    try {
      if (!kitchenAudioCtxRef.current) {
        const AudioContext =
          window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          kitchenAudioCtxRef.current = new AudioContext();
        }
      }

      const ctx = kitchenAudioCtxRef.current;
      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      [660, 880, 660, 990].forEach((frequency, i) => {
        const start = now + i * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.32, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.17);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch (e) {
      console.log("Audio error:", e);
    }
  };

  useEffect(() => {
    const unlockKitchenAudio = () => {
      if (!kitchenAudioCtxRef.current) {
        const AudioContext =
          window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          kitchenAudioCtxRef.current = new AudioContext();
        }
      }

      if (kitchenAudioCtxRef.current?.state === "suspended") {
        kitchenAudioCtxRef.current
          .resume()
          .then(() => setAudioUnlocked(true));
      } else {
        setAudioUnlocked(true);
      }
    };

    window.addEventListener("click", unlockKitchenAudio);
    window.addEventListener("touchstart", unlockKitchenAudio);

    return () => {
      window.removeEventListener("click", unlockKitchenAudio);
      window.removeEventListener("touchstart", unlockKitchenAudio);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // =========================
  // FIREBASE BUYURTMALAR (where filtrisiz)
  // =========================
  useEffect(() => {
    const currentText = TEXT[language] || TEXT.uz;
    const q = query(collection(db, "orders"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allDocs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Barcha faol buyurtmalarni olamiz (tayyor bo'lmagan va yetkazib berilmaganlar)
        const activeOrders = allDocs.filter((o) => {
          if (cafeId && o.cafeId && o.cafeId !== cafeId) return false;
          return o.kitchenStatus !== "delivered" && o.kitchenStatus !== "completed";
        });

        activeOrders.sort((a, b) => {
          const ad = a.createdAt?.toDate
            ? a.createdAt.toDate()
            : new Date(a.createdAt || 0);
          const bd = b.createdAt?.toDate
            ? b.createdAt.toDate()
            : new Date(b.createdAt || 0);
          return ad - bd;
        });

        if (!isInitialLoad.current) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const newOrder = change.doc.data();
              toast.info(
                `🔔 ${currentText.newOrderFrom(
                  newOrder.tableNumber || "-"
                )}`,
                { position: "top-right", autoClose: 5000 }
              );
              playKitchenVibeSound();
            }
          });
        } else {
          isInitialLoad.current = false;
        }

        setOrders(activeOrders);
        setLoading(false);
      },
      (error) => {
        console.error("Order fetch error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [cafeId, language]);

  const updateItemStatus = async (order, itemIndex, status) => {
    try {
      const statuses = (order.items || []).map((_, index) => {
        if (order.itemStatuses?.[index]) {
          return order.itemStatuses[index];
        }
        return order.kitchenStatus === "preparing" ? "preparing" : "pending";
      });

      statuses[itemIndex] = status;

      const allDelivered =
        statuses.length > 0 &&
        statuses.every((itemStatus) => itemStatus === "delivered" || itemStatus === "ready");

      await updateDoc(doc(db, "orders", order.id), {
        itemStatuses: statuses,
        kitchenStatus: allDelivered ? "ready" : "preparing",
        ...(status === "ready" ? { readyAt: new Date() } : {}),
      });
    } catch (error) {
      console.error("Item status error:", error);
      toast.error("Taom holatini o'zgartirib bo'lmadi");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Chiqishda xatolik yuz berdi");
    }
  };

  const getElapsedMinutes = (createdAt) => {
    const created = createdAt?.toDate
      ? createdAt.toDate()
      : new Date(createdAt || 0);
    return Math.max(0, Math.floor((new Date() - created) / 60000));
  };

  const formatTime = (date) => {
    const d = date?.toDate ? date.toDate() : new Date(date || 0);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getItemStatus = (order, index) => {
    if (order.itemStatuses?.[index]) {
      return order.itemStatuses[index];
    }
    return order.kitchenStatus === "preparing" ? "preparing" : "pending";
  };

  const pendingCount = orders.filter((o) => o.kitchenStatus === "pending").length;
  const preparingCount = orders.filter((o) => o.kitchenStatus === "preparing").length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f5ef]">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-[18px] bg-[#e9eee3] border border-[#d8e1d0] flex items-center justify-center text-2xl mb-4">
            👨‍🍳
          </div>
          <div className="w-7 h-7 mx-auto border-[3px] border-[#c87952] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7d766c]">
            {t("loading", "Yuklanmoqda...")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef] relative overflow-x-hidden p-4">
      {/* DEKOR */}
      <div className="fixed -top-24 -right-24 w-72 h-72 rounded-full bg-[#e5eadf] opacity-60 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-32 -left-24 w-80 h-80 rounded-full bg-[#f0d9c8] opacity-50 blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* HEADER */}
        <header className="relative bg-[#fffdf8] border border-[#e8dfd2] rounded-[28px] px-5 sm:px-7 py-4 shadow-[0_12px_40px_rgba(92,72,48,0.07)] mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-[17px] bg-[#e9eee3] border border-[#d8e1d0] flex items-center justify-center text-xl shadow-sm">
                👨‍🍳
                <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-[#c87952] border-[3px] border-[#fffdf8]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-[#30352d]">
                    KARAVAN
                  </h2>
                  <span className="text-[#c87952] text-lg">•</span>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-[#30352d]">
                    KAFE
                  </h2>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-5 h-[2px] bg-[#c87952] rounded-full" />
                  <span className="text-[8px] font-black uppercase tracking-[0.22em] text-[#8a8378]">
                    KDS System
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLanguageOpen((v) => !v)}
                  className="h-11 px-3 sm:px-4 rounded-[15px] border border-[#dedfd5] bg-[#f5f7f1] hover:bg-[#eaf0e4] text-[#4e5948] flex items-center gap-2 text-xs font-black cursor-pointer transition-all"
                >
                  <span className="w-6 h-6 rounded-lg bg-white border border-[#e1e5dc] flex items-center justify-center text-sm">
                    🌐
                  </span>
                  <span className="hidden sm:block">
                    {LANGUAGES.find((item) => item.code === language)?.label}
                  </span>
                </button>

                {languageOpen && (
                  <div className="absolute right-0 top-14 z-50 w-44 bg-[#fffdf8] border border-[#e4ddd2] rounded-[18px] shadow-lg p-2">
                    {LANGUAGES.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => changeLanguage(item.code)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black cursor-pointer ${
                          language === item.code
                            ? "bg-[#e9eee3] text-[#53604c]"
                            : "text-[#69665f] hover:bg-[#f5f1e9]"
                        }`}
                      >
                        <span className="text-base">{item.flag}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                className="h-11 px-3 sm:px-4 rounded-[15px] bg-[#fff3ee] border border-[#edc9ba] text-[#b85f3d] flex items-center gap-2 text-xs font-black cursor-pointer"
              >
                {tr.logout}
              </button>
            </div>
          </div>
        </header>

        {!audioUnlocked && (
          <button
            type="button"
            onClick={playKitchenVibeSound}
            className="mx-auto mb-5 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#fff8e9] border border-[#ead9b8] text-[#a86d35] text-[10px] font-black cursor-pointer"
          >
            🔊 {tr.activateAudio}
          </button>
        )}

        {/* SARLAVHA */}
        <section className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#30352d]">{tr.orders}</h1>
            <p className="text-xs text-[#8a8378]">Karavan Kafe — KDS Queue</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-4 py-2 rounded-[15px] bg-[#fff7e8] border border-[#ecdfc5]">
              <span className="text-[10px] text-[#a78a58] font-bold">{tr.pending}: </span>
              <span className="font-black text-[#b87725]">{pendingCount}</span>
            </div>
            <div className="px-4 py-2 rounded-[15px] bg-[#edf3e9] border border-[#d8e3d2]">
              <span className="text-[10px] text-[#75826d] font-bold">{tr.preparing}: </span>
              <span className="font-black text-[#61725a]">{preparingCount}</span>
            </div>
          </div>
        </section>

        {/* BUYURTMALAR RO'YXATI */}
        {orders.length === 0 ? (
          <div className="bg-[#fffdf8] border border-[#e7dfd2] rounded-[28px] py-20 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-[21px] bg-[#f5f1e8] border border-[#e4dbce] flex items-center justify-center text-2xl mb-4">
              🍽️
            </div>
            <h3 className="text-lg font-black text-[#363a32]">{tr.noOrders}</h3>
            <p className="text-xs text-[#a29a8f] mt-1">{tr.autoAppear}</p>
          </div>
        ) : (
          <main className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orders.map((order) => {
              const elapsed = getElapsedMinutes(order.createdAt);
              const isUrgent = elapsed >= 15;

              return (
                <article
                  key={order.id}
                  className={`bg-[#fffdf8] rounded-[24px] border p-5 shadow-sm transition-all ${
                    isUrgent ? "border-red-300 bg-red-50/20" : "border-[#e6ded3]"
                  }`}
                >
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#eee7dc]">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-[#c87952]">
                        Stol #{order.tableNumber || "-"}
                      </span>
                      <span className="text-[11px] font-bold text-[#9b9489]">
                        {formatTime(order.createdAt)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#b85f3d]">
                      {elapsed} {tr.min}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {(order.items || []).map((item, idx) => {
                      const itemStatus = getItemStatus(order, idx);

                      return (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[#f8f6f0] rounded-xl border border-[#e8e2d5]"
                        >
                          <div>
                            <div className="font-bold text-sm text-[#3d4139]">
                              {item.name}
                            </div>
                            <div className="text-xs text-[#8a8378]">
                              x{item.quantity} {tr.portion}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {["preparing", "ready"].map((st) => (
                              <button
                                key={st}
                                onClick={() => updateItemStatus(order, idx, st)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                                  itemStatus === st
                                    ? st === "ready"
                                      ? "bg-green-600 text-white"
                                      : "bg-amber-500 text-white"
                                    : "bg-white text-slate-600 border border-slate-200"
                                }`}
                              >
                                {st === "preparing" ? tr.preparing : tr.ready}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </main>
        )}
      </div>

      {/* CHIQISH MODALI */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
            <h3 className="text-base font-bold text-slate-800 mb-2">
              {tr.confirmLogout}
            </h3>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
              >
                {tr.cancel}
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold text-xs"
              >
                {tr.logout}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}