import { useState } from "react";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { useSendMessage } from "../../api/zulip";
import { toast } from "sonner";

interface ZulipQuickChatProps {
  stream?: string;
  topic?: string;
}

export default function ZulipQuickChat({ 
  stream = "general", 
  topic = "ARES Web" 
}: ZulipQuickChatProps) {
  const [message, setMessage] = useState("");
  const sendMessage = useSendMessage();

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
      toast.success("Message sent to Zulip!");
    } catch (error) {
      console.error("Zulip send error:", error);
      toast.error("Failed to send message. Please check your Zulip configuration.");
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <div className="flex items-center justify-between mb-3 px-1">
        <h4 className="text-[10px] font-black text-marble/40 uppercase tracking-widest flex items-center gap-1.5">
          <MessageSquare size={12} className="text-ares-cyan/60" />
          General Broadcast
        </h4>
      </div>
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
          className="w-full bg-black/40 border border-white/10 ares-cut-sm p-3 pr-12 text-sm text-marble placeholder:text-marble/30 focus:outline-none focus:border-ares-cyan/50 focus:ring-1 focus:ring-ares-cyan/20 transition-all resize-none h-12 scrollbar-none"
        />
        <button
          type="submit"
          disabled={!message.trim() || sendMessage.isPending}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-ares-cyan hover:text-white disabled:text-marble/20 disabled:cursor-not-allowed transition-colors"
          title="Send (Enter)"
        >
          {sendMessage.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
      <div className="flex justify-between items-center mt-1.5 px-1">
        <span className="text-[10px] font-bold text-marble/30 uppercase tracking-widest">
          Sending to <span className="text-ares-cyan/50">#{stream} &gt; {topic}</span>
        </span>
        <span className="text-[9px] text-marble/20 italic">Press Enter to send</span>
      </div>
    </div>
  );
}
