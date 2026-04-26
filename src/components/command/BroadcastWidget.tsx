import { useState } from "react";
import { MessageSquare, Send, AlertCircle } from "lucide-react";
import { api } from "../../api/client";

export default function BroadcastWidget() {
  const [stream, setStream] = useState("general");
  const [topic, setTopic] = useState("announcements");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSend = async () => {
    if (!content.trim() || !stream.trim() || !topic.trim()) return;
    
    setIsSending(true);
    setStatus(null);
    try {
      const res = await api.zulip.sendMessage.mutation({
        body: { stream: stream.trim(), topic: topic.trim(), content: content.trim() }
      });
      
      if (res.status === 200 && res.body.success) {
        setContent("");
        setStatus({ type: "success", message: "Broadcast sent successfully!" });
        setTimeout(() => setStatus(null), 3000);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setStatus({ type: "error", message: (res.body as any)?.error || "Failed to send broadcast" });
      }
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-obsidian/50 border border-white/5 ares-cut p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
          <MessageSquare size={16} className="text-ares-cyan" />
          Zulip Broadcast
        </h3>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-marble/60 uppercase tracking-widest mb-1">Stream</label>
            <input
              type="text"
              value={stream}
              onChange={(e) => setStream(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-ares-cyan/50 ares-cut-sm transition-colors"
              placeholder="e.g. general"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-marble/60 uppercase tracking-widest mb-1">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-ares-cyan/50 ares-cut-sm transition-colors"
              placeholder="e.g. announcements"
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-[10px] font-bold text-marble/60 uppercase tracking-widest mb-1">Message Content (Markdown)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-24 bg-white/5 border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-ares-cyan/50 ares-cut-sm transition-colors resize-none"
            placeholder="**Alert:** Practice is canceled today..."
          />
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex-1">
            {status && (
              <p className={`text-[10px] font-bold flex items-center gap-1 ${status.type === "success" ? "text-green-400" : "text-ares-red"}`}>
                <AlertCircle size={12} />
                {status.message}
              </p>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={isSending || !content.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-ares-cyan text-obsidian font-black text-xs uppercase tracking-widest hover:bg-ares-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ares-cut-sm"
          >
            {isSending ? (
              <div className="w-3 h-3 border-2 border-obsidian border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Broadcast
          </button>
        </div>
      </div>
    </div>
  );
}
