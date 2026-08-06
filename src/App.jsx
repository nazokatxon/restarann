import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import CafeList from "./pages/BigAdmin/CafeList";
import Analytics from "./pages/Admin/Analytics";
import MenuManager from "./pages/Admin/MenuManager";
import StaffList from "./pages/Admin/StaffList";
import TableGrid from "./pages/Waiter/TableGrid";
import OrderForm from "./pages/Waiter/OrderForm";
import KitchenQueue from "./pages/Chef/KitchenQueue";
import Billing from "./pages/Cashier/Billing";
import ErrorBoundary from "./ErrorBoundary";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from "./components/Sidebar";
import "./index.css"; 

function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg font-semibold">Yuklanmoqda...</p>
      </div>
    );
  }

  if (!user || (allowedRoles && !allowedRoles.includes(role))) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {/* BU YERDAGI <Navbar /> O'CHIRILDI! 
        Chunki sahifalaringiz ichida allaqachon Navbar chaqirilgan.
      */}
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-1">
          {(role === "admin" || role === "waiter") && <Sidebar />}
          <div className="flex-1 p-4 bg-[#FDFBF7]">
            {children}
          </div>
        </div>
      </div>
      {/* Xabarnomalar oynasi */}
      <ToastContainer position="top-right" autoClose={4000} theme="colored" />
    </>
  );
}

// Foydalanuvchi rolga qarab bosh sahifaga yo'naltiriladi
function RoleRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  switch (role) {
    case "bigadmin":
      return <Navigate to="/bigadmin/cafes" replace />;
    case "admin":
      return <Navigate to="/admin/menu" replace />;
    case "waiter":
      return <Navigate to="/waiter/tables" replace />;
    case "chef":
      return <Navigate to="/chef/queue" replace />;
    case "cashier":
      return <Navigate to="/cashier/billing" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function AppRoutes() {
  return (
    <Routes>
      {/* Kirish sahifasi */}
      <Route path="/login" element={<Login />} />

      {/* Bosh sahifa - rolga qarab yo'naltirish */}
      <Route path="/" element={<RoleRedirect />} />

      {/* Big Admin paneli */}
      <Route
        path="/bigadmin/cafes"
        element={
          <ProtectedRoute allowedRoles={["bigadmin"]}>
            <CafeList />
          </ProtectedRoute>
        }
      />

      {/* Admin paneli */}
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/menu"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <MenuManager />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StaffList />
          </ProtectedRoute>
        }
      />

      {/* Ofitsiant paneli */}
      <Route
        path="/waiter/tables"
        element={
          <ProtectedRoute allowedRoles={["waiter"]}>
            <TableGrid />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiter/order"
        element={
          <ProtectedRoute allowedRoles={["waiter"]}>
            <OrderForm />
          </ProtectedRoute>
        }
      />

      {/* Oshpaz paneli */}
      <Route
        path="/chef/queue"
        element={
          <ProtectedRoute allowedRoles={["chef"]}>
            <KitchenQueue />
          </ProtectedRoute>
        }
      />

      {/* Kassa paneli */}
      <Route
        path="/cashier/billing"
        element={
          <ProtectedRoute allowedRoles={["cashier"]}>
            <Billing />
          </ProtectedRoute>
        }
      />

      {/* Nomaʼlum manzillar uchun bosh sahifaga qaytarish */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;