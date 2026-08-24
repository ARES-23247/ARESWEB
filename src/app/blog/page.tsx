"use client";

import { logger } from "@/utils/logger";
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import BlogManagementPage from "@/app/dashboard/blog/page";
import { Pencil, Plus } from "lucide-react";
import SEO from "@/components/SEO";
import BlogThumbnailImage from "@/components/BlogThumbnailImage";
import { PublicDataState } from "@/components/PublicDataState";
import { toPlainText } from "@/lib/contentFormatters";
import { fetchPublicBlogPosts } from "@/lib/publicContentApi";

interface BlogPost {
  slug: string;
  title: string;
  date?: string;
  snippet?: string;
  thumbnail?: string;
  author?: string;
  authorAvatar?: string;
}

export default function BlogFeedPage() {
  const { user, authorizedUser } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
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

  const handleOpenInlineCreate = () => {
    setEditorAction("create");
    setEditorSlug(null);
    setIsEditorOpen(true);
  };

  const handleOpenInlineEdit = (slug: string) => {
    setEditorAction("edit");
    setEditorSlug(slug);
    setIsEditorOpen(true);
  };

  useEffect(() => {
    let active = true;
    void fetchPublicBlogPosts()
      .then((publishedPosts) => {
        if (!active) return;
        const postsList = publishedPosts.map((post) => ({
          ...post,
          snippet: toPlainText(post.snippet || "", 200),
        }));
        setPosts(postsList);
        setLoadError(null);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        logger.error("Unable to load published blog posts:", error);
        setPosts([]);
        setLoadError(error instanceof Error ? error.message : "Unable to load published blog posts.");
        setIsLoading(false);
      });

    return () => { active = false; };
  }, []);

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title="Blog"
        description="Deep technical insight, mechanical design updates, code breakdowns, and outreach reflections from ARES 23247 robotics team."
      />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        <div className="mb-12 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <p className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-4">
              Engineering & Outreach
            </p>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter">
              Team{" "}
              <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white font-bold">
                Blog
              </span>
              .
            </h1>
            <p className="text-marble/85 text-lg font-medium mt-4 max-w-2xl text-balance">
              Read deep dives into our codebase, mechanical design process, and
              reflections on our outreach events.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={handleOpenInlineCreate}
              className="clipped-button bg-ares-red text-white hover:bg-ares-bronze font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl shrink-0"
            >
              <Plus size={16} /> New Blog Post
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ares-red"></div>
          </div>
        ) : loadError ? (
          <PublicDataState
            title="Unable to load the team blog"
            message="The published articles could not be reached. Check your connection and try again."
            diagnostic={loadError}
            onRetry={() => window.location.reload()}
          />
        ) : posts.length === 0 ? (
          <section className="hero-card border border-white/10 bg-black/20 p-12 text-center">
            <h2 className="text-xl font-black text-white">
              No published articles yet
            </h2>
            <p className="mt-2 text-sm text-marble/70">
              New engineering and outreach stories will appear here.
            </p>
          </section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => {
              return (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <div className="glass-card hero-card overflow-hidden cursor-pointer flex flex-col h-full border border-white/10">
                    <div className="relative h-56 w-full overflow-hidden bg-black/30 flex items-center justify-center border-b border-white/5">
                      <BlogThumbnailImage
                        title={post.title}
                        thumbnail={post.thumbnail}
                        author={post.author}
                        date={post.date}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent animate-fadeIn"></div>

                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleOpenInlineEdit(post.slug);
                          }}
                          className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-ares-gold/80 border border-white/10 rounded-lg transition-all text-white cursor-pointer z-10 hover:scale-105 active:scale-95 shadow-lg"
                          title="Edit Article"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                    <div className="p-6 flex-grow flex flex-col justify-between">
                      <div>
                        <h4 className="text-xl font-bold text-white mb-2 group-hover:text-ares-red-light transition-colors">
                          {post.title}
                        </h4>
                        <p className="text-sm text-white/60 line-clamp-3 mb-4">
                          {post.snippet}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                        <p className="text-xs text-white/50">{post.date}</p>
                        <div className="flex items-center gap-1.5">
                          <img
                            src={
                              post.authorAvatar
                                ? post.authorAvatar.startsWith("http") ||
                                  post.authorAvatar.includes("/")
                                  ? post.authorAvatar
                                  : `https://api.dicebear.com/7.x/bottts/svg?seed=${post.authorAvatar}`
                                : `https://api.dicebear.com/7.x/bottts/svg?seed=${post.author || post.slug}`
                            }
                            alt=""
                            className="w-5 h-5 rounded-full object-cover border border-white/10"
                          />
                          <span className="text-xs uppercase tracking-wider font-bold text-ares-gold/80 truncate max-w-[120px]">
                            {post.author}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
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
