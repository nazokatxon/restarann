import React, {
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

import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

export default function OrderForm() {
  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const {
    cafeId,
    currentUser,
    logout,
  } = useAuth();

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

  /*
   * MUHIM:
   * Oshpaz isReady ni kitchenItems ichiga yozadi.
   * Shuning uchun ofitsiant ham kitchenItems ni
   * alohida kuzatadi.
   */
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

  const readyNotificationTimerRef =
    useRef(null);

  const readyNotificationQueueRef =
    useRef([]);

  const readyNotifiedIdsRef =
    useRef(new Set());

  const audioContextRef =
    useRef(null);

  // =========================================================
  // AUDIO
  // =========================================================

  const getAudioContext = () => {
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
  };

  const playReadySound = async () => {
    if (!isSoundOn) return;

    try {
      const ctx =
        getAudioContext();

      if (!ctx) return;

      if (
        ctx.state ===
        "suspended"
      ) {
        await ctx.resume();
      }

      const now =
        ctx.currentTime;

      const beep = (
        offset,
        frequency,
        duration = 0.22
      ) => {
        const oscillator =
          ctx.createOscillator();

        const gain =
          ctx.createGain();

        oscillator.type =
          "sine";

        oscillator.frequency.setValueAtTime(
          frequency,
          now + offset
        );

        gain.gain.setValueAtTime(
          0.0001,
          now + offset
        );

        gain.gain.exponentialRampToValueAtTime(
          0.55,
          now +
            offset +
            0.02
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now +
            offset +
            duration
        );

        oscillator.connect(gain);
        gain.connect(
          ctx.destination
        );

        oscillator.start(
          now + offset
        );

        oscillator.stop(
          now +
            offset +
            duration +
            0.03
        );
      };

      beep(0, 880, 0.25);
      beep(0.32, 1046, 0.25);
      beep(0.64, 880, 0.32);
    } catch (error) {
      console.log(
        "Audio play error:",
        error
      );
    }
  };

  // =========================================================
  // OSHPAZ TAYYOR BUYURTMANI KUZATISH
  // =========================================================

  useEffect(() => {
    if (!cafeId) return;

    const ordersRef =
      collection(
        db,
        "orders"
      );

    const q = query(
      ordersRef,
      where(
        "cafeId",
        "==",
        cafeId
      )
    );

    let firstSnapshot = true;

    const unsubscribe =
      onSnapshot(
        q,
        (snapshot) => {
          /*
           * Eski ready orderlar uchun
           * birinchi yuklanganda signal bermaymiz.
           */
          if (firstSnapshot) {
            firstSnapshot = false;
            return;
          }

          snapshot
            .docChanges()
            .forEach(
              (change) => {
                if (
                  change.type !==
                    "modified" &&
                  change.type !==
                    "added"
                ) {
                  return;
                }

                const orderData =
                  change.doc.data();

                const orderId =
                  change.doc.id;

                /*
                 * Oshpazning umumiy statusi
                 * ready bo'lganda xabar.
                 */
                if (
                  orderData.kitchenStatus !==
                  "ready"
                ) {
                  readyNotifiedIdsRef.current.delete(
                    orderId
                  );

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
                    id:
                      orderId,

                    tableNumber:
                      orderData.tableNumber ??
                      "?",
                  }
                );
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
  }, [cafeId, isSoundOn]);

  // =========================================================
  // READY NOTIFICATION
  // =========================================================

  useEffect(() => {
    if (
      readyNotification ||
      readyNotificationQueueRef.current
        .length === 0
    ) {
      return;
    }

    const nextNotification =
      readyNotificationQueueRef.current.shift();

    if (!nextNotification) return;

    setReadyNotification(
      nextNotification
    );

    playReadySound();

    if (
      readyNotificationTimerRef.current
    ) {
      clearTimeout(
        readyNotificationTimerRef.current
      );
    }

    readyNotificationTimerRef.current =
      setTimeout(() => {
        setReadyNotification(
          null
        );
      }, 3500);
  }, [readyNotification]);

  // =========================================================
  // SHU STOLDA MAVJUD BUYURTMANI TOPISH
  // =========================================================

  useEffect(() => {
    if (!tableNumber) return;

    const fetchActiveOrderForTable =
      async () => {
        try {
          const q = query(
            collection(
              db,
              "orders"
            ),
            where(
              "tableNumber",
              "==",
              Number(
                tableNumber
              )
            ),
            where(
              "paymentStatus",
              "==",
              "unpaid"
            )
          );

          const querySnapshot =
            await getDocs(q);

          console.log(
            `🔍 Stol ${tableNumber} uchun unpaid buyurtmalar:`,
            querySnapshot.size
          );

          if (
            !querySnapshot.empty
          ) {
            const activeOrderDoc =
              querySnapshot.docs[0];

            const orderData =
              activeOrderDoc.data();

            setExistingOrderId(
              activeOrderDoc.id
            );

            setExistingOrderItems(
              Array.isArray(
                orderData.items
              )
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
                orderData.totalPrice ||
                  0
              )
            );

            console.log(
              "➡️ Mavjud order:",
              activeOrderDoc.id
            );
          } else {
            setExistingOrderId(
              null
            );

            setExistingOrderItems(
              []
            );

            setExistingKitchenItems(
              []
            );

            setExistingOrderTotal(
              0
            );
          }
        } catch (error) {
          console.error(
            "Stol buyurtmasini yuklash:",
            error
          );
        }
      };

    fetchActiveOrderForTable();
  }, [tableNumber]);

  // =========================================================
  // MUHIM:
  // OSHPAZ TAYYOR BOSGANINI REALTIME OLISH
  // =========================================================

  useEffect(() => {
    if (!existingOrderId) return;

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
          if (
            !snapshot.exists()
          ) {
            setExistingOrderId(
              null
            );

            setExistingOrderItems(
              []
            );

            setExistingKitchenItems(
              []
            );

            return;
          }

          const data =
            snapshot.data();

          setExistingOrderItems(
            Array.isArray(
              data.items
            )
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
              data.totalPrice ||
                0
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

    return () =>
      unsubscribe();
  }, [existingOrderId]);

  // =========================================================
  // MENYU
  // =========================================================

  useEffect(() => {
    const menuRef =
      collection(
        db,
        "menu"
      );

    const unsubscribe =
      onSnapshot(
        menuRef,
        (snapshot) => {
          const items =
            snapshot.docs.map(
              (menuDoc) => ({
                id:
                  menuDoc.id,
                ...menuDoc.data(),
              })
            );

          let finalItems =
            items;

          if (cafeId) {
            const cafeFiltered =
              items.filter(
                (item) =>
                  item.cafeId ===
                  cafeId
              );

            if (
              cafeFiltered.length >
              0
            ) {
              finalItems =
                cafeFiltered;
            }
          }

          setMenuItems(
            finalItems
          );

          const rawCats =
            finalItems
              .map(
                (item) =>
                  item.category
              )
              .filter(Boolean);

          setCategories([
            "Barchasi",
            ...Array.from(
              new Set(
                rawCats
              )
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

    return () =>
      unsubscribe();
  }, [cafeId]);

  // =========================================================
  // CART
  // =========================================================

  const addToCart = (
    item
  ) => {
    setCart(
      (prev) => {
        const existing =
          prev.find(
            (i) =>
              i.id ===
              item.id
          );

        if (existing) {
          return prev.map(
            (i) =>
              i.id ===
              item.id
                ? {
                    ...i,
                    quantity:
                      i.quantity +
                      1,
                  }
                : i
          );
        }

        return [
          ...prev,
          {
            id:
              item.id,

            name:
              item.name,

            price:
              Number(
                item.price ||
                  0
              ),

            category:
              item.category ||
              "",

            imageUrl:
              item.imageUrl ||
              item.image ||
              "",

            quantity: 1,

            note: "",
          },
        ];
      }
    );
  };

  const updateQuantity = (
    id,
    delta
  ) => {
    setCart(
      (prev) =>
        prev
          .map(
            (item) => {
              if (
                item.id !==
                id
              ) {
                return item;
              }

              const newQty =
                item.quantity +
                delta;

              if (
                newQty <=
                0
              ) {
                return null;
              }

              return {
                ...item,
                quantity:
                  newQty,
              };
            }
          )
          .filter(Boolean)
    );
  };

  const updateNote = (
    id,
    noteText
  ) => {
    setCart(
      (prev) =>
        prev.map(
          (item) =>
            item.id ===
            id
              ? {
                  ...item,
                  note:
                    noteText,
                }
              : item
        )
    );
  };

  const getItemQuantityInCart =
    (id) => {
      const found =
        cart.find(
          (item) =>
            item.id ===
            id
        );

      return found
        ? found.quantity
        : 0;
    };

  const totalCount =
    cart.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.quantity,
      0
    );

  const totalPrice =
    cart.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.price ||
            0
        ) *
          item.quantity,
      0
    );

  // =========================================================
  // ICHIMLIKNI ANIQLASH
  // =========================================================

  const isDrinkCategory =
    (category) => {
      const cat =
        String(
          category || ""
        )
          .trim()
          .toLowerCase();

      return (
        cat.includes(
          "ichimlik"
        ) ||
        cat.includes(
          "drink"
        ) ||
        cat.includes(
          "napitok"
        )
      );
    };

  // =========================================================
  // ⭐ ENG MUHIM FUNKSIYA
  //
  // Oshpaz kodi:
  //
  // kitchenItems[index].isReady = true
  //
  // deb yozmoqda.
  //
  // Shu sababli shu yerda kitchenItems
  // ichidan tekshiramiz.
  // =========================================================

  const isItemReadyByKitchen =
    (item) => {
      if (!item) {
        return false;
      }

      /*
       * Ichimlik oshxonaga bormasa,
       * uni kutmaymiz.
       */
      if (
        isDrinkCategory(
          item.category
        )
      ) {
        return true;
      }

      /*
       * Avval ID bo'yicha qidiramiz.
       */
      const kitchenItem =
        existingKitchenItems.find(
          (kitchenItem) =>
            kitchenItem.id ===
            item.id
        );

      if (
        kitchenItem
      ) {
        return (
          kitchenItem.isReady ===
          true
        );
      }

      /*
       * Eski ma'lumotlarda ID bo'lmasa,
       * nom bo'yicha ham tekshiramiz.
       */
      const sameNameItem =
        existingKitchenItems.find(
          (kitchenItem) =>
            String(
              kitchenItem.name ||
                ""
            ).trim() ===
            String(
              item.name ||
                ""
            ).trim()
        );

      if (
        sameNameItem
      ) {
        return (
          sameNameItem.isReady ===
          true
        );
      }

      return false;
    };

  // =========================================================
  // ⭐ TAOMNI YETKAZILDI QILISH
  // =========================================================

  const handleItemDelivered =
    async (
      itemIndex
    ) => {
      if (!existingOrderId) {
        toast.error(
          "Buyurtma topilmadi!"
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
          await getDoc(
            orderRef
          );

        if (
          !orderSnap.exists()
        ) {
          toast.error(
            "Buyurtma topilmadi!"
          );

          return;
        }

        const orderData =
          orderSnap.data();

        const items =
          Array.isArray(
            orderData.items
          )
            ? [
                ...orderData.items,
              ]
            : [];

        const kitchenItems =
          Array.isArray(
            orderData.kitchenItems
          )
            ? [
                ...orderData.kitchenItems,
              ]
            : [];

        if (
          !items[itemIndex]
        ) {
          toast.error(
            "Taom topilmadi!"
          );

          return;
        }

        const selectedItem =
          items[itemIndex];

        // =====================================================
        // ⭐ OSHPAZ TAYYOR QILGANMI?
        // =====================================================

        let kitchenItem =
          kitchenItems.find(
            (item) =>
              item.id ===
              selectedItem.id
          );

        /*
         * ID bo'lmasa nom bo'yicha.
         */
        if (
          !kitchenItem
        ) {
          kitchenItem =
            kitchenItems.find(
              (item) =>
                String(
                  item.name ||
                    ""
                ).trim() ===
                String(
                  selectedItem.name ||
                    ""
                ).trim()
            );
        }

        const isDrink =
          isDrinkCategory(
            selectedItem.category
          );

        /*
         * OVQAT bo'lsa:
         * oshpaz isReady=true qilmagan bo'lsa
         * YO'L QO'YILMAYDI.
         */
        if (
          !isDrink &&
          (!kitchenItem ||
            kitchenItem.isReady !==
              true)
        ) {
          toast.warning(
            "⚠️ Oshpaz hali bu taomni tayyor deb belgilamagan!",
            {
              autoClose:
                1800,
            }
          );

          return;
        }

        /*
         * Allaqachon yetkazilgan bo'lsa
         * yana bosilmaydi.
         */
        if (
          selectedItem.delivered ===
          true
        ) {
          return;
        }

        // =====================================================
        // FAQAT SHU ITEM YETKAZILDI
        // =====================================================

        items[itemIndex] = {
          ...selectedItem,

          delivered:
            true,

          deliveredAt:
            new Date().toISOString(),

          deliveredBy:
            currentUser?.uid ||
            "",
        };

        /*
         * Barcha itemlar yetkazilganmi?
         */
        const allDelivered =
          items.length >
            0 &&
          items.every(
            (item) =>
              item.delivered ===
              true
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

        setExistingOrderItems(
          items
        );

        toast.success(
          `✓ ${
            selectedItem.name
          } mijozga yetkazildi`,
          {
            autoClose:
              1200,
          }
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
  // HAMMA TAOM YETKAZILGANMI?
  // =========================================================

  const allExistingItemsDelivered =
    existingOrderItems.length >
      0 &&
    existingOrderItems.every(
      (item) =>
        item.delivered ===
        true
    );

  // =========================================================
  // STOLNI YOPISH
  // =========================================================

  const handleCloseTable =
    async () => {
      if (!existingOrderId) {
        toast.error(
          "Yopiladigan buyurtma yo'q!"
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

        await updateDoc(
          orderRef,
          {
            paymentStatus:
              "paid",

            deliveryStatus:
              "delivered",

            status:
              "completed",

            kitchenStatus:
              "completed",

            closedAt:
              serverTimestamp(),

            closedBy:
              currentUser?.uid ||
              "",

            updatedAt:
              serverTimestamp(),
          }
        );

        toast.success(
          "✓ Mijozga yetkazildi. Stol yopildi!",
          {
            autoClose:
              1800,
          }
        );

        setExistingOrderId(
          null
        );

        setExistingOrderItems(
          []
        );

        setExistingKitchenItems(
          []
        );

        setExistingOrderTotal(
          0
        );

        setCart([]);

        setIsCartModalOpen(
          false
        );

        navigate(
          "/waiter/tables"
        );
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
      console.log(
        "🚀 SUBMIT:",
        {
          tableNumber,
          cartCount:
            cart.length,
          existingOrderId,
        }
      );

      if (!tableNumber) {
        toast.error(
          "Iltimos, stol raqamini kiriting!"
        );

        return;
      }

      if (
        cart.length ===
        0
      ) {
        toast.error(
          "Savat bo'sh! Taom tanlang."
        );

        return;
      }

      setSubmitting(true);

      try {
        let finalAllItems =
          [
            ...existingOrderItems,
          ];

        // =====================================================
        // YANGI TAOMLARNI QO'SHISH
        // =====================================================

        cart.forEach(
          (cartItem) => {
            const index =
              finalAllItems.findIndex(
                (item) =>
                  item.id ===
                  cartItem.id
              );

            if (
              index > -1
            ) {
              /*
               * Agar oldingi shu taom
               * allaqachon mijozga berilgan bo'lsa,
               * yangi item sifatida qo'shamiz.
               */
              if (
                finalAllItems[
                  index
                ].delivered ===
                true
              ) {
                finalAllItems.push(
                  {
                    id:
                      cartItem.id,

                    name:
                      cartItem.name,

                    price:
                      Number(
                        cartItem.price ||
                          0
                      ),

                    quantity:
                      cartItem.quantity,

                    category:
                      cartItem.category ||
                      "",

                    imageUrl:
                      cartItem.imageUrl ||
                      "",

                    note:
                      cartItem.note ||
                      "",

                    delivered:
                      false,
                  }
                );
              } else {
                /*
                 * Hali berilmagan bo'lsa,
                 * miqdorini oshiramiz.
                 *
                 * MUHIM:
                 * qayta oshxonaga yuborilganda
                 * bu taom yana tayyorlanishi kerak.
                 */
                finalAllItems[
                  index
                ] = {
                  ...finalAllItems[
                    index
                  ],

                  quantity:
                    Number(
                      finalAllItems[
                        index
                      ].quantity ||
                        0
                    ) +
                    Number(
                      cartItem.quantity ||
                        0
                    ),

                  note:
                    cartItem.note
                      ? finalAllItems[
                          index
                        ].note
                        ? `${finalAllItems[index].note}, ${cartItem.note}`
                        : cartItem.note
                      : finalAllItems[
                          index
                        ].note,

                  delivered:
                    false,
                };
              }
            } else {
              finalAllItems.push(
                {
                  id:
                    cartItem.id,

                  name:
                    cartItem.name,

                  price:
                    Number(
                      cartItem.price ||
                        0
                    ),

                  quantity:
                    cartItem.quantity,

                  category:
                    cartItem.category ||
                    "",

                  imageUrl:
                    cartItem.imageUrl ||
                    "",

                  note:
                    cartItem.note ||
                    "",

                  delivered:
                    false,
                }
              );
            }
          }
        );

        // =====================================================
        // TOTAL
        // =====================================================

        const finalTotalPrice =
          finalAllItems.reduce(
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
                    0
                ),
            0
          );

        // =====================================================
        // OSHXONA / OFITSIANT
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
        // MAVJUD BUYURTMA
        // =====================================================

        if (
          existingOrderId
        ) {
          const orderRef =
            doc(
              db,
              "orders",
              existingOrderId
            );

          /*
           * Yangi oshxonaga ketayotgan itemlar
           * isReady=false bo'ladi.
           *
           * Avvalgi tayyor itemlarni esa
           * kitchenItems ichidan saqlaymiz.
           */
          const newKitchenItems =
            kitchenItems.map(
              (item) => {
                const oldKitchenItem =
                  existingKitchenItems.find(
                    (oldItem) =>
                      oldItem.id ===
                      item.id
                  );

                /*
                 * Agar item oldin tayyor bo'lgan
                 * va miqdori o'zgarmagan bo'lsa,
                 * statusni saqlaymiz.
                 */
                if (
                  oldKitchenItem &&
                  oldKitchenItem.isReady ===
                    true &&
                  item.delivered !==
                    true
                ) {
                  return {
                    ...item,
                    isReady:
                      true,
                  };
                }

                /*
                 * Yangi qo'shilgan taom:
                 * yana oshpaz tayyorlashi kerak.
                 */
                return {
                  ...item,
                  isReady:
                    false,
                };
              }
            );

          await updateDoc(
            orderRef,
            {
              items:
                finalAllItems,

              kitchenItems:
                newKitchenItems,

              waiterItems:
                waiterItems,

              totalPrice:
                finalTotalPrice,

              paymentStatus:
                "unpaid",

              kitchenStatus:
                newKitchenItems.length >
                0
                  ? "pending"
                  : "none",

              status:
                newKitchenItems.length >
                0
                  ? "preparing"
                  : "ready",

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
            "🍲 Yangi taomlar oshxonaga yuborildi!",
            {
              autoClose:
                1800,
            }
          );
        }

        // =====================================================
        // YANGI BUYURTMA
        // =====================================================

        else {
          const formattedCartItems =
            cart.map(
              (item) => ({
                id:
                  item.id,

                name:
                  item.name,

                price:
                  Number(
                    item.price ||
                      0
                  ),

                quantity:
                  item.quantity,

                category:
                  item.category ||
                  "",

                imageUrl:
                  item.imageUrl ||
                  "",

                note:
                  item.note ||
                  "",

                /*
                 * Yangi ovqat hali
                 * mijozga berilmagan.
                 */
                delivered:
                  false,
              })
            );

          const newKitchenItems =
            formattedCartItems.map(
              (item) => ({
                ...item,

                /*
                 * ⭐ ENG MUHIM
                 *
                 * Yangi buyurtmada
                 * oshpaz hali tayyorlamagan.
                 */
                isReady:
                  false,
              })
            );

          const newWaiterItems =
            formattedCartItems.filter(
              (item) =>
                isDrinkCategory(
                  item.category
                )
            );

          const onlyKitchenItems =
            newKitchenItems.filter(
              (item) =>
                !isDrinkCategory(
                  item.category
                )
            );

          const orderData =
            {
              cafeId:
                cafeId || "",

              tableNumber:
                Number(
                  tableNumber
                ),

              kitchenItems:
                onlyKitchenItems,

              waiterItems:
                newWaiterItems,

              items:
                formattedCartItems,

              totalPrice:
                totalPrice,

              paymentStatus:
                "unpaid",

              /*
               * Oshxonaga yuborildi.
               */
              kitchenStatus:
                onlyKitchenItems.length >
                0
                  ? "pending"
                  : "none",

              status:
                onlyKitchenItems.length >
                0
                  ? "preparing"
                  : "ready",

              itemStatuses:
                onlyKitchenItems.map(
                  () =>
                    "pending"
                ),

              createdAt:
                serverTimestamp(),

              waiterId:
                currentUser?.uid ||
                "",

              waiterEmail:
                currentUser?.email ||
                "",

              orderSource:
                "waiter",
            };

          console.log(
            "📝 YANGI ORDER:",
            orderData
          );

          const docRef =
            await addDoc(
              collection(
                db,
                "orders"
              ),
              orderData
            );

          setExistingOrderId(
            docRef.id
          );

          setExistingOrderItems(
            formattedCartItems
          );

          setExistingKitchenItems(
            onlyKitchenItems
          );

          setExistingOrderTotal(
            totalPrice
          );

          toast.success(
            onlyKitchenItems.length >
              0
              ? "🍲 Buyurtma oshxonaga yuborildi!"
              : "🥤 Ichimlik buyurtmasi qabul qilindi!",
            {
              autoClose:
                1800,
            }
          );
        }

        setCart([]);

        setIsCartModalOpen(
          true
        );
      } catch (error) {
        console.error(
          "❌ BUYURTMA XATOSI:",
          error
        );

        console.error(
          "Xato kodi:",
          error.code
        );

        console.error(
          "Xato matni:",
          error.message
        );

        toast.error(
          "Buyurtma yuborilmadi: " +
            error.message
        );
      } finally {
        setSubmitting(false);
      }
    };

  // =========================================================
  // FILTER
  // =========================================================

  const filteredItems =
    menuItems.filter(
      (item) => {
        const matchesCategory =
          selectedCategory ===
            "Barchasi" ||
          String(
            item.category
          )
            .trim()
            .toLowerCase() ===
            selectedCategory
              .trim()
              .toLowerCase();

        const matchesSearch =
          String(
            item.name || ""
          )
            .toLowerCase()
            .includes(
              searchQuery.toLowerCase()
            );

        return (
          matchesCategory &&
          matchesSearch
        );
      }
    );

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      className="
        min-h-screen
        bg-slate-100
        text-slate-800
        flex
        flex-col
        font-sans
        select-none
        pb-28
        antialiased
        relative
        overflow-x-hidden
      "
    >

      {/* =====================================================
          TAYYOR BUYURTMA XABARI
          ===================================================== */}

      {readyNotification && (
        <button
          type="button"
          onClick={() => {
            setReadyNotification(
              null
            );

            if (
              readyNotificationTimerRef.current
            ) {
              clearTimeout(
                readyNotificationTimerRef.current
              );
            }

            navigate(
              "/waiter/tables"
            );
          }}
          className="
            fixed
            top-24
            right-2
            z-[60]
            w-[145px]
            bg-[#123d2d]
            text-white
            rounded-xl
            shadow-xl
            border
            border-emerald-700/50
            px-2
            py-2
            flex
            items-center
            gap-1.5
          "
        >
          <span
            className="
              w-7
              h-7
              rounded-lg
              bg-amber-400
              text-[#123d2d]
              flex
              items-center
              justify-center
              text-sm
              shrink-0
            "
          >
            🔔
          </span>

          <span
            className="
              min-w-0
              text-left
              text-[10px]
              font-black
              truncate
            "
          >
            {
              readyNotification.tableNumber
            }
            -STOL — TAYYOR!
          </span>
        </button>
      )}

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header
        className="
          sticky
          top-0
          z-20
          bg-white
          shadow-xs
          flex
          flex-col
          border-b
          border-slate-200
        "
      >
        <div
          className="
            px-4
            py-3
            flex
            justify-between
            items-center
            bg-white
            border-b
            border-slate-100
          "
        >
          <div
            className="
              flex
              items-center
              gap-2.5
            "
          >
            <div
              className="
                w-11
                h-11
                bg-amber-100
                rounded-2xl
                flex
                items-center
                justify-center
                text-xl
              "
            >
              🍲
            </div>

            <div>
              <h2
                className="
                  font-black
                  text-slate-800
                  text-sm
                  leading-tight
                "
              >
                KARAVAN KAFE
              </h2>

              <p
                className="
                  text-[10px]
                  font-bold
                  text-slate-400
                "
              >
                Ofitsiant
              </p>
            </div>
          </div>

          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <button
              onClick={() =>
                setIsSoundOn(
                  !isSoundOn
                )
              }
              className={`
                font-extrabold
                text-xs
                w-10
                h-10
                rounded-2xl
                shadow-md
                flex
                items-center
                justify-center
                ${
                  isSoundOn
                    ? "bg-amber-500 text-white"
                    : "bg-slate-200 text-slate-600"
                }
              `}
            >
              {isSoundOn
                ? "🔔"
                : "🔕"}
            </button>

            <button
              onClick={() =>
                logout
                  ? logout()
                  : navigate(
                      "/login"
                    )
              }
              className="
                border
                border-rose-200
                text-rose-500
                hover:bg-rose-50
                font-bold
                text-xs
                px-3.5
                py-2.5
                rounded-2xl
              "
            >
              Chiqish
            </button>
          </div>
        </div>

        <div
          className="
            bg-[#FAF7EE]
            px-4
            py-3
            flex
            justify-between
            items-center
          "
        >
          <button
            onClick={() =>
              navigate(
                "/waiter/tables"
              )
            }
            className="
              flex
              items-center
              gap-2
              text-slate-700
              font-extrabold
              text-sm
            "
          >
            <span>
              ⬅️
            </span>

            <span>
              Stollarga qaytish
            </span>
          </button>

          <div
            className="
              bg-amber-500
              text-white
              font-black
              text-xs
              px-3
              py-1.5
              rounded-xl
            "
          >
            Stol №
            {tableNumber}
          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN
          ===================================================== */}

      <main
        className="
          max-w-md
          mx-auto
          sm:max-w-xl
          w-full
          p-3
          sm:p-5
          flex
          flex-col
          gap-3
        "
      >
        {/* SEARCH */}

        <div
          className="
            relative
          "
        >
          <span
            className="
              absolute
              left-3.5
              top-1/2
              -translate-y-1/2
              text-slate-400
              text-sm
            "
          >
            🔍
          </span>

          <input
            type="text"
            placeholder="Taom nomini yozing..."
            value={
              searchQuery
            }
            onChange={(e) =>
              setSearchQuery(
                e.target.value
              )
            }
            className="
              w-full
              pl-9
              pr-8
              py-2.5
              bg-white
              border
              border-slate-200
              rounded-2xl
              text-sm
              font-medium
              focus:outline-none
              focus:ring-2
              focus:ring-amber-500
            "
          />

          {searchQuery && (
            <button
              onClick={() =>
                setSearchQuery(
                  ""
                )
              }
              className="
                absolute
                right-3
                top-1/2
                -translate-y-1/2
                text-slate-400
                font-bold
                text-xs
              "
            >
              ✕
            </button>
          )}
        </div>

        {/* CATEGORIES */}

        <div
          className="
            flex
            gap-2
            overflow-x-auto
            pb-1
          "
        >
          {categories.map(
            (cat) => {
              const isActive =
                selectedCategory.toLowerCase() ===
                cat.toLowerCase();

              return (
                <button
                  key={cat}
                  onClick={() =>
                    setSelectedCategory(
                      cat
                    )
                  }
                  className={`
                    px-4
                    py-2
                    rounded-xl
                    text-xs
                    font-bold
                    whitespace-nowrap
                    ${
                      isActive
                        ? "bg-amber-500 text-white"
                        : "bg-white text-slate-600 border border-slate-200"
                    }
                  `}
                >
                  {cat}
                </button>
              );
            }
          )}
        </div>

        {/* MENU */}

        {loading ? (
          <div
            className="
              py-20
              text-center
              text-slate-400
              text-sm
              font-semibold
            "
          >
            Yuklanmoqda...
          </div>
        ) : filteredItems.length ===
          0 ? (
          <div
            className="
              bg-white
              rounded-2xl
              p-8
              text-center
              text-slate-400
              text-sm
              border
              border-slate-200
            "
          >
            Taom topilmadi
          </div>
        ) : (
          <div
            className="
              flex
              flex-col
              gap-2
            "
          >
            {filteredItems.map(
              (item) => {
                const qtyInCart =
                  getItemQuantityInCart(
                    item.id
                  );

                return (
                  <div
                    key={
                      item.id
                    }
                    onClick={() =>
                      addToCart(
                        item
                      )
                    }
                    className={`
                      bg-white
                      rounded-2xl
                      p-2.5
                      border
                      flex
                      items-center
                      justify-between
                      cursor-pointer
                      ${
                        qtyInCart >
                        0
                          ? "border-amber-500 bg-amber-500/5"
                          : "border-slate-200"
                      }
                    `}
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-3
                        min-w-0
                      "
                    >
                      {item.imageUrl ? (
                        <img
                          src={
                            item.imageUrl
                          }
                          alt={
                            item.name
                          }
                          className="
                            w-14
                            h-14
                            object-cover
                            rounded-xl
                            shrink-0
                          "
                        />
                      ) : (
                        <div
                          className="
                            w-14
                            h-14
                            bg-slate-100
                            rounded-xl
                            flex
                            items-center
                            justify-center
                            text-xl
                            shrink-0
                          "
                        >
                          🍲
                        </div>
                      )}

                      <div
                        className="
                          min-w-0
                        "
                      >
                        <h3
                          className="
                            font-bold
                            text-slate-800
                            text-sm
                            truncate
                          "
                        >
                          {
                            item.name
                          }
                        </h3>

                        <span
                          className="
                            text-xs
                            font-black
                            text-amber-600
                          "
                        >
                          {Number(
                            item.price ||
                              0
                          ).toLocaleString()}
                          {" "}
                          so'm
                        </span>
                      </div>
                    </div>

                    {qtyInCart >
                      0 && (
                      <div
                        className="
                          bg-amber-500
                          text-white
                          font-extrabold
                          text-xs
                          px-2.5
                          py-1
                          rounded-xl
                        "
                      >
                        {
                          qtyInCart
                        }{" "}
                        ta
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </main>

      {/* =====================================================
          BOTTOM CART
          ===================================================== */}

      {totalCount >
        0 && (
        <div
          className="
            fixed
            bottom-3
            left-3
            right-3
            max-w-md
            mx-auto
            z-30
          "
        >
          <div
            className="
              bg-slate-900
              text-white
              p-3
              rounded-2xl
              shadow-xl
              flex
              items-center
              justify-between
            "
          >
            <div
              onClick={() =>
                setIsCartModalOpen(
                  true
                )
              }
              className="
                flex
                items-center
                gap-3
                cursor-pointer
                pl-2
                overflow-hidden
                pr-2
              "
            >
              <div
                className="
                  relative
                  shrink-0
                "
              >
                <span
                  className="
                    text-2xl
                  "
                >
                  🛒
                </span>

                <span
                  className="
                    absolute
                    -top-1
                    -right-2
                    bg-amber-500
                    text-white
                    font-extrabold
                    text-[10px]
                    w-5
                    h-5
                    rounded-full
                    flex
                    items-center
                    justify-center
                  "
                >
                  {
                    totalCount
                  }
                </span>
              </div>

              <div
                className="
                  flex
                  flex-col
                  min-w-0
                "
              >
                <span
                  className="
                    text-xs
                    font-bold
                    text-amber-300
                    truncate
                  "
                >
                  {cart
                    .map(
                      (item) =>
                        `${item.name} x${item.quantity}`
                    )
                    .join(
                      ", "
                    )}
                </span>

                <span
                  className="
                    text-sm
                    font-extrabold
                    text-white
                  "
                >
                  {totalPrice.toLocaleString()}
                  {" "}so'm
                </span>
              </div>
            </div>

            <button
              disabled={
                submitting
              }
              onClick={
                handleSubmitOrder
              }
              className="
                bg-amber-500
                hover:bg-amber-600
                text-white
                font-black
                text-xs
                px-4
                py-2.5
                rounded-xl
                shrink-0
              "
            >
              {submitting
                ? "Yuborilmoqda..."
                : "Yuborish 🚀"}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          ORDER MODAL
          ===================================================== */}

      {isCartModalOpen && (
        <div
          className="
            fixed
            inset-0
            bg-slate-900/60
            backdrop-blur-xs
            z-40
            flex
            items-end
            sm:items-center
            justify-center
            p-0
            sm:p-4
          "
        >
          <div
            className="
              bg-white
              w-full
              max-w-md
              rounded-t-3xl
              sm:rounded-2xl
              max-h-[90vh]
              flex
              flex-col
              p-4
              shadow-2xl
            "
          >

            {/* HEADER */}

            <div
              className="
                flex
                justify-between
                items-center
                pb-3
                border-b
                border-slate-100
              "
            >
              <h3
                className="
                  font-extrabold
                  text-slate-800
                  text-base
                  flex
                  items-center
                  gap-2
                "
              >
                <span>
                  📋 Stol №
                  {tableNumber}
                </span>
              </h3>

              <button
                onClick={() =>
                  setIsCartModalOpen(
                    false
                  )
                }
                className="
                  w-7
                  h-7
                  bg-slate-100
                  rounded-full
                  font-bold
                  text-slate-500
                  text-xs
                  flex
                  items-center
                  justify-center
                "
              >
                ✕
              </button>
            </div>

            {/* =================================================
                MAVJUD BUYURTMA
                ================================================= */}

            <div
              className="
                flex-1
                overflow-y-auto
                py-3
                space-y-3
              "
            >
              {existingOrderItems.length >
                0 && (
                <div>
                  <div
                    className="
                      text-[10px]
                      font-black
                      text-slate-400
                      mb-2
                    "
                  >
                    MAVJUD BUYURTMA
                  </div>

                  {existingOrderItems.map(
                    (
                      item,
                      index
                    ) => {
                      const isDrink =
                        isDrinkCategory(
                          item.category
                        );

                      /*
                       * ⭐ OSHPAZ TAYYOR QILGANMI?
                       */
                      const itemReady =
                        isItemReadyByKitchen(
                          item
                        );

                      return (
                        <div
                          key={`${item.id}-${index}`}
                          className="
                            bg-white
                            border-b
                            border-slate-200
                            py-3
                          "
                        >
                          {/* TAOM NOMI */}

                          <div
                            className="
                              flex
                              justify-between
                              items-start
                              gap-3
                            "
                          >
                            <div>
                              <h4
                                className="
                                  text-sm
                                  font-bold
                                  text-slate-800
                                "
                              >
                                {
                                  item.name
                                }

                                {" x"}

                                {
                                  item.quantity
                                }
                              </h4>

                              <span
                                className="
                                  text-[11px]
                                  font-bold
                                  text-amber-600
                                "
                              >
                                {(
                                  Number(
                                    item.price ||
                                      0
                                  ) *
                                  Number(
                                    item.quantity ||
                                      0
                                  )
                                ).toLocaleString()}
                                {" "}so'm
                              </span>
                            </div>
                          </div>

                          {/* =================================================
                              1. ALLAQACHON YETKAZILGAN
                              ================================================= */}

                          {item.delivered ===
                          true ? (
                            <div
                              className="
                                mt-2
                                w-full
                                bg-green-100
                                text-green-700
                                rounded-xl
                                py-2.5
                                text-center
                                text-xs
                                font-black
                              "
                            >
                              ✓ Taom
                              mijozga
                              yetkazildi
                            </div>
                          ) : isDrink ? (
                            /* =================================================
                               2. ICHIMLIK
                               ================================================= */

                            <button
                              type="button"
                              onClick={() =>
                                handleItemDelivered(
                                  index
                                )
                              }
                              className="
                                mt-2
                                w-full
                                bg-green-600
                                hover:bg-green-700
                                text-white
                                rounded-xl
                                py-2.5
                                text-xs
                                font-black
                              "
                            >
                              ✓ Taomni
                              yetkazildi
                            </button>
                          ) : itemReady ? (
                            /* =================================================
                               3. ⭐ OSHPAZ TAYYOR QILGAN
                               ENDI YETKAZISH MUMKIN
                               ================================================= */

                            <button
                              type="button"
                              onClick={() =>
                                handleItemDelivered(
                                  index
                                )
                              }
                              className="
                                mt-2
                                w-full
                                bg-green-600
                                hover:bg-green-700
                                text-white
                                rounded-xl
                                py-2.5
                                text-xs
                                font-black
                                active:scale-[0.98]
                                transition
                              "
                            >
                              ✓ Taomni
                              yetkazildi
                            </button>
                          ) : (
                            /* =================================================
                               4. ⭐ OSHPAZ HALI TAYYOR QILMAGAN
                               TUGMA YO'Q!
                               ================================================= */

                            <div
                              className="
                                mt-2
                                w-full
                                bg-blue-50
                                border
                                border-blue-100
                                text-blue-500
                                rounded-xl
                                py-2.5
                                text-center
                                text-xs
                                font-black
                              "
                            >
                              ⏳ Oshpaz
                              tayyorlamoqda...
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}

              {/* =================================================
                  YANGI CART
                  ================================================= */}

              {cart.length >
                0 && (
                <div>
                  <div
                    className="
                      text-[10px]
                      font-black
                      text-slate-400
                      mb-2
                    "
                  >
                    YANGI TAOMLAR
                  </div>

                  {cart.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        className="
                          bg-slate-50
                          p-2.5
                          rounded-xl
                          border
                          border-slate-100
                        "
                      >
                        <div
                          className="
                            flex
                            justify-between
                            items-start
                          "
                        >
                          <div>
                            <h4
                              className="
                                text-xs
                                font-bold
                                text-slate-800
                              "
                            >
                              {
                                item.name
                              }
                            </h4>

                            <span
                              className="
                                text-[11px]
                                font-bold
                                text-amber-600
                              "
                            >
                              {(
                                item.price *
                                item.quantity
                              ).toLocaleString()}
                              {" "}so'm
                            </span>
                          </div>

                          <div
                            className="
                              flex
                              items-center
                              gap-1.5
                              bg-white
                              border
                              border-slate-200
                              px-1.5
                              py-0.5
                              rounded-lg
                            "
                          >
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  -1
                                )
                              }
                              className="
                                font-bold
                                text-xs
                                text-slate-600
                                px-1
                              "
                            >
                              -
                            </button>

                            <span
                              className="
                                text-xs
                                font-extrabold
                                w-4
                                text-center
                              "
                            >
                              {
                                item.quantity
                              }
                            </span>

                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  1
                                )
                              }
                              className="
                                font-bold
                                text-xs
                                text-slate-600
                                px-1
                              "
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="Izoh..."
                          value={
                            item.note ||
                            ""
                          }
                          onChange={(
                            e
                          ) =>
                            updateNote(
                              item.id,
                              e.target
                                .value
                            )
                          }
                          className="
                            mt-2
                            w-full
                            text-[11px]
                            px-2.5
                            py-1.5
                            bg-white
                            border
                            border-slate-200
                            rounded-lg
                            focus:outline-none
                            focus:ring-1
                            focus:ring-amber-500
                          "
                        />
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* =================================================
                FOOTER
                ================================================= */}

            <div
              className="
                pt-3
                border-t
                border-slate-100
                space-y-3
              "
            >
              <div
                className="
                  flex
                  justify-between
                  items-center
                "
              >
                <span
                  className="
                    text-xs
                    font-bold
                    text-slate-500
                  "
                >
                  Jami:
                </span>

                <span
                  className="
                    text-lg
                    font-black
                    text-amber-600
                  "
                >
                  {(
                    existingOrderTotal +
                    totalPrice
                  ).toLocaleString()}
                  {" "}so'm
                </span>
              </div>

              {/* YANA TAOM */}

              <button
                onClick={() =>
                  setIsCartModalOpen(
                    false
                  )
                }
                className="
                  w-full
                  bg-amber-600
                  hover:bg-amber-700
                  text-white
                  font-black
                  text-xs
                  py-3
                  rounded-xl
                "
              >
                ＋ Yana taom
                qo'shish
              </button>

              {/* YANGI TAOMNI OSHXONAGA YUBORISH */}

              {cart.length >
                0 && (
                <button
                  disabled={
                    submitting
                  }
                  onClick={
                    handleSubmitOrder
                  }
                  className="
                    w-full
                    bg-amber-500
                    text-white
                    font-black
                    text-xs
                    py-3
                    rounded-xl
                    shadow-md
                  "
                >
                  {submitting
                    ? "Yuborilmoqda..."
                    : "Saqlash va Yuborish 🚀"}
                </button>
              )}

              {/* =================================================
                  STOLNI YOPISH
                  ================================================= */}

              <button
                type="button"
                disabled={
                  submitting ||
                  !allExistingItemsDelivered
                }
                onClick={
                  handleCloseTable
                }
                className={`
                  w-full
                  font-black
                  text-xs
                  py-3
                  rounded-xl
                  transition
                  ${
                    allExistingItemsDelivered
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }
                `}
              >
                ✓ Mijozga yetkazdim
                (Stolni yopish)
              </button>

              {!allExistingItemsDelivered &&
                existingOrderItems.length >
                  0 && (
                  <p
                    className="
                      text-center
                      text-[10px]
                      text-slate-400
                    "
                  >
                    Barcha taomlarni
                    mijozga
                    yetkazgandan
                    keyin stolni
                    yopishingiz
                    mumkin.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          ANIMATION
          ===================================================== */}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(110%);
            opacity: 0;
          }

          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slide-in-right {
          animation:
            slideInRight
            .28s
            ease-out
            both;
        }
      `}</style>
    </div>
  );
}