import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";

import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

export default function OrderForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const authData = useAuth();

  const cafeId = authData?.cafeId || null;
  const contextUser = authData?.currentUser || null;

  // =========================================================
  // FIREBASE CURRENT USER
  // =========================================================

  const getLoggedInUser = useCallback(() => {
    try {
      const firebaseAuth = getAuth();

      return (
        contextUser ||
        firebaseAuth.currentUser ||
        null
      );
    } catch (error) {
      console.error(
        "Firebase user olishda xatolik:",
        error
      );

      return contextUser || null;
    }
  }, [contextUser]);

  const currentUser =
    getLoggedInUser();

  // =========================================================
  // STOL
  // =========================================================

  const initialTable =
    searchParams.get("table") || "1";

  const [tableNumber, setTableNumber] =
    useState(initialTable);

  // =========================================================
  // MAVJUD BUYURTMA
  // =========================================================

  const [existingOrderId, setExistingOrderId] =
    useState(null);

  const [existingOrderItems, setExistingOrderItems] =
    useState([]);

  const [existingKitchenItems, setExistingKitchenItems] =
    useState([]);

  const [existingOrderTotal, setExistingOrderTotal] =
    useState(0);

  // =========================================================
  // MENU
  // =========================================================

  const [categories, setCategories] =
    useState(["Barchasi"]);

  const [selectedCategory, setSelectedCategory] =
    useState("Barchasi");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [menuItems, setMenuItems] =
    useState([]);

  // =========================================================
  // CART
  // =========================================================

  const [cart, setCart] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [isCartModalOpen, setIsCartModalOpen] =
    useState(false);

  // =========================================================
  // SOUND
  // =========================================================

  const [isSoundOn, setIsSoundOn] =
    useState(true);

  const [readyNotification, setReadyNotification] =
    useState(null);

  const audioContextRef =
    useRef(null);

  const audioUnlockedRef =
    useRef(false);

  const readyNotificationTimerRef =
    useRef(null);

  const readyNotificationQueueRef =
    useRef([]);

  const readyNotifiedIdsRef =
    useRef(new Set());

  // =========================================================
  // AUDIO
  // =========================================================

  const getAudioContext = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioCtx) {
          return null;
        }

        audioContextRef.current =
          new AudioCtx();
      }

      return audioContextRef.current;
    } catch (error) {
      console.error(
        "AudioContext xatosi:",
        error
      );

      return null;
    }
  }, []);

  const unlockAudio = useCallback(async () => {
    try {
      const ctx =
        getAudioContext();

      if (!ctx) return;

      if (
        ctx.state === "suspended"
      ) {
        await ctx.resume();
      }

      audioUnlockedRef.current = true;
    } catch (error) {
      console.error(
        "Audio unlock xatosi:",
        error
      );
    }
  }, [getAudioContext]);

  const playReadySound = useCallback(async () => {
    if (!isSoundOn) return;

    try {
      const ctx =
        getAudioContext();

      if (!ctx) return;

      if (
        ctx.state === "suspended"
      ) {
        await ctx.resume();
      }

      audioUnlockedRef.current = true;

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
          0.7,
          now + delay + 0.03
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + delay + duration
        );

        oscillator.connect(gain);
        gain.connect(ctx.destination);

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

      beep(0, 880, 0.25);
      beep(0.35, 1100, 0.25);
      beep(0.7, 880, 0.35);
    } catch (error) {
      console.error(
        "Ovoz chiqarishda xatolik:",
        error
      );
    }
  }, [
    getAudioContext,
    isSoundOn,
  ]);

  useEffect(() => {
    const handleInteraction = () => {
      if (
        !audioUnlockedRef.current
      ) {
        unlockAudio();
      }
    };

    window.addEventListener(
      "click",
      handleInteraction
    );

    window.addEventListener(
      "touchstart",
      handleInteraction
    );

    window.addEventListener(
      "keydown",
      handleInteraction
    );

    return () => {
      window.removeEventListener(
        "click",
        handleInteraction
      );

      window.removeEventListener(
        "touchstart",
        handleInteraction
      );

      window.removeEventListener(
        "keydown",
        handleInteraction
      );
    };
  }, [unlockAudio]);

  // =========================================================
  // READY NOTIFICATION
  // =========================================================

  const showNextReadyNotification =
    useCallback(async () => {
      if (
        readyNotificationQueueRef.current
          .length === 0
      ) {
        return;
      }

      const next =
        readyNotificationQueueRef.current.shift();

      if (!next) return;

      setReadyNotification(next);

      await playReadySound();

      if (
        readyNotificationTimerRef.current
      ) {
        clearTimeout(
          readyNotificationTimerRef.current
        );
      }

      readyNotificationTimerRef.current =
        setTimeout(() => {
          setReadyNotification(null);
        }, 4000);
    }, [playReadySound]);

  // =========================================================
  // READY ORDER LISTENER
  // =========================================================

  useEffect(() => {
    const uid =
      currentUser?.uid;

    if (!cafeId || !uid) {
      return;
    }

    const ordersRef =
      collection(db, "orders");

    const q = query(
      ordersRef,
      where(
        "cafeId",
        "==",
        cafeId
      ),
      where(
        "waiterId",
        "==",
        uid
      )
    );

    let firstSnapshot = true;

    const unsubscribe =
      onSnapshot(
        q,
        (snapshot) => {
          if (firstSnapshot) {
            firstSnapshot = false;

            snapshot.docs.forEach(
              (orderDoc) => {
                const data =
                  orderDoc.data();

                if (
                  data.kitchenStatus ===
                  "ready"
                ) {
                  readyNotifiedIdsRef.current.add(
                    orderDoc.id
                  );
                }
              }
            );

            return;
          }

          snapshot.docChanges().forEach(
            (change) => {
              if (
                change.type !== "modified" &&
                change.type !== "added"
              ) {
                return;
              }

              const orderData =
                change.doc.data();

              const orderId =
                change.doc.id;

              if (
                orderData.waiterId !== uid
              ) {
                return;
              }

              if (
                orderData.cafeId !== cafeId
              ) {
                return;
              }

              if (
                orderData.kitchenStatus !==
                "ready"
              ) {
                return;
              }

              if (
                readyNotifiedIdsRef.current.has(
                  orderId
                )
              ) {
                return;
              }

              readyNotifiedIdsRef.current.add(
                orderId
              );

              readyNotificationQueueRef.current.push(
                {
                  id: orderId,
                  tableNumber:
                    orderData.tableNumber ?? "?",
                }
              );

              showNextReadyNotification();
            }
          );
        },
        (error) => {
          console.error(
            "Ready listener xatosi:",
            error
          );
        }
      );

    return () => {
      unsubscribe();

      if (
        readyNotificationTimerRef.current
      ) {
        clearTimeout(
          readyNotificationTimerRef.current
        );
      }
    };
  }, [
    cafeId,
    currentUser?.uid,
    showNextReadyNotification,
  ]);

  useEffect(() => {
    if (
      !readyNotification &&
      readyNotificationQueueRef.current
        .length > 0
    ) {
      showNextReadyNotification();
    }
  }, [
    readyNotification,
    showNextReadyNotification,
  ]);

  // =========================================================
  // SHU OFITSIANTNING AKTIV ORDERINI TOPISH
  // =========================================================

  useEffect(() => {
    const uid =
      currentUser?.uid;

    if (
      !tableNumber ||
      !cafeId ||
      !uid
    ) {
      return;
    }

    const fetchActiveOrderForTable =
      async () => {
        try {
          const q = query(
            collection(db, "orders"),
            where(
              "cafeId",
              "==",
              cafeId
            ),
            where(
              "tableNumber",
              "==",
              Number(tableNumber)
            ),
            where(
              "paymentStatus",
              "==",
              "unpaid"
            ),
            where(
              "waiterId",
              "==",
              uid
            )
          );

          const querySnapshot =
            await getDocs(q);

          if (
            !querySnapshot.empty
          ) {
            const activeOrderDoc =
              querySnapshot.docs[0];

            const orderData =
              activeOrderDoc.data();

            if (
              orderData.waiterId !== uid
            ) {
              setExistingOrderId(null);
              setExistingOrderItems([]);
              setExistingKitchenItems([]);
              setExistingOrderTotal(0);
              return;
            }

            setExistingOrderId(
              activeOrderDoc.id
            );

            setExistingOrderItems(
              Array.isArray(orderData.items)
                ? orderData.items
                : []
            );

            setExistingKitchenItems(
              Array.isArray(
                orderData.kitchenItems
              )
                ? orderData.kitchenItems
                : []
            );

            setExistingOrderTotal(
              Number(
                orderData.totalPrice || 0
              )
            );
          } else {
            setExistingOrderId(null);
            setExistingOrderItems([]);
            setExistingKitchenItems([]);
            setExistingOrderTotal(0);
          }
        } catch (error) {
          console.error(
            "Stol buyurtmasini yuklash:",
            error
          );
        }
      };

    fetchActiveOrderForTable();
  }, [
    tableNumber,
    cafeId,
    currentUser?.uid,
  ]);

  // =========================================================
  // EXISTING ORDER REALTIME
  // =========================================================

  useEffect(() => {
    const uid =
      currentUser?.uid;

    if (
      !existingOrderId ||
      !uid
    ) {
      return;
    }

    const orderRef =
      doc(
        db,
        "orders",
        existingOrderId
      );

    const unsubscribe =
      onSnapshot(
        orderRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setExistingOrderId(null);
            setExistingOrderItems([]);
            setExistingKitchenItems([]);
            setExistingOrderTotal(0);
            return;
          }

          const data =
            snapshot.data();

          if (
            data.waiterId !== uid
          ) {
            setExistingOrderId(null);
            setExistingOrderItems([]);
            setExistingKitchenItems([]);
            setExistingOrderTotal(0);
            return;
          }

          setExistingOrderItems(
            Array.isArray(data.items)
              ? data.items
              : []
          );

          setExistingKitchenItems(
            Array.isArray(
              data.kitchenItems
            )
              ? data.kitchenItems
              : []
          );

          setExistingOrderTotal(
            Number(
              data.totalPrice || 0
            )
          );
        },
        (error) => {
          console.error(
            "Order realtime xatosi:",
            error
          );
        }
      );

    return () => unsubscribe();
  }, [
    existingOrderId,
    currentUser?.uid,
  ]);

  // =========================================================
  // MENU
  // =========================================================

  useEffect(() => {
    const menuRef =
      collection(db, "menu");

    const unsubscribe =
      onSnapshot(
        menuRef,
        (snapshot) => {
          const items =
            snapshot.docs.map(
              (menuDoc) => ({
                id: menuDoc.id,
                ...menuDoc.data(),
              })
            );

          let finalItems =
            items;

          if (cafeId) {
            const cafeFiltered =
              items.filter(
                (item) =>
                  item.cafeId === cafeId
              );

            if (
              cafeFiltered.length > 0
            ) {
              finalItems =
                cafeFiltered;
            }
          }

          setMenuItems(finalItems);

          const rawCats =
            finalItems
              .map(
                (item) => item.category
              )
              .filter(Boolean);

          setCategories([
            "Barchasi",
            ...Array.from(
              new Set(rawCats)
            ),
          ]);

          setLoading(false);
        },
        (error) => {
          console.error(
            "Menyuni yuklash:",
            error
          );

          toast.error(
            "Menyuni yuklashda xatolik!"
          );

          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [cafeId]);

  // =========================================================
  // CART
  // =========================================================

  const addToCart = (item) => {
    setCart((prev) => {
      const existing =
        prev.find(
          (i) => i.id === item.id
        );

      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                quantity:
                  i.quantity + 1,
              }
            : i
        );
      }

      return [
        ...prev,
        {
          id: item.id,
          name: item.name || "",
          price: Number(item.price || 0),
          category:
            item.category || "",
          imageUrl:
            item.imageUrl ||
            item.image ||
            "",
          quantity: 1,
          note: "",
        },
      ];
    });
  };

  const updateQuantity = (
    id,
    delta
  ) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) {
            return item;
          }

          const newQty =
            item.quantity + delta;

          if (newQty <= 0) {
            return null;
          }

          return {
            ...item,
            quantity: newQty,
          };
        })
        .filter(Boolean)
    );
  };

  const updateNote = (
    id,
    noteText
  ) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              note: noteText,
            }
          : item
      )
    );
  };

  const getItemQuantityInCart =
    (id) => {
      const found =
        cart.find(
          (item) => item.id === id
        );

      return found
        ? found.quantity
        : 0;
    };

  const totalCount =
    cart.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );

  const totalPrice =
    cart.reduce(
      (sum, item) =>
        sum +
        Number(item.price || 0) *
          Number(item.quantity || 0),
      0
    );

  // =========================================================
  // ICHIMLIK
  // =========================================================

  const isDrinkCategory =
    (category) => {
      const cat =
        String(category || "")
          .trim()
          .toLowerCase();

      return (
        cat.includes("ichimlik") ||
        cat.includes("drink") ||
        cat.includes("napitok")
      );
    };

  // =========================================================
  // TAOM TAYYORMI?
  // =========================================================

  const isItemReadyByKitchen =
    (item) => {
      if (!item) {
        return false;
      }

      if (
        isDrinkCategory(
          item.category
        )
      ) {
        return true;
      }

      const kitchenItem =
        existingKitchenItems.find(
          (kitchenItem) =>
            kitchenItem.id === item.id
        );

      if (kitchenItem) {
        return (
          kitchenItem.isReady === true
        );
      }

      const sameNameItem =
        existingKitchenItems.find(
          (kitchenItem) =>
            String(
              kitchenItem.name || ""
            ).trim() ===
            String(
              item.name || ""
            ).trim()
        );

      if (sameNameItem) {
        return (
          sameNameItem.isReady === true
        );
      }

      return false;
    };

  // =========================================================
  // TAOMNI YETKAZISH
  // =========================================================

  const handleItemDelivered =
    async (itemIndex) => {
      const uid =
        getLoggedInUser()?.uid;

      if (!existingOrderId) {
        toast.error(
          "Buyurtma topilmadi!"
        );
        return;
      }

      if (!uid) {
        toast.error(
          "Ofitsiant aniqlanmadi!"
        );
        return;
      }

      try {
        const orderRef =
          doc(
            db,
            "orders",
            existingOrderId
          );

        const orderSnap =
          await getDoc(orderRef);

        if (!orderSnap.exists()) {
          toast.error(
            "Buyurtma topilmadi!"
          );
          return;
        }

        const orderData =
          orderSnap.data();

        if (
          orderData.waiterId !== uid
        ) {
          toast.error(
            "Bu buyurtma boshqa ofitsiantga tegishli!"
          );
          return;
        }

        const items =
          Array.isArray(
            orderData.items
          )
            ? [...orderData.items]
            : [];

        if (!items[itemIndex]) {
          toast.error(
            "Taom topilmadi!"
          );
          return;
        }

        const selectedItem =
          items[itemIndex];

        const kitchenItems =
          Array.isArray(
            orderData.kitchenItems
          )
            ? orderData.kitchenItems
            : [];

        let kitchenItem =
          kitchenItems.find(
            (item) =>
              item.id === selectedItem.id
          );

        if (!kitchenItem) {
          kitchenItem =
            kitchenItems.find(
              (item) =>
                String(
                  item.name || ""
                ).trim() ===
                String(
                  selectedItem.name || ""
                ).trim()
            );
        }

        const isDrink =
          isDrinkCategory(
            selectedItem.category
          );

        if (
          !isDrink &&
          (
            !kitchenItem ||
            kitchenItem.isReady !== true
          )
        ) {
          toast.warning(
            "⚠️ Oshpaz hali bu taomni tayyor deb belgilamagan!"
          );
          return;
        }

        if (
          selectedItem.delivered === true
        ) {
          return;
        }

        items[itemIndex] = {
          ...selectedItem,
          delivered: true,
          deliveredAt:
            new Date().toISOString(),
          deliveredBy: uid,
        };

        const allDelivered =
          items.length > 0 &&
          items.every(
            (item) =>
              item.delivered === true
          );

        await updateDoc(
          orderRef,
          {
            items,
            deliveryStatus:
              allDelivered
                ? "delivered"
                : "partially_delivered",
            updatedAt:
              serverTimestamp(),
          }
        );

        toast.success(
          `✓ ${selectedItem.name} mijozga yetkazildi`
        );
      } catch (error) {
        console.error(
          "Taom yetkazish xatosi:",
          error
        );

        toast.error(
          "Taomni yetkazishda xatolik!"
        );
      }
    };

  // =========================================================
  // HAMMA YETKAZILGANMI?
  // =========================================================

  const allExistingItemsDelivered =
    existingOrderItems.length > 0 &&
    existingOrderItems.every(
      (item) =>
        item.delivered === true
    );

  // =========================================================
  // STOLNI YOPISH
  // =========================================================

  const handleCloseTable =
    async () => {
      const uid =
        getLoggedInUser()?.uid;

      if (!existingOrderId) {
        toast.error(
          "Yopiladigan buyurtma yo'q!"
        );
        return;
      }

      if (!uid) {
        toast.error(
          "Ofitsiant aniqlanmadi!"
        );
        return;
      }

      if (
        !allExistingItemsDelivered
      ) {
        toast.warning(
          "Avval barcha taomlarni mijozga yetkazing!"
        );
        return;
      }

      try {
        setSubmitting(true);

        const orderRef =
          doc(
            db,
            "orders",
            existingOrderId
          );

        const orderSnap =
          await getDoc(orderRef);

        if (!orderSnap.exists()) {
          toast.error(
            "Buyurtma topilmadi!"
          );
          return;
        }

        const orderData =
          orderSnap.data();

        if (
          orderData.waiterId !== uid
        ) {
          toast.error(
            "Bu buyurtma sizga tegishli emas!"
          );
          return;
        }

        await updateDoc(
          orderRef,
          {
            paymentStatus: "paid",
            deliveryStatus: "delivered",
            status: "completed",
            kitchenStatus: "completed",
            closedAt:
              serverTimestamp(),
            closedBy: uid,
            updatedAt:
              serverTimestamp(),
          }
        );

        toast.success(
          "✓ Mijozga yetkazildi. Stol yopildi!"
        );

        setExistingOrderId(null);
        setExistingOrderItems([]);
        setExistingKitchenItems([]);
        setExistingOrderTotal(0);
        setCart([]);
        setIsCartModalOpen(false);

        navigate("/waiter/tables");
      } catch (error) {
        console.error(
          "Stolni yopish xatosi:",
          error
        );

        toast.error(
          "Stolni yopishda xatolik!"
        );
      } finally {
        setSubmitting(false);
      }
    };

  // =========================================================
  // BUYURTMA YUBORISH
  // =========================================================

  const handleSubmitOrder =
    async () => {
      // MUHIM: contextUser null bo'lsa ham
      // Firebase getAuth().currentUser olinadi
      const loggedUser =
        getLoggedInUser();

      const uid =
        loggedUser?.uid;

      console.log(
        "BUYURTMA USER:",
        loggedUser
      );

      console.log(
        "BUYURTMA UID:",
        uid
      );

      console.log(
        "CAFE ID:",
        cafeId
      );

      if (!uid) {
        toast.error(
          "Ofitsiant aniqlanmadi. Login holati topilmadi!"
        );
        return;
      }

      if (!cafeId) {
        toast.error(
          "Cafe aniqlanmadi!"
        );
        return;
      }

      if (!tableNumber) {
        toast.error(
          "Iltimos, stol raqamini kiriting!"
        );
        return;
      }

      if (cart.length === 0) {
        toast.error(
          "Savat bo'sh! Taom tanlang."
        );
        return;
      }

      if (
        submitting
      ) {
        return;
      }

      setSubmitting(true);

      try {
        // =====================================================
        // AVVALGI ITEMLAR
        // =====================================================

        let finalAllItems =
          [...existingOrderItems];

        // =====================================================
        // YANGI SAVAT ITEMLARINI QO'SHISH
        // =====================================================

        cart.forEach(
          (cartItem) => {
            const index =
              finalAllItems.findIndex(
                (item) =>
                  item.id === cartItem.id &&
                  item.delivered !== true
              );

            if (index > -1) {
              finalAllItems[index] = {
                ...finalAllItems[index],

                quantity:
                  Number(
                    finalAllItems[index]
                      .quantity || 0
                  ) +
                  Number(
                    cartItem.quantity || 0
                  ),

                note:
                  cartItem.note
                    ? finalAllItems[index]
                        .note
                      ? `${finalAllItems[index].note}, ${cartItem.note}`
                      : cartItem.note
                    : (
                      finalAllItems[index]
                        .note || ""
                    ),

                delivered: false,
              };
            } else {
              finalAllItems.push({
                id: cartItem.id,
                name:
                  cartItem.name || "",
                price:
                  Number(
                    cartItem.price || 0
                  ),
                quantity:
                  Number(
                    cartItem.quantity || 1
                  ),
                category:
                  cartItem.category || "",
                imageUrl:
                  cartItem.imageUrl || "",
                note:
                  cartItem.note || "",
                delivered: false,
              });
            }
          }
        );

        // =====================================================
        // JAMI NARX
        // =====================================================

        const finalTotalPrice =
          finalAllItems.reduce(
            (sum, item) =>
              sum +
              Number(
                item.price || 0
              ) *
                Number(
                  item.quantity || 0
                ),
            0
          );

        // =====================================================
        // OSHXONA VA ICHIMLIKLAR
        // =====================================================

        const kitchenItems =
          finalAllItems.filter(
            (item) =>
              !isDrinkCategory(
                item.category
              )
          );

        const waiterItems =
          finalAllItems.filter(
            (item) =>
              isDrinkCategory(
                item.category
              )
          );

        // =====================================================
        // MAVJUD ORDERNI YANGILASH
        // =====================================================

        if (existingOrderId) {
          const orderRef =
            doc(
              db,
              "orders",
              existingOrderId
            );

          const orderSnap =
            await getDoc(orderRef);

          if (!orderSnap.exists()) {
            toast.error(
              "Buyurtma topilmadi!"
            );
            return;
          }

          const oldOrder =
            orderSnap.data();

          if (
            oldOrder.waiterId !== uid
          ) {
            toast.error(
              "Bu buyurtma boshqa ofitsiantga tegishli!"
            );
            return;
          }

          const oldKitchenItems =
            Array.isArray(
              oldOrder.kitchenItems
            )
              ? oldOrder.kitchenItems
              : [];

          const newKitchenItems =
            kitchenItems.map(
              (item) => {
                const oldKitchenItem =
                  oldKitchenItems.find(
                    (oldItem) =>
                      oldItem.id === item.id
                  );

                // Agar oldingi taom tayyor bo'lsa,
                // tayyor holati saqlanadi
                if (
                  oldKitchenItem?.isReady === true
                ) {
                  return {
                    ...item,
                    isReady: true,
                  };
                }

                return {
                  ...item,
                  isReady: false,
                };
              }
            );

          const kitchenStatus =
            newKitchenItems.length === 0
              ? "ready"
              : newKitchenItems.every(
                  (item) =>
                    item.isReady === true
                )
              ? "ready"
              : "pending";

          await updateDoc(
            orderRef,
            {
              items: finalAllItems,

              kitchenItems:
                newKitchenItems,

              waiterItems:
                waiterItems,

              totalPrice:
                finalTotalPrice,

              // MUHIM
              waiterId: uid,

              waiterName:
                loggedUser.displayName ||
                loggedUser.email ||
                "",

              cafeId: cafeId,

              tableNumber:
                Number(tableNumber),

              paymentStatus:
                "unpaid",

              kitchenStatus:
                kitchenStatus,

              status: "active",

              updatedAt:
                serverTimestamp(),
            }
          );

          setExistingOrderItems(
            finalAllItems
          );

          setExistingKitchenItems(
            newKitchenItems
          );

          setExistingOrderTotal(
            finalTotalPrice
          );

          toast.success(
            "✓ Buyurtma muvaffaqiyatli yangilandi!"
          );
        } else {
          // ===================================================
          // YANGI ORDER
          // ===================================================

          const newKitchenItems =
            kitchenItems.map(
              (item) => ({
                ...item,
                isReady: false,
              })
            );

          const kitchenStatus =
            newKitchenItems.length === 0
              ? "ready"
              : "pending";

          const newOrderRef =
            await addDoc(
              collection(db, "orders"),
              {
                cafeId: cafeId,

                tableNumber:
                  Number(tableNumber),

                // ENG MUHIM
                waiterId: uid,

                waiterName:
                  loggedUser.displayName ||
                  loggedUser.email ||
                  "",

                items:
                  finalAllItems,

                kitchenItems:
                  newKitchenItems,

                waiterItems:
                  waiterItems,

                totalPrice:
                  finalTotalPrice,

                status:
                  "active",

                paymentStatus:
                  "unpaid",

                deliveryStatus:
                  "pending",

                kitchenStatus:
                  kitchenStatus,

                createdAt:
                  serverTimestamp(),

                updatedAt:
                  serverTimestamp(),
              }
            );

          console.log(
            "YANGI ORDER ID:",
            newOrderRef.id
          );

          setExistingOrderId(
            newOrderRef.id
          );

          setExistingOrderItems(
            finalAllItems
          );

          setExistingKitchenItems(
            newKitchenItems
          );

          setExistingOrderTotal(
            finalTotalPrice
          );

          toast.success(
            "✓ Yangi buyurtma muvaffaqiyatli yuborildi!"
          );
        }

        // =====================================================
        // SAVATNI TOZALASH
        // =====================================================

        setCart([]);
        setIsCartModalOpen(false);
      } catch (error) {
        console.error(
          "BUYURTMA YUBORISH XATOSI:",
          error
        );

        // Firebase xatosini ham ko'rsatamiz
        if (
          error?.code ===
          "permission-denied"
        ) {
          toast.error(
            "Firestore ruxsat bermadi! Firebase Rules tekshiring."
          );
        } else if (
          error?.code ===
          "failed-precondition"
        ) {
          toast.error(
            "Firestore index kerak. Console ichidagi link orqali index yarating."
          );
        } else {
          toast.error(
            error?.message ||
              "Buyurtmani yuborishda xatolik!"
          );
        }
      } finally {
        setSubmitting(false);
      }
    };

  // =========================================================
  // FILTER
  // =========================================================

  const filteredMenuItems =
    menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory ===
          "Barchasi" ||
        item.category ===
          selectedCategory;

      const matchesSearch =
        String(item.name || "")
          .toLowerCase()
          .includes(
            searchQuery.toLowerCase()
          );

      return (
        matchesCategory &&
        matchesSearch
      );
    });

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="p-4 max-w-4xl mx-auto pb-28">
      {/* READY NOTIFICATION */}
      {readyNotification && (
        <div className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 flex items-center gap-3">
          <span className="text-xl">
            🔔
          </span>

          <div>
            <p className="font-bold">
              Taom Tayyor!
            </p>

            <p className="text-sm">
              Stol №
              {readyNotification.tableNumber}
            </p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Stol №{tableNumber}
          </h1>

          <p className="text-sm text-gray-500">
            {existingOrderId
              ? "Mavjud buyurtma bor"
              : "Yangi buyurtma"}
          </p>

          {!currentUser?.uid && (
            <p className="text-xs text-red-500 mt-1">
              Ofitsiant yuklanmoqda...
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={async () => {
              await unlockAudio();

              setIsSoundOn(
                (prev) => !prev
              );
            }}
            className={`p-2 rounded-lg border text-sm ${
              isSoundOn
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isSoundOn
              ? "🔊 Ovoz"
              : "🔇 Ovoz"}
          </button>

          <button
            onClick={() =>
              navigate("/waiter/tables")
            }
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
          >
            Stollar
          </button>
        </div>
      </div>

      {/* EXISTING ORDER */}
      {existingOrderId && (
        <div className="mb-6 p-4 border rounded-lg bg-yellow-50 border-yellow-200">
          <h2 className="text-lg font-bold mb-3 text-yellow-800">
            Aktiv Buyurtma
            {" "}
            (Jami:{" "}
            {existingOrderTotal.toLocaleString()}
            {" "}
            so'm)
          </h2>

          <div className="space-y-2 mb-4">
            {existingOrderItems.map(
              (item, idx) => {
                const isReady =
                  isItemReadyByKitchen(
                    item
                  );

                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className="flex items-center justify-between gap-2 p-2 bg-white rounded border"
                  >
                    <div>
                      <span className="font-semibold">
                        {item.name}
                      </span>

                      {" x "}
                      {item.quantity}

                      {item.note && (
                        <span className="text-xs text-gray-500 block">
                          Eslatma:{" "}
                          {item.note}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.delivered ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          ✓ Yetkazildi
                        </span>
                      ) : isReady ? (
                        <button
                          onClick={() =>
                            handleItemDelivered(
                              idx
                            )
                          }
                          className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                        >
                          Mijozga berildi
                        </button>
                      ) : (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          Oshxonada...
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <button
            onClick={handleCloseTable}
            disabled={
              submitting ||
              !allExistingItemsDelivered
            }
            className={`w-full py-2 rounded font-bold text-white transition ${
              allExistingItemsDelivered
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {submitting
              ? "Yuklanmoqda..."
              : "Stolni Yopish va To'lovni Yakunlash"}
          </button>
        </div>
      )}

      {/* SEARCH */}
      <div className="mb-6 space-y-3">
        <input
          type="text"
          placeholder="Taom qidirish..."
          value={searchQuery}
          onChange={(e) =>
            setSearchQuery(
              e.target.value
            )
          }
          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(
            (cat) => (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategory(
                    cat
                  )
                }
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            )
          )}
        </div>
      </div>

      {/* MENU */}
      {loading ? (
        <div className="text-center py-10">
          Menyu yuklanmoqda...
        </div>
      ) : filteredMenuItems.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          Taom topilmadi
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredMenuItems.map(
            (item) => {
              const qtyInCart =
                getItemQuantityInCart(
                  item.id
                );

              return (
                <div
                  key={item.id}
                  className="border rounded-lg p-3 flex flex-col justify-between bg-white shadow-sm hover:shadow transition"
                >
                  <div>
                    {(item.imageUrl ||
                      item.image) && (
                      <img
                        src={
                          item.imageUrl ||
                          item.image
                        }
                        alt={
                          item.name || "Taom"
                        }
                        className="w-full h-28 object-cover rounded mb-2"
                      />
                    )}

                    <h3 className="font-semibold text-gray-800">
                      {item.name}
                    </h3>

                    <p className="text-sm text-gray-500 mb-2">
                      {Number(
                        item.price || 0
                      ).toLocaleString()}
                      {" "}
                      so'm
                    </p>
                  </div>

                  <div className="mt-2">
                    {qtyInCart > 0 ? (
                      <div className="flex items-center justify-between bg-blue-50 p-1 rounded">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              -1
                            )
                          }
                          className="px-2 py-1 bg-blue-500 text-white rounded font-bold"
                        >
                          -
                        </button>

                        <span className="font-bold text-blue-700">
                          {qtyInCart}
                        </span>

                        <button
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              1
                            )
                          }
                          className="px-2 py-1 bg-blue-500 text-white rounded font-bold"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          addToCart(item)
                        }
                        className="w-full py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                      >
                        Qo'shish
                      </button>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* CART FOOTER */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-40">
          <div className="max-w-4xl mx-auto flex justify-between items-center gap-3">
            <div>
              <p className="text-xs text-gray-500">
                Savatda: {totalCount} taom
              </p>

              <p className="font-bold text-lg text-gray-800">
                {totalPrice.toLocaleString()}
                {" "}
                so'm
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  setIsCartModalOpen(
                    true
                  )
                }
                className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium text-sm"
              >
                Savat
              </button>

              <button
                onClick={
                  handleSubmitOrder
                }
                disabled={
                  submitting ||
                  !currentUser?.uid ||
                  !cafeId
                }
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
              >
                {submitting
                  ? "Yuborilmoqda..."
                  : "Buyurtma berish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CART MODAL */}
      {isCartModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Savat
              </h2>

              <button
                onClick={() =>
                  setIsCartModalOpen(
                    false
                  )
                }
                className="text-gray-500 hover:text-gray-700 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 mb-4">
              {cart.map(
                (item) => (
                  <div
                    key={item.id}
                    className="border-b pb-3"
                  >
                    <div className="flex justify-between items-center gap-2 mb-1">
                      <span className="font-semibold">
                        {item.name}
                      </span>

                      <span className="text-sm font-bold">
                        {(
                          item.price *
                          item.quantity
                        ).toLocaleString()}
                        {" "}
                        so'm
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Eslatma..."
                        value={item.note}
                        onChange={(e) =>
                          updateNote(
                            item.id,
                            e.target.value
                          )
                        }
                        className="text-xs p-2 border rounded w-3/5"
                      />

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              -1
                            )
                          }
                          className="px-2 py-1 bg-gray-200 rounded"
                        >
                          -
                        </button>

                        <span className="font-medium text-sm">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              1
                            )
                          }
                          className="px-2 py-1 bg-gray-200 rounded"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="flex justify-between font-bold text-lg">
                <span>
                  Jami:
                </span>

                <span>
                  {totalPrice.toLocaleString()}
                  {" "}
                  so'm
                </span>
              </div>

              <button
                onClick={
                  handleSubmitOrder
                }
                disabled={
                  submitting ||
                  !currentUser?.uid ||
                  !cafeId
                }
                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Yuborilmoqda..."
                  : "Tasdiqlash va Oshxonaga Yuborish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}