import type { Router } from "express";
import { adminDb } from "../lib/firebase-admin";
import { toPlainText } from "../lib/contentFormatters";
import { asyncHandler } from "../lib/utils";
import {
  addHours,
  escapeIcalText,
  type EventDocument,
  eventDto,
  expandEventOccurrences,
  formatIcalDate,
  publicEventDescription,
  readRecurrence,
  readString,
} from "./calendarHelpers";
import {
  FEED_EXCEPTION_QUERY_MAX,
  feedLocationIds,
  futureYmd,
  loadOccurrenceStates,
  loadPublicVenueLabels,
  pastYmd,
} from "./calendarShared";

export function registerCalendarFeedRoutes(router: Router): void {
// The subscription feed uses the same published, non-deleted source of truth.
router.get(
  "/feed",
  asyncHandler(async (_req, res) => {
    const snapshot = await adminDb
      .collection("events")
      .where("isDeleted", "==", 0)
      .where("status", "==", "published")
      .orderBy("dateStart", "asc")
      .limit(200)
      .get();

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ARES 23247//Team Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:ARES 23247 Team Calendar",
      "X-WR-TIMEZONE:UTC",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
    ];

    const recurringIds = snapshot.docs
      .filter((document) => readRecurrence((document.data() as EventDocument).recurrence))
      .map((document) => document.id);
    const occurrenceStates = await loadOccurrenceStates(
      recurringIds,
      pastYmd(31),
      futureYmd(366),
      FEED_EXCEPTION_QUERY_MAX,
    );
    const publicVenueLabels = await loadPublicVenueLabels(
      feedLocationIds(snapshot.docs, occurrenceStates),
    );

    for (const document of snapshot.docs) {
      const data = document.data() as EventDocument;
      const dateStart = readString(data.dateStart);
      const start = formatIcalDate(dateStart);
      if (!start || !dateStart) continue;
      const end = formatIcalDate(readString(data.dateEnd)) ?? addHours(dateStart, 2);
      if (!end) continue;
      const updated = formatIcalDate(readString(data.updatedAt)) ?? start;
      const recurrence = readRecurrence(data.recurrence);
      const occurrenceState = occurrenceStates.get(document.id);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${document.id}@aresfirst.org`);
      lines.push(`DTSTAMP:${updated}`);
      lines.push(`LAST-MODIFIED:${updated}`);
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
      if (recurrence) {
        // Calendar apps expand the rule natively; cancelled sessions become
        // EXDATEs so subscribed clients skip them.
        const rule = [
          "FREQ=WEEKLY",
          `INTERVAL=${recurrence.interval}`,
          `BYDAY=${recurrence.byDay.join(",")}`,
        ];
        if (recurrence.until)
          rule.push(`UNTIL=${recurrence.until.replace(/-/g, "")}T235959Z`);
        lines.push(`RRULE:${rule.join(";")}`);
        const cancelled = occurrenceState?.cancelledDates;
        if (cancelled && cancelled.size > 0) {
          lines.push(
            `EXDATE:${[...cancelled]
              .sort()
              .map((date) => `${date.replace(/-/g, "")}T${start.slice(9, 15)}Z`)
              .join(",")}`,
          );
        }
      }
      lines.push(`SUMMARY:${escapeIcalText(readString(data.title) ?? "Untitled event")}`,
      );
      const cleanDescription = toPlainText(
        publicEventDescription(data.description),
      );
      if (cleanDescription)
        lines.push(`DESCRIPTION:${escapeIcalText(cleanDescription)}`);
      const publicLocation = publicVenueLabels.get(readString(data.locationId) ?? "");
      if (publicLocation) {
        lines.push(`LOCATION:${escapeIcalText(publicLocation)}`);
      }
      lines.push("END:VEVENT");

      // RFC 5545 recurrence exceptions keep the series UID and identify the
      // original generated session with RECURRENCE-ID.
      if (recurrence && occurrenceState?.overrides.size) {
        const managedDto = eventDto(document.id, data, true);
        for (const [date, overrides] of [...occurrenceState.overrides].sort(
          ([a], [b]) => a.localeCompare(b),
        )) {
          if (occurrenceState.cancelledDates.has(date)) continue;
          const [baseOccurrence] = expandEventOccurrences(managedDto, data, {
            fromDate: date,
            toDate: date,
            maxPerEvent: 1,
          });
          const [effectiveOccurrence] = expandEventOccurrences(
            managedDto,
            data,
            {
              fromDate: date,
              toDate: date,
              occurrenceOverrides: new Map([[date, overrides]]),
              maxPerEvent: 1,
            },
          );
          if (!baseOccurrence || !effectiveOccurrence) continue;
          const recurrenceId = formatIcalDate(baseOccurrence.dateStart);
          const occurrenceStart = formatIcalDate(effectiveOccurrence.dateStart);
          const occurrenceEnd =
            formatIcalDate(effectiveOccurrence.dateEnd) ??
            addHours(effectiveOccurrence.dateStart, 2);
          if (!recurrenceId || !occurrenceStart || !occurrenceEnd) continue;
          lines.push("BEGIN:VEVENT");
          lines.push(`UID:${document.id}@aresfirst.org`);
          lines.push(`RECURRENCE-ID:${recurrenceId}`);
          lines.push(`DTSTAMP:${updated}`);
          lines.push(`LAST-MODIFIED:${updated}`);
          lines.push(`DTSTART:${occurrenceStart}`);
          lines.push(`DTEND:${occurrenceEnd}`);
          lines.push(`SUMMARY:${escapeIcalText(effectiveOccurrence.title)}`);
          const occurrenceDescription = toPlainText(
            publicEventDescription(effectiveOccurrence.description),
          );
          if (occurrenceDescription) {
            lines.push(`DESCRIPTION:${escapeIcalText(occurrenceDescription)}`);
          }
          const occurrenceLocation = publicVenueLabels.get(
            readString(
              "locationId" in effectiveOccurrence
                ? effectiveOccurrence.locationId
                : null,
            ) ?? "",
          );
          if (occurrenceLocation) {
            lines.push(`LOCATION:${escapeIcalText(occurrenceLocation)}`);
          }
          lines.push("END:VEVENT");
        }
      }
    }
    lines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="ares_calendar.ics"',
    );
    res.setHeader(
      "Cache-Control",
      "no-cache, no-store, must-revalidate, max-age=0",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(lines.join("\r\n"));
  }),
);
}

