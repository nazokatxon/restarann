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
                newKitchenItems.length > 0
                  ? newKitchenItems.every((i) => i.isReady)
                    ? "ready"
                    : "pending"
                  : "ready",

              updatedAt:
                serverTimestamp(),
            }
          );

          toast.success("Buyurtma yangilandi!");
        } else {
          // =====================================================
          // YANGI BUYURTMA YARATISH
          // =====================================================

          const newKitchenItems =
            kitchenItems.map(
              (item) => ({
                ...item,
                isReady: false,
              })
            );

          await addDoc(
            collection(
              db,
              "orders"
            ),
            {
              cafeId:
                cafeId || "",

              tableNumber:
                Number(
                  tableNumber
                ),

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
                newKitchenItems.length > 0
                  ? "pending"
                  : "ready",

              waiterId:
                currentUser?.uid ||
                "",

              createdAt:
                serverTimestamp(),

              updatedAt:
                serverTimestamp(),
            }
          );

          toast.success("Yangi buyurtma yaratildi!");
        }

        setCart([]);
        setIsCartModalOpen(false);
      } catch (error) {
        console.error(
          "Submit error:",
          error
        );

        toast.error(
          "Buyurtmani yuborishda xatolik!"
        );
      } finally {
        setSubmitting(false);
      }
    };

  // Filtered menu items
  const filteredMenuItems =
    menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "Barchasi" ||
        item.category === selectedCategory;

      const matchesSearch =
        item.name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      {/* Ready Notification Popup */}
      {readyNotification && (
        <div className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-bounce">
          <span className="text-xl">🔔</span>
          <div>
            <p className="font-bold">Taom Tayyor!</p>
            <p className="text-sm">Stol №{readyNotification.tableNumber}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Stol №{tableNumber}
          </h1>
          <p className="text-sm text-gray-500">
            {existingOrderId ? "Mavjud buyurtma bor" : "Yangi buyurtma"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsSoundOn(!isSoundOn)}
            className={`p-2 rounded-lg border ${
              isSoundOn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {isSoundOn ? "🔊 Ovoz yoqilgan" : "🔇 Ovoz o'chirilgan"}
          </button>

          <button
            onClick={() => navigate("/waiter/tables")}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
          >
            Stollar
          </button>
        </div>
      </div>

      {/* Existing Order Items Section */}
      {existingOrderId && (
        <div className="mb-6 p-4 border rounded-lg bg-yellow-50 border-yellow-200">
          <h2 className="text-lg font-bold mb-3 text-yellow-800">
            Aktiv Buyurtma (Jami: {existingOrderTotal.toLocaleString()} so'm)
          </h2>

          <div className="space-y-2 mb-4">
            {existingOrderItems.map((item, idx) => {
              const isReady = isItemReadyByKitchen(item);

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-white rounded border"
                >
                  <div>
                    <span className="font-semibold">{item.name}</span> x{" "}
                    {item.quantity}
                    {item.note && (
                      <span className="text-xs text-gray-500 block">
                        Eslatma: {item.note}
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
                        onClick={() => handleItemDelivered(idx)}
                        className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                      >
                        Mijozga berildi
                      </button>
                    ) : (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        Oshxonada tayyorlanmoqda...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleCloseTable}
            disabled={submitting || !allExistingItemsDelivered}
            className={`w-full py-2 rounded font-bold text-white transition ${
              allExistingItemsDelivered
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Stolni Yopish va To'lovni Yakunlash
          </button>
        </div>
      )}

      {/* Search & Categories */}
      <div className="mb-6 space-y-3">
        <input
          type="text"
          placeholder="Taom qidirish..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="text-center py-10">Menyu yuklanmoqda...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredMenuItems.map((item) => {
            const qtyInCart = getItemQuantityInCart(item.id);

            return (
              <div
                key={item.id}
                className="border rounded-lg p-3 flex flex-col justify-between bg-white shadow-sm hover:shadow transition"
              >
                <div>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-28 object-cover rounded mb-2"
                    />
                  )}
                  <h3 className="font-semibold text-gray-800">{item.name}</h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {Number(item.price || 0).toLocaleString()} so'm
                  </p>
                </div>

                <div className="mt-2">
                  {qtyInCart > 0 ? (
                    <div className="flex items-center justify-between bg-blue-50 p-1 rounded">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="px-2 py-1 bg-blue-500 text-white rounded font-bold"
                      >
                        -
                      </button>
                      <span className="font-bold text-blue-700">
                        {qtyInCart}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="px-2 py-1 bg-blue-500 text-white rounded font-bold"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="w-full py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                    >
                      Qo'shish
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Cart Footer Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg flex justify-between items-center max-w-4xl mx-auto z-40">
          <div>
            <p className="text-xs text-gray-500">Savatda: {totalCount} taom</p>
            <p className="font-bold text-lg text-gray-800">
              {totalPrice.toLocaleString()} so'm
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsCartModalOpen(true)}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium"
            >
              Savatni Ko'rish
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition disabled:bg-gray-400"
            >
              {submitting ? "Yuborilmoqda..." : "Buyurtma berish"}
            </button>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {isCartModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Savat</h2>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="border-b pb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-sm font-bold">
                      {(item.price * item.quantity).toLocaleString()} so'm
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <input
                      type="text"
                      placeholder="Eslatma (masalan: beziyoz)..."
                      value={item.note}
                      onChange={(e) => updateNote(item.id, e.target.value)}
                      className="text-xs p-1 border rounded w-3/5"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="px-2 py-0.5 bg-gray-200 rounded"
                      >
                        -
                      </button>
                      <span className="font-medium text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="px-2 py-0.5 bg-gray-200 rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="flex justify-between font-bold text-lg">
                <span>Jami:</span>
                <span>{totalPrice.toLocaleString()} so'm</span>
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={submitting}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {submitting ? "Yuborilmoqda..." : "Tasdiqlash va Oshxonaga Yuborish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}