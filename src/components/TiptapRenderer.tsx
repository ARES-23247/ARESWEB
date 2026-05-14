import { ReactNode, lazy, Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Eye, Images, Link as LinkIcon } from "lucide-react";
import { CodeBlock } from "./docs/CodeBlock";
import ErrorBoundary from "./ErrorBoundary";
import { SIM_COMPONENTS } from "./generated/sim-registry";
import { useGetGallery, useGetVideo } from "../api";
import { useGetAlbumMedia } from "../api/google-photos";
import { Link } from "@tanstack/react-router";

/* ---------- Lazy Loaded Simulators & Tools ---------- */
const CodePlayground = lazy(() => import('./docs/CodePlayground').catch(() => ({ default: () => <div className="text-ares-danger">Failed to load CodePlayground</div> })));
const InteractiveTutorial = lazy(() => import('./InteractiveTutorial').catch(() => ({ default: () => <div className="text-ares-danger">Failed to load InteractiveTutorial</div> })));
const CoreValueCallout = lazy(() => import('./CoreValueCallout').then(m => ({ default: m.CoreValueCallout })).catch(() => ({ default: () => <div className="text-ares-danger">Failed to load CoreValueCallout</div> })));
const ConfigVisualizer = lazy(() => import('./docs/ConfigVisualizer'));
const ScreenshotGallery = lazy(() => import('./docs/ScreenshotGallery'));
const SimulationPlayground = lazy(() => import('./SimulationPlayground').catch(() => ({ default: () => <div className="text-ares-danger">Failed to load SimulationPlayground</div> })));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ComponentMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>> | React.ComponentType<any>> = {
  CodePlayground,
  InteractiveTutorial,
  CoreValueCallout,
  ConfigVisualizer,
  ScreenshotGallery,
  SimulationPlayground,
  ...SIM_COMPONENTS,
  Mermaid: lazy(() => Promise.resolve({ default: () => <div className="p-4 border border-white/10 bg-ares-gray-dark rounded text-ares-gray text-sm font-mono">[Mermaid Diagram]</div> })),
  HomeCoreValues: lazy(() => Promise.resolve({ default: () => <div className="p-4 border border-white/10 bg-ares-gray-dark rounded text-ares-gray text-sm font-mono">[Core Values Component]</div> }))
};

/* ---------- Types & Helpers ---------- */
export interface ASTMark { type: string; attrs?: Record<string, string | number | boolean>; }
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

function getEmbedUrl(url: string): string {
  if (!url) return "";
  
  // YouTube - handles watch?v=, youtu.be/, embed/, and shorts/ formats
  const ytMatch = url.match(/v=([a-zA-Z0-9_-]{11})/) || 
                  url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) || 
                  url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/) ||
                  url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  return url;
}

function validateUrl(url: string, type: 'image' | 'video'): string {
  if (!url) return "";
  
  // Clean URL - remove any stray spaces
  url = url.trim();

  // Allow all relative paths
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url;

  // Allow blob and data URLs (often used in editor or for small assets)
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  try {
    const parsed = new URL(url);
    
    // Always allow HTTPS for images/videos. 
    // The public/_headers CSP is the authoritative source for domain filtering.
    // TiptapRenderer should not be second-guessing the browser's CSP if it's HTTPS.
    if (parsed.protocol === 'https:') return url;

    // Always allow current origin
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) return url;

    // Fallback domain whitelist for non-HTTPS or specific legacy cases
    const allowedDomains = [
      "aresnetwork.dev", "aresfirst.org", "youtube.com", "youtu.be", "googleusercontent.com",
      "cloudflare-ipfs.com", "raw.githubusercontent.com", "pages.dev", "google.com", "gstatic.com"
    ];

    const hostname = parsed.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (isAllowed) return url;
  } catch {
    // If it's not a valid absolute URL but starts with alphanumeric, it might be a relative path that was missed
    if (/^[a-zA-Z0-9]/.test(url)) return '/' + url;
  }

  // If we get here, it might be an invalid or blocked URL
  if (url.includes('://')) {
    console.warn(`Blocked ${type} URL for security (only HTTPS or same-origin allowed): ${url}`);
    return "";
  }
  
  // Final fallback: assume it's a path if it contains a slash but no protocol
  if (url.includes('/')) return url.startsWith('/') ? url : '/' + url;

  return "";
}

