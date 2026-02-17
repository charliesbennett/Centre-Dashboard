/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { jakarta: ["'Plus Jakarta Sans'", "sans-serif"] },
      colors: {
        uklc: {
          navy: "#1c3048",
          red: "#ec273b",
          yellow: "#f0f279",
          pink: "#fad7d8",
          ice: "#e6eef3",
        },
      },
    },
  },
  plugins: [],
};
