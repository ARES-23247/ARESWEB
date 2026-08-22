import { describe, expect, it } from "vitest";
import { getCanonicalRedirect } from "../lib/canonicalHost";

const location = (
  overrides: Partial<Parameters<typeof getCanonicalRedirect>[0]> = {},
) => ({
  hostname: "aresfirst-portal.web.app",
  pathname: "/join",
  search: "?tab=student",
  hash: "#application",
  ...overrides,
});

describe("canonical Hosting redirect", () => {
  it("redirects both direct Firebase hosts while preserving the URL", () => {
    expect(getCanonicalRedirect(location())).toBe(
      "https://aresfirst.org/join?tab=student#application",
    );
    expect(
      getCanonicalRedirect(
        location({ hostname: "aresfirst-portal.firebaseapp.com" }),
      ),
    ).toBe("https://aresfirst.org/join?tab=student#application");
  });

  it("does not redirect the canonical or unrelated hosts", () => {
    expect(
      getCanonicalRedirect(location({ hostname: "aresfirst.org" })),
    ).toBeNull();
    expect(
      getCanonicalRedirect(location({ hostname: "localhost" })),
    ).toBeNull();
  });

  it("keeps a commit-addressed deployment probe on the direct origin", () => {
    expect(
      getCanonicalRedirect(
        location({ search: `?deployment=${"a".repeat(40)}`, hash: "" }),
      ),
    ).toBeNull();
  });

  it("does not let malformed deployment markers bypass the redirect", () => {
    expect(
      getCanonicalRedirect(
        location({ search: "?deployment=manual", hash: "" }),
      ),
    ).toBe("https://aresfirst.org/join?deployment=manual");
  });
});
