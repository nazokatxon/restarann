import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Coffee,
  ChefHat,
  CreditCard,
  BarChart3,
  Plus,
  Globe,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";

const languages = [
  { code: "uz-latin", label: "UZ" },
  { code: "ru", label: "RU" },
];

const DESKTOP_NAV_ITEMS = {
  admin: [
    { to: "/admin/analytics", match: "analytics", Icon: LayoutDashboard, key: "analytics_title", fallback: "Analitika" },
    { to: "/admin/menu", match: "menu", Icon: ClipboardList, key: "menu_title", fallback: "Menyu" },
    { to: "/admin/staff", match: "staff", Icon: Users, key: "staff_title", fallback: "Xodimlar" },
    { to: "/reports", match: "reports", Icon: BarChart3, key: "reports_title", fallback: "Hisobotlar" },
  ],
  chef: [
    { to: "/chef/queue", match: "queue", Icon: ChefHat, key: "kitchen_queue_title", fallback: "Navbat" },
  ],
  cashier: [
    { to: "/cashier/billing", match: "billing", Icon: CreditCard, key: "billing_title", fallback: "Kassa" },
    { to: "/reports", match: "reports", Icon: BarChart3, key: "reports_title", fallback: "Hisobotlar" },
  ],
};

const WAITER_NAV_ITEMS = [
  { to: "/waiter/tables", match: "tables", Icon: LayoutDashboard, key: "tables_title", fallback: "Stollar" },
  { to: "/waiter/order", match: "order", Icon: Plus, key: "new_order_title", fallback: "Yangi buyurtma" },
];

export default function Sidebar() {
  const { i18n, t } = useTranslation();
  const { logout, role } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return (
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  const langRef = useRef(null);
  const location = useLocation();

  const currentLang = i18n.language || localStorage.getItem("appLang") || "uz-latin";

  // Dark Mode boshqaruvi
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Tashqariga bosganda til menyusini yopish
  useEffect(() => {
    function handleClickOutside(event) {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const translateLabel = (key, fallback) => {
    const translated = t(key);
    return translated && translated !== key ? translated : fallback;
  };

  const handleLangChange = (code) => {
    localStorage.setItem("appLang", code);
    i18n.changeLanguage(code);
    setLangOpen(false);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    logout();
  };

  const isWaiter = role === "waiter";
  const navItems = isWaiter ? WAITER_NAV_ITEMS : (DESKTOP_NAV_ITEMS[role] || []);

  // Til tanlash komponenti
  const LangSwitcher = () => (
    <div className="relative" ref={langRef}>
      <button
        onClick={() => setLangOpen(!langOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold backdrop-blur-md transition-all active:scale-95 w-full justify-center"
      >
        <Globe className="w-3.5 h-3.5 text-amber-400" />
        <span>{languages.find((l) => l.code === currentLang)?.label || "UZ"}</span>
      </button>
      {langOpen && (
        <div className={`absolute bg-slate-900/95 border border-amber-500/30 backdrop-blur-xl rounded-xl p-1 shadow-2xl flex flex-col gap-1 z-50 min-w-[75px] ${
          isWaiter ? "bottom-full mb-2 left-1/2 -translate-x-1/2" : "bottom-full mb-2 left-0 w-full"
        }`}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLangChange(lang.code)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                currentLang === lang.code
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-amber-100 hover:bg-amber-500/20"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Chiqish Modali
  const LogoutModal = () =>
    showLogoutModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
        <div className="bg-slate-900/95 border border-amber-500/30 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl text-amber-50">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-400">
            <LogOut size={22} />
          </div>
          <h3 className="text-lg font-bold font-serif mb-1 text-amber-200">Tizimdan chiqish</h3>
          <p className="text-xs text-amber-100/70 mb-6">Haqiqatan ham profilingizdan chiqmoqchimisz?</p>
          <div className="flex gap-3">
            <button
              onClick={handleConfirmLogout}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-700 to-amber-900 hover:brightness-110 text-white text-xs font-bold transition active:scale-95 border border-amber-400/30 shadow-lg"
            >
              Ha, chiqish
            </button>
            <button
              onClick={() => setShowLogoutModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active:scale-95 border border-slate-700"
            >
              Yo'q, qolish
            </button>
          </div>
        </div>
      </div>
    );

  // 1. OFITSIANT ROʻLI UCHUN PASTDAGI SUZUVCHI MENYU
  if (isWaiter) {
    return (
      <>
        <aside className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl">
          <nav className="bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-xl border border-amber-500/30 rounded-2xl px-3 py-2 shadow-2xl shadow-black/50 flex items-center justify-between gap-1.5">
            <div className="hidden sm:flex items-center gap-2 pl-1 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                <Coffee size={18} />
              </div>
              <span className="text-xs font-serif font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 hidden md:inline">
                BISTRO
              </span>
            </div>
            <div className="flex items-center justify-center gap-1 flex-1">
              {navItems.map(({ to, match, Icon, key, fallback }) => {
                const isActive = location.pathname.includes(match);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`relative flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all duration-300 group ${
                      isActive
                        ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-inner"
                        : "text-slate-400 hover:text-amber-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? "scale-110 text-amber-400" : "group-hover:scale-105"}`} />
                    <span className="text-[10px] tracking-wide mt-0.5 whitespace-nowrap">
                      {translateLabel(key, fallback)}
                    </span>
                    {isActive && (
                      <span className="absolute -bottom-1 w-2.5 h-0.5 bg-amber-400 rounded-full blur-[1px]" />
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pl-1.5 border-l border-amber-500/20">
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition active:scale-95"
                title={isDark ? "Yorug' rejim" : "Tungi rejim"}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-300" />}
              </button>

              <LangSwitcher />

              <button
                onClick={() => setShowLogoutModal(true)}
                className="p-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition active:scale-95 border border-rose-500/20"
                title={translateLabel("close_window", "Chiqish")}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </nav>
        </aside>
        <LogoutModal />
      </>
    );
  }

  // 2. ADMIN, KASSIR VA OSHPAZ UCHUN YONBO'LMA (SIDEBAR)
  return (
    <>
      <aside className="w-64 h-screen bg-slate-950/90 backdrop-blur-xl border-r border-amber-500/20 p-4 flex flex-col justify-between shrink-0 sticky top-0 z-40">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-amber-500/10">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Coffee size={20} />
            </div>
            <span className="text-base font-serif font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
              BISTRO
            </span>
          </div>

          {/* Menyu ro'yxati */}
          <nav className="space-y-1.5">
            {navItems.map(({ to, match, Icon, key, fallback }) => {
              const isActive = location.pathname.includes(match);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-xs font-semibold ${
                    isActive
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-inner"
                      : "text-slate-400 hover:text-amber-200 hover:bg-slate-800/40"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : ""}`} />
                  <span>{translateLabel(key, fallback)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        {/* Pastki boshqaruv tugmalari */}
        <div className="space-y-2 pt-4 border-t border-amber-500/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition active:scale-95"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-300" />}
              <span>{isDark ? "Yorug'" : "Tungi"}</span>
            </button>

            <div className="flex-1">
              <LangSwitcher />
            </div>
          </div>

          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition active:scale-95 border border-rose-500/20 text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>{translateLabel("close_window", "Chiqish")}</span>
          </button>
        </div>
      </aside>

      <LogoutModal />
    </>
  );
}