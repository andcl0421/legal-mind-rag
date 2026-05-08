/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        nomu: {
          bg: "#F9FBF9",
          main: "#81C784",
          dark: "#2E7D32",
          soft: "#E8F5E9",
          line: "#DCEAD9",
          ink: "#263528",
        },
      },
      boxShadow: {
        soft: "0 18px 45px rgba(67, 111, 70, 0.09)",
      },
    },
  },
  plugins: [],
};
