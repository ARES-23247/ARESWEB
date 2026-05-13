/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS — Signup & Attendance Handlers
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../../middleware/errorHandler";
import { getSessionUser, getDb } from "../../middleware";
import { eq, and } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { HandlerInput, ApiResponse } from "@shared/types/api";
import { queryHelpers, transactionHelpers } from "@/db/query-helpers";
import { requireAuth } from "../../middleware/auth";

import {
    getSignupsRoute,
    submitSignupRoute,
    deleteMySignupRoute,
    updateMyAttendanceRoute,
    updateUserAttendanceRoute,
} from "../../../../shared/routes/events";

import type { AresContext } from "./eventHelpers";

export const signupHandlers = {
    getSignups: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof getSignupsRoute>> => {
        const { params } = input;
        const eventId = params.id;
        const user = await getSessionUser(c);
        const db = getDb(c);
        const isVerified = user && user.role !== "unverified";
        const isManagement = user && (user.role === "admin" || ["coach", "mentor"].includes(user.memberType || ""));

        const { eventSignups: results } = await queryHelpers.getEventSignups(db, eventId);

        const signups = isVerified ? results.map((rec: Record<string, unknown>) => ({
            userId: rec.userId,
            nickname: rec.profileNickname || null,
            bringing: rec.bringing || null,
            notes: (isManagement || (user && rec.userId === user.id)) ? rec.notes : null,
            prepHours: Number(rec.prepHours || 0),
            attended: Number(rec.attended || 0),
            isOwn: user ? rec.userId === user.id : false,
        })) : [];

        const dietarySummary: Record<string, number> = {};
        results.forEach((r: Record<string, unknown>) => {
            if (r.dietaryRestrictions) {
                const restrictions = (r.dietaryRestrictions as string).split(',').map((st: string) => st.trim());
                restrictions.forEach((res: string) => {
                    if (res) dietarySummary[res] = (dietarySummary[res] || 0) + 1;
                });
            }
        });

        return {
            status: 200 as const,
            body: {
                signups: signups as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Handler projects subset of signup schema fields
                dietarySummary,
                teamDietarySummary: {},
                authenticated: !!user,
                role: user?.role || null,
                memberType: user?.memberType || null,
                canManage: !!isManagement
            }
        };
    },

    submitSignup: async (input: HandlerInput<{ bringing?: string; notes?: string; prepHours?: number }>, c: AresContext): Promise<ApiResponse<typeof submitSignupRoute>> => {
        const { params, body } = input;
        const user = await getSessionUser(c);
        if (!user || user.role === "unverified") throw new ApiError("Forbidden", 403);
        const db = getDb(c);

        await transactionHelpers.createEventSignup(db, {
            eventId: params.id,
            userId: user.id,
            bringing: body.bringing || "",
            notes: body.notes || "",
            prepHours: body.prepHours || 0,
        });

        return { status: 200 as const, body: { success: true } };
    },

    deleteMySignup: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof deleteMySignupRoute>> => {
        const { params } = input;
        const user = await requireAuth(c);
        const db = getDb(c);
        await db.delete(schema.eventSignups).where(and(eq(schema.eventSignups.eventId, params.id), eq(schema.eventSignups.userId, user.id))).run();
        return { status: 200 as const, body: { success: true } };
    },

    updateMyAttendance: async (input: HandlerInput<{ attended: boolean }>, c: AresContext): Promise<ApiResponse<typeof updateMyAttendanceRoute>> => {
        const { params, body } = input;
        const user = await requireAuth(c);
        const db = getDb(c);

        const existing = await db.select({ id: schema.eventSignups.id })
            .from(schema.eventSignups)
            .where(and(eq(schema.eventSignups.eventId, params.id), eq(schema.eventSignups.userId, user.id)))
            .get();

        if (existing) {
            await db.update(schema.eventSignups)
                .set({ attended: body.attended ? 1 : 0 })
                .where(eq(schema.eventSignups.id, existing.id))
                .run();
        } else {
            await db.insert(schema.eventSignups)
                .values({ eventId: params.id, userId: user.id, attended: body.attended ? 1 : 0 })
                .run();
        }
        return { status: 200 as const, body: { success: true } };
    },

    updateUserAttendance: async (input: HandlerInput<{ attended: boolean }>, c: AresContext): Promise<ApiResponse<typeof updateUserAttendanceRoute>> => {
        const { params, body } = input;
        const user = await getSessionUser(c);
        if (user?.role !== "admin" && !["coach", "mentor"].includes(user?.memberType || "")) throw new ApiError("Unauthorized", 401);
        const db = getDb(c);

        const existing = await db.select({ id: schema.eventSignups.id })
            .from(schema.eventSignups)
            .where(and(eq(schema.eventSignups.eventId, params.id), eq(schema.eventSignups.userId, params.userId)))
            .get();

        if (existing) {
            await db.update(schema.eventSignups)
                .set({ attended: body.attended ? 1 : 0 })
                .where(eq(schema.eventSignups.id, existing.id))
                .run();
        } else {
            await db.insert(schema.eventSignups)
                .values({ eventId: params.id, userId: params.userId, attended: body.attended ? 1 : 0 })
                .run();
        }
        return { status: 200 as const, body: { success: true } };
    },
};
