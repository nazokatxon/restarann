import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

export default function Buyurtma() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Naqd");
  const [submitting, setSubmitting] = useState(false);

  // Kafe ichidagi stollar ro'yxati (10 ta stol)
  const totalTables = Array.from({ length: 10 }, (_, i) => i + 1);

  const formatPrice = (price) =>
    new Intl.NumberFormat("uz-UZ").format(price || 0) + " so'm";

  // =========================
  // FIRESTORE'DAN OCHIQ BUYURTMALARNI OLISH
  // =========================
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Status "closed" bo'lmagan barcha aktiv buyurtmalarni olish
    const ordersRef = collection(db, "orders");
    const q = user?.cafeId
      ? query(
          ordersRef,
          where("cafeId", "==", user.cafeId),
          where("status", "!=", "closed")
        )
      : query(ordersRef, where("status", "!=", "closed"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const activeOrders = [];
        snapshot.forEach((doc) => {
          activeOrders.push({ id: doc.id, ...doc.data() });
        });
        setOrders(activeOrders);
        setLoading(false);
      },
      (error) => {
        console.error("Buyurtmalarni yuklashda xatolik:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Tanlangan stolga tegishli buyurtmani topish
  const getTableOrder = (tableNum) => {
    return orders.find(
      (o) => Number(o.tableNumber || o.table) === tableNum
    );
  };

  // To'lovni amalga oshirib, stolni yopish (HISOBOTGA TO'G'RI TUSHISHI UCHUN)
  const handleCloseTable = async () => {
    if (!selectedOrder) return;

    try {
      setSubmitting(true);
      const orderRef = doc(db, "orders", selectedOrder.id);

      // Jami summani aniqlash
      const totalAmount = Number(
        selectedOrder.total ||
          selectedOrder.totalAmount ||
          selectedOrder.totalPrice ||
          0
      );

      await updateDoc(orderRef, {
        status: "closed",
        paymentStatus: "paid",
        paymentMethod: paymentMethod, // 'Naqd', 'Karta' yoki 'Click'
        totalAmount: totalAmount,
        total: totalAmount,
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setShowPayment(false);
      setSelectedOrder(null);
      alert("To'lov qabul qilindi. Stol yopildi va hisobotga o'tdi!");
    } catch (error) {
      console.error("Stolni yopishda xatolik:", error);
      alert("Xatolik yuz berdi!");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-68px)] bg-slate-100 p-6">
      {/* BOSH QISM */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Stollar (Kassa)
          </h1>
          <p className="text-sm text-slate-500">
            To'lovni amalga oshirish va stolni yopish uchun aktiv stol ustiga
            bosing
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center font-semibold text-slate-400">
          Stollar yuklanmoqda...
        </div>
      ) : (
        /* STOLLAR SETKASI (GRID) */
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {totalTables.map((tableNum) => {
            const order = getTableOrder(tableNum);
            const isOccupied = !!order;

            // Barcha taomlar yetkazilgan bo'lsa (TO'G'RILANDI)
            const items = order?.items || order?.kitchenItems || [];
            const allDelivered =
              order?.kitchenStatus === "ready" ||
              order?.kitchenStatus === "delivered" ||
              order?.status === "delivered" ||
              (items.length > 0 &&
                items.every(
                  (i) =>
                    i.delivered ||
                    i.isDelivered ||
                    i.waiterTaken ||
                    i.isReady ||
                    i.readyForWaiter ||
                    i.status === "ready" ||
                    i.status === "delivered"
                ));

            return (
              <button
                key={tableNum}
                onClick={() => isOccupied && setSelectedOrder(order)}
                disabled={!isOccupied}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 p-6 transition ${
                  !isOccupied
                    ? "border-slate-200 bg-white text-slate-400 cursor-not-allowed opacity-80"
                    : allDelivered
                    ? "border-emerald-500 bg-emerald-50 text-emerald-600 shadow-md hover:shadow-lg cursor-pointer"
                    : "border-amber-400 bg-amber-50 text-amber-600 shadow-md hover:shadow-lg cursor-pointer"
                }`}
              >
                <div className="mb-2 text-3xl">🪑</div>
                <div className="text-xl font-black text-slate-800">
                  № {tableNum}
                </div>
                <div className="mt-1 text-xs font-bold">
                  {!isOccupied
                    ? "Bo'sh"
                    : allDelivered
                    ? "Yetkazildi (Hisob kutilmoqda)"
                    : "Tayyorlanmoqda"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 1-MODAL: BUYURTMA TAFSILOTLARI */}
      {selectedOrder && !showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Stol № {selectedOrder.tableNumber || selectedOrder.table}
                </h2>
                <p className="text-xs text-slate-400">Buyurtma tafsilotlari</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* OVQATLAR RO'YXATI */}
            <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
              {(
                selectedOrder.items ||
                selectedOrder.kitchenItems ||
                []
              ).map((item, idx) => {
                const itemDelivered =
                  item.delivered ||
                  item.isDelivered ||
                  item.waiterTaken ||
                  item.isReady ||
                  item.readyForWaiter ||
                  item.status === "ready" ||
                  item.status === "delivered";

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
                  >
                    <div>
                      <div className="font-bold text-slate-800">
                        {item.name || item.title}{" "}
                        <span className="text-slate-400">
                          × {item.quantity || item.count || 1}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500">
                        {formatPrice(item.price)}
                      </div>
                    </div>
                    <span
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                        itemDelivered
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {itemDelivered ? "✓ Yetkazilgan" : "⏳ Tayyorlanmoqda"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* JAMI SUMMA VA TO'LOVGA O'TISH TUGMASI */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="mb-5 flex items-center justify-between">
                <span className="font-bold text-slate-500">Jami:</span>
                <span className="text-2xl font-black text-slate-900">
                  {formatPrice(
                    selectedOrder.total ||
                      selectedOrder.totalAmount ||
                      selectedOrder.totalPrice
                  )}
                </span>
              </div>

              <button
                onClick={() => setShowPayment(true)}
                className="w-full rounded-2xl bg-emerald-600 py-4 font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 active:scale-[0.98] cursor-pointer"
              >
                💳 To'lovni amalga oshirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2-MODAL: TO'LOV QILISH */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">
                To'lov usulini tanlang
              </h3>
              <button
                onClick={() => setShowPayment(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {["Naqd", "Karta", "Click"].map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-2xl border-2 p-4 text-center font-bold transition cursor-pointer ${
                    paymentMethod === method
                      ? "border-blue-600 bg-blue-50 text-blue-600"
                      : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-slate-100 p-4">
              <span className="text-sm font-semibold text-slate-500">
                To'lanadigan summa:
              </span>
              <span className="text-xl font-black text-slate-900">
                {formatPrice(
                  selectedOrder?.total ||
                    selectedOrder?.totalAmount ||
                    selectedOrder?.totalPrice
                )}
              </span>
            </div>

            <button
              onClick={handleCloseTable}
              disabled={submitting}
              className="mt-5 w-full rounded-2xl bg-emerald-600 py-4 font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:bg-slate-300 cursor-pointer"
            >
              {submitting
                ? "Saqlanmoqda..."
                : "✓ To'lovni tasdiqlash va yopish"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}