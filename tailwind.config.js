/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fdf3ec", 100: "#f9e0cc", 200: "#f0bd94", 300: "#e6935c",
          400: "#d9702f", 500: "#b8481f", 600: "#993a1a", 700: "#7a2f17",
          800: "#5c2412", 900: "#3d180c",
        },
        gold: {
          50: "#fdf9ec", 100: "#faf0c9", 200: "#f3dd8a", 300: "#e9c34f",
          400: "#d4a72e", 500: "#b38a1f", 600: "#8f6c18", 700: "#6b5012",
          800: "#47350c", 900: "#241a06",
        },
        brown: {
          50: "#f5efe9", 100: "#e3d0bd", 200: "#c9a67f", 300: "#a97c4f",
          400: "#8a5f38", 500: "#6e4a2c", 600: "#573a22", 700: "#402b19",
          800: "#2a1c10", 900: "#150e08",
        },
      },
      boxShadow: {
        card: "0 4px 20px rgba(184, 72, 31, 0.08)",
        "card-hover": "0 8px 30px rgba(184, 72, 31, 0.15)",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        slideDown: { "0%": { opacity: 0, transform: "translateY(-6px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-out",
        slideDown: "slideDown 0.25s ease-out",
      },
    },
    
  },
  plugins: [],
}