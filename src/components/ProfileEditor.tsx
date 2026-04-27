import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { Save, RefreshCw, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { IdentityForm } from "./profile/IdentityForm";
import { RoleForm } from "./profile/RoleForm";
import { ContactForm } from "./profile/ContactForm";
import { LogisticsForm } from "./profile/LogisticsForm";
import { SecuritySettings } from "./profile/SecuritySettings";
import { ProfileData } from "./profile/types";
import { useForm, useWatch } from "react-hook-form";


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
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { handleSubmit, reset, control } = useForm<ProfileData>({
    defaultValues: DEFAULT_PROFILE
  });

  const profileValues = useWatch({ control });

  const { data: meRes, isLoading: meLoading, isError: meError } = api.profiles.getMe.useQuery(["profile", "me"], undefined, {
    query: { enabled: !adminEditUserId }
  });

  const { data: adminRes, isLoading: adminLoading, isError: adminError } = api.users.adminGetProfile.useQuery(
    ["profile", adminEditUserId || "none"], 
    { params: { id: adminEditUserId || "" } }, 
    { query: { enabled: !!adminEditUserId } }
  );

  const profileRes = adminEditUserId ? adminRes : meRes;
  const isLoading = adminEditUserId ? adminLoading : meLoading;
  const isError = adminEditUserId ? adminError : meError;

  useEffect(() => {
    if (profileRes?.status === 200) {
      const data = adminEditUserId ? profileRes.body.profile : profileRes.body;
      reset({
        ...DEFAULT_PROFILE,
        ...data,
        email: data.auth?.email || "",
        subteams: safeJSONParse(data.subteams, []),
        dietary_restrictions: safeJSONParse(data.dietary_restrictions, []),
        colleges: safeJSONParse(data.colleges, []),
        employers: safeJSONParse(data.employers, []),
        show_email: Boolean(data.show_email),
        show_phone: Boolean(data.show_phone),
        show_on_about: data.show_on_about !== undefined ? Boolean(data.show_on_about) : true,
      });
    }
  }, [adminEditUserId, reset, profileRes]);

  const meMutation = api.profiles.updateMe.useMutation({
    onSuccess: () => {
      setMessage({ type: "success", text: "Profile saved!" });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (err: Error) => {
      setMessage({ type: "error", text: err.message || "Failed to save profile." });
    }
  });

  const adminMutation = api.users.updateUserProfile.useMutation({
    onSuccess: () => {
      setMessage({ type: "success", text: "Profile saved!" });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (err: Error) => {
      setMessage({ type: "error", text: err.message || "Failed to save profile." });
    }
  });

  const isPending = meMutation.isPending || adminMutation.isPending;

  const onFormSubmit = (data: ProfileData) => {
    const formatted = {
      ...data,
      subteams: JSON.stringify(data.subteams),
      dietary_restrictions: JSON.stringify(data.dietary_restrictions),
      colleges: JSON.stringify(data.colleges),
      employers: JSON.stringify(data.employers),
      show_email: data.show_email ? 1 : 0,
      show_phone: data.show_phone ? 1 : 0,
      show_on_about: data.show_on_about ? 1 : 0,
    };
    
    if (adminEditUserId) {
      adminMutation.mutate({ params: { id: adminEditUserId }, body: formatted });
    } else {
      meMutation.mutate({ body: formatted });
    }
  };

  const isMinor = profileValues.member_type === "student";

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;
  }

  const inputClass = "w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-sm text-white placeholder-marble/40 focus:outline-none focus:border-ares-red transition-colors";
  const labelClass = "text-xs font-bold text-marble/90 uppercase tracking-wider mb-1.5 block";
  const sectionClass = "bg-obsidian/50 border border-white/10 ares-cut p-6 space-y-4";

  // Manual setter helper for legacy sub-forms
  const setProfile = (updater: Partial<ProfileData> | ((prev: ProfileData) => Partial<ProfileData>)) => {
    const next = typeof updater === "function" ? updater(profileValues as ProfileData) : updater;
    reset({ ...profileValues, ...next } as ProfileData);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6 pb-8">
      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize personal identity records.
        </div>
      )}

      {/* Youth Protection Banner for Students */}
      {isMinor && (
        <div className="flex items-start gap-3 p-4 bg-ares-gold/10 border border-ares-gold/20 ares-cut">
          <Shield className="text-ares-gold flex-shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-marble">
            <strong>FIRST Youth Protection:</strong> Your contact information (email, phone) is protected and never shown publicly. Only your nickname and avatar are visible to others.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <IdentityForm profile={profileValues as ProfileData} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />
        <RoleForm profile={profileValues as ProfileData} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />
        <ContactForm profile={profileValues as ProfileData} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />
        <SecuritySettings profile={profileValues as ProfileData} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />
        <LogisticsForm profile={profileValues as ProfileData} setProfile={setProfile} isMinor={isMinor} inputClass={inputClass} labelClass={labelClass} sectionClass={sectionClass} />

        {/* Save */}
        {message && (
          <div className={`p-4 ares-cut-sm text-sm font-bold ${message.type === "success" ? "bg-ares-cyan/10 border border-ares-cyan/20 text-ares-cyan" : "bg-ares-red text-white shadow-lg shadow-ares-red/20"}`}>
            {message.text}
          </div>
        )}
        <button type="submit" disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-4 font-bold bg-gradient-to-r from-ares-red to-ares-bronze hover:from-ares-bronze hover:to-ares-red text-white ares-cut shadow-[0_0_30px_rgba(192,0,0,0.3)] transition-all disabled:opacity-50"
        >
          {isPending ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
          {isPending ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </motion.div>
  );
}
