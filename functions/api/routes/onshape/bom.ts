/**
 * Phase 78-04: Onshape Bill of Materials (BOM) Endpoints
 *
 * Provides BOM retrieval and synchronization for assemblies.
 * Per ONSHAPE-10: View Bill of Materials for assemblies
 * Per ONSHAPE-11: BOM includes part names, quantities, and materials
 * Per ONSHAPE-12: BOM sync history tracked in database
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getDb, type AppEnv } from "../../middleware/utils";
import { requireAuth } from "../../middleware/auth";
import { getOnshapeToken, getOnshapeConfig } from "../../../utils/onshapeAuth";
import { onshapeBomHistory } from "../../../../src/db/schema";
import { ApiError } from "../../middleware/errorHandler";
import { eq } from "drizzle-orm";

// Create the router
const bomApp = new OpenAPIHono<AppEnv>();

// ============================================================================
// Types
// ============================================================================

/**
 * BOM Part from Onshape API
 */
interface BOMPart {
	partId: string;
	partName: string;
	partNumber: string;
	quantity: number;
	material: string;
	mass: number; // in grams
	configuration: string;
}

/**
 * BOM Response from Onshape API
 */
interface _BOMData {
	parts: BOMPart[];
	totalParts: number;
	totalMass: number;
}

/**
 * BOM API Response
 */
interface BOMResponse {
	documentId: string;
	elementId: string;
	elementName: string;
	parts: BOMPart[];
	totalParts: number;
	totalMass: number;
	lastSyncedAt: string;
}

/**
 * BOM History Entry
 */
interface BOMHistoryEntry {
	id: number;
	documentId: string;
	elementId: string;
	partCount: number;
	syncedBy: string;
	syncedAt: string;
}

// ============================================================================
// BOM Retrieval Endpoint
// ============================================================================

const bomRoute = createRoute({
	method: "get",
	path: "/{documentId}/{elementId}",
	summary: "Get Bill of Materials",
	description: "Retrieves the BOM for an assembly from Onshape.",
	tags: ["onshape", "bom"],
	security: [{ CfAccess: [] }],
	request: {
		params: z.object({
			documentId: z.string().length(24).describe("Onshape document ID"),
			elementId: z.string().length(24).describe("Assembly element ID"),
		}),
	},
	responses: {
		200: {
			description: "BOM data",
			content: {
				"application/json": {
					schema: z.object({
						documentId: z.string(),
						elementId: z.string(),
						elementName: z.string(),
						parts: z.array(z.object({
							partId: z.string(),
							partName: z.string(),
							partNumber: z.string(),
							quantity: z.number(),
							material: z.string(),
							mass: z.number(),
							configuration: z.string(),
						})),
						totalParts: z.number(),
						totalMass: z.number(),
						lastSyncedAt: z.string(),
					}),
				},
			},
		},
		401: {
			description: "Not authenticated",
		},
		404: {
			description: "Assembly not found",
		},
		500: {
			description: "Failed to fetch BOM",
		},
	},
});

/**
 * GET /api/onshape/bom/:documentId/:elementId
 *
 * Fetches BOM from Onshape and records sync history.
 */
