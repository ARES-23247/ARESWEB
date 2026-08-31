import { describe, expect, it, vi } from "vitest";
import {
  assessLearningSourceWorktree,
  classifySourceRelation,
  collectLearningSourcePaths,
  formatLearningSourceWorktreeReport,
  inspectLearningSourceWorktree,
  parseSourceWorktreeArgs,
} from "./learning-source-worktree.mjs";

const authorityCommit = "aaaaaaaa";
const headCommit = "bbbbbbbb";
const sourcePaths = [
  "ARES-Analytics/docs/STUDIO.md",
  "ARESLib-Kotlin/docs/architecture.md",
];

describe("learning source worktree audit", () => {
  it("parses a portable repository argument or environment fallback", () => {
    expect(
      parseSourceWorktreeArgs(["--repo", "C:/robotics/ares", "--json"]),
    ).toEqual({ repoPath: "C:/robotics/ares", json: true });
    expect(() => parseSourceWorktreeArgs(["--unknown"])).toThrow(
      /Unknown option/u,
    );
    expect(() => parseSourceWorktreeArgs([])).toThrow(/Pass --repo/u);
  });

  it("deduplicates normalized source paths", () => {
    const catalog = {
      documents: [
        {
          sourceReferences: [{ path: "ARESLib-Kotlin\\docs\\architecture.md" }],
        },
        {
          sourceReferences: [
            { path: "ARESLib-Kotlin/docs/architecture.md" },
            { path: "README.md" },
          ],
        },
      ],
    };
    expect(collectLearningSourcePaths(catalog)).toEqual([
      "ARESLib-Kotlin/docs/architecture.md",
      "README.md",
    ]);
  });

  it("classifies aligned, behind, ahead, and divergent histories", () => {
    expect(
      classifySourceRelation(authorityCommit, authorityCommit, authorityCommit),
    ).toBe("aligned");
    expect(
      classifySourceRelation(authorityCommit, headCommit, headCommit),
    ).toBe("behind");
    expect(
      classifySourceRelation(authorityCommit, headCommit, authorityCommit),
    ).toBe("ahead");
    expect(
      classifySourceRelation(authorityCommit, headCommit, "cccccccc"),
    ).toBe("divergent");
  });

  it("requires a refresh only when a newer checkout changed a pinned source", () => {
    const result = assessLearningSourceWorktree({
      authorityCommit,
      headCommit,
      mergeBase: authorityCommit,
      sourcePaths,
      changedPaths: [sourcePaths[0], "unrelated.md", sourcePaths[0]],
      dirtyPaths: [],
      trackedPaths: sourcePaths,
    });
    expect(result).toMatchObject({
      relation: "ahead",
      action: "refresh-required",
      exitCode: 2,
    });
    expect(result.relevantChanges).toEqual([sourcePaths[0]]);

    const unrelated = assessLearningSourceWorktree({
      authorityCommit,
      headCommit,
      mergeBase: authorityCommit,
      sourcePaths,
      changedPaths: ["unrelated.md"],
      trackedPaths: sourcePaths,
    });
    expect(unrelated).toMatchObject({
      action: "no-relevant-drift",
      exitCode: 0,
    });
  });

  it("blocks dirty, divergent, missing, and older source states without false missing files", () => {
    expect(
      assessLearningSourceWorktree({
        authorityCommit,
        headCommit,
        mergeBase: authorityCommit,
        sourcePaths,
        dirtyPaths: [sourcePaths[1]],
        trackedPaths: sourcePaths,
      }).action,
    ).toBe("blocked-dirty");
    expect(
      assessLearningSourceWorktree({
        authorityCommit,
        headCommit,
        mergeBase: "cccccccc",
        sourcePaths,
        trackedPaths: sourcePaths,
      }).action,
    ).toBe("blocked-divergent");
    expect(
      assessLearningSourceWorktree({
        authorityCommit,
        headCommit,
        mergeBase: authorityCommit,
        sourcePaths,
        trackedPaths: [sourcePaths[0]],
      }).action,
    ).toBe("blocked-missing");
    const behind = assessLearningSourceWorktree({
      authorityCommit,
      headCommit,
      mergeBase: headCommit,
      sourcePaths,
      trackedPaths: [],
    });
    expect(behind).toMatchObject({
      action: "checkout-behind",
      missingPaths: [],
      exitCode: 2,
    });
  });

  it("inspects git once per required source-state input", () => {
    const responses = new Map([
      ["rev-parse HEAD", headCommit],
      [`merge-base ${authorityCommit} ${headCommit}`, authorityCommit],
      [
        `diff --name-only ${authorityCommit}..${headCommit}`,
        `${sourcePaths[0]}\r\nother.md`,
      ],
      ["diff --name-only HEAD", ""],
      ["ls-tree -r --name-only HEAD", sourcePaths.join("\n")],
    ]);
    const runGit = vi.fn((_repo, args) => responses.get(args.join(" ")) ?? "");
    const catalog = {
      documents: sourcePaths.map((entry) => ({
        sourceReferences: [{ path: entry }],
      })),
    };
    const plan = { sourceAuthority: { commit: authorityCommit } };
    expect(
      inspectLearningSourceWorktree("C:/robotics/ares", catalog, plan, runGit)
        .action,
    ).toBe("refresh-required");
    expect(runGit).toHaveBeenCalledTimes(5);
  });

  it("formats an actionable result for every state", () => {
    const base = {
      authorityCommit,
      headCommit,
      relation: "ahead",
      action: "refresh-required",
      sourcePathCount: 2,
      relevantChanges: [sourcePaths[0]],
      relevantDirtyPaths: [],
      missingPaths: [],
      exitCode: 2,
    };
    expect(formatLearningSourceWorktreeReport(base)).toMatch(
      /Review those files[\s\S]*Changed:/u,
    );
    expect(
      formatLearningSourceWorktreeReport({
        ...base,
        action: "checkout-behind",
        relation: "behind",
        relevantChanges: [],
      }),
    ).toMatch(/older than the pinned/u);
    expect(
      formatLearningSourceWorktreeReport({
        ...base,
        action: "blocked-dirty",
        relevantDirtyPaths: [sourcePaths[1]],
      }),
    ).toMatch(/uncommitted edits[\s\S]*Dirty:/u);
    expect(
      formatLearningSourceWorktreeReport({
        ...base,
        action: "blocked-divergent",
        relevantChanges: [],
      }),
    ).toMatch(/diverged/u);
    expect(
      formatLearningSourceWorktreeReport({
        ...base,
        action: "blocked-missing",
        relevantChanges: [],
        missingPaths: [sourcePaths[1]],
      }),
    ).toMatch(/no longer contains[\s\S]*Missing:/u);
    expect(
      formatLearningSourceWorktreeReport({
        ...base,
        action: "no-relevant-drift",
        relevantChanges: [],
      }),
    ).toMatch(/no pinned lesson source changed/u);
    expect(
      formatLearningSourceWorktreeReport({
        ...base,
        action: "aligned",
        relation: "aligned",
        relevantChanges: [],
      }),
    ).toMatch(/matches the pinned/u);
  });
});
