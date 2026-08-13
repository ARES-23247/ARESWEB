import { onRequest, type HttpsOptions } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { adminDb } from "./lib/firebase-admin";
import { logger } from "./lib/logger";
import { createLazyAppHandler } from "./lazyApp";
import { allowedOrigins, FUNCTION_SECRET_BINDINGS } from "./functionConfig";

export { web } from "./web";
export { API_ROUTE_GROUPS, FUNCTION_SECRET_BINDINGS } from "./functionConfig";

const commonOptions: HttpsOptions = {
  cors: [...allowedOrigins, /^https:\/\/aresfirst-portal--[a-z0-9-]+\.web\.app$/],
  invoker: "public",
  maxInstances: 10,
  concurrency: 20,
};

const publicHandler = createLazyAppHandler(async () => (await import("./apps/public")).publicApp);
const coreHandler = createLazyAppHandler(async () => (await import("./apps/core")).coreApp);
const mediaHandler = createLazyAppHandler(async () => (await import("./apps/media")).mediaApp);
const communicationsHandler = createLazyAppHandler(
  async () => (await import("./apps/communications")).communicationsApp,
);

export const publicApi = onRequest({ ...commonOptions, memory: "512MiB", timeoutSeconds: 60 }, publicHandler);
export const coreApi = onRequest({
  ...commonOptions,
  memory: "512MiB",
  timeoutSeconds: 60,
  secrets: [...FUNCTION_SECRET_BINDINGS.coreApi],
}, coreHandler);
export const mediaApi = onRequest({
  ...commonOptions,
  memory: "1GiB",
  timeoutSeconds: 300,
  concurrency: 10,
  secrets: [...FUNCTION_SECRET_BINDINGS.mediaApi],
}, mediaHandler);
export const communicationsApi = onRequest({
  ...commonOptions,
  memory: "512MiB",
  timeoutSeconds: 60,
  secrets: [...FUNCTION_SECRET_BINDINGS.communicationsApi],
}, communicationsHandler);

export const cleanupOldInquiries = onSchedule({
  schedule: "0 0 * * *",
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
      const snapshot = await adminDb.collection("inquiries")
        .where("createdAt", "<", cutoffIso)
        .limit(400)
        .get();
      if (snapshot.empty) break;

      const batch = adminDb.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
      deletedCount += snapshot.size;
      if (snapshot.size < 400) break;
    }
    logger.info("cleanup", `Successfully cleaned up ${deletedCount} old inquiries.`);
  } catch (error) {
    logger.error("cleanup", "Error running inquiries cleanup task", error);
  }
});
