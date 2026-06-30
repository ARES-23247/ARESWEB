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
  deleteDoc,
  query,
  limit 
} from "firebase/firestore";
import { 
  Users, 
  ShieldAlert, 
  Search, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  UserCheck, 
  Shield
} from "lucide-react";
import UserRosterTable from "./components/UserRosterTable";
import UserInviteForm from "./components/UserInviteForm";


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



  // Edit States
  const [savingRoles, setSavingRoles] = useState<Record<string, boolean>>({});
  const [editedRoles, setEditedRoles] = useState<Record<string, string>>({});

  // Zulip states
  const [creatingZulip, setCreatingZulip] = useState<Record<string, boolean>>({});
  const [zulipWarning, setZulipWarning] = useState<string | null>(null);

  const userRole = authorizedUser?.role || "Pending Verification";
  const isAdmin = userRole === "admin" || userRole === "coach";

  const fetchUsersData = async () => {
    if (!user || !isAdmin) return;
    setIsLoading(true);
    setError(null);
    setZulipWarning(null);
    try {
      // 1. Fetch authorized_users from Firestore
      const authSnap = await getDocs(query(collection(db, "authorized_users"), limit(50)));
      
      // 2. Fetch user_profiles from Firestore
      const profilesSnap = await getDocs(query(collection(db, "user_profiles"), limit(50)));
      
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
          <UserRosterTable
            filteredUsers={filteredUsers}
            isLoading={isLoading}
            editedRoles={editedRoles}
            savingRoles={savingRoles}
            creatingZulip={creatingZulip}
            onRoleChange={handleRoleChange}
            onSaveRole={handleSaveRole}
            onCreateZulip={handleCreateZulip}
            onRemoveUser={handleRemoveUser}
          />

        </div>

        {/* Right Column: Invite Form */}
        <div className="space-y-6">
          <UserInviteForm
            usersList={usersList}
            fetchUsersData={fetchUsersData}
            setSuccess={setSuccess}
            setError={setError}
          />
        </div>

      </div>
    </div>
  );
}
