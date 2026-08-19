import { authenticatedFetch } from "@/lib/api";
import type { EventOccurrenceDefaults, TeamEvent } from "@/types/event";
import type { TeamLocation } from "@/types/location";

interface ApiErrorPayload {
  error?: unknown;
  code?: unknown;
}

interface EventPayload {
  event: unknown;
}

interface EventsPayload {
  events: unknown;
  nextCursor?: unknown;
}

interface LocationsPayload {
  locations: unknown;
}

export interface CalendarPageResult {
  events: TeamEvent[];
  nextCursor: string | null;
}

export interface EventWriteInput {
  title: string;
  dateStart: string;
  dateEnd?: string;
  recurrence?: {
    frequency: "weekly";
    interval: number;
    byDay: string[];
    until?: string;
  };
  locationId?: string;
  location?: string;
  description?: string;
  category: "internal" | "outreach" | "competition";
  coverImage?: string;
  isPotluck?: 0 | 1;
  isVolunteer?: 0 | 1;
  status?: "published" | "pending" | "draft";
}

export interface OccurrenceWriteInput {
  title: string;
  dateStart: string;
  dateEnd: string | null;
  locationId: string | null;
  location: string | null;
  description: string | null;
  category: "internal" | "outreach" | "competition";
  coverImage: string | null;
  isPotluck: 0 | 1;
  isVolunteer: 0 | 1;
}

export interface LocationWriteInput {
  name: string;
  address: string;
  description?: string;
  gmapsUrl?: string;
  isAddressPublic?: 0 | 1;
}

