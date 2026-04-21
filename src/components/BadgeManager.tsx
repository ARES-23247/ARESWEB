import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, Plus, UserPlus, Check, X } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color_theme: string;
  created_at: string;
}

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

  const { data: badgesData, isLoading: badgesLoading } = useQuery<{ badges: BadgeDef[] }>({
    queryKey: ["admin_badges"],
    queryFn: async () => {
      const res = await fetch("/api/badges");
      if (!res.ok) throw new Error("Failed to fetch badges");
      return res.json();
    }
  });

  const { data: usersData } = useQuery<{ users: Array<{ id: string, name: string, email: string }> }>({
    queryKey: ["admin_users_list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    }
  });

  const createBadgeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newBadgeId,
          name: newBadgeName,
          description: newBadgeDesc,
          icon: newBadgeIcon,
          color_theme: newBadgeColor
        })
      });
      if (!res.ok) throw new Error("Creation failed");
      return res.json();
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
      const res = await fetch(`/api/admin/users/${selectedUser}/badges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badge_id: selectedBadge })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      alert("Badge awarded successfully!");
      setSelectedUser("");
      setSelectedBadge("");
    },
    onError: (err: Error) => {
      alert(`Error awarding badge: ${err.message}`);
    }
  });

  const badges = badgesData?.badges || [];
  const users = usersData?.users || [];

  return (
    <div className="space-y-8">
      {/* Creation Panel */}
      <div className="bg-zinc-900 border border-zinc-800 ares-cut overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Award className="text-ares-gold" size={24} /> Badge Index
            </h3>
            <p className="text-sm text-zinc-400 mt-1">Define platform-wide awards and training certifications.</p>
          </div>
          <button 
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-ares-red/10 text-ares-red hover:bg-ares-red hover:text-white transition-all ares-cut-sm text-sm font-bold flex items-center gap-2"
          >
            {showCreate ? <><X size={16}/> Cancel</> : <><Plus size={16} /> New Badge Type</>}
          </button>
        </div>

        {showCreate && (
          <div className="p-6 bg-black/40 border-b border-zinc-800 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="badge-id" className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Badge ID (slug)</label>
                <input id="badge-id" type="text" value={newBadgeId} onChange={e => setNewBadgeId(e.target.value)} placeholder="e.g. outreach_mvp" className="w-full bg-zinc-900 border border-zinc-700 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
              </div>
              <div>
                <label htmlFor="badge-name" className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Display Name</label>
                <input id="badge-name" type="text" value={newBadgeName} onChange={e => setNewBadgeName(e.target.value)} placeholder="Outreach MVP" className="w-full bg-zinc-900 border border-zinc-700 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
              </div>
              <div>
                <label htmlFor="badge-icon" className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Icon (Lucide Node)</label>
                <input id="badge-icon" type="text" value={newBadgeIcon} onChange={e => setNewBadgeIcon(e.target.value)} placeholder="Award" className="w-full bg-zinc-900 border border-zinc-700 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
              </div>
              <div>
                <label htmlFor="badge-color" className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Color Theme (CSS)</label>
                <input id="badge-color" type="text" value={newBadgeColor} onChange={e => setNewBadgeColor(e.target.value)} placeholder="ares-gold" className="w-full bg-zinc-900 border border-zinc-700 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
              </div>
            </div>
            <div>
              <label htmlFor="badge-desc" className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Description</label>
              <input id="badge-desc" type="text" value={newBadgeDesc} onChange={e => setNewBadgeDesc(e.target.value)} placeholder="Awarded to members who attain top 3 in outreach hours." className="w-full bg-zinc-900 border border-zinc-700 ares-cut-sm px-4 py-2.5 text-white focus:outline-none focus:border-ares-gold mt-1" />
            </div>
            <button 
              onClick={() => createBadgeMutation.mutate()} 
              disabled={createBadgeMutation.isPending || !newBadgeId || !newBadgeName}
              className="px-6 py-2.5 bg-zinc-100 text-black font-bold text-sm ares-cut-sm hover:bg-white transition-all disabled:opacity-50"
            >
              {createBadgeMutation.isPending ? "Creating..." : "Save Badge Definition"}
            </button>
          </div>
        )}

        {/* Existing Badges List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-zinc-950">
          {badgesLoading ? (
            <p className="text-zinc-500 text-sm">Loading badges...</p>
          ) : badges.length === 0 ? (
            <p className="text-zinc-500 text-sm">No badges defined yet.</p>
          ) : (
            badges.map(b => {
              const IconComp = (LucideIcons as Record<string, React.ElementType>)[b.icon] || LucideIcons.Award;
              return (
                <div key={b.id} className="bg-zinc-900/50 border border-zinc-800 ares-cut-sm p-4 flex items-start gap-4">
                  <div className={`p-3 ares-cut-sm bg-zinc-800/50 flex-shrink-0 text-${b.color_theme.replace("text-", "")}`}>
                    <IconComp size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{b.name}</h4>
                    <p className="text-xs text-zinc-500 mt-0.5">{b.description || "No description provided."}</p>
                    <p className="text-[10px] text-zinc-700 font-mono mt-2">ID: {b.id}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Grant Panel */}
      <div className="bg-zinc-900 border border-zinc-800 ares-cut p-6 shadow-2xl">
        <h3 className="text-xl font-black text-white flex items-center gap-2 mb-6">
          <UserPlus className="text-ares-red" size={24} /> Manual Badge Grant
        </h3>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="grant-user" className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Target Member</label>
            <select id="grant-user" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full bg-black border border-zinc-800 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red mt-1">
              <option value="">-- Select Member --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="grant-badge" className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Select Badge</label>
            <select id="grant-badge" value={selectedBadge} onChange={e => setSelectedBadge(e.target.value)} className="w-full bg-black border border-zinc-800 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red mt-1">
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
          className="mt-6 px-8 py-3 bg-ares-red text-white font-black uppercase tracking-widest ares-cut-sm hover:bg-red-600 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {awardBadgeMutation.isPending ? "Processing..." : <><Check size={18} /> Grant Badge to Member</>}
        </button>
      </div>
    </div>
  );
}
