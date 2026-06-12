"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  User, 
  Save, 
  GraduationCap, 
  Briefcase, 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Info,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AvatarEditor from "@/components/AvatarEditor";

interface College {
  name: string;
  domain: string;
  years: string;
  degree: string;
}

interface Employer {
  name: string;
  domain: string;
  title: string;
  current: boolean;
  years: string;
}

export default function DashboardProfilePage() {
  const { user, authorizedUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"identity" | "subteams" | "career" | "privacy" | "safety">("identity");

  // Form States
  const [nickname, setNickname] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [avatar, setAvatar] = useState("");
  const [isAvatarCreatorOpen, setIsAvatarCreatorOpen] = useState(false);
  const [bio, setBio] = useState("");
  const [funFact, setFunFact] = useState("");
  const [favoriteFirstThing, setFavoriteFirstThing] = useState("");
  const [favoriteRobotMechanism, setFavoriteRobotMechanism] = useState("");
  const [preMatchSuperstition, setPreMatchSuperstition] = useState("");
  const [rookieYear, setRookieYear] = useState("");
  const [leadershipRole, setLeadershipRole] = useState("");
  const [memberType, setMemberType] = useState("student");

  // Subteams Checkboxes
  const [subteams, setSubteams] = useState<string[]>([]);
  const availableSubteams = ["Programming", "CAD", "Mechanical", "Outreach", "Business"];

  // Logistics & Safety
  const [tshirtSize, setTshirtSize] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const availableDietary = ["Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy", "Dairy-Free"];

  // Contact Details
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showOnAbout, setShowOnAbout] = useState(true);

  // College & Career
  const [colleges, setColleges] = useState<College[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);

  // College Sub-form state
  const [newColName, setNewColName] = useState("");
  const [newColDomain, setNewColDomain] = useState("");
  const [newColYears, setNewColYears] = useState("");
  const [newColDegree, setNewColDegree] = useState("");

  // Employer Sub-form state
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpDomain, setNewEmpDomain] = useState("");
  const [newEmpTitle, setNewEmpTitle] = useState("");
  const [newEmpCurrent, setNewEmpCurrent] = useState(false);
  const [newEmpYears, setNewEmpYears] = useState("");

  const userRole = authorizedUser?.role || "Pending Verification";
  const isAdmin = userRole === "admin";

  useEffect(() => {
    const currentUser = user;
    if (!currentUser) return;

    async function loadProfile() {
      if (!currentUser) return;
      try {
        const docRef = doc(db, "user_profiles", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          setNickname(data.nickname || "");
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setPronouns(data.pronouns || "");
          setAvatar(data.avatar || "");
          setBio(data.bio || "");
          setFunFact(data.funFact || "");
          setFavoriteFirstThing(data.favoriteFirstThing || "");
          setFavoriteRobotMechanism(data.favoriteRobotMechanism || "");
          setPreMatchSuperstition(data.preMatchSuperstition || "");
          setRookieYear(data.rookieYear || "");
          setLeadershipRole(data.leadershipRole || "");
          setMemberType(data.memberType || "student");

          // Safe Array parses
          const parsedSubteams = Array.isArray(data.subteams) 
            ? data.subteams 
            : typeof data.subteams === "string" 
              ? JSON.parse(data.subteams || "[]") 
              : [];
          setSubteams(parsedSubteams);

          const parsedDietary = Array.isArray(data.dietaryRestrictions)
            ? data.dietaryRestrictions
            : typeof data.dietaryRestrictions === "string"
              ? JSON.parse(data.dietaryRestrictions || "[]")
              : [];
          setDietaryRestrictions(parsedDietary);

          setTshirtSize(data.tshirtSize || "");
          setEmergencyContactName(data.emergencyContactName || "");
          setEmergencyContactPhone(data.emergencyContactPhone || "");

          setPhone(data.phone || "");
          setContactEmail(data.contactEmail || "");
          setShowEmail(Boolean(data.showEmail));
          setShowPhone(Boolean(data.showPhone));
          setShowOnAbout(data.showOnAbout !== undefined ? Boolean(data.showOnAbout) : true);

          const parsedColleges = Array.isArray(data.colleges)
            ? data.colleges
            : typeof data.colleges === "string"
              ? JSON.parse(data.colleges || "[]")
              : [];
          setColleges(parsedColleges);

          const parsedEmployers = Array.isArray(data.employers)
            ? data.employers
            : typeof data.employers === "string"
              ? JSON.parse(data.employers || "[]")
              : [];
          setEmployers(parsedEmployers);
        } else {
          // Initialize defaults if profile document does not exist yet
          setNickname(currentUser.displayName || "");
          setContactEmail(currentUser.email || "");
        }
      } catch (err) {
        console.error("Failed to load user profile details:", err);
        setError("Could not retrieve profile from database.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  const handleSubteamToggle = (team: string) => {
    setSubteams(prev => 
      prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]
    );
  };

  const handleDietaryToggle = (item: string) => {
    setDietaryRestrictions(prev =>
      prev.includes(item) ? prev.filter(d => d !== item) : [...prev, item]
    );
  };

  const addCollege = () => {
    if (!newColName.trim()) return;
    setColleges(prev => [
      ...prev,
      {
        name: newColName.trim(),
        domain: newColDomain.trim(),
        years: newColYears.trim(),
        degree: newColDegree.trim()
      }
    ]);
    setNewColName("");
    setNewColDomain("");
    setNewColYears("");
    setNewColDegree("");
  };

  const removeCollege = (idx: number) => {
    setColleges(prev => prev.filter((_, i) => i !== idx));
  };

  const addEmployer = () => {
    if (!newEmpName.trim()) return;
    setEmployers(prev => [
      ...prev,
      {
        name: newEmpName.trim(),
        domain: newEmpDomain.trim(),
        title: newEmpTitle.trim(),
        current: newEmpCurrent,
        years: newEmpYears.trim()
      }
    ]);
    setNewEmpName("");
    setNewEmpDomain("");
    setNewEmpTitle("");
    setNewEmpCurrent(false);
    setNewEmpYears("");
  };

  const removeEmployer = (idx: number) => {
    setEmployers(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSuccess(null);
    setError(null);

    const profilePayload: Record<string, any> = {
      nickname: nickname.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      pronouns: pronouns.trim(),
      avatar: avatar.trim(),
      bio: bio.trim(),
      funFact: funFact.trim(),
      favoriteFirstThing: favoriteFirstThing.trim(),
      favoriteRobotMechanism: favoriteRobotMechanism.trim(),
      preMatchSuperstition: preMatchSuperstition.trim(),
      rookieYear: rookieYear.trim(),
      leadershipRole: leadershipRole.trim(),
      subteams,
      tshirtSize,
      dietaryRestrictions,
      emergencyContactName: emergencyContactName.trim(),
      emergencyContactPhone: emergencyContactPhone.trim(),
      phone: phone.trim(),
      contactEmail: contactEmail.trim(),
      showEmail: showEmail ? 1 : 0,
      showPhone: showPhone ? 1 : 0,
      showOnAbout: showOnAbout ? 1 : 0,
      colleges,
      employers,
      updatedAt: new Date().toISOString()
    };

    // SEC-F03: Do not write role/memberType updates unless the user is admin,
    // to strictly prevent parameter injection / privilege escalation
    if (isAdmin) {
      profilePayload.memberType = memberType;
    }

    try {
      const docRef = doc(db, "user_profiles", user.uid);
      await setDoc(docRef, profilePayload, { merge: true });
      
      setSuccess("Profile settings successfully synchronized and updated!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Failed to write user profile:", err);
      setError(err.message || "Failed to update profile settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 border-4 border-ares-gold/20 border-t-ares-gold rounded-full animate-spin text-ares-gold" />
          <span className="text-xs uppercase font-bold text-ares-gold/80 tracking-widest">Loading Settings Panel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <User size={12} /> User Settings
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
            My Profile
          </h1>
          <p className="text-marble/70 text-sm mt-2">
            Manage your personal profile details, subteam roles, career history, and public roster privacy options.
          </p>
        </div>
      </header>

      {/* Alerts */}
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 ares-cut-sm flex items-center gap-3"
          >
            <CheckCircle size={18} className="shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider">{success}</span>
          </motion.div>
        )}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0 }}
            className="p-4 bg-ares-red/10 border border-ares-red/30 text-ares-red flex items-center gap-3 ares-cut-sm"
          >
            <AlertTriangle size={18} className="shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Tabs (Sidebar Layout) */}
        <div className="lg:col-span-1 space-y-2">
          {[
            { id: "identity", label: "Identity & Bio" },
            { id: "subteams", label: "Subteams & Roles" },
            { id: "career", label: "Education & Career" },
            { id: "privacy", label: "Contact & Privacy" },
            { id: "safety", label: "Logistics & Safety" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full text-left px-4 py-3 border ares-cut-sm transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-between group cursor-pointer ${
                activeTab === tab.id
                  ? "bg-ares-red/15 text-white border-ares-red/45 shadow-[0_0_15px_rgba(192,0,0,0.1)]"
                  : "text-marble/60 border-transparent hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${activeTab === tab.id ? "opacity-100 text-ares-gold" : "text-marble/45"}`} />
            </button>
          ))}
        </div>

        {/* Form Area */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-8">
          <div className="glass-card p-8 border border-white/10 flex flex-col gap-6">
            
            {/* Tab 1: Identity & Bio */}
            {activeTab === "identity" && (
              <div className="space-y-6">
                <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
                  <Sparkles size={14} /> Identity Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Nickname *</label>
                    <input
                      type="text"
                      required
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. David"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="Legal first name"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="Legal last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Pronouns</label>
                    <input
                      type="text"
                      value={pronouns}
                      onChange={(e) => setPronouns(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. he/him"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Avatar Image URL</label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      {avatar && (
                        <div className="w-12 h-12 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center p-1 shrink-0">
                          <img src={avatar} alt="Avatar Preview" className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <input
                          type="url"
                          value={avatar}
                          onChange={(e) => setAvatar(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                          placeholder="https://..."
                        />
                        <button
                          type="button"
                          onClick={() => setIsAvatarCreatorOpen(true)}
                          className="px-3 py-1.5 bg-ares-gold/15 hover:bg-ares-gold/25 border border-ares-gold/30 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Customize Avatar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Biography</label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors resize-none"
                    placeholder="Tell us about your interest in robotics, engineering, or team role..."
                  />
                </div>

                <div className="h-px bg-white/5 my-4" />

                <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest pb-2.5 flex items-center gap-2">
                  <Info size={14} /> Fun & Trivia
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Favorite thing about FIRST</label>
                    <input
                      type="text"
                      value={favoriteFirstThing}
                      onChange={(e) => setFavoriteFirstThing(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. Gracious Professionalism, building code..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Favorite Robot Mechanism</label>
                    <input
                      type="text"
                      value={favoriteRobotMechanism}
                      onChange={(e) => setFavoriteRobotMechanism(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. Virtual Pivot Intake, active hang assembly..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Pre-match superstition</label>
                    <input
                      type="text"
                      value={preMatchSuperstition}
                      onChange={(e) => setPreMatchSuperstition(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. fist-bumping drive coach, checking telemetry offsets..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Fun Fact</label>
                    <input
                      type="text"
                      value={funFact}
                      onChange={(e) => setFunFact(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="A strange or unique fact about you..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Subteams & Roles */}
            {activeTab === "subteams" && (
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
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Rookie Year</label>
                    <input
                      type="text"
                      value={rookieYear}
                      onChange={(e) => setRookieYear(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. 2024"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Leadership / Custom Role</label>
                    <input
                      type="text"
                      value={leadershipRole}
                      onChange={(e) => setLeadershipRole(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. Programming Lead"
                    />
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-ares-red/80 tracking-wider mb-2">Member Type (Admin Only)</label>
                      <select
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
            )}

            {/* Tab 3: Colleges & Employers */}
            {activeTab === "career" && (
              <div className="space-y-8">
                
                {/* College Sub-form */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
                    <GraduationCap size={14} /> Higher Education
                  </h3>
                  
                  {colleges.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {colleges.map((col, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-black/30 border border-white/5 p-3 rounded-lg">
                          <div>
                            <p className="text-sm font-bold text-white">{col.name}</p>
                            <p className="text-marble/60 text-xs">
                              {col.degree} &middot; {col.years} &middot; Domain: {col.domain}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCollege(idx)}
                            className="p-1.5 bg-ares-red/10 border border-ares-red/20 text-ares-red hover:bg-ares-red hover:text-white rounded transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] uppercase font-bold text-marble/60 mb-1">College/University Name</label>
                      <input
                        type="text"
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        placeholder="e.g. West Virginia University"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Web Domain</label>
                      <input
                        type="text"
                        value={newColDomain}
                        onChange={(e) => setNewColDomain(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        placeholder="e.g. wvu.edu"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Degree / Major</label>
                      <input
                        type="text"
                        value={newColDegree}
                        onChange={(e) => setNewColDegree(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        placeholder="e.g. B.S. Computer Science"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Years Attended</label>
                      <input
                        type="text"
                        value={newColYears}
                        onChange={(e) => setNewColYears(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        placeholder="e.g. 2021-2025"
                      />
                    </div>
                    <div className="sm:col-span-4 flex justify-end">
                      <button
                        type="button"
                        onClick={addCollege}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold/25 border border-ares-gold/45 text-white rounded text-xs font-bold uppercase hover:bg-ares-gold transition-colors cursor-pointer"
                      >
                        <Plus size={12} /> Add College
                      </button>
                    </div>
                  </div>
                </div>

                {/* Employer Sub-form */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
                    <Briefcase size={14} /> Career & Employment
                  </h3>
                  
                  {employers.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {employers.map((emp, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-black/30 border border-white/5 p-3 rounded-lg">
                          <div>
                            <p className="text-sm font-bold text-white">
                              {emp.name} {emp.current && <span className="text-[10px] text-ares-gold ml-1 font-mono uppercase bg-ares-gold/10 border border-ares-gold/20 px-1 rounded">Current</span>}
                            </p>
                            <p className="text-marble/60 text-xs">
                              {emp.title} &middot; {emp.years} &middot; Domain: {emp.domain}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeEmployer(idx)}
                            className="p-1.5 bg-ares-red/10 border border-ares-red/20 text-ares-red hover:bg-ares-red hover:text-white rounded transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Company / Organization</label>
                      <input
                        type="text"
                        value={newEmpName}
                        onChange={(e) => setNewEmpName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        placeholder="e.g. NASA Goddard"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Web Domain</label>
                      <input
                        type="text"
                        value={newEmpDomain}
                        onChange={(e) => setNewEmpDomain(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        placeholder="e.g. nasa.gov"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Job Title</label>
                      <input
                        type="text"
                        value={newEmpTitle}
                        onChange={(e) => setNewEmpTitle(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        placeholder="e.g. Guidance Controls Intern"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Years Active</label>
                      <input
                        type="text"
                        value={newEmpYears}
                        onChange={(e) => setNewEmpYears(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        placeholder="e.g. 2024-Present"
                      />
                    </div>
                    <div className="sm:col-span-4 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-bold text-marble/70 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newEmpCurrent}
                          onChange={(e) => setNewEmpCurrent(e.target.checked)}
                          className="w-4 h-4 rounded border-white/10 bg-black/40 text-ares-gold focus:ring-ares-gold"
                        />
                        <span>Current Employer</span>
                      </label>
                      <button
                        type="button"
                        onClick={addEmployer}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold/25 border border-ares-gold/45 text-white rounded text-xs font-bold uppercase hover:bg-ares-gold transition-colors cursor-pointer"
                      >
                        <Plus size={12} /> Add Employer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Contact & Privacy */}
            {activeTab === "privacy" && (
              <div className="space-y-6">
                <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
                  <User size={14} /> Contact Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Contact Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. contact@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. 304-555-0199"
                    />
                  </div>
                </div>

                <div className="h-px bg-white/5 my-4" />

                <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest pb-2.5 flex items-center gap-2">
                  <Info size={14} /> Roster & Privacy Options
                </h3>

                <div className="space-y-4 bg-black/20 border border-white/5 p-5 rounded-xl">
                  <label className="flex items-start gap-3 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnAbout}
                      onChange={(e) => setShowOnAbout(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-red mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-white uppercase tracking-wider block">Display on Public Roster</span>
                      <span className="text-[10px] text-marble/60 leading-normal block mt-0.5">Allow your profile biography, nickname, and subteams to be listed on the public About page.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showEmail}
                      onChange={(e) => setShowEmail(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-red mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-white uppercase tracking-wider block">Show Email to Verified Members</span>
                      <span className="text-[10px] text-marble/60 leading-normal block mt-0.5">Expose your contact email to other logged-in team members in the internal directory.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPhone}
                      onChange={(e) => setShowPhone(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-red mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-white uppercase tracking-wider block">Show Phone to Verified Members</span>
                      <span className="text-[10px] text-marble/60 leading-normal block mt-0.5">Expose your phone number to other logged-in team members in the internal directory.</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Tab 5: Logistics & Safety */}
            {activeTab === "safety" && (
              <div className="space-y-6">
                <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
                  <User size={14} /> Logistics Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">T-shirt Size</label>
                    <select
                      value={tshirtSize}
                      onChange={(e) => setTshirtSize(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                    >
                      <option value="">Select size...</option>
                      <option value="xs">XS</option>
                      <option value="s">S</option>
                      <option value="m">M</option>
                      <option value="l">L</option>
                      <option value="xl">XL</option>
                      <option value="xxl">XXL</option>
                      <option value="3xl">3XL</option>
                    </select>
                  </div>
                </div>

                <div className="bg-black/25 border border-white/5 p-4 rounded-xl">
                  <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-3">Dietary Restrictions</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableDietary.map((item) => {
                      const isSelected = dietaryRestrictions.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleDietaryToggle(item)}
                          className={`px-4 py-3 ares-cut-sm border text-[10px] font-black uppercase tracking-wider text-center cursor-pointer transition-all ${
                            isSelected
                              ? "bg-ares-gold/20 text-ares-gold border-ares-gold/50"
                              : "bg-white/5 text-marble/65 border-transparent hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-px bg-white/5 my-4" />

                <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest pb-2.5 flex items-center gap-2">
                  <Info size={14} /> Emergency Contacts
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Emergency Contact Name</label>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Emergency Contact Phone</label>
                    <input
                      type="tel"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                      placeholder="e.g. 304-555-0100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Save Buttons Footer */}
            <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
              <button
                type="submit"
                disabled={saving}
                className="clipped-button bg-ares-red hover:bg-ares-red-dark transition-all text-white font-bold text-xs tracking-wider uppercase inline-flex items-center justify-center gap-2 px-6 py-3 shadow-xl hover:shadow-[0_0_15px_rgba(192,0,0,0.15)] active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Synchronizing...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Synchronize Profile
                  </>
                )}
              </button>
            </div>
            
          </div>
        </form>

      </div>
      {isAvatarCreatorOpen && (
        <AvatarEditor
          currentImage={avatar}
          onClose={() => setIsAvatarCreatorOpen(false)}
          onSave={(imageUrl) => setAvatar(imageUrl)}
        />
      )}
    </div>
  );
}
