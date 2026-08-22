import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { db } from "../../firebase/config.js";

export default function KitchenQueue() {
  const navigate = useNavigate();
  const auth = getAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [updatingItem, setUpdatingItem] = useState("");

  // =========================================================
  // ORDERS REALTIME LISTENER
  // =========================================================

  useEffect(() => {
    setLoading(true);

    const qOrders = query(collection(db, "orders"));

    const unsubscribe = onSnapshot(
      qOrders,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setOrders(data);
        setLoading(false);
      },
      (error) => {
        console.error("Kitchen orders error:", error);
        toast.error("Buyurtmalarni yuklashda xatolik!");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================================================
  // GET ITEMS
  // =========================================================

  const getOrderItems = (order) => {
    if (!order) return [];

    if (Array.isArray(order.kitchenItems)) {
      return order.kitchenItems;
    }

    if (Array.isArray(order.items)) {
      return order.items;
    }

    if (Array.isArray(order.products)) {
      return order.products;
    }

    return [];
  };

  // =========================================================
  // GET FIELD NAME
  // =========================================================

  const getItemsFieldName = (order) => {
    if (Array.isArray(order.kitchenItems)) {
      return "kitchenItems";
    }

    if (Array.isArray(order.items)) {
      return "items";
    }

    if (Array.isArray(order.products)) {
      return "products";
    }

    return "kitchenItems";
  };

  // =========================================================
  // ACTIVE ORDERS
  // =========================================================

  const activeOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const status = String(order.status || "")
          .trim()
          .toLowerCase();

        const kitchenStatus = String(
          order.kitchenStatus || ""
        )
          .trim()
          .toLowerCase();

        const paymentStatus = String(
          order.paymentStatus || ""
        )
          .trim()
          .toLowerCase();

        const isClosed =
          status === "closed" ||
          status === "completed" ||
          status === "paid" ||
          status === "waiting_payment" ||
          status === "cancelled" ||
          paymentStatus === "paid" ||
          paymentStatus === "cancelled" ||
          kitchenStatus === "closed";

        return !isClosed;
      })
      .filter((order) => {
        const items = getOrderItems(order);

        return items.some(
          (item) =>
            item.readyForWaiter !== true &&
            item.isReady !== true &&
            item.waiterTaken !== true &&
            item.isDelivered !== true
        );
      })
      .sort((a, b) => {
        const getTime = (value) => {
          if (!value) return 0;

          if (value?.toDate) {
            return value.toDate().getTime();
          }

          const date = new Date(value);

          return Number.isNaN(date.getTime())
            ? 0
            : date.getTime();
        };

        return (
          getTime(a.createdAt) -
          getTime(b.createdAt)
        );
      });
  }, [orders]);

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (date) => {
    if (!date) return "--:--";

    try {
      const value = date?.toDate
        ? date.toDate()
        : new Date(date);

      if (Number.isNaN(value.getTime())) {
        return "--:--";
      }

      return value.toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "--:--";
    }
  };

  // =========================================================
  // GET TABLE NUMBER
  // =========================================================

  const getTableNumber = (order) => {
    return (
      order.tableNumber ??
      order.table ??
      order.tableNo ??
      "-"
    );
  };

  // =========================================================
  // GET ITEM NAME
  // =========================================================

  const getItemName = (item) => {
    return (
      item?.name ||
      item?.title ||
      item?.productName ||
      "Nomsiz taom"
    );
  };

  // =========================================================
  // ITEM KEY
  // =========================================================

  const getItemKey = (item, index) => {
    return (
      item?.id ||
      item?.itemId ||
      item?.productId ||
      `${getItemName(item)}-${index}`
    );
  };

  // =========================================================
  // ITEM TAYYOR QILISH
  // =========================================================

  const handleMarkReady = async (
    order,
    itemIndex
  ) => {
    const updatingKey = `${order.id}-${itemIndex}`;

    try {
      setUpdatingItem(updatingKey);

      const fieldName = getItemsFieldName(order);
      const items = [...getOrderItems(order)];

      const item = items[itemIndex];

      if (!item) {
        toast.error("Taom topilmadi!");
        return;
      }

      const isAlreadyReady =
        item.readyForWaiter === true ||
        item.isReady === true;

      if (isAlreadyReady) {
        toast.info("Bu taom allaqachon tayyor!");
        return;
      }

      items[itemIndex] = {
        ...item,
        readyForWaiter: true,
        isReady: true,
        kitchenItemStatus: "ready",
        readyAt: new Date().toISOString(),
      };

      const pendingItems = items.filter(
        (currentItem) =>
          currentItem.readyForWaiter !== true &&
          currentItem.isReady !== true &&
          currentItem.waiterTaken !== true &&
          currentItem.isDelivered !== true
      );

      await updateDoc(
        doc(db, "orders", order.id),
        {
          [fieldName]: items,
          kitchenStatus:
            pendingItems.length === 0
              ? "ready"
              : "preparing",
          updatedAt: serverTimestamp(),
        }
      );

      toast.success(
        `✅ ${getItemName(item)} tayyor bo'ldi!`
      );
    } catch (error) {
      console.error("Mark ready error:", error);
      toast.error(
        "Taom holatini yangilashda xatolik!"
      );
    } finally {
      setUpdatingItem("");
    }
  };

  // =========================================================
  // BARCHASINI TAYYOR
  // =========================================================

  const handleOrderReady = async (order) => {
    try {
      const fieldName = getItemsFieldName(order);
      const items = [...getOrderItems(order)];

      const newItems = items.map((item) => {
        const isDelivered =
          item.waiterTaken === true ||
          item.isDelivered === true;

        if (isDelivered) {
          return item;
        }

        return {
          ...item,
          readyForWaiter: true,
          isReady: true,
          kitchenItemStatus: "ready",
          readyAt:
            item.readyAt ||
            new Date().toISOString(),
        };
      });

      await updateDoc(
        doc(db, "orders", order.id),
        {
          [fieldName]: newItems,
          kitchenStatus: "ready",
          updatedAt: serverTimestamp(),
        }
      );

      toast.success(
        `🍲 Stol № ${getTableNumber(
          order
        )} buyurtmasi tayyor!`
      );
    } catch (error) {
      console.error("Order ready error:", error);
      toast.error(
        "Buyurtmani yangilashda xatolik!"
      );
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      await signOut(auth);

      toast.info("Tizimdan chiqdingiz");

      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);

      toast.error(
        "Tizimdan chiqishda xatolik!"
      );
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5ef] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">
            👨‍🍳
          </div>

          <p className="font-bold text-gray-500">
            Oshxona buyurtmalari yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-gray-800">
      {/* HEADER */}

      <header className="sticky top-0 z-30 bg-white border-b border-[#eee5d8] shadow-sm">
        <div className="w-full max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#fff0d2] flex items-center justify-center text-xl">
              👨‍🍳
            </div>

            <div>
              <h1 className="text-base font-extrabold text-[#6f3518]">
                KARAVAN KAFE
              </h1>

              <p className="text-[11px] text-gray-400">
                Oshxona paneli
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setLogoutModalOpen(true)
            }
            className="border border-red-200 text-red-500 bg-white hover:bg-red-50 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            ↪ Chiqish
          </button>
        </div>
      </header>

      {/* MAIN */}

      <main className="w-full max-w-6xl mx-auto px-4 py-5">
        {/* TITLE */}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="text-2xl font-black text-[#3b2418]">
              Oshxona buyurtmalari
            </h2>

            <p className="text-sm text-gray-400 mt-1">
              Yangi kelgan buyurtmalarni tayyorlang
            </p>
          </div>

          <div className="bg-white border border-[#eee5d8] rounded-xl px-4 py-3 shadow-sm">
            <span className="text-xs text-gray-400">
              Faol buyurtmalar
            </span>

            <p className="font-black text-lg text-[#d97706]">
              {activeOrders.length} ta
            </p>
          </div>
        </div>

        {/* EMPTY */}

        {activeOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-20 text-center">
            <div className="text-5xl mb-4">
              👨‍🍳
            </div>

            <h3 className="font-extrabold text-gray-700">
              Hozircha yangi buyurtmalar yo'q
            </h3>

            <p className="text-sm text-gray-400 mt-2">
              Yangi buyurtma kelganda shu yerda
              avtomatik chiqadi
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeOrders.map((order) => {
              const items = getOrderItems(order);

              const pendingItems = items.filter(
                (item) =>
                  item.readyForWaiter !== true &&
                  item.isReady !== true &&
                  item.waiterTaken !== true &&
                  item.isDelivered !== true
              );

              const readyItems = items.filter(
                (item) =>
                  item.readyForWaiter === true ||
                  item.isReady === true ||
                  item.waiterTaken === true ||
                  item.isDelivered === true
              );

              const total = items.reduce(
                (sum, item) =>
                  sum +
                  Number(item.price || 0) *
                    Number(
                      item.quantity ||
                        item.count ||
                        1
                    ),
                0
              );

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-[#eee5d8] shadow-sm overflow-hidden"
                >
                  {/* CARD HEADER */}

                  <div className="bg-[#3b2418] text-white px-4 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/60">
                        STOL
                      </p>

                      <h3 className="text-2xl font-black">
                        № {getTableNumber(order)}
                      </h3>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-white/60">
                        🕐 {formatTime(order.createdAt)}
                      </div>

                      <div className="mt-2 bg-[#d97706] rounded-lg px-2 py-1 text-[10px] font-bold">
                        {pendingItems.length} TA KUTILMOQDA
                      </div>
                    </div>
                  </div>

                  {/* ITEMS */}

                  <div className="p-4 space-y-2 max-h-[380px] overflow-y-auto">
                    {items.map((item, index) => {
                      const isReady =
                        item.readyForWaiter === true ||
                        item.isReady === true;

                      const isDelivered =
                        item.waiterTaken === true ||
                        item.isDelivered === true;

                      const updatingKey =
                        `${order.id}-${index}`;

                      return (
                        <div
                          key={getItemKey(
                            item,
                            index
                          )}
                          className={`rounded-xl border p-3 ${
                            isDelivered
                              ? "bg-green-50 border-green-200"
                              : isReady
                              ? "bg-blue-50 border-blue-200"
                              : "bg-[#fffaf3] border-[#f2e3cf]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm">
                                {getItemName(item)}
                              </h4>

                              <p className="text-xs text-gray-400 mt-1">
                                Miqdor:{" "}
                                <b>
                                  {item.quantity ||
                                    item.count ||
                                    1}
                                </b>
                              </p>
                            </div>

                            <div className="shrink-0">
                              {isDelivered ? (
                                <span className="inline-flex bg-green-200 text-green-800 px-3 py-2 rounded-lg text-xs font-bold">
                                  🚚 Yetkazildi
                                </span>
                              ) : isReady ? (
                                <span className="inline-flex bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-xs font-bold">
                                  ✅ Tayyor
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleMarkReady(
                                      order,
                                      index
                                    )
                                  }
                                  disabled={
                                    updatingItem ===
                                    updatingKey
                                  }
                                  className="bg-[#d97706] hover:bg-[#c56600] disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  {updatingItem ===
                                  updatingKey
                                    ? "..."
                                    : "✓ Tayyor"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* FOOTER */}

                  <div className="border-t border-gray-100 p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold text-gray-500">
                        Jami:
                      </span>

                      <span className="font-black text-[#3b2418]">
                        {total.toLocaleString()} so'm
                      </span>
                    </div>

                    {pendingItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOrderReady(order)
                        }
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition active:scale-[0.98]"
                      >
                        🍲 Hammasini tayyor qilish
                      </button>
                    )}

                    {pendingItems.length === 0 &&
                      readyItems.length > 0 && (
                        <div className="w-full bg-green-50 text-green-700 py-3 rounded-xl text-center font-bold text-sm">
                          ✅ Ofitsiantga tayyor
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* LOGOUT MODAL */}

      {logoutModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 text-center">
            <div className="text-4xl mb-3">
              🚪
            </div>

            <h3 className="text-lg font-extrabold text-gray-800 mb-2">
              Tizimdan chiqish
            </h3>

            <p className="text-sm text-gray-500 mb-5">
              Haqiqatan ham tizimdan
              chiqmoqchimisiz?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setLogoutModalOpen(false)
                }
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm cursor-pointer"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl text-sm cursor-pointer"
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