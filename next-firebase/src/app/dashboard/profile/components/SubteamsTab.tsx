import React from "react";
import { User } from "lucide-react";

interface SubteamsTabProps {
  availableSubteams: string[];
  subteams: string[];
  handleSubteamToggle: (team: string) => void;
  rookieYear: string;
  setRookieYear: (val: string) => void;
  leadershipRole: string;
  setLeadershipRole: (val: string) => void;
  isAdmin: boolean;
  memberType: string;
  setMemberType: (val: string) => void;
}

export default function SubteamsTab({
  availableSubteams,
  subteams,
  handleSubteamToggle,
  rookieYear,
  setRookieYear,
  leadershipRole,
  setLeadershipRole,
  isAdmin,
  memberType,
  setMemberType,
}: SubteamsTabProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
        <User size={14} /> Subteam Assignments
      </h3>

      <div className="bg-black/25 border border-white/5 p-4 rounded-xl">
        <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-3">Subteams (Select all that apply)</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableSubteams.map((team) => {
            const isSelected = subteams.includes(team);
            return (
              <button
                key={team}
                type="button"
                onClick={() => handleSubteamToggle(team)}
                className={`px-4 py-3 ares-cut-sm border text-[10px] font-black uppercase tracking-wider text-center cursor-pointer transition-all ${
                  isSelected
                    ? "bg-ares-gold/20 text-ares-gold border-ares-gold/50"
                    : "bg-white/5 text-marble/65 border-transparent hover:bg-white/10 hover:text-white"
                }`}
              >
                {team}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="profile-rookie-year" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Rookie Year</label>
          <input
            id="profile-rookie-year"
            type="text"
            value={rookieYear}
            onChange={(e) => setRookieYear(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
            placeholder="e.g. 2024"
          />
        </div>
        <div>
          <label htmlFor="profile-leadership-role" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Leadership / Custom Role</label>
          <input
            id="profile-leadership-role"
            type="text"
            value={leadershipRole}
            onChange={(e) => setLeadershipRole(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
            placeholder="e.g. Programming Lead"
          />
        </div>
        {isAdmin && (
          <div>
            <label htmlFor="profile-member-type" className="block text-[10px] uppercase font-bold text-ares-red/80 tracking-wider mb-2">Member Type (Admin Only)</label>
            <select
              id="profile-member-type"
              value={memberType}
              onChange={(e) => setMemberType(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
            >
              <option value="student">Student</option>
              <option value="alumni">Alumni</option>
              <option value="mentor">Mentor</option>
              <option value="coach">Coach</option>
              <option value="parent">Parent</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
