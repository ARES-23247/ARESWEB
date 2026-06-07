import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";

import photosRouter from "./routes/photos";
import inquiriesRouter from "./routes/inquiries";
import tasksRouter from "./routes/tasks";
import analyticsRouter from "./routes/analytics";
import webhooksRouter from "./routes/webhooks";
import uploadRouter from "./routes/upload";
import profilesRouter from "./routes/profiles";

const app = express();

// Enable trust proxy for rate limiting behind Cloud Functions hosting proxy
app.set("trust proxy", 1);

// Middleware
app.use(cors({ origin: true }));

// Use raw body parsing for the upload endpoint, and json for everything else
app.use((req, res, next) => {
  if (req.path === "/api/upload") {
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
app.use("/api/profiles", profilesRouter);

// Export Cloud Function
export const api = onRequest({ cors: true, maxInstances: 10 }, app);