/* ---------- Node Renderers ---------- */

const renderText = (node: ASTNode) => {
  let text: ReactNode = node.text;
  if (!node.marks || !Array.isArray(node.marks)) return text;

  node.marks.forEach((mark) => {
    if (mark.type === "bold") text = <strong key={typeof text === "string" ? text + "b" : "b"}>{text}</strong>;
    if (mark.type === "italic") text = <em key={typeof text === "string" ? text + "i" : "i"}>{text}</em>;
    if (mark.type === "link") {
      const href = (mark.attrs?.href as string) || "#";
      const target = (mark.attrs?.target as string) || "_blank";
      text = (
        <a
          key={typeof text === "string" ? text + "a" : "a"}
          href={href}
          target={target}
          rel={target === "_blank" ? "noopener noreferrer" : undefined}
          className="text-ares-gold underline decoration-ares-gold/40 underline-offset-2 hover:text-ares-cyan hover:decoration-ares-cyan transition-colors"
        >
          {text}
        </a>
      );
    }
    if (mark.type === "code") text = <code key={typeof text === "string" ? text + "c" : "c"} className="bg-white/10 px-1.5 py-0.5 rounded text-ares-cyan text-sm font-mono">{text}</code>;
    if (mark.type === "strike") text = <s key={typeof text === "string" ? text + "s" : "s"}>{text}</s>;
    if (mark.type === "underline") text = <u key={typeof text === "string" ? text + "u" : "u"}>{text}</u>;
  });
  return text;
};

const renderHeading = (node: ASTNode, children: ReactNode) => {
  const level = node.attrs?.level || node.level || 1;
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  
  let className = "font-heading font-bold mb-4 text-white border-b border-white/10 pb-2";
  if (level === 1) className = "text-3xl " + className + " mt-10";
  if (level === 2) className = "text-2xl font-bold font-heading mt-8 mb-3 text-ares-gold scroll-m-24 group relative border-none pb-0";
  if (level === 3) className = "text-xl font-bold font-heading mt-6 mb-2 text-ares-red scroll-m-24 group relative border-none pb-0";
  if (level === 4) className = "text-lg font-bold font-heading mt-4 mb-2 text-white border-none pb-0";

  const textValue = (node.content && Array.isArray(node.content)) ? node.content.map(c => c.text || "").join("") : "";
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
};

const renderImage = (node: ASTNode) => {
  let rawSrc = (node.attrs?.src || node.src || "") as string;
  
  // Ensure leading slash for API routes if missing
  if (rawSrc.startsWith('api/')) rawSrc = '/' + rawSrc;
  
  const srcStr = validateUrl(rawSrc, 'image');
  const altStr = (node.attrs?.alt || node.alt || "") as string;
  const titleStr = (node.attrs?.title || "") as string;
  const width = node.attrs?.width;
  const height = node.attrs?.height;
  
  if (!srcStr) return null;

  const style: React.CSSProperties = {
    width: width && typeof width !== 'boolean' ? (typeof width === 'number' ? `${width}px` : width) : 'auto',
    height: height && typeof height !== 'boolean' ? (typeof height === 'number' ? `${height}px` : height) : 'auto',
    maxWidth: '100%',
    margin: '0 auto'
  };

  return (
    <figure className="my-10 flex flex-col items-center justify-center mx-auto" style={{ ...style, maxWidth: '100%' }}>
      <img 
        src={srcStr} 
        alt={altStr} 
        title={titleStr}
        className="block w-full h-auto max-h-[80vh] object-contain rounded shadow-2xl border border-white/10" 
        loading="lazy"
        decoding="async"
      />
      {altStr && (
        <figcaption className="text-center text-[10px] tracking-[0.2em] uppercase font-bold text-ares-gold/40 mt-4 px-4 max-w-2xl">
          {altStr}
        </figcaption>
      )}
    </figure>
  );
};

