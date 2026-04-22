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
        "ares-red": "#C00000",
        "ares-danger": "#EF4444",       // Semantic: error banners, destructive actions, validation
        "ares-danger-soft": "#F87171",   // Semantic: lighter error text on dark backgrounds
        "ares-bronze": "#CD7F32",
        "ares-gold": "#FFB81C",
        "ares-cyan": "#00E5FF",
        "obsidian": "#1A1A1A",
        "marble": "#F9F9F9",
        "ares-gray": "#4a4a4a",
        "ares-offwhite": "#e6edf3",
        "ares-gray-dark": "#161b22",
        "ares-gray-deep": "#0d1117",
        "ares-black": "#050505",
        "ares-black-soft": "#0a0a0a",
        "ares-obsidian-soft": "#111111",
        "brand-discord": "#5865F2",
        "brand-bluesky": "#0085ff",
        "brand-facebook": "#1877F2",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["League Spartan", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [
    typography,
  ],
};
export default config;
