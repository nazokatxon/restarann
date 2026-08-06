import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, UtensilsCrossed } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loadingState, setLoadingState] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoadingState(true);

    try {
      const role = await login(username, password);
      
      if (role === "bigadmin") navigate("/bigadmin/cafes");
      else if (role === "admin") navigate("/admin/analytics");
      else if (role === "waiter" || role === "ofitsiant") navigate("/waiter/tables");
      else if (role === "chef" || role === "oshpaz") navigate("/chef/queue");
      else if (role === "cashier") navigate("/cashier/billing");
      else navigate("/");
    } catch (err) {
      console.error("Login xatoligi:", err);
      setError(err.message || "Foydalanuvchi nomi yoki parol noto'g'ri!");
    } finally {
      // Muvaffaqiyatli yoki xato bo'lishidan qat'i nazar loading holatini o'chiramiz
      setLoadingState(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
        
        {/* Logo va Sarlavha */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20">
            <UtensilsCrossed size={32} />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Tizimga kirish
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Tizimga kirish uchun ma'lumotlaringizni kiriting
          </p>
        </div>

        {/* Xatolik xabari */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Foydalanuvchi nomi input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Foydalanuvchi nomi*
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="oshpaz"
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Parol input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Parol*
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-12 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Kirish tugmasi */}
          <button
            type="submit"
            disabled={loadingState}
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingState ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-500">
          Hisobingiz yo'qmi? Administratoringiz bilan bog'laning.
        </p>
      </div>
    </div>
  );
}