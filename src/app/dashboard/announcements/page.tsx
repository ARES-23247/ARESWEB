import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Megaphone, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import {
  ANNOUNCEMENT_UPDATED_EVENT,
  type AnnouncementSeverity,
  type PublicAnnouncement,
} from "@/components/SiteAnnouncementBanner";
import { logger } from "@/utils/logger";

interface ManagedAnnouncement extends PublicAnnouncement {
  isActive: boolean;
  updatedAt: string | null;
}

interface ManagementResponse {
  announcement?: ManagedAnnouncement | null;
  error?: string;
  message?: string;
}

function toLocalDateTime(isoValue: string | null): string {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoDateTime(localValue: string): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AnnouncementManagerPage() {
  const { authorizedUser } = useAuth();
  const canManage =
    authorizedUser?.role === "admin" || authorizedUser?.role === "coach";
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<AnnouncementSeverity>("important");
  const [link, setLink] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [hasSettings, setHasSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!canManage) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setStatus(null);
    try {
      const response = await authenticatedFetch("/api/announcements/admin");
      const payload = (await response.json()) as ManagementResponse;
      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Announcement settings could not be loaded.");
      }
      const current = payload.announcement;
      setHasSettings(Boolean(current));
      if (current) {
        setMessage(current.message);
        setSeverity(current.severity);
        setLink(current.link ?? "");
        setLinkLabel(current.linkLabel ?? "");
        setStartsAt(toLocalDateTime(current.startsAt));
        setEndsAt(toLocalDateTime(current.endsAt));
        setIsActive(current.isActive);
      }
    } catch (error) {
      logger.error("Announcement settings could not be loaded.");
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Announcement settings could not be loaded.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canManage) {
    return (
      <section className="mx-auto max-w-3xl py-10" aria-labelledby="announcement-access-heading">
        <h1 id="announcement-access-heading" className="font-heading text-3xl font-black uppercase text-white">
          Team announcements
        </h1>
        <p role="alert" className="mt-6 rounded-xl border border-ares-red/60 bg-ares-red/15 p-5 text-white">
          Only an administrator or coach can publish site-wide announcements.
        </p>
      </section>
    );
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      setStatus({ kind: "error", message: "Enter an announcement message." });
      return;
    }
    if ((link.trim() && !linkLabel.trim()) || (!link.trim() && linkLabel.trim())) {
      setStatus({ kind: "error", message: "Provide both the optional link and its label, or leave both blank." });
      return;
    }

    setIsSaving(true);
    setStatus(null);
    try {
      const response = await authenticatedFetch("/api/announcements/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          severity,
          link: link.trim() || null,
          linkLabel: linkLabel.trim() || null,
          isActive,
          startsAt: toIsoDateTime(startsAt),
          endsAt: toIsoDateTime(endsAt),
        }),
      });
      const payload = (await response.json()) as ManagementResponse;
      if (!response.ok) {
        throw new Error(payload.error || payload.message || "The announcement could not be saved.");
      }
      setHasSettings(true);
      setStatus({
        kind: "success",
        message: isActive
          ? "Announcement published. It is now available across the public site."
          : "Announcement saved as inactive.",
      });
      window.dispatchEvent(new Event(ANNOUNCEMENT_UPDATED_EVENT));
    } catch (error) {
      logger.error("Announcement settings could not be saved.");
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "The announcement could not be saved.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const disable = async () => {
    if (!hasSettings) return;
    setIsSaving(true);
    setStatus(null);
    try {
      const response = await authenticatedFetch("/api/announcements/admin", { method: "DELETE" });
      const payload = (await response.json()) as ManagementResponse;
      if (!response.ok) {
        throw new Error(payload.error || payload.message || "The announcement could not be disabled.");
      }
      setIsActive(false);
      setStatus({ kind: "success", message: "Announcement removed from the public site." });
      window.dispatchEvent(new Event(ANNOUNCEMENT_UPDATED_EVENT));
    } catch (error) {
      logger.error("Announcement could not be disabled.");
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "The announcement could not be disabled.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl pb-16" aria-labelledby="announcement-manager-heading">
      <div className="mb-8 flex items-start gap-4">
        <div className="rounded-xl bg-ares-red p-3 text-white"><Megaphone aria-hidden="true" /></div>
        <div>
          <h1 id="announcement-manager-heading" className="font-heading text-3xl font-black uppercase text-white sm:text-4xl">
            Team announcements
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-marble/75">
            Publish one short, high-priority message across every public and dashboard page. Visitors do not need to sign in.
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-3 rounded-xl border border-ares-gold/40 bg-ares-gold/10 p-4 text-sm leading-relaxed text-white">
        <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-ares-gold" />
        <p><strong>Keep it public-safe.</strong> Do not include student names, phone numbers, private addresses, travel details, or other personal information.</p>
      </div>

      {status && (
        <div
          role={status.kind === "error" ? "alert" : "status"}
          className={`mb-6 rounded-xl border p-4 text-sm font-bold ${
            status.kind === "error"
              ? "border-ares-red/60 bg-ares-red/15 text-white"
              : "border-ares-cyan/50 bg-ares-cyan/10 text-white"
          }`}
        >
          {status.message}
        </div>
      )}

      {isLoading ? (
        <p role="status" className="rounded-xl border border-white/10 bg-white/5 p-6 text-marble/75">
          Loading announcement settings…
        </p>
      ) : (
        <form onSubmit={save} className="space-y-6 rounded-2xl border border-white/10 bg-black/30 p-4 shadow-2xl sm:p-7">
          <div>
            <label htmlFor="announcement-message" className="mb-2 block text-sm font-black uppercase tracking-wide text-white">
              Message
            </label>
            <textarea
              id="announcement-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={240}
              rows={4}
              required
              className="w-full rounded-xl border border-white/20 bg-obsidian px-4 py-3 text-base text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              placeholder="Practice is moved to 7:00 PM tonight."
            />
            <p className="mt-1 text-right text-xs text-marble/60">{message.length}/240</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="announcement-severity" className="mb-2 block text-sm font-black uppercase tracking-wide text-white">Priority</label>
              <select
                id="announcement-severity"
                value={severity}
                onChange={(event) => setSeverity(event.target.value as AnnouncementSeverity)}
                className="min-h-11 w-full rounded-xl border border-white/20 bg-obsidian px-4 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <option value="info">Information</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-5 w-5 accent-ares-red"
              />
              Show on the public site
            </label>
          </div>

          <fieldset className="grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-2">
            <legend className="px-2 text-sm font-black uppercase tracking-wide text-white">Optional site link</legend>
            <div>
              <label htmlFor="announcement-link" className="mb-2 block text-sm font-bold text-marble/85">Internal path</label>
              <input id="announcement-link" value={link} onChange={(event) => setLink(event.target.value)} maxLength={200} placeholder="/calendar" className="min-h-11 w-full rounded-xl border border-white/20 bg-obsidian px-4 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" />
            </div>
            <div>
              <label htmlFor="announcement-link-label" className="mb-2 block text-sm font-bold text-marble/85">Link label</label>
              <input id="announcement-link-label" value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} maxLength={40} placeholder="View calendar" className="min-h-11 w-full rounded-xl border border-white/20 bg-obsidian px-4 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" />
            </div>
          </fieldset>

          <fieldset className="grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-2">
            <legend className="px-2 text-sm font-black uppercase tracking-wide text-white">Optional schedule</legend>
            <div>
              <label htmlFor="announcement-start" className="mb-2 block text-sm font-bold text-marble/85">Starts</label>
              <input id="announcement-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/20 bg-obsidian px-4 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" />
            </div>
            <div>
              <label htmlFor="announcement-end" className="mb-2 block text-sm font-bold text-marble/85">Ends</label>
              <input id="announcement-end" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/20 bg-obsidian px-4 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" />
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row">
            <button type="submit" disabled={isSaving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ares-red px-6 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-ares-bronze disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <Save aria-hidden="true" size={18} /> {isSaving ? "Saving…" : "Save announcement"}
            </button>
            <button type="button" onClick={() => void disable()} disabled={isSaving || !hasSettings || !isActive} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <Trash2 aria-hidden="true" size={18} /> Remove from site
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
