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
import { db } from "../../Firebase/config";
import { useAuth } from "../../context/AuthContext";

export default function MenuManager() {
  const { cafeId } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);

  const [form, setForm] = useState({
    name: "",
    category: "taom",
    price: "",
    description: "",
    imageUrl: "",
    available: true,
  });

  useEffect(() => {
    if (!cafeId) return;

    const q = query(
      collection(db, "menu"),
      where("cafeId", "==", cafeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setDishes(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [cafeId]);

  const resetForm = () => {
    setForm({
      name: "",
      category: "taom",
      price: "",
      description: "",
      imageUrl: "",
      available: true,
    });

    setEditingDish(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (dish) => {
    setForm({
      name: dish.name || "",
      category: dish.category || "taom",
      price: dish.price || "",
      description: dish.description || "",
      imageUrl: dish.imageUrl || "",
      available: dish.available ?? true,
    });

    setEditingDish(dish);
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.price) {
      alert("Iltimos, taom nomi va narxini kiriting");
      return;
    }

    const dishData = {
      cafeId,
      name: form.name,
      category: form.category,
      price: Number(form.price),
      description: form.description,
      imageUrl: form.imageUrl,
      available: form.available,
    };

    try {
      if (editingDish) {
        await updateDoc(
          doc(db, "menu", editingDish.id),
          dishData
        );
      } else {
        await addDoc(collection(db, "menu"), {
          ...dishData,
          createdAt: new Date(),
        });
      }

      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Taomni saqlashda xatolik:", error);
      alert("Xatolik yuz berdi, qaytadan urinib ko'ring");
    }
  };

  const handleDelete = async (dishId) => {
    if (
      !window.confirm(
        "Bu taomni o'chirishga ishonchingiz komilmi?"
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "menu", dishId));
    } catch (error) {
      console.error("Taomni o'chirishda xatolik:", error);
    }
  };

  const toggleAvailability = async (dish) => {
    try {
      await updateDoc(doc(db, "menu", dish.id), {
        available: !dish.available,
      });
    } catch (error) {
      console.error("Holatni yangilashda xatolik:", error);
    }
  };

  const categories = [
    "taom",
    "desert",
    "ichimlik",
    "salat",
    "boshqa",
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-amber-600 font-semibold text-lg animate-pulse">
          Yuklanmoqda...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 border-b pb-4 border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Menyu boshqaruvi
          </h1>
          <p className="text-sm text-gray-500">
            Barcha taomlarni boshqarish va yangilarini qo'shish
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 active:scale-95 transition-all shadow-md shadow-amber-600/20"
        >
          + Taom qo'shish
        </button>
      </div>

      {dishes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <p className="text-gray-500 font-medium">
            Hozircha hech qanday taom qo'shilmagan.
          </p>
          <button
            onClick={openAddModal}
            className="mt-3 text-sm text-amber-600 font-semibold hover:underline"
          >
            Birinchi taomni qo'shing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dishes.map((dish) => (
            <div
              key={dish.id}
              className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden flex transition-all duration-200"
            >
              <div className="w-28 h-28 sm:w-32 sm:h-32 bg-gray-100 flex-shrink-0 relative">
                <img
                  src={
                    dish.imageUrl ||
                    "https://via.placeholder.com/150?text=Food"
                  }
                  alt={dish.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-gray-800 line-clamp-1">
                      {dish.name}
                    </h3>

                    <span
                      className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                        dish.available
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : "bg-rose-50 text-rose-600 border border-rose-200"
                      }`}
                    >
                      {dish.available ? "Mavjud" : "Tugagan"}
                    </span>
                  </div>

                  <p className="text-xs text-amber-600 font-medium capitalize mt-0.5">
                    {dish.category}
                  </p>

                  <p className="text-gray-900 font-extrabold mt-1 text-base">
                    {Number(dish.price).toLocaleString()} <span className="text-xs font-normal text-gray-500">so'm</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(dish)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
                  >
                    Tahrirlash
                  </button>

                  <button
                    onClick={() => toggleAvailability(dish)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
                  >
                    {dish.available ? "Tugatish" : "Qaytarish"}
                  </button>

                  <button
                    onClick={() => handleDelete(dish.id)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50 transition ml-auto"
                  >
                    O'chirish
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3 border-gray-100">
              {editingDish ? "Taomni tahrirlash" : "Yangi taom qo'shish"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Taom nomi
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  placeholder="Masalan: Lavash"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Kategoriya
                  </label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition bg-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Narxi (so'm)
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                    placeholder="35000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Tavsif
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none"
                  placeholder="Qisqacha tarkibi yoki tavsifi"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Rasm URL manzili
                </label>
                <input
                  type="text"
                  name="imageUrl"
                  value={form.imageUrl}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  name="available"
                  checked={form.available}
                  onChange={handleChange}
                  id="available"
                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                />
                <label
                  htmlFor="available"
                  className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                >
                  Mavjud (sotuvda bor)
                </label>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
                >
                  Bekor qilish
                </button>

                <button
                  type="submit"
                  className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition shadow-md shadow-amber-600/20"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}