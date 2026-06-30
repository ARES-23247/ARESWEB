import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.includes("node_modules")) {
            if (normalizedId.includes("firebase")) {
              return "vendor-firebase";
            }
            if (normalizedId.includes("@xyflow") || normalizedId.includes("reactflow")) {
              return "vendor-xyflow";
            }
            if (normalizedId.includes("monaco-editor")) {
              return "vendor-monaco";
            }
            if (normalizedId.includes("@babel")) {
              return "vendor-babel";
            }
            if (normalizedId.includes("three")) {
              return "vendor-three";
            }
            if (normalizedId.includes("lucide-react")) {
              return "vendor-lucide";
            }
            if (normalizedId.includes("framer-motion")) {
              return "vendor-framer";
            }
            if (normalizedId.includes("@radix-ui")) {
              return "vendor-radix";
            }
            if (normalizedId.includes("recharts") || normalizedId.includes("d3")) {
              return "vendor-recharts";
            }
            return "vendor";
          }
        },
      },
    },
  },
  test: {
    globals: true,
    mockReset: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: ["**/node_modules/**", "**/dist/**", "functions/**", "e2e/**"],
    coverage: {
      thresholds: {
        lines: 85,
        functions: 100,
      },
    },
  },
});
