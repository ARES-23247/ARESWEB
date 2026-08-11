import { getDoc, getDocs, initializeFirestore } from "firebase/firestore";
import type { DocumentReference, Query } from "firebase/firestore";
import { app } from "./firebaseCore";
import { getLocalFirebaseEmulatorHost } from "./firebaseEnvironment";

export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

const emulatorHost = import.meta.env.DEV ? getLocalFirebaseEmulatorHost() : null;
if (emulatorHost) {
  void import("./firebaseFirestoreEmulator").then(({ connectFirestoreForDevelopment }) => {
    connectFirestoreForDevelopment(db, emulatorHost);
  });
}

export async function getDocWithTimeout<T>(docRef: DocumentReference<T>, timeoutMs = 1500) {
  return Promise.race([
    getDoc(docRef),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Firestore getDoc timeout")), timeoutMs);
    }),
  ]);
}

export async function getDocsWithTimeout<T>(queryRef: Query<T>, timeoutMs = 1500) {
  return Promise.race([
    getDocs(queryRef),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Firestore getDocs timeout")), timeoutMs);
    }),
  ]);
}
