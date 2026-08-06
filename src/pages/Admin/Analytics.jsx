import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";

export default function Analytics() {
  const { cafeId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("daily"); // daily, weekly, monthly

  useEffect(() => {
    if (!cafeId) return;

    const q = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [cafeId]);

  const getFilteredOrders = () => {
    const now = new Date();
    return orders.filter((order) => {
      if (!order.createdAt) return false;
      const orderDate = order.createdAt.toDate
        ? order.createdAt.toDate()
        : new Date(order.createdAt);

      if (period === "daily") {
        return orderDate.toDateString() === now.toDateString();
      }
      if (period === "weekly") {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return orderDate >= weekAgo;
      }
      if (period === "monthly") {
        return (
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  };

  const filteredOrders = getFilteredOrders();

  const totalRevenue = filteredOrders.reduce(
    (sum, order) => sum + (order.totalPrice || 0),
    0
  );

  const totalOrders = filteredOrders.length;

  const getTopDishes = () => {
    const dishCount = {};

    filteredOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!dishCount[item.name]) {
          dishCount[item.name] = 0;
        }
        dishCount[item.name] += item.quantity || 1;
      });
    });

    const total = Object.values(dishCount).reduce((a, b) => a + b, 0);

    const sorted = Object.entries(dishCount)
      .map(([name, count]) => ({
        name,
        count,
        percent: total > 0 ? ((count / total) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return sorted;
  };

  const topDishes = getTopDishes();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-lg">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-amber-800 mb-4">Analitika</h1>

      {/* Davr tanlash */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "daily", label: "Kunlik" },
          { key: "weekly", label: "Haftalik" },
          { key: "monthly", label: "Oylik" },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              period === p.key
                ? "bg-amber-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Umumiy statistika kartalari */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Jami daromad</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {totalRevenue.toLocaleString()} so'm
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Buyurtmalar soni</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">
            {totalOrders}
          </p>
        </div>
      </div>

      {/* Eng ko'p sotilgan taomlar */}
      <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">
          Eng ko'p buyurtma qilingan taomlar
        </h2>

        {topDishes.length === 0 ? (
          <p className="text-gray-400 text-sm">Ma'lumot topilmadi</p>
        ) : (
          <div className="space-y-3">
            {topDishes.map((dish, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">
                    {dish.name}
                  </span>
                  <span className="text-gray-500">
                    {dish.count} ta ({dish.percent}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${dish.percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}