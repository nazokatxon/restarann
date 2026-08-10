import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function Reports() {
  const { cafeId, logout } = useAuth();
  const navigate = useNavigate();

  const [period, setPeriod] = useState("daily"); // daily, weekly, monthly, yearly
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Firestore'dan to'langan buyurtmalarni olish
  useEffect(() => {
    if (!cafeId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId),
      where("paymentStatus", "==", "paid")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.error("Hisobotlarni olishda xatolik:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [cafeId]);

  // Vaqt bo'yicha saralash
  const filteredOrders = orders.filter((order) => {
    if (!order.paidAt) return true; // Agar paidAt bo'lmasa, ko'rsataveradi
    const date = order.paidAt.toDate ? order.paidAt.toDate() : new Date(order.paidAt);
    const now = new Date();

    if (period === "daily") {
      return date.toDateString() === now.toDateString();
    }
    if (period === "weekly") {
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    if (period === "monthly") {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (period === "yearly") {
      return date.getFullYear() === now.getFullYear();
    }
    return true;
  });

  // Hisob-kitoblar
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const cashRevenue = filteredOrders
    .filter((o) => o.paymentMethod === "cash")
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const cardRevenue = filteredOrders
    .filter((o) => o.paymentMethod === "card")
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  const cashPercent = totalRevenue ? Math.round((cashRevenue / totalRevenue) * 100) : 0;
  const cardPercent = totalRevenue ? Math.round((cardRevenue / totalRevenue) * 100) : 0;

  // Top 5 taomlar
  const foodStats = {};
  filteredOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const name = item.name || item.title || "Noma'lum taom";
      const qty = Number(item.quantity || item.qty || 1);
      foodStats[name] = (foodStats[name] || 0) + qty;
    });
  });

  const topFoods = Object.entries(foodStats)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#18181b] text-white flex">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#211a18] text-white hidden md:flex flex-col justify-between p-4 fixed left-0 top-0 bottom-0 z-40 border-r border-[#322825]">
        <div>
          <div className="flex items-center gap-3 px-3 py-4 mb-4">
            <span className="text-2xl">☕</span>
            <h1 className="text-2xl font-serif italic text-[#f3dfc8]">AI Cafe</h1>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => navigate("/cashier/billing")}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#322825] rounded-xl font-medium transition text-left"
            >
              <span>💳</span>
              <span>Kassa</span>
            </button>

            <button
              onClick={() => navigate("/cashier/reports")}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#4a3528] text-white rounded-xl font-medium transition text-left"
            >
              <span>📊</span>
              <span>Hisobotlar</span>
            </button>

            <button
              onClick={() => navigate("/cashier/tables")}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#322825] rounded-xl font-medium transition text-left"
            >
              <span>🍽️</span>
              <span>Stollar</span>
            </button>

            <button
              onClick={() => navigate("/cashier/menu")}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#322825] rounded-xl font-medium transition text-left"
            >
              <span>📜</span>
              <span>Menyu</span>
            </button>

            <button
              onClick={() => navigate("/cashier/staff")}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#322825] rounded-xl font-medium transition text-left"
            >
              <span>👥</span>
              <span>Xodimlar</span>
            </button>

            <button
              onClick={() => navigate("/cashier/settings")}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#322825] rounded-xl font-medium transition text-left"
            >
              <span>⚙️</span>
              <span>Sozlamalar</span>
            </button>
          </nav>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-[#322825] rounded-xl font-medium transition text-left"
        >
          <span>🚪</span>
          <span>Chiqish</span>
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-64 p-6 md:p-10">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header & Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Hisobotlar</h1>
              <p className="text-gray-400 text-sm mt-1">Sotuvlar va umumiy tushumlar bo'yicha tahlillar</p>
            </div>

            <div className="bg-[#27272a] p-1 rounded-xl flex gap-1 border border-gray-800 text-xs">
              {[
                { id: "daily", label: "Kunlik" },
                { id: "weekly", label: "Haftalik" },
                { id: "monthly", label: "Oylik" },
                { id: "yearly", label: "Yillik" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPeriod(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    period === tab.id ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white text-black rounded-2xl p-6 border-l-4 border-emerald-500 shadow-md">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Jami tushum</p>
              <h2 className="text-3xl font-extrabold mt-2">{totalRevenue.toLocaleString()} <span className="text-sm font-normal">so'm</span></h2>
              <p className="text-xs text-gray-400 mt-2">Jami {filteredOrders.length} ta chek yopilgan</p>
            </div>

            <div className="bg-white text-black rounded-2xl p-6 border-l-4 border-amber-500 shadow-md">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">💵 Naqd tushum</p>
              <h2 className="text-3xl font-extrabold text-amber-600 mt-2">{cashRevenue.toLocaleString()} <span className="text-sm font-normal text-black">so'm</span></h2>
              <p className="text-xs text-gray-400 mt-2">Ulushi: {cashPercent}%</p>
            </div>

            <div className="bg-white text-black rounded-2xl p-6 border-l-4 border-blue-500 shadow-md">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">💳 Karta tushumi</p>
              <h2 className="text-3xl font-extrabold text-blue-600 mt-2">{cardRevenue.toLocaleString()} <span className="text-sm font-normal text-black">so'm</span></h2>
              <p className="text-xs text-gray-400 mt-2">Ulushi: {cardPercent}%</p>
            </div>
          </div>

          {/* Top 5 Taomlar */}
          <div className="bg-white text-black rounded-2xl p-6 shadow-md">
            <h3 className="text-lg font-bold mb-4">🔥 Eng ko'p sotilgan taomlar (Top 5)</h3>
            {topFoods.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm">Ma'lumotlar mavjud emas</p>
            ) : (
              <div className="space-y-3">
                {topFoods.map((food, idx) => (
                  <div key={food.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="font-medium text-sm">{idx + 1}. {food.name}</span>
                    <span className="font-bold text-amber-700">{food.count} dona</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* To'lov Turlari Nisbati */}
          <div className="bg-white text-black rounded-2xl p-6 shadow-md space-y-4">
            <h3 className="text-lg font-bold">To'lov turlari nisbati</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between font-semibold">
                <span>💵 Naqd pul</span>
                <span>{cashRevenue.toLocaleString()} so'm</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full transition-all" style={{ width: `${cashPercent}%` }}></div>
              </div>

              <div className="flex justify-between font-semibold pt-2">
                <span>💳 Karta orqali</span>
                <span>{cardRevenue.toLocaleString()} so'm</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full transition-all" style={{ width: `${cardPercent}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}