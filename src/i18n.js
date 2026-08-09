import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "uz-latin": {
        translation: {
          "Kafelar": "Kafelar",
          "Kafeni_qoshish": "+ Kafe qo'shish",
          "Tahrirlash": "Tahrirlash",
          "Ochirish": "O'chirish"
        }
      },
      "ru": {
        translation: {
          "Kafelar": "Кафе",
          "Kafeni_qoshish": "+ Добавить кафе",
          "Tahrirlash": "Редактировать",
          "Ochirish": "Удалить"
        }
      }
    },
    fallbackLng: "uz-latin",
    interpolation: { escapeValue: false }
  });

export default i18n;