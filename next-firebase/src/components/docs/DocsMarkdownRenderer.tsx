import React, { memo, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Link as LinkIcon } from "lucide-react";
import { SIM_COMPONENTS, SIM_TAG_NAMES } from "../generated/sim-registry";

// ── Lazy-loaded Non-Sim Components ─────────────────────────────────────
const ConfigVisualizer = lazy(() => import("./ConfigVisualizer"));
const SimulationPlayground = lazy(() => import("../SimulationPlayground"));
const CodePlayground = lazy(() => import("./CodePlayground"));
const ScreenshotGallery = lazy(() => import("./ScreenshotGallery"));
const InteractiveTutorial = lazy(() => import("../InteractiveTutorial"));

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

export default memo(function DocsMarkdownRenderer({ content }: DocsMarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, {
          ...defaultSchema,
          tagNames: [
            ...(defaultSchema.tagNames || []),
            // Non-sim components
            "configvisualizer", "simulationplayground", "codeplayground",
            "screenshotgallery", "interactivetutorial",
            // All sims from SIM_COMPONENTS (auto-populated)
            ...SIM_TAG_NAMES
          ]
        }]
      ]}
      components={{
        // @ts-expect-error Custom component tag names
        configvisualizer: () => <LazyWrap><ConfigVisualizer /></LazyWrap>,
        simulationplayground: () => <LazyWrap><SimulationPlayground /></LazyWrap>,
        codeplayground: () => <LazyWrap><CodePlayground /></LazyWrap>,
        screenshotgallery: () => <LazyWrap><ScreenshotGallery /></LazyWrap>,
        // @ts-expect-error Custom component tag names
        interactivetutorial: () => <LazyWrap><InteractiveTutorial /></LazyWrap>,
        // All sims from SIM_COMPONENTS (auto-populated)
        ...Object.fromEntries(
          SIM_TAG_NAMES.map(tag => [tag, () => {
            const SimComponent = SIM_COMPONENTS[tag];
            return <LazyWrap><SimComponent /></LazyWrap>;
          }])
        ),
        h1: ({ children }) => <h1 className="text-3xl font-bold font-heading mt-10 mb-4 text-white border-b border-white/10 pb-2">{children}</h1>,
        h2: ({ children }) => {
          const text = String(children);
          const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return (
            <h2 id={id} className="text-2xl font-bold font-heading mt-8 mb-3 text-ares-gold scroll-m-24 group relative">
              <a href={`#${id}`} className="absolute -left-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-marble/60 hover:text-ares-cyan" aria-label="Link to section">
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
              <a href={`#${id}`} className="absolute -left-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-marble/60 hover:text-ares-cyan" aria-label="Link to section">
                <LinkIcon size={16} />
              </a>
              {children}
            </h3>
          );
        },
        h4: ({ children }) => <h4 className="text-lg font-bold font-heading mt-4 mb-2 text-marble">{children}</h4>,
        p: ({ children }) => <p className="my-4 leading-relaxed text-marble/90">{children}</p>,
        a: ({ href, children }) => {
          const safeUrl = validateUrl(href);
          if (!safeUrl) return <span>{children}</span>;
          return (
            <a
              href={safeUrl}
              className="text-ares-cyan hover:text-ares-cyan/80 underline underline-offset-2"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {children}
            </a>
          );
        },
        ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-2 text-marble/90 marker:text-ares-red">{children}</ul>,
        ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-2 text-marble/90 marker:text-ares-red">{children}</ol>,
        li: ({ children }) => <li className="ml-2">{children}</li>,
        code: ({ className, children }) => {
          // Inline code (no className) vs code block (has language className)
          if (!className) {
            return <code className="px-1.5 py-0.5 bg-white/5 text-ares-cyan font-mono text-sm rounded border border-white/10">{children}</code>;
          }
          // Code blocks are handled by CodeBlock component
          return <code className={className}>{children}</code>;
        },
        pre: ({ children }) => {
          // If child is a code element with className, use CodeBlock component
          if (React.Children.toArray(children).some((child) => {
            if (typeof child === "object" && child && "type" in child && child.type === "code") {
              const props = child.props as { className?: string };
              return props.className?.startsWith("language-");
            }
            return false;
          })) {
            return <>{children}</>;
          }
          return <pre className="bg-obsidian border border-white/10 rounded-lg p-4 overflow-x-auto">{children}</pre>;
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-ares-gold/50 pl-4 py-2 my-4 italic text-marble/70 bg-white/5">
            {children}
          </blockquote>
        ),
        table: ({ children }) => <div className="overflow-x-auto my-6"><table className="min-w-full divide-y divide-white/10 border border-white/10">{children}</table></div>,
        thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-white/5">{children}</tbody>,
        tr: ({ children }) => <tr className="hover:bg-white/3">{children}</tr>,
        th: ({ children }) => <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-white">{children}</th>,
        td: ({ children }) => <td className="px-4 py-3 text-sm text-marble/80">{children}</td>,
        hr: () => <hr className="my-8 border-t border-white/10" />,
        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-marble/80">{children}</em>,
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt || ""}
            className="my-6 rounded-lg border border-white/10 max-w-full h-auto"
            loading="lazy"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
