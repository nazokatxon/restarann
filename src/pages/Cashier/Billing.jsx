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
  Truck,
  MapPin,
  Phone,
  User,
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
  const [typeFilter, setTypeFilter] = useState("all");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [openMenuId, setOpenMenuId] = useState(null);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // =====================================================
  // DATE HELPERS
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
  // DELIVERY HELPERS
  // =====================================================

  const isDeliveryOrder = (order) => {
    const type = String(
      order?.orderType ||
        order?.order_type ||
        order?.type ||
        order?.deliveryType ||
        order?.delivery?.type ||
        ""
    )
      .trim()
      .toLowerCase();

    return (
      type === "delivery" ||
      type === "dastavka" ||
      type === "dostavka" ||
      type === "uyga" ||
      type === "home" ||
      type === "home_delivery" ||
      order?.isDelivery === true ||
      order?.delivery === true ||
      Boolean(
        order?.deliveryAddress ||
          order?.address ||
          order?.delivery?.address
      )
    );
  };

  const getDeliveryAddress = (order) => {
    return (
      order?.deliveryAddress ||
      order?.address ||
      order?.delivery?.address ||
      order?.deliveryAddressText ||
      order?.location ||
      "Manzil ko'rsatilmagan"
    );
  };

  const getCustomerName = (order) => {
    return (
      order?.customerName ||
      order?.customer?.name ||
      order?.customer?.fullName ||
      order?.userName ||
      order?.name ||
      "Noma'lum mijoz"
    );
  };

  const getCustomerPhone = (order) => {
    return (
      order?.customerPhone ||
      order?.phone ||
      order?.customer?.phone ||
      order?.userPhone ||
      ""
    );
  };

  const getDeliveryComment = (order) => {
    return (
      order?.deliveryComment ||
      order?.delivery?.comment ||
      order?.comment ||
      order?.note ||
      order?.notes ||
      ""
    );
  };

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

      const customerName = String(
        getCustomerName(order)
      ).toLowerCase();

      const customerPhone = String(
        getCustomerPhone(order)
      ).toLowerCase();

      const deliveryAddress = String(
        getDeliveryAddress(order)
      ).toLowerCase();

      const matchesSearch =
        !text ||
        orderNumber.includes(text) ||
        tableNumber.includes(text) ||
        customerName.includes(text) ||
        customerPhone.includes(text) ||
        deliveryAddress.includes(text);

      const status = String(
        order.status || ""
      ).toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "delivery" &&
          isDeliveryOrder(order)) ||
        (typeFilter === "cafe" &&
          !isDeliveryOrder(order));

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
        matchesType &&
        matchesDate
      );
    });
  }, [
    openOrders,
    search,
    dateFilter,
    statusFilter,
    typeFilter,
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
    typeFilter,
    pageSize,
  ]);

  // =====================================================
  // FORMATTERS & UTILS
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
    const items = getItems(order);
    const total = getTotal(order);
    const orderNumber = getOrderNumber(order);

    const orderDate = getDateObject(
      order?.createdAt
    );

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

    const deliveryHtml = isDeliveryOrder(order)
      ? `
        <div class="line"></div>

        <div class="delivery">
          <strong>🚚 DASTAVKA</strong>

          <div>
            Mijoz:
            ${escapeHtml(getCustomerName(order))}
          </div>

          ${
            getCustomerPhone(order)
              ? `
                <div>
                  Telefon:
                  ${escapeHtml(
                    getCustomerPhone(order)
                  )}
                </div>
              `
              : ""
          }

          <div>
            Manzil:
            ${escapeHtml(
              getDeliveryAddress(order)
            )}
          </div>

          ${
            getDeliveryComment(order)
              ? `
                <div>
                  Izoh:
                  ${escapeHtml(
                    getDeliveryComment(order)
                  )}
                </div>
              `
              : ""
          }
        </div>
      `
      : "";

    const receiptWindow = window.open(
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Chek ${escapeHtml(orderNumber)}</title>

        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: white; color: #111; font-family: Arial, Helvetica, sans-serif; }
          .receipt { width: 80mm; margin: 0 auto; padding: 12px 8px 18px; }
          .center { text-align: center; }
          .cafe-name { font-size: 24px; font-weight: 900; letter-spacing: 0.5px; }
          .subtitle { margin-top: 4px; font-size: 11px; color: #555; }
          .line { border-top: 1px dashed #111; margin: 10px 0; }
          .info { font-size: 12px; line-height: 1.7; }
          .info-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
          .info-row span:first-child { color: #555; }
          .info-row span:last-child, .info-row strong { text-align: right; }
          .items { margin-top: 5px; }
          .item { margin-bottom: 10px; font-size: 12px; }
          .item-name { font-weight: 700; margin-bottom: 3px; word-break: break-word; }
          .item-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
          .item-row span { color: #444; }
          .total { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 17px; font-weight: 900; }
          .payment { margin-top: 10px; font-size: 12px; }
          .delivery { font-size: 12px; line-height: 1.7; }
          .delivery strong { display: block; margin-bottom: 4px; }
          .thanks { text-align: center; font-size: 13px; font-weight: 700; margin-top: 18px; }
          .footer { text-align: center; font-size: 10px; color: #666; margin-top: 6px; }

          @media print {
            html, body { width: 80mm; }
            .receipt { width: 80mm; margin: 0; padding: 8px 6px 12px; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>

      <body>
        <div class="receipt">
          <div class="center">
            <div class="cafe-name">𝒜ℐ 𝒞𝒶𝒻ℯ</div>
            <div class="subtitle">KASSA CHEKI</div>
          </div>

          <div class="line"></div>

          <div class="info">
            <div class="info-row">
              <span>Buyurtma:</span>
              <strong>${escapeHtml(orderNumber)}</strong>
            </div>

            <div class="info-row">
              <span>Sana:</span>
              <span>${escapeHtml(dateText)}</span>
            </div>

            ${
              order?.tableNumber
                ? `
                  <div class="info-row">
                    <span>Stol:</span>
                    <strong>${escapeHtml(order.tableNumber)}</strong>
                  </div>
                `
                : ""
            }
          </div>

          ${deliveryHtml}

          <div class="line"></div>

          <div class="items">
            ${
              itemsHtml ||
              `<div style="text-align:center; font-size:12px;">Mahsulotlar mavjud emas</div>`
            }
          </div>

          <div class="line"></div>

          <div class="total">
            <span>JAMI:</span>
            <span>${formatter.format(total)} so'm</span>
          </div>

          <div class="payment">
            To'lov turi: <strong>${escapeHtml(paymentText)}</strong>
          </div>

          <div class="line"></div>

          <div class="thanks">Xaridingiz uchun rahmat!</div>
          <div class="footer">𝒜ℐ 𝒞𝒶𝒻ℯ</div>
        </div>

        <script>
          window.onload = function () {
            setTimeout(function () { window.print(); }, 400);
          };
          window.onafterprint = function () {
            setTimeout(function () { window.close(); }, 300);
          };
        </script>
      </body>
      </html>
    `);

    receiptWindow.document.close();
  };

  // =====================================================
  // PAYMENT ACTION
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
        doc(db, "orders", selectedOrder.id),
        {
          paymentStatus: "paid",
          paymentMethod,
          isPaid: true,
          paidAt: serverTimestamp(),
          paidBy: user?.uid || null,
          paidByUsername: user?.username || null,
          cashierId: user?.uid || null,
          cashierUsername: user?.username || null,
          status: "paid",
          updatedAt: serverTimestamp(),
        }
      );

      setPaymentModal(false);
      setSelectedOrder(null);
      setOpenMenuId(null);

      printReceipt(paidOrder);
    } catch (err) {
      console.error("To'lovda xato:", err);
      setError(
        err?.message || "To'lovni qabul qilib bo'lmadi."
      );
    } finally {
      setProcessingId(null);
    }
  };

  // =====================================================
  // CANCEL ACTION
  // =====================================================

  const handleCancel = async (order) => {
    setOpenMenuId(null);

    const ok = window.confirm(
      `Buyurtma ${getOrderNumber(order)} ni bekor qilmoqchimisiz?`
    );

    if (!ok) return;

    setProcessingId(order.id);
    setError("");

    try {
      await updateDoc(
        doc(db, "orders", order.id),
        {
          paymentStatus: "cancelled",
          status: "cancelled",
          cancelledAt: serverTimestamp(),
          cancelledBy: user?.uid || null,
          cancelledByUsername: user?.username || null,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error("Bekor qilishda xato:", err);
      setError(
        err?.message || "Buyurtmani bekor qilib bo'lmadi."
      );
    } finally {
      setProcessingId(null);
    }
  };

  // =====================================================
  // RESET FILTERS & DETAILS
  // =====================================================

  const resetFilters = () => {
    setSearch("");
    setDateFilter("");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const openDetails = (order) => {
    setOpenMenuId(null);
    setSelectedOrder(order);
    setPaymentModal(false);
  };

  // =====================================================
  // RENDER MAIN
  // =====================================================

  return (
    <div className="w-full min-h-screen bg-slate-50">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-5 sm:px-10 py-7 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Receipt size={25} />
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Kassa
              </h1>

              <p className="mt-3 text-base sm:text-lg text-slate-500">
                Buyurtmalarni qabul qilish va to'lovlarni boshqarish
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition shrink-0"
          >
            <RefreshCw size={18} />
            Yangilash
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="bg-white border-x border-b border-slate-200 px-5 sm:px-10 py-8">
        {/* ERROR MESSAGE */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {/* SEARCH */}
          <div className="relative">
            <Search
              size={21}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buyurtma, mijoz, telefon, manzil..."
              className="w-full h-16 pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-base text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>

          {/* DATE */}
          <div className="relative">
            <CalendarDays
              size={21}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full h-16 pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-base text-slate-600 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>

          {/* STATUS */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none w-full h-16 px-5 pr-12 rounded-xl border border-slate-200 bg-white text-base text-slate-600 outline-none cursor-pointer focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            >
              <option value="all">Holat: Barchasi</option>
              <option value="new">Yangi</option>
              <option value="pending">Kutilmoqda</option>
              <option value="accepted">Qabul qilingan</option>
              <option value="completed">Tugallangan</option>
              <option value="preparing">Tayyorlanmoqda</option>
              <option value="ready">Tayyor</option>
            </select>
            <ChevronDown
              size={19}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          {/* TYPE */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none w-full h-16 px-5 pr-12 rounded-xl border border-slate-200 bg-white text-base text-slate-600 outline-none cursor-pointer focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            >
              <option value="all">Buyurtma turi: Barchasi</option>
              <option value="delivery">🚚 Dastavka</option>
              <option value="cafe">☕ Kafe</option>
            </select>
            <ChevronDown
              size={19}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>

        {/* TABLE CONTENT */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-28 text-center text-slate-400">
              <RefreshCw
                size={32}
                className="mx-auto animate-spin mb-4"
              />
              <p className="text-sm font-medium">
                Buyurtmalar yuklanmoqda...
              </p>
            </div>
          ) : paginatedOrders.length === 0 ? (
            <div className="py-24 text-center">
              <Receipt size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-bold text-lg">
                Ochiq buyurtmalar topilmadi
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Filtrlarni o'zgartirib ko'ring yoki yangi buyurtmalarni kuting.
              </p>
              {(search || dateFilter || statusFilter !== "all" || typeFilter !== "all") && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition"
                >
                  Filtrlarni tozalash
                </button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider">
                      <th className="py-4 px-6">Buyurtma</th>
                      <th className="py-4 px-6">Turi / Joylashuv</th>
                      <th className="py-4 px-6">Mijoz / Telefon</th>
                      <th className="py-4 px-6">Sana</th>
                      <th className="py-4 px-6">Holat</th>
                      <th className="py-4 px-6 text-right">Summa</th>
                      <th className="py-4 px-6 text-center">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm font-medium text-slate-700">
                    {paginatedOrders.map((order) => {
                      const isDel = isDeliveryOrder(order);
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-50/80 transition"
                        >
                          <td className="py-4 px-6 font-bold text-slate-900">
                            {getOrderNumber(order)}
                          </td>
                          <td className="py-4 px-6">
                            {isDel ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 w-fit">
                                  <Truck size={14} /> Dastavka
                                </span>
                                <span className="text-xs text-slate-500 truncate max-w-[200px]" title={getDeliveryAddress(order)}>
                                  {getDeliveryAddress(order)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">
                                  {order.tableNumber ? `${order.tableNumber}-stol` : "Kassadan"}
                                </span>
                                <span className="text-xs text-slate-400">Zalda</span>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">
                                {getCustomerName(order)}
                              </span>
                              {getCustomerPhone(order) && (
                                <span className="text-xs text-slate-500">
                                  {getCustomerPhone(order)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-slate-500 text-xs whitespace-nowrap">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold ${getStatusClass(
                                order.status
                              )}`}
                            >
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right font-black text-slate-900 text-base whitespace-nowrap">
                            {formatMoney(getTotal(order))}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openDetails(order)}
                                title="Batafsil ko'rish"
                                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                              >
                                <Eye size={18} />
                              </button>

                              <button
                                type="button"
                                onClick={() => openPayment(order)}
                                disabled={processingId === order.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-sm transition disabled:opacity-50"
                              >
                                <Banknote size={15} />
                                To'lov
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCancel(order)}
                                disabled={processingId === order.id}
                                title="Bekor qilish"
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                              >
                                <XCircle size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div className="block lg:hidden divide-y divide-slate-200">
                {paginatedOrders.map((order) => {
                  const isDel = isDeliveryOrder(order);
                  return (
                    <div key={order.id} className="p-4 sm:p-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-base">
                          {getOrderNumber(order)}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>{formatDate(order.createdAt)}</span>
                        {isDel ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                            <Truck size={12} /> Dastavka
                          </span>
                        ) : (
                          <span className="font-bold text-slate-700">
                            {order.tableNumber ? `${order.tableNumber}-stol` : "Zalda"}
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                          <User size={14} className="text-slate-400" />
                          <span>{getCustomerName(order)}</span>
                        </div>
                        {getCustomerPhone(order) && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone size={14} className="text-slate-400" />
                            <span>{getCustomerPhone(order)}</span>
                          </div>
                        )}
                        {isDel && (
                          <div className="flex items-start gap-2 text-slate-600">
                            <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                            <span>{getDeliveryAddress(order)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                          Jami:
                        </span>
                        <span className="text-lg font-black text-slate-900">
                          {formatMoney(getTotal(order))}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-1 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => openDetails(order)}
                          className="flex items-center justify-center gap-1 py-2 text-xs font-bold border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                        >
                          <Eye size={14} /> Ko'rish
                        </button>
                        <button
                          type="button"
                          onClick={() => openPayment(order)}
                          disabled={processingId === order.id}
                          className="flex items-center justify-center gap-1 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Banknote size={14} /> To'lov
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(order)}
                          disabled={processingId === order.id}
                          className="flex items-center justify-center gap-1 py-2 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
                        >
                          <XCircle size={14} /> Bekor
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* PAGINATION */}
          {!loading && filteredOrders.length > 0 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Jami: <strong className="text-slate-800">{filteredOrders.length}</strong> ta buyurtma
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="text-xs text-slate-700 font-bold px-3">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {paymentModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">To'lovni qabul qilish</h3>
              <button
                type="button"
                onClick={closePayment}
                disabled={Boolean(processingId)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">
                  To'lanadigan summa
                </span>
                <span className="text-2xl font-black text-slate-900">
                  {formatMoney(getTotal(selectedOrder))}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  To'lov usuli:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition ${
                      paymentMethod === "cash"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Banknote size={20} />
                    Naqd pul
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition ${
                      paymentMethod === "card"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard size={20} />
                    Plastik karta
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closePayment}
                disabled={Boolean(processingId)}
                className="px-4 py-2.5 rounded-xl font-bold text-slate-600 text-sm hover:bg-slate-200/60 transition"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handlePayment}
                disabled={Boolean(processingId)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {processingId ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                Tasdiqlash & Chek chiqarish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {!paymentModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                Buyurtma Tafsilotlari ({getOrderNumber(selectedOrder)})
              </h3>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mijoz:</span>
                  <strong className="text-slate-800">{getCustomerName(selectedOrder)}</strong>
                </div>
                {getCustomerPhone(selectedOrder) && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Telefon:</span>
                    <span className="text-slate-800 font-semibold">{getCustomerPhone(selectedOrder)}</span>
                  </div>
                )}
                {isDeliveryOrder(selectedOrder) && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Manzil:</span>
                    <span className="text-slate-800 font-semibold text-right max-w-[220px]">
                      {getDeliveryAddress(selectedOrder)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <span className="font-bold text-xs uppercase tracking-wider text-slate-400 block mb-2">
                  Mahsulotlar
                </span>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {getItems(selectedOrder).map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{item?.name || item?.title || "Mahsulot"}</p>
                        <span className="text-slate-400">
                          {item?.quantity || 1} x {formatMoney(item?.price || 0)}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatMoney((item?.quantity || 1) * (item?.price || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 text-base">
                <span className="font-bold text-slate-700">Umumiy summa:</span>
                <span className="font-black text-slate-900 text-xl">
                  {formatMoney(getTotal(selectedOrder))}
                </span>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-white"
              >
                Yopish
              </button>
              <button
                type="button"
                onClick={() => openPayment(selectedOrder)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700"
              >
                To'lovga o'tish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}