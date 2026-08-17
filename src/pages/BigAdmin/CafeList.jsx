import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
} from "firebase/firestore";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import "./CafeList.css";

// Mahalliy tarjimalar lug'ati
const translations = {
  uz: {
    big_admin_cafes: "Big Admin — Kafelar",
    add_cafe_btn: "Kafe qo'shish",
    total: "Jami",
    active: "Faol",
    blocked: "Bloklangan",
    filter_all: "Barchasi",
    filter_active: "Faol",
    filter_blocked: "Bloklangan",
    no_cafes_found: "Kafelar topilmadi",
    owner_label: "Egasi",
    contract_label: "Shartnoma",
    contract_expired: "Muddati tugagan",
    contract_expiring_soon: "Tez orada tugaydi",
    block_btn: "Bloklash",
    unblock_btn: "Ruxsat berish",
    edit_btn: "Tahrirlash",
    delete_btn: "O'chirish",
    modal_add_title: "Yangi kafe qo'shish",
    modal_add_desc:
      "Yangi kafe va uning direktor hisobini shu yerda yarating",
    cafe_name_label: "Kafe nomi",
    cafe_name_placeholder: "Masalan: Gusto Cafe",
    owner_name_label: "Egasi (direktor) ismi",
    owner_name_placeholder: "To'liq ism",
    phone_label: "Telefon raqami",
    address_label: "Manzil",
    address_placeholder: "Shahar, tuman, ko'cha",
    contract_start_label: "Shartnoma boshi",
    contract_end_label: "Shartnoma oxiri",
    director_section_badge: "Direktor kirish ma'lumotlari",
    owner_username_label: "Direktor logini",
    owner_username_placeholder: "login kiriting",
    owner_password_label: "Direktor paroli",
    owner_password_placeholder: "Kamida 6 ta belgi",
    save_btn: "Saqlash",
    saving: "Saqlanmoqda...",
    cancel_btn: "Bekor qilish",
    modal_edit_title: "Kafeni tahrirlash",
    modal_edit_desc: "Kafe ma'lumotlarini yangilash",
    update_btn: "Yangilash",
  },

  ru: {
    big_admin_cafes: "Big Admin — Кафе",
    add_cafe_btn: "Добавить кафе",
    total: "Всего",
    active: "Активные",
    blocked: "Заблокированные",
    filter_all: "Все",
    filter_active: "Активные",
    filter_blocked: "Заблокированные",
    no_cafes_found: "Кафе не найдены",
    owner_label: "Владелец",
    contract_label: "Контракт",
    contract_expired: "Срок истек",
    contract_expiring_soon: "Истекает скоро",
    block_btn: "Заблокировать",
    unblock_btn: "Разблокировать",
    edit_btn: "Редактировать",
    delete_btn: "Удалить",
    modal_add_title: "Добавить новое кафе",
    modal_add_desc:
      "Создайте новое кафе и аккаунт директора здесь",
    cafe_name_label: "Название кафе",
    cafe_name_placeholder: "Например: Gusto Cafe",
    owner_name_label: "Имя владельца (директора)",
    owner_name_placeholder: "Полное имя",
    phone_label: "Номер телефона",
    address_label: "Адрес",
    address_placeholder: "Город, район, улица",
    contract_start_label: "Начало контракта",
    contract_end_label: "Конец контракта",
    director_section_badge: "Данные входа директора",
    owner_username_label: "Логин директора",
    owner_username_placeholder: "Введите логин",
    owner_password_label: "Пароль директора",
    owner_password_placeholder: "Минимум 6 символов",
    save_btn: "Сохранить",
    saving: "Сохранение...",
    cancel_btn: "Отмена",
    modal_edit_title: "Редактировать кафе",
    modal_edit_desc: "Обновить информацию о кафе",
    update_btn: "Обновить",
  },
};