const app1 = bomApp.openapi(bomRoute, async (c) => {
	const { id: userId } = await requireAuth(c);
	const { documentId, elementId } = c.req.valid("param");
	const config = getOnshapeConfig(c.env as unknown as Record<string, string | undefined>);
	const db = getDb(c);
	const token = await getOnshapeToken(userId, db, c.env as unknown as Record<string, string | undefined>);

	// Onshape BOM endpoint
	const url = `${config.baseUrl}/api/assemblies/d/${documentId}/e/${elementId}/bom`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
		},
		signal: AbortSignal.timeout(30000),
	});

	if (!response.ok) {
		if (response.status === 404) {
			throw new ApiError("Assembly not found", 404, "NOT_FOUND");
		}
		const text = await response.text();
		throw new ApiError(
			`Onshape BOM fetch failed: ${response.status} ${text}`,
			response.status,
			"ONSHAPE_BOM_FAILED"
		);
	}

	const data = await response.json() as { bom: unknown[] };

	// Parse Onshape BOM response (structure varies by Onshape version)
	// The response is typically an array of BOM items
	const parts: BOMPart[] = (data.bom || []).map((item: unknown) => {
		const part = item as Record<string, unknown>;
		return {
			partId: (part.id as string) || "",
			partName: (part.name as string) || "Unnamed Part",
			partNumber: (part.partNumber as string) || "",
			quantity: Number(part.quantity) || 1,
			material: (part.material as string) || "Unknown",
			mass: Number(part.mass) || 0, // in grams
			configuration: (part.configuration as string) || "Default",
		};
	});

	const totalParts = parts.reduce((sum, part) => sum + part.quantity, 0);
	const totalMass = parts.reduce((sum, part) => sum + (part.mass * part.quantity), 0);

	// Record sync history (fire and forget)
	if (c.executionCtx) {
		c.executionCtx.waitUntil((async () => {
			try {
				await db.insert(onshapeBomHistory).values({
					documentId,
					elementId,
					partCount: parts.length,
					syncedBy: userId,
					syncedAt: new Date().toISOString(),
				});
			} catch (err) {
				console.error("[BOM] Failed to record sync history:", err);
			}
		})());
	}

	const bomResponse: BOMResponse = {
		documentId,
		elementId,
		elementName: `Assembly ${elementId.slice(0, 8)}`,
		parts,
		totalParts,
		totalMass,
		lastSyncedAt: new Date().toISOString(),
	};

	return c.json(bomResponse);
});

// ============================================================================
// BOM History Endpoint
// ============================================================================

const bomHistoryRoute = createRoute({
	method: "get",
	path: "/history/{documentId}",
	summary: "Get BOM sync history",
	description: "Retrieves sync history for a document's BOM.",
	tags: ["onshape", "bom"],
	security: [{ CfAccess: [] }],
	request: {
		params: z.object({
			documentId: z.string().length(24).describe("Onshape document ID"),
		}),
		query: z.object({
			limit: z.string().optional().describe("Max results (default: 50)"),
		}),
	},
	responses: {
		200: {
			description: "Sync history",
			content: {
				"application/json": {
					schema: z.object({
						history: z.array(z.object({
							id: z.number(),
							documentId: z.string(),
							elementId: z.string(),
							partCount: z.number(),
							syncedBy: z.string(),
							syncedAt: z.string(),
						})),
					}),
				},
			},
		},
	},
});

/**
 * GET /api/onshape/bom/history/:documentId
 *
 * Retrieves BOM sync history from D1.
 */
const app2 = app1.openapi(bomHistoryRoute, async (c) => {
	const { id: _userId } = await requireAuth(c);
	const { documentId } = c.req.valid("param");
	const limit = parseInt(c.req.query("limit") || "50", 10);
	const db = getDb(c);

	const history = await db
		.select()
		.from(onshapeBomHistory)
		.where(eq(onshapeBomHistory.documentId, documentId))
		.orderBy(onshapeBomHistory.syncedAt)
		.limit(limit)
		.execute();

	const entries: BOMHistoryEntry[] = history.map((row) => ({
		id: row.id,
		documentId: row.documentId,
		elementId: row.elementId,
		partCount: row.partCount,
		syncedBy: row.syncedBy,
		syncedAt: row.syncedAt || "",
	}));

	return c.json({ history: entries.reverse() }); // Most recent first
});

// ============================================================================
// All BOM History Endpoint
// ============================================================================

const bomAllHistoryRoute = createRoute({
	method: "get",
	path: "/history/all",
	summary: "Get all BOM sync history",
	description: "Retrieves all BOM sync history across documents.",
	tags: ["onshape", "bom"],
	security: [{ CfAccess: [] }],
	request: {
		query: z.object({
			limit: z.string().optional().describe("Max results (default: 100)"),
		}),
	},
	responses: {
		200: {
			description: "All sync history",
			content: {
				"application/json": {
					schema: z.object({
						history: z.array(z.object({
							id: z.number(),
							documentId: z.string(),
							elementId: z.string(),
							partCount: z.number(),
							syncedBy: z.string(),
							syncedAt: z.string(),
						})),
					}),
				},
			},
		},
	},
});

