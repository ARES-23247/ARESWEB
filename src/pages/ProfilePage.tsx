import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Briefcase, ArrowLeft, Shield, ShieldAlert } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { publicApi } from "../api/publicApi";

interface ProfilePublic {
  first_name?: string;
  last_name?: string;
  nickname: string;
  avatar: string;
  pronouns: string;
  subteams: string[];
  member_type: string;
  bio: string;
  favorite_first_thing: string;
  fun_fact: string;
  grade_year?: string;
  email?: string;
  phone?: string;
  colleges?: { name: string; domain: string; years: string; degree: string }[];
  employers?: { name: string; domain: string; title: string; current: boolean; years: string }[];
  dietary_restrictions?: string;
  favorite_food?: string;
  tshirt_size?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  favorite_robot_mechanism?: string;
  pre_match_superstition?: string;
  rookie_year?: string;
  leadership_role?: string;
}

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color_theme: string;
  awarded_at?: string;
}

export default function ProfilePage() {
  const { userId } = useParams();
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    publicApi.get<{ profile: ProfilePublic, badges?: BadgeDef[] }>(`/api/profile/${userId}`)
      .then((data) => { 
        if (cancelled) return;
        setProfile(data.profile); 
        setBadges(data.badges || []);
        setError(null);
        setLoading(false); 
      })
      .catch((err) => {
        if (cancelled) return;
        setError({ status: err.message.includes("403") ? 403 : 500, message: err.message || "Network error" });
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-ares-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-marble gap-4 p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
          <ShieldAlert size={40} className="text-ares-red" />
        </div>
        <h1 className="text-2xl font-black">{error?.status === 403 ? "Private Profile" : "Profile Not Found"}</h1>
        <p className="text-marble max-w-md">
          {error?.message || "The profile you are looking for does not exist or has been hidden by the user."}
        </p>
        <Link to="/about" className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm transition-all text-sm font-bold">
          Back to Team Roster
        </Link>
      </div>
    );
  }

  const memberLabel = { student: "Student", alumni: "Alumni", mentor: "Mentor", coach: "Coach" }[profile.member_type] || "Member";
  const memberIcon = { student: "📚", alumni: "🎓", mentor: "🔧", coach: "🏆" }[profile.member_type] || "👤";

  const subteams = typeof profile.subteams === "string" ? JSON.parse(profile.subteams || "[]") : (profile.subteams || []);
  const colleges = typeof profile.colleges === "string" ? JSON.parse(profile.colleges || "[]") : (profile.colleges || []);
  const employers = typeof profile.employers === "string" ? JSON.parse(profile.employers || "[]") : (profile.employers || []);

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex justify-between items-center mb-8 print:hidden">
          <Link to="/about" className="inline-flex items-center gap-2 text-marble hover:text-white text-sm font-bold transition-colors">
            <ArrowLeft size={16} /> Back to Team
          </Link>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-ares-red hover:bg-ares-bronze text-white text-sm font-bold ares-cut-sm transition-colors"
          >
            <LucideIcons.Printer size={16} /> Export Portfolio
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header Card */}
          <div className="bg-white/5 border border-white/10 ares-cut-lg p-8 flex flex-col md:flex-row items-center md:items-start gap-8 mb-8">
            <div className="w-32 h-32 ares-cut bg-obsidian border border-white/10 overflow-hidden p-3 flex-shrink-0">
              <img src={profile.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${userId}`} alt="Avatar" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-black text-white mb-1">
                {profile.first_name && profile.last_name ? `${profile.first_name} "${profile.nickname}" ${profile.last_name}` : (profile.nickname || "ARES Member")}
              </h1>
              {profile.pronouns && <p className="text-marble text-sm mb-3">{profile.pronouns}</p>}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                <span className="px-3 py-1 bg-ares-red/20 border border-ares-red/30 rounded-full text-xs font-bold text-ares-red">
                  {memberIcon} {memberLabel}
                </span>
                {subteams.length > 0 && subteams.map((team: string) => (
                  <span key={team} className="px-3 py-1 bg-ares-gold/10 border border-ares-gold/20 rounded-full text-xs font-bold text-ares-gold">
                    {team}
                  </span>
                ))}
              </div>
              {profile.bio && <p className="text-marble text-sm leading-relaxed">{profile.bio}</p>}
            </div>
          </div>

          {/* Trophy Rack */}
          {badges && badges.length > 0 && (
            <div className="bg-white/5 border border-white/10 ares-cut-lg p-8 mb-8">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <LucideIcons.Award className="text-ares-gold" size={16} /> Honors & Badges
              </h3>
              <div className="flex flex-wrap gap-4">
                {badges.map((b) => {
                  const IconComp = (LucideIcons as unknown as Record<string, React.ElementType>)[b.icon] || LucideIcons.Award;
                  const colorClass = `text-${b.color_theme.replace("text-", "")}`;
                  return (
                    <div key={b.id} className="relative group cursor-help bg-obsidian border border-white/10 hover:border-ares-gold ares-cut p-4 transition-all flex flex-col items-center justify-center w-28 h-28">
                      <IconComp size={40} className={`mb-2 ${colorClass}`} />
                      <span className="text-xs font-bold text-center text-marble leading-tight block">{b.name}</span>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 bg-black border border-white/10 text-white text-xs ares-cut-sm p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-2xl">
                        <p className="font-bold mb-1">{b.name}</p>
                        <p className="text-marble text-xs leading-relaxed">{b.description}</p>
                        {b.awarded_at && (
                          <p className="text-marble text-[9px] mt-2 border-t border-white/10 pt-2">
                            Awarded: {new Date(b.awarded_at).toLocaleDateString()}
                          </p>
                        )}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/10"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin / Private Details */}
          {(profile.emergency_contact_name || profile.dietary_restrictions || profile.tshirt_size) && (
             <div className="bg-ares-red/5 border border-ares-red/20 ares-cut p-6 mb-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-ares-red text-white text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg">Private / Admin Only</div>
               <h3 className="ares-badge-red mb-6 flex items-center gap-2"><Shield size={14} /> Internal Records</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                 {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
                   <div>
                     <p className="text-xs font-bold text-marble uppercase">Emergency Contact</p>
                     <p className="text-marble text-sm">{profile.emergency_contact_name || "Unknown"}</p>
                     <p className="text-marble text-xs">{profile.emergency_contact_phone}</p>
                   </div>
                 )}
                 {profile.dietary_restrictions && (
                   <div>
                     <p className="text-xs font-bold text-marble uppercase">Dietary Info</p>
                     <p className="text-marble text-sm">{JSON.parse(profile.dietary_restrictions || "[]").join(", ")}</p>
                   </div>
                 )}
                 {profile.tshirt_size && (
                   <div>
                     <p className="text-xs font-bold text-marble uppercase">T-Shirt Size</p>
                     <p className="text-marble text-sm uppercase">{profile.tshirt_size}</p>
                   </div>
                 )}
               </div>
             </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {profile.rookie_year && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-marble uppercase tracking-wider mb-2">Rookie Year</p>
                <p className="text-marble text-sm">{profile.rookie_year}</p>
              </div>
            )}
            {profile.leadership_role && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-red uppercase tracking-wider mb-2">Leadership Role</p>
                <p className="text-marble text-sm">{profile.leadership_role}</p>
              </div>
            )}
            {profile.favorite_first_thing && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-red uppercase tracking-wider mb-2">Favorite Thing About FIRST</p>
                <p className="text-marble text-sm">{profile.favorite_first_thing}</p>
              </div>
            )}
            {profile.favorite_robot_mechanism && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Favorite Robot Mechanism</p>
                <p className="text-marble text-sm">{profile.favorite_robot_mechanism}</p>
              </div>
            )}
            {profile.pre_match_superstition && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-red uppercase tracking-wider mb-2">Pre-Match Superstition</p>
                <p className="text-marble text-sm">{profile.pre_match_superstition}</p>
              </div>
            )}
            {profile.fun_fact && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Fun Fact</p>
                <p className="text-marble text-sm">{profile.fun_fact}</p>
              </div>
            )}
            {profile.favorite_food && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-cyan uppercase tracking-wider mb-2">Favorite Food</p>
                <p className="text-marble text-sm">{profile.favorite_food}</p>
              </div>
            )}
            {profile.grade_year && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-marble uppercase tracking-wider mb-2">Class</p>
                <p className="text-marble text-sm">{profile.grade_year}</p>
              </div>
            )}
            {(profile.email || profile.phone) && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-marble uppercase tracking-wider mb-2">Contact</p>
                {profile.email && <p className="text-marble text-sm">{profile.email}</p>}
                {profile.phone && <p className="text-marble text-sm">{profile.phone}</p>}
              </div>
            )}
          </div>

          {/* Colleges */}
          {colleges && colleges.length > 0 && (
            <div className="bg-white/5 border border-white/10 ares-cut p-6 mb-4">
              <h3 className="ares-badge-red mb-6 flex items-center gap-2">
<GraduationCap size={14} /> Education</h3>
              <div className="space-y-3">
                {colleges.map((col: { domain: string, name: string, degree: string, years: string }, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <BrandLogo domain={col.domain} fallbackIcon={GraduationCap} className="w-8 h-8" />
                    <div>
                      <p className="text-white text-sm font-bold">{col.name}</p>
                      <p className="text-marble text-xs">{[col.degree, col.years].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employers */}
          {employers && employers.length > 0 && (
            <div className="bg-white/5 border border-white/10 ares-cut p-6">
              <h3 className="ares-badge-red mb-6 flex items-center gap-2">
<Briefcase size={14} /> Career</h3>
              <div className="space-y-3">
                {employers.map((emp: { domain: string, name: string, current: boolean, title: string, years: string }, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <BrandLogo domain={emp.domain} fallbackIcon={Briefcase} className="w-8 h-8" />
                    <div>
                      <p className="text-white text-sm font-bold">{emp.name} {emp.current && <span className="text-ares-gold text-xs ml-1">● Current</span>}</p>
                      <p className="text-marble text-xs">{[emp.title, emp.years].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student Safety Notice */}
          {profile.member_type === "student" && (
            <div className="mt-8 flex items-center gap-2 text-marble/30 text-xs">
              <Shield size={12} /> Contact information protected per FIRST Youth Protection guidelines.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
