import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Shield, Trash2, ChevronDown, Edit3, X } from "lucide-react";
import ProfileEditor from "./ProfileEditor";

interface UserRow {
  id: string;
  name: string;
  email: string;
  image: string;
  role: string;
  member_type?: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  createdAt: string;
}

const ROLES = ["unverified", "user", "author", "admin"];
const MEMBER_TYPES = ["student", "alumni", "parent", "coach", "mentor", "sponsor"];

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as Record<string, unknown>;
          throw new Error((body.error as string) || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        setUsers((data as { users: UserRow[] }).users || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load users.");
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const changeRole = async (userId: string, newRole: string) => {
    await fetch(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: newRole }),
    });
    fetchUsers();
  };

  const changeMemberType = async (userId: string, newType: string) => {
    await fetch(`/api/admin/users/${userId}/member_type`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ member_type: newType }),
    });
    fetchUsers();
  };

  const removeUser = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return;
    await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    fetchUsers();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;
  }

  if (error) {
    return <div className="text-red-400 text-center py-10">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
          <Shield size={20} className="text-ares-red" /> User Management
        </h2>
        <span className="text-white/40 text-sm font-bold">{users.length} registered</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 text-[10px] font-bold text-white/40 uppercase tracking-wider">
              <th className="text-left py-3 px-2">User</th>
              <th className="text-left py-3 px-2">Email</th>
              <th className="text-left py-3 px-2">Role</th>
              <th className="text-left py-3 px-2">Type</th>
              <th className="text-left py-3 px-2">Joined</th>
              <th className="text-right py-3 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                <td className="py-3 px-2">
                  <a href={`/profile/${user.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <img src={user.image || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.id}`}
                      alt="" className="w-8 h-8 ares-cut-sm bg-zinc-800" />
                    <div>
                      <span className="text-sm font-bold text-white block hover:text-ares-red">{user.nickname || user.name || "ARES Member"}</span>
                      {(user.first_name || user.last_name) && (
                        <span className="text-[10px] uppercase tracking-wider text-white/30 block">{[user.first_name, user.last_name].filter(Boolean).join(" ")}</span>
                      )}
                    </div>
                  </a>
                </td>
                <td className="py-3 px-2 text-sm text-white/60">{user.email}</td>
                <td className="py-3 px-2">
                  <div className="relative inline-block">
                    <select
                      value={user.role || "user"}
                      onChange={e => changeRole(user.id, e.target.value)}
                      className={`appearance-none bg-transparent border ares-cut-sm px-3 py-1 pr-7 text-xs font-bold cursor-pointer focus:outline-none ${
                        user.role === "admin" ? "border-ares-red/50 text-ares-red" :
                        user.role === "author" ? "border-ares-gold/50 text-ares-gold" :
                        "border-white/20 text-white/60"
                      }`}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className="relative inline-block">
                    <select
                      value={user.member_type || "student"}
                      onChange={e => changeMemberType(user.id, e.target.value)}
                      className={`appearance-none bg-transparent border ares-cut-sm px-3 py-1 pr-7 text-xs font-bold cursor-pointer focus:outline-none capitalize ${
                        user.member_type === "alumni" ? "border-ares-gold/50 text-ares-gold" :
                        ["parent", "coach", "mentor", "sponsor"].includes(user.member_type || "") ? "border-indigo-500/50 text-indigo-400" :
                        "border-zinc-700 text-zinc-400"
                      }`}
                    >
                      {MEMBER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
                  </div>
                </td>
                <td className="py-3 px-2 text-xs text-white/40">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                <td className="py-3 px-2 text-right">
                  <button onClick={() => setEditUserId(user.id)}
                    title="Edit Member Profile"
                    className="p-2 mr-1 text-white/60 hover:text-ares-gold transition-all ares-cut-sm hover:bg-ares-gold/10 hover:scale-110">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => removeUser(user.id, user.nickname || user.name || "user")}
                    title="Delete User"
                    className="p-2 text-white/60 hover:text-ares-red transition-all ares-cut-sm hover:bg-ares-red/10 hover:scale-110">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUserId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 sm:p-8 overflow-y-auto">
          <div className="bg-obsidian border border-white/10 ares-cut w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="sticky top-0 right-0 z-10 flex justify-end p-4 pointer-events-none">
              <button 
                onClick={() => setEditUserId(null)} 
                className="p-2 bg-obsidian border border-white/10 ares-cut-sm text-white/40 hover:text-white pointer-events-auto shadow-xl"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pb-6 pt-2">
              <div className="mb-4 pb-4 border-b border-white/10">
                <h3 className="text-xl font-black text-ares-red flex items-center gap-2">
                  <Shield size={20} />
                  Admin Override: Managing Profile
                </h3>
                <p className="text-white/40 text-sm">You are editing another user&apos;s personal profile data.</p>
              </div>
              <ProfileEditor adminEditUserId={editUserId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
