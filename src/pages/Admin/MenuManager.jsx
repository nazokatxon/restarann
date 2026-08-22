import React, { useEffect, useMemo, useState } from "react";
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
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";

// =====================================================
// KATEGORIYALAR
// =====================================================

const CATEGORIES = [
  {
    value: "Taom",
    label: "🍲 Taom",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  },
  {
    value: "Salat",
    label: "🥗 Salat",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  },
  {
    value: "Ichimlik",
    label: "🥤 Ichimlik",
    image:
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80",
  },
  {
    value: "Desert",
    label: "🍰 Desert",
    image:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80",
  },
];

// =====================================================
// OSHPAZ TURLARI
// =====================================================

const KITCHEN_TYPES = [
  { value: "umumiy", label: "🍲 Umumiy oshpaz" },
  { value: "salatchi", label: "🥗 Salatchi" },
  { value: "somsachi", label: "🥟 Somsachi" },
  { value: "shashlikchi", label: "🍢 Shashlikchi" },
  { value: "pishiriqchi", label: "🥐 Pishiriqchi" },
  { value: "ichimlikchi", label: "🥤 Ichimlikchi" },
];

// =====================================================
// YORDAMCHI FUNKSIYALAR
// =====================================================

const getCategoryImage = (category) => {
  const found = CATEGORIES.find((item) => item.value === category);
  return found?.image || CATEGORIES[0].image;
};

const getCategoryEmoji = (category) => {
  switch (category) {
    case "Salat":
      return "🥗";
    case "Ichimlik":
      return "🥤";
    case "Desert":
      return "🍰";
    default:
      return "🍲";
  }
};

const getKitchenTypeLabel = (kitchenType) => {
  const found = KITCHEN_TYPES.find((item) => item.value === kitchenType);
  return found?.label || "🍲 Umumiy oshpaz";
};

const formatPrice = (price) => {
  return Number(price || 0).toLocaleString("uz-UZ");
};

// =====================================================
// TAOM NOMIGA QARAB RASM TANLASH
// =====================================================

const FOOD_IMAGES = {
  osh: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  palov: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  plov: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  pilaf: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  lagmon: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
  "lag'mon": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
  "lag‘mon": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
  lagman: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
  somsa: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd8?auto=format&fit=crop&w=900&q=80",
  samsa: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd8?auto=format&fit=crop&w=900&q=80",
  shashlik: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=900&q=80",
  kabob: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=900&q=80",
  kebab: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=900&q=80",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  gamburger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  hamburger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
  tovuq: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=80",
  chicken: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=80",
  shorva: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  "sho'rva": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  "sho‘rva": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  soup: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  salat: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  cezar: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  "sezar salat": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  makaron: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",
  pasta: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",
  spaghetti: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",
  manti: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=900&q=80",
  manty: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=900&q=80",
  tort: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
  cake: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
  desert: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80",
  pirog: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
  choy: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80",
  tea: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80",
  coffee: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  qahva: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  cola: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=900&q=80",
  coca: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=900&q=80",
  sharbat: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80",
  juice: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80",
};

