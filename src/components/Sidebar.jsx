import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";

import "./Sidebar.css";

// ==========================================================
// LANGUAGES
// ==========================================================

const languages = [
  {
    code: "uz",
    label: "UZ",
  },
  {
    code: "ru",
    label: "RU",
  },
  {
    code: "en",
    label: "EN",
  },
];

// ==========================================================
// ADMIN
// ==========================================================

const ADMIN_NAV_ITEMS = [
  {
    to: "/admin/analytics",
    match: "analytics",
    icon: "📊",
    key: "analytics_title",
    fallback: "Analitika",
  },

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
];

// ==========================================================
// OTHER ROLE NAVIGATION
// ==========================================================

const NAV_ITEMS_BY_ROLE = {

  // ========================================================
  // WAITER
  // ========================================================

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

  // ========================================================
  // CHEF
  // ========================================================

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

  // ========================================================
  // CASHIER
  //
  // MUHIM:
  // Kassirning menyulari BU YERDA YO'Q.
  //
  // Ular App.jsx ichidagi CashierTopNav'da.
  // ========================================================

  cashier: [],

  kassir: [],
};

// ==========================================================
// SIDEBAR
// ==========================================================

export default function Sidebar() {

  const {
    i18n,
    t,
  } = useTranslation();

  const {
    logout,
    role,
  } = useAuth();

  const location = useLocation();

  const [
    langOpen,
    setLangOpen,
  ] = useState(false);

  const [
    showLogoutModal,
    setShowLogoutModal,
  ] = useState(false);

  const langRef = useRef(null);

  // ========================================================
  // OUTSIDE CLICK
  // ========================================================

  useEffect(() => {

    const handleClickOutside = (
      event
    ) => {

      if (
        langRef.current &&
        !langRef.current.contains(
          event.target
        )
      ) {
        setLangOpen(false);
      }

    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {

      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );

    };

  }, []);

  // ========================================================
  // LANGUAGE
  // ========================================================

  const currentLang =
    i18n?.language || "uz";

  const handleLangChange = (
    code
  ) => {

    localStorage.setItem(
      "appLang",
      code
    );

    if (
      i18n &&
      typeof i18n.changeLanguage ===
        "function"
    ) {

      i18n.changeLanguage(code);

    }

    setLangOpen(false);
  };

  // ========================================================
  // LOGOUT
  // ========================================================

  const handleConfirmLogout =
    async () => {

      setShowLogoutModal(false);

      try {

        await logout();

      } catch (error) {

        console.error(
          "Logout xatosi:",
          error
        );

      }

    };

  // ========================================================
  // TRANSLATION
  // ========================================================

  const getItemLabel = (
    key,
    fallback
  ) => {

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

  // ========================================================
  // ACTIVE
  // ========================================================

  const isItemActive = (
    item
  ) => {

    return (
      location.pathname === item.to
    );

  };

  // ========================================================
  // LOGO
  // ========================================================

  const CafeLogo = () => {

    return (
      <div className="sb-logo">

        <div className="sb-logo-icon">
          ☕
        </div>

        <span className="sb-logo-text">
          AI Cafe
        </span>

      </div>
    );

  };

  // ========================================================
  // NAV ITEM
  // ========================================================

  const NavItem = ({
    item,
    mobile = false,
  }) => {

    const active =
      isItemActive(item);

    return (

      <Link
        to={item.to}
        className={
          mobile
            ? `sb-nav-item-mobile ${
                active
                  ? "active"
                  : ""
              }`
            : `sb-nav-item ${
                active
                  ? "active"
                  : ""
              }`
        }
      >

        <span className="sb-icon-wrap">

          <span className="sb-icon">
            {item.icon}
          </span>

        </span>

        <span
          className={
            mobile
              ? "sb-nav-label-mobile"
              : "sb-nav-label"
          }
        >
          {getItemLabel(
            item.key,
            item.fallback
          )}
        </span>

      </Link>

    );

  };

  // ========================================================
  // LANGUAGE SWITCHER
  // ========================================================

  const LangSwitcher = ({
    direction = "right",
    mobile = false,
  }) => {

    return (

      <div
        ref={
          mobile
            ? undefined
            : langRef
        }
        className="sb-lang-container"
      >

        <button
          type="button"
          onClick={() =>
            setLangOpen(
              !langOpen
            )
          }
          className="sb-lang-btn"
        >

          <span className="sb-icon-wrap">

            <span className="sb-icon">
              🌐
            </span>

          </span>

          <span className="sb-lang-code">

            {languages.find(
              (lang) =>
                lang.code ===
                currentLang
            )?.label || "UZ"}

          </span>

        </button>

        {langOpen && (

          <div
            className={`sb-lang-dropdown direction-${direction}`}
          >

            {languages.map(
              (lang) => (

                <button
                  key={lang.code}
                  type="button"
                  onClick={() =>
                    handleLangChange(
                      lang.code
                    )
                  }
                  className={`sb-lang-option ${
                    currentLang ===
                    lang.code
                      ? "selected"
                      : ""
                  }`}
                >

                  {lang.label}

                </button>

              )
            )}

          </div>

        )}

      </div>

    );

  };

  // ========================================================
  // LOGOUT BUTTON
  // ========================================================

  const LogoutButton = ({
    mobile = false,
  }) => {

    return (

      <button
        type="button"
        onClick={() =>
          setShowLogoutModal(
            true
          )
        }
        className={
          mobile
            ? "sb-mobile-logout"
            : "sb-logout-btn"
        }
      >

        <span className="sb-icon-wrap">

          <span className="sb-icon">
            🚪
          </span>

        </span>

        <span
          className={
            mobile
              ? "sb-nav-label-mobile"
              : "sb-nav-label"
          }
        >
          Chiqish
        </span>

      </button>

    );

  };

  // ========================================================
  // LOGOUT MODAL
  // ========================================================

  const LogoutModal = () => {

    if (!showLogoutModal) {
      return null;
    }

    return (

      <div className="sb-modal-overlay">

        <div className="sb-modal-card">

          <div className="sb-modal-icon-wrap">
            🚪
          </div>

          <h2 className="sb-modal-title">
            Tizimdan chiqish
          </h2>

          <p className="sb-modal-text">
            Haqiqatan ham profilingizdan
            chiqmoqchimisiz?
          </p>

          <div className="sb-modal-actions">

            <button
              type="button"
              onClick={() =>
                setShowLogoutModal(
                  false
                )
              }
              className="sb-btn-cancel"
            >
              Yo'q, qolish
            </button>

            <button
              type="button"
              onClick={
                handleConfirmLogout
              }
              className="sb-btn-confirm"
            >
              Ha, chiqish
            </button>

          </div>

        </div>

      </div>

    );

  };

  // ========================================================
  // ITEMS
  // ========================================================

  let navItems = [];

  if (role === "admin") {

    navItems =
      ADMIN_NAV_ITEMS;

  } else if (
    role === "bigadmin"
  ) {

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

    navItems =
      NAV_ITEMS_BY_ROLE[
        role
      ] || [];

  }

  // ========================================================
  // RETURN
  // ========================================================

  return (
    <>

      {/* ================================================
          DESKTOP SIDEBAR
      ================================================ */}

      <aside className="sb-sidebar-desktop">

        <CafeLogo />

        {/* 
          Kassirda navItems = []
          Shuning uchun bu yerda:
          
          Buyurtmalar
          To'lovlar
          Cheklar
          Hisobotlar
          Sozlamalar

          CHIQMAYDI.
        */}

        <nav className="sb-nav-list">

          {navItems.map(
            (item) => (

              <NavItem
                key={item.to}
                item={item}
              />

            )
          )}

        </nav>

        <div className="sb-bottom">

          <LangSwitcher />

          <LogoutButton />

        </div>

      </aside>

      {/* ================================================
          MOBILE
      ================================================ */}

      <nav className="sb-sidebar-mobile">

        {navItems.map(
          (item) => (

            <NavItem
              key={item.to}
              item={item}
              mobile
            />

          )
        )}

        <LogoutButton mobile />

      </nav>

      {/* ================================================
          LOGOUT MODAL
      ================================================ */}

      <LogoutModal />

    </>
  );
}