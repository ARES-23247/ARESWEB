import React from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  RefreshCw, 
  Mail, 
  Sparkles, 
  Save, 
  Trash2 
} from "lucide-react";

export interface UserAuth {
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

interface UserRosterTableProps {
  filteredUsers: UserAuth[];
  isLoading: boolean;
  editedRoles: Record<string, string>;
  savingRoles: Record<string, boolean>;
  creatingZulip: Record<string, boolean>;
  onRoleChange: (userId: string, newRole: string) => void;
  onSaveRole: (userId: string) => void;
  onCreateZulip: (userId: string) => void;
  onRemoveUser: (userId: string) => void;
}

export default function UserRosterTable({
  filteredUsers,
  isLoading,
  editedRoles,
  savingRoles,
  creatingZulip,
  onRoleChange,
  onSaveRole,
  onCreateZulip,
  onRemoveUser,
}: UserRosterTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass-card ares-cut border border-white/5">
        <RefreshCw size={24} className="animate-spin text-ares-gold mb-4" />
        <span className="text-xs uppercase tracking-widest text-marble/60 font-bold">
          Querying Roster Database...
        </span>
      </div>
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="text-center p-20 glass-card ares-cut border border-white/5">
        <Users size={32} className="text-marble/25 mx-auto mb-4" />
        <p className="text-marble/70 text-sm font-semibold uppercase tracking-wider">
          No matching users found
        </p>
        <p className="text-marble/45 text-xs mt-1">
          Refine your search queries or invite a new member.
        </p>
      </div>
    );
  }

  return (
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
                    <span className="px-1.5 py-0.5 bg-ares-success/15 border border-ares-success/30 text-ares-success rounded text-[9px] font-black uppercase tracking-wider animate-none">
                      Registered
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-marble/50 rounded text-[9px] font-black uppercase tracking-wider animate-none">
                      Invited
                    </span>
                  )}

                  {/* MemberType badge */}
                  {u.memberType && (
                    <span className="px-1.5 py-0.5 bg-ares-cyan/15 border border-ares-cyan/30 text-ares-cyan rounded text-[9px] font-black uppercase tracking-wider animate-none">
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
            <div className="flex flex-col md:flex-row md:items-center gap-4 shrink-0 text-left">
              
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
                    onClick={() => onCreateZulip(u.id)}
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
                    onChange={(e) => onRoleChange(u.id, e.target.value)}
                    className="bg-obsidian border border-white/10 ares-cut-sm px-2.5 py-1.5 text-xs text-white cursor-pointer font-bold focus:outline-none w-32"
                  >
                    <option value="admin">Admin</option>
                    <option value="coach">Coach</option>
                    <option value="mentor">Mentor</option>
                    <option value="member">Member</option>
                    <option value="unverified">Unverified</option>
                  </select>
                  
                  {/* Save role button */}
                  {isRoleEdited && (
                    <button
                      onClick={() => onSaveRole(u.id)}
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
                onClick={() => onRemoveUser(u.id)}
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
  );
}
