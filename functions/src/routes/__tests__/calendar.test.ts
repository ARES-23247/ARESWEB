import { beforeEach, describe, expect, it, vi } from "vitest";
import calendarRouter, { ensureCalendarPublisher } from "../calendar";
import { adminDb, adminStorage } from "../../lib/firebase-admin";

const { streamPipeline } = vi.hoisted(() => ({ streamPipeline: vi.fn() }));
vi.mock("node:stream/promises", () => ({ pipeline: streamPipeline }));

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
    doc: vi.fn(),
  };
  const photoGet = vi.fn();
  const photoSet = vi.fn();
  const photoUpdate = vi.fn();
  const photoRef = {
    get: photoGet,
    set: photoSet,
    update: photoUpdate,
  };
  nestedQuery.doc.mockReturnValue(photoRef);
  const occurrencesQuery = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };
  const occurrenceGet = vi.fn();
  const occurrenceSet = vi.fn();
  const occurrenceRef = {
    id: "2026-08-20",
    get: occurrenceGet,
    set: occurrenceSet,
  };
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
          doc: vi.fn((date?: string) =>date ? { id: date, get: occurrenceGet, set: occurrenceSet } : occurrenceRef),
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
  const transaction = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const getAll = vi.fn();
  const storageGetMetadata = vi.fn();
  const storageCreateReadStream = vi.fn(() => ({ kind: "calendar-photo-stream" }));
  const storageFile = vi.fn(() => ({
    getMetadata: storageGetMetadata,
    createReadStream: storageCreateReadStream,
  }));
  return {
    adminDb: {
      collection: vi.fn(() => collectionRef),
      collectionGroup: vi.fn(() => occurrencesQuery),
      getAll,
      batch: vi.fn(() => batch),
      runTransaction: vi.fn(
        async (operation: (value: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
      __occurrences: {
        queryGet: occurrencesQuery.get,
        docGet: occurrenceGet,
        docSet: occurrenceSet,
      },
      __photo: {
        get: photoGet,
        set: photoSet,
        update: photoUpdate,
    },
      __transaction: transaction,
      __getAll: getAll,
    },
    adminStorage: {
      bucket: vi.fn(() => ({ file: storageFile, name: "ares-test.firebasestorage.app" })),
      __file: storageFile,
      __getMetadata: storageGetMetadata,
      __createReadStream: storageCreateReadStream,
    },
  };
});

type Method = "get" | "post" | "put" | "patch" | "delete";

function handler(path: string, method: Method) {
  const layer = calendarRouter.stack.find(
    (candidate) => candidate.route?.path === path && candidate.route.methods[method],
  );
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

function occurrenceExceptionDocument(
  parentId: string,
  date: string,
  data: Record<string, unknown>,
) {
  return {
    id: date,
    ref: { parent: { parent: { id: parentId } } },
    data: () => ({ date, ...data }),
  };
}

describe("calendar API", () => {
  let req: Record<string, unknown>;
  let res: {
    json: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  let next: ReturnType<typeof vi.fn>;
  let collectionRef: any;
  let documentRef: any;
  let batch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      query: {},
      params: {},
      body: {},
      user: { uid: "member-1" },
      authorizationRole: "member",
    };
    res = {
      json: vi.fn(),
      send: vi.fn(),
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    collectionRef = adminDb.collection("events") as any;
    documentRef = collectionRef.doc("event-1");
    batch = adminDb.batch();
    collectionRef.get.mockResolvedValue({ docs: [] });
    documentRef.get.mockResolvedValue({
      exists: true,
      id: "event-1",
      data: () => eventDocument("event-1").data(),
    });
    documentRef.set.mockResolvedValue(undefined);
    documentRef.update.mockResolvedValue(undefined);
    batch.commit.mockResolvedValue(undefined);
    (adminDb as any).__photo.get.mockResolvedValue({ exists: false, data: () => undefined });
    (adminStorage as any).__getMetadata.mockResolvedValue([{ contentType: "image/jpeg", etag: '"event-photo"' }]);
    streamPipeline.mockResolvedValue(undefined);
    documentRef.collection("photos").get.mockResolvedValue({ docs: [] });
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({ docs: [] });
    (adminDb as any).__occurrences.docGet.mockResolvedValue({
      exists: false,
      data: () => undefined,
    });
    (adminDb as any).__occurrences.docSet.mockReset();
    (adminDb as any).__occurrences.docSet.mockResolvedValue(undefined);
    (adminDb as any).__photo.get.mockResolvedValue({
      exists: false,
      data: () => undefined,
    });
    (adminDb as any).__photo.set.mockResolvedValue(undefined);
    (adminDb as any).__photo.update.mockResolvedValue(undefined);
    (adminDb as any).__transaction.get.mockResolvedValue({
      exists: false,
      data: () => undefined,
    });
    (adminDb as any).__getAll.mockResolvedValue([]);
  });

  async function expectApiError(
    path: string,
    method: Method,
    status: number,
    code?: string,
  ) {
    await handler(path, method)(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status, ...(code ? { code } : {}) }),
    );
    expect(res.json).not.toHaveBeenCalled();
  }

  it("returns only bounded public DTO fields and a cursor", async () => {
    req.query = { limit: "2" };
    collectionRef.get.mockResolvedValue({
      docs: [
        eventDocument("event-1"),
        eventDocument("event-2"),
        eventDocument("event-3"),
      ],
    });

    await handler("/events", "get")(req, res, next);

    expect(collectionRef.where).toHaveBeenCalledWith("isDeleted", "==", 0);
    expect(collectionRef.where).toHaveBeenCalledWith(
      "status",
      "==",
      "published",
    );
    expect(collectionRef.limit).toHaveBeenCalledWith(3);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        nextCursor: "event-2",
        events: expect.arrayContaining([
          expect.objectContaining({ id: "event-1", title: "Team Practice" }),
        ]),
      }),
    );
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          id: "event-1",
          title: "Team Practice",
        }),
      }),
    );

    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { status: "draft" }).data(),
    });
    await handler("/events/:id", "get")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 404, code: "EVENT_NOT_FOUND" }),
    );
  });

  it("returns a venue address only after an explicit publication opt-in", async () => {
    req.params = { id: "event-1" };
    documentRef.get
      .mockResolvedValueOnce({
        exists: true,
        data: () =>
          eventDocument("event-1", {
            locationId: "public-library",
            category: "outreach",
          }).data(),
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
    expect(res.json.mock.calls[0][0].event.publicVenue).not.toHaveProperty(
      "privateContact",
    );

    res.json.mockClear();
    documentRef.get
      .mockResolvedValueOnce({
        exists: true,
        data: () =>
          eventDocument("event-1", { locationId: "team-home" }).data(),
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

  it("returns only series and matching occurrence photos for a dated session", async () => {
    req.params = { id: "event-1" };
    req.query = { occurrence: "2026-08-20", limit: "20" };
    documentRef.collection("photos").get.mockResolvedValue({
      docs: [
        {
          id: "series",
          data: () => ({
            url: "https://images.example.test/series.jpg",
            filename: "Series",
            uploadedBy: "private",
            publicationStatus: "published",
          }),
        },
        {
          id: "matching",
          data: () => ({
            url: "https://images.example.test/session.jpg",
            filename: "Session",
            occurrenceDate: "2026-08-20",
            publicationStatus: "published",
          }),
        },
        {
          id: "other",
          data: () => ({
            url: "https://images.example.test/other.jpg",
            filename: "Other",
            occurrenceDate: "2026-08-27",
            publicationStatus: "published",
          }),
        },
      ],
    });

    await handler("/events/:id/photos", "get")(req, res, next);

    const photos = res.json.mock.calls[0][0].photos;
    expect(photos.map((photo: { id: string }) => photo.id)).toEqual([
      "series",
      "matching",
    ]);
    expect(photos[0]).not.toHaveProperty("uploadedBy");
    expect(photos[1].occurrenceDate).toBe("2026-08-20");
  });

  it("rejects malformed occurrence photo filters", async () => {
    req.params = { id: "event-1" };
    req.query = { occurrence: "tomorrow" };
    await expectApiError("/events/:id/photos", "get", 400, "INVALID_DATE");
  });

  it("rejects missing, archived, and malformed public event IDs", async () => {
    req.params = { id: "missing" };
    documentRef.get.mockResolvedValueOnce({
      exists: false,
      data: () => undefined,
    });
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
            sourcePhotoId: "photo-safe",
            filename: "Drive practice.jpg",
            uploadedBy: "student-private-id",
            uploadedAt: "2026-08-10T12:00:00.000Z",
            storagePath: "private/path",
            isDeleted: 0,
            publicationStatus: "published",
          }),
        },
        {
          id: "photo-deleted",
          data: () => ({
            url: "https://images.example.test/deleted.jpg",
            isDeleted: 1,
          }),
        },
        {
          id: "photo-unsafe",
          data: () => ({
            sourcePhotoId: "bad/path",
            isDeleted: 0,
            publicationStatus: "published",
          }),
        },
      ],
    });

    await handler("/events/:id/photos", "get")(req, res, next);

    expect(photoCollection.orderBy).toHaveBeenCalledWith("uploadedAt", "desc");
    expect(photoCollection.limit).toHaveBeenCalledWith(8);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      photos: [
        {
          id: "photo-safe",
          url: "/api/calendar/events/generated-1/photos/photo-safe/media/original",
          thumbnailUrl: "/api/calendar/events/generated-1/photos/photo-safe/media/thumbnail",
          mediumUrl: "/api/calendar/events/generated-1/photos/photo-safe/media/medium",
          filename: "Drive practice.jpg",
          occurrenceDate: null,
        },
      ],
    });
    const payload = res.json.mock.calls[0][0];
    expect(payload.photos[0]).not.toHaveProperty("uploadedBy");
    expect(payload.photos[0]).not.toHaveProperty("uploadedAt");
    expect(payload.photos[0]).not.toHaveProperty("storagePath");
  });

  it("streams a published event attachment through its managed source photo", async () => {
    req.params = { id: "event-1", photoId: "association-1", variant: "medium" };
    req.headers = {};
    documentRef.get
      .mockResolvedValueOnce({ exists: true, data: () => eventDocument("event-1").data() })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ storagePath: "gallery/source.jpg", mediumPath: "gallery/source-medium.webp", mimeType: "image/jpeg", isDeleted: 0 }),
      });
    (adminDb as any).__photo.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ sourcePhotoId: "source-1", publicationStatus: "published", isDeleted: 0 }),
    });

    await handler("/events/:id/photos/:photoId/media/:variant", "get")(req, res, next);

    expect((adminStorage as any).__file).toHaveBeenCalledWith("gallery/source-medium.webp");
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      "Content-Type": "image/jpeg",
      "Cache-Control": expect.stringContaining("public"),
    }));
    expect(streamPipeline).toHaveBeenCalledWith(
      (adminStorage as any).__createReadStream.mock.results.at(-1)?.value,
      res,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("streams a published managed event cover without exposing its storage path", async () => {
    req.params = { id: "event-1" };
    req.headers = {};
    documentRef.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => eventDocument("event-1", { coverPhotoId: "cover-1" }).data(),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          storagePath: "gallery/cover.jpg",
          mediumPath: "gallery/cover-medium.webp",
          mimeType: "image/jpeg",
          isDeleted: 0,
        }),
      });

    await handler("/events/:id/cover", "get")(req, res, next);

    expect((adminStorage as any).__file).toHaveBeenCalledWith("gallery/cover-medium.webp");
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      "Cache-Control": expect.stringContaining("public"),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it("uses an occurrence-specific managed cover when one is configured", async () => {
    req.params = { id: "event-1" };
    req.query = { occurrence: "2026-08-20" };
    req.headers = {};
    documentRef.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => eventDocument("event-1", { coverPhotoId: "series-cover" }).data(),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ storagePath: "gallery/session-cover.jpg", mimeType: "image/jpeg", isDeleted: 0 }),
      });
    (adminDb as any).__occurrences.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ overrides: { coverPhotoId: "session-cover", coverImage: null } }),
    });

    await handler("/events/:id/cover", "get")(req, res, next);

    expect((adminStorage as any).__file).toHaveBeenCalledWith("gallery/session-cover.jpg");
    expect(next).not.toHaveBeenCalled();
  });

  it("does not stream pending event attachments", async () => {
    req.params = { id: "event-1", photoId: "association-1", variant: "original" };
    req.headers = {};
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1").data(),
    });
    (adminDb as any).__photo.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ sourcePhotoId: "source-1", publicationStatus: "pending", isDeleted: 0 }),
    });

    await handler("/events/:id/photos/:photoId/media/:variant", "get")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: "PHOTO_NOT_FOUND" }));
    expect((adminStorage as any).__file).not.toHaveBeenCalled();
  });

  it("associates only a trusted imported photo and leaves member submissions pending", async () => {
    req.params = { id: "event-1" };
    req.body = { photoId: "photo-1", occurrenceDate: "2026-08-20" };
    documentRef.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => eventDocument("event-1").data(),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          storagePath: "gallery/event.jpg",
          thumbnailPath: "gallery/event-thumb.webp",
          originalFilename: "Progress.jpg",
          isDeleted: 0,
        }),
      });

    await handler("/manage/:id/photos", "post")(req, res, next);

    expect((adminDb as any).__transaction.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sourcePhotoId: "photo-1",
        publicationStatus: "pending",
        uploadedByUid: "member-1",
      }),
      { merge: false },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        photo: expect.objectContaining({ publicationStatus: "pending" }),
      }),
    );
  });

  it("does not overwrite an active event-photo association", async () => {
    req.params = { id: "event-1" };
    req.body = { photoId: "photo-1" };
    documentRef.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => eventDocument("event-1").data(),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          storagePath: "gallery/event.jpg",
          originalFilename: "Progress.jpg",
          isDeleted: 0,
        }),
      });
    (adminDb as any).__transaction.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ publicationStatus: "published", isDeleted: 0 }),
    });

    await expectApiError(
      "/manage/:id/photos",
      "post",
      409,
      "PHOTO_ALREADY_ATTACHED",
    );
    expect((adminDb as any).__transaction.set).not.toHaveBeenCalled();
  });

  it("rejects missing imported photos and restricts approval middleware to publishers", async () => {
    const approvalLayer = calendarRouter.stack.find(
      (entry) => entry.route?.path === "/manage/:id/photos/:photoId/approve",
    );
    expect(approvalLayer?.route?.stack.map((entry) => entry.name)).toEqual([
      "ensureTeamMember",
      "ensureCalendarPublisher",
      expect.any(String),
    ]);

    req.params = { id: "event-1" };
    req.body = { photoId: "missing" };
    documentRef.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => eventDocument("event-1").data(),
      })
      .mockResolvedValueOnce({ exists: false, data: () => undefined });

    await expectApiError("/manage/:id/photos", "post", 404, "PHOTO_NOT_FOUND");

    next.mockClear();
    req.body = { photoId: "x".repeat(129) };
    await expectApiError("/manage/:id/photos", "post", 400, "VALIDATION_ERROR");
  });

  it("allows an owner or publisher to archive and denies another member", async () => {
    req.params = { id: "event-1", photoId: "photo-1" };
    (adminDb as any).__photo.get.mockResolvedValue({
      exists: true,
      data: () => ({ uploadedByUid: "different-member", isDeleted: 0 }),
    });
    await expectApiError("/manage/:id/photos/:photoId", "delete", 403);

    next.mockClear();
    req.authorizationRole = "mentor";
    await handler("/manage/:id/photos/:photoId", "delete")(req, res, next);
    expect(batch.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isDeleted: 1 }),
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, archived: true });
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
    photoCollection.get.mockRejectedValueOnce(
      new Error("photo query unavailable"),
    );
    await handler("/events/:id/photos", "get")(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "photo query unavailable" }),
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  it("applies a valid cursor and rejects stale or malformed cursors", async () => {
    const cursorSnapshot = {
      exists: true,
      id: "event-2",
      data: () => eventDocument("event-2").data(),
    };
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
      events: [
        expect.objectContaining({
          id: "event-1",
          status: "draft",
          isDeleted: 1,
        }),
      ],
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
    collectionRef.get.mockRejectedValueOnce(
      new Error("manager query unavailable"),
    );
    await handler("/manage", "get")(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "manager query unavailable" }),
    );
  });

  it("forces member-created events to pending and writes revision and audit records atomically", async () => {
    req.body = {
      title: "Student practice idea",
      dateStart: "2026-09-10T18:00:00.000Z",
      category: "internal",
      status: "published",
    };

    await handler("/manage", "post")(req, res, next);

    expect(batch.set).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({
        status: "pending",
        isDeleted: 0,
        createdBy: "member-1",
      }),
    );
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
    expect(batch.set).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({ status: "published" }),
    );

    vi.clearAllMocks();
    batch.commit.mockResolvedValue(undefined);
    req.body = { ...(req.body as object), status: "draft" };
    await handler("/manage", "post")(req, res, next);
    expect(batch.set).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({ status: "draft" }),
    );
  });

  it("rejects invalid event bodies without writing fake success", async () => {
    req.body = { title: "", dateStart: "not-a-date", category: "internal" };
    await handler("/manage", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
    expect(batch.commit).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("rejects new direct URLs to the managed Storage bucket", async () => {
    req.body = {
      title: "Direct cover",
      dateStart: "2026-09-10T18:00:00.000Z",
      category: "internal",
      coverImage: "https://storage.googleapis.com/ares-test.firebasestorage.app/gallery/cover.jpg",
    };
    await handler("/manage", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      code: "DIRECT_STORAGE_URL",
    }));
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("allows only calendar publishers through the lifecycle middleware", () => {
    const unauthenticated = { authorizationRole: "admin" } as any;
    ensureCalendarPublisher(unauthenticated, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));

    next.mockClear();
    const middlewareReq = {
      user: { uid: "member-1" },
      authorizationRole: "member",
    } as any;
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
    expect(batch.update).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({ status: "pending", updatedBy: "member-1" }),
    );
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      event: expect.objectContaining({ id: "event-1", status: "pending" }),
    });
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
    expect(batch.update).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({ status: "draft" }),
    );
  });

  it("rejects edits to archived events and member edits to published events", async () => {
    req.params = { id: "event-1" };
    req.body = {
      title: "Edit",
      dateStart: "2026-09-10T18:00:00.000Z",
      category: "internal",
    };
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
    expect(batch.update).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({ isDeleted: 1 }),
    );
    expect(batch.commit).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    documentRef.get.mockResolvedValue({
      exists: true,
      data: () => eventDocument("event-1", { isDeleted: 1 }).data(),
    });
    batch.commit.mockResolvedValue(undefined);
    await handler("/manage/:id/restore", "patch")(req, res, next);
    expect(batch.update).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({
        isDeleted: 0,
        status: "draft",
        archivedAt: null,
      }),
    );
  });

  it("keeps repeated event lifecycle operations idempotent", async () => {
    req.authorizationRole = "admin";
    req.params = { id: "event-1" };
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { isDeleted: 1 }).data(),
    });
    await handler("/manage/:id", "delete")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      archived: true,
      message: "Event is already archived.",
    });
    expect(batch.commit).not.toHaveBeenCalled();

    vi.clearAllMocks();
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => eventDocument("event-1", { isDeleted: 0 }).data(),
    });
    await handler("/manage/:id/restore", "patch")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      restored: true,
      message: "Event is already active.",
    });
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
    expect(documentRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published", publishedBy: "member-1" }),
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      published: true,
      message: "Event published successfully.",
    });

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
    expect(documentRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Community Center",
        isDeleted: 0,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);

    req.params = { id: "venue-1" };
    documentRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ name: "Community Center" }),
    });
    await handler("/locations/:id", "delete")(req, res, next);
    expect(documentRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: 1 }),
    );
  });

  it("lists explicit venue DTOs in name order", async () => {
    collectionRef.get.mockResolvedValueOnce({
      docs: [
        {
          id: "venue-1",
          data: () => ({
            name: "Team Lab",
            address: "Morgantown, WV",
            isDeleted: 0,
            ownerUid: "private",
          }),
        },
        { id: "venue-2", data: () => ({ name: "Old Lab", isDeleted: 1 }) },
      ],
    });
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
    req.body = {
      name: "Updated Lab",
      address: "Morgantown, WV",
      gmapsUrl: "https://maps.google.com/example",
    };
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ name: "Old Lab", isDeleted: 0 }),
    });
    await handler("/locations/:id", "put")(req, res, next);
    expect(documentRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Updated Lab", updatedBy: "member-1" }),
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      location: expect.objectContaining({ id: "venue-1", name: "Updated Lab" }),
    });

    vi.clearAllMocks();
    documentRef.get.mockResolvedValueOnce({
      exists: false,
      data: () => undefined,
    });
    await expectApiError("/locations/:id", "put", 404, "LOCATION_NOT_FOUND");

    next.mockClear();
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ name: "Old", isDeleted: 1 }),
    });
    await expectApiError("/locations/:id", "put", 409, "LOCATION_ARCHIVED");
  });

  it("rejects missing venue archive targets and restores existing venues", async () => {
    req.authorizationRole = "admin";
    req.params = { id: "venue-1" };
    documentRef.get.mockResolvedValueOnce({ exists: false });
    await expectApiError("/locations/:id", "delete", 404, "LOCATION_NOT_FOUND");

    next.mockClear();
    documentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ name: "Team Lab", isDeleted: 1 }),
    });
    await handler("/locations/:id/restore", "patch")(req, res, next);
    expect(documentRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        isDeleted: 0,
        archivedAt: null,
        restoredBy: "member-1",
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      restored: true,
      message: "Venue restored successfully.",
    });

    vi.clearAllMocks();
    documentRef.get.mockResolvedValueOnce({ exists: false });
    await expectApiError(
      "/locations/:id/restore",
      "patch",
      404,
      "LOCATION_NOT_FOUND",
    );
  });

  it("builds a truthful feed, escapes text, and skips malformed dates", async () => {
    collectionRef.get.mockResolvedValue({
      docs: [
        eventDocument("event-1", {
          title: "Practice, Build; Test",
          description:
            'Line one\nLine two --- Meeting Notes --- {"type":"doc","content":[{"type":"text","text":"private"}]}',
        }),
        eventDocument("bad-date", { dateStart: "not-a-date" }),
      ],
    });

    await handler("/feed", "get")(req, res, next);

    const feed = res.send.mock.calls[0][0] as string;
    expect(feed).toContain("UID:event-1@aresfirst.org");
    expect(feed).toContain("SUMMARY:Practice\\, Build\\; Test");
    expect(feed).toContain("DESCRIPTION:Line one\\nLine two");
    expect(feed).not.toContain("Meeting Notes");
    expect(feed).not.toContain("private");
    expect(feed).not.toContain("LOCATION:");
    expect(feed).not.toContain("Team Lab");
    expect(feed).not.toContain("bad-date@aresfirst.org");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/calendar; charset=utf-8",
    );
  });

  it("uses truthful feed fallbacks for missing end, update, title, and optional fields", async () => {
    collectionRef.get.mockResolvedValueOnce({
      docs: [
        eventDocument("fallback", {
          title: undefined,
          dateEnd: undefined,
          updatedAt: undefined,
          description: undefined,
          location: undefined,
        }),
      ],
    });
    await handler("/feed", "get")(req, res, next);
    const feed = res.send.mock.calls[0][0] as string;
    expect(feed).toContain("UID:fallback@aresfirst.org");
    expect(feed).toContain("SUMMARY:Untitled event");
    expect(feed).toContain("DTEND:20260820T200000Z");
    expect(feed).not.toContain("DESCRIPTION:");
    expect(feed).not.toContain("LOCATION:");
    expect(res.setHeader).toHaveBeenCalledTimes(5);
  });

  it("includes only explicitly public venue DTOs in the feed", async () => {
    collectionRef.get.mockResolvedValue({
      docs: [
        eventDocument("public-venue", {
          locationId: "public-library",
          location: "legacy private address",
        }),
      ],
    });
    (adminDb as any).__getAll.mockResolvedValue([
      {
        id: "public-library",
        exists: true,
        data: () => ({
          name: "Team Library",
          address: "123 Public Street",
          isAddressPublic: 1,
          isDeleted: 0,
        }),
      },
    ]);

    await handler("/feed", "get")(req, res, next);

    const feed = res.send.mock.calls[0][0] as string;
    expect(feed).toContain("LOCATION:Team Library\\, 123 Public Street");
    expect(feed).not.toContain("legacy private address");

    vi.clearAllMocks();
    collectionRef.get.mockResolvedValue({
      docs: [eventDocument("private-venue", { locationId: "team-home" })],
    });
    (adminDb as any).__getAll.mockResolvedValue([
      {
        id: "team-home",
        exists: true,
        data: () => ({
          name: "Team Home",
          address: "private address",
          isAddressPublic: 0,
          isDeleted: 0,
        }),
      },
    ]);

    await handler("/feed", "get")(req, res, next);
    const privateFeed = res.send.mock.calls[0][0] as string;
    expect(privateFeed).not.toContain("LOCATION:");
    expect(privateFeed).not.toContain("private address");
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
    req = {
      query: {},
      params: {},
      body: {},
      user: { uid: "member-1" },
      authorizationRole: "mentor",
    };
    res = {
      json: vi.fn(),
      send: vi.fn(),
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    collectionRef = adminDb.collection("events") as any;
    documentRef = collectionRef.doc("weekly-1");
    batch = adminDb.batch();
    collectionRef.get.mockResolvedValue({ docs: [] });
    documentRef.get.mockResolvedValue({
      exists: true,
      id: "weekly-1",
      data: () => recurringDocument().data(),
    });
    documentRef.set.mockResolvedValue(undefined);
    documentRef.update.mockResolvedValue(undefined);
    batch.commit.mockResolvedValue(undefined);
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({ docs: [] });
    (adminDb as any).__occurrences.docGet.mockResolvedValue({
      exists: false,
      data: () => undefined,
    });
    (adminDb as any).__occurrences.docSet.mockReset();
    (adminDb as any).__occurrences.docSet.mockResolvedValue(undefined);
  });

  it("expands a recurring event into upcoming occurrences in list pages", async () => {
    collectionRef.get.mockResolvedValue({ docs: [recurringDocument()] });
    await handler("/events", "get")(req, res, next);
    const payload = res.json.mock.calls[0][0];
    // Default 56-day inclusive window holds nine weekly candidates (day 0..56);
    // the proportional per-event cap keeps all of them (min(16, 9) = 9).
    expect(payload.events).toHaveLength(9);
    const occurrence = payload.events[0];
    expect(occurrence.id).toBe(`weekly-1_${todayYmdStr}`);
    expect(occurrence.recurrenceOf).toBe("weekly-1");
    expect(occurrence.dateStart).toContain("T18:00:00.000Z");
    expect(occurrence.occurrenceDate).toBe(todayYmdStr);
    expect(occurrence.seriesDateStart).toContain("T18:00:00.000Z");
    expect(occurrence.recurrence).toEqual(weeklyRule);
  });

  it("preserves floating local times while expanding recurring events", async () => {
    collectionRef.get.mockResolvedValue({
      docs: [
        eventDocument("weekly-local", {
          dateStart: `${todayYmdStr}T18:00`,
          dateEnd: `${todayYmdStr}T20:00`,
          recurrence: weeklyRule,
        }),
      ],
    });

    await handler("/events", "get")(req, res, next);

    const occurrence = res.json.mock.calls[0][0].events[0];
    expect(occurrence.dateStart).toBe(`${todayYmdStr}T18:00`);
    expect(occurrence.dateEnd).toBe(`${todayYmdStr}T20:00`);
  });

  it("resolves a published recurring instance through the parent detail route", async () => {
    req.params = { id: "weekly-1" };
    req.query = { occurrence: todayYmdStr };

    await handler("/events/:id", "get")(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          id: `weekly-1_${todayYmdStr}`,
          recurrenceOf: "weekly-1",
          occurrenceDate: todayYmdStr,
          dateStart: `${todayYmdStr}T18:00:00.000Z`,
        }),
      }),
    );
  });

  it("resolves recurring event occurrence by compound id without query param", async () => {
    req.params = { id: `weekly-1_${todayYmdStr}` };
    req.query = {};

    await handler("/events/:id", "get")(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          id: `weekly-1_${todayYmdStr}`,
          recurrenceOf: "weekly-1",
          occurrenceDate: todayYmdStr,
          dateStart: `${todayYmdStr}T18:00:00.000Z`,
        }),
      }),
    );
  });

  it("merges validated occurrence overrides while retaining immutable series defaults", async () => {
    req.params = { id: "weekly-1" };
    req.query = { occurrence: todayYmdStr };
    (adminDb as any).__occurrences.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        overrides: {
          title: "Drive Practice",
          dateStart: `${todayYmdStr}T19:00:00.000Z`,
          internalNotes: "must not leak",
        },
      }),
    });

    await handler("/events/:id", "get")(req, res, next);

    const occurrence = res.json.mock.calls[0][0].event;
    expect(occurrence).toEqual(
      expect.objectContaining({
        title: "Drive Practice",
        dateStart: `${todayYmdStr}T19:00:00.000Z`,
        seriesDefaults: expect.objectContaining({
          title: "Team Practice",
          dateStart: `${todayYmdStr}T18:00:00.000Z`,
        }),
      }),
    );
    expect(occurrence).not.toHaveProperty("internalNotes");
    expect(occurrence.seriesDefaults).not.toHaveProperty("internalNotes");
  });

  it("loads an exact managed occurrence independently of the forward list window", async () => {
    req.params = { id: "weekly-1" };
    req.query = { occurrence: todayYmdStr };
    (adminDb as any).__occurrences.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ overrides: { title: "Documented Session" } }),
    });

    await handler("/manage/:id", "get")(req, res, next);

    expect(res.json.mock.calls[0][0].event).toEqual(
      expect.objectContaining({
        title: "Documented Session",
        recurrenceOf: "weekly-1",
        occurrenceDate: todayYmdStr,
        status: "published",
        location: "Team Lab",
      }),
    );
  });

  it("rejects invalid, unscheduled, and cancelled public occurrence details", async () => {
    req.params = { id: "weekly-1" };
    req.query = { occurrence: "not-a-date" };
    await handler("/events/:id", "get")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 400, code: "INVALID_DATE" }),
    );

    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    req.query = { occurrence: tomorrow };
    await handler("/events/:id", "get")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 404,
        code: "EVENT_OCCURRENCE_NOT_FOUND",
      }),
    );

    req.query = { occurrence: todayYmdStr };
    (adminDb as any).__occurrences.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ isCancelled: 1 }),
    });
    await handler("/events/:id", "get")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 404,
        code: "EVENT_OCCURRENCE_NOT_FOUND",
      }),
    );
  });

  it("extends occurrence visibility with the bounded expandDays window", async () => {
    collectionRef.get.mockResolvedValue({ docs: [recurringDocument()] });
    req.query = { expandDays: "190" };
    await handler("/events", "get")(req, res, next);
    const payload = res.json.mock.calls[0][0];
    // 190 days of a weekly event offers ~27 candidate days; the hard per-event
    // cap of 26 bounds the expansion.
    expect(payload.events.length).toBeGreaterThanOrEqual(20);
    expect(payload.events.length).toBeLessThanOrEqual(26);
    req.query = { expandDays: "5000" };
    await handler("/events", "get")(req, res, next);
    expect(collectionRef.get).toHaveBeenCalledTimes(2);
  });

  it("skips cancelled occurrence dates during expansion", async () => {
    collectionRef.get.mockResolvedValue({ docs: [recurringDocument()] });
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({
      docs: [occurrenceExceptionDocument("weekly-1", todayYmdStr, { isCancelled: 1 })],
    });
    await handler("/events", "get")(req, res, next);
    const payload = res.json.mock.calls[0][0];
    // One cancelled date simply drops that session from the expansion.
    expect(payload.events).toHaveLength(8);
    expect(
      payload.events.map((event: any) => event.occurrenceDate),
    ).not.toContain(todayYmdStr);
    const exceptionQuery = (adminDb as any).collectionGroup.mock.results.at(-1).value;
    expect(exceptionQuery.where).toHaveBeenNthCalledWith(1, "date", ">=", todayYmdStr);
    expect(exceptionQuery.where).toHaveBeenNthCalledWith(2, "date", "<=", expect.any(String));
    expect(exceptionQuery.orderBy).toHaveBeenCalledWith("date", "asc");
    expect(exceptionQuery.limit).toHaveBeenCalledWith(501);
  });

  it("fails closed when the bounded public exception query is saturated", async () => {
    collectionRef.get.mockResolvedValue({ docs: [recurringDocument()] });
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({
      docs: Array.from({ length: 501 }, (_, index) => occurrenceExceptionDocument(
        "weekly-1",
        new Date(Date.now() + index * 86_400_000).toISOString().slice(0, 10),
        { isCancelled: 1 },
      )),
    });

    await handler("/events", "get")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 503,
      code: "CALENDAR_EXCEPTION_LIMIT",
    }));
    expect(res.json).not.toHaveBeenCalled();
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
      recurrence: {
        frequency: "weekly",
        interval: 1,
        byDay: ["MO"],
        until: "2000-01-01",
      },
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
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recurrence: { frequency: "weekly", interval: 2, byDay: ["TU", "TH"] },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].event.recurrence).toEqual({
      frequency: "weekly",
      interval: 2,
      byDay: ["TU", "TH"],
    });
  });

  it("guards occurrence endpoints behind the publisher role and validates dates", async () => {
    const cancelLayer = calendarRouter.stack.find(
      (entry) =>
        entry.route?.path === "/manage/:id/occurrences/:date" &&
        entry.route.methods.patch,
    );
    expect(cancelLayer?.route?.stack.map((entry: any) => entry.name)).toEqual([
      "ensureTeamMember",
      "ensureCalendarPublisher",
      expect.any(String),
    ]);
    const updateLayer = calendarRouter.stack.find(
      (entry) =>
        entry.route?.path === "/manage/:id/occurrences/:date" &&
        entry.route.methods.put,
    );
    expect(updateLayer?.route?.stack.map((entry: any) => entry.name)).toEqual([
      "ensureTeamMember",
      "ensureCalendarPublisher",
      expect.any(String),
    ]);
    const detailLayer = calendarRouter.stack.find(
      (entry) => entry.route?.path === "/manage/:id" && entry.route.methods.get,
    );
    expect(detailLayer?.route?.stack.map((entry: any) => entry.name)).toEqual([
      "ensureTeamMember",
      expect.any(String),
    ]);

    req.params = { id: "weekly-1", date: "not-a-date" };
    await handler("/manage/:id/occurrences/:date", "patch")(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, code: "INVALID_DATE" }),
    );
  });

  it("stores only fields changed for one scheduled occurrence", async () => {
    req.params = { id: "weekly-1", date: todayYmdStr };
    req.body = {
      title: "Drive Practice",
      dateStart: `${todayYmdStr}T18:00:00.000Z`,
      dateEnd: `${todayYmdStr}T20:00:00.000Z`,
      locationId: null,
      location: "Team Lab",
      description: null,
      category: "internal",
      coverImage: null,
      isPotluck: 0,
      isVolunteer: 0,
    };

    await handler("/manage/:id/occurrences/:date", "put")(req, res, next);

    expect((adminDb as any).__occurrences.docSet).toHaveBeenCalledWith(
      expect.objectContaining({
        date: todayYmdStr,
        overrides: { title: "Drive Practice" },
        updatedBy: "member-1",
      }),
      { merge: true },
    );
    expect(res.json.mock.calls[0][0].event).toEqual(
      expect.objectContaining({
        title: "Drive Practice",
        occurrenceDate: todayYmdStr,
      }),
    );
  });

  it("cancels and restores a single occurrence with audit trail", async () => {
    req.params = { id: "weekly-1", date: "2026-09-03" };
    req.body = { cancelled: true };
    await handler("/manage/:id/occurrences/:date", "patch")(req, res, next);
    expect((adminDb as any).__occurrences.docSet).toHaveBeenCalledWith(
      expect.objectContaining({ isCancelled: 1, date: "2026-09-03" }),
      { merge: true },
    );

    (adminDb as any).__occurrences.docGet.mockResolvedValue({
      exists: true,
      data: () => ({ isCancelled: 1 }),
    });
    await handler("/manage/:id/occurrences/:date/restore", "patch")(
      req,
      res,
      next,
    );
    expect((adminDb as any).__occurrences.docSet).toHaveBeenCalledWith(
      expect.objectContaining({ isCancelled: 0 }),
      {
        merge: true,
      },
    );
  });

  it("refuses occurrence operations on non-recurring events", async () => {
    documentRef.get.mockResolvedValue({
      exists: true,
      id: "plain-1",
      data: () => eventDocument("plain-1").data(),
    });
    req.params = { id: "plain-1", date: "2026-09-03" };
    req.body = { cancelled: true };
    await handler("/manage/:id/occurrences/:date", "patch")(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409, code: "NOT_RECURRING" }),
    );
  });

  it("lists stored occurrence exceptions", async () => {
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({
      docs: [{ id: "2026-09-03", data: () => ({ isCancelled: 1 }) }],
    });
    req.params = { id: "weekly-1" };
    await handler("/manage/:id/occurrences", "get")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      occurrences: [
        { date: "2026-09-03", isCancelled: true, hasOverrides: false },
      ],
    });
  });

  it("emits RRULE and EXDATE lines for recurring events in the feed", async () => {
    const thursday = eventDocument("weekly-1", {
      dateStart: "2026-08-20T18:00:00.000Z",
      dateEnd: "2026-08-20T20:00:00.000Z",
      recurrence: {
        frequency: "weekly",
        interval: 2,
        byDay: ["TH"],
        until: "2026-12-31",
      },
    });
    collectionRef.get.mockResolvedValue({ docs: [thursday] });
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({
      docs: [occurrenceExceptionDocument("weekly-1", "2026-09-03", { isCancelled: 1 })],
    });
    await handler("/feed", "get")(req, res, next);
    const body = res.send.mock.calls[0][0] as string;
    expect(body).toContain(
      "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH;UNTIL=20261231T235959Z",
    );
    expect(body).toContain("EXDATE:20260903T180000Z");
    expect(body).toContain("UID:weekly-1@aresfirst.org");
  });

  it("emits RFC recurrence exceptions for individually edited sessions", async () => {
    const thursday = eventDocument("weekly-1", {
      dateStart: "2026-08-20T18:00:00.000Z",
      dateEnd: "2026-08-20T20:00:00.000Z",
      recurrence: { frequency: "weekly", interval: 1, byDay: ["TH"] },
    });
    collectionRef.get.mockResolvedValue({ docs: [thursday] });
    (adminDb as any).__occurrences.queryGet.mockResolvedValue({
      docs: [
        occurrenceExceptionDocument("weekly-1", "2026-09-03", {
            overrides: {
              title: "Scrimmage Practice",
              dateStart: "2026-09-03T19:00:00.000Z",
              dateEnd: "2026-09-03T21:00:00.000Z",
              description:
                "Public update --- Meeting Notes --- private recurrence notes",
              locationId: "public-library",
              location: "Private home address",
            },
        }),
      ],
    });
    (adminDb as any).__getAll.mockResolvedValue([
      {
        id: "public-library",
        exists: true,
        data: () => ({
          name: "Team Library",
          address: "123 Public Street",
          isAddressPublic: 1,
          isDeleted: 0,
        }),
      },
    ]);

    await handler("/feed", "get")(req, res, next);

    const body = res.send.mock.calls[0][0] as string;
    expect(body).toContain("RECURRENCE-ID:20260903T180000Z");
    expect(body).toContain("DTSTART:20260903T190000Z");
    expect(body).toContain("SUMMARY:Scrimmage Practice");
    expect(body).toContain("DESCRIPTION:Public update");
    expect(body).not.toContain("private recurrence notes");
    expect(body).not.toContain("Private home address");
    expect(body).toContain("LOCATION:Team Library\\, 123 Public Street");
  });
});
