"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser && currentUser.email) {
        try {
          // Normalize Google email local part (ignore dots)
          const cleanEmail = currentUser.email.trim().toLowerCase();
          const emailDocId = cleanEmail; // Document ID is the email address

          const userRef = doc(db, "authorized_users", emailDocId);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            setAuthorizedUser(userSnap.data() as AuthorizedUser);
          } else {
            console.warn(`User ${cleanEmail} is authenticated but not in the authorized_users list.`);
            setAuthorizedUser(null);
          }
        } catch (error) {
          console.error("Error fetching authorized user metadata:", error);
          setAuthorizedUser(null);
        }
      } else {
        // Only reset authorizedUser if user is actually null (not when using mock user)
        if (!user || user.uid !== "mock_user_123") {
          setAuthorizedUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google SSO login error:", error);
      setLoading(false);
      throw error;
    }
  };

  const loginWithMockUser = (email: string, role: string, name?: string) => {
    setLoading(true);
    const mockEmail = email.trim().toLowerCase();
    setUser({
      uid: "mock_user_123",
      email: mockEmail,
      displayName: name || "ARES Lead",
      photoURL: `https://api.dicebear.com/9.x/bottts/svg?seed=${mockEmail}`,
      emailVerified: true,
    } as any);
    setAuthorizedUser({
      email: mockEmail,
      role: role,
      name: name || "ARES Lead",
    });
    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (user && user.uid === "mock_user_123") {
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
