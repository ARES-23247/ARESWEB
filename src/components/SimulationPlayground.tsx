import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { SIM_TEMPLATES } from "./editor/SimTemplates";
import { SimFileExplorer } from "./editor/SimFileExplorer";
// TODO: implement component library picker UI
// import { SimComponentLibrary } from "./editor/SimComponentLibrary";
import { LogEntry, TestResult } from "./editor/SimConsole";
import { logger } from "../utils/logger";
import { useSimulationChat } from "../hooks/useSimulationChat";
import { useSimulationFiles } from "../hooks/useSimulationFiles";
import { useCodeCompiler } from "../hooks/useCodeCompiler";
import { useMonacoEditor } from "../hooks/useMonacoEditor";
import { toastApiError } from "../api/apiClient";

// Sub-components
import { PlaygroundHeaderBar } from "./simulation/PlaygroundHeaderBar";
import { SimulationLibraryOverlay } from "./simulation/SimulationLibraryOverlay";
import { AiChangesBanner } from "./simulation/AiChangesBanner";
import { Snapshot } from "./simulation/SnapshotHistoryDropdown";
import SimulationPlaygroundPreview from "./SimulationPlaygroundPreview";
import SimulationPlaygroundConsoleTabs from "./SimulationPlaygroundConsoleTabs";

// Lazy-loaded Monaco Editor with ARES-branded loading UX
const MonacoEditor = lazy(() => import("./editor/LazyMonacoEditor").then(mod => ({ default: mod.default })));
const MonacoDiffEditor = lazy(() => import("@monaco-editor/react").then(mod => ({ default: mod.DiffEditor })));

// Real production templates for AI context
import ArmKgSimRaw from "../sims/armkg/index.tsx?raw";
import ElevatorPidSimRaw from "../sims/elevatorpid/index.tsx?raw";

// TODO: use these types when library is implemented
/*
interface SavedSim {
  id: string;
  name: string;
  author_id: string;
  createdAt: string;
  updatedAt: string;
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
    savedSims,
    githubSims,
    isLoadingSims,
    isLoadingGithubSims,
    simId,
    setSimId,
    simName,
    setSimName,
    fetchSavedSims,
    fetchGithubSims,
    handleLoadSim,
    handleLoadGithubSim,
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
  const [isSharingGist, setIsSharingGist] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // TODO: implement auto-run feature
  const [_isAutoRun, _setIsAutoRun] = useState(() => localStorage.getItem("ares_sim_autorun") === "true");
  const [readOnlyFiles] = useState<string[]>(["areslib.d.ts", "physics.d.ts"]);
  const [telemetry, setTelemetry] = useState<Record<string, {time: number, value: number}[]>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [fps, setFps] = useState<number | null>(null);  // fps used in JSX
  const [bottomRightTab, setBottomRightTab] = useState<'console' | 'ai'>('console');

  // AI Chat Logic
  const {
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    isChatLoading,
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
      toastApiError(e, "Format failed");
    }
  }, [files, activeFile]);

  const handleDownloadZip = useCallback(async () => {
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
        const errData = await res.json().catch(() => ({})) as { error?: string, message?: string, code?: string };
        toastApiError({ 
          message: errData.message || errData.error || res.statusText, 
          status: res.status,
          code: errData.code 
        }, "Save failed");
      }
    } catch (e) {
      logger.error("[SimPlayground] Save failed:", e);
      toastApiError(e, "Network error while saving simulation");
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simName, files, simId]);

  const handleShareGist = useCallback(async () => {
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
      toastApiError(e, "Gist Generation Failed");
    } finally {
      setIsSharingGist(false);
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

  const getSnapshots = useCallback(() => {
    try {
      const stored = localStorage.getItem(SNAPSHOT_KEY);
      return stored ? JSON.parse(stored) : [];
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
        className={isFullscreen ? "relative flex flex-col w-full h-full p-2 md:p-6" : "relative flex flex-col h-[calc(100vh-80px)]"}
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
        <PlaygroundHeaderBar
          simName={simName}
          setSimName={setSimName}
          simId={simId}
          handleReset={handleReset}
          handleToggleLibrary={handleToggleLibrary}
          handleRun={handleRun}
          handleCopy={handleCopy}
          copied={copied}
          handleSave={handleSave}
          isSaving={isSaving}
          handleDownloadZip={handleDownloadZip}
          handleShareGist={handleShareGist}
          isSharingGist={isSharingGist}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          getSnapshots={getSnapshots}
          restoreSnapshot={restoreSnapshot}
          isFullscreen={isFullscreen}
          setIsFullscreen={setIsFullscreen}
        />

        <SimulationLibraryOverlay
          showLibrary={showLibrary}
          setShowLibrary={setShowLibrary}
          savedSims={savedSims}
          githubSims={githubSims}
          isLoadingSims={isLoadingSims}
          isLoadingGithubSims={isLoadingGithubSims}
          handleLoadSim={handleLoadSim}
          handleLoadGithubSim={handleLoadGithubSim}
          setFiles={setFiles}
          setActiveFile={setActiveFile}
        />

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
                <div className="h-full w-full bg-obsidian-surface flex flex-col overflow-hidden">
                  <AiChangesBanner
                    pendingAiChanges={pendingAiChanges}
                    handleAcceptAiChanges={handleAcceptAiChanges}
                    handleRejectAiChanges={handleRejectAiChanges}
                  />
                  <Suspense fallback={<textarea className="w-full h-full bg-obsidian-surface text-white/80 text-sm font-mono p-4 resize-none border-0 outline-none" value={files[activeFile] || ''} readOnly />}>
                    {pendingAiChanges && pendingAiChanges[activeFile] ? (
                      <MonacoDiffEditor
                        height="100%"
                        language={activeFile.endsWith('.ts') || activeFile.endsWith('.tsx') ? 'typescript' : 'javascript'}
                        theme="vs-dark"
                        original={files[activeFile] || ''}
                        modified={pendingAiChanges[activeFile]}
                        options={{
                          readOnly: true,
                          renderSideBySide: true,
                          minimap: { enabled: false },
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          padding: { top: 12 },
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    ) : (
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
                    )}
                  </Suspense>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="h-1.5 w-full bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors z-20" />

          <Panel defaultSize={40} minSize={20}>
            <PanelGroup orientation="horizontal" id="playground-bottom-v2">
              <Panel defaultSize={60} minSize={20}>
                <SimulationPlaygroundPreview
                  compileError={compileError}
                  fps={fps}
                  compiledFiles={compiledFiles}
                  handleFixWithAI={handleFixWithAI}
                  handleTestResult={handleTestResult}
                  telemetry={telemetry}
                />
              </Panel>

              <PanelResizeHandle className="w-1.5 bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors group">
                <GripVertical className="w-3 h-3 text-white/20 group-hover:text-ares-gold/60" />
              </PanelResizeHandle>

              <Panel defaultSize={40} minSize={20}>
                <SimulationPlaygroundConsoleTabs
                  bottomRightTab={bottomRightTab}
                  setBottomRightTab={setBottomRightTab}
                  consoleLogs={consoleLogs}
                  setConsoleLogs={setConsoleLogs}
                  testResults={testResults}
                  setTestResults={setTestResults}
                  handleFixWithAI={handleFixWithAI}
                  chatMessages={chatMessages}
                  isChatLoading={isChatLoading}
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  handleChatKeyDown={handleChatKeyDown}
                  handleChatSend={handleChatSend}
                  chatEndRef={chatEndRef}
                  chatInputRef={chatInputRef}
                />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>


    </div>
  );

  return isFullscreen ? createPortal(content, document.body) : content;
}

