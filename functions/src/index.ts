import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import express from "express";
import cors from "cors";
import { adminDb } from "./lib/firebase-admin";
import { logger } from "./lib/logger";

import photosRouter from "./routes/photos";
import inquiriesRouter from "./routes/inquiries";
import tasksRouter from "./routes/tasks";
import webhooksRouter from "./routes/webhooks";
import uploadRouter from "./routes/upload";
import replayRouter from "./routes/replay";
import profilesRouter from "./routes/profiles";
import aiRouter from "./routes/ai";
import calendarRouter from "./routes/calendar";
import simulationsRouter from "./routes/simulations";
import sponsorsRouter from "./routes/sponsors";
import outreachRouter from "./routes/outreach";
import sitemapRouter from "./routes/sitemap";
import tournamentsRouter from "./routes/tournaments";
import robotsRouter from "./routes/robots";
import videosRouter from "./routes/videos";
import storeRouter from "./routes/store";
import zulipRouter from "./routes/zulip";
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
// Enable CORS with restricted origin reflection
const allowedOrigins = [
  "https://ares23247.web.app",
  "https://ares23247.firebaseapp.com",
  "https://aresfirst.org",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    // Allow subdomains ending in .web.app or .firebaseapp.com
    const hostname = origin.replace(/^https?:\/\//, "");
    if (hostname.endsWith(".web.app") || hostname.endsWith(".firebaseapp.com")) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
};

app.use(cors(corsOptions));

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
app.use("/api/webhooks", webhooksRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/replay", replayRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/ai", aiRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/simulations", simulationsRouter);
app.use("/api/sponsors", sponsorsRouter);
app.use("/api/outreach", outreachRouter);
app.use("/api/tournaments", tournamentsRouter);
app.use("/api/robots", robotsRouter);
app.use("/api/videos", videosRouter);
app.use("/api/store", storeRouter);
app.use("/api/zulip", zulipRouter);
app.use("/sitemap.xml", sitemapRouter);
app.use("/api/sitemap.xml", sitemapRouter);

app.get("/api/reference", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>ARES API Reference</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex, nofollow">
      </head>
      <body>
        <script id="api-reference" data-url="/api/openapi.json"></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  `);
});

// Global Error Handler
app.use(globalErrorHandler);

// Export Cloud Function
export const api = onRequest({ 
  cors: [
    "https://ares23247.web.app",
    "https://ares23247.firebaseapp.com",
    "https://aresfirst.org",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    /\.web\.app$/,
    /\.firebaseapp\.com$/,
  ], 
  maxInstances: 10, 
  secrets: [
    "ENCRYPTION_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GCP_PROJECT_ID",
    "GEMINI_API_KEY",
    "RECAPTCHA_SECRET_KEY",
  ] 
}, app);

// Daily database data minimization job (cleans up inquiries older than 180 days)
export const cleanupOldInquiries = onSchedule({
  schedule: "0 0 * * *", // Runs daily at midnight
  maxInstances: 1,
  secrets: ["ENCRYPTION_SECRET"],
}, async (event) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 180);
  const cutoffIso = cutoffDate.toISOString();

  logger.info("cleanup", `Starting deletion of inquiries older than ${cutoffIso}`);

  try {
    const snap = await adminDb
      .collection("inquiries")
      .where("createdAt", "<", cutoffIso)
      .get();

    if (snap.empty) {
      logger.info("cleanup", "No old inquiries found to clean up.");
      return;
    }

    const batch = adminDb.batch();
    snap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    logger.info("cleanup", `Successfully cleaned up ${snap.size} old inquiries.`);
  } catch (err) {
    logger.error("cleanup", "Error running inquiries cleanup task", err);
  }
});
