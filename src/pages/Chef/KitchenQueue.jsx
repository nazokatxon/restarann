   import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

// Har bir oshpaz roliga mos label (headerda ko'rsatish uchun)
const KITCHEN_TYPE_LABELS = {
  umumiy: "🍲 Umumiy oshpaz",
  salatchi: "🥗 Salatchi",
  somsachi: "🥟 Somsachi",
  shashlikchi: "🍢 Shashlikchi",
  pishiriqchi: "🥐 Pishiriqchi",
  ichimlikchi: "🥤 Ichimlikchi",
  taomchi: "🍛 Taomchi",
};

// Faqat shu rollar "hamma narsani ko'rish" huquqiga ega
// (masalan admin/direktor barcha buyurtmalarni kuzatishi kerak bo'lishi mumkin)
const SEE_ALL_ROLES = ["umumiy", "admin", "direktor", "director"];

export default function KitchenQueue() {
  const navigate = useNavigate();
  const auth = getAuth();
  const { role } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingItems, setProcessingItems] = useState({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Ekranda bor bo'lgan taomlar kalitlarini saqlash
  const knownItemsRef = useRef(new Set());
  const isFirstSnapshotRef = useRef(true);
  const audioUnlockedRef = useRef(false);

  const normalizedRole = (role || "umumiy").toLowerCase();
  const canSeeAll = SEE_ALL_ROLES.includes(normalizedRole);

  // Audio brauzer cheklovini yechish (Unlock Audio)
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      try {
        const audio = new Audio("/bell.mp3");
        audio.volume = 0;
        audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
          })
          .catch(() => {});

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
      } catch (e) {
        // Ignored
      } finally {
        audioUnlockedRef.current = true;
      }
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  // Ovoz chalish funksiyasi
  const playNotificationSound = () => {
    try {
      // 1. MP3 fayl
      const audio = new Audio("/bell.mp3");
      audio.play().catch(() => {});

      // 2. Web Audio Beep (zaxira)
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio error:", e);
    }
  };

  // Orders realtime listener
  useEffect(() => {
    setLoading(true);
    const qOrders = query(collection(db, "orders"));

    const unsubscribe = onSnapshot(
      qOrders,
      (snapshot) => {
        const fetchedOrders = [];
        const currentSnapshotItemKeys = new Set();
        let hasBrandNewItem = false;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const rawItems =
            data.kitchenItems || data.items || data.products || [];

          // Tayyor bo'lmagan buyurtma elementlari
          let pendingItems = rawItems
            .map((item, index) => ({ ...item, __index: index }))
            .filter((i) => !i.readyForWaiter && !i.waiterTaken && !i.isDelivered);

          // ROLGA QARAB FILTRLASH:
          // Agar foydalanuvchi "hammasini ko'rish" huquqiga ega bo'lmasa,
          // faqat o'z kitchenType'iga mos taomlarni ko'radi.
          if (!canSeeAll) {
            pendingItems = pendingItems.filter((i) => {
              const itemKitchenType = (i.kitchenType || "umumiy").toLowerCase();
              return itemKitchenType === normalizedRole;
            });
          }

          if (pendingItems.length > 0) {
            fetchedOrders.push({
              id: docSnap.id,
              ...data,
              rawItems,
              displayItems: pendingItems,
            });

            // Har bir taom uchun unikal kalit hosil qilish
            pendingItems.forEach((item) => {
              const itemUniqueKey = `${docSnap.id}_${item.__index}_${
                item.name || item.title || "item"
              }`;
              currentSnapshotItemKeys.add(itemUniqueKey);

              if (
                !isFirstSnapshotRef.current &&
                !knownItemsRef.current.has(itemUniqueKey)
              ) {
                hasBrandNewItem = true;
              }
            });
          }
        });

        // Yangi buyurtma kelganda ovoz va bildirishnoma chiqarish
        if (!isFirstSnapshotRef.current && hasBrandNewItem) {
          playNotificationSound();
          toast.info("🔔 YANGI BUYURTMA KELDI!", {
            position: "top-center",
            autoClose: 3000,
          });
        }

        knownItemsRef.current = currentSnapshotItemKeys;
        isFirstSnapshotRef.current = false;

        setOrders(fetchedOrders);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        toast.error("Buyurtmalarni yuklashda xatolik!");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [normalizedRole, canSeeAll]);

  // Taomni tayyor deb belgilash
  const handleItemReady = async (order, displayedIdx) => {
    const target = order.displayItems[displayedIdx];
    const originalIndex = target.__index;
    const itemKey = `${order.id}-${originalIndex}`;

    if (processingItems[itemKey]) return;
    setProcessingItems((prev) => ({ ...prev, [itemKey]: true }));

    try {
      const updatedItems = order.rawItems.map((item, idx) => {
        if (idx === originalIndex) {
          return {
            ...item,
            readyForWaiter: true,
            isReady: true,
            kitchenItemStatus: "ready",
            waiterTaken: false,
            readyAt: new Date().toISOString(),
          };
        }
        return item;
      });

      const allReady = updatedItems.every(
        (i) => i.readyForWaiter || i.waiterTaken || i.isReady
      );

      await updateDoc(doc(db, "orders", order.id), {
        kitchenItems: updatedItems,
        kitchenStatus: allReady ? "ready" : "preparing",
        status: allReady ? "ready" : "preparing",
        updatedAt: serverTimestamp(),
      });

      toast.success("✅ Taom tayyor!");
    } catch (e) {
      console.error(e);
      toast.error("Xatolik yuz berdi!");
    } finally {
      setProcessingItems((prev) => {
        const copy = { ...prev };
        delete copy[itemKey];
        return copy;
      });
    }
  };

  // Tizimdan chiqishni tasdiqlash
  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    signOut(auth).then(() => navigate("/login"));
  };

  const roleLabel = KITCHEN_TYPE_LABELS[normalizedRole] || "🍲 Umumiy oshpaz";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">👨‍🍳</div>
          <p className="font-bold text-slate-500">
            Oshxona buyurtmalari yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex flex-col items-center text-slate-800">
      {/* HEADER */}
      <header className="w-full max-w-2xl bg-white p-4 rounded-2xl shadow-xs flex justify-between items-center mb-6 border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-amber-600">Oshxona Navbati</h1>
          <p className="text-xs text-slate-400 font-semibold">
            {roleLabel} {canSeeAll ? "· Barcha buyurtmalar" : ""}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={playNotificationSound}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            📢 Ovozni sinash
          </button>
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="bg-rose-50 text-rose-600 border border-rose-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
          >
            Chiqish
          </button>
        </div>
      </header>

      {/* CHIQISHNI TASDIQLASH MODALI */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm text-center border border-slate-100">
            <div className="text-4xl mb-2">🚪</div>
            <p className="text-slate-800 font-bold text-lg mb-1">
              Chiqishni tasdiqlaysizmi?
            </p>
            <p className="text-slate-400 text-xs font-medium mb-5">
              Haqiqatan ham tizimdan chiqmoqchimisiz?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                onClick={confirmLogout}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
              >
                Chiqish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUYURTMALAR RO'YXATI */}
      <main className="w-full max-w-2xl">
        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs"
              >
                <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-3">
                  <span className="font-extrabold text-xl text-slate-800">
                    Stol №{order.tableNumber ?? order.table ?? order.tableNo ?? "—"}
                  </span>
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-3 py-1 rounded-xl font-bold">
                    NAVBATDA ({order.displayItems.length})
                  </span>
                </div>

                <ul className="space-y-2">
                  {order.displayItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100"
                    >
                      <div>
                        <span className="font-bold text-slate-800">
                          {item.name || item.title || item.productName || "Nomsiz taom"}
                        </span>
                        <span className="ml-2 bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold rounded-lg">
                          x{item.quantity || item.count || 1}
                        </span>
                        {canSeeAll && (
                          <span className="ml-2 bg-slate-200 text-slate-600 px-2 py-0.5 text-xs font-bold rounded-lg">
                            {KITCHEN_TYPE_LABELS[(item.kitchenType || "umumiy").toLowerCase()] ||
                              item.kitchenType}
                          </span>
                        )}
                        {item.comment && (
                          <p className="text-xs text-rose-500 mt-1 font-medium">
                            💬 {item.comment}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={
                          processingItems[`${order.id}-${item.__index}`]
                        }
                        onClick={() => handleItemReady(order, idx)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {processingItems[`${order.id}-${item.__index}`]
                          ? "..."
                          : "Tayyor ✓"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 py-16 text-center">
            <div className="text-4xl mb-3">👨‍🍳</div>
            <p className="text-slate-500 font-bold">
              Hozircha navbatda buyurtmalar yo'q.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Yangi buyurtma kelganda bildirishnoma va ovoz chiqariladi.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}