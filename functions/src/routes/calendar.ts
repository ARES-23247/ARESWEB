import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";

const router = express.Router();

function escapeIcalText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function formatIcalDate(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString().replace(/-|:|\.\d+Z?/g, "");
  }
  
  // Clean string directly if it has no timezone info
  const hasTz = dateStr.endsWith("Z") || dateStr.includes("+") || (dateStr.includes("-") && dateStr.lastIndexOf("-") > 7);
  if (!hasTz) {
    let cleaned = dateStr.replace(/-|:/g, "");
    if (cleaned.length === 13) { // YYYYMMDDTHHMM
      cleaned += "00";
    }
    const dotIndex = cleaned.indexOf(".");
    if (dotIndex !== -1) {
      cleaned = cleaned.slice(0, dotIndex);
    }
    return cleaned;
  }

  // Otherwise, use Date parsing
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace(/-|:|\.\d+/g, ""); // Keep Z
    }
  } catch {}
  
  return new Date().toISOString().replace(/-|:|\.\d+Z?/g, "");
}

function addHoursToDate(dateStr: string, hours: number): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      d.setHours(d.getHours() + hours);
      const hasTz = dateStr.endsWith("Z") || dateStr.includes("+") || (dateStr.includes("-") && dateStr.lastIndexOf("-") > 7);
      if (!hasTz) {
        const pad = (n: number) => String(n).padStart(2, "0");
        const yr = d.getFullYear();
        const mo = pad(d.getMonth() + 1);
        const dy = pad(d.getDate());
        const hr = pad(d.getHours());
        const mi = pad(d.getMinutes());
        const sc = pad(d.getSeconds());
        return `${yr}${mo}${dy}T${hr}${mi}${sc}`;
      }
      return d.toISOString().replace(/-|:|\.\d+/g, ""); // Keep Z
    }
  } catch {}
  return "";
}

// GET /api/calendar/feed - Get public events ICS feed
router.get("/feed", asyncHandler(async (req, res) => {
  const eventsSnapshot = await adminDb
    .collection("events")
    .where("isDeleted", "==", 0)
    .where("status", "==", "published")
    .limit(200)
    .get();

  const nowStr = new Date().toISOString().replace(/-|:|\.\d+Z?/g, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ARES 23247//Team Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ARES 23247 Team Calendar",
    "X-WR-TIMEZONE:UTC",
  ];

  eventsSnapshot.forEach((doc) => {
    const data = doc.data();
    const startStr = formatIcalDate(data.dateStart || "");
    const endStr = data.dateEnd 
      ? formatIcalDate(data.dateEnd) 
      : addHoursToDate(data.dateStart || "", 2);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${doc.id}@ares23247.org`);
    lines.push(`DTSTAMP:${nowStr}`);
    lines.push(`DTSTART:${startStr}`);
    lines.push(`DTEND:${endStr}`);
    lines.push(`SUMMARY:${escapeIcalText(data.title || "Untitled Event")}`);
    if (data.description) {
      lines.push(`DESCRIPTION:${escapeIcalText(data.description)}`);
    }
    if (data.location) {
      lines.push(`LOCATION:${escapeIcalText(data.location)}`);
    }
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="ares_calendar.ics"');
  res.send(icsContent);
}));

export default router;
