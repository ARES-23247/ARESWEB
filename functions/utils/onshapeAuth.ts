import type { DrizzleDB } from "../../src/db/types";
import { onshapeCredentials } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { ApiError } from "../api/middleware/errorHandler";

/**
 * Onshape OAuth configuration from environment
 */
export interface OnshapeConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	baseUrl: string;
}

/**
 * Token response from Onshape OAuth endpoints
 */
export interface OnshapeTokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number; // Seconds until expiration
	token_type: string;
}

/**
 * Stored credential record from D1
 */
interface StoredCredential {
	userId: string;
	accessToken: string;
	refreshToken: string;
	expiresAt: number; // Unix timestamp in seconds
	createdAt: string;
	lastUsedAt: string | null;
}

/**
 * Expiry buffer in seconds (5 minutes)
 * Tokens are refreshed if they expire within this window
 */
const EXPIRY_BUFFER_SEC = 5 * 60;

/**
 * Retry configuration per D-07
 */
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 100;

/**
 * Helper function to sleep with exponential backoff
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get Onshape configuration from environment bindings
 *
 * Throws ApiError if required environment variables are missing
 */
export function getOnshapeConfig(env: Record<string, string | undefined>): OnshapeConfig {
	const clientId = env.ONSHAPE_CLIENT_ID;
	const clientSecret = env.ONSHAPE_CLIENT_SECRET;
	const redirectUri = env.ONSHAPE_REDIRECT_URI || "https://aresweb.pages.dev/api/onshape/callback";
	const baseUrl = env.ONSHAPE_BASE_URL || "https://cad.onshape.com/api";

	if (!clientId || !clientSecret) {
		throw new ApiError(
			"Missing Onshape OAuth credentials. Please configure ONSHAPE_CLIENT_ID and ONSHAPE_CLIENT_SECRET.",
			500,
			"MISSING_ONSHAPE_CREDENTIALS"
		);
	}

	return { clientId, clientSecret, redirectUri, baseUrl };
}

/**
 * Generate Onshape OAuth authorization URL
 *
 * @param state - CSRF protection token (use crypto.randomUUID())
 * @param config - Onshape OAuth configuration
 * @returns The full authorization URL
 */
