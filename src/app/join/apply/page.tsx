"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Code2,
  Layers,
  Megaphone,
  Rocket,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import SEO from "@/components/SEO";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { GreekMeander } from "@/components/GreekMeander";

const SUBTEAMS = [
  {
    id: "cad_mechanical",
    title: "CAD & Mechanical Engineering",
    icon: Wrench,
    description: "3D CAD modeling in Onshape, custom CNC milling, 3D printing, and structural chassis assembly.",
  },
  {
    id: "software_controls",
    title: "Autonomous Software & Controls",
    icon: Code2,
    description: "Kotlin/Java robot architecture, Pedro Pathing / RoadRunner splines, computer vision, and EKF state estimation.",
  },
  {
    id: "strategy_scouting",
    title: "Strategy & Match Scouting",
    icon: ClipboardList,
    description: "Statistical match analytics, pit scouting workflows, alliance selection modeling, and drive team strategy.",
  },
  {
    id: "business_sponsorship",
    title: "Business & Corporate Sponsorship",
    icon: Layers,
    description: "Grant writing, sponsor deck creation, team budget tracking, and corporate partnership relationships.",
  },
  {
    id: "media_outreach",
    title: "Media Production & Community STEM",
    icon: Megaphone,
    description: "Team video production, website development, social outreach, and K-12 STEM workshops.",
  },
] as const;

const EXPERIENCE_TOOLS = [
  "Onshape CAD / 3D Modeling",
  "Java or Kotlin Programming",
  "Python / Data Analysis",
  "3D Printing & Slicing",
  "Electronics & Soldering",
  "Power Tools & Fabrication",
  "Graphic Design / Video Editing",
  "Public Speaking & Presentations",
] as const;

