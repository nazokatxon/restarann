import React, { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import {
  Receipt,
  Banknote,
  CreditCard,
  CalendarDays,
} from "lucide-react";

import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function Reports() {
  const { cafeId } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");

  // =====================================================
  // DATE
  // =====================================================

  const getOrderDate = (order) => {
    if (!order) return null;

    try {
      // Avval paidAt
      if (order?.paidAt?.toDate) {
        return order.paidAt.toDate();
      }

      // Firebase Timestamp seconds
      if (
        order?.paidAt?.seconds !== undefined
      ) {
        return new Date(
          order.paidAt.seconds * 1000
        );
      }

      // Oddiy paidAt
      if (order?.paidAt) {
        const date = new Date(order.paidAt);

        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }

      // Keyin createdAt
      if (order?.createdAt?.toDate) {
        return order.createdAt.toDate();
      }

      if (
        order?.createdAt?.seconds !== undefined
      ) {
        return new Date(
          order.createdAt.seconds * 1000
        );
      }

      if (order?.createdAt) {
        const date = new Date(
          order.createdAt
        );

        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    } catch (error) {
      console.error(
        "Order sanasini olishda xato:",
        error
      );
    }

    return null;
  };

  // =====================================================
  // ORDERS
  // =====================================================

  useEffect(() => {
    if (!cafeId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "orders"),
      where(
        "cafeId",
        "==",
        String(cafeId)
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((order) => {
            const paymentStatus =
              String(
                order?.paymentStatus || ""
              )
                .trim()
                .toLowerCase();

            // Kassa yopgan cheklar
            return (
              paymentStatus === "paid" ||
              order?.isPaid === true
            );
          });

        data.sort((a, b) => {
          const aDate =
            getOrderDate(a)?.getTime() || 0;

          const bDate =
            getOrderDate(b)?.getTime() || 0;

          return bDate - aDate;
        });

        console.log(
          "REPORTS - PAID ORDERS:",
          data
        );

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

  // =====================================================
  // SUMMA
  // =====================================================

  const getOrderTotal = (order) => {
    const totalAmount = Number(
      order?.totalAmount
    );

    if (
      Number.isFinite(totalAmount) &&
      totalAmount > 0
    ) {
      return totalAmount;
    }

    const totalPrice = Number(
      order?.totalPrice
    );

    if (
      Number.isFinite(totalPrice) &&
      totalPrice > 0
    ) {
      return totalPrice;
    }

    const total = Number(
      order?.total
    );

    if (
      Number.isFinite(total) &&
      total > 0
    ) {
      return total;
    }

    const amount = Number(
      order?.amount
    );

    if (
      Number.isFinite(amount) &&
      amount > 0
    ) {
      return amount;
    }

    // Agar orderda total saqlanmagan bo'lsa,
    // items orqali hisoblaymiz.
    if (Array.isArray(order?.items)) {
      return order.items.reduce(
        (sum, item) => {
          const price =
            Number(item?.price) || 0;

          const quantity =
            Number(
              item?.quantity ??
                item?.qty ??
                1
            ) || 1;

          return (
            sum +
            price * quantity
          );
        },
        0
      );
    }

    return 0;
  };

  // =====================================================
  // TO'LOV TURI
  // =====================================================

  const getPaymentMethod = (order) => {
    return String(
      order?.paymentMethod || ""
    )
      .trim()
      .toLowerCase();
  };

  const isCashPayment = (order) => {
    const method =
      getPaymentMethod(order);

    return (
      method === "cash" ||
      method === "naqd" ||
      method === "cash_payment"
    );
  };

  const isCardPayment = (order) => {
    const method =
      getPaymentMethod(order);

    return (
      method === "card" ||
      method === "karta" ||
      method === "plastic" ||
      method === "plastik"
    );
  };

  const getPaymentLabel = (order) => {
    if (isCardPayment(order)) {
      return "Plastik karta";
    }

    if (isCashPayment(order)) {
      return "Naqd pul";
    }

    return "Noma'lum";
  };

  // =====================================================
  // ORDER NUMBER
  // =====================================================

  const getOrderNumber = (order) => {
    return (
      order?.orderNumber ||
      order?.orderNo ||
      order?.number ||
      `#${String(
        order?.id || ""
      ).slice(0, 8)}`
    );
  };

  // =====================================================
  // FILTER
  // =====================================================

  const filteredOrders = useMemo(() => {
    const now = new Date();

    return orders.filter((order) => {
      const orderDate =
        getOrderDate(order);

      if (!orderDate) {
        return false;
      }

      // =================================================
      // KUNLIK
      // =================================================

      if (period === "daily") {
        return (
          orderDate.getDate() ===
            now.getDate() &&
          orderDate.getMonth() ===
            now.getMonth() &&
          orderDate.getFullYear() ===
            now.getFullYear()
        );
      }

      // =================================================
      // HAFTALIK
      // =================================================

      if (period === "weekly") {
        const weekAgo =
          new Date(now);

        weekAgo.setDate(
          now.getDate() - 7
        );

        return (
          orderDate >= weekAgo &&
          orderDate <= now
        );
      }

      // =================================================
      // OYLIK
      // =================================================

      if (period === "monthly") {
        return (
          orderDate.getMonth() ===
            now.getMonth() &&
          orderDate.getFullYear() ===
            now.getFullYear()
        );
      }

      // =================================================
      // YILLIK
      // =================================================

      if (period === "yearly") {
        return (
          orderDate.getFullYear() ===
          now.getFullYear()
        );
      }

      return true;
    });
  }, [orders, period]);

  // =====================================================
  // NAQD
  // =====================================================

  const cashTotal = useMemo(() => {
    return filteredOrders
      .filter(isCashPayment)
      .reduce(
        (sum, order) =>
          sum + getOrderTotal(order),
        0
      );
  }, [filteredOrders]);

  // =====================================================
  // KARTA
  // =====================================================

  const cardTotal = useMemo(() => {
    return filteredOrders
      .filter(isCardPayment)
      .reduce(
        (sum, order) =>
          sum + getOrderTotal(order),
        0
      );
  }, [filteredOrders]);

  // =====================================================
  // JAMI
  // =====================================================

  const grandTotal = useMemo(() => {
    return filteredOrders.reduce(
      (sum, order) =>
        sum + getOrderTotal(order),
      0
    );
  }, [filteredOrders]);

  // =====================================================
  // FOIZ
  // =====================================================

  const cashPercent =
    grandTotal > 0
      ? Math.round(
          (cashTotal /
            grandTotal) *
            100
        )
      : 0;

  const cardPercent =
    grandTotal > 0
      ? Math.round(
          (cardTotal /
            grandTotal) *
            100
        )
      : 0;

  // =====================================================
  // MONEY
  // =====================================================

  const formatMoney = (value) => {
    return (
      new Intl.NumberFormat(
        "uz-UZ"
      ).format(
        Number(value) || 0
      ) + " so'm"
    );
  };

  // =====================================================
  // DATE FORMAT
  // =====================================================

  const formatDate = (order) => {
    const date =
      getOrderDate(order);

    if (!date) {
      return "-";
    }

    return date.toLocaleString(
      "uz-UZ",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="w-full min-h-[300px] flex items-center justify-center">
        <p className="text-sm font-semibold text-slate-500">
          Hisobotlar yuklanmoqda...
        </p>
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="w-full max-w-[1200px] mx-auto">

      {/* HEADER */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">

        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
            Hisobotlar
          </h1>

          <p className="text-sm sm:text-base text-slate-500 mt-2">
            Sotuvlar va umumiy tushumlar bo'yicha tahlillar
          </p>
        </div>

        {/* PERIOD */}

        <div className="flex bg-slate-100 p-1.5 rounded-2xl text-sm font-bold w-fit">

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
              onClick={() =>
                setPeriod(p.id)
              }
              className={`px-4 py-2.5 rounded-xl ${
                period === p.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {p.label}
            </button>
          ))}

        </div>

      </div>

      {/* CARDS */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">

        {/* JAMI */}

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">

          <div className="absolute left-0 top-0 w-1.5 h-full bg-emerald-500" />

          <p className="text-xs font-extrabold text-slate-400 uppercase">
            Jami tushum
          </p>

          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {formatMoney(grandTotal)}
          </p>

          <p className="text-xs text-slate-500 mt-2">
            Jami{" "}
            <strong>
              {filteredOrders.length}
            </strong>{" "}
            ta chek yopilgan
          </p>

        </div>

        {/* NAQD */}

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">

          <div className="absolute left-0 top-0 w-1.5 h-full bg-amber-500" />

          <div className="flex items-center gap-2">

            <Banknote
              size={18}
              className="text-amber-600"
            />

            <p className="text-xs font-extrabold text-slate-400 uppercase">
              Naqd tushum
            </p>

          </div>

          <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-2">
            {formatMoney(cashTotal)}
          </p>

          <p className="text-xs text-slate-500 mt-2">
            Ulushi:{" "}
            {cashPercent}%
          </p>

        </div>

        {/* KARTA */}

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">

          <div className="absolute left-0 top-0 w-1.5 h-full bg-blue-500" />

          <div className="flex items-center gap-2">

            <CreditCard
              size={18}
              className="text-blue-600"
            />

            <p className="text-xs font-extrabold text-slate-400 uppercase">
              Karta tushumi
            </p>

          </div>

          <p className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">
            {formatMoney(cardTotal)}
          </p>

          <p className="text-xs text-slate-500 mt-2">
            Ulushi:{" "}
            {cardPercent}%
          </p>

        </div>

      </div>

      {/* PAYMENT RATIO */}

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-6">

        <h3 className="font-extrabold text-slate-900 text-lg mb-6">
          To'lov turlari nisbati
        </h3>

        <div className="space-y-6">

          {/* CASH */}

          <div>

            <div className="flex justify-between items-center mb-2">

              <span className="text-amber-700 font-extrabold text-sm">
                Naqd pul
              </span>

              <span className="text-slate-800 text-sm font-extrabold">
                {formatMoney(cashTotal)}
              </span>

            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">

              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${cashPercent}%`,
                }}
              />

            </div>

          </div>

          {/* CARD */}

          <div>

            <div className="flex justify-between items-center mb-2">

              <span className="text-blue-600 font-extrabold text-sm">
                Karta orqali
              </span>

              <span className="text-slate-800 text-sm font-extrabold">
                {formatMoney(cardTotal)}
              </span>

            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">

              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${cardPercent}%`,
                }}
              />

            </div>

          </div>

        </div>

      </div>

      {/* YOPILGAN CHEKLAR */}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="p-6 border-b border-slate-100">

          <div className="flex items-center gap-2">

            <Receipt
              size={20}
              className="text-slate-600"
            />

            <h3 className="font-extrabold text-slate-900 text-lg">
              Yopilgan cheklar
            </h3>

          </div>

          <p className="text-sm text-slate-500 mt-1">
            Tanlangan davrda yopilgan barcha cheklar
          </p>

        </div>

        {filteredOrders.length === 0 ? (

          <div className="py-16 text-center text-slate-400">

            <Receipt
              size={42}
              className="mx-auto mb-3 text-slate-300"
            />

            <p className="font-semibold">
              Yopilgan cheklar yo'q
            </p>

          </div>

        ) : (

          <div className="divide-y divide-slate-100">

            {filteredOrders.map(
              (order) => (
                <div
                  key={order.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50"
                >

                  <div className="flex items-start gap-4">

                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">

                      {isCardPayment(order) ? (
                        <CreditCard
                          size={19}
                          className="text-blue-600"
                        />
                      ) : (
                        <Banknote
                          size={19}
                          className="text-amber-600"
                        />
                      )}

                    </div>

                    <div>

                      <p className="font-black text-slate-900">
                        {getOrderNumber(order)}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        {formatDate(order)}
                      </p>

                      {order.tableNumber && (
                        <p className="text-xs text-slate-500 mt-1">
                          {order.tableNumber}-stol
                        </p>
                      )}

                    </div>

                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">

                    <p
                      className={`text-xs font-bold ${
                        isCardPayment(order)
                          ? "text-blue-600"
                          : isCashPayment(order)
                          ? "text-amber-700"
                          : "text-slate-500"
                      }`}
                    >
                      {getPaymentLabel(order)}
                    </p>

                    <p className="font-black text-slate-900">
                      {formatMoney(
                        getOrderTotal(order)
                      )}
                    </p>

                  </div>

                </div>
              )
            )}

          </div>

        )}

      </div>

      {/* INFO */}

      <div className="mt-5 flex items-center gap-2 text-xs text-slate-400 font-medium">

        <CalendarDays size={15} />

        Ma'lumotlar tanlangan vaqt oralig'i bo'yicha hisoblangan.

      </div>

    </div>
  );
}