import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { Play, Save, Loader2, RotateCcw, Copy, Check, Send, Trash2, GripVertical, FolderOpen, Plus, ChevronDown } from "lucide-react";
import { loader } from "@monaco-editor/react";

// Configure Monaco CDN — use unpkg as fallback if jsdelivr is slow
loader.config({
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
});

const MonacoEditor = lazy(() => import("@monaco-editor/react"));
const SimPreviewFrame = lazy(() => import("./editor/SimPreviewFrame"));
import { FileSidebar } from "./editor/FileSidebar";
import { SIM_TEMPLATES } from "./editor/SimTemplates";

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SavedSim {
  id: number;
  name: string;
  author_id: string;
  created_at: string;
  updated_at: string;
}

export default function SimulationPlayground() {
  const [files, setFiles] = useState<Record<string, string>>(SIM_TEMPLATES["Default (Robot Arm)"]);
  const [activeFile, setActiveFile] = useState("SimComponent.jsx");
  const [compiledFiles, setCompiledFiles] = useState<Record<string, string>>({});
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [simName, setSimName] = useState("Untitled Simulation");
  const [simId, setSimId] = useState<number | null>(null);
  const [savedSims, setSavedSims] = useState<SavedSim[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isLoadingSims, setIsLoadingSims] = useState(false);
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
  const compileCode = useCallback(async (sourceFiles: Record<string, string>): Promise<string | null> => {
    setIsCompiling(true);
    setCompileError(null);
    try {
      const babel = await loadBabel();
      const compiled: Record<string, string> = {};
      for (const [filename, content] of Object.entries(sourceFiles)) {
        const result = babel.transform(content, {
          presets: ["env", "react"],
          filename: filename,
        });
        compiled[filename] = result.code || "";
      }
      setCompiledFiles(compiled);
      return null;
    } catch (e) {
      const errMsg = (e as Error).message;
      setCompileError(errMsg);
      return errMsg;
    } finally {
      setIsCompiling(false);
    }
  }, []);

  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || "";
    setFiles(prev => {
      const newFiles = { ...prev, [activeFile]: newCode };
      if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
      compileTimeoutRef.current = setTimeout(() => compileCode(newFiles), 800);
      return newFiles;
    });
  }, [activeFile, compileCode]);

  useEffect(() => {
    compileCode(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = useCallback(async (editor: any, monaco: any) => {
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
    });

    try {
      // Load ARESLib types
      const aresRes = await fetch("/types/areslib.d.ts");
      if (aresRes.ok) {
        monaco.languages.typescript.javascriptDefaults.addExtraLib(
          await aresRes.text(),
          "file:///node_modules/@types/areslib/index.d.ts"
        );
      }

      // Load minimal React types to prevent dependency errors with full @types/react
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        `declare module "react" {
          export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
          export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          export function useRef<T>(initialValue: T): { current: T };
          export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          export function useMemo<T>(factory: () => T, deps: any[]): T;
        }
        declare namespace React {
          export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
          export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          export function useRef<T>(initialValue: T): { current: T };
          export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          export function useMemo<T>(factory: () => T, deps: any[]): T;
        }`,
        "file:///node_modules/@types/react/index.d.ts"
      );

    } catch (e) {
      console.error("[SimPlayground] Failed to load intellisense types:", e);
    }
  }, []);

  const handleRun = () => compileCode(files);

  const handleReset = () => {
    setFiles(SIM_TEMPLATES["Default (Robot Arm)"]);
    setActiveFile("SimComponent.jsx");
    compileCode(SIM_TEMPLATES["Default (Robot Arm)"]);
    setSimId(null);
    setSimName("Untitled Simulation");
  };

  // ── Library ──
  const fetchSavedSims = async () => {
    setIsLoadingSims(true);
    try {
      const res = await fetch("/api/simulations");
      if (res.ok) {
        const data = await res.json() as { simulations?: SavedSim[] };
        setSavedSims(data.simulations || []);
      }
    } catch (e) {
      console.error("[SimPlayground] Failed to fetch sims:", e);
    } finally {
      setIsLoadingSims(false);
    }
  };

  const handleLoadSim = async (id: number) => {
    try {
      const res = await fetch(`/api/simulations/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json() as { simulation: { id: number; name: string; code: string } };
      const sim = data.simulation;
      let parsedFiles: Record<string, string> = { "SimComponent.jsx": sim.code };
      try {
        const parsed = JSON.parse(sim.code);
        if (parsed && typeof parsed === "object" && parsed["SimComponent.jsx"]) {
          parsedFiles = parsed;
        }
      } catch { /* legacy single file */ }
      
      setFiles(parsedFiles);
      setActiveFile("SimComponent.jsx");
      setSimName(sim.name);
      setSimId(sim.id);
      compileCode(parsedFiles);
      setShowLibrary(false);
      const { toast } = await import("sonner");
      toast.success(`Loaded: ${sim.name}`);
    } catch (e) {
      console.error("[SimPlayground] Load failed:", e);
    }
  };

  const handleDeleteSim = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this simulation?")) return;
    try {
      await fetch(`/api/simulations/${id}`, { method: "DELETE" });
      setSavedSims(prev => prev.filter(s => s.id !== id));
      if (simId === id) {
        setSimId(null);
        setSimName("Untitled Simulation");
      }
    } catch (e) {
      console.error("[SimPlayground] Delete failed:", e);
    }
  };

  const handleToggleLibrary = () => {
    if (!showLibrary) fetchSavedSims();
    setShowLibrary(prev => !prev);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(files, null, 2));
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
- The component MUST be named SimComponent (not exported, just function SimComponent in SimComponent.jsx)
- Use React.useState, React.useEffect, etc. (React is a global, don't import it)
- Available CSS classes: sim-container, sim-title, sim-label, sim-value, sim-slider, sim-canvas, sim-btn, sim-grid, sim-flex
- Output ONLY a JSON object mapping filenames to their file content string. No markdown fences, no explanations outside of code comments.
- When modifying code, output the COMPLETE updated files object, not a diff.

CURRENT FILES:
\`\`\`json
${JSON.stringify(files, null, 2)}
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
              if (data.chunk) accumulatedText += data.chunk;
            } catch { /* ignore */ }
          }
        }
      }

      const reply = accumulatedText.trim();
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);

      // Auto-apply code if the reply looks like JSON
      if (reply.includes("{") && reply.includes("SimComponent.jsx")) {
        let cleaned = reply;
        // Strip markdown fences
        if (cleaned.includes("```")) {
          cleaned = cleaned
            .split("\n")
            .filter(line => !line.trim().startsWith("```"))
            .join("\n");
        }
        cleaned = cleaned.trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed && typeof parsed === "object" && parsed["SimComponent.jsx"]) {
            setFiles(parsed);
            const err = await compileCode(parsed);

            // Auto-heal: if compilation fails, send error back to AI for a fix
            if (err) {
              setChatMessages(prev => [...prev, { role: "assistant", content: "⚙️ Compile error detected — auto-fixing..." }]);

              try {
                const fixContext = `You are a z.AI simulation code assistant. The following JSON payload of files has a compilation error. Fix ONLY the error and return the COMPLETE corrected JSON. Output ONLY JSON, no markdown fences.

ERROR:
${err}

BROKEN FILES:
${cleaned}`;

                const fixRes = await fetch("/api/ai/liveblocks-copilot", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ documentContext: fixContext, action: "expand" }),
                });

                if (fixRes.ok && fixRes.body) {
                  let fixText = "";
                  const fixReader = fixRes.body.getReader();
                  const fixDecoder = new TextDecoder();
                  let fixBuffer = "";

                  while (true) {
                    const { done, value } = await fixReader.read();
                    if (done) break;
                    fixBuffer += fixDecoder.decode(value, { stream: true });
                    const fixLines = fixBuffer.split("\n");
                    fixBuffer = fixLines.pop() || "";
                    for (const line of fixLines) {
                      if (line.startsWith("data: ")) {
                        try {
                          const data = JSON.parse(line.slice(6));
                          if (data.chunk) fixText += data.chunk;
                        } catch { /* ignore */ }
                      }
                    }
                  }

                  let fixedCode = fixText.trim();
                  if (fixedCode.includes("```")) {
                    fixedCode = fixedCode.split("\n").filter(l => !l.trim().startsWith("```")).join("\n").trim();
                  }

                  const fixParsed = JSON.parse(fixedCode);
                  if (fixParsed && typeof fixParsed === "object" && fixParsed["SimComponent.jsx"]) {
                    setFiles(fixParsed);
                    const fixErr = await compileCode(fixParsed);
                    if (fixErr) {
                      setChatMessages(prev => [...prev, { role: "assistant", content: `⚠️ Auto-fix failed: ${fixErr}\nPlease fix the code manually or describe the issue.` }]);
                    } else {
                      setChatMessages(prev => [...prev, { role: "assistant", content: "✅ Code fixed and applied!" }]);
                    }
                  }
                }
              } catch {
                // Auto-heal failed silently
              }
            }
          }
        } catch {
           // not valid JSON
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
      const codeToSave = JSON.stringify(files);
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: simName, code: codeToSave, ...(simId ? { id: simId } : {}) }),
      });
      if (res.ok) {
        const data = await res.json() as { id?: number };
        if (data.id && !simId) setSimId(data.id);
        const { toast } = await import("sonner");
        toast.success(simId ? "Simulation updated!" : "Simulation saved!");
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
          {simId && <span className="text-white/20 text-[10px] font-mono">#{simId}</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* Library dropdown */}
          <div className="relative">
            <button onClick={handleToggleLibrary} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-indigo-600/30 transition-colors">
              <FolderOpen className="w-3.5 h-3.5" />
              Open
              <ChevronDown className={`w-3 h-3 transition-transform ${showLibrary ? 'rotate-180' : ''}`} />
            </button>
            {showLibrary && (
              <div className="absolute top-full right-0 mt-1 w-72 bg-[#161b22] border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-white/10 flex items-center justify-between">
                  <span className="text-white/50 text-[10px] uppercase tracking-wider font-bold">Saved Simulations</span>
                  <button onClick={handleReset} className="text-emerald-400 hover:text-emerald-300 text-[10px] uppercase tracking-wider font-bold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>
                {isLoadingSims ? (
                  <div className="p-4 text-center text-white/30 text-xs"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                ) : savedSims.length === 0 ? (
                  <div className="p-4 text-center text-white/30 text-xs">No saved simulations yet</div>
                ) : (
                  savedSims.map(sim => (
                    <button
                      key={sim.id}
                      onClick={() => handleLoadSim(sim.id)}
                      className={`w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between group transition-colors border-0 bg-transparent ${simId === sim.id ? 'bg-ares-gold/10 border-l-2 border-l-ares-gold' : ''}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-sm truncate ${simId === sim.id ? 'text-ares-gold' : 'text-white/80'}`}>{sim.name}</div>
                        <div className="text-[10px] text-white/30">{new Date(sim.updated_at || sim.created_at).toLocaleDateString()}</div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSim(sim.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all border-0 bg-transparent"
                        aria-label={`Delete ${sim.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="relative group/templates">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/80 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors">
              Templates
              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </button>
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl opacity-0 invisible group-hover/templates:opacity-100 group-hover/templates:visible transition-all z-50">
              {Object.keys(SIM_TEMPLATES).map(templateName => (
                <button
                  key={templateName}
                  onClick={() => {
                    if (confirm(`Load template "${templateName}"? This will overwrite your current files.`)) {
                      setFiles(SIM_TEMPLATES[templateName]);
                      compileCode(SIM_TEMPLATES[templateName]);
                      setActiveFile('SimComponent.jsx');
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                >
                  {templateName}
                </button>
              ))}
            </div>
          </div>

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
            {simId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {/* 3-Pane Split */}
      <div ref={containerRef} className="flex-1 flex min-h-0">
        {/* ── Code Editor & Files Pane ── */}
        <div style={{ width: `${codePaneWidth}%` }} className="flex flex-col min-h-0 min-w-0 border-r border-white/5">
          <div className="px-3 py-1.5 border-b border-white/10 bg-[#1e1e1e] flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <span className="text-white/40 text-xs font-mono">{activeFile}</span>
              {isCompiling && <Loader2 className="w-3 h-3 animate-spin text-ares-gold" />}
            </div>
          </div>
          <div className="flex-1 flex min-h-0">
            {/* File Explorer Sidebar */}
            <FileSidebar
              files={files}
              activeFile={activeFile}
              onActiveFileChange={setActiveFile}
              onFilesChange={setFiles}
              onCompile={compileCode}
            />
            
            {/* Monaco Editor */}
            <div className="flex-1 min-h-0 min-w-0 relative bg-[#1e1e1e]">
              <Suspense fallback={<textarea className="w-full h-full bg-[#1e1e1e] text-white/80 text-sm font-mono p-4 resize-none border-0 outline-none" value={files[activeFile] || ''} readOnly placeholder="Loading code editor..." />}>
                <MonacoEditor
                  height="100%"
                  language="javascript"
                  theme="vs-dark"
                  path={`file:///${activeFile}`}
                  value={files[activeFile] || ''}
                  onChange={handleCodeChange}
                  onMount={handleEditorDidMount}
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
              <SimPreviewFrame compiledFiles={compiledFiles} compileError={compileError} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
