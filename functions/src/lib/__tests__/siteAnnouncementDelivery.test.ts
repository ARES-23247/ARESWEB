import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), send: vi.fn() }));
vi.mock("../firebase-admin", () => ({
  adminDb: { collection: () => ({ doc: () => ({ get: mocks.get, update: mocks.update }) }) },
}));
vi.mock("../zulip", async (original) => ({
  ...await original<typeof import("../zulip")>(),
  sendZulipMessage: mocks.send,
}));
import { deliverPendingAnnouncement } from "../siteAnnouncementDelivery";

const notice = {
  message: "Calendar update @**all**", severity: "urgent", revision: "r1",
  link: "/calendar?season=(fall)", linkLabel: "View calendar", evergreen: true,
  isActive: true, zulipDelivery: "pending", zulipLeaseUntil: 0,
  updatedBy: "private-author",
};
function snapshot(data?: Record<string, unknown>) {
  return { data: () => data, updateTime: "original-version" };
}

describe("Zulip site announcements", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.get.mockResolvedValue(snapshot(notice));
    mocks.update.mockResolvedValue({ writeTime: "claimed-version" });
    mocks.send.mockResolvedValue(true);
  });

  it.each([
    ["info", "Information"],
    ["important", "Important"],
    ["urgent", "Urgent"],
  ])("includes one channel-wide mention for a published %s notice", async (severity, priority) => {
    mocks.get.mockResolvedValueOnce(snapshot({ ...notice, severity }));
    await deliverPendingAnnouncement();
    expect(mocks.update).toHaveBeenNthCalledWith(1, { zulipLeaseUntil: expect.any(Number) }, { lastUpdateTime: "original-version" });
    expect(mocks.send).toHaveBeenCalledWith("announcements", "Site announcements",
      `@**all** **${priority}**\n\nCalendar update @\u200b\\*\\*all\\*\\*\n\n[View calendar](https://aresfirst.org/calendar?season=%28fall%29)`);
    expect(mocks.update).toHaveBeenNthCalledWith(2, { zulipDelivery: "sent", zulipLeaseUntil: 0 }, { lastUpdateTime: "claimed-version" });
  });

  it("waits for a scheduled publication, recovers an expired lease and uses the home link by default", async () => {
    const startsAt = Date.parse("2030-01-01T00:00:00Z");
    mocks.get.mockResolvedValue(snapshot({ ...notice, startsAt: new Date(startsAt).toISOString(), link: null, linkLabel: null, zulipLeaseUntil: startsAt - 500 }));
    const now = vi.spyOn(Date, "now").mockReturnValue(startsAt - 1);
    try {
      await deliverPendingAnnouncement();
      expect(mocks.send).not.toHaveBeenCalled();
      now.mockReturnValue(startsAt);
      await deliverPendingAnnouncement();
      expect(mocks.send.mock.calls[0][2]).toContain("[Visit the team website](https://aresfirst.org/)");
    } finally { now.mockRestore(); }
  });

  it("skips missing, legacy, hidden, expired, malformed, claimed and delivered notices", async () => {
    for (const data of [undefined, { ...notice, zulipDelivery: undefined }, { ...notice, isActive: false },
      { ...notice, endsAt: "2000-01-01T00:00:00Z" }, { ...notice, link: "//other.test" },
      { ...notice, zulipLeaseUntil: Date.now() + 60_000 }, { ...notice, zulipDelivery: "sent" }]) {
      mocks.get.mockResolvedValueOnce(snapshot(data));
      await deliverPendingAnnouncement();
    }
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("leaves a failed send recoverable and reports failure to the scheduler", async () => {
    mocks.send.mockResolvedValueOnce(false);
    await expect(deliverPendingAnnouncement()).rejects.toThrow("Zulip did not accept");
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await deliverPendingAnnouncement();
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("skips a stale claim and surfaces unexpected storage errors", async () => {
    mocks.update.mockRejectedValueOnce({ code: 9 });
    await deliverPendingAnnouncement();
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.update.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(deliverPendingAnnouncement()).rejects.toThrow("storage unavailable");
  });
});
