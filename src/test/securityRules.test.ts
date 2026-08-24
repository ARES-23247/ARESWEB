import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const firestoreRules = readFileSync("firestore.rules", "utf8");
const storageRules = readFileSync("storage.rules", "utf8");
const firebaseCore = readFileSync("src/lib/firebaseCore.ts", "utf8");
const firebaseAuth = readFileSync("src/lib/firebaseAuth.ts", "utf8");
const firebaseFirestore = readFileSync("src/lib/firebaseFirestore.ts", "utf8");
const firebaseAppCheck = readFileSync("src/lib/firebaseAppCheck.ts", "utf8");
const firebaseEnvironment = readFileSync("src/lib/firebaseEnvironment.ts", "utf8");
const authContext = readFileSync("src/context/AuthContext.tsx", "utf8");
const dashboardLayout = readFileSync("src/app/dashboard/layout.tsx", "utf8");
const productionFrontendSource = globSync("src/**/*.{ts,tsx}", {
  exclude: ["src/test/**", "src/**/*.test.{ts,tsx}"],
})
  .map((file) => `${file}\n${readFileSync(file, "utf8")}`)
  .join("\n");

describe("security-rule invariants", () => {
  it("does not expose inquiry or finance records publicly", () => {
    expect(firestoreRules).toMatch(/match \/inquiries\/\{inquiryId\}[\s\S]*?allow read: if hasRole\('admin'\) \|\| hasRole\('coach'\);/);
    expect(firestoreRules).toMatch(/match \/finance_transactions\/\{txId\}[\s\S]*?allow read: if hasRole\('admin'\) \|\| hasRole\('coach'\) \|\| hasRole\('mentor'\);/);
  });

  it("does not expose settings publicly", () => {
    expect(firestoreRules).toMatch(/match \/settings\/\{settingId\}[\s\S]*?allow read, write: if false;/);
  });

  it("does not let every verified member publish arbitrary editor assets", () => {
    const editorRule = storageRules.match(/match \/editor\/uploads\/\{allPaths=\*\*\} \{([\s\S]*?)\n    \}/)?.[1] || "";
    expect(editorRule).toContain("allow read, write: if false");
  });

  it("uses the dedicated reCAPTCHA Enterprise provider for App Check", () => {
    expect(firebaseAppCheck).toContain("ReCaptchaEnterpriseProvider");
    expect(firebaseAppCheck).not.toContain("ReCaptchaV3Provider");
    expect(firebaseAppCheck).toContain('"X-Firebase-AppCheck"');
    expect(firebaseAppCheck).toContain("isTokenAutoRefreshEnabled: true");
  });

  it("keeps new public-media objects behind the same-origin gateway", () => {
    const publicMediaRule = storageRules.match(/match \/public-media\/\{allPaths=\*\*\} \{([\s\S]*?)\n    \}/)?.[1] || "";
    expect(publicMediaRule).toContain("allow read, write: if false");
  });

  it("keeps migrated media prefixes behind same-origin gateways", () => {
    for (const prefix of [
      "blog/{allPaths=**}",
      "gallery/{allPaths=**}",
      "events/{eventId}/photos/{photoId}",
      "editor/uploads/{allPaths=**}",
    ]) {
      const escaped = prefix.replace(/[{}/*]/gu, (character) => `\\${character}`);
      const body = storageRules.match(new RegExp(`match \/${escaped} \\{([\\s\\S]*?)\\n    \\}`))?.[1] || "";
      expect(body).toContain("allow read, write: if false");
    }
  });

  it("prevents a second legacy reCAPTCHA client from colliding with App Check", () => {
    expect(productionFrontendSource).not.toContain("recaptcha/api.js");
    expect(productionFrontendSource).not.toContain("ReCaptchaV3Provider");
    expect(productionFrontendSource).not.toContain("NEXT_PUBLIC_RECAPTCHA_SITE_KEY");
    expect(productionFrontendSource).not.toContain("getRecaptchaToken");
  });

  it("keeps Firebase product initialization behind narrow module boundaries", () => {
    expect(firebaseCore).toContain('from "firebase/app"');
    expect(firebaseCore).not.toMatch(/firebase\/(auth|firestore|storage|app-check)/);

    expect(firebaseAuth).toContain('from "firebase/auth"');
    expect(firebaseAuth).toContain('from "./firebaseCore"');
    expect(firebaseAuth).not.toMatch(/firebase\/(firestore|storage|app-check)/);

    expect(firebaseFirestore).toContain('from "firebase/firestore"');
    expect(firebaseFirestore).toContain('from "./firebaseCore"');
    expect(firebaseFirestore).not.toMatch(/firebase\/(auth|storage|app-check)/);

    expect(firebaseAppCheck).toContain('import("firebase/app-check")');
    expect(firebaseAppCheck).toContain('from "./firebaseCore"');
    expect(firebaseAppCheck).not.toMatch(/firebase\/(auth|firestore|storage)/);
  });

  it("limits emulator and App Check debug behavior to explicitly local development", () => {
    expect(firebaseFirestore).toContain("import.meta.env.DEV ? getLocalFirebaseEmulatorHost() : null");
    expect(firebaseFirestore).toContain('import("./firebaseFirestoreEmulator")');

    expect(firebaseEnvironment).toContain('import.meta.env.VITE_USE_EMULATOR !== "false"');
    expect(firebaseEnvironment).toContain('import.meta.env.NEXT_PUBLIC_USE_EMULATOR !== "false"');
    expect(firebaseEnvironment).toContain("if (!isLocalHost) return null");

    expect(firebaseAppCheck).toContain('import.meta.env.VITE_USE_EMULATOR === "true"');
    expect(firebaseAppCheck).toContain('import.meta.env.NEXT_PUBLIC_USE_EMULATOR === "true"');
    expect(firebaseAppCheck).toContain("useDebugToken");
    expect(firebaseAppCheck).toMatch(/&&\s*isLocalHost/);
    expect(firebaseAppCheck).not.toMatch(/FIREBASE_APPCHECK_DEBUG_TOKEN\s*=\s*true[\s\S]*?else/);
  });

  it("keeps mock authentication out of production and preview builds", () => {
    expect(authContext).toContain('import.meta.env.DEV || import.meta.env.MODE === "e2e"');
    expect(authContext).toContain('import.meta.env.DEV && import.meta.env.MODE !== "e2e"');
    expect(authContext).toContain('import("../lib/firebaseDevBootstrap")');
    expect(authContext).not.toContain('hostname.includes("aresfirst-portal--")');
    expect(dashboardLayout).not.toContain('hostname.includes("aresfirst-portal--")');
  });
});
