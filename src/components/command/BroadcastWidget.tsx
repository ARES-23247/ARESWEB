import { useState } from "react";
import { MessageSquare, Send, AlertCircle } from "lucide-react";
import { useSendMessage } from "../../api/zulip";

export default function BroadcastWidget() {
  const [stream, setStream] = useState("general");
  const [topic, setTopic] = useState("announcements");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const sendMessage = useSendMessage({
    onSuccess: () => {
      setContent("");
      setStatus({ type: "success", message: "Broadcast sent successfully!" });
      setTimeout(() => setStatus(null), 3000);
    },
    onError: (err) => {
      setStatus({ type: "error", message: err.message || "Failed to send broadcast" });
    }
  });

  const handleSend = () => {
    if (!content.trim() || !stream.trim() || !topic.trim()) return;
    setStatus(null);
    sendMessage.mutate({ stream: stream.trim(), topic: topic.trim(), content: content.trim() });
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
            <label htmlFor="zulip-stream-input" className="block text-[10px] font-bold text-marble/60 uppercase tracking-widest mb-1">Stream</label>
            <input
              id="zulip-stream-input"
              type="text"
              value={stream}
              onChange={(e) => setStream(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-ares-cyan/50 ares-cut-sm transition-colors"
              placeholder="e.g. general"
            />
          </div>
          <div>
            <label htmlFor="zulip-topic-input" className="block text-[10px] font-bold text-marble/60 uppercase tracking-widest mb-1">Topic</label>
            <input
              id="zulip-topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-ares-cyan/50 ares-cut-sm transition-colors"
              placeholder="e.g. announcements"
            />
          </div>
        </div>

        <div className="flex-1">
          <label htmlFor="zulip-content-input" className="block text-[10px] font-bold text-marble/60 uppercase tracking-widest mb-1">Message Content (Markdown)</label>
          <textarea
            id="zulip-content-input"
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
            disabled={sendMessage.isPending || !content.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-ares-cyan text-obsidian font-black text-xs uppercase tracking-widest hover:bg-ares-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ares-cut-sm"
          >
            {sendMessage.isPending ? (
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
