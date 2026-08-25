import { describe, expect, it } from "vitest";
import {
  buildGitHubApiHeaders,
  compareSemverTags,
  normalizeLearningMarkdown,
  registerPathOrder,
  resolveApprovedAuthority,
  validateSourceReference,
  validateSourceAuthorities,
} from "./validate-learning-catalog.mjs";

describe("learning catalog preparation", () => {
  it("authenticates GitHub API checks only when an ephemeral token is available", () => {
    expect(buildGitHubApiHeaders()).not.toHaveProperty("authorization");
    expect(buildGitHubApiHeaders("  test-token  ")).toMatchObject({
      authorization: "Bearer test-token",
      accept: "application/vnd.github+json",
    });
  });

  it("normalizes Markdown line endings deterministically across operating systems", () => {
    expect(normalizeLearningMarkdown("  # Lesson\r\n\rBody\rMore\n  ")).toBe("# Lesson\n\nBody\nMore");
  });

  it("orders semantic release tags numerically rather than lexically", () => {
    expect(compareSemverTags("v9.12.0", "v9.9.0")).toBeGreaterThan(0);
    expect(compareSemverTags("v10.0.0", "v9.99.99")).toBeGreaterThan(0);
    expect(compareSemverTags("v9.12.0", "v9.12.0")).toBe(0);
    expect(() => compareSemverTags("main", "v9.12.0")).toThrow(/semantic release tag/u);
  });

  it("accepts current and historical pins but rejects undeclared source identities", () => {
    const current = { revision: "v2.0.0", commit: "b".repeat(40) };
    const historical = { revision: "v1.0.0", commit: "a".repeat(40) };
    const authorities = validateSourceAuthorities({
      schemaVersion: 1,
      repositories: {
        example: { current, approved: [historical, current] },
      },
    });

    expect(resolveApprovedAuthority(authorities, "example", historical.revision, historical.commit)).toEqual(historical);
    expect(resolveApprovedAuthority(authorities, "example", current.revision, current.commit)).toEqual(current);
    expect(resolveApprovedAuthority(authorities, "example", "v3.0.0", "c".repeat(40))).toBeNull();
    expect(resolveApprovedAuthority(authorities, "unknown", current.revision, current.commit)).toBeNull();
  });

  it("requires the current source identity to be an approved immutable pin", () => {
    expect(() => validateSourceAuthorities({
      schemaVersion: 1,
      repositories: {
        example: {
          current: { revision: "v2.0.0", commit: "b".repeat(40) },
          approved: [{ revision: "v1.0.0", commit: "a".repeat(40) }],
        },
      },
    })).toThrow(/current authority must also be approved/u);
  });

  it("rejects mutable links and repositories outside the reviewed authority list", () => {
    const commit = "a".repeat(40);
    const authorities = validateSourceAuthorities({
      schemaVersion: 1,
      repositories: {
        example: {
          current: { revision: "v1.0.0", commit },
          approved: [{ revision: "v1.0.0", commit }],
        },
      },
    });
    const source = {
      label: "Example source",
      repository: "example",
      revision: "v1.0.0",
      path: "docs/lesson.md",
      blobHash: "b".repeat(40),
      url: `https://github.com/ARES-23247/example/blob/${commit}/docs/lesson.md`,
    };

    expect(validateSourceReference(source, "lesson", authorities)).toMatchObject({ current: true });
    expect(() => validateSourceReference({ ...source, url: "https://github.com/ARES-23247/example/blob/main/docs/lesson.md" }, "lesson", authorities)).toThrow(/full Git commit/u);
    expect(() => validateSourceReference({ ...source, repository: "unreviewed", url: `https://github.com/ARES-23247/unreviewed/blob/${commit}/docs/lesson.md` }, "lesson", authorities)).toThrow(/not an approved curriculum authority/u);
  });

  it("rejects two lessons assigned the same order in one learning path", () => {
    const orders = new Map();
    registerPathOrder(orders, "robotics-foundations", 1, "first");
    expect(() => registerPathOrder(orders, "robotics-foundations", 1, "second")).toThrow(/duplicates first/u);
    expect(() => registerPathOrder(orders, "another-path", 1, "second")).not.toThrow();
  });
});
