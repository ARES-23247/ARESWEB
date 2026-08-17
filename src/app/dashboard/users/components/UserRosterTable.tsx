import React from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  RefreshCw, 
  Mail, 
  Save, 
  Trash2,
  RotateCcw,
  UserRound,
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
  zulipAccount: { full_name?: string } | null;
  isDeleted?: boolean;
}

interface UserRosterTableProps {
  filteredUsers: UserAuth[];
  isLoading: boolean;
  editedRoles: Record<string, string>;
  editedMemberTypes: Record<string, string>;
  savingRoles: Record<string, boolean>;
  onRoleChange: (userId: string, newRole: string) => void;
  onMemberTypeChange: (userId: string, newType: string) => void;
  onSaveRole: (userId: string) => void;
  onRemoveUser: (userId: string) => void;
  onRestoreUser?: (userId: string) => void;
}

export default function UserRosterTable({
  filteredUsers,
  isLoading,
  editedRoles,
  editedMemberTypes,
  savingRoles,
  onRoleChange,
  onMemberTypeChange,
  onSaveRole,
  onRemoveUser,
  onRestoreUser,
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
        const memberTypeId = `member-type-${u.id}`;
        const portalRoleId = `portal-role-${u.id}`;
        const currentRole = editedRoles[u.id] !== undefined ? editedRoles[u.id] : u.role;
        const currentMemberType = editedMemberTypes[u.id] !== undefined ? editedMemberTypes[u.id] : (u.memberType || "");
        const isRoleEdited = editedRoles[u.id] !== undefined && editedRoles[u.id] !== u.role;
        const isMemberTypeEdited = editedMemberTypes[u.id] !== undefined && editedMemberTypes[u.id] !== (u.memberType || "");
        const isEdited = isRoleEdited || isMemberTypeEdited;

        const isSaving = savingRoles[u.id];

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
                {u.avatar ? (
                  <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserRound aria-hidden="true" className="text-marble/55" size={22} />
                )}
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
                  {u.isDeleted && (
                    <span className="px-1.5 py-0.5 bg-ares-red/15 border border-ares-red/30 text-ares-red rounded text-[9px] font-black uppercase tracking-wider">
                      Access revoked
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
                  <span className="text-[10px] text-marble/45">Use the team invite link</span>
                )}
              </div>

              {/* Member Type Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={memberTypeId} className="text-[9px] font-black text-marble/40 uppercase tracking-widest">Member Type</label>
                <select
                  id={memberTypeId}
                  value={currentMemberType}
                  disabled={u.isDeleted}
                  onChange={(e) => onMemberTypeChange(u.id, e.target.value)}
                  className="bg-obsidian border border-white/10 ares-cut-sm px-2 py-1.5 text-xs text-white cursor-pointer font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan w-28"
                >
                  <option value="">-- None --</option>
                  <option value="student">Student</option>
                  <option value="parent">Parent</option>
                  <option value="mentor">Mentor</option>
                  <option value="alumni">Alumni</option>
                  <option value="sponsor">Sponsor</option>
                </select>
              </div>

              {/* ARES Role Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={portalRoleId} className="text-[9px] font-black text-marble/40 uppercase tracking-widest">Portal Role</label>
                <div className="flex items-center gap-2">
                  <select
                    id={portalRoleId}
                    value={currentRole}
                    disabled={u.isDeleted}
                    onChange={(e) => onRoleChange(u.id, e.target.value)}
                    className="bg-obsidian border border-white/10 ares-cut-sm px-2.5 py-1.5 text-xs text-white cursor-pointer font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan w-32"
                  >
                    <option value="admin">Admin / Coach</option>
                    <option value="mentor">Mentor / Lead</option>
                    <option value="member">Member</option>
                    <option value="unverified">Unverified</option>
                  </select>
                  
                  {/* Save role & memberType button */}
                  {isEdited && (
                    <button
                      onClick={() => onSaveRole(u.id)}
                      disabled={isSaving}
                      aria-label={`Save role and member type changes for ${u.name}`}
                      className="w-8 h-8 flex items-center justify-center bg-ares-cyan/15 hover:bg-ares-cyan/25 border border-ares-cyan/45 rounded cursor-pointer transition-all shrink-0 text-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      title="Save Changes"
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

              {u.isDeleted ? (
                <button
                  onClick={() => onRestoreUser?.(u.id)}
                  aria-label={`Restore roster access for ${u.name}`}
                  className="w-8 h-8 flex items-center justify-center bg-ares-cyan/10 hover:bg-ares-cyan/20 border border-ares-cyan/30 text-ares-cyan rounded cursor-pointer transition-all shrink-0 self-end md:self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  title="Restore Roster Access"
                >
                  <RotateCcw aria-hidden="true" size={14} />
                </button>
              ) : (
                <button
                  onClick={() => onRemoveUser(u.id)}
                  aria-label={`Revoke roster access for ${u.name}`}
                  className="w-8 h-8 flex items-center justify-center bg-ares-red/10 hover:bg-ares-red/20 border border-ares-red/20 hover:border-ares-red/40 text-ares-red rounded cursor-pointer transition-all shrink-0 self-end md:self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  title="Revoke Roster Access"
                >
                  <Trash2 aria-hidden="true" size={14} />
                </button>
              )}
            </div>

          </motion.div>
        );
      })}
    </div>
  );
}
