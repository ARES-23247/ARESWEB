import { useState, useRef, useEffect } from "react";
import { Send, Bot, RefreshCw, BookOpen, Sparkles, MessageSquare, AlertTriangle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { simPlaygroundRequest, type ChatMessage } from "../../api/ai";

const RULEBOOK_SYSTEM_PROMPT = `You are the ARES 23247 Rulebook Chatbot, an expert AI assistant dedicated to the FIRST® Tech Challenge (FTC) Game Manuals (Part 1 and Part 2) and tournament rules.
You are extremely knowledgeable about FTC regulations, including:
- Robot construction rules (RG01-RG12), motor limits (max 8 motors), voltage requirements, size limits (18x18x18 inches).
- Game play rules (G01-G30), penalties (Minor penalty: 10 points, Major penalty: 30 points).
- Autonomous rules, teleoperated rules, and endgame activities (e.g. Ascent levels, specimen/sample scoring, drone launches).
- Gracious Professionalism® and Coopertition®.

Provide clear, structured, and rules-referenced answers. Always cite specific rule codes (e.g., <G20> or <RG02>) when possible so drivers and referees have precise references. Keep your answers brief, professional, and directly focused on the rules. Always spell FIRST® with the registered trademark symbol where appropriate. Refer to the team's custom library as ARESLib.`;

const SUGGESTED_QUESTIONS = [
  "What is the maximum motor limit under rule <RG01>?",
  "How are Specimen and Sample points scored in teleop?",
  "What counts as a Major Penalty during autonomous?",
  "What are the robot starting size limits and expansion rules?"
];

export default function RulebookChat() {
  const [messages, setMessages] = useState<{ role: "ai" | "user"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    setInput("");
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Map frontend messages to backend expected ChatMessage format
      const apiMessages: ChatMessage[] = newMessages.map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content
      }));

      const res = await simPlaygroundRequest(RULEBOOK_SYSTEM_PROMPT, apiMessages);

      if (!res.ok) {
        throw new Error("Failed to reach AI rulebook endpoint.");
      }

      setMessages(prev => [...prev, { role: "ai", content: "" }]);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                const text = data.chunk || data.response || "";
                if (!text) continue;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  last.content += text;
                  return updated;
                });
              } catch (_e) {
                // Ignore parse errors on individual chunks
              }
            }
          }
        }
      }
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || "Failed to communicate with AI");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-[75vh] bg-white/[0.02] border border-white/5 ares-cut-lg backdrop-blur-md overflow-hidden relative">
      {/* Dynamic glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-ares-red/5 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-ares-gold/5 blur-[80px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/4" />

      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-ares-red/10 via-transparent to-transparent flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 ares-cut bg-ares-red/10 border border-ares-red/30 flex items-center justify-center">
            <BookOpen className="text-ares-red" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-white uppercase flex items-center gap-1.5">
              FTC Game Manual Rulebook AI
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-cyan opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-ares-cyan"></span>
              </span>
            </h2>
            <p className="text-[10px] text-marble/50 font-bold tracking-wider uppercase">Official Rule Interpreter & Citation Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 ares-cut-sm bg-white/5 border border-white/10 text-[10px] font-black uppercase text-ares-gold tracking-widest">
          <Sparkles size={12} className="text-ares-gold" />
          Powered by z.ai
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-xl mx-auto py-12">
            <div className="w-16 h-16 bg-white/5 ares-cut border border-white/10 flex items-center justify-center mb-6">
              <Bot className="w-8 h-8 text-ares-red" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">FTC Rulebook Search Agent</h3>
            <p className="text-xs text-marble/60 leading-relaxed mb-8">
              Ask any complex technical question about robot expansion limits, scoring scenarios, autonomous constraints, or driver qualifications. I will search the FTC Game Manual rules and cite specific codes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left p-4 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-ares-red/30 text-xs font-bold text-marble/80 transition-all flex items-center justify-between group"
                >
                  <span className="line-clamp-2">{q}</span>
                  <ArrowRight size={14} className="text-marble/40 group-hover:text-ares-red group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 mt-10 text-[9px] text-marble/40 font-bold uppercase tracking-wider">
              <AlertTriangle size={12} />
              Verify on-field decisions directly with head referees.
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-xl text-xs leading-relaxed shadow-lg ${
              m.role === 'user'
                ? 'bg-ares-red/10 border border-ares-red/30 text-white rounded-br-none'
                : 'bg-white/[0.03] border border-white/10 text-marble/90 rounded-bl-none prose prose-invert prose-xs max-w-none'
            }`}>
              {m.role === 'ai' ? (
                <ReactMarkdown>{m.content}</ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-white/[0.03] border border-white/10 p-4 rounded-xl rounded-bl-none flex items-center gap-2">
              <RefreshCw size={14} className="text-ares-red animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-marble/40 animate-pulse">Querying Rulebooks...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-white/10 bg-black/40 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask about rule violations, scoring mechanics, motor rules..."
            className="flex-1 bg-obsidian border border-white/10 px-4 py-3 text-xs text-white placeholder-marble/25 font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 bg-ares-red text-white hover:bg-red-700 font-bold text-xs uppercase tracking-widest ares-cut-sm flex items-center justify-center gap-2 shadow-lg shadow-ares-red/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
