import React, { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query } from "firebase/firestore";
import { FiSearch, FiPrinter, FiEye, FiX } from "react-icons/fi";
import { db } from "../../firebase/config.js";

// =========================================================
// BUYURTMA TURI (Stol / Dastavka / Saboy) UCHUN YORDAMCHI
// =========================================================

function getOrderTypeInfo(order) {
  const type = order.orderType || "stol";

  if (type === "dastavka") {
    return {
      label: "🚚 Dastavka",
      badgeClass: "bg-blue-50 text-blue-600",
    };
  }

  if (type === "saboy") {
    return {
      label: "🛍️ Saboy",
      badgeClass: "bg-purple-50 text-purple-600",
    };
  }

  return {
    label: "🪑 Stol",
    badgeClass: "bg-amber-50 text-amber-600",
  };
}

// Jadval/chekda "Stol" ustuni o'rniga ko'rsatiladigan qiymat
function getLocationLabel(order) {
  const type = order.orderType || "stol";

  if (type === "dastavka" || type === "saboy") {
    return order.customerName || "Mijoz";
  }

  return `№ ${order.tableNumber || order.table || "-"}`;
}

export default function Receipts() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // cafeId -> { name, phone, address, ... } keshi
  const [cafeInfoCache, setCafeInfoCache] = useState({});

  useEffect(() => {
    const q = query(collection(db, "orders"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        // Barcha yopilgan va to'lov qilingan buyurtmalarni ushlab olish
        const paidOrders = data.filter((o) => {
          const statusStr = String(o.status || "").toLowerCase();
          const payStatusStr = String(o.paymentStatus || "").toLowerCase();

          return (
            o.isPaid === true ||
            payStatusStr === "paid" ||
            statusStr === "completed" ||
            statusStr === "closed" ||
            statusStr === "paid" ||
            statusStr === "yopilgan" ||
            statusStr === "tolangan" ||
            Boolean(o.paidAt) ||
            Boolean(o.closedAt)
          );
        });

        // Eng so'nggi yopilgan cheklarni tepaga saralash
        paidOrders.sort((a, b) => {
          const getTime = (item) => {
            const t = item.paidAt || item.closedAt || item.updatedAt || item.createdAt;
            if (!t) return 0;
            if (t.seconds) return t.seconds * 1000;
            if (t.toDate) return t.toDate().getTime();
            return new Date(t).getTime() || 0;
          };
          return getTime(b) - getTime(a);
        });

        setOrders(paidOrders);
        setLoading(false);
      },
      (error) => {
        console.error("Cheklarni yuklashda xatolik:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Chek ochilganda, agar shu cafeId hali keshda bo'lmasa, Firestore'dan
  // kafe ma'lumotini (telefon raqami) olib kelamiz
  useEffect(() => {
    const cafeId = selectedReceipt?.cafeId;
    if (!cafeId || cafeInfoCache[cafeId]) return;

    let isMounted = true;

    const loadCafeInfo = async () => {
      try {
        const cafeSnap = await getDoc(doc(db, "cafes", cafeId));
        if (isMounted && cafeSnap.exists()) {
          setCafeInfoCache((prev) => ({
            ...prev,
            [cafeId]: cafeSnap.data(),
          }));
        }
      } catch (error) {
        console.error("Cafe ma'lumotini olishda xatolik:", error);
      }
    };

    loadCafeInfo();
    return () => {
      isMounted = false;
    };
  }, [selectedReceipt, cafeInfoCache]);

  const filteredOrders = orders.filter((order) => {
    const tableNo = String(order.tableNumber || order.table || "");
    const orderId = String(order.id || "");
    const customerName = String(order.customerName || "");
    const customerPhone = String(order.customerPhone || "");

    const value = searchTerm.toLowerCase();

    return (
      tableNo.toLowerCase().includes(value) ||
      orderId.toLowerCase().includes(value) ||
      customerName.toLowerCase().includes(value) ||
      customerPhone.toLowerCase().includes(value)
    );
  });

  // Chekni chop etish funksiyasi
  const handlePrint = (order = null) => {
    if (order) {
      setSelectedReceipt(order);
      setTimeout(() => {
        window.print();
      }, 150);
    } else {
      window.print();
    }
  };

  const formatMoney = (amount) => {
    return `${Number(amount || 0).toLocaleString("uz-UZ")} so'm`;
  };

  const formatDate = (order) => {
    const dateValue =
      order.paidAt || order.closedAt || order.updatedAt || order.createdAt;
    if (!dateValue) return "-";
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(date.getTime())) return "-";

    return date.toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Joriy chekka tegishli kafe ma'lumoti (telefon uchun)
  const selectedCafeInfo = selectedReceipt?.cafeId
    ? cafeInfoCache[selectedReceipt.cafeId]
    : null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="font-bold text-slate-500 animate-pulse">
          Cheklar yuklanmoqda...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1250px] mx-auto px-5 py-8">
      {/* CSS PRINT STYLE: 58mm termal chek printer o'lchamiga moslashtirilgan */}
      <style>{`
        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
          }

          body * {
            visibility: hidden;
          }

          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }

          #printable-receipt {
            position: absolute;
            left: 0 !important;
            top: 0 !important;
            width: 58mm;
            max-width: 58mm;
            padding: 1mm 2mm !important;
            margin: 0 !important;
            font-size: 8px;
            line-height: 1.25;
            color: #000 !important;
          }

          #printable-receipt * {
            color: #000 !important;
          }

          #printable-receipt h2 {
            font-size: 12px;
          }

          #printable-receipt .receipt-divider {
            margin: 2px 0 !important;
            border-color: #000 !important;
          }

          #printable-receipt .space-y-4 > * + * {
            margin-top: 3px !important;
          }
        }
      `}</style>

      {/* Sarlavha va Qidiruv */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Cheklar</h1>
          <p className="text-sm text-slate-400 mt-1">
            To'lov qilingan va yopilgan barcha cheklar ro'yxati
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-4 top-3.5 text-slate-400 text-lg" />
          <input
            type="text"
            placeholder="Stol, mijoz, telefon yoki ID bo'yicha qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 shadow-sm transition"
          />
        </div>
      </div>

      {/* Cheklar Jadvali */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-5xl mb-4">🧾</div>
            <h3 className="font-bold text-slate-600">Cheklar topilmadi</h3>
            <p className="text-sm text-slate-400 mt-1">
              Hozircha yopilgan to'lovlar mavjud emas
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400">
                    Chek ID
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400">
                    Vaqt
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400">
                    Turi
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400">
                    Stol / Mijoz
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400">
                    To'lov turi
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400">
                    Jami
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 text-right">
                    Amallar
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const typeInfo = getOrderTypeInfo(order);

                  return (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition"
                    >
                      <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">
                        #{order.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">
                        {formatDate(order)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold ${typeInfo.badgeClass}`}
                        >
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {getLocationLabel(order)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-600">
                          {order.paymentMethod || order.paymentType || "Karta orqali"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800">
                        {formatMoney(
                          order.total || order.totalPrice || order.totalAmount || 0
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Ko'rish Tugmasi */}
                          <button
                            onClick={() => setSelectedReceipt(order)}
                            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                          >
                            <FiEye className="text-base" /> Ko'rish
                          </button>

                          {/* Chop Etish Tugmasi */}
                          <button
                            onClick={() => handlePrint(order)}
                            className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition inline-flex items-center gap-1.5 text-xs font-bold shadow-sm cursor-pointer"
                          >
                            <FiPrinter className="text-base" /> Chop etish
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chekni ko'rish va Chop etish Modali */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
              <h3 className="font-bold text-slate-800 text-lg">
                Chek ma'lumotlari
              </h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition cursor-pointer"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            {/* Printable Receipt Body */}
            <div
              className="py-6 font-mono text-slate-700 text-sm space-y-4"
              id="printable-receipt"
            >
              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-800">
                  {selectedCafeInfo?.name || "AI CAFE"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Xizmatingizdan xursandmiz!
                </p>
                <div className="my-3 border-b border-dashed border-slate-300 receipt-divider"></div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Chek №:</span>
                  <span className="font-bold">
                    #{selectedReceipt.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sana:</span>
                  <span>{formatDate(selectedReceipt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Turi:</span>
                  <span className="font-bold">
                    {getOrderTypeInfo(selectedReceipt).label}
                  </span>
                </div>

                {selectedReceipt.orderType === "dastavka" ||
                selectedReceipt.orderType === "saboy" ? (
                  <>
                    <div className="flex justify-between">
                      <span>Mijoz:</span>
                      <span className="font-bold">
                        {selectedReceipt.customerName || "-"}
                      </span>
                    </div>
                    {selectedReceipt.customerPhone && (
                      <div className="flex justify-between">
                        <span>Telefon:</span>
                        <span>{selectedReceipt.customerPhone}</span>
                      </div>
                    )}
                    {selectedReceipt.orderType === "dastavka" &&
                      selectedReceipt.customerAddress && (
                        <div className="flex justify-between">
                          <span>Manzil:</span>
                          <span className="text-right">
                            {selectedReceipt.customerAddress}
                          </span>
                        </div>
                      )}
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>Stol:</span>
                    <span className="font-bold">
                      № {selectedReceipt.tableNumber || selectedReceipt.table || "-"}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-slate-300 my-2 receipt-divider"></div>

              {/* Items List */}
              <div className="space-y-2 text-xs">
                {(
                  selectedReceipt.items ||
                  selectedReceipt.products ||
                  selectedReceipt.kitchenItems ||
                  []
                ).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {item.name || item.title} x{item.quantity || item.count || 1}
                    </span>
                    <span className="font-bold">
                      {formatMoney(
                        (item.price || 0) * (item.quantity || item.count || 1)
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-slate-300 my-2 receipt-divider"></div>

              {/* Total Calculation */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
                  <span>JAMI:</span>
                  <span>
                    {formatMoney(
                      selectedReceipt.total ||
                        selectedReceipt.totalPrice ||
                        selectedReceipt.totalAmount ||
                        0
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>To'lov turi:</span>
                  <span>
                    {selectedReceipt.paymentMethod ||
                      selectedReceipt.paymentType ||
                      "Karta orqali"}
                  </span>
                </div>
              </div>

              <div className="text-center pt-4 text-xs text-slate-400">
                <p>*** RAHMAT ***</p>
                {selectedCafeInfo?.phone && (
                  <p className="mt-1 font-bold text-slate-500">
                    ☎ {selectedCafeInfo.phone}
                  </p>
                )}
                {selectedCafeInfo?.address && (
                  <p className="mt-0.5 text-slate-400">
                    {selectedCafeInfo.address}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-100 print:hidden">
              <button
                onClick={() => handlePrint()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-100 transition cursor-pointer"
              >
                <FiPrinter className="text-lg" /> Chop etish (Print)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}