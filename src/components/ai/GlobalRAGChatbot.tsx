import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, ShieldAlert } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";
import { useUIStore } from "../../store/uiStore";

export function GlobalRAGChatbot() {
  const { isChatbotOpen, setChatbotOpen } = useUIStore();
  const [messages, setMessages] = useState<{ role: "ai" | "user"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [sessionId] = useState(() => {
    if (typeof window !== "undefined") {
      const existing = sessionStorage.getItem("ares_rag_session");
      if (existing) return existing;
      const newId = uuidv4();
      sessionStorage.setItem("ares_rag_session", newId);
      return newId;
    }
    return uuidv4();
  });

  useEffect(() => {
    if (sessionId && messages.length === 0) {
      fetch(`/api/ai/chat-session/${sessionId}`)
        .then(res => res.json())
        .then((data: unknown) => {
          const parsed = data as { messages?: { role: string; content: string }[] };
          if (parsed && parsed.messages && parsed.messages.length > 0) {
            setMessages(parsed.messages.map(m => ({
              role: m.role === "assistant" ? "ai" : (m.role as "ai" | "user"),
              content: m.content
            })));
          }
        })
        .catch(e => console.error("Failed to load chat history", e));
    }
  }, [sessionId, messages.length]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !turnstileToken) {
      toast.error("Please wait for security verification to complete.");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/rag-chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage, turnstileToken, sessionId }),
      });

      if (!res.ok) throw new Error("Failed to reach AI");

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
                // Skip non-chunk events (model indicator, etc.)
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
    } catch (_e) {
      toast.error("Failed to communicate with z.ai");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div 
        className={`fixed top-20 right-6 w-96 h-[32rem] bg-zinc-900 border border-zinc-700 shadow-2xl rounded-2xl flex flex-col transition-all origin-top-right z-[100] overflow-hidden ${isChatbotOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center justify-between p-4 bg-zinc-800 border-b border-zinc-700">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            <div className="font-bold text-zinc-100">ARES Knowledge Bot</div>
          </div>
          <button onClick={() => setChatbotOpen(false)} aria-label="Close AI Assistant" className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-zinc-400 mt-10">
              <Bot className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
              <p>Ask me anything about ARES 23247 rules, code, or schedule.</p>
              <div className="flex items-center justify-center space-x-1 mt-4 text-xs text-yellow-600/60">
                <ShieldAlert className="w-3 h-3" />
                <span>All PII is scrubbed before transmission.</span>
              </div>
            </div>
          )}
          
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-zinc-700'}`}>
                {m.role === 'ai' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
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

        <div className="p-3 border-t border-zinc-700 bg-zinc-800/50">
          <div className="mb-2 flex justify-center transform scale-75 origin-left">
            <Turnstile siteKey="1x00000000000000000000AA" onSuccess={setTurnstileToken} />
          </div>
          <form onSubmit={handleSubmit} className="flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || !turnstileToken}
              placeholder={turnstileToken ? "Ask a question..." : "Verifying connection..."}
              aria-label="Ask ARES Knowledge Bot a question"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={isLoading || !turnstileToken || !input.trim()}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
            >
              {isLoading ? <Bot className="w-5 h-5 animate-pulse" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
