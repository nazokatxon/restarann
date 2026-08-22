import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { db } from "../../firebase/config.js";

export default function OrderForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tableNumber = searchParams.get("table");
  const orderId = searchParams.get("orderId");

  const [products, setProducts] = useState([]);
  const [selectedTable, setSelectedTable] = useState(
    tableNumber ? Number(tableNumber) : ""
  );
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // =========================================================
  // PRODUCTLARNI YUKLASH
  // =========================================================

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const productsSnapshot = await getDocs(
          collection(db, "products")
        );

        const productData = productsSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setProducts(productData);

        // Agar mavjud order ochilgan bo'lsa
        if (orderId) {
          const orderSnapshot = await getDoc(
            doc(db, "orders", orderId)
          );

          if (orderSnapshot.exists()) {
            const orderData = orderSnapshot.data();

            setSelectedTable(
              Number(
                orderData.tableNumber ??
                  orderData.table ??
                  orderData.tableNo ??
                  tableNumber
              )
            );

            const oldItems =
              Array.isArray(orderData.kitchenItems)
                ? orderData.kitchenItems
                : Array.isArray(orderData.items)
                ? orderData.items
                : Array.isArray(orderData.products)
                ? orderData.products
                : [];

            setCart(oldItems);
          }
        }
      } catch (error) {
        console.error("Load error:", error);
        toast.error("Ma'lumotlarni yuklashda xatolik!");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orderId, tableNumber]);

  // =========================================================
  // FILTER PRODUCT
  // =========================================================

  const filteredProducts = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return products;

    return products.filter((product) => {
      const name = String(
        product.name ||
          product.title ||
          product.productName ||
          ""
      ).toLowerCase();

      return name.includes(value);
    });
  }, [products, search]);

  // =========================================================
  // PRODUCT NAME
  // =========================================================

  const getProductName = (product) => {
    return (
      product.name ||
      product.title ||
      product.productName ||
      "Nomsiz mahsulot"
    );
  };

  // =========================================================
  // PRODUCT PRICE
  // =========================================================

  const getProductPrice = (product) => {
    return Number(
      product.price ||
        product.sellPrice ||
        product.salePrice ||
        0
    );
  };

  // =========================================================
  // CARTGA QO'SHISH
  // =========================================================

  const addToCart = (product) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          String(item.productId || item.id) === String(product.id)
      );

      if (existingIndex !== -1) {
        return prev.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: Number(item.quantity || 1) + 1,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          productId: product.id,
          name: getProductName(product),
          price: getProductPrice(product),
          quantity: 1,

          // Oshxona/ofitsiant statuslari
          readyForWaiter: false,
          isReady: false,
          waiterTaken: false,
          isDelivered: false,

          // Qo'shimcha ma'lumotlar
          category: product.category || "",
          image: product.image || product.imageUrl || "",
        },
      ];
    });
  };

  // =========================================================
  // QUANTITY O'ZGARTIRISH
  // =========================================================

  const increaseQuantity = (index) => {
    setCart((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              quantity: Number(item.quantity || 1) + 1,
            }
          : item
      )
    );
  };

  const decreaseQuantity = (index) => {
    setCart((prev) =>
      prev
        .map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                quantity: Number(item.quantity || 1) - 1,
              }
            : item
        )
        .filter((item) => Number(item.quantity) > 0)
    );
  };

  // =========================================================
  // ITEMNI O'CHIRISH
  // =========================================================

  const removeFromCart = (index) => {
    setCart((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  // =========================================================
  // JAMI
  // =========================================================

  const totalPrice = useMemo(() => {
    return cart.reduce((sum, item) => {
      return (
        sum +
        Number(item.price || 0) *
          Number(item.quantity || 1)
      );
    }, 0);
  }, [cart]);

  const totalCount = useMemo(() => {
    return cart.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 1),
      0
    );
  }, [cart]);

  // =========================================================
  // BUYURTMANI SAQLASH
  // =========================================================

  const handleSaveOrder = async () => {
    if (!selectedTable) {
      toast.warning("Stol raqamini tanlang!");
      return;
    }

    if (cart.length === 0) {
      toast.warning("Kamida bitta mahsulot qo'shing!");
      return;
    }

    try {
      setSaving(true);

      const cleanItems = cart.map((item) => ({
        ...item,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
      }));

      const orderData = {
        tableNumber: Number(selectedTable),

        kitchenItems: cleanItems,

        totalPrice: Number(totalPrice),
        total: Number(totalPrice),

        status: "active",
        kitchenStatus: "pending",
        paymentStatus: "pending",
        isPaid: false,

        updatedAt: serverTimestamp(),
      };

      // =====================================================
      // MAVJUD ORDERGA TAOM QO'SHISH
      // =====================================================

      if (orderId) {
        await updateDoc(
          doc(db, "orders", orderId),
          orderData
        );

        toast.success(
          "✅ Buyurtma muvaffaqiyatli yangilandi!"
        );
      } else {
        // ===================================================
        // YANGI ORDER
        // ===================================================

        await addDoc(collection(db, "orders"), {
          ...orderData,
          createdAt: serverTimestamp(),
        });

        toast.success(
          "✅ Buyurtma muvaffaqiyatli oshxonaga yuborildi!"
        );
      }

      navigate("/waiter/tables");
    } catch (error) {
      console.error("Save order error:", error);
      toast.error(
        "❌ Buyurtmani saqlashda xatolik yuz berdi!"
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5ef] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🍲</div>

          <p className="font-bold text-gray-500">
            Yuklanmoqda...
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
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/waiter/tables")}
              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold cursor-pointer"
            >
              ←
            </button>

            <div>
              <h1 className="font-extrabold text-[#6f3518]">
                Yangi buyurtma
              </h1>

              <p className="text-xs text-gray-400 mt-0.5">
                {selectedTable
                  ? `Stol № ${selectedTable}`
                  : "Stol tanlang"}
              </p>
            </div>
          </div>

          <div className="hidden sm:block text-right">
            <p className="text-xs text-gray-400">
              Jami
            </p>

            <p className="font-black text-[#3b2418]">
              {totalPrice.toLocaleString()} so'm
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          {/* ================================================= */}
          {/* PRODUCTLAR */}
          {/* ================================================= */}

          <section>
            <div className="bg-white rounded-2xl border border-[#eee5d8] shadow-sm p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-extrabold text-[#3b2418]">
                    Taomlar va ichimliklar
                  </h2>

                  <p className="text-xs text-gray-400 mt-1">
                    Kerakli mahsulotni tanlang
                  </p>
                </div>

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="🔍 Qidirish..."
                  className="w-full sm:w-56 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#d97706]"
                />
              </div>

              {filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <div className="text-4xl mb-3">
                    🍽️
                  </div>

                  <p className="font-bold">
                    Mahsulot topilmadi
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() =>
                        addToCart(product)
                      }
                      className="text-left border border-gray-200 rounded-2xl p-3 bg-white hover:border-[#d97706] hover:shadow-md transition active:scale-[0.98] cursor-pointer"
                    >
                      <div className="w-full aspect-square rounded-xl bg-[#fff7e8] flex items-center justify-center text-4xl mb-3 overflow-hidden">
                        {product.image ||
                        product.imageUrl ? (
                          <img
                            src={
                              product.image ||
                              product.imageUrl
                            }
                            alt={getProductName(product)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          "🍲"
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-gray-800 line-clamp-2 min-h-[40px]">
                        {getProductName(product)}
                      </h3>

                      <p className="text-[#d97706] font-black text-sm mt-2">
                        {getProductPrice(
                          product
                        ).toLocaleString()}{" "}
                        so'm
                      </p>

                      <div className="mt-3 w-full text-center bg-[#fff7e8] text-[#b45309] py-2 rounded-lg text-xs font-bold">
                        + Qo'shish
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ================================================= */}
          {/* SAVAT */}
          {/* ================================================= */}

          <aside className="lg:sticky lg:top-[80px] h-fit">
            <div className="bg-white rounded-2xl border border-[#eee5d8] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-[#3b2418]">
                    Buyurtma
                  </h2>

                  <p className="text-xs text-gray-400 mt-1">
                    {totalCount} ta mahsulot
                  </p>
                </div>

                <div className="w-11 h-11 rounded-xl bg-[#fff0d2] flex items-center justify-center">
                  🛒
                </div>
              </div>

              {/* STOL */}

              <div className="p-4 border-b border-gray-100">
                <label className="text-xs font-bold text-gray-500 block mb-2">
                  STOL RAQAMI
                </label>

                <input
                  type="number"
                  min="1"
                  value={selectedTable}
                  onChange={(e) =>
                    setSelectedTable(
                      e.target.value
                    )
                  }
                  placeholder="Masalan: 3"
                  className="w-full border-2 border-gray-200 focus:border-[#d97706] outline-none rounded-xl px-4 py-3 font-bold"
                />
              </div>

              {/* CART ITEMS */}

              <div className="p-4 max-h-[420px] overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-4xl mb-3">
                      🛒
                    </div>

                    <p className="font-bold text-gray-500">
                      Savat bo'sh
                    </p>

                    <p className="text-xs text-gray-400 mt-1">
                      Chap tomondan mahsulot tanlang
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item, index) => (
                      <div
                        key={
                          item.id ||
                          `${item.productId}-${index}`
                        }
                        className="border border-gray-100 bg-[#fafafa] rounded-xl p-3"
                      >
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm truncate">
                              {item.name}
                            </h3>

                            <p className="text-xs text-[#d97706] font-bold mt-1">
                              {Number(
                                item.price || 0
                              ).toLocaleString()}{" "}
                              so'm
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeFromCart(index)
                            }
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                decreaseQuantity(index)
                              }
                              className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 font-bold cursor-pointer"
                            >
                              −
                            </button>

                            <span className="w-8 text-center font-black">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                increaseQuantity(index)
                              }
                              className="w-8 h-8 rounded-lg bg-[#fff0d2] text-[#b45309] hover:bg-[#ffe3ad] font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <span className="font-black text-sm">
                            {(
                              Number(item.price || 0) *
                              Number(item.quantity || 1)
                            ).toLocaleString()}{" "}
                            so'm
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TOTAL */}

              <div className="border-t border-gray-100 p-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-gray-500">
                    Jami summa
                  </span>

                  <span className="text-xl font-black text-[#3b2418]">
                    {totalPrice.toLocaleString()} so'm
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveOrder}
                  disabled={
                    saving ||
                    cart.length === 0 ||
                    !selectedTable
                  }
                  className="w-full bg-[#d97706] hover:bg-[#c56600] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-extrabold cursor-pointer transition active:scale-[0.98]"
                >
                  {saving
                    ? "Saqlanmoqda..."
                    : orderId
                    ? "✓ Buyurtmani yangilash"
                    : "🍲 Oshxonaga yuborish"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/waiter/tables")
                  }
                  disabled={saving}
                  className="w-full mt-2 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-bold text-sm cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}