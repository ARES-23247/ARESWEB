import { useState, useEffect } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { GraduationCap, Briefcase, ArrowLeft, Shield, ShieldAlert } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import SEO from "../components/SEO";
import { validateIdParam } from "../utils/security";
import { logger } from "../utils/logger";

interface ProfilePublic {
  firstName?: string;
  lastName?: string;
  nickname: string;
  avatar: string;
  pronouns: string;
  subteams: string[];
  memberType: string;
  bio: string;
  favoriteFirstThing: string;
  funFact: string;
  gradeYear?: string;
  email?: string;
  phone?: string;
  colleges?: { name: string; domain: string; years: string; degree: string }[];
  employers?: { name: string; domain: string; title: string; current: boolean; years: string }[];
  dietaryRestrictions?: string;
  favoriteFood?: string;
  tshirtSize?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  favoriteRobotMechanism?: string;
  preMatchSuperstition?: string;
  rookieYear?: string;
  leadershipRole?: string;
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
  const { userId } = useParams({ strict: false }) as Record<string, string>;
  const validatedUserId = validateIdParam(userId);

  // All React hooks must be declared before any early returns
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [points, setPoints] = useState<number | null>(null);
  const [history, setHistory] = useState<{id: string, reason: string, points_delta: number, createdAt: string}[]>([]);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!userId || !validatedUserId) return;
    
    let cancelled = false;

    fetch(`/api/profiles/${validatedUserId}`)
      .then(async (res) => {
        if (cancelled || !res.ok) {
          if (res.status === 403) throw new Error("403 Private Profile");
          throw new Error(`Failed to fetch profile: ${res.status}`);
        }
        return res.json();
      })
      .then((data: unknown) => {
        const d = data as { profile: ProfilePublic; badges?: BadgeDef[] };
        if (cancelled) return;
        setProfile(d.profile);
        setBadges(d.badges || []);
        setError(null);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError({ status: err.message.includes("403") ? 403 : 500, message: err.message || "Network error" });
        setLoading(false);
      });

    fetch(`/api/points/${validatedUserId}/balance`)
      .then(res => res.json())
      .then((data: unknown) => {
        const d = data as { balance: number };
        if (!cancelled) setPoints(d.balance);
        setPointsLoading(false);
      }).catch((err: Error) => {
        if (!cancelled) {
          logger.error("Failed to load points balance:", err);
          setPointsLoading(false);
        }
      });

    fetch(`/api/points/${validatedUserId}/history`)
      .then(res => res.json())
      .then((data: unknown) => {
        const d = data as { transactions: {id: string, reason: string, points_delta: number, createdAt: string}[] };
        if (!cancelled) setHistory(d.transactions);
        setHistoryLoading(false);
      }).catch((err: Error) => {
        if (!cancelled) {
          logger.error("Failed to load points history:", err);
          setHistoryLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [userId, validatedUserId]);

  // Early return if userId is invalid
  if (!userId || !validatedUserId) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-marble gap-4 p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
          <ShieldAlert size={40} className="text-ares-red" />
        </div>
        <h1 className="text-2xl font-black">Invalid User ID</h1>
        <p className="text-marble max-w-md">The user ID format is invalid.</p>
      </div>
    );
  }

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

  const memberLabel = { student: "Student", alumni: "Alumni", mentor: "Mentor", coach: "Coach" }[profile.memberType] || "Member";
  const memberIcon = { student: "📚", alumni: "🎓", mentor: "🔧", coach: "ðŸ†" }[profile.memberType] || "👤";

  const subteams = typeof profile.subteams === "string" ? JSON.parse(profile.subteams || "[]") : (profile.subteams || []);
  const colleges = typeof profile.colleges === "string" ? JSON.parse(profile.colleges || "[]") : (profile.colleges || []);
  const employers = typeof profile.employers === "string" ? JSON.parse(profile.employers || "[]") : (profile.employers || []);

  return (
    <div className="min-h-screen bg-obsidian">
      <SEO 
        title={profile.nickname ? `${profile.nickname}'s Profile` : "Team Member Profile"} 
        description={profile.bio || `View ${profile.nickname}'s robotics journey and achievements at ARES 23247.`}
        image={profile.avatar}
      />
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
                {profile.firstName && profile.lastName ? `${profile.firstName} "${profile.nickname}" ${profile.lastName}` : (profile.nickname || profile.firstName || "ARES Member")}
              </h1>
              {profile.pronouns && <p className="text-marble text-sm mb-3">{profile.pronouns}</p>}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                <span className="px-3 py-1 bg-ares-red/20 border border-ares-red/30 ares-cut-sm text-xs font-bold text-ares-red">
                  {memberIcon} {memberLabel}
                </span>
                {subteams.length > 0 && subteams.map((team: string) => (
                  <span key={team} className="px-3 py-1 bg-ares-gold/10 border border-ares-gold/20 ares-cut-sm text-xs font-bold text-ares-gold">
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
                  const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[b.icon] || LucideIcons.Award;
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

          {/* Member Activity Gamification */}
          {points !== null && (
            <div className="bg-white/5 border border-white/10 ares-cut-lg p-8 mb-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <LucideIcons.Zap className="text-ares-cyan" size={16} /> ARES Points Balance
                </h3>
                <div className="bg-ares-cyan/10 border border-ares-cyan/30 px-4 py-2 ares-cut-sm">
                  {pointsLoading ? (
                    <span className="text-xl font-black text-ares-cyan/60 animate-pulse">Loading...</span>
                  ) : (
                    <span className="text-xl font-black text-ares-cyan">{points} pts</span>
                  )}
                </div>
              </div>

              {historyLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin w-5 h-5 border-2 border-ares-cyan border-t-transparent rounded-full" aria-hidden="true"></div>
                  <span className="ml-2 text-sm text-marble">Loading activity...</span>
                </div>
              ) : history && history.length > 0 ? (
                <div>
                  <h4 className="text-xs font-bold text-marble uppercase mb-3">Recent Activity</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                    {history.map((tx) => (
                      <div key={tx.id} className="bg-black/40 border border-white/5 ares-cut-sm p-3 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-white">{tx.reason}</p>
                          <p className="text-[10px] text-white/40">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'Unknown'}</p>
                        </div>
                        <span className={`text-sm font-black ${tx.points_delta > 0 ? "text-ares-cyan" : "text-ares-red"}`}>
                          {tx.points_delta > 0 ? "+" : ""}{tx.points_delta}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Admin / Private Details */}
          {(profile.emergencyContactName || profile.dietaryRestrictions || profile.tshirtSize) && (
             <div className="bg-ares-red/5 border border-ares-red/20 ares-cut p-6 mb-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-ares-red text-white text-[9px] font-black uppercase px-2 py-1 ares-cut-sm">Private / Admin Only</div>
               <h3 className="ares-badge-red mb-6 flex items-center gap-2"><Shield size={14} /> Internal Records</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                 {(profile.emergencyContactName || profile.emergencyContactPhone) && (
                   <div>
                     <p className="text-xs font-bold text-marble uppercase">Emergency Contact</p>
                     <p className="text-marble text-sm">{profile.emergencyContactName || "Unknown"}</p>
                     <p className="text-marble text-xs">{profile.emergencyContactPhone}</p>
                   </div>
                 )}
                 {profile.dietaryRestrictions && (
                   <div>
                     <p className="text-xs font-bold text-marble uppercase">Dietary Info</p>
                     <p className="text-marble text-sm">{JSON.parse(profile.dietaryRestrictions || "[]").join(", ")}</p>
                   </div>
                 )}
                 {profile.tshirtSize && (
                   <div>
                     <p className="text-xs font-bold text-marble uppercase">T-Shirt Size</p>
                     <p className="text-marble text-sm uppercase">{profile.tshirtSize}</p>
                   </div>
                 )}
               </div>
             </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {profile.rookieYear && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-marble uppercase tracking-wider mb-2">Rookie Year</p>
                <p className="text-marble text-sm">{profile.rookieYear}</p>
              </div>
            )}
            {profile.leadershipRole && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-red uppercase tracking-wider mb-2">Leadership Role</p>
                <p className="text-marble text-sm">{profile.leadershipRole}</p>
              </div>
            )}
            {profile.favoriteFirstThing && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-red uppercase tracking-wider mb-2">Favorite Thing About FIRST</p>
                <p className="text-marble text-sm">{profile.favoriteFirstThing}</p>
              </div>
            )}
            {profile.favoriteRobotMechanism && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Favorite Robot Mechanism</p>
                <p className="text-marble text-sm">{profile.favoriteRobotMechanism}</p>
              </div>
            )}
            {profile.preMatchSuperstition && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-red uppercase tracking-wider mb-2">Pre-Match Superstition</p>
                <p className="text-marble text-sm">{profile.preMatchSuperstition}</p>
              </div>
            )}
            {profile.funFact && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Fun Fact</p>
                <p className="text-marble text-sm">{profile.funFact}</p>
              </div>
            )}
            {profile.favoriteFood && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-ares-cyan uppercase tracking-wider mb-2">Favorite Food</p>
                <p className="text-marble text-sm">{profile.favoriteFood}</p>
              </div>
            )}
            {profile.gradeYear && (
              <div className="bg-white/5 border border-white/10 ares-cut p-6">
                <p className="text-xs font-bold text-marble uppercase tracking-wider mb-2">Class</p>
                <p className="text-marble text-sm">{profile.gradeYear}</p>
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
                      <p className="text-marble text-xs">{[col.degree, col.years].filter(Boolean).join(" Â· ")}</p>
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
                      <p className="text-white text-sm font-bold">{emp.name} {emp.current && <span className="text-ares-gold text-xs ml-1">â— Current</span>}</p>
                      <p className="text-marble text-xs">{[emp.title, emp.years].filter(Boolean).join(" Â· ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student Safety Notice */}
          {profile.memberType === "student" && (
            <div className="mt-8 flex items-center gap-2 text-marble/30 text-xs">
              <Shield size={12} /> Contact information protected per FIRST Youth Protection guidelines.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}



