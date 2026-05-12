import { eq, desc, inArray, and, sql, gt } from "drizzle-orm";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";

import { AppEnv, ensureAdmin, turnstileMiddleware, persistentRateLimitMiddleware, getSocialConfig, logAuditAction, getDb, type SocialConfig } from "../../middleware";
import { ApiError } from "../../middleware/errorHandler";
import type { DrizzleDB } from "../../../../src/db/types";
import { QUERY_LIMITS } from "../../utils/queryLimits";
import * as schema from "../../../../src/db/schema";
import {
    listInquiriesRoute,
    submitInquiryRoute,
    updateInquiryStatusRoute,
    updateInquiryNotesRoute,
    deleteInquiryRoute
} from "../../../../shared/routes/inquiries";

import { encrypt, decrypt } from "../../../utils/crypto";
import { safeJSONStringify } from "../../../utils/json";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { notifyByRole, type NotifyAudience } from "../../../utils/notifications";
import { buildGitHubConfig, createProjectItem } from "../../../utils/githubProjects";
import { sendEmail } from "../../../utils/email";
import { InquiryReceipt } from "../../templates/InquiryTemplates";
import { safeWaitUntil } from "../../utils/safeWaitUntil";

// ─────────────────────────────────────────────────────────────────────────────
// INQUIRIES ROUTER
// ─────────────────────────────────────────────────────────────────────────────

const inquiriesRouter = new OpenAPIHono<AppEnv>();

