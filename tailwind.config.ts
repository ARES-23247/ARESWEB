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
        "ares-bronze": "#CD7F32",
        "ares-gold": "#FFB81C",
        "ares-cyan": "#00E5FF",
        "obsidian": "#1A1A1A",
        "marble": "#F9F9F9",
        "ares-gray": "var(--ares-gray)",
        "ares-offwhite": "#e6edf3",
        "ares-zinc-dark": "#161b22",
        "ares-zinc-deep": "#0d1117",
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
