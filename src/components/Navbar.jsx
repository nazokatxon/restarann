import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";

import "./Navbar.css";

export default function Navbar() {
  const { user, role, cafeName, logout } = useAuth();
  const { i18n } = useTranslation();

  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef(null);
  const langRef = useRef(null);

  // ==========================================================
  // TILLAR RO'YXATI
  // ==========================================================

  const languages = [
    {
      code: "uz",
      label: "O'zbek",
    },
    {
      code: "ru",
      label: "Русский",
    },
    {
      code: "en",
      label: "English",
    },
  ];

  const currentLang = i18n?.language || "uz";

  // ==========================================================
  // TILNI O'ZGARTIRISH
  // ==========================================================

  const handleLangChange = (code) => {
    localStorage.setItem("appLang", code);

    if (
      i18n &&
      typeof i18n.changeLanguage === "function"
    ) {
      i18n.changeLanguage(code);
    }

    setLangOpen(false);
  };

  // ==========================================================
  // TASHQARIGA BOSILGANDA DROPDOWNLARNI YOPISH
  // ==========================================================

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }

      if (
        langRef.current &&
        !langRef.current.contains(event.target)
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
    (user?.email
      ? user.email.split("@")[0]
      : "Profil");

  const avatarLetter =
    displayName?.charAt(0)?.toUpperCase() || "A";

  const isBigAdmin = role === "bigadmin";

  const isWaiter =
    role === "waiter" ||
    role === "ofitsiant";

  return (
    <nav className="lightswind-nav">

      {/* ======================================================
          O'NG TOMON: TIL + ADMIN
      ====================================================== */}

      {!isWaiter && (
        <div className="ml-auto flex items-center gap-2 sm:gap-3">

          {/* ==================================================
              TIL DROPDOWNI
          ================================================== */}

          <div
            className="relative"
            ref={langRef}
          >

            {/* TIL TUGMASI */}

            <button
              type="button"
              onClick={() => {
                setLangOpen(!langOpen);
                setProfileOpen(false);
              }}
              className="
                h-9
                flex
                items-center
                gap-2
                px-3
                rounded-xl
                border
                border-sky-200
                bg-sky-50
                text-sky-600
                hover:bg-sky-100
                hover:border-sky-300
                transition-all
                active:scale-95
                shadow-sm
              "
            >

              <span className="text-sm">
                🌐
              </span>

              <span className="hidden sm:inline text-[13px] font-bold">
                {languages.find(
                  (lang) =>
                    lang.code ===
                    currentLang
                )?.label || "O'zbek"}
              </span>

              <span
                className={`
                  text-[10px]
                  text-sky-400
                  transition-transform
                  duration-200
                  ${
                    langOpen
                      ? "rotate-180"
                      : ""
                  }
                `}
              >
                ▾
              </span>

            </button>

            {/* ==================================================
                TIL MENYUSI
            ================================================== */}

            {langOpen && (
              <div
                className="
                  absolute
                  top-full
                  right-0
                  mt-2
                  w-44
                  bg-white
                  rounded-2xl
                  border
                  border-slate-100
                  shadow-xl
                  shadow-slate-200/70
                  p-1.5
                  z-[9999]
                "
              >

                <div className="px-3 pt-2 pb-1.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Tilni tanlang
                  </p>
                </div>

                <div className="space-y-1">

                  {languages.map(
                    (lang) => {
                      const selected =
                        currentLang ===
                        lang.code;

                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() =>
                            handleLangChange(
                              lang.code
                            )
                          }
                          className={`
                            w-full
                            flex
                            items-center
                            justify-between
                            px-3
                            py-2.5
                            rounded-xl
                            text-left
                            transition-all
                            duration-200
                            ${
                              selected
                                ? "bg-sky-50 text-sky-600"
                                : "text-slate-600 hover:bg-slate-50 hover:text-sky-600"
                            }
                          `}
                        >

                          <span className="flex items-center gap-2.5">

                            <span
                              className={`
                                w-8
                                h-8
                                rounded-lg
                                flex
                                items-center
                                justify-center
                                text-[10px]
                                font-black
                                transition-all
                                ${
                                  selected
                                    ? "bg-sky-400 text-white shadow-sm"
                                    : "bg-slate-100 text-slate-500"
                                }
                              `}
                            >
                              {lang.code.toUpperCase()}
                            </span>

                            <span className="text-[13px] font-bold">
                              {lang.label}
                            </span>

                          </span>

                          {selected && (
                            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-500 flex items-center justify-center text-xs font-black">
                              ✓
                            </span>
                          )}

                        </button>
                      );
                    }
                  )}

                </div>

              </div>
            )}

          </div>

          {/* DIVIDER */}

          <div className="nav-divider" />

          {/* ==================================================
              ADMIN / PROFIL
          ================================================== */}

          <div
            className="relative"
            ref={profileRef}
          >

            {/* ADMIN TUGMASI */}

            <button
              type="button"
              onClick={() => {
                setProfileOpen(
                  !profileOpen
                );

                setLangOpen(false);
              }}
              className="
                h-9
                flex
                items-center
                gap-2
                pl-1.5
                pr-3
                rounded-xl
                border
                border-sky-200
                bg-sky-50
                hover:bg-sky-100
                hover:border-sky-300
                transition-all
                active:scale-95
                shadow-sm
              "
            >

              <div
                className="
                  w-6
                  h-6
                  rounded-lg
                  bg-sky-400
                  text-white
                  flex
                  items-center
                  justify-center
                  text-xs
                  font-black
                  shadow-sm
                "
              >
                {avatarLetter}
              </div>

              <span className="text-[13px] font-bold text-sky-600 hidden sm:block">
                {displayName}
              </span>

              <span className="text-xs text-sky-400">
                ▾
              </span>

            </button>

            {/* ==================================================
                ADMIN DROPDOWN
            ================================================== */}

            {profileOpen && (
              <div
                className="
                  absolute
                  top-full
                  right-0
                  mt-2
                  w-40
                  bg-white
                  rounded-2xl
                  border
                  border-slate-100
                  shadow-xl
                  shadow-slate-200/70
                  p-1.5
                  z-[9999]
                "
              >

                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    w-full
                    flex
                    items-center
                    justify-between
                    px-3.5
                    py-2.5
                    text-[13px]
                    text-red-600
                    font-bold
                    bg-red-50
                    hover:bg-red-600
                    hover:text-white
                    rounded-xl
                    transition-all
                    duration-200
                    group
                    shadow-sm
                    active:scale-95
                  "
                >

                  <span>
                    Chiqish
                  </span>

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="
                      w-4
                      h-4
                      text-red-500
                      group-hover:text-white
                      transition-colors
                    "
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