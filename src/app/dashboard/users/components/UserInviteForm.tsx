import React, { useState } from "react";
import { Plus, RefreshCw, UserCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

interface UserAuth {
  id: string;
  email: string;
  role: string;
  name: string;
  isRegistered: boolean;
  avatar: string;
  subteams: string[];
  memberType: string;
  profileExists: boolean;
  zulipAccount: any | null;
}

interface UserInviteFormProps {
  usersList: UserAuth[];
  fetchUsersData: () => Promise<void>;
  setSuccess: (msg: string | null) => void;
  setError: (msg: string | null) => void;
}

export default function UserInviteForm({
  usersList,
  fetchUsersData,
  setSuccess,
  setError
}: UserInviteFormProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [createZulipCheckbox, setCreateZulipCheckbox] = useState(false);
  const [inviting, setInviting] = useState(false);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    setSuccess(null);
    setError(null);

    const emailClean = inviteEmail.trim().toLowerCase();
    const nameClean = inviteName.trim() || emailClean.split("@")[0];

    try {
      // 1. Check if email is already authorized
      const alreadyAuthorized = usersList.some(u => u.email.toLowerCase().trim() === emailClean);
      if (alreadyAuthorized) {
        throw new Error("A user with this email address is already authorized.");
      }

      // 2. Create authorized_users record
      const newAuthRef = doc(collection(db, "authorized_users"));
      await setDoc(newAuthRef, {
        email: emailClean,
        name: nameClean,
        role: inviteRole
      });

      let zulipMsg = "";
      // 3. Optionally provision Zulip
      if (createZulipCheckbox) {
        try {
          const res = await authenticatedFetch("/api/profiles/zulip/users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: emailClean,
              fullName: nameClean
            })
          });

          if (!res.ok) {
            const data = await res.json();
            zulipMsg = ` (However, Zulip account creation failed: ${data.error || "server error"})`;
          } else {
            zulipMsg = " and their Zulip account has been provisioned";
          }
        } catch (zErr: any) {
          console.error("Error inviting Zulip account:", zErr);
          zulipMsg = ` (However, Zulip account creation failed: ${zErr.message || "network error"})`;
        }
      }

      setSuccess(`Successfully authorized ${emailClean}${zulipMsg}.`);
      setInviteEmail("");
      setInviteName("");
      setCreateZulipCheckbox(false);
      
      await fetchUsersData();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error("Error inviting user:", err);
      setError(err.message || "Failed to authorize user.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="glass-card ares-cut p-6 border border-white/5 bg-black/25">
      <h3 className="text-lg font-black uppercase text-white font-heading tracking-tight mb-1.5 flex items-center gap-2">
        <Plus size={18} className="text-ares-gold" /> Authorize Member
      </h3>
      <p className="text-xs text-marble/60 font-medium mb-6">
        Enter an email and name to pre-authorize access. The invitee will bypass verification automatically when they log in using this email.
      </p>

      <form onSubmit={handleInviteUser} className="space-y-5">
        
        {/* Email Address */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-black tracking-widest text-ares-gold">
            Email Address
          </label>
          <input
            type="email"
            required
            placeholder="name@domain.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-2.5 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
          />
        </div>

        {/* Name / Nickname */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-black tracking-widest text-ares-gold">
            Full Name / Nickname
          </label>
          <input
            type="text"
            placeholder="e.g. Coach David"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-2.5 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
          />
        </div>

        {/* Role Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-black tracking-widest text-ares-gold">
            Portal Permissions / Role
          </label>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-2.5 text-xs text-white cursor-pointer font-bold focus:outline-none font-sans"
          >
            <option value="member">Member (Standard Roster)</option>
            <option value="mentor">Mentor (Senior Advisor)</option>
            <option value="coach">Coach (Team Director)</option>
            <option value="admin">Admin (Full System Control)</option>
            <option value="unverified">Unverified (Pending Verification)</option>
          </select>
        </div>

        {/* Zulip Account Provisioning Checkbox */}
        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="createZulipCheckbox"
            checked={createZulipCheckbox}
            onChange={(e) => setCreateZulipCheckbox(e.target.checked)}
            className="w-4 h-4 bg-obsidian border border-white/10 rounded focus:ring-0 cursor-pointer"
          />
          <label 
            htmlFor="createZulipCheckbox" 
            className="text-xs font-semibold text-marble/75 hover:text-white cursor-pointer select-none"
          >
            Provision Zulip account now
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={inviting || !inviteEmail.trim()}
          className="w-full clipped-button bg-ares-red text-white uppercase text-xs font-black tracking-widest py-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {inviting ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <UserCheck size={14} />
          )}
          <span>Authorize & Invite Member</span>
        </button>

      </form>
    </div>
  );
}
