import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator, getDoc, getDocs } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const getFirebaseConfig = () => {
  if (typeof import.meta !== "undefined") {
    return {
      apiKey: import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }
  return {
    apiKey: typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY : undefined,
    authDomain: typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN : undefined,
    projectId: typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID : undefined,
    storageBucket: typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET : undefined,
    messagingSenderId: typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID : undefined,
    appId: typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_APP_ID : undefined,
  };
};

const config = getFirebaseConfig();

const firebaseConfig = {
  apiKey: config.apiKey || "dummy-api-key",
  authDomain: config.authDomain || "ares-web-preview.firebaseapp.com",
  projectId: config.projectId || "ares-web-preview",
  storageBucket: config.storageBucket || "ares-web-preview.appspot.com",
  messagingSenderId: config.messagingSenderId || "123456789",
  appId: config.appId || "1:123456789:web:abcdef12345"
};

// Handle SSR check: only initialize on client or once globally
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});
const storage = getStorage(app);

// Connect client SDKs to local emulators if running in local or development environment
const useEmulator = import.meta.env.VITE_USE_EMULATOR !== "false" && import.meta.env.NEXT_PUBLIC_USE_EMULATOR !== "false";
if (
  useEmulator &&
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


export const getDocWithTimeout = async (docRef: any, timeoutMs = 1500): Promise<any> => {
  return Promise.race([
    getDoc(docRef),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Firestore getDoc timeout")), timeoutMs)
    )
  ]);
};

export const getDocsWithTimeout = async (queryRef: any, timeoutMs = 1500): Promise<any> => {
  return Promise.race([
    getDocs(queryRef),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Firestore getDocs timeout")), timeoutMs)
    )
  ]);
};

export { app, auth, db, storage };


