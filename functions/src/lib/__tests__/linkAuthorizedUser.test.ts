import { describe, it, expect, vi, beforeEach } from "vitest";
import { linkAuthorizedUserByEmail } from "../linkAuthorizedUser";

// vi.mock factories are hoisted above ordinary consts, so shared mocks must
// come from vi.hoisted to be initialized before the factory executes.
const {
  mockWhereGet, mockBatchSet, mockBatchDelete, mockBatchCommit, mockDoc,
} = vi.hoisted(() => ({
  mockWhereGet: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchDelete: vi.fn(),
  mockBatchCommit: vi.fn().mockResolvedValue(undefined),
  mockDoc: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ get: mockWhereGet }),
      }),
      doc: mockDoc,
    }),
    batch: vi.fn().mockReturnValue({
      set: mockBatchSet,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    }),
  },
}));

function orphanDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data, ref: { path: `authorized_users/${id}` } };
}

describe("linkAuthorizedUserByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips linking without a verified email", async () => {
    expect(await linkAuthorizedUserByEmail({ uid: "uid-1", email: "a@b.c", emailVerified: false })).toBe(false);
    expect(await linkAuthorizedUserByEmail({ uid: "uid-1", email: "a@b.c" })).toBe(false);
    expect(await linkAuthorizedUserByEmail({ uid: "uid-1", emailVerified: true })).toBe(false);
    expect(mockWhereGet).not.toHaveBeenCalled();
  });

  it("re-keys a pre-authorized record and its paired user_profiles doc to the signed-in uid", async () => {
    mockWhereGet.mockResolvedValue({ docs: [orphanDoc("generated-id", { email: "New@Team.org", role: "member", isDeleted: 0 })] });
    mockDoc.mockImplementation((id: string) => ({
      id,
      get: vi.fn().mockResolvedValue({
        exists: id === "generated-id",
        data: () => ({ nickname: "Applicant", memberType: "student" }),
      }),
    }));

    const linked = await linkAuthorizedUserByEmail({ uid: "uid-1", email: "new@team.org", emailVerified: true });

    expect(linked).toBe(true);
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: "uid-1" }),
      expect.objectContaining({ email: "new@team.org", role: "member" }),
      { merge: true },
    );
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: "uid-1" }),
      { nickname: "Applicant", memberType: "student" },
      { merge: true },
    );
    expect(mockBatchDelete).toHaveBeenCalledWith({ path: "authorized_users/generated-id" });
    expect(mockBatchDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "generated-id" }));
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("deletes but does not inherit an archived pre-authorization or its orphan profile", async () => {
    mockWhereGet.mockResolvedValue({ docs: [orphanDoc("generated-id", { email: "gone@team.org", role: "member", isDeleted: 1 })] });
    mockDoc.mockImplementation((id: string) => ({
      id,
      get: vi.fn().mockResolvedValue({
        exists: id === "generated-id",
        data: () => ({ nickname: "ArchivedApplicant" }),
      }),
    }));

    const linked = await linkAuthorizedUserByEmail({ uid: "uid-1", email: "gone@team.org", emailVerified: true });

    expect(linked).toBe(true);
    expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).not.toHaveBeenCalled();
  });

  it("does nothing when the authorization is already keyed to the uid", async () => {
    mockWhereGet.mockResolvedValue({ docs: [orphanDoc("uid-1", { email: "same@team.org", role: "member" })] });

    expect(await linkAuthorizedUserByEmail({ uid: "uid-1", email: "same@team.org", emailVerified: true })).toBe(false);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("does nothing without any authorization records", async () => {
    mockWhereGet.mockResolvedValue({ docs: [] });
    expect(await linkAuthorizedUserByEmail({ uid: "uid-1", email: "none@team.org", emailVerified: true })).toBe(false);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});
