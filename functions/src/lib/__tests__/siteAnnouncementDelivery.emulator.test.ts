import { afterEach, describe, expect, it, vi } from "vitest";
import { adminDb } from "../firebase-admin";
import { SETTINGS_DOCUMENT } from "../siteAnnouncement";
import { deliverPendingAnnouncement } from "../siteAnnouncementDelivery";
import { sendZulipMessage } from "../zulip";

vi.mock("../zulip", async (original) => ({
  ...await original<typeof import("../zulip")>(),
  sendZulipMessage: vi.fn(),
}));

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("announcement delivery claims", () => {
  const ref = adminDb.collection("settings").doc(SETTINGS_DOCUMENT);
  const notice = {
    message: "Emulator announcement", severity: "info", revision: "r1",
    isActive: true, evergreen: true, zulipDelivery: "pending", zulipLeaseUntil: 0,
  };
  afterEach(async () => {
    await ref.delete();
    vi.mocked(sendZulipMessage).mockReset();
  });

  it("delivers once across concurrent and repeated scheduler invocations", async () => {
    await ref.set(notice);
    vi.mocked(sendZulipMessage).mockResolvedValue(true);
    await Promise.all([deliverPendingAnnouncement(), deliverPendingAnnouncement()]);
    await deliverPendingAnnouncement();
    expect(sendZulipMessage).toHaveBeenCalledTimes(1);
    expect((await ref.get()).data()?.zulipDelivery).toBe("sent");
  });

  it("keeps an edit pending when the previous send finishes", async () => {
    await ref.set(notice);
    vi.mocked(sendZulipMessage).mockImplementationOnce(async () => {
      await ref.set({ ...notice, revision: "r2", message: "Edited announcement" });
      return true;
    }).mockResolvedValue(true);
    await deliverPendingAnnouncement();
    expect((await ref.get()).data()?.zulipDelivery).toBe("pending");
    await deliverPendingAnnouncement();
    expect(vi.mocked(sendZulipMessage).mock.lastCall?.[2]).toContain("Edited announcement");
    expect((await ref.get()).data()?.zulipDelivery).toBe("sent");
  });
});
