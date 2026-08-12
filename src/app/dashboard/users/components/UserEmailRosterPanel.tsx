import { useState } from "react";
import { Copy, Download, Mail, ShieldCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import {
  buildBccList,
  buildEmailRosterCsv,
  buildEmailRosterRequestBody,
  parseEmailRosterResponse,
  type EmailRosterAudience,
  type EmailRosterClient,
  type EmailRosterResponse,
} from "../emailRoster";

interface ApiErrorBody {
  error?: string;
}

async function readApiError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as ApiErrorBody;
  return `HTTP ${response.status}: ${body.error || response.statusText}`;
}

export default function UserEmailRosterPanel() {
  const [audience, setAudience] = useState<EmailRosterAudience>("all");
  const [subteam, setSubteam] = useState("");
  const [client, setClient] = useState<EmailRosterClient>("gmail");
  const [acknowledged, setAcknowledged] = useState(false);
  const [prepared, setPrepared] = useState<EmailRosterResponse | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearPrepared = () => {
    setPrepared(null);
    setStatus(null);
    setError(null);
  };

  const prepareRoster = async () => {
    setIsPreparing(true);
    setPrepared(null);
    setStatus(null);
    setError(null);
    try {
      const response = await authenticatedFetch("/api/profiles/admin/users/email-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEmailRosterRequestBody(audience, subteam)),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = parseEmailRosterResponse(await response.json());
      if (!payload) throw new Error("HTTP 502: The email roster returned an invalid response.");
      setPrepared(payload);
      setStatus(`Prepared ${payload.recipientCount} active roster email address${payload.recipientCount === 1 ? "" : "es"}.`);
    } catch (caught: unknown) {
      setError(`Could not prepare the email roster. ${caught instanceof Error ? caught.message : String(caught)}`);
    } finally {
      setIsPreparing(false);
    }
  };

  const copyBccList = async () => {
    if (!prepared || prepared.recipientCount === 0) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable in this browser.");
      await navigator.clipboard.writeText(buildBccList(prepared.recipients, client));
      setError(null);
      setStatus(`Copied ${prepared.recipientCount} address${prepared.recipientCount === 1 ? "" : "es"}. Paste them into the BCC field in ${client === "gmail" ? "Gmail" : "Outlook"}.`);
    } catch (caught: unknown) {
      setError(`Could not copy the BCC list. ${caught instanceof Error ? caught.message : String(caught)}`);
    }
  };

  const downloadCsv = () => {
    if (!prepared || prepared.recipientCount === 0) return;
    try {
      const blob = new Blob(["\uFEFF", buildEmailRosterCsv(prepared.recipients)], { type: "text/csv;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `ares-team-email-roster-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setError(null);
      setStatus(`Downloaded a CSV containing ${prepared.recipientCount} active roster address${prepared.recipientCount === 1 ? "" : "es"}.`);
    } catch (caught: unknown) {
      setError(`Could not download the CSV. ${caught instanceof Error ? caught.message : String(caught)}`);
    }
  };

  return (
    <section aria-labelledby="email-roster-title" className="border border-ares-gold/30 bg-white/5 p-5 ares-cut space-y-4">
      <div className="flex items-start gap-3">
        <Mail aria-hidden="true" className="mt-0.5 shrink-0 text-ares-gold" size={20} />
        <div>
          <h2 id="email-roster-title" className="font-heading text-lg font-black uppercase tracking-wider text-white">Email roster</h2>
          <p className="mt-1 text-xs leading-relaxed text-marble/70">Prepare a private BCC list or CSV for the team Gmail or Outlook account. Email addresses never appear on public roster pages.</p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-black uppercase tracking-wider text-ares-gold">Recipients</legend>
        <div>
          <label htmlFor="email-roster-audience" className="mb-1 block text-xs font-bold text-marble">Audience</label>
          <select id="email-roster-audience" value={audience} onChange={(event) => { setAudience(event.target.value as EmailRosterAudience); clearPrepared(); }} className="w-full border border-white/15 bg-obsidian px-3 py-2 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
            <option value="all">All active, verified members</option>
            <option value="students">Students</option>
            <option value="parents">Parents</option>
            <option value="mentors">Mentors and coaches</option>
            <option value="alumni">Alumni</option>
          </select>
        </div>
        <div>
          <label htmlFor="email-roster-subteam" className="mb-1 block text-xs font-bold text-marble">Subteam</label>
          <select id="email-roster-subteam" value={subteam} onChange={(event) => { setSubteam(event.target.value); clearPrepared(); }} className="w-full border border-white/15 bg-obsidian px-3 py-2 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
            <option value="">All subteams</option>
            <option value="Programming">Programming</option>
            <option value="CAD">CAD</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Outreach">Outreach</option>
            <option value="Business">Business</option>
          </select>
        </div>
        <div>
          <label htmlFor="email-roster-client" className="mb-1 block text-xs font-bold text-marble">Email app</label>
          <select id="email-roster-client" value={client} onChange={(event) => setClient(event.target.value as EmailRosterClient)} className="w-full border border-white/15 bg-obsidian px-3 py-2 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
          </select>
        </div>
      </fieldset>

      <label className="flex items-start gap-2 border border-ares-gold/20 bg-ares-gold/10 p-3 text-xs leading-relaxed text-white">
        <input type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); clearPrepared(); }} className="mt-0.5 accent-ares-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" />
        <span><ShieldCheck aria-hidden="true" className="mr-1 inline text-ares-gold" size={14} />I will use the team account, place recipients in <strong>BCC</strong>, and follow team youth-protection communication rules.</span>
      </label>

      <button type="button" onClick={() => void prepareRoster()} disabled={!acknowledged || isPreparing} aria-busy={isPreparing} className="w-full bg-ares-red px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-ares-bronze disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
        {isPreparing ? "Preparing roster..." : "Prepare email list"}
      </button>

      {prepared && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-xs text-marble/70">Only the recipient count is shown here. The addresses remain private until copied or downloaded.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => void copyBccList()} disabled={prepared.recipientCount === 0} className="inline-flex items-center justify-center gap-2 border border-ares-gold/40 bg-ares-gold/10 px-3 py-2 text-xs font-black uppercase text-ares-gold hover:bg-ares-gold/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><Copy aria-hidden="true" size={14} /> Copy BCC list</button>
            <button type="button" onClick={downloadCsv} disabled={prepared.recipientCount === 0} className="inline-flex items-center justify-center gap-2 border border-white/15 bg-white/5 px-3 py-2 text-xs font-black uppercase text-white hover:bg-white/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><Download aria-hidden="true" size={14} /> Download CSV</button>
          </div>
          <button type="button" onClick={clearPrepared} className="text-xs font-bold text-marble/70 underline decoration-ares-gold underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Clear prepared list</button>
        </div>
      )}

      {status && <p role="status" aria-live="polite" className="text-xs font-semibold text-white">{status}</p>}
      {error && <p role="alert" className="border border-ares-red/40 bg-ares-red/10 p-3 text-xs font-mono text-white">{error}</p>}
    </section>
  );
}
