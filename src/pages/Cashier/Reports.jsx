import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("Oylik"); // Kunlik, Haftalik, Oylik, Yillik

  const periods = [
    { id: "today", label: "Kunlik" },
    { id: "week", label: "Haftalik" },
    { id: "month", label: "Oylik" },
    { id: "year", label: "Yillik" },
  ];

  // =====================================================
  // REALTIME FIRESTORE ORDERS
  // =====================================================
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ordersRef = collection(db, "orders");
    const q = user?.cafeId
      ? query(ordersRef, where("cafeId", "==", user.cafeId))
      : query(ordersRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));
        setOrders(data);
        setLoading(false);
      },
      (error) => {
        console.error("Orders load error:", error);
        toast.error("Hisobotlarni yuklashda xatolik!");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // =====================================================
  // DATE & ITEM HELPER FUNCTIONS
  // =====================================================
  const getDate = (value) => {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getOrderDate = (order) => {
    return (
      getDate(order.closedAt) ||
      getDate(order.paidAt) ||
      getDate(order.updatedAt) ||
      getDate(order.createdAt)
    );
  };

  const getOrderItems = (order) => {
    if (!order) return [];
    if (Array.isArray(order.items)) return order.items;
    if (Array.isArray(order.kitchenItems)) return order.kitchenItems;
    if (Array.isArray(order.products)) return order.products;
    return [];
  };

  const getOrderTotal = (order) => {
    if (order.totalAmount !== undefined && order.totalAmount !== null && !Number.isNaN(Number(order.totalAmount))) {
      return Number(order.totalAmount);
    }
    if (order.total !== undefined && order.total !== null && !Number.isNaN(Number(order.total))) {
      return Number(order.total);
    }
    if (order.totalPrice !== undefined && order.totalPrice !== null && !Number.isNaN(Number(order.totalPrice))) {
      return Number(order.totalPrice);
    }

    return getOrderItems(order).reduce((sum, item) => {
      const price = Number(item.price || 0);
      const quantity = Number(item.quantity ?? item.count ?? item.qty ?? 1);
      return sum + price * quantity;
    }, 0);
  };

  const isPaidOrder = (order) => {
    const status = String(order.status || "").trim().toLowerCase();
    const paymentStatus = String(order.paymentStatus || "").trim().toLowerCase();
    return (
      order.isPaid === true ||
      paymentStatus === "paid" ||
      status === "paid" ||
      status === "completed" ||
      status === "closed"
    );
  };

  const isInSelectedPeriod = (date) => {
    if (!date) return false;
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === "Kunlik" || period === "today") return date >= startToday;
    if (period === "Haftalik" || period === "week") {
      const weekStart = new Date(startToday);
      weekStart.setDate(startToday.getDate() - 6);
      return date >= weekStart;
    }
    if (period === "Oylik" || period === "month") {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }
    if (period === "Yillik" || period === "year") return date.getFullYear() === now.getFullYear();

    return true;
  };

  const paidOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!isPaidOrder(order)) return false;
      const orderDate = getOrderDate(order);
      return isInSelectedPeriod(orderDate);
    });
  }, [orders, period]);

  // =====================================================
  // STATISTIKA HISOBLARI
  // =====================================================
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let cashRevenue = 0;
    let cardRevenue = 0;
    let clickRevenue = 0;
    let orderCount = 0;

    paidOrders.forEach((order) => {
      const total = getOrderTotal(order);
      totalRevenue += total;
      orderCount += 1;

      const method = String(
        order.paymentMethod || order.paymentType || order.payment || ""
      ).trim().toLowerCase();

      if (method.includes("cash") || method.includes("naqd")) {
        cashRevenue += total;
      } else if (method.includes("click")) {
        clickRevenue += total;
      } else {
        cardRevenue += total;
      }
    });

    const averageCheck = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
    return { totalRevenue, cashRevenue, cardRevenue, clickRevenue, orderCount, averageCheck };
  }, [paidOrders]);

  // Top 5 taomlarni hisoblash (Dinamik)
  const topDishes = useMemo(() => {
    const dishMap = {};

    paidOrders.forEach((order) => {
      const items = getOrderItems(order);
      items.forEach((item) => {
        const name = item.name || item.title || "Noma'lum taom";
        const qty = Number(item.quantity ?? item.count ?? item.qty ?? 1);
        const price = Number(item.price || 0);

        if (!dishMap[name]) {
          dishMap[name] = { count: 0, total: 0 };
        }
        dishMap[name].count += qty;
        dishMap[name].total += price * qty;
      });
    });

    return Object.entries(dishMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [paidOrders]);

  // Formatterlar
  const formatMoney = (amount) => `${Number(amount || 0).toLocaleString("uz-UZ")} so'm`;
  const formatDate = (value) => {
    const date = getDate(value);
    return date ? date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
  };
  const formatTime = (value) => {
    const date = getDate(value);
    return date ? date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "-";
  };

  const getPaymentMethodLabel = (order) => {
    const method = String(order.paymentMethod || order.paymentType || order.payment || "").trim().toLowerCase();
    if (method.includes("cash") || method.includes("naqd")) return "Naqd pul";
    if (method.includes("click")) return "Click";
    return "Karta orqali";
  };

  const cashPercent = stats.totalRevenue > 0 ? ((stats.cashRevenue / stats.totalRevenue) * 100).toFixed(0) : 0;
  const cardTotalRevenue = stats.cardRevenue + stats.clickRevenue;
  const cardPercent = stats.totalRevenue > 0 ? ((cardTotalRevenue / stats.totalRevenue) * 100).toFixed(0) : 0;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-pulse">📊</div>
          <p className="mt-4 font-bold text-slate-500">Hisobotlar yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#f8fafc] min-h-screen font-sans text-[#243447]">
      <main className="max-w-[1250px] mx-auto">
        {/* Yuqori qism: Sarlavha va Filtrlar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800">Kassa Hisobotlari</h1>
            <p className="text-slate-400 text-sm mt-1">Sotuvlar va umumiy tushumlar bo'yicha tahlillar</p>
          </div>

          <div className="bg-slate-200/60 p-1 rounded-2xl flex items-center gap-1 w-fit">
            {periods.map((item) => (
              <button
                key={item.id}
                onClick={() => setPeriod(item.label)}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  period === item.label
                    ? "bg-white text-slate-800 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Yuqori KPI kartalar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border-l-4 border-l-emerald-500 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">JAMI TUSHUM</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800">{stats.totalRevenue.toLocaleString("uz-UZ")}</span>
              <span className="text-sm font-medium text-slate-400">so'm</span>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Jami {stats.orderCount} ta chek yopilgan</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border-l-4 border-l-amber-500 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">💵 NAQD TUSHUM</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800">{stats.cashRevenue.toLocaleString("uz-UZ")}</span>
              <span className="text-sm font-medium text-slate-400">so'm</span>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Ulushi: {cashPercent}%</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border-l-4 border-l-blue-500 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">💳 KARTA TUSHUMI</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-600">{cardTotalRevenue.toLocaleString("uz-UZ")}</span>
              <span className="text-sm font-medium text-slate-400">so'm</span>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Ulushi: {cardPercent}%</p>
          </div>
        </div>

        {/* Nisbatlar va Top taomlar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-6">To'lov turlari nisbati</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center text-sm font-bold text-slate-700 mb-2">
                    <span className="flex items-center gap-2">💵 Naqd pul</span>
                    <span>{formatMoney(stats.cashRevenue)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${cashPercent}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-sm font-bold text-slate-700 mb-2">
                    <span className="flex items-center gap-2">💳 Karta / Click</span>
                    <span>{formatMoney(cardTotalRevenue)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${cardPercent}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-50 text-xs text-slate-400 font-medium">
              💡 O'rtacha chek summasi: <span className="font-bold text-slate-700">{formatMoney(stats.averageCheck)}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">🔥 Eng ko'p sotilgan taomlar (Top 5)</h3>
            {topDishes.length === 0 ? (
              <p className="text-slate-400 text-sm py-8 text-center">Ma'lumot mavjud emas</p>
            ) : (
              <div className="space-y-3">
                {topDishes.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-amber-100/80 text-amber-700 font-bold text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                        <p className="text-xs text-slate-400">{item.count} ta sotildi</p>
                      </div>
                    </div>
                    <span className="font-extrabold text-slate-800 text-sm">{formatMoney(item.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Buyurtmalar jadvali */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">To'langan buyurtmalar jadvali</h2>
              <p className="text-sm text-slate-400 mt-1">Tanlangan davr bo'yicha to'lovlar va cheklar</p>
            </div>
            <span className="bg-blue-50 text-[#2454b8] px-4 py-2 rounded-xl text-xs font-black w-fit">
              {paidOrders.length} ta buyurtma
            </span>
          </div>

          {paidOrders.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">📭</div>
              <h3 className="font-bold text-slate-600">Hozircha ma'lumot mavjud emas</h3>
              <p className="text-sm text-slate-400 mt-1">Ushbu davrda to'langan buyurtmalar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px]">
                <thead>
                  <tr className="bg-slate-50/80 text-left">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Vaqt</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Stol</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Tarkib</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">To'lov turi</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Jami</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paidOrders
                    .slice()
                    .sort((a, b) => (getOrderDate(b)?.getTime() || 0) - (getOrderDate(a)?.getTime() || 0))
                    .map((order) => {
                      const orderDate = getOrderDate(order);
                      const tableNumber = order.tableNumber ?? order.table ?? order.tableNo ?? "-";
                      const paymentLabel = getPaymentMethodLabel(order);

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4">
                            <div className="font-bold text-sm text-slate-700">{formatTime(orderDate)}</div>
                            <div className="text-xs text-slate-400">{formatDate(orderDate)}</div>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">№ {tableNumber}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{getOrderItems(order).length} ta mahsulot</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold ${
                                paymentLabel === "Naqd pul"
                                  ? "bg-amber-50 text-amber-700"
                                  : paymentLabel === "Click"
                                  ? "bg-sky-50 text-sky-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {paymentLabel}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-black text-slate-800">{formatMoney(getOrderTotal(order))}</td>
                          <td className="px-6 py-4 text-sm font-bold text-emerald-600">✓ To'langan</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}