import { ReactNode, lazy, Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Eye } from "lucide-react";
import { CodeBlock } from "./docs/CodeBlock";

const CodePlayground = lazy(() => import('./docs/CodePlayground').catch(() => ({ default: () => <div className="text-ares-danger">Failed to load CodePlayground</div> })));
const InteractiveTutorial = lazy(() => import('./InteractiveTutorial').catch(() => ({ default: () => <div className="text-ares-danger">Failed to load InteractiveTutorial</div> })));
// @ts-expect-error -- CoreValueCallout uses named export; catch fallback provides default shape
const CoreValueCallout = lazy(() => import('./CoreValueCallout').catch(() => ({ default: () => <div className="text-ares-danger">Failed to load CoreValueCallout</div> })));
const SwerveSimulator = lazy(() => import('../sims/SwerveSimulator'));
const SOTMSimulator = lazy(() => import('../sims/SOTMSimulator'));
const ConfigVisualizer = lazy(() => import('./docs/ConfigVisualizer'));
const ScreenshotGallery = lazy(() => import('./docs/ScreenshotGallery'));
const FaultSim = lazy(() => import('../sims/FaultSim'));
const PhysicsSim = lazy(() => import('../sims/PhysicsSim'));
const SysIdSim = lazy(() => import('../sims/SysIdSim'));
const VisionSim = lazy(() => import('../sims/VisionSim'));
const ZeroAllocationSim = lazy(() => import('../sims/ZeroAllocationSim'));
const FieldVisualizer = lazy(() => import('../sims/FieldVisualizer'));
const TroubleshootingWizard = lazy(() => import('../sims/TroubleshootingWizard'));
const PerformanceDashboard = lazy(() => import('../sims/PerformanceDashboard'));
const ArmKgSim = lazy(() => import('../sims/ArmKgSim'));
const AutoSim = lazy(() => import('../sims/AutoSim'));
const ElevatorPidSim = lazy(() => import('../sims/ElevatorPidSim'));
const FlywheelKvSim = lazy(() => import('../sims/FlywheelKvSim'));
const PowerSheddingSim = lazy(() => import('../sims/PowerSheddingSim'));
const StateMachineSim = lazy(() => import('../sims/StateMachineSim'));

