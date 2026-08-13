import { logger } from "@/utils/logger";
import { connectFirestoreEmulator } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

export function connectFirestoreForDevelopment(db: Firestore, host: string) {
  try {
    connectFirestoreEmulator(db, host, 8080);
  } catch (error) {
    logger.warn("Firestore Emulator was already connected or could not connect:", error);
  }
}
