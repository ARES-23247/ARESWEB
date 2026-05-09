import { useState } from "react";
import { FolderOpen, AlertCircle, Code, Zap, Check, Copy, Plus, Folder, RefreshCw, Play, X, Link2 } from "lucide-react";
import { toast } from "sonner";
import { SIM_METADATA, SIM_COMPONENTS } from "./generated/sim-registry";
import * as Dialog from "@radix-ui/react-dialog";
import { Suspense } from "react";

interface SimMetadata {
  id: string;
  name: string;
  folder: string;
  requiresContext: boolean;
}

export default function SimManager() {
  const sims = SIM_METADATA;
  const [copiedJson, setCopiedJson] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSim, setActiveSim] = useState<SimMetadata | null>(null);

  const ActiveComponent = activeSim ? SIM_COMPONENTS[activeSim.id] : null;

  const generateRegistry = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/simulations/admin/generate-registry", { method: "POST" });
      const data = await res.json() as { success?: boolean; error?: string; message?: string };
      if (data.success) {
        toast.success("Registry regenerated! Refresh to see changes.");
      } else {
        toast.error(`Failed: ${data.error || data.message || "Unknown error"}`);
      }
    } catch {
      toast.error("Failed to regenerate registry");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyJsonToClipboard = () => {
    const json = JSON.stringify({
      simulators: sims.map((sim: SimMetadata) => ({
        id: sim.id,
        name: sim.name,
        path: `./${sim.folder}`,
        requiresContext: sim.requiresContext,
      })),
      _generated: new Date().toISOString(),
    }, null, 2);
    navigator.clipboard.writeText(json);
    setCopiedJson(true);
    toast.success("JSON copied to clipboard");
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const getMarkdownTag = (sim: SimMetadata) => {
    return `<${sim.id.toLowerCase()} />`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-ares-red">Simulation Registry</h1>
          <p className="text-gray-400 mt-1">
            Auto-discovered sims from <code className="bg-obsidian-900 px-2 py-0.5 rounded text-ares-gold">src/sims/</code>
          </p>
        </div>
        <div className="flex gap-3">
          {import.meta.env.DEV && (
            <button
              onClick={generateRegistry}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-ares-red/20 text-ares-red rounded-lg hover:bg-ares-red/30 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Generating..." : "Regenerate"}
            </button>
          )}
          <button
            onClick={copyJsonToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-ares-gold/20 text-ares-gold rounded-lg hover:bg-ares-gold/30 transition"
          >
            {copiedJson ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedJson ? "Copied!" : "Copy JSON"}
          </button>
        </div>
      </div>

      {/* How to Add Section */}
      <div className="mb-8 p-4 bg-ares-gold/10 rounded-lg border border-ares-gold/30">
        <h3 className="font-semibold text-ares-gold mb-2 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          How to Add a New Simulation
        </h3>
        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
          <li>Create a folder: <code className="bg-obsidian-900 px-1 rounded">src/sims/my-sim/</code></li>
          <li>Create <code className="bg-obsidian-900 px-1 rounded">index.tsx</code> with your component</li>
          <li>
            Add optional metadata at the top:
            <pre className="mt-1 text-xs bg-obsidian-900 p-2 rounded text-ares-gold">
              {`/** @sim {"name": "My Display Name", "requiresContext": false} */`}
            </pre>
          </li>
          <li>
            {import.meta.env.DEV ? (
              <>Click <strong>Regenerate</strong> button above (or run: <code className="bg-obsidian-900 px-1 rounded">npm run generate:sims</code>)</>
            ) : (
              <>Run <code className="bg-obsidian-900 px-1 rounded">npm run generate:sims</code> locally and commit</>
            )}
          </li>
          <li>Refresh page and use in docs: <code className="bg-obsidian-900 px-1 rounded">{'<mysim />'}</code></li>
        </ol>
      </div>

      {/* Stats */}
      <div className="mb-6 flex gap-4 text-sm">
        <div className="px-3 py-1.5 bg-obsidian-800 rounded-lg border border-ares-gold/20">
          <span className="text-gray-400">Total: </span>
          <span className="text-white font-semibold">{sims.length}</span>
        </div>
        <div className="px-3 py-1.5 bg-obsidian-800 rounded-lg border border-green-500/20">
          <span className="text-gray-400">Standalone: </span>
          <span className="text-green-400 font-semibold">{sims.filter((s: SimMetadata) => !s.requiresContext).length}</span>
        </div>
        <div className="px-3 py-1.5 bg-obsidian-800 rounded-lg border border-ares-bronze/20">
          <span className="text-gray-400">Requires Context: </span>
          <span className="text-ares-bronze font-semibold">{sims.filter((s: SimMetadata) => s.requiresContext).length}</span>
        </div>
      </div>

      {/* Sims Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sims.map((sim: SimMetadata) => (
          <div
            key={sim.id}
            className="bg-obsidian-800 rounded-lg border border-ares-gold/20 p-4 hover:border-ares-gold/40 transition"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-white">{sim.name}</h3>
              {sim.requiresContext ? (
                <span className="flex items-center gap-1 text-xs text-ares-bronze bg-ares-bronze/10 px-2 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3" />
                  Context
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
                  <Zap className="w-3 h-3" />
                  Standalone
                </span>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Folder className="w-3 h-3" />
                <code className="text-ares-gold">{sim.folder}/</code>
              </div>

              <div className="flex items-center gap-2 text-gray-400">
                <Code className="w-3 h-3" />
                <span className="text-xs">ID: <code className="text-gray-300">{sim.id}</code></span>
              </div>

              <div className="flex items-center gap-2 text-gray-400">
                <Copy className="w-3 h-3" />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getMarkdownTag(sim));
                    toast.success(`Copied: ${getMarkdownTag(sim)}`);
                  }}
                  className="text-xs hover:text-ares-gold transition"
                >
                  {getMarkdownTag(sim)}
                </button>
              </div>

              <div className="mt-4 pt-2 border-t border-ares-gold/10 flex gap-2">
                <button
                  onClick={() => setActiveSim(sim)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-ares-red/10 text-ares-red hover:bg-ares-red/20 rounded text-xs font-semibold transition flex-1 justify-center"
                >
                  <Play className="w-3 h-3" />
                  Preview
                </button>
                <button
                  onClick={async () => {
                    const shareUrl = `${window.location.origin}/academy/playground?simId=github:${sim.id}`;
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success(`Copied share link for ${sim.name}`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded text-xs font-semibold transition"
                >
                  <Link2 className="w-3 h-3" />
                  Share
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      <Dialog.Root open={activeSim !== null} onOpenChange={(open) => !open && setActiveSim(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-[95vw] max-w-6xl translate-x-[-50%] translate-y-[-50%] gap-4 border border-ares-gold/20 bg-obsidian-900 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-2">
              <Dialog.Title className="text-xl font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-ares-red" />
                {activeSim?.name}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="rounded-full p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </button>
              </Dialog.Close>
              <button
                onClick={async () => {
                  if (!activeSim) return;
                  const shareUrl = `${window.location.origin}/academy/playground?simId=github:${activeSim.id}`;
                  await navigator.clipboard.writeText(shareUrl);
                  toast.success("Shareable link copied!");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded text-xs font-semibold transition"
              >
                <Link2 className="w-3.5 h-3.5" />
                Share
              </button>
            </div>
            <div className="flex-1 min-h-[500px] bg-obsidian-950 rounded-lg border border-white/5 overflow-hidden relative">
              <Suspense fallback={
                <div className="absolute inset-0 flex items-center justify-center text-ares-gold/50">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              }>
                {ActiveComponent && <ActiveComponent />}
              </Suspense>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Registry File Info */}
      <div className="mt-8 p-4 bg-obsidian-800 rounded-lg border border-white/10">
        <h3 className="font-semibold text-gray-300 mb-2 flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Generated Files
        </h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li><code className="text-ares-gold">src/components/generated/sim-registry.ts</code> — Lazy imports for React</li>
          <li><code className="text-ares-gold">src/sims/simRegistry.json</code> — Reference (auto-generated, do not edit)</li>
        </ul>
        <p className="text-xs text-gray-500 mt-2">
          Both files are auto-generated from the filesystem. Add sims by creating folders in src/sims/
        </p>
      </div>
    </div>
  );
}
