import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: mocks.where,
      orderBy: mocks.orderBy,
      limit: mocks.limit,
      get: mocks.get,
    })),
  },
}));

import tournamentsRouter from "../tournaments";

function publicResultsHandler() {
  const layer = tournamentsRouter.stack.find(
    (entry) => entry.route?.path === "/public/results",
  );
  if (!layer) throw new Error("public results route not found");
  return layer.route!.stack.at(-1)!.handle;
}

describe("public tournament results", () => {
  let res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  it("serves a minimal DTO without scouting or operational fields", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "t_1",
          data: () => ({
            name: "WV State Championship",
            seasonName: "BIOBUZZ",
            challengeName: "",
            date: "2026-02-14",
            location: "Fairmont, WV",
            description: "Finalist alliance captains.",
            opr: 41.2,
            oprList: [{ label: "secret per-robot stat" }],
            scoutingDetails: { secrets: "not for public" },
            photoAlbumId: "album_private",
            isDeleted: 0,
          }),
        },
      ],
    });

    await publicResultsHandler()({}, res, next);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.results).toHaveLength(1);
    const result = payload.results[0];
    expect(result).toMatchObject({
      id: "t_1",
      name: "WV State Championship",
      date: "2026-02-14",
      location: "Fairmont, WV",
      status: "past",
      opr: 41.2,
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("scoutingDetails");
    expect(serialized).not.toContain("oprList");
    expect(serialized).not.toContain("album_private");
    expect(serialized).not.toContain("secret");
  });

  it("marks future-dated tournaments as upcoming", async () => {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "t_future",
          data: () => ({ name: "Next Season Kickoff", date: future.toISOString().slice(0, 10), isDeleted: 0 }),
        },
      ],
    });

    await publicResultsHandler()({}, res, next);

    expect(res.json.mock.calls[0][0].results[0].status).toBe("upcoming");
  });

  it("surfaces query failures instead of faking an empty list", async () => {
    mocks.get.mockRejectedValue(new Error("firestore unavailable"));

    await publicResultsHandler()({}, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
