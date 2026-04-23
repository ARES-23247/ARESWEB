import { SignJWT, importPKCS8 } from "jose";
import { parseAstToText } from "./content";

export interface GCalConfig {
  email: string;
  privateKey: string;
  calendarId: string;
}

export interface ARES_Event {
  id: string;
  title: string;
  date_start: string;
  date_end?: string;
  location?: string;
  description?: string;
  cover_image?: string;
  gcal_event_id?: string;
}

/**
 * Mint a short-lived OAuth2 Access Token using the Google Service Account JWK.
 */
export async function getGcalAccessToken(config: GCalConfig): Promise<string> {
  const alg = "RS256";
  // The private key from GCP usually has literal \n that we must preserve.
  const formattedKey = config.privateKey.replace(/\\n/g, "\n");
  
  const pk = await importPKCS8(formattedKey, alg);
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/calendar" })
    .setProtectedHeader({ alg, typ: "JWT" })
    .setIssuer(config.email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(pk);

  const res = await fetch("https://oauth2.googleapis.com/token", { signal: AbortSignal.timeout(5000),
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!data.access_token) {
    throw new Error("Failed to get Google Calendar access token: Invalid Service Account response");
  }
  return data.access_token as string;
}

/**
 * Prepare ARES Event format for Google Calendar payload
 */
function prepareGcalPayload(event: ARES_Event) {
  // If there's no end date, make it a 1 hour event from start, or all day.
  const hasTime = event.date_start.includes("T");
  const baseStart = hasTime ? event.date_start : `${event.date_start.split("T")[0]}T00:00:00Z`;

  const getNyOffset = (dateStr: string) => {
    const d = new Date(dateStr.includes("T") ? dateStr + (dateStr.endsWith("Z") ? "" : "Z") : dateStr + "T12:00:00Z");
    const parts = new Intl.DateTimeFormat("en-US", { 
      timeZone: "America/New_York", 
      timeZoneName: "shortOffset" 
    }).formatToParts(d);
    
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || "";
    // offsetPart could be "GMT-4", "GMT-5", "GMT", "GMT-05:00", or "+00:00" depending on environment
    
    if (offsetPart === "GMT" || offsetPart === "UTC") return "+00:00";
    
    // eslint-disable-next-line security/detect-unsafe-regex
    const match = offsetPart.match(/([+-]\d{1,2})(?::?(\d{2}))?/);
    if (match) {
      let hours = match[1];
      if (hours.length === 2) {
        hours = `${hours[0]}0${hours[1]}`; // Convert "-5" to "-05"
      }
      const minutes = match[2] || "00";
      return `${hours}:${minutes}`;
    }
    
    // Absolute dynamic fallback based on the system running the worker
    const offsetMin = d.getTimezoneOffset();
    const sign = offsetMin > 0 ? "-" : "+";
    const absMin = Math.abs(offsetMin);
    const h = String(Math.floor(absMin / 60)).padStart(2, "0");
    const m = String(absMin % 60).padStart(2, "0");
    return `${sign}${h}:${m}`;
  };

  const formatFloatingDateTime = (dt: string) => {
    if (dt.endsWith("Z") || dt.includes("+") || dt.split("T")[1]?.includes("-")) {
      return new Date(dt).toISOString();
    }
    const cleanDt = dt.length === 16 ? `${dt}:00` : dt;
    return cleanDt + getNyOffset(cleanDt);
  };

  const startObj = hasTime
    ? { dateTime: formatFloatingDateTime(baseStart), timeZone: "America/New_York" }
    : { date: baseStart.split("T")[0] };

  let endObj;
  if (event.date_end) {
    const endHasTime = event.date_end.includes("T");
    endObj = endHasTime
      ? { dateTime: formatFloatingDateTime(event.date_end), timeZone: "America/New_York" }
      : { date: event.date_end.split("T")[0] };
  } else {
    if (hasTime) {
      const d = new Date(baseStart + "Z"); 
      d.setUTCHours(d.getUTCHours() + 1);
      const tzLess = d.toISOString().replace(".000Z", "");
      endObj = { dateTime: formatFloatingDateTime(tzLess), timeZone: "America/New_York" };
    } else {
      endObj = startObj;
    }
  }

  const cleanDescription = parseAstToText(event.description || "");

  return {
    summary: event.title,
    location: event.location || "",
    description: cleanDescription,
    start: startObj,
    end: endObj,
  };
}

/**
 * Push a new or updated event to Google Calendar (Outbound Sync)
 * Returns the gcal_event_id.
 */
export async function pushEventToGcal(event: ARES_Event, config: GCalConfig): Promise<string | undefined> {
  if (!config.email || !config.privateKey || !config.calendarId) return undefined;
  
  const token = await getGcalAccessToken(config);
  const payload = prepareGcalPayload(event);

  let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`;
  let method = "POST";

  if (event.gcal_event_id) {
    url += `/${event.gcal_event_id}`;
    method = "PUT";
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(5000),
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    console.error("Failed to push to GCal:", data);
    throw new Error(`Google API Error: ${res.status}`);
  }

  return data.id as string | undefined; // Returns the generated or existing gcal_id
}

/**
 * Delete an event from Google Calendar (Outbound Sync)
 */
export async function deleteEventFromGcal(gcal_id: string, config: GCalConfig) {
  if (!config.email || !config.privateKey || !config.calendarId || !gcal_id) return;

  const token = await getGcalAccessToken(config);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${gcal_id}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(5000),
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 410 && res.status !== 404) {
    const text = await res.text();
    console.error(`Failed to delete GCal event (${res.status}):`, text);
  }
}

/**
 * Pull events from Google Calendar (Inbound Sync)
 * Returns a list of standardized events to merge into D1.
 */
export async function pullEventsFromGcal(config: GCalConfig): Promise<ARES_Event[]> {
  const token = await getGcalAccessToken(config);
  
  // Fetch up to 2500 events starting from 2 years ago to avoid truncating current events
  const timeMin = new Date();
  timeMin.setFullYear(timeMin.getFullYear() - 2);
  
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?maxResults=2500&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(timeMin.toISOString())}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(5000),
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to pull from GCal: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  
  interface GCalItem {
    id: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    location?: string;
    description?: string;
  }
  
  const items = (data.items as GCalItem[]) || [];

  return items.map((item: GCalItem) => ({
    id: `gcal-${item.id}`,
    title: item.summary || "Untitled Event",
    date_start: item.start?.dateTime || item.start?.date || "",
    date_end: item.end?.dateTime || item.end?.date || "",
    location: item.location || "",
    description: item.description || "",
    gcal_event_id: item.id,
  }));
}
