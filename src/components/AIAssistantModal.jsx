import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config.js";

export default function AIAssistantModal({ isOpen, onClose, userRole }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Rolni aniqlash
  const normalizedRole = userRole?.toLowerCase() || "";
  const isAdmin = normalizedRole.includes("admin");
  const isCashier = normalizedRole.includes("cashier") || normalizedRole.includes("kassir");
  const isChef = normalizedRole.includes("chef") || normalizedRole.includes("oshpaz");
  const isWaiter = normalizedRole.includes("waiter") || normalizedRole.includes("ofitsiant");

  // Rolga qarab sozlamalarni olish
  const getRoleConfig = () => {
    if (isAdmin) {
      return {
        title: "👔 Admin AI Tahlilchi",
        subtitle: "Moliya, ombor, xodimlarning barchasi va umumiy tahlil",
        icon: "👔",
        placeholder: "Admin AI'ga savol bering...",
        suggestions: [
          "Barcha xodimlar va oshpazlar haqida ma'lumot ber",
          "Bugungi umumiy tushum qancha?",
          "Eng ko'p sotilgan taomlar qaysi?",
        ],
      };
    }

    if (isCashier) {
      return {
        title: "💰 Kassa AI Yordamchi",
        subtitle: "Tushum, hisob-kitob va kunlik cheklar",
        icon: "💰",
        placeholder: "Kassa bo'yicha savol bering...",
        suggestions: [
          "Bugun kassaga qancha pul tushdi?",
          "Naqd va karta to'lovlari nisbati?",
          "Oxirgi yopilgan cheklar",
        ],
      };
    }

    if (isChef) {
      return {
        title: "👨‍🍳 Oshpaz AI Yordamchi",
        subtitle: "Oshxona buyurtmalari, retseptlar va taomlar",
        icon: "👨‍🍳",
        placeholder: "Oshxona bo'yicha savol bering...",
        suggestions: [
          "Tayyorlanishi kerak bo'lgan buyurtmalar?",
          "Eng ko'p buyurtma berilgan taom?",
          "Mening seksiyamdagi taomlar holati",
        ],
      };
    }

    if (isWaiter) {
      return {
        title: "🍽️ Ofitsiant AI Yordamchi",
        subtitle: "Stollar, buyurtmalar va menyu yordamchisi",
        icon: "🍽️",
        placeholder: "Stollar yoki menyu bo'yicha savol bering...",
        suggestions: [
          "Qaysi stollar hozir band?",
          "Oshxonada qaysi taom tayyor bo'ldi?",
          "Menyudagi eng mashhur taomlar",
        ],
      };
    }

    return {
      title: "🤖 AI Yordamchi",
      subtitle: "Tizim bo'yicha umumiy yordamchi",
      icon: "🤖",
      placeholder: "Savolingizni kiriting...",
      suggestions: ["Xodimlar va oshpazlar ro'yxati", "Bugungi ishlar holati"],
    };
  };

  const config = getRoleConfig();

  // Modal ochilganda salomlashuv
  useEffect(() => {
    if (isOpen) {
      setMessages([
        {
          sender: "ai",
          text: `Salom! Men sizning ${config.title}ngizman. ${config.subtitle} bo'yicha barcha savollaringizga javob beraman.`,
        },
      ]);
    }
  }, [isOpen, userRole]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  // Savol bo'yicha Firestore'dan ma'lumotlarni izlash va AI javobini shakllantirish
  const processAIResponse = async (userQuery) => {
    const text = userQuery.toLowerCase();

    // 1. XODIMLAR, OSHPAZLAR VA OFITSIANTLAR HAQIDA SO'RALGANDA
    if (text.includes("xodim") || text.includes("oshpaz") || text.includes("ofitsiant") || text.includes("kassir")) {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        if (usersSnap.empty) {
          return "Tizimda hozircha ro'yxatdan o'tgan xodimlar topilmadi.";
        }

        let staffList = [];
        usersSnap.forEach((doc) => {
          const u = doc.data();
          staffList.push(`• ${u.displayName || u.name || "Noma'lum"} (${u.role || "Xodim"})`);
        });

        return `Tizimdagi xodimlar va ularning rollari:\n\n${staffList.join("\n")}`;
      } catch (e) {
        return "Xodimlar ma'lumotlarini yuklashda xatolik yuz berdi.";
      }
    }

    // 2. BUYURTMALAR VA TUSHUM HAQIDA SO'RALGANDA
    if (text.includes("tushum") || text.includes("pul") || text.includes("kassa") || text.includes("chei") || text.includes("buyurtma")) {
      try {
        const ordersSnap = await getDocs(collection(db, "orders"));
        let totalSum = 0;
        let count = 0;

        ordersSnap.forEach((doc) => {
          const o = doc.data();
          if (o.totalAmount) totalSum += Number(o.totalAmount);
          count++;
        });

        return `Jami buyurtmalar soni: ${count} ta.\nUmumiy summa: ${totalSum.toLocaleString()} so'm.`;
      } catch (e) {
        return "Buyurtmalar ma'lumotlarini olishda xatolik bo'ldi.";
      }
    }

    // 3. MENYU VA TAOMLAR HAQIDA SO'RALGANDA
    if (text.includes("taom") || text.includes("menyu") || text.includes("retsept")) {
      try {
        const menuSnap = await getDocs(collection(db, "menu"));
        let menuItems = [];

        menuSnap.forEach((doc) => {
          const item = doc.data();
          menuItems.push(`• ${item.name || "Taom"} - ${item.price || 0} so'm`);
        });

        if (menuItems.length === 0) return "Menyuda taomlar topilmadi.";
        return `Menyudagi taomlar ro'yxati:\n\n${menuItems.slice(0, 10).join("\n")}`;
      } catch (e) {
        return "Menyu ma'lumotlarini yuklashda xatolik yuz berdi.";
      }
    }

    // GENERAL JAVOB
    return `Sizning "${userQuery}" so'rovingiz qabul qilindi. Hozircha bu so'rov bo'yicha ma'lumotlar qayta ishlanmoqda.`;
  };

  const handleSend = async (textToSend) => {
    const queryText = textToSend || input;
    if (!queryText.trim()) return;

    const userMsg = { sender: "user", text: queryText };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const aiReply = await processAIResponse(queryText);
      setMessages((prev) => [...prev, { sender: "ai", text: aiReply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Kechirasiz, ma'lumotlarni qayta ishlashda xatolik yuz berdi." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-in fade-in slide-in-from-right duration-300">
        
        {/* HEADER */}
        <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl backdrop-blur-md">
              {config.icon}
            </div>
            <div>
              <h3 className="font-extrabold text-sm">{config.title}</h3>
              <p className="text-[11px] text-amber-100 font-medium">{config.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* CHAT BODY */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed whitespace-pre-line ${
                  msg.sender === "user"
                    ? "bg-amber-500 text-white rounded-br-none shadow-sm"
                    : "bg-white text-slate-700 border border-slate-200/60 rounded-bl-none shadow-sm"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white p-3 rounded-2xl border border-slate-200/60 text-xs text-slate-400 flex items-center gap-2">
                <span className="animate-spin">⏳</span> AI Firestore'dan ma'lumot qidirmoqda...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* TAVSIYA ETILGAN SAVOLLAR (SUGGESTIONS) */}
        <div className="p-2 px-3 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto scrollbar-none">
          {config.suggestions.map((item, i) => (
            <button
              key={i}
              onClick={() => handleSend(item)}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border border-amber-200/50 active:scale-95"
            >
              {item}
            </button>
          ))}
        </div>

        {/* INPUT PANEL */}
        <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={config.placeholder}
            className="flex-1 bg-slate-100 text-xs text-slate-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
          />
          <button
            onClick={() => handleSend()}
            className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            Yuborish
          </button>
        </div>

      </div>
    </div>
  );
}