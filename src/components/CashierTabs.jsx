import React from "react";
import { NavLink } from "react-router-dom";

export default function CashierTabs() {
  const tabs = [
    {
      label: "Buyurtmalar",
      path: "/cashier/billing",
    },
    {
      label: "To'lovlar",
      path: "/cashier/payments",
    },
    {
      label: "Cheklar",
      path: "/cashier/receipts",
    },
    {
      label: "Hisobotlar",
      path: "/cashier/reports",
    },
    {
      label: "Sozlamalar",
      path: "/cashier/settings",
    },
  ];

  return (
    <div className="w-full bg-white border-b border-slate-200">
      <div className="overflow-x-auto">
        <div className="flex items-center gap-8 px-5 sm:px-10 min-w-max">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `
                relative
                shrink-0
                py-5
                text-base
                font-bold
                transition-colors
                ${
                  isActive
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }
                `
              }
            >
              {({ isActive }) => (
                <>
                  {tab.label}

                  {isActive && (
                    <span
                      className="
                        absolute
                        left-0
                        right-0
                        bottom-0
                        h-0.5
                        bg-blue-600
                        rounded-full
                      "
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}