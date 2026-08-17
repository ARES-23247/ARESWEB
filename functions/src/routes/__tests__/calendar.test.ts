import { beforeEach, describe, expect, it, vi } from "vitest";
import calendarRouter, { ensureCalendarPublisher } from "../calendar";
import { adminDb } from "../../lib/firebase-admin";

vi.mock("../../lib/firebase-admin", () => {
  const query = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };
  const revisionRef = { id: "revision-1" };
  const nestedQuery = {
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };
  const occurrencesQuery = {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };
  const occurrenceGet = vi.fn();
  const occurrenceSet = vi.fn();
  const occurrenceRef = { id: "2026-08-20", get: occurrenceGet, set: occurrenceSet };
  const documentRef = {
    id: "generated-1",
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    collection: vi.fn((name: string) => {
      if (name === "photos") return nestedQuery;
      if (name === "occurrences") {
        return {
          ...occurrencesQuery,
          doc: vi.fn((date?: string) => date
            ? { id: date, get: occurrenceGet, set: occurrenceSet }
            : occurrenceRef),
        };
      }
      return { doc: vi.fn(() => revisionRef) };
    }),
  };
  const collectionRef = {
    ...query,
    doc: vi.fn(() => documentRef),
  };
  const batch = {
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(),
  };
  return {
    adminDb: {
      collection: vi.fn(() => collectionRef),
      batch: vi.fn(() => batch),
      __occurrences: { queryGet: occurrencesQuery.get, docGet: occurrenceGet, docSet: occurrenceSet },
    },
  };
});

type Method = "get" | "post" | "put" | "patch" | "delete";

function handler(path: string, method: Method) {
  const layer = calendarRouter.stack.find((candidate) => (
    candidate.route?.path === path && candidate.route.methods[method]
  ));
  if (!layer?.route) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack.at(-1)!.handle;
}

function eventDocument(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      title: "Team Practice",
      dateStart: "2026-08-20T18:00:00.000Z",
      dateEnd: "2026-08-20T20:00:00.000Z",
      location: "Team Lab",
      category: "internal",
      status: "published",
      isDeleted: 0,
      createdBy: "private-user-id",
      internalNotes: "do not expose",
      ...overrides,
    }),
  };
}

