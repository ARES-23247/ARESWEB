import { Hono } from "hono";
import type { AppEnv } from "../../middleware/utils";
import { getDb } from "../../middleware";
import {
	generateAuthUrl,
	exchangeCodeForTokens,
	storeOnshapeTokens,
	getOnshapeConfig,
	clearOnshapeCredentials,
	hasOnshapeCredentials,
} from "../../../utils/onshapeAuth";
import { ApiError } from "../../middleware/errorHandler";
import { z } from "zod";
import { customAlphabet } from "nanoid";

// Create the router
const authApp = new Hono<AppEnv>();

/**
 * Generate a secure random state token for CSRF protection
 */
const generateState = () => customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 32)();

/**
 * GET /api/onshape/authorize
 *
 * Initiates the Onshape OAuth flow by redirecting the user to Onshape's authorization page.
 * Requires Cloudflare Access authentication (cf-access-authenticated-user-email).
 *
 * Query parameters:
 *   - redirect: Optional path to redirect to after OAuth completes (default: /onshape)
 *
 * Flow:
 *   1. Verify user is authenticated via Cloudflare Access
 *   2. Generate secure random state token
 *   3. Store state+redirect in temporary storage (KV with 5 min TTL)
 *   4. Redirect to Onshape authorization URL
 */
authApp.get("/authorize", async (c) => {
	const db = getDb(c);
	const env = c.env;
	const userId = c.get("cf-access-authenticated-user-email") as string | undefined;

	// Zero Trust: Verify user authentication
	if (!userId) {
		throw new ApiError(
			"Unauthorized. Please log in to connect your Onshape account.",
			401,
			"UNAUTHORIZED"
		);
	}

	const config = getOnshapeConfig(env);
	const state = generateState();
	const redirectPath = c.req.query("redirect") || "/onshape";

	// Store state and redirect path in KV for callback validation
	// Use 5-minute TTL to match OAuth best practices
	const stateKey = `onshape_oauth_state:${state}`;
	await env.ONSHAPE_OAUTH_STATE.put(stateKey, JSON.stringify({ userId, redirectPath }), {
		expirationTtl: 300, // 5 minutes
	});

	// Generate and redirect to Onshape authorization URL
	const authUrl = generateAuthUrl(state, config);
	console.debug(`[onshape:auth] Initiating OAuth for user ${userId}, state=${state}`);

	return c.redirect(authUrl);
});

/**
 * GET /api/onshape/callback
 *
 * Handles the OAuth callback from Onshape.
 * Exchanges authorization code for access/refresh tokens and stores them in D1.
 *
 * Query parameters:
 *   - code: Authorization code from Onshape
 *   - state: State parameter for CSRF validation
 *   - error: Error code if OAuth failed (optional)
 *
 * Flow:
 *   1. Verify state parameter matches stored value
 *   2. Check for OAuth errors
 *   3. Exchange authorization code for tokens
 *   4. Store tokens in D1 database
 *   5. Redirect to frontend with success/error flag
 */
authApp.get("/callback", async (c) => {
	const db = getDb(c);
	const env = c.env;
	const code = c.req.query("code");
	const state = c.req.query("state");
	const error = c.req.query("error");
	const errorDescription = c.req.query("error_description");

	// Check for OAuth errors from Onshape
	if (error) {
		console.error(`[onshape:auth] OAuth error: ${error} - ${errorDescription}`);
		return c.redirect(
			`/onshape?error=${encodeURIComponent(error || "oauth_failed")}&message=${encodeURIComponent(
				errorDescription || "OAuth authorization failed"
			)}`
		);
	}

	// Validate required parameters
	if (!code || !state) {
		throw new ApiError(
			"Invalid OAuth callback. Missing required parameters.",
			400,
			"INVALID_CALLBACK"
		);
	}

	// Retrieve and validate state from KV
	const stateKey = `onshape_oauth_state:${state}`;
	const stateData = await env.ONSHAPE_OAUTH_STATE.get(stateKey);

	if (!stateData) {
		throw new ApiError(
			"Invalid OAuth state. The authorization flow may have expired. Please try again.",
			400,
			"INVALID_STATE"
		);
	}

	const { userId, redirectPath } = JSON.parse(stateData) as { userId: string; redirectPath: string };

	// Clean up state from KV
	await env.ONSHAPE_OAUTH_STATE.delete(stateKey);

	try {
		// Exchange authorization code for tokens
		const config = getOnshapeConfig(env);
		const tokens = await exchangeCodeForTokens(code, config);

		// Store tokens in D1
		await storeOnshapeTokens(userId, tokens, db);

		console.debug(`[onshape:auth] OAuth successful for user ${userId}`);

		// Redirect to frontend with success flag
		return c.redirect(`${redirectPath}?success=true`);
	} catch (err) {
		const error = err as ApiError;
		console.error(`[onshape:auth] Token exchange failed:`, error);

		// Redirect to frontend with error message
		const message = error.message || "Failed to connect Onshape account";
		return c.redirect(
			`${redirectPath}?error=${encodeURIComponent(error.code || "token_exchange_failed")}&message=${encodeURIComponent(
				message
			)}`
		);
	}
});

/**
 * GET /api/onshape/auth/status
 *
 * Check if the current user has connected their Onshape account.
 *
 * Response:
 *   { connected: boolean, email?: string }
 */
authApp.get("/status", async (c) => {
	const db = getDb(c);
	const userId = c.get("cf-access-authenticated-user-email") as string | undefined;

	if (!userId) {
		return c.json({ connected: false });
	}

	const hasCreds = await hasOnshapeCredentials(userId, db);
	return c.json({
		connected: hasCreds,
		email: hasCreds ? userId : undefined,
	});
});

/**
 * Logout schema for validation
 */
const logoutSchema = z.object({
	userId: z.string().email(),
});

/**
 * POST /api/onshape/auth/logout
 *
 * Disconnect (logout) Onshape account by clearing stored credentials.
 * Requires Cloudflare Access authentication.
 *
 * Body:
 *   { userId: string }
 */
authApp.post("/logout", async (c) => {
	const db = getDb(c);
	const userId = c.get("cf-access-authenticated-user-email") as string | undefined;

	// Zero Trust: Verify user authentication
	if (!userId) {
		throw new ApiError("Unauthorized. Please log in.", 401, "UNAUTHORIZED");
	}

	// Clear credentials from D1
	await clearOnshapeCredentials(userId, db);

	console.debug(`[onshape:auth] Logged out user ${userId}`);

	return c.json({ success: true });
});

export default authApp;
