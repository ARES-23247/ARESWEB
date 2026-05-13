import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppEnv } from "../../middleware/utils";
import auth from "./auth";
import documents from "./documents";

// Create the router
const onshapeApp = new OpenAPIHono<AppEnv>();

// Mount auth routes
onshapeApp.route("/auth", auth);

// Mount documents routes
onshapeApp.route("/documents", documents);

// OpenAPI documentation
const healthRoute = createRoute({
	method: "get",
	path: "/health",
	summary: "Check Onshape API health",
	description: "Health check endpoint for Onshape integration.",
	responses: {
		200: {
			description: "Service is healthy",
		},
	},
});

/**
 * GET /api/onshape/health
 *
 * Simple health check endpoint
 */
onshapeApp.openapi(healthRoute, (c) => {
	return c.json({
		status: "ok",
		service: "onshape",
		timestamp: new Date().toISOString(),
	});
});

export default onshapeApp;
