import React, {
  useEffect,
  useState,
  useRef,
} from "react";

import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";

import {
  getAuth,
  signOut,
} from "firebase/auth";

import { db } from "../../firebase/config.js";

import {
  useNavigate,
} from "react-router-dom";

import { toast } from "react-toastify";


export default function TableGrid() {
  const auth = getAuth();

  const navigate = useNavigate();


  // =========================================================
  // STATE
  // =========================================================

  const [tables, setTables] = useState([]);

  const [orders, setOrders] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [logoutModalOpen, setLogoutModalOpen] =
    useState(false);

  const [selectedTable, setSelectedTable] =
    useState(null);


  // =========================================================
  // AUDIO
  // =========================================================

  const audioCtxRef =
    useRef(null);

  const audioUnlockedRef =
    useRef(false);


  // =========================================================
  // NOTIFICATION
  // =========================================================

  const notificationQueueRef =
    useRef([]);

  const notificationShowingRef =
    useRef(false);

  const isInitialOrdersLoad =
    useRef(true);

  /*
   * Oldingi orderlarni saqlab turadi.
   *
   * Shu orqali:
   *
   * Somsa:
   * false -> true
   *
   * bo'lsa, ofitsiantga signal beramiz.
   */
  const previousOrdersRef =
    useRef(new Map());

  /*
   * Bir taomga bir marta notification.
   */
  const notifiedItemsRef =
    useRef(new Set());


  // =========================================================
  // 🚪 LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      await signOut(auth);

      toast.info(
        "Tizimdan chiqdingiz"
      );

      navigate("/login");

    } catch (error) {

      console.error(
        "Chiqishda xatolik:",
        error
      );

      toast.error(
        "Chiqishda xatolik yuz berdi!"
      );
    }
  };


  // =========================================================
  // 🔊 AUDIO CONTEXT
  // =========================================================

  const getAudioContext = () => {
    try {

      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) {
        return null;
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current =
          new AudioContext();
      }

      return audioCtxRef.current;

    } catch (error) {

      console.error(
        "AudioContext xatosi:",
        error
      );

      return null;
    }
  };


  // =========================================================
  // 🔓 AUDIO UNLOCK
  // =========================================================

  const unlockAudio = async () => {

    try {

      const ctx =
        getAudioContext();

      if (!ctx) {
        return;
      }

      if (
        ctx.state ===
        "suspended"
      ) {
        await ctx.resume();
      }

      audioUnlockedRef.current =
        true;

    } catch (error) {

      console.error(
        "Audio unlock xatosi:",
        error
      );
    }
  };


  // =========================================================
  // 👆 BIRINCHI BOSISHDA AUDIO OCHILADI
  // =========================================================

  useEffect(() => {

    const handleFirstClick = () => {

      if (
        !audioUnlockedRef.current
      ) {
        unlockAudio();
      }
    };


    window.addEventListener(
      "click",
      handleFirstClick
    );

    window.addEventListener(
      "touchstart",
      handleFirstClick
    );

    window.addEventListener(
      "keydown",
      handleFirstClick
    );


    return () => {

      window.removeEventListener(
        "click",
        handleFirstClick
      );

      window.removeEventListener(
        "touchstart",
        handleFirstClick
      );

      window.removeEventListener(
        "keydown",
        handleFirstClick
      );

    };

  }, []);


  // =========================================================
  // 🔔 TAYYOR TAOM OVOZI
  // =========================================================

  const playReadySound =
    async () => {

      try {

        const ctx =
          getAudioContext();

        if (!ctx) {
          return;
        }


        if (
          ctx.state ===
          "suspended"
        ) {
          await ctx.resume();
        }


        const now =
          ctx.currentTime;


        const beep = (
          delay,
          frequency,
          duration
        ) => {

          const oscillator =
            ctx.createOscillator();

          const gain =
            ctx.createGain();


          oscillator.type =
            "sine";


          oscillator.frequency.setValueAtTime(
            frequency,
            now + delay
          );


          gain.gain.setValueAtTime(
            0.0001,
            now + delay
          );


          gain.gain.exponentialRampToValueAtTime(
            0.8,
            now +
              delay +
              0.03
          );


          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now +
              delay +
              duration
          );


          oscillator.connect(gain);

          gain.connect(
            ctx.destination
          );


          oscillator.start(
            now + delay
          );


          oscillator.stop(
            now +
              delay +
              duration +
              0.05
          );
        };


        // 🔔 🔔 🔔

        beep(
          0,
          880,
          0.25
        );

        beep(
          0.35,
          1100,
          0.25
        );

        beep(
          0.70,
          880,
          0.35
        );


      } catch (error) {

        console.error(
          "Ovoz chiqarishda xatolik:",
          error
        );
      }
    };


  // =========================================================
  // 🔔 NOTIFICATION QUEUE
  // =========================================================

  const showNextNotification =
    async () => {

      if (
        notificationShowingRef.current
      ) {
        return;
      }


      if (
        notificationQueueRef.current
          .length === 0
      ) {
        return;
      }


      notificationShowingRef.current =
        true;


      const notification =
        notificationQueueRef.current.shift();


      // 🔊 OVOZ

      await playReadySound();


      // 🔔 XABAR

      toast.success(
        `🛎️ STOL №${notification.tableNumber}: ${notification.itemName} TAYYOR!`,
        {
          toastId:
            `ready-${notification.id}`,

          position:
            "top-center",

          autoClose: 5000,
        }
      );


      setTimeout(() => {

        notificationShowingRef.current =
          false;

        showNextNotification();

      }, 2500);
    };


  // =========================================================
  // 🔥 FIREBASE REALTIME
  // =========================================================

  useEffect(() => {

    // =======================================================
    // 🪑 STOLLAR
    // =======================================================

    const qTables =
      query(
        collection(
          db,
          "tables"
        )
      );


    const unsubTables =
      onSnapshot(
        qTables,
        (snapshot) => {

          const data =
            snapshot.docs.map(
              (d) => ({
                id: d.id,
                ...d.data(),
              })
            );


          data.sort(
            (a, b) =>
              (a.number || 0) -
              (b.number || 0)
          );


          setTables(data);

          setLoading(false);
        },
        (error) => {

          console.error(
            "Tables listener:",
            error
          );

          setLoading(false);

          toast.error(
            "Stollarni yuklashda xatolik!"
          );
        }
      );


    // =======================================================
    // 🍽️ ORDERS
    // =======================================================

    const qOrders =
      query(
        collection(
          db,
          "orders"
        )
      );


    const unsubOrders =
      onSnapshot(
        qOrders,
        (snapshot) => {

          const data =
            snapshot.docs.map(
              (d) => ({
                id: d.id,
                ...d.data(),
              })
            );


          // =================================================
          // BIRINCHI YUKLANISH
          // =================================================

          if (
            isInitialOrdersLoad.current
          ) {

            snapshot.docs.forEach(
              (orderDoc) => {

                const order =
                  orderDoc.data();


                const kitchenItems =
                  Array.isArray(
                    order.kitchenItems
                  )
                    ? order.kitchenItems
                    : [];


                kitchenItems.forEach(
                  (
                    item,
                    index
                  ) => {

                    /*
                     * Sahifa ochilganda
                     * allaqachon tayyor bo'lgan
                     * taomga signal bermaymiz.
                     */

                    if (
                      item.isReady === true
                    ) {

                      const key =
                        `${orderDoc.id}-${index}`;

                      notifiedItemsRef.current.add(
                        key
                      );
                    }

                  }
                );


                previousOrdersRef.current.set(
                  orderDoc.id,
                  order
                );

              }
            );


            isInitialOrdersLoad.current =
              false;

          }


          // =================================================
          // KEYINGI O'ZGARISHLAR
          // =================================================

          else {

            snapshot.docs.forEach(
              (orderDoc) => {

                const newOrder =
                  orderDoc.data();

                const orderId =
                  orderDoc.id;


                const oldOrder =
                  previousOrdersRef.current.get(
                    orderId
                  );


                const oldItems =
                  Array.isArray(
                    oldOrder?.kitchenItems
                  )
                    ? oldOrder.kitchenItems
                    : [];


                const newItems =
                  Array.isArray(
                    newOrder.kitchenItems
                  )
                    ? newOrder.kitchenItems
                    : [];


                // =========================================
                // HAR BIR TAOMNI TEKSHIRAMIZ
                // =========================================

                newItems.forEach(
                  (
                    newItem,
                    index
                  ) => {

                    const oldItem =
                      oldItems[index];


                    const oldReady =
                      oldItem?.isReady === true;


                    const newReady =
                      newItem?.isReady === true;


                    /*
                     * Faqat:
                     *
                     * false -> true
                     *
                     * bo'lganda signal.
                     */

                    if (
                      !oldReady &&
                      newReady
                    ) {

                      const notificationId =
                        `${orderId}-${index}`;


                      if (
                        !notifiedItemsRef.current.has(
                          notificationId
                        )
                      ) {

                        notifiedItemsRef.current.add(
                          notificationId
                        );


                        notificationQueueRef.current.push(
                          {
                            id:
                              notificationId,

                            tableNumber:
                              newOrder.tableNumber ??
                              newOrder.table ??
                              "—",

                            itemName:
                              newItem.name ||
                              newItem.title ||
                              "Taom",
                          }
                        );


                        showNextNotification();
                      }

                    }

                  }
                );


                // Old orderni yangilaymiz

                previousOrdersRef.current.set(
                  orderId,
                  newOrder
                );

              }
            );

          }


          setOrders(data);

        },
        (error) => {

          console.error(
            "Orders listener:",
            error
          );

          toast.error(
            "Buyurtmalarni kuzatishda xatolik!"
          );
        }
      );


    // =======================================================
    // CLEANUP
    // =======================================================

    return () => {

      unsubTables();

      unsubOrders();

    };

  }, []);


  // =========================================================
  // 🪑 STOL STATUSI
  // =========================================================

  const getTableStatus =
    (tableNumber) => {

      const activeOrder =
        orders.find(
          (order) =>

            String(
              order.tableNumber ??
              order.table
            ) ===
              String(
                tableNumber
              ) &&

            order.kitchenStatus !==
              "delivered" &&

            order.status !==
              "delivered"
        );


      if (!activeOrder) {
        return "empty";
      }


      const items =
        activeOrder.kitchenItems ||
        [];


      /*
       * Barcha ovqat tayyor bo'lsa
       * stol yashil bo'ladi.
       */

      const allReady =
        items.length > 0 &&
        items.every(
          (item) =>
            item.isReady === true
        );


      if (allReady) {
        return "ready";
      }


      return "occupied";
    };


  // =========================================================
  // 🍽️ FAOL ORDER
  // =========================================================

  const getActiveOrder =
    (tableNumber) => {

      return orders.find(
        (order) =>

          String(
            order.tableNumber ??
            order.table
          ) ===
            String(
              tableNumber
            ) &&

          order.kitchenStatus !==
            "delivered" &&

          order.status !==
            "delivered"
      );
    };


  // =========================================================
  // ⏰ VAQT
  // =========================================================

  const formatTime =
    (date) => {

      if (!date) {
        return "";
      }


      const d =
        date?.toDate
          ? date.toDate()
          : new Date(date);


      return d.toLocaleTimeString(
        "uz-UZ",
        {
          hour:
            "2-digit",

          minute:
            "2-digit",
        }
      );
    };


  // =========================================================
  // 🚚 BIR TAOMNI YETKAZILDI QILISH
  // =========================================================

  const markFoodDelivered =
    async (
      order,
      itemIndex
    ) => {

      try {

        // -----------------------------------------------
        // KITCHEN ITEMS
        // -----------------------------------------------

        const items =
          Array.isArray(
            order.kitchenItems
          )
            ? [
                ...order.kitchenItems,
              ]
            : [];


        const item =
          items[itemIndex];


        if (!item) {

          toast.error(
            "Taom topilmadi!"
          );

          return;
        }


        // -----------------------------------------------
        // ❗ OSHPAZ TAYYOR QILMAGAN
        // -----------------------------------------------

        if (
          item.isReady !== true
        ) {

          toast.warning(
            "❗ Avval oshpaz bu taomni TAYYOR qilishi kerak!"
          );

          return;
        }


        // -----------------------------------------------
        // ALLAQACHON YETKAZILGAN
        // -----------------------------------------------

        if (
          item.isDelivered === true
        ) {

          return;
        }


        // -----------------------------------------------
        // FAQAT SHU TAOM
        // -----------------------------------------------

        items[itemIndex] = {
          ...items[itemIndex],

          isDelivered:
            true,

          deliveryStatus:
            "delivered",

          deliveredAt:
            new Date(),
        };


        // -----------------------------------------------
        // HAMMA TAOM YETKAZILGANMI?
        // -----------------------------------------------

        const allDelivered =
          items.length > 0 &&
          items.every(
            (food) =>
              food.isDelivered ===
              true
          );


        // -----------------------------------------------
        // FIREBASE
        // -----------------------------------------------

        const updatePayload = {
          kitchenItems:
            items,

          updatedAt:
            new Date(),
        };


        /*
         * Hamma taom yetkazilgan bo'lsa,
         * butun orderni delivered qilamiz.
         */

        if (allDelivered) {

          updatePayload.kitchenStatus =
            "delivered";

          updatePayload.status =
            "delivered";
        }


        await updateDoc(
          doc(
            db,
            "orders",
            order.id
          ),
          updatePayload
        );


        // -----------------------------------------------
        // MODAL
        // -----------------------------------------------

        if (allDelivered) {

          setSelectedTable(
            null
          );


          toast.success(
            "✅ Barcha taomlar mijozga yetkazildi!"
          );

        } else {

          toast.success(
            `✅ ${
              item.name ||
              item.title ||
              "Taom"
            } yetkazildi!`
          );
        }


      } catch (error) {

        console.error(
          "Taomni yetkazishda xatolik:",
          error
        );


        toast.error(
          "❌ Taomni yetkazishda xatolik!"
        );
      }
    };


  // =========================================================
  // 🪑 STOL BOSILDI
  // =========================================================

  const handleTableClick =
    (table) => {

      unlockAudio();


      const status =
        getTableStatus(
          table.number
        );


      if (
        status ===
        "empty"
      ) {

        navigate(
          `/waiter/order?table=${table.number}`
        );

      } else {

        setSelectedTable(
          table
        );
      }
    };


  // =========================================================
  // 🎨 STOL STYLE
  // =========================================================

  const statusStyles = {

    empty:
      "bg-white border-gray-200 text-gray-800",

    occupied:
      "bg-[#fff7e8] border-amber-400 text-amber-800",

    ready:
      "bg-green-100 border-green-500 text-green-900 shadow-lg shadow-green-500/20",
  };


  const statusLabels = {

    empty:
      "Bo'sh",

    occupied:
      "Tayyorlanmoqda",

    ready:
      "Tayyor!",
  };


  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {

    return (

      <div className="min-h-screen bg-[#f8f5ef] flex items-center justify-center font-bold text-gray-500">

        Yuklanmoqda...

      </div>
    );
  }


  // =========================================================
  // UI
  // =========================================================

  return (

    <div className="min-h-screen bg-[#f8f5ef] text-gray-800">


      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="sticky top-0 z-30 bg-white border-b border-[#eee5d8] shadow-sm">

        <div className="w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl bg-[#fff0d2] flex items-center justify-center text-lg">
              🍲
            </div>

            <div>

              <h1 className="text-base font-bold text-[#6f3518]">
                KARAVAN KAFE
              </h1>

              <p className="text-[10px] text-gray-400">
                Ofitsiant paneli
              </p>

            </div>

          </div>


          <div className="flex items-center gap-2">

            {/* ❌ OVOZ TUGMASI OLIB TASHLANDI */}

            <button
              onClick={() =>
                setLogoutModalOpen(
                  true
                )
              }
              className="border border-red-200 text-red-500 bg-white hover:bg-red-50 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              ↪ Chiqish
            </button>

          </div>

        </div>

      </header>


      {/* ===================================================
          MAIN
      =================================================== */}

      <main className="w-full max-w-5xl mx-auto px-4 py-5">

        <div className="flex justify-between items-end mb-4">

          <h2 className="text-2xl font-extrabold text-[#3b2418]">
            Stollar
          </h2>


          <button
            onClick={() =>
              navigate(
                "/waiter/order"
              )
            }
            className="bg-[#d97706] hover:bg-[#c56600] text-white px-5 py-2.5 rounded-xl text-sm font-bold"
          >
            + Buyurtma
          </button>

        </div>


        {/* =================================================
            TABLE GRID
        ================================================= */}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">

          {tables.map(
            (table) => {

              const status =
                getTableStatus(
                  table.number
                );


              const activeOrder =
                getActiveOrder(
                  table.number
                );


              return (

                <button
                  key={table.id}
                  onClick={() =>
                    handleTableClick(
                      table
                    )
                  }
                  className={`
                    relative rounded-2xl border-2 px-3 py-4
                    flex flex-col items-center justify-center
                    min-h-[120px]
                    transition
                    shadow-sm
                    hover:shadow-md
                    active:scale-95
                    ${statusStyles[status]}
                    ${
                      status ===
                      "ready"
                        ? "animate-pulse"
                        : ""
                    }
                  `}
                >

                  <div className="text-2xl mb-1">
                    🪑
                  </div>


                  <span className="text-xl font-extrabold">
                    №
                    {
                      table.number
                    }
                  </span>


                  <span className="text-xs font-bold mt-1">
                    {
                      statusLabels[
                        status
                      ]
                    }
                  </span>


                  {activeOrder && (

                    <span className="text-[10px] mt-1 opacity-75 font-semibold">

                      🕐{" "}

                      {
                        formatTime(
                          activeOrder.createdAt
                        )
                      }

                    </span>

                  )}

                </button>

              );
            }
          )}

        </div>

      </main>


      {/* ===================================================
          TABLE MODAL
      =================================================== */}

      {selectedTable && (

        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-hidden">

            {/* HEADER */}

            <div className="flex justify-between items-center mb-3">

              <h2 className="text-lg font-extrabold">
                Stol №
                {
                  selectedTable.number
                }
              </h2>


              <button
                onClick={() =>
                  setSelectedTable(
                    null
                  )
                }
                className="text-gray-400 text-lg hover:text-gray-600"
              >
                ✕
              </button>

            </div>


            {(() => {

              const order =
                getActiveOrder(
                  selectedTable.number
                );


              if (!order) {

                return (

                  <p className="text-center py-4 text-gray-400">
                    Buyurtma topilmadi
                  </p>

                );
              }


              const items =
                Array.isArray(
                  order.kitchenItems
                )
                  ? order.kitchenItems
                  : [];


              const totalPrice =
                items.reduce(
                  (
                    sum,
                    item
                  ) =>
                    sum +
                    Number(
                      item.price ||
                      0
                    ) *
                    Number(
                      item.quantity ||
                      1
                    ),
                  0
                );


              return (

                <>

                  {/* =====================================
                      ORDER STATUS
                  ===================================== */}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-center">

                    <div className="font-bold text-amber-700">

                      👨‍🍳 Oshpaz tayyorlamoqda...

                    </div>

                    <div className="text-xs text-amber-600 mt-1">

                      Har bir tayyor taom yonida
                      "Yetkazildi" tugmasi chiqadi.

                    </div>

                  </div>


                  {/* =====================================
                      FOODS
                  ===================================== */}

                  <div className="space-y-2 mb-4 max-h-[390px] overflow-y-auto border-t border-b py-3">

                    {items.map(
                      (
                        item,
                        idx
                      ) => {

                        const isReady =
                          item.isReady ===
                          true;


                        const isDelivered =
                          item.isDelivered ===
                          true;


                        return (

                          <div
                            key={idx}
                            className={`
                              rounded-xl
                              px-3
                              py-3
                              border
                              ${
                                isDelivered
                                  ? "bg-green-50 border-green-200"
                                  : isReady
                                  ? "bg-blue-50 border-blue-200"
                                  : "bg-gray-50 border-gray-200"
                              }
                            `}
                          >

                            <div className="flex items-center justify-between gap-3">

                              {/* TAOM */}

                              <div className="flex-1 min-w-0">

                                <div className="font-bold text-sm text-gray-800">

                                  {
                                    item.name ||
                                    item.title ||
                                    "Taom"
                                  }

                                  {" x "}

                                  {
                                    item.quantity ||
                                    1
                                  }

                                </div>


                                <div className="text-sm font-bold text-[#3b2418] mt-1">

                                  {(
                                    Number(
                                      item.price ||
                                      0
                                    ) *
                                    Number(
                                      item.quantity ||
                                      1
                                    )
                                  ).toLocaleString()}

                                  {" so'm"}

                                </div>

                              </div>


                              {/* =================================
                                  HOLAT / TUGMA
                              ================================= */}

                              <div className="shrink-0">

                                {/* --------------------------------
                                    HALI TAYYOR EMAS
                                -------------------------------- */}

                                {!isReady &&
                                  !isDelivered && (

                                  <span className="inline-flex items-center bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">

                                    ⏳ Tayyorlanmoqda

                                  </span>

                                )}


                                {/* --------------------------------
                                    TAYYOR
                                -------------------------------- */}

                                {isReady &&
                                  !isDelivered && (

                                  <button
                                    type="button"
                                    onClick={() =>
                                      markFoodDelivered(
                                        order,
                                        idx
                                      )
                                    }
                                    className="bg-green-600 hover:bg-green-700 active:scale-95 text-white px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap shadow-sm transition"
                                  >

                                    ✓ Yetkazildi

                                  </button>

                                )}


                                {/* --------------------------------
                                    YETKAZILGAN
                                -------------------------------- */}

                                {isDelivered && (

                                  <span className="inline-flex items-center bg-green-100 text-green-700 border border-green-300 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">

                                    ✓ Yetkazildi

                                  </span>

                                )}

                              </div>

                            </div>

                          </div>

                        );

                      }
                    )}


                    {/* ===================================
                        JAMI
                    =================================== */}

                    <div className="flex justify-between font-extrabold text-base pt-3 text-[#3b2418]">

                      <span>
                        Jami:
                      </span>

                      <span>
                        {
                          totalPrice.toLocaleString()
                        }{" "}
                        so'm
                      </span>

                    </div>

                  </div>


                  {/* =====================================
                      YANA TAOM
                  ===================================== */}

                  <div className="flex flex-col gap-2">

                    <button
                      onClick={() =>
                        navigate(
                          `/waiter/order?table=${selectedTable.number}`
                        )
                      }
                      className="w-full bg-[#d97706] hover:bg-[#c56600] text-white font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
                    >

                      ➕ Yana taom qo'shish

                    </button>

                  </div>

                </>

              );

            })()}

          </div>

        </div>

      )}


      {/* ===================================================
          LOGOUT MODAL
      =================================================== */}

      {logoutModalOpen && (

        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">

            <div className="text-4xl mb-3">
              🚪
            </div>


            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Tizimdan chiqmoqchimisiz?
            </h3>


            <p className="text-xs text-gray-500 mb-6">
              Rostdan ham ofitsiant panelidan
              chiqishni xohlaysizmi?
            </p>


            <div className="flex gap-3">

              <button
                onClick={
                  handleLogout
                }
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm transition"
              >
                Ha, Chiqish
              </button>


              <button
                onClick={() =>
                  setLogoutModalOpen(
                    false
                  )
                }
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition"
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