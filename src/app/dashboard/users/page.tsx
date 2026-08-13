"use client";

import { logger } from "@/utils/logger";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { 
  ShieldAlert, 
  RefreshCw, 
  Shield
} from "lucide-react";
import UserRosterTable from "./components/UserRosterTable";
import UserInviteForm from "./components/UserInviteForm";
import UserEmailRosterPanel from "./components/UserEmailRosterPanel";
import {
  UserDirectoryFilters,
  UserDirectoryNotices,
  UserRevocationDialog,
} from "./components/UserDirectoryControls";


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
  zulipAccount: { full_name: string } | null;
  createdAt?: string;
  isDeleted?: boolean;
}

interface AdminUserDirectoryItem {
  id: string;
  email: string;
  role: string;
  name: string;
  isRegistered: boolean;
  avatar: string;
  subteams: string[];
  memberType: string;
  profileExists: boolean;
  zulipLinked: boolean;
  createdAt: string;
  isDeleted: boolean;
}

interface AdminUserDirectoryResponse {
  users: AdminUserDirectoryItem[];
  nextCursor: string | null;
  integrations: {
    zulip: {
      available: boolean;
      diagnostic: string | null;
    };
  };
}

interface ApiErrorBody {
  error?: string;
}

async function readApiError(response: Response): Promise<string> {
  const responseBody = await response.json().catch(() => ({})) as ApiErrorBody;
  return `HTTP ${response.status}: ${responseBody.error || response.statusText}`;
}

