import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";

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

// =========================================================
// PROTECTED ROUTE
// =========================================================

function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();

  // Yuklanayotgan payt
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f5ef]">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-100 flex items-center justify-center">
            <span className="text-2xl">☕</span>
          </div>

          <p className="font-bold text-gray-700">
            Yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  // Login qilmagan bo'lsa
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Rol ruxsat etilmagan bo'lsa
  if (
    allowedRoles &&
    !allowedRoles.includes(role)
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// =========================================================
// ROLE REDIRECT
// =========================================================

function RoleRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Yuklanmoqda...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
      return (
        <Navigate
          to="/waiter/tables"
          replace
        />
      );

    case "chef":
      return (
        <Navigate
          to="/chef/queue"
          replace
        />
      );

    case "cashier":
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

// =========================================================
// APP ROUTES
// =========================================================

function AppRoutes() {
  return (
    <Routes>

      {/* =====================================================
          LOGIN
      ===================================================== */}

      <Route
        path="/login"
        element={<Login />}
      />

      {/* =====================================================
          BOSH SAHIFA
      ===================================================== */}

      <Route
        path="/"
        element={<RoleRedirect />}
      />

      {/* =====================================================
          BIG ADMIN
      ===================================================== */}

      <Route
        path="/bigadmin/cafes"
        element={
          <ProtectedRoute
            allowedRoles={["bigadmin"]}
          >
            <CafeList />
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          ADMIN
      ===================================================== */}

      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute
            allowedRoles={["admin"]}
          >
            <Analytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/menu"
        element={
          <ProtectedRoute
            allowedRoles={["admin"]}
          >
            <MenuManager />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute
            allowedRoles={["admin"]}
          >
            <StaffList />
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          OFITSIANT
      ===================================================== */}

      <Route
        path="/waiter/tables"
        element={
          <ProtectedRoute
            allowedRoles={["waiter"]}
          >
            <TableGrid />
          </ProtectedRoute>
        }
      />

      <Route
        path="/waiter/order"
        element={
          <ProtectedRoute
            allowedRoles={["waiter"]}
          >
            <OrderForm />
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          OSHPAZ
      ===================================================== */}

      <Route
        path="/chef/queue"
        element={
          <ProtectedRoute
            allowedRoles={["chef"]}
          >
            <KitchenQueue />
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          KASSA
      ===================================================== */}

      <Route
        path="/cashier/billing"
        element={
          <ProtectedRoute
            allowedRoles={["cashier"]}
          >
            <Billing />
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          HISOBOTLAR
          🔥 ENG MUHIM QISM
      ===================================================== */}

      <Route
        path="/cashier/reports"
        element={
          <ProtectedRoute
            allowedRoles={["cashier"]}
          >
            <Reports />
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          NOT FOUND
      ===================================================== */}

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

// =========================================================
// APP
// =========================================================

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