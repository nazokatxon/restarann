import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";

export default function Navbar() {
  const { user, role, logout } = useAuth();
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <nav className="w-full h-16 flex items-center justify-between px-6 bg-white border-b border-slate-100 sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-base">G</span>
        </div>
        <span className="font-semibold text-[15px] text-slate-900 tracking-tight">
          Gusto <span className="text-slate-400 font-normal text-xs ml-0.5">v1.0</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Profil */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="h-9 flex items-center gap-2 pl-2 pr-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all"
          >
            <div className="w-6.5 h-6.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center text-xs font-bold uppercase">
              {user?.email?.charAt(0) || "U"}
            </div>
            <span className="text-[13px] font-medium text-slate-700 hidden sm:block">
              {user?.email ? user.email.split("@")[0] : t("Profil")}
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-100 p-1 z-50">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("Lavozim")}</p>
                <p className="text-[13px] font-medium text-slate-800 mt-0.5">
                  {roleLabels[role] || t("Foydalanuvchi")}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 font-medium rounded-lg hover:bg-red-50/60 transition-colors"
              >
                {t("Chiqish")}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}