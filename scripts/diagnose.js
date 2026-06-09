import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Starting Vite dev server in next-firebase...");
  const devServer = spawn("npx", ["vite", "preview", "--port", "3333"], {
    cwd: path.resolve(__dirname, "../next-firebase"),
    shell: true
  });

  devServer.stdout.on("data", (data) => {
    console.log(`[Vite]: ${data.toString().trim()}`);
  });

  devServer.stderr.on("data", (data) => {
    console.error(`[Vite Error]: ${data.toString().trim()}`);
  });

  // Wait 3.5 seconds for server to start
  await new Promise((resolve) => setTimeout(resolve, 3500));

  console.log("Launching Chromium via Playwright...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg) => {
    console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.error(`BROWSER PAGE ERROR:`, err.stack || err.message || err);
  });

  console.log("Navigating to https://aresfirst-portal.web.app...");
  try {
    await page.goto("https://aresfirst-portal.web.app", { waitUntil: "load" });
    console.log("Page title:", await page.title());
    const rootHTML = await page.evaluate(() => document.getElementById("root")?.innerHTML);
    console.log("Root element inner HTML:", rootHTML);
  } catch (err) {
    console.error("Navigation failed:", err);
  } finally {
    console.log("Closing browser and server...");
    await browser.close();
    devServer.kill();
    // Force kill if needed
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", devServer.pid, "/f", "/t"]);
    }
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Diagnostic script failed:", err);
  process.exit(1);
});
