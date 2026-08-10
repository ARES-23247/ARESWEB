import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const firestoreRules = readFileSync("firestore.rules", "utf8");
const storageRules = readFileSync("storage.rules", "utf8");
const firebaseClient = readFileSync("src/lib/firebase.ts", "utf8");
const authContext = readFileSync("src/context/AuthContext.tsx", "utf8");
const dashboardLayout = readFileSync("src/app/dashboard/layout.tsx", "utf8");

describe("security-rule invariants", () => {
  it("does not expose inquiry or finance records publicly", () => {
    expect(firestoreRules).toMatch(/match \/inquiries\/\{inquiryId\}[\s\S]*?allow read: if hasRole\('admin'\) \|\| hasRole\('coach'\);/);
    expect(firestoreRules).toMatch(/match \/finance_transactions\/\{txId\}[\s\S]*?allow read: if hasRole\('admin'\) \|\| hasRole\('coach'\) \|\| hasRole\('mentor'\);/);
  });

  it("does not expose settings publicly", () => {
    expect(firestoreRules).toMatch(/match \/settings\/\{settingId\}[\s\S]*?allow read: if isAuthorized\(\);/);
  });

  it("does not let every verified member publish arbitrary editor assets", () => {
    const editorRule = storageRules.match(/match \/editor\/uploads\/\{allPaths=\*\*\} \{([\s\S]*?)\n    \}/)?.[1] || "";
    expect(editorRule).toContain("isContentManager()");
    expect(editorRule).not.toContain("allow write: if isAuthorized()");
  });

  it("uses the dedicated reCAPTCHA Enterprise provider for App Check", () => {
    expect(firebaseClient).toContain("ReCaptchaEnterpriseProvider");
    expect(firebaseClient).not.toContain("ReCaptchaV3Provider");
  });

  it("keeps mock authentication out of production and preview builds", () => {
    expect(authContext).toContain('import.meta.env.DEV || import.meta.env.MODE === "e2e"');
    expect(authContext).not.toContain('hostname.includes("aresfirst-portal--")');
    expect(dashboardLayout).not.toContain('hostname.includes("aresfirst-portal--")');
  });
});
