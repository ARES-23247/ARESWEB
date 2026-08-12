import React from "react";
import { Calendar as CalendarIcon, Copy, Check } from "lucide-react";

interface SyncSubscriptionPanelProps {
  webcalUrl: string;
  gcalUrl: string;
  copyStatus: "idle" | "copied" | "error";
  handleCopyFeedUrl: () => Promise<void>;
}

export function SyncSubscriptionPanel({
  webcalUrl,
  gcalUrl,
  copyStatus,
  handleCopyFeedUrl
}: SyncSubscriptionPanelProps) {
  return (
    <div className="bg-black/20 border border-white/10 ares-cut p-6 shadow-xl flex flex-col gap-4">
      <span className="sr-only" role="status" aria-live="polite">
        {copyStatus === "copied"
          ? "Calendar feed URL copied to clipboard."
          : copyStatus === "error"
            ? "The calendar feed URL could not be copied."
            : ""}
      </span>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-ares-gold/10 flex items-center justify-center border border-ares-gold/25 shrink-0">
          <CalendarIcon aria-hidden="true" size={20} className="text-ares-gold" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black text-white uppercase tracking-wider leading-none">Subscribe to Feed</h4>
          <p className="text-[10px] text-marble/70 leading-relaxed pt-1">
            Subscribe to published ARES events in Google, Apple, or Outlook. Each app chooses when to refresh the feed.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mt-2">
        <a
          href={webcalUrl}
          className="px-3 py-2 bg-ares-gold/10 hover:bg-ares-gold/20 border border-ares-gold/35 text-ares-gold hover:text-white text-[9px] font-black uppercase tracking-wider rounded text-center transition-all cursor-pointer shadow flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Subscribe (iCal)
        </a>
        <a
          href={gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 bg-ares-gold/10 hover:bg-ares-gold/20 border border-ares-gold/35 text-ares-gold hover:text-white text-[9px] font-black uppercase tracking-wider rounded text-center transition-all cursor-pointer shadow flex items-center justify-center gap-1"
        >
          Google Calendar
        </a>
      </div>

      <p className="text-[9px] leading-relaxed text-marble/60">
        Google may open its add-calendar screen. If it does not, copy the feed URL. Then choose <strong className="text-marble/80">Other calendars → From URL</strong> in Google Calendar.
      </p>

      <button
        type="button"
        onClick={handleCopyFeedUrl}
        aria-label={copyStatus === "copied" ? "Calendar feed URL copied" : "Copy calendar feed URL"}
        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-marble hover:text-white text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        {copyStatus === "copied" ? (
          <>
            <Check aria-hidden="true" size={11} className="text-ares-gold" /> Feed URL copied
          </>
        ) : (
          <>
            <Copy aria-hidden="true" size={11} /> Copy Feed URL
          </>
        )}
      </button>
      {copyStatus === "error" && (
        <p role="alert" className="rounded border border-ares-red/40 bg-ares-red/15 p-2 text-[9px] text-white">
          Copy failed. Open the iCal link, then copy its address from your browser.
        </p>
      )}
    </div>
  );
}