// Apply protections for admin routes
inquiriesRouter.use("/admin", ensureAdmin);
inquiriesRouter.use("/admin/*", ensureAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Submit a new inquiry (Public)
// Apply middlewares using .use() on the specific route path
inquiriesRouter.use(
    "/",
    persistentRateLimitMiddleware(10, 60),
    turnstileMiddleware()
);

export const finalInquiriesRouter = inquiriesRouter.openapi(submitInquiryRoute, async (c) => {
    const { type, name, email, metadata } = c.req.valid("json");
    const db = getDb(c);
    const secret = c.get("env")?.ENCRYPTION_SECRET || c.env.ENCRYPTION_SECRET;

    if (!secret) {
        console.error("[Inquiry:Submit] ENCRYPTION_SECRET is not configured!");
        throw new ApiError("Server configuration error: encryption key missing. Please contact the team.", 500);
    }

    // Prevent double submissions
    const id = await ensureNotDuplicateSubmission(db, type, email, metadata, secret);
    const encryptedName = await encrypt(name, secret);
    const encryptedEmail = await encrypt(email, secret);

    let metadataStr = safeJSONStringify(metadata, undefined);
    if (metadataStr && metadataStr.length > 5000) {
        metadataStr = metadataStr.substring(0, 5000);
    }

    await db.insert(schema.inquiries)
        .values({
            id,
            type,
            name: encryptedName,
            email: encryptedEmail,
            metadata: metadataStr,
        })
        .run();

    // Create sponsor record if this is a sponsorship inquiry
    if (type === "sponsor") {
        await createSponsorRecord(db, name, metadata, secret, id);
    }

    // Background tasks: notifications, webhooks, emails
    await processInquiryInBackground(c, type, name, email, id, metadata);

    return c.json({ success: true, id }, 200);
})

    // ─────────────────────────────────────────────────────────────────────────────
    // ADMIN ROUTES
    // ─────────────────────────────────────────────────────────────────────────────

    // List inquiries (Admin)
    .openapi(listInquiriesRoute, async (c) => {
        const { limit = 50, offset = 0 } = c.req.valid("query");
        const db = getDb(c);
        const user = c.get("sessionUser");

        if (!user) throw new ApiError("Unauthorized", 401);

        const secret = c.get("env")?.ENCRYPTION_SECRET || c.env.ENCRYPTION_SECRET;
        const { maskPII, filterOutreach } = shouldMaskData(user);

        const results = await fetchInquiries(db, limit, offset, filterOutreach);
        const inquiries = await decryptAndMaskInquiries(results, secret, maskPII);
        return c.json({ inquiries }, 200);
    })

    // Update inquiry status (Admin)
    .openapi(updateInquiryStatusRoute, async (c) => {
        const { id } = c.req.valid("param");
        const { status } = c.req.valid("json");
        const db = getDb(c);

        await db.update(schema.inquiries)
            .set({ status })
            .where(eq(schema.inquiries.id, id))
            .run();

        c.executionCtx.waitUntil(logAuditAction(c, "inquiry_status_change", "inquiries", id, `Status changed to ${status}`));
        return c.json({ success: true, status }, 200);
    })

    // Update inquiry notes (Admin)
    .openapi(updateInquiryNotesRoute, async (c) => {
        const { id } = c.req.valid("param");
        const { notes } = c.req.valid("json");
        const db = getDb(c);

        await db.update(schema.inquiries)
            .set({ notes })
            .where(eq(schema.inquiries.id, id))
            .run();

        c.executionCtx.waitUntil(logAuditAction(c, "inquiry_notes_change", "inquiries", id, `Notes updated`));
        return c.json({ success: true }, 200);
    })

    // Delete inquiry (Admin)
    .openapi(deleteInquiryRoute, async (c) => {
        const { id } = c.req.valid("param");
        const db = getDb(c);

        await db.delete(schema.inquiries).where(eq(schema.inquiries.id, id)).run();
        c.executionCtx.waitUntil(logAuditAction(c, "inquiry_deleted", "inquiries", id, "Inquiry deleted"));

        return c.json({ success: true }, 200);
    });

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether to mask PII based on user role.
 */
function shouldMaskData(user: { role: string; memberType?: string | null }) {
    let maskPII = false;
    let filterOutreach = false;

    if (user.role !== "admin") {
        const memberType = user.memberType || "student";
        if (memberType === "student") {
            maskPII = true;
            filterOutreach = true;
        }
    }

    return { maskPII, filterOutreach };
}

/**
 * Fetches inquiries from the database with optional filtering.
 */
async function fetchInquiries(db: DrizzleDB, limit: number, offset: number, filterOutreach: boolean) {
    const dbQuery = db.select({
        id: schema.inquiries.id,
        type: schema.inquiries.type,
        name: schema.inquiries.name,
        email: schema.inquiries.email,
        metadata: schema.inquiries.metadata,
        status: schema.inquiries.status,
        createdAt: schema.inquiries.createdAt,
        zulip_message_id: schema.inquiries.zulipMessageId,
        notes: schema.inquiries.notes
    })
        .from(schema.inquiries)
        .orderBy(desc(schema.inquiries.createdAt))
        .limit(limit)
        .offset(offset);

    if (filterOutreach) {
        dbQuery.where(inArray(schema.inquiries.type, ["outreach", "support"]));
    }

    return dbQuery.all();
}

/**
 * Decrypts and optionally masks PII in inquiry results.
 */
const METADATA_WHITELIST = ['level', 'org', 'message', 'event_type', 'date', 'topic', 'position', 'subteam'];

async function decryptAndMaskInquiries(results: unknown[], secret: string, maskPII: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Promise.all(results.map(async (r: any) => {
        let name = String(r.name);
        let email = String(r.email);

        try {
            if (name.includes(":")) name = await decrypt(name, secret);
        } catch {
            name = "[ENCRYPTED NAME]";
        }

        try {
            if (email.includes(":")) email = await decrypt(email, secret);
        } catch {
            email = "[ENCRYPTED EMAIL]";
        }

        let metadata = r.metadata;

        if (maskPII) {
            name = name.substring(0, 1) + "*".repeat(name.length - 1);
            email = email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => a + "*".repeat(b.length));
            if (metadata) {
                try {
                    const meta = JSON.parse(metadata) as Record<string, unknown>;
                    const clean: Record<string, unknown> = {};
                    for (const key of METADATA_WHITELIST) if (key in meta) clean[key] = meta[key];
                    metadata = JSON.stringify(clean);
                } catch { /* ignore */ }
            }
        }

        return {
            id: String(r.id),
            type: r.type,
            name,
            email,
            metadata: metadata || null,
            status: r.status,
            createdAt: String(r.createdAt),
            zulipMessageId: r.zulip_message_id,
            notes: r.notes
        };
    }));
}

/**
 * Ensures this isn't a duplicate submission within the last 60 seconds.
 * Returns the existing ID if duplicate, or generates a new ID.
 */
async function ensureNotDuplicateSubmission(
    db: DrizzleDB,
    type: string,
    email: string,
    metadata: unknown,
    secret: string
): Promise<string> {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const recent = await db.select({
        id: schema.inquiries.id,
        email: schema.inquiries.email,
        metadata: schema.inquiries.metadata
    })
        .from(schema.inquiries)
        .where(and(
            eq(schema.inquiries.type, type),
            gt(schema.inquiries.createdAt, sixtySecondsAgo)
        ))
        .all();

    for (const r of recent) {
        try {
            const decryptedEmail = await decrypt(r.email, secret);
            if (decryptedEmail === email) {
                const currentMeta = safeJSONStringify(metadata, undefined);
                if (r.metadata === currentMeta) {
                    return r.id; // Duplicate detected, return existing ID
                }
            }
        } catch { /* ignore */ }
    }

    return crypto.randomUUID();
}

