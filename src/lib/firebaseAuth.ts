import { connectAuthEmulator, getAuth } from "firebase/auth";
import { app } from "./firebaseCore";
import { getLocalFirebaseEmulatorHost } from "./firebaseEnvironment";

export const auth = getAuth(app);

const emulatorHost = getLocalFirebaseEmulatorHost();
if (emulatorHost) {
  try {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  } catch (error) {
    console.warn("Firebase Auth Emulator was already connected or could not connect:", error);
  }
}
