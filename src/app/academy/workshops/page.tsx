"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  Calendar,
  Clock,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Shield,
  ShieldCheck,
  MapPin,
  Laptop,
  Box,
  Code2,
  Activity,
  Zap,
  ChevronRight,
  Send,
  Loader2,
  HeartHandshake,
} from "lucide-react";
import SEO from "@/components/SEO";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";
import { logger } from "@/utils/logger";
import {
  WORKSHOP_MODULES,
  WORKSHOP_CATEGORIES,
  GRADE_LEVELS,
  EXPERIENCE_LEVELS,
  MENTOR_SKILL_TAGS,
  filterWorkshops,
  validateStudentRegistration,
  validateMentorSignup,
  type WorkshopSession,
  type WorkshopCategory,
  type WorkshopLevel,
  type StudentRegistration,
  type MentorShiftSignup,
} from "@/lib/workshopCurriculumData";

export default function AcademyWorkshopsPage() {
  const [selectedCategory, setSelectedCategory] = useState<WorkshopCategory | "all">("all");
  const [selectedLevel, setSelectedLevel] = useState<WorkshopLevel | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Student registration modal state
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState<Partial<StudentRegistration>>({
    studentNickname: "",
    parentGuardianName: "",
    parentGuardianEmail: "",
    parentGuardianPhone: "",
    gradeLevel: "",
    priorExperience: "",
    dietaryOrAccessibilityNeeds: "",
    workshopId: "",
    sessionId: "",
    yppParentConsent: false,
    photoConsent: false,
  });
  const [studentErrors, setStudentErrors] = useState<Record<string, string>>({});
  const [studentSubmitting, setStudentSubmitting] = useState(false);
  const [studentSuccess, setStudentSuccess] = useState(false);
  const [studentGlobalError, setStudentGlobalError] = useState<string | null>(null);

  // Mentor signup modal state
  const [mentorModalOpen, setMentorModalOpen] = useState(false);
  const [mentorForm, setMentorForm] = useState<Partial<MentorShiftSignup>>({
    name: "",
    email: "",
    phone: "",
    workshopId: "",
    sessionId: "",
    role: "mentor",
    skills: [],
    availabilityNotes: "",
  });
  const [mentorErrors, setMentorErrors] = useState<Record<string, string>>({});
  const [mentorSubmitting, setMentorSubmitting] = useState(false);
  const [mentorSuccess, setMentorSuccess] = useState(false);
  const [mentorGlobalError, setMentorGlobalError] = useState<string | null>(null);

  // Focus traps for modals
  const studentModalRef = useFocusTrap(studentModalOpen, () => setStudentModalOpen(false));
  const mentorModalRef = useFocusTrap(mentorModalOpen, () => setMentorModalOpen(false));

  const filteredModules = useMemo(() => {
    return filterWorkshops(WORKSHOP_MODULES, {
      category: selectedCategory,
      level: selectedLevel,
      search: searchQuery,
    });
  }, [selectedCategory, selectedLevel, searchQuery]);

  const openStudentRegistration = useCallback((workshopId?: string, sessionId?: string) => {
    const targetWorkshop = workshopId || WORKSHOP_MODULES[0]?.id || "";
    const w = WORKSHOP_MODULES.find((m) => m.id === targetWorkshop);
    const targetSession = sessionId || w?.sessions[0]?.id || "";

    setStudentForm({
      studentNickname: "",
      parentGuardianName: "",
      parentGuardianEmail: "",
      parentGuardianPhone: "",
      gradeLevel: "",
      priorExperience: "",
      dietaryOrAccessibilityNeeds: "",
      workshopId: targetWorkshop,
      sessionId: targetSession,
      yppParentConsent: false,
      photoConsent: false,
    });
    setStudentErrors({});
    setStudentGlobalError(null);
    setStudentSuccess(false);
    setStudentModalOpen(true);
  }, []);

  const openMentorSignup = useCallback((workshopId?: string, sessionId?: string) => {
    const targetWorkshop = workshopId || WORKSHOP_MODULES[0]?.id || "";
    const w = WORKSHOP_MODULES.find((m) => m.id === targetWorkshop);
    const targetSession = sessionId || w?.sessions[0]?.id || "";

    setMentorForm({
      name: "",
      email: "",
      phone: "",
      workshopId: targetWorkshop,
      sessionId: targetSession,
      role: "mentor",
      skills: [],
      availabilityNotes: "",
    });
    setMentorErrors({});
    setMentorGlobalError(null);
    setMentorSuccess(false);
    setMentorModalOpen(true);
  }, []);

  const handleStudentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStudentGlobalError(null);

    const validation = validateStudentRegistration(studentForm);
    if (!validation.isValid) {
      setStudentErrors(validation.errors);
      return;
    }
    setStudentErrors({});
    setStudentSubmitting(true);

    try {
      const recaptchaToken = await getRecaptchaToken();
      let appCheckHeaders = (await getAppCheckHeader()) || {};
      if (!appCheckHeaders["X-Firebase-AppCheck"]) {
        appCheckHeaders = (await getAppCheckHeader(true)) || {};
      }

      const selectedWorkshop = WORKSHOP_MODULES.find((m) => m.id === studentForm.workshopId);
      const selectedSession = selectedWorkshop?.sessions.find((s) => s.id === studentForm.sessionId);

      const payload = {
        type: "student",
        name: studentForm.parentGuardianName?.trim(),
        email: studentForm.parentGuardianEmail?.trim(),
        recaptchaToken,
        metadata: {
          inquiryKind: "stem_workshop_registration",
          studentNickname: studentForm.studentNickname?.trim(),
          parentGuardianName: studentForm.parentGuardianName?.trim(),
          parentGuardianEmail: studentForm.parentGuardianEmail?.trim(),
          parentGuardianPhone: studentForm.parentGuardianPhone?.trim(),
          gradeLevel: studentForm.gradeLevel,
          priorExperience: studentForm.priorExperience,
          dietaryOrAccessibilityNeeds: studentForm.dietaryOrAccessibilityNeeds?.trim() || "None specified",
          workshopId: studentForm.workshopId,
          workshopTitle: selectedWorkshop?.title || "STEM Workshop",
          sessionId: studentForm.sessionId,
          sessionDate: selectedSession?.date || "",
          sessionTime: selectedSession?.time || "",
          yppParentConsent: studentForm.yppParentConsent,
          photoConsent: studentForm.photoConsent,
          message: `STEM Workshop Pre-Registration: ${selectedWorkshop?.title} (${selectedSession?.date} ${selectedSession?.time}) for student [${studentForm.studentNickname?.trim()}]`,
        },
      };

      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...appCheckHeaders,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit workshop pre-registration.");
      }

      setStudentSuccess(true);
    } catch (err: unknown) {
      logger.error("Student workshop pre-registration error:", err);
      setStudentGlobalError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while submitting your registration. Please try again."
      );
    } finally {
      setStudentSubmitting(false);
    }
  };

  const handleMentorSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMentorGlobalError(null);

    const validation = validateMentorSignup(mentorForm);
    if (!validation.isValid) {
      setMentorErrors(validation.errors);
      return;
    }
    setMentorErrors({});
    setMentorSubmitting(true);

    try {
      const recaptchaToken = await getRecaptchaToken();
      let appCheckHeaders = (await getAppCheckHeader()) || {};
      if (!appCheckHeaders["X-Firebase-AppCheck"]) {
        appCheckHeaders = (await getAppCheckHeader(true)) || {};
      }

      const selectedWorkshop = WORKSHOP_MODULES.find((m) => m.id === mentorForm.workshopId);
      const selectedSession = selectedWorkshop?.sessions.find((s) => s.id === mentorForm.sessionId);

      const payload = {
        type: "mentor",
        name: mentorForm.name?.trim(),
        email: mentorForm.email?.trim(),
        recaptchaToken,
        metadata: {
          inquiryKind: "stem_workshop_mentor_shift",
          mentorName: mentorForm.name?.trim(),
          mentorEmail: mentorForm.email?.trim(),
          mentorPhone: mentorForm.phone?.trim() || undefined,
          role: mentorForm.role,
          skills: mentorForm.skills || [],
          workshopId: mentorForm.workshopId,
          workshopTitle: selectedWorkshop?.title || "STEM Workshop",
          sessionId: mentorForm.sessionId,
          sessionDate: selectedSession?.date || "",
          sessionTime: selectedSession?.time || "",
          availabilityNotes: mentorForm.availabilityNotes?.trim() || "None",
          message: `Mentor Shift Sign-Up: ${selectedWorkshop?.title} (${selectedSession?.date}) - Skills: ${(mentorForm.skills || []).join(", ")}`,
        },
      };

      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...appCheckHeaders,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit mentor volunteer shift.");
      }

      setMentorSuccess(true);
    } catch (err: unknown) {
      logger.error("Mentor volunteer signup error:", err);
      setMentorGlobalError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while submitting your mentor sign-up. Please try again."
      );
    } finally {
      setMentorSubmitting(false);
    }
  };

  const toggleMentorSkill = (skill: string) => {
    const current = mentorForm.skills || [];
    if (current.includes(skill)) {
      setMentorForm({ ...mentorForm, skills: current.filter((s) => s !== skill) });
    } else {
      setMentorForm({ ...mentorForm, skills: [...current, skill] });
    }
  };

  const getCategoryIcon = (category: WorkshopCategory) => {
    switch (category) {
      case "cad":
        return <Box className="w-5 h-5 text-ares-gold" />;
      case "programming":
        return <Code2 className="w-5 h-5 text-ares-cyan" />;
      case "motion-control":
        return <Activity className="w-5 h-5 text-ares-red" />;
      case "electrical":
        return <Zap className="w-5 h-5 text-amber-400" />;
      default:
        return <GraduationCap className="w-5 h-5 text-ares-gold" />;
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col w-full selection:bg-ares-red selection:text-white">
      <SEO
        title="STEM Workshops & Coaching Portal"
        description="Browse ARES Academy STEM workshop curricula, pre-register student learners with Zero PII protection, and sign up for volunteer coaching shifts."
      />

      {/* ── Breadcrumb & Navigation Bar ────────────────────────────── */}
      <nav aria-label="Breadcrumbs" className="border-b border-white/10 bg-black/40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Link to="/academy" className="hover:text-white transition-colors flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <GraduationCap size={14} className="text-ares-red" />
              ARES Academy
            </Link>
            <ChevronRight size={12} />
            <span className="text-ares-gold font-bold uppercase tracking-wider">Workshops & Coaching</span>
          </div>
          <Link
            to="/academy"
            className="text-xs uppercase font-bold tracking-widest text-ares-gold hover:text-white transition-colors flex items-center gap-1"
          >
            ← Back to Lessons
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-black/80 via-obsidian to-obsidian py-16 px-6">
        <div className="absolute inset-0 bg-ares-red/5 bg-[radial-gradient(ellipse_at_top_right,rgba(192,0,0,0.15)_0,rgba(0,0,0,0)_70%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-ares-red/15 border border-ares-red/30 text-ares-gold text-xs font-bold uppercase tracking-widest mb-6 ares-cut-sm">
            <Sparkles size={14} />
            Hands-On Engineering Cohorts · Fall 2026
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black font-heading uppercase tracking-tight text-white mb-6 leading-tight">
            STEM Workshop <span className="bg-ares-red px-3 py-0.5 text-white inline-block">Curriculum</span> & Coaching
          </h1>

          <p className="text-lg sm:text-xl text-marble/80 max-w-3xl leading-relaxed mb-8">
            Master competition robotics through immersive engineering labs in Morgantown, WV and online.
            Featuring 1:4 mentor-to-student coaching ratios, real FTC hardware, and full FIRST® Youth Protection Program (YPP) compliance.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl pt-4 border-t border-white/10">
            <div className="p-4 bg-white/5 border border-white/5 ares-cut-sm">
              <div className="text-2xl font-black font-heading text-white">4 Specialized Tracks</div>
              <div className="text-xs text-marble/60 uppercase tracking-wider mt-1">CAD, Code, Motion & Wiring</div>
            </div>
            <div className="p-4 bg-white/5 border border-white/5 ares-cut-sm">
              <div className="text-2xl font-black font-heading text-ares-gold">1:4 Ratio</div>
              <div className="text-xs text-marble/60 uppercase tracking-wider mt-1">Dedicated Mentor Guidance</div>
            </div>
            <div className="p-4 bg-white/5 border border-white/5 ares-cut-sm">
              <div className="text-2xl font-black font-heading text-ares-cyan">Zero Student PII</div>
              <div className="text-xs text-marble/60 uppercase tracking-wider mt-1">Encrypted Payload Defense</div>
            </div>
            <div className="p-4 bg-white/5 border border-white/5 ares-cut-sm">
              <div className="text-2xl font-black font-heading text-white">FIRST® YPP</div>
              <div className="text-xs text-marble/60 uppercase tracking-wider mt-1">Verified Adult Supervision</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-8">
            <button
              type="button"
              onClick={() => openStudentRegistration()}
              className="px-6 py-3 bg-ares-red hover:bg-ares-red-light text-white font-bold uppercase tracking-widest text-xs ares-cut-sm transition-all shadow-lg flex items-center gap-2"
            >
              <Users size={16} /> Pre-Register Student
            </button>
            <button
              type="button"
              onClick={() => openMentorSignup()}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold uppercase tracking-widest text-xs ares-cut-sm transition-all flex items-center gap-2"
            >
              <HeartHandshake size={16} /> Volunteer as Coach / Mentor
            </button>
          </div>
        </div>
      </section>

      {/* ── Filter & Search Toolbar ────────────────────────────────── */}
      <section className="bg-black/50 border-b border-white/10 px-6 py-6 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Curriculum category filter">
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ares-cut-sm transition-colors ${
                selectedCategory === "all"
                  ? "bg-ares-red text-white"
                  : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10 border border-white/5"
              }`}
            >
              All Modules ({WORKSHOP_MODULES.length})
            </button>
            {WORKSHOP_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ares-cut-sm transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-ares-red text-white"
                    : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10 border border-white/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Level Filter & Search */}
          <div className="flex items-center gap-3">
            <select
              aria-label="Filter workshops by experience level"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as WorkshopLevel | "all")}
              className="bg-obsidian border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
            >
              <option value="all">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>

            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics, software..."
                aria-label="Search workshop curriculum"
                className="w-full bg-obsidian border border-white/15 pl-9 pr-8 py-2 text-xs text-white placeholder:text-marble/40 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-marble/50 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Curriculum Cards Section ───────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-12 flex-1 w-full space-y-12">
        {filteredModules.length === 0 ? (
          <div className="text-center py-20 border border-white/10 bg-white/5 p-8 ares-cut">
            <GraduationCap size={48} className="mx-auto text-marble/30 mb-4" />
            <h2 className="text-2xl font-bold font-heading uppercase text-white">No Matching Workshops Found</h2>
            <p className="text-marble/60 text-sm mt-2 max-w-md mx-auto">
              No curriculum modules matched your search and filter criteria. Try clearing filters or searching for terms like &quot;Onshape&quot;, &quot;Java&quot;, &quot;PID&quot;, or &quot;CAN Bus&quot;.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("all");
                setSelectedLevel("all");
                setSearchQuery("");
              }}
              className="mt-6 px-4 py-2 bg-ares-red text-white text-xs font-bold uppercase tracking-wider ares-cut-sm"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredModules.map((module) => (
              <article
                key={module.id}
                className="border border-white/10 bg-black/40 ares-cut hover:border-white/20 transition-all shadow-xl overflow-hidden"
              >
                {/* Module Header */}
                <div className="p-6 md:p-8 border-b border-white/10 bg-gradient-to-r from-white/[0.03] to-transparent">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white/5 border border-white/10 ares-cut-sm">
                        {getCategoryIcon(module.category)}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-ares-gold">
                        {module.categoryLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider ares-cut-sm">
                        {module.level}
                      </span>
                      <span className="px-2.5 py-0.5 bg-ares-cyan/15 text-ares-cyan border border-ares-cyan/30 text-[11px] font-bold uppercase tracking-wider ares-cut-sm">
                        {module.targetAudience}
                      </span>
                      <span className="px-2.5 py-0.5 bg-white/5 text-marble/80 border border-white/10 text-[11px] font-mono ares-cut-sm flex items-center gap-1">
                        <Clock size={12} /> {module.duration}
                      </span>
                      <span className="px-2.5 py-0.5 bg-ares-gold/15 text-ares-gold border border-ares-gold/30 text-[11px] font-bold uppercase tracking-wider ares-cut-sm flex items-center gap-1">
                        <Users size={12} /> {module.coachingRatio}
                      </span>
                    </div>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black font-heading uppercase text-white tracking-tight mb-3">
                    {module.title}
                  </h2>
                  <p className="text-marble/80 text-sm leading-relaxed max-w-4xl">
                    {module.shortDescription}
                  </p>
                </div>

                {/* Module Curriculum Details Grid */}
                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-white/10 bg-white/[0.01]">
                  {/* Left Column: Learning Objectives */}
                  <div>
                    <h3 className="text-xs font-black font-heading uppercase tracking-[0.2em] text-ares-gold mb-4 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-ares-red" />
                      Core Learning Objectives
                    </h3>
                    <ul className="space-y-2.5 text-sm text-marble/90">
                      {module.learningObjectives.map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-ares-red mt-2 shrink-0" />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Right Column: Topics, Prerequisites & Software */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-black font-heading uppercase tracking-[0.2em] text-ares-gold mb-3">
                        Featured Topics & Skills
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {module.featuredTopics.map((topic, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-white/5 border border-white/10 text-marble text-xs ares-cut-sm"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-black font-heading uppercase tracking-[0.2em] text-ares-gold mb-3">
                        Software & Tooling Stack
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {module.software.map((sw, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-ares-red/10 border border-ares-red/20 text-white text-xs font-bold ares-cut-sm"
                          >
                            {sw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-black font-heading uppercase tracking-[0.2em] text-ares-gold mb-2">
                        Prerequisites & Preparation
                      </h3>
                      <ul className="text-xs text-marble/70 space-y-1">
                        {module.prerequisites.map((pre, idx) => (
                          <li key={idx}>• {pre}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Module Coaching Sessions Schedule Table */}
                <div className="p-6 md:p-8 bg-black/60">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black font-heading uppercase tracking-[0.2em] text-white flex items-center gap-2">
                      <Calendar size={14} className="text-ares-red" />
                      Upcoming Coaching Shifts & Live Sessions
                    </h3>
                    <span className="text-[11px] text-marble/60 uppercase tracking-widest">
                      Registration Open
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {module.sessions.map((sess: WorkshopSession) => (
                      <div
                        key={sess.id}
                        className="p-4 bg-white/5 border border-white/10 ares-cut-sm flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm flex items-center gap-1.5">
                              <Calendar size={13} className="text-ares-gold" />
                              {sess.date}
                            </span>
                            <span className="text-xs font-mono text-ares-cyan bg-ares-cyan/10 px-2 py-0.5 ares-cut-sm">
                              {sess.time}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-marble/70">
                            {sess.isVirtual ? (
                              <Laptop size={13} className="text-ares-cyan shrink-0" />
                            ) : (
                              <MapPin size={13} className="text-ares-red shrink-0" />
                            )}
                            <span className="truncate">{sess.location}</span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-marble/60 pt-2 border-t border-white/5">
                            <div>
                              Student Capacity:{" "}
                              <span className="font-bold text-white">
                                {sess.availableSeats} / {sess.totalSeats} seats open
                              </span>
                            </div>
                            <div>
                              Coaches:{" "}
                              <span className="font-bold text-ares-gold">
                                {sess.mentorSlotsAvailable} / {sess.mentorSlotsTotal} slots
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => openStudentRegistration(module.id, sess.id)}
                            className="flex-1 px-3 py-2 bg-ares-red hover:bg-ares-red-light text-white text-xs font-bold uppercase tracking-wider ares-cut-sm transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Users size={13} /> Pre-Register Student
                          </button>
                          <button
                            type="button"
                            onClick={() => openMentorSignup(module.id, sess.id)}
                            className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-wider ares-cut-sm transition-colors flex items-center justify-center gap-1.5"
                          >
                            <HeartHandshake size={13} /> Mentor Shift
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ── Zero Student PII & FIRST® YPP Security Section ────────── */}
        <section className="border border-white/10 bg-black/40 p-8 ares-cut grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan ares-cut-sm shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-1">
                Zero Student PII Storage
              </h4>
              <p className="text-xs text-marble/70 leading-relaxed">
                Student public profiles only expose designated nicknames/callsigns. Inquiries and contact info are client-encrypted and safeguarded by strict Firebase App Check and reCAPTCHA protections.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-ares-red/10 border border-ares-red/30 text-ares-red ares-cut-sm shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-1">
                FIRST® YPP Certified
              </h4>
              <p className="text-xs text-marble/70 leading-relaxed">
                All coaching sessions maintain 2-deep adult mentor coverage in compliance with FIRST® Youth Protection Program guidelines. Parent/guardian consent is confirmed prior to participation.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-ares-gold/10 border border-ares-gold/30 text-ares-gold ares-cut-sm shrink-0">
              <Sparkles size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-1">
                Inclusive STEM Access
              </h4>
              <p className="text-xs text-marble/70 leading-relaxed">
                Workshops are 100% free and open to all middle and high school students. Hardware, tools, and personalized accommodations are provided without barrier.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Student Pre-Registration Modal ──────────────────────────── */}
      {studentModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setStudentModalOpen(false)}
        >
          <div
            ref={studentModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-modal-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-obsidian border border-white/15 ares-cut p-6 sm:p-8 shadow-2xl my-8 relative"
          >
            <button
              type="button"
              onClick={() => setStudentModalOpen(false)}
              aria-label="Close registration dialog"
              className="absolute top-4 right-4 text-marble/60 hover:text-white p-2"
            >
              <X size={20} />
            </button>

            {studentSuccess ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-black font-heading uppercase text-white">Pre-Registration Confirmed!</h3>
                <p className="text-marble/80 text-sm max-w-md mx-auto">
                  Thank you! Your student pre-registration inquiry has been encrypted and submitted to the ARES Coaching Team. We will send logistics details to the parent/guardian email address.
                </p>
                <div className="p-4 bg-white/5 border border-white/10 ares-cut-sm text-xs text-marble/70 max-w-md mx-auto text-left space-y-1">
                  <div>• Student Callsign: <span className="text-white font-bold">{studentForm.studentNickname}</span></div>
                  <div>• Parent/Guardian Contact: <span className="text-white font-bold">{studentForm.parentGuardianEmail}</span></div>
                  <div>• YPP Consent: <span className="text-emerald-400 font-bold">Confirmed</span></div>
                </div>
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-6 py-2.5 bg-ares-red text-white text-xs font-bold uppercase tracking-wider ares-cut-sm mt-4"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleStudentSubmit} className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold mb-1">
                    <GraduationCap size={16} /> Student Pre-Registration
                  </div>
                  <h2 id="student-modal-title" className="text-2xl font-black font-heading uppercase text-white">
                    Register for Hands-On Coaching
                  </h2>
                  <p className="text-xs text-marble/70 mt-1">
                    Fields are encrypted in accordance with our Zero Student PII Policy.
                  </p>
                </div>

                {studentGlobalError && (
                  <div role="alert" className="p-3 bg-ares-red/15 border border-ares-red/40 text-ares-red-light text-xs ares-cut-sm flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{studentGlobalError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Workshop Selection */}
                  <div>
                    <label htmlFor="student-workshop-select" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Workshop Module *
                    </label>
                    <select
                      id="student-workshop-select"
                      value={studentForm.workshopId}
                      onChange={(e) => {
                        const newWorkshopId = e.target.value;
                        const w = WORKSHOP_MODULES.find((m) => m.id === newWorkshopId);
                        setStudentForm({
                          ...studentForm,
                          workshopId: newWorkshopId,
                          sessionId: w?.sessions[0]?.id || "",
                        });
                      }}
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
                    >
                      {WORKSHOP_MODULES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                    {studentErrors.workshopId && (
                      <p className="text-ares-red-light text-[11px] mt-1">{studentErrors.workshopId}</p>
                    )}
                  </div>

                  {/* Session Selection */}
                  <div>
                    <label htmlFor="student-session-select" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Session Date & Location *
                    </label>
                    <select
                      id="student-session-select"
                      value={studentForm.sessionId}
                      onChange={(e) => setStudentForm({ ...studentForm, sessionId: e.target.value })}
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
                    >
                      {WORKSHOP_MODULES.find((m) => m.id === studentForm.workshopId)?.sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.date} ({s.time}) - {s.isVirtual ? "Virtual" : "In-Lab"}
                        </option>
                      ))}
                    </select>
                    {studentErrors.sessionId && (
                      <p className="text-ares-red-light text-[11px] mt-1">{studentErrors.sessionId}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Student Nickname / Callsign (Zero PII) */}
                  <div>
                    <label htmlFor="student-nickname-input" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Student Nickname / Callsign *
                    </label>
                    <input
                      id="student-nickname-input"
                      type="text"
                      placeholder="e.g., Alex / Neo / RedLeader"
                      value={studentForm.studentNickname || ""}
                      onChange={(e) => setStudentForm({ ...studentForm, studentNickname: e.target.value })}
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white placeholder:text-marble/40 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
                    />
                    <span className="text-[10px] text-marble/50">Zero PII: public badge name for workshop</span>
                    {studentErrors.studentNickname && (
                      <p className="text-ares-red-light text-[11px] mt-1">{studentErrors.studentNickname}</p>
                    )}
                  </div>

                  {/* Student Grade Level */}
                  <div>
                    <label htmlFor="student-grade-select" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Grade Level *
                    </label>
                    <select
                      id="student-grade-select"
                      value={studentForm.gradeLevel || ""}
                      onChange={(e) => setStudentForm({ ...studentForm, gradeLevel: e.target.value })}
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
                    >
                      <option value="">Select Grade Level</option>
                      {GRADE_LEVELS.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                    {studentErrors.gradeLevel && (
                      <p className="text-ares-red-light text-[11px] mt-1">{studentErrors.gradeLevel}</p>
                    )}
                  </div>
                </div>

                {/* Prior Experience */}
                <div>
                  <label htmlFor="student-experience-select" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                    Prior Robotics / Programming Experience *
                  </label>
                  <select
                    id="student-experience-select"
                    value={studentForm.priorExperience || ""}
                    onChange={(e) => setStudentForm({ ...studentForm, priorExperience: e.target.value })}
                    className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
                  >
                    <option value="">Select Experience Level</option>
                    {EXPERIENCE_LEVELS.map((exp) => (
                      <option key={exp.id} value={exp.label}>
                        {exp.label} — {exp.description}
                      </option>
                    ))}
                  </select>
                  {studentErrors.priorExperience && (
                    <p className="text-ares-red-light text-[11px] mt-1">{studentErrors.priorExperience}</p>
                  )}
                </div>

                {/* Parent / Guardian Information */}
                <div className="p-4 bg-white/5 border border-white/10 ares-cut-sm space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-ares-gold flex items-center gap-1.5">
                    <Shield size={14} /> Parent or Guardian Contact Information
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="parent-name-input" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                        Parent / Guardian Name *
                      </label>
                      <input
                        id="parent-name-input"
                        type="text"
                        placeholder="Full Legal Name"
                        value={studentForm.parentGuardianName || ""}
                        onChange={(e) => setStudentForm({ ...studentForm, parentGuardianName: e.target.value })}
                        className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white placeholder:text-marble/40 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
                      />
                      {studentErrors.parentGuardianName && (
                        <p className="text-ares-red-light text-[11px] mt-1">{studentErrors.parentGuardianName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="parent-email-input" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                        Parent / Guardian Email *
                      </label>
                      <input
                        id="parent-email-input"
                        type="email"
                        placeholder="parent@example.com"
                        value={studentForm.parentGuardianEmail || ""}
                        onChange={(e) => setStudentForm({ ...studentForm, parentGuardianEmail: e.target.value })}
                        className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white placeholder:text-marble/40 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
                      />
                      {studentErrors.parentGuardianEmail && (
                        <p className="text-ares-red-light text-[11px] mt-1">{studentErrors.parentGuardianEmail}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="parent-phone-input" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Parent / Guardian Phone Number *
                    </label>
                    <input
                      id="parent-phone-input"
                      type="tel"
                      placeholder="(304) 555-0199"
                      value={studentForm.parentGuardianPhone || ""}
                      onChange={(e) => setStudentForm({ ...studentForm, parentGuardianPhone: e.target.value })}
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white placeholder:text-marble/40 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red"
                    />
                    {studentErrors.parentGuardianPhone && (
                      <p className="text-ares-red-light text-[11px] mt-1">{studentErrors.parentGuardianPhone}</p>
                    )}
                  </div>
                </div>

                {/* Dietary & Accessibility Accommodations */}
                <div>
                  <label htmlFor="student-accommodations-input" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                    Dietary or Accessibility Accommodations (Optional)
                  </label>
                  <textarea
                    id="student-accommodations-input"
                    rows={2}
                    placeholder="e.g., wheelchair access required, severe peanut allergy, screen magnifier preference..."
                    value={studentForm.dietaryOrAccessibilityNeeds || ""}
                    onChange={(e) => setStudentForm({ ...studentForm, dietaryOrAccessibilityNeeds: e.target.value })}
                    className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white placeholder:text-marble/40 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-red resize-y"
                  />
                </div>

                {/* FIRST® YPP Parent Consent Checkbox */}
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(studentForm.yppParentConsent)}
                      onChange={(e) => setStudentForm({ ...studentForm, yppParentConsent: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded-none bg-black/60 border-white/30 text-ares-red focus:ring-ares-red"
                    />
                    <span className="text-xs text-marble/90 leading-normal">
                      <strong className="text-white">FIRST® Youth Protection Program (YPP) Consent *</strong>: As the parent or legal guardian, I give permission for this student to participate in ARES STEM workshops with verified adult coaches and mentors.
                    </span>
                  </label>
                  {studentErrors.yppParentConsent && (
                    <p className="text-ares-red-light text-[11px] ml-7">{studentErrors.yppParentConsent}</p>
                  )}

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(studentForm.photoConsent)}
                      onChange={(e) => setStudentForm({ ...studentForm, photoConsent: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded-none bg-black/60 border-white/30 text-ares-red focus:ring-ares-red"
                    />
                    <span className="text-xs text-marble/70 leading-normal">
                      Photo & Media Release: I allow ARES 23247 to capture workshop photos of the student for team outreach and robotics demonstration recaps (optional).
                    </span>
                  </label>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setStudentModalOpen(false)}
                    className="px-4 py-2.5 border border-white/15 text-white text-xs font-bold uppercase tracking-wider ares-cut-sm hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={studentSubmitting}
                    className="px-6 py-2.5 bg-ares-red hover:bg-ares-red-light text-white text-xs font-bold uppercase tracking-wider ares-cut-sm transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {studentSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Submit Pre-Registration
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Volunteer Mentor Sign-up Modal ──────────────────────────── */}
      {mentorModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setMentorModalOpen(false)}
        >
          <div
            ref={mentorModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-modal-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-obsidian border border-white/15 ares-cut p-6 sm:p-8 shadow-2xl my-8 relative"
          >
            <button
              type="button"
              onClick={() => setMentorModalOpen(false)}
              aria-label="Close volunteer sign-up dialog"
              className="absolute top-4 right-4 text-marble/60 hover:text-white p-2"
            >
              <X size={20} />
            </button>

            {mentorSuccess ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-black font-heading uppercase text-white">Mentor Shift Confirmed!</h3>
                <p className="text-marble/80 text-sm max-w-md mx-auto">
                  Thank you for volunteering! Your coaching shift sign-up has been dispatched to the ARES leadership team. We will contact you with session materials and YPP onboarding details.
                </p>
                <button
                  type="button"
                  onClick={() => setMentorModalOpen(false)}
                  className="px-6 py-2.5 bg-ares-red text-white text-xs font-bold uppercase tracking-wider ares-cut-sm mt-4"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleMentorSubmit} className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-cyan mb-1">
                    <HeartHandshake size={16} /> Volunteer Coaching Shift
                  </div>
                  <h2 id="mentor-modal-title" className="text-2xl font-black font-heading uppercase text-white">
                    Mentor & Alumni Sign-Up
                  </h2>
                  <p className="text-xs text-marble/70 mt-1">
                    Help empower the next generation of West Virginia engineers and innovators.
                  </p>
                </div>

                {mentorGlobalError && (
                  <div role="alert" className="p-3 bg-ares-red/15 border border-ares-red/40 text-ares-red-light text-xs ares-cut-sm flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{mentorGlobalError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="mentor-name-input" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Full Name *
                    </label>
                    <input
                      id="mentor-name-input"
                      type="text"
                      placeholder="Mentor / Alumni Name"
                      value={mentorForm.name || ""}
                      onChange={(e) => setMentorForm({ ...mentorForm, name: e.target.value })}
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white placeholder:text-marble/40 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                    />
                    {mentorErrors.name && (
                      <p className="text-ares-red-light text-[11px] mt-1">{mentorErrors.name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="mentor-email-input" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Email Address *
                    </label>
                    <input
                      id="mentor-email-input"
                      type="email"
                      placeholder="mentor@example.com"
                      value={mentorForm.email || ""}
                      onChange={(e) => setMentorForm({ ...mentorForm, email: e.target.value })}
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white placeholder:text-marble/40 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                    />
                    {mentorErrors.email && (
                      <p className="text-ares-red-light text-[11px] mt-1">{mentorErrors.email}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Volunteer Role */}
                  <div>
                    <label htmlFor="mentor-role-select" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Role Type *
                    </label>
                    <select
                      id="mentor-role-select"
                      value={mentorForm.role || "mentor"}
                      onChange={(e) =>
                        setMentorForm({
                          ...mentorForm,
                          role: e.target.value as "mentor" | "alumni" | "lead-coach",
                        })
                      }
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                    >
                      <option value="mentor">Technical Mentor</option>
                      <option value="alumni">ARES / FIRST® Alumni</option>
                      <option value="lead-coach">Lead Coach</option>
                    </select>
                  </div>

                  {/* Workshop Selection */}
                  <div>
                    <label htmlFor="mentor-workshop-select" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Workshop Track *
                    </label>
                    <select
                      id="mentor-workshop-select"
                      value={mentorForm.workshopId}
                      onChange={(e) => {
                        const newWorkshopId = e.target.value;
                        const w = WORKSHOP_MODULES.find((m) => m.id === newWorkshopId);
                        setMentorForm({
                          ...mentorForm,
                          workshopId: newWorkshopId,
                          sessionId: w?.sessions[0]?.id || "",
                        });
                      }}
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                    >
                      {WORKSHOP_MODULES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                    {mentorErrors.workshopId && (
                      <p className="text-ares-red-light text-[11px] mt-1">{mentorErrors.workshopId}</p>
                    )}
                  </div>

                  {/* Session Shift */}
                  <div>
                    <label htmlFor="mentor-session-select" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                      Coaching Shift *
                    </label>
                    <select
                      id="mentor-session-select"
                      value={mentorForm.sessionId}
                      onChange={(e) => setMentorForm({ ...mentorForm, sessionId: e.target.value })}
                      className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                    >
                      {WORKSHOP_MODULES.find((m) => m.id === mentorForm.workshopId)?.sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.date} ({s.time})
                        </option>
                      ))}
                    </select>
                    {mentorErrors.sessionId && (
                      <p className="text-ares-red-light text-[11px] mt-1">{mentorErrors.sessionId}</p>
                    )}
                  </div>
                </div>

                {/* Skill Tags Multi-Select */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-marble mb-2">
                    Coaching Skills & Specialties * (Select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MENTOR_SKILL_TAGS.map((skill) => {
                      const isSelected = (mentorForm.skills || []).includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleMentorSkill(skill)}
                          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ares-cut-sm transition-colors ${
                            isSelected
                              ? "bg-ares-cyan text-black font-black"
                              : "bg-white/5 border border-white/10 text-marble/80 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {isSelected ? `✓ ${skill}` : `+ ${skill}`}
                        </button>
                      );
                    })}
                  </div>
                  {mentorErrors.skills && (
                    <p className="text-ares-red-light text-[11px] mt-1.5">{mentorErrors.skills}</p>
                  )}
                </div>

                {/* Availability & Background Notes */}
                <div>
                  <label htmlFor="mentor-notes-input" className="block text-xs font-bold uppercase tracking-wider text-marble mb-1.5">
                    Experience or Availability Notes (Optional)
                  </label>
                  <textarea
                    id="mentor-notes-input"
                    rows={3}
                    placeholder="Tell us about your background with FIRST®, engineering industry experience, or specific coaching preferences..."
                    value={mentorForm.availabilityNotes || ""}
                    onChange={(e) => setMentorForm({ ...mentorForm, availabilityNotes: e.target.value })}
                    className="w-full bg-black/60 border border-white/15 p-2.5 text-xs text-white placeholder:text-marble/40 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan resize-y"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setMentorModalOpen(false)}
                    className="px-4 py-2.5 border border-white/15 text-white text-xs font-bold uppercase tracking-wider ares-cut-sm hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mentorSubmitting}
                    className="px-6 py-2.5 bg-ares-cyan hover:bg-ares-cyan/80 text-black font-black text-xs uppercase tracking-wider ares-cut-sm transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {mentorSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Confirm Mentor Shift
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
