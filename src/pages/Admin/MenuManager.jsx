import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

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


// =====================================================
// KATEGORIYALAR
// =====================================================

const CATEGORIES = [
  {
    value: "Taom",
    label: "🍲  Taom",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  },

  {
    value: "Salat",
    label: "🥗  Salat",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  },

  {
    value: "Ichimlik",
    label: "🥤  Ichimlik",
    image:
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80",
  },

  {
    value: "Desert",
    label: "🍰  Desert",
    image:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80",
  },
];


// =====================================================
// OSHPAZ TURLARI
// =====================================================

const KITCHEN_TYPES = [
  {
    value: "umumiy",
    label: "🍲 Umumiy oshpaz",
  },

  {
    value: "salatchi",
    label: "🥗 Salatchi",
  },

  {
    value: "somsachi",
    label: "🥟 Somsachi",
  },

  {
    value: "shashlikchi",
    label: "🍢 Shashlikchi",
  },

  {
    value: "pishiriqchi",
    label: "🥐 Pishiriqchi",
  },

  {
    value: "ichimlikchi",
    label: "🥤 Ichimlikchi",
  },
];


// =====================================================
// DEFAULT RASM
// =====================================================

const getCategoryImage = (category) => {
  const found = CATEGORIES.find(
    (item) =>
      item.value === category
  );

  return (
    found?.image ||
    CATEGORIES[0].image
  );
};


// =====================================================
// KATEGORIYA EMOJISI
// =====================================================

