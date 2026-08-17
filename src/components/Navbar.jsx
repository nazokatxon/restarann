import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import AIAssistantModal from "./AIAssistantModal";
import "./Navbar.css";

export default function Navbar() {
  const { user, role, cafeName, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const profileRef = useRef(null);
  const langRef = useRef(null);

  // ==========================================================
  // TILLAR RO'YXATI
  // ==========================================================
  const languages = [
    { code: "uz", label: "O'zbek" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  const currentLang = i18n?.language || "uz";

  const handleLangChange = (code) => {
    localStorage.setItem("appLang", code);
    if (i18n?.changeLanguage) {
      i18n.changeLanguage(code);
    }
    setLangOpen(false);
  };

  // ==========================================================
  // TASHQARIGA BOSILGANDA DROPDOWNLARNI YOPISH
  // ==========================================================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setLangOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ==========================================================
  // ROLE NOMLARI (TARJIMA QILINADIGAN)
  // ==========================================================
  const roleLabels = {
    bigadmin: t("Big Admin"),
    admin: t("Direktor"),
    waiter: t("Ofitsiant"),
    ofitsiant: t("Ofitsiant"),
    chef: t("Oshpaz"),
    oshpaz: t("Oshpaz"),
    cashier: t("Kassir"),
    kassir: t("Kassir"),
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================
  const handleLogout = async () => {
    setProfileOpen(false);
    try {
      await logout();
    } catch (error) {
      console.error("Logout xatosi:", error);
    }
  };

  // ==========================================================
  // FOYDALANUVCHI MA'LUMOTLARI
  // ==========================================================
  const displayName =
    user?.displayName ||
    user?.username ||
    user?.login ||
    (user?.email ? user.email.split("@")[0] : "Profil");

  const avatarLetter = displayName?.charAt(0)?.toUpperCase() || "P";

  const isBigAdmin = role === "bigadmin";
  const isWaiter = role === "waiter" || role === "ofitsiant";
  const displayTitle = isBigAdmin ? "Control Hub" : cafeName || "";

  return (
    <>
      <nav className="lightswind-nav">
        {/* ======================================================
            CHAP TOMON: LOGO VA SARLAVHA
        ====================================================== */}
        <div className="flex items-center gap-3">
          {/* LOGO */}
          <div
            className={`brand-logo-box ${
              isBigAdmin
                ? "bg-slate-900"
                : "bg-gradient-to-tr from-amber-600 to-amber-400"
            }`}
          >
            {isBigAdmin ? (
              <span className="text-white text-lg">👑</span>
            ) : (
              <span className="text-white font-extrabold text-lg">
                {cafeName ? cafeName.trim().charAt(0).toUpperCase() : "🏢"}
              </span>
            )}
          </div>

          {/* NOMI VA VERSIYA */}
          <div className="flex items-center gap-2">
            {displayTitle && (
              <h1 className="font-extrabold text-base sm:text-lg text-slate-800 tracking-tight whitespace-nowrap">
                {displayTitle}
              </h1>
            )}

            <span
              className={`font-semibold text-[10px] px-1.5 py-0.5 rounded-md border ${
                isBigAdmin
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-amber-600 bg-amber-50 border-amber-200/60"
              }`}
            >
              {isBigAdmin ? "SYSTEM" : "v1.0"}
            </span>
          </div>
        </div>

        {/* ======================================================
            O'NG TOMON: AI, TIL VA PROFIL
        ====================================================== */}
        {!isWaiter && (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* AI ASSISTANT TUGMASI */}
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all active:scale-95"
            >
              <span className="text-sm">🤖</span>
              <span className="hidden sm:inline">AI Yordamchi</span>
            </button>

            {/* DIVIDER */}
            <div className="nav-divider" />

            {/* TIL DROPDOWNI */}
            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => {
                  setLangOpen(!langOpen);
                  setProfileOpen(false);
                }}
                className="btn-tactile"
              >
                <span>🌐</span>
                <span className="hidden sm:inline">
                  {languages.find((lang) => lang.code === currentLang)?.label ||
                    "O'zbek"}
                </span>
              </button>

              {langOpen && (
                <div className="lightswind-dropdown">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleLangChange(lang.code)}
                      className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition ${
                        currentLang === lang.code
                          ? "text-amber-600 font-bold bg-amber-50"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* DIVIDER */}
            <div className="nav-divider" />

            {/* PROFIL DROPDOWNI */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setLangOpen(false);
                }}
                className="h-9 flex items-center gap-2 pl-1.5 pr-3 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-amber-50/50 hover:border-amber-300 transition-all active:scale-95"
              >
                {/* AVATAR */}
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {avatarLetter}
                </div>

                {/* USERNAME */}
                <span className="text-[13px] font-bold text-slate-700 hidden sm:block">
                  {displayName}
                </span>
                <span className="text-xs text-slate-400">▾</span>
              </button>

              {profileOpen && (
                <div className="profile-dropdown">
                  {/* FOYDALANUVCHI MA'LUMOTI CARD */}
                  <div className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100/80 mb-2">
                    {!isBigAdmin && cafeName && (
                      <p className="text-[12px] font-extrabold text-amber-800 border-b border-amber-200/50 pb-1 mb-1 truncate">
                        🏢 {cafeName}
                      </p>
                    )}
                    <p className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">
                      LAVOZIM
                    </p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                      {isBigAdmin
                        ? "👑 Big Admin"
                        : `👨‍🍳 ${roleLabels[role] || role || "Xodim"}`}
                    </p>
                  </div>

                  {/* CHIQISH TUGMASI */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] text-red-600 font-bold bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-all duration-200 group shadow-sm active:scale-95"
                  >
                    <span>Chiqish</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                      className="w-4 h-4 text-red-500 group-hover:text-white transition-colors"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H9"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* AI ASSISTANT MODAL */}
      <AIAssistantModal
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        userRole={role}
      />
    </>
  );
}