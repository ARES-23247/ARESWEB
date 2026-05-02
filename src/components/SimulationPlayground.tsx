import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { Play, Save, Loader2, RotateCcw, Copy, Check, Send, Trash2, GripVertical, FolderOpen, Plus, ChevronDown, Camera, X, Maximize, Minimize } from "lucide-react";
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
import { SimFileExplorer } from "./editor/SimFileExplorer";
import { SimConsole, LogEntry } from "./editor/SimConsole";
import JSZip from "jszip";
import prettier from "prettier/standalone";
import prettierPluginEstree from "prettier/plugins/estree";
import prettierPluginBabel from "prettier/plugins/babel";
import prettierPluginTs from "prettier/plugins/typescript";

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

const DEFAULT_MESSAGE: ChatMessage = { role: "assistant", content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you." };

interface SavedSim {
  id: string;
  name: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  type?: string;
}

interface GithubSim {
  id: string;
  name: string;
  path: string;
  requiresContext: boolean;
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
  
  const [githubSims, setGithubSims] = useState<GithubSim[]>([]);
  const [isLoadingGithubSims, setIsLoadingGithubSims] = useState(false);
  
  // Telemetry State
  const [telemetry, setTelemetry] = useState<Record<string, {time: number, value: number}[]>>({});

  // Layout State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [isVimMode, setIsVimMode] = useState(false);
  const [isWordWrap, setIsWordWrap] = useState(true);
  const [isMinimap, setIsMinimap] = useState(false);
  
  // Visual AI State
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  // Editor Refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vimRef = useRef<any>(null);

  const compileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const idParam = new URLSearchParams(window.location.search).get("simId");
      const stored = localStorage.getItem(`sim_chat_${idParam || 'new'}`);
      if (stored) return JSON.parse(stored);
    } catch (e) { console.error(e); }
    return [DEFAULT_MESSAGE];
  });
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Persist chat to local storage
  useEffect(() => {
    localStorage.setItem(`sim_chat_${simId || 'new'}`, JSON.stringify(chatMessages));
  }, [chatMessages, simId]);

  // ── Compile logic ──
  const compileCode = useCallback(async (sourceFiles: Record<string, string>): Promise<string | null> => {
    setIsCompiling(true);
    setCompileError(null);
    try {
      const babel = await loadBabel();
      const compiled: Record<string, string> = {};
      for (const [filename, content] of Object.entries(sourceFiles)) {
        if (filename.match(/\.(tsx?|jsx?)$/)) {
          const result = babel.transform(content, {
            presets: ["env", "react", ["typescript", { isTSX: true, allExtensions: true }]],
            filename: filename,
          });
          compiled[filename] = result.code || "";
        } else {
          compiled[filename] = content;
        }
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
      if (e.data?.type === "sim-console") {
        setConsoleLogs(prev => [...prev, e.data]);
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
    
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Ghost text provider (Manual trigger: user types, but we only show if requested, or just provide it but require Ctrl+Space to trigger)
    monaco.languages.registerInlineCompletionsProvider('javascript', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideInlineCompletions: async (model: any, position: any, context: any, _token: any) => {
        // Only trigger if explicitly requested by user (e.g. context.triggerKind === 1 for explicit invoke like Ctrl+Space)
        if (context.triggerKind !== monaco.languages.InlineCompletionTriggerKind.Explicit) {
          return { items: [] };
        }
        
        const code = model.getValue();
        const offset = model.getOffsetAt(position);
        
        try {
          // Quick fetch to AI
          const res = await fetch("/api/ai/sim-playground", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              systemPrompt: "You are an inline code completion engine. Only output the code that follows the cursor. DO NOT include markdown blocks. Only return the direct text to insert.",
              messages: [
                { role: "user", content: `Code so far:\n${code.slice(0, offset)}\n\nComplete the next lines:` }
              ]
            }),
          });
          
          if (!res.ok) return { items: [] };
          // For simplicity in streaming we just read it all
          let text = "";
          const reader = res.body?.getReader();
          if (reader) {
             while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try { text += JSON.parse(line.slice(6)).chunk; } catch { /* ignore */ }
                  }
                }
             }
          }
          
          return {
            items: [{
              insertText: text.replace(/^```[a-z]*\\n/, '').replace(/\\n```$/, ''),
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
            }]
          };
        } catch {
          return { items: [] };
        }
      },
      freeInlineCompletions: () => {}
    });
  }, []);

  // Vim Mode Effect
  useEffect(() => {
    if (isVimMode && editorRef.current) {
      import('monaco-vim').then((vim) => {
        vimRef.current = vim.initVimMode(editorRef.current, document.createElement('div'));
      });
    } else {
      if (vimRef.current) {
        vimRef.current.dispose();
        vimRef.current = null;
      }
    }
  }, [isVimMode]);

  // Live Error Squiggles Effect
  useEffect(() => {
    if (monacoRef.current && editorRef.current && compileError) {
      // Try to parse babel error line/col
      // Example: SyntaxError: Unexpected token (10:15)
      const match = compileError.match(/\\(([0-9]+):([0-9]+)\\)/);
      if (match) {
        const line = parseInt(match[1], 10);
        const col = parseInt(match[2], 10);
        const model = editorRef.current.getModel();
        monacoRef.current.editor.setModelMarkers(model, "babel", [{
          startLineNumber: line,
          startColumn: col,
          endLineNumber: line,
          endColumn: col + 1,
          message: compileError,
          severity: monacoRef.current.MarkerSeverity.Error
        }]);
      }
    } else if (monacoRef.current && editorRef.current) {
      monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), "babel", []);
    }
  }, [compileError]);

  const handleRun = () => {
    setTelemetry({}); // clear telemetry on run
    setConsoleLogs([]); // clear logs on run
    compileCode(files);
  };

  const handleReset = () => {
    setFiles(SIM_TEMPLATES["Blank Canvas"]);
    setActiveFile("SimComponent.tsx");
    setTelemetry({});
    setConsoleLogs([]);
    compileCode(SIM_TEMPLATES["Blank Canvas"]);
    setSimId(null);
    setSimName("Untitled Simulation");
    
    const storedChat = localStorage.getItem('sim_chat_new');
    if (storedChat) {
      try { setChatMessages(JSON.parse(storedChat)); } catch { setChatMessages([DEFAULT_MESSAGE]); }
    } else {
      setChatMessages([DEFAULT_MESSAGE]);
    }
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

  const fetchGithubSims = async () => {
    setIsLoadingGithubSims(true);
    try {
      const res = await fetch("https://raw.githubusercontent.com/ARES-23247/ARESWEB/main/src/sims/simRegistry.json");
      if (res.ok) {
        const data = await res.json() as { simulators: GithubSim[] };
        setGithubSims(data.simulators || []);
      }
    } catch (e) {
      console.error("[SimPlayground] Failed to fetch github sims:", e);
    } finally {
      setIsLoadingGithubSims(false);
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
      
      const storedChat = localStorage.getItem(`sim_chat_${sim.id}`);
      if (storedChat) {
        try { setChatMessages(JSON.parse(storedChat)); } catch { setChatMessages([DEFAULT_MESSAGE]); }
      } else {
        setChatMessages([DEFAULT_MESSAGE]);
      }
      
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

  const handleLoadGithubSim = async (sim: GithubSim) => {
    try {
      const filename = sim.path.replace('./', '') + '.tsx';
      const res = await fetch(`https://raw.githubusercontent.com/ARES-23247/ARESWEB/main/src/sims/${filename}`);
      if (!res.ok) throw new Error("Not found");
      const code = await res.text();
      
      const parsedFiles = { [filename]: code };
      
      setFiles(parsedFiles);
      setActiveFile(filename);
      setSimName(sim.name);
      setSimId(`github:${sim.id}`);
      compileCode(parsedFiles);
      setShowLibrary(false);
      
      const storedChat = localStorage.getItem(`sim_chat_github:${sim.id}`);
      if (storedChat) {
        try { setChatMessages(JSON.parse(storedChat)); } catch { setChatMessages([DEFAULT_MESSAGE]); }
      } else {
        setChatMessages([DEFAULT_MESSAGE]);
      }
      
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("simId", `github:${sim.id}`);
      window.history.replaceState({}, "", newUrl.toString());

      const { toast } = await import("sonner");
      toast.success(`Loaded Official Sim: ${sim.name}`);
    } catch (e) {
      console.error("[SimPlayground] GitHub Load failed:", e);
      const { toast } = await import("sonner");
      toast.error(`Failed to load ${sim.name} from GitHub`);
    }
  };

  const _handleDeleteSim = async (id: string, e: React.MouseEvent) => {
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
    if (!showLibrary) {
      fetchSavedSims();
      fetchGithubSims();
    }
    setShowLibrary(prev => !prev);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(files, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormatCode = async () => {
    try {
      const code = files[activeFile];
      if (!code) return;
      const formatted = await prettier.format(code, {
        parser: "typescript",
        plugins: [prettierPluginBabel, prettierPluginEstree, prettierPluginTs],
        tabWidth: 2,
        printWidth: 100,
        semi: true,
      });
      setFiles(prev => ({ ...prev, [activeFile]: formatted }));
      const { toast } = await import("sonner");
      toast.success("Code formatted");
    } catch (e) {
      console.error(e);
      const { toast } = await import("sonner");
      toast.error("Format failed");
    }
  };

  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${simName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'simulation'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
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
- You MUST put EVERYTHING (all components, logic, and styling) into a SINGLE .tsx file. NEVER generate multiple files.
- The entrypoint component MUST be a default export (e.g., export default function MySim() {...})
- Use React.useState, React.useEffect, etc. (React is a global, don't import it)
- Use standard ARESWEB UI classes: sim-container, sim-title, sim-label, sim-value, sim-slider, sim-canvas, sim-btn, sim-grid, sim-flex
- Use Vite-style raw typescript format (.tsx).

OUTPUT FORMAT:
- You can either output the COMPLETE updated file or use a PATCH block to edit specific parts efficiently.
- To output the COMPLETE file (e.g. for initial creation or major rewrites), use: \`\`\`tsx
- To surgically edit an existing file, use: \`\`\`patch
  Inside the patch block, use this EXACT format:
<<<<
old code to find (must match exactly)
====
new code to replace it with
>>>>

EXAMPLES OF REAL ARESWEB SIMULATIONS:

\`\`\`tsx:ArmKgSim.tsx
${ArmKgSimRaw}
\`\`\`

\`\`\`tsx:ElevatorPidSim.tsx
${ElevatorPidSimRaw}
\`\`\`

CURRENT FILES:
\`\`\`json
${JSON.stringify(files, null, 2)}
\`\`\`

USER REQUEST: ${msg}`;

      const apiMessages = chatMessages.map(m => ({ role: m.role, content: m.content }));
      apiMessages.push({ role: "user", content: msg });

      // Normalize for Anthropic: must start with user, must alternate roles
      const normalizedMessages: {role: "user"|"assistant", content: string}[] = [];
      for (const m of apiMessages) {
        if (normalizedMessages.length === 0 && m.role === "assistant") {
          continue; // Skip leading assistant messages
        }
        if (normalizedMessages.length > 0 && normalizedMessages[normalizedMessages.length - 1].role === m.role) {
          normalizedMessages[normalizedMessages.length - 1].content += "\n\n" + m.content;
        } else {
          normalizedMessages.push({ ...m });
        }
      }

      const res = await fetch("/api/ai/sim-playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: systemContext, messages: normalizedMessages, imageUrl: attachedImage }),
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
                let isPatchBlock = false;
                
                for (let i = 0; i < blockLines.length; i++) {
                  const l = blockLines[i];
                  if (l.startsWith('```')) {
                    if (currentFile) {
                      if (isPatchBlock) {
                        const patchStr = currentContent.join('\n');
                        const originalCode = initialFiles[currentFile] || "";
                        
                        let patchedCode = originalCode;
                        // Extract all completed <<<< ==== >>>> blocks
                        const patchRegex = /<<<<\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>/g;
                        let match;
                        while ((match = patchRegex.exec(patchStr)) !== null) {
                          const oldText = match[1];
                          const newText = match[2];
                          if (patchedCode.includes(oldText)) {
                            patchedCode = patchedCode.replace(oldText, newText);
                          }
                        }
                        newFiles[currentFile] = patchedCode;
                      } else {
                        newFiles[currentFile] = currentContent.join('\n');
                      }
                      currentFile = null;
                      currentContent = [];
                      isPatchBlock = false;
                    } else {
                      const match = l.match(/```(tsx|patch)[^\n]*/);
                      if (match) {
                        currentFile = activeFile;
                        isPatchBlock = match[1] === "patch";
                      }
                    }
                  } else if (currentFile) {
                    currentContent.push(l);
                  }
                }
                
                if (currentFile) {
                  if (isPatchBlock) {
                    const patchStr = currentContent.join('\n');
                    const originalCode = initialFiles[currentFile] || "";
                    let patchedCode = originalCode;
                    const patchRegex = /<<<<\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>/g;
                    let match;
                    while ((match = patchRegex.exec(patchStr)) !== null) {
                      const oldText = match[1];
                      const newText = match[2];
                      if (patchedCode.includes(oldText)) {
                        patchedCode = patchedCode.replace(oldText, newText);
                      }
                    }
                    newFiles[currentFile] = patchedCode;
                  } else {
                    newFiles[currentFile] = currentContent.join('\n');
                  }
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

        if (err) {
          setChatMessages(prev => [...prev, { role: "assistant", content: `⚠️ Compilation Error:\n\`\`\`text\n${err}\n\`\`\`\n\nThe code is in the editor. You can fix it manually or ask me to correct it.` }]);
        } else {
          setChatMessages(prev => [...prev, { role: "assistant", content: "✅ Code generated and compiled successfully!" }]);
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

  const content = (
    <div className={isFullscreen ? "fixed inset-0 z-[100] bg-obsidian flex flex-col p-4 md:p-6 overflow-hidden w-full h-full" : "flex flex-col h-[calc(100vh-80px)]"}>
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
                  <span className="text-white/50 text-[10px] uppercase tracking-wider font-bold">My Saved Sims</span>
                  <button onClick={handleReset} className="text-emerald-400 hover:text-emerald-300 text-[10px] uppercase tracking-wider font-bold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>
                {isLoadingSims ? (
                  <div className="p-4 text-center text-white/30 text-xs"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                ) : savedSims.length === 0 ? (
                  <div className="p-4 text-center text-white/30 text-xs">No saved simulations yet</div>
                ) : (
                  <>
                    {savedSims.map(sim => (
                      <button
                        key={sim.id}
                        onClick={() => handleLoadSim(sim.id)}
                        className={`w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between group transition-colors border-0 bg-transparent ${simId === sim.id ? 'bg-ares-gold/10 border-l-2 border-l-ares-gold' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className={`text-sm truncate ${simId === sim.id ? 'text-ares-gold' : 'text-white/80'}`}>{sim.name}</div>
                          <div className="text-[10px] text-white/30">{new Date(sim.updated_at || sim.created_at).toLocaleDateString()}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                
                <div className="p-2 border-y border-white/10 flex items-center justify-between mt-2 bg-black/20">
                  <span className="text-white/50 text-[10px] uppercase tracking-wider font-bold">Official GitHub Sims</span>
                </div>
                {isLoadingGithubSims ? (
                  <div className="p-4 text-center text-white/30 text-xs"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                ) : githubSims.length === 0 ? (
                  <div className="p-4 text-center text-white/30 text-xs">Failed to load from GitHub</div>
                ) : (
                  <>
                    {githubSims.map(sim => (
                      <button
                        key={sim.id}
                        onClick={() => handleLoadGithubSim(sim)}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between group transition-colors border-0 bg-transparent"
                      >
                        <div className="min-w-0">
                          <div className="text-sm truncate text-white/80 group-hover:text-white transition-colors flex items-center gap-2">
                            {sim.name}
                          </div>
                          <div className="text-[10px] text-white/30 font-mono mt-0.5">{sim.path}.tsx</div>
                        </div>
                      </button>
                    ))}
                  </>
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
                      setActiveFile(Object.keys(SIM_TEMPLATES[templateName])[0]);
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                >
                  {templateName}
                </button>
              ))}
            </div>
          </div>
          
          <button onClick={handleFormatCode} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/80 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors">
            Format
          </button>
          <button onClick={handleDownloadZip} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/80 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors">
            ZIP
          </button>

          <div className="relative group/settings">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/80 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors">
              Editor
              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </button>
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl opacity-0 invisible group-hover/settings:opacity-100 group-hover/settings:visible transition-all z-50 p-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer hover:text-white">
                <input type="checkbox" checked={isVimMode} onChange={e => setIsVimMode(e.target.checked)} className="accent-ares-gold" />
                Vim Mode
              </label>
              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer hover:text-white">
                <input type="checkbox" checked={isWordWrap} onChange={e => setIsWordWrap(e.target.checked)} className="accent-ares-gold" />
                Word Wrap
              </label>
              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer hover:text-white">
                <input type="checkbox" checked={isMinimap} onChange={e => setIsMinimap(e.target.checked)} className="accent-ares-gold" />
                Minimap
              </label>
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
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/80 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors ml-2">
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Layout Split: Top/Bottom */}
      <div className="flex-1 flex flex-col min-h-0">
        <PanelGroup orientation="vertical">
          <Panel defaultSize={60} minSize={20}>
            {/* Top Row: Explorer, Code, Chat */}
            <PanelGroup orientation="horizontal">
              {/* ── File Explorer Pane ── */}
              <Panel defaultSize={15} minSize={10} className="flex flex-col min-w-0">
                <SimFileExplorer files={files} activeFile={activeFile} setActiveFile={setActiveFile} setFiles={setFiles} />
              </Panel>

              <PanelResizeHandle className="w-1.5 bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors group">
                <GripVertical className="w-3 h-3 text-white/20 group-hover:text-ares-gold/60" />
              </PanelResizeHandle>

              {/* ── Code Editor Pane ── */}
              <Panel defaultSize={60} minSize={25} className="flex flex-col min-w-0">
                {/* Tabs Header */}
                <div className="flex items-center overflow-x-auto border-b border-white/10 bg-[#1e1e1e] scrollbar-none shrink-0">
                  {Object.keys(files).map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFile(f)}
                      onDoubleClick={() => {
                        const newName = prompt(`Rename ${f} to:`, f);
                        if (newName && newName !== f && !files[newName]) {
                          const nf = { ...files };
                          nf[newName] = nf[f];
                          delete nf[f];
                          setFiles(nf);
                          if (activeFile === f) setActiveFile(newName);
                        }
                      }}
                      className={`group flex items-center gap-2 px-4 py-2 text-xs font-mono border-r border-white/5 transition-colors min-w-[120px] max-w-[200px] shrink-0 ${activeFile === f ? 'bg-[#1e1e1e] text-ares-gold border-t-2 border-t-ares-gold relative z-10' : 'bg-[#252526] text-white/40 hover:bg-[#2d2d2d] hover:text-white/80 border-t-2 border-t-transparent shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]'}`}
                    >
                      <span className="truncate flex-1 text-left" title="Double-click to rename">{f}</span>
                      {Object.keys(files).length > 1 && (
                        <button type="button" onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete ${f}?`)) {
                            const nf = { ...files };
                            delete nf[f];
                            setFiles(nf);
                            if (activeFile === f) setActiveFile(Object.keys(nf)[0]);
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
                          minimap: { enabled: isMinimap },
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          padding: { top: 12 },
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                          wordWrap: isWordWrap ? "on" : "off",
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
              <Panel defaultSize={25} minSize={20} className="flex flex-col min-h-0 min-w-0 bg-[#0d0f14]">
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

          {/* ── Bottom Row: Preview & Console ── */}
          <Panel defaultSize={40} minSize={20} className="flex flex-col min-w-0 z-0">
            <PanelGroup orientation="horizontal">
              <Panel defaultSize={60} minSize={20} className="flex flex-col min-w-0 bg-[#0d1117]">
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

              <PanelResizeHandle className="w-1.5 bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors group">
                <GripVertical className="w-3 h-3 text-white/20 group-hover:text-ares-gold/60" />
              </PanelResizeHandle>

              <Panel defaultSize={40} minSize={20} className="flex flex-col min-w-0 bg-[#0d0f14]">
                <SimConsole logs={consoleLogs} onClear={() => setConsoleLogs([])} />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );

  return isFullscreen ? createPortal(content, document.body) : content;
}
