import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../Firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function Billing() {
  const { cafeId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
        const ad = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.createdAt || 0);

        const bd = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.createdAt || 0);

        return bd - ad;
      });

      setOrders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [cafeId]);

  const markAsPaid = async (order, method) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        paymentStatus: "paid",
        paymentMethod: method,
        paidAt: new Date(),
      });

      setSelectedOrder(null);
    } catch (error) {
      console.error("To'lovni belgilashda xatolik:", error);
      alert("Xatolik yuz berdi, qaytadan urinib ko'ring");
    }
  };

  const unpaidOrders = orders.filter(
    (order) => order.paymentStatus !== "paid"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-lg">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-amber-800 mb-4">
        Kassa
      </h1>

      <div className="space-y-3">
        {unpaidOrders.length === 0 ? (
          <p className="text-gray-400 text-sm">
            To'lanmagan buyurtmalar yo'q.
          </p>
        ) : (
          unpaidOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow border border-gray-100 p-4"
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    Stol №{order.tableNumber || "-"}
                  </h3>

                  <p className="text-xs text-gray-500">
                    {order.createdAt?.toDate
                      ? order.createdAt.toDate().toLocaleString()
                      : "Vaqt belgilanmagan"}
                  </p>
                </div>

                <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-orange-100 text-orange-700">
                  Kutilmoqda
                </span>
              </div>

              <div className="mt-2 space-y-1">
                {(order.items || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-sm text-gray-600"
                  >
                    <span>
                      {item.name} x{item.quantity}
                    </span>

                    <span>
                      {(item.price * item.quantity).toLocaleString()} so'm
                    </span>
                  </div>
                ))}

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                  <span className="font-semibold text-gray-800">
                    Jami:
                  </span>

                  <span className="font-bold text-amber-700">
                    {Number(order.totalPrice || 0).toLocaleString()} so'm
                  </span>
                </div>

                <button
                  onClick={() => setSelectedOrder(order)}
                  className="w-full mt-3 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition"
                >
                  To'lovni qabul qilish
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-1 text-gray-800">
              To'lov usulini tanlang
            </h2>

            <p className="text-sm text-gray-500 mb-4">
              Stol №{selectedOrder.tableNumber} —{" "}
              {Number(selectedOrder.totalPrice || 0).toLocaleString()} so'm
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => markAsPaid(selectedOrder, "cash")}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
              >
                Naqd
              </button>

              <button
                onClick={() => markAsPaid(selectedOrder, "card")}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                Karta
              </button>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full mt-3 text-gray-600 text-sm hover:text-gray-800"
            >
              Bekor qilish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}