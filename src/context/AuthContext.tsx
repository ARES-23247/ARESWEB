"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebaseAuth";
import { authenticatedFetch } from "../lib/api";
import { getOrInitializeAppCheck } from "../lib/firebaseAppCheck";
import { logger } from "../utils/logger";

interface AuthorizedUser {
  email: string;
  role: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  authorizedUser: AuthorizedUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loginWithMockUser: (email: string, role: string, name?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const mockAuthEnabled = import.meta.env.DEV || import.meta.env.MODE === "e2e";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authorizedUser, setAuthorizedUser] = useState<AuthorizedUser | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const isMockRef = useRef(false);

  useEffect(() => {
    // Prime App Check on startup so Auth and Firestore have active tokens immediately
    if (typeof window !== "undefined") {
      void getOrInitializeAppCheck();
    }

    // Safety timeout: if Auth takes more than 1.5 seconds to initialize (e.g., emulators are offline/refused),
    // automatically force loading to false so the developer bypass lockscreen is visible.
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 1500);

    // Check if we have a saved mock session in sessionStorage (development/E2E testing)
    if (mockAuthEnabled && typeof window !== "undefined") {
      const savedMock = sessionStorage.getItem("ares_mock_user");
      if (savedMock) {
        try {
          const parsed = JSON.parse(savedMock);
          loginWithMockUser(parsed.email, parsed.role, parsed.name);
          clearTimeout(safetyTimeout);
          return;
        } catch {
          logger.error("Failed to restore the local mock user session.");
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(safetyTimeout);
      if (isMockRef.current) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      if (currentUser && currentUser.email) {
        try {
          // Verify and link user profile securely via functions backend
          const response = await authenticatedFetch("/api/profiles/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.authorizedUser) {
              setAuthorizedUser(data.authorizedUser as AuthorizedUser);
            } else {
              logger.warn(
                "Authenticated Firebase user has no active authorization record.",
              );
              setAuthorizedUser(null);
            }
          } else {
            logger.warn("Session linking endpoint rejected the request.", {
              status: response.status,
            });
            setAuthorizedUser(null);
          }
        } catch {
          logger.error(
            "Unable to verify the authenticated session with the backend.",
          );
          setAuthorizedUser(null);
        }
      } else {
        // Only reset authorizedUser if we are not in mock user mode
        if (!isMockRef.current) {
          setAuthorizedUser(null);
        }
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();

    // Check if emulator is configured and if we are in local environment
    const isLocalEnv =
      mockAuthEnabled &&
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.startsWith("192.168.") ||
        window.location.hostname.startsWith("10.") ||
        window.location.hostname.endsWith(".local"));

    if (isLocalEnv) {
      const host = window.location.hostname;
      const emulatorHost =
        host === "localhost" || host === "127.0.0.1" || !host
          ? "127.0.0.1"
          : host;

      try {
        // Quick fetch ping to see if the emulator is active on port 9099
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600); // 600ms timeout

        await fetch(`http://${emulatorHost}:9099`, {
          method: "GET",
          mode: "no-cors",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        logger.debug("Firebase Auth Emulator is active; using emulator login.");
      } catch {
        logger.warn(
          "Firebase Auth Emulator is unavailable; using the local developer mock session.",
        );
        loginWithMockUser(
          "local.admin@example.test",
          "admin",
          "Local Administrator",
        );
        return;
      }
    }

    try {
      if (typeof window !== "undefined") {
        await getOrInitializeAppCheck();
      }
      await signInWithPopup(auth, provider);
    } catch (error) {
      logger.error("Google SSO login failed.");

      if (isLocalEnv) {
        logger.warn(
          "Auth Emulator login failed; using the local developer mock session.",
        );
        loginWithMockUser(
          "local.admin@example.test",
          "admin",
          "Local Administrator",
        );
        return;
      }

      setLoading(false);
      throw error;
    }
  };

  const loginWithMockUser = async (
    email: string,
    role: string,
    name?: string,
  ) => {
    if (!mockAuthEnabled) {
      logger.error(
        "Mock authentication is disabled outside local development and E2E builds.",
      );
      return;
    }

    isMockRef.current = true;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "ares_mock_user",
        JSON.stringify({ email, role, name }),
      );
    }
    setLoading(true);
    const mockEmail = email.trim().toLowerCase();

    // E2E uses an isolated client-only identity so cross-browser tests never depend on emulator CORS.
    if (import.meta.env.MODE !== "e2e") {
      try {
        try {
          await signInWithEmailAndPassword(auth, mockEmail, "password123");
        } catch {
          // Create the user in the Auth Emulator if they don't exist yet
          await createUserWithEmailAndPassword(auth, mockEmail, "password123");
        }
        logger.debug("Mock user authenticated with Firebase Auth Emulator.");
      } catch {
        logger.warn(
          "Auth Emulator unavailable; using client-only mock authentication.",
        );
      }
    }

    const mockUserUid =
      auth.currentUser?.uid ||
      (mockEmail === "coach.david@gmail.com"
        ? "coach_david_uid"
        : mockEmail === "student.lead@gmail.com"
          ? "student_lead_uid"
          : mockEmail === "mentor.expert@gmail.com"
            ? "mentor_expert_uid"
            : "mock_user_123");

    const mockUser = {
      uid: mockUserUid,
      email: mockEmail,
      displayName: name || "ARES Lead",
      photoURL: `https://api.dicebear.com/9.x/bottts/svg?seed=${mockEmail}`,
      emailVerified: true,
    } as unknown as User;

    setUser(mockUser);
    setAuthorizedUser({
      email: mockEmail,
      role: role,
      name: name || "ARES Lead",
    });

    // Firestore is intentionally absent from the shared authentication shell.
    // Local-only roster bootstrapping lives in a dynamic development chunk.
    if (import.meta.env.DEV && import.meta.env.MODE !== "e2e") {
      try {
        const { bootstrapDevelopmentAuthorizedUser } =
          await import("../lib/firebaseDevBootstrap");
        await bootstrapDevelopmentAuthorizedUser({
          uid: mockUser.uid,
          email: mockEmail,
          role,
          name: name || "ARES Lead",
        });
      } catch {
        logger.warn(
          "Could not bootstrap the development authorization record in the Firestore Emulator.",
        );
      }
    }

    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    try {
      if ((user && user.uid === "mock_user_123") || isMockRef.current) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("ares_mock_user");
        }
        isMockRef.current = false;
        setUser(null);
        setAuthorizedUser(null);
        setLoading(false);
        return;
      }
      await signOut(auth);
    } catch (error) {
      logger.error("Logout failed.");
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authorizedUser,
        loading,
        loginWithGoogle,
        loginWithMockUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
