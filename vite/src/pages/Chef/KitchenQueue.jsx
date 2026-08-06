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
import { useAuth } from "../../context/AuthContext.jsx";

export default function KitchenQueue() {
  const { cafeId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cafeId) return;

    const q = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId),
      where("kitchenStatus", "in", ["pending", "preparing"])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Birinchi kelgan buyurtma tepada turadi (FIFO)
      data.sort((a, b) => {
        const ad = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.createdAt || 0);

        const bd = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.createdAt || 0);

        return ad - bd;
      });

      setOrders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [cafeId]);

  const startPreparing = async (order) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        kitchenStatus: "preparing",
        preparingAt: new Date(),
      });
    } catch (error) {
      console.error("Statusni yangilashda xatolik:", error);
    }
  };

  const markReady = async (order) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        kitchenStatus: "ready",
        readyAt: new Date(),
        // Ofitsiantga bildirishnoma uchun maydon
        waiterNotified: false,
      });
    } catch (error) {
      console.error("Tayyor deb belgilashda xatolik:", error);
    }
  };

  const getElapsedMinutes = (createdAt) => {
    const created = createdAt?.toDate
      ? createdAt.toDate()
      : new Date(createdAt || 0);

    const diffMs = new Date() - created;
    return Math.floor(diffMs / 60000);
  };

  const formatTime = (date) => {
    const d = date?.toDate
      ? date.toDate()
      : new Date(date || 0);

    return d.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-lg">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-amber-800">
          Oshxona navbati
        </h1>

        <span className="text-sm text-gray-500">
          {orders.length} ta buyurtma
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <p className="text-lg">Hozircha buyurtmalar yo'q</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, index) => {
            const elapsed = getElapsedMinutes(order.createdAt);
            const isUrgent = elapsed >= 15;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl shadow border-2 p-4 transition-all ${
                  index === 0
                    ? "border-amber-500"
                    : "border-gray-100"
                } ${isUrgent ? "ring-2 ring-red-300" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                        Navbatda 1-chi
                      </span>
                    )}

                    <h3 className="font-semibold text-gray-800">
                      Stol №{order.tableNumber || "-"}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        order.kitchenStatus === "preparing"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {order.kitchenStatus === "preparing"
                        ? "Tayyorlanmoqda"
                        : "Kutilmoqda"}
                    </span>

                    <p
                      className={`text-xs mt-1 font-medium ${
                        isUrgent ? "text-red-600" : "text-gray-400"
                      }`}
                    >
                      {formatTime(order.createdAt)} • {elapsed} daq. o'tdi
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {(order.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <span className="text-gray-700 font-medium">
                        {item.name}
                      </span>

                      <span className="text-gray-500">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {order.note && (
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Izoh: {order.note}
                  </p>
                )}

                <div className="mt-3">
                  {order.kitchenStatus === "pending" ? (
                    <button
                      onClick={() => startPreparing(order)}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Tayyorlashni boshlash
                    </button>
                  ) : (
                    <button
                      onClick={() => markReady(order)}
                      className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
                    >
                      Tayyor ✓
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}