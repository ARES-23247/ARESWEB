import { describe, expect, it } from "vitest";
import {
  addHours,
  canPublish,
  escapeIcalText,
  eventDto,
  eventPhotoDto,
  eventWriteData,
  eventWriteSchema,
  formatIcalDate,
  locationDto,
  locationWriteSchema,
  parseBody,
  parseId,
  parseLimit,
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
    expect(eventWriteData(event, "pending")).toMatchObject({ status: "pending", isPotluck: 0 });
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

    const competitionDto = eventDto("event-comp", {
      title: "WV State Championship",
      dateStart: "2026-11-15T08:00:00.000Z",
      category: "competition",
    } as never, false);
    expect(competitionDto).toMatchObject({ id: "event-comp", category: "competition" });

    expect(eventDto("event-2", { status: "invalid", isDeleted: 1 }, true)).toMatchObject({
      status: "draft",
      isDeleted: 1,
    });
    expect(locationDto("venue-1", { name: 123, address: "WV", isDeleted: 1, isAddressPublic: 1 })).toMatchObject({
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
    expect(publicVenueDto({ name: "Private home", address: "private", isAddressPublic: 0 })).toBeNull();
    expect(publicVenueDto({ name: "Archived", address: "public", isAddressPublic: 1, isDeleted: 1 })).toBeNull();

    expect(eventPhotoDto("photo-1", {
      url: "https://images.example.test/practice.jpg",
      filename: "Practice.jpg",
      uploadedBy: "private-user-id",
      uploadedAt: "2026-08-10T12:00:00.000Z",
      isDeleted: 0,
    })).toEqual({
      id: "photo-1",
      url: "https://images.example.test/practice.jpg",
      filename: "Practice.jpg",
      thumbnailUrl: null,
      mediumUrl: null,
    });
    expect(eventPhotoDto("photo-fallback", {
      url: "https://images.example.test/photo.jpg",
    })).toEqual(expect.objectContaining({ filename: "Event photo" }));
    expect(eventPhotoDto("photo-deleted", {
      url: "https://images.example.test/deleted.jpg",
      isDeleted: 1,
    })).toBeNull();
    expect(eventPhotoDto("photo-http", { url: "http://images.example.test/photo.jpg" })).toBeNull();
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
