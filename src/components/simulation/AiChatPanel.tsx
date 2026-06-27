import { Bot, Loader2, Send } from "lucide-react";
import { ChatMessage } from "../../utils/ai";

interface AiChatPanelProps {
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  chatInput: string;
  setChatInput: (input: string) => void;
  handleChatKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleChatSend: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function AiChatPanel({
  chatMessages,
  isChatLoading,
  chatInput,
  setChatInput,
  handleChatKeyDown,
  handleChatSend,
  chatEndRef,
  chatInputRef,
}: AiChatPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Chat messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-ares-gray-dark">
        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-ares-red/20 text-white border border-ares-red/30"
                  : "bg-ares-gray-dark text-marble border border-white/5"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Bot className="w-3.5 h-3.5 text-ares-gold" />
                  <span className="text-[10px] font-bold text-ares-gold uppercase tracking-widest">
                    z.AI
                  </span>
                </div>
              )}
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            </div>
          </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-start">
            <div className="bg-ares-gray-dark border border-white/5 px-3 py-2 rounded-xl">
              <div className="flex items-center gap-2 text-sm text-marble/70">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-ares-gold" />
                Thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <div className="p-2 border-t border-white/10 bg-obsidian-dark shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder="Describe what to build or fix..."
            rows={1}
            className="flex-1 bg-ares-gray-deep/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-marble/30 resize-none focus:outline-none focus:border-ares-red/50 transition-colors"
          />
          <button
            onClick={() => handleChatSend()}
            disabled={isChatLoading || !chatInput.trim()}
            className="p-2 bg-ares-red hover:bg-ares-bronze disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

    </div>
  );
}
