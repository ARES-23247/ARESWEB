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
        setAuthorizedUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, authorizedUser, loading, loginWithGoogle, logout }}>
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
