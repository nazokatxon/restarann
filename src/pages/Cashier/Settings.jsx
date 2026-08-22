import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function Settings() {
  const [settings, setSettings] = useState({
    cafeName: "AI Cafe",
    currency: "so'm",
    taxPercent: 0,
    servicePercent: 0,
    language: "uz",
    autoPrint: false,
    soundEnabled: true,
    darkMode: false,
  });

  // SETTINGS LOAD
  useEffect(() => {
    const savedSettings = localStorage.getItem("cashierSettings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error("Settings load error:", error);
      }
    }
  }, []);

  // INPUT CHANGE
  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  // SAVE SETTINGS
  const handleSave = () => {
    localStorage.setItem("cashierSettings", JSON.stringify(settings));
    localStorage.setItem("cafeName", settings.cafeName);
    localStorage.setItem("appLang", settings.language);
    toast.success("Sozlamalar muvaffaqiyatli saqlandi!");
  };

  // RESET SETTINGS
  const handleReset = () => {
    const defaultSettings = {
      cafeName: "AI Cafe",
      currency: "so'm",
      taxPercent: 0,
      servicePercent: 0,
      language: "uz",
      autoPrint: false,
      soundEnabled: true,
      darkMode: false,
    };

    setSettings(defaultSettings);
    localStorage.setItem("cashierSettings", JSON.stringify(defaultSettings));
    localStorage.setItem("cafeName", "AI Cafe");
    localStorage.setItem("appLang", "uz");
    toast.info("Sozlamalar standart holatga qaytarildi");
  };

  return (
    <div
      className={`w-full h-full overflow-y-auto p-4 md:p-8 transition-colors ${
        settings.darkMode
          ? "bg-slate-900 text-white"
          : "bg-[#f7f5f2] text-[#243447]"
      }`}
    >
      <div className="max-w-5xl mx-auto pb-10">
        {/* TITLE */}
        <div className="mb-7 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#fff3dc] flex items-center justify-center text-2xl shrink-0">
            ⚙️
          </div>
          <div>
            <h1
              className={`text-2xl font-black ${
                settings.darkMode ? "text-white" : "text-[#2d3542]"
              }`}
            >
              Sozlamalar
            </h1>
            <p
              className={`text-sm mt-0.5 ${
                settings.darkMode ? "text-slate-400" : "text-gray-400"
              }`}
            >
              Kassa tizimini o'zingizga moslab sozlang
            </p>
          </div>
        </div>

        {/* CARDS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* KAFE SOZLAMALARI */}
          <div
            className={`rounded-2xl border p-6 shadow-sm ${
              settings.darkMode
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-gray-200"
            }`}
          >
            <h2 className="font-black text-lg mb-6">🏢 Kafe sozlamalari</h2>
            <div className="space-y-5">
              <div>
                <label
                  className={`block text-sm font-bold mb-2 ${
                    settings.darkMode ? "text-slate-300" : "text-gray-600"
                  }`}
                >
                  Kafe nomi
                </label>
                <input
                  type="text"
                  value={settings.cafeName}
                  onChange={(e) => handleChange("cafeName", e.target.value)}
                  placeholder="Kafe nomini kiriting"
                  className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-200 ${
                    settings.darkMode
                      ? "bg-slate-900 border-slate-600 text-white"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-bold mb-2 ${
                    settings.darkMode ? "text-slate-300" : "text-gray-600"
                  }`}
                >
                  Valyuta
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${
                    settings.darkMode
                      ? "bg-slate-900 border-slate-600 text-white"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                >
                  <option value="so'm">O'zbek so'mi</option>
                  <option value="$">Dollar ($)</option>
                  <option value="₽">Rubl (₽)</option>
                </select>
              </div>

              <div>
                <label
                  className={`block text-sm font-bold mb-2 ${
                    settings.darkMode ? "text-slate-300" : "text-gray-600"
                  }`}
                >
                  Tizim tili
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => handleChange("language", e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${
                    settings.darkMode
                      ? "bg-slate-900 border-slate-600 text-white"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                >
                  <option value="uz">O'zbek</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          {/* TO'LOV SOZLAMALARI */}
          <div
            className={`rounded-2xl border p-6 shadow-sm ${
              settings.darkMode
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-gray-200"
            }`}
          >
            <h2 className="font-black text-lg mb-6">💰 To'lov sozlamalari</h2>
            <div className="space-y-5">
              <div>
                <label
                  className={`block text-sm font-bold mb-2 ${
                    settings.darkMode ? "text-slate-300" : "text-gray-600"
                  }`}
                >
                  Soliq foizi (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.taxPercent}
                  onChange={(e) =>
                    handleChange("taxPercent", Number(e.target.value) || 0)
                  }
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${
                    settings.darkMode
                      ? "bg-slate-900 border-slate-600 text-white"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-bold mb-2 ${
                    settings.darkMode ? "text-slate-300" : "text-gray-600"
                  }`}
                >
                  Xizmat haqi (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.servicePercent}
                  onChange={(e) =>
                    handleChange("servicePercent", Number(e.target.value) || 0)
                  }
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${
                    settings.darkMode
                      ? "bg-slate-900 border-slate-600 text-white"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                />
              </div>

              <div
                className={`p-4 rounded-xl ${
                  settings.darkMode ? "bg-slate-900" : "bg-gray-50"
                }`}
              >
                <p className="text-sm font-bold">Hozirgi sozlama</p>
                <p
                  className={`text-xs mt-1 ${
                    settings.darkMode ? "text-slate-400" : "text-gray-500"
                  }`}
                >
                  Soliq: {settings.taxPercent}% • Xizmat haqi:{" "}
                  {settings.servicePercent}%
                </p>
              </div>
            </div>
          </div>

          {/* KASSA SOZLAMALARI */}
          <div
            className={`rounded-2xl border p-6 shadow-sm ${
              settings.darkMode
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-gray-200"
            }`}
          >
            <h2 className="font-black text-lg mb-5">🖨️ Kassa sozlamalari</h2>
            <div className="space-y-4">
              <div
                className={`flex items-center justify-between p-4 rounded-xl ${
                  settings.darkMode ? "bg-slate-900" : "bg-gray-50"
                }`}
              >
                <div>
                  <p className="font-bold text-sm">Chekni avtomatik chop etish</p>
                  <p
                    className={`text-xs mt-1 ${
                      settings.darkMode ? "text-slate-400" : "text-gray-400"
                    }`}
                  >
                    To'lovdan keyin chek avtomatik ochiladi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleChange("autoPrint", !settings.autoPrint)
                  }
                  className={`w-12 h-7 rounded-full p-1 transition ${
                    settings.autoPrint ? "bg-[#315fbd]" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.autoPrint ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div
                className={`flex items-center justify-between p-4 rounded-xl ${
                  settings.darkMode ? "bg-slate-900" : "bg-gray-50"
                }`}
              >
                <div>
                  <p className="font-bold text-sm">🔔 Buyurtma ovozi</p>
                  <p
                    className={`text-xs mt-1 ${
                      settings.darkMode ? "text-slate-400" : "text-gray-400"
                    }`}
                  >
                    Yangi buyurtma kelganda ovoz chiqaradi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleChange("soundEnabled", !settings.soundEnabled)
                  }
                  className={`w-12 h-7 rounded-full p-1 transition ${
                    settings.soundEnabled ? "bg-[#16865c]" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.soundEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* KO'RINISH */}
          <div
            className={`rounded-2xl border p-6 shadow-sm ${
              settings.darkMode
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-gray-200"
            }`}
          >
            <h2 className="font-black text-lg mb-5">🎨 Ko'rinish</h2>
            <div
              className={`flex items-center justify-between p-4 rounded-xl ${
                settings.darkMode ? "bg-slate-900" : "bg-gray-50"
              }`}
            >
              <div>
                <p className="font-bold text-sm">🌙 Qorong'i rejim</p>
                <p
                  className={`text-xs mt-1 ${
                    settings.darkMode ? "text-slate-400" : "text-gray-400"
                  }`}
                >
                  Tizimni qorong'i ko'rinishga o'tkazish
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleChange("darkMode", !settings.darkMode)}
                className={`w-12 h-7 rounded-full p-1 transition ${
                  settings.darkMode ? "bg-[#7c3aed]" : "bg-gray-300"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    settings.darkMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-7">
          <button
            type="button"
            onClick={handleReset}
            className={`px-6 py-3 rounded-xl font-bold border transition ${
              settings.darkMode
                ? "border-slate-600 text-slate-300 hover:bg-slate-800"
                : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
            }`}
          >
            ↺ Standartga qaytarish
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-7 py-3 rounded-xl bg-[#315fbd] hover:bg-[#274d9d] text-white font-bold shadow-md transition"
          >
            ✓ Sozlamalarni saqlash
          </button>
        </div>
      </div>
    </div>
  );
}