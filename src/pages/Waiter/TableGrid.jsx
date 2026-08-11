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

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🚪 CHIQISH MODAL STATE'I
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [selectedTable, setSelectedTable] = useState(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const audioCtxRef = useRef(null);
  const notificationQueueRef = useRef([]);
  const notificationShowingRef = useRef(false);
  const notifiedOrdersRef = useRef(new Set());
  const isInitialOrdersLoad = useRef(true); // Boshlang'ich yuklanishni kuzatish

  // 🚪 TIZIMDAN CHIQISH
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

  // 🔊 AUDIO FAOLLASHTIRISH (Toast olib tashlandi)
  const unlockAudio = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext && !audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }

      setAudioUnlocked(true);
    } catch (e) {
      console.log("Audio unlock error:", e);
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (!audioUnlocked) unlockAudio();
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [audioUnlocked]);

  // 🔔 BILDIRISHNOMA (Faqat oshpaz tayyor qilganda chalinadi)
  const showNextNotification = async () => {
    if (notificationShowingRef.current || notificationQueueRef.current.length === 0) return;

    notificationShowingRef.current = true;
    const notification = notificationQueueRef.current.shift();

    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      await audio.play();
    } catch (e) {}

    toast.success(`🛎️ STOL №${notification.tableNumber} TAOMI TAYYOR BO'LDI!`, {
      toastId: `ready-${notification.id}`,
      position: "top-center",
      autoClose: 6000,
    });

    setTimeout(() => {
      notificationShowingRef.current = false;
      showNextNotification();
    }, 3500);
  };

  // 🔥 FIRESTORE REALTIME LISTENERS
  useEffect(() => {
    const qTables = query(collection(db, "tables"));
    const unsubTables = onSnapshot(qTables, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.number || 0) - (b.number || 0));
      setTables(data);
      setLoading(false);
    });

    const qOrders = query(collection(db, "orders"));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Sahifa birinchi marta yuklanganda mavjud tayyor buyurtmalarni e'tiborsiz qoldirish
      if (isInitialOrdersLoad.current) {
        snapshot.docs.forEach((doc) => {
          const orderData = doc.data();
          if (orderData.kitchenStatus === "ready" || orderData.status === "ready") {
            notifiedOrdersRef.current.add(doc.id);
          }
        });
        isInitialOrdersLoad.current = false;
      } else {
        // Faqat sahifa ochilgandan so'ng yangi 'ready' bo'lgan buyurtmalar uchun bildirishnoma chiqarish
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const updatedOrder = change.doc.data();
            const orderId = change.doc.id;

            const isReadyNow =
              updatedOrder.kitchenStatus === "ready" ||
              updatedOrder.status === "ready";

            if (isReadyNow && !notifiedOrdersRef.current.has(orderId)) {
              notifiedOrdersRef.current.add(orderId);
              notificationQueueRef.current.push({
                id: orderId,
                tableNumber: updatedOrder.tableNumber ?? updatedOrder.table ?? "—",
              });
              showNextNotification();
            }
          }
        });
      }

      setOrders(data);
    });

    return () => {
      unsubTables();
      unsubOrders();
    };
  }, []);

  const getTableStatus = (tableNumber) => {
    const activeOrder = orders.find(
      (o) =>
        String(o.tableNumber ?? o.table) === String(tableNumber) &&
        o.kitchenStatus !== "delivered" &&
        o.status !== "delivered"
    );
    if (!activeOrder) return "empty";
    if (activeOrder.kitchenStatus === "ready" || activeOrder.status === "ready")
      return "ready";
    return "occupied";
  };

  const getActiveOrder = (tableNumber) => {
    return orders.find(
      (o) =>
        String(o.tableNumber ?? o.table) === String(tableNumber) &&
        o.kitchenStatus !== "delivered" &&
        o.status !== "delivered"
    );
  };

  const formatTime = (date) => {
    if (!date) return "";
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  };

  const markOrderDelivered = async (order) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        kitchenStatus: "delivered",
        status: "delivered",
      });
      setSelectedTable(null);
      toast.success("Buyurtma yetkazildi deb belgilandi!");
    } catch (error) {
      console.error(error);
      toast.error("Xatolik yuz berdi!");
    }
  };

  const handleTableClick = (table) => {
    const status = getTableStatus(table.number);
    if (status === "empty") {
      navigate(`/waiter/order?table=${table.number}`);
    } else {
      setSelectedTable(table);
    }
  };

  const statusStyles = {
    empty: "bg-white border-gray-200 text-gray-800",
    occupied: "bg-[#fff7e8] border-amber-400 text-amber-800",
    ready: "bg-green-100 border-green-500 text-green-900 shadow-lg shadow-green-500/20",
  };

  const statusLabels = {
    empty: "Bo'sh",
    occupied: "Band",
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
      <header className="sticky top-0 z-30 bg-white border-b border-[#eee5d8] shadow-sm">
        <div className="w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fff0d2] flex items-center justify-center text-lg">🍲</div>
            <div>
              <h1 className="text-base font-bold text-[#6f3518]">AJ Cafe</h1>
              <p className="text-[10px] text-gray-400">Ofitsiant paneli</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={unlockAudio}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                audioUnlocked
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-amber-500 hover:bg-amber-600 text-white animate-bounce shadow-md"
              }`}
            >
              {audioUnlocked ? "🔊 Ovoz Yoqilgan" : "🔔 Ovozni Yoqish"}
            </button>

            <button
              onClick={() => setLogoutModalOpen(true)}
              className="border border-red-200 text-red-500 bg-white hover:bg-red-50 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              ↪ Chiqish
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 py-5">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-2xl font-extrabold text-[#3b2418]">Stollar</h2>
          <button
            onClick={() => navigate("/waiter/order")}
            className="bg-[#d97706] hover:bg-[#c56600] text-white px-5 py-2.5 rounded-xl text-sm font-bold"
          >
            + Buyurtma
          </button>
        </div>

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
                  flex flex-col items-center justify-center min-h-[120px]
                  transition shadow-sm hover:shadow-md active:scale-95
                  ${statusStyles[status]}
                  ${status === "ready" ? "animate-pulse border-green-500" : ""}
                `}
              >
                <div className="text-2xl mb-1">🪑</div>
                <span className="text-xl font-extrabold">№{table.number}</span>
                <span className="text-xs font-bold mt-1">{statusLabels[status]}</span>
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

      {/* STOL MA'LUMOTI & TAOM QO'SHISH MODAL OYNASI */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-extrabold">Stol №{selectedTable.number}</h2>
              <button onClick={() => setSelectedTable(null)} className="text-gray-400 text-lg hover:text-gray-600">✕</button>
            </div>

            {(() => {
              const order = getActiveOrder(selectedTable.number);
              if (!order) return <p className="text-center py-4 text-gray-400">Buyurtma topilmadi</p>;

              const items = order.kitchenItems || order.items || [];
              const totalPrice = items.reduce(
                (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
                0
              );

              return (
                <>
                  <div className="space-y-2 mb-4 max-h-52 overflow-y-auto border-t border-b py-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                        <span className="font-medium">{item.name || item.title} x {item.quantity || 1}</span>
                        <span className="font-bold">{((item.price || 0) * (item.quantity || 1)).toLocaleString()} so'm</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-extrabold text-base pt-2 text-[#3b2418]">
                      <span>Jami:</span>
                      <span>{totalPrice.toLocaleString()} so'm</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => navigate(`/waiter/order?table=${selectedTable.number}`)}
                      className="w-full bg-[#d97706] hover:bg-[#c56600] text-white font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
                    >
                      ➕ Yana taom qo'shish
                    </button>

                    {(order.kitchenStatus === "ready" || order.status === "ready") && (
                      <button
                        onClick={() => markOrderDelivered(order)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-md"
                      >
                        ✓ Mijozga yetkazdim (Stolni yopish)
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 🚪 CHIQISH TASDIQLASH MODAL OYNASI */}
      {logoutModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🚪</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Tizimdan chiqmoqchimisiz?
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              Rostdan ham ofitsiant panelidan chiqishni xohlaysizmi?
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm transition"
              >
                Ha, Chiqish
              </button>
              <button
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}