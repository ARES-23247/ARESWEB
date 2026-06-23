import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";

import photosRouter from "./routes/photos";
import inquiriesRouter from "./routes/inquiries";
import tasksRouter from "./routes/tasks";
import analyticsRouter from "./routes/analytics";
import webhooksRouter from "./routes/webhooks";
import uploadRouter from "./routes/upload";
import replayRouter from "./routes/replay";
import profilesRouter from "./routes/profiles";
import aiRouter from "./routes/ai";
import calendarRouter from "./routes/calendar";
import simulationsRouter from "./routes/simulations";
import sponsorsRouter from "./routes/sponsors";
import outreachRouter from "./routes/outreach";
import { globalErrorHandler } from "./middleware/errorHandler";

let secret = process.env.ENCRYPTION_SECRET;
if (!secret && process.argv.some(arg => arg.includes("firebase-functions")) && process.env.FUNCTIONS_EMULATOR !== "true") {
  // During Firebase CLI deployment metadata analysis, ENCRYPTION_SECRET is not available in the local shell environment
  // due to firebase-tools environment sanitation. Provide a temporary compliant dummy secret to allow CLI trigger parsing.
  secret = "temporary_deploy_secret_that_is_at_least_32_chars";
  process.env.ENCRYPTION_SECRET = secret;
}

if (!secret || secret.length < 32 || secret === "01234567890123456789012345678901" || secret === "test-encryption-secret-with-32-chars-long") {
  throw new Error("Fatal: ENCRYPTION_SECRET must be configured with a strong secret of at least 32 characters.");
}

const app = express();

// Enable trust proxy for rate limiting behind Cloud Functions hosting proxy
app.set("trust proxy", 1);

// Middleware
// Enable CORS
app.use(cors({ origin: true }));

// Use raw body parsing for the upload endpoints, and json for everything else
app.use((req, res, next) => {
  if (req.path.startsWith("/api/upload")) {
    express.raw({ type: "*/*", limit: "50mb" })(req, res, next);
  } else {
    express.json({ limit: "10mb" })(req, res, next);
  }
});

// Mount Sub-Routers
app.use("/api/photos", photosRouter);
app.use("/api/inquiries", inquiriesRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/replay", replayRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/ai", aiRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/simulations", simulationsRouter);
app.use("/api/sponsors", sponsorsRouter);
app.use("/api/outreach", outreachRouter);

// Global Error Handler
app.use(globalErrorHandler);

// Export Cloud Function
export const api = onRequest({ 
  cors: true, 
  maxInstances: 10, 
  secrets: [
    "ENCRYPTION_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GCP_PROJECT_ID",
    "GCP_PROJECT",
    "GCLOUD_PROJECT",
    "GCP_LOCATION",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "RECAPTCHA_SECRET_KEY",
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    "ONSHAPE_ACCESS_KEY",
    "ONSHAPE_SECRET_KEY",
    "ZULIP_URL",
    "ZULIP_BOT_EMAIL",
    "ZULIP_API_KEY",
    "ZULIP_ADMIN_STREAM"
  ] 
}, app);
