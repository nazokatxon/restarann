import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";

export default function Reports() {
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [paidOrders, setPaidOrders] = useState([
    {
      id: 1,
      table: "Stol 1",
      paymentMethod: "naqd",
      totalAmount: 266000,
      time: "12:30",
      date: new Date().toLocaleDateString(),
    },
  ]);

  const totalRevenue = paidOrders.reduce(
    (sum, item) => sum + item.totalAmount,
    0
  );

  const cashRevenue = paidOrders
    .filter((item) => item.paymentMethod === "naqd")
    .reduce((sum, item) => sum + item.totalAmount, 0);

  const cardRevenue = paidOrders
    .filter((item) => item.paymentMethod === "karta")
    .reduce((sum, item) => sum + item.totalAmount, 0);

  const closedReceiptsCount = paidOrders.length;

  const filteredOrders = paidOrders.filter((order) => {
    const matchesSearch = order.table
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesType =
      filterType === "all" || order.paymentMethod === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto font-sans">
      {/* SARLAVHA */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Moliya va Hisobotlar
        </h1>

        <p className="text-sm text-gray-400 mt-1">
          To'langan pullar va yopilgan cheklar statistikasi
        </p>
      </div>

      {/* 4 TA STATISTIKA KARTASI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Bugungi Jami Tushum */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col justify-center items-center">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            BUGUNGI JAMI TUSHUM
          </span>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-600">
              {totalRevenue.toLocaleString()}
            </span>

            <span className="text-xs font-semibold text-emerald-600">
              so'm
            </span>
          </div>
        </div>

        {/* Naqd To'lovlar */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col justify-center items-center">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            NAQD TO'LOVLAR
          </span>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-700">
              {cashRevenue.toLocaleString()}
            </span>

            <span className="text-xs font-semibold text-amber-700">
              so'm
            </span>
          </div>
        </div>

        {/* Karta Orqali */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col justify-center items-center">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            KARTA ORQALI
          </span>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-blue-600">
              {cardRevenue.toLocaleString()}
            </span>

            <span className="text-xs font-semibold text-blue-600">
              so'm
            </span>
          </div>
        </div>

        {/* Yopilgan Cheklar */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col justify-center items-center">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            YOPILGAN CHEKLAR
          </span>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-gray-800">
              {closedReceiptsCount}
            </span>

            <span className="text-xs font-semibold text-gray-800">
              ta
            </span>
          </div>
        </div>
      </div>

      {/* TUGMALAR VA QIDIRUV */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center bg-gray-100/80 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setFilterType("all")}
            className={`flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs font-bold transition ${
              filterType === "all"
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Barchasi
          </button>

          <button
            onClick={() => setFilterType("naqd")}
            className={`flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs font-bold transition ${
              filterType === "naqd"
                ? "bg-white text-amber-700 shadow-xs"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Naqd
          </button>

          <button
            onClick={() => setFilterType("karta")}
            className={`flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs font-bold transition ${
              filterType === "karta"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Karta
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Stol raqamini kiriting..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 transition shadow-xs"
          />

          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* YOPILGAN CHEKLAR RO'YXATI */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <th className="py-3.5 px-6">Stol</th>
              <th className="py-3.5 px-6">Vaqt</th>
              <th className="py-3.5 px-6">To'lov Turi</th>
              <th className="py-3.5 px-6 text-right">Summa</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50 text-xs font-medium text-gray-700">
            {filteredOrders.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  className="py-8 text-center text-gray-400"
                >
                  Hisobotlar topilmadi
                </td>
              </tr>
            ) : (
              filteredOrders.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50/50 transition"
                >
                  <td className="py-4 px-6 font-bold text-gray-900">
                    {item.table}
                  </td>

                  <td className="py-4 px-6 text-gray-400">
                    {item.time}
                  </td>

                  <td className="py-4 px-6">
                    <span
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold ${
                        item.paymentMethod === "naqd"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {item.paymentMethod === "naqd"
                        ? "Naqd"
                        : "Karta"}
                    </span>
                  </td>

                  <td className="py-4 px-6 text-right font-extrabold text-gray-900">
                    {item.totalAmount.toLocaleString()} so'm
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}