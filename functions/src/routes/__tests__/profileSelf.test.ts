import { beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt } from "../../lib/crypto";

const firebaseMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  doc: vi.fn(),
  collection: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => {
  firebaseMocks.doc.mockImplementation((id: string) => ({
    id,
    get: firebaseMocks.get,
    set: firebaseMocks.set,
  }));
  firebaseMocks.collection.mockImplementation(() => ({ doc: firebaseMocks.doc }));
  return { adminDb: { collection: firebaseMocks.collection } };
});

import profileSelfRouter, {
  encryptedPrivateUpdates,
  isEncryptedValue,
  profileUpdateSchema,
} from "../profileSelf";

const encryptionSecret = "profile-privacy-test-secret-that-is-longer-than-thirty-two-characters";

function handler(path: string, method: "get" | "patch") {
  const layer = profileSelfRouter.stack.find(item => item.route?.path === path && item.route.methods[method]);
  expect(layer).toBeDefined();
  const stack = layer!.route!.stack;
  return stack[stack.length - 1].handle;
}

describe("profile privacy boundary", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_SECRET = encryptionSecret;
    req = {
      user: { uid: "student_uid", email: "student@aresfirst.org" },
      params: {},
      body: {},
    };
    res = { json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  it("validates bounded fields and rejects unknown or unsafe profile input", () => {
    expect(profileUpdateSchema.safeParse({ nickname: " CircuitFox " }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ nickname: "Fox", role: "admin" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ avatar: "http://example.org/avatar.svg" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ contactEmail: "not-an-email" }).success).toBe(false);
  });

  it("encrypts private fields while leaving the verified auth email canonical", async () => {
    const stored = await encryptedPrivateUpdates({
      firstName: "Legal",
      phone: "304-555-0100",
      dietaryRestrictions: ["Nut Allergy"],
      contactEmail: "student@aresfirst.org",
    }, "student@aresfirst.org");

    expect(stored.contactEmail).toBe("student@aresfirst.org");
    expect(isEncryptedValue(stored.firstName)).toBe(true);
    expect(isEncryptedValue(stored.phone)).toBe(true);
    expect(isEncryptedValue(stored.dietaryRestrictions)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("Legal");
    expect(JSON.stringify(stored)).not.toContain("304-555-0100");
    expect(await decrypt(String(stored.phone), encryptionSecret)).toBe("304-555-0100");
  });

  it("decrypts only the subject DTO and migrates legacy plaintext on read", async () => {
    firebaseMocks.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          nickname: "CircuitFox",
          firstName: "Private Legal Name",
          phone: "304-555-0100",
          dietaryRestrictions: ["Nut Allergy"],
          contactEmail: "other@example.org",
          showEmail: true,
          showPhone: true,
          memberType: "student",
          internalNote: "never return",
        }),
      })
      .mockResolvedValueOnce({ exists: true, data: () => ({ role: "member", memberType: "student" }) });

    await handler("/me", "get")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      exists: true,
      profile: expect.objectContaining({
        nickname: "CircuitFox",
        firstName: "Private Legal Name",
        phone: "304-555-0100",
        dietaryRestrictions: ["Nut Allergy"],
        contactEmail: "other@example.org",
        showEmail: false,
        showPhone: false,
        colleges: [],
        employers: [],
      }),
    });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("internalNote");
    const migration = firebaseMocks.set.mock.calls[0][0];
    expect(isEncryptedValue(migration.firstName)).toBe(true);
    expect(isEncryptedValue(migration.phone)).toBe(true);
    expect(isEncryptedValue(migration.dietaryRestrictions)).toBe(true);
    expect(isEncryptedValue(migration.contactEmail)).toBe(true);
    expect(JSON.stringify(migration)).not.toContain("Private Legal Name");
  });

  it("stores a student update without plaintext or public contact opt-ins", async () => {
    firebaseMocks.get
      .mockResolvedValueOnce({ exists: true, data: () => ({ nickname: "Old", memberType: "student" }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({ role: "member", memberType: "student" }) });
    req.body = {
      nickname: "CircuitFox",
      firstName: "Legal",
      phone: "304-555-0199",
      dietaryRestrictions: ["Vegetarian"],
      emergencyContactName: "Trusted Adult",
      emergencyContactPhone: "304-555-0101",
      contactEmail: "guardian@example.org",
      showEmail: true,
      showPhone: true,
      showOnAbout: true,
    };

    await handler("/me", "patch")(req, res, next);

    const stored = firebaseMocks.set.mock.calls[0][0];
    expect(stored).toEqual(expect.objectContaining({
      nickname: "CircuitFox",
      showEmail: false,
      showPhone: false,
      colleges: [],
      employers: [],
      sensitiveFieldsVersion: 1,
    }));
    expect(isEncryptedValue(stored.firstName)).toBe(true);
    expect(isEncryptedValue(stored.phone)).toBe(true);
    expect(isEncryptedValue(stored.contactEmail)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("Trusted Adult");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      profile: expect.objectContaining({ phone: "304-555-0199", showEmail: false, showPhone: false }),
    }));
  });

  it("blocks member-type escalation and archived accounts", async () => {
    firebaseMocks.get
      .mockResolvedValueOnce({ exists: true, data: () => ({ memberType: "student" }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({ role: "member", memberType: "student" }) });
    req.body = { memberType: "mentor" };
    await handler("/me", "patch")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    expect(firebaseMocks.set).not.toHaveBeenCalled();

    vi.clearAllMocks();
    firebaseMocks.get
      .mockResolvedValueOnce({ exists: false, data: () => undefined })
      .mockResolvedValueOnce({ exists: true, data: () => ({ role: "unverified", isDeleted: 1 }) });
    await handler("/me", "get")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it("provides the same explicit private DTO on the separate admin-only detail route", async () => {
    req.params = { userId: "student_uid" };
    firebaseMocks.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          nickname: "CircuitFox",
          firstName: "Legacy Name",
          memberType: "mentor",
          avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=random-safe-seed",
          colleges: [{ name: "WVU", domain: "wvu.edu", years: "2020-2024", degree: "Engineering" }],
          employers: JSON.stringify([{ name: "ARES", domain: "aresfirst.org", title: "Mentor", current: true, years: "2024" }]),
        }),
      })
      .mockResolvedValueOnce({ exists: true, data: () => ({ email: "student@aresfirst.org", role: "mentor" }) });

    await handler("/admin/users/:userId/profile", "get")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      exists: true,
      profile: expect.objectContaining({
        nickname: "CircuitFox",
        firstName: "Legacy Name",
        avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=random-safe-seed",
        colleges: [expect.objectContaining({ name: "WVU" })],
        employers: [expect.objectContaining({ name: "ARES" })],
      }),
    });
  });
});
