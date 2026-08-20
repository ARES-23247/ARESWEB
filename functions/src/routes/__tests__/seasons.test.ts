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
  let req: {
    body?: unknown;
    params?: Record<string, string>;
    authorizationRole?: string;
  };
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
          data: () => ({
            startYear: 2026,
            challengeName: "DECODE",
            status: "published",
            isDeleted: 0,
          }),
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
    expect(mocks.where).toHaveBeenCalledWith("status", "==", "published");
  });

  it("admin listing includes archived records with lifecycle fields", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "award_1",
          data: () => ({
            title: "Inspire Award",
            eventName: "States",
            date: "2026-02-01",
            isDeleted: 1,
            archivedAt: "2026-03-01",
          }),
        },
      ],
    });
    await handler(awardsRouter, "/admin", "get")(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.awards[0]).toMatchObject({
      isDeleted: 1,
      archivedAt: "2026-03-01",
    });
  });

  it("lists public awards and admin seasons", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "award_pub",
          data: () => ({
            title: "Win",
            eventName: "E",
            date: "2026-01-01",
            status: "published",
            isDeleted: 0,
          }),
        },
      ],
    });
    await handler(awardsRouter, "/", "get")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      awards: [expect.objectContaining({ id: "award_pub" })],
    });

    await handler(seasonsRouter, "/admin", "get")(req, res, next);
    expect(res.json).toHaveBeenLastCalledWith({
      seasons: [expect.objectContaining({ id: "award_pub" })],
    });
  });

  it("fails closed when a public season or award is not explicitly published", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "draft",
          data: () => ({ title: "Draft", status: "draft", isDeleted: 0 }),
        },
        { id: "legacy", data: () => ({ title: "Legacy", isDeleted: 0 }) },
      ],
    });

    await handler(awardsRouter, "/", "get")(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ awards: [] });
  });

  it("creates a season with bounded, validated fields", async () => {
    req.body = {
      startYear: 2026,
      endYear: 2027,
      challengeName: "DECODE",
      robotCadUrl: "https://cad.onshape.com/x",
      status: "draft",
    };
    await handler(seasonsRouter, "/admin", "post")(req, res, next);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "season_2026",
        startYear: 2026,
        status: "draft",
      }),
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
    req.body = {
      startYear: 2026,
      challengeName: "DECODE",
      robotImage: "http://cdn.example/x.png",
    };
    await handler(seasonsRouter, "/admin", "post")(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        message: expect.stringContaining("https"),
      }),
    );
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("creates an award with a validated date and optional season link", async () => {
    req.body = {
      title: "Inspire Award",
      eventName: "WV States",
      date: "2026-02-01",
      seasonId: "season_2026",
    };
    await handler(awardsRouter, "/admin", "post")(req, res, next);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Inspire Award",
        seasonId: "season_2026",
        isDeleted: 0,
      }),
    );
  });

  it("updates an existing season instead of duplicating it", async () => {
    mocks.docGet.mockResolvedValue({ exists: true });
    req.body = {
      id: "season_2025",
      startYear: 2025,
      challengeName: "Into the Deep",
    };
    await handler(seasonsRouter, "/admin", "post")(req, res, next);

    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "season_2025",
        challengeName: "Into the Deep",
      }),
    );
  });

  it("rejects years outside the supported range and unsafe award season links", async () => {
    req.body = { startYear: 1999, challengeName: "X" };
    await handler(seasonsRouter, "/admin", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        message: expect.stringContaining("between 2000 and 2100"),
      }),
    );

    req.body = {
      title: "T",
      eventName: "E",
      date: "2026-01-01",
      seasonId: "a/b",
    };
    await handler(awardsRouter, "/admin", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        message: expect.stringContaining("season id"),
      }),
    );
  });

  it("updates an existing award instead of duplicating it", async () => {
    mocks.docGet.mockResolvedValue({ exists: true });
    req.body = {
      id: "award_1",
      title: "Inspire Award",
      eventName: "WV States",
      date: "2026-02-01",
    };
    await handler(awardsRouter, "/admin", "post")(req, res, next);

    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "award_1", title: "Inspire Award" }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, id: "award_1" }),
    );
  });

  it("rejects awards with malformed dates", async () => {
    req.body = { title: "X", eventName: "Y", date: "02/01/2026" };
    await handler(awardsRouter, "/admin", "post")(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        message: expect.stringContaining("YYYY-MM-DD"),
      }),
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

    req.params = { id: "award_1" };
    await handler(awardsRouter, "/admin/:id", "delete")(req, res, next);
    expect(res.json).toHaveBeenLastCalledWith({ success: true });
    await handler(awardsRouter, "/admin/:id/restore", "patch")(req, res, next);
    expect(res.json).toHaveBeenLastCalledWith({ success: true });

    req.params = { id: "../evil" };
    await handler(awardsRouter, "/admin/:id", "delete")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));

    mocks.docGet.mockResolvedValue({ exists: false });
    req.params = { id: "award_missing" };
    await handler(awardsRouter, "/admin/:id", "delete")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
  });
});
