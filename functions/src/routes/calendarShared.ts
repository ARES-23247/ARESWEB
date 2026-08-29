import { NextFunction, Response } from "express";
import { z } from "zod";
import { adminDb, adminStorage } from "../lib/firebase-admin";
import { AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import {
  canPublish,
  type EventDocument,
  type EventOccurrence,
  eventDto,
  expandEventOccurrences,
  isOccurrenceDate,
  type LocationDocument,
  parseId,
  publicVenueDto,
  readOccurrenceOverrides,
  readRecurrence,
  readString,
} from "./calendarHelpers";
import {
  safeManagedPhotoPath,
  type ManagedPhotoRecord,
} from "../lib/managedPhotoMedia";
import { firebaseStorageObjectFromUrl } from "../lib/publicMedia";

/** Recurring sessions are materialized for a forward window from today. */
const OCCURRENCE_WINDOW_DAYS = 56;
const OCCURRENCE_WINDOW_MAX_DAYS = 190;
/** Hard ceiling on expanded occurrences per page regardless of inputs. */
const OCCURRENCE_PAGE_MAX = 300;
const OCCURRENCE_EXCEPTION_QUERY_MAX = 500;
export const FEED_EXCEPTION_QUERY_MAX = 1_000;
export const eventPhotoAssociationSchema = z
  .object({
    photoId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Photo ID is invalid."),
    occurrenceDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .strict();

export function occurrenceWindowDays(requested: unknown): number {
  const parsed = Number.parseInt(String(requested ?? ""), 10);
  if (!Number.isFinite(parsed)) return OCCURRENCE_WINDOW_DAYS;
  return Math.min(OCCURRENCE_WINDOW_MAX_DAYS, Math.max(OCCURRENCE_WINDOW_DAYS, parsed));
}

function perEventCap(windowDays: number): number {
  // Roughly one session per weekday per week inside the window, bounded.
  return Math.min(26, Math.ceil(windowDays / 7) * 2);
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function futureYmd(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function pastYmd(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function requireManagedCoverPhoto(photoId: string | null | undefined): Promise<void> {
  if (!photoId) return;
  const snapshot = await adminDb.collection("imported_photos").doc(photoId).get();
  const data = (snapshot.data() || {}) as ManagedPhotoRecord;
  if (!snapshot.exists || data.isDeleted === 1 || !safeManagedPhotoPath(data.storagePath)) {
    throw new ApiError(400, "Choose an available managed photo for the event cover.", "INVALID_COVER_PHOTO");
  }
}

export function rejectDirectManagedStorageUrl(url: string | null | undefined): void {
  if (!url) return;
  const object = firebaseStorageObjectFromUrl(url);
  if (object?.bucket === adminStorage.bucket().name) {
    throw new ApiError(
      400,
      "Choose the image from managed photos instead of saving a direct Storage URL.",
      "DIRECT_STORAGE_URL",
    );
  }
}

interface OccurrenceState {
  cancelledDates: Set<string>;
  overrides: Map<string, ReturnType<typeof readOccurrenceOverrides>>;
}

/**
 * Loads every stored exception in one date-bounded collection-group query.
 * Read cost is independent of historical exceptions and avoids an N+1 query per
 * recurring parent. A saturated result fails closed rather than silently showing
 * a cancelled or privately changed session as current.
 */
export async function loadOccurrenceStates(
  parentIds: readonly string[],
  fromDate: string,
  toDate: string,
  maximumDocuments: number,
): Promise<Map<string, OccurrenceState>> {
  const states = new Map<string, OccurrenceState>();
  if (parentIds.length === 0) return states;
  const parentSet = new Set(parentIds);
  const snapshot = await adminDb
    .collectionGroup("occurrences")
    .where("date", ">=", fromDate)
    .where("date", "<=", toDate)
    .orderBy("date", "asc")
    .limit(maximumDocuments + 1)
    .get();
  if (snapshot.docs.length > maximumDocuments) {
    throw new ApiError(
      503,
      "Calendar exceptions exceed the safe public query limit.",
      "CALENDAR_EXCEPTION_LIMIT",
    );
  }

  for (const document of snapshot.docs) {
    const parentId = document.ref.parent.parent?.id;
    const data = document.data() as EventOccurrence;
    const date = readString(data.date) ?? document.id;
    if (!parentId || !parentSet.has(parentId) || !isOccurrenceDate(date)) continue;
    const state = states.get(parentId) ?? {
      cancelledDates: new Set<string>(),
      overrides: new Map<string, ReturnType<typeof readOccurrenceOverrides>>(),
    };
    if (data.isCancelled === 1) state.cancelledDates.add(date);
    const overrides = readOccurrenceOverrides(data.overrides);
    if (Object.keys(overrides).length > 0) state.overrides.set(date, overrides);
    if (state.cancelledDates.size > 0 || state.overrides.size > 0) states.set(parentId, state);
  }
  return states;
}

export function feedLocationIds(
  documents: readonly FirebaseFirestore.QueryDocumentSnapshot[],
  occurrenceStates: ReadonlyMap<string, OccurrenceState>,
): string[] {
  const ids = new Set<string>();
  for (const document of documents) {
    const id = readString((document.data() as EventDocument).locationId);
    if (id && /^[A-Za-z0-9_-]{1,128}$/.test(id)) ids.add(id);
    for (const overrides of occurrenceStates.get(document.id)?.overrides.values() ?? []) {
      const overrideId = readString(overrides.locationId);
      if (overrideId && /^[A-Za-z0-9_-]{1,128}$/.test(overrideId)) ids.add(overrideId);
    }
  }
  return [...ids];
}

export async function loadPublicVenueLabels(ids: readonly string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  for (let index = 0; index < ids.length; index += 100) {
    const page = ids.slice(index, index + 100);
    const refs = page.map((id) => adminDb.collection("locations").doc(id));
    const snapshots = await adminDb.getAll(...refs);
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const venue = publicVenueDto(snapshot.data() as LocationDocument);
      if (venue) labels.set(snapshot.id, `${venue.name}, ${venue.address}`);
    }
  }
  return labels;
}

/**
 * Renders a page of documents as DTOs. Recurring events contribute their
 * upcoming occurrences (skipping cancelled dates) instead of only the first
 * session, so a weekly practice stays visible as it recurs. `windowDays`
 * bounds how far ahead sessions are materialized.
 */
export async function renderEventPage(
  documents: FirebaseFirestore.QueryDocumentSnapshot[],
  includeLifecycle: boolean,
  windowDays: number,
) {
  const dtos = documents.map((document) => eventDto(document.id, document.data() as EventDocument, includeLifecycle));
  const recurringIds = documents
    .filter((document) => readRecurrence((document.data() as EventDocument).recurrence))
    .map((document) => document.id);
  if (recurringIds.length === 0) return { events: dtos };

  const fromDate = todayYmd();
  const toDate = futureYmd(windowDays);
  const occurrenceStates = await loadOccurrenceStates(
    recurringIds,
    fromDate,
    toDate,
    OCCURRENCE_EXCEPTION_QUERY_MAX,
  );
  const cap = perEventCap(windowDays);
  const expanded: ReturnType<typeof eventDto>[] = [];
  for (const [index, dto] of dtos.entries()) {
    const data = documents[index].data() as EventDocument;
    if (!readRecurrence(data.recurrence)) {
      expanded.push(dto);
      continue;
    }
    if (expanded.length >= OCCURRENCE_PAGE_MAX) break;
    const occurrences = expandEventOccurrences(dto, data, {
      fromDate,
      toDate,
      cancelledDates: occurrenceStates.get(dto.id)?.cancelledDates,
      occurrenceOverrides: occurrenceStates.get(dto.id)?.overrides,
      maxPerEvent: Math.min(cap, OCCURRENCE_PAGE_MAX - expanded.length),
    });
    expanded.push(...(occurrences.length > 0 ? occurrences : []));
  }
  return { events: expanded };
}

export function ensureCalendarPublisher(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new ApiError(401, "Unauthorized: User not authenticated"));
    return;
  }
  if (!canPublish(req.authorizationRole)) {
    next(new ApiError(403, "Forbidden: Calendar publishing requires admin, coach, or mentor access"));
    return;
  }
  next();
}

export async function applyCursor(
  query: FirebaseFirestore.Query,
  cursorValue: unknown,
  collectionName: "events",
): Promise<FirebaseFirestore.Query> {
  if (cursorValue === undefined) return query;
  const cursor = parseId(String(cursorValue), "cursor");
  const cursorSnapshot = await adminDb.collection(collectionName).doc(cursor).get();
  if (!cursorSnapshot.exists) {
    throw new ApiError(400, "The calendar cursor is no longer valid.", "INVALID_CURSOR");
  }
  return query.startAfter(cursorSnapshot);
}

export async function getEvent(idValue: string | string[], includeArchived: boolean) {
  const rawId = parseId(idValue, "event");
  const compoundMatch = rawId.match(/^([A-Za-z0-9_-]+)_(\d{4}-\d{2}-\d{2})$/);

  if (compoundMatch) {
    const parentRef = adminDb.collection("events").doc(compoundMatch[1]);
    const parentSnap = await parentRef.get();
    const parentData = parentSnap.data() as EventDocument | undefined;
    if (parentSnap.exists && readRecurrence(parentData?.recurrence)) {
      if (!includeArchived && (parentData?.status !== "published" || parentData?.isDeleted === 1)) {
        throw new ApiError(404, "Event not found.", "EVENT_NOT_FOUND");
      }
      return {
        id: compoundMatch[1],
        ref: parentRef,
        snapshot: parentSnap,
        data: parentData ?? {},
        derivedOccurrence: compoundMatch[2],
      };
    }
  }

  const ref = adminDb.collection("events").doc(rawId);
  const snapshot = await ref.get();
  const data = snapshot.data() as EventDocument | undefined;
  if (!snapshot.exists || (!includeArchived && (data?.status !== "published" || data?.isDeleted === 1))) {
    throw new ApiError(404, "Event not found.", "EVENT_NOT_FOUND");
  }
  return { id: rawId, ref, snapshot, data: data ?? {}, derivedOccurrence: undefined };
}

