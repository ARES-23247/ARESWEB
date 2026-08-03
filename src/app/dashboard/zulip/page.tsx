"use client";

import React, { useState, useEffect } from "react";
import { 
  MessageSquare, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Smartphone, 
  Monitor, 
  ShieldCheck, 
  Settings, 
  RefreshCw,
  HelpCircle,
  Sparkles,
  Link as LinkIcon
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function DashboardZulipPage() {
  const { user, authorizedUser } = useAuth();
  const [zulipLink, setZulipLink] = useState<string>("https://aresfirst.zulipchat.com/join/ba4zj4e6ykjazruzn3is6lvr/");
  const [zulipAccount, setZulipAccount] = useState<any | null>(null);
  const [checkingSync, setCheckingSync] = useState<boolean>(true);
  const [editingLink, setEditingLink] = useState<boolean>(false);
  const [newLinkInput, setNewLinkInput] = useState<string>("");
  const [savingLink, setSavingLink] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const isAdmin = authorizedUser?.role === "admin" || authorizedUser?.role === "coach";

  useEffect(() => {
    fetchZulipConfigAndStatus();
  }, [user]);

  const fetchZulipConfigAndStatus = async () => {
    setCheckingSync(true);
    try {
      // 1. Fetch configured invite link from Firestore
      const configDoc = await getDoc(doc(db, "settings", "zulip"));
      if (configDoc.exists() && configDoc.data().inviteUrl) {
        setZulipLink(configDoc.data().inviteUrl);
        setNewLinkInput(configDoc.data().inviteUrl);
      } else {
        setNewLinkInput("https://aresfirst.zulipchat.com/join/ba4zj4e6ykjazruzn3is6lvr/");
      }

      // 2. Check if logged-in user is synced in Zulip roster
      if (user?.email && authenticatedFetch) {
        const res = await authenticatedFetch("/api/profiles/zulip/users");
        if (res.ok) {
          const data = await res.json();
          const normEmail = user.email.toLowerCase().trim();
          const match = (data.users || []).find((u: any) => 
            (u.email && u.email.toLowerCase().trim() === normEmail) ||
            (u.delivery_email && u.delivery_email.toLowerCase().trim() === normEmail)
          );
          setZulipAccount(match || null);
        }
      }
    } catch (err) {
      console.warn("Could not check Zulip sync status:", err);
    } finally {
      setCheckingSync(false);
    }
  };

  const handleSaveInviteLink = async () => {
    if (!newLinkInput.trim()) return;
    setSavingLink(true);
    setStatusMessage(null);

    try {
      let cleanUrl = newLinkInput.trim();
      if (!cleanUrl.startsWith("http")) cleanUrl = `https://${cleanUrl}`;

      await setDoc(doc(db, "settings", "zulip"), {
        inviteUrl: cleanUrl,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || "admin"
      }, { merge: true });

      setZulipLink(cleanUrl);
      setEditingLink(false);
      setStatusMessage({ text: "Zulip invitation link updated successfully!", type: "success" });
    } catch (err: any) {
      console.error("Failed to save Zulip link:", err);
      setStatusMessage({ text: err.message || "Failed to update link.", type: "error" });
    } finally {
      setSavingLink(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(zulipLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden bg-obsidian-dark border border-ares-gold/25 p-6 md:p-8 ares-cut-lg shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-ares-red/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-ares-gold/10 border border-ares-gold/30 rounded text-ares-gold text-[10px] font-black uppercase tracking-widest font-heading">
              <MessageSquare size={12} /> Team Communication Hub
            </div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wider text-white font-heading">
              Zulip Workspace Self-Join
            </h1>
            <p className="text-sm text-marble/70 max-w-2xl">
              Connect to ARES 23247's official chat workspace for team announcements, subteam channels, hardware updates, and competition logistics.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <a
              href={zulipLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-ares-red hover:bg-ares-red/90 text-white font-black text-xs uppercase tracking-widest ares-cut-sm shadow-lg shadow-ares-red/20 transition-all flex items-center gap-2 hover:scale-[1.02]"
            >
              <ExternalLink size={16} /> Join Zulip Workspace
            </a>
            <button
              onClick={handleCopyLink}
              className="text-[10px] font-bold text-marble/60 hover:text-ares-gold transition-colors flex items-center gap-1"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? "Copied to Clipboard!" : "Copy Join Link"}
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded border text-xs font-bold flex items-center justify-between ${
          statusMessage.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
            : "bg-ares-red/10 border-ares-red/30 text-ares-red"
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Account Status & Join Instructions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* User Status Card */}
          <div className="bg-obsidian-dark border border-white/10 p-6 ares-cut-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-white font-heading flex items-center gap-2">
                <ShieldCheck size={16} className="text-ares-gold" /> Your Zulip Link Status
              </h3>
              <button
                onClick={fetchZulipConfigAndStatus}
                disabled={checkingSync}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-marble/70 hover:text-white rounded transition-colors disabled:opacity-50"
                title="Refresh Status"
              >
                <RefreshCw size={14} className={checkingSync ? "animate-spin text-ares-gold" : ""} />
              </button>
            </div>

            {checkingSync ? (
              <div className="py-6 flex items-center gap-3 text-xs text-marble/60">
                <div className="w-4 h-4 border-2 border-ares-gold/20 border-t-ares-gold rounded-full animate-spin" />
                Checking Zulip workspace status for {user?.email}...
              </div>
            ) : zulipAccount ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Account Active & Linked</div>
                    <div className="text-[11px] text-emerald-400/90 font-mono">
                      {zulipAccount.full_name || zulipAccount.email} ({zulipAccount.email})
                    </div>
                  </div>
                </div>
                <a
                  href="https://aresfirst.zulipchat.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider rounded transition-colors"
                >
                  Open Chat
                </a>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded space-y-3">
                <div className="flex items-start gap-3">
                  <XCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white">Zulip Account Not Linked Yet</div>
                    <p className="text-[11px] text-marble/70">
                      We didn't detect an active account for <span className="font-mono text-white">{user?.email}</span> in our Zulip roster.
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
                  <span className="text-[10px] text-amber-400 font-medium">Click below to create or join using your Google Account</span>
                  <a
                    href={zulipLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-1.5 bg-ares-gold text-obsidian font-black text-[10px] uppercase tracking-wider rounded hover:bg-white transition-colors"
                  >
                    Self-Join Now
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Quick Onboarding Steps */}
          <div className="bg-obsidian-dark border border-white/10 p-6 ares-cut-md space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-white font-heading flex items-center gap-2">
              <Sparkles size={16} className="text-ares-gold" /> How To Join in 3 Quick Steps
            </h3>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 bg-white/5 rounded border border-white/5">
                <div className="w-7 h-7 rounded bg-ares-gold/10 border border-ares-gold/30 text-ares-gold text-xs font-black flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white">Click "Join Zulip Workspace"</div>
                  <p className="text-[11px] text-marble/70">
                    Open our team invite portal by clicking the red button above or using <span className="text-ares-gold font-mono">{zulipLink}</span>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 bg-white/5 rounded border border-white/5">
                <div className="w-7 h-7 rounded bg-ares-gold/10 border border-ares-gold/30 text-ares-gold text-xs font-black flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white">Authenticate with Google</div>
                  <p className="text-[11px] text-marble/70">
                    Sign in with your team email (<span className="text-white font-mono">{user?.email || "your-email@gmail.com"}</span>) so your portal permissions sync automatically.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 bg-white/5 rounded border border-white/5">
                <div className="w-7 h-7 rounded bg-ares-gold/10 border border-ares-gold/30 text-ares-gold text-xs font-black flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white">Download the Apps & Join Streams</div>
                  <p className="text-[11px] text-marble/70">
                    Install Zulip on your phone or computer to get instant push notifications for robotics announcements and subteam task updates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: App Downloads & Admin Config */}
        <div className="space-y-6">
          
          {/* Native App Downloads */}
          <div className="bg-obsidian-dark border border-white/10 p-6 ares-cut-md space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-white font-heading flex items-center gap-2">
              <Smartphone size={16} className="text-ares-gold" /> Download Zulip Apps
            </h3>
            <p className="text-xs text-marble/70">
              Stay connected during build season and competitions with real-time push alerts.
            </p>

            <div className="space-y-2 pt-2">
              <a
                href="https://zulip.com/apps/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded flex items-center justify-between text-xs font-bold text-white transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Smartphone size={18} className="text-ares-gold" />
                  <span>iOS & Android Apps</span>
                </div>
                <ExternalLink size={14} className="text-marble/40 group-hover:text-white transition-colors" />
              </a>

              <a
                href="https://zulip.com/apps/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded flex items-center justify-between text-xs font-bold text-white transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Monitor size={18} className="text-ares-cyan" />
                  <span>Mac, Windows & Linux</span>
                </div>
                <ExternalLink size={14} className="text-marble/40 group-hover:text-white transition-colors" />
              </a>
            </div>
          </div>

          {/* Admin Configuration Card */}
          {isAdmin && (
            <div className="bg-obsidian-dark border border-ares-gold/30 p-6 ares-cut-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-ares-gold font-heading flex items-center gap-2">
                  <Settings size={16} /> Admin Link Config
                </h3>
                <button
                  onClick={() => setEditingLink(!editingLink)}
                  className="text-[10px] font-bold text-marble/70 hover:text-white uppercase underline"
                >
                  {editingLink ? "Cancel" : "Change Link"}
                </button>
              </div>

              <p className="text-xs text-marble/70">
                To update the team's reusable invite link, copy a new invitation URL from <span className="text-white font-mono">Zulip Settings → Invite Users</span> and paste it below.
              </p>

              {editingLink ? (
                <div className="space-y-3 pt-2">
                  <input
                    type="url"
                    value={newLinkInput}
                    onChange={(e) => setNewLinkInput(e.target.value)}
                    placeholder="https://aresfirst.zulipchat.com/join/..."
                    className="w-full px-3 py-2 bg-obsidian border border-white/20 rounded text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold font-mono"
                  />
                  <button
                    onClick={handleSaveInviteLink}
                    disabled={savingLink}
                    className="w-full py-2 bg-ares-gold hover:bg-white text-obsidian font-black text-xs uppercase tracking-wider rounded transition-colors disabled:opacity-50"
                  >
                    {savingLink ? "Saving..." : "Save Invite Link"}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-white/5 rounded border border-white/5 space-y-1">
                  <div className="text-[10px] text-marble/50 uppercase font-black">Active Team Invite URL:</div>
                  <div className="text-xs text-ares-gold font-mono truncate">{zulipLink}</div>
                </div>
              )}
            </div>
          )}

          {/* FAQ Card */}
          <div className="bg-obsidian-dark border border-white/10 p-6 ares-cut-md space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white font-heading flex items-center gap-2">
              <HelpCircle size={14} className="text-ares-gold" /> Need Help?
            </h3>
            <p className="text-[11px] text-marble/70 leading-relaxed">
              If your email does not recognize your account or you need administrator access, contact a team coach or mentor in person or email <span className="text-white font-mono">contact@aresfirst.org</span>.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