export default function CafeList() {
  const { t, i18n } = useTranslation();
  const { registerStaff } = useAuth();

  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCafe, setSelectedCafe] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all");

  // O'chirish modal holatlari
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCafe, setDeleteCafe] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    phone: "",
    address: "",
    contractStart: "",
    contractEnd: "",
    ownerUsername: "",
    ownerPassword: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    ownerName: "",
    phone: "",
    address: "",
    contractStart: "",
    contractEnd: "",
  });

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
  };

  const getText = (key) => {
    const currentLang =
      i18n.language || localStorage.getItem("i18nextLng") || "uz";

    const translated = t(key);

    if (translated && translated !== key) return translated;

    return (
      translations[currentLang]?.[key] ||
      translations["uz"]?.[key] ||
      key
    );
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "cafes"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setCafes(data);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      ownerName: "",
      phone: "",
      address: "",
      contractStart: "",
      contractEnd: "",
      ownerUsername: "",
      ownerPassword: "",
    });
  };

  const handleAddCafe = async (e) => {
    e.preventDefault();

    if (!form.name || !form.ownerName || !form.phone) {
      alert("Iltimos, barcha majburiy maydonlarni to'ldiring");
      return;
    }

    if (!form.ownerUsername || !form.ownerPassword) {
      alert("Iltimos, direktor uchun login va parol kiriting");
      return;
    }

    if (form.ownerPassword.length < 6) {
      alert("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      return;
    }

    setSubmitting(true);

    try {
      const cafeDocRef = await addDoc(collection(db, "cafes"), {
        name: form.name,
        ownerName: form.ownerName,
        phone: form.phone,
        address: form.address,
        contractStart: form.contractStart,
        contractEnd: form.contractEnd,
        status: "active",
        createdAt: new Date(),
      });

      const fullEmail = `${form.ownerUsername
        .trim()
        .toLowerCase()}@kafe.com`;

      await registerStaff(fullEmail, form.ownerPassword, {
        fullName: form.ownerName,
        role: "admin",
        cafeId: cafeDocRef.id,
        phone: form.phone,
        status: "active",
        password: form.ownerPassword,
      });

      setModalOpen(false);
      resetForm();

      alert("Kafe muvaffaqiyatli qo'shildi!");
    } catch (error) {
      console.error("Kafe qo'shishda xatolik:", error);
      alert("Xatolik yuz berdi. Ehtimol bunday login band.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (cafe) => {
    setSelectedCafe(cafe);

    setEditForm({
      name: cafe.name || "",
      ownerName: cafe.ownerName || "",
      phone: cafe.phone || "",
      address: cafe.address || "",
      contractStart: cafe.contractStart || "",
      contractEnd: cafe.contractEnd || "",
    });

    setEditModalOpen(true);
  };

  const handleUpdateCafe = async (e) => {
    e.preventDefault();

    if (!selectedCafe) return;

    setSubmitting(true);

    try {
      await updateDoc(doc(db, "cafes", selectedCafe.id), {
        name: editForm.name,
        ownerName: editForm.ownerName,
        phone: editForm.phone,
        address: editForm.address,
        contractStart: editForm.contractStart,
        contractEnd: editForm.contractEnd,
      });

      setEditModalOpen(false);
      setSelectedCafe(null);

      alert("Kafe ma'lumotlari muvaffaqiyatli yangilandi!");
    } catch (error) {
      console.error("Tahrirlashda xatolik:", error);
      alert("Tahrirlashda xatolik yuz berdi.");
    } finally {
      setSubmitting(false);
    }
  };

  // O'CHIRISH MODALINI OCHISH
  const handleDeleteCafe = (cafeId, cafeName) => {
    setDeleteCafe({
      id: cafeId,
      name: cafeName,
    });

    setDeleteModalOpen(true);
  };

  // HA - O'CHIRISH
  const confirmDeleteCafe = async () => {
    if (!deleteCafe) return;

    setDeleting(true);

    try {
      await deleteDoc(doc(db, "cafes", deleteCafe.id));

      setDeleteModalOpen(false);
      setDeleteCafe(null);
    } catch (error) {
      console.error("O'chirishda xatolik:", error);
      alert("O'chirishda xatolik yuz berdi.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleCafeStatus = async (cafe) => {
    const newStatus =
      cafe.status === "active" ? "blocked" : "active";

    const confirmMsg =
      newStatus === "blocked"
        ? `"${cafe.name}" kafesini bloklashga ishonchingiz komilmi?`
        : `"${cafe.name}" kafesiga ruxsat berishga ishonchingiz komilmi?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await updateDoc(doc(db, "cafes", cafe.id), {
        status: newStatus,
      });
    } catch (error) {
      console.error(
        "Statusni yangilashda xatolik:",
        error
      );
    }
  };

  const filteredCafes = cafes.filter((cafe) => {
    if (filter === "all") return true;

    return cafe.status === filter;
  });

  const activeCount = cafes.filter(
    (c) => c.status === "active"
  ).length;

  const blockedCount = cafes.filter(
    (c) => c.status === "blocked"
  ).length;

  const isContractExpiringSoon = (endDate) => {
    if (!endDate) return false;

    const end = new Date(endDate);
    const now = new Date();

    const diffDays =
      (end - now) / (1000 * 60 * 60 * 24);

    return diffDays >= 0 && diffDays <= 7;
  };

  const isContractExpired = (endDate) => {
    if (!endDate) return false;

    return new Date(endDate) < new Date();
  };

  if (loading) {
    return (
      <div
        style={{
          backgroundColor: "#f9fafb",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "256px",
          }}
        >
          <p
            style={{
              color: "#9ca3af",
              fontSize: "18px",
            }}
          >
            Yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  const currentLang =
    i18n.language ||
    localStorage.getItem("i18nextLng") ||
    "uz";

  return (
    <div
      style={{
        backgroundColor: "#f9fafb",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          padding: "20px 16px",
          maxWidth: "1000px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* SARLAVHA VA TUGMALAR QATORI */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#d97706",
              margin: 0,
              whiteSpace: "nowrap",
            }}
          >
            {getText("big_admin_cafes")}
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* TILLAR */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
                backgroundColor: "#f3f4f6",
                padding: "3px",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                boxShadow:
                  "0 2px 6px rgba(0,0,0,0.06)",
              }}
            >
              <button
                onClick={() => changeLanguage("uz")}
                style={{
                  width: "42px",
                  height: "30px",
                  padding: 0,
                  fontSize: "12px",
                  fontWeight: "700",
                  borderRadius: "9px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    currentLang === "uz"
                      ? "#d97706"
                      : "transparent",
                  color:
                    currentLang === "uz"
                      ? "#ffffff"
                      : "#6b7280",
                  boxShadow:
                    currentLang === "uz"
                      ? "0 2px 5px rgba(217,119,6,0.25)"
                      : "none",
                  transition: "all 0.2s ease",
                }}
              >
                UZ
              </button>

              <button
                onClick={() => changeLanguage("ru")}
                style={{
                  width: "42px",
                  height: "30px",
                  padding: 0,
                  fontSize: "12px",
                  fontWeight: "700",
                  borderRadius: "9px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    currentLang === "ru"
                      ? "#d97706"
                      : "transparent",
                  color:
                    currentLang === "ru"
                      ? "#ffffff"
                      : "#6b7280",
                  boxShadow:
                    currentLang === "ru"
                      ? "0 2px 5px rgba(217,119,6,0.25)"
                      : "none",
                  transition: "all 0.2s ease",
                }}
              >
                RU
              </button>
            </div>

            {/* KAFE QO'SHISH */}
            <button
              onClick={() => setModalOpen(true)}
              style={{
                backgroundColor: "#d97706",
                color: "#ffffff",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              + {getText("add_cafe_btn")}
            </button>
          </div>
        </div>

        {/* STATISTIKA */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, 1fr)",
            gap: "12px",
            marginBottom: "20px",
            width: "100%",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: 0,
              }}
            >
              {getText("total")}
            </p>

            <p
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                color: "#1f2937",
                margin: "4px 0 0 0",
              }}
            >
              {cafes.length}
            </p>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: 0,
              }}
            >
              {getText("active")}
            </p>

            <p
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                color: "#16a34a",
                margin: "4px 0 0 0",
              }}
            >
              {activeCount}
            </p>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: 0,
              }}
            >
              {getText("blocked")}
            </p>

            <p
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                color: "#dc2626",
                margin: "4px 0 0 0",
              }}
            >
              {blockedCount}
            </p>
          </div>
        </div>

        {/* FILTER */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "20px",
          }}
        >
          {[
            {
              key: "all",
              label: getText("filter_all"),
            },
            {
              key: "active",
              label: getText("filter_active"),
            },
            {
              key: "blocked",
              label: getText("filter_blocked"),
            },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                backgroundColor:
                  filter === f.key
                    ? "#d97706"
                    : "#ffffff",
                color:
                  filter === f.key
                    ? "#ffffff"
                    : "#374151",
                border:
                  filter === f.key
                    ? "none"
                    : "1px solid #d1d5db",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* KAFELAR RO'YXATI */}
        {filteredCafes.length === 0 ? (
          <p
            style={{
              color: "#9ca3af",
              fontSize: "14px",
            }}
          >
            {getText("no_cafes_found")}
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              width: "100%",
            }}
          >
            {filteredCafes.map((cafe) => (
              <div
                key={cafe.id}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "14px",
                  padding: "18px",
                  boxShadow:
                    "0 1px 3px rgba(0,0,0,0.1)",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontWeight: "600",
                        color: "#1f2937",
                        margin: 0,
                        fontSize: "18px",
                      }}
                    >
                      {cafe.name}
                    </h3>

                    <p
                      style={{
                        fontSize: "13px",
                        color: "#6b7280",
                        marginTop: "4px",
                        marginBottom: "2px",
                      }}
                    >
                      {getText("owner_label")}:{" "}
                      {cafe.ownerName}
                    </p>

                    <p
                      style={{
                        fontSize: "13px",
                        color: "#6b7280",
                        margin: 0,
                      }}
                    >
                      {cafe.phone}
                    </p>

                    {cafe.address && (
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#9ca3af",
                          marginTop: "2px",
                          marginBottom: 0,
                        }}
                      >
                        {cafe.address}
                      </p>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      padding: "4px 12px",
                      borderRadius: "9999px",
                      whiteSpace: "nowrap",
                      backgroundColor:
                        cafe.status === "active"
                          ? "#dcfce7"
                          : "#fee2e2",
                      color:
                        cafe.status === "active"
                          ? "#15803d"
                          : "#b91c1c",
                      fontWeight: "600",
                    }}
                  >
                    {cafe.status === "active"
                      ? getText("active")
                      : getText("blocked")}
                  </span>
                </div>

                {(cafe.contractStart ||
                  cafe.contractEnd) && (
                  <div
                    style={{
                      marginTop: "10px",
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    {getText("contract_label")}:{" "}
                    {cafe.contractStart || "?"} —{" "}
                    {cafe.contractEnd || "?"}

                    {isContractExpired(
                      cafe.contractEnd
                    ) && (
                      <span
                        style={{
                          marginLeft: "8px",
                          color: "#dc2626",
                          fontWeight: "500",
                        }}
                      >
                        {getText(
                          "contract_expired"
                        )}
                      </span>
                    )}

                    {!isContractExpired(
                      cafe.contractEnd
                    ) &&
                      isContractExpiringSoon(
                        cafe.contractEnd
                      ) && (
                        <span
                          style={{
                            marginLeft: "8px",
                            color: "#f97316",
                            fontWeight: "500",
                          }}
                        >
                          {getText(
                            "contract_expiring_soon"
                          )}
                        </span>
                      )}
                  </div>
                )}

                {/* TUGMALAR */}
                <div
                  style={{
                    marginTop: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <button
                    onClick={() =>
                      toggleCafeStatus(cafe)
                    }
                    style={{
                      fontSize: "12px",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontWeight: "500",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor:
                        cafe.status === "active"
                          ? "#fee2e2"
                          : "#dcfce7",
                      color:
                        cafe.status === "active"
                          ? "#b91c1c"
                          : "#15803d",
                    }}
                  >
                    {cafe.status === "active"
                      ? getText("block_btn")
                      : getText("unblock_btn")}
                  </button>

                  <button
                    onClick={() =>
                      openEditModal(cafe)
                    }
                    style={{
                      fontSize: "12px",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontWeight: "500",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: "#dbeafe",
                      color: "#1d4ed8",
                    }}
                  >
                    {getText("edit_btn")}
                  </button>

                  <button
                    onClick={() =>
                      handleDeleteCafe(
                        cafe.id,
                        cafe.name
                      )
                    }
                    style={{
                      fontSize: "12px",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontWeight: "500",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: "#f3f4f6",
                      color: "#374151",
                    }}
                  >
                    {getText("delete_btn")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL - YANGI KAFE QO'SHISH */}
        {modalOpen && (
          <div className="cafe-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="cafe-modal-box bg-white w-full max-w-md max-h-[92vh] flex flex-col rounded-2xl p-5">
              <div className="cafe-modal-header mb-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-800">
                    {getText("modal_add_title")}
                  </h2>

                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {getText("modal_add_desc")}
                </p>
              </div>

              <div className="cafe-modal-body overflow-y-auto">
                <form
                  onSubmit={handleAddCafe}
                  className="space-y-3.5"
                >
                  <div className="cafe-field">
                    <label className="cafe-field-label">
                      {getText("cafe_name_label")}
                    </label>

                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="cafe-input"
                      placeholder={getText(
                        "cafe_name_placeholder"
                      )}
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">
                      {getText("owner_name_label")}
                    </label>

                    <input
                      type="text"
                      name="ownerName"
                      value={form.ownerName}
                      onChange={handleChange}
                      className="cafe-input"
                      placeholder={getText(
                        "owner_name_placeholder"
                      )}
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">
                      {getText("phone_label")}
                    </label>

                    <input
                      type="text"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="cafe-input"
                      placeholder="+998 90 123 45 67"
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">
                      {getText("address_label")}
                    </label>

                    <input
                      type="text"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      className="cafe-input"
                      placeholder={getText(
                        "address_placeholder"
                      )}
                    />
                  </div>

                  <div className="cafe-field grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="cafe-field-label">
                        {getText(
                          "contract_start_label"
                        )}
                      </label>

                      <input
                        type="date"
                        name="contractStart"
                        value={form.contractStart}
                        onChange={handleChange}
                        className="cafe-input"
                      />
                    </div>

                    <div>
                      <label className="cafe-field-label">
                        {getText(
                          "contract_end_label"
                        )}
                      </label>

                      <input
                        type="date"
                        name="contractEnd"
                        value={form.contractEnd}
                        onChange={handleChange}
                        className="cafe-input"
                      />
                    </div>
                  </div>

                  <div className="cafe-field cafe-director-section bg-amber-50 p-3 rounded-xl border border-amber-200">
                    <span className="cafe-director-badge block text-xs font-bold text-amber-700 mb-2">
                      {getText(
                        "director_section_badge"
                      )}
                    </span>

                    <div className="mb-3">
                      <label className="cafe-field-label">
                        {getText(
                          "owner_username_label"
                        )}
                      </label>

                      <input
                        type="text"
                        name="ownerUsername"
                        value={form.ownerUsername}
                        onChange={handleChange}
                        className="cafe-input"
                        placeholder={getText(
                          "owner_username_placeholder"
                        )}
                      />
                    </div>

                    <div>
                      <label className="cafe-field-label">
                        {getText(
                          "owner_password_label"
                        )}
                      </label>

                      <input
                        type="text"
                        name="ownerPassword"
                        value={form.ownerPassword}
                        onChange={handleChange}
                        className="cafe-input"
                        placeholder={getText(
                          "owner_password_placeholder"
                        )}
                      />
                    </div>
                  </div>

                  <div className="cafe-field flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cafe-add-btn flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      {submitting
                        ? getText("saving")
                        : getText("save_btn")}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setModalOpen(false);
                        resetForm();
                      }}
                      className="cafe-cancel-btn flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-semibold text-gray-500"
                    >
                      {getText("cancel_btn")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* MODAL - KAFENI TAHRIRLASH */}
        {editModalOpen && (
          <div className="cafe-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="cafe-modal-box bg-white w-full max-w-md max-h-[92vh] flex flex-col rounded-2xl p-5">
              <div className="cafe-modal-header mb-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-800">
                    {getText("modal_edit_title")}
                  </h2>

                  <button
                    type="button"
                    onClick={() =>
                      setEditModalOpen(false)
                    }
                    className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {getText("modal_edit_desc")}
                </p>
              </div>

              <div className="cafe-modal-body overflow-y-auto">
                <form
                  onSubmit={handleUpdateCafe}
                  className="space-y-3.5"
                >
                  <div className="cafe-field">
                    <label className="cafe-field-label">
                      {getText("cafe_name_label")}
                    </label>

                    <input
                      type="text"
                      name="name"
                      value={editForm.name}
                      onChange={handleEditChange}
                      className="cafe-input"
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">
                      {getText("owner_name_label")}
                    </label>

                    <input
                      type="text"
                      name="ownerName"
                      value={editForm.ownerName}
                      onChange={handleEditChange}
                      className="cafe-input"
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">
                      {getText("phone_label")}
                    </label>

                    <input
                      type="text"
                      name="phone"
                      value={editForm.phone}
                      onChange={handleEditChange}
                      className="cafe-input"
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">
                      {getText("address_label")}
                    </label>

                    <input
                      type="text"
                      name="address"
                      value={editForm.address}
                      onChange={handleEditChange}
                      className="cafe-input"
                    />
                  </div>

                  <div className="cafe-field grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="cafe-field-label">
                        {getText(
                          "contract_start_label"
                        )}
                      </label>

                      <input
                        type="date"
                        name="contractStart"
                        value={editForm.contractStart}
                        onChange={handleEditChange}
                        className="cafe-input"
                      />
                    </div>

                    <div>
                      <label className="cafe-field-label">
                        {getText(
                          "contract_end_label"
                        )}
                      </label>

                      <input
                        type="date"
                        name="contractEnd"
                        value={editForm.contractEnd}
                        onChange={handleEditChange}
                        className="cafe-input"
                      />
                    </div>
                  </div>

                  <div className="cafe-field flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cafe-add-btn flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      {submitting
                        ? getText("saving")
                        : getText("update_btn")}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditModalOpen(false)
                      }
                      className="cafe-cancel-btn flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-semibold text-gray-500"
                    >
                      {getText("cancel_btn")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* O'CHIRISH MODALI */}
        {/* ========================================= */}

        {deleteModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => {
              if (!deleting) {
                setDeleteModalOpen(false);
                setDeleteCafe(null);
              }
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "420px",
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                padding: "28px",
                boxShadow:
                  "0 20px 60px rgba(0,0,0,0.25)",
                textAlign: "center",
                animation:
                  "deleteModalShow 0.2s ease-out",
              }}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              {/* ICON */}
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  margin: "0 auto 18px",
                  borderRadius: "50%",
                  backgroundColor: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                }}
              >
                🗑️
              </div>

              {/* TITLE */}
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: "21px",
                  fontWeight: "700",
                  color: "#1f2937",
                }}
              >
                Kafeni o'chirish
              </h2>

              {/* TEXT */}
              <p
                style={{
                  margin: "0 auto",
                  maxWidth: "330px",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  color: "#6b7280",
                }}
              >
                <strong
                  style={{
                    color: "#374151",
                  }}
                >
                  "{deleteCafe?.name}"
                </strong>{" "}
                kafesini o'chirmoqchimisiz?
                <br />
                Bu amalni ortga qaytarib bo'lmaydi.
              </p>

              {/* BUTTONS */}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "24px",
                }}
              >
                {/* YO'Q */}
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setDeleteCafe(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border:
                      "1px solid #e5e7eb",
                    backgroundColor: "#f9fafb",
                    color: "#374151",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: deleting
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  Yo'q
                </button>

                {/* HA */}
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDeleteCafe}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "#dc2626",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: deleting
                      ? "not-allowed"
                      : "pointer",
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting
                    ? "O'chirilmoqda..."
                    : "Ha, o'chirish"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}