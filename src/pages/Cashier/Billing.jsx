import React, { useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";

import {
  RefreshCw,
  Search,
  Eye,
  X,
  CheckCircle,
  Banknote,
  CreditCard,
  Receipt,
  XCircle,
  CalendarDays,
  ChevronDown,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { db } from "../../Firebase/config";
import { useAuth } from "../../context/AuthContext";

export default function Billing() {
  const { user, cafeId } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [openMenuId, setOpenMenuId] = useState(null);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // =====================================================
  // DATE
  // =====================================================

  function getDateObject(timestamp) {
    if (!timestamp) return null;

    try {
      if (typeof timestamp.toDate === "function") {
        return timestamp.toDate();
      }

      if (timestamp?.seconds) {
        return new Date(timestamp.seconds * 1000);
      }

      const date = new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date;
    } catch {
      return null;
    }
  }

  // =====================================================
  // FIREBASE ORDERS
  // =====================================================

  useEffect(() => {
    if (!cafeId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const q = query(
      collection(db, "orders"),
      where("cafeId", "==", String(cafeId))
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        data.sort((a, b) => {
          const aDate = getDateObject(a.createdAt);
          const bDate = getDateObject(b.createdAt);

          return (
            (bDate?.getTime() || 0) -
            (aDate?.getTime() || 0)
          );
        });

        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.error("Orders olishda xato:", err);

        setError(
          err?.message ||
            "Buyurtmalarni olishda xatolik yuz berdi."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [cafeId]);

  // =====================================================
  // OPEN ORDERS
  // =====================================================

  const openOrders = useMemo(() => {
    return orders.filter((order) => {
      const paymentStatus = String(
        order.paymentStatus || ""
      ).toLowerCase();

      const status = String(
        order.status || ""
      ).toLowerCase();

      const cancelled =
        paymentStatus === "cancelled" ||
        paymentStatus === "canceled" ||
        status === "cancelled" ||
        status === "canceled";

      const paid =
        paymentStatus === "paid" ||
        status === "paid" ||
        order.isPaid === true;

      return !cancelled && !paid;
    });
  }, [orders]);

  // =====================================================
  // FILTER
  // =====================================================

  const filteredOrders = useMemo(() => {
    const text = search.trim().toLowerCase();

    return openOrders.filter((order) => {
      const orderNumber = String(
        order.orderNumber ||
          order.orderNo ||
          order.number ||
          order.id ||
          ""
      ).toLowerCase();

      const tableNumber = String(
        order.tableNumber || ""
      ).toLowerCase();

      const matchesSearch =
        !text ||
        orderNumber.includes(text) ||
        tableNumber.includes(text);

      const status = String(
        order.status || ""
      ).toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      let matchesDate = true;

      if (dateFilter) {
        const orderDate = getDateObject(
          order.createdAt
        );

        if (!orderDate) {
          matchesDate = false;
        } else {
          const year = orderDate.getFullYear();

          const month = String(
            orderDate.getMonth() + 1
          ).padStart(2, "0");

          const day = String(
            orderDate.getDate()
          ).padStart(2, "0");

          matchesDate =
            `${year}-${month}-${day}` ===
            dateFilter;
        }
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDate
      );
    });
  }, [
    openOrders,
    search,
    dateFilter,
    statusFilter,
  ]);

  // =====================================================
  // PAGINATION
  // =====================================================

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredOrders.length / pageSize
    )
  );

  const currentPage = Math.min(
    page,
    totalPages
  );

  const paginatedOrders = useMemo(() => {
    const start =
      (currentPage - 1) * pageSize;

    return filteredOrders.slice(
      start,
      start + pageSize
    );
  }, [
    filteredOrders,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    dateFilter,
    statusFilter,
    pageSize,
  ]);

  // =====================================================
  // HELPERS
  // =====================================================

  const getTotal = (order) => {
    return (
      Number(order?.totalAmount) ||
      Number(order?.total) ||
      Number(order?.amount) ||
      Number(order?.totalPrice) ||
      0
    );
  };

  const getItems = (order) => {
    return Array.isArray(order?.items)
      ? order.items
      : [];
  };

  const formatMoney = (value) => {
    return (
      new Intl.NumberFormat("uz-UZ").format(
        Number(value) || 0
      ) + " so'm"
    );
  };

  const formatDate = (timestamp) => {
    const date = getDateObject(timestamp);

    if (!date) return "-";

    return date.toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getOrderNumber = (order) => {
    return (
      order?.orderNumber ||
      order?.orderNo ||
      order?.number ||
      `#${String(order?.id || "").slice(0, 8)}`
    );
  };

  const getStatusLabel = (status) => {
    const value = String(
      status || ""
    ).toLowerCase();

    switch (value) {
      case "new":
      case "yangi":
        return "Yangi";

      case "pending":
      case "waiting":
      case "kutilmoqda":
        return "Kutilmoqda";

      case "accepted":
      case "qabul qilingan":
        return "Qabul qilingan";

      case "completed":
      case "tugallangan":
        return "Tugallangan";

      case "preparing":
      case "tayyorlanmoqda":
        return "Tayyorlanmoqda";

      case "ready":
      case "tayyor":
        return "Tayyor";

      case "paid":
      case "tolangan":
        return "To'langan";

      default:
        return status || "Noma'lum";
    }
  };

  const getStatusClass = (status) => {
    const value = String(
      status || ""
    ).toLowerCase();

    if (
      value === "new" ||
      value === "yangi"
    ) {
      return "bg-green-50 text-green-600";
    }

    if (
      value === "pending" ||
      value === "waiting" ||
      value === "kutilmoqda"
    ) {
      return "bg-amber-50 text-amber-600";
    }

    if (
      value === "accepted" ||
      value === "qabul qilingan"
    ) {
      return "bg-blue-50 text-blue-600";
    }

    if (
      value === "completed" ||
      value === "tugallangan"
    ) {
      return "bg-purple-50 text-purple-600";
    }

    if (
      value === "preparing" ||
      value === "tayyorlanmoqda"
    ) {
      return "bg-orange-50 text-orange-600";
    }

    if (
      value === "ready" ||
      value === "tayyor"
    ) {
      return "bg-green-50 text-green-600";
    }

    return "bg-slate-100 text-slate-600";
  };

  // =====================================================
  // PAYMENT MODAL
  // =====================================================

  const openPayment = (order) => {
    setOpenMenuId(null);

    setSelectedOrder(order);

    setPaymentMethod(
      order?.paymentMethod || "cash"
    );

    setPaymentModal(true);
    setError("");
  };

  const closePayment = () => {
    if (processingId) return;

    setPaymentModal(false);
    setSelectedOrder(null);
    setError("");
  };

  // =====================================================
  // PRINT RECEIPT
  // =====================================================

  const printReceipt = (order) => {
    const items = Array.isArray(order?.items)
      ? order.items
      : [];

    const total = getTotal(order);

    const orderNumber =
      getOrderNumber(order);

    const orderDate =
      getDateObject(order?.createdAt);

    const dateText = orderDate
      ? orderDate.toLocaleString("uz-UZ", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleString("uz-UZ");

    const paymentText =
      order?.paymentMethod === "card"
        ? "Plastik karta"
        : "Naqd pul";

    const formatter =
      new Intl.NumberFormat("uz-UZ");

    const escapeHtml = (value) => {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const itemsHtml = items
      .map((item) => {
        const quantity =
          Number(item?.quantity) || 1;

        const price =
          Number(item?.price) || 0;

        const itemTotal =
          quantity * price;

        const name =
          item?.name ||
          item?.title ||
          "Noma'lum mahsulot";

        return `
          <div class="item">

            <div class="item-name">
              ${escapeHtml(name)}
            </div>

            <div class="item-row">

              <span>
                ${quantity} x
                ${formatter.format(price)}
              </span>

              <strong>
                ${formatter.format(itemTotal)}
              </strong>

            </div>

          </div>
        `;
      })
      .join("");

    const receiptWindow =
      window.open(
        "",
        "_blank",
        "width=420,height=750"
      );

    if (!receiptWindow) {
      alert(
        "Chek oynasini ochib bo'lmadi. Brauzer popup oynasiga ruxsat bering."
      );

      return;
    }

    receiptWindow.document.write(`
      <!DOCTYPE html>

      <html lang="uz">

      <head>

        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>
          Chek ${escapeHtml(orderNumber)}
        </title>

        <style>

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
          }

          body {
            color: #111;
            font-family:
              Arial,
              Helvetica,
              sans-serif;
          }

          .receipt {
            width: 80mm;
            margin: 0 auto;
            padding: 12px 8px 18px;
          }

          .center {
            text-align: center;
          }

          .cafe-name {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: 0.5px;
          }

          .subtitle {
            margin-top: 4px;
            font-size: 11px;
            color: #555;
          }

          .line {
            border-top: 1px dashed #111;
            margin: 10px 0;
          }

          .info {
            font-size: 12px;
            line-height: 1.7;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
          }

          .info-row span:first-child {
            color: #555;
          }

          .info-row span:last-child,
          .info-row strong {
            text-align: right;
          }

          .items {
            margin-top: 5px;
          }

          .item {
            margin-bottom: 10px;
            font-size: 12px;
          }

          .item-name {
            font-weight: 700;
            margin-bottom: 3px;
            word-break: break-word;
          }

          .item-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
          }

          .item-row span {
            color: #444;
          }

          .total {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            font-size: 17px;
            font-weight: 900;
          }

          .payment {
            margin-top: 10px;
            font-size: 12px;
          }

          .thanks {
            text-align: center;
            font-size: 13px;
            font-weight: 700;
            margin-top: 18px;
          }

          .footer {
            text-align: center;
            font-size: 10px;
            color: #666;
            margin-top: 6px;
          }

          @media print {

            html,
            body {
              width: 80mm;
            }

            .receipt {
              width: 80mm;
              margin: 0;
              padding: 8px 6px 12px;
            }

            @page {
              size: 80mm auto;
              margin: 0;
            }

          }

        </style>

      </head>

      <body>

        <div class="receipt">

          <div class="center">

            <div class="cafe-name">
              𝒜ℐ 𝒞𝒶𝒻ℯ
            </div>

            <div class="subtitle">
              KASSA CHEKI
            </div>

          </div>

          <div class="line"></div>

          <div class="info">

            <div class="info-row">

              <span>
                Buyurtma:
              </span>

              <strong>
                ${escapeHtml(orderNumber)}
              </strong>

            </div>

            <div class="info-row">

              <span>
                Sana:
              </span>

              <span>
                ${escapeHtml(dateText)}
              </span>

            </div>

            ${
              order?.tableNumber
                ? `
                  <div class="info-row">

                    <span>
                      Stol:
                    </span>

                    <strong>
                      ${escapeHtml(
                        order.tableNumber
                      )}
                    </strong>

                  </div>
                `
                : ""
            }

          </div>

          <div class="line"></div>

          <div class="items">

            ${
              itemsHtml ||
              `
                <div
                  style="
                    text-align:center;
                    font-size:12px;
                  "
                >
                  Mahsulotlar mavjud emas
                </div>
              `
            }

          </div>

          <div class="line"></div>

          <div class="total">

            <span>
              JAMI:
            </span>

            <span>
              ${formatter.format(total)}
              so'm
            </span>

          </div>

          <div class="payment">

            To'lov turi:
            <strong>
              ${escapeHtml(paymentText)}
            </strong>

          </div>

          <div class="line"></div>

          <div class="thanks">
            Xaridingiz uchun rahmat!
          </div>

          <div class="footer">
            𝒜ℐ 𝒞𝒶𝒻ℯ
          </div>

        </div>

        <script>

          window.onload = function () {

            setTimeout(function () {

              window.print();

            }, 400);

          };

          window.onafterprint = function () {

            setTimeout(function () {

              window.close();

            }, 300);

          };

        </script>

      </body>

      </html>
    `);

    receiptWindow.document.close();
  };

  // =====================================================
  // PAYMENT
  // =====================================================

  const handlePayment = async () => {
    if (!selectedOrder) return;

    setProcessingId(selectedOrder.id);
    setError("");

    try {
      const paidOrder = {
        ...selectedOrder,
        paymentMethod,
      };

      await updateDoc(
        doc(
          db,
          "orders",
          selectedOrder.id
        ),
        {
          paymentStatus: "paid",

          paymentMethod,

          isPaid: true,

          paidAt:
            serverTimestamp(),

          paidBy:
            user?.uid || null,

          paidByUsername:
            user?.username || null,

          cashierId:
            user?.uid || null,

          cashierUsername:
            user?.username || null,

          status: "paid",

          updatedAt:
            serverTimestamp(),
        }
      );

      setPaymentModal(false);

      setSelectedOrder(null);

      setOpenMenuId(null);

      // ==============================================
      // TO'LOVDAN KEYIN CHEK
      // ==============================================

      printReceipt(paidOrder);
    } catch (err) {
      console.error(
        "To'lovda xato:",
        err
      );

      setError(
        err?.message ||
          "To'lovni qabul qilib bo'lmadi."
      );
    } finally {
      setProcessingId(null);
    }
  };

  // =====================================================
  // CANCEL
  // =====================================================

  const handleCancel = async (order) => {
    setOpenMenuId(null);

    const ok = window.confirm(
      `Buyurtma ${getOrderNumber(
        order
      )} ni bekor qilmoqchimisiz?`
    );

    if (!ok) return;

    setProcessingId(order.id);
    setError("");

    try {
      await updateDoc(
        doc(
          db,
          "orders",
          order.id
        ),
        {
          paymentStatus: "cancelled",

          status: "cancelled",

          cancelledAt:
            serverTimestamp(),

          cancelledBy:
            user?.uid || null,

          cancelledByUsername:
            user?.username || null,

          updatedAt:
            serverTimestamp(),
        }
      );
    } catch (err) {
      console.error(
        "Bekor qilishda xato:",
        err
      );

      setError(
        err?.message ||
          "Buyurtmani bekor qilib bo'lmadi."
      );
    } finally {
      setProcessingId(null);
    }
  };

  // =====================================================
  // RESET FILTERS
  // =====================================================

  const resetFilters = () => {
    setSearch("");
    setDateFilter("");
    setStatusFilter("all");
  };

  // =====================================================
  // RETURN
  // =====================================================

  return (
    <div className="w-full min-h-screen bg-slate-50">

      {/* HEADER */}

      <div className="bg-white border-b border-slate-200">

        <div
          className="
            px-5
            sm:px-10
            py-7
            sm:py-8
            flex
            flex-col
            md:flex-row
            md:items-center
            md:justify-between
            gap-6
          "
        >

          <div className="flex items-start gap-5">

            <div
              className="
                w-12
                h-12
                rounded-xl
                bg-blue-600
                text-white
                flex
                items-center
                justify-center
                shrink-0
              "
            >
              <Receipt size={25} />
            </div>

            <div>

              <h1
                className="
                  text-3xl
                  sm:text-4xl
                  font-black
                  text-slate-900
                  tracking-tight
                "
              >
                Kassa
              </h1>

              <p
                className="
                  mt-3
                  text-base
                  sm:text-lg
                  text-slate-500
                "
              >
                Buyurtmalarni qabul qilish va
                to'lovlarni boshqarish
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              px-5
              py-3
              rounded-xl
              border
              border-slate-200
              bg-white
              text-slate-700
              font-bold
              hover:bg-slate-50
              transition
              shrink-0
            "
          >
            <RefreshCw size={18} />

            Yangilash
          </button>

        </div>

      </div>

      {/* CONTENT */}

      <div
        className="
          bg-white
          border-x
          border-b
          border-slate-200
          px-5
          sm:px-10
          py-8
        "
      >

        {/* ERROR */}

        {error && (
          <div
            className="
              mb-5
              rounded-xl
              border
              border-red-200
              bg-red-50
              text-red-600
              px-4
              py-3
              text-sm
              font-medium
            "
          >
            {error}
          </div>
        )}

        {/* FILTERS */}

        <div
          className="
            grid
            grid-cols-1
            md:grid-cols-3
            gap-4
            mb-8
          "
        >

          {/* SEARCH */}

          <div className="relative">

            <Search
              size={21}
              className="
                absolute
                left-4
                top-1/2
                -translate-y-1/2
                text-slate-400
                pointer-events-none
              "
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Qidirish..."
              className="
                w-full
                h-16
                pl-12
                pr-4
                rounded-xl
                border
                border-slate-200
                bg-white
                text-base
                text-slate-700
                placeholder:text-slate-400
                outline-none
                focus:ring-2
                focus:ring-blue-100
                focus:border-blue-400
              "
            />

          </div>

          {/* DATE */}

          <div className="relative">

            <CalendarDays
              size={21}
              className="
                absolute
                left-4
                top-1/2
                -translate-y-1/2
                text-slate-400
                pointer-events-none
              "
            />

            <input
              type="date"
              value={dateFilter}
              onChange={(e) =>
                setDateFilter(
                  e.target.value
                )
              }
              className="
                w-full
                h-16
                pl-12
                pr-4
                rounded-xl
                border
                border-slate-200
                bg-white
                text-base
                text-slate-600
                outline-none
                focus:ring-2
                focus:ring-blue-100
                focus:border-blue-400
              "
            />

          </div>

          {/* STATUS */}

          <div className="relative">

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="
                appearance-none
                w-full
                h-16
                px-5
                pr-12
                rounded-xl
                border
                border-slate-200
                bg-white
                text-base
                text-slate-600
                outline-none
                cursor-pointer
                focus:ring-2
                focus:ring-blue-100
                focus:border-blue-400
              "
            >

              <option value="all">
                Holat: Barchasi
              </option>

              <option value="new">
                Yangi
              </option>

              <option value="pending">
                Kutilmoqda
              </option>

              <option value="accepted">
                Qabul qilingan
              </option>

              <option value="completed">
                Tugallangan
              </option>

              <option value="preparing">
                Tayyorlanmoqda
              </option>

              <option value="ready">
                Tayyor
              </option>

            </select>

            <ChevronDown
              size={19}
              className="
                absolute
                right-4
                top-1/2
                -translate-y-1/2
                text-slate-400
                pointer-events-none
              "
            />

          </div>

        </div>

        {/* TABLE */}

        <div
          className="
            border
            border-slate-200
            rounded-2xl
            overflow-hidden
          "
        >

          {loading ? (

            <div
              className="
                py-28
                text-center
                text-slate-400
              "
            >

              <RefreshCw
                size={32}
                className="
                  mx-auto
                  animate-spin
                  mb-4
                "
              />

              Buyurtmalar yuklanmoqda...

            </div>

          ) : filteredOrders.length === 0 ? (

            <div
              className="
                py-28
                text-center
                bg-white
              "
            >

              <Receipt
                size={55}
                className="
                  mx-auto
                  mb-5
                  text-slate-300
                "
              />

              <h3
                className="
                  font-extrabold
                  text-slate-700
                  text-xl
                "
              >
                Buyurtma topilmadi
              </h3>

              <p
                className="
                  text-base
                  text-slate-400
                  mt-2
                "
              >
                Qidiruv yoki filtrlarni
                o'zgartirib ko'ring.
              </p>

              <button
                type="button"
                onClick={resetFilters}
                className="
                  mt-5
                  px-5
                  py-2.5
                  rounded-xl
                  border
                  border-slate-200
                  text-slate-600
                  font-bold
                  text-sm
                  hover:bg-slate-50
                "
              >
                Filtrlarni tozalash
              </button>

            </div>

          ) : (

            <>

              {/* DESKTOP */}

              <div
                className="
                  hidden
                  lg:block
                  overflow-x-auto
                "
              >

                <table className="w-full text-sm">

                  <thead>

                    <tr
                      className="
                        bg-slate-50/70
                        border-b
                        border-slate-200
                        text-left
                      "
                    >

                      <th className="px-5 py-5 font-bold text-slate-500">
                        №
                      </th>

                      <th className="px-5 py-5 font-bold text-slate-500">
                        Buyurtma raqami
                      </th>

                      <th className="px-5 py-5 font-bold text-slate-500">
                        Sana
                      </th>

                      <th className="px-5 py-5 font-bold text-slate-500">
                        Holat
                      </th>

                      <th className="px-5 py-5 font-bold text-slate-500">
                        Summa
                      </th>

                      <th className="px-5 py-5 font-bold text-slate-500">
                        Amallar
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {paginatedOrders.map(
                      (order, index) => {

                        const rowNumber =
                          (currentPage - 1) *
                            pageSize +
                          index +
                          1;

                        return (

                          <tr
                            key={order.id}
                            className="
                              border-b
                              border-slate-100
                              last:border-0
                              hover:bg-slate-50/60
                              transition
                            "
                          >

                            <td className="px-5 py-5 text-slate-600">
                              {rowNumber}
                            </td>

                            <td className="px-5 py-5">

                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedOrder(
                                    order
                                  )
                                }
                                className="
                                  text-blue-600
                                  font-bold
                                  hover:underline
                                "
                              >
                                {getOrderNumber(
                                  order
                                )}
                              </button>

                            </td>

                            <td
                              className="
                                px-5
                                py-5
                                text-slate-600
                                whitespace-nowrap
                              "
                            >
                              {formatDate(
                                order.createdAt
                              )}
                            </td>

                            <td className="px-5 py-5">

                              <span
                                className={`
                                  inline-flex
                                  px-2.5
                                  py-1.5
                                  rounded-lg
                                  text-xs
                                  font-bold
                                  ${getStatusClass(
                                    order.status
                                  )}
                                `}
                              >
                                {getStatusLabel(
                                  order.status
                                )}
                              </span>

                            </td>

                            <td
                              className="
                                px-5
                                py-5
                                font-semibold
                                text-slate-700
                                whitespace-nowrap
                              "
                            >
                              {formatMoney(
                                getTotal(order)
                              )}
                            </td>

                            <td className="px-5 py-5">

                              <div
                                className="
                                  flex
                                  items-center
                                  gap-2
                                "
                              >

                                <button
                                  type="button"
                                  disabled={
                                    processingId ===
                                    order.id
                                  }
                                  onClick={() =>
                                    openPayment(
                                      order
                                    )
                                  }
                                  className="
                                    inline-flex
                                    items-center
                                    justify-center
                                    gap-2
                                    px-3.5
                                    py-2.5
                                    rounded-xl
                                    border
                                    border-slate-200
                                    bg-white
                                    text-slate-700
                                    font-bold
                                    text-sm
                                    hover:bg-slate-50
                                    disabled:opacity-50
                                  "
                                >

                                  <CreditCard
                                    size={16}
                                  />

                                  To'lov qilish

                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedOrder(
                                      order
                                    )
                                  }
                                  className="
                                    inline-flex
                                    items-center
                                    justify-center
                                    gap-2
                                    px-3.5
                                    py-2.5
                                    rounded-xl
                                    border
                                    border-slate-200
                                    bg-white
                                    text-slate-600
                                    font-bold
                                    text-sm
                                    hover:bg-slate-50
                                  "
                                >

                                  <Eye size={16} />

                                  Ko'rish

                                </button>

                                <div className="relative">

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenMenuId(
                                        openMenuId ===
                                          order.id
                                          ? null
                                          : order.id
                                      )
                                    }
                                    className="
                                      w-10
                                      h-10
                                      rounded-xl
                                      border
                                      border-slate-200
                                      bg-white
                                      text-slate-500
                                      flex
                                      items-center
                                      justify-center
                                      hover:bg-slate-50
                                    "
                                  >
                                    <MoreVertical
                                      size={16}
                                    />
                                  </button>

                                  {openMenuId ===
                                    order.id && (

                                    <div
                                      className="
                                        absolute
                                        right-0
                                        mt-2
                                        w-48
                                        bg-white
                                        border
                                        border-slate-200
                                        rounded-xl
                                        shadow-lg
                                        py-2
                                        z-30
                                      "
                                    >

                                      <button
                                        type="button"
                                        disabled={
                                          processingId ===
                                          order.id
                                        }
                                        onClick={() =>
                                          handleCancel(
                                            order
                                          )
                                        }
                                        className="
                                          w-full
                                          text-left
                                          px-4
                                          py-2.5
                                          text-sm
                                          font-bold
                                          text-red-600
                                          hover:bg-red-50
                                          flex
                                          items-center
                                          gap-2
                                        "
                                      >

                                        <XCircle
                                          size={16}
                                        />

                                        Bekor qilish

                                      </button>

                                    </div>

                                  )}

                                </div>

                              </div>

                            </td>

                          </tr>

                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>

              {/* MOBILE */}

              <div
                className="
                  block
                  lg:hidden
                  divide-y
                  divide-slate-100
                "
              >

                {paginatedOrders.map(
                  (order, index) => {

                    const rowNumber =
                      (currentPage - 1) *
                        pageSize +
                      index +
                      1;

                    return (

                      <div
                        key={order.id}
                        className="
                          p-5
                          space-y-4
                        "
                      >

                        <div
                          className="
                            flex
                            items-center
                            justify-between
                          "
                        >

                          <div
                            className="
                              flex
                              items-center
                              gap-3
                            "
                          >

                            <span
                              className="
                                text-sm
                                font-bold
                                text-slate-400
                              "
                            >
                              #{rowNumber}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                setSelectedOrder(
                                  order
                                )
                              }
                              className="
                                text-base
                                font-extrabold
                                text-blue-600
                                hover:underline
                              "
                            >
                              {getOrderNumber(
                                order
                              )}
                            </button>

                          </div>

                          <span
                            className={`
                              inline-flex
                              px-2.5
                              py-1
                              rounded-lg
                              text-xs
                              font-bold
                              ${getStatusClass(
                                order.status
                              )}
                            `}
                          >
                            {getStatusLabel(
                              order.status
                            )}
                          </span>

                        </div>

                        <div
                          className="
                            grid
                            grid-cols-2
                            gap-2
                            text-sm
                            text-slate-600
                          "
                        >

                          <div>

                            <span
                              className="
                                text-slate-400
                                block
                                text-xs
                              "
                            >
                              Sana
                            </span>

                            {formatDate(
                              order.createdAt
                            )}

                          </div>

                          <div>

                            <span
                              className="
                                text-slate-400
                                block
                                text-xs
                              "
                            >
                              Summa
                            </span>

                            <span
                              className="
                                font-bold
                                text-slate-800
                              "
                            >
                              {formatMoney(
                                getTotal(order)
                              )}
                            </span>

                          </div>

                        </div>

                        <div
                          className="
                            flex
                            items-center
                            gap-2
                            pt-2
                          "
                        >

                          <button
                            type="button"
                            disabled={
                              processingId ===
                              order.id
                            }
                            onClick={() =>
                              openPayment(order)
                            }
                            className="
                              flex-1
                              inline-flex
                              items-center
                              justify-center
                              gap-2
                              px-4
                              py-2.5
                              rounded-xl
                              bg-blue-600
                              text-white
                              font-bold
                              text-sm
                              hover:bg-blue-700
                              disabled:opacity-50
                            "
                          >

                            <CreditCard size={16} />

                            To'lov qilish

                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedOrder(
                                order
                              )
                            }
                            className="
                              inline-flex
                              items-center
                              justify-center
                              gap-2
                              px-4
                              py-2.5
                              rounded-xl
                              border
                              border-slate-200
                              bg-white
                              text-slate-700
                              font-bold
                              text-sm
                              hover:bg-slate-50
                            "
                          >

                            <Eye size={16} />

                            Ko'rish

                          </button>

                          <button
                            type="button"
                            disabled={
                              processingId ===
                              order.id
                            }
                            onClick={() =>
                              handleCancel(order)
                            }
                            className="
                              w-10
                              h-10
                              rounded-xl
                              border
                              border-red-200
                              bg-red-50
                              text-red-600
                              flex
                              items-center
                              justify-center
                              hover:bg-red-100
                              disabled:opacity-50
                            "
                          >

                            <XCircle size={18} />

                          </button>

                        </div>

                      </div>

                    );
                  }
                )}

              </div>

              {/* PAGINATION */}

              <div
                className="
                  flex
                  flex-col
                  sm:flex-row
                  items-center
                  justify-between
                  gap-4
                  p-5
                  border-t
                  border-slate-200
                  bg-slate-50/50
                "
              >

                <div
                  className="
                    text-sm
                    text-slate-500
                    font-medium
                  "
                >
                  Jami:

                  <span
                    className="
                      font-bold
                      text-slate-700
                      ml-1
                    "
                  >
                    {filteredOrders.length}
                  </span>

                  <span className="ml-1">
                    ta buyurtma
                  </span>

                </div>

                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >

                  <div
                    className="
                      flex
                      items-center
                      gap-2
                      text-sm
                      text-slate-600
                    "
                  >

                    <span>
                      Sahifada:
                    </span>

                    <select
                      value={pageSize}
                      onChange={(e) =>
                        setPageSize(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="
                        border
                        border-slate-200
                        rounded-lg
                        px-2
                        py-1
                        bg-white
                        outline-none
                        font-bold
                      "
                    >

                      <option value={10}>
                        10
                      </option>

                      <option value={25}>
                        25
                      </option>

                      <option value={50}>
                        50
                      </option>

                    </select>

                  </div>

                  <div
                    className="
                      flex
                      items-center
                      gap-1
                    "
                  >

                    <button
                      type="button"
                      disabled={
                        currentPage === 1
                      }
                      onClick={() =>
                        setPage((p) =>
                          Math.max(
                            1,
                            p - 1
                          )
                        )
                      }
                      className="
                        w-10
                        h-10
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        text-slate-600
                        flex
                        items-center
                        justify-center
                        hover:bg-slate-50
                        disabled:opacity-40
                      "
                    >
                      <ChevronLeft
                        size={18}
                      />
                    </button>

                    <span
                      className="
                        px-3
                        text-sm
                        font-bold
                        text-slate-700
                      "
                    >
                      {currentPage} /{" "}
                      {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={
                        currentPage ===
                        totalPages
                      }
                      onClick={() =>
                        setPage((p) =>
                          Math.min(
                            totalPages,
                            p + 1
                          )
                        )
                      }
                      className="
                        w-10
                        h-10
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        text-slate-600
                        flex
                        items-center
                        justify-center
                        hover:bg-slate-50
                        disabled:opacity-40
                      "
                    >
                      <ChevronRight
                        size={18}
                      />
                    </button>

                  </div>

                </div>

              </div>

            </>

          )}

        </div>

      </div>

      {/* =================================================
          PAYMENT MODAL
      ================================================= */}

      {paymentModal &&
        selectedOrder && (

          <div
            className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              bg-slate-900/40
              backdrop-blur-sm
              p-4
            "
          >

            <div
              className="
                bg-white
                w-full
                max-w-md
                rounded-2xl
                border
                border-slate-200
                shadow-2xl
                overflow-hidden
              "
            >

              <div
                className="
                  px-6
                  py-5
                  border-b
                  border-slate-100
                  flex
                  items-center
                  justify-between
                "
              >

                <h3
                  className="
                    text-xl
                    font-black
                    text-slate-900
                  "
                >
                  To'lovni qabul qilish
                </h3>

                <button
                  type="button"
                  onClick={closePayment}
                  disabled={!!processingId}
                  className="
                    w-9
                    h-9
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    text-slate-500
                    flex
                    items-center
                    justify-center
                    hover:bg-slate-50
                    disabled:opacity-50
                  "
                >
                  <X size={18} />
                </button>

              </div>

              <div className="p-6 space-y-5">

                <div
                  className="
                    bg-slate-50
                    rounded-xl
                    p-4
                    border
                    border-slate-100
                    space-y-2
                  "
                >

                  <div
                    className="
                      flex
                      justify-between
                      text-sm
                    "
                  >

                    <span className="text-slate-500">
                      Buyurtma:
                    </span>

                    <span
                      className="
                        font-bold
                        text-slate-800
                      "
                    >
                      {getOrderNumber(
                        selectedOrder
                      )}
                    </span>

                  </div>

                  <div
                    className="
                      flex
                      justify-between
                      text-sm
                    "
                  >

                    <span className="text-slate-500">
                      Jami summa:
                    </span>

                    <span
                      className="
                        font-black
                        text-blue-600
                        text-base
                      "
                    >
                      {formatMoney(
                        getTotal(
                          selectedOrder
                        )
                      )}
                    </span>

                  </div>

                </div>

                <div className="space-y-2">

                  <label
                    className="
                      text-sm
                      font-bold
                      text-slate-700
                      block
                    "
                  >
                    To'lov turi
                  </label>

                  <div
                    className="
                      grid
                      grid-cols-2
                      gap-3
                    "
                  >

                    <button
                      type="button"
                      onClick={() =>
                        setPaymentMethod(
                          "cash"
                        )
                      }
                      className={`
                        py-3
                        px-4
                        rounded-xl
                        border
                        font-bold
                        text-sm
                        flex
                        items-center
                        justify-center
                        gap-2
                        transition
                        ${
                          paymentMethod ===
                          "cash"
                            ? "border-blue-600 bg-blue-50 text-blue-600"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }
                      `}
                    >

                      <Banknote size={18} />

                      Naqd pul

                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPaymentMethod(
                          "card"
                        )
                      }
                      className={`
                        py-3
                        px-4
                        rounded-xl
                        border
                        font-bold
                        text-sm
                        flex
                        items-center
                        justify-center
                        gap-2
                        transition
                        ${
                          paymentMethod ===
                          "card"
                            ? "border-blue-600 bg-blue-50 text-blue-600"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }
                      `}
                    >

                      <CreditCard
                        size={18}
                      />

                      Plastik karta

                    </button>

                  </div>

                </div>

              </div>

              <div
                className="
                  px-6
                  py-4
                  border-t
                  border-slate-100
                  bg-slate-50
                  flex
                  items-center
                  justify-end
                  gap-3
                "
              >

                <button
                  type="button"
                  onClick={closePayment}
                  disabled={!!processingId}
                  className="
                    px-5
                    py-2.5
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    text-slate-700
                    font-bold
                    text-sm
                    hover:bg-slate-50
                    disabled:opacity-50
                  "
                >
                  Bekor qilish
                </button>

                <button
                  type="button"
                  disabled={
                    processingId ===
                    selectedOrder.id
                  }
                  onClick={handlePayment}
                  className="
                    px-5
                    py-2.5
                    rounded-xl
                    bg-blue-600
                    text-white
                    font-bold
                    text-sm
                    hover:bg-blue-700
                    flex
                    items-center
                    gap-2
                    disabled:opacity-50
                  "
                >

                  {processingId ===
                  selectedOrder.id ? (

                    <>

                      <RefreshCw
                        size={16}
                        className="animate-spin"
                      />

                      Saqlanmoqda...

                    </>

                  ) : (

                    <>

                      <CheckCircle
                        size={16}
                      />

                      To'landi deb belgilash

                    </>

                  )}

                </button>

              </div>

            </div>

          </div>

        )}

      {/* =================================================
          ORDER DETAILS MODAL
      ================================================= */}

      {selectedOrder &&
        !paymentModal && (

          <div
            className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              bg-slate-900/40
              backdrop-blur-sm
              p-4
            "
          >

            <div
              className="
                bg-white
                w-full
                max-w-lg
                rounded-2xl
                border
                border-slate-200
                shadow-2xl
                overflow-hidden
                max-h-[90vh]
                flex
                flex-col
              "
            >

              <div
                className="
                  px-6
                  py-5
                  border-b
                  border-slate-100
                  flex
                  items-center
                  justify-between
                  shrink-0
                "
              >

                <h3
                  className="
                    text-xl
                    font-black
                    text-slate-900
                  "
                >
                  Buyurtma tafsilotlari
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedOrder(null)
                  }
                  className="
                    w-9
                    h-9
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    text-slate-500
                    flex
                    items-center
                    justify-center
                    hover:bg-slate-50
                  "
                >
                  <X size={18} />
                </button>

              </div>

              <div
                className="
                  p-6
                  overflow-y-auto
                  space-y-6
                  flex-1
                "
              >

                <div
                  className="
                    grid
                    grid-cols-2
                    gap-4
                    text-sm
                    bg-slate-50
                    p-4
                    rounded-xl
                    border
                    border-slate-100
                  "
                >

                  <div>

                    <span
                      className="
                        text-slate-400
                        block
                        text-xs
                      "
                    >
                      Buyurtma
                    </span>

                    <span
                      className="
                        font-bold
                        text-slate-700
                      "
                    >
                      {getOrderNumber(
                        selectedOrder
                      )}
                    </span>

                  </div>

                  <div>

                    <span
                      className="
                        text-slate-400
                        block
                        text-xs
                      "
                    >
                      Sana
                    </span>

                    <span
                      className="
                        font-bold
                        text-slate-700
                      "
                    >
                      {formatDate(
                        selectedOrder.createdAt
                      )}
                    </span>

                  </div>

                  <div>

                    <span
                      className="
                        text-slate-400
                        block
                        text-xs
                      "
                    >
                      Holat
                    </span>

                    <span
                      className={`
                        inline-block
                        mt-1
                        px-2.5
                        py-0.5
                        rounded-md
                        text-xs
                        font-bold
                        ${getStatusClass(
                          selectedOrder.status
                        )}
                      `}
                    >
                      {getStatusLabel(
                        selectedOrder.status
                      )}
                    </span>

                  </div>

                  {selectedOrder.tableNumber && (

                    <div>

                      <span
                        className="
                          text-slate-400
                          block
                          text-xs
                        "
                      >
                        Stol raqami
                      </span>

                      <span
                        className="
                          font-bold
                          text-slate-700
                        "
                      >
                        {selectedOrder.tableNumber}
                      </span>

                    </div>

                  )}

                </div>

                <div className="space-y-3">

                  <h4
                    className="
                      font-extrabold
                      text-slate-800
                      text-sm
                    "
                  >
                    Buyurtma tarkibi
                  </h4>

                  <div
                    className="
                      border
                      border-slate-200
                      rounded-xl
                      overflow-hidden
                      divide-y
                      divide-slate-100
                    "
                  >

                    {getItems(
                      selectedOrder
                    ).length === 0 ? (

                      <div
                        className="
                          p-4
                          text-center
                          text-slate-400
                          text-sm
                        "
                      >
                        Mahsulotlar mavjud emas
                      </div>

                    ) : (

                      getItems(
                        selectedOrder
                      ).map(
                        (item, idx) => {

                          const quantity =
                            Number(
                              item?.quantity
                            ) || 1;

                          const price =
                            Number(
                              item?.price
                            ) || 0;

                          return (

                            <div
                              key={idx}
                              className="
                                p-3.5
                                flex
                                items-center
                                justify-between
                                text-sm
                              "
                            >

                              <div>

                                <div
                                  className="
                                    font-bold
                                    text-slate-800
                                  "
                                >
                                  {item?.name ||
                                    item?.title ||
                                    "Noma'lum mahsulot"}
                                </div>

                                <div
                                  className="
                                    text-xs
                                    text-slate-400
                                  "
                                >
                                  {quantity} x{" "}
                                  {formatMoney(
                                    price
                                  )}
                                </div>

                              </div>

                              <div
                                className="
                                  font-bold
                                  text-slate-700
                                "
                              >
                                {formatMoney(
                                  quantity *
                                    price
                                )}
                              </div>

                            </div>

                          );
                        }
                      )

                    )}

                  </div>

                </div>

                <div
                  className="
                    border-t
                    border-slate-100
                    pt-4
                    flex
                    items-center
                    justify-between
                    text-base
                  "
                >

                  <span
                    className="
                      font-bold
                      text-slate-500
                    "
                  >
                    Jami summa:
                  </span>

                  <span
                    className="
                      font-black
                      text-blue-600
                      text-xl
                    "
                  >
                    {formatMoney(
                      getTotal(
                        selectedOrder
                      )
                    )}
                  </span>

                </div>

              </div>

              <div
                className="
                  px-6
                  py-4
                  border-t
                  border-slate-100
                  bg-slate-50
                  flex
                  items-center
                  justify-end
                  gap-3
                  shrink-0
                "
              >

                <button
                  type="button"
                  onClick={() =>
                    setSelectedOrder(null)
                  }
                  className="
                    px-5
                    py-2.5
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    text-slate-700
                    font-bold
                    text-sm
                    hover:bg-slate-50
                  "
                >
                  Yopish
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const orderToPay =
                      selectedOrder;

                    setSelectedOrder(
                      null
                    );

                    openPayment(
                      orderToPay
                    );
                  }}
                  className="
                    px-5
                    py-2.5
                    rounded-xl
                    bg-blue-600
                    text-white
                    font-bold
                    text-sm
                    hover:bg-blue-700
                    flex
                    items-center
                    gap-2
                  "
                >

                  <CreditCard size={16} />

                  To'lov qilish

                </button>

              </div>

            </div>

          </div>

        )}

    </div>
  );
}