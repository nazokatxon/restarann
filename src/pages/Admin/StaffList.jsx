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

// =========================================================
// ROLE NOMLARI
// =========================================================

const roleLabels = {
  waiter: "Ofitsiant",
  salatchi: "🥗 Salatchi",
  somsachi: "🥟 Somsachi",
  shashlikchi: "🍢 Shashlikchi",
  pishiriqchi: "🍰 Pishiriqchi",
  ichimlikchi: "🥤 Ichimlikchi",
  cashier: "Kassir",
  admin: "Direktor",
};

// =========================================================
// COMPONENT
// =========================================================

export default function StaffList() {
  const { cafeId, registerStaff, logout } = useAuth();
  const navigate = useNavigate();

  // =========================================================
  // STATE'LAR
  // =========================================================

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [activeTab, setActiveTab] = useState("staff");

  const [salaryModalPerson, setSalaryModalPerson] = useState(null);

  const [salaryForm, setSalaryForm] = useState({
    shifts: "15",
    dailyRate: "0",
    totalSales: "0",
    commissionPercent: "3",
    advance: "0",
    fine: "0",
  });

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
    if (!window.confirm("Tizimdan chiqmoqchimisiz?")) {
      return;
    }

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
  // FIREBASE'DAN XODIMLARNI OLISH
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
        console.error(
          "Xodimlarni yuklashda xatolik:",
          error
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [cafeId]);

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
  // FORM CHANGE
  // =========================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================================================
  // XODIM SAQLASH
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.fullName.trim() ||
      !form.phone.trim() ||
      !form.username.trim() ||
      !form.password.trim()
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
  // STATUS
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
  // SALARY MODAL
  // =========================================================

  const openSalaryModal = (person) => {
    setSalaryModalPerson(person);

    setSalaryForm({
      shifts: "15",
      dailyRate: String(person.salary || 0),
      totalSales: "0",
      commissionPercent: "3",
      advance: "0",
      fine: "0",
    });
  };

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

  const updateSalaryForm = (name, value) => {
    setSalaryForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================================================
  // AUTOMATIC SALES CALCULATION
  // =========================================================

  useEffect(() => {
    if (
      !salaryModalPerson ||
      !cafeId ||
      salaryModalPerson.role !== "waiter"
    ) {
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

          if (
            order.waiterId !==
            salaryModalPerson.id
          ) {
            return;
          }

          if (order.paymentStatus !== "paid") {
            return;
          }

          let orderDate = null;

          if (order.createdAt?.toDate) {
            orderDate =
              order.createdAt.toDate();
          } else if (order.createdAt) {
            orderDate = new Date(
              order.createdAt
            );
          }

          if (
            !orderDate ||
            isNaN(orderDate.getTime())
          ) {
            return;
          }

          if (
            orderDate >= startOfMonth &&
            orderDate < startOfNextMonth
          ) {
            totalSales += Number(
              order.totalPrice || 0
            );
          }
        });

        setSalaryForm((prev) => ({
          ...prev,
          totalSales: String(totalSales),
        }));
      },
      (error) => {
        console.error(
          "Jami sotuvni hisoblashda xatolik:",
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
  // SALARY CALCULATIONS
  // =========================================================

  const shiftPay =
    Number(salaryForm.shifts || 0) *
    Number(salaryForm.dailyRate || 0);

  const commission =
    Number(salaryForm.totalSales || 0) *
    (Number(
      salaryForm.commissionPercent || 0
    ) /
      100);

  const deductions =
    Number(salaryForm.advance || 0) +
    Number(salaryForm.fine || 0);

  const cashToReceive = Math.max(
    0,
    shiftPay + commission - deductions
  );

  // =========================================================
  // SALARY PAYMENT SAVE
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
        doc(
          db,
          "users",
          salaryModalPerson.id
        ),
        {
          salaryHistory: [
            ...history,
            payment,
          ],
        }
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
  // TOTAL SALARIES
  // =========================================================

  const totalSalaries = staff.reduce(
    (sum, person) =>
      sum +
      (Number(person.salary) || 0),
    0
  );

  // =========================================================
  // INPUT CLASS
  // =========================================================

  const inputClass =
    "w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-4 focus:ring-sky-100";

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <span className="text-sky-500 text-xl animate-spin">
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
    <div className="min-h-screen bg-[#F8FCFF] text-gray-800 w-full flex flex-col font-sans pb-24">

      <main className="p-4 sm:p-6 max-w-4xl w-full mx-auto flex-1">

        {/* HEADER */}

        <div className="flex items-center justify-between mb-6 border-b-2 border-sky-100 pb-4">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-500 flex items-center justify-center text-xl shadow-sm">
              👥
            </div>

            <div>
              <h1 className="text-xl font-extrabold text-slate-800">
                Xodimlar boshqaruvi
              </h1>

              <p className="text-xs text-slate-400 mt-0.5">
                Xodimlarni boshqarish va nazorat qilish
              </p>
            </div>

          </div>

          {/* CHIROYLI XODIM QO'SHISH TUGMASI */}

          <button
            onClick={openAddModal}
            className="
              group
              bg-gradient-to-r
              from-sky-400
              to-sky-500
              hover:from-sky-500
              hover:to-sky-600
              text-white
              px-4
              py-2.5
              rounded-xl
              text-xs
              font-bold
              shadow-lg
              shadow-sky-200
              hover:shadow-sky-300
              active:scale-95
              transition-all
              flex
              items-center
              gap-2
              cursor-pointer
            "
          >
            <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-sm group-hover:rotate-90 transition-transform duration-200">
              +
            </span>

            <span className="hidden sm:inline">
              Xodim qo'shish
            </span>

            <span className="sm:hidden">
              Qo'shish
            </span>
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
                ? "bg-sky-500 text-white shadow-md shadow-sky-100"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-sky-50 hover:text-sky-600"
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
                ? "bg-sky-500 text-white shadow-md shadow-sky-100"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-sky-50 hover:text-sky-600"
            }`}
          >
            <span>👛</span>
            <span>Oyliklar</span>
          </button>

        </div>

        {/* STAFF TAB */}

        {activeTab === "staff" && (
          <>
            {staff.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-sky-200">
                <p className="text-gray-400 text-sm">
                  Hozircha xodimlar mavjud emas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {staff.map((person) => (

                  <div
                    key={person.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col justify-between transition-all hover:shadow-md hover:border-sky-100"
                  >

                    <div>

                      <div className="flex justify-between items-start gap-2">

                        <div>

                          <h3 className="font-bold text-gray-800 text-sm">
                            {person.fullName}
                          </h3>

                          <div className="flex flex-wrap gap-1 mt-1">

                            <p className="text-[11px] text-sky-700 font-medium bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-md inline-block">
                              {roleLabels[
                                person.role
                              ] ||
                                person.role}
                            </p>

                          </div>

                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            person.status ===
                            "active"
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {person.status ===
                          "active"
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

                        <p className="text-sky-600 font-extrabold text-sm pt-1">
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
                          person.status ===
                          "active"
                            ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                            : "border-green-200 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        <span>
                          {person.status ===
                          "active"
                            ? "🚫"
                            : "✅"}
                        </span>

                        <span>
                          {person.status ===
                          "active"
                            ? "Bloklash"
                            : "Aktivlashtirish"}
                        </span>
                      </button>

                      <button
                        onClick={() =>
                          handleDelete(
                            person.id
                          )
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

        {/* SALARY TAB */}

        {activeTab === "salary" && (
          <div className="space-y-4">

            <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 flex items-center gap-3">

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
                      {roleLabels[
                        person.role
                      ] ||
                        person.role}{" "}
                      {" • "}
                      <span className="font-semibold text-gray-700">
                        {Number(
                          person.salary || 0
                        ).toLocaleString()}{" "}
                        so'm
                      </span>
                    </p>

                    <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">

                      <span>✅</span>

                      Oxirgi to'lov:{" "}

                      <span className="font-medium text-gray-600">

                        {person.salaryHistory
                          ?.length > 0
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
          SALARY MODAL
      ===================================================== */}

      {salaryModalPerson && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-5 max-h-[95vh] overflow-y-auto">

            <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-4">

              <div>

                <h2 className="text-lg font-bold text-gray-800">
                  🧮{" "}
                  {salaryModalPerson.fullName}{" "}
                  — Oylik Hisobi
                </h2>

                <p className="text-xs text-gray-500 mt-0.5">
                  Lavozimi:{" "}
                  {roleLabels[
                    salaryModalPerson.role
                  ] ||
                    salaryModalPerson.role}
                </p>

              </div>

              <button
                onClick={closeSalaryModal}
                className="text-gray-400 hover:text-gray-600 p-1 text-xl"
              >
                ✕
              </button>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>

                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Ishlagan kunlari (Smena)
                </label>

                <input
                  type="number"
                  className={inputClass}
                  value={
                    salaryForm.shifts
                  }
                  onChange={(e) =>
                    updateSalaryForm(
                      "shifts",
                      e.target.value
                    )
                  }
                />

              </div>

              <div>

                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  1 kunlik stavka (so'm)
                </label>

                <input
                  type="number"
                  className={inputClass}
                  value={
                    salaryForm.dailyRate
                  }
                  onChange={(e) =>
                    updateSalaryForm(
                      "dailyRate",
                      e.target.value
                    )
                  }
                />

              </div>

              {salaryModalPerson.role ===
                "waiter" && (
                <>
                  <div>

                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Oylik jami sotuv (so'm)
                    </label>

                    <input
                      type="number"
                      className={inputClass}
                      value={
                        salaryForm.totalSales
                      }
                      onChange={(e) =>
                        updateSalaryForm(
                          "totalSales",
                          e.target.value
                        )
                      }
                    />

                  </div>

                  <div>

                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Sotuvdan foiz (%)
                    </label>

                    <input
                      type="number"
                      className={inputClass}
                      value={
                        salaryForm.commissionPercent
                      }
                      onChange={(e) =>
                        updateSalaryForm(
                          "commissionPercent",
                          e.target.value
                        )
                      }
                    />

                  </div>
                </>
              )}

              <div>

                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Avans (so'm)
                </label>

                <input
                  type="number"
                  className={inputClass}
                  value={
                    salaryForm.advance
                  }
                  onChange={(e) =>
                    updateSalaryForm(
                      "advance",
                      e.target.value
                    )
                  }
                />

              </div>

              <div>

                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Shtraf (so'm)
                </label>

                <input
                  type="number"
                  className={inputClass}
                  value={
                    salaryForm.fine
                  }
                  onChange={(e) =>
                    updateSalaryForm(
                      "fine",
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            <div className="mt-5 p-4 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-2 text-xs">

              <div className="flex justify-between text-gray-600">
                <span>Kungi maosh:</span>
                <span className="font-semibold">
                  {shiftPay.toLocaleString()} so'm
                </span>
              </div>

              {salaryModalPerson.role ===
                "waiter" && (
                <div className="flex justify-between text-gray-600">
                  <span>
                    Foizdan tushum:
                  </span>

                  <span className="font-semibold">
                    {commission.toLocaleString()} so'm
                  </span>
                </div>
              )}

              <div className="flex justify-between text-red-600">
                <span>
                  Ushlanmalar
                  (Avans/Shtraf):
                </span>

                <span className="font-semibold">
                  -
                  {deductions.toLocaleString()}{" "}
                  so'm
                </span>
              </div>

              <div className="border-t border-amber-200 pt-2 flex justify-between text-sm font-black text-green-700">

                <span>
                  Qo'lga tegadigan summa:
                </span>

                <span>
                  {cashToReceive.toLocaleString()}{" "}
                  so'm
                </span>

              </div>

            </div>

            <div className="flex justify-end gap-2 mt-5">

              <button
                onClick={closeSalaryModal}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Bekor qilish
              </button>

              <button
                onClick={saveSalaryPayment}
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 cursor-pointer"
              >
                To'lovni saqlash
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          ADD / EDIT XODIM MODAL
          FAQAT SHU QISM DIZAYNI O'ZGARTIRILGAN
      ===================================================== */}

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-hidden border border-sky-100">

            {/* MODAL HEADER */}

            <div className="relative overflow-hidden bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-500 px-5 py-5">

              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute -left-10 -bottom-10 w-28 h-28 rounded-full bg-white/10" />

              <div className="relative flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl text-white shadow-sm">
                    {editingStaff
                      ? "✏️"
                      : "👤"}
                  </div>

                  <div>

                    <h2 className="text-base font-extrabold text-white">
                      {editingStaff
                        ? "Xodimni tahrirlash"
                        : "Yangi xodim qo'shish"}
                    </h2>

                    <p className="text-[11px] text-sky-50 mt-0.5">
                      Xodim ma'lumotlarini kiriting
                    </p>

                  </div>

                </div>

                <button
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>

              </div>

            </div>

            {/* FORM */}

            <div className="p-5 max-h-[calc(95vh-90px)] overflow-y-auto">

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >

                {/* ISM */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Ism va Familiya{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">

                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      👤
                    </span>

                    <input
                      type="text"
                      name="fullName"
                      required
                      placeholder="Ali Valiyev"
                      className={`${inputClass} pl-10`}
                      value={
                        form.fullName
                      }
                      onChange={
                        handleChange
                      }
                    />

                  </div>

                </div>

                {/* LOGIN */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Login{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <div className="flex items-center gap-2">

                    <div className="relative flex-1">

                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        @
                      </span>

                      <input
                        type="text"
                        name="username"
                        required
                        placeholder="alivaliyev"
                        className={`${inputClass} pl-9`}
                        value={
                          form.username
                        }
                        onChange={
                          handleChange
                        }
                      />

                    </div>

                    <span className="text-xs text-slate-400 font-bold whitespace-nowrap">
                      @kafe.uz
                    </span>

                  </div>

                </div>

                {/* PAROL */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Parol{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">

                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      🔒
                    </span>

                    <input
                      type="text"
                      name="password"
                      required
                      placeholder="******"
                      className={`${inputClass} pl-10`}
                      value={
                        form.password
                      }
                      onChange={
                        handleChange
                      }
                    />

                  </div>

                </div>

                {/* LAVOZIM */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Lavozim / Role
                  </label>

                  <div className="relative">

                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      💼
                    </span>

                    <select
                      name="role"
                      className={`${inputClass} pl-10 cursor-pointer appearance-none`}
                      value={
                        form.role
                      }
                      onChange={
                        handleChange
                      }
                    >

                      {Object.entries(
                        roleLabels
                      ).map(
                        ([
                          key,
                          label,
                        ]) => (
                          <option
                            key={key}
                            value={key}
                          >
                            {label}
                          </option>
                        )
                      )}

                    </select>

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none">
                      ▾
                    </span>

                  </div>

                </div>

                {/* TELEFON */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Telefon raqami{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">

                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      📞
                    </span>

                    <input
                      type="text"
                      name="phone"
                      required
                      placeholder="+998 90 123 45 67"
                      className={`${inputClass} pl-10`}
                      value={
                        form.phone
                      }
                      onChange={
                        handleChange
                      }
                    />

                  </div>

                </div>

                {/* OYLIK */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    1 kunlik oylik (Stavka)
                  </label>

                  <div className="relative">

                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      💰
                    </span>

                    <input
                      type="number"
                      name="salary"
                      placeholder="100000"
                      className={`${inputClass} pl-10 pr-16`}
                      value={
                        form.salary
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                      SO'M
                    </span>

                  </div>

                </div>

                {/* STATUS */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Holati
                  </label>

                  <div className="relative">

                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      ●
                    </span>

                    <select
                      name="status"
                      className={`${inputClass} pl-10 cursor-pointer appearance-none`}
                      value={
                        form.status
                      }
                      onChange={
                        handleChange
                      }
                    >

                      <option value="active">
                        Faol
                      </option>

                      <option value="inactive">
                        Nofaol
                      </option>

                    </select>

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none">
                      ▾
                    </span>

                  </div>

                </div>

                {/* BUTTONS */}

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-5">

                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      resetForm();
                    }}
                    className="
                      px-4
                      py-2.5
                      border
                      border-slate-200
                      bg-white
                      rounded-xl
                      text-xs
                      font-bold
                      text-slate-600
                      hover:bg-slate-50
                      hover:border-slate-300
                      transition-all
                      cursor-pointer
                    "
                  >
                    Bekor qilish
                  </button>

                  <button
                    type="submit"
                    className="
                      px-5
                      py-2.5
                      bg-gradient-to-r
                      from-sky-400
                      to-sky-500
                      hover:from-sky-500
                      hover:to-sky-600
                      text-white
                      rounded-xl
                      text-xs
                      font-extrabold
                      shadow-lg
                      shadow-sky-200
                      hover:shadow-sky-300
                      active:scale-95
                      transition-all
                      cursor-pointer
                      flex
                      items-center
                      gap-2
                    "
                  >

                    <span>
                      {editingStaff
                        ? "✓"
                        : "+"}
                    </span>

                    <span>
                      {editingStaff
                        ? "Saqlash"
                        : "Qo'shish"}
                    </span>

                  </button>

                </div>

              </form>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}