import { describe, expect, it } from "vitest";
import { replaceCurrentVersionText } from "./refresh-learning-source-authority.mjs";

describe("learning source authority refresh", () => {
  it("tracks product versions separately when starter and shared releases diverge", () => {
    const previous = {
      aresVersion: "14.0.0",
      studioVersion: "4.0.0",
      ftcStarterVersion: "14.0.0",
      frcStarterVersion: "14.0.0",
    };
    const next = {
      aresVersion: "14.0.0",
      studioVersion: "4.0.1",
      ftcStarterVersion: "14.0.1",
      frcStarterVersion: "14.0.1",
    };

    expect(
      replaceCurrentVersionText(
        "ARES 14.0.0; ARES FTC 14.0.0; ARES-FRC 14.0.0; Studio 4.0.0",
        previous,
        next,
      ),
    ).toBe(
      "ARES 14.0.0; ARES FTC 14.0.1; ARES-FRC 14.0.1; Studio 4.0.1",
    );
  });

  it("repairs a partially refreshed product version using the shared-version fallback", () => {
    const previous = {
      aresVersion: "14.0.0",
      studioVersion: "4.0.1",
      ftcStarterVersion: "14.0.1",
      frcStarterVersion: "14.0.1",
    };

    expect(
      replaceCurrentVersionText(
        "ARES FTC 14.0.0 and ARES FRC 14.0.0",
        previous,
        previous,
      ),
    ).toBe("ARES FTC 14.0.1 and ARES FRC 14.0.1");
  });
});
