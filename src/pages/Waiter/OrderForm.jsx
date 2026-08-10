import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

export default function OrderForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cafeId, currentUser } = useAuth();

  const initialTable = searchParams.get("table") || "1";
  const [tableNumber, setTableNumber] = useState(initialTable);
  
  // Avtomatik topiladigan buyurtma ID-si
  const [existingOrderId, setExistingOrderId] = useState(null);

  const [categories, setCategories] = useState(["Barchasi"]);
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

  // =========================================================
  // 1. SHU STOLDA MAVJUD BUYURTMANI AVTOMATIK QIDIRIB YUKLASH
  // =========================================================
  useEffect(() => {
    if (!tableNumber) return;

    const fetchActiveOrderForTable = async () => {
      try {
        const q = query(
          collection(db, "orders"),
          where("tableNumber", "==", Number(tableNumber)),
          where("paymentStatus", "==", "unpaid")
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const activeOrderDoc = querySnapshot.docs[0];
          setExistingOrderId(activeOrderDoc.id);
          
          const orderData = activeOrderDoc.data();
          if (orderData.items && Array.isArray(orderData.items)) {
            // Avvalgi taomlarni savatga joylaymiz (yo'qolmaydi!)
            setCart(orderData.items);
          }
        }
      } catch (error) {
        console.error("Stol buyurtmasini yuklashda xatolik:", error);
      }
    };

    fetchActiveOrderForTable();
  }, [tableNumber]);

  // =========================================================
  // 2. MENYU VA TAOMLARNI YUKLASH
  // =========================================================
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
          if (cafeFiltered.length > 0) finalItems = cafeFiltered;
        }

        setMenuItems(finalItems);

        const rawCats = finalItems.map((i) => i.category).filter(Boolean);
        const uniqueCats = Array.from(new Set(rawCats));
        setCategories(["Barchasi", ...uniqueCats]);
        setLoading(false);
      },
      (error) => {
        console.error("Menyuni yuklashda xatolik:", error);
        toast.error("Menyuni yuklashda xatolik!");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [cafeId]);

  // =========================================================
  // 3. SAVAT AMALLARI
  // =========================================================
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          category: item.category || "",
          imageUrl: item.imageUrl || item.image || "",
          quantity: 1,
          note: "",
        },
      ];
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

  const updateNote = (id, noteText) => {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, note: noteText } : i))
    );
  };

  const getItemQuantityInCart = (id) => {
    const found = cart.find((i) => i.id === id);
    return found ? found.quantity : 0;
  };

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * item.quantity,
    0
  );

  const isDrinkCategory = (category) => {
    const cat = String(category || "").trim().toLowerCase();
    return (
      cat.includes("ichimlik") ||
      cat.includes("drink") ||
      cat.includes("napitok")
    );
  };

  // =========================================================
  // 4. BUYURTMANI SAQLASH / YANGILASH
  // =========================================================
  const handleSubmitOrder = async () => {
    if (!tableNumber) {
      toast.error("Iltimos, stol raqamini kiriting!");
      return;
    }
    if (cart.length === 0) {
      toast.error("Savat bo'sh! Taom tanlang.");
      return;
    }

    setSubmitting(true);

    try {
      const kitchenItems = cart
        .filter((item) => !isDrinkCategory(item.category))
        .map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          quantity: item.quantity,
          category: item.category || "",
          imageUrl: item.imageUrl || "",
          note: item.note || "",
        }));

      const waiterItems = cart
        .filter((item) => isDrinkCategory(item.category))
        .map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          quantity: item.quantity,
          category: item.category || "",
          imageUrl: item.imageUrl || "",
          note: item.note || "",
        }));

      const formattedItems = cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        quantity: item.quantity,
        category: item.category || "",
        imageUrl: item.imageUrl || "",
        note: item.note || "",
      }));

      // Agar ushbu stolda avvaldan buyurtma bo'lsa -> UPDATE qilamiz
      if (existingOrderId) {
        const orderRef = doc(db, "orders", existingOrderId);
        await updateDoc(orderRef, {
          items: formattedItems,
          kitchenItems,
          waiterItems,
          totalPrice,
          kitchenStatus: kitchenItems.length > 0 ? "pending" : "none",
          updatedAt: serverTimestamp(),
        });

        toast.success("🍲 Buyurtma muvaffaqiyatli yangilandi!");
      } else {
        // Yangi stol bo'lsa -> YANGI BUYURTMA ochamiz
        const orderData = {
          cafeId: cafeId || "",
          tableNumber: Number(tableNumber),
          kitchenItems,
          waiterItems,
          items: formattedItems,
          totalPrice,
          paymentStatus: "unpaid",
          kitchenStatus: kitchenItems.length > 0 ? "pending" : "none",
          itemStatuses: kitchenItems.map(() => "pending"),
          createdAt: serverTimestamp(),
          waiterId: currentUser?.uid || "",
          waiterEmail: currentUser?.email || "",
          orderSource: "waiter",
        };

        await addDoc(collection(db, "orders"), orderData);

        toast.success(
          kitchenItems.length > 0
            ? "🍲 Buyurtma oshxonaga yuborildi!"
            : "🥤 Ichimlik buyurtmasi qabul qilindi!"
        );
      }

      setCart([]);
      setIsCartModalOpen(false);
      navigate("/waiter/tables");
    } catch (error) {
      console.error("❌ Xatolik:", error);
      toast.error("Buyurtma yuborilmadi: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === "Barchasi" ||
      String(item.category).trim().toLowerCase() ===
        selectedCategory.trim().toLowerCase();

    const matchesSearch = String(item.name || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans select-none pb-28 antialiased">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex justify-between items-center shadow-xs">
        <button
          onClick={() => navigate("/waiter/tables")}
          className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition active:scale-95"
        >
          ← Stollar
        </button>
      </header>

      {/* ASOSIY QISM */}
      <main className="max-w-md mx-auto sm:max-w-3xl w-full p-3 sm:p-5 flex flex-col gap-3">
        {/* QIDIRUV */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Taom nomini yozing..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* KATEGORIYALAR */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isActive =
              selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                  isActive
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* TAOMLAR RO'YXATI */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm font-semibold">
            Yuklanmoqda...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-400 text-sm border border-slate-200">
            Taom topilmadi
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredItems.map((item) => {
              const qtyInCart = getItemQuantityInCart(item.id);
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl p-2.5 border transition flex flex-col justify-between shadow-2xs relative ${
                    qtyInCart > 0
                      ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                      : "border-slate-200"
                  }`}
                >
                  <div>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-24 object-cover rounded-xl mb-2"
                      />
                    ) : (
                      <div className="w-full h-24 bg-slate-100 rounded-xl mb-2 flex items-center justify-center text-2xl">
                        🍲
                      </div>
                    )}
                    <h3 className="font-bold text-slate-800 text-xs leading-snug truncate">
                      {item.name}
                    </h3>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black text-amber-600">
                      {Number(item.price || 0).toLocaleString()}{" "}
                      <span className="text-[9px] font-normal">so'm</span>
                    </span>

                    {qtyInCart === 0 ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="w-7 h-7 bg-amber-500 text-white rounded-lg font-bold text-base flex items-center justify-center active:scale-90 transition shadow-xs"
                      >
                        +
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-amber-500 text-white rounded-lg p-0.5 shadow-xs">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-xs active:scale-90"
                        >
                          -
                        </button>
                        <span className="text-xs font-black px-1">
                          {qtyInCart}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-xs active:scale-90"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* PASTKI PANEL */}
      {totalCount > 0 && (
        <div className="fixed bottom-3 left-3 right-3 max-w-md mx-auto z-30 animate-slide-up">
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between">
            <div
              onClick={() => setIsCartModalOpen(true)}
              className="flex items-center gap-3 cursor-pointer pl-2"
            >
              <div className="relative">
                <span className="text-2xl">🛒</span>
                <span className="absolute -top-1 -right-2 bg-amber-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                  {totalCount}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Jami ({totalCount} ta)
                </span>
                <span className="text-sm font-extrabold text-amber-400">
                  {totalPrice.toLocaleString()} so'm
                </span>
              </div>
            </div>

            <button
              disabled={submitting}
              onClick={handleSubmitOrder}
              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-1.5"
            >
              {submitting ? (
                "Yuborilmoqda..."
              ) : (
                <>
                  <span>Yuborish</span>
                  <span>🚀</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SAVAT MODALI */}
      {isCartModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col p-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <span>📋 Buyurtma tarkibi</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  Stol №{tableNumber}
                </span>
              </h3>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="w-7 h-7 bg-slate-100 rounded-full font-bold text-slate-500 text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        {item.name}
                      </h4>
                      <span className="text-[11px] font-bold text-amber-600">
                        {(item.price * item.quantity).toLocaleString()} so'm
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-1.5 py-0.5 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="font-bold text-xs text-slate-600 px-1"
                      >
                        -
                      </button>
                      <span className="text-xs font-extrabold w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="font-bold text-xs text-slate-600 px-1"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Izoh (masalan: piyozsiz, sariyog'siz)..."
                    value={item.note || ""}
                    onChange={(e) => updateNote(item.id, e.target.value)}
                    className="mt-2 w-full text-[11px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Jami:</span>
                <span className="text-lg font-black text-amber-600">
                  {totalPrice.toLocaleString()} so'm
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsCartModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-bold text-xs py-3 rounded-xl"
                >
                  Yana taom qo'shish
                </button>
                <button
                  disabled={submitting}
                  onClick={handleSubmitOrder}
                  className="bg-amber-500 text-white font-bold text-xs py-3 rounded-xl shadow-md"
                >
                  {submitting ? "Yuborilmoqda..." : "Saqlash va Yuborish 🚀"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}