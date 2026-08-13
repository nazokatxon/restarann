import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";

export default function StaffList() {
  const { cafeId, registerStaff, logout } = useAuth();
  const navigate = useNavigate();

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [activeTab, setActiveTab] = useState("staff");

  // =========================================================
  // OYLIK MODAL
  // =========================================================

  const [salaryModalPerson, setSalaryModalPerson] = useState(null);

  const [salaryForm, setSalaryForm] = useState({
    shifts: "15",
    dailyRate: "0",
    totalSales: "0",
    commissionPercent: "3",
    advance: "0",
    fine: "0",
  });

  // =========================================================
  // XODIM FORMASI
  // =========================================================

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "waiter",
    phone: "",
    salary: "",
    status: "active",
  });

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    if (!window.confirm("Tizimdan chiqmoqchimisiz?")) return;

    try {
      if (logout) {
        await logout();
      }

      navigate("/login");
    } catch (error) {
      console.error("Chiqishda xatolik:", error);
    }
  };

  // =========================================================
  // XODIMLARNI FIREBASE'DAN OLISH
  // =========================================================

  useEffect(() => {
    if (!cafeId) {
      setStaff([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users"),
      where("cafeId", "==", cafeId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setStaff(data.filter((u) => u.role !== "bigadmin"));
        setLoading(false);
      },
      (error) => {
        console.error("Xodimlarni yuklashda xatolik:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [cafeId]);

  // =========================================================
  // ROLE NOMLARI
  // =========================================================

  const roleLabels = {
    waiter: "Ofitsiant",
    chef: "Oshpaz",
    cashier: "Kassir",
    admin: "Direktor",
  };

  // =========================================================
  // FORM RESET
  // =========================================================

  const resetForm = () => {
    setForm({
      fullName: "",
      username: "",
      password: "",
      role: "waiter",
      phone: "",
      salary: "",
      status: "active",
    });

    setEditingStaff(null);
  };

  // =========================================================
  // XODIM QO'SHISH
  // =========================================================

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  // =========================================================
  // XODIMNI TAHRIRLASH
  // =========================================================

  const openEditModal = (person) => {
    const currentUsername = person.email
      ? person.email.split("@")[0]
      : "";

    setForm({
      fullName: person.fullName || "",
      username: currentUsername,
      password: person.password || "",
      role: person.role || "waiter",
      phone: person.phone || "",
      salary: person.salary || "",
      status: person.status || "active",
    });

    setEditingStaff(person);
    setModalOpen(true);
  };

  // =========================================================
  // INPUT CHANGE
  // =========================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================================================
  // XODIMNI SAQLASH
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.fullName ||
      !form.phone ||
      !form.username ||
      !form.password
    ) {
      alert(
        "Iltimos, barcha majburiy maydonlarni kiriting."
      );
      return;
    }

    const fullEmail = `${form.username
      .trim()
      .toLowerCase()}@kafe.uz`;

    const extraData = {
      cafeId,
      fullName: form.fullName.trim(),
      role: form.role,
      phone: form.phone.trim(),
      salary: Number(form.salary) || 0,
      status: form.status,
      password: form.password,
    };

    try {
      if (editingStaff) {
        await updateDoc(
          doc(db, "users", editingStaff.id),
          {
            ...extraData,
            email: fullEmail,
          }
        );

        alert(
          "Xodim ma'lumotlari muvaffaqiyatli yangilandi!"
        );
      } else {
        await registerStaff(
          fullEmail,
          form.password,
          extraData
        );

        alert(
          "Yangi xodim muvaffaqiyatli qo'shildi!"
        );
      }

      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error(
        "Xodimni saqlashda xatolik:",
        error
      );

      alert(
        "Xatolik yuz berdi! Ehtimol, bunday login allaqachon mavjud."
      );
    }
  };

  // =========================================================
  // XODIMNI O'CHIRISH
  // =========================================================

  const handleDelete = async (staffId) => {
    if (
      !window.confirm(
        "Bu xodimni o'chirishga ishonchingiz komilmi?"
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", staffId));
    } catch (error) {
      console.error(
        "Xodimni o'chirishda xatolik:",
        error
      );
    }
  };

  // =========================================================
  // STATUS O'ZGARTIRISH
  // =========================================================

  const toggleStatus = async (person) => {
    try {
      await updateDoc(
        doc(db, "users", person.id),
        {
          status:
            person.status === "active"
              ? "inactive"
              : "active",
        }
      );
    } catch (error) {
      console.error(
        "Holatni yangilashda xatolik:",
        error
      );
    }
  };

  // =========================================================
  // OYLIK MODALNI OCHISH
  // =========================================================

  const openSalaryModal = (person) => {
    setSalaryModalPerson(person);

    setSalaryForm({
      shifts: "15",
      dailyRate: String(person.salary || 0),

      // MUHIM:
      // Buni foydalanuvchi yozmaydi.
      // Firebase'dan avtomatik keladi.
      totalSales: "0",

      commissionPercent: "3",
      advance: "0",
      fine: "0",
    });
  };

  // =========================================================
  // OYLIK MODALNI YOPISH
  // =========================================================

  const closeSalaryModal = () => {
    setSalaryModalPerson(null);

    setSalaryForm({
      shifts: "15",
      dailyRate: "0",
      totalSales: "0",
      commissionPercent: "3",
      advance: "0",
      fine: "0",
    });
  };

  // =========================================================
  // SALARY FORM CHANGE
  // =========================================================

  const updateSalaryForm = (name, value) => {
    setSalaryForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================================================
  // 🔥 JAMI SOTUVNI AVTOMATIK HISOBLASH
  // =========================================================
  //
  // Firebase:
  //
  // orders
  //   waiterId
  //   cafeId
  //   paymentStatus
  //   totalPrice
  //   createdAt
  //
  // Faqat:
  //   - shu cafe
  //   - shu ofitsiant
  //   - paid
  //   - joriy oy
  //
  // hisoblanadi.
  // =========================================================

  useEffect(() => {
    if (!salaryModalPerson || !cafeId) {
      return;
    }

    const ordersQuery = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        let totalSales = 0;

        // Joriy oy boshi
        const now = new Date();

        const startOfMonth = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
          0,
          0,
          0,
          0
        );

        // Keyingi oy boshi
        const startOfNextMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          1,
          0,
          0,
          0,
          0
        );

        snapshot.docs.forEach((orderDoc) => {
          const order = orderDoc.data();

          // Faqat shu ofitsiantning buyurtmasi
          if (
            order.waiterId !== salaryModalPerson.id
          ) {
            return;
          }

          // Faqat to'langan buyurtma
          if (order.paymentStatus !== "paid") {
            return;
          }

          // ---------------------------------------------
          // Sana tekshirish
          // ---------------------------------------------

          let orderDate = null;

          if (order.createdAt?.toDate) {
            orderDate = order.createdAt.toDate();
          } else if (order.createdAt) {
            orderDate = new Date(order.createdAt);
          }

          // Agar createdAt mavjud bo'lmasa,
          // xavfsiz ravishda hisoblamaymiz.
          if (!orderDate || isNaN(orderDate.getTime())) {
            return;
          }

          // Faqat joriy oy
          if (
            orderDate < startOfMonth ||
            orderDate >= startOfNextMonth
          ) {
            return;
          }

          totalSales += Number(order.totalPrice || 0);
        });

        // Avtomatik qiymat
        setSalaryForm((prev) => ({
          ...prev,
          totalSales: String(totalSales),
        }));
      },
      (error) => {
        console.error(
          "Jami sotuvni avtomatik hisoblashda xatolik:",
          error
        );

        setSalaryForm((prev) => ({
          ...prev,
          totalSales: "0",
        }));
      }
    );

    return () => unsubscribe();
  }, [salaryModalPerson, cafeId]);

  // =========================================================
  // OYLIK HISOB-KITOB
  // =========================================================

  const shiftPay =
    Number(salaryForm.shifts || 0) *
    Number(salaryForm.dailyRate || 0);

  const commission =
    Number(salaryForm.totalSales || 0) *
    (Number(
      salaryForm.commissionPercent || 0
    ) / 100);

  const deductions =
    Number(salaryForm.advance || 0) +
    Number(salaryForm.fine || 0);

  const cashToReceive = Math.max(
    0,
    shiftPay + commission - deductions
  );

  // =========================================================
  // OYLIKNI SAQLASH
  // =========================================================

  const saveSalaryPayment = async () => {
    if (!salaryModalPerson) return;

    try {
      const history =
        salaryModalPerson.salaryHistory || [];

      const payment = {
        amount: cashToReceive,
        date: new Date().toISOString(),

        shifts: Number(
          salaryForm.shifts || 0
        ),

        dailyRate: Number(
          salaryForm.dailyRate || 0
        ),

        totalSales: Number(
          salaryForm.totalSales || 0
        ),

        commissionPercent: Number(
          salaryForm.commissionPercent || 0
        ),

        commission,

        advance: Number(
          salaryForm.advance || 0
        ),

        fine: Number(
          salaryForm.fine || 0
        ),
      };

      await updateDoc(
        doc(db, "users", salaryModalPerson.id),
        {
          salaryHistory: [
            ...history,
            payment,
          ],
        }
      );

      setStaff((prev) =>
        prev.map((person) =>
          person.id === salaryModalPerson.id
            ? {
                ...person,
                salaryHistory: [
                  ...history,
                  payment,
                ],
              }
            : person
        )
      );

      alert(
        `${salaryModalPerson.fullName} uchun oylik to'lovi saqlandi!`
      );

      closeSalaryModal();
    } catch (error) {
      console.error(
        "Oylik to'lovini saqlashda xatolik:",
        error
      );

      alert(
        "Oylik to'lovini saqlashda xatolik yuz berdi!"
      );
    }
  };

  // =========================================================
  // JAMI OYLIK
  // =========================================================

  const totalSalaries = staff.reduce(
    (sum, person) =>
      sum + (Number(person.salary) || 0),
    0
  );

  // =========================================================
  // INPUT STYLE
  // =========================================================

  const inputClass =
    "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder:text-gray-400 shadow-sm transition-all duration-150 focus:outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15";

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <span className="text-amber-600 text-xl animate-spin">
          ⏳
        </span>

        <p className="text-gray-500 text-sm font-medium">
          Xodimlar ro'yxati yuklanmoqda...
        </p>
      </div>
    );
  }

  // =========================================================
  // MAIN
  // =========================================================

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-gray-800 w-full flex flex-col font-sans pb-24">

      <main className="p-4 sm:p-6 max-w-4xl w-full mx-auto flex-1">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 border-b-2 border-[#D4AF37] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              👥
            </span>

            <h1 className="text-xl font-bold text-[#8B4513]">
              Xodimlar boshqaruvi
            </h1>
          </div>

          <button
            onClick={openAddModal}
            className="bg-[#B22222] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#8B0000] active:scale-95 transition-all shadow-md shadow-red-900/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span>➕</span>
            <span>Xodim qo'shish</span>
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6">

          <button
            onClick={() =>
              setActiveTab("staff")
            }
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "staff"
                ? "bg-[#8B4513] text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span>👥</span>
            <span>Xodimlar ro'yxati</span>
          </button>

          <button
            onClick={() =>
              setActiveTab("salary")
            }
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "salary"
                ? "bg-[#8B4513] text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span>👛</span>
            <span>Oyliklar</span>
          </button>

        </div>

        {/* =====================================================
            STAFF TAB
        ====================================================== */}

        {activeTab === "staff" && (
          <>
            {staff.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-xl border border-dashed">
                <p className="text-gray-400 text-sm">
                  Hozircha xodimlar mavjud emas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {staff.map((person) => (
                  <div
                    key={person.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col justify-between transition-all hover:shadow-md"
                  >

                    <div>

                      <div className="flex justify-between items-start gap-2">

                        <div>
                          <h3 className="font-bold text-gray-800 text-sm">
                            {person.fullName}
                          </h3>

                          <p className="text-[11px] text-amber-800 font-medium capitalize mt-0.5 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md inline-block">
                            {roleLabels[person.role] ||
                              person.role}
                          </p>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            person.status === "active"
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {person.status === "active"
                            ? "Faol"
                            : "Nofaol"}
                        </span>

                      </div>

                      <div className="space-y-1 mt-3 border-t pt-2 border-gray-50 text-xs text-gray-500">

                        <p className="flex items-center gap-1.5">
                          <span>✉️</span>
                          {person.email}
                        </p>

                        <p className="flex items-center gap-1.5">
                          <span>📞</span>
                          {person.phone}
                        </p>

                        <p className="text-[#B22222] font-extrabold text-sm pt-1">
                          {Number(
                            person.salary || 0
                          ).toLocaleString()}{" "}
                          so'm / oy
                        </p>

                      </div>

                    </div>

                    <div className="flex gap-1.5 mt-4 pt-2 border-t border-gray-50">

                      <button
                        onClick={() =>
                          openEditModal(person)
                        }
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-gray-600 transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>✏️</span>
                        <span>Tahrirlash</span>
                      </button>

                      <button
                        onClick={() =>
                          toggleStatus(person)
                        }
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition flex items-center gap-1 cursor-pointer ${
                          person.status === "active"
                            ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                            : "border-green-200 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        <span>
                          {person.status === "active"
                            ? "🚫"
                            : "✅"}
                        </span>

                        <span>
                          {person.status === "active"
                            ? "Bloklash"
                            : "Aktivlashtirish"}
                        </span>
                      </button>

                      <button
                        onClick={() =>
                          handleDelete(person.id)
                        }
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 font-medium transition ml-auto flex items-center gap-1 cursor-pointer"
                      >
                        <span>🗑️</span>
                        <span>O'chirish</span>
                      </button>

                    </div>

                  </div>
                ))}

              </div>
            )}
          </>
        )}

        {/* =====================================================
            SALARY TAB
        ====================================================== */}

        {activeTab === "salary" && (
          <div className="space-y-4">

            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center gap-3">

              <div className="p-3 bg-green-50 text-green-600 rounded-xl text-xl">
                💵
              </div>

              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                  Jami oylik xarajati
                </p>

                <p className="text-xl font-black text-green-600 mt-0.5">
                  {totalSalaries.toLocaleString()} so'm
                </p>
              </div>

            </div>

            <div className="space-y-2.5">

              {staff.map((person) => (

                <div
                  key={person.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >

                  <div>

                    <p className="font-bold text-gray-800 text-sm">
                      {person.fullName}
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      {roleLabels[person.role] ||
                        person.role}{" "}
                      •{" "}
                      <span className="font-semibold text-gray-700">
                        {Number(
                          person.salary || 0
                        ).toLocaleString()}{" "}
                        so'm
                      </span>
                    </p>

                    <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">

                      <span>✅</span>

                      Oxirgi to'lov:

                      <span className="font-medium text-gray-600">
                        {person.salaryHistory?.length >
                        0
                          ? new Date(
                              person
                                .salaryHistory[
                                person
                                  .salaryHistory
                                  .length - 1
                              ].date
                            ).toLocaleDateString()
                          : "To'lanmagan"}
                      </span>

                    </p>

                  </div>

                  <button
                    onClick={() =>
                      openSalaryModal(person)
                    }
                    className="text-xs px-3 py-2 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    Oylik hisoblash
                  </button>

                </div>

              ))}

            </div>
          </div>
        )}

      </main>

      {/* =====================================================
          OYLIK HISOBLASH MODALI
      ====================================================== */}

      {salaryModalPerson && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-5 max-h-[95vh] overflow-y-auto">

            <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-4">

              <div>

                <h2 className="text-lg font-bold text-gray-800">
                  🧮 {salaryModalPerson.fullName} — Oylik Hisobi
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  {roleLabels[
                    salaryModalPerson.role
                  ] ||
                    salaryModalPerson.role}
                </p>

              </div>

              <button
                type="button"
                onClick={closeSalaryModal}
                className="text-gray-400 hover:text-gray-600 text-2xl cursor-pointer"
              >
                ×
              </button>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* SMENA */}

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  📅 Smenalar (kun)
                </label>

                <input
                  type="number"
                  min="0"
                  value={salaryForm.shifts}
                  onChange={(e) =>
                    updateSalaryForm(
                      "shifts",
                      e.target.value
                    )
                  }
                  className={inputClass}
                />
              </div>

              {/* KUNLIK FIKSA */}

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  💰 Kunlik Fiksa (so'm)
                </label>

                <input
                  type="number"
                  min="0"
                  value={salaryForm.dailyRate}
                  onChange={(e) =>
                    updateSalaryForm(
                      "dailyRate",
                      e.target.value
                    )
                  }
                  className={inputClass}
                />
              </div>

              {/* =================================================
                  🔥 JAMI SOTUV
                  ENDILIKDA QO'LDA YOZILMAYDI
              ================================================== */}

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  💲 Jami Sotuv (so'm)
                </label>

                <div className="relative">

                  <input
                    type="number"
                    value={salaryForm.totalSales}
                    readOnly
                    className={`${inputClass} bg-gray-100 cursor-not-allowed font-bold text-green-700 pr-10`}
                  />

                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                    🔄
                  </span>

                </div>

                <p className="text-[10px] text-gray-400 mt-1">
                  Firebase'dagi to'langan buyurtmalardan avtomatik hisoblanadi.
                </p>
              </div>

              {/* FOIZ */}

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  % Sotuv Foizi (%)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    salaryForm.commissionPercent
                  }
                  onChange={(e) =>
                    updateSalaryForm(
                      "commissionPercent",
                      e.target.value
                    )
                  }
                  className={inputClass}
                />
              </div>

              {/* AVANS */}

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  💵 Berilgan Avans (so'm)
                </label>

                <input
                  type="number"
                  min="0"
                  value={salaryForm.advance}
                  onChange={(e) =>
                    updateSalaryForm(
                      "advance",
                      e.target.value
                    )
                  }
                  className={inputClass}
                />
              </div>

              {/* JARIMA */}

              <div>
                <label className="text-xs font-bold text-red-600 block mb-1">
                  ⚠️ Jarima / Idish (so'm)
                </label>

                <input
                  type="number"
                  min="0"
                  value={salaryForm.fine}
                  onChange={(e) =>
                    updateSalaryForm(
                      "fine",
                      e.target.value
                    )
                  }
                  className={inputClass}
                />
              </div>

            </div>

            {/* =================================================
                HISOB-KITOB
            ================================================== */}

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">

              <div className="flex justify-between text-sm">

                <span>
                  Smena maoshi (
                  {salaryForm.shifts || 0} kun ×{" "}
                  {Number(
                    salaryForm.dailyRate || 0
                  ).toLocaleString()}{" "}
                  so'm):
                </span>

                <strong>
                  {shiftPay.toLocaleString()} so'm
                </strong>

              </div>

              <div className="flex justify-between text-sm">

                <span>
                  Jami sotuv:
                </span>

                <strong className="text-green-600">
                  {Number(
                    salaryForm.totalSales || 0
                  ).toLocaleString()} so'm
                </strong>

              </div>

              <div className="flex justify-between text-sm">

                <span>
                  Sotuvdan foiz (
                  {salaryForm.commissionPercent ||
                    0}
                  %):
                </span>

                <strong>
                  {commission.toLocaleString()} so'm
                </strong>

              </div>

              <div className="flex justify-between text-sm text-red-500">

                <span>
                  Jami ushlanmalar:
                </span>

                <strong>
                  -{" "}
                  {deductions.toLocaleString()} so'm
                </strong>

              </div>

              <div className="border-t border-amber-200 pt-2 flex justify-between text-base font-extrabold text-green-700">

                <span>
                  Qo'lga tegadigan:
                </span>

                <span>
                  {cashToReceive.toLocaleString()} so'm
                </span>

              </div>

            </div>

            {/* BUTTONS */}

            <div className="flex gap-2 mt-5">

              <button
                type="button"
                onClick={saveSalaryPayment}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-green-700 transition cursor-pointer"
              >
                To'landi deb saqlash
              </button>

              <button
                type="button"
                onClick={closeSalaryModal}
                className="flex-1 border border-gray-200 text-gray-500 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition cursor-pointer"
              >
                Bekor qilish
              </button>

            </div>

          </div>
        </div>
      )}

      {/* =====================================================
          XODIM QO'SHISH / TAHRIRLASH MODALI
      ====================================================== */}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 w-full max-w-md p-5 max-h-[95vh] overflow-y-auto border border-gray-100">

            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">

              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">

                {editingStaff ? (
                  <>
                    <span>✏️</span>
                    Xodim ma'lumotlarini tahrirlash
                  </>
                ) : (
                  <>
                    <span>➕</span>
                    Yangi xodim biriktirish
                  </>
                )}

              </h2>

              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition cursor-pointer"
              >
                ✖
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-3.5"
            >

              {/* ISM */}

              <div>

                <label className="text-xs font-bold text-gray-600 block mb-1">
                  To'liq ism
                </label>

                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Ism va familiya"
                />

              </div>

              {/* LOGIN */}

              <div>

                <label className="text-xs font-bold text-gray-600 flex items-center gap-1 mb-1">
                  <span>✉️</span>
                  Xodim logini
                </label>

                <input
                  type="text"
                  name="username"
                  disabled={!!editingStaff}
                  value={form.username}
                  onChange={handleChange}
                  className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500 disabled:shadow-none`}
                  placeholder="login kiriting"
                />

              </div>

              {/* PAROL */}

              <div>

                <label className="text-xs font-bold text-gray-600 flex items-center gap-1 mb-1">
                  <span>🔑</span>
                  Kirish paroli
                </label>

                <input
                  type="text"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Kamida 6 ta belgi"
                />

              </div>

              {/* ROLE + PHONE */}

              <div className="grid grid-cols-2 gap-2">

                <div>

                  <label className="text-xs font-bold text-gray-600 flex items-center gap-1 mb-1">
                    <span>💼</span>
                    Lavozimi
                  </label>

                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="waiter">
                      Ofitsiant
                    </option>

                    <option value="chef">
                      Oshpaz
                    </option>

                    <option value="cashier">
                      Kassir
                    </option>

                    <option value="admin">
                      Direktor (Admin)
                    </option>
                  </select>

                </div>

                <div>

                  <label className="text-xs font-bold text-gray-600 block mb-1">
                    Telefon
                  </label>

                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="+998901234567"
                  />

                </div>

              </div>

              {/* OYLIK */}

              <div>

                <label className="text-xs font-bold text-gray-600 block mb-1">
                  Oylik maoshi (so'm)
                </label>

                <input
                  type="number"
                  name="salary"
                  value={form.salary}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Har oylik belgilangan maosh"
                />

              </div>

              {/* BUTTONS */}

              <div className="flex gap-2 pt-3 border-t border-gray-100">

                <button
                  type="submit"
                  className="flex-1 bg-[#B22222] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-[#8B0000] active:scale-95 transition-all shadow-md shadow-red-900/20 cursor-pointer"
                >
                  Saqlash
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 border border-gray-200 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 text-gray-500 transition active:scale-95 cursor-pointer"
                >
                  Bekor qilish
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}