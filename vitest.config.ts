import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    exclude: ['**/node_modules/**', 'tests/e2e/**', '.claude/**'],
    include: ['**/*.{test,spec}.{js,ts,tsx}'],
    coverage: {
      provider: "v8",
      include: ['src/utils/**', 'src/hooks/**', 'functions/api/routes/**'],
      exclude: [
        'functions/api/routes/sitemap.ts',
        '**/*.test.ts'
      ],
      thresholds: {
        lines: 85,
        functions: 100,
        branches: 80,
        statements: 85
      }
    },
    server: {
      deps: {
        external: [/parse5/]
      }
    }
  },
});
