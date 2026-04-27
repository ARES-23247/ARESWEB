import React from "react";
import { MessageSquare, RefreshCw, ExternalLink } from "lucide-react";
import { api } from "../../api/client";
import { format } from "date-fns";

interface ZulipThreadViewerProps {
  stream: string;
  topic: string;
}

interface ZulipMessage {
  id: number;
  avatar_url: string | null;
  sender_id: number;
  sender_full_name: string;
  timestamp: number;
  content: string;
}

export default function ZulipThreadViewer({ stream, topic }: ZulipThreadViewerProps) {
  const { data, isLoading, isError, error, refetch, isRefetching } = api.zulip.getTopicMessages.useQuery(
    ["zulip", stream, topic],
    {
      query: { stream, topic },
    },
    {
      refetchInterval: 10000, // Poll every 10 seconds
      retry: false,
    }
  );

  const messages = (data?.status === 200 ? data.body.messages : []) as unknown as ZulipMessage[];

  if (isLoading && !isRefetching) {
    return (
      <div className="bg-white/5 border border-white/10 ares-cut-sm p-8 text-center animate-pulse">
        <RefreshCw className="mx-auto mb-4 text-ares-gold animate-spin" size={24} />
        <p className="text-ares-gold font-bold uppercase tracking-widest text-sm">Syncing Communications...</p>
      </div>
    );
  }

  if (isError || data?.status === 500 || data?.status === 403) {
    return (
      <div className="bg-ares-red/10 border border-ares-red/30 ares-cut-sm p-8 text-center">
        <MessageSquare className="mx-auto mb-4 text-ares-red" size={24} />
        <p className="text-ares-red font-bold uppercase tracking-widest text-sm mb-2">Communications Link Severed</p>
        <p className="text-white/60 text-xs mb-4">
          {data?.status === 403 
            ? "The Oracle bot is not subscribed to this stream and cannot read its messages."
            : (error as Error)?.message || "Failed to fetch event thread."}
        </p>
        <a 
          href={`https://aresfirst.zulipchat.com/#narrow/stream/${encodeURIComponent(stream)}/topic/${encodeURIComponent(topic).replace(/%/g, '.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 ares-cut-sm text-xs font-bold uppercase tracking-widest bg-ares-cyan/20 hover:bg-ares-cyan text-ares-cyan hover:text-black border border-ares-cyan/50 transition-all shadow-lg"
        >
          <ExternalLink size={14} /> Open in Zulip
        </a>
      </div>
    );
  }

  const zulipUrl = `https://aresfirst.zulipchat.com/#narrow/stream/${encodeURIComponent(stream)}/topic/${encodeURIComponent(topic).replace(/%/g, '.')}`;

  return (
    <div className="bg-white/5 border border-white/10 ares-cut-sm p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-xl font-bold text-ares-gold flex items-center gap-2 font-heading uppercase">
          <MessageSquare size={20} /> Event Discussion
        </h3>
        <div className="flex items-center gap-2">
          {isRefetching && <RefreshCw className="animate-spin text-ares-gold" size={14} />}
          <a 
            href={zulipUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 ares-cut-sm text-[10px] font-bold uppercase tracking-widest bg-white/5 hover:bg-ares-cyan/20 text-white/60 hover:text-ares-cyan border border-white/10 transition-all"
          >
            Reply on Zulip <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-2">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-white/40 italic text-sm">
            No messages yet. Be the first to start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-4 p-4 bg-black/40 border border-white/5 ares-cut-sm relative group">
              <img 
                src={msg.avatar_url || `https://api.dicebear.com/9.x/bottts/svg?seed=${msg.sender_id}`} 
                alt={msg.sender_full_name} 
                className="w-10 h-10 ares-cut-sm shrink-0 bg-obsidian"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="font-bold text-ares-cyan text-sm">{msg.sender_full_name}</span>
                  <span className="text-[10px] text-white/40 font-mono tracking-wider">
                    {format(new Date(msg.timestamp * 1000), "MMM d, h:mm a")}
                  </span>
                </div>
                {/* Zulip sends pre-rendered HTML for content */}
                <div 
                  className="prose prose-sm prose-invert max-w-none prose-a:text-ares-gold prose-p:leading-snug prose-p:mb-0 prose-img:max-h-64"
                  dangerouslySetInnerHTML={{ __html: msg.content }}
                />
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="pt-2">
        <button 
          onClick={() => refetch()}
          className="w-full py-2 text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-ares-gold transition-colors flex justify-center items-center gap-2"
        >
          <RefreshCw size={12} /> Force Sync
        </button>
      </div>
    </div>
  );
}
