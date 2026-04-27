
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Award, Plus, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";
import { api } from "../api/client";
import { ClickToDeleteButton } from "./ContentManager/shared";

import DashboardPageHeader from "./dashboard/DashboardPageHeader";

interface BadgeRecord { id: string; name: string; description?: string | null; icon: string; color_theme: string; }
interface UserRecord { id: string; name?: string | null; nickname?: string | null; email: string; }

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
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: badgesData, isLoading: badgesLoading, isError: isBadgesError } = api.badges.list.useQuery(["admin_badges"], {});

  const { data: usersData, isError: isUsersError } = api.users.getUsers.useQuery(["admin_users_list"], {});

  const createBadgeMutation = api.badges.create.useMutation({
    onSuccess: (res: { status: number }) => {
      if (res.status === 200) {
        toast.success("Badge definition created.");
        queryClient.invalidateQueries({ queryKey: ["admin_badges"] });
        setShowCreate(false);
        setNewBadgeId("");
        setNewBadgeName("");
        setNewBadgeDesc("");
      } else {
        toast.error("Failed to create badge.");
      }
    }
  });

  const awardBadgeMutation = api.badges.grant.useMutation({
    onSuccess: (res: { status: number }) => {
      if (res.status === 200) {
        toast.success("Badge awarded successfully!");
        setSelectedUser("");
        setSelectedBadge("");
      } else {
        toast.error("Failed to award badge.");
      }
    },
    onError: (err: Error) => {
      toast.error(`Error awarding badge: ${err.message}`);
    }
  });

  const deleteBadgeMutation = api.badges.delete.useMutation({
    onSuccess: (res: { status: number }) => {
      if (res.status === 200) {
        toast.success("Badge definition deleted.");
        queryClient.invalidateQueries({ queryKey: ["admin_badges"] });
        setConfirmId(null);
      } else {
        toast.error("Failed to delete badge definition.");
      }
    },
    onError: (err: Error) => {
      toast.error(`Error deleting badge: ${err.message}`);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const revokeBadgeMutation = api.badges.revoke.useMutation({
    onSuccess: (res: { status: number }) => {
      if (res.status === 200) {
        toast.success("Badge revoked successfully.");
        queryClient.invalidateQueries({ queryKey: ["admin_badges"] });
      } else {
        toast.error("Failed to revoke badge.");
      }
    },
    onError: (err: Error) => {
      toast.error(`Error revoking badge: ${err.message}`);
    }
  });

  const badges = useMemo(() => badgesData?.body?.badges || [], [badgesData]);
  const users = useMemo(() => usersData?.body?.users || [], [usersData]);

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
              onClick={() => createBadgeMutation.mutate({ body: { id: newBadgeId, name: newBadgeName, description: newBadgeDesc, icon: newBadgeIcon, color_theme: newBadgeColor } })} 
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
             
            badges.map((b: BadgeRecord) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const IconComp = ((LucideIcons as unknown as Record<string, React.ElementType>)[b.icon] || LucideIcons.Award) as any;
              return (
                <div key={b.id} className="bg-ares-gray-dark/50 border border-white/10 ares-cut-sm p-4 flex items-start gap-4">
                  <div className={`p-3 ares-cut-sm bg-obsidian/50 flex-shrink-0 text-${b.color_theme.replace("text-", "")}`}>
                    <IconComp size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-bold">{b.name}</h4>
                    <p className="text-xs text-white/60 mt-0.5">{b.description || "No description provided."}</p>
                    <p className="text-xs text-white/20 font-mono mt-2">ID: {b.id}</p>
                  </div>
                  <div className="flex-shrink-0 self-start">
                    <ClickToDeleteButton 
                      id={`badge-def-${b.id}`}
                      onDelete={() => deleteBadgeMutation.mutate({ params: { id: b.id }, body: null })}
                      isDeleting={deleteBadgeMutation.isPending && deleteBadgeMutation.variables?.params.id === b.id}
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                    />
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
              { }
              {users.map((u: UserRecord) => (
                <option key={u.id} value={u.id}>{u.name || u.nickname} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="grant-badge" className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">Select Badge</label>
            <select id="grant-badge" value={selectedBadge} onChange={e => setSelectedBadge(e.target.value)} className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red mt-1">
              <option value="">-- Select Badge --</option>
              { }
              {badges.map((b: BadgeRecord) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button 
          onClick={() => awardBadgeMutation.mutate({ body: { userId: selectedUser, badgeId: selectedBadge } })}
          disabled={!selectedUser || !selectedBadge || awardBadgeMutation.isPending}
          className="mt-6 px-8 py-3 bg-ares-red text-white font-black uppercase tracking-widest ares-cut-sm hover:bg-ares-danger transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {awardBadgeMutation.isPending ? "Processing..." : <><Check size={18} /> Grant Badge to Member</>}
        </button>
      </div>
    </div>
  );
}
