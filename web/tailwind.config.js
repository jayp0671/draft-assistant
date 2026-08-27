/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#004C54",
        midnight2: "#013b41",
        kelly: "#3CB371",
        kellybright: "#2ECC71",
        silver: "#A5ACAF",
        charcoal: "#0A0F0E",
        coal: "#101615",
        coal2: "#16211F",
        edge: "#22312E",
        good: "#3CB371",
        warn: "#E8B84B",
        bad: "#E5674E",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Oswald", "Impact", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(60,179,113,0.25), 0 8px 30px rgba(0,76,84,0.25)",
        stat: "inset 0 1px 3px rgba(0,0,0,0.4), 0 1px 0 rgba(60,179,113,0.06)",
        scoreboard: "inset 0 2px 6px rgba(0,0,0,0.5), 0 1px 0 rgba(60,179,113,0.08)",
      },
    },
  },
  plugins: [],
};
