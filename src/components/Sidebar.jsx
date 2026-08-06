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
} from "lucide-react";
import "./Sidebar.css";

const languages = [
  { code: "uz-latin", label: "UZ" },
  { code: "ru", label: "RU" },
];

// Har bir rol uchun pastki mobil menyuning elementlari
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
  ],
};

// Admin uchun chap tomondagi vertikal sidebar elementlari
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

  const LangSwitcher = ({ direction = "up" }) => (
    <div className="relative" ref={langRef} style={{ width: "100%", height: "100%" }}>
      <button
        onClick={() => setLangOpen(!langOpen)}
        className={`sb-lang-btn ${langOpen ? "open" : ""}`}
      >
        <span className="sb-icon-wrap">
          <Globe className="sb-icon" />
        </span>
        <span className="sb-lang-code">
          {languages.find((l) => l.code === currentLang)?.label || "UZ"}
        </span>
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

  // ========== ADMIN — CHAP TOMONDAGI VERTIKAL SIDEBAR ==========
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
                <span className="sb-nav-label">{t(key) || fallback}</span>
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
            <span className="sb-nav-label">{t("close_window") || "Chiqish"}</span>
          </button>
        </div>

        <LogoutModal />
      </>
    );
  }

  // ========== OFITSIANT / OSHPAZ / KASSIR — PASTKI GORIZONTAL MENYU ==========
  const navItems = NAV_ITEMS_BY_ROLE[role] || [];

  return (
    <>
      <div className="sb-sidebar-mobile">
        {navItems.map(({ to, match, Icon, key, fallback }) => (
          <Link
            key={to}
            to={to}
            className={`sb-nav-item-mobile ${location.pathname.includes(match) ? "active" : ""}`}
          >
            <span className="sb-icon-wrap">
              <Icon className="sb-icon" />
            </span>
            <span className="sb-nav-label-mobile">{t(key) || fallback}</span>
          </Link>
        ))}

        <div style={{ width: 76, height: "100%" }}>
          <LangSwitcher direction="up" />
        </div>

        <button onClick={() => setShowLogoutModal(true)} className="sb-nav-item-mobile" style={{ background: "none", border: "none", cursor: "pointer" }}>
          <span className="sb-icon-wrap">
            <LogOut className="sb-icon" />
          </span>
          <span className="sb-nav-label-mobile">{t("close_window") || "Oynani yopish"}</span>
        </button>
      </div>

      <LogoutModal />
    </>
  );
}