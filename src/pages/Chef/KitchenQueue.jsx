import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  collection,
  query,
  where,
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
  },
};

export default function KitchenQueue() {
  const { t, i18n } = useTranslation();
  const { cafeId } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [languageOpen, setLanguageOpen] = useState(false);

  // CHIQISH MODALI
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [language, setLanguage] = useState(
    () => localStorage.getItem("appLang") || "uz"
  );

  const kitchenAudioCtxRef = useRef(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const isInitialLoad = useRef(true);
  const [, setTick] = useState(0);

  // =========================
  // OSHPAZ BUYURTMALARINI BIRIN-KETIN KO'RSATISH
  // Bir stolning barcha taomlari tugamaguncha
  // keyingi stolning buyurtmasi chiqmaydi.
  // =========================
  const [displayIndex, setDisplayIndex] = useState(0);
  const displayIndexRef = useRef(0);
  const activeKeyRef = useRef(null);

  const kitchenDisplayQueue = useMemo(() => {
    const groups = new Map();

    orders.forEach((order) => {
      const tableKey = String(order.tableNumber || "-");

      if (!groups.has(tableKey)) {
        groups.set(tableKey, []);
      }

      (order.items || []).forEach((item, itemIndex) => {
        groups.get(tableKey).push({
          order,
          item,
          itemIndex,
          key: `${order.id}-${itemIndex}`,
        });
      });
    });

    return Array.from(groups.values()).flat();
  }, [orders]);

  // Buyurtmalar yangilanganda hozirgi taomni imkon qadar saqlab qolamiz
  useEffect(() => {
    if (kitchenDisplayQueue.length === 0) {
      activeKeyRef.current = null;
      displayIndexRef.current = 0;
      setDisplayIndex(0);
      return;
    }

    const sameKeyIndex = activeKeyRef.current
      ? kitchenDisplayQueue.findIndex(
          (item) => item.key === activeKeyRef.current
        )
      : -1;

    if (sameKeyIndex >= 0) {
      displayIndexRef.current = sameKeyIndex;
      setDisplayIndex(sameKeyIndex);
      return;
    }

    const safeIndex = Math.min(
      displayIndexRef.current,
      kitchenDisplayQueue.length - 1
    );

    displayIndexRef.current = safeIndex;
    activeKeyRef.current =
      kitchenDisplayQueue[safeIndex]?.key || null;
    setDisplayIndex(safeIndex);
  }, [kitchenDisplayQueue]);

  // Har bir taom ozgina ko'rinib, keyingisiga o'tadi.
  // Bir stolning barcha taomlari ketma-ket chiqadi.
  useEffect(() => {
    if (kitchenDisplayQueue.length <= 1) return;

    const timer = setTimeout(() => {
      const nextIndex =
        displayIndexRef.current + 1 >= kitchenDisplayQueue.length
          ? 0
          : displayIndexRef.current + 1;

      displayIndexRef.current = nextIndex;
      activeKeyRef.current =
        kitchenDisplayQueue[nextIndex]?.key || null;
      setDisplayIndex(nextIndex);
    }, 5000);

    return () => clearTimeout(timer);
  }, [displayIndex, kitchenDisplayQueue.length]);

  const tr = TEXT[language] || TEXT.uz;

  // =========================
  // TILNI O'ZGARTIRISH
  // =========================
  const changeLanguage = (code) => {
    setLanguage(code);
    localStorage.setItem("appLang", code);
    i18n.changeLanguage(code);
    setLanguageOpen(false);
  };

  // =========================
  // YANGI ZAKAZ OVOZI
  // =========================
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

        gain.gain.linearRampToValueAtTime(
          0.32,
          start + 0.025
        );

        gain.gain.exponentialRampToValueAtTime(
          0.001,
          start + 0.17
        );

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch (e) {
      console.log("Audio error:", e);
    }
  };

  // =========================
  // AUDIO FAOLLASHTIRISH
  // =========================
  useEffect(() => {
    const unlockKitchenAudio = () => {
      if (!kitchenAudioCtxRef.current) {
        const AudioContext =
          window.AudioContext || window.webkitAudioContext;

        if (AudioContext) {
          kitchenAudioCtxRef.current =
            new AudioContext();
        }
      }

      if (
        kitchenAudioCtxRef.current?.state ===
        "suspended"
      ) {
        kitchenAudioCtxRef.current
          .resume()
          .then(() => setAudioUnlocked(true));
      } else {
        setAudioUnlocked(true);
      }
    };

    window.addEventListener(
      "click",
      unlockKitchenAudio
    );

    window.addEventListener(
      "touchstart",
      unlockKitchenAudio
    );

    return () => {
      window.removeEventListener(
        "click",
        unlockKitchenAudio
      );

      window.removeEventListener(
        "touchstart",
        unlockKitchenAudio
      );
    };
  }, []);

  // =========================
  // VAQTNI YANGILAB TURISH
  // =========================
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  // =========================
  // FIREBASE BUYURTMALAR
  // =========================
  useEffect(() => {
    if (!cafeId) return;

    const currentText = TEXT[language] || TEXT.uz;

    const q = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId),
      where("kitchenStatus", "in", [
        "pending",
        "preparing",
      ])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        data.sort((a, b) => {
          const ad = a.createdAt?.toDate
            ? a.createdAt.toDate()
            : new Date(a.createdAt || 0);

          const bd = b.createdAt?.toDate
            ? b.createdAt.toDate()
            : new Date(b.createdAt || 0);

          return ad - bd;
        });

        // YANGI ZAKAZ KELGANDA
        if (!isInitialLoad.current) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const newOrder = change.doc.data();

              toast.info(
                `🔔 ${currentText.newOrderFrom(
                  newOrder.tableNumber || "-"
                )}`,
                {
                  position: "top-right",
                  autoClose: 5000,
                }
              );

              playKitchenVibeSound();
            }
          });
        } else {
          isInitialLoad.current = false;
        }

        setOrders(data);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [cafeId, language]);

  // =========================
  // BIRINCHI TAOMNI TAYYORLASH
  // =========================
  const startPreparing = async (order) => {
    try {
      const statuses = (order.items || []).map(
        (_, index) =>
          order.itemStatuses?.[index] || "pending"
      );

      const firstPending = statuses.findIndex(
        (status) => status === "pending"
      );

      if (firstPending >= 0) {
        statuses[firstPending] = "preparing";
      }

      await updateDoc(
        doc(db, "orders", order.id),
        {
          kitchenStatus: "preparing",
          itemStatuses: statuses,
          preparingAt: new Date(),
        }
      );
    } catch (error) {
      console.error("Status error:", error);

      toast.error(
        "Statusni o'zgartirib bo'lmadi"
      );
    }
  };

  // =========================
  // HAR BIR TAOM STATUSI
  // =========================
  const updateItemStatus = async (
    order,
    itemIndex,
    status
  ) => {
    try {
      const statuses = (order.items || []).map(
        (_, index) => {
          if (order.itemStatuses?.[index]) {
            return order.itemStatuses[index];
          }

          if (
            order.kitchenStatus === "preparing"
          ) {
            return "preparing";
          }

          return "pending";
        }
      );

      statuses[itemIndex] = status;

      const allDelivered =
        statuses.length > 0 &&
        statuses.every(
          (itemStatus) =>
            itemStatus === "delivered"
        );

      await updateDoc(
        doc(db, "orders", order.id),
        {
          itemStatuses: statuses,

          kitchenStatus: allDelivered
            ? "ready"
            : "preparing",

          ...(status === "ready"
            ? {
                readyAt: new Date(),
              }
            : {}),
        }
      );
    } catch (error) {
      console.error(
        "Item status error:",
        error
      );

      toast.error(
        "Taom holatini o'zgartirib bo'lmadi"
      );
    }
  };

  // =========================
  // CHIQISH
  // =========================
  const handleLogout = async () => {
    try {
      await signOut(getAuth());

      window.location.href = "/login";
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      toast.error(
        "Chiqishda xatolik yuz berdi"
      );
    }
  };

  // =========================
  // VAQT
  // =========================
  const getElapsedMinutes = (createdAt) => {
    const created = createdAt?.toDate
      ? createdAt.toDate()
      : new Date(createdAt || 0);

    return Math.max(
      0,
      Math.floor(
        (new Date() - created) / 60000
      )
    );
  };

  const formatTime = (date) => {
    const d = date?.toDate
      ? date.toDate()
      : new Date(date || 0);

    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =========================
  // TAOM STATUSINI OLISH
  // =========================
  const getItemStatus = (
    order,
    index
  ) => {
    if (order.itemStatuses?.[index]) {
      return order.itemStatuses[index];
    }

    return order.kitchenStatus ===
      "preparing"
      ? "preparing"
      : "pending";
  };

  const pendingCount = orders.filter(
    (o) =>
      o.kitchenStatus === "pending"
  ).length;

  const preparingCount = orders.filter(
    (o) =>
      o.kitchenStatus === "preparing"
  ).length;

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f5ef]">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-[18px] bg-[#e9eee3] border border-[#d8e1d0] flex items-center justify-center text-2xl mb-4">
            👨‍🍳
          </div>

          <div className="w-7 h-7 mx-auto border-[3px] border-[#c87952] border-t-transparent rounded-full animate-spin mb-3" />

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7d766c]">
            {t(
              "loading",
              "Yuklanmoqda..."
            )}
          </p>
        </div>
      </div>
    );
  }

  // =========================
  // ASOSIY SAHIFA
  // =========================
  return (
    <div className="min-h-screen bg-[#f7f5ef] relative overflow-x-hidden">

      {/* ORQA FON DEKOR */}
      <div className="fixed -top-24 -right-24 w-72 h-72 rounded-full bg-[#e5eadf] opacity-60 blur-3xl pointer-events-none" />

      <div className="fixed -bottom-32 -left-24 w-80 h-80 rounded-full bg-[#f0d9c8] opacity-50 blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 px-4 py-4">

        {/* =========================
            HEADER
        ========================= */}
        <header className="relative bg-[#fffdf8] border border-[#e8dfd2] rounded-[28px] px-5 sm:px-7 py-4 shadow-[0_12px_40px_rgba(92,72,48,0.07)]">

          <div className="flex items-center justify-between gap-4">

            {/* LOGO */}
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

                  <span className="text-[#c87952] text-lg">
                    •
                  </span>

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

            {/* HEADER BUTTONS */}
            <div className="flex items-center gap-2">

              {/* TIL */}
              <div className="relative">

                <button
                  type="button"
                  onClick={() =>
                    setLanguageOpen(
                      (value) => !value
                    )
                  }
                  className="h-11 px-3 sm:px-4 rounded-[15px] border border-[#dedfd5] bg-[#f5f7f1] hover:bg-[#eaf0e4] text-[#4e5948] flex items-center gap-2 text-xs font-black cursor-pointer transition-all"
                >

                  <span className="w-6 h-6 rounded-lg bg-white border border-[#e1e5dc] flex items-center justify-center text-sm">
                    🌐
                  </span>

                  <span className="hidden sm:block">
                    {
                      LANGUAGES.find(
                        (item) =>
                          item.code === language
                      )?.label
                    }
                  </span>

                  <span className="text-[#8b9485] text-sm">
                    {languageOpen
                      ? "⌃"
                      : "⌄"}
                  </span>

                </button>

                {languageOpen && (
                  <div className="absolute right-0 top-14 z-50 w-44 bg-[#fffdf8] border border-[#e4ddd2] rounded-[18px] shadow-[0_15px_40px_rgba(74,59,40,0.13)] p-2">

                    <div className="px-3 pt-2 pb-1">
                      <span className="text-[8px] uppercase tracking-[0.18em] font-black text-[#a29a8e]">
                        Til
                      </span>
                    </div>

                    {LANGUAGES.map(
                      (item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() =>
                            changeLanguage(
                              item.code
                            )
                          }
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black text-left cursor-pointer transition-all ${
                            language ===
                            item.code
                              ? "bg-[#e9eee3] text-[#53604c]"
                              : "text-[#69665f] hover:bg-[#f5f1e9]"
                          }`}
                        >

                          <span className="text-base">
                            {item.flag}
                          </span>

                          <span>
                            {item.label}
                          </span>

                          {language ===
                            item.code && (
                            <span className="ml-auto text-[#c87952]">
                              ✓
                            </span>
                          )}

                        </button>
                      )
                    )}

                  </div>
                )}

              </div>

              {/* CHIQISH */}
              <button
                type="button"
                onClick={() =>
                  setLogoutModalOpen(true)
                }
                className="h-11 px-3 sm:px-4 rounded-[15px] bg-[#fff3ee] border border-[#edc9ba] hover:bg-[#fbe5dc] text-[#b85f3d] flex items-center gap-2 text-xs font-black cursor-pointer transition-all shadow-sm"
              >

                <span className="w-6 h-6 rounded-lg bg-[#c87952] text-white flex items-center justify-center text-sm">
                  ↪
                </span>

                <span className="hidden sm:block">
                  {tr.logout}
                </span>

              </button>

            </div>

          </div>

          {/* PASTKI NOODATIY CHIZIQ */}
          <div className="absolute left-7 right-7 -bottom-[5px] h-[10px] flex items-center gap-1 opacity-80">

            <span className="w-16 h-[2px] bg-[#c87952] rounded-full" />

            <span className="w-2 h-2 rounded-full bg-[#c87952]" />

            <span className="flex-1 h-[1px] bg-[#e5ddd1]" />

            <span className="w-2 h-2 rounded-full bg-[#9eaf92]" />

            <span className="w-16 h-[2px] bg-[#9eaf92] rounded-full" />

          </div>

        </header>

        {/* =========================
            AUDIO
        ========================= */}
        {!audioUnlocked && (
          <button
            type="button"
            onClick={
              playKitchenVibeSound
            }
            className="mx-auto mt-5 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#fff8e9] border border-[#ead9b8] text-[#a86d35] text-[10px] font-black cursor-pointer shadow-sm hover:bg-[#fff2d8] transition"
          >
            <span className="text-sm">
              🔊
            </span>

            {tr.activateAudio}
          </button>
        )}

        {/* =========================
            SARLAVHA
        ========================= */}
        <section className="max-w-5xl mx-auto mt-8 mb-5">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">

            <div>

              <div className="flex items-center gap-2 mb-2">

                <span className="w-8 h-8 rounded-xl bg-[#e9eee3] border border-[#d8e1d0] flex items-center justify-center text-sm">
                  🍃
                </span>

                <span className="text-[9px] uppercase tracking-[0.22em] text-[#77816e] font-black">
                  {tr.kitchen}
                </span>

              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-[#30352d] tracking-tight">
                {tr.orders}
              </h1>

              <div className="mt-2 flex items-center gap-2">

                <span className="w-12 h-[3px] rounded-full bg-[#c87952]" />

                <span className="w-3 h-[3px] rounded-full bg-[#9eaf92]" />

                <span className="text-[9px] text-[#999187] font-bold">
                  Karavan Kafe
                </span>

              </div>

            </div>

            {/* STATISTIKA */}
            <div className="flex flex-wrap items-center gap-2">

              <div className="px-4 py-2.5 rounded-[15px] bg-[#fff7e8] border border-[#ecdfc5]">

                <span className="text-[9px] text-[#a78a58] font-black uppercase">
                  {tr.pending}
                </span>

                <span className="ml-2 text-sm font-black text-[#b87725]">
                  {pendingCount}
                </span>

              </div>

              <div className="px-4 py-2.5 rounded-[15px] bg-[#edf3e9] border border-[#d8e3d2]">

                <span className="text-[9px] text-[#75826d] font-black uppercase">
                  {tr.preparing}
                </span>

                <span className="ml-2 text-sm font-black text-[#61725a]">
                  {preparingCount}
                </span>

              </div>

              <div className="px-4 py-2.5 rounded-[15px] bg-[#f4eee7] border border-[#e5dbce]">

                <span className="text-[9px] text-[#8f867b] font-black uppercase">
                  {tr.orders}
                </span>

                <span className="ml-2 text-sm font-black text-[#625b52]">
                  {orders.length}
                </span>

              </div>

            </div>

          </div>

        </section>

        {/* =========================
            BUYURTMA YO'Q
        ========================= */}
        {kitchenDisplayQueue.length === 0 ? (

          <div className="max-w-5xl mx-auto bg-[#fffdf8] border border-[#e7dfd2] rounded-[28px] py-24 text-center shadow-[0_12px_35px_rgba(92,72,48,0.06)] relative overflow-hidden">

            <div className="absolute top-0 left-0 w-32 h-32 bg-[#e9eee3] rounded-full blur-3xl opacity-50" />

            <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#f2ddd0] rounded-full blur-3xl opacity-50" />

            <div className="relative z-10">

              <div className="w-16 h-16 mx-auto rounded-[21px] bg-[#f5f1e8] border border-[#e4dbce] flex items-center justify-center text-2xl mb-5 shadow-sm">
                🍽️
              </div>

              <h3 className="text-lg font-black text-[#363a32]">
                {tr.noOrders}
              </h3>

              <p className="text-xs text-[#a29a8f] mt-2">
                {tr.autoAppear}
              </p>

            </div>

          </div>

        ) : (

          <main className="max-w-5xl mx-auto space-y-4">

            {(() => {
              const activeQueueItem =
                kitchenDisplayQueue[displayIndex];

              if (!activeQueueItem) return null;

              const order = activeQueueItem.order;
              const index = 0;
              const elapsed =
                getElapsedMinutes(
                  order.createdAt
                );

              const isUrgent =
                elapsed >= 15;

              const items = [
                activeQueueItem.item,
              ];
              const activeItemIndex =
                activeQueueItem.itemIndex;

              return (

                  <article
                    key={order.id}
                    className={`bg-[#fffdf8] rounded-[24px] border overflow-hidden transition-all shadow-[0_8px_25px_rgba(92,72,48,0.055)] ${
                      isUrgent
                        ? "border-[#e8b8a8]"
                        : index === 0
                        ? "border-[#e5c7a8]"
                        : "border-[#e6ded3]"
                    }`}
                  >

                    <div className="flex items-stretch">

                      {/* STOL */}
                      <div
                        className={`w-24 sm:w-28 shrink-0 flex flex-col items-center justify-center border-r ${
                          isUrgent
                            ? "bg-[#fff0eb] border-[#efd0c5]"
                            : index === 0
                            ? "bg-[#fff6e9] border-[#eee0c9]"
                            : "bg-[#f1f4ed] border-[#dfe6da]"
                        }`}
                      >

                        {index === 0 && (
                          <span className="text-[8px] uppercase font-black tracking-[0.2em] text-[#c87952] mb-2">
                            {tr.new}
                          </span>
                        )}

                        <span
                          className={`text-2xl sm:text-3xl font-black ${
                            isUrgent
                              ? "text-[#c56c4d]"
                              : index === 0
                              ? "text-[#b87935]"
                              : "text-[#65705f]"
                          }`}
                        >
                          #
                          {order.tableNumber ||
                            "-"}
                        </span>

                        <span className="text-[10px] font-bold text-[#9b9489] mt-1">
                          {formatTime(
                            order.createdAt
                          )}
                        </span>

                        <span
                          className={`text-[9px] font-black mt-1 ${
                            isUrgent
                              ? "text-[#c56c4d]"
                              : "text-[#9b9489]"
                          }`}
                        >
                          {elapsed}{" "}
                          {tr.min}
                        </span>

                      </div>

                      {/* BUYURTMA */}
                      <div className="flex-1 min-w-0 p-4 sm:p-5">

                        <div className="flex items-center justify-between gap-3 mb-2">

                          <div className="text-sm font-black text-[#373b33]">
                            {tr.orders} #
                            {order.id.slice(
                              -5
                            )}
                          </div>

                          <div className="text-[9px] font-bold text-[#aaa297]">
                            {tr.orderTime}:{" "}
                            {formatTime(
                              order.createdAt
                            )}
                          </div>

                        </div>

                        {/* TAOMLAR */}
                        <div className="divide-y divide-[#eee7dc]">

                          {items.map(
                            (
                              item,
                              itemIndex
                            ) => {

                              const itemStatus =
                                getItemStatus(
                                  order,
                                  itemIndex
                                );

                              return (

                                <div
                                  key={
                                    itemIndex
                                  }
                                  className="py-3 flex flex-col lg:flex-row lg:items-center gap-3"
                                >

                                  {/* TAOM */}
                                  <div className="flex items-center gap-3 min-w-0 flex-1">

                                    <div className="w-10 h-10 rounded-[13px] bg-[#f2f4ec] border border-[#dfe6d8] flex items-center justify-center text-lg shrink-0">
                                      🍲
                                    </div>

                                    <div className="min-w-0">

                                      <div className="font-black text-sm text-[#3d4139] truncate">
                                        {item.name}
                                      </div>

                                      <div className="text-[10px] text-[#9d968c] font-semibold mt-0.5">
                                        ×{" "}
                                        {
                                          item.quantity
                                        }{" "}
                                        {
                                          tr.portion
                                        }
                                      </div>

                                    </div>

                                  </div>

                                  {/* STATUS */}
                                  <div className="flex items-center gap-1.5 shrink-0">

                                    {[
                                      "preparing",
                                      "ready",
                                      "delivered",
                                    ].map(
                                      (
                                        status
                                      ) => {

                                        const active =
                                          itemStatus ===
                                          status;

                                        const labels =
                                          {
                                            preparing:
                                              tr.preparing,
                                            ready:
                                              tr.ready,
                                            delivered:
                                              tr.delivered,
                                          };

                                        const activeClass =
                                          status ===
                                          "preparing"
                                            ? "bg-[#fff3df] border-[#e8cf9f] text-[#a9752c]"
                                            : status ===
                                              "ready"
                                            ? "bg-[#edf4e9] border-[#cfdcc7] text-[#5d7655]"
                                            : "bg-[#f0f1ee] border-[#d7dbd3] text-[#62685f]";

                                        return (

                                          <button
                                            key={
                                              status
                                            }
                                            type="button"
                                            onClick={() =>
                                              updateItemStatus(
                                                order,
                                                itemIndex,
                                                status
                                              )
                                            }
                                            className={`px-2.5 sm:px-3 py-2 rounded-xl border text-[9px] font-black transition cursor-pointer whitespace-nowrap ${
                                              active
                                                ? activeClass
                                                : "bg-white border-[#e4ded5] text-[#aaa398] hover:bg-[#f7f4ee]"
                                            }`}
                                          >

                                            {status ===
                                            "preparing"
                                              ? "👨‍🍳"
                                              : status ===
                                                "ready"
                                              ? "✓"
                                              : "🍽️"}

                                            {" "}

                                            {
                                              labels[
                                                status
                                              ]
                                            }

                                          </button>

                                        );
                                      }
                                    )}

                                  </div>

                                </div>

                              );
                            }
                          )}

                        </div>

                        {/* IZOH */}
                        {order.note && (
                          <div className="mt-3 px-3 py-2.5 rounded-xl bg-[#fff7e7] border border-[#ebdfc6] text-[10px] font-bold text-[#96743f]">
                            ⚠️{" "}
                            {tr.note}:{" "}
                            {order.note}
                          </div>
                        )}

                        {/* UMUMIY STATUS */}
                        <div className="pt-3 flex justify-end">

                          <span
                            className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              order.kitchenStatus ===
                              "preparing"
                                ? "bg-[#edf3e9] text-[#62745c]"
                                : "bg-[#fff4df] text-[#ad762d]"
                            }`}
                          >
                            {order.kitchenStatus ===
                            "preparing"
                              ? `● ${tr.preparing}`
                              : `● ${tr.pending}`}
                          </span>

                        </div>

                      </div>

                    </div>

                  </article>

              );
            })()}

          </main>
        )}

        {/* =========================
            FOOTER
        ========================= */}
        <footer className="text-center mt-7 pb-3">

          <div className="flex items-center justify-center gap-2 mb-2">

            <span className="w-10 h-[1px] bg-[#ddd4c8]" />

            <span className="text-[#c87952] text-xs">
              ✦
            </span>

            <span className="w-10 h-[1px] bg-[#ddd4c8]" />

          </div>

          <p className="text-[9px] font-black tracking-[0.16em] text-[#aaa297] uppercase">
            KARAVAN KAFE • KDS SYSTEM
          </p>

        </footer>

        {/* =========================
            CHIQISH TASDIQLASH MODALI
        ========================= */}
        {logoutModalOpen && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/30 backdrop-blur-[3px]"
            onClick={() =>
              setLogoutModalOpen(false)
            }
          >

            <div
              className="w-full max-w-sm bg-[#fffdf8] rounded-[24px] border border-[#e5ddd1] shadow-[0_25px_70px_rgba(40,30,20,0.18)] p-6"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              {/* ICON */}
              <div className="w-14 h-14 mx-auto rounded-[18px] bg-[#fff3ee] border border-[#edc9ba] flex items-center justify-center text-2xl mb-4">
                ↪
              </div>

              {/* TITLE */}
              <h3 className="text-center text-lg font-black text-[#30352d]">
                Chiqishni xohlaysizmi?
              </h3>

              {/* TEXT */}
              <p className="text-center text-xs text-[#9b9489] mt-2 leading-5">
                Hisobingizdan chiqishni
                tasdiqlang.
              </p>

              {/* BUTTONS */}
              <div className="flex items-center gap-2 mt-6">

                {/* YO'Q */}
                <button
                  type="button"
                  onClick={() =>
                    setLogoutModalOpen(
                      false
                    )
                  }
                  className="flex-1 h-11 rounded-[14px] border border-[#ded8cf] bg-[#f5f2ec] hover:bg-[#ebe7df] text-[#69635b] text-xs font-black transition-all cursor-pointer"
                >
                  Yo‘q
                </button>

                {/* HA */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 h-11 rounded-[14px] bg-[#c87952] hover:bg-[#b86d49] text-white text-xs font-black transition-all cursor-pointer shadow-sm"
                >
                  Ha, chiqish
                </button>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}