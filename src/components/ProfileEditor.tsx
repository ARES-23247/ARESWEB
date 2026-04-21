import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, RefreshCw, Shield } from "lucide-react";
import { IdentityForm } from "./profile/IdentityForm";
import { RoleForm } from "./profile/RoleForm";
import { ContactForm } from "./profile/ContactForm";
import { LogisticsForm } from "./profile/LogisticsForm";
import { SecuritySettings } from "./profile/SecuritySettings";
import { ProfileData, CollegeEntry, EmployerEntry } from "./profile/types";

interface ProfileResponse extends Partial<ProfileData> {
  error?: string;
  subteams?: string | string[];
  dietary_restrictions?: string | string[];
  colleges?: string | CollegeEntry[];
  employers?: string | EmployerEntry[];
  auth?: { email: string; name: string; image?: string; id: string; };
}

const DEFAULT_PROFILE: ProfileData = {
  email: "",
  first_name: "", last_name: "", nickname: "", phone: "", contact_email: "", show_email: false, show_phone: false,
  pronouns: "", grade_year: "", subteams: [], member_type: "student",
  bio: "", favorite_food: "", dietary_restrictions: [],
  favorite_first_thing: "", fun_fact: "",
  colleges: [], employers: [], show_on_about: true,
  favorite_robot_mechanism: "", pre_match_superstition: "", leadership_role: "", rookie_year: "",
  tshirt_size: "", emergency_contact_name: "", emergency_contact_phone: "",
  parents_name: "", parents_email: "", students_name: "", students_email: "",
};

const safeJSONParse = <T,>(val: unknown, fallback: T): T => {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return parsed === null ? fallback : (parsed as T);
    } catch {
      return fallback;
    }
  }
  return val as T;
};

export default function ProfileEditor({ adminEditUserId }: { adminEditUserId?: string }) {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isMinor = profile.member_type === "student"; // Only students get PII-hidden treatment

  const getFetchUrl = () => adminEditUserId ? `/api/profile/${adminEditUserId}` : "/api/profile/me";
  const getSaveUrl = () => adminEditUserId ? `/api/admin/users/${adminEditUserId}` : "/api/profile/me";

  useEffect(() => {
    fetch(getFetchUrl(), { credentials: "include" })
      .then(r => r.json())
      .then((data: ProfileResponse) => {
        if (data && !data.error) {
          setProfile({
            ...DEFAULT_PROFILE,
            ...data,
            email: data.auth?.email || data.email || "",
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            subteams: safeJSONParse(data.subteams, []),
            dietary_restrictions: safeJSONParse(data.dietary_restrictions, []),
            colleges: safeJSONParse(data.colleges, []),
            employers: safeJSONParse(data.employers, []),
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
            parents_name: data.parents_name || "",
            parents_email: data.parents_email || "",
            students_name: data.students_name || "",
            students_email: data.students_email || "",
          });
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [fetchUrl]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch(fetchUrl, {
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

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;
  }

  const inputClass = "w-full bg-zinc-800/50 border border-zinc-700 ares-cut-sm px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-ares-red transition-colors";
  const labelClass = "text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block";
  const sectionClass = "bg-zinc-900/50 border border-zinc-800 ares-cut p-6 space-y-4";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Youth Protection Banner for Students */}
      {isMinor && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 ares-cut">
          <Shield className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-blue-200">
            <strong>FIRST Youth Protection:</strong> Your contact information (email, phone) is protected and never shown publicly. Only your nickname and avatar are visible to others.
          </p>
        </div>
      )}

      <IdentityForm profile={profile} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />
      <RoleForm profile={profile} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />
      <ContactForm profile={profile} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />
      <SecuritySettings profile={profile} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />
      <LogisticsForm profile={profile} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />

      {/* Save */}
      {message && (
        <div className={`p-4 ares-cut-sm text-sm font-semibold ${message.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
          {message.text}
        </div>
      )}
      <button onClick={handleSave} disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 py-4 font-bold bg-gradient-to-r from-ares-red to-red-700 hover:from-red-600 hover:to-red-800 text-white ares-cut shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-50"
      >
        {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
        {isSaving ? "Saving..." : "Save Profile"}
      </button>
    </motion.div>
  );
}
