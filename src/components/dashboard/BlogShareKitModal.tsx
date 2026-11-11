import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Send,
  Share2,
  X,
} from "lucide-react";
import { siteConfig } from "@/lib/site-config";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  type BlogSharePostInput,
  buildBlogShareCaption,
  buildBlogWebShareIntents,
  buildCanonicalBlogUrl,
  buildInstagramCaption,
  renderInstagramSquareCardDataUrl,
} from "@/lib/blogShareKit";

interface BlogShareKitModalProps<T extends BlogSharePostInput = BlogSharePostInput> {
  post: T | null;
  isApprover: boolean;
  syndicatingSlug?: string | null;
  onSyndicate?: (item: T) => void | Promise<void>;
  onClose: () => void;
}

export default function BlogShareKitModal<T extends BlogSharePostInput = BlogSharePostInput>({
  post,
  isApprover,
  syndicatingSlug = null,
  onSyndicate,
  onClose,
}: BlogShareKitModalProps<T>) {
  const dialogRef = useFocusTrap(Boolean(post), onClose);
  const [copiedField, setCopiedField] = useState<
    "caption" | "link" | "instagram" | null
  >(null);

  useEffect(() => {
    setCopiedField(null);
  }, [post?.slug]);

  const shareBundle = useMemo(() => {
    if (!post) return null;
    const input = {
      slug: post.slug,
      title: post.title,
      description: post.description,
      category: post.category,
      author: post.author,
      date: post.date,
    };
    let cardDataUrl: string | null = null;
    try {
      cardDataUrl = renderInstagramSquareCardDataUrl(input);
    } catch {
      cardDataUrl = null;
    }
    return {
      canonicalUrl: buildCanonicalBlogUrl(post.slug),
      caption: buildBlogShareCaption(input),
      instagramCaption: buildInstagramCaption(input),
      intents: buildBlogWebShareIntents(input),
      cardDataUrl,
      downloadFilename: `ares-23247-${post.slug}-instagram.png`,
    };
  }, [post]);

  if (!post || !shareBundle) return null;

  const copyToClipboard = async (
    value: string,
    field: "caption" | "link" | "instagram",
  ) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    } catch {
      setCopiedField(null);
    }
  };

  const isSyndicatingThis = syndicatingSlug === post.slug;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="blog-share-kit-title"
        className="glass-card relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-obsidian p-6 text-left text-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-ares-gold">
              <Share2 size={13} aria-hidden="true" /> Zero-Key Social Share Kit
            </p>
            <h2
              id="blog-share-kit-title"
              className="mt-1 font-heading text-2xl font-black tracking-tight text-white"
            >
              Share Kit: {post.title}
            </h2>
            <p className="mt-1 text-xs text-marble/75">
              Share across X, Facebook, Bluesky, LinkedIn, and Instagram with zero
              third-party API keys. Link posts automatically display the ARES
              OpenGraph preview card.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-ares-cyan"
            aria-label="Close Share Kit"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div aria-live="polite" className="sr-only">
          {copiedField === "caption" && "Caption and link copied to clipboard."}
          {copiedField === "link" && "Blog post link copied to clipboard."}
          {copiedField === "instagram" && "Instagram caption copied to clipboard."}
        </div>

        <div className="mt-6 space-y-6">
          {/* 1-Click Browser Compose Intents */}
          <section aria-labelledby="share-kit-intents-heading">
            <h3
              id="share-kit-intents-heading"
              className="text-xs font-black uppercase tracking-widest text-ares-cyan"
            >
              1. One-Click Compose (Auto-Renders Preview Card)
            </h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <a
                href={shareBundle.intents.x}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-white transition-colors hover:border-ares-gold/50 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <span>Post on X</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
              <a
                href={shareBundle.intents.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-white transition-colors hover:border-ares-gold/50 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <span>Share on Facebook</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
              <a
                href={shareBundle.intents.bluesky}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-white transition-colors hover:border-ares-gold/50 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <span>Compose on Bluesky</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
              <a
                href={shareBundle.intents.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-white transition-colors hover:border-ares-gold/50 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <span>Share on LinkedIn</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </div>
          </section>

          {/* Ready-to-Paste Caption & Link */}
          <section aria-labelledby="share-kit-caption-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3
                id="share-kit-caption-heading"
                className="text-xs font-black uppercase tracking-widest text-ares-gold"
              >
                2. Ready-to-Paste Caption &amp; Link
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyToClipboard(shareBundle.canonicalUrl, "link")}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  {copiedField === "link" ? (
                    <Check size={13} className="text-ares-cyan" aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  {copiedField === "link" ? "Link Copied" : "Copy Link"}
                </button>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(shareBundle.caption, "caption")}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ares-gold/40 bg-ares-gold/15 px-3 py-1.5 text-xs font-black text-ares-gold hover:bg-ares-gold/25 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  {copiedField === "caption" ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  {copiedField === "caption" ? "Copied!" : "Copy Caption & Link"}
                </button>
              </div>
            </div>
            <pre className="mt-2.5 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-3.5 font-sans text-xs leading-relaxed text-marble/90">
              {shareBundle.caption}
            </pre>
          </section>

          {/* Instagram Square Graphic + Caption */}
          <section
            aria-labelledby="share-kit-instagram-heading"
            className="rounded-xl border border-white/10 bg-black/30 p-4"
          >
            <h3
              id="share-kit-instagram-heading"
              className="text-xs font-black uppercase tracking-widest text-ares-gold"
            >
              3. Instagram Feed Kit (1080×1080 Card + Caption)
            </h3>
            <p className="mt-1 text-xs text-marble/70">
              Instagram feed posts require a square/portrait graphic and do not make
              caption links clickable. Download the branded card below and paste the
              caption.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr] md:items-start">
              {shareBundle.cardDataUrl ? (
                <img
                  src={shareBundle.cardDataUrl}
                  alt={`1080 by 1080 ARES Instagram card preview for ${post.title}`}
                  className="aspect-square w-44 rounded-lg border border-white/15 object-cover shadow-lg"
                />
              ) : (
                <div className="flex aspect-square w-44 items-center justify-center rounded-lg border border-white/15 bg-black/40 p-3 text-center text-[11px] text-marble/60">
                  Preview unavailable in this browser
                </div>
              )}
              <div className="space-y-3">
                <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-3 font-sans text-xs leading-relaxed text-marble/85">
                  {shareBundle.instagramCaption}
                </pre>
                <div className="flex flex-wrap gap-2">
                  {shareBundle.cardDataUrl && (
                    <a
                      href={shareBundle.cardDataUrl}
                      download={shareBundle.downloadFilename}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ares-red px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-ares-bronze focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      <Download size={14} aria-hidden="true" />
                      Download 1080×1080 Instagram PNG
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void copyToClipboard(shareBundle.instagramCaption, "instagram")
                    }
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    {copiedField === "instagram" ? (
                      <Check size={14} className="text-ares-cyan" aria-hidden="true" />
                    ) : (
                      <Copy size={14} aria-hidden="true" />
                    )}
                    {copiedField === "instagram"
                      ? "Instagram Caption Copied"
                      : "Copy Instagram Caption"}
                  </button>
                  <a
                    href={siteConfig.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-marble hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    Open @aresftc23247
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Direct Team Channels (Zulip & Bluesky) */}
          {isApprover && onSyndicate && (
            <section
              aria-labelledby="share-kit-direct-heading"
              className="flex flex-col justify-between gap-3 rounded-xl border border-ares-cyan/25 bg-ares-cyan/5 p-4 sm:flex-row sm:items-center"
            >
              <div>
                <h3
                  id="share-kit-direct-heading"
                  className="text-xs font-black uppercase tracking-widest text-ares-cyan"
                >
                  Direct Automated Channels (Zulip &amp; Bluesky)
                </h3>
                <p className="mt-1 text-xs text-marble/75">
                  Zulip <code className="text-white">#announcements</code> and{" "}
                  <code className="text-white">@ares23247.bsky.social</code> run
                  automatically on publish. Safe to click again—delivered channels are
                  never duplicated.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onSyndicate(post)}
                disabled={syndicatingSlug !== null}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-ares-cyan/45 bg-ares-cyan/15 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-ares-cyan hover:bg-ares-cyan/25 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-wait disabled:opacity-60"
              >
                <Send size={13} aria-hidden="true" />
                {isSyndicatingThis
                  ? "Sending…"
                  : "Announce on Zulip & Bluesky"}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : modal;
}
