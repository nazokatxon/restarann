import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { db } from "../../firebase/config.js";

export default function TableGrid() {
  const navigate = useNavigate();
  const auth = getAuth();

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTable, setSelectedTable] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // =====================================================
  // FIRESTORE
  // =====================================================

  useEffect(() => {
    let tablesLoaded = false;
    let ordersLoaded = false;

    const checkLoading = () => {
      if (tablesLoaded && ordersLoaded) {
        setLoading(false);
      }
    };

    const tablesQuery = query(collection(db, "tables"));
    const ordersQuery = query(collection(db, "orders"));

    const unsubscribeTables = onSnapshot(
      tablesQuery,
      (snapshot) => {
        const tableList = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        tableList.sort(
          (a, b) => Number(a.number || 0) - Number(b.number || 0)
        );

        setTables(tableList);
        tablesLoaded = true;
        checkLoading();
      },
      (error) => {
        console.error("Tables error:", error);
        toast.error("Stollarni yuklashda xatolik!");
        setLoading(false);
      }
    );

    const unsubscribeOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const orderList = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setOrders(orderList);
        ordersLoaded = true;
        checkLoading();
      },
      (error) => {
        console.error("Orders error:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTables();
      unsubscribeOrders();
    };
  }, []);

  // =====================================================
  // HELPER FUNKSIYALAR
  // =====================================================

  const getOrderItems = useCallback((order) => {
    if (!order) return [];
    if (Array.isArray(order.kitchenItems)) return order.kitchenItems;
    if (Array.isArray(order.items)) return order.items;
    if (Array.isArray(order.products)) return order.products;
    return [];
  }, []);

  const getActiveOrder = useCallback((tableNumber) => {
    return orders.find((order) => {
      const orderTable =
        order.tableNumber ??
        order.table ??
        order.tableNo ??
        order.tableId;

      const sameTable = String(orderTable) === String(tableNumber);
      const closed =
        order.status === "closed" ||
        order.status === "completed" ||
        order.kitchenStatus === "closed";

      return sameTable && !closed;
    });
  }, [orders]);

  const getTableStatus = useCallback((tableNumber) => {
    const activeOrder = getActiveOrder(tableNumber);

    if (!activeOrder) return "empty";

    const items = getOrderItems(activeOrder);
    if (!items.length) return "occupied";

    const allDelivered = items.every(
      (item) => item.waiterTaken === true || item.isDelivered === true
    );
    if (allDelivered) return "delivered";

    const hasReadyFood = items.some(
      (item) =>
        (item.readyForWaiter === true || item.isReady === true) &&
        item.waiterTaken !== true &&
        item.isDelivered !== true
    );

    if (hasReadyFood) return "ready";

    return "occupied";
  }, [getActiveOrder, getOrderItems]);

  const formatTime = (value) => {
    if (!value) return "";
    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "";

      return date.toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // =====================================================
  // ACTIONS
  // =====================================================

  const handleTableClick = (table) => {
    const order = getActiveOrder(table.number);
    if (!order) {
      navigate(`/waiter/order?table=${table.number}`);
      return;
    }
    setSelectedTable(table);
  };

  const markFoodDelivered = async (order, index) => {
    try {
      let fieldName = "";
      let items = [];

      if (Array.isArray(order.kitchenItems)) {
        fieldName = "kitchenItems";
        items = [...order.kitchenItems];
      } else if (Array.isArray(order.items)) {
        fieldName = "items";
        items = [...order.items];
      } else if (Array.isArray(order.products)) {
        fieldName = "products";
        items = [...order.products];
      } else {
        toast.error("Buyurtma mahsulotlari topilmadi!");
        return;
      }

      const item = items[index];
      if (!item) {
        toast.error("Taom topilmadi!");
        return;
      }

      const ready = item.readyForWaiter === true || item.isReady === true;
      if (!ready) {
        toast.warning("Bu taom hali tayyor emas!");
        return;
      }

      items[index] = {
        ...item,
        waiterTaken: true,
        isDelivered: true,
        deliveryStatus: "delivered",
        deliveredAt: new Date().toISOString(),
      };

      const allDelivered = items.every(
        (currentItem) =>
          currentItem.waiterTaken === true || currentItem.isDelivered === true
      );

      await updateDoc(doc(db, "orders", order.id), {
        [fieldName]: items,
        kitchenStatus: allDelivered ? "completed" : "ready",
        updatedAt: serverTimestamp(),
      });

      toast.success(
        `${item.name || item.title || item.productName || "Taom"} yetkazildi!`
      );
    } catch (error) {
      console.error("Delivery error:", error);
      toast.error("Taomni yetkazishda xatolik!");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info("Tizimdan chiqdingiz");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Chiqishda xatolik yuz berdi!");
    }
  };

  const selectedOrder = useMemo(() => {
    if (!selectedTable) return null;
    return getActiveOrder(selectedTable.number);
  }, [selectedTable, getActiveOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#d97706] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-gray-500">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-[#273444]">
      {/* HEADER */}
      <header className="sticky top-0 z-30 h-[70px] bg-white border-b border-gray-200 shadow-sm">
        <div className="h-full px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#d97706] to-[#f59e0b] shadow-md flex items-center justify-center text-xl">
              🏢
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-[#26354a]">AI Cafe</h1>
              <p className="text-[11px] text-gray-400">Ofitsiant paneli</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/waiter/order")}
              className="hidden sm:flex items-center gap-2 bg-[#d97706] hover:bg-[#c76600] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition cursor-pointer"
            >
              <span className="text-lg">+</span> Buyurtma
            </button>
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
            >
              ↪ Chiqish
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto px-5 py-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-7">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#fff3dd] flex items-center justify-center">
                🍲
              </div>
              <div>
                <h2 className="font-extrabold text-[#68432c] text-lg">
                  KARAVAN KAFE
                </h2>
                <p className="text-xs text-gray-400">Ofitsiant</p>
              </div>
            </div>
            <h3 className="text-2xl font-black mt-6 text-[#2f2a26]">Stollar</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/waiter/order")}
              className="bg-[#d97706] hover:bg-[#c76600] text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
            >
              + Buyurtma
            </button>
          </div>
        </div>

        {/* TABLES GRID */}
        {tables.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 min-h-[300px] flex flex-col items-center justify-center">
            <div className="text-5xl mb-4">🪑</div>
            <h3 className="font-bold text-gray-700 text-lg">
              Hozircha stollar mavjud emas
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {tables.map((table) => {
              const status = getTableStatus(table.number);
              const activeOrder = getActiveOrder(table.number);

              const tableClass =
                status === "empty"
                  ? "bg-[#f8f9fb] border-[#d7dde5] hover:border-[#b7c1cd]"
                  : status === "occupied"
                  ? "bg-[#fffdf8] border-[#eab126] shadow-[0_5px_20px_rgba(180,120,0,0.08)]"
                  : status === "ready"
                  ? "bg-blue-50 border-blue-500 shadow-[0_5px_20px_rgba(37,99,235,0.15)]"
                  : "bg-green-50 border-green-400";

              const statusText =
                status === "empty"
                  ? "Bo'sh"
                  : status === "occupied"
                  ? "Tayyorlanmoqda"
                  : status === "ready"
                  ? "Tayyor!"
                  : "Yetkazildi";

              const statusColor =
                status === "empty"
                  ? "text-[#2f3742]"
                  : status === "occupied"
                  ? "text-[#704124]"
                  : status === "ready"
                  ? "text-blue-700"
                  : "text-green-700";

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => handleTableClick(table)}
                  className={`
                    min-h-[132px] rounded-2xl border-2 p-4 flex flex-col items-center justify-center
                    transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] cursor-pointer
                    ${tableClass}
                  `}
                >
                  <div className="text-2xl mb-2">🪑</div>
                  <div className="text-xl font-black text-[#26354a]">
                    № {table.number}
                  </div>
                  <div className={`mt-1 text-xs font-bold ${statusColor}`}>
                    {statusText}
                  </div>
                  {activeOrder && activeOrder.createdAt && (
                    <div className="mt-2 text-[10px] font-medium text-gray-500">
                      ◷ {formatTime(activeOrder.createdAt)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* TABLE DETAIL MODAL */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[90vh] bg-white rounded-2xl shadow-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-black text-[#273444]">
                  Stol № {selectedTable.number}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Buyurtma tafsilotlari
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {!selectedOrder ? (
              <div className="text-center py-10 text-gray-400">
                Buyurtma topilmadi
              </div>
            ) : (
              (() => {
                const items = getOrderItems(selectedOrder);
                const total = items.reduce((sum, item) => {
                  const price = Number(item.price || 0);
                  const quantity = Number(item.quantity || item.count || 1);
                  return sum + price * quantity;
                }, 0);

                const allDelivered =
                  items.length > 0 &&
                  items.every(
                    (item) =>
                      item.waiterTaken === true || item.isDelivered === true
                  );

                return (
                  <>
                    <div
                      className={`rounded-xl border px-4 py-3 mb-4 ${
                        allDelivered
                          ? "bg-green-50 border-green-200"
                          : "bg-[#fff8e8] border-[#f3d88e]"
                      }`}
                    >
                      <p
                        className={`font-bold text-sm ${
                          allDelivered ? "text-green-700" : "text-[#9a6510]"
                        }`}
                      >
                        {allDelivered
                          ? "✓ Barcha taomlar yetkazildi"
                          : "👨‍🍳 Oshxona buyurtmani tayyorlamoqda"}
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 border-y border-gray-100 py-4">
                      {items.map((item, index) => {
                        const ready =
                          item.readyForWaiter === true || item.isReady === true;
                        const delivered =
                          item.waiterTaken === true || item.isDelivered === true;
                        const quantity = item.quantity || item.count || 1;
                        const price = Number(item.price || 0);

                        return (
                          <div
                            key={`${item.id || item.name || "item"}-${index}`}
                            className={`rounded-xl border p-4 ${
                              delivered
                                ? "bg-green-50 border-green-200"
                                : ready
                                ? "bg-blue-50 border-blue-200"
                                : "bg-[#fafafa] border-gray-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="font-black text-sm">
                                  {item.name ||
                                    item.title ||
                                    item.productName ||
                                    "Taom"}
                                  <span className="text-gray-400 ml-1">
                                    × {quantity}
                                  </span>
                                </h4>
                                <p className="font-bold text-sm text-[#6b4027] mt-1">
                                  {(price * quantity).toLocaleString()} so'm
                                </p>
                              </div>

                              {!ready && !delivered && (
                                <span className="text-[11px] font-bold px-3 py-2 bg-gray-200 text-gray-600 rounded-lg">
                                  ⏳ Tayyorlanmoqda
                                </span>
                              )}

                              {ready && !delivered && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    markFoodDelivered(selectedOrder, index)
                                  }
                                  className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  🚚 Yetkazildi
                                </button>
                              )}

                              {delivered && (
                                <span className="text-[11px] font-bold px-3 py-2 bg-green-200 text-green-800 rounded-lg">
                                  ✓ Yetkazildi
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between py-5">
                      <span className="font-bold text-gray-500">Jami:</span>
                      <span className="text-xl font-black text-[#273444]">
                        {total.toLocaleString()} so'm
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/waiter/order?table=${selectedTable.number}&orderId=${selectedOrder.id}`
                          )
                        }
                        className="w-full bg-[#d97706] hover:bg-[#c76600] text-white py-3 rounded-xl font-bold text-sm cursor-pointer shadow-md transition active:scale-[0.99]"
                      >
                        + Yana taom qo'shish
                      </button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* LOGOUT MODAL */}
      {logoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-center text-xl font-black">Tizimdan chiqish</h2>
            <p className="text-center text-sm text-gray-400 mt-3">
              Haqiqatan ham tizimdan chiqmoqchimisiz?
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setLogoutOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 py-3 rounded-xl font-bold text-sm cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm cursor-pointer"
              >
                Chiqish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}