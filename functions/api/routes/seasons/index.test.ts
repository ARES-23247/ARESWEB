import { describe, it, expect, vi, beforeEach } from "vitest";
import seasonsRouter from "./index";

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

describe("Seasons Public Router", () => {
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;
  let env: { DB: unknown };

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
    };
    env = { DB: mockDb };
    vi.clearAllMocks();
  });

  it("GET / should return list of published seasons", async () => {
    const mockSeasons = [
      { id: "2023-2024", challenge_name: "CENTERSTAGE", status: "published", is_deleted: 0 },
      { id: "2024-2025", challenge_name: "INTO THE DEEP", status: "published", is_deleted: 0 }
    ];
    mockDb.all.mockResolvedValueOnce({ results: mockSeasons });

    const req = new Request("http://localhost/");
    const res = await seasonsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { seasons: Record<string, unknown>[] };
    expect(body.seasons).toHaveLength(2);
    expect(body.seasons[0].id).toBe("2023-2024");
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM seasons"));
  });

  it("GET / should return empty list on DB error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB Error"));

    const req = new Request("http://localhost/");
    const res = await seasonsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { seasons: Record<string, unknown>[] };
    expect(body.seasons).toHaveLength(0);
  });

  it("GET /:id should return season details with awards and events", async () => {
    const mockSeason = { id: "2024-2025", challenge_name: "INTO THE DEEP" };
    const mockAwards = [{ id: "a1", title: "Inspire Award" }];
    const mockEvents = [{ id: "e1", title: "Qualifying Tournament" }];

    mockDb.first.mockResolvedValueOnce(mockSeason);
    mockDb.all
      .mockResolvedValueOnce({ results: mockAwards })
      .mockResolvedValueOnce({ results: mockEvents });

    const req = new Request("http://localhost/2024-2025");
    const res = await seasonsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { season: { id: string }, awards: unknown[], events: unknown[] };
    expect(body.season.id).toBe("2024-2025");
    expect(body.awards).toHaveLength(1);
    expect(body.events).toHaveLength(1);
  });

  it("GET /:id should handle null awards/events", async () => {
    mockDb.first.mockResolvedValueOnce({ id: "2024-2025" });
    mockDb.all
      .mockResolvedValueOnce({ results: null }) // awards
      .mockResolvedValueOnce({ results: null }); // events

    const req = new Request("http://localhost/2024-2025");
    const res = await seasonsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { awards: unknown[], events: unknown[] };
    expect(body.awards).toEqual([]);
    expect(body.events).toEqual([]);
  });

  it("GET / should handle null results from DB", async () => {
    mockDb.all.mockResolvedValueOnce({ results: null });

    const req = new Request("http://localhost/");
    const res = await seasonsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { seasons: Record<string, unknown>[] };
    expect(body.seasons).toHaveLength(0);
  });

  it("GET /:id should return 404 if season not found", async () => {
    mockDb.first.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/non-existent");
    const res = await seasonsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Season not found");
  });

  it("GET /:id should return 500 on DB error", async () => {
    mockDb.first.mockRejectedValueOnce(new Error("DB Error"));

    const req = new Request("http://localhost/2024-2025");
    const res = await seasonsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Failed to fetch season details");
  });
});
