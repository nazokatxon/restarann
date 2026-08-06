import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../../Firebase/config";
import { useAuth } from "../../context/AuthContext";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  UserX,
  UserCheck,
  DollarSign,
  CheckCircle,
  Mail,
  Phone,
  RefreshCw,
  Wallet,
  X,
  Calculator,
  AlertTriangle,
  Percent,
  Calendar,
} from "lucide-react";

export default function StaffList() {
  const { cafeId, registerStaff } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cafeName, setCafeName] = useState("");
  const [cafeNameLoading, setCafeNameLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [activeTab, setActiveTab] = useState("staff");

  // Oylik hisoblash uchun
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [fetchingSales, setFetchingSales] = useState(false);
  const [calcData, setCalcData] = useState({
    shiftsCount: 15,
    dailyRate: 0,
    commissionRate: 3,
    totalSales: 0,
    advance: 0,
    deduction: 0,
  });

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "waiter",
    phone: "",
    salary: "",
    dailyRate: "",
    commissionRate: "3",
    status: "active",
  });

  useEffect(() => {
    if (!cafeId) return;

    const q = query(collection(db, "users"), where("cafeId", "==", cafeId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setStaff(data.filter((u) => u.role !== "bigadmin"));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [cafeId]);

  useEffect(() => {
    if (!cafeId) return;

    const fetchCafeName = async () => {
      setCafeNameLoading(true);
      try {
        const cafeDoc = await getDoc(doc(db, "cafes", cafeId));
        if (cafeDoc.exists()) {
          const data = cafeDoc.data();
          setCafeName(data.name || "");
        } else {
          setCafeName("");
        }
      } catch (error) {
        console.error("Cafe name fetch error:", error);
        setCafeName("");
      } finally {
        setCafeNameLoading(false);
      }
    };

    fetchCafeName();
  }, [cafeId]);

  const roleLabels = {
    waiter: "Ofitsiant",
    chef: "Oshpaz",
    cashier: "Kassir",
    admin: "Direktor",
  };

  const resetForm = () => {
    setForm({
      fullName: "",
      username: "",
      password: "",
      role: "waiter",
      phone: "",
      salary: "",
      dailyRate: "",
      commissionRate: "3",
      status: "active",
    });
    setEditingStaff(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (person) => {
    const currentUsername = person.email ? person.email.split("@")[0] : "";

    setForm({
      fullName: person.fullName || "",
      username: currentUsername,
      password: person.password || "",
      role: person.role || "waiter",
      phone: person.phone || "",
      salary: person.salary || "",
      dailyRate: person.dailyRate || "",
      commissionRate: person.commissionRate || "3",
      status: person.status || "active",
    });
    setEditingStaff(person);
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.fullName || !form.phone || !form.username || !form.password) {
      alert("Iltimos, barcha majburiy maydonlarni kiriting");
      return;
    }

    const fullEmail = `${form.username.trim().toLowerCase()}@kafe.com`;

    const extraData = {
      cafeId,
      fullName: form.fullName,
      role: form.role,
      phone: form.phone,
      salary: Number(form.salary) || 0,
      dailyRate: Number(form.dailyRate) || 0,
      commissionRate: Number(form.commissionRate) || 3,
      status: form.status,
      password: form.password,
    };

    try {
      if (editingStaff) {
        await updateDoc(doc(db, "users", editingStaff.id), {
          ...extraData,
          email: fullEmail,
        });
        alert("Xodim ma'lumotlari muvaffaqiyatli yangilandi!");
      } else {
        await registerStaff(fullEmail, form.password, extraData);
        alert("Yangi xodim muvaffaqiyatli qo'shildi!");
      }
      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Xodimni saqlashda xatolik:", error);
      alert("Xatolik yuz berdi!");
    }
  };

  const handleDelete = async (staffId) => {
    if (!window.confirm("Bu xodimni o'chirishga ishonchingiz komilmi?")) return;

    try {
      await deleteDoc(doc(db, "users", staffId));
    } catch (error) {
      console.error("Xodimni o'chirishda xatolik:", error);
    }
  };

  const toggleStatus = async (person) => {
    try {
      await updateDoc(doc(db, "users", person.id), {
        status: person.status === "active" ? "inactive" : "active",
      });
    } catch (error) {
      console.error("Holatni yangilashda xatolik:", error);
    }
  };

  // --- AVTOMATIK JAMI SOTUVNI BAZADAN OLISH ---
  const openCalculatorModal = async (person) => {
    setSelectedStaff(person);
    setCalcModalOpen(true);
    setFetchingSales(true);

    let calculatedSales = 0;

    if (person.role === "waiter") {
      try {
        const ordersQuery = query(
          collection(db, "orders"),
          where("cafeId", "==", cafeId),
          where("waiterName", "==", person.fullName)
        );

        const querySnapshot = await getDocs(ordersQuery);
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === "paid" || data.status === "completed") {
            calculatedSales += Number(data.totalAmount || data.totalPrice || 0);
          }
        });
      } catch (err) {
        console.error("Sotuvlarni hisoblashda xatolik:", err);
      }
    }

    setCalcData({
      shiftsCount: 15,
      dailyRate: person.dailyRate || 0,
      commissionRate: person.commissionRate || 3,
      totalSales: calculatedSales,
      advance: 0,
      deduction: 0,
    });
    setFetchingSales(false);
  };

  // --- AVTOMATIK HISOB-KITOB ---
  const shifts = Number(calcData.shiftsCount) || 0;
  const currentDailyRate = Number(calcData.dailyRate) || 0;
  const currentCommRate = Number(calcData.commissionRate) || 3;
  const sales = Number(calcData.totalSales) || 0;
  const advance = Number(calcData.advance) || 0;
  const deduction = Number(calcData.deduction) || 0;

  // Smena bo'yicha jami fiksa summasi
  const fixTotal =
    selectedStaff?.role === "waiter"
      ? shifts * currentDailyRate
      : Number(selectedStaff?.salary) || 0;

  // Sotuvdan olinadigan foiz bonus summasi
  const bonusTotal =
    selectedStaff?.role === "waiter"
      ? sales * (currentCommRate / 100)
      : 0;

  // Jami ishlangani va ushlab qolinadigan net oylik
  const grossSalary = fixTotal + bonusTotal;
  const netSalary = Math.max(0, grossSalary - advance - deduction);

  const confirmSalaryPayment = async () => {
    if (!selectedStaff) return;

    if (
      netSalary <= 0 &&
      !window.confirm("Yakuniy to'lov 0 so'm bo'lmoqda. Baribir saqlaysizmi?")
    ) {
      return;
    }

    try {
      await updateDoc(doc(db, "users", selectedStaff.id), {
        salaryHistory: arrayUnion({
          date: new Date().toISOString(),
          shiftsCount: shifts,
          dailyRate: currentDailyRate,
          commissionRate: currentCommRate,
          totalSales: sales,
          fixAmount: fixTotal,
          bonusAmount: bonusTotal,
          advance,
          deduction,
          netAmount: netSalary,
        }),
      });

      alert(
        `${selectedStaff.fullName} uchun ${netSalary.toLocaleString()} so'm to'lov saqlandi!`
      );
      setCalcModalOpen(false);
    } catch (error) {
      console.error("To'lovni saqlashda xatolik:", error);
      alert("Xatolik yuz berdi!");
    }
  };

  const totalSalaries = staff.reduce((sum, p) => {
    if (p.role === "waiter") {
      return sum + Number(p.dailyRate || 0) * 15;
    }
    return sum + Number(p.salary || 0);
  }, 0);

  const inputClass =
    "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder:text-gray-400 shadow-sm transition-all duration-150 focus:outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <RefreshCw className="text-amber-600 w-6 h-6 animate-spin" />
        <p className="text-gray-500 text-sm font-medium">
          Xodimlar ro'yxati yuklanmoqda...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto bg-[#FDFBF7] min-h-screen pb-24">
      {/* HEADER VA TABLAR */}
      <div className="sticky top-0 z-20 bg-[#FDFBF7] pt-2 pb-3 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b-2 border-[#D4AF37] pb-3">
          <div className="flex items-center gap-2">
            <Users className="text-[#8B4513] w-6 h-6" />
            <div>
              <h1 className="text-xl font-bold text-[#8B4513]">
                {cafeNameLoading
                  ? "🏪 Cafe yuklanmoqda... — Xodimlar"
                  : cafeName
                  ? `🏪 ${cafeName} — Xodimlar`
                  : "🏪 Xodimlar"}
              </h1>
              {!cafeNameLoading && cafeName && (
                <p className="text-sm text-gray-500 mt-1">
                  Cafe xodimlarini boshqarish
                </p>
              )}
            </div>
          </div>

          <button
            onClick={openAddModal}
            className="bg-[#B22222] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#8B0000] active:scale-95 transition-all shadow-md shadow-red-900/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Xodim qo'shish</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "staff"
                ? "bg-[#8B4513] text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Xodimlar ro'yxati</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("salary")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "salary"
                ? "bg-[#8B4513] text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Oyliklar va Hisob-kitob</span>
          </button>
        </div>
      </div>

      {/* 1-TAB: Xodimlar Ro'yxati */}
      {activeTab === "staff" && (
        <div className="mt-4">
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
                          {roleLabels[person.role] || person.role}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          person.status === "active"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {person.status === "active" ? "Faol" : "Nofaol"}
                      </span>
                    </div>

                    <div className="space-y-1 mt-3 border-t pt-2 border-gray-50 text-xs text-gray-500">
                      <p className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {person.email}
                      </p>

                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {person.phone}
                      </p>

                      {person.role === "waiter" ? (
                        <div className="pt-1 text-[#B22222] font-bold text-xs space-y-0.5">
                          <p>
                            Fiksa:{" "}
                            {Number(person.dailyRate || 0).toLocaleString()} so'm / kun
                          </p>
                          <p>Foiz: {person.commissionRate || 3}% sotuvdan</p>
                        </div>
                      ) : (
                        <p className="text-[#B22222] font-extrabold text-sm pt-1">
                          {Number(person.salary || 0).toLocaleString()} so'm / oy
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 mt-4 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => openEditModal(person)}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-gray-600 transition flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Tahrirlash</span>
                    </button>

                    <button
                      onClick={() => toggleStatus(person)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition flex items-center gap-1 ${
                        person.status === "active"
                          ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                          : "border-green-200 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {person.status === "active" ? (
                        <UserX className="w-3 h-3" />
                      ) : (
                        <UserCheck className="w-3 h-3" />
                      )}
                      <span>
                        {person.status === "active"
                          ? "Bloklash"
                          : "Aktivlashtirish"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleDelete(person.id)}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 font-medium transition ml-auto flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>O'chirish</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2-TAB: Oylik Hisobi */}
      {activeTab === "salary" && (
        <div className="space-y-4 mt-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center gap-3">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                Taxminiy oylik xarajati (Oklad va Fiksalar)
              </p>

              <p className="text-xl font-black text-green-600 mt-0.5">
                ~ {totalSalaries.toLocaleString()} so'm
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {staff.map((person) => {
              const lastPayment =
                person.salaryHistory?.length > 0
                  ? person.salaryHistory[person.salaryHistory.length - 1]
                  : null;

              return (
                <div
                  key={person.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-800 text-sm">
                        {person.fullName}
                      </p>
                      <span className="text-[10px] bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-md">
                        {roleLabels[person.role] || person.role}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-0.5">
                      {person.role === "waiter" ? (
                        <span>
                          Fiksa:{" "}
                          <b>
                            {Number(person.dailyRate || 0).toLocaleString()}{" "}
                            so'm/kun
                          </b>{" "}
                          | Foiz: <b>{person.commissionRate || 3}%</b>
                        </span>
                      ) : (
                        <span>
                          Oklad:{" "}
                          <b>
                            {Number(person.salary || 0).toLocaleString()}{" "}
                            so'm/oy
                          </b>
                        </span>
                      )}
                    </p>

                    <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Oxirgi to'lov:{" "}
                      <span className="font-medium text-gray-600">
                        {lastPayment
                          ? `${new Date(
                              lastPayment.date
                            ).toLocaleDateString()} (${Number(
                              lastPayment.netAmount
                            ).toLocaleString()} so'm)`
                          : "To'lanmagan"}
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={() => openCalculatorModal(person)}
                    className="text-xs px-3.5 py-2 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Oylikni hisoblash / To'lash</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KALKULYATOR MODAL */}
      {calcModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[95vh] overflow-y-auto border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#8B4513]" />
                  {selectedStaff.fullName} — Oylik Hisobi
                </h2>
                <p className="text-xs text-gray-500 capitalize">
                  {roleLabels[selectedStaff.role] || selectedStaff.role}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCalcModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {fetchingSales ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
                <p className="text-xs text-gray-500">
                  Sotuvlar hisoblanmoqda...
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {selectedStaff.role === "waiter" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-600 flex items-center gap-1 mb-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />{" "}
                          Smenalar (kun)
                        </label>
                        <input
                          type="number"
                          value={calcData.shiftsCount}
                          onChange={(e) =>
                            setCalcData({
                              ...calcData,
                              shiftsCount: e.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-600 block mb-1">
                          Kunlik Fiksa (so'm)
                        </label>
                        <input
                          type="number"
                          value={calcData.dailyRate}
                          onChange={(e) =>
                            setCalcData({
                              ...calcData,
                              dailyRate: e.target.value,
                            })
                          }
                          placeholder="0"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-600 flex items-center gap-1 mb-1">
                          <DollarSign className="w-3.5 h-3.5 text-gray-400" />{" "}
                          Jami Sotuv (Avto / so'm)
                        </label>
                        <input
                          type="number"
                          value={calcData.totalSales}
                          onChange={(e) =>
                            setCalcData({
                              ...calcData,
                              totalSales: e.target.value,
                            })
                          }
                          className={`${inputClass} bg-amber-50/30 font-bold`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-600 flex items-center gap-1 mb-1">
                          <Percent className="w-3.5 h-3.5 text-gray-400" /> Sotuv
                          Foizi (%)
                        </label>
                        <input
                          type="number"
                          value={calcData.commissionRate}
                          onChange={(e) =>
                            setCalcData({
                              ...calcData,
                              commissionRate: e.target.value,
                            })
                          }
                          placeholder="3"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">
                      Belgilangan Oklad (so'm)
                    </label>
                    <input
                      type="number"
                      disabled
                      value={selectedStaff.salary || 0}
                      className={`${inputClass} bg-gray-50 text-gray-500`}
                    />
                  </div>
                )}

                <hr className="my-2 border-gray-100" />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">
                      Berilgan Avans (so'm)
                    </label>
                    <input
                      type="number"
                      value={calcData.advance}
                      onChange={(e) =>
                        setCalcData({ ...calcData, advance: e.target.value })
                      }
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 flex items-center gap-1 mb-1 text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> Jarima / Idish (so'm)
                    </label>
                    <input
                      type="number"
                      value={calcData.deduction}
                      onChange={(e) =>
                        setCalcData({ ...calcData, deduction: e.target.value })
                      }
                      className={`${inputClass} focus:border-red-500 focus:ring-red-500/15`}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* HISOB-KITOB NATIJASI */}
                <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/60 space-y-1.5 text-xs text-amber-900 mt-2">
                  {selectedStaff.role === "waiter" && (
                    <>
                      <div className="flex justify-between">
                        <span>
                          Smena maoshi ({shifts} kun × {currentDailyRate.toLocaleString()} so'm):
                        </span>
                        <span className="font-semibold">
                          {fixTotal.toLocaleString()} so'm
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>Sotuvdan foiz ({currentCommRate}%):</span>
                        <span className="font-semibold">
                          {bonusTotal.toLocaleString()} so'm
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-red-600">
                    <span>Jami ushlanmalar (Avans + Jarima):</span>
                    <span className="font-semibold">
                      - {(advance + deduction).toLocaleString()} so'm
                    </span>
                  </div>

                  <div className="flex justify-between text-sm font-black text-green-700 pt-2 border-t border-amber-200/80">
                    <span>Qo'lga tegadigan (Kassa):</span>
                    <span>{netSalary.toLocaleString()} so'm</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={confirmSalaryPayment}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-green-700 transition shadow-md active:scale-95"
                  >
                    To'landi deb saqlash
                  </button>

                  <button
                    type="button"
                    onClick={() => setCalcModalOpen(false)}
                    className="flex-1 border border-gray-200 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 text-gray-500 transition"
                  >
                    Bekor qilish
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* XODIM QO'SHISH / TAHRIRLASH MODALI */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[95vh] overflow-y-auto border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h2 className="text-base font-bold text-gray-800">
                {editingStaff ? "Xodimni tahrirlash" : "Yangi xodim qo'shish"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  To'liq ism
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputClass + " mt-1"}
                  placeholder="Masalan: Aliyev Vali"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Login (username)
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    className={inputClass + " mt-1"}
                    placeholder="valiev"
                    disabled={!!editingStaff}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Parol
                  </label>
                  <input
                    type="text"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className={inputClass + " mt-1"}
                    placeholder="******"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Lavozimi
                </label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className={inputClass + " mt-1"}
                >
                  <option value="waiter">Ofitsiant</option>
                  <option value="chef">Oshpaz</option>
                  <option value="cashier">Kassir</option>
                  <option value="admin">Direktor</option>
                </select>
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
                  className={inputClass + " mt-1"}
                  placeholder="+998 90 123 45 67"
                />
              </div>

              {form.role === "waiter" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Kunlik Fiksa (so'm)
                    </label>
                    <input
                      type="number"
                      name="dailyRate"
                      value={form.dailyRate}
                      onChange={handleChange}
                      className={inputClass + " mt-1"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Sotuv Foizi (%)
                    </label>
                    <input
                      type="number"
                      name="commissionRate"
                      value={form.commissionRate}
                      onChange={handleChange}
                      className={inputClass + " mt-1"}
                      placeholder="3"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Oylik maoshi (so'm)
                  </label>
                  <input
                    type="number"
                    name="salary"
                    value={form.salary}
                    onChange={handleChange}
                    className={inputClass + " mt-1"}
                    placeholder="Masalan: 3000000"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-amber-700 transition"
                >
                  Saqlash
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-100 transition"
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