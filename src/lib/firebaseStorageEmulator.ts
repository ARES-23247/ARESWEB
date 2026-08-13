import { logger } from "@/utils/logger";
import { connectStorageEmulator } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

export function connectStorageForDevelopment(storage: FirebaseStorage, host: string) {
  try {
    connectStorageEmulator(storage, host, 9199);
  } catch (error) {
    logger.warn("Storage Emulator was already connected or could not connect:", error);
  }
}
