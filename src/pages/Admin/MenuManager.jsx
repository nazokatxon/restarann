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
  uploadBytes,
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
  const found = KITCHEN_TYPES.find(
    (item) => item.value === kitchenType
  );

  return found?.label || "🍲 Umumiy oshpaz";
};

const formatPrice = (price) => {
  return Number(price || 0).toLocaleString("uz-UZ");
};

// =====================================================
// TAOM NOMIGA QARAB RASM TANLASH
// Backend va AI kerak emas.
// =====================================================

const FOOD_IMAGES = {
  // OSH
  osh:
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",

  palov:
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",

  plov:
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",

  pilaf:
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",

  // LAG'MON
  lagmon:
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",

  "lag'mon":
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",

  "lag‘mon":
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",

  lagman:
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",

  // SOMSA
  somsa:
    "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd8?auto=format&fit=crop&w=900&q=80",

  samsa:
    "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd8?auto=format&fit=crop&w=900&q=80",

  // SHASHLIK
  shashlik:
    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=900&q=80",

  kabob:
    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=900&q=80",

  kebab:
    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=900&q=80",

  // BURGER
  burger:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",

  gamburger:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",

  hamburger:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",

  // PIZZA
  pizza:
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",

  // TOVUQ
  tovuq:
    "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=80",

  chicken:
    "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=80",

  // SHO'RVA
  shorva:
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",

  "sho'rva":
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",

  "sho‘rva":
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",

  soup:
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",

  // SALAT
  salat:
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",

  salad:
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",

  cezar:
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",

  "sezar salat":
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",

  // MAKARON
  makaron:
    "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",

  pasta:
    "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",

  spaghetti:
    "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",

  // MANTI
  manti:
    "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=900&q=80",

  manty:
    "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=900&q=80",

  // PISHIRIQ
  tort:
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",

  cake:
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",

  desert:
    "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80",

  pirog:
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",

  // ICHIMLIKLAR
  choy:
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80",

  tea:
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80",

  coffee:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",

  qahva:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",

  cola:
    "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=900&q=80",

  coca:
    "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=900&q=80",

  sharbat:
    "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80",

  juice:
    "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80",
};

