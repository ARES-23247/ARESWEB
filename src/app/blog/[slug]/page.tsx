"use client";

import { logger } from "@/utils/logger";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { Helmet } from "react-helmet-async";
import { db } from "@/lib/firebaseFirestore";
import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";
import { useAuth } from "@/context/AuthContext";
import BlogManagementPage from "@/app/dashboard/blog/page";
import { Pencil, Clock } from "lucide-react";
import SEO from "@/components/SEO";
import ShareButtons from "@/components/ShareButtons";
import { PublicDataState } from "@/components/PublicDataState";
import BlogThumbnailImage, {
  getBlogThumbnailSource,
} from "@/components/BlogThumbnailImage";
import BlogTableOfContents from "@/components/blog/BlogTableOfContents";
import { calculateReadingTime } from "@/lib/blogSyndication";

interface BlogPostDetails {
  slug: string;
  title: string;
  date?: string;
  snippet?: string;
  thumbnail?: string;
  author?: string;
  authorAvatar?: string;
  category?: string;
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

    const docRef = doc(db, "posts", slug);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setPost(null);
          setLoadError(null);
          setIsLoading(false);
          return;
        }

        const data = docSnap.data();
        if (!data || data.isDeleted === 1 || data.status !== "published") {
          setPost(null);
          setLoadError(null);
          setIsLoading(false);
          return;
        }

        setPost({
          slug,
          title: data.title || "Untitled Post",
          date: data.date || "",
          snippet: data.snippet || "",
          thumbnail: data.thumbnail || "",
          author: data.author || "ARES Member",
          authorAvatar: data.authorAvatar || "",
          category: data.category || "Engineering",
          content: data.content || data.snippet || "",
        });
        setLoadError(null);
        setIsLoading(false);
      },
      (error) => {
        logger.error("Unable to load published blog post:", { slug, error });
        setPost(null);
        setLoadError(error.message);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
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
  const readingTime = calculateReadingTime(post.content);

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
          wordCount: readingTime.words,
          readingTime: readingTime.timeRequiredIso,
        }}
      />
      {/* RSS 2.0 & Atom Feed Discovery */}
      <Helmet>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="ARES 23247 Team Blog (RSS 2.0)"
          href="/rss.xml"
        />
        <link
          rel="alternate"
          type="application/atom+xml"
          title="ARES 23247 Team Blog (Atom)"
          href="/atom.xml"
        />
      </Helmet>

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

        <div className="relative z-10 max-w-5xl mx-auto px-6 w-full mt-16">
          <Link
            to="/blog"
            className="text-ares-gold hover:text-white uppercase tracking-widest text-xs font-bold transition-all flex items-center gap-2 mb-6 w-fit"
          >
            <span>&larr;</span> Back to all posts
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              {post.category && (
                <span className="px-3.5 py-1.5 ares-cut-sm text-xs font-black uppercase tracking-widest bg-ares-red/80 text-white border border-ares-red shadow-[0_0_15px_rgba(192,0,0,0.4)]">
                  {post.category}
                </span>
              )}
              <span className="w-fit px-3.5 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/50 shadow-[0_0_15px_rgba(0,192,192,0.4)]">
                {post.date}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 ares-cut-sm bg-white/5 border border-white/10 text-xs font-semibold text-marble/90">
                <Clock size={13} className="text-ares-gold" />
                {readingTime.text}
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

      {/* ─── BLOG BODY & STICKY SCROLLSPY TOC ─── */}
      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Article Content */}
          <div className="lg:col-span-8">
            {/* Mobile / Tablet Collapsible Table of Contents */}
            <div className="lg:hidden mb-8">
              <BlogTableOfContents content={post.content} />
            </div>

            <article className="prose prose-invert prose-ares max-w-none">
              <DocsMarkdownRenderer content={post.content} />
            </article>

            {/* Share Section */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <ShareButtons
                title={post.title}
                description={post.snippet}
                theme="gold"
              />
            </div>
          </div>

          {/* Sticky Desktop Table of Contents Sidebar */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="sticky top-28 space-y-6">
              <BlogTableOfContents content={post.content} />
            </div>
          </aside>
        </div>
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