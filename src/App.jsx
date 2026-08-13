import React from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Login from "./pages/Login";

import CafeList from "./pages/BigAdmin/CafeList";

import Analytics from "./pages/Admin/Analytics";
import MenuManager from "./pages/Admin/MenuManager";
import StaffList from "./pages/Admin/StaffList";

import TableGrid from "./pages/Waiter/TableGrid";
import OrderForm from "./pages/Waiter/OrderForm";

import KitchenQueue from "./pages/Chef/KitchenQueue";

import Billing from "./pages/Cashier/Billing";
import Reports from "./pages/Cashier/Reports";

import ErrorBoundary from "./ErrorBoundary";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "./index.css";

// =====================================================
// PROTECTED ROUTE
// =====================================================

function ProtectedRoute({
  children,
  allowedRoles,
}) {
  const {
    user,
    role,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-5xl mb-4">
            ☕
          </div>

          <p className="text-slate-500 font-semibold">
            Yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(role)
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

// =====================================================
// ROLE REDIRECT
// =====================================================

function RoleRedirect() {
  const {
    user,
    role,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-semibold">
          Yuklanmoqda...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  switch (role) {
    case "bigadmin":
      return (
        <Navigate
          to="/bigadmin/cafes"
          replace
        />
      );

    case "admin":
      return (
        <Navigate
          to="/admin/analytics"
          replace
        />
      );

    case "waiter":
    case "ofitsiant":
      return (
        <Navigate
          to="/waiter/tables"
          replace
        />
      );

    case "chef":
    case "oshpaz":
      return (
        <Navigate
          to="/chef/queue"
          replace
        />
      );

    case "cashier":
    case "kassir":
      return (
        <Navigate
          to="/cashier/billing"
          replace
        />
      );

    default:
      return (
        <Navigate
          to="/login"
          replace
        />
      );
  }
}

// =====================================================
// CASHIER TOP NAVIGATION
// =====================================================

function CashierTopNav() {
  const location = useLocation();

  const items = [
    {
      to: "/cashier/billing",
      label: "Buyurtmalar",
    },
    {
      to: "/cashier/payments",
      label: "To'lovlar",
    },
    {
      to: "/cashier/receipts",
      label: "Cheklar",
    },
    {
      to: "/cashier/reports",
      label: "Hisobotlar",
    },
    {
      to: "/cashier/settings",
      label: "Sozlamalar",
    },
  ];

  return (
    <div className="w-full bg-white border-b border-slate-200">
      <div
        className="
          flex
          items-center
          gap-0
          px-5
          sm:px-10
          overflow-x-auto
        "
      >
        {items.map((item) => {
          const active =
            location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`
                relative
                flex
                items-center
                justify-center
                px-5
                sm:px-7
                h-16
                text-[15px]
                sm:text-[17px]
                font-bold
                whitespace-nowrap
                transition-all
                duration-200
                ${
                  active
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }
              `}
            >
              {item.label}

              {active && (
                <span
                  className="
                    absolute
                    left-0
                    right-0
                    bottom-0
                    h-[2px]
                    bg-blue-600
                    rounded-t-full
                  "
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================
// MAIN LAYOUT
// =====================================================

function MainLayout({
  children,
}) {
  const { role } = useAuth();

  const isCashier =
    role === "cashier" ||
    role === "kassir";

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER */}
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
          <Navbar />
        </header>

        {/* CASHIER TOP MENU */}
        {isCashier && (
          <div className="sticky top-[68px] z-40">
            <CashierTopNav />
          </div>
        )}

        {/* PAGE CONTENT */}
        <main className="flex-1 bg-slate-50 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

// =====================================================
// SIMPLE CASHIER PAGE
// =====================================================

function CashierSimplePage({
  title,
  description,
}) {
  return (
    <div className="w-full min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="px-5 sm:px-10 py-8">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
            {title}
          </h1>

          <p className="mt-3 text-base sm:text-lg text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <div className="bg-white border-x border-b border-slate-200 px-5 sm:px-10 py-10">
        <div className="min-h-[400px] flex items-center justify-center text-center">
          <div>
            <h2 className="text-2xl font-black text-slate-800">
              {title}
            </h2>

            <p className="mt-2 text-slate-500">
              {description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// APP ROUTES
// =====================================================

function AppRoutes() {
  return (
    <Routes>

      {/* LOGIN */}
      <Route
        path="/login"
        element={<Login />}
      />

      {/* ROOT REDIRECT */}
      <Route
        path="/"
        element={<RoleRedirect />}
      />

      {/* BIG ADMIN */}
      <Route
        path="/bigadmin/cafes"
        element={
          <ProtectedRoute
            allowedRoles={[
              "bigadmin",
            ]}
          >
            <MainLayout>
              <CafeList />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* ADMIN */}
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute
            allowedRoles={[
              "admin",
            ]}
          >
            <MainLayout>
              <Analytics />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/menu"
        element={
          <ProtectedRoute
            allowedRoles={[
              "admin",
            ]}
          >
            <MainLayout>
              <MenuManager />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute
            allowedRoles={[
              "admin",
            ]}
          >
            <MainLayout>
              <StaffList />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* WAITER (MAIN LAYOUTSIZ - ALOHIDA MOBIL KORINISH) */}
      <Route
        path="/waiter/tables"
        element={
          <ProtectedRoute
            allowedRoles={[
              "waiter",
              "ofitsiant",
            ]}
          >
            <TableGrid />
          </ProtectedRoute>
        }
      />

      <Route
        path="/waiter/order"
        element={
          <ProtectedRoute
            allowedRoles={[
              "waiter",
              "ofitsiant",
            ]}
          >
            <OrderForm />
          </ProtectedRoute>
        }
      />

      {/* CHEF (MAIN LAYOUTSIZ - ALOHIDA KORINISH) */}
      <Route
        path="/chef/queue"
        element={
          <ProtectedRoute
            allowedRoles={[
              "chef",
              "oshpaz",
            ]}
          >
            <KitchenQueue />
          </ProtectedRoute>
        }
      />

      {/* CASHIER */}
      <Route
        path="/cashier/billing"
        element={
          <ProtectedRoute
            allowedRoles={[
              "cashier",
              "kassir",
            ]}
          >
            <MainLayout>
              <Billing />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cashier/payments"
        element={
          <ProtectedRoute
            allowedRoles={[
              "cashier",
              "kassir",
            ]}
          >
            <MainLayout>
              <CashierSimplePage
                title="To'lovlar"
                description="Qabul qilingan to'lovlarni boshqarish"
              />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cashier/receipts"
        element={
          <ProtectedRoute
            allowedRoles={[
              "cashier",
              "kassir",
            ]}
          >
            <MainLayout>
              <CashierSimplePage
                title="Cheklar"
                description="Cheklar va to'lov hujjatlarini boshqarish"
              />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cashier/reports"
        element={
          <ProtectedRoute
            allowedRoles={[
              "cashier",
              "kassir",
            ]}
          >
            <MainLayout>
              <Reports />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cashier/settings"
        element={
          <ProtectedRoute
            allowedRoles={[
              "cashier",
              "kassir",
            ]}
          >
            <MainLayout>
              <CashierSimplePage
                title="Sozlamalar"
                description="Kassa sozlamalarini boshqarish"
              />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* NOT FOUND */}
      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}

// =====================================================
// APP
// =====================================================

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>

        <ErrorBoundary>
          <AppRoutes />

          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnHover
          />
        </ErrorBoundary>

      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;