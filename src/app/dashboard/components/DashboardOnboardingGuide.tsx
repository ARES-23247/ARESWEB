import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Compass,
  HelpCircle,
  UserCheck,
  X,
} from "lucide-react";

const ONBOARDING_STORAGE_KEY = "ares_dashboard_onboarding_dismissed_v1";

interface DashboardOnboardingGuideProps {
  isUnverified?: boolean;
}

const ONBOARDING_STEPS = [
  {
    step: "1",
    title: "Complete Your Member Profile",
    description:
      "Set your display nickname, avatar, and subteam focus so teammates can recognize you on boards and rosters.",
    href: "/dashboard/profile",
    cta: "Open Profile",
    icon: UserCheck,
  },
  {
    step: "2",
    title: "Start an Academy Learning Track",
    description:
      "Follow step-by-step robotics lessons covering Java/Kotlin, CAD & Hardware, Control Theory, and Team Operations.",
    href: "/academy",
    cta: "Browse Academy",
    icon: BookOpen,
  },
  {
    step: "3",
    title: "Check the Subteam Task Board",
    description:
      "Explore active engineering and outreach cards on the Kanban board and use the 'My Tasks' filter to focus your work.",
    href: "/dashboard/tasks",
    cta: "View Tasks",
    icon: ClipboardList,
  },
  {
    step: "4",
    title: "Sync the Team Calendar",
    description:
      "Subscribe to lab practice sessions, outreach demos, and FIRST Tech Challenge tournament dates on your phone or calendar app.",
    href: "/calendar",
    cta: "Open Calendar",
    icon: Calendar,
  },
] as const;

export default function DashboardOnboardingGuide({
  isUnverified = false,
}: DashboardOnboardingGuideProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // Ignore storage quota or privacy-mode errors.
    }
  };

  const handleRestore = () => {
    setDismissed(false);
    try {
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  };

  if (dismissed) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleRestore}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-marble/80 transition-colors hover:border-ares-gold/40 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan cursor-pointer"
        >
          <HelpCircle size={14} aria-hidden="true" />
          Show Getting Started Guide
        </button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="dashboard-onboarding-heading"
      className="glass-card border border-ares-gold/30 bg-black/35 p-6 rounded-2xl space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ares-gold/40 bg-ares-gold/15 text-ares-gold">
            <Compass size={20} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
              New Member Orientation
            </p>
            <h2
              id="dashboard-onboarding-heading"
              className="font-heading text-lg font-black uppercase tracking-tight text-white"
            >
              Getting Started with the ARES Portal
            </h2>
            <p className="mt-1 text-xs text-marble/75 max-w-2xl">
              {isUnverified
                ? "Welcome to ARES #23247! While a coach or administrator verifies your role for editing access, you can already get started with these four steps:"
                : "New to the team workspace? Follow these four steps to set up your profile, learn our tools, and join your subteam's workflow."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss Getting Started Guide"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-marble/65 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan cursor-pointer"
        >
          <X size={12} aria-hidden="true" />
          Dismiss guide
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ONBOARDING_STEPS.map(({ step, title, description, href, cta, icon: Icon }) => (
          <div
            key={step}
            className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/30 p-4 transition-colors hover:border-ares-gold/30"
          >
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center justify-center rounded-full bg-ares-gold/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-ares-gold">
                  Step {step}
                </span>
                <Icon size={16} className="text-ares-cyan" aria-hidden="true" />
              </div>
              <h3 className="font-heading text-sm font-bold text-white">
                {title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-marble/70">
                {description}
              </p>
            </div>
            <Link
              to={href}
              className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-ares-gold hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              {cta} &rarr;
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