export function generateAuthUrl(state: string, config: OnshapeConfig): string {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		scope: "https://cad.onshape.com/api/documents/read https://cad.onshape.com/api/assemblies/read",
		state,
	});

	return `https://cad.onshape.com/oauth/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 *
 * @param code - Authorization code from callback
 * @param config - Onshape OAuth configuration
 * @returns Token response with access_token, refresh_token, expires_in
 * @throws ApiError if token exchange fails
 */
export async function exchangeCodeForTokens(
	code: string,
	config: OnshapeConfig
): Promise<OnshapeTokenResponse> {
	const params = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: config.redirectUri,
		client_id: config.clientId,
		client_secret: config.clientSecret,
	});

	const response = await fetch("https://cad.onshape.com/oauth/oauth/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: params.toString(),
		signal: AbortSignal.timeout(10000),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new ApiError(
			`Onshape token exchange failed: ${response.status} ${text}`,
			502,
			"ONSHAPE_TOKEN_EXCHANGE_FAILED"
		);
	}

	const data = (await response.json()) as OnshapeTokenResponse;
	if (!data.access_token || !data.refresh_token) {
		throw new ApiError(
			"Invalid token response from Onshape",
			502,
			"ONSHAPE_INVALID_TOKEN_RESPONSE"
		);
	}

	return data;
}

/**
 * Refresh an expired access token using refresh token
 *
 * @param refreshToken - The refresh token from previous token response
 * @param config - Onshape OAuth configuration
 * @returns New token response
 * @throws ApiError if refresh fails after retries
 */
export async function refreshOnshapeToken(
	refreshToken: string,
	config: OnshapeConfig
): Promise<OnshapeTokenResponse> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const params = new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: refreshToken,
				client_id: config.clientId,
				client_secret: config.clientSecret,
			});

			const response = await fetch("https://cad.onshape.com/oauth/oauth/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: params.toString(),
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Onshape token refresh failed: ${response.status} ${text}`);
			}

			const data = (await response.json()) as OnshapeTokenResponse;
			if (!data.access_token || !data.refresh_token) {
				throw new Error("Invalid token response from Onshape");
			}

			return data;
		} catch (error) {
			lastError = error as Error;
			console.error(`[onshapeAuth] Token refresh attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error);

			if (attempt < MAX_RETRIES - 1) {
				const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
				await sleep(delayMs);
			}
		}
	}

	throw new ApiError(
		`Failed to refresh Onshape token after ${MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
		503,
		"ONSHAPE_TOKEN_REFRESH_FAILED"
	);
}

/**
 * Store OAuth tokens in D1 database
 *
 * Upserts the credentials record for the user, replacing any existing tokens.
 *
 * @param userId - User ID (email from cf-access-authenticated-user-email)
 * @param tokens - Token response from Onshape
 * @param db - Drizzle database instance
 */
export async function storeOnshapeTokens(
	userId: string,
	tokens: OnshapeTokenResponse,
	db: DrizzleDB
): Promise<void> {
	const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
	const expiresAt = now + tokens.expires_in;

	await db
		.insert(onshapeCredentials)
		.values({
			userId,
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			expiresAt,
			createdAt: new Date().toISOString(),
			lastUsedAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: onshapeCredentials.userId,
			set: {
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token,
				expiresAt,
				lastUsedAt: new Date().toISOString(),
			},
		})
		.run();

	console.debug(`[onshapeAuth] Stored tokens for user ${userId}, expires at ${new Date(expiresAt * 1000).toISOString()}`);
}

/**
 * Get a valid access token for Onshape API
 *
 * Implements lazy refresh per D-05:
 * - Fetches stored credentials from D1
 * - Checks if token expires within 5-minute buffer
 * - Refreshes token if needed
 * - Updates lastUsedAt timestamp
 *
 * @param userId - User ID (email from cf-access-authenticated-user-email)
 * @param db - Drizzle database instance
 * @param env - Cloudflare environment bindings
 * @returns Valid access token
 * @throws ApiError if user has no credentials or refresh fails
 */
export async function getOnshapeToken(
	userId: string,
	db: DrizzleDB,
	env: Record<string, string | undefined>
): Promise<string> {
	const config = getOnshapeConfig(env);

	// Fetch stored credentials
	const credentials = await db
		.select()
		.from(onshapeCredentials)
		.where(eq(onshapeCredentials.userId, userId))
		.limit(1)
		.execute();

	if (credentials.length === 0) {
		throw new ApiError(
			"No Onshape credentials found. Please connect your Onshape account.",
			401,
			"ONSHAPE_NOT_CONNECTED"
		);
	}

	const cred = credentials[0];
	const now = Math.floor(Date.now() / 1000);

	// Check if token needs refresh (expires within buffer or already expired)
	if (cred.expiresAt < now + EXPIRY_BUFFER_SEC) {
		console.debug(`[onshapeAuth] Token expired for user ${userId}, refreshing...`);

		// Refresh token
		const newTokens = await refreshOnshapeToken(cred.refreshToken, config);

		// Store new tokens
		await storeOnshapeTokens(userId, newTokens, db);

		// Update lastUsedAt
		await db
			.update(onshapeCredentials)
			.set({ lastUsedAt: new Date().toISOString() })
			.where(eq(onshapeCredentials.userId, userId))
			.run();

		return newTokens.access_token;
	}

	// Token is valid, update lastUsedAt and return
	await db
		.update(onshapeCredentials)
		.set({ lastUsedAt: new Date().toISOString() })
		.where(eq(onshapeCredentials.userId, userId))
		.run();

	return cred.accessToken;
}

/**
 * Check if user has connected their Onshape account
 *
 * @param userId - User ID (email from cf-access-authenticated-user-email)
 * @param db - Drizzle database instance
 * @returns true if user has valid credentials
 */
export async function hasOnshapeCredentials(
	userId: string,
	db: DrizzleDB
): Promise<boolean> {
	const credentials = await db
		.select({ userId: onshapeCredentials.userId })
		.from(onshapeCredentials)
		.where(eq(onshapeCredentials.userId, userId))
		.limit(1)
		.execute();

	return credentials.length > 0;
}

/**
 * Clear (disconnect) Onshape credentials for a user
 *
 * @param userId - User ID (email from cf-access-authenticated-user-email)
 * @param db - Drizzle database instance
 */
export async function clearOnshapeCredentials(userId: string, db: DrizzleDB): Promise<void> {
	await db
		.delete(onshapeCredentials)
		.where(eq(onshapeCredentials.userId, userId))
		.run();

	console.debug(`[onshapeAuth] Cleared credentials for user ${userId}`);
}
