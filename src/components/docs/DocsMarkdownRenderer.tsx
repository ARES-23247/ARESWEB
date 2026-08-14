import React, { memo, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Link as LinkIcon } from "lucide-react";
import { safeContentImageUrl, safeContentLinkUrl } from "@/lib/contentUrls";
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

const EMBED_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
]);

export function validateEmbedUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !EMBED_HOSTS.has(parsed.hostname)) return undefined;
    const isYouTubeEmbed = parsed.hostname.includes("youtube") && parsed.pathname.startsWith("/embed/");
    const isVimeoEmbed = parsed.hostname === "player.vimeo.com" && parsed.pathname.startsWith("/video/");
    return isYouTubeEmbed || isVimeoEmbed ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export default memo(function DocsMarkdownRenderer({ content }: DocsMarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url, key) =>
        (key === "src" ? safeContentImageUrl(url) : safeContentLinkUrl(url)) ?? ""
      }
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, {
          ...defaultSchema,
          tagNames: [
            ...(defaultSchema.tagNames || []),
            "iframe",
            // Non-sim components
            "configvisualizer", "simulationplayground", "codeplayground",
            "screenshotgallery", "interactivetutorial",
            // All sims from SIM_COMPONENTS (auto-populated)
            ...SIM_TAG_NAMES
          ],
          attributes: {
            ...(defaultSchema.attributes || {}),
            "*": ["className"],
            iframe: [
              "src",
              "title",
              "width",
              "height",
              "frameborder",
              "allow",
              "allowfullscreen",
              "className"
            ]
          },
          protocols: {
            ...(defaultSchema.protocols || {}),
            href: ["http", "https", "mailto", "tel"],
            src: ["http", "https"]
          }
        }]
      ]}
      components={{
        // @ts-expect-error Custom component tag names
        configvisualizer: () => <LazyWrap><ConfigVisualizer /></LazyWrap>,
        simulationplayground: () => <LazyWrap><SimulationPlayground /></LazyWrap>,
        codeplayground: () => <LazyWrap><CodePlayground /></LazyWrap>,
        screenshotgallery: () => <LazyWrap><ScreenshotGallery /></LazyWrap>,
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
            <h3 id={id} className="inline-block text-xs font-heading font-black bg-ares-red text-white px-3 py-1 ares-cut-sm uppercase tracking-widest mt-6 mb-2 scroll-m-24 group relative">
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
          const safeUrl = safeContentLinkUrl(href);
          if (!safeUrl) return <span>{children}</span>;
          const opensNewTab = /^https?:/i.test(safeUrl);
          return (
            <a
              href={safeUrl}
              className="text-ares-cyan hover:text-ares-cyan/80 underline underline-offset-2"
              target={opensNewTab ? "_blank" : undefined}
              rel={opensNewTab ? "noopener noreferrer" : undefined}
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
        img: ({ src, alt }) => {
          const safeUrl = safeContentImageUrl(src);
          if (!safeUrl) {
            return (
              <span role="note" className="my-4 block rounded border border-white/10 bg-black/20 p-3 text-sm text-marble/70">
                Image unavailable{alt ? `: ${alt}` : ""}
              </span>
            );
          }
          return (
            <img
              src={safeUrl}
              alt={alt || ""}
              className="my-6 rounded-lg border border-white/10 max-w-full h-auto"
              loading="lazy"
              decoding="async"
            />
          );
        },
        iframe: ({ src, title }) => {
          const safeEmbedUrl = validateEmbedUrl(src);
          if (!safeEmbedUrl) {
            return (
              <p role="alert" className="my-4 border border-ares-red/45 bg-ares-red/15 p-3 text-sm text-white">
                This embedded frame was blocked. Only approved YouTube and Vimeo embed URLs are supported.
              </p>
            );
          }
          return (
            <iframe
              src={safeEmbedUrl}
              title={title || "Embedded media"}
              className="w-full aspect-video rounded-lg my-6 border-none shadow-xl"
              sandbox="allow-scripts allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
