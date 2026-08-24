"use client";

import { logger } from "@/utils/logger";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";
import TiptapRenderer from "@/components/TiptapRenderer";
import { useAuth } from "@/context/AuthContext";
import BlogManagementPage from "@/app/dashboard/blog/page";
import { Pencil } from "lucide-react";
import SEO from "@/components/SEO";
import ShareButtons from "@/components/ShareButtons";
import { PublicDataState } from "@/components/PublicDataState";
import { toTiptapAst, toPlainText } from "@/lib/contentFormatters";
import BlogThumbnailImage, {
  getBlogThumbnailSource,
} from "@/components/BlogThumbnailImage";
import {
  fetchPublicBlogPost,
  PublicContentApiError,
} from "@/lib/publicContentApi";

interface BlogPostDetails {
  slug: string;
  title: string;
  date?: string;
  snippet?: string;
  thumbnail?: string;
  author?: string;
  authorAvatar?: string;
  content: string;
}

export default function BlogPostPage() {
  const { user, authorizedUser } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editor Drawer States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorAction, setEditorAction] = useState<"create" | "edit" | null>(
    null,
  );
  const [editorSlug, setEditorSlug] = useState<string | null>(null);

  const canEdit = !!(
    user &&
    authorizedUser &&
    authorizedUser.role !== "unverified"
  );

  const handleOpenInlineEdit = () => {
    setEditorAction("edit");
    setEditorSlug(slug || null);
    setIsEditorOpen(true);
  };

  useEffect(() => {
    if (!slug) return;

    let active = true;
    void fetchPublicBlogPost(slug)
      .then((data) => {
        if (!active) return;
        const rawSnippet = data.snippet || data.content || "";
        setPost({
          slug,
          title: data.title || "Untitled Post",
          date: data.date || "",
          snippet: toPlainText(rawSnippet, 200),
          thumbnail: data.thumbnail || "",
          author: data.author || "ARES Member",
          authorAvatar: data.authorAvatar || "",
          content: data.content || data.snippet || "",
        });
        setLoadError(null);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof PublicContentApiError && error.status === 404) {
          setPost(null);
          setLoadError(null);
          setIsLoading(false);
          return;
        }
        logger.error("Unable to load published blog post:", { slug, error });
        setPost(null);
        setLoadError(error instanceof Error ? error.message : "Unable to load the published blog post.");
        setIsLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-obsidian text-marble">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ares-red"></div>
      </div>
    );
  }

  if (loadError || !post) {
    return (
      <div className="min-h-screen bg-obsidian px-6 py-24 text-marble">
        <SEO
          title={
            loadError ? "Article Temporarily Unavailable" : "Post Not Found"
          }
          description="This ARES 23247 blog article is unavailable."
          noindex
        />
        <div className="mx-auto max-w-3xl">
          <PublicDataState
            title={
              loadError ? "Unable to Load Blog Post" : "Blog Post Not Found"
            }
            message={
              loadError
                ? "We encountered a technical error retrieving this blog post. Please try refreshing."
                : "The blog post you requested does not exist, has been unpublished, or was moved."
            }
            diagnostic={
              loadError
                ? `Firestore error loading slug: ${slug}`
                : `Post slug '${slug}' not found`
            }
            onRetry={loadError ? () => window.location.reload() : undefined}
          />
        </div>
      </div>
    );
  }

  const heroImage = getBlogThumbnailSource(post);

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble">
      <SEO
        title={post.title}
        description={
          post.snippet ||
          `Read "${post.title}" by ${post.author || "ARES Member"} on the ARES 23247 team blog.`
        }
        image={heroImage}
        type="article"
        schemaData={{
          authorName: post.author || "ARES Member",
          datePublished: (() => {
            if (!post.date) return undefined;
            const parsed = Date.parse(post.date);
            return isNaN(parsed) ? undefined : new Date(parsed).toISOString();
          })(),
        }}
      />
      {/* ─── STANDALONE BLOG HERO ─── */}
      <section className="relative w-full h-[50vh] min-h-[400px] flex items-center overflow-hidden bg-obsidian border-b-4 border-ares-cyan">
        <BlogThumbnailImage
          title={post.title}
          thumbnail={post.thumbnail}
          author={post.author}
          date={post.date}
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/70 to-transparent"></div>

        {/* Motif: Glowing orb overlay */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vh] h-[80vh] rounded-full border border-ares-cyan/10 shadow-[0_0_120px_rgba(0,192,192,0.15)] pointer-events-none mix-blend-screen animate-pulse"
          aria-hidden="true"
        ></div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 w-full mt-16">
          <Link
            to="/blog"
            className="text-ares-gold hover:text-white uppercase tracking-widest text-xs font-bold transition-all flex items-center gap-2 mb-6 w-fit"
          >
            <span>&larr;</span> Back to all posts
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="w-fit px-4 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/50 shadow-[0_0_15px_rgba(0,192,192,0.4)]">
                {post.date}
              </span>
              <div className="flex items-center gap-2 px-3 py-1.5 ares-cut-sm bg-white/5 border border-white/10 w-fit">
                <img
                  src={
                    post.authorAvatar
                      ? post.authorAvatar.startsWith("http") ||
                        post.authorAvatar.includes("/")
                        ? post.authorAvatar
                        : `/favicon.png`
                      : "/favicon.png"
                  }
                  alt=""
                  className="w-5 h-5 rounded-full object-cover border border-ares-gold/40"
                />
                <span className="text-xs text-marble/90 font-medium">
                  {post.author}
                </span>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={handleOpenInlineEdit}
                className="flex items-center gap-2 px-4 py-2 bg-ares-gold/10 hover:bg-ares-gold/20 text-ares-gold border border-ares-gold/40 rounded ares-cut-sm text-xs font-bold transition-all shadow-[0_0_15px_rgba(255,215,0,0.15)] cursor-pointer w-fit"
                title="Edit this post in the dashboard drawer"
              >
                <Pencil size={14} />
                <span>Edit Post</span>
              </button>
            )}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white font-heading">
            {post.title}
          </h1>
        </div>
      </section>

      {/* ─── BLOG BODY ─── */}
      <div className="w-full max-w-4xl mx-auto px-6 py-12">
        <article className="prose prose-invert prose-ares max-w-none">
          {(() => {
            const ast = toTiptapAst(post.content);
            if (ast) {
              return <TiptapRenderer node={ast} />;
            }
            return <DocsMarkdownRenderer content={post.content} />;
          })()}
        </article>
      </div>

      {/* ─── SHARE SECTION ─── */}
      <div className="w-full max-w-4xl mx-auto px-6 pb-16">
        <ShareButtons
          title={post.title}
          description={post.snippet}
          theme="gold"
        />
      </div>

      {/* ─── UPGRADED FULL BLOG EDITOR DRAWER ─── */}
      {isEditorOpen && (
        <BlogManagementPage
          editorOnly={true}
          prefilledAction={editorAction}
          prefilledSlug={editorSlug}
          onEditorClose={() => {
            setIsEditorOpen(false);
            setEditorAction(null);
            setEditorSlug(null);
          }}
        />
      )}
    </div>
  );
}
