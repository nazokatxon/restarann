import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../Firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function TableGrid() {
  const { cafeId } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  useEffect(() => {
    if (!cafeId) return;

    const qTables = query(
      collection(db, "tables"),
      where("cafeId", "==", cafeId)
    );

    const unsubTables = onSnapshot(qTables, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      data.sort(
        (a, b) => (a.number || 0) - (b.number || 0)
      );

      setTables(data);
      setLoading(false);
    });

    const qOrders = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId),
      where("paymentStatus", "==", "unpaid")
    );

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setOrders(data);
    });

    return () => {
      unsubTables();
      unsubOrders();
    };
  }, [cafeId]);

  const getTableStatus = (tableNumber) => {
    const activeOrder = orders.find(
      (o) =>
        String(o.tableNumber) === String(tableNumber)
    );

    if (!activeOrder) return "empty";
    if (activeOrder.kitchenStatus === "ready") return "ready";

    return "occupied";
  };

  const getActiveOrder = (tableNumber) => {
    return orders.find(
      (o) =>
        String(o.tableNumber) === String(tableNumber)
    );
  };

  const handleAddTable = async (e) => {
    e.preventDefault();

    if (!newTableNumber) {
      alert("Iltimos, stol raqamini kiriting");
      return;
    }

    try {
      await addDoc(collection(db, "tables"), {
        cafeId,
        number: Number(newTableNumber),
        createdAt: new Date(),
      });

      setNewTableNumber("");
      setModalOpen(false);
    } catch (error) {
      console.error(
        "Stol qo'shishda xatolik:",
        error
      );

      alert(
        "Xatolik yuz berdi, qaytadan urinib ko'ring"
      );
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (
      !window.confirm(
        "Bu stolni o'chirishga ishonchingiz komilmi?"
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "tables", tableId));
    } catch (error) {
      console.error(
        "Stolni o'chirishda xatolik:",
        error
      );
    }
  };

  const markOrderDelivered = async (order) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        kitchenStatus: "delivered",
      });

      setSelectedTable(null);
    } catch (error) {
      console.error(
        "Statusni yangilashda xatolik:",
        error
      );
    }
  };

  const statusStyles = {
    empty: "bg-white border-gray-200 text-gray-700",
    occupied:
      "bg-amber-50 border-amber-400 text-amber-800",
    ready:
      "bg-green-50 border-green-500 text-green-800",
  };

  const statusLabels = {
    empty: "Bo'sh",
    occupied: "Band",
    ready: "Tayyor!",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-lg">
          Yuklanmoqda...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-amber-800">
          Stollar
        </h1>

        <button
          onClick={() => navigate("/waiter/order")}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition"
        >
          + Yangi buyurtma
        </button>
      </div>

      {/* Holat izohi */}
      <div className="flex gap-4 mb-4 text-xs text-gray-500 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-white border border-gray-300 inline-block"></span>
          Bo'sh
        </div>

        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
          Band
        </div>

        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
          Taom tayyor
        </div>
      </div>

      {tables.length === 0 ? (
        <p className="text-gray-400 text-sm">
          Hozircha stollar qo'shilmagan
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tables.map((table) => {
            const status = getTableStatus(table.number);

            return (
              <button
                key={table.id}
                onClick={() => {
                  if (status !== "empty") {
                    setSelectedTable(table);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleDeleteTable(table.id);
                }}
                className={`relative rounded-xl border-2 p-4 flex flex-col items-center justify-center h-24 transition ${
                  statusStyles[status]
                } ${
                  status === "ready"
                    ? "animate-pulse"
                    : ""
                }`}
              >
                <span className="text-lg font-bold">
                  №{table.number}
                </span>

                <span className="text-xs mt-1 font-medium">
                  {statusLabels[status]}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setModalOpen(true)}
            className="rounded-xl border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center h-24 text-gray-400 hover:bg-gray-50 transition"
          >
            <span className="text-2xl">+</span>

            <span className="text-xs mt-1">
              Stol qo'shish
            </span>
          </button>
        </div>
      )}

      {/* Yangi stol qo'shish modali */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-4 text-gray-800">
              Yangi stol qo'shish
            </h2>

            <form
              onSubmit={handleAddTable}
              className="space-y-3"
            >
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Stol raqami
                </label>

                <input
                  type="number"
                  value={newTableNumber}
                  onChange={(e) =>
                    setNewTableNumber(e.target.value)
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Masalan: 12"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition"
                >
                  Qo'shish
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setNewTableNumber("");
                  }}
                  className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stol buyurtmasi tafsilotlari modali */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-3 text-gray-800">
              Stol №{selectedTable.number}
            </h2>

            {(() => {
              const order = getActiveOrder(
                selectedTable.number
              );

              if (!order) {
                return (
                  <p className="text-gray-400 text-sm">
                    Buyurtma topilmadi
                  </p>
                );
              }

              return (
                <>
                  <div className="space-y-1 mb-3">
                    {(order.items || []).map(
                      (item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between text-sm text-gray-600"
                        >
                          <span>
                            {item.name} x
                            {item.quantity}
                          </span>

                          <span>
                            {(
                              item.price *
                              item.quantity
                            ).toLocaleString()}{" "}
                            so'm
                          </span>
                        </div>
                      )
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100 mb-3">
                    <span className="font-semibold text-gray-800">
                      Jami:
                    </span>

                    <span className="font-bold text-amber-700">
                      {Number(
                        order.totalPrice || 0
                      ).toLocaleString()}{" "}
                      so'm
                    </span>
                  </div>

                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full mb-3 ${
                      order.kitchenStatus === "ready"
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {order.kitchenStatus === "ready"
                      ? "Taom tayyor"
                      : "Tayyorlanmoqda"}
                  </span>

                  {order.kitchenStatus ===
                    "ready" && (
                    <button
                      onClick={() =>
                        markOrderDelivered(order)
                      }
                      className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition mb-2"
                    >
                      Mijozga yetkazildi
                    </button>
                  )}
                </>
              );
            })()}

            <button
              onClick={() => setSelectedTable(null)}
              className="w-full border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
            >
              Yopish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}