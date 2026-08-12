import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/api";
import {
  archiveEvent,
  archiveLocation,
  CalendarApiError,
  createEvent,
  createLocation,
  fetchLocations,
  fetchManagedEvents,
  fetchPublicEvent,
  fetchPublicEvents,
  publishEvent,
  restoreEvent,
  restoreLocation,
  updateEvent,
  updateLocation,
} from "@/app/calendar/api";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));

const event = {
  id: "event-1",
  title: "Practice",
  dateStart: "2026-08-20T18:00:00.000Z",
  dateEnd: null,
  locationId: null,
  location: "Team Lab",
  publicVenue: {
    name: "Public Library",
    address: "321 Main Street, Morgantown, WV 26505, US",
  },
  description: null,
  category: "internal",
  coverImage: null,
  isPotluck: 0,
  isVolunteer: 1,
  status: "published",
  isDeleted: 0,
};

const location = {
  id: "venue-1",
  name: "Team Lab",
  address: "Morgantown, WV",
  description: null,
  gmapsUrl: null,
  isDeleted: 0,
  isAddressPublic: 1,
};

function response(body: unknown, ok = true, status = 200, statusText = "OK") {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("calendar API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and normalizes public, detail, and management event DTOs", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({ events: [event], nextCursor: "event-1" }))
      .mockResolvedValueOnce(response({ event }))
      .mockResolvedValueOnce(response({ events: [{ ...event, isDeleted: 1 }], nextCursor: null }));

    await expect(fetchPublicEvents(500, "cursor-1")).resolves.toEqual({
      events: [expect.objectContaining({ id: "event-1", dateEnd: undefined, isVolunteer: 1 })],
      nextCursor: "event-1",
    });
    expect(authenticatedFetch).toHaveBeenNthCalledWith(1, "/api/calendar/events?limit=150&cursor=cursor-1", undefined);
    await expect(fetchPublicEvent("event/1")).resolves.toEqual(expect.objectContaining({
      id: "event-1",
      publicVenue: {
        name: "Public Library",
        address: "321 Main Street, Morgantown, WV 26505, US",
      },
    }));
    expect(authenticatedFetch).toHaveBeenNthCalledWith(2, "/api/calendar/events/event%2F1", undefined);
    await expect(fetchManagedEvents()).resolves.toEqual({
      events: [expect.objectContaining({ isDeleted: 1, status: "published" })],
      nextCursor: null,
    });
  });

  it("exposes numeric HTTP diagnostics and server error codes", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(response(
      { error: "Restore the event first.", code: "EVENT_ARCHIVED" },
      false,
      409,
      "Conflict",
    ));

    const error = await fetchPublicEvents().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CalendarApiError);
    expect(error).toMatchObject({ status: 409, statusText: "Conflict", code: "EVENT_ARCHIVED" });
    expect((error as Error).message).toContain("HTTP 409: Conflict");
  });

  it("rejects malformed success payloads instead of treating them as empty data", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(response({ events: "not-an-array" }));
    await expect(fetchPublicEvents()).rejects.toThrow("does not contain an event list");

    vi.mocked(authenticatedFetch).mockResolvedValue(response({ event: { title: "Missing ID" } }));
    await expect(fetchPublicEvent("missing-id")).rejects.toThrow("invalid id");
  });

  it("uses explicit methods for event and venue lifecycle operations", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (path) => {
      const url = String(path);
      if (url === "/api/calendar/locations") return response({ locations: [location], location });
      if (url.includes("/locations/")) return response({ success: true, location });
      if (url === "/api/calendar/manage") return response({ event });
      if (url.includes("/manage/")) return response({ success: true, event });
      return response({ success: true });
    });
    const eventInput = { title: "Practice", dateStart: event.dateStart, category: "internal" as const };
    const venueInput = { name: "Team Lab", address: "Morgantown, WV" };

    await createEvent(eventInput);
    await updateEvent("event-1", eventInput);
    await archiveEvent("event-1");
    await restoreEvent("event-1");
    await publishEvent("event-1");
    await expect(fetchLocations()).resolves.toEqual([
      expect.objectContaining({ id: "venue-1", isAddressPublic: 1 }),
    ]);
    await createLocation(venueInput);
    await updateLocation("venue-1", venueInput);
    await archiveLocation("venue-1");
    await restoreLocation("venue-1");

    const calls = vi.mocked(authenticatedFetch).mock.calls;
    expect(calls.some(([, init]) => init?.method === "POST")).toBe(true);
    expect(calls.some(([, init]) => init?.method === "PUT")).toBe(true);
    expect(calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
    expect(calls.some(([, init]) => init?.method === "PATCH")).toBe(true);
  });
});
