import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import analyzeRouter from "./analyze";
import { AppEnv } from "../../middleware";

vi.mock("../../middleware", () => ({
  getDb: () => ({
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true })
  }),
}));



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
      env: { Z_AI_API_KEY: "test-key" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
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
      env: { Z_AI_API_KEY: "test-key" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(400);
  });
});
