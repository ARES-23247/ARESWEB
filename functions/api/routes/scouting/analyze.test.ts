import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import analyzeRouter from "./analyze";
import { AppEnv } from "../../middleware";

// Simple inline mock database
function createMockDb() {
  const runMock = vi.fn().mockResolvedValue({ success: true });

  const valuesBuilder = {
    run: runMock,
  };

  const insertBuilder = {
    values: vi.fn(() => valuesBuilder),
  };

  return {
    insert: vi.fn(() => insertBuilder),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    run: runMock,
    execute: vi.fn().mockResolvedValue([]),
  };
}

vi.mock("../../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware")>();
  return {
    ...actual,
    getDb: vi.fn(() => createMockDb()),
  };
});

describe("scoutingAnalyzeRouter", () => {
  let app: Hono<AppEnv>;

  beforeEach(() => {
    app = new Hono<AppEnv>();
    app.route("/", analyzeRouter);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should analyze scouting data", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Analysis Result Markdown" } }],
        usage: { total_tokens: 150 }
      }),
    } as any);

    const res = await app.request("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "team_analysis",
        teamNumber: 23247,
        seasonKey: "2023",
        context: { OPR: 50 }
      })
    }, {
      Z_AI_API_KEY: "test-key"
    } as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as any);

    const text = await res.text();
    if (res.status !== 200) console.log("RES TEXT", text);
    expect(res.status).toBe(200);
    const data = JSON.parse(text) as any;
    expect(data.markdown).toBe("Analysis Result Markdown");
    expect(data.tokensUsed).toBe(150);
  });

  it("should reject invalid modes", async () => {
    const res = await app.request("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "invalid_mode",
        seasonKey: "2023",
        context: {}
      })
    }, {
      Z_AI_API_KEY: "test-key"
    } as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as any);

    expect(res.status).toBe(400);
  });
});
