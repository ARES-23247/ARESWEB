"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Save, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import AvatarEditor from "@/components/AvatarEditor";
import IdentityTab from "./components/IdentityTab";
import SubteamsTab from "./components/SubteamsTab";
import CareerTab, { College, Employer } from "./components/CareerTab";
import PrivacyTab from "./components/PrivacyTab";
import SafetyTab from "./components/SafetyTab";
import {
  ProfileAlerts,
  ProfilePageHeader,
  ProfileTabNavigation,
  StudentPrivacyNotice,
  type ProfileTab,
} from "./components/ProfilePageChrome";

interface ProfilePayload {
  nickname: string;
  firstName: string;
  lastName: string;
  pronouns: string;
  avatar: string;
  bio: string;
  funFact: string;
  favoriteFirstThing: string;
  favoriteRobotMechanism: string;
  preMatchSuperstition: string;
  rookieYear: string;
  leadershipRole: string;
  subteams: string[];
  tshirtSize: string;
  dietaryRestrictions: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  phone: string;
  contactEmail: string;
  showEmail: boolean;
  showPhone: boolean;
  showOnAbout: boolean;
  colleges: College[];
  employers: Employer[];
  memberType?: string;
}

interface ProfileResponse {
  exists: boolean;
  profile: ProfilePayload & { memberType: string };
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  let message = fallback;
  try {
    const data = await response.json() as { error?: string };
    if (data.error) message = data.error;
  } catch {
    // Preserve the HTTP diagnostic when the upstream response has no JSON body.
  }
  return new Error(`HTTP ${response.status}: ${response.statusText || "Request failed"}. ${message}`);
}

export default function DashboardProfilePage() {
  const { user, authorizedUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provisioningZulip, setProvisioningZulip] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("identity");

  const handleSelfProvisionZulip = async () => {
    setProvisioningZulip(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await authenticatedFetch("/api/profiles/zulip/self-provision", {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to provision Zulip account.");
      }
      setSuccess("Zulip account provisioned successfully! Log into aresfirst.zulipchat.com with your Google account.");
      setTimeout(() => setSuccess(null), 6000);
    } catch (err: any) {
      console.error("Zulip self-provision error:", err);
      setError(err.message || "Failed to provision Zulip account.");
    } finally {
      setProvisioningZulip(false);
    }
  };

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
  const [showOnAbout, setShowOnAbout] = useState(false);

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
  const isAdmin = userRole === "admin" || userRole === "coach";

  useEffect(() => {
    const currentUser = user;
    if (!currentUser) return;

    async function loadProfile() {
      if (!currentUser) return;
      try {
        const response = await authenticatedFetch("/api/profiles/me");
        if (!response.ok) throw await responseError(response, "Could not retrieve profile details.");
        const result = await response.json() as ProfileResponse;
        const data = result.profile;

        if (result.exists) {
          
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

          setSubteams(data.subteams);
          setDietaryRestrictions(data.dietaryRestrictions);

          setTshirtSize(data.tshirtSize || "");
          setEmergencyContactName(data.emergencyContactName || "");
          setEmergencyContactPhone(data.emergencyContactPhone || "");

          setPhone(data.phone || "");
          setContactEmail(data.contactEmail || "");
          setShowEmail(Boolean(data.showEmail));
          setShowPhone(Boolean(data.showPhone));
          setShowOnAbout(data.showOnAbout);
          setColleges(data.colleges);
          setEmployers(data.employers);
        } else {
          // Initialize defaults if profile document does not exist yet
          // OAuth display names may be legal names, so never use them as public nicknames.
          setNickname("");
          setContactEmail(currentUser.email || "");
        }
      } catch (err) {
        console.error("Failed to load user profile details:", err);
        setError(err instanceof Error ? err.message : "Could not retrieve profile details.");
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

    if (showOnAbout && !nickname.trim()) {
      setSaving(false);
      setError("Choose a public nickname before displaying this profile on the public roster.");
      return;
    }

    const profilePayload: ProfilePayload = {
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
      // Student contact visibility is forced off at the serialization boundary,
      // including when a legacy document still contains enabled flags.
      showEmail: memberType === "student" ? false : showEmail,
      showPhone: memberType === "student" ? false : showPhone,
      showOnAbout,
      colleges,
      employers,
    };

    // SEC-F03: Do not write role/memberType updates unless the user is admin,
    // to strictly prevent parameter injection / privilege escalation
    if (isAdmin) {
      profilePayload.memberType = memberType;
    }

    try {
      const response = await authenticatedFetch("/api/profiles/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });
      if (!response.ok) throw await responseError(response, "Failed to update profile settings.");
      const result = await response.json() as ProfileResponse & { success: boolean };
      setMemberType(result.profile.memberType);
      setShowEmail(result.profile.showEmail);
      setShowPhone(result.profile.showPhone);
      
      setSuccess("Profile settings saved securely.");
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
      <ProfilePageHeader
        canProvisionZulip={userRole !== "unverified" && userRole !== "Pending Verification"}
        isProvisioning={provisioningZulip}
        onProvisionZulip={() => void handleSelfProvisionZulip()}
      />
      <ProfileAlerts success={success} error={error} />
      {memberType === "student" && <StudentPrivacyNotice />}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        <ProfileTabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

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
                isStudent={memberType === "student"}
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
                isStudent={memberType === "student"}
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
                className="clipped-button bg-ares-red hover:bg-ares-bronze transition-all text-white font-bold text-xs tracking-wider uppercase inline-flex items-center justify-center gap-2 px-6 py-3 shadow-xl active:scale-95 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save Profile
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
