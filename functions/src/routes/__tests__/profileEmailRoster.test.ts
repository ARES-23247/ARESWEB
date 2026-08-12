import { beforeEach, describe, expect, it, vi } from "vitest";
import profileEmailRosterRouter from "../profileEmailRoster";

const firestore = vi.hoisted(() => {
  const queryGet = vi.fn();
  const query = {
    orderBy: vi.fn(),
    limit: vi.fn(),
    get: queryGet,
  };
  query.orderBy.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  const profileGet = vi.fn();
  const auditSet = vi.fn();
  const auditDoc = vi.fn(() => ({ set: auditSet }));
  const profileDoc = vi.fn((id: string) => ({ get: () => profileGet(id) }));
  const collection = vi.fn((name: string) => {
    if (name === "authorized_users") return query;
    if (name === "user_profiles") return { doc: profileDoc };
    if (name === "audit_logs") return { doc: auditDoc };
    throw new Error(`Unexpected collection: ${name}`);
  });
  return { query, queryGet, profileGet, auditSet, auditDoc, profileDoc, collection };
});

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: { collection: firestore.collection },
  adminAuth: { verifyIdToken: vi.fn() },
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

function authorizationDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

function profile(data: Record<string, unknown> = {}) {
  return { exists: Object.keys(data).length > 0, data: () => data };
}

describe("POST /api/profiles/admin/users/email-roster", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    firestore.query.orderBy.mockReturnValue(firestore.query);
    firestore.query.limit.mockReturnValue(firestore.query);
    firestore.auditSet.mockResolvedValue(undefined);
    firestore.profileGet.mockResolvedValue(profile());
    req = { body: {}, user: { uid: "admin_uid", email: "admin@example.org" } };
    res = { json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  const getHandler = () => {
    const layer = profileEmailRosterRouter.stack.find(item => item.route?.path === "/admin/users/email-roster");
    expect(layer).toBeDefined();
    return layer!.route!.stack.at(-1)!.handle;
  };

  it("returns only active verified addresses, deduplicates them, protects student names, and audits without PII", async () => {
    firestore.queryGet.mockResolvedValue({ docs: [
      authorizationDoc("student_uid", { email: "STUDENT@example.org", name: "Private Legal Name", role: "student", isDeleted: 0 }),
      authorizationDoc("adult_uid", { email: "coach@example.org", name: "Coach Taylor", role: "coach" }),
      authorizationDoc("duplicate_uid", { email: "student@example.org", name: "Duplicate", role: "member" }),
      authorizationDoc("archived_uid", { email: "archived@example.org", role: "member", isDeleted: 1 }),
      authorizationDoc("pending_uid", { email: "pending@example.org", role: "unverified" }),
      authorizationDoc("bad_uid", { email: "not-an-email", role: "member" }),
    ] });
    firestore.profileGet.mockImplementation(async (id: string) => {
      if (id === "student_uid") return profile({ nickname: "CircuitFox", memberType: "student", subteams: [" Programming "] });
      if (id === "adult_uid") return profile({ memberType: "mentor", subteams: ["Mechanical"] });
      if (id === "duplicate_uid") return profile({ nickname: "CircuitFox", memberType: "student" });
      return profile();
    });

    await getHandler()(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.recipientCount).toBe(2);
    expect(payload.recipients).toEqual([
      { name: "Coach Taylor", email: "coach@example.org", role: "coach", memberType: "mentor", subteams: ["Mechanical"] },
      { name: "CircuitFox", email: "student@example.org", role: "member", memberType: "student", subteams: [] },
    ]);
    expect(JSON.stringify(payload)).not.toContain("Private Legal Name");
    expect(JSON.stringify(payload)).not.toContain("student_uid");
    expect(firestore.query.limit).toHaveBeenCalledWith(501);
    expect(firestore.auditSet).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.email_roster.prepared",
      actorUid: "admin_uid",
      recipientCount: 2,
      filters: { audience: "all", subteam: "" },
    }));
    expect(JSON.stringify(firestore.auditSet.mock.calls[0][0])).not.toContain("@example.org");
    expect(next).not.toHaveBeenCalled();
  });

  it("applies mentor and exact subteam filters on the server", async () => {
    req.body = { audience: "mentors", subteam: "Programming" };
    firestore.queryGet.mockResolvedValue({ docs: [
      authorizationDoc("coach_uid", { email: "coach@example.org", role: "admin", name: "Coach" }),
      authorizationDoc("mentor_uid", { email: "mentor@example.org", role: "mentor", name: "Mentor" }),
      authorizationDoc("alumni_uid", { email: "alumni@example.org", role: "member", name: "Alumni", memberType: "alumni" }),
    ] });
    firestore.profileGet.mockImplementation(async (id: string) => profile({
      memberType: id === "alumni_uid" ? "alumni" : "mentor",
      subteams: id === "coach_uid" ? ["Programming"] : ["Mechanical"],
    }));

    await getHandler()(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      recipientCount: 1,
      recipients: [expect.objectContaining({ email: "coach@example.org" })],
    }));
    expect(firestore.auditSet).toHaveBeenCalledWith(expect.objectContaining({
      filters: { audience: "mentors", subteam: "Programming" },
    }));
  });

  it("rejects invalid filters and exports larger than the bounded limit", async () => {
    req.body = { audience: "everyone" };
    await getHandler()(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400 }));
    expect(firestore.queryGet).not.toHaveBeenCalled();

    req.body = {};
    firestore.queryGet.mockResolvedValue({
      docs: Array.from({ length: 501 }, (_, index) => authorizationDoc(`uid_${index}`, {
        email: `member${index}@example.org`, role: "member",
      })),
    });
    await getHandler()(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 413 }));
    expect(firestore.profileGet).not.toHaveBeenCalled();
    expect(firestore.auditSet).not.toHaveBeenCalled();
  });

  it("surfaces database failures without returning fake success", async () => {
    firestore.queryGet.mockRejectedValue(new Error("firestore unavailable"));

    await getHandler()(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 500,
      message: "Could not prepare the email roster. Please try again.",
    }));
    expect(res.json).not.toHaveBeenCalled();
  });
});
