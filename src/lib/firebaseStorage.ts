import { getStorage } from "firebase/storage";
import { app } from "./firebaseCore";
import { getLocalFirebaseEmulatorHost } from "./firebaseEnvironment";

export const storage = getStorage(app);

const emulatorHost = import.meta.env.DEV ? getLocalFirebaseEmulatorHost() : null;
if (emulatorHost) {
  void import("./firebaseStorageEmulator").then(({ connectStorageForDevelopment }) => {
    connectStorageForDevelopment(storage, emulatorHost);
  });
}
