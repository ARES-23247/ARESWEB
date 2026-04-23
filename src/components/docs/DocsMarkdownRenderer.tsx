import { memo, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Link as LinkIcon } from "lucide-react";
import TiptapRenderer from "../TiptapRenderer";
import { CodeBlock } from "./CodeBlock";

// ── Lazy-loaded Simulators ───────────────────────────────────────────
const SwerveSimulator = lazy(() => import("../../sims/SwerveSimulator"));
const SOTMSimulator = lazy(() => import("../../sims/SOTMSimulator"));
const ConfigVisualizer = lazy(() => import("../docs/ConfigVisualizer"));
const CodePlayground = lazy(() => import("../docs/CodePlayground"));
const ScreenshotGallery = lazy(() => import("../docs/ScreenshotGallery"));
const FaultSim = lazy(() => import("../../sims/FaultSim"));
const PhysicsSim = lazy(() => import("../../sims/PhysicsSim"));
const SysIdSim = lazy(() => import("../../sims/SysIdSim"));
const VisionSim = lazy(() => import("../../sims/VisionSim"));
const ZeroAllocationSim = lazy(() => import("../../sims/ZeroAllocationSim"));
const FieldVisualizer = lazy(() => import("../../sims/FieldVisualizer"));
const TroubleshootingWizard = lazy(() => import("../../sims/TroubleshootingWizard"));
const PerformanceDashboard = lazy(() => import("../../sims/PerformanceDashboard"));
const ArmKgSim = lazy(() => import("../../sims/ArmKgSim"));
const AutoSim = lazy(() => import("../../sims/AutoSim"));
const ElevatorPidSim = lazy(() => import("../../sims/ElevatorPidSim"));
const FlywheelKvSim = lazy(() => import("../../sims/FlywheelKvSim"));
const InteractiveTutorial = lazy(() => import("../InteractiveTutorial"));
const PowerSheddingSim = lazy(() => import("../../sims/PowerSheddingSim"));
const StateMachineSim = lazy(() => import("../../sims/StateMachineSim"));

function SimLoader() {
  return (
    <div className="flex justify-center items-center py-8">
      <div className="w-8 h-8 border-4 border-ares-red/30 border-t-ares-red rounded-full animate-spin" />
    </div>
  );
}

function LazyWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<SimLoader />}>{children}</Suspense>;
}

interface DocsMarkdownRendererProps {
  content: string;
}

const protocolWhitelist = ["http", "https", "mailto", "tel"];

function validateUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    if (protocolWhitelist.includes(parsed.protocol.replace(":", ""))) {
      return url;
    }
    return undefined;
  } catch {
    // Relative paths are safe
    if (url.startsWith("/") || url.startsWith("#")) return url;
    return undefined;
  }
}

