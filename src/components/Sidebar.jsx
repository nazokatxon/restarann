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
  // ========================================================

  cashier: [
    {
      to: "/cashier/orders",
      match: "orders",
      icon: "🧾",
      key: "orders_title",
      fallback: "Buyurtmalar",
    },

    {
      to: "/cashier/payments",
      match: "payments",
      icon: "💳",
      key: "payments_title",
      fallback: "To'lovlar",
    },

    {
      to: "/cashier/menu",
      match: "menu",
      icon: "📋",
      key: "menu_title",
      fallback: "Menyu",
    },
  ],

  // ========================================================
  // KASSIR
  // ========================================================

  kassir: [
    {
      to: "/cashier/orders",
      match: "orders",
      icon: "🧾",
      key: "orders_title",
      fallback: "Buyurtmalar",
    },

    {
      to: "/cashier/payments",
      match: "payments",
      icon: "💳",
      key: "payments_title",
      fallback: "To'lovlar",
    },

    {
      to: "/cashier/menu",
      match: "menu",
      icon: "📋",
      key: "menu_title",
      fallback: "Menyu",
    },
  ],
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
    role,
  } = useAuth();

  const location = useLocation();

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

        <div
          className={`sb-logo-icon ${
            role === "admin"
              ? "text-sky-500"
              : ""
          }`}
        >
          {role === "admin" ? "A" : "☕"}
        </div>

        <span className="sb-logo-text">
          {role === "admin"
            ? "Admin"
            : "AI Cafe"}
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

      </nav>

    </>
  );
}