import { useQuery } from "@tanstack/react-query";
import { Search, Clock, Users } from "lucide-react";
import { useState } from "react";

interface RosterMember {
  user_id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  member_type: string;
  attended_events: number;
  manual_prep_hours: number;
  event_volunteer_hours: number;
}

export default function MemberImpactOverview() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: roster = [], isLoading } = useQuery<RosterMember[]>({
    queryKey: ["admin-roster-stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/roster-stats");
      if (!r.ok) throw new Error("Failed to load roster stats");
      const d = await r.json() as { roster: RosterMember[] };
      return d.roster || [];
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ares-red"></div>
      </div>
    );
  }

  // Calculate full roster stats
  const enrichedRoster = roster.map(m => ({
    ...m,
    total_hours: m.manual_prep_hours + m.event_volunteer_hours,
    display_name: m.nickname || `${m.first_name || ""} ${m.last_name || ""}`.trim() || "ARES Member"
  }));

  // Filtering for MVPs (top 3 students only)
  const students = enrichedRoster.filter(m => m.member_type === "student" && (m.attended_events > 0 || m.total_hours > 0));

  const topAttendance = [...students].sort((a, b) => b.attended_events - a.attended_events).slice(0, 3);
  const topOutreach = [...students].sort((a, b) => b.total_hours - a.total_hours).slice(0, 3);

  // Search filter
  const filteredRoster = enrichedRoster.filter(m => 
    m.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.member_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12">
      {/* MVP Podiums */}
      {students.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Attendance MVP */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-ares-red/10 blur-[80px] rounded-full pointer-events-none" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-ares-red flex items-center gap-2 mb-6">
              <Users size={14} /> Attendance MVPs
            </h3>
            
            <div className="flex flex-col gap-4">
              {topAttendance.map((mvp, idx) => (
                <div key={mvp.user_id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
                  idx === 0 ? "bg-ares-gold/10 border-ares-gold/20" : 
                  idx === 1 ? "bg-zinc-300/10 border-zinc-300/20" : 
                  "bg-orange-800/10 border-orange-800/20"
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                     idx === 0 ? "bg-ares-gold/20 text-ares-gold" : 
                     idx === 1 ? "bg-zinc-300/20 text-zinc-300" : 
                     "bg-orange-800/20 text-orange-600"
                  }`}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white tracking-tight">{mvp.display_name}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Student</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-white">{mvp.attended_events}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Events</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outreach MVP */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-ares-cyan/10 blur-[80px] rounded-full pointer-events-none" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-ares-cyan flex items-center gap-2 mb-6">
              <Clock size={14} /> Outreach MVPs
            </h3>
            
            <div className="flex flex-col gap-4">
              {topOutreach.map((mvp, idx) => (
                <div key={mvp.user_id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
                  idx === 0 ? "bg-ares-gold/10 border-ares-gold/20" : 
                  idx === 1 ? "bg-zinc-300/10 border-zinc-300/20" : 
                  "bg-orange-800/10 border-orange-800/20"
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                     idx === 0 ? "bg-ares-gold/20 text-ares-gold" : 
                     idx === 1 ? "bg-zinc-300/20 text-zinc-300" : 
                     "bg-orange-800/20 text-orange-600"
                  }`}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white tracking-tight">{mvp.display_name}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Student</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-white">{mvp.total_hours.toFixed(1)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Hours</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Roster Table */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-white">Full Team Roster</h3>
            <p className="text-sm text-zinc-500 font-medium tracking-tight">Detailed attendance and volunteering metrics for export.</p>
          </div>
          
          <div className="relative w-full md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/20">
                <th className="text-left py-4 px-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Member</th>
                <th className="text-left py-4 px-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Type</th>
                <th className="text-left py-4 px-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Events Attended</th>
                <th className="text-left py-4 px-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Volunteer Hours</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map(m => (
                <tr key={m.user_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <img src={`https://api.dicebear.com/9.x/bottts/svg?seed=${m.user_id}`} alt="avatar" className="w-8 h-8 rounded-lg bg-zinc-900" />
                      <span className="font-bold text-white tracking-tight">{m.display_name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-md text-[10px] uppercase font-bold text-zinc-400">
                      {m.member_type}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-white font-bold">{m.attended_events}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-white font-bold">{m.total_hours.toFixed(1)} <span className="text-zinc-500 text-xs font-medium">hrs</span></span>
                  </td>
                </tr>
              ))}
              {filteredRoster.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-zinc-600 font-medium italic">
                    No members match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
