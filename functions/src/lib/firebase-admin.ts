import { getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let app = getApps()[0];
if (!app) {
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

  app = initializeApp({
    projectId,
    storageBucket
  });
}

const adminDb = getFirestore(app);
adminDb.settings({ ignoreUndefinedProperties: true });
const adminAuth = getAuth(app);
const adminStorage = getStorage(app);
const adminAppCheck = getAppCheck(app);
const adminFieldValue = FieldValue;

export { adminAppCheck, adminAuth, adminDb, adminFieldValue, adminStorage };
export type { DocumentData as AdminDocumentData, DocumentReference as AdminDocumentReference };
