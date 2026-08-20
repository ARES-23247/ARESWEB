import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/api";
import {
  archiveEvent,
  archiveEventPhoto,
  archiveLocation,
  CalendarApiError,
  cancelEventOccurrence,
  createEvent,
  createLocation,
  approveEventPhoto,
  associateEventPhoto,
  fetchEventOccurrences,
  fetchLocations,
  fetchManagedEvent,
  fetchManagedEvents,
  fetchPublicEvent,
  fetchPublicEvents,
  publishEvent,
  restoreEvent,
  restoreEventOccurrence,
  restoreLocation,
  updateEvent,
  updateEventOccurrence,
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
      events: [
        expect.objectContaining({
          id: "event-1",
          dateEnd: undefined,
          isVolunteer: 1,
        }),
      ],
      nextCursor: "event-1",
    });
    expect(authenticatedFetch).toHaveBeenNthCalledWith(1, "/api/calendar/events?limit=150&cursor=cursor-1", undefined);
    await expect(fetchPublicEvent("event/1")).resolves.toEqual(
      expect.objectContaining({
        id: "event-1",
        publicVenue: {
          name: "Public Library",
          address: "321 Main Street, Morgantown, WV 26505, US",
        },
      }),
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(2, "/api/calendar/events/event%2F1", undefined);
    await expect(fetchManagedEvents()).resolves.toEqual({
      events: [expect.objectContaining({ isDeleted: 1, status: "published" })],
      nextCursor: null,
    });
  });

  it("exposes numeric HTTP diagnostics and server error codes", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      response({ error: "Restore the event first.", code: "EVENT_ARCHIVED" }, false, 409, "Conflict"),
    );

    const error = await fetchPublicEvents().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CalendarApiError);
    expect(error).toMatchObject({
      status: 409,
      statusText: "Conflict",
      code: "EVENT_ARCHIVED",
    });
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
    const eventInput = {
      title: "Practice",
      dateStart: event.dateStart,
      category: "internal" as const,
    };
    const venueInput = { name: "Team Lab", address: "Morgantown, WV" };

    await createEvent(eventInput);
    await updateEvent("event-1", eventInput);
    await archiveEvent("event-1");
    await restoreEvent("event-1");
    await publishEvent("event-1");
    await expect(fetchLocations()).resolves.toEqual([expect.objectContaining({ id: "venue-1", isAddressPublic: 1 }),]);
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

