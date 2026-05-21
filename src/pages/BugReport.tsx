import { useState, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";
import { Link } from "@tanstack/react-router";
import { 
  Send, 
  ArrowLeft, 
  ShieldCheck, 
  AlertTriangle, 
  Terminal, 
  HelpCircle,
  FileText
} from "lucide-react";
import SEO from "../components/SEO";
import Turnstile, { type TurnstileRef } from "../components/Turnstile";
import { useSubmitInquiry } from "../api";
import { motion, AnimatePresence } from "framer-motion";

const REPO_OPTIONS = [
  { value: "ARES-23247/ARESWEB", label: "ARESWEB (Web Portal)" },
  { value: "ARES-23247/IntoTheDeep", label: "IntoTheDeep (Robot Code)" },
  { value: "Other/General", label: "Other / General Systems" }
] as const;

export default function BugReport() {
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const turnstileRef = useRef<TurnstileRef>(null);

  const submitMutation = useSubmitInquiry({
    onMutate: () => {
      setSubmitStatus("idle");
      setErrorMessage("");
    },
    onSuccess: (res) => {
      if (res.success) {
        setSubmitStatus("success");
        setReferenceId(res.id);
        form.reset();
      } else {
        setSubmitStatus("error");
        setErrorMessage(res.warning || "Failed to record the telemetry report.");
        turnstileRef.current?.reset();
      }
    },
    onError: (err: Error | unknown) => {
      setSubmitStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "A transmission error occurred while routing the report.");
      turnstileRef.current?.reset();
    }
  });

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      title: "",
      repo: REPO_OPTIONS[0].value as string,
      description: "",
      turnstileToken: "",
    },
    // @ts-expect-error - zodValidator generic type mismatch with form schema
    validatorAdapter: zodValidator(),
    onSubmit: async ({ value }) => {
      setSubmitStatus("idle");
      try {
        const payload = {
          type: "bug" as const,
          name: value.name,
          email: value.email,
          metadata: {
            title: value.title,
            repo: value.repo,
            description: value.description,
          },
          turnstileToken: value.turnstileToken
        };

        submitMutation.mutate(payload);
      } catch (err) {
        setSubmitStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      }
    },
  });

  const handleResetForm = () => {
    setSubmitStatus("idle");
    setErrorMessage("");
    setReferenceId("");
    form.reset();
    turnstileRef.current?.reset();
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble relative overflow-hidden">
      <SEO 
        title="Bug Report — ARES 23247" 
        description="Help the ARES 23247 robotics team identify, track, and squash system bugs by submitting a secure telemetry report." 
      />

      {/* Futuristic Background Gradients */}
      <div className="absolute inset-0 bg-ares-red/5 bg-[radial-gradient(ellipse_at_center,rgba(192,0,0,0.1)_0,rgba(0,0,0,0)_75%)] pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-ares-gold/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-ares-red/5 rounded-full blur-[120px] pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <section className="py-24 max-w-5xl mx-auto px-6 w-full relative z-10 flex-grow flex flex-col justify-center">
        {/* Page Header */}
        <div className="mb-12 border-l-4 border-ares-red pl-6 py-2">
          <div className="flex items-center gap-2 text-ares-gold text-xs font-black uppercase tracking-[0.3em] mb-2">
            <Terminal size={14} className="text-ares-gold" /> System Diagnostics
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white font-heading tracking-tight mb-3 uppercase">
            Squish <span className="text-ares-red">Bugs</span>
          </h1>
          <p className="text-marble/70 text-base md:text-lg max-w-2xl leading-relaxed">
            Thank you for helping us maintain championship-tier software systems. If you notice any anomalies, submit a report below to notify the development team instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Form / Success Screen Column */}
          <div className="lg:col-span-8 w-full">
            <AnimatePresence mode="wait">
              {submitStatus === "success" ? (
                <motion.div
                  key="success-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="bg-white/5 border border-ares-gold/30 ares-cut p-8 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-sm shadow-ares-gold/5"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ares-gold to-ares-red" />
                  
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-ares-gold/10 border border-ares-gold/30 text-ares-gold mb-6 shadow-[0_0_20px_rgba(255,184,28,0.2)]">
                    <ShieldCheck size={36} />
                  </div>

                  <h3 className="text-2xl font-black text-white uppercase tracking-wide mb-4">
                    Telemetry Received
                  </h3>
                  <p className="text-marble/85 text-sm md:text-base leading-relaxed mb-6">
                    Your bug report has been securely registered in the ARES telemetry hub. Developers and mentors have been alerted via Zulip, and we are working on squashing it.
                  </p>

                  <div className="bg-black/50 border border-white/10 p-5 ares-cut-sm mb-8 font-mono text-xs space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-marble/40">REFERENCE ID:</span>
                      <span className="text-ares-gold font-bold">{referenceId}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-marble/40">STATUS:</span>
                      <span className="text-ares-red font-bold animate-pulse">PENDING REVIEW</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={handleResetForm}
                      className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold tracking-widest uppercase text-xs ares-cut-sm transition-all flex items-center gap-2"
                    >
                      Report Another Bug
                    </button>
                    <Link
                      to="/"
                      className="px-6 py-3 bg-ares-red hover:bg-ares-bronze text-white font-bold tracking-widest uppercase text-xs ares-cut-sm transition-all shadow-lg shadow-ares-red/10 flex items-center gap-2"
                    >
                      Return to Base <ArrowLeft size={12} />
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="bg-white/5 border border-white/10 ares-cut p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ares-red to-ares-gold" />

                  {submitStatus === "error" && (
                    <div className="bg-ares-red/10 border border-ares-red/30 text-ares-red p-4 ares-cut-sm mb-6 flex gap-3 items-center text-xs font-black uppercase tracking-wider animate-shake">
                      <AlertTriangle size={16} className="shrink-0 text-ares-red" />
                      <div>
                        <span className="text-white">Transmission Error:</span> {errorMessage}
                      </div>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      form.handleSubmit();
                    }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Name input */}
                      <div>
                        <label htmlFor="bug-name" className="block text-xs font-black text-ares-gold uppercase tracking-widest mb-2 ml-1">
                          Your Name *
                        </label>
                        <form.Field 
                          name="name"
                          validators={{
                            onChange: z.string().min(1, "Name is required"),
                          }}
                        >
                          {(field) => (
                            <>
                              <input
                                id="bug-name"
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all font-mono text-sm shadow-inner"
                                placeholder="Jane Doe"
                                required
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-xs text-ares-red mt-1.5 ml-1 font-mono uppercase tracking-wider">{String(field.state.meta.errors[0])}</p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>

                      {/* Email input */}
                      <div>
                        <label htmlFor="bug-email" className="block text-xs font-black text-ares-gold uppercase tracking-widest mb-2 ml-1">
                          Email Address *
                        </label>
                        <form.Field 
                          name="email"
                          validators={{
                            onChange: z.string().email("Valid email is required"),
                          }}
                        >
                          {(field) => (
                            <>
                              <input
                                id="bug-email"
                                name={field.name}
                                type="email"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all font-mono text-sm shadow-inner"
                                placeholder="jane@example.com"
                                required
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-xs text-ares-red mt-1.5 ml-1 font-mono uppercase tracking-wider">{String(field.state.meta.errors[0])}</p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                    </div>

                    {/* Repository Selector */}
                    <div>
                      <label htmlFor="bug-repo" className="block text-xs font-black text-ares-gold uppercase tracking-widest mb-2 ml-1">
                        Target System / Repository *
                      </label>
                      <form.Field name="repo">
                        {(field) => (
                          <div className="relative">
                            <select
                              id="bug-repo"
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all font-mono text-sm cursor-pointer appearance-none"
                            >
                              {REPO_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-obsidian">
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-marble/40">
                              <span className="text-xs">▼</span>
                            </div>
                          </div>
                        )}
                      </form.Field>
                    </div>

                    {/* Summary input */}
                    <div>
                      <label htmlFor="bug-title" className="block text-xs font-black text-ares-gold uppercase tracking-widest mb-2 ml-1">
                        Short Summary *
                      </label>
                      <form.Field 
                        name="title"
                        validators={{
                          onChange: z.string().min(3, "Summary must be at least 3 characters").max(100, "Summary must be less than 100 characters"),
                        }}
                      >
                        {(field) => (
                          <>
                            <input
                              id="bug-title"
                              name={field.name}
                              type="text"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all font-mono text-sm shadow-inner"
                              placeholder="e.g. Navigation menu items fail to expand on mobile portrait mode"
                              required
                            />
                            {field.state.meta.errors.length > 0 && (
                              <p className="text-xs text-ares-red mt-1.5 ml-1 font-mono uppercase tracking-wider">{String(field.state.meta.errors[0])}</p>
                            )}
                          </>
                        )}
                      </form.Field>
                    </div>

                    {/* Description input */}
                    <div>
                      <label htmlFor="bug-desc" className="block text-xs font-black text-ares-gold uppercase tracking-widest mb-2 ml-1">
                        Anatomy of the Bug (Steps to Reproduce) *
                      </label>
                      <form.Field 
                        name="description"
                        validators={{
                          onChange: z.string().min(10, "Please provide at least 10 characters detailing the issue"),
                        }}
                      >
                        {(field) => (
                          <>
                            <textarea
                              id="bug-desc"
                              name={field.name}
                              rows={6}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all font-mono text-sm resize-none shadow-inner"
                              placeholder="Steps to Reproduce:&#10;1. Navigate to /academy&#10;2. Select 'Outdoor Sports'&#10;3. Observe crash/blank page...&#10;&#10;Expected Behavior:&#10;The gear ratios simulator should render smoothly."
                              required
                            />
                            {field.state.meta.errors.length > 0 && (
                              <p className="text-xs text-ares-red mt-1.5 ml-1 font-mono uppercase tracking-wider">{String(field.state.meta.errors[0])}</p>
                            )}
                          </>
                        )}
                      </form.Field>
                    </div>

                    {/* Turnstile */}
                    <div className="pt-2">
                      <form.Field 
                        name="turnstileToken"
                        validators={{
                          onChange: z.string().min(1, "Please complete the anti-spam verification"),
                        }}
                      >
                        {(field) => (
                          <>
                            <Turnstile 
                              ref={turnstileRef}
                              onVerify={(token) => field.handleChange(token)} 
                              onExpire={() => field.handleChange("")}
                              theme="dark" 
                              className="mb-4 shadow-md" 
                            />
                            {field.state.meta.errors.length > 0 && (
                              <p className="text-xs text-ares-red mb-4 ml-1 font-mono uppercase tracking-wider">{String(field.state.meta.errors[0])}</p>
                            )}
                          </>
                        )}
                      </form.Field>
                    </div>

                    <button
                      type="submit"
                      disabled={submitMutation.isPending}
                      className="w-full bg-ares-red hover:bg-ares-bronze disabled:bg-ares-red/50 text-white font-black tracking-widest uppercase text-sm py-4 ares-cut-sm transition-all shadow-lg shadow-ares-red/20 active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {submitMutation.isPending ? (
                        <>Transmitting telemetry...</>
                      ) : (
                        <>
                          Transmit Telemetry <Send size={14} />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Diagnostic Info Column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Info Card 1 */}
            <div className="bg-white/5 border border-white/10 ares-cut p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-ares-red/10 rounded-full flex items-center justify-center border border-ares-red/20 text-ares-red text-lg">
                  ⚠️
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">
                  No Silent Failures
                </h3>
              </div>
              <p className="text-marble/70 text-sm leading-relaxed">
                If you saw a red error banner popup or a network failure during operations, please copy and paste the exact technical status codes or stack traces in your steps.
              </p>
            </div>

            {/* Info Card 2 */}
            <div className="bg-white/5 border border-white/10 ares-cut p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-ares-cyan/10 rounded-full flex items-center justify-center border border-ares-cyan/20 text-ares-cyan">
                  <FileText size={18} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">
                  No GitHub? No Problem
                </h3>
              </div>
              <p className="text-marble/70 text-sm leading-relaxed">
                We previously routed all issues strictly through GitHub. This web interface now allows you to submit reports instantly without needing an external developer account.
              </p>
            </div>

            {/* FIRST Branding reminder note inside the UI */}
            <div className="bg-white/5 border border-white/10 ares-cut p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-ares-gold/10 rounded-full flex items-center justify-center border border-ares-gold/20 text-ares-gold">
                  <HelpCircle size={18} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">
                  Support Lifecycle
                </h3>
              </div>
              <p className="text-marble/70 text-sm leading-relaxed">
                All telemetry reports are triaged by *FIRST*® Robotics Team ARES 23247 student members and coaches. Verified bug resolutions will be deployed continuously.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center pb-8">
          <Link 
            to="/" 
            className="text-marble/40 hover:text-white text-xs font-black uppercase tracking-widest transition-colors inline-flex items-center gap-2 border-b border-transparent hover:border-white"
          >
            <ArrowLeft size={12} /> Return to Base
          </Link>
        </div>
      </section>
    </div>
  );
}
