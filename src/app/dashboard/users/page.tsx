"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { authenticatedFetch } from "@/lib/api";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc 
} from "firebase/firestore";
import { 
  Users, 
  ShieldAlert, 
  Search, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Mail, 
  UserCheck, 
  Sparkles,
  Shield
} from "lucide-react";
import { motion } from "framer-motion";

interface UserAuth {
  id: string; // Firebase UID or Legacy ID
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

export default function DashboardUsersPage() {
  const { user, authorizedUser } = useAuth();
  const [usersList, setUsersList] = useState<UserAuth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Invite Form States
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [createZulipCheckbox, setCreateZulipCheckbox] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Edit States
  const [savingRoles, setSavingRoles] = useState<Record<string, boolean>>({});
  const [editedRoles, setEditedRoles] = useState<Record<string, string>>({});

  // Zulip states
  const [creatingZulip, setCreatingZulip] = useState<Record<string, boolean>>({});
  const [zulipWarning, setZulipWarning] = useState<string | null>(null);

  const userRole = authorizedUser?.role || "Pending Verification";
  const isAdmin = userRole === "admin";

  const fetchUsersData = async () => {
    if (!user || !isAdmin) return;
    setIsLoading(true);
    setError(null);
    setZulipWarning(null);
    try {
      // 1. Fetch authorized_users from Firestore
      const authSnap = await getDocs(collection(db, "authorized_users"));
      
      // 2. Fetch user_profiles from Firestore
      const profilesSnap = await getDocs(collection(db, "user_profiles"));
      
      // 3. Fetch Zulip users from Functions Backend
      let zulipUsers: any[] = [];
      try {
        const res = await authenticatedFetch("/api/profiles/zulip/users");
        if (res.ok) {
          const data = await res.json();
          zulipUsers = data.users || [];
        } else {
          const data = await res.json().catch(() => ({}));
          console.warn("Zulip fetch not fully active:", data.error || res.status);
          setZulipWarning(data.error || "Zulip integration is not active or configured incorrectly.");
        }
      } catch (zErr) {
        console.error("Error fetching Zulip users:", zErr);
        setZulipWarning("Could not query Zulip workspace members roster.");
      }

      // Map profiles for quick lookup
      const profilesMap: Record<string, any> = {};
      profilesSnap.forEach((doc) => {
        profilesMap[doc.id] = doc.data();
      });

      // Map Zulip users by normalized email
      const zulipMap: Record<string, any> = {};
      zulipUsers.forEach((zUser: any) => {
        if (zUser.email) {
          zulipMap[zUser.email.toLowerCase().trim()] = zUser;
        }
      });

      const combined: Record<string, UserAuth> = {};

      // Process authorized_users
      authSnap.forEach((doc) => {
        const data = doc.data();
        const profile = profilesMap[doc.id] || {};
        const email = data.email || "";
        const normEmail = email.toLowerCase().trim();
        const nickname = profile.nickname || "";
        const firstName = profile.firstName || "";
        const lastName = profile.lastName || "";
        
        let displayName = data.name || nickname || `${firstName} ${lastName}`.trim();
        if (!displayName && email) {
          displayName = email.split("@")[0];
        }
        if (!displayName) displayName = "ARES Member";

        combined[doc.id] = {
          id: doc.id,
          email: email,
          role: data.role || "member",
          name: displayName,
          isRegistered: !!profilesMap[doc.id],
          avatar: profile.avatar || "",
          subteams: profile.subteams || [],
          memberType: profile.memberType || "",
          profileExists: !!profilesMap[doc.id],
          zulipAccount: normEmail ? zulipMap[normEmail] : null
        };
      });

      // Process any profiles that don't have an auth doc (self-healing)
      profilesSnap.forEach((doc) => {
        if (!combined[doc.id]) {
          const profile = doc.data();
          const email = profile.contactEmail || "";
          const normEmail = email.toLowerCase().trim();
          const nickname = profile.nickname || "";
          const firstName = profile.firstName || "";
          const lastName = profile.lastName || "";
          
          let displayName = nickname || `${firstName} ${lastName}`.trim();
          if (!displayName && email) {
            displayName = email.split("@")[0];
          }
          if (!displayName) displayName = "Unverified Member";

          combined[doc.id] = {
            id: doc.id,
            email: email,
            role: "Pending Verification",
            name: displayName,
            isRegistered: true,
            avatar: profile.avatar || "",
            subteams: profile.subteams || [],
            memberType: profile.memberType || "",
            profileExists: true,
            zulipAccount: normEmail ? zulipMap[normEmail] : null
          };
        }
      });

      const finalUsers = Object.values(combined);
      setUsersList(finalUsers);

      // Initialize edited roles state
      const initialRoles: Record<string, string> = {};
      finalUsers.forEach(u => {
        initialRoles[u.id] = u.role;
      });
      setEditedRoles(initialRoles);

    } catch (err: any) {
      console.error("Error fetching admin users:", err);
      setError("Failed to query user collections from Firestore.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, [user]);

  const handleRoleChange = (userId: string, newRole: string) => {
    setEditedRoles(prev => ({
      ...prev,
      [userId]: newRole
    }));
  };

  const handleSaveRole = async (userId: string) => {
    const targetRole = editedRoles[userId];
    const originalUser = usersList.find(u => u.id === userId);
    if (!originalUser || !user) return;

    setSavingRoles(prev => ({ ...prev, [userId]: true }));
    setSuccess(null);
    setError(null);

    try {
      // Update Firestore authorized_users document
      const authRef = doc(db, "authorized_users", userId);
      await setDoc(authRef, {
        role: targetRole
      }, { merge: true });

      setSuccess(`Permissions updated successfully for ${originalUser.name || originalUser.email}`);
      
      // Update local state role
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: targetRole } : u));
      
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error("Error updating user role:", err);
      setError(`Failed to update permissions: ${err.message}`);
    } finally {
      setSavingRoles(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleCreateZulip = async (userId: string) => {
    const targetUser = usersList.find(u => u.id === userId);
    if (!targetUser || !user) return;

    setCreatingZulip(prev => ({ ...prev, [userId]: true }));
    setSuccess(null);
    setError(null);

    try {
      const res = await authenticatedFetch("/api/profiles/zulip/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: targetUser.email,
          fullName: targetUser.name
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create Zulip account");
      }

      setSuccess(`Zulip account provisioned successfully for ${targetUser.name}`);
      
      // Refresh user data to get updated Zulip linked status
      await fetchUsersData();
      
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error("Error creating Zulip user:", err);
      setError(`Zulip account creation failed: ${err.message}`);
    } finally {
      setCreatingZulip(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleRemoveUser = async (userId: string) => {
    const targetUser = usersList.find(u => u.id === userId);
    if (!targetUser || !user) return;

    const confirmMsg = `WARNING: Are you sure you want to revoke access and delete all data for ${targetUser.name || targetUser.email}?\n\nThis will delete their authorized_users entry and delete their user profile permanently.`;
    if (!window.confirm(confirmMsg)) return;

    setIsLoading(true);
    setSuccess(null);
    setError(null);

    try {
      // 1. Delete authorized_users
      await deleteDoc(doc(db, "authorized_users", userId));

      // 2. Delete user_profiles
      if (targetUser.profileExists) {
        await deleteDoc(doc(db, "user_profiles", userId));
      }

      setSuccess(`User ${targetUser.name || targetUser.email} has been completely removed.`);
      await fetchUsersData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error("Error removing user:", err);
      setError(`Failed to revoke user: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !user || inviting) return;

    setInviting(true);
    setSuccess(null);
    setError(null);

    const emailClean = inviteEmail.trim().toLowerCase();
    const nameClean = inviteName.trim() || emailClean.split("@")[0];

    try {
      // 1. Check if email is already in authorized_users list
      const alreadyAuthorized = usersList.some(u => u.email.toLowerCase().trim() === emailClean);
      if (alreadyAuthorized) {
        throw new Error("A user with this email address is already authorized.");
      }

      // 2. Create the authorized_users record (using auto-generated ID)
      const newAuthRef = doc(collection(db, "authorized_users"));
      await setDoc(newAuthRef, {
        email: emailClean,
        name: nameClean,
        role: inviteRole
      });

      let zulipMsg = "";
      // 3. Optionally provision Zulip account
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
      
      // Refresh list
      await fetchUsersData();
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error("Error inviting user:", err);
      setError(err.message || "Failed to authorize user.");
    } finally {
      setInviting(false);
    }
  };

  // Filter & Search Logic
  const filteredUsers = usersList.filter((u) => {
    const emailNorm = u.email ? u.email.toLowerCase() : "";
    const nameNorm = u.name ? u.name.toLowerCase() : "";
    const matchesSearch = 
      emailNorm.includes(searchQuery.toLowerCase()) || 
      nameNorm.includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;

    let matchesStatus = true;
    if (statusFilter === "registered") {
      matchesStatus = u.isRegistered;
    } else if (statusFilter === "invited") {
      matchesStatus = !u.isRegistered;
    } else if (statusFilter === "unlinked_zulip") {
      matchesStatus = !u.zulipAccount;
    }

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Access check
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center text-center p-6 bg-obsidian text-marble">
        <div className="w-16 h-16 bg-ares-red/10 border border-ares-red/40 ares-cut flex items-center justify-center mb-6 text-ares-red">
          <ShieldAlert size={28} className="animate-bounce" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-wider text-white mb-2 font-heading">Access Denied</h1>
        <p className="text-marble/60 text-sm max-w-md">
          You do not have the required credentials to access the ARES User Management console. Please contact Coach David if you need your permissions elevated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Shield size={12} className="text-ares-gold" /> Administrative Controls
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
            User Management
          </h1>
          <p className="text-marble/70 text-sm mt-2 font-medium">
            Manage user roles, authorize team access, and link or provision organization Zulip accounts.
          </p>
        </div>
        <button 
          onClick={fetchUsersData}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer w-fit font-bold"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh List
        </button>
      </header>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-ares-success/10 border border-ares-success/30 text-white rounded flex items-center gap-3 text-sm font-semibold">
          <CheckCircle size={18} className="text-ares-success shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-ares-danger/10 border border-ares-danger/30 text-white rounded flex items-center gap-3 text-sm font-semibold">
          <AlertCircle size={18} className="text-ares-danger-soft shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {zulipWarning && (
        <div className="p-4 bg-ares-gold/10 border border-ares-gold/30 text-white rounded flex items-center gap-3 text-sm font-semibold">
          <AlertCircle size={18} className="text-ares-gold shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-ares-gold uppercase tracking-wider text-xs block mb-1">Zulip API Notice</span>
            <span className="text-marble/80 text-xs">{zulipWarning}</span>
          </div>
        </div>
      )}

      {/* Grid Layout: Left Column = Users List; Right Column = Invite Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Users Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Filters Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 ares-cut border border-white/5">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={14} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm pl-9 pr-4 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
              />
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer w-full md:w-32 focus:outline-none font-bold"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="coach">Coach</option>
                <option value="mentor">Mentor</option>
                <option value="programmer">Programmer</option>
                <option value="member">Member</option>
                <option value="unverified">Unverified</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer w-full md:w-40 focus:outline-none font-bold"
              >
                <option value="all">All Statuses</option>
                <option value="registered">Registered Profile</option>
                <option value="invited">Invited / Legacy</option>
                <option value="unlinked_zulip">Unlinked Zulip</option>
              </select>
            </div>
          </div>

          {/* Users List Cards */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 glass-card ares-cut border border-white/5">
              <RefreshCw size={24} className="animate-spin text-ares-gold mb-4" />
              <span className="text-xs uppercase tracking-widest text-marble/60 font-bold">Querying Roster Database...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center p-20 glass-card ares-cut border border-white/5">
              <Users size={32} className="text-marble/25 mx-auto mb-4" />
              <p className="text-marble/70 text-sm font-semibold uppercase tracking-wider">No matching users found</p>
              <p className="text-marble/45 text-xs mt-1">Refine your search queries or invite a new member.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((u) => {
                const isRoleEdited = editedRoles[u.id] !== u.role;
                const isSaving = savingRoles[u.id];
                const isCreatingZ = creatingZulip[u.id];

                return (
                  <motion.div
                    key={u.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card ares-cut p-5 border border-white/5 bg-black/35 hover:bg-black/50 transition-all flex flex-col md:flex-row justify-between gap-4 md:items-center relative overflow-hidden"
                  >
                    {/* User Metadata */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 ares-cut border border-white/10 bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={u.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${u.id}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-white truncate tracking-tight">{u.name}</span>
                          
                          {/* Registration Type Badge */}
                          {u.isRegistered ? (
                            <span className="px-1.5 py-0.5 bg-ares-success/15 border border-ares-success/30 text-ares-success rounded text-[9px] font-black uppercase tracking-wider">
                              Registered
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-marble/50 rounded text-[9px] font-black uppercase tracking-wider">
                              Invited
                            </span>
                          )}

                          {/* MemberType badge */}
                          {u.memberType && (
                            <span className="px-1.5 py-0.5 bg-ares-cyan/15 border border-ares-cyan/30 text-ares-cyan rounded text-[9px] font-black uppercase tracking-wider">
                              {u.memberType}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-marble/60 font-semibold block truncate mt-1 flex items-center gap-1">
                          <Mail size={12} className="text-marble/35" /> {u.email}
                        </span>
                        
                        {/* Subteams List */}
                        {u.subteams && u.subteams.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {u.subteams.map(t => (
                              <span key={t} className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-white/5 border border-white/5 rounded text-marble/70">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Permissions & Zulip Settings */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4 shrink-0">
                      
                      {/* Zulip Account Status */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-black text-marble/40 uppercase tracking-widest">Zulip Account</span>
                        {u.zulipAccount ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-ares-cyan">
                            <span className="w-1.5 h-1.5 rounded-full bg-ares-cyan animate-pulse"></span>
                            <span className="truncate max-w-[140px]">{u.zulipAccount.full_name}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCreateZulip(u.id)}
                            disabled={isCreatingZ || !u.email}
                            className="w-fit px-2.5 py-1 bg-ares-gold/10 hover:bg-ares-gold/25 border border-ares-gold/30 hover:border-ares-gold/60 text-ares-gold text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCreatingZ ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : (
                              <Sparkles size={10} />
                            )}
                            Provision Zulip
                          </button>
                        )}
                      </div>

                      {/* ARES Role Dropdown */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-black text-marble/40 uppercase tracking-widest">Portal Role</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={editedRoles[u.id] || u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-obsidian border border-white/10 ares-cut-sm px-2.5 py-1.5 text-xs text-white cursor-pointer font-bold focus:outline-none w-32"
                          >
                            <option value="admin">Admin</option>
                            <option value="coach">Coach</option>
                            <option value="mentor">Mentor</option>
                            <option value="programmer">Programmer</option>
                            <option value="member">Member</option>
                            <option value="unverified">Unverified</option>
                          </select>
                          
                          {/* Save role button */}
                          {isRoleEdited && (
                            <button
                              onClick={() => handleSaveRole(u.id)}
                              disabled={isSaving}
                              className="w-8 h-8 flex items-center justify-center bg-ares-success/15 hover:bg-ares-success/25 border border-ares-success/45 rounded cursor-pointer transition-all shrink-0 text-ares-success"
                              title="Save Permissions"
                            >
                              {isSaving ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <Save size={14} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Delete User */}
                      <button
                        onClick={() => handleRemoveUser(u.id)}
                        className="w-8 h-8 flex items-center justify-center bg-ares-danger/10 hover:bg-ares-danger/20 border border-ares-danger/20 hover:border-ares-danger/40 text-ares-danger-soft rounded cursor-pointer transition-all shrink-0 self-end md:self-center"
                        title="Revoke Roster Access"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                  </motion.div>
                );
              })}
            </div>
          )}

        </div>

        {/* Right Column: Invite Form */}
        <div className="space-y-6">
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
                  <option value="programmer">Programmer (Developer Access)</option>
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
        </div>

      </div>
    </div>
  );
}
