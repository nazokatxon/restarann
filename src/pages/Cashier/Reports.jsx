import React, { useEffect, useMemo, useState } from "react";
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
  // =========================================================

  useEffect(() => {
    if (!cafeId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

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
      (error) => {
        console.error(
          "❌ Hisobotlarni olishda xatolik:",
          error
        );

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
    if (order?.paidAt?.toDate) {
      return order.paidAt.toDate();
    }

    if (order?.createdAt?.toDate) {
      return order.createdAt.toDate();
    }

    if (order?.paidAt) {
      const date = new Date(order.paidAt);

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    if (order?.createdAt) {
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
    if (
      typeof order?.totalPrice === "number" &&
      !isNaN(order.totalPrice)
    ) {
      return order.totalPrice;
    }

    if (
      typeof order?.total === "number" &&
      !isNaN(order.total)
    ) {
      return order.total;
    }

    if (
      typeof order?.totalAmount === "number" &&
      !isNaN(order.totalAmount)
    ) {
      return order.totalAmount;
    }

    if (
      typeof order?.amount === "number" &&
      !isNaN(order.amount)
    ) {
      return order.amount;
    }

    return (order?.items || []).reduce(
      (sum, item) => {
        const price = Number(item?.price || 0);

        const quantity = Number(
          item?.quantity ||
            item?.qty ||
            1
        );

        return sum + price * quantity;
      },
      0
    );
  };

  // =========================================================
  // VAQT BO'YICHA FILTER
  // =========================================================

  const filteredOrders = useMemo(() => {
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

        return (
          orderDate >= weekAgo &&
          orderDate <= now
        );
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
        return (
          orderDate.getFullYear() ===
          now.getFullYear()
        );
      }

      return true;
    });
  }, [orders, period]);

  // =========================================================
  // NAQD TUSHUM
  // =========================================================

  const cashTotal = useMemo(() => {
    return filteredOrders
      .filter((order) => {
        const method = String(
          order?.paymentMethod || ""
        ).toLowerCase();

        return (
          method === "cash" ||
          method === "naqd"
        );
      })
      .reduce(
        (sum, order) =>
          sum + getOrderTotal(order),
        0
      );
  }, [filteredOrders]);

  // =========================================================
  // KARTA TUSHUM
  // =========================================================

  const cardTotal = useMemo(() => {
    return filteredOrders
      .filter((order) => {
        const method = String(
          order?.paymentMethod || ""
        ).toLowerCase();

        return (
          method === "card" ||
          method === "karta"
        );
      })
      .reduce(
        (sum, order) =>
          sum + getOrderTotal(order),
        0
      );
  }, [filteredOrders]);

  // =========================================================
  // JAMI TUSHUM
  // =========================================================

  const grandTotal = useMemo(() => {
    return filteredOrders.reduce(
      (sum, order) =>
        sum + getOrderTotal(order),
      0
    );
  }, [filteredOrders]);

  // =========================================================
  // FOIZLAR
  // =========================================================

  const cashPercent = grandTotal
    ? Math.round(
        (cashTotal / grandTotal) * 100
      )
    : 0;

  const cardPercent = grandTotal
    ? Math.round(
        (cardTotal / grandTotal) * 100
      )
    : 0;

  // =========================================================
  // PUL FORMAT
  // =========================================================

  const formatMoney = (value) => {
    return (
      new Intl.NumberFormat("uz-UZ").format(
        Number(value) || 0
      ) + " so'm"
    );
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="w-full min-h-[300px] flex items-center justify-center">
        <p className="text-sm font-semibold text-slate-500">
          Hisobotlar yuklanmoqda...
        </p>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="w-full max-w-[1200px] mx-auto">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">

        {/* TITLE */}

        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Hisobotlar
          </h1>

          <p className="text-sm sm:text-base text-slate-500 mt-2">
            Sotuvlar va umumiy tushumlar bo'yicha tahlillar
          </p>
        </div>

        {/* PERIOD */}

        <div className="flex bg-slate-100 p-1.5 rounded-2xl text-sm font-bold w-fit shadow-sm">

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
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`
                px-4
                py-2.5
                rounded-xl
                transition-all
                whitespace-nowrap
                ${
                  period === p.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }
              `}
            >
              {p.label}
            </button>
          ))}

        </div>
      </div>

      {/* =====================================================
          TUSHUM KARTALARI
      ===================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">

        {/* JAMI */}

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">

          <div className="absolute left-0 top-0 w-1.5 h-full bg-emerald-500" />

          <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
            Jami tushum
          </p>

          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {formatMoney(grandTotal)}
          </p>

          <p className="text-xs text-slate-500 mt-2 font-medium">
            Jami {filteredOrders.length} ta chek yopilgan
          </p>

        </div>

        {/* NAQD */}

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">

          <div className="absolute left-0 top-0 w-1.5 h-full bg-amber-500" />

          <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
            Naqd tushum
          </p>

          <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-2">
            {formatMoney(cashTotal)}
          </p>

          <p className="text-xs text-slate-500 mt-2 font-medium">
            Ulushi: {cashPercent}%
          </p>

        </div>

        {/* KARTA */}

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">

          <div className="absolute left-0 top-0 w-1.5 h-full bg-blue-500" />

          <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
            Karta tushumi
          </p>

          <p className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">
            {formatMoney(cardTotal)}
          </p>

          <p className="text-xs text-slate-500 mt-2 font-medium">
            Ulushi: {cardPercent}%
          </p>

        </div>

      </div>

      {/* =====================================================
          TO'LOV TURLARI
      ===================================================== */}

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">

        <h3 className="font-extrabold text-slate-900 text-lg mb-6">
          To'lov turlari nisbati
        </h3>

        <div className="space-y-6">

          {/* NAQD */}

          <div>

            <div className="flex justify-between items-center mb-2">

              <span className="text-amber-700 font-extrabold text-sm">
                Naqd pul
              </span>

              <span className="text-slate-800 text-sm font-extrabold">
                {formatMoney(cashTotal)}
              </span>

            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">

              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${cashPercent}%`,
                }}
              />

            </div>

          </div>

          {/* KARTA */}

          <div>

            <div className="flex justify-between items-center mb-2">

              <span className="text-blue-600 font-extrabold text-sm">
                Karta orqali
              </span>

              <span className="text-slate-800 text-sm font-extrabold">
                {formatMoney(cardTotal)}
              </span>

            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">

              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${cardPercent}%`,
                }}
              />

            </div>

          </div>

        </div>

        {/* INFO */}

        <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
          Ma'lumotlar tanlangan vaqt oralig'i bo'yicha hisoblangan.
        </div>

      </div>

    </div>
  );
}