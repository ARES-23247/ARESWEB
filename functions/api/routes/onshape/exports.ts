/**
 * Phase 78-03: Onshape Export Endpoints
 *
 * Provides STL (synchronous) and STEP (asynchronous) export functionality.
 * Per ONSHAPE-07: Export parts to STL for 3D printing
 * Per ONSHAPE-08: Export assemblies to STEP for manufacturing
 *
 * STL exports stream directly from Onshape to client.
 * STEP exports require async processing with polling.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getDb, type AppEnv } from "../../middleware/utils";
import { requireAuth } from "../../middleware/auth";
import { getOnshapeToken, getOnshapeConfig } from "../../../utils/onshapeAuth";
import { ApiError } from "../../middleware/errorHandler";

// Create the router
const exportsApp = new OpenAPIHono<AppEnv>();

// ============================================================================
// STL Export (Synchronous)
// ============================================================================

const stlExportRoute = createRoute({
	method: "get",
	path: "/stl/{documentId}/{elementId}",
	summary: "Export PartStudio to STL",
	description: "Synchronously exports a PartStudio to STL format for 3D printing.",
	tags: ["onshape", "export"],
	security: [{ CfAccess: [] }],
	request: {
		params: z.object({
			documentId: z.string().length(24).describe("Onshape document ID"),
			elementId: z.string().length(24).describe("PartStudio element ID"),
		}),
		query: z.object({
			units: z.enum(["millimeter", "meter"]).default("millimeter").describe("Export units"),
			mode: z.enum(["binary", "ascii"]).default("binary").describe("STL format mode"),
		}),
	},
	responses: {
		200: {
			description: "STL file stream",
			content: {
				"application/sla": {
					schema: z.string().openapi({ format: "binary" }),
				},
			},
		},
		401: {
			description: "Not authenticated",
		},
		404: {
			description: "Document or element not found",
		},
		500: {
			description: "Export failed",
		},
	},
});

/**
 * GET /api/onshape/export/stl/:documentId/:elementId
 *
 * Synchronous STL export for 3D printing.
 * Streams response directly from Onshape to client.
 */
