import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SUCCESS_MESSAGE = "Application submitted successfully!";
const SECURITY_FAILURE_MESSAGE =
  "Security verification failed. Please refresh and try again.";
const APP_CHECK_EXCHANGE_PATH = "exchangeRecaptchaEnterpriseToken";
const EXPECTED_HEADLESS_CONSOLE_FAILURES = [
  "console.error: requestStorageAccess: Permission denied.",
  "console.error: Failed to load resource: the server responded with a status of 403",
  "console.error: [ERROR] Failed to retrieve App Check token:",
  "console.error: [ERROR] Join application submission failed.",
];

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
  if (!/^[a-f0-9]{40}$/.test(value)) {
    throw new Error("--deployment-id must be a full lowercase Git commit SHA");
  }
  return value;
}

export async function runProductionBrowserCheck({
  origin,
  deploymentId,
  launch = () => chromium.launch({ headless: true }),
}) {
  const browser = await launch();
  const context = await browser.newContext({ serviceWorkers: "allow" });
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
    await page.goto(
      `${origin}/join?deployment=${encodeURIComponent(deploymentId)}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      },
    );
    try {
      await page
        .locator("#join-name")
        .waitFor({ state: "visible", timeout: 45_000 });
    } catch {
      const currentUrl = page.url();
      const diagnostics =
        clientFailures.length > 0 ? `\n${clientFailures.join("\n")}` : "";
      throw new Error(
        `Join form did not become ready at ${currentUrl}${diagnostics}`,
      );
    }
    if (new URL(page.url()).origin !== origin) {
      throw new Error(
        `Deployment probe left the direct Hosting origin for ${page.url()}`,
      );
    }
    const initialScriptSources = await page
      .locator("script[src]")
      .evaluateAll((scripts) =>
        scripts.map((script) => script.getAttribute("src") ?? ""),
      );
    if (
      initialScriptSources.some((source) => source.includes("recaptcha/api.js"))
    ) {
      throw new Error("legacy standard reCAPTCHA client is present");
    }

    await page.locator("#join-name").fill("Deployment Browser Canary");
    await page.locator("#join-email").fill("deployment-canary@example.test");
    await page.locator("#join-school").fill("Synthetic Test School");
    await page.locator("#join-grade").selectOption("10");
    await page.getByLabel("Programming").check();
    const exchangeResponsePromise = page.waitForResponse(
      (response) => response.url().includes(APP_CHECK_EXCHANGE_PATH),
      { timeout: 30_000 },
    );
    await page
      .getByRole("button", { name: "Submit Student Application" })
      .click();
    await page.waitForFunction(
      ({ successMessage, securityFailureMessage }) => {
        const text = document.body.innerText;
        return (
          text.includes(successMessage) || text.includes(securityFailureMessage)
        );
      },
      {
        successMessage: SUCCESS_MESSAGE,
        securityFailureMessage: SECURITY_FAILURE_MESSAGE,
      },
      { timeout: 30_000 },
    );
    const exchangeResponse = await exchangeResponsePromise;
    const successVisible = await page.getByText(SUCCESS_MESSAGE).isVisible();
    const attestedScriptSources = await page
      .locator("script[src]")
      .evaluateAll((scripts) =>
        scripts.map((script) => script.getAttribute("src") ?? ""),
      );
    if (
      attestedScriptSources.some((source) =>
        source.includes("recaptcha/api.js"),
      )
    ) {
      throw new Error("legacy standard reCAPTCHA client is present");
    }
    if (
      !attestedScriptSources.some((source) =>
        source.includes("recaptcha/enterprise.js"),
      )
    ) {
      throw new Error(
        "reCAPTCHA Enterprise client is missing after attestation",
      );
    }

    if (successVisible) {
      if (!appCheckToken)
        throw new Error("join flow produced no App Check token");
      if (!inquiryPayload || typeof inquiryPayload !== "object") {
        throw new Error("join flow produced no JSON inquiry payload");
      }
      if ("recaptchaToken" in inquiryPayload) {
        throw new Error(
          "join flow still sends the retired reCAPTCHA token field",
        );
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

      return {
        origin,
        enterpriseClient: true,
        appCheckVerified: true,
        headlessRejectionVerified: false,
      };
    }

    const securityFailure = await page.getByRole("alert").textContent();
    const exchangeBody = await exchangeResponse.text();
    if (
      securityFailure?.trim() !== SECURITY_FAILURE_MESSAGE ||
      exchangeResponse.status() !== 403 ||
      !exchangeBody.includes("App attestation failed")
    ) {
      throw new Error(
        `Unexpected App Check rejection: HTTP ${exchangeResponse.status()} ${exchangeBody}`,
      );
    }
    if (appCheckToken || inquiryPayload) {
      throw new Error("rejected headless attestation reached the inquiry API");
    }
    const untrustedCanaryResponse = await context.request.post(
      `${origin}/api/app-check/canary`,
    );
    if (untrustedCanaryResponse.status() !== 401) {
      throw new Error(
        `App Check canary accepted an unattested request with HTTP ${untrustedCanaryResponse.status()}`,
      );
    }
    const unexpectedFailures = clientFailures.filter(
      (failure) =>
        !EXPECTED_HEADLESS_CONSOLE_FAILURES.some((expected) =>
          failure.startsWith(expected),
        ),
    );
    if (unexpectedFailures.length > 0) {
      throw new Error(unexpectedFailures.join("\n"));
    }

    return {
      origin,
      enterpriseClient: true,
      appCheckVerified: false,
      headlessRejectionVerified: true,
    };
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
    result.appCheckVerified
      ? `Production browser security check passed for ${result.origin}: Enterprise client and App Check canary verified`
      : `Production browser security check passed for ${result.origin}: Enterprise rejected headless attestation and the canary failed closed`,
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
