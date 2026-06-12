import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const getEnv = (key: string): string => {
  if (typeof import.meta !== "undefined" && import.meta.env?.[key]) {
    return import.meta.env[key] as string;
  }
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key] as string;
  }
  return "";
};

const firebaseConfig = {
  apiKey: getEnv("NEXT_PUBLIC_FIREBASE_API_KEY") || "dummy-api-key",
  authDomain: getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") || "ares-web-preview.firebaseapp.com",
  projectId: getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID") || "ares-web-preview",
  storageBucket: getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") || "ares-web-preview.appspot.com",
  messagingSenderId: getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") || "123456789",
  appId: getEnv("NEXT_PUBLIC_FIREBASE_APP_ID") || "1:123456789:web:abcdef12345"
};

// Handle SSR check: only initialize on client or once globally
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Connect client SDKs to local emulators if running in local or development environment
if (
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
   window.location.hostname === "127.0.0.1" ||
   window.location.hostname.startsWith("192.168.") ||
   window.location.hostname.startsWith("10.") ||
   window.location.hostname.endsWith(".local"))
) {
  try {
    const host = window.location.hostname;
    const emulatorHost = (host === "localhost" || host === "127.0.0.1" || !host) ? "127.0.0.1" : host;
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8080);
    connectStorageEmulator(storage, emulatorHost, 9199);
    console.log(`⚡ Connected client SDK to local Firebase Emulators at ${emulatorHost} (Auth: 9099, Firestore: 8080, Storage: 9199)`);
  } catch (err) {
    console.warn("Firebase Emulators already connected or connection failed:", err);
  }
}

export { app, auth, db, storage };


