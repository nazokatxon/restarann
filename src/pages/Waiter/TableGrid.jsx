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
  const { cafeId, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  // Audio kontekst va ruxsat holati uchun ref
  const audioCtxRef = useRef(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Logout funksiyasi
  const handleLogout = async () => {
    if (window.confirm("Tizimdan chiqmoqchimisiz?")) {
      try {
        if (logout) await logout();
        navigate("/login");
      } catch (error) {
        console.error("Chiqishda xatolik:", error);
      }
    }
  };

  // SMS tovushini sintez qilish funksiyasi
  const playSmsSound = async () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }

      const ctx = audioCtxRef.current;
      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(650, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);

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

      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const updatedOrder = change.doc.data();
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
    empty: "bg-white border-slate-200 text-slate-700 hover:border-amber-400",
    occupied: "bg-amber-100 border-amber-400 text-amber-900",
    ready: "bg-emerald-100 border-emerald-500 text-emerald-900",
  };

  const statusLabels = {
    empty: "Bo'sh",
    occupied: "Band",
    ready: "Tayyor!",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-lg font-medium">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 w-full flex flex-col">
      {/* SHAPKA / HEADER — Oq fondagi navbar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sm:px-8 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">👑</span>
          <span className="font-bold text-lg text-slate-900">Control Hub</span>
          <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded uppercase">
            Ofitsiant
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 font-medium hidden sm:inline">
            {currentUser?.email || "Ofitsiant"}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            {/* Standart SVG Ikonka */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Chiqish
          </button>
        </div>
      </header>

      {/* ASOSIY KONTENT */}
      <main className="max-w-5xl w-full mx-auto p-4 sm:p-6 flex-1">
        {!audioUnlocked && (
          <div className="mb-4 p-2.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs text-center font-medium animate-pulse">
            ⚠️ Bildirishnoma ovozi yoqilishi uchun ekran yuzasiga kamida bir marta bosing!
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-amber-600">
            Stollar
          </h1>
          <button
            onClick={() => navigate("/waiter/order")}
            className="bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition shadow-sm"
          >
            + Yangi buyurtma
          </button>
        </div>

        <div className="flex gap-4 mb-5 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-white border border-slate-300 inline-block"></span>
            Bo'sh (bosilsa menyuga o'tadi)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
            Band
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            Taom tayyor
          </div>
        </div>

        {/* STOLLAR GRIDI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
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
                className={`relative rounded-2xl border-2 p-4 flex flex-col items-center justify-center h-28 transition shadow-sm cursor-pointer ${
                  statusStyles[status]
                } ${status === "ready" ? "animate-pulse" : ""}`}
              >
                <span className="text-xl font-bold">№{table.number}</span>
                <span className="text-xs mt-1 font-medium">
                  {statusLabels[status]}
                </span>
                {activeOrder && (
                  <span className="text-[10px] mt-1 font-semibold opacity-75">
                    🕐 {formatTime(activeOrder.createdAt)}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={() => setModalOpen(true)}
            className="rounded-2xl border-2 border-dashed border-slate-300 p-4 flex flex-col items-center justify-center h-28 text-slate-400 hover:bg-slate-100/50 hover:border-amber-500 hover:text-amber-600 transition cursor-pointer"
          >
            <span className="text-2xl font-light">+</span>
            <span className="text-xs mt-1 font-semibold">Stol qo'shish</span>
          </button>
        </div>
      </main>

      {/* MODAL - STOL QO'SHISH */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4 text-slate-800">
              Yangi stol qo'shish
            </h2>
            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Stol raqami
                </label>
                <input
                  type="number"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Masalan: 12"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition"
                >
                  Qo'shish
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - STOL MA'LUMOTLARI */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-3 text-slate-800">
              Stol №{selectedTable.number}
            </h2>
            {(() => {
              const order = getActiveOrder(selectedTable.number);
              if (!order)
                return (
                  <p className="text-slate-400 text-sm mb-4">
                    Buyurtma topilmadi
                  </p>
                );
              return (
                <>
                  <p className="text-xs text-slate-400 mb-3">
                    🕐 Buyurtma vaqti: {formatTime(order.createdAt)}
                  </p>
                  <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
                    {(order.items || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm text-slate-600"
                      >
                        <span>
                          {item.name} x{item.quantity}
                        </span>
                        <span className="font-medium">
                          {(item.price * item.quantity).toLocaleString()} so'm
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 mb-4">
                    <span className="font-semibold text-slate-800">Jami:</span>
                    <span className="font-bold text-amber-600 text-base">
                      {Number(order.totalPrice || 0).toLocaleString()} so'm
                    </span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() =>
                        navigate(
                          `/waiter/order?table=${selectedTable.number}`
                        )
                      }
                      className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition"
                    >
                      Taom qo'shish
                    </button>
                    {order.kitchenStatus === "ready" && (
                      <button
                        onClick={() => markOrderDelivered(order)}
                        className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition"
                      >
                        Yetkazildi
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
            <button
              onClick={() => setSelectedTable(null)}
              className="w-full border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
            >
              Yopish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}