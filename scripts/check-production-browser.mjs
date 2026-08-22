import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function readOption(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

export function validateOrigin(value) {
  const origin = new URL(value);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("--origin must be an HTTPS origin without a path");
  }
  return origin.origin;
}

export function validateDeploymentId(value) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(value)) {
    throw new Error("--deployment-id contains unsupported characters");
  }
  return value;
}

export async function runProductionBrowserCheck({
  origin,
  deploymentId,
  launch = () => chromium.launch({ headless: true }),
}) {
  const browser = await launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const clientFailures = [];
  let appCheckToken = "";
  let inquiryPayload;

  page.on("pageerror", (error) => {
    clientFailures.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      clientFailures.push(`console.error: ${message.text()}`);
    }
  });

  await page.route("**/api/inquiries", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "POST" || url.pathname !== "/api/inquiries") {
      await route.continue();
      return;
    }

    appCheckToken = request.headers()["x-firebase-appcheck"] ?? "";
    inquiryPayload = JSON.parse(request.postData() ?? "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  try {
    await page.goto(`${origin}/join?deployment=${encodeURIComponent(deploymentId)}`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    const initialScriptSources = await page.locator("script[src]").evaluateAll((scripts) =>
      scripts.map((script) => script.getAttribute("src") ?? ""),
    );
    if (initialScriptSources.some((source) => source.includes("recaptcha/api.js"))) {
      throw new Error("legacy standard reCAPTCHA client is present");
    }

    await page.locator("#join-name").fill("Deployment Browser Canary");
    await page.locator("#join-email").fill("deployment-canary@example.test");
    await page.locator("#join-school").fill("Synthetic Test School");
    await page.locator("#join-grade").selectOption("10");
    await page.getByLabel("Programming").check();
    await page.getByRole("button", { name: "Submit Student Application" }).click();
    await page.getByText("Application submitted successfully!").waitFor({
      state: "visible",
      timeout: 30_000,
    });

    if (!appCheckToken) throw new Error("join flow produced no App Check token");
    if (!inquiryPayload || typeof inquiryPayload !== "object") {
      throw new Error("join flow produced no JSON inquiry payload");
    }
    if ("recaptchaToken" in inquiryPayload) {
      throw new Error("join flow still sends the retired reCAPTCHA token field");
    }
    const attestedScriptSources = await page.locator("script[src]").evaluateAll((scripts) =>
      scripts.map((script) => script.getAttribute("src") ?? ""),
    );
    if (attestedScriptSources.some((source) => source.includes("recaptcha/api.js"))) {
      throw new Error("legacy standard reCAPTCHA client is present");
    }
    if (!attestedScriptSources.some((source) => source.includes("recaptcha/enterprise.js"))) {
      throw new Error("reCAPTCHA Enterprise client is missing after attestation");
    }

    const canaryResponse = await context.request.post(
      `${origin}/api/app-check/canary`,
      { headers: { "X-Firebase-AppCheck": appCheckToken } },
    );
    if (canaryResponse.status() !== 204) {
      throw new Error(
        `App Check canary rejected the browser token with HTTP ${canaryResponse.status()}`,
      );
    }
    if (clientFailures.length > 0) {
      throw new Error(clientFailures.join("\n"));
    }

    return { origin, enterpriseClient: true, appCheckVerified: true };
  } finally {
    await browser.close();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const origin = validateOrigin(
    readOption(argv, "--origin", "https://aresfirst-portal.web.app"),
  );
  const deploymentId = validateDeploymentId(
    readOption(argv, "--deployment-id", process.env.GITHUB_SHA ?? "manual"),
  );
  const result = await runProductionBrowserCheck({ origin, deploymentId });
  console.log(
    `Production browser security check passed for ${result.origin}: Enterprise client and App Check canary verified`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
