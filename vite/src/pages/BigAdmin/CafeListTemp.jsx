import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
} from "firebase/firestore";
import { db } from "../../Firebase/config.js";
import Navbar from "../../components/Navbar.jsx";

export default function CafeList() {
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    phone: "",
    address: "",
    contractStart: "",
    contractEnd: "",
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
    });
  };

  const handleAddCafe = async (e) => {
    e.preventDefault();

    if (!form.name || !form.ownerName || !form.phone) {
      alert("Iltimos, barcha majburiy maydonlarni to'ldiring");
      return;
    }

    try {
      await addDoc(collection(db, "cafes"), {
        name: form.name,
        ownerName: form.ownerName,
        phone: form.phone,
        address: form.address,
        contractStart: form.contractStart,
        contractEnd: form.contractEnd,
        status: "active",
        createdAt: new Date(),
      });

      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Kafe qo'shishda xatolik:", error);
      alert("Xatolik yuz berdi, qaytadan urinib ko'ring");
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
      console.error("Statusni yangilashda xatolik:", error);
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
      <>
        <Navbar />

        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 text-lg">
            Yuklanmoqda...
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Sarlavha */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-amber-800">
            Big Admin — Kafelar
          </h1>

          <button
            onClick={() => setModalOpen(true)}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition"
          >
            + Kafe qo'shish
          </button>
        </div>

        {/* Statistika kartalari */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              Jami
            </p>

            <p className="text-xl font-bold text-gray-800">
              {cafes.length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              Faol
            </p>

            <p className="text-xl font-bold text-green-600">
              {activeCount}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              Bloklangan
            </p>

            <p className="text-xl font-bold text-red-600">
              {blockedCount}
            </p>
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
          <p className="text-gray-400 text-sm">
            Kafelar topilmadi
          </p>
        ) : (
          <div className="space-y-3">
            {filteredCafes.map((cafe) => (
              <div
                key={cafe.id}
                className="bg-white rounded-xl shadow border border-gray-100 p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {cafe.name}
                    </h3>

                    <p className="text-xs text-gray-500 mt-0.5">
                      Egasi: {cafe.ownerName}
                    </p>

                    <p className="text-xs text-gray-500">
                      {cafe.phone}
                    </p>

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
                    {cafe.status === "active"
                      ? "Faol"
                      : "Bloklangan"}
                  </span>
                </div>

                {(cafe.contractStart || cafe.contractEnd) && (
                  <div className="mt-2 text-xs text-gray-500">
                    <div>
                      Shartnoma:{" "}
                      {cafe.contractStart || "?"} —{" "}
                      {cafe.contractEnd || "?"}
                    </div>

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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4 text-gray-800">
                Yangi kafe qo'shish
              </h2>

              <form
                onSubmit={handleAddCafe}
                className="space-y-3"
              >
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Kafe nomi
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Masalan: Dasturxon Chinor"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Egasi (direktor) ismi
                  </label>

                  <input
                    type="text"
                    name="ownerName"
                    value={form.ownerName}
                    onChange={handleChange}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="To'liq ism"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Telefon raqami
                  </label>

                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="+998 90 123 45 67"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Manzil
                  </label>

                  <input
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Shahar, tuman, ko'cha"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Shartnoma boshi
                    </label>

                    <input
                      type="date"
                      name="contractStart"
                      value={form.contractStart}
                      onChange={handleChange}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Shartnoma oxiri
                    </label>

                    <input
                      type="date"
                      name="contractEnd"
                      value={form.contractEnd}
                      onChange={handleChange}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition"
                  >
                    Saqlash
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      resetForm();
                    }}
                    className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
                  >
                    Bekor qilish
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}