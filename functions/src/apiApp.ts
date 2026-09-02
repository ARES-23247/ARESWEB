import cors from "cors";
import express, { type Router } from "express";
import rateLimit from "express-rate-limit";
import { enforceAppCheck, observeAppCheck } from "./middleware/appCheck";
import { ensureAdmin, ensureTeamMember } from "./middleware/auth";
import { distributedQuota } from "./middleware/distributedQuota";
import { photoAiGenerationBudget } from "./middleware/aiBudget";
import { globalErrorHandler } from "./middleware/errorHandler";
import { allowedOrigins } from "./functionConfig";

export interface ApiRouteMount {
  path: string;
  router: Router;
}

interface CreateApiAppOptions {
  routes: readonly ApiRouteMount[];
  enableLargePhotoUpload?: boolean;
  globalRequestLimit?: {
    max: number;
    windowMs: number;
  };
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin as (typeof allowedOrigins)[number])) {
      callback(null, true);
      return;
    }
    if (/^https:\/\/aresfirst-portal--[a-z0-9-]+\.web\.app$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
};

/** Build an isolated API process with the same security middleware contract. */
export function createApiApp({
  routes,
  enableLargePhotoUpload = false,
  globalRequestLimit,
}: CreateApiAppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors(corsOptions));
  app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: "Too many API requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  }));
  if (globalRequestLimit) {
    app.use("/api", rateLimit({
      windowMs: globalRequestLimit.windowMs,
      max: globalRequestLimit.max,
      keyGenerator: () => "service-global",
      message: { error: "The online game service is temporarily at capacity." },
      standardHeaders: true,
      legacyHeaders: false,
    }));
  }
  app.use(observeAppCheck);
  app.use(enforceAppCheck);

  if (enableLargePhotoUpload) {
    // Authentication and the distributed quota must run before allocating the
    // only large request body accepted by the API.
    app.use(
      "/api/photos/upload-unified",
      ensureTeamMember,
      distributedQuota({ scope: "photo-upload", limit: 30, windowMs: 15 * 60 * 1000 }),
      photoAiGenerationBudget,
      express.json({ limit: "12mb" }),
    );
    app.use(
      "/api/photos/sponsor-logo",
      ensureAdmin,
      distributedQuota({ scope: "sponsor-logo-upload", limit: 20, windowMs: 15 * 60 * 1000 }),
      express.raw({
        type: ["image/jpeg", "image/png", "image/webp"],
        limit: "5mb",
      }),
    );
  }

  app.use(express.json({ limit: "1mb" }));
  for (const route of routes) app.use(route.path, route.router);

  app.use((_req, res) => {
    res.status(404).json({ error: "API route not found." });
  });
  app.use(globalErrorHandler);
  return app;
}
