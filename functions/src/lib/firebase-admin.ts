import * as admin from "firebase-admin";

if (!admin.apps.length) {
  // Cloud Functions, GitHub Actions, and local emulators all use Application
  // Default Credentials. Never pass a service-account JSON document in an
  // environment variable.
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "aresfirst-portal";

  let storageBucket = `${projectId}.appspot.com`;
  if (process.env.FIREBASE_CONFIG) {
    try {
      const config: unknown = JSON.parse(process.env.FIREBASE_CONFIG);
      if (
        typeof config === "object" &&
        config !== null &&
        "storageBucket" in config &&
        typeof config.storageBucket === "string"
      ) {
        storageBucket = config.storageBucket;
      }
    } catch {
      // Fall back to the project bucket when Firebase has not injected valid config.
    }
  }

  admin.initializeApp({
    projectId,
    storageBucket
  });
}

const adminDb = admin.firestore();
adminDb.settings({ ignoreUndefinedProperties: true });
const adminAuth = admin.auth();
const adminStorage = admin.storage();

export { adminDb, adminAuth, adminStorage };
export default admin;