/**
 * GET /api/onshape/bom/history/all
 *
 * Retrieves all BOM sync history from D1.
 */
const app3 = app2.openapi(bomAllHistoryRoute, async (c) => {
	await requireAuth(c);
	const limit = parseInt(c.req.query("limit") || "100", 10);
	const db = getDb(c);

	const history = await db
		.select()
		.from(onshapeBomHistory)
		.orderBy(onshapeBomHistory.syncedAt)
		.limit(limit)
		.execute();

	const entries: BOMHistoryEntry[] = history.map((row) => ({
		id: row.id,
		documentId: row.documentId,
		elementId: row.elementId,
		partCount: row.partCount,
		syncedBy: row.syncedBy,
		syncedAt: row.syncedAt || "",
	}));

	return c.json({ history: entries.reverse() }); // Most recent first
});

// ============================================================================
// BOM CSV Export Endpoint
// ============================================================================

const bomExportRoute = createRoute({
	method: "get",
	path: "/export/{documentId}/{elementId}",
	summary: "Export BOM as CSV",
	description: "Exports the BOM as a CSV file for download.",
	tags: ["onshape", "bom"],
	security: [{ CfAccess: [] }],
	request: {
		params: z.object({
			documentId: z.string().length(24).describe("Onshape document ID"),
			elementId: z.string().length(24).describe("Assembly element ID"),
		}),
	},
	responses: {
		200: {
			description: "CSV file",
			content: {
				"text/csv": {
					schema: z.string(),
				},
			},
		},
	},
});

/**
 * GET /api/onshape/bom/export/:documentId/:elementId
 *
 * Exports BOM as CSV file.
 */
const app4 = app3.openapi(bomExportRoute, async (c) => {
	const { id: userId } = await requireAuth(c);
	const { documentId, elementId } = c.req.valid("param");
	const config = getOnshapeConfig(c.env as unknown as Record<string, string | undefined>);
	const db = getDb(c);
	const token = await getOnshapeToken(userId, db, c.env as unknown as Record<string, string | undefined>);

	// Fetch BOM from Onshape
	const url = `${config.baseUrl}/api/assemblies/d/${documentId}/e/${elementId}/bom`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
		},
		signal: AbortSignal.timeout(30000),
	});

	if (!response.ok) {
		throw new ApiError(
			`Failed to fetch BOM for export: ${response.status}`,
			response.status,
			"BOM_EXPORT_FAILED"
		);
	}

	const data = await response.json() as { bom: unknown[] };

	// Parse and sanitize for CSV (prevent injection)
	const parts: BOMPart[] = (data.bom || []).map((item: unknown) => {
		const part = item as Record<string, unknown>;
		return {
			partId: (part.id as string) || "",
			partName: String(part.name || "Unnamed Part").replace(/[",\n\r]/g, ""),
			partNumber: String(part.partNumber || "").replace(/[",\n\r]/g, ""),
			quantity: Number(part.quantity) || 1,
			material: String(part.material || "Unknown").replace(/[",\n\r]/g, ""),
			mass: Number(part.mass) || 0,
			configuration: String(part.configuration || "Default").replace(/[",\n\r]/g, ""),
		};
	});

	// Generate CSV
	const headers = ["Part Name", "Part Number", "Quantity", "Material", "Mass (g)", "Configuration"];
	const rows = parts.map((part) => [
		part.partName,
		part.partNumber,
		String(part.quantity),
		part.material,
		String(part.mass),
		part.configuration,
	]);

	const csv = [
		headers.join(","),
		...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
	].join("\n");

	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
	const filename = `BOM_${documentId.slice(0, 8)}_${timestamp}.csv`;

	return c.text(csv, 200, {
		"Content-Type": "text/csv",
		"Content-Disposition": `attachment; filename="${filename}"`,
	});
});

export default app4;
