import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function Reports() {
  const { cafeId } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");

  // =========================================================
  // BUYURTMALARNI OLISH
  // MUHIM: Billing.jsx ham "orders" collection ishlatyapti
  // =========================================================

  useEffect(() => {
    if (!cafeId) {
      setOrders([]);
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
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setOrders(data);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Hisobotlarni olishda xatolik:", error);
        setOrders([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [cafeId]);

  // =========================================================
  // ORDER SANASINI OLISH
  // =========================================================

  const getOrderDate = (order) => {
    if (order.paidAt?.toDate) {
      return order.paidAt.toDate();
    }

    if (order.createdAt?.toDate) {
      return order.createdAt.toDate();
    }

    if (order.paidAt) {
      const date = new Date(order.paidAt);

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    if (order.createdAt) {
      const date = new Date(order.createdAt);

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  };

  // =========================================================
  // ORDER SUMMASINI OLISH
  // =========================================================

  const getOrderTotal = (order) => {
    // Agar totalPrice mavjud bo'lsa
    if (
      typeof order.totalPrice === "number" &&
      !isNaN(order.totalPrice)
    ) {
      return order.totalPrice;
    }

    // Ba'zi buyurtmalarda total bo'lishi mumkin
    if (
      typeof order.total === "number" &&
      !isNaN(order.total)
    ) {
      return order.total;
    }

    // Aks holda items ichidan hisoblaymiz
    return (order.items || []).reduce((sum, item) => {
      const price = Number(item.price || 0);
      const quantity = Number(
        item.quantity || item.qty || 1
      );

      return sum + price * quantity;
    }, 0);
  };

  // =========================================================
  // VAQT BO'YICHA FILTER
  // =========================================================

  const getFilteredData = () => {
    const now = new Date();

    return orders.filter((order) => {
      const orderDate = getOrderDate(order);

      if (!orderDate) {
        return false;
      }

      // KUNLIK
      if (period === "daily") {
        return (
          orderDate.getDate() === now.getDate() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      }

      // HAFTALIK
      if (period === "weekly") {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);

        return orderDate >= weekAgo && orderDate <= now;
      }

      // OYLIK
      if (period === "monthly") {
        return (
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      }

      // YILLIK
      if (period === "yearly") {
        return orderDate.getFullYear() === now.getFullYear();
      }

      return true;
    });
  };

  const filteredOrders = getFilteredData();

  // =========================================================
  // NAQD
  // =========================================================

  const cashTotal = filteredOrders
    .filter(
      (order) =>
        order.paymentMethod === "cash" ||
        order.paymentMethod === "naqd"
    )
    .reduce(
      (sum, order) => sum + getOrderTotal(order),
      0
    );

  // =========================================================
  // KARTA
  // =========================================================

  const cardTotal = filteredOrders
    .filter(
      (order) =>
        order.paymentMethod === "card" ||
        order.paymentMethod === "karta"
    )
    .reduce(
      (sum, order) => sum + getOrderTotal(order),
      0
    );

  // =========================================================
  // JAMI
  // =========================================================

  const grandTotal = filteredOrders.reduce(
    (sum, order) => sum + getOrderTotal(order),
    0
  );

  // =========================================================
  // ENG KO'P SOTILGAN TAOMLAR
  // =========================================================

  const getItemStats = () => {
    const itemMap = {};

    filteredOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const name =
          item.name ||
          item.title ||
          "Noma'lum";

        const quantity = Number(
          item.quantity ||
            item.qty ||
            1
        );

        const price = Number(
          item.price || 0
        );

        if (!itemMap[name]) {
          itemMap[name] = {
            name,
            count: 0,
            sum: 0,
          };
        }

        itemMap[name].count += quantity;
        itemMap[name].sum +=
          price * quantity;
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const topItems = getItemStats();

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#14151a] flex items-center justify-center">
        <div className="bg-white rounded-2xl px-8 py-6 shadow-xl">
          <p className="font-bold text-gray-700">
            Hisobotlar yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen bg-[#14151a] px-5 sm:px-8 lg:px-12 py-8 md:py-12">

      <div className="max-w-[1200px] mx-auto">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">

          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Hisobotlar
            </h1>

            <p className="text-sm text-gray-400 mt-2">
              Sotuvlar va umumiy tushumlar bo'yicha tahlillar
            </p>
          </div>

          {/* PERIOD */}
          <div className="flex bg-gray-200/90 p-1 rounded-xl text-xs font-bold">

            {[
              {
                id: "daily",
                label: "Kunlik",
              },
              {
                id: "weekly",
                label: "Haftalik",
              },
              {
                id: "monthly",
                label: "Oylik",
              },
              {
                id: "yearly",
                label: "Yillik",
              },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  setPeriod(p.id)
                }
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

        {/* =====================================================
            TUSHUM KARTALARI
        ===================================================== */}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">

          {/* JAMI */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">

            <div className="w-2 h-full bg-green-500 absolute left-0 top-0" />

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Jami Tushum
            </p>

            <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-2">
              {grandTotal.toLocaleString()}{" "}
              <span className="text-xs font-normal text-gray-500">
                so'm
              </span>
            </p>

            <p className="text-xs text-gray-400 mt-2">
              Jami {filteredOrders.length} ta chek yopilgan
            </p>

          </div>

          {/* NAQD */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">

            <div className="w-2 h-full bg-amber-500 absolute left-0 top-0" />

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              💵 Naqd Tushum
            </p>

            <p className="text-2xl sm:text-3xl font-black text-amber-800 mt-2">
              {cashTotal.toLocaleString()}{" "}
              <span className="text-xs font-normal text-gray-500">
                so'm
              </span>
            </p>

            <p className="text-xs text-gray-400 mt-2">
              Ulushi:{" "}
              {grandTotal
                ? Math.round(
                    (cashTotal /
                      grandTotal) *
                      100
                  )
                : 0}
              %
            </p>

          </div>

          {/* KARTA */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">

            <div className="w-2 h-full bg-blue-500 absolute left-0 top-0" />

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              💳 Karta Tushumi
            </p>

            <p className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">
              {cardTotal.toLocaleString()}{" "}
              <span className="text-xs font-normal text-gray-500">
                so'm
              </span>
            </p>

            <p className="text-xs text-gray-400 mt-2">
              Ulushi:{" "}
              {grandTotal
                ? Math.round(
                    (cardTotal /
                      grandTotal) *
                      100
                  )
                : 0}
              %
            </p>

          </div>

        </div>

        {/* =====================================================
            TOP 5
        ===================================================== */}

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-8">

          <h3 className="font-extrabold text-gray-900 text-lg mb-4">
            🔥 Eng ko'p sotilgan taomlar (Top 5)
          </h3>

          {topItems.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">
              Ma'lumotlar mavjud emas
            </p>
          ) : (
            <div className="space-y-3">

              {topItems.map(
                (item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >

                    <div className="flex items-center gap-3">

                      <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center">
                        {index + 1}
                      </span>

                      <div>

                        <p className="font-bold text-gray-800 text-xs">
                          {item.name}
                        </p>

                        <p className="text-[10px] text-gray-400">
                          {item.count} ta sotildi
                        </p>

                      </div>

                    </div>

                    <span className="font-black text-xs text-gray-900">
                      {item.sum.toLocaleString()} so'm
                    </span>

                  </div>
                )
              )}

            </div>
          )}

        </div>

        {/* =====================================================
            TO'LOV TURLARI
        ===================================================== */}

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">

          <h3 className="font-extrabold text-gray-900 text-lg mb-6">
            To'lov turlari nisbati
          </h3>

          <div className="space-y-5">

            {/* NAQD */}

            <div>

              <div className="flex justify-between text-xs font-bold mb-2">

                <span className="text-amber-800">
                  💵 Naqd pul
                </span>

                <span className="text-gray-700">
                  {cashTotal.toLocaleString()} so'm
                </span>

              </div>

              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">

                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      grandTotal
                        ? (cashTotal /
                            grandTotal) *
                          100
                        : 0
                    }%`,
                  }}
                />

              </div>

            </div>

            {/* KARTA */}

            <div>

              <div className="flex justify-between text-xs font-bold mb-2">

                <span className="text-blue-600">
                  💳 Karta orqali
                </span>

                <span className="text-gray-700">
                  {cardTotal.toLocaleString()} so'm
                </span>

              </div>

              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">

                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      grandTotal
                        ? (cardTotal /
                            grandTotal) *
                          100
                        : 0
                    }%`,
                  }}
                />

              </div>

            </div>

          </div>

          <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400">
            💡 Ma'lumotlar tanlangan vaqt oralig'i bo'yicha hisoblangan.
          </div>

        </div>

      </div>

    </div>
  );
}