export class CalendarApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly code?: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}: ${statusText}`);
    this.name = "CalendarApiError";
  }
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`Calendar response has an invalid ${key}.`);
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeOccurrenceDefaults(value: unknown): EventOccurrenceDefaults | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const title = optionalString(record, "title");
  const dateStart = optionalString(record, "dateStart");
  if (!title || !dateStart) return undefined;
  return {
    title,
    dateStart,
    dateEnd: optionalString(record, "dateEnd"),
    locationId: optionalString(record, "locationId"),
    location: optionalString(record, "location"),
    description: optionalString(record, "description"),
    category:
      record.category === "outreach" ? "outreach" : record.category === "competition" ? "competition" : "internal",
    coverImage: optionalString(record, "coverImage"),
    isPotluck: record.isPotluck === 1 ? 1 : 0,
    isVolunteer: record.isVolunteer === 1 ? 1 : 0,
  };
}

function normalizeEvent(value: unknown): TeamEvent {
  if (!value || typeof value !== "object") throw new Error("Calendar response contains an invalid event.");
  const record = value as Record<string, unknown>;
  const category =
    record.category === "outreach" ? "outreach" : record.category === "competition" ? "competition" : "internal";
  const status =
    record.status === "published" || record.status === "pending" || record.status === "draft"
      ? record.status
      : undefined;
  const publicVenueRecord =
    record.publicVenue && typeof record.publicVenue === "object"
      ? (record.publicVenue as Record<string, unknown>)
      : null;
  const publicVenueName = publicVenueRecord ? optionalString(publicVenueRecord, "name") : undefined;
  const publicVenueAddress = publicVenueRecord ? optionalString(publicVenueRecord, "address") : undefined;
  const recurrenceRecord =
    record.recurrence && typeof record.recurrence === "object" ? (record.recurrence as Record<string, unknown>) : null;
  const byDay = Array.isArray(recurrenceRecord?.byDay)
    ? recurrenceRecord.byDay.filter((code): code is string => typeof code === "string")
    : [];
  const recurrence =
    recurrenceRecord && recurrenceRecord.frequency === "weekly" && byDay.length > 0
      ? {
          frequency: "weekly" as const,
          interval: typeof recurrenceRecord.interval === "number" ? recurrenceRecord.interval : 1,
          byDay,
          until: typeof recurrenceRecord.until === "string" ? recurrenceRecord.until : undefined,
        }
      : undefined;
  return {
    id: requiredString(record, "id"),
    title: requiredString(record, "title"),
    dateStart: requiredString(record, "dateStart"),
    dateEnd: optionalString(record, "dateEnd"),
    recurrence,
    recurrenceOf: optionalString(record, "recurrenceOf"),
    occurrenceDate: optionalString(record, "occurrenceDate"),
    seriesDateStart: optionalString(record, "seriesDateStart"),
    seriesDateEnd: optionalString(record, "seriesDateEnd"),
    seriesDefaults: normalizeOccurrenceDefaults(record.seriesDefaults),
    locationId: optionalString(record, "locationId"),
    location: optionalString(record, "location"),
    publicVenue:
      publicVenueName && publicVenueAddress ? { name: publicVenueName, address: publicVenueAddress } : undefined,
    description: optionalString(record, "description"),
    category,
    coverImage: optionalString(record, "coverImage"),
    isPotluck: record.isPotluck === 1 ? 1 : 0,
    isVolunteer: record.isVolunteer === 1 ? 1 : 0,
    isDeleted: record.isDeleted === 1 ? 1 : 0,
    status,
    createdAt: optionalString(record, "createdAt"),
    updatedAt: optionalString(record, "updatedAt"),
    archivedAt: optionalString(record, "archivedAt"),
  };
}

function normalizeLocation(value: unknown): TeamLocation {
  if (!value || typeof value !== "object") throw new Error("Calendar response contains an invalid venue.");
  const record = value as Record<string, unknown>;
  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    address: requiredString(record, "address"),
    description: optionalString(record, "description"),
    gmapsUrl: optionalString(record, "gmapsUrl"),
    isAddressPublic: record.isAddressPublic === 1 ? 1 : 0,
    isDeleted: record.isDeleted === 1 ? 1 : 0,
    createdAt: optionalString(record, "createdAt"),
    updatedAt: optionalString(record, "updatedAt"),
    archivedAt: optionalString(record, "archivedAt"),
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init);
  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      // The HTTP status remains useful when the response body is not JSON.
    }
    const serverMessage = typeof payload.error === "string" ? payload.error : undefined;
    const code = typeof payload.code === "string" ? payload.code : undefined;
    const statusText = response.statusText || "Request failed";
    throw new CalendarApiError(
      response.status,
      statusText,
      code,
      `HTTP ${response.status}: ${statusText}${serverMessage ? ` — ${serverMessage}` : ""}`,
    );
  }
  return (await response.json()) as T;
}

function jsonRequest(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function withPage(path: string, limit: number, cursor?: string | null, expandDays?: number): string {
  const params = new URLSearchParams({
    limit: String(Math.min(150, Math.max(1, Math.trunc(limit)))),
  });
  if (cursor) params.set("cursor", cursor);
  if (expandDays) params.set("expandDays", String(Math.trunc(expandDays)));
  return `${path}?${params.toString()}`;
}

export async function fetchPublicEvents(
  limit = 50,
  cursor?: string | null,
  expandDays?: number,
): Promise<CalendarPageResult> {
  const payload = await requestJson<EventsPayload>(withPage("/api/calendar/events", limit, cursor, expandDays));
  if (!Array.isArray(payload.events)) throw new Error("Calendar response does not contain an event list.");
  return {
    events: payload.events.map(normalizeEvent),
    nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : null,
  };
}

export async function fetchPublicEvent(eventId: string, occurrenceDate?: string): Promise<TeamEvent> {
  const path = `/api/calendar/events/${encodeURIComponent(eventId)}`;
  const query = occurrenceDate ? `?${new URLSearchParams({ occurrence: occurrenceDate }).toString()}` : "";
  const payload = await requestJson<EventPayload>(`${path}${query}`);
  return normalizeEvent(payload.event);
}

export async function fetchManagedEvents(
  limit = 100,
  cursor?: string | null,
  expandDays?: number,
): Promise<CalendarPageResult> {
  const payload = await requestJson<EventsPayload>(withPage("/api/calendar/manage", limit, cursor, expandDays));
  if (!Array.isArray(payload.events)) throw new Error("Calendar response does not contain an event list.");
  return {
    events: payload.events.map(normalizeEvent),
    nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : null,
  };
}

export async function fetchManagedEvent(eventId: string, occurrenceDate?: string): Promise<TeamEvent> {
  const params = occurrenceDate ? `?${new URLSearchParams({ occurrence: occurrenceDate }).toString()}` : "";
  const payload = await requestJson<EventPayload>(`/api/calendar/manage/${encodeURIComponent(eventId)}${params}`);
  return normalizeEvent(payload.event);
}

export async function createEvent(input: EventWriteInput): Promise<TeamEvent> {
  const payload = await requestJson<EventPayload>("/api/calendar/manage", jsonRequest("POST", input));
  return normalizeEvent(payload.event);
}

export async function updateEvent(eventId: string, input: EventWriteInput): Promise<TeamEvent> {
  const payload = await requestJson<EventPayload>(
    `/api/calendar/manage/${encodeURIComponent(eventId)}`,
    jsonRequest("PUT", input),
  );
  return normalizeEvent(payload.event);
}

export async function updateEventOccurrence(
  eventId: string,
  date: string,
  input: OccurrenceWriteInput,
): Promise<TeamEvent> {
  const payload = await requestJson<EventPayload>(
    `/api/calendar/manage/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(date)}`,
    jsonRequest("PUT", input),
  );
  return normalizeEvent(payload.event);
}

export async function archiveEvent(eventId: string): Promise<void> {
  await requestJson(`/api/calendar/manage/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
}

