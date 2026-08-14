"use client";

import { useState, useId, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  Briefcase,
  Building2,
  Search,
  ShieldCheck,
  Check,
  AlertCircle,
  X,
  Sparkles,
  MessageSquare,
  ChevronRight,
  BookOpen,
  Cpu,
  RefreshCw,
  Star,
  Layers,
  ArrowUpRight,
  Send,
} from "lucide-react";
import SEO from "@/components/SEO";
import { GreekMeander } from "@/components/GreekMeander";
import { logger } from "@/utils/logger";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  ALUMNI_DIRECTORY,
  INDUSTRY_CATEGORIES,
  MENTORSHIP_TOPICS,
  filterAlumni,
  getUniqueUniversities,
  getIndustryCounts,
  type AlumniProfile,
  type IndustryCategory,
  type MentorshipTopic,
} from "@/lib/alumniDirectoryData";

const GRADE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"] as const;

type SubmitStatus = "idle" | "sending" | "success" | "error";
export default function AlumniDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryCategory | "all">("all");
  const [selectedUniversity, setSelectedUniversity] = useState<string | "all">("all");
  const [selectedTopic, setSelectedTopic] = useState<MentorshipTopic | "all">("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetAlum, setTargetAlum] = useState<AlumniProfile | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentGrade, setStudentGrade] = useState("");
  const [studentSchool, setStudentSchool] = useState("");
  const [chosenTopics, setChosenTopics] = useState<MentorshipTopic[]>([]);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const searchInputId = useId();
  const universitySelectId = useId();
  const topicSelectId = useId();

  const uniqueUniversities = getUniqueUniversities(ALUMNI_DIRECTORY);
  const industryCounts = getIndustryCounts(ALUMNI_DIRECTORY);

  const filteredAlumni = filterAlumni(ALUMNI_DIRECTORY, {
    searchQuery,
    industry: selectedIndustry,
    university: selectedUniversity,
    topic: selectedTopic,
  });

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedIndustry !== "all" ||
    selectedUniversity !== "all" ||
    selectedTopic !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedIndustry("all");
    setSelectedUniversity("all");
    setSelectedTopic("all");
  };

  const openMentorshipModal = (alum?: AlumniProfile) => {
    setTargetAlum(alum ?? null);
    if (alum && alum.availableTopics.length > 0) {
      setChosenTopics([alum.availableTopics[0]]);
    } else {
      setChosenTopics(["Robotics Engineering"]);
    }
    setSubmitStatus("idle");
    setErrorMessage("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSubmitStatus("idle");
    setErrorMessage("");
    setStudentName("");
    setStudentEmail("");
    setStudentGrade("");
    setStudentSchool("");
    setChosenTopics([]);
    setInquiryMessage("");
    setTargetAlum(null);
  };

  const modalRef = useFocusTrap(isModalOpen, closeModal);

  const handleTopicToggle = (topic: MentorshipTopic) => {
    setChosenTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentEmail.trim()) {
      setSubmitStatus("error");
      setErrorMessage("Please provide your name and email address.");
      return;
    }
    if (!studentSchool.trim() || !studentGrade) {
      setSubmitStatus("error");
      setErrorMessage("Please provide your high school and current grade.");
      return;
    }
    if (chosenTopics.length === 0) {
      setSubmitStatus("error");
      setErrorMessage("Please select at least one mentorship focus area.");
      return;
    }
    if (!inquiryMessage.trim()) {
      setSubmitStatus("error");
      setErrorMessage("Please include a brief note about what you'd like guidance on.");
      return;
    }

    setSubmitStatus("sending");
    setErrorMessage("");

    try {
      const recaptchaToken = await getRecaptchaToken();

      let appCheckHeaders = (await getAppCheckHeader()) || {};
      if (!appCheckHeaders["X-Firebase-AppCheck"]) {
        appCheckHeaders = (await getAppCheckHeader(true)) || {};
      }

      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...appCheckHeaders,
        },
        body: JSON.stringify({
          type: "student",
          name: studentName.trim(),
          email: studentEmail.trim(),
          metadata: {
            inquiryCategory: "alumni_mentorship",
            preferredMentorId: targetAlum?.id ?? "general_network",
            preferredMentorName: targetAlum?.name ?? "General ARES Alumni Network",
            preferredMentorCompany: targetAlum?.company ?? "Multiple Industry Partners",
            school: studentSchool.trim(),
            grade: studentGrade,
            mentorshipTopics: chosenTopics,
            message: inquiryMessage.trim(),
            additional: `Mentorship focus: ${chosenTopics.join(", ")}. Message: ${inquiryMessage.trim()}`,
          },
          recaptchaToken,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to submit mentorship connection request.");
      }

      setSubmitStatus("success");
      setStudentName("");
      setStudentEmail("");
      setStudentGrade("");
      setStudentSchool("");
      setChosenTopics([]);
      setInquiryMessage("");
    } catch (err: unknown) {
      logger.error("Alumni mentorship submission failed:", err);
      setSubmitStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again or reach out directly."
      );
    }
  };
  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble selection:bg-ares-red selection:text-white">
      <SEO
        title="FIRST Alumni Network & Career Mentorship"
        description="Connect with ARES 23247 alumni pioneering in aerospace, autonomous robotics, software engineering, and biomedical devices at NASA, MIT, Tesla, Lockheed Martin, and CMU Robotics."
      />

      {/* ─── HERO SECTION ─── */}
      <section className="py-24 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh] border-b border-white/5">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-ares-red/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-ares-gold/5 rounded-full blur-[90px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-6 ares-cut-sm backdrop-blur-md">
            <Sparkles size={12} className="text-ares-gold animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-ares-gold font-heading">
              FIRST® Alumni Network &amp; Career Pathways
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading leading-none">
            Alumni <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white">Network</span> &amp; Mentorship
          </h1>

          <p className="text-marble/85 text-base md:text-lg max-w-3xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
            From FTC #23247 build tables in Morgantown to world-renowned research laboratories and frontier engineering firms. Our alumni mentor current students through collegiate admissions, competitive robotics strategy, and industrial engineering careers.
          </p>

          {/* Quick CTA Actions */}
          <div className="mt-8 flex flex-wrap justify-center items-center gap-4">
            <button
              type="button"
              onClick={() => openMentorshipModal()}
              className="px-6 py-3 bg-ares-red hover:bg-ares-bronze text-white font-black uppercase tracking-widest text-xs ares-cut-sm shadow-lg shadow-ares-red/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <MessageSquare size={14} /> Request Mentorship Session
            </button>
            <Link
              to="/about"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-marble/90 hover:text-white font-bold uppercase tracking-widest text-xs ares-cut-sm transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Building2 size={14} className="text-ares-cyan" /> Team Legacy &amp; Roster <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CAREER PATHWAYS STATS BANNER ─── */}
      <section className="py-8 bg-black/40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="p-4 border border-white/5 rounded-xl bg-white/[0.02]">
            <div className="text-2xl md:text-3xl font-black text-white font-heading">100%</div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-ares-gold mt-1">
              STEM College Matriculation
            </div>
          </div>
          <div className="p-4 border border-white/5 rounded-xl bg-white/[0.02]">
            <div className="text-2xl md:text-3xl font-black text-white font-heading">8+</div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-ares-cyan mt-1">
              Top Research Institutions
            </div>
          </div>
          <div className="p-4 border border-white/5 rounded-xl bg-white/[0.02]">
            <div className="text-2xl md:text-3xl font-black text-white font-heading">NASA &amp; Tesla</div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-ares-bronze mt-1">
              Active Industry Placements
            </div>
          </div>
          <div className="p-4 border border-white/5 rounded-xl bg-white/[0.02]">
            <div className="text-2xl md:text-3xl font-black text-white font-heading">1-on-1</div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-ares-red mt-1">
              Free Youth Coaching
            </div>
          </div>
        </div>
      </section>

      {/* ─── SEARCH & FILTER CONTROLS ─── */}
      <section className="py-12 bg-obsidian border-b border-white/5 sticky top-16 z-30 backdrop-blur-lg bg-obsidian/95 shadow-md">
        <div className="max-w-7xl mx-auto px-6 space-y-6">
          {/* Top Row: Search Input & Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Search Box */}
            <div className="md:col-span-6 relative">
              <label htmlFor={searchInputId} className="sr-only">
                Search alumni by name, company, university, or keywords
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-marble/40"
                />
                <input
                  id={searchInputId}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search alumni by name, company (e.g. NASA), university, or role..."
                  className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-marble/40 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search text"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-marble/50 hover:text-white p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* University Filter */}
            <div className="md:col-span-3">
              <label htmlFor={universitySelectId} className="sr-only">
                Filter by University
              </label>
              <select
                id={universitySelectId}
                value={selectedUniversity}
                onChange={(e) => setSelectedUniversity(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-marble/90 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all cursor-pointer"
              >
                <option value="all">All Universities &amp; Colleges</option>
                {uniqueUniversities.map((uni) => (
                  <option key={uni} value={uni}>
                    {uni}
                  </option>
                ))}
              </select>
            </div>

            {/* Mentorship Focus Filter */}
            <div className="md:col-span-3">
              <label htmlFor={topicSelectId} className="sr-only">
                Filter by Mentorship Focus Area
              </label>
              <select
                id={topicSelectId}
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value as MentorshipTopic | "all")}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-marble/90 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all cursor-pointer"
              >
                <option value="all">All Mentorship Focus Areas</option>
                {MENTORSHIP_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic} Mentorship
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bottom Row: Industry Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-marble/50 mr-2 flex items-center gap-1 font-heading">
              <Layers size={12} /> Industry:
            </span>

            <button
              type="button"
              onClick={() => setSelectedIndustry("all")}
              aria-pressed={selectedIndustry === "all"}
              className={`px-3.5 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                selectedIndustry === "all"
                  ? "bg-ares-red text-white shadow-md shadow-ares-red/20 font-black"
                  : "bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              All Industries ({industryCounts.all ?? 0})
            </button>

            {INDUSTRY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedIndustry(cat)}
                aria-pressed={selectedIndustry === cat}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                  selectedIndustry === cat
                    ? "bg-ares-red text-white shadow-md shadow-ares-red/20 font-black"
                    : "bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {cat} ({industryCounts[cat] ?? 0})
              </button>
            ))}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="ml-auto px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-ares-gold/90 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw size={10} /> Reset Filters
              </button>
            )}
          </div>
        </div>
      </section>
      {/* ─── ALUMNI CATALOG GRID ─── */}
      <section className="py-16 bg-obsidian">
        <div className="max-w-7xl mx-auto px-6">
          {/* Results Counter & Info */}
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
            <p className="text-xs text-marble/60 uppercase tracking-widest font-mono">
              Showing <strong className="text-white font-bold">{filteredAlumni.length}</strong> of{" "}
              <strong className="text-white font-bold">{ALUMNI_DIRECTORY.length}</strong> Verified Alumni Profiles
            </p>

            <div className="flex items-center gap-2 text-[10px] font-mono text-ares-cyan bg-ares-cyan/10 px-2.5 py-1 rounded-md border border-ares-cyan/20">
              <ShieldCheck size={12} /> Adult Alumni &amp; Verified Professional Profiles
            </div>
          </div>

          {filteredAlumni.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.02] border border-white/10 rounded-2xl ares-cut p-8 max-w-xl mx-auto">
              <GraduationCap size={40} className="mx-auto text-marble/30 mb-4" />
              <h2 className="text-lg font-bold text-white font-heading uppercase mb-2">
                No Alumni Match Your Current Filters
              </h2>
              <p className="text-xs text-marble/65 mb-6 leading-relaxed">
                Try loosening your search terms or resetting the industry and mentorship focus filters.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-5 py-2.5 bg-ares-red text-white text-xs font-black uppercase tracking-widest ares-cut-sm hover:bg-ares-bronze transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredAlumni.map((alum) => (
                <div
                  key={alum.id}
                  className="bg-white/5 border border-white/10 hover:border-ares-red/40 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 group hover:shadow-2xl hover:shadow-ares-red/10 relative overflow-hidden backdrop-blur-sm"
                >
                  {alum.featured && (
                    <div className="absolute top-0 right-0 bg-ares-gold text-obsidian text-[8px] font-black uppercase tracking-widest px-3 py-0.5 rounded-bl-lg font-heading flex items-center gap-1 shadow-md">
                      <Star size={10} className="fill-current" /> Featured Mentor
                    </div>
                  )}

                  <div>
                    {/* Header with Avatar and Basic Info */}
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-black/60 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform p-1">
                        {alum.avatar ? (
                          <img
                            src={alum.avatar}
                            alt={`${alum.name}'s avatar`}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <GraduationCap size={24} className="text-ares-gold" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-black text-white group-hover:text-ares-gold transition-colors font-heading truncate">
                          {alum.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 rounded bg-ares-red text-white text-[8px] font-black uppercase tracking-wider">
                            Class of {alum.gradYear}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/10 text-marble/80 text-[8px] font-mono font-bold">
                            {alum.industry}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Current Career & Institution */}
                    <div className="mt-5 space-y-2 text-xs border-t border-white/5 pt-4">
                      <div className="flex items-start gap-2 text-marble/90 font-medium">
                        <Briefcase size={14} className="text-ares-cyan shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-white font-bold">{alum.company}</strong>
                          <div className="text-[11px] text-marble/70 leading-snug">{alum.title}</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-marble/90 font-medium">
                        <GraduationCap size={14} className="text-ares-gold shrink-0 mt-0.5" />
                        <div>
                          <span className="text-white font-semibold">{alum.university}</span>
                          <div className="text-[11px] text-marble/70 leading-snug">
                            {alum.major} {alum.degreeLevel && `(${alum.degreeLevel})`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FTC Heritage Role */}
                    <div className="mt-4 p-2.5 rounded-lg bg-black/40 border border-white/5">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-ares-gold font-heading flex items-center gap-1 mb-1">
                        <Cpu size={10} /> FTC Heritage Role
                      </div>
                      <p className="text-[11px] font-medium text-white/90 leading-tight">
                        {alum.heritageRole}
                      </p>
                    </div>

                    {/* Bio / Impact */}
                    <p className="mt-4 text-xs text-marble/75 leading-relaxed font-normal">
                      {alum.bio}
                    </p>

                    {/* Alumnus Quote */}
                    {alum.quote && (
                      <blockquote className="mt-3 text-[11px] text-marble/60 italic border-l-2 border-ares-bronze/40 pl-3 py-0.5 leading-relaxed">
                        &ldquo;{alum.quote}&rdquo;
                      </blockquote>
                    )}
                  </div>

                  {/* Mentorship Focus Chips & Actions Footer */}
                  <div className="mt-6 pt-4 border-t border-white/5 space-y-4">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest text-marble/50 block mb-2 font-heading">
                        Available Mentorship Focus:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {alum.availableTopics.map((topic) => (
                          <span
                            key={topic}
                            className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-mono font-medium text-ares-gold"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {/* Career Links (Strict Zero Youth PII: only verified professional links) */}
                      <div className="flex items-center gap-2">
                        {alum.careerLinks?.linkedin && (
                          <a
                            href={alum.careerLinks.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-ares-red text-marble hover:text-white transition-colors"
                            aria-label={`View ${alum.name}'s verified LinkedIn profile`}
                          >
                            <ArrowUpRight size={14} />
                          </a>
                        )}
                        {alum.careerLinks?.github && (
                          <a
                            href={alum.careerLinks.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-marble hover:text-white transition-colors"
                            aria-label={`View ${alum.name}'s verified GitHub profile`}
                          >
                            <BookOpen size={14} />
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => openMentorshipModal(alum)}
                        className="px-3.5 py-1.5 bg-ares-red hover:bg-ares-bronze text-white text-[10px] font-black uppercase tracking-wider ares-cut-sm shadow-md transition-all flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        <MessageSquare size={12} /> Book Coaching
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── FIRST YPP ZERO-PII INTEGRITY NOTICE ─── */}
      <section className="py-12 bg-black/40 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/20 mx-auto">
            <ShieldCheck size={20} />
          </div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider font-heading">
            Strict Zero Youth PII &amp; FIRST® Youth Protection Compliance
          </h2>
          <p className="text-xs text-marble/75 leading-relaxed max-w-2xl mx-auto">
            The public ARES directory contains exclusively adult alumni profiles with verified career links. Student coaching requests submitted through this portal are end-to-end encrypted and routed strictly to verified adult coaches and mentors in accordance with <em>FIRST</em>® YPP standards.
          </p>
        </div>
      </section>

      {/* ─── MENTORSHIP CONNECTION REQUEST MODAL ─── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mentorship-dialog-title"
          aria-describedby="mentorship-dialog-description"
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-2xl bg-obsidian border border-white/15 p-6 md:p-10 ares-cut-lg shadow-2xl max-h-[90vh] overflow-y-auto z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close mentorship inquiry dialog"
              className="absolute top-6 right-6 p-1.5 rounded-lg text-marble/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="mb-6">
              <span className="px-2.5 py-0.5 bg-ares-red text-white text-[9px] font-black uppercase tracking-widest rounded font-heading inline-block mb-2">
                Coaching Portal
              </span>
              <h2 id="mentorship-dialog-title" className="text-2xl font-black text-white uppercase tracking-tight font-heading">
                Request Mentorship Session
              </h2>
              <p id="mentorship-dialog-description" className="text-xs text-marble/75 mt-1 leading-relaxed">
                Connect with {targetAlum ? <strong className="text-white">{targetAlum.name} ({targetAlum.company})</strong> : "the ARES Alumni Network"} for guidance on collegiate engineering, robotics software, and CAD modeling.
              </p>
            </div>

            {submitStatus === "success" ? (
              <div role="status" aria-live="polite" className="bg-ares-cyan/15 border border-ares-cyan/30 text-ares-cyan p-8 rounded-xl text-center space-y-4">
                <Check size={32} className="mx-auto text-ares-cyan" aria-hidden="true" />
                <h3 className="text-lg font-bold text-white font-heading uppercase">
                  Coaching Request Received!
                </h3>
                <p className="text-xs text-marble/85 leading-relaxed max-w-md mx-auto">
                  Your encrypted coaching inquiry has been routed to our mentorship coordination team. An adult coach or mentor will contact you via email shortly to coordinate an online session.
                </p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2.5 bg-ares-cyan hover:bg-ares-cyan/80 text-black text-xs font-black uppercase tracking-widest ares-cut-sm cursor-pointer transition-all mt-4 font-heading"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} data-testid="alumni-mentorship-form" className="space-y-5">
                {submitStatus === "error" && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="bg-ares-red/15 border border-ares-red/40 text-white p-3.5 ares-cut-sm text-xs font-semibold leading-relaxed flex items-start gap-2"
                  >
                    <AlertCircle aria-hidden="true" size={16} className="shrink-0 mt-0.5 text-ares-red" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Target Mentor Selector */}
                <div>
                  <label htmlFor="mentor-select" className="block text-[10px] font-black uppercase tracking-wider text-marble/80 mb-1.5">
                    Preferred Alumnus Mentor
                  </label>
                  <select
                    id="mentor-select"
                    value={targetAlum?.id ?? "general"}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const alum = ALUMNI_DIRECTORY.find((a) => a.id === selectedId);
                      setTargetAlum(alum ?? null);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all cursor-pointer"
                  >
                    <option value="general">General ARES Alumni Network (Best Match)</option>
                    {ALUMNI_DIRECTORY.map((alum) => (
                      <option key={alum.id} value={alum.id}>
                        {alum.name} — {alum.company} ({alum.university})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Topic Selection Chips */}
                <fieldset className="border-none p-0 m-0">
                  <legend className="block text-[10px] font-black uppercase tracking-wider text-marble/80 mb-2">
                    Mentorship Topic Focus *
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {MENTORSHIP_TOPICS.map((topic) => {
                      const isSelected = chosenTopics.includes(topic);
                      return (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => handleTopicToggle(topic)}
                          aria-pressed={isSelected}
                          className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                            isSelected
                              ? "bg-ares-red text-white border-ares-red shadow-md"
                              : "bg-white/5 text-marble/80 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <span>{topic}</span>
                          {isSelected && <Check size={14} className="shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Student Contact Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="student-name" className="block text-[10px] font-black uppercase tracking-wider text-marble/80 mb-1.5">
                      Student Full Name *
                    </label>
                    <input
                      id="student-name"
                      type="text"
                      required
                      disabled={submitStatus === "sending"}
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g. Alex Mountaineer"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-marble/40 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="student-email" className="block text-[10px] font-black uppercase tracking-wider text-marble/80 mb-1.5">
                      Student / Parent Email Address *
                    </label>
                    <input
                      id="student-email"
                      type="email"
                      required
                      disabled={submitStatus === "sending"}
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="e.g. student@example.org"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-marble/40 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* School & Grade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="student-school" className="block text-[10px] font-black uppercase tracking-wider text-marble/80 mb-1.5">
                      Current School / Organization *
                    </label>
                    <input
                      id="student-school"
                      type="text"
                      required
                      disabled={submitStatus === "sending"}
                      value={studentSchool}
                      onChange={(e) => setStudentSchool(e.target.value)}
                      placeholder="e.g. Morgantown High School"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-marble/40 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="student-grade" className="block text-[10px] font-black uppercase tracking-wider text-marble/80 mb-1.5">
                      Current Grade *
                    </label>
                    <select
                      id="student-grade"
                      required
                      disabled={submitStatus === "sending"}
                      value={studentGrade}
                      onChange={(e) => setStudentGrade(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <option value="" disabled>
                        Select Grade
                      </option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {g}th Grade
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Message & Goals */}
                <div>
                  <label htmlFor="student-message" className="block text-[10px] font-black uppercase tracking-wider text-marble/80 mb-1.5">
                    What would you like guidance on? *
                  </label>
                  <textarea
                    id="student-message"
                    required
                    rows={4}
                    disabled={submitStatus === "sending"}
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    placeholder="Tell us about your questions (e.g., college applications, mechanical gearbox design in Onshape, odometry tuning, or engineering internships)..."
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-marble/40 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all resize-none disabled:opacity-50"
                  />
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitStatus === "sending"}
                    aria-busy={submitStatus === "sending"}
                    className="w-full py-3 bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase tracking-widest ares-cut-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-heading"
                  >
                    {submitStatus === "sending" ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Submit Mentorship Request</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[9px] text-marble/50 uppercase font-mono mt-3">
                    Protected by App Check &amp; reCAPTCHA • Form data is encrypted at rest
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