/**
 * Creates a sponsor record when a sponsorship inquiry is submitted.
 */
async function createSponsorRecord(db: DrizzleDB, name: string, metadata: unknown, secret: string, id: string) {
    let tierStr = "Pending";
    const meta = metadata as Record<string, unknown> | undefined;

    if (meta && typeof meta.level === "string") {
        tierStr = meta.level;
        tierStr = tierStr.replace(" Tier Sponsor", "");
    }

    const encryptedSponsorName = await encrypt(name, secret);

    await db.insert(schema.sponsors)
        .values({
            id,
            name: encryptedSponsorName,
            tier: tierStr,
            isActive: 0,
        })
        .run();
}

/**
 * Processes background tasks after inquiry submission:
 * - Discord webhook
 * - Zulip notification
 * - In-app notifications
 * - GitHub project item
 * - Email receipt
 */
async function processInquiryInBackground(
    c: Context<AppEnv>,
    type: string,
    name: string,
    email: string,
    id: string,
    _metadata: unknown
) {
    const baseUrl = new URL(c.req.url).origin;

    safeWaitUntil(c.executionCtx, (async () => {
        const social = await getSocialConfig(c);
        const msg = `🔔 *New ${type.toUpperCase()} Inquiry* (ID: ${id.slice(0, 8)})\n*Review:* ${baseUrl}/dashboard/inquiries`;

        // Discord webhook
        if (social.DISCORD_WEBHOOK_URL) {
            await fetch(social.DISCORD_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: msg })
            }).catch((err) => console.error("Failed to send Discord webhook:", err));
        }

        // Zulip message
        const topic = `${type.charAt(0).toUpperCase() + type.slice(1)} Inquiry: ${name}`;
        const zulipContent = `**New ${type} inquiry received**\n\n**Name:** ${name}\n**Email:** ${email}\n**ID:** ${id.slice(0, 8)}\n\n[Review Inquiry](${baseUrl}/dashboard/inquiries)`;
        const messageId = await sendZulipMessage(social, "contacts", topic, zulipContent).catch((err) => {
            console.error("Failed to send Zulip message:", err);
            return null;
        });

        if (messageId) {
            const db = getDb(c);
            await db.update(schema.inquiries).set({ zulipMessageId: messageId }).where(eq(schema.inquiries.id, id)).run();
        }

        // In-app notifications
        const audiences: NotifyAudience[] = (type === "outreach" || type === "support")
            ? ["admin", "coach", "mentor", "student"]
            : ["admin", "coach", "mentor"];

        await notifyByRole(c, audiences, {
            title: `New ${type.toUpperCase()} Inquiry`,
            message: `${name} submitted a new inquiry.`,
            link: "/dashboard/inquiries",
            priority: type === "sponsor" ? "high" : "medium"
        }).catch((err) => console.error("Failed to notify by role:", err));

        // GitHub project item for sponsor/student inquiries
        if (type === "sponsor" || type === "student") {
            const ghConfig = buildGitHubConfig(social as SocialConfig);
            if (ghConfig) {
                await createProjectItem(ghConfig, `[${type.toUpperCase()}] New Inquiry (ID: ${id.slice(0, 8)})`, `Review: ${baseUrl}/dashboard/inquiries`)
                    .catch((err) => console.error("Failed to create GitHub project item:", err));
            }
        }

        // Email receipt for join/support inquiries
        if (type === "student" || type === "mentor" || type === "support") {
            const subject = `Inquiry Received: ${type.charAt(0).toUpperCase() + type.slice(1)} - ARES 23247`;
            const html = (await InquiryReceipt({ name, type, id })).toString();

            await sendEmail(c, {
                to: email,
                subject,
                html,
            }).catch((err) => console.error("[Inquiry:Email] Failed to send receipt:", err));
        }
    })(), "Inquiry submission background tasks failed");
}

/**
 * Deletes old inquiries that have been resolved or rejected.
 * Called by scheduled maintenance job.
 */
export async function purgeOldInquiries(db: DrizzleDB, days: number) {
    if (days <= 0) return { deleted: 0 };

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const subquery = db.select({ id: schema.inquiries.id })
        .from(schema.inquiries)
        .where(and(
            inArray(schema.inquiries.status, ['resolved', 'rejected']),
            lt(schema.inquiries.createdAt, cutoffDate)
        ))
        .limit(QUERY_LIMITS.MAX_PAGE);

    const res = await db.delete(schema.inquiries)
        .where(inArray(schema.inquiries.id, subquery))
        .run();

    return { deleted: res.meta?.changes ?? 0 };
}

export default finalInquiriesRouter;
