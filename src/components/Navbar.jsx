import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";

export default function Navbar() {
  const { user, role, cafeName, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef(null);
  const langRef = useRef(null);

  // Tashqariga bosganda menyularni yopish
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const languages = [
    { code: "uz", label: "O'zbek" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  const currentLang = i18n?.language || "uz";

  const handleLangChange = (code) => {
    if (i18n?.changeLanguage) {
      i18n.changeLanguage(code);
    }
    setLangOpen(false);
  };

  const roleLabels = {
    bigadmin: t("Big Admin"),
    admin: t("Direktor"),
    waiter: t("Ofitsiant"),
    chef: t("Oshpaz"),
    cashier: t("Kassir"),
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
  };

  const displayName = user?.displayName || user?.username || (user?.email ? user.email.split("@")[0] : "Profil");
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const isBigAdmin = role === "bigadmin";
  const isWaiter = role === "waiter";
  const displayTitle = isBigAdmin ? "Control Hub" : (cafeName || "");

  return (
    <nav className="w-full h-16 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-xs">
      {/* Logotip va Sarlavha */}
      <div className="flex items-center gap-3">
        {/* Kvadrat block */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0 ${
          isBigAdmin 
            ? "bg-slate-900 shadow-slate-900/30"
            : "bg-gradient-to-tr from-amber-600 to-amber-400 shadow-amber-500/20"
        }`}>
          {isBigAdmin ? (
            <svg 
              className="w-6 h-6 text-amber-400 drop-shadow-[0_2px_4px_rgba(251,191,36,0.4)]" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
            </svg>
          ) : (
            <span className="text-white font-black text-base">
              {cafeName ? cafeName.trim().charAt(0).toUpperCase() : "🏢"}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {displayTitle && (
            <h1 className="font-extrabold text-base sm:text-lg text-slate-800 tracking-tight whitespace-nowrap">
              {displayTitle}
            </h1>
          )}
          <span className={`font-semibold text-[10px] px-1.5 py-0.5 rounded-md border ${
            isBigAdmin
              ? "text-amber-700 bg-amber-50 border-amber-200"
              : "text-amber-600 bg-amber-50 border-amber-200/60"
          }`}>
            {isBigAdmin ? "SYSTEM" : "v1.0"}
          </span>
        </div>
      </div>

      {/* O'ng tomon paneli (Ofitsiant bo'lsa yashiriladi) */}
      {!isWaiter && (
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Til tanlash */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => { setLangOpen(!langOpen); setProfileOpen(false); }}
              className="h-9 flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[13px] font-semibold text-slate-700 transition-all active:scale-95"
            >
              🌐 <span className="hidden sm:inline">{languages.find((l) => l.code === currentLang)?.label || "O'zbek"}</span>
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-slate-100 p-1.5 z-50">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLangChange(lang.code)}
                    className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition ${
                      currentLang === lang.code ? "text-amber-600 font-bold bg-amber-50" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-[1px] h-5 bg-slate-200" />

          {/* Profil boshqaruvi */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setProfileOpen(!profileOpen); setLangOpen(false); }}
              className="h-9 flex items-center gap-2 pl-1.5 pr-3 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-amber-50/50 hover:border-amber-300 transition-all active:scale-95"
            >
              <div className="w-6.5 h-6.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {avatarLetter}
              </div>
              <span className="text-[13px] font-bold text-slate-700 hidden sm:block">
                {displayName}
              </span>
            </button>

            {/* Dropdown Menyu */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50">
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
                    {isBigAdmin ? "👑 Big Admin" : `👨‍🍳 ${roleLabels[role] || role || "Xodim"}`}
                  </p>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] text-red-600 font-bold bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-all duration-200 group shadow-xs active:scale-95"
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
  );
}