import { useState, useEffect, useMemo } from "react";
import { db } from "../../firebase/config";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

// =========================================================
// MENYU CATEGORY -> OSHXONA (KITCHEN) ROLI MOSLASHTIRISH
// (OrderForm.jsx dagi bilan bir xil, kelajakda umumiy faylga
// chiqarish mumkin)
// =========================================================

const CATEGORY_TO_KITCHEN_TYPE = {
  shashlik: "shashlikchi",
  desert: "pishiriqchi",
  ichimlik: "ichimlikchi",
  somsa: "somsachi",
  asosiy: "taomchi",
};

function resolveKitchenType(product) {
  const category = String(product.category || "").toLowerCase();
  return CATEGORY_TO_KITCHEN_TYPE[category] || product.kitchenType || "umumiy";
}

export default function Buyurtma() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Naqd");
  const [submitting, setSubmitting] = useState(false);

  // ============= DASTAVKA / SABOY UCHUN STATE =============
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [orderType, setOrderType] = useState("dastavka"); // "dastavka" | "saboy"
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [newOrderPaymentMethod, setNewOrderPaymentMethod] = useState("Naqd");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [newOrderCart, setNewOrderCart] = useState([]);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const totalTables = Array.from({ length: 10 }, (_, i) => i + 1);

  const formatPrice = (price) =>
    new Intl.NumberFormat("uz-UZ").format(price || 0) + " so'm";

  // Buyurtma summasini xavfsiz hisoblash
  const calculateOrderTotal = (order) => {
    if (!order) return 0;
    const directTotal = Number(order.total || order.totalAmount || order.totalPrice || 0);
    if (directTotal > 0) return directTotal;

    const itemsList = order.items || order.kitchenItems || [];
    return itemsList.reduce((sum, item) => {
      const price = Number(item.price || item.cost || 0);
      const qty = Number(item.quantity || item.count || item.qty || 1);
      return sum + price * qty;
    }, 0);
  };

  // FIRESTORE'DAN OCHIQ BUYURTMALARNI OLISH
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const ordersRef = collection(db, "orders");
    const q = user?.cafeId
      ? query(ordersRef, where("cafeId", "==", user.cafeId))
      : query(ordersRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const activeOrders = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const status = String(data.status || "").toLowerCase().trim();

          // Yopilmagan va to'lanmagan barsha faol buyurtmalarni kiritamiz
          if (
            status !== "closed" &&
            status !== "paid" &&
            status !== "yopildi" &&
            status !== "cancelled" &&
            status !== "canceled"
          ) {
            activeOrders.push({ id: docSnap.id, ...data });
          }
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

  // MENYUNI YUKLASH (dastavka/saboy uchun taom tanlash)
  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        setProductsLoading(true);
        const snapshot = await getDocs(collection(db, "menu"));
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (isMounted) setProducts(list);
      } catch (error) {
        console.error("Menyuni yuklashda xatolik:", error);
      } finally {
        if (isMounted) setProductsLoading(false);
      }
    };

    loadProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  // STOL BUYURTMASINI ANIQ QILIB TOPISH (Number va String shakllarni inobatga oladi)
  const getTableOrder = (tableNum) => {
    return orders.find((o) => {
      // Dastavka/saboy buyurtmalari stolga tegishli emas
      if (o.orderType === "dastavka" || o.orderType === "saboy") return false;
      const orderTable = o.tableNumber ?? o.table ?? o.tableNo ?? o.stoli;
      if (orderTable === undefined || orderTable === null) return false;
      return Number(orderTable) === Number(tableNum);
    });
  };

  // FAOL DASTAVKA / SABOY BUYURTMALARI
  const takeawayOrders = useMemo(() => {
    return orders.filter(
      (o) => o.orderType === "dastavka" || o.orderType === "saboy"
    );
  }, [orders]);

  // To'lovni amalga oshirish va stolni yopish
  const handleCloseTable = async () => {
    if (!selectedOrder) return;

    try {
      setSubmitting(true);
      const orderRef = doc(db, "orders", selectedOrder.id);

      const finalTotal = calculateOrderTotal(selectedOrder);

      await updateDoc(orderRef, {
        status: "closed",
        kitchenStatus: "completed",
        paymentStatus: "paid",
        isPaid: true,
        paymentMethod: paymentMethod,
        totalAmount: finalTotal,
        totalPrice: finalTotal,
        total: finalTotal,
        paidAt: serverTimestamp(),
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setShowPayment(false);
      setSelectedOrder(null);
      alert("To'lov qabul qilindi. Stol yopildi va cheklarga tushdi!");
    } catch (error) {
      console.error("Stolni yopishda xatolik:", error);
      alert("Xatolik yuz berdi!");
    } finally {
      setSubmitting(false);
    }
  };

  // Dastavka/saboy buyurtmasini "topshirildi" deb yopish
  const handleCompleteTakeaway = async (order) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "closed",
        kitchenStatus: "completed",
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert(
        order.orderType === "dastavka"
          ? "Dastavka topshirildi!"
          : "Saboy topshirildi!"
      );
    } catch (error) {
      console.error("Yopishda xatolik:", error);
      alert("Xatolik yuz berdi!");
    }
  };

  // ============= DASTAVKA / SABOY: SAVAT BOSHQARUVI =============

  const getProductName = (p) => p.name || p.title || p.productName || "Nomsiz";
  const getProductPrice = (p) =>
    Number(p.price || p.sellPrice || p.salePrice || 0);

  const filteredProducts = useMemo(() => {
    const value = productSearch.trim().toLowerCase();
    if (!value) return products;
    return products.filter((p) =>
      getProductName(p).toLowerCase().includes(value)
    );
  }, [products, productSearch]);

  const addToNewOrderCart = (product) => {
    setNewOrderCart((prev) => {
      const idx = prev.findIndex(
        (item) => String(item.productId) === String(product.id)
      );
      if (idx !== -1) {
        return prev.map((item, i) =>
          i === idx
            ? { ...item, quantity: Number(item.quantity || 1) + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          productId: product.id,
          name: getProductName(product),
          title: getProductName(product),
          price: getProductPrice(product),
          quantity: 1,
          category: product.category || "",
          kitchenType: resolveKitchenType(product),
          readyForWaiter: false,
          isReady: false,
          waiterTaken: false,
          isDelivered: false,
        },
      ];
    });
  };

  const changeNewOrderQty = (itemId, delta) => {
    setNewOrderCart((prev) =>
      prev
        .map((item) =>
          item.id === itemId
            ? { ...item, quantity: Number(item.quantity || 1) + delta }
            : item
        )
        .filter((item) => Number(item.quantity) > 0)
    );
  };

  const removeFromNewOrderCart = (itemId) => {
    setNewOrderCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const newOrderTotal = useMemo(() => {
    return newOrderCart.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
  }, [newOrderCart]);

  const resetNewOrderForm = () => {
    setOrderType("dastavka");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setNewOrderPaymentMethod("Naqd");
    setNewOrderCart([]);
    setProductSearch("");
  };

  // Dastavka / Saboy buyurtmasini yaratish (to'lov shu yerda darhol olinadi)
  const handleCreateTakeawayOrder = async () => {
    if (!customerName.trim()) {
      alert("Mijoz ismini kiriting!");
      return;
    }
    if (!customerPhone.trim()) {
      alert("Telefon raqamini kiriting!");
      return;
    }
    if (orderType === "dastavka" && !customerAddress.trim()) {
      alert("Yetkazish manzilini kiriting!");
      return;
    }
    if (newOrderCart.length === 0) {
      alert("Kamida bitta taom tanlang!");
      return;
    }

    try {
      setCreatingOrder(true);

      const cleanItems = newOrderCart.map((item) => ({
        id: item.id,
        name: item.name,
        title: item.title,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
        total: Number(item.price || 0) * Number(item.quantity || 1),
        category: item.category || "",
        kitchenType: item.kitchenType || "umumiy",
        readyForWaiter: false,
        isReady: false,
        waiterTaken: false,
        isDelivered: false,
      }));

      await addDoc(collection(db, "orders"), {
        orderType, // "dastavka" | "saboy"
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: orderType === "dastavka" ? customerAddress.trim() : "",
        kitchenItems: cleanItems,
        items: cleanItems,
        totalPrice: newOrderTotal,
        totalAmount: newOrderTotal,
        total: newOrderTotal,
        status: "active",
        kitchenStatus: "pending",
        // To'lov darhol olinadi
        paymentStatus: "paid",
        isPaid: true,
        paymentMethod: newOrderPaymentMethod,
        paidAt: serverTimestamp(),
        cashierId: user?.uid || null,
        cashierName: user?.fullName || user?.email || "Kassir",
        cafeId: user?.cafeId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      alert(
        orderType === "dastavka"
          ? "✅ Dastavka buyurtmasi qabul qilindi va oshxonaga yuborildi!"
          : "✅ Saboy buyurtmasi qabul qilindi va oshxonaga yuborildi!"
      );

      resetNewOrderForm();
      setShowNewOrder(false);
    } catch (error) {
      console.error("Buyurtma yaratishda xatolik:", error);
      alert("Xatolik yuz berdi!");
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-68px)] bg-slate-100 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Stollar (Kassa)
          </h1>
          <p className="text-sm text-slate-500">
            To'lovni amalga oshirish va stolni yopish uchun aktiv stol ustiga bosing
          </p>
        </div>

        <button
          onClick={() => setShowNewOrder(true)}
          className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-95 cursor-pointer"
        >
          🚚 Dastavka / Saboy
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center font-semibold text-slate-400">
          Stollar yuklanmoqda...
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {totalTables.map((tableNum) => {
            const order = getTableOrder(tableNum);
            const isOccupied = !!order;

            const items = order?.items || order?.kitchenItems || [];
            const allDelivered =
              order?.kitchenStatus === "ready" ||
              order?.kitchenStatus === "delivered" ||
              order?.status === "delivered" ||
              order?.status === "yetkazildi" ||
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
                    : "Band (Tayyorlanmoqda)"}
                </div>
                {isOccupied && (
                  <div className="mt-2 text-sm font-extrabold text-slate-900">
                    {formatPrice(calculateOrderTotal(order))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ============= DASTAVKA / SABOY FAOL BUYURTMALAR RO'YXATI ============= */}
      {!loading && takeawayOrders.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-black text-slate-900">
            🚚 Dastavka / Saboy buyurtmalari
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {takeawayOrders.map((order) => {
              const items = order.items || order.kitchenItems || [];
              const allReady =
                items.length > 0 &&
                items.every(
                  (i) =>
                    i.isReady ||
                    i.readyForWaiter ||
                    i.status === "ready" ||
                    i.status === "delivered"
                );

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`rounded-xl px-3 py-1 text-xs font-bold ${
                        order.orderType === "dastavka"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {order.orderType === "dastavka" ? "🚚 Dastavka" : "🛍️ Saboy"}
                    </span>
                    <span
                      className={`rounded-xl px-3 py-1 text-xs font-bold ${
                        allReady
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {allReady ? "✓ Tayyor" : "⏳ Tayyorlanmoqda"}
                    </span>
                  </div>

                  <p className="font-bold text-slate-800">{order.customerName}</p>
                  <p className="text-sm text-slate-500">{order.customerPhone}</p>
                  {order.orderType === "dastavka" && order.customerAddress && (
                    <p className="mt-1 text-xs text-slate-400">
                      📍 {order.customerAddress}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-sm font-semibold text-slate-500">
                      Jami:
                    </span>
                    <span className="font-black text-slate-900">
                      {formatPrice(calculateOrderTotal(order))}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCompleteTakeaway(order)}
                    className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 cursor-pointer"
                  >
                    ✓ Topshirildi
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1-MODAL: BUYURTMA TAFSILOTLARI (STOL) */}
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

                const quantity = item.quantity || item.count || item.qty || 1;
                const itemTotal = Number(item.price || item.cost || 0) * quantity;

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
                  >
                    <div>
                      <div className="font-bold text-slate-800">
                        {item.name || item.title}{" "}
                        <span className="text-slate-400">
                          × {quantity}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500">
                        {formatPrice(itemTotal)}
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

            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="mb-5 flex items-center justify-between">
                <span className="font-bold text-slate-500">Jami:</span>
                <span className="text-2xl font-black text-slate-900">
                  {formatPrice(calculateOrderTotal(selectedOrder))}
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

      {/* 2-MODAL: TO'LOV QILISH (STOL) */}
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
                {formatPrice(calculateOrderTotal(selectedOrder))}
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

      {/* 3-MODAL: YANGI DASTAVKA / SABOY BUYURTMASI */}
      {showNewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-xl font-black text-slate-900">
                Yangi Dastavka / Saboy buyurtmasi
              </h2>
              <button
                onClick={() => {
                  setShowNewOrder(false);
                  resetNewOrderForm();
                }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[1fr_360px]">
              {/* CHAP: FORMA + TAOMLAR */}
              <div className="overflow-y-auto p-5">
                {/* BUYURTMA TURI */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderType("dastavka")}
                    className={`rounded-2xl border-2 p-4 font-bold transition cursor-pointer ${
                      orderType === "dastavka"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-100 bg-slate-50 text-slate-500"
                    }`}
                  >
                    🚚 Dastavka
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("saboy")}
                    className={`rounded-2xl border-2 p-4 font-bold transition cursor-pointer ${
                      orderType === "saboy"
                        ? "border-purple-600 bg-purple-50 text-purple-700"
                        : "border-slate-100 bg-slate-50 text-slate-500"
                    }`}
                  >
                    🛍️ Saboy
                  </button>
                </div>

                {/* MIJOZ MA'LUMOTLARI */}
                <div className="mb-5 space-y-3">
                  <input
                    type="text"
                    placeholder="Mijoz ismi"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 font-semibold outline-none focus:border-blue-500"
                  />
                  <input
                    type="tel"
                    placeholder="Telefon raqami (+998...)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 font-semibold outline-none focus:border-blue-500"
                  />
                  {orderType === "dastavka" && (
                    <input
                      type="text"
                      placeholder="Yetkazish manzili"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 font-semibold outline-none focus:border-blue-500"
                    />
                  )}
                </div>

                {/* TAOM QIDIRISH */}
                <input
                  type="text"
                  placeholder="🔍 Taom qidirish..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />

                {/* TAOMLAR GRID */}
                {productsLoading ? (
                  <div className="py-10 text-center text-slate-400 font-semibold">
                    Menyu yuklanmoqda...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 font-semibold">
                    Mahsulot topilmadi
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addToNewOrderCart(product)}
                        className="rounded-2xl border border-slate-200 p-3 text-left transition hover:border-blue-400 hover:shadow-md cursor-pointer"
                      >
                        <div className="mb-2 flex h-16 w-full items-center justify-center rounded-xl bg-slate-50 text-3xl">
                          🍲
                        </div>
                        <p className="line-clamp-2 text-sm font-bold text-slate-800">
                          {getProductName(product)}
                        </p>
                        <p className="mt-1 text-sm font-black text-blue-600">
                          {formatPrice(getProductPrice(product))}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* O'NG: SAVAT + TO'LOV */}
              <div className="flex flex-col border-t border-slate-100 md:border-l md:border-t-0">
                <div className="flex-1 overflow-y-auto p-5">
                  <h3 className="mb-3 font-black text-slate-900">Savat</h3>

                  {newOrderCart.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-400">
                      Hali taom tanlanmagan
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {newOrderCart.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {item.name}
                            </p>
                            <button
                              onClick={() => removeFromNewOrderCart(item.id)}
                              className="text-red-400 hover:text-red-600 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => changeNewOrderQty(item.id, -1)}
                                className="h-7 w-7 rounded-lg bg-slate-200 font-bold cursor-pointer"
                              >
                                −
                              </button>
                              <span className="w-6 text-center font-black">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => changeNewOrderQty(item.id, 1)}
                                className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-sm font-black text-slate-900">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 p-5">
                  <p className="mb-2 text-xs font-bold text-slate-500">
                    TO'LOV USULI
                  </p>
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    {["Naqd", "Karta", "Click"].map((method) => (
                      <button
                        key={method}
                        onClick={() => setNewOrderPaymentMethod(method)}
                        className={`rounded-xl border-2 py-2 text-xs font-bold transition cursor-pointer ${
                          newOrderPaymentMethod === method
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-100 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>

                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-bold text-slate-500">Jami:</span>
                    <span className="text-xl font-black text-slate-900">
                      {formatPrice(newOrderTotal)}
                    </span>
                  </div>

                  <button
                    onClick={handleCreateTakeawayOrder}
                    disabled={creatingOrder || newOrderCart.length === 0}
                    className="w-full rounded-2xl bg-blue-600 py-3.5 font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:bg-slate-300 cursor-pointer"
                  >
                    {creatingOrder
                      ? "Saqlanmoqda..."
                      : "💳 To'lovni qabul qilish va yuborish"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}