"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Monitor,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";

interface ZulipStatusDto {
  linked: boolean;
  integration: {
    available: boolean;
    diagnostic: string | null;
  };
  workspace: {
    url: string;
    inviteUrl: string | null;
  };
}

interface ApiErrorDto {
  error?: string;
}

type Notice = { type: "success" | "error"; text: string };

async function responseError(response: Response, fallback: string): Promise<Error> {
  let detail = fallback;
  try {
    const payload = await response.json() as ApiErrorDto;
    if (payload.error) detail = payload.error;
  } catch {
    // The HTTP status remains useful when the upstream body is not JSON.
  }
  return new Error(`HTTP ${response.status}: ${response.statusText || "Request failed"}. ${detail}`);
}

export default function DashboardZulipPage() {
  const { authorizedUser } = useAuth();
  const [status, setStatus] = useState<ZulipStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftInviteUrl, setDraftInviteUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const canManage = authorizedUser?.role === "admin" || authorizedUser?.role === "coach";

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await authenticatedFetch("/api/zulip/status");
      if (!response.ok) throw await responseError(response, "Could not load Zulip status.");
      const payload = await response.json() as ZulipStatusDto;
      setStatus(payload);
      setDraftInviteUrl(current => current || payload.workspace.inviteUrl || "");
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Could not load Zulip status.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const saveInviteUrl = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftInviteUrl.trim()) return;

    setSaving(true);
    setNotice(null);
    try {
      const response = await authenticatedFetch("/api/zulip/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteUrl: draftInviteUrl.trim() }),
      });
      if (!response.ok) throw await responseError(response, "Could not save the invitation link.");
      const payload = await response.json() as {
        workspace: ZulipStatusDto["workspace"];
      };
      setStatus(current => current ? { ...current, workspace: payload.workspace } : current);
      setDraftInviteUrl(payload.workspace.inviteUrl || "");
      setEditing(false);
      setNotice({ type: "success", text: "The approved Zulip invitation link is ready." });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Could not save the invitation link.",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyInviteUrl = async () => {
    if (!status?.workspace.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(status.workspace.inviteUrl);
      setCopied(true);
      setNotice({ type: "success", text: "The approved invitation link was copied." });
      window.setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      setNotice({
        type: "error",
        text: `Clipboard error: ${error instanceof Error ? error.message : "Copy the link manually."}`,
      });
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 pb-12" aria-busy={loading}>
      <header className="hero-card border border-ares-gold/25 bg-obsidian p-6 md:p-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded border border-ares-gold/30 bg-ares-gold/10 px-3 py-1 font-heading text-xs font-black uppercase tracking-widest text-ares-gold">
              <MessageSquare aria-hidden="true" size={14} /> Team Communication Hub
            </p>
            <h1 className="font-heading text-3xl font-black uppercase tracking-wider text-white md:text-4xl">
              Zulip Workspace
            </h1>
            <p className="max-w-2xl text-sm text-marble/80">
              Join team announcements and subteam chats with your approved team account.
            </p>
          </div>

          {status?.workspace.inviteUrl ? (
            <div className="flex flex-wrap gap-3">
              <a
                href={status.workspace.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded bg-ares-red px-5 py-3 text-xs font-black uppercase tracking-widest text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <ExternalLink aria-hidden="true" size={16} /> Join Zulip
              </a>
              <button
                type="button"
                onClick={copyInviteUrl}
                className="inline-flex items-center gap-2 rounded border border-white/20 px-4 py-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : (
            <p className="rounded border border-ares-gold/30 bg-ares-gold/10 px-4 py-3 text-sm text-marble">
              A coach has not added an approved join link yet.
            </p>
          )}
        </div>
      </header>

      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className={notice.type === "error"
            ? "rounded border border-ares-red bg-ares-red px-4 py-3 text-sm font-bold text-white"
            : "rounded border border-ares-gold/40 bg-ares-gold/10 px-4 py-3 text-sm font-bold text-marble"}
        >
          <span className={notice.type === "error" ? "font-mono" : ""}>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2" aria-labelledby="zulip-status-heading">
          <div className="hero-card space-y-4 border border-white/10 bg-obsidian p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 id="zulip-status-heading" className="flex items-center gap-2 font-heading text-sm font-black uppercase tracking-wider text-white">
                <ShieldCheck aria-hidden="true" size={18} className="text-ares-gold" /> Your link status
              </h2>
              <button
                type="button"
                onClick={() => void loadStatus()}
                disabled={loading}
                aria-label="Refresh Zulip status"
                className="rounded p-2 text-marble/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
              >
                <RefreshCw aria-hidden="true" size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {loading && !status ? (
              <p role="status" className="text-sm text-marble/80">Checking your Zulip account…</p>
            ) : status?.linked ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-ares-gold/30 bg-ares-gold/10 p-4">
                <p className="flex items-center gap-3 text-sm font-bold text-white">
                  <CheckCircle2 aria-hidden="true" size={22} className="text-ares-gold" /> Your account is linked.
                </p>
                <a
                  href={status.workspace.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-ares-gold/40 px-3 py-2 text-xs font-black uppercase tracking-wider text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Open chat
                </a>
              </div>
            ) : (
              <div className="space-y-2 rounded border border-ares-red bg-ares-red p-4 text-white">
                <p className="flex items-center gap-3 text-sm font-bold">
                  <XCircle aria-hidden="true" size={22} /> Your account is not linked yet.
                </p>
                <p className="text-xs">
                  Use the approved link above. Sign in with your authorized team Google account.
                </p>
              </div>
            )}

            {status?.integration.diagnostic && (
              <p className="rounded border border-ares-red bg-ares-red px-3 py-2 font-mono text-xs text-white" role="alert">
                {status.integration.diagnostic}
              </p>
            )}
          </div>

          <div className="hero-card space-y-4 border border-white/10 bg-obsidian p-6">
            <h2 className="font-heading text-sm font-black uppercase tracking-wider text-white">How to join</h2>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-marble/80">
              <li>Open the approved invitation link.</li>
              <li>Sign in with the Google account your team approved.</li>
              <li>Install the Zulip app and choose your team streams.</li>
            </ol>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="hero-card space-y-4 border border-white/10 bg-obsidian p-6" aria-labelledby="zulip-apps-heading">
            <h2 id="zulip-apps-heading" className="flex items-center gap-2 font-heading text-sm font-black uppercase tracking-wider text-white">
              <Smartphone aria-hidden="true" size={18} className="text-ares-gold" /> Zulip apps
            </h2>
            <a
              href="https://zulip.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded border border-white/10 p-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <span className="flex items-center gap-2"><Monitor aria-hidden="true" size={18} className="text-ares-gold" /> Download apps</span>
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          </section>

          {canManage && (
            <section className="hero-card space-y-4 border border-ares-gold/30 bg-obsidian p-6" aria-labelledby="zulip-config-heading">
              <div className="flex items-center justify-between gap-3">
                <h2 id="zulip-config-heading" className="flex items-center gap-2 font-heading text-sm font-black uppercase tracking-wider text-ares-gold">
                  <Settings aria-hidden="true" size={18} /> Join link
                </h2>
                <button
                  type="button"
                  onClick={() => setEditing(current => !current)}
                  className="rounded text-xs font-bold text-marble underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  {editing ? "Keep current link" : "Change link"}
                </button>
              </div>
              <p className="text-xs text-marble/80">
                Paste a reusable invitation link from the ARES Zulip workspace.
              </p>
              {editing ? (
                <form className="space-y-3" onSubmit={saveInviteUrl}>
                  <label htmlFor="zulip-invite-url" className="block text-xs font-bold text-white">
                    Invitation URL
                  </label>
                  <input
                    id="zulip-invite-url"
                    type="url"
                    required
                    value={draftInviteUrl}
                    onChange={event => setDraftInviteUrl(event.target.value)}
                    placeholder="https://aresfirst.zulipchat.com/join/..."
                    autoComplete="off"
                    className="w-full rounded border border-white/20 bg-obsidian px-3 py-2 font-mono text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  />
                  <button
                    type="submit"
                    disabled={saving || !draftInviteUrl.trim()}
                    className="w-full rounded bg-ares-gold px-3 py-2 text-xs font-black uppercase tracking-wider text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save approved link"}
                  </button>
                </form>
              ) : (
                <p className="break-all rounded border border-white/10 p-3 font-mono text-xs text-marble/80">
                  {status?.workspace.inviteUrl || "No approved join link is set."}
                </p>
              )}
            </section>
          )}

          <section className="hero-card space-y-2 border border-white/10 bg-obsidian p-6" aria-labelledby="zulip-help-heading">
            <h2 id="zulip-help-heading" className="flex items-center gap-2 font-heading text-sm font-black uppercase tracking-wider text-white">
              <HelpCircle aria-hidden="true" size={16} className="text-ares-gold" /> Need help?
            </h2>
            <p className="text-xs text-marble/80">
              Ask a coach in person if the approved link or your team account does not work.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
