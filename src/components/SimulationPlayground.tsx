import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { SIM_TEMPLATES } from "./editor/SimTemplates";
import { SimFileExplorer } from "./editor/SimFileExplorer";
import { LogEntry, TestResult } from "./editor/SimConsole";
import { useSimulationChat } from "../hooks/useSimulationChat";
import { useSimulationFiles } from "../hooks/useSimulationFiles";
import { useCodeCompiler } from "../hooks/useCodeCompiler";
import { useMonacoEditor } from "../hooks/useMonacoEditor";
import { useSimulationSnapshots } from "../hooks/useSimulationSnapshots";
import { useSimulationShortcuts } from "../hooks/useSimulationShortcuts";
import { useSimulationTelemetry } from "../hooks/useSimulationTelemetry";
import { useSimulationActions } from "../hooks/useSimulationActions";
import { useAuth } from "../context/AuthContext";

// Sub-components
import { PlaygroundHeaderBar } from "./simulation/PlaygroundHeaderBar";
import { SimulationLibraryOverlay } from "./simulation/SimulationLibraryOverlay";
import { AiChangesBanner } from "./simulation/AiChangesBanner";
import SimulationPlaygroundPreview from "./SimulationPlaygroundPreview";
import SimulationPlaygroundConsoleTabs from "./SimulationPlaygroundConsoleTabs";

// Lazy-loaded Monaco Editor with ARES-branded loading UX
const MonacoEditor = lazy(() => import("./editor/LazyMonacoEditor").then(mod => ({ default: mod.default })));
const MonacoDiffEditor = lazy(() => import("@monaco-editor/react").then(mod => ({ default: mod.DiffEditor })));

// Real production templates for AI context
import ArmKgSimRaw from "../sims/armkg/index.tsx?raw";
import ElevatorPidSimRaw from "../sims/elevatorpid/index.tsx?raw";