const getCategoryEmoji = (
  category
) => {
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


// =====================================================
// OSHPAZ NOMINI OLISH
// =====================================================

const getKitchenTypeLabel = (
  kitchenType
) => {
  const found =
    KITCHEN_TYPES.find(
      (item) =>
        item.value ===
        kitchenType
    );

  return (
    found?.label ||
    "🍲 Umumiy oshpaz"
  );
};


// =====================================================
// PRICE
// =====================================================

const formatPrice = (
  price
) => {
  return Number(
    price || 0
  ).toLocaleString(
    "uz-UZ"
  );
};


// =====================================================
// MAIN
// =====================================================

export default function MenuManager() {
  const { cafeId } =
    useAuth();


  // ===================================================
  // STATE
  // ===================================================

  const [
    menuItems,
    setMenuItems,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingItem,
    setEditingItem,
  ] = useState(null);

  const [
    deleteConfirmItem,
    setDeleteConfirmItem,
  ] = useState(null);

  const [
    saving,
    setSaving,
  ] = useState(false);


  // ===================================================
  // FORM
  // ===================================================

  const [
    form,
    setForm,
  ] = useState({
    name: "",
    price: "",
    category: "Taom",
    kitchenType: "umumiy",
    imageUrl: "",
  });


  // ===================================================
  // FIREBASE MENU
  // ===================================================

  useEffect(() => {
    if (!cafeId) {
      setMenuItems([]);
      setLoading(false);
      return;
    }

    const menuQuery =
      query(
        collection(
          db,
          "menu"
        ),
        where(
          "cafeId",
          "==",
          cafeId
        )
      );

    const unsubscribe =
      onSnapshot(
        menuQuery,
        (snapshot) => {
          const items =
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            );

          setMenuItems(
            items
          );

          setLoading(false);
        },
        (error) => {
          console.error(
            "Menyu yuklashda xatolik:",
            error
          );

          setLoading(false);
        }
      );

    return () =>
      unsubscribe();
  }, [cafeId]);


  // ===================================================
  // FORM RESET
  // ===================================================

  const resetForm =
    () => {
      setForm({
        name: "",
        price: "",
        category: "Taom",
        kitchenType:
          "umumiy",
        imageUrl: "",
      });

      setEditingItem(
        null
      );

      setSaving(false);
    };


  // ===================================================
  // ADD
  // ===================================================

  const openAddModal =
    () => {
      resetForm();
      setModalOpen(true);
    };


  // ===================================================
  // EDIT
  // ===================================================

  const openEditModal =
    (item) => {
      setEditingItem(
        item
      );

      setForm({
        name:
          item.name || "",

        price:
          item.price !==
          undefined
            ? String(
                item.price
              )
            : "",

        category:
          item.category ||
          "Taom",

        kitchenType:
          item.kitchenType ||
          "umumiy",

        imageUrl:
          item.imageUrl ||
          "",
      });

      setModalOpen(true);
    };


  // ===================================================
  // CLOSE
  // ===================================================

  const closeModal =
    () => {
      if (saving) return;

      setModalOpen(false);

      resetForm();
    };


  // ===================================================
  // CATEGORY
  // ===================================================

  const handleCategoryChange =
    (e) => {
      const category =
        e.target.value;

      setForm(
        (prev) => ({
          ...prev,
          category,
        })
      );
    };


  // ===================================================
  // KITCHEN TYPE
  // ===================================================

  const handleKitchenTypeChange =
    (e) => {
      const kitchenType =
        e.target.value;

      setForm(
        (prev) => ({
          ...prev,
          kitchenType,
        })
      );
    };


  // ===================================================
  // IMAGE PREVIEW
  // ===================================================

  const previewImage =
    useMemo(() => {
      if (
        form.imageUrl.trim()
      ) {
        return form.imageUrl.trim();
      }

      return getCategoryImage(
        form.category
      );
    }, [
      form.category,
      form.imageUrl,
    ]);


  // ===================================================
  // SUBMIT
  // ===================================================

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      const name =
        form.name.trim();

      const price =
        Number(form.price);

      if (!name) {
        alert(
          "Iltimos, taom nomini kiriting!"
        );

        return;
      }

      if (
        !form.price ||
        price <= 0
      ) {
        alert(
          "Iltimos, to'g'ri narx kiriting!"
        );

        return;
      }

      if (!cafeId) {
        alert(
          "Kafe aniqlanmadi. Qaytadan tizimga kiring."
        );

        return;
      }

      if (
        !form.kitchenType
      ) {
        alert(
          "Iltimos, oshpaz turini tanlang!"
        );

        return;
      }

      setSaving(true);

      try {
        const imageUrl =
          form.imageUrl.trim() ||
          getCategoryImage(
            form.category
          );


        // =============================================
        // TAOMNI TAHRIRLASH
        // =============================================

        if (editingItem) {
          await updateDoc(
            doc(
              db,
              "menu",
              editingItem.id
            ),
            {
              name,

              price,

              category:
                form.category,

              kitchenType:
                form.kitchenType,

              imageUrl,
            }
          );
        }


        // =============================================
        // YANGI TAOM
        // =============================================

        else {
          await addDoc(
            collection(
              db,
              "menu"
            ),
            {
              cafeId,

              name,

              price,

              category:
                form.category,

              kitchenType:
                form.kitchenType,

              imageUrl,

              available: true,

              createdAt:
                new Date(),
            }
          );
        }


        setModalOpen(
          false
        );

        resetForm();

      } catch (error) {
        console.error(
          "Saqlashda xatolik:",
          error
        );

        alert(
          "Saqlashda xatolik yuz berdi. Qaytadan urinib ko'ring."
        );
      } finally {
        setSaving(false);
      }
    };


  // ===================================================
  // DELETE
  // ===================================================

  const confirmDeleteMeal =
    async () => {
      if (
        !deleteConfirmItem
      ) {
        return;
      }

      try {
        await deleteDoc(
          doc(
            db,
            "menu",
            deleteConfirmItem.id
          )
        );

        setDeleteConfirmItem(
          null
        );

      } catch (error) {
        console.error(
          "O'chirishda xatolik:",
          error
        );

        alert(
          "O'chirishda xatolik yuz berdi."
        );
      }
    };


  // ===================================================
  // SORT
  // ===================================================

  const sortedItems =
    useMemo(() => {
      return [
        ...menuItems,
      ].sort(
        (a, b) =>
          String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
          )
      );
    }, [
      menuItems,
    ]);


  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="
      h-[calc(100vh-68px)]
      min-h-0
      bg-slate-50
      text-slate-800
      w-full
      flex
      flex-col
      overflow-hidden
    ">


      {/* =================================================
          HEADER
      ================================================= */}

      <div className="
        shrink-0
        bg-slate-50
        border-b
        border-slate-200
      ">

        <div className="
          w-full
          px-5
          sm:px-8
          lg:px-10
          py-5
        ">

          <div className="
            flex
            items-center
            justify-between
            gap-4
          ">

            <div>

              <h1 className="
                text-2xl
                sm:text-3xl
                lg:text-4xl
                font-black
                text-slate-900
                flex
                items-center
                gap-2
              ">

                <span>
                  📋
                </span>

                <span>
                  Menyu boshqaruvi
                </span>

              </h1>

              <p className="
                mt-1
                text-sm
                text-slate-500
              ">
                Kafe menyusidagi
                taomlarni boshqaring
              </p>

            </div>


            <button
              onClick={
                openAddModal
              }
              className="
                shrink-0
                bg-amber-600
                hover:bg-amber-700
                text-white
                px-5
                py-3
                rounded-xl
                text-sm
                font-bold
                shadow-sm
                transition
                cursor-pointer
              "
            >
              + Yangi Taom
            </button>

          </div>

        </div>

      </div>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="
        flex-1
        min-h-0
        overflow-y-auto
      ">

        <div className="
          w-full
          px-5
          sm:px-8
          lg:px-10
          py-6
        ">


          {/* =================================================
              LOADING
          ================================================= */}

          {loading && (

            <div className="
              flex
              items-center
              justify-center
              py-20
            ">

              <div className="
                text-center
              ">

                <div className="
                  text-4xl
                  mb-3
                ">
                  ☕
                </div>

                <p className="
                  text-slate-500
                  font-semibold
                ">
                  Menyu yuklanmoqda...
                </p>

              </div>

            </div>

          )}


          {/* =================================================
              EMPTY
          ================================================= */}

          {!loading &&
            sortedItems.length ===
              0 && (

              <div className="
                bg-white
                border
                border-slate-200
                rounded-2xl
                p-10
                text-center
              ">

                <div className="
                  text-5xl
                  mb-4
                ">
                  🍽️
                </div>

                <h2 className="
                  text-xl
                  font-bold
                  text-slate-800
                ">
                  Hali taomlar
                  qo'shilmagan
                </h2>

                <p className="
                  text-sm
                  text-slate-400
                  mt-2
                ">
                  Birinchi taomni
                  qo'shish uchun
                  yuqoridagi
                  tugmani bosing.
                </p>

              </div>

            )}


          {/* =================================================
              MENU GRID
          ================================================= */}

          {!loading &&
            sortedItems.length >
              0 && (

              <div className="
                grid
                grid-cols-1
                sm:grid-cols-2
                xl:grid-cols-3
                2xl:grid-cols-4
                gap-5
                pb-8
              ">

                {sortedItems.map(
                  (item) => {

                    const category =
                      item.category ||
                      "Taom";

                    const kitchenType =
                      item.kitchenType ||
                      "umumiy";

                    const image =
                      item.imageUrl ||
                      getCategoryImage(
                        category
                      );


                    return (

                      <div
                        key={
                          item.id
                        }
                        className="
                          bg-white
                          rounded-2xl
                          border
                          border-slate-200
                          shadow-sm
                          overflow-hidden
                          flex
                          flex-col
                        "
                      >


                        {/* IMAGE */}

                        <div className="
                          relative
                          w-full
                          h-52
                          bg-slate-100
                          overflow-hidden
                        ">

                          <img
                            src={image}
                            alt={
                              item.name
                            }
                            className="
                              w-full
                              h-full
                              object-cover
                            "
                            onError={(
                              e
                            ) => {
                              e.currentTarget.src =
                                getCategoryImage(
                                  category
                                );
                            }}
                          />


                          {/* CATEGORY */}

                          <div className="
                            absolute
                            top-3
                            left-3
                            bg-white
                            px-3
                            py-1.5
                            rounded-xl
                            shadow-sm
                            text-xs
                            font-bold
                            text-slate-700
                          ">

                            {
                              getCategoryEmoji(
                                category
                              )
                            }{" "}

                            {category}

                          </div>

                        </div>


                        {/* CONTENT */}

                        <div className="
                          p-4
                          flex
                          flex-col
                          flex-1
                        ">

                          <h3 className="
                            font-black
                            text-lg
                            text-slate-900
                          ">
                            {
                              item.name
                            }
                          </h3>


                          {/* CATEGORY */}

                          <p className="
                            text-sm
                            text-slate-400
                            mt-1
                          ">

                            {
                              getCategoryEmoji(
                                category
                              )
                            }{" "}

                            {category}

                          </p>


                          {/* OSHPAZ */}

                          <div className="
                            mt-2
                            inline-flex
                            w-fit
                            items-center
                            gap-1
                            bg-orange-50
                            text-orange-700
                            px-3
                            py-1.5
                            rounded-xl
                            text-xs
                            font-bold
                          ">

                            👨‍🍳

                            {getKitchenTypeLabel(
                              kitchenType
                            )}

                          </div>


                          {/* PRICE */}

                          <p className="
                            text-amber-600
                            font-black
                            text-xl
                            mt-3
                          ">
                            {
                              formatPrice(
                                item.price
                              )
                            }{" "}
                            so'm
                          </p>


                          {/* BUTTONS */}

                          <div className="
                            flex
                            gap-2
                            mt-4
                            pt-4
                            border-t
                            border-slate-100
                          ">

                            <button
                              onClick={() =>
                                openEditModal(
                                  item
                                )
                              }
                              className="
                                flex-1
                                bg-amber-50
                                hover:bg-amber-100
                                text-amber-700
                                py-2.5
                                rounded-xl
                                text-sm
                                font-bold
                                transition
                                cursor-pointer
                              "
                            >
                              ✏️ Tahrirlash
                            </button>


                            <button
                              onClick={() =>
                                setDeleteConfirmItem(
                                  item
                                )
                              }
                              className="
                                flex-1
                                bg-red-50
                                hover:bg-red-100
                                text-red-600
                                py-2.5
                                rounded-xl
                                text-sm
                                font-bold
                                transition
                                cursor-pointer
                              "
                            >
                              🗑️ O'chirish
                            </button>

                          </div>

                        </div>

                      </div>

                    );

                  }
                )}

              </div>

            )}

        </div>

      </main>


      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      {modalOpen && (

        <div className="
          fixed
          inset-0
          z-[100]
          bg-black/50
          backdrop-blur-sm
          flex
          items-center
          justify-center
          p-4
        ">

          <div className="
            bg-white
            rounded-[22px]
            shadow-2xl
            w-full
            max-w-[590px]
            max-h-[95vh]
            overflow-y-auto
          ">


            {/* HEADER */}

            <div className="
              sticky
              top-0
              z-10
              bg-white
              border-b
              border-slate-100
              px-6
              py-5
            ">

              <div className="
                flex
                items-start
                justify-between
                gap-4
              ">

                <div>

                  <h2 className="
                    text-2xl
                    font-black
                    text-slate-800
                  ">

                    {editingItem
                      ? "Taomni tahrirlash"
                      : "Yangi taom qo'shish"}

                  </h2>

                  <p className="
                    text-sm
                    text-slate-400
                    mt-1
                  ">
                    Taom ma'lumotlarini
                    kiriting
                  </p>

                </div>


                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                  className="
                    w-11
                    h-11
                    rounded-xl
                    bg-slate-50
                    hover:bg-slate-100
                    text-slate-500
                    text-2xl
                    flex
                    items-center
                    justify-center
                    cursor-pointer
                    disabled:opacity-50
                  "
                >
                  ×
                </button>

              </div>

            </div>


            {/* FORM */}

            <form
              onSubmit={
                handleSubmit
              }
              className="
                px-6
                py-6
                space-y-5
              "
            >


              {/* TAOM NOMI */}

              <div>

                <label className="
                  block
                  text-sm
                  font-bold
                  text-slate-700
                  mb-2
                ">
                  Taom nomi
                </label>

                <input
                  type="text"
                  value={
                    form.name
                  }
                  onChange={(
                    e
                  ) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        name:
                          e.target
                            .value,
                      })
                    )
                  }
                  className="
                    w-full
                    h-14
                    px-4
                    border
                    border-slate-300
                    rounded-2xl
                    outline-none
                    text-slate-800
                    focus:border-amber-500
                    focus:ring-2
                    focus:ring-amber-100
                    transition
                  "
                  placeholder="Masalan: Somsa"
                />

              </div>


              {/* PRICE */}

              <div>

                <label className="
                  block
                  text-sm
                  font-bold
                  text-slate-700
                  mb-2
                ">
                  Narxi (so'm)
                </label>

                <input
                  type="number"
                  min="0"
                  value={
                    form.price
                  }
                  onChange={(
                    e
                  ) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        price:
                          e.target
                            .value,
                      })
                    )
                  }
                  className="
                    w-full
                    h-14
                    px-4
                    border
                    border-slate-300
                    rounded-2xl
                    outline-none
                    text-slate-800
                    focus:border-amber-500
                    focus:ring-2
                    focus:ring-amber-100
                    transition
                  "
                  placeholder="Masalan: 15000"
                />

              </div>


              {/* CATEGORY */}

              <div>

                <label className="
                  block
                  text-sm
                  font-bold
                  text-slate-700
                  mb-2
                ">
                  Taom turi
                </label>

                <select
                  value={
                    form.category
                  }
                  onChange={
                    handleCategoryChange
                  }
                  className="
                    w-full
                    h-14
                    px-4
                    border
                    border-slate-300
                    rounded-2xl
                    outline-none
                    bg-white
                    text-slate-800
                    font-medium
                    focus:border-amber-500
                    focus:ring-2
                    focus:ring-amber-100
                    cursor-pointer
                  "
                >

                  {CATEGORIES.map(
                    (
                      category
                    ) => (

                      <option
                        key={
                          category.value
                        }
                        value={
                          category.value
                        }
                      >
                        {
                          category.label
                        }
                      </option>

                    )
                  )}

                </select>

              </div>


              {/* =================================================
                  OSHPAZ TURI
              ================================================= */}

              <div>

                <label className="
                  block
                  text-sm
                  font-bold
                  text-slate-700
                  mb-2
                ">
                  👨‍🍳 Qaysi oshpaz
                  tayyorlaydi?
                </label>

                <select
                  value={
                    form.kitchenType
                  }
                  onChange={
                    handleKitchenTypeChange
                  }
                  className="
                    w-full
                    h-14
                    px-4
                    border
                    border-slate-300
                    rounded-2xl
                    outline-none
                    bg-white
                    text-slate-800
                    font-medium
                    focus:border-amber-500
                    focus:ring-2
                    focus:ring-amber-100
                    cursor-pointer
                  "
                >

                  {KITCHEN_TYPES.map(
                    (
                      type
                    ) => (

                      <option
                        key={
                          type.value
                        }
                        value={
                          type.value
                        }
                      >
                        {
                          type.label
                        }
                      </option>

                    )
                  )}

                </select>


                <p className="
                  text-xs
                  text-slate-400
                  mt-2
                  leading-5
                ">
                  Buyurtma kelganda
                  shu taom tanlangan
                  oshpaz paneliga
                  tushadi.
                </p>

              </div>


              {/* IMAGE URL */}

              <div>

                <label className="
                  block
                  text-sm
                  font-bold
                  text-slate-700
                  mb-2
                ">
                  Rasm havolasi
                  (URL)
                </label>

                <input
                  type="text"
                  value={
                    form.imageUrl
                  }
                  onChange={(
                    e
                  ) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        imageUrl:
                          e.target
                            .value,
                      })
                    )
                  }
                  className="
                    w-full
                    h-14
                    px-4
                    border
                    border-slate-300
                    rounded-2xl
                    outline-none
                    text-slate-800
                    focus:border-amber-500
                    focus:ring-2
                    focus:ring-amber-100
                    transition
                  "
                  placeholder="https://..."
                />

                <p className="
                  text-xs
                  text-slate-400
                  mt-2
                ">
                  URL kiritilmasa,
                  tanlangan taom
                  turiga mos rasm
                  ishlatiladi.
                </p>

              </div>


              {/* IMAGE PREVIEW */}

              <div>

                <div className="
                  flex
                  items-center
                  justify-between
                  mb-2
                ">

                  <label className="
                    text-sm
                    font-bold
                    text-slate-700
                  ">
                    Rasm ko'rinishi
                  </label>

                  <span className="
                    text-xs
                    font-bold
                    text-amber-600
                  ">

                    {
                      getCategoryEmoji(
                        form.category
                      )
                    }{" "}

                    {
                      form.category
                    }

                  </span>

                </div>


                <div className="
                  relative
                  w-full
                  h-52
                  rounded-2xl
                  overflow-hidden
                  bg-slate-100
                  border
                  border-slate-200
                ">

                  <img
                    src={
                      previewImage
                    }
                    alt="Taom rasmi"
                    className="
                      w-full
                      h-full
                      object-cover
                    "
                    onError={(
                      e
                    ) => {
                      e.currentTarget.src =
                        getCategoryImage(
                          form.category
                        );
                    }}
                  />


                  <div className="
                    absolute
                    top-3
                    left-3
                    bg-white
                    px-4
                    py-2
                    rounded-xl
                    shadow-md
                    text-sm
                    font-bold
                    text-slate-700
                  ">

                    {
                      getCategoryEmoji(
                        form.category
                      )
                    }{" "}

                    {
                      form.category
                    }

                  </div>

                </div>

              </div>


              {/* SELECTED KITCHEN INFO */}

              <div className="
                bg-orange-50
                border
                border-orange-100
                rounded-2xl
                p-4
              ">

                <div className="
                  text-xs
                  text-orange-600
                  font-bold
                  mb-1
                ">
                  BUYURTMA QAYERGA
                  BORADI?
                </div>

                <div className="
                  text-lg
                  font-black
                  text-orange-800
                ">

                  👨‍🍳{" "}

                  {
                    getKitchenTypeLabel(
                      form.kitchenType
                    )
                  }

                </div>

              </div>


              {/* BUTTONS */}

              <div className="
                flex
                gap-3
                pt-2
              ">

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="
                    flex-1
                    h-14
                    bg-amber-600
                    hover:bg-amber-700
                    disabled:bg-amber-400
                    text-white
                    rounded-2xl
                    text-base
                    font-black
                    transition
                    cursor-pointer
                    disabled:cursor-not-allowed
                  "
                >

                  {saving
                    ? "Saqlanmoqda..."
                    : editingItem
                    ? "Yangilash"
                    : "Saqlash"}

                </button>


                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                  className="
                    flex-1
                    h-14
                    bg-white
                    border
                    border-slate-200
                    hover:bg-slate-50
                    text-slate-600
                    rounded-2xl
                    text-base
                    font-bold
                    transition
                    cursor-pointer
                    disabled:opacity-50
                  "
                >
                  Bekor qilish
                </button>

              </div>

            </form>

          </div>

        </div>

      )}


      {/* =================================================
          DELETE MODAL
      ================================================= */}

      {deleteConfirmItem && (

        <div className="
          fixed
          inset-0
          z-[110]
          bg-black/50
          backdrop-blur-sm
          flex
          items-center
          justify-center
          p-4
        ">

          <div className="
            bg-white
            rounded-2xl
            shadow-2xl
            w-full
            max-w-sm
            p-6
            text-center
          ">

            <div className="
              w-14
              h-14
              mx-auto
              rounded-2xl
              bg-red-50
              flex
              items-center
              justify-center
              text-2xl
              mb-4
            ">
              🗑️
            </div>


            <h3 className="
              text-xl
              font-black
              text-slate-800
            ">
              Taomni o'chirish
            </h3>


            <p className="
              text-sm
              text-slate-500
              mt-2
              leading-6
            ">

              Siz rostdan ham{" "}

              <strong className="
                text-slate-700
              ">
                "
                {
                  deleteConfirmItem.name
                }
                "
              </strong>

              {" "}taomini
              o'chirmoqchimisiz?

            </p>


            <div className="
              flex
              gap-3
              mt-6
            ">

              <button
                onClick={
                  confirmDeleteMeal
                }
                className="
                  flex-1
                  h-12
                  bg-red-600
                  hover:bg-red-700
                  text-white
                  rounded-xl
                  font-bold
                  cursor-pointer
                "
              >
                O'chirish
              </button>


              <button
                onClick={() =>
                  setDeleteConfirmItem(
                    null
                  )
                }
                className="
                  flex-1
                  h-12
                  border
                  border-slate-200
                  bg-white
                  hover:bg-slate-50
                  text-slate-600
                  rounded-xl
                  font-bold
                  cursor-pointer
                "
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