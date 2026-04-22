import { describe, it, expect, vi } from "vitest";
import { mockExecutionContext } from "../../../src/test/utils";
import eventsRouter from "./index";

describe("Hono Backend - /events Router", () => {
  it("should return a list of events on GET /", async () => {
    // Mock D1 Database responses
    const mockEvents = [
      { id: "evt-1", title: "Test Event 1" },
      { id: "evt-2", title: "Test Event 2" },
    ];

    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: mockEvents }),
      first: vi.fn(),
    } as any;

    const env = {
      DB: mockDb,
    };

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await eventsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.events).toHaveLength(2);
    expect(body.events[0].title).toBe("Test Event 1");
  });

  it("should return a single event on GET /:id", async () => {
    const mockEvent = { id: "evt-1", title: "Test Event 1", category: "outreach" };

    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(mockEvent),
      all: vi.fn(),
    } as any;

    const env = {
      DB: mockDb,
    };

    const req = new Request("http://localhost/evt-1", { method: "GET" });
    const res = await eventsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.event.title).toBe("Test Event 1");
    expect(mockDb.prepare).toHaveBeenCalled();
    expect(mockDb.bind).toHaveBeenCalledWith("evt-1");
  });

  it("should return 404 if event is not found", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn(),
    } as any;

    const env = {
      DB: mockDb,
    };

    const req = new Request("http://localhost/non-existent", { method: "GET" });
    const res = await eventsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });

  it("should handle database errors gracefully", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockRejectedValue(new Error("DB Connection failed")),
    } as any;

    const env = {
      DB: mockDb,
    };

    // Replace console.error to keep test output clean
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await eventsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.events).toEqual([]); // Fallback empty array

    consoleSpy.mockRestore();
  });
});
