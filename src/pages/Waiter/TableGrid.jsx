import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db } from "../../firebase/config.js";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function TableGrid() {
  const auth = getAuth();
  const navigate = useNavigate();

  // =========================================================
  // STATE
  // =========================================================
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

  // =========================================================
  // REFS
  // =========================================================
  const audioCtxRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const notificationQueueRef = useRef([]);
  const notificationShowingRef = useRef(false);
  const isInitialOrdersLoad = useRef(true);
  const previousOrdersRef = useRef(new Map());
  const notifiedItemsRef = useRef(new Set());

  // =========================================================
  // LOGOUT HANDLER
  // =========================================================
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info("Tizimdan chiqdingiz");
      navigate("/login");
    } catch (error) {
      console.error("Chiqishda xatolik:", error);
      toast.error("Chiqishda xatolik yuz berdi!");
    }
  };

  // =========================================================
  // AUDIO CONTEXT & UNLOCK
  // =========================================================
  const getAudioContext = () => {
    try {
      const AudioContext =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      return audioCtxRef.current;
    } catch (error) {
      console.error("AudioContext xatosi:", error);
      return null;
    }
  };

  const unlockAudio = async () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      audioUnlockedRef.current = true;
    } catch (error) {
      console.error("Audio unlock xatosi:", error);
    }
  };

  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!audioUnlockedRef.current) {
        unlockAudio();
      }
    };

    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("touchstart", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  // =========================================================
  // AUDIO SYNTHESIS
  // =========================================================
  const playReadySound = async () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const beep = (delay, frequency, duration) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, now + delay);

        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.8, now + delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start(now + delay);
        oscillator.stop(now + delay + duration + 0.05);
      };

      beep(0, 880, 0.25);
      beep(0.35, 1100, 0.25);
      beep(0.7, 880, 0.35);
    } catch (error) {
      console.error("Ovoz chiqarishda xatolik:", error);
    }
  };

  // =========================================================
  // NOTIFICATION QUEUE
  // =========================================================
  const showNextNotification = async () => {
    if (notificationShowingRef.current || notificationQueueRef.current.length === 0) {
      return;
    }

    notificationShowingRef.current = true;
    const notification = notificationQueueRef.current.shift();

    await playReadySound();

    toast.success(
      `🛎️ STOL №${notification.tableNumber}: ${notification.itemName} TAYYOR!`,
      {
        toastId: `ready-${notification.id}`,
        position: "top-center",
        autoClose: 5000,
      }
    );

    setTimeout(() => {
      notificationShowingRef.current = false;
      showNextNotification();
    }, 2500);
  };

  // =========================================================
  // FIREBASE REALTIME LISTENERS
  // =========================================================
  useEffect(() => {
    const qTables = query(collection(db, "tables"));
    const unsubTables = onSnapshot(
      qTables,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        data.sort((a, b) => (a.number || 0) - (b.number || 0));
        setTables(data);
        setLoading(false);
      },
      (error) => {
        console.error("Tables listener:", error);
        setLoading(false);
        toast.error("Stollarni yuklashda xatolik!");
      }
    );

    const qOrders = query(collection(db, "orders"));
    const unsubOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        if (isInitialOrdersLoad.current) {
          snapshot.docs.forEach((orderDoc) => {
            const order = orderDoc.data();
            const kitchenItems = Array.isArray(order.kitchenItems)
              ? order.kitchenItems
              : [];

            kitchenItems.forEach((item, index) => {
              if (item.isReady === true) {
                notifiedItemsRef.current.add(`${orderDoc.id}-${index}`);
              }
            });

            previousOrdersRef.current.set(orderDoc.id, order);
          });
          isInitialOrdersLoad.current = false;
        } else {
          snapshot.docs.forEach((orderDoc) => {
            const newOrder = orderDoc.data();
            const orderId = orderDoc.id;
            const oldOrder = previousOrdersRef.current.get(orderId);

            const oldItems = Array.isArray(oldOrder?.kitchenItems)
              ? oldOrder.kitchenItems
              : [];
            const newItems = Array.isArray(newOrder.kitchenItems)
              ? newOrder.kitchenItems
              : [];

            newItems.forEach((newItem, index) => {
              const oldItem = oldItems[index];
              const oldReady = oldItem?.isReady === true;
              const newReady = newItem?.isReady === true;

              if (!oldReady && newReady) {
                const notificationId = `${orderId}-${index}`;
                if (!notifiedItemsRef.current.has(notificationId)) {
                  notifiedItemsRef.current.add(notificationId);
                  notificationQueueRef.current.push({
                    id: notificationId,
                    tableNumber:
                      newOrder.tableNumber ?? newOrder.table ?? "—",
                    itemName: newItem.name || newItem.title || "Taom",
                  });
                  showNextNotification();
                }
              }
            });

            previousOrdersRef.current.set(orderId, newOrder);
          });
        }

        setOrders(data);
      },
      (error) => {
        console.error("Orders listener:", error);
        toast.error("Buyurtmalarni kuzatishda xatolik!");
      }
    );

    return () => {
      unsubTables();
      unsubOrders();
    };
  }, []);

  // =========================================================
  // DATA HELPERS
  // =========================================================
  const getActiveOrder = (tableNumber) => {
    return orders.find(
      (order) =>
        String(order.tableNumber ?? order.table) === String(tableNumber) &&
        order.kitchenStatus !== "closed" &&
        order.status !== "closed" &&
        order.status !== "completed"
    );
  };

  const getTableStatus = (tableNumber) => {
    const activeOrder = getActiveOrder(tableNumber);
    if (!activeOrder) return "empty";

    const items = activeOrder.kitchenItems || [];
    const allReady =
      items.length > 0 && items.every((item) => item.isReady === true);

    return allReady ? "ready" : "occupied";
  };

  const formatTime = (date) => {
    if (!date) return "";
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =========================================================
  // ACTION HANDLERS
  // =========================================================
  const markFoodDelivered = async (order, itemIndex) => {
    try {
      const items = Array.isArray(order.kitchenItems)
        ? [...order.kitchenItems]
        : [];
      const item = items[itemIndex];

      if (!item) {
        toast.error("Taom topilmadi!");
        return;
      }

      if (item.isReady !== true) {
        toast.warning("❗ Avval oshpaz bu taomni TAYYOR qilishi kerak!");
        return;
      }

      if (item.isDelivered === true) return;

      items[itemIndex] = {
        ...items[itemIndex],
        isDelivered: true,
        deliveryStatus: "delivered",
        deliveredAt: new Date(),
      };

      await updateDoc(doc(db, "orders", order.id), {
        kitchenItems: items,
        updatedAt: new Date(),
      });

      toast.success(`✅ ${item.name || item.title || "Taom"} yetkazildi!`);
    } catch (error) {
      console.error("Taomni yetkazishda xatolik:", error);
      toast.error("❌ Taomni yetkazishda xatolik!");
    }
  };

  // Stolni yopish (Hisob-kitob qilindi va stol bo'shatildi)
  const handleCloseTable = async (orderId) => {
    if (!window.confirm("Haqiqatan ham ushbu stolni yopmoqchimisiz?")) return;

    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "closed",
        kitchenStatus: "closed",
        closedAt: new Date(),
      });

      setSelectedTable(null);
      toast.success("✅ Stol muvaffaqiyatli yopildi!");
    } catch (error) {
      console.error("Stolni yopishda xatolik:", error);
      toast.error("Stolni yopishda xatolik yuz berdi!");
    }
  };

  const handleTableClick = (table) => {
    unlockAudio();
    const status = getTableStatus(table.number);

    if (status === "empty") {
      navigate(`/waiter/order?table=${table.number}`);
    } else {
      setSelectedTable(table);
    }
  };

  // =========================================================
  // UI STYLES
  // =========================================================
  const statusStyles = {
    empty: "bg-white border-gray-200 text-gray-800",
    occupied: "bg-[#fff7e8] border-amber-400 text-amber-800",
    ready: "bg-green-100 border-green-500 text-green-900 shadow-lg shadow-green-500/20",
  };

  const statusLabels = {
    empty: "Bo'sh",
    occupied: "Tayyorlanmoqda",
    ready: "Tayyor!",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5ef] flex items-center justify-center font-bold text-gray-500">
        Yuklanmoqda...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-gray-800">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#eee5d8] shadow-sm">
        <div className="w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fff0d2] flex items-center justify-center text-lg">
              🍲
            </div>
            <div>
              <h1 className="text-base font-bold text-[#6f3518]">
                KARAVAN KAFE
              </h1>
              <p className="text-[10px] text-gray-400">Ofitsiant paneli</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLogoutModalOpen(true)}
              className="border border-red-200 text-red-500 bg-white hover:bg-red-50 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              ↪ Chiqish
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="w-full max-w-5xl mx-auto px-4 py-5">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-2xl font-extrabold text-[#3b2418]">Stollar</h2>
          <button
            onClick={() => navigate("/waiter/order")}
            className="bg-[#d97706] hover:bg-[#c56600] text-white px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
          >
            + Buyurtma
          </button>
        </div>

        {/* TABLE GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tables.map((table) => {
            const status = getTableStatus(table.number);
            const activeOrder = getActiveOrder(table.number);

            return (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`
                  relative rounded-2xl border-2 px-3 py-4
                  flex flex-col items-center justify-center
                  min-h-[120px] transition shadow-sm cursor-pointer
                  hover:shadow-md active:scale-95
                  ${statusStyles[status]}
                  ${status === "ready" ? "animate-pulse" : ""}
                `}
              >
                <div className="text-2xl mb-1">🪑</div>
                <span className="text-xl font-extrabold">
                  № {table.number}
                </span>
                <span className="text-xs font-bold mt-1">
                  {statusLabels[status]}
                </span>

                {activeOrder && (
                  <span className="text-[10px] mt-1 opacity-75 font-semibold">
                    🕐 {formatTime(activeOrder.createdAt)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* TABLE DETAIL MODAL */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-extrabold">
                Stol № {selectedTable.number}
              </h2>
              <button
                onClick={() => setSelectedTable(null)}
                className="text-gray-400 text-lg hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {(() => {
              const order = getActiveOrder(selectedTable.number);

              if (!order) {
                return (
                  <p className="text-center py-4 text-gray-400">
                    Buyurtma topilmadi
                  </p>
                );
              }

              const items = Array.isArray(order.kitchenItems)
                ? order.kitchenItems
                : [];

              const totalPrice = items.reduce(
                (sum, item) =>
                  sum +
                  Number(item.price || 0) * Number(item.quantity || 1),
                0
              );

              return (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-center">
                    <div className="font-bold text-amber-700">
                      👨‍🍳 Oshpaz tayyorlamoqda...
                    </div>
                    <div className="text-xs text-amber-600 mt-1">
                      Har bir tayyor taom yonida "Yetkazildi" tugmasi chiqadi.
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 max-h-[320px] overflow-y-auto border-t border-b py-3 flex-1">
                    {items.map((item, idx) => {
                      const isReady = item.isReady === true;
                      const isDelivered = item.isDelivered === true;

                      return (
                        <div
                          key={idx}
                          className={`
                            rounded-xl px-3 py-3 border
                            ${
                              isDelivered
                                ? "bg-green-50 border-green-200"
                                : isReady
                                ? "bg-blue-50 border-blue-200"
                                : "bg-gray-50 border-gray-200"
                            }
                          `}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-gray-800">
                                {item.name || item.title || "Taom"}
                                {" x "}
                                {item.quantity || 1}
                              </div>
                              <div className="text-sm font-bold text-[#3b2418] mt-1">
                                {(
                                  Number(item.price || 0) *
                                  Number(item.quantity || 1)
                                ).toLocaleString()}
                                {" so'm"}
                              </div>
                            </div>

                            <div className="shrink-0">
                              {!isReady && !isDelivered && (
                                <span className="inline-flex items-center bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">
                                  ⏳ Tayyorlanmoqda
                                </span>
                              )}

                              {isReady && !isDelivered && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    markFoodDelivered(order, idx)
                                  }
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
                                >
                                  🚚 Yetkazildi
                                </button>
                              )}

                              {isDelivered && (
                                <span className="inline-flex items-center bg-green-200 text-green-800 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">
                                  ✅ Yetkazildi
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-gray-600">Jami sum:</span>
                    <span className="text-lg font-black text-[#3b2418]">
                      {totalPrice.toLocaleString()} so'm
                    </span>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/waiter/order?table=${selectedTable.number}&orderId=${order.id}`
                        )
                      }
                      className="flex-1 bg-[#d97706] hover:bg-[#c56600] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>+</span> Yana taom qo'shish
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCloseTable(order.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 cursor-pointer"
                    >
                      🛑 Stolni yopish
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {logoutModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 text-center">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Tizimdan chiqish
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Haqiqatan ham tizimdan chiqmoqchimisiz?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition cursor-pointer"
              >
                Chiqish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}