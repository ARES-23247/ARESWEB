/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS — Shared Helpers & Types
 * ─────────────────────────────────────────────────────────────────────────────
 * Common utilities, types, and constants shared across all event handler modules.
 */

import { getSocialConfig, getDb } from "../../middleware";
import { EventCategoryEnum } from "../../../../shared/schemas/eventSchema";
import { inArray, eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { z } from "zod";
import { eventResponseSchema } from "../../../../shared/routes/events";
import type { HonoContext } from "@shared/types/api";

export type FormattedEvent = z.infer<typeof eventResponseSchema>;

// Cloudflare Cache API type for edge cache invalidation
type CloudflareCachesWithDefault = CacheStorage & {
    default?: Cache;
};

// Type for Hono context with ARES environment
export type AresContext = HonoContext;

// Explicit type for event save/update body — matches the eventSchema from shared/schemas/eventSchema.ts
// Defined explicitly to avoid TypeScript inference issues with the dynamic extendSchema builder pattern
export interface EventSaveBody {
    id?: string;
    title: string;
    category?: string;
    dateStart: string;
    dateEnd?: string | null;
    location?: string | null;
    description?: string | null;
    coverImage?: string | null;
    tbaEventKey?: string | null;
    socials?: Record<string, boolean>;
    isPotluck?: boolean;
    isVolunteer?: boolean;
    isDraft?: boolean;
    publishedAt?: string | null;
    seasonId?: number | null;
    meetingNotes?: string | null;
    rrule?: string | null;
    recurrenceRule?: string | null;
    parentEventId?: string | null;
    originalStartTime?: string | null;
    recurringGroupId?: string | null;
    recurringException?: boolean | null;
    updateMode?: "single" | "following";
    deleteMode?: "single" | "following";
    status?: string;
}

/**
 * Invalidate Cloudflare edge cache for public events endpoints.
 */
export function invalidateEventsCache(c: AresContext): void {
    if (typeof caches === 'undefined' || !c.executionCtx) return;
    const cfCaches = caches as unknown as CloudflareCachesWithDefault;
    const cache = cfCaches.default;
    if (!cache) return;

    const baseUrl = new URL(c.req.url).origin;
    const cacheKeys = [
        new Request(new URL("/api/events", baseUrl).href, { method: "GET" }),
        new Request(new URL("/api/events/calendar-settings", baseUrl).href, { method: "GET" }),
    ];

    c.executionCtx.waitUntil(
        Promise.all(cacheKeys.map(key => cache.delete(key)))
    );
}

/**
 * Normalize category to a valid EventCategoryEnum value.
 */
export function normalizeCategory(category: string | null | undefined): "internal" | "outreach" | "external" | null {
    if (!category) return null;
    const result = EventCategoryEnum.safeParse(category);
    return result.success ? result.data : "internal";
}

/**
 * Normalize a date string from D1 to timezone-naive local time.
 */
export function normalizeDateTime(dt: string | null | undefined): string | null {
    if (!dt) return null;
    let normalized = dt.replace(" ", "T");
    if (normalized.endsWith("Z")) {
        normalized = normalized.slice(0, -1);
    }
    normalized = normalized.replace(/[+-]\d{2}:?\d{2}$/, "");
    return normalized;
}

/**
 * Sanitize FTS query to prevent SQL injection via SQLite FTS syntax.
 */
export const sanitizeFtsQuery = (query: string): string => {
    return query.replace(/["\\^*-:]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
};

/**
 * Maps a database event row to the standard API response format.
 */
export function mapToEventResponse(e: Record<string, unknown>, locationMap: Record<string, string> = {}): FormattedEvent {
    return {
        id: String(e.id),
        title: String(e.title || ""),
        category: normalizeCategory(e.category as string) ?? "internal",
        dateStart: normalizeDateTime(e.dateStart as string) ?? "",
        dateEnd: normalizeDateTime(e.dateEnd as string),
        location: (e.location as string) ?? null,
        locationAddress: e.location ? (locationMap[e.location as string] || null) : null,
        description: (e.description as string) ?? null,
        coverImage: (e.coverImage as string) ?? null,
        status: (e.status ?? "published") as FormattedEvent["status"],
        isDeleted: Number(e.isDeleted || 0),
        seasonId: e.seasonId ? Number(e.seasonId) : null,
        meetingNotes: (e.meetingNotes as string) ?? null,
        tbaEventKey: (e.tbaEventKey as string) ?? null,
        isPotluck: Number(e.isPotluck || 0),
        isVolunteer: Number(e.isVolunteer || 0),
        recurringGroupId: (e.recurringGroupId as string) ?? null,
        rrule: (e.rrule as string) ?? null,
        zulipStream: (e.zulipStream as string) ?? null,
        zulipTopic: (e.zulipTopic as string) ?? null,
        recurringException: e.recurringException ? Number(e.recurringException) : null,
        contentDraft: (e.contentDraft as string) ?? null,
        gcalEventId: (e.gcalEventId as string) ?? null,
        updatedAt: (e.updatedAt as string) ?? null,
        revisionOf: (e.revisionOf as string) ?? null,
        publishedAt: (e.publishedAt as string) ?? null,
    };
}

/**
 * Helper to get the calendar ID for a given event category.
 */
export async function getCalendarId(c: AresContext, category: string): Promise<{ calId: string | undefined; socialConfig: Awaited<ReturnType<typeof getSocialConfig>> }> {
    const socialConfig = await getSocialConfig(c);
    const calKey = `CALENDAR_ID_${category.toUpperCase()}` as keyof typeof socialConfig;
    const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;
    return { calId, socialConfig };
}

/**
 * Helper to get calendar settings from DB.
 */
export async function getCalendarSettingsFromDb(c: AresContext) {
    const db = getDb(c);
    const result = await db.select({
        value: schema.settings.value,
    })
        .from(schema.settings)
        .where(eq(schema.settings.key, "CALENDAR_ID"))
        .get();

    const calendarId = result?.value || "";
    return {
        CALENDAR_ID: calendarId,
        CALENDAR_ID_INTERNAL: calendarId,
        CALENDAR_ID_OUTREACH: calendarId,
        CALENDAR_ID_EXTERNAL: calendarId,
    };
}