const ComponentMap = {
  CodePlayground,
  InteractiveTutorial,
  CoreValueCallout,
  SwerveSimulator,
  SOTMSimulator,
  ConfigVisualizer,
  ScreenshotGallery,
  FaultSim,
  PhysicsSim,
  SysIdSim,
  VisionSim,
  ZeroAllocationSim,
  FieldVisualizer,
  TroubleshootingWizard,
  PerformanceDashboard,
  ArmKgSim,
  AutoSim,
  ElevatorPidSim,
  FlywheelKvSim,
  PowerSheddingSim,
  StateMachineSim,
  Mermaid: lazy(() => Promise.resolve({ default: () => <div className="p-4 border border-white/10 bg-ares-gray-dark rounded text-ares-gray text-sm font-mono">[Mermaid Diagram]</div> })),
  HomeCoreValues: lazy(() => Promise.resolve({ default: () => <div className="p-4 border border-white/10 bg-ares-gray-dark rounded text-ares-gray text-sm font-mono">[Core Values Component]</div> }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as Record<string, any>;

export interface ASTMark { type: string; }
export interface ASTNode {
  type: string;
  text?: string;
  content?: ASTNode[];
  level?: number;
  marks?: ASTMark[];
  src?: string;
  alt?: string;
  attrs?: Record<string, string | number | boolean>;
}

function validateUrl(url: string, type: 'image' | 'video'): string {
  if (!url) return "";
  
  // Allow relative paths
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url;

  const allowedDomains = [
    "aresnetwork.dev",
    "youtube.com",
    "youtu.be",
    "googleusercontent.com",
    "cloudflare-ipfs.com",
    "raw.githubusercontent.com"
  ];

  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.split('.').slice(-2).join('.');
    if (allowedDomains.includes(domain)) return url;
  } catch {
    return "";
  }
  
  console.warn(`Blocked ${type} URL for security: ${url}`);
  return "";
}

export default function TiptapRenderer({ node }: { node: ASTNode }) {
  if (!node) return null;

  if (node.type === "text") {
    let text: ReactNode = node.text;
    if (node.marks) {
      node.marks.forEach((mark) => {
        if (mark.type === "bold") text = <strong key={typeof text === "string" ? text + "b" : "b"}>{text}</strong>;
        if (mark.type === "italic") text = <em key={typeof text === "string" ? text + "i" : "i"}>{text}</em>;
      });
    }
    return <>{text}</>;
  }

  const children = node.content ? node.content.map((c, i) => <TiptapRenderer key={i} node={c} />) : null;

  switch (node.type) {
    case "doc": return <>{children}</>;
    case "heading": {
      const level = node.attrs?.level || node.level || 1;
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      
      let className = "font-heading font-bold mb-4 text-white border-b border-white/10 pb-2";
      if (level === 1) className = "text-3xl " + className + " mt-10";
      if (level === 2) className = "text-2xl mt-8 mb-3 text-ares-gold scroll-m-24 group relative border-none pb-0";
      if (level === 3) className = "text-xl mt-6 mb-2 text-ares-red scroll-m-24 group relative border-none pb-0";
      if (level === 4) className = "text-lg mt-4 mb-2 text-white/80 border-none pb-0";

      const textValue = node.content ? node.content.map(c => c.text || "").join("") : "";
      const id = textValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      return (
        <Tag id={id} className={className}>
          {(level === 2 || level === 3) && (
             <a href={`#${id}`} className="absolute -left-6 top-1 opcode-0 group-hover:opacity-100 transition-opacity text-ares-gray hover:text-ares-cyan" aria-label="Link to section">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
             </a>
          )}
          {children}
        </Tag>
      );
    }
    case "paragraph": return <p className="text-ares-offwhite/80 leading-relaxed mb-4">{children}</p>;
    case "bulletList": return <ul className="list-disc list-inside space-y-1 mb-4 text-ares-offwhite/70 ml-2">{children}</ul>;
    case "orderedList": return <ol className="list-decimal list-inside space-y-1 mb-4 text-ares-offwhite/70 ml-2">{children}</ol>;
    case "listItem": return <li className="leading-relaxed">{children}</li>;
    case "image": {
      const srcStr = validateUrl((node.src || node.attrs?.src || "") as string, 'image');
      const altStr = (node.alt || node.attrs?.alt || "") as string;
      if (!srcStr) return null;
      return (
        <figure className="my-8 ares-cut-sm overflow-hidden glass-card border border-white/5 bg-black/40">
          <div className="relative w-full aspect-video">
            <img src={srcStr} alt={altStr} className="w-full h-full object-cover" />
          </div>
          {altStr && <figcaption className="text-center text-xs tracking-widest uppercase font-bold text-ares-gold/60 mt-2 p-2">{altStr}</figcaption>}
        </figure>
      );
    }
    case "interactiveComponent": {
      const componentName = node.attrs?.componentName as string;
      const Component = ComponentMap[componentName];
      if (Component) {
        return (
          <Suspense fallback={<div className="p-8 border border-white/10 bg-ares-gray-dark rounded animate-pulse text-center text-marble/40">Loading interactive tool...</div>}>
            <Component className="my-8" />
          </Suspense>
        );
      }
      return (
        <div className="p-4 border border-ares-danger/50 bg-ares-danger/10 text-ares-danger-soft rounded my-8 font-mono text-sm">
          Unknown interactive component: {componentName}
        </div>
      );
    }
    case "blockquote": return (
      <blockquote className="border-l-4 border-ares-red/60 bg-ares-red/5 px-4 py-3 my-4 text-white/70 italic rounded-r-lg">
        {children}
      </blockquote>
    );
    case "table": return (
      <div className="overflow-x-auto my-6">
        <table className="w-full text-left border-collapse border border-white/10 ares-cut-sm hidden-border-corners shadow-lg table-auto">
          <tbody>{children}</tbody>
        </table>
      </div>
    );
    case "tableRow": return <tr className="border-b border-white/5 hover:bg-white/5 transition-colors odd:bg-black/20 even:bg-black/40">{children}</tr>;
    case "tableHeader": return <th className="bg-obsidian border border-white/10 p-3 font-bold text-ares-gold whitespace-nowrap uppercase tracking-wider text-sm">{children}</th>;
    case "tableCell": return <td className="border border-white/5 p-3 text-marble/80 align-top">{children}</td>;
    case "youtube": {
      const src = validateUrl(node.attrs?.src as string, 'video');
      if (!src) return null;
      return (
        <div className="my-8 w-full aspect-video ares-cut-sm overflow-hidden glass-card shadow-lg flex items-center justify-center">
          <iframe title="YouTube Video Component" src={src} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
        </div>
      );
    }
    case "taskList": return <ul className="list-none pl-0 space-y-2 my-4 text-ares-offwhite/80">{children}</ul>;
    case "taskItem": return (
      <li className="flex items-start gap-3">
        <div className="mt-1 flex-shrink-0">
          <input 
            type="checkbox" 
            checked={node.attrs?.checked as boolean} 
            readOnly 
            className="w-4 h-4 rounded appearance-none border border-white/20 bg-ares-black checked:bg-ares-cyan checked:border-ares-cyan relative after:content-[''] after:hidden checked:after:block after:absolute after:left-[4px] after:top-[1px] after:w-[6px] after:h-[10px] after:border-solid after:border-obsidian after:border-r-[2px] after:border-b-[2px] after:rotate-45 transition-colors cursor-default" 
          />
        </div>
        <div className={node.attrs?.checked ? "text-marble/40 line-through" : ""}>{children}</div>
      </li>
    );
    case "codeBlock": return (
        <div className="my-4"><CodeBlock value={node.content?.[0]?.text || ""} language={node.attrs?.language as string} /></div>
    );
    case "mermaidBlock": return (
        <div className="my-4"><CodeBlock value={node.content?.[0]?.text || ""} language="mermaid" /></div>
    );
    case "callout": {
      const type = node.attrs?.type || "info";
      let baseClass = "p-4 my-6 ares-cut-sm border flex gap-4";
      let icon = "ℹ️";
      
      if (type === "info") {
        baseClass += " bg-ares-cyan/10 border-ares-cyan/30 text-ares-offwhite";
        icon = "ℹ️";
      } else if (type === "warning") {
        baseClass += " bg-ares-red/10 border-ares-red/30 text-ares-offwhite";
        icon = "⚠️";
      } else if (type === "tip") {
        baseClass += " bg-ares-gold/10 border-ares-gold/30 text-ares-offwhite";
        icon = "💡";
      }

      return (
        <div className={baseClass}>
          <div className="text-xl flex-shrink-0">{icon}</div>
          <div className="prose-direct-children">{children}</div>
        </div>
      );
    }
    case "reveal": {
      const summary = (node.attrs?.summary || "Show Answer") as string;
      return <RevealBlock summary={summary}>{children}</RevealBlock>;
    }
    default: return <>{children}</>;
  }
}

function RevealBlock({ summary, children }: { summary: string, children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="my-6 ares-cut-sm border border-white/10 bg-black/20 overflow-hidden shadow-lg transition-all hover:border-ares-gold/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 text-left group transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 ares-cut-sm transition-colors ${isOpen ? 'bg-ares-gold text-black' : 'bg-white/5 text-ares-gold'}`}>
            <Eye size={18} />
          </div>
          <span className={`font-bold tracking-wide transition-colors ${isOpen ? 'text-white' : 'text-white/70 group-hover:text-ares-gold'}`}>
            {summary}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="text-white/40"
        >
          <ChevronDown size={20} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="px-6 py-6 border-t border-white/5 bg-gradient-to-b from-white/2 to-transparent">
              <div className="prose-direct-children">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
