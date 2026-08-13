import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

export default function OrderForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cafeId, currentUser, logout } = useAuth();

  const initialTable = searchParams.get("table") || "1";
  const [tableNumber, setTableNumber] = useState(initialTable);

  const [existingOrderId, setExistingOrderId] = useState(null);
  const [existingOrderItems, setExistingOrderItems] = useState([]);

  const [categories, setCategories] = useState(["Barchasi"]);
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [readyNotification, setReadyNotification] = useState(null);
  const readyNotificationTimerRef = useRef(null);
  const readyNotificationQueueRef = useRef([]);
  const readyNotifiedIdsRef = useRef(new Set());

  // ⭐ FIX: AudioContext faqat bir marta yaratiladi va useRef'da saqlanadi
  const audioContextRef = useRef(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      audioContextRef.current = new AudioCtx();
    }
    return audioContextRef.current;
  };

  // 🔊 OVOZ CHIQARISH ("Tayyor" bo'lganda)
  const playReadySound = async () => {
    if (!isSoundOn) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Tashqi MP3 o'rniga Web Audio ishlatamiz — internet bo'lmasa ham signal beradi.
      const now = ctx.currentTime;
      const beep = (offset, frequency, duration = 0.22) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, now + offset);

        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.55, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);

        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + duration + 0.03);
      };

      beep(0, 880, 0.25);
      beep(0.32, 1046, 0.25);
      beep(0.64, 880, 0.32);
    } catch (e) {
      console.log("Audio play error:", e);
    }
  };

  // =========================================================
  // 🔔 OSHPAZ TAYYOR QILGAN BUYURTMALARNI BARCHA STOLLARDAN TINGLASH
  // =========================================================
  useEffect(() => {
    if (!cafeId) return;

    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("cafeId", "==", cafeId));
    let firstSnapshot = true;

    const queueReadyNotification = (orderData, orderId) => {
      readyNotificationQueueRef.current.push({
        id: orderId,
        tableNumber: orderData.tableNumber ?? "?",
      });
    };

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Dastlabki snapshotdagi eski "ready" buyurtmalar ovoz chiqarmaydi.
        if (firstSnapshot) {
          firstSnapshot = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "modified" && change.type !== "added") return;

          const orderData = change.doc.data();
          const orderId = change.doc.id;

          // "ready"dan boshqa holatga o'tsa, keyinchalik yana tayyor bo'lganda xabar beramiz.
          if (orderData.kitchenStatus !== "ready") {
            readyNotifiedIdsRef.current.delete(orderId);
            return;
          }

          // Bir xil tayyor buyurtma qayta yangilanganda qayta-qayta signal bermaydi.
          if (readyNotifiedIdsRef.current.has(orderId)) return;

          readyNotifiedIdsRef.current.add(orderId);
          queueReadyNotification(orderData, orderId);
        });
      },
      (error) => {
        console.error("❌ 'ready' listener xatosi:", error);
      }
    );

    return () => {
      unsubscribe();
      if (readyNotificationTimerRef.current) {
        clearTimeout(readyNotificationTimerRef.current);
      }
    };
  }, [cafeId, isSoundOn]);

  // Navbatdagi tayyor stol xabarini chiqarish.
  useEffect(() => {
    if (readyNotification || readyNotificationQueueRef.current.length === 0) return;

    const nextNotification = readyNotificationQueueRef.current.shift();
    if (!nextNotification) return;

    setReadyNotification(nextNotification);
    playReadySound();

    if (readyNotificationTimerRef.current) {
      clearTimeout(readyNotificationTimerRef.current);
    }

    readyNotificationTimerRef.current = setTimeout(() => {
      setReadyNotification(null);
    }, 3500);
  }, [readyNotification]);

  // =========================================================
  // 1. SHU STOLDA MAVJUD BUYURTMANI AVTOMATIK QIDIRIB OLISH
  // =========================================================
  useEffect(() => {
    if (!tableNumber) return;

    const fetchActiveOrderForTable = async () => {
      try {
        const q = query(
          collection(db, "orders"),
          where("tableNumber", "==", Number(tableNumber)),
          where("paymentStatus", "==", "unpaid")
        );

        const querySnapshot = await getDocs(q);

        // ⭐ DEBUG LOG: shu stol uchun eski (yopilmagan) buyurtma bor-yo'qligini ko'rsatadi
        console.log(
          `🔍 Stol ${tableNumber} uchun mavjud 'unpaid' buyurtmalar soni:`,
          querySnapshot.size
        );

        if (!querySnapshot.empty) {
          const activeOrderDoc = querySnapshot.docs[0];
          setExistingOrderId(activeOrderDoc.id);
          console.log("➡️ Mavjud buyurtma topildi, ID:", activeOrderDoc.id, "— yangi taomlar shu buyurtmaga QO'SHILADI (addDoc emas, updateDoc ishlaydi)");

          const orderData = activeOrderDoc.data();
          if (orderData.items && Array.isArray(orderData.items)) {
            setExistingOrderItems(orderData.items);
          }
        } else {
          setExistingOrderId(null);
          setExistingOrderItems([]);
          console.log("➡️ Mavjud buyurtma yo'q — yangi buyurtma (addDoc) yaratiladi");
        }
      } catch (error) {
        console.error("❌ Stol buyurtmasini yuklashda xatolik:", error);
      }
    };

    fetchActiveOrderForTable();
  }, [tableNumber]);

  // =========================================================
  // 2. MENYU VA TAOMLARNI YUKLASH
  // =========================================================
  useEffect(() => {
    const menuRef = collection(db, "menu");

    const unsub = onSnapshot(
      menuRef,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        let finalItems = items;
        if (cafeId) {
          const cafeFiltered = items.filter((item) => item.cafeId === cafeId);
          if (cafeFiltered.length > 0) finalItems = cafeFiltered;
        }

        setMenuItems(finalItems);

        const rawCats = finalItems.map((i) => i.category).filter(Boolean);
        const uniqueCats = Array.from(new Set(rawCats));
        setCategories(["Barchasi", ...uniqueCats]);
        setLoading(false);
      },
      (error) => {
        console.error("Menyuni yuklashda xatolik:", error);
        toast.error("Menyuni yuklashda xatolik!");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [cafeId]);

  // =========================================================
  // 3. SAVAT AMALLARI
  // =========================================================
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          category: item.category || "",
          imageUrl: item.imageUrl || item.image || "",
          quantity: 1,
          note: "",
        },
      ];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  const updateNote = (id, noteText) => {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, note: noteText } : i))
    );
  };

  const getItemQuantityInCart = (id) => {
    const found = cart.find((i) => i.id === id);
    return found ? found.quantity : 0;
  };

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * item.quantity,
    0
  );

  const isDrinkCategory = (category) => {
    const cat = String(category || "").trim().toLowerCase();
    return (
      cat.includes("ichimlik") ||
      cat.includes("drink") ||
      cat.includes("napitok")
    );
  };

  // =========================================================
  // 4. BUYURTMANI SAQLASH / YANGILASH
  // =========================================================
  const handleSubmitOrder = async () => {
    console.log("🚀 SUBMIT bosildi:", { tableNumber, cartCount: cart.length, existingOrderId });

    if (!tableNumber) {
      toast.error("Iltimos, stol raqamini kiriting!");
      return;
    }
    if (cart.length === 0) {
      toast.error("Savat bo'sh! Taom tanlang.");
      return;
    }
    // ⭐ FIX: cafeId bo'sh bo'lsa ogohlantirish (menyuda va Kitchen'da filtrlashga ta'sir qilishi mumkin)
    if (!cafeId) {
      console.warn("⚠️ DIQQAT: cafeId aniqlanmagan (bo'sh)! AuthContext'ni tekshiring.");
    }

    setSubmitting(true);

    try {
      let finalAllItems = [...existingOrderItems];

      cart.forEach((cartItem) => {
        const index = finalAllItems.findIndex((item) => item.id === cartItem.id);
        if (index > -1) {
          finalAllItems[index] = {
            ...finalAllItems[index],
            quantity: finalAllItems[index].quantity + cartItem.quantity,
            note: cartItem.note
              ? finalAllItems[index].note
                ? `${finalAllItems[index].note}, ${cartItem.note}`
                : cartItem.note
              : finalAllItems[index].note,
          };
        } else {
          finalAllItems.push({
            id: cartItem.id,
            name: cartItem.name,
            price: Number(cartItem.price || 0),
            quantity: cartItem.quantity,
            category: cartItem.category || "",
            imageUrl: cartItem.imageUrl || "",
            note: cartItem.note || "",
          });
        }
      });

      const finalTotalPrice = finalAllItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * item.quantity,
        0
      );

      const kitchenItems = finalAllItems.filter(
        (item) => !isDrinkCategory(item.category)
      );

      const waiterItems = finalAllItems.filter((item) =>
        isDrinkCategory(item.category)
      );

      if (existingOrderId) {
        console.log("✏️ Mavjud buyurtma YANGILANMOQDA, ID:", existingOrderId);
        const orderRef = doc(db, "orders", existingOrderId);
        await updateDoc(orderRef, {
          items: finalAllItems,
          kitchenItems,
          waiterItems,
          totalPrice: finalTotalPrice,
          kitchenStatus: kitchenItems.length > 0 ? "pending" : "none",
          updatedAt: serverTimestamp(),
        });

        console.log("✅ UPDATE muvaffaqiyatli, ID:", existingOrderId);
        toast.success("🍲 Buyurtmaga yangi taomlar qo'shildi!", { autoClose: 2000 });
      } else {
        const formattedCartItems = cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          quantity: item.quantity,
          category: item.category || "",
          imageUrl: item.imageUrl || "",
          note: item.note || "",
        }));

        const newKitchenItems = formattedCartItems.filter(
          (item) => !isDrinkCategory(item.category)
        );
        const newWaiterItems = formattedCartItems.filter((item) =>
          isDrinkCategory(item.category)
        );

        const orderData = {
          cafeId: cafeId || "",
          tableNumber: Number(tableNumber),
          kitchenItems: newKitchenItems,
          waiterItems: newWaiterItems,
          items: formattedCartItems,
          totalPrice,
          paymentStatus: "unpaid",
          kitchenStatus: newKitchenItems.length > 0 ? "pending" : "none",
          itemStatuses: newKitchenItems.map(() => "pending"),
          createdAt: serverTimestamp(),
          waiterId: currentUser?.uid || "",
          waiterEmail: currentUser?.email || "",
          orderSource: "waiter",
        };

        console.log("📝 YANGI order yaratilmoqda:", orderData);

        const docRef = await addDoc(collection(db, "orders"), orderData);

        console.log("✅ YANGI ORDER MUVAFFAQIYATLI YARATILDI! Firestore ID:", docRef.id);

        toast.success(
          newKitchenItems.length > 0
            ? "🍲 Buyurtma oshxonaga yuborildi!"
            : "🥤 Ichimlik buyurtmasi qabul qilindi!",
          { autoClose: 2000 }
        );
      }

      setCart([]);
      setIsCartModalOpen(false);
      navigate("/waiter/tables");
    } catch (error) {
      // ⭐ FIX: to'liq xatolikni konsolga chiqarish (kodini ham)
      console.error("❌ BUYURTMA YUBORISHDA XATOLIK:", error);
      console.error("Xato kodi:", error.code);
      console.error("Xato matni:", error.message);
      toast.error("Buyurtma yuborilmadi: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === "Barchasi" ||
      String(item.category).trim().toLowerCase() ===
        selectedCategory.trim().toLowerCase();

    const matchesSearch = String(item.name || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans select-none pb-28 antialiased relative overflow-x-hidden">
      {/* 🔔 KICHKINA YON NOTIFICATION — MENYUNI TO'SMAYDI */}
      {readyNotification && (
        <button
          type="button"
          onClick={() => {
            setReadyNotification(null);
            if (readyNotificationTimerRef.current) {
              clearTimeout(readyNotificationTimerRef.current);
            }
            navigate("/waiter/tables");
          }}
          className="fixed top-24 right-2 z-[60] w-[145px] bg-[#123d2d] text-white rounded-xl shadow-xl border border-emerald-700/50 px-2 py-2 flex items-center gap-1.5 animate-slide-in-right active:scale-95 transition"
        >
          <span className="w-7 h-7 rounded-lg bg-amber-400 text-[#123d2d] flex items-center justify-center text-sm shrink-0">🔔</span>
          <span className="min-w-0 text-left text-[10px] font-black truncate">
            {readyNotification.tableNumber}-STOL — TAYYOR!
          </span>
        </button>
      )}

      {/* 📌 TEPADA FIX / STICKY TURADIGAN HEADER */}
      <header className="sticky top-0 z-20 bg-white shadow-xs flex flex-col border-b border-slate-200">
        {/* Tepadagi Panel: Logo, Ovoz va Chiqish */}
        <div className="px-4 py-3 flex justify-between items-center bg-white border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 bg-amber-100 rounded-2xl flex items-center justify-center text-xl shadow-2xs">
              🍲
            </div>
            <div>
              <h2 className="font-black text-slate-800 text-sm leading-tight">
                KARAVAN KAFE
              </h2>
              <p className="text-[10px] font-bold text-slate-400">
                Ofitsiant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSoundOn(!isSoundOn)}
              className={`${
                isSoundOn
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-slate-200 text-slate-600"
              } font-extrabold text-xs w-10 h-10 rounded-2xl shadow-md flex items-center justify-center transition active:scale-95`}
              title={isSoundOn ? "Ovoz yoqilgan" : "Ovoz o'chirilgan"}
            >
              <span className="text-base">{isSoundOn ? "🔔" : "🔕"}</span>
            </button>

            <button
              onClick={() => (logout ? logout() : navigate("/login"))}
              className="border border-rose-200 text-rose-500 hover:bg-rose-50 font-bold text-xs px-3.5 py-2.5 rounded-2xl active:scale-95 transition"
            >
              Chiqish
            </button>
          </div>
        </div>

        {/* ⬅️ STOLLARGA QAYTISH VA JORIY STOL RAQAMI */}
        <div className="bg-[#FAF7EE] px-4 py-3 flex justify-between items-center">
          <button
            onClick={() => navigate("/waiter/tables")}
            className="flex items-center gap-2 text-slate-700 hover:text-amber-600 font-extrabold text-sm active:scale-95 transition"
          >
            <span>⬅️</span>
            <span>Stollarga qaytish</span>
          </button>

          <div className="bg-amber-500 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-2xs">
            Stol №{tableNumber}
          </div>
        </div>
      </header>

      {/* ASOSIY QISM (MENYU VA TAOMLAR) */}
      <main className="max-w-md mx-auto sm:max-w-xl w-full p-3 sm:p-5 flex flex-col gap-3">
        {/* QIDIRUV */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Taom nomini yozing..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* KATEGORIYALAR */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isActive =
              selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                  isActive
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* TAOMLAR RO'YXATI */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm font-semibold">
            Yuklanmoqda...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-400 text-sm border border-slate-200">
            Taom topilmadi
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredItems.map((item) => {
              const qtyInCart = getItemQuantityInCart(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`bg-white rounded-2xl p-2.5 border transition flex items-center justify-between shadow-2xs relative cursor-pointer active:scale-[0.98] ${
                    qtyInCart > 0
                      ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-14 h-14 object-cover rounded-xl shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-xl shrink-0">
                        🍲
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 text-sm leading-snug truncate">
                        {item.name}
                      </h3>
                      <span className="text-xs font-black text-amber-600">
                        {Number(item.price || 0).toLocaleString()}{" "}
                        <span className="text-[10px] font-normal">so'm</span>
                      </span>
                    </div>
                  </div>

                  {qtyInCart > 0 && (
                    <div className="bg-amber-500 text-white font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-xs shrink-0">
                      {qtyInCart} ta
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* PASTKI PANEL */}
      {totalCount > 0 && (
        <div className="fixed bottom-3 left-3 right-3 max-w-md mx-auto z-30 animate-slide-up">
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between">
            <div
              onClick={() => setIsCartModalOpen(true)}
              className="flex items-center gap-3 cursor-pointer pl-2 overflow-hidden pr-2"
            >
              <div className="relative shrink-0">
                <span className="text-2xl">🛒</span>
                <span className="absolute -top-1 -right-2 bg-amber-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                  {totalCount}
                </span>
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-amber-300 truncate">
                  {cart.map((i) => `${i.name} x${i.quantity}`).join(", ")}
                </span>
                <span className="text-sm font-extrabold text-white">
                  {totalPrice.toLocaleString()} so'm
                </span>
              </div>
            </div>

            <button
              disabled={submitting}
              onClick={handleSubmitOrder}
              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-1.5 shrink-0"
            >
              {submitting ? (
                "Yuborilmoqda..."
              ) : (
                <>
                  <span>Yuborish</span>
                  <span>🚀</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slideInRight .28s ease-out both; }
      `}</style>

      {/* SAVAT MODALI */}
      {isCartModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col p-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <span>📋 Yangi buyurtma</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  Stol №{tableNumber}
                </span>
              </h3>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="w-7 h-7 bg-slate-100 rounded-full font-bold text-slate-500 text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        {item.name}
                      </h4>
                      <span className="text-[11px] font-bold text-amber-600">
                        {(item.price * item.quantity).toLocaleString()} so'm
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-1.5 py-0.5 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="font-bold text-xs text-slate-600 px-1"
                      >
                        -
                      </button>
                      <span className="text-xs font-extrabold w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="font-bold text-xs text-slate-600 px-1"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Izoh (masalan: piyozsiz, sariyog'siz)..."
                    value={item.note || ""}
                    onChange={(e) => updateNote(item.id, e.target.value)}
                    className="mt-2 w-full text-[11px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Jami:</span>
                <span className="text-lg font-black text-amber-600">
                  {totalPrice.toLocaleString()} so'm
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsCartModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-bold text-xs py-3 rounded-xl"
                >
                  Yana taom qo'shish
                </button>
                <button
                  disabled={submitting}
                  onClick={handleSubmitOrder}
                  className="bg-amber-500 text-white font-bold text-xs py-3 rounded-xl shadow-md"
                >
                  {submitting ? "Yuborilmoqda..." : "Saqlash va Yuborish 🚀"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}