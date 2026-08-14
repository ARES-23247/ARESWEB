import { describe, expect, it, vi } from "vitest";
import {
  legacyDescriptionRepair,
  parseRepairArgs,
  runEventDescriptionRepair,
} from "./repair-event-descriptions.mjs";

function legacyAst(text = "Practice recap") {
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text },
          { type: "hardBreak" },
          { type: "text", text: "Bring safety glasses." },
        ],
      },
    ],
  });
}

function fakePage(description = legacyAst()) {
  const ref = { path: "events/event-one" };
  const document = {
    id: "event-one",
    ref,
    data: () => ({ description }),
  };
  const query = {
    orderBy: () => query,
    limit: () => query,
    startAfter: () => query,
    get: vi.fn().mockResolvedValue({ docs: [document], size: 1 }),
  };
  return { document, query, ref };
}

describe("legacy event description repair", () => {
  it("defaults to a bounded dry run and rejects ambiguous arguments", () => {
    expect(parseRepairArgs(["--project", "aresfirst-portal"])).toEqual(
      expect.objectContaining({ apply: false, limit: 25, after: null }),
    );
    expect(() => parseRepairArgs([])).toThrow("--project");
    expect(() =>
      parseRepairArgs(["--project", "aresfirst-portal", "--limit", "101"]),
    ).toThrow("--limit");
    expect(() =>
      parseRepairArgs(["--project", "aresfirst-portal", "--after", "../bad"]),
    ).toThrow("--after");
    expect(() =>
      parseRepairArgs(["--project", "aresfirst-portal", "--unknown"]),
    ).toThrow("Unknown argument");
  });

  it("requires exact project confirmation before writes", () => {
    expect(() =>
      parseRepairArgs(["--project", "aresfirst-portal", "--apply"]),
    ).toThrow("--confirm-project");
    expect(() =>
      parseRepairArgs([
        "--project",
        "aresfirst-portal",
        "--apply",
        "--confirm-project",
        "different-project",
      ]),
    ).toThrow("exactly match");
  });

  it("converts valid legacy AST while preserving hard breaks", () => {
    expect(legacyDescriptionRepair(legacyAst())).toBe(
      "Practice recap\nBring safety glasses.",
    );
    expect(legacyDescriptionRepair("ordinary text")).toBeNull();
    expect(legacyDescriptionRepair("{ malformed }")).toBeNull();
    expect(
      legacyDescriptionRepair(
        JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Describe your upcoming event or write a full recap here...",
                },
              ],
            },
          ],
        }),
      ),
    ).toBe("");
  });

  it("performs no writes during a dry run and reports only document IDs", async () => {
    const { query } = fakePage();
    const runTransaction = vi.fn();
    const result = await runEventDescriptionRepair(
      {
        apply: false,
        project: "aresfirst-portal",
        limit: 25,
        after: null,
      },
      {
        db: { collection: () => query, runTransaction },
        documentId: "__name__",
      },
    );

    expect(result).toEqual({
      mode: "dry-run",
      scanned: 1,
      eligible: 1,
      updated: 0,
      failed: 0,
      candidateIds: ["event-one"],
      failedIds: [],
      nextCursor: "event-one",
    });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("preserves the original AST and writes one eligible record transactionally", async () => {
    const original = legacyAst();
    const { query, ref } = fakePage(original);
    const update = vi.fn();
    const runTransaction = vi.fn(async (callback) =>
      callback({
        get: async () => ({
          exists: true,
          data: () => ({ description: original }),
        }),
        update,
      }),
    );
    const result = await runEventDescriptionRepair(
      {
        apply: true,
        project: "aresfirst-portal",
        confirmProject: "aresfirst-portal",
        limit: 1,
        after: null,
      },
      {
        db: { collection: () => query, runTransaction },
        documentId: "__name__",
      },
    );

    expect(result).toEqual(expect.objectContaining({ updated: 1, failed: 0 }));
    expect(update).toHaveBeenCalledWith(
      ref,
      expect.objectContaining({
        description: "Practice recap\nBring safety glasses.",
        descriptionLegacyAst: original,
        descriptionMigrationVersion: 1,
        descriptionMigratedAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
  });

  it("isolates a concurrent edit without overwriting it", async () => {
    const { query } = fakePage();
    const runTransaction = vi.fn(async (callback) =>
      callback({
        get: async () => ({
          exists: true,
          data: () => ({ description: "changed" }),
        }),
        update: vi.fn(),
      }),
    );
    const result = await runEventDescriptionRepair(
      {
        apply: true,
        project: "aresfirst-portal",
        confirmProject: "aresfirst-portal",
        limit: 1,
        after: null,
      },
      {
        db: { collection: () => query, runTransaction },
        documentId: "__name__",
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        updated: 0,
        failed: 1,
        failedIds: ["event-one"],
      }),
    );
  });
});
