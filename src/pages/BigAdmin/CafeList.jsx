import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
} from "firebase/firestore";
import { db } from "../../firebase/config.js";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import "./CafeList.css";


export default function CafeList() {
  const { registerStaff } = useAuth(); // Kafe direktori uchun login-parol hisobini yaratish
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all"); // all, active, blocked

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
      alert(
        `Kafe va direktor hisobi muvaffaqiyatli yaratildi!\n\nDirektor uchun login: ${form.ownerUsername}\nParol: ${form.ownerPassword}\n\nBu ma'lumotlarni direktorga bering.`
      );
    } catch (error) {
      console.error("Kafe qo'shishda xatolik:", error);
      alert(
        "Xatolik yuz berdi. Ehtimol bunday login band, yoki Firebase sozlamasi to'g'ri emas."
      );
    } finally {
      setSubmitting(false);
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

return (
  <>
    <Navbar />
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-amber-800">
          Big Admin — Kafelar
        </h1>
        <button
          onClick={() => setModalOpen(true)}
          className="cafe-add-btn bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700"
        >
          + Kafe qo'shish
        </button>
      </div>

      {/* Statistika kartalari */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="cafe-card bg-white rounded-xl shadow p-3 border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Jami</p>
          <p className="text-xl font-bold text-gray-800">{cafes.length}</p>
        </div>
        <div className="cafe-card bg-white rounded-xl shadow p-3 border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Faol</p>
          <p className="text-xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="cafe-card bg-white rounded-xl shadow p-3 border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Bloklangan</p>
          <p className="text-xl font-bold text-red-600">{blockedCount}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "all", label: "Barchasi" },
          { key: "active", label: "Faol" },
          { key: "blocked", label: "Bloklangan" },
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
        <p className="text-gray-400 text-sm">Kafelar topilmadi</p>
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
                    Egasi: {cafe.ownerName}
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
                  {cafe.status === "active" ? "Faol" : "Bloklangan"}
                </span>
              </div>

              {(cafe.contractStart || cafe.contractEnd) && (
                <div className="mt-2 text-xs text-gray-500">
                  Shartnoma: {cafe.contractStart || "?"} — {cafe.contractEnd || "?"}
                  {isContractExpired(cafe.contractEnd) && (
                    <span className="ml-2 text-red-600 font-medium">
                      Muddati tugagan
                    </span>
                  )}
                  {!isContractExpired(cafe.contractEnd) &&
                    isContractExpiringSoon(cafe.contractEnd) && (
                      <span className="ml-2 text-orange-500 font-medium">
                        Tez orada tugaydi
                      </span>
                    )}
                </div>
              )}

              <div className="mt-3">
                <button
                  onClick={() => toggleCafeStatus(cafe)}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                    cafe.status === "active"
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {cafe.status === "active"
                    ? "Bloklash"
                    : "Ruxsat berish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - yangi kafe qo'shish */}
      {modalOpen && (
        <div className="cafe-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="cafe-modal-box bg-white w-full max-w-md max-h-[92vh] flex flex-col">
            {/* Gradient sarlavha */}
            <div className="cafe-modal-header">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="cafe-modal-close"
                aria-label="Yopish"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16}}>
                  <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <h2>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 3v7M9 9v.01M9 12v.01M9 15v.01" />
                </svg>
                Yangi kafe qo'shish
              </h2>
              <p>Yangi kafe va uning direktor hisobini shu yerda yarating</p>
            </div>

            {/* Forma tanasi (scroll bo'ladi) */}
            <div className="cafe-modal-body overflow-y-auto">
              <form onSubmit={handleAddCafe} className="space-y-3.5">
                <div className="cafe-field" style={{ animationDelay: "0.03s" }}>
                  <label className="cafe-field-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 3v7" />
                    </svg>
                    Kafe nomi
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="cafe-input"
                    placeholder="Masalan: Gusto Cafe"
                  />
                </div>

                <div className="cafe-field" style={{ animationDelay: "0.07s" }}>
                  <label className="cafe-field-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="4" />
                      <path strokeLinecap="round" d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
                    </svg>
                    Egasi (direktor) ismi
                  </label>
                  <input
                    type="text"
                    name="ownerName"
                    value={form.ownerName}
                    onChange={handleChange}
                    className="cafe-input"
                    placeholder="To'liq ism"
                  />
                </div>

                <div className="cafe-field" style={{ animationDelay: "0.11s" }}>
                  <label className="cafe-field-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    Telefon raqami
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

                <div className="cafe-field" style={{ animationDelay: "0.15s" }}>
                  <label className="cafe-field-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    Manzil
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className="cafe-input"
                    placeholder="Shahar, tuman, ko'cha"
                  />
                </div>

                <div className="cafe-field grid grid-cols-2 gap-2.5" style={{ animationDelay: "0.19s" }}>
                  <div>
                    <label className="cafe-field-label">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                      Shartnoma boshi
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
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                      Shartnoma oxiri
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

                {/* Direktor login/parol bo'limi */}
                <div className="cafe-field cafe-director-section" style={{ animationDelay: "0.23s" }}>
                  <span className="cafe-director-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    Direktor kirish ma'lumotlari
                  </span>

                  <div className="mb-3">
                    <label className="cafe-field-label">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="8" r="4" />
                        <path strokeLinecap="round" d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
                      </svg>
                      Direktor logini
                    </label>
                    <input
                      type="text"
                      name="ownerUsername"
                      value={form.ownerUsername}
                      onChange={handleChange}
                      className="cafe-input"
                      placeholder="login kiriting"
                    />
                  </div>

                  <div>
                    <label className="cafe-field-label">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      Direktor paroli
                    </label>
                    <input
                      type="text"
                      name="ownerPassword"
                      value={form.ownerPassword}
                      onChange={handleChange}
                      className="cafe-input"
                      placeholder="Kamida 6 ta belgi"
                    />
                  </div>
                </div>

                <div className="cafe-field flex gap-2 pt-1" style={{ animationDelay: "0.27s" }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="cafe-add-btn flex-1 bg-gradient-to-r from-amber-600 to-orange-500 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    {submitting ? "Saqlanmoqda..." : "Saqlash"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      resetForm();
                    }}
                    className="cafe-cancel-btn flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-semibold text-gray-500"
                  >
                    Bekor qilish
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