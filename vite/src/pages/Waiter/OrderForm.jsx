import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
} from "firebase/firestore";
import { db } from "../../Firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function OrderForm() {
  const { cafeId } = useAuth();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    if (!cafeId) return;

    const q = query(
      collection(db, "menu"),
      where("cafeId", "==", cafeId),
      where("available", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setMenu(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [cafeId]);

  const categories = [
    "all",
    "taom",
    "desert",
    "ichimlik",
    "salat",
    "boshqa",
  ];

  const filteredMenu =
    category === "all"
      ? menu
      : menu.filter((d) => d.category === category);

  const addToCart = (dish) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.id === dish.id
      );

      if (existing) {
        return prev.map((item) =>
          item.id === dish.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [...prev, { ...dish, quantity: 1 }];
    });
  };

  const decreaseQuantity = (dishId) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.id === dishId
      );

      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.id === dishId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        );
      }

      return prev.filter(
        (item) => item.id !== dishId
      );
    });
  };

  const getQuantityInCart = (dishId) => {
    const item = cart.find(
      (i) => i.id === dishId
    );

    return item ? item.quantity : 0;
  };

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const handleSubmitOrder = async () => {
    if (!tableNumber) {
      alert("Iltimos, stol raqamini kiriting");
      return;
    }

    if (cart.length === 0) {
      alert("Iltimos, kamida bitta taom tanlang");
      return;
    }

    setSubmitting(true);

    try {
      await addDoc(collection(db, "orders"), {
        cafeId,
        tableNumber,
        items: cart.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        totalPrice,
        note,
        kitchenStatus: "pending",
        paymentStatus: "unpaid",
        createdAt: new Date(),
      });

      setCart([]);
      setTableNumber("");
      setNote("");
      setShowCart(false);

      alert("Buyurtma muvaffaqiyatli yuborildi!");
    } catch (error) {
      console.error(
        "Buyurtmani yuborishda xatolik:",
        error
      );

      alert(
        "Xatolik yuz berdi, qaytadan urinib ko'ring"
      );
    } finally {
      setSubmitting(false);
    }
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
    <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-bold text-amber-800 mb-4">
        Buyurtma
      </h1>

      {/* Stol raqami */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700">
          Stol raqami
        </label>

        <input
          type="text"
          value={tableNumber}
          onChange={(e) =>
            setTableNumber(e.target.value)
          }
          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          placeholder=""
        />
      </div>

      {/* Kategoriya filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              category === cat
                ? "bg-amber-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {cat === "all" ? "Barchasi" : cat}
          </button>
        ))}
      </div>

      {/* Menyu ro'yxati */}
      {filteredMenu.length === 0 ? (
        <p className="text-gray-400 text-sm">
          Taomlar topilmadi
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredMenu.map((dish) => {
            const qty = getQuantityInCart(dish.id);

            return (
              <div
                key={dish.id}
                className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex"
              >
                <img
                  src={
                    dish.imageUrl ||
                    "/src/assets/placeholders/food-placeholder.jpg"
                  }
                  alt={dish.name}
                  className="w-20 h-20 object-cover"
                />

                <div className="flex-1 p-3 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">
                      {dish.name}
                    </h3>

                    <p className="text-amber-700 font-bold text-sm mt-1">
                      {Number(
                        dish.price
                      ).toLocaleString()}{" "}
                      so'm
                    </p>
                  </div>

                  {qty === 0 ? (
                    <button
                      onClick={() =>
                        addToCart(dish)
                      }
                      className="mt-2 bg-amber-600 text-white text-xs px-3 py-1.5 rounded-md hover:bg-amber-700 transition self-start"
                    >
                      + Qo'shish
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() =>
                          decreaseQuantity(dish.id)
                        }
                        className="w-7 h-7 rounded-md bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition"
                      >
                        −
                      </button>

                      <span className="text-sm font-medium w-5 text-center">
                        {qty}
                      </span>

                      <button
                        onClick={() =>
                          addToCart(dish)
                        }
                        className="w-7 h-7 rounded-md bg-amber-600 text-white font-bold hover:bg-amber-700 transition"
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

      {/* Savat tugmasi */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-40">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold flex justify-between items-center px-4"
          >
            <span>
              {totalItems} ta mahsulot
            </span>

            <span>
              {totalPrice.toLocaleString()} so'm
            </span>
          </button>
        </div>
      )}

      {/* Savat modali */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lg w-full max-w-md p-5 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 text-gray-800">
              Buyurtma tafsilotlari
            </h2>

            <div className="space-y-2 mb-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {item.name}
                    </p>

                    <p className="text-gray-500">
                      {item.price.toLocaleString()} so'm x{" "}
                      {item.quantity}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        decreaseQuantity(item.id)
                      }
                      className="w-6 h-6 rounded-md bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition"
                    >
                      −
                    </button>

                    <span className="w-5 text-center">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() =>
                        addToCart(item)
                      }
                      className="w-6 h-6 rounded-md bg-amber-600 text-white font-bold hover:bg-amber-700 transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Izoh (ixtiyoriy)
              </label>

              <textarea
                value={note}
                onChange={(e) =>
                  setNote(e.target.value)
                }
                rows={2}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Masalan: ziravorsiz tayyorlansin"
              />
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
              <span className="font-semibold text-gray-800">
                Jami:
              </span>

              <span className="font-bold text-amber-700 text-lg">
                {totalPrice.toLocaleString()} so'm
              </span>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSubmitOrder}
                disabled={submitting}
                className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50"
              >
                {submitting
                  ? "Yuborilmoqda..."
                  : "Buyurtmani yuborish"}
              </button>

              <button
                onClick={() =>
                  setShowCart(false)
                }
                className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}