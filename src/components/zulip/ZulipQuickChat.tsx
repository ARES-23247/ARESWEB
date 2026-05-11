import { useState, useEffect, useRef, useMemo } from "react";
import { Send, Loader2, MessageSquare, User } from "lucide-react";
import { useSendMessage, useGetTopicMessages } from "../../api/zulip";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import DOMPurify from "dompurify";

interface ZulipQuickChatProps {
  stream?: string;
  topic?: string;
}

export default function ZulipQuickChat({ 
  stream = "general", 
  topic = "ARES Web" 
}: ZulipQuickChatProps) {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendMessage = useSendMessage();

  const { data, isLoading, isFetching } = useGetTopicMessages(
    { stream, topic },
    { refetchInterval: 10000 } // Poll every 10 seconds
  );

  const messages = useMemo(() => data?.messages || [], [data?.messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!message.trim() || sendMessage.isPending) return;

    try {
      await sendMessage.mutateAsync({
        stream,
        topic,
        content: message.trim()
      });
      setMessage("");
      // No toast needed here to keep UI clean, the message appearing is feedback enough
    } catch (error) {
      console.error("Zulip send error:", error);
      toast.error("Failed to send message. Please check your Zulip configuration.");
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-white/5 flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4 px-1">
        <h4 className="text-[11px] font-black text-marble/40 uppercase tracking-[0.2em] flex items-center gap-2">
          <MessageSquare size={14} className="text-ares-cyan/60" />
          General Broadcast
        </h4>
        {isFetching && !isLoading && (
          <Loader2 size={12} className="text-ares-cyan/40 animate-spin" />
        )}
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent hover:scrollbar-thumb-white/10 transition-colors"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30 gap-2">
            <Loader2 size={24} className="animate-spin text-marble" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Intercepting Telemetry...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-2">
            <MessageSquare size={24} className="text-marble" />
            <span className="text-[10px] font-bold uppercase tracking-widest">No messages in channel</span>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="group animate-in fade-in slide-in-from-bottom-1 duration-300">
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  {msg.avatar_url ? (
                    <img 
                      src={msg.avatar_url} 
                      alt={msg.sender_full_name}
                      className="w-8 h-8 rounded-full border border-white/10 bg-obsidian object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-marble/40">
                      <User size={14} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[11px] font-bold text-white truncate max-w-[120px]">
                      {msg.sender_full_name}
                    </span>
                    <span className="text-[9px] text-marble/30 font-medium whitespace-nowrap">
                      {formatDistanceToNow(msg.timestamp * 1000, { addSuffix: true })}
                    </span>
                  </div>
                  <div 
                    className="text-xs text-marble/80 leading-relaxed break-words zulip-content"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content) }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="relative group">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Send a message to general chat..."
          className="w-full bg-white/[0.03] border border-white/10 ares-cut-sm p-3 pr-12 text-sm text-marble placeholder:text-marble/20 focus:outline-none focus:border-ares-cyan/50 focus:ring-1 focus:ring-ares-cyan/10 transition-all resize-none h-14 scrollbar-none"
        />
        <button
          type="submit"
          disabled={!message.trim() || sendMessage.isPending}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-ares-cyan hover:text-white disabled:text-marble/10 disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-95"
          title="Send (Enter)"
        >
          {sendMessage.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
      <div className="flex justify-between items-center mt-2 px-1 opacity-40">
        <span className="text-[9px] font-bold text-marble/40 uppercase tracking-widest">
          Channel <span className="text-ares-cyan/70">#{stream} &gt; {topic}</span>
        </span>
        <span className="text-[8px] text-marble/30">Shift+Enter for new line</span>
      </div>
    </div>
  );
}
