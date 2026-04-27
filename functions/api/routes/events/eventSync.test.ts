import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventSyncHandlers } from "./eventSync";

vi.mock("../../middleware", () => ({
  getDbSettings: vi.fn(),
}));

vi.mock("../../../utils/gcalSync", () => ({
  pullEventsFromGcal: vi.fn(),
  pushEventToGcal: vi.fn(),
}));

import { getDbSettings } from "../../middleware";
import { pullEventsFromGcal, pushEventToGcal } from "../../../utils/gcalSync";

describe("eventSyncHandlers", () => {
  let mockDb: any;
  let mockC: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };
    mockC = {
      get: vi.fn().mockReturnValue(mockDb),
      env: {},
    };
  });

  describe("syncEvents", () => {
    it("returns 400 if gcal config is missing", async () => {
      vi.mocked(getDbSettings).mockResolvedValueOnce({});
      const res = await eventSyncHandlers.syncEvents({}, mockC);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("GCal config missing");
    });

    it("syncs events from multiple calendars", async () => {
      vi.mocked(getDbSettings).mockResolvedValueOnce({
        GCAL_SERVICE_ACCOUNT_EMAIL: "test@example.com",
        GCAL_PRIVATE_KEY: "key",
        CALENDAR_ID_INTERNAL: "int123",
        CALENDAR_ID_OUTREACH: "out123"
      } as any);

      vi.mocked(pullEventsFromGcal).mockResolvedValueOnce([
        { title: "Event 1", date_start: "2023-01-01", gcal_event_id: "gcal1" }
      ] as any).mockResolvedValueOnce([
        { title: "Event 2", date_start: "2023-01-02", gcal_event_id: "gcal2" }
      ] as any);

      const res = await eventSyncHandlers.syncEvents({}, mockC);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(mockDb.insertInto).toHaveBeenCalledWith("events");
      expect(mockDb.execute).toHaveBeenCalledTimes(2); // One per calendar chunk
    });

    it("handles calendar sync errors", async () => {
      vi.mocked(getDbSettings).mockResolvedValueOnce({
        GCAL_SERVICE_ACCOUNT_EMAIL: "test@example.com",
        GCAL_PRIVATE_KEY: "key",
        CALENDAR_ID_INTERNAL: "int123",
      } as any);

      vi.mocked(pullEventsFromGcal).mockRejectedValueOnce(new Error("Network Error"));

      const res = await eventSyncHandlers.syncEvents({}, mockC);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.errors).toContain("internal: Network Error");
    });

    it("returns 500 on unexpected global error", async () => {
      vi.mocked(getDbSettings).mockRejectedValueOnce(new Error("Global Error"));
      const res = await eventSyncHandlers.syncEvents({}, mockC);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Global Error");
    });
  });

  describe("pushToGcal", () => {
    it("pushes event and updates DB with gcal_event_id", async () => {
      vi.mocked(pushEventToGcal).mockResolvedValueOnce("new_gcal_id" as any);
      const socialConfig = { GCAL_SERVICE_ACCOUNT_EMAIL: "test", GCAL_PRIVATE_KEY: "key" };
      
      await eventSyncHandlers.pushToGcal({ id: "evt1", title: "Test", date_start: "2023-01-01" }, socialConfig, "cal1", mockDb);
      expect(mockDb.updateTable).toHaveBeenCalledWith("events");
      expect(mockDb.set).toHaveBeenCalledWith({ gcal_event_id: "new_gcal_id" });
    });

    it("ignores errors silently", async () => {
      vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("Push Failed"));
      const socialConfig = { GCAL_SERVICE_ACCOUNT_EMAIL: "test", GCAL_PRIVATE_KEY: "key" };
      
      await expect(eventSyncHandlers.pushToGcal({ id: "evt1", title: "Test", date_start: "2023-01-01" }, socialConfig, "cal1", mockDb)).resolves.toBeUndefined();
      expect(mockDb.updateTable).not.toHaveBeenCalled();
    });
  });

  describe("getCalendarSettings", () => {
    it("returns calendar settings", async () => {
      mockDb.execute.mockResolvedValueOnce([
        { key: "CALENDAR_ID_INTERNAL", value: "int_cal" },
        { key: "CALENDAR_ID_EXTERNAL", value: "ext_cal" }
      ]);
      const res = await eventSyncHandlers.getCalendarSettings({}, mockC);
      expect(res.status).toBe(200);
      expect(res.body.calendarIdInternal).toBe("int_cal");
      expect(res.body.calendarIdExternal).toBe("ext_cal");
    });

    it("returns 500 on DB error", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("DB Error"));
      const res = await eventSyncHandlers.getCalendarSettings({}, mockC);
      expect(res.status).toBe(500);
    });
  });
});
