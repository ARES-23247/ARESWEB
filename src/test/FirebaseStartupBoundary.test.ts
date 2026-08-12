import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Firebase startup service boundaries", () => {
  it("keeps Firestore, Storage, and App Check out of shared shell modules", () => {
    const authContext = source("src/context/AuthContext.tsx");
    const navbar = source("src/components/Navbar.tsx");
    const authModule = source("src/lib/firebaseAuth.ts");
    const apiModule = source("src/lib/api.ts");

    for (const startupModule of [authContext, navbar, authModule, apiModule]) {
      expect(startupModule).not.toMatch(/^import .*firebase\/(?:firestore|storage|app-check)/m);
      expect(startupModule).not.toMatch(/^import .*firebase(?:Firestore|Storage)/m);
    }
    expect(navbar).not.toContain("onSnapshot");
    expect(navbar).toContain("/api/inquiries/pending-exists");
  });

  it("loads App Check and development Firestore bootstrapping dynamically", () => {
    const appCheckModule = source("src/lib/firebaseAppCheck.ts");
    const authContext = source("src/context/AuthContext.tsx");

    expect(appCheckModule).not.toMatch(/^import .*firebase\/app-check/m);
    expect(appCheckModule).toContain('import("firebase/app-check")');
    expect(authContext).toContain('import("../lib/firebaseDevBootstrap")');
    expect(authContext).not.toMatch(/^import .*firebaseDevBootstrap/m);
  });

  it("does not retain a combined Firebase service-locator import in production code", () => {
    expect(existsSync(resolve(process.cwd(), "src/lib/firebase.ts"))).toBe(false);
  });
});
