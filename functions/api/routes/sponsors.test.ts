import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "../../../src/test/utils";
import sponsorsRouter from "./sponsors";
import { createMockSponsor } from "../../../src/test/factories/logisticsFactory";

describe("Hono Backend - /sponsors Router", () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    } as any,
    DEV_BYPASS: "true",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list all sponsors", async () => {
    const mockSponsors = [createMockSponsor(), createMockSponsor()];
    env.DB.all.mockResolvedValue({ results: mockSponsors });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.sponsors).toHaveLength(2);
  });
});
