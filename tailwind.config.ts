import type { Config } from "tailwindcss";

import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "ares-red": "var(--ares-red)",
        "ares-red-bright": "var(--ares-red-bright)",
        "ares-gold": "var(--ares-gold)",
        "ares-green": "var(--ares-green)",
        "ares-orange": "var(--ares-orange)",
        "ares-peach": "var(--ares-peach)",
        "ares-gray": "var(--ares-gray)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [
    typography,
  ],
};
export default config;
