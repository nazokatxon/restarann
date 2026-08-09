import React, { useEffect, useState } from "react";
import { collection, query, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";

export default function Billing() {
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
      // Faqat to'langan orderlarni olish (agar status maydoni bo'lsa)
      if (o.paymentStatus && o.paymentStatus !== "paid") return false;

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

  // Eng ko'p sotilgan taomlar tahlili (Top Sell)
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
      <div className="flex bg-[#FAFAF9] min-h-screen">
        <Sidebar />
        <div className="flex flex-col items-center justify-center h-64 w-full gap-2">
          <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm font-medium">Tahlillar yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#FAFAF9] min-h-screen">
      <Sidebar />
      <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full transition-all">
        
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

        {/* Top 5 Taomlar */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
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

      </div>
    </div>
  );
}