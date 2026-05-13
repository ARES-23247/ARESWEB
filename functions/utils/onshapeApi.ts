/**
 * Phase 78-02: Onshape API Client Utilities
 *
 * Provides type-safe functions for interacting with the Onshape REST API.
 * Per ONSHAPE-04: Browse documents through web portal
 * Per ONSHAPE-05: Public documents cached, private require auth
 * Per ONSHAPE-06: Search and filter functionality
 */

import type { DrizzleDB } from "../../src/db/types";
import { onshapeDocuments } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { getOnshapeToken, getOnshapeConfig } from "./onshapeAuth";
import { ApiError } from "../api/middleware/errorHandler";

/**
 * Onshape API response wrapper with rate limit info
 */
export interface OnshapeApiResponse<T = unknown> {
	data: T;
	rateLimitRemaining?: number;
}

/**
 * Onshape Document from API
 */
export interface OnshapeDocument {
	id: string;
	name: string;
	description: string | null;
	owner: string;
	createdAt: string;
	modifiedAt: string;
	thumbnailUrl?: string;
	isPublic?: boolean;
}

/**
 * Onshape Element (Part Studio, Assembly, etc.)
 */
export interface OnshapeElement {
	id: string;
	documentId: string;
	name: string;
	type: "PartStudio" | "Assembly" | "Drawing" | "FeatureList";
}

/**
 * Retry configuration per 78-02 D-11
 */
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

/**
 * Helper function to sleep with exponential backoff
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core fetch function for Onshape API
 *
 * Handles:
 * - OAuth token management via getOnshapeToken
 * - Rate limit header extraction
 * - Retry logic for 5xx errors
 * - Type-safe response parsing
 *
 * @param userId - User ID for OAuth token lookup
 * @param endpoint - API endpoint path (e.g., /documents)
 * @param options - Fetch options
 * @returns Response data with optional rate limit info
 */
export async function fetchOnshape<T>(
	userId: string,
	db: DrizzleDB,
	env: Record<string, string | undefined>,
	endpoint: string,
	options?: RequestInit
): Promise<OnshapeApiResponse<T>> {
	const config = getOnshapeConfig(env);
	const token = await getOnshapeToken(userId, db, env);

	const url = `${config.baseUrl}/v10${endpoint}`;

	let lastError: Error | null = null;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const response = await fetch(url, {
				...options,
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					...options?.headers,
				},
				signal: AbortSignal.timeout(30000),
			});

			// Extract rate limit info
			const rateLimitRemaining = response.headers.get("X-Rate-Limit-Remaining");
			const rateLimitRemainingNum = rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined;

			// Handle rate limiting (429)
			if (response.status === 429) {
				const retryAfter = response.headers.get("Retry-After");
				const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : 60;

				throw new ApiError(
					`Onshape API rate limit exceeded. Retry after ${retryAfterSec} seconds.`,
					429,
					"ONSHAPE_RATE_LIMIT",
					{ retryAfter: retryAfterSec }
				);
			}

			// Handle auth errors
			if (response.status === 401) {
				throw new ApiError(
					"Onshape authentication failed. Please reconnect your account.",
					401,
					"ONSHAPE_AUTH_FAILED"
				);
			}

			// Handle other errors
			if (!response.ok) {
				const text = await response.text();
				throw new ApiError(
					`Onshape API error: ${response.status} ${response.statusText} - ${text}`,
					response.status,
					"ONSHAPE_API_ERROR"
				);
			}

			// Parse response
			const data = (await response.json()) as T;

			return {
				data,
				rateLimitRemaining: rateLimitRemainingNum,
			};
		} catch (error) {
			lastError = error as Error;

			// Don't retry on auth errors or rate limits
			if (error instanceof ApiError) {
				if (error.code === "ONSHAPE_AUTH_FAILED" || error.code === "ONSHAPE_RATE_LIMIT") {
					throw error;
				}
			}

			// Retry on 5xx or network errors
			if (attempt < MAX_RETRIES - 1) {
				const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
				console.warn(`[onshapeApi] Fetch attempt ${attempt + 1}/${MAX_RETRIES} failed, retrying in ${delayMs}ms...`);
				await sleep(delayMs);
			}
		}
	}

	throw lastError || new Error("Failed to fetch from Onshape API");
}

