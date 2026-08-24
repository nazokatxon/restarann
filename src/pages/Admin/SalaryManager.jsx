import React, { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function SalaryManager({ cafeId }) {
  const [staffList, setStaffList] = useState([]);
  const [salaryModalPerson, setSalaryModalPerson] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form holati
  const [salaryForm, setSalaryForm] = useState({
    baseSalary: "0",
    commissionPercent: "0",
    totalSales: "0",
    advance: "0",
    bonus: "0",
    penalty: "0",
  });

  // 1. Xodimlarni yuklab olish
  useEffect(() => {
    if (!cafeId) return;

    const staffQuery = query(
      collection(db, "staff"),
      where("cafeId", "==", cafeId)
    );

    const unsubscribe = onSnapshot(staffQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStaffList(data);
    });

    return () => unsubscribe();
  }, [cafeId]);

  // Modalni ochish
  const handleOpenSalaryModal = (person) => {
    setSalaryModalPerson(person);
    setSalaryForm({
      baseSalary: String(person.baseSalary || 0),
      commissionPercent: String(person.commissionPercent || 0),
      totalSales: "0",
      advance: String(person.advance || 0),
      bonus: "0",
      penalty: "0",
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSalaryModalPerson(null);
  };

  const updateSalaryForm = (field, value) => {
    setSalaryForm((prev) => ({ ...prev, [field]: value }));
  };

  // 2. SOTUV VA XIZMATLARNI AVTOMATIK HISOBLASH
  useEffect(() => {
    if (!salaryModalPerson || !cafeId || !modalOpen) return;

    const ordersQuery = query(
      collection(db, "orders"),
      where("cafeId", "==", cafeId)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        let calculatedSales = 0;
        const now = new Date();

        // Joriy oy boshi va oxiri
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

        snapshot.docs.forEach((orderDoc) => {
          const order = orderDoc.data();

          if (order.paymentStatus !== "paid") return;

          let orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
          if (!orderDate || isNaN(orderDate.getTime())) return;
          if (orderDate < startOfMonth || orderDate >= startOfNextMonth) return;

          // Ofitsiantlar uchun buyurtmaning umumiy summasi
          if (salaryModalPerson.role === "waiter") {
            if (order.waiterId === salaryModalPerson.id) {
              calculatedSales += Number(order.totalPrice || 0);
            }
          } 
          // Oshpaz, Salatchi, Somsachi va b. uchun tayyorlangan taomlar summasi
          else if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item) => {
              const isPreparedByStaff = 
                item.preparedById === salaryModalPerson.id || 
                item.chefId === salaryModalPerson.id ||
                (item.category && item.category.toLowerCase() === salaryModalPerson.role.toLowerCase());

              if (isPreparedByStaff) {
                const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
                calculatedSales += itemTotal;
              }
            });
          }
        });

        setSalaryForm((prev) => ({
          ...prev,
          totalSales: String(calculatedSales),
        }));
      },
      (error) => {
        console.error("Sotuvlarni hisoblashda xatolik:", error);
      }
    );

    return () => unsubscribe();
  }, [salaryModalPerson, cafeId, modalOpen]);

  // Hisob-kitob matematikasi
  const baseSalary = Number(salaryForm.baseSalary || 0);
  const totalSales = Number(salaryForm.totalSales || 0);
  const commissionPercent = Number(salaryForm.commissionPercent || 0);
  const advance = Number(salaryForm.advance || 0);
  const bonus = Number(salaryForm.bonus || 0);
  const penalty = Number(salaryForm.penalty || 0);

  const commissionAmount = (totalSales * commissionPercent) / 100;
  const netSalary = baseSalary + commissionAmount + bonus - advance - penalty;

  // Maosh ma'lumotlarini Firestore'ga saqlash
  const handleSaveSalary = async (e) => {
    e.preventDefault();
    if (!salaryModalPerson) return;

    try {
      await addDoc(collection(db, "salaries"), {
        cafeId,
        staffId: salaryModalPerson.id,
        staffName: salaryModalPerson.name || salaryModalPerson.fullName,
        role: salaryModalPerson.role,
        baseSalary,
        totalSales,
        commissionPercent,
        commissionAmount,
        advance,
        bonus,
        penalty,
        netSalary,
        createdAt: serverTimestamp(),
      });

      alert("Maosh muvaffaqiyatli saqlandi!");
      handleCloseModal();
    } catch (err) {
      console.error("Saqlashda xatolik:", err);
      alert("Xatolik yuz berdi!");
    }
  };

  const inputClass = "w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Oylik Maosh Boshqaruvi</h1>
      </div>

      {/* Xodimlar Jadvali */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase">
              <th className="p-3">Ism Familiya</th>
              <th className="p-3">Lavozimi (Rol)</th>
              <th className="p-3">Telefon</th>
              <th className="p-3 text-right">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {staffList.map((person) => (
              <tr key={person.id} className="hover:bg-gray-50 text-sm">
                <td className="p-3 font-medium text-gray-800">{person.name || person.fullName}</td>
                <td className="p-3 text-gray-600 capitalize">{person.role}</td>
                <td className="p-3 text-gray-600">{person.phone || "-"}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => handleOpenSalaryModal(person)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                  >
                    Maosh hisoblash
                  </button>
                </td>
              </tr>
            ))}
            {staffList.length === 0 && (
              <tr>
                <td colSpan="4" className="p-4 text-center text-gray-500 text-sm">
                  Xodimlar ro'yxati bo'sh.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MAOSH HISOBLASH MODALI */}
      {modalOpen && salaryModalPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
              Maosh: <span className="text-blue-600">{salaryModalPerson.name || salaryModalPerson.fullName}</span>
            </h2>

            <form onSubmit={handleSaveSalary} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Oklad (Asosiy maosh)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={salaryForm.baseSalary}
                    onChange={(e) => updateSalaryForm("baseSalary", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Avans (Olingan)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={salaryForm.advance}
                    onChange={(e) => updateSalaryForm("advance", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Jami sotuv / tayyorlangan
                  </label>
                  <input
                    type="number"
                    className={`${inputClass} bg-gray-100 font-medium`}
                    value={salaryForm.totalSales}
                    onChange={(e) => updateSalaryForm("totalSales", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Sotuvdan foiz (%)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={salaryForm.commissionPercent}
                    onChange={(e) => updateSalaryForm("commissionPercent", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Mukofot (Bonus)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={salaryForm.bonus}
                    onChange={(e) => updateSalaryForm("bonus", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Jarima (Shtraf)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={salaryForm.penalty}
                    onChange={(e) => updateSalaryForm("penalty", e.target.value)}
                  />
                </div>
              </div>

              {/* Qo'lga tegadigan umumiy summa */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center mt-4">
                <p className="text-xs text-blue-600 font-medium">Qo'lga tegadigan jami maosh:</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">
                  {netSalary.toLocaleString("uz-UZ")} so'm
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 font-medium"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium shadow"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}