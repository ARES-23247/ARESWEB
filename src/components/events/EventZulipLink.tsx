import React from "react";
import { MessageSquare } from "lucide-react";
import { EventItem } from "./types";

interface EventZulipLinkProps {
  event: EventItem;
  isVerified: boolean;
}

export default function EventZulipLink({ event, isVerified }: EventZulipLinkProps) {
  if (!isVerified || (!event.zulipStream && !event.zulipTopic)) return null;

  const stream = event.zulipStream || "events";
  const topic = event.zulipTopic || `Event: ${event.title}`;
  const zulipUrl = `https://zulip.aresfirst.org/#narrow/stream/${encodeURIComponent(stream)}/topic/${encodeURIComponent(topic)}`;

  return (
    <div className="p-6 bg-black/40 border border-white/10 ares-cut flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-ares-gold/15 flex items-center justify-center border border-ares-gold/20 shrink-0">
        <MessageSquare size={18} className="text-ares-gold" />
      </div>
      <div className="space-y-2 w-full">
        <h4 className="text-sm font-black text-white uppercase tracking-wider">Event Discussions (Zulip Feed)</h4>
        <p className="text-xs text-marble/70 leading-relaxed">
          Join discussions for logistics, practices, and recaps directly inside the ARES chat system.
        </p>
        <a
          href={zulipUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold hover:brightness-110 text-black text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer shadow-md mt-2"
        >
          Open Zulip Thread ↗
        </a>
      </div>
    </div>
  );
}
