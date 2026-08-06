import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Input from "../components/Input.jsx";
import Button from "../components/Button.jsx";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config.js";

// App.jsx faylingizdagi aniq boshlang'ich yo'nalishlar (Redirect manzillari)
const ROLE_ROUTES = {
  bigadmin: "/bigadmin/cafes",
  admin: "/admin/menu",
  waiter: "/waiter/tables",
  chef: "/chef/queue",
  cashier: "/cashier/billing",
};

const ERROR_MESSAGES = {
  "auth/invalid-email": "Login noto'g'ri formatda.",
  "auth/user-disabled": "Bu hisob bloklangan. Administrator bilan bog'laning.",
  "auth/user-not-found": "Bunday foydalanuvchi topilmadi.",
  "auth/wrong-password": "Parol noto'g'ri.",
  "auth/invalid-credential": "Login yoki parol noto'g'ri.",
  "auth/too-many-requests": "Juda ko'p urinish. Birozdan so'ng qayta urining.",
  default: "Kirishda xatolik yuz berdi. Qaytadan urinib ko'ring.",
};

// Foydalanuvchi kiritgan matnni Firebase kutadigan email formatiga aylantiradi.
// Agar u allaqachon email bo'lsa (masalan bigadmin@gmail.com), o'zgartirmasdan qoldiradi.
// Agar oddiy login bo'lsa (masalan "ali123"), avtomatik "@kafe.com" qo'shadi.
function toFirebaseEmail(rawInput) {
  const trimmed = rawInput.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@kafe.com`;
}

export default function Login() {
  const navigate = useNavigate();
  const { login, setAuthData } = useAuth(); // setAuthData context'da holatni qo'lda yangilash uchun (agar mavjud bo'lsa)

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  function validate() {
    const next = {};
    if (!username.trim()) next.username = "Login kiritilishi shart";
    if (!password) next.password = "Parol kiritilishi shart";
    else if (password.length < 6) next.password = "Parol kamida 6 ta belgidan iborat bo'lishi kerak";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    const loginEmail = toFirebaseEmail(username);

    try {
      // 1. Birinchi bo'lib Firebase Auth (BigAdmin / Admin) orqali kirishga urinib ko'radi
      const loggedInRole = await login(loginEmail, password);
      const target = ROLE_ROUTES[loggedInRole] || "/";
      navigate(target, { replace: true });
    } catch (err) {
      // 2. Agar Firebase Auth'da xatolik bersa (masalan, ishchi kiritilgan bo'lsa), Firestore'dan qidiradi
      try {
        const q = query(
          collection(db, "users"),
          where("email", "==", loginEmail),
          where("password", "==", password) // Admin xodimlar ro'yxatida bergan oddiy parol
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const staffUser = querySnapshot.docs[0].data();
          const staffRole = staffUser.role;

          // Context ichidagi user ma'lumotlarini yangilash funksiyasi (Agar AuthContext'da yozilgan bo'lsa)
          if (typeof setAuthData === "function") {
            setAuthData({
              user: staffUser,
              role: staffRole,
              cafeId: staffUser.cafeId
            });
          }

          const target = ROLE_ROUTES[staffRole] || "/";
          navigate(target, { replace: true });
        } else {
          // Agar Firestore'da ham topilmasa, asosiy Firebase xatoligini ko'rsatadi
          const code = err?.code || "default";
          setFormError(ERROR_MESSAGES[code] || ERROR_MESSAGES.default);
        }
      } catch (firestoreErr) {
        console.error("Firestore'dan xodimlarni tekshirishda xatolik:", firestoreErr);
        setFormError("Tizimga kirishda ichki xatolik yuz berdi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF6EC] px-5 py-10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        .disp { font-family: 'Montserrat', sans-serif; }
      `}</style>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden"
            style={{ background: "#1B3A6B" }}
          >
            <GirihMark />
            <LogIn size={26} className="text-white relative" />
          </div>
          <h1 className="disp text-2xl font-extrabold text-[#241F19] tracking-tight font-italic">
            Tizimga kirish
          </h1>
          <p className="text-sm text-[#8E8676] mt-1">Tizimga kirish uchun login va parolingizni kiriting</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-sm border border-[#E8E4D8] p-6 space-y-4"
          noValidate
        >
          {formError && (
            <div className="bg-[#C0392B]/10 text-[#C0392B] text-sm font-medium rounded-xl px-3.5 py-2.5">
              {formError}
            </div>
          )}

          <Input
            label="Login"
            type="text"
            icon={<User />}
            placeholder="loginingizni kiriting"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors.username}
            autoComplete="username"
            required
          />

          <Input
            label="Parol"
            type="password"
            icon={<Lock />}
            placeholder="parolingizni kiriting"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
          >
            Kirish
          </Button>
        </form>

        <p className="text-center text-xs text-[#8E8676] mt-6">
          Hisobingiz yo'qmi? Administratoringiz bilan bog'laning.
        </p>
      </div>
    </div>
  );
}

function GirihMark() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
      <g stroke="#FFFFFF" strokeWidth="1" fill="none" opacity="0.18">
        <path d="M32 4 L60 32 L32 60 L4 32 Z" />
        <circle cx="32" cy="32" r="14" />
      </g>
    </svg>
  );
}