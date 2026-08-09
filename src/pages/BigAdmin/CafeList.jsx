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
import Navbar from "../../components/Navbar";
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
    modal_add_desc: "Yangi kafe va uning direktor hisobini shu yerda yarating",
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
    update_btn: "Yangilash"
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
    modal_add_desc: "Создайте новое кафе и аккаунт директора здесь",
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
    update_btn: "Обновить"
  }
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

  // Tilni o'zgartirish va saqlash funksiyasi
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
  };

  const getText = (key) => {
    const currentLang = i18n.language || localStorage.getItem("i18nextLng") || "uz";
    const translated = t(key);
    if (translated && translated !== key) return translated;
    return translations[currentLang]?.[key] || translations["uz"]?.[key] || key;
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "cafes"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setCafes(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
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

      const fullEmail = `${form.ownerUsername.trim().toLowerCase()}@kafe.com`;

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

  const handleDeleteCafe = async (cafeId, cafeName) => {
    if (window.confirm(`"${cafeName}" kafesini o'chirib yubormoqchimisiz?`)) {
      try {
        await deleteDoc(doc(db, "cafes", cafeId));
      } catch (error) {
        console.error("O'chirishda xatolik:", error);
        alert("O'chirishda xatolik yuz berdi.");
      }
    }
  };

  const toggleCafeStatus = async (cafe) => {
    const newStatus = cafe.status === "active" ? "blocked" : "active";
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
      console.error("Statusni yangilashda xatolik:", error);
    }
  };

  const filteredCafes = cafes.filter((cafe) => {
    if (filter === "all") return true;
    return cafe.status === filter;
  });

  const activeCount = cafes.filter((c) => c.status === "active").length;
  const blockedCount = cafes.filter((c) => c.status === "blocked").length;

  const isContractExpiringSoon = (endDate) => {
    if (!endDate) return false;
    const end = new Date(endDate);
    const now = new Date();
    const diffDays = (end - now) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  };

  const isContractExpired = (endDate) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 text-lg">Yuklanmoqda...</p>
        </div>
      </>
    );
  }

  const currentLang = i18n.language || localStorage.getItem("i18nextLng") || "uz";

  return (
    <>
      <Navbar />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-amber-800">
            {getText("big_admin_cafes")}
          </h1>
          
          <div className="flex items-center gap-3">
            {/* Tilni almashtiruvchi ishlaydigan UZ / RU tugmalari */}
            <div className="flex gap-1 bg-gray-200 p-1 rounded-lg">
              <button
                onClick={() => changeLanguage("uz")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                  currentLang === "uz" ? "bg-amber-600 text-white shadow" : "text-gray-700"
                }`}
              >
                UZ
              </button>
              <button
                onClick={() => changeLanguage("ru")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                  currentLang === "ru" ? "bg-amber-600 text-white shadow" : "text-gray-700"
                }`}
              >
                RU
              </button>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="cafe-add-btn bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              + {getText("add_cafe_btn")}
            </button>
          </div>
        </div>

        {/* Statistika kartalari */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="cafe-card bg-white rounded-xl shadow p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-500">{getText("total")}</p>
            <p className="text-xl font-bold text-gray-800">{cafes.length}</p>
          </div>
          <div className="cafe-card bg-white rounded-xl shadow p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-500">{getText("active")}</p>
            <p className="text-xl font-bold text-green-600">{activeCount}</p>
          </div>
          <div className="cafe-card bg-white rounded-xl shadow p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-500">{getText("blocked")}</p>
            <p className="text-xl font-bold text-red-600">{blockedCount}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "all", label: getText("filter_all") },
            { key: "active", label: getText("filter_active") },
            { key: "blocked", label: getText("filter_blocked") },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f.key
                  ? "bg-amber-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Kafelar ro'yxati */}
        {filteredCafes.length === 0 ? (
          <p className="text-gray-400 text-sm">{getText("no_cafes_found")}</p>
        ) : (
          <div className="space-y-3">
            {filteredCafes.map((cafe) => (
              <div
                key={cafe.id}
                className="cafe-card bg-white rounded-xl shadow border border-gray-100 p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">{cafe.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {getText("owner_label")}: {cafe.ownerName}
                    </p>
                    <p className="text-xs text-gray-500">{cafe.phone}</p>
                    {cafe.address && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {cafe.address}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                      cafe.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {cafe.status === "active" ? getText("active") : getText("blocked")}
                  </span>
                </div>

                {(cafe.contractStart || cafe.contractEnd) && (
                  <div className="mt-2 text-xs text-gray-500">
                    {getText("contract_label")}: {cafe.contractStart || "?"} — {cafe.contractEnd || "?"}
                    {isContractExpired(cafe.contractEnd) && (
                      <span className="ml-2 text-red-600 font-medium">
                        {getText("contract_expired")}
                      </span>
                    )}
                    {!isContractExpired(cafe.contractEnd) &&
                      isContractExpiringSoon(cafe.contractEnd) && (
                        <span className="ml-2 text-orange-500 font-medium">
                          {getText("contract_expiring_soon")}
                        </span>
                      )}
                  </div>
                )}

                {/* Tugmalar guruhi */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => toggleCafeStatus(cafe)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                      cafe.status === "active"
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    {cafe.status === "active" ? getText("block_btn") : getText("unblock_btn")}
                  </button>

                  <button
                    onClick={() => openEditModal(cafe)}
                    className="text-xs px-3 py-1.5 rounded-md font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                  >
                    {getText("edit_btn")}
                  </button>

                  <button
                    onClick={() => handleDeleteCafe(cafe.id, cafe.name)}
                    className="text-xs px-3 py-1.5 rounded-md font-medium bg-gray-100 text-gray-700 hover:bg-red-600 hover:text-white transition"
                  >
                    {getText("delete_btn")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal - Yangi kafe qo'shish */}
        {modalOpen && (
          <div className="cafe-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="cafe-modal-box bg-white w-full max-w-md max-h-[92vh] flex flex-col">
              <div className="cafe-modal-header">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="cafe-modal-close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16}}>
                    <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                <h2>{getText("modal_add_title")}</h2>
                <p>{getText("modal_add_desc")}</p>
              </div>

              <div className="cafe-modal-body overflow-y-auto">
                <form onSubmit={handleAddCafe} className="space-y-3.5">
                  <div className="cafe-field">
                    <label className="cafe-field-label">{getText("cafe_name_label")}</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="cafe-input"
                      placeholder={getText("cafe_name_placeholder")}
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">{getText("owner_name_label")}</label>
                    <input
                      type="text"
                      name="ownerName"
                      value={form.ownerName}
                      onChange={handleChange}
                      className="cafe-input"
                      placeholder={getText("owner_name_placeholder")}
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">{getText("phone_label")}</label>
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
                    <label className="cafe-field-label">{getText("address_label")}</label>
                    <input
                      type="text"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      className="cafe-input"
                      placeholder={getText("address_placeholder")}
                    />
                  </div>

                  <div className="cafe-field grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="cafe-field-label">{getText("contract_start_label")}</label>
                      <input
                        type="date"
                        name="contractStart"
                        value={form.contractStart}
                        onChange={handleChange}
                        className="cafe-input"
                      />
                    </div>
                    <div>
                      <label className="cafe-field-label">{getText("contract_end_label")}</label>
                      <input
                        type="date"
                        name="contractEnd"
                        value={form.contractEnd}
                        onChange={handleChange}
                        className="cafe-input"
                      />
                    </div>
                  </div>

                  <div className="cafe-field cafe-director-section">
                    <span className="cafe-director-badge">{getText("director_section_badge")}</span>
                    <div className="mb-3">
                      <label className="cafe-field-label">{getText("owner_username_label")}</label>
                      <input
                        type="text"
                        name="ownerUsername"
                        value={form.ownerUsername}
                        onChange={handleChange}
                        className="cafe-input"
                        placeholder={getText("owner_username_placeholder")}
                      />
                    </div>
                    <div>
                      <label className="cafe-field-label">{getText("owner_password_label")}</label>
                      <input
                        type="text"
                        name="ownerPassword"
                        value={form.ownerPassword}
                        onChange={handleChange}
                        className="cafe-input"
                        placeholder={getText("owner_password_placeholder")}
                      />
                    </div>
                  </div>

                  <div className="cafe-field flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cafe-add-btn flex-1 bg-gradient-to-r from-amber-600 to-orange-500 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      {submitting ? getText("saving") : getText("save_btn")}
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

        {/* Modal - Kafeni tahrirlash */}
        {editModalOpen && (
          <div className="cafe-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="cafe-modal-box bg-white w-full max-w-md max-h-[92vh] flex flex-col">
              <div className="cafe-modal-header">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="cafe-modal-close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16}}>
                    <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                <h2>{getText("modal_edit_title")}</h2>
                <p>{getText("modal_edit_desc")}</p>
              </div>

              <div className="cafe-modal-body overflow-y-auto">
                <form onSubmit={handleUpdateCafe} className="space-y-3.5">
                  <div className="cafe-field">
                    <label className="cafe-field-label">{getText("cafe_name_label")}</label>
                    <input
                      type="text"
                      name="name"
                      value={editForm.name}
                      onChange={handleEditChange}
                      className="cafe-input"
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">{getText("owner_name_label")}</label>
                    <input
                      type="text"
                      name="ownerName"
                      value={editForm.ownerName}
                      onChange={handleEditChange}
                      className="cafe-input"
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">{getText("phone_label")}</label>
                    <input
                      type="text"
                      name="phone"
                      value={editForm.phone}
                      onChange={handleEditChange}
                      className="cafe-input"
                    />
                  </div>

                  <div className="cafe-field">
                    <label className="cafe-field-label">{getText("address_label")}</label>
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
                      <label className="cafe-field-label">{getText("contract_start_label")}</label>
                      <input
                        type="date"
                        name="contractStart"
                        value={editForm.contractStart}
                        onChange={handleEditChange}
                        className="cafe-input"
                      />
                    </div>
                    <div>
                      <label className="cafe-field-label">{getText("contract_end_label")}</label>
                      <input
                        type="date"
                        name="contractEnd"
                        value={editForm.contractEnd}
                        onChange={handleEditChange}
                        className="cafe-input"
                      />
                    </div>
                  </div>

                  <div className="cafe-field flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cafe-add-btn flex-1 bg-gradient-to-r from-amber-600 to-orange-500 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      {submitting ? getText("saving") : getText("update_btn")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
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
      </div>
    </>
  );
}