describe("calendar API", () => {
  let req: Record<string, unknown>;
  let res: {
    json: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
  let next: ReturnType<typeof vi.fn>;
  let collectionRef: any;
  let documentRef: any;
  let batch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { query: {}, params: {}, body: {}, user: { uid: "member-1" }, authorizationRole: "member" };
    res = {
      json: vi.fn(),
      send: vi.fn(),
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    collectionRef = adminDb.collection("events") as any;
    documentRef = collectionRef.doc("event-1");
    batch = adminDb.batch();
    collectionRef.get.mockResolvedValue({ docs: [] });
    documentRef.get.mockResolvedValue({ exists: true, id: "event-1", data: () => eventDocument("event-1").data() });
    documentRef.set.mockResolvedValue(undefined);
    documentRef.update.mockResolvedValue(undefined);
    batch.commit.mockResolvedValue(undefined);
    documentRef.collection("photos").get.mockResolvedValue({ docs: [] });
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({ docs: [] });
    (adminDb as any).__occurrences.docSet.mockReset();
    (adminDb as any).__occurrences.docSet.mockResolvedValue(undefined);
  });

  async function expectApiError(
    path: string,
    method: Method,
    status: number,
    code?: string,
  ) {
    await handler(path, method)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status, ...(code ? { code } : {}) }));
    expect(res.json).not.toHaveBeenCalled();
  }

  it("returns only bounded public DTO fields and a cursor", async () => {
    req.query = { limit: "2" };
    collectionRef.get.mockResolvedValue({
      docs: [eventDocument("event-1"), eventDocument("event-2"), eventDocument("event-3")],
    });

    await handler("/events", "get")(req, res, next);

    expect(collectionRef.where).toHaveBeenCalledWith("isDeleted", "==", 0);
    expect(collectionRef.where).toHaveBeenCalledWith("status", "==", "published");
    expect(collectionRef.limit).toHaveBeenCalledWith(3);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      nextCursor: "event-2",
      events: expect.arrayContaining([
        expect.objectContaining({ id: "event-1", title: "Team Practice" }),
      ]),
    }));
    const payload = res.json.mock.calls[0][0];
    expect(payload.events[0]).not.toHaveProperty("createdBy");
    expect(payload.events[0]).not.toHaveProperty("internalNotes");
    expect(payload.events[0]).not.toHaveProperty("status");
    expect(payload.events[0]).not.toHaveProperty("isDeleted");
    expect(payload.events[0]).not.toHaveProperty("location");
    expect(payload.events[0]).not.toHaveProperty("locationId");
  });

  it("returns one published event and hides archived or draft records", async () => {
    req.params = { id: "event-1" };
    await handler("/events/:id", "get")(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: "event-1", title: "Team Practice" }),
    }));

    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { status: "draft" }).data(),
    });
    await handler("/events/:id", "get")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 404, code: "EVENT_NOT_FOUND" }));
  });

  it("returns a venue address only after an explicit publication opt-in", async () => {
    req.params = { id: "event-1" };
    documentRef.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => eventDocument("event-1", { locationId: "public-library", category: "outreach" }).data(),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: "Public Library",
          address: "321 Main Street, Morgantown, WV 26505, US",
          isAddressPublic: 1,
          privateContact: "do not expose",
        }),
      });

    await handler("/events/:id", "get")(req, res, next);

    expect(adminDb.collection).toHaveBeenCalledWith("locations");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      event: expect.objectContaining({
        id: "event-1",
        publicVenue: {
          name: "Public Library",
          address: "321 Main Street, Morgantown, WV 26505, US",
        },
      }),
    });
    expect(res.json.mock.calls[0][0].event.publicVenue).not.toHaveProperty("privateContact");

    res.json.mockClear();
    documentRef.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => eventDocument("event-1", { locationId: "team-home" }).data(),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: "Private team location",
          address: "Private address",
          isAddressPublic: 0,
        }),
      });

    await handler("/events/:id", "get")(req, res, next);

    expect(res.json.mock.calls[0][0].event.publicVenue).toBeNull();
    expect(res.json.mock.calls[0][0].event).not.toHaveProperty("location");
    expect(res.json.mock.calls[0][0].event).not.toHaveProperty("locationId");
  });

  it("rejects missing, archived, and malformed public event IDs", async () => {
    req.params = { id: "missing" };
    documentRef.get.mockResolvedValueOnce({ exists: false, data: () => undefined });
    await expectApiError("/events/:id", "get", 404, "EVENT_NOT_FOUND");

    next.mockClear();
    req.params = { id: "archived" };
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("archived", { isDeleted: 1 }).data(),
    });
    await expectApiError("/events/:id", "get", 404, "EVENT_NOT_FOUND");

    next.mockClear();
    req.params = { id: "bad id" };
    await expectApiError("/events/:id", "get", 400, "INVALID_ID");
  });

  it("returns bounded event-photo DTOs without uploader or operational metadata", async () => {
    req.params = { id: "event-1" };
    req.query = { limit: "2" };
    const photoCollection = documentRef.collection("photos");
    photoCollection.get.mockResolvedValueOnce({
      docs: [
        {
          id: "photo-safe",
          data: () => ({
            url: "https://images.example.test/practice.jpg",
            thumbnailUrl: "https://images.example.test/practice-thumb.webp",
            mediumUrl: "javascript:alert(1)",
            filename: "Drive practice.jpg",
            uploadedBy: "student-private-id",
            uploadedAt: "2026-08-10T12:00:00.000Z",
            storagePath: "private/path",
            isDeleted: 0,
          }),
        },
        {
          id: "photo-deleted",
          data: () => ({ url: "https://images.example.test/deleted.jpg", isDeleted: 1 }),
        },
        {
          id: "photo-unsafe",
          data: () => ({ url: "http://images.example.test/unsafe.jpg", isDeleted: 0 }),
        },
      ],
    });

    await handler("/events/:id/photos", "get")(req, res, next);

    expect(photoCollection.orderBy).toHaveBeenCalledWith("uploadedAt", "desc");
    expect(photoCollection.limit).toHaveBeenCalledWith(4);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      photos: [{
        id: "photo-safe",
        url: "https://images.example.test/practice.jpg",
        thumbnailUrl: "https://images.example.test/practice-thumb.webp",
        mediumUrl: null,
        filename: "Drive practice.jpg",
      }],
    });
    const payload = res.json.mock.calls[0][0];
    expect(payload.photos[0]).not.toHaveProperty("uploadedBy");
    expect(payload.photos[0]).not.toHaveProperty("uploadedAt");
    expect(payload.photos[0]).not.toHaveProperty("storagePath");
  });

  it("does not query photos for a non-public event and forwards photo query failures", async () => {
    req.params = { id: "event-1" };
    const photoCollection = documentRef.collection("photos");
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { status: "draft" }).data(),
    });
    await expectApiError("/events/:id/photos", "get", 404, "EVENT_NOT_FOUND");
    expect(photoCollection.get).not.toHaveBeenCalled();

    next.mockClear();
    res.json.mockClear();
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1").data(),
    });
    photoCollection.get.mockRejectedValueOnce(new Error("photo query unavailable"));
    await handler("/events/:id/photos", "get")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "photo query unavailable" }));
    expect(res.json).not.toHaveBeenCalled();
  });

  it("applies a valid cursor and rejects stale or malformed cursors", async () => {
    const cursorSnapshot = { exists: true, id: "event-2", data: () => eventDocument("event-2").data() };
    req.query = { cursor: "event-2" };
    documentRef.get.mockResolvedValueOnce(cursorSnapshot);
    collectionRef.get.mockResolvedValueOnce({ docs: [] });
    await handler("/events", "get")(req, res, next);
    expect(collectionRef.startAfter).toHaveBeenCalledWith(cursorSnapshot);

    vi.clearAllMocks();
    documentRef.get.mockResolvedValueOnce({ exists: false });
    collectionRef.get.mockResolvedValue({ docs: [] });
    req.query = { cursor: "stale" };
    await expectApiError("/events", "get", 400, "INVALID_CURSOR");

    next.mockClear();
    req.query = { cursor: "bad cursor" };
    await expectApiError("/events", "get", 400, "INVALID_ID");
  });

  it("returns a bounded manager DTO page including lifecycle metadata", async () => {
    req.query = { limit: "1" };
    collectionRef.get.mockResolvedValueOnce({
      docs: [
        eventDocument("event-1", { status: "draft", isDeleted: 1 }),
        eventDocument("event-2", { status: "pending" }),
      ],
    });
    await handler("/manage", "get")(req, res, next);
    expect(collectionRef.orderBy).toHaveBeenCalledWith("dateStart", "asc");
    expect(collectionRef.limit).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      events: [expect.objectContaining({ id: "event-1", status: "draft", isDeleted: 1 })],
      nextCursor: "event-1",
    });
  });

  it("applies cursors to manager pages and forwards query failures", async () => {
    const cursorSnapshot = { exists: true, id: "event-1" };
    req.query = { cursor: "event-1", limit: "999" };
    documentRef.get.mockResolvedValueOnce(cursorSnapshot);
    collectionRef.get.mockResolvedValueOnce({ docs: [] });
    await handler("/manage", "get")(req, res, next);
    expect(collectionRef.startAfter).toHaveBeenCalledWith(cursorSnapshot);
    expect(collectionRef.limit).toHaveBeenCalledWith(151);

    vi.clearAllMocks();
    req.query = {};
    collectionRef.get.mockRejectedValueOnce(new Error("manager query unavailable"));
    await handler("/manage", "get")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "manager query unavailable" }));
  });

  it("forces member-created events to pending and writes revision and audit records atomically", async () => {
    req.body = {
      title: "Student practice idea",
      dateStart: "2026-09-10T18:00:00.000Z",
      category: "internal",
      status: "published",
    };

    await handler("/manage", "post")(req, res, next);

    expect(batch.set).toHaveBeenCalledWith(documentRef, expect.objectContaining({
      status: "pending",
      isDeleted: 0,
      createdBy: "member-1",
    }));
    expect(batch.set).toHaveBeenCalledTimes(3);
    expect(batch.commit).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("allows publishers to create published or explicitly drafted events", async () => {
    req.authorizationRole = "coach";
    req.body = {
      title: "Publisher practice",
      dateStart: "2026-09-10T18:00:00.000Z",
      category: "internal",
    };
    await handler("/manage", "post")(req, res, next);
    expect(batch.set).toHaveBeenCalledWith(documentRef, expect.objectContaining({ status: "published" }));

    vi.clearAllMocks();
    batch.commit.mockResolvedValue(undefined);
    req.body = { ...req.body as object, status: "draft" };
    await handler("/manage", "post")(req, res, next);
    expect(batch.set).toHaveBeenCalledWith(documentRef, expect.objectContaining({ status: "draft" }));
  });

  it("rejects invalid event bodies without writing fake success", async () => {
    req.body = { title: "", dateStart: "not-a-date", category: "internal" };
    await handler("/manage", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    expect(batch.commit).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("allows only calendar publishers through the lifecycle middleware", () => {
    const unauthenticated = { authorizationRole: "admin" } as any;
    ensureCalendarPublisher(unauthenticated, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));

    next.mockClear();
    const middlewareReq = { user: { uid: "member-1" }, authorizationRole: "member" } as any;
    ensureCalendarPublisher(middlewareReq, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));

    next.mockClear();
    middlewareReq.authorizationRole = "mentor";
    ensureCalendarPublisher(middlewareReq, res as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("updates a draft event as pending for a member and audits the revision", async () => {
    req.params = { id: "event-1" };
    req.body = {
      title: "Revised practice",
      dateStart: "2026-09-10T18:00:00.000Z",
      category: "internal",
      status: "published",
    };
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { status: "draft" }).data(),
    });
    await handler("/manage/:id", "put")(req, res, next);
    expect(batch.update).toHaveBeenCalledWith(documentRef, expect.objectContaining({ status: "pending", updatedBy: "member-1" }));
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ success: true, event: expect.objectContaining({ id: "event-1", status: "pending" }) });
  });

  it("lets a publisher update an event with a safe default draft status", async () => {
    req.authorizationRole = "mentor";
    req.params = { id: "event-1" };
    req.body = {
      title: "Revised practice",
      dateStart: "2026-09-10T18:00:00.000Z",
      category: "internal",
    };
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { status: "published" }).data(),
    });
    await handler("/manage/:id", "put")(req, res, next);
    expect(batch.update).toHaveBeenCalledWith(documentRef, expect.objectContaining({ status: "draft" }));
  });

  it("rejects edits to archived events and member edits to published events", async () => {
    req.params = { id: "event-1" };
    req.body = { title: "Edit", dateStart: "2026-09-10T18:00:00.000Z", category: "internal" };
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { isDeleted: 1 }).data(),
    });
    await expectApiError("/manage/:id", "put", 409, "EVENT_ARCHIVED");

    next.mockClear();
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { status: "published" }).data(),
    });
    await expectApiError("/manage/:id", "put", 403);
  });

  it("archives and restores events without hard deletion", async () => {
    req.authorizationRole = "coach";
    req.params = { id: "event-1" };
    await handler("/manage/:id", "delete")(req, res, next);
    expect(batch.update).toHaveBeenCalledWith(documentRef, expect.objectContaining({ isDeleted: 1 }));
    expect(batch.commit).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    documentRef.get.mockResolvedValue({
      exists: true,
      data: () => eventDocument("event-1", { isDeleted: 1 }).data(),
    });
    batch.commit.mockResolvedValue(undefined);
    await handler("/manage/:id/restore", "patch")(req, res, next);
    expect(batch.update).toHaveBeenCalledWith(documentRef, expect.objectContaining({
      isDeleted: 0,
      status: "draft",
      archivedAt: null,
    }));
  });

  it("keeps repeated event lifecycle operations idempotent", async () => {
    req.authorizationRole = "admin";
    req.params = { id: "event-1" };
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { isDeleted: 1 }).data(),
    });
    await handler("/manage/:id", "delete")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true, archived: true, message: "Event is already archived." });
    expect(batch.commit).not.toHaveBeenCalled();

    vi.clearAllMocks();
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { isDeleted: 0 }).data(),
    });
    await handler("/manage/:id/restore", "patch")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true, restored: true, message: "Event is already active." });
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("publishes active events and refuses archived ones", async () => {
    req.authorizationRole = "coach";
    req.params = { id: "event-1" };
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { status: "draft" }).data(),
    });
    await handler("/manage/:id/publish", "patch")(req, res, next);
    expect(documentRef.update).toHaveBeenCalledWith(expect.objectContaining({ status: "published", publishedBy: "member-1" }));
    expect(res.json).toHaveBeenCalledWith({ success: true, published: true, message: "Event published successfully." });

    vi.clearAllMocks();
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { isDeleted: 1 }).data(),
    });
    await expectApiError("/manage/:id/publish", "patch", 409, "EVENT_ARCHIVED");
  });

  it("creates and archives venues through protected lifecycle endpoints", async () => {
    req.authorizationRole = "admin";
    req.body = { name: "Community Center", address: "Morgantown, WV" };
    await handler("/locations", "post")(req, res, next);
    expect(documentRef.set).toHaveBeenCalledWith(expect.objectContaining({
      name: "Community Center",
      isDeleted: 0,
    }));
    expect(res.status).toHaveBeenCalledWith(201);

    req.params = { id: "venue-1" };
    documentRef.get.mockResolvedValue({ exists: true, data: () => ({ name: "Community Center" }) });
    await handler("/locations/:id", "delete")(req, res, next);
    expect(documentRef.update).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 1 }));
  });

  it("lists explicit venue DTOs in name order", async () => {
    collectionRef.get.mockResolvedValueOnce({ docs: [
      { id: "venue-1", data: () => ({ name: "Team Lab", address: "Morgantown, WV", isDeleted: 0, ownerUid: "private" }) },
      { id: "venue-2", data: () => ({ name: "Old Lab", isDeleted: 1 }) },
    ] });
    await handler("/locations", "get")(req, res, next);
    expect(collectionRef.orderBy).toHaveBeenCalledWith("name", "asc");
    expect(collectionRef.limit).toHaveBeenCalledWith(150);
    const payload = res.json.mock.calls[0][0];
    expect(payload.locations).toEqual([
      expect.objectContaining({ id: "venue-1", name: "Team Lab" }),
      expect.objectContaining({ id: "venue-2", isDeleted: 1 }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("ownerUid");
  });

  it("updates an active venue and rejects missing or archived venues", async () => {
    req.authorizationRole = "admin";
    req.params = { id: "venue-1" };
    req.body = { name: "Updated Lab", address: "Morgantown, WV", gmapsUrl: "https://maps.google.com/example" };
    documentRef.get.mockResolvedValueOnce({ exists: true, data: () => ({ name: "Old Lab", isDeleted: 0 }) });
    await handler("/locations/:id", "put")(req, res, next);
    expect(documentRef.update).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated Lab", updatedBy: "member-1" }));
    expect(res.json).toHaveBeenCalledWith({ success: true, location: expect.objectContaining({ id: "venue-1", name: "Updated Lab" }) });

    vi.clearAllMocks();
    documentRef.get.mockResolvedValueOnce({ exists: false, data: () => undefined });
    await expectApiError("/locations/:id", "put", 404, "LOCATION_NOT_FOUND");

    next.mockClear();
    documentRef.get.mockResolvedValueOnce({ exists: true, data: () => ({ name: "Old", isDeleted: 1 }) });
    await expectApiError("/locations/:id", "put", 409, "LOCATION_ARCHIVED");
  });

  it("rejects missing venue archive targets and restores existing venues", async () => {
    req.authorizationRole = "admin";
    req.params = { id: "venue-1" };
    documentRef.get.mockResolvedValueOnce({ exists: false });
    await expectApiError("/locations/:id", "delete", 404, "LOCATION_NOT_FOUND");

    next.mockClear();
    documentRef.get.mockResolvedValueOnce({ exists: true, data: () => ({ name: "Team Lab", isDeleted: 1 }) });
    await handler("/locations/:id/restore", "patch")(req, res, next);
    expect(documentRef.update).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 0, archivedAt: null, restoredBy: "member-1" }));
    expect(res.json).toHaveBeenCalledWith({ success: true, restored: true, message: "Venue restored successfully." });

    vi.clearAllMocks();
    documentRef.get.mockResolvedValueOnce({ exists: false });
    await expectApiError("/locations/:id/restore", "patch", 404, "LOCATION_NOT_FOUND");
  });

  it("builds a truthful feed, escapes text, and skips malformed dates", async () => {
    collectionRef.get.mockResolvedValue({
      docs: [
        eventDocument("event-1", { title: "Practice, Build; Test", description: "Line one\nLine two" }),
        eventDocument("bad-date", { dateStart: "not-a-date" }),
      ],
    });

    await handler("/feed", "get")(req, res, next);

    const feed = res.send.mock.calls[0][0] as string;
    expect(feed).toContain("UID:event-1@aresfirst.org");
    expect(feed).toContain("SUMMARY:Practice\\, Build\\; Test");
    expect(feed).toContain("DESCRIPTION:Line one\\nLine two");
    expect(feed).not.toContain("bad-date@aresfirst.org");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/calendar; charset=utf-8");
  });

  it("uses truthful feed fallbacks for missing end, update, title, and optional fields", async () => {
    collectionRef.get.mockResolvedValueOnce({ docs: [eventDocument("fallback", {
      title: undefined,
      dateEnd: undefined,
      updatedAt: undefined,
      description: undefined,
      location: undefined,
    })] });
    await handler("/feed", "get")(req, res, next);
    const feed = res.send.mock.calls[0][0] as string;
    expect(feed).toContain("UID:fallback@aresfirst.org");
    expect(feed).toContain("SUMMARY:Untitled event");
    expect(feed).toContain("DTEND:20260820T200000Z");
    expect(feed).not.toContain("DESCRIPTION:");
    expect(feed).not.toContain("LOCATION:");
    expect(res.setHeader).toHaveBeenCalledTimes(5);
  });

  it("forwards Firestore failures instead of returning an empty success", async () => {
    collectionRef.get.mockRejectedValueOnce(new Error("Firestore unavailable"));
    await handler("/events", "get")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("calendar recurrence", () => {
  const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
  const today = new Date();
  const todayYmdStr = today.toISOString().slice(0, 10);
  const todayCode = WEEKDAYS[(today.getUTCDay() + 6) % 7];
  const weeklyRule = { frequency: "weekly", interval: 1, byDay: [todayCode] };

  function recurringDocument(id = "weekly-1") {
    return eventDocument(id, {
      dateStart: `${todayYmdStr}T18:00:00.000Z`,
      dateEnd: `${todayYmdStr}T20:00:00.000Z`,
      recurrence: weeklyRule,
    });
  }

  let req: Record<string, unknown>;
  let res: { json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;
  let collectionRef: any;
  let documentRef: any;
  let batch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { query: {}, params: {}, body: {}, user: { uid: "member-1" }, authorizationRole: "mentor" };
    res = { json: vi.fn(), send: vi.fn(), setHeader: vi.fn(), status: vi.fn().mockReturnThis() };
    next = vi.fn();
    collectionRef = adminDb.collection("events") as any;
    documentRef = collectionRef.doc("weekly-1");
    batch = adminDb.batch();
    collectionRef.get.mockResolvedValue({ docs: [] });
    documentRef.get.mockResolvedValue({ exists: true, id: "weekly-1", data: () => recurringDocument().data() });
    documentRef.set.mockResolvedValue(undefined);
    documentRef.update.mockResolvedValue(undefined);
    batch.commit.mockResolvedValue(undefined);
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({ docs: [] });
    (adminDb as any).__occurrences.docSet.mockReset();
    (adminDb as any).__occurrences.docSet.mockResolvedValue(undefined);
  });

  it("expands a recurring event into upcoming occurrences in list pages", async () => {
    collectionRef.get.mockResolvedValue({ docs: [recurringDocument()] });
    await handler("/events", "get")(req, res, next);
    const payload = res.json.mock.calls[0][0];
    // One weekly byDay emits the next four sessions (today + three weeks).
    expect(payload.events).toHaveLength(4);
    const occurrence = payload.events[0];
    expect(occurrence.id).toBe(`weekly-1_${todayYmdStr}`);
    expect(occurrence.recurrenceOf).toBe("weekly-1");
    expect(occurrence.dateStart).toContain("T18:00:00.000Z");
    expect(occurrence.occurrenceDate).toBe(todayYmdStr);
    expect(payload.events[3].id).toBe(`weekly-1_${new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`);
    expect(occurrence.recurrence).toEqual(weeklyRule);
  });

  it("skips cancelled occurrence dates during expansion", async () => {
    collectionRef.get.mockResolvedValue({ docs: [recurringDocument()] });
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({
      docs: [{ id: todayYmdStr, data: () => ({ isCancelled: 1 }) }],
    });
    await handler("/events", "get")(req, res, next);
    const payload = res.json.mock.calls[0][0];
    // The 56-day window offers eight weekly candidates; one cancellation
    // removes today and the max-4 slice refills from the remaining weeks.
    expect(payload.events).toHaveLength(4);
    expect(payload.events.map((event: any) => event.occurrenceDate)).not.toContain(todayYmdStr);
  });

  it("keeps plain events untouched by expansion", async () => {
    collectionRef.get.mockResolvedValue({ docs: [eventDocument("plain-1")] });
    await handler("/events", "get")(req, res, next);
    const payload = res.json.mock.calls[0][0];
    expect(payload.events[0].id).toBe("plain-1");
    expect(payload.events[0].recurrenceOf).toBeUndefined();
    expect(payload.events[0].recurrence).toBeUndefined();
  });

  it("rejects invalid recurrence rules on write", async () => {
    req.body = {
      title: "Weekly Practice",
      dateStart: `${todayYmdStr}T18:00:00.000Z`,
      category: "internal",
      recurrence: { frequency: "weekly", interval: 9, byDay: ["MO"] },
    };
    await handler("/manage", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    expect(res.json).not.toHaveBeenCalled();
  });

  it("rejects a recurrence that ends before the first session", async () => {
    req.body = {
      title: "Weekly Practice",
      dateStart: `${todayYmdStr}T18:00:00.000Z`,
      category: "internal",
      recurrence: { frequency: "weekly", interval: 1, byDay: ["MO"], until: "2000-01-01" },
    };
    await handler("/manage", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  it("persists the recurrence rule on create", async () => {
    req.body = {
      title: "Weekly Practice",
      dateStart: `${todayYmdStr}T18:00:00.000Z`,
      dateEnd: `${todayYmdStr}T20:00:00.000Z`,
      category: "internal",
      recurrence: { frequency: "weekly", interval: 2, byDay: ["TU", "TH"] },
    };
    await handler("/manage", "post")(req, res, next);
    expect(batch.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      recurrence: { frequency: "weekly", interval: 2, byDay: ["TU", "TH"] },
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].event.recurrence).toEqual({ frequency: "weekly", interval: 2, byDay: ["TU", "TH"] });
  });

  it("guards occurrence endpoints behind the publisher role and validates dates", async () => {
    const cancelLayer = calendarRouter.stack.find((entry) => (
      entry.route?.path === "/manage/:id/occurrences/:date" && entry.route.methods.patch
    ));
    expect(cancelLayer?.route?.stack.map((entry: any) => entry.name)).toEqual([
      "ensureTeamMember",
      "ensureCalendarPublisher",
      expect.any(String),
    ]);

    req.params = { id: "weekly-1", date: "not-a-date" };
    await handler("/manage/:id/occurrences/:date", "patch")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "INVALID_DATE" }));
  });

  it("cancels and restores a single occurrence with audit trail", async () => {
    req.params = { id: "weekly-1", date: "2026-09-03" };
    req.body = { cancelled: true };
    await handler("/manage/:id/occurrences/:date", "patch")(req, res, next);
    expect((adminDb as any).__occurrences.docSet).toHaveBeenCalledWith(
      expect.objectContaining({ isCancelled: 1, date: "2026-09-03" }),
      { merge: true },
    );

    (adminDb as any).__occurrences.docGet.mockResolvedValue({ exists: true, data: () => ({ isCancelled: 1 }) });
    await handler("/manage/:id/occurrences/:date/restore", "patch")(req, res, next);
    expect((adminDb as any).__occurrences.docSet).toHaveBeenCalledWith(
      expect.objectContaining({ isCancelled: 0 }),
      { merge: true },
    );
  });

  it("refuses occurrence operations on non-recurring events", async () => {
    documentRef.get.mockResolvedValue({ exists: true, id: "plain-1", data: () => eventDocument("plain-1").data() });
    req.params = { id: "plain-1", date: "2026-09-03" };
    req.body = { cancelled: true };
    await handler("/manage/:id/occurrences/:date", "patch")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409, code: "NOT_RECURRING" }));
  });

  it("lists stored occurrence exceptions", async () => {
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({
      docs: [{ id: "2026-09-03", data: () => ({ isCancelled: 1 }) }],
    });
    req.params = { id: "weekly-1" };
    await handler("/manage/:id/occurrences", "get")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      occurrences: [{ date: "2026-09-03", isCancelled: true }],
    });
  });

  it("emits RRULE and EXDATE lines for recurring events in the feed", async () => {
    const thursday = eventDocument("weekly-1", {
      dateStart: "2026-08-20T18:00:00.000Z",
      dateEnd: "2026-08-20T20:00:00.000Z",
      recurrence: { frequency: "weekly", interval: 2, byDay: ["TH"], until: "2026-12-31" },
    });
    collectionRef.get.mockResolvedValue({ docs: [thursday] });
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({
      docs: [{ id: "2026-09-03", data: () => ({ isCancelled: 1 }) }],
    });
    await handler("/feed", "get")(req, res, next);
    const body = res.send.mock.calls[0][0] as string;
    expect(body).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH;UNTIL=20261231T235959Z");
    expect(body).toContain("EXDATE:20260903T180000Z");
    expect(body).toContain("UID:weekly-1@aresfirst.org");
  });
});