describe("calendar recurrence client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes recurrence rules and occurrence markers on event DTOs", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      response({
        success: true,
        events: [
          {
            ...event,
            id: "weekly-1_2026-08-20",
            recurrence: {
              frequency: "weekly",
              interval: 2,
              byDay: ["TU", "TH"],
              until: "2026-12-31",
            },
            recurrenceOf: "weekly-1",
            occurrenceDate: "2026-08-20",
            seriesDefaults: {
              title: "Practice",
              dateStart: "2026-08-13T18:00:00.000Z",
              dateEnd: null,
              category: "internal",
              isPotluck: 0,
              isVolunteer: 1,
            },
          },
        ],
        nextCursor: null,
      }),
    );
    const page = await fetchPublicEvents();
    const occurrence = page.events[0];
    expect(occurrence.recurrence).toEqual({
      frequency: "weekly",
      interval: 2,
      byDay: ["TU", "TH"],
      until: "2026-12-31",
    });
    expect(occurrence.recurrenceOf).toBe("weekly-1");
    expect(occurrence.occurrenceDate).toBe("2026-08-20");
    expect(occurrence.seriesDefaults).toEqual(
      expect.objectContaining({
        title: "Practice",
        dateStart: "2026-08-13T18:00:00.000Z",
        dateEnd: undefined,
      }),
    );
  });

  it("requests a recurring instance through its parent event", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      response({
        success: true,
        event: {
          ...event,
          id: "weekly-1_2026-08-20",
          recurrenceOf: "weekly-1",
          occurrenceDate: "2026-08-20",
        },
      }),
    );

    await fetchPublicEvent("weekly-1", "2026-08-20");

    expect(authenticatedFetch).toHaveBeenCalledWith("/api/calendar/events/weekly-1?occurrence=2026-08-20", undefined);
  });

  it("requests an exact managed occurrence for the editor", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(response({ success: true, event }));

    await fetchManagedEvent("weekly/1", "2026-08-20");

    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/calendar/manage/weekly%2F1?occurrence=2026-08-20",
      undefined,
    );
  });

  it("drops malformed recurrence data instead of inventing a rule", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      response({
        success: true,
        events: [{ ...event, recurrence: { frequency: "monthly" } }],
        nextCursor: null,
      }),
    );
    const page = await fetchPublicEvents();
    expect(page.events[0].recurrence).toBeUndefined();
  });

  it("sends the recurrence rule on create", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      response({
        success: true,
        event: {
          ...event,
          recurrence: { frequency: "weekly", interval: 1, byDay: ["WE"] },
        },
      }),
    );
    await createEvent({
      title: "Practice",
      dateStart: "2026-08-20T18:00:00.000Z",
      category: "internal",
      recurrence: { frequency: "weekly", interval: 1, byDay: ["WE"] },
    });
    const [, init] = vi.mocked(authenticatedFetch).mock.calls[0];
    expect(JSON.parse(String(init!.body))).toEqual(
      expect.objectContaining({
        recurrence: { frequency: "weekly", interval: 1, byDay: ["WE"] },
      }),
    );
  });

  it("lists, cancels, and restores occurrence exceptions", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      response({
        success: true,
        occurrences: [{ date: "2026-09-03", isCancelled: true, hasOverrides: true },],
      }),
    );
    const exceptions = await fetchEventOccurrences("weekly-1");
    expect(exceptions).toEqual([{ date: "2026-09-03", isCancelled: true, hasOverrides: true },]);
    expect(vi.mocked(authenticatedFetch).mock.calls[0][0]).toBe("/api/calendar/manage/weekly-1/occurrences");

    vi.mocked(authenticatedFetch).mockResolvedValue(response({ success: true }));
    await cancelEventOccurrence("weekly-1", "2026-09-03");
    const [cancelPath, cancelInit] = vi.mocked(authenticatedFetch).mock.calls[1];
    expect(cancelPath).toBe("/api/calendar/manage/weekly-1/occurrences/2026-09-03");
    expect(cancelInit!.method).toBe("PATCH");

    await restoreEventOccurrence("weekly-1", "2026-09-03");
    const [restorePath, restoreInit] = vi.mocked(authenticatedFetch).mock.calls[2];
    expect(restorePath).toBe("/api/calendar/manage/weekly-1/occurrences/2026-09-03/restore");
    expect(restoreInit!.method).toBe("PATCH");
  });

  it("updates one occurrence through the dedicated endpoint", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(response({ success: true, event }));
    const input = {
      title: "Drive Practice",
      dateStart: "2026-08-20T19:00:00.000Z",
      dateEnd: null,
      locationId: null,
      location: null,
      description: null,
      category: "internal" as const,
      coverImage: null,
      isPotluck: 0 as const,
      isVolunteer: 0 as const,
    };
    await updateEventOccurrence("weekly/1", "2026-08-20", input);
    const [path, init] = vi.mocked(authenticatedFetch).mock.calls[0];
    expect(path).toBe("/api/calendar/manage/weekly%2F1/occurrences/2026-08-20");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it("associates, approves, and archives event photos through the Calendar API", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(
        response({
          success: true,
          photo: {
            id: "photo-1",
            url: "https://storage.googleapis.com/photo.jpg",
            thumbnailUrl: null,
            mediumUrl: null,
            filename: "Progress.jpg",
            occurrenceDate: "2026-08-20",
            publicationStatus: "pending",
},
        }),
      )
      .mockResolvedValue(response({ success: true }));

    await expect(
      associateEventPhoto("event/1", "photo-1", "2026-08-20"),
    ).resolves.toMatchObject({
      id: "photo-1",
      publicationStatus: "pending",
    });
    expect(vi.mocked(authenticatedFetch).mock.calls[0][0]).toBe(
      "/api/calendar/manage/event%2F1/photos",
    );
    expect(
      JSON.parse(String(vi.mocked(authenticatedFetch).mock.calls[0][1]?.body)),
    ).toEqual({
      photoId: "photo-1",
      occurrenceDate: "2026-08-20",
    });

    await approveEventPhoto("event-1", "photo-1");
    expect(vi.mocked(authenticatedFetch).mock.calls[1][0]).toBe(
      "/api/calendar/manage/event-1/photos/photo-1/approve",
    );
    await archiveEventPhoto("event-1", "photo-1");
    expect(vi.mocked(authenticatedFetch).mock.calls[2][1]?.method).toBe(
      "DELETE",
    );
  });
});
