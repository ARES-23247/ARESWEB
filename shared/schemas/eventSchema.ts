import { extendSchema } from "@shared/db/schema-extensions";
import { insertEventSchema } from "@shared/db/schema-zod";
import { fieldPresets } from "@shared/db/schema-presets";
import { z } from "zod";
import { sanitizeHtml } from "../utils/sanitize";

// Event category enum for consistency
export const EventCategoryEnum = z.enum(["internal", "outreach", "external"]);

// Sanitized text field for rich content that may contain HTML
const sanitizedTextSchema = fieldPresets.sanitizedHtml(200000, sanitizeHtml);

export const eventSchema = extendSchema(insertEventSchema)
  .applyPresets({
    // Core event fields
    title: fieldPresets.requiredString(255, "Event title is required"),
    dateStart: fieldPresets.requiredDate("Start date is required"),
    dateEnd: fieldPresets.optionalDate(),
    location: fieldPresets.optionalString(255),
    description: fieldPresets.longText(5000),
    coverImage: fieldPresets.emptyStringOrOptional(255),
    category: fieldPresets.category(["internal", "outreach", "external"] as const, "internal"),
    tbaEventKey: fieldPresets.emptyStringOrOptional(255),

    // Event type flags
    isPotluck: fieldPresets.booleanDefault(false),
    isVolunteer: fieldPresets.booleanDefault(false),

    // Publishing fields
    publishedAt: fieldPresets.optionalString(255),
    isDraft: fieldPresets.optionalBoolean(),

    // Relations
    seasonId: fieldPresets.seasonId(),

    // Content fields
    meetingNotes: sanitizedTextSchema,

    // Social media
    socials: fieldPresets.socialsRecord(),

    // Recurrence fields
    rrule: fieldPresets.recurrenceRule(),
    recurrenceRule: fieldPresets.recurrenceRule(),
    parentEventId: fieldPresets.optionalId(),
    originalStartTime: fieldPresets.optionalString(),
    recurringGroupId: fieldPresets.optionalId(),
    recurringException: fieldPresets.optionalBoolean(),

    // Update/delete mode for recurring events
    updateMode: fieldPresets.optionalCategory(["single", "following"] as const),
    deleteMode: fieldPresets.optionalCategory(["single", "following"] as const),
  })
  .omitField("id")
  .omitField("gcalEventId")
  .omitField("isDeleted")
  .omitField("status")
  .omitField("revisionOf")
  .omitField("contentDraft")
  .omitField("updatedAt")
  .build();

export type EventPayload = z.infer<typeof eventSchema>;
