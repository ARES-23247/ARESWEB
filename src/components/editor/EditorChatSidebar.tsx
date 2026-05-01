import React, { useState, useRef, useEffect } from "react";
import { Send, X, Trash2, Loader2, Play } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Editor } from "@tiptap/react";
import { CodeBlock } from "../docs/CodeBlock";

interface EditorChatSidebarProps {
  editor: Editor | null;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function EditorChatSidebar({ editor, onClose }: EditorChatSidebarProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your editor assistant. I can see your document. How can I help you write or format this?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setIsChatLoading(true);

    const newMessages = [...chatMessages, { role: "user" as const, content: msg }];
    setChatMessages(newMessages);

    // Get current editor content
    const editorContent = editor ? editor.getText() : "";

    const systemPrompt = `You are z.AI, an expert technical writer and editor assistant for the ARES 23247 FIRST Robotics team. 
You are integrated into the ARESWEB Markdown/Tiptap editor. 
You have access to the user's current document content. 
When asked to write or rewrite text, provide clear, concise, and professional responses.
If you provide text that the user should insert into their document, format it in a markdown code block so they can easily use the "Insert" button.`;

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai/editor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, messages: apiMessages, editorContent }),
      });

      if (!res.ok) throw new Error("Failed to connect to AI");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = "";

      setChatMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                aiResponse += data.chunk;
                setChatMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: aiResponse };
                  return updated;
                });
              }
            } catch (_e) {
              // ignore parse errors
            }
          }
        }
      }
    } catch (_e) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Error connecting to AI. Please try again." }]);
    } finally {
      setIsChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const insertIntoEditor = (text: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
  };

  return (
    <div className="w-80 border-l border-white/10 bg-[#0d0f14] flex flex-col h-full shrink-0 relative z-10 rounded-br-xl shadow-xl">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40">
        <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
          Editor z.AI
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setChatMessages([chatMessages[0]])}
            title="Clear chat"
            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close chat"
            className="p-1.5 rounded-md text-white/40 hover:text-ares-red hover:bg-ares-red/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0c10] scrollbar-thin scrollbar-thumb-white/10">
        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[95%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/20"
                  : "bg-white/5 text-white/80 border border-white/5"
              }`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-pre:p-0 prose-pre:bg-transparent text-xs">
                  <ReactMarkdown
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        const codeStr = String(children).replace(/\n$/, '');
                        
                        if (isInline) {
                          return <code className="bg-white/10 text-ares-gold px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
                        }
                        
                        return (
                          <div className="relative group mt-2 border border-white/10 rounded-md overflow-hidden bg-black/60">
                            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1 bg-gradient-to-l from-black/80 to-transparent pl-4 rounded-bl-md">
                              <button 
                                onClick={() => insertIntoEditor(codeStr)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-indigo-400 transition-colors flex items-center gap-1 shadow-sm"
                                title="Insert into document"
                              >
                                <Play className="w-2.5 h-2.5" /> Insert
                              </button>
                            </div>
                            <CodeBlock language={match[1]} value={codeStr} />
                          </div>
                        );
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span className="text-xs text-white/40">z.AI is thinking...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-3 border-t border-white/10 flex flex-col gap-2 shrink-0 bg-black/20">
        <div className="flex gap-2">
          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder="Ask AI to write or format..."
            rows={2}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none resize-none shadow-inner"
          />
          <button
            onClick={handleChatSend}
            disabled={isChatLoading || !chatInput.trim()}
            className="self-end p-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 transition-colors shadow-md disabled:opacity-30 disabled:hover:bg-indigo-600 group"
          >
            <Send className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
