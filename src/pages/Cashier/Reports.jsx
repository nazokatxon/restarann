import React, { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function Reports() {
  const { cafeId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly"); // daily, weekly, monthly, yearly

  useEffect(() => {
    if (!cafeId) return;

    // To'g'ri sub-collection yo'li: cafes/{cafeId}/orders
    const q = query(collection(db, "cafes", cafeId, "orders"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setOrders(data);
      setLoading(false);
    }, (error) => {
      console.error("Xatolik:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [cafeId]);

  // 📊 MOLIYAVIY HISOBOTLARNI SHAKLLANTIRISH
  const getFilteredData = () => {
    const now = new Date();

    return orders.filter((o) => {
      const paidDate = o.paidAt?.toDate ? o.paidAt.toDate() : new Date(o.paidAt || 0);

      if (period === "daily") {
        return paidDate.toDateString() === now.toDateString();
      } else if (period === "weekly") {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return paidDate >= weekAgo;
      } else if (period === "monthly") {
        return (
          paidDate.getMonth() === now.getMonth() &&
          paidDate.getFullYear() === now.getFullYear()
        );
      } else if (period === "yearly") {
        return paidDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const filteredOrders = getFilteredData();

  // Statistika hisoblari
  const cashTotal = filteredOrders
    .filter((o) => o.paymentMethod === "cash")
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  const cardTotal = filteredOrders
    .filter((o) => o.paymentMethod === "card")
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  const grandTotal = cashTotal + cardTotal;

  // 🔥 Eng ko'p sotilgan taomlar tahlili (Top 5)
  const getItemStats = () => {
    const itemMap = {};
    filteredOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const name = item.name || item.title || "Noma'lum";
        const qty = item.quantity || item.qty || 1;
        const price = item.price || 0;

        if (itemMap[name]) {
          itemMap[name].count += qty;
          itemMap[name].sum += price * qty;
        } else {
          itemMap[name] = {
            name: name,
            count: qty,
            sum: price * qty,
          };
        }
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
  };

  const topItems = getItemStats();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 w-full gap-2">
        <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm font-medium">Hisobotlar yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full transition-all pb-24">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Kassa</h1>
          <p className="text-sm text-gray-500 mt-1">Sotuvlar va umumiy tushumlar bo'yicha tahlillar</p>
        </div>

        {/* Period Selector */}
        <div className="flex bg-gray-200/70 p-1 rounded-xl text-xs font-bold">
          {[
            { id: "daily", label: "Kunlik" },
            { id: "weekly", label: "Haftalik" },
            { id: "monthly", label: "Oylik" },
            { id: "yearly", label: "Yillik" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-lg transition-all ${
                period === p.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 💳 TUSHUM KARTALARI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="w-2 h-full bg-green-500 absolute left-0 top-0"></div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Jami Tushum</p>
          <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-2">
            {grandTotal.toLocaleString()} <span className="text-xs font-normal text-gray-500">so'm</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">Jami {filteredOrders.length} ta chek yopilgan</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="w-2 h-full bg-amber-500 absolute left-0 top-0"></div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">💵 Naqd Tushum</p>
          <p className="text-2xl sm:text-3xl font-black text-amber-800 mt-2">
            {cashTotal.toLocaleString()} <span className="text-xs font-normal text-gray-500">so'm</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Ulushi: {grandTotal ? Math.round((cashTotal / grandTotal) * 100) : 0}%
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="w-2 h-full bg-blue-500 absolute left-0 top-0"></div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">💳 Karta Tushumi</p>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">
            {cardTotal.toLocaleString()} <span className="text-xs font-normal text-gray-500">so'm</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Ulushi: {grandTotal ? Math.round((cardTotal / grandTotal) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* 🔥 ENG KO'P SOTILGAN TAOMLAR (TOP 5) */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-8">
        <h3 className="font-extrabold text-gray-900 text-lg mb-4">🔥 Eng ko'p sotilgan taomlar (Top 5)</h3>
        
        {topItems.length === 0 ? (
          <p className="text-xs text-gray-400 py-8 text-center">Ma'lumotlar mavjud emas</p>
        ) : (
          <div className="space-y-3">
            {topItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-gray-800 text-xs">{item.name}</p>
                    <p className="text-[10px] text-gray-400">{item.count} ta sotildi</p>
                  </div>
                </div>
                <span className="font-black text-xs text-gray-900">
                  {item.sum.toLocaleString()} so'm
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 📈 TO'LOV TURLARI NISBATI VIZUALIZATSIYASI */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
        <h3 className="font-extrabold text-gray-900 text-lg mb-4">To'lov turlari nisbati</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-amber-800">💵 Naqd pul</span>
              <span className="text-gray-700">{cashTotal.toLocaleString()} so'm</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${grandTotal ? (cashTotal / grandTotal) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-blue-600">💳 Karta orqali</span>
              <span className="text-gray-700">{cardTotal.toLocaleString()} so'm</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${grandTotal ? (cardTotal / grandTotal) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400">
          💡 Ma'lumotlar tanlangan vaqt oralig'i bo'yicha hisoblangan.
        </div>
      </div>

    </div>
  );
}