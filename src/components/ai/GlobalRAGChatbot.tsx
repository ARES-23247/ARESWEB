import React, { useState, useRef, useEffect, memo } from "react";
import { X, Send, Bot, ShieldAlert, RefreshCw, GripHorizontal } from "lucide-react";
import { motion, useDragControls } from "framer-motion";
import Turnstile, { TurnstileRef } from "../Turnstile";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";
import { useUIStore } from "../../store/uiStore";
import { z } from "zod";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { getChatSession, ragChatbotRequest } from "../../api/ai";

// SEC-WR-08: Zod schema for validating chat session API response
const chatSessionSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000) // Limit message size to prevent DoS
  }))
});

export const GlobalRAGChatbot = memo(function GlobalRAGChatbot() {
  const { isChatbotOpen, setChatbotOpen } = useUIStore();
  const [messages, setMessages] = useState<{ role: "ai" | "user"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileRef>(null);
  const dragControls = useDragControls();
  const [sessionId] = useState(() => {
    if (typeof window !== "undefined") {
      const existing =       sessionStorage.getItem(STORAGE_KEYS.RAG_SESSION);
      if (existing) return existing;
      const newId = uuidv4();
            sessionStorage.setItem(STORAGE_KEYS.RAG_SESSION, newId);
      return newId;
    }
    return uuidv4();
  });

  useEffect(() => {
    if (sessionId && messages.length === 0) {
      getChatSession(sessionId)
        .then(data => {
          // SEC-WR-08: Validate response structure before using
          const validated = chatSessionSchema.safeParse(data);
          if (validated.success) {
            setMessages(validated.data.messages.map(m => ({
              role: m.role === "assistant" ? "ai" : "user",
              content: m.content
            })));
          }
          // If validation fails, silently start with empty messages
        })
        .catch(e => {
          console.error("Failed to load chat history", e);
          // Don't show toast for session load failures - just start fresh
        });
    }
  }, [sessionId, messages.length]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || !turnstileToken) {
      toast.error("Please wait for security verification to complete.");
      return;
    }

    const currentToken = turnstileToken;
    setTurnstileToken(null);
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await ragChatbotRequest(userMessage, currentToken, sessionId);

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = "Failed to reach AI";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error) errMsg = parsed.error;
        } catch (_e) {
          // Ignore JSON parse error, fallback to default error message
        }
        throw new Error(errMsg);
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
                if (!data.chunk) continue;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const last = newMsgs[newMsgs.length - 1];
                  last.content += data.chunk;
                  return newMsgs;
                });
              } catch (_e) {
                // Ignore chunk parse errors
              }
            }
          }
        }
      }
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || "Failed to communicate with z.ai");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };


  return (
    <>
      {/* Floating Trigger Button */}
      <motion.button
        drag
        dragMomentum={false}
        onClick={() => setChatbotOpen(!isChatbotOpen)}
        className={`fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-[110] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-colors duration-500 group overflow-hidden cursor-grab active:cursor-grabbing ${
          isChatbotOpen 
            ? "bg-ares-red" 
            : "bg-indigo-600 hover:bg-indigo-500"
        }`}
        aria-label={isChatbotOpen ? "Close AI Assistant" : "Open AI Assistant"}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        {isChatbotOpen ? (
          <X className="w-6 h-6 text-white pointer-events-none" />
        ) : (
          <div className="relative pointer-events-none">
            <Bot className="w-7 h-7 text-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-ares-cyan rounded-full border-2 border-indigo-600 animate-pulse" />
          </div>
        )}
      </motion.button>

      {/* Chat Window */}
      <motion.div 
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        className={`fixed bottom-20 right-4 left-4 sm:left-auto sm:bottom-24 sm:right-8 w-auto sm:w-[24rem] h-[75dvh] sm:h-[36rem] bg-zinc-900 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl flex flex-col transition-opacity duration-300 z-[100] overflow-hidden ${
          isChatbotOpen 
            ? 'opacity-100' 
            : 'opacity-0 pointer-events-none hidden'
        }`}
      >
        <div 
          className="flex items-center justify-between p-4 bg-zinc-800/80 backdrop-blur-md border-b border-white/10 cursor-move touch-none"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Bot className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="font-bold text-zinc-100 text-sm">ARES Intelligence</div>
              <div className="text-[10px] text-ares-cyan flex items-center gap-1 uppercase tracking-widest font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-ares-cyan animate-pulse" /> Online
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <GripHorizontal className="w-5 h-5 text-zinc-500 mr-2 pointer-events-none" />
            <button 
              onClick={() => setChatbotOpen(false)} 
              aria-label="Close AI Assistant" 
              className="text-zinc-400 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div aria-live="polite" className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-zinc-700">
          {messages.length === 0 && (
            <div className="text-center text-zinc-400 mt-12 px-6">
              <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                <Bot className="w-8 h-8 text-indigo-400/50" />
              </div>
              <h4 className="text-zinc-100 font-bold mb-2">How can I help you?</h4>
              <p className="text-xs leading-relaxed text-zinc-400">Ask me anything about ARES 23247 engineering standards, software rules, or the team schedule.</p>
              
              <div className="grid grid-cols-1 gap-2 mt-8">
                {["What are the CAD rules?", "Explain the game strategy", "When is the next meeting?"].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      sendMessage(q);
                    }}
                    className="text-left px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] text-zinc-300 transition-all hover:border-indigo-500/30"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center space-x-1 mt-8 text-[10px] text-white font-medium uppercase tracking-widest">
                <ShieldAlert className="w-3 h-3" />
                <span>Zero PII Retained</span>
              </div>
            </div>
          )}
          
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm ${
                m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none shadow-lg' 
                  : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-white/5 shadow-md'
              }`}>
                {m.role === 'ai' ? (
                  <div className="prose prose-invert prose-xs max-w-none prose-p:leading-relaxed prose-pre:bg-black/30">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-white/10 bg-zinc-800/50 backdrop-blur-sm">
          <div className="mb-3 flex justify-center transform scale-75 origin-left">
            <Turnstile ref={turnstileRef} onVerify={setTurnstileToken} theme="dark" />
          </div>
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading || !turnstileToken}
                placeholder={turnstileToken ? "Type your message..." : "Verifying..."}
                aria-label="Ask ARES Knowledge Bot a question"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              aria-label="Send message"
              disabled={isLoading || !turnstileToken || !input.trim()}
              className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:bg-zinc-700 transition-all flex items-center justify-center shadow-lg shadow-indigo-600/20"
            >
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      </motion.div>
    </>
  );
});