export default function JoinApplyWizardPage() {
  const [step, setStep] = useState<number>(1);

  // Form State
  const [subteams, setSubteams] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("9");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [experienceNotes, setExperienceNotes] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);

  const toggleSubteam = (id: string) => {
    setSubteams((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((item) => item !== tool) : [...prev, tool],
    );
  };

  const handleNextStep = () => {
    setSubmissionError(null);
    if (step === 1 && subteams.length === 0) {
      setSubmissionError("Please select at least one subteam interest to continue.");
      return;
    }
    if (step === 2) {
      if (!fullName.trim() || !email.trim() || !school.trim()) {
        setSubmissionError("Please provide your name, email, and school.");
        return;
      }
    }
    if (step === 4) {
      if (!parentName.trim() || !parentEmail.trim() || !consentConfirmed) {
        setSubmissionError("Parent or guardian contact and consent confirmation are required for youth applications.");
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const recaptchaToken = await getRecaptchaToken();
      const appCheckHeader = await getAppCheckHeader();

      const payload = {
        fullName,
        email,
        phone,
        school,
        grade,
        subteams,
        tools: selectedTools,
        experienceNotes,
        parentName,
        parentEmail,
        consentConfirmed,
        recaptchaToken,
      };

      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...appCheckHeader,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to submit application.");
      }

      // Generate randomized tracking confirmation code
      const generatedCode = `ARES-APP-${Math.floor(100000 + Math.random() * 900000)}`;
      setConfirmationCode(generatedCode);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during submission.";
      setSubmissionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-marble selection:bg-ares-red selection:text-white">
      <SEO
        title="Apply to Join Team 23247 | ARES Robotics"
        description="Interactive student interest application wizard for Morgantown high school & middle school students joining FIRST Tech Challenge Team ARES 23247."
      />

      {/* Hero Header */}
      <section className="relative border-b border-white/10 bg-gradient-to-b from-charcoal/80 to-obsidian py-14 px-6 sm:px-12">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/join"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-marble/60 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to Recruitment Overview</span>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-ares-gold/30 bg-ares-gold/10 px-3 py-1 text-xs font-bold text-ares-gold">
            <Rocket size={13} />
            <span>Season Recruitment Application</span>
          </div>

          <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Join the ARES Engineering Flight
          </h1>
          <p className="mt-2 text-sm text-marble/80">
            Complete this multi-step application to tell us about your STEM interests, engineering subteam preferences, and goals. No prior robotics experience is required!
          </p>

          {/* Stepper Progress Bar */}
          <div className="mt-8 flex items-center justify-between">
            {[
              { num: 1, label: "Subteams" },
              { num: 2, label: "Student Info" },
              { num: 3, label: "Experience" },
              { num: 4, label: "Youth Consent" },
              { num: 5, label: "Review & Submit" },
            ].map((s, idx) => (
              <div key={s.num} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      step >= s.num
                        ? "bg-ares-red text-white shadow-[0_0_12px_rgba(192,0,0,0.5)]"
                        : "border border-white/20 bg-black/40 text-marble/50"
                    }`}
                  >
                    {s.num}
                  </div>
                  <span className="hidden sm:inline mt-1 text-[11px] font-semibold text-marble/60">
                    {s.label}
                  </span>
                </div>
                {idx < 4 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 transition-colors ${
                      step > s.num ? "bg-ares-red" : "bg-white/10"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <GreekMeander />

      {/* Main Wizard Form Container */}
      <main className="mx-auto max-w-4xl px-6 py-12 sm:px-12">
        {confirmationCode ? (
          /* Confirmation Success Modal / Card */
          <div className="rounded-2xl border border-ares-gold/40 bg-gradient-to-b from-charcoal/80 to-black/90 p-8 sm:p-12 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ares-gold/20 text-ares-gold">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="mt-4 font-heading text-2xl sm:text-3xl font-extrabold text-white">
              Application Submitted Successfully!
            </h2>
            <p className="mt-2 text-sm text-marble/80 max-w-md mx-auto">
              Thank you for applying to ARES 23247! Our coaching staff and student leadership team will review your application and send meeting details to your email.
            </p>

            <div className="mt-6 inline-block rounded-xl border border-white/15 bg-black/60 px-6 py-4">
              <span className="text-xs uppercase tracking-widest text-marble/50 font-bold block">
                Application Reference Code
              </span>
              <span className="font-mono text-xl font-bold text-ares-gold mt-1 block">
                {confirmationCode}
              </span>
            </div>

            <div className="mt-8 flex justify-center gap-4">
              <Link
                to="/"
                className="rounded-lg bg-ares-red px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-ares-red/80 transition-colors"
              >
                Return to Home
              </Link>
              <Link
                to="/academy"
                className="rounded-lg border border-white/20 bg-white/5 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition-colors"
              >
                Explore ARES Academy
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-charcoal/40 p-6 sm:p-10 shadow-xl backdrop-blur-sm">
            {submissionError && (
              <div
                role="alert"
                className="mb-6 rounded-lg border border-ares-red/40 bg-ares-red/10 p-4 text-xs text-white"
              >
                {submissionError}
              </div>
            )}

            {/* STEP 1: Subteam Interest Selection */}
            {step === 1 && (
              <div>
                <h2 className="font-heading text-xl font-bold text-white sm:text-2xl">
                  1. Select Subteam Interests
                </h2>
                <p className="mt-1 text-xs text-marble/70">
                  Select all areas you are interested in exploring on the team.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {SUBTEAMS.map((subteam) => {
                    const isSelected = subteams.includes(subteam.id);
                    const Icon = subteam.icon;
                    return (
                      <div
                        key={subteam.id}
                        onClick={() => toggleSubteam(subteam.id)}
                        className={`rounded-xl border p-5 transition-all cursor-pointer ${
                          isSelected
                            ? "border-ares-gold bg-ares-gold/10 ring-1 ring-ares-gold/40 shadow-lg"
                            : "border-white/10 bg-black/30 hover:border-white/25 hover:bg-black/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                              isSelected
                                ? "bg-ares-gold text-obsidian"
                                : "bg-white/10 text-white"
                            }`}
                          >
                            <Icon size={20} />
                          </div>
                          <div>
                            <h3 className="font-heading text-sm font-bold text-white">
                              {subteam.title}
                            </h3>
                            <p className="mt-1 text-[11px] text-marble/70 leading-relaxed">
                              {subteam.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: Student Contact Information */}
            {step === 2 && (
              <div>
                <h2 className="font-heading text-xl font-bold text-white sm:text-2xl">
                  2. Student Information
                </h2>
                <p className="mt-1 text-xs text-marble/70">
                  Your student details are encrypted and kept confidential under FIRST YPP.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-marble/80 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Mercer"
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white focus:border-ares-red focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-marble/80 mb-1">
                      Student Email Address *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.org"
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white focus:border-ares-red focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-marble/80 mb-1">
                      Current School *
                    </label>
                    <input
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="Morgantown High School / Suncrest Middle"
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white focus:border-ares-red focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-marble/80 mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(304) 555-0199"
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white focus:border-ares-red focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-marble/80 mb-1">
                      Grade Level (2025-2026) *
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white focus:border-ares-red focus:outline-none"
                    >
                      <option value="6">6th Grade</option>
                      <option value="7">7th Grade</option>
                      <option value="8">8th Grade</option>
                      <option value="9">9th Grade (Freshman)</option>
                      <option value="10">10th Grade (Sophomore)</option>
                      <option value="11">11th Grade (Junior)</option>
                      <option value="12">12th Grade (Senior)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Prior Experience & Tools */}
            {step === 3 && (
              <div>
                <h2 className="font-heading text-xl font-bold text-white sm:text-2xl">
                  3. Skills &amp; Prior Experience
                </h2>
                <p className="mt-1 text-xs text-marble/70">
                  Select any tools or skills you have experience with (all optional!).
                </p>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {EXPERIENCE_TOOLS.map((tool) => {
                    const isSelected = selectedTools.includes(tool);
                    return (
                      <label
                        key={tool}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                          isSelected
                            ? "border-ares-red bg-ares-red/10 text-white"
                            : "border-white/10 bg-black/30 text-marble/70 hover:border-white/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTool(tool)}
                          className="h-4 w-4 rounded border-white/20 text-ares-red focus:ring-ares-red"
                        />
                        <span className="text-xs font-medium">{tool}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <label className="block text-xs font-bold text-marble/80 mb-1">
                    What excites you most about joining ARES? (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={experienceNotes}
                    onChange={(e) => setExperienceNotes(e.target.value)}
                    placeholder="Tell us what you hope to learn or build this season..."
                    className="w-full rounded-lg border border-white/15 bg-black/40 p-3 text-xs text-white focus:border-ares-red focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: Youth Protection & Parental Consent */}
            {step === 4 && (
              <div>
                <h2 className="font-heading text-xl font-bold text-white sm:text-2xl">
                  4. Youth Safety &amp; Parent / Guardian Consent
                </h2>
                <p className="mt-1 text-xs text-marble/70">
                  Required under the FIRST® Youth Protection Program for all minor participants.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-marble/80 mb-1">
                      Parent / Guardian Name *
                    </label>
                    <input
                      type="text"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Jordan Mercer"
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white focus:border-ares-red focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-marble/80 mb-1">
                      Parent / Guardian Email *
                    </label>
                    <input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="parent@example.org"
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white focus:border-ares-red focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-ares-gold/20 bg-ares-gold/5 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentConfirmed}
                      onChange={(e) => setConsentConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 text-ares-gold focus:ring-ares-gold"
                    />
                    <span className="text-xs text-marble/80 leading-relaxed">
                      I confirm that my parent or legal guardian has granted permission to submit this application to FIRST Tech Challenge Team 23247 (ARES) and consents to participate in team robotics activities.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 5: Review & Submit */}
            {step === 5 && (
              <div>
                <h2 className="font-heading text-xl font-bold text-white sm:text-2xl">
                  5. Review &amp; Submit Application
                </h2>
                <p className="mt-1 text-xs text-marble/70">
                  Please review your details before final encrypted submission.
                </p>

                <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-black/40 p-5 text-xs">
                  <div>
                    <span className="font-bold text-white">Student:</span> {fullName} ({email}) — Grade {grade}, {school}
                  </div>
                  <div>
                    <span className="font-bold text-white">Subteams Selected:</span>{" "}
                    {subteams.map((st) => SUBTEAMS.find((s) => s.id === st)?.title).join(", ") || "None"}
                  </div>
                  <div>
                    <span className="font-bold text-white">Experience / Tools:</span>{" "}
                    {selectedTools.join(", ") || "None specified"}
                  </div>
                  <div>
                    <span className="font-bold text-white">Parent / Guardian:</span> {parentName} ({parentEmail}) — Consent Verified
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Action Buttons */}
            <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((prev) => Math.max(prev - 1, 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Previous</span>
                </button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ares-red px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-ares-red/80 transition-colors shadow-lg cursor-pointer"
                >
                  <span>Next Step</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-ares-gold px-8 py-2.5 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-ares-gold/90 transition-colors shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  <ShieldCheck size={16} />
                  <span>{isSubmitting ? "Submitting Application..." : "Confirm & Submit Application"}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
