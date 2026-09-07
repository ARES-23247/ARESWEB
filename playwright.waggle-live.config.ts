import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Local game UI only. Authenticated community and PWA suites still need the
// production-like E2E configuration; do not run their fixtures against Vite dev.
const port = Number(process.env.ARES_WAGGLE_LIVE_PORT ?? "3040");
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(
    "ARES_WAGGLE_LIVE_PORT must be an integer from 1024 to 65535.",
  );
}
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  ...base,
  testMatch: "**/waggle-way.spec.ts",
  workers: 2,
  outputDir: "test-results/waggle-live",
  reporter: [["list"]],
  use: { ...base.use, baseURL: origin },
  projects: base.projects?.filter((project) => project.name !== "pwa-chromium"),
  webServer: {
    command: `pnpm run dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
