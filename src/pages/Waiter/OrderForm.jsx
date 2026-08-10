import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function WaiterOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cafeId, currentUser } = useAuth();

  const initialTable = searchParams.get("table") || "1";
  const [tableNumber, setTableNumber] = useState(initialTable);

  const [categories, setCategories] = useState(["Barchasi"]);
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const menuRef = collection(db, "menu");

    const unsub = onSnapshot(
      menuRef,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        let finalItems = items;
        if (cafeId) {
          const cafeFiltered = items.filter((item) => item.cafeId === cafeId);
          if (cafeFiltered.length > 0) {
            finalItems = cafeFiltered;
          }
        }

        setMenuItems(finalItems);

        const rawCats = finalItems.map((i) => i.category).filter(Boolean);
        const uniqueCats = Array.from(new Set(rawCats));
        setCategories(["Barchasi", ...uniqueCats]);
        setLoading(false);
      },
      (error) => {
        console.error("Menyuni yuklashda xatolik:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [cafeId]);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  const totalPrice = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * item.quantity,
    0
  );

  const handleSubmitOrder = async () => {
    if (!tableNumber) {
      alert("Iltimos, stol raqamini kiriting!");
      return;
    }
    if (cart.length === 0) {
      alert("Savat bo'sh! Kamida bitta taom tanlang.");
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        cafeId: cafeId || "",
        tableNumber: Number(tableNumber),
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price || 0),
          quantity: i.quantity,
        })),
        totalPrice,
        paymentStatus: "unpaid",
        kitchenStatus: "pending", // Oshxona uchun muhim!
        itemStatuses: cart.map(() => "pending"),
        createdAt: new Date(),
        waiterEmail: currentUser?.email || "",
      };

      console.log("Yuborilayotgan buyurtma:", orderData);

      const docRef = await addDoc(collection(db, "orders"), orderData);
      console.log("Buyurtma muvaffaqiyatli saqlandi, ID:", docRef.id);

      alert("Buyurtma oshxonaga yuborildi!");
      setCart([]);
      navigate("/waiter/tables");
    } catch (error) {
      console.error("Buyurtma yuborishda xatolik:", error);
      alert("Xatolik: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    if (selectedCategory === "Barchasi") return true;
    if (!item.category) return false;
    return (
      String(item.category).trim().toLowerCase() ===
      String(selectedCategory).trim().toLowerCase()
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 w-full flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sm:px-8 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/waiter/tables")}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            ← Stollar
          </button>
          <span className="font-bold text-lg text-slate-900 hidden sm:inline">
            Yangi buyurtma
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">
            Stol №{tableNumber}
          </span>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-slate-700">
              Stol raqami:
            </span>
            <input
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-24 px-3 py-1.5 border border-slate-300 rounded-xl text-center text-base font-bold bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              Yuklanmoqda...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
              Ushbu kategoriyada taomlar topilmadi
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-24 object-cover rounded-xl mb-2"
                      />
                    ) : (
                      <div className="w-full h-20 bg-slate-100 rounded-xl mb-2 flex items-center justify-center text-2xl">
                        🍲
                      </div>
                    )}
                    <h3 className="font-semibold text-slate-800 text-sm line-clamp-1">
                      {item.name}
                    </h3>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-600">
                      {Number(item.price || 0).toLocaleString()} so'm
                    </span>
                    <button className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg font-bold text-sm flex items-center justify-center hover:bg-amber-600 hover:text-white transition">
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm sticky top-6 flex flex-col h-[calc(100vh-120px)]">
            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100 flex justify-between items-center">
              <span>Savat</span>
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {cart.length} ta tur
              </span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <span className="text-3xl mb-2">🛒</span>
                  Taom tanlash uchun chap tarafdan bosing
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"
                  >
                    <div className="flex-1 pr-2">
                      <h4 className="text-xs font-semibold text-slate-800 line-clamp-1">
                        {item.name}
                      </h4>
                      <span className="text-[11px] font-medium text-amber-600">
                        {(item.price * item.quantity).toLocaleString()} so'm
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 bg-white border border-slate-200 text-slate-700 rounded-md font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-slate-800 min-w-[14px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 bg-white border border-slate-200 text-slate-700 rounded-md font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-2 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-600">
                  Jami summa:
                </span>
                <span className="text-lg font-bold text-amber-600">
                  {totalPrice.toLocaleString()} so'm
                </span>
              </div>

              <button
                disabled={submitting || cart.length === 0}
                onClick={handleSubmitOrder}
                className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-amber-700 disabled:opacity-50 transition cursor-pointer"
              >
                {submitting ? "Yuborilmoqda..." : "Buyurtmani oshxonaga yuborish"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}