/**
 * Fetch documents for a user
 *
 * Per ONSHAPE-04: Browse documents
 * Per ONSHAPE-05: Cache public documents in D1
 *
 * @param userId - User ID for OAuth
 * @param db - Database instance
 * @param env - Environment bindings
 * @param search - Optional search query
 * @returns Array of documents
 */
export async function getDocuments(
	userId: string,
	db: DrizzleDB,
	env: Record<string, string | undefined>,
	search?: string
): Promise<OnshapeDocument[]> {
	const _config = getOnshapeConfig(env);

	// Build query params for Onshape API
	const params = new URLSearchParams();
	if (search) {
		params.append("query", search);
	}

	const endpoint = `/documents${params.toString() ? `?${params.toString()}` : ""}`;

	try {
		const response = await fetchOnshape<{ items: OnshapeDocument[] }>(
			userId,
			db,
			env,
			endpoint
		);

		const documents = response.data.items || [];

		// Cache public documents in D1 per ONSHAPE-05
		for (const doc of documents) {
			// Check if document is marked as public (would need API call to check sharing)
			// For now, we'll cache all documents and mark isPublic based on user preference
			const existingDoc = await db
				.select()
				.from(onshapeDocuments)
				.where(eq(onshapeDocuments.documentId, doc.id))
				.get();

			if (!existingDoc) {
				await db
					.insert(onshapeDocuments)
					.values({
						documentId: doc.id,
						name: doc.name,
						description: doc.description,
						thumbnailUrl: doc.thumbnailUrl || null,
						ownerName: doc.owner,
						isPublic: 0, // Default to private, user can mark as public
						lastSyncedAt: new Date().toISOString(),
					// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle insert values shape mismatch
					} as any)
					.run();
			}
		}

		return documents;
	} catch (error) {
		console.error("[onshapeApi] Failed to fetch documents:", error);
		throw error;
	}
}

/**
 * Fetch public documents from D1 cache
 *
 * Per ONSHAPE-05: Public documents accessible without authentication
 *
 * @param db - Database instance
 * @returns Array of public documents
 */
export async function getPublicDocuments(
	db: DrizzleDB
): Promise<OnshapeDocument[]> {
	const documents = await db
		.select()
		.from(onshapeDocuments)
		.where(eq(onshapeDocuments.isPublic, 1))
		.orderBy(onshapeDocuments.lastSyncedAt)
		.limit(100)
		.execute();

	return documents.map((doc) => ({
		id: doc.documentId,
		name: doc.name,
		description: doc.description,
		owner: doc.ownerName || "",
		createdAt: "",
		modifiedAt: doc.lastSyncedAt || "",
		thumbnailUrl: doc.thumbnailUrl || undefined,
		isPublic: true,
	}));
}

/**
 * Fetch elements for a document
 *
 * @param userId - User ID for OAuth
 * @param db - Database instance
 * @param env - Environment bindings
 * @param documentId - Document ID
 * @returns Array of elements
 */
export async function getDocumentElements(
	userId: string,
	db: DrizzleDB,
	env: Record<string, string | undefined>,
	documentId: string
): Promise<OnshapeElement[]> {
	const endpoint = `/documents/${documentId}/elements`;

	const response = await fetchOnshape<{ items: OnshapeElement[] }>(
		userId,
		db,
		env,
		endpoint
	);

	// Filter for supported element types (PartStudio, Assembly)
	const supportedTypes = ["PartStudio", "Assembly"];
	const elements = (response.data.items || []).filter((el) =>
		supportedTypes.includes(el.type)
	);

	return elements;
}

/**
 * Get thumbnail URL for a document
 *
 * @param documentId - Document ID
 * @param elementId - Optional element ID for element-specific thumbnail
 * @returns Thumbnail URL
 */
export function getDocumentThumbnailUrl(
	documentId: string,
	elementId?: string
): string {
	const config = getOnshapeConfig({});
	const baseUrl = config.baseUrl.replace("/api", "");

	// Onshape thumbnail endpoint format
	if (elementId) {
		return `${baseUrl}/api/v10/documents/${documentId}/e/${elementId}/thumbnails/l`;
	}
	return `${baseUrl}/api/v10/documents/${documentId}/thumbnails/l`;
}
