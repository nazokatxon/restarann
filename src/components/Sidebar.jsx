import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

// ==========================================================
// LANGUAGES
// ==========================================================

const languages = [
  { code: "uz", label: "UZ" },
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
];

// ==========================================================
// ADMIN NAV
// ==========================================================

const ADMIN_NAV_ITEMS = [
  {
    to: "/admin/menu",
    match: "menu",
    icon: "📋",
    key: "menu_title",
    fallback: "Menyu",
  },
  {
    to: "/admin/staff",
    match: "staff",
    icon: "👥",
    key: "staff_title",
    fallback: "Xodimlar",
  },
  {
    to: "/admin/reports",
    match: "reports",
    icon: "📈",
    key: "reports_title",
    fallback: "Hisobotlar",
  },
];

// ==========================================================
// OTHER ROLE NAVIGATION
// ==========================================================

const NAV_ITEMS_BY_ROLE = {
  // WAITER
  waiter: [
    {
      to: "/waiter/tables",
      match: "tables",
      icon: "🪑",
      key: "tables_title",
      fallback: "Stollar",
    },
    {
      to: "/waiter/order",
      match: "order",
      icon: "➕",
      key: "new_order_title",
      fallback: "Yangi buyurtma",
    },
  ],
  ofitsiant: [
    {
      to: "/waiter/tables",
      match: "tables",
      icon: "🪑",
      key: "tables_title",
      fallback: "Stollar",
    },
    {
      to: "/waiter/order",
      match: "order",
      icon: "➕",
      key: "new_order_title",
      fallback: "Yangi buyurtma",
    },
  ],

  // CHEF
  chef: [
    {
      to: "/chef/queue",
      match: "queue",
      icon: "👨‍🍳",
      key: "kitchen_queue_title",
      fallback: "Navbat",
    },
  ],
  oshpaz: [
    {
      to: "/chef/queue",
      match: "queue",
      icon: "👨‍🍳",
      key: "kitchen_queue_title",
      fallback: "Navbat",
    },
  ],

  // CASHIER / KASSIR -> Bo'sh massiv (Menyu bo'limlari olib tashlandi)
  cashier: [],
  kassir: [],
};

// ==========================================================
// SIDEBAR
// ==========================================================

export default function Sidebar() {
  const { i18n, t } = useTranslation();
  const { role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // TRANSLATION
  const getItemLabel = (key, fallback) => {
    try {
      const translated = t(key);
      if (
        translated &&
        translated !== key &&
        translated.trim() !== ""
      ) {
        return translated;
      }
    } catch {
      // fallback
    }
    return fallback;
  };

  // ACTIVE CHECK
  const isItemActive = (item) => location.pathname === item.to;

  // CHIQISH FUNKSIYASI
  const handleLogout = async () => {
    try {
      if (logout) {
        await logout();
      }
      navigate("/login");
    } catch (error) {
      console.error("Chiqishda xatolik:", error);
    }
  };

  // LOGO
  const CafeLogo = () => (
    <div className="sb-logo">
      <div
        className={`sb-logo-icon ${
          role === "admin" ? "text-sky-500" : ""
        }`}
      >
        {role === "admin" ? "A" : "☕"}
      </div>
      <span className="sb-logo-text">
        {role === "admin" ? "Admin" : "AI Cafe"}
      </span>
    </div>
  );

  // NAV ITEM
  const NavItem = ({ item, mobile = false }) => {
    const active = isItemActive(item);

    return (
      <Link
        to={item.to}
        className={
          mobile
            ? `sb-nav-item-mobile ${active ? "active" : ""}`
            : `sb-nav-item ${active ? "active" : ""}`
        }
      >
        <span className="sb-icon-wrap">
          <span className="sb-icon">{item.icon}</span>
        </span>
        <span className={mobile ? "sb-nav-label-mobile" : "sb-nav-label"}>
          {getItemLabel(item.key, item.fallback)}
        </span>
      </Link>
    );
  };

  // ITEMS SELECTOR
  let navItems = [];
  if (role === "admin") {
    navItems = ADMIN_NAV_ITEMS;
  } else if (role === "bigadmin") {
    navItems = [
      {
        to: "/bigadmin/cafes",
        match: "cafes",
        icon: "☕",
        key: "cafes_title",
        fallback: "Kafelar",
      },
    ];
  } else {
    navItems = NAV_ITEMS_BY_ROLE[role] || [];
  }

  return (
    <>
      {/* ================================================
          DESKTOP SIDEBAR
      ================================================ */}
      <aside className="sb-sidebar-desktop flex flex-col justify-between h-screen p-4 border-r border-slate-200 bg-white">
        {/* TEPASI: LOGO VA ROLLAR UCHUN NAVIGATSIYA */}
        <div>
          <CafeLogo />
          <nav className="sb-nav-list mt-6 space-y-1">
            {navItems.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </nav>
        </div>

        {/* ENG PASTKI QISM: CHIQISH TUGMASI */}
        <div className="border-t border-slate-100 pt-4 mt-auto">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-red-500 transition hover:bg-red-50 cursor-pointer"
          >
            <span className="text-lg">🚪</span>
            <span>{getItemLabel("logout", "Chiqish")}</span>
          </button>
        </div>
      </aside>

      {/* ================================================
          MOBILE
      ================================================ */}
      {navItems.length > 0 && (
        <nav className="sb-sidebar-mobile">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} mobile />
          ))}
        </nav>
      )}
    </>
  );
}