import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";

export default function Billing() {
  const { cafeId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("unpaid"); // unpaid, paid, all
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  // 🔍 Qidiruv matni uchun yangi state qo'shildi
  const [searchTerm, setSearchTerm] = useState(""); 

  useEffect(() => {
    if (!cafeId) return;

    const q = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      data.sort((a, b) => {
        const ad = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const bd = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return bd - ad;
      });
      setOrders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [cafeId]);

  const openPaymentModal = (order) => {
    setSelectedOrder(order);
    setDiscountPercent(0);
  };

  const getDiscountedTotal = (order, percent) => {
    const original = Number(order?.totalPrice || 0);
    const safePercent = Math.min(Math.max(Number(percent) || 0, 0), 100);
    const discountAmount = Math.round((original * safePercent) / 100);
    const finalTotal = original - discountAmount;
    return { original, discountAmount, finalTotal, safePercent };
  };

  const markAsPaid = async (order, method) => {
    try {
      const { original, discountAmount, finalTotal, safePercent } =
        getDiscountedTotal(order, discountPercent);

      await updateDoc(doc(db, "orders", order.id), {
        paymentStatus: "paid",
        paymentMethod: method,
        paidAt: new Date(),
        originalPrice: original,
        discountPercent: safePercent,
        discountAmount: discountAmount,
        totalPrice: finalTotal,
      });
      setSelectedOrder(null);
      setDiscountPercent(0);
    } catch (error) {
      console.error("To'lovni belgilashda xatolik:", error);
      alert("Xatolik yuz berdi, qaytadan urinib ko'ring");
    }
  };

  // 🖨️ Professional Termal Chek chiqarish funksiyasi
  const handlePrintReceipt = (order) => {
    const dateStr = order.createdAt?.toDate 
      ? order.createdAt.toDate().toLocaleString("uz-UZ") 
      : new Date(order.createdAt).toLocaleString("uz-UZ");

    const printWindow = window.open("", "_blank", "width=400,height=600");
    
    const hasDiscount = order.discountPercent > 0;
    const finalPrice = order.totalPrice;
    const originalPrice = order.originalPrice || order.totalPrice;

    const itemsHtml = (order.items || []).map(item => `
      <tr style="border-bottom: 1px dashed #000;">
        <td style="padding: 6px 0; text-align: left; font-size: 14px;">
          <b>${item.name}</b><br>
          ${item.quantity} x ${Number(item.price).toLocaleString()} so'm
        </td>
        <td style="padding: 6px 0; text-align: right; font-size: 14px; vertical-align: bottom;">
          ${(item.price * item.quantity).toLocaleString()} so'm
        </td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Chek_Stol_${order.tableNumber}</title>
          <style>
            @page { size: auto; margin: 0mm; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 260px; 
              margin: 0 auto; 
              padding: 10px;
              color: #000;
            }
            .text-center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <h2 class="text-center" style="margin: 0 0 4px 0; font-size: 18px;">TAOM KAFE</h2>
          <p class="text-center" style="margin: 0 0 8px 0; font-size: 12px;">Xizmatingizdan mamnunmiz!</p>
          <div class="divider"></div>
          <p style="margin: 4px 0; font-size: 13px;"><b>Stol:</b> №${order.tableNumber || "-"}</p>
          <p style="margin: 4px 0; font-size: 13px;"><b>Sana:</b> ${dateStr}</p>
          <p style="margin: 4px 0; font-size: 11px; color: #333;"><b>ID:</b> ...${order.id.slice(-6)}</p>
          <div class="divider"></div>
          <table>
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding-bottom: 4px; font-size: 13px;">Nomi</th>
                <th style="text-align: right; padding-bottom: 4px; font-size: 13px;">Suma</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="divider"></div>
          ${hasDiscount ? `
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
              <span>Asliy Summa:</span>
              <span>${Number(originalPrice).toLocaleString()} so'm</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: red; margin-bottom: 4px;">
              <span>Chegirma (${order.discountPercent}%):</span>
              <span>-${Number(order.discountAmount).toLocaleString()} so'm</span>
            </div>
          ` : ""}
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 4px;">
            <span>JAMI:</span>
            <span>${Number(finalPrice).toLocaleString()} so'm</span>
          </div>
          <div class="divider"></div>
          <p class="text-center" style="margin-top: 15px; font-size: 12px;">Tashrifingiz uchun rahmat!<br>Yana kuting!</p>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getFilteredOrders = () => {
    let result = orders;
    if (filter === "unpaid") {
      result = orders.filter((o) => o.paymentStatus !== "paid");
    } else if (filter === "paid") {
      result = orders.filter((o) => o.paymentStatus === "paid");
    }

    // 🔍 To'g'ri qidiruv filtrlash mantiqi shu yerga ulandi
    if (searchTerm.trim() !== "") {
      result = result.filter((order) => {
        const tableNumber = order.tableNumber ? order.tableNumber.toString() : "";
        return tableNumber.includes(searchTerm);
      });
    }

    return result;
  };
  
  const filteredOrders = getFilteredOrders();

  const getDailyStats = () => {
    const now = new Date();
    const todayOrders = orders.filter((o) => {
      if (o.paymentStatus !== "paid") return false;
      const d = o.paidAt?.toDate ? o.paidAt.toDate() : new Date(o.paidAt || 0);
      return d.toDateString() === now.toDateString();
    });
    const cash = todayOrders
      .filter((o) => o.paymentMethod === "cash")
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const card = todayOrders
      .filter((o) => o.paymentMethod === "card")
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    return {
      total: cash + card,
      cash,
      card,
      count: todayOrders.length,
    };
  };

  const stats = getDailyStats();

  const formatDate = (date) => {
    const d = date?.toDate ? date.toDate() : new Date(date || 0);
    return d.toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex bg-[#FBFBFA] min-h-screen">
        <Sidebar />
        <div className="flex flex-col items-center justify-center h-64 w-full gap-2">
          <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm font-medium">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  const preview = selectedOrder
    ? getDiscountedTotal(selectedOrder, discountPercent)
    : null;

  return (
    <div className="flex bg-[#FAFAF9] min-h-screen">
      <Sidebar />
      <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full transition-all duration-300">
        
        {/* Sarlavha qismi */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Kassa tizimi</h1>
            <p className="text-sm text-gray-500 mt-1">Buyurtmalar monitoringi va moliyaviy hisobotlar</p>
          </div>
        </div>

        {/* Kunlik statistika paneli */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 transition hover:shadow-md">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bugungi jami tushum</p>
            <p className="text-2xl font-black text-green-600 mt-2">{stats.total.toLocaleString()} <span className="text-xs font-normal">so'm</span></p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 transition hover:shadow-md">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Naqd to'lovlar</p>
            <p className="text-2xl font-black text-amber-800 mt-2">{stats.cash.toLocaleString()} <span className="text-xs font-normal">so'm</span></p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 transition hover:shadow-md">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Karta orqali</p>
            <p className="text-2xl font-black text-blue-600 mt-2">{stats.card.toLocaleString()} <span className="text-xs font-normal">so'm</span></p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 transition hover:shadow-md">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Yopilgan cheklar</p>
            <p className="text-2xl font-black text-gray-800 mt-2">{stats.count} <span className="text-xs font-normal">ta</span></p>
          </div>
        </div>

        {/* Filter va Qidiruv qatori */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex p-1 bg-gray-200/60 rounded-xl w-full sm:max-w-sm">
            {[
              { key: "unpaid", label: "To'lanmagan" },
              { key: "paid", label: "To'langan" },
              { key: "all", label: "Barchasi" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold tracking-wide transition-all ${
                  filter === f.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 🔍 Qidiruv input dizayni chiroyli holatga keltirildi */}
          <input 
            type="text" 
            placeholder="Stol raqamini kiriting..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:max-w-xs px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none shadow-xs font-medium" 
          />
        </div>

        {/* Cheklar ro'yxati */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
            <p className="text-sm font-medium">Hozircha mos keluvchi cheklar mavjud emas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-black text-gray-900 text-lg">Stol №{order.tableNumber || "-"}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
                    </div>
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                        order.paymentStatus === "paid"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-orange-50 text-orange-700 border border-orange-200 animate-pulse"
                      }`}
                    >
                      {order.paymentStatus === "paid" ? "To'langan" : "Kutilmoqda"}
                    </span>
                  </div>

                  {/* Buyurtma tarkibi */}
                  <div className="space-y-2 bg-gray-50/50 rounded-xl p-3 border border-gray-100/60">
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-gray-600">
                        <span className="font-medium text-gray-800">{item.name} <span className="text-gray-400 font-bold">x{item.quantity}</span></span>
                        <span className="font-semibold text-gray-700">{(item.price * item.quantity).toLocaleString()} so'm</span>
                      </div>
                    ))}
                  </div>

                  {/* Chegirma tarixi */}
                  {order.paymentStatus === "paid" && order.discountPercent > 0 && (
                    <div className="mt-3 flex justify-between text-xs text-red-500 font-medium px-1">
                      <span>Chegirma ({order.discountPercent}%)</span>
                      <span>-{Number(order.discountAmount || 0).toLocaleString()} so'm</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Jami summa:</span>
                    <span className="font-black text-xl text-gray-900">
                      {Number(order.totalPrice || 0).toLocaleString()} <span className="text-xs font-bold">so'm</span>
                    </span>
                  </div>

                  {/* Pastki harakat qismi */}
                  <div className="mt-4 flex gap-2">
                    {order.paymentStatus === "paid" ? (
                      <>
                        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500 flex items-center">
                          ℹ️ Usul: <strong className="ml-1 text-gray-700">{order.paymentMethod === "cash" ? "Naqd" : "Karta"}</strong>
                        </div>
                        <button
                          onClick={() => handlePrintReceipt(order)}
                          className="bg-gray-100 text-gray-700 p-2.5 rounded-xl text-sm font-bold hover:bg-gray-200 transition flex items-center justify-center gap-1 shadow-sm"
                          title="Chekni qayta chop etish"
                        >
                          🖨️ Chek
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handlePrintReceipt(order)}
                          className="bg-gray-100 text-gray-700 px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200 transition flex items-center justify-center gap-1 shadow-sm"
                          title="Oldindan hisob varag'ini chiqarish"
                        >
                          🖨️ Hisob
                        </button>
                        <button
                          onClick={() => openPaymentModal(order)}
                          className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-amber-700 active:scale-[0.99] transition shadow-sm"
                        >
                          To'lovni qabul qilish
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* To'lov usuli tanlash modali */}
        {selectedOrder && preview && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-xl font-black text-gray-900">To'lov oynasi</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Stol №{selectedOrder.tableNumber}</p>
                </div>
              </div>

              {/* Chegirma kiritish maydoni */}
              <div className="mb-4 mt-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Chegirma qo'shish (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold bg-gray-50/50"
                />
              </div>

              {/* Summalar ko'rsatilishi */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 mb-5 space-y-2">
                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>Asl summa:</span>
                  <span className="font-semibold text-gray-700">{preview.original.toLocaleString()} so'm</span>
                </div>
                {preview.safePercent > 0 && (
                  <div className="flex justify-between text-xs text-red-500 font-semibold">
                    <span>Chegirma ({preview.safePercent}%):</span>
                    <span>-{preview.discountAmount.toLocaleString()} so'm</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-amber-800 pt-2 border-t border-gray-200/70">
                  <span>Yakuniy to'lov:</span>
                  <span>{preview.finalTotal.toLocaleString()} so'm</span>
                </div>
              </div>

              {/* Kassir tugmalari */}
              <div className="flex gap-2">
                <button
                  onClick={() => markAsPaid(selectedOrder, "cash")}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl text-xs font-bold hover:bg-green-700 transition shadow-sm uppercase tracking-wider"
                >
                  💵 Naqd
                </button>
                <button
                  onClick={() => markAsPaid(selectedOrder, "card")}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-sm uppercase tracking-wider"
                >
                  💳 Karta
                </button>
              </div>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setDiscountPercent(0);
                }}
                className="w-full mt-2 border border-gray-200 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:bg-gray-50 transition"
              >
                Oynani yopish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}