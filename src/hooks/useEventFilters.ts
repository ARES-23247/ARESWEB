import { useMemo } from "react";
import { isAfter, subDays, addDays, parseISO } from "date-fns";
import { EventItem } from "../components/events/EventCard";

/**
 * REF-F01: Extracted from Events.tsx to reduce page component complexity.
 * Memoizes expensive event filtering, sorting, and active competition detection.
 */
export function useEventFilters(events: EventItem[]) {
  return useMemo(() => {
    const now = new Date();
    const bufferTime = subDays(now, 1);

    // Filter out events with invalid dates
    const validEvents = events.filter(e => e.dateStart != null);

    const outreach = validEvents.filter(e => e.category === "outreach");
    const internal = validEvents.filter(e => e.category === "internal");
    const external = validEvents.filter(e => e.category === "external");

    const sortAsc = (a: EventItem, b: EventItem) =>
      parseISO(a.dateStart).getTime() - parseISO(b.dateStart).getTime();

    const isUpcoming = (e: EventItem) => {
      if (e.dateEnd) {
        return isAfter(parseISO(e.dateEnd), now);
      }
      return isAfter(parseISO(e.dateStart), bufferTime);
    };

    return {
      upcomingOutreach: outreach.filter(e => isUpcoming(e)).sort(sortAsc),
      upcomingPractices: internal.filter(e => isUpcoming(e)).sort(sortAsc),
      upcomingExternal: external.filter(e => isUpcoming(e)).sort(sortAsc),
      pastOutreach: outreach.filter(e => !isUpcoming(e)).sort(sortAsc).reverse(),
      pastPractices: internal.filter(e => !isUpcoming(e)).sort(sortAsc).reverse(),
      activeCompetition: events.find(e => {
        if (!e.tbaEventKey) return false;
        const start = parseISO(e.dateStart);
        const end = e.dateEnd ? parseISO(e.dateEnd) : addDays(start, 3);
        return now >= start && now <= end;
      })
    };
  }, [events]);
}

