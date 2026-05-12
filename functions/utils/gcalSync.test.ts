import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock jose â€” we don't want real crypto in unit tests
vi.mock("jose", () => {
  class MockSignJWT {
    setProtectedHeader() { return this; }
    setIssuer() { return this; }
    setAudience() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "mock-jwt-token"; }
  }
  return {
    importPKCS8: vi.fn().mockResolvedValue("mock-pk"),
    SignJWT: MockSignJWT,
  };
});

// Mock content util
vi.mock("./content", () => ({
  parseAstToText: vi.fn((text: string) => text),
}));

import { getGcalAccessToken, pushEventToGcal, deleteEventFromGcal, pullEventsFromGcal } from "./gcalSync";
import type { GCalConfig, ARES_Event } from "./gcalSync";

// NOTE: These tests use direct fetch mocking instead of MSW to avoid
// AbortSignal compatibility issues between jsdom's AbortSignal polyfill
// and MSW's node interceptor. The root cause is that MSW validates
// AbortSignal using instanceof checks, and jsdom's polyfill doesn't pass.

describe("gcalSync Utilities", () => {
  const config: GCalConfig = {
    email: "test@test.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
    calendarId: "test-calendar-id",
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getGcalAccessToken", () => {
    it("should return an access token on successful auth", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "gcloud-token-123" }),
      });

      const token = await getGcalAccessToken(config);
      expect(token).toBe("gcloud-token-123");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("should throw on missing access_token", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "invalid_grant" }),
      });

      await expect(getGcalAccessToken(config)).rejects.toThrow("Failed to get Google Calendar access token");
    });
  });

  describe("pushEventToGcal", () => {
    const event: ARES_Event = {
      id: "evt-1",
      title: "Team Meeting",
      dateStart: "2025-03-15T18:00:00",
      dateEnd: "2025-03-15T20:00:00",
      location: "Lab A",
      description: "Weekly sync",
    };

    it("should return undefined for missing config", async () => {
      const result = await pushEventToGcal(event, { email: "", privateKey: "", calendarId: "" });
      expect(result).toBeUndefined();
    });

    it("should POST a new event and return gcal_event_id", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "gcal-id-abc" }),
        });

      const result = await pushEventToGcal(event, config);
      expect(result).toBe("gcal-id-abc");
    });

    it("should PUT when event has existing gcal_event_id", async () => {
      let usedMethod = "";
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok" }),
        })
        .mockImplementationOnce((url: string, options: RequestInit) => {
          usedMethod = options.method || "GET";
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "existing-gcal-id" }),
          });
        });

      const existing = { ...event, gcalEventId: "existing-gcal-id" };
      await pushEventToGcal(existing, config);
      expect(usedMethod).toBe("PUT");
    });

    it("should throw on non-ok response", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({ error: "forbidden" }),
        });

      await expect(pushEventToGcal(event, config)).rejects.toThrow("Google API Error: 403");
    });
  });

  describe("deleteEventFromGcal", () => {
    it("should skip delete for missing config or gcal_id", async () => {
      await deleteEventFromGcal("", config);
      await deleteEventFromGcal("some-id", { email: "", privateKey: "", calendarId: "" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should send DELETE request", async () => {
      let deleteHit = false;
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok" }),
        })
        .mockImplementationOnce(() => {
          deleteHit = true;
          return Promise.resolve(new Response(null, { status: 204 }));
        });

      await deleteEventFromGcal("gcal-123", config);
      expect(deleteHit).toBe(true);
    });

    it("should silently handle 410 responses", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok" }),
        })
        .mockResolvedValueOnce(new Response("Gone", { status: 410 }));

      // Should not throw
      await deleteEventFromGcal("gcal-gone", config);
    });
  });

  describe("pullEventsFromGcal", () => {
    it("should fetch and map events from GCal", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: "g1",
                summary: "Practice",
                start: { dateTime: "2025-03-15T18:00:00Z" },
                end: { dateTime: "2025-03-15T20:00:00Z" },
                location: "Gym",
                description: "Practice session",
              },
              {
                id: "g2",
                summary: "Competition",
                start: { date: "2025-04-01" },
                end: { date: "2025-04-02" },
              },
            ],
          }),
        });

      const events = await pullEventsFromGcal(config);
      expect(events).toHaveLength(2);
      expect(events[0].id).toBe("gcal-g1");
      expect(events[0].title).toBe("Practice");
      expect(events[0].location).toBe("Gym");
      expect(events[0].gcalEventId).toBe("g1");
      expect(events[1].title).toBe("Competition");
      expect(events[1].dateStart).toBe("2025-04-01");
    });

    it("should throw on non-ok response", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok" }),
        })
        .mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }));

      await expect(pullEventsFromGcal(config)).rejects.toThrow("Failed to pull from GCal (test-calendar-id): 500");
    });

    it("should handle empty items array", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [] }),
        });

      const events = await pullEventsFromGcal(config);
      expect(events).toHaveLength(0);
    });
  });
});

