import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderBy: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
  docGet: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      orderBy: mocks.orderBy,
      where: mocks.where,
      limit: mocks.limit,
      get: mocks.get,
      doc: vi.fn(() => ({
        get: mocks.docGet,
        set: mocks.set,
        update: mocks.update,
      })),
    })),
  },
}));

import seasonsRouter, { awardsRouter } from "../seasons";

function handler(router: ReturnType<typeof express.Router>, path: string, method: string) {
  const layer = router.stack.find(
    (entry) =>
      entry.route &&
      entry.route.path === path &&
      (entry.route as unknown as { methods: Record<string, unknown> }).methods[method],
  );
  if (!layer) throw new Error(`route ${method} ${path} not found`);
  return layer.route!.stack.at(-1)!.handle;
}

describe("Seasons and awards admin API", () => {
  let req: { body?: unknown; params?: Record<string, string>; authorizationRole?: string };
  let res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ docs: [] });
    mocks.docGet.mockResolvedValue({ exists: false });
    req = { body: {}, params: {}, authorizationRole: "admin" };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  it("lists public seasons without lifecycle metadata", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "season_2026",
          data: () => ({ startYear: 2026, challengeName: "DECODE", status: "published", isDeleted: 0 }),
        },
      ],
    });
    await handler(seasonsRouter, "/", "get")(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      seasons: [
        expect.objectContaining({ id: "season_2026", challengeName: "DECODE" }),
      ],
    });
    const payload = res.json.mock.calls[0][0];
    expect(payload.seasons[0].isDeleted).toBeUndefined();
  });

  it("admin listing includes archived records with lifecycle fields", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "award_1",
          data: () => ({ title: "Inspire Award", eventName: "States", date: "2026-02-01", isDeleted: 1, archivedAt: "2026-03-01" }),
        },
      ],
    });
    await handler(awardsRouter, "/admin", "get")(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.awards[0]).toMatchObject({ isDeleted: 1, archivedAt: "2026-03-01" });
  });

  it("creates a season with bounded, validated fields", async () => {
    req.body = { startYear: 2026, endYear: 2027, challengeName: "DECODE", robotCadUrl: "https://cad.onshape.com/x", status: "draft" };
    await handler(seasonsRouter, "/admin", "post")(req, res, next);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: "season_2026", startYear: 2026, status: "draft" }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, id: "season_2026" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects seasons with inverted year spans or bad ids", async () => {
    req.body = { startYear: 2027, endYear: 2026, challengeName: "X" };
    await handler(seasonsRouter, "/admin", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));

    req.body = { startYear: 2026, challengeName: "X", id: "a/b" };
    await handler(seasonsRouter, "/admin", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  it("rejects non-https media links on seasons", async () => {
    req.body = { startYear: 2026, challengeName: "DECODE", robotImage: "http://cdn.example/x.png" };
    await handler(seasonsRouter, "/admin", "post")(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, message: expect.stringContaining("https") }),
    );
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("creates an award with a validated date and optional season link", async () => {
    req.body = { title: "Inspire Award", eventName: "WV States", date: "2026-02-01", seasonId: "season_2026" };
    await handler(awardsRouter, "/admin", "post")(req, res, next);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Inspire Award", seasonId: "season_2026", isDeleted: 0 }),
    );
  });

  it("rejects awards with malformed dates", async () => {
    req.body = { title: "X", eventName: "Y", date: "02/01/2026" };
    await handler(awardsRouter, "/admin", "post")(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, message: expect.stringContaining("YYYY-MM-DD") }),
    );
  });

  it("archives and restores by id, rejecting unsafe ids and missing records", async () => {
    req.params = { id: "season_2026" };
    mocks.docGet.mockResolvedValue({ exists: true });
    await handler(seasonsRouter, "/admin/:id", "delete")(req, res, next);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: 1 }),
    );

    await handler(seasonsRouter, "/admin/:id/restore", "patch")(req, res, next);
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ isDeleted: 0, archivedAt: null }),
    );

    req.params = { id: "../evil" };
    await handler(awardsRouter, "/admin/:id", "delete")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));

    mocks.docGet.mockResolvedValue({ exists: false });
    req.params = { id: "award_missing" };
    await handler(awardsRouter, "/admin/:id", "delete")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
  });
});
