import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { Play, Save, Loader2, RotateCcw, Copy, Check, Send, Trash2, GripVertical, FolderOpen, Plus, ChevronDown, Camera, X } from "lucide-react";
import { loader } from "@monaco-editor/react";

// Configure Monaco CDN — use unpkg as fallback if jsdelivr is slow
loader.config({
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
});

const MonacoEditor = lazy(() => import("@monaco-editor/react"));
const SimPreviewFrame = lazy(() => import("./editor/SimPreviewFrame"));
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { SIM_TEMPLATES } from "./editor/SimTemplates";
import { TelemetryPanel } from "./editor/TelemetryPanel";

// Real production templates for AI context
import ArmKgSimRaw from "../sims/ArmKgSim.tsx?raw";
import ElevatorPidSimRaw from "../sims/ElevatorPidSim.tsx?raw";

// Babel standalone for JSX/TSX transpilation
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
  id: string;
  name: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  type?: string;
}

export default function SimulationPlayground() {
  const [files, setFiles] = useState<Record<string, string>>(SIM_TEMPLATES["Blank Canvas"]);
  const [activeFile, setActiveFile] = useState("SimComponent.tsx");
  const [compiledFiles, setCompiledFiles] = useState<Record<string, string>>({});
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [simName, setSimName] = useState("Untitled Simulation");
  const [simId, setSimId] = useState<string | null>(null);
  const [savedSims, setSavedSims] = useState<SavedSim[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isLoadingSims, setIsLoadingSims] = useState(false);
  
  // Telemetry State
  const [telemetry, setTelemetry] = useState<Record<string, {time: number, value: number}[]>>({});
  
  // Visual AI State
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  const compileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

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
          presets: ["env", "react", ["typescript", { isTSX: true, allExtensions: true }]],
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
    if (!isChatLoading) {
      compileCode(files);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simId, files, isChatLoading]);

  // Listen for Telemetry from Iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "ARES_TELEMETRY") {
        setTelemetry(prev => {
          const key = e.data.key;
          const current = prev[key] || [];
          // Keep last 100 points
          const next = [...current, { time: e.data.timestamp, value: e.data.value }].slice(-100);
          return { ...prev, [key]: next };
        });
      }
      if (e.data?.type === "ARES_SCREENSHOT") {
        setAttachedImage(e.data.dataUrl);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Check URL for shared simulation on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("simId");
    if (idParam) {
      handleLoadSim(idParam);
    }
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

  const handleRun = () => {
    setTelemetry({}); // clear telemetry on run
    compileCode(files);
  };

  const handleReset = () => {
    setFiles(SIM_TEMPLATES["Blank Canvas"]);
    setActiveFile("SimComponent.tsx");
    setTelemetry({});
    compileCode(SIM_TEMPLATES["Blank Canvas"]);
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

  const handleLoadSim = async (id: string) => {
    try {
      const res = await fetch(`/api/simulations/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json() as { simulation: { id: string; name: string; files: Record<string, string> | string, type?: string } };
      const sim = data.simulation;
      let parsedFiles: Record<string, string> = {};
      
      if (typeof sim.files === "object") {
         parsedFiles = sim.files as Record<string, string>;
      } else if (typeof sim.files === "string") {
         try {
           parsedFiles = JSON.parse(sim.files);
         } catch {
           parsedFiles = { [sim.id]: sim.files };
         }
      }
      
      if (Object.keys(parsedFiles).length === 0) {
        parsedFiles = { "SimComponent.jsx": "" };
      }
      
      setFiles(parsedFiles);
      setActiveFile(Object.keys(parsedFiles)[0]);
      setSimName(sim.name);
      setSimId(sim.id);
      compileCode(parsedFiles);
      setShowLibrary(false);
      
      // Update URL to match loaded sim
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("simId", sim.id.toString());
      window.history.replaceState({}, "", newUrl.toString());

      const { toast } = await import("sonner");
      toast.success(`Loaded: ${sim.name}`);
    } catch (e) {
      console.error("[SimPlayground] Load failed:", e);
    }
  };

  const handleDeleteSim = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this simulation?")) return;
    try {
      await fetch(`/api/simulations/${id}`, { method: "DELETE" });
      setSavedSims(prev => prev.filter(s => s.id !== id));
      if (simId === id) {
        setSimId(null);
        setSimName("Untitled Simulation");
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("simId");
        window.history.replaceState({}, "", newUrl.toString());
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
- The entrypoint component MUST be a default export (e.g., export default function MySim() {...})
- Use React.useState, React.useEffect, etc. (React is a global, don't import it)
- Use standard ARESWEB UI classes: sim-container, sim-title, sim-label, sim-value, sim-slider, sim-canvas, sim-btn, sim-grid, sim-flex
- Use Vite-style raw typescript format (.tsx).
- When modifying or generating code, output the COMPLETE updated files using markdown code blocks with the EXACT existing filename in the language tag (e.g. \`\`\`tsx:SimComponent.tsx). Do NOT create new filenames unless explicitly requested. Overwrite the existing files!
- Output ONLY the markdown code blocks. No explanations outside of code comments.

EXAMPLES OF REAL ARESWEB SIMULATIONS:

\`\`\`tsx:ArmKgSim.tsx
${ArmKgSimRaw}
\`\`\`

\`\`\`tsx:ElevatorPidSim.tsx
${ElevatorPidSimRaw}
\`\`\`

CURRENT FILES (Overwrite these by matching the filename exactly!):
\`\`\`json
${JSON.stringify(files, null, 2)}
\`\`\`

USER REQUEST: ${msg}`;

      const res = await fetch("/api/ai/liveblocks-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentContext: systemContext, action: "expand", imageUrl: attachedImage }),
      });
      setAttachedImage(null);

      if (!res.ok || !res.body) throw new Error("AI request failed");

      let accumulatedText = "";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      const initialFiles = { ...files };
      let finalFiles: Record<string, string> = {};

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
              if (data.chunk) {
                accumulatedText += data.chunk;
                
                // Live parse markdown blocks
                const blockLines = accumulatedText.split('\n');
                const newFiles: Record<string, string> = {};
                let currentFile: string | null = null;
                let currentContent: string[] = [];
                
                for (let i = 0; i < blockLines.length; i++) {
                  const l = blockLines[i];
                  if (l.startsWith('```')) {
                    if (currentFile) {
                      newFiles[currentFile] = currentContent.join('\n');
                      currentFile = null;
                      currentContent = [];
                    } else {
                      const match = l.match(/```[a-zA-Z]*:(.+)/);
                      if (match && match[1]) {
                        currentFile = match[1].trim();
                      }
                    }
                  } else if (currentFile) {
                    currentContent.push(l);
                  }
                }
                
                if (currentFile) {
                  newFiles[currentFile] = currentContent.join('\n');
                }
                
                if (Object.keys(newFiles).length > 0) {
                  finalFiles = newFiles;
                  setFiles({ ...initialFiles, ...newFiles });
                }
              }
            } catch { /* ignore */ }
          }
        }
      }

      const reply = accumulatedText.trim();
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);

      // Compile code once generation completes
      if (Object.keys(finalFiles).length > 0) {
        const fullFiles = { ...files, ...finalFiles };
        const err = await compileCode(fullFiles);

        // Auto-heal: if compilation fails, send error back to AI for a fix
        if (err) {
          setChatMessages(prev => [...prev, { role: "assistant", content: "⚙️ Compile error detected — auto-fixing..." }]);

          try {
            const fixContext = `You are a z.AI simulation code assistant. The following markdown-fenced code has a compilation error. Fix ONLY the error and return the COMPLETE corrected code using markdown fences with the filename (e.g. \`\`\`jsx:SimComponent.jsx).

ERROR:
${err}

BROKEN CODE:
${reply}`;

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
              const initialFixFiles = { ...fullFiles };
              let finalFixFiles: Record<string, string> = {};

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
                      if (data.chunk) {
                        fixText += data.chunk;
                        
                        // Live parse for auto-fix stream
                        const fBlockLines = fixText.split('\n');
                        const fNewFiles: Record<string, string> = {};
                        let fCurrentFile: string | null = null;
                        let fCurrentContent: string[] = [];
                        
                        for (let i = 0; i < fBlockLines.length; i++) {
                          const l = fBlockLines[i];
                          if (l.startsWith('```')) {
                            if (fCurrentFile) {
                              fNewFiles[fCurrentFile] = fCurrentContent.join('\n');
                              fCurrentFile = null;
                              fCurrentContent = [];
                            } else {
                              const match = l.match(/```[a-zA-Z]*:(.+)/);
                              if (match && match[1]) {
                                fCurrentFile = match[1].trim();
                              }
                            }
                          } else if (fCurrentFile) {
                            fCurrentContent.push(l);
                          }
                        }
                        if (fCurrentFile) {
                          fNewFiles[fCurrentFile] = fCurrentContent.join('\n');
                        }
                        if (Object.keys(fNewFiles).length > 0) {
                          finalFixFiles = fNewFiles;
                          setFiles({ ...initialFixFiles, ...fNewFiles });
                        }
                      }
                    } catch { /* ignore */ }
                  }
                }
              }

              if (Object.keys(finalFixFiles).length > 0) {
                const fixFullFiles = { ...fullFiles, ...finalFixFiles };
                const fixErr = await compileCode(fixFullFiles);
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
        body: JSON.stringify({ name: simName, files: files, ...(simId ? { id: simId } : {}) }),
      });
      if (res.ok) {
        const data = await res.json() as { id?: string };
        if (data.id && !simId) {
          setSimId(data.id);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("simId", data.id.toString());
          window.history.replaceState({}, "", newUrl.toString());
        }
        const { toast } = await import("sonner");
        toast.success("Saved simulation!");
      }
    } catch (e) {
      console.error("[SimPlayground] Save failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
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
                  <span className="text-white/50 text-[10px] uppercase tracking-wider font-bold">GitHub Repository Sims</span>
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

      {/* Layout Split: Top/Bottom */}
      <div className="flex-1 flex flex-col min-h-0">
        <PanelGroup orientation="vertical">
          <Panel defaultSize={50} minSize={20}>
            {/* Top Row: Code & Chat */}
            <PanelGroup orientation="horizontal">
              {/* ── Code Editor Pane ── */}
              <Panel defaultSize={60} minSize={25} className="flex flex-col border-r border-white/5">
                {/* Tabs Header */}
                <div className="flex items-center overflow-x-auto border-b border-white/10 bg-[#1e1e1e] scrollbar-none shrink-0">
                  {Object.keys(files).map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFile(f)}
                      className={`group flex items-center gap-2 px-4 py-2 text-xs font-mono border-r border-white/5 transition-colors min-w-[120px] max-w-[200px] shrink-0 ${activeFile === f ? 'bg-[#1e1e1e] text-ares-gold border-t-2 border-t-ares-gold relative z-10' : 'bg-[#252526] text-white/40 hover:bg-[#2d2d2d] hover:text-white/80 border-t-2 border-t-transparent shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]'}`}
                    >
                      <span className="truncate flex-1 text-left">{f}</span>
                      {f !== 'SimComponent.tsx' && (
                        <button type="button" onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete ${f}?`)) {
                            const nf = { ...files };
                            delete nf[f];
                            setFiles(nf);
                            if (activeFile === f) setActiveFile('SimComponent.tsx');
                          }
                        }} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5 transition-all text-white/40 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const name = prompt("Filename (e.g. Utils.tsx):");
                      if (name && !files[name]) {
                        setFiles(prev => ({ ...prev, [name]: "// new file\n" }));
                        setActiveFile(name);
                      }
                    }}
                    className="px-3 py-2 text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  {isCompiling && <div className="ml-auto pr-3"><Loader2 className="w-3 h-3 animate-spin text-ares-gold" /></div>}
                </div>
                
                <div className="flex-1 flex min-h-0 bg-[#1e1e1e]">
                  {/* Monaco Editor */}
                  <div className="flex-1 min-h-0 min-w-0 relative">
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
              </Panel>

              {/* ── Resize Handle: Code ↔ Chat ── */}
              <PanelResizeHandle className="w-1.5 bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors group">
                <GripVertical className="w-3 h-3 text-white/20 group-hover:text-ares-gold/60" />
              </PanelResizeHandle>

              {/* ── z.AI Chat Pane ── */}
              <Panel minSize={20} className="flex flex-col min-h-0 min-w-0 bg-[#0d0f14]">
                <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between shrink-0">
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
                <div className="p-2 border-t border-white/10 flex flex-col gap-2 shrink-0">
                  {attachedImage && (
                    <div className="relative inline-block w-24 h-24 border border-ares-gold/30 rounded-md overflow-hidden bg-black/50 ml-1">
                      <img src={attachedImage} alt="Context" className="w-full h-full object-contain" />
                      <button onClick={() => setAttachedImage(null)} className="absolute top-1 right-1 bg-black/70 rounded-full p-1 hover:bg-black text-white/80 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const iframe = document.querySelector('iframe');
                        if (iframe && iframe.contentWindow) {
                          iframe.contentWindow.postMessage({ type: 'ARES_REQUEST_SCREENSHOT' }, '*');
                        }
                      }}
                      className="p-2 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-md hover:bg-zinc-700 transition-colors"
                      title="Capture screenshot"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
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
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          {/* ── Resize Handle: Top ↔ Bottom ── */}
          <PanelResizeHandle className="h-1.5 w-full bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors z-20" />

          {/* ── Live Preview Pane ── */}
          <Panel defaultSize={50} minSize={20} className="flex flex-col min-w-0 bg-[#0d1117] z-0">
            <div className="px-3 py-1.5 border-b border-white/10 bg-[#0d1117] flex items-center gap-2 shrink-0">
              <span className="text-white/40 text-xs font-mono">Live Preview</span>
              <div className={`w-2 h-2 rounded-full ${compileError ? 'bg-red-500' : 'bg-emerald-500'}`} />
            </div>
            <div className="flex-1 min-h-0 relative flex flex-col">
              <div className="flex-1 min-h-0">
                <Suspense fallback={<div className="flex items-center justify-center h-full bg-[#0d1117] text-white/40 text-sm">Loading preview...</div>}>
                  <SimPreviewFrame compiledFiles={compiledFiles} compileError={compileError} />
                </Suspense>
              </div>
              <TelemetryPanel data={telemetry} />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