// Nomni tozalash
const normalizeFoodName = (name = "") => {
  return name
    .toLowerCase()
    .trim()
    .replace(/['‘’`]/g, "")
    .replace(/\s+/g, " ");
};

// Taom nomidan mos rasm topish
const getFoodImage = (name, category) => {
  const normalizedName = normalizeFoodName(name);

  // Avval aniq nomni qidiramiz
  if (FOOD_IMAGES[normalizedName]) {
    return FOOD_IMAGES[normalizedName];
  }

  // Keyin nom ichidagi kalit so'zlarni qidiramiz
  const foundKey = Object.keys(FOOD_IMAGES).find((key) =>
    normalizedName.includes(normalizeFoodName(key))
  );

  if (foundKey) {
    return FOOD_IMAGES[foundKey];
  }

  // Topilmasa kategoriya rasmi
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

  // =====================================================
  // STATE
  // =====================================================

  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [deleteConfirmItem, setDeleteConfirmItem] =
    useState(null);

  const [saving, setSaving] = useState(false);

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

  // =====================================================
  // FIREBASE REALTIME LISTEN
  // =====================================================

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

  // =====================================================
  // FORM RESET
  // =====================================================

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
    setImageFile(null);

    setImagePreview((oldPreview) => {
      if (oldPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(oldPreview);
      }

      return "";
    });
  };

  // =====================================================
  // ADD MODAL
  // =====================================================

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  // =====================================================
  // EDIT MODAL
  // =====================================================

  const openEditModal = (item) => {
    setEditingItem(item);

    setForm({
      name: item.name || "",
      price:
        item.price !== undefined
          ? String(item.price)
          : "",
      category: item.category || "Taom",
      kitchenType: item.kitchenType || "umumiy",
      imageUrl: item.imageUrl || "",
    });

    setImageFile(null);
    setImagePreview(item.imageUrl || "");
    setModalOpen(true);
  };

  // =====================================================
  // CLOSE MODAL
  // =====================================================

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    resetForm();
  };

  // =====================================================
  // ODDIY RASM TANLASH
  // =====================================================

  const generateSimpleFoodImage = () => {
    const name = form.name.trim();

    if (!name) {
      alert("Avval taom nomini yozing!");
      return;
    }

    const imageUrl = getFoodImage(
      name,
      form.category
    );

    // Oldingi blob preview bo'lsa tozalash
    setImagePreview((oldPreview) => {
      if (oldPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(oldPreview);
      }

      return imageUrl;
    });

    // AI/tayyor rasm ishlatilganda faylni bekor qilamiz
    setImageFile(null);

    // Formga URL saqlaymiz
    setForm((prev) => ({
      ...prev,
      imageUrl,
    }));
  };

  // =====================================================
  // RASM QO'LDA TANLASH
  // =====================================================

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

  // =====================================================
  // FIREBASE STORAGEGA RASM YUKLASH
  // =====================================================

  const uploadImage = async (file) => {
    if (!file) return "";

    const safeName = file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const fileName = `${Date.now()}-${safeName}`;

    const storageRef = ref(
      storage,
      `menu-images/${cafeId}/${fileName}`
    );

    const snapshot = await uploadBytes(
      storageRef,
      file,
      {
        contentType: file.type,
      }
    );

    return await getDownloadURL(snapshot.ref);
  };

  // =====================================================
  // SUBMIT
  // =====================================================

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
      alert(
        "Kafe aniqlanmadi. Qaytadan tizimga kiring."
      );
      return;
    }

    setSaving(true);

    try {
      // Avval formdagi rasm
      let imageUrl = form.imageUrl?.trim() || "";

      // Agar foydalanuvchi fayl tanlagan bo'lsa
      // Firebase Storagega yuklaymiz
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      // Hech qanday rasm bo'lmasa
      // taom nomiga qarab avtomatik tanlaymiz
      if (!imageUrl) {
        imageUrl = getFoodImage(
          name,
          form.category
        );
      }

      const payload = {
        name,
        price,
        category: form.category,
        kitchenType: form.kitchenType,
        imageUrl,
      };

      // EDIT
      if (editingItem) {
        await updateDoc(
          doc(db, "menu", editingItem.id),
          payload
        );
      }

      // ADD
      else {
        await addDoc(
          collection(db, "menu"),
          {
            cafeId,
            ...payload,
            available: true,
            createdAt: new Date(),
          }
        );
      }

      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Saqlashda xatolik:", error);

      alert(
        "Saqlashda xatolik yuz berdi: " +
          (error.message || "Noma'lum xatolik")
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const confirmDeleteMeal = async () => {
    if (!deleteConfirmItem) return;

    try {
      await deleteDoc(
        doc(
          db,
          "menu",
          deleteConfirmItem.id
        )
      );

      setDeleteConfirmItem(null);
    } catch (error) {
      console.error(
        "O'chirishda xatolik:",
        error
      );

      alert("O'chirishda xatolik yuz berdi.");
    }
  };

  // =====================================================
  // SORT
  // =====================================================

  const sortedItems = useMemo(() => {
    return [...menuItems].sort((a, b) =>
      String(a.name || "").localeCompare(
        String(b.name || "")
      )
    );
  }, [menuItems]);

  // =====================================================
  // JSX
  // =====================================================

  return (
    <div className="h-[calc(100vh-68px)] min-h-0 bg-slate-50 text-slate-800 w-full flex flex-col overflow-hidden">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="shrink-0 bg-slate-50 border-b border-slate-200">
        <div className="w-full px-5 sm:px-8 lg:px-10 py-5">
          <div className="flex items-center justify-between gap-4">

            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 flex items-center gap-2">
                <span>📋</span>
                <span>Menyu boshqaruvi</span>
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Kafe menyusidagi taomlarni boshqaring
              </p>
            </div>

            <button
              onClick={openAddModal}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-sm transition cursor-pointer"
            >
              + Yangi Taom
            </button>

          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* MENU LIST */}
      {/* ================================================= */}

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full px-5 sm:px-8 lg:px-10 py-6">

          {/* LOADING */}

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">

                <div className="text-4xl mb-3">
                  ☕
                </div>

                <p className="text-slate-500 font-semibold">
                  Menyu yuklanmoqda...
                </p>

              </div>
            </div>
          )}

          {/* EMPTY */}

          {!loading &&
            sortedItems.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">

                <div className="text-5xl mb-4">
                  🍽️
                </div>

                <h2 className="text-xl font-bold text-slate-800">
                  Hali taomlar qo'shilmagan
                </h2>

                <p className="text-sm text-slate-400 mt-2">
                  Birinchi taomni qo'shish uchun
                  yuqoridagi tugmani bosing.
                </p>

              </div>
            )}

          {/* MENU CARDS */}

          {!loading &&
            sortedItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 pb-8">

                {sortedItems.map((item) => {
                  const category =
                    item.category || "Taom";

                  const kitchenType =
                    item.kitchenType || "umumiy";

                  const image =
                    item.imageUrl ||
                    getFoodImage(
                      item.name,
                      category
                    );

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
                    >

                      {/* IMAGE */}

                      <div className="relative w-full h-52 bg-slate-100 overflow-hidden">

                        <img
                          src={image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              getCategoryImage(
                                category
                              );
                          }}
                        />

                        <div className="absolute top-3 left-3 bg-white px-3 py-1.5 rounded-xl shadow-sm text-xs font-bold text-slate-700">
                          {getCategoryEmoji(category)}
                          {" "}
                          {category}
                        </div>

                      </div>

                      {/* CONTENT */}

                      <div className="p-4 flex flex-col flex-1">

                        <h3 className="font-black text-lg text-slate-900">
                          {item.name}
                        </h3>

                        {/* OSHPAZ */}

                        <div className="mt-2 inline-flex w-fit items-center gap-1 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-xl text-xs font-bold">
                          👨‍🍳{" "}
                          {getKitchenTypeLabel(
                            kitchenType
                          )}
                        </div>

                        {/* PRICE */}

                        <p className="text-amber-600 font-black text-xl mt-3">
                          {formatPrice(item.price)}
                          {" so'm"}
                        </p>

                        {/* BUTTONS */}

                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">

                          <button
                            onClick={() =>
                              openEditModal(item)
                            }
                            className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
                          >
                            ✏️ Tahrirlash
                          </button>

                          <button
                            onClick={() =>
                              setDeleteConfirmItem(
                                item
                              )
                            }
                            className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
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

      {/* ================================================= */}
      {/* ADD / EDIT MODAL */}
      {/* ================================================= */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">

          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

            {/* MODAL HEADER */}

            <div className="p-6 border-b border-slate-100 flex items-center justify-between">

              <h2 className="text-xl font-bold text-slate-900">
                {editingItem
                  ? "✏️ Taomni tahrirlash"
                  : "➕ Yangi taom qo'shish"}
              </h2>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>

            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="p-6 overflow-y-auto flex-1 space-y-4"
            >

              {/* TAOM NOMI */}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Taom nomi *
                </label>

                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  placeholder="Masalan: Osh, Lag'mon, Somsa..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-amber-500 text-sm font-medium"
                />
              </div>

              {/* KATEGORIYA */}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Kategoriya
                </label>

                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-amber-500 text-sm font-medium bg-white"
                >

                  {CATEGORIES.map((cat) => (
                    <option
                      key={cat.value}
                      value={cat.value}
                    >
                      {cat.label}
                    </option>
                  ))}

                </select>
              </div>

              {/* OSHPAZ TURI */}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Oshpaz turi (Bo'limi)
                </label>

                <select
                  value={form.kitchenType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      kitchenType: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-amber-500 text-sm font-medium bg-white"
                >

                  {KITCHEN_TYPES.map((kt) => (
                    <option
                      key={kt.value}
                      value={kt.value}
                    >
                      {kt.label}
                    </option>
                  ))}

                </select>
              </div>

              {/* NARXI */}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Narxi (so'mda) *
                </label>

                <input
                  type="number"
                  required
                  min="0"
                  value={form.price}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      price: e.target.value,
                    })
                  }
                  placeholder="35000"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-amber-500 text-sm font-medium"
                />
              </div>

              {/* ================================================= */}
              {/* TAOM RASMI */}
              {/* ================================================= */}

              <div>

                <label className="block text-xs font-bold text-slate-600 mb-2">
                  Taom rasmi
                </label>

                {/* AVTOMATIK RASM TUGMASI */}

                <button
                  type="button"
                  onClick={generateSimpleFoodImage}
                  className="w-full mb-3 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition cursor-pointer"
                >
                  ✨ Taom nomiga mos rasm chiqarish
                </button>

                <p className="text-xs text-slate-400 mb-3">
                  Masalan: Osh, Lag'mon, Somsa,
                  Shashlik, Burger, Pizza yozib,
                  tugmani bosing.
                </p>

                {/* YOKI O'Z RASMINI TANLASH */}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                />

                {/* PREVIEW */}

                {imagePreview && (
                  <div className="mt-3 relative w-full h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">

                    <img
                      src={imagePreview}
                      alt="Taom preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src =
                          getCategoryImage(
                            form.category
                          );
                      }}
                    />

                    <div className="absolute top-2 left-2 bg-black/60 text-white px-3 py-1 rounded-lg text-xs font-bold">
                      ✓ Rasm tanlandi
                    </div>

                  </div>
                )}

              </div>

              {/* BUTTONS */}

              <div className="pt-4 flex gap-3">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Bekor qilish
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-50"
                >
                  {saving
                    ? "Saqlanmoqda..."
                    : "Saqlash"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* DELETE CONFIRMATION */}
      {/* ================================================= */}

      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">

          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl text-center space-y-4">

            <div className="text-4xl">
              ⚠️
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Ushbu taomni o'chirmoqchimisiz?
            </h3>

            <p className="text-sm text-slate-500">
              <span className="font-bold text-slate-800">
                {deleteConfirmItem.name}
              </span>
              {" "}
              menyudan butunlay o'chiriladi.
            </p>

            <div className="flex gap-3 pt-2">

              <button
                onClick={() =>
                  setDeleteConfirmItem(null)
                }
                className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Yo'q, bekor qilish
              </button>

              <button
                onClick={confirmDeleteMeal}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold"
              >
                Ha, o'chirish
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}