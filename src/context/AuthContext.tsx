"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, getDocWithTimeout } from "../lib/firebase";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authorizedUser, setAuthorizedUser] = useState<AuthorizedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isMockRef = useRef(false);

  useEffect(() => {
    // Safety timeout: if Auth takes more than 1.5 seconds to initialize (e.g., emulators are offline/refused),
    // automatically force loading to false so the developer bypass lockscreen is visible.
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 1500);

    // Check if we have a saved mock session in sessionStorage (development/E2E testing)
    if (typeof window !== "undefined") {
      const savedMock = sessionStorage.getItem("ares_mock_user");
      if (savedMock) {
        try {
          const parsed = JSON.parse(savedMock);
          loginWithMockUser(parsed.email, parsed.role, parsed.name);
          clearTimeout(safetyTimeout);
          return;
        } catch (e) {
          console.error("Failed to restore mock user session:", e);
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
          const idToken = await currentUser.getIdToken();
          const response = await fetch("/api/profiles/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.authorizedUser) {
              setAuthorizedUser(data.authorizedUser as AuthorizedUser);
            } else {
              console.warn(`User ${currentUser.email} is authenticated but not authorized.`);
              setAuthorizedUser(null);
            }
          } else {
            console.warn(`Session linking endpoint returned status ${response.status}`);
            setAuthorizedUser(null);
          }
        } catch (error) {
          console.error("Error verifying auth session with backend:", error);
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
    const isLocalEnv = typeof window !== "undefined" && (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.startsWith("192.168.") ||
      window.location.hostname.startsWith("10.") ||
      window.location.hostname.endsWith(".local") ||
      window.location.hostname.includes("aresfirst-portal--")
    );

    if (isLocalEnv) {
      const host = window.location.hostname;
      const emulatorHost = (host === "localhost" || host === "127.0.0.1" || !host) ? "127.0.0.1" : host;

      try {
        // Quick fetch ping to see if the emulator is active on port 9099
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600); // 600ms timeout

        await fetch(`http://${emulatorHost}:9099`, {
          method: "GET",
          mode: "no-cors",
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log("⚡ Firebase Auth Emulator is active. Proceeding with standard emulator login.");
      } catch (err) {
        console.warn("⚡ Firebase Auth Emulator is offline or refused connection. Bypassing popup and signing in with Developer Mock session.");
        loginWithMockUser("coach.david@gmail.com", "admin", "Coach David");
        return;
      }
    }

    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google SSO login error:", error);

      if (isLocalEnv) {
        console.warn("Auth Emulator offline or connection failed. Auto-logging in via developer bypass.");
        loginWithMockUser("coach.david@gmail.com", "admin", "Coach David");
        return;
      }

      setLoading(false);
      throw error;
    }
  };

  const loginWithMockUser = async (email: string, role: string, name?: string) => {
    isMockRef.current = true;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("ares_mock_user", JSON.stringify({ email, role, name }));
    }
    setLoading(true);
    const mockEmail = email.trim().toLowerCase();

    // Attempt to authenticate with local Firebase Auth Emulator if we are in local environment
    try {
      try {
        await signInWithEmailAndPassword(auth, mockEmail, "password123");
      } catch (authErr) {
        // Create the user in the Auth Emulator if they don't exist yet
        await createUserWithEmailAndPassword(auth, mockEmail, "password123");
      }
      console.log("⚡ Mock user authenticated with Firebase Auth Emulator:", mockEmail);
    } catch (err) {
      console.warn("Mock user client-only fallback (Auth Emulator offline/refused):", err);
    }

    const mockUserUid = auth.currentUser?.uid || 
      (mockEmail === "coach.david@gmail.com" ? "coach_david_uid" : 
       mockEmail === "student.lead@gmail.com" ? "student_lead_uid" : 
       mockEmail === "mentor.expert@gmail.com" ? "mentor_expert_uid" : "mock_user_123");

    const mockUser = {
      uid: mockUserUid,
      email: mockEmail,
      displayName: name || "ARES Lead",
      photoURL: `https://api.dicebear.com/9.x/bottts/svg?seed=${mockEmail}`,
      emailVerified: true,
    } as any;

    setUser(mockUser);
    setAuthorizedUser({
      email: mockEmail,
      role: role,
      name: name || "ARES Lead",
    });

    // Attempt to bootstrap the authorized_users record in the Firestore Emulator
    try {
      const userRef = doc(db, "authorized_users", mockUser.uid);
      const userSnap = await getDocWithTimeout(userRef, 1000);
      if (!userSnap.exists()) {
        console.log("⚡ Bootstrapping admin user in Firestore Emulator...");
        await Promise.race([
          setDoc(userRef, {
            email: mockEmail,
            role: role,
            name: name || "ARES Lead"
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Firestore setDoc timeout")), 1000)
          )
        ]);
      }
    } catch (dbErr) {
      console.warn("Could not bootstrap authorized_users doc in Firestore Emulator:", dbErr);
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
      console.error("Logout error:", error);
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, authorizedUser, loading, loginWithGoogle, loginWithMockUser, logout }}>
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
