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
  ChevronLeft,
  ChevronRight,
  Truck,
} from "lucide-react";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function Billing() {
  const { user, cafeId } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] =
  
    useState("all");
  const [typeFilter, setTypeFilter] =
    useState("all");

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  const [paymentModal, setPaymentModal] =
    useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState("cash");

  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // =====================================================
  // DATE
  // =====================================================

  const getDateObject = (timestamp) => {
    if (!timestamp) return null;

    try {
      if (
        typeof timestamp.toDate ===
        "function"
      ) {
        return timestamp.toDate();
      }

      if (
        timestamp?.seconds !== undefined
      ) {
        return new Date(
          timestamp.seconds * 1000
        );
      }

      const date = new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date;
    } catch {
      return null;
    }
  };

  // =====================================================
  // DELIVERY
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
  // ORDERS
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
      where(
        "cafeId",
        "==",
        String(cafeId)
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data =
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

        data.sort((a, b) => {
          const aDate =
            getDateObject(a.createdAt);

          const bDate =
            getDateObject(b.createdAt);

          return (
            (bDate?.getTime() || 0) -
            (aDate?.getTime() || 0)
          );
        });

        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.error(
          "Orders olishda xato:",
          err
        );

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
      const paymentStatus =
        String(
          order?.paymentStatus || ""
        )
          .trim()
          .toLowerCase();

      const status =
        String(
          order?.status || ""
        )
          .trim()
          .toLowerCase();

      const cancelled =
        paymentStatus === "cancelled" ||
        paymentStatus === "canceled" ||
        status === "cancelled" ||
        status === "canceled";

      const paid =
        paymentStatus === "paid" ||
        order?.isPaid === true;

      // Kassada faqat ofitsiant yuborgan buyurtmalar chiqadi.
      const sentToCashier =
        status === "waiting_payment";

      return !cancelled && !paid && sentToCashier;
    });
  }, [orders]);

  // =====================================================
  // FILTER
  // =====================================================

  const filteredOrders = useMemo(() => {
    const text =
      search.trim().toLowerCase();

    return openOrders.filter((order) => {
      const orderNumber = String(
        order?.orderNumber ||
          order?.orderNo ||
          order?.number ||
          order?.id ||
          ""
      ).toLowerCase();

      const tableNumber = String(
        order?.tableNumber || ""
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
        order?.status || ""
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
        const orderDate =
          getDateObject(
            order?.sentToCashierAt ||
              order?.createdAt
          );

        if (!orderDate) {
          matchesDate = false;
        } else {
          const year =
            orderDate.getFullYear();

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
      filteredOrders.length /
        pageSize
    )
  );

  const currentPage = Math.min(
    page,
    totalPages
  );

  const paginatedOrders = useMemo(() => {
    const start =
      (currentPage - 1) *
      pageSize;

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
  ]);

  // =====================================================
  // HELPERS
  // =====================================================

  const getTotal = (order) => {
    const totalAmount =
      Number(order?.totalAmount);

    if (
      Number.isFinite(totalAmount) &&
      totalAmount > 0
    ) {
      return totalAmount;
    }

    const totalPrice =
      Number(order?.totalPrice);

    if (
      Number.isFinite(totalPrice) &&
      totalPrice > 0
    ) {
      return totalPrice;
    }

    const total =
      Number(order?.total);

    if (
      Number.isFinite(total) &&
      total > 0
    ) {
      return total;
    }

    const amount =
      Number(order?.amount);

    if (
      Number.isFinite(amount) &&
      amount > 0
    ) {
      return amount;
    }

    return getItems(order).reduce(
      (sum, item) => {
        const price = Number(item?.price) || 0;
        const quantity = Number(
          item?.quantity ??
            item?.qty ??
            item?.count ??
            1
        ) || 1;

        return sum + price * quantity;
      },
      0
    );
  };

  const getItems = (order) => {
    if (Array.isArray(order?.kitchenItems)) {
      return order.kitchenItems;
    }

    if (Array.isArray(order?.items)) {
      return order.items;
    }

    if (Array.isArray(order?.products)) {
      return order.products;
    }

    return [];
  };

  const formatMoney = (value) => {
    return (
      new Intl.NumberFormat(
        "uz-UZ"
      ).format(
        Number(value) || 0
      ) + " so'm"
    );
  };

  const formatDate = (timestamp) => {
    const date =
      getDateObject(timestamp);

    if (!date) return "-";

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
  // STATUS
  // =====================================================

  const getStatusLabel = (status) => {
    const value = String(
      status || ""
    ).toLowerCase();

    switch (value) {
      case "new":
      case "yangi":
        return "Yangi";

      case "waiting_payment":
        return "Kassada kutilmoqda";

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

    if (value === "waiting_payment") {
      return "bg-amber-50 text-amber-700";
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
  // PAYMENT
  // =====================================================

  const openPayment = (order) => {
    setSelectedOrder(order);

    const method =
      String(
        order?.paymentMethod || ""
      )
        .trim()
        .toLowerCase();

    setPaymentMethod(
      method === "card" ||
        method === "karta"
        ? "card"
        : "cash"
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

    const orderNumber =
      getOrderNumber(order);

    const orderDate =
      getDateObject(
        order?.paidAt ||
          order?.createdAt
      );

    const dateText = orderDate
      ? orderDate.toLocaleString(
          "uz-UZ",
          {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }
        )
      : new Date().toLocaleString(
          "uz-UZ"
        );

    const paymentText =
      order?.paymentMethod === "card"
        ? "Plastik karta"
        : "Naqd pul";

    const formatter =
      new Intl.NumberFormat(
        "uz-UZ"
      );

    const escapeHtml = (value) => {
      return String(value ?? "")
        .replace(
          /&/g,
          "&amp;"
        )
        .replace(
          /</g,
          "&lt;"
        )
        .replace(
          />/g,
          "&gt;"
        )
        .replace(
          /"/g,
          "&quot;"
        )
        .replace(
          /'/g,
          "&#039;"
        );
    };

    const itemsHtml = items
      .map((item) => {
        const quantity =
          Number(
            item?.quantity ??
              item?.qty ??
              1
          ) || 1;

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

    const deliveryHtml =
      isDeliveryOrder(order)
        ? `
        <div class="line"></div>

        <div class="delivery">
          <strong>🚚 DASTAVKA</strong>

          <div>
            Mijoz:
            ${escapeHtml(
              getCustomerName(order)
            )}
          </div>

          ${
            getCustomerPhone(order)
              ? `
                <div>
                  Telefon:
                  ${escapeHtml(
                    getCustomerPhone(
                      order
                    )
                  )}
                </div>
              `
              : ""
          }

          <div>
            Manzil:
            ${escapeHtml(
              getDeliveryAddress(
                order
              )
            )}
          </div>

          ${
            getDeliveryComment(order)
              ? `
                <div>
                  Izoh:
                  ${escapeHtml(
                    getDeliveryComment(
                      order
                    )
                  )}
                </div>
              `
              : ""
          }
        </div>
      `
        : "";

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
          Chek ${escapeHtml(
            orderNumber
          )}
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
            gap: 8px;
          }

          .item-row span {
            color: #444;
          }

          .total {
            display: flex;
            justify-content: space-between;
            font-size: 17px;
            font-weight: 900;
          }

          .payment {
            margin-top: 10px;
            font-size: 13px;
          }

          .delivery {
            font-size: 12px;
            line-height: 1.7;
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
              <span>Buyurtma:</span>

              <strong>
                ${escapeHtml(
                  orderNumber
                )}
              </strong>
            </div>

            <div class="info-row">
              <span>Sana:</span>

              <span>
                ${escapeHtml(
                  dateText
                )}
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

          ${deliveryHtml}

          <div class="line"></div>

          <div class="items">

            ${
              itemsHtml ||
              `
                <div
                  style="text-align:center"
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
              ${formatter.format(
                total
              )} so'm
            </span>

          </div>

          <div class="payment">

            To'lov turi:

            <strong>
              ${escapeHtml(
                paymentText
              )}
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
  // CLOSE CHEK / PAYMENT
  // =====================================================

  const handlePayment = async () => {
    if (!selectedOrder) return;

    if (
      paymentMethod !== "cash" &&
      paymentMethod !== "card"
    ) {
      setError(
        "Avval Naqd pul yoki Plastik karta tanlang."
      );

      return;
    }

    setProcessingId(
      selectedOrder.id
    );

    setError("");

    try {
      const paidAt = new Date();

      /*
       * Printer uchun lokal paidAt.
       * Firestore uchun esa serverTimestamp().
       */

      const paidOrder = {
        ...selectedOrder,

        paymentStatus: "paid",

        paymentMethod:
          paymentMethod === "card"
            ? "card"
            : "cash",

        isPaid: true,

        totalAmount: getTotal(selectedOrder),

        status: "closed",

        paidAt,

        paidBy:
          user?.uid || null,

        paidByUsername:
          user?.username || null,

        cashierId:
          user?.uid || null,

        cashierUsername:
          user?.username || null,
      };

      await updateDoc(
        doc(
          db,
          "orders",
          selectedOrder.id
        ),
        {
          paymentStatus: "paid",

          paymentMethod:
            paymentMethod === "card"
              ? "card"
              : "cash",

          isPaid: true,

          totalAmount: getTotal(selectedOrder),

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

          status: "closed",

          closedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      console.log(
        "✅ CHEK YOPILDI:",
        {
          orderId:
            selectedOrder.id,
          paymentStatus:
            "paid",
          paymentMethod:
            paymentMethod,
          total:
            getTotal(
              selectedOrder
            ),
        }
      );

      setPaymentModal(false);
      setSelectedOrder(null);

      printReceipt(paidOrder);
    } catch (err) {
      console.error(
        "To'lovda xato:",
        err
      );

      setError(
        err?.message ||
          "Chekni yopib bo'lmadi."
      );
    } finally {
      setProcessingId(null);
    }
  };

  // =====================================================
  // CANCEL
  // =====================================================

  const handleCancel = async (order) => {
    const ok =
      window.confirm(
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
          paymentStatus:
            "cancelled",

          status:
            "cancelled",

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
  // RESET
  // =====================================================

  const resetFilters = () => {
    setSearch("");
    setDateFilter("");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const openDetails = (order) => {
    setSelectedOrder(order);
    setPaymentModal(false);
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="w-full min-h-screen bg-slate-50">

      {/* HEADER */}

      <div className="bg-white border-b border-slate-200">

        <div className="px-5 sm:px-10 py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-6">

          <div className="flex items-start gap-5">

            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Receipt size={25} />
            </div>

            <div>

              <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
                Kassa
              </h1>

              <p className="mt-3 text-base text-slate-500">
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
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50"
          >
            <RefreshCw size={18} />
            Yangilash
          </button>

        </div>

      </div>

      {/* CONTENT */}

      <div className="bg-white border-x border-b border-slate-200 px-5 sm:px-10 py-8">

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        {/* FILTERS */}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">

          <div className="relative">

            <Search
              size={21}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Buyurtma, mijoz, telefon, manzil..."
              className="w-full h-16 pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-base outline-none"
            />

          </div>

          <div className="relative">

            <CalendarDays
              size={21}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="date"
              value={dateFilter}
              onChange={(e) =>
                setDateFilter(
                  e.target.value
                )
              }
              className="w-full h-16 pl-12 pr-4 rounded-xl border border-slate-200"
            />

          </div>

          <div className="relative">

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="appearance-none w-full h-16 px-5 pr-12 rounded-xl border border-slate-200 bg-white"
            >
              <option value="all">
                Holat: Barchasi
              </option>

              <option value="waiting_payment">
                Kassada kutilmoqda
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

          </div>

          <div className="relative">

            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(
                  e.target.value
                )
              }
              className="appearance-none w-full h-16 px-5 pr-12 rounded-xl border border-slate-200 bg-white"
            >
              <option value="all">
                Buyurtma turi: Barchasi
              </option>

              <option value="delivery">
                🚚 Dastavka
              </option>

              <option value="cafe">
                ☕ Kafe
              </option>

            </select>

            <ChevronDown
              size={19}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

          </div>

        </div>

        {/* TABLE */}

        <div className="border border-slate-200 rounded-2xl overflow-hidden">

          {loading ? (

            <div className="py-28 text-center text-slate-400">

              <RefreshCw
                size={32}
                className="mx-auto animate-spin mb-4"
              />

              Buyurtmalar yuklanmoqda...

            </div>

          ) : paginatedOrders.length === 0 ? (

            <div className="py-24 text-center">

              <Receipt
                size={48}
                className="mx-auto text-slate-300 mb-3"
              />

              <p className="text-slate-600 font-bold text-lg">
                Ochiq buyurtmalar topilmadi
              </p>

              <p className="text-slate-400 text-sm mt-1">
                Yangi buyurtmalarni kuting.
              </p>

              {(search ||
                dateFilter ||
                statusFilter !==
                  "all" ||
                typeFilter !==
                  "all") && (
                <button
                  type="button"
                  onClick={
                    resetFilters
                  }
                  className="mt-4 px-4 py-2 bg-slate-100 rounded-lg text-sm"
                >
                  Filtrlarni tozalash
                </button>
              )}

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead>

                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase">

                    <th className="py-4 px-6">
                      Buyurtma
                    </th>

                    <th className="py-4 px-6">
                      Turi
                    </th>

                    <th className="py-4 px-6">
                      Mijoz
                    </th>

                    <th className="py-4 px-6">
                      Sana
                    </th>

                    <th className="py-4 px-6">
                      Holat
                    </th>

                    <th className="py-4 px-6 text-right">
                      Summa
                    </th>

                    <th className="py-4 px-6 text-center">
                      Amallar
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-200">

                  {paginatedOrders.map(
                    (order) => {
                      const isDel =
                        isDeliveryOrder(
                          order
                        );

                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-50"
                        >

                          <td className="py-4 px-6 font-bold">
                            {getOrderNumber(
                              order
                            )}
                          </td>

                          <td className="py-4 px-6">

                            {isDel ? (

                              <div className="flex flex-col gap-1">

                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-amber-50 text-amber-700 w-fit">

                                  <Truck
                                    size={14}
                                  />

                                  Dastavka

                                </span>

                                <span className="text-xs text-slate-500 max-w-[200px] truncate">
                                  {getDeliveryAddress(
                                    order
                                  )}
                                </span>

                              </div>

                            ) : (

                              <div>

                                <span className="font-bold">
                                  {order.tableNumber
                                    ? `${order.tableNumber}-stol`
                                    : "Kassadan"}
                                </span>

                                <span className="block text-xs text-slate-400">
                                  Zalda
                                </span>

                              </div>

                            )}

                          </td>

                          <td className="py-4 px-6">

                            <div>

                              <span className="font-semibold">
                                {getCustomerName(
                                  order
                                )}
                              </span>

                              {getCustomerPhone(
                                order
                              ) && (
                                <span className="block text-xs text-slate-500">
                                  {getCustomerPhone(
                                    order
                                  )}
                                </span>
                              )}

                            </div>

                          </td>

                          <td className="py-4 px-6 text-xs text-slate-500">
                            {formatDate(
                              order.sentToCashierAt ||
                                order.createdAt
                            )}
                          </td>

                          <td className="py-4 px-6">

                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold ${getStatusClass(
                                order.status
                              )}`}
                            >
                              {getStatusLabel(
                                order.status
                              )}
                            </span>

                          </td>

                          <td className="py-4 px-6 text-right font-black whitespace-nowrap">
                            {formatMoney(
                              getTotal(
                                order
                              )
                            )}
                          </td>

                          <td className="py-4 px-6">

                            <div className="flex items-center justify-center gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  openDetails(
                                    order
                                  )
                                }
                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                              >
                                <Eye
                                  size={18}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openPayment(
                                    order
                                  )
                                }
                                disabled={
                                  processingId ===
                                  order.id
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg disabled:opacity-50"
                              >
                                <Banknote
                                  size={15}
                                />

                                To'lov
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleCancel(
                                    order
                                  )
                                }
                                disabled={
                                  processingId ===
                                  order.id
                                }
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <XCircle
                                  size={18}
                                />
                              </button>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          )}

          {/* PAGINATION */}

          {!loading &&
            filteredOrders.length >
              0 && (

              <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-between">

                <div className="text-xs text-slate-500">

                  Jami:

                  <strong className="text-slate-800 ml-1">
                    {
                      filteredOrders.length
                    }
                  </strong>

                  {" "}ta buyurtma

                </div>

                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) =>
                        Math.max(
                          1,
                          p - 1
                        )
                      )
                    }
                    disabled={
                      currentPage ===
                      1
                    }
                    className="p-2 border rounded-lg disabled:opacity-40"
                  >
                    <ChevronLeft
                      size={16}
                    />
                  </button>

                  <span className="text-xs font-bold px-3">
                    {currentPage} /{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) =>
                        Math.min(
                          totalPages,
                          p + 1
                        )
                      )
                    }
                    disabled={
                      currentPage ===
                      totalPages
                    }
                    className="p-2 border rounded-lg disabled:opacity-40"
                  >
                    <ChevronRight
                      size={16}
                    />
                  </button>

                </div>

              </div>
            )}

        </div>

      </div>

      {/* =====================================================
          PAYMENT MODAL
      ===================================================== */}

      {paymentModal &&
        selectedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">

            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">

              <div className="px-6 py-5 border-b flex items-center justify-between">

                <h3 className="text-lg font-bold">
                  Chekni yopish
                </h3>

                <button
                  type="button"
                  onClick={
                    closePayment
                  }
                  disabled={Boolean(
                    processingId
                  )}
                  className="p-1 text-slate-400"
                >
                  <X size={20} />
                </button>

              </div>

              <div className="p-6 space-y-5">

                {/* SUMMA */}

                <div className="bg-slate-50 p-4 rounded-xl text-center">

                  <span className="text-xs text-slate-500 uppercase font-bold block mb-1">
                    To'lanadigan summa
                  </span>

                  <span className="text-2xl font-black text-slate-900">
                    {formatMoney(
                      getTotal(
                        selectedOrder
                      )
                    )}
                  </span>

                </div>

                {/* PAYMENT METHOD */}

                <div>

                  <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
                    To'lov usulini tanlang
                  </label>

                  <div className="grid grid-cols-2 gap-3">

                    {/* CASH */}

                    <button
                      type="button"
                      onClick={() =>
                        setPaymentMethod(
                          "cash"
                        )
                      }
                      className={`flex flex-col items-center justify-center gap-2 py-5 rounded-xl font-bold border-2 transition ${
                        paymentMethod ===
                        "cash"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >

                      <Banknote
                        size={26}
                      />

                      <span>
                        Naqd pul
                      </span>

                      {paymentMethod ===
                        "cash" && (
                        <span className="text-xs">
                          ✓ Tanlandi
                        </span>
                      )}

                    </button>

                    {/* CARD */}

                    <button
                      type="button"
                      onClick={() =>
                        setPaymentMethod(
                          "card"
                        )
                      }
                      className={`flex flex-col items-center justify-center gap-2 py-5 rounded-xl font-bold border-2 transition ${
                        paymentMethod ===
                        "card"
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >

                      <CreditCard
                        size={26}
                      />

                      <span>
                        Plastik karta
                      </span>

                      {paymentMethod ===
                        "card" && (
                        <span className="text-xs">
                          ✓ Tanlandi
                        </span>
                      )}

                    </button>

                  </div>

                </div>

                {/* SELECTED PAYMENT */}

                <div className="rounded-xl bg-slate-900 text-white p-4 text-center">

                  <p className="text-xs text-slate-300">
                    Tanlangan to'lov turi
                  </p>

                  <p className="text-lg font-black mt-1">

                    {paymentMethod ===
                    "card"
                      ? "💳 Plastik karta"
                      : "💵 Naqd pul"}

                  </p>

                </div>

              </div>

              {/* BUTTONS */}

              <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-end gap-3">

                <button
                  type="button"
                  onClick={
                    closePayment
                  }
                  disabled={Boolean(
                    processingId
                  )}
                  className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200"
                >
                  Bekor qilish
                </button>

                <button
                  type="button"
                  onClick={
                    handlePayment
                  }
                  disabled={
                    Boolean(
                      processingId
                    ) ||
                    !paymentMethod
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md disabled:opacity-50"
                >

                  {processingId ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle
                      size={16}
                    />
                  )}

                  Chekni yopish

                </button>

              </div>

            </div>

          </div>
        )}

      {/* =====================================================
          DETAILS MODAL
      ===================================================== */}

      {!paymentModal &&
        selectedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">

            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">

              <div className="px-6 py-5 border-b flex items-center justify-between">

                <h3 className="text-lg font-bold">
                  Buyurtma tafsilotlari{" "}
                  (
                  {getOrderNumber(
                    selectedOrder
                  )}
                  )
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedOrder(
                      null
                    )
                  }
                  className="p-1 text-slate-400"
                >
                  <X size={20} />
                </button>

              </div>

              <div className="p-6 space-y-4">

                <div className="bg-slate-50 p-4 rounded-xl space-y-2">

                  <div className="flex justify-between">

                    <span className="text-slate-500">
                      Mijoz:
                    </span>

                    <strong>
                      {getCustomerName(
                        selectedOrder
                      )}
                    </strong>

                  </div>

                  {selectedOrder.tableNumber && (
                    <div className="flex justify-between">

                      <span className="text-slate-500">
                        Stol:
                      </span>

                      <strong>
                        {
                          selectedOrder.tableNumber
                        }
                      </strong>

                    </div>
                  )}

                  {getCustomerPhone(
                    selectedOrder
                  ) && (
                    <div className="flex justify-between">

                      <span className="text-slate-500">
                        Telefon:
                      </span>

                      <strong>
                        {getCustomerPhone(
                          selectedOrder
                        )}
                      </strong>

                    </div>
                  )}

                  {isDeliveryOrder(
                    selectedOrder
                  ) && (
                    <div className="flex justify-between gap-4">

                      <span className="text-slate-500">
                        Manzil:
                      </span>

                      <strong className="text-right">
                        {getDeliveryAddress(
                          selectedOrder
                        )}
                      </strong>

                    </div>
                  )}

                </div>

                <div>

                  <p className="font-bold text-xs uppercase text-slate-400 mb-2">
                    Mahsulotlar
                  </p>

                  <div className="border rounded-xl overflow-hidden">

                    {getItems(
                      selectedOrder
                    ).map(
                      (
                        item,
                        index
                      ) => {

                        const quantity =
                          Number(
                            item?.quantity ??
                              item?.qty ??
                              1
                          ) || 1;

                        const price =
                          Number(
                            item?.price
                          ) || 0;

                        return (
                          <div
                            key={index}
                            className="p-3 flex items-center justify-between border-b last:border-b-0"
                          >

                            <div>

                              <p className="font-bold">
                                {item?.name ||
                                  item?.title ||
                                  "Mahsulot"}
                              </p>

                              <span className="text-xs text-slate-400">
                                {quantity} x{" "}
                                {formatMoney(
                                  price
                                )}
                              </span>

                            </div>

                            <span className="font-bold">
                              {formatMoney(
                                quantity *
                                  price
                              )}
                            </span>

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>

                <div className="flex justify-between pt-2">

                  <span className="font-bold">
                    Umumiy summa:
                  </span>

                  <span className="font-black text-xl">
                    {formatMoney(
                      getTotal(
                        selectedOrder
                      )
                    )}
                  </span>

                </div>

              </div>

              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setSelectedOrder(
                      null
                    )
                  }
                  className="px-4 py-2 rounded-xl border font-bold"
                >
                  Yopish
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openPayment(
                      selectedOrder
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold"
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