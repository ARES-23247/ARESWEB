/**
 * Phase 78-02: Onshape Document Browsing Endpoints
 *
 * Per ONSHAPE-04: Browse documents through web portal
 * Per ONSHAPE-05: Public documents cached, private require auth
 * Per Zero Trust: All endpoints verify cf-access-authenticated-user-email
 */

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppEnv } from "../../middleware/utils";
import { getDb } from "../../middleware";
import { z } from "zod";
import {
	getDocuments,
	getPublicDocuments,
	getDocumentElements,
	getDocumentThumbnailUrl,
	type OnshapeDocument,
} from "../../../utils/onshapeApi";
import { ApiError } from "../../middleware/errorHandler";
import { requireAuth } from "../../middleware/auth";

const documentsApp = new OpenAPIHono<AppEnv>();

// Apply requireAuth to all routes for Zero Trust compliance
documentsApp.use("/*", async (c, next) => {
	await requireAuth(c);
	await next();
});

// Public endpoint exception: GET /public does NOT require admin
// But still requires basic auth via requireAuth above

/**
 * GET /documents - List user's documents
 *
 * Requires authentication. Fetches from Onshape API and merges with cached public docs.
 */
const listDocumentsRoute = createRoute({
	method: "get",
	path: "/",
	request: {
		query: z.object({
			search: z.string().optional(),
			limit: z.coerce.number().min(1).max(100).default(20).optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						documents: z.array(
							z.object({
								id: z.string(),
								name: z.string(),
								description: z.string().nullable(),
								owner: z.string(),
								createdAt: z.string(),
								modifiedAt: z.string(),
								thumbnailUrl: z.string().optional(),
								isPublic: z.boolean().optional(),
							})
						),
						total: z.number(),
					}),
				},
			},
			description: "List of user's documents",
		},
		401: {
			description: "Unauthorized - Authentication required",
		},
	},
	tags: ["onshape", "admin"],
});

documentsApp.openapi(listDocumentsRoute, async (c) => {
	const db = getDb(c);
	const env = c.env;
	const user = c.get("user");
	const userId = user?.email || "unknown";

	if (!userId || userId === "unknown") {
		throw new ApiError("Authentication required", 401, "AUTH_REQUIRED");
	}

	const { search, limit = 20 } = c.req.valid("query");

	try {
		// Fetch user's documents from Onshape API
		const userDocuments = await getDocuments(userId, db, env, search);

		// Fetch public documents from cache
		const publicDocs = await getPublicDocuments(db);

		// Merge, prioritizing user docs and deduplicating by ID
		const allDocs = new Map<string, OnshapeDocument>();

		for (const doc of publicDocs) {
			allDocs.set(doc.id, doc);
		}
		for (const doc of userDocuments) {
			allDocs.set(doc.id, doc);
		}

		const documents = Array.from(allDocs.values()).slice(0, limit);

		return c.json({
			documents,
			total: allDocs.size,
		});
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		console.error("[onshape/documents] Failed to list documents:", error);
		throw new ApiError("Failed to fetch documents", 500, "FETCH_FAILED");
	}
});

/**
 * GET /documents/public - List public documents
 *
 * No authentication required (except basic requireAuth).
 * Returns cached public documents from D1.
 */
const listPublicDocumentsRoute = createRoute({
	method: "get",
	path: "/public",
	request: {
		query: z.object({
			limit: z.coerce.number().min(1).max(100).default(50).optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						documents: z.array(
							z.object({
								id: z.string(),
								name: z.string(),
								description: z.string().nullable(),
								owner: z.string(),
								createdAt: z.string(),
								modifiedAt: z.string(),
								thumbnailUrl: z.string().optional(),
								isPublic: z.literal(true),
							})
						),
					}),
				},
			},
			description: "List of public documents",
		},
	},
	tags: ["onshape"],
});

documentsApp.openapi(listPublicDocumentsRoute, async (c) => {
	const db = getDb(c);
	const { limit = 50 } = c.req.valid("query");

	try {
		const documents = await getPublicDocuments(db);

		return c.json({
			documents: documents.slice(0, limit),
		});
	} catch (error) {
		console.error("[onshape/documents/public] Failed to fetch public documents:", error);
		throw new ApiError("Failed to fetch public documents", 500, "FETCH_FAILED");
	}
});

/**
 * GET /documents/:documentId - Get single document
 *
 * Requires authentication. Fetches from Onshape API.
 */
const getDocumentRoute = createRoute({
	method: "get",
	path: "/{documentId}",
	request: {
		params: z.object({
			documentId: z.string(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						id: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						owner: z.string(),
						createdAt: z.string(),
						modifiedAt: z.string(),
						thumbnailUrl: z.string().optional(),
						isPublic: z.boolean().optional(),
						elements: z.array(
							z.object({
								id: z.string(),
								documentId: z.string(),
								name: z.string(),
								type: z.enum(["PartStudio", "Assembly", "Drawing", "FeatureList"]),
							})
						).optional(),
					}),
				},
			},
			description: "Document details",
		},
		401: {
			description: "Unauthorized",
		},
		404: {
			description: "Document not found",
		},
	},
	tags: ["onshape", "admin"],
});

documentsApp.openapi(getDocumentRoute, async (c) => {
	const db = getDb(c);
	const env = c.env;
	const user = c.get("user");
	const userId = user?.email || "unknown";

	if (!userId || userId === "unknown") {
		throw new ApiError("Authentication required", 401, "AUTH_REQUIRED");
	}

	const { documentId } = c.req.valid("params");

	try {
		// Fetch document elements
		const elements = await getDocumentElements(userId, db, env, documentId);

		// For now, return basic document info with elements
		// In a full implementation, we'd fetch full document details from Onshape
		return c.json({
			id: documentId,
			name: "Document", // Would fetch from API
			description: null,
			owner: userId,
			createdAt: new Date().toISOString(),
			modifiedAt: new Date().toISOString(),
			thumbnailUrl: getDocumentThumbnailUrl(documentId),
			elements,
		});
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		console.error("[onshape/documents/:id] Failed to fetch document:", error);
		throw new ApiError("Failed to fetch document", 500, "FETCH_FAILED");
	}
});

/**
 * GET /documents/:documentId/elements - Get document elements
 *
 * Requires authentication.
 */
const getDocumentElementsRoute = createRoute({
	method: "get",
	path: "/{documentId}/elements",
	request: {
		params: z.object({
			documentId: z.string(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						elements: z.array(
							z.object({
								id: z.string(),
								documentId: z.string(),
								name: z.string(),
								type: z.enum(["PartStudio", "Assembly", "Drawing", "FeatureList"]),
							})
						),
					}),
				},
			},
			description: "Document elements",
		},
		401: {
			description: "Unauthorized",
		},
	},
	tags: ["onshape", "admin"],
});

documentsApp.openapi(getDocumentElementsRoute, async (c) => {
	const db = getDb(c);
	const env = c.env;
	const user = c.get("user");
	const userId = user?.email || "unknown";

	if (!userId || userId === "unknown") {
		throw new ApiError("Authentication required", 401, "AUTH_REQUIRED");
	}

	const { documentId } = c.req.valid("params");

	try {
		const elements = await getDocumentElements(userId, db, env, documentId);

		return c.json({ elements });
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		console.error("[onshape/documents/:id/elements] Failed to fetch elements:", error);
		throw new ApiError("Failed to fetch document elements", 500, "FETCH_FAILED");
	}
});

export default documentsApp;
