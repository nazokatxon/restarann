import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db } from "../../firebase/config.js";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function TableGrid() {
  const auth = getAuth();
  const navigate = useNavigate();

  // =========================================================
  // STATE
  // =========================================================

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

  const [audioEnabled, setAudioEnabled] = useState(false);

  // =========================================================
  // REFS
  // =========================================================

  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);

  const audioUnlockedRef = useRef(false);

  // Birinchi Firestore yuklanganda ovoz chiqmasligi uchun
  const isInitialOrdersLoadRef = useRef(true);

  // Oldingi order holatlari
  const previousOrdersRef = useRef(new Map());

  // Oldin notification berilgan ready itemlar
  const notifiedReadyItemsRef = useRef(new Set());

  // Oldin notification berilgan yangi orderlar
  const notifiedNewOrdersRef = useRef(new Set());

  // Notification queue
  const notificationQueueRef = useRef([]);

  // Hozir notification ko'rsatilayaptimi
  const notificationShowingRef = useRef(false);

  // =========================================================
  // HELPER: ORDER ITEMS
  // =========================================================

  const getOrderItems = (order) => {
    if (!order) return [];

    if (Array.isArray(order.kitchenItems)) {
      return order.kitchenItems;
    }

    if (Array.isArray(order.items)) {
      return order.items;
    }

    if (Array.isArray(order.products)) {
      return order.products;
    }

    return [];
  };

  // =========================================================
  // HELPER: ITEM KEY
  // Index o'rniga imkon bo'lsa item id ishlatamiz
  // =========================================================

  const getItemKey = (item, index) => {
    return (
      item?.id ||
      item?.itemId ||
      item?.productId ||
      item?.uid ||
      `${item?.name || item?.title || item?.productName || "item"}-${index}`
    );
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      await signOut(auth);

      toast.info("Tizimdan chiqdingiz");

      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);

      toast.error("Chiqishda xatolik yuz berdi!");
    }
  };

  // =========================================================
  // AUDIO CONTEXT
  // =========================================================

  const getAudioContext = () => {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        console.error("Bu browser Web Audio API'ni qo'llamaydi.");
        return null;
      }

      if (!audioCtxRef.current) {
        const ctx = new AudioContextClass();

        const masterGain = ctx.createGain();

        masterGain.gain.value = 0.9;

        masterGain.connect(ctx.destination);

        audioCtxRef.current = ctx;
        masterGainRef.current = masterGain;
      }

      return audioCtxRef.current;
    } catch (error) {
      console.error("AudioContext yaratishda xatolik:", error);

      return null;
    }
  };

  // =========================================================
  // AUDIO UNLOCK
  // Browser birinchi user interaction'dan keyin audio beradi
  // =========================================================

  const unlockAudio = async () => {
    try {
      const ctx = getAudioContext();

      if (!ctx) {
        setAudioEnabled(false);
        return false;
      }

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      if (ctx.state !== "running") {
        console.warn("AudioContext ishlamadi:", ctx.state);

        setAudioEnabled(false);

        return false;
      }

      // Juda qisqa silent oscillator
      // Ba'zi browserlarda audio'ni to'liq unlock qilishga yordam beradi
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      gain.gain.setValueAtTime(0.00001, ctx.currentTime);

      oscillator.connect(gain);

      if (masterGainRef.current) {
        gain.connect(masterGainRef.current);
      } else {
        gain.connect(ctx.destination);
      }

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.02);

      audioUnlockedRef.current = true;

      setAudioEnabled(true);

      return true;
    } catch (error) {
      console.error("Audio unlock xatosi:", error);

      audioUnlockedRef.current = false;
      setAudioEnabled(false);

      return false;
    }
  };

  // =========================================================
  // COMPONENT MOUNT AUDIO INTERACTION
  // =========================================================

  useEffect(() => {
    const handleInteraction = async () => {
      if (!audioUnlockedRef.current) {
        await unlockAudio();
      }
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  // =========================================================
  // COMPONENT UNMOUNT AUDIO CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // =========================================================
  // UNIVERSAL BEEP FUNCTION
  // =========================================================

  const playTone = ({
    frequency = 800,
    startTime = 0,
    duration = 0.3,
    volume = 0.5,
    type = "sine",
  }) => {
    const ctx = getAudioContext();

    if (!ctx || ctx.state !== "running") {
      return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime + startTime;

    oscillator.type = type;

    oscillator.frequency.setValueAtTime(
      frequency,
      now
    );

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      Math.max(volume, 0.0002),
      now + 0.02
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration
    );

    oscillator.connect(gain);

    if (masterGainRef.current) {
      gain.connect(masterGainRef.current);
    } else {
      gain.connect(ctx.destination);
    }

    oscillator.start(now);

    oscillator.stop(now + duration + 0.05);
  };

  // =========================================================
  // TEST SOUND
  // =========================================================

  const playTestSound = async () => {
    try {
      const unlocked = await unlockAudio();

      if (!unlocked) {
        toast.error(
          "🔇 Browser ovozga ruxsat bermadi. Tugmani yana bir marta bosing."
        );

        return;
      }

      playTone({
        frequency: 700,
        startTime: 0,
        duration: 0.15,
        volume: 0.7,
      });

      playTone({
        frequency: 900,
        startTime: 0.18,
        duration: 0.15,
        volume: 0.7,
      });

      playTone({
        frequency: 1200,
        startTime: 0.36,
        duration: 0.3,
        volume: 0.8,
      });

      toast.success("🔊 Ovoz ishlayapti!");
    } catch (error) {
      console.error("Test sound error:", error);

      toast.error("Ovoz chiqarishda xatolik!");
    }
  };

  // =========================================================
  // YANGI ORDER SOUND
  // =========================================================

  const playNewOrderSound = async () => {
    try {
      const ctx = getAudioContext();

      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      if (ctx.state !== "running") {
        console.warn(
          "Yangi order ovozi: AudioContext running emas"
        );

        return;
      }

      // Kuchli yangi order signali
      playTone({
        frequency: 700,
        startTime: 0,
        duration: 0.22,
        volume: 0.85,
      });

      playTone({
        frequency: 700,
        startTime: 0.3,
        duration: 0.22,
        volume: 0.85,
      });

      playTone({
        frequency: 1000,
        startTime: 0.6,
        duration: 0.35,
        volume: 0.9,
      });
    } catch (error) {
      console.error("New order sound error:", error);
    }
  };

  // =========================================================
  // TAYYOR FOOD SOUND
  // =========================================================

  const playReadySound = async () => {
    try {
      const ctx = getAudioContext();

      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      if (ctx.state !== "running") {
        console.warn(
          "Ready sound: AudioContext running emas"
        );

        return;
      }

      // Tayyor taom uchun boshqacha signal
      playTone({
        frequency: 880,
        startTime: 0,
        duration: 0.2,
        volume: 0.8,
      });

      playTone({
        frequency: 1100,
        startTime: 0.28,
        duration: 0.2,
        volume: 0.85,
      });

      playTone({
        frequency: 1320,
        startTime: 0.56,
        duration: 0.3,
        volume: 0.9,
      });
    } catch (error) {
      console.error("Ready sound error:", error);
    }
  };

  // =========================================================
  // NOTIFICATION QUEUE
  // =========================================================

  const showNextNotification = async () => {
    if (notificationShowingRef.current) {
      return;
    }

    if (notificationQueueRef.current.length === 0) {
      return;
    }

    notificationShowingRef.current = true;

    const notification =
      notificationQueueRef.current.shift();

    await playReadySound();

    toast.success(
      `🛎️ STOL №${notification.tableNumber}: ${notification.itemName} TAYYOR!`,
      {
        toastId: `ready-${notification.id}`,
        position: "top-center",
        autoClose: 5000,
      }
    );

    setTimeout(() => {
      notificationShowingRef.current = false;

      showNextNotification();
    }, 2500);
  };

  // =========================================================
  // FIRESTORE LISTENERS
  // =========================================================

  useEffect(() => {
    setLoading(true);

    // =======================================================
    // TABLES LISTENER
    // =======================================================

    const qTables = query(
      collection(db, "tables")
    );

    const unsubTables = onSnapshot(
      qTables,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        data.sort(
          (a, b) =>
            Number(a.number || 0) -
            Number(b.number || 0)
        );

        setTables(data);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Tables listener error:",
          error
        );

        setLoading(false);

        toast.error(
          "Stollarni yuklashda xatolik!"
        );
      }
    );

    // =======================================================
    // ORDERS LISTENER
    // =======================================================

    const qOrders = query(
      collection(db, "orders")
    );

    const unsubOrders = onSnapshot(
      qOrders,
      async (snapshot) => {
        try {
          const data = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          // =================================================
          // INITIAL LOAD
          // Eski orderlarga ovoz bermaymiz
          // =================================================

          if (isInitialOrdersLoadRef.current) {
            snapshot.docs.forEach((orderDoc) => {
              const order = orderDoc.data();

              const items = getOrderItems(order);

              // Barcha mavjud orderlarni oldingi holatga saqlaymiz
              previousOrdersRef.current.set(
                orderDoc.id,
                order
              );

              // Mavjud orderlar yangi order hisoblanmasin
              notifiedNewOrdersRef.current.add(
                orderDoc.id
              );

              // Allaqachon tayyor itemlar notification bermasin
              items.forEach((item, index) => {
                const itemKey = getItemKey(
                  item,
                  index
                );

                const notificationId =
                  `${orderDoc.id}-${itemKey}`;

                const isReady =
                  item?.readyForWaiter === true ||
                  item?.isReady === true;

                if (isReady) {
                  notifiedReadyItemsRef.current.add(
                    notificationId
                  );
                }
              });
            });

            isInitialOrdersLoadRef.current = false;

            setOrders(data);
            setLoading(false);

            return;
          }

          // =================================================
          // NEW ORDER + READY ITEM DETECTION
          // =================================================

          snapshot.docs.forEach((orderDoc) => {
            const orderId = orderDoc.id;

            const newOrder = orderDoc.data();

            const oldOrder =
              previousOrdersRef.current.get(orderId);

            const oldItems =
              getOrderItems(oldOrder);

            const newItems =
              getOrderItems(newOrder);

            // =============================================
            // YANGI ORDER ANIQLASH
            // =============================================

            if (!oldOrder) {
              const hasItems =
                newItems.length > 0;

              if (
                hasItems &&
                !notifiedNewOrdersRef.current.has(
                  orderId
                )
              ) {
                notifiedNewOrdersRef.current.add(
                  orderId
                );

                const tableNumber =
                  newOrder.tableNumber ??
                  newOrder.table ??
                  newOrder.tableNo ??
                  "—";

                toast.info(
                  `🔔 STOL №${tableNumber}: Yangi buyurtma!`,
                  {
                    toastId: `new-order-${orderId}`,
                    autoClose: 5000,
                    position: "top-center",
                  }
                );

                playNewOrderSound();
              }
            }

            // =============================================
            // READY ITEM ANIQLASH
            // =============================================

            newItems.forEach(
              (newItem, newIndex) => {
                const newItemKey =
                  getItemKey(
                    newItem,
                    newIndex
                  );

                // Avval shu item id bilan qidiramiz
                let oldItem =
                  oldItems.find(
                    (item, oldIndex) =>
                      getItemKey(
                        item,
                        oldIndex
                      ) === newItemKey
                  );

                // Topilmasa index orqali
                if (!oldItem) {
                  oldItem =
                    oldItems[newIndex];
                }

                const oldReady =
                  oldItem?.readyForWaiter === true ||
                  oldItem?.isReady === true;

                const newReady =
                  newItem?.readyForWaiter === true ||
                  newItem?.isReady === true;

                const notificationId =
                  `${orderId}-${newItemKey}`;

                // Faqat false -> true o'tganda
                if (
                  !oldReady &&
                  newReady &&
                  !notifiedReadyItemsRef.current.has(
                    notificationId
                  )
                ) {
                  notifiedReadyItemsRef.current.add(
                    notificationId
                  );

                  notificationQueueRef.current.push({
                    id: notificationId,

                    tableNumber:
                      newOrder.tableNumber ??
                      newOrder.table ??
                      newOrder.tableNo ??
                      "—",

                    itemName:
                      newItem.name ||
                      newItem.title ||
                      newItem.productName ||
                      "Taom",
                  });

                  showNextNotification();
                }
              }
            );

            // Yangi holatni oldingi holat sifatida saqlaymiz
            previousOrdersRef.current.set(
              orderId,
              newOrder
            );
          });

          // =================================================
          // O'CHIRILGAN ORDERLARNI REF'DAN OLIB TASHLASH
          // =================================================

          const currentIds = new Set(
            snapshot.docs.map((d) => d.id)
          );

          previousOrdersRef.current.forEach(
            (_, id) => {
              if (!currentIds.has(id)) {
                previousOrdersRef.current.delete(id);

                notifiedNewOrdersRef.current.delete(
                  id
                );
              }
            }
          );

          setOrders(data);
          setLoading(false);
        } catch (error) {
          console.error(
            "Orders processing error:",
            error
          );

          setLoading(false);
        }
      },
      (error) => {
        console.error(
          "Orders listener error:",
          error
        );

        toast.error(
          "Buyurtmalarni kuzatishda xatolik!"
        );

        setLoading(false);
      }
    );

    return () => {
      unsubTables();
      unsubOrders();
    };
  }, []);

  // =========================================================
  // ACTIVE ORDER
  // =========================================================

  const getActiveOrder = (tableNumber) => {
    return orders.find((order) => {
      const orderTable =
        order.tableNumber ??
        order.table ??
        order.tableNo;

      const isSameTable =
        String(orderTable) ===
        String(tableNumber);

      const isClosed =
        order.kitchenStatus === "closed" ||
        order.status === "closed" ||
        order.status === "completed";

      return isSameTable && !isClosed;
    });
  };

  // =========================================================
  // TABLE STATUS
  // =========================================================

  const getTableStatus = (tableNumber) => {
    const activeOrder =
      getActiveOrder(tableNumber);

    if (!activeOrder) {
      return "empty";
    }

    const items =
      getOrderItems(activeOrder);

    if (items.length === 0) {
      return "occupied";
    }

    const allDelivered =
      items.every(
        (item) =>
          item.waiterTaken === true ||
          item.isDelivered === true
      );

    if (allDelivered) {
      return "empty";
    }

    const allReady =
      items.every(
        (item) =>
          item.readyForWaiter === true ||
          item.isReady === true ||
          item.waiterTaken === true ||
          item.isDelivered === true
      );

    if (allReady) {
      return "ready";
    }

    return "occupied";
  };

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (date) => {
    if (!date) return "";

    try {
      const d =
        date?.toDate
          ? date.toDate()
          : new Date(date);

      if (Number.isNaN(d.getTime())) {
        return "";
      }

      return d.toLocaleTimeString(
        "uz-UZ",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );
    } catch {
      return "";
    }
  };

  // =========================================================
  // DELIVER FOOD
  // =========================================================

  const markFoodDelivered = async (
    order,
    itemIndex
  ) => {
    try {
      let items = [];
      let fieldName = "";

      if (Array.isArray(order.kitchenItems)) {
        items = [...order.kitchenItems];
        fieldName = "kitchenItems";
      } else if (Array.isArray(order.items)) {
        items = [...order.items];
        fieldName = "items";
      } else if (Array.isArray(order.products)) {
        items = [...order.products];
        fieldName = "products";
      } else {
        toast.error("Buyurtma itemlari topilmadi!");
        return;
      }

      const item = items[itemIndex];

      if (!item) {
        toast.error("Taom topilmadi!");
        return;
      }

      const isReady =
        item.readyForWaiter === true ||
        item.isReady === true;

      if (!isReady) {
        toast.warning(
          "❗ Avval oshpaz bu taomni TAYYOR qilishi kerak!"
        );

        return;
      }

      const isDelivered =
        item.waiterTaken === true ||
        item.isDelivered === true;

      if (isDelivered) {
        return;
      }

      items[itemIndex] = {
        ...item,
        waiterTaken: true,
        isDelivered: true,
        deliveryStatus: "delivered",
        deliveredAt: new Date().toISOString(),
      };

      const allDelivered =
        items.length > 0 &&
        items.every(
          (currentItem) =>
            currentItem.waiterTaken === true ||
            currentItem.isDelivered === true
        );

      await updateDoc(
        doc(db, "orders", order.id),
        {
          [fieldName]: items,

          kitchenStatus: allDelivered
            ? "completed"
            : "ready",

          updatedAt: serverTimestamp(),
        }
      );

      toast.success(
        `✅ ${
          item.name ||
          item.title ||
          item.productName ||
          "Taom"
        } yetkazildi!`
      );
    } catch (error) {
      console.error(
        "Delivery error:",
        error
      );

      toast.error(
        "❌ Taomni yetkazishda xatolik!"
      );
    }
  };

  // =========================================================
  // CLOSE TABLE
  // =========================================================

  const handleCloseTable = async (
    orderId
  ) => {
    const confirmed = window.confirm(
      "Haqiqatan ham ushbu stolni yopmoqchimisiz?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await updateDoc(
        doc(db, "orders", orderId),
        {
          status: "closed",
          kitchenStatus: "closed",
          closedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      setSelectedTable(null);

      toast.success(
        "✅ Stol muvaffaqiyatli yopildi!"
      );
    } catch (error) {
      console.error(
        "Close table error:",
        error
      );

      toast.error(
        "Stolni yopishda xatolik yuz berdi!"
      );
    }
  };

  // =========================================================
  // TABLE CLICK
  // =========================================================

  const handleTableClick = async (
    table
  ) => {
    // Stolga bosilganda audio ham unlock bo'ladi
    await unlockAudio();

    const status =
      getTableStatus(table.number);

    if (status === "empty") {
      navigate(
        `/waiter/order?table=${table.number}`
      );
    } else {
      setSelectedTable(table);
    }
  };

  // =========================================================
  // STATUS STYLES
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
    empty: "Bo'sh",
    occupied: "Tayyorlanmoqda",
    ready: "Tayyor!",
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
      {/* =====================================================
          HEADER
      ===================================================== */}

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
            {/* AUDIO */}

            <button
              type="button"
              onClick={playTestSound}
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                audioEnabled
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {audioEnabled
                ? "🔊 Ovoz ON"
                : "🔇 Ovoz ON qilish"}
            </button>

            {/* LOGOUT */}

            <button
              type="button"
              onClick={() =>
                setLogoutModalOpen(true)
              }
              className="border border-red-200 text-red-500 bg-white hover:bg-red-50 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              ↪ Chiqish
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="w-full max-w-5xl mx-auto px-4 py-5">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-2xl font-extrabold text-[#3b2418]">
            Stollar
          </h2>

          <button
            type="button"
            onClick={async () => {
              await unlockAudio();

              navigate("/waiter/order");
            }}
            className="bg-[#d97706] hover:bg-[#c56600] text-white px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
          >
            + Buyurtma
          </button>
        </div>

        {/* AUDIO INFO */}

        {!audioEnabled && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-semibold">
            🔇 Buyurtma va tayyor taom ovozlarini
            eshitish uchun yuqoridagi{" "}
            <b>"Ovoz ON qilish"</b> tugmasini bir
            marta bosing.
          </div>
        )}

        {audioEnabled && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-semibold">
            🔊 Ovoz yoqilgan. Yangi buyurtma va
            tayyor taomlar haqida signal beriladi.
          </div>
        )}

        {/* ===================================================
            TABLE GRID
        =================================================== */}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tables.map((table) => {
            const status =
              getTableStatus(table.number);

            const activeOrder =
              getActiveOrder(table.number);

            return (
              <button
                key={table.id}
                type="button"
                onClick={() =>
                  handleTableClick(table)
                }
                className={`
                  relative rounded-2xl border-2 px-3 py-4
                  flex flex-col items-center justify-center
                  min-h-[120px] transition shadow-sm cursor-pointer
                  hover:shadow-md active:scale-95
                  ${statusStyles[status]}
                  ${
                    status === "ready"
                      ? "animate-pulse"
                      : ""
                  }
                `}
              >
                <div className="text-2xl mb-1">
                  🪑
                </div>

                <span className="text-xl font-extrabold">
                  № {table.number}
                </span>

                <span className="text-xs font-bold mt-1">
                  {statusLabels[status]}
                </span>

                {activeOrder && (
                  <span className="text-[10px] mt-1 opacity-75 font-semibold">
                    🕐{" "}
                    {formatTime(
                      activeOrder.createdAt
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* =====================================================
          TABLE DETAIL MODAL
      ===================================================== */}

      {selectedTable && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-extrabold">
                Stol № {selectedTable.number}
              </h2>

              <button
                type="button"
                onClick={() =>
                  setSelectedTable(null)
                }
                className="text-gray-400 text-lg hover:text-gray-600 cursor-pointer"
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
                getOrderItems(order);

              const totalPrice =
                items.reduce(
                  (sum, item) =>
                    sum +
                    Number(item.price || 0) *
                      Number(
                        item.quantity ||
                          item.count ||
                          1
                      ),
                  0
                );

              const allDelivered =
                items.length > 0 &&
                items.every(
                  (item) =>
                    item.waiterTaken === true ||
                    item.isDelivered === true
                );

              return (
                <>
                  {/* STATUS */}

                  <div
                    className={`border rounded-xl px-4 py-3 mb-4 text-center ${
                      allDelivered
                        ? "bg-green-50 border-green-200"
                        : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    <div
                      className={`font-bold ${
                        allDelivered
                          ? "text-green-700"
                          : "text-amber-700"
                      }`}
                    >
                      {allDelivered
                        ? "✅ Barcha taomlar yetkazildi"
                        : "👨‍🍳 Oshpaz tayyorlamoqda..."}
                    </div>

                    {!allDelivered && (
                      <div className="text-xs text-amber-600 mt-1">
                        Tayyor bo'lgan taom yonida
                        "Yetkazildi" tugmasi chiqadi.
                      </div>
                    )}
                  </div>

                  {/* ITEMS */}

                  <div className="space-y-2 mb-4 max-h-[320px] overflow-y-auto border-t border-b py-3 flex-1">
                    {items.map((item, idx) => {
                      const isReady =
                        item.readyForWaiter ===
                          true ||
                        item.isReady === true;

                      const isDelivered =
                        item.waiterTaken === true ||
                        item.isDelivered === true;

                      return (
                        <div
                          key={
                            getItemKey(item, idx)
                          }
                          className={`
                            rounded-xl px-3 py-3 border
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
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-gray-800">
                                {item.name ||
                                  item.title ||
                                  item.productName ||
                                  "Taom"}{" "}
                                x{" "}
                                {item.quantity ||
                                  item.count ||
                                  1}
                              </div>

                              <div className="text-sm font-bold text-[#3b2418] mt-1">
                                {(
                                  Number(
                                    item.price || 0
                                  ) *
                                  Number(
                                    item.quantity ||
                                      item.count ||
                                      1
                                  )
                                ).toLocaleString()}{" "}
                                so'm
                              </div>
                            </div>

                            <div className="shrink-0">
                              {!isReady &&
                                !isDelivered && (
                                  <span className="inline-flex items-center bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">
                                    ⏳ Tayyorlanmoqda
                                  </span>
                                )}

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
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
                                  >
                                    🚚 Yetkazildi
                                  </button>
                                )}

                              {isDelivered && (
                                <span className="inline-flex items-center bg-green-200 text-green-800 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">
                                  ✅ Yetkazildi
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* TOTAL */}

                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-gray-600">
                      Jami:
                    </span>

                    <span className="text-lg font-black text-[#3b2418]">
                      {totalPrice.toLocaleString()}{" "}
                      so'm
                    </span>
                  </div>

                  {/* ACTION BUTTONS */}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await unlockAudio();

                        navigate(
                          `/waiter/order?table=${selectedTable.number}&orderId=${order.id}`
                        );
                      }}
                      className="flex-1 bg-[#d97706] hover:bg-[#c56600] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>+</span>
                      Yana taom qo'shish
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCloseTable(order.id)
                      }
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 cursor-pointer"
                    >
                      🛑 Stolni yopish
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* =====================================================
          LOGOUT MODAL
      ===================================================== */}

      {logoutModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 text-center">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Tizimdan chiqish
            </h3>

            <p className="text-sm text-gray-500 mb-5">
              Haqiqatan ham tizimdan
              chiqmoqchimisiz?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setLogoutModalOpen(false)
                }
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition cursor-pointer"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition cursor-pointer"
              >
                Chiqish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}