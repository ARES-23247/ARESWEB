import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { adminDb } from "./lib/firebase-admin";
import { logger } from "./lib/logger";

import photosRouter from "./routes/photos";
import inquiriesRouter from "./routes/inquiries";
import tasksRouter from "./routes/tasks";
import webhooksRouter from "./routes/webhooks";
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
import driveRouter from "./routes/drive";
import financeRouter from "./routes/finance";
import { globalErrorHandler } from "./middleware/errorHandler";
import { enforceAppCheck, observeAppCheck } from "./middleware/appCheck";
import { ensureTeamMember } from "./middleware/auth";
import { distributedQuota } from "./middleware/distributedQuota";

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

export const app = express();

// Enable trust proxy for rate limiting behind Cloud Functions hosting proxy
app.set("trust proxy", 1);

// Middleware
// Enable CORS with restricted origin reflection
const allowedOrigins = [
  "https://ares23247.web.app",
  "https://ares23247.firebaseapp.com",
  "https://aresfirst.org",
  "https://aresfirst-portal.web.app",
  "https://aresfirst-portal.firebaseapp.com",
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
    // Permit only this project's Firebase preview channels.
    if (/^https:\/\/aresfirst-portal--[a-z0-9-]+\.web\.app$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
};

app.use(cors(corsOptions));

// Apply a bounded global API rate limit before parsing request bodies.
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Too many API requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(observeAppCheck);
app.use(enforceAppCheck);
// Authenticate the only large JSON upload before allocating/parsing its body.
// Base64 adds roughly one third to the validated 8 MB binary image limit.
app.use(
  "/api/photos/upload-unified",
  ensureTeamMember,
  distributedQuota({ scope: "photo-upload", limit: 30, windowMs: 15 * 60 * 1000 }),
  express.json({ limit: "12mb" }),
);
app.use(express.json({ limit: "1mb" }));

// Mount Sub-Routers
app.use("/api/photos", photosRouter);
app.use("/api/inquiries", inquiriesRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/webhooks", webhooksRouter);
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
app.use("/api/drive", driveRouter);
app.use("/api/finance", financeRouter);
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
      <body style="font-family:system-ui;background:#0b0b0d;color:#f5f5f5;padding:2rem">
        <h1>ARES API Reference</h1>
        <p>The interactive OpenAPI specification is not currently published.</p>
        <p><a href="/developer-api" target="_top" style="color:#f4b942">Return to the developer API guide</a></p>
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
    /^https:\/\/aresfirst-portal--[a-z0-9-]+\.web\.app$/,
  ], 
  maxInstances: 10,
  memory: "1GiB",
  timeoutSeconds: 300,
  concurrency: 10,
  secrets: [
    "ENCRYPTION_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_PHOTOS_REFRESH_TOKEN",
    "GEMINI_API_KEY",
    "YOUTUBE_API_KEY",
    "RECAPTCHA_SECRET_KEY",
    "PROFILE_SYNC_SECRET",
    "GITHUB_PAT",
    "ZULIP_BOT_EMAIL",
    "ZULIP_API_KEY",
    "ZULIP_WEBHOOK_TOKEN",
  ] 
}, app);

// Daily database data minimization job (cleans up inquiries older than 180 days)
export const cleanupOldInquiries = onSchedule({
  schedule: "0 0 * * *", // Runs daily at midnight
  maxInstances: 1,
  secrets: ["ENCRYPTION_SECRET"],
}, async (_event) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 180);
  const cutoffIso = cutoffDate.toISOString();

  logger.info("cleanup", `Starting deletion of inquiries older than ${cutoffIso}`);

  try {
    let deletedCount = 0;
    while (true) {
      const snap = await adminDb
        .collection("inquiries")
        .where("createdAt", "<", cutoffIso)
        .limit(400)
        .get();

      if (snap.empty) break;

      const batch = adminDb.batch();
      snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
      deletedCount += snap.size;

      if (snap.size < 400) break;
    }

    logger.info("cleanup", `Successfully cleaned up ${deletedCount} old inquiries.`);
  } catch (err) {
    logger.error("cleanup", "Error running inquiries cleanup task", err);
  }
});
