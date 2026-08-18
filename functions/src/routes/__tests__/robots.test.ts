import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminDb } from "../../lib/firebase-admin";
import robotsRouter, {
  createRobotSchema,
  ensureRobotEditor,
  isTrustedOnshapeUrl,
  isTrustedPrintablesUrl,
  robotDto,
  updateRobotSchema,
} from "../robots";

vi.mock("../../lib/firebase-admin", () => ({ adminDb: { collection: vi.fn() } }));

describe("robots routes", () => {
  let req: any;
  let res: any;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { params: {}, query: {}, body: {}, user: { uid: "editor-1" } };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  function handler(path: string, method: string) {
    const layer = robotsRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
    expect(layer).toBeDefined();
    return layer!.route!.stack.at(-1)!.handle;
  }

  function editor(role: string, exists = true) {
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists, data: () => ({ role }) }) }),
    } as any);
  }

  describe("role matrix", () => {
    for (const role of ["admin", "coach", "mentor"]) {
      it(`allows ${role}`, async () => {
        editor(role);
        await ensureRobotEditor(req, res, next);
        expect(req.authorizationRole).toBe(role);
        expect(next).toHaveBeenCalledWith();
      });
    }

    for (const role of ["student", "member", "parent", "unverified"]) {
      it(`denies ${role}`, async () => {
        editor(role);
        await ensureRobotEditor(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      });
    }

    it("denies a missing authenticated identity", async () => {
      req.user = undefined;
      await ensureRobotEditor(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });

    it("denies users absent from the authorization collection", async () => {
      editor("admin", false);
      await ensureRobotEditor(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    it("forwards database failures", async () => {
      vi.mocked(adminDb.collection).mockImplementation(() => { throw new Error("database offline"); });
      await ensureRobotEditor(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "database offline" }));
    });
  });

  describe("data validation & schemas", () => {
    const validRobot = {
      id: "ares-prime",
      name: "Hydra",
      seasonName: "2025-2026",
      challengeName: "DEEP DIVE",
      weightLbs: 42,
      drivetrainType: "Mecanum",
      programmingLanguage: "Kotlin / ARESLib",
      revealVideoId: "abcdefghijk",
      onshapeUrl: "https://cad.onshape.com/documents/abc",
      cadViewerUrl: "https://cad.onshape.com/documents/abc/e/embed",
      printablesUrl: "https://www.printables.com/@ARESFTC_3784306/models",
      primaryMechanism: "Arm",
      content: "Published description",
      versions: [{ name: "V1", content: "Prototype", weightLbs: 40, drivetrainType: "Tank", primaryMechanism: "Lift", cadViewerUrl: "https://cad.onshape.com/documents/v1", printablesUrl: "https://printables.com/model/123-bracket" }],
    };

    it("accepts every field produced by the editor", () => {
      expect(createRobotSchema.safeParse(validRobot).success).toBe(true);
      expect(updateRobotSchema.safeParse({ primaryMechanism: "New arm", weightLbs: 41 }).success).toBe(true);
    });

    it("requires at least one update field", () => {
      expect(updateRobotSchema.safeParse({}).success).toBe(false);
    });

    it.each([
      "http://cad.onshape.com/documents/abc",
      "https://evil.example/onshape",
      "https://cad.onshape.com:444/documents/abc",
      "https://user:password@cad.onshape.com/documents/abc",
      "javascript:alert(1)",
      "not-a-url",
    ])("rejects an untrusted CAD URL: %s", (url) => {
      expect(isTrustedOnshapeUrl(url)).toBe(false);
      expect(createRobotSchema.safeParse({ ...validRobot, cadViewerUrl: url }).success).toBe(false);
    });

    it("accepts the exact trusted HTTPS Onshape host", () => {
      expect(isTrustedOnshapeUrl("https://cad.onshape.com/documents/abc")).toBe(true);
    });

    it.each([
      "http://printables.com/model/123",
      "https://evil.example/printables",
      "https://printables.com:8080/model/123",
      "https://user:password@printables.com/model/123",
      "javascript:alert(1)",
      "not-a-url",
    ])("rejects an untrusted Printables URL: %s", (url) => {
      expect(isTrustedPrintablesUrl(url)).toBe(false);
      expect(createRobotSchema.safeParse({ ...validRobot, printablesUrl: url }).success).toBe(false);
    });

    it("accepts trusted HTTPS Printables hosts", () => {
      expect(isTrustedPrintablesUrl("https://www.printables.com/@ARESFTC_3784306")).toBe(true);
      expect(isTrustedPrintablesUrl("https://printables.com/model/123456-odometry-pod")).toBe(true);
    });

    it("rejects malformed IDs, video IDs, weights, and excessive versions", () => {
      expect(createRobotSchema.safeParse({ ...validRobot, id: "Bad ID" }).success).toBe(false);
      expect(createRobotSchema.safeParse({ ...validRobot, revealVideoId: "short" }).success).toBe(false);
      expect(createRobotSchema.safeParse({ ...validRobot, weightLbs: -1 }).success).toBe(false);
      expect(createRobotSchema.safeParse({ ...validRobot, versions: Array.from({ length: 31 }, () => validRobot.versions[0]) }).success).toBe(false);
    });

    it("returns only the explicit public DTO and sanitizes legacy URLs", () => {
      const dto = robotDto("r1", {
        ...validRobot,
        secret: "not part of the interface",
        onshapeUrl: "javascript:alert(1)",
        cadViewerUrl: "http://unsafe.example",
        printablesUrl: "https://evil.example/model",
        versions: [{ name: "V1", content: "", cadViewerUrl: "javascript:alert(1)", printablesUrl: "javascript:alert(2)", internal: "secret" }],
        isDeleted: 1,
      } as any);
      expect(dto).not.toHaveProperty("secret");
      expect(dto).not.toHaveProperty("isDeleted");
      expect(dto.onshapeUrl).toBe("");
      expect(dto.cadViewerUrl).toBe("");
      expect(dto.printablesUrl).toBe("");
      expect(dto.versions[0]).not.toHaveProperty("internal");
      expect(dto.versions[0].cadViewerUrl).toBe("");
      expect(dto.versions[0].printablesUrl).toBe("");
      expect(robotDto("r1", { isDeleted: 1 }, true)).toHaveProperty("isDeleted", 1);
    });
  });

  describe("read endpoints", () => {
    it("returns a bounded active fleet page", async () => {
      const documents = [{ id: "r1", data: () => ({ name: "Prime", isDeleted: 0 }) }];
      const query: any = { where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), get: vi.fn().mockResolvedValue({ docs: documents }) };
      query.where.mockReturnValue(query); query.orderBy.mockReturnValue(query); query.limit.mockReturnValue(query);
      vi.mocked(adminDb.collection).mockReturnValue(query);
      req.query.limit = "1000";
      await handler("/", "get")(req, res, next);
      expect(query.limit).toHaveBeenCalledWith(100);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, robots: [expect.objectContaining({ id: "r1", name: "Prime" })] }));
    });

    it("uses a valid cursor and rejects an invalid one", async () => {
      const query: any = { where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), startAfter: vi.fn(), get: vi.fn().mockResolvedValue({ docs: [] }), doc: vi.fn() };
      query.where.mockReturnValue(query); query.orderBy.mockReturnValue(query); query.limit.mockReturnValue(query); query.startAfter.mockReturnValue(query);
      const cursor = { exists: true, data: () => ({ isDeleted: 0 }) };
      query.doc.mockReturnValue({ get: vi.fn().mockResolvedValue(cursor) });
      vi.mocked(adminDb.collection).mockReturnValue(query);
      req.query.startAfter = "r1";
      await handler("/", "get")(req, res, next);
      expect(query.startAfter).toHaveBeenCalledWith(cursor);

      query.doc.mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) });
      await handler("/", "get")(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    });

    it("returns a detail DTO and hides missing or decommissioned robots", async () => {
      req.params.id = "r1";
      const get = vi.fn().mockResolvedValue({ exists: true, id: "r1", data: () => ({ name: "Prime", isDeleted: 0 }) });
      vi.mocked(adminDb.collection).mockReturnValue({ doc: vi.fn().mockReturnValue({ get }) } as any);
      await handler("/:id", "get")(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, robot: expect.objectContaining({ id: "r1", name: "Prime" }) });

      get.mockResolvedValue({ exists: true, id: "r1", data: () => ({ isDeleted: 1 }) });
      await handler("/:id", "get")(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    it("returns archived state only from the privileged list handler", async () => {
      const query: any = { orderBy: vi.fn(), limit: vi.fn(), get: vi.fn().mockResolvedValue({ docs: [{ id: "r1", data: () => ({ name: "Old", isDeleted: 1 }) }] }) };
      query.orderBy.mockReturnValue(query); query.limit.mockReturnValue(query);
      vi.mocked(adminDb.collection).mockReturnValue(query);
      await handler("/admin", "get")(req, res, next);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ robots: [expect.objectContaining({ isDeleted: 1 })] }));
    });
  });

  describe("write endpoints", () => {
    it("creates with a validated slug and rejects a duplicate", async () => {
      req.body = { id: "prime", name: "Prime", seasonName: "2026", challengeName: "Challenge", drivetrainType: "Mecanum", versions: [] };
      const set = vi.fn();
      const get = vi.fn().mockResolvedValue({ exists: false });
      vi.mocked(adminDb.collection).mockReturnValue({ doc: vi.fn().mockReturnValue({ id: "prime", get, set }) } as any);
      await handler("/", "post")(req, res, next);
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ name: "Prime", isDeleted: 0 }));
      expect(res.status).toHaveBeenCalledWith(201);

      get.mockResolvedValue({ exists: true });
      await handler("/", "post")(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
    });

    it("updates an active robot", async () => {
      req.params.id = "r1"; req.body = { name: "New name" };
      const update = vi.fn();
      vi.mocked(adminDb.collection).mockReturnValue({ doc: vi.fn().mockReturnValue({ id: "r1", get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ name: "Old", isDeleted: 0 }) }), update }) } as any);
      await handler("/:id", "put")(req, res, next);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: "New name" }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Robot updated successfully" }));
    });

    it("soft-decommissions and restores a robot", async () => {
      req.params.id = "r1";
      const update = vi.fn();
      const get = vi.fn().mockResolvedValue({ exists: true, data: () => ({ isDeleted: 0 }) });
      vi.mocked(adminDb.collection).mockReturnValue({ doc: vi.fn().mockReturnValue({ get, update }) } as any);
      await handler("/:id", "delete")(req, res, next);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 1 }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Robot decommissioned successfully" }));

      get.mockResolvedValue({ exists: true, data: () => ({ isDeleted: 1 }) });
      await handler("/:id/restore", "patch")(req, res, next);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 0 }));
    });

    it("rejects missing, archived, and already-active write targets", async () => {
      req.params.id = "r1"; req.body = { name: "New" };
      const get = vi.fn().mockResolvedValue({ exists: false });
      vi.mocked(adminDb.collection).mockReturnValue({ doc: vi.fn().mockReturnValue({ get, update: vi.fn() }) } as any);
      await handler("/:id", "put")(req, res, next);
      await handler("/:id", "delete")(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));

      get.mockResolvedValue({ exists: true, data: () => ({ isDeleted: 0 }) });
      await handler("/:id/restore", "patch")(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
    });
  });
});