const normalizeFoodName = (name = "") => {
  return name.toLowerCase().trim().replace(/['‘’`]/g, "").replace(/\s+/g, " ");
};

const getFoodImage = (name, category) => {
  const normalizedName = normalizeFoodName(name);

  if (FOOD_IMAGES[normalizedName]) {
    return FOOD_IMAGES[normalizedName];
  }

  const foundKey = Object.keys(FOOD_IMAGES).find((key) =>
    normalizedName.includes(normalizeFoodName(key))
  );

  if (foundKey) {
    return FOOD_IMAGES[foundKey];
  }

  return getCategoryImage(category);
};

// =====================================================
// FIREBASE STORAGE
// =====================================================

const storage = getStorage();

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function MenuManager() {
  const { cafeId } = useAuth();

  // STATE
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Rasm state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Form
  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "Taom",
    kitchenType: "umumiy",
    imageUrl: "",
  });

  // REALTIME LISTEN
  useEffect(() => {
    if (!cafeId) {
      setMenuItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const menuQuery = query(
      collection(db, "menu"),
      where("cafeId", "==", cafeId)
    );

    const unsubscribe = onSnapshot(
      menuQuery,
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setMenuItems(items);
        setLoading(false);
      },
      (error) => {
        console.error("Menyu yuklashda xatolik:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [cafeId]);

  // RESET FORM
  const resetForm = () => {
    setForm({
      name: "",
      price: "",
      category: "Taom",
      kitchenType: "umumiy",
      imageUrl: "",
    });

    setEditingItem(null);
    setSaving(false);
    setUploadingImage(false);
    setImageFile(null);

    setImagePreview((oldPreview) => {
      if (oldPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(oldPreview);
      }
      return "";
    });
  };

  // MODAL HANDLERS
  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      price: item.price !== undefined ? String(item.price) : "",
      category: item.category || "Taom",
      kitchenType: item.kitchenType || "umumiy",
      imageUrl: item.imageUrl || "",
    });

    setImageFile(null);
    setImagePreview(item.imageUrl || "");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || uploadingImage) return;
    setModalOpen(false);
    resetForm();
  };

  // RASM TANLASH FUNKSIYALARI
  const generateSimpleFoodImage = () => {
    const name = form.name.trim();

    if (!name) {
      alert("Avval taom nomini yozing!");
      return;
    }

    const imageUrl = getFoodImage(name, form.category);

    setImagePreview((oldPreview) => {
      if (oldPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(oldPreview);
      }
      return imageUrl;
    });

    setImageFile(null);
    setForm((prev) => ({ ...prev, imageUrl }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Iltimos, faqat rasm faylini tanlang.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Rasm hajmi 5 MB dan katta bo'lmasin.");
      e.target.value = "";
      return;
    }

    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);

    setImagePreview((oldPreview) => {
      if (oldPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(oldPreview);
      }
      return previewUrl;
    });
  };

  // UPLOAD TO STORAGE
  const uploadImage = async (file) => {
    if (!file) return "";

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${Date.now()}-${safeName}`;
    const storageRef = ref(storage, `menu-images/${cafeId}/${fileName}`);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      let finished = false;

      const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        try {
          uploadTask.cancel();
        } catch (cancelError) {
          console.error("Upload cancel xatoligi:", cancelError);
        }
        reject(
          new Error(
            "Rasmni yuklash juda uzoq davom etdi. Internet yoki Firebase Storage sozlamalarini tekshiring."
          )
        );
      }, 60000);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Rasm yuklanmoqda: ${Math.round(progress)}%`);
        },
        (error) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          console.error("Firebase Storage rasm yuklash xatosi:", error);
          reject(error);
        },
        async () => {
          if (finished) return;
          try {
            finished = true;
            clearTimeout(timeout);
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (error) {
            finished = true;
            clearTimeout(timeout);
            console.error("Rasm URL olishda xatolik:", error);
            reject(error);
          }
        }
      );
    });
  };

  // SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = form.name.trim();
    const price = Number(form.price);

    if (!name) {
      alert("Iltimos, taom nomini kiriting!");
      return;
    }

    if (!form.price || price <= 0) {
      alert("Iltimos, to'g'ri narx kiriting!");
      return;
    }

    if (!cafeId) {
      alert("Kafe aniqlanmadi. Qaytadan tizimga kiring.");
      return;
    }

    setSaving(true);

    try {
      let imageUrl = form.imageUrl?.trim() || "";

      if (imageFile) {
        setUploadingImage(true);
        imageUrl = await uploadImage(imageFile);
        setUploadingImage(false);
      }

      if (!imageUrl) {
        imageUrl = getFoodImage(name, form.category);
      }

      const payload = {
        name,
        price,
        category: form.category,
        kitchenType: form.kitchenType,
        imageUrl,
      };

      if (editingItem) {
        await updateDoc(doc(db, "menu", editingItem.id), payload);
      } else {
        await addDoc(collection(db, "menu"), {
          cafeId,
          ...payload,
          available: true,
          createdAt: new Date(),
        });
      }

      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Saqlashda xatolik:", error);

      let errorMessage = "Saqlashda xatolik yuz berdi.";
      if (error?.code === "storage/unauthorized") {
        errorMessage = "Firebase Storage uchun ruxsat yo'q. Storage Rules ni tekshiring.";
      } else if (error?.code === "storage/canceled") {
        errorMessage = "Rasm yuklash bekor qilindi.";
      } else if (error?.code === "storage/quota-exceeded") {
        errorMessage = "Firebase Storage xotirasi limiti tugagan.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  // DELETE
  const confirmDeleteMeal = async () => {
    if (!deleteConfirmItem) return;

    try {
      await deleteDoc(doc(db, "menu", deleteConfirmItem.id));
      setDeleteConfirmItem(null);
    } catch (error) {
      console.error("O'chirishda xatolik:", error);
      alert("O'chirishda xatolik yuz berdi.");
    }
  };

  // SORT
  const sortedItems = useMemo(() => {
    return [...menuItems].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [menuItems]);

  return (
    <div className="h-[calc(100vh-68px)] min-h-0 bg-slate-50 text-slate-800 w-full flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="w-full px-5 sm:px-8 lg:px-10 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 shadow-sm">
                  📋
                </span>
                <span>Menyu boshqaruvi</span>
              </h1>
              <p className="mt-2 ml-1 text-sm text-slate-500 font-medium">
                Kafe menyusidagi taomlarni boshqaring
              </p>
            </div>

            <button
              onClick={openAddModal}
              className="group shrink-0 relative overflow-hidden flex items-center gap-2 bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 hover:from-amber-500 hover:via-orange-600 hover:to-orange-700 text-white px-6 py-3.5 rounded-2xl text-sm font-black tracking-wide shadow-lg shadow-orange-200/60 hover:shadow-xl hover:shadow-orange-300/70 transition-all duration-300 hover:-translate-y-1 active:translate-y-0 active:scale-95 cursor-pointer"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 group-hover:bg-white/30 text-white text-lg font-black transition-all duration-300 group-hover:rotate-90">
                +
              </span>
              <span>Yangi Taom</span>
            </button>
          </div>
        </div>
      </div>

      {/* MENU LIST */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full px-5 sm:px-8 lg:px-10 py-7">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-4xl mb-3">☕</div>
                <p className="text-slate-500 font-semibold">
                  Menyu yuklanmoqda...
                </p>
              </div>
            </div>
          )}

          {!loading && sortedItems.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm">
              <div className="text-5xl mb-4">🍽️</div>
              <h2 className="text-xl font-bold text-slate-800">
                Hali taomlar qo'shilmagan
              </h2>
              <p className="text-sm text-slate-400 mt-2">
                Birinchi taomni qo'shish uchun yuqoridagi tugmani bosing.
              </p>
            </div>
          )}

          {!loading && sortedItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-8">
              {sortedItems.map((item) => {
                const category = item.category || "Taom";
                const kitchenType = item.kitchenType || "umumiy";
                const image =
                  item.imageUrl || getFoodImage(item.name, category);

                return (
                  <div
                    key={item.id}
                    className="group bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-2xl hover:shadow-slate-200/70 overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* IMAGE */}
                    <div className="relative w-full h-56 bg-slate-100 overflow-hidden">
                      <img
                        src={image}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = getCategoryImage(category);
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg text-xs font-extrabold text-slate-700 border border-white">
                        {getCategoryEmoji(category)} {category}
                      </div>
                    </div>

                    {/* CONTENT */}
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-black text-xl text-slate-900 tracking-tight">
                        {item.name}
                      </h3>

                      <div className="mt-2.5 inline-flex w-fit items-center gap-1.5 bg-orange-50/80 border border-orange-100 text-orange-800 px-3 py-1.5 rounded-xl text-xs font-extrabold">
                        👨‍🍳 {getKitchenTypeLabel(kitchenType)}
                      </div>

                      <p className="text-amber-600 font-black text-2xl mt-4">
                        {formatPrice(item.price)} <span className="text-sm font-bold text-amber-600/80">so'm</span>
                      </p>

                      <div className="flex gap-2.5 mt-5 pt-4 border-t border-slate-100">
                        <button
                          onClick={() => openEditModal(item)}
                          className="flex-1 bg-amber-50 hover:bg-amber-100/80 text-amber-800 py-3 rounded-2xl text-xs font-black tracking-wide transition cursor-pointer"
                        >
                          ✏️ Tahrirlash
                        </button>
                        <button
                          onClick={() => setDeleteConfirmItem(item)}
                          className="flex-1 bg-red-50 hover:bg-red-100/80 text-red-600 py-3 rounded-2xl text-xs font-black tracking-wide transition cursor-pointer"
                        >
                          🗑️ O'chirish
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingItem ? "✏️ Taomni tahrirlash" : "➕ Yangi taom qo'shish"}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Taom nomi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: OSH, Lag'mon..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Narxi (so'm)
                </label>
                <input
                  type="number"
                  required
                  placeholder="35000"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Kategoriya
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Oshpaz turi
                  </label>
                  <select
                    value={form.kitchenType}
                    onChange={(e) => setForm({ ...form, kitchenType: e.target.value })}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold bg-white"
                  >
                    {KITCHEN_TYPES.map((kt) => (
                      <option key={kt.value} value={kt.value}>
                        {kt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* RASM TANLASH BO'LIMI */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                  Taom rasmi
                </label>

                {imagePreview && (
                  <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-slate-100 mb-3 border border-slate-200">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <label className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-3 rounded-xl cursor-pointer text-center transition">
                    📁 Fayl tanlash
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={generateSimpleFoodImage}
                    className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs py-3 px-3 rounded-xl transition cursor-pointer"
                  >
                    ✨ Avto rasm tanlash
                  </button>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl text-sm transition cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
                >
                  {saving || uploadingImage ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 text-center shadow-2xl space-y-4">
            <div className="text-4xl">⚠️</div>
            <h3 className="text-lg font-bold text-slate-900">
              Taomni o'chirishni tasdiqlaysizmi?
            </h3>
            <p className="text-sm text-slate-500 font-medium">
              "{deleteConfirmItem.name}" menyudan butunlay o'chiriladi.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-sm transition cursor-pointer"
              >
                Yo'q, qolsin
              </button>
              <button
                onClick={confirmDeleteMeal}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl text-sm transition cursor-pointer"
              >
                Ha, o'chirilsin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}