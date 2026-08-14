"use client";

import { logger } from "@/utils/logger";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import SEO from "@/components/SEO";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  OutreachHero,
  OutreachImpactFeed,
  OutreachImpactStats,
  OutreachInitiative,
  OutreachVolunteerCta,
  type OutreachLog,
} from "./OutreachSections";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readCount(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function parseOutreachLog(value: unknown, index: number): OutreachLog | null {
  if (!isRecord(value)) return null;
  const title = readText(value, "title");
  if (!title) return null;
  return {
    key: `${title}-${readText(value, "date") ?? "undated"}-${index}`,
    title,
    date: readText(value, "date"),
    location: readText(value, "location"),
    hours: readCount(value, "hours"),
    peopleReached: readCount(value, "peopleReached"),
    impactSummary: readText(value, "impactSummary"),
  };
}

type SubmitStatus = "idle" | "sending" | "success" | "error";

export default function OutreachPage() {
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [description, setDescription] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [logLoadError, setLogLoadError] = useState<string | null>(null);

  const loadOutreachLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshingLogs(true);
    else setIsLoadingLogs(true);

    try {
      const response = await fetch("/api/outreach?limit=50");
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.logs)) throw new Error("HTTP 502: Invalid outreach response");
      setLogs(payload.logs.map(parseOutreachLog).filter((log): log is OutreachLog => log !== null));
      setLogLoadError(null);
    } catch (error) {
      logger.error("Failed to load outreach records from the public API:", error);
      setLogLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingLogs(false);
      setIsRefreshingLogs(false);
    }
  }, []);

  useEffect(() => {
    void loadOutreachLogs();
  }, [loadOutreachLogs]);

  const closeModal = () => {
    setIsModalOpen(false);
    setSubmitStatus("idle");
    setErrorMessage("");
    setName("");
    setEmail("");
    setPhone("");
    setOrganization("");
    setDescription("");
  };
  const modalRef = useFocusTrap(isModalOpen, closeModal);

  const submitInquiry = async (
    recaptchaToken: string,
    inquiryName = name.trim(),
    inquiryEmail = email.trim(),
    inquiryDescription = description.trim(),
    inquiryOrg = organization.trim(),
    inquiryPhone = phone.trim()
  ) => {
    try {
      let appCheckHeaders = (await getAppCheckHeader()) || {};
      if (!appCheckHeaders["X-Firebase-AppCheck"]) {
        appCheckHeaders = (await getAppCheckHeader(true)) || {};
      }

      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...appCheckHeaders },
        body: JSON.stringify({
          type: "demo",
          name: inquiryName,
          email: inquiryEmail,
          metadata: {
            organization: inquiryOrg || undefined,
            phone: inquiryPhone || undefined,
            message: inquiryDescription,
            additional: inquiryDescription,
          },
          recaptchaToken,
        }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const detail = isRecord(payload) && typeof payload.error === "string" ? ` — ${payload.error}` : "";
        throw new Error(`HTTP ${response.status}: ${response.statusText}${detail}`);
      }
      if (!isRecord(payload) || payload.success !== true) throw new Error("HTTP 502: Invalid inquiry response");

      setSubmitStatus("success");
      setName("");
      setEmail("");
      setPhone("");
      setOrganization("");
      setDescription("");
    } catch (error) {
      logger.error("Outreach inquiry submission failed.");
      setSubmitStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "An unexpected error occurred. Please try again or email us directly.");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || !trimmedEmail || !trimmedDescription) return;

    setSubmitStatus("sending");
    setErrorMessage("");
    try {
      const token = await getRecaptchaToken();
      await submitInquiry(token, trimmedName, trimmedEmail, trimmedDescription, organization.trim(), phone.trim());
    } catch (error) {
      logger.error("Outreach inquiry verification failed.");
      setSubmitStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Verification check failed. Please refresh and try again.");
    }
  };

  const totals = logs.reduce((current, log) => ({
    hours: current.hours + (log.hours ?? 0),
    reach: current.reach + (log.peopleReached ?? 0),
    events: current.events + 1,
  }), { hours: 0, reach: 0, events: 0 });
  const openModal = () => setIsModalOpen(true);

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO title="Community Outreach" description="Discover our mission to expand STEM accessibility across West Virginia. Read our community impact reports, hours tracked, and requested robot demonstrations." />
      <OutreachHero />
      <OutreachImpactStats totals={totals} isLoading={isLoadingLogs} isRefreshing={isRefreshingLogs} error={logLoadError} hasLogs={logs.length > 0} onRetry={() => void loadOutreachLogs()} />
      <OutreachInitiative />
      <OutreachImpactFeed logs={logs} isLoading={isLoadingLogs} isRefreshing={isRefreshingLogs} error={logLoadError} onRefresh={() => void loadOutreachLogs(true)} onRequestDemo={openModal} />
      <OutreachVolunteerCta onRequestDemo={openModal} />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div aria-hidden="true" className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="outreach-dialog-title" aria-describedby="outreach-dialog-description" className="relative w-full max-w-xl bg-obsidian border border-white/10 p-8 md:p-12 ares-cut-lg shadow-2xl max-h-[90vh] overflow-y-auto z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
            <button type="button" aria-label="Close modal" onClick={closeModal} className="absolute top-6 right-6 rounded text-marble/75 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <X aria-hidden="true" size={20} />
            </button>
            <h3 id="outreach-dialog-title" className="text-2xl font-black text-white tracking-tight mb-2">Request a <span className="text-ares-gold font-bold font-heading">STEM Demo</span></h3>
            <p id="outreach-dialog-description" className="text-xs text-marble/75 mb-8 leading-relaxed">Provide event details below, and our student logistics leads will verify schedule availability and reach out.</p>

            {submitStatus === "success" ? (
              <div role="status" aria-live="polite" className="bg-ares-cyan/15 border border-ares-cyan/20 text-ares-cyan p-6 rounded-xl text-center space-y-3">
                <Check size={24} className="mx-auto text-ares-cyan" aria-hidden="true" />
                <div className="font-bold uppercase tracking-wider text-sm font-heading">STEM Request Received!</div>
                <p className="text-xs text-marble/85 leading-relaxed">Our student outreach team will check lab schedule gaps and verify details via email shortly.</p>
                <button type="button" onClick={closeModal} className="px-6 py-2 bg-ares-cyan hover:bg-ares-cyan/80 text-black text-[10px] font-black uppercase tracking-widest ares-cut-sm cursor-pointer transition-all mt-2">Done</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} data-testid="outreach-demo-form" className="space-y-4">
                {submitStatus === "error" && (
                  <div role="alert" aria-live="assertive" className="bg-ares-red/15 border border-ares-red/40 text-white p-3.5 ares-cut-sm text-xs font-semibold leading-relaxed flex items-start gap-2">
                    <AlertCircle aria-hidden="true" size={16} className="shrink-0 mt-0.5" />
                    <span className="font-mono">{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="outreachName" className="block text-[9px] font-black uppercase tracking-wider text-marble/80 mb-1.5">Your Name *</label>
                    <input id="outreachName" type="text" required disabled={submitStatus === "sending"} value={name} onChange={(event) => setName(event.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-ares-cyan focus:ring-2 focus:ring-ares-cyan rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50" />
                  </div>
                  <div>
                    <label htmlFor="outreachEmail" className="block text-[9px] font-black uppercase tracking-wider text-marble/80 mb-1.5">Email Address *</label>
                    <input id="outreachEmail" type="email" required disabled={submitStatus === "sending"} value={email} onChange={(event) => setEmail(event.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-ares-cyan focus:ring-2 focus:ring-ares-cyan rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="outreachOrg" className="block text-[9px] font-black uppercase tracking-wider text-marble/80 mb-1.5">Organization</label>
                    <input id="outreachOrg" type="text" disabled={submitStatus === "sending"} value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="e.g. Mountaineer School" className="w-full bg-black/50 border border-white/5 focus:border-ares-cyan focus:ring-2 focus:ring-ares-cyan rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-marble/60 disabled:opacity-50" />
                  </div>
                  <div>
                    <label htmlFor="outreachPhone" className="block text-[9px] font-black uppercase tracking-wider text-marble/80 mb-1.5">Phone (Optional)</label>
                    <input id="outreachPhone" type="tel" disabled={submitStatus === "sending"} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(304) 555-0199" className="w-full bg-black/50 border border-white/5 focus:border-ares-cyan focus:ring-2 focus:ring-ares-cyan rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-marble/60 disabled:opacity-50" />
                  </div>
                </div>

                <div>
                  <label htmlFor="outreachDetails" className="block text-[9px] font-black uppercase tracking-wider text-marble/80 mb-1.5">Details & Dates *</label>
                  <textarea id="outreachDetails" required rows={4} disabled={submitStatus === "sending"} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell us what you are hosting and potential schedule time slots..." className="w-full bg-black/50 border border-white/5 focus:border-ares-cyan focus:ring-2 focus:ring-ares-cyan rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-marble/60 resize-none disabled:opacity-50" />
                </div>

                <button type="submit" disabled={submitStatus === "sending"} aria-busy={submitStatus === "sending"} className="w-full py-2.5 bg-ares-red hover:bg-ares-bronze disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest ares-cut-sm cursor-pointer shadow-md transition-all mt-4 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
                  {submitStatus === "sending" ? "Submitting STEM Request..." : "Submit STEM Request"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
