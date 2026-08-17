import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Info,
  User,
} from "lucide-react";

export type ProfileTab = "identity" | "subteams" | "career" | "privacy" | "safety";

const PROFILE_TABS: ReadonlyArray<{ id: ProfileTab; label: string }> = [
  { id: "identity", label: "Identity & Bio" },
  { id: "subteams", label: "Subteams & Roles" },
  { id: "career", label: "Education & Career" },
  { id: "privacy", label: "Contact & Privacy" },
  { id: "safety", label: "Logistics & Safety" },
];

export function ProfilePageHeader() {
  return (
    <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
          <User aria-hidden="true" size={12} /> User Settings
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">My Profile</h1>
        <p className="text-marble/70 text-sm mt-2">
          Manage your personal profile details, subteam roles, career history, and public roster privacy options.
        </p>
      </div>
    </header>
  );
}

interface ProfileAlertsProps {
  success: string | null;
  error: string | null;
}

export function ProfileAlerts({ success, error }: ProfileAlertsProps) {
  return (
    <AnimatePresence>
      {success && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-4 bg-ares-gold/10 border border-ares-gold/30 text-ares-gold ares-cut-sm flex items-center gap-3"
        >
          <CheckCircle aria-hidden="true" size={18} className="shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">{success}</span>
        </motion.div>
      )}
      {error && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-4 bg-ares-red border border-ares-red text-white flex items-center gap-3 ares-cut-sm"
        >
          <AlertTriangle aria-hidden="true" size={18} className="shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">{error}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function StudentPrivacyNotice() {
  return (
    <div className="p-4 bg-ares-gold/10 border border-ares-gold/20 ares-cut-sm flex items-start gap-3 text-ares-gold text-xs leading-normal mb-6">
      <Info aria-hidden="true" size={16} className="shrink-0 mt-0.5" />
      <div>
        <strong><i>FIRST</i>® Youth Protection Program Compliance Warning:</strong> Under the <i>FIRST</i>® Youth Protection Program (YPP) guidelines, your contact details (email and phone) are protected. They are only visible to team administrators and coaches, and are kept hidden from standard members and public directory outputs.
      </div>
    </div>
  );
}

interface ProfileTabNavigationProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}

export function ProfileTabNavigation({ activeTab, onTabChange }: ProfileTabNavigationProps) {
  return (
    <nav aria-label="Profile settings" className="lg:col-span-1 space-y-2">
      {PROFILE_TABS.map((tab) => (
        <button
          type="button"
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          aria-current={activeTab === tab.id ? "page" : undefined}
          className={`w-full text-left px-4 py-3 border ares-cut-sm transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-between group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
            activeTab === tab.id
              ? "bg-ares-red/15 text-white border-ares-red/45 shadow-[0_0_15px_rgba(192,0,0,0.1)]"
              : "text-marble/60 border-transparent hover:bg-white/5 hover:text-white"
          }`}
        >
          <span>{tab.label}</span>
          <ChevronRight aria-hidden="true" size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${activeTab === tab.id ? "opacity-100 text-ares-gold" : "text-marble/45"}`} />
        </button>
      ))}
    </nav>
  );
}
