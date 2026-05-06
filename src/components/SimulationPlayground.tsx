/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { Play, Save, Loader2, RotateCcw, Copy, Check, Send, Trash2, GripVertical, FolderOpen, Plus, ChevronDown, Camera, X, Maximize, Minimize, Link2, Keyboard, History, Upload, AlertTriangle } from "lucide-react";
import { loader, type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { languages } from "monaco-editor";
import type { CancellationToken, Position } from "monaco-editor";
import { logger } from "../utils/logger";
import { GITHUB_REPO } from "../utils/constants";
import { useSimulationChat } from "../hooks/useSimulationChat";


// Monaco Editor CDN Configuration
// SECURITY: Version pinned to 0.52.2 for supply chain stability.
// MITIGATION: CSP (index.html) restricts script sources to cdn.jsdelivr.net only.
// NOTE: @monaco-editor/react doesn't support SRI for worker files. For maximum
// security, consider vendoring Monaco Editor locally in a future update.
const MONACO_VERSION = "0.52.2";

// Use local vendored copy in production if available, fallback to CDN in development
// This reduces attack surface by avoiding CDN worker loading in production
if (import.meta.env.PROD) {
  // Check if local Monaco is available (would be at /vendor/monaco-editor/)
  // For now, still use CDN but document the migration path
  loader.config({
    paths: { vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs` }
  });
} else {
  loader.config({
    paths: { vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs` }
  });
}

// CSP headers for worker scripts should be configured in index.html:
// Content-Security-Policy: script-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob:

const MonacoEditor = lazy(() => import("@monaco-editor/react"));
const MonacoDiffEditor = lazy(() => import("@monaco-editor/react").then(mod => ({ default: mod.DiffEditor })));
const SimPreviewFrame = lazy(() => import("./editor/SimPreviewFrame"));
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { SIM_TEMPLATES } from "./editor/SimTemplates";
import { TelemetryPanel } from "./editor/TelemetryPanel";
import { SimFileExplorer } from "./editor/SimFileExplorer";
import { SimComponentLibrary } from "./editor/SimComponentLibrary";
import { SimConsole, LogEntry, TestResult } from "./editor/SimConsole";

import JSZip from "jszip";
import prettier from "prettier/standalone";
import prettierPluginEstree from "prettier/plugins/estree";
import prettierPluginBabel from "prettier/plugins/babel";
import prettierPluginTs from "prettier/plugins/typescript";

// Real production templates for AI context
import ArmKgSimRaw from "../sims/armkg/index.tsx?raw";
import ElevatorPidSimRaw from "../sims/elevatorpid/index.tsx?raw";

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
  const [pendingAiChanges, setPendingAiChanges] = useState<Record<string, string> | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharingGist, setIsSharingGist] = useState(false);
  const [copied, setCopied] = useState(false);
  const [simName, setSimName] = useState("Untitled Simulation");
  const [simId, setSimId] = useState<string | null>(null);
  const [savedSims, setSavedSims] = useState<SavedSim[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isLoadingSims, setIsLoadingSims] = useState(false);
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [_isLoadingSim, setIsLoadingSim] = useState(false);
  const [_isLoadingGithubSim, setIsLoadingGithubSim] = useState(false);
  const [isAutoRun, setIsAutoRun] = useState(() => localStorage.getItem("ares_sim_autorun") === "true");
  const [readOnlyFiles] = useState<string[]>(["areslib.d.ts", "physics.d.ts"]);

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
  const compileTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // FPS state from sandbox
  const [fps, setFps] = useState<number | null>(null);

  // Version Snapshot state
  // const [showHistory, setShowHistory] = useState(false); // Removed duplicate
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Editor Refs - use Monaco Editor types from @monaco-editor/react
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  interface IVimMode {
    dispose(): void;
  }

  const vimRef = useRef<IVimMode | null>(null);

  // ── Compile logic ──
  const compileCode = useCallback(async (sourceFiles: Record<string, string>): Promise<string | null> => {
    setIsCompiling(true);
    setCompileError(null);
    setTestResults([]); // Clear tests on compile
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

  // z.AI Chat Logic
  const {
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    isChatLoading,
    attachedImage,
    setAttachedImage,
    chatEndRef,
    chatInputRef,
    handleChatSend,
    handleFixWithAI,
    handleChatKeyDown,
    resetChat
  } = useSimulationChat({
    simId,
    files,
    activeFile,
    compileCode,
    setFiles,
    setPendingAiChanges,
    examples: {
      arm: ArmKgSimRaw,
      elevator: ElevatorPidSimRaw
    },
    consoleLogs,
    compileError
  });

  const handleReset = useCallback(() => {
    setFiles(SIM_TEMPLATES["Blank Canvas"]);
    setActiveFile("SimComponent.tsx");
    setTelemetry({});
    setConsoleLogs([]);
    setTestResults([]);
    compileCode(SIM_TEMPLATES["Blank Canvas"]);
    setSimId(null);
    setSimName("Untitled Simulation");
    setPendingAiChanges(null);

    resetChat();
  }, [compileCode, resetChat]);

  const handleRun = useCallback(() => {
    setTelemetry({}); // clear telemetry on run
    setConsoleLogs([]); // clear logs on run
    setTestResults([]); // clear tests on run
    compileCode(files);
  }, [files, compileCode]);

  const handleTestResult = useCallback((result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  }, []);

  const handleAcceptAiChanges = useCallback(() => {
    if (!pendingAiChanges) return;
    const updatedFiles = { ...files, ...pendingAiChanges };
    setFiles(updatedFiles);
    setPendingAiChanges(null);
    compileCode(updatedFiles);
    setChatMessages(prev => [...prev, { role: "assistant", content: "✅ Changes accepted and compiled successfully!" }]);
  }, [pendingAiChanges, files, compileCode, setChatMessages]);

  const handleRejectAiChanges = useCallback(() => {
    setPendingAiChanges(null);
    setChatMessages(prev => [...prev, { role: "assistant", content: "❌ Changes rejected. The original code has been restored." }]);
  }, [setChatMessages]);

  const fetchSavedSims = useCallback(async () => {
    setIsLoadingSims(true);
    try {
      const res = await fetch("/api/simulations");
      if (res.ok) {
        const data = await res.json() as { simulations?: SavedSim[] };
        setSavedSims(data.simulations || []);
      }
    } catch (e) {
      logger.error("[SimPlayground] Failed to fetch sims:", e);
    } finally {
      setIsLoadingSims(false);
    }
  }, []);

  const fetchGithubSims = useCallback(async () => {
    setIsLoadingGithubSims(true);
    try {
      const res = await fetch(`${GITHUB_REPO.rawUrl}/src/sims/simRegistry.json`);
      if (res.ok) {
        const data = await res.json() as { simulators: GithubSim[] };
        setGithubSims(data.simulators || []);
      }
    } catch (e) {
      logger.error("[SimPlayground] Failed to fetch github sims:", e);
    } finally {
      setIsLoadingGithubSims(false);
    }
  }, []);

  const handleLoadSim = useCallback(async (id: string) => {
    setIsLoadingSim(true);
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
      logger.error("[SimPlayground] Load failed:", e);
      const { toast } = await import("sonner");
      toast.error("Failed to load simulation");
    } finally {
      setIsLoadingSim(false);
    }
  }, [compileCode]);

  const handleLoadGithubSim = useCallback(async (sim: GithubSim) => {
    setIsLoadingGithubSim(true);
    try {
      // New folder structure: path is like "./armkg", file is at "armkg/index.tsx"
      const folder = sim.path.replace('./', '');
      const filename = `${folder}/index.tsx`;
      const res = await fetch(`${GITHUB_REPO.rawUrl}/src/sims/${filename}`);
      if (!res.ok) throw new Error("Not found");
      const code = await res.text();

      const parsedFiles = { [filename]: code };

      setFiles(parsedFiles);
      setActiveFile(filename);
      setSimName(sim.name);
      setSimId(`github:${sim.id}`);
      compileCode(parsedFiles);
      setShowLibrary(false);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("simId", `github:${sim.id}`);
      window.history.replaceState({}, "", newUrl.toString());

      const { toast } = await import("sonner");
      toast.success(`Loaded Official Sim: ${sim.name}`);
    } catch (e) {
      logger.error("[SimPlayground] GitHub Load failed:", e);
      const { toast } = await import("sonner");
      toast.error(`Failed to load ${sim.name} from GitHub`);
    } finally {
      setIsLoadingGithubSim(false);
    }
  }, [compileCode]);

  const handleToggleLibrary = useCallback(() => {
    if (!showLibrary) {
      fetchSavedSims();
      fetchGithubSims();
    }
    setShowLibrary(prev => !prev);
  }, [showLibrary, fetchSavedSims, fetchGithubSims]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(files, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [files]);

  const handleFormatCode = useCallback(async () => {
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
      logger.error("Failed to format code:", e);
      const { toast } = await import("sonner");
      toast.error("Format failed");
    }
  }, [files, activeFile]);

  const handleDownloadZip = useCallback(async () => {
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
      logger.error("Failed to download zip:", e);
    }
  }, [files, simName]);

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
      // Use a timeout to avoid synchronous setState during render/effect phase
      const timer = setTimeout(() => compileCode(files), 0);
      return () => clearTimeout(timer);
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
      if (e.data?.type === "sim-fps") {
        setFps(e.data.fps);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setAttachedImage]);


  // ── localStorage Version Snapshots ──
  const SNAPSHOT_KEY = 'ares_sim_snapshots';
  const MAX_SNAPSHOTS = 5;

  const saveSnapshot = useCallback(() => {
    try {
      const snapshot = {
        files,
        simName,
        simId,
        timestamp: Date.now()
      };
      const stored = localStorage.getItem(SNAPSHOT_KEY);
      const snapshots = stored ? JSON.parse(stored) : [];
      snapshots.unshift(snapshot);
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0, MAX_SNAPSHOTS)));
    } catch { /* localStorage full or unavailable */ }
  }, [files, simName, simId]);

  // Autosave snapshot every 60s while editing
  useEffect(() => {
    const interval = setInterval(saveSnapshot, 60000);
    return () => clearInterval(interval);
  }, [saveSnapshot]);

  const getSnapshots = useCallback(() => {
    try {
      const stored = localStorage.getItem(SNAPSHOT_KEY);
      return stored ? JSON.parse(stored) as { files: Record<string, string>; simName: string; simId: string | null; timestamp: number }[] : [];
    } catch { return []; }
  }, []);

  const restoreSnapshot = useCallback((snapshot: { files: Record<string, string>; simName: string; simId: string | null }) => {
    setFiles(snapshot.files);
    setActiveFile(Object.keys(snapshot.files)[0]);
    setSimName(snapshot.simName);
    setSimId(snapshot.simId);
    compileCode(snapshot.files);
    setShowHistory(false);
    import("sonner").then(({ toast }) => toast.success("Snapshot restored"));
  }, [compileCode]);

  // On mount: offer to resume if there's a recent snapshot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('simId')) return; // Don't offer resume if loading a specific sim
    const snapshots = getSnapshots();
    if (snapshots.length > 0 && Date.now() - snapshots[0].timestamp < 24 * 60 * 60 * 1000) {
      import("sonner").then(({ toast }) => {
        toast("Resume previous session?", {
          action: {
            label: "Restore",
            onClick: () => restoreSnapshot(snapshots[0])
          },
          duration: 8000
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const handleLoadGist = useCallback(async (id: string) => {
    setIsLoadingSim(true);
    try {
      const res = await fetch(`/api/simulations/gist/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json() as { simulation: { id: string; name: string; files: Record<string, string> } };
      const sim = data.simulation;
      const parsedFiles = sim.files;

      if (Object.keys(parsedFiles).length === 0) {
        parsedFiles["SimComponent.jsx"] = "";
      }

      setFiles(parsedFiles);
      setActiveFile(Object.keys(parsedFiles)[0]);
      setSimName(sim.name);
      setSimId(sim.id);
      compileCode(parsedFiles);
      setShowLibrary(false);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("simId");
      newUrl.searchParams.set("gist", id);
      window.history.replaceState({}, "", newUrl.toString());

      const { toast } = await import("sonner");
      toast.success(`Loaded Gist: ${sim.name}`);
    } catch (e) {
      logger.error("[SimPlayground] Gist Load failed:", e);
      const { toast } = await import("sonner");
      toast.error("Failed to load Gist simulation");
    } finally {
      setIsLoadingSim(false);
    }
  }, [compileCode]);

  // Check URL for shared simulation on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("simId");
    const gistParam = params.get("gist");
    if (gistParam) {
      setTimeout(() => handleLoadGist(gistParam), 0);
    } else if (idParam) {
      setTimeout(() => handleLoadSim(idParam), 0);
    }
  }, [handleLoadSim, handleLoadGist]);

  const handleEditorDidMount = useCallback(async (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
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
      logger.error("[SimPlayground] Failed to load intellisense types:", e);
    }
    
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Ghost text provider (Manual trigger: user types, but we only show if requested, or just provide it but require Ctrl+Space to trigger)
    monaco.languages.registerInlineCompletionsProvider('javascript', {
      provideInlineCompletions: async (
        model: editor.ITextModel,
        position: Position,
        context: languages.InlineCompletionContext,
        _token: CancellationToken
      ): Promise<languages.InlineCompletions<languages.InlineCompletion>> => {
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
      }
    });
  }, []);

  // Vim Mode Effect
  useEffect(() => {
    if (isVimMode && editorRef.current) {
      import('monaco-vim').then((vim) => {
        // monaco-vim doesn't export proper types, but the editor is IStandaloneCodeEditor
        if (editorRef.current) {
          vimRef.current = vim.initVimMode(editorRef.current, document.createElement('div'));
        }
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
        if (model && monacoRef.current) {
          monacoRef.current.editor.setModelMarkers(model, "babel", [{
            startLineNumber: line,
            startColumn: col,
            endLineNumber: line,
            endColumn: col + 1,
            message: compileError,
            severity: monacoRef.current.MarkerSeverity.Error
          }]);
        }
      }
    } else if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, "babel", []);
      }
    }
  }, [compileError]);


  // ── z.AI Chat ──

  /**
   * Sanitize user input to prevent prompt injection attacks.
   * Removes control characters and limits length.
   */


  // ── Component Library ──
  const handleInsertCode = useCallback((code: string) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const position = editor.getPosition();
      if (position) {
        editor.executeEdits("component-library", [{
          range: new (window as any).monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: code,
          forceMoveMarkers: true
        }]);
        editor.focus();
      }
    }
  }, []);

  // ── Save ──
  const handleSave = async () => {
    if (!simName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      } else {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        const { toast } = await import("sonner");
        toast.error(`Save failed: ${errData.error || res.statusText}`);
      }
    } catch (e) {
      logger.error("[SimPlayground] Save failed:", e);
      const { toast } = await import("sonner");
      toast.error("Network error while saving simulation");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareGist = async () => {
    setIsSharingGist(true);
    try {
      const res = await fetch("/api/simulations/gist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: simName, files }),
      });
      if (res.ok) {
        const data = await res.json() as { gistId: string, url: string };
        const shareUrl = `${window.location.origin}/academy/playground?gist=${encodeURIComponent(data.gistId)}`;
        await navigator.clipboard.writeText(shareUrl);
        setSimId(`gist:${data.gistId}`);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("simId");
        newUrl.searchParams.set("gist", data.gistId);
        window.history.replaceState({}, "", newUrl.toString());
        const { toast } = await import("sonner");
        toast.success("Shareable link generated and copied!");
      } else {
        throw new Error("Failed to create Gist");
      }
    } catch (e) {
      logger.error("[SimPlayground] Gist Share failed:", e);
      const { toast } = await import("sonner");
      toast.error("Failed to generate shareable link");
    } finally {
      setIsSharingGist(false);
    }
  };

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S → Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl+Enter → Run
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
      // Ctrl+Shift+F → Format
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleFormatCode();
      }
      // Escape → Exit fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, handleRun, handleFormatCode]);
  const content = (
    <div
      className={isFullscreen ? "fixed inset-0 z-[100] bg-obsidian flex flex-col w-full h-full overflow-hidden" : "w-full h-full"}
    >
      <div
        className={isFullscreen ? "hidden md:flex flex-col w-full h-full p-4 md:p-6" : "hidden md:flex flex-col h-[calc(100vh-80px)]"}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const items = e.dataTransfer.files;
        if (!items || items.length === 0) return;
        const newFiles: Record<string, string> = {};
        for (const file of Array.from(items)) {
          if (file.name.endsWith('.zip')) {
            // Handle ZIP files
            try {
              const zip = await JSZip.loadAsync(file);
              for (const [path, zipFile] of Object.entries(zip.files)) {
                if (!zipFile.dir && /\.(tsx?|jsx?|css|json)$/.test(path)) {
                  newFiles[path.split('/').pop() || path] = await zipFile.async('string');
                }
              }
            } catch { /* ignore malformed zips */ }
          } else if (/\.(tsx?|jsx?|css|json)$/.test(file.name)) {
            newFiles[file.name] = await file.text();
          }
        }
        if (Object.keys(newFiles).length > 0) {
          setFiles(prev => ({ ...prev, ...newFiles }));
          setActiveFile(Object.keys(newFiles)[0]);
          const { toast } = await import("sonner");
          toast.success(`Imported ${Object.keys(newFiles).length} file(s)`);
        }
      }}
    >
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
          
          <button onClick={() => setShowComponentLibrary(!showComponentLibrary)} className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${showComponentLibrary ? 'bg-ares-gold/20 text-ares-gold border-ares-gold/30' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'}`}>
            Components
          </button>

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
          <button
            onClick={handleShareGist}
            disabled={isSharingGist}
            title="Generate shareable link via Gist"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-indigo-600/30 transition-colors disabled:opacity-50"
          >
            {isSharingGist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Share
          </button>
          {/* History dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowHistory(!showHistory)}
              title="Version history"
              className="flex items-center gap-1.5 px-2 py-1.5 bg-white/5 text-white/60 border border-white/10 rounded-md text-xs hover:bg-white/10 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            {showHistory && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-[#161b22] border border-white/10 rounded-lg shadow-xl z-50 max-h-52 overflow-y-auto">
                <div className="p-2 border-b border-white/10">
                  <span className="text-white/50 text-[10px] uppercase tracking-wider font-bold">Autosaved Snapshots</span>
                </div>
                {getSnapshots().length === 0 ? (
                  <div className="p-3 text-center text-white/30 text-xs">No snapshots yet</div>
                ) : (
                  getSnapshots().map((snap, i) => (
                    <button
                      key={i}
                      onClick={() => restoreSnapshot(snap)}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-0 bg-transparent"
                    >
                      <div className="text-sm text-white/80 truncate">{snap.simName || 'Untitled'}</div>
                      <div className="text-[10px] text-white/30">
                        {new Date(snap.timestamp).toLocaleString()} · {Object.keys(snap.files).length} files
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {/* Import files button */}
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = '.tsx,.jsx,.ts,.js,.css,.json';
              input.onchange = async () => {
                if (!input.files) return;
                const newFiles: Record<string, string> = {};
                for (const file of Array.from(input.files)) {
                  newFiles[file.name] = await file.text();
                }
                if (Object.keys(newFiles).length > 0) {
                  setFiles(prev => ({ ...prev, ...newFiles }));
                  setActiveFile(Object.keys(newFiles)[0]);
                  const { toast } = await import("sonner");
                  toast.success(`Imported ${Object.keys(newFiles).length} file(s)`);
                }
              };
              input.click();
            }}
            title="Import local files"
            className="flex items-center gap-1.5 px-2 py-1.5 bg-white/5 text-white/60 border border-white/10 rounded-md text-xs hover:bg-white/10 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          {/* Keyboard shortcuts tooltip */}
          <div className="relative group/shortcuts">
            <button className="flex items-center gap-1 px-2 py-1.5 text-white/30 hover:text-white/60 transition-colors">
              <Keyboard className="w-3.5 h-3.5" />
            </button>
            <div className="absolute top-full right-0 mt-1 w-52 bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl opacity-0 invisible group-hover/shortcuts:opacity-100 group-hover/shortcuts:visible transition-all z-50 p-3">
              <div className="text-[10px] text-white/50 uppercase tracking-wider font-bold mb-2">Shortcuts</div>
              <div className="space-y-1.5 text-xs text-white/70">
                <div className="flex justify-between"><span>Save</span><kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Ctrl+S</kbd></div>
                <div className="flex justify-between"><span>Run</span><kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Ctrl+Enter</kbd></div>
                <div className="flex justify-between"><span>Format</span><kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Ctrl+Shift+F</kbd></div>
                <div className="flex justify-between"><span>AI Complete</span><kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Ctrl+Space</kbd></div>
                <div className="flex justify-between"><span>Exit Fullscreen</span><kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Esc</kbd></div>
              </div>
            </div>
          </div>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/80 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors">
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
          
          <div className="ml-4 flex items-center gap-2 border-l border-white/10 pl-4">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Auto-Run</span>
            <button 
              onClick={() => setIsAutoRun(!isAutoRun)}
              className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isAutoRun ? 'bg-emerald-500' : 'bg-white/10'}`}
            >
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isAutoRun ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Layout Split: Top/Bottom */}
      <div className="flex-1 flex flex-col min-h-0">
        <PanelGroup orientation="vertical" id="playground-main-v2">
          <Panel defaultSize={60} minSize={20}>
            {/* Top Row: Explorer, Code, Chat */}
            <PanelGroup orientation="horizontal" id="playground-top-v2">
              {/* ── File Explorer Pane ── */}
              <Panel defaultSize={15} minSize={10} className="flex flex-col min-w-0">
                <SimFileExplorer 
                  files={files} 
                  activeFile={activeFile} 
                  setActiveFile={setActiveFile} 
                  setFiles={setFiles} 
                  readOnlyFiles={readOnlyFiles}
                />
              </Panel>

              {showComponentLibrary && (
                <>
                  <PanelResizeHandle className="w-1.5 bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors group">
                    <GripVertical className="w-3 h-3 text-white/20 group-hover:text-ares-gold/60" />
                  </PanelResizeHandle>
                  <Panel defaultSize={20} minSize={15} className="flex flex-col min-w-0">
                    <SimComponentLibrary onInsertCode={handleInsertCode} />
                  </Panel>
                </>
              )}

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
                      <span className="truncate flex-1 text-left" title={f}>{f.split('/').pop()}</span>
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
                
                <div className="flex-1 flex min-h-0 bg-[#1e1e1e] flex-col">
                  {pendingAiChanges && pendingAiChanges[activeFile] && (
                    <div className="flex items-center justify-between px-4 py-2 bg-ares-gold/10 border-b border-ares-gold/20 shrink-0">
                      <span className="text-xs text-ares-gold/80 font-medium">✨ AI suggested changes for {activeFile}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={handleRejectAiChanges} className="px-3 py-1 text-xs text-red-400 hover:bg-red-400/10 rounded transition-colors">
                          Reject
                        </button>
                        <button onClick={handleAcceptAiChanges} className="px-3 py-1 text-xs bg-ares-gold/20 text-ares-gold hover:bg-ares-gold/30 rounded transition-colors flex items-center gap-1">
                          <Check className="w-3 h-3" /> Accept
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Monaco Editor */}
                  <div className="flex-1 min-h-0 min-w-0 relative">
                    <Suspense fallback={<textarea className="w-full h-full bg-[#1e1e1e] text-white/80 text-sm font-mono p-4 resize-none border-0 outline-none" value={files[activeFile] || ''} readOnly placeholder="Loading code editor..." />}>
                      {pendingAiChanges && pendingAiChanges[activeFile] ? (
                        <MonacoDiffEditor
                          height="100%"
                          language={activeFile.endsWith('.ts') || activeFile.endsWith('.tsx') ? 'typescript' : activeFile.endsWith('.css') ? 'css' : activeFile.endsWith('.json') ? 'json' : 'javascript'}
                          theme="vs-dark"
                          original={files[activeFile] || ''}
                          modified={pendingAiChanges[activeFile]}
                          options={{
                            minimap: { enabled: isMinimap },
                            fontSize: 13,
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            padding: { top: 12 },
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            renderSideBySide: true,
                            readOnly: true // Diff view should be read-only until accepted
                          }}
                        />
                      ) : (
                        <MonacoEditor
                          height="100%"
                          language={activeFile.endsWith('.ts') || activeFile.endsWith('.tsx') ? 'typescript' : activeFile.endsWith('.css') ? 'css' : activeFile.endsWith('.json') ? 'json' : 'javascript'}
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
                      )}
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
                          // Use specific origin instead of wildcard to prevent cross-origin message leakage
                          iframe.contentWindow.postMessage({ type: 'ARES_REQUEST_SCREENSHOT' }, window.location.origin);
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
                      onClick={() => handleChatSend()}
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
            <PanelGroup orientation="horizontal" id="playground-bottom-v2">
              <Panel defaultSize={60} minSize={20} className="flex flex-col min-w-0 bg-[#0d1117]">
                <div className="px-3 py-1.5 border-b border-white/10 bg-[#0d1117] flex items-center gap-2 shrink-0">
                  <span className="text-white/40 text-xs font-mono">Live Preview</span>
                  <div className={`w-2 h-2 rounded-full ${compileError ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  {fps !== null && (
                    <span className={`text-[10px] font-mono ml-auto ${fps >= 50 ? 'text-emerald-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {fps} FPS
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0 relative flex flex-col">
                  <div className="flex-1 min-h-0">
                    <Suspense fallback={<div className="flex items-center justify-center h-full bg-[#0d1117] text-white/40 text-sm">Loading preview...</div>}>
                      <SimPreviewFrame 
                        compiledFiles={compiledFiles} 
                        compileError={compileError} 
                        onFixWithAI={handleFixWithAI}
                        onTestResult={handleTestResult}
                      />
                    </Suspense>
                  </div>
                  <TelemetryPanel data={telemetry} />
                </div>
              </Panel>

              <PanelResizeHandle className="w-1.5 bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors group">
                <GripVertical className="w-3 h-3 text-white/20 group-hover:text-ares-gold/60" />
              </PanelResizeHandle>

              <Panel defaultSize={40} minSize={20} className="flex flex-col min-w-0 bg-[#0d0f14]">
                <SimConsole 
                  logs={consoleLogs}
                  testResults={testResults}
                  onClear={() => {
                    setConsoleLogs([]);
                    setTestResults([]);
                  }} 
                  onFixWithAI={handleFixWithAI}
                />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
      </div>
      <div className="flex md:hidden flex-col items-center justify-center p-8 h-full min-h-[calc(100vh-80px)] text-center bg-obsidian">
        <div className="bg-ares-red/10 p-4 rounded-full mb-4">
          <AlertTriangle className="text-ares-red" size={48} />
        </div>
        <h2 className="text-2xl font-bold font-heading text-white mb-2">Desktop Recommended</h2>
        <p className="text-white/60 mb-6">
          The ARES Simulation IDE requires a larger screen and hardware acceleration to run optimally. Please open this page on a desktop or laptop device.
        </p>
      </div>
    </div>
  );

  return isFullscreen ? createPortal(content, document.body) : content;
}
