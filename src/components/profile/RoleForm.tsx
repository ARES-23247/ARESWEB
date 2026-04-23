import { ProfileSubComponentProps } from "./types";

const SUBTEAM_OPTIONS = ["Build", "Programming", "Design/CAD", "Outreach", "Marketing", "Documentation", "Drive Team", "Scouting", "Strategy"];
const MEMBER_TYPES = [
  { value: "student", label: "Student", icon: "📚" },
  { value: "alumni", label: "Alumni", icon: "🎓" },
  { value: "mentor", label: "Mentor", icon: "🔧" },
  { value: "coach", label: "Coach", icon: "🏆" },
  { value: "parent", label: "Parent", icon: "👪" },
];

export function RoleForm({ profile, setProfile, inputClass, labelClass, sectionClass }: ProfileSubComponentProps) {
  const toggleSubteam = (team: string) => {
    setProfile((prev) => ({
      ...prev,
      subteams: prev.subteams.includes(team)
        ? prev.subteams.filter((t) => t !== team)
        : [...prev.subteams, team],
    }));
  };

  return (
    <div className={sectionClass}>
      <h3 className="text-sm font-black uppercase tracking-wider text-ares-red">Team Role</h3>
      <div>
        <label htmlFor="pe-member-type" className={labelClass}>Member Type</label>
        <select id="pe-member-type" className={inputClass} value={profile.member_type} onChange={e => setProfile({...profile, member_type: e.target.value})}>
          {MEMBER_TYPES.map(mt => (
            <option key={mt.value} value={mt.value}>{mt.icon} {mt.label}</option>
          ))}
        </select>
      </div>

      {profile.member_type === "student" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="pe-parents-name" className={labelClass}>Parent&apos;s Name</label>
            <input id="pe-parents-name" className={inputClass} placeholder="e.g. Jane Doe" value={profile.parents_name || ""} onChange={e => setProfile({...profile, parents_name: e.target.value})} />
          </div>
          <div>
            <label htmlFor="pe-parents-email" className={labelClass}>Parent&apos;s Email</label>
            <input id="pe-parents-email" className={inputClass} placeholder="jane.doe@example.com" value={profile.parents_email || ""} onChange={e => setProfile({...profile, parents_email: e.target.value})} />
          </div>
        </div>
      )}

      {profile.member_type === "parent" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="pe-students-name" className={labelClass}>Student&apos;s Name</label>
            <input id="pe-students-name" className={inputClass} placeholder="e.g. John Doe" value={profile.students_name || ""} onChange={e => setProfile({...profile, students_name: e.target.value})} />
          </div>
          <div>
            <label htmlFor="pe-students-email" className={labelClass}>Student&apos;s Email</label>
            <input id="pe-students-email" className={inputClass} placeholder="john.doe@example.com" value={profile.students_email || ""} onChange={e => setProfile({...profile, students_email: e.target.value})} />
          </div>
        </div>
      )}
      <div>
        <span className={labelClass}>Subteams (select all that apply)</span>
        <div className="flex flex-wrap gap-2">
          {SUBTEAM_OPTIONS.map(team => (
            <button key={team} onClick={() => toggleSubteam(team)}
              className={`px-3 py-1.5 ares-cut-sm border text-xs font-bold transition-all ${profile.subteams.includes(team) ? "bg-ares-gold/20 border-ares-gold text-ares-gold" : "bg-black/20 border-white/10 text-marble/50 hover:border-white/20"}`}
            >
              {team}
            </button>
          ))}
        </div>
      </div>
      {(profile.member_type === "student" || profile.member_type === "alumni") && (
        <div>
          <label htmlFor="pe-grade" className={labelClass}>Grade / Graduation Year</label>
          <input id="pe-grade" className={inputClass} placeholder="e.g. 10th Grade, Class of 2025" value={profile.grade_year} onChange={e => setProfile({...profile, grade_year: e.target.value})} />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pe-role" className={labelClass}>Leadership Role</label>
          <input id="pe-role" className={inputClass} placeholder="e.g. Build Lead, Captain (Optional)" value={profile.leadership_role} onChange={e => setProfile({...profile, leadership_role: e.target.value})} />
        </div>
        <div>
          <label htmlFor="pe-rookie" className={labelClass}>Rookie Year</label>
          <input id="pe-rookie" className={inputClass} placeholder="e.g. 2023" value={profile.rookie_year} onChange={e => setProfile({...profile, rookie_year: e.target.value})} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4 text-sm text-marble">
        <input type="checkbox" id="showAbout" checked={profile.show_on_about} onChange={e => setProfile({...profile, show_on_about: e.target.checked})} className="w-4 h-4 accent-ares-red" />
        <label htmlFor="showAbout">Show me on the About Us page</label>
      </div>
    </div>
  );
}
