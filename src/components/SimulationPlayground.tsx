import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { createPortal } from "react-dom";
import { Play, Save, Loader2, RotateCcw, Copy, Check, GripVertical, FolderOpen, Maximize, Minimize, AlertTriangle } from "lucide-react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { SIM_TEMPLATES } from "./editor/SimTemplates";
import { TelemetryPanel } from "./editor/TelemetryPanel";
import { SimFileExplorer } from "./editor/SimFileExplorer";
// TODO: implement component library picker UI
// import { SimComponentLibrary } from "./editor/SimComponentLibrary";
import { SimConsole, LogEntry, TestResult } from "./editor/SimConsole";
import { logger } from "../utils/logger";
import { useSimulationChat } from "../hooks/useSimulationChat";
import { useSimulationFiles } from "../hooks/useSimulationFiles";
import { useCodeCompiler } from "../hooks/useCodeCompiler";
import { useMonacoEditor } from "../hooks/useMonacoEditor";

// Lazy-loaded Monaco Editor with ARES-branded loading UX
const MonacoEditor = lazy(() => import("./editor/LazyMonacoEditor").then(mod => ({ default: mod.default })));
// TODO: implement diff view for AI changes
// const MonacoDiffEditor = lazy(() => import("@monaco-editor/react").then(mod => ({ default: mod.DiffEditor })));
const SimPreviewFrame = lazy(() => import("./editor/SimPreviewFrame"));

// Real production templates for AI context
import ArmKgSimRaw from "../sims/armkg/index.tsx?raw";
import ElevatorPidSimRaw from "../sims/elevatorpid/index.tsx?raw";

// TODO: use these types when library is implemented
/*
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
*/

