import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function TableGrid() {
  const { cafeId } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  // Audio kontekst va ruxsat holatini eslab qolish uchun ref ishlatamiz
  const audioCtxRef = useRef(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // SMS tovushini (Beep-Beep signalini) sintez qilish funksiyasi
  const playSmsSound = async () => {
    try {
      // Agar kontekst yaratilmagan bo'lsa, uni yaratamiz
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }

      const ctx = audioCtxRef.current;
      if (!ctx) return;

      // Agar kontekst uyqu holatida bo'lsa (suspended), uni uyg'otamiz
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      // 1-tovush (SMSning birinchi qisqa signali)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(650, now); 
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // 2-tovush (SMSning ikkinchi o'tkirroq signali)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(950, now + 0.06); 
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.15, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.08);
      
      osc2.start(now + 0.06);
      osc2.stop(now + 0.25);
    } catch (e) {
      console.log("SMS ovozini chiqarishda brauzer cheklovi:", e);
    }
  };

  // Foydalanuvchi sahifaga birinchi marta bosganda audio oqimni faollashtirib qo'yish
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().then(() => {
          setAudioUnlocked(true);
        });
      } else {
        setAudioUnlocked(true);
      }
    };

    window.addEventListener("click", handleUserInteraction);
    window.addEventListener("touchstart", handleUserInteraction);

    return () => {
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    if (!cafeId) return;

    const qTables = query(
      collection(db, "tables"),
      where("cafeId", "==", cafeId)
    );
    const unsubTables = onSnapshot(qTables, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      data.sort((a, b) => (a.number || 0) - (b.number || 0));
      setTables(data);
      setLoading(false);
    });

    const qOrders = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId),
      where("paymentStatus", "==", "unpaid")
    );
    
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Haqiqiy vaqtdagi o'zgarishlarni tekshirish
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const updatedOrder = change.doc.data();
          
          // Oshpaz statusni 'ready' qilganda
          if (updatedOrder.kitchenStatus === "ready") {
            playSmsSound();
          }
        }
      });

      setOrders(data);
    });

    return () => {
      unsubTables();
      unsubOrders();
    };
  }, [cafeId]);

  const getTableStatus = (tableNumber) => {
    const activeOrder = orders.find(
      (o) => String(o.tableNumber) === String(tableNumber)
    );
    if (!activeOrder) return "empty";
    if (activeOrder.kitchenStatus === "ready") return "ready";
    return "occupied";
  };

  const getActiveOrder = (tableNumber) => {
    return orders.find(
      (o) => String(o.tableNumber) === String(tableNumber)
    );
  };

  const formatTime = (date) => {
    if (!date) return "";
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!newTableNumber) {
      alert("Iltimos, stol raqamini kiriting");
      return;
    }
    try {
      await addDoc(collection(db, "tables"), {
        cafeId,
        number: Number(newTableNumber),
        createdAt: new Date(),
      });
      setNewTableNumber("");
      setModalOpen(false);
    } catch (error) {
      console.error("Stol qo'shishda xatolik:", error);
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!window.confirm("Bu stolni o'chirishga ishonchingiz komilmi?")) return;
    try {
      await deleteDoc(doc(db, "tables", tableId));
    } catch (error) {
      console.error("Stolni o'chirishda xatolik:", error);
    }
  };

  const markOrderDelivered = async (order) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        kitchenStatus: "delivered",
      });
      setSelectedTable(null);
    } catch (error) {
      console.error("Statusni yangilashda xatolik:", error);
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
    empty: "bg-white border-gray-200 text-gray-700",
    occupied: "bg-amber-50 border-amber-400 text-amber-800",
    ready: "bg-green-50 border-green-500 text-green-800",
  };

  const statusLabels = {
    empty: "Bo'sh",
    occupied: "Band",
    ready: "Tayyor!",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-lg">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Ovoz holati haqida ogohlantirish paneli */}
      {!audioUnlocked && (
        <div className="mb-4 p-2 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs text-center animate-pulse">
          ⚠️ Bildirishnoma ovozi yoqilishi uchun ekran yuzasiga kamida bir marta bosing!
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-amber-800">Stollar</h1>
        <button
          onClick={() => navigate("/waiter/order")}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition"
        >
          + Yangi buyurtma
        </button>
      </div>

      <div className="flex gap-4 mb-4 text-xs text-gray-500 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-white border border-gray-300 inline-block"></span>
          Bo'sh (bosilsa menyuga o'tadi)
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
          Band
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
          Taom tayyor
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tables.map((table) => {
          const status = getTableStatus(table.number);
          const activeOrder = getActiveOrder(table.number);
          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              onContextMenu={(e) => {
                e.preventDefault();
                handleDeleteTable(table.id);
              }}
              className={`relative rounded-xl border-2 p-4 flex flex-col items-center justify-center h-24 transition ${statusStyles[status]} ${
                status === "ready" ? "animate-pulse" : ""
              }`}
            >
              <span className="text-lg font-bold">№{table.number}</span>
              <span className="text-xs mt-1 font-medium">
                {statusLabels[status]}
              </span>
              {activeOrder && (
                <span className="text-[10px] mt-0.5 font-semibold opacity-70">
                  🕐 {formatTime(activeOrder.createdAt)}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={() => setModalOpen(true)}
          className="rounded-xl border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center h-24 text-gray-400 hover:bg-gray-50 hover:border-amber-400 hover:text-amber-600 transition"
        >
          <span className="text-2xl">+</span>
          <span className="text-xs mt-1">Stol qo'shish</span>
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Yangi stol qo'shish</h2>
            <form onSubmit={handleAddTable} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Stol raqami</label>
                <input
                  type="number"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Masalan: 12"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition">Qo'shish</button>
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition">Bekor qilish</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-3 text-gray-800">Stol №{selectedTable.number}</h2>
            {(() => {
              const order = getActiveOrder(selectedTable.number);
              if (!order) return <p className="text-gray-400 text-sm">Buyurtma topilmadi</p>;
              return (
                <>
                  <p className="text-xs text-gray-400 mb-2">🕐 Buyurtma vaqti: {formatTime(order.createdAt)}</p>
                  <div className="space-y-1 mb-3">
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm text-gray-600">
                        <span>{item.name} x{item.quantity}</span>
                        <span>{(item.price * item.quantity).toLocaleString()} so'm</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100 mb-3">
                    <span className="font-semibold text-gray-800">Jami:</span>
                    <span className="font-bold text-amber-700">{Number(order.totalPrice || 0).toLocaleString()} so'm</span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => navigate(`/waiter/order?table=${selectedTable.number}`)} className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition">Taom qo'shish</button>
                    {order.kitchenStatus === "ready" && (
                      <button onClick={() => markOrderDelivered(order)} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">Yetkazildi</button>
                    )}
                  </div>
                </>
              );
            })()}
            <button onClick={() => setSelectedTable(null)} className="w-full border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition">Yopish</button>
          </div>
        </div>
      )}
    </div>
  );
}