const renderInteractiveComponent = (node: ASTNode) => {
  const componentName = node.attrs?.componentName as string;
  const Component = ComponentMap[componentName];
  if (Component) {
    return (
      <ErrorBoundary fallback={<div className="p-4 border border-white/10 bg-ares-danger/10 text-ares-danger rounded text-sm font-mono my-8">Component failed to load</div>}>
        <Suspense fallback={<div className="p-8 border border-white/10 bg-ares-gray-dark rounded animate-pulse text-center text-marble/60">Loading interactive tool...</div>}>
          <div className="w-full my-8">
            <Component />
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }
  return (
    <div className="p-4 border border-ares-red/50 bg-ares-red/10 text-white font-bold rounded my-8 font-mono text-sm shadow-lg shadow-ares-red/20">
      Unknown interactive component: {componentName}
    </div>
  );
};

const renderYoutube = (node: ASTNode) => {
  const videoId = node.attrs?.videoId as string;
  const srcAttr = node.attrs?.src as string;
  
  let src = srcAttr || (videoId ? `https://www.youtube.com/embed/${videoId}` : null);
  if (src) src = getEmbedUrl(src);
  
  const validatedSrc = src ? validateUrl(src, 'video') : "";
  if (!validatedSrc) return null;

  return (
    <div className="my-8 w-full aspect-video ares-cut-sm overflow-hidden glass-card shadow-lg flex items-center justify-center">
      <iframe
        title="YouTube Video Component"
        src={validatedSrc}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  );
};

/**
 * Detects whether a videoId looks like an actual platform video ID (e.g. YouTube 11-char ID)
 * vs an internal ARESWEB media library ID (vid_*, UUID format).
 */
function looksLikeInternalId(id: string): boolean {
  if (!id) return false;
  // Internal IDs start with "vid_" or match UUID v4 pattern
  if (id.startsWith('vid_')) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return true;
  return false;
}

function VideoEmbedIframe({ src, title }: { src: string; title: string }) {
  return (
    <div className="my-8 w-full aspect-video ares-cut-sm overflow-hidden glass-card shadow-lg flex items-center justify-center">
      <iframe
        title={title}
        src={src}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  );
}

function VideoEmbedRenderer({ videoId: rawVideoId, platform: rawPlatform, title, mediaId }: {
  videoId: string; platform: string; title: string; mediaId?: string;
}) {
  // Determine which ID to use for API lookup — prefer mediaId, fall back to videoId if it looks internal
  const lookupId = mediaId || (looksLikeInternalId(rawVideoId) ? rawVideoId : null);
  const needsLookup = looksLikeInternalId(rawVideoId) && !!lookupId;

  const { data: videoResponse, isLoading } = useGetVideo(lookupId || '', {
    staleTime: Infinity,
    retry: 1,
  }) as { data: { video: { videoId: string; platform: string; title: string } } | undefined; isLoading: boolean };

  // Resolve the actual platform video ID
  const resolvedVideoId = needsLookup
    ? videoResponse?.video?.videoId ?? null
    : rawVideoId;
  const resolvedPlatform = needsLookup
    ? (videoResponse?.video?.platform ?? rawPlatform)
    : rawPlatform;

  if (needsLookup && isLoading) {
    return (
      <div className="my-8 w-full aspect-video ares-cut-sm overflow-hidden glass-card shadow-lg flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-white/10 border-t-ares-red rounded-full animate-spin" />
          <span className="text-white/40 text-sm font-mono">Loading video...</span>
        </div>
      </div>
    );
  }

  if (!resolvedVideoId) return null;

  // Generate embed URL based on platform
  let embedSrc = resolvedPlatform === 'youtube'
    ? `https://www.youtube.com/embed/${resolvedVideoId}`
    : resolvedPlatform === 'vimeo'
    ? `https://player.vimeo.com/video/${resolvedVideoId}`
    : '';

  if (!embedSrc) return null;
  embedSrc = getEmbedUrl(embedSrc);

  const validatedSrc = validateUrl(embedSrc, 'video');
  if (!validatedSrc) return null;

  return <VideoEmbedIframe src={validatedSrc} title={title} />;
}

// Gallery Embed Renderer Component
function GalleryEmbedRenderer({ galleryId, title }: { galleryId: string; title?: string }) {
  const { data: galleryResponse, isLoading, isError } = useGetGallery(galleryId);
  const gallery = (galleryResponse as unknown as { gallery: { id: string; title: string; thumbnail?: string } | null } | null)?.gallery ?? null;

  if (isLoading) {
    return (
      <div className="my-8 ares-cut-sm border border-white/10 bg-black/40 p-8 text-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Images className="w-12 h-12 text-ares-gold/60" />
          <div className="text-white/60">Loading gallery...</div>
        </div>
      </div>
    );
  }

  if (isError || !gallery) {
    // Silent fail - don't crash the entire blog post
    return null;
  }

  return (
    <Link
      to="/galleries/$id"
      params={{ id: galleryId }}
      className="block my-8 group"
    >
      <div className="ares-cut-sm border border-ares-gold/30 hover:border-ares-gold overflow-hidden glass-card transition-all duration-300">
        <div className="relative aspect-video overflow-hidden">
          <img
            src={gallery.thumbnail || "/api/media/1776551060548-favicon.webp"}
            alt={gallery.title || title || "Gallery"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2 text-ares-gold mb-2">
              <Images size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Photo Gallery</span>
            </div>
            <h3 className="text-white font-bold text-lg">{gallery.title || title || "Gallery"}</h3>
          </div>
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-ares-gold text-black px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2">
              <LinkIcon size={14} />
              View Gallery
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Album Embed Renderer Component (Masonry Grid)
function AlbumEmbedRenderer({ albumId, title }: { albumId: string; title?: string }) {
  const { data, isLoading, isError } = useGetAlbumMedia(albumId);

  if (isLoading) {
    return (
      <div className="my-8 ares-cut-sm border border-[#4285F4]/30 bg-black/40 p-12 text-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Images className="w-12 h-12 text-[#4285F4]/60" />
          <div className="text-white/60 font-mono text-sm">Loading album photos...</div>
        </div>
      </div>
    );
  }

  if (isError || !data?.mediaItems || data.mediaItems.length === 0) {
    return null;
  }

  return (
    <div className="my-10">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
        <div className="p-2 bg-[#4285F4]/10 text-[#4285F4] ares-cut-sm">
          <Images size={20} />
        </div>
        <div>
          <h3 className="text-white font-bold text-xl">{title || "Google Photos Album"}</h3>
          <p className="text-white/40 text-xs font-mono uppercase tracking-widest">{data.mediaItems.length} Photos</p>
        </div>
      </div>
      
      {/* CSS Columns Masonry */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {data.mediaItems.map((item) => {
          if (!item.mediaFile?.baseUrl) return null;
          return (
            <div key={item.id} className="break-inside-avoid relative group overflow-hidden ares-cut-sm border border-white/10 hover:border-[#4285F4]/50 transition-colors">
              <img
                src={`${item.mediaFile.baseUrl}=w800`}
                alt="Gallery item"
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <a 
                  href={`${item.mediaFile.baseUrl}=d`}
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="px-4 py-2 ares-cut-sm bg-[#4285F4] text-white font-bold text-sm flex items-center gap-2 hover:bg-[#4285F4]/80 transition-colors"
                >
                  <Eye size={16} /> View Full
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const renderGalleryEmbed = (node: ASTNode) => {
  const galleryId = node.attrs?.galleryId as string;
  const albumId = node.attrs?.albumId as string;
  const title = node.attrs?.title as string;

  if (albumId) {
    return <AlbumEmbedRenderer albumId={albumId} title={title} />;
  }

  if (!galleryId) return null;

  return <GalleryEmbedRenderer galleryId={galleryId} title={title} />;
};

const renderTaskItem = (node: ASTNode, children: ReactNode) => (
  <li className="flex items-start gap-3">
    <div className="mt-1 flex-shrink-0">
      <input 
        type="checkbox" 
        aria-label="Task checkbox"
        title="Task checkbox"
        checked={node.attrs?.checked as boolean} 
        readOnly 
        className="w-4 h-4 rounded appearance-none border border-white/20 bg-ares-black checked:bg-ares-cyan checked:border-ares-cyan relative after:content-[''] after:hidden checked:after:block after:absolute after:left-[4px] after:top-[1px] after:w-[6px] after:h-[10px] after:border-solid after:border-obsidian after:border-r-[2px] after:border-b-[2px] after:rotate-45 transition-colors cursor-default" 
      />
    </div>
    <div className={node.attrs?.checked ? "text-marble/60 line-through" : ""}>{children}</div>
  </li>
);

const renderCallout = (node: ASTNode, children: ReactNode) => {
  const type = node.attrs?.type || "info";
  let baseClass = "p-4 my-6 ares-cut-sm border flex gap-4";
  let icon = "ℹ️";
  
  if (type === "info") {
    baseClass += " bg-ares-cyan/10 border-ares-cyan/30 text-white";
    icon = "ℹ️";
  } else if (type === "warning") {
    baseClass += " bg-ares-red/10 border-ares-red/30 text-white";
    icon = "⚠️";
  } else if (type === "tip") {
    baseClass += " bg-ares-gold/10 border-ares-gold/30 text-white";
    icon = "💡";
  }

  return (
    <div className={baseClass}>
      <div className="text-xl flex-shrink-0">{icon}</div>
      <div className="prose-direct-children">{children}</div>
    </div>
  );
};

const renderGoogleDriveEmbed = (node: ASTNode) => {
  const src = (node.attrs?.src as string) || '';
  const title = (node.attrs?.title as string) || src || 'Google Drive File';
  
  if (!src) return null;

  let typeName = 'Google Document';
  let iconColor = 'text-ares-red';
  
  if (src.includes('document')) {
    typeName = 'Google Docs';
    iconColor = 'text-blue-400';
  } else if (src.includes('spreadsheets')) {
    typeName = 'Google Sheets';
    iconColor = 'text-green-400';
  } else if (src.includes('presentation')) {
    typeName = 'Google Slides';
    iconColor = 'text-yellow-400';
  } else if (src.includes('forms')) {
    typeName = 'Google Forms';
    iconColor = 'text-purple-400';
  } else if (src.includes('drive.google.com/file')) {
    typeName = 'Google Drive File';
    iconColor = 'text-zinc-400';
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      data-google-drive="true"
      title={title}
      className="flex items-center gap-4 p-4 my-6 bg-obsidian border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-white no-underline w-full max-w-lg shadow-md"
    >
      <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-md bg-white/5 border border-white/10 ${iconColor}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
      <div className="flex flex-col overflow-hidden w-full">
        <span className="font-bold text-sm text-zinc-100 truncate">{title}</span>
        <span className="text-xs text-zinc-400 truncate w-full block">{typeName}</span>
      </div>
    </a>
  );
};

/* ---------- Main Component ---------- */

export default function TiptapRenderer({ node }: { node: ASTNode }) {
  if (!node) return null;

  if (node.type === "text") {
    return <>{renderText(node)}</>;
  }

  const children = (node.content && Array.isArray(node.content)) ? node.content.map((c, i) => <TiptapRenderer key={i} node={c} />) : null;

  switch (node.type) {
    case "doc": return <>{children}</>;
    case "heading": return renderHeading(node, children);
    case "paragraph": return <p className="text-white/80 leading-relaxed mb-4">{children || <br/>}</p>;
    case "bulletList": return <ul className="list-disc list-inside space-y-1 mb-4 text-white/70 ml-2">{children}</ul>;
    case "orderedList": return <ul className="list-decimal list-inside space-y-1 mb-4 text-white/70 ml-2">{children}</ul>;
    case "listItem": return <li className="leading-relaxed">{children}</li>;
    case "image": return renderImage(node);
    case "imageResize": return renderImage(node);
    case "interactiveComponent": return renderInteractiveComponent(node);
    case "blockquote": return <blockquote className="border-l-4 border-ares-red/60 bg-ares-red/5 px-4 py-3 my-4 text-white italic font-bold">{children}</blockquote>;
    case "table": return (
      <div className="overflow-x-auto my-6">
        <table className="w-full text-left border-collapse border border-white/10 ares-cut-sm hidden-border-corners shadow-lg table-auto">
          <tbody>{children}</tbody>
        </table>
      </div>
    );
    case "tableRow": return <tr className="border-b border-white/5 hover:bg-white/5 transition-colors odd:bg-black/20 even:bg-black/40">{children}</tr>;
    case "tableHeader": return <th className="bg-obsidian border border-white/10 p-3 font-bold text-ares-gold whitespace-nowrap uppercase tracking-wider text-sm">{children}</th>;
    case "tableCell": return <td className="border border-white/5 p-3 text-marble align-top">{children}</td>;
    case "youtube": return renderYoutube(node);
    case "videoEmbed": return <VideoEmbedRenderer videoId={node.attrs?.videoId as string} platform={node.attrs?.platform as string || 'youtube'} title={node.attrs?.title as string || 'Video'} mediaId={node.attrs?.mediaId as string} />;
    case "galleryEmbed": return renderGalleryEmbed(node);
    case "taskList": return <ul className="list-none pl-0 space-y-2 my-4 text-white/80">{children}</ul>;
    case "taskItem": return renderTaskItem(node, children);
    case "codeBlock": return <div className="my-4"><CodeBlock value={node.content?.[0]?.text || ""} language={node.attrs?.language as string} /></div>;
    case "mermaidBlock": return <div className="my-4"><CodeBlock value={node.content?.[0]?.text || ""} language="mermaid" /></div>;
    case "callout": return renderCallout(node, children);
    case "reveal": {
      const summary = (node.attrs?.summary || "Show Answer") as string;
      return <RevealBlock summary={summary}>{children}</RevealBlock>;
    }
    case "googleDriveEmbed": return renderGoogleDriveEmbed(node);
    default: return <>{children}</>;
  }
}

/* ---------- Sub-Components ---------- */

function RevealBlock({ summary, children }: { summary: string, children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = `reveal-content-${summary.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div className="my-6 ares-cut-sm border border-white/10 bg-black/20 overflow-hidden shadow-lg transition-all hover:border-ares-gold/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        {...({ 'aria-expanded': isOpen ? true : false })}
        {...({ 'aria-controls': contentId })}
        className="w-full flex items-center justify-between px-6 py-4 text-left group transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 ares-cut-sm transition-colors ${isOpen ? 'bg-ares-gold text-black' : 'bg-white/5 text-ares-gold'}`}>
            <Eye size={18} />
          </div>
          <span className={`font-bold tracking-wide transition-colors ${isOpen ? 'text-white' : 'text-white group-hover:text-ares-gold'}`}>
            {summary}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="text-white/60"
        >
          <ChevronDown size={20} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={contentId}
            role="region"
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
