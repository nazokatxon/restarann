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
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import {
  Image as LucideImage,
  Plus,
  Trash2,
  Edit,
  ClipboardList,
  PlusCircle,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
  ImageOff,
  Sparkles,
} from "lucide-react";

// Taom nomida uchraydigan kalit so'zlarga qarab mos rasm tanlash uchun bank.
// Har bir kalit so'z ostida bir nechta sifatli Unsplash rasmi bor — shunda
// bir xil nomdagi taomlar ham har doim bitta rasmga qotib qolmaydi.
const DISH_IMAGE_BANK = {
  osh: [
    "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&auto=format&fit=crop&q=70",
  ],
  palov: [
    "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&auto=format&fit=crop&q=60",
  ],
  somsa: [
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=60",
  ],
  samsa: [
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=60",
  ],
  shashlik: [
    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&auto=format&fit=crop&q=60",
  ],
  kabob: [
    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&auto=format&fit=crop&q=60",
  ],
  manti: [
    "https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=400&auto=format&fit=crop&q=60",
  ],
  lag_mon: [
    "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&auto=format&fit=crop&q=60",
  ],
  lagmon: [
    "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&auto=format&fit=crop&q=60",
  ],
  norin: [
    "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&auto=format&fit=crop&q=60",
  ],
  salat: [
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&auto=format&fit=crop&q=60",
  ],
  non: [
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=60",
  ],
  choy: [
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop&q=60",
  ],
  choy_kok: [
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop&q=60",
  ],
  sharbat: [
    "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&auto=format&fit=crop&q=60",
  ],
  tort: [
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=60",
  ],
  desert: [
    "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&auto=format&fit=crop&q=60",
  ],
};

// Kategoriya bo'yicha umumiy zaxira rasmlar (nomga mos kalit so'z topilmasa ishlatiladi)
const CATEGORY_FALLBACK_IMAGES = {
  taom: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60",
  desert: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&auto=format&fit=crop&q=60",
  ichimlik: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop&q=60",
  salat: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&auto=format&fit=crop&q=60",
  boshqa: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60",
};

// Taom nomiga qarab eng mos rasmni tanlaydi.
// 1) Avval nomdagi so'zlar DISH_IMAGE_BANK kalitlariga solishtiriladi
// 2) Topilmasa, kategoriya bo'yicha umumiy zaxira rasm qaytariladi
function suggestImageForDish(name, category) {
  const normalized = (name || "")
    .toLowerCase()
    .replace(/[^a-zа-яʻʼ\s]/gi, " ")
    .trim();

  for (const keyword of Object.keys(DISH_IMAGE_BANK)) {
    const searchKey = keyword.replace(/_/g, " ");
    if (normalized.includes(searchKey) || normalized.includes(keyword)) {
      const options = DISH_IMAGE_BANK[keyword];
      return options[Math.floor(Math.random() * options.length)];
    }
  }

  return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.taom;
}

