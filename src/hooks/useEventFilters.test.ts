import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEventFilters } from "./useEventFilters";

import { EventItem } from "../components/events/EventCard";

describe("useEventFilters hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-10-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters and sorts upcoming and past events correctly", () => {
    const events: EventItem[] = [
      { id: "1", title: "Past Outreach", category: "outreach", date_start: "2023-10-10T10:00:00Z", date_end: null, location: "", description: "", cover_image: null, tba_event_key: null },
      { id: "1b", title: "Older Past Outreach", category: "outreach", date_start: "2023-10-05T10:00:00Z", date_end: null, location: "", description: "", cover_image: null, tba_event_key: null },
      { id: "2", title: "Future Outreach", category: "outreach", date_start: "2023-10-20T10:00:00Z", date_end: null, location: "", description: "", cover_image: null, tba_event_key: null },
      { id: "2b", title: "Later Future Outreach", category: "outreach", date_start: "2023-10-25T10:00:00Z", date_end: null, location: "", description: "", cover_image: null, tba_event_key: null },
      { id: "3", title: "Past Practice", category: "internal", date_start: "2023-10-11T10:00:00Z", date_end: null, location: "", description: "", cover_image: null, tba_event_key: null },
      { id: "4", title: "Future Practice", category: "internal", date_start: "2023-10-21T10:00:00Z", date_end: null, location: "", description: "", cover_image: null, tba_event_key: null },
      { id: "5", title: "Past External", category: "external", date_start: "2023-10-12T10:00:00Z", date_end: null, location: "", description: "", cover_image: null, tba_event_key: null },
      { id: "6", title: "Future External", category: "external", date_start: "2023-10-22T10:00:00Z", date_end: null, location: "", description: "", cover_image: null, tba_event_key: null }
    ];

    const { result } = renderHook(() => useEventFilters(events));
    
    expect(result.current.upcomingOutreach).toHaveLength(2);
    expect(result.current.upcomingOutreach[0].id).toBe("2");
    expect(result.current.upcomingOutreach[1].id).toBe("2b");
    
    expect(result.current.pastOutreach).toHaveLength(2);
    expect(result.current.pastOutreach[0].id).toBe("1");
    expect(result.current.pastOutreach[1].id).toBe("1b");

    expect(result.current.upcomingPractices).toHaveLength(1);
    expect(result.current.upcomingPractices[0].id).toBe("4");
    
    expect(result.current.pastPractices).toHaveLength(1);
    expect(result.current.pastPractices[0].id).toBe("3");

    expect(result.current.upcomingExternal).toHaveLength(1);
    expect(result.current.upcomingExternal[0].id).toBe("6");
  });

  it("identifies active competition correctly", () => {
    const events: EventItem[] = [
      { id: "1", title: "Inactive Comp", category: "external", date_start: "2023-01-01T10:00:00Z", date_end: null, tba_event_key: "2023evt1", location: "", description: "", cover_image: null },
      { id: "2", title: "Active Comp", category: "external", date_start: "2023-10-14T10:00:00Z", date_end: "2023-10-16T10:00:00Z", tba_event_key: "2023evt2", location: "", description: "", cover_image: null }
    ];

    const { result } = renderHook(() => useEventFilters(events));
    expect(result.current.activeCompetition).toBeDefined();
    expect(result.current.activeCompetition?.id).toBe("2");
  });

  it("identifies active competition using default end date (start + 3 days) if date_end is missing", () => {
    const events: EventItem[] = [
      { id: "3", title: "Active Comp No End", category: "external", date_start: "2023-10-14T10:00:00Z", date_end: null, tba_event_key: "2023evt3", location: "", description: "", cover_image: null }
    ];

    const { result } = renderHook(() => useEventFilters(events));
    expect(result.current.activeCompetition).toBeDefined();
    expect(result.current.activeCompetition?.id).toBe("3");
  });
});
