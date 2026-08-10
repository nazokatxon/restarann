import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

export default function AdminMenu() {
  const { cafeId, currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Chiqish va O'chirish uchun maxsus modal holatlari
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "Taom",
    imageUrl: "",
  });

  // TIZIMDAN CHIQISH FUNKSIYASI
  const confirmLogout = async () => {
    try {
      if (logout) await logout();
      navigate("/login");
    } catch (error) {
      console.error("Chiqishda xatolik:", error);
    } finally {
      setLogoutModalOpen(false);
    }
  };

  useEffect(() => {
    if (!cafeId) return;

    const q = query(collection(db, "menu"), where("cafeId", "==", cafeId));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setMenuItems(items);
      setLoading(false);
    });

    return () => unsub();
  }, [cafeId]);

  const resetForm = () => {
    setForm({ name: "", price: "", category: "Taom", imageUrl: "" });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      price: item.price || "",
      category: item.category || "Taom",
      imageUrl: item.imageUrl || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      alert("Iltimos, nom va narxni kiriting!");
      return;
    }

    try {
      if (editingItem) {
        await updateDoc(doc(db, "menu", editingItem.id), {
          name: form.name,
          price: Number(form.price),
          category: form.category || "Taom",
          imageUrl: form.imageUrl || "",
        });
      } else {
        await addDoc(collection(db, "menu"), {
          cafeId,
          name: form.name,
          price: Number(form.price),
          category: form.category || "Taom",
          imageUrl: form.imageUrl || "",
          available: true,
          createdAt: new Date(),
        });
      }

      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Saqlashda xatolik:", error);
    }
  };

  const confirmDeleteMeal = async () => {
    if (!deleteConfirmItem) return;
    try {
      await deleteDoc(doc(db, "menu", deleteConfirmItem.id));
    } catch (error) {
      console.error("O'chirishda xatolik:", error);
    } finally {
      setDeleteConfirmItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 w-full flex flex-col font-sans">
      {/* HEADER / NAVBAR */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sm:px-8 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">👑</span>
          <span className="font-bold text-lg text-slate-900">Control Hub</span>
          <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded uppercase">
            Admin
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">
            {currentUser?.email || "Admin"}
          </span>

          <button
            onClick={() => setLogoutModalOpen(true)}
            className="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Chiqish
          </button>
        </div>
      </header>

      {/* ASOSIY KONTENT */}
      <main className="max-w-5xl w-full mx-auto p-4 sm:p-6 flex-1">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            📋 Menyu boshqaruvi
          </h1>
          <button
            onClick={openAddModal}
            className="bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition shadow-sm cursor-pointer"
          >
            + Yangi Taom
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Yuklanmoqda...</div>
        ) : menuItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
            Hali taomlar qo'shilmagan
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-36 object-cover rounded-xl mb-3"
                    />
                  ) : (
                    <div className="w-full h-36 bg-slate-100 rounded-xl mb-3 flex items-center justify-center text-3xl">
                      🍲
                    </div>
                  )}
                  <h3 className="font-bold text-slate-800 text-base">
                    {item.name}
                  </h3>
                  <span className="text-xs text-slate-400 font-medium block mt-0.5">
                    {item.category || "Taom"}
                  </span>
                  <p className="text-amber-600 font-extrabold text-lg mt-2">
                    {Number(item.price).toLocaleString()} so'm
                  </p>
                </div>

                <div className="flex gap-2 pt-4 mt-2 border-t border-slate-100">
                  <button
                    onClick={() => openEditModal(item)}
                    className="flex-1 bg-amber-50 text-amber-700 py-2 rounded-xl text-xs font-semibold hover:bg-amber-100 transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    ✏️ Tahrirlash
                  </button>
                  <button
                    onClick={() => setDeleteConfirmItem(item)}
                    className="flex-1 bg-red-50 text-red-600 py-2 rounded-xl text-xs font-semibold hover:bg-red-100 transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    🗑️ O'chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* TAOM QO'SHISH / TAHRIRLASH MODALI */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4 text-slate-800">
              {editingItem ? "Taomni tahrirlash" : "Yangi taom qo'shish"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Taom nomi
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-800"
                  placeholder="Masalan: Somsa"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Narxi (so'm)
                </label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-800"
                  placeholder="Masalan: 15000"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Kategoriya
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-800"
                  placeholder="Taom, Salat, Ichimlik va h.k."
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Rasm havolasi (URL)
                </label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-800"
                  placeholder="https://..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition cursor-pointer"
                >
                  {editingItem ? "Yangilash" : "Saqlash"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHIQUVCHI ZAMONAVIY CHIQISH (LOGOUT) MODAL OYNASI */}
      {logoutModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
              🚪
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              Tizimdan chiqmoqchimisiz?
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Hisobingizdan chiqib ketasiz va qayta kirish talab etiladi.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmLogout}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition cursor-pointer"
              >
                Ha, Chiqish
              </button>
              <button
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAOMNI O'CHIRISH TASDIQLASH MODALI */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              Taomni o'chirish
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Siz rostdan ham <strong>"{deleteConfirmItem.name}"</strong> taomini o'chirmoqchimisiz?
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmDeleteMeal}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition cursor-pointer"
              >
                O'chirish
              </button>
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}