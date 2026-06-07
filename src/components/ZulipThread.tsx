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
      <div className={`border border-white/10 rounded-lg p-6 bg-black/40 glass-card animate-pulse ${className || "my-8"}`}>
        <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
          <MessageSquare className="text-ares-gray" size={20} />
          <h3 className="font-heading font-bold text-ares-gray">Zulip Thread: {topic}</h3>
        </div>
        <div className="space-y-4">
          <div className="h-16 bg-white/5 rounded w-full"></div>
          <div className="h-16 bg-white/5 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-white/10 rounded-lg bg-black/40 glass-card overflow-hidden flex flex-col max-h-[600px] ${className || "my-8"}`}>
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="text-ares-cyan" size={20} />
          <h3 className="font-heading font-bold text-white">Zulip Discussion: {topic}</h3>
          <span className="bg-ares-cyan/20 text-ares-cyan text-xs font-bold px-2 py-0.5 rounded-full">
            {data ? data.length : 0}
          </span>
        </div>
        <button 
          type="button"
          onClick={() => refetch()}
          className="text-ares-gray hover:text-white transition-colors"
          title="Refresh Messages"
          aria-label="Refresh Messages"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      
      <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar flex-grow bg-black/20">
        {error || !data || data.length === 0 ? (
          <div className="text-center py-6">
            <p className={`mb-4 ${error ? "text-red-400 font-bold" : "text-ares-gray"}`}>
              {error ? `Error: ${(error as Error).message}` : "No messages found for this topic yet. Start the conversation!"}
            </p>
          </div>
        ) : (
          data.map((msg) => (
            <div key={msg.id} className="flex gap-4">
              <div className="flex-shrink-0">
                {msg.avatar_url ? (
                  <img src={msg.avatar_url} alt={msg.sender_full_name} className="w-10 h-10 rounded-full border border-white/10" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-ares-gray flex items-center justify-center font-bold text-black">
                    {(msg.sender_full_name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-bold text-white">{msg.sender_full_name}</span>
                  <span className="text-xs text-ares-gray">{new Date(msg.timestamp * 1000).toLocaleString()}</span>
                </div>
                <div
                  className="prose prose-sm prose-invert max-w-none text-marble/80 prose-p:my-1 prose-a:text-ares-cyan prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-white/10 bg-white/5 shrink-0">
        {sendMessageMutation.isError && (
          <div className="text-red-400 text-sm mb-2 px-2 font-bold">
            Failed to send: {sendMessageMutation.error.message}
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Reply to #${stream} > ${topic}...`}
            aria-label="Message content"
            className="flex-grow bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-ares-cyan"
            disabled={sendMessageMutation.isPending}
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="bg-ares-cyan hover:bg-ares-cyan/80 text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
