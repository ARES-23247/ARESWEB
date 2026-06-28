import React from "react";
import { Calendar as CalendarIcon, Copy, Check } from "lucide-react";

interface SyncSubscriptionPanelProps {
  webcalUrl: string;
  gcalUrl: string;
  copiedFeedUrl: boolean;
  handleCopyFeedUrl: () => void;
}

export function SyncSubscriptionPanel({
  webcalUrl,
  gcalUrl,
  copiedFeedUrl,
  handleCopyFeedUrl
}: SyncSubscriptionPanelProps) {
  return (
    <div className="bg-black/20 border border-white/10 ares-cut p-6 shadow-xl flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-ares-cyan/10 flex items-center justify-center border border-ares-cyan/25 shrink-0">
          <CalendarIcon size={20} className="text-ares-cyan" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black text-white uppercase tracking-wider leading-none">Subscribe to Feed</h4>
          <p className="text-[10px] text-marble/70 leading-relaxed pt-1">
            Sync ARES events directly into your personal calendar (Google, Apple, or Outlook) to stay updated in real-time.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mt-2">
        <a
          href={webcalUrl}
          className="px-3 py-2 bg-ares-cyan/10 hover:bg-ares-cyan/20 border border-ares-cyan/35 text-ares-cyan hover:text-white text-[9px] font-black uppercase tracking-wider rounded text-center transition-all cursor-pointer shadow flex items-center justify-center gap-1"
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

      <button
        type="button"
        onClick={handleCopyFeedUrl}
        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-marble hover:text-white text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
      >
        {copiedFeedUrl ? (
          <>
            <Check size={11} className="text-ares-success" /> Copied Feed URL!
          </>
        ) : (
          <>
            <Copy size={11} /> Copy Feed URL
          </>
        )}
      </button>
    </div>
  );
}
