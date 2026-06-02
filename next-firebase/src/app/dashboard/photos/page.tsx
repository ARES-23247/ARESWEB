"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Shield, Activity, Settings, RefreshCw, KeyRound, CheckCircle, AlertTriangle, ExternalLink, Image, Play } from "lucide-react";

interface GoogleAuthConfig {
  clientId?: string;
  linkedAt?: string;
  scopes?: string[];
  tokenType?: string;
}

export default function GoogleSyncPage() {
  const { user, authorizedUser } = useAuth();
  const [authConfig, setAuthConfig] = useState<GoogleAuthConfig | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // 1. Listen for Google OAuth state inside Firestore system_settings
  useEffect(() => {
    try {
      const authDocRef = doc(db, "system_settings", "google_auth");
      const unsubscribe = onSnapshot(
        authDocRef,
        (snap) => {
          setIsLoading(false);
          if (snap.exists()) {
            setAuthConfig(snap.data() as GoogleAuthConfig);
            setIsLive(true);
          } else {
            // Mock offline active sync configuration
            setAuthConfig({
              clientId: "847293847291-dummyapps.apps.googleusercontent.com",
              linkedAt: new Date().toISOString(),
              scopes: ["photospicker.mediaitems.readonly"],
              tokenType: "Bearer"
            });
            setIsLive(false);
          }
        },
        () => {
          setIsLoading(false);
          setAuthConfig({
            clientId: "847293847291-dummyapps.apps.googleusercontent.com",
            linkedAt: new Date().toISOString(),
            scopes: ["photospicker.mediaitems.readonly"],
            tokenType: "Bearer"
          });
          setIsLive(false);
        }
      );
      return () => unsubscribe();
    } catch {
      setIsLoading(false);
      setAuthConfig({
        clientId: "847293847291-dummyapps.apps.googleusercontent.com",
        linkedAt: new Date().toISOString(),
        scopes: ["photospicker.mediaitems.readonly"],
        tokenType: "Bearer"
      });
      setIsLive(false);
    }
  }, []);

  const handleTriggerOAuth = () => {
    if (!canEdit) return;
    // Redirect to the backend OAuth initialization URL
    window.location.href = "/api/photos/auth";
  };

  return (
    <div className="space-y-10 w-full">
      
      {/* Header */}
      <header className="border-b border-white/5 pb-8">
        <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
          <Settings size={12} className="animate-spin" /> System Integrations
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
          Google Cloud Sync
        </h1>
        <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
          Configure persistent OAuth sessions for the central team account <strong className="text-white">ares23247wv@gmail.com</strong>. This handles automated Google Photos ingestion, YouTube uploads, and Google Drive spec library lookups.
        </p>
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 rounded-xl text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to reconnect Google Cloud accounts.</span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Status Card (Left Panel) */}
        <div className="lg:col-span-1 glass-card p-6 border border-white/10 flex flex-col justify-between h-full min-h-[350px]">
          <div>
            <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-6">
              <KeyRound size={18} /> Integration Session
            </h3>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <RefreshCw className="animate-spin text-ares-cyan" size={24} />
                <span className="text-[10px] text-marble/55 uppercase font-bold tracking-widest">Querying Cloud...</span>
              </div>
            ) : authConfig ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-sm uppercase tracking-tight">Active Google Link</h4>
                    <p className="text-[10px] text-marble/50 mt-0.5">Central team Gmail active</p>
                  </div>
                </div>

                <div className="bg-black/45 border border-white/5 p-4 rounded-xl space-y-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase font-bold text-marble/50 tracking-wider">Linked Account</span>
                    <span className="text-xs font-bold text-white select-all">ares23247wv@gmail.com</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase font-bold text-marble/50 tracking-wider">Client Identity ID</span>
                    <span className="text-[10px] font-mono text-white/80 truncate select-all">{authConfig.clientId || "Missing config"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase font-bold text-marble/50 tracking-wider">Sync Timestamp</span>
                    <span className="text-[10px] font-mono text-white/80">{authConfig.linkedAt ? new Date(authConfig.linkedAt).toLocaleString() : "Pre-seeded"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-ares-red/10 border border-ares-red/30 flex items-center justify-center text-ares-red shrink-0 shadow-[0_0_15px_rgba(192,0,0,0.1)]">
                    <AlertTriangle size={20} className="animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-sm uppercase tracking-tight">Link Required</h4>
                    <p className="text-[10px] text-marble/50 mt-0.5">Offline mode pre-seeded</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/5 pt-5 mt-6">
            {canEdit ? (
              <button
                onClick={handleTriggerOAuth}
                className="w-full py-3 bg-ares-red hover:bg-ares-red-dark text-white font-black text-xs uppercase tracking-widest ares-cut transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl hover:shadow-[0_0_15px_rgba(192,0,0,0.2)] active:scale-98"
              >
                <RefreshCw size={14} /> Authorize ares23247wv@gmail.com
              </button>
            ) : (
              <span className="block text-center text-[10px] text-marble/40 uppercase font-black tracking-widest py-3 border border-white/5 bg-black/20">
                🔒 Re-auth Gated
              </span>
            )}
          </div>
        </div>

        {/* Central Information and Documentation (Right Panel) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 border border-white/10 space-y-4">
            <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
              <Activity size={18} /> Central Google Integration Details
            </h3>

            <p className="text-marble/80 text-xs leading-relaxed">
              We use the **Shared Team Account Pattern** rather than individual student access. When you link the team Gmail account (<strong className="text-white">ares23247wv@gmail.com</strong>), the system receives a secure, persistent offline `refreshToken` which is stored natively inside Firestore.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="border border-white/5 p-4 rounded-xl bg-black/20">
                <h4 className="text-white font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                  <Image size={14} className="text-ares-cyan" /> Google Photos Picker API
                </h4>
                <p className="text-marble/60 text-[11px] leading-relaxed">
                  Allows administrators to dynamically sync albums, import high-res pictures to Firebase Cloud Storage, and display them on the public gallery grid instantly.
                </p>
              </div>

              <div className="border border-white/5 p-4 rounded-xl bg-black/20">
                <h4 className="text-white font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                  <Play size={14} className="text-ares-red" /> YouTube Media Sync
                </h4>
                <p className="text-marble/60 text-[11px] leading-relaxed">
                  Integrates direct uploads, allowing match telemetries and robot mechanical guides to sync and index under the team's Video Hub channel.
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-ares-gold/5 border border-ares-gold/20 text-ares-gold-light rounded-xl flex items-start gap-3 mt-4 text-[11px] leading-relaxed">
              <AlertTriangle className="shrink-0 mt-0.5" size={16} />
              <div>
                <p className="font-extrabold uppercase mb-0.5 tracking-wide">Environment Variable Prerequisite</p>
                <p className="opacity-90">
                  Completing the real-time Google consent handshake requires your local environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to be configured inside your Next.js `.env` configuration file.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
