import type { Config } from "tailwindcss";

import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "ares-red": "#C00000",
        "ares-red-light": "#FF4D4D",
        "ares-red-dark": "#8A0000",
        "ares-danger": "#EF4444",       // Semantic: error banners, destructive actions, validation
        "ares-danger-soft": "#F87171",   // Semantic: lighter error text on dark backgrounds
        "ares-bronze": "#CD7F32",
        "ares-bronze-light": "#E69B4D",
        "ares-bronze-dark": "#A66324",
        "ares-gold": "#FFB81C",
        "ares-cyan": "#00E5FF",
        "obsidian": "#1A1A1A",
        "marble": "#F9F9F9",
        "ares-gray": "#4a4a4a",
        "ares-gray-dark": "#2A2A2A",
        "ares-gray-deep": "#0B0B0B",
        "ares-offwhite": "#e6edf3",
        "ares-muted": "#c9d1d9",
        "ares-black": "#050505",
        "brand-discord": "#5865F2",
        "brand-bluesky": "#0085ff",
        "brand-facebook": "#1877F2",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["League Spartan", "Inter", "sans-serif"],
      },
      zIndex: {
        navbar: "50",
        modal: "100",
        popover: "200",
        "asset-picker": "1000",
      },
    },
  },
  plugins: [
    typography,
  ],
};
export default config;