export default function MenuManager() {
  const { cafeId } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [fileError, setFileError] = useState("");

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

    const q = query(collection(db, "menu"), where("cafeId", "==", cafeId));

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
    setFileError("");
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
    setFileError("");
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setFileError("Rasm hajmi juda katta! Iltimos, 1 MB dan kichik rasm yuklang.");
      // Inputni tozalaymiz — aks holda eski (noto'g'ri) tanlov ko'rinmasdan qolib ketadi
      e.target.value = "";
      return;
    }

    setFileError("");
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        imageUrl: reader.result,
      }));
    };
    reader.readAsDataURL(file);
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
      // Agar foydalanuvchi hech qanday rasm tanlamagan bo'lsa, taom nomiga
      // mos (yoki kategoriya bo'yicha) rasmni avtomatik tayinlaymiz —
      // shunda barcha taomlar bir xil tashqi rasmga qotib qolmaydi.
      imageUrl: form.imageUrl || suggestImageForDish(form.name, form.category),
      available: form.available,
    };

    try {
      if (editingDish) {
        await updateDoc(doc(db, "menu", editingDish.id), dishData);
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
    if (!window.confirm("Bu taomni o'chirishga ishonchingiz komilmi?")) return;
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

  const categories = ["taom", "desert", "ichimlik", "salat", "boshqa"];

  // Barcha modal inputlar uchun umumiy klass — och fon, to'q matn,
  // yorqin fokus halqasi va yengil soyasi bilan
  const inputClass =
    "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder:text-gray-400 shadow-sm transition-all duration-150 focus:outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <RefreshCw className="text-gray-400 w-5 h-5 animate-spin" />
        <p className="text-gray-500 text-sm font-medium">Loyha menyusi yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto bg-[#FDFBF7] min-h-screen pb-24">
      {/* Sarlavha paneli */}
      <div className="flex items-center justify-between mb-6 border-b-2 border-[#D4AF37] pb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="text-[#8B4513] w-6 h-6" />
          <h1 className="text-xl font-bold text-[#8B4513]">Menyu boshqaruvi</h1>
        </div>
        <button
          onClick={openAddModal}
          className="bg-[#B22222] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#8B0000] active:scale-95 transition-all shadow-md shadow-red-900/20 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi Taom</span>
        </button>
      </div>

      {/* Taomlar ro'yxati */}
      {dishes.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-xl border border-dashed flex flex-col items-center justify-center gap-2">
          <FileText className="text-gray-300 w-8 h-8" />
          <p className="text-gray-400 text-sm">Hozircha menyuda taomlar mavjud emas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {dishes.map((dish) => (
            <div
              key={dish.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex transition-all hover:shadow-md"
            >
              {/* Har bir taomga o'zining rasmi, yo'q bo'lsa neytral
                  "rasm yo'q" belgisi — bir xil tashqi rasm ishlatilmaydi */}
              {dish.imageUrl ? (
                <img
                  src={dish.imageUrl}
                  alt={dish.name}
                  className="w-24 h-full object-cover bg-gray-50 min-h-[100px]"
                />
              ) : (
                <div className="w-24 min-h-[100px] bg-gray-50 flex flex-col items-center justify-center gap-1 shrink-0">
                  <ImageOff className="w-5 h-5 text-gray-300" />
                  <span className="text-[9px] text-gray-300 font-medium">Rasm yo'q</span>
                </div>
              )}
              <div className="flex-1 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-1">
                    <h3 className="font-bold text-gray-800 text-sm line-clamp-1">{dish.name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                        dish.available
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {dish.available ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          <span>Mavjud</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          <span>Tugagan</span>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 capitalize mt-0.5">{dish.category}</p>
                  <p className="text-[#B22222] font-extrabold text-sm mt-1">
                    {Number(dish.price).toLocaleString()} so'm
                  </p>
                </div>

                <div className="flex gap-1.5 mt-3 pt-2 border-t border-gray-50">
                  <button
                    onClick={() => openEditModal(dish)}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-gray-600 transition flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Tahrirlash</span>
                  </button>
                  <button
                    onClick={() => toggleAvailability(dish)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition ${
                      dish.available
                        ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                        : "border-blue-200 text-blue-700 hover:bg-blue-50"
                    }`}
                  >
                    {dish.available ? "Tugatish" : "Tiklash"}
                  </button>
                  <button
                    onClick={() => handleDelete(dish.id)}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 font-medium transition ml-auto flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>O'chirish</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal oyna — soyali, yorqin uslub */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 w-full max-w-md p-5 max-h-[90vh] overflow-y-auto border border-gray-100 animate-[slideDown_0.25s_ease-out]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                {editingDish ? (
                  <>
                    <Edit className="text-[#8B4513] w-4 h-4" />
                    Taomni tahrirlash
                  </>
                ) : (
                  <>
                    <PlusCircle className="text-[#8B4513] w-4 h-4" />
                    Yangi taom qo'shish
                  </>
                )}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Taom nomi</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Masalan: Somsa, Shashlik"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Kategoriya</label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className={`${inputClass} capitalize`}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Narxi (so'm)</label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="35000"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Tavsif (ixtiyoriy)</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  className={inputClass}
                  placeholder="Taom tarkibi haqida ma'lumot..."
                />
              </div>

              {/* Rasm yuklash bo'limi */}
              <div className="border border-dashed border-gray-200 rounded-xl p-3 bg-gray-50/60">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-2 cursor-pointer">
                    <LucideImage size={16} className="text-gray-500" />
                    <span>Rasm yuklash (Galereyadan)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.name.trim()) {
                        setFileError("Avval taom nomini kiriting, shundan keyin mos rasm topamiz.");
                        return;
                      }
                      setFileError("");
                      setForm((prev) => ({
                        ...prev,
                        imageUrl: suggestImageForDish(form.name, form.category),
                      }));
                    }}
                    className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#8B4513] bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Nomiga mos rasm topish</span>
                  </button>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                />

                {fileError && (
                  <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 mt-2">
                    {fileError}
                  </p>
                )}

                <div className="text-center my-2 text-[10px] text-gray-400 font-bold">
                  — YOKI LINK QO'YISH —
                </div>

                <input
                  type="text"
                  name="imageUrl"
                  value={form.imageUrl && !form.imageUrl.startsWith("data:image") ? form.imageUrl : ""}
                  onChange={handleChange}
                  className={`${inputClass} py-1.5 text-xs`}
                  placeholder="https://images.unsplash.com/... (ixtiyoriy)"
                />

                {/* Tanlangan rasmning kichik ko'rinishi (Preview) + tozalash tugmasi */}
                {form.imageUrl ? (
                  <div className="mt-2 flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm">
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded-md shrink-0"
                    />
                    <span className="text-[10px] text-green-600 font-medium flex-1">
                      Rasm muvaffaqiyatli tanlandi!
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))}
                      className="text-gray-400 hover:text-red-500 transition p-1"
                      title="Rasmni olib tashlash"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 text-gray-400">
                    <ImageOff className="w-4 h-4 shrink-0" />
                    <span className="text-[10px]">Hozircha rasm tanlanmagan</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  name="available"
                  checked={form.available}
                  onChange={handleChange}
                  id="available"
                  className="w-4 h-4 accent-[#B22222]"
                />
                <label htmlFor="available" className="text-xs font-medium text-gray-700 select-none">
                  Ushbu taom hozir sotuvda mavjud
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  type="submit"
                  className="flex-1 bg-[#B22222] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-[#8B0000] active:scale-95 transition-all shadow-md shadow-red-900/20"
                >
                  Saqlash
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 border border-gray-200 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 text-gray-500 transition active:scale-95"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}