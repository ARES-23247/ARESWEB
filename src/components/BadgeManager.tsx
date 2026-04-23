import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, Plus, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";
import { adminApi } from "../api/adminApi";
import { publicApi } from "../api/publicApi";

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color_theme: string;
  created_at: string;
}

import DashboardPageHeader from "./dashboard/DashboardPageHeader";

export default function BadgeManager() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newBadgeId, setNewBadgeId] = useState("");
  const [newBadgeName, setNewBadgeName] = useState("");
  const [newBadgeDesc, setNewBadgeDesc] = useState("");
  const [newBadgeIcon, setNewBadgeIcon] = useState("Award");
  const [newBadgeColor, setNewBadgeColor] = useState("ares-gold");

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedBadge, setSelectedBadge] = useState<string>("");

  const { data: badgesData, isLoading: badgesLoading, isError: isBadgesError } = useQuery<{ badges: BadgeDef[] }>({
    queryKey: ["admin_badges"],
    queryFn: async () => publicApi.get<{ badges: BadgeDef[] }>("/api/badges")
  });

  const { data: usersData, isError: isUsersError } = useQuery<{ users: Array<{ id: string, name: string, email: string }> }>({
    queryKey: ["admin_users_list"],
    queryFn: async () => adminApi.get<{ users: Array<{ id: string, name: string, email: string }> }>("/api/profile/admin/users")
  });

  const createBadgeMutation = useMutation({
    mutationFn: async () => {
      return adminApi.createBadge({
        id: newBadgeId,
        name: newBadgeName,
        description: newBadgeDesc,
        icon: newBadgeIcon,
        // @ts-expect-error - backend accepts extended props
        color_theme: newBadgeColor
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_badges"] });
      setShowCreate(false);
      setNewBadgeId("");
      setNewBadgeName("");
      setNewBadgeDesc("");
    }
  });

  const awardBadgeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser || !selectedBadge) throw new Error("Select user and badge");
      return adminApi.grantBadge(selectedUser, selectedBadge);
    },
    onSuccess: () => {
      toast.success("Badge awarded successfully!");
      setSelectedUser("");
      setSelectedBadge("");
    },
    onError: (err: Error) => {
      toast.error(`Error awarding badge: ${err.message}`);
    }
  });

  const badges = badgesData?.badges || [];
  const users = usersData?.users || [];

  return (
    <div className="space-y-8">
      <DashboardPageHeader 
        title="Badge Management" 
        subtitle="Define platform-wide awards and distribute them to members."
        icon={<Award className="text-ares-gold" />}
      />
      {(isBadgesError || isUsersError) && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize merit records.
        </div>
      )}
      {/* Creation Panel */}
      <div className="bg-ares-gray-dark border border-white/10 ares-cut overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Award className="text-ares-gold" size={24} /> Badge Index
            </h3>
            <p className="text-sm text-white/50 mt-1">Define platform-wide awards and training certifications.</p>
          </div>
          <button 
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-ares-red/10 text-ares-red hover:bg-ares-red hover:text-white transition-all ares-cut-sm text-sm font-bold flex items-center gap-2"
          >
            {showCreate ? <><X size={16}/> Cancel</> : <><Plus size={16} /> New Badge Type</>}
          </button>
        </div>

        {showCreate && (
          <div className="p-6 bg-black/40 border-b border-white/10 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="badge-id" className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">Badge ID (slug)</label>
                <input id="badge-id" type="text" value={newBadgeId} onChange={e => setNewBadgeId(e.target.value)} placeholder="e.g. outreach_mvp" className="w-full bg-ares-gray-dark border border-white/5 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
              </div>
              <div>
                <label htmlFor="badge-name" className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">Display Name</label>
                <input id="badge-name" type="text" value={newBadgeName} onChange={e => setNewBadgeName(e.target.value)} placeholder="Outreach MVP" className="w-full bg-ares-gray-dark border border-white/5 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
              </div>
              <div>
                <label htmlFor="badge-icon" className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">Icon (Lucide Node)</label>
                <input id="badge-icon" type="text" value={newBadgeIcon} onChange={e => setNewBadgeIcon(e.target.value)} placeholder="Award" className="w-full bg-ares-gray-dark border border-white/5 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
              </div>
              <div>
                <label htmlFor="badge-color" className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">Color Theme (CSS)</label>
                <input id="badge-color" type="text" value={newBadgeColor} onChange={e => setNewBadgeColor(e.target.value)} placeholder="ares-gold" className="w-full bg-ares-gray-dark border border-white/5 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
              </div>
            </div>
            <div>
              <label htmlFor="badge-desc" className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">Description</label>
              <input id="badge-desc" type="text" value={newBadgeDesc} onChange={e => setNewBadgeDesc(e.target.value)} placeholder="Awarded to members who attain top 3 in outreach hours." className="w-full bg-ares-gray-dark border border-white/5 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
            </div>
            <button 
              onClick={() => createBadgeMutation.mutate()} 
              disabled={createBadgeMutation.isPending || !newBadgeId || !newBadgeName}
              className="px-6 py-2.5 bg-white text-black font-bold text-sm ares-cut-sm hover:bg-white transition-all disabled:opacity-50"
            >
              {createBadgeMutation.isPending ? "Creating..." : "Save Badge Definition"}
            </button>
          </div>
        )}

        {/* Existing Badges List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-ares-gray-deep">
          {badgesLoading ? (
            <p className="text-white/60 text-sm">Loading badges...</p>
          ) : badges.length === 0 ? (
            <p className="text-white/60 text-sm">No badges defined yet.</p>
          ) : (
            badges.map(b => {
              const IconComp = (LucideIcons as unknown as Record<string, React.ElementType>)[b.icon] || LucideIcons.Award;
              return (
                <div key={b.id} className="bg-ares-gray-dark/50 border border-white/10 ares-cut-sm p-4 flex items-start gap-4">
                  <div className={`p-3 ares-cut-sm bg-obsidian/50 flex-shrink-0 text-${b.color_theme.replace("text-", "")}`}>
                    <IconComp size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{b.name}</h4>
                    <p className="text-xs text-white/60 mt-0.5">{b.description || "No description provided."}</p>
                    <p className="text-xs text-white/20 font-mono mt-2">ID: {b.id}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Grant Panel */}
      <div className="bg-ares-gray-dark border border-white/10 ares-cut p-6 shadow-2xl">
        <h3 className="text-xl font-black text-white flex items-center gap-2 mb-6">
          <UserPlus className="text-ares-red" size={24} /> Manual Badge Grant
        </h3>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="grant-user" className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">Target Member</label>
            <select id="grant-user" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red mt-1">
              <option value="">-- Select Member --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="grant-badge" className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">Select Badge</label>
            <select id="grant-badge" value={selectedBadge} onChange={e => setSelectedBadge(e.target.value)} className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red mt-1">
              <option value="">-- Select Badge --</option>
              {badges.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button 
          onClick={() => awardBadgeMutation.mutate()}
          disabled={!selectedUser || !selectedBadge || awardBadgeMutation.isPending}
          className="mt-6 px-8 py-3 bg-ares-red text-white font-black uppercase tracking-widest ares-cut-sm hover:bg-ares-danger transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {awardBadgeMutation.isPending ? "Processing..." : <><Check size={18} /> Grant Badge to Member</>}
        </button>
      </div>
    </div>
  );
}
