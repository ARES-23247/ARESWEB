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
import IdentityTab from "./components/IdentityTab";
import SubteamsTab from "./components/SubteamsTab";
import CareerTab, { College, Employer } from "./components/CareerTab";
import PrivacyTab from "./components/PrivacyTab";
import SafetyTab from "./components/SafetyTab";

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
            
            {activeTab === "identity" && (
              <IdentityTab
                nickname={nickname}
                setNickname={setNickname}
                firstName={firstName}
                setFirstName={setFirstName}
                lastName={lastName}
                setLastName={setLastName}
                pronouns={pronouns}
                setPronouns={setPronouns}
                avatar={avatar}
                setAvatar={setAvatar}
                setIsAvatarCreatorOpen={setIsAvatarCreatorOpen}
                bio={bio}
                setBio={setBio}
                favoriteFirstThing={favoriteFirstThing}
                setFavoriteFirstThing={setFavoriteFirstThing}
                favoriteRobotMechanism={favoriteRobotMechanism}
                setFavoriteRobotMechanism={setFavoriteRobotMechanism}
                preMatchSuperstition={preMatchSuperstition}
                setPreMatchSuperstition={setPreMatchSuperstition}
                funFact={funFact}
                setFunFact={setFunFact}
              />
            )}

            {activeTab === "subteams" && (
              <SubteamsTab
                availableSubteams={availableSubteams}
                subteams={subteams}
                handleSubteamToggle={handleSubteamToggle}
                rookieYear={rookieYear}
                setRookieYear={setRookieYear}
                leadershipRole={leadershipRole}
                setLeadershipRole={setLeadershipRole}
                isAdmin={isAdmin}
                memberType={memberType}
                setMemberType={setMemberType}
              />
            )}

            {activeTab === "career" && (
              <CareerTab
                colleges={colleges}
                employers={employers}
                removeCollege={removeCollege}
                removeEmployer={removeEmployer}
                newColName={newColName}
                setNewColName={setNewColName}
                newColDomain={newColDomain}
                setNewColDomain={setNewColDomain}
                newColYears={newColYears}
                setNewColYears={setNewColYears}
                newColDegree={newColDegree}
                setNewColDegree={setNewColDegree}
                addCollege={addCollege}
                newEmpName={newEmpName}
                setNewEmpName={setNewEmpName}
                newEmpDomain={newEmpDomain}
                setNewEmpDomain={setNewEmpDomain}
                newEmpTitle={newEmpTitle}
                setNewEmpTitle={setNewEmpTitle}
                newEmpCurrent={newEmpCurrent}
                setNewEmpCurrent={setNewEmpCurrent}
                newEmpYears={newEmpYears}
                setNewEmpYears={setNewEmpYears}
                addEmployer={addEmployer}
              />
            )}

            {activeTab === "privacy" && (
              <PrivacyTab
                contactEmail={contactEmail}
                setContactEmail={setContactEmail}
                phone={phone}
                setPhone={setPhone}
                showOnAbout={showOnAbout}
                setShowOnAbout={setShowOnAbout}
                showEmail={showEmail}
                setShowEmail={setShowEmail}
                showPhone={showPhone}
                setShowPhone={setShowPhone}
              />
            )}

            {activeTab === "safety" && (
              <SafetyTab
                tshirtSize={tshirtSize}
                setTshirtSize={setTshirtSize}
                availableDietary={availableDietary}
                dietaryRestrictions={dietaryRestrictions}
                handleDietaryToggle={handleDietaryToggle}
                emergencyContactName={emergencyContactName}
                setEmergencyContactName={setEmergencyContactName}
                emergencyContactPhone={emergencyContactPhone}
                setEmergencyContactPhone={setEmergencyContactPhone}
              />
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
