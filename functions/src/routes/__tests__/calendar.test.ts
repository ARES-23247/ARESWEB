import { describe, it, expect, vi, beforeEach } from "vitest";
import calendarRouter from "../calendar";
import { adminDb } from "../../lib/firebase-admin";

vi.mock("../../lib/firebase-admin", () => {
  const mockQuery = {
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };
  return {
    adminDb: {
      collection: vi.fn().mockReturnValue(mockQuery),
    },
  };
});

describe("GET /feed Calendar Feed Route", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {};
    res = {
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    next = vi.fn();
  });

  it("should return a correctly formatted iCal ICS file with events", async () => {
    const mockEvents = [
      {
        id: "evt_1",
        data: () => ({
          title: "Practice Meeting",
          dateStart: "2026-05-24T09:30:00",
          dateEnd: "2026-05-24T11:30:00",
          location: "Lab Room A",
          description: "Working on sliding intakes.",
          category: "internal",
        }),
      },
      {
        id: "evt_2",
        data: () => ({
          title: "Outreach Fair",
          dateStart: "2026-06-18T10:00:00",
          location: "Museum Entrance",
          description: "Science demonstration.",
          category: "outreach",
        }),
      },
    ];

    const mockGet = vi.fn().mockResolvedValue({
      forEach: (callback: (doc: any) => void) => mockEvents.forEach(callback),
    });

    const mockQuery = adminDb.collection("events");
    vi.mocked(mockQuery.get).mockImplementation(mockGet);

    // Retrieve the handler function from the express router stack
    const routeLayer = calendarRouter.stack.find(
      (layer) => layer.route && layer.route.path === "/feed"
    );
    expect(routeLayer).toBeDefined();
    const route = routeLayer?.route;
    expect(route).toBeDefined();
    const handler = route!.stack[0].handle;

    await handler(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/calendar; charset=utf-8");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="ares_calendar.ics"');
    
    expect(res.send).toHaveBeenCalled();
    const icsContent: string = res.send.mock.calls[0][0];

    // Assert standard calendar boundaries
    expect(icsContent).toContain("BEGIN:VCALENDAR");
    expect(icsContent).toContain("VERSION:2.0");
    expect(icsContent).toContain("PRODID:-//ARES 23247//Team Calendar//EN");
    expect(icsContent).toContain("X-WR-CALNAME:ARES 23247 Team Calendar");

    // Assert event 1 (with dateEnd)
    expect(icsContent).toContain("BEGIN:VEVENT");
    expect(icsContent).toContain("UID:evt_1@ares23247.org");
    expect(icsContent).toContain("DTSTART:20260524T093000");
    expect(icsContent).toContain("DTEND:20260524T113000");
    expect(icsContent).toContain("SUMMARY:Practice Meeting");
    expect(icsContent).toContain("DESCRIPTION:Working on sliding intakes.");
    expect(icsContent).toContain("LOCATION:Lab Room A");

    // Assert event 2 (without dateEnd, should default to +2 hours)
    expect(icsContent).toContain("UID:evt_2@ares23247.org");
    expect(icsContent).toContain("DTSTART:20260618T100000");
    expect(icsContent).toContain("DTEND:20260618T120000");
    expect(icsContent).toContain("SUMMARY:Outreach Fair");
    expect(icsContent).toContain("DESCRIPTION:Science demonstration.");
    expect(icsContent).toContain("LOCATION:Museum Entrance");
    
    expect(icsContent).toContain("END:VCALENDAR");
  });
});