export default function DashboardUsersPage() {
  const { user, authorizedUser } = useAuth();
  const [usersList, setUsersList] = useState<UserAuth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const [pendingRevocation, setPendingRevocation] = useState<UserAuth | null>(null);



  // Edit States
  const [savingRoles, setSavingRoles] = useState<Record<string, boolean>>({});
  const [editedRoles, setEditedRoles] = useState<Record<string, string>>({});
  const [editedMemberTypes, setEditedMemberTypes] = useState<Record<string, string>>({});

  // Zulip states
  const [creatingZulip, setCreatingZulip] = useState<Record<string, boolean>>({});
  const [zulipWarning, setZulipWarning] = useState<string | null>(null);

  const userRole = authorizedUser?.role || "Pending Verification";
  const isAdmin = userRole === "admin" || userRole === "coach";

  const loadUsersPage = useCallback(async (cursor: string | null, synchronize: boolean) => {
    if (!user || !isAdmin) return;
    const isAdditionalPage = Boolean(cursor);
    if (isAdditionalPage) setIsLoadingMore(true);
    else setIsLoading(true);
    setError(null);
    if (!isAdditionalPage) setZulipWarning(null);
    try {
      let synchronizationWarning: string | null = null;
      if (synchronize) {
        try {
          const syncResponse = await authenticatedFetch("/api/profiles/admin/users", { method: "POST" });
          if (!syncResponse.ok) {
            synchronizationWarning = `User synchronization failed; the confirmed roster is still available. ${await readApiError(syncResponse)}`;
          }
        } catch (syncError: unknown) {
          synchronizationWarning = `User synchronization failed; the confirmed roster is still available. ${syncError instanceof Error ? syncError.message : String(syncError)}`;
        }
      }

      const params = new URLSearchParams({ limit: "50" });
      if (cursor) params.set("cursor", cursor);
      const response = await authenticatedFetch(`/api/profiles/admin/users/list?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const payload = await response.json() as AdminUserDirectoryResponse;
      if (!Array.isArray(payload.users) || !payload.integrations?.zulip) {
        throw new Error("HTTP 502: The user directory returned an invalid response.");
      }
      const pageUsers: UserAuth[] = payload.users.map(directoryUser => ({
        ...directoryUser,
        zulipAccount: directoryUser.zulipLinked ? { full_name: "Linked" } : null,
      }));

      setUsersList(previousUsers => {
        if (!cursor) return pageUsers;
        const combinedUsers = new Map(previousUsers.map(existingUser => [existingUser.id, existingUser]));
        pageUsers.forEach(nextUser => combinedUsers.set(nextUser.id, nextUser));
        return Array.from(combinedUsers.values());
      });
      setNextCursor(payload.nextCursor);
      setZulipWarning(payload.integrations.zulip.available ? null : payload.integrations.zulip.diagnostic);
      if (synchronizationWarning) setError(synchronizationWarning);

      // Initialize edited roles & memberTypes states
      const initialRoles: Record<string, string> = {};
      const initialMemberTypes: Record<string, string> = {};
      pageUsers.forEach(u => {
        initialRoles[u.id] = u.role;
        initialMemberTypes[u.id] = u.memberType || "";
      });
      setEditedRoles(previous => cursor ? { ...previous, ...initialRoles } : initialRoles);
      setEditedMemberTypes(previous => cursor ? { ...previous, ...initialMemberTypes } : initialMemberTypes);

    } catch (err: unknown) {
      logger.error("Error fetching admin users:", err);
      setError(`Could not load the user directory. ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (isAdditionalPage) setIsLoadingMore(false);
      else setIsLoading(false);
    }
  }, [isAdmin, user]);

  const fetchUsersData = useCallback(async () => loadUsersPage(null, true), [loadUsersPage]);

  useEffect(() => {
    void fetchUsersData();
  }, [fetchUsersData]);

  const handleRoleChange = (userId: string, newRole: string) => {
    setEditedRoles(prev => ({
      ...prev,
      [userId]: newRole
    }));
  };

  const handleMemberTypeChange = (userId: string, newMemberType: string) => {
    setEditedMemberTypes(prev => ({
      ...prev,
      [userId]: newMemberType
    }));
  };

  const handleSaveRole = async (userId: string) => {
    const originalUser = usersList.find(u => u.id === userId);
    if (!originalUser || !user) return;

    const targetRole = editedRoles[userId] !== undefined ? editedRoles[userId] : originalUser.role;
    const targetMemberType = editedMemberTypes[userId] !== undefined ? editedMemberTypes[userId] : (originalUser.memberType || "");

    setSavingRoles(prev => ({ ...prev, [userId]: true }));
    setSuccess(null);
    setError(null);

    try {
      const response = await authenticatedFetch(`/api/profiles/admin/users/${encodeURIComponent(userId)}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: targetRole, memberType: targetMemberType }),
      });
      const responseBody = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseBody.error || response.statusText}`);
      }

      setSuccess(`Updated permissions and member type for ${originalUser.name || originalUser.email}`);
      
      // Update local state
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: targetRole, memberType: targetMemberType } : u));
      
      // Automatically attempt Zulip account creation if role is verified and Zulip is not yet linked
      if (targetRole !== "unverified" && !originalUser.zulipAccount) {
        setTimeout(() => {
          handleCreateZulip(userId);
        }, 500);
      } else {
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: unknown) {
      logger.error("Error updating user role:", err);
      setError(`Failed to update permissions: ${err instanceof Error ? err.message : String(err)}`);
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
      const res = await authenticatedFetch(
        `/api/zulip/admin/users/${encodeURIComponent(userId)}/provision`,
        { method: "POST" },
      );

      const data = await res.json().catch(() => ({})) as ApiErrorBody;
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${data.error || res.statusText}`);
      }

      setSuccess(`Zulip account provisioned successfully for ${targetUser.name}`);
      
      // Refresh user data to get updated Zulip linked status
      await fetchUsersData();
      
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      logger.error("Error provisioning Zulip user:", err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("bot requests") || message.includes("administrator") || message.includes("not accept")) {
        setError("Zulip did not accept the automated invitation. Ask a team administrator for the current approved join link.");
      } else {
        setError(`Zulip account creation failed: ${message}`);
      }
    } finally {
      setCreatingZulip(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleRemoveUser = (userId: string) => {
    const targetUser = usersList.find(u => u.id === userId);
    if (!targetUser || !user) return;
    setPendingRevocation(targetUser);
  };

  const confirmRemoveUser = async () => {
    const targetUser = pendingRevocation;
    if (!targetUser || !user) return;

    setIsLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await authenticatedFetch(`/api/profiles/admin/users/${encodeURIComponent(targetUser.id)}`, {
        method: "DELETE",
      });
      const responseBody = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseBody.error || response.statusText}`);
      }

      setPendingRevocation(null);
      setSuccess(`Access revoked for ${targetUser.name || targetUser.email}. Their profile was archived and can be restored.`);
      await fetchUsersData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      logger.error("Error removing user:", err);
      setError(`Failed to revoke user access: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
    }
  };

  const handleRestoreUser = async (userId: string) => {
    const targetUser = usersList.find(u => u.id === userId);
    if (!targetUser || !user) return;
    setSavingRoles(prev => ({ ...prev, [userId]: true }));
    setSuccess(null);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/profiles/admin/users/${encodeURIComponent(userId)}/restore`, {
        method: "PATCH",
      });
      const responseBody = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseBody.error || response.statusText}`);
      }
      setSuccess(`Access restored for ${targetUser.name || targetUser.email}.`);
      await fetchUsersData();
    } catch (err: unknown) {
      setError(`Failed to restore user access: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingRoles(prev => ({ ...prev, [userId]: false }));
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

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === "name_asc") {
      return (a.name || a.email).localeCompare(b.name || b.email);
    }
    if (sortBy === "name_desc") {
      return (b.name || b.email).localeCompare(a.name || a.email);
    }
    if (sortBy === "role") {
      const priority: Record<string, number> = { admin: 1, mentor: 2, member: 3, unverified: 4 };
      const pA = priority[a.role] || 99;
      const pB = priority[b.role] || 99;
      return pA - pB;
    }
    if (sortBy === "status") {
      return (b.isRegistered ? 1 : 0) - (a.isRegistered ? 1 : 0);
    }
    if (sortBy === "newest") {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    }
    if (sortBy === "oldest") {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
      return dateA - dateB;
    }
    return 0;
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
          You do not have the required credentials to access the ARES User Management console. Please contact a team administrator if you need your permissions elevated.
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
          type="button"
          onClick={fetchUsersData}
          disabled={isLoading}
          aria-busy={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer w-fit font-bold disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh List
        </button>
      </header>

      <UserDirectoryNotices
        success={success}
        error={error}
        zulipWarning={zulipWarning}
        pendingCount={usersList.filter((directoryUser) => directoryUser.role === "unverified").length}
        onViewPending={() => setRoleFilter("unverified")}
      />

      {/* Grid Layout: Left Column = Users List; Right Column = Invite Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Users Area */}
        <div className="lg:col-span-2 space-y-6">
          
          <UserDirectoryFilters
            searchQuery={searchQuery}
            roleFilter={roleFilter}
            statusFilter={statusFilter}
            sortBy={sortBy}
            onSearchChange={setSearchQuery}
            onRoleChange={setRoleFilter}
            onStatusChange={setStatusFilter}
            onSortChange={setSortBy}
          />

          {/* Users List Cards */}
          <UserRosterTable
            filteredUsers={sortedUsers}
            isLoading={isLoading && usersList.length === 0}
            editedRoles={editedRoles}
            editedMemberTypes={editedMemberTypes}
            savingRoles={savingRoles}
            creatingZulip={creatingZulip}
            onRoleChange={handleRoleChange}
            onMemberTypeChange={handleMemberTypeChange}
            onSaveRole={handleSaveRole}
            onCreateZulip={handleCreateZulip}
            onRemoveUser={handleRemoveUser}
            onRestoreUser={handleRestoreUser}
          />

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void loadUsersPage(nextCursor, false)}
                disabled={isLoadingMore}
                aria-busy={isLoadingMore}
                className="inline-flex items-center gap-2 rounded border border-ares-gold/40 bg-ares-gold/10 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-ares-gold transition-colors hover:bg-ares-gold/20 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <RefreshCw aria-hidden="true" size={14} className={isLoadingMore ? "animate-spin" : ""} />
                {isLoadingMore ? "Loading users..." : "Load more users"}
              </button>
            </div>
          )}

        </div>

        {/* Right Column: Invite Form */}
        <div className="space-y-6">
          <UserInviteForm
            usersList={usersList}
            fetchUsersData={fetchUsersData}
            setSuccess={setSuccess}
            setError={setError}
          />
          <UserEmailRosterPanel />
        </div>

      </div>

      <UserRevocationDialog
        target={pendingRevocation}
        onOpenChange={(open) => !open && setPendingRevocation(null)}
        onConfirm={() => void confirmRemoveUser()}
      />
    </div>
  );
}
