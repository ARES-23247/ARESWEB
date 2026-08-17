export interface EventRecurrence {
  frequency: "weekly";
  /** Every N weeks (1-8), anchored to the first session. */
  interval: number;
  /** Weekday codes that have a session (MO TU WE TH FR SA SU). */
  byDay: string[];
  /** Inclusive last date (YYYY-MM-DD). */
  until?: string;
}

export interface TeamEvent {
  id: string;
  title: string;
  dateStart: string; // ISO datetime
  dateEnd?: string;   // ISO datetime
  /** Present when this event repeats; dateStart/dateEnd describe the first session. */
  recurrence?: EventRecurrence;
  /** Present on expanded occurrences: the parent event id and this session's date. */
  recurrenceOf?: string;
  occurrenceDate?: string;
  locationId?: string;
  location?: string;
  publicVenue?: {
    name: string;
    address: string;
  };
  description?: string;
  category: "internal" | "outreach";
  coverImage?: string;
  isPotluck?: number; // 0 or 1
  isVolunteer?: number; // 0 or 1
  isDeleted?: number; // 0 or 1 for Soft Delete
  status?: "published" | "pending" | "draft";
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
}