function DocsMarkdownRenderer({ content }: DocsMarkdownRendererProps) {
  let tiptapNode = null;
  // Check if it's Tiptap JSON
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === "doc") {
        tiptapNode = parsed;
      }
    }
  } catch {
    // Not JSON, treat as Markdown
  }

  if (tiptapNode) {
    return <TiptapRenderer node={tiptapNode} />;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw, 
        [rehypeSanitize, {
          ...defaultSchema,
          tagNames: [
            ...(defaultSchema.tagNames || []), 
            "swervesimulator", "sotmsimulator", "configvisualizer", "codeplayground", 
            "screenshotgallery", "faultsim", "physicssim", "sysidsim", "visionsim", 
            "zeroallocationsim", "fieldvisualizer", "troubleshootingwizard", 
            "performancedashboard", "armkgsim", "autosim", "elevatorpidsim", 
            "flywheelkvsim", "interactivetutorial", "powersheddingsim", "statemachinesim"
          ]
        }]
      ]}
      components={{
        // @ts-expect-error -- Custom component injection
        swervesimulator: () => <LazyWrap><SwerveSimulator /></LazyWrap>,
        sotmsimulator: () => <LazyWrap><SOTMSimulator /></LazyWrap>,
        configvisualizer: () => <LazyWrap><ConfigVisualizer /></LazyWrap>,
        codeplayground: () => <LazyWrap><CodePlayground /></LazyWrap>,
        screenshotgallery: () => <LazyWrap><ScreenshotGallery /></LazyWrap>,
        faultsim: () => <LazyWrap><FaultSim /></LazyWrap>,
        physicssim: () => <LazyWrap><PhysicsSim /></LazyWrap>,
        sysidsim: () => <LazyWrap><SysIdSim /></LazyWrap>,
        visionsim: () => <LazyWrap><VisionSim /></LazyWrap>,
        zeroallocationsim: () => <LazyWrap><ZeroAllocationSim /></LazyWrap>,
        fieldvisualizer: () => <LazyWrap><FieldVisualizer /></LazyWrap>,
        // @ts-expect-error -- Custom component injection
        troubleshootingwizard: () => <LazyWrap><TroubleshootingWizard /></LazyWrap>,
        performancedashboard: () => <LazyWrap><PerformanceDashboard /></LazyWrap>,
        armkgsim: () => <LazyWrap><ArmKgSim /></LazyWrap>,
        autosim: () => <LazyWrap><AutoSim /></LazyWrap>,
        elevatorpidsim: () => <LazyWrap><ElevatorPidSim /></LazyWrap>,
        flywheelkvsim: () => <LazyWrap><FlywheelKvSim /></LazyWrap>,
        // @ts-expect-error -- Custom component injection
        interactivetutorial: () => <LazyWrap><InteractiveTutorial /></LazyWrap>,
        powersheddingsim: () => <LazyWrap><PowerSheddingSim /></LazyWrap>,
        statemachinesim: () => <LazyWrap><StateMachineSim /></LazyWrap>,
        h1: ({ children }) => <h1 className="text-3xl font-bold font-heading mt-10 mb-4 text-white border-b border-white/10 pb-2">{children}</h1>,
        h2: ({ children }) => {
          const text = String(children);
          const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return (
            <h2 id={id} className="text-2xl font-bold font-heading mt-8 mb-3 text-ares-gold scroll-m-24 group relative">
              <a href={`#${id}`} className="absolute -left-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-marble/40 hover:text-ares-cyan" aria-label="Link to section">
                <LinkIcon size={18} />
              </a>
              {children}
            </h2>
          );
        },
        h3: ({ children }) => {
          const text = String(children);
          const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return (
            <h3 id={id} className="text-xl font-bold font-heading mt-6 mb-2 text-ares-red scroll-m-24 group relative">
              <a href={`#${id}`} className="absolute -left-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-marble/40 hover:text-ares-cyan" aria-label="Link to section">
                <LinkIcon size={16} />
              </a>
              {children}
            </h3>
          );
        },
        h4: ({ children }) => <h4 className="text-lg font-bold mt-4 mb-2 text-white">{children}</h4>,
        p: ({ children }) => <p className="text-white/80 leading-relaxed mb-4">{children}</p>,
        a: ({ href, children }) => {
          const safeHref = validateUrl(href);
          return (
            <a href={safeHref} className="text-ares-gold hover:text-white underline underline-offset-2 transition-colors" target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}>
              {children}
            </a>
          );
        },
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-white/70 ml-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-white/70 ml-2">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-ares-red/60 bg-ares-red/5 px-4 py-3 my-4 text-white italic rounded-r-lg">{children}</blockquote>
        ),
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match;
          if (isInline) {
            return <code className="bg-ares-red/10 text-ares-gold px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
          }
          return (
            <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} {...props} />
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="w-full border-collapse border border-white/10 text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-white/10 bg-ares-red/10 px-4 py-2 text-left font-bold text-ares-gold">{children}</th>,
        td: ({ children }) => <td className="border border-white/10 px-4 py-2 text-white/70">{children}</td>,
        hr: () => <hr className="border-white/10 my-8" />,
        img: ({ src, alt }) => {
          const safeSrc = validateUrl(src);
          return (
            <img src={safeSrc} alt={alt || "ARESLib documentation image"} className="ares-cut-sm border border-white/10 my-4 max-w-full" />
          );
        },
        strong: ({ children }) => <strong className="text-white font-bold">{children}</strong>,
        em: ({ children }) => <em className="text-ares-gold/80">{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default memo(DocsMarkdownRenderer);
