import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Save, RefreshCw, Shield, Plus, Trash2, GraduationCap, Briefcase } from "lucide-react";

const SUBTEAM_OPTIONS = ["Build", "Programming", "Design/CAD", "Outreach", "Marketing", "Documentation", "Drive Team", "Scouting", "Strategy"];
const MEMBER_TYPES = [
  { value: "student", label: "Student", icon: "📚" },
  { value: "alumni", label: "Alumni", icon: "🎓" },
  { value: "mentor", label: "Mentor", icon: "🔧" },
  { value: "coach", label: "Coach", icon: "🏆" },
  { value: "parent", label: "Parent", icon: "👪" },
];

const DIETARY_OPTIONS = ["Gluten-Free", "Kosher", "Halal", "Vegetarian", "Vegan", "Nut-free", "No-pork", "No-Beef"];

interface CollegeEntry { name: string; domain: string; years: string; degree: string; }
interface EmployerEntry { name: string; domain: string; title: string; current: boolean; years: string; }

interface ProfileData {
  nickname: string;
  phone: string;
  contact_email: string;
  show_email: boolean;
  show_phone: boolean;
  pronouns: string;
  grade_year: string;
  subteams: string[];
  member_type: string;
  bio: string;
  favorite_food: string;
  dietary_restrictions: string[];
  favorite_first_thing: string;
  fun_fact: string;
  colleges: CollegeEntry[];
  employers: EmployerEntry[];
  favorite_robot_mechanism: string;
  pre_match_superstition: string;
  leadership_role: string;
  rookie_year: string;
  tshirt_size: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

const DEFAULT_PROFILE: ProfileData = {
  nickname: "", phone: "", contact_email: "", show_email: false, show_phone: false,
  pronouns: "", grade_year: "", subteams: [], member_type: "student",
  bio: "", favorite_food: "", dietary_restrictions: [],
  favorite_first_thing: "", fun_fact: "",
  colleges: [], employers: [], show_on_about: true,
  favorite_robot_mechanism: "", pre_match_superstition: "", leadership_role: "", rookie_year: "",
  tshirt_size: "", emergency_contact_name: "", emergency_contact_phone: "",
};

export default function ProfileEditor() {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isMinor = profile.member_type === "student"; // Only students get PII-hidden treatment

  useEffect(() => {
    fetch("/api/profile/me", { credentials: "include" })
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        if (data && !data.error) {
          setProfile({
            ...DEFAULT_PROFILE,
            ...data,
            subteams: typeof data.subteams === "string" ? JSON.parse(data.subteams as string) : (data.subteams as string[]) || [],
            dietary_restrictions: typeof data.dietary_restrictions === "string" ? JSON.parse((data.dietary_restrictions as string) || "[]") : (data.dietary_restrictions as string[]) || [],
            colleges: typeof data.colleges === "string" ? JSON.parse(data.colleges as string) : (data.colleges as CollegeEntry[]) || [],
            employers: typeof data.employers === "string" ? JSON.parse(data.employers as string) : (data.employers as EmployerEntry[]) || [],
            contact_email: data.contact_email || "",
            show_email: Boolean(data.show_email),
            show_phone: Boolean(data.show_phone),
            show_on_about: data.show_on_about !== undefined ? Boolean(data.show_on_about) : true,
            favorite_robot_mechanism: data.favorite_robot_mechanism || "",
            pre_match_superstition: data.pre_match_superstition || "",
            leadership_role: data.leadership_role || "",
            rookie_year: data.rookie_year || "",
            tshirt_size: data.tshirt_size || "",
            emergency_contact_name: data.emergency_contact_name || "",
            emergency_contact_phone: data.emergency_contact_phone || "",
          });
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...profile,
          subteams: JSON.stringify(profile.subteams),
          dietary_restrictions: JSON.stringify(profile.dietary_restrictions),
          colleges: JSON.stringify(profile.colleges),
          employers: JSON.stringify(profile.employers),
          show_email: profile.show_email ? 1 : 0,
          show_phone: profile.show_phone ? 1 : 0,
          show_on_about: profile.show_on_about ? 1 : 0,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage({ type: "success", text: "Profile saved!" });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Failed to save profile." });
    }
    setIsSaving(false);
  };

  const toggleSubteam = (team: string) => {
    setProfile(prev => ({
      ...prev,
      subteams: prev.subteams.includes(team)
        ? prev.subteams.filter(t => t !== team)
        : [...prev.subteams, team],
    }));
  };

  const toggleDietary = (item: string) => {
    setProfile(prev => ({
      ...prev,
      dietary_restrictions: prev.dietary_restrictions.includes(item)
        ? prev.dietary_restrictions.filter(t => t !== item)
        : [...prev.dietary_restrictions, item],
    }));
  };

  const getOtherDietary = () => {
    const other = profile.dietary_restrictions.find(t => t.startsWith("Other:"));
    return other ? other.replace("Other:", "").trim() : "";
  };

  const setOtherDietary = (val: string) => {
    setProfile(prev => {
      const filtered = prev.dietary_restrictions.filter(t => !t.startsWith("Other:"));
      if (!val) return { ...prev, dietary_restrictions: filtered };
      return { ...prev, dietary_restrictions: [...filtered, `Other: ${val}`] };
    });
  };

  const addCollege = () => setProfile(prev => ({ ...prev, colleges: [...prev.colleges, { name: "", domain: "", years: "", degree: "" }] }));
  const removeCollege = (i: number) => setProfile(prev => ({ ...prev, colleges: prev.colleges.filter((_, idx) => idx !== i) }));
  const updateCollege = (i: number, field: keyof CollegeEntry, val: string) => {
    const updated = [...profile.colleges];
    updated[i] = { ...updated[i], [field]: val };
    if (field === "name" && val.length > 2) {
      // Auto-derive domain for Clearbit logo
      const domain = val.toLowerCase().replace(/\s+/g, "").replace(/university|college|of|the/gi, "");
      updated[i].domain = updated[i].domain || `${domain}.edu`;
    }
    setProfile(prev => ({ ...prev, colleges: updated }));
  };

  const addEmployer = () => setProfile(prev => ({ ...prev, employers: [...prev.employers, { name: "", domain: "", title: "", current: false, years: "" }] }));
  const removeEmployer = (i: number) => setProfile(prev => ({ ...prev, employers: prev.employers.filter((_, idx) => idx !== i) }));
  const updateEmployer = (i: number, field: keyof EmployerEntry, val: string | boolean) => {
    const updated = [...profile.employers];
    updated[i] = { ...updated[i], [field]: val };
    setProfile(prev => ({ ...prev, employers: updated }));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;
  }

  const inputClass = "w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-ares-red transition-colors";
  const labelClass = "text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block";
  const sectionClass = "bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Youth Protection Banner for Students */}
      {isMinor && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <Shield className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-blue-200">
            <strong>FIRST Youth Protection:</strong> Your contact information (email, phone) is protected and never shown publicly. Only your nickname and avatar are visible to others.
          </p>
        </div>
      )}

      {/* Identity */}
      <div className={sectionClass}>
        <h3 className="text-sm font-black uppercase tracking-wider text-ares-red flex items-center gap-2"><User size={16} /> Identity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pe-nickname" className={labelClass}>Nickname (Public Display Name)</label>
            <input id="pe-nickname" className={inputClass} placeholder="e.g. Sparky, RoboKid42" value={profile.nickname} onChange={e => setProfile({...profile, nickname: e.target.value})} />
          </div>
          <div>
            <label htmlFor="pe-pronouns" className={labelClass}>Pronouns</label>
            <input id="pe-pronouns" className={inputClass} placeholder="e.g. he/him, she/her, they/them" value={profile.pronouns} onChange={e => setProfile({...profile, pronouns: e.target.value})} />
          </div>
        </div>
        <div>
          <label htmlFor="pe-bio" className={labelClass}>Bio</label>
          <textarea id="pe-bio" className={`${inputClass} min-h-[80px] resize-none`} placeholder="Tell us about yourself (keep it PII-free!)" value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})} />
        </div>
        <div>
          <label htmlFor="pe-funfact" className={labelClass}>Fun Fact</label>
          <input id="pe-funfact" className={inputClass} placeholder="Something cool about you!" value={profile.fun_fact} onChange={e => setProfile({...profile, fun_fact: e.target.value})} />
        </div>
      </div>

      {/* Team Role */}
      <div className={sectionClass}>
        <h3 className="text-sm font-black uppercase tracking-wider text-ares-red">Team Role</h3>
        <div>
          <span className={labelClass}>Member Type</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {MEMBER_TYPES.map(mt => (
              <button key={mt.value} onClick={() => setProfile({...profile, member_type: mt.value})}
                className={`p-3 rounded-xl border text-sm font-bold transition-all ${profile.member_type === mt.value ? "bg-ares-red/20 border-ares-red text-white" : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
              >
                <span className="text-lg mr-1">{mt.icon}</span> {mt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={labelClass}>Subteams (select all that apply)</span>
          <div className="flex flex-wrap gap-2">
            {SUBTEAM_OPTIONS.map(team => (
              <button key={team} onClick={() => toggleSubteam(team)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${profile.subteams.includes(team) ? "bg-ares-gold/20 border-ares-gold text-ares-gold" : "bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}
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
        <div className="flex items-center gap-3">
          <input type="checkbox" id="showAbout" checked={profile.show_on_about} onChange={e => setProfile({...profile, show_on_about: e.target.checked})} className="w-4 h-4 accent-ares-red" />
          <label htmlFor="showAbout" className="text-sm text-zinc-300">Show me on the About Us page</label>
        </div>
      </div>

      {/* Contact (adults only) */}
      {!isMinor && (
        <div className={sectionClass}>
          <h3 className="text-sm font-black uppercase tracking-wider text-ares-red">Contact (Optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pe-phone" className={labelClass}>Phone</label>
              <input id="pe-phone" className={inputClass} placeholder="(304) 555-1234" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
              <label className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                <input type="checkbox" checked={profile.show_phone} onChange={e => setProfile({...profile, show_phone: e.target.checked})} className="accent-ares-red" />
                Show on public profile
              </label>
            </div>
            <div>
              <label htmlFor="pe-contact-email" className={labelClass}>Contact Email</label>
              <input id="pe-contact-email" className={inputClass} placeholder="Optional. Replaces login email." value={profile.contact_email} onChange={e => setProfile({...profile, contact_email: e.target.value})} />
              <label className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                <input type="checkbox" checked={profile.show_email} onChange={e => setProfile({...profile, show_email: e.target.checked})} className="accent-ares-red" />
                Show email on public profile
              </label>
            </div>
          </div>
        </div>
      )}

      {/* FIRST / Food */}
      <div className={sectionClass}>
        <h3 className="text-sm font-black uppercase tracking-wider text-ares-red">FIRST & Fun</h3>
        <div>
          <label htmlFor="pe-fav-first" className={labelClass}>Favorite thing about FIRST / ARES</label>
          <input id="pe-fav-first" className={inputClass} placeholder="Building robots with friends!" value={profile.favorite_first_thing} onChange={e => setProfile({...profile, favorite_first_thing: e.target.value})} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pe-fav-mech" className={labelClass}>Favorite Robot Mechanism</label>
            <input id="pe-fav-mech" className={inputClass} placeholder="e.g. 2022 Turret" value={profile.favorite_robot_mechanism} onChange={e => setProfile({...profile, favorite_robot_mechanism: e.target.value})} />
          </div>
          <div>
            <label htmlFor="pe-superstition" className={labelClass}>Pre-Match Superstition</label>
            <input id="pe-superstition" className={inputClass} placeholder="e.g. Taping the battery 3 times" value={profile.pre_match_superstition} onChange={e => setProfile({...profile, pre_match_superstition: e.target.value})} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pe-food" className={labelClass}>Favorite Food</label>
            <input id="pe-food" className={inputClass} placeholder="Pizza, tacos..." value={profile.favorite_food} onChange={e => setProfile({...profile, favorite_food: e.target.value})} />
          </div>
          <div>
            <span className={labelClass}>Dietary Restrictions</span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {DIETARY_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={profile.dietary_restrictions.includes(opt)} onChange={() => toggleDietary(opt)} className="accent-ares-red rounded w-4 h-4" />
                  {opt}
                </label>
              ))}
              <div className="col-span-2 mt-1">
                <label className="flex items-center gap-2 text-sm text-zinc-300 mb-1">
                  <input type="checkbox" checked={profile.dietary_restrictions.some(t => t.startsWith("Other:"))} onChange={(e) => { if (!e.target.checked) setOtherDietary(""); else setOtherDietary("Optional Details"); }} className="accent-ares-red rounded w-4 h-4" />
                  Other
                </label>
                {profile.dietary_restrictions.some(t => t.startsWith("Other:")) && (
                  <input className={`${inputClass} !py-2`} placeholder="Please specify..." value={getOtherDietary()} onChange={e => setOtherDietary(e.target.value)} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Internal Logistics (Private) */}
      <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-2 text-sm font-black uppercase tracking-wider text-ares-red">
          <Shield size={16} /> Team Logistics (Private)
        </div>
        <p className="text-xs text-zinc-400 mb-4">This information is strictly for event organization and travel. It will NEVER be shown publicly.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label htmlFor="pe-tshirt" className={labelClass}>T-Shirt Size</label>
            <select id="pe-tshirt" className={inputClass} value={profile.tshirt_size} onChange={e => setProfile({...profile, tshirt_size: e.target.value})}>
              <option value="" disabled>Select Size...</option>
              <option value="Youth Medium">Youth Medium</option>
              <option value="Youth Large">Youth Large</option>
              <option value="Adult Small">Adult Small</option>
              <option value="Adult Medium">Adult Medium</option>
              <option value="Adult Large">Adult Large</option>
              <option value="Adult XL">Adult XL</option>
              <option value="Adult 2XL">Adult 2XL</option>
              <option value="Adult 3XL">Adult 3XL</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="pe-ec-name" className={labelClass}>Emergency Contact Name</label>
            <input id="pe-ec-name" className={inputClass} placeholder="Parent/Guardian Name" value={profile.emergency_contact_name} onChange={e => setProfile({...profile, emergency_contact_name: e.target.value})} />
          </div>
          <div className="md:col-span-1">
            <label htmlFor="pe-ec-phone" className={labelClass}>Emergency Contact Phone</label>
            <input id="pe-ec-phone" className={inputClass} placeholder="(304) 555-1234" value={profile.emergency_contact_phone} onChange={e => setProfile({...profile, emergency_contact_phone: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Education (non-students only) */}
      {!isMinor && (
        <div className={sectionClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-ares-red flex items-center gap-2"><GraduationCap size={16} /> Education</h3>
            <button onClick={addCollege} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-ares-gold">
              <Plus size={14} /> Add College
            </button>
          </div>
          {profile.colleges.map((col, i) => (
            <div key={i} className="flex gap-3 items-start bg-black/30 p-4 rounded-xl border border-zinc-800">
              {col.domain && (
                <img src={`https://logo.clearbit.com/${col.domain}`} alt="" className="w-10 h-10 rounded-lg bg-white p-1 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <input className={inputClass} placeholder="University name" value={col.name} onChange={e => updateCollege(i, "name", e.target.value)} />
                <input className={inputClass} placeholder="Domain (rice.edu)" value={col.domain} onChange={e => updateCollege(i, "domain", e.target.value)} />
                <input className={inputClass} placeholder="Degree (BS ME)" value={col.degree} onChange={e => updateCollege(i, "degree", e.target.value)} />
                <input className={inputClass} placeholder="Years (2020-2024)" value={col.years} onChange={e => updateCollege(i, "years", e.target.value)} />
              </div>
              <button onClick={() => removeCollege(i)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Career (non-students only) */}
      {!isMinor && (
        <div className={sectionClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-ares-red flex items-center gap-2"><Briefcase size={16} /> Career</h3>
            <button onClick={addEmployer} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-ares-gold">
              <Plus size={14} /> Add Employer
            </button>
          </div>
          {profile.employers.map((emp, i) => (
            <div key={i} className="flex gap-3 items-start bg-black/30 p-4 rounded-xl border border-zinc-800">
              {emp.domain && (
                <img src={`https://logo.clearbit.com/${emp.domain}`} alt="" className="w-10 h-10 rounded-lg bg-white p-1 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <input className={inputClass} placeholder="Company name" value={emp.name} onChange={e => updateEmployer(i, "name", e.target.value)} />
                <input className={inputClass} placeholder="Domain (spacex.com)" value={emp.domain} onChange={e => updateEmployer(i, "domain", e.target.value)} />
                <input className={inputClass} placeholder="Title" value={emp.title} onChange={e => updateEmployer(i, "title", e.target.value)} />
                <input className={inputClass} placeholder="Years" value={emp.years} onChange={e => updateEmployer(i, "years", e.target.value)} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <label htmlFor={`pe-emp-current-${i}`} className="text-[9px] text-zinc-500">Current</label>
                <input id={`pe-emp-current-${i}`} type="checkbox" checked={emp.current} onChange={e => updateEmployer(i, "current", e.target.checked)} className="accent-ares-red" />
              </div>
              <button onClick={() => removeEmployer(i)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Save */}
      {message && (
        <div className={`p-4 rounded-xl text-sm font-semibold ${message.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
          {message.text}
        </div>
      )}
      <button onClick={handleSave} disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 py-4 font-bold bg-gradient-to-r from-ares-red to-red-700 hover:from-red-600 hover:to-red-800 text-white rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-50"
      >
        {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
        {isSaving ? "Saving..." : "Save Profile"}
      </button>
    </motion.div>
  );
}
