import React, { useEffect, useState, useRef } from "react";
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
import { getAuth, signOut } from "firebase/auth";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function TableGrid() {
  const { cafeId, user, currentUser } = useAuth();
  const waiterUser = user || currentUser;
  const navigate = useNavigate();

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [newTableNumber, setNewTableNumber] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  // 🔎 SEARCH
  const [searchTerm, setSearchTerm] = useState("");

  // =========================================================
  // 🔊 AUDIO
  // =========================================================

  const audioCtxRef = useRef(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // =========================================================
  // 🔔 XABARLAR NAVBATI
  // =========================================================

  const notificationQueueRef = useRef([]);
  const notificationShowingRef = useRef(false);
  const notifiedOrdersRef = useRef(new Set());

  // =========================================================
  // 🔊 OVOZ
  // =========================================================

  const playSmsSound = async () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext =
          window.AudioContext || window.webkitAudioContext;

        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }

      const ctx = audioCtxRef.current;

      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      // 1-beep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(700, now);

      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.12
      );

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // 2-beep
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1050, now + 0.16);

      gain2.gain.setValueAtTime(0.18, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.38
      );

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      // 3-beep
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();

      osc3.type = "sine";
      osc3.frequency.setValueAtTime(1250, now + 0.42);

      gain3.gain.setValueAtTime(0.2, now + 0.42);
      gain3.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.7
      );

      osc3.connect(gain3);
      gain3.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);

      osc2.start(now + 0.16);
      osc2.stop(now + 0.38);

      osc3.start(now + 0.42);
      osc3.stop(now + 0.7);
    } catch (error) {
      console.log("Audio error:", error);
    }
  };

  // =========================================================
  // 🔓 AUDIO UNLOCK
  // =========================================================

  useEffect(() => {
    const handleUserInteraction = async () => {
      try {
        if (!audioCtxRef.current) {
          const AudioContext =
            window.AudioContext || window.webkitAudioContext;

          if (AudioContext) {
            audioCtxRef.current = new AudioContext();
          }
        }

        if (
          audioCtxRef.current &&
          audioCtxRef.current.state === "suspended"
        ) {
          await audioCtxRef.current.resume();
        }

        setAudioUnlocked(true);
      } catch (error) {
        console.log(error);
      }
    };

    window.addEventListener(
      "click",
      handleUserInteraction
    );

    window.addEventListener(
      "touchstart",
      handleUserInteraction
    );

    return () => {
      window.removeEventListener(
        "click",
        handleUserInteraction
      );

      window.removeEventListener(
        "touchstart",
        handleUserInteraction
      );
    };
  }, []);

  // =========================================================
  // 🔔 BIRIN-KETIN XABAR
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

    await playSmsSound();

    // 🗣️ OVOZLI XABAR
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();

        const speech =
          new SpeechSynthesisUtterance(
            `Stol ${notification.tableNumber} buyurtmasi tayyor`
          );

        speech.lang = "uz-UZ";
        speech.rate = 0.9;
        speech.pitch = 1;
        speech.volume = 1;

        window.speechSynthesis.speak(speech);
      }
    } catch (speechError) {
      console.log("Speech error:", speechError);
    }

    // 🔔 TOAST
    const toastId = `ready-${notification.id}`;

    toast.success(
      `🛎️ Stol ${notification.tableNumber} buyurtmasi tayyor!`,
      {
        toastId,
        position: "top-right",
        autoClose: 3500,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        icon: "🍲",

        style: {
          background: "#8B4513",
          color: "#fff",
          fontWeight: "700",
          borderRadius: "14px",
          minWidth: "280px",
        },
      }
    );

    setTimeout(() => {
      notificationShowingRef.current = false;
      showNextNotification();
    }, 3800);
  };

  // =========================================================
  // 🔥 TABLE + ORDER REAL-TIME
  // =========================================================

  useEffect(() => {
    if (!cafeId) return;

    // =======================================================
    // STOLLAR
    // =======================================================

    const qTables = query(
      collection(db, "tables"),
      where("cafeId", "==", cafeId)
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
            (a.number || 0) -
            (b.number || 0)
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
      }
    );

    // =======================================================
    // BUYURTMALAR
    // =======================================================

    const qOrders = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId),
      where("paymentStatus", "==", "unpaid")
    );

    const unsubOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // ===================================================
        // 🔔 CHEF TAYYOR QILGAN BUYURTMA
        // ===================================================

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "modified") {
            return;
          }

          const updatedOrder = change.doc.data();

          if (
            updatedOrder.kitchenStatus !== "ready"
          ) {
            return;
          }

          // FAQAT SHU OFITSIANT
          if (
            updatedOrder.waiterId &&
            waiterUser?.uid &&
            updatedOrder.waiterId !== waiterUser.uid
          ) {
            return;
          }

          // FAQAT BIR MARTA
          if (
            notifiedOrdersRef.current.has(
              change.doc.id
            )
          ) {
            return;
          }

          notifiedOrdersRef.current.add(
            change.doc.id
          );

          notificationQueueRef.current.push({
            id: change.doc.id,
            tableNumber:
              updatedOrder.tableNumber || "—",
          });

          showNextNotification();
        });

        setOrders(data);
      },
      (error) => {
        console.error(
          "Orders listener error:",
          error
        );
      }
    );

    return () => {
      unsubTables();
      unsubOrders();
    };
  }, [cafeId, waiterUser?.uid]);

  // =========================================================
  // TABLE STATUS
  // =========================================================

  const getTableStatus = (tableNumber) => {
    const activeOrder = orders.find(
      (o) =>
        String(o.tableNumber) ===
        String(tableNumber)
    );

    if (!activeOrder) {
      return "empty";
    }

    if (
      activeOrder.kitchenStatus === "ready"
    ) {
      return "ready";
    }

    return "occupied";
  };

  // =========================================================
  // ACTIVE ORDER
  // =========================================================

  const getActiveOrder = (tableNumber) => {
    return orders.find(
      (o) =>
        String(o.tableNumber) ===
        String(tableNumber)
    );
  };

  // =========================================================
  // TIME
  // =========================================================

  const formatTime = (date) => {
    if (!date) return "";

    const d = date?.toDate
      ? date.toDate()
      : new Date(date);

    return d.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =========================================================
  // ADD TABLE
  // =========================================================

  const handleAddTable = async (e) => {
    e.preventDefault();

    if (!newTableNumber) {
      alert(
        "Iltimos, stol raqamini kiriting"
      );
      return;
    }

    try {
      await addDoc(
        collection(db, "tables"),
        {
          cafeId,
          number: Number(newTableNumber),
          createdAt: new Date(),
        }
      );

      setNewTableNumber("");
      setModalOpen(false);

      toast.success(
        "Stol muvaffaqiyatli qo'shildi!"
      );
    } catch (error) {
      console.error(
        "Stol qo'shishda xatolik:",
        error
      );

      toast.error(
        "Stol qo'shishda xatolik!"
      );
    }
  };

  // =========================================================
  // DELETE TABLE
  // =========================================================

  const handleDeleteTable = async (tableId) => {
    if (
      !window.confirm(
        "Bu stolni o'chirishga ishonchingiz komilmi?"
      )
    ) {
      return;
    }

    try {
      await deleteDoc(
        doc(db, "tables", tableId)
      );

      toast.success(
        "Stol o'chirildi!"
      );
    } catch (error) {
      console.error(
        "Stolni o'chirishda xatolik:",
        error
      );

      toast.error(
        "Stolni o'chirishda xatolik!"
      );
    }
  };

  // =========================================================
  // DELIVERED
  // =========================================================

  const markOrderDelivered = async (order) => {
    try {
      await updateDoc(
        doc(db, "orders", order.id),
        {
          kitchenStatus: "delivered",
        }
      );

      setSelectedTable(null);

      toast.success(
        "Buyurtma yetkazildi!"
      );
    } catch (error) {
      console.error(
        "Statusni yangilashda xatolik:",
        error
      );
    }
  };

  // =========================================================
  // TABLE CLICK
  // =========================================================

  const handleTableClick = (table) => {
    const status = getTableStatus(
      table.number
    );

    if (status === "empty") {
      navigate(
        `/waiter/order?table=${table.number}`
      );
    } else {
      setSelectedTable(table);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      const auth = getAuth();

      await signOut(auth);

      setLogoutModalOpen(false);

      navigate("/login", {
        replace: true,
      });
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
  // SEARCH
  // =========================================================

  const filteredTables = tables.filter(
    (table) =>
      String(table.number)
        .toLowerCase()
        .includes(
          searchTerm
            .trim()
            .toLowerCase()
        )
  );

  // =========================================================
  // STYLES
  // =========================================================

  const statusStyles = {
    empty:
      "bg-white border-gray-200 text-gray-800",

    occupied:
      "bg-[#fff7e8] border-amber-400 text-amber-800",

    ready:
      "bg-green-50 border-green-500 text-green-800",
  };

  const statusLabels = {
    empty: "Bo'sh",
    occupied: "Band",
    ready: "Tayyor!",
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5ef] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm px-6 py-5 text-sm text-gray-500">
          Yuklanmoqda...
        </div>
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
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">

            {/* LOGO */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#fff0d2] flex items-center justify-center text-lg shrink-0">
                🍲
              </div>

              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-[#6f3518] truncate">
                  AJ Cafe
                </h1>

                <p className="text-[10px] sm:text-xs text-gray-400">
                  Ofitsiant paneli
                </p>
              </div>
            </div>

            {/* LOGOUT */}
            <button
              onClick={() =>
                setLogoutModalOpen(true)
              }
              className="
                shrink-0
                border
                border-red-200
                text-red-500
                bg-white
                hover:bg-red-50
                active:scale-95
                px-3
                sm:px-4
                py-2
                rounded-xl
                text-xs
                sm:text-sm
                font-semibold
                transition
              "
            >
              ↪ Chiqish
            </button>

          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">

        {/* AUDIO WARNING */}

        {!audioUnlocked && (
          <div className="
            w-full
            max-w-2xl
            mx-auto
            mb-5
            px-3
            py-2.5
            bg-[#fff5d9]
            border
            border-amber-200
            text-amber-800
            rounded-xl
            text-xs
            sm:text-sm
            text-center
            shadow-sm
          ">
            🔔 Bildirishnoma ovozini yoqish uchun
            ekranga bir marta bosing
          </div>
        )}

        {/* PAGE HEADER */}

        <div className="
          flex
          flex-col
          sm:flex-row
          sm:items-end
          justify-between
          gap-3
          mb-4
        ">

          <div>
            <h2 className="
              text-2xl
              sm:text-3xl
              font-extrabold
              text-[#3b2418]
            ">
              Stollar
            </h2>

            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Kafedagi barcha stollar holati
            </p>
          </div>

          <button
            onClick={() =>
              navigate("/waiter/order")
            }
            className="
              w-full
              sm:w-auto
              bg-[#d97706]
              hover:bg-[#c56600]
              active:scale-[0.98]
              text-white
              px-5
              py-2.5
              rounded-xl
              text-sm
              font-bold
              shadow-sm
              transition
            "
          >
            + Buyurtma
          </button>

        </div>

        {/* =====================================================
            LEGEND + SEARCH
        ===================================================== */}

        <div className="
          bg-white
          border
          border-[#eadfd1]
          rounded-2xl
          p-3
          sm:p-4
          mb-4
          shadow-sm
        ">

          <div className="
            flex
            flex-col
            sm:flex-row
            sm:items-center
            justify-between
            gap-3
          ">

            {/* LEGEND */}

            <div className="
              flex
              items-center
              gap-3
              sm:gap-5
              text-xs
              sm:text-sm
              text-gray-500
              flex-wrap
            ">

              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300" />
                Bo'sh
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Band
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                Tayyor
              </div>

            </div>

            {/* SEARCH */}

            <div className="
              relative
              w-full
              sm:w-56
            ">

              <span className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                text-gray-400
                text-sm
              ">
                🔎
              </span>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
                placeholder="Stol qidirish..."
                className="
                  w-full
                  pl-9
                  pr-3
                  py-2.5
                  bg-[#faf8f4]
                  border
                  border-[#e5dbce]
                  rounded-xl
                  text-sm
                  text-gray-700
                  outline-none
                  focus:bg-white
                  focus:border-amber-400
                  focus:ring-2
                  focus:ring-amber-100
                  transition
                "
              />

            </div>

          </div>
        </div>

        {/* =====================================================
            TABLES SCROLL
        ===================================================== */}

        <div className="
          max-h-[calc(100vh-300px)]
          min-h-[260px]
          overflow-y-auto
          pr-1
          pb-3

          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-[#d8c8b7]
          [&::-webkit-scrollbar-thumb]:rounded-full
        ">

          <div className="
            grid
            grid-cols-2
            sm:grid-cols-3
            md:grid-cols-4
            lg:grid-cols-5
            gap-2.5
            sm:gap-4
          ">

            {filteredTables.map((table) => {
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
                    handleTableClick(table)
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleDeleteTable(
                      table.id
                    );
                  }}
                  className={`
                    relative
                    rounded-2xl
                    border-2
                    px-2
                    sm:px-4
                    py-4
                    sm:py-5
                    flex
                    flex-col
                    items-center
                    justify-center
                    min-h-[118px]
                    sm:min-h-[135px]
                    transition-all
                    duration-200
                    shadow-sm
                    hover:shadow-md
                    active:scale-[0.97]
                    ${statusStyles[status]}
                    ${
                      status === "ready"
                        ? "animate-pulse"
                        : ""
                    }
                  `}
                >

                  {/* ICON */}

                  <div className={`
                    w-8
                    h-8
                    sm:w-9
                    sm:h-9
                    rounded-full
                    flex
                    items-center
                    justify-center
                    mb-1.5
                    ${
                      status === "occupied"
                        ? "bg-amber-100"
                        : status === "ready"
                        ? "bg-green-100"
                        : "bg-gray-100"
                    }
                  `}>
                    🪑
                  </div>

                  {/* NUMBER */}

                  <span className="
                    text-xl
                    sm:text-2xl
                    font-extrabold
                  ">
                    №{table.number}
                  </span>

                  {/* STATUS */}

                  <span className="
                    text-xs
                    sm:text-sm
                    mt-1
                    font-semibold
                  ">
                    {statusLabels[status]}
                  </span>

                  {/* TIME */}

                  {activeOrder && (
                    <span className="
                      text-[9px]
                      sm:text-[10px]
                      mt-1
                      font-medium
                      opacity-70
                    ">
                      🕐{" "}
                      {formatTime(
                        activeOrder.createdAt
                      )}
                    </span>
                  )}

                </button>
              );
            })}

            {/* ADD TABLE */}

            <button
              onClick={() =>
                setModalOpen(true)
              }
              className="
                rounded-2xl
                border-2
                border-dashed
                border-[#d8cbbd]
                bg-white/70
                px-2
                sm:px-4
                py-4
                sm:py-5
                flex
                flex-col
                items-center
                justify-center
                min-h-[118px]
                sm:min-h-[135px]
                text-gray-400
                hover:bg-amber-50
                hover:border-amber-400
                hover:text-amber-600
                active:scale-[0.97]
                transition
              "
            >

              <span className="
                text-3xl
                sm:text-4xl
                font-light
              ">
                +
              </span>

              <span className="
                text-xs
                sm:text-sm
                mt-1
                font-medium
              ">
                Stol qo'shish
              </span>

            </button>

          </div>

          {/* SEARCH EMPTY */}

          {filteredTables.length === 0 && (
            <div className="
              bg-white
              rounded-2xl
              border
              border-[#eadfd1]
              p-8
              text-center
              mt-2
            ">
              <div className="text-3xl mb-2">
                🔎
              </div>

              <p className="text-sm font-semibold text-gray-600">
                Stol topilmadi
              </p>

              <p className="text-xs text-gray-400 mt-1">
                Boshqa stol raqamini qidiring
              </p>
            </div>
          )}

        </div>
      </main>

      {/* =====================================================
          ADD TABLE MODAL
      ===================================================== */}

      {modalOpen && (
        <div className="
          fixed
          inset-0
          bg-black/40
          backdrop-blur-sm
          flex
          items-center
          justify-center
          z-50
          p-4
        ">

          <div className="
            bg-white
            rounded-2xl
            shadow-2xl
            w-full
            max-w-sm
            p-5
          ">

            <h2 className="
              text-lg
              sm:text-xl
              font-bold
              mb-4
              text-gray-800
            ">
              Yangi stol qo'shish
            </h2>

            <form
              onSubmit={handleAddTable}
              className="space-y-4"
            >

              <div>
                <label className="
                  text-sm
                  font-semibold
                  text-gray-700
                ">
                  Stol raqami
                </label>

                <input
                  type="number"
                  value={newTableNumber}
                  onChange={(e) =>
                    setNewTableNumber(
                      e.target.value
                    )
                  }
                  className="
                    w-full
                    mt-2
                    px-4
                    py-3
                    border
                    border-gray-300
                    rounded-xl
                    text-sm
                    bg-white
                    text-gray-900
                    outline-none
                    focus:ring-2
                    focus:ring-amber-400
                  "
                  placeholder="Masalan: 12"
                  autoFocus
                />
              </div>

              <div className="
                flex
                gap-2
              ">

                <button
                  type="submit"
                  className="
                    flex-1
                    bg-amber-600
                    text-white
                    py-3
                    rounded-xl
                    text-sm
                    font-semibold
                    active:scale-95
                    transition
                  "
                >
                  Qo'shish
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(false)
                  }
                  className="
                    flex-1
                    border
                    border-gray-300
                    py-3
                    rounded-xl
                    text-sm
                    font-semibold
                    text-gray-700
                    active:scale-95
                    transition
                  "
                >
                  Bekor qilish
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* =====================================================
          ORDER MODAL
      ===================================================== */}

      {selectedTable && (
        <div className="
          fixed
          inset-0
          bg-black/40
          backdrop-blur-sm
          flex
          items-center
          justify-center
          z-50
          p-3
        ">

          <div className="
            bg-white
            rounded-2xl
            shadow-2xl
            w-full
            max-w-md
            max-h-[90vh]
            overflow-y-auto
            p-5
          ">

            <div className="
              flex
              items-center
              justify-between
              mb-3
            ">

              <h2 className="
                text-lg
                sm:text-xl
                font-bold
                text-gray-800
              ">
                Stol №{selectedTable.number}
              </h2>

              <button
                onClick={() =>
                  setSelectedTable(null)
                }
                className="
                  w-8
                  h-8
                  rounded-full
                  bg-gray-100
                  text-gray-500
                  hover:bg-gray-200
                "
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
                  <p className="
                    text-gray-400
                    text-sm
                    py-5
                    text-center
                  ">
                    Buyurtma topilmadi
                  </p>
                );
              }

              return (
                <>
                  <p className="
                    text-xs
                    text-gray-400
                    mb-4
                  ">
                    🕐 Buyurtma vaqti:{" "}
                    {formatTime(
                      order.createdAt
                    )}
                  </p>

                  <div className="
                    space-y-2
                    mb-4
                    max-h-52
                    overflow-y-auto
                  ">

                    {(order.items || []).map(
                      (item, idx) => (
                        <div
                          key={idx}
                          className="
                            flex
                            justify-between
                            gap-3
                            items-center
                            text-sm
                            text-gray-600
                            bg-gray-50
                            rounded-xl
                            px-3
                            py-2.5
                          "
                        >

                          <span>
                            {item.name} ×{" "}
                            {item.quantity}
                          </span>

                          <span className="font-medium whitespace-nowrap">
                            {(
                              item.price *
                              item.quantity
                            ).toLocaleString()}{" "}
                            so'm
                          </span>

                        </div>
                      )
                    )}

                  </div>

                  <div className="
                    flex
                    justify-between
                    items-center
                    pt-3
                    border-t
                    border-gray-200
                    mb-4
                  ">

                    <span className="font-semibold">
                      Jami:
                    </span>

                    <span className="
                      font-bold
                      text-lg
                      text-amber-700
                    ">
                      {Number(
                        order.totalPrice || 0
                      ).toLocaleString()}{" "}
                      so'm
                    </span>

                  </div>

                  <div className="
                    flex
                    flex-col
                    sm:flex-row
                    gap-2
                    mb-3
                  ">

                    <button
                      onClick={() =>
                        navigate(
                          `/waiter/order?table=${selectedTable.number}`
                        )
                      }
                      className="
                        flex-1
                        bg-amber-600
                        text-white
                        py-3
                        rounded-xl
                        text-sm
                        font-semibold
                      "
                    >
                      Taom qo'shish
                    </button>

                    {order.kitchenStatus ===
                      "ready" && (
                      <button
                        onClick={() =>
                          markOrderDelivered(
                            order
                          )
                        }
                        className="
                          flex-1
                          bg-green-600
                          text-white
                          py-3
                          rounded-xl
                          text-sm
                          font-semibold
                        "
                      >
                        ✓ Yetkazildi
                      </button>
                    )}

                  </div>

                </>
              );
            })()}

            <button
              onClick={() =>
                setSelectedTable(null)
              }
              className="
                w-full
                border
                border-gray-300
                py-3
                rounded-xl
                text-sm
                font-semibold
                text-gray-700
                hover:bg-gray-50
              "
            >
              Yopish
            </button>

          </div>
        </div>
      )}

      {/* =====================================================
          LOGOUT CONFIRMATION
      ===================================================== */}

      {logoutModalOpen && (
        <div className="
          fixed
          inset-0
          bg-black/45
          backdrop-blur-sm
          flex
          items-center
          justify-center
          z-[100]
          p-4
        ">

          <div className="
            bg-white
            w-full
            max-w-sm
            rounded-3xl
            shadow-2xl
            p-6
            text-center
          ">

            <div className="
              mx-auto
              w-14
              h-14
              rounded-full
              bg-red-50
              flex
              items-center
              justify-center
              text-2xl
              mb-4
            ">
              🚪
            </div>

            <h2 className="
              text-xl
              font-bold
              text-gray-800
              mb-2
            ">
              Chiqishni xohlaysizmi?
            </h2>

            <p className="
              text-sm
              text-gray-400
              mb-6
            ">
              Ofitsiant panelidan chiqasiz.
            </p>

            <div className="
              flex
              gap-3
            ">

              {/* YO'Q */}

              <button
                onClick={() =>
                  setLogoutModalOpen(false)
                }
                className="
                  flex-1
                  py-3
                  rounded-xl
                  border
                  border-gray-200
                  bg-gray-50
                  text-gray-700
                  font-semibold
                  text-sm
                  hover:bg-gray-100
                  active:scale-95
                  transition
                "
              >
                Yo'q
              </button>

              {/* HA */}

              <button
                onClick={handleLogout}
                className="
                  flex-1
                  py-3
                  rounded-xl
                  bg-red-500
                  text-white
                  font-semibold
                  text-sm
                  hover:bg-red-600
                  active:scale-95
                  transition
                "
              >

                Ha, chiqish
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}