export async function restoreEvent(eventId: string): Promise<void> {
  await requestJson(`/api/calendar/manage/${encodeURIComponent(eventId)}/restore`, { method: "PATCH" });
}

export async function publishEvent(eventId: string): Promise<void> {
  await requestJson(`/api/calendar/manage/${encodeURIComponent(eventId)}/publish`, { method: "PATCH" });
}

export interface EventOccurrenceException {
  date: string;
  isCancelled: boolean;
  hasOverrides: boolean;
}

export async function fetchEventOccurrences(eventId: string): Promise<EventOccurrenceException[]> {
  const payload = await requestJson<{ occurrences?: unknown }>(
    `/api/calendar/manage/${encodeURIComponent(eventId)}/occurrences`,
  );
  if (!Array.isArray(payload.occurrences)) throw new Error("Calendar response does not contain an occurrence list.");
  return payload.occurrences.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Calendar response contains an invalid occurrence.");
    const record = value as Record<string, unknown>;
    if (typeof record.date !== "string") throw new Error("Calendar response contains an invalid occurrence date.");
    return {
      date: record.date,
      isCancelled: record.isCancelled === true,
      hasOverrides: record.hasOverrides === true,
    };
  });
}

export async function cancelEventOccurrence(eventId: string, date: string): Promise<void> {
  await requestJson(`/api/calendar/manage/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(date)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cancelled: true }),
  });
}

export async function restoreEventOccurrence(eventId: string, date: string): Promise<void> {
  await requestJson(
    `/api/calendar/manage/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(date)}/restore`,
    { method: "PATCH" },
  );
}

export async function fetchLocations(): Promise<TeamLocation[]> {
  const payload = await requestJson<LocationsPayload>("/api/calendar/locations");
  if (!Array.isArray(payload.locations)) throw new Error("Calendar response does not contain a venue list.");
  return payload.locations.map(normalizeLocation);
}

export async function createLocation(input: LocationWriteInput): Promise<TeamLocation> {
  const payload = await requestJson<{ location: unknown }>("/api/calendar/locations", jsonRequest("POST", input));
  return normalizeLocation(payload.location);
}

export async function updateLocation(locationId: string, input: LocationWriteInput): Promise<TeamLocation> {
  const payload = await requestJson<{ location: unknown }>(
    `/api/calendar/locations/${encodeURIComponent(locationId)}`,
    jsonRequest("PUT", input),
  );
  return normalizeLocation(payload.location);
}

export async function archiveLocation(locationId: string): Promise<void> {
  await requestJson(`/api/calendar/locations/${encodeURIComponent(locationId)}`, { method: "DELETE" });
}

export async function restoreLocation(locationId: string): Promise<void> {
  await requestJson(`/api/calendar/locations/${encodeURIComponent(locationId)}/restore`, { method: "PATCH" });
}
