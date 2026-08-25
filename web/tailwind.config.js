/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Philadelphia Eagles palette
        midnight: "#004C54",   // midnight green (primary)
        midnight2: "#013b41",  // darker midnight
        kelly: "#3CB371",      // kelly / bright green accent
        kellybright: "#2ECC71",
        silver: "#A5ACAF",     // eagles silver
        charcoal: "#0A0F0E",   // near-black base
        coal: "#101615",       // panel base
        coal2: "#16211F",      // raised panel
        edge: "#22312E",       // borders
        good: "#3CB371",
        warn: "#E8B84B",
        bad: "#E5674E",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(60,179,113,0.25), 0 8px 30px rgba(0,76,84,0.25)",
      },
    },
  },
  plugins: [],
};
