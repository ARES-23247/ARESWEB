import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Megaphone, X } from "lucide-react";
import { Link } from "react-router-dom";
import { logger } from "@/utils/logger";

export type AnnouncementSeverity = "info" | "important" | "urgent";

export interface PublicAnnouncement {
  message: string;
  severity: AnnouncementSeverity;
  link: string | null;
  linkLabel: string | null;
  revision: string;
  startsAt: string | null;
  endsAt: string | null;
}

interface AnnouncementResponse {
  announcement?: unknown;
}

const DISMISSED_REVISION_KEY = "ares.dismissedAnnouncementRevision";
const REFRESH_INTERVAL_MS = 60_000;
export const ANNOUNCEMENT_UPDATED_EVENT = "ares:announcement-updated";

export function isPublicAnnouncement(value: unknown): value is PublicAnnouncement {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PublicAnnouncement>;
  return (
    typeof candidate.message === "string" &&
    candidate.message.length > 0 &&
    candidate.message.length <= 240 &&
    (candidate.severity === "info" ||
      candidate.severity === "important" ||
      candidate.severity === "urgent") &&
    typeof candidate.revision === "string" &&
    candidate.revision.length > 0 &&
    (candidate.link === null ||
      (typeof candidate.link === "string" &&
        candidate.link.startsWith("/") &&
        !candidate.link.startsWith("//"))) &&
    (candidate.linkLabel === null || typeof candidate.linkLabel === "string")
  );
}

function getDismissedRevision(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_REVISION_KEY);
  } catch {
    return null;
  }
}

function rememberDismissal(revision: string) {
  try {
    window.localStorage.setItem(DISMISSED_REVISION_KEY, revision);
  } catch {
    // The close action still works for this page when storage is unavailable.
  }
}

const severityStyles: Record<AnnouncementSeverity, string> = {
  info: "border-ares-cyan bg-[#07343b] text-white",
  important: "border-ares-gold bg-[#3d2b00] text-white",
  urgent: "border-white/35 bg-ares-red text-white",
};

export default function SiteAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<PublicAnnouncement | null>(null);
  const bannerRef = useRef<HTMLElement>(null);

  const loadAnnouncement = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/announcements", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as AnnouncementResponse;
      if (payload.announcement === null) {
        setAnnouncement(null);
        return;
      }
      if (!isPublicAnnouncement(payload.announcement)) {
        throw new Error("Invalid announcement response");
      }
      setAnnouncement(
        getDismissedRevision() === payload.announcement.revision
          ? null
          : payload.announcement,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      logger.warn("Public announcement could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAnnouncement(controller.signal);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadAnnouncement();
    }, REFRESH_INTERVAL_MS);
    const refreshVisiblePage = () => {
      if (document.visibilityState === "visible") void loadAnnouncement();
    };
    document.addEventListener("visibilitychange", refreshVisiblePage);
    window.addEventListener(ANNOUNCEMENT_UPDATED_EVENT, refreshVisiblePage);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
      window.removeEventListener(ANNOUNCEMENT_UPDATED_EVENT, refreshVisiblePage);
    };
  }, [loadAnnouncement]);

  useLayoutEffect(() => {
    const banner = bannerRef.current;
    if (!banner) {
      document.documentElement.style.removeProperty("--site-announcement-height");
      return;
    }

    const updateHeight = () => {
      document.documentElement.style.setProperty(
        "--site-announcement-height",
        `${banner.getBoundingClientRect().height}px`,
      );
    };
    updateHeight();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateHeight);
    observer?.observe(banner);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
      document.documentElement.style.removeProperty("--site-announcement-height");
    };
  }, [announcement]);

  if (!announcement) return null;

  const Icon =
    announcement.severity === "urgent"
      ? AlertTriangle
      : announcement.severity === "important"
        ? Megaphone
        : Info;
  const label = announcement.severity === "urgent" ? "Urgent team alert" : "Team announcement";

  return (
    <aside
      ref={bannerRef}
      role={announcement.severity === "urgent" ? "alert" : "status"}
      aria-label={label}
      aria-live={announcement.severity === "urgent" ? "assertive" : "polite"}
      aria-atomic="true"
      className={`fixed inset-x-0 top-0 z-[70] border-b-2 shadow-2xl ${severityStyles[announcement.severity]}`}
    >
      <div className="mx-auto flex min-h-14 max-w-7xl items-start gap-3 px-3 py-3 sm:items-center sm:px-6">
        <Icon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 sm:mt-0" />
        <div className="min-w-0 flex-1 text-sm font-bold leading-snug sm:flex sm:items-center sm:gap-4 sm:text-base">
          <span className="block break-words">{announcement.message}</span>
          {announcement.link && announcement.linkLabel && (
            <Link
              to={announcement.link}
              className="mt-2 inline-flex min-h-11 items-center rounded border border-current px-3 py-2 text-xs font-black uppercase tracking-wide underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:mt-0 sm:shrink-0"
            >
              {announcement.linkLabel}
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            rememberDismissal(announcement.revision);
            setAnnouncement(null);
          }}
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:mt-0"
          aria-label="Dismiss team announcement"
        >
          <X aria-hidden="true" size={22} />
        </button>
      </div>
    </aside>
  );
}