export default function SimulationPlayground() {
  // File Management Hook
  const {
    simId,
    setSimId,
    simName,
    setSimName,
    fetchSavedSims,
    fetchGithubSims,
  } = useSimulationFiles(() => Promise.resolve(null));

  // Code Compiler Hook
  const {
    compiledFiles,
    compileError,
    compileCode,
    scheduleCompile,
  } = useCodeCompiler();

  // Monaco Editor Hook
  const {
    editorRef,
    isWordWrap,
    isMinimap,
    handleEditorDidMount,
  } = useMonacoEditor();

  // Local state
  const [files, setFiles] = useState<Record<string, string>>(SIM_TEMPLATES["Blank Canvas"]);
  const [activeFile, setActiveFile] = useState("SimComponent.tsx");
  const [pendingAiChanges, setPendingAiChanges] = useState<Record<string, string> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [_isSharingGist, _setIsSharingGist] = useState(false);  // TODO: add gist sharing button
  const [copied, setCopied] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  // TODO: implement history/snapshot restore in UI
  const [_showHistory, _setShowHistory] = useState(false);
  // TODO: implement auto-run feature
  const [_isAutoRun, _setIsAutoRun] = useState(() => localStorage.getItem("ares_sim_autorun") === "true");
  const [readOnlyFiles] = useState<string[]>(["areslib.d.ts", "physics.d.ts"]);
  const [telemetry, setTelemetry] = useState<Record<string, {time: number, value: number}[]>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [fps, setFps] = useState<number | null>(null);  // fps used in JSX

  // AI Chat Logic
  const {
    setChatMessages,
    setAttachedImage,
    handleFixWithAI,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compileCode, resetChat]);

  const handleRun = useCallback(() => {
    setTelemetry({});
    setConsoleLogs([]);
    setTestResults([]);
    compileCode(files);
  }, [files, compileCode]);

  const handleTestResult = useCallback((result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  }, []);

  // TODO: add AI change accept/reject UI buttons
  const _handleAcceptAiChanges = useCallback(() => {
    if (!pendingAiChanges) return;
    const updatedFiles = { ...files, ...pendingAiChanges };
    setFiles(updatedFiles);
    setPendingAiChanges(null);
    compileCode(updatedFiles);
    setChatMessages(prev => [...prev, { role: "assistant", content: "✅ Changes accepted and compiled successfully!" }]);
  }, [pendingAiChanges, files, compileCode, setChatMessages]);

  // TODO: add AI change accept/reject UI buttons
  const _handleRejectAiChanges = useCallback(() => {
    setPendingAiChanges(null);
    setChatMessages(prev => [...prev, { role: "assistant", content: "❌ Changes rejected. The original code has been restored." }]);
  }, [setChatMessages]);

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
      const prettier = (await import("prettier/standalone")).default;
      const prettierPluginBabel = await import("prettier/plugins/babel");
      const prettierPluginEstree = await import("prettier/plugins/estree");
      const prettierPluginTs = await import("prettier/plugins/typescript");
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

  // TODO: add download button to UI
  const _handleDownloadZip = useCallback(async () => {
    try {
      const JSZip = (await import("jszip")).default;
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
      scheduleCompile(newFiles);
      return newFiles;
    });
  }, [activeFile, scheduleCompile]);

  // TODO: implement code insertion from component library
  const _handleInsertCode = useCallback((code: string) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const position = editor.getPosition();
      if (position) {
        editor.executeEdits("component-library", [{
          range: new ((window as unknown as { monaco: { Range: new (startLine: number, startCol: number, endLine: number, endCol: number) => { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } } }).monaco.Range)(position.lineNumber, position.column, position.lineNumber, position.column),
          text: code,
          forceMoveMarkers: true
        }]);
        editor.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simName, files, simId]);

  // TODO: add share gist button to UI
  const _handleShareGist = useCallback(async () => {
    _setIsSharingGist(true);
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
      _setIsSharingGist(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simName, files]);

  // Listen for Telemetry from Iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "ARES_TELEMETRY") {
        setTelemetry(prev => {
          const key = e.data.key;
          const current = prev[key] || [];
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

  // Version Snapshot state
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

  useEffect(() => {
    const interval = setInterval(saveSnapshot, 60000);
    return () => clearInterval(interval);
  }, [saveSnapshot]);

  // TODO: implement snapshot history UI
  const _getSnapshots = useCallback(() => {
    try {
      const stored = localStorage.getItem(SNAPSHOT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }, []);

  // TODO: wire up snapshot restore in UI
  const _restoreSnapshot = useCallback((snapshot: { files: Record<string, string>; simName: string; simId: string | null }) => {
    setFiles(snapshot.files);
    setActiveFile(Object.keys(snapshot.files)[0]);
    setSimName(snapshot.simName);
    setSimId(snapshot.simId);
    compileCode(snapshot.files);
    _setShowHistory(false);
    import("sonner").then(({ toast }) => toast.success("Snapshot restored"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compileCode]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleFormatCode();
      }
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, handleRun, handleFormatCode, handleSave]);

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
              try {
                const JSZip = (await import("jszip")).default;
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
            {/* Control buttons - simplified for brevity */}
            <button onClick={handleToggleLibrary} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-indigo-600/30 transition-colors">
              <FolderOpen className="w-3.5 h-3.5" />
              Open
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

            <button onClick={() => setIsFullscreen(!isFullscreen)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/80 border border-white/10 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors">
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Main content panels */}
        <PanelGroup orientation="vertical" id="playground-main-v2">
          <Panel defaultSize={60} minSize={20}>
            <PanelGroup orientation="horizontal" id="playground-top-v2">
              <Panel defaultSize={15} minSize={10}>
                <SimFileExplorer
                  files={files}
                  activeFile={activeFile}
                  setActiveFile={setActiveFile}
                  setFiles={setFiles}
                  readOnlyFiles={readOnlyFiles}
                />
              </Panel>

              <PanelResizeHandle className="w-1.5 bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors group">
                <GripVertical className="w-3 h-3 text-white/20 group-hover:text-ares-gold/60" />
              </PanelResizeHandle>

              <Panel defaultSize={60} minSize={25}>
                {/* Monaco Editor */}
                <div className="flex-1 min-h-0 bg-[#1e1e1e] flex flex-col">
                  <Suspense fallback={<textarea className="w-full h-full bg-[#1e1e1e] text-white/80 text-sm font-mono p-4 resize-none border-0 outline-none" value={files[activeFile] || ''} readOnly />}>
                    <MonacoEditor
                      height="100%"
                      language={activeFile.endsWith('.ts') || activeFile.endsWith('.tsx') ? 'typescript' : 'javascript'}
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
                      }}
                    />
                  </Suspense>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="h-1.5 w-full bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors z-20" />

          <Panel defaultSize={40} minSize={20}>
            <PanelGroup orientation="horizontal" id="playground-bottom-v2">
              <Panel defaultSize={60} minSize={20}>
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

              <Panel defaultSize={40} minSize={20}>
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