export default function SimulationPlayground() {
  const { authorizedUser } = useAuth();
  const canUseAi = authorizedUser?.role === "admin" || authorizedUser?.role === "coach";
  // Local editor state must exist before URL/library loading is initialized.
  const [files, setFiles] = useState<Record<string, string>>(SIM_TEMPLATES["Blank Canvas"]);
  const [activeFile, setActiveFile] = useState("SimComponent.tsx");

  // Code Compiler Hook
  const {
    compiledFiles,
    compileError,
    compileCode,
    scheduleCompile,
  } = useCodeCompiler();

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
  } = useSimulationFiles(compileCode, setFiles, setActiveFile);

  // Monaco Editor Hook
  const {
    isWordWrap,
    isMinimap,
    handleEditorDidMount,
  } = useMonacoEditor();

  // Local state
  const [pendingAiChanges, setPendingAiChanges] = useState<Record<string, string> | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [readOnlyFiles] = useState<string[]>(["areslib.d.ts", "physics.d.ts"]);
  const [telemetry, setTelemetry] = useState<Record<string, {time: number, value: number}[]>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [fps, setFps] = useState<number | null>(null);  // fps used in JSX
  const [bottomRightTab, setBottomRightTab] = useState<'console' | 'ai'>('console');
  const [isNarrowLayout, setIsNarrowLayout] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleLayoutChange = (event: MediaQueryListEvent) => setIsNarrowLayout(event.matches);

    setIsNarrowLayout(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleLayoutChange);
    return () => mediaQuery.removeEventListener("change", handleLayoutChange);
  }, []);

  // Simulation Actions Hook
  const {
    isSaving,
    isSharingGist,
    handleSave,
    handleShareGist,
    handleFormatCode,
    handleDownloadZip
  } = useSimulationActions({
    files,
    activeFile,
    simName,
    simId,
    setFiles,
    setSimId
  });

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

  // Snapshot History Hook
  const {
    getSnapshots,
    restoreSnapshot
  } = useSimulationSnapshots({
    files,
    simName,
    simId,
    setFiles,
    setActiveFile,
    setSimName,
    setSimId,
    compileCode,
    setShowHistory
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

  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || "";
    setFiles(prev => {
      const newFiles = { ...prev, [activeFile]: newCode };
      scheduleCompile(newFiles);
      return newFiles;
    });
  }, [activeFile, scheduleCompile]);

  // Keyboard Shortcuts Hook
  useSimulationShortcuts({
    isFullscreen,
    setIsFullscreen,
    handleRun,
    handleFormatCode,
    handleSave
  });

  // Telemetry Hook
  useSimulationTelemetry({
    setTelemetry,
    setAttachedImage,
    setConsoleLogs,
    setFps
  });

  const content = (
    <div
      className={isFullscreen ? "fixed inset-0 z-[100] bg-obsidian flex flex-col w-full h-full overflow-hidden" : "w-full h-full"}
    >
      <div
        className={isFullscreen ? "relative flex flex-col w-full h-full p-2 md:p-6" : "relative flex flex-col h-[calc(100dvh-80px)] min-h-[720px] md:min-h-[640px]"}
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
        <div className="shrink-0 overflow-x-auto" aria-label="Simulation editor toolbar">
          <div className="min-w-max">
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
          </div>
        </div>

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
            <PanelGroup orientation={isNarrowLayout ? "vertical" : "horizontal"} id="playground-top-v2">
              <Panel defaultSize={isNarrowLayout ? 28 : 15} minSize={isNarrowLayout ? 20 : 10}>
                <SimFileExplorer
                  files={files}
                  activeFile={activeFile}
                  setActiveFile={setActiveFile}
                  setFiles={setFiles}
                  readOnlyFiles={readOnlyFiles}
                />
              </Panel>

              <PanelResizeHandle
                aria-label="Resize file explorer and code editor"
                className={`${isNarrowLayout ? "h-1.5 w-full" : "w-1.5 h-full"} bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan`}
              >
                <GripVertical aria-hidden="true" className={`w-3 h-3 text-white/20 group-hover:text-ares-gold/60 ${isNarrowLayout ? "rotate-90" : ""}`} />
              </PanelResizeHandle>

              <Panel defaultSize={60} minSize={25}>
                {/* Monaco Editor */}
                <div className="h-full w-full bg-obsidian-surface flex flex-col overflow-hidden">
                  <AiChangesBanner
                    pendingAiChanges={pendingAiChanges}
                    handleAcceptAiChanges={handleAcceptAiChanges}
                    handleRejectAiChanges={handleRejectAiChanges}
                  />
                  <Suspense fallback={<textarea aria-label="Simulation source code loading preview" className="w-full h-full bg-obsidian-surface text-white/80 text-sm font-mono p-4 resize-none border-0 outline-none" value={files[activeFile] || ''} readOnly />}>
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

          <PanelResizeHandle aria-label="Resize editor and output panels" className="h-1.5 w-full bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" />

          <Panel defaultSize={40} minSize={20}>
            <PanelGroup orientation={isNarrowLayout ? "vertical" : "horizontal"} id="playground-bottom-v2">
              <Panel defaultSize={60} minSize={20}>
                <SimulationPlaygroundPreview
                  compileError={compileError}
                  fps={fps}
                  compiledFiles={compiledFiles}
                  handleFixWithAI={handleFixWithAI}
                  canUseAi={canUseAi}
                  handleTestResult={handleTestResult}
                  telemetry={telemetry}
                />
              </Panel>

              <PanelResizeHandle
                aria-label="Resize simulation preview and console"
                className={`${isNarrowLayout ? "h-1.5 w-full" : "w-1.5 h-full"} bg-white/5 hover:bg-ares-gold/30 flex items-center justify-center transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan`}
              >
                <GripVertical aria-hidden="true" className={`w-3 h-3 text-white/20 group-hover:text-ares-gold/60 ${isNarrowLayout ? "rotate-90" : ""}`} />
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
                  canUseAi={canUseAi}
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

