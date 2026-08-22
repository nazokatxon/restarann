import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth(); // Kafe id bo'yicha filter qilish uchun

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("today");

  // =====================================================
  // ORDERS REALTIME (cafeId bo'yicha saralash)
  // =====================================================

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ordersRef = collection(db, "orders");
    
    // Agar foydalanuvchida cafeId bo'lsa, faqat shuning buyurtmalarini olamiz
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
  // DATE HELPER
  // =====================================================

  const getDate = (value) => {
    if (!value) return null;
    if (value?.toDate) return value.toDate();

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date;
  };

  const getOrderDate = (order) => {
    return (
      getDate(order.closedAt) ||
      getDate(order.paidAt) ||
      getDate(order.updatedAt) ||
      getDate(order.createdAt)
    );
  };

  // =====================================================
  // ORDER ITEMS & TOTAL
  // =====================================================

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

  // =====================================================
  // PERIOD CHECK
  // =====================================================

  const isInSelectedPeriod = (date) => {
    if (!date) return false;
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === "today") return date >= startToday;
    if (period === "week") {
      const weekStart = new Date(startToday);
      weekStart.setDate(startToday.getDate() - 6);
      return date >= weekStart;
    }
    if (period === "month") {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }
    if (period === "year") return date.getFullYear() === now.getFullYear();

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
  // STATISTICS (Naqd, Karta, Click alohida ajratilgan)
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

    return {
      totalRevenue,
      cashRevenue,
      cardRevenue,
      clickRevenue,
      orderCount,
      averageCheck,
    };
  }, [paidOrders]);

  // =====================================================
  // FORMATTERS & LABELS
  // =====================================================

  const formatMoney = (amount) => `${Number(amount || 0).toLocaleString("uz-UZ")} so'm`;

  const formatDate = (value) => {
    const date = getDate(value);
    if (!date) return "-";
    return date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatTime = (value) => {
    const date = getDate(value);
    if (!date) return "-";
    return date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  };

  const getPaymentMethodLabel = (order) => {
    const method = String(order.paymentMethod || order.paymentType || order.payment || "").trim().toLowerCase();
    if (method.includes("cash") || method.includes("naqd")) return "Naqd pul";
    if (method.includes("click")) return "Click";
    return "Karta orqali";
  };

  const cashPercent = stats.totalRevenue > 0 ? (stats.cashRevenue / stats.totalRevenue) * 100 : 0;
  const cardPercent = stats.totalRevenue > 0 ? (stats.cardRevenue / stats.totalRevenue) * 100 : 0;
  const clickPercent = stats.totalRevenue > 0 ? (stats.clickRevenue / stats.totalRevenue) * 100 : 0;

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
    <div className="min-h-screen bg-[#f8fafc] text-[#243447]">
      <main className="max-w-[1250px] mx-auto px-5 py-8">
        {/* SARTAVHA */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#fff7e7] flex items-center justify-center text-2xl shadow-sm">
              📊
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800">Hisobotlar</h1>
              <p className="text-sm text-slate-400 mt-1">Kafe savdo va to'lovlar statistikasi</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-3 text-sm font-medium text-slate-500">
            📅 {formatDate(new Date())}
          </div>
        </div>

        {/* DAVR SHABLONLARI */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-6 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {[
              { id: "today", label: "Bugun" },
              { id: "week", label: "Haftalik" },
              { id: "month", label: "Oylik" },
              { id: "year", label: "Yillik" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  period === item.id
                    ? "bg-[#2454b8] text-white shadow-lg shadow-blue-100"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* ASOSIY STATISTIKA KARTALARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400">Jami tushum</span>
              <span className="text-xl">💰</span>
            </div>
            <div className="mt-5 text-2xl font-black text-[#16865c]">{formatMoney(stats.totalRevenue)}</div>
            <p className="text-xs text-slate-400 mt-3">{stats.orderCount} ta to'langan buyurtma</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400">Naqd pul</span>
              <span className="text-xl">💵</span>
            </div>
            <div className="mt-5 text-2xl font-black text-[#d97706]">{formatMoney(stats.cashRevenue)}</div>
            <p className="text-xs text-slate-400 mt-3">Naqd to'lovlar</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400">Karta / Click</span>
              <span className="text-xl">💳</span>
            </div>
            <div className="mt-5 text-2xl font-black text-[#2454b8]">{formatMoney(stats.cardRevenue + stats.clickRevenue)}</div>
            <p className="text-xs text-slate-400 mt-3">Terminal va ilovalar</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400">O'rtacha chek</span>
              <span className="text-xl">🧾</span>
            </div>
            <div className="mt-5 text-2xl font-black text-[#6d35c9]">{formatMoney(stats.averageCheck)}</div>
            <p className="text-xs text-slate-400 mt-3">Har bir buyurtma uchun</p>
          </div>
        </div>

        {/* CHART & DETAILS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 mb-7">To'lovlar nisbati</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-8">
              <div className="relative w-40 h-40 shrink-0">
                <div
                  className="w-40 h-40 rounded-full"
                  style={{
                    background:
                      stats.totalRevenue > 0
                        ? `conic-gradient(
                            #16865c 0 ${cashPercent}%,
                            #2454b8 ${cashPercent}% ${cashPercent + cardPercent}%,
                            #0052cc ${cashPercent + cardPercent}% 100%
                          )`
                        : "#e2e8f0",
                  }}
                />
                <div className="absolute inset-5 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                  <span className="text-xl font-black text-slate-700">{stats.orderCount}</span>
                  <span className="text-xs text-slate-400 mt-1">ta</span>
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-5">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-[#16865c]" />
                      <span className="font-bold text-sm text-slate-700">Naqd pul</span>
                    </div>
                    <span className="text-sm font-bold text-[#16865c]">{cashPercent.toFixed(1)}%</span>
                  </div>
                  <p className="text-sm text-slate-500 ml-6 mt-1">{formatMoney(stats.cashRevenue)}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-5">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-[#2454b8]" />
                      <span className="font-bold text-sm text-slate-700">Karta</span>
                    </div>
                    <span className="text-sm font-bold text-[#2454b8]">{cardPercent.toFixed(1)}%</span>
                  </div>
                  <p className="text-sm text-slate-500 ml-6 mt-1">{formatMoney(stats.cardRevenue)}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-5">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-[#0052cc]" />
                      <span className="font-bold text-sm text-slate-700">Click</span>
                    </div>
                    <span className="text-sm font-bold text-[#0052cc]">{clickPercent.toFixed(1)}%</span>
                  </div>
                  <p className="text-sm text-slate-500 ml-6 mt-1">{formatMoney(stats.clickRevenue)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 mb-6">Qisqa ma'lumot</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-5 py-4">
                <span className="text-sm text-slate-500">To'langan buyurtmalar</span>
                <span className="font-black text-[#2454b8]">{stats.orderCount} ta</span>
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-5 py-4">
                <span className="text-sm text-slate-500">Jami savdo</span>
                <span className="font-black text-[#16865c]">{formatMoney(stats.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-5 py-4">
                <span className="text-sm text-slate-500">O'rtacha buyurtma</span>
                <span className="font-black text-[#6d35c9]">{formatMoney(stats.averageCheck)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* JADVAL */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-800">To'langan buyurtmalar</h2>
              <p className="text-sm text-slate-400 mt-1">Tanlangan davr bo'yicha to'lovlar</p>
            </div>
            <span className="bg-blue-50 text-[#2454b8] px-4 py-2 rounded-xl text-xs font-black">
              {paidOrders.length} ta
            </span>
          </div>

          {paidOrders.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-5xl mb-4">📭</div>
              <h3 className="font-bold text-slate-600">Hozircha ma'lumot mavjud emas</h3>
              <p className="text-sm text-slate-400 mt-2">Ushbu davrda to'langan buyurtmalar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Vaqt</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Stol</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Buyurtma</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">To'lov turi</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Jami</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {paidOrders
                    .slice()
                    .sort((a, b) => (getOrderDate(b)?.getTime() || 0) - (getOrderDate(a)?.getTime() || 0))
                    .map((order) => {
                      const orderDate = getOrderDate(order);
                      const tableNumber = order.tableNumber ?? order.table ?? order.tableNo ?? "-";
                      const paymentLabel = getPaymentMethodLabel(order);

                      return (
                        <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                          <td className="px-6 py-5">
                            <div className="font-bold text-sm text-slate-700">{formatTime(orderDate)}</div>
                            <div className="text-xs text-slate-400 mt-1">{formatDate(orderDate)}</div>
                          </td>
                          <td className="px-6 py-5 font-bold text-slate-700">№ {tableNumber}</td>
                          <td className="px-6 py-5">
                            <span className="text-sm text-slate-600">{getOrderItems(order).length} ta mahsulot</span>
                          </td>
                          <td className="px-6 py-5">
                            <span
                              className={`inline-flex px-3 py-2 rounded-lg text-xs font-bold ${
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
                          <td className="px-6 py-5 font-black text-slate-800">{formatMoney(getOrderTotal(order))}</td>
                          <td className="px-6 py-5">
                            <span className="text-sm font-bold text-emerald-600">✓ To'langan</span>
                          </td>
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