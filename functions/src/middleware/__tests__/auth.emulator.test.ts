import { afterEach, describe, expect, it, vi } from "vitest";
import { adminAuth, adminDb } from "../../lib/firebase-admin";
import { ensureTeamMember, type AuthenticatedRequest } from "../auth";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

describe.skipIf(!emulatorHost)("ensureTeamMember (Firestore emulator)", () => {
  afterEach(() => vi.restoreAllMocks());

  async function authorize(
    uid: string,
    authorization: Record<string, unknown>,
  ) {
    await adminDb.collection("authorized_users").doc(uid).set(authorization);
    vi.spyOn(adminAuth, "verifyIdToken").mockResolvedValue({
      uid,
      email: `${uid}@example.test`,
      email_verified: true,
    } as never);
    const request = {
      headers: { authorization: "Bearer emulator-token" },
    } as AuthenticatedRequest;
    const next = vi.fn();

    await ensureTeamMember(request, {} as never, next);
    return { request, next };
  }

  it("loads an active member role from Firestore instead of trusting client state", async () => {
    const uid = `active-${Date.now().toString(36)}`;
    const { request, next } = await authorize(uid, {
      role: "member",
      isDeleted: 0,
    });

    expect(next).toHaveBeenCalledWith();
    expect(request.user?.uid).toBe(uid);
    expect(request.authorizationRole).toBe("member");
  });

  it("denies an archived authorization record", async () => {
    const uid = `archived-${Date.now().toString(36)}`;
    const { request, next } = await authorize(uid, {
      role: "member",
      isDeleted: 1,
    });

    expect(request.authorizationRole).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });
});
