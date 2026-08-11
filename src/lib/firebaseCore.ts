import { getApp, getApps, initializeApp } from "firebase/app";

const config = {
  apiKey: import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseConfig = {
  apiKey: config.apiKey || "dummy-api-key",
  authDomain: config.authDomain || "ares-web-preview.firebaseapp.com",
  projectId: config.projectId || "ares-web-preview",
  storageBucket: config.storageBucket || "ares-web-preview.appspot.com",
  messagingSenderId: config.messagingSenderId || "123456789",
  appId: config.appId || "1:123456789:web:abcdef12345",
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
