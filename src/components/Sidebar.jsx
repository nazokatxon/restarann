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
  Plus,
  Globe,
  LogOut,
  BarChart2,
} from "lucide-react";
import "./Sidebar.css";

const languages = [
  { code: "uz-latin", label: "UZ" },
  { code: "ru", label: "RU" },
];

const NAV_ITEMS_BY_ROLE = {
  waiter: [
    { to: "/waiter/tables", match: "tables", Icon: LayoutDashboard, key: "tables_title", fallback: "Stollar" },
    { to: "/waiter/order", match: "order", Icon: Plus, key: "new_order_title", fallback: "Yangi buyurtma" },
  ],
  chef: [
    { to: "/chef/queue", match: "queue", Icon: ChefHat, key: "kitchen_queue_title", fallback: "Navbat" },
  ],
  cashier: [
    { to: "/cashier/billing", match: "billing", Icon: CreditCard, key: "billing_title", fallback: "Kassa" },
    { to: "/cashier/billing?tab=reports", match: "tab=reports", Icon: BarChart2, key: "analytics_title", fallback: "Hisobotlar" },
  ],
};

const ADMIN_NAV_ITEMS = [
  { to: "/admin/analytics", match: "analytics", Icon: LayoutDashboard, key: "analytics_title", fallback: "Analitika" },
  { to: "/admin/menu", match: "menu", Icon: ClipboardList, key: "menu_title", fallback: "Menyu" },
  { to: "/admin/staff", match: "staff", Icon: Users, key: "staff_title", fallback: "Xodimlar" },
];

export default function Sidebar() {
  const { i18n, t } = useTranslation();
  const { logout, role } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const langRef = useRef(null);
  const location = useLocation();

  const currentLang = i18n.language || localStorage.getItem("appLang") || "uz-latin";

  useEffect(() => {
    function handleClickOutside(event) {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLangChange = (code) => {
    localStorage.setItem("appLang", code);
    i18n.changeLanguage(code);
    setLangOpen(false);
    window.location.reload();
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    logout();
  };

  const getItemLabel = (key, fallback) => {
    const translated = t(key);
    return translated && translated !== key && translated.trim() !== "" ? translated : fallback;
  };

  const LangSwitcher = ({ direction = "up" }) => (
    <div className="relative flex items-center justify-center w-full" ref={langRef}>
      <button
        onClick={() => setLangOpen(!langOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-2xl font-bold text-xs text-gray-600 hover:bg-gray-100 transition ${
          langOpen ? "open" : ""
        }`}
      >
        <Globe size={18} className="text-gray-500" />
        <span className="uppercase">{languages.find((l) => l.code === currentLang)?.label || "UZ"}</span>
      </button>

      {langOpen && (
        <div className={`sb-lang-dropdown direction-${direction}`}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLangChange(lang.code)}
              className={`sb-lang-option ${currentLang === lang.code ? "selected" : ""}`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const LogoutModal = () =>
    showLogoutModal && (
      <div className="sb-modal-overlay">
        <div className="sb-modal-card">
          <div className="sb-modal-icon-wrap">
            <LogOut size={20} />
          </div>
          <h3 className="sb-modal-title">Tizimdan chiqish</h3>
          <p className="sb-modal-text">Haqiqatan ham profilingizdan chiqmoqchimisz?</p>
          <div className="sb-modal-actions">
            <button onClick={handleConfirmLogout} className="sb-btn-confirm">
              Ha, chiqish
            </button>
            <button onClick={() => setShowLogoutModal(false)} className="sb-btn-cancel">
              Yo'q, qolish
            </button>
          </div>
        </div>
      </div>
    );

  if (role === "admin") {
    return (
      <>
        <div className="sb-sidebar-desktop">
          <div className="sb-logo">
            <Coffee size={22} />
          </div>

          <div className="sb-nav-list">
            {ADMIN_NAV_ITEMS.map(({ to, match, Icon, key, fallback }) => (
              <Link
                key={to}
                to={to}
                className={`sb-nav-item ${location.pathname.includes(match) ? "active" : ""}`}
              >
                <span className="sb-icon-wrap">
                  <Icon className="sb-icon" />
                </span>
                <span className="sb-nav-label">{getItemLabel(key, fallback)}</span>
              </Link>
            ))}
          </div>

          <div style={{ width: 64, height: 64, marginBottom: 6 }}>
            <LangSwitcher direction="right" />
          </div>

          <button onClick={() => setShowLogoutModal(true)} className="sb-logout-btn" style={{ width: 64, padding: "10px 0" }}>
            <span className="sb-icon-wrap">
              <LogOut className="sb-icon" />
            </span>
            <span className="sb-nav-label">{getItemLabel("close_window", "Chiqish")}</span>
          </button>
        </div>

        <LogoutModal />
      </>
    );
  }

  const navItems = NAV_ITEMS_BY_ROLE[role] || [];

  return (
    <>
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md px-5 py-2 rounded-[28px] shadow-2xl border border-gray-100 flex items-center justify-between gap-4 min-w-[420px] max-w-[95vw]">
        
        {/* Navigatsiya tugmalari (Kassa va Hisobotlar yonma-yon) */}
        <div className="flex items-center gap-2 flex-1">
          {navItems.map(({ to, match, Icon, key, fallback }) => {
            const isActive = match.includes("tab=reports") 
              ? location.search.includes("tab=reports") 
              : !location.search.includes("tab=reports") && location.pathname.includes(match);

            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all duration-200 ${
                  isActive
                    ? "bg-[#964B00] text-white shadow-md scale-[1.02]"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon size={18} />
                <span>{getItemLabel(key, fallback)}</span>
              </Link>
            );
          })}
        </div>

        <div className="h-6 w-[1px] bg-gray-200"></div>

        {/* Til va Chiqish tugmalari */}
        <div className="flex items-center gap-1">
          <LangSwitcher direction="up" />

          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-gray-500 hover:text-red-600 hover:bg-red-50 font-bold text-xs transition"
            title="Chiqish"
          >
            <LogOut size={18} />
            <span>Chiqish</span>
          </button>
        </div>

      </div>

      <LogoutModal />
    </>
  );
}