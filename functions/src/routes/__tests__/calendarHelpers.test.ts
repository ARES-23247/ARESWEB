import { describe, expect, it } from "vitest";
import {
  addHours,
  canPublish,
  escapeIcalText,
  eventDto,
  eventPhotoDto,
  eventWriteData,
  eventWriteSchema,
  expandEventOccurrences,
  formatIcalDate,
  locationDto,
  locationWriteSchema,
  parseBody,
  parseId,
  parseLimit,
  publicEventDescription,
  publicVenueDto,
  readString,
} from "../calendarHelpers";

describe("calendar route helpers", () => {
  it("validates bounded event and venue writes", () => {
    const event = parseBody(eventWriteSchema, {
      title: "Practice",
      dateStart: "2026-08-20T18:00:00.000Z",
      dateEnd: "2026-08-20T20:00:00.000Z",
      category: "internal",
      coverImage: "https://aresfirst.org/practice.webp",
    });
    expect(eventWriteData(event, "pending")).toMatchObject({ status: "pending", isPotluck: 0, });
    expect(() => parseBody(eventWriteSchema, {
      title: "Backwards event",
      dateStart: "2026-08-20T20:00:00.000Z",
      dateEnd: "2026-08-20T18:00:00.000Z",
      category: "internal",
    })).toThrow("End time must be after");
    expect(() => parseBody(locationWriteSchema, {
      name: "Lab",
      address: "Morgantown, WV",
      gmapsUrl: "http://example.com",
    })).toThrow("URL must use HTTPS");
    expect(parseBody(locationWriteSchema, {
      name: "Public Library",
      address: "321 Main Street, Morgantown, WV 26505, US",
      isAddressPublic: 1,
    })).toMatchObject({ isAddressPublic: 1 });
  });

  it("builds explicit DTOs without copying unknown operational fields", () => {
    const publicDto = eventDto("event-1", {
      title: "Outreach",
      dateStart: "2026-09-01T10:00:00.000Z",
      category: "outreach",
      status: "published",
      isDeleted: 1,
      createdAt: "private timestamp",
      createdBy: "private uid",
    } as never, false);
    expect(publicDto).toMatchObject({ id: "event-1", category: "outreach" });
    expect(publicDto).not.toHaveProperty("status");
    expect(publicDto).not.toHaveProperty("createdBy");
    expect(publicDto).not.toHaveProperty("location");
    expect(publicDto).not.toHaveProperty("locationId");

    const legacyDescription =
      'Public practice recap. --- Meeting Notes --- {"type":"doc","content":[]}';
    expect(eventDto("legacy-event", {
      description: legacyDescription,
    }, false).description).toBe("Public practice recap.");
    expect(eventDto("legacy-event", {
      description: legacyDescription,
    }, true).description).toBe(legacyDescription);
    expect(publicEventDescription("--- Meeting Notes --- private")).toBeNull();

    const competitionDto = eventDto("event-comp", {
      title: "WV State Championship",
      dateStart: "2026-11-15T08:00:00.000Z",
      category: "competition",
    } as never, false);
    expect(competitionDto).toMatchObject({ id: "event-comp", category: "competition", });

    expect(eventDto("event-2", { status: "invalid", isDeleted: 1 }, true)).toMatchObject({
      status: "draft",
      isDeleted: 1,
    });
    expect(locationDto("venue-1", { name: 123, address: "WV", isDeleted: 1, isAddressPublic: 1, })).toMatchObject({
      name: "Unnamed venue",
      isDeleted: 1,
      isAddressPublic: 1,
    });
    expect(publicVenueDto({
      name: " Public Library ",
      address: " 321 Main Street, Morgantown, WV 26505, US ",
      isAddressPublic: 1,
      internalNotes: "private",
    } as never)).toEqual({
      name: "Public Library",
      address: "321 Main Street, Morgantown, WV 26505, US",
    });
    expect(publicVenueDto({ name: "Private home", address: "private", isAddressPublic: 0, })).toBeNull();
    expect(publicVenueDto({ name: "Archived", address: "public", isAddressPublic: 1, isDeleted: 1, })).toBeNull();

    expect(eventPhotoDto("event-1", "photo-1", {
      sourcePhotoId: "source-1",
      filename: "Practice.jpg",
      uploadedBy: "private-user-id",
      uploadedAt: "2026-08-10T12:00:00.000Z",
      isDeleted: 0,
        publicationStatus: "published",
    })).toEqual({
      id: "photo-1",
      url: "/api/calendar/events/event-1/photos/photo-1/media/original",
      filename: "Practice.jpg",
      thumbnailUrl: "/api/calendar/events/event-1/photos/photo-1/media/thumbnail",
      mediumUrl: "/api/calendar/events/event-1/photos/photo-1/media/medium",
      occurrenceDate: null,
    });
    expect(eventPhotoDto("event-1", "photo-fallback", {
        publicationStatus: "published",
    })).toEqual(expect.objectContaining({ filename: "Event photo" }));
    expect(eventPhotoDto("event-1", "photo-deleted", {
      isDeleted: 1,
    })).toBeNull();
    expect(eventPhotoDto("event-1", "photo-bad", { sourcePhotoId: "bad/path", publicationStatus: "published" })).toBeNull();
    expect(
      eventPhotoDto("event-1", "photo-pending", {
        publicationStatus: "pending",
  }),
    ).toBeNull();
  });

  it("maps managed event covers to publication-aware gateways", () => {
    expect(eventDto("event-1", { coverPhotoId: "photo-1" }, false)).toMatchObject({
      coverImage: "/api/calendar/events/event-1/cover",
    });
    expect(eventDto("event-1", { coverPhotoId: "photo-1" }, true)).toMatchObject({
      coverImage: "/api/photos/admin/media/photo-1/original",
      coverPhotoId: "photo-1",
    });

    const [publicOccurrence] = expandEventOccurrences(
      eventDto("event-1", {
        title: "Practice",
        dateStart: "2026-08-20T18:00:00.000Z",
        coverPhotoId: "series-cover",
      }, false),
      {
        dateStart: "2026-08-20T18:00:00.000Z",
        recurrence: { frequency: "weekly", interval: 1, byDay: ["TH"] },
      },
      {
        fromDate: "2026-08-20",
        toDate: "2026-08-20",
        occurrenceOverrides: new Map([["2026-08-20", { coverPhotoId: "session-cover", coverImage: null }]]),
      },
    );
    expect(publicOccurrence.coverImage).toBe(
      "/api/calendar/events/event-1_2026-08-20/cover?occurrence=2026-08-20",
    );
    expect(publicOccurrence).not.toHaveProperty("coverPhotoId");
  });

  it("bounds queries, validates identifiers, roles, and formats iCal values", () => {
    expect(parseLimit("999", 20, 50)).toBe(50);
    expect(parseLimit("bad", 20, 50)).toBe(20);
    expect(parseId("safe_record-1")).toBe("safe_record-1");
    expect(() => parseId("unsafe/path", "event")).toThrow("Invalid event identifier");
    expect(canPublish("mentor")).toBe(true);
    expect(canPublish("member")).toBe(false);
    expect(readString("text")).toBe("text");
    expect(readString(1)).toBeNull();
    expect(escapeIcalText("One, two; three\nnext")).toBe("One\\, two\\; three\\nnext");
    expect(formatIcalDate("2026-08-20T18:00:00.000Z")).toBe("20260820T180000Z");
    expect(formatIcalDate("bad")).toBeNull();
    expect(addHours("2026-08-20T18:00:00.000Z", 2)).toBe("20260820T200000Z");
    expect(addHours("bad", 2)).toBeNull();
  });
});
