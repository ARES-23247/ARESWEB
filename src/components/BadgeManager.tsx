
import { createElement, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Award, Plus, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";
import { getLucideIcon } from "../types/components";
import { useGetBadges, useCreateBadge, useDeleteBadge, useGrantBadge, useGetUsersForBadges } from "../api/badges";
import { ClickToDeleteButton } from "./ContentManager/shared";

import DashboardPageHeader from "./dashboard/DashboardPageHeader";

interface BadgeRecord { id: string; name: string; description?: string | null; icon: string; colorTheme: string; }
interface UserRecord { id: string; name?: string | null; nickname?: string | null; email: string; }

interface BadgeItemProps {
  badge: BadgeRecord;
}

function BadgeItem({ badge: b }: BadgeItemProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const deleteBadgeMutation = useDeleteBadge();
  const isPending = deleteBadgeMutation.isPending;
  const iconRef = getLucideIcon(b.icon);

  return (
    <div className={`bg-black/40 border border-white/5 ares-cut-sm p-5 flex items-start gap-5 transition-all relative overflow-hidden group hover:border-white/10 ${isPending ? "opacity-50 grayscale bg-ares-red/5" : ""}`}>
      <div className="absolute top-0 left-0 w-1 h-0 bg-ares-gold group-hover:h-full transition-all duration-500"></div>
      <div className={`p-4 ares-cut-sm bg-obsidian/80 flex-shrink-0 text-${b.colorTheme.replace("text-", "")} border border-white/5 shadow-inner`}>
        {createElement(iconRef as React.ElementType, { size: 28 })}
      </div>
      <div className="flex-1">
        <h4 className="text-white font-black uppercase tracking-wider text-sm">{b.name}</h4>
        <p className="text-[10px] text-marble/40 font-black uppercase tracking-widest mt-1 italic">{b.description || "NO_DATA_DESCRIPTION_MISSING"}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[8px] font-black bg-white/5 text-white/20 px-2 py-0.5 ares-cut-sm uppercase tracking-[0.2em]">NODE_ID: {b.id}</span>
        </div>
      </div>
      <div className="flex-shrink-0 self-start">
        <ClickToDeleteButton 
          id={`badge-def-${b.id}`}
          onDelete={() => deleteBadgeMutation.mutate(b.id, {
            onSuccess: () => toast.success("Badge definition deleted.")
          })}
          isDeleting={isPending}
          confirmId={confirmId}
          setConfirmId={setConfirmId}
        />
      </div>
    </div>
  );
}

export default function BadgeManager() {
  const _queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newBadgeId, setNewBadgeId] = useState("");
  const [newBadgeName, setNewBadgeName] = useState("");
  const [newBadgeDesc, setNewBadgeDesc] = useState("");
  const [newBadgeIcon, setNewBadgeIcon] = useState("Award");
  const [newBadgeColor, setNewBadgeColor] = useState("ares-gold");

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedBadge, setSelectedBadge] = useState<string>("");

  const { data: badgesData, isLoading: badgesLoading, isError: isBadgesError } = useGetBadges();

  const { data: usersData, isError: isUsersError } = useGetUsersForBadges();

  const createBadgeMutation = useCreateBadge({
    onSuccess: () => {
      toast.success("Badge definition created.");
      setShowCreate(false);
      setNewBadgeId("");
      setNewBadgeName("");
      setNewBadgeDesc("");
    },
    onError: (err: unknown) => toastApiError(err, "Failed to create badge.")
  });

  const awardBadgeMutation = useGrantBadge({
    onSuccess: () => {
      toast.success("Badge awarded successfully!");
      setSelectedUser("");
      setSelectedBadge("");
    },
    onError: (err: unknown) => {
      toastApiError(err, "Error awarding badge");
    }
  });

  const badges = useMemo(() => badgesData?.badges || [], [badgesData]);
  const users = useMemo(() => usersData?.users || [], [usersData]);

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
      <div className="bg-black/40 border border-white/5 ares-cut-lg overflow-hidden backdrop-blur-sm relative group">
        <div className="absolute top-0 left-0 w-1 h-0 bg-ares-gold group-hover:h-full transition-all duration-700"></div>
        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
              <Award className="text-ares-gold" size={28} /> MERIT_INDEX
            </h3>
            <p className="text-[10px] font-black text-marble/20 uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
              <span className="w-6 h-px bg-white/10"></span>
              Define platform-wide awards and training certifications.
            </p>
          </div>
          <button 
            onClick={() => setShowCreate(!showCreate)}
            className={`px-6 py-3 ares-cut-sm text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 border shadow-lg ${showCreate ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' : 'bg-ares-red/10 text-ares-red border-ares-red/30 hover:bg-ares-red hover:text-white shadow-ares-red/10'}`}
          >
            {showCreate ? <><X size={16}/> ABORT_OPERATION</> : <><Plus size={16} /> INITIALIZE_NEW_TYPE</>}
          </button>
        </div>

        {showCreate && (
          <div className="p-8 bg-white/5 border-b border-white/5 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label htmlFor="badge-id" className="text-[10px] font-black text-marble/40 uppercase tracking-[0.2em] block">NODE_IDENTIFIER</label>
                <input id="badge-id" type="text" value={newBadgeId} onChange={e => setNewBadgeId(e.target.value)} placeholder="E.G. OUTREACH_MVP" className="w-full bg-black/40 border border-white/10 ares-cut-sm px-5 py-3 text-white focus:outline-none focus:border-ares-gold text-xs font-black uppercase tracking-widest placeholder:text-white/10" />
              </div>
              <div className="space-y-2">
                <label htmlFor="badge-name" className="text-[10px] font-black text-marble/40 uppercase tracking-[0.2em] block">DISPLAY_NAME</label>
                <input id="badge-name" type="text" value={newBadgeName} onChange={e => setNewBadgeName(e.target.value)} placeholder="OUTREACH MVP" className="w-full bg-black/40 border border-white/10 ares-cut-sm px-5 py-3 text-white focus:outline-none focus:border-ares-gold text-xs font-black uppercase tracking-widest placeholder:text-white/10" />
              </div>
              <div className="space-y-2">
                <label htmlFor="badge-icon" className="text-[10px] font-black text-marble/40 uppercase tracking-[0.2em] block">SYMBOL_REF (LUCIDE)</label>
                <input id="badge-icon" type="text" value={newBadgeIcon} onChange={e => setNewBadgeIcon(e.target.value)} placeholder="Award" className="w-full bg-black/40 border border-white/10 ares-cut-sm px-5 py-3 text-white focus:outline-none focus:border-ares-gold text-xs font-black uppercase tracking-widest placeholder:text-white/10" />
              </div>
              <div className="space-y-2">
                <label htmlFor="badge-color" className="text-[10px] font-black text-marble/40 uppercase tracking-[0.2em] block">AESTHETIC_SCHEME</label>
                <input id="badge-color" type="text" value={newBadgeColor} onChange={e => setNewBadgeColor(e.target.value)} placeholder="ares-gold" className="w-full bg-black/40 border border-white/10 ares-cut-sm px-5 py-3 text-white focus:outline-none focus:border-ares-gold text-xs font-black uppercase tracking-widest placeholder:text-white/10" />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="badge-desc" className="text-[10px] font-black text-marble/40 uppercase tracking-[0.2em] block">MISSION_OBJECTIVE_DESCRIPTION</label>
              <input id="badge-desc" type="text" value={newBadgeDesc} onChange={e => setNewBadgeDesc(e.target.value)} placeholder="AWARDED TO MEMBERS WHO ATTAIN TOP 3 IN OUTREACH HOURS." className="w-full bg-black/40 border border-white/10 ares-cut-sm px-5 py-3 text-white focus:outline-none focus:border-ares-gold text-xs font-black uppercase tracking-widest placeholder:text-white/10" />
            </div>
            <button 
              onClick={() => createBadgeMutation.mutate({ id: newBadgeId, name: newBadgeName, description: newBadgeDesc, icon: newBadgeIcon, colorTheme: newBadgeColor })} 
              disabled={createBadgeMutation.isPending || !newBadgeId || !newBadgeName}
              className="px-8 py-3 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] ares-cut-sm hover:bg-marble transition-all disabled:opacity-50 shadow-xl shadow-white/5"
            >
              {createBadgeMutation.isPending ? "SYNCHRONIZING..." : "COMMIT_DEFINITION"}
            </button>
          </div>
        )}

        {/* Existing Badges List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8 bg-black/20">
          {badgesLoading ? (
            <p className="text-marble/20 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">SYNCHRONIZING_MERIT_RECORDS...</p>
          ) : badges.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
              <Award size={48} className="text-white/5 mb-4" />
              <p className="text-marble/20 text-[10px] font-black uppercase tracking-[0.4em]">NO_RECORDS_AVAILABLE</p>
            </div>
          ) : (
            badges.map((b: BadgeRecord) => (
              <BadgeItem key={b.id} badge={b} />
            ))
          )}
        </div>
      </div>

      {/* Grant Panel */}
      <div className="bg-black/40 border border-white/5 ares-cut-lg p-8 backdrop-blur-sm relative group overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-0 bg-ares-red group-hover:h-full transition-all duration-700"></div>
        <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3 mb-8">
          <UserPlus className="text-ares-red" size={28} /> OPERATIONAL_GRANT
        </h3>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-2">
            <label htmlFor="grant-user" className="text-[10px] font-black text-marble/40 uppercase tracking-[0.2em] block">TARGET_OPERATIVE</label>
            <select id="grant-user" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full bg-black/60 border border-white/10 ares-cut-sm px-5 py-4 text-white focus:outline-none focus:border-ares-red text-xs font-black uppercase tracking-widest">
              <option value="">-- SELECT_MEMBER --</option>
              {users.map((u: UserRecord) => (
                <option key={u.id} value={u.id}>{`${u.name || u.nickname} // ${u.email}`}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-2">
            <label htmlFor="grant-badge" className="text-[10px] font-black text-marble/40 uppercase tracking-[0.2em] block">ASSIGN_OBJECTIVE</label>
            <select id="grant-badge" value={selectedBadge} onChange={e => setSelectedBadge(e.target.value)} className="w-full bg-black/60 border border-white/10 ares-cut-sm px-5 py-4 text-white focus:outline-none focus:border-ares-red text-xs font-black uppercase tracking-widest">
              <option value="">-- SELECT_TYPE --</option>
              {badges.map((b: BadgeRecord) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button 
          onClick={() => awardBadgeMutation.mutate({ userId: selectedUser, badgeId: selectedBadge })}
          disabled={!selectedUser || !selectedBadge || awardBadgeMutation.isPending}
          className="mt-10 px-10 py-4 bg-ares-red/10 text-ares-red border border-ares-red/30 font-black text-[10px] uppercase tracking-[0.3em] ares-cut-sm hover:bg-ares-red hover:text-white transition-all duration-300 disabled:opacity-50 flex items-center gap-3 shadow-lg shadow-ares-red/5"
        >
          {awardBadgeMutation.isPending ? "PROCESSING_DEPLOYMENT..." : <><Check size={20} /> COMMIT_MERIT_TO_OPERATIVE</>}
        </button>
      </div>
    </div>
  );
}
