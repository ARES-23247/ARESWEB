/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS — Handler Barrel (Re-exports all handler modules)
 * ─────────────────────────────────────────────────────────────────────────────
 * This file composes all handler modules into the unified `eventHandlers`
 * export consumed by index.ts. Each domain is split into its own module:
 *
 *   - eventHelpers.ts   — Shared types, utilities, and constants
 *   - readHandlers.ts   — Public + admin GET routes
 *   - writeHandlers.ts  — Create, update, delete, lifecycle mutations
 *   - signupHandlers.ts — Signup and attendance management
 *   - syncHandlers.ts   — GCal sync and calendar repair
 */

import { readHandlers } from "./readHandlers";
import { writeHandlers } from "./writeHandlers";
import { signupHandlers } from "./signupHandlers";
import { syncHandlers } from "./syncHandlers";

// Re-export the EventSaveBody type for consumers that reference it
export type { EventSaveBody } from "./eventHelpers";

export const eventHandlers = {
    // Read handlers
    getEvents: readHandlers.getEvents,
    getCalendarSettings: readHandlers.getCalendarSettings,
    getEvent: readHandlers.getEvent,
    getAdminEvents: readHandlers.getAdminEvents,
    adminDetail: readHandlers.adminDetail,
    getEventHistory: readHandlers.getEventHistory,
    restoreEventHistory: readHandlers.restoreEventHistory,

    // Write handlers
    saveEvent: writeHandlers.saveEvent,
    updateEvent: writeHandlers.updateEvent,
    deleteEvent: writeHandlers.deleteEvent,
    approveEvent: writeHandlers.approveEvent,
    rejectEvent: writeHandlers.rejectEvent,
    undeleteEvent: writeHandlers.undeleteEvent,
    purgeEvent: writeHandlers.purgeEvent,
    repushEvent: writeHandlers.repushEvent,

    // Signup handlers
    getSignups: signupHandlers.getSignups,
    submitSignup: signupHandlers.submitSignup,
    deleteMySignup: signupHandlers.deleteMySignup,
    updateMyAttendance: signupHandlers.updateMyAttendance,
    updateUserAttendance: signupHandlers.updateUserAttendance,

    // Sync handlers
    syncEvents: syncHandlers.syncEvents,
    repairCalendar: syncHandlers.repairCalendar,
};
