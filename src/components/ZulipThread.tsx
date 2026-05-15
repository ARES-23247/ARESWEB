import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, RefreshCw, Send } from 'lucide-react';
import { sanitizeHtml } from '../utils/security';

interface ZulipMessage {
  id: number;
  content: string;
  sender_email: string;
  sender_full_name: string;
  sender_id: number;
  timestamp: number;
  avatar_url: string | null;
}

interface ZulipThreadProps {
  stream: string;
  topic: string;
  className?: string;
}

export default function ZulipThread({ stream, topic, className }: ZulipThreadProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['zulip-messages', stream, topic],
    queryFn: async () => {
      const res = await fetch(`/api/zulip/topic?stream=${encodeURIComponent(stream)}&topic=${encodeURIComponent(topic)}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error("Bot not subscribed to this stream.");
        
        let errorMsg = "Failed to fetch messages.";
        try {
          const errData = (await res.json()) as { error?: string };
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_e) {
          // ignore parse error
        }
        throw new Error(errorMsg);
      }
      const json = await res.json() as { success: boolean, messages: ZulipMessage[] };
      return json.messages || [];
    },
    refetchOnWindowFocus: false,
    retry: 1
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/zulip/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream, topic, content })
      });
      if (!res.ok) {
        let errorMsg = "Failed to send message";
        try {
          const errData = await res.json() as { error?: string };
          if (errData?.error) {
            errorMsg = errData.error;
          }
        } catch (_e) {
          // ignore parse error
        }
        throw new Error(errorMsg);
      }
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['zulip-messages', stream, topic] });
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  if (isLoading) {
    return (
      <div className={`bg-black/40 ares-cut-lg border border-white/5 p-10 animate-pulse ${className || "my-12"}`}>
        <div className="flex items-center gap-4 mb-10">
          <div className="w-10 h-10 bg-white/5 ares-cut-sm"></div>
          <div className="h-6 bg-white/5 ares-cut-sm w-48"></div>
        </div>
        <div className="space-y-6">
          <div className="h-20 bg-white/5 ares-cut-lg w-full"></div>
          <div className="h-20 bg-white/5 ares-cut-lg w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black/40 ares-cut-lg border border-white/5 shadow-2xl flex flex-col max-h-[700px] backdrop-blur-sm group ${className || "my-12"}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-ares-cyan/10 ares-cut-sm border border-ares-cyan/30 shadow-lg shadow-ares-cyan/10 group-hover:bg-ares-cyan/20 transition-all duration-500">
            <MessageSquare className="text-ares-cyan" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-tight">NEURAL_LINK: {topic.toUpperCase()}</h3>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-marble/20 border border-white/5 px-2 py-0.5 ares-cut-sm bg-white/5">PROTO_ZULIP // STREAM: {stream.toUpperCase()}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-ares-cyan/30 animate-pulse"></div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-ares-cyan">{data?.length || 0} DATA_PACKETS</span>
            </div>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => refetch()}
          className="p-3 text-marble/20 hover:text-white hover:bg-white/5 ares-cut-sm transition-all border border-transparent hover:border-white/10 shadow-xl"
          title="Refresh Data Pipeline"
        >
          <RefreshCw size={20} />
        </button>
      </div>
      
      {/* Messages */}
      <div className="p-8 space-y-12 overflow-y-auto custom-scrollbar flex-grow bg-black/40 backdrop-blur-md">
        {error || !data || data.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center gap-6">
            <div className="w-16 h-[1px] bg-marble/10"></div>
            <p className={`uppercase tracking-[0.4em] font-black text-[10px] ${error ? "text-ares-red animate-pulse" : "text-marble/20"}`}>
              {error ? `SYSTEM_FAULT: ${(error as Error).message}` : "ZERO_PACKETS_IN_STREAM"}
            </p>
            <div className="w-16 h-[1px] bg-marble/10"></div>
          </div>
        ) : (
          data.map((msg) => (
            <div key={msg.id} className="flex gap-8 group/msg relative">
              <div className="absolute -left-4 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent"></div>
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute -inset-2 bg-gradient-to-tr from-ares-red/10 via-ares-cyan/10 to-ares-gold/10 rounded-full blur-xl opacity-0 group-hover/msg:opacity-100 transition-all duration-700"></div>
                  {msg.avatar_url ? (
                    <img src={msg.avatar_url} alt={msg.sender_full_name} className="w-14 h-14 rounded-full border border-white/10 relative z-10 grayscale hover:grayscale-0 transition-all shadow-2xl" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center font-black text-marble/20 border border-white/5 relative z-10 uppercase text-lg shadow-inner">
                      {msg.sender_full_name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-grow min-w-0 pt-1">
                <div className="flex items-center gap-4 mb-3">
                  <span className="font-black text-white uppercase tracking-[0.1em] text-xs">{msg.sender_full_name}</span>
                  <div className="h-[1px] flex-1 bg-white/[0.03]"></div>
                  <span className="text-[10px] font-black text-marble/20 uppercase tracking-[0.2em]">{new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}</span>
                </div>
                <div
                  className="prose prose-sm prose-invert max-w-none text-marble/60 prose-p:my-2 prose-a:text-ares-cyan prose-a:no-underline hover:prose-a:underline font-medium leading-relaxed selection:bg-ares-cyan/30"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-8 border-t border-white/5 bg-black/60 backdrop-blur-xl shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        {sendMessageMutation.isError && (
          <div className="text-ares-red text-[10px] font-black uppercase tracking-[0.3em] mb-4 px-4 py-2 bg-ares-red/5 border border-ares-red/20 ares-cut-sm animate-pulse">
            TRANSMISSION_FAULT: {sendMessageMutation.error.message.toUpperCase()}
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`TRANSMIT_TO_LINK #${stream.toUpperCase()} // ${topic.toUpperCase()}...`}
            className="flex-grow bg-black/40 border border-white/5 ares-cut-sm px-6 py-5 text-white placeholder-marble/10 focus:outline-none focus:border-ares-cyan/30 transition-all font-black uppercase tracking-widest text-xs shadow-inner"
            disabled={sendMessageMutation.isPending}
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="bg-ares-cyan text-black px-12 py-5 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] disabled:opacity-20 disabled:cursor-not-allowed group/send shadow-lg shadow-ares-cyan/20 active:scale-95 transition-all"
          >
            {sendMessageMutation.isPending ? "TRANSMITTING..." : (
              <div className="flex items-center gap-3">
                <Send size={20} className="group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-500" />
                TRANSMIT
              </div>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