const app1 = exportsApp.openapi(stlExportRoute, async (c) => {
	const { id: userId } = await requireAuth(c);
	const { documentId, elementId } = c.req.valid("param");
	const { units, mode } = c.req.valid("query");

	const config = getOnshapeConfig(c.env as unknown as Record<string, string | undefined>);
	const db = getDb(c);
	const token = await getOnshapeToken(userId, db, c.env as unknown as Record<string, string | undefined>);

	// Onshape STL export endpoint
	const url = `${config.baseUrl}/api/partstudios/d/${documentId}/e/${elementId}/stl`;
	const params = new URLSearchParams({
		mode,
		units,
	});

	const response = await fetch(`${url}?${params.toString()}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/sla",
		},
		signal: AbortSignal.timeout(60000), // 60 second timeout for export
	});

	if (!response.ok) {
		if (response.status === 404) {
			throw new ApiError("Document or element not found", 404, "NOT_FOUND");
		}
		const text = await response.text();
		throw new ApiError(
			`Onshape STL export failed: ${response.status} ${text}`,
			response.status,
			"ONSHAPE_EXPORT_FAILED"
		);
	}

	// Stream the STL file directly to the client
	return new Response(response.body, {
		headers: {
			"Content-Type": "application/sla",
			"Content-Disposition": `attachment; filename="${documentId}_${elementId}.stl"`,
			"Cache-Control": "no-cache",
		},
	});
});

// ============================================================================
// STEP Export (Asynchronous)
// ============================================================================

const stepExportInitRoute = createRoute({
	method: "post",
	path: "/step/{documentId}/{elementId}",
	summary: "Initiate STEP export",
	description: "Initiates an asynchronous STEP export for manufacturing.",
	tags: ["onshape", "export"],
	security: [{ CfAccess: [] }],
	request: {
		params: z.object({
			documentId: z.string().length(24).describe("Onshape document ID"),
			elementId: z.string().length(24).describe("Assembly or PartStudio element ID"),
		}),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						format: z.literal("step").describe("Export format"),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Export initiated",
			content: {
				"application/json": {
					schema: z.object({
						exportId: z.string().describe("Export ID for polling"),
						status: z.literal("pending").describe("Export status"),
					}),
				},
			},
		},
		401: {
			description: "Not authenticated",
		},
		500: {
			description: "Export initiation failed",
		},
	},
});

interface ExportState {
	userId: string;
	documentId: string;
	elementId: string;
	status: "pending" | "processing" | "done" | "failed";
	resultUrl?: string;
	failureReason?: string;
	createdAt: number;
}

/**
 * POST /api/onshape/export/step/:documentId/:elementId
 *
 * Initiates an asynchronous STEP export.
 * Stores export state in Workers KV for polling.
 */
const app2 = app1.openapi(stepExportInitRoute, async (c) => {
	const { id: userId } = await requireAuth(c);
	const { documentId, elementId } = c.req.valid("param");
	const config = getOnshapeConfig(c.env as unknown as Record<string, string | undefined>);
	const db = getDb(c);
	const token = await getOnshapeToken(userId, db, c.env as unknown as Record<string, string | undefined>);

	// Onshape export endpoint
	const url = `${config.baseUrl}/api/assemblies/d/${documentId}/e/${elementId}/export`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			formatName: "STEP",
			destinationTypeId: "importers",
		}),
		signal: AbortSignal.timeout(30000),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new ApiError(
			`Onshape STEP export initiation failed: ${response.status} ${text}`,
			response.status,
			"ONSHAPE_EXPORT_INIT_FAILED"
		);
	}

	const data = await response.json() as { id: string };
	const exportId = data.id;

	// Store export state in KV with 1 hour TTL
	const exportState: ExportState = {
		userId,
		documentId,
		elementId,
		status: "pending",
		createdAt: Date.now(),
	};

	await c.env.ONSHAPE_EXPORTS.put(exportId, JSON.stringify(exportState), {
		expirationTtl: 3600,
	});

	return c.json({
		exportId,
		status: "pending" as const,
	});
});

// ============================================================================
// Export Status Check
// ============================================================================

const exportStatusRoute = createRoute({
	method: "get",
	path: "/status/{exportId}",
	summary: "Check export status",
	description: "Polls the status of an asynchronous export.",
	tags: ["onshape", "export"],
	security: [{ CfAccess: [] }],
	request: {
		params: z.object({
			exportId: z.string().describe("Export ID from initiation"),
		}),
	},
	responses: {
		200: {
			description: "Export status",
			content: {
				"application/json": {
					schema: z.object({
						exportId: z.string(),
						status: z.enum(["pending", "processing", "done", "failed"]),
						resultUrl: z.string().optional(),
						failureReason: z.string().optional(),
					}),
				},
			},
		},
		404: {
			description: "Export not found",
		},
	},
});

/**
 * GET /api/onshape/export/status/:exportId
 *
 * Checks the status of an async export from Onshape.
 */
const app3 = app2.openapi(exportStatusRoute, async (c) => {
	const { id: userId } = await requireAuth(c);
	const { exportId } = c.req.valid("param");
	const config = getOnshapeConfig(c.env as unknown as Record<string, string | undefined>);

	// Get export state from KV
	const stateJson = await c.env.ONSHAPE_EXPORTS.get(exportId);
	if (!stateJson) {
		throw new ApiError("Export not found or expired", 404, "EXPORT_NOT_FOUND");
	}

	const state = JSON.parse(stateJson) as ExportState;

	// Verify ownership
	if (state.userId !== userId) {
		throw new ApiError("Access denied", 403, "ACCESS_DENIED");
	}

	// If already done or failed, return cached state
	if (state.status === "done" || state.status === "failed") {
		return c.json({
			exportId,
			status: state.status,
			resultUrl: state.resultUrl,
			failureReason: state.failureReason,
		});
	}

	// Check Onshape API for current status
	const db = getDb(c);
	const token = await getOnshapeToken(userId, db, c.env as unknown as Record<string, string | undefined>);
	const url = `${config.baseUrl}/api/translations/${exportId}`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
		signal: AbortSignal.timeout(10000),
	});

	if (!response.ok) {
		throw new ApiError(
			`Failed to check export status: ${response.status}`,
			response.status,
			"STATUS_CHECK_FAILED"
		);
	}

	const data = await response.json() as {
		requestState: string;
		resultLinkId?: string;
		failureMessage?: string;
	};

	// Map Onshape states to our states
	let newStatus: ExportState["status"] = state.status;
	switch (data.requestState) {
		case "ACTIVE":
		case "NEW":
			newStatus = "processing";
			break;
		case "DONE":
			newStatus = "done";
			break;
		case "FAILED":
		case "CANCELED":
			newStatus = "failed";
			break;
	}

	// Update state
	const updatedState: ExportState = {
		...state,
		status: newStatus,
	};

	if (newStatus === "done" && data.resultLinkId) {
		// Build download URL from resultLinkId
		// Onshape returns a link ID that can be used to download
		updatedState.resultUrl = `${config.baseUrl}/api/translations/${exportId}/link/${data.resultLinkId}`;
	} else if (newStatus === "failed") {
		updatedState.failureReason = data.failureMessage || "Unknown error";
	}

	// Save updated state
	await c.env.ONSHAPE_EXPORTS.put(exportId, JSON.stringify(updatedState), {
		expirationTtl: 3600,
	});

	return c.json({
		exportId,
		status: newStatus,
		resultUrl: updatedState.resultUrl,
		failureReason: updatedState.failureReason,
	});
});

// ============================================================================
// Export Download
// ============================================================================

const exportDownloadRoute = createRoute({
	method: "get",
	path: "/download/{exportId}",
	summary: "Download completed export",
	description: "Downloads a completed export file.",
	tags: ["onshape", "export"],
	security: [{ CfAccess: [] }],
	request: {
		params: z.object({
			exportId: z.string().describe("Export ID"),
		}),
	},
	responses: {
		200: {
			description: "Export file stream",
			content: {
				"application/octet-stream": {
					schema: z.string().openapi({ format: "binary" }),
				},
			},
		},
		404: {
			description: "Export not found or not ready",
		},
	},
});

/**
 * GET /api/onshape/export/download/:exportId
 *
 * Downloads a completed export file from Onshape.
 */
const app4 = app3.openapi(exportDownloadRoute, async (c) => {
	const { id: userId } = await requireAuth(c);
	const { exportId } = c.req.valid("param");

	// Get export state from KV
	const stateJson = await c.env.ONSHAPE_EXPORTS.get(exportId);
	if (!stateJson) {
		throw new ApiError("Export not found or expired", 404, "EXPORT_NOT_FOUND");
	}

	const state = JSON.parse(stateJson) as ExportState;

	// Verify ownership
	if (state.userId !== userId) {
		throw new ApiError("Access denied", 403, "ACCESS_DENIED");
	}

	// Check if export is complete
	if (state.status !== "done" || !state.resultUrl) {
		throw new ApiError("Export not ready for download", 400, "EXPORT_NOT_READY");
	}

	// Stream file from Onshape
	const db = getDb(c);
	const token = await getOnshapeToken(userId, db, c.env as unknown as Record<string, string | undefined>);

	const response = await fetch(state.resultUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
		signal: AbortSignal.timeout(60000),
	});

	if (!response.ok) {
		throw new ApiError(
			`Failed to download export: ${response.status}`,
			response.status,
			"DOWNLOAD_FAILED"
		);
	}

	// Determine filename from Content-Disposition or default
	const contentDisposition = response.headers.get("Content-Disposition") || "";
	let filename = `${state.documentId}_${state.elementId}.step`;
	const match = contentDisposition.match(/filename="?([^"]+)"?/);
	if (match) {
		filename = match[1];
	}

	// Stream to client
	return new Response(response.body, {
		headers: {
			"Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
});

export default app4;
