import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { Play, Save, Loader2, RotateCcw, Copy, Check, Send, Trash2, GripVertical } from "lucide-react";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));
const SimPreviewFrame = lazy(() => import("./editor/SimPreviewFrame"));

// Babel standalone for JSX transpilation
let Babel: { transform: (code: string, opts: Record<string, unknown>) => { code: string } } | null = null;
const loadBabel = async () => {
  if (!Babel) {
    // @ts-expect-error -- @babel/standalone provides a global export
    const mod = await import("@babel/standalone");
    Babel = mod.default || mod;
  }
  return Babel!;
};

const DEFAULT_CODE = `// ARES Simulation Playground
// Your code must export a function called SimComponent
// Available: React, useState, useEffect, useRef, useCallback, useMemo

function SimComponent() {
  const [angle, setAngle] = React.useState(0);
  const [speed, setSpeed] = React.useState(2);

  React.useEffect(() => {
    const id = setInterval(() => {
      setAngle(prev => (prev + speed) % 360);
    }, 16);
    return () => clearInterval(id);
  }, [speed]);

  const radius = 80;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;

  return (
    <div className="sim-container">
      <div className="sim-title">Robot Arm Visualizer</div>
      <svg width="300" height="300" viewBox="-150 -150 300 300" className="sim-canvas" style={{ display: 'block', margin: '0 auto 16px' }}>
        <circle cx="0" cy="0" r="5" fill="#d4a030" />
        <line x1="0" y1="0" x2={x} y2={y} stroke="#58a6ff" strokeWidth="3" strokeLinecap="round" />
        <circle cx={x} cy={y} r="8" fill="#58a6ff" />
        <circle cx="0" cy="0" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
      </svg>
      <div className="sim-flex" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="sim-label">Speed</div>
          <input type="range" min="0.5" max="10" step="0.5" value={speed} onChange={e => setSpeed(Number(e.target.value))} className="sim-slider" style={{ width: 180 }} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="sim-label">Angle</div>
          <div className="sim-value">{angle.toFixed(0)}°</div>
        </div>
      </div>
    </div>
  );
}`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function SimulationPlayground() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [compiledCode, setCompiledCode] = useState("");
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [simName, setSimName] = useState("Untitled Simulation");
  const compileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Pane resize state
  const [codePaneWidth, setCodePaneWidth] = useState(40); // percent
  const [chatPaneWidth, setChatPaneWidth] = useState(25); // percent
  const isDraggingRef = useRef<"code" | "chat" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Compile logic ──
  const compileCode = useCallback(async (source: string) => {
    setIsCompiling(true);
    setCompileError(null);
    try {
      const babel = await loadBabel();
      const result = babel.transform(source, {
        presets: ["react"],
        filename: "sim.jsx",
      });
      setCompiledCode(result.code || "");
    } catch (e) {
      setCompileError((e as Error).message);
    } finally {
      setIsCompiling(false);
    }
  }, []);

  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || "";
    setCode(newCode);
    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCode(newCode), 800);
  }, [compileCode]);

  useEffect(() => {
    compileCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRun = () => compileCode(code);

  const handleReset = () => {
    setCode(DEFAULT_CODE);
    compileCode(DEFAULT_CODE);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── z.AI Chat ──
  const handleChatSend = async () => {
    const msg = chatInput.trim();
    if (!msg || isChatLoading) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(newMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const systemContext = `You are a z.AI simulation code assistant for ARES 23247, an FTC robotics team. The user is building interactive React simulations that run in a sandboxed iframe.

RULES:
- The component MUST be named SimComponent (not exported, just function SimComponent)
- Use React.useState, React.useEffect, etc. (React is a global, don't import it)
- Available CSS classes: sim-container, sim-title, sim-label, sim-value, sim-slider, sim-canvas, sim-btn, sim-grid, sim-flex
- SVG is great for visualizations. Canvas is also available.
- Output ONLY the JavaScript/JSX code when generating. No markdown fences, no explanations outside of code comments.
- When modifying code, output the COMPLETE updated code, not a diff.

CURRENT CODE:
\`\`\`
${code}
\`\`\`

USER REQUEST: ${msg}`;

      const res = await fetch("/api/ai/liveblocks-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentContext: systemContext, action: "expand" }),
      });

      if (!res.ok || !res.body) throw new Error("AI request failed");

      let accumulatedText = "";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              accumulatedText += data.chunk;
            } catch { /* ignore */ }
          }
        }
      }

      const reply = accumulatedText.trim();
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);

      // Auto-apply code if the reply looks like a full component
      if (reply.includes("function SimComponent") || reply.includes("SimComponent")) {
        let cleaned = reply;
        // Strip markdown fences
        if (cleaned.includes("```")) {
          // eslint-disable-next-line security/detect-unsafe-regex
          const match = cleaned.match(/```(?:jsx?|tsx?|javascript|typescript)?\n?([\s\S]*?)```/);
          if (match) cleaned = match[1];
        }
        // Only apply if it still has SimComponent
        if (cleaned.includes("function SimComponent")) {
          setCode(cleaned.trim());
          compileCode(cleaned.trim());
        }
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `⚠️ Error: ${(e as Error).message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // ── Save ──
  const handleSave = async () => {
    if (!simName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: simName, code }),
      });
      if (res.ok) {
        const { toast } = await import("sonner");
        toast.success("Simulation saved!");
      }
    } catch (e) {
      console.error("[SimPlayground] Save failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Resize handlers ──
  const handleMouseDown = (pane: "code" | "chat") => (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = pane;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;

      if (isDraggingRef.current === "code") {
        const clamped = Math.max(25, Math.min(60, pct));
        setCodePaneWidth(clamped);
      } else if (isDraggingRef.current === "chat") {
        const chatEnd = codePaneWidth + chatPaneWidth;
        const newChatEnd = Math.max(codePaneWidth + 15, Math.min(85, pct));
        setChatPaneWidth(newChatEnd - codePaneWidth);
        void chatEnd; // suppress unused
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [codePaneWidth, chatPaneWidth]);

  const previewPaneWidth = 100 - codePaneWidth - chatPaneWidth;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-h-[900px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-obsidian">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-ares-gold font-black text-xs uppercase tracking-[0.2em]">⚡ Sim Playground</span>
          <input
            type="text"
            value={simName}
            onChange={e => setSimName(e.target.value)}
            className="bg-transparent border border-white/10 text-white text-sm px-3 py-1.5 rounded-md focus:border-ares-gold/50 focus:outline-none transition-colors max-w-[250px]"
            placeholder="Simulation name..."
          />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleRun} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-emerald-600/30 transition-colors">
            <Play className="w-3.5 h-3.5" /> Run
          </button>
          <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-md text-xs font-bold uppercase tracking-wider hover:text-zinc-300 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-md text-xs font-bold uppercase tracking-wider hover:text-zinc-300 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold/20 text-ares-gold border border-ares-gold/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-ares-gold/30 transition-colors disabled:opacity-50">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      {/* 3-Pane Split */}
      <div ref={containerRef} className="flex-1 flex min-h-0">
        {/* ── Code Editor Pane ── */}
        <div style={{ width: `${codePaneWidth}%` }} className="flex flex-col min-h-0 min-w-0">
          <div className="px-3 py-1.5 border-b border-white/10 bg-[#1e1e1e] flex items-center gap-2">
            <span className="text-white/40 text-xs font-mono">SimComponent.jsx</span>
            {isCompiling && <Loader2 className="w-3 h-3 animate-spin text-ares-gold" />}
          </div>
          <div className="flex-1 min-h-0">
            <Suspense fallback={<div className="flex items-center justify-center h-full bg-[#1e1e1e] text-white/40 text-sm">Loading editor...</div>}>
              <MonacoEditor
                height="100%"
                language="javascript"
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  padding: { top: 12 },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: "on",
                  lineNumbers: "on",
                  renderLineHighlight: "gutter",
                  bracketPairColorization: { enabled: true },
                  guides: { indentation: true },
                }}
              />
            </Suspense>
          </div>
        </div>

        {/* ── Resize Handle: Code ↔ Chat ── */}
        <button
          type="button"
          aria-label="Resize code and chat panes"
          onMouseDown={handleMouseDown("code")}
          className="w-1.5 bg-white/5 hover:bg-ares-gold/30 cursor-col-resize flex items-center justify-center transition-colors group border-0 p-0"
        >
          <GripVertical className="w-3 h-3 text-white/20 group-hover:text-ares-gold/60" />
        </button>

        {/* ── z.AI Chat Pane ── */}
        <div style={{ width: `${chatPaneWidth}%` }} className="flex flex-col min-h-0 min-w-0 border-x border-white/5">
          <div className="px-3 py-1.5 border-b border-white/10 bg-[#0d0f14] flex items-center justify-between">
            <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              z.AI Assistant
            </span>
            <button
              onClick={() => setChatMessages([chatMessages[0]])}
              title="Clear chat"
              className="p-1 text-white/20 hover:text-white/50 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#0a0c10] scrollbar-thin scrollbar-thumb-white/10">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/20"
                      : "bg-white/5 text-white/80 border border-white/5"
                  }`}
                >
                  {msg.content.includes("function SimComponent") ? (
                    <div>
                      <p className="text-xs text-ares-gold font-bold mb-1">✅ Code applied to editor</p>
                      <pre className="text-[11px] text-white/50 max-h-24 overflow-hidden">{msg.content.slice(0, 200)}...</pre>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span className="text-xs text-white/40">Generating...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-white/10 bg-[#0d0f14]">
            <div className="flex gap-2">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Describe your simulation..."
                rows={2}
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none resize-none"
              />
              <button
                onClick={handleChatSend}
                disabled={isChatLoading || !chatInput.trim()}
                className="self-end px-3 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-md hover:bg-indigo-600/30 transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-white/20 mt-1 px-1">Enter to send · Shift+Enter for newline · Code auto-applies</p>
          </div>
        </div>

        {/* ── Resize Handle: Chat ↔ Preview ── */}
        <button
          type="button"
          aria-label="Resize chat and preview panes"
          onMouseDown={handleMouseDown("chat")}
          className="w-1.5 bg-white/5 hover:bg-ares-gold/30 cursor-col-resize flex items-center justify-center transition-colors group border-0 p-0"
        >
          <GripVertical className="w-3 h-3 text-white/20 group-hover:text-ares-gold/60" />
        </button>

        {/* ── Live Preview Pane ── */}
        <div style={{ width: `${previewPaneWidth}%` }} className="flex flex-col min-h-0 min-w-0">
          <div className="px-3 py-1.5 border-b border-white/10 bg-[#0d1117] flex items-center gap-2">
            <span className="text-white/40 text-xs font-mono">Live Preview</span>
            <div className={`w-2 h-2 rounded-full ${compileError ? 'bg-red-500' : 'bg-emerald-500'}`} />
          </div>
          <div className="flex-1 min-h-0">
            <Suspense fallback={<div className="flex items-center justify-center h-full bg-[#0d1117] text-white/40 text-sm">Loading preview...</div>}>
              <SimPreviewFrame compiledCode={compiledCode} compileError={compileError} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
