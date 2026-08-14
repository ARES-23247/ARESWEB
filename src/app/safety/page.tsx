"use client";

import { useState, useId } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Cpu,
  Layers,
  Disc,
  Scissors,
  Flame,
  BatteryCharging,
  Eye,
  CheckCircle2,
  XCircle,
  Printer,
  Download,
  RefreshCw,
  Check,
  HelpCircle,
  Award,
  ArrowRight,
  Info,
  Lock,
  Search,
} from "lucide-react";
import SEO from "@/components/SEO";
import { GreekMeander } from "@/components/GreekMeander";
import {
  WORKSHOP_MACHINES,
  EMERGENCY_PROCEDURES,
  SafetyCertificationRecord,
  QuizEvaluationResult,
  verifyQuizAnswers,
  generateCertificationRecord,
  verifyCertificationChecksum,
  sanitizeCallsign,
} from "@/lib/safetyMatrixData";

type ActiveTab = "protocols" | "quiz" | "emergency" | "certificate";

const ICON_MAP: Record<string, typeof Cpu> = {
  Cpu,
  Layers,
  Disc,
  Scissors,
  Flame,
  BatteryCharging,
  Eye,
  ShieldAlert,
};

export default function SafetyPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("protocols");
  const [selectedMachineId, setSelectedMachineId] = useState<string>("cnc-router");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Interactive pre-flight checklist state (machineId -> array of completed check indexes)
  const [checkedPreFlight, setCheckedPreFlight] = useState<Record<string, number[]>>({});

  // Quiz state
  const [quizMachineId, setQuizMachineId] = useState<string>("cnc-router");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Record<string, number>>>({});
  const [quizResults, setQuizResults] = useState<Record<string, QuizEvaluationResult>>({});
  
  // Passed machine qualifications
  const [passedMachines, setPassedMachines] = useState<string[]>([]);
  
  // Callsign & Certification Record
  const [studentCallsign, setStudentCallsign] = useState<string>("Mountaineer-1");
  const [certRecord, setCertRecord] = useState<SafetyCertificationRecord | null>(null);

  // Verification tool state
  const [verifyInput, setVerifyInput] = useState<string>("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "valid" | "invalid">("idle");

  const searchInputId = useId();
  const callsignInputId = useId();
  const verifyInputId = useId();

  const activeMachine = WORKSHOP_MACHINES.find((m) => m.id === selectedMachineId) || WORKSHOP_MACHINES[0];
  const activeQuizMachine = WORKSHOP_MACHINES.find((m) => m.id === quizMachineId) || WORKSHOP_MACHINES[0];

  const filteredMachines = WORKSHOP_MACHINES.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.hazardLevel.toLowerCase().includes(q)
    );
  });

  const togglePreFlightCheck = (machineId: string, index: number) => {
    setCheckedPreFlight((prev) => {
      const current = prev[machineId] || [];
      const updated = current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index];
      return { ...prev, [machineId]: updated };
    });
  };

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => {
      const machineAnswers = prev[quizMachineId] || {};
      return {
        ...prev,
        [quizMachineId]: {
          ...machineAnswers,
          [questionId]: optionIndex,
        },
      };
    });
  };

  const handleEvaluateQuiz = (machineId: string) => {
    const answers = selectedAnswers[machineId] || {};
    const evalResult = verifyQuizAnswers(machineId, answers);
    setQuizResults((prev) => ({ ...prev, [machineId]: evalResult }));

    if (evalResult.passed) {
      setPassedMachines((prev) => {
        if (!prev.includes(machineId)) {
          const updated = [...prev, machineId];
          // Auto-generate or update certification record
          const record = generateCertificationRecord(studentCallsign, updated);
          setCertRecord(record);
          return updated;
        }
        return prev;
      });
    }
  };

  const handleResetQuiz = (machineId: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [machineId]: {} }));
    setQuizResults((prev) => {
      const next = { ...prev };
      delete next[machineId];
      return next;
    });
  };

  const handleGenerateCertificate = () => {
    const record = generateCertificationRecord(studentCallsign, passedMachines);
    setCertRecord(record);
    setActiveTab("certificate");
  };

  const handleExportJson = () => {
    if (!certRecord) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(certRecord, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "ares-safety-cert-" + certRecord.recordId + ".json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleVerifyChecksum = () => {
    if (!verifyInput.trim()) {
      setVerifyStatus("idle");
      return;
    }

    try {
      // Check if user pasted full JSON record or a checksum
      if (verifyInput.trim().startsWith("{")) {
        const parsed = JSON.parse(verifyInput.trim());
        const isValid = verifyCertificationChecksum(parsed);
        setVerifyStatus(isValid ? "valid" : "invalid");
      } else if (certRecord && verifyInput.trim() === certRecord.checksum) {
        setVerifyStatus("valid");
      } else {
        setVerifyStatus("invalid");
      }
    } catch {
      setVerifyStatus("invalid");
    }
  };

  const totalPossibleQualifications = WORKSHOP_MACHINES.length;
  const isAllQualified = passedMachines.length === totalPossibleQualifications;

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO
        title="Workshop Safety & Tool Certifications"
        description="ARES 23247 workshop safety protocols, machine qualification quizzes, emergency response protocols, and zero-PII printable qualification records."
      />

      {/* ─── HERO SECTION ─── */}
      <section className="py-20 bg-obsidian relative overflow-hidden flex items-center border-b border-white/10">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-ares-red/10 border border-ares-red/30 rounded-full mb-4">
            <ShieldAlert size={14} className="text-ares-red animate-pulse" />
            <span className="text-ares-gold uppercase tracking-widest text-[10px] font-black font-heading">
              ARES 23247 Safety Engineering Standard
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white mb-6 uppercase tracking-tight font-heading leading-tight">
            Workshop Safety &amp; <br />
            <span className="bg-ares-red px-4 sm:px-6 py-1 ares-cut-sm shadow-xl text-white inline-block mt-2">
              Tool Certifications
            </span>
          </h1>

          <p className="text-marble/85 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-4">
            Safety is the bedrock of championship robotics engineering. All students, mentors, and lab guests must review machine safety protocols, master emergency procedures, and earn qualification badges before operating workshop tools.
          </p>

          {/* Zero-PII Callout Badge */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 bg-black/40 border border-ares-gold/20 px-4 py-2 rounded-xl text-[11px] text-marble/80">
            <Lock size={13} className="text-ares-gold" />
            <span className="font-bold text-white">Strict Zero-PII Architecture:</span>
            <span>All quiz evaluations and qualification badges are computed client-side without storing personal minor data.</span>
          </div>

          {/* Quick Tab Switcher Navigation */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {[
              { id: "protocols" as ActiveTab, label: "Machine Protocols", icon: <Cpu size={14} /> },
              { id: "quiz" as ActiveTab, label: "Qualification Quiz (" + passedMachines.length + "/" + totalPossibleQualifications + ")", icon: <HelpCircle size={14} /> },
              { id: "emergency" as ActiveTab, label: "Emergency & First Aid", icon: <ShieldAlert size={14} /> },
              { id: "certificate" as ActiveTab, label: "Certification Card", icon: <Award size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={"px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan " + (
                  activeTab === tab.id
                    ? "bg-ares-red text-white shadow-lg shadow-ares-red/20 font-black"
                    : "bg-white/5 text-marble/75 hover:bg-white/10 hover:text-white"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TAB 1: MACHINE SAFETY PROTOCOLS ─── */}
      {activeTab === "protocols" && (
        <section className="py-16 bg-obsidian">
          <div className="max-w-7xl mx-auto px-6">
            {/* Search and Machine Selector */}
            <div className="mb-10 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="w-full md:w-80 relative">
                <label htmlFor={searchInputId} className="sr-only">
                  Search machine safety protocols
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/50" />
                  <input
                    id={searchInputId}
                    type="search"
                    placeholder="Search machines, PPE, hazards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {filteredMachines.map((machine) => {
                  const Icon = ICON_MAP[machine.iconName] || Cpu;
                  const isQualified = passedMachines.includes(machine.id);
                  return (
                    <button
                      key={machine.id}
                      type="button"
                      onClick={() => setSelectedMachineId(machine.id)}
                      className={"px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 " + (
                        selectedMachineId === machine.id
                          ? "bg-ares-gold text-black font-black shadow-md"
                          : "bg-white/5 text-marble/75 hover:bg-white/10 hover:text-white border border-white/5"
                      )}
                    >
                      <Icon size={13} />
                      {machine.shortName}
                      {isQualified && <CheckCircle2 size={12} className="text-emerald-500 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Machine Detail Showcase */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-10 hero-card">
              {/* Header Info */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="px-2.5 py-0.5 bg-white/10 text-[9px] font-black uppercase tracking-widest text-ares-cyan rounded border border-white/5">
                      {activeMachine.category}
                    </span>
                    <span
                      className={"px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded border " + (
                        activeMachine.hazardLevel === "Critical"
                          ? "bg-ares-red/20 text-ares-red border-ares-red/30"
                          : activeMachine.hazardLevel === "High"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      )}
                    >
                      Hazard Level: {activeMachine.hazardLevel}
                    </span>
                    {passedMachines.includes(activeMachine.id) ? (
                      <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Qualified Operator
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-white/5 text-marble/60 text-[9px] font-bold uppercase tracking-widest rounded border border-white/5">
                        Qualification Pending
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-heading uppercase tracking-tight">
                    {activeMachine.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-marble/70 mt-2 max-w-3xl leading-relaxed">
                    {activeMachine.description}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuizMachineId(activeMachine.id);
                      setActiveTab("quiz");
                    }}
                    className="px-4 py-2 bg-ares-red hover:bg-ares-bronze text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-ares-red/20 flex items-center gap-2 cursor-pointer"
                  >
                    <HelpCircle size={14} /> Take Safety Quiz
                  </button>
                </div>
              </div>

              {/* PPE & Prohibited Attire Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
                {/* Required PPE */}
                <div className="bg-black/30 border border-emerald-500/20 rounded-xl p-5">
                  <h3 className="text-emerald-400 font-bold text-xs uppercase tracking-widest font-heading mb-4 flex items-center gap-2">
                    <CheckCircle2 size={14} /> Required Personal Protective Equipment (PPE)
                  </h3>
                  <ul className="space-y-2.5">
                    {activeMachine.requiredPPE.map((ppe, idx) => (
                      <li key={idx} className="text-xs text-marble/90 flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{ppe}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Prohibited Attire / Actions */}
                <div className="bg-black/30 border border-ares-red/30 rounded-xl p-5">
                  <h3 className="text-ares-red font-bold text-xs uppercase tracking-widest font-heading mb-4 flex items-center gap-2">
                    <XCircle size={14} /> Strictly Prohibited (Immediate Lockout)
                  </h3>
                  <ul className="space-y-2.5">
                    {activeMachine.prohibitedItems.map((item, idx) => (
                      <li key={idx} className="text-xs text-marble/90 flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-ares-red mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Interactive Pre-Operational Checklist */}
              <div className="mb-8 bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className="text-white font-bold text-sm uppercase tracking-widest font-heading flex items-center gap-2">
                    <Check size={16} className="text-ares-gold" /> Pre-Flight Operational Safety Checklist
                  </h3>
                  <span className="text-[11px] text-marble/60">
                    {(checkedPreFlight[activeMachine.id] || []).length} of {activeMachine.preOperationalChecks.length} Verified
                  </span>
                </div>
                <div className="space-y-3">
                  {activeMachine.preOperationalChecks.map((checkText, idx) => {
                    const isChecked = (checkedPreFlight[activeMachine.id] || []).includes(idx);
                    return (
                      <label
                        key={idx}
                        className={"flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors " + (
                          isChecked
                            ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                            : "bg-black/20 border-white/5 text-marble/80 hover:bg-white/5"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePreFlightCheck(activeMachine.id, idx)}
                          className="mt-0.5 h-4 w-4 rounded border-white/20 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-obsidian"
                        />
                        <span className="text-xs leading-relaxed select-none">{checkText}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Operating & Post-Op Procedures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <h3 className="text-white font-bold text-xs uppercase tracking-widest font-heading flex items-center gap-2 text-ares-gold">
                    <Info size={14} /> Safe Operating Guidelines
                  </h3>
                  <div className="bg-black/20 border border-white/5 rounded-xl p-5 space-y-2.5">
                    {activeMachine.operatingRules.map((rule, idx) => (
                      <div key={idx} className="text-xs text-marble/85 flex items-start gap-2">
                        <span className="text-ares-gold font-mono font-bold text-[10px]">{idx + 1}.</span>
                        <span>{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-white font-bold text-xs uppercase tracking-widest font-heading flex items-center gap-2 text-ares-cyan">
                    <RefreshCw size={14} /> Post-Operational Cleanup &amp; Lockout
                  </h3>
                  <div className="bg-black/20 border border-white/5 rounded-xl p-5 space-y-2.5">
                    {activeMachine.postOperationalCleanup.map((cleanup, idx) => (
                      <div key={idx} className="text-xs text-marble/85 flex items-start gap-2">
                        <span className="text-ares-cyan font-mono font-bold text-[10px]">{idx + 1}.</span>
                        <span>{cleanup}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Emergency Shutdown Callout */}
              <div className="bg-ares-red/10 border-l-4 border-ares-red p-5 rounded-r-xl">
                <h4 className="text-ares-red font-black text-xs uppercase tracking-widest font-heading mb-1 flex items-center gap-2">
                  <AlertTriangle size={14} /> Emergency Shutdown Procedure
                </h4>
                <p className="text-xs text-marble/90 leading-relaxed font-medium">
                  {activeMachine.emergencyShutdown}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── TAB 2: INTERACTIVE QUALIFICATION QUIZ ─── */}
      {activeTab === "quiz" && (
        <section className="py-16 bg-obsidian">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <span className="text-ares-gold uppercase tracking-[0.3em] text-[10px] font-black font-heading">
                Operator Qualification Portal
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight font-heading mt-2">
                Machine Tool Qualification Quizzes
              </h2>
              <p className="text-xs sm:text-sm text-marble/70 mt-2 max-w-xl mx-auto">
                Pass each tool&apos;s interactive safety test with 100% accuracy to qualify. Immediate feedback and detailed explanations are provided.
              </p>
            </div>

            {/* Callsign and Machine Picker Bar */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="w-full md:w-72">
                <label htmlFor={callsignInputId} className="block text-[10px] font-bold uppercase tracking-widest text-ares-gold mb-1.5 font-heading">
                  Student Callsign / Handle (Zero-PII)
                </label>
                <input
                  id={callsignInputId}
                  type="text"
                  maxLength={28}
                  value={studentCallsign}
                  onChange={(e) => setStudentCallsign(sanitizeCallsign(e.target.value))}
                  placeholder="e.g. Mountaineer-1"
                  className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-ares-gold"
                />
                <p className="text-[9px] text-marble/50 mt-1">Do not enter personal minor names or emails.</p>
              </div>

              {/* Tool Selector Buttons */}
              <div className="flex flex-wrap gap-2 justify-center">
                {WORKSHOP_MACHINES.map((machine) => {
                  const isQualified = passedMachines.includes(machine.id);
                  const isSelected = quizMachineId === machine.id;
                  return (
                    <button
                      key={machine.id}
                      type="button"
                      onClick={() => setQuizMachineId(machine.id)}
                      className={"px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 " + (
                        isSelected
                          ? "bg-ares-red text-white shadow-lg font-black"
                          : isQualified
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-white/5 text-marble/75 hover:bg-white/10"
                      )}
                    >
                      {isQualified ? <CheckCircle2 size={13} className="text-emerald-400" /> : <HelpCircle size={13} />}
                      {machine.shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quiz Content Container */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-10 hero-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10 mb-8">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-ares-cyan font-heading">
                    Tool Safety Qualification Assessment
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white uppercase font-heading mt-1">
                    {activeQuizMachine.name}
                  </h3>
                </div>

                {passedMachines.includes(activeQuizMachine.id) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 size={16} /> Certified Qualified Operator
                  </div>
                )}
              </div>

              {/* Questions List */}
              <div className="space-y-8">
                {activeQuizMachine.quizQuestions.map((q, qIndex) => {
                  const userSelection = selectedAnswers[activeQuizMachine.id]?.[q.id];
                  const evalFeedback = quizResults[activeQuizMachine.id]?.feedback.find((f) => f.questionId === q.id);

                  return (
                    <div
                      key={q.id}
                      className={"p-6 rounded-xl border transition-colors " + (
                        evalFeedback
                          ? evalFeedback.isCorrect
                            ? "bg-emerald-950/20 border-emerald-500/40"
                            : "bg-ares-red/10 border-ares-red/40"
                          : "bg-black/30 border-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold font-heading">
                          Question {qIndex + 1} of {activeQuizMachine.quizQuestions.length} • {q.criticalCategory}
                        </span>
                        {evalFeedback && (
                          <span
                            className={"text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 " + (
                              evalFeedback.isCorrect
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-ares-red/20 text-ares-red"
                            )}
                          >
                            {evalFeedback.isCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {evalFeedback.isCorrect ? "Correct" : "Incorrect"}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-bold text-white mb-4 leading-snug">
                        {q.question}
                      </p>

                      <div className="space-y-2.5">
                        {q.options.map((opt, optIndex) => {
                          const isSelected = userSelection === optIndex;
                          return (
                            <button
                              key={optIndex}
                              type="button"
                              onClick={() => handleSelectAnswer(q.id, optIndex)}
                              className={"w-full text-left p-3.5 rounded-lg border text-xs leading-relaxed transition-all flex items-start gap-3 cursor-pointer " + (
                                isSelected
                                  ? "bg-ares-gold text-black border-ares-gold font-bold shadow-md"
                                  : "bg-white/5 border-white/5 text-marble/85 hover:bg-white/10 hover:text-white"
                              )}
                            >
                              <span
                                className={"w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 " + (
                                  isSelected
                                    ? "bg-black text-white font-black"
                                    : "bg-white/10 text-marble"
                                )}
                              >
                                {String.fromCharCode(65 + optIndex)}
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Feedback */}
                      {evalFeedback && (
                        <div
                          className={"mt-4 p-3.5 rounded-lg text-xs leading-relaxed border " + (
                            evalFeedback.isCorrect
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                              : "bg-ares-red/10 border-ares-red/20 text-rose-300"
                          )}
                        >
                          <p className="font-bold mb-1 flex items-center gap-1.5">
                            <Info size={13} /> Safety Critical Rationale:
                          </p>
                          <p>{evalFeedback.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => handleResetQuiz(activeQuizMachine.id)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-marble hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2 border border-white/10 cursor-pointer"
                >
                  <RefreshCw size={13} /> Reset Quiz
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleEvaluateQuiz(activeQuizMachine.id)}
                    className="px-6 py-2.5 bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-ares-red/20 flex items-center gap-2 cursor-pointer"
                  >
                    <Check size={14} /> Submit &amp; Evaluate
                  </button>
                </div>
              </div>

              {/* Quiz Overall Evaluation Notification */}
              {quizResults[activeQuizMachine.id] && (
                <div
                  className={"mt-6 p-4 rounded-xl border flex items-center justify-between gap-4 " + (
                    quizResults[activeQuizMachine.id].passed
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      : "bg-ares-red/15 border-ares-red/40 text-rose-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {quizResults[activeQuizMachine.id].passed ? (
                      <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle size={24} className="text-ares-red shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-bold">
                        {quizResults[activeQuizMachine.id].passed
                          ? "100% Score! Machine Qualification Earned."
                          : "Score: " + quizResults[activeQuizMachine.id].score + "/" + quizResults[activeQuizMachine.id].totalQuestions + ". 100% required to pass."}
                      </p>
                      <p className="text-[11px] opacity-80">
                        {quizResults[activeQuizMachine.id].passed
                          ? "Badge has been automatically recorded to your client safety card."
                          : "Review the safety rationales above and retake the quiz."}
                      </p>
                    </div>
                  </div>

                  {quizResults[activeQuizMachine.id].passed && (
                    <button
                      type="button"
                      onClick={handleGenerateCertificate}
                      className="px-4 py-2 bg-emerald-500 text-black hover:bg-emerald-400 text-xs font-black uppercase tracking-wider rounded-xl transition-colors shrink-0 cursor-pointer"
                    >
                      View Badge Card
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── TAB 3: EMERGENCY PROCEDURES & FIRST AID ─── */}
      {activeTab === "emergency" && (
        <section className="py-16 bg-obsidian">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <span className="text-ares-red uppercase tracking-[0.3em] text-[10px] font-black font-heading">
                Life Safety &amp; Emergency Protocols
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight font-heading mt-2">
                Emergency &amp; First Aid Quick Reference
              </h2>
              <p className="text-xs sm:text-sm text-marble/70 mt-2 max-w-2xl mx-auto">
                Rapid action workflows for eyewash flushing, fire suppression, LiPo thermal runaway containment, and zero-PII injury triage.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {EMERGENCY_PROCEDURES.map((proc) => {
                const Icon = ICON_MAP[proc.iconName] || ShieldAlert;
                return (
                  <div
                    key={proc.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 hero-card flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className={"w-10 h-10 rounded-xl flex items-center justify-center " + (
                            proc.priorityLevel === "Critical"
                              ? "bg-ares-red/20 text-ares-red border border-ares-red/30"
                              : proc.priorityLevel === "Urgent"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          )}
                        >
                          <Icon size={20} />
                        </div>
                        <div>
                          <span
                            className={"text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded " + (
                              proc.priorityLevel === "Critical"
                                ? "bg-ares-red text-white"
                                : proc.priorityLevel === "Urgent"
                                ? "bg-amber-500 text-black"
                                : "bg-blue-500 text-white"
                            )}
                          >
                            {proc.priorityLevel} Protocol
                          </span>
                          <h3 className="text-lg font-bold text-white font-heading uppercase mt-1">
                            {proc.title}
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs text-marble/70 mb-4">{proc.subtitle}</p>

                      {proc.criticalAlert && (
                        <div className="p-3 bg-ares-red/15 border-l-2 border-ares-red rounded-r-lg mb-5 text-[11px] font-black text-rose-300">
                          {proc.criticalAlert}
                        </div>
                      )}

                      <div className="space-y-2 mb-6">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-ares-gold font-heading">
                          Step-by-Step Action Guidelines:
                        </p>
                        {proc.guidelines.map((step, idx) => (
                          <div key={idx} className="text-xs text-marble/85 flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-ares-gold shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>

                      {proc.subsections && proc.subsections.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                          {proc.subsections.map((sub, idx) => (
                            <div key={idx} className="bg-black/20 p-4 rounded-xl border border-white/5">
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ares-cyan font-heading mb-2">
                                {sub.heading}
                              </h4>
                              <ul className="space-y-1.5">
                                {sub.items.map((item, itemIdx) => (
                                  <li key={itemIdx} className="text-[11px] text-marble/80 flex items-start gap-2">
                                    <span className="w-1 h-1 rounded-full bg-ares-cyan mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── TAB 4: PRINTABLE CERTIFICATION CARD & VERIFICATION ─── */}
      {activeTab === "certificate" && (
        <section className="py-16 bg-obsidian">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-10">
              <span className="text-ares-gold uppercase tracking-[0.3em] text-[10px] font-black font-heading">
                Zero-PII Qualification Badging
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight font-heading mt-2">
                Workshop Safety Record Card
              </h2>
              <p className="text-xs sm:text-sm text-marble/70 mt-2 max-w-xl mx-auto">
                Print or export your client-side safety record card for laboratory binders and competition pit inspections.
              </p>
            </div>

            {/* Printable Certificate Card Container */}
            <div className="bg-gradient-to-br from-black/80 via-zinc-950 to-neutral-900 border-2 border-ares-gold/40 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden print:border-black print:bg-white print:text-black print:p-6 print:shadow-none">
              <GreekMeander variant="thin" opacity="opacity-20" className="absolute top-0 left-0 print:hidden" />

              {/* Certificate Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-ares-gold/20 pb-8 relative z-10 print:border-black">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-ares-red text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded font-heading print:bg-black">
                      ARES 23247
                    </span>
                    <span className="text-ares-gold text-[10px] font-black uppercase tracking-widest font-heading print:text-black">
                      Appalachian Robotics &amp; Engineering Society
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white uppercase font-heading tracking-tight print:text-black">
                    Workshop Tool Operator Card
                  </h3>
                  <p className="text-xs text-marble/70 mt-1 print:text-black/80">
                    Official Safety Qualification Record • Season 2026-2027
                  </p>
                </div>

                <div className="text-right">
                  <div className="w-16 h-16 rounded-2xl bg-ares-red/10 border border-ares-gold/30 flex items-center justify-center text-ares-gold mx-auto sm:ml-auto print:border-black print:text-black">
                    <Award size={32} />
                  </div>
                </div>
              </div>

              {/* Student Metadata (Zero-PII) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-8 relative z-10">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 print:bg-transparent print:border-black/20">
                  <span className="text-[9px] uppercase tracking-widest text-marble/60 block font-bold font-heading print:text-black/60">
                    Student Callsign
                  </span>
                  <span className="text-sm font-mono font-bold text-ares-gold mt-1 block print:text-black">
                    {studentCallsign}
                  </span>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/5 print:bg-transparent print:border-black/20">
                  <span className="text-[9px] uppercase tracking-widest text-marble/60 block font-bold font-heading print:text-black/60">
                    Record ID
                  </span>
                  <span className="text-sm font-mono font-bold text-white mt-1 block print:text-black">
                    {certRecord ? certRecord.recordId : "QUAL-DRAFT"}
                  </span>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/5 print:bg-transparent print:border-black/20">
                  <span className="text-[9px] uppercase tracking-widest text-marble/60 block font-bold font-heading print:text-black/60">
                    Issue Date
                  </span>
                  <span className="text-xs font-mono text-marble/90 mt-1 block print:text-black">
                    {certRecord ? certRecord.issuedAt.slice(0, 10) : "2026-08-14"}
                  </span>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/5 print:bg-transparent print:border-black/20">
                  <span className="text-[9px] uppercase tracking-widest text-marble/60 block font-bold font-heading print:text-black/60">
                    Qualification Status
                  </span>
                  <span
                    className={"text-xs font-bold uppercase tracking-wider mt-1 block " + (
                      isAllQualified ? "text-emerald-400 print:text-black font-black" : "text-amber-400 print:text-black"
                    )}
                  >
                    {isAllQualified ? "Master Safety Certified" : passedMachines.length + "/" + totalPossibleQualifications + " Qualified"}
                  </span>
                </div>
              </div>

              {/* Machine Tools Qualification Matrix Grid */}
              <div className="relative z-10 mb-8">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white font-heading mb-4 print:text-black">
                  Machine Tool Authorizations
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {WORKSHOP_MACHINES.map((machine) => {
                    const isQualified = passedMachines.includes(machine.id);
                    const Icon = ICON_MAP[machine.iconName] || Cpu;
                    return (
                      <div
                        key={machine.id}
                        className={"p-3.5 rounded-xl border flex items-center justify-between gap-3 " + (
                          isQualified
                            ? "bg-emerald-950/20 border-emerald-500/30 text-white print:bg-transparent print:border-black"
                            : "bg-black/30 border-white/5 text-marble/50 print:bg-transparent print:border-black/10"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className={isQualified ? "text-emerald-400 print:text-black" : "text-marble/30"} />
                          <div>
                            <span className="text-xs font-bold block print:text-black">{machine.shortName}</span>
                            <span className="text-[9px] uppercase tracking-wider opacity-60 print:text-black/60">
                              {machine.hazardLevel} Hazard
                            </span>
                          </div>
                        </div>
                        {isQualified ? (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase rounded print:bg-black print:text-white">
                            PASSED
                          </span>
                        ) : (
                          <span className="text-[9px] uppercase tracking-wider text-marble/40 print:text-black/40">
                            UNQUALIFIED
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tamper-Evident Checksum & Compliance Footer */}
              <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10 print:border-black">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-marble/50 block font-heading print:text-black/60">
                    Verification Checksum
                  </span>
                  <span className="text-xs font-mono font-bold text-ares-gold break-all print:text-black">
                    {certRecord ? certRecord.checksum : "ARES-CERT-PENDING"}
                  </span>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-[9px] text-marble/60 uppercase tracking-widest font-heading print:text-black/70">
                    ARES Lab Safety Officer Signoff
                  </p>
                  <p className="text-[9px] text-marble/40 mt-0.5 print:text-black/50">
                    Compliant with FIRST® Safety Manual &amp; Zero-PII Policy
                  </p>
                </div>
              </div>
            </div>

            {/* Print & Export Actions */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-ares-gold text-black hover:bg-yellow-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <Printer size={15} /> Print Record Card
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                disabled={!certRecord}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors border border-white/10 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <Download size={15} /> Export JSON Record
              </button>
            </div>

            {/* Offline Authenticity Verification Tool */}
            <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest font-heading mb-2 flex items-center gap-2 text-ares-gold">
                <ShieldCheck size={16} /> Workshop Safety Officer: Authenticity Verification
              </h3>
              <p className="text-xs text-marble/70 mb-4">
                Paste a student&apos;s exported JSON record or checksum to instantly verify cryptographic integrity offline.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label htmlFor={verifyInputId} className="sr-only">
                    Verification payload or checksum
                  </label>
                  <input
                    id={verifyInputId}
                    type="text"
                    placeholder="Paste JSON record or checksum (e.g. ARES-CERT-...)"
                    value={verifyInput}
                    onChange={(e) => {
                      setVerifyInput(e.target.value);
                      setVerifyStatus("idle");
                    }}
                    className="w-full px-4 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-ares-gold"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerifyChecksum}
                  className="px-5 py-2 bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors shrink-0 cursor-pointer"
                >
                  Verify Authenticity
                </button>
              </div>

              {verifyStatus === "valid" && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} /> Authentic ARES 23247 Safety Certification Record verified.
                </div>
              )}
              {verifyStatus === "invalid" && (
                <div className="mt-4 p-3 bg-ares-red/15 border border-ares-red/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
                  <XCircle size={16} /> Invalid or tampered checksum record.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── ABOUT & BOTTOM CALLOUT BANNER ─── */}
      <section className="py-12 bg-black/30 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs text-marble/60 uppercase tracking-widest font-heading mb-2">
            Safety Standard Reference
          </p>
          <p className="text-xs text-marble/80 max-w-xl mx-auto leading-relaxed">
            All protocols aligned with ANSI Z87.1 eye protection, OSHA 1910 machine guarding standards, and the FIRST® Robotics Youth Protection &amp; Safety Guide.
          </p>
          <div className="mt-6 flex justify-center gap-4 text-xs font-bold">
            <Link to="/about" className="text-ares-gold hover:underline flex items-center gap-1">
              About ARES 23247 <ArrowRight size={12} />
            </Link>
            <Link to="/tech-stack" className="text-marble/80 hover:text-white flex items-center gap-1">
              Tech Stack Architecture <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
